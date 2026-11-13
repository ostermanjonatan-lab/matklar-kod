import React from 'react';
import type { MealPlanDay, Recipe } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import { CustomMealImage } from './CustomMealImage';
import { MONTHS, addDaysISO, getWeekStart, parseISODate } from '../../utils/mealPlanDates';
import { formatRecipeTitle } from '../../utils/formatters';

const WEEKDAYS_SHORT = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];
interface MonthViewProps {
  monthStart: string;
  today: string;
  recipes: Recipe[];
  getMealPlanForDate: (date: string) => MealPlanDay | undefined;
  onOpenDay: (date: string) => void;
}

/**
 * The month as a calendar with only the picture of each day's dinner (lunch if there was no
 * dinner). A day without a meal shows its date. Tapping a day opens it in the day view.
 */
export const MonthView: React.FC<MonthViewProps> = ({ monthStart, today, recipes, getMealPlanForDate, onOpenDay }) => {
  const first = parseISODate(monthStart);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const gridStart = getWeekStart(monthStart);
  const lead = Math.round((first.getTime() - parseISODate(gridStart).getTime()) / 86400000);
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const byId = new Map(recipes.map((r) => [r.id, r]));

  return (
    <div className="animate-fade-in">
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
              aria-label={`${dateNumber} ${MONTHS[first.getMonth()]}${meal ? `: ${meal}` : ''}`}
              className={`relative aspect-square rounded-lg overflow-hidden touch-manipulation active:opacity-80 ${
                meal ? 'bg-stone-100' : 'border border-[#EBE7DF]'
              } ${isToday ? 'ring-2 ring-[#284235]' : ''}`}
            >
              {recipe ? (
                <FadeImage src={recipe.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
    </div>
  );
};
