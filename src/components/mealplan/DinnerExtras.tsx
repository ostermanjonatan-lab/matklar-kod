import React from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { DinnerExtra, Recipe } from '../../types/recipe';
import { FadeImage } from '../layout/FadeImage';
import { coverFocusStyle } from '../../utils/coverFocus';
import { formatRecipeTitle } from '../../utils/formatters';

interface DinnerExtrasProps {
  extras: DinnerExtra[];
  recipes: Recipe[];
  onOpen: (recipe: Recipe) => void;
  onAdd: () => void;
  onRemove: (recipeId: string) => void;
  onServings: (recipeId: string, servings: number) => void;
  /** Whether a dish's ingredients are already in the shopping list */
  isInList?: (recipeId: string) => boolean;
}

/**
 * The dishes served with the day's dinner, each a recipe of its own with its own portions,
 * under the dinner in the day view. Ends with the button that adds one more.
 */
export const DinnerExtras: React.FC<DinnerExtrasProps> = ({ extras, recipes, onOpen, onAdd, onRemove, onServings, isInList }) => {
  const rows = extras
    .map((e) => ({ extra: e, recipe: recipes.find((r) => r.id === e.recipeId) }))
    .filter((r): r is { extra: DinnerExtra; recipe: Recipe } => Boolean(r.recipe));

  return (
    <div className="px-3.5 pb-3 bg-white">
      {rows.length > 0 && (
        <ul className="border-t border-[#EBE7DF] divide-y divide-[#EBE7DF]">
          {rows.map(({ extra, recipe }) => (
            <li key={recipe.id} className="flex items-center gap-2.5 py-2">
              <button
                type="button"
                onClick={() => onOpen(recipe)}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left touch-manipulation"
              >
                <span className="relative w-11 h-11 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                  <FadeImage
                    size="thumb"
                    src={recipe.coverImageUrl}
                    style={coverFocusStyle(recipe.coverFocus)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
                    {formatRecipeTitle(recipe.title)}
                  </span>
                  {isInList?.(recipe.id) && <span className="block text-xs text-stone-500">I inköpslistan</span>}
                </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onServings(recipe.id, extra.servings - 1)}
                  disabled={extra.servings <= 1}
                  className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center text-stone-700 active:scale-90 disabled:opacity-40 touch-manipulation"
                  aria-label={`Färre portioner ${formatRecipeTitle(recipe.title)}`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-9 text-center text-sm font-bold tabular-nums text-stone-900" aria-label={`${extra.servings} portioner`}>
                  {extra.servings}
                  <span className="font-normal text-stone-500"> p</span>
                </span>
                <button
                  type="button"
                  onClick={() => onServings(recipe.id, extra.servings + 1)}
                  disabled={extra.servings >= 100}
                  className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center text-stone-700 active:scale-90 disabled:opacity-40 touch-manipulation"
                  aria-label={`Fler portioner ${formatRecipeTitle(recipe.title)}`}
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(recipe.id)}
                  className="w-9 h-9 -mr-1.5 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-stone-100 touch-manipulation"
                  aria-label={`Ta bort ${formatRecipeTitle(recipe.title)} från middagen`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onAdd}
        className={`w-full min-h-[40px] flex items-center gap-1.5 text-xs font-bold text-[#284235] touch-manipulation ${
          rows.length > 0 ? '' : 'border-t border-[#EBE7DF]'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
        Lägg till rätt
      </button>
    </div>
  );
};
