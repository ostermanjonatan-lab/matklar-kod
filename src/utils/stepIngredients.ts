import type { Ingredient } from '../types/recipe';

/**
 * Finds which ingredients a recipe step mentions, so their amounts can be shown
 * under the step. Matching is by word stems, e.g. "Färska äggulor" matches
 * "äggulorna" and "Gul lök" matches "löken".
 */

// Letters a word is made of, also in borrowed words like "jalapeños" and "crème"
const LETTER = 'a-zåäöéèêëüæøñçáàâíìîïóòôúùûœ';

// Parts of compound names that the step text usually leaves out,
// e.g. "kycklingfilé" is called "kycklingen" and "vitlöksklyftor" "vitlöken".
const COMPOUND_TAILS = [
  'lårfiléer', 'lårfilé', 'filéer', 'filé', 'bröst', 'klubbor', 'vingar', 'lår', 'klyftor', 'klyfta', 'skivor', 'skiva',
  'bitar', 'tärningar', 'kuber', 'blad', 'kvistar', 'stjälkar', 'stänger', 'flakes', 'ost', 'rygg', 'nöt', 'huvuden', 'huvud',
];

// Ingredients the steps usually call by a shorter word, e.g. "spaghetti" is "pastan"
// and "kantareller" is "svampen".
const GENERIC_NAMES: [RegExp, string][] = [
  [/spaghetti|spagetti|rigatoni|penne|fusilli|tagliatelle|pappardelle|linguine|farfalle|makaroner|pasta/, 'pasta'],
  [/guanciale|pancetta|bacon|sidfläsk/, 'fläsk'],
  [/parmesan|pecorino|västerbotten|cheddar|mozzarella|gruyère|gruyere|grana padano|prästost|herrgård|halloumi|feta/, 'ost'],
  [/kantarell|champinjon|karljohan|shiitake|ostronskivling/, 'svamp'],
  [/(^|\s)(strö|rör|rå|fin)?socker\b/, 'socker'],
  [/fond\b|buljong/, 'fond'],
  [/fond\b|buljong/, 'buljong'],
];

// When a compound name ends in one of these, the step often uses only that part,
// e.g. "basmatiris" -> "riset", "babyspenat" -> "spenaten", "vispgrädde" -> "grädden".
const BASE_NOUNS = [
  'ris', 'lök', 'fläsk', 'färs', 'ost', 'bröd', 'grädde', 'mjölk', 'potatis', 'peppar', 'salt',
  'olja', 'spenat', 'tomater', 'tomat', 'sallad', 'bönor', 'kål', 'svamp', 'chili', 'senap',
  'gurka', 'vinäger', 'sylt', 'kex',
];

// Words in ingredient names that describe rather than name the ingredient.
const SKIP_WORDS = new Set([
  'färsk', 'färska', 'färskt', 'riven', 'rivet', 'rivna', 'hackad', 'hackade', 'hackat',
  'skivad', 'skivade', 'tärnad', 'tärnade', 'kokt', 'kokta', 'kokande', 'kallt', 'kall', 'kalla',
  'varmt', 'varm', 'ljummet', 'rumsvarmt', 'rumsvarma', 'smält', 'smälta', 'pressad', 'pressade',
  'finhackad', 'finhackade', 'grovhackad', 'grovhackade', 'krossade', 'krossad', 'malen', 'mald',
  'liten', 'litet', 'små', 'stor', 'stora', 'stort', 'mellanstor', 'mellanstora', 'gul', 'gula',
  'röd', 'röda', 'rött', 'vit', 'vita', 'vitt', 'grön', 'gröna', 'grönt', 'svart', 'svarta',
  'eller', 'och', 'med', 'till', 'utan', 'att', 'för', 'av', 'på', 'i', 'alt', 'ca', 'gärna',
  'hel', 'hela', 'helt', 'extra', 'fint', 'grovt', 'nymalen', 'torkad', 'torkade', 'fryst', 'frysta', 'ekologisk',
]);

const ENDINGS = ['orna', 'erna', 'arna', 'orna', 'en', 'et', 'na', 'or', 'er', 'ar', 'a', 'e', 'n', 's'];

// Base nouns keep their full form where a shorter stem would also match a verb
// ("grädde" not "grädd", which would match "grädda").
function baseKey(base: string): string {
  return base === 'grädde' ? 'grädde' : base === 'olja' ? 'olj' : stem(base);
}

function stem(word: string): string {
  for (const end of ENDINGS) {
    if (word.endsWith(end) && word.length - end.length >= 3) {
      return word.slice(0, -end.length);
    }
  }
  return word;
}

/** Search keys for one ingredient name, e.g. "Spaghetti eller Rigatoni" -> spaghett, rigaton. */
export function ingredientKeys(name: string): string[] {
  // "(alt. parmesan)" is another choice, other brackets only describe ("(finhackad)")
  const cleaned = name
    .replace(/\(\s*alt\.?\s*([^)]*)\)/gi, ' eller $1 ')
    .replace(/\([^)]*\)/g, ' ');
  const keys = new Set<string>();

  const purpose = /\s(?:till|att|för|i|med|på|av|\+)\s/i;
  for (const [pattern, key] of GENERIC_NAMES) {
    if (pattern.test(cleaned.toLowerCase().split(purpose)[0])) keys.add(key);
  }

  for (const alternative of cleaned.split(/\s+eller\s+|,|\/|&|\s+och\s+|\s+el\.\s+/i)) {
    // Drop what the ingredient is for, e.g. "Salt till pastavattnet", "Smör att steka i"
    const core = alternative.split(purpose)[0];
    const words = core.match(new RegExp(`[${LETTER}]+`, 'gi')) || [];
    const meaningful = words.filter((w) => !SKIP_WORDS.has(w.toLowerCase()) && w.length >= 3);
    if (meaningful.length === 0) continue;

    // The last word is usually the ingredient itself ("riven parmesan", "gul lök").
    // Proper names like "Pecorino Romano" count with every word.
    const isProperName = meaningful.slice(1).some((w) => /^[A-ZÅÄÖ]/.test(w));
    const heads = isProperName ? meaningful : [meaningful[meaningful.length - 1]];

    for (const original of heads) {
      const head = original.toLowerCase();
      keys.add(stem(head));
      for (const base of BASE_NOUNS) {
        if (head !== base && head.endsWith(base) && head !== 'ströbröd') keys.add(baseKey(base));
      }

      // Peel off compound tails, e.g. "kycklingbröstfilé" -> "kycklingbröst" -> "kyckling"
      let rest = head;
      for (let peeled = true; peeled; ) {
        peeled = false;
        for (const tail of COMPOUND_TAILS) {
          if (rest.endsWith(tail) && rest.length - tail.length >= 3) {
            rest = rest.slice(0, -tail.length).replace(/s$/, '');
            keys.add(stem(rest));
            peeled = true;
            break;
          }
        }
      }
    }
  }

  return [...keys].filter((k) => k.length >= 3);
}

/** A word in a step that names one or more ingredients. start and end cover the whole word. */
export interface IngredientMention {
  start: number;
  end: number;
  ingredients: number[];
}

/**
 * Finds the words in a step that name ingredients, e.g. "äggulorna" and "pastan".
 * When two keys match the same word, the longer key wins, so "äggulorna" counts as
 * "äggulor" and not as "ägg". Keys of the same length share the word
 * (e.g. "löken" with both "gul lök" and "rödlök").
 */
export function findIngredientMentions(text: string, ingredients: Ingredient[]): IngredientMention[] {
  const lower = text.toLowerCase();
  const matches: { idx: number; start: number; end: number; wordEnd: number }[] = [];

  ingredients.forEach((ing, idx) => {
    for (const key of ingredientKeys(ing.name)) {
      const re = new RegExp(`(?<![${LETTER}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(lower))) {
        // Skip verb forms such as "saltat vatten" and "oljad panna"
        const rest = lower.slice(m.index + key.length).match(new RegExp(`^[${LETTER}]*`))![0];
        if (/^(at|ad|ade|ades)$/.test(rest)) continue;
        // Skip compounds that name something else, e.g. "pastavattnet", "vattenbad"
        if (/^(vatten|vattn|bad|röra)/.test(rest)) continue;
        // "Salta" is the verb, not the salt
        if (key === 'salt' && rest === 'a') continue;
        // A describing word built on the name, e.g. "ostgratinerade", "smörstekt", is not the ingredient
        if (rest.length > 4 && /(ade|ad|at|stekt|kokt|bakad|bakade|rostad|rostade)$/.test(rest)) continue;
        matches.push({ idx, start: m.index, end: m.index + key.length, wordEnd: m.index + key.length + rest.length });
      }
    }
  });

  matches.sort((a, b) => b.end - b.start - (a.end - a.start));
  const claimed: { start: number; end: number }[] = [];
  const byWord = new Map<number, IngredientMention>();
  for (const m of matches) {
    const len = m.end - m.start;
    if (claimed.some((c) => m.start < c.end && c.start < m.end && c.end - c.start > len)) continue;
    claimed.push(m);
    const existing = byWord.get(m.start);
    if (existing) {
      if (!existing.ingredients.includes(m.idx)) existing.ingredients.push(m.idx);
    } else {
      byWord.set(m.start, { start: m.start, end: m.wordEnd, ingredients: [m.idx] });
    }
  }

  // A shorter key inside a word already taken by a longer one starts at another place
  // in the same word: drop those so words never overlap.
  const sorted = [...byWord.values()].sort((a, b) => a.start - b.start);
  const result: IngredientMention[] = [];
  for (const m of sorted) {
    const prev = result[result.length - 1];
    if (prev && m.start < prev.end) continue;
    m.ingredients.sort((a, b) => a - b);
    result.push(m);
  }
  return result;
}

