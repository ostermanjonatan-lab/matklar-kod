import React, { useEffect, useMemo, useState } from 'react';
import { Check, Circle, CheckCircle2 } from 'lucide-react';
import { AisleIcon } from './AisleIcon';
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

/** The amount as it is said in the store: no "1 st" for a single thing, and litre written out */
function amountOf(item: ShoppingItem): string {
  if (item.amount === null) return '';
  const unit = (item.unit || '').trim();
  if (item.amount === 1 && (unit === 'st' || unit === '')) return '';
  const shown = unit === 'l' ? 'liter' : formatUnit(item.unit, item.amount);
  return `${formatShoppingAmount(item.amount)} ${shown}`.trim();
}

/**
 * The shopping list alone, for the outer screen, in the store's aisle order and working like the
 * ordinary list: a ticked item is struck through and moves to the end of its aisle. Text is
 * large enough to tick off with a thumb. It looks like the rest of the app: the green bar at the
 * top, the aisles with their icons, rings to tick off. The screen is kept awake while it is open.
 */
export const CoverShoppingList: React.FC = () => {
  const { shoppingList, toggleShoppingItem } = useRecipes();

  const { aisleOrder, storeName } = useMemo(() => {
    const layouts = loadStoreLayouts();
    const active = layouts.find((l) => l.id === loadActiveStoreId()) || layouts[0];
    return {
      aisleOrder: active?.aisleOrder?.length ? active.aisleOrder : DEFAULT_AISLE_ORDER,
      storeName: active?.name || '',
    };
  }, []);

  // Keep the screen on between the shelves
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      try {
        lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
      } catch {
        // Not allowed (battery saving): the screen goes off as usual
      }
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      lock?.release().catch(() => {});
    };
  }, []);

  // Like the ordinary list: a ticked item stays in its aisle, struck through, below what is left
  const leftCount = shoppingList.filter((i) => !i.checked).length;

  // Everything, grouped by aisle in the order of the chosen store
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of shoppingList) {
      const aisle = item.aisle || 'Övrigt';
      map.set(aisle, [...(map.get(aisle) || []), item]);
    }
    const rank = (a: string) => {
      const i = aisleOrder.indexOf(a);
      return i === -1 ? aisleOrder.length : i;
    };
    return [...map.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([aisle, items]) => [aisle, [...items].sort((x, y) => Number(x.checked) - Number(y.checked))] as const);
  }, [shoppingList, aisleOrder]);

  const row = (item: ShoppingItem) => {
    const struck = item.checked;
    const amount = amountOf(item);
    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => toggleShoppingItem(item.id)}
          className="w-full flex items-center gap-3.5 py-3 text-left touch-manipulation"
          aria-pressed={item.checked}
        >
          {struck ? (
            <CheckCircle2 className="w-8 h-8 shrink-0 text-[#284235] fill-emerald-100" strokeWidth={2} />
          ) : (
            <Circle className="w-8 h-8 shrink-0 text-stone-400" strokeWidth={2} />
          )}
          <span className="flex-1 min-w-0">
            <span className={`block text-[24px] leading-tight ${struck ? 'line-through text-stone-400' : 'text-stone-900'}`}>
              {capitalizeFirst(formatIngredientName(item.name, item.amount, item.unit))}
            </span>
            {item.comment && (
              <span className={`block text-base leading-snug mt-0.5 ${struck ? 'text-stone-400' : 'text-amber-800'}`}>{item.comment}</span>
            )}
          </span>
          {amount && (
            <span className={`text-[20px] tabular-nums shrink-0 ${struck ? 'text-stone-400 line-through' : 'text-stone-600'}`}>{amount}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    // The outer screen has its cameras along the bottom, so the end of the list stays clear of them
    <div className="min-h-[100dvh] bg-[#FCFAF5] font-sans pb-20 overflow-x-clip">
      {/* What is left, always in sight: the same green bar as at the top of the app */}
      <header className="green-header sticky top-0 z-10 bg-[#284235]/85 backdrop-blur-xl backdrop-saturate-150 px-4 py-2.5 flex items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold text-white tabular-nums">
          {shoppingList.length === 0 ? 'Inköpslista' : leftCount === 0 ? 'Allt är köpt' : `${leftCount} kvar`}
        </h1>
        {storeName && <span className="text-base text-white/70 truncate min-w-0">{storeName}</span>}
      </header>

      <div className="px-4">
        {shoppingList.length === 0 ? (
          <p className="pt-6 text-xl text-stone-600">Listan är tom. Lägg till varor på telefonens stora skärm.</p>
        ) : (
          <>
            {groups.map(([aisle, items]) => {
              const remaining = items.filter((i) => !i.checked).length;
              return (
                <section key={aisle}>
                  <h2 className={`pt-5 pb-1 flex items-center gap-2 text-lg font-semibold ${remaining === 0 ? 'text-stone-400' : 'text-stone-900'}`}>
                    <AisleIcon aisle={aisle} className={`w-5 h-5 ${remaining === 0 ? 'text-stone-300' : 'text-stone-500'}`} />
                    {aisle}
                    {remaining === 0 ? (
                      <Check className="w-5 h-5 text-[#284235]" aria-label="Klart" />
                    ) : (
                      <span className="text-base font-normal text-stone-400 tabular-nums">{remaining}</span>
                    )}
                  </h2>
                  <ul className="divide-y divide-[#EBE7DF]">{items.map(row)}</ul>
                </section>
              );
            })}

          </>
        )}
      </div>
    </div>
  );
};
