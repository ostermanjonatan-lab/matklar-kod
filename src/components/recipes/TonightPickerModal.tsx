import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { STANDARD_CATEGORIES } from '../../data/categories';
import { formatCookingTime, formatRecipeTitle } from '../../utils/formatters';

interface TonightPickerModalProps {
  recipes: Recipe[];
  /** Recipe already planned for tonight, if any */
  currentRecipeId?: string | null;
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

// Subcategory value meaning "all recipes in the category"
const ALL = '__all__';

const byTitle = (a: Recipe, b: Recipe) =>
  formatRecipeTitle(a.title).localeCompare(formatRecipeTitle(b.title), 'sv');

/**
 * Choose tonight's dinner by hand. Step by step: category, then subcategory, then recipe.
 * Typing in the search field skips the steps and shows matching recipes directly.
 */
export const TonightPickerModal: React.FC<TonightPickerModalProps> = ({
  recipes,
  currentRecipeId,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const names = new Set<string>(recipes.map((r) => r.category).filter(Boolean));
    const ordered = [
      ...STANDARD_CATEGORIES.filter((c) => names.has(c)),
      ...Array.from(names).filter((c) => !STANDARD_CATEGORIES.includes(c as never)).sort((a, b) => a.localeCompare(b, 'sv')),
    ];
    return ordered.map((name) => {
      const inCat = recipes.filter((r) => r.category === name);
      return { name, count: inCat.length, image: inCat.find((r) => r.coverImageUrl)?.coverImageUrl };
    });
  }, [recipes]);

  const subcategories = useMemo(() => {
    if (!category) return [];
    const map = new Map<string, Recipe[]>();
    recipes
      .filter((r) => r.category === category)
      .forEach((r) => {
        getRecipeSubcategories(r).forEach((s) => map.set(s, [...(map.get(s) || []), r]));
      });
    return Array.from(map.entries())
      .map(([name, list]) => ({ name, count: list.length, image: list.find((r) => r.coverImageUrl)?.coverImageUrl }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sv'));
  }, [recipes, category]);

  const recipeList = useMemo(() => {
    if (q) {
      return recipes
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            getRecipeSubcategories(r).some((s) => s.toLowerCase().includes(q))
        )
        .sort(byTitle);
    }
    if (!category || !subcategory) return [];
    return recipes
      .filter(
        (r) => r.category === category && (subcategory === ALL || getRecipeSubcategories(r).includes(subcategory))
      )
      .sort(byTitle);
  }, [recipes, q, category, subcategory]);

  const openCategory = (name: string) => {
    setCategory(name);
    // A category without subcategories goes straight to its recipes
    const hasSubs = recipes.some((r) => r.category === name && getRecipeSubcategories(r).length > 0);
    setSubcategory(hasSubs ? null : ALL);
  };

  const goBack = () => {
    if (subcategory !== null && subcategories.length > 0) setSubcategory(null);
    else {
      setCategory(null);
      setSubcategory(null);
    }
  };

  const showRecipes = Boolean(q) || subcategory !== null;
  const title = q
    ? 'Middag i kväll'
    : subcategory && subcategory !== ALL
    ? subcategory
    : category || 'Middag i kväll';
  const canGoBack = !q && category !== null;

  const Thumb = ({ src }: { src?: string }) =>
    src ? (
      <img src={src} alt="" loading="lazy" className="w-11 h-11 rounded-xl object-cover bg-stone-200 shrink-0" />
    ) : (
      <div className="w-11 h-11 rounded-xl bg-stone-200 shrink-0" />
    );

  const rowClass = 'w-full py-2.5 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70';

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
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh] pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 pt-4 pb-3 space-y-3 border-b border-[#EBE7DF] shrink-0">
          <div className="flex items-center gap-1">
            {canGoBack && (
              <button
                type="button"
                onClick={goBack}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100 touch-manipulation shrink-0"
                aria-label="Tillbaka"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {canGoBack && subcategory && subcategory !== ALL && (
                <div className="text-xs text-stone-500 truncate">{category}</div>
              )}
              <h3 className="font-serif font-bold text-lg text-stone-900 truncate">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation shrink-0"
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
              placeholder="Sök bland alla recept"
              className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl pl-9 pr-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 divide-y divide-[#EBE7DF]">
          {showRecipes ? (
            recipeList.length === 0 ? (
              <p className="py-6 text-sm text-stone-500">Inga recept matchar "{query}".</p>
            ) : (
              recipeList.map((recipe) => (
                <button key={recipe.id} type="button" onClick={() => onSelect(recipe)} className={rowClass}>
                  <Thumb src={recipe.coverImageUrl} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-stone-900 truncate">
                      {formatRecipeTitle(recipe.title)}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {q ? `${recipe.category}, ` : ''}
                      {formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                    </span>
                  </span>
                  {recipe.id === currentRecipeId && (
                    <Check className="w-4 h-4 text-[#284235] shrink-0" aria-label="Vald" />
                  )}
                </button>
              ))
            )
          ) : category ? (
            <>
              <button type="button" onClick={() => setSubcategory(ALL)} className={rowClass}>
                <Thumb src={categories.find((c) => c.name === category)?.image} />
                <span className="flex-1 min-w-0 text-sm font-semibold text-stone-900">Alla</span>
                <span className="text-xs text-stone-500 tabular-nums">
                  {categories.find((c) => c.name === category)?.count}
                </span>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </button>
              {subcategories.map((sub) => (
                <button key={sub.name} type="button" onClick={() => setSubcategory(sub.name)} className={rowClass}>
                  <Thumb src={sub.image} />
                  <span className="flex-1 min-w-0 text-sm font-semibold text-stone-900 truncate">{sub.name}</span>
                  <span className="text-xs text-stone-500 tabular-nums">{sub.count}</span>
                  <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                </button>
              ))}
            </>
          ) : (
            categories.map((cat) => (
              <button key={cat.name} type="button" onClick={() => openCategory(cat.name)} className={rowClass}>
                <Thumb src={cat.image} />
                <span className="flex-1 min-w-0 text-sm font-semibold text-stone-900 truncate">{cat.name}</span>
                <span className="text-xs text-stone-500 tabular-nums">{cat.count}</span>
                <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
