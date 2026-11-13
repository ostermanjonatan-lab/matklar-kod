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
    version: '1.0.203',
    date: '2026-11-13',
    items: [
      'Planeraren på dator: veckan visas som sju kolumner med stora bilder, rättens hela namn och lunchen under. På mellanstora skärmar visas en dag per rad.',
      'Månadsvyn på dator: en hel månad får plats på skärmen, månaden och veckodagarna står kvar överst när du skrollar, varje dag visar sitt datum och rättens namn syns när du håller musen över bilden.',
    ],
  },
  {
    version: '1.0.202',
    date: '2026-11-13',
    items: [
      'Sök på flera ingredienser samtidigt, till exempel kyckling kokosmjölk, så får du de recept som har allt du skrev. OCH (eller AND) gör samma sak. Med ELLER (eller OR) räcker det att receptet har ett av orden, till exempel lax eller torsk. Parenteser grupperar: (lax eller torsk) och citron.',
      'Svep åt sidan i veckovyn i planeraren för att byta vecka, på samma sätt som du byter dag i dagvyn.',
      'Pannkakor är borttaget från snabbvalen under Egen måltid i planeraren.',
    ],
  },
  {
    version: '1.0.201',
    date: '2026-11-13',
    items: [
      'Tryck på kategorin eller en underkategori i ett recept, till exempel Varmrätt eller Fisk, för att se alla recept som har den. Startskärmen visas då med det filtret valt.',
    ],
  },
  {
    version: '1.0.200',
    date: '2026-11-13',
    items: [
      'Bilderna i rutorna när du väljer middag tonas in mjukt över den förra bilden, i stället för att byta direkt.',
    ],
  },
  {
    version: '1.0.199',
    date: '2026-11-13',
    items: [
      'Planeraren har en månadsvy. Välj Månad uppe till höger för att se bilden på varje dags middag. Månaderna ligger under varandra, så du skrollar uppåt till de som varit och neråt till de som kommer. Tryck på en dag för att öppna den.',
    ],
  },
  {
    version: '1.0.198',
    date: '2026-11-13',
    items: [
      'Bilderna i rutorna när du väljer middag byts oftare och mer oregelbundet. Rutor som stått still länge byter gärna först, och två rutor bredvid varandra byter inte direkt efter varandra.',
    ],
  },
  {
    version: '1.0.197',
    date: '2026-11-13',
    items: [
      'När du väljer middag eller lunch i planeraren kan du välja hur lång tid rätten får ta: högst 15, 30 eller 45 minuter eller 1 timme. Tryck på samma tid igen för att visa alla.',
      'Bilderna i rutorna när du väljer middag byts lugnare: en ruta i taget, i slumpad ordning, med mjukare övertoning. Samma bild visas inte i två rutor samtidigt.',
      'Fotade receptsidor där ingredienserna står tätt intill texten läses bättre. Ingredienserna och stegen hålls isär, och ett ord som är avstavat vid radslut blir ett ord igen.',
    ],
  },
  {
    version: '1.0.195',
    date: '2026-11-12',
    items: [
      'Det är svårare att råka svepa bort en vara i inköpslistan. Raden måste dras halvvägs, och ett svep som avbryts tar aldrig bort något.',
    ],
  },
  {
    version: '1.0.194',
    date: '2026-11-12',
    items: [
      'En sparad lista som bild eller text har rubriken Inköpslista och listans namn, till exempel Inköpslista - Stugan. Under rubriken står bara datumet.',
    ],
  },
  {
    version: '1.0.193',
    date: '2026-11-12',
    items: [
      'Inköpslistan går att dela och spara som bild. Tryck på dela-knappen i Inköp.',
      'Receptbilden har formen av ett A4-ark, så den blir snygg utskriven, och har plats för hålslag i vänsterkanten.',
      'Receptbilden visar ikonen för svårighetsgrad.',
    ],
  },
  {
    version: '1.0.192',
    date: '2026-11-12',
    items: [
      'Rutnätet med kategorier när du väljer middag har rundade hörn längst ut.',
    ],
  },
  {
    version: '1.0.191',
    date: '2026-11-12',
    items: [
      'När du väljer middag eller lunch i planeraren visas kategorierna som ett rutnät med bilder.',
    ],
  },
  {
    version: '1.0.190',
    date: '2026-11-12',
    items: [
      'Specialkost står på samma rad som underkategorierna i ett öppnat recept, i gråblått.',
      'Med ett minimerat recept eller en timer igång går det att skrolla fram knapparna längst ner, som Töm hela listan.',
    ],
  },
  {
    version: '1.0.189',
    date: '2026-11-12',
    items: [
      'I ett öppnat recept syns huvudkategorin, till exempel Varmrätt, i mörkgrönt bland underkategorierna.',
    ],
  },
  {
    version: '1.0.188',
    date: '2026-11-12',
    items: [
      'Ett öppnat recept visar kategori och underkategorier som små etiketter under tiden, med specialkost i grönt på en egen rad.',
    ],
  },
  {
    version: '1.0.187',
    date: '2026-11-12',
    items: [
      'Under Inställningar, Nya underkategorier, finns förslag på de nya underkategorierna för recept som sparades innan de fanns. Du väljer vilka som ska sparas.',
    ],
  },
  {
    version: '1.0.186',
    date: '2026-11-12',
    items: [
      'Nya underkategorier: Pizza, Paj, Wraps & Bröd, Bowls, Medelhav & Mellanöstern, Grill, Bröd, Yoghurt & Fil, Marinader & Rubs, Proteinrikt och Barnvänligt.',
      'Några underkategorier har fått samma namn överallt, till exempel Sallader och Smoothies & Bowls. Kladdkaka ingår nu i Bakverk & Kakor.',
      'Ett öppnat recept visar kategori och underkategorier under bilden.',
      'Egna inköpslistor tas bort med papperskorgen på listans rad i Listor.',
    ],
  },
  {
    version: '1.0.185',
    date: '2026-11-12',
    items: [
      'Ett öppnat recept fyller hela skärmen på telefonen.',
    ],
  },
  {
    version: '1.0.184',
    date: '2026-11-12',
    items: [
      'Receptkorten visar svårighetsgraden med samma ikon som i receptet.',
      'Uppdateringar sker i tysthet. Inget meddelande visas längre när appen har uppdaterats.',
    ],
  },
  {
    version: '1.0.183',
    date: '2026-11-12',
    items: [
      'Receptkorten på startsidan är lägre, så att fler recept syns på en gång.',
    ],
  },
  {
    version: '1.0.182',
    date: '2026-11-12',
    items: [
      'Appen uppdateras av sig själv när du öppnar den igen, om inget recept eller någon ruta är öppen. Annars kommer en fråga som förut.',
    ],
  },
  {
    version: '1.0.181',
    date: '2026-11-11',
    items: [
      'Ungefärlig kostnad är borttagen.',
    ],
  },
  {
    version: '1.0.180',
    date: '2026-11-11',
    items: [
      'Ungefärlig kostnad: tryck på mängden i inköpslistan och skriv vad varan kostar. Listan och recepten visar sedan ungefär vad allt kostar. Det går att stänga av i Inställningar.',
      'Byt ut en ingrediens i ett recept, till exempel grädde mot havregrädde, utan att receptet ändras. Inköpslistan och näringsvärdet räknar med bytet.',
    ],
  },
  {
    version: '1.0.179',
    date: '2026-11-11',
    items: [
      'Fliken högst upp i Inköp heter som listan du har öppen. Tryck på den igen för att byta lista eller skapa en ny.',
      'Meddelanden högst upp sveps bort antingen uppåt eller åt sidan, inte snett.',
    ],
  },
  {
    version: '1.0.178',
    date: '2026-11-11',
    items: [
      'Har du sparade inköpslistor väljer du vilken lista ett recept ska läggas i när du lägger till det. Inköpslista är förvald.',
    ],
  },
  {
    version: '1.0.177',
    date: '2026-11-11',
    items: [
      'Du kan ha flera inköpslistor, till exempel en till stugan. Tryck på listans namn högst upp i Inköp för att byta lista eller skapa en ny. Recept och planeraren lägger fortfarande i Inköpslista.',
    ],
  },
  {
    version: '1.0.176',
    date: '2026-11-11',
    items: [
      'Tryck på mängden på en rad i inköpslistan för att ändra vara, mängd och enhet.',
      'Visas inköpslistan utan kategorier blir den också utan kategorier när du kopierar eller delar den.',
    ],
  },
  {
    version: '1.0.175',
    date: '2026-11-11',
    items: [
      'Trycker du på Recept när du redan är i recepten hoppar sidan till sökfältet och tangentbordet öppnas.',
    ],
  },
  {
    version: '1.0.174',
    date: '2026-11-10',
    items: [
      'När ett steg anger ett intervall, som ca 10-20 min, går tiden att välja med minus och plus innan timern startar.',
    ],
  },
  {
    version: '1.0.173',
    date: '2026-11-10',
    items: [
      'Under näringstabellen visar Visa per ingrediens vad varje ingrediens ger i energi, kolhydrater, protein och fett, och vad den räknats som.',
    ],
  },
  {
    version: '1.0.172',
    date: '2026-11-10',
    items: [
      'En ingrediens kan kopplas till en färdig vara från Open Food Facts under Redigera recept, Näringsvärde. Sök på namn eller streckkod, så används förpackningens näringsvärden.',
    ],
  },
  {
    version: '1.0.171',
    date: '2026-11-10',
    items: [
      'Näringsvärdet känner igen många fler livsmedel, nästan 700 råvaror från Livsmedelsverket, och flera felaktiga träffar är rättade, som sockerfri läsk och ostsås.',
      'Under näringstabellen står vilka ingredienser som inte räknats och varför. Saknas något med mängd syns en varning överst.',
      'Ingredienser i äldre recept där mängden hamnat i namnet, som 400 g krossade tomater, rättas när receptet öppnas.',
      'Ordet färg i ett steg markeras inte längre som färs.',
    ],
  },
  {
    version: '1.0.170',
    date: '2026-11-10',
    items: [
      'Näringsvärden som räknas från ingredienserna använder nu Livsmedelsverkets livsmedelsdatabas och deras uppmätta vikter per dl och styck, och stämmer bättre.',
      'Vikter som står i ingrediensen räknas med, som "à 0,5 g" och "(ca 300 g)".',
    ],
  },
  {
    version: '1.0.169',
    date: '2026-11-10',
    items: [
      'Näringsvärde per 100 g fylls i för sig i Redigera recept och ändrar inte portion eller hela rätten.',
    ],
  },
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
