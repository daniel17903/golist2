import { getLocale } from "../i18n";
import type { Locale } from "../i18n/config";
export type Category = {
  id: string;
  label: string;
  icon: string;
  order: number;
};

export const categories: Category[] = [
  { id: "fruitsVegetables", label: "Fruits & Vegetables", icon: "🥕", order: 1 },
  { id: "bread", label: "Bread", icon: "🥖", order: 2 },
  { id: "milkCheese", label: "Milk & Cheese", icon: "🥛", order: 3 },
  { id: "meatFish", label: "Meat & Fish", icon: "🥩", order: 4 },
  { id: "cereals", label: "Cereals", icon: "🥣", order: 5 },
  { id: "spicesCanned", label: "Spices & Canned", icon: "🫙", order: 6 },
  { id: "sweetsSnacks", label: "Sweets & Snacks", icon: "🍪", order: 7 },
  { id: "beverages", label: "Beverages", icon: "🧃", order: 8 },
  { id: "household", label: "Household", icon: "🧽", order: 9 },
  { id: "convenienceProductFrozen", label: "Convenience & Frozen", icon: "🍕", order: 10 },
  { id: "other", label: "Other", icon: "🛒", order: 11 },
];

type CategoryEntry = {
  assetFileName: string;
  matchingNames: string[];
  category: string;
};

const categoryEntriesDe: CategoryEntry[] = [
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
    "assetFileName": "lime",
    "matchingNames": [
      "lime",
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
    "assetFileName": "lime",
    "matchingNames": [
      "limette",
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
      "dishwasher taps",
      "muesli",
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
      "bread roll",
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
      "pepper",
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
    "assetFileName": "lime",
    "matchingNames": [
      "lime",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "bag",
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
    "assetFileName": "apple",
    "matchingNames": [
      "apple",
      "aepfel",
      "obst",
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
      "flasche",
      "water",
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
      "oil",
      "vinegar",
      "sojasosse",
      "soja sosse",
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
      "muesli",
      "tempos",
      "kaugummi",
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
      "flour",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "bread",
    "matchingNames": [
      "bread",
      "bread roll",
      "laugenstange",
      "brezel",
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
      "ruebe",
      "rettich",
      "gemuese",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "corn",
    "matchingNames": [
      "samen",
      "linsen",
      "erbsen",
      "hirse",
      "oats",
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
      "yogurt",
      "quark",
      "saure sahne",
      "schlagsahne",
      "cream",
      "pudding",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "glas",
    "matchingNames": [
      "glas",
      "marmelade",
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
      "tomato",
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
      "pute",
      "chicken",
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
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "cookie",
    "matchingNames": [
      "cookie",
      "cookies",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "pepper",
    "matchingNames": [
      "pepper",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "onion",
    "matchingNames": [
      "onion",
      "schalotte",
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
      "cabbage",
      "wirsing",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "broccoli",
    "matchingNames": [
      "broccoli",
      "brokoli",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "eggplant",
    "matchingNames": [
      "eggplant",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "salad",
    "matchingNames": [
      "salad",
      "rucola",
      "spinach",
      "mangold",
      "pak choi",
      "pak choy",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chocolate",
    "matchingNames": [
      "chocolate",
      "schokostreusel",
      "schokoraspel",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "ice",
    "matchingNames": [
      "ice cream",
      "magnum",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "berries",
    "matchingNames": [
      "berries",
      "raspberries",
      "johannisbeeren",
      "heidelbeeren",
      "blueberries",
      "trauben",
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
      "petersilie",
      "basilikum",
      "koriander",
      "dill",
      "minze",
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
      "pepper",
      "gewuerz",
      "curry",
      "kurkuma",
      "zimt",
      "kuemmel",
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
      "paper towels",
      "zewa",
    ],
    "category": "household",
  },
  {
    "assetFileName": "toilet_paper",
    "matchingNames": [
      "klopapier",
      "klo papier",
      "toilet paper",
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
      "milk",
      "juice",
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
      "cheese",
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
      "pumpkin",
      "hokkaido",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "beetroot",
    "matchingNames": [
      "rote bete",
      "gelbe bete",
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
      "cucumber",
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
    "assetFileName": "lime",
    "matchingNames": [
      "lime",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "bag",
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
      "sponge",
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
      "shower gel",
      "shampoo",
    ],
    "category": "household",
  },
  {
    "assetFileName": "dish_soap",
    "matchingNames": [
      "badreiniger",
      "dish soap",
      "cleaner",
      "neutralreiniger",
    ],
    "category": "household",
  },
];

const categoryEntriesEs: CategoryEntry[] = [
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
      "dishwasher taps",
      "muesli",
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
      "panecillo",
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
      "requesón",
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
      "naranja",
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
      "pimiento",
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
      "col",
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
      "berenjena",
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
      "mantequilla",
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
    "assetFileName": "lime",
    "matchingNames": [
      "lime",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "bag",
      "bolsa",
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
      "patatas fritas",
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
      "champú",
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
    "assetFileName": "apple",
    "matchingNames": [
      "manzana",
      "aepfel",
      "obst",
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
      "flasche",
      "agua",
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
      "aceite",
      "vinagre",
      "sojasosse",
      "soja sosse",
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
      "muesli",
      "tempos",
      "kaugummi",
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
      "harina",
    ],
    "category": "cereals",
  },
  {
    "assetFileName": "bread",
    "matchingNames": [
      "pan",
      "panecillo",
      "laugenstange",
      "brezel",
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
      "ruebe",
      "rettich",
      "gemuese",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "corn",
    "matchingNames": [
      "samen",
      "linsen",
      "erbsen",
      "hirse",
      "copos de avena",
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
      "yogur",
      "requesón",
      "saure sahne",
      "schlagsahne",
      "nata",
      "pudding",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "glas",
    "matchingNames": [
      "glas",
      "marmelade",
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
      "naranja",
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
      "pute",
      "chicken",
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
    ],
    "category": "meatFish",
  },
  {
    "assetFileName": "cookie",
    "matchingNames": [
      "galleta",
      "galletas",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "pepper",
    "matchingNames": [
      "pimiento",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "onion",
    "matchingNames": [
      "cebolla",
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
      "col",
      "wirsing",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "broccoli",
    "matchingNames": [
      "brócoli",
      "broccoli",
      "brokoli",
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
      "ensalada",
      "rucola",
      "espinaca",
      "mangold",
      "pak choi",
      "pak choy",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "chocolate",
    "matchingNames": [
      "chocolate",
      "schokostreusel",
      "schokoraspel",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "ice",
    "matchingNames": [
      "helado",
      "magnum",
    ],
    "category": "sweetsSnacks",
  },
  {
    "assetFileName": "berries",
    "matchingNames": [
      "bayas",
      "frambuesas",
      "johannisbeeren",
      "heidelbeeren",
      "arándanos",
      "trauben",
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
      "tofu",
      "mantequilla",
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
      "petersilie",
      "basilikum",
      "koriander",
      "dill",
      "minze",
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
      "pasta",
      "spaghetti",
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
      "sal",
      "pimienta",
      "gewuerz",
      "curry",
      "kurkuma",
      "zimt",
      "kuemmel",
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
      "klopapier",
      "klo papier",
      "papel higiénico",
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
      "leche",
      "zumo",
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
      "huevos",
    ],
    "category": "milkCheese",
  },
  {
    "assetFileName": "coffee_beans",
    "matchingNames": [
      "café",
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
      "queso",
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
      "calabaza",
      "hokkaido",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "beetroot",
    "matchingNames": [
      "rote bete",
      "gelbe bete",
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
      "pepino",
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
    "assetFileName": "lime",
    "matchingNames": [
      "lima",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "paper_bag",
    "matchingNames": [
      "bolsa",
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
      "esponja",
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
      "melón",
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
      "piña",
    ],
    "category": "fruitsVegetables",
  },
  {
    "assetFileName": "sweets",
    "matchingNames": [
      "patatas fritas",
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
      "gel de ducha",
      "champú",
    ],
    "category": "household",
  },
  {
    "assetFileName": "dish_soap",
    "matchingNames": [
      "badreiniger",
      "lavavajillas",
      "limpiador",
      "neutralreiniger",
    ],
    "category": "household",
  },
];

const categoryEntriesByLocale: Record<Locale, CategoryEntry[]> = {
  en: categoryEntriesEn,
  de: categoryEntriesDe,
  es: categoryEntriesEs,
};

const itemCategoryMapByLocale: Record<Locale, Map<string, string>> = {
  en: new Map(),
  de: new Map(),
  es: new Map(),
};

const itemAssetMapByLocale: Record<Locale, Map<string, string>> = {
  en: new Map(),
  de: new Map(),
  es: new Map(),
};

const iconBasePath = "/icons";
const defaultIconName = "default";
const buildIconPath = (iconName: string) => `${iconBasePath}/${iconName}.svg`;

const categoryIconById: Record<string, string> = {
  fruitsVegetables: "apple",
  bread: "bread",
  milkCheese: "cup",
  meatFish: "dead_cow",
  cereals: "corn",
  spicesCanned: "can",
  sweetsSnacks: "cookie",
  beverages: "bottle",
  household: "sponge",
  convenienceProductFrozen: "pizza_cake",
  other: defaultIconName,
};

(["en", "de", "es"] as const).forEach((locale) => {
  categoryEntriesByLocale[locale].forEach((entry) => {
    entry.matchingNames.forEach((name) => {
      const key = name.trim().toLowerCase();
      if (!key) {return;}
      if (!itemCategoryMapByLocale[locale].has(key)) {
        itemCategoryMapByLocale[locale].set(key, entry.category);
      }
      if (!itemAssetMapByLocale[locale].has(key)) {
        itemAssetMapByLocale[locale].set(key, entry.assetFileName);
      }
    });
  });
});

export const getCategoryForItem = (name: string, locale: Locale = getLocale()): Category | undefined => {
  const key = name.trim().toLowerCase();
  const categoryId = itemCategoryMapByLocale[locale].get(key);
  return categories.find((category) => category.id === categoryId);
};

export const getCategoryOrder = (name: string, locale: Locale = getLocale()): number | undefined => {
  const category = getCategoryForItem(name, locale);
  return category?.order;
};

export const getItemIconForCategory = (categoryId: string): string => {
  const iconName = categoryIconById[categoryId] ?? defaultIconName;
  return buildIconPath(iconName);
};

export const getItemIcon = (name: string, locale: Locale = getLocale()): string => {
  const key = name.trim().toLowerCase();
  const asset = itemAssetMapByLocale[locale].get(key);
  if (asset) {
    return buildIconPath(asset);
  }
  return buildIconPath(defaultIconName);
};
