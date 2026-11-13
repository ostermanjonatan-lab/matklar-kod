/**
 * Checks the search on the start screen (parseSearch, matchesSearch) with OCH, ELLER, AND, OR
 * and brackets against a few small recipes.
 * Run: npx tsx scripts/check-recipe-search.ts
 */
import { matchesSearch, parseSearch } from '../src/utils/recipeSearch';

// Name and ingredients of each recipe, in small letters as the search compares them
const RECIPES: Record<string, string[]> = {
  curry: ['krämig kycklingcurry', 'kyckling', 'kokosmjölk', 'ris'],
  pasta: ['kycklingpasta med spenat', 'kyckling', 'spenat', 'pasta'],
  lax: ['ugnsbakad lax', 'lax', 'citron', 'dill'],
  torsk: ['torskrygg', 'torsk', 'smör', 'citron'],
  daal: ['linsgryta', 'linser', 'kokosmjölk', 'spenat'],
};

const CASES: [string, string[]][] = [
  ['kyckling', ['curry', 'pasta']],
  ['kyckling kokosmjölk', ['curry']],
  ['kyckling OCH spenat', ['pasta']],
  ['kyckling AND spenat', ['pasta']],
  ['kyckling, kokosmjölk', ['curry']],
  ['kyckling med spenat', ['pasta']],
  ['lax ELLER torsk', ['lax', 'torsk']],
  ['lax OR torsk', ['lax', 'torsk']],
  ['lax eller torsk', ['lax', 'torsk']],
  // OCH binds harder than ELLER
  ['kyckling och spenat eller lax', ['pasta', 'lax']],
  ['(kyckling eller lax) och citron', ['lax']],
  ['(lax|torsk)&citron', ['lax', 'torsk']],
  ['kokosmjölk OCH (kyckling ELLER spenat)', ['curry', 'daal']],
  // Half written while typing
  ['lax eller', ['lax']],
  ['(kyckling', ['curry', 'pasta']],
  ['eller', Object.keys(RECIPES)],
];

let failed = 0;
for (const [query, expected] of CASES) {
  const node = parseSearch(query);
  const found = Object.keys(RECIPES).filter((k) => !node || matchesSearch(node, RECIPES[k]));
  const ok = JSON.stringify(found) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'ok   ' : 'FEL  '}${query.padEnd(42)}${found.join(', ')}${ok ? '' : `   (väntat: ${expected.join(', ')})`}`);
}
console.log(failed ? `\n${failed} sökningar gav fel resultat.` : '\nAlla sökningar gav väntat resultat.');
if (failed) process.exit(1);
