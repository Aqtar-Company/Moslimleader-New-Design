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

type Tab = 'profile' | 'addresses' | 'orders' | 'books' | 'loyalty' | 'children' | 'downloads';

interface FreeMediaItem {
  id: number; title: string; titleEn: string | null; type: string;
  url: string; coverUrl: string | null; description: string | null; descriptionEn: string | null;
}

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

  // Free media downloads
  const [freeMedia, setFreeMedia] = useState<FreeMediaItem[]>([]);
  const [freeMediaLoading, setFreeMediaLoading] = useState(false);
  const [mediaSubTab, setMediaSubTab] = useState<'all' | 'mp3' | 'image' | 'pdf'>('all');

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
      router.replace('/login?redirect=/account');
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

      // Load free media
      setFreeMediaLoading(true);
      fetch('/api/free-media')
        .then(r => r.json())
        .then(d => setFreeMedia(d.items ?? []))
        .catch(() => {})
        .finally(() => setFreeMediaLoading(false));
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
        {([
          ['profile',   isRtl ? 'بياناتي'    : 'Profile',    <svg key="p" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0H3z"/></svg>],
          ['addresses', isRtl ? 'العناوين'   : 'Addresses',  <svg key="a" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" clipRule="evenodd"/></svg>],
          ['orders',    isRtl ? 'طلباتي'     : 'Orders',     <svg key="o" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M3 3h2l.4 2M7 13h10l2-7H5.4L7 13zm0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>],
          ['books',     isRtl ? 'كتبي'       : 'My Books',   <svg key="b" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804z"/></svg>],
          ['loyalty',   isRtl ? 'نقاطي'      : 'Points',     <svg key="l" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z"/></svg>],
          ['children',  isRtl ? 'أطفالي'     : 'My Kids',    <svg key="c" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><circle cx="10" cy="6" r="3"/><path d="M10 11c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z"/></svg>],
          ['downloads', isRtl ? 'وسائط مجانية' : 'Free Media', <svg key="d" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm3.293-7.707a1 1 0 0 1 1.414 0L9 10.586V3a1 1 0 1 1 2 0v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414z" clipRule="evenodd"/></svg>],
        ] as [Tab, string, React.ReactNode][]).map(([t, label, icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
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

      {tab === 'downloads' && (
        <div>
          <div className="mb-5">
            <h2 className="text-xl font-black text-gray-900">
              {isRtl ? 'وسائط مسلم ليدر المجانية' : 'Muslim Leader Free Media'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isRtl ? 'ملفات صوتية وصور تلوين وكتب PDF مجانية لك ولأطفالك' : 'Free audio files, coloring pages, and PDFs for you and your children'}
            </p>
          </div>

          {/* Sub-tabs */}
          {freeMedia.length > 0 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {([
                ['all',   isRtl ? 'الكل' : 'All',
                  <svg key="all" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm8 0a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2zm-8 8a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5zm8 0a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2z"/></svg>],
                ['mp3',  isRtl ? 'الأناشيد' : 'Nasheeds',
                  <svg key="mp3" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M18 3a1 1 0 0 0-1.196-.98l-10 2A1 1 0 0 0 6 5v9.114A4.369 4.369 0 0 0 5 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0 0 15 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>],
                ['image', isRtl ? 'رسومات التلوين' : 'Coloring',
                  <svg key="img" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/></svg>],
                ['pdf',  isRtl ? 'كتب PDF' : 'PDF Books',
                  <svg key="pdf" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7z" clipRule="evenodd"/></svg>],
              ] as ['all'|'mp3'|'image'|'pdf', string, React.ReactNode][])
                .filter(([type]) => type === 'all' || freeMedia.some(m => m.type === type))
                .map(([type, label, icon]) => (
                  <button
                    key={type}
                    onClick={() => setMediaSubTab(type)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition whitespace-nowrap ${
                      mediaSubTab === type
                        ? 'bg-[#1a1a2e] text-[#F5C518] border-[#1a1a2e]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {icon} {label}
                    <span className="text-xs opacity-60">
                      ({type === 'all' ? freeMedia.length : freeMedia.filter(m => m.type === type).length})
                    </span>
                  </button>
                ))
              }
            </div>
          )}
          {freeMediaLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : freeMedia.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-14 h-14 text-gray-300 mx-auto mb-3"><rect x="6" y="8" width="36" height="32" rx="3"/><path d="M18 8v32M30 8v32"/></svg>
              <p className="text-gray-500">{isRtl ? 'لا توجد وسائط متاحة حالياً' : 'No media available yet'}</p>
            </div>
          ) : (() => {
            const filtered = mediaSubTab === 'all' ? freeMedia : freeMedia.filter(m => m.type === mediaSubTab);
            return filtered.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border">
                <p className="text-gray-400 text-sm">{isRtl ? 'لا توجد ملفات في هذا القسم بعد' : 'No files in this section yet'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map(item => {
                  const isEn = !isRtl;
                  const title = isEn && item.titleEn ? item.titleEn : item.title;
                  const desc = isEn && item.descriptionEn ? item.descriptionEn : item.description;
                  const typeLabel = isRtl
                    ? (item.type === 'mp3' ? 'نشيد' : item.type === 'image' ? 'رسمة تلوين' : 'PDF')
                    : (item.type === 'mp3' ? 'Nasheed' : item.type === 'image' ? 'Coloring Page' : 'PDF');
                  const ext = item.url.split('.').pop() || (item.type === 'mp3' ? 'mp3' : item.type === 'pdf' ? 'pdf' : 'jpg');
                  const downloadName = `${item.title} - Muslim Leader.${ext}`;
                  const TypeIcon = item.type === 'mp3'
                    ? () => (
                      <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16 text-amber-400" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="14" cy="38" r="6" fill="currentColor" opacity="0.25" stroke="none"/>
                        <circle cx="14" cy="38" r="5"/>
                        <circle cx="34" cy="34" r="6" fill="currentColor" opacity="0.25" stroke="none"/>
                        <circle cx="34" cy="34" r="5"/>
                        <line x1="19" y1="38" x2="19" y2="14"/>
                        <line x1="39" y1="34" x2="39" y2="10"/>
                        <line x1="19" y1="14" x2="39" y2="10"/>
                      </svg>
                    )
                    : item.type === 'image'
                    ? () => (
                      <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16 text-amber-400" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="8" width="36" height="32" rx="3" fill="currentColor" opacity="0.12" stroke="currentColor"/>
                        <circle cx="16" cy="18" r="4" fill="currentColor" opacity="0.4" stroke="none"/>
                        <path d="M6 32 l10-10 8 8 6-6 12 12" fill="none"/>
                      </svg>
                    )
                    : () => (
                      <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16 text-amber-400" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 6h16l10 10v26a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="currentColor" opacity="0.12"/>
                        <path d="M28 6v10h10"/>
                        <line x1="16" y1="26" x2="32" y2="26"/>
                        <line x1="16" y1="32" x2="28" y2="32"/>
                      </svg>
                    );
                  return (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={title}
                          className="w-full h-40 object-cover"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('hidden');
                          }}
                        />
                      ) : null}
                      <div
                        hidden={!!item.coverUrl}
                        className="w-full h-36 bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center"
                      >
                        <TypeIcon />
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <span className="text-xs text-amber-600 font-semibold mb-1 flex items-center gap-1">
                          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 inline-block" fill="currentColor">
                            {item.type === 'mp3'
                              ? <path d="M9 3v7.5a2.5 2.5 0 1 1-1-2V5l4-1v1.5L9 6.2V3z"/>
                              : item.type === 'image'
                              ? <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm5 5.5L5 11h6l-2-3-2 2.5-1-1.5L7 8.5zM5.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                              : <path d="M4 0h5.5L13 3.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1zm5 0v3.5H12.5L9 0zM5 8h6v1H5V8zm0 2h6v1H5v-1z"/>
                            }
                          </svg>
                          {typeLabel}
                        </span>
                        <h3 className="font-black text-gray-900 mb-1">{title}</h3>
                        {desc && <p className="text-sm text-gray-500 mb-3 flex-1">{desc}</p>}
                        <a
                          href={item.url}
                          download={downloadName}
                          className="mt-auto flex items-center justify-center gap-2 bg-[#F5C518] hover:bg-yellow-400 text-gray-900 font-black py-2.5 rounded-xl text-sm transition"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M10 3a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 11.586V4a1 1 0 0 1 1-1zM3 16a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1z" clipRule="evenodd"/>
                          </svg>
                          {isRtl ? 'تحميل' : 'Download'}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
