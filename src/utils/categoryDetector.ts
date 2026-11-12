import type { RecipeCategory, Ingredient } from '../types/recipe';
import { detectMeatKinds } from './meatKinds';

/** Bread you bake: not "pitabröd" or "naanbröd", which go with a dish */
const BREAD =
  /(^|[^a-zåäö])bröd([^a-zåäö]|$)|limpa|fralla|frallor|focaccia|surdeg|baguette|ciabatta|tunnbröd|knäckebröd|formbröd|grovbröd|rågbröd|lantbröd|levain|brioche|kavring/;

/** Words that make a name a sauce, dressing or dip */
const SAUCE_WORDS =
  /sås|sauce|dressing|vinaigrette|vinägrett|majonnäs|mayo|pesto|tzatziki|aioli|guacamole|hummus|bearnaise|béarnaise|hollandaise|remoulad|dipp|chutney|marinad/;

/**
 * Automatically maps a raw category string or recipe title to one of the 5 main Matklar categories.
 */
export function detectCategory(rawText?: string): RecipeCategory {
  if (!rawText) return 'Middag';
  const c = rawText.toLowerCase().trim();

  if (
    c.includes('förrätt') ||
    c.includes('starter') ||
    c.includes('appetizer') ||
    c.includes('tapas') ||
    c.includes('plockmat') ||
    c.includes('snack') ||
    c.includes('bruschetta') ||
    c.includes('snittar') ||
    c.includes('skagen')
  ) {
    return 'Förrätt';
  }

  // Pies and pancakes that are food, not dessert: "Kycklingpaj", "Västerbottenpaj", "Fläskpannkaka"
  if (
    /(kyckling|lax|fisk|skink|bacon|västerbotten|ost|purjo|broccoli|spenat|svamp|kantarell|kött|färs|tonfisk|räk|grönsak|zucchini|feta|chèvre|chevre|lök|potatis|tomat|kassler|korv)[a-zåäö]*paj/.test(c) ||
    /quiche|matpaj|pirog|fläskpannkaka|pannkaka med fläsk|ugnspannkaka med (fläsk|bacon)/.test(c)
  ) {
    return 'Middag';
  }

  // Drinks before desserts, so "varm choklad" is a drink
  if (
    /varm choklad|chokladdryck|varm kakao|glögg|lemonad|läsk|milkshake|iste\b|punsch|bål\b/.test(c) ||
    // Drinks by what is in them: "Gin och tonic", "Mojito", "Aperol spritz"
    /(^|[^a-zåäö])(gin|vodka|whisky|whiskey|tequila|tonic|spritz|mojito|margarita|negroni|sangria|daiquiri|cosmopolitan|cider|mjöd|grogg|drinkar?)([^a-zåäö]|$)/.test(c)
  ) {
    return 'Dryck';
  }

  // Breakfast before desserts, so "overnight oats" and "äggröra" are breakfast
  if (/overnight oats|äggröra|granola|müsli|musli|chiapudding|frukostbowl|yoghurtbowl|gröt/.test(c)) {
    return 'Frukost';
  }

  if (
    c.includes('efterrätt') ||
    c.includes('dessert') ||
    /mousse|fruktsallad|pannacotta|panna cotta|brûlée|brulee|tiramisu|cheesecake|brownie|parfait|sorbet|ris à la malta|smulpaj|crumble/.test(c) ||
    /bananbröd|wienerbröd|kanelbröd|längd\b|kokosboll|chokladboll|havreboll|pralin|fudge|tryffel(?!pasta|risotto)|knäck|kola\b|marängsviss|maräng/.test(c) ||
    c.includes('kladdkaka') ||
    c.includes('kaka') ||
    c.includes('kakor') ||
    c.includes('bakverk') ||
    c.includes('tårta') ||
    c.includes('glass') ||
    c.includes('fika') ||
    c.includes('godis') ||
    c.includes('godsaker') ||
    c.includes('paj') ||
    // Buns, but not "köttbullar", "fiskbullar" or "potatisbullar"
    (/bull(e|ar)/.test(c) && !/(kött|fisk|kyckling|fläsk|vego|lamm|kalkon|potatis|färs|ost)bull/.test(c)) ||
    c.includes('våffl') ||
    c.includes('muffin') ||
    c.includes('scones') ||
    c.includes('cookies') ||
    c.includes('bakelse') ||
    c.includes('mazarin') ||
    c.includes('semla') ||
    c.includes('semlor')
  ) {
    return 'Efterrätt';
  }

  // Bread is filed under breakfast: "Lantbröd", "Focaccia", "Frallor med frön". Only when the
  // dish itself is bread, not "Soppa med bröd"
  if (BREAD.test(c.split(/\s(?:med|och|i|till)\s/)[0])) {
    return 'Frukost';
  }

  if (
    c.includes('dryck') ||
    c.includes('drink') ||
    c.includes('smoothie') ||
    c.includes('cocktail') ||
    c.includes('juice') ||
    c.includes('saft') ||
    c.includes('mocktail') ||
    c.includes('kaffe') ||
    // "te" only as a word of its own, not inside "tomater" or "tagliatelle"
    /(^|[^a-zåäöé])(te|chai|latte)([^a-zåäöé]|$)/.test(c)
  ) {
    return 'Dryck';
  }

  if (
    c.includes('frukost') ||
    c.includes('breakfast') ||
    c.includes('brunch') ||
    c.includes('gröt') ||
    c.includes('mellanmål') ||
    c.includes('omelett')
  ) {
    return 'Frukost';
  }

  // Check for sauces/dressings/dips:
  // Avoid matching meals like "lax med dillsås", "fiskbullar i hummersås", "köttbullar med gräddsås", "köttfärssås"
  const isMealWithSauce = /med.*sås|\si\s.*sås|köttfärssås|bolognese|lasagne|stek.*sås/i.test(c);
  // "Falafel med tzatziki" is a dish with a sauce on the side: the name before "med" decides
  const lead = c.split(/\s(?:med|och)\s/)[0];
  const isDishWithSide = lead !== c && !SAUCE_WORDS.test(lead);
  if (
    !isMealWithSauce &&
    !isDishWithSide &&
    (c.includes('sås') ||
      c.includes('marinad') ||
      c.includes('sauce') ||
      c.includes('dressing') ||
      c.includes('vinaigrette') ||
      c.includes('vinägrett') ||
      c.includes('majonnäs') ||
      c.includes('mayo') ||
      c.includes('pesto') ||
      c.includes('tzatziki') ||
      c.includes('aioli') ||
      c.includes('guacamole') ||
      c.includes('hummus') ||
      c.includes('bearnaise') ||
      c.includes('béarnaise') ||
      c.includes('hollandaise') ||
      c.includes('remoulad') ||
      c.includes('dipp') ||
      c.includes('chutney'))
  ) {
    return 'Såser';
  }

  return 'Middag';
}

/**
 * Smartly deduces an appropriate Swedish subcategory from the recipe's title, ingredients,
 * and description, instead of falling back to website domains like "koket.se" or generic placeholders.
 */
/**
 * Smartly deduces all appropriate Swedish subcategories from the recipe's title, ingredients,
 * and description. For instance, a chicken pasta matches both 'Pasta' and 'Kyckling'.
 */
export function detectSubcategories(
  title: string = '',
  category: RecipeCategory = 'Middag',
  ingredients: Ingredient[] = [],
  description: string = '',
  keywords: string = ''
): string[] {
  const combined = [
    title,
    description,
    keywords,
    ...ingredients.slice(0, 10).map((i) => i.name || '')
  ]
    .join(' ')
    .toLowerCase();

  const titleLower = title.toLowerCase();
  const matches: string[] = [];

  // 1. Efterrätt
  if (category === 'Efterrätt') {
    if (/pannkak|våffl|crepe/i.test(titleLower)) matches.push('Pannkakor & Våfflor');
    if (/paj|tårta|cheesecake|rulltårta/i.test(titleLower)) matches.push('Pajer & Tårtor');
    if (/glass|sorbet|parfait|semifreddo/i.test(titleLower)) matches.push('Glass & Sorbet');
    if (/choklad|kola|tryffel|pralin|knäck|fudge|chokladboll|godis/i.test(titleLower)) matches.push('Choklad & Godis');
    if (/mousse|pannacotta|tiramisu|kräm|kompott|dessert i glas/i.test(titleLower)) matches.push('Dessert i glas');
    if (/kaka|kakor|bulle|bullar|muffins|cupcakes|sockerkaka|semla|bakat|bakverk|kladdkaka/i.test(titleLower)) matches.push('Bakverk & Kakor');
    if (matches.length === 0) matches.push('Bakverk & Kakor');
  }

  // 2. Frukost
  else if (category === 'Frukost') {
    if (/gröt|oats|müsli|granola/i.test(titleLower)) matches.push('Gröt & Müsli');
    if (/ägg|omelett|scrambled|äggröra|frittata/i.test(titleLower)) matches.push('Ägg & Omelett');
    if (/pannkak|våffl/i.test(titleLower)) matches.push('Pannkakor & Våfflor');
    if (/macka|smörgås|toast|bagel/i.test(titleLower)) matches.push('Smörgåsar & Mackor');
    if (BREAD.test(titleLower) || /scones/i.test(titleLower)) matches.push('Bröd');
    if (/yoghurt|fil([^a-zåäö]|$)|kvarg|skyr/i.test(titleLower)) matches.push('Yoghurt & Fil');
    if (/smoothie|juice|bowl/i.test(titleLower)) matches.push('Smoothies & Bowls');
    if (matches.length === 0) matches.push('Gröt & Müsli');
  }

  // 3. Dryck
  else if (category === 'Dryck') {
    if (/smoothie|juice|shake|bowl/i.test(titleLower)) matches.push('Smoothies & Bowls');
    if (/kaffe|cappuccino|espresso|(^|[^a-zåäöé])(te|latte|chai)([^a-zåäöé]|$)/i.test(titleLower)) matches.push('Kaffe & Te');
    if (/saft|lemonad/i.test(titleLower)) matches.push('Saft & Lemonad');
    if (/mocktail|alkoholfri/i.test(titleLower)) matches.push('Alkoholfritt');
    if (/drink|cocktail|spritz|mojito|gin|vodka|rom/i.test(titleLower)) matches.push('Drinkar & Cocktails');
    if (matches.length === 0) matches.push('Måltidsdryck');
  }

  // 4. Förrätt
  else if (category === 'Förrätt') {
    if (/toast|bruschetta|crostini|snittar/i.test(titleLower)) matches.push('Toast & Bruschetta');
    if (/soppa|gazpacho|buljong/i.test(titleLower)) matches.push('Soppor');
    if (/skagen|räk|hummer|löjrom|mussl|krabb|kräft/i.test(titleLower)) matches.push('Skaldjur');
    if (/lax|sill|strömming|torsk|fisk/i.test(titleLower)) matches.push('Fisk');
    if (/sallad|carpaccio/i.test(titleLower)) matches.push('Sallader');
    if (/plock|tilltugg|snack|tapas|finger/i.test(titleLower)) matches.push('Plockmat & Tilltugg');
    if (matches.length === 0) matches.push('Smårätter & Tapas');
  }

  // 5. Mellanmål
  else if (category === 'Mellanmål') {
    if (/smoothie|shake|bowl/i.test(titleLower)) matches.push('Smoothies & Bowls');
    if (/bar|boll|chokladboll|energiboll/i.test(titleLower)) matches.push('Bars & Bollar');
    if (/bär|frukt|äpple|banan/i.test(titleLower)) matches.push('Bär & Frukt');
    if (matches.length === 0) matches.push('Snacks');
  }

  // 6. Såser
  else if (category === 'Såser') {
    if (/bearnaise|béarnaise|hollandaise/i.test(combined)) matches.push('Béarnaise & Hollandaise');
    if (/pesto|chimichurri|örtsås|gremolata/i.test(combined)) matches.push('Pesto & Örtsås');
    if (/dressing|vinägrett|vinaigrette|senap/i.test(combined)) matches.push('Dressing & Vinägrett');
    if (/dipp|dip|hummus|röra|guacamole|salsa|chutney/i.test(combined)) matches.push('Dipp & Röror');
    if (/marinad|(^|[^a-zåäö])rub([^a-zåäö]|$)|kryddmix|glaze|glasyr till/i.test(combined)) matches.push('Marinader & Rubs');
    if (/vanilj|choklad|kola|karamell|bärsås/i.test(combined)) matches.push('Söta såser');
    if (/brunsås|gräddsås|pepparsås|rödvin|svampsås|béchamel|bechamel|ostsås|varm/i.test(combined)) matches.push('Varma såser');
    if (/tzatziki|aioli|remoulad|romsås|dillsås|majonnäs|kall/i.test(combined)) matches.push('Kalla såser');
    if (matches.length === 0) matches.push('Kalla såser');
  }

  // 7. Middag. The title (and description, keywords) decides first. The ingredients are only
  // used when that gives nothing, since words inside ingredient names mislead
  // ("currypasta" is not pasta, "färsk koriander" is not färs).
  else {
    const titleText = [title, description, keywords].join(' ').toLowerCase();
    for (const mText of [titleText, combined]) {
      if (/pasta|spaghetti|lasagne|tagliatelle|penne|makaroner|gnocchi|tortellini|fettuccine|ravioli|carbonara|bolognese/i.test(mText)) {
        matches.push('Pasta');
      }
      if (/(^|[^a-zåäö])(ris|risotto)([^a-zåäö]|$)|jasminris|basmatiris|arborio|stekt ris/i.test(mText)) {
        matches.push('Ris');
      }
      if (/potatis|potatismos|pommes|klyftpotatis|rostad potatis|hasselback|potatisgratäng|bakad potatis|färskpotatis|mandelpotatis|delikatesspotatis|potatissallad/i.test(mText)) {
        matches.push('Potatis');
      }
      if (/burgare|hamburgare|smash burger|cheeseburger/i.test(mText)) {
        matches.push('Burgare');
      }
      if (/kyckling|kalkon|höna|drumsticks/i.test(mText)) {
        matches.push('Kyckling');
      }
      if (/fisk|lax|torsk|sej|kolja|tonfisk|sill|strömming|abborre|gös|hälleflundra|havskatt|rödspätta|makrill|fiskgratäng|fisksoppa/i.test(mText)) {
        matches.push('Fisk');
      }
      if (/räk|räkor|kräft|kräftor|hummer|mussl|musslor|ostron|bläckfisk|skaldjur|scampi|gambas|krabb|havskräft|skagen/i.test(mText)) {
        matches.push('Skaldjur');
      }
      if (/wok|ramen|sushi|pad thai|tikka|teriyaki|satay|dumplings|bao|curry|asiatisk|kimchi|tandoori/i.test(mText)) {
        matches.push('Asiatiskt');
      }
      if (/taco|fajita|enchilada|quesadilla|burrito|nacho|texmex/i.test(mText)) {
        matches.push('Tacos & Texmex');
      }
      if (/shakshuka|falafel|moussaka|souvlaki|gyros|shawarma|kebab|halloumi|hummus|couscous|bulgur|tabbouleh|za.?atar|grekisk sallad|libanesisk|marockansk|persisk|tagine|dolmar|spanakopita|börek/i.test(mText)) {
        matches.push('Medelhav & Mellanöstern');
      }
      if (/pizza|calzone/i.test(mText)) {
        matches.push('Pizza');
      }
      if (/(^|[^a-zåäö])pajer?([^a-zåäö]|$)|[a-zåäö]paj([^a-zåäö]|$)|quiche|pirog/i.test(mText)) {
        matches.push('Paj');
      }
      if (/wrap|pitabröd|(^|[^a-zåäö])pita([^a-zåäö]|$)|tortilla|panini|smörgås|toast|piadina|flatbröd|tunnbrödsrulle/i.test(mText)) {
        matches.push('Wraps & Bröd');
      }
      if (/(^|[^a-zåäö])bowls?([^a-zåäö]|$)|poke/i.test(mText)) {
        matches.push('Bowls');
      }
      if (/grill|bbq|barbecue|spett/i.test(mText)) {
        matches.push('Grill');
      }
      if (/soppa|gazpacho|buljong|minestrone|ramen|nudelsoppa/i.test(mText)) {
        matches.push('Soppor');
      }
      if (/gryta|chili con carne|gulasch|kalops|stroganoff|boeuf|currygryta|daal|tagine|dillkött/i.test(mText)) {
        matches.push('Grytor');
      }
      if (/gratäng|i ugn|ugnsbakad|ugnsstekt|ugnsrost|låda|ugnsform/i.test(mText)) {
        matches.push('Ugn & Gratäng');
      }
      if (/kåldolmar|raggmunk|stekt fläsk|pyttipanna|ärtsoppa|kroppkakor|rotmos|blodpudding|pannbiff|janssons|husman/i.test(mText)) {
        matches.push('Husmanskost');
      }
      if (/sallad|caesar/i.test(mText)) {
        matches.push('Sallader');
      }
      if (matches.length > 0) break;
    }
    // The kind of meat, from the name or else the ingredients, whatever else the dish is
    for (const kind of detectMeatKinds([title, description, keywords].join(' '), ingredients.map((i) => i.name || ''))) {
      if (!matches.includes(kind)) matches.push(kind);
    }
    if (matches.length === 0) {
      matches.push('Husmanskost');
    }
  }

  // 7. Check special diet subcategories across all categories
  if (/glutenfri|glutenfritt|gluten-free|utan gluten/i.test(combined)) {
    if (!matches.includes('Glutenfri')) matches.push('Glutenfri');
  }
  if (/laktosfri|laktosfritt|lactose-free|utan laktos/i.test(combined)) {
    if (!matches.includes('Laktosfri')) matches.push('Laktosfri');
  }
  if (/mjölkfri|mjölkfritt|dairy-free|utan komjölk|utan mjölk/i.test(combined)) {
    if (!matches.includes('Mjölkfri')) matches.push('Mjölkfri');
  }
  if (/vegansk|veganskt|vegan|växtbaserad/i.test(combined)) {
    if (!matches.includes('Veganskt')) matches.push('Veganskt');
  }
  if (/vegetarisk|vegetariskt|vego|tofu|halloumi|paneer|falafel|linser|kikärtor|quorn|sojafärs/i.test(combined)) {
    if (!matches.includes('Vegetariskt')) {
      matches.push('Vegetariskt');
    }
  }
  if (/sockerfri|sockerfritt|sockerfri/i.test(combined)) {
    if (!matches.includes('Sockerfri')) matches.push('Sockerfri');
  }
  if (/nötfri|nötfritt|utan nötter/i.test(combined)) {
    if (!matches.includes('Nötfri')) matches.push('Nötfri');
  }
  if (/proteinrik|proteinbomb|high protein|extra protein|mycket protein/i.test(combined)) {
    if (!matches.includes('Proteinrikt')) matches.push('Proteinrikt');
  }
  if (/barnvänlig|barnfavorit|för barn|barnens|kids/i.test(combined)) {
    if (!matches.includes('Barnvänligt')) matches.push('Barnvänligt');
  }

  return matches;
}

/**
 * Legacy helper returning a single subcategory string.
 */
export function detectSubcategory(
  title: string = '',
  category: RecipeCategory = 'Middag',
  ingredients: Ingredient[] = [],
  description: string = '',
  keywords: string = ''
): string {
  const subcats = detectSubcategories(title, category, ingredients, description, keywords);
  return subcats[0] || 'Husmanskost';
}
