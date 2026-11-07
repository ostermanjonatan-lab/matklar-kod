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
