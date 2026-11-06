import React, { useState } from 'react';
import { X, ArrowUp, ArrowDown } from 'lucide-react';
import type { ShoppingItem } from '../../types/recipe';
import { ConfirmSheet } from '../layout/ConfirmSheet';
import { type StoreLayout, DEFAULT_AISLE_ORDER, reorderAisleByIndex } from '../../utils/storeLayoutService';

interface StoreOrderSheetProps {
  storeLayouts: StoreLayout[];
  activeStore: StoreLayout;
  /** Saves the stores after a change (new, renamed, removed or reordered). */
  onChangeLayouts: (layouts: StoreLayout[]) => void;
  onSelectStore: (id: string) => void;
  shoppingList: ShoppingItem[];
  renderAisleIcon: (aisle: string) => React.ReactNode;
  onClose: () => void;
}

/**
 * Avdelningarnas ordning: the store's name with rename and new store, and the aisles in the
 * order they are walked through, moved with arrows. Opened from the shopping list or Settings.
 */
export const StoreOrderSheet: React.FC<StoreOrderSheetProps> = ({
  storeLayouts,
  activeStore,
  onChangeLayouts,
  onSelectStore,
  shoppingList,
  renderAisleIcon,
  onClose,
}) => {
  // Forms for a new store and a new name
  const [isCreatingStore, setIsCreatingStore] = useState<boolean>(false);
  const [newStoreNameInput, setNewStoreNameInput] = useState<string>('');
  const [isRenamingStore, setIsRenamingStore] = useState<boolean>(false);
  const [renameStoreInput, setRenameStoreInput] = useState<string>('');

  // Asks before the order is reset or a store is removed
  const [storeConfirm, setStoreConfirm] = useState<'reset' | 'delete' | null>(null);

  const handleCreateNewStore = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newStoreNameInput.trim();
    if (!cleanName) return;
    const newId = `store-${Date.now()}`;
    const newStore: StoreLayout = {
      id: newId,
      name: cleanName,
      aisleOrder: [...activeStore.aisleOrder],
    };
    const updated = [...storeLayouts, newStore];
    onChangeLayouts(updated);
    onSelectStore(newId);
    setNewStoreNameInput('');
    setIsCreatingStore(false);
  };

  const handleRenameActiveStore = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = renameStoreInput.trim();
    if (!cleanName) return;
    const updated = storeLayouts.map((s) =>
      s.id === activeStore.id ? { ...s, name: cleanName } : s
    );
    onChangeLayouts(updated);
    setIsRenamingStore(false);
  };

  const handleDeleteActiveStore = () => {
    if (storeLayouts.length <= 1) return;
    const remaining = storeLayouts.filter((s) => s.id !== activeStore.id);
    onChangeLayouts(remaining);
    const nextActive = remaining[0].id;
    onSelectStore(nextActive);
  };

  const handleResetActiveStoreOrder = () => {
    const updated = storeLayouts.map((s) =>
      s.id === activeStore.id ? { ...s, aisleOrder: [...DEFAULT_AISLE_ORDER] } : s
    );
    onChangeLayouts(updated);
  };

  // Reordering in Modal
  const handleMoveModalAisle = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeStore.aisleOrder.length) return;
    const newOrder = reorderAisleByIndex(activeStore.aisleOrder, index, targetIndex);
    const updated = storeLayouts.map((l) =>
      l.id === activeStore.id ? { ...l, aisleOrder: newOrder } : l
    );
    onChangeLayouts(updated);
  };

  return (
    <>
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in font-sans"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reorder-store-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col h-[calc(100dvh-0.75rem)] sm:h-auto sm:max-h-[90vh] overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-[#EBE7DF] flex items-center justify-between shrink-0">
              <h3 id="reorder-store-title" className="font-serif font-bold text-lg text-stone-900 leading-tight">
                Avdelningarnas ordning
              </h3>
              <button
                type="button"
                onClick={() => onClose()}
                className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:bg-stone-100 touch-manipulation"
                aria-label="Stäng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              {/* The store: its name, then rename and new store as text */}
              <div className="py-3 border-b border-[#EBE7DF] space-y-2">
                {isCreatingStore ? (
                  <form onSubmit={handleCreateNewStore} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={newStoreNameInput}
                      onChange={(e) => setNewStoreNameInput(e.target.value)}
                      placeholder="Till exempel Willys"
                      aria-label="Namn på ny butik"
                      className="flex-1 min-w-0 h-11 bg-stone-50 border border-stone-300 rounded-xl px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                    />
                    <button
                      type="submit"
                      disabled={!newStoreNameInput.trim()}
                      className="h-11 px-4 bg-[#284235] text-white text-sm font-semibold rounded-xl disabled:opacity-40 shrink-0 touch-manipulation"
                    >
                      Spara
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingStore(false)}
                      className="h-11 px-2 text-sm text-stone-600 shrink-0 touch-manipulation"
                    >
                      Avbryt
                    </button>
                  </form>
                ) : isRenamingStore ? (
                  <form onSubmit={handleRenameActiveStore} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={renameStoreInput}
                      onChange={(e) => setRenameStoreInput(e.target.value)}
                      aria-label="Butikens namn"
                      className="flex-1 min-w-0 h-11 bg-stone-50 border border-stone-300 rounded-xl px-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                    />
                    <button
                      type="submit"
                      disabled={!renameStoreInput.trim()}
                      className="h-11 px-4 bg-[#284235] text-white text-sm font-semibold rounded-xl disabled:opacity-40 shrink-0 touch-manipulation"
                    >
                      Spara
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRenamingStore(false)}
                      className="h-11 px-2 text-sm text-stone-600 shrink-0 touch-manipulation"
                    >
                      Avbryt
                    </button>
                  </form>
                ) : (
                  <>
                    {storeLayouts.length > 1 ? (
                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="radiogroup" aria-label="Butik">
                        {storeLayouts.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            role="radio"
                            aria-checked={store.id === activeStore.id}
                            onClick={() => onSelectStore(store.id)}
                            className={`px-3.5 min-h-[40px] rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 touch-manipulation ${
                              store.id === activeStore.id
                                ? 'bg-[#284235] text-white'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {store.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-base font-semibold text-stone-900">{activeStore.name}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setRenameStoreInput(activeStore.name);
                          setIsRenamingStore(true);
                        }}
                        className="min-h-[36px] font-semibold text-[#284235] touch-manipulation"
                      >
                        Byt namn
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingStore(true);
                          setNewStoreNameInput('');
                        }}
                        className="min-h-[36px] font-semibold text-[#284235] touch-manipulation"
                      >
                        Ny butik
                      </button>
                      {storeLayouts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setStoreConfirm('delete')}
                          className="min-h-[36px] ml-auto text-rose-700 touch-manipulation"
                        >
                          Ta bort butiken
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* The aisles, in the order they are walked through */}
              <ol className="divide-y divide-[#EBE7DF]">
                {activeStore.aisleOrder.map((aisle, idx) => {
                  const countInCurrentList = shoppingList.filter((item) => (item.aisle || 'Övrigt') === aisle).length;
                  return (
                    <li key={aisle} className="flex items-center gap-3 py-1.5">
                      <span className="w-5 text-right text-sm text-stone-400 tabular-nums shrink-0">{idx + 1}</span>
                      <span className="text-stone-400 shrink-0">{renderAisleIcon(aisle)}</span>
                      <span className="flex-1 min-w-0 text-[15px] text-stone-900 leading-snug">
                        {aisle}
                        {countInCurrentList > 0 && (
                          <span className="text-sm text-stone-400"> · {countInCurrentList} i listan</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMoveModalAisle(idx, 'up')}
                        disabled={idx === 0}
                        className="w-10 h-10 rounded-full text-stone-600 hover:bg-stone-100 disabled:opacity-20 flex items-center justify-center touch-manipulation shrink-0"
                        aria-label={`Flytta upp ${aisle}`}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveModalAisle(idx, 'down')}
                        disabled={idx === activeStore.aisleOrder.length - 1}
                        className="w-10 h-10 -mr-2 rounded-full text-stone-600 hover:bg-stone-100 disabled:opacity-20 flex items-center justify-center touch-manipulation shrink-0"
                        aria-label={`Flytta ner ${aisle}`}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>

              <div className="py-4 border-t border-[#EBE7DF]">
                <button
                  type="button"
                  onClick={() => setStoreConfirm('reset')}
                  className="min-h-[40px] text-sm text-stone-600 touch-manipulation"
                >
                  Återställ ordningen
                </button>
              </div>
            </div>

            <div className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-[#EBE7DF] shrink-0">
              <button
                type="button"
                onClick={() => onClose()}
                className="w-full min-h-[50px] rounded-2xl bg-[#284235] hover:bg-black text-white text-sm font-semibold touch-manipulation"
              >
                Klar
              </button>
            </div>
          </div>
        </div>
      {storeConfirm === 'reset' && (
        <ConfirmSheet
          title="Återställ ordningen?"
          text={`Avdelningarna i ${activeStore.name} får standardordningen igen.`}
          confirmLabel="Återställ"
          onCancel={() => setStoreConfirm(null)}
          onConfirm={() => {
            handleResetActiveStoreOrder();
            setStoreConfirm(null);
          }}
        />
      )}
      {storeConfirm === 'delete' && (
        <ConfirmSheet
          title={`Ta bort ${activeStore.name}?`}
          text="Butikens ordning på avdelningarna tas bort."
          confirmLabel="Ta bort butiken"
          onCancel={() => setStoreConfirm(null)}
          onConfirm={() => {
            handleDeleteActiveStore();
            setStoreConfirm(null);
          }}
        />
      )}
    </>
  );
};
