import React, { useState } from 'react';
import type { Ingredient } from '../../types/recipe';
import { capitalizeFirst, formatAmount, formatIngredientName, formatUnit } from '../../utils/formatters';

/** The amount as it is written in Swedish: 1,5 rather than 1.5 */
function amountText(amount: number | null): string {
  return amount === null ? '' : String(Math.round(amount * 100) / 100).replace('.', ',');
}

/**
 * Swap an ingredient for something else, without changing the recipe. Opened with an ingredient
 * already chosen (long press on its row), or without one, and then the ingredient is chosen first.
 * Amounts are shown for the servings chosen in the recipe. No field is focused when it opens.
 */
export const SwapIngredientSheet: React.FC<{
  /** The ingredients as shown, for the chosen servings, swaps included */
  ingredients: Ingredient[];
  /** The original names, to show what a row was swapped from */
  originals: Ingredient[];
  initialIndex: number | null;
  onSave: (index: number, replacement: { name: string; amount: number | null; unit: string }) => void;
  onClose: () => void;
}> = ({ ingredients, originals, initialIndex, onSave, onClose }) => {
  const [index, setIndex] = useState<number | null>(initialIndex);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(initialIndex === null ? '' : amountText(ingredients[initialIndex].amount));
  const [unit, setUnit] = useState(initialIndex === null ? '' : ingredients[initialIndex].unit || '');

  const choose = (i: number) => {
    setIndex(i);
    setAmount(amountText(ingredients[i].amount));
    setUnit(ingredients[i].unit || '');
  };

  const parsedAmount = amount.trim() === '' ? null : Number(amount.trim().replace(',', '.'));
  const amountValid = parsedAmount === null || (Number.isFinite(parsedAmount) && parsedAmount > 0);
  const canSave = index !== null && name.trim() !== '' && amountValid;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || index === null) return;
    onSave(index, { name: name.trim(), amount: parsedAmount, unit: unit.trim() });
    onClose();
  };

  const field =
    'w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl px-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';
  const originalName = index === null ? '' : originals[index].name;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Byt ut ingrediens"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl animate-scale-up max-h-[85vh] overflow-y-auto"
      >
        {index === null ? (
          <>
            <h3 className="font-serif font-bold text-lg text-stone-900 mb-2">Vilken vill du byta ut?</h3>
            <div className="divide-y divide-[#EBE7DF] -mx-1">
              {ingredients.map((ing, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => choose(i)}
                  className="w-full min-h-[46px] px-1 flex items-center gap-3 text-left text-sm touch-manipulation active:bg-stone-100"
                >
                  <span className="flex-1 min-w-0 text-stone-900">{capitalizeFirst(formatIngredientName(ing.name, ing.amount, ing.unit))}</span>
                  <span className="text-xs text-stone-500 tabular-nums shrink-0">
                    {`${formatAmount(ing.amount)} ${formatUnit(ing.unit, ing.amount)}`.trim()}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-3 min-h-[44px] rounded-2xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation"
            >
              Avbryt
            </button>
          </>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">Byt ut {originalName.toLowerCase()}</h3>
              <p className="text-xs text-stone-500 mt-1">Receptet ändras inte. Bytet gäller på den här telefonen tills du ångrar det.</p>
            </div>

            <label className="block">
              <span className="text-xs text-stone-500">I stället</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Till exempel havregrädde"
                className={`${field} mt-1`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-stone-500">Mängd</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ingen"
                  className={`${field} mt-1 ${amountValid ? '' : 'border-rose-300'}`}
                  aria-invalid={!amountValid}
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">Enhet</span>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="g, dl, st"
                  className={`${field} mt-1`}
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] rounded-2xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="flex-1 min-h-[44px] rounded-2xl bg-[#284235] hover:bg-black text-white text-sm font-semibold touch-manipulation disabled:opacity-40"
              >
                Byt ut
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
