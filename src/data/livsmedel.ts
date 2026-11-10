/**
 * Nutrition per 100 g edible part from Livsmedelsverkets livsmedelsdatabas (version 2026-06),
 * only the foods the app's table in utils/nutrition.ts uses, by the database's number.
 * [kcal, protein g, kolhydrater (tillgängliga) g, fett g, fiber g, salt g]
 * Source: Livsmedelsverket, Livsmedelsdatabasen, https://soknaringsinnehall.livsmedelsverket.se
 * (öppna data som får användas fritt med Livsmedelsverket angivet som källa).
 */
export const LIVSMEDEL: Record<number, [number, number, number, number, number, number]> = {
  29: [766, 0.6, 0, 86.3, 0, 1.2], // Smör fett 80%
  45: [303, 0.5, 19.7, 25, 0, 1.7], // Dressing till sallad m. majonnäs fett ca 25% kylvara
  50: [666, 1.3, 5, 72.4, 0, 1.1], // Majonnäs fett 80%
  70: [100, 13.4, 1.9, 4.3, 0, 0.7], // Färskost cottage cheese naturell fett 4%
  82: [336, 21.2, 0.2, 28.2, 0, 1.6], // Ädelost blågrön mögelost fett 30%
  94: [272, 16.7, 2.1, 22.1, 0, 2], // Salladsost fett 22%
  96: [358, 26.2, 3, 27.1, 0, 1.1], // Ost hårdost fett 28%
  98: [348, 17, 2.8, 30.2, 0, 1], // Vitmögelost brie fett 30%
  100: [292, 22.3, 1.9, 21.9, 0, 4.2], // Ost halloumi rå fett 22%
  103: [428, 31.1, 4.2, 32.2, 0, 1.3], // Ost hårdost parmesan fett 30% typ Parmiggiano Reggiano
  107: [276, 6.1, 2.4, 27.3, 0, 0.7], // Färskost cream cheese fett 27%
  123: [60, 3.6, 4.6, 3, 0, 0.1], // Mjölk fett 3% berikad
  124: [56, 3.4, 4.5, 2.7, 0, 0.1], // Yoghurt naturell fett 3% berikad
  150: [47, 3.6, 4.7, 1.5, 0, 0.1], // Mellanmjölk fett 1,5% berikad
  162: [354, 10, 64.4, 2.5, 15.5, 1], // Hårt bröd fullkorn råg fibrer 15,5% typ Husman
  188: [402, 10.3, 65.6, 8.6, 9.1, 1.1], // Ströbröd malt hårt bröd fullkorn vete råg socker fibrer ca 5%
  193: [274, 8.6, 53.6, 1.6, 3.4, 1.2], // Bröd vitt vete vatten fibrer ca 3,5% typ pitabröd
  200: [270, 8.5, 53.2, 1.7, 2.6, 1], // Bröd vitt vete fibrer ca 2,5% typ baguette
  207: [270, 5.5, 47.3, 4.7, 7, 0.7], // Bröd fullkorn rågsikt fibrer ca 7% typ kavring
  230: [81, 1.8, 16.8, 0.1, 2.2, 0], // Potatis höst rå
  287: [67, 1.9, 12.8, 0.4, 1.9, 0], // Jordärtskocka
  289: [36, 0.7, 6.6, 0.2, 2.4, 0.1], // Morot
  290: [71, 1.7, 12.6, 0.6, 3.8, 0], // Palsternacka
  320: [197, 1.9, 1.7, 19.6, 4.8, 0], // Avokado
  325: [36, 2.9, 3.5, 0.6, 2.6, 0], // Broccoli
  333: [27, 2.4, 2.7, 0.2, 2.4, 0], // Champinjon
  336: [28, 2.8, 1.8, 0.4, 3.3, 0], // Fänkål
  339: [13, 0.8, 2.3, 0.1, 0, 0], // Gurka
  340: [14, 0.8, 2.5, 0.1, 0, 0], // Isbergssallat
  344: [39, 1.2, 7.3, 0.1, 1.9, 0], // Lök gul
  351: [22, 0.5, 4.1, 0.2, 0.9, 0], // Paprika röd
  352: [78, 5.6, 9.4, 1.1, 3.9, 0.1], // Persilja blad
  354: [30, 1.6, 4.1, 0.2, 2.7, 0], // Purjolök
  361: [20, 2.2, 0.5, 0.6, 2, 0], // Spenat frysvara
  362: [14, 0, 2.5, 0.1, 1.8, 0], // Squash
  364: [18, 0.8, 2.6, 0.1, 1.3, 0], // Tomat
  365: [190, 5, 8.7, 12.5, 12.7, 3.1], // Tomat torkad m. olja
  370: [32, 1.2, 5.7, 0, 2, 0], // Vitkål
  371: [128, 6.8, 21.9, 0.2, 5.3, 0], // Vitlök
  380: [49, 2.4, 5.9, 0.7, 4.8, 0], // Chilipeppar färsk
  400: [80, 2.1, 12.9, 1.5, 2.9, 0.4], // Majskorn konserv. u. lag
  402: [142, 0.8, 1.8, 14.1, 3.5, 2], // Oliver svarta m. olja avrunna
  410: [84, 4.4, 13.5, 0.2, 4.7, 0.1], // Tomatpuré konc. konserv.
  420: [83, 0.9, 18.7, 0.1, 1.5, 0.4], // Syltlök inlagd
  422: [22, 0.8, 3.7, 0.2, 1.2, 0], // Tomat krossad konserv. m. lag
  545: [5, 0.4, 0.4, 0.2, 0, 0.6], // Grönsaksbuljong ätf.
  551: [50, 0.8, 10.4, 0.2, 1.2, 0], // Apelsin
  553: [95, 1.1, 21.3, 0.1, 1.4, 0], // Banan
  559: [50, 0.9, 7.6, 0.7, 4.9, 0], // Citron
  610: [285, 1.9, 64.4, 0.5, 6.1, 0], // Russin
  643: [39, 0.7, 8.6, 0.1, 0, 0], // Apelsinjuice drickf.
  645: [29, 0.6, 6.5, 0, 0, 0], // Citronjuice färskpressad
  655: [86, 3.2, 13.3, 2.1, 0.1, 0.4], // Risgrynsgröt
  702: [375, 9.5, 64.1, 7, 7.5, 0], // Havregryn fullkorn
  831: [361, 12.8, 72.4, 0.6, 5, 0], // Couscous
  845: [358, 11.9, 71.5, 1.3, 4, 0], // Pasta okokt
  884: [339, 24.4, 52.5, 0.8, 10.4, 0], // Linser torkade
  905: [70, 6.6, 1.2, 4.2, 0.4, 0.2], // Tofu fast
  909: [57, 7.5, 6.6, 0, 0, 14.8], // Sojasås
  951: [182, 20.1, 0, 11.3, 0, 0.2], // Nöt färs rå fett 10%
  953: [145, 20.6, 0, 6.9, 0, 0.2], // Nöt högrev rå fett bortskuret
  957: [121, 22.7, 0, 3.2, 0, 0.2], // Nöt rostbiff rå
  963: [211, 19.4, 0, 15, 0, 0.2], // Nöt färs rå fett 15%
  970: [107, 20.6, 0, 2.6, 0, 0.1], // Gris fläskfilé rå
  986: [252, 17.1, 0, 20.7, 0, 0.2], // Gris stekfläsk sida skiva rå m. svål
  991: [353, 11.6, 0, 34.6, 0, 3], // Gris sidfläsk el. stekfläsk skivor rimmat rå
  1003: [344, 13.4, 0, 32.8, 0, 2], // Gris bacon rå
  1010: [99, 18.4, 1.3, 2.2, 0, 3.8], // Gris skinka skivad rökt fett 1-3%
  1164: [115, 21.5, 0, 3.1, 0, 0.2], // Kyckling kött rå u. skinn
  1174: [114, 19.6, 0, 3.9, 0, 0.2], // Kyckling lår rå u. skinn
  1212: [201, 15.2, 23.4, 5, 0, 48.8], // Köttbuljong pasta el. pulver storhushåll
  1225: [136, 12.1, 0, 9.8, 0, 0.3], // Ägg rått
  1226: [325, 15.9, 1.9, 28.6, 0, 0.1], // Äggula rå
  1227: [48, 11.1, 0.8, 0, 0, 0.4], // Äggvita rå
  1243: [108, 18, 0, 4, 0, 0.2], // Strömming rå
  1246: [78, 18.2, 0, 0.5, 0, 0.2], // Torsk rå
  1255: [210, 20.2, 0.7, 14.1, 0, 0.1], // Lax odlad Norge fjordlax rå
  1265: [215, 12.5, 11.8, 13.1, 0, 6.9], // Ansjovis skarpsill konserv. 
  1278: [106, 24.1, 0, 1, 0, 1], // Tonfisk i vatten konserv. avrunnen
  1281: [210, 9.5, 17.1, 11.5, 0.4, 4.2], // Sill matjessill konserv.
  1382: [126, 24.5, 1.5, 2.3, 0, 4.2], // Löjrom saltad
  1395: [77, 17.6, 0, 0.6, 0, 1.6], // Räka kokt
  1487: [254, 12.7, 7.9, 19.3, 0, 2], // Korv falukorv fett 19% kött 58%
  1513: [286, 14.3, 4.1, 23.8, 0, 2.7], // Korv chorizo stekt kött 73%
  1559: [615, 22.6, 14.3, 51, 7.6, 1.2], // Jordnötssmör
  1564: [690, 6.2, 13.1, 67.2, 9.2, 0.1], // Kokosflingor
  1576: [680, 13.8, 8.3, 64.8, 9, 0], // Valnötter
  1614: [449, 6.6, 74.7, 12.8, 3.1, 1.1], // Kex Mariekex
  1641: [395, 5, 31.8, 27.5, 1.4, 0], // Deg smördeg frysvara
  1713: [128, 2.5, 4, 11.5, 0, 0.1], // Gräddfil fett 12%
  1715: [374, 2.1, 3, 40, 0, 0.1], // Vispgrädde fett 40%
  1717: [162, 3, 4.2, 15, 0, 0.1], // Matlagningsgrädde fett 15%
  1719: [323, 2.3, 3.3, 34, 0, 0.1], // Crème fraiche fett 34%
  1798: [148, 0.2, 35.3, 0.2, 1, 0], // Lingonsylt
  1801: [171, 0.2, 41.1, 0.1, 1.1, 0], // Jordgubbssylt
  1886: [394, 23.5, 10.6, 21.5, 34, 0.1], // Kakaopulver fett 20-22%
  1892: [405, 0, 99.6, 0, 0, 0], // Socker
  1894: [323, 0, 79.6, 0, 0, 1.1], // Ljus sirap
  1902: [40, 0.4, 4.6, 0, 0, 0], // Öl pilsner folköl vol. % 3,5
  1908: [70, 0, 1, 0, 0, 0], // Vin vitt vol. % 12
  1925: [222, 0, 0, 0, 0, 0], // Gin vol. % 40
  1934: [325, 8.1, 59.3, 1.7, 18.8, 0], // Rågmjöl fullkorn
  1935: [336, 10.7, 61, 2, 13.8, 0], // Vetemjöl fullkorn grahamsmjöl
  1941: [352, 8.5, 72.4, 1.9, 3.6, 0], // Vetemjöl
  1945: [362, 0, 87.5, 0.7, 0, 0], // Majsstärkelse
  1957: [2, 0, 0.5, 0, 0, 0], // Kaffe bryggt
  1965: [49, 0, 12, 0, 0, 0], // Ättiksprit ättiksyra 12%
  1966: [30, 0.4, 7, 0, 0, 0], // Vinäger ättiksyra 7%
  1969: [91, 1, 18.5, 0.5, 3.9, 1.7], // Ketchup
  1972: [173, 4.5, 23.1, 6.8, 0, 1.2], // Senap svensk
  1975: [0, 0, 0, 0, 0, 99], // Salt m. jod
  1979: [110, 12.1, 14.1, 0.4, 0, 0], // Jäst färsk
  2004: [581, 4.2, 12.6, 57.1, 4.1, 3.2], // Pesto m. basilika pinjenötter cashewnötter
  2055: [535, 5.2, 58.1, 30.8, 3, 0.2], // Mjölkchoklad
  2189: [884, 0, 0, 100, 0, 0], // Rapsolja
  2255: [214, 15.6, 0.8, 16.6, 0, 0.5], // Ost mozzarella fett 18%
  2269: [63, 2.2, 9, 0.8, 5.4, 0], // Ingefära färsk
  2481: [352, 7.8, 76.9, 0.7, 1, 0], // Ris långkornigt okokt
  2492: [201, 18.8, 0, 14.1, 0, 0.2], // Blandfärs rå nöt 70% gris 30%
  3243: [64, 10, 5.2, 0.2, 0, 0.1], // Kvarg naturell fett 0,2%
  3765: [71, 1.6, 12.9, 0.4, 4.4, 0], // Sötpotatis rå
  3815: [128, 7.5, 15.7, 2.5, 6.2, 0.5], // Kikärtor konserv. u. lag
  3817: [111, 8.1, 13.8, 1, 6.8, 0.6], // Svarta bönor konserv. u. lag
  3818: [290, 8, 47, 6.7, 3.5, 0.8], // Hamburgerbröd
  4583: [202, 16.8, 0, 15.1, 0, 0.1], // Gris färs rå fett 15%
  5974: [306, 8.4, 55.5, 4.8, 1.8, 1.8], // Bröd vitt vetetortilla
  6087: [610, 22.4, 7.4, 53.1, 9.8, 0], // Mandelmjöl
  6113: [109, 3.6, 5.2, 8.3, 0, 0.1], // Yoghurt naturell fett 10%
  6907: [581, 8.4, 34, 43.9, 10.8, 0], // Mörk choklad kakao 70%
  7025: [356, 14.4, 56.8, 6.1, 7, 0], // Mjölmålla quinoa okokt
  7266: [168, 1.2, 0, 18.3, 0.8, 0.1], // Kokosmjölk fett ca 18%
  244: [216, 3.2, 32, 7.6, 3.2, 0], // Pommes frites friterad potatis värmd i ugn fett ca 7% frysvara
  1988: [154, 7.3, 7.3, 10.6, 0.1, 0.9], // Ostsås
  76: [152, 12.7, 2.9, 10, 0, 0.1], // Kvarg färskost fett 10%
  273: [167, 4, 22, 6.3, 2.7, 1], // Potatisbullar stekta
  322: [25, 1.7, 3.7, 0, 1.8, 0.1], // Blomkål
  343: [29, 1.7, 4.4, 0.1, 1.8, 0], // Kålrabbi
  374: [69, 5.2, 8.9, 0.4, 4.4, 0.1], // Gröna ärtor frysvara
  488: [78, 1, 16.6, 0.4, 1.8, 1.5], // Bostongurka
  490: [15, 0.9, 1.4, 0.2, 1.8, 3.5], // Saltgurka u. lag
  526: [41, 0.5, 8.3, 0.2, 1.9, 0], // Jordgubbar
  603: [321, 2.4, 71.9, 0.6, 7.5, 0], // Dadlar torkade
  872: [186, 7.2, 25.7, 5.3, 2.6, 1], // Tortellini m. ostfyllning kokt
  1102: [217, 12.3, 6.5, 15.6, 1.5, 1.6], // Köttbullar frysvara
  1167: [196, 18.9, 0, 13.5, 0, 0.2], // Kyckling lår rå m. skinn
  1168: [186, 19.2, 0, 12.2, 0, 0.2], // Kyckling vinge rå m. skinn
  1244: [151, 19.9, 0, 7.9, 0, 0.1], // Röding rå
  1509: [278, 11, 4.6, 24, 1, 0.8], // Korv isterband fermenterad kött 59%
  1581: [461, 7.1, 63.6, 17.9, 7.9, 0.7], // Chips majs tortilla 
  1795: [265, 0.2, 64.7, 0, 0.8, 0], // Gelé svarta vinbär
  1829: [43, 0, 10.5, 0, 0, 0], // Läsk cola
  1831: [0, 0, 0.1, 0, 0, 0], // Läsk cola light
  1919: [266, 0, 33, 0, 0, 0], // Likör söt vol. % 24
  5916: [32, 1.9, 5.1, 0, 1.6, 1.6], // Tacosås
  6384: [110, 0.6, 25.7, 0.1, 1.6, 0], // Mango chutney
  7022: [146, 10.2, 2, 10.9, 0, 0.2], // Färskost ricotta fett ca 10%
};
