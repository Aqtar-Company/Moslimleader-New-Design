// Single source of truth for Egyptian phone handling.
// Egypt mobile prefixes: 010, 011, 012, 015. Anything else is rejected.

const VALID_LOCAL = /^01[0125]\d{8}$/;
const VALID_NATIONAL_NO_LEADING_ZERO = /^1[0125]\d{8}$/;

// Strip every non-digit, drop +20 / 0020 / 20 country code, ensure leading 0.
// Returns canonical 11-digit `01xxxxxxxxx` or null.
export function normalizeEgyptPhone(input?: string | null): string | null {
  if (!input) return null;
  let digits = input.replace(/\D+/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (digits.startsWith('20') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 10 && VALID_NATIONAL_NO_LEADING_ZERO.test(digits)) digits = '0' + digits;
  if (digits.length === 11 && VALID_LOCAL.test(digits)) return digits;
  return null;
}

// `01xxxxxxxxx` → `201xxxxxxxxx` (no +) for wa.me / international SMS.
export function toIntlPhone(input?: string | null): string | null {
  const local = normalizeEgyptPhone(input);
  if (!local) return null;
  return '20' + local.slice(1);
}

// Build a wa.me click-to-chat URL with optional pre-filled message.
export function whatsappLink(phone?: string | null, message?: string): string | null {
  const intl = toIntlPhone(phone);
  if (!intl) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${intl}${text}`;
}
