import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, count, inArray } from "drizzle-orm";
import { toast } from "sonner";
import { db } from "@/db";
import { collection, product, homeCollections } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { cldImg } from "@/lib/cldImage";
import { Plus, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
  productCount: number;
}

interface HomeSlots {
  slot1: string;
  slot2: string;
  slot3: string;
}

interface CollectionsData {
  collections: CollectionRow[];
  home: HomeSlots;
}

const getCollectionsData = createServerFn({ method: "GET" }).handler(
  async (): Promise<CollectionsData> => {
    await requireAdmin();
    const database = db();

    const [rows, counts, homeRows] = await Promise.all([
      database.select().from(collection).orderBy(collection.sortOrder, collection.name),
      database
        .select({ collectionId: product.collectionId, c: count() })
        .from(product)
        .groupBy(product.collectionId),
      database.select().from(homeCollections).where(eq(homeCollections.id, "default")).limit(1),
    ]);

    const countMap = new Map<string, number>();
    for (const r of counts) {
      if (r.collectionId) countMap.set(r.collectionId, Number(r.c));
    }

    let home = homeRows[0];
    if (!home) {
      await database.insert(homeCollections).values({ id: "default" }).onConflictDoNothing();
      home = { id: "default", slot1CollectionId: null, slot2CollectionId: null, slot3CollectionId: null, updatedAt: new Date() };
    }

    return {
      collections: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        coverImageUrl: c.coverImageUrl,
        isVisible: c.isVisible,
        sortOrder: c.sortOrder,
        productCount: countMap.get(c.id) ?? 0,
      })),
      home: {
        slot1: home.slot1CollectionId ?? "",
        slot2: home.slot2CollectionId ?? "",
        slot3: home.slot3CollectionId ?? "",
      },
    };
  }
);

const toggleVisibility = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string; visible: boolean })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db().update(collection).set({ isVisible: data.visible }).where(eq(collection.id, data.id));
    await logAudit(admin.id, "collection.toggle_visibility", "collection", data.id, { after: { isVisible: data.visible } });
    return { success: true };
  });

const deleteCollection = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    const rows = await database
      .select({ coverCloudflareId: collection.coverCloudflareId })
      .from(collection)
      .where(eq(collection.id, data.id))
      .limit(1);

    const cloudId = rows[0]?.coverCloudflareId;
    if (cloudId) {
      const { deleteFromCloudinary } = await import("@/lib/cloudinary.server");
      await deleteFromCloudinary(cloudId).catch(() => {});
    }

    // FK ON DELETE SET NULL detaches products and clears any homepage slot.
    await database.delete(collection).where(eq(collection.id, data.id));
    await logAudit(admin.id, "collection.delete", "collection", data.id);
    return { success: true };
  });

const saveHomeSlots = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as HomeSlots)
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    const chosen = [data.slot1, data.slot2, data.slot3].filter(Boolean);
    if (chosen.length > 0) {
      const found = await database
        .select({ id: collection.id, coverImageUrl: collection.coverImageUrl, name: collection.name })
        .from(collection)
        .where(inArray(collection.id, chosen));
      const byId = new Map(found.map((c) => [c.id, c]));
      for (const id of chosen) {
        const c = byId.get(id);
        if (!c) throw new Error("A selected collection no longer exists.");
        if (!c.coverImageUrl) throw new Error(`"${c.name}" needs a cover image before it can go on the homepage.`);
      }
    }

    await database
      .update(homeCollections)
      .set({
        slot1CollectionId: data.slot1 || null,
        slot2CollectionId: data.slot2 || null,
        slot3CollectionId: data.slot3 || null,
        updatedAt: new Date(),
      })
      .where(eq(homeCollections.id, "default"));

    await logAudit(admin.id, "collection.home_slots", "home_collections", "default", { after: data });
    return { success: true };
  });

export const Route = createFileRoute("/admin/collections/")({
  loader: () => getCollectionsData(),
  staleTime: 0,
  component: CollectionsList,
});

const SLOT_LABELS = ["Slot 1 — large (left)", "Slot 2 — top right", "Slot 3 — bottom right"] as const;

function CollectionsList() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();
  const [collections, setCollections] = useState(loaderData.collections);
  const [slots, setSlots] = useState(loaderData.home);
  const [savingSlots, setSavingSlots] = useState(false);
  const [confirm, setConfirm] = useState<CollectionRow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const slotValues = [slots.slot1, slots.slot2, slots.slot3];

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleVisibility({ data: { id, visible: !current } });
      setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, isVisible: !current } : c)));
    } catch {
      toast.error("Failed to update visibility");
    }
  }

  async function handleDelete() {
    if (!confirm) return;
    const target = confirm;
    setDeleting(target.id);
    setConfirm(null);
    try {
      await deleteCollection({ data: { id: target.id } });
      setCollections((prev) => prev.filter((c) => c.id !== target.id));
      // Clear any slot that referenced the deleted collection
      setSlots((prev) => ({
        slot1: prev.slot1 === target.id ? "" : prev.slot1,
        slot2: prev.slot2 === target.id ? "" : prev.slot2,
        slot3: prev.slot3 === target.id ? "" : prev.slot3,
      }));
      toast.success("Collection deleted");
      await router.invalidate();
    } catch {
      toast.error("Failed to delete collection");
    } finally {
      setDeleting(null);
    }
  }

  function setSlot(index: 0 | 1 | 2, value: string) {
    setSlots((prev) => ({ ...prev, [`slot${index + 1}`]: value }));
  }

  async function handleSaveSlots() {
    setSavingSlots(true);
    try {
      await saveHomeSlots({ data: slots });
      toast.success("Homepage collections saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSlots(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">
          Collections
          <span className="ml-3 font-mono text-sm not-italic text-[var(--color-muted-foreground)]">
            ({collections.length})
          </span>
        </h1>
        <Link
          to="/admin/collections/new"
          className="flex items-center gap-2 rounded bg-[var(--color-clay)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 active:opacity-60"
        >
          <Plus size={14} />
          Add
        </Link>
      </div>

      {/* Homepage slot picker */}
      <div className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Homepage composition
        </p>
        <p className="mb-4 font-mono text-[10px] text-[var(--color-muted-foreground)]">
          Choose which collections appear in the "Stillness, in motion." section. Each needs a cover image.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {([0, 1, 2] as const).map((i) => {
            const val = slotValues[i];
            const chosen = val ? collectionById.get(val) : null;
            return (
              <div key={i}>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                  {SLOT_LABELS[i]}
                </label>
                <div className="mb-2 aspect-[3/4] w-full max-w-[140px] overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-muted)]">
                  {chosen?.coverImageUrl ? (
                    <img src={cldImg(chosen.coverImageUrl, 320)} alt={chosen.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/40">
                        Empty
                      </span>
                    </div>
                  )}
                </div>
                <select
                  value={val}
                  onChange={(e) => setSlot(i, e.target.value)}
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
                >
                  <option value="">— Empty —</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.coverImageUrl}>
                      {c.name}{!c.coverImageUrl ? " (no cover)" : ""}{!c.isVisible ? " (hidden)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => void handleSaveSlots()}
            disabled={savingSlots}
            className="rounded bg-[var(--color-clay)] px-5 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {savingSlots ? "Saving…" : "Save homepage"}
          </button>
        </div>
      </div>

      {/* Collections list */}
      {collections.length === 0 ? (
        <p className="py-16 text-center font-mono text-xs text-[var(--color-muted-foreground)]">No collections yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {collections.map((c) => (
            <div
              key={c.id}
              className={`overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] ${deleting === c.id ? "pointer-events-none opacity-40" : ""}`}
            >
              <Link
                to="/admin/collections/$id"
                params={{ id: c.id }}
                className="block relative aspect-[3/4] overflow-hidden bg-[var(--color-muted)]"
              >
                {c.coverImageUrl ? (
                  <img src={cldImg(c.coverImageUrl, 400)} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/40">No cover</span>
                  </div>
                )}
                {!c.isVisible && (
                  <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/70">Hidden</span>
                )}
              </Link>
              <div className="p-3">
                <Link
                  to="/admin/collections/$id"
                  params={{ id: c.id }}
                  className="block truncate text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-clay)]"
                >
                  {c.name}
                </Link>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                  {c.productCount} {c.productCount === 1 ? "product" : "products"}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    to="/admin/collections/$id"
                    params={{ id: c.id }}
                    className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-foreground)] active:opacity-60"
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </Link>
                  <button
                    onClick={() => void handleToggle(c.id, c.isVisible)}
                    className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-foreground)] active:opacity-60"
                    aria-label={c.isVisible ? "Hide" : "Show"}
                  >
                    {c.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => setConfirm(c)}
                    className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400 active:opacity-60"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6 shadow-xl">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Delete collection</p>
            <p className="mb-6 text-sm text-[var(--color-foreground)]">
              Delete <strong>{confirm.name}</strong>?{" "}
              {confirm.productCount > 0
                ? `${confirm.productCount} ${confirm.productCount === 1 ? "product" : "products"} will be detached (not deleted).`
                : "This cannot be undone."}
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
