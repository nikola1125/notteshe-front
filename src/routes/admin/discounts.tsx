import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { eq, desc } from "drizzle-orm";
import { toast } from "sonner";
import { useState } from "react";
import { Trash2 } from "lucide-react";
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

function Discounts() {
  const loaderData = Route.useLoaderData();
  const [codes, setCodes] = useState<DiscountCode[]>(loaderData);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

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
              Value ({form.type === "PERCENT" ? "%" : "€"}) *
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
              {["Code", "Type", "Value", "Uses", "Active", "Expires", ""].map(
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
                    : `€${c.value.toFixed(2)}`}
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
    </div>
  );
}
