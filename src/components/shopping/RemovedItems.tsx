import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useRecipes } from '../../context/RecipeContext';
import { useRemovedItems, type RemovedItem } from '../../utils/removedItems';
import { capitalizeFirst, formatShoppingAmount, formatUnit, formatIngredientName } from '../../utils/formatters';

const nameOf = (r: RemovedItem) => capitalizeFirst(formatIngredientName(r.item.name, r.item.amount, r.item.unit));
const amountOf = (r: RemovedItem) => {
  const amount = formatShoppingAmount(r.item.amount);
  const unit = formatUnit(r.item.unit || '', r.item.amount).trim();
  return amount ? `${amount} ${unit}`.trim() : unit;
};
const timeOf = (r: RemovedItem) =>
  new Date(r.removedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
const inList = (r: RemovedItem, listId: string | null) => (r.item.listId || null) === listId;

/**
 * At the top of the list: items removed on another phone that have not been seen here, so
 * nothing disappears unnoticed. Stays until closed.
 */
export const RemovedNotice: React.FC<{ listId: string | null }> = ({ listId }) => {
  const { restoreRemovedShoppingItem } = useRecipes();
  const { removed, forget, markSeen } = useRemovedItems();
  const unseen = removed.filter((r) => r.byOther && !r.seen && inList(r, listId));
  if (unseen.length === 0) return null;

  const names = unseen.slice(0, 3).map(nameOf).join(', ');
  const text =
    unseen.length === 1
      ? `${nameOf(unseen[0])} togs bort på en annan telefon`
      : unseen.length <= 3
      ? `${names} togs bort på en annan telefon`
      : `${unseen.length} varor togs bort på en annan telefon`;

  return (
    <div className="flex items-start gap-3 border border-stone-300 rounded-2xl pl-4 pr-1.5 py-2.5 bg-white" role="status">
      <p className="flex-1 min-w-0 text-sm text-stone-800 py-1.5">{text}</p>
      <button
        type="button"
        onClick={() => {
          unseen.forEach((r) => {
            restoreRemovedShoppingItem(r.item);
            forget(r.removedAt, r.item.id);
          });
        }}
        className="shrink-0 min-h-[36px] px-2 text-sm font-semibold text-[#284235] touch-manipulation"
      >
        Lägg tillbaka
      </button>
      <button
        type="button"
        onClick={() => markSeen(unseen)}
        className="shrink-0 w-9 h-9 flex items-center justify-center text-stone-400 touch-manipulation"
        aria-label="Stäng"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/** At the end of the list: what has been removed in the last day, each with Lägg tillbaka */
export const RemovedList: React.FC<{ listId: string | null }> = ({ listId }) => {
  const { restoreRemovedShoppingItem } = useRecipes();
  const { removed, forget, markSeen } = useRemovedItems();
  const [open, setOpen] = useState(false);
  const here = removed.filter((r) => inList(r, listId));
  if (here.length === 0) return null;

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          markSeen(here);
        }}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between text-sm text-stone-600 touch-manipulation"
      >
        <span>Borttaget senaste dygnet ({here.length})</span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="divide-y divide-[#EBE7DF] border-t border-[#EBE7DF]">
          {here.map((r) => (
            <li key={`${r.item.id}-${r.removedAt}`} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-800 truncate">
                  {nameOf(r)}
                  {amountOf(r) && <span className="text-stone-500"> {amountOf(r)}</span>}
                </p>
                <p className="text-xs text-stone-500">
                  {timeOf(r)}, {r.byOther ? 'på en annan telefon' : 'här'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  restoreRemovedShoppingItem(r.item);
                  forget(r.removedAt, r.item.id);
                }}
                className="shrink-0 min-h-[40px] px-2 text-sm font-semibold text-[#284235] touch-manipulation"
              >
                Lägg tillbaka
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
