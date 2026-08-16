-- Manual ordering for the homepage permanent wardrobe.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "wardrobe_order" integer NOT NULL DEFAULT 0;
