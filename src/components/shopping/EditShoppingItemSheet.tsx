import React, { useState } from 'react';
import type { ShoppingItem } from '../../types/recipe';
import { usePrices, estimateCost } from '../../utils/prices';

/** The amount as it is written in Swedish: 1,5 rather than 1.5 */
function amountText(amount: number | null): string {
  return amount === null ? '' : String(Math.round(amount * 100) / 100).replace('.', ',');
}

/**
 * Change an item in the shopping list: its name, amount and unit. Opened from the item's menu.
 * No field is focused when it opens, so the keyboard stays down until a field is tapped.
 */
export const EditShoppingItemSheet: React.FC<{
  item: ShoppingItem;
  onSave: (changes: Pick<ShoppingItem, 'name' | 'amount' | 'unit'>) => void;
  onClose: () => void;
  /** Shows the price field, for the cost of the list */
  showCost?: boolean;
}> = ({ item, onSave, onClose, showCost = false }) => {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(amountText(item.amount));
  const [unit, setUnit] = useState(item.unit || '');
  const { prices, setPrice } = usePrices();
  const knownCost = estimateCost(prices, item);
  const initialPrice = knownCost === null ? '' : amountText(knownCost < 10 ? Math.round(knownCost * 10) / 10 : Math.round(knownCost));
  const [price, setPriceText] = useState(initialPrice);
  const parsedPrice = price.trim() === '' ? null : Number(price.trim().replace(',', '.'));
  const priceValid = parsedPrice === null || (Number.isFinite(parsedPrice) && parsedPrice >= 0);

  const parsedAmount = amount.trim() === '' ? null : Number(amount.trim().replace(',', '.'));
  const amountValid = parsedAmount === null || (Number.isFinite(parsedAmount) && parsedAmount > 0);
  const canSave = name.trim() !== '' && amountValid && priceValid;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const changes = { name: name.trim(), amount: parsedAmount, unit: unit.trim() };
    onSave(changes);
    // The price is for the amount as saved: 30 kr for 2 l
    if (showCost && price.trim() !== initialPrice) setPrice(changes, parsedPrice);
    onClose();
  };

  const field =
    'w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl px-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Ändra vara"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl space-y-4 animate-scale-up"
      >
        <h3 className="font-serif font-bold text-lg text-stone-900">Ändra vara</h3>

        <label className="block">
          <span className="text-xs text-stone-500">Vara</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
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

        {showCost && (
          <label className="block">
            <span className="text-xs text-stone-500">
              Pris, ungefär{parsedAmount !== null ? ` för ${amount.trim()} ${unit.trim()}`.trimEnd() : ''}
            </span>
            <div className="relative mt-1">
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="Vet inte"
                className={`${field} pr-10 ${priceValid ? '' : 'border-rose-300'}`}
                aria-invalid={!priceValid}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-500 pointer-events-none">kr</span>
            </div>
          </label>
        )}

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
            Spara vara
          </button>
        </div>
      </form>
    </div>
  );
};
