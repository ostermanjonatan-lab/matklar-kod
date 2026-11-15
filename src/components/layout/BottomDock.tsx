import React, { useEffect, useRef, useState } from 'react';
import { hasCoverImage } from '../../utils/coverImage';
import { NoImage } from './NoImage';
import { ChevronUp, X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { useTimer } from '../../context/TimerContext';
import { useRecipes } from '../../context/RecipeContext';
import { formatRecipeTitle } from '../../utils/formatters';
import { TimerRow, useCurvedShape } from '../timer/TimerBar';

interface BottomDockProps {
  /** The recipes that were minimized, the last one first. They are still open in the background. */
  minimized: Recipe[];
  onCloseMinimized: (id: string) => void;
}

/**
 * The box above the bottom menu: the minimized recipes and the kitchen timer. Several minimized
 * recipes lie side by side and are swiped between, with dots that show which one is shown. Its bottom edge
 * follows the menu's arc. On a wide screen there is no bottom menu, so it is a plain box in the
 * lower right corner.
 */
export const BottomDock: React.FC<BottomDockProps> = ({ minimized, onCloseMinimized }) => {
  const { timer } = useTimer();
  const { openRecipeDetail } = useRecipes();
  const visible = Boolean(minimized.length > 0 || timer);
  const shape = useCurvedShape(visible);

  // The box covers the end of the page, so the page gets as much room at the bottom as the box
  // is high (--dock-space, used by <main>). Otherwise the last buttons, such as Töm hela listan,
  // can't be scrolled into view.
  const outerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const el = outerRef.current;
    if (!visible || !el) {
      root.style.setProperty('--dock-space', '0px');
      return;
    }
    const update = () => root.style.setProperty('--dock-space', `${Math.ceil(el.getBoundingClientRect().height) + 12}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty('--dock-space', '0px');
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div ref={outerRef} className="fixed left-4 right-4 max-w-md mx-auto bottom-[calc(95px+env(safe-area-inset-bottom,0px))] md:left-auto md:right-6 md:bottom-6 md:w-96 md:mx-0 z-30">
      {/* The shadow is a blurred copy of the shape behind the box. A shadow filter or an animation
          on a layer around the box would turn off the see-through blur. */}
      {shape.path && (
        <div
          aria-hidden="true"
          className="absolute inset-0 translate-y-1.5 bg-stone-900/15 blur-md pointer-events-none"
          style={{ clipPath: `path('${shape.path}')` }}
        />
      )}
      <div
        ref={shape.ref}
        className="relative rounded-2xl overflow-hidden md:shadow-[0_8px_24px_rgba(28,25,23,0.15)] md:border md:border-stone-900/10 bg-white/80 backdrop-blur-xl backdrop-saturate-150 animate-slide-up"
        style={shape.path ? { clipPath: `path('${shape.path}')` } : undefined}
      >
        {minimized.length > 0 && (
          <div className={timer ? 'border-b border-stone-900/10' : ''}>
            <MinimizedRecipes
              recipes={minimized}
              onOpen={openRecipeDetail}
              onClose={onCloseMinimized}
              bottomPadding={timer ? 'pb-2' : 'pb-5 md:pb-2'}
            />
          </div>
        )}
        <TimerRow inDock />
      </div>
    </div>
  );
};

/**
 * The minimized recipes as cards side by side. Swipe (or scroll) sideways between them, or tap a
 * dot. A newly minimized recipe comes first and is shown.
 */
const MinimizedRecipes: React.FC<{
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
  onClose: (id: string) => void;
  bottomPadding: string;
}> = ({ recipes, onOpen, onClose, bottomPadding }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolledTo, setScrolledTo] = useState(0);
  // A recipe closed further along the row: the dots stay within the row
  const current = Math.min(scrolledTo, recipes.length - 1);
  const several = recipes.length > 1;

  // A new recipe first in the row: show it
  const firstId = recipes[0]?.id;
  // (scrolling there updates the dots through onScroll)
  useEffect(() => {
    scroller.current?.scrollTo({ left: 0 });
  }, [firstId]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.clientWidth === 0) return;
    setScrolledTo(Math.round(el.scrollLeft / el.clientWidth));
  };
  const show = (i: number) => {
    const el = scroller.current;
    el?.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className={`pt-2 ${several ? 'pb-1.5' : bottomPadding}`}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain"
        aria-label="Minimerade recept"
      >
        {recipes.map((recipe, i) => (
          <div
            key={recipe.id}
            className="w-full shrink-0 snap-center flex items-center gap-1 pl-2 pr-1.5"
            aria-hidden={several && i !== current ? true : undefined}
          >
            <button
              type="button"
              onClick={() => onOpen(recipe)}
              tabIndex={several && i !== current ? -1 : undefined}
              className="flex items-center gap-3 min-w-0 flex-1 text-left touch-manipulation"
              aria-label={`Visa ${formatRecipeTitle(recipe.title)}`}
            >
              {hasCoverImage(recipe.coverImageUrl) ? (
                <img
                  src={recipe.coverImageUrl}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover bg-stone-100 shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
              ) : (
                <span className="relative block w-11 h-11 rounded-xl overflow-hidden shrink-0">
                  <NoImage />
                </span>
              )}
              <span className="min-w-0 flex-1 font-serif font-bold text-base text-stone-900 truncate">
                {formatRecipeTitle(recipe.title)}
              </span>
              <ChevronUp className="w-5 h-5 text-stone-400 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onClose(recipe.id)}
              tabIndex={several && i !== current ? -1 : undefined}
              className="w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-100 touch-manipulation shrink-0"
              aria-label={`Stäng ${formatRecipeTitle(recipe.title)}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Which recipe is shown, when there are several */}
      {several && (
        <div className={`flex justify-center ${bottomPadding === 'pb-2' ? '' : 'pb-3.5 md:pb-0'}`}>
          {recipes.map((recipe, i) => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => show(i)}
              aria-label={`Visa minimerat recept ${i + 1} av ${recipes.length}`}
              aria-current={i === current ? 'true' : undefined}
              className="w-6 h-5 flex items-center justify-center touch-manipulation"
            >
              <span className={`block rounded-full transition-all ${i === current ? 'w-4 h-1.5 bg-[#284235]' : 'w-1.5 h-1.5 bg-stone-300'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
