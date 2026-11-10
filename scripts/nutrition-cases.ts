/**
 * Recipes with nutrition per portion from their web page (Arla, worked out there from
 * Livsmedelsverket's database), for scripts/check-nutrition.ts. The ingredient lines are as the
 * page writes them; the values are per portion (or per piece or slice, then "portions" is the count).
 */
export interface NutritionCase {
  name: string;
  url: string;
  portions: number;
  ingredients: string[];
  perPortion: { kcal?: number; carbs?: number; fat?: number; protein?: number; fiber?: number };
}

export const NUTRITION_CASES: NutritionCase[] = [
  {
    "name": "Asiatisk köttfärsgryta",
    "url": "https://www.arla.se/recept/asiatisk-kottfarsgryta/",
    "portions": 4,
    "ingredients": [
      "1 bananschalottenlök",
      "3 vitlöksklyftor",
      "50 g färsk ingefära",
      "250 g champinjoner",
      "1 msk Arla Köket® Smör- & rapsolja, till stekning",
      "400 g nötfärs",
      "1 tsk chili flakes",
      "½ dl japansk soja",
      "½ dl ostronsås",
      "2 msk sesamolja",
      "3 dl Arla Köket® Matlagningsgrädde",
      "1 lime, finrivet skal och saft",
      "salt",
      "250 g broccoli",
      "250 g äggnudlar",
      "½ knippe salladslök",
      "1 kruka färsk koriander",
      "2 msk rostade sesamfrön"
    ],
    "perPortion": {
      "kcal": 704.0,
      "carbs": 55.8,
      "fat": 36.2,
      "protein": 38.7,
      "fiber": 7.6
    }
  },
  {
    "name": "Baconlindade dadlar med ädelost",
    "url": "https://www.arla.se/recept/baconlindade-dadlar-med-adelost/",
    "portions": 12,
    "ingredients": [
      "50 g Kvibille® Ädel Grädd",
      "50 g Arla® Färskost Naturell",
      "12 färska dadlar",
      "3 skivor bacon",
      "1 msk Svenskt Smör från Arla®",
      "¼ kruka färsk persilja"
    ],
    "perPortion": {
      "kcal": 79.0,
      "carbs": 6.6,
      "fat": 5.1,
      "protein": 1.8,
      "fiber": 0.7
    }
  },
  {
    "name": "Banankaka",
    "url": "https://www.arla.se/recept/banankaka/",
    "portions": 12,
    "ingredients": [
      "25 g Svenskt Smör från Arla®, till formen",
      "2 msk ströbröd, till formen",
      "75 g Svenskt Smör från Arla®",
      "½ dl Arla Ko® Mellanmjölk",
      "2 ägg",
      "2 dl strösocker",
      "2 mogna bananer",
      "3 dl vetemjöl",
      "2 tsk malen kanel",
      "½ tsk bikarbonat"
    ],
    "perPortion": {
      "kcal": 213.0,
      "carbs": 31.6,
      "fat": 8.2,
      "protein": 2.9,
      "fiber": 1.1
    }
  },
  {
    "name": "Brynt smörkola med havssalt",
    "url": "https://www.arla.se/recept/brynt-smorkola-med-havssalt/",
    "portions": 60,
    "ingredients": [
      "100 g Svenskt Smör från Arla®",
      "3 dl Arla Ko® Vispgrädde",
      "3 dl strösocker",
      "1½ dl ljus sirap",
      "1 msk glykossirap",
      "½ tsk flingsalt"
    ],
    "perPortion": {
      "kcal": 62.0,
      "carbs": 7.7,
      "fat": 3.4,
      "protein": 0.1,
      "fiber": 0.0
    }
  },
  {
    "name": "Busenkla korvgrytan",
    "url": "https://www.arla.se/recept/busenkla-korvgrytan/",
    "portions": 4,
    "ingredients": [
      "400 g falukorv",
      "1 gul lök",
      "1 tsk Arla Köket® Smör- & rapsolja",
      "400 g krossade tomater",
      "2 dl Arla Köket® Minifraiche",
      "1 tsk salt",
      "1 krm svartpeppar",
      "3½ dl ris",
      "1 röd paprika",
      "1 gurka"
    ],
    "perPortion": {
      "kcal": 617.0,
      "carbs": 69.0,
      "fat": 29.0,
      "protein": 19.7,
      "fiber": 2.9
    }
  },
  {
    "name": "Chokladbollar",
    "url": "https://www.arla.se/recept/chokladbollar/",
    "portions": 16,
    "ingredients": [
      "150 g Svenskt Smör från Arla®, rumsvarmt",
      "1½ dl strösocker",
      "3 msk kakao",
      "1 tsk vaniljsocker",
      "2 msk vatten eller kallt kaffe",
      "4 dl havregryn",
      "kokos",
      "sesamfrön",
      "strössel"
    ],
    "perPortion": {
      "kcal": 139.0,
      "carbs": 14.4,
      "fat": 8.5,
      "protein": 1.2,
      "fiber": 1.0
    }
  },
  {
    "name": "Chorizogryta",
    "url": "https://www.arla.se/recept/chorizogryta/",
    "portions": 4,
    "ingredients": [
      "900 g potatis",
      "2 msk Arla Köket® Smör- & rapsolja",
      "1 tsk flingsalt",
      "1 förp kokta kikärter",
      "1 gul lök",
      "2 vitlöksklyftor",
      "1 färsk röd chili",
      "1 zucchini",
      "1 röd paprika",
      "300 g chorizo",
      "2 msk Arla Köket® Smör- & rapsolja",
      "1 tsk paprikapulver",
      "½ tsk malen koriander",
      "400 g konserverade körsbärstomater",
      "2 dl Arla Köket® Crème fraiche",
      "salt och svartpeppar",
      "1 dl färsk persilja, grovhackad"
    ],
    "perPortion": {
      "kcal": 760.0,
      "carbs": 59.2,
      "fat": 48.4,
      "protein": 22.6,
      "fiber": 16.2
    }
  },
  {
    "name": "Cowboysoppa",
    "url": "https://www.arla.se/recept/cowboysoppa/",
    "portions": 4,
    "ingredients": [
      "1 bananschalottenlök",
      "2 vitlöksklyftor",
      "2 msk Arla Köket® Smör- & rapsolja",
      "2 msk tomatpuré",
      "1 msk malen spiskummin",
      "1 tsk curry",
      "300 g baljväxtfärs eller nötfärs",
      "6 dl vatten",
      "2 tärningar grönsaksbuljong eller köttbuljong",
      "1 bakpotatis",
      "250 g cocktailtomater",
      "1 röd paprika",
      "2 dl majskorn",
      "2 dl Arla Köket® Lätt crème fraiche paprika & chili",
      "salt och svartpeppar",
      "färsk oregano",
      "1 surdegsbaguette"
    ],
    "perPortion": {
      "kcal": 546.0,
      "carbs": 72.8,
      "fat": 18.4,
      "protein": 21.6,
      "fiber": 16.3
    }
  },
  {
    "name": "Enkel kycklinggryta",
    "url": "https://www.arla.se/recept/enkel-kycklinggryta/",
    "portions": 4,
    "ingredients": [
      "450 g kycklinglårfilé",
      "250 g champinjoner",
      "1 msk Arla Köket® Smör- & rapsolja",
      "1 krm svartpeppar",
      "½ msk soja",
      "1 tärning hönsbuljong",
      "1 msk vetemjöl",
      "5 dl Kelda® Matlagningsgrädde",
      "3½ dl fullkornsbulgur",
      "250 g cocktailtomater",
      "1 gurka",
      "1 paprika",
      "70 g rucola"
    ],
    "perPortion": {
      "kcal": 651.0,
      "carbs": 61.6,
      "fat": 27.6,
      "protein": 38.6,
      "fiber": 9.5
    }
  },
  {
    "name": "Falukorv i ugn",
    "url": "https://www.arla.se/recept/falukorv-i-ugn/",
    "portions": 4,
    "ingredients": [
      "400 g falukorv",
      "½ dl senap",
      "2 dl Arla Köket® Riven ost gratäng",
      "250 g körsbärstomater",
      "½ dl hackad färsk körvel",
      "1 kg potatis",
      "2½ dl Arla Ko® Standardmjölk",
      "25 g Svenskt Smör från Arla®",
      "1 tsk salt",
      "1 krm peppar",
      "1 röd paprika",
      "1 gurka",
      "250 g cocktailtomater",
      "70 g rucola",
      "½ msk vinäger"
    ],
    "perPortion": {
      "kcal": 655.0,
      "carbs": 57.7,
      "fat": 35.8,
      "protein": 25.5,
      "fiber": 7.7
    }
  },
  {
    "name": "Färgglad grönsakspaj",
    "url": "https://www.arla.se/recept/fargglad-gronsakspaj/",
    "portions": 6,
    "ingredients": [
      "125 g Svenskt Smör från Arla®",
      "3 dl vetemjöl",
      "1 tsk salt",
      "ev 1 msk vatten",
      "½ röd paprika",
      "½ gul paprika",
      "½ zucchini",
      "1 rödlök",
      "2 ägg",
      "2½ dl Kelda® Matlagningsgrädde",
      "150 g Kvibille® Riven ost cheddar",
      "1 tsk torkad rosmarin",
      "1 tsk salt",
      "1 krm nymalen peppar",
      "150 g blandad grönsallad",
      "1 msk pressad citronsaft",
      "1 msk olivolja",
      "½ tsk flingsalt",
      "½ tsk svartpeppar"
    ],
    "perPortion": {
      "kcal": 489.0,
      "carbs": 29.2,
      "fat": 36.0,
      "protein": 12.7,
      "fiber": 2.7
    }
  },
  {
    "name": "Fetaost- och spenatpaj",
    "url": "https://www.arla.se/recept/fetaost-och-spenatpaj/",
    "portions": 4,
    "ingredients": [
      "3 dl vetemjöl",
      "150 g Svenskt Smör från Arla® Ekologiskt",
      "1 krm salt",
      "1 msk vatten",
      "2 vitlöksklyftor",
      "1 msk Svenskt Smör från Arla® Ekologiskt",
      "250 g bladspenat, gärna färsk",
      "3 dl Arla Ko® Eko Standardmjölk",
      "3 ägg",
      "½ tsk chili flakes",
      "½ tsk salt",
      "150 g Kvibille® Riven ost cheddar",
      "150 g fetaost eller Apetina® Vitost 20%",
      "250 g cocktailtomater",
      "1 knippe färsk basilika",
      "50 g pinjenötter, rostade"
    ],
    "perPortion": {
      "kcal": 908.0,
      "carbs": 41.0,
      "fat": 69.1,
      "protein": 32.2,
      "fiber": 5.3
    }
  },
  {
    "name": "Fiskgryta med saffran",
    "url": "https://www.arla.se/recept/fiskgryta-med-saffran/",
    "portions": 4,
    "ingredients": [
      "2 pkt saffran à 0,5 g",
      "1 dl vitt matlagningsvin",
      "1 msk fänkålsfrön",
      "1 gul lök",
      "1 fänkål",
      "500 g fast potatis",
      "300 g morot",
      "2 msk Arla Köket® Smör- & rapsolja",
      "1 msk tomatpuré",
      "400 g krossade tomater",
      "6 dl vatten",
      "2 msk skaldjursfond",
      "2½ dl Kelda® Matlagningsgrädde",
      "300 g laxfilé",
      "300 g torskrygg",
      "1 msk sambal oelek",
      "½ tsk salt",
      "2 krm svartpeppar",
      "100 g skalade räkor",
      "1 dl aioli",
      "4 dillvippor",
      "1 baguette"
    ],
    "perPortion": {
      "kcal": 1072.0,
      "carbs": 91.4,
      "fat": 55.7,
      "protein": 50.2,
      "fiber": 11.2
    }
  },
  {
    "name": "Fläskpannkaka ",
    "url": "https://www.arla.se/recept/flaskpannkaka/",
    "portions": 4,
    "ingredients": [
      "300 g rimmat sidfläsk, bacon eller pancetta",
      "3 msk Arla Köket® Smör- & rapsolja",
      "3 dl vetemjöl",
      "6 dl Arla Ko® Standardmjölk",
      "4 ägg",
      "½ tsk salt",
      "1 dl lingonsylt",
      "250 g KESO® Cottage cheese"
    ],
    "perPortion": {
      "kcal": 760.0,
      "carbs": 49.8,
      "fat": 48.1,
      "protein": 32.6,
      "fiber": 1.9
    }
  },
  {
    "name": "Fransk kycklinggryta",
    "url": "https://www.arla.se/recept/fransk-kycklinggryta/",
    "portions": 4,
    "ingredients": [
      "400 g kycklinglårfilé",
      "250 g champinjoner",
      "2 msk Arla Köket® Smör- & rapsolja",
      "3 dl Arla Ko® Syrad grädde",
      "½ msk majsstärkelse",
      "1 msk kycklingfond",
      "2 msk senap, gärna dijonsenap",
      "2 vitlöksklyftor, finrivna",
      "1 tsk torkad timjan",
      "2 krm svartpeppar",
      "½ dl hackad färsk persilja till garnering",
      "1 stor eller 2 små fänkål",
      "1 citron",
      "salt och svartpeppar",
      "3 dl fullkornsris, gärna svart ris"
    ],
    "perPortion": {
      "kcal": 662.0,
      "carbs": 54.3,
      "fat": 35.4,
      "protein": 31.6,
      "fiber": 8.5
    }
  },
  {
    "name": "Fudge",
    "url": "https://www.arla.se/recept/fudge1/",
    "portions": 24,
    "ingredients": [
      "3 dl Arla Ko® Vispgrädde",
      "3 dl strösocker",
      "2 dl vit sirap",
      "1 tsk havssalt",
      "100 g Svenskt Smör från Arla®",
      "200 g mjölkchoklad eller vit choklad"
    ],
    "perPortion": {
      "kcal": 207.0,
      "carbs": 25.3,
      "fat": 11.3,
      "protein": 1.1,
      "fiber": 0.0
    }
  },
  {
    "name": "Grönkålspaj med ädelost ",
    "url": "https://www.arla.se/recept/gronkalspaj-med-adelost/",
    "portions": 8,
    "ingredients": [
      "125 g Svenskt Smör från Arla®, kylskåpskallt",
      "3 dl vetemjöl",
      "2 msk kallt vatten",
      "250 g färsk grönkål, strimlad",
      "½ dl mandelspån",
      "2 dl Kvibille® Riven ost cheddar",
      "140 g Kvibille® Ädel",
      "3 dl Arla Ko® Syrad grädde",
      "3 ägg",
      "½ tsk salt",
      "1 krm svartpeppar"
    ],
    "perPortion": {
      "kcal": 448.0,
      "carbs": 19.0,
      "fat": 36.0,
      "protein": 13.0,
      "fiber": 2.3
    }
  },
  {
    "name": "Italiensk kycklinggryta",
    "url": "https://www.arla.se/recept/italiensk-kycklinggryta/",
    "portions": 4,
    "ingredients": [
      "900 g kycklinglår med skinn och ben",
      "1 tsk salt",
      "2 krm svartpeppar",
      "1 dl vetemjöl",
      "1 msk Arla Köket® Smör- & rapsolja",
      "2 gula lökar",
      "2 vitlöksklyftor",
      "2 morötter",
      "2 stjälkar blekselleri",
      "250 g champinjoner",
      "1 msk Arla Köket® Smör- & rapsolja",
      "2 msk tomatpuré",
      "1 rosmarinkvist",
      "2 dl rött matlagningsvin",
      "1 dl gröna oliver utan kärna",
      "2 msk kapris",
      "400 g konserverade körsbärstomater",
      "2 msk balsamvinäger",
      "2 dl crème fraiche med paprika och chili",
      "4 dl risoni",
      "2 msk bladpersilja"
    ],
    "perPortion": {
      "kcal": 1032.0,
      "carbs": 93.5,
      "fat": 45.2,
      "protein": 60.1,
      "fiber": 9.0
    }
  },
  {
    "name": "Janssons frestelse ",
    "url": "https://www.arla.se/recept/janssons-frestelse/",
    "portions": 4,
    "ingredients": [
      "1 gul lök",
      "3 msk Svenskt Smör från Arla®",
      "750 g fast potatis",
      "1 burk ansjovisfilé (ca. 125 g)",
      "3 dl Arla Ko® Vispgrädde",
      "1 msk ströbröd"
    ],
    "perPortion": {
      "kcal": 585.0,
      "carbs": 39.5,
      "fat": 43.7,
      "protein": 9.3,
      "fiber": 4.5
    }
  },
  {
    "name": "Kålmaja",
    "url": "https://www.arla.se/recept/kalmaja/",
    "portions": 4,
    "ingredients": [
      "450 g vitkål",
      "1 gul lök",
      "25 g Svenskt Smör från Arla®",
      "2 msk ljus sirap",
      "400 g nötfärs",
      "3 dl Arla Ko® Syrad grädde",
      "1 dl vatten",
      "1 tärning köttbuljong",
      "1 msk kinesisk soja",
      "salt och svartpeppar",
      "900 g potatis",
      "4 saltgurkor",
      "1 msk finhackad bladpersilja"
    ],
    "perPortion": {
      "kcal": 683.0,
      "carbs": 54.4,
      "fat": 39.4,
      "protein": 28.0,
      "fiber": 8.8
    }
  },
  {
    "name": "Kanelbullar",
    "url": "https://www.arla.se/recept/kanelbullar/",
    "portions": 20,
    "ingredients": [
      "75 g Svenskt Smör från Arla®",
      "7½ dl vetemjöl",
      "½ dl strösocker",
      "2 krm salt",
      "25 g jäst",
      "2½ dl Arla Ko® Standardmjölk",
      "75 g Svenskt Smör från Arla®",
      "2½ msk strösocker",
      "1½ msk malen kanel",
      "1 uppvispat ägg",
      "pärlsocker"
    ],
    "perPortion": {
      "kcal": 158.0,
      "carbs": 21.1,
      "fat": 6.8,
      "protein": 2.9,
      "fiber": 1.0
    }
  },
  {
    "name": "Kantarellpaj med bacon",
    "url": "https://www.arla.se/recept/kantarellpaj-med-bacon/",
    "portions": 6,
    "ingredients": [
      "125 g Svenskt Smör från Arla®",
      "3 dl vetemjöl",
      "1 msk paprikapulver",
      "2 msk kallt vatten",
      "400 g kantareller",
      "1 gul lök",
      "140 g bacon",
      "3 dl Arla Köket® Matlagningsgrädde",
      "3 ägg",
      "150 g Kvibille® Riven ost cheddar",
      "2 krm cayennepeppar",
      "½ tsk salt",
      "1 kruka färsk persilja"
    ],
    "perPortion": {
      "kcal": 561.0,
      "carbs": 26.8,
      "fat": 42.8,
      "protein": 18.1,
      "fiber": 4.0
    }
  },
  {
    "name": "Kärleksmums",
    "url": "https://www.arla.se/recept/karleksmums/",
    "portions": 20,
    "ingredients": [
      "200 g Svenskt Smör från Arla®",
      "2 dl Arla Ko® Standardmjölk",
      "4 ägg",
      "4 dl strösocker",
      "4 dl vetemjöl",
      "2½ tsk bakpulver",
      "2 tsk vaniljsocker",
      "1½ dl kakao",
      "2 krm salt",
      "100 g Svenskt Smör från Arla®",
      "½ dl starkt kaffe",
      "4 msk kakao",
      "2 tsk vaniljsocker",
      "5 dl florsocker",
      "1 dl kokosflingor"
    ],
    "perPortion": {
      "kcal": 332.0,
      "carbs": 43.6,
      "fat": 15.8,
      "protein": 3.8,
      "fiber": 2.0
    }
  },
  {
    "name": "Kladdkaka",
    "url": "https://www.arla.se/recept/kladdkaka/",
    "portions": 12,
    "ingredients": [
      "100 g Svenskt Smör från Arla®",
      "2½ dl strösocker (ca. 225 g)",
      "2 ägg (ca. 104 g)",
      "1 dl vetemjöl (ca. 60 g)",
      "3 msk kakao (ca. 18 g)",
      "1 tsk vaniljsocker (ca. 3 g)",
      "florsocker",
      "3 dl Arla Ko® Vispgrädde"
    ],
    "perPortion": {
      "kcal": 265.0,
      "carbs": 23.5,
      "fat": 18.1,
      "protein": 2.4,
      "fiber": 0.7
    }
  },
  {
    "name": "Klassisk gubbröra",
    "url": "https://www.arla.se/recept/klassisk-gubbrora/",
    "portions": 6,
    "ingredients": [
      "3 normalstora potatisar",
      "4 ägg",
      "1 gul lök",
      "1 msk Svenskt Smör från Arla®",
      "1 burk ansjovisfilé à 125 g eller 1 burk matjesill à 200 g",
      "1 dl Arla Köket® Crème fraiche",
      "1 msk sillspad",
      "½ kruka färsk dill, hackad",
      "½ kruka färsk gräslök, finskuren",
      "salt och svartpeppar",
      "6 skivor knäckebröd eller danskt rågbröd"
    ],
    "perPortion": {
      "kcal": 251.0,
      "carbs": 22.1,
      "fat": 13.9,
      "protein": 9.4,
      "fiber": 2.2
    }
  },
  {
    "name": "Klassisk knäck",
    "url": "https://www.arla.se/recept/klassisk-knack/",
    "portions": 75,
    "ingredients": [
      "3 dl Arla Ko® Vispgrädde",
      "3 dl ljus sirap",
      "3 dl strösocker",
      "1 dl skållad, hackad mandel",
      "2 msk Svenskt Smör från Arla®"
    ],
    "perPortion": {
      "kcal": 56.0,
      "carbs": 8.2,
      "fat": 2.4,
      "protein": 0.3,
      "fiber": 0.2
    }
  },
  {
    "name": "Korvgryta",
    "url": "https://www.arla.se/recept/korvgryta/",
    "portions": 4,
    "ingredients": [
      "4 färska chorizo (ca. 300 g)",
      "1 gul lök",
      "2 röda paprikor",
      "1 msk Arla Köket® Smör- & rapsolja",
      "2 msk tomatpuré",
      "1 tsk malen spiskummin",
      "1 tsk paprikapulver",
      "1 tsk strösocker",
      "400 g konserverade körsbärstomater",
      "2 dl Arla Köket® Crème fraiche",
      "salt och svartpeppar",
      "3 dl couscous eller ris",
      "25 g bladpersilja",
      "1 dl granatäppelkärnor"
    ],
    "perPortion": {
      "kcal": 673.0,
      "carbs": 60.7,
      "fat": 38.0,
      "protein": 22.2,
      "fiber": 8.3
    }
  },
  {
    "name": "Köttbullar",
    "url": "https://www.arla.se/recept/kottbullar/",
    "portions": 4,
    "ingredients": [
      "500 g blandfärs",
      "½ dl ströbröd",
      "1 dl Arla Ko® Standardmjölk",
      "1 gul lök",
      "1 ägg",
      "1 krm malen kryddnejlika",
      "1 krm malen kryddpeppar",
      "1 tsk salt",
      "1 krm svartpeppar",
      "25 g Svenskt Smör från Arla®",
      "1 kg mjölig potatis",
      "2 dl Arla Ko® Standardmjölk",
      "½ dl Arla Ko® Vispgrädde",
      "1 tsk salt",
      "225 g tinade frysta lingon",
      "1 dl strösocker",
      "1 gurka",
      "½ tsk salt",
      "2 msk ättiksprit 12%",
      "4 msk strösocker",
      "1 dl vatten",
      "färsk persilja eller dill, hackad"
    ],
    "perPortion": {
      "kcal": 799.0,
      "carbs": 94.7,
      "fat": 31.3,
      "protein": 33.9,
      "fiber": 7.6
    }
  },
  {
    "name": "Köttfärspaj",
    "url": "https://www.arla.se/recept/kottfarspaj/",
    "portions": 6,
    "ingredients": [
      "125 g Svenskt Smör från Arla®",
      "3 dl vetemjöl",
      "1 msk vatten",
      "1 krm salt",
      "1 purjolök",
      "3 vitlöksklyftor",
      "100 g champinjoner",
      "1 msk Arla Köket® Smör- & rapsolja",
      "400 g köttfärs",
      "2 msk tomatpuré",
      "1 msk paprikapulver",
      "1 tsk torkad rosmarin",
      "2 tsk sambal oelek",
      "1 tsk salt",
      "2 dl Arla Ko® Mellanmjölk",
      "2 ägg",
      "1 dl Kvibille® Riven ost cheddar",
      "blandad grönsallad"
    ],
    "perPortion": {
      "kcal": 480.0,
      "carbs": 26.7,
      "fat": 31.8,
      "protein": 22.3,
      "fiber": 3.0
    }
  },
  {
    "name": "Kycklinggryta med kokosmjölk",
    "url": "https://www.arla.se/recept/kycklinggryta-med-kokosmjolk/",
    "portions": 4,
    "ingredients": [
      "450 g kycklinglårfilé",
      "1 gul lök",
      "2 vitlöksklyftor",
      "1 röd paprika",
      "2 msk Arla Köket® Smör- & rapsolja",
      "2 tsk curry",
      "2 tsk paprikapulver",
      "½ tsk salt",
      "400 ml kokosmjölk",
      "2½ dl Arla Köket® Matlagningsgrädde",
      "1 tärning kycklingbuljong",
      "3½ dl ris",
      "1 kruka färsk persilja",
      "1 dl mango chutney"
    ],
    "perPortion": {
      "kcal": 758.0,
      "carbs": 70.5,
      "fat": 38.2,
      "protein": 32.8,
      "fiber": 3.0
    }
  },
  {
    "name": "Lasagne",
    "url": "https://www.arla.se/recept/lasagne/",
    "portions": 4,
    "ingredients": [
      "500 g köttfärs",
      "2 gula lökar",
      "2 vitlöksklyftor",
      "1 msk Arla Köket® Smör- & rapsolja",
      "400 g krossade tomater",
      "2 msk tomatpuré",
      "2 tsk torkad oregano",
      "1 krm svartpeppar",
      "1 tärning grönsaksbuljong",
      "9 lasagneplattor",
      "3 msk vetemjöl",
      "7 dl Arla Ko® Standardmjölk",
      "3 dl Arla Köket® Riven ost gratäng",
      "½ tsk salt"
    ],
    "perPortion": {
      "kcal": 622.0,
      "carbs": 50.8,
      "fat": 25.4,
      "protein": 46.9,
      "fiber": 4.0
    }
  },
  {
    "name": "Laxsida i ugn",
    "url": "https://www.arla.se/recept/laxsida-i-ugn/",
    "portions": 8,
    "ingredients": [
      "ca 1⅖ kg färsk laxsida",
      "2 msk Arla Köket® Smör- & rapsolja",
      "1½ tsk salt",
      "2 krm nymalen svartpeppar",
      "1 citron",
      "1800 g potatis, till servering",
      "dillvippor, till servering",
      "5 dl Arla Ko® Gräddfil",
      "½ kruka färsk gräslök",
      "1 liten rödlök",
      "80 g röd stenbitsrom",
      "2 tsk dijonsenap",
      "¾ tsk salt",
      "nymalen svartpeppar",
      "500 g cocktailtomater",
      "1 gurka",
      "1 röd paprika",
      "200 g blandad grönsallad",
      "2 msk kallpressad olivolja",
      "1 tsk flingsalt"
    ],
    "perPortion": {
      "kcal": 718.0,
      "carbs": 46.9,
      "fat": 39.5,
      "protein": 43.9,
      "fiber": 7.2
    }
  },
  {
    "name": "Lövbiffsgryta",
    "url": "https://www.arla.se/recept/lovbiffsgryta/",
    "portions": 4,
    "ingredients": [
      "400 g lövbiff",
      "250 g broccoli (ca. 250 g)",
      "250 g svamp, t ex trattkantareller, champinjoner",
      "2 vitlöksklyftor",
      "salt och svartpeppar",
      "1 msk Svenskt Smör från Arla®",
      "2 msk tomatpuré",
      "2 dl Arla Köket® Vispgrädde",
      "1 dl Arla Ko® Standardmjölk",
      "1 tsk dijonsenap",
      "1 tsk sambal oelek",
      "4 port ris, eller matvete",
      "blandad grönsallad"
    ],
    "perPortion": {
      "kcal": 600.0,
      "carbs": 54.2,
      "fat": 26.8,
      "protein": 35.2,
      "fiber": 5.2
    }
  },
  {
    "name": "Lussebullar med Kesella®",
    "url": "https://www.arla.se/recept/lussebullar-med-kesella/",
    "portions": 35,
    "ingredients": [
      "50 g jäst",
      "100 g Svenskt Smör från Arla®",
      "5 dl Arla Ko® Standardmjölk",
      "250 g Arla Köket® Kesella® kvarg 7%",
      "2 pkt saffran à 0,5 g",
      "2 dl strösocker",
      "1 tsk salt",
      "ca 1 kg vetemjöl, 17 dl",
      "russin",
      "1 ägg"
    ],
    "perPortion": {
      "kcal": 163.0,
      "carbs": 27.0,
      "fat": 4.2,
      "protein": 4.0,
      "fiber": 1.0
    }
  },
  {
    "name": "Lussebullar",
    "url": "https://www.arla.se/recept/lussebullar/",
    "portions": 26,
    "ingredients": [
      "2 pkt saffran à 0,5 g",
      "1 msk kokhett vatten",
      "50 g jäst",
      "5 dl Arla Ko® Standardmjölk",
      "2 dl strösocker",
      "1 ägg",
      "1 tsk salt",
      "ca 15 dl vetemjöl, 900 g",
      "150 g Svenskt Smör från Arla®, rumsvarmt",
      "ca ½ dl russin",
      "varmt vatten",
      "1 ägg",
      "1 dl Arla Ko® Standardmjölk",
      "100 g Svenskt Smör från Arla®",
      "2 dl strösocker"
    ],
    "perPortion": {
      "kcal": 270.0,
      "carbs": 41.0,
      "fat": 9.6,
      "protein": 4.5,
      "fiber": 1.3
    }
  },
  {
    "name": "Medelhavspaj",
    "url": "https://www.arla.se/recept/medelhavspaj/",
    "portions": 6,
    "ingredients": [
      "125 g Svenskt Smör från Arla®",
      "3 dl vetemjöl",
      "1 msk vatten",
      "250 g färsk bladspenat",
      "2 hackade vitlöksklyftor",
      "2 msk Arla Köket® Smör- & rapsolja",
      "250 g KESO® Cottage cheese crushed naturell",
      "150 g Apetina® Vitost 20%",
      "1 dl Arla Köket® Vispgrädde",
      "3 ägg",
      "1 dl urkärnade svarta oliver",
      "6 cocktailtomater",
      "salt och svartpeppar",
      "färska blandade örter, till garnering"
    ],
    "perPortion": {
      "kcal": 522.0,
      "carbs": 25.6,
      "fat": 39.4,
      "protein": 17.2,
      "fiber": 2.9
    }
  }
];
