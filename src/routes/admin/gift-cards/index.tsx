import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Server fns ───────────────────────────────────────────────────────────────

const listGiftCards = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin/auth");
  await requireAdmin();
  const { db } = await import("@/db");
  const { giftCard } = await import("@/db/schema");
  const { desc } = await import("drizzle-orm");

  const rows = await db()
    .select()
    .from(giftCard)
    .orderBy(desc(giftCard.createdAt))
    .limit(200);

  return rows;
});

const searchGiftCards = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ query: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin/auth");
    await requireAdmin();
    const { db } = await import("@/db");
    const { giftCard } = await import("@/db/schema");
    const { or, ilike, desc } = await import("drizzle-orm");

    const q = `%${data.query.trim()}%`;
    const rows = await db()
      .select()
      .from(giftCard)
      .where(or(ilike(giftCard.code, q), ilike(giftCard.recipientEmail, q), ilike(giftCard.purchaserEmail, q)))
      .orderBy(desc(giftCard.createdAt))
      .limit(50);

    return rows;
  });

const issueAdminGiftCard = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      amountLek: z.number().int().min(500),
      recipientEmail: z.string().email(),
      recipientName: z.string().min(1),
      message: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin/auth");
    const admin = await requireAdmin();
    const { issueGiftCard } = await import("@/lib/giftCard");
    const { db } = await import("@/db");
    const { giftCard } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const code = await issueGiftCard({
      amountLek: data.amountLek,
      purchaserUserId: null,
      purchaserEmail: admin.email,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      message: data.message ?? null,
      forSelf: false,
      sourceOrderId: null,
    });

    // Tag as admin-issued
    await db()
      .update(giftCard)
      .set({ issuedByAdminId: admin.id })
      .where(eq(giftCard.code, code))
      .catch(() => {});

    return { code };
  });

// ─── Types ────────────────────────────────────────────────────────────────────

type GiftCard = Awaited<ReturnType<typeof listGiftCards>>[number];

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/gift-cards/")({
  loader: async () => listGiftCards(),
  component: AdminGiftCardsPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function AdminGiftCardsPage() {
  const initial = Route.useLoaderData();
  const [cards, setCards] = useState<GiftCard[]>(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  // Issue modal
  const [showIssue, setShowIssue] = useState(false);
  const [issueAmount, setIssueAmount] = useState("");
  const [issueEmail, setIssueEmail] = useState("");
  const [issueName, setIssueName] = useState("");
  const [issueMessage, setIssueMessage] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!q.trim()) {
      setCards(initial);
      return;
    }
    setSearching(true);
    try {
      const results = await searchGiftCards({ data: { query: q } });
      setCards(results);
    } catch {
      // silently ignore
    } finally {
      setSearching(false);
    }
  }

  async function handleIssue() {
    setIssueError(null);
    const amount = parseInt(issueAmount.replace(/\D/g, ""), 10);
    if (!amount || amount < 500) { setIssueError("Minimum 500 L"); return; }
    if (!issueEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(issueEmail)) { setIssueError("Valid email required"); return; }
    if (!issueName.trim()) { setIssueError("Recipient name required"); return; }

    setIssuing(true);
    try {
      const { code } = await issueAdminGiftCard({
        data: { amountLek: amount, recipientEmail: issueEmail, recipientName: issueName, message: issueMessage || undefined },
      });
      setIssueSuccess(code);
      // Refresh list
      const fresh = await listGiftCards();
      setCards(fresh);
      setIssueAmount("");
      setIssueEmail("");
      setIssueName("");
      setIssueMessage("");
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : "Failed to issue gift card");
    } finally {
      setIssuing(false);
    }
  }

  function statusColor(status: string) {
    if (status === "active") return "text-green-400";
    if (status === "depleted") return "text-muted-foreground/40";
    if (status === "disabled") return "text-clay";
    return "text-muted-foreground/60";
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Admin</p>
          <h1 className="serif mt-1 text-3xl text-ink">Gift cards</h1>
        </div>
        <button
          onClick={() => { setShowIssue(true); setIssueSuccess(null); setIssueError(null); }}
          className="bg-foreground px-5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-background transition-opacity hover:opacity-80"
        >
          Issue gift card
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by code, email…"
          style={{ fontSize: '16px' }}
          className="w-full max-w-sm border-b border-border bg-transparent pb-2 font-mono text-[12px] text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {["Code", "Amount / Balance", "Status", "Recipient", "Created", ""].map((h) => (
                <th key={h} className="pb-3 pr-6 text-left font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {searching && (
              <tr>
                <td colSpan={6} className="py-8 text-center font-mono text-[11px] text-muted-foreground/50">Searching…</td>
              </tr>
            )}
            {!searching && cards.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center font-mono text-[11px] text-muted-foreground/50">No gift cards found.</td>
              </tr>
            )}
            {!searching && cards.map((gc) => (
              <tr key={gc.id} className="border-b border-border/40 transition-colors hover:bg-muted/30">
                <td className="py-4 pr-6 font-mono text-[11px] text-ink">{gc.code}</td>
                <td className="py-4 pr-6 font-mono text-[11px] text-ink">
                  {gc.balance.toLocaleString()} L
                  <span className="ml-1 text-muted-foreground/40">/ {gc.initialAmount.toLocaleString()} L</span>
                </td>
                <td className={`py-4 pr-6 font-mono text-[10px] uppercase tracking-widest ${statusColor(gc.status)}`}>{gc.status}</td>
                <td className="py-4 pr-6 font-mono text-[11px] text-muted-foreground/70">
                  {gc.recipientName}
                  <span className="ml-1.5 text-[10px] text-muted-foreground/40">{gc.recipientEmail}</span>
                </td>
                <td className="py-4 pr-6 font-mono text-[10px] text-muted-foreground/50">
                  {new Date(gc.createdAt).toLocaleDateString()}
                </td>
                <td className="py-4">
                  <Link
                    to="/admin/gift-cards/$id"
                    params={{ id: gc.id }}
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 transition-colors hover:text-ink"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Issue modal */}
      {showIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowIssue(false); }}>
          <div className="w-full max-w-md border border-border bg-background p-8">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink">Issue gift card</p>
              <button onClick={() => setShowIssue(false)} className="text-muted-foreground/40 hover:text-ink">✕</button>
            </div>

            {issueSuccess ? (
              <div className="space-y-4">
                <p className="font-mono text-[11px] text-green-400">Gift card issued successfully.</p>
                <p className="font-mono text-[13px] tracking-widest text-ink">{issueSuccess}</p>
                <p className="font-mono text-[9px] text-muted-foreground/50">Delivery email sent to recipient.</p>
                <button onClick={() => setShowIssue(false)} className="mt-4 w-full border border-border py-3 font-mono text-[10px] uppercase tracking-widest text-ink transition-colors hover:border-ink/50">
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <IssueField label="Amount (Lek)" value={issueAmount} onChange={setIssueAmount} placeholder="e.g. 5000" inputMode="numeric" />
                <IssueField label="Recipient name" value={issueName} onChange={setIssueName} placeholder="Their name" />
                <IssueField label="Recipient email" value={issueEmail} onChange={setIssueEmail} type="email" placeholder="they@somewhere.com" />
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Message (optional)</label>
                  <textarea
                    value={issueMessage}
                    onChange={(e) => setIssueMessage(e.target.value)}
                    rows={2}
                    style={{ fontSize: '16px' }}
                    className="mt-2 w-full resize-none border-b border-border bg-transparent pb-2 font-mono text-[12px] text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                  />
                </div>
                {issueError && <p className="font-mono text-[9px] uppercase tracking-widest text-clay">{issueError}</p>}
                <button
                  onClick={handleIssue}
                  disabled={issuing}
                  className="w-full bg-foreground py-3 font-mono text-[10px] uppercase tracking-widest text-background transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {issuing ? "Issuing…" : "Issue gift card"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueField({ label, value, onChange, type = "text", placeholder, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        style={{ fontSize: '16px' }}
        className="mt-2 w-full border-b border-border bg-transparent pb-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
      />
    </div>
  );
}
