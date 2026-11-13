import React, { useEffect, useRef } from 'react';
import type { MealPlanDay, Recipe } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import { CustomMealImage } from './CustomMealImage';
import { MONTHS, addDaysISO, addMonths, formatMonth, getWeekStart, monthStartOf, parseISODate } from '../../utils/mealPlanDates';
import { formatRecipeTitle } from '../../utils/formatters';

const WEEKDAYS_SHORT = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];
interface MonthViewProps {
  /** The month to scroll to, and a number that changes each time it should scroll there */
  target: { month: string; key: number };
  today: string;
  recipes: Recipe[];
  getMealPlanForDate: (date: string) => MealPlanDay | undefined;
  onOpenDay: (date: string) => void;
  /** The month at the top of the screen while scrolling */
  onVisibleMonth: (month: string) => void;
}

/** How far back and ahead of today the months go (further if the month scrolled to is outside) */
const MONTHS_BACK = 12;
const MONTHS_AHEAD = 6;

/**
 * The months under each other as calendars, scrolled through from top to bottom, with only the
 * picture of each day's dinner (lunch if there was no dinner). A day without a meal shows its
 * date. Tapping a day opens it in the day view.
 */
export const MonthView: React.FC<MonthViewProps> = ({ target, today, recipes, getMealPlanForDate, onOpenDay, onVisibleMonth }) => {
  const thisMonth = monthStartOf(today);
  let first = addMonths(thisMonth, -MONTHS_BACK);
  let last = addMonths(thisMonth, MONTHS_AHEAD);
  if (target.month < first) first = target.month;
  if (target.month > last) last = target.month;
  const months: string[] = [];
  for (let m = first; m <= last; m = addMonths(m, 1)) months.push(m);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const sections = useRef(new Map<string, HTMLElement>());
  const scrolled = useRef(false);
  // Scroll to the month asked for: straight there when the view opens, smoothly after that
  useEffect(() => {
    const el = sections.current.get(target.month);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: scrolled.current ? 'smooth' : 'auto' });
    scrolled.current = true;
  }, [target.key, target.month]);

  // The month at the top of the screen goes in the header
  const onVisible = useRef(onVisibleMonth);
  useEffect(() => {
    onVisible.current = onVisibleMonth;
  });
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set((e.target as HTMLElement).dataset.month || '', e.isIntersecting);
        const top = months.find((m) => seen.get(m));
        if (top) onVisible.current(top);
      },
      // A line just under the header: the month that crosses it is the one being looked at
      { rootMargin: '-100px 0px -70% 0px' }
    );
    sections.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [first, last]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="animate-fade-in space-y-6 pb-6">
      {months.map((month) => (
        <section
          key={month}
          data-month={month}
          ref={(el) => {
            if (el) sections.current.set(month, el);
            else sections.current.delete(month);
          }}
          className="scroll-mt-[76px] md:scroll-mt-4"
        >
          <h2 className="font-serif font-bold text-lg text-stone-900 pb-2">{formatMonth(month)}</h2>
          <MonthGrid month={month} today={today} byId={byId} getMealPlanForDate={getMealPlanForDate} onOpenDay={onOpenDay} />
        </section>
      ))}
    </div>
  );
};

const MonthGrid: React.FC<{
  month: string;
  today: string;
  byId: Map<string, Recipe>;
  getMealPlanForDate: (date: string) => MealPlanDay | undefined;
  onOpenDay: (date: string) => void;
}> = ({ month, today, byId, getMealPlanForDate, onOpenDay }) => {
  const firstDay = parseISODate(month);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const gridStart = getWeekStart(month);
  const lead = Math.round((firstDay.getTime() - parseISODate(gridStart).getTime()) / 86400000);
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;

  return (
    <>
      <div className="grid grid-cols-7 gap-1 md:gap-2 pb-1">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-[11px] text-stone-500">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {Array.from({ length: cells }, (_, i) => {
          const date = addDaysISO(gridStart, i);
          if (i < lead || i >= lead + daysInMonth) return <div key={date} aria-hidden="true" />;
          const day = getMealPlanForDate(date);
          const dinner = day?.dinnerRecipeId ? byId.get(day.dinnerRecipeId) : undefined;
          const customDinner = day?.customDinner?.trim();
          const lunch = day?.lunchRecipeId ? byId.get(day.lunchRecipeId) : undefined;
          const customLunch = day?.customLunch?.trim();
          const recipe = dinner || (!customDinner ? lunch : undefined);
          const custom = !recipe ? customDinner || customLunch : undefined;
          const meal = recipe ? formatRecipeTitle(recipe.title) : custom;
          const isToday = date === today;
          const dateNumber = parseISODate(date).getDate();
          return (
            <button
              key={date}
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`${dateNumber} ${MONTHS[firstDay.getMonth()]} ${firstDay.getFullYear()}${meal ? `: ${meal}` : ''}`}
              className={`relative aspect-square rounded-lg overflow-hidden touch-manipulation active:opacity-80 ${
                meal ? 'bg-stone-100' : 'border border-[#EBE7DF]'
              } ${isToday ? 'ring-2 ring-[#284235]' : ''}`}
            >
              {recipe ? (
                <FadeImage src={recipe.coverImageUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              ) : custom ? (
                <CustomMealImage name={custom} />
              ) : (
                <span className={`absolute left-1.5 top-1 text-[11px] ${isToday ? 'font-semibold text-[#284235]' : 'text-stone-400'}`}>
                  {dateNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};
