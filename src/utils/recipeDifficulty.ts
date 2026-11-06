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
  3: 'Svår',
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
