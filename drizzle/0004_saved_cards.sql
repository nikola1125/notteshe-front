-- Saved card table for POK tokenized cards
CREATE TABLE IF NOT EXISTS "saved_card" (
  "id"          text PRIMARY KEY NOT NULL,
  "user_id"     text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "pok_card_id" text NOT NULL UNIQUE,
  "brand"       text,
  "last_four"   text,
  "label"       text,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "saved_card_user_idx" ON "saved_card" ("user_id");
