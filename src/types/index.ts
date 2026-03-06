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
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
