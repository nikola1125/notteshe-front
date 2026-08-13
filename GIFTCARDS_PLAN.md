# Gift Cards — Implementation Plan

_Stack: TanStack Start · Drizzle · Neon Postgres · POK Pay (card) + COD · Resend · Cloudflare Workers._
_Status: proposed. No code yet._

## Core principle

A gift card code is **money** (a bearer instrument). Every design choice below follows from that:
balances change only through an append-only ledger, redemption is atomic to prevent double-spend,
codes have real entropy and rate-limited lookup, and refunds credit value back. Two independent
flows: **buying** a gift card, and **redeeming** one.

## 1. Data model (new tables)

**`gift_card`**
- id, `code` (unique, e.g. `NOTT-7K3P-9QW2-4F8D`), `pin` (optional extra secret)
- `initialAmount`, `balance` (current), `currency` (`ALL` / L)
- `status`: `active | depleted | disabled | expired`
- `purchaserUserId` (nullable), `purchaserEmail`, `recipientEmail`, `recipientName`, `message`
- `deliverAt` (nullable — scheduled send), `sourceOrderId` (nullable — the order that bought it),
  `issuedByAdminId` (nullable — manual issue)
- `expiresAt` (nullable), `createdAt`, `lastUsedAt`

**`gift_card_transaction`** (append-only ledger — the source of truth for balance)
- id, `giftCardId`, `type`: `issue | redeem | refund | adjust | expire`
- `amount` (signed: +issue, −redeem, +refund), `balanceAfter`, `orderId` (nullable),
  `adminId` (nullable), `note`, `createdAt`

Balance is never edited blindly — it's mutated only alongside a ledger row, in a transaction.

## 2. Buying a gift card (workflow)

1. Customer opens the **Gift Card** page (a dedicated product, flagged `isGiftCard`).
2. Chooses an **amount** — a preset (e.g. 2,000 / 5,000 / 10,000 L) **or a custom amount they type in**.
3. Chooses **who it's for**:
   - **For myself** → the code is sent to the buyer, who redeems it like a wallet balance.
   - **Gift to someone** → enters recipient name + email + an optional message; the code is sent to
     the recipient.
4. Added to cart as a **digital line item**: no shipping fee, no size/colour, no stock check.
5. Checkout — **online payment only** (POK card). **COD is disabled for gift cards** (you can't hand
   cash for a code). If the cart is *only* gift cards, the shipping step is skipped.
6. On **payment success**: create the gift card, write an `issue` ledger row, set balance = amount,
   and **instantly email the code** to whoever it's for (recipient if gifted, otherwise the buyer),
   plus a receipt to the buyer. Delivery is immediate — no scheduling.

## 3. Redeeming a gift card (workflow)

1. At checkout the shopper enters a **gift card code** (a field like the existing discount code).
2. Server validates: exists, `status = active`, not expired, `balance > 0`. Returns the amount that
   will apply = `min(balance, amountDue)`.
3. The applied amount reduces the total due. Two cases:
   - **Order ≥ balance:** whole balance used, remainder of the order paid by card/COD.
   - **Balance > order:** only the order amount is used; the rest stays on the card for next time.
4. On **order finalization (payment success)**: **atomically** debit the card — a conditional update
   that only succeeds if `balance >= appliedAmount` — and write a `redeem` ledger row linked to the
   order. If the card was drained by another order in the meantime, fail gracefully and ask the
   shopper to pay the difference.
5. Confirmation + email show the **remaining balance**.

## 4. Totals — order of operations

Gift cards are **tender (a payment method)**, not a discount, so they apply **last**, to the final
amount owed:

```
subtotal
  − discount code
  + shipping fee
  + payment fee
= amount due
  − gift card (min(balance, amount due))
= amount to pay by card/COD
```

If the gift card covers everything, **amount to pay = 0** → see the zero-total path in §7.

## 5. Admin management (new "Gift Cards" section)

- List / search by code, recipient, or buyer email.
- For each card, see at a glance: **total (initial amount), amount spent, amount remaining**, status,
  who it was for, and the **full transaction ledger** (every issue/redeem/refund with the order it
  belongs to).
- **Refund** a card — one action, two modes:
  - **Refund remaining** → returns the current balance to the buyer and disables the card.
  - **Refund in full** → returns the full initial amount and disables the card.
  Each writes a `refund` ledger row. The money is returned via the original **POK payment** where
  possible, or recorded as a **manual/offline refund** with a note.
- **Manually issue** a gift card (marketing/comp) with an amount + recipient, and send it.
- **Disable / re-enable**, **adjust balance** (with a required reason → ledger `adjust` row),
  **resend** the delivery email, **edit recipient email** (fix typos), optionally **set/extend an
  expiry** (off by default).
- Every action `requireAdmin` + `logAudit` (existing pattern).

## 6. Emails & delivery (Resend)

- **Gift card delivery** → recipient: code, amount, buyer's message, how to redeem, expiry.
- **Purchase confirmation** → buyer.
- **Scheduled delivery** (`deliverAt`): a **Cloudflare Cron Trigger** runs periodically, finds cards
  whose send time has passed and aren't yet delivered, and sends them (Phase 2).
- Optional: low-balance / depleted notice.

## 7. Edge cases & guardrails ("make no mistakes")

- **Double-spend / concurrency:** debit via a single conditional `UPDATE ... WHERE balance >= amount`
  (same atomic style as the discount-code counter). Never read-then-write balance.
- **Debit on success only:** validate at checkout, but debit at **payment success** — never on a
  pending/failed order — so a failed payment never spends the card.
- **Zero-total orders:** when a gift card covers the whole order (incl. shipping), bypass the payment
  gateway and create the order directly as paid — but only *after* the atomic debit succeeds, so a
  €0 order can never be created without real value being consumed.
- **Refunds / cancellations:** if an order paid partly by a gift card is refunded, **credit the
  amount back** to the card (`refund` ledger row). If a gift-card *purchase* order is refunded,
  **disable the issued card** (and claw back only if unspent).
- **Anti-fraud / enumeration:** codes need real entropy; **rate-limit** validation attempts; return a
  generic "invalid or expired" (never reveal whether a code exists); all validation server-side.
- **No gift-card-on-gift-card:** disallow redeeming a gift card to *buy* a gift card (prevents
  laundering / loops).
- **Expiry: none by default.** Cards do not expire unless an admin explicitly sets a date on a card
  (optional). Note that gift-card expiry is legally regulated in the EU/Albania — so if the client
  ever enables expiries, keep them long and confirm the local rule first.
- **Tax/accounting:** a gift-card sale is normally **not taxed at purchase** (deferred revenue); VAT
  applies when it's redeemed on goods. Flag this for the client's accountant — it differs from a
  normal product sale.
- **Currency:** cards issued and redeemed in **Lek (L)** only, matching the store.
- **Partial + multi-use:** a card is used across multiple orders until depleted (`status = depleted`).

## 8. Where it plugs into the existing code

- **Schema:** `gift_card` + `gift_card_transaction`; idempotent migration in `scripts/apply-pending.mjs`.
- **Catalog:** an `isGiftCard` product (or a dedicated `/gift-cards` route) + cart handling that skips
  shipping/size/colour/stock for digital items.
- **Checkout / finalization:** `checkout.tsx` (COD), `src/lib/orders.ts` + `src/routes/api/pokpay/
  webhook.ts` (card): add gift-card validation, adjust the totals calc, add the zero-total path, and
  do the **issue** (for purchases) and **atomic debit** (for redemptions) at payment success.
- **Admin:** new `admin/gift-cards` routes + server fns + sidebar entry (Gift icon), mirroring the
  Collections/Discounts patterns.
- **Email:** new Resend templates in `src/lib/resend`.
- **Scheduling:** Cloudflare Cron Trigger for `deliverAt` (Phase 2).
- Keep gift cards **separate from `discount_code`** — they're balance-bearing tender, not a discount.

## 9. Build order / phasing

**Phase 1 (the full feature as specified)**
1. Schema + migration (`gift_card` + `gift_card_transaction`).
2. Buying: **preset + custom amounts**, **for-myself or gift-to-someone**, online-pay-only, issue +
   **instant** delivery email on success.
3. Redeeming: single code at checkout, partial balance, **atomic debit**, remaining-balance display,
   zero-total path.
4. Admin: list/search, per-card **total / spent / remaining** + ledger, **refund (remaining or full)**,
   manual issue, disable, adjust, resend, optional expiry.
5. Verify build + end-to-end (buy → receive → redeem → partial → deplete → refund).

**Phase 2 (optional, later)**
- Multiple gift cards per order; public balance-check page; **reloadable top-up** (add more value to
  an existing card); low-balance emails.

## 10. Decisions (locked)

- **Amounts:** both — presets **and** a custom amount the buyer types in.
- **Expiry:** none by default; optional per-card expiry an admin can set.
- **Delivery:** instant only (no scheduling).
- **Use or gift:** buyer can keep and use the card themselves, or send it to someone.
- **Admin refund:** supported — either the **remaining balance** or the **full initial amount**.
