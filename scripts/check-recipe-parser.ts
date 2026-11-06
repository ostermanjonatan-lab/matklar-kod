/**
 * Checks the reading of pasted recipe text (parseRawRecipeText) against 18 recipe texts.
 * Run: npx tsx scripts/check-recipe-parser.ts
 * When the reading is improved on purpose, update the expected values below.
 */
import { parseRawRecipeText } from '../src/utils/ingredientParser';
import { RECIPE_TEXTS } from './recipe-parser-cases';

interface Expected {
  title: string;
  servings: number;
  cookingTimeMinutes: number | null;
  difficulty: number | null;
  category: string;
  ingredients: string[];
  steps: number;
}

const EXPECTED: Record<string, Expected> = {
  "ica": {
    "title": "Krämig pasta med kyckling och soltorkade tomater",
    "servings": 4,
    "cookingTimeMinutes": 30,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Pasta",
      "Kycklingfilé",
      "Gul lök",
      "Vitlök",
      "Matlagningsgrädde",
      "Soltorkade tomater",
      "Olivolja",
      "Salt och peppar"
    ],
    "steps": 5
  },
  "arla": {
    "title": "Kladdkaka",
    "servings": 8,
    "cookingTimeMinutes": 45,
    "difficulty": null,
    "category": "Efterrätt",
    "ingredients": [
      "Smör",
      "Ägg",
      "Strösocker",
      "Kakao",
      "Vaniljsocker",
      "Vetemjöl",
      "Salt",
      "Vispad grädde"
    ],
    "steps": 5
  },
  "koket": {
    "title": "Köttfärssås med tagliatelle",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Nötfärs",
      "Gul lök, finhackad",
      "Vitlöksklyftor, pressade",
      "Krossade tomater (à 400 g)",
      "Tomatpuré",
      "Torkad oregano",
      "Vatten",
      "Buljongtärning",
      "Tagliatelle",
      "Riven parmesan, till servering"
    ],
    "steps": 3
  },
  "bare": {
    "title": "Pannkakor",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Efterrätt",
    "ingredients": [
      "Ägg",
      "Mjölk",
      "Vetemjöl",
      "Salt",
      "Smör"
    ],
    "steps": 4
  },
  "bullets": {
    "title": "Ugnsbakad lax",
    "servings": 4,
    "cookingTimeMinutes": 35,
    "difficulty": 1,
    "category": "Middag",
    "ingredients": [
      "Laxfilé",
      "Citron",
      "Olivolja",
      "Salt och peppar",
      "Dill",
      "Crème fraiche"
    ],
    "steps": 5
  },
  "sections": {
    "title": "Kycklinggryta med ris",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Kycklinglårfilé",
      "Röd paprika",
      "Gul lök",
      "Kokosmjölk",
      "Röd currypasta",
      "Jasminris",
      "Vatten",
      "Färsk koriander"
    ],
    "steps": 4
  },
  "split": {
    "title": "Fisksoppa",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Torskfilé",
      "Morötter",
      "Purjolök",
      "Fiskbuljong",
      "Grädde"
    ],
    "steps": 3
  },
  "noheader": {
    "title": "",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Havregryn",
      "Vatten",
      "Salt"
    ],
    "steps": 3
  },
  "wrapped": {
    "title": "Lasagne",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": 2,
    "category": "Middag",
    "ingredients": [
      "Blandfärs",
      "Krossade tomater",
      "Lasagneplattor",
      "Smör",
      "Vetemjöl",
      "Mjölk"
    ],
    "steps": 4
  },
  "coop": {
    "title": "Laxpasta med spenat och citron",
    "servings": 4,
    "cookingTimeMinutes": 25,
    "difficulty": 1,
    "category": "Middag",
    "ingredients": [
      "Pasta, t.ex. penne",
      "Matlagningsgrädde 15 %",
      "Citron, rivet skal och saft",
      "Färsk spenat",
      "Laxfilé utan skinn",
      "Salt och svartpeppar"
    ],
    "steps": 4
  },
  "tasteline": {
    "title": "Krämig kycklinggryta",
    "servings": 4,
    "cookingTimeMinutes": 40,
    "difficulty": 1,
    "category": "Middag",
    "ingredients": [
      "Kycklingbröstfiléer",
      "Gul lök",
      "Morötter",
      "Smör",
      "Crème fraiche",
      "Vatten",
      "Hönsbuljongtärning",
      "Paprikapulver",
      "Salt",
      "Peppar"
    ],
    "steps": 5
  },
  "alltommat": {
    "title": "Mammas köttbullar",
    "servings": 4,
    "cookingTimeMinutes": 45,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Blandfärs",
      "Ströbröd",
      "Mjölk",
      "Ägg",
      "Liten gul lök, finriven",
      "Salt",
      "Vitpeppar",
      "Smör, till stekning"
    ],
    "steps": 4
  },
  "zeina": {
    "title": "Kycklingshawarma",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Kycklinglårfilé",
      "Vitlök",
      "Olivolja",
      "Citron, saften",
      "Spiskummin",
      "Paprikapulver",
      "Kanel",
      "Salt"
    ],
    "steps": 4
  },
  "mathem": {
    "title": "Tacogratäng",
    "servings": 4,
    "cookingTimeMinutes": 30,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Nötfärs",
      "Tacokrydda",
      "Vatten",
      "Krossade tomater",
      "Riven ost",
      "Tortillachips"
    ],
    "steps": 5
  },
  "dansukker": {
    "title": "Kanelbullar",
    "servings": 30,
    "cookingTimeMinutes": 120,
    "difficulty": null,
    "category": "Efterrätt",
    "ingredients": [
      "Jäst",
      "Mjölk",
      "Smör",
      "Strösocker",
      "Salt",
      "Malen kardemumma",
      "Vetemjöl",
      "Rumsvarmt smör",
      "Strösocker",
      "Kanel",
      "Ägg",
      "Pärlsocker"
    ],
    "steps": 6
  },
  "kungsornen": {
    "title": "Våfflor",
    "servings": 10,
    "cookingTimeMinutes": null,
    "difficulty": null,
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
  "matklubben": {
    "title": "Skagenröra",
    "servings": 4,
    "cookingTimeMinutes": null,
    "difficulty": null,
    "category": "Förrätt",
    "ingredients": [
      "Räkor med skal",
      "Majonnäs",
      "Crème fraiche",
      "Dill",
      "Rödlök",
      "Citron",
      "Salt och peppar",
      "Löjrom till garnering"
    ],
    "steps": 2
  },
  "receptense": {
    "title": "Ugnsrostade rotfrukter med fetaost",
    "servings": 4,
    "cookingTimeMinutes": 50,
    "difficulty": null,
    "category": "Middag",
    "ingredients": [
      "Rotfrukter, t.ex. morot, palsternacka och rödbeta",
      "Rödlökar",
      "Olivolja",
      "Flingsalt",
      "Fetaost",
      "Färsk timjan"
    ],
    "steps": 4
  }
};

let failures = 0;
for (const [key, text] of Object.entries(RECIPE_TEXTS)) {
  const want = EXPECTED[key];
  if (!want) continue;
  const r = parseRawRecipeText(text);
  const got: Expected = {
    title: r.title,
    servings: r.servings,
    cookingTimeMinutes: r.cookingTimeMinutes ?? null,
    difficulty: r.difficulty ?? null,
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
console.log(failures === 0 ? '\nAlla recept tolkas som väntat.' : `\n${failures} recept tolkas annorlunda än väntat.`);
process.exit(failures === 0 ? 0 : 1);
