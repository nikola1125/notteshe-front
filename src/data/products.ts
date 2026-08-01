import type { Product } from "@/types/product";

import bg1 from "@/assets/bg1.jpg";
import bg2 from "@/assets/bg2.jpg";
import bg3 from "@/assets/bg3.jpg";
import bg4 from "@/assets/bg4.jpg";
import bg5 from "@/assets/bg5.jpg";
import bg6 from "@/assets/bg6.jpg";
import bg7 from "@/assets/bg7.jpg";
import bg8 from "@/assets/bg8.jpg";
import p1 from "@/assets/p1.jpg";
import p2 from "@/assets/p2.jpg";
import p3 from "@/assets/p3.jpg";
import p4 from "@/assets/p4.jpg";

const SIZES_XS_XL: Product["sizes"] = [
  { label: "XS", available: true },
  { label: "S",  available: true },
  { label: "M",  available: true },
  { label: "L",  available: true },
  { label: "XL", available: false },
];

const SIZES_ONE_SIZE: Product["sizes"] = [
  { label: "One Size", available: true },
];

export const products: Product[] = [
  {
    id: "1",
    slug: "wool-overshirt",
    name: "Wool Overshirt",
    category: "Outerwear",
    price: 248,
    originalPrice: null,
    description:
      "A structured overshirt in heavyweight Italian wool. Designed to be worn as a light layer or on its own — the cut sits just below the hip, with a single chest pocket and clean horn buttons.",
    details: [
      "100% Italian merino wool",
      "Relaxed fit — model wears size S",
      "Length 74cm (size S)",
      "Dry clean only",
      "Made in Italy",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Ecru",    hex: "#E8E0D4" },
      { name: "Slate",   hex: "#8C9099" },
      { name: "Tobacco", hex: "#7A5C3E" },
    ],
    images: [bg1, bg2],
    isNew: true,
    isSale: false,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "2",
    slug: "silk-slip-dress",
    name: "Silk Slip Dress",
    category: "Dresses",
    price: 139,
    originalPrice: 198,
    description:
      "Cut from pure habotai silk, this slip dress moves with an effortless weight. Bias-cut through the body, with thin adjustable straps and a clean cowl back.",
    details: [
      "100% silk habotai",
      "Bias cut — model wears size S",
      "Length 112cm (size S)",
      "Hand wash cold",
      "Made in Japan",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Ivory",  hex: "#F2EDE6" },
      { name: "Blush",  hex: "#D4A99A" },
      { name: "Ebony",  hex: "#1C1C1C" },
      { name: "Sage",   hex: "#8A9E84" },
    ],
    images: [bg2, bg3],
    isNew: false,
    isSale: true,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "3",
    slug: "ribbed-turtleneck",
    name: "Ribbed Turtleneck",
    category: "Knitwear",
    price: 164,
    originalPrice: null,
    description:
      "A fine-rib turtleneck in 100% Scottish cashmere. Slim through the body with a high, folded neck. The kind of piece that asks nothing of you.",
    details: [
      "100% Scottish cashmere, 2-ply",
      "Slim fit — model wears size S",
      "Length 60cm (size S)",
      "Hand wash cold or dry clean",
      "Made in Scotland",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Ecru",   hex: "#E8E0D4" },
      { name: "Camel",  hex: "#C09B6A" },
    ],
    images: [bg3, bg4],
    isNew: true,
    isSale: false,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "4",
    slug: "tailored-trouser",
    name: "Tailored Trouser",
    category: "Trousers",
    price: 149,
    originalPrice: 212,
    description:
      "A wide-leg trouser in Japanese wool-blend suiting. High-waisted with a clean flat front, single back welt pocket, and a break that grazes the floor.",
    details: [
      "72% wool, 28% polyester",
      "Wide-leg, high-waist fit",
      "Inseam 82cm (size S)",
      "Dry clean only",
      "Made in Japan",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Charcoal", hex: "#4A4A4A" },
      { name: "Camel",    hex: "#C09B6A" },
      { name: "Ivory",    hex: "#F2EDE6" },
    ],
    images: [bg4, bg1],
    isNew: false,
    isSale: true,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "5",
    slug: "cashmere-coat",
    name: "Cashmere Coat",
    category: "Outerwear",
    price: 320,
    originalPrice: 580,
    description:
      "A single-breasted coat in 90% cashmere. Structured shoulders, notched lapels, and a belt that ties — not buckles. Cut long to the mid-calf.",
    details: [
      "90% cashmere, 10% silk",
      "Relaxed fit — model wears size S",
      "Length 118cm (size S)",
      "Dry clean only",
      "Made in Italy",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Camel",  hex: "#C09B6A" },
      { name: "Black",  hex: "#111111" },
    ],
    images: [bg5, bg6],
    isNew: false,
    isSale: true,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "6",
    slug: "linen-wide-trouser",
    name: "Linen Wide Trouser",
    category: "Trousers",
    price: 98,
    originalPrice: 164,
    description:
      "Washed Belgian linen trousers with an easy, wide leg. Elasticated at the back of the waist for comfort without sacrificing the clean front silhouette.",
    details: [
      "100% Belgian linen, washed",
      "Wide-leg, mid-rise fit",
      "Inseam 78cm (size S)",
      "Machine wash 30°",
      "Made in Portugal",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Sand",   hex: "#D4C5A9" },
      { name: "White",  hex: "#F7F5F2" },
      { name: "Slate",  hex: "#8C9099" },
    ],
    images: [bg6, bg5],
    isNew: false,
    isSale: true,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "7",
    slug: "silk-blouse",
    name: "Silk Blouse",
    category: "Tops",
    price: 112,
    originalPrice: 198,
    description:
      "A relaxed silk blouse with a slightly oversized cut. Dropped shoulders, a single breast pocket, and a rounded hem that works tucked or untucked.",
    details: [
      "100% silk charmeuse",
      "Relaxed fit — model wears size S",
      "Length 68cm (size S)",
      "Hand wash cold",
      "Made in Italy",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Ivory", hex: "#F2EDE6" },
      { name: "Clay",  hex: "#C0704A" },
      { name: "Slate", hex: "#8C9099" },
      { name: "Ebony", hex: "#1C1C1C" },
    ],
    images: [bg7, bg8],
    isNew: false,
    isSale: true,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "8",
    slug: "merino-roll-neck",
    name: "Merino Roll-Neck",
    category: "Knitwear",
    price: 89,
    originalPrice: 148,
    description:
      "An extra-fine merino roll-neck. Lightweight enough to layer under a coat, warm enough to wear alone. The cuffs and hem are finished with a clean single rib.",
    details: [
      "100% extra-fine merino wool",
      "Slim fit — model wears size S",
      "Length 58cm (size S)",
      "Machine wash 30°",
      "Made in Italy",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Ecru",    hex: "#E8E0D4" },
      { name: "Tobacco", hex: "#7A5C3E" },
    ],
    images: [bg8, bg7],
    isNew: false,
    isSale: true,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "9",
    slug: "oversized-linen-shirt",
    name: "Oversized Linen Shirt",
    category: "Tops",
    price: 118,
    originalPrice: null,
    description:
      "A generously cut shirt in stonewashed Italian linen. The collar is soft and unlined, the placket is plain, and the back yoke drops slightly for ease of movement.",
    details: [
      "100% Italian linen, stonewashed",
      "Oversized fit — model wears size S",
      "Length 80cm (size S)",
      "Machine wash 30°",
      "Made in Italy",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "White",  hex: "#F7F5F2" },
      { name: "Sand",   hex: "#D4C5A9" },
    ],
    images: [p1, p2],
    isNew: true,
    isSale: false,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "10",
    slug: "wide-leg-denim",
    name: "Wide-Leg Denim",
    category: "Trousers",
    price: 178,
    originalPrice: null,
    description:
      "Japanese selvedge denim in a wide, easy cut. Mid-rise with a straight leg that opens slightly at the hem. Fades beautifully with wear.",
    details: [
      "100% Japanese selvedge denim, 12oz",
      "Wide-leg, mid-rise fit",
      "Inseam 80cm (size S)",
      "Machine wash cold, inside out",
      "Made in Japan",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Indigo", hex: "#3B4A6B" },
      { name: "Ecru",   hex: "#E8E0D4" },
    ],
    images: [p2, p3],
    isNew: true,
    isSale: false,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "11",
    slug: "knit-midi-dress",
    name: "Knit Midi Dress",
    category: "Dresses",
    price: 212,
    originalPrice: null,
    description:
      "A fine-rib knit dress in extra-fine merino. Midi length, long sleeves, and a subtle V-neck that adds refinement without exposure. Wear it alone or over a silk slip.",
    details: [
      "100% extra-fine merino wool",
      "Slim fit — model wears size S",
      "Length 110cm (size S)",
      "Hand wash cold",
      "Made in Italy",
    ],
    sizes: SIZES_XS_XL,
    colours: [
      { name: "Ebony",   hex: "#1C1C1C" },
      { name: "Tobacco", hex: "#7A5C3E" },
    ],
    images: [p3, p4],
    isNew: true,
    isSale: false,
    inStock: true,
    collection: "AW26",
  },
  {
    id: "12",
    slug: "canvas-tote",
    name: "Canvas Tote",
    category: "Accessories",
    price: 68,
    originalPrice: null,
    description:
      "A structured tote in heavy cotton canvas. Two interior pockets, a zip closure, and handles long enough to carry over the shoulder. Screen-printed with the Notteshe wordmark.",
    details: [
      "100% heavy cotton canvas, 16oz",
      "Dimensions: 38 × 32 × 14cm",
      "Spot clean only",
      "Made in Portugal",
    ],
    sizes: SIZES_ONE_SIZE,
    colours: [
      { name: "Ecru",  hex: "#E8E0D4" },
      { name: "Black", hex: "#111111" },
    ],
    images: [p4, p1],
    isNew: true,
    isSale: false,
    inStock: true,
    collection: "AW26",
  },
];

export const getProductBySlug = (slug: string): Product | undefined =>
  products.find((p) => p.slug === slug);

export const getProductsByCategory = (category: string): Product[] =>
  products.filter((p) => p.category === category);

export const getSaleProducts = (): Product[] =>
  products.filter((p) => p.isSale);

export const getNewProducts = (): Product[] =>
  products.filter((p) => p.isNew);
