import type { MealPlanDay } from '../types/recipe';
import { addDaysISO, dayNameForDate } from './mealPlanDates';

/**
 * Leftovers as lunch. A lunch made from an earlier dinner is saved as the text
 * "Rester från måndag: Köttfärssås". The dinner it comes from is the nearest earlier day
 * with that weekday. Saved as text, so it syncs like any lunch and needs nothing new in Supabase.
 */

const PATTERN = /^Rester från (måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag): (.+)$/i;

export function leftoverLunchText(dinnerDate: string, dinnerTitle: string): string {
  return `Rester från ${dayNameForDate(dinnerDate).toLowerCase()}: ${dinnerTitle}`;
}

/** The date of the dinner a leftover lunch on lunchDate comes from, or null if it is not leftovers. */
export function leftoverSourceDate(lunchDate: string, customLunch?: string | null): string | null {
  const m = customLunch?.trim().match(PATTERN);
  if (!m) return null;
  const day = m[1].toLowerCase();
  for (let back = 1; back <= 6; back++) {
    const date = addDaysISO(lunchDate, -back);
    if (dayNameForDate(date).toLowerCase() === day) return date;
  }
  return null;
}

/**
 * The days with the dinner portions raised by the leftover lunches that come from them,
 * so a shopping list made from the week buys enough.
 */
export function withLeftoverPortions(days: MealPlanDay[]): MealPlanDay[] {
  const copy = days.map((d) => ({ ...d }));
  for (const day of copy) {
    if (!day.dateStr) continue;
    const source = leftoverSourceDate(day.dateStr, day.customLunch);
    if (!source) continue;
    const dinner = copy.find((d) => d.dateStr === source);
    if (dinner && dinner.dinnerRecipeId) {
      dinner.dinnerServings = (dinner.dinnerServings || 4) + (day.lunchServings || 2);
    }
  }
  return copy;
}

/** The weekday and dish of a leftover lunch, for showing it, or null if it is not leftovers. */
export function parseLeftoverLunch(customLunch?: string | null): { day: string; title: string } | null {
  const m = customLunch?.trim().match(PATTERN);
  return m ? { day: m[1].toLowerCase(), title: m[2] } : null;
}
