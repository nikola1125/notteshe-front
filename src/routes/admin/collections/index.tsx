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
import { ROW_TYPES, rowDef, type HomeRow, type RowType } from "@/lib/homeLayout";
import { Plus, Eye, EyeOff, Pencil, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
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

interface CollectionsData {
  collections: CollectionRow[];
  layout: HomeRow[];
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
      home = { id: "default", slot1CollectionId: null, slot2CollectionId: null, slot3CollectionId: null, layout: null, updatedAt: new Date() };
    }

    // Prefer the flexible layout; migrate legacy slot1/2/3 into one row if empty.
    let layout: HomeRow[] = Array.isArray(home.layout) ? (home.layout as HomeRow[]) : [];
    if (layout.length === 0) {
      const slots = [home.slot1CollectionId ?? null, home.slot2CollectionId ?? null, home.slot3CollectionId ?? null];
      if (slots.some(Boolean)) layout = [{ id: "legacy", type: "three", items: slots }];
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
      layout,
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

const saveHomeLayout = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { rows: HomeRow[] })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    // Validate every referenced collection exists and has a cover image.
    const ids = [...new Set(data.rows.flatMap((r) => r.items).filter((x): x is string => Boolean(x)))];
    if (ids.length > 0) {
      const found = await database
        .select({ id: collection.id, coverImageUrl: collection.coverImageUrl, name: collection.name })
        .from(collection)
        .where(inArray(collection.id, ids));
      const byId = new Map(found.map((c) => [c.id, c]));
      for (const id of ids) {
        const c = byId.get(id);
        if (!c) throw new Error("A selected collection no longer exists.");
        if (!c.coverImageUrl) throw new Error(`"${c.name}" needs a cover image before it can go on the homepage.`);
      }
    }

    // Sanitize: keep only known row types with the correct number of cells.
    const clean = data.rows
      .filter((r) => ROW_TYPES.some((t) => t.type === r.type))
      .map((r) => ({
        id: r.id,
        type: r.type,
        items: Array.from({ length: rowDef(r.type).cells }, (_, i) => r.items[i] ?? null),
      }));

    await database
      .update(homeCollections)
      .set({ layout: clean, updatedAt: new Date() })
      .where(eq(homeCollections.id, "default"));

    await logAudit(admin.id, "collection.home_layout", "home_collections", "default", { after: { rows: clean.length } });
    return { success: true };
  });

export const Route = createFileRoute("/admin/collections/")({
  loader: () => getCollectionsData(),
  staleTime: 0,
  component: CollectionsList,
});

// crypto.randomUUID() only exists in secure contexts (HTTPS / localhost). Over a
// plain http:// LAN IP (e.g. testing on a phone) it's undefined — so fall back.
function rowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch { /* insecure context */ }
  }
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newRow(type: RowType): HomeRow {
  return { id: rowId(), type, items: Array(rowDef(type).cells).fill(null) };
}

// Cell labels for the structured (nested) row types so it's clear which dropdown
// is the wide card and which two are the stacked pair.
function cellLabel(type: RowType, index: number): string | null {
  if (type === "wide-stack") return ["Wide", "Stacked top", "Stacked bottom"][index] ?? null;
  if (type === "stack-wide") return ["Stacked top", "Stacked bottom", "Wide"][index] ?? null;
  return null;
}

function CollectionsList() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();
  const [collections, setCollections] = useState(loaderData.collections);
  const [rows, setRows] = useState<HomeRow[]>(loaderData.layout);
  const [addType, setAddType] = useState<RowType>("full");
  const [savingLayout, setSavingLayout] = useState(false);
  const [confirm, setConfirm] = useState<CollectionRow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const collectionById = new Map(collections.map((c) => [c.id, c]));

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
      // Clear any layout cell that referenced the deleted collection
      setRows((prev) => prev.map((r) => ({ ...r, items: r.items.map((it) => (it === target.id ? null : it)) })));
      toast.success("Collection deleted");
      await router.invalidate();
    } catch {
      toast.error("Failed to delete collection");
    } finally {
      setDeleting(null);
    }
  }

  // ── Layout builder ops ──────────────────────────────────────────────────────
  function addRow() {
    setRows((prev) => [...prev, newRow(addType)]);
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function moveRow(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }
  function changeRowType(id: string, type: RowType) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const cells = rowDef(type).cells;
        return { ...r, type, items: Array.from({ length: cells }, (_, i) => r.items[i] ?? null) };
      })
    );
  }
  function setCell(rowId: string, cellIndex: number, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, items: r.items.map((it, i) => (i === cellIndex ? (value || null) : it)) } : r
      )
    );
  }

  async function handleSaveLayout() {
    setSavingLayout(true);
    try {
      await saveHomeLayout({ data: { rows } });
      toast.success("Homepage layout saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingLayout(false);
    }
  }

  const selectClass =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]";
  const iconBtn =
    "rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]/40 hover:text-[var(--color-foreground)] disabled:opacity-30 active:opacity-60";

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

      {/* ── Homepage layout builder ── */}
      <div className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Homepage layout — “Stillness, in motion.”
        </p>
        <p className="mb-4 font-mono text-[10px] text-[var(--color-muted-foreground)]">
          Build the section as rows. Each row holds 1–3 collections; on mobile, multi-card rows become 2 columns automatically. Each collection needs a cover image.
        </p>

        <div className="space-y-4">
          {rows.map((row, ri) => {
            const def = rowDef(row.type);
            return (
              <div key={row.id} className="rounded border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                    Row {ri + 1}
                  </span>
                  <select
                    value={row.type}
                    onChange={(e) => changeRowType(row.id, e.target.value as RowType)}
                    className="ml-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
                  >
                    {ROW_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => moveRow(ri, -1)} disabled={ri === 0} className={iconBtn} aria-label="Move up"><ChevronUp size={15} /></button>
                    <button onClick={() => moveRow(ri, 1)} disabled={ri === rows.length - 1} className={iconBtn} aria-label="Move down"><ChevronDown size={15} /></button>
                    <button onClick={() => removeRow(row.id)} className="rounded p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-red-500/10 hover:text-red-400 active:opacity-60" aria-label="Remove row"><X size={15} /></button>
                  </div>
                </div>

                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${def.cells}, minmax(0, 1fr))` }}>
                  {Array.from({ length: def.cells }).map((_, ci) => {
                    const val = row.items[ci] ?? "";
                    const chosen = val ? collectionById.get(val) : null;
                    const label = cellLabel(row.type, ci);
                    return (
                      <div key={ci}>
                        {label && (
                          <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">{label}</p>
                        )}
                        <div className="mb-2 aspect-[3/4] w-16 overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-muted)]">
                          {chosen?.coverImageUrl ? (
                            <img src={cldImg(chosen.coverImageUrl, 320)} alt={chosen.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/40">Empty</span>
                            </div>
                          )}
                        </div>
                        <select value={val} onChange={(e) => setCell(row.id, ci, e.target.value)} className={selectClass}>
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
              </div>
            );
          })}

          {rows.length === 0 && (
            <p className="rounded border border-dashed border-[var(--color-border)] py-8 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]/50">
              No rows yet — add one below.
            </p>
          )}
        </div>

        {/* Add row + Save */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select value={addType} onChange={(e) => setAddType(e.target.value as RowType)} className="rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]">
              {ROW_TYPES.map((t) => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
            <button onClick={addRow} className="flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]/40 active:opacity-60">
              <Plus size={13} /> Add row
            </button>
          </div>
          <button
            onClick={() => void handleSaveLayout()}
            disabled={savingLayout}
            className="ml-auto rounded bg-[var(--color-clay)] px-5 py-2 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {savingLayout ? "Saving…" : "Save layout"}
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
