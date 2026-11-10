/**
 * What has changed, newest first, shown under Nyheter in Settings. Add a line here for changes
 * a user would notice; the version is the one the change came in.
 */
export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.168',
    date: '2026-11-10',
    items: [
      'Näringsvärdet går att skriva in under Redigera recept, per portion, per 100 g eller för hela rätten. De andra räknas ut av sig själva.',
      'Fotade receptsidor läses del för del: spalter, rutor och tabeller hålls isär, och berättelser, dryckestips och näringsrutor runt receptet hoppas över.',
    ],
  },
  {
    version: '1.0.167',
    date: '2026-11-10',
    items: [
      'Näringsvärde under Anteckningar i varje recept: per portion, per 100 g och för hela rätten. Recept från webbsidor får sidans värden, egna recept räknas ut från ingredienserna.',
      'Fotade recept med liten text eller ljus text på mörk botten läses bättre.',
      'Ett steg som "Stek i ca 8-10 minuter" delas inte längre i två.',
    ],
  },
  {
    version: '1.0.166',
    date: '2026-11-10',
    items: [
      'Recept från ica.se går att läsa in via länk.',
      'Recept från länk får med garnering utan mängd, som citronskivor, och tips blir inte ett eget steg.',
      '1 purjolök (à ca 300 g) blir 1 purjolök i stället för 300 g.',
    ],
  },
  {
    version: '1.0.165',
    date: '2026-11-10',
    items: [
      'Recept utan bild visas med en grå ruta och Ingen bild vald i stället för ett foto av en sallad.',
      'Ett fotograferat recept får inte längre fotot som bild.',
      'Egen måltid i Planerare visar namnet med en ikon som passar, som en matlåda för Rester och en påse för Hämtmat.',
    ],
  },
  {
    version: '1.0.164',
    date: '2026-11-09',
    items: [
      'Inklistrad recepttext hamnar i rätt rutor oftare, även med emojis, osynliga tecken, tabeller, kommalistor och rader som Laxfilé: 500 g.',
      'Drinkar och recept med bara en ingrediens går att läsa in från länk.',
      'Planeraren visar vilka måltider som redan finns i inköpslistan, och de läggs inte till en gång till.',
      'Samma vara i olika mått, som dl och msk eller g och kg, läggs ihop i inköpslistan.',
      '1 timme och 15 minuter i ett steg blir en timer.',
      'Stegen får inte längre dubbla nummer när receptet sparas.',
      'Maträttens namn står på en rad i planeraren.',
    ],
  },
  {
    version: '1.0.163',
    date: '2026-11-08',
    items: [
      'Recept från länk tappar inte längre tal i stegen, som 4:an i Dela varje potatisbulle i 4.',
      'Potatisbullar och liknande räknas som mat, inte efterrätt.',
    ],
  },
  {
    version: '1.0.162',
    date: '2026-11-08',
    items: [
      'I Gör så här visar tomaterna mängden för flera tomater och tomaten mängden för en, när receptet har båda. Rätter som tomatsalsa räknas inte som ingrediensen.',
    ],
  },
  {
    version: '1.0.161',
    date: '2026-11-08',
    items: [
      'Mängderna i Gör så här bryts i stället för att gå utanför skärmen, och visar bara ingrediensens namn utan till exempel gärna kvisttomater.',
      'Ord som jalapeños delas inte längre av mängden.',
    ],
  },
  {
    version: '1.0.160',
    date: '2026-11-08',
    items: [
      '4 stora tomater, 3 större potatisar och 3 st ägg tolkas rätt när du lägger till ett recept.',
      'Långa ord och webbadresser i ett öppnat recept bryts i stället för att hamna utanför skärmen.',
    ],
  },
  {
    version: '1.0.159',
    date: '2026-11-08',
    items: [
      'Appen gissar svårighetsgraden när ett recept läggs till, och för recept som saknar en. Den går att ändra.',
      'Svårighetsgraderna heter Lätt, Normal och Avancerad.',
    ],
  },
  {
    version: '1.0.158',
    date: '2026-11-08',
    items: [
      'Ljust läge är standard. Mörkt eller System väljs under Utseende i Inställningar.',
    ],
  },
  {
    version: '1.0.157',
    date: '2026-11-07',
    items: [
      'Utan kategorier i inköpslistan visar alla varor i en lista. Ordningen på avdelningarna ändras under butiksknappen.',
    ],
  },
  {
    version: '1.0.156',
    date: '2026-11-07',
    items: [
      'En rad som Salt och limejuice räknas inte längre som basvara. Bara rader där allt är basvaror gör det.',
      'De gröna topparna är mer genomskinliga när du skrollar.',
    ],
  },
  {
    version: '1.0.155',
    date: '2026-11-07',
    items: [
      'Större text i inköpslistan på den yttre skärmen.',
    ],
  },
  {
    version: '1.0.154',
    date: '2026-11-07',
    items: [
      'Inköpslistan på den yttre skärmen fungerar som den vanliga: avbockade varor står kvar överstrukna i sin avdelning, svep åt vänster tar bort en vara, och ett långt tryck öppnar en meny för att ändra eller ta bort.',
    ],
  },
  {
    version: '1.0.153',
    date: '2026-11-07',
    items: [
      'Inköpslistan på den yttre skärmen har grön topp med antal kvar, ikoner vid avdelningarna och kommentarer under varorna.',
      'På den yttre skärmen står en avbockad vara kvar en stund, så att ett nytt tryck ångrar. Skärmen hålls vaken medan listan är öppen.',
    ],
  },
  {
    version: '1.0.152',
    date: '2026-11-07',
    items: [
      'Veckoplan heter Planerare.',
      'Planeraren, inköpslistan och inställningarna har samma gröna, lite genomskinliga topp som receptlistan på telefonen.',
    ],
  },
  {
    version: '1.0.151',
    date: '2026-11-07',
    items: [
      'Receptlistans gröna topp är lite genomskinlig, som bottenmenyn.',
    ],
  },
  {
    version: '1.0.150',
    date: '2026-11-07',
    items: [
      'Sök och kategorier står kvar överst när receptlistan skrollas, och veckan står kvar överst i veckoplanen.',
    ],
  },
  {
    version: '1.0.149',
    date: '2026-11-07',
    items: [
      'Sökfältet och kategorierna i receptlistan ligger på grön bakgrund på telefonen.',
    ],
  },
  {
    version: '1.0.148',
    date: '2026-11-07',
    items: [
      'Svep en vara åt vänster i inköpslistan för att ta bort den. Ångra lägger tillbaka den.',
      'Alla knappar går att träffa på minst 44 × 44 pixlar, även de som ser mindre ut.',
      'Mindre bilder i listvyn för recept, så att namnen får mer plats.',
    ],
  },
  {
    version: '1.0.147',
    date: '2026-11-07',
    items: [
      'Lunch utan vald rätt visar en matlåda och Ingen lunch vald, med samma form som när en lunch är vald.',
      'Rättens namn får plats på två rader i veckovyn och på lunchraden, så långa namn syns hela.',
    ],
  },
  {
    version: '1.0.146',
    date: '2026-11-07',
    items: [
      'Meddelandena överst, som Ångra och Det finns en ny version, går att svepa bort uppåt eller åt sidan.',
      'En dag utan middag har samma form som en med middag, så knapparna inte flyttar sig när du väljer.',
    ],
  },
  {
    version: '1.0.145',
    date: '2026-11-07',
    items: [
      'Ändra namn, mängd och enhet på varor i inköpslistan, via de tre prickarna vid varan.',
      'Byt kategori i inköpslistan öppnas igen.',
    ],
  },
  {
    version: '1.0.144',
    date: '2026-11-07',
    items: [
      'Appen kommer ihåg kategori, filter, sortering och Dag eller Vecka i veckoplanen, även när den stängs.',
      'Hjärtat och Alla står still när kategorierna skrollas i sidled.',
      'Butik, Fäll ihop och Ordna står på samma rad i inköpslistan.',
    ],
  },
  {
    version: '1.0.143',
    date: '2026-11-07',
    items: [
      'Tryck på bilden i ett recept för att se den i helskärm. Dubbeltryck eller nyp för att zooma.',
      'Dagarna i veckovyn är lika höga med och utan middag, så inget hoppar när du väljer.',
    ],
  },
  {
    version: '1.0.142',
    date: '2026-11-07',
    items: [
      'I veckovyn öppnas valet av middag direkt för en tom dag, och du stannar kvar i veckan.',
      'Lunch läggs till och middagen tas bort, med papperskorgen, direkt från veckovyn.',
      'När någon bockar av en vara i inköpslistan syns det direkt hos de andra i hushållet.',
      'Inköpslistan hämtas på nytt när appen öppnas efter en stund.',
    ],
  },
  {
    version: '1.0.141',
    date: '2026-11-07',
    items: [
      'Bottenmenyn är ljusgrön längst ner och vit upptill, och plusknappen har ingen vit ring.',
    ],
  },
  {
    version: '1.0.140',
    date: '2026-11-07',
    items: [
      'Kött & Färs är uppdelat i Nöt, Fläsk, Lamm, Vilt och Färs. Recept som redan finns sorteras om efter namn och ingredienser.',
    ],
  },
  {
    version: '1.0.139',
    date: '2026-11-07',
    items: [
      'Recepten kan visas som en lista med liten bild. Byt vy med ikonen bredvid sorteringen.',
      'Favoriter är ett hjärta först i raden med kategorier.',
    ],
  },
  {
    version: '1.0.138',
    date: '2026-11-07',
    items: [
      'Nyheter och Användarvillkor under Om appen i Inställningar.',
      'Radera allt under Avancerat tar bort dina uppgifter ur databasen och från telefonen.',
      'En länk till MatKlar som delas i en chatt visar en bild och en kort beskrivning.',
      'Att ta bort ett hushåll tar nu bort det ur databasen också, inte bara från telefonen.',
    ],
  },
  {
    version: '1.0.137',
    date: '2026-11-07',
    items: [
      'Slumpa veckan i veckoplanen fyller dagarna som saknar middag.',
      'På bred skärm står receptets bild till vänster över ingredienserna, och kolumnerna skrollar var för sig.',
      'På bred skärm ligger timern och det minimerade receptet nere till höger.',
      'Grå platshållare medan recept och bilder laddas.',
      'Inköpslistan visas ensam och med stor text på den yttre skärmen på vikbara telefoner.',
      'Egna typsnitt, appikoner och en sida om personuppgifter.',
    ],
  },
  {
    version: '1.0.128',
    date: '2026-11-06',
    items: [
      'Mörkt läge, under Utseende i Inställningar.',
      'Sortera recepten, även på svårighetsgrad.',
      'Dela recept med en länk eller som bild till dem som inte är med i hushållet.',
      'Timern finns kvar när receptet stängs, och ett recept kan minimeras ovanför bottenmenyn.',
      'Mängderna står i parentes efter ingredienserna i Gör så här.',
      'Middag heter Varmrätt, eftersom den kan ätas både till lunch och middag.',
      'Inköpslistan från veckoplanen tar bara med dagar från i dag och framåt.',
      'Rester från middagen kan bli lunch nästa dag.',
      'Svårighetsgrad på recepten, och Slumpa med animation i veckoplanen.',
      'Appen säger till när det finns en ny version.',
    ],
  },
];
