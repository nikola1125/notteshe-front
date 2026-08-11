import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local" });

// drizzle-kit migrate uses @neondatabase/serverless in WebSocket mode locally.
// The ws package provides the WebSocket constructor it needs.
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"]!,
  },
  verbose: true,
  strict: true,
});
