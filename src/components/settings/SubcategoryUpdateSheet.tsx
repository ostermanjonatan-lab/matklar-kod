import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useRecipes } from '../../context/RecipeContext';
import { formatRecipeTitle } from '../../utils/formatters';
import { applySubcategoryChanges, markReviewed, type RecipeSubcategoryUpdate } from '../../utils/subcategoryUpdates';

/**
 * Suggested new subcategories for recipes saved before they existed. Suggestions read from the
 * recipe's name are ticked, those only from the ingredients are not: those are for the user to
 * decide. Nothing changes until the button at the bottom, and then the suggestions not ticked
 * are not offered again.
 */
export const SubcategoryUpdateSheet: React.FC<{
  updates: RecipeSubcategoryUpdate[];
  onClose: () => void;
  onSaved: (recipeCount: number) => void;
}> = ({ updates, onClose, onSaved }) => {
  const { updateRecipe } = useRecipes();
  const key = (recipeId: string, i: number) => `${recipeId}#${i}`;
  const [chosen, setChosen] = useState<Set<string>>(() => {
    const set = new Set<string>();
    updates.forEach((u) => u.changes.forEach((c, i) => c.sure && set.add(key(u.recipe.id, i))));
    return set;
  });

  const toggle = (k: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const recipesToSave = useMemo(
    () => updates.filter((u) => u.changes.some((_, i) => chosen.has(key(u.recipe.id, i)))),
    [updates, chosen]
  );

  const save = () => {
    recipesToSave.forEach((u) => {
      const picked = u.changes.filter((_, i) => chosen.has(key(u.recipe.id, i)));
      updateRecipe(applySubcategoryChanges(u.recipe, picked));
    });
    // What was not ticked is not offered again
    markReviewed(updates);
    onSaved(recipesToSave.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Nya underkategorier"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl animate-scale-up max-h-[88vh] flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 border-b border-[#EBE7DF]">
          <h3 className="font-serif font-bold text-lg text-stone-900">Nya underkategorier</h3>
          <p className="text-xs text-stone-500 mt-1">Förbockat bygger på receptets namn. Resten kommer från ingredienserna, så välj själv.</p>
        </div>

        <div className="overflow-y-auto px-5 divide-y divide-[#EBE7DF]">
          {updates.map((u) => (
            <div key={u.recipe.id} className="py-3">
              <p className="text-sm font-semibold text-stone-900 leading-snug">{formatRecipeTitle(u.recipe.title)}</p>
              <div className="mt-1">
                {u.changes.map((change, i) => {
                  const k = key(u.recipe.id, i);
                  const on = chosen.has(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(k)}
                      className="w-full min-h-[40px] flex items-center gap-3 text-left text-sm touch-manipulation"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          on ? 'bg-[#284235] border-[#284235] text-white' : 'border-stone-300'
                        }`}
                      >
                        {on && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                      <span className={change.kind === 'remove' ? 'text-stone-500' : 'text-stone-800'}>
                        {change.kind === 'add' ? `Lägg till ${change.subcategory}` : `Ta bort ${change.subcategory}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-[#EBE7DF]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[46px] rounded-2xl bg-stone-100 text-stone-700 text-sm font-semibold touch-manipulation"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 min-h-[46px] rounded-2xl bg-[#284235] hover:bg-black text-white text-sm font-semibold touch-manipulation disabled:opacity-40"
          >
            {recipesToSave.length === 0
              ? 'Klar, ändra inget'
              : recipesToSave.length === 1
              ? 'Uppdatera 1 recept'
              : `Uppdatera ${recipesToSave.length} recept`}
          </button>
        </div>
      </div>
    </div>
  );
};
