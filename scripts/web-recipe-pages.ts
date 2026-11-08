/**
 * Recipe web pages written after how Swedish recipe sites usually build them (not copied).
 * Used by check-web-scraper.mts.
 */
const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const wrap = (head: string, body: string) => `<!doctype html><html lang="sv"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
const filler = '<p>' + 'Lorem ipsum text om sajten. '.repeat(20) + '</p>';

export const PAGES: Record<string, { url: string; html: string }> = {
ica: { url: 'https://www.ica.se/recept/kramig-kycklingpasta-123/', html: wrap(
  `<title>Krämig kycklingpasta | Recept ICA.se</title><meta property="og:image" content="https://assets.icanet.se/img.jpg">` + ld({
    '@context': 'https://schema.org', '@type': 'Recipe', name: 'Krämig kycklingpasta', description: 'En snabb vardagspasta med kyckling.',
    image: 'https://assets.icanet.se/img.jpg', recipeYield: '4', totalTime: 'PT30M', recipeCategory: 'Huvudrätt',
    recipeIngredient: ['300 g pasta', '500 g kycklingfilé', '1 gul lök', '2 dl matlagningsgrädde', '1 tsk salt', '1 krm svartpeppar'],
    recipeInstructions: [
      { '@type': 'HowToStep', text: 'Koka pastan enligt anvisningen på förpackningen.' },
      { '@type': 'HowToStep', text: 'Skär kycklingen i bitar och stek den.' },
      { '@type': 'HowToStep', text: 'Häll i grädden och låt koka ihop. Blanda med pastan.' }],
  }), `<h1>Krämig kycklingpasta</h1>${filler}`) },
arla: { url: 'https://www.arla.se/recept/kladdkaka/', html: wrap(
  `<title>Kladdkaka - Recept - Arla</title>` + ld({
    '@context': 'https://schema.org', '@type': 'Recipe', name: 'Kladdkaka', recipeYield: '8 bitar', totalTime: 'PT45M', recipeCategory: ['Bakning', 'Dessert'],
    keywords: 'kladdkaka, choklad, enkel', image: [{ '@type': 'ImageObject', url: 'https://images.arla.com/kladdkaka.jpg' }],
    recipeIngredient: ['100 g smör', '2 ägg', '2 1/2 dl strösocker', '3 msk kakao', '1 1/2 dl vetemjöl', 'Servering:', 'vispad grädde'],
    recipeInstructions: [{ '@type': 'HowToSection', name: 'Kakan', itemListElement: [
      { '@type': 'HowToStep', text: 'Sätt ugnen på 175°C.' },
      { '@type': 'HowToStep', text: 'Smält smöret. Rör ner ägg och socker.' },
      { '@type': 'HowToStep', text: 'Grädda mitt i ugnen ca 15 minuter.' }] }],
  }), `<h1>Kladdkaka</h1>${filler}`) },
koket: { url: 'https://www.koket.se/kottfarssas', html: wrap(
  `<title>Köttfärssås | Köket.se</title>` + ld({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', name: 'Köttfärssås' },
    { '@type': 'Recipe', name: 'Köttfärssås med tagliatelle', recipeYield: ['4', '4 portioner'], cookTime: 'PT1H15M',
      image: { '@type': 'ImageObject', url: 'https://img.koket.se/kfs.jpg' },
      recipeIngredient: ['500 g nötfärs', '1&nbsp;gul lök, finhackad', '1 burk krossade tomater (à 400 g)', '1/2 dl vatten', '400 g tagliatelle'],
      recipeInstructions: '<ol><li>Stek färsen i en stekpanna.</li><li>Tillsätt lök och fräs.</li><li>Tillsätt tomater och vatten. Låt sjuda i 20 minuter.</li><li>Koka pastan och servera.</li></ol>' }] }),
  `<h1>Köttfärssås med tagliatelle</h1>${filler}`) },
wprm: { url: 'https://zeinaskitchen.se/kycklingshawarma/', html: wrap(
  `<title>Kycklingshawarma – Zeinas Kitchen</title><meta property="og:title" content="Kycklingshawarma – Zeinas Kitchen">` + ld({ '@context': 'https://schema.org', '@type': 'Article', headline: 'Kycklingshawarma' }),
  `<h1>Kycklingshawarma</h1>${filler}
  <div class="wprm-recipe"><div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">Marinad</h4><ul>
   <li class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">1</span> <span class="wprm-recipe-ingredient-unit">kg</span> <span class="wprm-recipe-ingredient-name">kycklinglårfilé</span></li>
   <li class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">3</span> <span class="wprm-recipe-ingredient-name">vitlöksklyftor</span></li>
   <li class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">1</span> <span class="wprm-recipe-ingredient-unit">dl</span> <span class="wprm-recipe-ingredient-name">olivolja</span></li>
   <li class="wprm-recipe-ingredient"><span class="wprm-recipe-ingredient-amount">2</span> <span class="wprm-recipe-ingredient-unit">tsk</span> <span class="wprm-recipe-ingredient-name">spiskummin</span></li></ul></div>
   <ul class="wprm-recipe-instructions">
   <li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text">Pressa vitlöken och blanda med olja och kryddor.</div></li>
   <li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text">Vänd ner kycklingen och låt marinera minst 2 timmar.</div></li>
   <li class="wprm-recipe-instruction"><div class="wprm-recipe-instruction-text">Grilla kycklingen och skär i strimlor.</div></li></ul>
   <span class="wprm-recipe-servings">4</span><span class="wprm-recipe-total_time">40</span> min</div>`) },
headers: { url: 'https://www.tasteline.com/recept/kanelbullar/', html: wrap(
  `<title>Kanelbullar - Tasteline.com</title>` + ld({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Kanelbullar', recipeYield: 'ca 30 st', totalTime: 'PT2H',
    recipeIngredient: ['Deg', '50 g jäst', '5 dl mjölk', '150 g smör', 'ca 13 dl vetemjöl', 'Fyllning:', '100 g smör', '1 msk kanel', 'Till pensling', '1 ägg'],
    recipeInstructions: 'Smält smöret och tillsätt mjölken.\nSmula jästen i en bunke och häll över degvätskan.\nTillsätt mjöl och arbeta degen smidig. Låt jäsa 30 minuter.\nKavla ut, bred på fyllningen och rulla ihop.\nGrädda i 250°C i 5–8 minuter.' }),
  `<h1>Kanelbullar</h1>${filler}`) },
microdata: { url: 'https://www.recepten.se/recept/pannkakor.html', html: wrap(`<title>Pannkakor - Recepten.se</title>`,
  `<div itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">Pannkakor</h1>${filler}
   <span itemprop="recipeYield">4 portioner</span>
   <ul><li itemprop="recipeIngredient">3 ägg</li><li itemprop="recipeIngredient">6 dl mjölk</li><li itemprop="recipeIngredient">2,5 dl vetemjöl</li><li itemprop="recipeIngredient">0,5 tsk salt</li></ul>
   <div itemprop="recipeInstructions"><p>Vispa mjölet med hälften av mjölken.</p><p>Vispa i resten av mjölken och äggen.</p><p>Stek tunna pannkakor i smör.</p></div></div>`) },
entities: { url: 'https://www.allas.se/recept/skagenrora/', html: wrap(`<title>Skagenröra | Allas.se</title>` + ld({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Skagenr&#246;ra',
    recipeYield: 4, recipeIngredient: ['400 g r&auml;kor med skal', '1&nbsp;dl majonn&auml;s', '&frac12; knippe dill', 'salt och peppar'],
    recipeInstructions: [{ '@type': 'HowToStep', text: '1. Skala r&auml;korna.' }, { '@type': 'HowToStep', text: '2. Hacka dillen och blanda allt.' }] }),
  `<h1>Skagenröra</h1>${filler}`) },
paragraph: { url: 'https://www.godare.se/recept/ugnslax', html: wrap(`<title>Ugnslax - Godare</title>` + ld({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Ugnslax med citron',
    recipeYield: '4 personer', totalTime: 'PT35M', recipeIngredient: ['600 g laxfilé', '1 citron', '2 msk olivolja', '1 kruka dill'],
    recipeInstructions: 'Sätt ugnen på 200 grader. Lägg laxen i en ugnsform och pressa över citron. Ringla över olja. Baka i ugnen ca 20 minuter. Strö över dill och servera.' }),
  `<h1>Ugnslax med citron</h1>${filler}`) },
nojsonld: { url: 'https://www.mittkok.se/recept/vafflor', html: wrap(`<title>Våfflor - Mitt Kök</title><meta property="og:title" content="Våfflor">`,
  `<h1>Våfflor</h1>${filler}<h2>Ingredienser</h2><ul><li>3 dl vetemjöl</li><li>2 tsk bakpulver</li><li>4 dl mjölk</li><li>2 ägg</li><li>75 g smör</li></ul>
   <h2>Gör så här</h2><ol><li>Blanda mjöl och bakpulver.</li><li>Vispa ner mjölken och äggen.</li><li>Rör ner smält smör.</li><li>Grädda i varmt våffeljärn.</li></ol>
   <h3>Fler recept du kanske gillar</h3><ul><li>Pannkakor</li><li>Kanelbullar</li></ul>`) },
inlinenumbers: { url: 'https://www.ica.se/recept/potatisbullar-med-ost/', html: wrap(`<title>Potatisbullar med ost | ICA</title>` + ld({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'Potatisbullar med ost',
    recipeYield: '4 portioner', totalTime: 'PT30M', recipeIngredient: ['810 g potatisbullar', '3 dl riven ost', '½ dl jalapeños'],
    recipeInstructions: '1. Sätt ugnen på 225 grader. 2. Dela varje potatisbulle i 4. Lägg bitarna på en plåt. 3. Strö över ost och gratinera ca 10 minuter.' }),
  `<h1>Potatisbullar med ost</h1>${filler}`) },
};
