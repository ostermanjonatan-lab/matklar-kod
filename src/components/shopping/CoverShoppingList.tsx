import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { ShoppingItem } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { capitalizeFirst, formatIngredientName, formatShoppingAmount, formatUnit } from '../../utils/formatters';
import { loadActiveStoreId, loadStoreLayouts, DEFAULT_AISLE_ORDER } from '../../utils/storeLayoutService';

/**
 * The outer screen of a folding phone, such as the Galaxy Z Flip 6, is a small, nearly square
 * touch screen. Ordinary phones are long and narrow both upright and lying down, and computers
 * have no touch screen, so neither is caught. The size limit is generous because Samsung scales
 * the outer screen differently from the main screen.
 */
const COVER_QUERY =
  '(pointer: coarse) and (max-width: 760px) and (max-height: 760px) and (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3)';

export function useCoverScreen(): boolean {
  const [cover, setCover] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(COVER_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(COVER_QUERY);
    if (!mq) return;
    const onChange = () => setCover(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return cover;
}

/**
 * The shopping list alone, for the outer screen: what is left to buy in the store's aisle order,
 * large enough to tick off with a thumb. Nothing else from the app is shown.
 */
export const CoverShoppingList: React.FC = () => {
  const { shoppingList, toggleShoppingItem } = useRecipes();
  const [showDone, setShowDone] = useState(false);

  const aisleOrder = useMemo(() => {
    const layouts = loadStoreLayouts();
    const active = layouts.find((l) => l.id === loadActiveStoreId()) || layouts[0];
    return active?.aisleOrder?.length ? active.aisleOrder : DEFAULT_AISLE_ORDER;
  }, []);

  const left = shoppingList.filter((i) => !i.checked);
  const done = shoppingList.filter((i) => i.checked);

  // What is left, grouped by aisle in the order of the chosen store
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of left) {
      const aisle = item.aisle || 'Övrigt';
      map.set(aisle, [...(map.get(aisle) || []), item]);
    }
    const rank = (a: string) => {
      const i = aisleOrder.indexOf(a);
      return i === -1 ? aisleOrder.length : i;
    };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [left, aisleOrder]);

  const amountOf = (item: ShoppingItem) =>
    item.amount !== null ? `${formatShoppingAmount(item.amount)} ${formatUnit(item.unit, item.amount)}`.trim() : '';

  const row = (item: ShoppingItem) => (
    <li key={item.id}>
      <button
        type="button"
        onClick={() => toggleShoppingItem(item.id)}
        className="w-full flex items-center gap-3 py-2.5 text-left touch-manipulation"
        aria-pressed={item.checked}
      >
        <span
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
            item.checked ? 'bg-[#284235] border-[#284235] text-white' : 'border-stone-300'
          }`}
        >
          {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
        </span>
        <span className={`flex-1 min-w-0 text-[17px] leading-snug ${item.checked ? 'line-through text-stone-400' : 'text-stone-900'}`}>
          {capitalizeFirst(formatIngredientName(item.name, item.amount, item.unit))}
        </span>
        {amountOf(item) && (
          <span className={`text-[15px] tabular-nums shrink-0 ${item.checked ? 'text-stone-400' : 'text-stone-500'}`}>
            {amountOf(item)}
          </span>
        )}
      </button>
    </li>
  );

  return (
    // The outer screen has its cameras along the bottom, so the end of the list stays clear of them
    <div className="min-h-[100dvh] bg-[#FCFAF5] font-sans px-4 pt-3 pb-20 overflow-x-hidden">
      <header className="flex items-baseline justify-between gap-3 pb-1">
        <h1 className="font-serif font-bold text-xl text-stone-900">Inköpslista</h1>
        <span className="text-sm text-stone-500 tabular-nums">
          {left.length === 0 ? 'Allt klart' : `${left.length} kvar`}
        </span>
      </header>

      {shoppingList.length === 0 ? (
        <p className="pt-6 text-base text-stone-600">Listan är tom. Lägg till varor på telefonens stora skärm.</p>
      ) : (
        <>
          {groups.map(([aisle, items]) => (
            <section key={aisle}>
              <h2 className="pt-3 pb-0.5 text-xs font-semibold text-stone-500">{aisle}</h2>
              <ul className="divide-y divide-[#EBE7DF] border-t border-[#EBE7DF]">{items.map(row)}</ul>
            </section>
          ))}

          {done.length > 0 && (
            <section className="pt-4">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="min-h-[40px] text-sm font-semibold text-[#284235] touch-manipulation"
                aria-expanded={showDone}
              >
                {showDone ? 'Dölj avbockade' : `Visa avbockade (${done.length})`}
              </button>
              {showDone && <ul className="divide-y divide-[#EBE7DF] border-t border-[#EBE7DF]">{done.map(row)}</ul>}
            </section>
          )}
        </>
      )}
    </div>
  );
};
