/**
 * Pure helpers for the app's data: cleaning up saved recipes and building the meal plan week.
 * They hold no state, so they are kept apart from RecipeContext.
 */
import type { Recipe, MealPlanDay } from '../types/recipe';
import { getRecipeSubcategories } from '../types/recipe';
import { WEEKDAY_NAMES, dayNameForDate, getWeekDates, getWeekStart, isISODate } from '../utils/mealPlanDates';
import { isCommonPantryStaple, resolveSavedAisle } from '../utils/ingredientParser';

// Auto-repair known broken or duplicate images for starter demo recipes
const STARTER_IMAGE_FIXES: Record<string, string> = {
  'rec-9': 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=1200&q=80',
  'rec-18': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?auto=format&fit=crop&w=1200&q=80',
  'rec-20': 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=1200&q=80',
  'rec-21': 'https://images.unsplash.com/photo-1592417817098-8f3d6910985a?auto=format&fit=crop&w=1200&q=80',
};

export function hasMeal(d: MealPlanDay): boolean {
  return Boolean(d.dinnerRecipeId || d.lunchRecipeId || d.customDinner?.trim() || d.customLunch?.trim());
}

export function emptyPlanDay(dateStr: string): MealPlanDay {
  return {
    dayName: dayNameForDate(dateStr),
    dateStr,
    dinnerRecipeId: null,
    dinnerServings: 4,
    lunchRecipeId: null,
    lunchServings: 2,
    customDinner: '',
    customLunch: '',
  };
}

/**
 * Cleans the stored meal plan. Every day has a date. Days saved by older versions only have a
 * weekday name; they are placed in the current week, unless that date already has its own entry.
 * Days without any meal are dropped, and recipe ids that no longer exist are removed.
 */
export function normalizeMealPlan(
  rawPlan: MealPlanDay[] | null | undefined,
  currentRecipes?: Recipe[]
): MealPlanDay[] {
  const recipeIdSet = currentRecipes ? new Set(currentRecipes.map((r) => r.id)) : null;
  const list = Array.isArray(rawPlan) ? rawPlan.filter(Boolean) : [];
  const currentWeek = getWeekDates(getWeekStart());
  const byDate = new Map<string, MealPlanDay>();

  list.forEach((d) => {
    if (isISODate(d.dateStr)) byDate.set(d.dateStr, d);
  });
  list.forEach((d) => {
    if (isISODate(d.dateStr)) return;
    const idx = WEEKDAY_NAMES.indexOf(d.dayName);
    if (idx === -1) return;
    const date = currentWeek[idx];
    if (!byDate.has(date)) byDate.set(date, { ...d, dateStr: date });
  });

  const cleanId = (id?: string | null) => (id ? (recipeIdSet ? (recipeIdSet.has(id) ? id : null) : id) : null);

  return Array.from(byDate.entries())
    .map(([dateStr, d]) => ({
      dayName: dayNameForDate(dateStr),
      dateStr,
      dinnerRecipeId: cleanId(d.dinnerRecipeId),
      dinnerServings: d.dinnerServings && d.dinnerServings > 0 ? d.dinnerServings : 4,
      lunchRecipeId: cleanId(d.lunchRecipeId),
      lunchServings: d.lunchServings && d.lunchServings > 0 ? d.lunchServings : 2,
      customDinner: d.customDinner || '',
      customLunch: d.customLunch || '',
    }))
    .filter(hasMeal)
    .sort((x, y) => x.dateStr.localeCompare(y.dateStr));
}

/** The seven days of a week, with empty days filled in. */
export function buildWeek(plan: MealPlanDay[], weekStart: string): MealPlanDay[] {
  return getWeekDates(weekStart).map((date) => plan.find((d) => d.dateStr === date) || emptyPlanDay(date));
}

export function sanitizeRecipe(recipe: Recipe): Recipe {
  const clean = getRecipeSubcategories(recipe);
  const cleanIngredients = (recipe.ingredients || []).map((ing) => ({
    ...ing,
    aisle: resolveSavedAisle(ing.name, ing.aisle),
    isPantryStaple: isCommonPantryStaple(ing.name),
  }));

  // Ensure unified Tillagningstid: prepTimeMinutes is always 0
  const cookingTime = typeof recipe.cookTimeMinutes === 'number' && recipe.cookTimeMinutes > 0
    ? recipe.cookTimeMinutes
    : (typeof recipe.prepTimeMinutes === 'number' && recipe.prepTimeMinutes > 0 ? recipe.prepTimeMinutes : 0);

  // Auto-heal broken demo images or URL typos from previous versions
  let coverImageUrl = recipe.coverImageUrl;
  if (recipe.id && STARTER_IMAGE_FIXES[recipe.id]) {
    if (recipe.id === 'rec-9' && (coverImageUrl?.includes('1621996346565-e3d5d6281691') || !coverImageUrl)) {
      coverImageUrl = STARTER_IMAGE_FIXES['rec-9'];
    } else if (recipe.id === 'rec-21' && (coverImageUrl?.includes('1592417817098-8f3d6910985c') || !coverImageUrl)) {
      coverImageUrl = STARTER_IMAGE_FIXES['rec-21'];
    } else if (recipe.id === 'rec-20' && coverImageUrl?.includes('1551183053-bf91a1d81141')) {
      coverImageUrl = STARTER_IMAGE_FIXES['rec-20'];
    } else if (recipe.id === 'rec-18' && coverImageUrl?.includes('1519708227418-c8fd9a32b7a2')) {
      coverImageUrl = STARTER_IMAGE_FIXES['rec-18'];
    }
  }

  // Also catch broken Unsplash hashes directly regardless of recipe ID
  if (coverImageUrl?.includes('1621996346565-e3d5d6281691')) {
    coverImageUrl = STARTER_IMAGE_FIXES['rec-9'];
  } else if (coverImageUrl?.includes('1592417817098-8f3d6910985c')) {
    coverImageUrl = STARTER_IMAGE_FIXES['rec-21'];
  }

  return {
    ...recipe,
    coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80',
    subcategories: clean,
    subcategory: clean.join(', '),
    ingredients: cleanIngredients,
    prepTimeMinutes: 0,
    cookTimeMinutes: cookingTime,
  };
}
