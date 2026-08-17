// Gift card helpers — called server-side from order handlers, server fns, admin routes.
// All amounts in Lek (ALL) internally.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars — no 0/O/I/1

function randomSegment(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}

export function generateGiftCardCode(): string {
  return `NOTT-${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}

// ── Atomic debit ──────────────────────────────────────────────────────────────
// Returns the new balance after the debit.
// Throws if card doesn't exist, isn't active, or has insufficient balance.

export async function atomicDebitGiftCard(
  code: string,
  amountLek: number,
  orderId: string,
): Promise<{ balanceAfter: number; giftCardId: string }> {
  const { db } = await import("@/db");
  const { giftCard, giftCardTransaction } = await import("@/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  // Whole Lek only — keeps balances integer-valued (no fractional float drift).
  const amt = Math.round(amountLek);
  if (amt <= 0) throw new Error("Gift card debit amount must be positive.");

  const normalizedCode = code.toUpperCase().trim();

  // Conditional update: only succeeds if balance is sufficient and card is active.
  // The atomic `balance >= amount` guard means two concurrent debits can never
  // drive the balance negative — at most one of them succeeds.
  const updated = await db()
    .update(giftCard)
    .set({
      balance: sql`balance - ${amt}`,
      lastUsedAt: new Date(),
      // Mark depleted if the remaining balance after this debit would be 0
      status: sql`CASE WHEN balance - ${amt} <= 0 THEN 'depleted' ELSE status END`,
    })
    .where(sql`code = ${normalizedCode} AND status = 'active' AND balance >= ${amt}`)
    .returning({ id: giftCard.id, balance: giftCard.balance });

  if (updated.length === 0) {
    // Could be: wrong code, depleted, disabled, expired, or insufficient balance
    const [card] = await db()
      .select({ status: giftCard.status, balance: giftCard.balance })
      .from(giftCard)
      .where(eq(giftCard.code, code.toUpperCase().trim()))
      .limit(1);

    if (!card) throw new Error("Gift card not found.");
    if (card.status !== "active") throw new Error("This gift card is no longer active.");
    throw new Error("Insufficient gift card balance. Please check your cart total.");
  }

  const { id: giftCardId, balance: balanceAfter } = updated[0];

  // Append ledger row — not atomic with the UPDATE but that's acceptable for audit
  await db().insert(giftCardTransaction).values({
    id: randomUUID(),
    giftCardId,
    type: "redeem",
    amount: -amt,
    balanceAfter: balanceAfter ?? 0,
    orderId,
  });

  return { balanceAfter: balanceAfter ?? 0, giftCardId };
}

// ── Issue a gift card ─────────────────────────────────────────────────────────
// Called after payment succeeds. Creates the card record + ledger row + sends email.

export interface IssueGiftCardParams {
  amountLek: number;
  purchaserUserId: string | null;
  purchaserEmail: string;
  purchaserName?: string;
  recipientEmail: string;
  recipientName: string;
  message?: string | null;
  forSelf: boolean;
  sourceOrderId: string | null;
}

export async function issueGiftCard(params: IssueGiftCardParams): Promise<string> {
  const { db } = await import("@/db");
  const { giftCard, giftCardTransaction } = await import("@/db/schema");
  const { randomUUID } = await import("node:crypto");

  const id = randomUUID();
  // Store whole Lek only — keeps balances integer-valued so fractional float
  // drift can't accumulate across partial redemptions.
  const amountLek = Math.round(params.amountLek);
  // Retry on rare code collision (32^12 space makes collision astronomically unlikely)
  let code = generateGiftCardCode();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db().insert(giftCard).values({
        id,
        code,
        initialAmount: amountLek,
        balance: amountLek,
        status: "active",
        purchaserUserId: params.purchaserUserId,
        purchaserEmail: params.purchaserEmail,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        message: params.message ?? null,
        sourceOrderId: params.sourceOrderId,
      });
      break;
    } catch (err) {
      const msg = String((err as Error)?.message ?? "");
      if (msg.includes("unique") || (err as { code?: string })?.code === "23505") {
        code = generateGiftCardCode();
        continue;
      }
      throw err;
    }
  }

  // Ledger: issue
  await db().insert(giftCardTransaction).values({
    id: randomUUID(),
    giftCardId: id,
    type: "issue",
    amount: params.amountLek,
    balanceAfter: params.amountLek,
    orderId: params.sourceOrderId,
  });

  // Must be awaited on CF Workers — unawaited promises are killed when the response sends
  const { sendGiftCardDelivery } = await import("@/lib/resend");
  await sendGiftCardDelivery({
    to: params.recipientEmail,
    recipientName: params.recipientName,
    senderName: params.forSelf ? null : (params.purchaserName || params.purchaserEmail),
    code,
    amountLek: params.amountLek,
    message: params.message ?? null,
  }).catch((err) => console.error("[resend] gift card delivery failed:", err));

  return code;
}

// ── Validate gift card (read-only, no debit) ──────────────────────────────────

export async function validateGiftCard(
  code: string,
  amountDueEur: number,
  eurToLekRate: number,
  // Balance already committed by other in-flight (unpaid) orders using this card.
  // Subtracted from the real balance so two concurrent checkouts can't each
  // reserve the full amount and double-spend it.
  reservedLek = 0,
): Promise<{
  valid: true;
  code: string;
  balanceLek: number;
  appliedLek: number;
  appliedEur: number;
} | {
  valid: false;
  error: string;
}> {
  const { db } = await import("@/db");
  const { giftCard } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const [card] = await db()
    .select({ id: giftCard.id, status: giftCard.status, balance: giftCard.balance, expiresAt: giftCard.expiresAt, code: giftCard.code })
    .from(giftCard)
    .where(eq(giftCard.code, code.toUpperCase().trim()))
    .limit(1);

  if (!card) return { valid: false, error: "Invalid or expired gift card code." };
  if (card.status !== "active") return { valid: false, error: "This gift card is no longer active." };
  if (card.expiresAt && card.expiresAt < new Date()) return { valid: false, error: "This gift card has expired." };
  if ((card.balance ?? 0) <= 0) return { valid: false, error: "This gift card has no remaining balance." };

  const balanceLek = card.balance ?? 0;
  const availableLek = Math.max(0, balanceLek - Math.max(0, reservedLek));
  if (availableLek <= 0) {
    return { valid: false, error: "This gift card's balance is committed to another pending order. Please complete it or try again shortly." };
  }
  const amountDueLek = amountDueEur * eurToLekRate;
  const appliedLek = Math.min(availableLek, amountDueLek);
  const appliedEur = appliedLek / eurToLekRate;

  return { valid: true, code: card.code, balanceLek, appliedLek, appliedEur };
}
