CREATE TABLE "admin_passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_passkey_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "gift_card" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"initial_amount" real NOT NULL,
	"balance" real NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"purchaser_user_id" text,
	"purchaser_email" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text NOT NULL,
	"message" text,
	"source_order_id" text,
	"issued_by_admin_id" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "gift_card_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gift_card_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"gift_card_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"balance_after" real NOT NULL,
	"order_id" text,
	"admin_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_collections" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"slot1_collection_id" text,
	"slot2_collection_id" text,
	"slot3_collection_id" text,
	"layout" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cancellation_request" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "home_caption" text;--> statement-breakpoint
ALTER TABLE "collection" ADD COLUMN "home_caption_meta" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gift_card_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gift_card_amount_lek" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pok_amount" real;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "wardrobe_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_config" ADD COLUMN "eur_to_lek_rate" real DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_config" ADD COLUMN "lek_rounding" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_passkey" ADD CONSTRAINT "admin_passkey_admin_id_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_purchaser_user_id_user_id_fk" FOREIGN KEY ("purchaser_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_issued_by_admin_id_admin_user_id_fk" FOREIGN KEY ("issued_by_admin_id") REFERENCES "public"."admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_admin_id_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_collections" ADD CONSTRAINT "home_collections_slot1_collection_id_collection_id_fk" FOREIGN KEY ("slot1_collection_id") REFERENCES "public"."collection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_collections" ADD CONSTRAINT "home_collections_slot2_collection_id_collection_id_fk" FOREIGN KEY ("slot2_collection_id") REFERENCES "public"."collection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_collections" ADD CONSTRAINT "home_collections_slot3_collection_id_collection_id_fk" FOREIGN KEY ("slot3_collection_id") REFERENCES "public"."collection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_passkey_admin_idx" ON "admin_passkey" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "gift_card_code_idx" ON "gift_card" USING btree ("code");--> statement-breakpoint
CREATE INDEX "gift_card_status_idx" ON "gift_card" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gift_card_purchaser_idx" ON "gift_card" USING btree ("purchaser_user_id");--> statement-breakpoint
CREATE INDEX "gc_tx_gift_card_idx" ON "gift_card_transaction" USING btree ("gift_card_id");--> statement-breakpoint
CREATE INDEX "gc_tx_order_idx" ON "gift_card_transaction" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "gc_tx_created_idx" ON "gift_card_transaction" USING btree ("created_at");