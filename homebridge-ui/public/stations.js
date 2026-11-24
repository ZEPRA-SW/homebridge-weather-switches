'use strict';
// Quelle: Deutscher Wetterdienst (CC BY 4.0), https://opendata.dwd.de/weather/weather_reports/stationlist_synoptic_germany.csv
// Abgleich mit POI-Dateiverzeichnis am 2026-11-02; gefiltert auf Temperatur/Feuchte/Wind-Metadaten.
(function(root){const stations=[
  {
    "id": "10004",
    "name": "UFS TW Ems",
    "latitude": 54.165071,
    "longitude": 6.346049,
    "temperatureHeight": 8,
    "humidityHeight": 8,
    "windHeight": 15
  },
  {
    "id": "10015",
    "name": "Helgoland",
    "latitude": 54.174971,
    "longitude": 7.891995,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10020",
    "name": "List auf Sylt",
    "latitude": 55.010989,
    "longitude": 8.412531,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10022",
    "name": "Leck",
    "latitude": 54.790294,
    "longitude": 8.951446,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10028",
    "name": "Sankt Peter-Ording",
    "latitude": 54.327907,
    "longitude": 8.603056,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10035",
    "name": "Schleswig",
    "latitude": 54.527539,
    "longitude": 9.548666,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10042",
    "name": "Schönhagen (Ostseebad)",
    "latitude": 54.640986,
    "longitude": 10.02377,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10044",
    "name": "Leuchtturm Kiel",
    "latitude": 54.499614,
    "longitude": 10.273687,
    "temperatureHeight": 30,
    "humidityHeight": 30,
    "windHeight": 34
  },
  {
    "id": "10046",
    "name": "Kiel-Holtenau",
    "latitude": 54.377582,
    "longitude": 10.142375,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10055",
    "name": "Fehmarn",
    "latitude": 54.528292,
    "longitude": 11.060556,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 9.1
  },
  {
    "id": "10091",
    "name": "Arkona",
    "latitude": 54.679109,
    "longitude": 13.434416,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 24
  },
  {
    "id": "10093",
    "name": "Putbus",
    "latitude": 54.364277,
    "longitude": 13.477079,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10097",
    "name": "Greifswalder Oie",
    "latitude": 54.24367,
    "longitude": 13.91044,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10113",
    "name": "Norderney",
    "latitude": 53.712304,
    "longitude": 7.151923,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 11.8
  },
  {
    "id": "10129",
    "name": "Bremerhaven",
    "latitude": 53.53321,
    "longitude": 8.576089,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10130",
    "name": "Elpersbüttel",
    "latitude": 54.069146,
    "longitude": 9.010547,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10131",
    "name": "Cuxhaven",
    "latitude": 53.871236,
    "longitude": 8.705766,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10139",
    "name": "Bremervörde",
    "latitude": 53.445118,
    "longitude": 9.13903,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10142",
    "name": "Itzehoe",
    "latitude": 53.989731,
    "longitude": 9.569692,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10146",
    "name": "Quickborn",
    "latitude": 53.733089,
    "longitude": 9.87757,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10147",
    "name": "Hamburg-Fuhlsbüttel",
    "latitude": 53.633172,
    "longitude": 9.988102,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10150",
    "name": "Dörnick",
    "latitude": 54.165444,
    "longitude": 10.351887,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10152",
    "name": "Pelzerhaken",
    "latitude": 54.08933,
    "longitude": 10.877341,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10156",
    "name": "Lübeck-Blankensee",
    "latitude": 53.802512,
    "longitude": 10.698941,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10161",
    "name": "Boltenhagen",
    "latitude": 54.002724,
    "longitude": 11.19082,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 18
  },
  {
    "id": "10162",
    "name": "Schwerin",
    "latitude": 53.642425,
    "longitude": 11.387095,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10168",
    "name": "Goldberg",
    "latitude": 53.605834,
    "longitude": 12.103404,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10170",
    "name": "Rostock-Warnemünde",
    "latitude": 54.180279,
    "longitude": 12.080806,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 22
  },
  {
    "id": "10180",
    "name": "Barth",
    "latitude": 54.340527,
    "longitude": 12.710848,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10184",
    "name": "Greifswald",
    "latitude": 54.096704,
    "longitude": 13.405565,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10193",
    "name": "Ueckermünde",
    "latitude": 53.744455,
    "longitude": 14.069809,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10200",
    "name": "Emden",
    "latitude": 53.388122,
    "longitude": 7.228716,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 9.7
  },
  {
    "id": "10210",
    "name": "Friesoythe-Altenoythe",
    "latitude": 53.064301,
    "longitude": 7.901969,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10224",
    "name": "Bremen",
    "latitude": 53.04507,
    "longitude": 8.798084,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10235",
    "name": "Soltau",
    "latitude": 52.960408,
    "longitude": 9.793049,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10249",
    "name": "Boizenburg",
    "latitude": 53.391093,
    "longitude": 10.68781,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10253",
    "name": "Lüchow",
    "latitude": 52.972379,
    "longitude": 11.137371,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10261",
    "name": "Seehausen",
    "latitude": 52.891079,
    "longitude": 11.729661,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10264",
    "name": "Marnitz",
    "latitude": 53.32209,
    "longitude": 11.932382,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10267",
    "name": "Kyritz",
    "latitude": 52.936248,
    "longitude": 12.409335,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 19
  },
  {
    "id": "10268",
    "name": "Waren (Müritz)",
    "latitude": 53.519622,
    "longitude": 12.665404,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10271",
    "name": "Neuruppin-Alt Ruppin",
    "latitude": 52.943711,
    "longitude": 12.851826,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10281",
    "name": "Trollenhagen",
    "latitude": 53.599793,
    "longitude": 13.303907,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10282",
    "name": "Feldberg/Mecklenburg",
    "latitude": 53.317622,
    "longitude": 13.417485,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10289",
    "name": "Grünow",
    "latitude": 53.315357,
    "longitude": 13.933856,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10291",
    "name": "Angermünde",
    "latitude": 53.031558,
    "longitude": 13.99082,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10303",
    "name": "Lingen-Baccum",
    "latitude": 52.512631,
    "longitude": 7.413109,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10309",
    "name": "Ahaus",
    "latitude": 52.0813,
    "longitude": 6.940893,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10312",
    "name": "Belm",
    "latitude": 52.317043,
    "longitude": 8.16943,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10315",
    "name": "Münster/Osnabrück",
    "latitude": 52.134375,
    "longitude": 7.696859,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10321",
    "name": "Diepholz",
    "latitude": 52.588112,
    "longitude": 8.342405,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10325",
    "name": "Salzuflen, Bad",
    "latitude": 52.104207,
    "longitude": 8.752053,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10338",
    "name": "Hannover",
    "latitude": 52.464428,
    "longitude": 9.677906,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10348",
    "name": "Braunschweig",
    "latitude": 52.291469,
    "longitude": 10.446448,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10359",
    "name": "Gardelegen",
    "latitude": 52.512889,
    "longitude": 11.394174,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10361",
    "name": "Magdeburg",
    "latitude": 52.102896,
    "longitude": 11.582674,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10365",
    "name": "Genthin",
    "latitude": 52.387511,
    "longitude": 12.160174,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10368",
    "name": "Wiesenburg",
    "latitude": 52.120644,
    "longitude": 12.458559,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 18
  },
  {
    "id": "10376",
    "name": "Baruth",
    "latitude": 52.061303,
    "longitude": 13.499731,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 18
  },
  {
    "id": "10379",
    "name": "Potsdam",
    "latitude": 52.381247,
    "longitude": 13.06223,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 37.7
  },
  {
    "id": "10384",
    "name": "Berlin-Tempelhof",
    "latitude": 52.467551,
    "longitude": 13.401981,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10385",
    "name": "Berlin Brandenburg",
    "latitude": 52.380535,
    "longitude": 13.530429,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10393",
    "name": "Lindenberg",
    "latitude": 52.208489,
    "longitude": 14.118032,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10.4
  },
  {
    "id": "10396",
    "name": "Manschnow",
    "latitude": 52.546778,
    "longitude": 14.54525,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10400",
    "name": "Düsseldorf",
    "latitude": 51.295968,
    "longitude": 6.768626,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10410",
    "name": "Essen-Bredeney",
    "latitude": 51.404085,
    "longitude": 6.967741,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10410",
    "name": "Essen-Bredeney",
    "latitude": 51.404085,
    "longitude": 6.967741,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10418",
    "name": "Lüdenscheid",
    "latitude": 51.245158,
    "longitude": 7.642497,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 13
  },
  {
    "id": "10424",
    "name": "Werl",
    "latitude": 51.576347,
    "longitude": 7.887922,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10427",
    "name": "Kahler Asten",
    "latitude": 51.180254,
    "longitude": 8.489068,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10430",
    "name": "Lippspringe, Bad",
    "latitude": 51.785416,
    "longitude": 8.838795,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10433",
    "name": "Lügde-Paenbruch",
    "latitude": 51.866393,
    "longitude": 9.271007,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10433",
    "name": "Lügde-Paenbruch",
    "latitude": 51.866393,
    "longitude": 9.271007,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10435",
    "name": "Warburg",
    "latitude": 51.50392,
    "longitude": 9.111774,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10441",
    "name": "Schauenburg-Elgershausen",
    "latitude": 51.283452,
    "longitude": 9.358959,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10442",
    "name": "Alfeld",
    "latitude": 51.964331,
    "longitude": 9.80717,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10444",
    "name": "Göttingen",
    "latitude": 51.500248,
    "longitude": 9.950659,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10449",
    "name": "Leinefelde",
    "latitude": 51.393197,
    "longitude": 10.312349,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10452",
    "name": "Braunlage",
    "latitude": 51.723383,
    "longitude": 10.602109,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10453",
    "name": "Brocken",
    "latitude": 51.798615,
    "longitude": 10.61828,
    "temperatureHeight": 22.8,
    "humidityHeight": 22.8,
    "windHeight": 27
  },
  {
    "id": "10454",
    "name": "Wernigerode",
    "latitude": 51.84544,
    "longitude": 10.768627,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10458",
    "name": "Harzgerode",
    "latitude": 51.651967,
    "longitude": 11.136645,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10460",
    "name": "Artern",
    "latitude": 51.374433,
    "longitude": 11.29196,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10469",
    "name": "Leipzig/Halle",
    "latitude": 51.434711,
    "longitude": 12.239585,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10469",
    "name": "Leipzig/Halle",
    "latitude": 51.434711,
    "longitude": 12.239585,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10471",
    "name": "Leipzig-Holzhausen",
    "latitude": 51.31509,
    "longitude": 12.446226,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10474",
    "name": "Wittenberg",
    "latitude": 51.889124,
    "longitude": 12.644598,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10480",
    "name": "Oschatz",
    "latitude": 51.29597,
    "longitude": 13.092827,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10488",
    "name": "Dresden-Klotzsche",
    "latitude": 51.127797,
    "longitude": 13.754251,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10488",
    "name": "Dresden-Klotzsche",
    "latitude": 51.127797,
    "longitude": 13.754251,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10490",
    "name": "Doberlug-Kirchhain",
    "latitude": 51.645071,
    "longitude": 13.574714,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10495",
    "name": "Hoyerswerda",
    "latitude": 51.449238,
    "longitude": 14.25327,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10496",
    "name": "Cottbus",
    "latitude": 51.775938,
    "longitude": 14.316799,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 16
  },
  {
    "id": "10499",
    "name": "Görlitz",
    "latitude": 51.162129,
    "longitude": 14.950606,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10505",
    "name": "Aachen-Orsbach",
    "latitude": 50.798281,
    "longitude": 6.02439,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10506",
    "name": "Nürburg-Barweiler",
    "latitude": 50.360174,
    "longitude": 6.869659,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10513",
    "name": "Köln/Bonn",
    "latitude": 50.864547,
    "longitude": 7.157524,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10519",
    "name": "Königswinter-Heiderhof",
    "latitude": 50.729285,
    "longitude": 7.204024,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10520",
    "name": "Andernach",
    "latitude": 50.423665,
    "longitude": 7.420171,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10526",
    "name": "Marienberg, Bad",
    "latitude": 50.662061,
    "longitude": 7.960264,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10532",
    "name": "Gießen/Wettenberg",
    "latitude": 50.601715,
    "longitude": 8.643898,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10534",
    "name": "Hoherodskopf/Vogelsberg",
    "latitude": 50.508396,
    "longitude": 9.224634,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10537",
    "name": "Neu-Ulrichstein",
    "latitude": 50.751337,
    "longitude": 9.022428,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10540",
    "name": "Eisenach",
    "latitude": 51.000736,
    "longitude": 10.36211,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10542",
    "name": "Hersfeld, Bad",
    "latitude": 50.851957,
    "longitude": 9.737694,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10544",
    "name": "Wasserkuppe",
    "latitude": 50.497265,
    "longitude": 9.942732,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10548",
    "name": "Meiningen",
    "latitude": 50.561131,
    "longitude": 10.377137,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10552",
    "name": "Schmücke",
    "latitude": 50.654518,
    "longitude": 10.769601,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 24
  },
  {
    "id": "10554",
    "name": "Erfurt-Weimar",
    "latitude": 50.982681,
    "longitude": 10.961292,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10557",
    "name": "Neuhaus am Rennweg",
    "latitude": 50.500253,
    "longitude": 11.13446,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10564",
    "name": "Schleiz",
    "latitude": 50.567882,
    "longitude": 11.80412,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10565",
    "name": "Osterfeld",
    "latitude": 51.08716,
    "longitude": 11.929265,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10567",
    "name": "Gera-Leumnitz",
    "latitude": 50.881208,
    "longitude": 12.128885,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10569",
    "name": "Plauen",
    "latitude": 50.481832,
    "longitude": 12.130043,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10574",
    "name": "Carlsfeld",
    "latitude": 50.431251,
    "longitude": 12.611421,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10577",
    "name": "Chemnitz",
    "latitude": 50.791284,
    "longitude": 12.871975,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10577",
    "name": "Chemnitz",
    "latitude": 50.791284,
    "longitude": 12.871975,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10578",
    "name": "Fichtelberg",
    "latitude": 50.428511,
    "longitude": 12.953423,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 29
  },
  {
    "id": "10579",
    "name": "Marienberg",
    "latitude": 50.651055,
    "longitude": 13.146876,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10582",
    "name": "Zinnwald-Georgenfeld",
    "latitude": 50.731347,
    "longitude": 13.751612,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 18
  },
  {
    "id": "10591",
    "name": "Lichtenhain-Mittelndorf",
    "latitude": 50.938325,
    "longitude": 14.20938,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10609",
    "name": "Trier-Petrisberg",
    "latitude": 49.747891,
    "longitude": 6.658305,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 18.8
  },
  {
    "id": "10609",
    "name": "Trier-Petrisberg",
    "latitude": 49.747891,
    "longitude": 6.658305,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 18.8
  },
  {
    "id": "10613",
    "name": "Büchel-Alflen",
    "latitude": 50.174545,
    "longitude": 7.05952,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10613",
    "name": "Büchel-Alflen",
    "latitude": 50.174545,
    "longitude": 7.05952,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10615",
    "name": "Deuselbach",
    "latitude": 49.761881,
    "longitude": 7.054245,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10616",
    "name": "Hahn",
    "latitude": 49.946281,
    "longitude": 7.264495,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10628",
    "name": "Geisenheim",
    "latitude": 49.985894,
    "longitude": 7.95482,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10635",
    "name": "Kleiner Feldberg/Taunus",
    "latitude": 50.221797,
    "longitude": 8.446883,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10637",
    "name": "Frankfurt/Main",
    "latitude": 50.025911,
    "longitude": 8.521294,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10641",
    "name": "Offenbach-Wetterpark",
    "latitude": 50.08995,
    "longitude": 8.786165,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10646",
    "name": "Neuhütten/Spessart",
    "latitude": 50.008293,
    "longitude": 9.423765,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10648",
    "name": "Michelstadt-Vielbrunn",
    "latitude": 49.717686,
    "longitude": 9.099716,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10655",
    "name": "Würzburg",
    "latitude": 49.770378,
    "longitude": 9.957627,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10655",
    "name": "Würzburg",
    "latitude": 49.770378,
    "longitude": 9.957627,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10658",
    "name": "Kissingen, Bad",
    "latitude": 50.223991,
    "longitude": 10.079245,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10671",
    "name": "Lautertal-Oberlauter",
    "latitude": 50.306639,
    "longitude": 10.967938,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10675",
    "name": "Bamberg",
    "latitude": 49.874252,
    "longitude": 10.920558,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10685",
    "name": "Hof",
    "latitude": 50.312257,
    "longitude": 11.876039,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10686",
    "name": "Wunsiedel-Schönbrunn",
    "latitude": 50.031507,
    "longitude": 11.974501,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10688",
    "name": "Weiden",
    "latitude": 49.666221,
    "longitude": 12.184448,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10704",
    "name": "Berus",
    "latitude": 49.264058,
    "longitude": 6.686776,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10706",
    "name": "Tholey",
    "latitude": 49.473721,
    "longitude": 7.038522,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10708",
    "name": "Saarbrücken-Ensheim",
    "latitude": 49.212782,
    "longitude": 7.107653,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10724",
    "name": "Weinbiet",
    "latitude": 49.375801,
    "longitude": 8.121233,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 29
  },
  {
    "id": "10729",
    "name": "Mannheim",
    "latitude": 49.506251,
    "longitude": 8.558439,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10729",
    "name": "Mannheim",
    "latitude": 49.506251,
    "longitude": 8.558439,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10731",
    "name": "Rheinstetten",
    "latitude": 48.972627,
    "longitude": 8.330081,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10733",
    "name": "Waibstadt",
    "latitude": 49.294262,
    "longitude": 8.905286,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10736",
    "name": "Mühlacker",
    "latitude": 48.972073,
    "longitude": 8.873462,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10738",
    "name": "Stuttgart-Echterdingen",
    "latitude": 48.688265,
    "longitude": 9.223548,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10739",
    "name": "Stuttgart (Schnarrenberg)",
    "latitude": 48.828085,
    "longitude": 9.200028,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10739",
    "name": "Stuttgart (Schnarrenberg)",
    "latitude": 48.828085,
    "longitude": 9.200028,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10742",
    "name": "Öhringen",
    "latitude": 49.207016,
    "longitude": 9.517582,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10743",
    "name": "Niederstetten",
    "latitude": 49.389529,
    "longitude": 9.966633,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10747",
    "name": "Kaisersbach-Cronhütte",
    "latitude": 48.917038,
    "longitude": 9.687101,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10756",
    "name": "Feuchtwangen-Heilbronn",
    "latitude": 49.162297,
    "longitude": 10.366126,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10761",
    "name": "Weißenburg-Emetzheim",
    "latitude": 49.01153,
    "longitude": 10.930837,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10763",
    "name": "Nürnberg",
    "latitude": 49.503031,
    "longitude": 11.054923,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10765",
    "name": "Roth",
    "latitude": 49.216232,
    "longitude": 11.103514,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10776",
    "name": "Regensburg",
    "latitude": 49.042482,
    "longitude": 12.101943,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10777",
    "name": "Gelbelsee",
    "latitude": 48.948116,
    "longitude": 11.428929,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10782",
    "name": "Waldmünchen",
    "latitude": 49.390952,
    "longitude": 12.683802,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10782",
    "name": "Waldmünchen",
    "latitude": 49.390952,
    "longitude": 12.683802,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10788",
    "name": "Straubing",
    "latitude": 48.827504,
    "longitude": 12.559695,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10791",
    "name": "Großer Arber",
    "latitude": 49.112887,
    "longitude": 13.133791,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10796",
    "name": "Zwiesel",
    "latitude": 49.028013,
    "longitude": 13.238509,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10803",
    "name": "Freiburg",
    "latitude": 48.023242,
    "longitude": 7.834292,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10805",
    "name": "Lahr",
    "latitude": 48.364742,
    "longitude": 7.827986,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10815",
    "name": "Freudenstadt",
    "latitude": 48.453828,
    "longitude": 8.408952,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 34.19
  },
  {
    "id": "10818",
    "name": "Klippeneck",
    "latitude": 48.105397,
    "longitude": 8.754788,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10827",
    "name": "Meßstetten-Appental",
    "latitude": 48.169353,
    "longitude": 8.943265,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10836",
    "name": "Stötten",
    "latitude": 48.665587,
    "longitude": 9.864791,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10840",
    "name": "Ulm-Mähringen",
    "latitude": 48.441768,
    "longitude": 9.921613,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10840",
    "name": "Ulm-Mähringen",
    "latitude": 48.441768,
    "longitude": 9.921613,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10850",
    "name": "Harburg",
    "latitude": 48.791834,
    "longitude": 10.706234,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10852",
    "name": "Augsburg",
    "latitude": 48.425292,
    "longitude": 10.941681,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 9
  },
  {
    "id": "10853",
    "name": "Neuburg an der Donau",
    "latitude": 48.708492,
    "longitude": 11.214669,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10856",
    "name": "Lechfeld",
    "latitude": 48.184868,
    "longitude": 10.850695,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10860",
    "name": "Ingolstadt-Manching",
    "latitude": 48.711147,
    "longitude": 11.536252,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10863",
    "name": "Weihenstephan-Dürnast",
    "latitude": 48.402404,
    "longitude": 11.694552,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10863",
    "name": "Weihenstephan-Dürnast",
    "latitude": 48.402404,
    "longitude": 11.694552,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10865",
    "name": "München-Stadt",
    "latitude": 48.163202,
    "longitude": 11.542893,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 29.28
  },
  {
    "id": "10870",
    "name": "München-Flughafen",
    "latitude": 48.347741,
    "longitude": 11.813385,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10872",
    "name": "Gottfrieding",
    "latitude": 48.659461,
    "longitude": 12.538816,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10875",
    "name": "Mühldorf",
    "latitude": 48.278982,
    "longitude": 12.502407,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10895",
    "name": "Fürstenzell",
    "latitude": 48.545114,
    "longitude": 13.353159,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10895",
    "name": "Fürstenzell",
    "latitude": 48.545114,
    "longitude": 13.353159,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 12
  },
  {
    "id": "10908",
    "name": "Feldberg/Schwarzwald",
    "latitude": 47.874842,
    "longitude": 8.003793,
    "temperatureHeight": 14.4,
    "humidityHeight": 14.4,
    "windHeight": 18.4
  },
  {
    "id": "10929",
    "name": "Konstanz",
    "latitude": 47.695236,
    "longitude": 9.130708,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10945",
    "name": "Leutkirch-Herlazhofen",
    "latitude": 47.795529,
    "longitude": 10.032457,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10946",
    "name": "Kempten",
    "latitude": 47.723263,
    "longitude": 10.334786,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10948",
    "name": "Oberstdorf",
    "latitude": 47.398429,
    "longitude": 10.275881,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  },
  {
    "id": "10961",
    "name": "Zugspitze",
    "latitude": 47.421037,
    "longitude": 10.984761,
    "temperatureHeight": 10.13,
    "humidityHeight": 10.13,
    "windHeight": 15.45
  },
  {
    "id": "10961",
    "name": "Zugspitze",
    "latitude": 47.421037,
    "longitude": 10.984761,
    "temperatureHeight": 10.13,
    "humidityHeight": 10.13,
    "windHeight": 15.45
  },
  {
    "id": "10962",
    "name": "Hohenpeißenberg",
    "latitude": 47.800869,
    "longitude": 11.010819,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10962",
    "name": "Hohenpeißenberg",
    "latitude": 47.800869,
    "longitude": 11.010819,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10963",
    "name": "Garmisch-Partenkirchen",
    "latitude": 47.482989,
    "longitude": 11.062126,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 15
  },
  {
    "id": "10982",
    "name": "Chieming",
    "latitude": 47.884257,
    "longitude": 12.540368,
    "temperatureHeight": 2,
    "humidityHeight": 2,
    "windHeight": 10
  }
]; if(typeof module==='object'&&module.exports)module.exports=stations;else root.DwdStations=stations;})(globalThis);
