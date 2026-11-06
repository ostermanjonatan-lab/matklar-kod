import React, { useState, useMemo } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { Plus, Check, X, Tag, Trash2, Leaf } from 'lucide-react';
import type { RecipeCategory } from '../../types/recipe';
import { getRecipeSubcategories, NON_FOOD_SUBCATEGORIES } from '../../types/recipe';
import { DEFAULT_SUBCATEGORIES, DIETARY_SUBCATEGORIES } from '../../data/categories';

export interface SubcategorySelectorProps {
  category: RecipeCategory;
  values?: string[];
  value?: string;
  onChange: (values: string[]) => void;
}

export const SubcategorySelector: React.FC<SubcategorySelectorProps> = ({
  category,
  values,
  value,
  onChange,
}) => {
  const { recipes, customSubcategories, addCustomSubcategory, removeCustomSubcategory } = useRecipes();
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');

  // Normalize selected values
  const selectedValues: string[] = useMemo(() => {
    let raw: string[] = [];
    if (Array.isArray(values)) {
      raw = values.map((s) => s.trim()).filter(Boolean);
    } else if (typeof value === 'string' && value.trim()) {
      raw = value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return raw.filter((s) => !NON_FOOD_SUBCATEGORIES.has(s));
  }, [values, value]);

  // Standard category-specific subcategories
  const categoryDefaults = useMemo(() => {
    return DEFAULT_SUBCATEGORIES[category] || [
      'Husmanskost',
      'Pasta',
      'Ris',
      'Potatis',
    ];
  }, [category]);

  // Persistent custom subcategories: combine context/localStorage with any unique ones from recipes
  const allCustomSubcategories = useMemo(() => {
    const set = new Set<string>();

    // Add stored custom subcategories
    (customSubcategories || []).forEach((s) => {
      const trimmed = s.trim();
      if (trimmed && !NON_FOOD_SUBCATEGORIES.has(trimmed)) {
        set.add(trimmed);
      }
    });

    // Also include any custom subcategories used in existing recipes
    recipes.forEach((r) => {
      getRecipeSubcategories(r).forEach((s) => {
        const isStandardCategory = Object.values(DEFAULT_SUBCATEGORIES).some((list) =>
          list.some((item) => item.toLowerCase() === s.toLowerCase())
        );
        const isDietary = DIETARY_SUBCATEGORIES.some(
          (item) => item.toLowerCase() === s.toLowerCase()
        );
        if (!isStandardCategory && !isDietary) {
          set.add(s);
        }
      });
    });

    // Also include currently selected values if they aren't standard/dietary
    selectedValues.forEach((s) => {
      const isStandardCategory = categoryDefaults.some(
        (item) => item.toLowerCase() === s.toLowerCase()
      );
      const isDietary = DIETARY_SUBCATEGORIES.some(
        (item) => item.toLowerCase() === s.toLowerCase()
      );
      if (!isStandardCategory && !isDietary) {
        set.add(s);
      }
    });

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'sv', { sensitivity: 'base' })
    );
  }, [customSubcategories, recipes, selectedValues, categoryDefaults]);

  const toggleSubcategory = (subcat: string) => {
    const trimmed = subcat.trim();
    if (!trimmed) return;

    if (selectedValues.includes(trimmed)) {
      onChange(selectedValues.filter((s) => s !== trimmed));
    } else {
      onChange([...selectedValues, trimmed]);
    }
  };

  const handleRemoveSelected = (subcatToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((s) => s !== subcatToRemove));
  };

  const handleSaveCustom = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = customInput.trim();
    if (!raw) return;

    // Support entering multiple separated by comma
    const items = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

    if (items.length === 0) return;

    const nextSelected = [...selectedValues];

    items.forEach((formatted) => {
      // Add to persistent custom subcategories
      addCustomSubcategory(formatted);

      // Select it for the recipe if not already selected
      if (!nextSelected.includes(formatted)) {
        nextSelected.push(formatted);
      }
    });

    onChange(nextSelected);
    setIsAddingNew(false);
    setCustomInput('');
  };

  const handleDeleteCustomSubcategory = (subcatToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeCustomSubcategory(subcatToDelete);
    // Also unselect it if currently selected
    if (selectedValues.includes(subcatToDelete)) {
      onChange(selectedValues.filter((s) => s !== subcatToDelete));
    }
  };

  return (
    <div className="space-y-3 font-sans col-span-full">
      {/* Header and Toggle Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <label className="font-bold text-stone-800 block text-xs">
            Underkategorier
          </label>
          <span className="text-[11px] text-stone-500">
            (t.ex. Pasta, Glutenfri)
          </span>
        </div>

        {!isAddingNew && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(true);
              setCustomInput('');
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#284235] bg-[#284235]/10 hover:bg-[#284235]/20 active:scale-95 px-2.5 py-1 rounded-xl transition-all touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Skapa egen</span>
          </button>
        )}
      </div>

      {/* Selected tags display (if any) */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-[#FCFAF5] border border-[#EBE7DF] rounded-2xl p-2.5 shadow-2xs">
          <div className="text-[11px] font-semibold text-stone-500 mr-1 flex items-center gap-1">
            <Tag className="w-3 h-3 text-[#284235]" />
            <span>Valda:</span>
          </div>
          {selectedValues.map((subcat) => (
            <span
              key={subcat}
              className="inline-flex items-center gap-1 bg-[#284235] text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-xs animate-fade-in"
            >
              <span>{subcat}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveSelected(subcat, e)}
                className="w-3.5 h-3.5 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation"
                aria-label={`Ta bort ${subcat}`}
              >
                <X className="w-2.5 h-2.5 stroke-[2.5]" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom subcategory creation input */}
      {isAddingNew && (
        <div className="bg-white border-2 border-[#284235] rounded-2xl p-2.5 shadow-sm space-y-2 animate-slide-down">
          <div className="flex items-center justify-between text-xs font-bold text-stone-800 px-1">
            <span>
              Skapa ny underkategori
            </span>
            <span className="text-[10px] text-stone-400 font-normal">
              Sparas och kan återanvändas
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveCustom();
                } else if (e.key === 'Escape') {
                  setIsAddingNew(false);
                  setCustomInput('');
                }
              }}
              placeholder="T.ex. Airfryer, Lättlagat, Surdeg..."
              className="flex-1 h-9 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl px-3 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#284235]"
            />

            <button
              type="button"
              onClick={() => handleSaveCustom()}
              disabled={!customInput.trim()}
              className="h-9 px-3.5 bg-[#284235] hover:bg-stone-900 text-white font-bold text-xs rounded-xl active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1 touch-manipulation shadow-xs shrink-0 transition-colors"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Lägg till</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false);
                setCustomInput('');
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 text-stone-500 hover:text-stone-800 touch-manipulation shrink-0"
              aria-label="Avbryt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: Specialkost & Kosthållning (Glutenfri, Laktosfri etc.) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            Specialkost & Kosthållning
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_SUBCATEGORIES.map((subcat) => {
            const isSelected = selectedValues.includes(subcat);
            return (
              <button
                key={subcat}
                type="button"
                onClick={() => toggleSubcategory(subcat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 touch-manipulation flex items-center gap-1 active:scale-95 ${
                  isSelected
                    ? 'bg-[#284235] text-white shadow-xs'
                    : 'bg-emerald-50/70 border border-emerald-200 text-emerald-900 hover:bg-emerald-100/80 hover:border-emerald-300'
                }`}
              >
                {isSelected ? (
                  <Check className="w-3 h-3 stroke-[2.5]" />
                ) : (
                  <Plus className="w-3 h-3 text-emerald-600" />
                )}
                <span>{subcat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: Category Suggestions (e.g. Middag, Efterrätt etc.) */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
          <span>Förslag för {category}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categoryDefaults.map((subcat) => {
            const isSelected = selectedValues.includes(subcat);
            return (
              <button
                key={subcat}
                type="button"
                onClick={() => toggleSubcategory(subcat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 touch-manipulation flex items-center gap-1 active:scale-95 ${
                  isSelected
                    ? 'bg-[#284235] text-white shadow-xs'
                    : 'bg-white border border-[#EBE7DF] text-stone-700 hover:bg-[#FCFAF5] hover:border-stone-400'
                }`}
              >
                {isSelected ? (
                  <Check className="w-3 h-3 stroke-[2.5]" />
                ) : (
                  <Plus className="w-3 h-3 text-stone-400" />
                )}
                <span>{subcat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Egna underkategorier (Custom Subcategories) */}
      {allCustomSubcategories.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            <span>
              Egna underkategorier
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allCustomSubcategories.map((subcat) => {
              const isSelected = selectedValues.includes(subcat);
              return (
                <div
                  key={subcat}
                  className={`inline-flex items-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 shadow-2xs ${
                    isSelected
                      ? 'bg-[#284235] text-white shadow-xs'
                      : 'bg-amber-50/70 border border-amber-200 text-stone-800 hover:bg-amber-100/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSubcategory(subcat)}
                    className="px-2.5 py-1.5 flex items-center gap-1 touch-manipulation active:scale-95"
                  >
                    {isSelected ? (
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    ) : (
                      <Plus className="w-3 h-3 text-amber-600" />
                    )}
                    <span>{subcat}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustomSubcategory(subcat, e)}
                    title={`Radera egen underkategori "${subcat}"`}
                    aria-label={`Radera ${subcat}`}
                    className={`pr-2 py-1.5 opacity-60 hover:opacity-100 transition-opacity touch-manipulation ${
                      isSelected ? 'text-white hover:text-red-200' : 'text-stone-400 hover:text-red-600'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
