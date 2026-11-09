/**
 * Scale an ingredient amount linearly based on servings.
 * Formula: (baseAmount / baseServings) * targetServings
 */
export function scaleIngredientAmount(
  baseAmount: number | null | undefined,
  baseServings: number,
  targetServings: number
): number | null {
  if (baseAmount === null || baseAmount === undefined || isNaN(baseAmount)) {
    return null;
  }
  if (!baseServings || baseServings <= 0 || !targetServings || targetServings <= 0) {
    return baseAmount;
  }
  const scaled = (baseAmount / baseServings) * targetServings;
  // Round to 2 decimal places to avoid IEEE floating point inaccuracies (e.g. 0.30000000000000004)
  return Math.round(scaled * 100) / 100;
}

/**
 * Format numeric amount into human-friendly representation (e.g. 1.5 -> 1 ½, 0.25 -> ¼)
 */
/**
 * Amount for the shopping list: decimal comma instead of fractions, e.g. 1,5 (not 1 ½).
 */
export function formatShoppingAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  return amount.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
}

export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '';
  }

  // Handle integers
  if (Number.isInteger(amount)) {
    return amount.toString();
  }

  const whole = Math.floor(amount);
  const frac = Math.round((amount - whole) * 100) / 100;

  let fractionStr = '';
  if (Math.abs(frac - 0.5) < 0.05) fractionStr = '½';
  else if (Math.abs(frac - 0.25) < 0.05) fractionStr = '¼';
  else if (Math.abs(frac - 0.75) < 0.05) fractionStr = '¾';
  else if (Math.abs(frac - 0.33) < 0.05 || Math.abs(frac - 0.34) < 0.05) fractionStr = '⅓';
  else if (Math.abs(frac - 0.67) < 0.05 || Math.abs(frac - 0.66) < 0.05) fractionStr = '⅔';
  else if (Math.abs(frac - 0.125) < 0.05) fractionStr = '⅛';
  else {
    // If not a common fraction, return cleanly rounded decimal
    return amount % 1 === 0 ? amount.toString() : amount.toFixed(1).replace(/\.0$/, '');
  }

  if (whole === 0) {
    return fractionStr;
  }
  return `${whole} ${fractionStr}`;
}

/**
 * Format total cooking time string (e.g. 35 min)
 */
export function formatCookingTime(prepMinutes?: number, cookMinutes?: number): string {
  // Prep time and cook time have been merged into a single "Tillagningstid".
  // If both arguments are provided, cookMinutes is the primary total time.
  // If only one argument is provided, prepMinutes receives the value.
  let total = 0;
  if (typeof cookMinutes === 'number' && cookMinutes > 0) {
    total = cookMinutes;
  } else if (typeof prepMinutes === 'number' && prepMinutes > 0) {
    total = prepMinutes;
  }

  if (total <= 0) return '30 min';
  if (total >= 60) {
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins > 0 ? `${hours} tim ${mins} min` : `${hours} tim`;
  }
  return `${total} min`;
}

/**
 * Smart parser for recipe durations across ISO 8601, Swedish, and international expressions.
 * Handles ISO durations ("PT30M", "PT1H15M", "PT1.5H"), compound expressions ("1 timme 15 min", "1 h 30 min"),
 * decimal hours ("1,5 timme"), pure hours ("1 timme"), ranges ("30-40 min"), and labeled formats ("Tillagningstid: 45 min").
 */
export function parseRecipeTimeString(rawStr?: string | null): number | undefined {
  if (!rawStr || typeof rawStr !== 'string') return undefined;
  const str = rawStr.replace(/\*\*/g, '').replace(/[\*_]/g, '').trim();
  if (!str) return undefined;

  // 1. ISO 8601 duration: e.g. PT1H30M, PT45M, P0DT1H, PT1.5H
  const isoMatch = str.match(/P(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+)S)?)/i);
  if (isoMatch && (isoMatch[1] || isoMatch[2])) {
    const hours = parseFloat((isoMatch[1] || '0').replace(',', '.'));
    const minutes = parseFloat((isoMatch[2] || '0').replace(',', '.'));
    const total = Math.round(hours * 60 + minutes);
    if (total > 0) return total;
  }

  // 2. Compound 'X tim / h' + 'Y min': e.g. '1 timme 15 min', '1 timme och 20 minuter', '1 h 30 min'
  const compoundMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:timmar|timme|tim|h|hour|hours)\s*(?:och\s*)?(\d+)\s*(?:minuter|minut|min|m)\b/i);
  if (compoundMatch) {
    const hours = parseFloat(compoundMatch[1].replace(',', '.'));
    const minutes = parseInt(compoundMatch[2], 10);
    const total = Math.round(hours * 60 + minutes);
    if (total > 0) return total;
  }

  // 3. Decimal/fractional hours: e.g. '1,5 timme', '1.5 timmar', '2,5 h', '0,5 tim'
  const decimalHoursMatch = str.match(/(\d+[.,]\d+)\s*(?:timmar|timme|tim|h|hour|hours)\b/i);
  if (decimalHoursMatch) {
    const hours = parseFloat(decimalHoursMatch[1].replace(',', '.'));
    const total = Math.round(hours * 60);
    if (total > 0) return total;
  }

  // 4. Pure hours: e.g. '1 timme', '2 timmar', '1 h'
  const pureHoursMatch = str.match(/(?:^|\b|\s)(\d+)\s*(?:timmar|timme|tim|h|hour|hours)\b/i);
  if (pureHoursMatch) {
    const hours = parseInt(pureHoursMatch[1], 10);
    if (hours > 0 && hours <= 24) return hours * 60;
  }

  // 5. Minute ranges: e.g. '20-30 min', '15–20 minuter', '30 till 40 min'
  const rangeMatch = str.match(/(\d+)\s*(?:-|–|till|to)\s*(\d+)\s*(?:minuter|minut|min|m)\b/i);
  if (rangeMatch) {
    const minVal = parseInt(rangeMatch[1], 10);
    const maxVal = parseInt(rangeMatch[2], 10);
    return Math.round((minVal + maxVal) / 2);
  }

  // 6. 'Över 60 min' / '> 60 min' / 'Under 20 min' / '< 20 min'
  const overUnderMatch = str.match(/(?:över|>|mer än|under|<|mindre än)\s*(\d+)\s*(?:minuter|minut|min|m)\b/i);
  if (overUnderMatch) {
    const val = parseInt(overUnderMatch[1], 10);
    if (val > 0) return val;
  }

  // 7. Labeled line: 'Tillagningstid: 45 min', 'Tid: 30 min', 'Arbetstid: 20 min'
  const labeledMatch = str.match(/(?:tillagningstid|tillagning|koktid|stektid|ugnstid|tidsåtgång|arbetstid|total\s*tid|aktiv\s*tid|tid|time|ready in|prep|cook)\s*[:•\-–]?\s*(?:ca\s*|cirka\s*)?(\d+)\s*(?:minuter|minut|min|m)?\b/i);
  if (labeledMatch && labeledMatch[1]) {
    const num = parseInt(labeledMatch[1], 10);
    if (num > 0 && num <= 720) return num;
  }

  // 8. Single minutes: e.g. '30 minuter', 'ca 45 min', '25 min'
  const singleMinutesMatch = str.match(/(?:ca\s*|cirka\s*)?(\d+)\s*(?:minuter|minut|min|m)\b/i);
  if (singleMinutesMatch) {
    const minutes = parseInt(singleMinutesMatch[1], 10);
    if (minutes > 0 && minutes <= 720) return minutes;
  }

  return undefined;
}

/**
 * Always capitalize the first letter of a string (e.g. "mjölk" -> "Mjölk", "pasta" -> "Pasta")
 */
export function capitalizeFirst(str?: string | null): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Combine amount and unit into a single human string (e.g. 5, "dl" -> "5 dl")
 */
/**
 * Complete Swedish unit pluralization rules.
 * Maps known unit words (both singular and plural forms) to their singular and plural Swedish representations.
 */
interface UnitPluralRule {
  singular: string;
  plural: string;
}

export const UNIT_PLURAL_RULES: Record<string, UnitPluralRule> = {
  burk: { singular: 'burk', plural: 'burkar' },
  burkar: { singular: 'burk', plural: 'burkar' },
  påse: { singular: 'påse', plural: 'påsar' },
  påsar: { singular: 'påse', plural: 'påsar' },
  kruka: { singular: 'kruka', plural: 'krukor' },
  krukor: { singular: 'kruka', plural: 'krukor' },
  klyfta: { singular: 'klyfta', plural: 'klyftor' },
  klyftor: { singular: 'klyfta', plural: 'klyftor' },
  skiva: { singular: 'skiva', plural: 'skivor' },
  skivor: { singular: 'skiva', plural: 'skivor' },
  nypa: { singular: 'nypa', plural: 'nypor' },
  nypor: { singular: 'nypa', plural: 'nypor' },
  knippe: { singular: 'knippe', plural: 'knippen' },
  knippen: { singular: 'knippe', plural: 'knippen' },
  tärning: { singular: 'tärning', plural: 'tärningar' },
  tärningar: { singular: 'tärning', plural: 'tärningar' },
  kub: { singular: 'kub', plural: 'kuber' },
  kuber: { singular: 'kub', plural: 'kuber' },
  kopp: { singular: 'kopp', plural: 'koppar' },
  koppar: { singular: 'kopp', plural: 'koppar' },
  näve: { singular: 'näve', plural: 'nävar' },
  nävar: { singular: 'näve', plural: 'nävar' },
  droppe: { singular: 'droppe', plural: 'droppar' },
  droppar: { singular: 'droppe', plural: 'droppar' },
  portion: { singular: 'portion', plural: 'portioner' },
  portioner: { singular: 'portion', plural: 'portioner' },
  kanna: { singular: 'kanna', plural: 'kannor' },
  kannor: { singular: 'kanna', plural: 'kannor' },
  bit: { singular: 'bit', plural: 'bitar' },
  bitar: { singular: 'bit', plural: 'bitar' },
  tub: { singular: 'tub', plural: 'tuber' },
  tuber: { singular: 'tub', plural: 'tuber' },
  flaska: { singular: 'flaska', plural: 'flaskor' },
  flaskor: { singular: 'flaska', plural: 'flaskor' },
  rulle: { singular: 'rulle', plural: 'rullar' },
  rullar: { singular: 'rulle', plural: 'rullar' },
  bunt: { singular: 'bunt', plural: 'buntar' },
  buntar: { singular: 'bunt', plural: 'buntar' },
  stång: { singular: 'stång', plural: 'stänger' },
  stänger: { singular: 'stång', plural: 'stänger' },
  kvist: { singular: 'kvist', plural: 'kvistar' },
  kvistar: { singular: 'kvist', plural: 'kvistar' },
  kula: { singular: 'kula', plural: 'kulor' },
  kulor: { singular: 'kula', plural: 'kulor' },
  huvud: { singular: 'huvud', plural: 'huvuden' },
  huvuden: { singular: 'huvud', plural: 'huvuden' },
  ask: { singular: 'ask', plural: 'askar' },
  askar: { singular: 'ask', plural: 'askar' },
  stjälk: { singular: 'stjälk', plural: 'stjälkar' },
  stjälkar: { singular: 'stjälk', plural: 'stjälkar' },
  skopa: { singular: 'skopa', plural: 'skopor' },
  skopor: { singular: 'skopa', plural: 'skopor' },
  korg: { singular: 'korg', plural: 'korgar' },
  korgar: { singular: 'korg', plural: 'korgar' },
  kartong: { singular: 'kartong', plural: 'kartonger' },
  kartonger: { singular: 'kartong', plural: 'kartonger' },
  förpackning: { singular: 'förpackning', plural: 'förpackningar' },
  förpackningar: { singular: 'förpackning', plural: 'förpackningar' },
  bägare: { singular: 'bägare', plural: 'bägare' },
  tråg: { singular: 'tråg', plural: 'tråg' },
  blad: { singular: 'blad', plural: 'blad' },
  glas: { singular: 'glas', plural: 'glas' },
  stänk: { singular: 'stänk', plural: 'stänk' },
  paket: { singular: 'paket', plural: 'paket' },
};

/**
 * Formats a unit into its grammatically correct Swedish form (singular vs plural) based on the numeric amount.
 * E.g.
 * - formatUnit('burk', 2) -> 'burkar'
 * - formatUnit('burkar', 1) -> 'burk'
 * - formatUnit('burk', 1) -> 'burk'
 * - formatUnit('burk', 0.5) -> 'burk'
 * - formatUnit('msk', 2) -> 'msk'
 * - formatUnit('st', 2) -> 'st'
 */
export function formatUnit(rawUnit?: string | null, amount?: number | null): string {
  if (!rawUnit) return '';
  const trimmed = rawUnit.trim();
  if (!trimmed) return '';

  if (amount === null || amount === undefined || isNaN(amount)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const rule = UNIT_PLURAL_RULES[lower];
  if (!rule) {
    return trimmed;
  }

  // In Swedish, 1 is singular; fractions <= 1 (0.5, 0.25) are singular; > 1 (e.g. 1.5, 2) or 0 are plural.
  const isPlural = amount > 1 || amount === 0;
  const result = isPlural ? rule.plural : rule.singular;

  // Preserve capitalization if source was capitalized
  if (trimmed.charAt(0) === trimmed.charAt(0).toUpperCase() && trimmed.charAt(0) !== trimmed.charAt(0).toLowerCase()) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

const INGREDIENT_NOUN_RULES: Array<{ pattern: RegExp; singular: string; plural: string }> = [
  { pattern: /^gula?\s+lök(?:ar)?$/i, singular: 'Gul lök', plural: 'Gula lökar' },
  { pattern: /^röda?\s+lök(?:ar)?$|^rödlök(?:ar)?$/i, singular: 'Rödlök', plural: 'Rödlökar' },
  { pattern: /^schalottenlök(?:ar)?$/i, singular: 'Schalottenlök', plural: 'Schalottenlökar' },
  { pattern: /^salladslök(?:ar)?$/i, singular: 'Salladslök', plural: 'Salladslökar' },
  { pattern: /^lök(?:ar)?$/i, singular: 'Lök', plural: 'Lökar' },
  { pattern: /^morot$|^morötter$/i, singular: 'Morot', plural: 'Morötter' },
  { pattern: /^tomat(?:er)?$/i, singular: 'Tomat', plural: 'Tomater' },
  { pattern: /^körsbärstomat(?:er)?$/i, singular: 'Körsbärstomat', plural: 'Körsbärstomater' },
  { pattern: /^plommontomat(?:er)?$/i, singular: 'Plommontomat', plural: 'Plommontomater' },
  { pattern: /^gurka$|^gurkor$/i, singular: 'Gurka', plural: 'Gurkor' },
  { pattern: /^paprika$|^paprikor$/i, singular: 'Paprika', plural: 'Paprikor' },
  { pattern: /^banan(?:er)?$/i, singular: 'Banan', plural: 'Bananer' },
  { pattern: /^äpple$|^äpplen$/i, singular: 'Äpple', plural: 'Äpplen' },
  { pattern: /^päron$/i, singular: 'Päron', plural: 'Päron' },
  { pattern: /^citron(?:er)?$/i, singular: 'Citron', plural: 'Citroner' },
  { pattern: /^lime$/i, singular: 'Lime', plural: 'Lime' },
  { pattern: /^avokado$|^avokador$|^avokados$/i, singular: 'Avokado', plural: 'Avokador' },
  { pattern: /^potatis(?:ar)?$/i, singular: 'Potatis', plural: 'Potatisar' },
  { pattern: /^bakpotatis(?:ar)?$/i, singular: 'Bakpotatis', plural: 'Bakpotatisar' },
  { pattern: /^sötpotatis(?:ar)?$/i, singular: 'Sötpotatis', plural: 'Sötpotatisar' },
  { pattern: /^palsternacka$|^palsternackor$/i, singular: 'Palsternacka', plural: 'Palsternackor' },
  { pattern: /^rödbeta$|^rödbetor$/i, singular: 'Rödbeta', plural: 'Rödbetor' },
  { pattern: /^polkabeta$|^polkabetor$/i, singular: 'Polkabeta', plural: 'Polkabetor' },
  { pattern: /^gulbeta$|^gulbetor$/i, singular: 'Gulbeta', plural: 'Gulbetor' },
  { pattern: /^champinjon(?:er)?$/i, singular: 'Champinjon', plural: 'Champinjoner' },
  { pattern: /^vitlöksklyfta$|^vitlöksklyftor$/i, singular: 'Vitlöksklyfta', plural: 'Vitlöksklyftor' },
  { pattern: /^vitlökshuvud$|^vitlökshuvuden$/i, singular: 'Vitlökshuvud', plural: 'Vitlökshuvuden' },
  { pattern: /^chilifrukt(?:er)?$/i, singular: 'Chilifrukt', plural: 'Chilifrukter' },
  { pattern: /^kycklingfilé(?:er)?$/i, singular: 'Kycklingfilé', plural: 'Kycklingfiléer' },
  { pattern: /^laxfilé(?:er)?$/i, singular: 'Laxfilé', plural: 'Laxfiléer' },
  { pattern: /^torskrygg(?:ar)?$/i, singular: 'Torskrygg', plural: 'Torskryggar' },
  { pattern: /^ägg$/i, singular: 'Ägg', plural: 'Ägg' },
];

/**
 * Inflects common Swedish countable ingredient names based on amount when unit is 'st' or empty.
 * E.g. "Gula lökar" -> "Gul lök" when amount is 1.
 *      "Gul lök" -> "Gula lökar" when amount is 2.
 */
export function formatIngredientName(rawName?: string | null, amount?: number | null, unit?: string | null): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  if (amount === null || amount === undefined || isNaN(amount)) {
    return trimmed;
  }

  const u = (unit || '').toLowerCase().trim();
  const isCountable = !u || u === 'st' || u === 'styck' || u === 'stycken';
  if (!isCountable) {
    return trimmed;
  }

  const isPlural = amount > 1 || amount === 0;

  for (const rule of INGREDIENT_NOUN_RULES) {
    if (rule.pattern.test(trimmed)) {
      return isPlural ? rule.plural : rule.singular;
    }
  }

  return trimmed;
}

/**
 * Cleans instruction step text by stripping leading numbers, bullets, dashes, checkboxes, and markdown artifacts.
 * E.g. "7. - [x] Toppa med persilja" -> "Toppa med persilja"
 *      "- Stek kycklingen" -> "Stek kycklingen"
 *      "* Sätt ugnen på 175°" -> "Sätt ugnen på 175°"
 */
export function cleanLeadingStepNumber(text: string): string {
  if (!text) return '';

  return text
    // 0. Invisible characters copied along with the text, which would hide the step number
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .trim()
    // 1. Strip markdown images and HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/<[^>]+>/g, '')
    // 2. Strip markdown links keeping inner text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // 3. Strip checkbox markers: [x], [ ], [X], etc. anywhere in line
    .replace(/\[[ xX✓✔☑☐\s]*\]/g, '')
    // 4. Strip leading numbers like "1. ", "1, ", "1) ", "Steg 1: ", "1 - "
    .replace(/^(?:[sS]teg|[sS]tep)?\s*\d{1,2}\s*[:\.\-–\),]\s*/, '')
    // 5. Strip leading bullets, dashes, dots, stars (e.g. "- ", "• ", "* ", "– ", "— ")
    .replace(/^[•\-\*–—\+\.]+\s*/, '')
    // 6. Strip leading numbers again if formatted as "- 1. "
    .replace(/^(?:[sS]teg|[sS]tep)?\s*\d{1,2}\s*[:\.\-–\),]\s*/, '')
    // 7. Strip leading dashes again in case of "1. - "
    .replace(/^[•\-\*–—\+\.]+\s*/, '')
    .trim();
}

/**
 * Formats a single ingredient object into a clean, human-readable line for text editing.
 * Grammatically inflects units and countable ingredient names based on the numeric amount.
 * E.g. { name: 'Krossade tomater', amount: 2, unit: 'burk' } -> "2 burkar Krossade tomater"
 *      { name: 'Krossade tomater', amount: 1, unit: 'burk' } -> "1 burk Krossade tomater"
 *      { name: 'Gula lökar', amount: 2, unit: 'st' } -> "2 st Gula lökar"
 *      { name: 'Gula lökar', amount: 1, unit: 'st' } -> "1 st Gul lök"
 */
export function formatIngredientToLine(ing: { name: string; amount?: number | null; unit?: string }): string {
  const rawName = ing.name?.trim() || '';
  if (!rawName) return '';

  const amount = ing.amount;
  const unit = ing.unit?.trim() || '';
  const name = formatIngredientName(rawName, amount, unit) || rawName;

  if (amount !== null && amount !== undefined && !isNaN(amount)) {
    // Decimal comma, as everywhere else in the app (1,5 msk)
    const amountText = String(amount).replace('.', ',');
    if (unit) {
      const formattedUnit = formatUnit(unit, amount);
      return `${amountText} ${formattedUnit} ${name}`.trim();
    }
    return `${amountText} ${name}`.trim();
  }

  if (unit && unit.toLowerCase() === 'efter smak') {
    return `${name} efter smak`;
  }
  if (unit) {
    return `${unit} ${name}`.trim();
  }
  return name;
}

/**
 * Formats an array of ingredients into a newline-separated string for multi-line editing.
 */
export function formatIngredientsToText(
  ingredients?: Array<{ name: string; amount?: number | null; unit?: string }> | null
): string {
  if (!ingredients || ingredients.length === 0) return '';
  return ingredients
    .map(formatIngredientToLine)
    .filter((line) => line.length > 0)
    .join('\n');
}


// Words that describe how an ingredient is prepared, which do not matter when shopping
const PREPARATION_PATTERN =
  /(hack|skiv|kvart|tärn|riv|strimla|pressad|klyft|delad|delade|halverad|bitar|mosad|smält|rumsvarm|skala|sköljd|avrunn|fint|grovt|tunt|servering|garnering|stekning|steka|pensling|bryning|marinad|urkramad|finfördela|slanta)/i;

/**
 * Removes preparation notes after a comma in an ingredient name, for the shopping list.
 * E.g. "Gul lök, finhackad" -> "Gul lök", "Champinjoner, i kvartar eller skivor" -> "Champinjoner".
 * A comma part that is not about preparation is kept ("Ost, gärna lagrad").
 */
export function stripPreparation(name: string): string {
  if (!name || !name.includes(',')) return name;
  const [first, ...rest] = name.split(',');
  const kept = rest.filter((part) => !PREPARATION_PATTERN.test(part));
  return [first, ...kept].join(',').trim();
}

// Names that keep their capital letter inside a recipe title.
const TITLE_PROPER_NOUNS = new Set(['skagen']);

/**
 * Recipe titles written with a capital letter on every word ("Klassisk Krämig Pasta")
 * are shown the Swedish way ("Klassisk krämig pasta"). Titles that already follow
 * Swedish style are left as they are. Only the display changes, not the saved title.
 */
export function formatRecipeTitle(title: string | null | undefined): string {
  if (!title) return '';
  const words = title.trim().split(/\s+/);
  const letterWords = words.slice(1).filter((w) => /\p{L}/u.test(w));
  if (letterWords.length < 2) return title.trim();
  const capitalised = letterWords.filter((w) => /^[^\p{L}]*\p{Lu}/u.test(w)).length;
  if (capitalised / letterWords.length < 0.6) return title.trim();

  return words
    .map((word, idx) => {
      if (idx === 0) return word;
      const letters = word.replace(/[^\p{L}]/gu, '');
      // Keep abbreviations like BBQ and names like Skagen
      if (letters.length > 1 && letters === letters.toUpperCase()) return word;
      if (TITLE_PROPER_NOUNS.has(letters.toLowerCase())) return word;
      return word.toLowerCase();
    })
    .join(' ');
}
