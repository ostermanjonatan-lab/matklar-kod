import React from 'react';
import { X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { capitalizeFirst, formatRecipeTitle } from '../../utils/formatters';

/** Whether adding the recipe needs a choice about pantry staples at all. */
export function hasPantryStaples(recipe: Recipe): boolean {
  return (recipe.ingredients || []).some((ing) => ing.isPantryStaple);
}

/** The things a staple is, by their last word: "Salt och peppar" -> salt, peppar. */
export function stapleKeys(name: string): string[] {
  const core = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    // What it is for does not matter here: "Salt till pastavattnet", "Peppar efter smak"
    .split(/\s(?:till|efter|att|för|på|i)\s/)[0];
  return core
    .split(/\s+och\s+|\s+eller\s+|\s*[&+/,]\s*/)
    .map((part) => part.trim().split(/\s+/).pop() || '')
    .filter((w) => w.length >= 3);
}

const sameStaple = (a: string, b: string) => a === b || a.endsWith(b) || b.endsWith(a);

/**
 * Each staple once: "Salt" is left out when "Salt och peppar" is there too, and
 * "Nymalen svartpeppar" is covered by "peppar". Kept in the recipe's order.
 */
export function uniqueStaples(names: string[]): string[] {
  const items = names.map((name, index) => ({ name, index, keys: stapleKeys(name) }));
  const covered: string[] = [];
  const kept = new Set<number>();
  // Names that cover more come first, so "Salt och peppar" wins over "Salt"
  for (const item of [...items].sort((a, b) => b.keys.length - a.keys.length || a.index - b.index)) {
    const fresh = item.keys.filter((k) => !covered.some((c) => sameStaple(c, k)));
    if (fresh.length > 0 || item.keys.length === 0) {
      kept.add(item.index);
      covered.push(...item.keys);
    }
  }
  return items.filter((i) => kept.has(i.index)).map((i) => i.name);
}

interface PantryChoiceDialogProps {
  recipe: Recipe;
  onChoose: (skipPantryStaples: boolean) => void;
  onClose: () => void;
}

export const PantryChoiceDialog: React.FC<PantryChoiceDialogProps> = ({ recipe, onChoose, onClose }) => {
  const staples = uniqueStaples(recipe.ingredients.filter((ing) => ing.isPantryStaple).map((ing) => ing.name));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Har du det här hemma?"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white border border-[#EBE7DF] rounded-3xl p-5 max-w-sm w-full shadow-xl space-y-4 animate-scale-up">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 touch-manipulation"
          aria-label="Avbryt"
          title="Avbryt"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="font-serif font-bold text-lg text-stone-900 pr-8">
          Har du det här hemma?
        </h3>

        <ul className="max-h-40 overflow-y-auto space-y-1 text-sm font-medium text-stone-800">
          {staples.map((name) => (
            <li key={name}>{capitalizeFirst(name)}</li>
          ))}
        </ul>

        <p className="text-xs text-stone-500">
          Resten av {formatRecipeTitle(recipe.title) || 'receptet'} läggs i inköpslistan.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChoose(false)}
            className="py-3 px-2 bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] active:scale-95 text-stone-800 font-semibold rounded-2xl text-sm touch-manipulation min-h-[48px] transition-all"
          >
            Köp det också
          </button>
          <button
            type="button"
            onClick={() => onChoose(true)}
            className="py-3 px-2 bg-[#284235] hover:bg-black active:scale-95 text-white font-bold rounded-2xl text-sm touch-manipulation min-h-[48px] shadow-sm transition-all"
          >
            Har det hemma
          </button>
        </div>
      </div>
    </div>
  );
};
