export function ageInYears(birthdate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age--;
  return Math.max(0, age);
}

export function ageLabel(birthdate: Date): string {
  const now = new Date();
  let years = now.getFullYear() - birthdate.getFullYear();
  let months = now.getMonth() - birthdate.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < birthdate.getDate()) months--;
  if (months < 0) { years--; months += 11; }
  years = Math.max(0, years);
  months = Math.max(0, months);
  if (years === 0) return `${months} شهر`;
  if (months === 0) return `${years} سنة`;
  return `${years} سنة ${months} شهر`;
}
