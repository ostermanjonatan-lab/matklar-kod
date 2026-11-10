import React from 'react';
import { hasCoverImage } from '../../utils/coverImage';
import { NoImage } from './NoImage';
import { ChevronUp, X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { useTimer } from '../../context/TimerContext';
import { useRecipes } from '../../context/RecipeContext';
import { formatRecipeTitle } from '../../utils/formatters';
import { TimerRow, useCurvedShape } from '../timer/TimerBar';

interface BottomDockProps {
  /** A recipe that was minimized. It is still open in the background. */
  minimized: Recipe | null;
  onCloseMinimized: () => void;
}

/**
 * The box above the bottom menu: a minimized recipe and the kitchen timer. Its bottom edge
 * follows the menu's arc. On a wide screen there is no bottom menu, so it is a plain box in the
 * lower right corner.
 */
export const BottomDock: React.FC<BottomDockProps> = ({ minimized, onCloseMinimized }) => {
  const { timer } = useTimer();
  const { openRecipeDetail } = useRecipes();
  const visible = Boolean(minimized || timer);
  const shape = useCurvedShape(visible);
  if (!visible) return null;

  return (
    <div className="fixed left-4 right-4 max-w-md mx-auto bottom-[calc(95px+env(safe-area-inset-bottom,0px))] md:left-auto md:right-6 md:bottom-6 md:w-96 md:mx-0 z-30">
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
        {minimized && (
          <div className={`flex items-center gap-1 pl-2 pr-1.5 pt-2 ${timer ? 'pb-2 border-b border-stone-900/10' : 'pb-5 md:pb-2'}`}>
            <button
              type="button"
              onClick={() => openRecipeDetail(minimized)}
              className="flex items-center gap-3 min-w-0 flex-1 text-left touch-manipulation"
              aria-label={`Visa ${formatRecipeTitle(minimized.title)}`}
            >
              {hasCoverImage(minimized.coverImageUrl) ? (
                <img
                  src={minimized.coverImageUrl}
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
                {formatRecipeTitle(minimized.title)}
              </span>
              <ChevronUp className="w-5 h-5 text-stone-400 shrink-0" />
            </button>
            <button
              type="button"
              onClick={onCloseMinimized}
              className="w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-100 touch-manipulation shrink-0"
              aria-label="Stäng receptet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <TimerRow inDock />
      </div>
    </div>
  );
};
