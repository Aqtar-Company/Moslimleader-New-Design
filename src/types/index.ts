export interface ProductVariant {
  id: string;
  name: string;      // e.g. "أحمر"
  nameEn?: string;   // e.g. "Red"
  imageIndex: number; // which index in product.images[] to show
}

export interface Review {
  id: string;
  author: string;
  rating: number; // 1-5
  comment: string;
  commentEn?: string;
  date: string; // ISO date string
  verified?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  shortDescription: string;
  shortDescriptionEn?: string;
  description: string;
  descriptionEn?: string;
  price: number; // EGP price
  priceUsd: number; // USD price
  category: string;
  subcategory?: string;
  variants?: ProductVariant[]; // selectable models (colors, shapes, etc.)
  tags: string[];
  images: string[];
  inStock: boolean;
  featured?: boolean;
  videos?: string[];
  videoUrl?: string | null;
  weight: number; // grams
  reviews?: Review[];
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

export interface CartItem {
  cartItemId: string; // unique: productId or productId-modelIndex
  product: Product;
  quantity: number;
  selectedModel?: number; // index of selected model image (for mugs)
}
