CREATE TABLE "admin_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cancellation_request" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_message" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_order" (
	"id" text PRIMARY KEY NOT NULL,
	"pok_order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"order_data" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_order_pok_order_id_unique" UNIQUE("pok_order_id")
);
--> statement-breakpoint
CREATE TABLE "saved_card" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pok_card_id" text NOT NULL,
	"brand" text,
	"last_four" text,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_card_pok_card_id_unique" UNIQUE("pok_card_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_fee" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pok_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_permanent_wardrobe" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_config" ADD COLUMN "payment_fee_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_config" ADD COLUMN "payment_fee_percent" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_config" ADD COLUMN "payment_fee_fixed" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_order" ADD CONSTRAINT "pending_order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_card" ADD CONSTRAINT "saved_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_event_created_idx" ON "admin_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pending_order_pok_idx" ON "pending_order" USING btree ("pok_order_id");--> statement-breakpoint
CREATE INDEX "pending_order_user_idx" ON "pending_order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pending_order_expires_idx" ON "pending_order" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "saved_card_user_idx" ON "saved_card" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "stripe_payment_intent_id";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pok_order_id_unique" UNIQUE("pok_order_id");