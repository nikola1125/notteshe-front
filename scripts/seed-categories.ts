// Run with: npx tsx scripts/seed-categories.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { category } from "../src/db/schema";

const CATEGORIES = [
  { name: "Dresses",          slug: "dresses" },
  { name: "Hats",             slug: "hats" },
  { name: "Swimwear",         slug: "swimwear" },
  { name: "Shorts & Skirts",  slug: "shorts-skirts" },
  { name: "Lingerie",         slug: "lingerie" },
  { name: "Coats & Jackets",  slug: "coats-jackets" },
  { name: "Knitwear",         slug: "knitwear" },
];

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  for (const cat of CATEGORIES) {
    await db
      .insert(category)
      .values({ id: crypto.randomUUID(), name: cat.name, slug: cat.slug })
      .onConflictDoNothing();
    console.log(`✓ ${cat.name}`);
  }

  console.log("\nCategories seeded.");
}

main().catch(console.error);
