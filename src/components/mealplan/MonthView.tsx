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
  /** The month at the top of the screen while scrolling, if anyone wants to know */
  onVisibleMonth?: (month: string) => void;
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
        if (top) onVisible.current?.(top);
      },
      // A line just under the header: the month that crosses it is the one being looked at
      { rootMargin: '-100px 0px -70% 0px' }
    );
    sections.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [first, last]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // On wide screens the calendar is as wide as lets a whole month fit on the screen (month-calendar in index.css)
    <div className="month-calendar animate-fade-in space-y-6 md:space-y-10 pb-6">
      {months.map((month) => (
        <section
          key={month}
          data-month={month}
          ref={(el) => {
            if (el) sections.current.set(month, el);
            else sections.current.delete(month);
          }}
          // On wide screens the planner's header stays at the top (137 px with the menu above it)
          className="scroll-mt-[76px] md:scroll-mt-[137px]"
        >
          {/* The month's name and the weekdays stay at the top on wide screens while the month is scrolled */}
          <div className="md:sticky md:top-[137px] md:z-10 md:bg-[#FCFAF5]/95 md:backdrop-blur-sm md:pt-3">
            <h2 className="font-serif font-bold text-lg md:text-xl text-stone-900 pb-2">{formatMonth(month)}</h2>
            <Weekdays />
          </div>
          <MonthGrid month={month} today={today} byId={byId} getMealPlanForDate={getMealPlanForDate} onOpenDay={onOpenDay} />
        </section>
      ))}
    </div>
  );
};

const Weekdays: React.FC = () => (
  <div className="grid grid-cols-7 gap-1 md:gap-1.5 pb-1 md:pb-2">
    {WEEKDAYS_SHORT.map((d) => (
      <div key={d} className="text-center text-[11px] md:text-xs text-stone-500">
        {d}
      </div>
    ))}
  </div>
);

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
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
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
              title={meal || undefined}
              className={`group relative aspect-square rounded-lg overflow-hidden touch-manipulation active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#284235] ${
                meal ? 'bg-stone-100' : 'border border-[#EBE7DF] md:border-transparent md:bg-stone-100 md:hover:bg-stone-200/70'
              } ${isToday ? 'ring-2 ring-[#284235]' : ''}`}
            >
              {recipe ? (
                <FadeImage
                  src={recipe.coverImageUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover md:transition-transform md:duration-300 md:group-hover:scale-105"
                />
              ) : custom ? (
                <CustomMealImage name={custom} />
              ) : null}
              {/* The date: on the phone only on days without a meal, on wide screens on every day */}
              {meal ? (
                <span className="hidden md:block absolute left-1.5 top-1 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                  {dateNumber}
                </span>
              ) : (
                <span className={`absolute left-1.5 top-1 text-[11px] ${isToday ? 'font-semibold text-[#284235]' : 'text-stone-400'}`}>
                  {dateNumber}
                </span>
              )}
              {/* On wide screens the name of the meal comes up when the pointer is over the day */}
              {meal && (
                <span className="hidden md:flex absolute inset-x-0 bottom-0 items-end min-h-[60%] px-1.5 pb-1.5 bg-gradient-to-t from-black/75 to-transparent text-left text-[11px] leading-tight font-semibold text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                  <span className="line-clamp-3">{meal}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};
