/**
 * Reading a photographed recipe page by its layout.
 *
 * Tesseract reads a whole cookbook page as one column, so the ingredients on the left and the
 * steps on the right are mixed line by line. The positions of the words are right even when the
 * text is not, so the page is first cut into blocks along the empty space between them (columns,
 * and bands from top to bottom), each block is read on its own, and the text is then put together
 * as a recipe: the name (the biggest text), portions and time, the ingredients and the steps.
 * Boxes around the recipe (a story, a drink tip, nutrition, the page header and footer) are left out.
 */

export interface OcrWord {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  conf: number;
  /** Tesseract's own block, paragraph and line, so the words of a line stay together */
  line: string;
}

export interface OcrRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrLine {
  left: number;
  top: number;
  right: number;
  bottom: number;
  height: number;
  text: string;
}

/** Words from Tesseract's TSV output. */
export function wordsFromTsv(tsv?: string | null): { words: OcrWord[]; pageWidth: number; pageHeight: number } {
  const words: OcrWord[] = [];
  let pageWidth = 1000;
  let pageHeight = 1000;
  for (const row of (tsv || '').split('\n')) {
    const p = row.split('\t');
    if (p[0] === '1') {
      pageWidth = parseInt(p[8], 10) || pageWidth;
      pageHeight = parseInt(p[9], 10) || pageHeight;
    } else if (p[0] === '5' && p[11]?.trim()) {
      words.push({
        left: parseInt(p[6], 10) || 0,
        top: parseInt(p[7], 10) || 0,
        width: parseInt(p[8], 10) || 0,
        height: parseInt(p[9], 10) || 0,
        conf: parseFloat(p[10]) || 0,
        text: p[11].trim(),
        line: `${p[2]}.${p[3]}.${p[4]}`,
      });
    }
  }
  return { words, pageWidth, pageHeight };
}

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Lines from words, with Tesseract's own line grouping. */
export function linesFromWords(words: OcrWord[]): OcrLine[] {
  const groups = new Map<string, OcrWord[]>();
  for (const w of words) {
    const g = groups.get(w.line);
    if (g) g.push(w);
    else groups.set(w.line, [w]);
  }
  const lines: OcrLine[] = [];
  for (const ws of groups.values()) {
    ws.sort((a, b) => a.left - b.left);
    lines.push({
      left: Math.min(...ws.map((w) => w.left)),
      top: Math.min(...ws.map((w) => w.top)),
      right: Math.max(...ws.map((w) => w.left + w.width)),
      bottom: Math.max(...ws.map((w) => w.top + w.height)),
      height: median(ws.map((w) => w.height)),
      text: ws.map((w) => w.text).join(' '),
    });
  }
  return lines.sort((a, b) => a.top - b.top || a.left - b.left);
}

// Specks, lines and pictures read as text: no letters or digits, or far smaller or bigger than text
function usefulWords(words: OcrWord[]): OcrWord[] {
  const h = median(words.filter((w) => /[a-zåäö0-9]/i.test(w.text)).map((w) => w.height)) || 12;
  return words.filter(
    (w) =>
      /[a-zåäöéèü0-9½¼¾⅓⅔]/i.test(w.text) &&
      w.height >= h * 0.45 &&
      !(w.height > h * 4 && w.conf < 60) &&
      !(w.conf < 15 && w.text.length <= 2)
  );
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

const boxOf = (ws: OcrWord[]): Box => ({
  l: Math.min(...ws.map((w) => w.left)),
  t: Math.min(...ws.map((w) => w.top)),
  r: Math.max(...ws.map((w) => w.left + w.width)),
  b: Math.max(...ws.map((w) => w.top + w.height)),
});

/** Empty stretches between the words along one axis, as [start, end]. */
function gapsAlong(ws: OcrWord[], axis: 'x' | 'y', minGap: number): [number, number][] {
  const spans = ws
    .map((w) => (axis === 'x' ? [w.left, w.left + w.width] : [w.top, w.top + w.height]))
    .sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let end = spans[0][1];
  for (const [s, e] of spans.slice(1)) {
    if (s - end >= minGap) gaps.push([end, s]);
    end = Math.max(end, e);
  }
  return gaps;
}

function splitAt(ws: OcrWord[], axis: 'x' | 'y', gaps: [number, number][]): OcrWord[][] {
  const parts: OcrWord[][] = gaps.map(() => []).concat([[]]);
  for (const w of ws) {
    const pos = axis === 'x' ? w.left : w.top;
    let i = 0;
    while (i < gaps.length && pos >= gaps[i][1]) i++;
    parts[i].push(w);
  }
  return parts.filter((p) => p.length > 0);
}

/**
 * Cuts the page into blocks to read one by one, in reading order: bands from the top down, and
 * columns from left to right inside a band. A block is as tall as it can be while it holds one column.
 */
export function layoutBlocks(rawWords: OcrWord[], pageWidth: number): OcrRect[] {
  const words = usefulWords(rawWords);
  if (words.length === 0) return [];
  const h = median(words.map((w) => w.height)) || 12;
  const minColumnGap = Math.max(h * 2.2, pageWidth * 0.025);
  const minBandGap = h * 0.9;

  // Rows of text: words whose middles are close in height are on the same row
  const rows = (ws: OcrWord[]) => {
    const mids = ws.map((w) => w.top + w.height / 2).sort((a, b) => a - b);
    let count = mids.length ? 1 : 0;
    for (let i = 1; i < mids.length; i++) if (mids[i] - mids[i - 1] > h * 0.7) count++;
    return count;
  };
  // Columns need a few words on each side and must not be a single line spread out
  const columnGaps = (ws: OcrWord[]) => {
    // A short unsure word (a speck at the edge of a coloured box) does not close a gap
    const sure = ws.filter((w) => w.conf >= 50 || w.text.length > 3);
    if (sure.length < 2) return [];
    const gaps = gapsAlong(sure, 'x', minColumnGap);
    if (gaps.length === 0) return gaps;
    const parts = splitAt(ws, 'x', gaps);
    return parts.every((p) => rows(p) >= 1) && parts.filter((p) => rows(p) >= 2).length >= 1 ? gaps : [];
  };

  // Two bands belong together when they have columns at the same place, or when the upper one is a
  // single row of headings that sits over the lower one's columns ("Ingredienser    Gör så här")
  const sameColumns = (upper: OcrWord[], lower: OcrWord[], a: [number, number][], b: [number, number][]) => {
    const both = columnGaps(upper.concat(lower));
    if (both.length === 0) return false;
    const lowest = Math.max(...upper.map((w) => w.top + w.height));
    const below = Math.min(...lower.map((w) => w.top));
    const close = below - lowest < h * 3;
    const overlaps = (x: [number, number][], y: [number, number][]) =>
      x.some(([s1, e1]) => y.some(([s2, e2]) => Math.min(e1, e2) - Math.max(s1, s2) >= minColumnGap * 0.5));
    // A single row whose words keep to the columns above or below ("1 msk citronjuice   3. Vänd ner"),
    // or rows of a table, which only show their columns together
    if (b.length === 0 && rows(lower) === 1) return close && (a.length > 0 ? overlaps(a, both) : rows(upper) <= 2);
    if (b.length === 0) return false;
    if (a.length > 0) return a.some(([s1, e1]) => b.some(([s2, e2]) => Math.min(e1, e2) - Math.max(s1, s2) >= minColumnGap * 0.5));
    return rows(upper) === 1 && gapsAlong(upper, 'x', minColumnGap).length > 0 && close;
  };

  const cut = (ws: OcrWord[]): { split: boolean; blocks: OcrWord[][] } => {
    const cols = columnGaps(ws);
    if (cols.length > 0) {
      return { split: true, blocks: splitAt(ws, 'x', cols).flatMap((p) => cut(p).blocks) };
    }
    const bandGaps = gapsAlong(ws, 'y', minBandGap);
    if (bandGaps.length === 0) return { split: false, blocks: [ws] };
    // Neighbouring bands with columns at the same place are one taller band
    let bands = splitAt(ws, 'y', bandGaps);
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i + 1 < bands.length; i++) {
        const a = columnGaps(bands[i]);
        const b = columnGaps(bands[i + 1]);
        if (sameColumns(bands[i], bands[i + 1], a, b)) {
          bands = [...bands.slice(0, i), bands[i].concat(bands[i + 1]), ...bands.slice(i + 2)];
          merged = true;
          break;
        }
      }
    }
    const results = bands.map((b) => (bands.length === 1 ? { split: false, blocks: [b] } : cut(b)));
    if (results.every((r) => !r.split)) return { split: false, blocks: [ws] };
    // Bands without columns are kept as one block each, the ones with columns as their columns
    return { split: true, blocks: results.flatMap((r) => r.blocks) };
  };

  // Bands first at the top level, so a page header across the page does not stop the columns
  const top = gapsAlong(words, 'y', minBandGap);
  const bands = top.length ? splitAt(words, 'y', top) : [words];
  const blocks: OcrWord[][] = [];
  // Group the top bands the same way as inside cut, then cut each group
  let group: OcrWord[] = [];
  const flush = () => {
    if (group.length) blocks.push(...cut(group).blocks);
    group = [];
  };
  for (const band of bands) {
    if (group.length === 0) {
      group = band;
      continue;
    }
    if (sameColumns(group, band, columnGaps(group), columnGaps(band))) group = group.concat(band);
    else {
      flush();
      group = band;
    }
  }
  flush();

  const pad = Math.round(h * 0.4);
  return blocks.map((ws) => {
    const b = boxOf(ws);
    return { left: Math.max(0, b.l - pad), top: Math.max(0, b.t - pad), width: b.r - b.l + 2 * pad, height: b.b - b.t + 2 * pad };
  });
}

// ── Putting the blocks together as a recipe ─────────────────────────────────

/** Boxes and lines around the recipe that are not part of it. */
const NOISE_START =
  /^(?:kapitel\b|sida\s+\d|redaktionens|krönika|milj[öo]|h[åa]llbarhet|k[öo]ksredskap|förvaring|dryckestips|vintips|dryck\s*tips|vinförslag|n[äa]ring|energi\s*(?:&|och)\s*näring|ener(?:g|a)i\b|[a-zåäö]{3,8}\s*(?:&|och)\s*n[äa]ring|ur boken|recept av|recept:\s|foto\b|styling|text och bild|isbn|copyright|©|källa\b|annons|redaktionens kommentar|visste du|om författaren|observera|m[åa]ttomvandling|omvandlingstabell|omr[äa]kning|s[äa]kerhet|obs!|notera:|\d\)\s)/i;
/** Lines that are the recipe's labels rather than its content, such as "0-5 MIN" in a timeline. */
const LABEL_LINE = /^(?:\d+\s*[-–]\s*\d+\s*min|servering|förberedelse|\d+\s*min)\.?$/i;
const INGREDIENT_HEADING =
  /ingrediens|r[åa]var|du behöver|det här behöver|kryddor|smaksätt|tillbehör|komponent|^del\s*\d|^till\s+\w+:?$|^sås:?$|^deg:?$|^fyllning|^topping|^garnering|^dressing:?$|ingredients/i;
const STEP_HEADING = /g[öo]r s[åa] h[äa]r|s[åa] g[öo]r du|tillagning|tillredning|metod|arbets|moment(?!\s*\d)|instruktion|^steg(?!\s*\d)|method|instructions|directions|beredning/i;
/** A column of tips or notes beside the recipe ("Anteckningar: Läs igenom hela receptet först") */
const NOTES_HEADING = /^(?:anteckningar|tips|tips och råd|att tänka på|bra att veta|kockens tips|notera|obs)\b/i;
const OTHER_LANGUAGE = /english|\(en\)|\bin english\b|\bmethod \(en\)/i;
const STEP_VERB =
  /^(?:blanda|bryn|rulla|stek|koka|sätt|skala|skär|hacka|fräs|tillsätt|häll|vispa|rör|låt|lägg|servera|strö|toppa|fördela|grädda|gratinera|pudra|smält|sjud|mixa|vänd|dela|hetta|salta|krydda|smaka|ställ|ta\s|värm|ugnsbaka|baka|pensla|forma|knåda|jäs|riv|pressa|tvätta|skölj|rensa|blötlägg|marinera|grilla|vispa|klicka|garnera|sila|mosa|reducera|tina|kyl|frys|fyll|bred|vik|slå|smörj|bryt|skölj|förvälla|förväll|ansa|stek|kör|pürea|purea|mät|tärna|strimla|skiva)\b/i;

const isAllCaps = (s: string) => {
  const letters = s.replace(/[^a-zåäöéü]/gi, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
};

// A line that starts something new: a bullet, a number, an amount, "Moment 2:", "[3]" and so on
const NEW_ITEM =
  /^(?:[•·*+«»\-–—:]\s*|\d{1,2}\s*-+>|\[\s*\d+\s*\]|\(\d{1,2}\)\s|\d{1,2}\s*[.)]\s|(?:moment|steg|step|fas)\s*\d|[\d½¼¾⅓⅔]+(?:[.,]\d+)?\s*(?:[-–]\s*\d+\s*)?(?:g|kg|hg|dl|cl|ml|l|liter|msk|tsk|krm|st|skivor|klyftor|nypa|burk|paket|förp|frp|knippe|kruka)\b)/i;

/** The text of a line without its bullet, number or label ("Moment 2:", "Step 1:", "[3]"). */
function stripMarker(text: string): string {
  return text
    // A label before the line: "[PART] 3 st ägg", "SEQ-01: Vispa mjöl"
    .replace(/^\[[A-ZÅÄÖ]{2,12}\]\s*/, '')
    .replace(/^[A-ZÅÄÖ]{2,6}[-\s]?\d{1,2}\s*:\s*/, '')
    // An amount in a box is an amount: "[150] g smör", "[2] ½ dl socker"
    .replace(/^\[\s*(\d+)\s*\]\s*([½¼¾⅓⅔])/, '$1 $2')
    .replace(/^\[\s*(\d+)\s*\]\s*[%&¥]\s*/, '$1 ½ ')
    .replace(/^\[\s*([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s*\]\s*(?=(?:g|kg|hg|dl|cl|ml|l|liter|msk|tsk|krm|st|burk|burkar|klyftor|skivor|kruka|knippe|förp|pkt)\b)/i, '$1 ')
    // A timeline's label and the dots and lines read as signs before the text: "5-15 MIN = & Vispa"
    .replace(/^\d+\s*[-–]\s*\d+\s*min\b\s*/i, '')
    .replace(/^[^\p{L}\p{N}½¼¾⅓⅔(\[]+/u, '')
    // A checkbox read as letters before the amount: "[J 150 g", "Cd 1 flaska", "0 250 g"
    .replace(/^[\[\]()OoJjCcDdIl|0□■☐]{1,3}\s+(?=[\d½¼¾])/, '')
    // ... or before a word: "[OJ Steg 1:", "[0 Timjan"
    .replace(/^[\[(][\w\[\]()|]{0,2}\s+(?=[A-ZÅÄÖ])/, '')
    // "3 -> Grädda", an arrow before a step
    .replace(/^\d{1,2}\s*-+>\s*/, '')
    .replace(/^[•·*+«»\-–—]+\s*/, '')
    // "[3] 1 dl", which can be read as "[311 dl"
    .replace(/^\[\s*\d{1,2}?\s*[\]1lI|]\s*/, '')
    .replace(/^(?:moment|steg|step|fas)\s*\d+\s*[:.)>-]?\s*/i, '')
    .replace(/^\(\d{1,2}\)\s*/, '')
    .replace(/^\d{1,2}\s*[.)]\s+/, '')
    // Signs left in front once the mark is gone ("STEP 1> Smula")
    .replace(/^[^\p{L}\p{N}½¼¾⅓⅔(\[]+/u, '')
    .trim();
}

/**
 * Tesseract rarely reads ½: it becomes "Ve", "¥", "%", "34" or goes missing. An ingredient that
 * starts with its unit, or with such a sign before the unit, or with an amount far too big for a
 * spoon or decilitre, most likely had ½ there.
 */
function fixFraction(text: string): string {
  const unit = '(?:dl|msk|tsk|krm|cl|ml|l|liter|kg|g|st|burk|pkt|förp)\\b';
  return text
    // "6 d1 mjölk"
    .replace(/^([\d½]+\s*)d1\b/i, '$1dl')
    // "05 dl", where the comma of 0,5 was not read
    .replace(/^0(\d)\s+(?=(?:dl|msk|tsk|krm|l|kg)\b)/i, '0,$1 ')
    // "132 dl" and "234 dl": 1 ½ and 2 ½, where ½ was read as 32 or 34
    .replace(/^([1-9])(?:32|34|72|74|12|14)\s+(dl|msk|tsk|krm)\b/i, '$1 ½ $2')
    // "1% dl", "1 & DL": 1 ½
    .replace(new RegExp(`^(\\d)\\s*[%&¥]\\s*(?=${unit})`, 'i'), '$1 ½ ')
    // "| tsk", "l tsk": 1
    .replace(new RegExp(`^[lI|]\\s+(?=${unit})`, 'i'), '1 ')
    // "PA] tsk", what is left of "[½] tsk"
    .replace(new RegExp(`^[A-Za-z]{1,3}\\]\\s*(?=${unit})`, 'i'), '½ ')
    .replace(/^(\d)\s*st(?=[a-zåäö])/i, '$1 st ')
    .replace(new RegExp(`^(\\d+\\s+)?(?:ve|vz|v2|ye|y2|ya|[¥%]{1,2}|vy|\\/2|1\\/2)\\s*(?=${unit})`, 'i'), (_m, whole?: string) => `${whole || ''}½ `)
    .replace(new RegExp(`^(?=${unit})`, 'i'), '½ ')
    .replace(/^(\d{2})\s+(dl|msk|tsk|krm)\b/i, (m, n: string, u: string) => (parseInt(n, 10) >= 20 ? `½ ${u}` : m));
}

/** Capitals only ("BRED ÖVER DEN SVALA KAKAN") as ordinary text */
const sentenceCase = (text: string) =>
  isAllCaps(text) && text.split(/\s+/).length >= 2
    ? text.toLowerCase().replace(/^([^a-zåäö]*)([a-zåäö])/, (_m, pre: string, c: string) => pre + c.toUpperCase())
    : text;

type Kind = 'ingredient' | 'step' | 'unknown';

function guessKind(item: string): Kind {
  // A step in a timeline: "5-15 MIN Vispa mjöl ..."
  if (/^\d+\s*[-–]\s*\d+\s*min\b/i.test(item)) return 'step';
  const t = stripMarker(item);
  const wordsCount = t.split(/\s+/).length;
  if (/^(?:moment|steg|step|fas)\s*\d/i.test(item) || /^\(\d{1,2}\)\s/.test(item) || /^\d{1,2}\s*[.)]\s+\D/.test(item)) return 'step';
  if (STEP_VERB.test(t)) return 'step';
  if (/^[\d½¼¾⅓⅔]/.test(t) && wordsCount <= 9 && !/[.!?]$/.test(t)) return 'ingredient';
  if (/[.!?]$/.test(t) && wordsCount >= 4) return 'step';
  if (wordsCount >= 10) return 'step';
  if (wordsCount <= 6) return 'ingredient';
  return 'unknown';
}

const isHeading = (line: string) => {
  const t = line.trim();
  if (t.length < 3 || t.length > 45) return false;
  if (NEW_ITEM.test(t) && !/^del\s*\d/i.test(t)) return false;
  // A sentence ("Bryn färsen och tillsätt kryddorna.") is not a heading, whatever words it has
  if (/[.!?]$/.test(t) || STEP_VERB.test(t)) return false;
  if (INGREDIENT_HEADING.test(t) || STEP_HEADING.test(t) || OTHER_LANGUAGE.test(t) || NOTES_HEADING.test(t)) {
    // "Dressing: äggula, senap" is an ingredient with its parts, not a heading, and "råvaror (mise en"
    // in the middle of a sentence is not one either: a heading is in capitals, ends with a colon, or
    // is a few words starting with a capital
    const words = t.split(/\s+/).length;
    return !/:\s*\S+.*,/.test(t) && words <= 6 && (isAllCaps(t) || /:$/.test(t) || (/^[A-ZÅÄÖ]/.test(t) && words <= 4));
  }
  return (isAllCaps(t) || /:$/.test(t)) && !/\d/.test(t) && t.split(/\s+/).length <= 5;
};

export interface ReadBlock {
  rect: OcrRect;
  lines: OcrLine[];
}

/**
 * Puts the blocks of a page together as recipe text that parseRawRecipeText reads: the name, a
 * line with portions and time, "Ingredienser" with one ingredient per line and "Gör så här" with
 * one numbered step per line. Returns null when the page does not look like that.
 */
export function recipeTextFromBlocks(readBlocks: ReadBlock[], pageHeight: number): string | null {
  // 1. Clean lines: letter-spaced headings ("[ R A V A R O R ]") as words. A block whose lines are
  //    cells of a table ("3 TSK BAKPULVER | 3 -> GRÄDDA ...") becomes one block per column.
  const blocks: ReadBlock[] = [];
  for (const b of readBlocks) {
    const lines = b.lines.map((l) => ({
      ...l,
      text: l.text
        .replace(/(?:^|(?<=\s|\[))((?:[A-ZÅÄÖ]\s){2,}[A-ZÅÄÖ])(?=\s|\]|$)/g, (m) => m.replace(/\s/g, ''))
        .replace(/^\[\s*([^\]]{3,40}?)\s*\]$/, '$1')
        .replace(/\s+/g, ' ')
        .trim(),
    }));
    const piped = lines.filter((l) => /\s\|+\s/.test(l.text)).length;
    if (lines.length >= 3 && piped >= lines.length * 0.5) {
      const columns: OcrLine[][] = [];
      for (const l of lines) {
        l.text
          .split(/\s*\|+\s*/)
          .forEach((cell, i) => {
            if (!cell.trim()) return;
            (columns[i] ||= []).push({ ...l, text: cell.trim() });
          });
      }
      for (const col of columns) if (col?.length) blocks.push({ rect: b.rect, lines: col });
    } else blocks.push({ rect: b.rect, lines });
  }

  // A table's amount column and the food column beside it are read as one line per row
  const AMOUNT_ONLY = /^(?:ca\.?\s*)?[\d½¼¾⅓⅔]+(?:[.,]\d+)?(?:\s*[-–]\s*\d+)?\s*(?:g|kg|hg|dl|cl|ml|l|liter|msk|tsk|krm|st|burk|burkar|klyftor|skivor|kruka|knippe|förp|pkt|nypa)?\.?$/i;
  for (let i = 0; i + 1 < blocks.length; i++) {
    const a = blocks[i];
    const b = blocks[i + 1];
    const tall = median(a.lines.map((l) => l.height)) || 12;
    const amounts = a.lines.filter((l) => AMOUNT_ONLY.test(l.text));
    if (amounts.length < 3 || amounts.length < a.lines.length * 0.7) continue;
    if (b.rect.left <= a.rect.left) continue;
    const pairs = amounts.map((l) => b.lines.find((m) => Math.abs(m.top - l.top) < tall * 0.7));
    if (pairs.filter(Boolean).length < amounts.length * 0.7) continue;
    const merged = b.lines.map((m) => {
      const k = pairs.indexOf(m);
      return k >= 0 ? { ...m, left: amounts[k].left, text: `${amounts[k].text} ${m.text}` } : m;
    });
    // Lines that are not amounts (portions and time above the table), and amounts without a food
    // beside them, stay as they are
    a.lines.forEach((l) => {
      const k = amounts.indexOf(l);
      if (k < 0 || !pairs[k]) merged.push(l);
    });
    merged.sort((x, y) => x.top - y.top);
    blocks.splice(i, 2, { rect: { ...b.rect, left: a.rect.left, width: b.rect.left + b.rect.width - a.rect.left }, lines: merged });
  }

  const allLines = blocks.flatMap((b) => b.lines.filter((l) => /[a-zåäö]{2,}|\d/i.test(l.text)));
  if (allLines.length === 0) return null;
  const h = median(allLines.map((l) => l.height)) || 12;

  // 2. The name: the biggest text in the upper part of the page, not a page header or a heading
  const candidates = allLines.filter(
    (l) =>
      l.top < pageHeight * 0.6 &&
      !NOISE_START.test(l.text) &&
      /[a-zåäö]{3,}/i.test(l.text) &&
      l.text.split(/\s+/).length <= 10 &&
      // A name starts with a capital letter (a line from an introduction often does not)
      !/^[a-zåäö]/.test(l.text) &&
      !(isHeading(l.text) && (INGREDIENT_HEADING.test(l.text) || STEP_HEADING.test(l.text)))
  );
  const title = candidates.sort((a, b) => b.height - a.height)[0];
  if (!title || title.height < h * 1.3) return null;
  const titleText = title.text
    // "INDEX-KORT: Stekt strömming", "ARKIVERAT DOKUMENT: Falafel": a label before the name
    .replace(/^[A-ZÅÄÖ][A-ZÅÄÖ-]{2,20}(?:\s+[A-ZÅÄÖ][A-ZÅÄÖ-]{2,20})?:\s+(?=\S+\s+\S+)/u, '')
    // "Smashade Hamburgare / Swedish Dish": the name in English after a slash
    .replace(/\s+[\/|I]\s+(?=[A-Z][a-z]+(?:\s+[A-Z]?[a-z]+)*\s*$)(.*)$/, (m, rest: string) =>
      /\b(?:dish|recipe|style|swedish|with|and|the|of)\b/i.test(rest) ? '' : m
    )
    .trim();
  const below = (l: OcrLine) => l.top >= title.top - h * 0.3;
  // Portions and time sit right under the name
  const nearTitle = (top: number) => top <= title.bottom + title.height * 4;

  // 3. Lines into items, block by block: a wrapped line continues the item above it
  interface Item {
    text: string;
    top: number;
    bottom: number;
  }
  const blockItems: { block: ReadBlock; items: Item[]; hasTitle: boolean }[] = [];
  for (const block of blocks) {
    const lines = block.lines.filter((l) => below(l) && l !== title && /[a-zåäö]{2,}|[\d½¼¾]/i.test(l.text));
    if (lines.length === 0) continue;
    const width = Math.max(...lines.map((l) => l.right - l.left));
    const lineHeight = median(lines.map((l) => l.height)) || h;
    const items: Item[] = [];
    let prev: OcrLine | null = null;
    for (const line of lines) {
      const text = line.text;
      const gap = prev ? line.top - prev.bottom : Infinity;
      const prevText = items.length ? items[items.length - 1].text : '';
      const continues =
        prev !== null &&
        gap < lineHeight * 1.2 &&
        !NEW_ITEM.test(text) &&
        !/[.!?:]$/.test(prevText) &&
        !isHeading(text) &&
        !isHeading(prevText) &&
        // Only after a line that fills the column, and not when the line starts with a unit
        // ("tsk salt" whose ½ was not read is its own ingredient)
        (prev.right - prev.left > width * 0.5 || /\s(?:och|i|med|till|på|av|att|det|en|ett|som|för|tills|eller|om|under|över)$/i.test(prevText)) &&
        !(/^(?:dl|msk|tsk|krm|cl|ml|g|kg|st)\b/i.test(text) && !/\d$/.test(prevText)) &&
        (/^[a-zåäö(]/.test(text) ||
          (/^\d/.test(text) && prevText.split(' ').length >= 4) ||
          // Text in capitals only: a wrapped line starts with a capital too
          (isAllCaps(text) && isAllCaps(prevText) && /[,a-zåäö]$/i.test(prevText) && !/^\d+\s*-+>/.test(text)));
      if (continues) {
        items[items.length - 1].text += ' ' + text;
        items[items.length - 1].bottom = line.bottom;
      } else items.push({ text, top: line.top, bottom: line.bottom });
      prev = line;
    }
    blockItems.push({ block, items, hasTitle: block.lines.includes(title) });
  }

  // A step mark in the middle of a line starts a new item: "4 DL RIVNA MORÖTTER 5 -> BRED ÖVER"
  for (const bi of blockItems) {
    bi.items = bi.items.flatMap((it) => it.text.split(/\s+(?=\d{1,2}\s*-+>\s)/).map((text) => ({ ...it, text })));
  }

  // 4. The same note in brackets after most ingredients ("(ursprung Sverige, rekommenderas ...)")
  const notes = new Map<string, number>();
  for (const { items } of blockItems) {
    for (const it of items) {
      for (const m of it.text.matchAll(/\(([^)]{15,})\)?/g)) {
        const k = m[1].slice(0, 20).toLowerCase();
        notes.set(k, (notes.get(k) || 0) + 1);
      }
    }
  }
  const repeated = [...notes].filter(([, n]) => n >= 3).map(([k]) => k);
  if (repeated.length) {
    for (const { items } of blockItems) {
      for (const it of items) {
        it.text = it.text
          .replace(/\s*\(([^)]{15,})(?:\)|$)/g, (m, inner: string) => (repeated.includes(inner.slice(0, 20).toLowerCase()) ? '' : m))
          .trim();
      }
    }
  }

  // 5. Each item as part of the name's line (portions, time), an ingredient or a step
  const noiseBlocks: OcrRect[] = [];
  const metaLines: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];
  for (const { block, items, hasTitle } of blockItems) {
    // A box whose text goes on in a block beside it ("Fett 28 g" to the right of "NÄRINGSVÄRDE ...")
    if (noiseBlocks.some((n) => block.rect.left > n.left + n.width * 0.5 && Math.abs(block.rect.top - n.top) < h * 2.5)) continue;

    // Leave out boxes around the recipe: a paragraph that starts with one of their labels
    const kept: Item[] = [];
    let skipping = false;
    let lastBottom = -Infinity;
    for (const item of items) {
      const newParagraph = item.top - lastBottom > h * 0.9;
      lastBottom = item.bottom;
      if (NOISE_START.test(item.text) && !/\b\d+\s*(?:portioner|portion|personer)\b/i.test(item.text)) {
        skipping = true;
        if (item === items[0]) noiseBlocks.push(block.rect);
        continue;
      }
      if (skipping && !newParagraph) continue;
      skipping = false;
      // An introduction in quotation marks ("» En omistlig och älskad rätt ... «")
      if (/^[»«"„”]/.test(item.text) && /[»«"”]$/.test(item.text) && item.text.split(/\s+/).length >= 6) continue;
      kept.push(item);
    }

    let current: Kind = 'unknown';
    let otherLanguage = false;
    const found: { text: string; kind: Kind }[] = [];
    for (const { text, top } of kept) {
      const hasTime = /\b\d+\s*(?:min|minuter|tim|timmar|timme|h)\b/i.test(text);
      if (hasTitle && nearTitle(top) && (hasTime || (/\b\d+\s*(?:portion|port|pers|personer|bitar)\b/i.test(text) && !NEW_ITEM.test(text)))) {
        metaLines.push(text);
        continue;
      }
      if (
        (/\b\d+\s*(?:portion|portioner|personer|pers|bitar|st)\b/i.test(text) ||
          // "Frukost | 4 scones 20 min" right under the name, not a step that mentions minutes
          (nearTitle(top) && !NEW_ITEM.test(text) && !STEP_VERB.test(stripMarker(text)) && !/[.!?]$/.test(text) && text.split(/\s+/).length <= 10)) &&
        /\b\d+\s*(?:min|tim)/i.test(text) &&
        text.split(/\s+/).length <= 14
      ) {
        metaLines.push(text);
        continue;
      }
      if (LABEL_LINE.test(text)) continue;
      // A box for converting measures ("1 msk = 15 ml", "1 dl vetemjöl = 60 g")
      if (/\d\s*[a-zåäö]*\s*=\s*\d/i.test(text)) continue;
      // An introduction in the first person ("Idag tänkte jag dela med mig ...")
      if (/\b(?:jag|mig|mitt|mina|oss)\b/i.test(text) && !STEP_VERB.test(stripMarker(text)) && text.split(/\s+/).length >= 8) continue;
      if (isHeading(text)) {
        otherLanguage = OTHER_LANGUAGE.test(text) || NOTES_HEADING.test(text.trim());
        current = STEP_HEADING.test(text) ? 'step' : INGREDIENT_HEADING.test(text) ? 'ingredient' : current;
        continue;
      }
      if (otherLanguage) continue;
      // "Råvaror i detta steg: 125 g smör, 3 dl vetemjöl" inside the steps
      const inline = text.match(/^(?:r[åa]varor|ingredienser|du behöver|det här behöver du)[^:]{0,25}:\s*(.+)$/i);
      if (inline) {
        for (const part of inline[1].split(/,\s*|;\s*/)) if (part.trim()) found.push({ text: part.trim(), kind: 'ingredient' });
        continue;
      }
      // Several ingredients on one line with bullets between them (bullets can be read as 0 or o):
      // "1 msk vaniljsocker 0 3 msk kakao 0 3 dl havregryn"
      const bulleted = text.split(/\s+[»•·+«0oO]\s+(?=[\d½¼¾]|[A-ZÅÄÖ])/);
      const amountParts = bulleted.filter((p) => /^[\d½¼¾]/.test(p)).length;
      if ((bulleted.length >= 3 && amountParts >= 2) || (bulleted.length === 2 && amountParts === 2)) {
        for (const part of bulleted) found.push({ text: part, kind: 'ingredient' });
        continue;
      }
      found.push({ text, kind: current !== 'unknown' ? current : guessKind(text) });
    }
    // Most of a block is one kind: the unclear items follow the rest
    const counts = { ingredient: 0, step: 0 };
    for (const it of found) if (it.kind !== 'unknown') counts[it.kind]++;
    const blockKind: Kind = counts.step > counts.ingredient ? 'step' : counts.ingredient > 0 ? 'ingredient' : 'unknown';
    for (const it of found) {
      let kind = it.kind === 'unknown' ? blockKind : it.kind;
      // A short line among steps is usually a label, not an ingredient
      if (blockKind === 'step' && kind === 'ingredient' && counts.ingredient === 1 && counts.step >= 2) kind = 'step';
      if (blockKind === 'ingredient' && kind === 'step' && counts.step === 1 && counts.ingredient >= 3 && guessKind(it.text) !== 'step') kind = 'ingredient';
      if (kind === 'step') steps.push(sentenceCase(stripMarker(it.text)));
      else if (kind === 'ingredient') {
        // Several ingredients on one line with bullets between them: "500 g gröt » 2 dl grädde » ..."
        const parts = it.text.split(/\s+[»•·+«]\s+(?=[\d½¼¾]|[A-ZÅÄÖ])/);
        for (const part of parts.length >= 3 ? parts : [it.text]) {
          // Two ingredients run together: "50 g hackad sötmandel 2 st rivna bittermandlar"
          const two = part.split(/\s+(?=\d+\s*(?:g|kg|dl|cl|ml|l|msk|tsk|krm|st|burk|burkar|klyftor|skivor)\s+[a-zåäö])/i);
          const both = two.length === 2 && /^[\d½¼¾]+\s*\S*\s+[a-zåäö]{3,}/i.test(stripMarker(two[0]));
          for (const one of both ? two : [part]) {
            const clean = sentenceCase(fixFraction(stripMarker(one)));
            // An amount with no food ("1 krm", "85 g") is left over from a box of measures
            if (AMOUNT_ONLY.test(clean)) continue;
            ingredients.push(clean);
          }
        }
      }
    }
  }

  // 6. The same step twice, or cut short ("Vispa ihop ägg, grädde, mjölk och k...") with the
  //    whole step elsewhere on the page: only the last whole one is kept
  const key = (s: string) => s.toLowerCase().replace(/(?:\.{2,}|…)\s*$/, '').replace(/[^a-zåäö0-9]+/g, '');
  const keys = steps.map(key);
  // Steps written as one paragraph: one step per sentence
  const sentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])/);
  if (steps.length > 0 && steps.length <= 2 && steps.some((t) => sentences(t).length >= 3)) {
    const split = steps.flatMap(sentences);
    steps.length = 0;
    steps.push(...split);
    keys.length = 0;
    keys.push(...steps.map(key));
  }
  const uniqueSteps = steps
    .filter((_, i) => keys[i].length > 0 && !keys.some((other, j) => j !== i && other.startsWith(keys[i]) && (other.length > keys[i].length || j > i)))
    .map((s) => s.replace(/\s*(?:\.{3,}|…)\s*$/, ''))
    .filter((s) => s.length > 1);

  if (ingredients.length === 0 && uniqueSteps.length === 0) return null;
  // Portions and time as the text reader expects them
  const meta = metaLines.join(' ');
  const portions = meta.match(/(\d+)\s*(?:portioner|portion|port|personer|pers|st\b|bitar|[a-zåäö]{3,12}\s*[•·»|+]|[a-zåäö]{3,12}\s+(?=\d+\s*(?:min|tim)))/i);
  const hours = meta.match(/(\d+(?:[.,]\d+)?)\s*(?:timmar|timme|tim|h)\b/i);
  const minutes = meta.match(/(\d+)\s*min/i);
  const time = (hours ? Math.round(parseFloat(hours[1].replace(',', '.')) * 60) : 0) + (minutes ? parseInt(minutes[1], 10) : 0);
  const parts = [titleText];
  if (portions) parts.push(`${portions[1]} portioner`);
  if (time > 0) parts.push(`Tid: ${time} min`);
  parts.push('', 'Ingredienser', ...ingredients, '', 'Gör så här', ...uniqueSteps.map((s, i) => `${i + 1}. ${s}`));
  return parts.join('\n');
}
