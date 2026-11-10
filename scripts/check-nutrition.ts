/**
 * How close the app's nutrition is when worked out from the ingredients: compared with recipes
 * whose web page gives the values (scripts/nutrition-cases.ts).
 * Run: npx tsx scripts/check-nutrition.ts   (add -v for each recipe)
 * Prints how far off energy, carbohydrates, protein, fat and fiber per portion are, as the median
 * and the share within 15 %. Fails if the median for energy gets worse than the limit below.
 */
import { NUTRITION_CASES } from './nutrition-cases';
import { parseIngredientLine, splitCombinedIngredientLine } from '../src/utils/ingredientParser';
import { calculateNutrition, type NutritionValues } from '../src/utils/nutrition';

const LIMIT_KCAL_MEDIAN = 6; // per cent (2 % in November 2026)
const verbose = process.argv.includes('-v');
const keys: (keyof NutritionValues)[] = ['kcal', 'carbs', 'protein', 'fat', 'fiber'];
const errors: Record<string, number[]> = Object.fromEntries(keys.map((k) => [k, []]));

for (const c of NUTRITION_CASES) {
  const ingredients = c.ingredients.flatMap(splitCombinedIngredientLine).map(parseIngredientLine).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const calc = calculateNutrition(ingredients);
  const row: string[] = [];
  for (const k of keys) {
    const want = c.perPortion[k as keyof typeof c.perPortion];
    if (want === undefined) continue;
    const got = calc.total[k] / c.portions;
    // Small amounts (a few grams of fiber) are compared in grams rather than per cent
    const err = want >= 5 ? (Math.abs(got - want) / want) * 100 : Math.abs(got - want) * 10;
    errors[k].push(err);
    row.push(`${k} ${Math.round(got)}/${Math.round(want)}`);
  }
  if (verbose) {
    console.log(`${c.name.padEnd(40).slice(0, 40)} ${row.join('  ')}`);
    if (calc.missing.length) console.log(`   inte med: ${calc.missing.join(', ')}`);
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const names: Record<string, string> = { kcal: 'Energi', carbs: 'Kolhydrater', protein: 'Protein', fat: 'Fett', fiber: 'Fiber' };
console.log(`\n${NUTRITION_CASES.length} recept, avvikelse per portion mot webbsidan:`);
for (const k of keys) {
  const e = errors[k];
  const within = e.filter((x) => x <= 15).length;
  console.log(`  ${names[k].padEnd(12)} median ${Math.round(median(e))} %, inom 15 %: ${within} av ${e.length}`);
}
const kcalMedian = median(errors.kcal);
if (kcalMedian > LIMIT_KCAL_MEDIAN) {
  console.log(`\nEnergin avviker mer än ${LIMIT_KCAL_MEDIAN} % i mitten av recepten.`);
  process.exit(1);
}
console.log('\nNäringsvärdena ligger inom gränsen.');
