# Collections — Implementation Plan

_Status: IMPLEMENTED (2026-08-11). Stack: TanStack Start (React 19 + Vite) · Drizzle ORM · Neon Postgres · Cloudinary · Cloudflare Workers._

## Implemented files

- Schema: `src/db/schema.ts` — added `collection.sortOrder/homeCaption/homeCaptionMeta` + `homeCollections` singleton table + `HomeCollections` type.
- Migration: `scripts/apply-pending.mjs` — idempotent columns/table/FKs/seed row. **Applied successfully.**
- Admin: `src/components/admin/CollectionForm.tsx`; routes `src/routes/admin/collections/{index,new,$id}.tsx`; sidebar entry in `AdminSidebar.tsx` (Layers icon). Index page includes the 3-slot homepage picker.
- Storefront: `src/routes/collections/index.tsx` (index) + `src/routes/collections/$slug.tsx` (detail, cover hero + product grid).
- Homepage: `src/routes/index.tsx` — `getHomeData` returns featured collections; lookbook section now renders the collections composition with static fallback when none are configured.
- Verified: `npm run build` passes; `tsc --noEmit` clean for all new files.

## Goal

Let the store owner create and manage an unlimited number of **Collections** (name, cover image,
description, visibility) from the admin panel, assign products to a collection via the existing
dropdown on the product form, and showcase a curated **3** of them on the homepage — replacing the
current "Stillness, in motion." lookbook section — with the rest reachable on a `/collections` index
and each collection getting its own `/collections/$slug` page.

## Chosen design — Pattern B (curated 3-slot composition)

- The homepage lookbook section (`src/routes/index.tsx`, "Stillness, in motion.") is replaced by a
  Collections composition with **three fixed slots**: large tile left, two stacked tiles right —
  preserving the staggered editorial look and the `CH. 0X — {NAME} ... {meta}` caption style.
- Section chrome — the heading **"Stillness, in motion."** and the corner label
  **"AW26 · 03 CHAPTERS"** — stays **hard-coded**. Admin does NOT edit section text.
- Caption per tile: `CH. 01/02/03` auto-derives from slot position; the label is the collection
  name (with optional override); the decorative meta ("04:12 PM") is an optional per-collection
  field that is hidden when blank.
- Clicking a cover → dedicated `/collections/$slug` page: cover hero + that collection's products.
- Collections beyond the 3 featured live on a `/collections` index page, ordered by `sortOrder`.
- Graceful fallback if fewer than 3 slots are filled (recompose for 1–2 tiles); never render empty
  boxes.

## Data model

Already present (no change): `collection` table (`id, name, slug, description, coverImageUrl,
coverCloudflareId, isVisible, createdAt`) and `product.collectionId` FK (ON DELETE SET NULL), plus
the Collection dropdown on the product form fed by `getFormOptions()`.

Migration (non-breaking — nullable/defaulted columns only):

- `collection.sortOrder` — integer, default 0 (ordering on the `/collections` index + admin list).
- `collection.homeCaption` — text, nullable (optional caption label override; defaults to name).
- `collection.homeCaptionMeta` — text, nullable (optional decorative meta, e.g. "04:12 PM").
- New singleton table `homeCollections` (id = 'default', same pattern as `shippingConfig`):
  `slot1CollectionId`, `slot2CollectionId`, `slot3CollectionId` — each text FK → collection.id,
  nullable, ON DELETE SET NULL.

## Admin — full control

New `Collections` sidebar entry (Lucide `Layers`), between Products and Inventory.

- `/admin/collections` (index) — list: cover thumb, name, product count, visible toggle, homepage
  slot badge, sort order, edit/delete. Server fn `getCollections()`.
- `/admin/collections/new` — create. Server fn `createCollection()`.
- `/admin/collections/$id` — edit + delete. Server fns `getCollectionEdit()`, `updateCollection()`,
  `deleteCollection()`. Includes a read-only "products in this collection" list.
- Collection form fields: name, slug (auto from name, editable, uniqueness-checked), description,
  cover image (single upload via existing `uploadImageFn`, folder `notteshe/collections`), visible,
  sortOrder, optional homeCaption, optional homeCaptionMeta.
- **Homepage slot picker** (on the collections index or a dedicated panel): three slots
  (large-left / top-right / bottom-right), each a dropdown of collections, with a live cover
  preview. Server fns `getHomeCollections()`, `updateHomeCollections()`. Enforces exactly 3
  positions — cannot accidentally show 2 or 4.
- Products join a collection via the existing product-form dropdown (no change).

## Guardrails ("make no mistakes")

- Deleting a collection: cover removed from Cloudinary; products auto-detach (ON DELETE SET NULL);
  any homepage slot referencing it is cleared; admin warns with product count first.
- Hiding / cover-less / empty (no visible products) collection assigned to a slot → admin warning;
  homepage falls back safely instead of rendering broken tiles.
- Cover image required before a collection can occupy a homepage slot.
- Slug uniqueness enforced (DB constraint + form validation); guard against route-segment clashes.
- Cover replace / collection delete always calls `deleteFromCloudinary` to avoid orphaned assets.
- All mutations `requireAdmin` + `logAudit`, and trigger homepage revalidation (existing pattern) so
  changes go live without a redeploy.

## Build order

1. Schema migration (`sortOrder`, `homeCaption`, `homeCaptionMeta`, `homeCollections` singleton) →
   generate → apply via `scripts/apply-pending.mjs`.
2. Admin server functions + `Collections` CRUD routes + `CollectionForm` + sidebar entry.
3. Homepage slot picker (server fns + admin UI).
4. Storefront: `/collections/$slug` detail page + `/collections` index.
5. Homepage: replace the "Stillness, in motion." lookbook section with the Collections composition.
6. Verify build (`npm run build`) and behaviour.
