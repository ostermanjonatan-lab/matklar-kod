import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Circle, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { Toast } from '../layout/Toast';
import { SwipeToDelete } from './SwipeToDelete';
import { EditShoppingItemSheet } from './EditShoppingItemSheet';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
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
  const { activeShoppingList: shoppingList, activeShoppingListId, toggleShoppingItem, deleteShoppingItem, restoreShoppingList, updateShoppingItem } = useRecipes();

  // Removed by a swipe or from the menu: Ångra for a few seconds, as in the ordinary list
  const [removed, setRemoved] = useState<{ item: ShoppingItem; index: number } | null>(null);
  const removedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(removedTimer.current), []);
  const remove = (item: ShoppingItem) => {
    setRemoved({ item, index: shoppingList.findIndex((i) => i.id === item.id) });
    deleteShoppingItem(item.id);
    window.clearTimeout(removedTimer.current);
    removedTimer.current = window.setTimeout(() => setRemoved(null), 5000);
  };
  const undoRemove = () => {
    if (!removed) return;
    const list = shoppingList.filter((i) => i.id !== removed.item.id);
    list.splice(Math.min(Math.max(removed.index, 0), list.length), 0, removed.item);
    restoreShoppingList(list, activeShoppingListId);
    window.clearTimeout(removedTimer.current);
    setRemoved(null);
  };

  // Hold a row to open its menu, as in the ordinary list
  const [menuItem, setMenuItem] = useState<ShoppingItem | null>(null);
  const [editItem, setEditItem] = useState<ShoppingItem | null>(null);
  useModalBackHandler(Boolean(menuItem), () => setMenuItem(null), 'cover-item-menu');
  useModalBackHandler(Boolean(editItem), () => setEditItem(null), 'cover-edit-item');
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const pressFired = useRef(false);
  const cancelPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  };
  const startPress = (item: ShoppingItem, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelPress();
    pressFired.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      pressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(10);
      setMenuItem(item);
    }, 500);
  };
  const movePress = (e: React.PointerEvent) => {
    const st = pressStart.current;
    if (st && (Math.abs(e.clientX - st.x) > 8 || Math.abs(e.clientY - st.y) > 8)) cancelPress();
  };

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
        <SwipeToDelete onRemove={() => remove(item)}>
        <button
          type="button"
          onClick={() => {
            if (pressFired.current) {
              pressFired.current = false;
              return;
            }
            toggleShoppingItem(item.id);
          }}
          onPointerDown={(e) => startPress(item, e)}
          onPointerMove={movePress}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onContextMenu={(e) => {
            e.preventDefault();
            cancelPress();
            setMenuItem(item);
          }}
          className="w-full flex items-center gap-3.5 py-3 text-left touch-manipulation select-none [-webkit-touch-callout:none]"
          aria-pressed={item.checked}
        >
          {struck ? (
            <CheckCircle2 className="w-9 h-9 shrink-0 text-[#284235] fill-emerald-100" strokeWidth={2} />
          ) : (
            <Circle className="w-9 h-9 shrink-0 text-stone-400" strokeWidth={2} />
          )}
          <span className="flex-1 min-w-0">
            <span className={`block text-[29px] leading-tight ${struck ? 'line-through text-stone-400' : 'text-stone-900'}`}>
              {capitalizeFirst(formatIngredientName(item.name, item.amount, item.unit))}
            </span>
            {item.comment && (
              <span className={`block text-[19px] leading-snug mt-0.5 ${struck ? 'text-stone-400' : 'text-amber-800'}`}>{item.comment}</span>
            )}
          </span>
          {amount && (
            <span className={`text-[23px] tabular-nums shrink-0 ${struck ? 'text-stone-400 line-through' : 'text-stone-600'}`}>{amount}</span>
          )}
        </button>
        </SwipeToDelete>
      </li>
    );
  };

  return (
    // The outer screen has its cameras along the bottom, so the end of the list stays clear of them
    <div className="min-h-[100dvh] bg-[#FCFAF5] font-sans pb-20 overflow-x-clip">
      {/* What is left, always in sight: the same green bar as at the top of the app */}
      <header className="green-header sticky top-0 z-10 bg-[#284235]/75 backdrop-blur-md backdrop-saturate-150 px-4 py-2.5 flex items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-semibold text-white tabular-nums">
          {shoppingList.length === 0 ? 'Inköpslista' : leftCount === 0 ? 'Allt är köpt' : `${leftCount} kvar`}
        </h1>
        {storeName && <span className="text-lg text-white/70 truncate min-w-0">{storeName}</span>}
      </header>

      <div className="px-4">
        {shoppingList.length === 0 ? (
          <p className="pt-6 text-2xl text-stone-600">Listan är tom. Lägg till varor på telefonens stora skärm.</p>
        ) : (
          <>
            {groups.map(([aisle, items]) => {
              const remaining = items.filter((i) => !i.checked).length;
              return (
                <section key={aisle}>
                  <h2 className={`pt-5 pb-1 flex items-center gap-2 text-[21px] font-semibold ${remaining === 0 ? 'text-stone-400' : 'text-stone-900'}`}>
                    <AisleIcon aisle={aisle} className={`w-6 h-6 ${remaining === 0 ? 'text-stone-300' : 'text-stone-500'}`} />
                    {aisle}
                    {remaining === 0 ? (
                      <Check className="w-6 h-6 text-[#284235]" aria-label="Klart" />
                    ) : (
                      <span className="text-lg font-normal text-stone-400 tabular-nums">{remaining}</span>
                    )}
                  </h2>
                  <ul className="divide-y divide-[#EBE7DF]">{items.map(row)}</ul>
                </section>
              );
            })}

          </>
        )}
      </div>

      {menuItem && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in"
          role="dialog"
          aria-label={capitalizeFirst(menuItem.name)}
          onClick={() => setMenuItem(null)}
        >
          <div
            className="bg-white w-full rounded-t-3xl p-2 pb-16 shadow-xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-2 text-lg font-semibold text-stone-900 border-b border-[#EBE7DF]">
              {capitalizeFirst(menuItem.name)}
            </div>
            <button
              type="button"
              onClick={() => {
                const item = menuItem;
                setMenuItem(null);
                setTimeout(() => setEditItem(item), 120);
              }}
              className="w-full min-h-[56px] px-3 flex items-center gap-3 text-lg text-stone-800 rounded-2xl active:bg-stone-100 touch-manipulation"
            >
              <Pencil className="w-5 h-5 text-stone-500" />
              Ändra vara och mängd
            </button>
            <button
              type="button"
              onClick={() => {
                const item = menuItem;
                setMenuItem(null);
                remove(item);
              }}
              className="w-full min-h-[56px] px-3 flex items-center gap-3 text-lg text-rose-700 rounded-2xl active:bg-rose-50 touch-manipulation"
            >
              <Trash2 className="w-5 h-5" />
              Ta bort från listan
            </button>
          </div>
        </div>
      )}

      {editItem && (
        <EditShoppingItemSheet
          item={editItem}
          onSave={(changes) => updateShoppingItem(editItem.id, changes)}
          onClose={() => setEditItem(null)}
        />
      )}

      {removed && (
        <Toast
          message={`${capitalizeFirst(formatIngredientName(removed.item.name, removed.item.amount, removed.item.unit))} är borttagen`}
          actions={[{ label: 'Ångra', onClick: undoRemove }]}
          onDismiss={() => setRemoved(null)}
        />
      )}
    </div>
  );
};
