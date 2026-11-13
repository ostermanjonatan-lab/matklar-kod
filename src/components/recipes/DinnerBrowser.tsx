import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// How long a new picture takes to fade in, and how often one of the tiles changes picture
const FADE_MS = 1400;
const CHANGE_MIN_MS = 1700;
const CHANGE_SPREAD_MS = 1300;

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
 * One tile's picture. A new picture fades in over the one before, and every picture zooms out
 * slowly while it is shown, so the grid moves calmly between changes.
 */
const SlideshowThumb: React.FC<{ src: string | null }> = ({ src }) => {
  const tileImg = 'absolute inset-0 w-full h-full object-cover bg-stone-200';
  // The pictures in the tile, the newest last. The key stays with a picture, so its zoom is not restarted.
  const [layers, setLayers] = useState<{ src: string; key: number }[]>(() => (src ? [{ src, key: 0 }] : []));
  // A new picture for the tile goes on top of the one shown
  const top = layers[layers.length - 1];
  if (src && top?.src !== src) {
    setLayers([...layers.slice(-1), { src, key: (top?.key ?? 0) + 1 }]);
  }
  // The picture underneath is removed once the new one has faded in
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((l) => l.slice(-1)), FADE_MS + 100);
    return () => clearTimeout(t);
  }, [layers]);

  const frame = 'absolute inset-0 overflow-hidden bg-stone-200';
  if (layers.length === 0) {
    return (
      <span className={`block ${frame}`}>
        <NoImage />
      </span>
    );
  }
  return (
    <div className={frame}>
      {layers.map((layer, i) => (
        <img
          key={layer.key}
          src={layer.src}
          alt=""
          className={`${tileImg} animate-thumb-drift ${i > 0 ? 'animate-thumb-fade' : ''}`}
        />
      ))}
    </div>
  );
};

// Steps between two tiles in the grid of three columns
const tileDistance = (a: number, b: number) =>
  Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) + Math.abs((a % 3) - (b % 3));

const shuffle = <T,>(list: T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Which picture each tile shows. No picture is in two tiles at once, only one tile changes at a
 * time, at uneven intervals and in random order, and a picture is loaded before it is shown, so
 * the grid never changes in a pattern. With "reduce motion" turned on, the first pictures stay.
 */
function useTilePictures(pools: string[][], running: boolean): (string | null)[] {
  const signature = pools.map((p) => p.join('|')).join('||');
  const pick = (): (string | null)[] => {
    const used = new Set<string>();
    const shown: (string | null)[] = pools.map(() => null);
    // The tiles with the fewest pictures choose first, so they can get one of their own
    const order = pools.map((_, i) => i).sort((x, y) => pools[x].length - pools[y].length);
    for (const i of order) {
      const pool = pools[i];
      if (pool.length === 0) continue;
      const free = pool.filter((src) => !used.has(src));
      let src: string;
      if (free.length) src = free[Math.floor(Math.random() * free.length)];
      else {
        // Fewer pictures than tiles: the same picture as far as possible from where it already is
        const away = (candidate: string) =>
          Math.min(...shown.map((other, j) => (other === candidate ? tileDistance(i, j) : Infinity)));
        src = [...pool].sort((x, y) => away(y) - away(x))[0];
      }
      shown[i] = src;
      used.add(src);
    }
    return shown;
  };
  const [state, setState] = useState(() => ({ signature, shown: pick() }));
  // New pictures in the tiles (a filter was chosen): choose again
  let shown = state.shown;
  if (state.signature !== signature) {
    shown = pick();
    setState({ signature, shown });
  }

  // The timer below reads the tiles and their pictures from here, so it does not restart at every change
  const shownRef = useRef(shown);
  const poolsRef = useRef(pools);
  useEffect(() => {
    shownRef.current = shown;
    poolsRef.current = pools;
  });
  useEffect(() => {
    if (!running) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let lastTile = -1;
    const pools = poolsRef.current;
    // Each tile goes through its pictures in a shuffled order before starting over
    const queues = pools.map((p) => shuffle(p));
    const next = () => {
      timer = setTimeout(change, CHANGE_MIN_MS + Math.random() * CHANGE_SPREAD_MS);
    };
    const change = () => {
      const current = shownRef.current;
      const inUse = new Set(current.filter(Boolean) as string[]);
      const tiles = pools.map((_, i) => i).filter((i) => i !== lastTile && pools[i].some((src) => !inUse.has(src)));
      if (tiles.length === 0) return next();
      const tile = tiles[Math.floor(Math.random() * tiles.length)];
      let queue = queues[tile];
      let k = queue.findIndex((src) => !inUse.has(src));
      if (k < 0) {
        queue = queues[tile] = shuffle(pools[tile]);
        k = queue.findIndex((src) => !inUse.has(src));
      }
      if (k < 0) return next();
      const [src] = queue.splice(k, 1);
      if (queue.length === 0) queues[tile] = shuffle(pools[tile]).filter((s) => s !== src);
      lastTile = tile;
      // Show the picture only once it has loaded, so it never fades in half drawn
      const img = new Image();
      const show = () => {
        if (stopped) return;
        setState((st) => {
          if (st.signature !== signature) return st;
          const copy = [...st.shown];
          copy[tile] = src;
          return { ...st, shown: copy };
        });
        next();
      };
      img.onload = () => {
        if (img.decode) img.decode().then(show, show);
        else show();
      };
      img.onerror = () => {
        if (!stopped) next();
      };
      img.src = src;
    };
    next();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [signature, running]);

  return shown;
}

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
  const tilePictures = useTilePictures(
    tiles.map((t) => t.images),
    !showRecipes
  );
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
                  <SlideshowThumb src={tilePictures[i]} />
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
