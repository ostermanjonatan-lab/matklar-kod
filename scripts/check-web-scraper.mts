/**
 * Checks how recipe web pages are read (parseHtmlRecipe) against 10 test pages, and one page
 * through the reader service (scrapeRecipeFromUrl): recipe data
 * for search engines (JSON-LD, also in @graph and with sections), microdata, a WordPress recipe
 * plugin and a page with only headings and lists.
 * Run: npx tsx scripts/check-web-scraper.mts
 * When the reading is improved on purpose, update the expected values below.
 */
import { DOMParser } from 'linkedom';

(globalThis as unknown as { DOMParser: unknown }).DOMParser = DOMParser;
const { parseHtmlRecipe } = await import('../src/services/webRecipeScraper');
const { PAGES } = await import('./web-recipe-pages');
const { MARKDOWN_PAGES } = await import('./web-recipe-markdown');
const { scrapeRecipeFromUrl } = await import('../src/services/webRecipeScraper');

interface Expected {
  title: string;
  servings: number;
  cookTimeMinutes: number;
  category: string;
  ingredients: string[];
  steps: number;
}

const EXPECTED: Record<string, Expected> = {
  "ica": {
    "title": "Krämig kycklingpasta",
    "servings": 4,
    "cookTimeMinutes": 30,
    "category": "Middag",
    "ingredients": [
      "Pasta",
      "Kycklingfilé",
      "Gul lök",
      "Matlagningsgrädde",
      "Salt",
      "Svartpeppar"
    ],
    "steps": 3
  },
  "arla": {
    "title": "Kladdkaka",
    "servings": 8,
    "cookTimeMinutes": 45,
    "category": "Efterrätt",
    "ingredients": [
      "Smör",
      "Ägg",
      "Strösocker",
      "Kakao",
      "Vetemjöl",
      "Vispad grädde"
    ],
    "steps": 3
  },
  "koket": {
    "title": "Köttfärssås med tagliatelle",
    "servings": 4,
    "cookTimeMinutes": 75,
    "category": "Middag",
    "ingredients": [
      "Nötfärs",
      "Gul lök, finhackad",
      "Krossade tomater (à 400 g)",
      "Vatten",
      "Tagliatelle"
    ],
    "steps": 4
  },
  "wprm": {
    "title": "Kycklingshawarma",
    "servings": 4,
    "cookTimeMinutes": 0,
    "category": "Middag",
    "ingredients": [
      "Kycklinglårfilé",
      "Vitlök",
      "Olivolja",
      "Spiskummin"
    ],
    "steps": 3
  },
  "headers": {
    "title": "Kanelbullar",
    "servings": 30,
    "cookTimeMinutes": 120,
    "category": "Efterrätt",
    "ingredients": [
      "Jäst",
      "Mjölk",
      "Smör",
      "Vetemjöl",
      "Smör",
      "Kanel",
      "Ägg"
    ],
    "steps": 5
  },
  "microdata": {
    "title": "Pannkakor",
    "servings": 4,
    "cookTimeMinutes": 0,
    "category": "Efterrätt",
    "ingredients": [
      "Ägg",
      "Mjölk",
      "Vetemjöl",
      "Salt"
    ],
    "steps": 3
  },
  "entities": {
    "title": "Skagenröra",
    "servings": 4,
    "cookTimeMinutes": 0,
    "category": "Förrätt",
    "ingredients": [
      "Räkor med skal",
      "Majonnäs",
      "Dill",
      "Salt och peppar"
    ],
    "steps": 2
  },
  "paragraph": {
    "title": "Ugnslax med citron",
    "servings": 4,
    "cookTimeMinutes": 35,
    "category": "Middag",
    "ingredients": [
      "Laxfilé",
      "Citron",
      "Olivolja",
      "Dill"
    ],
    "steps": 5
  },
  "nojsonld": {
    "title": "Våfflor",
    "servings": 4,
    "cookTimeMinutes": 0,
    "category": "Efterrätt",
    "ingredients": [
      "Vetemjöl",
      "Bakpulver",
      "Mjölk",
      "Ägg",
      "Smör"
    ],
    "steps": 4
  },
  "inlinenumbers": {
    "title": "Potatisbullar med ost",
    "servings": 4,
    "cookTimeMinutes": 30,
    "category": "Middag",
    "ingredients": [
      "Potatisbullar",
      "Riven ost",
      "Jalapeños"
    ],
    "steps": 3
  },
  "icadrink": {
    "title": "Gin och tonic",
    "servings": 1,
    "cookTimeMinutes": 15,
    "category": "Dryck",
    "ingredients": [
      "Isbitar",
      "Gin",
      "Tonic water",
      "Citronskivor eller limeskivor"
    ],
    "steps": 2
  }
};

// Pages read through the reader service: the app's own server is refused and the reader answers
const results: [string, Awaited<ReturnType<typeof scrapeRecipeFromUrl>> | null][] = [];
for (const [key, page] of Object.entries(PAGES)) results.push([key, parseHtmlRecipe(page.html, page.url, 'test')]);
for (const [key, page] of Object.entries(MARKDOWN_PAGES)) {
  (globalThis as unknown as { fetch: unknown }).fetch = async (url: string) =>
    url.startsWith('https://r.jina.ai/') ? new Response(page.markdown) : new Response('Access Denied', { status: 403 });
  results.push([key, await scrapeRecipeFromUrl(page.url).catch(() => null)]);
}

let failures = 0;
for (const [key, r] of results) {
  const want = EXPECTED[key];
  if (!want) continue;
  if (!r) {
    failures++;
    console.log(`FEL   ${key}: sidan gav inget recept`);
    continue;
  }
  const got: Expected = {
    title: r.title,
    servings: r.servings,
    cookTimeMinutes: r.cookTimeMinutes ?? 0,
    category: r.category,
    ingredients: r.ingredients.map((i) => i.name),
    steps: r.instructions.length,
  };
  const problems = (Object.keys(want) as (keyof Expected)[]).filter(
    (field) => JSON.stringify(got[field]) !== JSON.stringify(want[field])
  );
  if (problems.length === 0) {
    console.log(`ok    ${key}`);
  } else {
    failures++;
    console.log(`FEL   ${key}`);
    for (const field of problems) {
      console.log(`      ${field}: väntade ${JSON.stringify(want[field])}, fick ${JSON.stringify(got[field])}`);
    }
  }
}
console.log(failures === 0 ? '\nAlla sidor läses som väntat.' : `\n${failures} sidor läses annorlunda än väntat.`);
process.exit(failures === 0 ? 0 : 1);
