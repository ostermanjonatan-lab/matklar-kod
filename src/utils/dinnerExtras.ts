import type { DinnerExtra, MealPlanDay } from '../types/recipe';
import { getDefaultServings } from './defaultServings';

/**
 * A dinner can have more dishes than the main one, like dips to baked potatoes. Each is a recipe
 * of its own with its own portions, saved in the column dinner_extras of meal_plans.
 */

/** The dinner's extra dishes cleaned: known recipes, once each, with at least one portion. */
export function cleanDinnerExtras(raw: unknown, isKnown?: (id: string) => boolean): DinnerExtra[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DinnerExtra[] = [];
  for (const e of raw) {
    const id = e && typeof e.recipeId === 'string' ? e.recipeId : null;
    if (!id || seen.has(id) || (isKnown && !isKnown(id))) continue;
    seen.add(id);
    const n = Math.round(Number(e.servings));
    out.push({ recipeId: id, servings: n > 0 ? Math.min(n, 100) : getDefaultServings() });
  }
  return out;
}

/**
 * The plan read from Supabase, with this device's own portions and extra dishes for days whose
 * row says nothing about them (before their columns are added in Supabase, or rows saved before).
 */
export function keepLocalPlanFields(remote: MealPlanDay[] | undefined, local: MealPlanDay[]): MealPlanDay[] {
  if (!remote) return [];
  const localByDate = new Map(local.map((d) => [d.dateStr, d]));
  return remote.map((d) => {
    const own = localByDate.get(d.dateStr);
    return {
      ...d,
      dinnerExtras: d.dinnerExtras ?? own?.dinnerExtras ?? [],
      dinnerServings: d.dinnerServings ?? own?.dinnerServings,
      lunchServings: d.lunchServings ?? own?.lunchServings,
    };
  });
}

/**
 * The slices in rows: up to three side by side, then a grid (2 x 2, then 3 x 2 and so on).
 * Rows that are not full come first, so the dinner gets a bigger slice: 5 is 2 over 3.
 */
export function splitIntoRows(n: number): number[][] {
  if (n <= 3) return [Array.from({ length: n }, (_, i) => i)];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const base = Math.floor(n / rows);
  const extra = n % rows;
  const out: number[][] = [];
  let next = 0;
  for (let r = 0; r < rows; r++) {
    // The last rows take the one more each
    const count = base + (r >= rows - extra ? 1 : 0);
    out.push(Array.from({ length: count }, (_, i) => next + i));
    next += count;
  }
  return out;
}
