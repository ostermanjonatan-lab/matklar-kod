import React, { useState, useMemo } from 'react';
import { useRecipes } from '../../context/RecipeContext';
import { Plus, X, Trash2, ChevronDown } from 'lucide-react';
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
  // Suggestions are folded away once something is chosen, so the form stays short
  const [showSuggestions, setShowSuggestions] = useState<boolean>(() => {
    const initial = Array.isArray(values) ? values : typeof value === 'string' ? value.split(',') : [];
    return initial.filter((v) => v.trim()).length === 0;
  });

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

  const chip =
    'px-3 min-h-[36px] rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 touch-manipulation active:scale-95 transition-colors bg-white border border-[#EBE7DF] text-stone-700 hover:bg-[#FCFAF5]';
  const groupHeading = 'text-xs text-stone-500';
  const notSelected = (list: string[]) => list.filter((s) => !selectedValues.includes(s));
  const dietary = notSelected(DIETARY_SUBCATEGORIES);
  const suggested = notSelected(categoryDefaults);
  const custom = notSelected(allCustomSubcategories);

  return (
    <div className="space-y-2 font-sans col-span-full">
      <div className="flex items-center justify-between">
        <span className="font-bold text-stone-800 text-xs">Underkategorier</span>
        {!isAddingNew && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(true);
              setCustomInput('');
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#284235] min-h-[36px] px-1 touch-manipulation"
          >
            <Plus className="w-3.5 h-3.5" />
            Skapa egen
          </button>
        )}
      </div>

      {/* Chosen ones, shown once */}
      {selectedValues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedValues.map((subcat) => (
            <span
              key={subcat}
              className="inline-flex items-center gap-1 bg-[#284235] text-white text-xs font-semibold pl-3 pr-1 min-h-[36px] rounded-xl"
            >
              {subcat}
              <button
                type="button"
                onClick={(e) => handleRemoveSelected(subcat, e)}
                className="w-7 h-7 rounded-lg hover:bg-white/15 flex items-center justify-center touch-manipulation"
                aria-label={`Ta bort ${subcat}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-stone-500">Inga valda</p>
      )}

      {/* New custom subcategory */}
      {isAddingNew && (
        <div className="flex items-center gap-1.5 animate-fade-in">
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
            placeholder="T.ex. Airfryer eller Surdeg"
            aria-label="Ny underkategori"
            className="flex-1 h-10 bg-[#FCFAF5] border border-[#EBE7DF] rounded-xl px-3 text-base sm:text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#284235]"
          />
          <button
            type="button"
            onClick={() => handleSaveCustom()}
            disabled={!customInput.trim()}
            className="h-10 px-3.5 bg-[#284235] text-white font-semibold text-xs rounded-xl disabled:opacity-40 touch-manipulation shrink-0"
          >
            Lägg till
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingNew(false);
              setCustomInput('');
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 touch-manipulation shrink-0"
            aria-label="Avbryt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowSuggestions((v) => !v)}
        aria-expanded={showSuggestions}
        className="flex items-center gap-1 text-xs font-semibold text-[#284235] min-h-[36px] touch-manipulation"
      >
        {showSuggestions ? 'Dölj förslag' : 'Visa förslag'}
        <ChevronDown className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
      </button>

      {showSuggestions && (
        <div className="space-y-3 animate-fade-in">
          {suggested.length > 0 && (
            <div className="space-y-1.5">
              <div className={groupHeading}>Förslag för {category.toLowerCase()}</div>
              <div className="flex flex-wrap gap-1.5">
                {suggested.map((subcat) => (
                  <button key={subcat} type="button" onClick={() => toggleSubcategory(subcat)} className={chip}>
                    <Plus className="w-3 h-3 text-stone-400" />
                    {subcat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dietary.length > 0 && (
            <div className="space-y-1.5">
              <div className={groupHeading}>Specialkost</div>
              <div className="flex flex-wrap gap-1.5">
                {dietary.map((subcat) => (
                  <button key={subcat} type="button" onClick={() => toggleSubcategory(subcat)} className={chip}>
                    <Plus className="w-3 h-3 text-stone-400" />
                    {subcat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {custom.length > 0 && (
            <div className="space-y-1.5">
              <div className={groupHeading}>Egna</div>
              <div className="flex flex-wrap gap-1.5">
                {custom.map((subcat) => (
                  <span key={subcat} className="inline-flex items-center rounded-xl bg-white border border-[#EBE7DF] text-xs font-semibold text-stone-700">
                    <button
                      type="button"
                      onClick={() => toggleSubcategory(subcat)}
                      className="pl-3 pr-1 min-h-[36px] flex items-center gap-1 touch-manipulation"
                    >
                      <Plus className="w-3 h-3 text-stone-400" />
                      {subcat}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomSubcategory(subcat, e)}
                      aria-label={`Radera ${subcat}`}
                      className="w-8 min-h-[36px] flex items-center justify-center text-stone-400 hover:text-rose-700 touch-manipulation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
