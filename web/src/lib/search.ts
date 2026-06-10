// Fold a string for accent-insensitive search: lowercase + strip diacritics
// (so "turkiye" matches "Türkiye", "mbappe" matches "Mbappé").
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}
