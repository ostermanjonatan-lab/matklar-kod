import React from 'react';
import type { Recipe } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import type { ImageSize } from '../../utils/imageUrl';
import { CustomMealImage } from './CustomMealImage';
import { coverFocusStyle } from '../../utils/coverFocus';
import { splitIntoRows } from '../../utils/dinnerExtras';

interface DinnerImageProps {
  /** The dinner: a recipe, or the name of an own meal */
  recipe?: Recipe;
  custom?: string;
  /** The dishes served with it. With any, the picture is split into one slice per dish. */
  extras?: Recipe[];
  /** At most this many slices, for small pictures */
  max?: number;
  /** Tapping the slice of a dish served with the dinner */
  onSelectExtra?: (recipe: Recipe) => void;
  /** Classes for the main picture when it is alone, like a hover zoom */
  className?: string;
  loading?: 'lazy' | 'eager';
  /** The size the picture is shown at (a slice gets the size of the whole picture) */
  size?: ImageSize;
  /** For the picture seen first on the screen */
  priority?: boolean;
}

/**
 * The picture of a day's dinner. Fills the box it is in (which needs position and a size). With
 * more dishes than one, each gets its own slice, the dinner first: side by side up to three, then a grid.
 */
export const DinnerImage: React.FC<DinnerImageProps> = ({ recipe, custom, extras = [], max = 9, onSelectExtra, className = '', loading, size = 'card', priority }) => {
  const main = recipe ? (
    <FadeImage
      src={recipe.coverImageUrl}
      style={coverFocusStyle(recipe.coverFocus)}
      alt=""
      loading={loading}
      size={size}
      priority={priority}
      className={`absolute inset-0 w-full h-full object-cover ${extras.length === 0 ? className : ''}`}
    />
  ) : custom ? (
    <CustomMealImage name={custom} />
  ) : null;
  if (extras.length === 0) return main;

  const shown = extras.slice(0, Math.max(0, max - 1));
  const slices: { key: string; content: React.ReactNode; recipe?: Recipe }[] = [
    { key: 'main', content: main },
    ...shown.map((r) => ({
      key: r.id,
      recipe: r,
      content: (
        <FadeImage
          src={r.coverImageUrl}
          style={coverFocusStyle(r.coverFocus)}
          alt=""
          loading={loading}
          size={size}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ),
    })),
  ];
  return (
    <span className="absolute inset-0 flex flex-col gap-0.5 bg-white" aria-hidden="true">
      {splitIntoRows(slices.length).map((row, ri) => (
        <span key={ri} className="relative flex-1 min-h-0 flex gap-0.5">
          {row.map((idx) => {
            const slice = slices[idx];
            const r = slice.recipe;
            return (
              <span
                key={slice.key}
                className={`relative flex-1 min-w-0 overflow-hidden ${r && onSelectExtra ? 'cursor-pointer' : ''}`}
                onClick={
                  r && onSelectExtra
                    ? (e) => {
                        e.stopPropagation();
                        onSelectExtra(r);
                      }
                    : undefined
                }
              >
                {slice.content}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
};
