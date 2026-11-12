import type { RecipeCategory } from '../types/recipe';

export const STANDARD_CATEGORIES: RecipeCategory[] = [
  'Middag',
  'Förrätt',
  'Efterrätt',
  'Såser',
  'Dryck',
  'Frukost',
  'Mellanmål',
];

export const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  Middag: [
    'Pasta',
    'Ris',
    'Potatis',
    'Kyckling',
    'Nöt',
    'Fläsk',
    'Lamm',
    'Vilt',
    'Färs',
    'Fisk',
    'Skaldjur',
    'Asiatiskt',
    'Tacos & Texmex',
    'Medelhav & Mellanöstern',
    'Pizza',
    'Paj',
    'Wraps & Bröd',
    'Bowls',
    'Grill',
    'Grytor',
    'Soppor',
    'Ugn & Gratäng',
    'Husmanskost',
    'Sallader',
    'Burgare',
  ],
  Förrätt: [
    'Smårätter & Tapas',
    'Toast & Bruschetta',
    'Fisk',
    'Skaldjur',
    'Soppor',
    'Sallader',
    'Plockmat & Tilltugg',
  ],
  Efterrätt: [
    'Bakverk & Kakor',
    'Pajer & Tårtor',
    'Glass & Sorbet',
    'Pannkakor & Våfflor',
    'Choklad & Godis',
    'Dessert i glas',
  ],
  Såser: [
    'Kalla såser',
    'Varma såser',
    'Béarnaise & Hollandaise',
    'Dipp & Röror',
    'Dressing & Vinägrett',
    'Pesto & Örtsås',
    'Salsa & Chutney',
    'Marinader & Rubs',
    'Söta såser',
  ],
  Dryck: [
    'Smoothies & Bowls',
    'Drinkar & Cocktails',
    'Alkoholfritt',
    'Kaffe & Te',
    'Saft & Lemonad',
    'Måltidsdryck',
  ],
  Frukost: [
    'Gröt & Müsli',
    'Ägg & Omelett',
    'Smörgåsar & Mackor',
    'Bröd',
    'Yoghurt & Fil',
    'Pannkakor & Våfflor',
    'Smoothies & Bowls',
  ],
  Mellanmål: [
    'Snacks',
    'Bars & Bollar',
    'Smoothies & Bowls',
    'Bär & Frukt',
  ],
};

/**
 * Subcategories that have been renamed or merged, by their old name. Recipes saved with the old
 * name are shown with the new one.
 */
export const RENAMED_SUBCATEGORIES: Record<string, string> = {
  Kladdkaka: 'Bakverk & Kakor',
  Sallad: 'Sallader',
  Smoothies: 'Smoothies & Bowls',
  'Mellanmål & Snacks': 'Snacks',
  'Mocktails (Alkoholfritt)': 'Alkoholfritt',
};

/**
 * Standard special diet and allergy subcategories available across all categories.
 */
export const DIETARY_SUBCATEGORIES: string[] = [
  'Glutenfri',
  'Laktosfri',
  'Mjölkfri',
  'Vegetariskt',
  'Veganskt',
  'Sockerfri',
  'Nötfri',
  'Proteinrikt',
  'Barnvänligt',
];

/**
 * Returns a flat, sorted unique list of all standard subcategories across all categories,
 * including dietary subcategories.
 */
export function getAllStandardSubcategories(): string[] {
  const set = new Set<string>();
  Object.values(DEFAULT_SUBCATEGORIES).forEach((list) => {
    list.forEach((subcat) => set.add(subcat));
  });
  DIETARY_SUBCATEGORIES.forEach((subcat) => set.add(subcat));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'sv', { sensitivity: 'base' }));
}


/**
 * The name shown for a category. "Middag" is kept as the stored value (in saved recipes and
 * Supabase), but is shown as "Varmrätt", since those dishes are eaten for lunch too.
 */
export function categoryLabel(category: string | null | undefined): string {
  if (!category) return '';
  return category === 'Middag' ? 'Varmrätt' : category;
}
