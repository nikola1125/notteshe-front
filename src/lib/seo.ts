export const SITE_URL = "https://notteshe.com";
export const SITE_NAME = "Notteshe";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export function buildTitle(page: string): string {
  return `${page} — ${SITE_NAME}`;
}

export function buildDescription(text: string | null | undefined, fallback?: string): string {
  const raw = (text ?? fallback ?? "").replace(/<[^>]+>/g, "").trim();
  return raw.length > 160 ? raw.slice(0, 157) + "…" : raw || (fallback ?? "");
}

export function cldOgImage(url: string | null | undefined): string {
  if (!url) return DEFAULT_OG_IMAGE;
  const UPLOAD_MARKER = "/image/upload/";
  const idx = url.indexOf(UPLOAD_MARKER);
  if (idx === -1) return url;
  const insertAt = idx + UPLOAD_MARKER.length;
  const rest = url.slice(insertAt);
  if (!/^v\d+\//.test(rest) && /^[a-z]{1,3}_[^/]+/i.test(rest)) return url;
  return url.slice(0, insertAt) + "w_1200,h_630,c_fill,f_auto,q_auto" + "/" + rest;
}

export function buildOrgJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: ["https://www.instagram.com/notteshe"],
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@notteshe.com",
      contactType: "customer service",
    },
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildProductJsonLd(p: {
  name: string;
  description: string;
  images: string[];
  slug: string;
  price: number;
  originalPrice?: number | null;
  isNew?: boolean;
  isSale?: boolean;
}) {
  const url = `${SITE_URL}/shop/${p.slug}`;
  const images = p.images.map((img) => cldOgImage(img));

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    price: p.price.toFixed(2),
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url,
  };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: buildDescription(p.description),
    image: images,
    url,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: offer,
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFaqJsonLd(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
