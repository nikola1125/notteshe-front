-- Add unique constraint on orders.pok_order_id to enforce idempotency at DB level
ALTER TABLE "orders" ADD CONSTRAINT "orders_pok_order_id_unique" UNIQUE ("pok_order_id");
