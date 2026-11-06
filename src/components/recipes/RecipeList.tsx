import { formatRecipeTitle } from '../../utils/formatters';
import { categoryLabel } from '../../data/categories';
import React, { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from 'react';
import { Toast } from '../layout/Toast';
import { useRecipes } from '../../context/RecipeContext';
import type { Recipe, RecipeDifficulty } from '../../types/recipe';
import { matchesDifficulty } from './DifficultyPicker';
import { getRecipeSubcategories, getRecipeTimestamp } from '../../types/recipe';
import { RecipeCard } from './RecipeCard';
import { PantryChoiceDialog, hasPantryStaples } from './PantryChoiceDialog';
import { RecipeFilterModal } from './RecipeFilterModal';
import { STANDARD_CATEGORIES } from '../../data/categories';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Check,
  ChevronDown,
} from 'lucide-react';


type SortOption = 'default' | 'oldest' | 'time_asc' | 'time_desc' | 'name_asc' | 'name_desc';

interface SortItem {
  id: SortOption;
  label: string;
  shortLabel: string;
}

const SORT_OPTIONS: SortItem[] = [
  { id: 'default', label: 'Senast tillagda', shortLabel: 'Senast tillagda' },
  { id: 'oldest', label: 'Först tillagda', shortLabel: 'Först tillagda' },
  { id: 'time_asc', label: 'Kortast tid', shortLabel: 'Kortast tid' },
  { id: 'time_desc', label: 'Längst tid', shortLabel: 'Längst tid' },
  { id: 'name_asc', label: 'Namn A–Ö', shortLabel: 'Namn A–Ö' },
  { id: 'name_desc', label: 'Namn Ö–A', shortLabel: 'Namn Ö–A' },
];

const INITIAL_BATCH_SIZE = 24;
const BATCH_INCREMENT = 18;

export const RecipeList: React.FC = () => {
  const {
    recipes,
    openRecipeDetail,
    toggleFavorite,
    addIngredientsToShoppingList,
    restoreShoppingList,
    setActiveTab,
    shoppingList,
    searchQuery,
    setSearchQuery,
  } = useRecipes();


  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [selectedCategory, setSelectedCategory] = useState<string>('Alla');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [maxCookingTime, setMaxCookingTime] = useState<number | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<RecipeDifficulty[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showSortSheet, setShowSortSheet] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);

  // Pagination / Infinite scroll state
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Stable callbacks for memoized RecipeCard
  const handleSelectRecipe = useCallback(
    (recipe: Recipe) => {
      openRecipeDetail(recipe);
    },
    [openRecipeDetail]
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      toggleFavorite(id);
    },
    [toggleFavorite]
  );

  const [shareToastRecipe, setShareToastRecipe] = useState<string | null>(null);

  const handleShareRecipe = useCallback((recipe: Recipe) => {
    setShareToastRecipe(formatRecipeTitle(recipe.title));
    setTimeout(() => setShareToastRecipe(null), 3000);
  }, []);

  // Shopping list quick-add toast with undo snapshot
  const [shoppingToast, setShoppingToast] = useState<{
    title: string;
    count: number;
    undoSnapshot: typeof shoppingList;
  } | null>(null);
  const [undoToastMessage, setUndoToastMessage] = useState<string | null>(null);
  const shoppingToastTimeoutRef = useRef<any>(null);
  const undoToastTimeoutRef = useRef<any>(null);

  const [recipeForPantryChoice, setRecipeForPantryChoice] = useState<Recipe | null>(null);
  useModalBackHandler(Boolean(recipeForPantryChoice), () => setRecipeForPantryChoice(null), 'pantry-choice');

  const addRecipeToShoppingList = useCallback(
    (recipe: Recipe, skipPantryStaples: boolean) => {
      // Snapshot prior shopping list state before adding
      const snapshot = [...shoppingList];

      const count = addIngredientsToShoppingList(
        recipe.ingredients,
        recipe.title,
        skipPantryStaples
      );

      if (shoppingToastTimeoutRef.current) {
        clearTimeout(shoppingToastTimeoutRef.current);
      }
      if (undoToastTimeoutRef.current) {
        clearTimeout(undoToastTimeoutRef.current);
        setUndoToastMessage(null);
      }

      setShoppingToast({
        title: formatRecipeTitle(recipe.title),
        count,
        undoSnapshot: snapshot,
      });

      // Keep toast visible for 5 seconds for easy undo
      shoppingToastTimeoutRef.current = setTimeout(() => {
        setShoppingToast(null);
      }, 5000);
    },
    [addIngredientsToShoppingList, shoppingList]
  );

  const handleAddToShoppingList = useCallback(
    (recipe: Recipe) => {
      if (!recipe.ingredients || recipe.ingredients.length === 0) return false;

      if (hasPantryStaples(recipe)) {
        setRecipeForPantryChoice(recipe);
        return false;
      }

      addRecipeToShoppingList(recipe, true);
      return true;
    },
    [addRecipeToShoppingList]
  );

  const handleUndoAddToShoppingList = useCallback(() => {
    if (!shoppingToast) return;
    const recipeTitle = shoppingToast.title;
    restoreShoppingList(shoppingToast.undoSnapshot);

    if (shoppingToastTimeoutRef.current) {
      clearTimeout(shoppingToastTimeoutRef.current);
    }
    setShoppingToast(null);

    setUndoToastMessage(`Varorna från ${recipeTitle} togs bort från inköpslistan`);
    undoToastTimeoutRef.current = setTimeout(() => {
      setUndoToastMessage(null);
    }, 3000);
  }, [shoppingToast, restoreShoppingList]);

  useEffect(() => {
    return () => {
      if (shoppingToastTimeoutRef.current) {
        clearTimeout(shoppingToastTimeoutRef.current);
      }
      if (undoToastTimeoutRef.current) {
        clearTimeout(undoToastTimeoutRef.current);
      }
    };
  }, []);

  // Set of recipe titles that have items currently in the shopping list
  const activeRecipeTitlesInShopping = useMemo(() => {
    const titles = new Set<string>();
    shoppingList.forEach((item) => {
      if (item.recipeSource) {
        item.recipeSource.split('+').forEach((s) => titles.add(s.trim().toLowerCase()));
      }
      if (item.mergedSources) {
        item.mergedSources.forEach((s) => titles.add(s.trim().toLowerCase()));
      }
    });
    return titles;
  }, [shoppingList]);

  // Synchronize modal and sheet visibility with Android back button
  useModalBackHandler(showFilterModal, () => setShowFilterModal(false), 'recipe-filter');
  useModalBackHandler(showSortSheet, () => setShowSortSheet(false), 'sort-sheet');

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    recipes.forEach((r) => {
      if (r.category) cats.add(r.category);
    });
    // Order according to STANDARD_CATEGORIES first, then any custom categories
    const ordered = STANDARD_CATEGORIES.filter((c) => cats.has(c));
    const custom = Array.from(cats).filter((c) => !STANDARD_CATEGORIES.includes(c));
    return ['Alla', ...ordered, ...custom];
  }, [recipes]);


  const toggleSubcategory = (subcat: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(subcat) ? prev.filter((s) => s !== subcat) : [...prev, subcat]
    );
  };

  // Filter & Sort Recipes
  const sortedAndFilteredRecipes = useMemo(() => {
    const result = recipes.filter((recipe) => {
      const recipeSubcats = getRecipeSubcategories(recipe);

      // Search query filter
      if (deferredSearchQuery.trim()) {
        const q = deferredSearchQuery.toLowerCase().trim();
        const matchesTitle = recipe.title.toLowerCase().includes(q);
        const matchesDesc = (recipe.description || '').toLowerCase().includes(q);
        const matchesIngredient = recipe.ingredients.some((ing) =>
          ing.name.toLowerCase().includes(q)
        );
        const matchesTag = recipe.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesSubcat = recipeSubcats.some((s) => s.toLowerCase().includes(q));
        const matchesCategory = categoryLabel(recipe.category).toLowerCase().includes(q);

        if (!matchesTitle && !matchesDesc && !matchesIngredient && !matchesTag && !matchesSubcat && !matchesCategory) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'Alla' && recipe.category !== selectedCategory) {
        return false;
      }

      // Subcategory filter: strictly OCH (must contain ALL selected subcategories)
      if (selectedSubcategories.length > 0) {
        const matchesAll = selectedSubcategories.every((s) => recipeSubcats.includes(s));
        if (!matchesAll) return false;
      }

      // Max cooking time filter
      if (maxCookingTime !== null) {
        const totalTime = (typeof recipe.cookTimeMinutes === 'number' && recipe.cookTimeMinutes > 0)
          ? recipe.cookTimeMinutes
          : (recipe.prepTimeMinutes || 0);
        if (totalTime > maxCookingTime) {
          return false;
        }
      }


      // Difficulty filter
      if (!matchesDifficulty(recipe.difficulty, difficultyFilter)) {
        return false;
      }

      // Favorites filter
      if (onlyFavorites && !recipe.isFavorite) {
        return false;
      }

      return true;
    });

    // Sort result
    result.sort((a, b) => {
      const totalTimeA = (typeof a.cookTimeMinutes === 'number' && a.cookTimeMinutes > 0) ? a.cookTimeMinutes : (a.prepTimeMinutes || 0);
      const totalTimeB = (typeof b.cookTimeMinutes === 'number' && b.cookTimeMinutes > 0) ? b.cookTimeMinutes : (b.prepTimeMinutes || 0);

      switch (sortBy) {
        case 'time_asc':
          return totalTimeA - totalTimeB;
        case 'time_desc':
          return totalTimeB - totalTimeA;
        case 'name_asc':
          return a.title.localeCompare(b.title, 'sv', { sensitivity: 'base' });
        case 'oldest': {
          const timeA = getRecipeTimestamp(a);
          const timeB = getRecipeTimestamp(b);
          if (timeA !== timeB) return timeA - timeB;
          return a.title.localeCompare(b.title, 'sv', { sensitivity: 'base' });
        }
        case 'default':
        default: {
          const timeA = getRecipeTimestamp(a);
          const timeB = getRecipeTimestamp(b);
          if (timeA !== timeB) return timeB - timeA;
          return a.title.localeCompare(b.title, 'sv', { sensitivity: 'base' });
        }
      }
    });

    return result;
  }, [
    recipes,
    deferredSearchQuery,
    selectedCategory,
    selectedSubcategories,
    maxCookingTime,
    difficultyFilter,
    onlyFavorites,
    sortBy,
  ]);

  // Reset visible count back to initial batch size whenever filters or search query change
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH_SIZE);
  }, [
    deferredSearchQuery,
    selectedCategory,
    selectedSubcategories,
    maxCookingTime,
    difficultyFilter,
    onlyFavorites,
    sortBy,
  ]);

  // Slice visible recipes to prevent massive DOM footprint and GPU stutter
  const visibleRecipes = useMemo(() => {
    return sortedAndFilteredRecipes.slice(0, visibleCount);
  }, [sortedAndFilteredRecipes, visibleCount]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_INCREMENT, sortedAndFilteredRecipes.length));
  }, [sortedAndFilteredRecipes.length]);

  // Intersection observer to automatically load next batch when scrolling near bottom
  useEffect(() => {
    if (visibleCount >= sortedAndFilteredRecipes.length) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, visibleCount, sortedAndFilteredRecipes.length]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Alla');
    setSelectedSubcategories([]);
    setMaxCookingTime(null);
    setDifficultyFilter([]);
    setOnlyFavorites(false);
    setSortBy('default');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'Alla') count++;
    count += selectedSubcategories.length;
    if (maxCookingTime !== null) count++;
    count += difficultyFilter.length;
    if (onlyFavorites) count++;
    return count;
  }, [selectedCategory, selectedSubcategories, maxCookingTime, difficultyFilter, onlyFavorites]);


  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    activeFilterCount > 0 ||
    sortBy !== 'default';

  // The number on the filter button: only what is chosen inside it. Category and favourites show in the tabs, sorting next to the count.
  const filterAndSortCount =
    selectedSubcategories.length + (maxCookingTime !== null ? 1 : 0) + difficultyFilter.length;
  const isNarrowed = searchQuery.trim() !== '' || activeFilterCount > 0 || selectedCategory !== 'Alla';

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.id === sortBy)?.shortLabel || 'Standard';

  return (
    <div className="min-h-screen bg-[#FCFAF5] pb-28 w-full max-w-full overflow-x-hidden">
      {/* Toast Notification when sharing a recipe from card */}
      {shareToastRecipe && <Toast message={`${shareToastRecipe} är kopierat som text`} />}

      {/* Ask whether pantry staples should be included */}
      {recipeForPantryChoice && (
        <PantryChoiceDialog
          recipe={recipeForPantryChoice}
          onChoose={(skipPantryStaples) => {
            addRecipeToShoppingList(recipeForPantryChoice, skipPantryStaples);
            setRecipeForPantryChoice(null);
          }}
          onClose={() => setRecipeForPantryChoice(null)}
        />
      )}

      {/* Toast Notification when adding recipe to shopping list with Undo button */}
      {shoppingToast && (
        <Toast
          message={`${shoppingToast.title}: ${shoppingToast.count} ${shoppingToast.count === 1 ? 'vara' : 'varor'} i inköpslistan`}
          actions={[
            { label: 'Ångra', onClick: handleUndoAddToShoppingList },
            {
              label: 'Visa',
              onClick: () => {
                setShoppingToast(null);
                setActiveTab('shopping');
              },
            },
          ]}
        />
      )}

      {/* Undo confirmation toast */}
      {undoToastMessage && <Toast message={undoToastMessage} />}
      {/* Recept Filter Modal */}
      {showFilterModal && (
        <RecipeFilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          recipes={recipes}
          selectedCategory={selectedCategory}
          selectedSubcategories={selectedSubcategories}
          onToggleSubcategory={toggleSubcategory}
          onSelectAllSubcategories={(subcats) => setSelectedSubcategories(subcats)}
          onClearSubcategories={() => setSelectedSubcategories([])}
          maxCookingTime={maxCookingTime}
          onChangeMaxCookingTime={setMaxCookingTime}
          difficultyFilter={difficultyFilter}
          onChangeDifficultyFilter={setDifficultyFilter}
          onlyFavorites={onlyFavorites}
          onResetFilters={clearFilters}
          activeFilterCount={activeFilterCount}
          matchingCount={sortedAndFilteredRecipes.length}
        />
      )}

      {/* Sort Bottom Sheet Modal */}
      {showSortSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center animate-fade-in font-sans"
          onClick={() => setShowSortSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Sortera recepten"
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif font-bold text-lg text-stone-900 pb-2">Sortera recepten</h3>
            <div className="divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]" role="radiogroup">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowSortSheet(false);
                    }}
                    className="w-full min-h-[50px] flex items-center justify-between text-left touch-manipulation"
                  >
                    <span className={`text-[15px] ${isSelected ? 'font-semibold text-stone-900' : 'text-stone-700'}`}>{opt.label}</span>
                    {isSelected && <Check className="w-5 h-5 text-[#284235] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Header (sticky top-0 on mobile, static on desktop below the hero banner) */}
      <div className="sticky top-0 md:static z-20 md:z-auto bg-[#FCFAF5]/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none border-b md:border-b-0 border-[#EBE7DF] shadow-xs md:shadow-none py-2.5 md:py-2 w-full min-w-0">
        <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto px-4 md:px-6">
          {/* Mobile Search Input (Hidden on desktop since DesktopNav handles search) */}
          <div className="md:hidden mb-2.5 flex items-center gap-2">
            <div className="relative flex-1 min-w-0 flex items-center">
              <Search className="w-5 h-5 text-stone-400 absolute left-3.5 pointer-events-none stroke-[2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök recept eller råvara"
                className={`w-full h-12 bg-white text-stone-900 placeholder-stone-400 text-base sm:text-sm rounded-2xl pl-10 ${searchQuery ? 'pr-12' : 'pr-3'} focus:outline-none focus:ring-2 focus:ring-[#284235] transition-all border border-[#EBE7DF] shadow-xs`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 w-10 h-10 flex items-center justify-center text-stone-400 hover:text-stone-700 touch-manipulation cursor-pointer"
                  aria-label="Rensa sökning"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilterModal(true)}
              className={`relative w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center touch-manipulation ${
                filterAndSortCount > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-white border-[#EBE7DF] text-stone-700 shadow-xs'
              }`}
              aria-label="Filtrera"
              title="Filtrera"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {filterAndSortCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#284235] text-white text-[10px] font-bold flex items-center justify-center">
                  {filterAndSortCount}
                </span>
              )}
            </button>
          </div>

          {/* Category & Filter Row (Horizontal Scroll on mobile, unified bar on desktop) */}
          <div className="flex items-center justify-between gap-3">
            {/* Light text tabs: Alla, Favoriter, then the categories. The row fades out at the
                right edge so it is clear that it can be swiped. */}
            <div
              className="flex items-center gap-5 overflow-x-auto no-scrollbar flex-1 min-w-0 pr-6"
              role="tablist"
              aria-label="Kategorier"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)',
                maskImage: 'linear-gradient(to right, #000 calc(100% - 28px), transparent)',
              }}
            >
              {[categories[0], 'Favoriter', ...categories.slice(1)].map((cat) => {
                const isFavorites = cat === 'Favoriter';
                const isSelected = isFavorites ? onlyFavorites : !onlyFavorites && selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (isFavorites) {
                        setOnlyFavorites(true);
                        setSelectedCategory('Alla');
                      } else {
                        setOnlyFavorites(false);
                        setSelectedCategory(cat);
                      }
                    }}
                    className={`relative shrink-0 whitespace-nowrap min-h-[40px] text-[15px] touch-manipulation cursor-pointer ${
                      isSelected ? 'text-stone-900 font-semibold' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {isFavorites ? 'Favoriter' : categoryLabel(cat)}
                    {isSelected && (
                      <span className="absolute left-0 right-0 bottom-1 h-[2px] rounded-full bg-[#284235]" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop Filter & Sort Controls (Visible on md:) */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  activeFilterCount > 0
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-bold shadow-xs'
                    : 'bg-white text-stone-700 border-[#EBE7DF] hover:bg-stone-50 shadow-2xs'
                }`}
                title="Filtrera recept"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-500" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#284235] text-white text-[10px] font-extrabold">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSortSheet(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  sortBy !== 'default'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs'
                    : 'bg-white text-stone-700 border-[#EBE7DF] hover:bg-stone-50 shadow-2xs'
                }`}
                title="Välj sorteringsordning"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
                <span>Sortera: {activeSortLabel}</span>
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-[#284235] font-bold hover:underline py-1.5 px-2 cursor-pointer"
                >
                  Återställ
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto px-4 md:px-6 pt-2 md:pt-4 space-y-4 md:space-y-6">
        {/* Number of recipes. "Träffar" only after a search or filter */}
        <div className="flex items-center justify-between px-1 gap-2 min-h-[24px]">
          <span className="text-xs text-stone-500 whitespace-nowrap">
            {isNarrowed
              ? `${sortedAndFilteredRecipes.length} ${sortedAndFilteredRecipes.length === 1 ? 'träff' : 'träffar'}`
              : `${sortedAndFilteredRecipes.length} recept`}
            {onlyFavorites && ' bland favoriter'}
          </span>

          <div className="md:hidden flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-[#284235] font-semibold min-h-[36px] touch-manipulation"
              >
                Återställ
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSortSheet(true)}
              className="flex items-center gap-1 text-xs text-stone-600 min-h-[36px] touch-manipulation"
              aria-label={`Sortera, nu ${activeSortLabel}`}
            >
              {activeSortLabel}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recipe Cards List / Grid (1 col on mobile, 2 cols on tablet, 3-4 cols on desktop) */}
        {sortedAndFilteredRecipes.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {visibleRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={handleSelectRecipe}
                  onToggleFavorite={handleToggleFavorite}
                  onShareRecipe={handleShareRecipe}
                  onAddToShoppingList={handleAddToShoppingList}
                  isInShoppingList={activeRecipeTitlesInShopping.has(recipe.title.trim().toLowerCase())}
                />
              ))}
            </div>

            {/* Infinite scroll sentinel & Load more controls */}
            {visibleCount < sortedAndFilteredRecipes.length && (
              <div
                ref={sentinelRef}
                className="pt-3 pb-6 text-center flex flex-col items-center justify-center gap-2"
              >
                <button
                  type="button"
                  onClick={loadMore}
                  className="px-6 py-2.5 bg-white border border-[#EBE7DF] rounded-2xl text-xs font-bold text-stone-700 hover:bg-stone-50 shadow-xs active:scale-95 transition-all touch-manipulation cursor-pointer"
                >
                  Visa fler recept ({sortedAndFilteredRecipes.length - visibleCount} kvar)
                </button>
              </div>
            )}

            {sortedAndFilteredRecipes.length > INITIAL_BATCH_SIZE &&
              visibleCount >= sortedAndFilteredRecipes.length && (
                <div className="pt-2 pb-6 text-center text-xs text-stone-400 font-medium">
                  Visar alla {sortedAndFilteredRecipes.length} recept
                </div>
              )}
          </div>
        ) : (
          <div className="py-8 space-y-2">
            <h3 className="font-serif text-lg font-bold text-stone-900">Inga recept med de här filtren</h3>
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-[44px] text-sm font-semibold text-[#284235] touch-manipulation"
            >
              Rensa filtren
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
