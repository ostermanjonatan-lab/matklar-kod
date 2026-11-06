import React, { useState, useRef, useEffect } from 'react';
import type { Recipe } from '../../types/recipe';
import { isRecipeNew } from '../../types/recipe';
import {
  X,
  Clock,
  ArrowRight,
  UtensilsCrossed,
  Salad,
  CakeSlice,
  CookingPot,
  CupSoda,
  Shuffle,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatCookingTime, formatRecipeTitle } from '../../utils/formatters';

interface RandomPickerModalProps {
  recipes: Recipe[];
  currentCategoryFilter?: string;
  initialMaxCookingTime?: number | null;
  onSelectRecipe: (recipe: Recipe) => void;
  onClose: () => void;
  /** Start rolling in this category straight away, without the question step */
  startCategory?: string;
  /** Text on the main button, default "Öppna receptet" */
  confirmLabel?: string;
  /** Heading while rolling, default "Slumpar <kategori>" */
  title?: string;
  /** Recipes to avoid as long as there are others, e.g. those already planned this week */
  avoidIds?: string[];
  /** Hide "Byt kategori", for when only one category makes sense */
  hideCategorySwitch?: boolean;
}

interface CategoryOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const COOKING_TIME_OPTIONS = [
  { label: 'Alla tider', value: null },
  { label: '≤ 20 min', value: 20 },
  { label: '≤ 30 min', value: 30 },
  { label: '≤ 45 min', value: 45 },
  { label: '≤ 60 min', value: 60 },
];

function getRecipeCookingTime(recipe: Recipe): number {
  if (typeof recipe.cookTimeMinutes === 'number' && recipe.cookTimeMinutes > 0) {
    return recipe.cookTimeMinutes;
  }
  if (typeof recipe.prepTimeMinutes === 'number' && recipe.prepTimeMinutes > 0) {
    return recipe.prepTimeMinutes;
  }
  return 0;
}

function matchesCookingTime(recipe: Recipe, maxTime: number | null): boolean {
  if (maxTime === null) return true;
  const time = getRecipeCookingTime(recipe);
  return time > 0 && time <= maxTime;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'Middag',
    title: 'Middag',
    subtitle: 'Pasta, ris, kött, fisk & vegetariskt',
    icon: <UtensilsCrossed className="w-5 h-5 text-[#284235]" />,
  },
  {
    id: 'Förrätt',
    title: 'Förrätt',
    subtitle: 'Smårätter, soppor & plockmat',
    icon: <Salad className="w-5 h-5 text-amber-800" />,
  },
  {
    id: 'Efterrätt',
    title: 'Efterrätt',
    subtitle: 'Bakverk, pajer, tårtor & desserter',
    icon: <CakeSlice className="w-5 h-5 text-rose-800" />,
  },
  {
    id: 'Såser',
    title: 'Såser',
    subtitle: 'Kalla & varma såser, röror & dressingar',
    icon: <CookingPot className="w-5 h-5 text-amber-900" />,
  },
  {
    id: 'Dryck',
    title: 'Dryck',
    subtitle: 'Smoothies, drinkar & måltidsdryck',
    icon: <CupSoda className="w-5 h-5 text-blue-800" />,
  },
  {
    id: 'Alla',
    title: 'Alla kategorier',
    subtitle: 'Överraska mig med vad som helst',
    icon: <Shuffle className="w-5 h-5 text-stone-700" />,
  },
];

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const RandomPickerModal: React.FC<RandomPickerModalProps> = ({
  recipes,
  currentCategoryFilter,
  initialMaxCookingTime,
  onSelectRecipe,
  onClose,
  startCategory,
  confirmLabel = 'Öppna receptet',
  title,
  avoidIds = [],
  hideCategorySwitch = false,
}) => {
  const [step, setStep] = useState<'question' | 'result'>(startCategory ? 'result' : 'question');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => startCategory || (currentCategoryFilter && currentCategoryFilter !== 'Alla' ? currentCategoryFilter : 'Middag')
  );
  const [maxCookingTime, setMaxCookingTime] = useState<number | null>(initialMaxCookingTime ?? null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [displayedRecipe, setDisplayedRecipe] = useState<Recipe | null>(null);
  const [showResetNotice, setShowResetNotice] = useState<boolean>(false);

  // In-memory seen IDs for the current randomizing session only (cleared when exiting to main menu)
  const [seenRecipeIds, setSeenRecipeIds] = useState<string[]>([]);

  const rollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any running timers when unmounting, and clear any legacy sessionStorage
  useEffect(() => {
    try {
      sessionStorage.removeItem('receptapp_random_seen_ids');
    } catch {
      // ignore
    }
    return () => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      try {
        sessionStorage.removeItem('receptapp_random_seen_ids');
      } catch {
        // ignore
      }
    };
  }, []);

  const getPool = (category: string, timeLimit: number | null = maxCookingTime) => {
    return recipes.filter((r) => {
      const matchCat = category === 'Alla' || (r.category || '').toLowerCase() === category.toLowerCase();
      if (!matchCat) return false;
      return matchesCookingTime(r, timeLimit);
    });
  };

  const pool = getPool(selectedCategory, maxCookingTime);

  // Not yet shown and not to be avoided; then not yet shown; otherwise nothing (time to start over)
  const pickFresh = (activePool: Recipe[], seen: string[]) => {
    const fresh = activePool.filter((r) => !seen.includes(r.id) && !avoidIds.includes(r.id));
    if (fresh.length > 0) return getRandomItem(fresh);
    const unseen = activePool.filter((r) => !seen.includes(r.id));
    return unseen.length > 0 ? getRandomItem(unseen) : null;
  };
  const seenCountInPool = pool.filter((r) => seenRecipeIds.includes(r.id)).length;

  const handleResetCategorySeen = () => {
    if (isRolling) return;
    const nextSeen = displayedRecipe ? [displayedRecipe.id] : [];
    setSeenRecipeIds(nextSeen);
    setShowResetNotice(false);
  };

  const handleTimeFilterChangeInResult = (newTime: number | null) => {
    if (isRolling) return;
    setMaxCookingTime(newTime);
    const newPool = getPool(selectedCategory, newTime);
    if (newPool.length === 0) {
      setDisplayedRecipe(null);
      return;
    }
    // If currently displayed recipe does not match the newly selected time limit, roll a new one
    if (!displayedRecipe || !matchesCookingTime(displayedRecipe, newTime)) {
      startRoll(selectedCategory, newTime);
    }
  };

  const startRoll = (category: string, timeLimit: number | null = maxCookingTime) => {
    if (isRolling) return;
    if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    setShowResetNotice(false);

    setSelectedCategory(category);
    setStep('result');

    const activePool = getPool(category, timeLimit);
    if (activePool.length === 0) {
      setDisplayedRecipe(null);
      setIsRolling(false);
      return;
    }

    // Always start fresh for this roll session
    const target = pickFresh(activePool, []) || getRandomItem(activePool);
    const nextSeen = [target.id];

    if (activePool.length === 1) {
      setDisplayedRecipe(target);
      setSeenRecipeIds(nextSeen);
      setIsRolling(false);
      return;
    }

    setIsRolling(true);
    let counter = 0;
    const totalTicks = 16;
    rollTimerRef.current = setInterval(() => {
      counter++;
      if (counter >= totalTicks) {
        if (rollTimerRef.current) clearInterval(rollTimerRef.current);
        setDisplayedRecipe(target);
        setSeenRecipeIds(nextSeen);
        setIsRolling(false);

        // Confetti celebration
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }
      } else {
        setDisplayedRecipe(getRandomItem(activePool));
      }
    }, 90);
  };

  const handleReroll = () => {
    if (isRolling || pool.length <= 1) return;
    if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    setShowResetNotice(false);

    // 1. Determine target from recipes in the pool that have not been shown yet
    const fresh = pickFresh(pool, seenRecipeIds);
    let target: Recipe;
    let nextSeen: string[];
    let cycledAll = false;

    if (fresh) {
      target = fresh;
      nextSeen = [...seenRecipeIds, target.id];
    } else {
      // All recipes in pool have been seen!
      // Restart cycle, but exclude the currently displayed recipe so we don't repeat it immediately
      const resetCandidates = pool.filter((r) => r.id !== displayedRecipe?.id);
      const validCandidates = resetCandidates.length > 0 ? resetCandidates : pool;
      target = getRandomItem(validCandidates);

      const otherSeen = seenRecipeIds.filter((id) => !pool.some((r) => r.id === id));
      nextSeen = [...otherSeen, target.id];
      cycledAll = true;
    }

    setIsRolling(true);
    let counter = 0;
    const totalTicks = 14;

    rollTimerRef.current = setInterval(() => {
      counter++;
      if (counter >= totalTicks) {
        if (rollTimerRef.current) clearInterval(rollTimerRef.current);
        setDisplayedRecipe(target);
        setSeenRecipeIds(nextSeen);
        setIsRolling(false);

        if (cycledAll) {
          setShowResetNotice(true);
          if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
          noticeTimerRef.current = setTimeout(() => {
            setShowResetNotice(false);
          }, 3500);
        }
      } else {
        // Fast reel flip during the roll - try to avoid current recipe if possible
        const spinCandidates = pool.filter((r) => r.id !== displayedRecipe?.id);
        const candidates = spinCandidates.length > 0 ? spinCandidates : pool;
        setDisplayedRecipe(getRandomItem(candidates));
      }
    }, 80);
  };

  // Opened with a category: roll at once. The cleanup stops the roll if the view is taken down,
  // and a remount (React in development) starts it again.
  useEffect(() => {
    if (!startCategory) return;
    startRoll(startCategory, maxCookingTime);
    return () => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white w-full max-w-md sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#FCFAF5] border-b border-[#EBE7DF] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-900 leading-tight">
              {step === 'question' ? 'Vad vill du slumpa?' : title || `Slumpar ${selectedCategory}`}
            </h3>
            {step === 'question' ? (
              <p className="text-xs text-stone-500">
                {maxCookingTime ? `Välj kategori (≤ ${maxCookingTime} min)` : 'Välj kategori nedan'}
              </p>
            ) : (
              <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                <span>
                  {seenCountInPool} av {pool.length} visade
                  {maxCookingTime ? ` (≤ ${maxCookingTime} min)` : ''}
                </span>
                {seenCountInPool > 1 && (
                  <>
                    <span className="text-stone-300">•</span>
                    <button
                      type="button"
                      onClick={handleResetCategorySeen}
                      disabled={isRolling}
                      className="text-[#284235] hover:text-stone-900 underline font-semibold transition-colors touch-manipulation cursor-pointer disabled:opacity-40"
                      title="Börja om urvalet för denna kategori"
                    >
                      Börja om
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] text-stone-600 hover:text-black flex items-center justify-center touch-manipulation shadow-xs"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CATEGORY SELECTION */}
        {step === 'question' && (
          <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs animate-fade-in">
            {/* Cooking Time Filter */}
            <div className="bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-stone-700 font-semibold text-xs">
                  <Clock className="w-3.5 h-3.5 text-[#284235]" />
                  <span>Max tillagningstid</span>
                </div>
                {maxCookingTime !== null && (
                  <button
                    type="button"
                    onClick={() => setMaxCookingTime(null)}
                    className="text-[11px] text-[#284235] hover:underline font-semibold cursor-pointer touch-manipulation"
                  >
                    Återställ
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                {COOKING_TIME_OPTIONS.map((opt) => {
                  const isSelected = maxCookingTime === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setMaxCookingTime(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all touch-manipulation cursor-pointer ${
                        isSelected
                          ? 'bg-[#284235] text-white shadow-2xs'
                          : 'bg-white border border-[#EBE7DF] text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories list */}
            <div className="space-y-2.5">
              {CATEGORY_OPTIONS.map((opt) => {
                const count = getPool(opt.id, maxCookingTime).length;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => startRoll(opt.id, maxCookingTime)}
                    className="w-full p-4 rounded-3xl border border-[#EBE7DF] hover:border-[#284235] hover:bg-[#FCFAF5] active:scale-[0.98] transition-all flex items-center justify-between text-left shadow-xs touch-manipulation min-h-[64px]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF] flex items-center justify-center shrink-0">
                        {opt.icon}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif font-bold text-base text-stone-900 leading-tight">
                            {formatRecipeTitle(opt.title)}
                          </span>
                          <span className="text-[10px] bg-[#FCFAF5] text-stone-600 font-semibold px-2 py-0.5 rounded-full border border-[#EBE7DF] whitespace-nowrap shrink-0">
                            {count} st
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500 block mt-0.5">
                          {opt.subtitle}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-stone-400 shrink-0 ml-2" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: RESULT VIEW */}
        {step === 'result' && (
          <div className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs animate-fade-in">
            {/* Quick time filter bar */}
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <div className="flex items-center gap-1 text-stone-500 text-[11px] font-semibold shrink-0 mr-0.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>Tid:</span>
              </div>
              {COOKING_TIME_OPTIONS.map((opt) => {
                const isSelected = maxCookingTime === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={isRolling}
                    onClick={() => handleTimeFilterChangeInResult(opt.value)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-all touch-manipulation cursor-pointer disabled:opacity-50 ${
                      isSelected
                        ? 'bg-[#284235] text-white shadow-2xs'
                        : 'bg-[#FCFAF5] border border-[#EBE7DF] text-stone-600 hover:border-stone-400 hover:bg-stone-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {pool.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm font-semibold text-stone-800">
                  Inga recept i {selectedCategory === 'Alla' ? 'urvalet' : `kategorin "${selectedCategory}"`} {maxCookingTime ? `under ${maxCookingTime} minuter` : ''}.
                </p>
                <div className="flex gap-2 justify-center">
                  {maxCookingTime !== null && (
                    <button
                      type="button"
                      onClick={() => handleTimeFilterChangeInResult(null)}
                      className="px-4 py-2.5 bg-[#284235] text-white rounded-xl font-bold text-xs"
                    >
                      Visa alla tider
                    </button>
                  )}
                  {!hideCategorySwitch && (
                    <button
                      type="button"
                      onClick={() => setStep('question')}
                      className="px-4 py-2.5 bg-stone-100 text-stone-800 rounded-xl font-bold text-xs"
                    >
                      Välj en annan kategori
                    </button>
                  )}
                </div>
              </div>
            ) : (
              displayedRecipe && (
                <div className="space-y-4">
                  {showResetNotice && (
                    <div className="bg-[#284235] text-white text-xs px-3.5 py-2.5 rounded-2xl text-center font-medium shadow-md animate-fade-in flex items-center justify-center gap-2">
                      <span>Alla {pool.length} recept har visats, nu börjar det om</span>
                    </div>
                  )}

                  {/* Result Recipe Card */}
                  <div
                    onClick={() => {
                      if (!isRolling) {
                        onSelectRecipe(displayedRecipe);
                        onClose();
                      }
                    }}
                    className={`bg-white rounded-3xl border border-[#EBE7DF] shadow-md overflow-hidden cursor-pointer transition-all ${
                      isRolling ? 'scale-[0.98] opacity-75' : 'hover:border-[#284235]'
                    }`}
                  >
                    <div className="relative aspect-16/10 w-full bg-stone-100">
                      <img
                        src={displayedRecipe.coverImageUrl}
                        alt={displayedRecipe.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <span className="bg-white/95 text-stone-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1 inline-block">
                          {displayedRecipe.category}
                        </span>
                        <h4 className="font-serif font-bold text-lg sm:text-xl leading-snug drop-shadow-md">
                          {formatRecipeTitle(displayedRecipe.title)}
                        </h4>
                      </div>
                    </div>

                    <div className="p-4 flex items-center justify-between text-stone-600 text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>{formatCookingTime(displayedRecipe.prepTimeMinutes, displayedRecipe.cookTimeMinutes)}</span>
                      </div>

                      {isRecipeNew(displayedRecipe) && (
                        <span className="font-semibold text-emerald-700">Ny</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={isRolling}
                      onClick={() => {
                        onSelectRecipe(displayedRecipe);
                        onClose();
                      }}
                      className="w-full py-4 bg-[#284235] hover:bg-black active:scale-95 text-white font-bold text-sm rounded-2xl shadow-md transition-all touch-manipulation flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ minHeight: '52px' }}
                    >
                      <span>{confirmLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className={`grid gap-2 ${hideCategorySwitch ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      <button
                        type="button"
                        disabled={isRolling || pool.length <= 1}
                        onClick={handleReroll}
                        className="py-3 px-3 rounded-2xl bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-95 text-stone-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all touch-manipulation min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                        title={pool.length <= 1 ? 'Endast ett recept finns i denna kategori' : 'Slumpa ett annat recept'}
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRolling ? 'animate-spin' : ''}`} />
                        <span>Slumpa igen</span>
                      </button>

                      {!hideCategorySwitch && (
                      <button
                        type="button"
                        onClick={() => {
                          if (rollTimerRef.current) clearInterval(rollTimerRef.current);
                          setIsRolling(false);
                          setShowResetNotice(false);
                          setSeenRecipeIds([]);
                          setDisplayedRecipe(null);
                          setStep('question');
                        }}
                        className="py-3 px-3 rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF] hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center justify-center transition-all touch-manipulation min-h-[44px]"
                      >
                        <span>Byt kategori</span>
                      </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};
