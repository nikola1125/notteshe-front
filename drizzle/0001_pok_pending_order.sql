-- Rename stripe_payment_intent_id to pok_order_id
ALTER TABLE "orders" RENAME COLUMN "stripe_payment_intent_id" TO "pok_order_id";

-- Create pending_order table for pre-payment reservation and webhook recovery
CREATE TABLE "pending_order" (
	"id" text PRIMARY KEY NOT NULL,
	"pok_order_id" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"order_data" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "pending_order" ADD CONSTRAINT "pending_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "pending_order_pok_idx" ON "pending_order" USING btree ("pok_order_id");
CREATE INDEX "pending_order_user_idx" ON "pending_order" USING btree ("user_id");
CREATE INDEX "pending_order_expires_idx" ON "pending_order" USING btree ("expires_at");
