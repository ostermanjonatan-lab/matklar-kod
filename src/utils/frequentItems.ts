/**
 * Items you often add to the shopping list by hand (mjölk, bröd, kaffe …), counted on this
 * phone. They are shown as quick choices when you add an item. Until there is enough history,
 * a few everyday items fill up the list.
 */

const STORAGE_KEY = 'matklar_frequent_items_v1';
const DEFAULTS = ['Mjölk', 'Ägg', 'Smör', 'Bröd', 'Kaffe', 'Ost', 'Yoghurt', 'Bananer'];

interface FrequentEntry {
  name: string;
  count: number;
  last: number;
}

function load(): Record<string, FrequentEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const keyOf = (name: string) => name.trim().toLowerCase();

/** Counts an item that was added to the shopping list. */
export function recordFrequentItem(name: string): void {
  const clean = name.trim();
  if (!clean || clean.length > 40) return;
  const all = load();
  const key = keyOf(clean);
  const entry = all[key];
  all[key] = { name: entry?.name || clean.charAt(0).toUpperCase() + clean.slice(1), count: (entry?.count || 0) + 1, last: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the quick choices just do not learn
  }
}

/**
 * The most used items, most frequent first, leaving out what is already on the list.
 * Items added only once are not counted as frequent.
 */
export function getFrequentItems(limit: number, exclude: string[] = []): string[] {
  const excluded = new Set(exclude.map(keyOf));
  const learned = Object.values(load())
    .filter((e) => e.count >= 2 && !excluded.has(keyOf(e.name)))
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .map((e) => e.name);
  const result = learned.slice(0, limit);
  for (const d of DEFAULTS) {
    if (result.length >= limit) break;
    if (!excluded.has(keyOf(d)) && !result.some((r) => keyOf(r) === keyOf(d))) result.push(d);
  }
  return result;
}
