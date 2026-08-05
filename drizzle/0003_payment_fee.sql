-- Add payment fee config to shipping_config
ALTER TABLE "shipping_config"
  ADD COLUMN IF NOT EXISTS "payment_fee_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payment_fee_percent" real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "payment_fee_fixed"   real NOT NULL DEFAULT 0;

-- Add payment_fee column to orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "payment_fee" real NOT NULL DEFAULT 0;
