// Run with: npx tsx scripts/create-admin.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { adminUser } from "../src/db/schema";

const EMAIL = "admin@notteshe.com";
const PASSWORD = "notteshe2026";
const NAME = "Nikolaos";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const passwordHash = await hashPassword(PASSWORD);

  await db.insert(adminUser).values({
    id: crypto.randomUUID(),
    email: EMAIL,
    passwordHash,
    name: NAME,
    role: "SUPERADMIN",
    isActive: true,
  }).onConflictDoNothing();

  console.log("✓ Admin created");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Login at: http://localhost:8080/admin-login`);
}

main().catch(console.error);
