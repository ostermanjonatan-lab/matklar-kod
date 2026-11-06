import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { formatCookingTime, formatRecipeTitle } from '../../utils/formatters';

interface TonightPickerModalProps {
  recipes: Recipe[];
  /** Recipe already planned for tonight, if any */
  currentRecipeId?: string | null;
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

// Shown last, since they are seldom a dinner on their own. Dinner recipes come first.
const SIDE_CATEGORIES = ['Efterrätt', 'Dryck', 'Såser'];

/** Choose tonight's dinner by hand from the recipes. */
export const TonightPickerModal: React.FC<TonightPickerModalProps> = ({
  recipes,
  currentRecipeId,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = recipes.filter((r) => {
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        getRecipeSubcategories(r).some((s) => s.toLowerCase().includes(q))
      );
    });
    // Dinner recipes first, side dishes last
    const rank = (r: Recipe) => (r.category === 'Middag' ? 0 : SIDE_CATEGORIES.includes(r.category) ? 2 : 1);
    return [...matches].sort(
      (a, b) => rank(a) - rank(b) || formatRecipeTitle(a.title).localeCompare(formatRecipeTitle(b.title), 'sv')
    );
  }, [recipes, query]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Välj middag i kväll"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 pt-4 pb-3 space-y-3 border-b border-[#EBE7DF] shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg text-stone-900">Middag i kväll</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
              aria-label="Stäng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök recept"
              className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl pl-9 pr-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
            />
          </div>
        </div>

        <div className="overflow-y-auto px-4 divide-y divide-[#EBE7DF]">
          {list.length === 0 ? (
            <p className="py-6 text-sm text-stone-500">Inga recept matchar "{query}".</p>
          ) : (
            list.map((recipe) => {
              const isCurrent = recipe.id === currentRecipeId;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onSelect(recipe)}
                  className="w-full py-2.5 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70"
                >
                  {recipe.coverImageUrl ? (
                    <img
                      src={recipe.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="w-11 h-11 rounded-xl object-cover bg-stone-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-stone-200 shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-stone-900 truncate">
                      {formatRecipeTitle(recipe.title)}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {recipe.category}, {formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                    </span>
                  </span>
                  {isCurrent && <Check className="w-4 h-4 text-[#284235] shrink-0" aria-label="Vald" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
