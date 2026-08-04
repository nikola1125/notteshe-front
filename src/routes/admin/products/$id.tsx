import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { eq } from "drizzle-orm";
import { toast } from "sonner";
import { db } from "@/db";
import {
  product,
  productImage,
  productSize,
  productColour,
  category,
  collection,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import {
  ProductForm,
  type ProductFormData,
} from "@/components/admin/ProductForm";

interface ProductEditData {
  product: ProductFormData & { id: string };
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string }>;
}

const getProductEdit = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: (input as { id: string }).id }))
  .handler(async ({ data }): Promise<ProductEditData> => {
    await requireAdmin();
    const database = db();

    const [prod, cats, cols, sizes, colours, images] = await Promise.all([
      database
        .select()
        .from(product)
        .where(eq(product.id, data.id))
        .limit(1),
      database.select({ id: category.id, name: category.name }).from(category),
      database
        .select({ id: collection.id, name: collection.name })
        .from(collection),
      database
        .select()
        .from(productSize)
        .where(eq(productSize.productId, data.id)),
      database
        .select()
        .from(productColour)
        .where(eq(productColour.productId, data.id)),
      database
        .select()
        .from(productImage)
        .where(eq(productImage.productId, data.id))
        .orderBy(productImage.order),
    ]);

    if (!prod[0]) throw new Error("Product not found");
    const p = prod[0];

    return {
      product: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        details: (p.details as string[]) ?? [],
        categoryId: p.categoryId ?? "",
        collectionId: p.collectionId ?? "",
        price: Number(p.price),
        originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
        isNew: p.isNew,
        isSale: p.isSale,
        isVisible: p.isVisible,
        inStock: p.inStock,
        isPermanentWardrobe: p.isPermanentWardrobe,
        sizes: sizes.map((s) => ({
          id: s.id,
          label: s.label,
          available: s.available,
          stock: s.stock,
        })),
        colours: colours.map((c) => ({
          id: c.id,
          name: c.name,
          hex: c.hex,
        })),
        images: images.map((img) => ({
          id: img.id,
          cloudflareId: img.cloudflareId,
          url: img.url,
          isCover: img.isCover,
        })),
      },
      categories: cats,
      collections: cols,
    };
  });

const updateProduct = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) => input as ProductFormData & { id: string }
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();
    const { id, sizes, colours, images, ...fields } = data;

    // Get before snapshot for audit
    const before = await database
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    await database
      .update(product)
      .set({
        name: fields.name,
        slug: fields.slug,
        description: fields.description,
        details: fields.details,
        categoryId: fields.categoryId || null,
        collectionId: fields.collectionId || null,
        price: fields.price,
        originalPrice: fields.originalPrice ?? null,
        isNew: fields.isNew,
        isSale: fields.isSale,
        isVisible: fields.isVisible,
        inStock: fields.inStock,
        isPermanentWardrobe: fields.isPermanentWardrobe,
        updatedAt: new Date(),
      })
      .where(eq(product.id, id));

    // Replace sizes
    await database.delete(productSize).where(eq(productSize.productId, id));
    if (sizes.length > 0) {
      await database.insert(productSize).values(
        sizes.map((s) => ({
          id: s.id || crypto.randomUUID(),
          productId: id,
          label: s.label,
          available: s.available,
          stock: s.stock,
        }))
      );
    }

    // Replace colours
    await database
      .delete(productColour)
      .where(eq(productColour.productId, id));
    if (colours.length > 0) {
      await database.insert(productColour).values(
        colours.map((c, i) => ({
          id: c.id || crypto.randomUUID(),
          productId: id,
          name: c.name,
          hex: c.hex,
          order: i,
        }))
      );
    }

    // Replace images
    await database
      .delete(productImage)
      .where(eq(productImage.productId, id));
    if (images.length > 0) {
      await database.insert(productImage).values(
        images.map((img, i) => ({
          id: img.id || crypto.randomUUID(),
          productId: id,
          cloudflareId: img.cloudflareId,
          url: img.url,
          order: i,
          isCover: img.isCover,
        }))
      );
    }

    await logAudit(admin.id, "product.update", "product", id, {
      before: before[0],
      after: { name: fields.name, slug: fields.slug },
    });

    return { success: true };
  });

export const Route = createFileRoute("/admin/products/$id")({
  loader: ({ params }) => getProductEdit({ data: { id: params.id } }),
  component: EditProduct,
});

function EditProduct() {
  const { product: prod, categories, collections } = Route.useLoaderData();
  const router = useRouter();

  async function handleSave(data: ProductFormData) {
    await updateProduct({ data: { ...data, id: prod.id } });
    toast.success("Product saved");
    await router.invalidate();
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Edit Product
      </h1>
      <ProductForm
        initialData={prod}
        categories={categories}
        collections={collections}
        onSave={handleSave}
      />
    </div>
  );
}
