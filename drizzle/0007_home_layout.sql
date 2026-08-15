-- Flexible landing collections layout (ordered rows of collection ids).
ALTER TABLE "home_collections" ADD COLUMN IF NOT EXISTS "layout" jsonb;
