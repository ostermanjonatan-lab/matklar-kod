import React, { useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTimer } from '../../context/TimerContext';
import { useRecipes } from '../../context/RecipeContext';
import { formatRecipeTitle } from '../../utils/formatters';

function formatTimerDisplay(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const ss = `${s < 10 ? '0' : ''}${s}`;
  return h > 0 ? `${h}:${m < 10 ? '0' : ''}${m}:${ss}` : `${m}:${ss}`;
}

/**
 * Above the menu a box's bottom edge follows the menu's arc, which rises about 12 px towards
 * the middle across the width of the box. The shape is drawn for the box's measured size.
 */
export function useCurvedShape(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [path, setPath] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const update = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const r = 16;
      const rise = 12;
      setPath(
        `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} ` +
          `Q ${w / 2} ${h - rise * 2} ${r} ${h} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [active]);
  return { ref, path };
}

/**
 * The running kitchen timer as one row. Above the menu a tap on the time opens its recipe.
 * The thin line shows how far the timer has gone.
 */
export const TimerRow: React.FC<{ inDock: boolean }> = ({ inDock }) => {
  const { timer, toggleTimer, restartTimer, clearTimer } = useTimer();
  const { recipes, openRecipeDetail } = useRecipes();
  if (!timer) return null;

  const done = timer.secondsLeft === 0;
  const recipe = inDock && timer.recipeId ? recipes.find((r) => r.id === timer.recipeId) : undefined;
  const caption = `Timer på ${timer.label}`;
  const elapsed = timer.totalSeconds > 0 ? 1 - timer.secondsLeft / timer.totalSeconds : 1;
  const textButton = 'min-h-[44px] px-3 text-sm font-semibold touch-manipulation';

  const progress = !done && (
    <div className="h-[3px] bg-stone-900/10">
      <div className="h-full bg-[#284235] transition-[width] duration-300 ease-linear" style={{ width: `${elapsed * 100}%` }} />
    </div>
  );

  return (
    <div className={done ? 'bg-[#284235]/90 text-white' : 'text-stone-900'} role="timer">
      {inDock && progress}
      <div className="flex items-center gap-2 pl-4 pr-1.5 py-2">
        <button
          type="button"
          onClick={() => recipe && openRecipeDetail(recipe)}
          disabled={!recipe}
          className="min-w-0 flex-1 text-left touch-manipulation"
          aria-label={recipe ? `Öppna ${formatRecipeTitle(recipe.title)}` : undefined}
        >
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="text-2xl font-semibold tabular-nums leading-tight shrink-0">
              {done ? 'Klart' : formatTimerDisplay(timer.secondsLeft)}
            </span>
            <span className={`text-sm truncate ${done ? 'text-emerald-100' : 'text-stone-500'}`}>
              {/* Above the menu only the time left counts, so the length is left out there */}
              {inDock
                ? !done && !timer.isRunning
                  ? 'Pausad'
                  : ''
                : !done && !timer.isRunning
                ? `Pausad · ${caption}`
                : caption}
            </span>
          </div>
        </button>

        {done ? (
          <button type="button" onClick={restartTimer} className={`${textButton} text-white`}>
            Igen
          </button>
        ) : (
          <button type="button" onClick={toggleTimer} className={`${textButton} text-[#284235]`}>
            {timer.isRunning ? 'Pausa' : 'Fortsätt'}
          </button>
        )}
        <button
          type="button"
          onClick={clearTimer}
          className={`w-11 h-11 rounded-full flex items-center justify-center touch-manipulation ${
            done ? 'text-emerald-100 hover:bg-white/10' : 'text-stone-400 hover:bg-stone-100'
          }`}
          aria-label="Stäng timer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {!inDock && progress}
    </div>
  );
};

/** The timer at the bottom of an open recipe. */
export const TimerBar: React.FC = () => {
  const { timer } = useTimer();
  if (!timer) return null;
  const done = timer.secondsLeft === 0;
  return (
    <div
      className="fixed left-4 right-4 max-w-md mx-auto bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-50"
    >
      <div
        className={`rounded-2xl overflow-hidden border animate-slide-up backdrop-blur-xl backdrop-saturate-150 shadow-[0_6px_16px_rgba(28,25,23,0.13)] ${
          done ? 'border-[#284235] bg-[#284235]/90' : 'border-[#EBE7DF] bg-white/80'
        }`}
      >
        <TimerRow inDock={false} />
      </div>
    </div>
  );
};
