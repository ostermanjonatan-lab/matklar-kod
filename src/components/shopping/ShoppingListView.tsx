import React, { useState, useMemo, useRef } from 'react';
import { Toast } from '../layout/Toast';
import { ParsedItemPreview } from './ParsedItemPreview';
import { ConfirmSheet } from '../layout/ConfirmSheet';
import type { ShoppingItem } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { AlltidHemmaView } from './AlltidHemmaView';
import { takeOpenStoreOrderFlag } from './storeOrderLink';
import { FrequentItems } from './FrequentItems';
import { StoreOrderSheet } from './StoreOrderSheet';
import {
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  Share2,
  Carrot,
  Milk,
  Beef,
  Fish,
  Wheat,
  Droplet,
  ShoppingCart,
  Croissant,
  Snowflake,
  CupSoda,
  Package,
  MessageSquare,
  X,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  Store,
  Home,
  Tag,
  MoreVertical,
} from 'lucide-react';
import { formatShoppingAmount, capitalizeFirst, formatUnit, formatIngredientName, stripPreparation, formatRecipeTitle } from '../../utils/formatters';
import { parseSmartItemInput } from '../../utils/ingredientParser';
import { normalizeRecipeSource } from '../../utils/shoppingAggregator';
import { copyTextToClipboard } from '../../utils/recipeShare';
import {
  type StoreLayout,
  DEFAULT_AISLE_ORDER,
  loadStoreLayouts,
  saveStoreLayouts,
  loadActiveStoreId,
  saveActiveStoreId,
  loadCollapsedAisles,
  saveCollapsedAisles,
} from '../../utils/storeLayoutService';

export const ShoppingListView: React.FC = () => {
  const {
    shoppingList,
    pantryItems,
    toggleShoppingItem,
    clearCheckedShoppingItems,
    deleteShoppingItem,
    addCustomShoppingItem,
    updateShoppingItemComment,
    updateShoppingItemAisle,
    rememberShoppingAisle,
  } = useRecipes();

  // Sub-tab: 'list' (Inköpslista) | 'pantry' (Alltid ha hemma)
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'pantry'>('list');

  const pantryOutOfStockCount = useMemo(() => {
    return pantryItems.filter((i) => i.isOutOfStock).length;
  }, [pantryItems]);

  // Store layouts & category ordering state
  const [storeLayouts, setStoreLayouts] = useState<StoreLayout[]>(() => loadStoreLayouts());
  const [activeStoreId, setActiveStoreId] = useState<string>(() => loadActiveStoreId());
  const [collapsedAisles, setCollapsedAisles] = useState<Set<string>>(() => new Set(loadCollapsedAisles()));
  const [showStoreDropdown, setShowStoreDropdown] = useState<boolean>(false);
  // Opened from Settings: go straight to Ordna
  const [showReorderModal, setShowReorderModal] = useState<boolean>(() => takeOpenStoreOrderFlag());
  useModalBackHandler(showReorderModal, () => setShowReorderModal(false), 'reorder-shopping-aisles');

  // Long press on a row opens its menu (comment, category, remove)
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  };

  const startLongPress = (item: ShoppingItem, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelLongPress();
    longPressFiredRef.current = false;
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(10);
      setItemMenu(item);
    }, 500);
  };

  const moveLongPress = (e: React.PointerEvent) => {
    const start = longPressStartRef.current;
    if (!start) return;
    if (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8) cancelLongPress();
  };

  // Active store layout
  const activeStore = useMemo(() => {
    return (
      storeLayouts.find((s) => s.id === activeStoreId) ||
      storeLayouts[0] || {
        id: 'default',
        name: 'Standardbutik',
        aisleOrder: DEFAULT_AISLE_ORDER,
      }
    );
  }, [storeLayouts, activeStoreId]);


  // Add Item Drawer State - Smart natural text input
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  useModalBackHandler(showAddForm, () => setShowAddForm(false), 'add-shopping-item');
  const [manualSmartInput, setManualSmartInput] = useState<string>('');
  const [showManualAdvanced, setShowManualAdvanced] = useState<boolean>(false);
  const [manualAisle, setManualAisle] = useState<string>('');
  const [manualComment, setManualComment] = useState<string>('');
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Edit Comment Modal State
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  useModalBackHandler(Boolean(editingItem), () => setEditingItem(null), 'edit-shopping-comment');

  // Change Aisle Modal State
  // Item whose action menu (comment, category, remove) is open
  const [itemMenu, setItemMenu] = useState<ShoppingItem | null>(null);
  useModalBackHandler(Boolean(itemMenu), () => setItemMenu(null), 'shopping-item-menu');

  const [itemToMove, setItemToMove] = useState<ShoppingItem | null>(null);
  useModalBackHandler(Boolean(itemToMove), () => setItemToMove(null), 'change-shopping-aisle');

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<ShoppingItem | 'all' | null>(null);
  useModalBackHandler(Boolean(itemToDelete), () => setItemToDelete(null), 'delete-shopping-item');

  const handleOpenEditComment = (item: ShoppingItem) => {
    setEditingItem(item);
    setEditingCommentText(item.comment || '');
  };

  // Copy toast
  const [copyToast, setCopyToast] = useState<boolean>(false);

  // Aisle icons: thin, grey and the same size, so they support the name without taking over
  const AISLE_ICONS: Record<string, typeof Carrot> = {
    'Frukt & Grönt': Carrot,
    'Mejeri': Milk,
    'Kött & Chark': Beef,
    'Fisk & Skaldjur': Fish,
    'Skafferi': Wheat,
    'Kryddor & Olja': Droplet,
    'Bröd & Bageri': Croissant,
    'Fryst': Snowflake,
    'Drycker': CupSoda,
  };
  const renderAisleIcon = (aisle: string, className: string = 'w-4 h-4 text-stone-500') => {
    const Icon = AISLE_ICONS[aisle] || Package;
    return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
  };

  // Live parsed preview for shopping list manual item input
  const parsedManualPreview = useMemo(() => {
    if (!manualSmartInput.trim()) return null;
    return parseSmartItemInput(manualSmartInput);
  }, [manualSmartInput]);

  const isManualSubmittingRef = useRef(false);

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (isManualSubmittingRef.current) return;

    const inputVal = manualSmartInput.trim();
    if (!inputVal) return;

    isManualSubmittingRef.current = true;
    setTimeout(() => {
      isManualSubmittingRef.current = false;
    }, 400);

    const parsed = parseSmartItemInput(inputVal);
    if (!parsed.name.trim()) return;

    const finalAisle = showManualAdvanced && manualAisle ? manualAisle : parsed.aisle;
    const finalComment = showManualAdvanced && manualComment.trim() ? manualComment.trim() : parsed.comment;

    if (showManualAdvanced && manualAisle) {
      rememberShoppingAisle(parsed.name, manualAisle);
    }

    addCustomShoppingItem({
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      aisle: finalAisle,
      isPantryStaple: parsed.isPantryStaple,
      comment: finalComment,
    });

    setManualSmartInput('');
    setManualComment('');
    setManualAisle('');
    setShowManualAdvanced(false);
    setShowAddForm(false);
  };

  const handleClearAllItems = () => {
    shoppingList.forEach((item) => deleteShoppingItem(item.id));
  };

  // All items in the shopping list
  const filteredItems = shoppingList;

  // Toggle single aisle collapse/expand
  const handleToggleCollapseAisle = (aisleName: string) => {
    setCollapsedAisles((prev) => {
      const next = new Set(prev);
      if (next.has(aisleName)) {
        next.delete(aisleName);
      } else {
        next.add(aisleName);
      }
      saveCollapsedAisles(Array.from(next));
      return next;
    });
  };

  // Toggle all visible aisles collapse/expand
  const handleToggleAllCollapse = () => {
    const visibleAisles = groupedByAisle.map((g) => g.aisleName);
    const allAreCollapsed =
      visibleAisles.length > 0 && visibleAisles.every((a) => collapsedAisles.has(a));

    setCollapsedAisles((prev) => {
      const next = new Set(prev);
      if (allAreCollapsed) {
        visibleAisles.forEach((a) => next.delete(a));
      } else {
        visibleAisles.forEach((a) => next.add(a));
      }
      saveCollapsedAisles(Array.from(next));
      return next;
    });
  };

  // Store profile actions
  const handleSelectStore = (id: string) => {
    setActiveStoreId(id);
    saveActiveStoreId(id);
    setShowStoreDropdown(false);
  };

  // Group items by Aisle using activeStore.aisleOrder
  const groupedByAisle = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();

    // Build complete aisle order: start with activeStore.aisleOrder
    const order = [...activeStore.aisleOrder];

    // Ensure all items' aisles are included in order
    filteredItems.forEach((item) => {
      const aisle = item.aisle || 'Övrigt';
      if (!order.includes(aisle)) {
        const ovrigtIdx = order.indexOf('Övrigt');
        if (ovrigtIdx !== -1) {
          order.splice(ovrigtIdx, 0, aisle);
        } else {
          order.push(aisle);
        }
      }
    });

    // Initialize map with the resolved order
    order.forEach((aisle) => map.set(aisle, []));

    filteredItems.forEach((item) => {
      const aisle = item.aisle || 'Övrigt';
      if (!map.has(aisle)) {
        map.set(aisle, []);
      }
      map.get(aisle)!.push(item);
    });

    // Return only non-empty aisles in user's store order
    const result: Array<{ aisleName: string; items: ShoppingItem[] }> = [];
    order.forEach((aisleName) => {
      const items = map.get(aisleName) || [];
      if (items.length > 0) {
        result.push({ aisleName, items });
      }
    });

    return result;
  }, [filteredItems, activeStore]);

  const allVisibleAisles = useMemo(() => groupedByAisle.map((g) => g.aisleName), [groupedByAisle]);
  const areAllCollapsed = useMemo(() => {
    return allVisibleAisles.length > 0 && allVisibleAisles.every((a) => collapsedAisles.has(a));
  }, [allVisibleAisles, collapsedAisles]);

  const { checkedCount, totalCount, progressPercent } = useMemo(() => {
    let checked = 0;
    for (let i = 0; i < shoppingList.length; i++) {
      if (shoppingList[i].checked) checked++;
    }
    const total = shoppingList.length;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { checkedCount: checked, totalCount: total, progressPercent: percent };
  }, [shoppingList]);
  const remainingCount = totalCount - checkedCount;

  const handleCopyShoppingListText = async () => {
    if (shoppingList.length === 0) return;

    let text = checkedCount > 0
      ? `INKÖPSLISTA (${checkedCount}/${totalCount} klart):\n\n`
      : `INKÖPSLISTA:\n\n`;

    groupedByAisle.forEach((group) => {
      text += `${group.aisleName}:\n`;
      group.items.forEach((item) => {
        const checkMark = item.checked ? '✓ ' : '• ';
        const amtStr = formatShoppingAmount(item.amount);
        const unit = formatUnit(item.unit || '', item.amount).trim();
        const rawName = (item.name || '').trim();
        const name = capitalizeFirst(formatIngredientName(rawName, item.amount, item.unit)).trim();
        const amountDisplay = amtStr ? (unit ? `${amtStr} ${unit} ` : `${amtStr} `) : (unit ? `${unit} ` : '');
        text += `${checkMark}${amountDisplay}${name}\n`;
      });
      text += '\n';
    });

    text = text.trim();

    await copyTextToClipboard(text);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);

    if (navigator.share) {
      navigator.share({
        title: 'Inköpslista',
        text: text,
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF5] pb-32 md:pb-16 w-full max-w-full overflow-x-hidden font-sans">
      {/* Toast Notification */}
      {copyToast && <Toast message="Inköpslistan är kopierad" />}

      {/* Header (Sticky top-0 on mobile, static below DesktopNav on desktop) */}
      <div className="relative sticky top-0 md:static z-20 md:z-auto bg-[#FCFAF5]/95 backdrop-blur-md border-b border-[#EBE7DF] px-4 md:px-6 py-2.5 md:py-0 shadow-xs w-full">
        <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto">
          {/* DESKTOP HEADER (MD+) */}
          <div className="hidden md:flex items-center justify-between gap-4 h-16">
            {/* Left side: Title, Subtab switch & Status badge */}
            <div className="flex items-center gap-4 min-w-0">
              <h1 className="sr-only">
                {activeSubTab === 'list' ? 'Inköpslista' : 'Hemmet'}
              </h1>

                {/* Subtab Switcher: Inköpslista / Hemmet (Always stationary at fixed offset) */}
                <div className="flex bg-[#F0ECE1] p-0.5 rounded-xl border border-[#EBE7DF]/80 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('list')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeSubTab === 'list'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Inköpslista</span>
                    {remainingCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          activeSubTab === 'list' ? 'bg-[#FCFAF5] text-stone-700' : 'bg-stone-300/80 text-stone-700'
                        }`}
                      >
                        {remainingCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('pantry')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeSubTab === 'pantry'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Hemmet</span>
                    {pantryOutOfStockCount > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500 text-white shadow-2xs min-w-[18px] text-center">
                        {pantryOutOfStockCount}
                      </span>
                    ) : pantryItems.length > 0 ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          activeSubTab === 'pantry' ? 'bg-[#FCFAF5] text-stone-700' : 'bg-stone-300/80 text-stone-700'
                        }`}
                      >
                        {pantryItems.length}
                      </span>
                    ) : null}
                  </button>
                </div>

                {/* Status badges placed AFTER the switcher so switcher never shifts */}
                {activeSubTab === 'list' && totalCount > 0 && (
                  <span className="text-xs font-semibold text-[#284235] bg-[#284235]/10 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                    {checkedCount} av {totalCount} klara
                  </span>
                )}

                {activeSubTab === 'pantry' && pantryOutOfStockCount > 0 && (
                  <span className="text-xs font-semibold text-rose-700 bg-rose-100/70 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                    {pantryOutOfStockCount} slut hemma
                  </span>
                )}
              </div>

              {/* Right side: Store selector & Tools (only for list) */}
              {activeSubTab === 'list' && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Store Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStoreDropdown((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-semibold text-xs transition-colors border border-stone-200/70 cursor-pointer h-9"
                      title="Välj eller hantera butik"
                    >
                      <Store className="w-3.5 h-3.5 text-[#284235]" />
                      <span className="max-w-[130px] truncate">{activeStore.name}</span>
                      <ChevronDown className="w-3 h-3 text-stone-500" />
                    </button>

                    {showStoreDropdown && (
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowStoreDropdown(false)}
                      />
                    )}

                    {showStoreDropdown && (
                      <div className="absolute top-full right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-[#EBE7DF] py-1.5 z-30 animate-scale-up">
                        <div className="px-3 py-1 text-xs text-stone-500">
                          Välj butik
                        </div>
                        {storeLayouts.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => handleSelectStore(store.id)}
                            className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-stone-50 transition-colors ${
                              store.id === activeStore.id ? 'text-[#284235] font-bold bg-emerald-50/50' : 'text-stone-700'
                            }`}
                          >
                            <span className="truncate">{store.name}</span>
                            {store.id === activeStore.id && <Check className="w-3.5 h-3.5 text-[#284235]" />}
                          </button>
                        ))}
                        <div className="border-t border-stone-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowStoreDropdown(false);
                            setShowReorderModal(true);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-[#284235] hover:bg-stone-50 flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                          <span>Hantera butiker & ordning...</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Collapse / Expand all */}
                  <button
                    type="button"
                    onClick={handleToggleAllCollapse}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-700 border border-[#EBE7DF] text-xs font-medium transition-colors cursor-pointer h-9 shadow-2xs"
                    title={areAllCollapsed ? 'Fäll ut alla kategorier' : 'Fäll ihop alla kategorier'}
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 text-stone-500" />
                    <span>{areAllCollapsed ? 'Fäll ut alla' : 'Fäll ihop alla'}</span>
                  </button>

                  {/* Reorder Aisles button */}
                  <button
                    type="button"
                    onClick={() => setShowReorderModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/70 text-stone-700 text-xs font-semibold transition-colors cursor-pointer h-9 border border-stone-200/70"
                    title="Ändra ordning på butikens avdelningar"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
                    <span>Ordna</span>
                  </button>

                  {/* Share / Copy button */}
                  <button
                    type="button"
                    onClick={handleCopyShoppingListText}
                    disabled={totalCount === 0}
                    className="w-9 h-9 rounded-xl bg-white border border-[#EBE7DF] text-stone-700 flex items-center justify-center hover:bg-stone-50 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-2xs"
                    title="Kopiera lista som text"
                    aria-label="Kopiera eller dela lista"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Add Item Button */}
                  <button
                    type="button"
                    onClick={() => setShowAddForm((prev) => !prev)}
                    className="px-4 py-1.5 rounded-xl bg-[#284235] hover:bg-black text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer h-9"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lägg till vara</span>
                  </button>
                </div>
              )}
          </div>

          {/* Progress Bar (Desktop) - absolute at bottom border of header to prevent layout shifts */}
          {activeSubTab === 'list' && totalCount > 0 && (
            <div className="hidden md:block absolute bottom-0 left-0 right-0 h-[2px] bg-[#EBE7DF]">
              <div
                className="bg-[#284235] h-full transition-[width] duration-150 ease-out will-change-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* MOBILE HEADER (<MD) */}
          <div className="md:hidden">
            {/* Navigation Switcher: Inköpslista / Hemmet */}
            <div className="flex bg-[#F0ECE1] p-1 rounded-2xl mb-2.5 border border-[#EBE7DF]/80">
              <button
                type="button"
                onClick={() => setActiveSubTab('list')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] ${
                  activeSubTab === 'list'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Inköpslista</span>
                {remainingCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeSubTab === 'list' ? 'bg-[#FCFAF5] text-stone-700' : 'bg-stone-300/80 text-stone-700'
                    }`}
                  >
                    {remainingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('pantry')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] ${
                  activeSubTab === 'pantry'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Hemmet</span>
                {pantryOutOfStockCount > 0 ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500 text-white shadow-2xs min-w-[18px] text-center">
                    {pantryOutOfStockCount}
                  </span>
                ) : pantryItems.length > 0 ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeSubTab === 'pantry' ? 'bg-[#FCFAF5] text-stone-700' : 'bg-stone-300/80 text-stone-700'
                    }`}
                  >
                    {pantryItems.length}
                  </span>
                ) : null}
              </button>
            </div>

            {activeSubTab === 'list' && (
              <>
                <div className="flex flex-wrap items-center justify-between mb-2.5 gap-2 min-w-0">
                  <div className="min-w-fit flex-1">
                    <h1 className="sr-only">Inköpslista</h1>
                    <p className="text-sm text-stone-600 tabular-nums">
                      {totalCount > 0 ? `${checkedCount} av ${totalCount} klara` : 'Listan är tom'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyShoppingListText}
                      disabled={totalCount === 0}
                      className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] text-stone-700 flex items-center justify-center hover:bg-stone-50 active:scale-95 disabled:opacity-40 transition-all touch-manipulation shrink-0 shadow-xs"
                      title="Kopiera lista som text"
                      aria-label="Kopiera eller dela lista"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddForm((prev) => !prev)}
                      className="w-10 h-10 rounded-full bg-white border border-[#EBE7DF] text-stone-700 flex items-center justify-center hover:bg-stone-50 active:scale-95 transition-all touch-manipulation shrink-0 shadow-xs"
                      title="Lägg till vara"
                      aria-label="Lägg till vara"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {totalCount > 0 && (
                  <div className="w-full bg-[#EBE7DF] h-1.5 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="bg-[#284235] h-full rounded-full transition-[width] duration-150 ease-out will-change-[width]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}

                {/* Store Profile & Category Tools Bar */}
                {/* One row: the store to the left, Fäll ihop and Ordna as plain text to the right */}
                <div className="flex items-center justify-between gap-3 pt-2.5 mt-2 border-t border-[#EBE7DF]/80 text-xs w-full">
                  {/* Active Store Button with Dropdown */}
                  <div className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => setShowStoreDropdown((prev) => !prev)}
                      className="flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-semibold text-xs transition-colors touch-manipulation min-h-[32px] border border-stone-200/70"
                      title="Välj eller hantera butik"
                    >
                      <Store className="w-3.5 h-3.5 text-[#284235] shrink-0" />
                      <span className="min-w-0 truncate">{activeStore.name}</span>
                      <ChevronDown className="w-3 h-3 text-stone-500" />
                    </button>

                    {/* Click-outside backdrop for store dropdown */}
                    {showStoreDropdown && (
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowStoreDropdown(false)}
                      />
                    )}

                    {/* Store Dropdown Menu */}
                    {showStoreDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-2xl shadow-xl border border-[#EBE7DF] py-1.5 z-30 animate-scale-up">
                        <div className="px-3 py-1 text-xs text-stone-500">
                          Välj butik
                        </div>
                        {storeLayouts.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => handleSelectStore(store.id)}
                            className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between hover:bg-stone-50 transition-colors ${
                              store.id === activeStore.id ? 'text-[#284235] font-bold bg-emerald-50/50' : 'text-stone-700'
                            }`}
                          >
                            <span className="truncate">{store.name}</span>
                            {store.id === activeStore.id && <Check className="w-3.5 h-3.5 text-[#284235]" />}
                          </button>
                        ))}
                        <div className="border-t border-stone-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setShowStoreDropdown(false);
                            setShowReorderModal(true);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-[#284235] hover:bg-stone-50 flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                          <span>Hantera butiker & ordning...</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action buttons: Collapse/Expand All & Reorder Modal */}
                  <div className="flex items-center gap-4 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleAllCollapse}
                      className="text-xs font-semibold text-stone-600 hover:text-stone-900 whitespace-nowrap touch-manipulation min-h-[40px]"
                      title={areAllCollapsed ? 'Fäll ut alla kategorier' : 'Fäll ihop alla kategorier'}
                    >
                      {areAllCollapsed ? 'Fäll ut' : 'Fäll ihop'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowReorderModal(true)}
                      className="text-xs font-semibold text-[#284235] hover:text-stone-900 whitespace-nowrap touch-manipulation min-h-[40px]"
                      title="Ändra ordning på butikens avdelningar"
                    >
                      Ordna
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto p-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
        {activeSubTab === 'pantry' ? (
          <AlltidHemmaView onNavigateToShoppingList={() => setActiveSubTab('list')} />
        ) : (
          <>
            {/* ADD MANUAL EXTRA ITEM DRAWER / FORM */}
            {showAddForm && (
              <form
                onSubmit={handleAddManualItem}
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
                      setManualSmartInput('');
                      setShowManualAdvanced(false);
                    }}
                    className="w-8 h-8 rounded-full bg-[#FCFAF5] text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors touch-manipulation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-900 mb-1.5">Vad vill du handla?</label>

                  <div className="relative">
                    <input
                      ref={manualInputRef}
                      type="text"
                      value={manualSmartInput}
                      onChange={(e) => setManualSmartInput(e.target.value)}
                      placeholder="Till exempel 2 l mjölk eller kaffe"
                      className="w-full h-12 bg-[#FCFAF5] border border-[#EBE7DF] focus:border-[#284235] rounded-2xl px-4 pr-10 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]/20 font-medium placeholder:text-stone-400 shadow-2xs"
                    />
                    {manualSmartInput && (
                      <button
                        type="button"
                        onClick={() => setManualSmartInput('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-200/70 hover:bg-stone-300 text-stone-600 flex items-center justify-center transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick choices for items you often buy */}
                {!manualSmartInput.trim() && <FrequentItems />}

                {/* Live Parsing Preview */}
                {parsedManualPreview && parsedManualPreview.name && (
            <ParsedItemPreview
              name={parsedManualPreview.name}
              amountText={parsedManualPreview.amount !== null ? `${formatShoppingAmount(parsedManualPreview.amount)} ${formatUnit(parsedManualPreview.unit, parsedManualPreview.amount)}`.trim() : null}
              aisle={showManualAdvanced && manualAisle ? manualAisle : parsedManualPreview.aisle}
              aisleIcon={renderAisleIcon(showManualAdvanced && manualAisle ? manualAisle : parsedManualPreview.aisle)}
              comment={(showManualAdvanced && manualComment.trim()) || parsedManualPreview.comment || undefined}
            />
          )}

                {/* Optional Advanced Settings Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowManualAdvanced((prev) => !prev)}
                    className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 flex items-center gap-1 py-1 touch-manipulation transition-colors"
                  >
                    <span>{showManualAdvanced ? '− Dölj manuella inställningar' : '+ Ändra avdelning eller lägg till kommentar'}</span>
                  </button>

                  {showManualAdvanced && (
                    <div className="mt-2 p-3 bg-stone-50/80 border border-stone-200/70 rounded-2xl space-y-2.5 animate-slide-down">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                          Avdelning i butik
                        </label>
                        <select
                          value={manualAisle || (parsedManualPreview?.aisle || 'Skafferi')}
                          onChange={(e) => setManualAisle(e.target.value)}
                          className="h-10 bg-white border border-[#EBE7DF] rounded-xl px-2.5 text-xs text-stone-900 w-full"
                        >
                          {activeStore.aisleOrder.map((aisle) => (
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

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setManualSmartInput('');
                      setShowManualAdvanced(false);
                    }}
                    className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-2xl touch-manipulation min-h-[44px] transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={!manualSmartInput.trim()}
                    className="flex-1 py-3 bg-[#284235] hover:bg-black disabled:opacity-40 text-white font-bold rounded-2xl active:scale-95 touch-manipulation min-h-[44px] shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lägg till i lista</span>
                  </button>
                </div>
              </form>
            )}

        {/* SHOPPING LIST CONTENT GROUPED BY AISLE */}
        {groupedByAisle.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 md:gap-y-4 items-start w-full">
              {groupedByAisle.map((group) => {
                const isCollapsed = collapsedAisles.has(group.aisleName);
                const remainingInAisle = group.items.filter((i) => !i.checked).length;

                return (
                  <section key={group.aisleName} className="w-full">
                    {/* Aisle heading: tap to collapse. Order is changed under "Ordna". */}
                    <button
                      type="button"
                      onClick={() => handleToggleCollapseAisle(group.aisleName)}
                      aria-expanded={!isCollapsed}
                      className="w-full min-h-[44px] pt-3 pb-1.5 flex items-center gap-2 text-left border-b border-stone-300/70 select-none touch-manipulation"
                    >
                      {renderAisleIcon(group.aisleName, `w-[18px] h-[18px] shrink-0 ${remainingInAisle === 0 ? 'text-stone-300' : 'text-stone-500'}`)}
                      <span className={`font-semibold text-[15px] truncate ${remainingInAisle === 0 ? 'text-stone-400' : 'text-stone-900'}`}>
                        {group.aisleName}
                      </span>
                      {remainingInAisle === 0 ? (
                        <Check className="w-4 h-4 text-[#284235] shrink-0" aria-label="Klart" />
                      ) : (
                        <span className="text-sm text-stone-400 tabular-nums shrink-0">{remainingInAisle}</span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 ml-auto shrink-0 text-stone-400 transition-transform duration-200 ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                    </button>

                  {/* Items in Aisle (collapsible) */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[#EBE7DF] w-full animate-fade-in">
                  {[...group.items].sort((a, b) => Number(a.checked) - Number(b.checked)).map((item) => {
                    const formattedAmt = formatShoppingAmount(item.amount);
                    // Recipe names without the portion count, e.g. "Köttbullar (4 port)" -> "Köttbullar"
                    const sourceParts = (normalizeRecipeSource(item.recipeSource) || '')
                      .split(' + ')
                      .map((part) => formatRecipeTitle(part.replace(/\s*\(\s*\d+(?:[,.]\d+)?\s*port(?:ioner)?\.?\s*\)/gi, '').trim()))
                      .filter(Boolean);
                    const displaySource = sourceParts.length > 0 ? Array.from(new Set(sourceParts)).join(' + ') : undefined;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (longPressFiredRef.current) {
                            longPressFiredRef.current = false;
                            return;
                          }
                          toggleShoppingItem(item.id);
                        }}
                        onPointerDown={(e) => startLongPress(item, e)}
                        onPointerMove={moveLongPress}
                        onPointerUp={cancelLongPress}
                        onPointerCancel={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          cancelLongPress();
                          setItemMenu(item);
                        }}
                        className="py-2.5 flex items-center gap-3 cursor-pointer transition-colors active:bg-stone-100/70 md:hover:bg-stone-100/40 touch-manipulation select-none [-webkit-touch-callout:none] w-full"
                        style={{ minHeight: '56px' }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleShoppingItem(item.id);
                          }}
                          className="w-7 h-7 flex items-center justify-center shrink-0 touch-manipulation active:scale-90 transition-transform"
                          aria-label={item.checked ? 'Avmarkera' : 'Markera som köpt'}
                        >
                          {item.checked ? (
                            <CheckCircle2 className="w-5 h-5 text-[#284235] fill-emerald-100" />
                          ) : (
                            <Circle className="w-5 h-5 text-stone-300" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span
                              className={`text-[15px] leading-snug hyphens-auto [hyphenate-limit-chars:14_6_6] break-words min-w-0 ${
                                item.checked ? 'line-through text-stone-400' : 'text-stone-900'
                              }`}
                            >
                              {capitalizeFirst(stripPreparation(formatIngredientName(item.name, item.amount, item.unit)))}
                            </span>
                            {formattedAmt && (
                              <span
                                className={`text-sm tabular-nums whitespace-nowrap shrink-0 ${
                                  item.checked ? 'text-stone-400 line-through' : 'text-stone-600'
                                }`}
                              >
                                {formattedAmt} {formatUnit(item.unit, item.amount)}
                              </span>
                            )}
                          </div>

                          {(item.isPantryStaple || displaySource || item.comment) && (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs text-stone-400 min-w-0">
                              {item.comment && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditComment(item);
                                  }}
                                  className="text-amber-800 flex items-center gap-1 text-left max-w-full"
                                  title="Ändra kommentar"
                                >
                                  <MessageSquare className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{item.comment}</span>
                                </button>
                              )}
                              {item.isPantryStaple && <span className="shrink-0">Basvara</span>}
                              {displaySource && (
                                <span className="truncate min-w-0" title={`Från ${displaySource}`}>
                                  Från {displaySource}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemMenu(item);
                          }}
                          className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-stone-400 active:bg-stone-100 md:hover:bg-stone-100 shrink-0 touch-manipulation"
                          aria-label={`Fler val för ${item.name}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
            </div>

            {/* List Management Bottom Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-4 max-w-md mx-auto w-full">
              {checkedCount > 0 && (
                <button
                  type="button"
                  onClick={clearCheckedShoppingItems}
                  className="flex-1 py-3 px-4 rounded-2xl bg-white border border-[#EBE7DF] hover:bg-stone-50 active:scale-95 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all touch-manipulation min-h-[44px] shadow-2xs cursor-pointer"
                >
                  <Check className="w-4 h-4 text-[#284235]" />
                  <span>Rensa avbockade ({checkedCount} st)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setItemToDelete('all')}
                className="flex-1 py-3 px-4 rounded-2xl bg-stone-100 hover:bg-rose-50 hover:text-rose-700 active:scale-95 text-stone-500 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all touch-manipulation min-h-[44px] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Töm hela listan</span>
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 space-y-2">
            <h3 className="font-serif text-lg font-bold text-stone-900">Inköpslistan är tom</h3>
            <p className="text-sm text-stone-600">Lägg till varor här, eller ingredienser från ett recept eller veckoplanen.</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="px-5 rounded-2xl bg-[#284235] text-white font-semibold text-sm touch-manipulation min-h-[46px]"
              >
                Lägg till vara
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* EDIT COMMENT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-[#EBE7DF] rounded-3xl p-5 max-w-sm w-full shadow-xl space-y-4 animate-scale-up">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900">
                Kommentar för {capitalizeFirst(editingItem.name)}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Lägg till märke, sort eller annan notering till varan.
              </p>
            </div>

            <input
              type="text"
              value={editingCommentText}
              onChange={(e) => setEditingCommentText(e.target.value)}
              placeholder="T.ex. Ekologisk, Gärna Arla, Ta 2 paket..."
              className="w-full h-11 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-3.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 bg-stone-100 text-stone-700 font-semibold rounded-2xl text-xs touch-manipulation min-h-[44px]"
              >
                Avbryt
              </button>
              {editingItem.comment && (
                <button
                  type="button"
                  onClick={() => {
                    updateShoppingItemComment(editingItem.id, '');
                    setEditingItem(null);
                  }}
                  className="py-3 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-2xl text-xs touch-manipulation min-h-[44px]"
                  title="Ta bort kommentar"
                >
                  Rensa
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  updateShoppingItemComment(editingItem.id, editingCommentText);
                  setEditingItem(null);
                }}
                className="flex-1 py-3 bg-[#284235] hover:bg-black text-white font-bold rounded-2xl text-xs touch-manipulation min-h-[44px] shadow-sm"
              >
                Spara
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM ACTION MENU */}
      {itemMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in"
          role="dialog"
          aria-label={capitalizeFirst(stripPreparation(itemMenu.name))}
          onClick={() => setItemMenu(null)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 pt-2 pb-2 text-sm font-semibold text-stone-900 border-b border-[#EBE7DF]">
              {capitalizeFirst(stripPreparation(itemMenu.name))}
            </div>
            <button
              type="button"
              onClick={() => {
                const item = itemMenu;
                setItemMenu(null);
                handleOpenEditComment(item);
              }}
              className="w-full min-h-[48px] px-3 flex items-center gap-3 text-sm text-stone-800 rounded-2xl active:bg-stone-100 touch-manipulation"
            >
              <MessageSquare className="w-4 h-4 text-stone-500" />
              {itemMenu.comment ? 'Ändra kommentar' : 'Lägg till kommentar'}
            </button>
            <button
              type="button"
              onClick={() => {
                const item = itemMenu;
                setItemMenu(null);
                setItemToMove(item);
              }}
              className="w-full min-h-[48px] px-3 flex items-center gap-3 text-sm text-stone-800 rounded-2xl active:bg-stone-100 touch-manipulation"
            >
              <Tag className="w-4 h-4 text-stone-500" />
              Byt kategori
              <span className="ml-auto text-xs text-stone-400">{itemMenu.aisle}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const item = itemMenu;
                setItemMenu(null);
                setItemToDelete(item);
              }}
              className="w-full min-h-[48px] px-3 flex items-center gap-3 text-sm text-rose-700 rounded-2xl active:bg-rose-50 touch-manipulation"
            >
              <Trash2 className="w-4 h-4" />
              Ta bort från listan
            </button>
          </div>
        </div>
      )}

      {/* CHANGE AISLE MODAL */}
      {itemToMove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          role="dialog"
          aria-label={`Ändra kategori för ${itemToMove.name}`}
        >
          <div className="bg-white border border-[#EBE7DF] rounded-3xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-xl space-y-4 animate-scale-up">
            <div>
              <h3 className="font-serif font-bold text-base text-stone-900">
                Kategori för {capitalizeFirst(itemToMove.name)}
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Appen kommer ihåg ditt val nästa gång varan läggs till.
              </p>
            </div>

            <div className="space-y-1.5">
              {activeStore.aisleOrder.map((aisle) => (
                <button
                  key={aisle}
                  type="button"
                  onClick={() => {
                    updateShoppingItemAisle(itemToMove.id, aisle);
                    setItemToMove(null);
                  }}
                  aria-pressed={aisle === itemToMove.aisle}
                  className={`w-full min-h-[44px] px-3.5 flex items-center gap-2.5 rounded-2xl border text-sm text-left touch-manipulation active:scale-[0.98] transition-all ${
                    aisle === itemToMove.aisle
                      ? 'bg-[#284235] border-[#284235] text-white font-semibold'
                      : 'bg-[#FCFAF5] border-[#EBE7DF] text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  {renderAisleIcon(aisle)}
                  <span className="flex-1">{aisle}</span>
                  {aisle === itemToMove.aisle && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setItemToMove(null)}
              className="w-full py-3 bg-stone-100 text-stone-700 font-semibold rounded-2xl text-xs touch-manipulation min-h-[44px]"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {itemToDelete && (
        <ConfirmSheet
          title={itemToDelete === 'all' ? 'Töm inköpslistan?' : `Ta bort ${capitalizeFirst(itemToDelete.name).toLowerCase()}?`}
          text={itemToDelete === 'all' ? `Alla ${shoppingList.length} varor tas bort.` : undefined}
          confirmLabel={itemToDelete === 'all' ? 'Töm listan' : 'Ta bort'}
          onCancel={() => setItemToDelete(null)}
          onConfirm={() => {
            if (itemToDelete === 'all') {
              handleClearAllItems();
            } else {
              deleteShoppingItem(itemToDelete.id);
            }
            setItemToDelete(null);
          }}
        />
      )}

      {showReorderModal && (
        <StoreOrderSheet
          storeLayouts={storeLayouts}
          activeStore={activeStore}
          onChangeLayouts={(layouts) => {
            setStoreLayouts(layouts);
            saveStoreLayouts(layouts);
          }}
          onSelectStore={handleSelectStore}
          shoppingList={shoppingList}
          renderAisleIcon={(aisle) => renderAisleIcon(aisle)}
          onClose={() => setShowReorderModal(false)}
        />
      )}
    </div>
  );
};
