import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, and, ne } from "drizzle-orm";
import { toast } from "sonner";
import { db } from "@/db";
import { collection, product, productImage } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { cldImg } from "@/lib/cldImage";
import { CollectionForm, type CollectionFormData } from "@/components/admin/CollectionForm";

interface CollectionEditData {
  collection: CollectionFormData & { id: string };
  products: Array<{ id: string; name: string; slug: string; coverUrl: string | null }>;
}

const getCollectionEdit = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: (input as { id: string }).id }))
  .handler(async ({ data }): Promise<CollectionEditData> => {
    await requireAdmin();
    const database = db();

    const [rows, prods, covers] = await Promise.all([
      database.select().from(collection).where(eq(collection.id, data.id)).limit(1),
      database
        .select({ id: product.id, name: product.name, slug: product.slug })
        .from(product)
        .where(eq(product.collectionId, data.id))
        .orderBy(product.name),
      database
        .select({ productId: productImage.productId, url: productImage.url })
        .from(productImage)
        .where(eq(productImage.isCover, true)),
    ]);

    if (!rows[0]) throw new Error("Collection not found");
    const c = rows[0];
    const coverMap = new Map(covers.map((cv) => [cv.productId, cv.url]));

    return {
      collection: {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? "",
        coverImageUrl: c.coverImageUrl,
        coverCloudflareId: c.coverCloudflareId,
        isVisible: c.isVisible,
        sortOrder: c.sortOrder,
        homeCaption: c.homeCaption ?? "",
        homeCaptionMeta: c.homeCaptionMeta ?? "",
      },
      products: prods.map((p) => ({ ...p, coverUrl: coverMap.get(p.id) ?? null })),
    };
  });

const updateCollection = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as CollectionFormData & { id: string })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();
    const { id } = data;

    if (!data.name.trim() || !data.slug.trim()) {
      throw new Error("Name and slug are required.");
    }

    const before = await database.select().from(collection).where(eq(collection.id, id)).limit(1);
    if (!before[0]) throw new Error("Collection not found");

    // Guard against slug collision with a different collection
    const clash = await database
      .select({ id: collection.id })
      .from(collection)
      .where(and(eq(collection.slug, data.slug), ne(collection.id, id)))
      .limit(1);
    if (clash[0]) {
      throw new Error(`Slug "${data.slug}" is already in use.`);
    }

    // If the cover changed, delete the old asset from Cloudinary
    const oldCloudId = before[0].coverCloudflareId;
    if (oldCloudId && oldCloudId !== data.coverCloudflareId) {
      const { deleteFromCloudinary } = await import("@/lib/cloudinary.server");
      await deleteFromCloudinary(oldCloudId).catch(() => {});
    }

    await database
      .update(collection)
      .set({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        coverImageUrl: data.coverImageUrl,
        coverCloudflareId: data.coverCloudflareId,
        isVisible: data.isVisible,
        sortOrder: data.sortOrder,
        homeCaption: data.homeCaption || null,
        homeCaptionMeta: data.homeCaptionMeta || null,
      })
      .where(eq(collection.id, id));

    await logAudit(admin.id, "collection.update", "collection", id, {
      before: before[0],
      after: { name: data.name, slug: data.slug },
    });

    return { success: true };
  });

export const Route = createFileRoute("/admin/collections/$id")({
  loader: ({ params }) => getCollectionEdit({ data: { id: params.id } }),
  component: EditCollection,
});

function EditCollection() {
  const { collection: col, products } = Route.useLoaderData();
  const router = useRouter();

  async function handleSave(data: CollectionFormData) {
    await updateCollection({ data: { ...data, id: col.id } });
    toast.success("Collection saved");
    await router.navigate({ to: "/admin/collections" });
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Edit Collection
      </h1>
      <CollectionForm initialData={col} onSave={handleSave} />

      {/* Products in this collection (read-only) */}
      <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Products in this collection ({products.length})
        </p>
        {products.length === 0 ? (
          <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
            No products assigned yet. Assign a product by choosing this collection in the product form.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  to="/admin/products/$id"
                  params={{ id: p.id }}
                  className="group block overflow-hidden rounded-lg border border-[var(--color-border)] transition-colors hover:border-[var(--color-clay)]"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-muted)]">
                    {p.coverUrl ? (
                      <img src={cldImg(p.coverUrl, 320)} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/40">No image</span>
                      </div>
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-xs text-[var(--color-foreground)] transition-colors group-hover:text-[var(--color-clay)]">
                    {p.name}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
