# NOTTESHE — Project Rules & Standards
## Custom Website · Next.js · TypeScript · Tailwind · GSAP

---

# TECH STACK

```
Next.js 14+          App Router, RSC by default
TypeScript           strict mode on, no any
Tailwind CSS         utility-first, no inline styles
GSAP (free only)     gsap, ScrollTrigger, ScrollSmoother, Flip, Draggable
Stripe               payments
Prisma               ORM
PostgreSQL           database
Cloudinary           image hosting + optimization
Resend               transactional emails
Vercel               hosting + edge functions
```

---

# FOLDER STRUCTURE

```
notteshe/
├── app/
│   ├── (shop)/
│   │   ├── page.tsx                  homepage
│   │   ├── shop/
│   │   │   └── page.tsx              all products
│   │   ├── shop/[slug]/
│   │   │   └── page.tsx              product detail
│   │   ├── collections/
│   │   │   └── [slug]/page.tsx       collection pages
│   │   ├── lookbook/
│   │   │   └── page.tsx
│   │   ├── about/
│   │   │   └── page.tsx
│   │   └── contact/
│   │       └── page.tsx
│   ├── (checkout)/
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── order-confirmed/page.tsx
│   ├── (info)/
│   │   ├── size-guide/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── shipping/page.tsx
│   │   └── returns/page.tsx
│   ├── api/
│   │   ├── checkout/route.ts
│   │   ├── webhooks/stripe/route.ts
│   │   ├── products/route.ts
│   │   └── newsletter/route.ts
│   ├── layout.tsx                    root layout
│   ├── not-found.tsx                 custom 404
│   └── globals.css
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── AnnouncementBar.tsx
│   │   └── MegaMenu.tsx
│   ├── shop/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ProductGallery.tsx
│   │   ├── ProductInfo.tsx
│   │   ├── FilterTabs.tsx
│   │   ├── SizeSelector.tsx
│   │   └── ColorSelector.tsx
│   ├── cart/
│   │   ├── CartDrawer.tsx
│   │   ├── CartItem.tsx
│   │   └── CartSummary.tsx
│   ├── checkout/
│   │   ├── CheckoutForm.tsx
│   │   └── OrderSummary.tsx
│   ├── home/
│   │   ├── Hero.tsx
│   │   ├── NewArrivals.tsx
│   │   ├── CategoryGrid.tsx
│   │   ├── LookbookBanner.tsx
│   │   └── InstagramFeed.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Accordion.tsx
│   │   ├── Modal.tsx
│   │   ├── NewsletterForm.tsx
│   │   └── TrustBar.tsx
│   └── animations/
│       ├── FadeIn.tsx
│       ├── StaggerReveal.tsx
│       └── ParallaxImage.tsx
│
├── lib/
│   ├── db.ts                         prisma client
│   ├── stripe.ts                     stripe client
│   ├── cloudinary.ts
│   ├── resend.ts
│   └── utils.ts
│
├── hooks/
│   ├── useCart.ts
│   ├── useWishlist.ts
│   └── useGSAP.ts
│
├── store/
│   └── cartStore.ts                  zustand
│
├── types/
│   ├── product.ts
│   ├── order.ts
│   └── cart.ts
│
├── prisma/
│   └── schema.prisma
│
└── public/
    ├── fonts/
    └── images/
```

---

# NAMING CONVENTIONS

```
Components       PascalCase            ProductCard.tsx
Hooks            camelCase + use       useCart.ts
Utils            camelCase             formatPrice.ts
Types            PascalCase            Product, CartItem
Interfaces       PascalCase            ICheckoutForm
API routes       kebab-case folder     /api/order-confirmed
CSS classes      Tailwind only         no custom class names unless necessary
Constants        SCREAMING_SNAKE       FREE_SHIPPING_THRESHOLD
Env variables    SCREAMING_SNAKE       NEXT_PUBLIC_STRIPE_KEY
```

---

# SPACING SYSTEM

All spacing uses Tailwind's default scale. These are the only values used in this project:

```
4px   → p-1  m-1   (micro — icon padding, tight gaps)
8px   → p-2  m-2   (small — inline element gaps)
12px  → p-3  m-3   (compact — small card padding)
16px  → p-4  m-4   (base — default padding unit)
20px  → p-5  m-5   (medium — form fields)
24px  → p-6  m-6   (comfortable — card padding)
32px  → p-8  m-8   (section element gap)
48px  → p-12 m-12  (section padding mobile)
64px  → p-16 m-16  (section padding desktop)
80px  → p-20 m-20  (large section gap)
96px  → p-24 m-24  (hero padding)
128px → p-32 m-32  (page-level section spacing)
```

### Section Spacing Rules
```
Between major page sections      : gap-20 (80px) mobile / gap-32 (128px) desktop
Inside a section (title → grid)  : gap-8  (32px)
Between cards in a grid          : gap-4  (16px) mobile / gap-6 (24px) desktop
Inside a card                    : p-4    (16px)
Page horizontal padding          : px-4   (16px) mobile / px-8 (32px) tablet / px-16 (64px) desktop
Max content width                : max-w-7xl mx-auto (1280px)
```

---

# TYPOGRAPHY SYSTEM

```
Font Heading : Cormorant Garamond (Google Fonts, weights: 300, 400, 500 italic)
Font Body    : Montserrat         (Google Fonts, weights: 300, 400, 500, 600)
```

### Type Scale
```
Display      : text-7xl  font-light tracking-widest  uppercase   (hero brand name)
H1           : text-5xl  font-light tracking-wide                (page titles)
H2           : text-3xl  font-light tracking-wide                (section titles)
H3           : text-xl   font-medium tracking-normal             (product names, card titles)
H4           : text-base font-medium tracking-wide   uppercase   (labels, categories)
Body Large   : text-lg   font-light  leading-relaxed             (about page copy)
Body         : text-base font-light  leading-relaxed             (general text)
Body Small   : text-sm   font-light  leading-normal              (product meta, captions)
Caption      : text-xs   font-normal tracking-widest uppercase   (badges, tags)
Price        : text-base font-medium                             (product prices)
Price Sale   : text-base font-medium text-red-500  line-through  (original price)
```

### Typography Rules
```
· Never use font-bold on Cormorant — it breaks the elegance
· Headings: Cormorant Garamond
· Body, UI, buttons, prices: Montserrat
· Letter spacing on ALL CAPS text: tracking-widest always
· Line height on long copy: leading-relaxed (1.625) minimum
· Never justify text
· Max line length for reading copy: max-w-prose (65ch)
```

---

# COLOR SYSTEM

Define in tailwind.config.ts:

```ts
colors: {
  notteshe: {
    white:     '#FAFAFA',   // background
    cream:     '#F0EDE8',   // surface / cards
    black:     '#111111',   // primary text
    muted:     '#6B6B6B',   // secondary text
    nude:      '#D4B896',   // accent
    border:    '#E0D9D0',   // dividers, borders
    error:     '#DC2626',   // errors only
  }
}
```

### Usage Rules
```
Page background      : bg-notteshe-white
Card / panel bg      : bg-notteshe-cream
Primary text         : text-notteshe-black
Secondary text       : text-notteshe-muted
Accent (prices, cta) : text-notteshe-nude
Borders / dividers   : border-notteshe-border
Buttons filled       : bg-notteshe-black text-notteshe-white
Buttons outline      : border border-notteshe-black text-notteshe-black
Hover state          : opacity-70 transition-opacity (never change color on hover)
Error states         : text-notteshe-error
```

### Color Rules
```
· Never use raw Tailwind colors (blue-500, red-400) — use notteshe.* only
· No gradients anywhere
· No shadows except: shadow-sm on cards (very subtle)
· Overlays (cart backdrop, modal): bg-notteshe-black/40
```

---

# COMPONENT RULES

### Button Component
```tsx
// Variants only — no custom one-off buttons anywhere
<Button variant="filled">Add to Cart</Button>   // black bg, white text
<Button variant="outline">Shop Now</Button>      // black border, transparent
<Button variant="ghost">View All →</Button>      // text only, no border

// Sizes
<Button size="sm">...</Button>    // text-sm px-4 py-2
<Button size="md">...</Button>    // text-base px-6 py-3  (default)
<Button size="lg">...</Button>    // text-base px-8 py-4

// Rules
· Never set button colors inline — use variants only
· Always include a loading state (spinner) on async buttons
· Full width on mobile: w-full md:w-auto
· Never use <a> styled as a button — use Button with asChild
```

### ProductCard Component
```tsx
// Always includes:
· Product image (portrait ratio 3:4)
· Second image on hover (GSAP crossfade)
· Product name
· Price (and sale price if applicable)
· NEW IN badge (if product.isNew)
· SALE badge (if product.onSale)
· No Add to Cart button on card — click goes to product page
· Wishlist heart icon appears on hover

// Image rules:
· Aspect ratio: aspect-[3/4] always
· Object fit: object-cover
· Loading: lazy below the fold, eager for first 4 products
```

### Accordion Component (FAQ, product details)
```tsx
// Only uses GSAP for animation — no CSS transitions
// Height animates from 0 to auto using GSAP
// Chevron rotates 180deg on open
// One open at a time OR all independent — confirm per use case
```

---

# GSAP ANIMATION RULES

### Setup
```ts
// Always register plugins at the top of the file that uses them
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
```

### useGSAP Hook — Always Use This, Never useEffect for GSAP
```ts
import { useGSAP } from '@gsap/react'

useGSAP(() => {
  // all gsap code here
  // automatic cleanup on unmount
}, { scope: containerRef })
```

### Standard Animation Presets — Use These, Don't Invent New Ones

```ts
// FADE IN UP (products, sections on scroll)
gsap.from(el, {
  y: 40,
  opacity: 0,
  duration: 0.8,
  ease: 'power2.out',
  scrollTrigger: { trigger: el, start: 'top 85%' }
})

// STAGGER GRID (product grid reveal)
gsap.from(cards, {
  y: 40,
  opacity: 0,
  duration: 0.7,
  ease: 'power2.out',
  stagger: 0.08,
  scrollTrigger: { trigger: grid, start: 'top 85%' }
})

// HERO TEXT REVEAL (homepage headline)
gsap.from(words, {
  y: '100%',
  opacity: 0,
  duration: 1,
  ease: 'power3.out',
  stagger: 0.1,
  delay: 0.3
})

// PARALLAX IMAGE (lookbook, about banner)
gsap.to(img, {
  yPercent: -15,
  ease: 'none',
  scrollTrigger: {
    trigger: wrapper,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true
  }
})

// CART DRAWER OPEN
gsap.to(drawer, {
  x: 0,
  duration: 0.5,
  ease: 'power3.out'
})

// CART DRAWER CLOSE
gsap.to(drawer, {
  x: '100%',
  duration: 0.4,
  ease: 'power3.in'
})

// IMAGE HOVER SWAP (product card)
// Uses opacity crossfade between img1 and img2
gsap.to(img1, { opacity: 0, duration: 0.3 })
gsap.to(img2, { opacity: 1, duration: 0.3 })

// COUNT UP (stats on about page)
gsap.to(counter, {
  innerText: targetValue,
  duration: 1.5,
  ease: 'power1.out',
  snap: { innerText: 1 },
  scrollTrigger: { trigger: el, start: 'top 80%', once: true }
})

// ADD TO CART FLY ANIMATION
// Clone product image → fly to cart icon → cart bounces
gsap.to(clone, {
  x: cartX,
  y: cartY,
  scale: 0.1,
  opacity: 0,
  duration: 0.7,
  ease: 'power2.in',
  onComplete: () => { clone.remove(); bounceCartIcon() }
})
```

### Animation Rules
```
· duration: 0.4–1.0s only — nothing slower than 1s for UI
· ease: power2.out for entrances, power2.in for exits, power3.out for hero
· Never use Linear ease for visible animations
· ScrollTrigger start: 'top 85%' for most reveals (feels early enough)
· Always use once: true on scroll animations — never repeat on scroll back
· Respect prefers-reduced-motion:
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) skip GSAP
· Kill all ScrollTriggers in useGSAP cleanup (automatic with hook)
· Never animate layout properties (width, height with margin/padding) — use transform only
```

---

# RESPONSIVE DESIGN

### Breakpoints (Tailwind defaults)
```
sm   : 640px   (large phone landscape)
md   : 768px   (tablet)
lg   : 1024px  (small laptop)
xl   : 1280px  (desktop)
2xl  : 1536px  (large desktop)
```

### Grid Columns Per Breakpoint
```
Product grid    : grid-cols-2 md:grid-cols-3 lg:grid-cols-4
Category grid   : grid-cols-2 md:grid-cols-4
Lookbook grid   : grid-cols-1 md:grid-cols-2
Hero split      : grid-cols-1 md:grid-cols-2
About split     : grid-cols-1 md:grid-cols-2
```

### Mobile-Specific Rules
```
· Bottom navigation bar on mobile (Home, Shop, Wishlist, Cart)
· Cart drawer: full screen on mobile, right panel on desktop
· Product gallery: swipeable on mobile (GSAP Draggable)
· Filter tabs: horizontal scroll on mobile (no wrapping)
· Checkout: single column on mobile
· Font sizes: never below text-sm for readable content
· Tap targets: minimum 44px × 44px (buttons, links)
· No hover-only interactions on mobile
```

---

# STATE MANAGEMENT

```
Cart state       : Zustand (cartStore.ts) — persisted to localStorage
Wishlist state   : Zustand (wishlistStore.ts) — persisted to localStorage
UI state         : React useState (local — drawer open, accordion, filters)
Server state     : Next.js server components + fetch (no client fetching unless needed)
Form state       : React Hook Form
```

### Cart Store Shape
```ts
interface CartStore {
  items: CartItem[]
  isOpen: boolean
  addItem: (product: Product, size: string, color: string) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  total: number
  count: number
}
```

---

# DATA FETCHING RULES

```
· All product data fetched server-side (RSC) — better SEO + performance
· Never fetch products in useEffect — use server components
· Client components only for: cart, wishlist, filter interactions, GSAP
· Use Next.js cache: { revalidate: 3600 } for product pages (1hr)
· Use cache: 'no-store' for cart, orders, user-specific data
· Loading states: use Next.js Suspense + skeleton components
· Error states: use Next.js error.tsx per route segment
```

---

# IMAGE RULES

```
· All product images served through Cloudinary
· Always use Next.js <Image> component — never <img>
· Always set width, height or fill prop
· Product images: aspect-[3/4], object-cover
· Editorial/banner images: aspect-[16/9] or aspect-[21/9]
· Alt text: always descriptive ("Black silk slip dress - front view")
· Lazy loading: loading="lazy" below fold, loading="eager" for LCP images
· Formats: Cloudinary auto-serves WebP/AVIF
· Sizes prop: always set for responsive images
```

---

# FORM RULES

```
· Use React Hook Form for all forms
· Validation: Zod schemas — define in types/
· Error messages: shown inline below each field, never alert()
· Success states: inline confirmation, not a new page (except checkout)
· Email fields: always lowercase, always trim
· Phone fields: international format, optional unless stated
· Required fields: marked with * — explained at top of form
· Submit button: disabled + loading spinner while submitting
· Never clear form on failed submission — preserve user input
```

---

# API ROUTES RULES

```
· All API routes in app/api/
· Always validate request body with Zod before processing
· Always return consistent shape: { success: true, data: {} } or { success: false, error: '' }
· Stripe webhook: verify signature before processing, always return 200 fast
· No sensitive data in client-side code (secret keys, etc.)
· Rate limiting on newsletter + contact form endpoints
```

---

# CHECKOUT & PAYMENTS RULES

```
· Stripe handles all payment processing — never handle raw card data
· Use Stripe Payment Element (handles all payment methods in one UI)
· Server-side: create PaymentIntent, never expose secret key to client
· Webhook: listen for payment_intent.succeeded to confirm orders
· After successful payment: create order in DB → send confirmation email → redirect to /order-confirmed
· Order confirmation email sent via Resend within webhook handler
· Never show card details in order confirmation
```

---

# SEO RULES

```
· Every page has unique <title> and <meta description>
· Use Next.js generateMetadata() for dynamic pages (products, collections)
· Product pages: include product name, price in title
· Images: always have descriptive alt text
· Semantic HTML: h1 only once per page, proper heading hierarchy
· Structured data: Product schema on product pages (JSON-LD)
· Sitemap: auto-generated with next-sitemap
· robots.txt: block /api/, /checkout/, /order-confirmed/
· Canonical URLs: set on all pages
```

---

# PERFORMANCE RULES

```
· Target: Lighthouse score 90+ on all pages
· LCP image (largest on screen): loading="eager", priority on Next/Image
· No layout shift: always set image dimensions
· Fonts: preload Cormorant Garamond + Montserrat in layout.tsx
· GSAP: import only what's used — no full bundle import
· Dynamic imports: use next/dynamic for heavy client components
· No unused Tailwind: purge enabled in production (default)
· Bundle size: run next build and check — no single chunk over 100kb
· API responses: cache aggressively, revalidate on demand
```

---

# ACCESSIBILITY RULES

```
· All images have alt text (empty alt="" for decorative images)
· All interactive elements reachable by keyboard (Tab key)
· Focus visible: never remove outline without a visible replacement
· Color contrast: minimum 4.5:1 for text (check with tailwind-merge)
· Buttons: always have accessible label (aria-label if icon-only)
· Cart drawer: trap focus inside when open, restore on close
· Modal: same focus trap rules as cart drawer
· Accordion: use aria-expanded, aria-controls
· Forms: all inputs have associated <label>
· Skip to content link: first focusable element on every page
· Respect prefers-reduced-motion for all GSAP animations
```

---

# CODE STYLE RULES

```
· TypeScript strict mode — no any, no ts-ignore without explanation
· No default exports for utilities — named exports only
· Components: default export (Next.js convention)
· Props: always typed with interface, never inline type in JSX
· No inline styles — Tailwind classes only
· No magic numbers — define as named constants
· Early return pattern — avoid deeply nested conditionals
· Async functions: always handle errors (try/catch or .catch())
· Console.log: remove before commit — use proper error logging
· Comments: only when WHY is non-obvious (not WHAT)
```

---

# GIT RULES

```
Branches:
  main          production (Vercel auto-deploys)
  dev           active development
  feature/*     new features (feature/cart-drawer)
  fix/*         bug fixes (fix/size-selector-mobile)

Commit messages:
  feat: add cart drawer animation
  fix: correct price display on sale items
  style: adjust product grid spacing on mobile
  refactor: extract size selector into component
  perf: lazy load lookbook images
  chore: update dependencies

Rules:
  · Never commit directly to main
  · Always PR from feature/* → dev → main
  · Run next build before merging to main — no broken builds
  · One feature per branch
```

---

# ENVIRONMENT VARIABLES

```
# .env.local (never commit this file)

# Database
DATABASE_URL=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Resend (email)
RESEND_API_KEY=
EMAIL_FROM=hello@notteshe.com

# App
NEXT_PUBLIC_APP_URL=https://notteshe.com
```

---

# WHAT NOT TO DO

```
· No CSS modules — Tailwind only
· No styled-components or emotion
· No jQuery
· No GSAP paid plugins (SplitText, MorphSVG, DrawSVG, ScrambleText)
· No inline styles (style={{}} in JSX) — exceptions: GSAP transform values only
· No useEffect for data fetching — use server components
· No client components unless interactivity requires it
· No any type in TypeScript
· No <img> tags — always Next.js <Image>
· No hardcoded colors outside tailwind.config.ts
· No setTimeout for animations — use GSAP delay
· No CSS transitions mixed with GSAP on the same property
· No alert(), confirm(), prompt()
· No console.log in production code
```

---

*Notteshe Project Rules · Version 1.0*
*Stack: Next.js · TypeScript · Tailwind · GSAP (free) · Stripe · Prisma · Vercel*
