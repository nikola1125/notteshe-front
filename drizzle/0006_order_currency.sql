-- Per-order charge currency + the exact amount sent to POK in that currency.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'EUR';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pok_amount" real;
