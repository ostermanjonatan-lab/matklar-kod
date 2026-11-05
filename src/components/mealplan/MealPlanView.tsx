import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import type { MealPlanDay } from '../../types/recipe';
import { getRecipeSubcategories } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import {
  Plus,
  Trash2,
  ShoppingCart,
  Dices,
  Minus,
  CheckCircle2,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
  Star,
  Layers,
  View,
  Utensils,
  X,
  AlertCircle,
  Columns2,
  ChefHat
} from 'lucide-react';
import { LunchboxIcon } from '../icons/LunchboxIcon';
import { formatCookingTime, scaleIngredientAmount, formatAmount } from '../../utils/formatters';

const DAYS_OF_WEEK: MealPlanDay['dayName'][] = [
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
  'Söndag',
];

const DAY_ABBR: Record<MealPlanDay['dayName'], string> = {
  'Måndag': 'MÅN',
  'Tisdag': 'TIS',
  'Onsdag': 'ONS',
  'Torsdag': 'TOR',
  'Fredag': 'FRE',
  'Lördag': 'LÖR',
  'Söndag': 'SÖN',
};

// Compute ISO week number
function getISOWeekNumber(d: Date = new Date()): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const MealPlanView: React.FC = () => {
  const {
    recipes,
    mealPlan,
    setMealPlanForDay,
    setMealPlanServings,
    clearMealPlan,
    generateShoppingListFromWeek,
    openRecipeDetail,
    setActiveTab,
  } = useRecipes();

  const currentWeekNumber = useMemo(() => getISOWeekNumber(), []);

  const todayIndex = useMemo(() => (new Date().getDay() + 6) % 7, []);

  // State: selected day index (0 = Måndag, 6 = Söndag), defaults to today's weekday
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return (new Date().getDay() + 6) % 7;
  });

  // View Mode: 'split' (Master-Detail Split View on desktop / Story Card on mobile) vs 'overview' (compact list)
  const [viewMode, setViewMode] = useState<'split' | 'overview'>('split');

  // Recipe Picker modal
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    dayName: MealPlanDay['dayName'];
    mealType: 'lunch' | 'dinner';
  } | null>(null);

  const [pickerTab, setPickerTab] = useState<'recipe' | 'custom'>('recipe');
  const [customMealInput, setCustomMealInput] = useState<string>('');
  const [recipeSearchQuery, setRecipeSearchQuery] = useState<string>('');
  const [pickerCategoryFilter, setPickerCategoryFilter] = useState<string>('all');

  // Clear week modal
  const [showClearWeekModal, setShowClearWeekModal] = useState<boolean>(false);

  // Generate shopping list modal
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [skipPantryStaples, setSkipPantryStaples] = useState<boolean>(true);
  const [generatedToast, setGeneratedToast] = useState<string | null>(null);

  // Synchronize meal plan modals with Android back button
  useModalBackHandler(!!pickerState?.isOpen, () => setPickerState(null), 'meal-picker');
  useModalBackHandler(showGenerateModal, () => setShowGenerateModal(false), 'generate-shopping');
  useModalBackHandler(showClearWeekModal, () => setShowClearWeekModal(false), 'clear-week');

  const activeDayName = DAYS_OF_WEEK[selectedDayIndex];
  const activeDayData = mealPlan.find((d) => d.dayName === activeDayName) || {
    dayName: activeDayName,
    dinnerServings: 4,
    lunchServings: 2,
  };

  const dinnerRecipe = recipes.find((r) => r.id === activeDayData.dinnerRecipeId);
  const lunchRecipe = recipes.find((r) => r.id === activeDayData.lunchRecipeId);

  // Count planned dinners & lunches accurately by ensuring recipe exists or custom text is filled
  const plannedDinnerCount = useMemo(() => {
    return mealPlan.filter(
      (d) => (d.dinnerRecipeId && recipes.some((r) => r.id === d.dinnerRecipeId)) || Boolean(d.customDinner?.trim())
    ).length;
  }, [mealPlan, recipes]);

  const plannedLunchCount = useMemo(() => {
    return mealPlan.filter(
      (d) => (d.lunchRecipeId && recipes.some((r) => r.id === d.lunchRecipeId)) || Boolean(d.customLunch?.trim())
    ).length;
  }, [mealPlan, recipes]);

  const totalPlannedMeals = plannedDinnerCount + plannedLunchCount;

  // Recipe selection
  const handleSelectRecipe = (recipeId: string) => {
    if (!pickerState) return;
    setMealPlanForDay(
      pickerState.dayName,
      pickerState.mealType,
      recipeId
    );
    setPickerState(null);
  };

  const handleSaveCustomMeal = () => {
    if (!pickerState) return;
    const trimmed = customMealInput.trim();
    if (!trimmed) return;
    setMealPlanForDay(pickerState.dayName, pickerState.mealType, null, trimmed);
    setPickerState(null);
  };

  const handleClearMeal = (
    dayName: MealPlanDay['dayName'],
    mealType: 'lunch' | 'dinner'
  ) => {
    setMealPlanForDay(dayName, mealType, null, '');
  };

  const handleRandomPickForDay = (
    dayName: MealPlanDay['dayName'],
    mealType: 'lunch' | 'dinner'
  ) => {
    if (recipes.length === 0) return;
    const foodRecipes = recipes.filter(
      (r) => !['Efterrätt', 'Dryck', 'Såser'].includes(r.category)
    );
    const basePool = foodRecipes.length > 0 ? foodRecipes : recipes;
    if (basePool.length === 0) return;

    // Get recipe currently set for this slot (if any)
    const currentDayData = mealPlan.find((d) => d.dayName === dayName);
    const currentRecipeId = mealType === 'dinner' ? currentDayData?.dinnerRecipeId : currentDayData?.lunchRecipeId;

    // Track usage count of each recipe across other planned meals in the week
    const usageCount = new Map<string, number>();
    basePool.forEach((r) => usageCount.set(r.id, 0));

    mealPlan.forEach((d) => {
      if (d.dayName === dayName) {
        // Count the OTHER meal on the same day (e.g. lunch if we are picking dinner)
        const otherMealId = mealType === 'dinner' ? d.lunchRecipeId : d.dinnerRecipeId;
        if (otherMealId && usageCount.has(otherMealId)) {
          usageCount.set(otherMealId, (usageCount.get(otherMealId) || 0) + 1);
        }
      } else {
        if (d.dinnerRecipeId && usageCount.has(d.dinnerRecipeId)) {
          usageCount.set(d.dinnerRecipeId, (usageCount.get(d.dinnerRecipeId) || 0) + 1);
        }
        if (d.lunchRecipeId && usageCount.has(d.lunchRecipeId)) {
          usageCount.set(d.lunchRecipeId, (usageCount.get(d.lunchRecipeId) || 0) + 1);
        }
      }
    });

    // 1. Primary candidate pool: recipes NOT yet planned in the week and not the current recipe
    let eligible = basePool.filter(
      (r) => (usageCount.get(r.id) || 0) === 0 && (basePool.length <= 1 || r.id !== currentRecipeId)
    );

    // 2. If all recipes have already been used in the week, fall back to recipes used the fewest times
    if (eligible.length === 0) {
      const candidates = basePool.filter((r) => basePool.length <= 1 || r.id !== currentRecipeId);
      if (candidates.length > 0) {
        const minUsage = Math.min(...candidates.map((r) => usageCount.get(r.id) || 0));
        eligible = candidates.filter((r) => (usageCount.get(r.id) || 0) === minUsage);
      } else {
        eligible = basePool;
      }
    }

    const randomIdx = Math.floor(Math.random() * eligible.length);
    const randomRecipe = eligible[randomIdx];
    if (randomRecipe) {
      setMealPlanForDay(dayName, mealType, randomRecipe.id);
    }
  };

  const handleConfirmClearWeek = () => {
    clearMealPlan();
    setShowClearWeekModal(false);
    setGeneratedToast('Veckomenyn har nollställts');
    setTimeout(() => setGeneratedToast(null), 2500);
  };

  const handleConfirmGenerateShoppingList = () => {
    generateShoppingListFromWeek(skipPantryStaples);
    setShowGenerateModal(false);
    setGeneratedToast('Inköpslistan har skapats från veckans menyer!');
    setTimeout(() => {
      setGeneratedToast(null);
      setActiveTab('shopping');
    }, 1500);
  };

  const openPickerModal = (dayName: MealPlanDay['dayName'], mealType: 'lunch' | 'dinner') => {
    const dayObj = mealPlan.find((d) => d.dayName === dayName);
    const existingCustom = mealType === 'dinner' ? dayObj?.customDinner : dayObj?.customLunch;
    setCustomMealInput(existingCustom || '');
    setPickerTab(existingCustom ? 'custom' : 'recipe');
    setRecipeSearchQuery('');
    setPickerCategoryFilter('all');
    setPickerState({
      isOpen: true,
      dayName,
      mealType,
    });
  };

  // Filter recipes for picker modal
  const filteredPickerRecipes = useMemo(() => {
    return recipes.filter((r) => {
      if (pickerCategoryFilter !== 'all' && r.category !== pickerCategoryFilter) {
        return false;
      }
      if (!recipeSearchQuery.trim()) return true;
      const q = recipeSearchQuery.toLowerCase().trim();
      const subcats = getRecipeSubcategories(r);
      return (
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        subcats.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [recipes, recipeSearchQuery, pickerCategoryFilter]);

  // Unique categories for picker
  const pickerCategories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [recipes]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = useState<{ left: number; width: number } | null>(() => {
    if (typeof document !== 'undefined') {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        const rect = mainEl.getBoundingClientRect();
        return { left: rect.left, width: rect.width };
      }
    }
    return null;
  });

  useLayoutEffect(() => {
    const updateBounds = () => {
      const target = containerRef.current || document.querySelector('main');
      if (target) {
        const rect = target.getBoundingClientRect();
        setContainerBounds({ left: rect.left, width: rect.width });
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    const target = containerRef.current || document.querySelector('main');
    const ro = new ResizeObserver(updateBounds);
    if (target) {
      ro.observe(target);
    }

    return () => {
      window.removeEventListener('resize', updateBounds);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#FCFAF5] pb-48 w-full max-w-full overflow-x-hidden font-sans">
      {/* Toast Notification */}
      {generatedToast && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-slide-down text-xs font-semibold border border-white/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{generatedToast}</span>
        </div>
      )}

      {/* HEADER & THUMBNAIL STRIP (Sticky top-0 on mobile, static on desktop) */}
      <div className="sticky top-0 md:static z-20 md:z-auto bg-[#FCFAF5]/95 backdrop-blur-md border-b border-[#EBE7DF] px-3.5 md:px-6 pt-3 pb-3 shadow-xs">
        <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto">
          {/* Row 1: Title, Week Info & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="min-w-fit">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                <span>Vecka {currentWeekNumber}</span>
                <span>•</span>
                <span className="text-stone-500 font-medium lowercase">
                  {plannedDinnerCount} av 7 middagar
                </span>
              </div>
              <h1 className="font-serif text-2xl font-bold text-stone-900 leading-tight">
                Veckoplanering
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop Create Shopping List Button */}
              <button
                type="button"
                onClick={() => {
                  if (totalPlannedMeals === 0) {
                    setGeneratedToast('Planera in minst en måltid i veckan först');
                    setTimeout(() => setGeneratedToast(null), 2500);
                    return;
                  }
                  setShowGenerateModal(true);
                }}
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#284235] hover:bg-black text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer min-h-[38px]"
                title="Skapa inköpslista från veckans måltider"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-300" />
                <span>Skapa inköpslista</span>
                {totalPlannedMeals > 0 && (
                  <span className="bg-emerald-900 text-emerald-200 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {totalPlannedMeals}
                  </span>
                )}
              </button>

              {/* Clear Week button if any meals are planned */}
              {totalPlannedMeals > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearWeekModal(true)}
                  className="px-2.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-[#EBE7DF] hover:border-rose-200 text-stone-500 hover:text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs touch-manipulation min-h-[38px] cursor-pointer"
                  title="Rensa hela veckomenyn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rensa</span>
                </button>
              )}

            {/* View Mode Toggle: Mobile (Story vs Overview) */}
            {/* View Mode Toggle: Mobile (Story vs Overview) */}
            <div className="flex md:hidden items-center bg-white border border-[#EBE7DF] p-0.5 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation min-h-[34px] min-w-[34px] flex items-center justify-center ${
                  viewMode === 'split'
                    ? 'bg-[#284235] text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
                title="Kortvy (Dag för dag)"
                aria-label="Kortvy"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation min-h-[34px] min-w-[34px] flex items-center justify-center ${
                  viewMode === 'overview'
                    ? 'bg-[#284235] text-white shadow-xs'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
                title="Veckoöversikt"
                aria-label="Veckoöversikt"
              >
                <View className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Toggle: Desktop (Delad vy vs Veckoöversikt) */}
            <div className="hidden md:flex items-center bg-white border border-[#EBE7DF] p-0.5 rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'split'
                    ? 'bg-[#284235] text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Delad vy (Veckolista till vänster, receptpanel till höger)"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Delad vy</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'overview'
                    ? 'bg-[#284235] text-white shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Veckoöversikt (Kompakt översikt över hela veckan)"
              >
                <View className="w-3.5 h-3.5" />
                <span>Veckoöversikt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Visual 7-Day Thumbnail Strip (Mobile only - Desktop has left master list) */}
        <div className="flex md:hidden items-center justify-between gap-1 pt-1">
          {DAYS_OF_WEEK.map((day, idx) => {
            const isSelected = idx === selectedDayIndex;
            const dayData = mealPlan.find((d) => d.dayName === day);
            const recipe = recipes.find((r) => r.id === dayData?.dinnerRecipeId);
            const lunchRec = recipes.find((r) => r.id === dayData?.lunchRecipeId);
            const hasCustomDinner = Boolean(dayData?.customDinner?.trim());
            const hasCustomLunch = Boolean(dayData?.customLunch?.trim());
            const hasLunch = Boolean(lunchRec || hasCustomLunch);
            const hasDinner = Boolean(recipe || hasCustomDinner);

            const isToday = idx === todayIndex;

            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  setSelectedDayIndex(idx);
                  if (viewMode === 'overview') setViewMode('split');
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-1 rounded-2xl transition-all touch-manipulation active:scale-95 group ${
                  isSelected ? 'bg-stone-200/50' : 'hover:bg-stone-100/60'
                }`}
              >
                {/* Day name abbreviation */}
                <div className="flex items-center gap-0.5">
                  <span
                    className={`text-[10px] tracking-tight ${
                      isSelected
                        ? 'font-bold text-[#284235]'
                        : isToday
                        ? 'font-bold text-emerald-800'
                        : 'font-semibold text-stone-500'
                    }`}
                  >
                    {DAY_ABBR[day]}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" title="Idag" />
                  )}
                </div>

                {/* Circular thumbnail with active ring */}
                <div
                  className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200 ${
                    hasDinner
                      ? 'border border-[#EBE7DF] shadow-2xs opacity-90 group-hover:opacity-100'
                      : 'border-2 border-dashed border-stone-300 bg-stone-100/70 text-stone-400 group-hover:border-stone-400'
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#284235] ring-offset-2 ring-offset-[#FCFAF5] shadow-sm'
                      : ''
                  }`}
                >
                  {recipe ? (
                    <img
                      src={recipe.coverImageUrl}
                      alt={recipe.title}
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        el.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : hasCustomDinner ? (
                    <div className="w-full h-full bg-amber-100 flex items-center justify-center text-amber-900" title={dayData?.customDinner}>
                      <Utensils className="w-3.5 h-3.5 text-amber-900" />
                    </div>
                  ) : (
                    <span className="text-xs font-bold leading-none select-none text-stone-400">
                      +
                    </span>
                  )}

                  {/* Tiny badge indicating lunch / matlåda */}
                  {hasLunch && (
                    <div
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 border border-white flex items-center justify-center text-white"
                      title={lunchRec ? `Lunch: ${lunchRec.title}` : `Lunch: ${dayData?.customLunch}`}
                    >
                      <LunchboxIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                {/* Bottom status indicator dot */}
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    hasDinner
                      ? 'bg-emerald-600/70'
                      : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>

      {/* MAIN CONTENT AREA */}
      <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto p-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
        {/* =================================================================== */}
        {/* MODE 1: MASTER-DETAIL SPLIT VIEW (Desktop: Split, Mobile: Story)    */}
        {/* =================================================================== */}
        {viewMode === 'split' && (
          <div className="flex flex-col md:flex-row md:gap-6 lg:gap-8 md:items-start animate-fade-in">
            {/* =============================================================== */}
            {/* LEFT MASTER PANEL: VECKANS DAGAR (Desktop Only)                 */}
            {/* =============================================================== */}
            <div className="hidden md:block w-72 lg:w-80 xl:w-96 shrink-0 sticky top-6 space-y-2.5">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="font-serif font-bold text-base text-stone-900">
                  Veckans menyer
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  {plannedDinnerCount} av 7
                </span>
              </div>

              <div className="space-y-1.5">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const isSelected = idx === selectedDayIndex;
                  const isToday = idx === todayIndex;
                  const dayData = mealPlan.find((d) => d.dayName === day);
                  const recipe = recipes.find((r) => r.id === dayData?.dinnerRecipeId);
                  const lunchRec = recipes.find((r) => r.id === dayData?.lunchRecipeId);
                  const hasCustomDinner = Boolean(dayData?.customDinner?.trim());
                  const hasCustomLunch = Boolean(dayData?.customLunch?.trim());
                  const hasLunch = Boolean(lunchRec || hasCustomLunch);
                  const hasDinner = Boolean(recipe || hasCustomDinner);

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDayIndex(idx)}
                      className={`group w-full p-2.5 rounded-2xl border transition-all text-left flex items-center gap-3 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-white border-[#284235] ring-2 ring-[#284235]/20 shadow-sm'
                          : 'bg-white/80 hover:bg-white border-[#EBE7DF] hover:border-stone-300'
                      }`}
                    >
                      {/* Mini Thumbnail */}
                      <div
                        className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center transition-all ${
                          hasDinner
                            ? 'border border-[#EBE7DF] shadow-2xs'
                            : 'border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400'
                        }`}
                      >
                        {recipe ? (
                          <img
                            src={recipe.coverImageUrl}
                            alt={recipe.title}
                            onError={(e) => {
                              const el = e.currentTarget;
                              el.onerror = null;
                              el.src =
                                'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : hasCustomDinner ? (
                          <div
                            className="w-full h-full bg-amber-100 flex items-center justify-center text-amber-900"
                            title={dayData?.customDinner}
                          >
                            <Utensils className="w-4 h-4 text-amber-800" />
                          </div>
                        ) : (
                          <span className="text-base font-bold text-stone-300 group-hover:text-stone-400">
                            +
                          </span>
                        )}

                        {hasLunch && (
                          <div
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 border border-white flex items-center justify-center text-white"
                            title={lunchRec ? `Lunch: ${lunchRec.title}` : `Lunch: ${dayData?.customLunch}`}
                          >
                            <LunchboxIcon className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Day Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`font-serif font-bold text-xs tracking-tight ${
                              isSelected ? 'text-[#284235]' : 'text-stone-900'
                            }`}
                          >
                            {day}
                          </span>
                          {isToday && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                              Idag
                            </span>
                          )}
                        </div>

                        <div
                          className={`text-xs font-semibold truncate ${
                            recipe || hasCustomDinner ? 'text-stone-800' : 'text-stone-400 italic'
                          }`}
                        >
                          {recipe ? recipe.title : hasCustomDinner ? dayData?.customDinner : 'Ingen middag planerad'}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mt-0.5">
                          {recipe ? (
                            <>
                              <span>
                                {formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                              </span>
                              <span>•</span>
                              <span>{dayData?.dinnerServings || 4} port</span>
                            </>
                          ) : hasCustomDinner ? (
                            <span>{dayData?.dinnerServings || 4} port</span>
                          ) : (
                            <span className="text-emerald-800 font-medium">+ Välj middag</span>
                          )}

                          {hasLunch && (
                            <>
                              <span>•</span>
                              <span className="text-amber-700 font-medium inline-flex items-center gap-0.5">
                                <LunchboxIcon className="w-2.5 h-2.5 shrink-0" />
                                <span>Matlåda</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Chevron Indicator */}
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected
                            ? 'text-[#284235] translate-x-0.5'
                            : 'text-stone-300 group-hover:text-stone-400'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* =============================================================== */}
            {/* RIGHT DETAIL PANEL: VALD DAG (Mobile & Desktop)                 */}
            {/* =============================================================== */}
            <div className="w-full flex-1 min-w-0 max-w-xl mx-auto md:max-w-none space-y-4">
            {/* Day Bar with Navigation Arrows */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-2xl font-bold text-stone-900 leading-none">
                  {activeDayName}
                </h2>
              </div>

              {/* Prev / Next day switcher */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : 6))}
                  className="w-9 h-9 rounded-full bg-white border border-[#EBE7DF] text-stone-700 font-bold flex items-center justify-center hover:bg-stone-50 active:scale-90 touch-manipulation shadow-xs transition-all"
                  aria-label="Föregående dag"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : 0))}
                  className="w-9 h-9 rounded-full bg-white border border-[#EBE7DF] text-stone-700 font-bold flex items-center justify-center hover:bg-stone-50 active:scale-90 touch-manipulation shadow-xs transition-all"
                  aria-label="Nästa dag"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ===================== DINNER HERO CARD ===================== */}
            <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-md overflow-hidden transition-all">
              {dinnerRecipe ? (
                <div>
                  {/* Hero Cover Image Banner */}
                  <div
                    onClick={() => openRecipeDetail(dinnerRecipe)}
                    className="relative aspect-16/10 rounded-t-3xl overflow-hidden bg-stone-900 cursor-pointer group touch-manipulation"
                  >
                    <img
                      src={dinnerRecipe.coverImageUrl}
                      alt={dinnerRecipe.title}
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        el.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 via-45% to-black/20" />

                    {/* Top Floating Badges & Action Buttons */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white z-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-white/95 text-stone-900 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                          Middag
                        </span>
                        <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/20 shadow-xs">
                          {dinnerRecipe.category}
                        </span>
                      </div>

                      {/* Top Action Buttons (Randomize & Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRandomPickForDay(activeDayName, 'dinner');
                          }}
                          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 flex items-center justify-center active:scale-90 transition-all touch-manipulation"
                          title="Slumpa annan middag för denna dag"
                        >
                          <Dices className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearMeal(activeDayName, 'dinner');
                          }}
                          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-rose-600/90 flex items-center justify-center active:scale-90 transition-all touch-manipulation"
                          title="Ta bort middag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Info on Hero Image */}
                    <div className="absolute bottom-3.5 left-3.5 right-3.5 text-white">
                      <div className="flex items-center gap-2 text-xs text-stone-200 mb-1 font-medium drop-shadow-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-300" />
                          <span>
                            {formatCookingTime(
                              dinnerRecipe.prepTimeMinutes,
                              dinnerRecipe.cookTimeMinutes
                            )}
                          </span>
                        </span>
                        {dinnerRecipe.rating > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-300">
                              <Star className="w-3.5 h-3.5 fill-amber-300" />
                              <span>{dinnerRecipe.rating}</span>
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-serif font-bold text-xl leading-snug drop-shadow-md text-white">
                        {dinnerRecipe.title}
                      </h3>
                    </div>
                  </div>

                  {/* Interactive Controls below Dinner Banner */}
                  <div className="p-3.5 space-y-2.5 bg-white">
                    {/* Servings Stepper & Change Recipe Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 py-1.5">
                        <span className="text-xs font-semibold text-stone-700">Portioner:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setMealPlanServings(
                                activeDayName,
                                'dinner',
                                Math.max(1, (activeDayData.dinnerServings || 4) - 1)
                              )
                            }
                            className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation shadow-2xs"
                            aria-label="Minska portioner"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold text-sm w-5 text-center tabular-nums text-stone-900">
                            {activeDayData.dinnerServings || 4}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMealPlanServings(
                                activeDayName,
                                'dinner',
                                (activeDayData.dinnerServings || 4) + 1
                              )
                            }
                            className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation shadow-2xs"
                            aria-label="Öka portioner"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openPickerModal(activeDayName, 'dinner')}
                        className="py-2 px-3 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] text-xs font-bold text-[#284235] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Byt rätt</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeDayData.customDinner?.trim() ? (
                /* Custom Dinner Card */
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="bg-amber-50 text-amber-900 border border-amber-200/80 text-xs font-bold px-3 py-1 rounded-full shadow-2xs">
                      Middag (Egen måltid)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleClearMeal(activeDayName, 'dinner')}
                        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-rose-50 text-stone-400 hover:text-rose-600 flex items-center justify-center active:scale-90 transition-all touch-manipulation"
                        title="Ta bort middag"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="py-2">
                    <h3 className="font-serif font-bold text-2xl text-stone-900">
                      {activeDayData.customDinner}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Egen notering / middag
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EBE7DF]">
                    <div className="flex items-center gap-2 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 py-1.5">
                      <span className="text-xs font-semibold text-stone-700">Portioner:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setMealPlanServings(
                              activeDayName,
                              'dinner',
                              Math.max(1, (activeDayData.dinnerServings || 4) - 1)
                            )
                          }
                          className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation shadow-2xs"
                          aria-label="Minska portioner"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-sm w-5 text-center tabular-nums text-stone-900">
                          {activeDayData.dinnerServings || 4}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setMealPlanServings(
                              activeDayName,
                              'dinner',
                              (activeDayData.dinnerServings || 4) + 1
                            )
                          }
                          className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation shadow-2xs"
                          aria-label="Öka portioner"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPickerModal(activeDayName, 'dinner')}
                      className="py-2 px-3.5 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] text-xs font-bold text-[#284235] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Ändra</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty state for Dinner */
                <div className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FCFAF5] border-2 border-dashed border-stone-300 flex items-center justify-center text-stone-400">
                    <Utensils className="w-6 h-6 text-stone-400" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-stone-900">
                      Ingen middag planerad
                    </h3>
                    <p className="text-xs text-stone-500 max-w-xs mx-auto mt-0.5">
                      Välj ett recept från din samling, skriv en egen måltid eller slumpa fram kvällens middag.
                    </p>
                  </div>

                  <div className="flex gap-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => openPickerModal(activeDayName, 'dinner')}
                      className="flex-1 py-3 px-3 rounded-2xl bg-[#284235] hover:bg-black active:scale-95 text-white font-bold text-xs flex items-center justify-center transition-all shadow-xs touch-manipulation min-h-[46px]"
                    >
                      Planera middag
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRandomPickForDay(activeDayName, 'dinner')}
                      className="py-3 px-3.5 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] active:scale-95 text-stone-700 font-semibold text-xs flex items-center justify-center transition-all touch-manipulation min-h-[46px]"
                      title="Slumpa middag för denna dag"
                    >
                      Slumpa
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Ingredients Quick-List (Widescreen Master-Detail Bonus) */}
            {dinnerRecipe && dinnerRecipe.ingredients && dinnerRecipe.ingredients.length > 0 && (
              <div className="hidden md:block bg-white rounded-3xl border border-[#EBE7DF] p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#EBE7DF]">
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-emerald-800" />
                    <h4 className="font-serif font-bold text-sm text-stone-900">
                      Ingredienser för {activeDayData.dinnerServings || 4} portioner
                    </h4>
                    <span className="text-[11px] text-stone-400">
                      ({dinnerRecipe.ingredients.length} st)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openRecipeDetail(dinnerRecipe)}
                    className="text-xs font-bold text-[#284235] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Öppna recept</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {dinnerRecipe.ingredients.map((ing, i) => {
                    const scaledAmount = scaleIngredientAmount(
                      ing.amount,
                      dinnerRecipe.servings,
                      activeDayData.dinnerServings || 4
                    );
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-xs text-stone-700 bg-[#FCFAF5] border border-[#EBE7DF]/80 rounded-xl px-2.5 py-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                        <span className="font-bold text-stone-900 shrink-0">
                          {formatAmount(scaledAmount)} {ing.unit}
                        </span>
                        <span className="truncate text-stone-600">{ing.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===================== LUNCH SECTION (COMPACT & SLEEK) ===================== */}
            <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-xs p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-stone-900 font-bold text-xs">
                  Lunch / Matlåda
                </div>

                {(lunchRecipe || activeDayData.customLunch?.trim()) && (
                  <button
                    type="button"
                    onClick={() => handleClearMeal(activeDayName, 'lunch')}
                    className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-rose-600 transition-colors touch-manipulation"
                    title="Ta bort lunch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {lunchRecipe ? (
                <div className="flex items-center justify-between gap-3 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-2.5">
                  <div
                    onClick={() => openRecipeDetail(lunchRecipe)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group touch-manipulation"
                  >
                    <img
                      src={lunchRecipe.coverImageUrl}
                      alt={lunchRecipe.title}
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        el.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
                      }}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
                    />
                    <div className="min-w-0 flex-1">
                      {activeDayData.customLunch && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded inline-block mb-0.5">
                          {activeDayData.customLunch}
                        </span>
                      )}
                      <h4 className="font-serif font-bold text-sm text-stone-900 truncate group-hover:text-emerald-900 transition-colors">
                        {lunchRecipe.title}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        {lunchRecipe.category}
                      </p>
                    </div>
                  </div>

                  {/* Servings Stepper & Change Recipe Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openPickerModal(activeDayName, 'lunch')}
                      className="p-1.5 rounded-xl bg-white border border-[#EBE7DF] text-stone-600 hover:text-stone-900 transition-colors"
                      title="Byt lunch"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMealPlanServings(
                            activeDayName,
                            'lunch',
                            Math.max(1, (activeDayData.lunchServings || 1) - 1)
                          )
                        }
                        className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs w-4 text-center tabular-nums">
                        {activeDayData.lunchServings || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMealPlanServings(
                            activeDayName,
                            'lunch',
                            (activeDayData.lunchServings || 1) + 1
                          )
                        }
                        className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeDayData.customLunch?.trim() ? (
                <div className="flex items-center justify-between gap-3 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-2.5">
                  <div
                    onClick={() => openPickerModal(activeDayName, 'lunch')}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group touch-manipulation"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 shadow-2xs">
                      <LunchboxIcon className="w-5 h-5 text-amber-800" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded inline-block mb-0.5">
                        Egen måltid
                      </span>
                      <h4 className="font-serif font-bold text-sm text-stone-900 truncate">
                        {activeDayData.customLunch}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Klicka för att ändra
                      </p>
                    </div>
                  </div>

                  {/* Servings Stepper & Change Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openPickerModal(activeDayName, 'lunch')}
                      className="p-1.5 rounded-xl bg-white border border-[#EBE7DF] text-stone-600 hover:text-stone-900 transition-colors"
                      title="Ändra lunch"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMealPlanServings(
                            activeDayName,
                            'lunch',
                            Math.max(1, (activeDayData.lunchServings || 1) - 1)
                          )
                        }
                        className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-xs w-4 text-center tabular-nums">
                        {activeDayData.lunchServings || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMealPlanServings(
                            activeDayName,
                            'lunch',
                            (activeDayData.lunchServings || 1) + 1
                          )
                        }
                        className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center font-bold text-stone-700 active:scale-90 touch-manipulation"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openPickerModal(activeDayName, 'lunch')}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-dashed border-stone-300 text-stone-600 font-semibold text-xs flex items-center justify-center transition-all touch-manipulation min-h-[40px]"
                  >
                    Lägg till lunch
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRandomPickForDay(activeDayName, 'lunch')}
                    className="py-2.5 px-3.5 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] text-stone-600 font-semibold text-xs flex items-center justify-center transition-all touch-manipulation min-h-[40px]"
                    title="Slumpa lunch"
                  >
                    Slumpa
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* =================================================================== */}
        {/* MODE 2: OVERVIEW MATRIX (ALL 7 DAYS IN BEAUTIFUL COMPACT ROWS)     */}
        {/* =================================================================== */}
        {viewMode === 'overview' && (
          <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 md:gap-3.5 animate-fade-in">
            {DAYS_OF_WEEK.map((day, idx) => {
              const dayData = mealPlan.find((d) => d.dayName === day);
              const dRecipe = recipes.find((r) => r.id === dayData?.dinnerRecipeId);
              const lRecipe = recipes.find((r) => r.id === dayData?.lunchRecipeId);
              const hasCustomDinner = Boolean(dayData?.customDinner?.trim());
              const hasCustomLunch = Boolean(dayData?.customLunch?.trim());

              return (
                <div
                  key={day}
                  onClick={() => {
                    setSelectedDayIndex(idx);
                    setViewMode('split');
                  }}
                  className="bg-white rounded-2xl border border-[#EBE7DF] p-3 flex items-center gap-3 shadow-xs cursor-pointer hover:border-emerald-700/50 transition-all touch-manipulation"
                >
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-[#EBE7DF]">
                    {dRecipe ? (
                      <img
                        src={dRecipe.coverImageUrl}
                        alt={dRecipe.title}
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.onerror = null;
                          el.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : hasCustomDinner ? (
                      <div className="w-full h-full bg-amber-100 flex items-center justify-center text-amber-900" title={dayData?.customDinner}>
                        <Utensils className="w-5 h-5 text-amber-800" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400 font-bold text-lg">
                        +
                      </div>
                    )}
                  </div>

                  {/* Day and Recipe details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-serif font-bold text-sm text-stone-900">
                        {day}
                      </span>
                    </div>

                    <div className="font-medium text-xs text-stone-800 truncate">
                      {dRecipe ? dRecipe.title : hasCustomDinner ? dayData?.customDinner : 'Ingen middag planerad'}
                    </div>

                    <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                      {dRecipe ? (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            {formatCookingTime(dRecipe.prepTimeMinutes, dRecipe.cookTimeMinutes)}
                          </span>
                          <span>•</span>
                          <span>{dayData?.dinnerServings || 4} port</span>
                        </>
                      ) : hasCustomDinner ? (
                        <>
                          <span className="text-amber-800 font-medium">Egen middag</span>
                          <span>•</span>
                          <span>{dayData?.dinnerServings || 4} port</span>
                        </>
                      ) : (
                        <span className="text-emerald-800 font-semibold">+ Klicka för att välja</span>
                      )}

                      {(lRecipe || hasCustomLunch) && (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                            <LunchboxIcon className="w-3 h-3 text-amber-700 shrink-0" />
                            Lunch: {lRecipe ? lRecipe.title : dayData?.customLunch}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-stone-300 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FLOATING PRIMARY BUTTON: SKAPA INKÖPSLISTA (Mobile only) */}
      <div
        className="fixed bottom-24 pointer-events-none z-20 flex justify-center md:hidden"
        style={{
          bottom: 'calc(max(1.25rem, env(safe-area-inset-bottom, 0px)) + 4.65rem)',
          left: containerBounds ? `${containerBounds.left}px` : '50%',
          width: containerBounds ? `${containerBounds.width}px` : '100%',
          maxWidth: '28rem',
          transform: containerBounds ? undefined : 'translateX(-50%)',
        }}
      >
        <div className="w-full max-w-md mx-auto px-4">
          <button
            type="button"
            onClick={() => {
              if (totalPlannedMeals === 0) {
                setGeneratedToast('Planera in minst en måltid i veckan först');
                setTimeout(() => setGeneratedToast(null), 2500);
                return;
              }
              setShowGenerateModal(true);
            }}
            className="w-full min-h-[58px] py-4 px-5 rounded-2xl bg-[#284235] hover:bg-stone-900 active:scale-[0.98] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl shadow-emerald-950/45 transition-all touch-manipulation pointer-events-auto border border-emerald-500/30"
          >
            <ShoppingCart className="w-5 h-5 text-emerald-300 shrink-0" />
            <span>Skapa inköpslista från veckan</span>
            {totalPlannedMeals > 0 && (
              <span className="bg-emerald-900/90 text-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-600/40">
                {totalPlannedMeals}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* RECIPE PICKER MODAL (WITH CATEGORIES & SEARCH & CUSTOM MEAL TAB)   */}
      {/* =================================================================== */}
      {pickerState && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 space-y-3.5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Välj {pickerState.mealType === 'dinner' ? 'middag' : 'lunch'}
                </h3>
                <p className="text-xs text-stone-500">
                  Till {pickerState.dayName}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPickerState(null)}
                className="w-9 h-9 rounded-full bg-[#FCFAF5] flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher: Recept ur samlingen / Egen måltid */}
            <div className="flex rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF] p-1 shrink-0">
              <button
                type="button"
                onClick={() => setPickerTab('recipe')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  pickerTab === 'recipe'
                    ? 'bg-[#284235] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Recept ur samlingen
              </button>
              <button
                type="button"
                onClick={() => setPickerTab('custom')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  pickerTab === 'custom'
                    ? 'bg-[#284235] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Egen måltid
              </button>
            </div>

            {pickerTab === 'recipe' ? (
              <>
                {/* Search filter input */}
                <input
                  type="text"
                  value={recipeSearchQuery}
                  onChange={(e) => setRecipeSearchQuery(e.target.value)}
                  placeholder="Sök recept, kategori, ingrediens..."
                  className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] shrink-0"
                  autoFocus
                />

                {/* Category Filter Pills */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPickerCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                      pickerCategoryFilter === 'all'
                        ? 'bg-[#284235] text-white shadow-2xs'
                        : 'bg-[#FCFAF5] text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Alla ({recipes.length})
                  </button>
                  {pickerCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPickerCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
                        pickerCategoryFilter === cat
                          ? 'bg-[#284235] text-white shadow-2xs'
                          : 'bg-[#FCFAF5] text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Scrollable recipe list */}
                <div className="overflow-y-auto space-y-2 flex-1 divide-y divide-stone-100 pr-1">
                  {filteredPickerRecipes.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 text-xs">
                      Inga recept matchar din sökning
                    </div>
                  ) : (
                    filteredPickerRecipes.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => handleSelectRecipe(r.id)}
                        className="pt-2 pb-1 flex items-center justify-between cursor-pointer hover:bg-stone-50 rounded-2xl p-2 transition-colors touch-manipulation"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={r.coverImageUrl}
                            alt={r.title}
                            onError={(e) => {
                              const el = e.currentTarget;
                              el.onerror = null;
                              el.src = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80';
                            }}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-2xs"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-serif font-bold text-sm text-stone-900 truncate">
                              {r.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-stone-400">
                              <span>{r.category}</span>
                              <span>•</span>
                              <span>{formatCookingTime(r.prepTimeMinutes, r.cookTimeMinutes)}</span>
                              {r.rating > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5 text-amber-500">
                                    <Star className="w-3 h-3 fill-amber-500" />
                                    <span>{r.rating}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              /* Custom Meal Tab */
              <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Vad ska ni äta till {pickerState.mealType === 'dinner' ? 'middag' : 'lunch'}?
                  </label>
                  <input
                    type="text"
                    value={customMealInput}
                    onChange={(e) => setCustomMealInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCustomMeal();
                      }
                    }}
                    placeholder="T.ex. Rester från igår, Äta ute, Pizza..."
                    className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                    autoFocus
                  />
                </div>

                {/* Quick suggestion chips */}
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 mb-2">
                    Snabbval:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Rester', 'Äta ute', 'Hämtmat', 'Bortbjudna', 'Mackor & te', 'Enkel sallad', 'Pannkakor', 'Grillat'].map(
                      (suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setCustomMealInput(suggestion)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                            customMealInput.trim().toLowerCase() === suggestion.toLowerCase()
                              ? 'bg-[#284235] text-white border-[#284235] shadow-2xs'
                              : 'bg-[#FCFAF5] hover:bg-stone-100 text-stone-700 border-[#EBE7DF]'
                          }`}
                        >
                          {suggestion}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleSaveCustomMeal}
                    disabled={!customMealInput.trim()}
                    className="w-full py-3 px-4 rounded-2xl bg-[#284235] hover:bg-black text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs touch-manipulation min-h-[46px]"
                  >
                    Spara måltid
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* GENERATE SHOPPING LIST MODAL                                        */}
      {/* =================================================================== */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Skapa inköpslista
              </h3>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="w-9 h-9 rounded-full bg-[#FCFAF5] flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Appen räknar ihop alla ingredienser från veckans planerade rätter och sorterar dem efter butiksavdelning i din inköpslista.
            </p>

            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF] text-xs font-semibold text-stone-800 cursor-pointer touch-manipulation">
              <input
                type="checkbox"
                checked={skipPantryStaples}
                onChange={(e) => setSkipPantryStaples(e.target.checked)}
                className="w-4 h-4 rounded text-[#284235] focus:ring-0 accent-[#284235]"
              />
              <span>Hoppa över basvaror (salt, olja, smör etc.)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 py-3 px-3 rounded-2xl bg-stone-100 text-stone-700 font-semibold text-xs touch-manipulation min-h-[46px]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerateShoppingList}
                className="flex-1 py-3 px-3 rounded-2xl bg-[#284235] hover:bg-black text-white font-bold text-xs touch-manipulation min-h-[46px] shadow-sm"
              >
                Skapa lista ({totalPlannedMeals} måltider)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CLEAR WEEK CONFIRMATION MODAL                                       */}
      {/* =================================================================== */}
      {showClearWeekModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-5 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Rensa veckomenyn?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Är du säker på att du vill ta bort alla planerade luncher och middagar för den här veckan?
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearWeekModal(false)}
                className="flex-1 py-3 px-3 rounded-2xl bg-stone-100 text-stone-700 font-semibold text-xs touch-manipulation min-h-[46px]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleConfirmClearWeek}
                className="flex-1 py-3 px-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs touch-manipulation min-h-[46px] shadow-sm"
              >
                Ja, rensa vecka
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
