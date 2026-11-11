import { useEffect, useState } from 'react';
import type { Ingredient, Recipe } from '../types/recipe';
import { detectAisle, isCommonPantryStaple } from './ingredientParser';

/**
 * Ingredients swapped for something else in a recipe, on this phone: havregrädde instead of
 * grädde. The recipe itself is not changed. The swap lasts until it is undone, and is used for
 * the ingredient list, the steps, the nutrition and what goes into the shopping list.
 */
export interface IngredientSwap {
  /** The ingredient's place in the recipe */
  index: number;
  /** The name it had, so a swap is dropped if the recipe is edited and the row is something else */
  original: string;
  name: string;
  /** For the recipe's own number of servings */
  amount: number | null;
  unit: string;
}

const SWAPS_KEY = 'matklar_ingredient_swaps_v1';
const CHANGED_EVENT = 'matklar-swaps-changed';

function loadAll(): Record<string, IngredientSwap[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SWAPS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, IngredientSwap[]>) {
  try {
    localStorage.setItem(SWAPS_KEY, JSON.stringify(all));
  } catch {
    // Kept until the app is closed
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** The swaps that still fit the recipe as it is now */
function validSwaps(recipe: Recipe, swaps: IngredientSwap[] | undefined): IngredientSwap[] {
  return (swaps || []).filter((s) => recipe.ingredients[s.index]?.name === s.original);
}

/** The recipe with its swapped ingredients in place */
export function applySwaps(recipe: Recipe, swaps: IngredientSwap[] | undefined): Recipe {
  const valid = validSwaps(recipe, swaps);
  if (valid.length === 0) return recipe;
  const byIndex = new Map(valid.map((s) => [s.index, s]));
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ing, i): Ingredient => {
      const swap = byIndex.get(i);
      if (!swap) return ing;
      return {
        name: swap.name,
        amount: swap.amount,
        unit: swap.unit,
        aisle: detectAisle(swap.name),
        isPantryStaple: isCommonPantryStaple(swap.name),
      };
    }),
  };
}

/** The recipe with the swaps saved on this phone, for adding it to the shopping list */
export function withStoredSwaps(recipe: Recipe): Recipe {
  return applySwaps(recipe, loadAll()[recipe.id]);
}

/** The swaps in one recipe, kept up to date */
export function useIngredientSwaps(recipe: Recipe) {
  const [all, setAll] = useState(loadAll);

  useEffect(() => {
    const reload = () => setAll(loadAll());
    window.addEventListener(CHANGED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGED_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const swaps = validSwaps(recipe, all[recipe.id]);

  const update = (next: IngredientSwap[]) => {
    const updated = loadAll();
    if (next.length > 0) updated[recipe.id] = next;
    else delete updated[recipe.id];
    saveAll(updated);
    setAll(updated);
  };

  const setSwap = (index: number, replacement: { name: string; amount: number | null; unit: string }) => {
    const original = recipe.ingredients[index]?.name;
    if (original === undefined) return;
    update([...swaps.filter((s) => s.index !== index), { index, original, ...replacement }]);
  };

  const removeSwap = (index: number) => update(swaps.filter((s) => s.index !== index));

  return { swaps, setSwap, removeSwap };
}
