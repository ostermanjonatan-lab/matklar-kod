import { searchFoods, toHit, type FoodHit } from './openFoodFacts';

export type { FoodHit };

/**
 * Packaged foods from Open Food Facts by name or barcode, for nutrition from the package.
 * Through the app's own function (api/food-search.ts); where that is not there, straight from
 * Open Food Facts' older search, which browsers may use.
 */
export async function searchProducts(query: string): Promise<FoodHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      if (Array.isArray(data.hits)) return data.hits;
    }
  } catch {
    // Falls back below
  }
  if (/^\d{8,14}$/.test(q)) return searchFoods(q);
  const fields = 'code,product_name,product_name_sv,brands,quantity,product_quantity,nutriments,countries_tags';
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&fields=${fields}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`Open Food Facts svarade ${res.status}`);
  const data = await res.json();
  const hits = (data.products || []).map(toHit).filter((h: FoodHit | null): h is FoodHit => h !== null);
  return [...hits.filter((h: FoodHit) => h.swedish), ...hits.filter((h: FoodHit) => !h.swedish)].slice(0, 20);
}
