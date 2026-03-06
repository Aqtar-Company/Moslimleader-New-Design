export interface Governorate {
  id: string;
  name: string;
  nameEn: string;
  shipping: number;
}

export const governorates: Governorate[] = [
  { id: 'cairo', name: 'القاهرة', nameEn: 'Cairo', shipping: 50 },
  { id: 'giza', name: 'الجيزة', nameEn: 'Giza', shipping: 50 },
  { id: 'qalyubia', name: 'القليوبية', nameEn: 'Qalyubia', shipping: 55 },
  { id: 'alexandria', name: 'الإسكندرية', nameEn: 'Alexandria', shipping: 65 },
  { id: 'sharqia', name: 'الشرقية', nameEn: 'Sharqia', shipping: 65 },
  { id: 'dakahlia', name: 'الدقهلية', nameEn: 'Dakahlia', shipping: 65 },
  { id: 'gharbia', name: 'الغربية', nameEn: 'Gharbia', shipping: 65 },
  { id: 'monufia', name: 'المنوفية', nameEn: 'Monufia', shipping: 65 },
  { id: 'suez', name: 'السويس', nameEn: 'Suez', shipping: 65 },
  { id: 'ismailia', name: 'الإسماعيلية', nameEn: 'Ismailia', shipping: 65 },
  { id: 'port-said', name: 'بورسعيد', nameEn: 'Port Said', shipping: 65 },
  { id: 'beheira', name: 'البحيرة', nameEn: 'Beheira', shipping: 70 },
  { id: 'damietta', name: 'دمياط', nameEn: 'Damietta', shipping: 70 },
  { id: 'kafr-sheikh', name: 'كفر الشيخ', nameEn: 'Kafr el-Sheikh', shipping: 70 },
  { id: 'fayoum', name: 'الفيوم', nameEn: 'Fayoum', shipping: 70 },
  { id: 'beni-suef', name: 'بني سويف', nameEn: 'Beni Suef', shipping: 80 },
  { id: 'minya', name: 'المنيا', nameEn: 'Minya', shipping: 80 },
  { id: 'asyut', name: 'أسيوط', nameEn: 'Asyut', shipping: 85 },
  { id: 'sohag', name: 'سوهاج', nameEn: 'Sohag', shipping: 85 },
  { id: 'qena', name: 'قنا', nameEn: 'Qena', shipping: 90 },
  { id: 'luxor', name: 'الأقصر', nameEn: 'Luxor', shipping: 90 },
  { id: 'aswan', name: 'أسوان', nameEn: 'Aswan', shipping: 95 },
  { id: 'red-sea', name: 'البحر الأحمر', nameEn: 'Red Sea', shipping: 95 },
  { id: 'north-sinai', name: 'شمال سيناء', nameEn: 'North Sinai', shipping: 95 },
  { id: 'south-sinai', name: 'جنوب سيناء', nameEn: 'South Sinai', shipping: 100 },
  { id: 'matruh', name: 'مطروح', nameEn: 'Matruh', shipping: 100 },
  { id: 'new-valley', name: 'الوادي الجديد', nameEn: 'New Valley', shipping: 100 },
];

export function getShipping(governorateId: string): number {
  return governorates.find(g => g.id === governorateId)?.shipping ?? 80;
}
