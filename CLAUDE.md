# MatKlar (ReceptApp)

Svensk app för recept, veckoplan och inköpslista. React, TypeScript och Vite, med Supabase för synk i hushållet.

## Arbetssätt

- Svara på svenska. Användaren testar på telefon, så beskriv ändringar i vardagliga ord.
- Höj versionen vid varje ändring, både i `src/version.ts` och `package.json`. Ändringar som användaren märker skrivs också in i `src/data/changelog.ts`, som visas under Nyheter.
- Typkontroll: `npx tsc -p tsconfig.app.json --noEmit`.
- Tolkningen av inklistrad recepttext kontrolleras mot 18 recepttexter med `npx tsx scripts/check-recipe-parser.ts`. Kör den när `parseRawRecipeText` ändras, och lägg till nya texter i `scripts/recipe-parser-cases.ts` när ett recept tolkas fel.
- Hämtning av recept från webblänk kontrolleras mot 9 testsidor med `npx tsx scripts/check-web-scraper.mts`. Kör den när `src/services/webRecipeScraper.ts` ändras. Sidorna finns i `scripts/web-recipe-pages.ts`.
- Kör appen utan Supabase när du testar, så att riktiga hushållsdata inte ändras.
- `.env.local` och `supabase-config.json` innehåller nycklar och ska inte läggas i Git.
- Mörkt läge: `src/styles/dark.css` tas fram av `python3 scripts/build-dark-theme.py` ur färgerna i klassnamnen. Kör skriptet när en ny färg används, och lägg till en mörk motsvarighet i skriptet om den saknas.
- Tangentbordet ska aldrig öppnas av sig självt när en ruta visas. Använd inte `autoFocus` och fokusera inte textfält när en ruta öppnas.

## Var saker finns

- Kategorier och basvaror: `detectAisle` och `isCommonPantryStaple` i `src/utils/ingredientParser.ts`.
- Inköpslistans sammanslagning och valda kategorier: `src/utils/shoppingAggregator.ts`.
- Synk mot Supabase: `src/services/realtimeSync.ts`. Tabellerna finns i `supabase_schema.sql`.
- Ändringar i `supabase_schema.sql` måste användaren själv köra i Supabase.

## Publicering

Vercel bygger och publicerar varje ändring på `main` här till matklar.vercel.app. Det som hamnar på `main` går alltså direkt ut till användarna. Det äldre repot `ostermanjonatan-lab/Matklar` och dess adress på GitHub Pages uppdateras inte längre.
