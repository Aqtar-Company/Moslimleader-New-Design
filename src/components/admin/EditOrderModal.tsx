'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { adminFetch } from '@/lib/admin-fetch';

interface Product {
  id: string;
  name: string;
  price: number;
  images?: unknown;
  variants?: { id?: string; name?: string; nameEn?: string }[];
}

interface EditItem {
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: number;
  selectedModel: number | null;
  variantOptions?: { id?: string; name?: string }[];
}

interface OrderToEdit {
  id: string;
  currency: string;
  shippingCost: number;
  discount: number;
  notes: string | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    productImage: string | null;
    quantity: number;
    unitPrice: number;
    selectedModel?: number | null;
  }[];
}

interface Props {
  order: OrderToEdit | null;
  onClose: () => void;
  onSaved: (updatedOrder: OrderToEdit) => void;
}

function getFirstImage(images: unknown): string | null {
  if (!images) return null;
  if (Array.isArray(images) && typeof images[0] === 'string') return images[0];
  return null;
}

export function EditOrderModal({ order, onClose, onSaved }: Props) {
  const { addToast } = useToast();
  const [items, setItems] = useState<EditItem[]>([]);
  const [shippingCost, setShippingCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [picker, setPicker] = useState('');

  useEffect(() => {
    if (!order) return;
    setItems(order.items.map(it => ({
      productId: it.productId,
      productName: it.productName,
      productImage: it.productImage,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      selectedModel: it.selectedModel ?? null,
    })));
    setShippingCost(order.shippingCost);
    setDiscount(order.discount);
    setNotes(order.notes ?? '');
    setSendEmail(true);
    setPicker('');
  }, [order]);

  useEffect(() => {
    if (!order) return;
    fetch('/api/admin/products', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {});
  }, [order]);

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.unitPrice * it.quantity, 0), [items]);
  const total = Math.round((subtotal - discount + shippingCost) * 100) / 100;

  const addProduct = () => {
    if (!picker) return;
    const p = products.find(x => x.id === picker);
    if (!p) return;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const existIdx = items.findIndex(it => it.productId === p.id && it.selectedModel === null);
    if (existIdx >= 0 && variants.length === 0) {
      setItems(prev => prev.map((it, i) => i === existIdx ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setItems(prev => [...prev, {
        productId: p.id,
        productName: p.name,
        productImage: getFirstImage(p.images),
        quantity: 1,
        unitPrice: p.price,
        selectedModel: null,
        variantOptions: variants.length > 0 ? variants : undefined,
      }]);
    }
    setPicker('');
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<EditItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const save = async () => {
    if (items.length === 0) { addToast('أضف منتجاً واحداً على الأقل', 'error'); return; }
    if (!order) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ items, shippingCost, discount, notes: notes || null, sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'فشل الحفظ', 'error'); return; }
      addToast('تم تعديل الطلب' + (sendEmail ? ' وإرسال إيميل التأكيد' : ''), 'success');
      onSaved(data.order);
    } catch {
      addToast('فشل الاتصال بالخادم', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  const cur = order.currency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-[#1a1a2e] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-black text-base">✏️ تعديل الطلب</h2>
            <p className="text-white/50 text-xs mt-0.5 font-mono">#{order.id.slice(-6).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Items */}
          <div>
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">المنتجات</h3>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-3 flex gap-3 items-start bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{it.productName}</p>
                    {it.variantOptions && it.variantOptions.length > 0 && (
                      <select
                        value={it.selectedModel ?? ''}
                        onChange={e => updateItem(idx, { selectedModel: e.target.value === '' ? null : Number(e.target.value) })}
                        className="mt-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#F5C518] bg-white w-full"
                      >
                        <option value="">— موديل —</option>
                        {it.variantOptions.map((v, vi) => (
                          <option key={vi} value={vi}>{v.name || `موديل ${vi + 1}`}</option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2 mt-2 items-center">
                      <label className="text-[10px] text-gray-500">الكمية</label>
                      <input
                        type="number" min={1}
                        value={it.quantity}
                        onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-[#F5C518]"
                      />
                      <label className="text-[10px] text-gray-500 mr-2">سعر الوحدة</label>
                      <input
                        type="number" min={0} step="0.01"
                        value={it.unitPrice}
                        onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-[#F5C518]"
                      />
                      <span className="text-xs text-gray-400">{cur}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="font-bold text-[#6B21A8] text-sm">{(it.unitPrice * it.quantity).toLocaleString('en-US')} {cur}</p>
                    <button onClick={() => removeItem(idx)} className="mt-2 text-red-400 hover:text-red-600 text-xs font-bold block">✕ حذف</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add product picker */}
            <div className="flex gap-2 mt-3">
              <select
                value={picker}
                onChange={e => setPicker(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518] bg-white"
              >
                <option value="">— اختر منتجاً للإضافة —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price} {cur})</option>)}
              </select>
              <button
                onClick={addProduct}
                disabled={!picker}
                className="px-4 py-2 rounded-xl bg-[#F5C518] text-black font-bold text-sm disabled:opacity-40 hover:bg-yellow-400 transition"
              >+ إضافة</button>
            </div>
          </div>

          {/* Shipping / Discount / Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">الشحن ({cur})</label>
              <input type="number" min={0}
                value={shippingCost}
                onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">الخصم ({cur})</label>
              <input type="number" min={0}
                value={discount}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#F5C518] resize-none"
            />
          </div>

          {/* Total preview */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>المجموع الفرعي</span>
              <span className="font-bold">{subtotal.toLocaleString('en-US')} {cur}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>خصم</span>
                <span className="font-bold">−{discount.toLocaleString('en-US')} {cur}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>شحن</span>
              <span className="font-bold">{shippingCost > 0 ? `${shippingCost.toLocaleString('en-US')} ${cur}` : 'مجاني'}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-1">
              <span className="font-black text-gray-900">الإجمالي</span>
              <span className="font-black text-[#1a1a2e] text-lg">{total.toLocaleString('en-US')} {cur}</span>
            </div>
          </div>

          {/* Email toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setSendEmail(p => !p)}
              className={`w-10 h-6 rounded-full transition-colors ${sendEmail ? 'bg-[#F5C518]' : 'bg-gray-200'} relative`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${sendEmail ? 'translate-x-1' : 'translate-x-5'}`} />
            </div>
            <span className="text-sm font-semibold text-gray-700">إرسال إيميل تعديل الطلب للعميل والأدمن</span>
          </label>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 justify-end shrink-0 bg-gray-50">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100 transition">
            إلغاء
          </button>
          <button
            onClick={save}
            disabled={saving || items.length === 0}
            className="px-6 py-2.5 rounded-xl bg-[#F5C518] text-black font-black text-sm hover:bg-yellow-400 transition disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : '✓ حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}
