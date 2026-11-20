/**
 * American and British measures in recipes from English pages, changed to Swedish ones:
 * cups to dl, ounces and pounds to grams, sticks of butter to grams, pints and quarts to dl and
 * litres, °F to °C and inches to cm. Only the measures are changed; the words stay as they are.
 * Used on ingredient lines before they are read, and on the text of the steps.
 */

// An amount: "2", "1.5", "1 1/2", "1/2", "½", "1½", also a range "1-2" or "1 to 2"
const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛]|\s+\d+\/\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛])`;
const AMOUNT = String.raw`(${NUM}(?:\s*(?:-|–|to)\s*${NUM})?)`;

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

function parseNumber(raw: string): number | null {
  let s = raw.trim();
  let total = 0;
  const frac = s.match(/[½¼¾⅓⅔⅛]/);
  if (frac) {
    total += FRACTIONS[frac[0]];
    s = s.replace(frac[0], '').trim();
  }
  if (!s) return total;
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return total + Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const simple = s.match(/^(\d+)\/(\d+)$/);
  if (simple) return total + Number(simple[1]) / Number(simple[2]);
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? total + n : null;
}

/** The low and high end of an amount, the same number twice when it is not a range */
function parseAmount(raw: string): [number, number] | null {
  const parts = raw.split(/\s*(?:-|–|\bto\b)\s*/);
  const low = parseNumber(parts[0]);
  const high = parts.length > 1 ? parseNumber(parts[1]) : low;
  return low !== null && high !== null && low > 0 ? [low, high] : null;
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/** A number as Swedish recipes write it: decimal comma, no trailing zeros */
function swedish(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Grams rounded the way recipes write them: 5 g steps up to 100 g, then 10 g, then 25 g */
function grams(g: number): string {
  if (g >= 1000) return `${swedish(roundTo(g / 1000, 0.1))} kg`;
  const step = g < 20 ? 1 : g < 100 ? 5 : g < 500 ? 10 : 25;
  return `${swedish(roundTo(g, step))} g`;
}

/** Millilitres as dl or l, in steps that fit a measuring jug */
function volume(ml: number): string {
  if (ml < 50) return `${swedish(roundTo(ml / 15, 0.5))} msk`;
  const dl = ml / 100;
  if (dl >= 10) return `${swedish(roundTo(dl / 10, 0.1))} l`;
  return `${swedish(roundTo(dl, dl < 2 ? 0.1 : 0.5))} dl`;
}

type Unit = { pattern: string; to: (n: number) => string };

// Longer names first, so "fluid ounces" is not read as "ounces"
const UNITS: Unit[] = [
  { pattern: String.raw`fl\.?\s*oz\.?|fluid\s+ounces?`, to: (n) => volume(n * 29.57) },
  { pattern: String.raw`cups?|c\.`, to: (n) => volume(n * 236.6) },
  { pattern: String.raw`pints?|pt\.?`, to: (n) => volume(n * 473.2) },
  { pattern: String.raw`quarts?|qt\.?`, to: (n) => volume(n * 946.4) },
  { pattern: String.raw`gallons?|gal\.?`, to: (n) => volume(n * 3785) },
  { pattern: String.raw`pounds?|lbs?\.?`, to: (n) => grams(n * 453.6) },
  { pattern: String.raw`ounces?|oz\.?`, to: (n) => grams(n * 28.35) },
  { pattern: String.raw`sticks?(?=\s+(?:of\s+)?(?:\w+\s+)?butter)`, to: (n) => grams(n * 113) },
  { pattern: String.raw`tablespoons?|tbsps?\.?|tbs\.?`, to: (n) => `${swedish(roundTo(n, 0.5))} msk` },
  { pattern: String.raw`teaspoons?|tsps?\.?`, to: (n) => `${swedish(roundTo(n, 0.25))} tsk` },
];

/** The converted amount: one number, or a range "2–3 dl" with the unit once */
function convertAmount(raw: string, unit: Unit): string | null {
  const amount = parseAmount(raw);
  if (!amount) return null;
  const [low, high] = amount;
  const a = unit.to(low);
  if (low === high) return a;
  const b = unit.to(high);
  const [aNum, aUnit] = a.split(' ');
  const [bNum, bUnit] = b.split(' ');
  return aUnit === bUnit ? (aNum === bNum ? a : `${aNum}–${bNum} ${bUnit}`) : `${a}–${b}`;
}

// Oven temperatures as Swedish recipes give them
const OVEN: Record<number, number> = { 250: 125, 275: 140, 300: 150, 325: 160, 350: 175, 375: 190, 400: 200, 425: 220, 450: 230, 475: 240, 500: 250 };

const F = String.raw`(\d{2,3})\s*(?:°\s*|º\s*|degrees?\s+)(?:F\b|Fahrenheit\b)`;
const C = String.raw`(\d{2,3})\s*(?:°\s*|º\s*|degrees?\s+)(?:C\b|Celsius\b)`;

/** °F to °C: the page's own °C when it gives both, otherwise worked out as ovens are set */
function fahrenheit(text: string): string {
  return (
    text
      // "350°F (175°C)" and "350°F / 175°C": the °C the page gives
      .replace(new RegExp(String.raw`${F}\s*(?:\(\s*${C}\s*\)|\/\s*${C})`, 'gi'), (_m, _f, c1, c2) => `${c1 ?? c2} °C`)
      // "175°C (350°F)" and "175°C / 350°F": the °F is left out
      .replace(new RegExp(String.raw`${C}\s*(?:\(\s*${F}\s*\)|\/\s*${F})`, 'gi'), (_m, c) => `${c} °C`)
      .replace(new RegExp(String.raw`${F}|(\d{3})\s*F\b`, 'gi'), (m, a: string | undefined, b: string | undefined) => {
        const f = Number(a ?? b);
        if (f < 150 || f > 600) return m;
        return `${OVEN[f] ?? Math.round(((f - 32) * 5) / 9 / 5) * 5} °C`;
      })
  );
}

/** "9-inch pan" -> "23 cm pan", "1/2 inch thick" -> "1 cm thick" */
function inches(text: string): string {
  const cm = (n: number) => swedish(n * 2.54 < 1 ? roundTo(n * 2.54, 0.5) : Math.round(n * 2.54));
  return text
    // "9x5-inch loaf pan", "9 x 13 inch dish" -> "23 x 13 cm"
    .replace(/(\d+(?:[.,]\d+)?)\s*(x|×)\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*)?(?:inch(?:es)?|in\.|″|")(?=[\s,.)]|$)/gi, (m, a: string, x: string, b: string) => {
      const [na, nb] = [Number(a.replace(',', '.')), Number(b.replace(',', '.'))];
      return Number.isFinite(na) && Number.isFinite(nb) ? `${cm(na)} ${x} ${cm(nb)} cm` : m;
    }).replace(new RegExp(String.raw`${AMOUNT}\s*(?:-\s*)?(?:inch(?:es)?|in\.|″|")(?=[\s,.)]|$)`, 'gi'), (m, raw: string) => {
    const amount = parseAmount(raw);
    if (!amount) return m;
    return amount[0] === amount[1] ? `${cm(amount[0])} cm` : `${cm(amount[0])}–${cm(amount[1])} cm`;
  });
}

/** Whether a text has American measures that would be changed */
export function hasImperialMeasures(text: string): boolean {
  return convertImperialMeasures(text) !== text;
}

/**
 * The text with American and British measures as Swedish ones. "1 1/2 cups flour" ->
 * "3,5 dl flour", "1 (14-ounce) can tomatoes" -> "1 (400 g) can tomatoes", "350°F" -> "175 °C".
 */
export function convertImperialMeasures(text: string): string {
  if (!text) return text;
  let out = text;
  const converted = convertMeasures(out);
  if (converted === out) return out;
  // The page's own metric amount in brackets ("8 oz sour cream (227 g)") says the same as the
  // converted one, so it is left out
  out = out.replace(METRIC_IN_BRACKETS, '');
  return convertMeasures(out);
}

const METRIC_IN_BRACKETS =
  /\s*\((?:about\s+|approx\.?\s+|ca\.?\s+)?[\d.,\s/–-]+\s*(?:ml|l|dl|cl|g|kg|grams?|millilit(?:er|re)s?|lit(?:er|re)s?|°\s*C)\)/gi;

function convertMeasures(text: string): string {
  let out = text;
  for (const unit of UNITS) {
    // "14-ounce" in "1 (14-ounce) can" has a hyphen between the amount and the unit
    const re = new RegExp(String.raw`(^|[^\w.,/])${AMOUNT}\s*-?\s*(?:${unit.pattern})(?=[\s,.;:)]|$)`, 'gi');
    out = out.replace(re, (m, before: string, raw: string) => {
      const converted = convertAmount(raw, unit);
      return converted ? `${before}${converted}` : m;
    });
  }
  return inches(fahrenheit(out));
}
