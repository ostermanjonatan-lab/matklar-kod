import type { Recipe } from '../types/recipe';
import { getRecipeSubcategories } from '../types/recipe';
import { DEFAULT_SUBCATEGORIES, DIETARY_SUBCATEGORIES } from '../data/categories';
import { detectSubcategories } from './categoryDetector';

/** The subcategories added in 1.0.186, which recipes saved before then can't have */
const NEW_SUBCATEGORIES = new Set([
  'Pizza',
  'Paj',
  'Wraps & Bröd',
  'Bowls',
  'Medelhav & Mellanöstern',
  'Grill',
  'Bröd',
  'Yoghurt & Fil',
  'Marinader & Rubs',
  'Saft & Lemonad',
  'Proteinrikt',
  'Barnvänligt',
]);

/**
 * What a new subcategory took the place of, when it was guessed before: a pizza was filed as
 * Husmanskost since nothing else fitted, a pie under Ugn & Gratäng, a poke bowl as a salad.
 */
const REPLACES: Record<string, string[]> = {
  Pizza: ['Husmanskost'],
  Paj: ['Husmanskost', 'Ugn & Gratäng'],
  'Wraps & Bröd': ['Husmanskost'],
  Bowls: ['Husmanskost', 'Sallader'],
  'Medelhav & Mellanöstern': ['Husmanskost'],
  Grill: ['Husmanskost'],
  Bröd: ['Gröt & Müsli', 'Smörgåsar & Mackor'],
  'Yoghurt & Fil': ['Gröt & Müsli'],
  'Marinader & Rubs': ['Kalla såser'],
  'Saft & Lemonad': ['Alkoholfritt', 'Måltidsdryck'],
};

export interface SubcategoryChange {
  kind: 'add' | 'remove';
  subcategory: string;
  /** Read from the recipe's name. Otherwise only from its ingredients or description. */
  sure: boolean;
}

export interface RecipeSubcategoryUpdate {
  recipe: Recipe;
  changes: SubcategoryChange[];
}

/** Suggested new subcategories for one recipe, and the guessed ones they replace */
export function suggestSubcategoryChanges(recipe: Recipe): SubcategoryChange[] {
  const current = getRecipeSubcategories(recipe);
  const allowed = new Set([...(DEFAULT_SUBCATEGORIES[recipe.category] || []), ...DIETARY_SUBCATEGORIES]);
  const fromName = new Set(detectSubcategories(recipe.title, recipe.category));
  const fromAll = detectSubcategories(recipe.title, recipe.category, recipe.ingredients || [], recipe.description || '');

  const adds = fromAll
    .filter((s) => NEW_SUBCATEGORIES.has(s) && allowed.has(s) && !current.includes(s))
    .map((s): SubcategoryChange => ({ kind: 'add', subcategory: s, sure: fromName.has(s) }));
  if (adds.length === 0) return [];

  // A guess that the new one replaces is taken away, unless the recipe still is that too
  const removes: SubcategoryChange[] = [];
  for (const add of adds) {
    for (const old of REPLACES[add.subcategory] || []) {
      if (current.includes(old) && !fromAll.includes(old) && !removes.some((r) => r.subcategory === old)) {
        removes.push({ kind: 'remove', subcategory: old, sure: add.sure });
      }
    }
  }
  return [...adds, ...removes];
}

// Suggestions already looked at on this phone, chosen or not, so they are not offered again
const REVIEWED_KEY = 'matklar_subcategory_reviewed_v1';
const changeKey = (recipeId: string, c: SubcategoryChange) => `${recipeId}|${c.kind}|${c.subcategory}`;

function loadReviewed(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEWED_KEY) || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/** Remembers that these suggestions have been looked at */
export function markReviewed(updates: RecipeSubcategoryUpdate[]) {
  const reviewed = loadReviewed();
  updates.forEach((u) => u.changes.forEach((c) => reviewed.add(changeKey(u.recipe.id, c))));
  try {
    localStorage.setItem(REVIEWED_KEY, JSON.stringify(Array.from(reviewed)));
  } catch {
    // Offered again next time
  }
}

/** The recipes that have something to update that has not been looked at */
export function findSubcategoryUpdates(recipes: Recipe[]): RecipeSubcategoryUpdate[] {
  const reviewed = loadReviewed();
  return recipes
    .map((recipe) => ({
      recipe,
      changes: suggestSubcategoryChanges(recipe).filter((c) => !reviewed.has(changeKey(recipe.id, c))),
    }))
    .filter((u) => u.changes.some((c) => c.kind === 'add'));
}

/** The recipe with the chosen changes made */
export function applySubcategoryChanges(recipe: Recipe, changes: SubcategoryChange[]): Recipe {
  let list = getRecipeSubcategories(recipe);
  for (const change of changes) {
    if (change.kind === 'add' && !list.includes(change.subcategory)) list = [...list, change.subcategory];
    if (change.kind === 'remove') list = list.filter((s) => s !== change.subcategory);
  }
  return { ...recipe, subcategories: list, subcategory: list.join(', ') };
}
