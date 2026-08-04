import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, Loader2, ImagePlus } from "lucide-react";
import { uploadImageFn } from "@/lib/cloudinary";
import { toast } from "sonner";

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
  isSale: boolean;
  isVisible: boolean;
  inStock: boolean;
  isPermanentWardrobe: boolean;
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
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [detailsText, setDetailsText] = useState(
    (initialData?.details ?? []).join("\n")
  );
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? "");
  const [collectionId, setCollectionId] = useState(initialData?.collectionId ?? "");
  const [price, setPrice] = useState(String(initialData?.price ?? ""));
  const [originalPrice, setOriginalPrice] = useState(
    initialData?.originalPrice != null ? String(initialData.originalPrice) : ""
  );
  const [isNew, setIsNew] = useState(initialData?.isNew ?? false);
  const [isSale, setIsSale] = useState(initialData?.isSale ?? false);
  const [isVisible, setIsVisible] = useState(initialData?.isVisible ?? true);
  const [inStock, setInStock] = useState(initialData?.inStock ?? true);
  const [isPermanentWardrobe, setIsPermanentWardrobe] = useState(initialData?.isPermanentWardrobe ?? false);

  const [sizes, setSizes] = useState<SizeEntry[]>(() => {
    if (initialData?.sizes?.length) return initialData.sizes;
    return SIZE_LABELS.map((label) => ({ label, available: false, stock: 0 }));
  });

  const [colours, setColours] = useState<ColourEntry[]>(initialData?.colours ?? []);
  const [images, setImages] = useState<ImageEntry[]>(initialData?.images ?? []);
  const [newColour, setNewColour] = useState({ name: "", hex: "#000000" });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const coverImage = images.find((img) => img.isCover) ?? null;
  const galleryImages = images.filter((img) => !img.isCover);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  function addColour() {
    if (!newColour.name.trim()) return;
    setColours((prev) => [...prev, { name: newColour.name.trim(), hex: newColour.hex }]);
    setNewColour({ name: "", hex: "#000000" });
  }

  function removeColour(i: number) {
    setColours((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingCover(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadImageFn({ data: { base64 } });
      setImages((prev) => [
        { cloudflareId: result.publicId, url: result.url, isCover: true },
        ...prev.filter((img) => !img.isCover),
      ]);
    } catch {
      toast.error("Cover upload failed.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setUploadingGallery(true);
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const result = await uploadImageFn({ data: { base64 } });
        setImages((prev) => [
          ...prev,
          { cloudflareId: result.publicId, url: result.url, isCover: false },
        ]);
      }
    } catch {
      toast.error("Gallery upload failed.");
    } finally {
      setUploadingGallery(false);
    }
  }

  function removeCover() {
    setImages((prev) => prev.filter((img) => !img.isCover));
  }

  function removeGalleryImage(url: string) {
    setImages((prev) => prev.filter((img) => img.url !== url));
  }

  function moveGalleryImage(url: string, dir: -1 | 1) {
    setImages((prev) => {
      const galleryOnly = prev.filter((img) => !img.isCover);
      const idx = galleryOnly.findIndex((img) => img.url === url);
      const target = idx + dir;
      if (target < 0 || target >= galleryOnly.length) return prev;
      [galleryOnly[idx], galleryOnly[target]] = [galleryOnly[target], galleryOnly[idx]];
      return [...prev.filter((img) => img.isCover), ...galleryOnly];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await onSave({
        name,
        slug,
        description,
        details: detailsText.split("\n").map((l) => l.trim()).filter(Boolean),
        categoryId,
        collectionId,
        price: parseFloat(price) || 0,
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        isNew,
        isSale,
        isVisible,
        inStock,
        isPermanentWardrobe,
        sizes,
        colours,
        images,
      });
      toast.success("Changes saved");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
            <label htmlFor="pf-name" className={labelClass}>Name *</label>
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
            <label htmlFor="pf-slug" className={labelClass}>Slug *</label>
            <input
              id="pf-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => { setSlugManual(true); setSlug(e.target.value); }}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="pf-desc" className={labelClass}>Description</label>
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
            placeholder={"100% silk\nDry clean only\nMade in Italy"}
            className={inputClass}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-cat" className={labelClass}>Category</label>
            <select
              id="pf-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-col" className={labelClass}>Collection</label>
            <select
              id="pf-col"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className={inputClass}
            >
              <option value="">— None —</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
        {isSale ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pf-orig" className={labelClass}>Original Price (€) *</label>
              <input
                id="pf-orig"
                type="number"
                step="0.01"
                min="0"
                required
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className={inputClass}
                placeholder="e.g. 200"
              />
            </div>
            <div>
              <label htmlFor="pf-price" className={labelClass}>Sale Price (€) *</label>
              <input
                id="pf-price"
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
                placeholder="e.g. 150"
              />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="pf-price" className={labelClass}>Price (€) *</label>
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
        )}
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
              { label: "Sale", state: isSale, setter: setIsSale },
              { label: "Visible", state: isVisible, setter: setIsVisible },
              { label: "In Stock", state: inStock, setter: setInStock },
              { label: "Permanent Wardrobe", state: isPermanentWardrobe, setter: setIsPermanentWardrobe },
            ] as const
          ).map(({ label, state, setter }) => (
            <label key={label} className="flex cursor-pointer items-center gap-2">
              <div
                onClick={() => setter(!state)}
                role="checkbox"
                aria-checked={state}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") setter(!state); }}
                className={`h-5 w-9 rounded-full transition-colors ${state ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
              >
                <div
                  className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${state ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
              <span className="font-mono text-xs text-[var(--color-foreground)]">{label}</span>
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
                      idx === i ? { ...sz, stock: parseInt(e.target.value) || 0 } : sz
                    )
                  )
                }
                className="w-24 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 font-mono text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
                placeholder="Stock"
              />
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">units</span>
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
              <span className="text-xs text-[var(--color-foreground)]">{c.name}</span>
              <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{c.hex}</span>
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
              onChange={(e) => setNewColour((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
              placeholder="e.g. Ivory"
            />
          </div>
          <div>
            <label className={labelClass}>Hex</label>
            <input
              type="color"
              value={newColour.hex}
              onChange={(e) => setNewColour((prev) => ({ ...prev, hex: e.target.value }))}
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

        {/* Cover image */}
        <div className="mb-5">
          <p className={labelClass}>Cover image</p>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
          {coverImage ? (
            <div className="relative inline-block">
              <img
                src={coverImage.url}
                alt="Cover"
                className="h-48 w-36 rounded-lg border border-[var(--color-border)] object-cover"
              />
              <button
                type="button"
                onClick={removeCover}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition-opacity hover:opacity-80"
              >
                <Trash2 size={11} />
              </button>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white backdrop-blur-sm transition-opacity hover:opacity-80"
              >
                {uploadingCover ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="flex h-48 w-36 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingCover ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <ImagePlus size={20} />
              )}
              <span className="font-mono text-[9px] uppercase tracking-widest">
                {uploadingCover ? "Uploading…" : "Add cover"}
              </span>
            </button>
          )}
        </div>

        {/* Gallery images */}
        <div>
          <p className={labelClass}>Gallery images</p>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleGalleryChange}
          />
          <div className="flex flex-wrap gap-3">
            {galleryImages.map((img, i) => (
              <div key={img.url} className="relative">
                <img
                  src={img.url}
                  alt=""
                  className="h-28 w-20 rounded-lg border border-[var(--color-border)] object-cover"
                />
                <div className="absolute -top-2 -right-2 flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveGalleryImage(img.url, -1)}
                    disabled={i === 0}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-paper)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] disabled:opacity-30"
                  >
                    <ArrowUp size={9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGalleryImage(img.url, 1)}
                    disabled={i === galleryImages.length - 1}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-paper)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] disabled:opacity-30"
                  >
                    <ArrowDown size={9} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(img.url)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              </div>
            ))}

            {/* Add more button */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGallery}
              className="flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingGallery ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              <span className="font-mono text-[8px] uppercase tracking-widest">
                {uploadingGallery ? "…" : "Add"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploadingCover || uploadingGallery}
          className={`rounded px-6 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${
            saved ? "bg-green-600" : "bg-[var(--color-clay)]"
          }`}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Product"}
        </button>
      </div>
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
