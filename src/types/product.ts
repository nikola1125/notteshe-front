export interface ProductSize {
  label: string;
  available: boolean;
}

export interface ProductColour {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number;
  originalPrice: number | null;
  description: string;
  details: string[];
  sizes: ProductSize[];
  colours: ProductColour[];
  images: string[];        // import paths resolved at data layer
  isNew: boolean;
  isSale: boolean;
  inStock: boolean;
  collection: string;      // e.g. "AW26"
}

export type ProductCategory =
  | "Knitwear"
  | "Outerwear"
  | "Trousers"
  | "Dresses"
  | "Tops"
  | "Accessories";

export type SortOption =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "newest";
