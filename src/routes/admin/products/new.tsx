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
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";

interface FormOptions {
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string }>;
}

const getFormOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<FormOptions> => {
    await requireAdmin();
    const database = db();
    const [cats, cols] = await Promise.all([
      database.select({ id: category.id, name: category.name }).from(category),
      database
        .select({ id: collection.id, name: collection.name })
        .from(collection),
    ]);
    return { categories: cats, collections: cols };
  }
);

const createProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as ProductFormData)
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();
    const id = crypto.randomUUID();

    await database.insert(product).values({
      id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      details: data.details,
      categoryId: data.categoryId || null,
      collectionId: data.collectionId || null,
      price: data.price,
      originalPrice: data.originalPrice ?? null,
      isNew: data.isNew,
      isSale: data.isSale,
      isVisible: data.isVisible,
      inStock: data.inStock,
      isPermanentWardrobe: data.isPermanentWardrobe,
    });

    // Sizes
    if (data.sizes.length > 0) {
      await database.insert(productSize).values(
        data.sizes.map((s) => ({
          id: crypto.randomUUID(),
          productId: id,
          label: s.label,
          available: s.available,
          stock: s.stock,
        }))
      );
    }

    // Colours
    if (data.colours.length > 0) {
      await database.insert(productColour).values(
        data.colours.map((c, i) => ({
          id: crypto.randomUUID(),
          productId: id,
          name: c.name,
          hex: c.hex,
          order: i,
        }))
      );
    }

    // Images
    if (data.images.length > 0) {
      await database.insert(productImage).values(
        data.images.map((img, i) => ({
          id: crypto.randomUUID(),
          productId: id,
          cloudflareId: img.cloudflareId,
          url: img.url,
          order: i,
          isCover: img.isCover,
        }))
      );
    }

    await logAudit(admin.id, "product.create", "product", id, {
      after: { name: data.name, slug: data.slug },
    });

    return { id };
  });

export const Route = createFileRoute("/admin/products/new")({
  loader: () => getFormOptions(),
  component: NewProduct,
});

function NewProduct() {
  const { categories, collections } = Route.useLoaderData();
  const router = useRouter();

  async function handleSave(data: ProductFormData) {
    const result = await createProduct({ data });
    toast.success("Product created");
    await router.navigate({
      to: "/admin/products/$id",
      params: { id: result.id },
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        New Product
      </h1>
      <ProductForm
        categories={categories}
        collections={collections}
        onSave={handleSave}
      />
    </div>
  );
}
