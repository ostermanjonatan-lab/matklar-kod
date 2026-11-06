import React, { useState, useMemo } from 'react';
import type { Recipe, RecipeDifficulty } from '../../types/recipe';
import { DifficultyFilter } from './DifficultyPicker';
import { MaxTimeInput } from './MaxTimeInput';
import { getRecipeSubcategories } from '../../types/recipe';
import { DEFAULT_SUBCATEGORIES, DIETARY_SUBCATEGORIES, getAllStandardSubcategories } from '../../data/categories';
import { useRecipes } from '../../context/RecipeContext';
import {
  X,
  Check,
  Search
} from 'lucide-react';

export interface RecipeFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  // Category
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categories: string[];
  // Subcategories
  selectedSubcategories: string[];
  onToggleSubcategory: (subcat: string) => void;
  onSelectAllSubcategories: (subcats: string[]) => void;
  onClearSubcategories: () => void;
  // Cooking time
  maxCookingTime: number | null;
  onChangeMaxCookingTime: (time: number | null) => void;
  // Difficulty
  difficultyFilter: RecipeDifficulty[];
  onChangeDifficultyFilter: (selected: RecipeDifficulty[]) => void;
  // Favorites
  onlyFavorites: boolean;
  onToggleFavorites: () => void;
  // Reset
  onResetFilters: () => void;
  // Active count
  activeFilterCount: number;
  matchingCount: number;
  // Sorting (optional, shown last)
  sortOptions?: { id: string; shortLabel: string }[];
  sortBy?: string;
  onChangeSort?: (id: string) => void;
}

export const RecipeFilterModal: React.FC<RecipeFilterModalProps> = ({
  isOpen,
  onClose,
  recipes,
  selectedCategory,
  onSelectCategory,
  categories,
  selectedSubcategories,
  onToggleSubcategory,
  onSelectAllSubcategories,
  onClearSubcategories,
  maxCookingTime,
  onChangeMaxCookingTime,
  difficultyFilter,
  onChangeDifficultyFilter,
  onlyFavorites,
  onToggleFavorites,
  onResetFilters,
  activeFilterCount,
  matchingCount,
  sortOptions,
  sortBy,
  onChangeSort,
}) => {
  const { customSubcategories } = useRecipes();
  const [subcatSearch, setSubcatSearch] = useState<string>('');

  // Matching recipes based on category, favorites, and currently selected subcategories
  const matchingPool = useMemo(() => {
    return recipes.filter((r) => {
      if (selectedCategory !== 'Alla' && r.category !== selectedCategory) {
        return false;
      }
      if (onlyFavorites && !r.isFavorite) {
        return false;
      }
      if (selectedSubcategories.length > 0) {
        const rSubcats = getRecipeSubcategories(r);
        const matchesAll = selectedSubcategories.every((s) => rSubcats.includes(s));
        if (!matchesAll) return false;
      }
      return true;
    });
  }, [recipes, selectedCategory, selectedSubcategories, onlyFavorites]);

  // Counts map for each subcategory in matchingPool
  const subcategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    matchingPool.forEach((r) => {
      getRecipeSubcategories(r).forEach((s) => {
        counts.set(s, (counts.get(s) || 0) + 1);
      });
    });
    return counts;
  }, [matchingPool]);

  // Collect available subcategories:
  // Subcategories with recipes appear first (ordered by recipe count descending),
  // while empty subcategories (0 recipes) are placed at the bottom (ordered alphabetically).
  const availableSubcategories = useMemo(() => {
    const set = new Set<string>();

    // Always keep currently selected subcategories so user can see and uncheck them
    selectedSubcategories.forEach((s) => set.add(s));

    if (selectedSubcategories.length === 0) {
      // If none selected yet: include all subcategories from recipes in the current category
      recipes.forEach((r) => {
        if (selectedCategory === 'Alla' || r.category === selectedCategory) {
          getRecipeSubcategories(r).forEach((s) => set.add(s));
        }
      });
      // Also include standard dietary options
      DIETARY_SUBCATEGORIES.forEach((s) => set.add(s));
      // Also include any custom subcategories the user created
      (customSubcategories || []).forEach((s) => set.add(s));

      // Also ensure standard category defaults are present
      if (selectedCategory !== 'Alla' && DEFAULT_SUBCATEGORIES[selectedCategory]) {
        DEFAULT_SUBCATEGORIES[selectedCategory].forEach((s) => set.add(s));
      } else {
        getAllStandardSubcategories().forEach((s) => set.add(s));
      }
    } else {
      // When subcategories ARE selected: only show subcategories present in matching recipes
      matchingPool.forEach((r) => {
        getRecipeSubcategories(r).forEach((s) => set.add(s));
      });
    }

    const list = Array.from(set);

    return list.sort((a, b) => {
      const isASelected = selectedSubcategories.includes(a);
      const isBSelected = selectedSubcategories.includes(b);
      // 1. Selected subcategories first
      if (isASelected !== isBSelected) {
        return isASelected ? -1 : 1;
      }

      const countA = isASelected ? matchingPool.length : (subcategoryCounts.get(a) || 0);
      const countB = isBSelected ? matchingPool.length : (subcategoryCounts.get(b) || 0);

      const hasA = countA > 0;
      const hasB = countB > 0;

      // 2. Subcategories with recipes (count > 0) come before empty subcategories (count === 0)
      if (hasA !== hasB) {
        return hasA ? -1 : 1;
      }

      // 3. Among subcategories with recipes: highest recipe count first
      if (hasA && countA !== countB) {
        return countB - countA;
      }

      // 4. Alphabetical tie-breaker (A-Ö)
      return a.localeCompare(b, 'sv', { sensitivity: 'base' });
    });
  }, [recipes, selectedCategory, selectedSubcategories, matchingPool, customSubcategories, subcategoryCounts]);

  // Filter subcategories by inner search input
  const filteredSubcategories = useMemo(() => {
    if (!subcatSearch.trim()) return availableSubcategories;
    const q = subcatSearch.toLowerCase().trim();
    return availableSubcategories.filter((s) => s.toLowerCase().includes(q));
  }, [availableSubcategories, subcatSearch]);

  // Compute count of recipes having a specific subcategory within current match pool
  const getSubcategoryRecipeCount = (subcat: string) => {
    if (selectedSubcategories.includes(subcat)) {
      return matchingPool.length;
    }
    return subcategoryCounts.get(subcat) || 0;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
          <h2 id="filter-modal-title" className="font-serif font-bold text-lg text-stone-900 leading-tight">
            Filtrera och sortera
          </h2>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 touch-manipulation"
              >
                <span>Rensa alla</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors touch-manipulation"
              aria-label="Stäng filter"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 divide-y divide-stone-100">
          {/* 1. Huvudkategori (Category) */}
          <div className="space-y-2.5">
            <span className="text-sm font-semibold text-stone-900 block">Kategori</span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onSelectCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 touch-manipulation min-h-[38px] ${
                      isSelected
                        ? 'bg-[#284235] text-white shadow-xs'
                        : 'bg-[#FCFAF5] border border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Underkategorier med kryssrutor (The Main Requested Feature!) */}
          <div className="pt-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-stone-900">
                  Underkategorier
                  {selectedSubcategories.length > 0 && (
                    <span className="font-normal text-stone-500"> · {selectedSubcategories.length} valda</span>
                  )}
                </span>
                {selectedSubcategories.length > 1 && (
                  <p className="text-xs text-stone-500 mt-0.5">Recepten måste ha alla valda.</p>
                )}
              </div>

              {selectedSubcategories.length > 0 ? (
                <button
                  type="button"
                  onClick={onClearSubcategories}
                  className="text-xs text-[#284235] font-semibold hover:underline touch-manipulation py-1"
                >
                  Avmarkera alla
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectAllSubcategories(filteredSubcategories)}
                  className="text-xs text-[#284235] font-semibold hover:underline touch-manipulation py-1"
                >
                  Markera alla
                </button>
              )}
            </div>

            {/* Search Subcategories Input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={subcatSearch}
                onChange={(e) => setSubcatSearch(e.target.value)}
                placeholder="Sök underkategori"
                className="w-full h-10 bg-[#FCFAF5] text-stone-900 placeholder-stone-400 text-xs rounded-xl pl-9 pr-8 border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#284235]"
              />
              {subcatSearch && (
                <button
                  type="button"
                  onClick={() => setSubcatSearch('')}
                  className="absolute right-2.5 w-6 h-6 flex items-center justify-center text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Checkbox Grid */}
            <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 border-y border-stone-100">
              {filteredSubcategories.length > 0 ? (
                filteredSubcategories.map((subcat) => {
                  const isChecked = selectedSubcategories.includes(subcat);
                  const count = getSubcategoryRecipeCount(subcat);

                  return (
                    <label
                      key={subcat}
                      className="flex items-center justify-between py-2 cursor-pointer select-none touch-manipulation min-h-[44px] text-stone-800"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        {/* Custom styled checkbox */}
                        <div
                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                            isChecked
                              ? 'bg-[#284235] border-[#284235] text-white'
                              : 'border-stone-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        {/* Hidden real input for accessibility & semantics */}
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isChecked}
                          onChange={() => onToggleSubcategory(subcat)}
                        />

                        <span className={`text-sm truncate ${isChecked ? 'font-semibold text-stone-900' : ''}`}>{subcat}</span>
                      </div>

                      <span className={`text-xs tabular-nums shrink-0 ml-1 ${count > 0 ? 'text-stone-500' : 'text-stone-300'}`}>
                        {count}
                      </span>
                    </label>
                  );
                })
              ) : (
                <div className="py-4 text-sm text-stone-500">
                  Ingen underkategori heter "{subcatSearch}"
                </div>
              )}
            </div>
          </div>

          {/* 3. Snabbval & Fler Filter */}
          <div className="pt-5 space-y-4">
            {/* Endast favoriter */}
            <div className="flex items-center justify-between min-h-[44px]">
              <span className="text-sm font-semibold text-stone-900">Bara favoriter</span>

              <button
                type="button"
                onClick={onToggleFavorites}
                role="switch"
                aria-checked={onlyFavorites}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 touch-manipulation ${
                  onlyFavorites ? 'bg-rose-600' : 'bg-stone-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform transform ${
                    onlyFavorites ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Max tillagningstid, typed in by hand */}
            <div className="space-y-2">
              <label htmlFor="filter-max-time" className="block text-sm font-semibold text-stone-900">
                Max tillagningstid
              </label>
              <MaxTimeInput id="filter-max-time" value={maxCookingTime} onChange={onChangeMaxCookingTime} />
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-stone-900">Svårighetsgrad</span>
              <DifficultyFilter selected={difficultyFilter} onChange={onChangeDifficultyFilter} className="flex-wrap" />
            </div>

            {sortOptions && onChangeSort && (
              <div className="space-y-2">
                <span className="block text-sm font-semibold text-stone-900">Sortera</span>
                <div className="flex flex-wrap gap-1.5">
                  {sortOptions.map((opt) => {
                    const isSelected = sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeSort(opt.id)}
                        aria-pressed={isSelected}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all touch-manipulation min-h-[36px] ${
                          isSelected
                            ? 'bg-[#284235] text-white shadow-xs'
                            : 'bg-[#FCFAF5] border border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-stone-100 bg-white flex items-center gap-3 shrink-0">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs touch-manipulation min-h-[48px] shrink-0"
            >
              Återställ
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 px-5 bg-[#284235] hover:bg-black active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all touch-manipulation min-h-[48px]"
          >
            <span>Visa {matchingCount} recept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
