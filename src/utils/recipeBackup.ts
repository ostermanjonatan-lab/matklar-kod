import type { Recipe } from '../types/recipe';
import { toISODate } from './mealPlanDates';

/**
 * Backup of the recipes as a file. The file holds all recipes and the household's own
 * subcategories. Reading it back adds the recipes that are not already in the app.
 */

interface BackupFile {
  app: 'matklar';
  kind: 'recept';
  version: 1;
  savedAt: string;
  recipes: Recipe[];
  customSubcategories?: string[];
}

/** Saves the recipes to a JSON file named like matklar-recept-2026-11-06.json. */
export function downloadRecipeBackup(recipes: Recipe[], customSubcategories: string[]): string {
  const data: BackupFile = {
    app: 'matklar',
    kind: 'recept',
    version: 1,
    savedAt: new Date().toISOString(),
    recipes,
    customSubcategories,
  };
  const fileName = `matklar-recept-${toISODate(new Date())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

export interface ReadBackupResult {
  recipes: Recipe[];
  customSubcategories: string[];
}

/** Reads a backup file. Also accepts a plain list of recipes. Throws with a Swedish message if the file is not a backup. */
export async function readRecipeBackup(file: File): Promise<ReadBackupResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Filen gick inte att läsa. Välj en fil som MatKlar har sparat.');
  }
  const list: unknown = Array.isArray(parsed) ? parsed : (parsed as BackupFile)?.recipes;
  if (!Array.isArray(list)) {
    throw new Error('Filen innehåller inga recept.');
  }
  const recipes = list.filter(
    (r): r is Recipe =>
      Boolean(r) && typeof (r as Recipe).title === 'string' && (r as Recipe).title.trim() !== '' && Array.isArray((r as Recipe).ingredients)
  );
  if (recipes.length === 0) {
    throw new Error('Filen innehåller inga recept.');
  }
  const subs = Array.isArray(parsed) ? [] : (parsed as BackupFile).customSubcategories;
  return {
    recipes,
    customSubcategories: Array.isArray(subs) ? subs.filter((s): s is string => typeof s === 'string') : [],
  };
}
