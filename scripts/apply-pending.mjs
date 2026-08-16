// One-shot script: applies all pending schema changes using the app's own
// neon-http driver (HTTP, no WebSocket required). Safe to run multiple times —
// every statement uses IF NOT EXISTS / IF column doesn't already exist.
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = neon(url);

async function run(label, query) {
  try {
    await sql.query(query);
    console.log(`✓ ${label}`);
  } catch (err) {
    // Already exists / duplicate constraint — not a real failure
    if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
      console.log(`· ${label} (already applied)`);
    } else {
      console.error(`✗ ${label}:`, err.message);
    }
  }
}

// ── admin_event ───────────────────────────────────────────────────────────────
await run("create admin_event", `
  CREATE TABLE IF NOT EXISTS "admin_event" (
    "id"         text PRIMARY KEY NOT NULL,
    "type"       text NOT NULL,
    "payload"    jsonb NOT NULL DEFAULT '{}',
    "created_at" timestamp NOT NULL DEFAULT now()
  )
`);
await run("index admin_event_created_idx", `
  CREATE INDEX IF NOT EXISTS "admin_event_created_idx"
    ON "admin_event" USING btree ("created_at")
`);

// ── admin_session ─────────────────────────────────────────────────────────────
await run("create admin_session", `
  CREATE TABLE IF NOT EXISTS "admin_session" (
    "id"         text PRIMARY KEY NOT NULL,
    "admin_id"   text NOT NULL,
    "token"      text NOT NULL UNIQUE,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp NOT NULL DEFAULT now()
  )
`);

// ── cancellation_request ──────────────────────────────────────────────────────
await run("create cancellation_request", `
  CREATE TABLE IF NOT EXISTS "cancellation_request" (
    "id"         text PRIMARY KEY NOT NULL,
    "order_id"   text NOT NULL,
    "user_id"    text NOT NULL,
    "user_name"  text NOT NULL,
    "user_email" text NOT NULL,
    "status"     text NOT NULL DEFAULT 'pending',
    "is_read"    boolean NOT NULL DEFAULT false,
    "created_at" timestamp NOT NULL DEFAULT now()
  )
`);

// ── contact_message ───────────────────────────────────────────────────────────
await run("create contact_message", `
  CREATE TABLE IF NOT EXISTS "contact_message" (
    "id"         text PRIMARY KEY NOT NULL,
    "name"       text NOT NULL,
    "email"      text NOT NULL,
    "subject"    text,
    "message"    text NOT NULL,
    "is_read"    boolean NOT NULL DEFAULT false,
    "created_at" timestamp NOT NULL DEFAULT now()
  )
`);

// ── saved_card ────────────────────────────────────────────────────────────────
await run("create saved_card", `
  CREATE TABLE IF NOT EXISTS "saved_card" (
    "id"          text PRIMARY KEY NOT NULL,
    "user_id"     text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "pok_card_id" text NOT NULL UNIQUE,
    "brand"       text,
    "last_four"   text,
    "label"       text,
    "created_at"  timestamp NOT NULL DEFAULT now()
  )
`);
await run("index saved_card_user_idx", `
  CREATE INDEX IF NOT EXISTS "saved_card_user_idx" ON "saved_card" ("user_id")
`);

// ── pending_order ─────────────────────────────────────────────────────────────
await run("pending_order unique constraint", `
  ALTER TABLE "pending_order"
    ADD CONSTRAINT "pending_order_pok_order_id_unique" UNIQUE ("pok_order_id")
`);

// ── orders columns ────────────────────────────────────────────────────────────
for (const [col, def] of [
  ["payment_fee",     "real NOT NULL DEFAULT 0"],
  ["discount_code",   "text"],
  ["discount_amount", "real NOT NULL DEFAULT 0"],
  ["pok_order_id",    "text"],
  ["is_read",         "boolean NOT NULL DEFAULT false"],
]) {
  await run(`orders.${col}`, `
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "${col}" ${def}
  `);
}
await run("orders pok_order_id unique", `
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_pok_order_id_unique" UNIQUE ("pok_order_id")
`);

// ── product columns ───────────────────────────────────────────────────────────
await run("product.is_permanent_wardrobe", `
  ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "is_permanent_wardrobe" boolean NOT NULL DEFAULT false
`);

// ── shipping_config columns ───────────────────────────────────────────────────
for (const [col, def] of [
  ["payment_fee_enabled", "boolean NOT NULL DEFAULT false"],
  ["payment_fee_percent", "real NOT NULL DEFAULT 0"],
  ["payment_fee_fixed",   "real NOT NULL DEFAULT 0"],
]) {
  await run(`shipping_config.${col}`, `
    ALTER TABLE "shipping_config" ADD COLUMN IF NOT EXISTS "${col}" ${def}
  `);
}

// ── collection columns ────────────────────────────────────────────────────────
for (const [col, def] of [
  ["sort_order",        "integer NOT NULL DEFAULT 0"],
  ["home_caption",      "text"],
  ["home_caption_meta", "text"],
]) {
  await run(`collection.${col}`, `
    ALTER TABLE "collection" ADD COLUMN IF NOT EXISTS "${col}" ${def}
  `);
}

// ── home_collections (singleton, id = 'default') ──────────────────────────────
await run("create home_collections", `
  CREATE TABLE IF NOT EXISTS "home_collections" (
    "id"                  text PRIMARY KEY NOT NULL DEFAULT 'default',
    "slot1_collection_id" text,
    "slot2_collection_id" text,
    "slot3_collection_id" text,
    "updated_at"          timestamp NOT NULL DEFAULT now()
  )
`);
for (const [name, col] of [
  ["home_collections_slot1_fk", "slot1_collection_id"],
  ["home_collections_slot2_fk", "slot2_collection_id"],
  ["home_collections_slot3_fk", "slot3_collection_id"],
]) {
  await run(`home_collections.${col} fk`, `
    ALTER TABLE "home_collections"
      ADD CONSTRAINT "${name}"
      FOREIGN KEY ("${col}") REFERENCES "collection"("id") ON DELETE SET NULL
  `);
}
await run("seed home_collections default row", `
  INSERT INTO "home_collections" ("id") VALUES ('default') ON CONFLICT DO NOTHING
`);

// ── orders: gift card columns ─────────────────────────────────────────────────
for (const [col, def] of [
  ["gift_card_code",       "text"],
  ["gift_card_amount_lek", "real NOT NULL DEFAULT 0"],
]) {
  await run(`orders.${col}`, `
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "${col}" ${def}
  `);
}

// ── gift_card ─────────────────────────────────────────────────────────────────
await run("create gift_card", `
  CREATE TABLE IF NOT EXISTS "gift_card" (
    "id"                  text PRIMARY KEY NOT NULL,
    "code"                text NOT NULL UNIQUE,
    "initial_amount"      real NOT NULL,
    "balance"             real NOT NULL,
    "status"              text NOT NULL DEFAULT 'active',
    "purchaser_user_id"   text REFERENCES "user"("id") ON DELETE SET NULL,
    "purchaser_email"     text NOT NULL,
    "recipient_email"     text NOT NULL,
    "recipient_name"      text NOT NULL,
    "message"             text,
    "source_order_id"     text,
    "issued_by_admin_id"  text REFERENCES "admin_user"("id") ON DELETE SET NULL,
    "expires_at"          timestamp,
    "created_at"          timestamp NOT NULL DEFAULT now(),
    "last_used_at"        timestamp
  )
`);
await run("index gift_card_code_idx",      `CREATE INDEX IF NOT EXISTS "gift_card_code_idx"      ON "gift_card" ("code")`);
await run("index gift_card_status_idx",    `CREATE INDEX IF NOT EXISTS "gift_card_status_idx"    ON "gift_card" ("status")`);
await run("index gift_card_purchaser_idx", `CREATE INDEX IF NOT EXISTS "gift_card_purchaser_idx" ON "gift_card" ("purchaser_user_id")`);

// ── gift_card_transaction ─────────────────────────────────────────────────────
await run("create gift_card_transaction", `
  CREATE TABLE IF NOT EXISTS "gift_card_transaction" (
    "id"            text PRIMARY KEY NOT NULL,
    "gift_card_id"  text NOT NULL REFERENCES "gift_card"("id") ON DELETE CASCADE,
    "type"          text NOT NULL,
    "amount"        real NOT NULL,
    "balance_after" real NOT NULL,
    "order_id"      text,
    "admin_id"      text REFERENCES "admin_user"("id") ON DELETE SET NULL,
    "note"          text,
    "created_at"    timestamp NOT NULL DEFAULT now()
  )
`);
await run("index gc_tx_gift_card_idx", `CREATE INDEX IF NOT EXISTS "gc_tx_gift_card_idx" ON "gift_card_transaction" ("gift_card_id")`);
await run("index gc_tx_order_idx",     `CREATE INDEX IF NOT EXISTS "gc_tx_order_idx"     ON "gift_card_transaction" ("order_id")`);
await run("index gc_tx_created_idx",   `CREATE INDEX IF NOT EXISTS "gc_tx_created_idx"   ON "gift_card_transaction" ("created_at")`);

console.log("\nDone.");
