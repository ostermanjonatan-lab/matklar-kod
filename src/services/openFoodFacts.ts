/**
 * Packaged foods from Open Food Facts, for nutrition from the package: search by name or barcode
 * (8 to 14 digits), and the products as the app uses them. Used by api/food-search.ts (the app's
 * function, since Open Food Facts' search does not answer browsers on other sites), by the dev
 * server in vite.config.ts and by services/foodSearch.ts.
 * api/food-search.ts has a copy of this search code: keep the two the same.
 * Data: Open Food Facts, https://world.openfoodfacts.org (Open Database License).
 */

const USER_AGENT = 'MatKlar/1.0 (https://matklar.vercel.app)';

export interface FoodHit {
  code: string;
  name: string;
  brand?: string;
  quantity?: string;
  /** Weight of the whole package in grams, when the package says */
  packGrams?: number;
  swedish: boolean;
  per100: { kcal?: number; protein?: number; carbs?: number; fat?: number; fiber?: number; salt?: number };
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return isFinite(n) ? Math.round(n * 10) / 10 : undefined;
};

/** "390 g", "1 kg", "5 dl", "1,5 l" as grams (a litre of something weighs about a kilo) */
const gramsOf = (quantity?: string): number | undefined => {
  const m = (quantity || '').toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|l|dl|cl|ml)\b/);
  if (!m) return undefined;
  const factor: Record<string, number> = { kg: 1000, g: 1, l: 1000, dl: 100, cl: 10, ml: 1 };
  return Math.round(parseFloat(m[1]) * factor[m[2]]);
};

export function toHit(p: any): FoodHit | null {
  if (!p || !p.code) return null;
  const n = p.nutriments || {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== undefined ? Math.round((num(n['energy_100g']) as number) / 4.184) : undefined);
  const salt = num(n['salt_100g']) ?? (num(n['sodium_100g']) !== undefined ? Math.round((num(n['sodium_100g']) as number) * 25) / 10 : undefined);
  const name = String(p.product_name_sv || p.product_name || '').trim();
  if (!name || kcal === undefined) return null;
  const brands = Array.isArray(p.brands) ? p.brands : String(p.brands || '').split(',');
  const quantity = String(p.quantity || '').trim() || undefined;
  return {
    code: String(p.code),
    name,
    brand: String(brands[0] || '').trim() || undefined,
    quantity,
    packGrams: num(p.product_quantity) && Number(p.product_quantity) > 0 ? Math.round(Number(p.product_quantity)) : gramsOf(quantity),
    swedish: (p.countries_tags || []).includes('en:sweden'),
    per100: {
      kcal,
      protein: num(n['proteins_100g']),
      carbs: num(n['carbohydrates_100g']),
      fat: num(n['fat_100g']),
      fiber: num(n['fiber_100g']),
      salt,
    },
  };
}

const FIELDS = 'code,product_name,product_name_sv,brands,quantity,product_quantity,nutriments,countries_tags';

export async function searchFoods(query: string): Promise<FoodHit[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  if (/^\d{8,14}$/.test(q)) {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${q}?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const hit = toHit(data.product);
    return hit ? [hit] : [];
  }
  const res = await fetch(
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=sv,en&page_size=30&fields=${FIELDS}`,
    { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Open Food Facts svarade ${res.status}`);
  const data: any = await res.json();
  const hits = (data.hits || []).map(toHit).filter((h: FoodHit | null): h is FoodHit => h !== null);
  // Products sold in Sweden first, otherwise in Open Food Facts' order
  return [...hits.filter((h: FoodHit) => h.swedish), ...hits.filter((h: FoodHit) => !h.swedish)].slice(0, 20);
}

