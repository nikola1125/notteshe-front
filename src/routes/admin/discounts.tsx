import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, desc } from "drizzle-orm";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import { Trash2, Share2, X, Download, Copy } from "lucide-react";
import { db } from "@/db";
import { discountCode } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import type { DiscountCode } from "@/db/schema";

const getDiscounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiscountCode[]> => {
    await requireAdmin();
    return db().select().from(discountCode).orderBy(desc(discountCode.createdAt));
  }
);

const createDiscount = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as {
        code: string;
        type: "PERCENT" | "FIXED";
        value: number;
        minOrderAmount?: number;
        maxUses?: number;
        expiresAt?: string;
      }
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const id = crypto.randomUUID();
    await db()
      .insert(discountCode)
      .values({
        id,
        code: data.code.toUpperCase().trim(),
        type: data.type,
        value: data.value,
        minOrderAmount: data.minOrderAmount ?? null,
        maxUses: data.maxUses ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      });
    await logAudit(admin.id, "discount.create", "discount_code", id, {
      after: { code: data.code },
    });
    return { id };
  });

const toggleDiscount = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string; active: boolean })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(discountCode)
      .set({ isActive: data.active })
      .where(eq(discountCode.id, data.id));
    await logAudit(admin.id, "discount.toggle", "discount_code", data.id);
    return { success: true };
  });

const deleteDiscount = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ id: (input as { id: string }).id }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .delete(discountCode)
      .where(eq(discountCode.id, data.id));
    await logAudit(admin.id, "discount.delete", "discount_code", data.id);
    return { success: true };
  });

export const Route = createFileRoute("/admin/discounts")({
  loader: () => getDiscounts(),
  staleTime: 30_000,
  component: Discounts,
});

const EMPTY_FORM = {
  code: "",
  type: "PERCENT" as "PERCENT" | "FIXED",
  value: "",
  minOrderAmount: "",
  maxUses: "",
  expiresAt: "",
};

function CouponShareModal({ code, onClose }: { code: DiscountCode; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const discountLabel =
    code.type === "PERCENT" ? `${code.value}% OFF` : `${code.value.toFixed(0)} € OFF`;

  async function captureImage(): Promise<Blob | null> {
    if (!cardRef.current) return null;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await captureImage();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notteshe-${code.code.toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download image");
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare(platform: "instagram-post" | "instagram-story" | "whatsapp" | "native") {
    try {
      const blob = await captureImage();
      if (!blob) return;
      const file = new File([blob], `notteshe-${code.code.toLowerCase()}.png`, { type: "image/png" });

      if (platform === "native" || platform === "instagram-post" || platform === "instagram-story") {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Notteshe — ${discountLabel}`,
            text: `Use code ${code.code} for ${discountLabel} on notteshe.com`,
          });
          return;
        }
        // Fallback: download
        await handleDownload();
        toast("Image downloaded — share it manually on Instagram");
        return;
      }

      if (platform === "whatsapp") {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: `Use code *${code.code}* for ${discountLabel} at notteshe.com` });
        } else {
          const text = encodeURIComponent(`🛍️ Use code *${code.code}* for ${discountLabel} at notteshe.com`);
          window.open(`https://wa.me/?text=${text}`, "_blank");
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Share failed");
    }
  }

  async function handleCopy() {
    setCopying(true);
    await navigator.clipboard.writeText(code.code);
    setTimeout(() => setCopying(false), 1500);
  }

  // Lock background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black/90 backdrop-blur-sm">

      {/* ── Fixed header — always visible, never scrolls ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Share coupon</p>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Scrollable body — only this scrolls, background stays locked ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
      <div
        className="mx-auto w-full max-w-sm px-4 py-6"
      >

        {/* ── Coupon card ── captured by html-to-image ── */}
        <div
          ref={cardRef}
          style={{
            width: "100%",
            background: "#0f0f0f",
            fontFamily: "Georgia, 'Times New Roman', serif",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Outer border frame */}
          <div style={{ margin: 12, border: "1px solid #222", position: "relative" }}>

            {/* Top strip — cream */}
            <div style={{
              background: "#ede8e0",
              padding: "16px 28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.4em", color: "#1a1a1a", textTransform: "uppercase", fontWeight: 600 }}>
                Notteshe
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 7, letterSpacing: "0.25em", color: "#888", textTransform: "uppercase" }}>
                Exclusive Offer
              </span>
            </div>

            {/* Hero section */}
            <div style={{ background: "#0f0f0f", padding: "44px 28px 36px", textAlign: "center", position: "relative" }}>

              {/* Warm glow */}
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(200,170,120,0.07) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />

              {/* Category label */}
              <p style={{ fontFamily: "monospace", fontSize: 7, letterSpacing: "0.45em", color: "#4a4a4a", textTransform: "uppercase", margin: "0 0 20px" }}>
                {code.type === "PERCENT" ? "Percent discount" : "Fixed discount"}
              </p>

              {/* Big number */}
              <p style={{
                fontSize: 88,
                fontWeight: 300,
                color: "#f0ebe3",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                margin: 0,
              }}>
                {code.type === "PERCENT" ? `${code.value}%` : `${code.value.toFixed(0)} €`}
              </p>

              <p style={{
                fontFamily: "monospace",
                fontSize: 8,
                letterSpacing: "0.45em",
                color: "#7a6a58",
                textTransform: "uppercase",
                margin: "12px 0 0",
              }}>
                off your order
              </p>
            </div>

            {/* Tear-off row — notch circles + dashed line */}
            <div style={{ background: "#0f0f0f", position: "relative", height: 24, display: "flex", alignItems: "center" }}>
              {/* Left notch */}
              <div style={{
                position: "absolute", left: -13, top: "50%", transform: "translateY(-50%)",
                width: 26, height: 26, borderRadius: "50%",
                background: "#0f0f0f",
                border: "1px solid #222",
                zIndex: 2,
              }} />
              {/* Dashed line */}
              <div style={{ flex: 1, margin: "0 14px", borderTop: "1px dashed #2c2c2c" }} />
              {/* Scissors icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3a3a3a" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </svg>
              <div style={{ flex: 1, margin: "0 14px", borderTop: "1px dashed #2c2c2c" }} />
              {/* Right notch */}
              <div style={{
                position: "absolute", right: -13, top: "50%", transform: "translateY(-50%)",
                width: 26, height: 26, borderRadius: "50%",
                background: "#0f0f0f",
                border: "1px solid #222",
                zIndex: 2,
              }} />
            </div>

            {/* Code section */}
            <div style={{ background: "#0a0a0a", padding: "28px 28px 24px", textAlign: "center" }}>
              <p style={{ fontFamily: "monospace", fontSize: 7, letterSpacing: "0.45em", color: "#3a3a3a", textTransform: "uppercase", margin: "0 0 14px" }}>
                Use code
              </p>

              {/* Code pill */}
              <div style={{
                display: "inline-block",
                border: "1px solid #2e2e2e",
                padding: "10px 32px",
                marginBottom: 20,
                background: "#111",
              }}>
                <span style={{
                  fontFamily: "monospace",
                  fontSize: 26,
                  letterSpacing: "0.35em",
                  color: "#ede8e0",
                  textTransform: "uppercase",
                }}>
                  {code.code}
                </span>
              </div>

              {/* Fine print */}
              <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                {code.minOrderAmount ? (
                  <span style={{ fontFamily: "monospace", fontSize: 7, color: "#383838", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    Min. order {code.minOrderAmount} €
                  </span>
                ) : (
                  <span style={{ fontFamily: "monospace", fontSize: 7, color: "#383838", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    Limited offer
                  </span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              background: "#ede8e0",
              padding: "10px 28px",
              textAlign: "center",
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 7, letterSpacing: "0.35em", color: "#999", textTransform: "uppercase" }}>
                notteshe.com
              </span>
            </div>

          </div>{/* end inner border */}
        </div>{/* end card */}

        {/* Share options */}
        <div className="mt-4 w-full grid grid-cols-2 gap-2">
          <button
            onClick={() => handleShare("instagram-post")}
            className="flex items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            IG Post
          </button>
          <button
            onClick={() => handleShare("instagram-story")}
            className="flex items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            IG Story
          </button>
          <button
            onClick={() => handleShare("whatsapp")}
            className="flex items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-white/20 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            WhatsApp
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            <Download size={13} />
            {downloading ? "…" : "Download"}
          </button>
        </div>

        {/* Copy code */}
        <button
          onClick={handleCopy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-white/10 bg-white/5 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-white/50 transition-colors hover:text-white/80"
        >
          <Copy size={12} />
          {copying ? "Copied!" : `Copy code: ${code.code}`}
        </button>
      </div>
      </div>{/* end scrollable body */}
    </div>
  );
}

function Discounts() {
  const loaderData = Route.useLoaderData();
  const [codes, setCodes] = useState<DiscountCode[]>(loaderData);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [sharingCode, setSharingCode] = useState<DiscountCode | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) return;
    setCreating(true);
    try {
      const result = await createDiscount({
        data: {
          code: form.code,
          type: form.type,
          value: parseFloat(form.value) || 0,
          minOrderAmount: form.minOrderAmount
            ? parseFloat(form.minOrderAmount)
            : undefined,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
          expiresAt: form.expiresAt || undefined,
        },
      });
      const now = new Date();
      const newCode: DiscountCode = {
        id: result.id,
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: parseFloat(form.value) || 0,
        minOrderAmount: form.minOrderAmount
          ? parseFloat(form.minOrderAmount)
          : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        usedCount: 0,
        isActive: true,
        expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
        createdAt: now,
      };
      setCodes((prev) => [newCode, ...prev]);
      setForm(EMPTY_FORM);
      toast.success("Discount code created");
    } catch {
      toast.error("Failed to create code");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleDiscount({ data: { id, active: !current } });
      setCodes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive: !current } : c))
      );
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this discount code?")) return;
    try {
      await deleteDiscount({ data: { id } });
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  const inputClass =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]";
  const labelClass =
    "block mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]";

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Discount Codes
      </h1>

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5"
      >
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          New Code
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass}>Code *</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
              }
              className={inputClass}
              placeholder="SUMMER20"
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as "PERCENT" | "FIXED",
                }))
              }
              className={inputClass}
            >
              <option value="PERCENT">Percent (%)</option>
              <option value="FIXED">Fixed (€)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>
              Value ({form.type === "PERCENT" ? "%" : "L"}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Min order (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.minOrderAmount}
              onChange={(e) =>
                setForm((f) => ({ ...f, minOrderAmount: e.target.value }))
              }
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className={labelClass}>Max uses</label>
            <input
              type="number"
              min="1"
              value={form.maxUses}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxUses: e.target.value }))
              }
              className={inputClass}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <label className={labelClass}>Expires at</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, expiresAt: e.target.value }))
              }
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-[var(--color-clay)] px-5 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Code"}
          </button>
        </div>
      </form>

      {/* Codes table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Code", "Type", "Value", "Uses", "Active", "Expires", "", ""].map(
                (h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {codes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]"
                >
                  No codes yet
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3 font-mono text-sm font-medium text-[var(--color-foreground)]">
                  {c.code}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    {c.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                  {c.type === "PERCENT"
                    ? `${c.value}%`
                    : `${c.value.toFixed(2)} €`}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {c.usedCount}
                  {c.maxUses != null && ` / ${c.maxUses}`}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(c.id, c.isActive)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${c.isActive ? "bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400" : "bg-red-500/20 text-red-400 hover:bg-green-500/20 hover:text-green-400"}`}
                  >
                    {c.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {c.expiresAt
                    ? new Date(c.expiresAt).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSharingCode(c)}
                    className="text-[var(--color-muted-foreground)] transition-colors hover:text-white"
                    aria-label="Share code"
                  >
                    <Share2 size={14} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-[var(--color-muted-foreground)] transition-colors hover:text-red-400"
                    aria-label="Delete code"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sharingCode && (
        <CouponShareModal code={sharingCode} onClose={() => setSharingCode(null)} />
      )}
    </div>
  );
}
