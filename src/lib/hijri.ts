// Zero-dependency Hijri (Umm al-Qura) date helpers built on top of
// `Intl.DateTimeFormat`. Modern Node/V8 ships the `islamic-umalqura`
// calendar so we don't need an extra npm package. All functions are
// pure and stable for the same Gregorian input.

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

interface HijriParts { year: number; month: number; day: number; label: string }

// Convert a Gregorian Date to Hijri (Umm al-Qura). Uses the locale
// formatter and parses the parts back into integers, so it's stable
// across Node/browser environments.
export function gregorianToHijri(d: Date = new Date()): HijriParts {
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => Number((parts.find(p => p.type === t) ?? { value: '0' }).value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const label = `${day} ${HIJRI_MONTHS_AR[month - 1] ?? `شهر ${month}`} ${year}`;
  return { year, month, day, label };
}

export function hijriYearString(d: Date = new Date()): string {
  return String(gregorianToHijri(d).year);
}

// Days remaining (positive = before, 0 = today, negative = past) until
// the next occurrence of 1 Dhul-Hijjah from the given date. Walks one
// day at a time up to a cap of 365 (the answer is always within a year).
export function daysUntilNextDhulHijjah1(from: Date = new Date()): number {
  const cur = gregorianToHijri(from);
  if (cur.month === 12 && cur.day === 1) return 0;
  // Walk forward day by day until we hit month=12 day=1.
  for (let i = 1; i <= 365; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const h = gregorianToHijri(d);
    if (h.month === 12 && h.day === 1) return i;
  }
  return 365; // shouldn't hit; safety
}

export function isWithinDaysBeforeDhulHijjah1(from: Date, days: number): boolean {
  const remaining = daysUntilNextDhulHijjah1(from);
  return remaining > 0 && remaining <= days;
}

// Build the canonical "1 ذو الحجة YYYY" label for a given Hijri year
// without needing a corresponding Gregorian date — used when stamping
// a snapshot. The Gregorian date attached to the snapshot is whatever
// the admin clicked save on.
export function dhulHijjah1Label(hijriYear: number): string {
  return `1 ذو الحجة ${hijriYear}`;
}
