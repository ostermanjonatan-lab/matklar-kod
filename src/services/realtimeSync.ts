import { cleanLeadingStepNumber } from '../utils/formatters';
import { getSupabase } from './supabaseClient';
import type { Recipe, MealPlanDay, ShoppingItem, Household, UserProfile, PantryItem, HouseholdJoinRequest } from '../types/recipe';
import { WEEKDAY_NAMES, getWeekDates, getWeekStart, isISODate } from '../utils/mealPlanDates';
import { splitDifficultyTag, withDifficultyTag, estimateDifficulty } from '../utils/recipeDifficulty';
import { getRecipeSubcategories } from '../types/recipe';
import {
  getAisleOverride,
  loadAisleOverrides,
  mergeAisleOverrides,
  normalizeIngredientKey,
  addShoppingAmounts,
  normalizeIngredientNameForMatching,
  normalizeRecipeSource,
} from '../utils/shoppingAggregator';
import { resolveSavedAisle, isCommonPantryStaple } from '../utils/ingredientParser';

export type SyncMessageType =
  | { type: 'RECIPE_UPDATE'; payload: Recipe }
  | { type: 'RECIPE_DELETE'; payload: { id: string } }
  | { type: 'RECIPES_SYNC'; payload: Recipe[] }
  | { type: 'MEALPLAN_UPDATE'; payload: MealPlanDay[] }
  | { type: 'SHOPPING_UPDATE'; payload: ShoppingItem[] }
  | { type: 'PANTRY_UPDATE'; payload: PantryItem[] }
  | { type: 'HOUSEHOLD_UPDATE'; payload: { id: string; name: string; joinCode: string; creatorId?: string; members?: UserProfile[] } }
  | { type: 'JOIN_REQUEST'; payload: HouseholdJoinRequest }
  | { type: 'JOIN_REQUEST_APPROVED'; payload: { requestId: string; householdId: string; userId: string; displayName: string; user?: UserProfile } }
  | { type: 'JOIN_REQUEST_REJECTED'; payload: { requestId: string; householdId: string; userId?: string } };

// Local broadcast channel for multi-tab / device instant sync
const localChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('receptapp_realtime_sync')
  : null;

export function broadcastLocalChange(msg: SyncMessageType) {
  try {
    localChannel?.postMessage(msg);
  } catch (e) {
    console.warn('BroadcastChannel error:', e);
  }
}

export function subscribeToLocalChanges(onMessage: (msg: SyncMessageType) => void) {
  if (!localChannel) return () => {};

  const handler = (event: MessageEvent<SyncMessageType>) => {
    if (event.data) {
      onMessage(event.data);
    }
  };

  localChannel.addEventListener('message', handler);
  return () => {
    localChannel.removeEventListener('message', handler);
  };
}

/**
 * Maps Supabase row to local Recipe object
 */
export function mapRowToRecipe(row: any): Recipe {
  const subcategories = getRecipeSubcategories({
    title: row.title,
    description: row.description,
    notes: row.notes,
    subcategory: row.subcategory,
    subcategories: row.subcategories,
  });

  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title || 'Recept',
    description: row.description || '',
    coverImageUrl: row.cover_image_url || '',
    recipeDocumentUrl: row.recipe_document_url || undefined,
    sourceUrl: row.source_url || undefined,
    sourceType: row.source_type || 'manual',
    servings: row.servings || 4,
    category: row.category || 'Middag',
    subcategory: row.subcategory || (subcategories.join(', ') || ''),
    subcategories: subcategories.length > 0 ? subcategories : (row.subcategory ? [row.subcategory] : []),
    rating: row.rating ?? 5,
    isFavorite: Boolean(row.is_favorite),
    notes: row.notes || '',
    // Whether something is a staple is worked out again, so a change in the rules reaches old recipes
    ingredients: Array.isArray(row.ingredients)
      ? row.ingredients.map((ing: any) => ({ ...ing, isPantryStaple: isCommonPantryStaple(ing?.name || '') }))
      : [],
    instructions: Array.isArray(row.instructions)
      ? row.instructions.map((inst: any) => ({ ...inst, text: cleanLeadingStepNumber(inst?.text || '') }))
      : [],
    prepTimeMinutes: 0,
    cookTimeMinutes: Number(row.cook_time_minutes) > 0 ? Number(row.cook_time_minutes) : (Number(row.prep_time_minutes) || 30),
    // The difficulty is kept as a hidden tag, see utils/recipeDifficulty.ts
    tags: splitDifficultyTag(row.tags).tags,
    difficulty:
      splitDifficultyTag(row.tags).difficulty ??
      estimateDifficulty({
        title: row.title,
        ingredients: Array.isArray(row.ingredients)
          ? row.ingredients.map((ing: any) => ({ name: ing?.name || '', isPantryStaple: isCommonPantryStaple(ing?.name || '') }))
          : [],
        instructions: Array.isArray(row.instructions) ? row.instructions : [],
        cookTimeMinutes: Number(row.cook_time_minutes) || 0,
      }),
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

/**
 * Pushes a recipe update to Supabase
 */
export async function pushRecipeToSupabase(recipe: Recipe, householdId: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  const subcategoryStr =
    Array.isArray(recipe.subcategories) && recipe.subcategories.length > 0
      ? recipe.subcategories.join(', ')
      : recipe.subcategory || '';

  try {
    await supabase.from('recipes').upsert({
      id: recipe.id,
      household_id: householdId,
      title: recipe.title,
      description: recipe.description || '',
      cover_image_url: recipe.coverImageUrl || '',
      recipe_document_url: recipe.recipeDocumentUrl || null,
      source_url: recipe.sourceUrl || null,
      source_type: recipe.sourceType || 'manual',
      servings: recipe.servings || 4,
      category: recipe.category || 'Middag',
      subcategory: subcategoryStr,
      rating: recipe.rating ?? 5,
      is_favorite: Boolean(recipe.isFavorite),
      notes: recipe.notes || '',
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      prep_time_minutes: 0,
      cook_time_minutes: Number(recipe.cookTimeMinutes) > 0 ? Number(recipe.cookTimeMinutes) : (Number(recipe.prepTimeMinutes) || 30),
      tags: withDifficultyTag(recipe.tags, recipe.difficulty),
      created_at: recipe.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to push recipe to Supabase:', err);
  }
}

/**
 * Deletes a recipe from Supabase
 */
export async function deleteRecipeFromSupabase(recipeId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
    if (error) {
      console.error('Failed to delete recipe from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete recipe from Supabase:', err);
    return false;
  }
}

/**
 * Pushes meal plan to Supabase
 */
export async function pushMealPlanToSupabase(mealPlan: MealPlanDay[], householdId: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // One row per date. The date is part of the id, so the table needs no new column.
    const rows = mealPlan.filter((m) => isISODate(m.dateStr)).map((m) => ({
      id: mealPlanRowId(householdId, m.dateStr as string),
      household_id: householdId,
      day_name: m.dayName,
      lunch_recipe_id: m.lunchRecipeId || null,
      dinner_recipe_id: m.dinnerRecipeId || null,
      custom_lunch: m.customLunch || '',
      custom_dinner: m.customDinner || '',
      updated_at: new Date().toISOString(),
    }));

    if (rows.length === 0) return;
    const { error } = await supabase.from('meal_plans').upsert(rows);
    if (error) console.warn('Failed to push meal plan to Supabase:', error);
  } catch (err) {
    console.warn('Failed to push meal plan to Supabase:', err);
  }
}

function mealPlanRowId(householdId: string, dateStr: string): string {
  return `${householdId}_${dateStr}`;
}

/** The date in a meal plan row id, or null for rows saved by older versions (one row per weekday). */
function dateFromMealPlanRowId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const match = id.match(/_(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}

/**
 * Older versions saved seven rows named after the weekdays. They are moved to dated rows in the
 * current week (unless that week already has dated rows) and then removed, so they do not come
 * back every week. The old rows are only removed once the new ones are saved.
 */
async function migrateLegacyMealPlanRows(householdId: string, rows: any[]): Promise<MealPlanDay[]> {
  const supabase = getSupabase();
  const legacy = rows.filter((r) => !dateFromMealPlanRowId(r.id));
  if (!supabase || legacy.length === 0) return [];

  const weekDates = getWeekDates(getWeekStart());
  const weekHasDatedRows = rows.some((r) => {
    const date = dateFromMealPlanRowId(r.id);
    return date !== null && weekDates.includes(date);
  });

  const migrated: MealPlanDay[] = [];
  if (!weekHasDatedRows) {
    legacy.forEach((row) => {
      const idx = WEEKDAY_NAMES.indexOf(row.day_name);
      if (idx === -1) return;
      migrated.push({
        dayName: row.day_name,
        dateStr: weekDates[idx],
        lunchRecipeId: row.lunch_recipe_id || null,
        dinnerRecipeId: row.dinner_recipe_id || null,
        customLunch: row.custom_lunch || '',
        customDinner: row.custom_dinner || '',
        dinnerServings: 4,
        lunchServings: 2,
      });
    });
  }

  try {
    if (migrated.length > 0) {
      const { error } = await supabase.from('meal_plans').upsert(
        migrated.map((m) => ({
          id: mealPlanRowId(householdId, m.dateStr as string),
          household_id: householdId,
          day_name: m.dayName,
          lunch_recipe_id: m.lunchRecipeId || null,
          dinner_recipe_id: m.dinnerRecipeId || null,
          custom_lunch: m.customLunch || '',
          custom_dinner: m.customDinner || '',
          updated_at: new Date().toISOString(),
        }))
      );
      if (error) {
        console.warn('Failed to move old meal plan rows:', error);
        return migrated;
      }
    }
    await supabase.from('meal_plans').delete().in('id', legacy.map((r) => r.id));
  } catch (err) {
    console.warn('Failed to move old meal plan rows:', err);
  }
  return migrated;
}

/**
 * Pushes shopping items to Supabase
 */
export async function pushShoppingItemsToSupabase(items: ShoppingItem[], householdId: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const rows = items.map((item) => {
      let combinedSource: string | null = null;
      const cleanSource = normalizeRecipeSource(item.recipeSource);
      if (item.comment && cleanSource) {
        combinedSource = `${cleanSource} • Kommentar: ${item.comment}`;
      } else if (item.comment) {
        combinedSource = `Kommentar: ${item.comment}`;
      } else if (cleanSource) {
        combinedSource = cleanSource;
      }

      return {
        id: item.id,
        household_id: householdId,
        name: item.name,
        amount: item.amount,
        unit: item.unit || '',
        aisle: item.aisle || 'Övrigt',
        is_pantry_staple: Boolean(item.isPantryStaple),
        checked: Boolean(item.checked),
        recipe_source: combinedSource,
        updated_at: new Date().toISOString(),
      };
    });

    await supabase.from('shopping_items').upsert(rows);
  } catch (err) {
    console.warn('Failed to push shopping items to Supabase:', err);
  }
}

/**
 * Updates checked status for a single shopping item in Supabase
 */
export async function updateShoppingItemCheckedInSupabase(itemId: string, checked: boolean) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('shopping_items')
      .update({
        checked,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);
  } catch (err) {
    console.warn('Failed to update shopping item checked status:', err);
  }
}

/**
 * Updates comment for a single shopping item in Supabase
 */
export async function updateShoppingItemAisleInSupabase(id: string, aisle: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('shopping_items')
      .update({
        aisle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch (err) {
    console.error('Failed to update shopping item aisle in Supabase:', err);
  }
}

export async function pushAisleOverrideToSupabase(householdId: string, name: string, aisle: string) {
  const supabase = getSupabase();
  if (!supabase || !householdId) return;

  const { error } = await supabase.from('aisle_overrides').upsert({
    household_id: householdId,
    ingredient_key: normalizeIngredientNameForMatching(name),
    aisle,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('Could not share aisle choice:', error.message);
}

/**
 * Fetches the household's aisle choices into the local cache and shares
 * choices that only exist on this device. The household's choice wins on conflict.
 */
export async function syncAisleOverridesWithSupabase(householdId: string) {
  const supabase = getSupabase();
  if (!supabase || !householdId) return;

  const { data, error } = await supabase
    .from('aisle_overrides')
    .select('ingredient_key, aisle')
    .eq('household_id', householdId);
  if (error) {
    // Choices stay on this device until the table exists
    console.warn('Could not fetch aisle choices:', error.message);
    return;
  }

  const remote: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    remote[row.ingredient_key] = row.aisle;
  });

  const localOnly = Object.entries(loadAisleOverrides())
    .filter(([key]) => !(key in remote))
    .map(([key, aisle]) => ({
      household_id: householdId,
      ingredient_key: key,
      aisle,
      updated_at: new Date().toISOString(),
    }));

  mergeAisleOverrides(remote);

  if (localOnly.length > 0) {
    const { error: pushError } = await supabase.from('aisle_overrides').upsert(localOnly);
    if (pushError) console.warn('Could not share aisle choices:', pushError.message);
  }
}

// Uses its own channel so a missing table can't break realtime for the other tables
export function subscribeToAisleOverrides(householdId: string, onChange: () => void) {
  const supabase = getSupabase();
  if (!supabase || !householdId) return () => {};

  const channel = supabase
    .channel(`aisle-overrides-${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'aisle_overrides',
        filter: `household_id=eq.${householdId}`,
      },
      (payload: any) => {
        if (payload.new?.ingredient_key && payload.new?.aisle) {
          mergeAisleOverrides({ [payload.new.ingredient_key]: payload.new.aisle });
          onChange();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateShoppingItemCommentInSupabase(item: ShoppingItem) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    let combinedSource: string | null = null;
    const cleanSource = normalizeRecipeSource(item.recipeSource);
    if (item.comment && cleanSource) {
      combinedSource = `${cleanSource} • Kommentar: ${item.comment}`;
    } else if (item.comment) {
      combinedSource = `Kommentar: ${item.comment}`;
    } else if (cleanSource) {
      combinedSource = cleanSource;
    }

    await supabase
      .from('shopping_items')
      .update({
        recipe_source: combinedSource,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  } catch (err) {
    console.warn('Failed to update shopping item comment:', err);
  }
}

/**
 * Maps a Supabase shopping_items row to a ShoppingItem domain model
 */
export function mapRowToShoppingItem(row: any): ShoppingItem {
  let recipeSource: string | undefined = undefined;
  let comment: string | undefined = undefined;
  if (row.recipe_source) {
    if (row.recipe_source.startsWith('Kommentar: ')) {
      comment = row.recipe_source.replace(/^Kommentar:\s*/, '');
    } else if (row.recipe_source.includes(' • Kommentar: ')) {
      const parts = row.recipe_source.split(' • Kommentar: ');
      recipeSource = normalizeRecipeSource(parts[0]);
      comment = parts[1];
    } else {
      recipeSource = normalizeRecipeSource(row.recipe_source);
    }
  }

  return {
    id: row.id,
    name: row.name,
    amount: row.amount ? Number(row.amount) : null,
    unit: row.unit || '',
    aisle: getAisleOverride(row.name) ?? resolveSavedAisle(row.name, row.aisle),
    isPantryStaple: isCommonPantryStaple(row.name || ''),
    checked: Boolean(row.checked),
    recipeSource,
    comment,
  };
}

/**
 * Deletes a shopping item from Supabase
 */
export async function deleteShoppingItemFromSupabase(itemId: string) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('shopping_items').delete().eq('id', itemId);
  } catch (err) {
    console.warn('Failed to delete shopping item from Supabase:', err);
  }
}

/**
 * Deletes multiple shopping items from Supabase by IDs
 */
export async function deleteShoppingItemsFromSupabase(itemIds: string[]) {
  const supabase = getSupabase();
  if (!supabase || !itemIds || itemIds.length === 0) return;

  try {
    await supabase.from('shopping_items').delete().in('id', itemIds);
  } catch (err) {
    console.warn('Failed to delete shopping items from Supabase:', err);
  }
}

/**
 * Fetches all household data from Supabase on connect or mount
 */
export async function fetchHouseholdDataFromSupabase(householdId: string): Promise<{
  household?: Household;
  recipes?: Recipe[];
  mealPlan?: MealPlanDay[];
  shoppingItems?: ShoppingItem[];
}> {
  const supabase = getSupabase();
  if (!supabase || !householdId) return {};

  try {
    const [hhRes, profilesRes, recipesRes, mealPlansRes, shoppingRes] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
      supabase.from('profiles').select('*').eq('household_id', householdId).order('created_at', { ascending: true }),
      supabase.from('recipes').select('*').eq('household_id', householdId).order('created_at', { ascending: false }),
      supabase.from('meal_plans').select('*').eq('household_id', householdId),
      supabase.from('shopping_items').select('*').eq('household_id', householdId),
    ]);

    const result: {
      household?: Household;
      recipes?: Recipe[];
      mealPlan?: MealPlanDay[];
      shoppingItems?: ShoppingItem[];
    } = {};

    if (hhRes.data) {
      // Filter out pending join applicants so they do not show up as household members before approval
      const activeProfiles = (profilesRes.data || []).filter((p: any) => {
        const isPending =
          (p.avatar_emoji && (p.avatar_emoji.startsWith('PENDING_JOIN') || p.avatar_emoji === '⏳_PENDING')) ||
          p.role_title === 'Väntar på godkännande';
        return !isPending;
      });

      // Sort profiles strictly by created_at ascending to guarantee the earliest creator is index 0
      const sortedProfiles = activeProfiles.slice().sort((a: any, b: any) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      });

      const creatorId = hhRes.data.creator_id || (sortedProfiles.length > 0 ? sortedProfiles[0].id : undefined);

      const members: UserProfile[] = sortedProfiles.map((p: any) => {
        const isCreator = Boolean(creatorId && p.id === creatorId);
        return {
          id: p.id,
          displayName: p.display_name,
          initials: (p.display_name || 'M').charAt(0).toUpperCase(),
          roleTitle: isCreator ? 'Admin' : (p.role_title && p.role_title !== 'Admin' ? p.role_title : 'Medlem'),
          isAdmin: isCreator,
        };
      });

      result.household = {
        id: hhRes.data.id,
        name: hhRes.data.name,
        joinCode: hhRes.data.join_code,
        creatorId,
        members,
      };
    }

    if (recipesRes.data) {
      result.recipes = recipesRes.data.map(mapRowToRecipe);
    }

    if (mealPlansRes.data && mealPlansRes.data.length > 0) {
      const dated: MealPlanDay[] = mealPlansRes.data
        .filter((row: any) => dateFromMealPlanRowId(row.id))
        .map((row: any) => ({
          dayName: row.day_name,
          dateStr: dateFromMealPlanRowId(row.id) as string,
          lunchRecipeId: row.lunch_recipe_id || null,
          dinnerRecipeId: row.dinner_recipe_id || null,
          customLunch: row.custom_lunch || '',
          customDinner: row.custom_dinner || '',
          dinnerServings: 4,
          lunchServings: 2,
        }));
      const migrated = await migrateLegacyMealPlanRows(householdId, mealPlansRes.data);
      result.mealPlan = [...dated, ...migrated];
    }

    if (shoppingRes.data && shoppingRes.data.length > 0) {
      const seen = new Map<string, ShoppingItem>();
      const duplicateIdsToDelete: string[] = [];
      const deduplicated: ShoppingItem[] = [];

      for (const row of shoppingRes.data) {
        const item = mapRowToShoppingItem(row);

        const key = normalizeIngredientKey(item.name, item.unit);
        if (seen.has(key)) {
          // Preexisting duplicate in Supabase from prior sessions: merge amounts & remove duplicate ID
          const existing = seen.get(key)!;
          const sum = addShoppingAmounts(existing, item);
          existing.amount = sum.amount;
          existing.unit = sum.unit;
          if (!existing.comment && item.comment) {
            existing.comment = item.comment;
          }
          duplicateIdsToDelete.push(item.id);
        } else {
          seen.set(key, item);
          deduplicated.push(item);
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        deleteShoppingItemsFromSupabase(duplicateIdsToDelete);
      }

      result.shoppingItems = deduplicated;
    }

    return result;
  } catch (err) {
    console.warn('Error fetching household data from Supabase:', err);
    return {};
  }
}

/**
 * Subscribe to live Supabase Realtime Postgres Changes for the active household
 */
/** The open channel for each household, so a tick can be sent straight to the others */
const householdChannels = new Map<string, ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']>>();

/**
 * Tells the others in the household at once that an item was ticked or unticked. The database
 * also reports the change, but this arrives faster and still works if the database's own
 * notices are not set up or have stopped.
 */
export function broadcastShoppingChecked(householdId: string, id: string, checked: boolean) {
  const channel = householdChannels.get(householdId);
  if (!channel) return;
  channel
    .send({ type: 'broadcast', event: 'shopping_checked', payload: { id, checked } })
    .catch(() => {
      // The database update still reaches them
    });
}

export function subscribeToSupabaseRealtime(
  householdId: string,
  callbacks: {
    onRecipeChange?: (payload: any) => void;
    onMealPlanChange?: (payload: any) => void;
    onShoppingChange?: (payload: any) => void;
    /** Another phone ticked or unticked an item */
    onShoppingChecked?: (id: string, checked: boolean) => void;
    onJoinRequestChange?: (payload: any) => void;
    onProfileChange?: (payload: any) => void;
    onHouseholdChange?: (payload: any) => void;
    /** The connection came back after being lost: changes may have been missed */
    onReconnect?: () => void;
  }
) {
  const supabase = getSupabase();
  if (!supabase || !householdId) return () => {};

  let wasConnected = false;
  let lost = false;
  const channel = supabase
    .channel(`household-${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recipes',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        callbacks.onRecipeChange?.(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'meal_plans',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        callbacks.onMealPlanChange?.(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shopping_items',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        callbacks.onShoppingChange?.(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_join_requests',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        callbacks.onJoinRequestChange?.(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        callbacks.onProfileChange?.(payload);
        callbacks.onJoinRequestChange?.(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'households',
        filter: `id=eq.${householdId}`,
      },
      (payload) => {
        callbacks.onHouseholdChange?.(payload);
      }
    )
    .on('broadcast', { event: 'join_request' }, (payload) => {
      callbacks.onJoinRequestChange?.(payload);
    })
    .on('broadcast', { event: 'join_request_approved' }, (payload) => {
      callbacks.onProfileChange?.(payload);
      callbacks.onHouseholdChange?.(payload);
      callbacks.onJoinRequestChange?.(payload);
    })
    .on('broadcast', { event: 'join_request_rejected' }, (payload) => {
      callbacks.onProfileChange?.(payload);
      callbacks.onJoinRequestChange?.(payload);
    })
    .on('broadcast', { event: 'shopping_checked' }, (message) => {
      const data = message?.payload;
      if (data && typeof data.id === 'string' && typeof data.checked === 'boolean') {
        callbacks.onShoppingChecked?.(data.id, data.checked);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (wasConnected && lost) callbacks.onReconnect?.();
        wasConnected = true;
        lost = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        lost = true;
      }
    });
  householdChannels.set(householdId, channel);

  return () => {
    if (householdChannels.get(householdId) === channel) householdChannels.delete(householdId);
    supabase.removeChannel(channel);
  };
}

/**
 * Safely upserts a profile into Supabase, retrying without optional columns if schema cache lacks them (e.g. role_title)
 */
export async function safeUpsertProfileInSupabase(profile: {
  id: string;
  household_id: string;
  display_name: string;
  avatar_emoji?: string;
  role_title?: string;
  created_at?: string;
  updated_at?: string;
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  const row: Record<string, any> = {
    id: profile.id,
    household_id: profile.household_id,
    display_name: profile.display_name,
    avatar_emoji: profile.avatar_emoji || '🧑‍🍳',
    updated_at: profile.updated_at || new Date().toISOString(),
  };
  if (profile.created_at) {
    row.created_at = profile.created_at;
  }
  if (profile.role_title) {
    row.role_title = profile.role_title;
  }

  try {
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('role_title')) {
        delete row.role_title;
        await supabase.from('profiles').upsert(row);
      } else {
        console.warn('safeUpsertProfileInSupabase error:', error);
      }
    }
  } catch (err) {
    console.warn('safeUpsertProfileInSupabase failed:', err);
  }
}

/**
 * Safely upserts a household into Supabase, retrying without creator_id if the column does not exist
 */
export async function safeUpsertHouseholdInSupabase(household: {
  id: string;
  name: string;
  join_code: string;
  creator_id?: string;
  created_at?: string;
  updated_at?: string;
}) {
  const supabase = getSupabase();
  if (!supabase) return;

  const row: Record<string, any> = {
    id: household.id,
    name: household.name,
    join_code: household.join_code,
    updated_at: household.updated_at || new Date().toISOString(),
  };
  if (household.created_at) {
    row.created_at = household.created_at;
  }
  if (household.creator_id) {
    row.creator_id = household.creator_id;
  }

  try {
    const { error } = await supabase.from('households').upsert(row);
    if (error) {
      if (error.code === 'PGRST204' || (error as any).code === '42703' || error.message?.includes('creator_id')) {
        delete row.creator_id;
        await supabase.from('households').upsert(row);
      } else {
        console.warn('safeUpsertHouseholdInSupabase error:', error);
      }
    }
  } catch (err) {
    console.warn('safeUpsertHouseholdInSupabase failed:', err);
  }
}

/**
 * Listens for approval/rejection of a specific join request
 */
export function subscribeToJoinRequestApproval(
  requestId: string,
  onStatusChange: (status: 'pending' | 'approved' | 'rejected') => void,
  householdId?: string,
  userId?: string
) {
  const supabase = getSupabase();
  if (!supabase || !requestId) return () => {};

  const channel = supabase
    .channel(`join-request-${requestId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_join_requests',
        filter: `id=eq.${requestId}`,
      },
      (payload) => {
        const row = payload.new as any;
        if (row && row.status) {
          onStatusChange(row.status);
        }
      }
    );

  // If householdId is known, listen to real-time broadcast approval/rejection
  if (householdId) {
    channel
      .on('broadcast', { event: 'join_request_approved' }, (payload: any) => {
        const p = payload?.payload;
        if (p?.requestId === requestId || (userId && p?.userId === userId)) {
          onStatusChange('approved');
        }
      })
      .on('broadcast', { event: 'join_request_rejected' }, (payload: any) => {
        const p = payload?.payload;
        if (p?.requestId === requestId || (userId && p?.userId === userId)) {
          onStatusChange('rejected');
        }
      });
  }

  // Also listen to profiles changes for this user as fallback
  if (userId) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onStatusChange('rejected');
        } else if (payload.new) {
          const p = payload.new as any;
          const isPending =
            (p.avatar_emoji && (p.avatar_emoji.startsWith('PENDING_JOIN') || p.avatar_emoji === '⏳_PENDING')) ||
            p.role_title === 'Väntar på godkännande';
          if (!isPending) {
            onStatusChange('approved');
          }
        }
      }
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetches pending join requests for a household
 */
export async function fetchJoinRequestsFromSupabase(householdId: string): Promise<HouseholdJoinRequest[]> {
  const supabase = getSupabase();
  if (!supabase || !householdId) return [];

  const requests: HouseholdJoinRequest[] = [];
  const seenUserIds = new Set<string>();

  // 1. Try dedicated household_join_requests table first
  try {
    const { data, error } = await supabase
      .from('household_join_requests')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        requests.push({
          id: row.id,
          householdId: row.household_id,
          userId: row.user_id,
          displayName: row.display_name,
          status: row.status || 'pending',
          createdAt: row.created_at || new Date().toISOString(),
        });
        seenUserIds.add(row.user_id);
      }
    }
  } catch {
    // Proceed to profiles fallback
  }

  // 2. Query profiles fallback where avatar_emoji marks pending join
  try {
    const { data: pendingProfiles, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('household_id', householdId);

    if (!profileErr && Array.isArray(pendingProfiles)) {
      for (const p of pendingProfiles) {
        const isPending =
          (p.avatar_emoji && (p.avatar_emoji.startsWith('PENDING_JOIN') || p.avatar_emoji === '⏳_PENDING')) ||
          p.role_title === 'Väntar på godkännande';

        if (isPending && !seenUserIds.has(p.id)) {
          let reqId = `req-${p.id}`;
          if (p.avatar_emoji && p.avatar_emoji.startsWith('PENDING_JOIN:')) {
            reqId = p.avatar_emoji.replace('PENDING_JOIN:', '');
          }
          requests.push({
            id: reqId,
            householdId: p.household_id,
            userId: p.id,
            displayName: p.display_name,
            status: 'pending',
            createdAt: p.created_at || p.updated_at || new Date().toISOString(),
          });
          seenUserIds.add(p.id);
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching pending profiles fallback:', err);
  }

  return requests;
}

/**
 * Creates a join request in Supabase
 */
export async function createJoinRequestInSupabase(req: HouseholdJoinRequest): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // 1. Try household_join_requests table
  try {
    await supabase.from('household_join_requests').upsert({
      id: req.id,
      household_id: req.householdId,
      user_id: req.userId,
      display_name: req.displayName,
      status: req.status,
      created_at: req.createdAt,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    // Expected if table does not exist
  }

  // 2. Resilient fallback: write into profiles table so it persists without dedicated table
  try {
    await safeUpsertProfileInSupabase({
      id: req.userId,
      household_id: req.householdId,
      display_name: req.displayName,
      avatar_emoji: `PENDING_JOIN:${req.id}`,
      role_title: 'Väntar på godkännande',
      created_at: req.createdAt,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Fallback save to profiles failed:', err);
  }

  // 3. Supabase Realtime broadcast message for immediate zero-latency notification
  try {
    const ch = supabase.channel(`household-${req.householdId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'join_request',
          payload: req,
        }).catch(() => {});
      }
    });
  } catch (err) {
    console.warn('Realtime broadcast error:', err);
  }
}

/**
 * Updates join request status in Supabase (approved or rejected)
 */
export async function updateJoinRequestStatusInSupabase(
  requestId: string,
  status: 'approved' | 'rejected',
  meta?: { householdId?: string; userId?: string; displayName?: string }
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // 1. Try table update
  try {
    await supabase
      .from('household_join_requests')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);
  } catch {}

  // 2. Fallback updates on profiles table
  const userId = meta?.userId || (requestId.startsWith('req-') ? requestId.replace('req-', '') : null);
  if (userId) {
    if (status === 'approved') {
      await safeUpsertProfileInSupabase({
        id: userId,
        household_id: meta?.householdId || '',
        display_name: meta?.displayName || 'Medlem',
        avatar_emoji: '🧑‍🍳',
        role_title: 'Medlem',
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabase.from('profiles').delete().eq('id', userId);
    }
  }

  // 3. Broadcast status change across realtime channel
  if (meta?.householdId) {
    try {
      const channel = supabase.channel(`household-${meta.householdId}`);
      channel.subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: status === 'approved' ? 'join_request_approved' : 'join_request_rejected',
            payload: {
              requestId,
              householdId: meta.householdId,
              userId: meta.userId,
              displayName: meta.displayName,
            },
          }).catch(() => {});
        }
      });
    } catch {}
  }
}

/**
 * Checks current status of a join request in Supabase
 */
export async function checkJoinRequestStatusInSupabase(
  requestId: string,
  userId?: string
): Promise<'pending' | 'approved' | 'rejected' | null> {
  const supabase = getSupabase();
  if (!supabase || !requestId) return null;

  // 1. Try table first
  try {
    const { data, error } = await supabase
      .from('household_join_requests')
      .select('status')
      .eq('id', requestId)
      .maybeSingle();

    if (!error && data && data.status) {
      return data.status as 'pending' | 'approved' | 'rejected';
    }
  } catch {}

  // 2. Try profiles fallback
  const targetUserId = userId || (requestId.startsWith('req-') ? requestId.replace('req-', '') : null);
  if (targetUserId) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (error) return null;

      if (!profile) {
        return 'rejected';
      }

      const isStillPending =
        (profile.avatar_emoji && (profile.avatar_emoji.startsWith('PENDING_JOIN') || profile.avatar_emoji === '⏳_PENDING')) ||
        profile.role_title === 'Väntar på godkännande';

      if (isStillPending) {
        return 'pending';
      }

      return 'approved';
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Deletes a join request from Supabase
 */
export async function deleteJoinRequestInSupabase(requestId: string, userId?: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !requestId) return;

  try {
    await supabase.from('household_join_requests').delete().eq('id', requestId);
  } catch {}

  const targetUserId = userId || (requestId.startsWith('req-') ? requestId.replace('req-', '') : null);
  if (targetUserId) {
    try {
      await supabase.from('profiles').delete().eq('id', targetUserId);
    } catch {}
  }
}

export async function findHouseholdByJoinCode(joinCode: string): Promise<{
  household?: Household;
  recipes?: Recipe[];
  mealPlan?: MealPlanDay[];
  shoppingItems?: ShoppingItem[];
} | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const digitsOnly = joinCode.replace(/\D/g, '').slice(0, 6);
    const cleanCode = digitsOnly || joinCode.toUpperCase().trim();
    if (!cleanCode) return null;

    let { data: hhData, error: hhErr } = await supabase
      .from('households')
      .select('*')
      .eq('join_code', cleanCode)
      .maybeSingle();

    if (!hhData && cleanCode.length >= 4) {
      const fallback = await supabase
        .from('households')
        .select('*')
        .ilike('join_code', `%${cleanCode}%`)
        .maybeSingle();
      if (fallback.data) {
        hhData = fallback.data;
      }
    }

    if (!hhData) {
      if (hhErr) console.error('Error finding household by join code:', hhErr);
      return null;
    }

    // Fetch existing members from profiles sorted strictly by created_at ascending
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .eq('household_id', hhData.id)
      .order('created_at', { ascending: true });

    const sortedProfiles = (profilesData || []).slice().sort((a: any, b: any) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeA - timeB;
    });

    const creatorId = hhData.creator_id || (sortedProfiles.length > 0 ? sortedProfiles[0].id : undefined);

    const members: UserProfile[] = sortedProfiles.map((p: any) => {
      const isCreator = Boolean(creatorId && p.id === creatorId);
      return {
        id: p.id,
        displayName: p.display_name,
        initials: (p.display_name || 'M').charAt(0).toUpperCase(),
        roleTitle: isCreator ? 'Admin' : (p.role_title && p.role_title !== 'Admin' ? p.role_title : 'Medlem'),
        isAdmin: isCreator,
      };
    });

    const household: Household = {
      id: hhData.id,
      name: hhData.name,
      joinCode: hhData.join_code,
      creatorId,
      members,
    };

    return {
      household,
      recipes: [],
      mealPlan: [],
      shoppingItems: [],
    };
  } catch (err) {
    console.error('Error finding household by join code:', err);
    return null;
  }
}

