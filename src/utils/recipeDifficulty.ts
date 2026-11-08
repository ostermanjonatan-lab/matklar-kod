import type { RecipeDifficulty } from '../types/recipe';

/**
 * Difficulty of a recipe, in three steps.
 *
 * In Supabase it is kept as a hidden tag in the recipe's existing `tags` column
 * ("svarighet:1" to "svarighet:3"), so the table needs no new column. The tag is
 * taken out when a recipe is read and put back when it is saved, so it never shows
 * among the recipe's own tags.
 */

export const DIFFICULTY_LABELS: Record<RecipeDifficulty, string> = {
  1: 'Lätt',
  2: 'Medel',
  3: 'Avancerad',
};

export const DIFFICULTY_LEVELS: RecipeDifficulty[] = [1, 2, 3];

const TAG_PREFIX = 'svarighet:';

export function isRecipeDifficulty(value: unknown): value is RecipeDifficulty {
  return value === 1 || value === 2 || value === 3;
}

/** Reads the difficulty tag and returns the other tags without it. */
export function splitDifficultyTag(tags: unknown): { difficulty?: RecipeDifficulty; tags: string[] } {
  const list = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
  let difficulty: RecipeDifficulty | undefined;
  const rest = list.filter((t) => {
    if (!t.startsWith(TAG_PREFIX)) return true;
    const n = Number(t.slice(TAG_PREFIX.length));
    if (isRecipeDifficulty(n)) difficulty = n;
    return false;
  });
  return { difficulty, tags: rest };
}

/** The tags to save: the recipe's own tags plus the difficulty tag, if any. */
export function withDifficultyTag(tags: string[] | undefined, difficulty: RecipeDifficulty | undefined): string[] {
  const rest = splitDifficultyTag(tags).tags;
  return isRecipeDifficulty(difficulty) ? [...rest, `${TAG_PREFIX}${difficulty}`] : rest;
}

/** What the estimate looks at. A Recipe fits, and so does a freshly read recipe. */
export interface DifficultyInput {
  title?: string;
  ingredients?: { name?: string; isPantryStaple?: boolean }[];
  instructions?: ({ text?: string } | string)[];
  cookTimeMinutes?: number;
  prepTimeMinutes?: number;
  cookingTimeMinutes?: number;
}

const READY_MADE =
  /färdig|fryst|frysta|djupfryst|ugnsklar|halvfabrikat|pulver|påse|burk(en)?\b|förkokt|färdiglagad|mikro|frityrklar|pizzadeg|färdig deg|wraps|tortillabröd|tacokrydda|taco ?sås|pastasås på burk/;
/** Work from scratch that takes skill or time. Read in the title and the steps only: a bought
 *  sourdough bread or brioche bun among the ingredients says nothing about the cooking. */
const ADVANCED =
  /pastadeg|egen pasta|hemgjord pasta|gör pastan|kavla ut degen|kavla degen|pastamaskin|surdegsgrund|mata surdegen|låt degen jäsa|degen jäsa|jäsa över natten|smördeg från grunden|laminera|fond från grunden|koka (en )?fond|sous ?vide|confit|flambera|temperera chokladen|wellington|macaron|consommé|klarifiera|marinera i \d+ timmar|marinera över natten|nixtamal|lägg i lag|rökt?a? själv/;

/**
 * A first guess at the difficulty, from the number of ingredients and steps, the time, and
 * words that point either way. Lätt: a few ingredients, or ready-made food into the oven.
 * Avancerad: dough or stock from scratch, long processes, or very many ingredients.
 * Everything else is Medel. Staples like salt, pepper and oil are not counted.
 */
export function estimateDifficulty(recipe: DifficultyInput): RecipeDifficulty {
  const ingredients = (recipe.ingredients || []).filter((i) => (i?.name || '').trim());
  const counted = ingredients.filter((i) => !i.isPantryStaple).length;
  const steps = (recipe.instructions || [])
    .map((s) => (typeof s === 'string' ? s : s?.text || ''))
    .filter((t) => t.trim());
  const minutes = recipe.cookingTimeMinutes || recipe.cookTimeMinutes || recipe.prepTimeMinutes || 0;
  const text = [recipe.title || '', ...steps].join(' ').toLowerCase();
  const stepWords = steps.join(' ').split(/\s+/).filter(Boolean).length;

  if (ADVANCED.test(text)) return 3;
  if (counted >= 15 || steps.length >= 11 || stepWords >= 450) return 3;
  if (minutes >= 180 && counted >= 10) return 3;

  const readyMade = ingredients.filter((i) => READY_MADE.test((i.name || '').toLowerCase())).length;
  if (counted <= 4) return 1;
  if (readyMade >= 1 && counted <= 7 && steps.length <= 4) return 1;
  if (counted <= 6 && steps.length <= 3 && (minutes === 0 || minutes <= 25)) return 1;

  return 2;
}
