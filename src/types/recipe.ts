export type RecipeSourceType = 'manual' | 'url' | 'pdf' | 'recipe_image';

export type RecipeCategory = 'Middag' | 'Förrätt' | 'Efterrätt' | 'Såser' | 'Dryck' | 'Frukost' | 'Mellanmål' | string;

export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string;
  aisle: string;
  isPantryStaple: boolean;
}

export interface Instruction {
  stepNumber: number;
  text: string;
}

export type RecipeDifficulty = 1 | 2 | 3;

export interface Recipe {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  recipeDocumentUrl?: string;
  sourceUrl?: string;
  sourceType: RecipeSourceType;
  servings: number;
  category: RecipeCategory;
  subcategory: string;
  subcategories?: string[];
  rating: number; // 1-5
  isFavorite: boolean;
  notes: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  householdId: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  tags?: string[];
  /** 1 = lätt, 2 = medel, 3 = svår. Missing when not set. */
  difficulty?: RecipeDifficulty;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Resolves an accurate creation timestamp (in ms) for sorting recipes by date added.
 * Checks recipe.createdAt, embedded ID timestamps (e.g. custom-rec-<timestamp>),
 * and fallback sequential starter recipe IDs (e.g. rec-1 to rec-29).
 */
export function getRecipeTimestamp(recipe?: Partial<Recipe> | null): number {
  if (!recipe) return 0;
  if (recipe.createdAt) {
    const time = new Date(recipe.createdAt).getTime();
    if (!isNaN(time) && time > 0) return time;
  }
  if (typeof recipe.id === 'string') {
    const customMatch = recipe.id.match(/^custom-rec-(\d+)$/);
    if (customMatch) {
      const ts = parseInt(customMatch[1], 10);
      if (!isNaN(ts) && ts > 0) return ts;
    }
    const recMatch = recipe.id.match(/^rec-(\d+)$/);
    if (recMatch) {
      // Starter recipes rec-1 .. rec-29:
      // rec-1 is showcase #1, rec-29 is showcase #29.
      // Base date in the past so any user-created recipe is always newer.
      return 1704067200000 + (1000 - parseInt(recMatch[1], 10)) * 60000;
    }
  }
  if (recipe.updatedAt) {
    const time = new Date(recipe.updatedAt).getTime();
    if (!isNaN(time) && time > 0) return time;
  }
  return 0;
}

/**
 * A recipe is considered "Ny" if it was added within the last 24 hours (1 dygn).
 * Starter recipes (rec-1 .. rec-29) are never considered "Ny".
 */
export function isRecipeNew(recipe?: Partial<Recipe> | null): boolean {
  if (!recipe) return false;
  if (typeof recipe.id === 'string' && /^rec-\d+$/.test(recipe.id)) {
    return false;
  }
  const timestamp = getRecipeTimestamp(recipe);
  if (!timestamp || timestamp <= 0) return false;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - timestamp;
  // Allow slight clock skew (-60s) up to 24 hours (1 dygn)
  return elapsed >= -60000 && elapsed < ONE_DAY_MS;
}

export const NON_FOOD_SUBCATEGORIES = new Set([
  'Vardag',
  'Helglyx',
  'Snabblagat',
  'Fika',
  'Brunch',
  'Hemlagat',
  'Vardagsmat',
  'Fredagsmys',
]);

/**
 * Safely extracts all subcategories from a recipe, handling both modern array
 * format and legacy comma-separated/single string format.
 * Strips out meta tags (e.g. Vardag, Helglyx) so only pure food categories remain.
 */
export function getRecipeSubcategories(recipe?: Partial<Recipe> | null): string[] {
  if (!recipe) return [];
  let subcats: string[] = [];
  if (Array.isArray(recipe.subcategories) && recipe.subcategories.length > 0) {
    subcats = recipe.subcategories.map((s) => s.trim()).filter(Boolean);
  } else if (recipe.subcategory && typeof recipe.subcategory === 'string') {
    subcats = recipe.subcategory
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const clean = subcats.filter((s) => !NON_FOOD_SUBCATEGORIES.has(s));
  const result: string[] = [];
  const text = `${recipe.title || ''} ${recipe.description || ''} ${recipe.notes || ''} ${(recipe.ingredients || []).map((i) => i.name || '').join(' ')}`.toLowerCase();
  clean.forEach((s) => {
    if (s === 'Soppor & Grytor' || s === 'Grytor & Soppor') {
      const isSoup = /soppa|gazpacho|buljong|minestrone|ramen/i.test(text);
      const isStew = /gryta|chili|gulasch|kalops|stroganoff|boeuf|daal|tagine|dillkött/i.test(text);
      if (isSoup && !isStew) {
        if (!result.includes('Soppor')) result.push('Soppor');
      } else if (isStew && !isSoup) {
        if (!result.includes('Grytor')) result.push('Grytor');
      } else {
        if (!result.includes('Grytor')) result.push('Grytor');
        if (!result.includes('Soppor')) result.push('Soppor');
      }
    } else if (s === 'Fisk & Skaldjur' || s === 'Skaldjur & Fisk') {
      const isFish = /fisk|lax|torsk|sej|kolja|tonfisk|sill|strömming|abborre|gös|hälleflundra|havskatt|rödspätta|makrill|fisksoppa|fiskgratäng/i.test(text);
      const isShellfish = /skaldjur|räk|räkor|kräft|kräftor|hummer|mussl|musslor|ostron|bläckfisk|scampi|gambas|krabb|havskräft|skagen|löjrom|stenbitsrom/i.test(text);
      if (isFish && !isShellfish) {
        if (!result.includes('Fisk')) result.push('Fisk');
      } else if (isShellfish && !isFish) {
        if (!result.includes('Skaldjur')) result.push('Skaldjur');
      } else {
        if (!result.includes('Fisk')) result.push('Fisk');
        if (!result.includes('Skaldjur')) result.push('Skaldjur');
      }
    } else if (s === 'Vegetariskt & Veganskt') {
      const isVegan = /vegansk|veganskt|vegan|växtbaserad/i.test(text);
      if (isVegan) {
        if (!result.includes('Veganskt')) result.push('Veganskt');
      } else {
        if (!result.includes('Vegetariskt')) result.push('Vegetariskt');
      }
    } else {
      if (!result.includes(s)) result.push(s);
    }
  });

  return result;
}

export interface MealPlanDay {
  dayName: 'Måndag' | 'Tisdag' | 'Onsdag' | 'Torsdag' | 'Fredag' | 'Lördag' | 'Söndag';
  dateStr?: string;
  lunchRecipeId?: string | null;
  lunchServings?: number;
  dinnerRecipeId?: string | null;
  dinnerServings?: number;
  customLunch?: string;
  customDinner?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: number | null;
  unit: string;
  aisle: string;
  isPantryStaple: boolean;
  checked: boolean;
  recipeSource?: string;
  mergedSources?: string[];
  comment?: string;
}

export interface HouseholdJoinRequest {
  id: string;
  householdId: string;
  userId: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface PendingJoinState {
  requestId: string;
  householdId: string;
  householdName: string;
  joinCode: string;
  displayName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  initials: string;
  email?: string;
  roleTitle?: string;
  isAdmin?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Household {
  id: string;
  name: string;
  joinCode: string;
  creatorId?: string;
  members: UserProfile[];
  joinRequests?: HouseholdJoinRequest[];
}

export interface PantryItem {
  id: string;
  name: string;
  amount?: number | null;
  unit?: string;
  aisle: string;
  isOutOfStock: boolean;
  comment?: string;
  createdAt?: string;
}

export type TabType = 'recipes' | 'mealplan' | 'shopping' | 'settings';
