import React, { useState, useMemo, useRef } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { FrequentItems } from './FrequentItems';
import { parseSmartItemInput } from '../../utils/ingredientParser';
import { DEFAULT_AISLE_ORDER, loadStoreLayouts, loadActiveStoreId } from '../../utils/storeLayoutService';
import { formatAmount, formatUnit } from '../../utils/formatters';
import {
  X,
  ShoppingCart,
  Plus,
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

interface AddShoppingItemModalProps {
  onClose: () => void;
}

export const AddShoppingItemModal: React.FC<AddShoppingItemModalProps> = ({ onClose }) => {
  const { addCustomShoppingItem, rememberShoppingAisle } = useRecipes();

  // Available aisles based on active store layout
  const aisleOptions = useMemo(() => {
    try {
      const layouts = loadStoreLayouts();
      const activeId = loadActiveStoreId();
      const active = layouts.find((l) => l.id === activeId) || layouts[0];
      return active?.aisleOrder || DEFAULT_AISLE_ORDER;
    } catch {
      return DEFAULT_AISLE_ORDER;
    }
  }, []);

  const [smartInput, setSmartInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualAisle, setManualAisle] = useState('');
  const [manualComment, setManualComment] = useState('');
  const [justAddedFeedback, setJustAddedFeedback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Aisle icon helper
  const renderAisleIcon = (aisle: string) => {
    switch (aisle) {
      case 'Frukt & Grönt':
        return <Carrot className="w-3.5 h-3.5 text-emerald-800" />;
      case 'Mejeri':
        return <Milk className="w-3.5 h-3.5 text-sky-800" />;
      case 'Kött & Chark':
        return <Beef className="w-3.5 h-3.5 text-rose-800" />;
      case 'Fisk & Skaldjur':
        return <Fish className="w-3.5 h-3.5 text-cyan-800" />;
      case 'Skafferi':
        return <Wheat className="w-3.5 h-3.5 text-amber-800" />;
      case 'Kryddor & Olja':
        return <Flame className="w-3.5 h-3.5 text-orange-800" />;
      case 'Bröd & Bageri':
        return <Croissant className="w-3.5 h-3.5 text-yellow-800" />;
      case 'Fryst':
        return <Snowflake className="w-3.5 h-3.5 text-blue-800" />;
      case 'Drycker':
        return <CupSoda className="w-3.5 h-3.5 text-purple-800" />;
      default:
        return <Package className="w-3.5 h-3.5 text-stone-600" />;
    }
  };

  // Live parsed preview
  const parsedPreview = useMemo(() => {
    if (!smartInput.trim()) return null;
    return parseSmartItemInput(smartInput);
  }, [smartInput]);

  const isSubmittingRef = useRef(false);

  const handleSubmit = (e: React.FormEvent, continueAdding: boolean = false) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    const inputVal = smartInput.trim();
    if (!inputVal) return;

    isSubmittingRef.current = true;
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 400);

    const parsed = parseSmartItemInput(inputVal);
    if (!parsed.name.trim()) return;

    const finalAisle = showAdvanced && manualAisle ? manualAisle : parsed.aisle;
    const finalComment = showAdvanced && manualComment.trim() ? manualComment.trim() : parsed.comment;

    if (showAdvanced && manualAisle) {
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

    if (continueAdding) {
      setSmartInput('');
      setManualComment('');
      setManualAisle('');
      setShowAdvanced(false);
      setJustAddedFeedback(true);
      setTimeout(() => setJustAddedFeedback(false), 2000);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-3xl shadow-2xl border border-[#EBE7DF] overflow-hidden animate-slide-up flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mt-3 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#EBE7DF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-stone-900 leading-tight">
                Vara för inköpslistan
              </h2>
              <p className="text-[11px] text-stone-500">
                {justAddedFeedback ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Varan lades till!
                  </span>
                ) : (
                  'Skriv t.ex. 1 kg mjöl eller 2 st mjölk'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors touch-manipulation"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-5 space-y-4 overflow-y-auto">
          {/* Smart Natural Input */}
          <div>
            <div className="mb-1.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                Vad vill du handla? <span className="text-rose-500">*</span>
              </label>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                placeholder="T.ex. 1 kg vetemjöl, 2 st mjölk, 500g smör, kaffe..."
                className="w-full h-12 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl px-4 pr-10 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] focus:border-transparent placeholder:text-stone-400"
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

          {/* Quick choices for items you often buy */}
          {!smartInput.trim() && <FrequentItems />}

          {/* Live Parsing Preview */}
          {parsedPreview && parsedPreview.name && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl text-xs text-stone-800 animate-fade-in flex-wrap">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
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
                    Avdelning / Kategori
                  </label>
                  <select
                    value={manualAisle || (parsedPreview?.aisle || 'Skafferi')}
                    onChange={(e) => setManualAisle(e.target.value)}
                    className="w-full h-10 bg-white border border-[#EBE7DF] rounded-xl px-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
                  >
                    {aisleOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Kommentar <span className="text-stone-400 font-normal lowercase">(valfritt)</span>
                  </label>
                  <input
                    type="text"
                    value={manualComment}
                    onChange={(e) => setManualComment(e.target.value)}
                    placeholder="T.ex. Ekologisk, Zoégas Skånerost..."
                    className="w-full h-10 bg-white border border-[#EBE7DF] rounded-xl px-3 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235] placeholder:text-stone-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-2xl transition-colors touch-manipulation min-h-[46px] text-xs"
              >
                Avbryt
              </button>

              <button
                type="submit"
                disabled={!smartInput.trim()}
                className="flex-[2] py-3 bg-[#284235] hover:bg-black disabled:opacity-40 text-white font-bold rounded-2xl active:scale-[0.98] transition-all touch-manipulation min-h-[46px] shadow-sm flex items-center justify-center gap-1.5 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Lägg till i lista</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!smartInput.trim()}
              onClick={(e) => handleSubmit(e, true)}
              className="w-full py-2.5 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 text-stone-700 font-semibold rounded-2xl border border-dashed border-stone-300 transition-colors touch-manipulation text-xs flex items-center justify-center gap-1.5"
            >
              <span>Lägg till och fortsätt skriva</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
