import React from 'react';
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
    placement === 'app' && timer.recipeTitle ? formatRecipeTitle(timer.recipeTitle) : `Timer på ${timer.label}`;

  const elapsed = timer.totalSeconds > 0 ? 1 - timer.secondsLeft / timer.totalSeconds : 1;
  const textButton = 'min-h-[44px] px-3 text-sm font-semibold touch-manipulation';

  return (
    <div
      className={`fixed left-4 right-4 max-w-md mx-auto rounded-2xl border overflow-hidden shadow-[0_6px_24px_rgba(28,25,23,0.12)] animate-slide-up ${
        done ? 'bg-[#284235] border-[#284235] text-white' : 'bg-white border-[#EBE7DF] text-stone-900'
      } ${
        placement === 'recipe'
          ? 'bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-50'
          : 'bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] z-30'
      }`}
      role="timer"
    >
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
              {done ? caption : !timer.isRunning ? `Pausad · ${caption}` : caption}
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

      {!done && (
        <div className="h-[3px] bg-stone-100">
          <div className="h-full bg-[#284235] transition-[width] duration-300 ease-linear" style={{ width: `${elapsed * 100}%` }} />
        </div>
      )}
    </div>
  );
};
