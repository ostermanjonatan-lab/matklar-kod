import React, { useState, useMemo, useRef } from 'react';
import type { ShoppingItem } from '../../types/recipe';
import { useRecipes } from '../../context/RecipeContext';
import { useModalBackHandler } from '../../hooks/useModalBackHandler';
import { AlltidHemmaView } from './AlltidHemmaView';
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
  Flame,
  ShoppingCart,
  Croissant,
  Snowflake,
  CupSoda,
  Package,
  MessageSquare,
  X,
  ChevronDown,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Store,
  RotateCcw,
  GripVertical,
  Edit3,
  Home,
  Tag,
} from 'lucide-react';
import { formatAmount, capitalizeFirst, formatUnit, formatIngredientName } from '../../utils/formatters';
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
  moveAisle,
  reorderAisleByIndex,
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
  const [showReorderModal, setShowReorderModal] = useState<boolean>(false);
  useModalBackHandler(showReorderModal, () => setShowReorderModal(false), 'reorder-shopping-aisles');

  // Modal inner state for store management
  const [isCreatingStore, setIsCreatingStore] = useState<boolean>(false);
  const [newStoreNameInput, setNewStoreNameInput] = useState<string>('');
  const [isRenamingStore, setIsRenamingStore] = useState<boolean>(false);
  const [renameStoreInput, setRenameStoreInput] = useState<string>('');
  const [draggedModalAisleIndex, setDraggedModalAisleIndex] = useState<number | null>(null);

  // Drag & drop state for main list cards
  const [draggedCardAisle, setDraggedCardAisle] = useState<string | null>(null);

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

  // Reorder aisle in active store layout
  const handleMoveAisle = (aisleName: string, direction: 'up' | 'down') => {
    const visibleAisles = groupedByAisle.map((g) => g.aisleName);
    const newOrder = moveAisle(activeStore.aisleOrder, aisleName, direction, visibleAisles);
    const updatedLayouts = storeLayouts.map((layout) =>
      layout.id === activeStore.id ? { ...layout, aisleOrder: newOrder } : layout
    );
    setStoreLayouts(updatedLayouts);
    saveStoreLayouts(updatedLayouts);
  };

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
    setStoreLayouts(updated);
    saveStoreLayouts(updated);
    setActiveStoreId(newId);
    saveActiveStoreId(newId);
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
    setStoreLayouts(updated);
    saveStoreLayouts(updated);
    setIsRenamingStore(false);
  };

  const handleDeleteActiveStore = () => {
    if (storeLayouts.length <= 1) return;
    const remaining = storeLayouts.filter((s) => s.id !== activeStore.id);
    setStoreLayouts(remaining);
    saveStoreLayouts(remaining);
    const nextActive = remaining[0].id;
    setActiveStoreId(nextActive);
    saveActiveStoreId(nextActive);
  };

  const handleResetActiveStoreOrder = () => {
    const updated = storeLayouts.map((s) =>
      s.id === activeStore.id ? { ...s, aisleOrder: [...DEFAULT_AISLE_ORDER] } : s
    );
    setStoreLayouts(updated);
    saveStoreLayouts(updated);
  };

  // Reordering in Modal
  const handleMoveModalAisle = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeStore.aisleOrder.length) return;
    const newOrder = reorderAisleByIndex(activeStore.aisleOrder, index, targetIndex);
    const updated = storeLayouts.map((l) =>
      l.id === activeStore.id ? { ...l, aisleOrder: newOrder } : l
    );
    setStoreLayouts(updated);
    saveStoreLayouts(updated);
  };

  // Drag-and-drop on category card in main list
  const handleCardDragStart = (aisleName: string) => {
    setDraggedCardAisle(aisleName);
  };

  const handleCardDragOver = (e: React.DragEvent, targetAisle: string) => {
    e.preventDefault();
    if (!draggedCardAisle || draggedCardAisle === targetAisle) return;
    const visibleAisles = groupedByAisle.map((g) => g.aisleName);
    const fromVisibleIdx = visibleAisles.indexOf(draggedCardAisle);
    const toVisibleIdx = visibleAisles.indexOf(targetAisle);
    if (fromVisibleIdx === -1 || toVisibleIdx === -1) return;

    const direction = toVisibleIdx > fromVisibleIdx ? 'down' : 'up';
    const newOrder = moveAisle(activeStore.aisleOrder, draggedCardAisle, direction, visibleAisles);
    const updated = storeLayouts.map((l) =>
      l.id === activeStore.id ? { ...l, aisleOrder: newOrder } : l
    );
    setStoreLayouts(updated);
    saveStoreLayouts(updated);
  };

  const handleCardDragEnd = () => {
    setDraggedCardAisle(null);
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

  const handleCopyShoppingListText = async () => {
    if (shoppingList.length === 0) return;

    let text = checkedCount > 0
      ? `INKÖPSLISTA (${checkedCount}/${totalCount} klart):\n\n`
      : `INKÖPSLISTA:\n\n`;

    groupedByAisle.forEach((group) => {
      text += `${group.aisleName}:\n`;
      group.items.forEach((item) => {
        const checkMark = item.checked ? '✓ ' : '• ';
        const amtStr = formatAmount(item.amount);
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
      {copyToast && (
        <div className="fixed top-16 left-4 right-4 z-40 max-w-md mx-auto bg-stone-900 text-white px-4 py-3.5 rounded-2xl shadow-xl flex items-center justify-between animate-slide-down text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Inköpslistan har kopierats till urklipp</span>
          </div>
        </div>
      )}

      {/* Header (Sticky top-0 on mobile, static below DesktopNav on desktop) */}
      <div className="relative sticky top-0 md:static z-20 md:z-auto bg-[#FCFAF5]/95 backdrop-blur-md border-b border-[#EBE7DF] px-4 md:px-6 py-2.5 md:py-0 shadow-xs w-full">
        <div className="w-full max-w-md md:max-w-5xl lg:max-w-7xl mx-auto">
          {/* DESKTOP HEADER (MD+) */}
          <div className="hidden md:flex items-center justify-between gap-4 h-16">
            {/* Left side: Title, Subtab switch & Status badge */}
            <div className="flex items-center gap-4 min-w-0">
              <h1 className="font-serif text-2xl font-bold text-stone-900 leading-tight w-[190px] shrink-0 whitespace-nowrap">
                {activeSubTab === 'list' ? 'Inköpslista' : 'Alltid hemma'}
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
                    {totalCount > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          activeSubTab === 'list' ? 'bg-[#FCFAF5] text-stone-700' : 'bg-stone-300/80 text-stone-700'
                        }`}
                      >
                        {totalCount}
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
                        <div className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
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
                {totalCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeSubTab === 'list' ? 'bg-[#FCFAF5] text-stone-700' : 'bg-stone-300/80 text-stone-700'
                    }`}
                  >
                    {totalCount}
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
                    <h1 className="font-serif text-xl font-bold text-stone-900 leading-tight">Inköpslista</h1>
                    <p className="text-[11px] text-stone-500 truncate">
                      <span className="font-semibold text-[#284235]">
                        {checkedCount} av {totalCount} klara
                      </span>
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
                      className="px-3.5 py-2 rounded-2xl bg-[#284235] hover:bg-black text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all touch-manipulation min-h-[40px] shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Lägg till</span>
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
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2 border-t border-[#EBE7DF]/80 text-xs w-full">
                  {/* Active Store Button with Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStoreDropdown((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-800 font-semibold text-xs transition-colors touch-manipulation min-h-[32px] border border-stone-200/70"
                      title="Välj eller hantera butik"
                    >
                      <Store className="w-3.5 h-3.5 text-[#284235]" />
                      <span className="max-w-[130px] truncate">{activeStore.name}</span>
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
                        <div className="px-3 py-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleAllCollapse}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-50 text-stone-600 border border-[#EBE7DF] text-xs font-medium transition-colors touch-manipulation min-h-[32px]"
                      title={areAllCollapsed ? 'Fäll ut alla kategorier' : 'Fäll ihop alla kategorier'}
                    >
                      <ChevronsUpDown className="w-3.5 h-3.5 text-stone-500" />
                      <span className="hidden sm:inline">{areAllCollapsed ? 'Fäll ut alla' : 'Fäll ihop alla'}</span>
                      <span className="sm:hidden">{areAllCollapsed ? 'Fäll ut' : 'Fäll ihop'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowReorderModal(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#284235]/10 hover:bg-[#284235]/15 text-[#284235] text-xs font-semibold transition-colors touch-manipulation min-h-[32px]"
                      title="Ändra ordning på butikens avdelningar"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Ordna</span>
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
                    <h3 className="font-serif font-bold text-base text-stone-900">Lägg till extra vara</h3>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Vad vill du köpa?
                    </label>
                    <span className="text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full font-medium">
                      Skriv t.ex. 1 kg mjöl
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      ref={manualInputRef}
                      type="text"
                      value={manualSmartInput}
                      onChange={(e) => setManualSmartInput(e.target.value)}
                      placeholder="T.ex. 1 kg vetemjöl, 2 st mjölk, 500g smör, kaffe..."
                      className="w-full h-12 bg-[#FCFAF5] border border-[#EBE7DF] focus:border-[#284235] rounded-2xl px-4 pr-10 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]/20 font-medium placeholder:text-stone-400 shadow-2xs"
                      autoFocus
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

                {/* Live Parsing Preview */}
                {parsedManualPreview && parsedManualPreview.name && (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl text-xs text-stone-800 animate-fade-in flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Tolkas som:
                    </span>
                    <span className="font-bold text-stone-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 shadow-2xs">
                      {parsedManualPreview.name}
                    </span>
                    {parsedManualPreview.amount !== null && (
                      <span className="bg-emerald-100/80 text-emerald-950 font-bold px-2 py-0.5 rounded-lg text-[11px] tabular-nums">
                        {formatAmount(parsedManualPreview.amount)} {formatUnit(parsedManualPreview.unit, parsedManualPreview.amount)}
                      </span>
                    )}
                    <span className="bg-white border border-stone-200/80 text-stone-600 px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1.5 shadow-2xs">
                      {renderAisleIcon(showManualAdvanced && manualAisle ? manualAisle : parsedManualPreview.aisle)}
                      <span>{showManualAdvanced && manualAisle ? manualAisle : parsedManualPreview.aisle}</span>
                    </span>
                    {((showManualAdvanced && manualComment.trim()) || parsedManualPreview.comment) && (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg text-[10px] italic">
                        {(showManualAdvanced && manualComment.trim()) || parsedManualPreview.comment}
                      </span>
                    )}
                  </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-start w-full">
              {groupedByAisle.map((group, groupIdx) => {
                const isCollapsed = collapsedAisles.has(group.aisleName);
                const checkedInAisle = group.items.filter((i) => i.checked).length;
                const allDoneInAisle = checkedInAisle === group.items.length && group.items.length > 0;

                return (
                  <div
                    key={group.aisleName}
                    onDragOver={(e) => handleCardDragOver(e, group.aisleName)}
                    className={`w-full bg-white rounded-3xl border shadow-xs overflow-hidden transition-all duration-200 ${
                      draggedCardAisle === group.aisleName
                        ? 'opacity-50 ring-2 ring-[#284235] border-[#284235]'
                        : 'border-[#EBE7DF]'
                    }`}
                  >
                    {/* Aisle Header (Collapsible Tab & Reorderable) */}
                    <div
                      onClick={() => handleToggleCollapseAisle(group.aisleName)}
                      className={`bg-stone-50/90 px-3.5 sm:px-4 py-3 flex items-center justify-between cursor-pointer select-none hover:bg-stone-100 active:bg-stone-200/50 transition-colors touch-manipulation ${
                        isCollapsed ? '' : 'border-b border-[#EBE7DF]'
                      }`}
                    >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Drag Handle */}
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleCardDragStart(group.aisleName);
                        }}
                        onDragEnd={handleCardDragEnd}
                        onClick={(e) => e.stopPropagation()}
                        className="text-stone-300 hover:text-stone-600 active:text-stone-900 cursor-grab active:cursor-grabbing p-1 -ml-1.5 touch-none"
                        title="Dra för att flytta kategori"
                        aria-label="Dra för att flytta kategori"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="w-7 h-7 rounded-xl bg-white border border-[#EBE7DF] flex items-center justify-center shrink-0">
                        {renderAisleIcon(group.aisleName)}
                      </div>

                      <div className="min-w-0 flex items-center gap-2 truncate">
                        <span className="font-semibold text-xs text-stone-800 uppercase tracking-wider truncate">
                          {group.aisleName}
                        </span>

                        {/* Status badge */}
                        {allDoneInAisle ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200/80 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" /> Klart
                          </span>
                        ) : checkedInAisle > 0 ? (
                          <span className="text-[10px] font-medium text-stone-600 bg-stone-200/70 px-2 py-0.5 rounded-full shrink-0">
                            {group.items.length - checkedInAisle} kvar
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-stone-400 shrink-0">
                            {group.items.length} st
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right side controls: Move Up/Down + Collapse Chevron */}
                    <div className="flex items-center gap-0.5 shrink-0 ml-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleMoveAisle(group.aisleName, 'up')}
                        disabled={groupIdx === 0}
                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-200/70 disabled:opacity-20 disabled:pointer-events-none flex max-[359px]:hidden items-center justify-center transition-all touch-manipulation active:scale-90"
                        title={`Flytta upp ${group.aisleName}`}
                        aria-label={`Flytta upp ${group.aisleName}`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveAisle(group.aisleName, 'down')}
                        disabled={groupIdx === groupedByAisle.length - 1}
                        className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-200/70 disabled:opacity-20 disabled:pointer-events-none flex max-[359px]:hidden items-center justify-center transition-all touch-manipulation active:scale-90"
                        title={`Flytta ner ${group.aisleName}`}
                        aria-label={`Flytta ner ${group.aisleName}`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleCollapseAisle(group.aisleName)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-800 hover:bg-stone-200/70 transition-all touch-manipulation"
                        title={isCollapsed ? 'Fäll ut flik' : 'Fäll ihop flik'}
                        aria-label={isCollapsed ? `Fäll ut ${group.aisleName}` : `Fäll ihop ${group.aisleName}`}
                        aria-expanded={!isCollapsed}
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isCollapsed ? '-rotate-90 text-stone-500' : 'rotate-0 text-stone-700'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Items in Aisle (collapsible) */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[#EBE7DF]/70 w-full animate-fade-in">
                  {group.items.map((item) => {
                    const formattedAmt = formatAmount(item.amount);
                    const displaySource = normalizeRecipeSource(item.recipeSource);

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleShoppingItem(item.id)}
                        className={`px-4 py-3.5 flex flex-wrap items-center justify-between cursor-pointer transition-colors active:bg-stone-50 touch-manipulation w-full gap-x-2 gap-y-1 ${
                          item.checked
                            ? 'bg-stone-50/60 text-stone-400'
                            : 'text-stone-900 hover:bg-stone-50/40'
                        }`}
                        style={{ minHeight: '56px' }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-[10rem]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleShoppingItem(item.id);
                            }}
                            className="w-7 h-7 flex items-center justify-center shrink-0 text-stone-400 touch-manipulation active:scale-90 transition-transform"
                            aria-label={item.checked ? 'Avmarkera' : 'Markera som köpt'}
                          >
                            {item.checked ? (
                              <CheckCircle2 className="w-5 h-5 text-[#284235] fill-emerald-100" />
                            ) : (
                              <Circle className="w-5 h-5 text-stone-300" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <span
                              className={`text-sm font-medium block leading-snug break-words ${
                                item.checked ? 'line-through text-stone-400' : 'text-stone-900'
                              }`}
                            >
                              {capitalizeFirst(formatIngredientName(item.name, item.amount, item.unit))}
                            </span>

                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {item.isPantryStaple && (
                                <span className="text-[10px] bg-[#FCFAF5] text-stone-600 border border-[#EBE7DF] font-medium px-2 py-0.2 rounded-md shrink-0">
                                  Basvara
                                </span>
                              )}
                              {displaySource && (
                                <span
                                  className="text-[10px] text-stone-400 truncate max-w-[260px] sm:max-w-md"
                                  title={`Från ${displaySource}`}
                                >
                                  Från {displaySource}
                                </span>
                              )}
                              {item.comment && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditComment(item);
                                  }}
                                  className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 hover:bg-amber-100 px-2 py-0.5 rounded-lg truncate max-w-[170px] font-medium flex items-center gap-1 active:scale-95 transition-all text-left"
                                  title="Tryck för att ändra kommentar"
                                >
                                  <MessageSquare className="w-2.5 h-2.5 shrink-0 text-amber-700" />
                                  <span className="truncate">{item.comment}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          {formattedAmt && (
                            <span
                              className={`text-sm font-bold tabular-nums whitespace-nowrap mr-1 ${
                                item.checked ? 'text-stone-400 line-through' : 'text-[#284235]'
                              }`}
                            >
                              {formattedAmt} {formatUnit(item.unit, item.amount)}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditComment(item);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-90 ${
                              item.comment
                                ? 'text-amber-700 hover:bg-amber-100/70'
                                : 'text-stone-300 hover:text-stone-600 hover:bg-stone-100'
                            }`}
                            title={item.comment ? 'Ändra kommentar' : 'Lägg till kommentar'}
                            aria-label={`Kommentar för ${item.name}`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToMove(item);
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-stone-600 hover:bg-stone-100 active:scale-90 transition-all touch-manipulation"
                            title="Ändra kategori"
                            aria-label={`Ändra kategori för ${item.name}`}
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete(item);
                            }}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition-all touch-manipulation"
                            title="Ta bort från inköpslistan"
                            aria-label={`Ta bort ${item.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
          <div className="text-center py-16 bg-white rounded-3xl border border-[#EBE7DF] p-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-[#FCFAF5] text-stone-500 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 stroke-[1.5] text-[#284235]" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900">Inköpslistan är tom!</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto leading-relaxed">
              Gå till dina recept eller veckoplanen och tryck på "Köp ingredienser", eller lägg till manuellt.
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-5 py-3 rounded-2xl bg-[#284235] text-white font-bold text-xs shadow-xs touch-manipulation min-h-[44px]"
            >
              + Lägg till första varan
            </button>
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
              autoFocus
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

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-shopping-title"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-up border border-[#EBE7DF]">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 id="delete-shopping-title" className="font-serif font-bold text-lg text-stone-900">
                {itemToDelete === 'all' ? 'Töm hela listan?' : 'Ta bort vara?'}
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                {itemToDelete === 'all' ? (
                  'Är du säker på att du vill ta bort alla varor från inköpslistan? Detta går inte att ångra.'
                ) : (
                  <>
                    Är du säker på att du vill ta bort{' '}
                    <span className="font-semibold text-stone-800">
                      "{capitalizeFirst(itemToDelete.name)}"
                    </span>{' '}
                    från inköpslistan?
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-3 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold text-xs touch-manipulation transition-colors min-h-[44px]"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  if (itemToDelete === 'all') {
                    handleClearAllItems();
                  } else {
                    deleteShoppingItem(itemToDelete.id);
                  }
                  setItemToDelete(null);
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-xs touch-manipulation transition-all min-h-[44px]"
              >
                Ja, ta bort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REORDER & STORE SETTINGS MODAL */}
      {showReorderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reorder-store-title"
        >
          <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up border border-[#EBE7DF] max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#EBE7DF]/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#284235]/10 text-[#284235] flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="reorder-store-title" className="font-serif font-bold text-base sm:text-lg text-stone-900 leading-tight">
                    Ordna butik & avdelningar
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Anpassa gångordningen efter hur du rör dig i butiken
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="w-8 h-8 rounded-full bg-[#FCFAF5] text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors touch-manipulation shrink-0"
                aria-label="Stäng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Store Profiles Section */}
            <div className="bg-[#FCFAF5] rounded-2xl p-3 border border-[#EBE7DF]/80 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700">Mataffär / profil:</span>
                {!isCreatingStore && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingStore(true);
                      setNewStoreNameInput('');
                    }}
                    className="text-[11px] font-bold text-[#284235] hover:underline flex items-center gap-1 touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ny butik</span>
                  </button>
                )}
              </div>

              {/* Form to create new store */}
              {isCreatingStore ? (
                <form onSubmit={handleCreateNewStore} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newStoreNameInput}
                    onChange={(e) => setNewStoreNameInput(e.target.value)}
                    placeholder="T.ex. Willys, ICA Maxi..."
                    className="flex-1 h-9 bg-white border border-[#EBE7DF] rounded-xl px-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newStoreNameInput.trim()}
                    className="h-9 px-3 bg-[#284235] hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-all shrink-0 touch-manipulation"
                  >
                    Spara
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingStore(false)}
                    className="h-9 px-2.5 bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-300 transition-colors shrink-0 touch-manipulation"
                  >
                    Avbryt
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {storeLayouts.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => handleSelectStore(store.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 touch-manipulation ${
                        store.id === activeStore.id
                          ? 'bg-[#284235] text-white shadow-xs'
                          : 'bg-white border border-[#EBE7DF] text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {store.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Store Actions (Rename / Delete) */}
              {!isCreatingStore && (
                <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500 border-t border-[#EBE7DF]/60">
                  {isRenamingStore ? (
                    <form onSubmit={handleRenameActiveStore} className="flex gap-1.5 items-center w-full">
                      <input
                        type="text"
                        value={renameStoreInput}
                        onChange={(e) => setRenameStoreInput(e.target.value)}
                        className="flex-1 h-8 bg-white border border-[#EBE7DF] rounded-lg px-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!renameStoreInput.trim()}
                        className="h-8 px-2.5 bg-[#284235] text-white text-[11px] font-bold rounded-lg touch-manipulation"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRenamingStore(false)}
                        className="h-8 px-2 bg-stone-200 text-stone-700 text-[11px] font-semibold rounded-lg touch-manipulation"
                      >
                        Avbryt
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span>Aktiv butik: <strong className="text-stone-800">{activeStore.name}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameStoreInput(activeStore.name);
                            setIsRenamingStore(true);
                          }}
                          className="text-stone-400 hover:text-stone-700 flex items-center gap-0.5 touch-manipulation"
                          title="Byt namn på butik"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Byt namn</span>
                        </button>
                      </div>
                      {storeLayouts.length > 1 && (
                        <button
                          type="button"
                          onClick={handleDeleteActiveStore}
                          className="text-rose-600 hover:text-rose-700 font-medium touch-manipulation"
                        >
                          Ta bort butik
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Reorder List of Aisles */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[220px]">
              {activeStore.aisleOrder.map((aisle, idx) => {
                const countInCurrentList = shoppingList.filter((item) => (item.aisle || 'Övrigt') === aisle).length;

                return (
                  <div
                    key={aisle}
                    draggable
                    onDragStart={() => setDraggedModalAisleIndex(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedModalAisleIndex === null || draggedModalAisleIndex === idx) return;
                      const newOrder = reorderAisleByIndex(activeStore.aisleOrder, draggedModalAisleIndex, idx);
                      const updatedLayouts = storeLayouts.map((l) =>
                        l.id === activeStore.id ? { ...l, aisleOrder: newOrder } : l
                      );
                      setStoreLayouts(updatedLayouts);
                      saveStoreLayouts(updatedLayouts);
                      setDraggedModalAisleIndex(idx);
                    }}
                    onDragEnd={() => setDraggedModalAisleIndex(null)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-150 ${
                      draggedModalAisleIndex === idx
                        ? 'bg-emerald-50 border-[#284235] opacity-60'
                        : 'bg-white border-[#EBE7DF] hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Drag Grip Handle */}
                      <div
                        className="text-stone-300 hover:text-stone-600 active:text-stone-900 cursor-grab active:cursor-grabbing p-1 -ml-1 touch-none"
                        title="Dra för att flytta"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      {/* Sequence number */}
                      <span className="w-5 text-center text-xs font-bold text-stone-400 tabular-nums">
                        {idx + 1}
                      </span>

                      {/* Icon */}
                      <div className="w-7 h-7 rounded-xl bg-[#FCFAF5] border border-[#EBE7DF] flex items-center justify-center shrink-0">
                        {renderAisleIcon(aisle)}
                      </div>

                      {/* Name */}
                      <span className="text-xs font-semibold text-stone-800 truncate">
                        {aisle}
                      </span>

                      {/* Active List Badge */}
                      {countInCurrentList > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.2 rounded-full shrink-0 ml-1">
                          {countInCurrentList} i lista
                        </span>
                      )}
                    </div>

                    {/* Move Up/Down Arrow Buttons */}
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleMoveModalAisle(idx, 'up')}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center transition-colors touch-manipulation active:scale-90"
                        title={`Flytta upp ${aisle}`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveModalAisle(idx, 'down')}
                        disabled={idx === activeStore.aisleOrder.length - 1}
                        className="w-7 h-7 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center transition-colors touch-manipulation active:scale-90"
                        title={`Flytta ner ${aisle}`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#EBE7DF]/80 shrink-0">
              <button
                type="button"
                onClick={handleResetActiveStoreOrder}
                className="py-2.5 px-3 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold flex items-center gap-1.5 transition-colors touch-manipulation min-h-[42px]"
                title="Återställ denna butik till standardordning"
              >
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                <span>Återställ standard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="py-2.5 px-6 rounded-xl bg-[#284235] hover:bg-black active:scale-95 text-white text-xs font-bold shadow-xs transition-all touch-manipulation min-h-[42px]"
              >
                Klar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
