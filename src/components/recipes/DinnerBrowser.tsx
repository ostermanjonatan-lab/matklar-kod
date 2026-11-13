import React, { useEffect, useMemo, useState } from 'react';
import { DIFFICULTY_LABELS } from '../../utils/recipeDifficulty';
import { Check, ChevronLeft, Search } from 'lucide-react';
import type { Recipe, RecipeDifficulty } from '../../types/recipe';
import { DifficultyFilter, matchesDifficulty } from './DifficultyPicker';
import { getRecipeSubcategories } from '../../types/recipe';
import { formatCookingTime, formatRecipeTitle } from '../../utils/formatters';
import { hasCoverImage } from '../../utils/coverImage';
import { NoImage } from '../layout/NoImage';


// Subcategory value meaning "all recipes in the category"
const ALL = '__all__';

const SLIDE_INTERVAL_MS = 4000;

// The longest time to choose among, in minutes. The choice is remembered on the device.
const MAX_TIMES = [15, 30, 45, 60];
const MAX_TIME_KEY = 'matklar_dinner_max_time';

/** The time shown for a recipe (see formatCookingTime): without a time it counts as 30 minutes. */
function recipeMinutes(r: Recipe): number {
  if (typeof r.cookTimeMinutes === 'number' && r.cookTimeMinutes > 0) return r.cookTimeMinutes;
  if (typeof r.prepTimeMinutes === 'number' && r.prepTimeMinutes > 0) return r.prepTimeMinutes;
  return 30;
}

const timeLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : minutes % 60 === 0 ? `${minutes / 60} tim` : `${Math.floor(minutes / 60)} tim ${minutes % 60} min`;

const thumbClass = 'w-11 h-11 rounded-xl object-cover bg-stone-200';

const Thumb: React.FC<{ src?: string }> = ({ src }) =>
  hasCoverImage(src) ? (
    <img src={smallImage(src)} alt="" loading="lazy" className={`${thumbClass} shrink-0`} />
  ) : (
    <span className="relative block w-11 h-11 rounded-xl overflow-hidden shrink-0">
      <NoImage />
    </span>
  );

/**
 * Picture that cycles through the recipes in a category, about every 4 seconds. It fills its
 * tile in the grid of categories.
 * Each row starts at a random point and time, so the rows do not change at once.
 * Only the current picture and the one before it are in the page, and the next one is
 * loaded in advance. With "reduce motion" turned on, the first picture stays.
 */
const SlideshowThumb: React.FC<{ images: string[] }> = ({ images }) => {
  const tileImg = 'w-full h-full object-cover bg-stone-200';
  const [slide, setSlide] = useState<{ idx: number; prev: number | null }>(() => ({
    idx: images.length > 1 ? Math.floor(Math.random() * images.length) : 0,
    prev: null,
  }));
  const { idx, prev: prevIdx } = slide;

  useEffect(() => {
    if (images.length <= 1) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setSlide((s) => ({ idx: (s.idx + 1) % images.length, prev: s.idx }));
      timer = setTimeout(tick, SLIDE_INTERVAL_MS);
    };
    // Random start so the rows change at different times
    timer = setTimeout(tick, 1000 + Math.random() * SLIDE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [images.length]);

  // Load the next picture before it is shown
  useEffect(() => {
    if (images.length <= 1) return;
    const next = new Image();
    next.src = images[(idx + 1) % images.length];
  }, [idx, images]);

  const frame = 'absolute inset-0 overflow-hidden bg-stone-200';
  if (images.length === 0) {
    return (
      <span className={`block ${frame}`}>
        <NoImage />
      </span>
    );
  }
  const current = images[idx % images.length];
  const previous = prevIdx !== null ? images[prevIdx % images.length] : null;

  return (
    <div className={frame}>
      {previous && previous !== current && (
        <img key={`p-${previous}`} src={previous} alt="" className={`absolute inset-0 ${tileImg}`} />
      )}
      <img
        key={`c-${current}`}
        src={current}
        alt=""
        className={`absolute inset-0 ${tileImg} ${previous ? 'animate-thumb-fade' : ''}`}
      />
    </div>
  );
};

// Pictures from Unsplash can be fetched small, which saves data in the slideshows
const smallImage = (url: string) =>
  url.includes('images.unsplash.com') ? url.replace(/([?&])w=\d+/, '$1w=160') : url;

// The tiles in the grid are wider than the small pictures in the recipe rows
const tileImage = (url: string) =>
  url.includes('images.unsplash.com') ? url.replace(/([?&])w=\d+/, '$1w=400') : url;

const imagesOf = (list: Recipe[]) =>
  Array.from(
    new Set(list.map((r) => r.coverImageUrl).filter(hasCoverImage).map(tileImage))
  );

const byTitle = (a: Recipe, b: Recipe) =>
  formatRecipeTitle(a.title).localeCompare(formatRecipeTitle(b.title), 'sv');

interface DinnerBrowserProps {
  recipes: Recipe[];
  /** "middag" or "lunch", used in the search field and messages. The recipes are the dinner recipes either way. */
  mealLabel?: 'middag' | 'lunch';
  /** Recipe to mark as chosen, if any */
  currentRecipeId?: string | null;
  onSelect: (recipe: Recipe) => void;
}

/**
 * Find a dinner among the dinner recipes: first a subcategory (Pasta, Fisk...) with a small
 * slideshow of its recipes, then the recipe. Typing in the search field skips the step.
 * Used when planning a dinner or lunch in the meal plan.
 * It fills the height it is given; the parent decides padding and size.
 */
export const DinnerBrowser: React.FC<DinnerBrowserProps> = ({ recipes, mealLabel = 'middag', currentRecipeId, onSelect }) => {
  const [query, setQuery] = useState('');
  // Only dinners are chosen here, so the list starts in the Middag category
  const [difficultyFilter, setDifficultyFilter] = useState<RecipeDifficulty[]>([]);
  const [maxTime, setMaxTime] = useState<number | null>(() => {
    try {
      const saved = parseInt(localStorage.getItem(MAX_TIME_KEY) || '', 10);
      return MAX_TIMES.includes(saved) ? saved : null;
    } catch {
      return null;
    }
  });
  const chooseMaxTime = (minutes: number | null) => {
    setMaxTime(minutes);
    try {
      if (minutes === null) localStorage.removeItem(MAX_TIME_KEY);
      else localStorage.setItem(MAX_TIME_KEY, String(minutes));
    } catch {
      // Without storage the choice lasts until the picker is closed
    }
  };
  const dinners = useMemo(
    () =>
      recipes.filter(
        (r) =>
          r.category === 'Middag' &&
          matchesDifficulty(r.difficulty, difficultyFilter) &&
          (maxTime === null || recipeMinutes(r) <= maxTime)
      ),
    [recipes, difficultyFilter, maxTime]
  );
  const allDinnerImages = useMemo(() => imagesOf(dinners), [dinners]);
  const [subcategory, setSubcategory] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const allLabel = 'Alla måltider';

  const subcategories = useMemo(() => {
    const map = new Map<string, Recipe[]>();
    dinners.forEach((r) => {
      getRecipeSubcategories(r).forEach((s) => map.set(s, [...(map.get(s) || []), r]));
    });
    return Array.from(map.entries())
      .map(([name, list]) => ({ name, count: list.length, images: imagesOf(list) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'));
  }, [dinners]);

  const recipeList = useMemo(() => {
    if (q) {
      return dinners
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            getRecipeSubcategories(r).some((s) => s.toLowerCase().includes(q))
        )
        .sort(byTitle);
    }
    if (!subcategory && subcategories.length > 0) return [];
    return dinners
      .filter((r) => !subcategory || subcategory === ALL || getRecipeSubcategories(r).includes(subcategory))
      .sort(byTitle);
  }, [dinners, q, subcategory, subcategories.length]);

  // Without subcategories the recipes are shown straight away
  const showRecipes = Boolean(q) || subcategory !== null || subcategories.length === 0;
  const canGoBack = !q && subcategory !== null && subcategories.length > 0;

  const rowClass = 'w-full py-2.5 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70';

  // The grid of categories, three to a row. Only its outer corners are rounded.
  const tiles = [
    { name: allLabel, value: ALL, count: dinners.length, images: allDinnerImages },
    ...subcategories.map((sub) => ({ ...sub, value: sub.name })),
  ];
  const COLUMNS = 3;
  const lastRowStart = Math.floor((tiles.length - 1) / COLUMNS) * COLUMNS;
  const lastRowFull = tiles.length % COLUMNS === 0;
  const outerCorners = (i: number) =>
    [
      i === 0 && 'rounded-tl-xl',
      i === Math.min(COLUMNS, tiles.length) - 1 && 'rounded-tr-xl',
      i === lastRowStart && 'rounded-bl-xl',
      i === tiles.length - 1 && 'rounded-br-xl',
      // With a short last row, the end of the row above is a corner too
      !lastRowFull && i === lastRowStart - 1 && 'rounded-br-xl',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="relative shrink-0">
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Sök ${mealLabel}`}
          className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl pl-9 pr-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
        />
      </div>

      <DifficultyFilter selected={difficultyFilter} onChange={setDifficultyFilter} className="shrink-0 mt-2" />

      {/* The longest time: tap the chosen one again to show all */}
      <div className="shrink-0 mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Högsta tid">
        <span className="text-xs text-stone-500 shrink-0 pr-0.5">Högst</span>
        {MAX_TIMES.map((minutes) => {
          const on = maxTime === minutes;
          return (
            <button
              key={minutes}
              type="button"
              aria-pressed={on}
              onClick={() => chooseMaxTime(on ? null : minutes)}
              className={`px-3 min-h-[36px] rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-colors touch-manipulation ${
                on ? 'bg-[#284235] text-white' : 'bg-[#FCFAF5] border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {timeLabel(minutes)}
            </button>
          );
        })}
      </div>

      {canGoBack && (
        <button
          type="button"
          onClick={() => setSubcategory(null)}
          className="shrink-0 mt-2 -ml-1 self-start flex items-center gap-1 min-h-[40px] pr-2 text-sm font-semibold text-stone-900 touch-manipulation"
          aria-label={`Tillbaka till ${allLabel.toLowerCase()}`}
        >
          <ChevronLeft className="w-5 h-5 text-stone-500" />
          {subcategory === ALL ? allLabel : subcategory}
        </button>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto ${showRecipes ? 'divide-y divide-[#EBE7DF]' : ''} ${
          canGoBack ? 'border-t border-[#EBE7DF]' : 'mt-2'
        }`}
      >
        {showRecipes ? (
          recipeList.length === 0 ? (
            <p className="py-6 text-sm text-stone-500">
              {q
                ? `Inga recept i Middag matchar "${query}".`
                : maxTime !== null && difficultyFilter.length > 0
                ? `Inga middagar med den svårighetsgraden tar högst ${timeLabel(maxTime)}.`
                : maxTime !== null
                ? `Inga middagar tar högst ${timeLabel(maxTime)}.`
                : difficultyFilter.length > 0
                ? 'Inga middagar med den svårighetsgraden.'
                : 'Det finns inga recept i kategorin Varmrätt.'}
            </p>
          ) : (
            recipeList.map((recipe) => (
              <button key={recipe.id} type="button" onClick={() => onSelect(recipe)} className={rowClass}>
                <Thumb src={recipe.coverImageUrl} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-stone-900 truncate">
                    {formatRecipeTitle(recipe.title)}
                  </span>
                  <span className="block text-xs text-stone-500">
                    {formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                    {recipe.difficulty ? `, ${DIFFICULTY_LABELS[recipe.difficulty].toLowerCase()}` : ''}
                  </span>
                </span>
                {recipe.id === currentRecipeId && (
                  <Check className="w-4 h-4 text-[#284235] shrink-0" aria-label="Vald" />
                )}
              </button>
            ))
          )
        ) : (
          // The categories as a grid of square pictures side by side, with the name and the number
          // of recipes on the picture
          <div className="grid grid-cols-3 pt-1 pb-3">
            {tiles.map((tile, i) => (
                <button
                  key={tile.value}
                  type="button"
                  onClick={() => setSubcategory(tile.value)}
                  className={`relative aspect-square text-left touch-manipulation active:opacity-80 min-w-0 overflow-hidden ${outerCorners(i)}`}
                >
                  <SlideshowThumb images={tile.images} />
                  <span className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                  <span className="absolute inset-x-0 bottom-0 px-2 pb-1.5 flex items-end gap-1.5 min-w-0">
                    <span className="flex-1 min-w-0 text-[13px] font-semibold text-white leading-tight line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                      {tile.name}
                    </span>
                    <span className="text-[11px] text-white/80 tabular-nums shrink-0">{tile.count}</span>
                  </span>
                </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
