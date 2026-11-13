/**
 * Which kinds of meat a dish has: Nöt, Fläsk, Lamm and Vilt, and Färs for dishes made from mince.
 * They replaced the old subcategory "Kött & Färs". The name decides first; the ingredients only when the name says
 * nothing, and stock and fond are left out ("kalvfond" in a fish dish is not beef).
 */

/** The old subcategory, still found in recipes saved before the split */
export const OLD_MEAT_SUBCATEGORY = 'Kött & Färs';

const MIXED = /blandfärs|köttbull|kåldolm|pannbiff/;
const BEEF =
  /nöt(kött|färs|fil|stek|bog|bringa|ytterlår|innanlår|kind)|oxfil|oxkött|oxsvans|ryggbiff|entrecôte|entrecote|rostbiff|högrev|kalops|kalv|flankstek|bavette|ribeye|t-bone|chuck/;
/** Biff and färs are beef unless the dish says lamb or game ("älgfärsbiffar") */
const GENERIC = /biff|köttfärs|färs($|[^a-zåäök])/;
const PORK =
  /fläsk|bacon|skinka|karré|revbensspjäll|spareribs|pulled pork|korv|chorizo|salami|prosciutto|pancetta|guanciale|kassler|(^|[^a-zåäö])gris/;
const LAMB = /lamm|fårkött|fårfiol/;
/** Dishes made from mince, whatever the meat: they also get "Färs" */
const MINCE = /(kött|nöt|bland|fläsk|lamm|älg|hjort|vilt|vildsvin|ren|högrevs)färs|färs($|[^a-zåäök])|färsbiff|köttbull|kåldolm|pannbiff|järpar|frikadell/;
const GAME = /vilt|älg|hjort|rådjur|vildsvin|renskav|renstek|renkött|renfilé|fasan|(^|[^a-zåäö])ank(a|bröst|lår)/;

function kindsIn(text: string): string[] {
  const t = text.toLowerCase();
  const kinds: string[] = [];
  const lamb = LAMB.test(t);
  const game = GAME.test(t);
  const pork = PORK.test(t) || MIXED.test(t);
  if (BEEF.test(t) || MIXED.test(t) || (GENERIC.test(t) && !lamb && !game && !pork)) kinds.push('Nöt');
  if (pork) kinds.push('Fläsk');
  if (lamb) kinds.push('Lamm');
  if (game) kinds.push('Vilt');
  if (MINCE.test(t)) kinds.push('Färs');
  return kinds;
}

export function detectMeatKinds(title: string, ingredientNames: string[] = []): string[] {
  const fromTitle = kindsIn(title);
  if (fromTitle.length > 0) return fromTitle;
  const ingredients = ingredientNames.filter((n) => !/fond|buljong/i.test(n)).join(' ');
  return kindsIn(ingredients);
}
