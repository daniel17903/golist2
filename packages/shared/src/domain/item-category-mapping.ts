export const supportedCategoryLanguages = ["en", "de", "es"] as const;

export type CategoryLanguage = (typeof supportedCategoryLanguages)[number];

export const defaultCategoryLanguage: CategoryLanguage = "en";

export const categoryOrderById: Record<string, number> = {
  fruitsVegetables: 1,
  bread: 2,
  milkCheese: 3,
  meatFish: 4,
  cereals: 5,
  spicesCanned: 6,
  sweetsSnacks: 7,
  beverages: 8,
  household: 9,
  convenienceProductFrozen: 10,
  other: 11,
};

type CategoryEntry = {
  assetFileName: string;
  matchingNames: string[];
  category: string;
};

const categoryEntriesDe: CategoryEntry[] = [
  {
    "assetFileName": "apple",
    "matchingNames": [
      "apfel",
      "äpfel",
      "aepfel",
      "obst",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "banana",
    "matchingNames": [
      "banane",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "bottle",
    "matchingNames": [
      "flasche",
      "getränke",
      "wasser",
      "sprudel",
      "bier",
      "wein",
      "cola",
      "fanta",
      "limo",
      "limonade",
      "sprite",
      "apfelschorle",
      "pils",
      "hefeweizen",
      "red bull",
      "trinken",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "bottle",
    "matchingNames": [
      "öl",
      "oel",
      "essig",
      "sojasoße",
      "sojasosse",
      "soja sosse",
      "soja soße",
      "mayonnaise",
      "mayo",
      "ketchup",
      "remoulade",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "box",
    "matchingNames": [
      "box",
      "spülmaschinen tabs",
      "spülmaschinen-tabs",
      "spülmaschinen salz",
      "spülmaschinen-salz",
      "müsli",
      "muesli",
      "granola",
      "tempos",
      "taschentücher",
      "kaugummi",
      "geschirrspültaps",
      "speisestärke",
      "kakao",
      "kakaopulver",
      "zwieback",
      "caotina",
    ],
    "category": "household",
  },
  {
    "assetFileName": "flour",
    "matchingNames": [
      "mehl",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "bread",
    "matchingNames": [
      "brot",
      "brötchen",
      "laugenstange",
      "brezel",
      "semmel",
      "baguette",
      "ekmek",
    ],
    "category": "bread",
  },
  {
    "assetFileName": "can",
    "matchingNames": [
      "bohnen",
      "dose",
      "kichererbsen",
      "dosentomaten",
      "tomatendose",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "carrot",
    "matchingNames": [
      "karotte",
      "pastinake",
      "rübe",
      "ruebe",
      "rettich",
      "möhre",
      "gemüse",
      "gemuese",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "corn",
    "matchingNames": [
      "samen",
      "körner",
      "linsen",
      "erbsen",
      "hirse",
      "haferflocken",
      "quinoa",
      "bulgur",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "cup",
    "matchingNames": [
      "becher",
      "yoghurt",
      "joghurt",
      "quark",
      "saure sahne",
      "schlagsahne",
      "sahne",
      "pudding",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "glas",
    "matchingNames": [
      "glas",
      "marmelade",
      "gläser",
      "honig",
      "aufstrich",
      "sauerkraut",
      "schattenmorellen",
      "nutella",
      "hummus",
      "guacamole",
      "senf",
      "pesto",
      "tahini",
      "oliven",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "leek",
    "matchingNames": [
      "lauch",
      "porree",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "peanut",
    "matchingNames": [
      "nuss",
      "nüsse",
      "cashews",
      "cashewkerne",
      "pistazien",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "almonds",
    "matchingNames": [
      "mandel",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "round_fruit",
    "matchingNames": [
      "tomate",
      "orange",
      "mandarine",
      "mango",
      "nektarine",
      "pfirsich",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "dead_cow",
    "matchingNames": [
      "fleisch",
      "hackfleisch",
      "steak",
      "rinder",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "dead_pig",
    "matchingNames": [
      "wurst",
      "schinken",
      "speck",
      "bacon",
      "würstchen",
      "würste",
      "fleischkäs",
      "leberkäs",
      "salami",
      "lyoner",
      "wiener",
      "aufschnitt",
      "schweine",
      "mett",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "dead_chicken",
    "matchingNames": [
      "hühnchen",
      "pute",
      "chicken",
      "hühner",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "fish",
    "matchingNames": [
      "fisch",
      "lachs",
      "forelle",
      "barsch",
      "hecht",
      "dorade",
      "hering",
      "kabeljau",
      "dorsch",
      "karpfen",
      "fischstäbchen",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "cookie",
    "matchingNames": [
      "keks",
      "kekse",
      "süssigkeiten",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "pepper",
    "matchingNames": [
      "paprika",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "onion",
    "matchingNames": [
      "zwiebel",
      "schalotte",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "pear",
    "matchingNames": [
      "birne",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cabbage",
    "matchingNames": [
      "kohl",
      "wirsing",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "broccoli",
    "matchingNames": [
      "brokkoli",
      "broccoli",
      "brokoli",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "eggplant",
    "matchingNames": [
      "aubergine",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "salad",
    "matchingNames": [
      "salat",
      "rucola",
      "spinat",
      "mangold",
      "pak choi",
      "pak choy",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chocolate",
    "matchingNames": [
      "schokolade",
      "schokostreusel",
      "schokoraspel",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "ice",
    "matchingNames": [
      "eis",
      "magnum",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "berries",
    "matchingNames": [
      "beeren",
      "himbeeren",
      "johannisbeeren",
      "heidelbeeren",
      "blaubeeren",
      "trauben",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "strawberry",
    "matchingNames": [
      "erdbeere",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "block",
    "matchingNames": [
      "tofu",
      "butter",
      "margarine",
      "rama",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "burger",
    "matchingNames": [
      "burger",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "herbs",
    "matchingNames": [
      "kräuter",
      "petersilie",
      "basilikum",
      "koriander",
      "dill",
      "minze",
      "rosmarin",
      "thymian",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "pizza_cake",
    "matchingNames": [
      "pizza",
      "kuchen",
      "torte",
      "flammkuchen",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "yeast",
    "matchingNames": [
      "hefe",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "package",
    "matchingNames": [
      "backpulver",
      "natron",
      "vanillezucker",
      "trockenhefe",
      "agar-agar",
      "agar agar",
      "puddingpulver",
      "gelierzucker",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "pasta",
    "matchingNames": [
      "nudeln",
      "spaghetti",
      "pasta",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "lemon",
    "matchingNames": [
      "zitrone",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "potatos",
    "matchingNames": [
      "kartoffel",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "garlic",
    "matchingNames": [
      "knoblauch",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "spice",
    "matchingNames": [
      "salz",
      "pfeffer",
      "gewürz",
      "gewuerz",
      "curry",
      "kurkuma",
      "zimt",
      "kümmel",
      "kuemmel",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "rice",
    "matchingNames": [
      "reis",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "paper_towel",
    "matchingNames": [
      "küchenrolle",
      "kuechenrolle",
      "zewa",
    ],
    "category": "household",
  },
  {
    "assetFileName": "toilet_paper",
    "matchingNames": [
      "klopapier",
      "klo papier",
      "toilettenpapier",
      "toiletten papier",
    ],
    "category": "household",
  },
  {
    "assetFileName": "baking_paper",
    "matchingNames": [
      "backpapier",
      "back papier",
      "frischhaltefolie",
    ],
    "category": "household",
  },
  {
    "assetFileName": "mushroom",
    "matchingNames": [
      "pilz",
      "champignon",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "papaya",
    "matchingNames": [
      "papaya",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "rhubarb",
    "matchingNames": [
      "rhabarber",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "tetrapack",
    "matchingNames": [
      "milch",
      "saft",
      "haferdrink",
      "hafer drink",
      "soja drink",
      "sojadrink",
      "mandeldrink",
      "mandel drink",
      "reisdrink",
      "reis drink",
      "eistee",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "egg",
    "matchingNames": [
      "eier",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "coffee_beans",
    "matchingNames": [
      "kaffee",
      "espresso",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "tea",
    "matchingNames": [
      "tee",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "sugar",
    "matchingNames": [
      "zucker",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "cheese",
    "matchingNames": [
      "käse",
      "kaese",
      "mozarella",
      "parmesan",
      "gauda",
      "edamer",
      "feta",
      "emmentaler",
      "cheddar",
      "brie",
      "camembert",
      "appenzeller",
      "halloumi",
      "manchego",
      "tilsiter",
      "ricotta",
      "caprice dieux",
      "mozzarella",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "asparagus",
    "matchingNames": [
      "spargel",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "gnocchi",
    "matchingNames": [
      "gnocchi",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "pumpkin",
    "matchingNames": [
      "kürbis",
      "kuerbis",
      "hokkaido",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "beetroot",
    "matchingNames": [
      "rote bete",
      "gelbe bete",
      "rote rübe",
      "gelbe rübe",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "radish",
    "matchingNames": [
      "radieschen",
      "radieserl",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cucumber",
    "matchingNames": [
      "gurke",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "dates",
    "matchingNames": [
      "dattel",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "lemon",
    "matchingNames": [
      "limette",
      "limetten",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "tüte",
      "tuete",
    ],
    "category": "household",
  },
  {
    "assetFileName": "raisins",
    "matchingNames": [
      "rosine",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "round_fruit_small",
    "matchingNames": [
      "pflaume",
      "aprikose",
      "zwetschge",
      "mirabelle",
      "marille",
      "kiwi",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "seeds",
    "matchingNames": [
      "kerne",
      "flocken",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "sponge",
    "matchingNames": [
      "schwamm",
      "schwämme",
      "schwaemme",
    ],
    "category": "household",
  },
  {
    "assetFileName": "zucchini",
    "matchingNames": [
      "zucchini",
      "zuchini",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "avocado",
    "matchingNames": [
      "avocado",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "melon",
    "matchingNames": [
      "melone",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "tampon",
    "matchingNames": [
      "tampon",
    ],
    "category": "other",
  },
  {
    "assetFileName": "pineapple",
    "matchingNames": [
      "ananas",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "sweets",
    "matchingNames": [
      "chips",
      "gummibärchen",
      "süssigkeiten",
      "süßigkeiten",
      "lakritze",
      "cantuccini",
      "cracker",
      "snacks",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cream",
    "matchingNames": [
      "haargel",
      "creme",
    ],
    "category": "household",
  },
  {
    "assetFileName": "shower_gel",
    "matchingNames": [
      "duschgel",
      "shampoo",
    ],
    "category": "household",
  },
  {
    "assetFileName": "dish_soap",
    "matchingNames": [
      "badreiniger",
      "spüli",
      "spülmittel",
      "putzmittel",
      "neutralreiniger",
    ],
    "category": "household",
  },
  {
    "assetFileName": "cherries",
    "matchingNames": [
      "kirsche",
      "kirschen",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chili",
    "matchingNames": [
      "chili",
      "chilischote",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "hot_drink",
    "matchingNames": [
      "heißgetränk",
      "heissgetraenk",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "mango",
    "matchingNames": [
      "mango",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "pretzel",
    "matchingNames": [
      "brezel",
      "laugenbrezel",
    ],
    "category": "bread",
  },
  {
    "assetFileName": "stalk_celery",
    "matchingNames": [
      "staudensellerie",
      "selleriestange",
    ],
    "category": "fruitsVegetables",
  },
];

const categoryEntriesEn: CategoryEntry[] = [
  {
    "assetFileName": "apple",
    "matchingNames": [
      "fruit",
      "apples",
      "apple",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "banana",
    "matchingNames": [
      "banana",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "bottle",
    "matchingNames": [
      "beer",
      "wine",
      "sprite",
      "limo",
      "fantastic",
      "cola",
      "water",
      "lemonade",
      "pils",
      "hefeweizen",
      "bubble",
      "soda",
      "redbull",
      "drink",
      "sparkling water",
      "apple spritzer",
      "beverages",
      "bottle",
      "sprites",
      "red bull",
      "fanta",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "bottle",
    "matchingNames": [
      "mayonnaise",
      "oil",
      "mayo",
      "vinegar",
      "ketchup",
      "soy sauce",
      "remoulade",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "box",
    "matchingNames": [
      "dishwasher salt",
      "handkerchiefs",
      "dishwashing soaps",
      "zwieback",
      "caotina",
      "food starch",
      "dishwasher tabs",
      "cocoa powder",
      "cereal",
      "starch",
      "tempos",
      "chewing gum",
      "cocoa",
      "müsli",
      "dishwasher taps",
      "muesli",
      "granola",
      "box",
    ],
    "category": "household",
  },
  {
    "assetFileName": "flour",
    "matchingNames": [
      "flour",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "bread",
    "matchingNames": [
      "lye rod",
      "lye bar",
      "semmel",
      "pretzel",
      "loaf",
      "ekmek",
      "bread",
      "roll",
      "bun",
      "baguette",
    ],
    "category": "bread",
  },
  {
    "assetFileName": "can",
    "matchingNames": [
      "tomato can",
      "can",
      "beans",
      "canned tomatoes",
      "chickpeas",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "carrot",
    "matchingNames": [
      "carrot",
      "radish",
      "rettich",
      "beet",
      "turnip",
      "vegetables",
      "ruebe",
      "parsnip",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "corn",
    "matchingNames": [
      "lenses",
      "millet",
      "quinoa",
      "seed",
      "seeds",
      "peas",
      "bulgur",
      "oatmeal",
      "grains",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "cup",
    "matchingNames": [
      "yogurt",
      "pudding",
      "whipped cream",
      "mug",
      "quark",
      "sour cream",
      "cream",
      "yoghurt",
      "cups",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "glas",
    "matchingNames": [
      "nutella",
      "pesto",
      "hummus",
      "olives",
      "spread",
      "glass",
      "morello cherries",
      "tahini",
      "sauerkraut",
      "mustard",
      "jam",
      "guacamole",
      "honey",
      "glasses",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "leek",
    "matchingNames": [
      "leek",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "peanut",
    "matchingNames": [
      "pistachios",
      "nut",
      "cashews",
      "nuts",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "almonds",
    "matchingNames": [
      "almond",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "round_fruit",
    "matchingNames": [
      "tangerine",
      "nectarine",
      "peach",
      "tomato",
      "orange",
      "mango",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "dead_cow",
    "matchingNames": [
      "flesh",
      "minced meat",
      "steak",
      "cattle",
      "meat",
      "bovine",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "dead_pig",
    "matchingNames": [
      "bacon",
      "salami",
      "cold cuts",
      "hot dog",
      "meat cheese",
      "vienna",
      "pigs",
      "ham",
      "viennese",
      "lyon",
      "met",
      "liver cheese",
      "meatloaf",
      "sausage",
      "sausages",
      "mead",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "dead_chicken",
    "matchingNames": [
      "chicken",
      "turkey",
      "chickens",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "fish",
    "matchingNames": [
      "cod",
      "perch",
      "fish sticks",
      "salmon",
      "herring",
      "carp",
      "sea ​​bream",
      "dorade",
      "trout",
      "fish",
      "pike",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "cookie",
    "matchingNames": [
      "cookie",
      "biscuit",
      "sweets",
      "cookies",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "pepper",
    "matchingNames": [
      "paprika",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "onion",
    "matchingNames": [
      "onion",
      "shell",
      "shallot",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "pear",
    "matchingNames": [
      "pear",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cabbage",
    "matchingNames": [
      "savoy",
      "kohl",
      "cabbage",
      "savoy cabbage",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "broccoli",
    "matchingNames": [
      "broccoli",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "eggplant",
    "matchingNames": [
      "aubergine",
      "eggplant",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "salad",
    "matchingNames": [
      "salad",
      "pak choy",
      "spinach",
      "pak choi",
      "mangold",
      "chard",
      "arugula",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chocolate",
    "matchingNames": [
      "chocolate shavings",
      "chocolate sprinkles",
      "chocolate rasps",
      "chocolate",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "ice",
    "matchingNames": [
      "magnum",
      "ice",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "berries",
    "matchingNames": [
      "berries",
      "grapes",
      "currants",
      "raspberries",
      "blueberries",
      "berry",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "strawberry",
    "matchingNames": [
      "strawberry",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "block",
    "matchingNames": [
      "margarine",
      "tofu",
      "ram",
      "butter",
      "rama",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "burger",
    "matchingNames": [
      "citizens",
      "burger",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "herbs",
    "matchingNames": [
      "parsley",
      "coriander",
      "herbs",
      "mint",
      "basil",
      "dill",
      "rosemary",
      "thyme",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "pizza_cake",
    "matchingNames": [
      "pizza",
      "tarte",
      "cake",
      "tarte flambée",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "yeast",
    "matchingNames": [
      "yeast",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "package",
    "matchingNames": [
      "natron",
      "agar agar",
      "dry yeast",
      "jelling sugar",
      "agar-agar",
      "soda",
      "baking powder",
      "pudding powder",
      "jam sugar",
      "vanilla sugar",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "pasta",
    "matchingNames": [
      "noodles",
      "pasta",
      "spaghetti",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "lemon",
    "matchingNames": [
      "lemon",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "potatos",
    "matchingNames": [
      "potato",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "garlic",
    "matchingNames": [
      "garlic",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "spice",
    "matchingNames": [
      "salt",
      "caraway",
      "seasoning",
      "cinnamon",
      "cinammon",
      "kuemmel",
      "caraway seed",
      "pepper",
      "spice",
      "curry",
      "turmeric",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "rice",
    "matchingNames": [
      "rice",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "paper_towel",
    "matchingNames": [
      "kitchen roll",
      "zewa",
    ],
    "category": "household",
  },
  {
    "assetFileName": "toilet_paper",
    "matchingNames": [
      "toilet paper",
      "loo paper",
    ],
    "category": "household",
  },
  {
    "assetFileName": "baking_paper",
    "matchingNames": [
      "baking paper",
      "cling film",
      "parchment paper",
      "back paper",
    ],
    "category": "household",
  },
  {
    "assetFileName": "mushroom",
    "matchingNames": [
      "mushroom",
      "fungus",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "papaya",
    "matchingNames": [
      "papaya",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "rhubarb",
    "matchingNames": [
      "rhubarb",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "tetrapack",
    "matchingNames": [
      "iced tea",
      "juice",
      "oat drink",
      "almond drink",
      "soy drink",
      "icetea",
      "rice drink",
      "milk",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "egg",
    "matchingNames": [
      "eggs",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "coffee_beans",
    "matchingNames": [
      "coffee",
      "espresso",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "tea",
    "matchingNames": [
      "tea",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "sugar",
    "matchingNames": [
      "sugar",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "cheese",
    "matchingNames": [
      "edamer",
      "goood",
      "gauda",
      "parmesan",
      "mangego",
      "helloumi",
      "appenzell",
      "camembert",
      "appenzeller",
      "emmental",
      "manchego",
      "caprice dieux",
      "tilliter",
      "brie",
      "cheddar",
      "mozzarella",
      "feta",
      "halloumi",
      "edam",
      "cheese",
      "ricotta",
      "mozarella",
      "tilsit",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "asparagus",
    "matchingNames": [
      "asparagus",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "gnocchi",
    "matchingNames": [
      "gnocchi",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "pumpkin",
    "matchingNames": [
      "pumpkin",
      "hokkaido",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "beetroot",
    "matchingNames": [
      "yellow turnip",
      "yellow beets",
      "beet",
      "red beet",
      "beetroot",
      "yellow beet",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "radish",
    "matchingNames": [
      "radishes",
      "radish",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cucumber",
    "matchingNames": [
      "cucumber",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "dates",
    "matchingNames": [
      "date",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "lemon",
    "matchingNames": [
      "lime",
      "limes",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "bag",
      "tuete",
    ],
    "category": "household",
  },
  {
    "assetFileName": "raisins",
    "matchingNames": [
      "raisin",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "round_fruit_small",
    "matchingNames": [
      "kiwi",
      "apricot",
      "mirabelle",
      "plum",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "seeds",
    "matchingNames": [
      "flakes",
      "cores",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "sponge",
    "matchingNames": [
      "schwaemme",
      "sponge",
      "sponges",
    ],
    "category": "household",
  },
  {
    "assetFileName": "zucchini",
    "matchingNames": [
      "zuchini",
      "zucchini",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "avocado",
    "matchingNames": [
      "avocado",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "melon",
    "matchingNames": [
      "melon",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "tampon",
    "matchingNames": [
      "tampon",
    ],
    "category": "other",
  },
  {
    "assetFileName": "pineapple",
    "matchingNames": [
      "pineapple",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "sweets",
    "matchingNames": [
      "chips",
      "crisps",
      "liquorice",
      "gummy bear",
      "cracker",
      "gummy bears",
      "cantuccini",
      "snacks",
      "sweets",
      "licorice",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cream",
    "matchingNames": [
      "hair gel",
    ],
    "category": "household",
  },
  {
    "assetFileName": "shower_gel",
    "matchingNames": [
      "shampoo",
      "shower gel",
    ],
    "category": "household",
  },
  {
    "assetFileName": "dish_soap",
    "matchingNames": [
      "dishwashing liquid",
      "cleaning supplies",
      "cleaning agent",
      "detergent",
      "bathroom cleaner",
      "neutral cleaner",
      "dishwashing",
      "dishwashing detergent",
    ],
    "category": "household",
  },
  {
    "assetFileName": "cherries",
    "matchingNames": [
      "cherry",
      "cherries",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chili",
    "matchingNames": [
      "chili",
      "chili pepper",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "hot_drink",
    "matchingNames": [
      "hot drink",
      "warm drink",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "mango",
    "matchingNames": [
      "mango",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "pretzel",
    "matchingNames": [
      "pretzel",
    ],
    "category": "bread",
  },
  {
    "assetFileName": "stalk_celery",
    "matchingNames": [
      "celery",
      "celery stalk",
    ],
    "category": "fruitsVegetables",
  },
];

const categoryEntriesEs: CategoryEntry[] = [
  {
    "assetFileName": "apple",
    "matchingNames": [
      "fruta",
      "manzana",
      "manzanas",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "banana",
    "matchingNames": [
      "plátano",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "bottle",
    "matchingNames": [
      "agua",
      "agua con gas",
      "beber",
      "bebidas",
      "botella",
      "burbuja",
      "cerveza",
      "cola",
      "fanta",
      "fantástico",
      "hefeweizen",
      "limonada",
      "limusina",
      "pils",
      "reajuste salarial",
      "refresco de manzana",
      "soda",
      "sprite",
      "sprites",
      "spritzer de manzana",
      "toro rojo",
      "vino",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "bottle",
    "matchingNames": [
      "aceite",
      "ketchup",
      "mayo",
      "mayonesa",
      "remolada",
      "remoulade",
      "salsa de soja",
      "salsa de tomate",
      "vinagre",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "box",
    "matchingNames": [
      "almidón",
      "almidón alimenticio",
      "bizcocho hecho con huevos",
      "cacao",
      "cacao en polvo",
      "caja",
      "caotina",
      "cereal",
      "chicle",
      "grifos para lavavajillas",
      "jabones para lavavajillas",
      "muesli",
      "granola",
      "müsli",
      "pastillas para lavavajillas",
      "pañuelos",
      "pestañas para el lavavajillas",
      "polvo de cacao",
      "sal para lavavajillas",
      "tempos",
      "zwieback",
    ],
    "category": "household",
  },
  {
    "assetFileName": "flour",
    "matchingNames": [
      "harina",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "bread",
    "matchingNames": [
      "baguette",
      "barra de lejía",
      "bollo",
      "ekmek",
      "galleta salada",
      "junquillo",
      "pan",
      "pretzel",
      "rodar",
      "rollo",
      "semmel",
      "varilla de lejía",
    ],
    "category": "bread",
  },
  {
    "assetFileName": "can",
    "matchingNames": [
      "frijoles",
      "garbanzos",
      "lata de tomate",
      "puede",
      "pueden",
      "tomates enlatados",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "carrot",
    "matchingNames": [
      "chirivía",
      "nabo",
      "remolacha",
      "rettich",
      "ruebe",
      "rábano",
      "verduras",
      "zanahoria",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "corn",
    "matchingNames": [
      "avena",
      "bulgur",
      "granos",
      "guisantes",
      "harina de avena",
      "lentes",
      "mijo",
      "quinoa",
      "quinua",
      "semilla",
      "semillas",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "cup",
    "matchingNames": [
      "ccrea agria",
      "crema",
      "crema batida",
      "cuarc",
      "nata agria",
      "nata montada",
      "pudding",
      "pudín",
      "quark",
      "taza",
      "tazas",
      "yogur",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "glas",
    "matchingNames": [
      "aceitunas",
      "chucrut",
      "difundir",
      "gafas",
      "guacamole",
      "guindas",
      "hummus",
      "humus",
      "lentes",
      "mermelada",
      "miel",
      "mostaza",
      "nutella",
      "olivos",
      "pesto",
      "tahini",
      "untado",
      "vidrio",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "leek",
    "matchingNames": [
      "puerro",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "peanut",
    "matchingNames": [
      "anacardos",
      "nueces",
      "nuez",
      "pistachos",
      "tuerca",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "almonds",
    "matchingNames": [
      "almendra",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "round_fruit",
    "matchingNames": [
      "durazno",
      "mandarina",
      "mango",
      "melocotón",
      "naranja",
      "nectarina",
      "tomate",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "dead_cow",
    "matchingNames": [
      "bistec",
      "bovino",
      "carne",
      "carne picada",
      "filete",
      "ganado",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "dead_pig",
    "matchingNames": [
      "bacon",
      "cerdos",
      "embutido",
      "embutidos",
      "fiambres",
      "hidromiel",
      "jamón",
      "león",
      "lyon",
      "pancho",
      "pastel de carne",
      "queso de carne",
      "queso de hígado",
      "reunió",
      "salami",
      "salchicha",
      "salchichas",
      "tocino",
      "viena",
      "vienés",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "dead_chicken",
    "matchingNames": [
      "pavo",
      "pollo",
      "pollos",
      "turquía",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "fish",
    "matchingNames": [
      "arenque",
      "bacalao",
      "besugo",
      "carpa",
      "dedos de pescado",
      "dorada",
      "lucio",
      "palitos de pescado",
      "perca",
      "pescado",
      "pez",
      "pike",
      "salmón",
      "trucha",
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "cookie",
    "matchingNames": [
      "dulces",
      "galleta",
      "galletas",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "pepper",
    "matchingNames": [
      "pimenton",
      "pimentón",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "onion",
    "matchingNames": [
      "cebolla",
      "chalote",
      "schalotte",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "pear",
    "matchingNames": [
      "pera",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cabbage",
    "matchingNames": [
      "col de milán",
      "kohl",
      "repollo",
      "saboya",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "broccoli",
    "matchingNames": [
      "brócoli",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "eggplant",
    "matchingNames": [
      "berenjena",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "salad",
    "matchingNames": [
      "acelga",
      "ensalada",
      "espinaca",
      "espinacas",
      "mangold",
      "pak choi",
      "pak choy",
      "rúcula",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chocolate",
    "matchingNames": [
      "chispas de chocolate",
      "chocolate",
      "espolvoreado de chocolate",
      "raspaduras de chocolate",
      "virutas de chocolate",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "ice",
    "matchingNames": [
      "botella doble",
      "hielo",
      "magnum",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "berries",
    "matchingNames": [
      "arándanos",
      "baya",
      "bayas",
      "frambuesas",
      "grosellas",
      "pasas de corinto",
      "uvas",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "strawberry",
    "matchingNames": [
      "fresa",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "block",
    "matchingNames": [
      "manteca",
      "mantequilla",
      "margarina",
      "ram",
      "rama",
      "tofu",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "burger",
    "matchingNames": [
      "hamburguesa",
      "los ciudadanos",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "herbs",
    "matchingNames": [
      "albahaca",
      "cilantro",
      "eneldo",
      "hierbas",
      "menta",
      "perejil",
      "romero",
      "tomillo",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "pizza_cake",
    "matchingNames": [
      "pastel",
      "pizza",
      "tarta",
      "tarta flambeada",
    ],
    "category": "convenienceProductFrozen",
  },
  {
    "assetFileName": "yeast",
    "matchingNames": [
      "levadura",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "package",
    "matchingNames": [
      "agar agar",
      "agar-agar",
      "azúcar de vainilla",
      "azúcar gelificante",
      "levadura en polvo",
      "levadura seca",
      "mermelada de azucar",
      "natrón",
      "polvo de hornear",
      "polvo de pudín",
      "pudín en polvo",
      "soda",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "pasta",
    "matchingNames": [
      "espaguetis",
      "fideos",
      "pasta",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "lemon",
    "matchingNames": [
      "limón",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "potatos",
    "matchingNames": [
      "papa",
      "patata",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "garlic",
    "matchingNames": [
      "ajo",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "spice",
    "matchingNames": [
      "alcaravea",
      "canela",
      "carvi",
      "condimento",
      "curry",
      "cúrcuma",
      "especias",
      "kuemmel",
      "pimienta",
      "sal",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "rice",
    "matchingNames": [
      "arroz",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "paper_towel",
    "matchingNames": [
      "papel de cocina",
      "zewa",
    ],
    "category": "household",
  },
  {
    "assetFileName": "toilet_paper",
    "matchingNames": [
      "papel higiénico",
    ],
    "category": "household",
  },
  {
    "assetFileName": "baking_paper",
    "matchingNames": [
      "papel de hornear",
      "papel de la espalda",
      "papel film",
      "papel para hornear",
      "papel pergamino",
      "película adhesiva",
    ],
    "category": "household",
  },
  {
    "assetFileName": "mushroom",
    "matchingNames": [
      "hongo",
      "hongos",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "papaya",
    "matchingNames": [
      "papaya",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "rhubarb",
    "matchingNames": [
      "ruibarbo",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "tetrapack",
    "matchingNames": [
      "bebida de almendra",
      "bebida de almendras",
      "bebida de arroz",
      "bebida de avena",
      "bebida de soja",
      "bebida de soya",
      "jugo",
      "leche",
      "té helado",
      "zumo",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "egg",
    "matchingNames": [
      "huevos",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "coffee_beans",
    "matchingNames": [
      "café",
      "café exprés",
      "espresso",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "tea",
    "matchingNames": [
      "té",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "sugar",
    "matchingNames": [
      "azúcar",
    ],
    "category": "spicesCanned",
  },
  {
    "assetFileName": "cheese",
    "matchingNames": [
      "appenzell",
      "appenzeller",
      "brie",
      "bueno",
      "camembert",
      "caprice dieux",
      "capricho dieux",
      "cheddar",
      "edam",
      "emmental",
      "feta",
      "gauda",
      "halloumi",
      "holaumi",
      "manchego",
      "mangego",
      "mozarella",
      "mozzarella",
      "parmesano",
      "queso",
      "queso brie",
      "queso camembert",
      "queso cheddar",
      "queso edam",
      "queso feta",
      "queso mozzarella",
      "ricotta",
      "tilitro",
      "tilsit",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "asparagus",
    "matchingNames": [
      "espárragos",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "gnocchi",
    "matchingNames": [
      "ñoquis",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "pumpkin",
    "matchingNames": [
      "calabaza",
      "hokkaido",
      "hokkaidō",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "beetroot",
    "matchingNames": [
      "nabo amarillo",
      "raíz de remolacha",
      "remolacha",
      "remolacha amarilla",
      "remolacha roja",
      "remolachas amarillas",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "radish",
    "matchingNames": [
      "rábano",
      "rábanos",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cucumber",
    "matchingNames": [
      "pepino",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "dates",
    "matchingNames": [
      "fecha",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "lemon",
    "matchingNames": [
      "cal",
      "lima",
      "limas",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "bolsa",
      "tuete",
    ],
    "category": "household",
  },
  {
    "assetFileName": "raisins",
    "matchingNames": [
      "pasa",
      "sultana",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "round_fruit_small",
    "matchingNames": [
      "albaricoque",
      "ciruela",
      "kiwi",
      "mirabel",
      "mirabelle",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "seeds",
    "matchingNames": [
      "copos",
      "escamas",
      "núcleos",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "sponge",
    "matchingNames": [
      "esponja",
      "esponjas",
      "schwaemme",
    ],
    "category": "household",
  },
  {
    "assetFileName": "zucchini",
    "matchingNames": [
      "calabacín",
      "zuchini",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "avocado",
    "matchingNames": [
      "aguacate",
      "palta",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "melon",
    "matchingNames": [
      "melón",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "tampon",
    "matchingNames": [
      "tampón",
    ],
    "category": "other",
  },
  {
    "assetFileName": "pineapple",
    "matchingNames": [
      "piña",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "sweets",
    "matchingNames": [
      "aperitivos",
      "bocadillos",
      "cantuccini",
      "chips",
      "dulces",
      "galleta",
      "osito de goma",
      "osos de goma",
      "patatas fritas",
      "regaliz",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "cream",
    "matchingNames": [
      "crema",
      "gel para el cabello",
    ],
    "category": "household",
  },
  {
    "assetFileName": "shower_gel",
    "matchingNames": [
      "champú",
      "gel de ducha",
    ],
    "category": "household",
  },
  {
    "assetFileName": "dish_soap",
    "matchingNames": [
      "agente de limpieza",
      "detergente",
      "detergente para lavavajillas",
      "lavar platos",
      "limpiador de baños",
      "limpiador neutro",
      "limpiando suministros",
      "líquido lavavajillas",
    ],
    "category": "household",
  },
  {
    "assetFileName": "cherries",
    "matchingNames": [
      "cereza",
      "cerezas",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chili",
    "matchingNames": [
      "chile",
      "ají",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "hot_drink",
    "matchingNames": [
      "bebida caliente",
      "infusión",
    ],
    "category": "beverages",
  },
  {
    "assetFileName": "mango",
    "matchingNames": [
      "mango",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "pretzel",
    "matchingNames": [
      "pretzel",
    ],
    "category": "bread",
  },
  {
    "assetFileName": "stalk_celery",
    "matchingNames": [
      "apio",
      "tallo de apio",
    ],
    "category": "fruitsVegetables",
  },
];

export const categoryEntriesByLanguage: Record<CategoryLanguage, CategoryEntry[]> = {
  en: categoryEntriesEn,
  de: categoryEntriesDe,
  es: categoryEntriesEs,
};

const itemCategoryMapByLanguage: Record<CategoryLanguage, Map<string, string>> = {
  en: new Map(),
  de: new Map(),
  es: new Map(),
};

const itemIconMapByLanguage: Record<CategoryLanguage, Map<string, string>> = {
  en: new Map(),
  de: new Map(),
  es: new Map(),
};

type NormalizedCategoryMatcher = {
  normalizedName: string;
  entry: CategoryEntry;
};

const normalizeNameForMatching = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");

const itemMatchersByLanguage: Record<CategoryLanguage, NormalizedCategoryMatcher[]> = {
  en: [],
  de: [],
  es: [],
};

(["en", "de", "es"] as const).forEach((locale) => {
  categoryEntriesByLanguage[locale].forEach((entry) => {
    entry.matchingNames.forEach((name) => {
      const key = name.trim().toLowerCase();
      if (!key) {return;}
      if (!itemCategoryMapByLanguage[locale].has(key)) {
        itemCategoryMapByLanguage[locale].set(key, entry.category);
      }
      if (!itemIconMapByLanguage[locale].has(key)) {
        itemIconMapByLanguage[locale].set(key, entry.assetFileName);
      }

      const normalizedName = normalizeNameForMatching(name);
      if (!normalizedName) {return;}
      itemMatchersByLanguage[locale].push({ normalizedName, entry });
    });
  });
});

const resolveCategoryEntryForItemName = (
  name: string,
  language: CategoryLanguage,
): CategoryEntry | undefined => {
  const normalizedItemName = normalizeNameForMatching(name);
  if (!normalizedItemName) {return undefined;}

  const matches = itemMatchersByLanguage[language].filter(({ normalizedName }) =>
    normalizedItemName.includes(normalizedName),
  );

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length === 1) {
    return matches[0]?.entry;
  }

  const endingMatches = matches.filter(({ normalizedName }) =>
    normalizedItemName.endsWith(normalizedName),
  );

  const highestPriorityMatches = endingMatches.length > 0 ? endingMatches : matches;

  return highestPriorityMatches.reduce((bestMatch, currentMatch) =>
    currentMatch.normalizedName.length > bestMatch.normalizedName.length
      ? currentMatch
      : bestMatch,
  ).entry;
};

export const getCategoryIdForItemName = (
  name: string,
  language: CategoryLanguage = defaultCategoryLanguage,
): string | undefined => {
  const resolvedEntry = resolveCategoryEntryForItemName(name, language);
  if (resolvedEntry) {
    return resolvedEntry.category;
  }

  const key = name.trim().toLowerCase();
  return itemCategoryMapByLanguage[language].get(key);
};


export const getIconNameForItemName = (
  name: string,
  language: CategoryLanguage = defaultCategoryLanguage,
): string | undefined => {
  const resolvedEntry = resolveCategoryEntryForItemName(name, language);
  if (resolvedEntry) {
    return resolvedEntry.assetFileName;
  }

  const key = name.trim().toLowerCase();
  return itemIconMapByLanguage[language].get(key);
};

export const getCategoryAndIconForItemName = (
  name: string,
  language: CategoryLanguage = defaultCategoryLanguage,
): { category: string | undefined; iconName: string | undefined } => {
  const resolvedEntry = resolveCategoryEntryForItemName(name, language);
  if (resolvedEntry) {
    return { category: resolvedEntry.category, iconName: resolvedEntry.assetFileName };
  }

  const key = name.trim().toLowerCase();
  return {
    category: itemCategoryMapByLanguage[language].get(key),
    iconName: itemIconMapByLanguage[language].get(key),
  };
};
