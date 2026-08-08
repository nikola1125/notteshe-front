import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/db";
import { product, productSize, productImage } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SizeRow {
  id: string;
  label: string;
  stock: number;
  available: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  coverImageUrl: string | null;
  inStock: boolean;
  sizes: SizeRow[];
  totalStock: number;
}

// ─── Server functions ─────────────────────────────────────────────────────────

const getInventory = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  let products: Array<{ id: string; name: string; inStock: boolean }> = [];
  let coverImages: Array<{ productId: string; url: string }> = [];
  try {
    [products, coverImages] = await Promise.all([
      db()
        .select({ id: product.id, name: product.name, inStock: product.inStock })
        .from(product)
        .orderBy(product.name),
      db()
        .select({ productId: productImage.productId, url: productImage.url })
        .from(productImage)
        .where(eq(productImage.isCover, true)),
    ]);
  } catch (err) {
    console.error("inventory: failed to query products", err);
  }

  const coverMap = new Map(coverImages.map((img) => [img.productId, img.url]));

  // Query sizes — stock/available columns may not exist yet if migration hasn't run
  let sizes: Array<{ id: string; productId: string; label: string; stock: number; available: boolean }> = [];
  try {
    const rows = await db()
      .select({
        id: productSize.id,
        productId: productSize.productId,
        label: productSize.label,
        stock: productSize.stock,
        available: productSize.available,
      })
      .from(productSize);
    sizes = rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      label: r.label,
      stock: Number(r.stock ?? 0),
      available: Boolean(r.available ?? true),
    }));
  } catch (err) {
    console.error("inventory: failed to query product_size", err);
  }

  const sizesByProduct = new Map<string, SizeRow[]>();
  for (const s of sizes) {
    if (!sizesByProduct.has(s.productId)) sizesByProduct.set(s.productId, []);
    sizesByProduct.get(s.productId)!.push({ id: s.id, label: s.label, stock: s.stock, available: s.available });
  }

  return products.map((p) => {
    const sz = sizesByProduct.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      coverImageUrl: coverMap.get(p.id) ?? null,
      inStock: Boolean(p.inStock),
      sizes: sz,
      totalStock: sz.reduce((sum, s) => sum + s.stock, 0),
    };
  });
});

const updateSizeStock = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ sizeId: z.string(), stock: z.number(), available: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(productSize)
      .set({ stock: data.stock, available: data.available })
      .where(eq(productSize.id, data.sizeId));
    await logAudit(admin.id, "inventory.update", "product_size", data.sizeId, { after: data });
    return { success: true };
  });

const updateProductStock = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ productId: z.string(), inStock: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(product)
      .set({ inStock: data.inStock })
      .where(eq(product.id, data.productId));
    await logAudit(admin.id, "inventory.update", "product", data.productId, { after: data });
    return { success: true };
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/inventory")({
  loader: () => getInventory(),
  component: InventoryPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function InventoryPage() {
  const initial = Route.useLoaderData() ?? [];
  const [rows, setRows] = useState<ProductRow[]>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  async function handleStockChange(sizeId: string, productId: string, value: string) {
    const stock = Math.max(0, parseInt(value) || 0);
    setRows((prev) =>
      prev.map((p) =>
        p.id !== productId ? p : {
          ...p,
          sizes: p.sizes.map((s) => s.id === sizeId ? { ...s, stock } : s),
          totalStock: p.sizes.reduce((sum, s) => sum + (s.id === sizeId ? stock : s.stock), 0),
        }
      )
    );
  }

  async function handleSaveSize(sizeId: string, productId: string) {
    const row = rows.find((p) => p.id === productId);
    const size = row?.sizes.find((s) => s.id === sizeId);
    if (!size) return;
    setSaving(sizeId);
    try {
      await updateSizeStock({ data: { sizeId, stock: size.stock, available: size.available } });
      toast.success("Stock updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleAvailable(sizeId: string, productId: string) {
    setRows((prev) =>
      prev.map((p) =>
        p.id !== productId ? p : {
          ...p,
          sizes: p.sizes.map((s) => s.id === sizeId ? { ...s, available: !s.available } : s),
        }
      )
    );
    const row = rows.find((p) => p.id === productId);
    const size = row?.sizes.find((s) => s.id === sizeId);
    if (!size) return;
    try {
      await updateSizeStock({ data: { sizeId, stock: size.stock, available: !size.available } });
    } catch {
      toast.error("Failed to update availability");
    }
  }

  async function handleToggleInStock(productId: string) {
    const row = rows.find((p) => p.id === productId);
    if (!row) return;
    const next = !row.inStock;
    setRows((prev) => prev.map((p) => p.id !== productId ? p : { ...p, inStock: next }));
    try {
      await updateProductStock({ data: { productId, inStock: next } });
      toast.success(next ? "Marked in stock" : "Marked out of stock");
    } catch {
      toast.error("Failed to update");
    }
  }

  const inputClass = "w-16 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-center font-mono text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">Inventory</h1>
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 font-mono text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)] placeholder:text-[var(--color-muted-foreground)]"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((p) => {
          const isOpen = expanded.has(p.id);
          return (
            <div key={p.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)]">
              {/* Product header — click anywhere to expand */}
              <button
                onClick={() => toggleExpand(p.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {p.coverImageUrl ? (
                  <img src={p.coverImageUrl} alt={p.name} className="h-10 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-8 shrink-0 rounded bg-[var(--color-border)]" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-mono text-[11px] text-[var(--color-foreground)]">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{p.totalStock} total</span>
                    {p.totalStock === 0 && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-red-400">No stock</span>
                    )}
                    {p.totalStock > 0 && p.totalStock <= 5 && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">Low</span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-[var(--color-muted-foreground)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t border-[var(--color-border)]">
                  {/* In-stock toggle */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">Overall in stock</span>
                    <div
                      role="checkbox"
                      aria-checked={p.inStock}
                      tabIndex={0}
                      onClick={() => handleToggleInStock(p.id)}
                      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") handleToggleInStock(p.id); }}
                      className={`h-5 w-9 cursor-pointer rounded-full transition-colors ${p.inStock ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
                    >
                      <div className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${p.inStock ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                  </div>

                  {/* Sizes */}
                  {p.sizes.length === 0 ? (
                    <p className="px-4 pb-3 font-mono text-[10px] text-[var(--color-muted-foreground)]">No sizes defined</p>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)]">
                      {p.sizes.map((s) => (
                        <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                          <span className="w-12 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                            {s.label}
                          </span>
                          <div
                            role="checkbox"
                            aria-checked={s.available}
                            tabIndex={0}
                            onClick={() => handleToggleAvailable(s.id, p.id)}
                            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") handleToggleAvailable(s.id, p.id); }}
                            className={`h-4 w-8 cursor-pointer rounded-full transition-colors ${s.available ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
                          >
                            <div className={`mt-0.5 ml-0.5 h-3 w-3 rounded-full bg-white transition-transform ${s.available ? "translate-x-4" : "translate-x-0"}`} />
                          </div>
                          <span className="font-mono text-[9px] text-[var(--color-muted-foreground)]">
                            {s.available ? "Available" : "Unavailable"}
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">Qty</span>
                            <input
                              type="number"
                              min="0"
                              value={s.stock}
                              onChange={(e) => handleStockChange(s.id, p.id, e.target.value)}
                              onBlur={() => handleSaveSize(s.id, p.id)}
                              className={inputClass}
                            />
                            <button
                              onClick={() => handleSaveSize(s.id, p.id)}
                              disabled={saving === s.id}
                              className="rounded bg-[var(--color-clay)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                            >
                              {saving === s.id ? "…" : "Save"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="py-12 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            No products found
          </p>
        )}
      </div>
    </div>
  );
}
