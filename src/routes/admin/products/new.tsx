import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq } from "drizzle-orm";
import { z } from "zod";
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
import { rateLimit } from "@/lib/rateLimit";
import { ProductForm, type ProductFormData } from "@/components/admin/ProductForm";

const SizeEntrySchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(20),
  available: z.boolean(),
  stock: z.number().int().min(0).max(9999),
});

const ColourEntrySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex colour"),
});

const ImageEntrySchema = z.object({
  id: z.string().optional(),
  cloudflareId: z.string().min(1).max(300),
  url: z.string().min(1).max(600),
  isCover: z.boolean(),
});

const ProductFormSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(3000),
  details: z.array(z.string().max(500)).max(30),
  categoryId: z.string().max(100),
  collectionId: z.string().max(100),
  price: z.number().positive().max(100000),
  originalPrice: z.number().positive().max(100000).nullable(),
  isNew: z.boolean(),
  isSale: z.boolean(),
  isVisible: z.boolean(),
  inStock: z.boolean(),
  isPermanentWardrobe: z.boolean(),
  sizes: z.array(SizeEntrySchema).max(30),
  colours: z.array(ColourEntrySchema).max(30),
  images: z.array(ImageEntrySchema).max(30),
});

interface FormOptions {
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string }>;
}

const getFormOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<FormOptions> => {
    await requireAdmin();
    const database = db();
    const [cats, cols] = await Promise.all([
      database.select({ id: category.id, name: category.name }).from(category).orderBy(category.sortOrder),
      database
        .select({ id: collection.id, name: collection.name })
        .from(collection),
    ]);
    return { categories: cats, collections: cols };
  }
);

const createProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => ProductFormSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!rateLimit(`admin:${admin.id}:mutation`, 30, 60_000)) {
      throw new Error("Too many requests. Please slow down.");
    }
    if (!data.categoryId && !data.collectionId) {
      throw new Error("Select at least a Category or a Collection.");
    }
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
    await createProduct({ data });
    toast.success("Product created");
    await router.navigate({ to: "/admin/products" });
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
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
