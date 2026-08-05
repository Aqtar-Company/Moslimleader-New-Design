'use client';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

interface Props {
  onCreateClick: () => void;
  postCount?: number;
}

const PLATFORM_URL = 'https://moslimleader.com/tareeq';

function ShareButton({ href, label, color, children }: { href: string; label: string; color: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90 active:scale-95"
      style={{ background: color }}
    >
      {children}
    </a>
  );
}

export default function TareeqSidebar({ onCreateClick, postCount }: Props) {
  const { isRtl } = useLang();
  const { user } = useAuth();

  const tagline = encodeURIComponent(isRtl
    ? 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — اترك علامة يهتدي بها غيرك'
    : 'وَبِالنَّجْمِ هُمْ يَهْتَدُونَ — Leave a mark to guide others');
  const platformText = encodeURIComponent(`${isRtl ? 'طريق — اترك علامة يهتدي بها غيرك' : 'Tareeq — Leave a mark to guide others'} ${PLATFORM_URL}`);
  const encodedUrl = encodeURIComponent(PLATFORM_URL);

  const socialLinks = [
    {
      label: 'Twitter / X',
      href: `https://twitter.com/intent/tweet?text=${tagline}&url=${encodedUrl}`,
      color: '#000000',
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 5.48zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${platformText}`,
      color: '#25D366',
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 32 32" fill="currentColor">
          <path d="M16 3C8.82 3 3 8.82 3 16c0 2.34.64 4.63 1.85 6.63L3 29l6.54-1.81A13 13 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.85a10.84 10.84 0 01-5.54-1.52l-.4-.24-4.13 1.14 1.1-4.03-.26-.42A10.85 10.85 0 015.15 16C5.15 9.99 10 5.15 16 5.15S26.85 9.99 26.85 16 22.01 26.85 16 26.85zm6-8.13c-.33-.16-1.94-.96-2.24-1.07-.3-.1-.52-.16-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.16-1.39-.51-2.65-1.63-.98-.87-1.64-1.95-1.83-2.28-.19-.33-.02-.5.14-.67.15-.14.33-.38.5-.57.16-.19.22-.33.33-.55.1-.22.05-.41-.03-.57-.08-.16-.74-1.78-1.01-2.44-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.41-.3.33-1.14 1.11-1.14 2.71s1.17 3.14 1.33 3.36c.16.22 2.3 3.52 5.58 4.93.78.34 1.39.54 1.87.69.78.25 1.5.21 2.06.13.63-.09 1.94-.79 2.21-1.56.28-.77.28-1.42.19-1.56-.08-.14-.3-.22-.63-.38z" />
        </svg>
      ),
    },
    {
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: '#1877F2',
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
      ),
    },
    {
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${tagline}`,
      color: '#0088CC',
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.562 8.248l-2.008 9.463c-.151.668-.543.831-1.099.517l-3.044-2.243-1.467 1.415c-.163.163-.299.299-.614.299l.218-3.099 5.641-5.099c.245-.218-.053-.34-.381-.122L6.4 14.41l-2.981-.932c-.648-.201-.661-.648.135-.963l11.648-4.493c.541-.194 1.014.134.36.226z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Profile card */}
      {user && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm truncate">{user.name}</p>
              {postCount != null && (
                <p className="text-[11px] text-gray-400">{isRtl ? `${postCount} علامة` : `${postCount} marks`}</p>
              )}
            </div>
          </div>
          <Link
            href="/tareeq/profile"
            className="flex items-center justify-center gap-1.5 w-full bg-[#0a1f1a] text-white text-xs font-bold py-2 rounded-xl hover:bg-emerald-900 transition"
          >
            {isRtl ? 'منشوراتي' : 'My Posts'}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={isRtl ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
            </svg>
          </Link>
        </div>
      )}

      {/* Leave a mark CTA */}
      <button
        onClick={onCreateClick}
        className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-sm py-3 rounded-2xl transition shadow-sm shadow-emerald-900/20"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {isRtl ? 'اترك علامتك' : 'Leave Your Mark'}
      </button>

      {/* Share طريق */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs font-black text-gray-800 mb-3">
          {isRtl ? 'شارك طريق' : 'Share Tareeq'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {socialLinks.map(s => (
            <ShareButton key={s.label} href={s.href} label={s.label} color={s.color}>
              {s.icon}
              <span>{s.label}</span>
            </ShareButton>
          ))}
        </div>
      </div>

      {/* About طريق */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs font-black text-gray-800 mb-2">
          {isRtl ? 'عن طريق' : 'About Tareeq'}
        </p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          {isRtl
            ? 'طريق هي مساحة مجتمعية لمشاركة التجارب والأفكار والقصص التي تهدي غيرك. وَبِالنَّجْمِ هُمْ يَهْتَدُونَ.'
            : 'Tareeq is a community space for sharing experiences, ideas, and stories that guide others. وَبِالنَّجْمِ هُمْ يَهْتَدُونَ.'}
        </p>
      </div>
    </div>
  );
}
