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

/**
 * Keeps leftover lunches in step with the dinners they come from. After the dinners on
 * changedDates have changed, a leftover lunch from one of them gets the new dish's name, or is
 * removed when that dinner is gone. dinnerTitle returns undefined when the dish is not known
 * (a recipe not loaded yet), and the lunch is then left as it is.
 * Returns the plan and the dates whose lunch was changed.
 */
export function syncLeftoverLunches(
  plan: MealPlanDay[],
  changedDates: string[],
  dinnerTitle: (day: MealPlanDay) => string | null | undefined
): { plan: MealPlanDay[]; changed: string[] } {
  const changed: string[] = [];
  const sources = new Set(changedDates);
  const result = plan.map((day) => {
    if (!day.dateStr) return day;
    const source = leftoverSourceDate(day.dateStr, day.customLunch);
    if (!source || !sources.has(source)) return day;
    const dinner = plan.find((d) => d.dateStr === source);
    const title = dinner ? dinnerTitle(dinner) : null;
    if (title === undefined) return day;
    const text = title ? leftoverLunchText(source, title) : '';
    if (text === day.customLunch) return day;
    changed.push(day.dateStr);
    return { ...day, customLunch: text };
  });
  return { plan: changed.length > 0 ? result : plan, changed };
}
