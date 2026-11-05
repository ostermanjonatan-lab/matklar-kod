import type { Ingredient, Instruction, RecipeCategory } from '../types/recipe';
import { capitalizeFirst, cleanLeadingStepNumber, parseRecipeTimeString } from './formatters';
import { detectCategory, detectSubcategories } from './categoryDetector';

export interface ParsedRecipeData {
  title: string;
  description: string;
  category: RecipeCategory;
  subcategory: string;
  subcategories?: string[];
  servings: number;
  cookingTimeMinutes?: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
}

/**
 * Determines whether an ingredient is considered a pantry staple (basvara).
 * Pantry staples are basic kitchen staples that users almost always have at home:
 * - Salt & black pepper (salt, flingsalt, svartpeppar, etc.)
 * - Cooking oils (rapsolja, matolja, olivolja, etc.)
 * - Butter/fat specifically for frying or greasing pans (smör till stekning, etc.)
 * - Tap water & ice (vatten, isbitar)
 * 
 * Fresh ingredients like milk (mjölk), dairy, plain butter, flour, sugar, baking
 * goods and specialty spices are NOT pantry staples and must be bought.
 */
export function isCommonPantryStaple(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase().trim();

  // 1. HARD EXCLUSIONS: Ingredients that should NEVER be considered pantry staples
  // Mjölk in all forms (mellanmjölk, kokosmjölk, havremjölk, etc.)
  if (lower.includes('mjölk')) return false;

  // Dairy, fresh goods, cheese, eggs
  if (
    lower.includes('grädde') ||
    lower.includes('creme fraiche') ||
    lower.includes('crème fraiche') ||
    lower.includes('yoghurt') ||
    lower.includes('kvarg') ||
    lower.includes('fil') ||
    lower.includes('ost') ||
    lower.includes('ägg')
  ) {
    return false;
  }

  // Prepared foods or ingredients with "salt", "peppar", "smör" in their name that are NOT staples
  if (
    lower.includes('saltgurka') ||
    lower.includes('saltsill') ||
    lower.includes('salt kött') ||
    lower.includes('saltat') ||
    lower.includes('salt karamell') ||
    lower.includes('saltkaramell') ||
    lower.includes('salta pinnar') ||
    lower.includes('salta nötter') ||
    lower.includes('salta mandlar') ||
    lower.includes('salt mandel') ||
    lower.includes('pepparrot') ||
    lower.includes('pepparkak') ||
    lower.includes('pepparsås') ||
    lower.includes('pepparbiff') ||
    lower.includes('chilipeppar') ||
    lower.includes('spansk peppar') ||
    lower.includes('cayennepeppar') ||
    lower.includes('smördeg') ||
    lower.includes('smörbönor') ||
    lower.includes('smörböna') ||
    lower.includes('jordnötssmör') ||
    lower.includes('mandelsmör') ||
    lower.includes('cashewsmör') ||
    lower.includes('smörkräm') ||
    lower.includes('smörgås')
  ) {
    return false;
  }

  // Flour, sugars, baking goods, grains, dry goods, bouillon, sauces
  if (
    lower.includes('mjöl') ||
    lower.includes('socker') ||
    lower.includes('sirap') ||
    lower.includes('kakao') ||
    lower.includes('bakpulver') ||
    lower.includes('bikarbonat') ||
    lower.includes('jäst') ||
    lower.includes('ströbröd') ||
    lower.includes('havregryn') ||
    lower.includes('buljong') ||
    lower.includes('fond') ||
    lower.includes('soja') ||
    lower.includes('vinäger')
  ) {
    return false;
  }

  // 2. SMÖR / FETT TILL STEKNING (Only when explicitly specified for frying / greasing)
  // E.g. "Smör till stekning", "Smör att steka i", "Smör till formen", "Smör till mos och stekning", "Margarin till stekning"
  const isFryingFat =
    (lower.includes('smör') || lower.includes('margarin') || lower.includes('matfett')) &&
    (lower.includes('stekning') ||
      lower.includes('steka i') ||
      lower.includes('att steka') ||
      lower.includes('formen') ||
      lower.includes('bryning') ||
      lower.includes('pensling'));
  if (isFryingFat) return true;

  // Plain "smör" without frying context is an ingredient that needs to be bought
  if (lower.includes('smör') || lower.includes('margarin')) return false;

  // 3. BASIC COOKING OILS (Rapsolja, olivolja, matolja, olja till stekning)
  if (
    lower.includes('rapsolja') ||
    lower.includes('matolja') ||
    lower.includes('stekolja') ||
    lower.includes('solrosolja') ||
    lower.includes('majsolja') ||
    lower.includes('olivolja') ||
    lower.includes('olio extra') ||
    lower.includes("d'oliva") ||
    lower.includes('doliva') ||
    lower === 'olja' ||
    lower.startsWith('olja ') ||
    lower.endsWith(' olja') ||
    lower.includes('olja till stekning') ||
    lower.includes('olja att steka i')
  ) {
    // Exclude specialty oils
    if (
      lower.includes('tryffel') ||
      lower.includes('sesam') ||
      lower.includes('chili') ||
      lower.includes('linfrö') ||
      lower.includes('avokado')
    ) {
      return false;
    }
    // Exclude goods preserved in or mixed with oil (e.g. "soltorkade tomater i olja", "tonfisk i olivolja")
    if (/\s(i|med)\s+.*olja\b/.test(lower)) {
      return false;
    }
    return true;
  }

  // Other peppers must be bought, also when combined with salt (e.g. "Flingsalt & Citronpeppar")
  if (/(vit|krydd|grön|citron|rosé|rose|rosa|fyr)\s?peppar|pepparmix/.test(lower)) {
    return false;
  }

  // 4. SALT (salt, flingsalt, havssalt, örtsalt, grovsalt, bordssalt, salt & peppar)
  if (
    lower === 'salt' ||
    lower.startsWith('salt ') ||
    lower.endsWith(' salt') ||
    lower.includes('flingsalt') ||
    lower.includes('havssalt') ||
    lower.includes('örtsalt') ||
    lower.includes('grovsalt') ||
    lower.includes('bordssalt') ||
    lower.includes('jozo salt') ||
    lower.includes('salt till ') ||
    lower.includes('salt och ') ||
    lower.includes('salt & ')
  ) {
    return true;
  }

  // 5. PEPPAR (Only black pepper; unspecified "peppar" means black pepper)
  // Vitpeppar, kryddpeppar, citronpeppar etc. are NOT pantry staples
  if (
    lower === 'peppar' ||
    lower.startsWith('peppar ') ||
    lower.includes('svartpeppar') ||
    lower.includes('svart peppar') ||
    lower.includes('nymalen peppar') ||
    lower.includes('grovmalen peppar')
  ) {
    return true;
  }

  // 6. VATTEN & IS (Tap water & ice are always free and available at home)
  if (
    lower === 'vatten' ||
    lower.includes('kranvatten') ||
    lower.includes('kallt vatten') ||
    lower.includes('varmt vatten') ||
    lower.includes('kokande vatten') ||
    lower.includes('ljummet vatten') ||
    lower.includes('vatten till ') ||
    lower.includes('isbit') ||
    lower === 'is'
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves the aisle of a saved item. The user's own choices are stored separately as
 * aisle overrides, so a saved aisle is re-detected from the name. This moves items that
 * older rules filed wrongly. The saved aisle is kept only when the name is not recognised.
 */
export function resolveSavedAisle(name: string, aisle?: string): string {
  const detected = detectAisle(name);
  if (detected === 'Övrigt' && aisle) return aisle;
  return detected;
}

export function detectAisle(name: string): string {
  if (!name) return 'Övrigt';
  const l = name.toLowerCase().trim();

  // 1. SPECIFIC PRIORITIES & OVERRIDES
  // Frozen items (must come before fresh berries, vegetables, meats)
  if (
    l.includes('fryst') ||
    l.includes('djupfryst') ||
    l.includes('glass') ||
    l.includes('isglass') ||
    l.includes('sorbet') ||
    l.includes('pommes') ||
    l.includes('kroketter') ||
    l.includes('pyttipanna') ||
    l.includes('vårrull') ||
    l.includes('fiskpinn') ||
    l.includes('frysta') ||
    l.includes('smördeg') ||
    l.includes('wokgrönsak') ||
    l.includes('edamame') ||
    l.includes('wonton') ||
    l.includes('nuggets') ||
    l.includes('pannkakor') ||
    (/(^|\s)(gröna )?ärt(or|er)\b/.test(l) && !l.includes('gula'))
  ) {
    return 'Fryst';
  }

  // Jars, pickles, spreads and processed goods whose names contain a vegetable,
  // dairy or meat word (e.g. "inlagd gurka", "jordnötssmör", "hjortronsylt", "potatismjöl")
  if (
    l.includes('inlagd') ||
    l.includes('pickles') ||
    l.includes('saltgurka') ||
    l.includes('bostongurka') ||
    l.includes('smörgåsgurka') ||
    l.includes('ättiksgurka') ||
    l.includes('kryddgurka') ||
    /rostade? lök|stekt lök|rostad paprika|grillad paprika/.test(l) ||
    l.includes('kronärtskockshjärt') ||
    l.includes('bambuskott') ||
    l.includes('vattenkastanj') ||
    l.includes('tomatsås') ||
    l.includes('pastasås') ||
    l.includes('ketchup') ||
    /sylt(?!a\b)/.test(l) ||
    l.includes('marmelad') ||
    l.includes('äppelmos') ||
    l.includes('mospulver') ||
    /mjöl(?!k)/.test(l) ||
    l.includes('stärkelse') ||
    l.includes('jordnötssmör') ||
    l.includes('mandelsmör') ||
    l.includes('cashewsmör') ||
    l.includes('tahini') ||
    l.includes('ströbröd') ||
    l.includes('chips') ||
    l.includes('nachos') ||
    l.includes('tacoskal') ||
    /curry\s?pasta|curry paste/.test(l) ||
    /vanilj(stång|stänger|extrakt|pulver|socker|arom)/.test(l) ||
    (l.includes('choklad') && !l.includes('chokladmjölk') && !l.includes('chokladpudding')) ||
    l.includes('kondenserad mjölk') ||
    l.includes('mjölkpulver') ||
    l.includes('strössel') ||
    l.includes('marsipan') ||
    l.includes('mandelmassa') ||
    l.includes('glasyr') ||
    l.includes('gnocchi') ||
    l.includes('tortellini') ||
    l.includes('ravioli')
  ) {
    return 'Skafferi';
  }

  // Fresh produce whose names would otherwise match a later aisle
  // (e.g. "rucola" contains "cola", "böngroddar" contains "bön")
  if (
    l.includes('rucola') ||
    l.includes('groddar') ||
    l.includes('ärtskott') ||
    l.includes('kronärtskock') ||
    l.includes('rotfrukt') ||
    l.includes('rotsaker')
  ) {
    return 'Frukt & Grönt';
  }

  // Dry powdered spices or herbs (must come before fresh vegetables/herbs)
  if (
    l.includes('vitlökspulver') ||
    l.includes('lökpulver') ||
    l.includes('ingefärspulver') ||
    l.includes('chilipulver') ||
    l.includes('chiliflakes') ||
    l.includes('chili flakes') ||
    l.includes('sellerisalt') ||
    l.includes('örtsalt') ||
    l.includes('dillfrö') ||
    l.includes('fänkålsfrö') ||
    l.includes('torkad dill') ||
    l.includes('torkad basilika') ||
    l.includes('torkad timjan') ||
    l.includes('torkad oregano') ||
    l.includes('torkad persilja') ||
    l.includes('torkad rosmarin') ||
    l.includes('torkad koriander') ||
    l.includes('torkad dragon') ||
    /(paprika|curry|cayenne|vitlöks|chili)pulver/.test(l) ||
    /(koriander|senaps|fänkåls|kummin|anis)frö/.test(l) ||
    /(vit|svart|krydd|grön|citron|rosé|rose|rosa|fyr)\s?peppar|pepparmix/.test(l) ||
    l.includes('limeblad') ||
    l.includes('kaffirlime') ||
    l.includes('aromat') ||
    l.includes('krydda') ||
    l.includes('kryddor') ||
    l.includes('kryddmix') ||
    /provencalska|provençalska|herbes de/.test(l) ||
    // Ground spices, e.g. "malen ingefära", "mald kardemumma" (not ground coffee or nuts)
    (/(^|\s)(malen|mald|malet|malda)\s/.test(l) && !/kaffe|mandel|nöt|kött|färs/.test(l))
  ) {
    return 'Kryddor & Olja';
  }

  // Other dried goods (dried fruit, dried mushrooms)
  if (/(^|\s)torkade?\s/.test(l)) {
    if (/mynta|salvia|chili|lagerblad|örter|citrongräs/.test(l)) return 'Kryddor & Olja';
    return 'Skafferi';
  }

  // Bottled chili sauces, sweet chili, sriracha, salsa & condiments (must come before fresh chili in Frukt & Grönt)
  if (
    l.includes('chilisås') ||
    l.includes('chili sås') ||
    l.includes('chilisauce') ||
    l.includes('chili sauce') ||
    l.includes('sweet chili') ||
    l.includes('sriracha') ||
    l.includes('sambal') ||
    l.includes('tacosås') ||
    l.includes('taco sauce') ||
    l.includes('chilipasta') ||
    l.includes('chilimajonnäs') ||
    l.includes('chilimayo')
  ) {
    return 'Skafferi';
  }

  // Corn / canned corn (must come before fresh produce unless explicitly fresh corn on the cob)
  if (
    (l === 'majs' ||
      l.startsWith('majs ') ||
      l.endsWith(' majs') ||
      l.includes(' majs ') ||
      l.includes('majskorn') ||
      l.includes('burkmajs') ||
      l.includes('majsburk') ||
      l.includes('minimajs') ||
      l.includes('majsstärkelse') ||
      l.includes('majs i burk') ||
      l.includes('majs på burk') ||
      l.includes('konserverad majs')) &&
    !l.includes('kolv') &&
    !l.includes('färsk')
  ) {
    return 'Skafferi';
  }

  // Canned/processed tomatoes & coconut milk & canned beans
  if (
    l.includes('krossade tomat') ||
    l.includes('passerade tomat') ||
    l.includes('tomatpuré') ||
    l.includes('tomatpure') ||
    l.includes('soltorkad') ||
    l.includes('burktomat') ||
    l.includes('kokosmjölk') ||
    l.includes('kokosgrädde') ||
    l.includes('refried') ||
    l.includes('baked beans') ||
    l.includes('vita bönor i tomatsås')
  ) {
    return 'Skafferi';
  }

  // Stock, fish sauce & fusilli (must come before meat and fish, "fusilli" contains "sill")
  if (
    /fond\b/.test(l) ||
    l.includes('buljong') ||
    l.includes('fisksås') ||
    l.includes('fusilli')
  ) {
    return 'Skafferi';
  }

  // Vinegar (must come before Drycker, "vitvinsvinäger" contains "vitvin")
  if (l.includes('vinäger')) {
    return 'Kryddor & Olja';
  }

  // Lemon & lime juice used in cooking (must come before Drycker)
  if (/(citron|lime)\s?(saft|juice)/.test(l)) {
    return 'Frukt & Grönt';
  }

  // Cakes & cookies (must come before fruit and meat, "banankaka" contains "banan" and "anka")
  if (/kak(a|or)\b/.test(l) && !l.includes('ostkaka')) {
    return 'Bröd & Bageri';
  }

  // 2. MEJERI
  if (
    l.includes('mjölk') ||
    l.includes('grädde') ||
    l.includes('smör') ||
    l.includes('margarin') ||
    l.includes('bregott') ||
    l.includes('lätta') ||
    (l.includes('ost') && !/rosta|rostb|frost|crost|ostron/.test(l)) ||
    l.includes('parmesan') ||
    l.includes('parmigiano') ||
    l.includes('pecorino') ||
    l.includes('grana padano') ||
    l.includes('mozzarella') ||
    l.includes('burrata') ||
    l.includes('feta') ||
    l.includes('salladsost') ||
    l.includes('halloumi') ||
    l.includes('grillost') ||
    l.includes('chèvre') ||
    l.includes('chevre') ||
    l.includes('brie') ||
    l.includes('camembert') ||
    l.includes('ädelost') ||
    l.includes('blåmögel') ||
    l.includes('gorgonzola') ||
    l.includes('mascarpone') ||
    l.includes('ricotta') ||
    l.includes('färskost') ||
    l.includes('philadelphia') ||
    l.includes('västerbotten') ||
    l.includes('gouda') ||
    l.includes('cheddar') ||
    l.includes('crème') ||
    l.includes('créme') ||
    l.includes('creme fraiche') ||
    l.includes('gräddfil') ||
    l.includes('smetana') ||
    l.includes('yoghurt') ||
    l.includes('filmjölk') ||
    (l === 'fil' || l.startsWith('fil ') || l.endsWith(' fil') || l.includes('lättfil')) ||
    l.includes('kvarg') ||
    l.includes('keso') ||
    l.includes('cottage cheese') ||
    l.includes('cream cheese') ||
    l.includes('kesella') ||
    /(^|\s)i\s?mat\b|oatly/.test(l) ||
    l.includes('vaniljsås') ||
    l.includes('tofu') ||
    l.includes('hummus') ||
    l.includes('ostkaka') ||
    (l.includes('ägg') && !l.includes('äggnudl')) ||
    l.includes('havremjölk') ||
    l.includes('sojamjölk') ||
    l.includes('mandelmjölk')
  ) {
    return 'Mejeri';
  }

  // 3. KÖTT & CHARK
  if (
    l.includes('kyckling') ||
    l.includes('kalkon') ||
    /(^|\s)anka\b|ankbröst|anklår/.test(l) ||
    /(?<!inge)färs(?!k)/.test(l) || // Not "färsk ingefära" or "ingefärsbit"
    l.includes('blandfärs') ||
    l.includes('nötfärs') ||
    l.includes('fläskfärs') ||
    l.includes('kalvfärs') ||
    l.includes('lammfärs') ||
    l.includes('vegofärs') ||
    l.includes('köttfärs') ||
    l.includes('nötkött') ||
    l.includes('oxfilé') ||
    l.includes('oxfile') ||
    l.includes('entrecôte') ||
    l.includes('entrecote') ||
    l.includes('ryggbiff') ||
    l.includes('rostbiff') ||
    (l.includes('biff') && !l.includes('bifftomat')) ||
    l.includes('högrev') ||
    l.includes('fransyska') ||
    l.includes('innanlår') ||
    l.includes('flankstek') ||
    l.includes('karré') ||
    l.includes('grytbit') ||
    l.includes('kalv') ||
    l.includes('fläsk') ||
    l.includes('bacon') ||
    l.includes('sidfläsk') ||
    l.includes('kotlett') ||
    l.includes('spjäll') ||
    l.includes('revben') ||
    l.includes('skinka') ||
    l.includes('prosciutto') ||
    l.includes('parmaskinka') ||
    l.includes('serrano') ||
    l.includes('salami') ||
    l.includes('pepperoni') ||
    l.includes('chorizo') ||
    l.includes('korv') ||
    l.includes('falukorv') ||
    l.includes('prinskorv') ||
    l.includes('bratwurst') ||
    l.includes('wienerkorv') ||
    l.includes('köttbull') ||
    l.includes('leverpastej') ||
    l.includes('guanciale') ||
    l.includes('pancetta') ||
    l.includes('lamm') ||
    l.includes('älg') ||
    /hjort(?!ron)/.test(l) ||
    l.includes('kassler') ||
    l.includes('pulled pork') ||
    l.includes('hamburgare') ||
    l.includes('kebab') ||
    l.includes('anklever') ||
    /(^|\s)sylta\b/.test(l) ||
    l.includes('rådjur') ||
    l.includes('vildsvin')
  ) {
    return 'Kött & Chark';
  }

  // 4. FISK & SKALDJUR
  if (
    l.includes('lax') ||
    l.includes('torsk') ||
    l.includes('fisk') ||
    l.includes('sej') ||
    l.includes('kolja') ||
    l.includes('hälleflundra') ||
    l.includes('spätta') ||
    l.includes('rödspätta') ||
    l.includes('gös') ||
    l.includes('abborre') ||
    l.includes('gädda') ||
    l.includes('sill') ||
    l.includes('strömming') ||
    l.includes('makrill') ||
    l.includes('böckling') ||
    l.includes('tonfisk') ||
    l.includes('röding') ||
    l.includes('öring') ||
    l.includes('räk') ||
    l.includes('scampi') ||
    l.includes('kräft') ||
    l.includes('hummer') ||
    l.includes('krabb') ||
    l.includes('mussl') ||
    l.includes('bläckfisk') ||
    l.includes('calamari') ||
    (l.includes('rom') && !l.includes('rosmarin') && !l.includes('arom') && !l.includes('romansallad') && !l.includes('fromage')) ||
    l.includes('löjrom') ||
    l.includes('sikrom') ||
    l.includes('kaviar') ||
    l.includes('sardin') ||
    l.includes('ansjovis') ||
    l.includes('surimi')
  ) {
    return 'Fisk & Skaldjur';
  }

  // 5. DRYCKER (Must come before Frukt & Grönt so e.g. 'Loka citron' or 'Äppeljuice' matches Drycker)
  if (
    (l === 'vin' || l.startsWith('vin ') || l.endsWith(' vin') || l.includes('rödvin') || l.includes('vitvin') || l.includes('matlagningsvin')) ||
    (l === 'öl' || l.startsWith('öl ') || l.endsWith(' öl') || l.includes('lättöl') || l.includes('folköl') || l.includes('starköl')) ||
    l.includes('cider') ||
    l.includes('läsk') ||
    /(^|\s|coca-?)cola\b|pepsi/.test(l) ||
    l.includes('fanta') ||
    l.includes('sprite') ||
    l.includes('tonic') ||
    l.includes('sodavatten') ||
    l.includes('mineralvatten') ||
    l.includes('kolsyrat vatten') ||
    l.includes('bubbelvatten') ||
    l.includes('kokosvatten') ||
    l.includes('loka') ||
    l.includes('ramlösa') ||
    l.includes('juice') ||
    l.includes('saft') ||
    l.includes('glögg') ||
    l.includes('champagne') ||
    l.includes('prosecco') ||
    l.includes('cava') ||
    /must\b/.test(l)
  ) {
    return 'Drycker';
  }

  // 6. FRUKT & GRÖNT
  if (
    l.includes('kål') ||
    l.includes('vitkål') ||
    l.includes('rödkål') ||
    l.includes('blomkål') ||
    l.includes('grönkål') ||
    l.includes('spetskål') ||
    l.includes('savoykål') ||
    l.includes('brysselkål') ||
    l.includes('kinakål') ||
    l.includes('pak choi') ||
    l.includes('bok choy') ||
    l.includes('kålrabbi') ||
    l.includes('broccoli') ||
    l.includes('broccolini') ||
    l.includes('zucchini') ||
    l.includes('squash') ||
    l.includes('aubergine') ||
    (l.includes('pumpa') && !l.includes('kärn') && !l.includes('frö')) ||
    l.includes('lök') ||
    l.includes('vitlök') ||
    l.includes('schalottenlök') ||
    l.includes('purjolök') ||
    l.includes('salladslök') ||
    l.includes('vårlök') ||
    l.includes('ramslök') ||
    l.includes('gräslök') ||
    l.includes('tomat') ||
    l.includes('gurka') ||
    l.includes('gurkor') ||
    l.includes('potatis') ||
    l.includes('sötpotatis') ||
    l.includes('morot') ||
    l.includes('morötter') ||
    l.includes('palsternacka') ||
    l.includes('palsternackor') ||
    l.includes('selleri') ||
    l.includes('rödbeta') ||
    l.includes('rödbetor') ||
    l.includes('polkabeta') ||
    l.includes('polkabetor') ||
    l.includes('gulbeta') ||
    l.includes('gulbetor') ||
    l.includes('rädis') ||
    l.includes('rättika') ||
    l.includes('jordärtskocka') ||
    l.includes('pepparrot') ||
    l.includes('paprika') ||
    l.includes('paprikor') ||
    (l.includes('chili') && !l.includes('sås') && !l.includes('sauce') && !l.includes('pasta') && !l.includes('majonnäs') && !l.includes('mayo') && !l.includes('pulver') && !l.includes('flake')) ||
    l.includes('jalapeno') ||
    l.includes('jalapeño') ||
    l.includes('habanero') ||
    l.includes('majskolv') ||
    l.includes('majskolvar') ||
    (l.includes('majs') && l.includes('färsk')) ||
    l.includes('citron') ||
    l.includes('lime') ||
    l.includes('ingefära') ||
    l.includes('ingefärs') ||
    l.includes('dill') ||
    l.includes('persilja') ||
    l.includes('basilika') ||
    l.includes('koriander') ||
    l.includes('timjan') ||
    l.includes('rosmarin') ||
    l.includes('salvia') ||
    l.includes('mynta') ||
    l.includes('dragon') ||
    l.includes('körvel') ||
    l.includes('krasse') ||
    l.includes('sallad') ||
    l.includes('ruccola') ||
    l.includes('rucola') ||
    l.includes('spenat') ||
    l.includes('mangold') ||
    l.includes('avokado') ||
    l.includes('sparris') ||
    l.includes('sockerärt') ||
    l.includes('sugar snaps') ||
    l.includes('haricots verts') ||
    l.includes('fänkål') ||
    l.includes('svamp') ||
    l.includes('kantarell') ||
    l.includes('champinjon') ||
    l.includes('portabello') ||
    l.includes('portobello') ||
    l.includes('shiitake') ||
    l.includes('ostronskivling') ||
    l.includes('äpple') ||
    l.includes('päron') ||
    l.includes('banan') ||
    l.includes('apelsin') ||
    l.includes('klementin') ||
    l.includes('clementin') ||
    l.includes('mandarin') ||
    l.includes('grapefrukt') ||
    l.includes('melon') ||
    l.includes('vattenmelon') ||
    l.includes('ananas') ||
    l.includes('mango') ||
    l.includes('papaya') ||
    l.includes('passionsfrukt') ||
    l.includes('kiwi') ||
    l.includes('granatäpple') ||
    l.includes('druvor') ||
    l.includes('vindruvor') ||
    l.includes('plommon') ||
    l.includes('persika') ||
    l.includes('nektarin') ||
    l.includes('aprikos') ||
    l.includes('körsbär') ||
    l.includes('jordgubb') ||
    l.includes('hallon') ||
    l.includes('blåbär') ||
    l.includes('björnbär') ||
    l.includes('lingon') ||
    l.includes('hjortron') ||
    l.includes('rabarber')
  ) {
    return 'Frukt & Grönt';
  }

  // 7. KRYDDOR & OLJA
  if (
    /salt\b/.test(l) ||
    l.includes('peppar') ||
    l.includes('cayenne') ||
    l.includes('paprikapulver') ||
    l.includes('curry') ||
    l.includes('gurkmeja') ||
    l.includes('spiskummin') ||
    l.includes('kummin') ||
    l.includes('kardemumma') ||
    l.includes('kanel') ||
    l.includes('nejlika') ||
    l.includes('muskot') ||
    l.includes('lagerblad') ||
    l.includes('oregano') ||
    l.includes('saffran') ||
    l.includes('anis') ||
    l.includes('krydda') ||
    l.includes('kryddor') ||
    l.includes('kryddmix') ||
    l.includes('spice') ||
    l.includes('taco') ||
    l.includes('fajita') ||
    l.includes('garam masala') ||
    l.includes('zaatar') ||
    l.includes('za\'atar') ||
    l.includes('olja') ||
    l.includes('olivolja') ||
    l.includes('olio') ||
    l.includes("d'oliva") ||
    l.includes('doliva') ||
    l.includes('rapsolja') ||
    l.includes('solrosolja') ||
    l.includes('matolja') ||
    l.includes('sesamolja') ||
    l.includes('tryffelolja') ||
    l.includes('vinäger') ||
    l.includes('balsamico') ||
    l.includes('balsamvinäger') ||
    l.includes('ättika')
  ) {
    return 'Kryddor & Olja';
  }

  // 8. BRÖD & BAGERI
  if (
    l.includes('bröd') ||
    l.includes('formbröd') ||
    l.includes('rostbröd') ||
    l.includes('surdeg') ||
    l.includes('levain') ||
    l.includes('baguette') ||
    l.includes('ciabatta') ||
    l.includes('rågbröd') ||
    l.includes('kavring') ||
    l.includes('fralla') ||
    l.includes('frallor') ||
    l.includes('brioche') ||
    l.includes('hamburgerbröd') ||
    l.includes('korvbröd') ||
    l.includes('pitabröd') ||
    l.includes('pita') ||
    l.includes('naan') ||
    l.includes('tunnbröd') ||
    l.includes('knäcke') ||
    l.includes('tortilla') ||
    l.includes('wrap') ||
    l.includes('libabröd') ||
    l.includes('bulle') ||
    l.includes('bullar') ||
    l.includes('croissant') ||
    l.includes('muffins') ||
    l.includes('tårtbotten')
  ) {
    return 'Bröd & Bageri';
  }

  // 9. SKAFFERI
  if (
    l.includes('pasta') ||
    l.includes('spaghetti') ||
    l.includes('spagetti') ||
    l.includes('tagliatelle') ||
    l.includes('pappardelle') ||
    l.includes('fettuccine') ||
    l.includes('penne') ||
    l.includes('fusilli') ||
    l.includes('rigatoni') ||
    l.includes('lasagne') ||
    l.includes('makaron') ||
    l.includes('nudl') ||
    l.includes('ramen') ||
    l.includes('ris') ||
    l.includes('basmati') ||
    l.includes('jasminris') ||
    l.includes('arborio') ||
    l.includes('bulgur') ||
    l.includes('couscous') ||
    l.includes('quinoa') ||
    l.includes('havregryn') ||
    l.includes('gryn') ||
    l.includes('mjöl') ||
    l.includes('stärkelse') ||
    l.includes('maizena') ||
    l.includes('bakpulver') ||
    l.includes('bikarbonat') ||
    l.includes('jäst') ||
    l.includes('socker') ||
    l.includes('farinsocker') ||
    l.includes('florsocker') ||
    l.includes('sirap') ||
    l.includes('honung') ||
    l.includes('kakao') ||
    l.includes('vaniljsocker') ||
    l.includes('gelatin') ||
    l.includes('bön') ||
    l.includes('beans') ||
    l.includes('kikärt') ||
    l.includes('gula ärtor') ||
    l.includes('chickpea') ||
    l.includes('lins') ||
    l.includes('ströbröd') ||
    l.includes('panko') ||
    l.includes('konserv') ||
    l.includes('majonnäs') ||
    l.includes('majonäs') ||
    l.includes('mayo') ||
    l.includes('senap') ||
    l.includes('dijon') ||
    l.includes('ketchup') ||
    l.includes('chilisås') ||
    l.includes('chili sås') ||
    l.includes('chilisauce') ||
    l.includes('chili sauce') ||
    l.includes('chilipasta') ||
    l.includes('chilimajonnäs') ||
    l.includes('chilimayo') ||
    (l === 'majs' || l.startsWith('majs ') || l.endsWith(' majs') || l.includes(' majs ') || l.includes('majskorn') || l.includes('burkmajs') || l.includes('majsburk') || l.includes('minimajs')) ||
    l.includes('pesto') ||
    l.includes('aioli') ||
    l.includes('ajvar') ||
    l.includes('salsa') ||
    l.includes('tacosås') ||
    l.includes('taco sauce') ||
    l.includes('dipmix') ||
    l.includes('chips') ||
    l.includes('nachos') ||
    l.includes('soja') ||
    l.includes('soyasås') ||
    l.includes('teriyaki') ||
    l.includes('sweet chili') ||
    l.includes('sriracha') ||
    l.includes('sambal') ||
    l.includes('fisksås') ||
    l.includes('ostronsås') ||
    l.includes('oliver') ||
    l.includes('kapris') ||
    l.includes('mandel') ||
    l.includes('nöt') ||
    l.includes('nötter') ||
    l.includes('cashew') ||
    l.includes('valnöt') ||
    l.includes('jordnöt') ||
    l.includes('pinje') ||
    l.includes('frö') ||
    l.includes('frön') ||
    l.includes('sesam') ||
    l.includes('chia') ||
    l.includes('solroskärn') ||
    l.includes('pumpakärn') ||
    l.includes('russin') ||
    l.includes('dadel') ||
    l.includes('dadlar') ||
    l.includes('müsli') ||
    l.includes('musli') ||
    l.includes('granola') ||
    l.includes('flingor') ||
    l.includes('kex') ||
    l.includes('choklad') ||
    l.includes('kaffe') ||
    (l === 'te' || l.startsWith('te ') || l.endsWith(' te') || l.includes('tepåsar') || l.includes('té'))
  ) {
    return 'Skafferi';
  }

  return 'Övrigt';
}

export function parseFractionOrNumber(raw: string): number | null {
  if (!raw) return null;
  let str = raw.trim();

  // Handle range like "1-2" -> take average or first
  if (/^\d+\s*[-–]\s*\d+$/.test(str)) {
    const parts = str.split(/[-–]/);
    const low = parseFloat(parts[0]);
    const high = parseFloat(parts[1]);
    if (!isNaN(low) && !isNaN(high)) {
      return Math.round(((low + high) / 2) * 10) / 10;
    }
  }

  let unicodeAdded = 0;
  if (str.includes('½')) { unicodeAdded += 0.5; str = str.replace('½', '').trim(); }
  else if (str.includes('¼')) { unicodeAdded += 0.25; str = str.replace('¼', '').trim(); }
  else if (str.includes('¾')) { unicodeAdded += 0.75; str = str.replace('¾', '').trim(); }
  else if (str.includes('⅓')) { unicodeAdded += 0.33; str = str.replace('⅓', '').trim(); }
  else if (str.includes('⅔')) { unicodeAdded += 0.67; str = str.replace('⅔', '').trim(); }
  else if (str.includes('⅛')) { unicodeAdded += 0.125; str = str.replace('⅛', '').trim(); }

  if (!str && unicodeAdded > 0) return unicodeAdded;

  if (str.includes('/')) {
    const spaceParts = str.split(/\s+/);
    if (spaceParts.length > 1) {
      const whole = parseFloat(spaceParts[0].replace(',', '.')) || 0;
      const fracParts = spaceParts[1].split('/');
      const frac = parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
      return isNaN(frac) ? null : Math.round((whole + frac + unicodeAdded) * 100) / 100;
    } else {
      const fracParts = str.split('/');
      const frac = parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
      return isNaN(frac) ? null : Math.round((frac + unicodeAdded) * 100) / 100;
    }
  }

  const parsed = parseFloat(str.replace(',', '.'));
  if (isNaN(parsed)) return unicodeAdded > 0 ? unicodeAdded : null;
  return Math.round((parsed + unicodeAdded) * 100) / 100;
}

/**
 * Normalizes typical OCR misrecognitions in Swedish recipe text:
 * - Digit vs letter confusion: 'l dl' -> '1 dl', 'I tsk' -> '1 tsk', '4OOg' -> '400 g'
 * - Separates joined numbers and units: '400g' -> '400 g', '2st' -> '2 st'
 */
export function cleanOcrArtifacts(rawText: string): string {
  if (!rawText) return '';

  let text = rawText
    // Remove null bytes and unusual control characters
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '')
    // Replace OCR 'l' or 'I' or '|' when followed by standard units (preserving line breaks)
    .replace(/(^|[\r\n]|[ \t])[lI|]\s*(liter|dl|cl|ml|l\b|msk|tsk|krm|g\b|kg|st|kruka|burk|burkar|pkt|påse|påsar|klyfta|klyftor|skiva|skivor)\b/gi, (_m, prefix, unit) => `${prefix}1 ${unit}`)
    // Replace 'l/2' or 'I/2' with '1/2' (preserving line breaks)
    .replace(/(^|[\r\n]|[ \t])[lI|]\/([248])/g, (_m, prefix, denom) => `${prefix}1/${denom}`)
    // Replace capital 'O' in numbers e.g. 4OO -> 400, 5Og -> 50 g
    .replace(/(\d)[oO](\d)/g, '$10$2')
    .replace(/(\d)[oO]\s*(g|kg|ml|dl)\b/gi, '$10 $2')
    // Separate fractions joined with units: e.g. "½dl" -> "½ dl"
    .replace(/([½¼¾⅓⅔⅛])\s*([a-zA-ZåäöÅÄÖ]+)/g, '$1 $2')
    // Fix common OCR artifact where "½ dl" is misread as "14 dl" or "24 dl" or "1/4 dl"
    .replace(/\b(?:14|24)\s*dl\s*(tomatpuré|kakao|mjöl|socker|salt|vin|olja|soja|grädde|vatten)/gi, '½ dl $1')
    // Fix OCR 8 or 9 misread as 'g' after 'ca', e.g. "ca 4008" -> "ca 400 g", "ca 2508" -> "ca 250 g"
    .replace(/\bca\s*(\d{2,4})\s*[89]\b/gi, 'ca $1 g')
    .replace(/\bca\s*(\d{2,4})[89]\b/gi, 'ca $1 g')
    // Fix OCR '1agerblad' -> 'lagerblad'
    .replace(/\b(\d+)\s*1agerblad\b/gi, '$1 lagerblad')
    // Separate joined number and unit (e.g. "400g", "2st", "1msk", "2,5dl", "2burkar")
    .replace(/(\d+(?:[,\.]\d+)?)\s*(g|gram|kg|kilo|kilogram|hg|hekto|hektogram|dl|deciliter|cl|centiliter|ml|milliliter|liter|msk|matsked|matskedar|tsk|tesked|teskedar|krm|kryddmått|st|styck|stycken|kruka|krukor|burk|burkar|pkt|paket|skiva|skivor|klyfta|klyftor|blad|påse|påsar|förp|frp|förpackning|förpackningar|nypa|nypor|knippe|knippen|tärning|tärningar|kub|kuber|kopp|koppar|glas|näve|nävar|droppe|droppar|kanna|kannor|bit|bitar|tub|tuber|flaska|flaskor|rulle|rullar|bunt|buntar|stång|stänger|kvist|kvistar|kula|kulor|huvud|huvuden|ask|askar|stjälk|stjälkar|skopa|skopor|korg|korgar|kartong|kartonger|bägare|tråg)\b/gi, '$1 $2 ')
    // Separate multi-letter unit and following food word (e.g. "1dlrött" -> "1 dl rött", "3mskolio" -> "3 msk olio")
    .replace(/\b(\d+(?:[,\.]\d+)?)\s*(dl|cl|ml|liter|msk|tsk|krm|st|kg|hg)\s*([a-zA-ZåäöÅÄÖ]{3,})\b/gi, '$1 $2 $3')
    // Separate joined number and word at word boundary (e.g. "2vitlöksklyftor" -> "2 vitlöksklyftor", "1gullök" -> "1 gullök")
    .replace(/\b(\d+)([a-zA-ZåäöÅÄÖ]{3,})\b/g, '$1 $2')
    // Strip abbreviation periods after common Swedish units (e.g. "st." -> "st", "dl." -> "dl")
    .replace(/\b(st|pkt|frp|förp|burk|burkar|dl|cl|ml|l|g|kg|hg|msk|tsk|krm)\.\s*/gi, '$1 ')
    // Normalize "2x mjölk" or "2 x mjölk" to "2 st mjölk"
    .replace(/^(\d+(?:[,\.]\d+)?)\s*[xX]\s+/i, '$1 st ')
    // Normalize inline multiple horizontal spaces (without replacing newlines)
    .replace(/[ \t]+/g, ' ');

  return text;
}

/**
 * Normalizes common variations of Swedish and metric units to standard shorthand.
 */
export function normalizeUnit(rawUnit: string): string {
  if (!rawUnit) return '';
  const u = rawUnit.toLowerCase().trim();
  switch (u) {
    case 'kilo':
    case 'kilogram':
    case 'kg':
      return 'kg';
    case 'gram':
    case 'g':
      return 'g';
    case 'hektogram':
    case 'hekto':
    case 'hg':
      return 'hg';
    case 'liter':
    case 'l':
      return 'l';
    case 'deciliter':
    case 'dl':
      return 'dl';
    case 'centiliter':
    case 'cl':
      return 'cl';
    case 'milliliter':
    case 'ml':
      return 'ml';
    case 'matsked':
    case 'matskedar':
    case 'msk':
      return 'msk';
    case 'tesked':
    case 'teskedar':
    case 'tsk':
      return 'tsk';
    case 'kryddmått':
    case 'krm':
      return 'krm';
    case 'styck':
    case 'stycken':
    case 'st':
      return 'st';
    case 'paket':
    case 'pkt':
      return 'pkt';
    case 'förp':
    case 'frp':
      return 'frp';
    case 'förpackning':
    case 'förpackningar':
      return 'förpackning';
    case 'burkar':
    case 'burk':
      return 'burk';
    case 'påsar':
    case 'påse':
      return 'påse';
    case 'krukor':
    case 'kruka':
      return 'kruka';
    case 'klyftor':
    case 'klyfta':
      return 'klyfta';
    case 'skivor':
    case 'skiva':
      return 'skiva';
    case 'nypor':
    case 'nypa':
      return 'nypa';
    case 'knippen':
    case 'knippe':
      return 'knippe';
    case 'tärningar':
    case 'tärning':
      return 'tärning';
    case 'kuber':
    case 'kub':
      return 'kub';
    case 'koppar':
    case 'kopp':
      return 'kopp';
    case 'nävar':
    case 'näve':
      return 'näve';
    case 'droppar':
    case 'droppe':
      return 'droppe';
    case 'portion':
    case 'portioner':
      return 'portion';
    case 'port':
      return 'port';
    case 'kannor':
    case 'kanna':
      return 'kanna';
    case 'bitar':
    case 'bit':
      return 'bit';
    case 'tuber':
    case 'tub':
      return 'tub';
    case 'flaskor':
    case 'flaska':
      return 'flaska';
    case 'rullar':
    case 'rulle':
      return 'rulle';
    case 'buntar':
    case 'bunt':
      return 'bunt';
    case 'stänger':
    case 'stång':
      return 'stång';
    case 'kvistar':
    case 'kvist':
      return 'kvist';
    case 'kulor':
    case 'kula':
      return 'kula';
    case 'huvuden':
    case 'huvud':
      return 'huvud';
    case 'askar':
    case 'ask':
      return 'ask';
    case 'stjälkar':
    case 'stjälk':
      return 'stjälk';
    case 'skopor':
    case 'skopa':
      return 'skopa';
    case 'korgar':
    case 'korg':
      return 'korg';
    case 'kartonger':
    case 'kartong':
      return 'kartong';
    case 'bägare':
      return 'bägare';
    case 'tråg':
      return 'tråg';
    case 'blad':
      return 'blad';
    case 'glas':
      return 'glas';
    case 'stänk':
      return 'stänk';
    default:
      return u;
  }
}

export const VALID_UNITS = [
  'g', 'gram', 'kg', 'kilo', 'kilogram', 'hg', 'hekto', 'hektogram',
  'dl', 'deciliter', 'cl', 'centiliter', 'ml', 'milliliter', 'l', 'liter',
  'msk', 'matsked', 'matskedar', 'tsk', 'tesked', 'teskedar', 'krm', 'kryddmått',
  'st', 'styck', 'stycken',
  'skiva', 'skivor',
  'kruka', 'krukor',
  'burk', 'burkar',
  'paket', 'pkt',
  'klyfta', 'klyftor',
  'blad',
  'port', 'portion', 'portioner',
  'förp', 'frp', 'förpackning', 'förpackningar',
  'nypa', 'nypor',
  'knippe', 'knippen',
  'påse', 'påsar',
  'droppe', 'droppar',
  'kanna', 'kannor',
  'tärning', 'tärningar',
  'kub', 'kuber',
  'stänk',
  'kopp', 'koppar',
  'glas',
  'näve', 'nävar',
  'bit', 'bitar',
  'tub', 'tuber',
  'flaska', 'flaskor',
  'rulle', 'rullar',
  'bunt', 'buntar',
  'stång', 'stänger',
  'kvist', 'kvistar',
  'kula', 'kulor',
  'huvud', 'huvuden',
  'ask', 'askar',
  'stjälk', 'stjälkar',
  'skopa', 'skopor',
  'korg', 'korgar',
  'kartong', 'kartonger',
  'bägare',
  'tråg',
  'cm', 'mm'
];

/**
 * Parse a raw text ingredient line into amount, unit, and name.
 */
export function parseIngredientLine(rawLine: string): Ingredient | null {
  if (!rawLine) return null;

  // 1. Strip markdown images, HTML tags, markdown links, and checkbox markers anywhere in line
  let line = rawLine
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^[•\-\*–—\+\s]*\[[ xX✓✔☑☐\s]*\]\s*/g, '')
    .replace(/\[[ xX✓✔☑☐\s]*\]/g, '')
    .replace(/^[•\-\*–—\+]\s*/, '')
    .replace(/^\d{1,2}[.)]\s+/, '')
    .trim();

  // 2. Handle Markdown Table Row (e.g. "| Strösocker | 2½ dl |" or "| 100 g | Smör |")
  if (line.includes('|')) {
    const tableCells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    // Skip markdown table header separators like "| --- | --- |"
    if (tableCells.some((c) => /^[-:\s]+$/.test(c))) {
      return null;
    }
    // Skip column header row like "| Ingredienser | Mängd |"
    if (
      tableCells.some((c) => /^(ingrediens|mängd|innehåll|vara|mått|portion)$/i.test(c))
    ) {
      return null;
    }

    if (tableCells.length >= 2) {
      const cell0HasNum = /[\d½¼¾⅓⅔⅛]/.test(tableCells[0]);
      const cell1HasNum = /[\d½¼¾⅓⅔⅛]/.test(tableCells[1]);
      if (cell0HasNum && !cell1HasNum) {
        line = `${tableCells[0]} ${tableCells[1]}`;
      } else {
        line = `${tableCells[1]} ${tableCells[0]}`;
      }
    } else if (tableCells.length === 1) {
      line = tableCells[0];
    }
  }

  // 3. Strip leading bullets / numbering: -, *, +, 1., •
  line = line
    .replace(/^[•\-\*–—\+\s]*\[[ xX✓✔☑☐\s]*\]\s*/g, '')
    .replace(/\[[ xX✓✔☑☐\s]*\]/g, '')
    .replace(/^[•\-\*–—\+]\s*/, '')
    .replace(/^\d{1,2}[.)]\s+/, '')
    .trim();

  // 4. Strip Swedish prefixes like "ca", "cirka", "drygt", "knappt", "ungefär"
  line = line.replace(/^(?:ca|cirka|drygt|knappt|ungefär)\.?\s+/i, '').trim();

  // Convert Swedish words for single/half counts and number words: "en halv", "ett halvt", "två", "tre", etc.
  line = line
    .replace(/^(?:en|ett)\s+halv(?:t)?\s+/i, '0.5 ')
    .replace(/^(?:en|ett)\s+/i, '1 ')
    .replace(/^halv(?:t)?\s+/i, '0.5 ')
    .replace(/^ett\s+par\s+/i, '2 ')
    .replace(/^två\s+/i, '2 ')
    .replace(/^tre\s+/i, '3 ')
    .replace(/^fyra\s+/i, '4 ')
    .replace(/^fem\s+/i, '5 ')
    .replace(/^sex\s+/i, '6 ')
    .replace(/^sju\s+/i, '7 ')
    .replace(/^åtta\s+/i, '8 ')
    .replace(/^nio\s+/i, '9 ')
    .replace(/^tio\s+/i, '10 ');

  line = cleanOcrArtifacts(line).trim();
  if (!line || line.length < 2) return null;

  const low = line.toLowerCase().trim();

  // 5. Discard web noise, UI buttons, screen toggles, author credits, and non-ingredients
  if (
    low.includes('håll skärmen') ||
    low.includes('skärmen tänd') ||
    low.includes('skärmen vaken') ||
    low.includes('släck inte') ||
    low.includes('matlagningsläge') ||
    low.includes('inköpslista') ||
    low.includes('portionsräknare') ||
    low.includes('ändra portioner') ||
    low.includes('näringsvärde') ||
    low.includes('näringsinnehåll') ||
    low.includes('lägg i varukorg') ||
    low.includes('handla recept')
  ) {
    return null;
  }

  const exactNoiseWords = [
    'spara', 'sparad', 'sparade', 'stäng', 'stäng fönster', 'avbryt',
    'dela', 'dela recept', 'skriv ut', 'ladda ner', 'ladda ner appen',
    'öppna', 'öppna i app', 'handla', 'köp', 'varukorg', 'inköpslista',
    'betyg', 'betygsätt', 'tips', 'kocktips', 'kommentera', 'tillbaka',
    'logga in', 'prenumerera', 'annons', 'klar', 'nästa', 'föregående',
    'ingredienser', 'instruktioner', 'tillagning', 'steg', 'metod',
    'håll skärmen tänd', 'håll skärmen vaken', 'släck inte skärmen'
  ];
  if (exactNoiseWords.includes(low)) {
    return null;
  }

  // Phrases starting with action verbs or UI controls
  if (
    /^(spara|stäng|dela|skriv ut|ladda ner|öppna|starta|håll|ändra|justera|visa|dölj|handla|köp|lägg (?:till )?i|ha med dig|gå till|se alla|visa alla|läs mer|se mer|visa mer|hitta butik|välj butik|mina sidor|logga in|prenumerera|fler recept|liknande recept|relaterade recept|betygsätt|har du lagat|omdöme|recensioner)\b/i.test(
      low
    )
  ) {
    return null;
  }

  // Author / Creator credits ("Recept av...", "Recept skapat av...", "Av: ...", "Kock: ...", "Skribent: ...")
  if (
    /^(recept av|recept skapat av|skapat av|recept från|av:|av\s+|kock:|skribent:|foto:|fotograf:|källa:|text:)/i.test(
      low
    ) ||
    low.includes('recept av') ||
    low.includes('skapat av') ||
    low.includes('recept från')
  ) {
    return null;
  }

  // Servings and yield lines: "4 portioner", "ca 12 bitar", "1 sats"
  if (
    /^(?:ca|cirka)?\s*\d+[\s\-–\d]*\s*(?:portion|portioner|port|bitar|bit|pers|personer|satser|sats)\.?$/i.test(
      low
    )
  ) {
    return null;
  }

  // Dates: e.g. "20 april, 2026", "17 maj 2024", "september 12, 2026"
  if (
    /\b(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/i.test(low) &&
    /\b\d{1,4}\b/.test(low)
  ) {
    return null;
  }

  if (/^!\[/i.test(line) || /https?:\/\//i.test(line) || /\.(svg|png|jpg|jpeg|webp)\b/i.test(line)) {
    return null;
  }
  if (/^#+\s*/.test(line) || line.endsWith(':')) {
    return null;
  }
  if (/^(ingredienser|innehåll|sås|fyllning|pajdeg|garnering|tillbehör|till servering)[:\s]*$/i.test(line)) {
    return null;
  }
  if (/^(för alla|gör glutenfri|gör laktosfri|gör mjölkfri|gör äggfri|klimatanpassa|klimatguiden|klimaträtt)/i.test(line)) {
    return null;
  }
  if (/^(?:1\s+)?sats(?:en)?\s+ger\s+ca/i.test(line)) {
    return null;
  }
  if (/^\d{1,3}$/.test(line)) return null;

  // 5b. Match format with size adjective before unit:
  // e.g. "1 liten flaska chilisås", "liten flaska chilisås", "2 stora burkar krossade tomater", "liten burk majs"
  const sizeUnitRegex = /^(?:([\d½¼¾⅓⅔⅛\s\/\.,\-–]+)\s+)?(liten|litet|små|stor|stort|stora)\s+([a-zA-ZåäöÅÄÖ]+)\s+(.+)$/i;
  const sizeMatch = line.match(sizeUnitRegex);
  if (sizeMatch) {
    const rawAmt = sizeMatch[1]?.trim();
    const potentialUnit = sizeMatch[3].toLowerCase().trim();
    const restName = sizeMatch[4].trim();

    if (VALID_UNITS.includes(potentialUnit)) {
      const amount = rawAmt ? parseFractionOrNumber(rawAmt) : 1;
      const name = capitalizeFirst(restName);
      return {
        name,
        amount,
        unit: normalizeUnit(potentialUnit),
        aisle: detectAisle(name),
        isPantryStaple: isCommonPantryStaple(name),
      };
    }
  }

  // 6. Match standard format: (amount/range) (unit) (name)
  // e.g. "400 g spaghetti", "1 1/2 dl grädde", "1-2 st schallottenlökar", "2½ dl vetemjöl"
  const standardRegex = /^([\d½¼¾⅓⅔⅛\s\/\.,\-–]+)\s+([a-zA-ZåäöÅÄÖ]+)\s+(.+)$/;
  const match = line.match(standardRegex);

  if (match) {
    const rawAmt = match[1].trim();
    const potentialUnit = match[2].toLowerCase().trim();
    const restName = match[3].trim();

    if (VALID_UNITS.includes(potentialUnit)) {
      const amount = parseFractionOrNumber(rawAmt);
      const name = capitalizeFirst(restName);
      return {
        name,
        amount,
        unit: normalizeUnit(potentialUnit),
        aisle: detectAisle(name),
        isPantryStaple: isCommonPantryStaple(name),
      };
    }
  }

  // 7. Match reversed format: (name), (amount) (unit) or (name) - (amount) (unit)
  // e.g. "Vetemjöl, 2 dl" or "Smör - 100 g" or "Mjölk (3 dl)"
  const reversedRegex = /^(.+?)[,\-–\s]+\(?([\d½¼¾⅓⅔⅛\s\/\.,\-–]+)\s*([a-zA-ZåäöÅÄÖ]+)\)?$/;
  const revMatch = line.match(reversedRegex);
  if (revMatch) {
    const potentialName = revMatch[1].trim();
    const rawAmt = revMatch[2].trim();
    const potentialUnit = revMatch[3].toLowerCase().trim();

    if (VALID_UNITS.includes(potentialUnit)) {
      const amount = parseFractionOrNumber(rawAmt);
      const cleanPotentialName = potentialName.replace(/[,\s]+(?:ca|cirka)$/i, '').trim();
      const name = capitalizeFirst(cleanPotentialName);
      return {
        name,
        amount,
        unit: normalizeUnit(potentialUnit),
        aisle: detectAisle(name),
        isPantryStaple: isCommonPantryStaple(name),
      };
    }
  }

  // 8. Match pattern: (number) (name) without explicit unit, e.g. "3 ägg", "2 avokador", "3 vitlöksklyftor"
  const numberNameRegex = /^([\d½¼¾⅓⅔⅛\s\/\.,\-–]+)\s+([a-zA-ZåäöÅÄÖ].+)$/;
  const numMatch = line.match(numberNameRegex);
  if (numMatch) {
    const rawAmt = numMatch[1].trim();
    const restName = numMatch[2].trim();
    const amount = parseFractionOrNumber(rawAmt);
    if (amount !== null) {
      const lowerRest = restName.toLowerCase();
      if (lowerRest === 'vitlöksklyfta' || lowerRest === 'vitlöksklyftor') {
        return {
          name: 'Vitlök',
          amount,
          unit: 'klyfta',
          aisle: 'Frukt & Grönt',
          isPantryStaple: false,
        };
      }
      const name = capitalizeFirst(restName);
      return {
        name,
        amount,
        unit: 'st',
        aisle: detectAisle(name),
        isPantryStaple: isCommonPantryStaple(name),
      };
    }
  }

  // 9. Fallback for unmeasured ingredients like "Salt och nymalen svartpeppar", "Smör till stekning"
  // Discard lines that are too long to be ingredient names, instruction sentences, or web junk
  if (
    line.length > 50 ||
    low.includes('grader') ||
    low.includes('ugn') ||
    low.includes('kastrull') ||
    low.includes('stekpanna') ||
    low.includes('minut') ||
    low.includes('http') ||
    low.includes('recept') ||
    low.includes('skärm') ||
    low.includes('matlagning') ||
    low.includes('portion') ||
    low.startsWith('steg')
  ) {
    return null;
  }

  const isEfterSmak = /\s+efter smak\s*$/i.test(line);
  const cleanLine = line.replace(/\s+efter smak\s*$/i, '').trim();
  const fallbackName = capitalizeFirst(cleanLine);
  return {
    name: fallbackName,
    amount: null,
    unit: isEfterSmak ? 'efter smak' : '',
    aisle: detectAisle(fallbackName),
    isPantryStaple: isCommonPantryStaple(fallbackName),
  };
}

export interface ParsedSmartItem {
  name: string;
  amount: number | null;
  unit: string;
  aisle: string;
  comment?: string;
  isPantryStaple: boolean;
  rawInput: string;
}

/**
 * Natural language item parser for single-line inputs like:
 * - "1 kg vetemjöl" -> amount: 1, unit: "kg", name: "Vetemjöl", aisle: "Skafferi"
 * - "500g smör" -> amount: 500, unit: "g", name: "Smör", aisle: "Mejeri"
 * - "2 st mjölk" -> amount: 2, unit: "st", name: "Mjölk", aisle: "Mejeri"
 * - "kaffe" -> amount: null, unit: "st", name: "Kaffe", aisle: "Skafferi"
 * - "olivolja (eko)" -> amount: null, name: "Olivolja", comment: "eko"
 */
export function parseSmartItemInput(rawInput: string): ParsedSmartItem {
  const original = (rawInput || '').trim();
  if (!original) {
    return {
      name: '',
      amount: null,
      unit: 'st',
      aisle: 'Övrigt',
      isPantryStaple: false,
      rawInput: '',
    };
  }

  let text = original;

  // 1. Extract optional trailing comment in parentheses: "1 kg mjöl (ekologiskt)"
  let extractedComment: string | undefined = undefined;
  const parenMatch = text.match(/\(([^)]+)\)$/);
  if (parenMatch) {
    extractedComment = parenMatch[1].trim();
    text = text.replace(/\(([^)]+)\)$/, '').trim();
  }

  // 2. Parse using parseIngredientLine
  const parsed = parseIngredientLine(text);

  if (parsed && parsed.name && parsed.name.trim().length > 0) {
    return {
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit || 'st',
      aisle: parsed.aisle || detectAisle(parsed.name),
      comment: extractedComment,
      isPantryStaple: parsed.isPantryStaple,
      rawInput: original,
    };
  }

  // 3. Fallback for custom names that didn't match regular patterns
  const cleanFallback = cleanLeadingStepNumber(text) || text;
  const fallbackName = capitalizeFirst(cleanFallback.trim());
  return {
    name: fallbackName,
    amount: null,
    unit: 'st',
    aisle: detectAisle(fallbackName),
    comment: extractedComment,
    isPantryStaple: isCommonPantryStaple(fallbackName),
    rawInput: original,
  };
}

/**
 * Parses multi-line ingredients text from the recipe form/modal into structured Ingredient objects.
 * Guarantees that every non-empty line entered by the user is preserved as an ingredient.
 */
export function parseIngredientsText(rawText: string): Ingredient[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n');
  const result: Ingredient[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const parsed = parseIngredientLine(trimmed);
    if (parsed && parsed.name && parsed.name.trim().length > 0) {
      result.push(parsed);
    } else {
      // Robust fallback for any line that parseIngredientLine might have discarded as noise
      // (since the user explicitly typed/pasted this into the ingredients box)
      const cleaned = cleanLeadingStepNumber(trimmed);
      if (cleaned) {
        let name = cleaned;
        let unit = '';
        if (/\s+efter smak\s*$/i.test(name)) {
          name = name.replace(/\s+efter smak\s*$/i, '').trim();
          unit = 'efter smak';
        }
        const finalName = capitalizeFirst(name);
        result.push({
          name: finalName,
          amount: null,
          unit,
          aisle: detectAisle(finalName),
          isPantryStaple: isCommonPantryStaple(finalName),
        });
      }
    }
  }

  return result;
}

/**
 * Checks if a line resembles a cooking ingredient item (has quantity, unit, or is a grocery item)
 */
export function isLikelyIngredientLine(line: string, inIngredientSection: boolean = false): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;

  // 1. Durations and temperatures are NEVER ingredients (e.g. "3 timmar", "45 minuter", "200 grader")
  if (/^\d+\s*(?:timmar?|tim\b|h\b|minuter?|min\b|sekunder?|sek\b|grader|°C)\b/i.test(trimmed)) {
    return false;
  }

  // 2. Solitary numbers or page numbers are NEVER ingredients
  if (/^(?:sida\s*)?\d{1,4}$/i.test(trimmed) || /^[a-zA-Z\s]{0,3}\d{1,4}$/.test(trimmed)) {
    return false;
  }

  // 3. Explicit culinary measurement units
  if (/^(\d+([.,]\d+)?|\d+\s*[-–]\s*\d+|[½¼¾⅓⅔⅛]|\d+\/\d+)\s*(g|kg|dl|ml|cl|liter|l|msk|tsk|krm|st|styck|burk(ar)?|pkt|påse(ar)?|kruka(or)?|klyfta(or)?|skiva(or)?|bit(ar)?|näve(ar)?|kvist(ar)?|blad|port(ioner)?|paket|förp)\b/i.test(trimmed)) {
    return true;
  }

  // 4. Common unquantified staples: "salt", "svartpeppar", "flingsalt", "olivolja till stekning"
  const staples = /^(salt|peppar|flingsalt|svartpeppar|vitpeppar|olivolja|rapsolja|smör|vatten|ströbröd|socker|oregano|timjan|rosmarin)(\s+(och|till|eller|\(.*?\)|efter smak)[a-zåäö\s]*)?$/i;
  if (staples.test(trimmed)) {
    return true;
  }

  // 5. Count + short food word (e.g. "2 tomater", "1 lök", "8 små potatisar")
  // ONLY allowed when already inside the ingredient section! In header or instructions, loose counts without units must NOT steal lines.
  if (inIngredientSection) {
    if (/^(\d+|[½¼¾⅓⅔⅛])\s+[a-zåäöA-ZÅÄÖ]/i.test(trimmed) && trimmed.length <= 50 && !/[.!?]$/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a line resembles a cooking instruction sentence
 */
export function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();
  const l = trimmed.toLowerCase();

  // Explicit step numbers: "1.", "2)", "Steg 1:", "1 -"
  if (/^(\d+[\.\)\-:,]|\b(steg\s*\d+[:\.\-])\s*)/i.test(trimmed)) {
    // But not "1 st lök" or "1 tsk salt"
    if (/^\d+\s*(st|g|kg|dl|ml|cl|l|liter|msk|tsk|krm|burk|pkt|påse|kruka|klyfta)\b/i.test(trimmed)) {
      return false;
    }
    return true;
  }

  // Cooking verbs at the start of line or sentence
  const cookingVerbs = [
    'blanda', 'stek', 'koka', 'sätt ugnen', 'värm', 'hacka', 'skär', 'skiva',
    'skala', 'häll', 'rör', 'vispa', 'baka', 'tillsätt', 'smaka av', 'krydda',
    'lägg', 'låt', 'servera', 'garnera', 'strö', 'fräs', 'forma', 'pensla',
    'mät upp', 'pressa', 'klä en', 'tryck ner', 'gratinera', 'snitta', 'späd',
    'vänd', 'blötlägg', 'klyfta', 'strimla', 'smält', 'riv', 'toppa', 'använd',
    'dela', 'rensa', 'skölj', 'torka', 'doppa', 'rulla', 'vispa ihop', 'strö över'
  ];

  return cookingVerbs.some((verb) => l.startsWith(verb));
}

/**
 * Helper to determine whether an ingredient line wrapped across two lines in a cookbook column
 */
function shouldMergeWithPreviousIngredient(prevLine: string, curLine: string): boolean {
  if (!prevLine || !curLine) return false;
  const prevTrimmed = prevLine.trim();
  const curTrimmed = curLine.trim();

  // If previous line ends with comma, dash, or connecting modifier, always merge
  if (/[,–\-—]$/.test(prevTrimmed)) return true;
  if (/\b(?:och|eller|till|av|i|med|på|extra|färskriven|nymalen|finhackad|grovhackad|skivad|strimlad)\s*$/i.test(prevTrimmed)) return true;

  // If current line is already a distinct ingredient starting with number/staple, DO NOT MERGE
  const isCurIngredient = isLikelyIngredientLine(curTrimmed, true);
  if (isCurIngredient) return false;

  // If current line starts with continuation patterns (e.g. "ca 400 g", "bladen", "romano", "d'oliva")
  if (/^(?:ca\b|\(ca\b|bladen\b|klyftor\b|skivor\b|bitar\b|romano\b|d['’]oliva\b)/i.test(curTrimmed)) return true;

  // If current line starts with lowercase and is not an instruction
  if (/^[a-zåäö]/.test(curTrimmed) && !isInstructionLine(curTrimmed)) return true;

  return false;
}

/**
 * Merges multi-line ingredient lines in a cookbook column
 */
export function mergeIngredientLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (merged.length > 0 && shouldMergeWithPreviousIngredient(merged[merged.length - 1], line)) {
      merged[merged.length - 1] = merged[merged.length - 1] + ' ' + line;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

/**
 * Detects and splits lines produced by Tesseract reading a two-column cookbook page
 * horizontally.
 */
function splitTwoColumnLine(line: string): { ingredient: string; instruction: string } | null {
  if (line.length < 25) return null;

  // Pattern A: Instruction on left, separator (em-dash or 2+ spaces or period followed by quantity), Ingredient on right
  const instLeftMatch = line.match(/^(.{15,}?)\s*(?:—|–|-|\.\s+)\s*(\d+[.,]?\d*\s*(?:g|kg|dl|ml|cl|l|liter|msk|tsk|krm|st|styck|burk|pkt|paket|påse|kruka|klyfta|klyftor|skiva|skivor|bit|näve|kvist|blad|port)?\s*[a-zA-ZåäöÅÄÖ].{2,40})$/i);
  if (instLeftMatch) {
    return { instruction: instLeftMatch[1].trim(), ingredient: instLeftMatch[2].trim() };
  }

  // Pattern B: Ingredient on left, Instruction on right
  const ingLeftMatch = line.match(/^((?:\d+|[½¼¾⅓⅔⅛])[^,.\n]{3,35})\s{2,}([A-ZÅÄÖ][a-zåäö].{12,})$/);
  if (ingLeftMatch) {
    return { ingredient: ingLeftMatch[1].trim(), instruction: ingLeftMatch[2].trim() };
  }

  return null;
}

const PROPER_NOUNS = new Set([
  'albanien', 'italien', 'sicilien', 'neapel', 'puglia', 'bologna', 'rom',
  'frankrike', 'grekland', 'spanien', 'mexiko', 'thailand', 'vietnam',
  'japan', 'kina', 'sverige', 'norge', 'danmark', 'finland', 'provence',
  'toscana', 'parma', 'milano', 'genua', 'venedig', 'turkiet', 'cypern',
  'marocko', 'indien', 'amerika', 'usa', 'england', 'storbritannien'
]);

const LOWERCASE_PARTICLES = new Set([
  'och', 'med', 'i', 'på', 'av', 'till', 'eller', 'utan', 'som', 'för', 'från', 'fran',
  'à', 'la', 'al', 'alla', 'all', 'all\'', 'del', 'della', 'degli', 'di', 'da',
  'e', 'ed', 'con', 'in', 'de', 'du', 'le', 'les', 'un', 'une'
]);

const KNOWN_CHAPTER_HEADERS = new Set([
  'kött, fisk', 'kött & fisk', 'kött', 'fisk', 'fågel', 'pasta', 'soppor',
  'desserter', 'efterrätter', 'förrätter', 'varmrätter', 'vegetariskt',
  'bröd', 'bakning', 'sallader', 'smårätter', 'vardag', 'fest', 'grundrecept',
  'tillbehör', 'såser', 'potatis - ugn'
]);

function isSectionHeader(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (KNOWN_CHAPTER_HEADERS.has(lower)) return true;
  if (/^(?:kapitel|del)\s*\d+/i.test(lower)) return true;
  if (
    lower.includes('ingrediens') ||
    lower.includes('du behöver') ||
    lower.includes('det här behöver du') ||
    lower.includes('det behöver du') ||
    lower.includes('innehåll') ||
    lower.startsWith('vad du behöver') ||
    lower.startsWith('vad behöver du') ||
    (lower.startsWith('till ') && lower.includes('portion')) ||
    lower.startsWith('tillbehör:') ||
    lower === 'ingredienser:' ||
    lower === 'ingredienser' ||
    lower === 'du behöver:' ||
    lower.includes('gör så här') ||
    lower.includes('gör såhär') ||
    lower.includes('gör gärna så här') ||
    lower.includes('så här gör du') ||
    lower.includes('så gör du') ||
    lower.includes('tillagning') ||
    lower.includes('instruktion') ||
    lower.includes('tillredning') ||
    lower.includes('beredning') ||
    lower.includes('arbetsgång') ||
    lower === 'metod:' ||
    lower === 'metod' ||
    lower === 'steg:'
  ) {
    return true;
  }
  return false;
}

export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-ZåäöÅÄÖéèàáüï]/g, '');
  if (letters.length < 3) return false;
  const upperCount = (text.match(/[A-ZÅÄÖÉÈÀÁÜÏ]/g) || []).length;
  // If more than 55% of letters are uppercase, it's an uppercase-dominant title
  return (upperCount / letters.length) >= 0.55;
}

export function formatRecipeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let cleaned = rawTitle.trim();

  // Strip leading stray bullets/numbers (e.g. "4 PAPPARDELLE" -> "PAPPARDELLE")
  cleaned = cleaned.replace(/^\d+\s+([A-ZÅÄÖa-zåäö])/, '$1');
  // Strip leading/trailing symbols
  cleaned = cleaned.replace(/^[#\*\-–—•~_|\s]+/, '').replace(/[#\*\-–—•~_|\s]+$/, '').trim();

  if (!cleaned) return '';

  const needsNormalization = isAllCaps(cleaned);

  // Fix common OCR typos
  cleaned = cleaned.replace(/\b(?:ala|a\s+la)\b/gi, 'à la');
  cleaned = cleaned.replace(/\bfran\b/gi, 'från');
  cleaned = cleaned.replace(/\bkörtfärs/gi, 'köttfärs');
  cleaned = cleaned.replace(/\bpagioli\b/gi, 'fagioli');

  // If already natural mixed case (e.g. "Potatisfocaccia från Puglia" or "Ceviche"), keep it but ensure first letter capitalized
  if (!needsNormalization) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // If ALL CAPS / uppercase-dominated, convert smartly to Swedish sentence case
  const words = cleaned.toLowerCase().split(/\s+/);
  const formattedWords = words.map((w, index) => {
    const cleanWord = w.replace(/^[^\wåäöéèàáü]+|[^\wåäöéèàáü]+$/g, '');

    // Check if proper noun
    if (PROPER_NOUNS.has(cleanWord)) {
      return w.replace(cleanWord, cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1));
    }

    // Always capitalize first word
    if (index === 0) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }

    // If word after a colon, dash, or parenthesis
    const prevWord = words[index - 1];
    if (prevWord && /[:\-–—(]$/.test(prevWord)) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }

    // Small particles remain lowercase
    if (LOWERCASE_PARTICLES.has(cleanWord)) {
      return w.toLowerCase();
    }

    // In Swedish titles, general words are lowercase
    return w.toLowerCase();
  });

  return formattedWords.join(' ');
}

export function cleanTitleLine(line: string): string {
  let cleaned = line.trim();
  // Strip leading numbering or bullet (e.g. "4 PAPPARDELLE" -> "PAPPARDELLE")
  cleaned = cleaned.replace(/^\d+\s+([A-ZÅÄÖa-zåäö])/, '$1');
  // Strip leading book border/shadow noise like "Å | ", "Sel £", "| | ", etc.
  cleaned = cleaned.replace(/^[a-zA-Z0-9åäöÅÄÖ\s]{0,4}[|/\\_~;§£€]\s*/g, '');
  // Strip trailing book border noise like " |", " /"
  cleaned = cleaned.replace(/\s*[|/\\_~;§£€][a-zA-Z0-9åäöÅÄÖ\s]*$/g, '');
  cleaned = cleaned.replace(/^[#\*\-–—•~_|\s]+/, '').replace(/[#\*\-–—•~_|\s]+$/, '').trim();
  // Strip trailing isolated 1-2 caps letters from border artifacts (e.g. "PAPRIKOR IN" -> "PAPRIKOR")
  cleaned = cleaned.replace(/\s+[A-Z]{1,2}$/, '');
  // Strip isolated 1-2 char noise at start/end of line (e.g. "U a ALA" -> "ALA", "ALBANIEN j el" -> "ALBANIEN")
  cleaned = cleaned.replace(/^[a-zA-ZåäöÅÄÖ0-9]{1,2}\s+[a-zA-ZåäöÅÄÖ0-9]{1,2}\s+([A-ZÅÄÖa-zåäö]{3,})/, '$1');
  cleaned = cleaned.replace(/\s+[a-zA-ZåäöÅÄÖ0-9]{1,2}\s+[a-zA-ZåäöÅÄÖ0-9]{1,2}$/, '');
  return cleaned.trim();
}

function isKnownDishWord(text: string): boolean {
  const l = text.toLowerCase();
  return /^(ceviche|pizza|paj|soppa|gryta|biff|pasta|risotto|lasagne|sallad|tacos|focaccia|bröd|macka|toast|burgare|lax|torsk|kyckling|falafel|curry|ramen|nudlar|wok|köttbullar|pannkakor|våfflor)$/i.test(l);
}

export function isValidTitleCandidate(line: string): boolean {
  const trimmed = line.trim();
  // Solitary portioner, cooking time, page numbers
  if (/^(\d+[-–\d]*\s*port(?:ioner?)?|\d+[-–\d]*\s*person(?:er)?|tid|tillagning)/i.test(trimmed)) return false;
  if (/^(?:sida\s*)?\d{1,4}$/i.test(trimmed)) return false;

  const cleaned = cleanTitleLine(line);
  if (!cleaned || cleaned.length < 3 || cleaned.length > 80) return false;

  // Cannot contain non-word symbols or currency
  if (/[£$€§~^=+\\/|<>]/.test(cleaned)) return false;

  const letters = cleaned.match(/[a-zA-ZåäöÅÄÖéèàáü]/g) || [];
  if (letters.length < 3) return false;
  if (letters.length / cleaned.replace(/\s+/g, '').length < 0.6) return false;

  // Reject section headers
  if (isSectionHeader(cleaned)) return false;

  // Reject ingredient lines (e.g. "400 g kycklingfilé", "2 msk olja")
  if (isLikelyIngredientLine(cleaned, false) || isLikelyIngredientLine(trimmed, false)) return false;

  // Reject instruction steps (e.g. "1. Sätt ugnen på 200 grader")
  if (isInstructionLine(cleaned) || isInstructionLine(trimmed)) return false;

  // Check if it's only 1-2 short garbage words (e.g. "make Zz", "snare eee")
  const words = cleaned.split(/\s+/);
  if (words.length <= 2 && cleaned.length < 9 && !isKnownDishWord(cleaned)) {
    if (words.every(w => w.length <= 4)) return false;
  }

  // Reject sentences ending with period/exclamation
  if (/[.!?]$/.test(cleaned) && cleaned.length > 35) return false;

  return true;
}

export function extractRecipeTitleFromLines(rawLines: string[]): {
  title: string;
  subtitle: string;
  consumedIndices: Set<number>;
} {
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);

  let title = '';
  let subtitle = '';
  let startIndex = -1;
  const consumedIndices = new Set<number>();

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const rawLine = lines[i];
    const cleaned = cleanTitleLine(rawLine);
    const lower = cleaned.toLowerCase();

    // Check if line is a known chapter header (e.g. "kött, fisk")
    if (KNOWN_CHAPTER_HEADERS.has(lower) || /^(?:kapitel|del)\s*\d+/i.test(lower)) {
      consumedIndices.add(i);
      continue;
    }

    if (!isValidTitleCandidate(rawLine)) {
      continue;
    }

    // Found our primary title line!
    title = cleaned;
    startIndex = i;
    consumedIndices.add(i);
    break;
  }

  if (!title || startIndex === -1) {
    return { title: '', subtitle: '', consumedIndices };
  }

  // Check if Line i+1 continues the title or is a subtitle
  if (startIndex + 1 < lines.length) {
    const nextRaw = lines[startIndex + 1];
    const nextClean = cleanTitleLine(nextRaw);
    const nextLower = nextClean.toLowerCase();

    const titleEndsWithConnector = /\b(?:med|och|på|i|av|till|eller|utan|à|à la|ala|al|alla|e|con|del|della)\s*$/i.test(title);
    const nextStartsWithConnector = /^(?:från|fran|med|på|i|av|till|och|eller|utan|à|à la|ala|al|alla|e|con|del|della)\b/i.test(nextLower);
    const bothAllCaps = isAllCaps(title) && isAllCaps(nextClean);

    if (isValidTitleCandidate(nextClean)) {
      if (titleEndsWithConnector || nextStartsWithConnector || (bothAllCaps && nextClean.length < 40)) {
        // Direct continuation of title!
        title = title + ' ' + nextClean;
        consumedIndices.add(startIndex + 1);
      } else if (
        !isSectionHeader(nextClean) &&
        !isLikelyIngredientLine(nextClean, false) &&
        !isInstructionLine(nextClean) &&
        !/[.!?]$/.test(nextClean) &&
        nextClean.length < 55 &&
        !/^(\d+[-–\d]*\s*port(?:ioner?)?|\d+[-–\d]*\s*person(?:er)?|tid|tillagning)/i.test(nextClean)
      ) {
        subtitle = nextClean;
        consumedIndices.add(startIndex + 1);
      }
    }
  }

  const formattedTitle = formatRecipeTitle(title);
  const formattedSubtitle = subtitle ? formatRecipeTitle(subtitle) : '';

  let finalTitle = formattedTitle;
  if (formattedSubtitle && !formattedTitle.toLowerCase().includes(formattedSubtitle.toLowerCase())) {
    finalTitle = `${formattedTitle} (${formattedSubtitle})`;
  }

  return {
    title: finalTitle,
    subtitle: formattedSubtitle,
    consumedIndices,
  };
}

export function parseRawRecipeText(text: string): ParsedRecipeData {
  const cleaned = cleanOcrArtifacts(text);
  const rawLines = cleaned
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Pre-process: expand two-column lines into separate ingredient + instruction lines
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const split = splitTwoColumnLine(rawLine);
    if (split) {
      lines.push(split.ingredient);
      lines.push(split.instruction);
    } else {
      lines.push(rawLine);
    }
  }

  const extractedTitleData = extractRecipeTitleFromLines(lines);
  let title = extractedTitleData.title;
  let description = '';
  let category: RecipeCategory = 'Middag';
  let servings = 4;
  let cookingTimeMinutes: number | undefined = undefined;
  const ingredients: Ingredient[] = [];
  const instructions: Instruction[] = [];
  const ingredientBuffer: string[] = [];

  let currentSection: 'header' | 'ingredients' | 'instructions' = 'header';

  function flushIngredients() {
    if (ingredientBuffer.length === 0) return;
    const merged = mergeIngredientLines(ingredientBuffer);
    for (const m of merged) {
      const ing = parseIngredientLine(m);
      if (ing) ingredients.push(ing);
    }
    ingredientBuffer.length = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    if (extractedTitleData.consumedIndices.has(i)) {
      continue;
    }

    const line = lines[i];
    const lower = line.toLowerCase().trim();

    // ── Skip solitary page numbers (e.g. "33", "sida 33", "J 33", "- 33 -") ──
    if (
      /^(?:sida\s*)?\d{1,3}$/i.test(line) ||
      /^[a-zA-Z\s]{0,3}\d{1,3}$/.test(line) ||
      /^[-–—\s]*\d{1,3}[-–—\s]*$/.test(line)
    ) {
      continue;
    }

    // ── Detect main ingredient section headers ────────────────────────────
    const isIngredientHeader =
      lower.includes('ingrediens') ||
      lower.includes('du behöver') ||
      lower.includes('det här behöver du') ||
      lower.includes('det behöver du') ||
      lower.includes('innehåll') ||
      lower.startsWith('vad du behöver') ||
      lower.startsWith('vad behöver du') ||
      (lower.startsWith('till ') && lower.includes('portion')) ||
      lower.startsWith('tillbehör:') ||
      lower === 'ingredienser:' ||
      lower === 'ingredienser' ||
      lower === 'du behöver:' ||
      lower === 'grundrecept' ||
      lower === 'grundrecept:';

    // ── Detect instruction/method section headers ─────────────────────────
    const isInstructionHeader =
      lower.includes('gör så här') ||
      lower.includes('gör såhär') ||
      lower.includes('gör gärna så här') ||
      lower.includes('så här gör du') ||
      lower.includes('så gör du') ||
      lower.includes('tillagning') ||
      lower.includes('instruktion') ||
      lower.includes('tillredning') ||
      lower.includes('beredning') ||
      lower.includes('arbetsgång') ||
      lower === 'metod:' ||
      lower === 'metod' ||
      lower === 'steg:';

    // ── Detect sub-section headers within ingredients ─────────────────────
    const isIngredientSubHeader =
      lower === 'sås' || lower === 'sås:' ||
      lower === 'garnering' || lower === 'garnering:' ||
      lower === 'servering' || lower === 'servering:' ||
      lower === 'till servering' || lower === 'till servering:' ||
      lower === 'tillbehör' || lower === 'tillbehör:' ||
      lower === 'marinad' || lower === 'marinad:' ||
      lower === 'glasyr' || lower === 'glasyr:' ||
      lower === 'fyllning' || lower === 'fyllning:' ||
      lower === 'pajskal' || lower === 'pajskal:' ||
      lower === 'till panering' || lower === 'till panering:' ||
      lower === 'till gratinering' || lower === 'till gratinering:' ||
      lower === 'deg' || lower === 'degen' || lower === 'deg:' ||
      lower === 'smet' || lower === 'smeten' || lower === 'smet:';

    if (isIngredientHeader) {
      currentSection = 'ingredients';
      continue;
    }
    if (isInstructionHeader) {
      flushIngredients();
      currentSection = 'instructions';
      continue;
    }
    if (isIngredientSubHeader) {
      continue;
    }

    // ── Portioner detection (broader patterns) ────────────────────────────
    const portionMatch =
      line.match(/^(\d+)(?:\s*[-–]\s*\d+)?\s*port(?:ioner?|\.)?$/i) ||
      line.match(/(\d+)\s*port(?:ioner?|\.)/i) ||
      line.match(/^(\d+)(?:\s*[-–]\s*\d+)?\s*person(?:er)?$/i);
    if (portionMatch) {
      servings = parseInt(portionMatch[1], 10) || 4;
      continue;
    }

    if (currentSection === 'header') {
      if (!cookingTimeMinutes && /(?:tid|minuter|timmar|min\b|h\b|tillagning)/i.test(line)) {
        const parsedTime = parseRecipeTimeString(line);
        if (parsedTime && parsedTime > 0) {
          cookingTimeMinutes = parsedTime;
        }
      }

      if (!title && line.length > 2 && line.length < 80) {
        if (!/^(?:tid|tillagningstid)?\s*:?\s*\d+\s*(?:min|tim|h)/i.test(line)) {
          title = formatRecipeTitle(line.replace(/^[#\*\-]+\s*/, '').replace(/^\d+\s+([A-ZÅÄÖ])/, '$1'));
          continue;
        }
      }

      // If line is clearly an ingredient with explicit unit, transition to ingredients
      if (isLikelyIngredientLine(line, false)) {
        currentSection = 'ingredients';
        ingredientBuffer.push(line);
      } else if (isInstructionLine(line)) {
        currentSection = 'instructions';
        const cleanText = cleanLeadingStepNumber(line);
        if (cleanText.length > 2) {
          instructions.push({ stepNumber: instructions.length + 1, text: cleanText });
        }
      } else if (line.length > 15 && !/^(?:tid|portion)/i.test(line)) {
        const cleanLine = line.replace(/^\d+\s+([A-ZÅÄÖ])/, '$1');
        description = (description ? description + ' ' : '') + cleanLine;
      }
    } else if (currentSection === 'ingredients') {
      // If line is an instruction (step number or cooking verb), transition to instructions
      if (isInstructionLine(line) && !isLikelyIngredientLine(line, true)) {
        flushIngredients();
        currentSection = 'instructions';
        const cleanText = cleanLeadingStepNumber(line);
        if (cleanText.length > 2) {
          instructions.push({ stepNumber: instructions.length + 1, text: cleanText });
        }
      } else if (isLikelyIngredientLine(line, true) || (line.length <= 45 && !/[.!?]$/.test(line))) {
        ingredientBuffer.push(line);
      } else if (line.length > 40 && /[.!?]$/.test(line)) {
        // Complete narrative sentence inside ingredient area
        if (ingredientBuffer.length > 0 || ingredients.length > 0) {
          flushIngredients();
          currentSection = 'instructions';
          const cleanText = cleanLeadingStepNumber(line);
          if (cleanText.length > 2) {
            instructions.push({ stepNumber: instructions.length + 1, text: cleanText });
          }
        } else {
          description = (description ? description + ' ' : '') + line;
        }
      }
    } else if (currentSection === 'instructions') {
      const cleanText = cleanLeadingStepNumber(line);
      const low = cleanText.toLowerCase();
      if (
        low === 'spara' ||
        low === 'stäng' ||
        low === 'dela' ||
        low === 'skriv ut' ||
        low === 'starta timer' ||
        low === 'betygsätt' ||
        low.startsWith('recept av') ||
        low.startsWith('tips:') ||
        low === 'tips'
      ) {
        continue;
      }

      // If a line in instructions is clearly an ingredient WITH EXPLICIT UNIT (never durations like "3 timmar"):
      if (isLikelyIngredientLine(line, false) && !isInstructionLine(line)) {
        const ing = parseIngredientLine(line);
        if (ing) ingredients.push(ing);
      } else if (cleanText.length > 2) {
        // If line starts with a new step (step number or cooking verb), add as new step
        if (isInstructionLine(line) || instructions.length === 0) {
          instructions.push({
            stepNumber: instructions.length + 1,
            text: cleanText,
          });
        } else {
          // Continuation sentence of previous step
          const lastIdx = instructions.length - 1;
          instructions[lastIdx].text += ' ' + cleanText;
        }
      }
    }
  }

  flushIngredients();

  // Fallback: If section headings were not found, heuristically distribute lines
  if (ingredients.length === 0 && instructions.length === 0 && lines.length > 1) {
    if (!title) {
      title = formatRecipeTitle(lines[0]);
    }
    for (let i = 1; i < lines.length; i++) {
      if (extractedTitleData.consumedIndices.has(i)) continue;
      const l = lines[i];
      if (isInstructionLine(l)) {
        instructions.push({
          stepNumber: instructions.length + 1,
          text: l.replace(/^(\d+[\.\)\-:]\s*)/, ''),
        });
      } else {
        const ing = parseIngredientLine(l);
        if (ing) ingredients.push(ing);
      }
    }
  }

  // Categorize and detect subcategory smartly
  category = detectCategory(title || description);
  const subcategories = detectSubcategories(title, category, ingredients, description);

  return {
    title: title || 'Nytt skannat recept',
    description: description.trim(),
    category,
    subcategory: subcategories.join(', '),
    subcategories,
    servings: servings || 4,
    cookingTimeMinutes,
    ingredients: ingredients.length > 0 ? ingredients : [
      { name: 'Huvudingrediens', amount: 400, unit: 'g', aisle: 'Skafferi', isPantryStaple: false },
      { name: 'Smör eller Olja', amount: 2, unit: 'msk', aisle: 'Kryddor & Olja', isPantryStaple: true },
      { name: 'Salt & Peppar', amount: null, unit: 'efter smak', aisle: 'Kryddor & Olja', isPantryStaple: true },
    ],
    instructions: instructions.length > 0 ? instructions : [
      { stepNumber: 1, text: 'Förbered ingredienserna enligt receptet.' },
      { stepNumber: 2, text: 'Tillaga och avnjut!' },
    ],
  };
}
