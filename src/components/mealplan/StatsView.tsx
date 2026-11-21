import React, { useMemo } from 'react';
import type { MealPlanDay, Recipe } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import { useStoredState } from '../../hooks/useStoredState';
import { addDaysISO, formatDayMonth, monthStartOf } from '../../utils/mealPlanDates';
import { formatRecipeTitle } from '../../utils/formatters';
import { detectMeatKinds } from '../../utils/meatKinds';
import { coverFocusStyle } from '../../utils/coverFocus';
import { customMealIcon } from './CustomMealImage';

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

/**
 * Meals written in words, gathered under one name when they mean the same thing, so that Sushi
 * and Foodora both count as Hämtmat. The first that matches decides.
 */
const CUSTOM_GROUPS: [RegExp, string][] = [
  [/hämtmat|take ?away|beställ|leverans|foodora|wolt|uber ?eats|sushi|thai|kebab/i, 'Hämtmat'],
  [/äta ute|restaurang|krog|lunchställe/i, 'Äta ute'],
  [/bortbjud|middag hos|kalas|hos (mormor|farmor|morfar|farfar|mamma|pappa|vänner)/i, 'Bortbjudna'],
  [/hos \p{Lu}/u, 'Bortbjudna'],
  [/rester|matlåd/i, 'Rester'],
];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The group of a meal written in words, and for a meal in a group the place when there is one:
 * what comes after a dash, colon or comma, or after från, på or hos
 * ("Hämtmat - Brödernas", "Äta ute på Pinchos").
 */
function customGroupOf(name: string): { group: string; place: string | null } {
  const text = name.trim().replace(/\s+/g, ' ');
  const group = CUSTOM_GROUPS.find(([re]) => re.test(text))?.[1];
  if (!group) return { group: capitalize(text), place: null };
  const place = text.match(/(?:\s[-–—]\s*|[:,]\s*|\s(?:från|på|hos)\s+)(.+)$/i)?.[1].trim();
  return { group, place: place ? capitalize(place) : null };
}

interface StatsViewProps {
  today: string;
  recipes: Recipe[];
  getMealPlanForDate: (date: string) => MealPlanDay | undefined;
  onOpenRecipe: (recipe: Recipe) => void;
}

/**
 * Statistics on the dinners planned up to and including yesterday: the dishes made most often,
 * how the dinners split into fish, chicken, beef and so on, and how often a meal written in
 * words (Hämtmat, Äta ute) came up. A planned day counts as eaten.
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
    const customCounts = new Map<
      string,
      { name: string; count: number; last: string; places: Map<string, { name: string; count: number }> }
    >();
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
        const { group: name, place } = customGroupOf(day.customDinner);
        // Pizza and pizza are the same meal
        const key = name.toLowerCase();
        let entry = customCounts.get(key);
        if (entry) {
          entry.count++;
          entry.last = date;
        } else {
          entry = { name, count: 1, last: date, places: new Map() };
          customCounts.set(key, entry);
        }
        if (place) {
          const placeEntry = entry.places.get(place.toLowerCase());
          if (placeEntry) placeEntry.count++;
          else entry.places.set(place.toLowerCase(), { name: place, count: 1 });
        }
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
    const customRows = [...customCounts.values()]
      .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
      .map(({ places, ...row }) => ({
        ...row,
        // The places most often first, as "Brödernas 5, Max 2"
        places: [...places.values()]
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'))
          .map((pl) => `${pl.name} ${pl.count}`)
          .join(', '),
      }));
    // "Allt" starts at the first planned day, the others at the start of the period
    return { from: period === 'all' ? first : from, yesterday, dinners, custom, top, kindRows, customRows };
  }, [period, today, recipes, getMealPlanForDate]);

  const maxKind = Math.max(1, ...stats.kindRows.map((r) => r.count));
  const percent = (n: number) => `${Math.round((n / stats.dinners) * 100)} %`;
  const range =
    stats.from && stats.from <= stats.yesterday ? `${formatDayMonth(stats.from)} till ${formatDayMonth(stats.yesterday)}` : null;

  return (
    <div className="animate-fade-in">
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

      {stats.dinners === 0 && stats.custom === 0 ? (
        <p className="mt-6 text-sm text-stone-500">Inga middagar planerade före i dag under den här tiden.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-stone-600">
            <span className="font-semibold text-stone-900">
              {[
                stats.dinners > 0 ? `${stats.dinners} ${stats.dinners === 1 ? 'middag' : 'middagar'} efter recept` : '',
                stats.custom > 0 ? `${stats.custom} ${stats.custom === 1 ? 'egen måltid' : 'egna måltider'}` : '',
              ]
                .filter(Boolean)
                .join(' och ')}
            </span>
            {range ? `, ${range}` : ''}.
          </p>

          {/* The statistics under each other, and two side by side on wide screens */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16 lg:items-start">
          {stats.dinners > 0 && (
          <>
          <section>
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
                    <FadeImage src={recipe.coverImageUrl} style={coverFocusStyle(recipe.coverFocus)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
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
          </section>


          <section>
          {/* 2. The kinds of dinner, one bar each */}
          <h2 className="mt-8 lg:mt-6 font-serif font-bold text-lg text-stone-900">Sorter</h2>
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
          </section>
          </>
          )}

          {stats.customRows.length > 0 && (
          <section>
          {/* 3. Meals written in words: Hämtmat, Äta ute, Rester and the like */}
          <h2 className="mt-8 lg:mt-6 font-serif font-bold text-lg text-stone-900">Egna måltider</h2>
          <ul className="mt-1 divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
            {stats.customRows.map(({ name, count, last, places }) => {
              const Icon = customMealIcon(name);
              return (
                <li key={name} className="py-2.5 flex items-center gap-3">
                  <span className="w-11 h-11 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-stone-400 stroke-[1.75]" aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-stone-900 truncate">{name}</span>
                    <span className="block text-xs text-stone-500">Senast {formatDayMonth(last)}</span>
                    {places && <span className="block text-xs text-stone-600 mt-0.5 break-words">{places}</span>}
                  </span>
                  <span className="text-sm tabular-nums text-stone-900 shrink-0">
                    {count} {count === 1 ? 'gång' : 'gånger'}
                  </span>
                </li>
              );
            })}
          </ul>
          </section>
          )}
          </div>
        </>
      )}
    </div>
  );
};
