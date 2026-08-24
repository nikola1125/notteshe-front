import { db } from "@/db";
import { product, collection } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SITE_URL } from "@/lib/seo";

const STATIC_URLS: Array<{ loc: string; priority: string; changefreq: string }> = [
  { loc: "/",             priority: "1.0", changefreq: "daily" },
  { loc: "/shop",         priority: "0.8", changefreq: "daily" },
  { loc: "/collections",  priority: "0.8", changefreq: "weekly" },
  { loc: "/about",        priority: "0.6", changefreq: "monthly" },
  { loc: "/contact",      priority: "0.6", changefreq: "monthly" },
  { loc: "/faq",          priority: "0.6", changefreq: "monthly" },
  { loc: "/shipping",     priority: "0.6", changefreq: "monthly" },
  { loc: "/exchanges",    priority: "0.6", changefreq: "monthly" },
  { loc: "/size-guide",   priority: "0.6", changefreq: "monthly" },
  { loc: "/gift-cards",   priority: "0.6", changefreq: "monthly" },
];

function urlEntry(loc: string, priority: string, changefreq: string, lastmod?: string): string {
  return [
    "  <url>",
    `    <loc>${SITE_URL}${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].filter(Boolean).join("\n");
}

export async function handleSitemap(): Promise<Response> {
  const database = db();
  const today = new Date().toISOString().split("T")[0];

  const [products, collections] = await Promise.all([
    database
      .select({ slug: product.slug, updatedAt: product.updatedAt })
      .from(product)
      .where(eq(product.isVisible, true)),
    database
      .select({ slug: collection.slug, createdAt: collection.createdAt })
      .from(collection)
      .where(eq(collection.isVisible, true)),
  ]);

  const entries = [
    ...STATIC_URLS.map(({ loc, priority, changefreq }) =>
      urlEntry(loc, priority, changefreq, today)
    ),
    ...products.map((p) =>
      urlEntry(
        `/shop/${p.slug}`,
        "0.9",
        "weekly",
        p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : today
      )
    ),
    ...collections.map((c) =>
      urlEntry(
        `/collections/${c.slug}`,
        "0.9",
        "weekly",
        c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : today
      )
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
