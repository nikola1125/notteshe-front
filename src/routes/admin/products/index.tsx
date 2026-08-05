import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq, desc, count, sql } from "drizzle-orm";
import { toast } from "sonner";
import { db } from "@/db";
import { product, productImage, category } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { Plus, Eye, EyeOff, Pencil } from "lucide-react";
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

const PAGE_SIZE = 20;

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

    // Fetch cover images
    const productIds = rows.map((r) => r.id);
    const covers =
      productIds.length > 0
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
  .validator((input: unknown) => {
    const d = input as { id: string; visible: boolean };
    return { id: d.id, visible: d.visible };
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(product)
      .set({ isVisible: data.visible, updatedAt: new Date() })
      .where(eq(product.id, data.id));
    await logAudit(admin.id, "product.toggle_visibility", "product", data.id, {
      after: { isVisible: data.visible },
    });
    return { success: true };
  });

export const Route = createFileRoute("/admin/products/")({
  loaderDeps: ({ search }) => ({ page: Number((search as Record<string, string>).page ?? 1) }),
  loader: ({ deps }) => getProducts({ data: { page: deps.page } }),
  staleTime: 30_000,
  component: ProductList,
});

function ProductList() {
  const loaderData = Route.useLoaderData();
  const [data, setData] = useState(loaderData);
  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleVisibility({ data: { id, visible: !current } });
      setData((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === id ? { ...p, isVisible: !current } : p
        ),
      }));
    } catch {
      toast.error("Failed to update visibility");
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">
          Products
          <span className="ml-3 font-mono text-sm not-italic text-[var(--color-muted-foreground)]">
            ({data.total})
          </span>
        </h1>
        <Link
          to="/admin/products/new"
          className="flex items-center gap-2 rounded bg-[var(--color-clay)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80"
        >
          <Plus size={14} />
          Add product
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Image", "Name", "Category", "Price", "Flags", "Stock", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {data.products.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]"
                >
                  No products yet
                </td>
              </tr>
            )}
            {data.products.map((p) => (
              <tr key={p.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3">
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt={p.name}
                      className="h-10 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-8 rounded bg-[var(--color-muted)]" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-[var(--color-foreground)]">
                    {p.name}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                    {p.slug}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
                  {p.categoryName ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                  {p.price.toFixed(2)} L
                  {p.originalPrice != null && (
                    <span className="ml-1 text-[var(--color-muted-foreground)] line-through">
                      {p.originalPrice.toFixed(2)} L
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {p.isNew && (
                      <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-blue-400">
                        New
                      </span>
                    )}
                    {p.isSale && (
                      <span className="rounded bg-[var(--color-clay)]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-clay)]">
                        Sale
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${p.inStock ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {p.inStock ? "In stock" : "Out"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      to="/admin/products/$id"
                      params={{ id: p.id }}
                      className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
                      aria-label="Edit product"
                    >
                      <Pencil size={14} />
                    </Link>
                    <button
                      onClick={() => handleToggle(p.id, p.isVisible)}
                      className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
                      aria-label={p.isVisible ? "Hide product" : "Show product"}
                    >
                      {p.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              to="/admin/products"
              search={{ page: String(page) }}
              className={`h-8 w-8 rounded font-mono text-xs transition-colors ${data.page === page ? "bg-[var(--color-clay)] text-white" : "bg-[var(--color-paper)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
            >
              <span className="flex h-full w-full items-center justify-center">
                {page}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
