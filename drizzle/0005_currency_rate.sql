-- Currency: EUR base price + admin-set EUR→Lek rate for the Lek storefront
ALTER TABLE "shipping_config" ADD COLUMN IF NOT EXISTS "eur_to_lek_rate" real NOT NULL DEFAULT 100;
ALTER TABLE "shipping_config" ADD COLUMN IF NOT EXISTS "lek_rounding" integer NOT NULL DEFAULT 100;
