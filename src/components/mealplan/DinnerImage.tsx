import React from 'react';
import type { Recipe } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import { CustomMealImage } from './CustomMealImage';
import { coverFocusStyle } from '../../utils/coverFocus';

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
}

/**
 * The picture of a day's dinner. Fills the box it is in (which needs position and a size). With
 * more dishes than one, each gets its own slice side by side, the dinner first.
 */
export const DinnerImage: React.FC<DinnerImageProps> = ({ recipe, custom, extras = [], max = 6, onSelectExtra, className = '', loading }) => {
  const main = recipe ? (
    <FadeImage
      src={recipe.coverImageUrl}
      style={coverFocusStyle(recipe.coverFocus)}
      alt=""
      loading={loading}
      className={`absolute inset-0 w-full h-full object-cover ${extras.length === 0 ? className : ''}`}
    />
  ) : custom ? (
    <CustomMealImage name={custom} />
  ) : null;
  if (extras.length === 0) return main;

  const shown = extras.slice(0, Math.max(0, max - 1));
  return (
    <span className="absolute inset-0 flex gap-0.5 bg-white" aria-hidden="true">
      <span className="relative flex-1 min-w-0 overflow-hidden">{main}</span>
      {shown.map((r) => (
        <span
          key={r.id}
          className={`relative flex-1 min-w-0 overflow-hidden ${onSelectExtra ? 'cursor-pointer' : ''}`}
          onClick={
            onSelectExtra
              ? (e) => {
                  e.stopPropagation();
                  onSelectExtra(r);
                }
              : undefined
          }
        >
          <FadeImage
            src={r.coverImageUrl}
            style={coverFocusStyle(r.coverFocus)}
            alt=""
            loading={loading}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </span>
      ))}
    </span>
  );
};
