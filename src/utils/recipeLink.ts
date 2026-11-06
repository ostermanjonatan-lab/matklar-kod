import type { Recipe, Ingredient, Instruction, RecipeCategory, RecipeDifficulty } from '../types/recipe';

/**
 * A recipe sent as a link to someone outside the household. The whole recipe is packed into
 * the part of the address after #, so nothing is stored on a server and the link works
 * without a household. Example: https://matklar.vercel.app/#recept=1eJy…
 *
 * The first character tells how the rest is packed: "1" compressed, "0" not compressed
 * (for browsers without CompressionStream).
 */

const HASH_KEY = 'recept';

/** What travels in the link. Household data (id, favourite, notes) stays at home. */
interface SharedRecipe {
  v: 1;
  title: string;
  category?: RecipeCategory;
  subcategories?: string[];
  servings?: number;
  cookTimeMinutes?: number;
  difficulty?: RecipeDifficulty;
  coverImageUrl?: string;
  sourceUrl?: string;
  /** [name, amount, unit] */
  ingredients: [string, number | null, string][];
  steps: string[];
}

/** The part of a recipe that a shared link carries. */
export type RecipeFromLink = Pick<
  Recipe,
  'title' | 'category' | 'servings' | 'ingredients' | 'instructions'
> & {
  subcategories: string[];
  cookTimeMinutes?: number;
  difficulty?: RecipeDifficulty;
  coverImageUrl?: string;
  sourceUrl?: string;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** The address that opens the recipe in MatKlar. */
export async function createRecipeLink(recipe: Recipe): Promise<string> {
  const isWebAddress = (url?: string) => Boolean(url && /^https?:\/\//.test(url));
  const data: SharedRecipe = {
    v: 1,
    title: recipe.title,
    category: recipe.category,
    subcategories: recipe.subcategories && recipe.subcategories.length > 0 ? recipe.subcategories : undefined,
    servings: recipe.servings,
    cookTimeMinutes: Number(recipe.cookTimeMinutes) > 0 ? Number(recipe.cookTimeMinutes) : undefined,
    difficulty: recipe.difficulty,
    // Uploaded photos are public web addresses. Pictures kept inside the app are too big for a link.
    coverImageUrl: isWebAddress(recipe.coverImageUrl) ? recipe.coverImageUrl : undefined,
    sourceUrl: isWebAddress(recipe.sourceUrl) ? recipe.sourceUrl : undefined,
    ingredients: recipe.ingredients.map((i) => [i.name, i.amount, i.unit || '']),
    steps: recipe.instructions.map((s) => s.text),
  };
  const json = new TextEncoder().encode(JSON.stringify(data));
  const packed = canCompress()
    ? '1' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))
    : '0' + toBase64Url(json);
  return `${window.location.origin}/#${HASH_KEY}=${packed}`;
}

/** True when the text is (or contains) a MatKlar recipe link. */
export function isRecipeLink(text: string): boolean {
  return new RegExp(`#${HASH_KEY}=[01][A-Za-z0-9_-]+`).test(text);
}

/** Reads a recipe from a MatKlar link, or from just the part after #. Null if it cannot be read. */
export async function readRecipeLink(text: string): Promise<RecipeFromLink | null> {
  const match = text.match(new RegExp(`${HASH_KEY}=([01])([A-Za-z0-9_-]+)`));
  if (!match) return null;
  try {
    let bytes = fromBase64Url(match[2]);
    if (match[1] === '1') {
      if (!canCompress()) return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    const data = JSON.parse(new TextDecoder().decode(bytes)) as SharedRecipe;
    if (!data || typeof data.title !== 'string' || !Array.isArray(data.ingredients) || !Array.isArray(data.steps)) {
      return null;
    }
    const ingredients: Ingredient[] = data.ingredients
      .filter((row) => Array.isArray(row) && typeof row[0] === 'string')
      .map(([name, amount, unit]) => ({
        name,
        amount: typeof amount === 'number' ? amount : null,
        unit: typeof unit === 'string' ? unit : '',
        // Set again from the name when the recipe is saved
        aisle: '',
        isPantryStaple: false,
      }));
    const instructions: Instruction[] = data.steps
      .filter((t) => typeof t === 'string' && t.trim())
      .map((text, i) => ({ stepNumber: i + 1, text }));
    return {
      title: data.title.trim() || 'Recept',
      category: data.category || 'Middag',
      subcategories: Array.isArray(data.subcategories) ? data.subcategories.filter((s) => typeof s === 'string') : [],
      servings: Number(data.servings) > 0 ? Number(data.servings) : 4,
      cookTimeMinutes: Number(data.cookTimeMinutes) > 0 ? Number(data.cookTimeMinutes) : undefined,
      difficulty: data.difficulty,
      coverImageUrl: data.coverImageUrl,
      sourceUrl: data.sourceUrl,
      ingredients,
      instructions,
    };
  } catch {
    return null;
  }
}

/**
 * The recipe link the app was opened with, read once when the app starts. It is taken out of
 * the address right away, so the rest of the app (which also uses # for tabs) never sees it.
 */
export const openedRecipeLink: string | null = (() => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!isRecipeLink(hash)) return null;
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // Leave the address as it is
  }
  return hash;
})();
