import React, { useMemo, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useRecipes } from '../../context/RecipeContext';
import { ConfirmSheet } from '../layout/ConfirmSheet';

/** The name shown for the main shopping list */
export const MAIN_LIST_NAME = 'Inköpslista';

/**
 * Choose which shopping list Inköp shows, make a new one, rename the open one, or remove one
 * with the bin on its row.
 * No field is focused when it opens, so the keyboard stays down until a field is tapped.
 */
export const ShoppingListsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    allShoppingItems,
    shoppingLists,
    activeShoppingListId,
    setActiveShoppingListId,
    createShoppingList,
    renameShoppingList,
    deleteShoppingList,
  } = useRecipes();

  const [newName, setNewName] = useState('');
  const activeList = shoppingLists.find((l) => l.id === activeShoppingListId) || null;
  const [renameText, setRenameText] = useState<string | null>(null);
  // The list about to be removed, asked about first
  const [listToDelete, setListToDelete] = useState<{ id: string; name: string } | null>(null);

  // Items left to buy in each list
  const remaining = useMemo(() => {
    const counts = new Map<string, number>();
    allShoppingItems.forEach((item) => {
      if (item.checked) return;
      const key = item.listId || '';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [allShoppingItems]);

  const open = (id: string | null) => {
    setActiveShoppingListId(id);
    onClose();
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createShoppingList(newName);
    onClose();
  };

  const saveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !renameText?.trim()) return;
    renameShoppingList(activeList.id, renameText);
    setRenameText(null);
  };

  const rows: { id: string | null; name: string }[] = [
    { id: null, name: MAIN_LIST_NAME },
    ...shoppingLists.map((l) => ({ id: l.id, name: l.name })),
  ];

  const field =
    'flex-1 min-w-0 h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl px-3 text-base sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]';

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in font-sans"
        role="dialog"
        aria-modal="true"
        aria-label="Listor"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl animate-scale-up max-h-[85vh] overflow-y-auto"
        >
          <h3 className="font-serif font-bold text-lg text-stone-900 mb-2">Listor</h3>

          <div className="divide-y divide-[#EBE7DF] -mx-1">
            {rows.map((row) => {
              const isActive = (row.id || null) === (activeList?.id || null);
              const count = remaining.get(row.id || '') || 0;
              const listId = row.id;
              return (
                <div key={listId || 'main'} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => open(listId)}
                    className="flex-1 min-w-0 min-h-[48px] px-1 flex items-center gap-3 text-left text-sm touch-manipulation active:bg-stone-100"
                    aria-current={isActive}
                  >
                    <span className={`flex-1 min-w-0 truncate ${isActive ? 'font-semibold text-stone-900' : 'text-stone-800'}`}>
                      {row.name}
                    </span>
                    <span className="text-xs text-stone-500 tabular-nums shrink-0">
                      {count === 0 ? 'Tom' : `${count} kvar`}
                    </span>
                    <span className="w-4 shrink-0">{isActive && <Check className="w-4 h-4 text-[#284235]" />}</span>
                  </button>
                  {/* The main list can't be removed, only emptied */}
                  {listId ? (
                    <button
                      type="button"
                      onClick={() => setListToDelete({ id: listId, name: row.name })}
                      className="w-11 h-11 -mr-1 flex items-center justify-center text-stone-400 hover:text-rose-700 active:text-rose-700 touch-manipulation shrink-0"
                      aria-label={`Ta bort ${row.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="w-11 -mr-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={create} className="flex gap-2 pt-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Namn på ny lista"
              aria-label="Namn på ny lista"
              className={field}
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="h-11 px-4 rounded-xl bg-[#284235] hover:bg-black text-white text-sm font-semibold flex items-center gap-1.5 touch-manipulation disabled:opacity-40 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Skapa lista
            </button>
          </form>

          {activeList && (
            <div className="mt-4 pt-3 border-t border-[#EBE7DF]">
              {renameText !== null ? (
                <form onSubmit={saveRename} className="flex gap-2">
                  <input
                    type="text"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    aria-label="Nytt namn på listan"
                    className={field}
                  />
                  <button
                    type="submit"
                    disabled={!renameText.trim()}
                    className="h-11 px-4 rounded-xl bg-[#284235] hover:bg-black text-white text-sm font-semibold touch-manipulation disabled:opacity-40 shrink-0"
                  >
                    Spara namn
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setRenameText(activeList.name)}
                  className="min-h-[40px] text-sm font-semibold text-stone-700 touch-manipulation"
                >
                  Byt namn på {activeList.name}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {listToDelete && (
        <ConfirmSheet
          title={`Ta bort ${listToDelete.name}?`}
          text="Listan och varorna i den tas bort för alla i hushållet."
          confirmLabel="Ta bort listan"
          onCancel={() => setListToDelete(null)}
          onConfirm={() => {
            deleteShoppingList(listToDelete.id);
            setListToDelete(null);
          }}
        />
      )}
    </>
  );
};
