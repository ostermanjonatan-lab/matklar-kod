/**
 * How many portions a recipe is shown and bought for at first, when it is opened or put in the
 * shopping list from its card. 4 unless changed under Inställningar. Kept on this phone.
 */
const KEY = 'matklar_default_servings';
export const DEFAULT_SERVINGS = 4;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 100;

export function getDefaultServings(): number {
  try {
    const n = parseInt(localStorage.getItem(KEY) || '', 10);
    return n >= MIN_SERVINGS && n <= MAX_SERVINGS ? n : DEFAULT_SERVINGS;
  } catch {
    return DEFAULT_SERVINGS;
  }
}

export function setDefaultServings(n: number): void {
  try {
    if (n === DEFAULT_SERVINGS) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(n)))));
  } catch {
    // Without storage the choice lasts until the app is closed
  }
}
