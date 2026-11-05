import type { Ingredient, Instruction, RecipeCategory } from '../types/recipe';
import { parseIngredientLine, parseRawRecipeText } from '../utils/ingredientParser';
import { detectCategory, detectSubcategory, detectSubcategories } from '../utils/categoryDetector';

export interface ScrapedRecipe {
  title: string;
  description: string;
  coverImageUrl: string;
  servings: number;
  category: RecipeCategory;
  subcategory: string;
  subcategories?: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  sourceUrl: string;
  engineUsed?: string;
}

/**
 * Smart parser for recipe durations across ISO 8601, Swedish, and international expressions.
 * Handles ISO durations ("PT30M", "PT1H15M", "PT1.5H"), compound expressions ("1 timme 15 min", "1 h 30 min"),
 * decimal hours ("1,5 timme"), pure hours ("1 timme"), ranges ("30-40 min"), and labeled formats ("Tillagningstid: 45 min").
 */
function parseRecipeTimeString(rawStr?: string | null): number | undefined {
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
 * Clean and unescape HTML text
 */
function cleanHtmlText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&frac12;/g, '½')
    .replace(/&frac14;/g, '¼')
    .replace(/&frac34;/g, '¾')
    .replace(/&deg;/g, '°')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Safe JSON parser for JSON-LD scripts that tolerates unescaped control characters (newlines, tabs)
 * in string literals emitted by CMS systems like Episerver/Optimizely (e.g. Santa Maria).
 */
function safeParseJson(raw: string): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      let inString = false;
      let escaped = false;
      let sanitized = '';
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (escaped) {
          sanitized += ch;
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          sanitized += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          sanitized += ch;
          continue;
        }
        if (inString) {
          if (ch === '\n') {
            sanitized += '\\n';
          } else if (ch === '\r') {
            sanitized += '\\r';
          } else if (ch === '\t') {
            sanitized += '\\t';
          } else if (ch.charCodeAt(0) < 32) {
            sanitized += ' ';
          } else {
            sanitized += ch;
          }
        } else {
          sanitized += ch;
        }
      }
      return JSON.parse(sanitized);
    } catch {
      return null;
    }
  }
}

/**
 * Extract an image URL from various schema.org image structures
 */
function extractImageUrl(image: any): string | null {
  if (!image) return null;
  if (typeof image === 'string') {
    if (image.startsWith('//')) return `https:${image}`;
    if (image.startsWith('http')) return image;
  }
  if (Array.isArray(image) && image.length > 0) {
    return extractImageUrl(image[0]);
  }
  if (typeof image === 'object') {
    if (image.url && typeof image.url === 'string') return extractImageUrl(image.url);
    if (image['@id'] && typeof image['@id'] === 'string') return extractImageUrl(image['@id']);
  }
  return null;
}

/**
 * Detects common anti-bot blocking splash screens (Loopia, Cloudflare, Wordfence, etc.)
 */
export function isAntiBotBlockPage(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes("you've reached a blocked page") ||
    lower.includes('hoppsan, här var det stopp') ||
    lower.includes('attention required! | cloudflare') ||
    (lower.includes('just a moment...') && lower.includes('cloudflare')) ||
    lower.includes('access denied | www.') ||
    lower.includes('enable cookies and reload the page') ||
    lower.includes('cf-browser-verification') ||
    lower.includes('ray id:') ||
    lower.includes('warning: target url returned error') ||
    lower.includes('error 404: not found')
  );
}

/**
 * Cleans recipe titles by stripping site names and blog branding suffixes.
 * E.g. "Hainanesisk kyckling med ris - Zeinas Kitchen" -> "Hainanesisk kyckling med ris"
 *      "Kanelbullar med äpple | Brinken Bakar" -> "Kanelbullar med äpple"
 */
export function cleanRecipeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = cleanHtmlText(rawTitle);

  // If it's an error or 404 title, return empty string
  const normalized = title.replace(/[🍅\u200B-\u200D\uFEFF]/g, '0').toLowerCase();
  if (
    normalized.includes('sidan hittades inte') ||
    normalized.includes('hittades inte') ||
    normalized.includes('404') ||
    normalized.includes('page not found') ||
    normalized.includes('felaktig adress') ||
    normalized.includes('kunde inte hittas')
  ) {
    return '';
  }

  // Remove common Swedish blog suffixes and domain tags
  title = title
    .replace(/\s*[-–|•]\s*(?:Zeinas Kitchen|Brinken Bakar|Victorias Provkök|Lindas Bakskola|Fredriks Fika|Underbara Clara|Landleys Kök|Mitt Kök|Köket\.se|ICA|Arla|Coop|Tasteline|Allt om Mat|Recept\.se|Allas\.se|Recept).*$/i, '')
    .replace(/\s*[-–|•]\s*[a-zA-Z0-9-]+\.(?:se|com|nu|org|net)\b.*$/i, '')
    .replace(/\s*\|.*$/, '')
    .trim();

  return title || cleanHtmlText(rawTitle);
}

/**
 * Parse servings number from string, number, or array.
 * Supports ranges ("4-6 portioner" -> 5), and items ("ca 20 st" -> 20).
 */
function parseServings(yieldVal: any): number {
  if (!yieldVal) return 4;
  if (typeof yieldVal === 'number') return Math.max(1, Math.min(yieldVal, 50));
  if (Array.isArray(yieldVal) && yieldVal.length > 0) {
    return parseServings(yieldVal[0]);
  }
  if (typeof yieldVal === 'string') {
    const rangeMatch = yieldVal.match(/(\d+)\s*(?:-|–|till)\s*(\d+)/);
    if (rangeMatch) {
      return Math.round((parseInt(rangeMatch[1], 10) + parseInt(rangeMatch[2], 10)) / 2);
    }
    const match = yieldVal.match(/(\d+)/);
    if (match) return Math.max(1, Math.min(parseInt(match[1], 10), 50));
  }
  return 4;
}

/**
 * Extracts servings from DOM elements or meta tags.
 */
function extractServingsFromDom(doc: Document): number {
  const selectors = [
    '[itemprop="recipeYield"]',
    '.wprm-recipe-servings',
    '.tasty-recipes-yield',
    '.pwl-recipe-yield',
    '.recipe-servings',
    '[class*="servings"]',
    '[class*="recipe-yield"]',
    '[data-test="recipe-servings"]',
  ];
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        const text = el.getAttribute('content') || el.textContent;
        if (text) {
          const parsed = parseServings(text);
          if (parsed > 0) return parsed;
        }
      }
    } catch {}
  }

  // Check header text or article intro for portion statements (e.g. "6 port", "4 portioner")
  try {
    const candidateElements = doc.querySelectorAll('header p, header span, .recipe-header p, .meta span, article p:first-of-type, .entry-content p:first-of-type');
    for (const el of Array.from(candidateElements)) {
      const text = el.textContent?.trim();
      if (text && text.length < 100 && /(?:\b\d+\s*(?:port|portion|bitar|bit|pers|personer|st|pannkakor|klubbor)\b)/i.test(text)) {
        const parsed = parseServings(text);
        if (parsed > 0) return parsed;
      }
    }
  } catch {}

  return 4;
}

/**
 * Extracts the best high-resolution cover image from DOM, checking plugin selectors and article figures.
 */
function extractBestCoverImageFromDom(doc: Document): string | null {
  // 1. Check og:image or twitter:image
  const metaImages = [
    doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content'),
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content'),
  ].filter(Boolean) as string[];

  for (const imgUrl of metaImages) {
    const low = imgUrl.toLowerCase();
    if (!low.includes('logo') && !low.includes('favicon') && !low.includes('default') && !low.includes('banner')) {
      return imgUrl;
    }
  }

  // 2. Check recipe plugin images
  const pluginImgSelectors = [
    '.wprm-recipe-image img',
    '.tasty-recipes-image img',
    '.pwl-recipe-image img',
    '.mv-create-image img',
    '[itemprop="image"]',
  ];
  for (const sel of pluginImgSelectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        const src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-orig-file') || el.getAttribute('content');
        if (src && src.startsWith('http')) return src;
      }
    } catch {}
  }

  // 3. Check high-resolution images in article / entry-content / figure
  try {
    const contentImages = doc.querySelectorAll('article img, .entry-content img, .post-content img, figure.wp-block-image img, main img');
    for (const img of Array.from(contentImages)) {
      const src =
        img.getAttribute('data-orig-file') ||
        img.getAttribute('data-large-file') ||
        img.getAttribute('data-src') ||
        img.getAttribute('src');
      if (!src || !src.startsWith('http')) continue;

      const low = src.toLowerCase();
      if (
        low.includes('avatar') ||
        low.includes('logo') ||
        low.includes('icon') ||
        low.includes('banner') ||
        low.includes('badge') ||
        low.endsWith('.svg')
      ) {
        continue;
      }

      return src;
    }
  } catch {}

  if (metaImages.length > 0) return metaImages[0];
  return null;
}

/**
 * Cleans instruction step text by stripping leading numbers, bullets, dashes, checkboxes, and markdown artifacts.
 * E.g. "7. - [x] Toppa med persilja" -> "Toppa med persilja"
 *      "- Stek kycklingen" -> "Stek kycklingen"
 */
export function cleanLeadingStepNumber(text: string): string {
  if (!text) return '';

  return text
    // 1. Strip markdown images and HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/<[^>]+>/g, '')
    // 2. Strip markdown links keeping inner text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // 3. Strip checkbox markers: [x], [ ], [X], etc. anywhere in line
    .replace(/\[[ xX✓✔☑☐\s]*\]/g, '')
    // 4. Strip leading numbers like "1. ", "1) ", "Steg 1: ", "1 - "
    .replace(/^(?:[sS]teg|[sS]tep)?\s*\d{1,2}\s*[:\.\-–\)]\s*/, '')
    // 5. Strip leading bullets, dashes, dots, stars (e.g. "- ", "• ", "* ", "– ", "— ")
    .replace(/^[•\-\*–—\+\.]+\s*/, '')
    // 6. Strip leading numbers again if formatted as "- 1. "
    .replace(/^(?:[sS]teg|[sS]tep)?\s*\d{1,2}\s*[:\.\-–\)]\s*/, '')
    // 7. Strip leading dashes again in case of "1. - "
    .replace(/^[•\-\*–—\+\.]+\s*/, '')
    .trim();
}

/**
 * Splits raw instruction text into distinct individual steps.
 */
function splitStepText(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const steps: string[] = [];

  // 1. If HTML tags are present
  if (/<(li|p|div|br\s*\/?)>/i.test(rawText)) {
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(`<div>${rawText}</div>`, 'text/html');

    const listItems = tempDoc.querySelectorAll('li');
    if (listItems.length > 0) {
      listItems.forEach((li) => {
        const text = cleanHtmlText(li.textContent || '');
        if (text && text.length > 3) steps.push(text);
      });
    }

    if (steps.length === 0) {
      const pItems = tempDoc.querySelectorAll('p');
      if (pItems.length > 0) {
        pItems.forEach((p) => {
          const text = cleanHtmlText(p.textContent || '');
          if (text && text.length > 3) steps.push(text);
        });
      }
    }

    if (steps.length === 0) {
      const parts = rawText.split(/<br\s*\/?>/i);
      parts.forEach((part) => {
        const text = cleanHtmlText(part);
        if (text && text.length > 3) steps.push(text);
      });
    }

    if (steps.length > 0) {
      return steps.map(cleanLeadingStepNumber);
    }
  }

  // 2. Split on newlines if text has line breaks
  if (rawText.includes('\n')) {
    const lines = rawText.split(/\r?\n+/);
    for (const line of lines) {
      const cleaned = cleanHtmlText(line);
      if (cleaned && cleaned.length > 3) {
        if (/(?:^|\s)\d+[\.\)]\s+/.test(cleaned)) {
          const subSteps = splitNumberedSteps(cleaned);
          steps.push(...subSteps);
        } else {
          steps.push(cleaned);
        }
      }
    }
    if (steps.length > 0) {
      return steps.map(cleanLeadingStepNumber);
    }
  }

  // 3. Split by numbered bullets
  if (/(?:^|\s)(?:\d+[.)]|[sS]teg\s+\d+[:.]?)\s+/.test(rawText)) {
    const numbered = splitNumberedSteps(rawText);
    if (numbered.length > 0) {
      return numbered.map(cleanLeadingStepNumber);
    }
  }

  const finalClean = cleanHtmlText(rawText);
  return finalClean ? [cleanLeadingStepNumber(finalClean)] : [];
}

function splitNumberedSteps(text: string): string[] {
  const parts = text.split(/(?:^|\s+)(?=(?:\d{1,2}[.)]|[sS]teg\s+\d{1,2}[:.]?)\s+)/);
  const result: string[] = [];

  for (const part of parts) {
    const cleaned = cleanHtmlText(part);
    if (cleaned && cleaned.length > 3) {
      result.push(cleaned);
    }
  }

  return result;
}

/**
 * Extract instructions recursively from JSON-LD schema
 */
function extractInstructionsFromJsonLd(rawInstructions: any): Instruction[] {
  if (!rawInstructions) return [];

  const rawStepStrings: string[] = [];

  function traverse(item: any) {
    if (!item) return;

    if (typeof item === 'string') {
      rawStepStrings.push(item);
    } else if (Array.isArray(item)) {
      item.forEach(traverse);
    } else if (typeof item === 'object') {
      if (item.itemListElement) {
        traverse(item.itemListElement);
      } else if (item.text) {
        rawStepStrings.push(item.text);
      } else if (item.description) {
        rawStepStrings.push(item.description);
      } else if (item.name) {
        rawStepStrings.push(item.name);
      }
    }
  }

  traverse(rawInstructions);

  const flatSteps: string[] = [];
  for (const str of rawStepStrings) {
    const parsedSteps = splitStepText(str);
    flatSteps.push(...parsedSteps);
  }

  return flatSteps.map((text, idx) => ({
    stepNumber: idx + 1,
    text: cleanLeadingStepNumber(text),
  }));
}

/**
 * Helper to check if a text line looks like a potential ingredient or food component
 */
function isPotentialIngredientLine(text: string): boolean {
  if (!text || text.length < 2 || text.length > 90) return false;
  const low = text.toLowerCase().trim();
  if (
    low.includes('cookie') ||
    low.includes('privacy') ||
    low.includes('policy') ||
    low.includes('logga in') ||
    low.includes('skriv ut') ||
    low.includes('dela recept') ||
    low.includes('betygsätt') ||
    low.includes('lämna en kommentar') ||
    low.includes('relaterade inlägg') ||
    low === 'av' ||
    low === 'på' ||
    low.includes('opted') ||
    // Reject markdown links (almost always navigation or social links)
    /\[.*?\]\(https?:\/\/[^\s)]*\)/i.test(text) ||
    // Reject date patterns (e.g. "20 april, 2026", "17 maj 2024")
    /\b(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/i.test(low)
  ) {
    return false;
  }
  const parsed = parseIngredientLine(text);
  if (!parsed) return false;
  if (parsed.amount !== null && (parsed.unit || parsed.name.length > 2)) return true;
  const commonUnmeasured = [
    'salt', 'peppar', 'svartpeppar', 'vitpeppar', 'flingsalt', 'olja', 'rapsolja',
    'olivolja', 'smör', 'vatten', 'koriander', 'persilja', 'dill', 'gräslök',
    'topping', 'garnering', 'soja', 'sesamolja', 'is', 'salladslök', 'gurka'
  ];
  return commonUnmeasured.some((k) => parsed.name.toLowerCase().includes(k));
}

/**
 * Extracts ingredients from semantic headings (e.g. <h3>Ingredienser</h3> or <strong>Du behöver:</strong>)
 * and their following siblings (<ul>, <ol>, or <p> with <br> tags).
 * Handles personal blogs and smaller sites (Zeinas Kitchen, Victoria's Provkök, etc.).
 */
function extractIngredientsFromSemanticHeadings(doc: Document): Ingredient[] {
  const headingSelectors = 'h1, h2, h3, h4, h5, h6, p strong, div strong, p b, div b, .heading, [class*="heading"], [class*="title"]';
  const headings = Array.from(doc.querySelectorAll(headingSelectors));

  const isIngHeading = (text: string) => {
    const clean = text.replace(/[*_#`~:]/g, '').trim().toLowerCase();
    return (
      /^(?:ingredienser|du behöver|det här behöver du|detta behöver du|det behöver du|vad du behöver|innehåll|ingrediens|ingredients)(?:\s*\(.*?\))?$/i.test(clean) ||
      clean.startsWith('ingredienser till') ||
      clean.startsWith('det här behöver du')
    );
  };

  const isInstHeading = (text: string) => {
    const clean = text.replace(/[*_#`~:]/g, '').trim().toLowerCase();
    return (
      /^(?:gör så här|gör såhär|så här gör du|så gör du|tillagning|instruktioner|instruktion|arbetsgång|tillredning|beredning|metod|directions|instructions|method|preparation)(?:\s*\(.*?\))?$/i.test(clean) ||
      clean.startsWith('gör så här') ||
      clean.startsWith('gör såhär') ||
      clean.startsWith('så här gör du') ||
      clean.startsWith('så gör du')
    );
  };

  for (const heading of headings) {
    const headingText = heading.textContent || '';
    if (!isIngHeading(headingText)) continue;

    const collected: Ingredient[] = [];

    // Case A: Inside the parent element itself (e.g. <p><strong>Ingredienser:</strong><br>400g...<br>...</p>)
    const parent = heading.parentElement;
    if (parent && (parent.tagName.toLowerCase() === 'p' || parent.tagName.toLowerCase() === 'div')) {
      const parentHtml = parent.innerHTML;
      if (/<br\s*\/?>/i.test(parentHtml)) {
        const parts = parentHtml.split(/<br\s*\/?>/i);
        for (const part of parts) {
          const cleanPart = cleanHtmlText(part);
          if (cleanPart && !isIngHeading(cleanPart) && isPotentialIngredientLine(cleanPart)) {
            const parsed = parseIngredientLine(cleanPart);
            if (parsed) collected.push(parsed);
          }
        }
      }
    }

    // Case B: Traversing following sibling elements
    let sibling: Element | null = parent && parent.tagName.toLowerCase() === 'p'
      ? parent.nextElementSibling
      : heading.nextElementSibling;

    let iterations = 0;
    while (sibling && iterations < 30) {
      iterations++;
      const tag = sibling.tagName.toLowerCase();
      const sibText = sibling.textContent || '';

      // Stop if we hit instructions heading
      if (isInstHeading(sibText)) break;

      // Stop if we hit a major article heading that is NOT an ingredient subhead
      if (/^h[1-3]$/.test(tag) && !sibText.toLowerCase().includes('till') && !sibText.toLowerCase().includes('sås') && !sibText.toLowerCase().includes('deg')) {
        break;
      }

      // Stop if reaching comment / footer sections
      const sibLow = sibText.toLowerCase();
      if (sibLow.includes('lämna en kommentar') || sibLow.includes('relaterade inlägg') || sibLow.includes('om författaren')) {
        break;
      }

      // 1. Unordered / ordered list
      if (tag === 'ul' || tag === 'ol') {
        const lis = sibling.querySelectorAll('li');
        lis.forEach((li) => {
          const text = cleanHtmlText(li.textContent || '');
          if (isPotentialIngredientLine(text)) {
            const parsed = parseIngredientLine(text);
            if (parsed) collected.push(parsed);
          }
        });
      }
      // 2. Paragraph or Div with <br> or single ingredient line
      else if (tag === 'p' || tag === 'div') {
        if (/<br\s*\/?>/i.test(sibling.innerHTML)) {
          const parts = sibling.innerHTML.split(/<br\s*\/?>/i);
          for (const part of parts) {
            const cleanPart = cleanHtmlText(part);
            if (isPotentialIngredientLine(cleanPart)) {
              const parsed = parseIngredientLine(cleanPart);
              if (parsed) collected.push(parsed);
            }
          }
        } else {
          const cleanText = cleanHtmlText(sibText);
          if (isPotentialIngredientLine(cleanText)) {
            const parsed = parseIngredientLine(cleanText);
            if (parsed) collected.push(parsed);
          }
        }
      }

      sibling = sibling.nextElementSibling;
    }

    if (collected.length >= 2) {
      return collected;
    }
  }

  return [];
}

/**
 * Extracts instructions from semantic headings (e.g. <h3>Gör så här</h3> or <strong>Så här gör du:</strong>)
 * and their following siblings (<ol>, <ul>, or <p> tags).
 */
function extractInstructionsFromSemanticHeadings(doc: Document): Instruction[] {
  const headingSelectors = 'h1, h2, h3, h4, h5, h6, p strong, div strong, p b, div b, .heading, [class*="heading"], [class*="title"]';
  const headings = Array.from(doc.querySelectorAll(headingSelectors));

  const isInstHeading = (text: string) => {
    const clean = text.replace(/[*_#`~:]/g, '').trim().toLowerCase();
    return (
      /^(?:gör så här|gör såhär|så här gör du|så gör du|tillagning|instruktioner|instruktion|arbetsgång|tillredning|beredning|metod|directions|instructions|method|preparation)(?:\s*\(.*?\))?$/i.test(clean) ||
      clean.startsWith('gör så här') ||
      clean.startsWith('gör såhär') ||
      clean.startsWith('så här gör du') ||
      clean.startsWith('så gör du')
    );
  };

  const stopPhrases = [
    'var receptet gott', 'vad tyckte du', 'kommentera', 'tipsa eller fråga',
    'betygsätt', 'fler recept', 'liknande recept', 'relaterade recept',
    'relaterade inlägg', 'om författaren', 'lämna en kommentar', 'dela recept',
    'publicerad i', 'kategorier', 'skriv ut', 'klimatguiden', 'näringsvärde',
    'dela på facebook', 'följ på instagram'
  ];

  for (const heading of headings) {
    const headingText = heading.textContent || '';
    if (!isInstHeading(headingText)) continue;

    const collectedSteps: string[] = [];

    // Case A: Initial text right inside the parent element (e.g. <p><strong>Gör såhär:</strong><br>Börja med att...<br><br>...</p>)
    const parent = heading.parentElement;
    if (parent && (parent.tagName.toLowerCase() === 'p' || parent.tagName.toLowerCase() === 'div')) {
      const parentHtml = parent.innerHTML;
      if (/<br\s*\/?>/i.test(parentHtml)) {
        const parts = parentHtml.split(/<br\s*\/?>/i);
        for (const part of parts) {
          const cleanPart = cleanHtmlText(part);
          if (cleanPart && !isInstHeading(cleanPart) && cleanPart.length > 10) {
            const split = splitStepText(cleanPart);
            collectedSteps.push(...split);
          }
        }
      }
    }

    // Case B: Traversing sibling elements
    let sibling: Element | null = parent && parent.tagName.toLowerCase() === 'p'
      ? parent.nextElementSibling
      : heading.nextElementSibling;

    let iterations = 0;
    while (sibling && iterations < 30) {
      iterations++;
      const tag = sibling.tagName.toLowerCase();
      const sibText = cleanHtmlText(sibling.textContent || '');
      const sibLow = sibText.toLowerCase();

      if (stopPhrases.some((p) => sibLow.includes(p))) {
        break;
      }
      if (/^h[1-2]$/.test(tag) && !isInstHeading(sibText)) {
        break;
      }

      // 1. Ordered or unordered list
      if (tag === 'ol' || tag === 'ul') {
        const lis = sibling.querySelectorAll('li');
        lis.forEach((li) => {
          const text = cleanHtmlText(li.textContent || '');
          if (text && text.length > 5) {
            const split = splitStepText(text);
            collectedSteps.push(...split);
          }
        });
      }
      // 2. Paragraphs or Divs
      else if (tag === 'p' || tag === 'div') {
        if (sibText.length > 10) {
          const split = splitStepText(sibText);
          collectedSteps.push(...split);
        }
      }

      sibling = sibling.nextElementSibling;
    }

    if (collectedSteps.length >= 2) {
      return collectedSteps.map((text, idx) => ({
        stepNumber: idx + 1,
        text: cleanLeadingStepNumber(text),
      }));
    }
  }

  return [];
}

/**
 * Extract instructions from DOM elements (Fallback & Enhancement for ICA, Köket, Tasteline, WordPress blogs, etc.)
 */
function extractInstructionsFromDom(doc: Document): Instruction[] {
  // 1. Check Recipe Plugins and known class selectors
  const stepSelectors = [
    // WordPress plugins (WP Recipe Maker, PWL, Tasty Recipes, Mediavine Create, Cooked, EasyRecipe)
    '.wprm-recipe-instruction',
    '.wprm-recipe-instruction-text',
    '.wprm-recipe-instructions li',
    '.pwl-recipe-instruction',
    '.pwl-recipe-instructions li',
    '.pwl-recipe-column--instructions li',
    '.tasty-recipes-instructions li',
    '.tasty-recipe-instructions li',
    '.tasty-recipes-instructions p',
    '.mv-create-instructions li',
    '.mv-create-instructions p',
    '.cooked-recipe-directions li',
    '.cooked-recipe-instruction',
    '.easyrecipe .instruction',
    '.recipe-card-instruction',
    '.schema-recipe-instructions',
    '[class*="wprm-recipe-instruction"]',
    '[class*="pwl-recipe-instruction"]',
    '[class*="tasty-recipes-instruction"]',
    '[class*="mv-create-instruction"]',
    // Swedish recipe sites specific
    '.recipe-howto__step',
    '.recipe-instructions__step',
    '[data-test="instruction-step"]',
    '.recipe__instruction-step',
    '.recipe-instruction-step',
    '.recipe-step',
    '.step-item',
    '.recipe-instruction-item',
    '[class*="instruction-step"]',
    '[class*="instructionStep"]',
    '[class*="recipe-step"]',
    '[class*="recipeStep"]',
    '[class*="step-text"]',
    '[class*="stepText"]',
    // Standard schema / generic markup
    '[itemprop="recipeInstructions"] li',
    '[itemprop="recipeInstructions"] p',
    'ol.instructions li',
    'ul.instructions li',
    'ol.recipe-instructions li',
    'ul.recipe-instructions li',
    '.recipe-instructions li',
    '.instructions-list li',
    '.recipe-steps li',
    '[class*="instructions"] ol li',
    '[class*="instructions"] ul li',
    '[class*="directions"] ol li',
  ];

  for (const selector of stepSelectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      if (elements && elements.length >= 2) {
        const steps: string[] = [];
        elements.forEach((el) => {
          const text = cleanHtmlText(el.textContent || '');
          if (text && text.length > 3) {
            const split = splitStepText(text);
            steps.push(...split);
          }
        });

        if (steps.length >= 2) {
          return steps.map((text, idx) => ({
            stepNumber: idx + 1,
            text: cleanLeadingStepNumber(text),
          }));
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Semantic headings & sibling lists/paragraphs (For smaller blogs)
  const semantic = extractInstructionsFromSemanticHeadings(doc);
  if (semantic.length >= 2) {
    return semantic;
  }

  // 3. Fallback: Parse main article content text heuristically
  try {
    const article = doc.querySelector('article, .entry-content, .post-content, .recipe-content, main');
    if (article) {
      const parsedText = parseRawRecipeText(article.textContent || '');
      if (parsedText && parsedText.instructions.length >= 2) {
        return parsedText.instructions;
      }
    }
  } catch {}

  return [];
}

/**
 * Extract ingredients from DOM elements (Fallback & Enhancement)
 */
function extractIngredientsFromDom(doc: Document): Ingredient[] {
  // 1. Check Recipe Plugins and known class selectors
  const ingredientSelectors = [
    // WordPress plugins (WP Recipe Maker, PWL, Tasty Recipes, Mediavine Create, Cooked, EasyRecipe)
    '.wprm-recipe-ingredient',
    '.wprm-recipe-ingredients li',
    '.pwl-recipe-ingredient',
    '.pwl-recipe-ingredients > div',
    '.pwl-recipe-column--ingredients li',
    '.tasty-recipes-ingredients li',
    '.tasty-recipe-ingredients li',
    '.mv-create-ingredients li',
    '.cooked-recipe-ingredients li',
    '.easyrecipe .ingredient',
    '.recipe-card-ingredient',
    '.schema-recipe-ingredient',
    '[class*="wprm-recipe-ingredient"]',
    '[class*="pwl-recipe-ingredient"]',
    '[class*="tasty-recipes-ingredient"]',
    '[class*="mv-create-ingredient"]',
    // Standard schema / microdata
    '[itemprop="recipeIngredient"]',
    '[itemprop="ingredients"]',
    '.recipe-ingredient',
    '.recipe-ingredients__item',
    '.ingredient-list li',
    '.ingredients-list li',
    '[data-test="ingredient-item"]',
    '[data-test="ingredient"]',
    '[class*="ingredient-item"]',
    '[class*="ingredientItem"]',
    '[class*="recipe-ingredient"]',
    'ul.recipe-ingredients li',
    'ul.ingredients li',
    '.ingredients li',
  ];

  for (const selector of ingredientSelectors) {
    try {
      const elements = doc.querySelectorAll(selector);
      if (elements && elements.length >= 2) {
        const ingredients: Ingredient[] = [];
        elements.forEach((el) => {
          const text = cleanHtmlText(el.textContent || '');
          if (text && text.length > 1) {
            const parsed = parseIngredientLine(text);
            if (parsed) ingredients.push(parsed);
          }
        });

        if (ingredients.length >= 2) {
          return ingredients;
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Semantic headings & sibling lists/paragraphs (For smaller blogs like Zeinas Kitchen, Victoria's Provkök)
  const semantic = extractIngredientsFromSemanticHeadings(doc);
  if (semantic.length >= 2) {
    return semantic;
  }

  // 3. Fallback: Parse main article content text heuristically
  try {
    const article = doc.querySelector('article, .entry-content, .post-content, .recipe-content, main');
    if (article) {
      const parsedText = parseRawRecipeText(article.textContent || '');
      if (parsedText && parsedText.ingredients.length >= 2) {
        return parsedText.ingredients;
      }
    }
  } catch {}

  return [];
}

/**
 * Traverse JSON-LD object or graph to find the Recipe schema object
 */
function findRecipeInJsonLd(obj: any): any | null {
  if (!obj || typeof obj !== 'object') return null;

  const type = obj['@type'];
  if (
    type === 'Recipe' ||
    (Array.isArray(type) && type.includes('Recipe')) ||
    (typeof type === 'string' && type.toLowerCase().includes('recipe'))
  ) {
    return obj;
  }

  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findRecipeInJsonLd(obj[key]);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Detects if returned HTML is actually Matklar's own SPA index.html
 * (which happens when an SPA web host serves index.html on unknown /api routes)
 */
function isSpaFallbackHtml(html: string): boolean {
  if (!html) return true;
  const lower = html.toLowerCase();
  if (
    lower.includes('<div id="root">') ||
    lower.includes('<div id="app">') ||
    lower.includes('<title>matklar') ||
    (lower.includes('/assets/index-') && lower.includes('vite'))
  ) {
    return true;
  }
  return false;
}

/**
 * Strips markdown symbols, blockquotes, images and link syntax, returning plain text.
 */
function cleanMarkdownText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^>\s*/, '') // strip blockquote >
    .replace(/!\[.*?\]\(.*?\)/g, '') // strip images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // strip links, keep text
    .replace(/[*_#`~]/g, '') // strip markdown style characters
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates whether a candidate string looks like a legitimate recipe description/preamble.
 */
function isValidDescription(text?: string | null, title?: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 15 || trimmed.length > 800) return false;

  const lower = trimmed.toLowerCase();

  // If text is just the title repeated, it's not a real description
  if (title && lower === title.trim().toLowerCase()) return false;

  // Filter out web noise, cookies, UI controls, generic site taglines
  const noisePhrases = [
    'håll skärmen',
    'skärmen tänd',
    'skärmen vaken',
    'ladda ner appen',
    'spara recept',
    'öppna i app',
    'handla recept',
    'lägg i varukorg',
    'betygsätt receptet',
    'vi använder cookies',
    'om cookies',
    'cookie-inställningar',
    'alla rättigheter förbehållna',
    'hitta butik',
    'logga in',
    'mina sidor',
    'se fler klipp',
    'bästa priserna på',
    'här hittar du recept',
    'sök bland tusentals recept',
    'recept på köket.se: här hittar du',
  ];

  if (noisePhrases.some((p) => lower.includes(p))) {
    return false;
  }

  // Filter out pure metadata strings like "4 portioner • 30 minuter • Lätt"
  if (/^(?:ca\s*)?\d+[\s\-–\d]*(?:min|tim|portion|port|bitar|pers)\b/i.test(trimmed)) {
    return false;
  }
  if (/^[★☆\d\.,\s\(\)\/]+$/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Robust DOM extractor for recipe descriptions and preambles across Swedish & international recipe sites.
 * Checks ingress elements, preamble classes, structural headings, and meta tags.
 */
function extractDescriptionFromDom(doc: Document, title?: string): string {
  // 1. High-priority recipe preamble and ingress CSS selectors
  const prioritySelectors = [
    // Swedish recipe sites (ICA, Köket, Tasteline, Arla, Coop, Recept.se, etc.)
    '[data-test="recipe-description"]',
    '[data-test="recipe-ingress"]',
    '[data-test="ingress"]',
    '[data-testid="recipe-description"]',
    '[data-testid="recipe-ingress"]',
    '[data-testid="ingress"]',
    '.recipe-ingress',
    '.recipe__ingress',
    '.recipeIngress',
    '.recipe-body__ingress',
    '.c-recipe__preamble',
    '.c-recipe__lead',
    '.recipe-preamble',
    '.recipe__preamble',
    '.recipePreamble',
    '.recipe-description',
    '.recipe__description',
    '.recipeDescription',
    '.recipe-header__description',
    '.recipe-intro',
    '.recipe__intro',
    '.recipeIntro',
    '.article-lead',
    '.lead-text',
    '.wprm-recipe-summary',
    '.tasty-recipes-description',
    '.recipe-summary',
    '[itemprop="description"]',
    '.ingress',
    '.preamble',
    '.lead',
  ];

  for (const sel of prioritySelectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        const text = cleanHtmlText(el.textContent || '');
        if (isValidDescription(text, title)) {
          return text;
        }
      }
    } catch {}
  }

  // 2. High-up structural paragraphs right below or next to the main recipe heading <h1>
  try {
    const h1 = doc.querySelector('h1');
    if (h1) {
      let next = h1.nextElementSibling;
      let count = 0;
      while (next && count < 4) {
        if (next.tagName.toLowerCase() === 'p') {
          const text = cleanHtmlText(next.textContent || '');
          if (isValidDescription(text, title)) {
            return text;
          }
        }
        const innerP = next.querySelector('p');
        if (innerP) {
          const text = cleanHtmlText(innerP.textContent || '');
          if (isValidDescription(text, title)) {
            return text;
          }
        }
        next = next.nextElementSibling;
        count++;
      }
    }
  } catch {}

  // 3. Header / Article intro paragraphs
  const introSelectors = [
    'header p',
    '.recipe-header p',
    'article > p:first-of-type',
    '.entry-content > p:first-of-type',
  ];
  for (const sel of introSelectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        const text = cleanHtmlText(el.textContent || '');
        if (isValidDescription(text, title)) {
          return text;
        }
      }
    } catch {}
  }

  // 4. Meta tags (OpenGraph, Twitter, Description)
  const metaSelectors = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ];
  for (const sel of metaSelectors) {
    try {
      const content = doc.querySelector(sel)?.getAttribute('content');
      if (content) {
        const text = cleanHtmlText(content);
        if (isValidDescription(text, title)) {
          return text;
        }
      }
    } catch {}
  }

  return '';
}

/**
 * Smartly extracts total cooking time from an HTML Document using meta tags,
 * Microdata, schema attributes, and known Swedish/international recipe site DOM selectors.
 */
function extractCookingTimeFromDom(doc: Document): number | undefined {
  // 1. Check meta tags
  const metaSelectors = [
    'meta[property="recipe:duration"]',
    'meta[property="og:recipe:duration"]',
    'meta[itemprop="totalTime"]',
    'meta[itemprop="cookTime"]',
    'meta[itemprop="prepTime"]',
    'meta[name="twitter:data1"]',
    'meta[name="twitter:data2"]',
  ];
  for (const sel of metaSelectors) {
    try {
      const el = doc.querySelector(sel);
      const content = el?.getAttribute('content') || el?.getAttribute('value');
      if (content) {
        const parsed = parseRecipeTimeString(content);
        if (parsed && parsed > 0) return parsed;
      }
    } catch {}
  }

  // 2. Check HTML5 time elements and microdata elements
  try {
    const timeElements = doc.querySelectorAll('time[datetime], [itemprop="totalTime"], [itemprop="cookTime"], [itemprop="prepTime"]');
    for (const el of Array.from(timeElements)) {
      const dt = el.getAttribute('datetime');
      if (dt) {
        const parsed = parseRecipeTimeString(dt);
        if (parsed && parsed > 0) return parsed;
      }
      const text = el.textContent?.trim();
      if (text) {
        const parsed = parseRecipeTimeString(text);
        if (parsed && parsed > 0) return parsed;
      }
    }
  } catch {}

  // 3. Known recipe time container selectors (ICA, Arla, Köket, Tasteline, Coop, Recept.se, WP Recipe Maker, Tasty Recipes, etc.)
  const knownSelectors = [
    // ICA
    '[class*="summary__item--time" i]',
    '[class*="recipe-summary__item" i]',
    '.recipe-header__time',
    // Arla
    '.c-recipe-summary__time',
    '.c-recipe-meta__time',
    '[data-cooking-time]',
    // Köket
    '.recipe-details_time',
    '[class*="cookingTime" i]',
    // Coop & Tasteline & Recept.se
    '.recipe-cooking-time',
    '.cooking-time',
    '.recipe-time',
    '.recipe-meta-time',
    // Generic & WP plugins (WP Recipe Maker, Tasty Recipes, Create)
    '.wprm-recipe-total-time-container',
    '.wprm-recipe-time',
    '.wprm-recipe-cook-time-container',
    '.tasty-recipes-total-time',
    '.tasty-recipes-cook-time',
    '.mv-create-time-total',
    '[class*="cooking-time" i]',
    '[class*="total-time" i]',
    '[class*="cook-time" i]',
    '[class*="recipe-meta" i]',
    '[class*="recipe-info" i]',
  ];

  for (const sel of knownSelectors) {
    try {
      const els = doc.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el.textContent?.trim();
        if (text && text.length < 100) {
          const parsed = parseRecipeTimeString(text);
          if (parsed && parsed > 0) return parsed;
        }
      }
    } catch {}
  }

  // 4. Header summary spans / divs containing time keywords
  try {
    const candidateElements = doc.querySelectorAll('header span, header div, .recipe-header span, .recipe-header div, .meta span, .recipe-meta span');
    for (const el of Array.from(candidateElements)) {
      const text = el.textContent?.trim();
      if (text && text.length < 50 && (text.includes('min') || text.includes('tim') || text.includes('h'))) {
        const parsed = parseRecipeTimeString(text);
        if (parsed && parsed > 0) return parsed;
      }
    }
  } catch {}

  return undefined;
}

/**
 * Extracts introductory recipe description from markdown lines between title and ingredients.
 * Searches high up on the page for the ingress paragraph.
 */
function extractDescriptionFromMarkdown(lines: string[], title?: string): string {
  // 1. Check top-level frontmatter or metadata (Jina often outputs Description: ...)
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const l = lines[i];
    const descMatch = l.match(/^(?:Description|Beskrivning|Ingress|Sammanfattning|Preamble):\s*(.+)$/i);
    if (descMatch) {
      const cleaned = cleanMarkdownText(descMatch[1]);
      if (isValidDescription(cleaned, title)) {
        return cleaned;
      }
    }
  }

  let pastTitle = false;
  const collectedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      if (collectedLines.length > 0) {
        const fullDesc = collectedLines.join(' ');
        if (isValidDescription(fullDesc, title)) {
          return fullDesc;
        }
      }
      continue;
    }

    // Skip Jina URL Source, Published Time, Markdown Content
    if (/^(?:URL Source|Published Time|Markdown Content|Time):\s*/i.test(rawLine)) {
      continue;
    }

    // Detect title (Title: ..., # Title, ## Title, or matching title string)
    if (!pastTitle) {
      if (
        rawLine.startsWith('# ') ||
        rawLine.startsWith('## ') ||
        /^Title:\s*/i.test(rawLine) ||
        (title && rawLine.toLowerCase() === title.toLowerCase())
      ) {
        pastTitle = true;
        continue;
      }
      // If we are past line 5 and haven't found a title marker, start looking anyway
      if (i >= 5) {
        pastTitle = true;
      } else {
        continue;
      }
    }

    const lower = rawLine.toLowerCase();

    // Stop once we hit ingredients or instructions heading
    const isSectionHeading =
      (rawLine.startsWith('#') &&
        (lower.includes('ingrediens') ||
          lower.includes('gör så här') ||
          lower.includes('tillagning') ||
          lower.includes('instruktion') ||
          lower.includes('du behöver') ||
          lower.includes('innehåll'))) ||
      /^(?:##+\s*)?(?:ingredienser|du behöver|innehåll|det här behöver du|så här gör du|gör så här|gör såhär|tillagning|instruktioner):?$/i.test(
        lower
      );

    if (isSectionHeading) {
      if (collectedLines.length > 0) {
        const fullDesc = collectedLines.join(' ');
        if (isValidDescription(fullDesc, title)) {
          return fullDesc;
        }
      }
      break;
    }

    // Filter out images, headings, author credits, ratings, badges
    if (rawLine.startsWith('!') || rawLine.startsWith('#')) continue;
    if (
      /^(?:foto|av|från|betyg|tid|antal|kock|skribent|nyhet|populärt|sponsrat|publicerad|kategori)[:\s]/i.test(
        rawLine
      )
    ) {
      continue;
    }
    if (/^\[.*?\]\(.*?\)$/.test(rawLine)) continue; // Single link line
    if (/^\(?[0-9]+\)?$/.test(rawLine)) continue;
    if (/^[★☆\d\.,\s\(\)\/]+$/.test(rawLine)) continue; // Star ratings
    if (/^(?:ca\s*)?\d+[\s\-–\d]*(?:min|tim|portion|port|st|bitar|bit|pers)\b/i.test(rawLine)) {
      continue;
    }

    // Clean markdown formatting
    const cleaned = cleanMarkdownText(rawLine);

    if (isValidDescription(cleaned, title)) {
      collectedLines.push(cleaned);
      if (cleaned.length > 100) {
        return cleaned;
      }
    }
  }

  if (collectedLines.length > 0) {
    const fullDesc = collectedLines.join(' ');
    if (isValidDescription(fullDesc, title)) {
      return fullDesc;
    }
  }

  return '';
}

/**
 * Parses Markdown output from Jina AI Reader (https://r.jina.ai/) into structured recipe data
 */
function parseMarkdownRecipe(markdown: string, sourceUrl: string): ScrapedRecipe | null {
  if (!markdown || markdown.length < 50 || isAntiBotBlockPage(markdown)) return null;

  const lines = markdown.split(/\r?\n/).map((l) => l.trim());

  let title = '';
  let description = '';
  let coverImageUrl = '';
  let servings = 4;
  let prepTimeMinutes: number | undefined = undefined;
  let cookTimeMinutes: number | undefined = undefined;

  const ingredients: Ingredient[] = [];
  const instructions: Instruction[] = [];

  // 1. Extract title (Title: header or first # / ## Heading)
  for (const line of lines) {
    if (/^Title:\s*/i.test(line) && !title) {
      const cleanTitle = line
        .replace(/^Title:\s*/i, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/\s*\|.*$/, '')
        .trim();
      if (cleanTitle && !cleanTitle.startsWith('http')) {
        title = cleanRecipeTitle(cleanTitle);
        break;
      }
    }
    if ((line.startsWith('# ') || line.startsWith('## ')) && !title) {
      const cleanTitle = line
        .replace(/^#+\s*/, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/\s*\|.*$/, '')
        .trim();
      if (cleanTitle) {
        title = cleanRecipeTitle(cleanTitle);
        break;
      }
    }
  }

  // 2. Extract cover image from main body BEFORE footer/recommendations like "Liknande recept"
  const mainContent = markdown.split(/##+\s*(?:liknande recept|relaterade|relaterat|du kanske|andra recept|rekommenderat)/i)[0];
  const allImgMatches = [...mainContent.matchAll(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/gi)];
  const validImages: { alt: string; url: string }[] = [];

  for (const m of allImgMatches) {
    const alt = (m[1] || '').trim();
    let rawUrl = m[2].replace(/%20\d+w.*$/, '').replace(/\s+\d+w.*$/, '').trim();
    const low = rawUrl.toLowerCase();

    // Must NOT be the source URL itself, an internal API route, or an HTML webpage
    if (rawUrl.replace(/\/$/, '') === sourceUrl.replace(/\/$/, '')) continue;
    if (rawUrl.startsWith('blob:') || rawUrl.includes('/api/')) continue;

    // Filter icons, svgs, logos, UI badges, avatars, ratings, checkmarks
    if (
      low.endsWith('.svg') ||
      low.includes('/svg/') ||
      low.includes('/icon') ||
      low.includes('logo') ||
      low.includes('button') ||
      low.includes('avatar') ||
      low.includes('rating') ||
      low.includes('checkmark') ||
      low.includes('close') ||
      low.includes('share') ||
      low.includes('print')
    ) {
      continue;
    }

    // Must look like a real image URL
    const hasImageExt = /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(low);
    const isImageCdn = /img\.koket\.se|images\.unsplash\.com|images\.arla\.com|assets\.ica\.se|res\.cloudinary\.com|images\.ctfassets\.net|cdn\.sanity\.io/i.test(
      low
    );

    if (hasImageExt || isImageCdn) {
      if (rawUrl.includes('img.koket.se/')) {
        rawUrl = rawUrl.replace(/\/(?:standard|square|wide)-mini\//, '/standard-mega/');
      }
      validImages.push({ alt, url: rawUrl });
    }
  }

  if (validImages.length > 0) {
    const titleMatch = title
      ? validImages.find(
          (img) =>
            img.alt &&
            img.alt.length > 3 &&
            title.toLowerCase().includes(img.alt.toLowerCase().slice(0, 12))
        )
      : null;
    const heroMatch = validImages.find((img) =>
      /standard-mega|large|hero|main|full/i.test(img.url)
    );
    coverImageUrl = titleMatch?.url || heroMatch?.url || validImages[0].url;
  }

  // Extract description (introductory paragraph high up on the page between title and ingredients)
  description = extractDescriptionFromMarkdown(lines, title);

  let currentSection: 'header' | 'ingredients' | 'instructions' = 'header';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lower = line.toLowerCase();

    // Servings detection
    if (/(\d+)\s*(?:port|portion|bitar|bit|pers|personer|st|pannkakor|klubbor)/i.test(line)) {
      const match = line.match(/(\d+)\s*(?:port|portion|bitar|bit|pers|personer|st|pannkakor|klubbor)/i);
      if (match) {
        servings = parseInt(match[1], 10);
      }
    }

    // Time detection: ONLY detect from header / metadata lines before ingredients and instructions begin!
    if (currentSection === 'header' && !cookTimeMinutes) {
      if (
        lower.includes('min') ||
        lower.includes('tim') ||
        lower.includes('tid') ||
        lower.includes('time') ||
        lower.includes('⏱') ||
        lower.includes('⏰') ||
        lower.includes('hour')
      ) {
        const parsedTime = parseRecipeTimeString(line);
        if (parsedTime && parsedTime > 0 && parsedTime <= 720) {
          cookTimeMinutes = parsedTime;
        }
      }
    }

    // Cleaned heading representation to match regardless of Markdown bolding/headings
    const cleanHeadingLine = line
      .replace(/^[\s#*_\->•]+/, '')
      .replace(/[*_#`~]+$/, '')
      .trim();
    const cleanHeadingLower = cleanHeadingLine.toLowerCase();

    const isInstructionHeading =
      cleanHeadingLower.includes('gör så här') ||
      cleanHeadingLower.includes('gör såhär') ||
      cleanHeadingLower.includes('så här gör du') ||
      cleanHeadingLower.includes('så gör du') ||
      cleanHeadingLower.includes('tillagning') ||
      cleanHeadingLower.includes('instruktion') ||
      cleanHeadingLower.includes('steg för steg') ||
      cleanHeadingLower.includes('tillredning') ||
      cleanHeadingLower.includes('beredning') ||
      cleanHeadingLower.includes('arbetsgång') ||
      cleanHeadingLower.startsWith('metod') ||
      cleanHeadingLower.startsWith('directions') ||
      cleanHeadingLower.startsWith('instructions') ||
      cleanHeadingLower.startsWith('method');

    const isIngredientHeading =
      cleanHeadingLower.includes('ingrediens') ||
      cleanHeadingLower.includes('innehåll') ||
      cleanHeadingLower.includes('vad du behöver') ||
      cleanHeadingLower.includes('du behöver') ||
      cleanHeadingLower.includes('det här behöver du') ||
      cleanHeadingLower.includes('detta behöver du') ||
      cleanHeadingLower.includes('det behöver du') ||
      cleanHeadingLower.includes('ingredients');

    const isHeaderLine =
      line.startsWith('#') ||
      line.startsWith('**') ||
      line.startsWith('__') ||
      cleanHeadingLine.endsWith(':') ||
      cleanHeadingLine.length < 50;

    // Check section header transitions
    if (isIngredientHeading && isHeaderLine) {
      currentSection = 'ingredients';
      continue;
    }

    if (isInstructionHeading && (isHeaderLine || line.includes(':'))) {
      currentSection = 'instructions';
      // If line contains instruction text right after colon (e.g. "**Gör såhär:**Börja med att...")
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1 && colonIdx < line.length - 10) {
        const remainder = cleanLeadingStepNumber(line.slice(colonIdx + 1).replace(/^[*_\s]+/, '').trim());
        if (remainder.length > 5) {
          instructions.push({
            stepNumber: instructions.length + 1,
            text: remainder,
          });
        }
      }
      continue;
    }

    // Heuristic start for blogs without explicit "Ingredienser" heading (e.g. Zeinas Kitchen starting directly with portion and items)
    if (currentSection === 'header' && !isInstructionHeading) {
      if (isPotentialIngredientLine(line)) {
        const parsed = parseIngredientLine(line);
        // Only trigger section start if the line has an explicit amount or fraction
        if (parsed && parsed.amount !== null) {
          let nextParses = false;
          for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
            if (lines[j] && isPotentialIngredientLine(lines[j])) {
              nextParses = true;
              break;
            }
          }
          if (nextParses) {
            currentSection = 'ingredients';
          }
        }
      }
    }

    // Process ingredients
    if (currentSection === 'ingredients') {
      // Check if we hit instructions section
      if (isInstructionHeading) {
        currentSection = 'instructions';
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1 && colonIdx < line.length - 10) {
          const remainder = cleanLeadingStepNumber(line.slice(colonIdx + 1).replace(/^[*_\s]+/, '').trim());
          if (remainder.length > 5) {
            instructions.push({
              stepNumber: instructions.length + 1,
              text: remainder,
            });
          }
        }
        continue;
      }

      // If it's a subhead within ingredients (e.g. "### Garnering:", "**Pajdeg:**", "Kyckling & buljong**"), stay in ingredients
      if (
        line.startsWith('#') ||
        (line.startsWith('**') && line.endsWith('**') && line.length < 35) ||
        (line.endsWith('**') && line.length < 35)
      ) {
        continue;
      }

      // Discard markdown table separators like | --- | --- |
      if (/^\|?[\s\-:|]+\|?$/.test(line)) {
        continue;
      }

      // 1. Strip markdown images: ![alt](url)
      let cleaned = line.replace(/!\[.*?\]\(.*?\)/g, '');
      // 2. Strip HTML tags
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      // 3. Strip markdown links keeping text: [text](url) -> text
      cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
      // 4. Strip checkbox markers: [ ] or [x] anywhere, and leading bullets
      cleaned = cleaned
        .replace(/^[•\-*+–—\s]*\[[ xX✓✔☑☐\s]*\]\s*/g, '')
        .replace(/\[[ xX✓✔☑☐\s]*\]/g, '')
        .replace(/^[•\-*+–—]\s*/, '')
        .replace(/^\d{1,2}[.)]\s+/, '')
        .trim();

      // Discard empty lines, subheadings, UI toggles ("Håll skärmen tänd"), or lines ending with colon
      const cleanLow = cleaned.toLowerCase();
      if (
        cleaned.length > 1 &&
        !cleaned.endsWith(':') &&
        !cleaned.startsWith('#') &&
        !cleaned.startsWith('http') &&
        !/^(foto|bild|skribent|fotograf|annons|källa)[:\s]/i.test(cleaned) &&
        !cleanLow.includes('håll skärmen') &&
        !cleanLow.includes('skärmen tänd') &&
        !cleanLow.includes('matlagningsläge') &&
        !cleanLow.includes('inköpslista') &&
        !/^(?:ca|cirka)?\s*\d+[\s\-–\d]*\s*(?:portion|portioner|port|bitar|bit|pers|personer|satser|sats)\.?$/i.test(cleanLow)
      ) {
        if (isPotentialIngredientLine(cleaned)) {
          const parsed = parseIngredientLine(cleaned);
          if (parsed) {
            ingredients.push(parsed);
          }
        }
      }
    }

    // Process instructions
    else if (currentSection === 'instructions') {
      const stopKeywords = [
        'var receptet gott',
        'vad tyckte du',
        'kommentera',
        'tipsa eller fråga',
        'betygsätt',
        'fler recept',
        'liknande recept',
        'relaterade recept',
        'relaterade inlägg',
        'om författaren',
        'lämna en kommentar',
        'dela recept',
        'publicerad i',
        'kategorier',
        'skriv ut',
        'foto:',
        'fotograf:',
        'annons',
        'publicerad',
        'skribent:',
        'har du lagat receptet',
        'markera receptet',
        'jag har lagat',
        'sätt betyg',
        'spara ditt betyg',
        'skapa anteckning',
        'näringsvärde',
        'klimatguide',
        'om ditt dataskydd',
        'vi bryr oss om din integritet',
        'populärt',
        'sponsrat',
        'artiklar',
      ];
      if (stopKeywords.some((k) => cleanHeadingLower.includes(k))) {
        if (instructions.length >= 2) break;
      }

      // Major blog section heading (## Kommentarer, ## Fler recept, ### Lämna kommentar) ends instructions
      if (/^#{1,3}\s+/.test(line) && !isInstructionHeading) {
        const hTitle = line.replace(/^#+\s*/, '').trim();
        // If it starts with a step number like "### 1. Skär äpplena", it's a step header!
        if (/^\d+[.)]/.test(hTitle)) {
          instructions.push({
            stepNumber: instructions.length + 1,
            text: cleanLeadingStepNumber(hTitle),
          });
          continue;
        }
        if (instructions.length >= 2) break;
      }

      // Strip leading numbers, bullets, dashes, checkboxes, and markdown artifacts
      const cleaned = cleanLeadingStepNumber(line);

      const ignorePhrases = [
        'håll skärmen tänd',
        'skriv ut',
        'spara',
        'spara recept',
        'spara ditt betyg',
        'stäng',
        'stäng annonsen',
        'dela',
        'dela recept',
        'skicka',
        'ladda ner',
        'starta timer',
        'har du lagat receptet',
        'markera receptet',
        'sätt betyg',
        'betygsätt gärna',
        'skapa anteckning',
        'tips',
        'tips:',
        'kocktips',
        'läs mer',
        'öppna matlagningsläget',
        'matlagningsläge',
        'steg för steg',
      ];
      const cleanedLower = cleaned.toLowerCase();
      if (
        ignorePhrases.some(
          (p) => cleanedLower === p || (cleanedLower.startsWith(p) && cleaned.length < 35)
        ) ||
        /^\d{1,2}:\d{2}(?::\d{2})?$/.test(cleaned) || // timers like 00:10:00
        /^[1-5]$/.test(cleaned) // star ratings 1, 2, 3, 4, 5
      ) {
        continue;
      }

      if (
        cleaned.length > 4 &&
        !cleaned.endsWith(':') &&
        !/^\d{1,2}[.)]?$/.test(cleaned) &&
        !cleaned.startsWith('#')
      ) {
        instructions.push({
          stepNumber: instructions.length + 1,
          text: cleaned,
        });
      }
    }
  }

  // Fallback: If section headings weren't cleanly detected, run smart heuristic recipe parser
  if (ingredients.length < 2 || instructions.length < 2) {
    try {
      const fallbackParsed = parseRawRecipeText(markdown);
      if (fallbackParsed) {
        if (ingredients.length < 2 && fallbackParsed.ingredients.length >= 2) {
          ingredients.length = 0;
          ingredients.push(...fallbackParsed.ingredients);
        }
        if (instructions.length < 2 && fallbackParsed.instructions.length >= 2) {
          instructions.length = 0;
          instructions.push(...fallbackParsed.instructions);
        }
        if (fallbackParsed.servings && fallbackParsed.servings !== 4) {
          servings = fallbackParsed.servings;
        }
      }
    } catch {}
  }

  // If title was not found, deduce from host or reject
  const host = new URL(sourceUrl).hostname.replace('www.', '');
  if (!title) {
    if (ingredients.length < 2 && instructions.length < 2) {
      return null;
    }
    title = `Recept från ${host}`;
  }

  if (ingredients.length < 2 && instructions.length < 2) {
    return null;
  }

  return {
    title,
    description: description.trim(),
    coverImageUrl:
      coverImageUrl ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
    servings: servings || 4,
    category: detectCategory(title),
    subcategory: detectSubcategory(title, detectCategory(title), ingredients, description),
    prepTimeMinutes: 0,
    cookTimeMinutes: cookTimeMinutes || prepTimeMinutes || 30,
    ingredients: ingredients.length > 0 ? ingredients : [
      { name: 'Huvudingrediens', amount: 400, unit: 'g', aisle: 'Skafferi', isPantryStaple: false },
    ],
    instructions: instructions.length > 0 ? instructions : [
      { stepNumber: 1, text: `Se fullständiga instruktioner på ${sourceUrl}` },
    ],
    sourceUrl,
    engineUsed: 'Jina AI Reader (Markdown)',
  };
}

/**
 * Parse schema.org/Recipe JSON-LD structure with smart DOM enhancement
 */
/**
 * Parse schema.org/Recipe JSON-LD structure with smart DOM enhancement
 */
function parseJsonLdRecipe(schema: any, sourceUrl: string, doc: Document, engineName = 'JSON-LD'): ScrapedRecipe | null {
  const rawTitle = cleanHtmlText(schema.name || schema.headline || doc.title || 'Hämtat webbrecept');
  const title = cleanRecipeTitle(rawTitle);
  let description = cleanHtmlText(schema.description || '');

  // If JSON-LD description is missing, too short, or generic, enhance with DOM / meta tags
  if (!isValidDescription(description, title)) {
    const domDesc = extractDescriptionFromDom(doc, title);
    if (domDesc) {
      description = domDesc;
    }
  }
  const coverImageUrl =
    extractImageUrl(schema.image) ||
    extractBestCoverImageFromDom(doc) ||
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80';

  const servings = parseServings(schema.recipeYield) || extractServingsFromDom(doc) || 4;
  const parsedTotal = parseRecipeTimeString(schema.totalTime || schema.performTime);
  const parsedCook = parseRecipeTimeString(schema.cookTime);
  const parsedPrep = parseRecipeTimeString(schema.prepTime);
  const domTime = extractCookingTimeFromDom(doc);
  const prepTimeMinutes = 0;
  const cookTimeMinutes = parsedTotal || parsedCook || domTime || parsedPrep || 30;

  const rawCat = Array.isArray(schema.recipeCategory)
    ? schema.recipeCategory[0]
    : schema.recipeCategory;
  const category = detectCategory(rawCat || schema.keywords || title);

  // 1. Parse Ingredients from JSON-LD
  let ingredients: Ingredient[] = [];
  const rawIngredients = schema.recipeIngredient || schema.ingredients || [];

  if (Array.isArray(rawIngredients)) {
    for (const item of rawIngredients) {
      if (typeof item === 'string') {
        const cleaned = cleanHtmlText(item);
        if (cleaned) {
          const parsed = parseIngredientLine(cleaned);
          if (parsed) ingredients.push(parsed);
        }
      }
    }
  }

  // Fallback to DOM ingredients if JSON-LD had none or too few (e.g. Brinken Bakar, blogs with empty schema)
  if (ingredients.length < 2) {
    const domIngredients = extractIngredientsFromDom(doc);
    if (domIngredients.length > ingredients.length) {
      ingredients = domIngredients;
    }
  }

  // 2. Parse Instructions from JSON-LD
  let instructions = extractInstructionsFromJsonLd(schema.recipeInstructions);

  // If JSON-LD gave too few steps, check DOM elements
  if (instructions.length <= 1) {
    const domInstructions = extractInstructionsFromDom(doc);
    if (domInstructions.length >= 2) {
      instructions = domInstructions;
    }
  }

  // If JSON-LD is essentially empty (empty ingredients AND empty instructions), return null so DOM/Markdown fallbacks can run
  if (ingredients.length < 2 && instructions.length < 2) {
    return null;
  }

  const deducedSubcats = detectSubcategories(
    title,
    category,
    ingredients,
    description,
    Array.isArray(schema.keywords) ? schema.keywords.join(' ') : (schema.keywords || '')
  );
  let finalSubcategories = [...deducedSubcats];
  if (schema.recipeCuisine) {
    const cuisine = Array.isArray(schema.recipeCuisine) ? schema.recipeCuisine[0] : schema.recipeCuisine;
    if (cuisine && !cuisine.includes('.se') && !cuisine.includes('.com') && !cuisine.includes('http')) {
      if (!finalSubcategories.includes(cuisine)) {
        finalSubcategories.unshift(cuisine);
      }
    }
  }

  return {
    title,
    description: description.trim(),
    coverImageUrl,
    servings,
    category,
    subcategory: finalSubcategories.join(', '),
    subcategories: finalSubcategories,
    prepTimeMinutes,
    cookTimeMinutes,
    ingredients: ingredients.length > 0 ? ingredients : [
      { name: 'Ingredienser enligt recept', amount: 400, unit: 'g', aisle: 'Skafferi', isPantryStaple: false },
    ],
    instructions: instructions.length > 0 ? instructions : [
      { stepNumber: 1, text: `Följ instruktionerna på ${sourceUrl}` },
    ],
    sourceUrl,
    engineUsed: engineName,
  };
}

/**
 * Fallback parser using HTML microdata, OpenGraph tags, and DOM queries
 */
function parseHtmlFallback(doc: Document, sourceUrl: string, engineName = 'DOM Parser'): ScrapedRecipe | null {
  const host = new URL(sourceUrl).hostname.replace('www.', '');

  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const rawTitle = cleanHtmlText(ogTitle || doc.querySelector('h1')?.textContent || doc.title || 'Webbrecept');
  const title = cleanRecipeTitle(rawTitle);
  if (!title || title.length < 2) {
    return null;
  }
  const description = extractDescriptionFromDom(doc, title);
  const coverImageUrl =
    extractBestCoverImageFromDom(doc) ||
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80';

  const ingredients = extractIngredientsFromDom(doc);
  const instructions = extractInstructionsFromDom(doc);
  const category = detectCategory(title);
  const subcategories = detectSubcategories(title, category, ingredients, description);

  const domTime = extractCookingTimeFromDom(doc);
  const domServings = extractServingsFromDom(doc);

  return {
    title,
    description,
    coverImageUrl,
    servings: domServings || 4,
    category,
    subcategory: subcategories.join(', '),
    subcategories,
    prepTimeMinutes: 0,
    cookTimeMinutes: domTime || 30,
    ingredients: ingredients.length > 0 ? ingredients : [
      { name: 'Ingredienser enligt recept', amount: null, unit: 'st', aisle: 'Skafferi', isPantryStaple: false },
    ],
    instructions: instructions.length > 0 ? instructions : [
      { stepNumber: 1, text: `Följ receptets anvisningar på ${host}.` },
    ],
    sourceUrl,
    engineUsed: engineName,
  };
}

/**
 * Parse HTML document for recipes (JSON-LD or DOM)
 */
function parseHtmlRecipe(html: string, targetUrl: string, engineName: string): ScrapedRecipe | null {
  if (!html || html.length < 200 || isSpaFallbackHtml(html) || isAntiBotBlockPage(html)) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Try JSON-LD parsing first (Most reliable across Swedish and international sites)
  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(jsonLdScripts)) {
    try {
      const content = script.textContent;
      if (content) {
        const json = safeParseJson(content);
        const found = json ? findRecipeInJsonLd(json) : null;
        if (found) {
          const parsed = parseJsonLdRecipe(found, targetUrl, doc, engineName);
          if (parsed && (parsed.ingredients.length >= 2 || parsed.instructions.length >= 2)) {
            return parsed;
          }
        }
      }
    } catch {
      // Continue searching other scripts
    }
  }

  // Fallback to DOM parsing
  const fallback = parseHtmlFallback(doc, targetUrl, engineName);
  if (fallback && fallback.title && fallback.title.length >= 2 && (fallback.ingredients.length >= 2 || fallback.instructions.length >= 2)) {
    return fallback;
  }

  return null;
}

/**
 * Main Scraper: Fetches and parses recipe data across local dev, serverless, and static hosting.
 * Employs a multi-tier proxy pipeline:
 * Tier 1: Local / Serverless /api/fetch-recipe (with anti-bot & SPA-fallback protection)
 * Tier 2: Jina AI Web Reader (bypasses CORS & anti-bot Cloudflare)
 * Tier 3: CodeTabs CORS Proxy
 * Tier 4: AllOrigins JSON API
 * Tier 5: CorsProxy.io
 */
export async function scrapeRecipeFromUrl(
  rawUrl: string,
  onProgress?: (percent: number, status: string) => void
): Promise<ScrapedRecipe> {
  onProgress?.(15, 'Ansluter till receptsidan...');
  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  // Strip common tracking query parameters that can break external proxies
  try {
    const urlObj = new URL(targetUrl);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source'];
    for (const p of trackingParams) {
      urlObj.searchParams.delete(p);
    }
    targetUrl = urlObj.toString();
  } catch {}

  // Engine 1: Check Local / Serverless API route with timeout
  try {
    onProgress?.(25, 'Kontrollerar direktanslutning...');
    const res = await fetch(`/api/fetch-recipe?url=${encodeURIComponent(targetUrl)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const text = await res.text();
      // Ensure it is NOT the SPA index.html or an anti-bot blocked page
      if (!isSpaFallbackHtml(text) && !isAntiBotBlockPage(text)) {
        onProgress?.(70, 'Läser av receptstruktur...');
        const parsed = parseHtmlRecipe(text, targetUrl, 'Server API Proxy');
        if (parsed) {
          onProgress?.(100, 'Recept klart!');
          return parsed;
        }
      }
    }
  } catch {
    // Continue to proxy pipeline
  }

  // Engine 2: Jina AI Web Reader
  // Engineered to bypass Cloudflare, bot protections, and CORS
  try {
    onProgress?.(45, 'Hämtar innehåll och bilder...');
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const isCoop = targetUrl.toLowerCase().includes('coop.se');

    // For Coop, HTML format preserves the complete JSON-LD and shopping-cart ingredients that markdown strips
    const returnFormat = isCoop ? 'html' : 'markdown';
    const res = await fetch(jinaUrl, {
      headers: {
        'Accept': isCoop ? 'text/html, text/plain' : 'text/plain',
        'X-Return-Format': returnFormat,
        'X-Timeout': '12',
      },
      signal: AbortSignal.timeout(13000),
    });

    if (res.ok) {
      const content = await res.text();
      if (!isAntiBotBlockPage(content)) {
        onProgress?.(75, 'Tolkar ingredienser och steg...');
        if (isCoop || content.includes('<script type="application/ld+json">') || content.includes('itemprop="recipeIngredient"')) {
          const parsedHtml = parseHtmlRecipe(content, targetUrl, 'Jina AI Reader (HTML)');
          if (parsedHtml && parsedHtml.ingredients.length > 0) {
            onProgress?.(100, 'Recept klart!');
            return parsedHtml;
          }
        }

        const parsedMd = parseMarkdownRecipe(content, targetUrl);
        if (parsedMd && parsedMd.ingredients.length > 0) {
          onProgress?.(100, 'Recept klart!');
          return parsedMd;
        }

        // If markdown yielded no ingredients, try HTML format once
        if (!isCoop && returnFormat === 'markdown') {
          try {
            const htmlRes = await fetch(jinaUrl, {
              headers: { 'X-Return-Format': 'html', 'X-Timeout': '10' },
              signal: AbortSignal.timeout(10000),
            });
            if (htmlRes.ok) {
              const htmlText = await htmlRes.text();
              const parsed = parseHtmlRecipe(htmlText, targetUrl, 'Jina AI Reader (HTML)');
              if (parsed && parsed.ingredients.length > 0) {
                onProgress?.(100, 'Recept klart!');
                return parsed;
              }
            }
          } catch {}
        }
      }
    }
  } catch (jinaErr) {
    console.warn('Jina reader failed, trying CORS proxies:', jinaErr);
  }

  // Engine 3: CodeTabs Proxy (HTML)
  try {
    onProgress?.(82, 'Söker via alternativ proxy...');
    const codeTabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(codeTabsUrl, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const html = await res.text();
      if (!isAntiBotBlockPage(html)) {
        const parsed = parseHtmlRecipe(html, targetUrl, 'CodeTabs Proxy');
        if (parsed) return parsed;
      }
    }
  } catch {
    // Continue
  }

  // Engine 4: AllOrigins JSON API (JSON unwrapper)
  try {
    onProgress?.(88, 'Läser av webbdata...');
    const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(allOriginsUrl, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.contents && !isAntiBotBlockPage(data.contents)) {
        const parsed = parseHtmlRecipe(data.contents, targetUrl, 'AllOrigins Proxy');
        if (parsed) return parsed;
      }
    }
  } catch {
    // Continue
  }

  // Engine 5: AllOrigins Raw Proxy
  try {
    const allOriginsRawUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(allOriginsRawUrl, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const html = await res.text();
      if (!isAntiBotBlockPage(html)) {
        const parsed = parseHtmlRecipe(html, targetUrl, 'AllOrigins Raw');
        if (parsed) return parsed;
      }
    }
  } catch {
    // Continue
  }

  // Engine 6: CorsProxy.io
  try {
    onProgress?.(95, 'Sista försöket...');
    const corsProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(corsProxyUrl, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const html = await res.text();
      if (!isAntiBotBlockPage(html)) {
        const parsed = parseHtmlRecipe(html, targetUrl, 'CorsProxy');
        if (parsed) return parsed;
      }
    }
  } catch {
    // Continue
  }

  throw new Error(
    'Kunde inte nå receptsidan automatiskt. Kontrollera adressen eller använd manuell inmatning / OCR.'
  );
}
