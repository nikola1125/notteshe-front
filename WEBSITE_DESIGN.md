# NOTTESHE — Website Design Concepts & Page Mockups
## Confirmed Direction: Custom Build · Next.js · GSAP · Clean Aesthetic

---

# TECH STACK

```
Framework    : Next.js 14+ (App Router)
Language     : TypeScript
Styling      : Tailwind CSS
Animations   : GSAP (free plugins only)
               └── gsap core
               └── ScrollTrigger  (scroll animations)
               └── ScrollSmoother (smooth scroll)
               └── Flip           (layout transitions)
               └── Draggable      (touch/swipe)
               └── Observer       (scroll/pointer detection)
               └── EasePack       (extra easing curves)
Payments     : Stripe (cards, Apple Pay, Google Pay)
Database     : Prisma + PostgreSQL  OR  Sanity (headless CMS)
Images       : Cloudinary (optimization for hi-res fashion photos)
Emails       : Resend / Nodemailer (order confirm, shipping, etc.)
Hosting      : Vercel
```

---

# DESIGN SYSTEM

## Colors
```
Background   : #FAFAFA  off white
Surface      : #F0EDE8  warm cream
Text Primary : #111111  near black
Text Muted   : #6B6B6B  mid grey
Accent       : #D4B896  nude tan
Border       : #E0D9D0  soft line
```

## Typography
```
Heading  : Cormorant Garamond Italic  (thin, dramatic, elegant)
Subhead  : Montserrat Light           (clean geometric sans)
Body     : Montserrat Regular
```

## Buttons
```
Primary   : filled black, sharp corners
Secondary : outlined, transparent background
Ghost     : text only with arrow  →
```

## Design Rules
```
· White/cream background everywhere
· Generous spacing — let the content breathe
· Max 3 elements per row on desktop
· Photography is always the hero — images large, never awkward
· GSAP only for meaningful animations (scroll reveals, transitions)
· No animations for decoration — every motion has a purpose
· Thumbnail hover → second image (model wearing product)
· No page reloads for filtering, cart, or FAQ accordions
```

---

# GSAP ANIMATION MAP

| Page | Element | Animation |
|---|---|---|
| Homepage | Hero text | Letter stagger reveal on load |
| Homepage | Products | Fade + rise on scroll (stagger) |
| Homepage | Stats (About) | Count up on scroll enter |
| Homepage | Full-width images | Subtle parallax on scroll |
| Shop | Filter switch | Products fade out/in (GSAP Flip) |
| Product | Thumbnail click | Main image crossfade |
| Product | Add to Cart | Item flies to cart icon |
| Product | Cart count | Bounce increment |
| Cart | Drawer open | Slide in from right |
| Cart | Background | Dim smoothly behind drawer |
| Lookbook | Each section | Fade in on scroll |
| About | BTS photos | Stagger reveal on scroll |
| FAQ | Accordion rows | Smooth expand/collapse |
| All pages | Page enter | Gentle fade in |

---

# THREE DESIGN CONCEPTS

## CONCEPT 1 — "FIRE & BLACK"
```
Colors    : #0D0D0D black · #E8420A fire orange · #FFFFFF white
Fonts     : Bebas Neue headings · Inter body
Feel      : Mugler · Nensi Dojaka · Unapologetic · Dramatic
```

## CONCEPT 2 — "CLEAN EDITORIAL" ← Chosen Direction
```
Colors    : #FAFAFA white · #111111 black · #D4B896 nude tan
Fonts     : Cormorant Garamond headings · Inter body
Feel      : Toteme · Jacquemus · Timeless · Never trendy
```

## CONCEPT 3 — "NIGHT ROSE"
```
Colors    : #12060E dark · #B76E79 rose gold · #FAF0F0 ivory
Fonts     : Playfair Display headings · Inter body
Feel      : House of CB · Nensi Dojaka · Feminine power
```

---

# PAGE MOCKUPS

## 01 — HOMEPAGE
```
┌─────────────────────────────────────────────────────────────────┐
│  🚚  Free worldwide shipping on orders over €120                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────┬───────────────────────────────┐  │
│  │                           │                               │  │
│  │                           │    The Summer                 │  │
│  │   [campaign photo —       │    Collection.                │  │
│  │    model, full height,    │                               │  │
│  │    natural light]         │    Pieces made for the        │  │
│  │                           │    woman who owns the room.   │  │
│  │                           │                               │  │
│  │                           │    Shop Now  →                │  │
│  │                           │                               │  │
│  └───────────────────────────┴───────────────────────────────┘  │
│                                                                 │
│                         NEW IN                                  │
│                   ───────────────                               │
│                                                                 │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐               │
│   │           │   │           │   │           │               │
│   │ [dress 1] │   │ [dress 2] │   │ [dress 3] │               │
│   │           │   │           │   │           │               │
│   │ Silk Slip │   │ Lace Mini │   │ Flame     │               │
│   │ €89       │   │ €140      │   │ €195      │               │
│   └───────────┘   └───────────┘   └───────────┘               │
│                                                                 │
│                        View All  →                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  [full width editorial photo — horizontal, wide crop]   │   │
│  │                                                         │   │
│  │                    The Lookbook                         │   │
│  │                    Summer 2025                          │   │
│  │                    Explore  →                           │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                      SHOP BY CATEGORY                          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  [img]   │  │  [img]   │  │  [img]   │  │  [img]   │       │
│  │ DRESSES  │  │ SWIMWEAR │  │   SETS   │  │   HATS   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│       Be the first to know about new drops.                    │
│       [ your@email.com _____________________]  Subscribe →     │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ [ig] │ │ [ig] │ │ [ig] │ │ [ig] │ │ [ig] │ │ [ig] │       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
│                      @notteshe                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  NOTTESHE          Shop    About    Contact    Returns          │
│  Tirana, Albania · Worldwide Shipping     [IG]  [TT]  [FB]     │
│  © 2025 Notteshe                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 02 — SHOP / ALL PRODUCTS
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  All Products                                    24 items      │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  [ Dresses ]  [ Swimwear ]  [ Sets ]  [ Hats ]  [ Sale ]       │
│    ← filter tabs, click to filter, no page reload               │
│                                                                 │
│  Sort by: Newest ▾                          [ ⊞ ]  [ ⊟ ]      │
│                                         4-col   2-col toggle   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │          │  │ NEW IN   │  │          │  │          │       │
│  │ [dress]  │  │ [dress]  │  │ [dress]  │  │ [dress]  │       │
│  │ Silk Slip│  │ Lace Mini│  │ Flame    │  │ Stripe   │       │
│  │ €89      │  │ €140     │  │ €195     │  │ Set €120 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │          │  │          │  │ SALE     │  │          │       │
│  │ [dress]  │  │  [hat]   │  │ [bikini] │  │ [dress]  │       │
│  │ Floral   │  │ Cowboy   │  │ ~~€65~~  │  │ Satin    │       │
│  │ €110     │  │ Hat €45  │  │ €45      │  │ €160     │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│                    Load More  ↓                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

NOTES:
· Hover on any product → second image appears (model wearing it)
· NEW IN / SALE badges auto-show from product tags
· Filter tabs animate products in/out with GSAP (no page reload)
· Toggle between 4-col and 2-col grid
```

---

## 03 — PRODUCT DETAIL PAGE
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Home  /  Dresses  /  Silk Slip Dress                          │
│                                                                 │
│  ┌──────────────────────────┬──────────────────────────────┐   │
│  │                          │                              │   │
│  │                          │  Silk Slip Dress             │   │
│  │                          │  ─────────────────           │   │
│  │   [MAIN PRODUCT IMAGE    │  €89.00                      │   │
│  │    tall, portrait,       │                              │   │
│  │    white background]     │  Size                        │   │
│  │                          │  ┌──┐  ┌──┐  ┌──┐  ┌──┐    │   │
│  │                          │  │XS│  │ S│  │ M│  │ L│    │   │
│  │                          │  └──┘  └──┘  └──┘  └──┘    │   │
│  │                          │                              │   │
│  │                          │  Color                       │   │
│  │                          │  ● Black   ○ Ivory           │   │
│  │                          │                              │   │
│  │                          │  ┌────────────────────────┐  │   │
│  │                          │  │      ADD TO CART        │  │   │
│  │                          │  └────────────────────────┘  │   │
│  │                          │  ♡  Save to Wishlist         │   │
│  │                          │                              │   │
│  │                          │  ✓  Free shipping over €120  │   │
│  │                          │  ✓  Free returns · 14 days   │   │
│  │                          │  ✓  Ships within 48 hours    │   │
│  │                          │                              │   │
│  │                          │  Details                 +   │   │
│  │                          │  ─────────────────────────   │   │
│  │                          │  Fabric & Care           +   │   │
│  │                          │  ─────────────────────────   │   │
│  │                          │  Shipping & Returns      +   │   │
│  │                          │                              │   │
│  │                          │  Size Guide  →               │   │
│  │                          │                              │   │
│  └──────────────────────────┴──────────────────────────────┘   │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐                               │
│  │img │  │img │  │img │  │img │  ← thumbnail strip            │
│  └────┘  └────┘  └────┘  └────┘                               │
│                                                                 │
│                   YOU MAY ALSO LIKE                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ [dress]  │  │ [dress]  │  │  [set]   │  │ [dress]  │       │
│  │ Lace Mini│  │ Satin    │  │ Stripe   │  │ Ruffle   │       │
│  │ €140     │  │ €160     │  │ Set €120 │  │ €88      │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│                    CUSTOMER REVIEWS                            │
│                    ★★★★★  4.9 · 38 reviews                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ★★★★★  Arta K. · Tirana                               │   │
│  │  "Absolutely stunning. Wore it to a dinner and got      │   │
│  │   compliments all night. True to size, very elegant."   │   │
│  │  [customer photo wearing the dress]                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

NOTES:
· Thumbnail click → main image swaps with GSAP crossfade
· Accordion sections expand/collapse smoothly
· Size Guide opens as popup overlay (no page change)
· ADD TO CART → item flies to cart icon with GSAP
· Cart count increments with bounce animation
```

---

## 04 — CART (slide-out panel)
```
┌─────────────────────────────────────────────────────────────────┐
│  [dimmed page content behind]          ┌───────────────────────┐│
│                                        │  Your Cart  (2)    ×  ││
│                                        │  ─────────────────    ││
│                                        │  ┌─────────────────┐  ││
│                                        │  │ [img] Silk Slip  │  ││
│                                        │  │       Black · S  │  ││
│                                        │  │       €89.00     │  ││
│                                        │  │  − 1 +    🗑     │  ││
│                                        │  └─────────────────┘  ││
│                                        │  ┌─────────────────┐  ││
│                                        │  │ [img] Cowboy Hat │  ││
│                                        │  │       Natural    │  ││
│                                        │  │       €45.00     │  ││
│                                        │  │  − 1 +    🗑     │  ││
│                                        │  └─────────────────┘  ││
│                                        │  [ Discount code ]    ││
│                                        │  Apply  →             ││
│                                        │  ─────────────────    ││
│                                        │  Subtotal    €134.00  ││
│                                        │  Shipping    FREE     ││
│                                        │  ┌─────────────────┐  ││
│                                        │  │   CHECKOUT  →   │  ││
│                                        │  └─────────────────┘  ││
│                                        │  Continue Shopping ←  ││
│                                        └───────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

NOTES:
· Slides in from right with GSAP — no new page
· Background dims smoothly behind
· Quantity +/- updates total in real time
· FREE label appears automatically when over threshold
```

---

## 05 — CHECKOUT
```
┌─────────────────────────────────────────────────────────────────┐
│                       NOTTESHE                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┬──────────────────────────┐   │
│  │  Contact                     │  ORDER SUMMARY           │   │
│  │  Email ___________________   │  ─────────────────────   │   │
│  │                              │  ┌────┐  Silk Slip · S   │   │
│  │  Delivery                    │  │img │  Black      €89  │   │
│  │  First name _____            │  └────┘                  │   │
│  │  Last name  _____            │  ┌────┐  Cowboy Hat      │   │
│  │  Address __________________  │  │img │  Natural    €45  │   │
│  │  City    __________________  │  └────┘                  │   │
│  │  Country ▾  Postcode ______  │  ─────────────────────   │   │
│  │  Phone ___________________   │  Subtotal       €134     │   │
│  │                              │  Shipping       FREE     │   │
│  │  Payment                     │  TOTAL          €134     │   │
│  │  [●] Card                    │                          │   │
│  │  ┌──────────────────────┐    │                          │   │
│  │  │ Card number          │    │                          │   │
│  │  └──────────────────────┘    │                          │   │
│  │  ┌────────────┐ ┌────────┐   │                          │   │
│  │  │ MM / YY    │ │  CVC   │   │                          │   │
│  │  └────────────┘ └────────┘   │                          │   │
│  │  [○] PayPal                  │                          │   │
│  │  [○] Apple Pay               │                          │   │
│  │  ┌──────────────────────┐    │                          │   │
│  │  │    PLACE ORDER →     │    │                          │   │
│  │  └──────────────────────┘    │                          │   │
│  │  🔒 Secure checkout          │                          │   │
│  └──────────────────────────────┴──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

NOTES:
· No header navigation — zero distractions at checkout
· Order summary always visible on the right
· Payment method switches with smooth GSAP transition
```

---

## 06 — ORDER CONFIRMATION
```
┌─────────────────────────────────────────────────────────────────┐
│                       NOTTESHE                                  │
├─────────────────────────────────────────────────────────────────┤
│                           ✓                                     │
│                   Order Confirmed                               │
│              Thank you, Arta.                                   │
│              Your order is on its way.                          │
│                                                                 │
│  Order #NTS-20251                      27 July 2025            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ┌────┐  Silk Slip Dress · Black · S               €89  │   │
│  │  └────┘                                                  │   │
│  │  ┌────┐  Cowboy Hat · Natural                      €45  │   │
│  │  └────┘                                                  │   │
│  │  Total                                            €134  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Shipping to: Tirana, Albania     Delivery: 3–5 business days  │
│                                                                 │
│  Confirmation sent to arta@email.com                           │
│                                                                 │
│                  [ CONTINUE SHOPPING ]                         │
│                                                                 │
│                    YOU MIGHT ALSO LOVE                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ [dress]  │  │ [dress]  │  │  [set]   │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 07 — ABOUT PAGE
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│                    NOTTESHE                                     │
│                    Grua e fortë.                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [full width editorial photo — wide, cinematic crop]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────┬──────────────────────────────┐   │
│  │  [founder / studio photo │  The Story                   │   │
│  │   in Tirana]             │  ───────────────             │   │
│  │                          │  Notteshe was born in        │   │
│  │                          │  Tirana from a simple idea:  │   │
│  │                          │  that Albanian women         │   │
│  │                          │  deserve fashion that        │   │
│  │                          │  matches their strength.     │   │
│  │                          │                              │   │
│  │                          │  Every piece is designed     │   │
│  │                          │  with intention — for the    │   │
│  │                          │  woman who walks into a      │   │
│  │                          │  room and owns it.           │   │
│  └──────────────────────────┴──────────────────────────────┘   │
│                                                                 │
│        Made in Albania       Small Batch        Worldwide      │
│        Every piece           Limited runs.      Shipping       │
│        designed &            Never mass         to 50+         │
│        produced in           produced.          countries.     │
│        Tirana.                                                  │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ [bts img]│  │ [bts img]│  │ [bts img]│                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│  Behind the scenes — Tirana studio                             │
│                                                                 │
│                    Shop the Collection  →                       │
└─────────────────────────────────────────────────────────────────┘

NOTES:
· Stats count up with GSAP when scrolled into view
· Full-width photo has subtle parallax scroll
· BTS photos stagger reveal on scroll
```

---

## 08 — CONTACT PAGE
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│              Get in touch.                                      │
│              We'd love to hear from you.                        │
│                                                                 │
│  ┌──────────────────────────┬──────────────────────────────┐   │
│  │  Name  _________________  │  hello@notteshe.com          │   │
│  │  Email _________________  │  📍 Tirana, Albania          │   │
│  │                           │                              │   │
│  │  Subject                 │  💬 WhatsApp  →               │   │
│  │  ○ Order enquiry         │                              │   │
│  │  ○ Returns               │  Response within 24 hours    │   │
│  │  ○ Wholesale             │  Mon – Fri, 9am – 6pm        │   │
│  │  ○ Press & Media         │                              │   │
│  │  ○ Other                 │  [IG]  [TT]  [FB]            │   │
│  │                          │  @notteshe                   │   │
│  │  Message                 │                              │   │
│  │  ┌──────────────────┐    │                              │   │
│  │  │                  │    │                              │   │
│  │  └──────────────────┘    │                              │   │
│  │  [ Send Message → ]      │                              │   │
│  └──────────────────────────┴──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 09 — LOOKBOOK PAGE
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│                    THE LOOKBOOK                                 │
│                    Summer 2025                                  │
│                    Tirana — Adriatic                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   [FULL WIDTH hero — editorial, cinematic, wide crop]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────┬──────────────────────────────┐   │
│  │  [model in flame dress]  │  [model in silk slip]        │   │
│  └──────────────────────────┴──────────────────────────────┘   │
│                                                                 │
│                  For the woman who owns the room.               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [full width — model at Tirana location, wide]          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────┐  ┌──────────────────────────┐  ┌──────────┐      │
│  │  [img]   │  │  [large center image]    │  │  [img]   │      │
│  └──────────┘  └──────────────────────────┘  └──────────┘      │
│                                                                 │
│  ┌──────────────────────────┬──────────────────────────────┐   │
│  │  [model in flame dress   │  Flame Maxi Dress            │   │
│  │   editorial shot]        │  €195                        │   │
│  │                          │                              │   │
│  │                          │  The piece that started      │   │
│  │                          │  everything.                 │   │
│  │                          │                              │   │
│  │                          │  Shop This Look  →           │   │
│  └──────────────────────────┴──────────────────────────────┘   │
│                    Shop the Summer Collection  →               │
└─────────────────────────────────────────────────────────────────┘

NOTES:
· Each section fades in on scroll — GSAP ScrollTrigger
· "Shop This Look" links directly to that product page
· Alternating image/text layout keeps the eye moving
· Quote text fades in slowly between photo sections
```

---

## 10 — COLLECTION LANDING (Summer Collection)
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [full width banner — summer editorial, wide crop]      │   │
│  │           THE SUMMER COLLECTION  2025                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Pieces for the sun. Designed in Tirana. Worn worldwide.       │
│                                                                 │
│  [ All ]  [ Dresses ]  [ Swimwear ]  [ Sets ]  [ Hats ]        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ [dress]  │  │ [dress]  │  │ [bikini] │  │  [hat]   │       │
│  │ Flame    │  │ Floral   │  │ Bikini   │  │ Cowboy   │       │
│  │ €195     │  │ €110     │  │ Set €65  │  │ Hat €45  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  [set]   │  │ [dress]  │  │ [dress]  │  │  [set]   │       │
│  │ Stripe   │  │ Satin    │  │ Halter   │  │ Linen    │       │
│  │ Set €120 │  │ €160     │  │ €95      │  │ Set €130 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11 — SIZE GUIDE
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│                      Size Guide                                 │
│                                                                 │
│  [ Dresses & Sets ]   [ Swimwear ]   [ Hats ]                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         XS        S        M        L        XL         │   │
│  │  EU      34       36       38       40       42         │   │
│  │  UK       6        8       10       12       14         │   │
│  │  US       2        4        6        8       10         │   │
│  │  Bust   80cm     84cm     88cm     93cm     98cm        │   │
│  │  Waist  60cm     64cm     68cm     73cm     78cm        │   │
│  │  Hips   86cm     90cm     94cm     99cm    104cm        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────┬──────────────────────────────┐   │
│  │  [measuring illustration]│  Bust — fullest part         │   │
│  │                          │  Waist — narrowest part      │   │
│  │                          │  Hips — fullest part         │   │
│  │                          │                              │   │
│  │                          │  Between sizes? Size up.     │   │
│  └──────────────────────────┴──────────────────────────────┘   │
│  Questions? Contact us  →                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12 — FAQ / SHIPPING & RETURNS
```
┌─────────────────────────────────────────────────────────────────┐
│       Shop ▾      Collections ▾      Lookbook      About       │
│                       NOTTESHE                          🛒  2  │
├─────────────────────────────────────────────────────────────────┤
│                   Help & FAQs                                   │
│                                                                 │
│  [ Orders & Shipping ]   [ Returns ]   [ Sizing ]   [ Other ]  │
│                                                                 │
│  How long does delivery take?                               +   │
│  ─────────────────────────────────────────────────────────     │
│  Albania: 1–3 business days                                     │
│  Europe: 3–7 business days                                      │
│  Worldwide: 5–14 business days                                  │
│                                                                 │
│  How much does shipping cost?                               +   │
│  ─────────────────────────────────────────────────────────     │
│  Do you accept returns?                                     +   │
│  ─────────────────────────────────────────────────────────     │
│  Can I change or cancel my order?                           +   │
│  ─────────────────────────────────────────────────────────     │
│  What sizes do you carry?                                   +   │
│  ─────────────────────────────────────────────────────────     │
│  How do I track my order?                                   +   │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  Still need help?                                              │
│  [ Contact Us → ]    [ WhatsApp → ]                            │
└─────────────────────────────────────────────────────────────────┘

NOTES:
· Each row expands/collapses with GSAP smooth animation
· Tab switching filters questions without page reload
```

---

# GLOBAL DESIGN RULES

| Rule | Detail |
|---|---|
| Background | White / off-white everywhere |
| Spacing | Generous — content breathes |
| Grid | Max 4 columns desktop, 2 mobile |
| Images | Large, never cropped awkwardly |
| Hover | Product → shows model wearing it |
| Animations | Only meaningful — reveals, transitions |
| Navigation | No full page reloads for cart, filters, FAQ |
| Typography | Large headings, light body text |
| Mobile | Bottom nav bar, swipe gestures on gallery |
| Checkout | No navigation shown — zero distractions |

---

*Notteshe Website Design Document · Version 1.0*
*Stack: Next.js · TypeScript · Tailwind · GSAP (free) · Stripe · Vercel*
