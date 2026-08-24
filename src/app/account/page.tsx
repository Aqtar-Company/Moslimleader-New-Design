'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useLang } from '@/context/LanguageContext';

const PayPalBookButton = dynamic(() => import('@/components/PayPalBookButton'), { ssr: false });
const MembershipCard = dynamic(() => import('@/components/membership/MembershipCard'), { ssr: false });

const SUPPORT_WA = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '201000000000';
import { ageInYears } from '@/lib/child-age';
import { Address } from '@/context/AuthContext';
import { governorates } from '@/lib/shipping';
import { COUNTRY_CURRENCIES } from '@/lib/geo-pricing';
import { compressImage } from '@/lib/compress-image';
const COUNTRIES_LIST = [
  { code: 'EG', name: 'مصر', nameEn: 'Egypt' },
  ...Object.entries(COUNTRY_CURRENCIES)
    .filter(([code]) => code !== 'EG')
    .map(([code, c]) => ({ code, name: c.nameAr, nameEn: c.nameEn }))
];

type Tab = 'profile' | 'addresses' | 'orders' | 'books' | 'loyalty' | 'children' | 'downloads' | 'membership' | 'support';

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

  // Membership
  const [membership, setMembership] = useState<{ id: string; membershipNumber: string; qrToken?: string; status: string; tier?: string | null; familyName: string | null; memberSince: number; startsAt: string | null; expiresAt: string | null; familyMembers: { id: string; name: string; relation: string | null }[] } | null>(null);
  const [membershipQrUrl, setMembershipQrUrl] = useState<string | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [perks, setPerks] = useState<{ id: string; title: string; description: string | null; imageUrl: string | null; linkUrl: string | null; validUntil: string | null; createdAt: string }[]>([]);
  const [membershipZone, setMembershipZone] = useState<'egypt' | 'international'>('international');
  const [membershipPrices, setMembershipPrices] = useState({ egyEgp: 100, egyUsd: 2.00, intlUsd: 5.00, instapayNumber: '' });
  const [applyStep, setApplyStep] = useState<'idle' | 'form' | 'paypal' | 'instapay' | 'pending' | 'success'>('idle');
  const [applyFamilyName, setApplyFamilyName] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [renewStep, setRenewStep] = useState<'idle' | 'paypal' | 'instapay' | 'success'>('idle');
  const [communityAcknowledged, setCommunityAcknowledged] = useState(() => {
    try { return typeof localStorage !== 'undefined' && localStorage.getItem('ml_comm_choice') === '1'; } catch { return false; }
  });
  const [upsellPerks, setUpsellPerks] = useState<{ id: string; title: string }[]>([]);
  const renewSectionRef = useRef<HTMLDivElement>(null);

  // Free media downloads
  const [freeMedia, setFreeMedia] = useState<FreeMediaItem[]>([]);
  const [freeMediaLoading, setFreeMediaLoading] = useState(false);
  const [mediaSubTab, setMediaSubTab] = useState<'all' | 'mp3' | 'image' | 'pdf'>('all');

  // Child product recommendations — keyed by child.id
  const [childRecs, setChildRecs] = useState<Record<string, { id: string; slug: string; name: string; nameEn: string; price: number; image: string | null; minAge: number | null; maxAge: number | null }[]>>({});

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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarProgress, setAvatarProgress] = useState(0);

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

      // Load children + their recommendations
      setChildrenLoading(true);
      fetch('/api/user/children', { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          const list: ChildRecord[] = d.children ?? [];
          setChildren(list);
          // Fetch recommendations for each child (age from birthdate)
          const recsMap: typeof childRecs = {};
          await Promise.all(list.map(async child => {
            const age = Math.max(0, new Date().getFullYear() - new Date(child.birthdate).getFullYear());
            const res = await fetch(`/api/recommendations?age=${age}&gender=${child.gender || ''}`).catch(() => null);
            if (res?.ok) {
              const data = await res.json();
              recsMap[child.id] = data.products ?? [];
            }
          }));
          setChildRecs(recsMap);
        })
        .catch(() => {})
        .finally(() => setChildrenLoading(false));

      // Load free media
      setFreeMediaLoading(true);
      fetch('/api/free-media')
        .then(r => r.json())
        .then(d => setFreeMedia(d.items ?? []))
        .catch(() => {})
        .finally(() => setFreeMediaLoading(false));

      // Detect zone for membership pricing (uses IP-detected country from RegionalPricingContext)
      try {
        const cc = localStorage.getItem('originCountryCode') ?? localStorage.getItem('ml-pricing-origin');
        setMembershipZone(cc === 'EG' ? 'egypt' : 'international');
      } catch { /* ignore */ }

      // Fetch membership prices from admin-controlled settings
      fetch('/api/membership/price')
        .then(r => r.json())
        .then(d => setMembershipPrices({ egyEgp: d.egyEgp ?? 100, egyUsd: d.egyUsd ?? 2, intlUsd: d.intlUsd ?? 5, instapayNumber: d.instapayNumber ?? '' }))
        .catch(() => {});

      // Load membership + perks
      setMembershipLoading(true);
      fetch('/api/membership', { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          setMembership(d.membership ?? null);
          if (d.membership?.tier === 'community') setCommunityAcknowledged(true);
          if (d.membership?.qrToken) {
            try {
              const QRCode = (await import('qrcode')).default;
              const url = `https://moslimleader.com/membership/verify/${d.membership.qrToken}`;
              const dataUrl = await QRCode.toDataURL(url, { width: 80, margin: 1, color: { dark: '#0a1020', light: '#ffffff' } });
              setMembershipQrUrl(dataUrl);
            } catch { /* non-fatal */ }
          }
          fetch('/api/membership/perks', { credentials: 'include' })
            .then(r => r.json())
            .then(pd => setPerks(pd.perks ?? []))
            .catch(() => {});
        })
        .catch(() => {})
        .finally(() => setMembershipLoading(false));
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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarProgress(0);

    // Show local preview immediately via FileReader (works reliably on all mobile browsers)
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string ?? null);
    reader.readAsDataURL(file);

    const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.88 });
    const form = new FormData();
    form.append('file', compressed);

    // Use XHR for upload progress
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/account/avatar');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setAvatarProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              updateUser({ avatarUrl: data.avatarUrl });
              setAvatarPreview(null);
              resolve();
            } else { reject(); }
          } catch { reject(); }
        };
        xhr.onerror = () => reject();
        xhr.send(form);
      });
    } catch { /* upload error — preview remains until cleared */ }
    finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  }

  async function handleAvatarDelete() {
    setAvatarUploading(true);
    await fetch('/api/account/avatar', { method: 'DELETE', credentials: 'include' });
    setAvatarUploading(false);
    setAvatarPreview(null);
    updateUser({ avatarUrl: null });
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

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-8 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {([
          ['profile',   isRtl ? 'بياناتي'  : 'Profile',  isRtl ? 'بياناتي'    : 'Profile',   <svg key="p" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0H3z"/></svg>],
          ['addresses', isRtl ? 'العناوين' : 'Addresses', isRtl ? 'العناوين'   : 'Addresses', <svg key="a" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 2a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" clipRule="evenodd"/></svg>],
          ['orders',    isRtl ? 'طلباتي'   : 'Orders',   isRtl ? 'طلباتي'     : 'Orders',    <svg key="o" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3 3h2l.4 2M7 13h10l2-7H5.4L7 13zm0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>],
          ['books',     isRtl ? 'كتبي'     : 'Books',    isRtl ? 'كتبي'       : 'My Books',  <svg key="b" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804z"/></svg>],
          ['loyalty',   isRtl ? 'نقاطي'    : 'Points',   isRtl ? 'نقاطي'      : 'Points',    <svg key="l" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z"/></svg>],
          ['children',  isRtl ? 'أطفالي'   : 'Kids',     isRtl ? 'أطفالي'     : 'My Kids',   <svg key="c" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><circle cx="10" cy="6" r="3"/><path d="M10 11c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z"/></svg>],
          ['downloads', isRtl ? 'وسائط'    : 'Media',    isRtl ? 'وسائط مجانية' : 'Free Media', <svg key="d" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm3.293-7.707a1 1 0 0 1 1.414 0L9 10.586V3a1 1 0 1 1 2 0v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414z" clipRule="evenodd"/></svg>],
          ['membership', isRtl ? 'عضويتي'  : 'Member',   isRtl ? 'عضوية الأسرة' : 'Family Membership', <svg key="m" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>],
          ['support',    isRtl ? 'دعم'      : 'Support',  isRtl ? 'طلبات الدعم' : 'Support Requests',  <svg key="s" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd"/></svg>],
        ] as [Tab, string, string, React.ReactNode][]).map(([t, shortLabel, fullLabel, icon]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-2 sm:px-3 rounded-xl font-bold transition whitespace-nowrap ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon}
            <span className="text-[9px] sm:hidden leading-none">{shortLabel}</span>
            <span className="hidden sm:inline text-sm">{fullLabel}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-black text-gray-900 mb-6">{L.profile}</h2>

          {/* Avatar */}
          <div className="flex items-center gap-5 mb-8">
            {/* Avatar with upload overlay */}
            <div className="relative shrink-0">
              {avatarPreview || user.avatarUrl ? (
                <img
                  src={avatarPreview ?? user.avatarUrl!}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-2xl font-black">
                  {user.name.charAt(0)}
                </div>
              )}
              {/* Upload progress ring */}
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.55)' }}>
                  <svg className="w-14 h-14 -rotate-90 absolute" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r="24" fill="none" stroke="#fff" strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - avatarProgress / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                    />
                  </svg>
                  <span className="text-white font-black text-xs relative z-10">{avatarProgress}%</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className={`cursor-pointer text-white text-xs font-bold px-4 py-2 rounded-xl transition inline-block text-center ${avatarUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-700'}`}>
                {avatarUploading ? `${avatarProgress}% ${isRtl ? 'جاري الرفع' : 'uploading'}` : (isRtl ? 'تغيير الصورة' : 'Change Photo')}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
              </label>
              {(avatarPreview || user.avatarUrl) && (
                <button onClick={handleAvatarDelete} disabled={avatarUploading} className="text-xs text-red-500 hover:text-red-700 transition font-semibold disabled:opacity-40">
                  {isRtl ? 'حذف الصورة' : 'Remove Photo'}
                </button>
              )}
              <p className="text-[10px] text-gray-400">{isRtl ? 'JPG أو PNG أو WebP — بحد أقصى 5MB' : 'JPG, PNG or WebP — max 5MB'}</p>
            </div>
          </div>

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
                const recs = childRecs[child.id] ?? [];
                return (
                  <div key={child.id} className="space-y-3">
                    {/* Child card */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
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

                    {/* Age-appropriate recommendations */}
                    {recs.length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                        <p className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-1">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z"/>
                          </svg>
                          {isRtl
                            ? `منتجات مناسبة لـ ${child.name} (${age} ${age === 1 ? 'سنة' : 'سنوات'})`
                            : `Picks for ${child.name} (${age} ${age === 1 ? 'year' : 'years'} old)`}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {recs.map(rec => (
                            <a
                              key={rec.id}
                              href={`/shop/${rec.slug}`}
                              className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition group block"
                            >
                              <div className="aspect-square bg-gray-100 overflow-hidden">
                                {rec.image ? (
                                  <img
                                    src={rec.image}
                                    alt={isRtl ? rec.name : (rec.nameEn || rec.name)}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-amber-100 to-yellow-50">📦</div>
                                )}
                              </div>
                              <div className="p-2">
                                <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight">
                                  {isRtl ? rec.name : (rec.nameEn || rec.name)}
                                </p>
                                <p className="text-xs text-amber-600 font-black mt-1">{rec.price} ج.م</p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
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

      {tab === 'membership' && (
        <div className="pb-4">
          {membershipLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !membership ? (
            /* ── NON-MEMBER VIEW ── */
            <div>
              {applyStep === 'idle' && (
                <>
                  {/* Hero */}
                  <div className="relative rounded-2xl overflow-hidden mb-5" style={{ background: 'linear-gradient(135deg,#1a3a2e 0%,#2d5a40 55%,#1e4a35 100%)' }}>
                    <div className="relative p-6 text-center text-white">
                      <div className="text-4xl mb-3">🌿</div>
                      <h2 className="text-xl font-black mb-2">{isRtl ? 'مجتمع مسلم ليدر' : 'Muslim Leader Community'}</h2>
                      <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.72)' }}>
                        {isRtl ? 'لأن تربية أسرة واعية رحلة لا نخوضها وحدنا' : 'Raising a conscious family is a journey we share together'}
                      </p>
                      <button onClick={() => setApplyStep('form')}
                        className="px-7 py-2.5 rounded-xl font-black text-sm transition active:scale-95"
                        style={{ background: '#D4A853', color: '#1a1a1a' }}>
                        {isRtl ? 'انضم للمجتمع ←' : 'Join the Community →'}
                      </button>
                    </div>
                  </div>

                  {/* Blurred card preview — encourages activation */}
                  <div className="relative mb-5" style={{ borderRadius: 20, overflow: 'hidden' }}>
                    {/* Actual card (blurred) */}
                    <div style={{
                      filter: 'blur(3px)', opacity: 0.55, pointerEvents: 'none',
                      borderRadius: 20, overflow: 'hidden',
                      background: 'linear-gradient(135deg,#0d2318 0%,#1a3a2e 40%,#163325 100%)',
                      padding: '6% 8%', display: 'flex', flexDirection: 'column', gap: 16,
                      minHeight: 160,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src="/logo-mobile.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                          <div>
                            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: '#D4A853' }}>MUSLIM LEADER</p>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{isRtl ? 'عضوية الأسرة المسلمة' : 'Family Membership'}</p>
                          </div>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 900, padding: '4px 10px', borderRadius: 20, background: 'rgba(52,211,153,0.25)', color: '#6ee7b7', border: '1px solid rgba(52,211,153,0.4)' }}>
                          {isRtl ? 'نشطة' : 'Active'}
                        </span>
                      </div>
                      <p dir="ltr" style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, letterSpacing: '0.22em', color: '#F5E6BE' }}>ML-026-00001</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{isRtl ? 'عضو منذ ٢٠٢٦' : 'MEMBER SINCE 2026'}</p>
                        <div>
                          <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 2 }}>{isRtl ? 'تنتهي' : 'VALID THRU'}</p>
                          <p dir="ltr" style={{ fontSize: 12, fontWeight: 900, color: '#D4A853' }}>12/27</p>
                        </div>
                      </div>
                    </div>
                    {/* Overlay */}
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 10,
                      background: 'rgba(13,35,24,0.55)', backdropFilter: 'blur(1px)',
                    }}>
                      <div style={{ fontSize: 28 }}>🔒</div>
                      <p style={{ fontSize: 13, fontWeight: 900, color: '#fff', textAlign: 'center' }}>
                        {isRtl ? 'فعّل عضويتك للحصول على البطاقة' : 'Activate membership to get your card'}
                      </p>
                      <button onClick={() => setApplyStep('form')}
                        style={{ background: '#D4A853', color: '#1a1a1a', fontWeight: 900, fontSize: 12, padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer' }}>
                        {isRtl ? 'اشترك الآن ←' : 'Subscribe Now →'}
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { icon: '👨‍👩‍👧', val: isRtl ? '+٥٠٠' : '500+', label: isRtl ? 'أسرة' : 'Families' },
                      { icon: '🏷️', val: '15%', label: isRtl ? 'خصم' : 'Discount' },
                      { icon: '📚', val: isRtl ? 'مجاني' : 'Free', label: isRtl ? 'مكتبة' : 'Library' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                        <div className="text-xl mb-1">{s.icon}</div>
                        <p className="font-black text-gray-900 text-base">{s.val}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Benefits */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-black text-gray-900 text-sm">{isRtl ? '✨ مزايا العضوية' : '✨ Member Benefits'}</h3>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(212,168,83,0.12)', color: '#9a7020' }}>
                        {isRtl ? 'حصري للأعضاء' : 'Members only'}
                      </span>
                    </div>
                    {perks.length > 0 ? (
                      <div className="space-y-2">
                        {perks.slice(0, 4).map(perk => (
                          <div key={perk.id} className="flex gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
                            {perk.imageUrl ? (
                              <img src={perk.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 relative" style={{ opacity: 0.5 }} />
                            ) : (
                              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 relative" style={{ background: 'rgba(212,168,83,0.1)' }}>🎁</div>
                            )}
                            <div className="min-w-0 flex-1 relative">
                              <p className="font-bold text-sm" style={{ color: '#6b7280' }}>{perk.title}</p>
                              {perk.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{perk.description}</p>}
                            </div>
                            <div className="relative flex items-center shrink-0">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.15)', color: '#9a7020' }}>
                                {isRtl ? 'حصري' : 'Exclusive'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: '🏷️', title: isRtl ? 'خصم ١٥٪' : '15% Discount', desc: isRtl ? 'على جميع المنتجات' : 'On all products' },
                          { icon: '📚', title: isRtl ? 'مكتبة رقمية' : 'Digital Library', desc: isRtl ? 'وصول لكل الكتب' : 'Full books access' },
                          { icon: '👨‍👩‍👧', title: isRtl ? 'عضوية عائلية' : 'Family Membership', desc: isRtl ? 'لأفراد الأسرة' : 'For family members' },
                          { icon: '🤝', title: isRtl ? 'مجتمع خاص' : 'Private Community', desc: isRtl ? 'شبكة أسر واعية' : 'Conscious families' },
                          { icon: '🎁', title: isRtl ? 'محتوى حصري' : 'Exclusive Content', desc: isRtl ? 'للأعضاء فقط' : 'Members only' },
                          { icon: '📱', title: isRtl ? 'تطبيق طريق' : 'Tareeq App', desc: isRtl ? 'ميزات متقدمة' : 'Advanced features' },
                        ].map(b => (
                          <div key={b.title} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                            <div className="text-2xl mb-1.5">{b.icon}</div>
                            <p className="font-bold text-gray-900 text-xs">{b.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{b.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Community feeling */}
                  <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'linear-gradient(135deg,#faf8f2 0%,#fef9ec 100%)', border: '1px solid rgba(212,168,83,0.2)' }}>
                    <div className="p-5">
                      <h3 className="font-black text-gray-900 text-sm mb-1">{isRtl ? 'أكثر من مجرد خصومات ✨' : 'More than just discounts ✨'}</h3>
                      <p className="text-xs text-gray-500 mb-4">{isRtl ? 'انضم لمجتمع من الآباء والأمهات الواعيين' : 'Join a community of mindful parents'}</p>
                      <div className="space-y-3">
                        {[
                          { icon: '💬', title: isRtl ? 'تبادل التجارب' : 'Share experiences', desc: isRtl ? 'تواصل مع أسر تشاركك نفس القيم' : 'Connect with families sharing your values' },
                          { icon: '📖', title: isRtl ? 'محتوى تربوي' : 'Educational content', desc: isRtl ? 'مواد حصرية لبناء الأسرة المسلمة' : 'Exclusive materials for Muslim families' },
                          { icon: '🌱', title: isRtl ? 'نمو مستمر' : 'Continuous growth', desc: isRtl ? 'مزايا جديدة كل شهر لأعضاء المجتمع' : 'New benefits every month for members' },
                        ].map(item => (
                          <div key={item.icon} className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: 'rgba(212,168,83,0.15)' }}>{item.icon}</div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{item.title}</p>
                              <p className="text-xs text-gray-400">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pricing card */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <span className="text-xs font-bold tracking-wider uppercase text-gray-400">{isRtl ? 'عضوية سنوية' : 'Annual Membership'}</span>
                          <p className="font-black text-gray-900 text-base mt-0.5">{isRtl ? 'اشترك الآن' : 'Subscribe Now'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black" style={{ color: '#1a3a2e' }}>
                            {membershipZone === 'egypt'
                              ? (isRtl ? `${membershipPrices.egyEgp} جنيه` : `${membershipPrices.egyEgp} EGP`)
                              : `$${membershipPrices.intlUsd}`}
                          </p>
                          <p className="text-xs text-gray-400">{isRtl ? '/ سنة' : '/ year'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4 text-xs text-gray-400 py-2 border-t border-gray-100">
                        <span>{membershipZone === 'egypt' ? '🇪🇬' : '🌍'}</span>
                        <span>{membershipZone === 'egypt' ? (isRtl ? 'داخل مصر — تم اكتشاف موقعك تلقائياً' : 'Egypt — location auto-detected') : (isRtl ? 'خارج مصر — تم اكتشاف موقعك تلقائياً' : 'International — location auto-detected')}</span>
                      </div>
                      <button onClick={() => setApplyStep('form')}
                        className="w-full py-3 rounded-xl font-black text-sm text-white transition active:scale-95"
                        style={{ background: 'linear-gradient(135deg,#1a3a2e,#2d5a40)' }}>
                        {isRtl ? 'انضم للمجتمع ←' : 'Join the Community →'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {applyStep === 'form' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-black text-gray-900 mb-4">{isRtl ? 'بيانات الاشتراك' : 'Membership Details'}</h3>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{isRtl ? 'اسم الأسرة (اختياري)' : 'Family Name (optional)'}</label>
                    <input value={applyFamilyName} onChange={e => setApplyFamilyName(e.target.value)}
                      placeholder={isRtl ? 'مثال: أسرة محمد أحمد' : 'e.g. Ahmed Family'}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-right mb-4"
                      dir="rtl" />
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4 py-2 border-t border-gray-100">
                      <span>{isRtl ? 'المبلغ:' : 'Amount:'}</span>
                      <span className="font-black text-gray-900">
                        {membershipZone === 'egypt'
                          ? (isRtl ? `${membershipPrices.egyEgp} جنيه مصري` : `${membershipPrices.egyEgp} EGP`)
                          : `$${membershipPrices.intlUsd} USD`}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => setApplyStep('paypal')}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition active:scale-[0.98]"
                        style={{ background: '#0070ba' }}>
                        <svg viewBox="0 0 24 24" width="20" fill="white"><path d="M9.5 6.5c0-1.4 1.1-2.5 2.5-2.5h3c2.2 0 4 1.8 4 4 0 1.8-1.2 3.3-2.8 3.8L15 14H9.5V6.5zM9.5 14H15l-.8 4H9.5V14z"/></svg>
                        {isRtl ? 'الدفع بـ PayPal أو بطاقة' : 'Pay with PayPal or Card'}
                      </button>
                      {membershipZone === 'egypt' && (
                        <>
                          {membershipPrices.instapayNumber && (
                            <button onClick={() => setApplyStep('instapay')}
                              className="w-full py-3 rounded-xl font-bold text-sm border-2 border-emerald-500 text-emerald-700 transition active:scale-[0.98] bg-emerald-50">
                              {isRtl ? '📲 إنستاباي / تحويل بنكي' : '📲 InstaPay / Bank Transfer'}
                            </button>
                          )}
                          <a href={`https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent('أريد الاشتراك في عضوية أسرة مسلم ليدر (كاش)')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="w-full py-3 rounded-xl font-bold text-sm border border-gray-200 text-gray-600 flex items-center justify-center gap-2 transition active:scale-[0.98] bg-gray-50">
                            💵 {isRtl ? 'كاش (تواصل معنا)' : 'Cash (Contact us)'}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setApplyStep('idle')} className="text-sm text-gray-400 w-full text-center py-2">
                    {isRtl ? 'رجوع' : 'Back'}
                  </button>
                </div>
              )}

              {applyStep === 'paypal' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="font-black text-gray-900 mb-1">{isRtl ? 'الدفع الآمن' : 'Secure Payment'}</h3>
                    <p className="text-xs text-gray-400 mb-4">
                      {membershipZone === 'egypt'
                        ? (isRtl ? `سيُخصم ما يعادل ${membershipPrices.egyEgp} جنيه ($${membershipPrices.egyUsd})` : `~${membershipPrices.egyEgp} EGP ($${membershipPrices.egyUsd})`)
                        : `$${membershipPrices.intlUsd} USD`}
                    </p>
                    <PayPalBookButton
                      createEndpoint="/api/membership/create"
                      captureEndpoint="/api/membership/activate"
                      amountUsd={membershipZone === 'egypt' ? membershipPrices.egyUsd : membershipPrices.intlUsd}
                      createBody={{ familyName: applyFamilyName.trim() || undefined, zone: membershipZone }}
                      isRtl={isRtl}
                      onSuccess={() => {
                        setApplyStep('success');
                        setMembership(null);
                        fetch('/api/membership', { credentials: 'include' })
                          .then(r => r.json()).then(d => setMembership(d.membership ?? null)).catch(() => {});
                      }}
                      onError={msg => alert(isRtl ? `خطأ في الدفع: ${msg}` : `Payment error: ${msg}`)}
                    />
                  </div>
                  <button onClick={() => setApplyStep('form')} className="text-sm text-gray-400 w-full text-center py-2">
                    {isRtl ? 'رجوع' : 'Back'}
                  </button>
                </div>
              )}

              {applyStep === 'instapay' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <h3 className="font-black text-gray-900">{isRtl ? 'التحويل عبر إنستاباي' : 'InstaPay Transfer'}</h3>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-emerald-600 mb-1">{isRtl ? 'رقم إنستاباي / ووليت' : 'InstaPay / Wallet number'}</p>
                      <p className="text-2xl font-black text-emerald-700 tracking-widest" dir="ltr">{membershipPrices.instapayNumber}</p>
                      <p className="text-xs text-emerald-600 mt-1">{isRtl ? 'باسم: مسلم ليدر' : 'Name: Moslim Leader'}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      {isRtl ? 'بعد التحويل، أرسل صورة الإيصال عبر واتساب. سيتم تفعيل عضويتك خلال ٢٤ ساعة.' : 'After transfer, send the receipt via WhatsApp. Your membership will be activated within 24 hours.'}
                    </div>
                    <button disabled={applyLoading}
                      onClick={async () => {
                        setApplyLoading(true);
                        try {
                          await fetch('/api/membership/request-manual', {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ familyName: applyFamilyName.trim() || undefined }),
                          });
                        } catch { /* non-fatal */ }
                        const msg = encodeURIComponent(`عضوية أسرة مسلم ليدر\nالاسم: ${applyFamilyName || user?.name || ''}\nالإيميل: ${user?.email || ''}\n(أرسل صورة الإيصال)`);
                        window.open(`https://wa.me/${SUPPORT_WA}?text=${msg}`, '_blank');
                        setApplyStep('pending');
                        setApplyLoading(false);
                      }}
                      className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.98]"
                      style={{ background: '#25D366' }}>
                      {applyLoading
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <>{isRtl ? '📤 أرسل صورة الإيصال عبر واتساب' : '📤 Send receipt via WhatsApp'}</>}
                    </button>
                  </div>
                  <button onClick={() => setApplyStep('form')} className="text-sm text-gray-400 w-full text-center py-2">
                    {isRtl ? 'رجوع' : 'Back'}
                  </button>
                </div>
              )}

              {applyStep === 'pending' && (
                <div className="text-center py-12 bg-amber-50 rounded-2xl border border-amber-200">
                  <div className="text-5xl mb-3">⏳</div>
                  <p className="font-black text-gray-900 text-lg mb-2">{isRtl ? 'جاري مراجعة طلبك' : 'Reviewing your request'}</p>
                  <p className="text-gray-500 text-sm max-w-xs mx-auto">{isRtl ? 'سيتم تفعيل عضويتك بعد التحقق من الدفع. قد يستغرق ذلك حتى ٢٤ ساعة.' : 'Your membership will be activated after payment verification, within 24 hours.'}</p>
                </div>
              )}

              {applyStep === 'success' && (
                <div className="text-center py-12 rounded-2xl border" style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderColor: '#86efac' }}>
                  <div className="text-5xl mb-3">🎉</div>
                  <p className="font-black text-gray-900 text-lg mb-2">{isRtl ? 'مبروك! أنت الآن عضو في مجتمعنا' : 'Congratulations! You are now a member'}</p>
                  <p className="text-gray-500 text-sm">{isRtl ? 'مرحباً بك في مجتمع مسلم ليدر' : 'Welcome to the Muslim Leader community'}</p>
                </div>
              )}
            </div>
          ) : (
            /* ── MEMBER VIEW ── */
            <div className="space-y-5">
              {/* Digital membership card — grey when inactive + not acknowledged, green community when acknowledged */}
              {(membership.tier === 'community' || ((membership.status === 'EXPIRED' || membership.status === 'CANCELLED') && communityAcknowledged))
                ? (
                  <MembershipCard
                    variant="community"
                    memberNumber={membership.membershipNumber}
                    name={user!.name}
                    joinedYear={membership.memberSince}
                    qrDataUrl={membershipQrUrl}
                    isRtl={isRtl}
                  />
                ) : (
                  <MembershipCard
                    variant="leader"
                    memberNumber={membership.membershipNumber}
                    familyName={membership.familyName}
                    memberSince={membership.memberSince}
                    expiresAt={membership.expiresAt ?? undefined}
                    status={membership.status as 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'CANCELLED'}
                    qrDataUrl={membershipQrUrl}
                    isRtl={isRtl}
                  />
                )
              }

              {/* ── CTA for EXPIRED / CANCELLED ── */}
              {(membership.status === 'EXPIRED' || membership.status === 'CANCELLED') && renewStep === 'idle' && (
                !communityAcknowledged ? (
                  /* State A: grey card → two side-by-side buttons */
                  <div style={{ marginTop: 10, display: 'flex', gap: 10, maxWidth: 380, marginInline: 'auto', width: '100%' }}>
                    {/* Renew button — bright yellow */}
                    <button
                      onClick={() => {
                        setRenewStep('paypal');
                        setTimeout(() => renewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                      }}
                      style={{
                        flex: 1, padding: '13px 0', borderRadius: 14,
                        background: 'linear-gradient(135deg, #FFCC00 0%, #FFD740 100%)',
                        color: '#1a0800', fontWeight: 900, fontSize: 15,
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(255,204,0,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                      </svg>
                      {isRtl ? 'جدد' : 'Renew'}
                    </button>
                    {/* Keep community button — visible on light bg */}
                    <button
                      onClick={async () => {
                        setCommunityAcknowledged(true);
                        try { localStorage.setItem('ml_comm_choice', '1'); } catch {}
                        fetch('/api/membership/community-choice', { method: 'POST', credentials: 'include' }).catch(() => {});
                        if (upsellPerks.length === 0) {
                          fetch('/api/membership/perks?preview=1')
                            .then(r => r.ok ? r.json() : null)
                            .then(d => setUpsellPerks((d?.perks ?? []).filter((p: {forTier?: string}) => p.forTier !== 'all').slice(0, 6)))
                            .catch(() => {});
                        }
                      }}
                      style={{
                        flex: 1, padding: '13px 0', borderRadius: 14,
                        background: '#f3f4f6', border: '1px solid #e5e7eb',
                        color: '#4b5563', fontWeight: 700, fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {isRtl ? 'اكتفِ' : 'Keep free'}
                    </button>
                  </div>
                ) : (
                  /* State B: green community card → upgrade prompt + leader perks list */
                  <div style={{ marginTop: 10, maxWidth: 380, marginInline: 'auto', width: '100%' }}>
                    <button
                      onClick={() => {
                        setCommunityAcknowledged(false);
                        setRenewStep('paypal');
                        setTimeout(() => renewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                      }}
                      style={{
                        width: '100%', padding: '13px 0', borderRadius: 14,
                        background: 'linear-gradient(135deg, #FFCC00 0%, #FFD740 100%)',
                        color: '#1a0800', fontWeight: 900, fontSize: 14,
                        border: 'none', cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(255,204,0,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                      </svg>
                      {isRtl ? 'جدد للعضوية الرائدة لمزيد من المميزات' : 'Upgrade to Leader for more benefits'}
                    </button>
                    {/* Leader perks list — on light background */}
                    {upsellPerks.length > 0 && (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 14, background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                        {upsellPerks.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ color: '#D4A853', fontSize: 11, flexShrink: 0 }}>✦</span>
                            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.4 }}>{p.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Discount badge + share row */}
              <div className="flex items-center gap-3">
                {membership.status === 'ACTIVE' && (
                  <div className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 px-4" style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)' }}>
                    <span className="text-xs font-black" style={{ color: '#D4A853' }}>🏷️ {isRtl ? 'خصم ١٥٪ تلقائي' : '15% auto discount'}</span>
                  </div>
                )}
                <button
                  onClick={async () => {
                    const text = isRtl
                      ? `عضوية مسلم ليدر 🌿\n${membership.familyName ? membership.familyName + '\n' : ''}رقم العضوية: ${membership.membershipNumber}\nعضو منذ ${membership.memberSince}`
                      : `Muslim Leader Membership 🌿\n${membership.familyName ? membership.familyName + '\n' : ''}Membership No: ${membership.membershipNumber}\nMember since ${membership.memberSince}`;
                    if (navigator.share) {
                      await navigator.share({ text }).catch(() => {});
                    } else {
                      await navigator.clipboard.writeText(text).catch(() => {});
                      alert(isRtl ? 'تم نسخ بيانات البطاقة' : 'Card info copied');
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full py-2 px-4 transition active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700 }}
                >
                  <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/>
                  </svg>
                  {isRtl ? 'مشاركة' : 'Share'}
                </button>
              </div>

              {/* Family members */}
              {membership.familyMembers.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-black text-gray-900 mb-4 text-sm">{isRtl ? '👨‍👩‍👧 أفراد الأسرة' : '👨‍👩‍👧 Family Members'}</h3>
                  <div className="space-y-3">
                    {membership.familyMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0" style={{ background: 'linear-gradient(135deg,#1a3a2e,#2d5a40)' }}>
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{m.name}</p>
                          {m.relation && <p className="text-xs text-gray-500">{m.relation}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Membership perks */}
              {perks.length > 0 && (
                <div>
                  <h3 className="font-black text-gray-900 mb-3 text-sm">{isRtl ? '✨ مزاياك الحصرية' : '✨ Your Exclusive Benefits'}</h3>
                  <div className="space-y-2.5">
                    {perks.map(perk => (
                      <div key={perk.id} className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
                        <div className="flex gap-3 p-4">
                          {perk.imageUrl ? (
                            <img src={perk.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'rgba(212,168,83,0.1)' }}>🎁</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-sm">{perk.title}</p>
                            {perk.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{perk.description}</p>}
                            {perk.validUntil && (
                              <p className="text-xs text-amber-600 mt-1">
                                {isRtl ? `صالح حتى: ${new Date(perk.validUntil).toLocaleDateString('ar-EG')}` : `Valid until: ${new Date(perk.validUntil).toLocaleDateString()}`}
                              </p>
                            )}
                            {perk.linkUrl && (
                              <a href={perk.linkUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 text-xs font-bold px-3 py-1 rounded-full"
                                style={{ background: 'rgba(212,168,83,0.15)', color: '#9a7020' }}>
                                {isRtl ? 'استفد الآن ←' : 'Claim now →'}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status actions for expired/cancelled/pending */}
              {membership.status !== 'ACTIVE' && (
                <div ref={renewSectionRef} className="space-y-3 mt-2">
                  {(membership.status === 'EXPIRED' || membership.status === 'CANCELLED') && renewStep === 'paypal' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                      <h3 className="font-black text-gray-900">{isRtl ? 'تجديد العضوية' : 'Renew Membership'}</h3>
                      <p className="text-sm text-gray-500">
                        {membershipZone === 'egypt'
                          ? (isRtl ? `سيُخصم ما يعادل ${membershipPrices.egyEgp} جنيه ($${membershipPrices.egyUsd})` : `~${membershipPrices.egyEgp} EGP ($${membershipPrices.egyUsd})`)
                          : `$${membershipPrices.intlUsd} USD`}
                      </p>
                      <PayPalBookButton
                        createEndpoint="/api/membership/renew-create"
                        captureEndpoint="/api/membership/renew-capture"
                        amountUsd={membershipZone === 'egypt' ? membershipPrices.egyUsd : membershipPrices.intlUsd}
                        createBody={{ zone: membershipZone }}
                        extraBody={{ zone: membershipZone }}
                        isRtl={isRtl}
                        onSuccess={() => {
                          setRenewStep('success');
                          fetch('/api/membership', { credentials: 'include' })
                            .then(r => r.json()).then(d => setMembership(d.membership ?? null)).catch(() => {});
                        }}
                        onError={msg => alert(isRtl ? `خطأ في الدفع: ${msg}` : `Payment error: ${msg}`)}
                      />
                      {membershipPrices.instapayNumber && membershipZone === 'egypt' && (
                        <button
                          onClick={() => setRenewStep('instapay')}
                          className="w-full py-3 rounded-xl font-bold text-sm border border-gray-200 text-gray-700 flex items-center justify-center gap-2 bg-gray-50 transition active:scale-[0.98]"
                        >
                          💳 {isRtl ? 'دفع عبر إنستاباي / محفظة' : 'Pay via InstaPay / Wallet'}
                        </button>
                      )}
                      <button onClick={() => setRenewStep('idle')} className="w-full py-2.5 text-sm font-bold text-gray-500 text-center border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                        {isRtl ? '← رجوع' : '← Back'}
                      </button>
                    </div>
                  )}

                  {(membership.status === 'EXPIRED' || membership.status === 'CANCELLED') && renewStep === 'instapay' && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                      <h3 className="font-black text-gray-900">{isRtl ? 'التجديد عبر إنستاباي' : 'Renew via InstaPay'}</h3>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                        <p className="text-xs text-emerald-600 mb-1">{isRtl ? 'رقم إنستاباي / ووليت' : 'InstaPay / Wallet number'}</p>
                        <p className="text-2xl font-black text-emerald-700 tracking-widest" dir="ltr">{membershipPrices.instapayNumber}</p>
                        <p className="text-xs text-emerald-600 mt-1">{isRtl ? 'باسم: مسلم ليدر' : 'Name: Moslim Leader'}</p>
                        <p className="text-xs text-emerald-700 font-bold mt-2">{isRtl ? `المبلغ: ${membershipPrices.egyEgp} ج.م` : `Amount: ${membershipPrices.egyEgp} EGP`}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                        {isRtl ? 'بعد التحويل، أرسل صورة الإيصال عبر واتساب. سيتم تفعيل العضوية خلال ٢٤ ساعة.' : 'After transfer, send the receipt via WhatsApp. Membership will be activated within 24 hours.'}
                      </div>
                      <button onClick={() => setRenewStep('paypal')} className="w-full py-2.5 text-sm font-bold text-gray-500 text-center border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                        {isRtl ? '← رجوع' : '← Back'}
                      </button>
                    </div>
                  )}

                  {(membership.status === 'EXPIRED' || membership.status === 'CANCELLED') && renewStep === 'success' && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-2">
                      <div className="text-4xl">✅</div>
                      <p className="font-black text-green-800">{isRtl ? 'تم تجديد عضويتك بنجاح!' : 'Membership renewed successfully!'}</p>
                      <p className="text-sm text-green-600">{isRtl ? 'تمتع بجميع امتيازات العضوية.' : 'Enjoy all membership benefits.'}</p>
                    </div>
                  )}

                  {membership.status === 'PENDING' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 text-center">
                      <p className="font-bold mb-1">⏳ {isRtl ? 'جاري مراجعة طلبك' : 'Reviewing your request'}</p>
                      <p>{isRtl ? 'سيتم تفعيل عضويتك بعد التحقق من الدفع.' : 'Your membership will be activated after payment verification.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SUPPORT TAB ── */}
      {tab === 'support' && (
        <SupportTab />
      )}
    </div>
  );
}

interface SupportRequest {
  id: string; status: string; reason: string; note?: string;
  createdAt: string; expiresAt?: string;
  product: { id: string; name: string; slug: string; images?: string[] };
  allocation?: { supportType: string; mlSupportAmount: number; customerPayAmount: number } | null;
  currency: string;
}

function SupportTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/api/support-requests').then(r => r.json()).then(d => {
      setRequests(d.requests ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const cancel = async (id: string) => {
    const res = await fetch(`/api/support-requests/${id}`, { method: 'DELETE' });
    if (res.ok) setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r));
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>;

  if (requests.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div className="text-4xl mb-3">📋</div>
      <p className="text-gray-500 text-sm">لا توجد طلبات دعم بعد</p>
      <a href="/shop" className="inline-block mt-4 text-sm text-blue-600 hover:underline">تصفح المنتجات</a>
    </div>
  );

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDING:      { label: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800' },
    UNDER_REVIEW: { label: 'جاري المراجعة', color: 'bg-blue-100 text-blue-800' },
    APPROVED:     { label: 'موافق — في انتظار الاستخدام', color: 'bg-green-100 text-green-800' },
    COPY_ASSIGNED:{ label: 'نسخة مخصصة لك', color: 'bg-green-100 text-green-800' },
    REJECTED:     { label: 'لم تتم الموافقة', color: 'bg-red-100 text-red-800' },
    EXPIRED:      { label: 'انتهت الصلاحية', color: 'bg-gray-100 text-gray-600' },
    CANCELLED:    { label: 'ملغى', color: 'bg-gray-100 text-gray-500' },
    USED:         { label: 'تم الاستخدام', color: 'bg-green-100 text-green-800' },
  };

  return (
    <div className="space-y-4" dir="rtl">
      <h2 className="text-lg font-black text-gray-900">طلبات دعم السعر</h2>
      {requests.map(req => {
        const statusInfo = STATUS_LABELS[req.status] ?? { label: req.status, color: 'bg-gray-100 text-gray-600' };
        const img = req.product?.images?.[0];
        return (
          <div key={req.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-5">
              <div className="flex items-start gap-4">
                {img && <img src={img} alt={req.product.name} className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <a href={`/shop/${req.product.slug}`} className="font-semibold text-gray-900 hover:text-blue-700 text-sm leading-tight">{req.product.name}</a>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(req.createdAt).toLocaleDateString('ar-EG')}</p>
                  {req.allocation && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                      <p className="font-medium text-green-800">تمت الموافقة على الدعم</p>
                      <div className="flex items-center justify-between mt-1 text-xs text-green-700">
                        <span>السعر بعد الدعم</span>
                        <span className="font-bold">{req.allocation.customerPayAmount.toLocaleString('ar-EG')} {req.currency === 'EGP' ? 'ج.م' : req.currency}</span>
                      </div>
                      {req.expiresAt && <p className="text-xs text-green-600 mt-1">صالح حتى: {new Date(req.expiresAt).toLocaleDateString('ar-EG')}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {req.status === 'PENDING' && (
              <div className="px-5 pb-4">
                <button onClick={() => cancel(req.id)} className="text-xs text-red-500 hover:text-red-700">إلغاء الطلب</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
