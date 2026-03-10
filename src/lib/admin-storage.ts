import { Product } from '@/types';
import { DEFAULT_COUPONS } from './admin-config';
import { governorates } from './shipping';

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
}

export interface ProductOverride {
  price?: number;
  inStock?: boolean;
  featured?: boolean;
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
      const users = JSON.parse(userRaw);
      const found = Object.values(users).find((u: any) => u.user.id === userId) as any;
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
  overrides[id] = { ...overrides[id], ...data };
  localStorage.setItem('ml-product-overrides', JSON.stringify(overrides));
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

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function getAllReviews(productList: { id: string; name: string }[]): AdminReview[] {
  const all: AdminReview[] = [];
  productList.forEach(({ id, name }) => {
    try {
      const raw = localStorage.getItem(`reviews_${id}`);
      if (!raw) return;
      const reviews: { id: string; author: string; rating: number; comment: string; date: string }[] = JSON.parse(raw);
      reviews.forEach(r => all.push({ ...r, productId: id, productName: name }));
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

// ─── Shipping Overrides ───────────────────────────────────────────────────────

export interface ShippingOverrides {
  local: Record<string, number>; // governorateId → price
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
