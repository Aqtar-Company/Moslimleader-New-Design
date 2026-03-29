'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { Address } from '@/context/AuthContext';
import { governorates } from '@/lib/shipping';
import { ADMIN_EMAIL } from '@/lib/admin-config';

type Tab = 'profile' | 'addresses' | 'orders' | 'books';

interface MyBook {
  id: string;
  title: string;
  cover: string;
  author?: string;
  lastPage: number;
  totalPages: number;
  grantedAt: string;
}

interface OrderRecord {
  id: string;
  date: string;
  total: number;
  status: string;
  currency?: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, signOut, updateUser } = useAuth();
  const { isRtl } = useLang();

  const [tab, setTab] = useState<Tab>('profile');
  const [dbOrders, setDbOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [myBooks, setMyBooks] = useState<MyBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrLabel, setAddrLabel] = useState('');
  const [addrFullName, setAddrFullName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrGov, setAddrGov] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrBuilding, setAddrBuilding] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth?redirect=/account');
    }
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
      setEmail(user.email);
      // Load orders from DB
      setOrdersLoading(true);
      fetch('/api/orders', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.orders) {
            setDbOrders(data.orders.map((o: { id: string; createdAt: string; total: number; status: string; currency?: string }) => ({
              id: o.id,
              date: new Date(o.createdAt).toLocaleDateString('ar-EG'),
              total: o.total,
              status: o.status,
              currency: o.currency,
            })));
          }
        })
        .catch(() => {})
        .finally(() => setOrdersLoading(false));

      // Load my books
      setBooksLoading(true);
      fetch('/api/books/my', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setMyBooks(d.books ?? []))
        .catch(() => {})
        .finally(() => setBooksLoading(false));
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const L = {
    title: isRtl ? 'حسابي' : 'My Account',
    profile: isRtl ? 'البيانات الشخصية' : 'Personal Info',
    addresses: isRtl ? 'عناوين التوصيل' : 'Delivery Addresses',
    orders: isRtl ? 'طلباتي' : 'My Orders',
    name: isRtl ? 'الاسم' : 'Full Name',
    email: isRtl ? 'البريد الإلكتروني' : 'Email',
    phone: isRtl ? 'رقم الهاتف' : 'Phone Number',
    save: isRtl ? 'حفظ التغييرات' : 'Save Changes',
    saved: isRtl ? '✓ تم الحفظ!' : '✓ Saved!',
    signOut: isRtl ? 'تسجيل الخروج' : 'Sign Out',
    addAddress: isRtl ? '+ إضافة عنوان جديد' : '+ Add New Address',
    addressLabel: isRtl ? 'تسمية العنوان (مثل: المنزل، العمل)' : 'Address Label (e.g. Home, Work)',
    fullName: isRtl ? 'الاسم بالكامل' : 'Full Name',
    governorate: isRtl ? 'المحافظة' : 'Governorate',
    city: isRtl ? 'المدينة / الحي' : 'City / District',
    street: isRtl ? 'الشارع' : 'Street',
    building: isRtl ? 'المبنى / الشقة (اختياري)' : 'Building / Apt (optional)',
    cancel: isRtl ? 'إلغاء' : 'Cancel',
    addBtn: isRtl ? 'إضافة العنوان' : 'Add Address',
    delete: isRtl ? 'حذف' : 'Delete',
    noAddresses: isRtl ? 'لا توجد عناوين محفوظة بعد.' : 'No saved addresses yet.',
    noOrders: isRtl ? 'لا توجد طلبات سابقة.' : 'No orders yet.',
    orderId: isRtl ? 'رقم الطلب' : 'Order #',
    orderDate: isRtl ? 'التاريخ' : 'Date',
    orderTotal: isRtl ? 'الإجمالي' : 'Total',
    orderStatus: isRtl ? 'الحالة' : 'Status',
    required: isRtl ? 'هذا الحقل مطلوب' : 'Required',
    currency: isRtl ? 'ج.م' : 'EGP',
  };

  const inputClass = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-400 focus:bg-white transition text-gray-900 text-sm placeholder:text-gray-400';
  const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  function handleProfileSave() {
    if (!name.trim()) { setProfileError(L.required); return; }
    setProfileError('');
    updateUser({ name: name.trim(), phone: phone.trim() });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  }

  function handleAddAddress() {
    if (!addrLabel.trim() || !addrFullName.trim() || !addrPhone.trim() || !addrGov || !addrCity.trim() || !addrStreet.trim()) return;
    const newAddr: Address = {
      id: Date.now().toString(),
      label: addrLabel.trim(),
      fullName: addrFullName.trim(),
      phone: addrPhone.trim(),
      governorate: addrGov,
      city: addrCity.trim(),
      street: addrStreet.trim(),
      building: addrBuilding.trim(),
    };
    const existing = user?.savedAddresses ?? [];
    updateUser({ savedAddresses: [...existing, newAddr] });
    setShowAddressForm(false);
    setAddrLabel(''); setAddrFullName(''); setAddrPhone(''); setAddrGov(''); setAddrCity(''); setAddrStreet(''); setAddrBuilding('');
  }

  function handleDeleteAddress(id: string) {
    const updated = (user?.savedAddresses ?? []).filter(a => a.id !== id);
    updateUser({ savedAddresses: updated });
  }

  const orders = dbOrders;

  const govName = (id: string) => {
    const g = governorates.find(g => g.id === id);
    return isRtl ? g?.name : g?.nameEn;
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-4xl mx-auto px-4 py-10 pt-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{L.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.email === ADMIN_EMAIL && (
            <Link
              href="/admin/dashboard"
              className="text-sm font-bold bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] rounded-xl px-4 py-2 transition flex items-center gap-1.5"
            >
              <span>⚙️</span> {isRtl ? 'لوحة التحكم' : 'Dashboard'}
            </Link>
          )}
          <button
            onClick={() => { signOut(); router.push('/'); }}
            className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-xl px-4 py-2 transition font-semibold"
          >
            {L.signOut}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-8 overflow-x-auto">
        {([['profile', L.profile], ['addresses', L.addresses], ['orders', L.orders], ['books', isRtl ? '📚 كتبي' : '📚 My Books']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-black text-gray-900 mb-6">{L.profile}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg">
            <div className="sm:col-span-2">
              <label className={labelClass}>{L.name} *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
              />
              {profileError && <p className="text-red-500 text-xs mt-1">{profileError}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{L.email}</label>
              <input
                type="email"
                value={email}
                readOnly
                className={inputClass + ' opacity-60 cursor-not-allowed'}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>{L.phone}</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className={inputClass}
              />
            </div>
          </div>
          <button
            onClick={handleProfileSave}
            className={`mt-6 px-8 py-3 rounded-xl font-bold text-sm transition ${
              profileSaved
                ? 'bg-green-500 text-white'
                : 'bg-gray-900 hover:bg-gray-700 text-white'
            }`}
          >
            {profileSaved ? L.saved : L.save}
          </button>
        </div>
      )}

      {/* Addresses Tab */}
      {tab === 'addresses' && (
        <div className="space-y-4">
          {(user.savedAddresses ?? []).length === 0 && !showAddressForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
              {L.noAddresses}
            </div>
          )}

          {(user.savedAddresses ?? []).map(addr => {
            const gov = govName(addr.governorate);
            return (
              <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-900 text-sm mb-1">{addr.label}</p>
                  <p className="text-sm text-gray-700">{addr.fullName} · {addr.phone}</p>
                  <p className="text-sm text-gray-500">{addr.street}{addr.building ? '، ' + addr.building : ''}, {addr.city}, {gov}</p>
                </div>
                <button
                  onClick={() => handleDeleteAddress(addr.id)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0 font-semibold"
                >
                  {L.delete}
                </button>
              </div>
            );
          })}

          {!showAddressForm && (
            <button
              onClick={() => setShowAddressForm(true)}
              className="w-full border-2 border-dashed border-gray-200 hover:border-gray-400 text-gray-500 hover:text-gray-700 font-bold py-4 rounded-2xl transition text-sm"
            >
              {L.addAddress}
            </button>
          )}

          {showAddressForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-black text-gray-900 mb-5">{L.addAddress}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>{L.addressLabel} *</label>
                  <input type="text" value={addrLabel} onChange={e => setAddrLabel(e.target.value)} placeholder={isRtl ? 'مثال: المنزل' : 'e.g. Home'} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{L.fullName} *</label>
                  <input type="text" value={addrFullName} onChange={e => setAddrFullName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{L.phone} *</label>
                  <input type="tel" dir="ltr" value={addrPhone} onChange={e => setAddrPhone(e.target.value)} placeholder="01xxxxxxxxx" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{L.governorate} *</label>
                  <select value={addrGov} onChange={e => setAddrGov(e.target.value)} className={inputClass + ' bg-white cursor-pointer'}>
                    <option value="">{isRtl ? 'اختر المحافظة' : 'Select'}</option>
                    {governorates.map(g => (
                      <option key={g.id} value={g.id}>{isRtl ? g.name : g.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{L.city} *</label>
                  <input type="text" value={addrCity} onChange={e => setAddrCity(e.target.value)} className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{L.street} *</label>
                  <input type="text" value={addrStreet} onChange={e => setAddrStreet(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{L.building}</label>
                  <input type="text" value={addrBuilding} onChange={e => setAddrBuilding(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowAddressForm(false)} className="flex-1 border-2 border-gray-200 hover:border-gray-400 text-gray-700 font-bold py-3 rounded-xl transition text-sm">{L.cancel}</button>
                <button onClick={handleAddAddress} className="flex-1 bg-gray-900 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition text-sm">{L.addBtn}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Books Tab */}
      {tab === 'books' && (
        <div>
          {booksLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : myBooks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-gray-500 font-semibold mb-4">{isRtl ? 'لا توجد كتب مشتراة بعد' : 'No books yet'}</p>
              <Link href="/library" className="inline-block bg-[#F5C518] hover:bg-amber-400 text-[#1a1a2e] font-black px-6 py-2.5 rounded-xl text-sm transition">
                {isRtl ? 'تصفح المكتبة' : 'Browse Library'}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {myBooks.map(book => (
                <Link key={book.id} href={`/library/${book.id}`} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="relative aspect-[2/3] bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
                    {book.cover ? (
                      <Image src={book.cover} alt={book.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl">📖</div>
                    )}
                    {book.lastPage > 1 && (
                      <div className="absolute bottom-2 left-2 right-2 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#F5C518] rounded-full"
                          style={{ width: `${Math.min((book.lastPage / (book.totalPages || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-black text-gray-900 text-xs leading-tight line-clamp-2">{book.title}</p>
                    {book.author && <p className="text-gray-400 text-xs mt-0.5">{book.author}</p>}
                    {book.lastPage > 1 && (
                      <p className="text-amber-600 text-xs mt-1 font-semibold">ص {book.lastPage}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {ordersLoading ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">{L.noOrders}</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs uppercase">{L.orderId}</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs uppercase">{L.orderDate}</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs uppercase">{L.orderTotal}</th>
                  <th className="text-start px-5 py-3 font-bold text-gray-500 text-xs uppercase">{L.orderStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">#{o.id.slice(-6)}</td>
                    <td className="px-5 py-4 text-gray-500">{o.date}</td>
                    <td className="px-5 py-4 font-bold text-gray-900">{o.total.toLocaleString('ar-EG')} {o.currency || L.currency}</td>
                    <td className="px-5 py-4">
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
