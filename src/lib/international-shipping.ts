export type Carrier = 'aramex' | 'fedex' | 'dhl';
export type ShippingZone = 'arab' | 'europe' | 'usa_canada' | 'world';

export interface Country {
  code: string;
  name: string;
  nameEn: string;
  zone: ShippingZone;
}

export interface CarrierRate {
  ratePerKg: number; // EGP per kg
  minCharge: number; // EGP minimum
  estimatedDays: string;
}

// Carrier rates per zone (EGP)
export const carrierRates: Record<Carrier, Record<ShippingZone, CarrierRate>> = {
  aramex: {
    arab:      { ratePerKg: 150, minCharge: 300,  estimatedDays: '3-5' },
    europe:    { ratePerKg: 320, minCharge: 640,  estimatedDays: '5-8' },
    usa_canada:{ ratePerKg: 420, minCharge: 840,  estimatedDays: '7-10' },
    world:     { ratePerKg: 370, minCharge: 740,  estimatedDays: '6-9' },
  },
  fedex: {
    arab:      { ratePerKg: 180, minCharge: 360,  estimatedDays: '2-4' },
    europe:    { ratePerKg: 360, minCharge: 720,  estimatedDays: '4-6' },
    usa_canada:{ ratePerKg: 460, minCharge: 920,  estimatedDays: '5-7' },
    world:     { ratePerKg: 410, minCharge: 820,  estimatedDays: '5-8' },
  },
  dhl: {
    arab:      { ratePerKg: 170, minCharge: 340,  estimatedDays: '2-4' },
    europe:    { ratePerKg: 340, minCharge: 680,  estimatedDays: '4-6' },
    usa_canada:{ ratePerKg: 440, minCharge: 880,  estimatedDays: '5-7' },
    world:     { ratePerKg: 390, minCharge: 780,  estimatedDays: '5-8' },
  },
};

// Calculate shipping cost in EGP based on weight (grams) and carrier/zone
export function calculateInternationalShipping(weightGrams: number, carrier: Carrier, zone: ShippingZone): number {
  const rate = carrierRates[carrier][zone];
  const weightKg = Math.max(weightGrams / 1000, 0.5); // minimum 0.5 kg
  const cost = weightKg * rate.ratePerKg;
  return Math.max(Math.ceil(cost), rate.minCharge);
}

export const countries: Country[] = [
  // Arab countries
  { code: 'SA', name: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', zone: 'arab' },
  { code: 'AE', name: 'الإمارات العربية المتحدة', nameEn: 'United Arab Emirates', zone: 'arab' },
  { code: 'KW', name: 'الكويت', nameEn: 'Kuwait', zone: 'arab' },
  { code: 'QA', name: 'قطر', nameEn: 'Qatar', zone: 'arab' },
  { code: 'BH', name: 'البحرين', nameEn: 'Bahrain', zone: 'arab' },
  { code: 'OM', name: 'عُمان', nameEn: 'Oman', zone: 'arab' },
  { code: 'JO', name: 'الأردن', nameEn: 'Jordan', zone: 'arab' },
  { code: 'LB', name: 'لبنان', nameEn: 'Lebanon', zone: 'arab' },
  { code: 'IQ', name: 'العراق', nameEn: 'Iraq', zone: 'arab' },
  { code: 'SY', name: 'سوريا', nameEn: 'Syria', zone: 'arab' },
  { code: 'YE', name: 'اليمن', nameEn: 'Yemen', zone: 'arab' },
  { code: 'LY', name: 'ليبيا', nameEn: 'Libya', zone: 'arab' },
  { code: 'TN', name: 'تونس', nameEn: 'Tunisia', zone: 'arab' },
  { code: 'DZ', name: 'الجزائر', nameEn: 'Algeria', zone: 'arab' },
  { code: 'MA', name: 'المغرب', nameEn: 'Morocco', zone: 'arab' },
  { code: 'SD', name: 'السودان', nameEn: 'Sudan', zone: 'arab' },
  // Europe
  { code: 'GB', name: 'المملكة المتحدة', nameEn: 'United Kingdom', zone: 'europe' },
  { code: 'DE', name: 'ألمانيا', nameEn: 'Germany', zone: 'europe' },
  { code: 'FR', name: 'فرنسا', nameEn: 'France', zone: 'europe' },
  { code: 'NL', name: 'هولندا', nameEn: 'Netherlands', zone: 'europe' },
  { code: 'BE', name: 'بلجيكا', nameEn: 'Belgium', zone: 'europe' },
  { code: 'IT', name: 'إيطاليا', nameEn: 'Italy', zone: 'europe' },
  { code: 'ES', name: 'إسبانيا', nameEn: 'Spain', zone: 'europe' },
  { code: 'SE', name: 'السويد', nameEn: 'Sweden', zone: 'europe' },
  { code: 'NO', name: 'النرويج', nameEn: 'Norway', zone: 'europe' },
  { code: 'DK', name: 'الدنمارك', nameEn: 'Denmark', zone: 'europe' },
  { code: 'CH', name: 'سويسرا', nameEn: 'Switzerland', zone: 'europe' },
  { code: 'AT', name: 'النمسا', nameEn: 'Austria', zone: 'europe' },
  { code: 'TR', name: 'تركيا', nameEn: 'Turkey', zone: 'europe' },
  // USA & Canada
  { code: 'US', name: 'الولايات المتحدة', nameEn: 'United States', zone: 'usa_canada' },
  { code: 'CA', name: 'كندا', nameEn: 'Canada', zone: 'usa_canada' },
  // Rest of World
  { code: 'AU', name: 'أستراليا', nameEn: 'Australia', zone: 'world' },
  { code: 'NZ', name: 'نيوزيلندا', nameEn: 'New Zealand', zone: 'world' },
  { code: 'MY', name: 'ماليزيا', nameEn: 'Malaysia', zone: 'world' },
  { code: 'ID', name: 'إندونيسيا', nameEn: 'Indonesia', zone: 'world' },
  { code: 'PK', name: 'باكستان', nameEn: 'Pakistan', zone: 'world' },
  { code: 'IN', name: 'الهند', nameEn: 'India', zone: 'world' },
  { code: 'ZA', name: 'جنوب أفريقيا', nameEn: 'South Africa', zone: 'world' },
];

export const carrierNames: Record<Carrier, string> = {
  aramex: 'Aramex',
  fedex: 'FedEx',
  dhl: 'DHL',
};
