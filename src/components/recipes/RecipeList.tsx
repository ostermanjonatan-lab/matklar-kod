import React, { useState, useMemo, useDeferredValue, useCallback, useRef, useEffect } from 'react';
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
  Heart,
  ArrowUpDown,
  Check,
  ShoppingCart,
} from 'lucide-react';


type SortOption = 'default' | 'oldest' | 'time_asc' | 'time_desc' | 'name_asc' | 'name_desc';

interface SortItem {
  id: SortOption;
  label: string;
  shortLabel: string;
}

const SORT_OPTIONS: SortItem[] = [
  {
    id: 'default',
    label: 'Standard (Senast tillagda)',
    shortLabel: 'Senast tillagd',
  },
  {
    id: 'oldest',
    label: 'Äldst tillagda först',
    shortLabel: 'Äldst först',
  },
  {
    id: 'time_asc',
    label: 'Kortast tillagningstid först',
    shortLabel: 'Kortast tid',
  },
  {
    id: 'time_desc',
    label: 'Längre tillagningstid (Långkok)',
    shortLabel: 'Längre tid',
  },
  {
    id: 'name_asc',
    label: 'Namn A till Ö',
    shortLabel: 'Namn A–Ö',
  },
  {
    id: 'name_desc',
    label: 'Namn Ö till A',
    shortLabel: 'Namn Ö–A',
  },
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
    setShareToastRecipe(recipe.title);
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
        title: recipe.title,
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

    setUndoToastMessage(`Inköpet för "${recipeTitle}" ångrades!`);
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

        if (!matchesTitle && !matchesDesc && !matchesIngredient && !matchesTag && !matchesSubcat) {
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

  const filterAndSortCount = activeFilterCount + (sortBy !== 'default' ? 1 : 0);
  const isNarrowed = searchQuery.trim() !== '' || activeFilterCount > 0 || selectedCategory !== 'Alla';

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.id === sortBy)?.shortLabel || 'Standard';

  return (
    <div className="min-h-screen bg-[#FCFAF5] pb-28 w-full max-w-full overflow-x-hidden">
      {/* Toast Notification when sharing a recipe from card */}
      {shareToastRecipe && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between animate-slide-down text-xs font-semibold">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">"{shareToastRecipe}" har kopierats till urklipp i textform!</span>
          </div>
        </div>
      )}

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
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between animate-slide-down text-xs font-semibold gap-2 border border-white/10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ShoppingCart className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">
              "{shoppingToast.title}" lades till ({shoppingToast.count} {shoppingToast.count === 1 ? 'vara' : 'varor'})
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleUndoAddToShoppingList}
              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 active:scale-95 text-xs font-bold rounded-xl touch-manipulation transition-all cursor-pointer"
              title="Ångra och ta bort från inköpslistan"
            >
              Ångra
            </button>
            <button
              type="button"
              onClick={() => {
                setShoppingToast(null);
                setActiveTab('shopping');
              }}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shrink-0 touch-manipulation transition-all shadow-xs cursor-pointer"
            >
              Visa lista
            </button>
          </div>
        </div>
      )}

      {/* Undo confirmation toast */}
      {undoToastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between animate-slide-down text-xs font-semibold border border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{undoToastMessage}</span>
          </div>
        </div>
      )}
      {/* Recept Filter Modal */}
      {showFilterModal && (
        <RecipeFilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          recipes={recipes}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          categories={categories}
          selectedSubcategories={selectedSubcategories}
          onToggleSubcategory={toggleSubcategory}
          onSelectAllSubcategories={(subcats) => setSelectedSubcategories(subcats)}
          onClearSubcategories={() => setSelectedSubcategories([])}
          maxCookingTime={maxCookingTime}
          onChangeMaxCookingTime={setMaxCookingTime}
          difficultyFilter={difficultyFilter}
          onChangeDifficultyFilter={setDifficultyFilter}
          onlyFavorites={onlyFavorites}
          onToggleFavorites={() => setOnlyFavorites((prev) => !prev)}
          onResetFilters={clearFilters}
          activeFilterCount={activeFilterCount}
          matchingCount={sortedAndFilteredRecipes.length}
          sortOptions={SORT_OPTIONS}
          sortBy={sortBy}
          onChangeSort={(id) => setSortBy(id as SortOption)}
        />
      )}

      {/* Sort Bottom Sheet Modal */}
      {showSortSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-[#284235]" />
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Sortera recept
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSortSheet(false)}
                className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-stone-100 border border-[#EBE7DF] rounded-2xl overflow-hidden bg-white">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.id);
                      setShowSortSheet(false);
                    }}
                    className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors touch-manipulation min-h-[52px] ${
                      isSelected
                        ? 'bg-emerald-50/80 text-emerald-950 font-bold'
                        : 'text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#284235] text-white flex items-center justify-center shrink-0 ml-2">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowSortSheet(false)}
              className="w-full py-3.5 bg-stone-900 text-white font-semibold text-xs rounded-2xl touch-manipulation min-h-[48px]"
            >
              Klar
            </button>
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
                placeholder="Sök recept, råvaror, pasta..."
                className="w-full h-12 bg-white text-stone-900 placeholder-stone-400 text-base sm:text-sm rounded-2xl pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-[#284235] transition-all border border-[#EBE7DF] shadow-xs"
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
              aria-label="Filtrera och sortera"
              title="Filtrera och sortera"
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
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
              {/* Categories */}
              {categories.map((cat, catIdx) => {
                const isSelected = selectedCategory === cat;
                return (
                  <React.Fragment key={cat}>
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 touch-manipulation min-h-[40px] cursor-pointer ${
                      isSelected
                        ? 'bg-[#284235] text-white shadow-xs'
                        : 'bg-white border border-[#EBE7DF] text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {cat}
                  </button>
                  {catIdx === 0 && (
                    <button
                      type="button"
                      onClick={() => setOnlyFavorites((prev) => !prev)}
                      aria-pressed={onlyFavorites}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 touch-manipulation min-h-[40px] cursor-pointer flex items-center gap-1.5 ${
                        onlyFavorites
                          ? 'bg-[#284235] text-white shadow-xs'
                          : 'bg-white border border-[#EBE7DF] text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-white' : ''}`} />
                      Favoriter
                    </button>
                  )}
                  </React.Fragment>
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

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="md:hidden text-xs text-[#284235] font-semibold py-1 px-1 touch-manipulation"
            >
              Återställ
            </button>
          )}
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
          <div className="text-center py-12 bg-white rounded-3xl border border-[#EBE7DF] p-6 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#FCFAF5] text-stone-600 flex items-center justify-center mx-auto mb-3">
              <SlidersHorizontal className="w-5 h-5 stroke-[1.75]" />
            </div>
            <h3 className="font-serif text-base font-bold text-stone-900">Inga recept matchar filtren</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
              Testa att kryssa för andra underkategorier eller återställ dina filter.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 px-4 py-2.5 rounded-xl bg-stone-900 text-white font-semibold text-xs touch-manipulation"
            >
              Återställ filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
