import React, { useMemo } from 'react';
import type { MealPlanDay, Recipe } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import { useStoredState } from '../../hooks/useStoredState';
import { addDaysISO, formatDayMonth, monthStartOf } from '../../utils/mealPlanDates';
import { formatRecipeTitle } from '../../utils/formatters';
import { detectMeatKinds } from '../../utils/meatKinds';

type Period = '30' | 'month' | 'year' | 'all';

const PERIODS: [Period, string][] = [
  ['30', '30 dagar'],
  ['month', 'Månaden'],
  ['year', 'I år'],
  ['all', 'Allt'],
];

/** How far back "Allt" looks for planned days */
const ALL_DAYS_BACK = 5 * 366;

/**
 * The kind of each dinner, one per dinner so that the bars add up to all dinners. The first kind
 * in this list that the recipe has decides, so köttbullar (Nöt and Fläsk) count as Nöt.
 */
const KINDS = ['Fisk', 'Skaldjur', 'Kyckling', 'Nöt', 'Fläsk', 'Lamm', 'Vilt', 'Vegetariskt'] as const;
const OTHER = 'Annat';

function kindOf(recipe: Recipe): string {
  const subcats = getRecipeSubcategories(recipe);
  // Older recipes may have their meat only in the name and ingredients
  const meat = detectMeatKinds(recipe.title, recipe.ingredients.map((i) => i.name));
  const has = (k: string) =>
    subcats.includes(k) || (k === 'Vegetariskt' && subcats.includes('Veganskt')) || meat.includes(k);
  return KINDS.find(has) ?? OTHER;
}

interface StatsViewProps {
  today: string;
  recipes: Recipe[];
  getMealPlanForDate: (date: string) => MealPlanDay | undefined;
  onOpenRecipe: (recipe: Recipe) => void;
}

/**
 * Statistics on the dinners planned up to and including yesterday: the dishes made most often,
 * and how the dinners split into fish, chicken, beef and so on. A planned day counts as eaten.
 */
export const StatsView: React.FC<StatsViewProps> = ({ today, recipes, getMealPlanForDate, onOpenRecipe }) => {
  const [period, setPeriod] = useStoredState<Period>('matklar_stats_period', '30', (v) =>
    PERIODS.some(([p]) => p === v)
  );

  const stats = useMemo(() => {
    const yesterday = addDaysISO(today, -1);
    const from =
      period === '30'
        ? addDaysISO(today, -30)
        : period === 'month'
          ? monthStartOf(today)
          : period === 'year'
            ? `${today.slice(0, 4)}-01-01`
            : addDaysISO(today, -ALL_DAYS_BACK);
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const counts = new Map<string, { recipe: Recipe; count: number; last: string }>();
    const kinds = new Map<string, number>();
    let dinners = 0;
    let custom = 0;
    let first: string | null = null;
    for (let date = from; date <= yesterday; date = addDaysISO(date, 1)) {
      const day = getMealPlanForDate(date);
      const recipe = day?.dinnerRecipeId ? byId.get(day.dinnerRecipeId) : undefined;
      if (recipe) {
        dinners++;
        first ??= date;
        const entry = counts.get(recipe.id);
        if (entry) {
          entry.count++;
          entry.last = date;
        } else counts.set(recipe.id, { recipe, count: 1, last: date });
        const kind = kindOf(recipe);
        kinds.set(kind, (kinds.get(kind) || 0) + 1);
      } else if (day?.customDinner?.trim()) {
        custom++;
        first ??= date;
      }
    }
    const top = [...counts.values()]
      // Most often first, and among equals the one made most recently
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .slice(0, 10);
    const kindRows = [...kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      // Most first, Annat always last
      .sort((a, b) => (a.kind === OTHER ? 1 : b.kind === OTHER ? -1 : b.count - a.count));
    // "Allt" starts at the first planned day, the others at the start of the period
    return { from: period === 'all' ? first : from, yesterday, dinners, custom, top, kindRows };
  }, [period, today, recipes, getMealPlanForDate]);

  const maxKind = Math.max(1, ...stats.kindRows.map((r) => r.count));
  const percent = (n: number) => `${Math.round((n / stats.dinners) * 100)} %`;
  const range =
    stats.from && stats.from <= stats.yesterday ? `${formatDayMonth(stats.from)} till ${formatDayMonth(stats.yesterday)}` : null;

  return (
    <div className="animate-fade-in md:max-w-2xl">
      {/* The period */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Tid">
        {PERIODS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={`px-3 min-h-[36px] rounded-xl text-xs font-semibold shrink-0 transition-colors touch-manipulation ${
              period === p ? 'bg-[#284235] text-white' : 'bg-[#FCFAF5] border border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {stats.dinners === 0 ? (
        <p className="mt-6 text-sm text-stone-500">
          {stats.custom > 0
            ? `Bara egna måltider under den här tiden (${stats.custom} st), inga recept.`
            : 'Inga middagar planerade före i dag under den här tiden.'}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-stone-600">
            <span className="font-semibold text-stone-900">{stats.dinners} middagar</span>
            {range ? `, ${range}` : ''}
            {stats.custom > 0 ? `. ${stats.custom} egna måltider räknas inte med.` : '.'}
          </p>

          {/* 1. The dishes made most often */}
          <h2 className="mt-6 font-serif font-bold text-lg text-stone-900">Oftast lagat</h2>
          <ol className="mt-1 divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
            {stats.top.map(({ recipe, count, last }, i) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="w-full py-2.5 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/60 md:hover:bg-stone-50"
                >
                  <span className="w-5 text-right text-xs tabular-nums text-stone-400 shrink-0">{i + 1}</span>
                  <span className="relative w-11 h-11 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                    <FadeImage src={recipe.coverImageUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-stone-900 truncate">{formatRecipeTitle(recipe.title)}</span>
                    <span className="block text-xs text-stone-500">Senast {formatDayMonth(last)}</span>
                  </span>
                  <span className="text-sm tabular-nums text-stone-900 shrink-0">
                    {count} {count === 1 ? 'gång' : 'gånger'}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          {/* 2. The kinds of dinner, one bar each */}
          <h2 className="mt-8 font-serif font-bold text-lg text-stone-900">Sorter</h2>
          <ul className="mt-2 space-y-2.5">
            {stats.kindRows.map(({ kind, count }) => (
              <li key={kind} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-stone-700 truncate">{kind}</span>
                <span className="flex-1 min-w-0 h-2.5 rounded-r-[4px] bg-stone-100 overflow-hidden" aria-hidden="true">
                  <span
                    className={`block h-full rounded-r-[4px] ${kind === OTHER ? 'bg-stone-400' : 'bg-[#284235]'}`}
                    style={{ width: `${(count / maxKind) * 100}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-stone-900">
                  {count} <span className="text-stone-500">· {percent(count)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-500">Varje middag räknas en gång, efter det första som stämmer: fisk, kyckling, kött eller vegetariskt.</p>
        </>
      )}
    </div>
  );
};
