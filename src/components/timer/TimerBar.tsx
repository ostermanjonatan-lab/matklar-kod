import React from 'react';
import { Timer, Bell, Pause, Play, RotateCcw, X } from 'lucide-react';
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
 * The running kitchen timer. Inside a recipe it sits at the bottom of the screen. With the
 * recipe closed it sits above the menu and names the recipe; a tap on the name opens it.
 */
export const TimerBar: React.FC<{ placement: 'recipe' | 'app' }> = ({ placement }) => {
  const { timer, toggleTimer, restartTimer, clearTimer } = useTimer();
  const { recipes, openRecipeDetail } = useRecipes();
  if (!timer) return null;

  const done = timer.secondsLeft === 0;
  const recipe = placement === 'app' && timer.recipeId ? recipes.find((r) => r.id === timer.recipeId) : undefined;
  const caption =
    placement === 'app' && timer.recipeTitle ? formatRecipeTitle(timer.recipeTitle) : `Timer: ${timer.label}`;

  return (
    <div
      className={`fixed left-4 right-4 max-w-md mx-auto bg-stone-900 text-white rounded-3xl p-3.5 shadow-2xl border border-stone-700 flex items-center justify-between gap-3 animate-slide-up ${
        placement === 'recipe'
          ? 'bottom-6 z-50'
          : 'bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-30'
      }`}
    >
      <button
        type="button"
        onClick={() => recipe && openRecipeDetail(recipe)}
        disabled={!recipe}
        className="flex items-center gap-3 min-w-0 text-left touch-manipulation"
        aria-label={recipe ? `Öppna ${formatRecipeTitle(recipe.title)}` : undefined}
      >
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            done
              ? 'bg-rose-500 text-white animate-bounce'
              : timer.isRunning
              ? 'bg-amber-400 text-stone-950 font-bold'
              : 'bg-stone-800 text-stone-400'
          }`}
        >
          <Timer className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="text-[11px] text-stone-400 truncate">{caption}</div>
          <div className="text-lg font-bold font-mono tracking-wider text-amber-300 flex items-center gap-1.5">
            {done ? (
              <>
                <span>Klart</span>
                <Bell className="w-4 h-4 text-amber-300 animate-bounce shrink-0" />
              </>
            ) : (
              formatTimerDisplay(timer.secondsLeft)
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {!done ? (
          <button
            type="button"
            onClick={toggleTimer}
            className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition-all touch-manipulation"
            aria-label={timer.isRunning ? 'Pausa timer' : 'Starta timer'}
          >
            {timer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={restartTimer}
            className="px-3 h-10 rounded-2xl bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 active:scale-95 touch-manipulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Igen</span>
          </button>
        )}

        <button
          type="button"
          onClick={clearTimer}
          className="w-9 h-9 rounded-2xl bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center touch-manipulation"
          aria-label="Stäng timer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
