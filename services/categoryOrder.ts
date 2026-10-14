import { normalizeSearch } from './catalogSearch';

export function isMensCategory(category: string): boolean {
  const name = normalizeSearch(category);
  if (/\b(mujer|mujeres|dama|damas|femenin[ao]s?|woman|women|nina|ninas)\b/.test(name)) return false;
  return /\b(hombre|hombres|caballero|caballeros|masculin[ao]s?|varon|varones|men|mens|nino|ninos|street|camisas?|camisetas?)\b/.test(name);
}

export function orderCategories(categories: string[]): string[] {
  return [...new Set(categories)].sort((a, b) => Number(isMensCategory(a)) - Number(isMensCategory(b)) || a.localeCompare(b, 'es', { numeric: true }));
}
