import type { Recipe, MealPlanDay, ShoppingItem } from '../types/recipe';
import { scaleIngredientAmount, stripPreparation } from './formatters';
import { detectAisle, normalizeUnit } from './ingredientParser';

/**
 * Normalizes an ingredient name for matching/deduplication in the shopping list.
 * Strips comments in parentheses, optional descriptors (t.ex. färsk, små, ekologisk),
 * and maps Swedish plural forms to singular so items like "1 gul lök" and "2 gula lökar" merge.
 */
export function normalizeIngredientNameForMatching(name: string): string {
  if (!name) return '';

  const clean = stripPreparation(name)
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/^(?:färska?|små|stora?|valfria?|ekologiska?|torkade?|frysta?)\s+/i, '')
    .trim();

  // Known singular-plural equivalences for Swedish groceries
  const STEM_MAP: Array<{ regex: RegExp; replacement: string }> = [
    { regex: /^gula?\s+lök(?:ar)?$/i, replacement: 'gul lök' },
    { regex: /^röda?\s+lök(?:ar)?$|^rödlök(?:ar)?$/i, replacement: 'rödlök' },
    { regex: /^schalottenlök(?:ar)?$/i, replacement: 'schalottenlök' },
    { regex: /^salladslök(?:ar)?$/i, replacement: 'salladslök' },
    { regex: /^lök(?:ar)?$/i, replacement: 'lök' },
    { regex: /^morot$|^morötter$/i, replacement: 'morot' },
    { regex: /^tomat(?:er)?$/i, replacement: 'tomat' },
    { regex: /^körsbärstomat(?:er)?$/i, replacement: 'körsbärstomat' },
    { regex: /^plommontomat(?:er)?$/i, replacement: 'plommontomat' },
    { regex: /^gurka$|^gurkor$/i, replacement: 'gurka' },
    { regex: /^paprika$|^paprikor$/i, replacement: 'paprika' },
    { regex: /^banan(?:er)?$/i, replacement: 'banan' },
    { regex: /^äpple$|^äpplen$/i, replacement: 'äpple' },
    { regex: /^päron$/i, replacement: 'päron' },
    { regex: /^citron(?:er)?$/i, replacement: 'citron' },
    { regex: /^lime(?:frukter)?$/i, replacement: 'lime' },
    { regex: /^avokado$|^avokador$|^avokados$/i, replacement: 'avokado' },
    { regex: /^potatis(?:ar)?$/i, replacement: 'potatis' },
    { regex: /^bakpotatis(?:ar)?$/i, replacement: 'bakpotatis' },
    { regex: /^sötpotatis(?:ar)?$/i, replacement: 'sötpotatis' },
    { regex: /^palsternacka$|^palsternackor$/i, replacement: 'palsternacka' },
    { regex: /^rödbeta$|^rödbetor$/i, replacement: 'rödbeta' },
    { regex: /^polkabeta$|^polkabetor$/i, replacement: 'polkabeta' },
    { regex: /^gulbeta$|^gulbetor$/i, replacement: 'gulbeta' },
    { regex: /^champinjon(?:er)?$/i, replacement: 'champinjon' },
    { regex: /^vitlöksklyfta$|^vitlöksklyftor$/i, replacement: 'vitlöksklyfta' },
    { regex: /^vitlökshuvud$|^vitlökshuvuden$/i, replacement: 'vitlökshuvud' },
    { regex: /^chilifrukt(?:er)?$/i, replacement: 'chili' },
    { regex: /^chilisåser$/i, replacement: 'chilisås' },
    { regex: /^majskorn$/i, replacement: 'majs' },
    { regex: /^majskolvar$/i, replacement: 'majskolv' },
    { regex: /^kycklingfilé(?:er)?$/i, replacement: 'kycklingfilé' },
    { regex: /^laxfilé(?:er)?$/i, replacement: 'laxfilé' },
    { regex: /^torskrygg(?:ar)?$/i, replacement: 'torskrygg' },
    { regex: /^dadel$|^dadlar$/i, replacement: 'dadel' },
    { regex: /^mandel$|^mandlar$/i, replacement: 'mandel' },
    { regex: /^valnöt$|^valnötter$/i, replacement: 'valnöt' },
    { regex: /^hasselnöt$|^hasselnötter$/i, replacement: 'hasselnöt' },
    { regex: /^jordnöt$|^jordnötter$/i, replacement: 'jordnöt' },
    { regex: /^rädisa$|^rädisor$/i, replacement: 'rädisa' },
    { regex: /^oliv(?:er)?$/i, replacement: 'oliv' },
    { regex: /^kikärta$|^kikärtor$/i, replacement: 'kikärta' },
    { regex: /^böna$|^bönor$/i, replacement: 'böna' },
    { regex: /^kantarell(?:er)?$/i, replacement: 'kantarell' },
    { regex: /^tortillas?$|^tortillabröd$/i, replacement: 'tortilla' },
    { regex: /^hamburgarbröd$|^hamburgerbröd$/i, replacement: 'hamburgerbröd' },
    { regex: /^korv(?:ar)?$/i, replacement: 'korv' },
    { regex: /^ägg$/i, replacement: 'ägg' },
  ];

  for (const item of STEM_MAP) {
    if (item.regex.test(clean)) {
      return item.replacement;
    }
  }

  return clean;
}

const AISLE_OVERRIDES_STORAGE_KEY = 'receptapp_aisle_overrides_v1';

export function loadAisleOverrides(): Record<string, string> {
  try {
    const saved = localStorage.getItem(AISLE_OVERRIDES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

/** The aisle the user has picked for this ingredient, if any. */
export function getAisleOverride(name: string): string | undefined {
  return loadAisleOverrides()[normalizeIngredientNameForMatching(name)];
}

export function setAisleOverride(name: string, aisle: string): void {
  try {
    const overrides = loadAisleOverrides();
    overrides[normalizeIngredientNameForMatching(name)] = aisle;
    localStorage.setItem(AISLE_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.error('Save aisle override error', e);
  }
}

/** Merges choices from other household members into the saved ones. */
export function mergeAisleOverrides(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(AISLE_OVERRIDES_STORAGE_KEY, JSON.stringify({ ...loadAisleOverrides(), ...overrides }));
  } catch (e) {
    console.error('Merge aisle overrides error', e);
  }
}

export function clearAisleOverrides(): void {
  try {
    localStorage.removeItem(AISLE_OVERRIDES_STORAGE_KEY);
  } catch (e) {
    console.error('Clear aisle overrides error', e);
  }
}

// Units that can be counted into each other: volume in millilitres, weight in grams
const VOLUME_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, krm: 1, tsk: 5, msk: 15 };
const WEIGHT_G: Record<string, number> = { g: 1, hg: 100, kg: 1000 };

function cleanUnitOf(unit?: string): string {
  const u = normalizeUnit(unit || '').toLowerCase().trim().replace(/\.$/, '');
  return !u || u === 'styck' || u === 'stycken' ? 'st' : u;
}

/** "volym", "vikt" or the unit itself: what amounts can be added up within */
function unitGroup(unit: string): string {
  if (unit in VOLUME_ML) return 'volym';
  if (unit in WEIGHT_G) return 'vikt';
  return unit;
}

/** "Vitlöksklyftor" counted in st are the same thing as "vitlök" counted in klyftor */
function canonical(name: string, unit: string): { name: string; unit: string } {
  if (/^vitlöksklyft/.test(name) && (unit === 'st' || unit === 'klyfta')) return { name: 'vitlök', unit: 'klyfta' };
  return { name, unit };
}

export function normalizeIngredientKey(name: string, unit?: string): string {
  const c = canonical(normalizeIngredientNameForMatching(name), cleanUnitOf(unit));
  // 5 dl and 1 l of the same thing are one row, as are 500 g and 1 kg
  return `${c.name}___${unitGroup(c.unit)}`;
}

/**
 * Adds two amounts of the same thing, also in different units of the same kind: 5 dl + 1 l is
 * 1,5 l, 500 g + 1 kg is 1,5 kg. The sum is given in the larger of the two units.
 */
export function addShoppingAmounts(
  a: { amount: number | null; unit: string },
  b: { amount: number | null; unit: string }
): { amount: number | null; unit: string } {
  if (b.amount === null) return a;
  if (a.amount === null) return b;
  const ua = cleanUnitOf(a.unit);
  const ub = cleanUnitOf(b.unit);
  const round = (n: number) => Math.round(n * 100) / 100;
  for (const table of [VOLUME_ML, WEIGHT_G]) {
    if (ua in table && ub in table && ua !== ub) {
      const total = a.amount * table[ua] + b.amount * table[ub];
      const unit = table[ua] >= table[ub] ? a.unit : b.unit;
      return { amount: round(total / table[cleanUnitOf(unit)]), unit };
    }
  }
  return { amount: round(a.amount + b.amount), unit: a.unit };
}

export interface GenerateShoppingListOptions {
  skipPantryStaples?: boolean;
}

export interface RawIngredientInput {
  id?: string;
  name: string;
  amount: number | null;
  unit: string;
  aisle?: string;
  isPantryStaple?: boolean;
  checked?: boolean;
  recipeTitle?: string;
  recipeSource?: string;
  mergedSources?: string[];
  comment?: string;
}

export interface MergeShoppingListResult {
  mergedList: ShoppingItem[];
  removedDuplicateIds: string[];
}

export function normalizeRecipeSource(source?: string | null): string | undefined {
  if (!source) return undefined;
  const parts = source.split(/\s*\+\s*/);
  const normalizedParts = parts
    .map((part) => {
      const trimmed = part.trim();
      if (/^alltid\s*(ha\s*)?hemma$/i.test(trimmed) || /^hemmet$/i.test(trimmed)) {
        return 'Hemmet';
      }
      return trimmed;
    })
    .filter(Boolean);

  const unique = Array.from(new Set(normalizedParts));
  return unique.length > 0 ? unique.join(' + ') : undefined;
}

export function normalizeSourcesList(sources?: (string | undefined | null)[] | null): string[] {
  if (!sources || sources.length === 0) return [];
  const normalized = sources.flatMap((s) => {
    if (!s) return [];
    const parts = s.split(/\s*\+\s*/);
    return parts
      .map((part) => {
        const trimmed = part.trim();
        if (/^alltid\s*(ha\s*)?hemma$/i.test(trimmed) || /^hemmet$/i.test(trimmed)) {
          return 'Hemmet';
        }
        return trimmed;
      })
      .filter(Boolean);
  });
  return Array.from(new Set(normalized));
}

/**
 * Merges new ingredients into an existing shopping list.
 * Crucially:
 * 1. Preserves original item IDs and checked state for existing items.
 * 2. If a new ingredient matches an existing item, amount is summed and recipe source is added,
 *    keeping the existing item ID.
 * 3. Only genuinely new items receive a new generated ID.
 * 4. Merges any preexisting duplicates from previous sessions and reports their IDs for cleanup.
 */
export function mergeIngredientsIntoShoppingList(
  currentList: ShoppingItem[],
  newItems: RawIngredientInput[]
): MergeShoppingListResult {
  const result: ShoppingItem[] = [];
  const keyMap = new Map<string, ShoppingItem>();
  const removedDuplicateIds: string[] = [];

  // 1. Seed with existing items, preserving their original IDs and state
  for (const item of currentList) {
    if (!item.name || !item.name.trim()) continue;
    const key = normalizeIngredientKey(item.name, item.unit);

    if (!keyMap.has(key)) {
      const rawSources = item.mergedSources || (item.recipeSource ? [item.recipeSource] : []);
      const normalizedSources = normalizeSourcesList(rawSources);
      const cloned: ShoppingItem = {
        ...item,
        aisle: (!item.aisle || item.aisle === 'Övrigt') ? detectAisle(item.name) : item.aisle,
        comment: item.comment,
        recipeSource: normalizeRecipeSource(item.recipeSource) || (normalizedSources.length > 0 ? normalizedSources.join(' + ') : undefined),
        mergedSources: normalizedSources,
      };
      keyMap.set(key, cloned);
      result.push(cloned);
    } else {
      // Preexisting duplicate item in currentList: merge into the first occurrence
      const existing = keyMap.get(key)!;
      const sum = addShoppingAmounts(existing, item);
      existing.amount = sum.amount;
      existing.unit = sum.unit;

      if (item.recipeSource || (item.mergedSources && item.mergedSources.length > 0)) {
        const itemSources = item.mergedSources || (item.recipeSource ? [item.recipeSource] : []);
        const combined = normalizeSourcesList([
          ...(existing.mergedSources || []),
          ...itemSources,
        ]);
        existing.mergedSources = combined;
        existing.recipeSource = combined.join(' + ');
      }

      if (!existing.comment && item.comment) {
        existing.comment = item.comment;
      }

      if (item.id && item.id !== existing.id) {
        removedDuplicateIds.push(item.id);
      }
    }
  }

  // 2. Merge incoming new items
  for (const item of newItems) {
    if (!item.name || !item.name.trim()) continue;

    const key = normalizeIngredientKey(item.name, item.unit);
    const sourceTitle = item.recipeTitle || item.recipeSource;

    if (!item.checked && keyMap.has(key) && keyMap.get(key)!.checked) {
      // Already bought: the item is needed again, so it starts over with the new amount
      // instead of adding to what was bought.
      const existing = keyMap.get(key)!;
      const newSources = normalizeSourcesList(item.mergedSources || (sourceTitle ? [sourceTitle] : []));
      existing.amount = item.amount;
      if (item.unit) existing.unit = item.unit;
      existing.mergedSources = newSources;
      existing.recipeSource = newSources.length > 0 ? newSources.join(' + ') : undefined;
      existing.comment = item.comment || undefined;
      existing.checked = false;
      if (item.isPantryStaple) existing.isPantryStaple = true;
      continue;
    }

    if (keyMap.has(key)) {
      const existing = keyMap.get(key)!;

      // Sum amounts if both have values, also across units of the same kind (dl and l, g and kg)
      const sum = addShoppingAmounts(existing, item);
      existing.amount = sum.amount;
      existing.unit = sum.unit;

      // Merge recipe sources
      const existingSources = existing.mergedSources || (existing.recipeSource ? [existing.recipeSource] : []);
      const newSources = item.mergedSources || (sourceTitle ? [sourceTitle] : []);
      const sourceArr = normalizeSourcesList([...existingSources, ...newSources]);
      existing.mergedSources = sourceArr;
      if (sourceArr.length > 0) {
        existing.recipeSource = sourceArr.join(' + ');
      }

      // Update or preserve comment
      if (item.comment) {
        existing.comment = existing.comment ? `${existing.comment}, ${item.comment}` : item.comment;
      }

      // If new ingredients from a recipe are added to an existing item, uncheck it so it's bought
      if (sourceTitle || (item.amount !== null && item.amount > 0)) {
        existing.checked = false;
      }

      // Upgrade aisle if existing was generic Övrigt
      if ((!existing.aisle || existing.aisle === 'Övrigt') && item.aisle && item.aisle !== 'Övrigt') {
        existing.aisle = item.aisle;
      } else if (!existing.aisle || existing.aisle === 'Övrigt') {
        existing.aisle = detectAisle(existing.name);
      }

      if (item.isPantryStaple) {
        existing.isPantryStaple = true;
      }
      // CRUCIAL: existing.id is PRESERVED!
    } else {
      // Completely new item
      const normalizedSource = normalizeRecipeSource(sourceTitle);
      const normalizedMerged = normalizeSourcesList(item.mergedSources || (normalizedSource ? [normalizedSource] : []));
      const newItem: ShoppingItem = {
        id: item.id || `shop-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        name: item.name.trim(),
        amount: item.amount,
        unit: item.unit || '',
        aisle: getAisleOverride(item.name) ?? ((item.aisle && item.aisle !== 'Övrigt') ? item.aisle : detectAisle(item.name)),
        isPantryStaple: Boolean(item.isPantryStaple),
        checked: Boolean(item.checked),
        recipeSource: normalizedSource || (normalizedMerged.length > 0 ? normalizedMerged.join(' + ') : undefined),
        mergedSources: normalizedMerged,
        comment: item.comment,
      };
      keyMap.set(key, newItem);
      result.push(newItem);
    }
  }

  return {
    mergedList: result,
    removedDuplicateIds,
  };
}

/**
 * Consolidate a list of ingredients, summing amounts with the same unit
 * (e.g. 2 st lök + 1 st lök = 3 st lök)
 */
export function consolidateIngredients(rawItems: RawIngredientInput[]): ShoppingItem[] {
  return mergeIngredientsIntoShoppingList([], rawItems).mergedList;
}

/**
 * Generate full consolidated shopping list from weekly meal plan
 */
export function generateShoppingListFromMealPlan(
  mealPlan: MealPlanDay[],
  recipes: Recipe[],
  options: GenerateShoppingListOptions = {}
): { items: ShoppingItem[]; count: number; plannedMealCount: number } {
  const rawItemsToConsolidate: Array<{
    name: string;
    amount: number | null;
    unit: string;
    aisle: string;
    isPantryStaple: boolean;
    recipeTitle?: string;
  }> = [];

  let plannedMealCount = 0;

  const recipeMap = new Map<string, Recipe>();
  recipes.forEach((r) => recipeMap.set(r.id, r));

  for (const day of mealPlan) {
    if (day.dinnerRecipeId && recipeMap.has(day.dinnerRecipeId)) {
      const rec = recipeMap.get(day.dinnerRecipeId)!;
      const plannedServings = day.dinnerServings || rec.servings || 4;
      plannedMealCount++;

      for (const ing of rec.ingredients) {
        if (options.skipPantryStaples && ing.isPantryStaple) {
          continue;
        }
        const scaledAmt = scaleIngredientAmount(ing.amount, rec.servings, plannedServings);
        rawItemsToConsolidate.push({
          name: ing.name,
          amount: scaledAmt,
          unit: ing.unit,
          aisle: ing.aisle,
          isPantryStaple: ing.isPantryStaple,
          recipeTitle: `${rec.title} (${day.dayName}, ${plannedServings}p)`,
        });
      }
    }

    if (day.lunchRecipeId && recipeMap.has(day.lunchRecipeId)) {
      const rec = recipeMap.get(day.lunchRecipeId)!;
      const plannedServings = day.lunchServings || rec.servings || 2;
      plannedMealCount++;

      for (const ing of rec.ingredients) {
        if (options.skipPantryStaples && ing.isPantryStaple) {
          continue;
        }
        const scaledAmt = scaleIngredientAmount(ing.amount, rec.servings, plannedServings);
        rawItemsToConsolidate.push({
          name: ing.name,
          amount: scaledAmt,
          unit: ing.unit,
          aisle: ing.aisle,
          isPantryStaple: ing.isPantryStaple,
          recipeTitle: `${rec.title} (${day.dayName} Lunch, ${plannedServings}p)`,
        });
      }
    }
  }

  const items = consolidateIngredients(rawItemsToConsolidate);
  return {
    items,
    count: items.length,
    plannedMealCount,
  };
}
