import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export interface SizeEntry {
  id?: string;
  label: string;
  available: boolean;
  stock: number;
}

export interface ColourEntry {
  id?: string;
  name: string;
  hex: string;
}

export interface ImageEntry {
  id?: string;
  cloudflareId: string;
  url: string;
  isCover: boolean;
}

export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  details: string[];
  categoryId: string;
  collectionId: string;
  price: number;
  originalPrice: number | null;
  isNew: boolean;
  isVisible: boolean;
  inStock: boolean;
  sizes: SizeEntry[];
  colours: ColourEntry[];
  images: ImageEntry[];
}

const SIZE_LABELS = ["XS", "S", "M", "L", "XL", "One Size"];

interface ProductFormProps {
  initialData?: ProductFormData & { id?: string };
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string }>;
  onSave: (data: ProductFormData) => Promise<void>;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ProductForm({
  initialData,
  categories,
  collections,
  onSave,
}: ProductFormProps) {
  const isEdit = !!initialData?.id;

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [detailsText, setDetailsText] = useState(
    (initialData?.details ?? []).join("\n")
  );
  const [categoryId, setCategoryId] = useState(
    initialData?.categoryId ?? ""
  );
  const [collectionId, setCollectionId] = useState(
    initialData?.collectionId ?? ""
  );
  const [price, setPrice] = useState(String(initialData?.price ?? ""));
  const [originalPrice, setOriginalPrice] = useState(
    initialData?.originalPrice != null ? String(initialData.originalPrice) : ""
  );
  const [isNew, setIsNew] = useState(initialData?.isNew ?? false);
  const [isVisible, setIsVisible] = useState(initialData?.isVisible ?? true);
  const [inStock, setInStock] = useState(initialData?.inStock ?? true);

  const [sizes, setSizes] = useState<SizeEntry[]>(() => {
    if (initialData?.sizes?.length) return initialData.sizes;
    return SIZE_LABELS.map((label) => ({
      label,
      available: false,
      stock: 0,
    }));
  });

  const [colours, setColours] = useState<ColourEntry[]>(
    initialData?.colours ?? []
  );
  const [images, setImages] = useState<ImageEntry[]>(
    initialData?.images ?? []
  );
  const [newColour, setNewColour] = useState({ name: "", hex: "#000000" });
  const [newImage, setNewImage] = useState({ cloudflareId: "", url: "" });
  const [saving, setSaving] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  function addColour() {
    if (!newColour.name.trim()) return;
    setColours((prev) => [
      ...prev,
      { name: newColour.name.trim(), hex: newColour.hex },
    ]);
    setNewColour({ name: "", hex: "#000000" });
  }

  function removeColour(i: number) {
    setColours((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addImage() {
    if (!newImage.url.trim()) return;
    setImages((prev) => [
      ...prev,
      {
        cloudflareId: newImage.cloudflareId.trim(),
        url: newImage.url.trim(),
        isCover: prev.length === 0,
      },
    ]);
    setNewImage({ cloudflareId: "", url: "" });
  }

  function removeImage(i: number) {
    setImages((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      // Ensure at least one cover
      if (next.length > 0 && !next.some((img) => img.isCover)) {
        next[0].isCover = true;
      }
      return next;
    });
  }

  function moveImage(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  function setCover(i: number) {
    setImages((prev) =>
      prev.map((img, idx) => ({ ...img, isCover: idx === i }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        slug,
        description,
        details: detailsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        categoryId,
        collectionId,
        price: parseFloat(price) || 0,
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        isNew,
        isVisible,
        inStock,
        sizes,
        colours,
        images,
      });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none transition-colors focus:border-[var(--color-clay)]";
  const labelClass =
    "block font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1";
  const sectionClass =
    "rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Core fields */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Core
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-name" className={labelClass}>
              Name *
            </label>
            <input
              id="pf-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pf-slug" className={labelClass}>
              Slug *
            </label>
            <input
              id="pf-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugManual(true);
                setSlug(e.target.value);
              }}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="pf-desc" className={labelClass}>
            Description
          </label>
          <textarea
            id="pf-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="pf-details" className={labelClass}>
            Details (one per line)
          </label>
          <textarea
            id="pf-details"
            rows={4}
            value={detailsText}
            onChange={(e) => setDetailsText(e.target.value)}
            placeholder="100% silk&#10;Dry clean only&#10;Made in Italy"
            className={inputClass}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-cat" className={labelClass}>
              Category
            </label>
            <select
              id="pf-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-col" className={labelClass}>
              Collection
            </label>
            <select
              id="pf-col"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Pricing
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-price" className={labelClass}>
              Price (€) *
            </label>
            <input
              id="pf-price"
              type="number"
              step="0.01"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="pf-orig" className={labelClass}>
              Original Price (€) — sets Sale
            </label>
            <input
              id="pf-orig"
              type="number"
              step="0.01"
              min="0"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              className={inputClass}
              placeholder="Leave blank if no sale"
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Flags
        </p>
        <div className="flex flex-wrap gap-6">
          {(
            [
              { label: "New In", state: isNew, setter: setIsNew },
              { label: "Visible", state: isVisible, setter: setIsVisible },
              { label: "In Stock", state: inStock, setter: setInStock },
            ] as const
          ).map(({ label, state, setter }) => (
            <label
              key={label}
              className="flex cursor-pointer items-center gap-2"
            >
              <div
                onClick={() => setter(!state)}
                role="checkbox"
                aria-checked={state}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") setter(!state);
                }}
                className={`h-5 w-9 rounded-full transition-colors ${state ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
              >
                <div
                  className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${state ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
              <span className="font-mono text-xs text-[var(--color-foreground)]">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Sizes */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Sizes
        </p>
        <div className="space-y-2">
          {sizes.map((s, i) => (
            <div key={s.label} className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.available}
                  onChange={(e) =>
                    setSizes((prev) =>
                      prev.map((sz, idx) =>
                        idx === i ? { ...sz, available: e.target.checked } : sz
                      )
                    )
                  }
                  className="accent-[var(--color-clay)]"
                />
                <span className="w-12 font-mono text-xs text-[var(--color-foreground)]">
                  {s.label}
                </span>
              </label>
              <input
                type="number"
                min="0"
                value={s.stock}
                onChange={(e) =>
                  setSizes((prev) =>
                    prev.map((sz, idx) =>
                      idx === i
                        ? { ...sz, stock: parseInt(e.target.value) || 0 }
                        : sz
                    )
                  )
                }
                className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 font-mono text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
                placeholder="Stock"
              />
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                units
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Colours */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Colours
        </p>
        <div className="space-y-2">
          {colours.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="h-5 w-5 rounded-full border border-[var(--color-border)]"
                style={{ background: c.hex }}
              />
              <span className="text-xs text-[var(--color-foreground)]">
                {c.name}
              </span>
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                {c.hex}
              </span>
              <button
                type="button"
                onClick={() => removeColour(i)}
                className="ml-auto text-[var(--color-muted-foreground)] transition-colors hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label className={labelClass}>Colour name</label>
            <input
              type="text"
              value={newColour.name}
              onChange={(e) =>
                setNewColour((prev) => ({ ...prev, name: e.target.value }))
              }
              className={inputClass}
              placeholder="e.g. Ivory"
            />
          </div>
          <div>
            <label className={labelClass}>Hex</label>
            <input
              type="color"
              value={newColour.hex}
              onChange={(e) =>
                setNewColour((prev) => ({ ...prev, hex: e.target.value }))
              }
              className="h-[38px] w-12 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-1"
            />
          </div>
          <button
            type="button"
            onClick={addColour}
            className="flex items-center gap-1 rounded border border-[var(--color-border)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)] transition-colors hover:border-[var(--color-clay)]"
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Images */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Images
        </p>
        <div className="space-y-2">
          {images.map((img, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded border border-[var(--color-border)] p-2"
            >
              <img
                src={img.url}
                alt=""
                className="h-12 w-9 rounded object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="flex-1 overflow-hidden">
                <p className="truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">
                  {img.url}
                </p>
                {img.isCover && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-clay)]">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveImage(i, -1)}
                  disabled={i === 0}
                  className="p-1 text-[var(--color-muted-foreground)] disabled:opacity-30"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(i, 1)}
                  disabled={i === images.length - 1}
                  className="p-1 text-[var(--color-muted-foreground)] disabled:opacity-30"
                >
                  <ArrowDown size={13} />
                </button>
                {!img.isCover && (
                  <button
                    type="button"
                    onClick={() => setCover(i)}
                    className="px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-clay)]"
                  >
                    Set cover
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="p-1 text-[var(--color-muted-foreground)] transition-colors hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Image URL</label>
            <input
              type="text"
              value={newImage.url}
              onChange={(e) =>
                setNewImage((prev) => ({ ...prev, url: e.target.value }))
              }
              className={inputClass}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelClass}>Cloudflare ID</label>
            <input
              type="text"
              value={newImage.cloudflareId}
              onChange={(e) =>
                setNewImage((prev) => ({
                  ...prev,
                  cloudflareId: e.target.value,
                }))
              }
              className={inputClass}
              placeholder="cf-id (optional)"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={addImage}
          className="mt-2 flex items-center gap-1 rounded border border-[var(--color-border)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)] transition-colors hover:border-[var(--color-clay)]"
        >
          <Plus size={13} /> Add image
        </button>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[var(--color-clay)] px-6 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Product"}
        </button>
      </div>
    </form>
  );
}
