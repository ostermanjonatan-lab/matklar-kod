import { useEffect, useState } from 'react';
import { VOLUME_ML, WEIGHT_G, cleanUnitOf, normalizeIngredientNameForMatching } from './shoppingAggregator';

/**
 * What things cost, roughly, as entered on this phone. A price is kept per millilitre, per gram
 * or per unit (st, förp, klyfta), so it can be worked out again for other amounts: 30 kr for
 * 2 l of milk is also about 7,50 kr for 5 dl.
 */
interface PriceEntry {
  /** kr per ml, per g, or per one of the unit */
  perUnit: number;
  /** 'ml', 'g', or the unit itself ('st' also for items without an amount or unit) */
  base: string;
}

const PRICES_KEY = 'matklar_prices_v1';
export const SHOW_COST_KEY = 'matklar_show_cost';
const CHANGED_EVENT = 'matklar-prices-changed';

function load(): Record<string, PriceEntry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRICES_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const keyOf = (name: string) => normalizeIngredientNameForMatching(name);

/** The amount in the price's base unit, or null when the units can't be counted into each other */
function inBase(amount: number | null, unit: string, base: string): number | null {
  const u = cleanUnitOf(unit);
  // Without an amount it is one of the thing: one st, one förp
  if (amount === null) return base !== 'ml' && base !== 'g' && u === base ? 1 : null;
  if (base === 'ml') return u in VOLUME_ML ? amount * VOLUME_ML[u] : null;
  if (base === 'g') return u in WEIGHT_G ? amount * WEIGHT_G[u] : null;
  return u === base ? amount : null;
}

function baseFor(unit: string): string {
  const u = cleanUnitOf(unit);
  if (u in VOLUME_ML) return 'ml';
  if (u in WEIGHT_G) return 'g';
  return u;
}

/** About what this amount costs, in kr, or null when no price is known for it */
export function estimateCost(prices: Record<string, PriceEntry>, item: { name: string; amount: number | null; unit: string }): number | null {
  const entry = prices[keyOf(item.name)];
  if (!entry) return null;
  const qty = inBase(item.amount, item.unit, entry.base);
  return qty === null ? null : qty * entry.perUnit;
}

/** "ca 30 kr", "ca 1 250 kr". Under 10 kr with one decimal: "ca 7,5 kr" */
export function formatCost(kr: number): string {
  const rounded = kr < 10 ? Math.round(kr * 10) / 10 : Math.round(kr);
  return `ca ${rounded.toLocaleString('sv-SE')} kr`;
}

/** The prices on this phone, kept up to date in every view that shows them */
export function usePrices() {
  const [prices, setPrices] = useState<Record<string, PriceEntry>>(load);

  useEffect(() => {
    const reload = () => setPrices(load());
    window.addEventListener(CHANGED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGED_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  /** Remembers what this amount costs. A missing or zero price forgets it. */
  const setPrice = (item: { name: string; amount: number | null; unit: string }, kr: number | null) => {
    const next = load();
    const key = keyOf(item.name);
    const base = item.amount === null ? cleanUnitOf(item.unit) : baseFor(item.unit);
    const qty = inBase(item.amount, item.unit, base);
    if (kr === null || kr <= 0 || !qty) delete next[key];
    else next[key] = { perUnit: kr / qty, base };
    try {
      localStorage.setItem(PRICES_KEY, JSON.stringify(next));
    } catch {
      // Kept until the app is closed
    }
    setPrices(next);
    window.dispatchEvent(new Event(CHANGED_EVENT));
  };

  return { prices, setPrice };
}
