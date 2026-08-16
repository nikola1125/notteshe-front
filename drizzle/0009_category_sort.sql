-- Manual category display order.
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
