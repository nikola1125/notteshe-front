import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BackButton } from "@/components/admin/BackButton";
import { createServerFn } from "@tanstack/react-start";
import { eq, desc, count } from "drizzle-orm";
import { toast } from "sonner";
import { db } from "@/db";
import { product, productImage, category } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { Plus, Eye, EyeOff, Pencil, Trash2, ChevronDown } from "lucide-react";
import { useState } from "react";

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  categoryName: string | null;
  price: number;
  originalPrice: number | null;
  isNew: boolean;
  isSale: boolean;
  isVisible: boolean;
  inStock: boolean;
  coverUrl: string | null;
}

interface ProductsData {
  products: ProductRow[];
  total: number;
  page: number;
}

const PAGE_SIZE = 40;

const getProducts = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const page = Number((input as Record<string, string>)?.page ?? 1);
    return { page: isNaN(page) ? 1 : page };
  })
  .handler(async ({ data }): Promise<ProductsData> => {
    await requireAdmin();
    const offset = (data.page - 1) * PAGE_SIZE;
    const database = db();

    const [rows, totalResult] = await Promise.all([
      database
        .select({
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryName: category.name,
          price: product.price,
          originalPrice: product.originalPrice,
          isNew: product.isNew,
          isSale: product.isSale,
          isVisible: product.isVisible,
          inStock: product.inStock,
        })
        .from(product)
        .leftJoin(category, eq(product.categoryId, category.id))
        .orderBy(desc(product.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      database.select({ count: count() }).from(product),
    ]);

    const productIds = rows.map((r) => r.id);
    const covers = productIds.length > 0
      ? await database
          .select({ productId: productImage.productId, url: productImage.url })
          .from(productImage)
          .where(eq(productImage.isCover, true))
      : [];
    const coverMap = new Map(covers.map((c) => [c.productId, c.url]));

    return {
      products: rows.map((r) => ({
        ...r,
        price: Number(r.price),
        originalPrice: r.originalPrice != null ? Number(r.originalPrice) : null,
        coverUrl: coverMap.get(r.id) ?? null,
      })),
      total: Number(totalResult[0]?.count ?? 0),
      page: data.page,
    };
  });

const toggleVisibility = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string; visible: boolean })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db().update(product).set({ isVisible: data.visible, updatedAt: new Date() }).where(eq(product.id, data.id));
    await logAudit(admin.id, "product.toggle_visibility", "product", data.id, { after: { isVisible: data.visible } });
    return { success: true };
  });

const deleteProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    // Fetch all images to delete from Cloudinary
    const images = await database
      .select({ cloudflareId: productImage.cloudflareId })
      .from(productImage)
      .where(eq(productImage.productId, data.id));

    // Delete from Cloudinary
    if (images.length > 0) {
      const { deleteFromCloudinary } = await import("@/lib/cloudinary.server");
      await Promise.allSettled(images.map((img) => deleteFromCloudinary(img.cloudflareId)));
    }

    // Delete product (cascade handles images, sizes, colours, wishlist)
    await database.delete(product).where(eq(product.id, data.id));
    await logAudit(admin.id, "product.delete", "product", data.id);
    return { success: true };
  });

export const Route = createFileRoute("/admin/products/")({
  loaderDeps: ({ search }) => ({ page: Number((search as Record<string, string>).page ?? 1) }),
  loader: ({ deps }) => getProducts({ data: { page: deps.page } }),
  staleTime: 0,
  component: ProductList,
});

function ProductCard({
  p,
  onToggle,
  onDelete,
}: {
  p: ProductRow;
  onToggle: (id: string, current: boolean) => Promise<void>;
  onDelete: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] overflow-hidden">
      {/* Image */}
      <div className="relative aspect-[3/4] bg-[var(--color-muted)] overflow-hidden">
        {p.coverUrl ? (
          <img src={p.coverUrl} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/40">No image</span>
          </div>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {p.isNew && (
            <span className="rounded bg-blue-500/80 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">New</span>
          )}
          {p.isSale && (
            <span className="rounded bg-[var(--color-clay)]/80 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">Sale</span>
          )}
          {!p.isVisible && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/70">Hidden</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{p.name}</p>
        <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-foreground)]">
          {p.price.toFixed(2)} L
          {p.originalPrice != null && (
            <span className="ml-1 line-through opacity-50">{p.originalPrice.toFixed(2)}</span>
          )}
        </p>

        {/* Actions row */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/products/$id"
              params={{ id: p.id }}
              className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-foreground)] active:opacity-60"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </Link>
            <button
              onClick={() => void onToggle(p.id, p.isVisible)}
              className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-foreground)] active:opacity-60"
              aria-label={p.isVisible ? "Hide" : "Show"}
            >
              {p.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              onClick={() => onDelete(p.id, p.name)}
              className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400 active:opacity-60"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {/* Expand toggle (mobile helper) */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] active:opacity-60"
            aria-label="Details"
          >
            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3">
            <div className="flex justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Slug</span>
              <span className="font-mono text-[9px] text-[var(--color-foreground)]">{p.slug}</span>
            </div>
            {p.categoryName && (
              <div className="flex justify-between">
                <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Category</span>
                <span className="font-mono text-[9px] text-[var(--color-foreground)]">{p.categoryName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Stock</span>
              <span className={`font-mono text-[9px] ${p.inStock ? "text-green-400" : "text-red-400"}`}>
                {p.inStock ? "In stock" : "Out"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductList() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();
  const [data, setData] = useState(loaderData);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleVisibility({ data: { id, visible: !current } });
      setData((prev) => ({
        ...prev,
        products: prev.products.map((p) => p.id === id ? { ...p, isVisible: !current } : p),
      }));
    } catch {
      toast.error("Failed to update visibility");
    }
  }

  function requestDelete(id: string, name: string) {
    setConfirm({ id, name });
  }

  async function handleDelete() {
    if (!confirm) return;
    setDeleting(confirm.id);
    setConfirm(null);
    try {
      await deleteProduct({ data: { id: confirm.id } });
      setData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== confirm.id),
        total: prev.total - 1,
      }));
      toast.success("Product deleted");
      await router.invalidate();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">
          Products
          <span className="ml-3 font-mono text-sm not-italic text-[var(--color-muted-foreground)]">
            ({data.total})
          </span>
        </h1>
        <Link
          to="/admin/products/new"
          className="flex items-center gap-2 rounded bg-[var(--color-clay)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 active:opacity-60"
        >
          <Plus size={14} />
          Add
        </Link>
      </div>

      {data.products.length === 0 ? (
        <p className="py-16 text-center font-mono text-xs text-[var(--color-muted-foreground)]">No products yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.products.map((p) => (
            <div key={p.id} className={deleting === p.id ? "pointer-events-none opacity-40" : ""}>
              <ProductCard p={p} onToggle={handleToggle} onDelete={requestDelete} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              to="/admin/products"
              search={{ page: String(page) }}
              className={`h-8 w-8 rounded font-mono text-xs transition-colors ${data.page === page ? "bg-[var(--color-clay)] text-white" : "bg-[var(--color-paper)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
            >
              <span className="flex h-full w-full items-center justify-center">{page}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6 shadow-xl">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Delete product</p>
            <p className="mb-6 text-sm text-[var(--color-foreground)]">
              Delete <strong>{confirm.name}</strong>? This will remove all images from Cloudinary and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="rounded border border-[var(--color-border)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] active:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                className="rounded bg-red-500 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 active:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
