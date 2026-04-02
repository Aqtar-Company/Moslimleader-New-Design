import { Product, ProductVariant, Review } from '@/types';
import { DEFAULT_COUPONS } from './admin-config';
import { governorates } from './shipping';
import { RegionalPricing } from './geo-pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminOrder {
  id: string;
  date: string;
  total: number;
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  orderCount: number;
}

export interface AdminReview {
  id: string;
  productId: string;
  productName: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  isHardcoded?: boolean; // true = from products.ts, false = user-submitted
}

export interface ProductOverride {
  price?: number;
  inStock?: boolean;
  name?: string;
  nameEn?: string;
  shortDescription?: string;
  shortDescriptionEn?: string;
  description?: string;
  descriptionEn?: string;
  category?: string;
  variants?: ProductVariant[];
  images?: string[];
  weight?: number;
  tags?: string[];
  regionalPricing?: RegionalPricing;
}

// ─── Regional Pricing Overrides ───────────────────────────────────────────────

export function getRegionalPricing(productId: string): RegionalPricing | null {
  const overrides = getProductOverrides();
  return overrides[productId]?.regionalPricing ?? null;
}

export function setRegionalPricing(productId: string, pricing: RegionalPricing) {
  setProductOverride(productId, { regionalPricing: pricing });
}

// ─── Coupons ──────────────────────────────────────────────────────────────────

export function getCoupons(): Record<string, number> {
  try {
    const saved = localStorage.getItem('ml-coupons');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_COUPONS };
}

export function saveCoupons(coupons: Record<string, number>) {
  localStorage.setItem('ml-coupons', JSON.stringify(coupons));
}

export function addCoupon(code: string, pct: number) {
  const coupons = getCoupons();
  coupons[code.toUpperCase().trim()] = pct;
  saveCoupons(coupons);
}

export function deleteCoupon(code: string) {
  const coupons = getCoupons();
  delete coupons[code];
  saveCoupons(coupons);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function getAddedCategories(): string[] {
  try {
    const raw = localStorage.getItem('ml-categories-added');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveAddedCategories(cats: string[]) {
  localStorage.setItem('ml-categories-added', JSON.stringify(cats));
}

// ─── Users & Orders ───────────────────────────────────────────────────────────

export function getAllUsers(): AdminUser[] {
  try {
    const raw = localStorage.getItem('ml_users');
    if (!raw) return [];
    const users: Record<string, { password: string; user: { id: string; name: string; email: string; phone?: string } }> = JSON.parse(raw);
    return Object.values(users).map(({ user }) => {
      const orders = getUserOrders(user.id);
      return { id: user.id, name: user.name, email: user.email, phone: user.phone, orderCount: orders.length };
    });
  } catch { return []; }
}

export function getUserOrders(userId: string): AdminOrder[] {
  try {
    const raw = localStorage.getItem(`ml_orders_${userId}`);
    if (!raw) return [];
    const orders: { id: string; date: string; total: number; status: string }[] = JSON.parse(raw);
    const userRaw = localStorage.getItem('ml_users');
    let userName = '';
    let userEmail = '';
    if (userRaw) {
      type UserEntry = { password: string; user: { id: string; name: string; email: string; phone?: string } };
      const users: Record<string, UserEntry> = JSON.parse(userRaw);
      const found = Object.values(users).find(u => u.user.id === userId);
      if (found) { userName = found.user.name; userEmail = found.user.email; }
    }
    const statusOverrides = getOrderStatusOverrides();
    return orders.map(o => ({
      ...o,
      status: statusOverrides[o.id] || o.status,
      userId,
      userName,
      userEmail,
    }));
  } catch { return []; }
}

export function getAllOrders(): AdminOrder[] {
  try {
    const raw = localStorage.getItem('ml_users');
    if (!raw) return [];
    const users: Record<string, { password: string; user: { id: string } }> = JSON.parse(raw);
    const all: AdminOrder[] = [];
    Object.values(users).forEach(({ user }) => {
      all.push(...getUserOrders(user.id));
    });
    return all.sort((a, b) => b.id.localeCompare(a.id));
  } catch { return []; }
}

// ─── Order Status ─────────────────────────────────────────────────────────────

export function getOrderStatusOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem('ml-order-status');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function setOrderStatus(orderId: string, status: string) {
  const overrides = getOrderStatusOverrides();
  overrides[orderId] = status;
  localStorage.setItem('ml-order-status', JSON.stringify(overrides));
}

// ─── Product Overrides ────────────────────────────────────────────────────────

export function getProductOverrides(): Record<string, ProductOverride> {
  try {
    const raw = localStorage.getItem('ml-product-overrides');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function setProductOverride(id: string, data: ProductOverride) {
  const overrides = getProductOverrides();
  const merged: ProductOverride = { ...overrides[id], ...data };

  // ── Bidirectional sync: price ↔ price_egp_manual ──────────────────────────
  // If the base price was changed, sync it to price_egp_manual (regional EGP)
  if (data.price !== undefined && data.regionalPricing === undefined) {
    const existingRegional = merged.regionalPricing ?? {};
    merged.regionalPricing = { ...existingRegional, price_egp_manual: data.price };
  }
  // If price_egp_manual was changed, sync it back to the base price
  if (data.regionalPricing?.price_egp_manual !== undefined && data.price === undefined) {
    const newEgpPrice = data.regionalPricing.price_egp_manual;
    if (newEgpPrice && newEgpPrice > 0) {
      merged.price = newEgpPrice;
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  overrides[id] = merged;
  localStorage.setItem('ml-product-overrides', JSON.stringify(overrides));
}

// Apply all overrides to a static product
export function applyOverride(p: Product, ov: ProductOverride): Product {
  return {
    ...p,
    price: ov.price ?? p.price,
    inStock: ov.inStock ?? p.inStock,
    name: ov.name ?? p.name,
    nameEn: ov.nameEn ?? p.nameEn,
    shortDescription: ov.shortDescription ?? p.shortDescription,
    shortDescriptionEn: ov.shortDescriptionEn ?? p.shortDescriptionEn,
    description: ov.description ?? p.description,
    descriptionEn: ov.descriptionEn ?? p.descriptionEn,
    category: ov.category ?? p.category,
    variants: ov.variants ?? p.variants,
    images: ov.images ?? p.images,
    weight: ov.weight ?? p.weight,
    tags: ov.tags ?? p.tags,
  };
}

// ─── Added Products ───────────────────────────────────────────────────────────

export function getAddedProducts(): Product[] {
  try {
    const raw = localStorage.getItem('ml-products-added');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveAddedProducts(products: Product[]) {
  localStorage.setItem('ml-products-added', JSON.stringify(products));
}

export function addProduct(product: Product) {
  const existing = getAddedProducts();
  existing.unshift(product);
  saveAddedProducts(existing);
}

export function deleteAddedProduct(id: string) {
  const existing = getAddedProducts().filter(p => p.id !== id);
  saveAddedProducts(existing);
}

export function updateAddedProduct(id: string, data: Partial<Product>) {
  const existing = getAddedProducts().map(p => p.id === id ? { ...p, ...data } : p);
  saveAddedProducts(existing);
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function getAllReviews(
  productList: { id: string; name: string; reviews?: Review[] }[]
): AdminReview[] {
  const all: AdminReview[] = [];

  productList.forEach(({ id, name, reviews: hardcoded }) => {
    // Hardcoded reviews from products.ts
    if (hardcoded) {
      hardcoded.forEach(r => all.push({
        id: r.id,
        productId: id,
        productName: name,
        author: r.author,
        rating: r.rating,
        comment: r.comment,
        date: r.date,
        isHardcoded: true,
      }));
    }

    // User-submitted reviews from localStorage
    try {
      const raw = localStorage.getItem(`reviews_${id}`);
      if (!raw) return;
      const reviews: { id: string; author: string; rating: number; comment: string; date: string }[] = JSON.parse(raw);
      reviews.forEach(r => all.push({ ...r, productId: id, productName: name, isHardcoded: false }));
    } catch {}
  });

  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export function deleteReview(productId: string, reviewId: string) {
  try {
    const raw = localStorage.getItem(`reviews_${productId}`);
    if (!raw) return;
    const reviews = JSON.parse(raw).filter((r: { id: string }) => r.id !== reviewId);
    localStorage.setItem(`reviews_${productId}`, JSON.stringify(reviews));
  } catch {}
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export type PaymentMethodId = 'cod' | 'card' | 'paypal' | 'vodafone' | 'instapay';

export interface PaymentMethodConfig {
  id: PaymentMethodId;
  enabled: boolean;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'cod',      enabled: true },
  { id: 'card',     enabled: true },
  { id: 'paypal',   enabled: true },
  { id: 'vodafone', enabled: true },
  { id: 'instapay', enabled: true },
];

export function getPaymentMethods(): PaymentMethodConfig[] {
  try {
    const raw = localStorage.getItem('ml-payment-methods');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PAYMENT_METHODS;
}

export function savePaymentMethods(methods: PaymentMethodConfig[]) {
  localStorage.setItem('ml-payment-methods', JSON.stringify(methods));
}

// ─── Shipping Overrides ───────────────────────────────────────────────────────

export interface ShippingOverrides {
  local: Record<string, number>;
}

export function getShippingOverrides(): ShippingOverrides {
  try {
    const raw = localStorage.getItem('ml-shipping-overrides');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { local: {} };
}

export function saveShippingOverrides(overrides: ShippingOverrides) {
  localStorage.setItem('ml-shipping-overrides', JSON.stringify(overrides));
}

export function getEffectiveShipping(govId: string): number {
  const overrides = getShippingOverrides();
  if (overrides.local[govId] !== undefined) return overrides.local[govId];
  const gov = governorates.find(g => g.id === govId);
  return gov?.shipping ?? 50;
}
