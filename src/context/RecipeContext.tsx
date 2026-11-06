import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Recipe, MealPlanDay, ShoppingItem, TabType, UserProfile, Household, PantryItem, HouseholdJoinRequest, PendingJoinState } from '../types/recipe';
import { getRecipeSubcategories, NON_FOOD_SUBCATEGORIES } from '../types/recipe';
import { INITIAL_RECIPES, INITIAL_MEAL_PLAN } from '../data/mockRecipes';
import { recordFrequentItem } from '../utils/frequentItems';
import { withLeftoverPortions, syncLeftoverLunches } from '../utils/leftovers';
import {
  WEEKDAY_NAMES,
  dayNameForDate,
  getWeekDates,
  getWeekStart,
  isISODate,
  todayISO,
} from '../utils/mealPlanDates';
import { isCommonPantryStaple, detectAisle, resolveSavedAisle } from '../utils/ingredientParser';

// Auto-repair known broken or duplicate images for starter demo recipes
const STARTER_IMAGE_FIXES: Record<string, string> = {
  'rec-9': 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=1200&q=80',
  'rec-18': 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?auto=format&fit=crop&w=1200&q=80',
  'rec-20': 'https://images.unsplash.com/photo-1625944525533-473f1a3d54e7?auto=format&fit=crop&w=1200&q=80',
  'rec-21': 'https://images.unsplash.com/photo-1592417817098-8f3d6910985a?auto=format&fit=crop&w=1200&q=80',
};

function hasMeal(d: MealPlanDay): boolean {
  return Boolean(d.dinnerRecipeId || d.lunchRecipeId || d.customDinner?.trim() || d.customLunch?.trim());
}

function emptyPlanDay(dateStr: string): MealPlanDay {
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
function normalizeMealPlan(
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
function buildWeek(plan: MealPlanDay[], weekStart: string): MealPlanDay[] {
  return getWeekDates(weekStart).map((date) => plan.find((d) => d.dateStr === date) || emptyPlanDay(date));
}

function sanitizeRecipe(recipe: Recipe): Recipe {
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
import {
  broadcastLocalChange,
  subscribeToLocalChanges,
  subscribeToSupabaseRealtime,
  pushRecipeToSupabase,
  deleteRecipeFromSupabase,
  pushMealPlanToSupabase,
  pushShoppingItemsToSupabase,
  updateShoppingItemCheckedInSupabase,
  updateShoppingItemCommentInSupabase,
  updateShoppingItemAisleInSupabase,
  pushAisleOverrideToSupabase,
  syncAisleOverridesWithSupabase,
  subscribeToAisleOverrides,
  mapRowToShoppingItem,
  deleteShoppingItemFromSupabase,
  deleteShoppingItemsFromSupabase,
  fetchHouseholdDataFromSupabase,
  findHouseholdByJoinCode,
  mapRowToRecipe,
  createJoinRequestInSupabase,
  updateJoinRequestStatusInSupabase,
  fetchJoinRequestsFromSupabase,
  checkJoinRequestStatusInSupabase,
  deleteJoinRequestInSupabase,
  subscribeToJoinRequestApproval,
  safeUpsertProfileInSupabase,
  safeUpsertHouseholdInSupabase,
} from '../services/realtimeSync';
import { getSupabase, getSupabaseConfig, syncServerSupabaseConfig } from '../services/supabaseClient';
import {
  generateShoppingListFromMealPlan,
  mergeIngredientsIntoShoppingList,
  normalizeIngredientKey,
  normalizeIngredientNameForMatching,
  getAisleOverride,
  setAisleOverride,
  clearAisleOverrides,
} from '../utils/shoppingAggregator';

interface RecipeContextType {
  recipes: Recipe[];
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
  updateShoppingItemAisle: (id: string, aisle: string) => void;
  rememberShoppingAisle: (name: string, aisle: string) => void;
  setHouseholdName: (name: string) => void;
  createHousehold: (name: string, creatorName?: string, creatorRole?: string, includeStarterRecipes?: boolean) => void;
  joinHouseholdByCode: (code: string, memberName?: string, memberRole?: string) => Promise<boolean>;
  switchHousehold: (householdId: string) => void;
  deleteHousehold: (householdId: string) => void;
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

const RecipeContext = createContext<RecipeContextType | undefined>(undefined);

const RECIPES_STORAGE_KEY = 'receptapp_recipes_v3';
const STARTER_SEEDED_KEY = 'receptapp_starter_seeded_v1';
const MEAL_PLAN_STORAGE_KEY = 'receptapp_mealplan_v3';
const SHOPPING_STORAGE_KEY = 'receptapp_shopping_v3';
const PANTRY_STORAGE_KEY = 'receptapp_pantry_items_v1';
const HOUSEHOLDS_STORAGE_KEY = 'receptapp_households_v4';
const ACTIVE_HOUSEHOLD_ID_KEY = 'receptapp_active_hh_v4';
const USER_STORAGE_KEY = 'receptapp_user_v3';
const CUSTOM_SUBCATEGORIES_STORAGE_KEY = 'receptapp_custom_subcategories_v1';
const PENDING_JOIN_STORAGE_KEY = 'receptapp_pending_join_v1';

export const RecipeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [households, setHouseholds] = useState<Household[]>(() => {
    try {
      const saved = localStorage.getItem(HOUSEHOLDS_STORAGE_KEY);
      if (saved) {
        const parsed: Household[] = JSON.parse(saved);
        // Automatically migrate any legacy joinCode (like "KÖK-4226") to pure 6 digits!
        return parsed.map((h) => {
          let joinCode = h.joinCode;
          if (!joinCode || !/^\d{6}$/.test(joinCode)) {
            const digits = joinCode ? joinCode.replace(/\D/g, '') : '';
            let newCode = digits;
            while (newCode.length < 6) {
              newCode += Math.floor(Math.random() * 10).toString();
            }
            newCode = newCode.slice(0, 6);
            if (!/^\d{6}$/.test(newCode)) {
              newCode = Math.floor(100000 + Math.random() * 900000).toString();
            }
            joinCode = newCode;
          }
          const creatorId = h.creatorId || (h.members && h.members.length > 0 ? h.members[0].id : undefined);
          const members = (h.members || []).map((m, idx) => {
            const isCreator = m.id === creatorId || (!creatorId && idx === 0);
            return {
              ...m,
              roleTitle: isCreator ? 'Admin' : (m.roleTitle && m.roleTitle !== 'Huvudkock' ? m.roleTitle : 'Medlem'),
              isAdmin: isCreator,
            };
          });
          return {
            ...h,
            joinCode,
            creatorId,
            members,
          };
        });
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_HOUSEHOLD_ID_KEY) || null;
    } catch {
      return null;
    }
  });

  const household = households.find((h) => h.id === activeHouseholdId) || (households.length > 0 ? households[0] : null);

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          roleTitle: parsed.roleTitle || (parsed.isAdmin ? 'Admin' : 'Medlem'),
          isAdmin: parsed.isAdmin ?? (parsed.roleTitle === 'Admin' || parsed.id === 'user-default'),
        };
      }
      return { id: 'user-default', displayName: 'Huvudkock', initials: 'H', roleTitle: 'Admin', isAdmin: true };
    } catch {
      return { id: 'user-default', displayName: 'Huvudkock', initials: 'H', roleTitle: 'Admin', isAdmin: true };
    }
  });

  const currentUserRef = useRef<UserProfile>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const isHouseholdAdmin = useMemo(() => {
    if (!household) return true;
    if (!household.members || household.members.length === 0) return true;

    // Find the household creator / admin ID
    const adminMember = household.members.find((m) => m.isAdmin) || household.members[0];
    const adminId = household.creatorId || adminMember?.id;
    if (!adminId) return true;

    // Direct ID match
    if (currentUser.id === adminId) return true;

    // If currentUser is already identified as a member with a different ID
    const myMemberRecord = household.members.find((m) => m.id === currentUser.id);
    if (myMemberRecord) {
      return Boolean(myMemberRecord.isAdmin || myMemberRecord.id === adminId);
    }

    // Fallback only if currentUser.id is not yet in members:
    // Match by exact display name, but only if that member record itself is the admin
    if (adminMember && currentUser.displayName) {
      const isExactAdminName = currentUser.displayName.trim().toLowerCase() === adminMember.displayName.trim().toLowerCase();
      if (isExactAdminName && (currentUser.isAdmin || currentUser.roleTitle === 'Admin')) {
        return true;
      }
    }

    return false;
  }, [household, currentUser]);

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem(RECIPES_STORAGE_KEY);
      if (saved !== null) {
        const parsed: Recipe[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(sanitizeRecipe);
        }
      }

      // Check if this device has already seeded or explicitly cleared starter recipes
      const hasSeeded = localStorage.getItem(STARTER_SEEDED_KEY);
      if (hasSeeded === 'true') {
        return [];
      }

      // First time launch on this device: seed starter demo recipes once
      localStorage.setItem(STARTER_SEEDED_KEY, 'true');
      return INITIAL_RECIPES.map(sanitizeRecipe);
    } catch {
      return INITIAL_RECIPES.map(sanitizeRecipe);
    }
  });

  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>(() => {
    try {
      const saved = localStorage.getItem(MEAL_PLAN_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return normalizeMealPlan(parsed || INITIAL_MEAL_PLAN, recipes);
    } catch {
      return normalizeMealPlan(INITIAL_MEAL_PLAN, recipes);
    }
  });

  const [planWeekStart, setPlanWeekStartState] = useState<string>(() => getWeekStart());
  const setPlanWeekStart = useCallback((weekStart: string) => {
    setPlanWeekStartState(getWeekStart(weekStart));
  }, []);
  // The app can stay open in the background for days. When it comes back on a new day,
  // everything is drawn again so "i dag" is right, and the plan moves on if it showed
  // the week that was current before.
  const [today, setToday] = useState<string>(() => todayISO());
  const todayRef = useRef(today);
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      const prev = todayRef.current;
      const now = todayISO();
      if (prev === now) return;
      todayRef.current = now;
      setToday(now);
      setPlanWeekStartState((week) => (week === getWeekStart(prev) ? getWeekStart(now) : week));
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 60000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, []);
  const weekMealPlan = useMemo(() => buildWeek(mealPlan, planWeekStart), [mealPlan, planWeekStart]);
  const getMealPlanForDate = useCallback(
    (dateStr: string) => mealPlan.find((d) => d.dateStr === dateStr),
    [mealPlan]
  );

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    try {
      const saved = localStorage.getItem(SHOPPING_STORAGE_KEY);
      if (saved) {
        const parsed: ShoppingItem[] = JSON.parse(saved);
        const { mergedList } = mergeIngredientsIntoShoppingList(
          [],
          parsed.map((item) => ({
            ...item,
            aisle: resolveSavedAisle(item.name, item.aisle),
            isPantryStaple: typeof item.isPantryStaple === 'boolean' ? item.isPantryStaple : isCommonPantryStaple(item.name),
          }))
        );
        return mergedList;
      }
      return [
        { id: 'shop-1', name: 'Spaghetti eller Rigatoni', amount: 400, unit: 'g', aisle: 'Skafferi', isPantryStaple: false, checked: false, recipeSource: 'Klassisk Krämig Pasta Carbonara (4 port)' },
        { id: 'shop-2', name: 'Guanciale eller Pancetta', amount: 200, unit: 'g', aisle: 'Kött & Chark', isPantryStaple: false, checked: false, recipeSource: 'Klassisk Krämig Pasta Carbonara (4 port)' },
        { id: 'shop-3', name: 'Pecorino Romano', amount: 80, unit: 'g', aisle: 'Mejeri', isPantryStaple: false, checked: true, recipeSource: 'Klassisk Krämig Pasta Carbonara (4 port)' },
        { id: 'shop-4', name: 'Färska äggulor', amount: 4, unit: 'st', aisle: 'Mejeri', isPantryStaple: false, checked: false, recipeSource: 'Klassisk Krämig Pasta Carbonara (4 port)' },
      ];
    } catch {
      return [];
    }
  });

  const [pantryItems, setPantryItems] = useState<PantryItem[]>(() => {
    try {
      const saved = localStorage.getItem(PANTRY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const validTabs: TabType[] = ['recipes', 'mealplan', 'shopping', 'settings'];
      const searchTab = new URLSearchParams(window.location.search).get('tab');
      if (searchTab && validTabs.includes(searchTab as TabType)) {
        return searchTab as TabType;
      }
      const hash = window.location.hash.replace(/^#/, '');
      if (validTabs.includes(hash as TabType)) {
        return hash as TabType;
      }
    }
    return 'recipes';
  });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(() => Date.now());

  const [joinRequests, setJoinRequests] = useState<HouseholdJoinRequest[]>([]);
  const [pendingJoin, setPendingJoin] = useState<PendingJoinState | null>(() => {
    try {
      const saved = localStorage.getItem(PENDING_JOIN_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (pendingJoin) {
        localStorage.setItem(PENDING_JOIN_STORAGE_KEY, JSON.stringify(pendingJoin));
      } else {
        localStorage.removeItem(PENDING_JOIN_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Save pendingJoin error', e);
    }
  }, [pendingJoin]);

  const pendingJoinRef = useRef<PendingJoinState | null>(pendingJoin);
  useEffect(() => {
    pendingJoinRef.current = pendingJoin;
  }, [pendingJoin]);

  // Refs for debouncing single-row shopping checks and preventing server echo rubberbanding
  const pendingShoppingCheckedTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const recentLocalShoppingUpdatesRef = useRef<Map<string, number>>(new Map());

  // Synchronize browser history (HTML5 History API) with app navigation & Android back button
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const validTabs: TabType[] = ['recipes', 'mealplan', 'shopping', 'settings'];
    const searchTab = new URLSearchParams(window.location.search).get('tab');
    const initialHash = window.location.hash.replace(/^#/, '');
    const initialTab = (searchTab && validTabs.includes(searchTab as TabType))
      ? (searchTab as TabType)
      : (validTabs.includes(initialHash as TabType) ? (initialHash as TabType) : 'recipes');

    if (!window.history.state || window.history.state.app !== 'receptapp') {
      window.history.replaceState(
        { app: 'receptapp', tab: initialTab, recipeId: null },
        '',
        initialTab === 'recipes' ? window.location.pathname : `#${initialTab}`
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      // If the entry we navigated to is marked as a modal, modal hooks will handle it
      if (event.state?.receptAppModal) {
        return;
      }

      const state = event.state;
      if (state && state.app === 'receptapp') {
        if (state.tab && validTabs.includes(state.tab)) {
          setActiveTabState(state.tab);
        }

        if (state.recipeId) {
          setRecipes((currentRecipes) => {
            const found = currentRecipes.find((r) => r.id === state.recipeId);
            if (found) {
              setSelectedRecipe(found);
            }
            return currentRecipes;
          });
        } else {
          setSelectedRecipe(null);
        }
      } else {
        setSelectedRecipe(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [customSubcategories, setCustomSubcategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_SUBCATEGORIES_STORAGE_KEY);
      let list: string[] = [];
      if (saved) {
        list = JSON.parse(saved);
      }
      const customSet = new Set<string>();
      list.forEach((s) => {
        const trimmed = s.trim();
        if (
          trimmed &&
          !NON_FOOD_SUBCATEGORIES.has(trimmed) &&
          trimmed !== 'Fisk & Skaldjur' &&
          trimmed !== 'Skaldjur & Fisk' &&
          trimmed !== 'Vegetariskt & Veganskt'
        ) {
          customSet.add(trimmed);
        }
      });
      return Array.from(customSet);
    } catch {
      return [];
    }
  });

  const addCustomSubcategory = useCallback((subcat: string) => {
    const trimmed = subcat.trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    setCustomSubcategories((prev) => {
      if (prev.some((s) => s.toLowerCase() === formatted.toLowerCase())) {
        return prev;
      }
      return [...prev, formatted];
    });
  }, []);

  const removeCustomSubcategory = useCallback((subcat: string) => {
    const target = subcat.trim().toLowerCase();
    setCustomSubcategories((prev) => prev.filter((s) => s.toLowerCase() !== target));
  }, []);

  const [isLiveSupabase, setIsLiveSupabase] = useState<boolean>(() => getSupabaseConfig().isConfigured);
  const realtimeStatus: 'connected' | 'connecting' | 'local_sync' = isLiveSupabase ? 'connected' : 'local_sync';

  useEffect(() => {
    syncServerSupabaseConfig().then((cfg) => {
      setIsLiveSupabase(cfg.isConfigured);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_SUBCATEGORIES_STORAGE_KEY, JSON.stringify(customSubcategories));
    } catch (e) {
      console.error('Save customSubcategories error', e);
    }
  }, [customSubcategories]);

  // Local storage persistence (debounced to avoid blocking main thread on rapid UI updates)
  const pendingRecipesSaveRef = useRef<Recipe[] | null>(null);

  useEffect(() => {
    pendingRecipesSaveRef.current = recipes;
    const timer = setTimeout(() => {
      if (pendingRecipesSaveRef.current) {
        try {
          localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(pendingRecipesSaveRef.current));
        } catch (e) {
          console.error('Save recipes error', e);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [recipes]);

  // Flush any pending recipe saves immediately before window unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingRecipesSaveRef.current) {
        try {
          localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(pendingRecipesSaveRef.current));
        } catch (e) {
          console.error('Save recipes beforeunload error', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(mealPlan));
    } catch (e) {
      console.error('Save mealPlan error', e);
    }
  }, [mealPlan]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(shoppingList));
    } catch (e) {
      console.error('Save shoppingList error', e);
    }
  }, [shoppingList]);

  useEffect(() => {
    try {
      localStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(pantryItems));
    } catch (e) {
      console.error('Save pantryItems error', e);
    }
  }, [pantryItems]);

  useEffect(() => {
    try {
      localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(households));
      if (activeHouseholdId) {
        localStorage.setItem(ACTIVE_HOUSEHOLD_ID_KEY, activeHouseholdId);
      } else {
        localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
      }
    } catch (e) {
      console.error('Save households error', e);
    }
  }, [households, activeHouseholdId]);

  useEffect(() => {
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } catch (e) {
      console.error('Save user error', e);
    }
  }, [currentUser]);

  // Ensure active household row is synced to Supabase (name, code, creator)
  useEffect(() => {
    if (!isLiveSupabase || !household?.id) return;

    safeUpsertHouseholdInSupabase({
      id: household.id,
      name: household.name,
      join_code: household.joinCode,
      creator_id: household.creatorId || undefined,
      updated_at: new Date().toISOString(),
    });
  }, [isLiveSupabase, household?.id, household?.joinCode, household?.name, household?.creatorId]);

  // Realtime Sync Subscription
  useEffect(() => {
    const unsubscribeLocal = subscribeToLocalChanges((msg) => {
      setLastSyncTimestamp(Date.now());
      if (msg.type === 'RECIPE_UPDATE') {
        const cleanPayload = sanitizeRecipe(msg.payload);
        setRecipes((prev) => {
          const exists = prev.some((r) => r.id === cleanPayload.id);
          if (exists) {
            return prev.map((r) => (r.id === cleanPayload.id ? cleanPayload : r));
          }
          return [cleanPayload, ...prev];
        });
        if (selectedRecipe?.id === cleanPayload.id) {
          setSelectedRecipe(cleanPayload);
        }
      } else if (msg.type === 'RECIPE_DELETE') {
        setRecipes((prev) => prev.filter((r) => r.id !== msg.payload.id));
      } else if (msg.type === 'RECIPES_SYNC') {
        const cleanList = msg.payload.map(sanitizeRecipe);
        setRecipes(cleanList);
        setMealPlan((prev) => normalizeMealPlan(prev, cleanList));
      } else if (msg.type === 'MEALPLAN_UPDATE') {
        setMealPlan((prev) => normalizeMealPlan(msg.payload || prev, recipes));
      } else if (msg.type === 'SHOPPING_UPDATE') {
        setShoppingList(msg.payload);
      } else if (msg.type === 'PANTRY_UPDATE') {
        setPantryItems(msg.payload);
      } else if (msg.type === 'HOUSEHOLD_UPDATE') {
        const curr = currentUserRef.current;
        const isCreator = Boolean(msg.payload.creatorId && curr.id === msg.payload.creatorId);
        const isStillMember = msg.payload.members?.some(
          (m) =>
            m.id === curr.id ||
            (curr.displayName && m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
        );

        if (msg.payload.members && !isStillMember && !isCreator && household?.id === msg.payload.id) {
          // Current user was removed from this household
          setHouseholds((prev) => prev.filter((h) => h.id !== msg.payload.id));
          setActiveHouseholdId((prev) => (prev === msg.payload.id ? null : prev));
          try {
            const updated = households.filter((h) => h.id !== msg.payload.id);
            localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
            localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
          } catch {}
          setRecipes([]);
          setMealPlan(normalizeMealPlan([]));
          setShoppingList([]);
          return;
        }

        setHouseholds((prev) =>
          prev.map((h) =>
            h.id === msg.payload.id
              ? {
                  ...h,
                  name: msg.payload.name,
                  joinCode: msg.payload.joinCode,
                  creatorId: msg.payload.creatorId !== undefined ? msg.payload.creatorId : h.creatorId,
                  members: msg.payload.members && msg.payload.members.length > 0 ? msg.payload.members : h.members,
                }
              : h
          )
        );
      } else if (msg.type === 'JOIN_REQUEST') {
        if (household?.id === msg.payload.householdId) {
          setJoinRequests((prev) => {
            if (prev.some((r) => r.id === msg.payload.id)) return prev;
            return [...prev, msg.payload];
          });
        }
      } else if (msg.type === 'JOIN_REQUEST_APPROVED') {
        setJoinRequests((prev) => prev.filter((r) => r.id !== msg.payload.requestId));
        if (pendingJoinRef.current && pendingJoinRef.current.requestId === msg.payload.requestId) {
          setActiveHouseholdId(msg.payload.householdId);
          if (msg.payload.user) {
            setCurrentUser(msg.payload.user);
          } else {
            setCurrentUser({
              id: msg.payload.userId,
              displayName: msg.payload.displayName,
              initials: (msg.payload.displayName || 'M').charAt(0).toUpperCase(),
              roleTitle: 'Medlem',
              isAdmin: false,
            });
          }
          setPendingJoin(null);
        }
      } else if (msg.type === 'JOIN_REQUEST_REJECTED') {
        setJoinRequests((prev) => prev.filter((r) => r.id !== msg.payload.requestId));
        if (pendingJoinRef.current && pendingJoinRef.current.requestId === msg.payload.requestId) {
          setPendingJoin((prev) => (prev ? { ...prev, status: 'rejected' } : null));
        }
      }
    });

    // Initial fetch from Supabase if connected
    if (isLiveSupabase && household?.id) {
      fetchHouseholdDataFromSupabase(household.id).then((data) => {
        if (data.household) {
          const serverHh = data.household;
          const curr = currentUserRef.current;
          const isCreator = Boolean(serverHh.creatorId && curr.id === serverHh.creatorId);
          const currentInMembers = serverHh.members?.find(
            (m) =>
              m.id === curr.id ||
              (curr.displayName &&
                m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
          );

          if (serverHh.members && serverHh.members.length > 0 && !currentInMembers && !isCreator) {
            // Current user was removed from this household by admin
            setHouseholds((prev) => prev.filter((h) => h.id !== serverHh.id));
            setActiveHouseholdId((prev) => (prev === serverHh.id ? null : prev));
            try {
              const updated = households.filter((h) => h.id !== serverHh.id);
              localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
              localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
            } catch {}
            setRecipes([]);
            setMealPlan(normalizeMealPlan([]));
            setShoppingList([]);
            return;
          }

          setHouseholds((prev) => {
            const exists = prev.some((h) => h.id === serverHh.id);
            if (exists) {
              return prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h));
            }
            return [...prev, serverHh];
          });

          // Sync currentUser role with the household's official member list
          if (currentInMembers) {
            setCurrentUser((prev) => ({
              ...prev,
              id: currentInMembers.id,
              displayName: currentInMembers.displayName,
              initials: currentInMembers.initials,
              roleTitle: currentInMembers.roleTitle,
              isAdmin: currentInMembers.isAdmin,
            }));
          }
        }

        const currentRecs = data.recipes !== undefined ? data.recipes.map(sanitizeRecipe) : recipes;
        if (data.recipes !== undefined) {
          setRecipes(currentRecs);
        }
        if (data.mealPlan !== undefined && data.mealPlan.length > 0) {
          setMealPlan(normalizeMealPlan(data.mealPlan, currentRecs));
        }
        if (data.shoppingItems !== undefined && data.shoppingItems.length > 0) {
          setShoppingList(data.shoppingItems);
        }
      });
    }

    const unsubscribeSupabase = (household && household.id)
      ? subscribeToSupabaseRealtime(household.id, {
          onRecipeChange: (payload) => {
            setLastSyncTimestamp(Date.now());
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const rec = mapRowToRecipe(payload.new);
              setRecipes((prev) => {
                const exists = prev.some((r) => r.id === rec.id);
                if (exists) {
                  return prev.map((r) => (r.id === rec.id ? rec : r));
                }
                return [rec, ...prev];
              });
              if (selectedRecipe?.id === rec.id) {
                setSelectedRecipe(rec);
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              setRecipes((prev) => {
                const remaining = prev.filter((r) => r.id !== deletedId);
                // Also purge any mealPlan references to this deleted recipe
                setMealPlan((mPrev) => normalizeMealPlan(mPrev, remaining));
                return remaining;
              });
            }
          },
          onMealPlanChange: () => {
            setLastSyncTimestamp(Date.now());
            if (household?.id) {
              fetchHouseholdDataFromSupabase(household.id).then((data) => {
                if (data.mealPlan && data.mealPlan.length > 0) {
                  setMealPlan(normalizeMealPlan(data.mealPlan, data.recipes || recipes));
                }
              });
            }
          },
          onShoppingChange: (payload: any) => {
            setLastSyncTimestamp(Date.now());

            if (!payload || !payload.eventType) {
              if (household?.id) {
                fetchHouseholdDataFromSupabase(household.id).then((data) => {
                  if (data.shoppingItems) setShoppingList(data.shoppingItems);
                });
              }
              return;
            }

            if (payload.eventType === 'INSERT') {
              const newItem = mapRowToShoppingItem(payload.new);
              // Ignore server echo if we recently added this item locally (< 2500ms ago)
              const lastLocalUpdate = recentLocalShoppingUpdatesRef.current.get(newItem.id);
              if (lastLocalUpdate && Date.now() - lastLocalUpdate < 2500) {
                return;
              }

              setShoppingList((prev) => {
                const { mergedList } = mergeIngredientsIntoShoppingList(prev, [newItem]);
                return mergedList;
              });
            } else if (payload.eventType === 'UPDATE') {
              const updatedItem = mapRowToShoppingItem(payload.new);
              // Ignore server echo if we recently updated this item locally (< 2500ms ago)
              const lastLocalUpdate = recentLocalShoppingUpdatesRef.current.get(updatedItem.id);
              if (lastLocalUpdate && Date.now() - lastLocalUpdate < 2500) {
                return;
              }

              setShoppingList((prev) =>
                prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
              );
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setShoppingList((prev) => prev.filter((i) => i.id !== deletedId));
              }
            }
          },
          onJoinRequestChange: (_payload: any) => {
            if (household?.id && isHouseholdAdmin) {
              fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);
            }
          },
          onProfileChange: () => {
            setLastSyncTimestamp(Date.now());
            if (household?.id) {
              if (isHouseholdAdmin) {
                fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);
              }
              fetchHouseholdDataFromSupabase(household.id).then((data) => {
                if (data.household) {
                  const serverHh = data.household;
                  const curr = currentUserRef.current;
                  const isCreator = Boolean(serverHh.creatorId && curr.id === serverHh.creatorId);
                  const currentInMembers = serverHh.members?.find(
                    (m) =>
                      m.id === curr.id ||
                      (curr.displayName &&
                        m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
                  );

                  if (serverHh.members && serverHh.members.length > 0 && !currentInMembers && !isCreator) {
                    // Current user was removed from this household
                    setHouseholds((prev) => prev.filter((h) => h.id !== serverHh.id));
                    setActiveHouseholdId((prev) => (prev === serverHh.id ? null : prev));
                    try {
                      const updated = households.filter((h) => h.id !== serverHh.id);
                      localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
                      localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
                    } catch {}
                    setRecipes([]);
                    setMealPlan(normalizeMealPlan([]));
                    setShoppingList([]);
                    return;
                  }

                  setHouseholds((prev) =>
                    prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h))
                  );
                  if (currentInMembers) {
                    setCurrentUser((prev) => ({
                      ...prev,
                      id: currentInMembers.id,
                      displayName: currentInMembers.displayName,
                      initials: currentInMembers.initials,
                      roleTitle: currentInMembers.roleTitle,
                      isAdmin: currentInMembers.isAdmin,
                    }));
                  }
                }
              });
            }
          },
          onHouseholdChange: () => {
            setLastSyncTimestamp(Date.now());
            if (household?.id) {
              fetchHouseholdDataFromSupabase(household.id).then((data) => {
                if (data.household) {
                  const serverHh = data.household;
                  setHouseholds((prev) =>
                    prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h))
                  );
                }
              });
            }
          },
        })
      : () => {};

    const pendingTimeouts = pendingShoppingCheckedTimeoutsRef.current;
    return () => {
      unsubscribeLocal();
      unsubscribeSupabase();
      pendingTimeouts.forEach((t) => clearTimeout(t));
      pendingTimeouts.clear();
    };
  }, [household?.id, selectedRecipe?.id, isLiveSupabase, isHouseholdAdmin]);

  // Fetch pending join requests for Admin
  useEffect(() => {
    if (isLiveSupabase && household?.id && isHouseholdAdmin) {
      fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);

      // Periodic check every 8 seconds so admin on phone never misses a request
      const interval = setInterval(() => {
        fetchJoinRequestsFromSupabase(household.id).then(setJoinRequests);
      }, 8000);

      return () => clearInterval(interval);
    } else if (!isHouseholdAdmin) {
      setJoinRequests([]);
    }
  }, [isLiveSupabase, household?.id, isHouseholdAdmin]);

  // Share aisle choices between household members
  useEffect(() => {
    if (!isLiveSupabase || !household?.id) return;

    let isMounted = true;
    const applyAisleOverrides = () => {
      setShoppingList((prev) =>
        prev.map((item) => {
          const aisle = getAisleOverride(item.name);
          return aisle && aisle !== item.aisle ? { ...item, aisle } : item;
        })
      );
    };

    syncAisleOverridesWithSupabase(household.id).then(() => {
      if (isMounted) applyAisleOverrides();
    });
    const unsubscribe = subscribeToAisleOverrides(household.id, applyAisleOverrides);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isLiveSupabase, household?.id]);

  // Listen for approval/rejection of current user's pending join request
  useEffect(() => {
    if (!pendingJoin || pendingJoin.status !== 'pending') return;

    let isMounted = true;

    const handleApproved = async () => {
      if (!isMounted) return;
      const data = await fetchHouseholdDataFromSupabase(pendingJoin.householdId);
      if (!isMounted) return;

      const updatedMembers = [
        ...(data.household?.members || []),
        {
          id: currentUser.id,
          displayName: pendingJoin.displayName,
          initials: (pendingJoin.displayName || 'M').charAt(0).toUpperCase(),
          roleTitle: 'Medlem',
          isAdmin: false,
        },
      ];

      const updatedHh: Household = {
        id: pendingJoin.householdId,
        name: pendingJoin.householdName,
        joinCode: pendingJoin.joinCode,
        creatorId: data.household?.creatorId,
        members: updatedMembers,
      };

      setHouseholds((prev) => {
        const exists = prev.find((h) => h.id === updatedHh.id);
        if (exists) {
          return prev.map((h) => (h.id === updatedHh.id ? updatedHh : h));
        }
        return [...prev, updatedHh];
      });

      setActiveHouseholdId(pendingJoin.householdId);
      setCurrentUser({
        id: currentUser.id,
        displayName: pendingJoin.displayName,
        initials: (pendingJoin.displayName || 'M').charAt(0).toUpperCase(),
        roleTitle: 'Medlem',
        isAdmin: false,
      });

      if (data.recipes !== undefined) setRecipes(data.recipes.map(sanitizeRecipe));
      if (data.mealPlan && data.mealPlan.length > 0) {
        setMealPlan(normalizeMealPlan(data.mealPlan, data.recipes || recipes));
      }
      if (data.shoppingItems !== undefined) setShoppingList(data.shoppingItems);

      setPendingJoin(null);
    };

    const unsubscribe = isLiveSupabase
      ? subscribeToJoinRequestApproval(
          pendingJoin.requestId,
          (status) => {
            if (!isMounted) return;
            if (status === 'approved') {
              handleApproved();
            } else if (status === 'rejected') {
              setPendingJoin((prev) => (prev ? { ...prev, status: 'rejected' } : null));
            }
          },
          pendingJoin.householdId,
          currentUser.id
        )
      : () => {};

    const interval = setInterval(async () => {
      if (!isMounted || !isLiveSupabase) return;
      const status = await checkJoinRequestStatusInSupabase(pendingJoin.requestId, currentUser.id);
      if (!isMounted || !status) return;

      if (status === 'approved') {
        handleApproved();
      } else if (status === 'rejected') {
        setPendingJoin((prev) => (prev ? { ...prev, status: 'rejected' } : null));
      }
    }, 2500);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [pendingJoin, isLiveSupabase, currentUser.id, recipes]);

  const setActiveTab = useCallback((newTab: TabType) => {
    if (newTab === activeTab && !selectedRecipe) return;

    if (selectedRecipe) {
      setSelectedRecipe(null);
    }

    if (typeof window !== 'undefined') {
      if (newTab === 'recipes') {
        if (window.history.state?.tab && window.history.state.tab !== 'recipes' && !window.history.state?.recipeId) {
          window.history.back();
          return;
        }
        window.history.replaceState(
          { app: 'receptapp', tab: 'recipes', recipeId: null },
          '',
          window.location.pathname
        );
        setActiveTabState('recipes');
        return;
      }

      if (activeTab === 'recipes') {
        window.history.pushState(
          { app: 'receptapp', tab: newTab, recipeId: null },
          '',
          `#${newTab}`
        );
      } else {
        window.history.replaceState(
          { app: 'receptapp', tab: newTab, recipeId: null },
          '',
          `#${newTab}`
        );
      }
    }

    setActiveTabState(newTab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [activeTab, selectedRecipe]);

  const openRecipeDetail = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });

      if (window.history.state?.receptAppModal) {
        window.history.replaceState(
          { app: 'receptapp', tab: activeTab, recipeId: recipe.id },
          '',
          `#recipe-${recipe.id}`
        );
      } else {
        window.history.pushState(
          { app: 'receptapp', tab: activeTab, recipeId: recipe.id },
          '',
          `#recipe-${recipe.id}`
        );
      }
    }
  }, [activeTab]);

  const closeRecipeDetail = useCallback(() => {
    setSelectedRecipe(null);
    if (typeof window !== 'undefined') {
      if (window.history.state?.recipeId || window.history.state?.receptAppModal) {
        window.history.back();
      }
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setRecipes((prev) => {
      const updated = prev.map((rec) => {
        if (rec.id === id) {
          const mod = { ...rec, isFavorite: !rec.isFavorite };
          broadcastLocalChange({ type: 'RECIPE_UPDATE', payload: mod });
          return mod;
        }
        return rec;
      });
      return updated;
    });
    setSelectedRecipe((prev) => (prev && prev.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev));
    if (isLiveSupabase && household?.id) {
      const rec = recipes.find((r) => r.id === id);
      if (rec) pushRecipeToSupabase({ ...rec, isFavorite: !rec.isFavorite }, household.id);
    }
  }, [recipes, isLiveSupabase, household?.id]);

  const updateNotes = useCallback((id: string, notes: string) => {
    setRecipes((prev) => {
      const updated = prev.map((rec) => {
        if (rec.id === id) {
          const mod = { ...rec, notes };
          broadcastLocalChange({ type: 'RECIPE_UPDATE', payload: mod });
          if (isLiveSupabase && household?.id) pushRecipeToSupabase(mod, household.id);
          return mod;
        }
        return rec;
      });
      return updated;
    });
    setSelectedRecipe((prev) => (prev && prev.id === id ? { ...prev, notes } : prev));
  }, [isLiveSupabase, household?.id]);

  const addRecipe = useCallback((recipe: Recipe) => {
    const fullRec = sanitizeRecipe({
      ...recipe,
      householdId: household?.id || 'hh-local',
      createdAt: recipe.createdAt || new Date().toISOString(),
    });
    setRecipes((prev) => [fullRec, ...prev]);
    broadcastLocalChange({ type: 'RECIPE_UPDATE', payload: fullRec });
    if (isLiveSupabase && household?.id) {
      pushRecipeToSupabase(fullRec, household.id);
    }
  }, [household?.id, isLiveSupabase]);

  const updateRecipe = useCallback((recipe: Recipe) => {
    const cleanRec = sanitizeRecipe(recipe);
    setRecipes((prev) => prev.map((r) => (r.id === cleanRec.id ? cleanRec : r)));
    if (selectedRecipe?.id === cleanRec.id) {
      setSelectedRecipe(cleanRec);
    }
    broadcastLocalChange({ type: 'RECIPE_UPDATE', payload: cleanRec });
    if (isLiveSupabase && household?.id) {
      pushRecipeToSupabase(cleanRec, household.id);
    }
  }, [selectedRecipe?.id, isLiveSupabase, household?.id]);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(STARTER_SEEDED_KEY, 'true');
        localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Save recipes error', e);
      }
      return updated;
    });

    // Automatically remove references to deleted recipe from mealPlan so no ghost IDs linger
    setMealPlan((prev) => {
      const cleared = prev.map((item) => ({
        ...item,
        dinnerRecipeId: item.dinnerRecipeId === id ? null : item.dinnerRecipeId,
        lunchRecipeId: item.lunchRecipeId === id ? null : item.lunchRecipeId,
      }));
      // Leftover lunches from a dinner that is now gone are removed too
      const emptiedDinners = prev.filter((d) => d.dinnerRecipeId === id && d.dateStr).map((d) => d.dateStr!);
      const updated = syncLeftoverLunches(cleared, emptiedDinners, (day) => day.customDinner?.trim() || null).plan;
      try {
        localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Save mealPlan error on deleteRecipe', e);
      }
      broadcastLocalChange({ type: 'MEALPLAN_UPDATE', payload: updated });
      if (isLiveSupabase && household?.id) {
        pushMealPlanToSupabase(updated, household.id);
      }
      return updated;
    });

    if (selectedRecipe?.id === id) {
      setSelectedRecipe(null);
      if (typeof window !== 'undefined') {
        if (window.history.state?.recipeId === id || window.history.state?.receptAppModal) {
          window.history.replaceState(
            { app: 'receptapp', tab: activeTab, recipeId: null },
            '',
            activeTab === 'recipes' ? window.location.pathname : `#${activeTab}`
          );
        }
      }
    }
    broadcastLocalChange({ type: 'RECIPE_DELETE', payload: { id } });
    deleteRecipeFromSupabase(id);
  }, [selectedRecipe?.id, activeTab, isLiveSupabase, household?.id]);

  const clearAllRecipes = useCallback(() => {
    if (!isHouseholdAdmin) {
      console.warn('Endast administratören kan rensa alla recept');
      return;
    }

    setRecipes((prev) => {
      prev.forEach((r) => {
        deleteRecipeFromSupabase(r.id);
      });
      return [];
    });
    setMealPlan((prev) => {
      const updated = prev.map((item) => ({
        ...item,
        dinnerRecipeId: null,
        lunchRecipeId: null,
      }));
      try {
        localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Save mealPlan error on clearAllRecipes', e);
      }
      broadcastLocalChange({ type: 'MEALPLAN_UPDATE', payload: updated });
      if (isLiveSupabase && household?.id) {
        pushMealPlanToSupabase(updated, household.id);
      }
      return updated;
    });
    setSelectedRecipe(null);
    localStorage.setItem(STARTER_SEEDED_KEY, 'true');
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify([]));
    broadcastLocalChange({ type: 'RECIPES_SYNC', payload: [] });
  }, [isLiveSupabase, household?.id, isHouseholdAdmin]);

  // Saves the plan, tells other tabs and sends the changed week to Supabase
  const commitMealPlan = useCallback((updated: MealPlanDay[], changedWeekStart: string) => {
    try {
      localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Save mealPlan error', e);
    }
    broadcastLocalChange({ type: 'MEALPLAN_UPDATE', payload: updated });
    if (isLiveSupabase && household?.id) {
      pushMealPlanToSupabase(buildWeek(updated, changedWeekStart), household.id);
    }
  }, [isLiveSupabase, household?.id]);

  // The name of a day's dinner, for leftover lunches that come from it
  const recipesRef = useRef(recipes);
  recipesRef.current = recipes;
  const dinnerTitleOf = useCallback((day: MealPlanDay): string | null | undefined => {
    if (day.dinnerRecipeId) {
      return recipesRef.current.find((r) => r.id === day.dinnerRecipeId)?.title;
    }
    return day.customDinner?.trim() || null;
  }, []);

  // Leftover lunches follow when the dinners on these dates change. A lunch in another week
  // (Monday's leftovers from Sunday) is saved in that week too.
  const withSyncedLeftovers = useCallback((plan: MealPlanDay[], dates: string[], weekStart: string) => {
    const { plan: synced, changed } = syncLeftoverLunches(plan, dates, dinnerTitleOf);
    const otherWeeks = Array.from(new Set(changed.map((d) => getWeekStart(d)))).filter((w) => w !== weekStart);
    return { plan: synced, otherWeeks };
  }, [dinnerTitleOf]);

  const updatePlanDay = useCallback((dateStr: string, change: (day: MealPlanDay) => MealPlanDay) => {
    setMealPlan((prev) => {
      const current = prev.find((d) => d.dateStr === dateStr) || emptyPlanDay(dateStr);
      const changedDay = normalizeMealPlan([...prev.filter((d) => d.dateStr !== dateStr), change(current)]);
      const weekStart = getWeekStart(dateStr);
      const { plan: updated, otherWeeks } = withSyncedLeftovers(changedDay, [dateStr], weekStart);
      commitMealPlan(updated, weekStart);
      otherWeeks.forEach((w) => commitMealPlan(updated, w));
      return updated;
    });
  }, [commitMealPlan, withSyncedLeftovers]);

  const setMealPlanForDate = useCallback((
    dateStr: string,
    mealType: 'lunch' | 'dinner',
    recipeId: string | null,
    customText?: string
  ) => {
    updatePlanDay(dateStr, (item) =>
      mealType === 'dinner'
        ? {
            ...item,
            dinnerRecipeId: recipeId,
            customDinner: customText !== undefined ? customText : (recipeId ? '' : item.customDinner || ''),
          }
        : {
            ...item,
            lunchRecipeId: recipeId,
            customLunch: customText !== undefined ? customText : (recipeId ? '' : item.customLunch || ''),
          }
    );
  }, [updatePlanDay]);

  const setMealPlanForDay = useCallback((
    dayName: MealPlanDay['dayName'],
    mealType: 'lunch' | 'dinner',
    recipeId: string | null,
    customText?: string
  ) => {
    const date = getWeekDates(planWeekStart)[WEEKDAY_NAMES.indexOf(dayName)];
    if (date) setMealPlanForDate(date, mealType, recipeId, customText);
  }, [planWeekStart, setMealPlanForDate]);

  const setMealPlanServings = useCallback((
    dayName: MealPlanDay['dayName'],
    mealType: 'lunch' | 'dinner',
    servings: number
  ) => {
    const date = getWeekDates(planWeekStart)[WEEKDAY_NAMES.indexOf(dayName)];
    if (!date) return;
    updatePlanDay(date, (item) =>
      mealType === 'dinner'
        ? { ...item, dinnerServings: Math.max(1, servings) }
        : { ...item, lunchServings: Math.max(1, servings) }
    );
  }, [planWeekStart, updatePlanDay]);

  // Empties the week shown in the meal plan. Other weeks are kept.
  const clearMealPlan = useCallback(() => {
    const weekDates = new Set(getWeekDates(planWeekStart));
    setMealPlan((prev) => {
      const emptied = prev.filter((d) => !weekDates.has(d.dateStr || ''));
      const { plan: updated, otherWeeks } = withSyncedLeftovers(emptied, Array.from(weekDates), planWeekStart);
      commitMealPlan(updated, planWeekStart);
      otherWeeks.forEach((w) => commitMealPlan(updated, w));
      return updated;
    });
  }, [planWeekStart, commitMealPlan, withSyncedLeftovers]);

  const generateShoppingListFromWeek = useCallback((skipPantryStaples: boolean): number => {
    // Dinners that also become leftover lunches are bought for the extra portions
    const { items } = generateShoppingListFromMealPlan(withLeftoverPortions(weekMealPlan), recipes, {
      skipPantryStaples,
    });

    setShoppingList((prev) => {
      const { mergedList, removedDuplicateIds } = mergeIngredientsIntoShoppingList(prev, items);
      broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: mergedList });
      if (isLiveSupabase && household?.id) {
        if (removedDuplicateIds.length > 0) {
          deleteShoppingItemsFromSupabase(removedDuplicateIds);
        }
        pushShoppingItemsToSupabase(mergedList, household.id);
      }
      return mergedList;
    });
    return items.length;
  }, [weekMealPlan, recipes, isLiveSupabase, household?.id]);

  const addIngredientsToShoppingList = useCallback((
    ingredients: Array<{ name: string; amount: number | null; unit: string; aisle: string; isPantryStaple: boolean }>,
    recipeTitle?: string,
    skipPantryStaples: boolean = true
  ): number => {
    const validIngredients = ingredients.filter((ing) => {
      if (!skipPantryStaples) return true;
      const isStaple = Boolean(ing.isPantryStaple || isCommonPantryStaple(ing.name));
      return !isStaple;
    });

    const rawNew = validIngredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      aisle: (ing.aisle && ing.aisle !== 'Övrigt') ? ing.aisle : detectAisle(ing.name),
      isPantryStaple: ing.isPantryStaple,
      recipeTitle,
    }));

    setShoppingList((prev) => {
      const { mergedList, removedDuplicateIds } = mergeIngredientsIntoShoppingList(prev, rawNew);
      broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: mergedList });
      if (isLiveSupabase && household?.id) {
        if (removedDuplicateIds.length > 0) {
          deleteShoppingItemsFromSupabase(removedDuplicateIds);
        }
        pushShoppingItemsToSupabase(mergedList, household.id);
      }
      return mergedList;
    });
    return validIngredients.length;
  }, [isLiveSupabase, household?.id]);

  const toggleShoppingItem = useCallback((id: string) => {
    let nextChecked = false;
    let updatedList: ShoppingItem[] = [];
    let toggledItem: ShoppingItem | undefined;

    setShoppingList((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      toggledItem = target;
      nextChecked = !target.checked;
      updatedList = prev.map((item) =>
        item.id === id ? { ...item, checked: nextChecked } : item
      );
      return updatedList;
    });

    // If an item was just checked off as bought, sync with pantry staples
    if (nextChecked && toggledItem) {
      const targetKey = normalizeIngredientKey(toggledItem.name, toggledItem.unit);
      setPantryItems((prev) => {
        let hasChange = false;
        const updated = prev.map((p) => {
          if (p.isOutOfStock && normalizeIngredientKey(p.name, p.unit) === targetKey) {
            hasChange = true;
            return { ...p, isOutOfStock: false };
          }
          return p;
        });
        if (hasChange) {
          broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: updated });
          return updated;
        }
        return prev;
      });
    }

    recentLocalShoppingUpdatesRef.current.set(id, Date.now());
    if (recentLocalShoppingUpdatesRef.current.size > 100) {
      const cutoff = Date.now() - 5000;
      for (const [k, v] of recentLocalShoppingUpdatesRef.current.entries()) {
        if (v < cutoff) recentLocalShoppingUpdatesRef.current.delete(k);
      }
    }

    broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: updatedList });

    if (isLiveSupabase && household?.id) {
      const existingTimer = pendingShoppingCheckedTimeoutsRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        pendingShoppingCheckedTimeoutsRef.current.delete(id);
        updateShoppingItemCheckedInSupabase(id, nextChecked);
      }, 200);

      pendingShoppingCheckedTimeoutsRef.current.set(id, timer);
    }
  }, [isLiveSupabase, household?.id]);

  const deleteShoppingItem = useCallback((id: string) => {
    setShoppingList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: updated });
      if (isLiveSupabase) {
        deleteShoppingItemFromSupabase(id);
      }
      return updated;
    });
  }, [isLiveSupabase]);

  const clearCheckedShoppingItems = useCallback(() => {
    setShoppingList((prev) => {
      const checkedItems = prev.filter((item) => item.checked);
      const checkedIds = checkedItems.map((item) => item.id);
      const updated = prev.filter((item) => !item.checked);

      if (checkedItems.length > 0) {
        const checkedKeys = new Set(
          checkedItems.map((item) => normalizeIngredientKey(item.name, item.unit))
        );
        setPantryItems((pPrev) => {
          let hasChange = false;
          const pUpdated = pPrev.map((p) => {
            if (p.isOutOfStock && checkedKeys.has(normalizeIngredientKey(p.name, p.unit))) {
              hasChange = true;
              return { ...p, isOutOfStock: false };
            }
            return p;
          });
          if (hasChange) {
            broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: pUpdated });
            return pUpdated;
          }
          return pPrev;
        });
      }

      broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: updated });
      if (isLiveSupabase && household?.id && checkedIds.length > 0) {
        deleteShoppingItemsFromSupabase(checkedIds);
      }
      return updated;
    });
  }, [isLiveSupabase, household?.id]);

  const restoreShoppingList = useCallback((items: ShoppingItem[]) => {
    setShoppingList((prev) => {
      broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: items });
      if (isLiveSupabase && household?.id) {
        const nextIds = new Set(items.map((i) => i.id));
        const removedIds = prev.filter((i) => !nextIds.has(i.id)).map((i) => i.id);
        if (removedIds.length > 0) {
          deleteShoppingItemsFromSupabase(removedIds);
        }
        pushShoppingItemsToSupabase(items, household.id);
      }
      return items;
    });
  }, [isLiveSupabase, household?.id]);

  const addCustomShoppingItem = useCallback((item: {
    name: string;
    amount: number | null;
    unit: string;
    aisle: string;
    isPantryStaple: boolean;
    comment?: string;
  }) => {
    const newId = `shop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    recentLocalShoppingUpdatesRef.current.set(newId, Date.now());
    // Learn which items you often add, for the quick choices
    recordFrequentItem(item.name);

    setShoppingList((prev) => {
      const { mergedList, removedDuplicateIds } = mergeIngredientsIntoShoppingList(prev, [
        {
          id: newId,
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          aisle: item.aisle || 'Övrigt',
          isPantryStaple: item.isPantryStaple,
          checked: false,
          comment: item.comment,
        },
      ]);
      broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: mergedList });
      if (isLiveSupabase && household?.id) {
        if (removedDuplicateIds.length > 0) {
          deleteShoppingItemsFromSupabase(removedDuplicateIds);
        }
        pushShoppingItemsToSupabase(mergedList, household.id);
      }
      return mergedList;
    });
  }, [isLiveSupabase, household?.id]);

  const updateShoppingItemComment = useCallback((id: string, comment: string) => {
    let updatedItem: ShoppingItem | undefined;
    let updatedList: ShoppingItem[] = [];

    setShoppingList((prev) => {
      updatedList = prev.map((item) => {
        if (item.id === id) {
          updatedItem = { ...item, comment: comment.trim() || undefined };
          return updatedItem;
        }
        return item;
      });
      return updatedList;
    });

    recentLocalShoppingUpdatesRef.current.set(id, Date.now());
    broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: updatedList });

    if (isLiveSupabase && household?.id && updatedItem) {
      updateShoppingItemCommentInSupabase(updatedItem);
    }
  }, [isLiveSupabase, household?.id]);

  const rememberShoppingAisle = useCallback((name: string, aisle: string) => {
    setAisleOverride(name, aisle);
    if (isLiveSupabase && household?.id) {
      pushAisleOverrideToSupabase(household.id, name, aisle);
    }
  }, [isLiveSupabase, household?.id]);

  const updateShoppingItemAisle = useCallback((id: string, aisle: string) => {
    const target = shoppingList.find((item) => item.id === id);
    if (!target) return;

    // Remember the choice, and move the same ingredient in other units too
    rememberShoppingAisle(target.name, aisle);
    const targetName = normalizeIngredientNameForMatching(target.name);
    const changedIds = shoppingList
      .filter((item) => normalizeIngredientNameForMatching(item.name) === targetName && item.aisle !== aisle)
      .map((item) => item.id);
    const updatedList = shoppingList.map((item) =>
      changedIds.includes(item.id) ? { ...item, aisle } : item
    );

    setShoppingList(updatedList);
    changedIds.forEach((changedId) => recentLocalShoppingUpdatesRef.current.set(changedId, Date.now()));
    broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: updatedList });

    if (isLiveSupabase && household?.id) {
      changedIds.forEach((changedId) => updateShoppingItemAisleInSupabase(changedId, aisle));
    }
  }, [shoppingList, isLiveSupabase, household?.id, rememberShoppingAisle]);

  const setHouseholdName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !household) return;
    if (!isHouseholdAdmin) {
      console.warn('Endast hushållets admin kan byta namn på hushållet');
      return;
    }

    setHouseholds((prev) =>
      prev.map((h) => (h.id === household.id ? { ...h, name: trimmed } : h))
    );

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: household.id, name: trimmed, joinCode: household.joinCode, creatorId: household.creatorId, members: household.members },
    });

    if (isLiveSupabase) {
      safeUpsertHouseholdInSupabase({
        id: household.id,
        name: trimmed,
        join_code: household.joinCode,
        creator_id: household.creatorId || undefined,
        updated_at: new Date().toISOString(),
      });
    }
  }, [household, isHouseholdAdmin, isLiveSupabase]);

  const addMemberToHousehold = useCallback((member: { displayName: string; roleTitle?: string }) => {
    const name = member.displayName.trim();
    if (!name || !household) return;

    const newMember: UserProfile = {
      id: `user-${Date.now()}`,
      displayName: name,
      initials: name.charAt(0).toUpperCase(),
      roleTitle: member.roleTitle?.trim() || 'Medlem',
      isAdmin: false,
    };

    let updatedMembers = household.members || [];
    setHouseholds((prev) =>
      prev.map((h) => {
        if (h.id === household.id) {
          const exists = h.members.some((m) => m.displayName.toLowerCase() === name.toLowerCase());
          if (exists) return h;
          updatedMembers = [...h.members, newMember];
          return { ...h, members: updatedMembers };
        }
        return h;
      })
    );

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: household.id, name: household.name, joinCode: household.joinCode, creatorId: household.creatorId, members: updatedMembers },
    });

    if (isLiveSupabase) {
      safeUpsertProfileInSupabase({
        id: newMember.id,
        household_id: household.id,
        display_name: newMember.displayName,
        avatar_emoji: '🧑‍🍳',
        role_title: newMember.roleTitle,
        updated_at: new Date().toISOString(),
      });
    }
  }, [household, isLiveSupabase]);

  const updateMemberInHousehold = useCallback((memberId: string, updates: { displayName: string; roleTitle?: string }) => {
    const trimmedName = updates.displayName.trim();
    if (!trimmedName || !household) return;

    const adminId = household.creatorId || household.members[0]?.id;
    let nextMembers = household.members || [];

    setHouseholds((prev) =>
      prev.map((h) => {
        if (h.id === household.id) {
          nextMembers = h.members.map((m) => {
            if (m.id === memberId) {
              const isCreator = m.id === adminId;
              return {
                ...m,
                displayName: trimmedName,
                initials: trimmedName.charAt(0).toUpperCase(),
                roleTitle: isCreator ? 'Admin' : (updates.roleTitle?.trim() || m.roleTitle || 'Medlem'),
                isAdmin: isCreator,
              };
            }
            return m;
          });
          return { ...h, members: nextMembers };
        }
        return h;
      })
    );

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: household.id, name: household.name, joinCode: household.joinCode, creatorId: household.creatorId, members: nextMembers },
    });

    if (isLiveSupabase) {
      const isCreator = memberId === adminId;
      safeUpsertProfileInSupabase({
        id: memberId,
        household_id: household.id,
        display_name: trimmedName,
        avatar_emoji: '🧑‍🍳',
        role_title: isCreator ? 'Admin' : (updates.roleTitle?.trim() || 'Medlem'),
        updated_at: new Date().toISOString(),
      });
    }

    setCurrentUser((prev) => {
      if (prev.id === memberId) {
        const isCreator = memberId === adminId;
        return {
          ...prev,
          displayName: trimmedName,
          initials: trimmedName.charAt(0).toUpperCase(),
          roleTitle: isCreator ? 'Admin' : (updates.roleTitle?.trim() || prev.roleTitle || 'Medlem'),
          isAdmin: isCreator,
        };
      }
      return prev;
    });
  }, [household, isLiveSupabase]);

  const removeMemberFromHousehold = useCallback(async (memberId: string): Promise<boolean> => {
    if (!household) return false;

    const adminId = household.creatorId || household.members[0]?.id;

    // The creator/admin cannot be removed from the household
    if (memberId === adminId) {
      console.warn('Administratören och skaparen av hushållet kan inte tas bort.');
      return false;
    }

    // Only admin can remove other members
    if (!isHouseholdAdmin && memberId !== currentUser.id) {
      console.warn('Endast hushållets admin kan ta bort medlemmar.');
      return false;
    }

    if (household.members.length <= 1) return false;
    const remainingMembers = household.members.filter((m) => m.id !== memberId);

    setHouseholds((prev) =>
      prev.map((h) => (h.id === household.id ? { ...h, members: remainingMembers } : h))
    );

    try {
      const updated = households.map((h) =>
        h.id === household.id ? { ...h, members: remainingMembers } : h
      );
      localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: household.id, name: household.name, joinCode: household.joinCode, creatorId: household.creatorId, members: remainingMembers },
    });

    if (isLiveSupabase) {
      const client = getSupabase();
      if (client) {
        await client.from('profiles').delete().eq('id', memberId);
      }
    }

    setCurrentUser((prev) => {
      if (prev.id === memberId) {
        const remaining = household.members.filter((m) => m.id !== memberId);
        return remaining[0] || prev;
      }
      return prev;
    });

    return true;
  }, [household, isHouseholdAdmin, currentUser.id, households, isLiveSupabase]);

  const deleteHousehold = useCallback((householdId: string) => {
    setHouseholds((prev) => {
      const remaining = prev.filter((h) => h.id !== householdId);
      try {
        localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });

    setActiveHouseholdId((prevId) => {
      if (prevId === householdId) {
        const remaining = households.filter((h) => h.id !== householdId);
        const nextId = remaining.length > 0 ? remaining[0].id : null;
        try {
          if (nextId) {
            localStorage.setItem(ACTIVE_HOUSEHOLD_ID_KEY, nextId);
          } else {
            localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
          }
        } catch {}
        return nextId;
      }
      return prevId;
    });

    if (isLiveSupabase) {
      const client = getSupabase();
      if (client) {
        client.from('households').delete().eq('id', householdId);
        client.from('profiles').delete().eq('household_id', householdId);
      }
    }
  }, [households, isLiveSupabase]);

  const leaveHousehold = useCallback(async (householdId?: string): Promise<boolean> => {
    const targetHhId = householdId || household?.id;
    if (!targetHhId) return false;

    const targetHh = households.find((h) => h.id === targetHhId);
    if (!targetHh) return false;

    const adminId = targetHh.creatorId || targetHh.members[0]?.id;
    const isTargetAdmin = currentUser.id === adminId || targetHh.members[0]?.id === currentUser.id;

    // If admin leaves, delete household
    if (isTargetAdmin) {
      deleteHousehold(targetHhId);
      if (isLiveSupabase) {
        const client = getSupabase();
        if (client) {
          await client.from('households').delete().eq('id', targetHhId);
          await client.from('profiles').delete().eq('household_id', targetHhId);
        }
      }
      return true;
    }

    // Non-admin member leaves
    const remainingMembers = targetHh.members.filter((m) => m.id !== currentUser.id);

    setHouseholds((prev) =>
      prev.filter((h) => h.id !== targetHhId)
    );

    setActiveHouseholdId((prevId) => {
      if (prevId === targetHhId) {
        const remaining = households.filter((h) => h.id !== targetHhId);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prevId;
    });

    try {
      const remaining = households.filter((h) => h.id !== targetHhId);
      localStorage.setItem(HOUSEHOLDS_STORAGE_KEY, JSON.stringify(remaining));
      if (activeHouseholdId === targetHhId) {
        if (remaining.length > 0) {
          localStorage.setItem(ACTIVE_HOUSEHOLD_ID_KEY, remaining[0].id);
        } else {
          localStorage.removeItem(ACTIVE_HOUSEHOLD_ID_KEY);
        }
      }
    } catch {}

    if (isLiveSupabase) {
      const client = getSupabase();
      if (client) {
        await client.from('profiles').delete().eq('id', currentUser.id);
      }
    }

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: targetHh.id, name: targetHh.name, joinCode: targetHh.joinCode, creatorId: targetHh.creatorId, members: remainingMembers },
    });

    return true;
  }, [household?.id, households, currentUser.id, activeHouseholdId, deleteHousehold, isLiveSupabase]);

  const createHousehold = useCallback((
    name: string,
    creatorName: string = 'Huvudkock',
    creatorRole: string = 'Admin',
    includeStarterRecipes: boolean = true
  ) => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newHhId = `hh-${Date.now()}`;
    const newMemberId = `user-${Date.now()}`;
    const newMember: UserProfile = {
      id: newMemberId,
      displayName: creatorName.trim() || 'Huvudkock',
      initials: (creatorName.trim() || 'H').charAt(0).toUpperCase(),
      roleTitle: creatorRole || 'Admin',
      isAdmin: true,
    };

    const newHh: Household = {
      id: newHhId,
      name: name.trim() || 'Vårt Nya Kök',
      joinCode: randomCode,
      creatorId: newMemberId,
      members: [newMember],
    };

    setHouseholds((prev) => [...prev, newHh]);
    setActiveHouseholdId(newHhId);
    setCurrentUser(newMember);

    if (includeStarterRecipes) {
      const baseTime = Date.now() - INITIAL_RECIPES.length * 60000;
      // Recipe ids are shared by all households in Supabase, so each household gets its own
      // copies of the starter recipes. With the plain ids a new household would take over
      // (and could delete) another household's starter recipes.
      const seededId = (id: string) => `${id}-${newHhId}`;
      const seeded = INITIAL_RECIPES.map((r, idx) => ({
        ...r,
        id: seededId(r.id),
        householdId: newHhId,
        createdAt: r.createdAt || new Date(baseTime + (INITIAL_RECIPES.length - idx) * 60000).toISOString(),
      }));
      setRecipes(seeded);
      const initialPlan = normalizeMealPlan(
        INITIAL_MEAL_PLAN.map((d) => ({
          ...d,
          dinnerRecipeId: d.dinnerRecipeId ? seededId(d.dinnerRecipeId) : d.dinnerRecipeId,
          lunchRecipeId: d.lunchRecipeId ? seededId(d.lunchRecipeId) : d.lunchRecipeId,
        })),
        seeded
      );
      setMealPlan(initialPlan);
      try {
        localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(initialPlan));
      } catch (e) {
        console.error('Save mealPlan error on createHousehold', e);
      }
      if (isLiveSupabase) {
        seeded.forEach((r) => pushRecipeToSupabase(r, newHhId));
        pushMealPlanToSupabase(initialPlan, newHhId);
      }
    } else {
      setRecipes([]);
      const emptyPlan = normalizeMealPlan([]);
      setMealPlan(emptyPlan);
      try {
        localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(emptyPlan));
      } catch (e) {
        console.error('Save mealPlan error on createHousehold', e);
      }
      if (isLiveSupabase) {
        pushMealPlanToSupabase(emptyPlan, newHhId);
      }
    }

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: newHh.id, name: newHh.name, joinCode: newHh.joinCode, creatorId: newHh.creatorId, members: newHh.members },
    });

    if (isLiveSupabase) {
      safeUpsertHouseholdInSupabase({
        id: newHh.id,
        name: newHh.name,
        join_code: newHh.joinCode,
        creator_id: newMemberId,
        updated_at: new Date().toISOString(),
      });
      safeUpsertProfileInSupabase({
        id: newMember.id,
        household_id: newHh.id,
        display_name: newMember.displayName,
        avatar_emoji: '🧑‍🍳',
        role_title: 'Admin',
        updated_at: new Date().toISOString(),
      });
    }
  }, [isLiveSupabase]);

  const joinHouseholdByCode = useCallback(async (
    code: string,
    memberName: string = 'Medkock',
    memberRole: string = 'Medlem'
  ): Promise<boolean> => {
    const digitsOnly = code.replace(/\D/g, '').slice(0, 6);
    const cleanCode = digitsOnly || code.toUpperCase().trim();
    if (!cleanCode) return false;

    const applicantUser: UserProfile = {
      id: currentUser.id || `user-${Date.now()}`,
      displayName: memberName.trim() || 'Medkock',
      initials: (memberName.trim() || 'M').charAt(0).toUpperCase(),
      roleTitle: memberRole || 'Medlem',
      isAdmin: false,
    };

    if (isLiveSupabase) {
      const found = await findHouseholdByJoinCode(cleanCode);
      if (!found || !found.household) {
        return false;
      }

      const hh = found.household;
      const isAlreadyMember = hh.members?.some(
        (m) => m.id === applicantUser.id || m.displayName.toLowerCase() === applicantUser.displayName.toLowerCase()
      );

      if (isAlreadyMember) {
        const updatedMembers = [
          ...hh.members.filter((m) => m.displayName.toLowerCase() !== applicantUser.displayName.toLowerCase()),
          applicantUser,
        ];
        const updatedHh: Household = {
          ...hh,
          members: updatedMembers,
        };

        setHouseholds((prev) => {
          const exists = prev.find((h) => h.id === hh.id);
          if (exists) {
            return prev.map((h) => (h.id === hh.id ? updatedHh : h));
          }
          return [...prev, updatedHh];
        });

        setActiveHouseholdId(hh.id);
        setCurrentUser(applicantUser);

        const fullData = await fetchHouseholdDataFromSupabase(hh.id);
        if (fullData.recipes !== undefined) setRecipes(fullData.recipes.map(sanitizeRecipe));
        if (fullData.mealPlan && fullData.mealPlan.length > 0) {
          setMealPlan(normalizeMealPlan(fullData.mealPlan, fullData.recipes || recipes));
        }
        if (fullData.shoppingItems !== undefined) setShoppingList(fullData.shoppingItems);

        return true;
      }

      const joinReq: HouseholdJoinRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        householdId: hh.id,
        userId: applicantUser.id,
        displayName: applicantUser.displayName,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await createJoinRequestInSupabase(joinReq);

      const pending: PendingJoinState = {
        requestId: joinReq.id,
        householdId: hh.id,
        householdName: hh.name,
        joinCode: cleanCode,
        displayName: applicantUser.displayName,
        status: 'pending',
        createdAt: joinReq.createdAt,
      };

      setPendingJoin(pending);

      broadcastLocalChange({
        type: 'JOIN_REQUEST',
        payload: joinReq,
      });

      return true;
    }

    // Local-only fallback if Supabase is not configured
    const hhId = `hh-${cleanCode.replace(/[^A-Z0-9]/g, '')}`;
    const targetHh = households.find((h) => h.id === hhId || h.joinCode === cleanCode);

    if (targetHh) {
      const isAlreadyMember = targetHh.members?.some(
        (m) => m.id === applicantUser.id || m.displayName.toLowerCase() === applicantUser.displayName.toLowerCase()
      );

      if (isAlreadyMember) {
        setActiveHouseholdId(targetHh.id);
        setCurrentUser(applicantUser);
        return true;
      }

      const joinReq: HouseholdJoinRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        householdId: targetHh.id,
        userId: applicantUser.id,
        displayName: applicantUser.displayName,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const pending: PendingJoinState = {
        requestId: joinReq.id,
        householdId: targetHh.id,
        householdName: targetHh.name,
        joinCode: cleanCode,
        displayName: applicantUser.displayName,
        status: 'pending',
        createdAt: joinReq.createdAt,
      };

      setPendingJoin(pending);

      broadcastLocalChange({
        type: 'JOIN_REQUEST',
        payload: joinReq,
      });

      return true;
    }

    const joinedHh: Household = {
      id: hhId,
      name: `Hushåll (${cleanCode})`,
      joinCode: cleanCode,
      members: [applicantUser],
    };

    setHouseholds((prev) => [...prev, joinedHh]);
    setActiveHouseholdId(hhId);
    setCurrentUser(applicantUser);

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: joinedHh.id, name: joinedHh.name, joinCode: joinedHh.joinCode, creatorId: joinedHh.creatorId },
    });

    return true;
  }, [isLiveSupabase, households, currentUser.id, recipes]);

  const approveJoinRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!household || !isHouseholdAdmin) return false;
    const req = joinRequests.find((r) => r.id === requestId);
    if (!req) return false;

    if (isLiveSupabase) {
      await updateJoinRequestStatusInSupabase(requestId, 'approved', {
        householdId: household.id,
        userId: req.userId,
        displayName: req.displayName,
      });
    }

    const newMember: UserProfile = {
      id: req.userId,
      displayName: req.displayName,
      initials: (req.displayName || 'M').charAt(0).toUpperCase(),
      roleTitle: 'Medlem',
      isAdmin: false,
    };

    let updatedMembers = household.members || [];
    setHouseholds((prev) =>
      prev.map((h) => {
        if (h.id === household.id) {
          const exists = h.members.some(
            (m) => m.id === newMember.id || m.displayName.toLowerCase() === newMember.displayName.toLowerCase()
          );
          if (exists) return h;
          updatedMembers = [...h.members, newMember];
          return { ...h, members: updatedMembers };
        }
        return h;
      })
    );

    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));

    if (isLiveSupabase) {
      safeUpsertProfileInSupabase({
        id: newMember.id,
        household_id: household.id,
        display_name: newMember.displayName,
        avatar_emoji: '🧑‍🍳',
        role_title: newMember.roleTitle,
        updated_at: new Date().toISOString(),
      });
    }

    broadcastLocalChange({
      type: 'JOIN_REQUEST_APPROVED',
      payload: {
        requestId,
        householdId: household.id,
        userId: newMember.id,
        displayName: newMember.displayName,
        user: newMember,
      },
    });

    broadcastLocalChange({
      type: 'HOUSEHOLD_UPDATE',
      payload: { id: household.id, name: household.name, joinCode: household.joinCode, creatorId: household.creatorId, members: updatedMembers },
    });

    return true;
  }, [household, isHouseholdAdmin, isLiveSupabase, joinRequests]);

  const rejectJoinRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!household || !isHouseholdAdmin) return false;

    const req = joinRequests.find((r) => r.id === requestId);

    if (isLiveSupabase) {
      await updateJoinRequestStatusInSupabase(requestId, 'rejected', {
        householdId: household.id,
        userId: req?.userId,
        displayName: req?.displayName,
      });
    }

    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));

    broadcastLocalChange({
      type: 'JOIN_REQUEST_REJECTED',
      payload: { requestId, householdId: household.id, userId: req?.userId },
    });

    return true;
  }, [household, isHouseholdAdmin, isLiveSupabase, joinRequests]);

  const cancelPendingJoin = useCallback(() => {
    if (pendingJoin) {
      if (isLiveSupabase) {
        deleteJoinRequestInSupabase(pendingJoin.requestId, currentUser.id);
      }
      setPendingJoin(null);
    }
  }, [pendingJoin, isLiveSupabase, currentUser.id]);

  const switchHousehold = useCallback((householdId: string) => {
    const target = households.find((h) => h.id === householdId);
    if (!target) return;
    setActiveHouseholdId(householdId);
    if (target.members && target.members.length > 0) {
      const existingUser = target.members.find(
        (m) => m.id === currentUser.id || m.displayName.toLowerCase() === currentUser.displayName.toLowerCase()
      );
      if (existingUser) {
        setCurrentUser(existingUser);
      } else {
        setCurrentUser(target.members[0]);
      }
    }
    if (isLiveSupabase) {
      fetchHouseholdDataFromSupabase(householdId).then((data) => {
        if (data.household) {
          const serverHh = data.household;
          setHouseholds((prev) =>
            prev.map((h) => (h.id === serverHh.id ? { ...h, ...serverHh } : h))
          );
          if (serverHh.members && serverHh.members.length > 0) {
            const curr = currentUserRef.current;
            const currentInMembers = serverHh.members.find(
              (m) =>
                m.id === curr.id ||
                (curr.displayName &&
                  m.displayName.trim().toLowerCase() === curr.displayName.trim().toLowerCase())
            );
            if (currentInMembers) {
              setCurrentUser((prev) => ({
                ...prev,
                id: currentInMembers.id,
                displayName: currentInMembers.displayName,
                initials: currentInMembers.initials,
                roleTitle: currentInMembers.roleTitle,
                isAdmin: currentInMembers.isAdmin,
              }));
            }
          }
        }
        const currentRecs = data.recipes !== undefined ? data.recipes.map(sanitizeRecipe) : recipes;
        if (data.recipes !== undefined) setRecipes(currentRecs);
        if (data.mealPlan && data.mealPlan.length > 0) {
          setMealPlan(normalizeMealPlan(data.mealPlan, currentRecs));
        }
        if (data.shoppingItems !== undefined) setShoppingList(data.shoppingItems);
      });
    }
  }, [households, currentUser.id, currentUser.displayName, isLiveSupabase, recipes]);

  const regenerateHouseholdCode = useCallback((targetHouseholdId?: string): string => {
    const idToUpdate = targetHouseholdId || household?.id;
    if (!idToUpdate || !household) return '';
    if (!isHouseholdAdmin) {
      console.warn('Endast hushållets admin kan generera ny delningskod');
      return household.joinCode;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    setHouseholds((prev) =>
      prev.map((h) => {
        if (h.id === idToUpdate) {
          const updated = { ...h, joinCode: newCode };
          broadcastLocalChange({
            type: 'HOUSEHOLD_UPDATE',
            payload: { id: updated.id, name: updated.name, joinCode: newCode, creatorId: updated.creatorId, members: updated.members },
          });
          if (isLiveSupabase) {
            safeUpsertHouseholdInSupabase({
              id: updated.id,
              name: updated.name,
              join_code: newCode,
              creator_id: updated.creatorId || undefined,
              updated_at: new Date().toISOString(),
            });
          }
          return updated;
        }
        return h;
      })
    );

    return newCode;
  }, [household, isHouseholdAdmin, isLiveSupabase]);

  const addPantryItem = useCallback((item: {
    name: string;
    amount?: number | null;
    unit?: string;
    aisle?: string;
    comment?: string;
    isOutOfStock?: boolean;
  }) => {
    const cleanName = item.name.trim();
    if (!cleanName) return;

    const newItem: PantryItem = {
      id: `pantry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      amount: item.amount ?? null,
      unit: item.unit?.trim() || '',
      aisle: item.aisle?.trim() || 'Skafferi',
      isOutOfStock: Boolean(item.isOutOfStock),
      comment: item.comment?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setPantryItems((prev) => {
      const updated = [newItem, ...prev];
      broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: updated });
      return updated;
    });

    if (newItem.isOutOfStock) {
      setShoppingList((prev) => {
        const { mergedList, removedDuplicateIds } = mergeIngredientsIntoShoppingList(prev, [
          {
            id: `shop-pantry-${newItem.id}`,
            name: newItem.name,
            amount: newItem.amount ?? null,
            unit: newItem.unit || 'st',
            aisle: newItem.aisle || 'Skafferi',
            isPantryStaple: isCommonPantryStaple(newItem.name),
            checked: false,
            recipeSource: 'Hemmet',
            comment: newItem.comment,
          },
        ]);
        broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: mergedList });
        if (isLiveSupabase && household?.id) {
          if (removedDuplicateIds.length > 0) {
            deleteShoppingItemsFromSupabase(removedDuplicateIds);
          }
          pushShoppingItemsToSupabase(mergedList, household.id);
        }
        return mergedList;
      });
    }
  }, [household?.id, isLiveSupabase]);

  const updatePantryItem = useCallback((item: PantryItem) => {
    setPantryItems((prev) => {
      const updated = prev.map((p) => (p.id === item.id ? item : p));
      broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: updated });
      return updated;
    });
  }, []);

  const deletePantryItem = useCallback((id: string) => {
    setPantryItems((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: updated });
      return updated;
    });
  }, []);

  const togglePantryItemStock = useCallback((id: string, isOutOfStock?: boolean) => {
    let targetItem: PantryItem | undefined;
    let nextStockState = false;

    setPantryItems((prev) => {
      const updated = prev.map((p) => {
        if (p.id === id) {
          nextStockState = isOutOfStock !== undefined ? isOutOfStock : !p.isOutOfStock;
          targetItem = { ...p, isOutOfStock: nextStockState };
          return targetItem;
        }
        return p;
      });
      broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: updated });
      return updated;
    });

    if (!targetItem) return;

    if (nextStockState) {
      setShoppingList((prev) => {
        const { mergedList, removedDuplicateIds } = mergeIngredientsIntoShoppingList(prev, [
          {
            id: `shop-pantry-${targetItem!.id}`,
            name: targetItem!.name,
            amount: targetItem!.amount ?? null,
            unit: targetItem!.unit || 'st',
            aisle: targetItem!.aisle || 'Skafferi',
            isPantryStaple: isCommonPantryStaple(targetItem!.name),
            checked: false,
            recipeSource: 'Hemmet',
            comment: targetItem!.comment,
          },
        ]);
        broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: mergedList });
        if (isLiveSupabase && household?.id) {
          if (removedDuplicateIds.length > 0) {
            deleteShoppingItemsFromSupabase(removedDuplicateIds);
          }
          pushShoppingItemsToSupabase(mergedList, household.id);
        }
        return mergedList;
      });
    } else {
      const key = normalizeIngredientKey(targetItem.name, targetItem.unit);
      setShoppingList((prev) => {
        let changed = false;
        const updated = prev.map((shopItem) => {
          const sKey = normalizeIngredientKey(shopItem.name, shopItem.unit);
          if (sKey === key && !shopItem.checked) {
            changed = true;
            return { ...shopItem, checked: true };
          }
          return shopItem;
        });
        if (changed) {
          broadcastLocalChange({ type: 'SHOPPING_UPDATE', payload: updated });
          if (isLiveSupabase && household?.id) {
            pushShoppingItemsToSupabase(updated, household.id);
          }
          return updated;
        }
        return prev;
      });
    }
  }, [household?.id, isLiveSupabase]);

  const resetToMockData = useCallback(() => {
    const cleanRecs = INITIAL_RECIPES.map(sanitizeRecipe);
    setRecipes(cleanRecs);
    const cleanPlan = normalizeMealPlan(INITIAL_MEAL_PLAN, cleanRecs);
    setMealPlan(cleanPlan);
    setCustomSubcategories([]);
    setPantryItems([]);
    localStorage.setItem(STARTER_SEEDED_KEY, 'true');
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(cleanRecs));
    localStorage.removeItem(MEAL_PLAN_STORAGE_KEY);
    localStorage.removeItem(SHOPPING_STORAGE_KEY);
    localStorage.removeItem(PANTRY_STORAGE_KEY);
    localStorage.removeItem(CUSTOM_SUBCATEGORIES_STORAGE_KEY);
    clearAisleOverrides();
    broadcastLocalChange({ type: 'RECIPES_SYNC', payload: cleanRecs });
    broadcastLocalChange({ type: 'MEALPLAN_UPDATE', payload: cleanPlan });
    broadcastLocalChange({ type: 'PANTRY_UPDATE', payload: [] });
  }, []);

  return (
    <RecipeContext.Provider
      value={{
        recipes,
        selectedRecipe,
        activeTab,
        mealPlan: weekMealPlan,
        planWeekStart,
        setPlanWeekStart,
        today,
        getMealPlanForDate,
        shoppingList,
        household,
        households,
        currentUser,
        isHouseholdAdmin,
        realtimeStatus,
        isLiveSupabase,
        lastSyncTimestamp,
        customSubcategories,
        addCustomSubcategory,
        removeCustomSubcategory,
        pantryItems,
        addPantryItem,
        updatePantryItem,
        deletePantryItem,
        togglePantryItemStock,
        setActiveTab,
        openRecipeDetail,
        closeRecipeDetail,
        toggleFavorite,
        updateNotes,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        clearAllRecipes,
        setMealPlanForDay,
        setMealPlanForDate,
        setMealPlanServings,
        clearMealPlan,
        generateShoppingListFromWeek,
        addIngredientsToShoppingList,
        restoreShoppingList,
        toggleShoppingItem,
        deleteShoppingItem,
        clearCheckedShoppingItems,
        addCustomShoppingItem,
        updateShoppingItemComment,
        updateShoppingItemAisle,
        rememberShoppingAisle,
        setHouseholdName,
        createHousehold,
        joinHouseholdByCode,
        switchHousehold,
        deleteHousehold,
        leaveHousehold,
        regenerateHouseholdCode,
        addMemberToHousehold,
        updateMemberInHousehold,
        removeMemberFromHousehold,
        joinRequests,
        pendingJoin,
        approveJoinRequest,
        rejectJoinRequest,
        cancelPendingJoin,
        setCurrentUser,
        resetToMockData,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </RecipeContext.Provider>
  );
};

export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
};
