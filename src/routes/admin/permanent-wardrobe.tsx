import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Search } from "lucide-react";
import { db } from "@/db";
import { product, productImage } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { cldImg } from "@/lib/cldImage";

// ─── Server functions ─────────────────────────────────────────────────────────

const getWardrobeData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  let all: Array<{
    id: string;
    name: string;
    slug: string;
    coverImageUrl: string | null;
    isNew: boolean;
    isSale: boolean;
    inStock: boolean;
    isVisible: boolean;
    isPermanentWardrobe: boolean;
  }> = [];

  try {
    const [rows, covers] = await Promise.all([
      db()
        .select({
          id: product.id,
          name: product.name,
          slug: product.slug,
          isNew: product.isNew,
          isSale: product.isSale,
          inStock: product.inStock,
          isVisible: product.isVisible,
          isPermanentWardrobe: product.isPermanentWardrobe,
        })
        .from(product)
        .orderBy(desc(product.createdAt)),
      db()
        .select({ productId: productImage.productId, url: productImage.url })
        .from(productImage)
        .where(eq(productImage.isCover, true)),
    ]);
    const coverMap = new Map(covers.map((c) => [c.productId, c.url]));
    all = rows.map((r) => ({ ...r, coverImageUrl: coverMap.get(r.id) ?? null }));
  } catch (err) {
    console.error("wardrobe: failed to query products", err);
  }

  const wardrobe = all
    .filter((p) => p.isPermanentWardrobe)
    .sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));

  const available = all.filter((p) => !p.isPermanentWardrobe && p.isVisible !== false);

  return { wardrobe, available };
});

const toggleWardrobe = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ productId: z.string(), include: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(product)
      .set({ isPermanentWardrobe: data.include })
      .where(eq(product.id, data.productId));
    await logAudit(admin.id, "wardrobe.update", "product", data.productId, { after: data });
    return { success: true };
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/permanent-wardrobe")({
  loader: () => getWardrobeData(),
  staleTime: 30_000,
  component: PermanentWardrobePage,
});

// ─── Component ────────────────────────────────────────────────────────────────

type ProductItem = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  isNew: boolean;
  isSale: boolean;
  inStock: boolean;
  isVisible: boolean;
  isPermanentWardrobe: boolean;
};

function PermanentWardrobePage() {
  const data = Route.useLoaderData();
  const [wardrobe, setWardrobe] = useState<ProductItem[]>(data?.wardrobe ?? []);
  const [available, setAvailable] = useState<ProductItem[]>(data?.available ?? []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const filteredAvailable = search.trim()
    ? available.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  async function handleAdd(p: ProductItem) {
    setSaving(p.id);
    try {
      await toggleWardrobe({ data: { productId: p.id, include: true } });
      const updated = { ...p, isPermanentWardrobe: true };
      setAvailable((prev) => prev.filter((x) => x.id !== p.id));
      setWardrobe((prev) => {
        const next = [...prev, updated];
        return next.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
      });
      toast.success(`${p.name} added`);
    } catch {
      toast.error("Failed to add");
    } finally {
      setSaving(null);
    }
  }

  async function handleRemove(p: ProductItem) {
    setSaving(p.id);
    try {
      await toggleWardrobe({ data: { productId: p.id, include: false } });
      setWardrobe((prev) => prev.filter((x) => x.id !== p.id));
      setAvailable((prev) => [...prev, { ...p, isPermanentWardrobe: false }]);
      toast.success(`${p.name} removed`);
    } catch {
      toast.error("Failed to remove");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">Permanent Wardrobe</h1>
          <p className="mt-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
            New arrivals rank first automatically
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="flex items-center gap-2 rounded bg-[var(--color-clay)] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-opacity hover:opacity-80"
        >
          <Plus size={12} />
          New product
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">

        {/* ─── Current wardrobe ─── */}
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            In wardrobe ({wardrobe.length})
          </p>
          <div className="space-y-2">
            {wardrobe.length === 0 && (
              <p className="py-8 text-center font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
                No products yet — add from inventory
              </p>
            )}
            {wardrobe.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-2.5"
              >
                {p.coverImageUrl ? (
                  <img src={cldImg(p.coverImageUrl, 80)} alt={p.name} className="h-10 w-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-8 shrink-0 rounded bg-[var(--color-border)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-[var(--color-foreground)]">{p.name}</p>
                  <div className="mt-0.5 flex gap-2">
                    {p.isNew && (
                      <span className="rounded bg-[var(--color-clay)]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-clay)]">
                        New
                      </span>
                    )}
                    {p.isSale && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
                        Sale
                      </span>
                    )}
                    {!p.inStock && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-red-400">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(p)}
                  disabled={saving === p.id}
                  className="shrink-0 rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Add from inventory ─── */}
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Add from inventory
          </p>
          <div className="mb-3 flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
            <Search size={12} className="shrink-0 text-[var(--color-muted-foreground)]" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
            />
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {filteredAvailable.length === 0 && (
              <p className="py-8 text-center font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
                {search ? "No products match" : "All products are in the wardrobe"}
              </p>
            )}
            {filteredAvailable.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-2.5"
              >
                {p.coverImageUrl ? (
                  <img src={cldImg(p.coverImageUrl, 80)} alt={p.name} className="h-10 w-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-8 shrink-0 rounded bg-[var(--color-border)]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-[var(--color-foreground)]">{p.name}</p>
                  <div className="mt-0.5 flex gap-2">
                    {p.isNew && (
                      <span className="rounded bg-[var(--color-clay)]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-clay)]">
                        New
                      </span>
                    )}
                    {p.isSale && (
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
                        Sale
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleAdd(p)}
                  disabled={saving === p.id}
                  className="shrink-0 rounded bg-[var(--color-clay)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {saving === p.id ? "…" : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
