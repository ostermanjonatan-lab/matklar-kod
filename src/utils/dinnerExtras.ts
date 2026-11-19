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
 * The plan read from Supabase, with the extra dishes this device has for days whose row says
 * nothing about them (before the column dinner_extras is added in Supabase).
 */
export function keepLocalDinnerExtras(remote: MealPlanDay[] | undefined, local: MealPlanDay[]): MealPlanDay[] {
  if (!remote) return [];
  const localByDate = new Map(local.map((d) => [d.dateStr, d]));
  return remote.map((d) =>
    d.dinnerExtras === undefined ? { ...d, dinnerExtras: localByDate.get(d.dateStr)?.dinnerExtras || [] } : d
  );
}
