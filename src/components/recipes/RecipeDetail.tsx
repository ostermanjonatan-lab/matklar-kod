import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ConfirmSheet } from '../layout/ConfirmSheet';
import { DifficultyDots } from './DifficultyPicker';
import { DIFFICULTY_LABELS } from '../../utils/recipeDifficulty';
import type { Recipe } from '../../types/recipe';
import { addDaysISO, dayNameForDate, formatDayMonth, todayISO } from '../../utils/mealPlanDates';

/** "I dag", "I morgon" or "Lördag 7 nov" */
function upcomingDayLabel(dateStr: string): string {
  const today = todayISO();
  if (dateStr === today) return 'I dag';
  if (dateStr === addDaysISO(today, 1)) return 'I morgon';
  return `${dayNameForDate(dateStr)} ${formatDayMonth(dateStr)}`;
}
import { useRecipes } from '../../context/RecipeContext';
import {
  Heart,
  Clock,
  ExternalLink,
  Check,
  CheckCircle2,
  Circle,
  CalendarPlus,
  Edit3,
  Trash2,
  Timer,
  Play,
  Pause,
  RotateCcw,
  X,
  Bell,
  Share2,
  Sun,
  ShoppingCart
} from 'lucide-react';
import { PortionScaler } from './PortionScaler';
import { findIngredientsInStep } from '../../utils/stepIngredients';
import { EditRecipeModal } from './EditRecipeModal';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { PantryChoiceDialog, hasPantryStaples } from './PantryChoiceDialog';
import { scaleIngredientAmount, formatAmount, formatCookingTime, capitalizeFirst, formatUnit, formatIngredientName, formatRecipeTitle } from '../../utils/formatters';
import { splitTextIntoTimerSegments } from '../../utils/timerParser';
import { shareRecipeAsText } from '../../utils/recipeShare';
import { playTimerAlarm } from '../../utils/audioAlert';
import { useWakeLock } from '../../utils/wakeLock';

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe: initialRecipe, onBack }) => {
  const {
    recipes,
    shoppingList,
    toggleFavorite,
    deleteRecipe,
    updateNotes,
    addIngredientsToShoppingList,
    setMealPlanForDate,
    getMealPlanForDate,
    setActiveTab,
  } = useRecipes();

  // Always bind to the live recipe from state
  const recipe = recipes.find((r) => r.id === initialRecipe.id) || initialRecipe;

  // Local interactive state
  const [servings, setServings] = useState<number>(recipe.servings || 4);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [isEditingRecipe, setIsEditingRecipe] = useState<boolean>(false);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [notesDraft, setNotesDraft] = useState<string>(recipe.notes || '');
  const [showNotesSavedToast, setShowNotesSavedToast] = useState<boolean>(false);
  const [shoppingToast, setShoppingToast] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<boolean>(false);
  const [showPantryChoice, setShowPantryChoice] = useState<boolean>(false);
  const [showMealPlanPicker, setShowMealPlanPicker] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [mealPlanMealType, setMealPlanMealType] = useState<'dinner' | 'lunch'>('dinner');
  const [shareToast, setShareToast] = useState<boolean>(false);
  const [copiedRecently, setCopiedRecently] = useState<boolean>(false);

  // Check if current recipe has items in shopping list
  const isInShoppingList = useMemo(() => {
    const titleLower = recipe.title.trim().toLowerCase();
    return shoppingList.some((item) => {
      if (item.recipeSource) {
        const sources = item.recipeSource.split('+').map((s) => s.trim().toLowerCase());
        if (sources.includes(titleLower)) return true;
      }
      if (item.mergedSources) {
        const sources = item.mergedSources.map((s) => s.trim().toLowerCase());
        if (sources.includes(titleLower)) return true;
      }
      return false;
    });
  }, [shoppingList, recipe.title]);

  const shoppingTouchPosRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const handleShoppingTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      shoppingTouchPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        moved: false,
      };
    }
  };

  const handleShoppingTouchMove = (e: React.TouchEvent) => {
    if (!shoppingTouchPosRef.current || e.touches.length === 0) return;
    const dx = Math.abs(e.touches[0].clientX - shoppingTouchPosRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - shoppingTouchPosRef.current.y);
    if (dx > 8 || dy > 8) {
      shoppingTouchPosRef.current.moved = true;
    }
  };

  const handleShoppingTouchEnd = (e: React.TouchEvent) => {
    if (shoppingTouchPosRef.current?.moved) {
      e.stopPropagation();
    }
  };

  const handleImageShoppingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shoppingTouchPosRef.current?.moved) {
      shoppingTouchPosRef.current = null;
      return;
    }
    shoppingTouchPosRef.current = null;

    if (recipe.ingredients && recipe.ingredients.length > 0) {
      if (hasPantryStaples(recipe)) {
        setShowPantryChoice(true);
      } else {
        handleAddToShoppingList(true);
      }
    }
  };

  // Screen Wake Lock (prevents phone from sleeping during cooking)
  const { isLocked, isSupported: isWakeLockSupported, requestWakeLock, releaseWakeLock } = useWakeLock();
  const [wakeLockToast, setWakeLockToast] = useState<string | null>(null);

  const handleToggleWakeLock = async () => {
    if (isLocked) {
      await releaseWakeLock();
      setWakeLockToast('Skärmlås återställt till normalt.');
    } else {
      const ok = await requestWakeLock();
      if (ok) {
        setWakeLockToast('Skärmen hålls tänd medan du lagar mat');
      } else {
        setWakeLockToast('Kunde inte aktivera skärmlås.');
      }
    }
    setTimeout(() => setWakeLockToast(null), 3000);
  };

  const handleShareRecipe = async () => {
    const { success } = await shareRecipeAsText(recipe, servings);
    if (success) {
      setCopiedRecently(true);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
      setTimeout(() => setCopiedRecently(false), 2000);
    }
  };

  // Synchronize modals and sheets with Android back button
  // The edit view asks before unsaved changes are lost. When it stays open on the phone's back
  // button, the back step is set up again (new id) so the next back press is caught too.
  const editCloseGuardRef = useRef<(() => boolean) | null>(null);
  const [editBackRound, setEditBackRound] = useState<number>(0);
  useModalBackHandler(
    isEditingRecipe,
    () => {
      const staysOpen = editCloseGuardRef.current?.() ?? false;
      if (staysOpen) setEditBackRound((n) => n + 1);
      else setIsEditingRecipe(false);
    },
    `edit-recipe-${editBackRound}`
  );
  useModalBackHandler(showMealPlanPicker, () => setShowMealPlanPicker(false), 'meal-plan-picker');
  useModalBackHandler(showDeleteConfirm, () => setShowDeleteConfirm(false), 'delete-confirm');

  const handleDeleteRecipe = () => {
    deleteRecipe(recipe.id);
    setShowDeleteConfirm(false);
    onBack();
  };
  useModalBackHandler(showPantryChoice, () => setShowPantryChoice(false), 'pantry-choice');

  // Close modal on Escape key if no child dialog is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditingRecipe && !showMealPlanPicker && !showDeleteConfirm) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, isEditingRecipe, showMealPlanPicker, showDeleteConfirm]);

  // Lock body scroll while recipe modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Ensure recipe content always starts at the top when opened or changed
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollToTop = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    };

    scrollToTop();
    const rafId = requestAnimationFrame(scrollToTop);
    const timerId = setTimeout(scrollToTop, 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [recipe.id]);

  // Floating Inline Kitchen Timer State (with absolute target timestamp for background reliability)
  const [activeTimer, setActiveTimer] = useState<{
    label: string;
    totalSeconds: number;
    secondsLeft: number;
    isRunning: boolean;
    targetEndTime: number | null;
  } | null>(null);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!activeTimer?.isRunning || !activeTimer.targetEndTime) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    const checkTimerTick = () => {
      setActiveTimer((prev) => {
        if (!prev || !prev.isRunning || !prev.targetEndTime) return prev;
        const diffMs = prev.targetEndTime - Date.now();
        const remaining = Math.max(0, Math.ceil(diffMs / 1000));

        if (remaining <= 0) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          playTimerAlarm();
          return { ...prev, secondsLeft: 0, isRunning: false, targetEndTime: null };
        }
        return { ...prev, secondsLeft: remaining };
      });
    };

    // Check timer frequently (every 250ms) to ensure smooth second countdown
    timerIntervalRef.current = setInterval(checkTimerTick, 250);

    // Immediately recalibrate whenever phone unlocks or app gains visibility
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkTimerTick();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [activeTimer?.isRunning, activeTimer?.targetEndTime]);

  const handleStartInlineTimer = (minutes: number, label: string) => {
    const totalSeconds = Math.round(minutes * 60);
    const now = Date.now();
    setActiveTimer({
      label,
      totalSeconds,
      secondsLeft: totalSeconds,
      isRunning: true,
      targetEndTime: now + totalSeconds * 1000,
    });
  };

  const handleToggleTimerRunning = () => {
    setActiveTimer((prev) => {
      if (!prev) return null;
      if (prev.isRunning) {
        // Pausing: freeze secondsLeft and clear targetEndTime
        return {
          ...prev,
          isRunning: false,
          targetEndTime: null,
        };
      } else {
        // Resuming: recompute targetEndTime from remaining seconds
        const now = Date.now();
        return {
          ...prev,
          isRunning: true,
          targetEndTime: now + prev.secondsLeft * 1000,
        };
      }
    });
  };

  const handleRestartTimer = () => {
    setActiveTimer((prev) => {
      if (!prev) return null;
      const now = Date.now();
      return {
        ...prev,
        secondsLeft: prev.totalSeconds,
        isRunning: true,
        targetEndTime: now + prev.totalSeconds * 1000,
      };
    });
  };

  const formatTimerDisplay = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Toggle single ingredient check
  const toggleIngredientCheck = (index: number) => {
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Ingredients (with an amount) mentioned in each step, shown under the step
  const stepIngredients = useMemo(() => {
    const result: Record<number, number[]> = {};
    for (const inst of recipe.instructions) {
      result[inst.stepNumber] = findIngredientsInStep(inst.text, recipe.ingredients).filter(
        (idx) => typeof recipe.ingredients[idx].amount === 'number' && recipe.ingredients[idx].amount! > 0
      );
    }
    return result;
  }, [recipe.instructions, recipe.ingredients]);

  // Toggle single step completion
  const toggleStepComplete = (stepNumber: number) => {
    setCompletedSteps((prev) => ({ ...prev, [stepNumber]: !prev[stepNumber] }));
  };

  // Save Notes
  const handleSaveNotes = () => {
    updateNotes(recipe.id, notesDraft);
    setIsEditingNotes(false);
    setShowNotesSavedToast(true);
    setTimeout(() => setShowNotesSavedToast(false), 3000);
  };

  // Add Ingredients to Shopping List
  const handleAddToShoppingList = (excludePantry: boolean = true) => {
    const scaledIngredients = recipe.ingredients.map((ing) => ({
      ...ing,
      amount: scaleIngredientAmount(ing.amount, recipe.servings, servings),
    }));
    addIngredientsToShoppingList(scaledIngredients, recipe.title, excludePantry);
    setShoppingToast('Tillagt i inköpslistan');
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
    setTimeout(() => setShoppingToast(null), 4000);
  };

  // Add Recipe to Meal Plan
  const handleAddToDay = (dateStr: string) => {
    setMealPlanForDate(dateStr, mealPlanMealType, recipe.id);
    setShowMealPlanPicker(false);
    const mealLabel = mealPlanMealType === 'dinner' ? 'middag' : 'lunch';
    setShoppingToast(`Inlagd som ${mealLabel} ${upcomingDayLabel(dateStr).toLowerCase()}`);
    setTimeout(() => setShoppingToast(null), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fade-in font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onBack();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={recipe.title}
    >
      <div
        className="bg-[#FCFAF5] w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-6xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E8E4DC] overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] transition-all relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full Recipe Editing Modal */}
        {isEditingRecipe && (
          <EditRecipeModal
            closeGuardRef={editCloseGuardRef}
            recipe={recipe}
            onClose={() => setIsEditingRecipe(false)}
            onDeleted={onBack}
          />
        )}

        {/* Modal Sticky Top Header */}
        <div className="bg-[#FCFAF5]/95 backdrop-blur-md px-4 sm:px-5 py-3 border-b border-[#EBE7DF] flex items-center justify-between shrink-0 z-20">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-90 flex items-center justify-center text-stone-700 shadow-xs transition-all touch-manipulation cursor-pointer"
            aria-label="Stäng recept"
            title="Stäng recept (Esc)"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>

          <div className="flex items-center gap-2">
            {isWakeLockSupported && (
              <button
                type="button"
                onClick={handleToggleWakeLock}
                className={`w-10 h-10 rounded-full border active:scale-90 flex items-center justify-center shadow-xs transition-all touch-manipulation cursor-pointer ${
                  isLocked
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-[#EBE7DF] hover:bg-stone-50 text-stone-700'
                }`}
                aria-label={isLocked ? 'Skärmen hålls vaken (klicka för att stänga av)' : 'Håll skärmen vaken'}
                title={isLocked ? 'Skärmen hålls vaken (aktiv)' : 'Håll skärmen vaken under matlagning'}
              >
                <Sun className={`w-4 h-4 transition-transform ${isLocked ? 'scale-110 text-amber-700 fill-amber-300' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={handleShareRecipe}
              className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-90 flex items-center justify-center text-stone-700 shadow-xs transition-all touch-manipulation cursor-pointer"
              aria-label="Dela recept i textform"
              title="Dela recept (kopiera till urklipp)"
            >
              {copiedRecently ? (
                <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsEditingRecipe(true)}
              className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-90 flex items-center justify-center text-stone-700 shadow-xs transition-all touch-manipulation cursor-pointer"
              aria-label="Redigera recept"
              title="Redigera recept"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(recipe.id)}
              className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-90 flex items-center justify-center text-stone-700 shadow-xs transition-all touch-manipulation cursor-pointer"
              aria-label="Favoritmarkera"
              title={recipe.isFavorite ? 'Ta bort favorit' : 'Favoritmarkera'}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  recipe.isFavorite ? 'fill-rose-500 text-rose-500 scale-110' : 'text-stone-700'
                }`}
              />
            </button>
          </div>
        </div>

        {/* WakeLock Toast Notification */}
        {wakeLockToast && (
          <div className="bg-stone-900 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between animate-fade-in shrink-0 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{wakeLockToast}</span>
            </div>
          </div>
        )}

        {/* Share Toast Notification */}
        {shareToast && (
          <div className="bg-stone-900 text-white px-4 py-2.5 text-xs font-semibold flex items-center gap-2 animate-fade-in shrink-0 border-b border-stone-800">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Receptet är kopierat som text</span>
          </div>
        )}

        {/* Shopping Toast Notification */}
        {shoppingToast && (
          <div className="bg-emerald-950 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between animate-fade-in shrink-0 border-b border-emerald-900 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{shoppingToast}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShoppingToast(null);
                onBack();
                setActiveTab('shopping');
              }}
              className="text-xs font-bold underline bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg touch-manipulation shrink-0"
            >
              Visa inköp
            </button>
          </div>
        )}

        {/* Scrollable Single-Column Body */}
        <div ref={scrollContainerRef} className="overflow-y-auto flex-1 overscroll-contain">
          {/* Cover Image Banner */}
          <div className="relative aspect-16/10 lg:aspect-auto lg:h-56 w-full bg-stone-900 overflow-hidden shadow-sm shrink-0">
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
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-black/30 to-black/20" />

            <div className="absolute bottom-4 left-4 right-16 text-white z-10">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight drop-shadow-md">
                {formatRecipeTitle(recipe.title)}
              </h1>
            </div>

            {/* Quick Add to Shopping List Button (Bottom Right of Image) */}
            <button
              type="button"
              onTouchStart={handleShoppingTouchStart}
              onTouchMove={handleShoppingTouchMove}
              onTouchEnd={handleShoppingTouchEnd}
              onClick={handleImageShoppingClick}
              className={`absolute bottom-3.5 right-3.5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-125 shadow-md touch-manipulation z-20 cursor-pointer ${
                addedToCart
                  ? 'bg-emerald-600 text-white'
                  : isInShoppingList
                  ? 'bg-white/95 text-emerald-700 hover:text-emerald-800'
                  : 'bg-white/95 text-stone-700 hover:text-[#284235] hover:bg-white'
              }`}
              aria-label={
                addedToCart
                  ? 'Receptet tillagt i inköpslistan'
                  : isInShoppingList
                  ? 'Receptet finns i inköpslistan (klicka för att lägga till igen)'
                  : 'Lägg till receptet i inköpslistan'
              }
              title={
                isInShoppingList
                  ? 'Finns i inköpslistan (klicka för att lägga till igen)'
                  : 'Lägg till i inköpslistan'
              }
            >
              {addedToCart ? (
                <Check className="w-4 h-4 text-white stroke-[2.5]" />
              ) : (
                <ShoppingCart
                  className={`w-4 h-4 transition-colors ${
                    isInShoppingList ? 'text-emerald-600 stroke-[2.2]' : ''
                  }`}
                />
              )}
              {isInShoppingList && !addedToCart && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              )}
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
            {/* Cooking time */}
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Clock className="w-4 h-4 text-stone-500" />
              <span>Tillagningstid {formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes)}</span>
              {recipe.difficulty && (
                <span className="flex items-center gap-1.5 ml-3 text-stone-600">
                  <DifficultyDots level={recipe.difficulty} />
                  {DIFFICULTY_LABELS[recipe.difficulty]}
                </span>
              )}
            </div>

            {/* Ingredients and instructions, side by side on wide screens */}
            <div className="space-y-4 sm:space-y-5 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6 lg:items-start">
            <div className="space-y-4 sm:space-y-5 lg:sticky lg:top-4">
            {/* Ingredients Section */}
            <div className="space-y-4 pt-1 lg:pt-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-serif text-lg font-bold text-stone-900">
                  Ingredienser
                </h2>
                <span className="text-xs font-semibold text-stone-500">
                  {recipe.ingredients.length} st
                </span>
              </div>

              <PortionScaler
                currentServings={servings}
                baseServings={recipe.servings}
                onServingsChange={setServings}
              />
            </div>

            {/* Ingredients List (Touch-Friendly Checkable Rows) */}
        <div className="bg-white rounded-3xl border border-[#EBE7DF] shadow-xs overflow-hidden divide-y divide-[#EBE7DF]/70 w-full">
          {recipe.ingredients.map((ing, idx) => {
            const isChecked = !!checkedIngredients[idx];
            const scaledAmount = scaleIngredientAmount(ing.amount, recipe.servings, servings);
            const formattedAmountStr = formatAmount(scaledAmount);

            return (
              <div
                key={idx}
                onClick={() => toggleIngredientCheck(idx)}
                className={`px-4 py-3.5 flex items-center justify-between cursor-pointer transition-colors active:bg-stone-50 touch-manipulation w-full gap-3 ${
                  isChecked ? 'bg-stone-50/60 text-stone-400' : 'text-stone-900 hover:bg-stone-50/40'
                }`}
                style={{ minHeight: '52px' }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    className="shrink-0 text-stone-400 hover:text-emerald-700 transition-colors w-6 h-6 flex items-center justify-center"
                    aria-label={isChecked ? 'Markera som ej klar' : 'Markera som klar'}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5 text-[#284235] fill-emerald-100" />
                    ) : (
                      <Circle className="w-5 h-5 text-stone-300" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`text-sm font-medium block leading-snug break-words ${
                        isChecked ? 'line-through text-stone-400' : 'text-stone-900'
                      }`}
                    >
                      {capitalizeFirst(formatIngredientName(ing.name, scaledAmount, ing.unit))}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                      isChecked ? 'text-stone-400 line-through' : 'text-[#284235]'
                    }`}
                  >
                    {formattedAmountStr ? `${formattedAmountStr} ${formatUnit(ing.unit, scaledAmount)}`.trim() : (ing.unit || '')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

            </div>

        {/* Instructions Steps, Timers, Notes & Actions */}
        <div className="space-y-5">
          {/* Instructions Steps */}
          <div>
            <h2 className="font-serif text-lg font-bold text-stone-900 mb-3">
              Gör så här
            </h2>

          <ol className="w-full divide-y divide-[#EBE7DF] border-y border-[#EBE7DF]">
            {recipe.instructions.map((inst) => {
              const isStepDone = !!completedSteps[inst.stepNumber];
              const segments = splitTextIntoTimerSegments(inst.text);

              return (
                <li
                  key={inst.stepNumber}
                  onClick={() => toggleStepComplete(inst.stepNumber)}
                  className="py-3.5 cursor-pointer touch-manipulation w-full"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-6 pt-px font-serif font-bold text-base leading-snug shrink-0 tabular-nums ${
                        isStepDone ? 'text-[#284235]' : 'text-stone-400'
                      }`}
                    >
                      {isStepDone ? <Check className="w-4 h-4 mt-0.5 stroke-[3]" aria-label="Klart" /> : inst.stepNumber}
                    </div>

                    <div
                      className={`text-sm leading-relaxed flex-1 min-w-0 ${
                        isStepDone ? 'line-through text-stone-400' : 'text-stone-800'
                      }`}
                    >
                      {segments.map((seg, sIdx) => {
                        if (seg.timer) {
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartInlineTimer(seg.timer!.minutes, seg.timer!.label);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mx-1 rounded-xl bg-amber-100/80 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold active:scale-95 transition-all text-xs touch-manipulation align-baseline shadow-xs"
                              title={`Starta timer på ${seg.timer.label}`}
                            >
                              <Timer className="w-3.5 h-3.5 text-amber-700" />
                              <span>{seg.text}</span>
                            </button>
                          );
                        }
                        return <span key={sIdx}>{seg.text}</span>;
                      })}

                      {stepIngredients[inst.stepNumber]?.length > 0 && (
                        <p className={`mt-1.5 text-xs leading-relaxed ${isStepDone ? 'text-stone-400' : 'text-stone-500'}`}>
                          {stepIngredients[inst.stepNumber].map((idx, i) => {
                            const ing = recipe.ingredients[idx];
                            const scaled = scaleIngredientAmount(ing.amount, recipe.servings, servings);
                            const amountText = `${formatAmount(scaled)} ${formatUnit(ing.unit, scaled)}`.trim();
                            const name = formatIngredientName(ing.name, scaled, ing.unit)
                              .replace(/\s*\([^)]*\)/g, '')
                              .trim()
                              .toLowerCase();
                            return (
                              <React.Fragment key={idx}>
                                {i > 0 && <span className="text-stone-400">{'\u00a0· '}</span>}
                                <span className={`whitespace-nowrap ${isStepDone ? '' : 'font-medium text-stone-700'}`}>{amountText}</span> {name}
                              </React.Fragment>
                            );
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Household Notes Section */}
        <div className="space-y-2 w-full">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-stone-900">Anteckningar</h2>

            {!isEditingNotes && (
              <button
                type="button"
                onClick={() => setIsEditingNotes(true)}
                className="text-sm text-[#284235] font-semibold min-h-[40px] px-1 touch-manipulation shrink-0"
              >
                {recipe.notes ? 'Ändra' : 'Skriv anteckning'}
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-3 animate-fade-in">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Till exempel mindre salt, eller dubbel sats sås"
                className="w-full h-24 p-3 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(recipe.notes || '');
                    setIsEditingNotes(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 touch-manipulation min-h-[44px]"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#284235] hover:bg-black touch-manipulation min-h-[44px]"
                >
                  Spara
                </button>
              </div>
            </div>
          ) : (
            <div>
              {recipe.notes ? (
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{recipe.notes}</p>
              ) : (
                <p className="text-sm text-stone-400">Inga anteckningar. De syns för hela hushållet.</p>
              )}
            </div>
          )}

          {showNotesSavedToast && (
            <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1 animate-fade-in">
              <Check className="w-3.5 h-3.5" />
              Sparad för hela hushållet
            </div>
          )}
        </div>

        {/* Quick Add to Meal Plan & Edit Recipe Footer Actions */}
        <div className="pt-2 space-y-2.5 w-full">
          <button
            type="button"
            onClick={handleImageShoppingClick}
            className="w-full py-4 px-4 rounded-2xl bg-[#284235] hover:bg-black active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all touch-manipulation"
            style={{ minHeight: '54px' }}
          >
            {addedToCart ? (
              <Check className="w-5 h-5 text-emerald-300 stroke-[2.5]" />
            ) : (
              <ShoppingCart className="w-5 h-5 text-emerald-300" />
            )}
            <span>{addedToCart ? 'Tillagt i inköpslistan' : 'Lägg till i inköpslistan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMealPlanPicker(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-[0.98] text-stone-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation shadow-xs"
            style={{ minHeight: '48px' }}
          >
            <CalendarPlus className="w-4 h-4 text-stone-600" />
            <span>Lägg till i veckoplanen</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingRecipe(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-[0.98] text-stone-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation"
            style={{ minHeight: '48px' }}
          >
            <Edit3 className="w-4 h-4" />
            <span>Redigera receptet</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 active:scale-[0.98] text-rose-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation"
            style={{ minHeight: '48px' }}
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Ta bort recept</span>
          </button>

        </div>

        {/* Source link if URL */}
        {recipe.sourceUrl && (
          <div>
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1.5 py-2 touch-manipulation truncate max-w-full"
            >
              <span>Receptet kommer från {new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>
        )}
          </div>
          </div>
        </div>
      </div>

      {/* Ask whether pantry staples should be included */}
      {showPantryChoice && (
        <PantryChoiceDialog
          recipe={recipe}
          onChoose={(skipPantryStaples) => {
            setShowPantryChoice(false);
            handleAddToShoppingList(skipPantryStaples);
          }}
          onClose={() => setShowPantryChoice(false)}
        />
      )}

      {/* Meal Plan Day Picker Sheet/Modal */}
      {showMealPlanPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Lägg till i veckoplanen
              </h3>
              <button
                type="button"
                onClick={() => setShowMealPlanPicker(false)}
                className="w-10 h-10 rounded-full bg-[#FCFAF5] flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meal Type Switcher: Middag / Lunch */}
            <div className="flex rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF] p-1">
              <button
                type="button"
                onClick={() => setMealPlanMealType('dinner')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center transition-all ${
                  mealPlanMealType === 'dinner'
                    ? 'bg-[#284235] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Middag
              </button>
              <button
                type="button"
                onClick={() => setMealPlanMealType('lunch')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center transition-all ${
                  mealPlanMealType === 'lunch'
                    ? 'bg-[#284235] text-white shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Lunch
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Välj dag för {formatRecipeTitle(recipe.title)}.
            </p>

            <div className="grid grid-cols-1 gap-2">
              {Array.from({ length: 7 }, (_, i) => addDaysISO(todayISO(), i)).map((dateStr) => {
                const planned = getMealPlanForDate(dateStr);
                const plannedId = mealPlanMealType === 'dinner' ? planned?.dinnerRecipeId : planned?.lunchRecipeId;
                const plannedCustom = mealPlanMealType === 'dinner' ? planned?.customDinner : planned?.customLunch;
                const plannedRecipe = plannedId ? recipes.find((r) => r.id === plannedId) : undefined;
                const plannedText = plannedRecipe ? formatRecipeTitle(plannedRecipe.title) : plannedCustom?.trim();
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleAddToDay(dateStr)}
                    className="py-2.5 px-4 rounded-2xl border border-[#EBE7DF] hover:border-[#284235] hover:bg-emerald-50/40 text-left text-sm text-stone-900 flex items-center justify-between gap-3 transition-colors touch-manipulation"
                    style={{ minHeight: '52px' }}
                  >
                    <span className="font-semibold shrink-0">{upcomingDayLabel(dateStr)}</span>
                    <span className="text-xs text-stone-500 truncate">
                      {plannedText ? `Ersätter ${plannedText}` : 'Ledig'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floating Active Kitchen Timer Bar */}
      {activeTimer && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white rounded-3xl p-3.5 shadow-2xl border border-stone-700 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                activeTimer.secondsLeft === 0
                  ? 'bg-rose-500 text-white animate-bounce'
                  : activeTimer.isRunning
                  ? 'bg-amber-400 text-stone-950 font-bold'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              <Timer className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-stone-400 truncate">
                Timer: {activeTimer.label}
              </div>
              <div className="text-lg font-bold font-mono tracking-wider text-amber-300 flex items-center gap-1.5">
                {activeTimer.secondsLeft === 0 ? (
                  <>
                    <span>Klart</span>
                    <Bell className="w-4 h-4 text-amber-300 animate-bounce shrink-0" />
                  </>
                ) : (
                  formatTimerDisplay(activeTimer.secondsLeft)
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeTimer.secondsLeft > 0 ? (
              <button
                type="button"
                onClick={handleToggleTimerRunning}
                className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all touch-manipulation"
                aria-label={activeTimer.isRunning ? 'Pausa timer' : 'Starta timer'}
              >
                {activeTimer.isRunning ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestartTimer}
                className="px-3 h-10 rounded-2xl bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 active:scale-95 touch-manipulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Igen</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTimer(null)}
              className="w-9 h-9 rounded-2xl bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center touch-manipulation"
              aria-label="Stäng timer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmSheet
          title="Ta bort receptet?"
          text={`${formatRecipeTitle(recipe.title)} tas bort för hela hushållet.`}
          confirmLabel="Ta bort receptet"
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteRecipe}
        />
      )}
      </div>
    </div>
  );
};
