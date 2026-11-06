import React, { useMemo, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useRecipes } from '../../context/RecipeContext';
import { parseSmartItemInput } from '../../utils/ingredientParser';
import { getFrequentItems } from '../../utils/frequentItems';

/** Quick choices for items you often buy. One tap adds the item to the list. */
export const FrequentItems: React.FC<{ limit?: number }> = ({ limit = 8 }) => {
  const { shoppingList, addCustomShoppingItem } = useRecipes();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const onList = useMemo(() => shoppingList.filter((i) => !i.checked).map((i) => i.name), [shoppingList]);
  // Keep the item just added visible for a moment, so the tick can be seen
  const items = useMemo(
    () => getFrequentItems(limit, onList.filter((n) => n.toLowerCase() !== justAdded?.toLowerCase())),
    [limit, onList, justAdded]
  );

  if (items.length === 0) return null;

  const add = (name: string) => {
    const parsed = parseSmartItemInput(name);
    addCustomShoppingItem({
      name: parsed.name || name,
      amount: parsed.amount,
      unit: parsed.unit,
      aisle: parsed.aisle,
      isPantryStaple: parsed.isPantryStaple,
    });
    setJustAdded(name);
    setTimeout(() => setJustAdded((cur) => (cur === name ? null : cur)), 1200);
  };

  return (
    <div className="space-y-1.5">
      <div className="text-xs text-stone-500">Vanliga varor</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((name) => {
          const added = justAdded === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => !added && add(name)}
              className={`inline-flex items-center gap-1 px-3 min-h-[36px] rounded-xl border text-sm touch-manipulation transition-colors ${
                added ? 'bg-[#284235] border-[#284235] text-white' : 'bg-white border-[#EBE7DF] text-stone-800 hover:bg-stone-50'
              }`}
              aria-label={added ? `${name} tillagd` : `Lägg till ${name}`}
            >
              {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-stone-400" />}
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
