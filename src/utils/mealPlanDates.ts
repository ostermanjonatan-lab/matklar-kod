import type { MealPlanDay } from '../types/recipe';

/**
 * Dates for the meal plan. Every planned day is stored with a date (YYYY-MM-DD in local time),
 * so each week has its own plan. Weeks start on Monday.
 */

export const WEEKDAY_NAMES: MealPlanDay['dayName'][] = [
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
  'Söndag',
];

const MONTHS_SHORT = ['jan', 'feb', 'mars', 'apr', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday of the week that contains the date. */
export function getWeekStart(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? parseISODate(date) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

export function getWeekDates(weekStart: string): string[] {
  return WEEKDAY_NAMES.map((_, i) => addDaysISO(weekStart, i));
}

export function dayNameForDate(iso: string): MealPlanDay['dayName'] {
  return WEEKDAY_NAMES[(parseISODate(iso).getDay() + 6) % 7];
}

export function getISOWeekNumber(iso: string): number {
  const d = parseISODate(iso);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** "9–15 nov" or "30 nov–6 dec". */
export function formatWeekRange(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(addDaysISO(weekStart, 6));
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]}–${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
}

/** "9 nov" */
export function formatDayMonth(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Day of month, e.g. 9 */
export function dayOfMonth(iso: string): number {
  return parseISODate(iso).getDate();
}
