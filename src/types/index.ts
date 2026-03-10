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
  price: number;
  category: string;
  tags: string[];
  images: string[];
  inStock: boolean;
  featured?: boolean;
  videos?: string[];
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
