import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq } from "drizzle-orm";
import { toast } from "sonner";
import { db } from "@/db";
import { collection } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { CollectionForm, type CollectionFormData } from "@/components/admin/CollectionForm";

const createCollection = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as CollectionFormData)
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    if (!data.name.trim() || !data.slug.trim()) {
      throw new Error("Name and slug are required.");
    }

    // Guard against duplicate slug (unique constraint would otherwise 500)
    const existing = await database
      .select({ id: collection.id })
      .from(collection)
      .where(eq(collection.slug, data.slug))
      .limit(1);
    if (existing[0]) {
      throw new Error(`Slug "${data.slug}" is already in use.`);
    }

    const id = crypto.randomUUID();
    await database.insert(collection).values({
      id,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      coverImageUrl: data.coverImageUrl,
      coverCloudflareId: data.coverCloudflareId,
      isVisible: data.isVisible,
      sortOrder: data.sortOrder,
      homeCaption: data.homeCaption || null,
      homeCaptionMeta: data.homeCaptionMeta || null,
    });

    await logAudit(admin.id, "collection.create", "collection", id, {
      after: { name: data.name, slug: data.slug },
    });

    return { id };
  });

export const Route = createFileRoute("/admin/collections/new")({
  component: NewCollection,
});

function NewCollection() {
  const router = useRouter();

  async function handleSave(data: CollectionFormData) {
    await createCollection({ data });
    toast.success("Collection created");
    await router.navigate({ to: "/admin/collections" });
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        New Collection
      </h1>
      <CollectionForm onSave={handleSave} />
    </div>
  );
}
