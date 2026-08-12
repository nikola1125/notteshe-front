import { useState, useEffect, useRef } from "react";
import { Trash2, Upload, Loader2, ImagePlus } from "lucide-react";
import { uploadImageFn } from "@/lib/cloudinary";
import { cldImg } from "@/lib/cldImage";
import { toast } from "sonner";

export interface CollectionFormData {
  name: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  coverCloudflareId: string | null;
  isVisible: boolean;
  sortOrder: number;
  homeCaption: string;
  homeCaptionMeta: string;
}

interface CollectionFormProps {
  initialData?: CollectionFormData & { id?: string };
  onSave: (data: CollectionFormData) => Promise<void>;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export function CollectionForm({ initialData, onSave }: CollectionFormProps) {
  const isEdit = !!initialData?.id;
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugManual, setSlugManual] = useState(isEdit);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialData?.coverImageUrl ?? null);
  const [coverCloudflareId, setCoverCloudflareId] = useState<string | null>(initialData?.coverCloudflareId ?? null);
  const [isVisible, setIsVisible] = useState(initialData?.isVisible ?? true);
  const [sortOrder, setSortOrder] = useState(String(initialData?.sortOrder ?? 0));
  const [homeCaption, setHomeCaption] = useState(initialData?.homeCaption ?? "");
  const [homeCaptionMeta, setHomeCaptionMeta] = useState(initialData?.homeCaptionMeta ?? "");

  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be under 10 MB.");
      return;
    }
    setUploadingCover(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadImageFn({ data: { base64, folder: "notteshe/collections" } });
      setCoverImageUrl(result.url);
      setCoverCloudflareId(result.publicId);
    } catch {
      toast.error("Cover upload failed.");
    } finally {
      setUploadingCover(false);
    }
  }

  function removeCover() {
    setCoverImageUrl(null);
    setCoverCloudflareId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        coverImageUrl,
        coverCloudflareId,
        isVisible,
        sortOrder: parseInt(sortOrder) || 0,
        homeCaption: homeCaption.trim(),
        homeCaptionMeta: homeCaptionMeta.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save collection");
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
            <label htmlFor="cf-name" className={labelClass}>Name *</label>
            <input
              id="cf-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cf-slug" className={labelClass}>Slug *</label>
            <input
              id="cf-slug"
              type="text"
              required
              value={slug}
              onChange={(e) => { setSlugManual(true); setSlug(e.target.value); }}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="cf-desc" className={labelClass}>Description</label>
          <textarea
            id="cf-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown on the collection page"
            className={inputClass}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="cf-order" className={labelClass}>Sort order</label>
          <input
            id="cf-order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
            Lower numbers show first on the collections page.
          </p>
        </div>
      </div>

      {/* Homepage caption */}
      <div className={sectionClass}>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Homepage caption
        </p>
        <p className="mb-4 font-mono text-[10px] text-[var(--color-muted-foreground)]">
          Only used when this collection is placed in a homepage slot. The "Ch. 01/02/03" prefix is added automatically.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cf-cap" className={labelClass}>Caption label (optional)</label>
            <input
              id="cf-cap"
              type="text"
              value={homeCaption}
              onChange={(e) => setHomeCaption(e.target.value)}
              placeholder={name || "Defaults to collection name"}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="cf-capmeta" className={labelClass}>Caption meta (optional)</label>
            <input
              id="cf-capmeta"
              type="text"
              value={homeCaptionMeta}
              onChange={(e) => setHomeCaptionMeta(e.target.value)}
              placeholder="e.g. 04:12 pm"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Flags
        </p>
        <label className="flex cursor-pointer items-center gap-2">
          <div
            onClick={() => setIsVisible(!isVisible)}
            role="checkbox"
            aria-checked={isVisible}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") setIsVisible(!isVisible); }}
            className={`h-5 w-9 rounded-full transition-colors ${isVisible ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
          >
            <div className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isVisible ? "translate-x-4" : "translate-x-0"}`} />
          </div>
          <span className="font-mono text-xs text-[var(--color-foreground)]">Visible</span>
        </label>
      </div>

      {/* Cover image */}
      <div className={sectionClass}>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Cover image
        </p>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverChange}
        />
        {coverImageUrl ? (
          <div className="relative inline-block">
            <img
              src={cldImg(coverImageUrl, 320)}
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
            {uploadingCover ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
            <span className="font-mono text-[9px] uppercase tracking-widest">
              {uploadingCover ? "Uploading…" : "Add cover"}
            </span>
          </button>
        )}
        <p className="mt-3 font-mono text-[10px] text-[var(--color-muted-foreground)]">
          A cover image is required to feature this collection on the homepage.
        </p>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploadingCover}
          className={`rounded px-6 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${
            saved ? "bg-green-600" : "bg-[var(--color-clay)]"
          }`}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Collection"}
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
