import type { Ingredient } from '../types/recipe';
import { normalizeUnit } from './ingredientParser';
import { LIVSMEDEL } from '../data/livsmedel';

/**
 * Nutrition for a recipe.
 *
 * A recipe read from a web page keeps the values the page gives (per portion, or per 100 g). For
 * the household's own recipes they are worked out from the ingredients: each ingredient is turned
 * into grams (dl, msk, st and so on) and multiplied by its values per 100 g.
 *
 * Values per 100 g come from Livsmedelsverkets livsmedelsdatabas (data/livsmedel.ts) for the foods
 * that have a number there (lmv), and from the rounded values in the table for the rest.
 * Weights per dl and per piece are Livsmedelsverket's measured ones where its "PM 2024: Volymvikter,
 * viktförändringsfaktorer och avfall" has them (marked "PM 2024"), else estimates.
 * scripts/check-nutrition.ts compares the result with recipes whose web page gives the values.
 */

export interface NutritionValues {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  salt: number;
}

export const NUTRIENTS: { key: keyof NutritionValues; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Energi', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Kolhydrater', unit: 'g' },
  { key: 'fat', label: 'Fett', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'salt', label: 'Salt', unit: 'g' },
];

export type NutritionBasis = 'portion' | '100g' | 'total';

/**
 * Values given for the recipe rather than worked out: from its web page (per portion, or per
 * 100 g when the page says so), or written in when the recipe is edited (manual).
 */
export interface PageNutrition {
  per: NutritionBasis;
  values: Partial<NutritionValues>;
  source?: 'page' | 'manual';
  /** Written in per 100 g on their own, beside values per portion or for the whole dish. They
   *  are not worked out from those, nor those from them. */
  per100g?: Partial<NutritionValues>;
}

type Per100 = [kcal: number, protein: number, carbs: number, fat: number, fiber: number, salt: number];

interface Food {
  /** Words that name the food. The longest match wins, and a match at the end of a word (the
   *  last part of "grönsaksbuljong") counts before one at the start. */
  words: string[];
  /** The food's number in Livsmedelsverkets livsmedelsdatabas, whose values are then used */
  lmv?: number;
  /** Values per 100 g where the database has no matching food (rounded, of the same kind) */
  v: Per100;
  /** Grams per ml, for dl, msk and the like. Water is 1. */
  density?: number;
  /** Grams of one piece (st), after peeling where that is how it is used */
  piece?: number;
  /** Grams of a jar, packet or bag */
  pack?: number;
  /** Too little to count, such as pepper or baking powder: it adds its weight but nothing else */
  trace?: boolean;
}

const FOODS: Food[] = [
  // Fat and dairy
  { lmv: 29, words: ['smör', 'bregott', 'margarin'], v: [740, 0.6, 0.6, 82, 0, 1.2], density: 0.95, pack: 500 },
  { lmv: 2189, words: ['olja', 'olivolja', 'rapsolja', 'sesamolja', 'kokosolja'], v: [900, 0, 0, 100, 0, 0], density: 0.92 },
  { lmv: 150, words: ['mjölk', 'mellanmjölk', 'lättmjölk'], v: [46, 3.5, 4.8, 1.5, 0, 0.1], density: 0.99 }, // PM 2024
  { lmv: 123, words: ['standardmjölk', 'helmjölk'], v: [62, 3.4, 4.7, 3, 0, 0.1], density: 0.99 }, // PM 2024
  { lmv: 1715, words: ['vispgrädde', 'grädde'], v: [370, 2.1, 3, 40, 0, 0.1], density: 1.03 }, // PM 2024
  { words: ['syrad grädde'], v: [280, 2.5, 3.5, 28, 0, 0.1], density: 1 },
  { lmv: 1717, words: ['matlagningsgrädde', 'mellangrädde'], v: [160, 3, 4, 15, 0, 0.1], density: 1 },
  { words: ['minifraiche', 'lätt crème fraiche', 'crème fraiche lätt'], v: [160, 3, 4.5, 15, 0, 0.1], density: 0.98 },
  { lmv: 1719, words: ['crème fraiche', 'creme fraiche', 'crème fraîche', 'créme fraiche'], v: [320, 2.2, 2.9, 34, 0, 0.1], density: 0.95 }, // PM 2024
  { lmv: 1713, words: ['gräddfil'], v: [130, 3, 3.5, 12, 0, 0.1], density: 1 },
  { lmv: 124, words: ['yoghurt', 'filmjölk'], v: [60, 3.5, 4.5, 3, 0, 0.1], density: 1.1 }, // PM 2024
  { lmv: 6113, words: ['turkisk yoghurt', 'grekisk yoghurt'], v: [125, 3.5, 4, 10, 0, 0.1], density: 1.05 }, // PM 2024
  { lmv: 3243, words: ['kvarg'], v: [62, 11, 3.5, 0.2, 0, 0.1], density: 1.11 }, // PM 2024
  { lmv: 7266, words: ['kokosmjölk'], v: [190, 2, 3, 19, 0, 0.05], density: 1, pack: 400 },
  { lmv: 96, words: ['ost', 'prästost', 'herrgårdsost', 'cheddar', 'cheddarost', 'västerbottensost', 'gruyère', 'gruyèreost', 'gruyereost', 'gruyéreost', 'emmentaler'], v: [380, 27, 0, 30, 0, 1.6], density: 0.4, piece: 15 },
  { lmv: 103, words: ['parmesan', 'parmesanost', 'pecorino'], v: [400, 35, 0, 29, 0, 1.6], density: 0.35 },
  { lmv: 2255, words: ['mozzarella'], v: [250, 18, 1, 19, 0, 0.5], piece: 125 },
  { lmv: 94, words: ['fetaost', 'feta', 'salladsost', 'vitost'], v: [260, 15, 1, 21, 0, 2.5], pack: 150 },
  { lmv: 100, words: ['halloumi', 'halloumiost'], v: [320, 21, 2, 25, 0, 2.7], pack: 200 },
  { words: ['mascarpone', 'mascarponeost'], v: [430, 4.6, 4, 44, 0, 0.1], density: 1, pack: 250 },
  { words: ['burrata'], v: [260, 15, 2, 21, 0, 0.5], piece: 125 },
  { lmv: 82, words: ['ädelost', 'ädel', 'gorgonzola', 'grädd ädel', 'blåmögelost'], v: [336, 21, 0, 28, 0, 1.6], piece: 15 },
  { lmv: 98, words: ['getost', 'chèvre', 'brie', 'brieost', 'camembert'], v: [330, 20, 0.5, 28, 0, 1.6], piece: 15 },
  { lmv: 107, words: ['färskost', 'philadelphia'], v: [230, 6, 4, 21, 0, 0.8], density: 1, pack: 200 },
  { lmv: 70, words: ['keso', 'cottage cheese'], v: [90, 12, 3, 4, 0, 0.8], pack: 250 },
  { lmv: 1225, words: ['ägg'], v: [140, 12.5, 0.5, 10, 0, 0.35], piece: 55 },
  { lmv: 1226, words: ['äggula', 'äggulor'], v: [330, 16, 0.5, 28, 0, 0.1], piece: 18 },
  { lmv: 1227, words: ['äggvita', 'äggvitor'], v: [50, 11, 0.5, 0, 0, 0.5], piece: 33 },

  // Meat, fish and beans
  { lmv: 951, words: ['nötfärs', 'köttfärs'], v: [190, 19, 0, 12, 0, 0.15] },
  { lmv: 2492, words: ['blandfärs', 'hushållsfärs'], v: [220, 18, 0, 16, 0, 0.15] },
  { lmv: 4583, words: ['fläskfärs'], v: [230, 17, 0, 18, 0, 0.15] },
  { words: ['kycklingfärs', 'kalkonfärs'], v: [150, 18, 0, 8, 0, 0.15] },
  { lmv: 963, words: ['högrevsfärs'], v: [220, 18, 0, 16, 0, 0.15] },
  { lmv: 1164, words: ['kyckling', 'kycklingfilé', 'kycklingfiléer', 'kycklingbröst', 'kalkon'], v: [110, 23, 0, 1.5, 0, 0.15], piece: 150 },
  { lmv: 1167, words: ['kycklinglår med skinn', 'kycklinglår m. skinn', 'kycklingklubbor', 'kycklingben', 'hel kyckling'], v: [196, 19, 0, 13.5, 0, 0.2], piece: 120 },
  { lmv: 1174, words: ['kycklinglår', 'kycklinglårfilé', 'kycklinglårfiléer'], v: [160, 18, 0, 9, 0, 0.2], piece: 90 },
  { lmv: 953, words: ['högrev', 'nötkött', 'grytbitar', 'entrecote', 'oxfilé', 'ryggbiff', 'fläskkarré', 'karré', 'lammkött'], v: [200, 19, 0, 13, 0, 0.15] },
  { lmv: 957, words: ['lövbiff', 'rostbiff', 'innanlår', 'fransyska'], v: [121, 23, 0, 3, 0, 0.2] },
  { lmv: 970, words: ['fläskfilé', 'fläskytterfilé'], v: [120, 21, 0, 3.5, 0, 0.15] },
  { lmv: 986, words: ['sidfläsk', 'fläsksida'], v: [400, 14, 0, 38, 0, 0.1] },
  { lmv: 991, words: ['rimmat fläsk', 'rimmat sidfläsk'], v: [380, 15, 0, 35, 0, 3] },
  { lmv: 1003, words: ['bacon', 'pancetta'], v: [330, 14, 0, 30, 0, 3.5], pack: 140, piece: 20 }, // PM 2024
  { lmv: 1010, words: ['skinka', 'kokt skinka'], v: [110, 19, 1, 3, 0, 2.3], piece: 6 }, // PM 2024
  { lmv: 1513, words: ['chorizo', 'salsiccia', 'färska chorizo'], v: [286, 14, 4, 24, 0, 2.7], pack: 300 },
  { lmv: 1487, words: ['falukorv', 'kycklingstekkorv', 'korv', 'prinskorv'], v: [240, 11, 5, 19, 0, 2], pack: 400, density: 0.54 }, // PM 2024
  { lmv: 1255, words: ['lax', 'laxfilé', 'laxfiléer', 'laxsida', 'laxbitar'], v: [200, 20, 0, 13, 0, 0.1], piece: 123 }, // PM 2024
  { lmv: 1246, words: ['torsk', 'torskfilé', 'torskrygg', 'torskryggfilé', 'sej', 'sejfilé', 'kolja', 'fisk', 'vitfisk', 'flundra', 'rödspätta'], v: [78, 17.5, 0, 0.8, 0, 0.2], piece: 125 }, // PM 2024
  { lmv: 1243, words: ['strömming', 'strömmingsflundra', 'strömmingsfilé', 'makrill'], v: [160, 17, 0, 10, 0, 0.2] },
  { lmv: 1395, words: ['räkor', 'räka', 'handskalade räkor'], v: [80, 18, 0, 1, 0, 1.4] },
  { lmv: 1278, words: ['tonfisk'], v: [110, 25, 0, 1, 0, 0.8], pack: 150 },
  { lmv: 1281, words: ['sill', 'inlagd sill'], v: [230, 9, 15, 15, 0, 1.5] },
  { lmv: 1265, words: ['ansjovis', 'ansjovisfiléer', 'sardell'], v: [180, 18, 6, 10, 0, 6], pack: 125 },
  { lmv: 1382, words: ['löjrom', 'stenbitsrom', 'rom'], v: [140, 23, 1, 5, 0, 4] },
  { lmv: 905, words: ['tofu'], v: [120, 12, 1, 7, 1, 0], pack: 400 },
  { lmv: 3817, words: ['bönor', 'svarta bönor', 'kidneybönor', 'vita bönor', 'bruna bönor'], v: [110, 7.5, 15, 0.5, 6.5, 0.6], density: 0.75, pack: 380 },
  { lmv: 3815, words: ['kikärtor', 'kikärter'], v: [130, 7, 16, 2.5, 6, 0.5], density: 0.65, pack: 380 },
  { lmv: 884, words: ['linser', 'röda linser', 'gröna linser'], v: [330, 24, 50, 1.5, 11, 0], density: 0.85 },
  { words: ['quorn', 'sojafärs', 'vegofärs'], v: [180, 17, 6, 9, 5, 1] },

  // Flour, grains and bread
  { lmv: 1941, words: ['vetemjöl', 'mjöl', 'dinkelmjöl'], v: [345, 10, 70, 1.5, 3, 0], density: 0.56 }, // PM 2024
  { lmv: 1935, words: ['grahamsmjöl', 'fullkornsmjöl'], v: [330, 12, 62, 2.3, 10, 0], density: 0.6 },
  { lmv: 1934, words: ['rågmjöl', 'rågsikt'], v: [320, 9, 62, 1.8, 13, 0], density: 0.55 },
  { lmv: 702, words: ['havregryn', 'havre'], v: [370, 13, 58, 7, 10, 0], density: 0.39 }, // PM 2024
  { lmv: 2481, words: ['ris', 'jasminris', 'basmatiris', 'arborioris', 'risottoris', 'grötris', 'fullkornsris'], v: [350, 7, 78, 0.6, 1.3, 0], density: 0.85 },
  { lmv: 655, words: ['risgrynsgröt'], v: [110, 3, 18, 3, 0.3, 0.3], density: 1 },
  { lmv: 845, words: ['risoni', 'orzo', 'pastaris'], v: [355, 12.5, 70, 1.5, 3.5, 0], density: 0.8 },
  { lmv: 845, piece: 20, words: ['pasta', 'spaghetti', 'lasagneplattor', 'lasagneplatta', 'tagliatelle', 'penne', 'makaroner', 'fusilli', 'nudlar', 'äggnudlar', 'risnudlar', 'linguine', 'fettuccine', 'rigatoni', 'farfalle', 'snabbmakaroner'], v: [355, 12.5, 70, 1.5, 3.5, 0], density: 0.5 },
  { lmv: 831, words: ['couscous', 'bulgur', 'matvete'], v: [360, 12, 72, 1.5, 6, 0], density: 0.75 },
  { lmv: 7025, words: ['quinoa'], v: [370, 14, 64, 6, 7, 0], density: 0.8 },
  { lmv: 244, words: ['pommes frites', 'pommes', 'frites', 'pommes strips', 'klyftpotatis', 'potatisklyftor'], v: [216, 3.2, 32, 7.6, 3.2, 0], pack: 750 },
  { lmv: 230, words: ['bakpotatis', 'bakpotatisar'], v: [75, 2, 16, 0.1, 1.5, 0], piece: 250 },
  { lmv: 230, words: ['potatis', 'potatisar', 'färskpotatis', 'mandelpotatis'], v: [75, 2, 16, 0.1, 1.5, 0], piece: 100 },
  { lmv: 3765, words: ['sötpotatis'], v: [85, 1.6, 18, 0.1, 3, 0.1], piece: 250 },
  { lmv: 200, words: ['baguette', 'surdegsbaguette', 'baguetter', 'ciabatta', 'surdegsbröd hel', 'limpa'], v: [270, 8.5, 53, 1.7, 2.6, 1], piece: 250 },
  { lmv: 200, words: ['bröd', 'formbröd', 'formfranska', 'levainbröd', 'levain', 'surdegsbröd', 'rostbröd', 'franskbröd', 'lantbröd'], v: [260, 8, 48, 3.5, 3, 1.1], piece: 30 },
  { lmv: 207, words: ['kavring', 'rågbröd'], v: [240, 6, 48, 2, 6, 1], piece: 35 },
  { lmv: 1614, words: ['savoiardikex', 'savoiardi', 'fingerkex', 'kex', 'digestivekex', 'mariekex', 'havrekex'], v: [430, 7, 70, 14, 3, 0.6], piece: 8 },
  { lmv: 162, words: ['knäckebröd', 'knäcke'], v: [350, 9, 65, 2, 17, 1.2], piece: 13 }, // PM 2024
  { lmv: 5974, words: ['tortilla', 'tortillas', 'majstortillas', 'tortillabröd', 'wraps'], v: [300, 8, 50, 7, 3, 1.2], piece: 40 },
  { lmv: 193, words: ['pitabröd', 'pita', 'naanbröd', 'naan'], v: [270, 9, 55, 1.2, 2.5, 1.2], piece: 60 },
  { lmv: 3818, words: ['hamburgerbröd', 'briochebröd', 'brioche', 'korvbröd', 'frallor', 'fralla'], v: [290, 9, 50, 6, 2.5, 1.1], piece: 60 },
  { lmv: 188, words: ['ströbröd', 'panko'], v: [380, 12, 72, 4, 4.5, 1.2], density: 0.45 },
  { words: ['krutonger'], v: [450, 10, 60, 18, 4, 1.5], density: 0.18 }, // PM 2024
  { lmv: 1945, words: ['majsstärkelse', 'maizena', 'potatismjöl'], v: [350, 0.3, 87, 0.1, 1, 0], density: 0.65 },
  { lmv: 1641, words: ['smördeg', 'pajdeg'], v: [400, 6, 38, 25, 1.5, 1], pack: 400 },

  // Sugar, chocolate and nuts
  { lmv: 1892, words: ['socker', 'strösocker', 'pärlsocker', 'råsocker', 'farinsocker', 'muscovadosocker'], v: [400, 0, 100, 0, 0, 0], density: 0.85 },
  { lmv: 1892, words: ['florsocker', 'vaniljsocker'], v: [400, 0, 100, 0, 0, 0], density: 0.55 },
  { lmv: 1894, words: ['sirap', 'ljus sirap', 'mörk sirap', 'honung', 'lönnsirap'], v: [310, 0.3, 80, 0, 0, 0], density: 1.4 },
  { lmv: 1886, words: ['kakao', 'kakaopulver'], v: [370, 20, 12, 21, 30, 0], density: 0.45 },
  { lmv: 6907, words: ['choklad', 'mörk choklad', 'blockchoklad'], v: [560, 8, 35, 40, 10, 0], pack: 100 },
  { lmv: 2055, words: ['mjölkchoklad', 'vit choklad'], v: [540, 7, 57, 31, 1, 0.2], pack: 100 },
  { lmv: 6087, words: ['mandel', 'mandlar', 'sötmandel', 'mandelspån', 'mandelmjöl'], v: [600, 21, 5, 52, 12, 0], density: 0.55 },
  { lmv: 1576, words: ['nötter', 'valnötter', 'hasselnötter', 'cashewnötter', 'pistagenötter', 'pekannötter', 'jordnötter', 'pinjenötter', 'solrosfrön', 'pumpafrön', 'sesamfrön'], v: [620, 18, 10, 55, 8, 0], density: 0.55 },
  { lmv: 1564, words: ['kokos', 'kokosflingor', 'riven kokos'], v: [650, 6, 7, 62, 15, 0], density: 0.35 },
  { lmv: 603, words: ['dadlar', 'färska dadlar', 'medjooldadlar'], v: [280, 2, 66, 0.5, 7, 0], piece: 18 },
  { lmv: 610, words: ['russin', 'torkade aprikoser'], v: [300, 3, 70, 0.5, 5, 0], density: 0.6 },
  { lmv: 1559, words: ['jordnötssmör'], v: [600, 25, 15, 50, 6, 1], density: 1 },
  { words: ['tahini'], v: [600, 17, 12, 54, 9, 0.1], density: 1.0 }, // PM 2024
  { lmv: 1798, words: ['lingonsylt', 'rårörda lingon'], v: [148, 0.2, 35, 0.2, 1, 0], density: 1.07 }, // PM 2024
  { lmv: 1801, words: ['sylt', 'marmelad', 'hallonsylt', 'jordgubbssylt'], v: [180, 0.4, 44, 0.3, 2, 0], density: 1.3 },

  // Vegetables, fruit and herbs
  { lmv: 344, words: ['lök', 'gul lök', 'rödlök', 'gula lökar', 'lökar'], v: [40, 1.2, 7.5, 0.2, 1.7, 0], piece: 110 },
  { words: ['schalottenlök', 'scharlottenlök', 'schalottenlökar', 'scharlottenlökar'], v: [40, 1.5, 8, 0.1, 2, 0], piece: 30 },
  { lmv: 354, words: ['purjolök'], v: [30, 1.5, 4.5, 0.3, 2.5, 0], piece: 200 },
  { words: ['salladslök', 'vårlök'], v: [30, 1.8, 4.5, 0.2, 2.5, 0], piece: 15 },
  { lmv: 371, words: ['vitlök', 'vitlöksklyfta', 'vitlöksklyftor'], v: [135, 6, 27, 0.5, 2, 0], piece: 5 },
  { lmv: 289, words: ['morot', 'morötter'], v: [40, 0.8, 7, 0.3, 3, 0.1], piece: 70, density: 0.45 },
  { lmv: 290, words: ['palsternacka', 'rotselleri', 'kålrot', 'rödbeta', 'rödbetor', 'rotfrukter'], v: [45, 1.3, 8, 0.3, 3.5, 0.1], piece: 150 },
  { lmv: 287, words: ['jordärtskocka', 'jordärtskockor'], v: [70, 2, 13, 0.1, 2, 0], piece: 40 },
  { lmv: 364, words: ['tomat', 'tomater', 'kvisttomater', 'plommontomater'], v: [20, 0.9, 3, 0.2, 1.2, 0], piece: 100 },
  { lmv: 364, words: ['körsbärstomat', 'körsbärstomater', 'cocktailtomater'], v: [22, 0.9, 3.5, 0.2, 1.2, 0], piece: 15 },
  { lmv: 422, words: ['krossade tomater', 'passerade tomater', 'tomatpassata', 'hela tomater'], v: [25, 1.2, 4, 0.2, 1, 0.3], density: 1.05, pack: 400 },
  { lmv: 410, words: ['tomatpuré'], v: [90, 4, 15, 0.5, 4, 0.3], density: 1.1 },
  { lmv: 365, words: ['soltorkade tomater'], v: [210, 5, 20, 12, 7, 2], density: 0.6 },
  { lmv: 339, words: ['gurka', 'gurkor'], v: [12, 0.6, 2, 0.1, 0.6, 0], piece: 350 },
  { lmv: 351, words: ['paprika', 'paprikor'], v: [30, 1, 5, 0.3, 1.8, 0], piece: 150 },
  { lmv: 333, words: ['champinjoner', 'champinjon', 'svamp', 'kantareller', 'skogssvamp', 'karljohansvamp', 'ostronskivling', 'shiitake'], v: [25, 2.5, 1.5, 0.3, 2.5, 0], piece: 15, density: 0.35 },
  { lmv: 361, words: ['spenat', 'babyspenat', 'mangold', 'grönkål'], v: [25, 2.9, 1, 0.4, 2, 0.1], density: 0.2 },
  { lmv: 340, words: ['sallad', 'romansallad', 'isbergssallad', 'ruccola', 'rucola', 'salladshuvud', 'romansalladshuvuden', 'salladsblad'], v: [15, 1.2, 2, 0.2, 1.5, 0], piece: 300, density: 0.1 },
  { lmv: 370, words: ['vitkål', 'rödkål', 'kål', 'spetskål', 'savoykål'], v: [30, 1.4, 5, 0.2, 2.5, 0], piece: 800, density: 0.3 },
  { lmv: 325, words: ['broccoli', 'blomkål', 'romanesco'], v: [33, 2.8, 3, 0.4, 2.7, 0], piece: 20, density: 0.35 }, // PM 2024
  { lmv: 362, words: ['zucchini', 'squash', 'aubergine', 'auberginer'], v: [22, 1.3, 3, 0.3, 1.5, 0], piece: 300 },
  { lmv: 336, words: ['fänkål', 'stjälkselleri', 'blekselleri', 'selleri'], v: [25, 1.2, 3.5, 0.2, 2.5, 0.1], piece: 250 },
  { lmv: 400, words: ['majs', 'majskorn'], v: [90, 3, 16, 1.5, 2.5, 0.4], density: 0.69, pack: 300 }, // PM 2024
  { words: ['ärtor', 'gröna ärtor', 'sockerärtor', 'haricots verts', 'gröna bönor', 'edamamebönor'], v: [60, 4.5, 8, 0.4, 4, 0], density: 0.6 },
  { lmv: 320, words: ['avokado', 'avokador'], v: [200, 2, 1.8, 20, 6.5, 0], piece: 150 },
  { words: ['sambal oelek', 'sambal', 'sriracha', 'harissa', 'chilipasta', 'chilisås'], v: [60, 1.5, 8, 1, 3, 5], density: 1.1 },
  { lmv: 380, words: ['chili', 'chilifrukt', 'chilifrukter', 'jalapeño', 'jalapeños'], v: [40, 2, 7, 0.4, 1.5, 0], piece: 10 },
  { lmv: 2269, words: ['ingefära'], v: [80, 1.8, 15, 0.8, 2, 0], piece: 20 },
  { lmv: 352, words: ['persilja', 'dill', 'koriander', 'basilika', 'gräslök', 'mynta', 'timjan', 'rosmarin', 'dragon', 'oregano', 'örter', 'dillvippa', 'körvel', 'hackad färsk körvel'], v: [40, 3, 5, 0.6, 3, 0], density: 0.15, piece: 2, pack: 25 },
  { words: ['äpple', 'äpplen', 'päron'], v: [55, 0.3, 12, 0.2, 2, 0], piece: 150 },
  { lmv: 553, words: ['banan', 'bananer'], v: [95, 1.2, 21, 0.3, 1.7, 0], piece: 120 },
  { lmv: 559, words: ['citron', 'citroner', 'lime', 'limefrukt', 'limefrukter'], v: [35, 0.8, 5, 0.3, 2, 0], piece: 80 },
  { lmv: 645, words: ['citronsaft', 'citronjuice', 'limesaft', 'limejuice', 'pressad citron'], v: [25, 0.4, 7, 0.2, 0.3, 0], density: 1 },
  { lmv: 551, words: ['apelsin', 'apelsiner', 'clementin', 'mandarin'], v: [45, 0.9, 9, 0.2, 2, 0], piece: 150 },
  { words: ['granatäpple', 'granatäpplekärnor', 'granatäppelkärnor'], v: [80, 1.7, 15, 1.2, 4, 0], piece: 150, density: 0.6 },
  { words: ['passionsfrukt', 'passionsfrukter'], v: [95, 2.2, 13, 0.7, 10, 0], piece: 20 },
  { words: ['mango', 'ananas', 'kiwi', 'persika', 'nektarin', 'melon', 'vattenmelon'], v: [55, 0.7, 13, 0.3, 1.6, 0], piece: 250 },
  { words: ['bär', 'blåbär', 'hallon', 'jordgubbar', 'lingon', 'vinbär', 'björnbär', 'frysta bär'], v: [45, 0.9, 8, 0.5, 4, 0], density: 0.6 },
  { lmv: 402, words: ['oliver', 'kalamataoliver'], v: [150, 1, 2, 15, 3, 3], density: 0.6 },
  { words: ['kapris'], v: [25, 2, 2, 0.8, 3, 7], density: 0.64 }, // PM 2024
  { lmv: 420, words: ['syltlök', 'picklad lök'], v: [60, 0.7, 14, 0.1, 1, 1.5], pack: 350, piece: 2 }, // PM 2024

  // Sauces, stock and drink
  { lmv: 545, words: ['buljong', 'fond', 'grönsaksbuljong', 'kycklingbuljong', 'köttbuljong', 'fiskbuljong', 'hönsbuljong', 'kalvfond', 'fiskfond'], v: [5, 0.3, 0.4, 0.2, 0, 0.8], density: 1 },
  { lmv: 1212, words: ['buljongtärning', 'buljongtärningar', 'köttbuljongtärning', 'grönsaksbuljongtärning', 'hönsbuljongtärning', 'fiskbuljongtärning'], v: [250, 10, 20, 15, 0, 45], piece: 10 },
  { lmv: 1908, words: ['vin', 'vitt vin', 'rött vin', 'rödvin', 'vitvin', 'torrt vitt vin', 'portvin', 'marsala', 'matlagningsvin', 'vitt matlagningsvin', 'rött matlagningsvin'], v: [72, 0.1, 2.5, 0, 0, 0], density: 1, pack: 750 },
  { lmv: 1957, words: ['kaffe', 'espresso', 'te'], v: [2, 0.1, 0.3, 0, 0, 0], density: 1 },
  { lmv: 1902, words: ['öl', 'mörk öl', 'porter'], v: [42, 0.4, 3.5, 0, 0, 0], density: 1, pack: 330 },
  { lmv: 1972, words: ['senap', 'dijonsenap', 'skånsk senap', 'grovkornig senap'], v: [140, 6, 12, 8, 3, 3.5], density: 1.1 },
  { lmv: 490, words: ['saltgurka', 'saltgurkor', 'inlagd gurka', 'pickles', 'picklad gurka'], v: [15, 0.9, 1.4, 0.2, 1.8, 3.5], piece: 60, pack: 400 },
  { lmv: 488, words: ['bostongurka', 'smörgåsgurka', 'gurkmajonnäs'], v: [78, 1, 16.6, 0.4, 1.8, 1.5], density: 1.02 }, // PM 2024
  { lmv: 1969, words: ['ketchup', 'chilisås', 'sweet chili', 'sweet chilisås', 'grillsås', 'bbq-sås'], v: [130, 1.2, 30, 0.2, 1, 2], density: 1.2 }, // PM 2024
  { lmv: 909, words: ['soja', 'sojasås', 'japansk soja', 'kinesisk soja', 'tamari', 'fisksås', 'ostronsås'], v: [60, 8, 6, 0, 0, 14], density: 1.15 },
  { lmv: 1988, words: ['ostsås', 'cheddarsås', 'nachosås', 'cheesesås', 'cheese sauce'], v: [154, 7.3, 7.3, 10.6, 0.1, 0.9], density: 1.05 },
  { lmv: 50, words: ['chipotlemayo', 'chipotlemajonnäs', 'mayo', 'srirachamayo', 'vitlöksmayo'], v: [666, 1.3, 5, 72.4, 0, 1.1], density: 0.96 },
  { lmv: 50, words: ['majonnäs', 'aioli', 'srirachamajonnäs', 'tryffelmajonnäs', 'remoulad', 'bearnaisesås', 'burgersås'], v: [680, 1.5, 3, 74, 0, 1.3], density: 0.96, pack: 200 }, // PM 2024
  { lmv: 45, words: ['dressing', 'caesardressing', 'vinägrett', 'salladsdressing'], v: [450, 2, 5, 47, 0, 2], density: 1, pack: 250 },
  { lmv: 2004, words: ['pesto'], v: [450, 5, 5, 45, 2, 2], density: 0.99 }, // PM 2024
  { lmv: 1965, words: ['ättiksprit'], v: [49, 0, 12, 0, 0, 0], density: 1 },
  { lmv: 1966, words: ['vinäger', 'vitvinsvinäger', 'balsamvinäger', 'äppelcidervinäger', 'ättika', 'rödvinsvinäger'], v: [20, 0, 1, 0, 0, 0], density: 1 },
  { lmv: 1975, words: ['salt', 'flingsalt', 'havssalt', 'grovsalt'], v: [0, 0, 0, 0, 0, 100], density: 1.2 },
  { words: ['vatten', 'isbitar', 'is', 'kokande vatten', 'kallt vatten', 'ljummet vatten'], v: [0, 0, 0, 0, 0, 0], density: 1, trace: true },
  { lmv: 1979, words: ['jäst', 'torrjäst'], v: [100, 12, 8, 2, 7, 0], pack: 50 },
  {
    words: [
      'peppar', 'svartpeppar', 'vitpeppar', 'kryddpeppar', 'rosépeppar', 'kanel', 'kardemumma', 'spiskummin',
      'paprikapulver', 'chilipulver', 'chiliflakes', 'cayennepeppar', 'curry', 'currypulver', 'gurkmeja', 'garam masala',
      'muskot', 'muskotnöt', 'lagerblad', 'saffran', 'vanilj', 'vaniljstång', 'vaniljpulver', 'nejlika', 'kryddnejlika',
      'ingefärspulver', 'bakpulver', 'bikarbonat', 'kryddor', 'stjärnanis', 'fänkålsfrö', 'koriander frö', 'senapsfrö',
      'torkad timjan', 'torkad oregano', 'torkad basilika', 'italiensk salladskrydda', 'tacokrydda', 'grillkrydda',
      'gelatin', 'gelatinblad', 'citronskal', 'limeskal', 'apelsinskal', 'zest', 'kryddmix', 'kryddblandning',
      'fajitakrydda', 'fajita-kryddmix', 'buljongpulver',
    ],
    v: [0, 0, 0, 0, 0, 0],
    density: 0.5,
    piece: 1,
    pack: 1,
    trace: true,
  },
];

// Gin, tonic and the like: a drink has no grams to speak of in a meal, but counts its energy
const DRINKS: Food[] = [
  { lmv: 1925, words: ['gin', 'vodka', 'rom', 'whisky', 'tequila', 'likör', 'aperol', 'campari'], v: [230, 0, 0, 0, 0, 0], density: 0.95 },
  { words: ['tonic', 'tonic water', 'läsk', 'ginger ale', 'sodavatten', 'sprite'], v: [35, 0, 9, 0, 0, 0], density: 1 },
  { lmv: 643, words: ['juice', 'apelsinjuice', 'äppeljuice', 'saft'], v: [45, 0.5, 10, 0, 0, 0], density: 1.04 },
];

const ALL_FOODS = [...FOODS, ...DRINKS];

/** A food's values per 100 g: Livsmedelsverket's when it has a number there, else the table's own */
const per100 = (food: Food): Per100 => (food.lmv && LIVSMEDEL[food.lmv] ? LIVSMEDEL[food.lmv] : food.v);

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    // Only the food: not the notes in brackets or after a comma ("gul lök, finhackad")
    .replace(/\([^)]*\)/g, ' ')
    .split(/,| till | att | för /)[0]
    // "Skivor surdegsbröd", "Färska äggulor": the unit or a word before the food
    .replace(/^(?:skivor|skiva|st|styck|bitar|färska?|färskt|hela|hel|rivna?|rivet|hackade?|hackat|kokta?|kokt|frysta?|fryst|nymalen|god|goda)\s+/, '')
    .replace(/[^a-zåäöéèüàâêîôûç\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The food in the table that the ingredient name means, if any. */
export function findFood(name: string): Food | null {
  const whole = normalizeName(name);
  // Of two choices the first one, when it is known: "ansjovisfilé à 125 g eller 1 burk matjesill".
  // Otherwise the whole name ("färska eller förvällda kantareller", "pappardelle eller fettuccine").
  const first = whole.includes(' eller ') ? matchFood(whole.split(' eller ')[0].trim()) : null;
  return first ?? matchFood(whole);
}

function matchFood(n: string): Food | null {
  if (!n) return null;
  let best: Food | null = null;
  let bestScore = 0;
  for (const food of ALL_FOODS) {
    for (const word of food.words) {
      const i = n.indexOf(word);
      if (i < 0) continue;
      const startsWord = i === 0 || /[\s-]/.test(n[i - 1]);
      const after = n.slice(i + word.length);
      const endsWord = after === '' || /^[\s-]/.test(after) || /^(?:ar|er|or|na|en|n)(?:\s|$)/.test(after);
      // A short word only as a word of its own ("is" in "isbitar" but not in "kristall")
      if (word.length <= 3 && !(startsWord && endsWord)) continue;
      if (!startsWord && !endsWord) continue;
      // The last part of a compound word names the food: "grönsaksbuljong" is stock
      const score = word.length + (endsWord ? 10 : 0) + (startsWord && endsWord ? 5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = food;
      }
    }
  }
  return best;
}

const ML_PER_UNIT: Record<string, number> = { krm: 1, tsk: 5, msk: 15, dl: 100, cl: 10, ml: 1, l: 1000, kopp: 240, droppe: 0.05 };
const G_PER_UNIT: Record<string, number> = { g: 1, hg: 100, kg: 1000 };

/** The ingredient's weight in grams, or null when the amount or the food is unknown. */
export function ingredientGrams(ing: Pick<Ingredient, 'amount' | 'unit' | 'name'>, food = findFood(ing.name)): number | null {
  const grams = gramsAsWritten(ing, food);
  // Bones are not eaten: "900 g kycklinglår med skinn och ben" is about three quarters meat
  return grams !== null && /\b(?:med|m\.)\s+(?:skinn\s+och\s+)?ben\b/i.test(ing.name) ? grams * 0.75 : grams;
}

function gramsAsWritten(ing: Pick<Ingredient, 'amount' | 'unit' | 'name'>, food: Food | null): number | null {
  const amount = typeof ing.amount === 'number' && ing.amount > 0 ? ing.amount : null;
  if (amount === null) return null;
  const pieceUnit = ['', 'st', 'pkt', 'förp', 'frp', 'förpackning', 'burk', 'påse', 'flaska'].includes((ing.unit || '').toLowerCase());
  if (pieceUnit) {
    // The weight written with it: "2 pkt saffran à 0,5 g" (each), "4 färska chorizo (ca. 300 g)" (all)
    const each = ing.name.match(/\bà\s*(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(g|kg)\b/i);
    if (each) return amount * parseFloat(each[1].replace(',', '.')) * (each[2].toLowerCase() === 'kg' ? 1000 : 1);
    const all = ing.name.match(/\(\s*(?:ca\.?|cirka)?\s*(\d+(?:[.,]\d+)?)\s*(g|kg)\s*\)/i);
    if (all) return parseFloat(all[1].replace(',', '.')) * (all[2].toLowerCase() === 'kg' ? 1000 : 1);
  }
  const raw = (ing.unit || '').toLowerCase().trim();
  const unit = ({ förpackning: 'förp', förpackningar: 'förp', frp: 'förp', paket: 'pkt', flaskor: 'flaska' } as Record<string, string>)[raw] ?? (normalizeUnit(raw) || raw);
  if (G_PER_UNIT[unit]) return amount * G_PER_UNIT[unit];
  if (ML_PER_UNIT[unit]) return amount * ML_PER_UNIT[unit] * (food?.density ?? 1);
  if (!food) return null;
  switch (unit) {
    case '':
    case 'st':
      return food.piece ? amount * food.piece : null;
    case 'klyfta':
      return amount * (food.piece && food.piece <= 10 ? food.piece : 5);
    case 'skiva':
      return amount * (food.piece && food.piece <= 40 ? food.piece : 20);
    case 'burk':
    case 'pkt':
    case 'frp':
    case 'förp':
    case 'förpackning':
    case 'påse':
      return amount * (food.pack ?? 250);
    case 'flaska':
      return amount * (food.pack ?? 750);
    case 'kruka':
    case 'knippe':
      return amount * 25;
    case 'blad':
      return amount * 2;
    case 'stjälk':
    case 'stjälkar':
      return amount * 40;
    case 'nypa':
      return amount * 0.5;
    case 'näve':
      return amount * 30;
    case 'tärning':
      return amount * (food.piece ?? 10);
    case 'port':
    case 'portion':
    case 'portioner':
      // "4 port ris": a portion of rice or pasta before cooking
      return amount * 70;
    default:
      return null;
  }
}

const zero = (): NutritionValues => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, salt: 0 });

export interface CalculatedNutrition {
  total: NutritionValues;
  /** Weight of the ingredients that were counted, in grams */
  grams: number;
  counted: number;
  /** Ingredients that could not be counted (unknown food, or no amount for something that matters) */
  missing: string[];
  /** The same with their amounts, for saying what is left out */
  missingItems: Pick<Ingredient, 'amount' | 'unit' | 'name'>[];
  /** Weight of what is left out, as far as it can be told from the amounts (grams, kg, dl) */
  missingGrams: number;
}

/** Nutrition of the whole dish from its ingredients. */
export function calculateNutrition(ingredients: Pick<Ingredient, 'amount' | 'unit' | 'name'>[]): CalculatedNutrition {
  const total = zero();
  let grams = 0;
  let counted = 0;
  const missing: string[] = [];
  const missingItems: Pick<Ingredient, 'amount' | 'unit' | 'name'>[] = [];
  let missingGrams = 0;
  for (const ing of ingredients) {
    // Salt for the water pasta or potatoes cook in is poured away with it
    if (/salt/i.test(ing.name) && /(?:pasta|kok|potatis)vatten|vattnet/i.test(ing.name)) {
      counted++;
      continue;
    }
    const food = findFood(ing.name);
    if (food?.trace) {
      // Pepper, water, baking powder: their weight if known, nothing else
      grams += ingredientGrams(ing, food) ?? 0;
      counted++;
      continue;
    }
    const g = food ? ingredientGrams(ing, food) : null;
    if (!food || g === null) {
      // Without an amount ("Salt", "Smör till stekning", "Olivolja efter smak") it cannot be counted,
      // and it is usually a little: left out without a note
      const optional = ing.amount == null || !(typeof ing.amount === 'number' && ing.amount > 0);
      if (optional) {
        counted++;
        continue;
      }
      missing.push(ing.name);
      missingItems.push(ing);
      missingGrams += ingredientGrams(ing, null) ?? 0;
      continue;
    }
    grams += g;
    counted++;
    (Object.keys(total) as (keyof NutritionValues)[]).forEach((k, i) => {
      total[k] += (per100(food)[i] * g) / 100;
    });
  }
  return { total, grams, counted, missing, missingItems, missingGrams };
}

export const scaleNutrition = (v: Partial<NutritionValues>, factor: number): Partial<NutritionValues> => {
  const out: Partial<NutritionValues> = {};
  for (const n of NUTRIENTS) if (typeof v[n.key] === 'number') out[n.key] = (v[n.key] as number) * factor;
  return out;
};

/** The weight of the dish in grams from its ingredients, or null when too few can be weighed. */
export function recipeGrams(ingredients: Pick<Ingredient, 'amount' | 'unit' | 'name'>[]): number | null {
  const calc = calculateNutrition(ingredients || []);
  const weighable = ingredients.length > 0 && calc.missing.length <= ingredients.length * 0.3 && calc.grams > 0;
  return weighable ? calc.grams : null;
}

/**
 * Values given for one basis (a portion, 100 g or the whole dish) as all three. 100 g needs the
 * dish's weight; without it that one is missing.
 */
export function nutritionForAllBases(
  values: Partial<NutritionValues>,
  per: NutritionBasis,
  servings: number,
  grams: number | null
): { total?: Partial<NutritionValues>; perPortion?: Partial<NutritionValues>; per100g?: Partial<NutritionValues> } {
  const portions = servings > 0 ? servings : 4;
  const total =
    per === 'total' ? values : per === 'portion' ? scaleNutrition(values, portions) : grams ? scaleNutrition(values, grams / 100) : undefined;
  return {
    total,
    perPortion: per === 'portion' ? values : total ? scaleNutrition(total, 1 / portions) : undefined,
    per100g: per === '100g' ? values : total && grams ? scaleNutrition(total, 100 / grams) : undefined,
  };
}

export interface RecipeNutrition {
  source: 'page' | 'manual' | 'calculated';
  /** For values written in: which columns were written, the rest is worked out from the ingredients */
  manual?: { portion: boolean; per100g: boolean };
  total?: Partial<NutritionValues>;
  perPortion?: Partial<NutritionValues>;
  per100g?: Partial<NutritionValues>;
  missing: string[];
  missingItems: Pick<Ingredient, 'amount' | 'unit' | 'name'>[];
  /** Share of the dish's weight that is left out (0 to 1), when it can be told */
  missingShare: number;
  counted: number;
  ingredientCount: number;
}

/**
 * Nutrition for the whole dish, per portion and per 100 g. From the web page when the recipe has
 * its values, otherwise from the ingredients. Null when too little of it can be worked out.
 */
export function recipeNutrition(recipe: {
  ingredients: Pick<Ingredient, 'amount' | 'unit' | 'name'>[];
  servings: number;
  pageNutrition?: PageNutrition;
}): RecipeNutrition | null {
  const servings = recipe.servings > 0 ? recipe.servings : 4;
  const calc = calculateNutrition(recipe.ingredients || []);
  // The weight is only worth using when most of the ingredients could be weighed
  const weighable = recipe.ingredients.length > 0 && calc.missing.length <= recipe.ingredients.length * 0.3 && calc.grams > 0;
  const base = {
    missing: calc.missing,
    missingItems: calc.missingItems,
    missingShare: calc.missingGrams > 0 ? calc.missingGrams / (calc.missingGrams + calc.grams) : 0,
    counted: calc.counted,
    ingredientCount: recipe.ingredients.length,
  };

  const page = recipe.pageNutrition;
  const calculated =
    calc.counted > 0 && calc.counted >= recipe.ingredients.length * 0.5
      ? {
          total: calc.total,
          perPortion: scaleNutrition(calc.total, 1 / servings),
          per100g: calc.grams > 0 ? scaleNutrition(calc.total, 100 / calc.grams) : undefined,
        }
      : null;

  // Written in by hand: a portion and the whole dish go together, 100 g stands on its own. What
  // was not written in is worked out from the ingredients.
  if (page?.source === 'manual') {
    const linked = page.per !== '100g' && Object.keys(page.values).length ? nutritionForAllBases(page.values, page.per, servings, null) : null;
    const own100 = page.per100g && Object.keys(page.per100g).length ? page.per100g : page.per === '100g' ? page.values : undefined;
    return {
      source: 'manual',
      manual: { portion: Boolean(linked), per100g: Boolean(own100) },
      total: linked?.total ?? calculated?.total,
      perPortion: linked?.perPortion ?? calculated?.perPortion,
      per100g: own100 ?? calculated?.per100g,
      ...base,
    };
  }

  if (page && Object.keys(page.values).length > 0) {
    return {
      source: 'page',
      ...nutritionForAllBases(page.values, page.per, servings, weighable ? calc.grams : null),
      ...base,
    };
  }

  if (calc.counted === 0 || calc.counted < recipe.ingredients.length * 0.5) return null;
  return {
    source: 'calculated',
    total: calc.total,
    perPortion: scaleNutrition(calc.total, 1 / servings),
    per100g: calc.grams > 0 ? scaleNutrition(calc.total, 100 / calc.grams) : undefined,
    ...base,
  };
}

// ── Values from web pages ──────────────────────────────────────────────────

const numberIn = (value: unknown): number | undefined => {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const m = value.replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : undefined;
};

/** schema.org NutritionInformation from a page's recipe data. */
export function nutritionFromSchema(n: any): PageNutrition | null {
  if (!n || typeof n !== 'object') return null;
  const values: Partial<NutritionValues> = {};
  const energy = typeof n.calories === 'string' ? n.calories : n.calories != null ? String(n.calories) : '';
  const kcal = numberIn(energy);
  if (kcal !== undefined) values.kcal = /kj/i.test(energy) && !/kcal/i.test(energy) ? kcal / 4.184 : kcal;
  const grams = (v: unknown) => {
    const x = numberIn(v);
    if (x === undefined) return undefined;
    return typeof v === 'string' && /\bmg\b/i.test(v) ? x / 1000 : x;
  };
  const set = (key: keyof NutritionValues, v: unknown) => {
    const x = grams(v);
    if (x !== undefined) values[key] = x;
  };
  set('protein', n.proteinContent);
  set('carbs', n.carbohydrateContent);
  set('fat', n.fatContent);
  set('fiber', n.fiberContent);
  if (n.saltContent != null) set('salt', n.saltContent);
  else if (n.sodiumContent != null) {
    const sodium = grams(n.sodiumContent);
    if (sodium !== undefined) values.salt = sodium * 2.5;
  }
  if (Object.keys(values).length === 0) return null;
  const size = String(n.servingSize || '');
  return { per: /\b100\s*g\b/i.test(size) ? '100g' : 'portion', values };
}

/**
 * Nutrition written on a page as text: "Näringsvärde per portion: Energi 580 kcal | Protein 32 g |
 * Kolhydrater 44 g | Fett 28 g". Only when it says per portion or per 100 g.
 */
export function nutritionFromText(text: string): PageNutrition | null {
  const at = text.search(/näringsvärde|näringsinnehåll|näring per|näringsdeklaration/i);
  if (at < 0) return null;
  const part = text.slice(at, at + 600);
  const per = /per\s+100\s*g/i.test(part) ? '100g' : /per\s+(?:portion|person|port)/i.test(part) ? 'portion' : null;
  if (!per) return null;
  const values: Partial<NutritionValues> = {};
  const pick = (re: RegExp) => {
    const m = part.match(re);
    return m ? parseFloat(m[1].replace(',', '.')) : undefined;
  };
  const kcal = pick(/(\d+(?:[.,]\d+)?)\s*kcal/i) ?? pick(/energi[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(?:kcal)?/i);
  if (kcal !== undefined) values.kcal = kcal;
  const grams: [keyof NutritionValues, RegExp][] = [
    ['protein', /protein[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*g/i],
    ['carbs', /kolhydrat\w*[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*g/i],
    ['fat', /fett[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*g/i],
    ['fiber', /fiber[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*g/i],
    ['salt', /salt[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*g/i],
  ];
  for (const [key, re] of grams) {
    const v = pick(re);
    if (v !== undefined) values[key] = v;
  }
  return Object.keys(values).length >= 2 ? { per, values } : null;
}

// ── Saving with the recipe ─────────────────────────────────────────────────

/**
 * The page's values are kept as a hidden tag, like the difficulty, so no new column is needed in
 * the database: "__naring:portion:kcal=490;protein=24;carbs=52;fat=19;salt=1.4". Values written in
 * by hand are marked "+egen": "__naring:total+egen:kcal=2400;..."
 */
const TAG_PREFIX = '__naring:';

export function splitNutritionTag(tags: string[] | undefined): { nutrition?: PageNutrition; tags: string[] } {
  let nutrition: PageNutrition | undefined;
  const rest = (tags || []).filter((t) => {
    if (typeof t !== 'string' || !t.startsWith(TAG_PREFIX)) return true;
    const [head, body = ''] = t.slice(TAG_PREFIX.length).split(':');
    const [per, how] = head.split('+');
    const read = (part: string) => {
      const values: Partial<NutritionValues> = {};
      for (const pair of part.split(';')) {
        const [k, v] = pair.split('=');
        const x = parseFloat(v);
        if (NUTRIENTS.some((n) => n.key === k) && isFinite(x)) values[k as keyof NutritionValues] = x;
      }
      return values;
    };
    const [main, own100 = ''] = body.split('|');
    const values = read(main);
    const per100g = read(own100);
    if ((per === 'portion' || per === '100g' || per === 'total') && (Object.keys(values).length || Object.keys(per100g).length)) {
      nutrition = { per, values, source: how === 'egen' ? 'manual' : 'page' };
      if (Object.keys(per100g).length) nutrition.per100g = per100g;
    }
    return false;
  });
  return { nutrition, tags: rest };
}

export function withNutritionTag(tags: string[], nutrition: PageNutrition | undefined): string[] {
  const rest = splitNutritionTag(tags).tags;
  if (!nutrition || (Object.keys(nutrition.values).length === 0 && !nutrition.per100g)) return rest;
  const write = (v: Partial<NutritionValues>) =>
    NUTRIENTS.filter((n) => typeof v[n.key] === 'number')
      .map((n) => `${n.key}=${Math.round((v[n.key] as number) * 10) / 10}`)
      .join(';');
  // Values per 100 g written in on their own come after a "|"
  const body = write(nutrition.values) + (nutrition.per100g ? `|${write(nutrition.per100g)}` : '');
  return [...rest, `${TAG_PREFIX}${nutrition.per}${nutrition.source === 'manual' ? '+egen' : ''}:${body}`];
}
