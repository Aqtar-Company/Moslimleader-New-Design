'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';
import { ageInYears } from '@/lib/child-age';
import { Address } from '@/context/AuthContext';
import { governorates } from '@/lib/shipping';
import { COUNTRY_CURRENCIES } from '@/lib/geo-pricing';
const COUNTRIES_LIST = [
  { code: 'EG', name: 'مصر', nameEn: 'Egypt' },
  ...Object.entries(COUNTRY_CURRENCIES)
    .filter(([code]) => code !== 'EG')
    .map(([code, c]) => ({ code, name: c.nameAr, nameEn: c.nameEn }))
];

type Tab = 'profile' | 'addresses' | 'orders' | 'books' | 'loyalty' | 'children';

interface ChildRecord { id: string; name: string; birthdate: string; gender: string | null; }

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
  const [loyaltyData, setLoyaltyData] = useState<{ points: number; egpValue: number; transactions: { id: string; points: number; reason: string; createdAt: string }[] } | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  // Children
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [showChildForm, setShowChildForm] = useState(false);
  const [childName, setChildName] = useState('');
  const [childBirthdate, setChildBirthdate] = useState('');
  const [childGender, setChildGender] = useState<'boy' | 'girl' | ''>('');
  const [childError, setChildError] = useState('');

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
  const [addrCountry, setAddrCountry] = useState('EG');

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

      // Load loyalty points
      setLoyaltyLoading(true);
      fetch('/api/loyalty', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setLoyaltyData(d))
        .catch(() => {})
        .finally(() => setLoyaltyLoading(false));

      // Load children
      setChildrenLoading(true);
      fetch('/api/user/children', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setChildren(d.children ?? []))
        .catch(() => {})
        .finally(() => setChildrenLoading(false));
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
    const needsGov = addrCountry === 'EG';
    if (!addrLabel.trim() || !addrFullName.trim() || !addrPhone.trim() || !addrCity.trim() || !addrStreet.trim()) return;
    if (needsGov && !addrGov) return;
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
    setAddrLabel(''); setAddrFullName(''); setAddrPhone(''); setAddrGov(''); setAddrCity(''); setAddrStreet(''); setAddrBuilding(''); setAddrCountry('EG');
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
          {(user.role === 'admin' || user.role === 'staff') && (
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
        {([['profile', L.profile], ['addresses', L.addresses], ['orders', L.orders], ['books', isRtl ? '📚 كتبي' : '📚 My Books'], ['loyalty', isRtl ? '⭐ نقاطي' : '⭐ Points'], ['children', isRtl ? '👶 أطفالي' : '👶 My Kids']] as [Tab, string][]).map(([t, label]) => (
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
                <div className="sm:col-span-2">
                  <label className={labelClass}>{isRtl ? 'الدولة' : 'Country'} *</label>
                  <select value={addrCountry} onChange={e => { setAddrCountry(e.target.value); setAddrGov(''); }} className={inputClass + ' bg-white cursor-pointer'}>
                    {COUNTRIES_LIST.map(c => (
                      <option key={c.code} value={c.code}>{isRtl ? c.name : c.nameEn}</option>
                    ))}
                  </select>
                </div>
                {addrCountry === 'EG' && (
                  <div>
                    <label className={labelClass}>{L.governorate} *</label>
                    <select value={addrGov} onChange={e => setAddrGov(e.target.value)} className={inputClass + ' bg-white cursor-pointer'}>
                      <option value="">{isRtl ? 'اختر المحافظة' : 'Select'}</option>
                      {governorates.map(g => (
                        <option key={g.id} value={g.id}>{isRtl ? g.name : g.nameEn}</option>
                      ))}
                    </select>
                  </div>
                )}
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
              {myBooks.map(book => {
                const pct = book.totalPages ? Math.min((book.lastPage / book.totalPages) * 100, 100) : 0;
                const finished = pct >= 98;
                return (
                  <Link key={book.id} href={`/library/${book.id}`} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
                    {/* Cover */}
                    <div className="relative aspect-[2/3] bg-gradient-to-br from-[#1a1a2e] to-[#16213e] shrink-0">
                      {book.cover ? (
                        <Image src={book.cover} alt={book.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl">📖</div>
                      )}
                      {finished && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white font-black text-xs bg-green-500 px-2 py-1 rounded-full">✓ منتهي</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {book.totalPages > 0 && (
                      <div className="h-1.5 bg-gray-100">
                        <div
                          className={`h-full rounded-none transition-all ${finished ? 'bg-green-500' : 'bg-[#F5C518]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-black text-gray-900 text-xs leading-tight line-clamp-2 mb-1">{book.title}</p>
                      {book.author && <p className="text-gray-400 text-[10px]">{book.author}</p>}
                      <div className="mt-auto pt-2">
                        {finished ? (
                          <p className="text-green-600 text-[10px] font-bold">اكتملت القراءة ✓</p>
                        ) : book.lastPage > 1 ? (
                          <p className="text-[#F5C518] text-[10px] font-bold">
                            ▶ استكمل من ص {book.lastPage}
                            {book.totalPages > 0 && (
                              <span className="text-gray-400 font-normal"> / {book.totalPages}</span>
                            )}
                          </p>
                        ) : (
                          <p className="text-gray-400 text-[10px]">لم تبدأ القراءة بعد</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">{o.status}</span>
                        {o.status === 'delivered' && (
                          <button
                            onClick={() => {
                              const reason = prompt(isRtl ? 'سبب الإرجاع (defective/wrong_item/not_as_described/other):' : 'Reason (defective/wrong_item/not_as_described/other):');
                              if (!reason) return;
                              fetch(`/api/orders/${o.id}/return`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ type: 'return', reason, items: [] }),
                              }).then(r => r.json()).then(d => {
                                if (d.ok) alert(isRtl ? 'تم إرسال طلب الإرجاع بنجاح' : 'Return request submitted');
                                else alert(d.error);
                              });
                            }}
                            className="text-xs text-orange-600 hover:text-orange-800 font-semibold border border-orange-200 px-2.5 py-1 rounded-full transition"
                          >
                            {isRtl ? '↩ إرجاع' : '↩ Return'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Loyalty Tab */}
      {tab === 'loyalty' && (
        <div className="space-y-5">
          {/* Balance card */}
          <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl p-6 text-gray-900">
            <p className="text-sm font-semibold opacity-80 mb-1">{isRtl ? 'رصيد نقاطك' : 'Your Points Balance'}</p>
            {loyaltyLoading ? (
              <div className="w-6 h-6 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
            ) : (
              <>
                <p className="text-5xl font-black">{loyaltyData?.points ?? 0}</p>
                <p className="text-sm mt-1 opacity-80">
                  {isRtl
                    ? `= ${loyaltyData?.egpValue ?? 0} جنيه خصم قابل للصرف`
                    : `= ${loyaltyData?.egpValue ?? 0} EGP discount available`}
                </p>
              </>
            )}
          </div>

          {/* How it works */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-black text-gray-900 mb-3">{isRtl ? 'كيف تعمل النقاط؟' : 'How it works'}</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>⭐ {isRtl ? 'كل 10 جنيه في طلبك = نقطة واحدة' : 'Every 10 EGP spent = 1 point'}</li>
              <li>🎁 {isRtl ? 'كل 100 نقطة = 10 جنيه خصم' : '100 points = 10 EGP discount'}</li>
              <li>🛒 {isRtl ? 'يمكن صرف النقاط عند الدفع' : 'Redeem at checkout'}</li>
            </ul>
          </div>

          {/* Transaction history */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-black text-gray-900">{isRtl ? 'سجل النقاط' : 'Points History'}</p>
            </div>
            {loyaltyLoading ? (
              <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
            ) : !loyaltyData?.transactions?.length ? (
              <div className="p-8 text-center text-gray-400 text-sm">{isRtl ? 'لا توجد معاملات بعد' : 'No transactions yet'}</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {loyaltyData.transactions.map(tx => {
                  const reasonLabel: Record<string, string> = {
                    order_earn: isRtl ? 'طلب شراء' : 'Purchase',
                    order_redeem: isRtl ? 'صرف نقاط' : 'Redeemed',
                    manual: isRtl ? 'تعديل يدوي' : 'Manual',
                    expired: isRtl ? 'انتهت صلاحية' : 'Expired',
                  };
                  return (
                    <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{reasonLabel[tx.reason] ?? tx.reason}</p>
                        <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString('ar-EG')}</p>
                      </div>
                      <span className={`text-sm font-black ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points} {isRtl ? 'نقطة' : 'pts'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Children Tab */}
      {tab === 'children' && (
        <div className="space-y-4">
          {childrenLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : children.length === 0 && !showChildForm ? (
            <div className="text-center py-14 bg-gradient-to-b from-amber-50 to-white rounded-2xl border border-amber-100">
              <div className="text-5xl mb-3">👨‍👩‍👧‍👦</div>
              <h3 className="font-black text-gray-900 text-lg mb-2">
                {isRtl ? 'أضف أطفالك واحصل على 50 نقطة مجانًا!' : 'Add your children & get 50 free points!'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                {isRtl ? 'نرشح لك منتجات تعليمية مناسبة لعمر كل طفل تلقائيًا' : "We'll recommend age-appropriate products for each child automatically"}
              </p>
              <button
                onClick={() => setShowChildForm(true)}
                className="bg-[#F5C518] hover:bg-yellow-400 text-gray-900 font-black px-8 py-3 rounded-xl text-sm transition"
              >
                {isRtl ? '+ إضافة طفل الآن' : '+ Add a Child Now'}
              </button>
            </div>
          ) : (
            <>
              {children.map(child => {
                const bd = new Date(child.birthdate);
                const age = ageInYears(bd);
                const gIcon = child.gender === 'boy' ? '👦' : child.gender === 'girl' ? '👧' : '🧒';
                return (
                  <div key={child.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{gIcon}</span>
                      <div>
                        <p className="font-bold text-gray-900">{child.name}</p>
                        <p className="text-sm text-gray-500">{age} {isRtl ? 'سنة' : 'years old'}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/user/children/${child.id}`, { method: 'DELETE', credentials: 'include' });
                        setChildren(prev => prev.filter(c => c.id !== child.id));
                      }}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold transition"
                    >
                      {isRtl ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                );
              })}
              {children.length < 10 && !showChildForm && (
                <button
                  onClick={() => setShowChildForm(true)}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-amber-300 text-gray-500 hover:text-gray-700 font-bold py-4 rounded-2xl transition text-sm"
                >
                  {isRtl ? '+ إضافة طفل آخر' : '+ Add Another Child'}
                </button>
              )}
            </>
          )}

          {showChildForm && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-black text-gray-900 mb-5 text-base">{isRtl ? 'إضافة طفل' : 'Add a Child'}</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>{isRtl ? 'الاسم *' : 'Name *'}</label>
                  <input
                    type="text" value={childName} onChange={e => setChildName(e.target.value)}
                    className={inputClass} placeholder={isRtl ? 'اسم الطفل' : "Child's name"}
                  />
                </div>
                <div>
                  <label className={labelClass}>{isRtl ? 'تاريخ الميلاد *' : 'Birthdate *'}</label>
                  <input
                    type="date" value={childBirthdate} onChange={e => setChildBirthdate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputClass} dir="ltr"
                  />
                </div>
                <div>
                  <label className={labelClass}>{isRtl ? 'الجنس (اختياري)' : 'Gender (optional)'}</label>
                  <select
                    value={childGender} onChange={e => setChildGender(e.target.value as 'boy' | 'girl' | '')}
                    className={inputClass + ' bg-white cursor-pointer'}
                  >
                    <option value="">—</option>
                    <option value="boy">{isRtl ? '👦 ولد' : '👦 Boy'}</option>
                    <option value="girl">{isRtl ? '👧 بنت' : '👧 Girl'}</option>
                  </select>
                </div>
                {childError && <p className="text-red-500 text-xs">{childError}</p>}
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setShowChildForm(false); setChildName(''); setChildBirthdate(''); setChildGender(''); setChildError(''); }}
                  className="flex-1 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={async () => {
                    if (!childName.trim() || !childBirthdate) { setChildError(isRtl ? 'الاسم والتاريخ مطلوبان' : 'Name and birthdate are required'); return; }
                    setChildError('');
                    const res = await fetch('/api/user/children', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ name: childName.trim(), birthdate: childBirthdate, gender: childGender || null }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setChildren(prev => [...prev, data.child]);
                      setShowChildForm(false);
                      setChildName(''); setChildBirthdate(''); setChildGender('');
                      if (data.pointsEarned > 0) alert(`🏆 ${isRtl ? `حصلت على ${data.pointsEarned} نقطة كهدية!` : `You earned ${data.pointsEarned} bonus points!`}`);
                    } else {
                      setChildError(data.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
                    }
                  }}
                  className="flex-1 bg-gray-900 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm transition"
                >
                  {isRtl ? 'إضافة' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
