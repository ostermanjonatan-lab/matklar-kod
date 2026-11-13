import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FadeImage } from '../layout/FadeImage';
import { CustomMealImage } from './CustomMealImage';
import { MonthView } from './MonthView';
import { categoryLabel } from '../../data/categories';
import { Toast } from '../layout/Toast';
import { ConfirmSheet } from '../layout/ConfirmSheet';
import { flushSync } from 'react-dom';
import type { MealPlanDay } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { mealsInShoppingList, plannedMealKey } from '../../utils/shoppingAggregator';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { useStoredState } from '../../hooks/useStoredState';
import {
  Plus,
  Trash2,
  Dices,
  Minus,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
  Utensils,
  X,
  ChefHat,
  Users,
  CookingPot,
} from 'lucide-react';
import { LunchboxIcon } from '../icons/LunchboxIcon';
import { DinnerBrowser } from '../recipes/DinnerBrowser';
import { leftoverLunchText, leftoverSourceDate, parseLeftoverLunch } from '../../utils/leftovers';
import { RandomPickerModal } from '../recipes/RandomPickerModal';
import { formatCookingTime, scaleIngredientAmount, formatAmount, formatRecipeTitle } from '../../utils/formatters';
import {
  addDaysISO,
  dayNameForDate,
  formatDayMonth,
  formatWeekRange,
  getISOWeekNumber,
  getWeekDates,
  getWeekStart,
  addMonths,
  formatMonth,
  monthStartOf,
} from '../../utils/mealPlanDates';

const DAYS_OF_WEEK: MealPlanDay['dayName'][] = [
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
  'Söndag',
];

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
    planWeekStart,
    setPlanWeekStart,
    getMealPlanForDate,
    today,
    shoppingList,
  } = useRecipes();

  const thisWeekStart = getWeekStart();
  const isThisWeek = planWeekStart === thisWeekStart;
  const weekDates = useMemo(() => getWeekDates(planWeekStart), [planWeekStart]);
  const weekNumber = getISOWeekNumber(planWeekStart);
  // Index of today in the week shown, or -1 when another week is shown
  const todayIndex = weekDates.indexOf(today);

  // Previous or next day. Past Sunday it continues into next week, before Monday into last week.
  const stepDay = (delta: number) => {
    const next = selectedDayIndex + delta;
    if (next < 0) {
      setPlanWeekStart(addDaysISO(planWeekStart, -7));
      setSelectedDayIndex(6);
    } else if (next > 6) {
      setPlanWeekStart(addDaysISO(planWeekStart, 7));
      setSelectedDayIndex(0);
    } else {
      setSelectedDayIndex(next);
    }
  };

  // ---- Sliding between days ----
  // While swiping, the day follows the finger. Past the threshold it slides out and the next
  // day slides in from the other side, otherwise it springs back. The arrows use the same slide.
  // Styles are set directly on the elements so that the big view does not re-render on every move.
  const slideTitleRef = useRef<HTMLDivElement>(null);
  const slideContentRef = useRef<HTMLDivElement>(null);
  const slidingRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number } | null>(null);

  const SLIDE_MS = 200;
  const SLIDE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const setSlide = (x: string, opacity: number, animate: boolean) => {
    [slideTitleRef.current, slideContentRef.current].forEach((el) => {
      if (!el) return;
      el.style.transition = animate ? `transform ${SLIDE_MS}ms ${SLIDE_EASE}, opacity ${SLIDE_MS}ms ${SLIDE_EASE}` : 'none';
      el.style.transform = x === '0' ? '' : `translateX(${x})`;
      el.style.opacity = opacity === 1 ? '' : String(opacity);
    });
  };

  // Slides the current day out, changes day and slides the new one in
  const slideToDay = (delta: number) => {
    if (slidingRef.current) return;
    if (prefersReducedMotion() || !slideContentRef.current) {
      setSlide('0', 1, false);
      stepDay(delta);
      return;
    }
    slidingRef.current = true;
    const out = delta > 0 ? '-100%' : '100%';
    const enter = delta > 0 ? '40%' : '-40%';
    setSlide(out, 0, true);
    window.setTimeout(() => {
      flushSync(() => stepDay(delta));
      setSlide(enter, 0, false);
      // Read layout so the start position is applied before animating to the middle
      void slideContentRef.current?.offsetWidth;
      setSlide('0', 1, true);
      window.setTimeout(() => {
        setSlide('0', 1, false);
        slidingRef.current = false;
      }, SLIDE_MS);
    }, SLIDE_MS * 0.8);
  };

  const handleSwipeStart = (e: React.TouchEvent) => {
    if (slidingRef.current) return;
    const t = e.touches[0];
    dragRef.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: 0 };
  };

  const handleSwipeMove = (e: React.TouchEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.x;
    const dy = t.clientY - drag.y;
    if (!drag.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (drag.axis !== 'x') return;
    drag.dx = dx;
    if (!prefersReducedMotion()) {
      setSlide(`${dx}px`, 1 - Math.min(Math.abs(dx) / 500, 0.35), false);
    }
  };

  const handleSwipeEnd = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.axis !== 'x') return;
    const elapsed = Math.max(Date.now() - drag.t, 1);
    const fast = Math.abs(drag.dx) / elapsed > 0.5 && Math.abs(drag.dx) > 30;
    if (Math.abs(drag.dx) > 70 || fast) {
      slideToDay(drag.dx < 0 ? 1 : -1);
    } else {
      setSlide('0', 1, true);
    }
  };

  // Leftovers: dinners from the three days before a date, to choose as lunch
  const leftoverChoices = (lunchDate: string) => {
    const choices: { date: string; title: string }[] = [];
    for (let back = 1; back <= 3; back++) {
      const date = addDaysISO(lunchDate, -back);
      const day = getMealPlanForDate(date);
      if (!day) continue;
      const recipe = day.dinnerRecipeId ? recipes.find((r) => r.id === day.dinnerRecipeId) : undefined;
      const title = recipe ? formatRecipeTitle(recipe.title) : day.customDinner?.trim();
      if (title && !/^rester/i.test(title)) choices.push({ date, title });
    }
    return choices;
  };

  // Lunches in the coming days made from the dinner on this date
  const leftoverLunchesFrom = (dinnerDate: string) => {
    const result: { date: string; servings: number }[] = [];
    for (let ahead = 1; ahead <= 6; ahead++) {
      const date = addDaysISO(dinnerDate, ahead);
      const day = getMealPlanForDate(date);
      if (day && leftoverSourceDate(date, day.customLunch) === dinnerDate) {
        result.push({ date, servings: day.lunchServings || 2 });
      }
    }
    return result;
  };

  const goToWeek = (weekStart: string) => {
    setPlanWeekStart(weekStart);
    const idx = getWeekDates(weekStart).indexOf(today);
    setSelectedDayIndex(idx === -1 ? 0 : idx);
  };

  // State: selected day index (0 = Måndag, 6 = Söndag), defaults to today's weekday
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return (new Date().getDay() + 6) % 7;
  });

  // Opened again on a new day: show today
  const shownTodayRef = useRef(today);
  useEffect(() => {
    if (shownTodayRef.current === today) return;
    shownTodayRef.current = today;
    setSelectedDayIndex((new Date().getDay() + 6) % 7);
  }, [today]);

  // View Mode: 'split' (Master-Detail Split View on desktop / Story Card on mobile) vs 'overview' (compact list)
  // Day or week, remembered on this phone
  const [viewMode, setViewMode] = useStoredState<'split' | 'overview' | 'month'>(
    'matklar_plan_view',
    'split',
    (v) => v === 'split' || v === 'overview' || v === 'month'
  );
  // The month shown in the month view, starting with the month of the week shown
  // The month in the header (the one at the top of the screen), and the month to scroll to
  const [monthStart, setMonthStart] = useState<string>(() => monthStartOf(planWeekStart));
  const [monthTarget, setMonthTarget] = useState(() => ({ month: monthStartOf(planWeekStart), key: 0 }));
  const goToMonth = (month: string) => {
    setMonthStart(month);
    setMonthTarget((t) => ({ month, key: t.key + 1 }));
  };
  const isThisMonth = monthStart === monthStartOf(today);
  // A day in the month opens in the day view
  const openDayFromMonth = (date: string) => {
    setPlanWeekStart(getWeekStart(date));
    setSelectedDayIndex(getWeekDates(getWeekStart(date)).indexOf(date));
    setViewMode('split');
    // The day starts at the top, not where the month list was scrolled to
    window.scrollTo({ top: 0 });
  };

  // Recipe Picker modal
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    dayName: MealPlanDay['dayName'];
    mealType: 'lunch' | 'dinner';
  } | null>(null);

  const [pickerTab, setPickerTab] = useState<'recipe' | 'custom'>('recipe');
  const [customMealInput, setCustomMealInput] = useState<string>('');

  // Clear week modal
  const [showClearWeekModal, setShowClearWeekModal] = useState<boolean>(false);

  // Generate shopping list modal
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [skipPantryStaples, setSkipPantryStaples] = useStoredState<boolean>('matklar_plan_skip_staples', true);
  const [generatedToast, setGeneratedToast] = useState<string | null>(null);

  // Synchronize meal plan modals with Android back button
  useModalBackHandler(!!pickerState?.isOpen, () => setPickerState(null), 'meal-picker');
  useModalBackHandler(showGenerateModal, () => setShowGenerateModal(false), 'generate-shopping');
  useModalBackHandler(showClearWeekModal, () => setShowClearWeekModal(false), 'clear-week');

  // Slumpa: the rolling animation, with Slumpa igen and no repeats until all have been shown
  const [randomFor, setRandomFor] = useState<{ dayName: MealPlanDay['dayName']; mealType: 'lunch' | 'dinner' } | null>(null);
  useModalBackHandler(Boolean(randomFor), () => setRandomFor(null), 'meal-random');

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

  // Meals whose ingredients are already in the shopping list. They stay in the plan, marked
  // as added, and are not added again.
  const inShoppingList = useMemo(() => mealsInShoppingList(shoppingList), [shoppingList]);
  const isInList = (day: MealPlanDay['dayName'], meal: 'dinner' | 'lunch', recipeId?: string | null) => {
    const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;
    return Boolean(recipe && inShoppingList.has(plannedMealKey(recipe.title, day, meal)));
  };

  // The shopping list is only made for today and later: earlier days are already eaten
  const upcomingDays = mealPlan.filter((d) => !d.dateStr || d.dateStr >= today);
  const upcomingDinnerCount = upcomingDays.filter(
    (d) => d.dinnerRecipeId && recipes.some((r) => r.id === d.dinnerRecipeId) && !isInList(d.dayName, 'dinner', d.dinnerRecipeId)
  ).length;
  const upcomingLunchCount = upcomingDays.filter(
    (d) => d.lunchRecipeId && recipes.some((r) => r.id === d.lunchRecipeId) && !isInList(d.dayName, 'lunch', d.lunchRecipeId)
  ).length;
  const alreadyAddedCount = upcomingDays.filter(
    (d) => isInList(d.dayName, 'dinner', d.dinnerRecipeId) || isInList(d.dayName, 'lunch', d.lunchRecipeId)
  ).length;

  // "5 middagar, 1 lunch"
  const plannedSummary = [
    upcomingDinnerCount > 0 ? `${upcomingDinnerCount} ${upcomingDinnerCount === 1 ? 'middag' : 'middagar'}` : '',
    upcomingLunchCount > 0 ? `${upcomingLunchCount} ${upcomingLunchCount === 1 ? 'lunch' : 'luncher'}` : '',
  ].filter(Boolean).join(', ');

  const openGenerate = () => {
    if (upcomingDinnerCount + upcomingLunchCount === 0) {
      setGeneratedToast(
        alreadyAddedCount > 0
          ? 'Veckans måltider finns redan i inköpslistan'
          : totalPlannedMeals > 0
          ? 'Alla planerade måltider i veckan är före i dag'
          : 'Planera in minst en måltid i veckan först'
      );
      setTimeout(() => setGeneratedToast(null), 2500);
      return;
    }
    setShowGenerateModal(true);
  };

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

  // Slumpa veckan: every empty dinner from today on gets a random main course, without repeats
  const [weekToast, setWeekToast] = useState<{ message: string; days: MealPlanDay['dayName'][] } | null>(null);
  const weekToastTimer = useRef<number | undefined>(undefined);
  const showWeekToast = (message: string, days: MealPlanDay['dayName'][] = []) => {
    window.clearTimeout(weekToastTimer.current);
    setWeekToast({ message, days });
    weekToastTimer.current = window.setTimeout(() => setWeekToast(null), days.length ? 6000 : 3000);
  };
  useEffect(() => () => window.clearTimeout(weekToastTimer.current), []);

  const hasDinner = (dayName: MealPlanDay['dayName']) => {
    const d = mealPlan.find((x) => x.dayName === dayName);
    return Boolean((d?.dinnerRecipeId && recipes.some((r) => r.id === d.dinnerRecipeId)) || d?.customDinner?.trim());
  };

  const randomizeWeek = () => {
    if (weekDates[6] < today) {
      showWeekToast(`Vecka ${weekNumber} har redan varit`);
      return;
    }
    const emptyDays = DAYS_OF_WEEK.filter((name, i) => weekDates[i] >= today && !hasDinner(name));
    if (emptyDays.length === 0) {
      showWeekToast('Alla dagar har redan en middag');
      return;
    }
    const mains = recipes.filter((r) => (r.category || '').toLowerCase() === 'middag');
    if (mains.length === 0) {
      showWeekToast('Det finns inga varmrätter att slumpa bland');
      return;
    }
    const shuffle = <T,>(list: T[]) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const planned = new Set(mealPlan.flatMap((d) => [d.dinnerRecipeId, d.lunchRecipeId]).filter(Boolean));
    // Recipes not in the week come first. With few recipes, the rest are used again.
    let pool = shuffle(mains.filter((r) => !planned.has(r.id)));
    for (const day of emptyDays) {
      if (pool.length === 0) pool = shuffle(mains);
      setMealPlanForDay(day, 'dinner', pool.shift()!.id);
    }
    showWeekToast(
      emptyDays.length === 1 ? '1 middag slumpad' : `${emptyDays.length} middagar slumpade`,
      emptyDays
    );
  };

  // The bin on a day in the week view: removes the dinner, with Ångra
  const [removedDinner, setRemovedDinner] = useState<{
    day: MealPlanDay['dayName'];
    recipeId: string | null;
    custom: string;
  } | null>(null);
  const removedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(removedTimer.current), []);
  const removeDinner = (day: MealPlanDay['dayName']) => {
    const d = mealPlan.find((x) => x.dayName === day);
    setRemovedDinner({ day, recipeId: d?.dinnerRecipeId || null, custom: d?.customDinner || '' });
    handleClearMeal(day, 'dinner');
    window.clearTimeout(removedTimer.current);
    removedTimer.current = window.setTimeout(() => setRemovedDinner(null), 5000);
  };
  const undoRemoveDinner = () => {
    if (!removedDinner) return;
    const { day, recipeId, custom } = removedDinner;
    if (recipeId) setMealPlanForDay(day, 'dinner', recipeId);
    else if (custom) setMealPlanForDay(day, 'dinner', null, custom);
    window.clearTimeout(removedTimer.current);
    setRemovedDinner(null);
  };

  // A day tapped in the week view: an empty day opens the dinner picker and stays in the week
  const openDayFromWeek = (idx: number, day: MealPlanDay['dayName'], planned: boolean) => {
    if (!planned) {
      openPickerModal(day, 'dinner');
      return;
    }
    setSelectedDayIndex(idx);
    setViewMode('split');
  };

  const undoRandomWeek = () => {
    weekToast?.days.forEach((day) => setMealPlanForDay(day, 'dinner', null, ''));
    window.clearTimeout(weekToastTimer.current);
    setWeekToast(null);
  };

  const handleConfirmClearWeek = () => {
    clearMealPlan();
    setShowClearWeekModal(false);
    setGeneratedToast(`Vecka ${weekNumber} är tömd`);
    setTimeout(() => setGeneratedToast(null), 2500);
  };

  const handleConfirmGenerateShoppingList = () => {
    generateShoppingListFromWeek(skipPantryStaples);
    setShowGenerateModal(false);
    setGeneratedToast('Veckans ingredienser är tillagda i inköpslistan');
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
    setPickerState({
      isOpen: true,
      dayName,
      mealType,
    });
  };


  return (
    <div className="min-h-screen bg-[#FCFAF5] pb-28 w-full max-w-full overflow-x-clip font-sans">
      {/* Toast Notification */}
      {generatedToast && <Toast message={generatedToast} />}
      {removedDinner && (
        <Toast
          message={`Middagen på ${removedDinner.day.toLowerCase()} är borttagen`}
          actions={[{ label: 'Ångra', onClick: undoRemoveDinner }]}
        />
      )}
      {weekToast && (
        <Toast
          message={weekToast.message}
          actions={weekToast.days.length ? [{ label: 'Ångra', onClick: undoRandomWeek }] : undefined}
        />
      )}

      {/* HEADER & THUMBNAIL STRIP (Sticky top-0 on mobile, static on desktop) */}
      <div className="green-header sticky top-0 md:static z-20 md:z-auto bg-[#284235]/75 backdrop-blur-md backdrop-saturate-150 md:bg-[#FCFAF5]/95 md:backdrop-blur-md md:border-b md:border-[#EBE7DF] px-3.5 md:px-6 pt-3 pb-3 shadow-xs">
        <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto">
          {/* Row 1: Week with arrows, and Day / Week view */}
          <h1 className="sr-only">Planerare</h1>
          <div className="flex items-center justify-between gap-2">
            {viewMode === 'month' ? (
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => goToMonth(addMonths(monthStart, -1))}
                className="w-8 h-9 -ml-1.5 rounded-full flex items-center justify-center text-white/80 md:text-stone-600 active:bg-[#FFFFFF]/15 md:hover:bg-stone-100 md:active:bg-stone-200 touch-manipulation shrink-0"
                aria-label="Förra månaden"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="shrink-0 text-center leading-tight">
                <div className="text-[15px] font-semibold text-white md:text-stone-900 whitespace-nowrap">{formatMonth(monthStart)}</div>
                {!isThisMonth && (
                  <button
                    type="button"
                    onClick={() => goToMonth(monthStartOf(today))}
                    className="text-xs font-semibold text-white/80 md:text-[#284235] whitespace-nowrap touch-manipulation"
                  >
                    Till i dag
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => goToMonth(addMonths(monthStart, 1))}
                className="w-8 h-9 rounded-full flex items-center justify-center text-white/80 md:text-stone-600 active:bg-[#FFFFFF]/15 md:hover:bg-stone-100 md:active:bg-stone-200 touch-manipulation shrink-0"
                aria-label="Nästa månad"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            ) : (
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => goToWeek(addDaysISO(planWeekStart, -7))}
                className="w-8 h-9 -ml-1.5 rounded-full flex items-center justify-center text-white/80 md:text-stone-600 active:bg-[#FFFFFF]/15 md:hover:bg-stone-100 md:active:bg-stone-200 touch-manipulation shrink-0"
                aria-label="Förra veckan"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="shrink-0 text-center leading-tight">
                <div className="text-[15px] font-semibold text-white md:text-stone-900 whitespace-nowrap">
                  Vecka {weekNumber}
                </div>
                <div className={`text-xs text-white/70 md:text-stone-500 whitespace-nowrap ${isThisWeek ? '' : 'hidden min-[380px]:block'}`}>
                  {formatWeekRange(planWeekStart)}
                </div>
                {!isThisWeek && (
                  <button
                    type="button"
                    onClick={() => goToWeek(thisWeekStart)}
                    className="min-[380px]:hidden text-xs font-semibold text-white whitespace-nowrap touch-manipulation"
                  >
                    Till i dag
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => goToWeek(addDaysISO(planWeekStart, 7))}
                className="w-8 h-9 rounded-full flex items-center justify-center text-white/80 md:text-stone-600 active:bg-[#FFFFFF]/15 md:hover:bg-stone-100 md:active:bg-stone-200 touch-manipulation shrink-0"
                aria-label="Nästa vecka"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            )}

            <div className="flex items-center gap-1.5 shrink-0">
              {viewMode !== 'month' && weekDates[6] >= today && (
                <button
                  type="button"
                  onClick={randomizeWeek}
                  className="hidden md:block px-3 min-h-[38px] text-xs font-semibold text-[#284235] hover:text-stone-900 touch-manipulation"
                >
                  Slumpa veckan
                </button>
              )}
              {/* Desktop Create Shopping List Button */}
              {viewMode !== 'month' && (
              <button
                type="button"
                onClick={openGenerate}
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#284235] hover:bg-black text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer min-h-[38px]"
              >
                <span>Skapa inköpslista</span>
              </button>
              )}

              {viewMode !== 'month' && !isThisWeek && (
                <button
                  type="button"
                  onClick={() => goToWeek(thisWeekStart)}
                  className="hidden min-[380px]:block px-2.5 min-h-[36px] rounded-xl text-xs font-semibold text-[#284235] border border-[#284235]/30 bg-white touch-manipulation whitespace-nowrap"
                >
                  I dag
                </button>
              )}

              {/* Day / Week view */}
              <div className="flex items-center bg-white border border-[#EBE7DF] p-0.5 rounded-xl shadow-xs" role="group" aria-label="Vy">
                {([
                  ['split', 'Dag'],
                  ['overview', 'Vecka'],
                  ['month', 'Månad'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      // The month view opens on the month of the week shown
                      if (mode === 'month' && viewMode !== 'month') goToMonth(monthStartOf(planWeekStart));
                      setViewMode(mode);
                    }}
                    aria-pressed={viewMode === mode}
                    className={`px-2.5 min-[380px]:px-3 rounded-lg text-xs font-semibold transition-all touch-manipulation min-h-[34px] cursor-pointer ${
                      viewMode === mode ? 'bg-[#284235] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
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
                <span className="text-xs text-stone-500">
                  {plannedDinnerCount} av 7 middagar
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
                          <FadeImage src={recipe.coverImageUrl} alt={recipe.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : hasCustomDinner ? (
                          <CustomMealImage name={dayData!.customDinner!.trim()} />
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
                            {day} {formatDayMonth(weekDates[idx])}
                          </span>
                          {isToday && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                              I dag
                            </span>
                          )}
                        </div>

                        <div
                          className={`text-xs font-semibold truncate ${
                            recipe || hasCustomDinner ? 'text-stone-800' : 'text-stone-400 italic'
                          }`}
                        >
                          {recipe ? formatRecipeTitle(recipe.title) : hasCustomDinner ? dayData?.customDinner : 'Ingen middag planerad'}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mt-0.5">
                          {recipe ? (
                            <>
                              <span>
                                {formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}
                              </span>
                              <span>•</span>
                              <span>{dayData?.dinnerServings || 4} portioner</span>
                            </>
                          ) : hasCustomDinner ? (
                            <span>{dayData?.dinnerServings || 4} portioner</span>
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
            <div
              className="w-full flex-1 min-w-0 max-w-xl mx-auto md:max-w-none space-y-4"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
              onTouchCancel={handleSwipeEnd}
              style={{ touchAction: 'pan-y' }}
            >
            {/* Day heading with previous / next day. On the phone you can also swipe. */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => slideToDay(-1)}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 touch-manipulation shrink-0 md:hidden"
                aria-label="Föregående dag"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div ref={slideTitleRef} className="flex-1 min-w-0 text-center md:text-left md:px-1 will-change-transform">
                <h2 className="font-serif text-2xl font-bold text-stone-900 leading-tight truncate">
                  {activeDayName}
                </h2>
                <div className="text-xs text-stone-500">
                  {formatDayMonth(weekDates[selectedDayIndex])}
                  {selectedDayIndex === todayIndex ? ', i dag' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => slideToDay(1)}
                className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 touch-manipulation shrink-0 md:hidden"
                aria-label="Nästa dag"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div ref={slideContentRef} className="space-y-4 will-change-transform">

            {/* ===================== DINNER HERO CARD ===================== */}
            <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-md overflow-hidden transition-all">
              {dinnerRecipe ? (
                <div>
                  {/* Hero Cover Image Banner */}
                  <div
                    onClick={() => openRecipeDetail(dinnerRecipe)}
                    className="relative aspect-16/10 rounded-t-3xl overflow-hidden cursor-pointer group touch-manipulation"
                  >
                    <FadeImage src={dinnerRecipe.coverImageUrl} alt={dinnerRecipe.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 via-45% to-black/20" />

                    {/* Top Floating Badges & Action Buttons */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white z-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-white/95 text-stone-900 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                          {isInList(activeDayName, 'dinner', dinnerRecipe.id) ? 'Middag · i inköpslistan' : 'Middag'}
                        </span>
                        {dinnerRecipe.category && dinnerRecipe.category !== 'Middag' && (
                          <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/20 shadow-xs">
                            {categoryLabel(dinnerRecipe.category)}
                          </span>
                        )}
                      </div>

                      {/* Top Action Buttons (Randomize & Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRandomFor({ dayName: activeDayName, mealType: 'dinner' });
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
                      </div>
                      <h3 className="font-serif font-bold text-xl leading-snug drop-shadow-md text-white">
                        {formatRecipeTitle(dinnerRecipe.title)}
                      </h3>
                    </div>
                  </div>

                  {/* Interactive Controls below Dinner Banner */}
                  <div className="p-3.5 space-y-2.5 bg-white">
                    {(() => {
                      const lunches = leftoverLunchesFrom(weekDates[selectedDayIndex]);
                      if (lunches.length === 0) return null;
                      return (
                        <p className="text-xs text-stone-500 flex items-center gap-1.5 order-last">
                          <LunchboxIcon className="w-3.5 h-3.5 shrink-0" />
                          {lunches
                            .map((l) => `${l.servings} ${l.servings === 1 ? 'portion' : 'portioner'} till lunch ${dayNameForDate(l.date).toLowerCase()}`)
                            .join(', ')}
                          , räknas med i inköpslistan
                        </p>
                      );
                    })()}
                    {/* Servings Stepper & Change Recipe Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-[380px]:gap-2 min-w-0 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl pl-2.5 pr-1.5 min-[380px]:px-3 py-1.5">
                        <Users className="w-4 h-4 text-stone-500 shrink-0 sm:hidden" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only text-xs font-semibold text-stone-700">Portioner</span>
                        <div className="flex items-center gap-1.5 shrink-0">
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
                        className="shrink-0 whitespace-nowrap py-2 px-3 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] text-xs font-bold text-[#284235] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Byt rätt</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : activeDayData.customDinner?.trim() ? (
                /* Own meal: the same shape as a recipe, grey with an icon that fits the meal and its name */
                <div>
                  <div
                    onClick={() => openPickerModal(activeDayName, 'dinner')}
                    className="relative aspect-16/10 rounded-t-3xl overflow-hidden cursor-pointer touch-manipulation"
                  >
                    <CustomMealImage name={activeDayData.customDinner.trim()} />

                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                      <span className="bg-white/95 text-stone-900 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        Middag
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearMeal(activeDayName, 'dinner');
                        }}
                        className="w-8 h-8 rounded-full bg-white text-stone-700 hover:text-rose-600 flex items-center justify-center active:scale-90 transition-all touch-manipulation shadow-xs"
                        title="Ta bort middag"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-[380px]:gap-2 min-w-0 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl pl-2.5 pr-1.5 min-[380px]:px-3 py-1.5">
                      <Users className="w-4 h-4 text-stone-500 shrink-0 sm:hidden" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only text-xs font-semibold text-stone-700">Portioner</span>
                      <div className="flex items-center gap-1.5 shrink-0">
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
                      className="shrink-0 whitespace-nowrap py-2 px-3.5 rounded-2xl bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] text-xs font-bold text-[#284235] flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Ändra</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Empty state for Dinner: the same shape as a chosen dinner, so Slumpa, the button
                   for choosing and everything below stay in the same place */
                <div>
                  <div
                    onClick={() => openPickerModal(activeDayName, 'dinner')}
                    className="relative aspect-16/10 rounded-t-3xl overflow-hidden bg-stone-100 cursor-pointer touch-manipulation"
                  >
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="bg-white text-stone-900 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        Middag
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRandomFor({ dayName: activeDayName, mealType: 'dinner' });
                        }}
                        className="w-8 h-8 rounded-full bg-white text-stone-700 hover:bg-stone-50 flex items-center justify-center active:scale-90 transition-all touch-manipulation shadow-xs"
                        aria-label="Slumpa middag"
                        title="Slumpa middag för denna dag"
                      >
                        <Dices className="w-4 h-4" />
                      </button>
                    </div>
                    {/* A pot in the middle and a short line: nothing chosen yet */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <CookingPot className="w-14 h-14 text-stone-300 stroke-[1.25]" aria-hidden="true" />
                      <span className="text-sm text-stone-500">Ingen middag vald</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-white">
                    <div className="flex items-center justify-end gap-2 min-h-[42px]">
                      <button
                        type="button"
                        onClick={() => openPickerModal(activeDayName, 'dinner')}
                        className="shrink-0 whitespace-nowrap py-2 px-3.5 rounded-2xl bg-[#284235] hover:bg-black text-xs font-bold text-white flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        <span>Välj middag</span>
                      </button>
                    </div>
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

            {/* ===================== LUNCH ===================== */}
            <div className="px-1 space-y-2">
              {/* As high as the bin, so the row does not grow when a lunch is chosen */}
              <div className="flex items-center justify-between min-h-[36px]">
                <div className="text-stone-900 font-semibold text-sm">Lunch</div>

                {(lunchRecipe || activeDayData.customLunch?.trim()) && (
                  <button
                    type="button"
                    onClick={() => handleClearMeal(activeDayName, 'lunch')}
                    className="w-9 h-9 -mr-2 flex items-center justify-center text-stone-400 hover:text-rose-600 transition-colors touch-manipulation"
                    aria-label="Ta bort lunch"
                    title="Ta bort lunch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {lunchRecipe ? (
                <div className="flex items-center justify-between gap-3 py-1 min-h-[64px]">
                  <div
                    onClick={() => openRecipeDetail(lunchRecipe)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group touch-manipulation"
                  >
                    <span className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 block">
                      <FadeImage src={lunchRecipe.coverImageUrl} alt={lunchRecipe.title} className="absolute inset-0 w-full h-full object-cover" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif font-bold text-sm leading-5 text-stone-900 truncate group-hover:text-emerald-900 transition-colors">
                        {formatRecipeTitle(lunchRecipe.title)}
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        {categoryLabel(lunchRecipe.category)}
                        {isInList(activeDayName, 'lunch', lunchRecipe.id) && ' · i inköpslistan'}
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
                <div className="flex items-center justify-between gap-3 py-1 min-h-[64px]">
                  <button
                    type="button"
                    onClick={() => openPickerModal(activeDayName, 'lunch')}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left touch-manipulation"
                  >
                    <span className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 block">
                      {parseLeftoverLunch(activeDayData.customLunch) ? (
                        <span className="absolute inset-0 bg-stone-100 flex items-center justify-center">
                          <LunchboxIcon className="w-5 h-5 text-stone-400" />
                        </span>
                      ) : (
                        <CustomMealImage name={activeDayData.customLunch.trim()} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif font-bold text-base leading-5 text-stone-900 truncate">
                        {parseLeftoverLunch(activeDayData.customLunch)?.title ?? activeDayData.customLunch}
                      </h4>
                      {parseLeftoverLunch(activeDayData.customLunch) && (
                        <p className="text-xs text-stone-500">
                          Rester från middagen i {parseLeftoverLunch(activeDayData.customLunch)!.day}s
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Servings Stepper & Change Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
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
                /* No lunch: the same shape as a chosen lunch, with a lunchbox where the photo goes */
                <div className="flex items-center justify-between gap-3 py-1 min-h-[64px]">
                  <button
                    type="button"
                    onClick={() => openPickerModal(activeDayName, 'lunch')}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left touch-manipulation"
                  >
                    <span className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0" aria-hidden="true">
                      <LunchboxIcon className="w-6 h-6 text-stone-300" />
                    </span>
                    <span className="text-sm text-stone-500">Ingen lunch vald</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPickerModal(activeDayName, 'lunch')}
                    className="shrink-0 whitespace-nowrap py-2 px-3.5 rounded-2xl bg-[#284235] hover:bg-black text-xs font-bold text-white transition-all active:scale-95 touch-manipulation"
                  >
                    Välj lunch
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

        {/* =================================================================== */}
        {/* MODE 2: OVERVIEW MATRIX (ALL 7 DAYS IN BEAUTIFUL COMPACT ROWS)     */}
        {/* =================================================================== */}
        {viewMode === 'month' && (
          <MonthView
            target={monthTarget}
            onVisibleMonth={setMonthStart}
            today={today}
            recipes={recipes}
            getMealPlanForDate={getMealPlanForDate}
            onOpenDay={openDayFromMonth}
          />
        )}

        {viewMode === 'overview' && (
          <div className="divide-y divide-[#EBE7DF] border-b border-[#EBE7DF] md:border-0 md:divide-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 md:gap-3.5 animate-fade-in">
            {DAYS_OF_WEEK.map((day, idx) => {
              const dayData = mealPlan.find((d) => d.dayName === day);
              const dRecipe = recipes.find((r) => r.id === dayData?.dinnerRecipeId);
              const lRecipe = recipes.find((r) => r.id === dayData?.lunchRecipeId);
              const hasCustomDinner = Boolean(dayData?.customDinner?.trim());
              const hasCustomLunch = Boolean(dayData?.customLunch?.trim());
              const isToday = idx === todayIndex;

              const hasDinnerHere = Boolean(dRecipe || hasCustomDinner);
              const hasLunchHere = Boolean(lRecipe || hasCustomLunch);
              return (
                // An empty day opens the dinner picker straight away and stays in the week. A planned
                // day opens the day; lunch can be added and the dinner removed from the row.
                <div
                  key={day}
                  className="flex items-center gap-2 md:bg-white md:rounded-2xl md:border md:border-[#EBE7DF] md:p-3 md:shadow-xs md:hover:border-emerald-700/50 transition-colors"
                >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openDayFromWeek(idx, day, hasDinnerHere)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDayFromWeek(idx, day, hasDinnerHere);
                    }
                  }}
                  className="flex-1 min-w-0 text-left py-3 md:py-0 flex items-center gap-3 cursor-pointer touch-manipulation active:bg-stone-100/60"
                >
                  {/* Thumbnail */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                    {dRecipe ? (
                      <FadeImage src={dRecipe.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : hasCustomDinner ? (
                      <CustomMealImage name={dayData!.customDinner!.trim()} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Day, dinner (one line) and one line with time, portions and lunch, the same
                      height on every day so the line with time and lunch stays in the same place. */}
                  <div className="flex-1 min-w-0 min-h-[52px] flex flex-col justify-start">
                    <div className={`text-xs ${isToday ? 'font-bold text-[#284235]' : 'text-stone-500'}`}>
                      {day} {formatDayMonth(weekDates[idx])}{isToday ? ', i dag' : ''}
                    </div>

                    <div className="h-5">
                      <div className={`text-sm leading-5 truncate ${hasDinnerHere ? 'font-semibold text-stone-900' : 'font-semibold text-[#284235]'}`}>
                        {dRecipe ? formatRecipeTitle(dRecipe.title) : hasCustomDinner ? dayData?.customDinner : 'Välj middag'}
                      </div>
                    </div>

                    {(hasDinnerHere || hasLunchHere) && (
                      <div className="flex items-baseline gap-1 text-xs text-stone-500 whitespace-nowrap min-w-0">
                        {hasDinnerHere && (
                          <span className="shrink-0">
                            {dRecipe ? `${formatCookingTime(dRecipe.prepTimeMinutes, dRecipe.cookTimeMinutes)}, ` : ''}
                            {dayData?.dinnerServings || 4} port
                            {isInList(day, 'dinner', dayData?.dinnerRecipeId) && (
                              <span className="text-[#284235]"> · i listan</span>
                            )}
                          </span>
                        )}
                        {hasDinnerHere && <span aria-hidden="true">·</span>}
                        {hasLunchHere ? (
                          <span className="truncate min-w-0">
                            Lunch: {lRecipe ? formatRecipeTitle(lRecipe.title) : dayData?.customLunch}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPickerModal(day, 'lunch');
                            }}
                            className="font-semibold text-[#284235] hover:text-stone-900 py-2 -my-2 touch-manipulation"
                          >
                            Lägg till lunch
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
                {hasDinnerHere && (
                  <button
                    type="button"
                    onClick={() => removeDinner(day)}
                    className="shrink-0 w-10 h-11 -mr-2 flex items-center justify-center text-stone-400 hover:text-rose-700 touch-manipulation"
                    aria-label={`Ta bort middagen på ${day.toLowerCase()}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                </div>
              );
            })}
          </div>
        )}

        {/* Shopping list from the week, and emptying the week. At the end of the page, not floating.
            They belong to a week, so the month view leaves them out. */}
        {viewMode !== 'month' && (
        <>
        <div className="md:hidden pt-2 space-y-1">
          <button
            type="button"
            onClick={openGenerate}
            className="w-full min-h-[52px] py-3 px-5 rounded-2xl bg-[#284235] hover:bg-stone-900 active:scale-[0.98] text-white flex items-center justify-center gap-2.5 transition-all touch-manipulation"
          >
            <span className="font-semibold text-sm">Skapa inköpslista</span>
            {plannedSummary && <span className="text-xs text-emerald-200/90">{plannedSummary}</span>}
          </button>
        </div>

        <div className="flex justify-center gap-2">
          {weekDates[6] >= today && (
            <button
              type="button"
              onClick={randomizeWeek}
              className="text-xs font-semibold text-[#284235] hover:text-stone-900 py-2 px-3 touch-manipulation min-h-[40px]"
            >
              Slumpa veckan
            </button>
          )}
          {totalPlannedMeals > 0 && (
            <button
              type="button"
              onClick={() => setShowClearWeekModal(true)}
              className="text-xs font-semibold text-stone-500 hover:text-rose-700 py-2 px-3 touch-manipulation min-h-[40px]"
            >
              Töm vecka {weekNumber}
            </button>
          )}
        </div>
        </>
        )}
      </div>

      {/* =================================================================== */}
      {/* RECIPE PICKER MODAL (WITH CATEGORIES & SEARCH & CUSTOM MEAL TAB)   */}
      {/* =================================================================== */}
      {pickerState && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
          <div
            className={`bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-5 space-y-3.5 flex flex-col ${
              pickerTab === 'recipe' ? 'h-[85vh]' : 'max-h-[90vh]'
            }`}
          >
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Välj {pickerState.mealType === 'dinner' ? 'middag' : 'lunch'}
                </h3>
                <p className="text-xs text-stone-500">
                  {pickerState.dayName} {formatDayMonth(weekDates[DAYS_OF_WEEK.indexOf(pickerState.dayName)])}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const target = { dayName: pickerState.dayName, mealType: pickerState.mealType };
                    setPickerState(null);
                    // Open after the picker has closed, so the back button history stays in order
                    setTimeout(() => setRandomFor(target), 120);
                  }}
                  className="px-3 h-9 rounded-xl bg-[#FCFAF5] border border-[#EBE7DF] flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 touch-manipulation"
                >
                  <Dices className="w-4 h-4" />
                  Slumpa
                </button>
                <button
                  type="button"
                  onClick={() => setPickerState(null)}
                  className="w-9 h-9 rounded-full bg-[#FCFAF5] flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors touch-manipulation"
                  aria-label="Stäng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Leftovers from the days before, for lunch */}
            {pickerState.mealType === 'lunch' &&
              (() => {
                const lunchDate = weekDates[DAYS_OF_WEEK.indexOf(pickerState.dayName)];
                const choices = leftoverChoices(lunchDate);
                if (choices.length === 0) return null;
                return (
                  <div className="shrink-0">
                    <div className="text-xs text-stone-500 pb-1">Rester</div>
                    <div className="divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
                      {choices.map((c) => (
                        <button
                          key={c.date}
                          type="button"
                          onClick={() => {
                            setMealPlanForDay(pickerState.dayName, 'lunch', null, leftoverLunchText(c.date, c.title));
                            setPickerState(null);
                          }}
                          className="w-full min-h-[48px] py-2 flex items-center gap-3 text-left touch-manipulation active:bg-stone-100/70"
                        >
                          <LunchboxIcon className="w-4 h-4 text-stone-500 shrink-0" />
                          <span className="flex-1 min-w-0 text-sm text-stone-900 truncate">
                            <span className="text-stone-500">Från {dayNameForDate(c.date).toLowerCase()}: </span>
                            {c.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
              /* Subcategories with slideshows, then recipes (same as Välj middag on the start page) */
              <DinnerBrowser
                recipes={recipes}
                mealLabel={pickerState.mealType === 'dinner' ? 'middag' : 'lunch'}
                currentRecipeId={(() => {
                  const day = mealPlan.find((d) => d.dayName === pickerState.dayName);
                  return pickerState.mealType === 'dinner' ? day?.dinnerRecipeId : day?.lunchRecipeId;
                })()}
                onSelect={(r) => handleSelectRecipe(r.id)}
              />
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
                  />
                </div>

                {/* Quick suggestion chips */}
                <div>
                  <p className="text-[11px] font-semibold text-stone-500 mb-2">
                    Snabbval:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Rester', 'Äta ute', 'Hämtmat', 'Bortbjudna', 'Mackor & te', 'Enkel sallad', 'Grillat'].map(
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

      {/* Slumpa with animation, among the dinner recipes */}
      {randomFor && (
        <RandomPickerModal
          recipes={recipes}
          startCategory="Middag"
          hideCategorySwitch
          title={`Slumpa ${randomFor.mealType === 'dinner' ? 'middag' : 'lunch'}, ${randomFor.dayName.toLowerCase()}`}
          confirmLabel={`Välj till ${randomFor.dayName.toLowerCase()}`}
          avoidIds={mealPlan.flatMap((d) => [d.dinnerRecipeId, d.lunchRecipeId]).filter((id): id is string => Boolean(id))}
          onSelectRecipe={(r) => setMealPlanForDay(randomFor.dayName, randomFor.mealType, r.id)}
          onClose={() => setRandomFor(null)}
        />
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
              Ingredienserna till {plannedSummary} från i dag och framåt läggs till, sorterade efter avdelning.
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
                Lägg till i inköpslistan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CLEAR WEEK CONFIRMATION MODAL                                       */}
      {/* =================================================================== */}
      {showClearWeekModal && (
        <ConfirmSheet
          title={`Töm vecka ${weekNumber}?`}
          text={`Alla luncher och middagar ${formatWeekRange(planWeekStart)} tas bort. Andra veckor påverkas inte.`}
          confirmLabel="Töm veckan"
          onCancel={() => setShowClearWeekModal(false)}
          onConfirm={handleConfirmClearWeek}
        />
      )}
    </div>
  );
};
