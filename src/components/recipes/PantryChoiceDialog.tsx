import React from 'react';
import { X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { capitalizeFirst } from '../../utils/formatters';

/** Whether adding the recipe needs a choice about pantry staples at all. */
export function hasPantryStaples(recipe: Recipe): boolean {
  return (recipe.ingredients || []).some((ing) => ing.isPantryStaple);
}

interface PantryChoiceDialogProps {
  recipe: Recipe;
  onChoose: (skipPantryStaples: boolean) => void;
  onClose: () => void;
}

export const PantryChoiceDialog: React.FC<PantryChoiceDialogProps> = ({ recipe, onChoose, onClose }) => {
  const staples = recipe.ingredients.filter((ing) => ing.isPantryStaple);

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
          {staples.map((ing, idx) => (
            <li key={idx}>{capitalizeFirst(ing.name)}</li>
          ))}
        </ul>

        <p className="text-xs text-stone-500">
          Resten av receptet läggs i inköpslistan.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChoose(true)}
            className="py-3 px-2 bg-[#284235] hover:bg-black active:scale-95 text-white font-bold rounded-2xl text-sm touch-manipulation min-h-[48px] shadow-sm transition-all"
          >
            Ja
          </button>
          <button
            type="button"
            onClick={() => onChoose(false)}
            className="py-3 px-2 bg-[#FCFAF5] hover:bg-stone-100 border border-[#EBE7DF] active:scale-95 text-stone-800 font-semibold rounded-2xl text-sm touch-manipulation min-h-[48px] transition-all"
          >
            Nej, köp det också
          </button>
        </div>
      </div>
    </div>
  );
};
