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
    'Kött & Färs',
    'Fisk',
    'Skaldjur',
    'Asiatiskt',
    'Tacos & Texmex',
    'Grytor',
    'Soppor',
    'Ugn & Gratäng',
    'Husmanskost',
    'Sallad',
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
    'Kladdkaka',
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
    'Söta såser',
  ],
  Dryck: [
    'Smoothies & Bowls',
    'Drinkar & Cocktails',
    'Mocktails (Alkoholfritt)',
    'Kaffe & Te',
    'Saft & Lemonad',
    'Måltidsdryck',
  ],
  Frukost: [
    'Gröt & Müsli',
    'Ägg & Omelett',
    'Smörgåsar & Mackor',
    'Pannkakor & Våfflor',
    'Smoothies',
  ],
  Mellanmål: [
    'Mellanmål & Snacks',
    'Bars & Bollar',
    'Smoothies',
    'Bär & Frukt',
  ],
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

