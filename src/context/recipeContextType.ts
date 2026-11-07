/** Everything RecipeContext gives the app: the data and the actions on it. */
import type { Recipe, MealPlanDay, ShoppingItem, TabType, UserProfile, Household, PantryItem, HouseholdJoinRequest, PendingJoinState } from '../types/recipe';

export interface RecipeContextType {
  recipes: Recipe[];
  /** True while a phone in a household waits for the household's recipes the first time. */
  isLoadingHousehold: boolean;
  selectedRecipe: Recipe | null;
  activeTab: TabType;
  /** The seven days of the week shown in the meal plan (planWeekStart). */
  mealPlan: MealPlanDay[];
  /** Monday of the week shown in the meal plan, YYYY-MM-DD. */
  planWeekStart: string;
  /** Today's date (YYYY-MM-DD). Changes when the app is opened again on a new day. */
  today: string;
  setPlanWeekStart: (weekStart: string) => void;
  getMealPlanForDate: (dateStr: string) => MealPlanDay | undefined;
  shoppingList: ShoppingItem[];
  household: Household | null;
  households: Household[];
  currentUser: UserProfile;
  isHouseholdAdmin: boolean;
  realtimeStatus: 'connected' | 'connecting' | 'local_sync';
  isLiveSupabase: boolean;
  setActiveTab: (tab: TabType) => void;
  openRecipeDetail: (recipe: Recipe) => void;
  closeRecipeDetail: () => void;
  toggleFavorite: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  clearAllRecipes: () => void;
  setMealPlanForDay: (
    dayName: MealPlanDay['dayName'],
    mealType: 'lunch' | 'dinner',
    recipeId: string | null,
    customText?: string
  ) => void;
  setMealPlanServings: (
    dayName: MealPlanDay['dayName'],
    mealType: 'lunch' | 'dinner',
    servings: number
  ) => void;
  setMealPlanForDate: (
    dateStr: string,
    mealType: 'lunch' | 'dinner',
    recipeId: string | null,
    customText?: string
  ) => void;
  clearMealPlan: () => void;
  generateShoppingListFromWeek: (skipPantryStaples: boolean) => number;
  addIngredientsToShoppingList: (
    ingredients: Array<{ name: string; amount: number | null; unit: string; aisle: string; isPantryStaple: boolean }>,
    recipeTitle?: string,
    skipPantryStaples?: boolean
  ) => number;
  restoreShoppingList: (items: ShoppingItem[]) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  clearCheckedShoppingItems: () => void;
  addCustomShoppingItem: (item: {
    name: string;
    amount: number | null;
    unit: string;
    aisle: string;
    isPantryStaple: boolean;
    comment?: string;
  }) => void;
  updateShoppingItemComment: (id: string, comment: string) => void;
  /** Changes the name, amount or unit of an item in the shopping list */
  updateShoppingItem: (id: string, changes: Pick<ShoppingItem, 'name' | 'amount' | 'unit'>) => void;
  updateShoppingItemAisle: (id: string, aisle: string) => void;
  rememberShoppingAisle: (name: string, aisle: string) => void;
  setHouseholdName: (name: string) => void;
  createHousehold: (name: string, creatorName?: string, creatorRole?: string, includeStarterRecipes?: boolean) => void;
  joinHouseholdByCode: (code: string, memberName?: string, memberRole?: string) => Promise<boolean>;
  switchHousehold: (householdId: string) => void;
  deleteHousehold: (householdId: string) => Promise<void>;
  leaveHousehold: (householdId?: string) => Promise<boolean>;
  regenerateHouseholdCode: (householdId?: string) => string;
  addMemberToHousehold: (member: { displayName: string; roleTitle?: string }) => void;
  updateMemberInHousehold: (memberId: string, updates: { displayName: string; roleTitle?: string }) => void;
  removeMemberFromHousehold: (memberId: string) => Promise<boolean>;
  joinRequests: HouseholdJoinRequest[];
  pendingJoin: PendingJoinState | null;
  approveJoinRequest: (requestId: string) => Promise<boolean>;
  rejectJoinRequest: (requestId: string) => Promise<boolean>;
  cancelPendingJoin: () => void;
  setCurrentUser: (user: UserProfile) => void;
  resetToMockData: () => void;
  lastSyncTimestamp: number;
  customSubcategories: string[];
  addCustomSubcategory: (subcat: string) => void;
  removeCustomSubcategory: (subcat: string) => void;
  pantryItems: PantryItem[];
  addPantryItem: (item: {
    name: string;
    amount?: number | null;
    unit?: string;
    aisle?: string;
    comment?: string;
    isOutOfStock?: boolean;
  }) => void;
  updatePantryItem: (item: PantryItem) => void;
  deletePantryItem: (id: string) => void;
  togglePantryItemStock: (id: string, isOutOfStock?: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}
