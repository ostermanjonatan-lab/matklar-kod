import React, { useState, useMemo, useRef } from 'react';
import { ConfirmSheet } from '../layout/ConfirmSheet';
import { useRecipes } from '../../context/RecipeContext';
import type { PantryItem } from '../../types/recipe';
import { parseSmartItemInput } from '../../utils/ingredientParser';
import { capitalizeFirst, formatAmount, formatUnit, formatIngredientName } from '../../utils/formatters';
import { loadStoreLayouts, loadActiveStoreId, DEFAULT_AISLE_ORDER } from '../../utils/storeLayoutService';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import {
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  ShoppingCart,
  Check,
  Wheat,
  Milk,
  Carrot,
  Flame,
  Beef,
  Fish,
  Croissant,
  Snowflake,
  CupSoda,
  Package,
} from 'lucide-react';

interface AlltidHemmaViewProps {
  onNavigateToShoppingList?: () => void;
}

export const AlltidHemmaView: React.FC<AlltidHemmaViewProps> = ({ onNavigateToShoppingList }) => {
  const {
    pantryItems,
    addPantryItem,
    updatePantryItem,
    deletePantryItem,
    togglePantryItemStock,
  } = useRecipes();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Add Item Drawer State - Smart natural text input
  const [showAddForm, setShowAddForm] = useState(false);
  useModalBackHandler(showAddForm, () => setShowAddForm(false), 'add-pantry-item-form');
  const [smartInput, setSmartInput] = useState('');
  const [newIsOutOfStock, setNewIsOutOfStock] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualAisle, setManualAisle] = useState('');
  const [manualComment, setManualComment] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Tip banner state (dismissible)
  const [showTip, setShowTip] = useState(() => {
    try {
      return localStorage.getItem('receptapp_pantry_tip_dismissed') !== 'true';
    } catch {
      return true;
    }
  });

  const handleDismissTip = () => {
    setShowTip(false);
    try {
      localStorage.setItem('receptapp_pantry_tip_dismissed', 'true');
    } catch {}
  };

  // Edit Item Modal State
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  useModalBackHandler(Boolean(editingItem), () => setEditingItem(null), 'edit-pantry-item');
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editUnit, setEditUnit] = useState('st');
  const [editAisle, setEditAisle] = useState('Skafferi');
  const [editComment, setEditComment] = useState('');

  // Delete Item Confirmation
  const [itemToDelete, setItemToDelete] = useState<PantryItem | 'all' | null>(null);
  useModalBackHandler(Boolean(itemToDelete), () => setItemToDelete(null), 'delete-pantry-item');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // Aisle order from active store
  const availableAisles = useMemo(() => {
    try {
      const layouts = loadStoreLayouts();
      const activeId = loadActiveStoreId();
      const active = layouts.find((l) => l.id === activeId) || layouts[0];
      return active?.aisleOrder || DEFAULT_AISLE_ORDER;
    } catch {
      return DEFAULT_AISLE_ORDER;
    }
  }, []);


  // Aisle icons
  const renderAisleIcon = (aisle: string) => {
    switch (aisle) {
      case 'Frukt & Grönt':
        return <Carrot className="w-4 h-4 text-emerald-800" />;
      case 'Mejeri':
        return <Milk className="w-4 h-4 text-sky-800" />;
      case 'Kött & Chark':
        return <Beef className="w-4 h-4 text-rose-800" />;
      case 'Fisk & Skaldjur':
        return <Fish className="w-4 h-4 text-cyan-800" />;
      case 'Skafferi':
        return <Wheat className="w-4 h-4 text-amber-800" />;
      case 'Kryddor & Olja':
        return <Flame className="w-4 h-4 text-orange-800" />;
      case 'Bröd & Bageri':
        return <Croissant className="w-4 h-4 text-yellow-800" />;
      case 'Fryst':
        return <Snowflake className="w-4 h-4 text-blue-800" />;
      case 'Drycker':
        return <CupSoda className="w-4 h-4 text-purple-800" />;
      default:
        return <Package className="w-4 h-4 text-stone-600" />;
    }
  };

  // Live parsed preview of natural input (e.g. "1 kg vetemjöl")
  const parsedPreview = useMemo(() => {
    if (!smartInput.trim()) return null;
    return parseSmartItemInput(smartInput);
  }, [smartInput]);

  // Smart Add Item Handler
  const handleSmartAddSubmit = (e: React.FormEvent, continueAdding: boolean = false) => {
    e.preventDefault();
    const parsed = parseSmartItemInput(smartInput);
    if (!parsed.name.trim()) return;

    const finalAisle = showAdvanced && manualAisle ? manualAisle : parsed.aisle;
    const finalComment = showAdvanced && manualComment.trim() ? manualComment.trim() : parsed.comment;

    addPantryItem({
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      aisle: finalAisle,
      comment: finalComment,
      isOutOfStock: newIsOutOfStock,
    });

    if (newIsOutOfStock) {
      showToast(`"${parsed.name}" lades till och sattes på inköpslistan!`);
    } else {
      showToast(`"${parsed.name}" lades till i Hemmet!`);
    }

    setSmartInput('');
    setManualComment('');
    setManualAisle('');
    setNewIsOutOfStock(false);
    setShowAdvanced(false);

    if (continueAdding) {
      setTimeout(() => {
        addInputRef.current?.focus();
      }, 50);
    } else {
      setShowAddForm(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: PantryItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditAmount(item.amount ? String(item.amount) : '');
    setEditUnit(item.unit || 'st');
    setEditAisle(item.aisle || 'Skafferi');
    setEditComment(item.comment || '');
  };

  // Save Edit Handler
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim()) return;

    updatePantryItem({
      ...editingItem,
      name: capitalizeFirst(editName.trim()),
      amount: editAmount ? parseFloat(editAmount) : null,
      unit: editUnit.trim() || 'st',
      aisle: editAisle,
      comment: editComment.trim() || undefined,
    });

    showToast(`Ändringarna sparades`);
    setEditingItem(null);
  };

  // Stock toggle with animated feedback
  const handleToggleStock = (item: PantryItem) => {
    const nextStock = !item.isOutOfStock;
    togglePantryItemStock(item.id, nextStock);

    if (nextStock) {
      showToast(`"${item.name}" är slut – lades till på inköpslistan!`);
    } else {
      showToast(`"${item.name}" markerades som hemma`);
    }
  };

  // Filtered and grouped items
  const filteredItems = useMemo(() => {
    return pantryItems.filter((item) => {
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesAisle = item.aisle.toLowerCase().includes(q);
        const matchesComment = item.comment?.toLowerCase().includes(q);
        if (!matchesName && !matchesAisle && !matchesComment) return false;
      }

      return true;
    });
  }, [pantryItems, searchQuery]);

  // Group by aisle according to store order
  const groupedByAisle = useMemo(() => {
    const map = new Map<string, PantryItem[]>();
    const order = [...availableAisles];

    filteredItems.forEach((item) => {
      const aisle = item.aisle || 'Övrigt';
      if (!order.includes(aisle)) {
        order.push(aisle);
      }
    });

    order.forEach((aisle) => map.set(aisle, []));

    filteredItems.forEach((item) => {
      const aisle = item.aisle || 'Övrigt';
      if (!map.has(aisle)) {
        map.set(aisle, []);
      }
      map.get(aisle)!.push(item);
    });

    const result: Array<{ aisleName: string; items: PantryItem[] }> = [];
    order.forEach((aisleName) => {
      const items = map.get(aisleName) || [];
      if (items.length > 0) {
        // Sort items inside each aisle: Out of stock first, then alphabetical
        items.sort((a, b) => {
          if (a.isOutOfStock && !b.isOutOfStock) return -1;
          if (!a.isOutOfStock && b.isOutOfStock) return 1;
          return a.name.localeCompare(b.name, 'sv');
        });
        result.push({ aisleName, items });
      }
    });

    return result;
  }, [filteredItems, availableAisles]);

  return (
    <div className="w-full space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto bg-stone-900 text-white px-4 py-3.5 rounded-2xl shadow-xl flex items-center justify-between animate-slide-down text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          {onNavigateToShoppingList && toastMessage.includes('inköpslistan') && (
            <button
              type="button"
              onClick={onNavigateToShoppingList}
              className="underline text-emerald-300 hover:text-white shrink-0 ml-2 text-xs"
            >
              Visa inköpslista
            </button>
          )}
        </div>
      )}

      {/* Tool Description Header (Dismissible) */}
      {showTip && (
        <div className="bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-3 shadow-2xs flex items-start justify-between gap-3 animate-fade-in">
          <p className="text-xs leading-relaxed text-stone-600 flex-1">
            Här samlar du basvaror du alltid vill ha hemma. Markera när något tar slut så flyttas det automatiskt till inköpslistan.
          </p>
          <button
            type="button"
            onClick={handleDismissTip}
            className="w-6 h-6 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 flex items-center justify-center shrink-0 transition-colors touch-manipulation mt-0.5"
            title="Stäng tips"
            aria-label="Stäng tips"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add Item Button or Form */}
      {showAddForm ? (
        <form
          onSubmit={(e) => handleSmartAddSubmit(e, false)}
          className="bg-white border border-[#EBE7DF] rounded-3xl p-4 shadow-md space-y-3.5 animate-slide-down text-xs w-full"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="font-serif font-bold text-base text-stone-900">Lägg till vara</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setSmartInput('');
                setShowAdvanced(false);
              }}
              className="w-8 h-8 rounded-full bg-[#FCFAF5] text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Smart Natural Language Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Vad vill du alltid ha hemma?
              </label>
              <span className="text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full font-medium">
                Skriv t.ex. 1 kg mjöl
              </span>
            </div>

            <div className="relative">
              <input
                ref={addInputRef}
                type="text"
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                placeholder="T.ex. 1 kg vetemjöl, 2 st mjölk, 500g smör, kaffe..."
                className="w-full h-12 bg-[#FCFAF5] border border-[#EBE7DF] focus:border-[#284235] rounded-2xl px-4 pr-10 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]/20 font-medium placeholder:text-stone-400 shadow-2xs"
              />
              {smartInput && (
                <button
                  type="button"
                  onClick={() => setSmartInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-200/70 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Live Parsing Preview */}
          {parsedPreview && parsedPreview.name && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl text-xs text-stone-800 animate-fade-in flex-wrap">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Tolkas som:
              </span>
              <span className="font-bold text-stone-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 shadow-2xs">
                {parsedPreview.name}
              </span>
              {parsedPreview.amount !== null && (
                <span className="bg-emerald-100/80 text-emerald-950 font-bold px-2 py-0.5 rounded-lg text-[11px] tabular-nums">
                  {formatAmount(parsedPreview.amount)} {formatUnit(parsedPreview.unit, parsedPreview.amount)}
                </span>
              )}
              <span className="bg-white border border-stone-200/80 text-stone-600 px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1.5 shadow-2xs">
                {renderAisleIcon(showAdvanced && manualAisle ? manualAisle : parsedPreview.aisle)}
                <span>{showAdvanced && manualAisle ? manualAisle : parsedPreview.aisle}</span>
              </span>
              {((showAdvanced && manualComment.trim()) || parsedPreview.comment) && (
                <span className="text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg text-[10px] italic">
                  {(showAdvanced && manualComment.trim()) || parsedPreview.comment}
                </span>
              )}
            </div>
          )}

          {/* Out of Stock Checkbox */}
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FCFAF5] border border-[#EBE7DF]">
            <input
              type="checkbox"
              id="new-out-of-stock"
              checked={newIsOutOfStock}
              onChange={(e) => setNewIsOutOfStock(e.target.checked)}
              className="w-4 h-4 text-[#284235] rounded border-stone-300 focus:ring-[#284235] accent-[#284235]"
            />
            <label htmlFor="new-out-of-stock" className="text-xs font-semibold text-stone-800 cursor-pointer select-none flex-1">
              Är redan slut hemma (lägg till direkt på inköpslistan)
            </label>
          </div>

          {/* Optional Advanced Settings Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1 py-1 touch-manipulation transition-colors"
            >
              <span>{showAdvanced ? '− Dölj manuella inställningar' : '+ Ändra avdelning eller lägg till kommentar'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3 bg-stone-50/80 border border-stone-200/70 rounded-2xl space-y-2.5 animate-slide-down">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Avdelning i butik
                  </label>
                  <select
                    value={manualAisle || (parsedPreview?.aisle || 'Skafferi')}
                    onChange={(e) => setManualAisle(e.target.value)}
                    className="h-10 bg-white border border-[#EBE7DF] rounded-xl px-2.5 text-xs text-stone-900 w-full"
                  >
                    {availableAisles.map((aisle) => (
                      <option key={aisle} value={aisle}>
                        {aisle}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Kommentar / Anteckning
                  </label>
                  <input
                    type="text"
                    value={manualComment}
                    onChange={(e) => setManualComment(e.target.value)}
                    placeholder="T.ex. Gärna ekologisk, Zoégas..."
                    className="w-full h-10 bg-white border border-[#EBE7DF] rounded-xl px-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setSmartInput('');
                  setShowAdvanced(false);
                }}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-2xl touch-manipulation min-h-[44px] transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={!smartInput.trim()}
                className="flex-[2] py-3 bg-[#284235] hover:bg-black disabled:opacity-40 text-white font-bold rounded-2xl active:scale-95 touch-manipulation min-h-[44px] shadow-sm flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Spara vara</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!smartInput.trim()}
              onClick={(e) => handleSmartAddSubmit(e, true)}
              className="w-full py-2.5 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 text-stone-700 font-semibold rounded-2xl border border-dashed border-stone-300 transition-colors touch-manipulation text-xs flex items-center justify-center gap-1.5"
            >
              <span>Spara och lägg till nästa</span>
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#284235] hover:bg-black text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all touch-manipulation min-h-[46px]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Lägg till vara</span>
        </button>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Sök i hemmet..."
          className="w-full h-10 bg-white border border-[#EBE7DF] rounded-2xl pl-9 pr-8 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] placeholder:text-stone-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center text-xs"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Main Items List */}
      {groupedByAisle.length > 0 ? (
        <div className="space-y-4">
          {groupedByAisle.map((group) => {
            const outCount = group.items.filter((i) => i.isOutOfStock).length;

            return (
              <div
                key={group.aisleName}
                className="bg-white rounded-3xl border border-[#EBE7DF] shadow-xs overflow-hidden"
              >
                {/* Category Header */}
                <div className="bg-[#FCFAF5] px-4 py-2.5 border-b border-[#EBE7DF] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white border border-[#EBE7DF] flex items-center justify-center shrink-0">
                      {renderAisleIcon(group.aisleName)}
                    </div>
                    <span className="font-semibold text-xs text-stone-800 uppercase tracking-wider">
                      {group.aisleName}
                    </span>
                    <span className="text-[11px] font-semibold text-stone-400">
                      ({group.items.length})
                    </span>
                  </div>

                  {outCount > 0 && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {outCount}
                    </span>
                  )}
                </div>

                {/* Items in Aisle */}
                <div className="divide-y divide-[#EBE7DF]/70">
                  {group.items.map((item) => {
                    const amtStr = formatAmount(item.amount);

                    return (
                      <div
                        key={item.id}
                        className={`px-3.5 sm:px-4 py-3 flex items-center justify-between transition-colors gap-2 ${
                          item.isOutOfStock ? 'bg-rose-50/30' : 'hover:bg-stone-50/40'
                        }`}
                      >
                        {/* Left: Stock status toggle button */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleStock(item)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all touch-manipulation active:scale-95 shrink-0 ${
                              item.isOutOfStock
                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs animate-pulse-once'
                                : 'bg-emerald-100/80 hover:bg-emerald-200/80 text-emerald-900 border border-emerald-300/70'
                            }`}
                            title={
                              item.isOutOfStock
                                ? 'Klicka för att markera att varan finns hemma'
                                : 'Klicka för att markera som slut och lägga till på inköpslistan'
                            }
                            aria-label={`Status för ${item.name}`}
                          >
                            {item.isOutOfStock ? (
                              <>
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Slut</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Hemma</span>
                              </>
                            )}
                          </button>

                          {/* Item Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-sm font-semibold leading-tight break-words ${
                                  item.isOutOfStock ? 'text-rose-950 font-bold' : 'text-stone-900'
                                }`}
                              >
                                {capitalizeFirst(formatIngredientName(item.name, item.amount, item.unit))}
                              </span>

                              {amtStr && (
                                <span className="text-xs text-stone-500 font-medium tabular-nums">
                                  ({amtStr} {formatUnit(item.unit, item.amount)})
                                </span>
                              )}
                            </div>

                            {(item.isOutOfStock || item.comment) && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px]">
                                {item.isOutOfStock && (
                                  <span className="text-rose-700 font-bold bg-rose-100/70 px-1.5 py-0.2 rounded-md">
                                    Ligger på inköpslistan
                                  </span>
                                )}

                                {item.comment && (
                                  <span className="text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded-md truncate max-w-[160px]">
                                    {item.comment}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Quick action buttons */}
                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors touch-manipulation"
                            title={`Redigera ${item.name}`}
                            aria-label={`Redigera ${item.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-colors touch-manipulation"
                            title={`Ta bort ${item.name}`}
                            aria-label={`Ta bort ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-3xl border border-[#EBE7DF] p-6 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FCFAF5] text-stone-400 flex items-center justify-center mx-auto">
            <Wheat className="w-6 h-6 stroke-[1.8] text-[#284235]" />
          </div>

          {searchQuery ? (
            <>
              <h3 className="font-serif text-base font-bold text-stone-900">Inga varor matchade sökningen</h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Testa att söka på något annat eller rensa sökningen.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold"
              >
                Rensa sökning
              </button>
            </>
          ) : (
            <>
              <h3 className="font-serif text-base font-bold text-stone-900">Inga varor inlagda än</h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Lägg till ingredienser och varor du alltid vill ha hemma.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="px-5 py-2.5 rounded-2xl bg-[#284235] hover:bg-black text-white font-bold text-xs shadow-xs touch-manipulation flex items-center justify-center gap-1.5 mx-auto active:scale-95 transition-all min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lägg till vara</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-[#EBE7DF] rounded-3xl p-5 max-w-sm w-full shadow-xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-900">
                Redigera {editingItem.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">Namn</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Mängd</label>
                  <input
                    type="number"
                    step="any"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="T.ex. 1"
                    className="h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-sm text-stone-900 w-full"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Enhet</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="st"
                    className="h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-sm text-stone-900 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Avdelning</label>
                <select
                  value={editAisle}
                  onChange={(e) => setEditAisle(e.target.value)}
                  className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3 text-xs text-stone-900"
                >
                  {availableAisles.map((aisle) => (
                    <option key={aisle} value={aisle}>
                      {aisle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">Kommentar</label>
                <input
                  type="text"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Valfri notering..."
                  className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-xs text-stone-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-3 bg-stone-100 text-stone-700 font-semibold rounded-2xl text-xs touch-manipulation min-h-[44px]"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  className="flex-1 py-3 bg-[#284235] hover:bg-black text-white font-bold rounded-2xl text-xs touch-manipulation min-h-[44px] shadow-sm"
                >
                  Spara
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemToDelete && typeof itemToDelete === 'object' && (
        <ConfirmSheet
          title={`Ta bort ${itemToDelete.name.toLowerCase()}?`}
          text="Varan tas bort från Hemma."
          confirmLabel="Ta bort"
          onCancel={() => setItemToDelete(null)}
          onConfirm={() => {
            deletePantryItem(itemToDelete.id);
            setItemToDelete(null);
          }}
        />
      )}
    </div>
  );
};
