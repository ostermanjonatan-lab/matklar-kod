import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FadeImage } from '../layout/FadeImage';
import { hasCoverImage } from '../../utils/coverImage';
import { Toast } from '../layout/Toast';
import { PhotoViewer } from '../layout/PhotoViewer';
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
  Play,
  X,
  ChevronDown,
  Share2,
  Sun,
  ShoppingCart,
  Minus,
  Plus
} from 'lucide-react';
import { PortionScaler } from './PortionScaler';
import { NutritionPanel } from './NutritionPanel';
import { findIngredientMentions, type IngredientMention } from '../../utils/stepIngredients';
import { EditRecipeModal } from './EditRecipeModal';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { PantryChoiceDialog, hasPantryStaples } from './PantryChoiceDialog';
import { scaleIngredientAmount, formatAmount, formatCookingTime, capitalizeFirst, formatUnit, formatIngredientName, formatRecipeTitle } from '../../utils/formatters';
import { splitTextIntoTimerSegments } from '../../utils/timerParser';
import { ShareRecipeSheet } from '../share/ShareRecipeSheet';
import { useTimer } from '../../context/TimerContext';
import { TimerBar } from '../timer/TimerBar';
import { useWakeLock } from '../../utils/wakeLock';

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
  /** Hides the recipe above the bottom menu. It stays open, with ticked steps and portions kept. */
  onMinimize?: () => void;
  /** True while minimized: the view is kept but not shown. */
  hidden?: boolean;
}

/** "30 sek", "10 min", "1 min 30 sek" or "1 tim 30 min" for a timer button. */
function shortDuration(minutes: number): string {
  const total = Math.round(minutes * 60);
  if (total < 60) return `${total} sek`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return m > 0 ? `${h} tim ${m} min` : `${h} tim`;
  return sec > 0 ? `${m} min ${sec} sek` : `${m} min`;
}

/** The timers in a step, each length once, in the order they are written. */
function stepTimers(segments: ReturnType<typeof splitTextIntoTimerSegments>) {
  const seen = new Set<string>();
  const result: { minutes: number; maxMinutes?: number; label: string }[] = [];
  for (const seg of segments) {
    // seconds is exact. minutes is rounded up to whole minutes for times in seconds.
    const minutes = seg.timer ? (seg.timer.seconds > 0 ? seg.timer.seconds / 60 : seg.timer.minutes) : 0;
    const maxMinutes = seg.timer?.maxSeconds ? seg.timer.maxSeconds / 60 : undefined;
    const key = `${minutes}-${maxMinutes ?? ''}`;
    if (seg.timer && !seen.has(key)) {
      seen.add(key);
      result.push({ minutes, maxMinutes, label: seg.timer.label });
    }
  }
  return result;
}

/** "10–20 min", "1–2 tim" or "30–45 sek" for a timer button */
function rangeDuration(min: number, max: number): string {
  const a = shortDuration(min);
  const b = shortDuration(max);
  const [aNum, aUnit] = a.split(' ');
  const [bNum, bUnit] = b.split(' ');
  return a.split(' ').length === 2 && b.split(' ').length === 2 && aUnit === bUnit ? `${aNum}–${bNum} ${bUnit}` : `${a}–${b}`;
}

/**
 * A timer for a range in a step ("ca 10-20 min"): opens a row where the time is chosen with
 * − and + between the two, starting in the middle.
 */
const RangeTimer: React.FC<{ min: number; max: number; label: string; onStart: (minutes: number, label: string) => void }> = ({
  min,
  max,
  label,
  onStart,
}) => {
  const span = (max - min) * 60;
  const step = (span <= 60 ? 5 : span <= 900 ? 60 : 300) / 60;
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(() => Math.min(max, min + Math.round((max - min) / 2 / step) * step));
  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-semibold text-[#284235] touch-manipulation"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        Starta timer {rangeDuration(min, max)}
      </button>
    );
  }
  const change = (delta: number) => setChosen((c) => Math.min(max, Math.max(min, Math.round((c + delta) * 60) / 60)));
  return (
    <div className="flex items-center gap-2 min-h-[44px]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => change(-step)}
        disabled={chosen <= min}
        aria-label="Kortare tid"
        className="w-9 h-9 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center text-stone-700 disabled:opacity-40 touch-manipulation"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-stone-900">{shortDuration(chosen)}</span>
      <button
        type="button"
        onClick={() => change(step)}
        disabled={chosen >= max}
        aria-label="Längre tid"
        className="w-9 h-9 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center text-stone-700 disabled:opacity-40 touch-manipulation"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          onStart(chosen, `${shortDuration(chosen)} (${label})`);
          setOpen(false);
        }}
        className="ml-1 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#284235] text-white text-sm font-semibold touch-manipulation"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        Starta
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Stäng"
        className="w-9 h-9 flex items-center justify-center text-stone-500 touch-manipulation"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe: initialRecipe, onBack, onMinimize, hidden = false }) => {
  const {
    recipes,
    shoppingList,
    toggleFavorite,
    deleteRecipe,
    updateNotes,
    addIngredientsToShoppingList,
    shoppingLists,
    setActiveShoppingListId,
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
  // The list the recipe was just added to, so Visa listan opens it
  const [addedToListId, setAddedToListId] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState<boolean>(false);
  const [showPantryChoice, setShowPantryChoice] = useState<boolean>(false);
  const [showMealPlanPicker, setShowMealPlanPicker] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [mealPlanMealType, setMealPlanMealType] = useState<'dinner' | 'lunch'>('dinner');
  const [shareToast, setShareToast] = useState<string | null>(null);
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

  const [showShareSheet, setShowShareSheet] = useState(false);
  const handleShareRecipe = () => setShowShareSheet(true);
  const handleShareDone = (message: string) => {
    setShareToast(message);
    setCopiedRecently(true);
    setTimeout(() => setShareToast(null), 3000);
    setTimeout(() => setCopiedRecently(false), 2000);
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
  useModalBackHandler(showShareSheet, () => setShowShareSheet(false), 'share-recipe');
  // The photo in full screen, opened by tapping it
  const [showPhoto, setShowPhoto] = useState(false);
  useModalBackHandler(showPhoto, () => setShowPhoto(false), 'recipe-photo');

  const handleDeleteRecipe = () => {
    deleteRecipe(recipe.id);
    setShowDeleteConfirm(false);
    onBack();
  };
  useModalBackHandler(showPantryChoice, () => setShowPantryChoice(false), 'pantry-choice');

  // Close modal on Escape key if no child dialog is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !hidden && !isEditingRecipe && !showMealPlanPicker && !showDeleteConfirm) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, hidden, isEditingRecipe, showMealPlanPicker, showDeleteConfirm]);

  // Lock body scroll while recipe modal is open
  useEffect(() => {
    if (hidden) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [hidden]);

  // Ensure recipe content always starts at the top when opened or changed
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollToTop = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        scrollContainerRef.current.querySelectorAll<HTMLElement>('[data-scroll-column]').forEach((col) => {
          col.scrollTop = 0;
        });
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

  // The kitchen timer lives above this view, so it keeps going when the recipe is closed
  const { startTimer } = useTimer();
  const handleStartInlineTimer = (minutes: number, label: string) =>
    startTimer(minutes, label, { id: recipe.id, title: recipe.title });

  // Toggle single ingredient check
  const toggleIngredientCheck = (index: number) => {
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Words in each step that name an ingredient with an amount. The amount is shown after the word.
  const stepMentions = useMemo(() => {
    const hasAmount = (idx: number) =>
      typeof recipe.ingredients[idx].amount === 'number' && recipe.ingredients[idx].amount! > 0;
    const result: Record<number, IngredientMention[]> = {};
    for (const inst of recipe.instructions) {
      result[inst.stepNumber] = findIngredientMentions(inst.text, recipe.ingredients)
        .map((m) => ({ ...m, ingredients: m.ingredients.filter(hasAmount) }))
        .filter((m) => m.ingredients.length > 0);
    }
    return result;
  }, [recipe.instructions, recipe.ingredients]);
  // "400 g", or "80 g pecorino romano · 50 g parmesan" when the word fits several ingredients
  // One of something ("ägget", "löken") needs no "(1 st)": the word already says it
  const mentionAmount = (indexes: number[]) => {
    if (indexes.length === 1) {
      const ing = recipe.ingredients[indexes[0]];
      const scaled = scaleIngredientAmount(ing.amount, recipe.servings, servings);
      const unit = (ing.unit || '').trim().toLowerCase().replace(/\.$/, '');
      if (scaled === 1 && ['', 'st', 'styck', 'stycken'].includes(unit)) return '';
    }
    return indexes
      .map((idx) => {
        const ing = recipe.ingredients[idx];
        const scaled = scaleIngredientAmount(ing.amount, recipe.servings, servings);
        // A non-breaking space keeps "810 g" on one line
        const amount = `${formatAmount(scaled)}\u00a0${formatUnit(ing.unit, scaled)}`.trim();
        if (indexes.length === 1) return amount;
        // Only the name itself: "stora tomater, gärna kvisttomater" and "stora tomater gärna
        // kvisttomater" -> "stora tomater"
        const name = formatIngredientName(ing.name, scaled, ing.unit)
          .replace(/\s*\([^)]*\)/g, '')
          .split(/,|\s+eller\s+|\s+gärna\s+|\s+helst\s+|\s+alt\.?\s+/)[0]
          .trim()
          .toLowerCase();
        return `${amount} ${name}`;
      })
      .join(' · ');
  };

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
  const handleAddToShoppingList = (excludePantry: boolean = true, listId: string | null = null) => {
    const scaledIngredients = recipe.ingredients.map((ing) => ({
      ...ing,
      amount: scaleIngredientAmount(ing.amount, recipe.servings, servings),
    }));
    addIngredientsToShoppingList(scaledIngredients, recipe.title, excludePantry, listId);
    const listName = shoppingLists.find((l) => l.id === listId)?.name;
    setAddedToListId(listId);
    setShoppingToast(listName ? `Tillagt i ${listName}` : 'Tillagt i inköpslistan');
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

  // The photo with the name and the cart. Full width at the top on a phone; on a wide screen it
  // sits in the left column above the ingredients, with the steps beside it.
  const renderCover = (className: string) => (
    <div
      className={`relative w-full overflow-hidden shrink-0 ${hasCoverImage(recipe.coverImageUrl) ? 'cursor-zoom-in' : ''} ${className}`}
      onClick={() => hasCoverImage(recipe.coverImageUrl) && setShowPhoto(true)}
    >
      <FadeImage src={recipe.coverImageUrl} alt={recipe.title} className="absolute inset-0 w-full h-full object-cover" />
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
  );

  return (
    <div
      hidden={hidden}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-fade-in font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onBack();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={recipe.title}
    >
      <div
        className="bg-[#FCFAF5] w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-6xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E8E4DC] overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] lg:h-[90vh] transition-all relative"
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

          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="w-10 h-10 ml-2 mr-auto rounded-full bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-90 flex items-center justify-center text-stone-700 shadow-xs transition-all touch-manipulation cursor-pointer"
              aria-label="Minimera receptet"
              title="Minimera receptet"
            >
              <ChevronDown className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}

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
              aria-label="Dela receptet"
              title="Dela receptet"
            >
              {copiedRecently ? (
                <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
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
        {wakeLockToast && <Toast message={wakeLockToast} />}

        {/* Share Toast Notification */}
        {shareToast && <Toast message={shareToast} />}

        {/* Shopping Toast Notification */}
        {shoppingToast && (
          <Toast
            message={shoppingToast}
            actions={[
              {
                label: 'Visa listan',
                onClick: () => {
                  setActiveShoppingListId(addedToListId);
                  setShoppingToast(null);
                  onBack();
                  setActiveTab('shopping');
                },
              },
            ]}
          />
        )}

        {/* Scrollable Single-Column Body */}
        {/* Long words and web addresses without spaces break instead of running off the screen */}
        <div ref={scrollContainerRef} className="overflow-y-auto overflow-x-hidden flex-1 overscroll-contain [overflow-wrap:anywhere] lg:overflow-hidden lg:min-h-0 lg:flex lg:flex-col">
          {/* Cover image: full width on a phone */}
          {renderCover('aspect-16/10 lg:hidden')}

          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 lg:p-0 lg:space-y-0 lg:flex-1 lg:min-h-0">
            {/* Ingredients and instructions, side by side on wide screens, each column with its own scroll */}
            <div className="space-y-4 sm:space-y-5 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)] lg:h-full">
            <div data-scroll-column className="space-y-4 sm:space-y-5 lg:overflow-y-auto lg:overscroll-contain lg:p-5 lg:pr-4">
            {/* Cover image: in the left column on a wide screen */}
            {renderCover('hidden lg:block aspect-[4/3] rounded-2xl')}

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
        <div data-scroll-column className="space-y-5 lg:overflow-y-auto lg:overscroll-contain lg:p-5 lg:pl-6 lg:border-l lg:border-[#EBE7DF]">
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
                      {(() => {
                        // Each ingredient's amount is shown the first time it is named in the step
                        const seen = new Set<number>();
                        const mentions = (stepMentions[inst.stepNumber] || []).filter((m) => {
                          const fresh = m.ingredients.filter((i) => !seen.has(i));
                          fresh.forEach((i) => seen.add(i));
                          return fresh.length > 0;
                        });
                        let offset = 0;
                        return segments.map((seg, sIdx) => {
                          const segStart = offset;
                          offset += seg.text.length;
                          if (seg.timer) {
                            return (
                              <span key={sIdx} className={isStepDone ? '' : 'font-semibold text-stone-900'}>
                                {seg.text}
                              </span>
                            );
                          }
                          // Plain text, with the ingredients and their amounts marked out
                          const parts: React.ReactNode[] = [];
                          let pos = segStart;
                          for (const m of mentions) {
                            if (m.start < pos || m.end > offset) continue;
                            if (m.start > pos) parts.push(inst.text.slice(pos, m.start));
                            parts.push(
                              <span key={`${inst.stepNumber}-${m.start}`} className={isStepDone ? '' : 'font-bold text-[#284235]'}>
                                {inst.text.slice(m.start, m.end)}
                                {mentionAmount(m.ingredients) && (
                                  <span> ({mentionAmount(m.ingredients)})</span>
                                )}
                              </span>
                            );
                            pos = m.end;
                          }
                          if (pos < offset) parts.push(inst.text.slice(pos, offset));
                          return <React.Fragment key={sIdx}>{parts}</React.Fragment>;
                        });
                      })()}

                      {!isStepDone && stepTimers(segments).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4">
                          {stepTimers(segments).map((t) =>
                            t.maxMinutes ? (
                              <RangeTimer key={`${t.minutes}-${t.maxMinutes}`} min={t.minutes} max={t.maxMinutes} label={t.label} onStart={handleStartInlineTimer} />
                            ) : (
                            <button
                              key={t.minutes}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartInlineTimer(t.minutes, t.label);
                              }}
                              className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-semibold text-[#284235] touch-manipulation"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              Starta timer {shortDuration(t.minutes)}
                            </button>
                            )
                          )}
                        </div>
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

          {showNotesSavedToast && <Toast message="Anteckningen är sparad för hela hushållet" />}
        </div>

        {/* Nutrition, a row that opens and closes */}
        <NutritionPanel recipe={recipe} servings={servings} />

        {/* Quick Add to Meal Plan & Edit Recipe Footer Actions */}
        <div className="pt-2 space-y-2.5 w-full">
          <button
            type="button"
            onClick={handleImageShoppingClick}
            className="w-full py-4 px-4 rounded-2xl bg-[#284235] hover:bg-black active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all touch-manipulation"
            style={{ minHeight: '54px' }}
          >
            <span>{addedToCart ? 'Tillagt i inköpslistan' : 'Lägg till i inköpslistan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMealPlanPicker(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-[0.98] text-stone-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation shadow-xs"
            style={{ minHeight: '48px' }}
          >
            <span>Lägg till i planeraren</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingRecipe(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-[0.98] text-stone-800 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation"
            style={{ minHeight: '48px' }}
          >
            <span>Redigera receptet</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 active:scale-[0.98] text-rose-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all touch-manipulation"
            style={{ minHeight: '48px' }}
          >
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
              className="text-sm text-stone-500 hover:text-stone-800 inline-flex items-center gap-1.5 py-2 min-h-[44px] touch-manipulation truncate max-w-full"
            >
              <span className="min-w-0 truncate">Receptet kommer från {new URL(recipe.sourceUrl).hostname.replace(/^www\./, '')}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>
        )}
          </div>
          </div>
        </div>
      </div>

      {showPhoto && hasCoverImage(recipe.coverImageUrl) && (
        <PhotoViewer src={recipe.coverImageUrl} alt={formatRecipeTitle(recipe.title)} onClose={() => setShowPhoto(false)} />
      )}

      {/* Ask whether pantry staples should be included */}
      {showPantryChoice && (
        <PantryChoiceDialog
          recipe={recipe}
          onChoose={(skipPantryStaples, listId) => {
            setShowPantryChoice(false);
            handleAddToShoppingList(skipPantryStaples, listId);
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
                Lägg till i planeraren
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

      {/* The running kitchen timer */}
      {!hidden && <TimerBar />}

      {showShareSheet && (
        <ShareRecipeSheet
          recipe={recipe}
          servings={servings}
          onClose={() => setShowShareSheet(false)}
          onDone={handleShareDone}
        />
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
