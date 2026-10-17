/**
 * Local food reference database. Values are per 100 g and are typical
 * approximations based on USDA FoodData Central generic entries. They are
 * labelled as estimates in the UI: brands, recipes and preparation vary.
 */
export interface LocalFood {
  name: string;
  category: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servings: { label: string; grams: number }[];
}

type Row = [string, string, number, number, number, number, number, [string, number][]];

const ROWS: Row[] = [
  // Protein
  ["Chicken breast, cooked", "protein", 165, 31, 0, 3.6, 0, [["1 breast (172 g)", 172], ["100 g", 100]]],
  ["Chicken thigh, cooked, skinless", "protein", 209, 26, 0, 10.9, 0, [["1 thigh (116 g)", 116]]],
  ["Turkey breast, roasted", "protein", 135, 30, 0, 1, 0, [["3 slices (85 g)", 85]]],
  ["Beef, lean ground (90%), cooked", "protein", 217, 26, 0, 11.8, 0, [["1 patty (113 g)", 113]]],
  ["Beef steak, sirloin, cooked", "protein", 206, 29, 0, 9, 0, [["1 steak (200 g)", 200]]],
  ["Salmon, cooked", "protein", 206, 22, 0, 12.4, 0, [["1 fillet (154 g)", 154]]],
  ["Tuna, canned in water, drained", "protein", 116, 26, 0, 0.8, 0, [["1 can (142 g)", 142]]],
  ["White fish (cod), cooked", "protein", 105, 23, 0, 0.9, 0, [["1 fillet (180 g)", 180]]],
  ["Shrimp, cooked", "protein", 99, 24, 0.2, 0.3, 0, [["10 large (60 g)", 60]]],
  ["Egg, whole, boiled", "protein", 155, 12.6, 1.1, 10.6, 0, [["1 large egg (50 g)", 50], ["2 eggs (100 g)", 100]]],
  ["Egg white", "protein", 52, 10.9, 0.7, 0.2, 0, [["1 large white (33 g)", 33]]],
  ["Tofu, firm", "protein", 144, 17.3, 2.8, 8.7, 2.3, [["1/2 block (175 g)", 175]]],
  ["Tempeh", "protein", 192, 20.3, 7.6, 10.8, 0, [["1 cup (166 g)", 166]]],
  ["Lentils, cooked", "protein", 116, 9, 20.1, 0.4, 7.9, [["1 cup (198 g)", 198]]],
  ["Chickpeas, cooked", "protein", 164, 8.9, 27.4, 2.6, 7.6, [["1 cup (164 g)", 164]]],
  ["Black beans, cooked", "protein", 132, 8.9, 23.7, 0.5, 8.7, [["1 cup (172 g)", 172]]],
  ["Whey protein powder", "protein", 400, 80, 8, 6, 0, [["1 scoop (30 g)", 30]]],
  // Dairy
  ["Greek yogurt, plain, nonfat", "dairy", 59, 10.2, 3.6, 0.4, 0, [["1 container (170 g)", 170]]],
  ["Greek yogurt, plain, whole milk", "dairy", 97, 9, 3.98, 5, 0, [["1 container (170 g)", 170]]],
  ["Milk, 2%", "dairy", 50, 3.3, 4.8, 2, 0, [["1 cup (244 g)", 244]]],
  ["Milk, whole", "dairy", 61, 3.2, 4.8, 3.3, 0, [["1 cup (244 g)", 244]]],
  ["Cottage cheese, low-fat", "dairy", 81, 10.5, 4.3, 2.3, 0, [["1/2 cup (113 g)", 113]]],
  ["Cheddar cheese", "dairy", 403, 24.9, 1.3, 33.1, 0, [["1 slice (28 g)", 28]]],
  ["Mozzarella, part-skim", "dairy", 254, 24.3, 2.8, 15.9, 0, [["1 oz (28 g)", 28]]],
  ["Soy milk, unsweetened", "dairy", 33, 2.9, 1.7, 1.6, 0.4, [["1 cup (243 g)", 243]]],
  // Grains & starches
  ["White rice, cooked", "grains", 130, 2.7, 28.2, 0.3, 0.4, [["1 cup (158 g)", 158]]],
  ["Brown rice, cooked", "grains", 123, 2.7, 25.6, 1, 1.6, [["1 cup (195 g)", 195]]],
  ["Oats, dry rolled", "grains", 379, 13.2, 67.7, 6.5, 10.1, [["1/2 cup (40 g)", 40]]],
  ["Pasta, cooked", "grains", 158, 5.8, 30.9, 0.9, 1.8, [["1 cup (140 g)", 140]]],
  ["Whole wheat bread", "grains", 252, 12.4, 42.7, 3.5, 6, [["1 slice (32 g)", 32]]],
  ["White bread", "grains", 266, 7.6, 50.6, 3.3, 2.4, [["1 slice (25 g)", 25]]],
  ["Pita bread", "grains", 275, 9.1, 55.7, 1.2, 2.2, [["1 pita (60 g)", 60]]],
  ["Tortilla, flour", "grains", 306, 8.2, 50.9, 7.6, 3.5, [["1 medium (45 g)", 45]]],
  ["Quinoa, cooked", "grains", 120, 4.4, 21.3, 1.9, 2.8, [["1 cup (185 g)", 185]]],
  ["Couscous, cooked", "grains", 112, 3.8, 23.2, 0.2, 1.4, [["1 cup (157 g)", 157]]],
  ["Potato, baked with skin", "grains", 93, 2.5, 21.2, 0.1, 2.2, [["1 medium (173 g)", 173]]],
  ["Sweet potato, baked", "grains", 90, 2, 20.7, 0.2, 3.3, [["1 medium (114 g)", 114]]],
  ["Granola", "grains", 471, 10, 64, 20, 5, [["1/2 cup (60 g)", 60]]],
  ["Corn flakes cereal", "grains", 357, 7.5, 84, 0.4, 3.3, [["1 cup (28 g)", 28]]],
  // Fruit
  ["Banana", "fruit", 89, 1.1, 22.8, 0.3, 2.6, [["1 medium (118 g)", 118]]],
  ["Apple", "fruit", 52, 0.3, 13.8, 0.2, 2.4, [["1 medium (182 g)", 182]]],
  ["Orange", "fruit", 47, 0.9, 11.8, 0.1, 2.4, [["1 medium (131 g)", 131]]],
  ["Strawberries", "fruit", 32, 0.7, 7.7, 0.3, 2, [["1 cup (152 g)", 152]]],
  ["Blueberries", "fruit", 57, 0.7, 14.5, 0.3, 2.4, [["1 cup (148 g)", 148]]],
  ["Grapes", "fruit", 69, 0.7, 18.1, 0.2, 0.9, [["1 cup (151 g)", 151]]],
  ["Dates, medjool", "fruit", 277, 1.8, 75, 0.2, 6.7, [["1 date (24 g)", 24]]],
  ["Mango", "fruit", 60, 0.8, 15, 0.4, 1.6, [["1 cup (165 g)", 165]]],
  ["Watermelon", "fruit", 30, 0.6, 7.6, 0.2, 0.4, [["1 cup (152 g)", 152]]],
  // Vegetables
  ["Broccoli, cooked", "vegetables", 35, 2.4, 7.2, 0.4, 3.3, [["1 cup (156 g)", 156]]],
  ["Spinach, raw", "vegetables", 23, 2.9, 3.6, 0.4, 2.2, [["1 cup (30 g)", 30]]],
  ["Mixed salad greens", "vegetables", 17, 1.5, 3.3, 0.2, 1.8, [["2 cups (85 g)", 85]]],
  ["Tomato", "vegetables", 18, 0.9, 3.9, 0.2, 1.2, [["1 medium (123 g)", 123]]],
  ["Cucumber", "vegetables", 15, 0.7, 3.6, 0.1, 0.5, [["1/2 cucumber (150 g)", 150]]],
  ["Carrot", "vegetables", 41, 0.9, 9.6, 0.2, 2.8, [["1 medium (61 g)", 61]]],
  ["Bell pepper", "vegetables", 31, 1, 6, 0.3, 2.1, [["1 medium (119 g)", 119]]],
  ["Green beans, cooked", "vegetables", 35, 1.9, 7.9, 0.3, 3.2, [["1 cup (125 g)", 125]]],
  ["Zucchini, cooked", "vegetables", 15, 1.1, 2.7, 0.4, 1, [["1 cup (180 g)", 180]]],
  ["Onion", "vegetables", 40, 1.1, 9.3, 0.1, 1.7, [["1/2 medium (55 g)", 55]]],
  // Fats, nuts & seeds
  ["Olive oil", "fats", 884, 0, 0, 100, 0, [["1 tbsp (13.5 g)", 13.5]]],
  ["Butter", "fats", 717, 0.9, 0.1, 81, 0, [["1 tbsp (14 g)", 14]]],
  ["Avocado", "fats", 160, 2, 8.5, 14.7, 6.7, [["1/2 avocado (100 g)", 100]]],
  ["Almonds", "fats", 579, 21.2, 21.6, 49.9, 12.5, [["1 handful (28 g)", 28]]],
  ["Peanut butter", "fats", 588, 25, 20, 50, 6, [["1 tbsp (16 g)", 16], ["2 tbsp (32 g)", 32]]],
  ["Walnuts", "fats", 654, 15.2, 13.7, 65.2, 6.7, [["1 handful (28 g)", 28]]],
  ["Chia seeds", "fats", 486, 16.5, 42.1, 30.7, 34.4, [["1 tbsp (12 g)", 12]]],
  ["Hummus", "fats", 166, 7.9, 14.3, 9.6, 6, [["2 tbsp (30 g)", 30]]],
  ["Tahini", "fats", 595, 17, 21.2, 53.8, 9.3, [["1 tbsp (15 g)", 15]]],
  // Mixed dishes & snacks
  ["Pizza, cheese, regular crust", "meals", 266, 11.4, 33.3, 9.7, 2.3, [["1 slice (107 g)", 107]]],
  ["Hamburger with bun", "meals", 254, 13, 25, 11, 1.3, [["1 burger (226 g)", 226]]],
  ["Chicken shawarma wrap", "meals", 210, 13, 20, 9, 1.5, [["1 wrap (280 g)", 280]]],
  ["Couscous with vegetables and chicken", "meals", 150, 9, 17, 5, 2, [["1 plate (350 g)", 350]]],
  ["Spaghetti bolognese", "meals", 140, 7, 17, 4.5, 1.6, [["1 plate (350 g)", 350]]],
  ["Fried rice", "meals", 163, 4.7, 26, 4.5, 0.9, [["1 cup (137 g)", 137]]],
  ["French fries", "meals", 312, 3.4, 41, 15, 3.8, [["Medium serving (117 g)", 117]]],
  ["Lentil soup", "meals", 56, 3.6, 9, 0.9, 2.4, [["1 bowl (250 g)", 250]]],
  ["Dark chocolate 70%", "snacks", 598, 7.8, 45.9, 42.6, 10.9, [["2 squares (20 g)", 20]]],
  ["Protein bar", "snacks", 370, 30, 40, 11, 5, [["1 bar (60 g)", 60]]],
  ["Potato chips", "snacks", 536, 7, 53, 34.6, 4.4, [["1 small bag (28 g)", 28]]],
  ["Rice cakes", "snacks", 387, 8.2, 81.5, 2.8, 4.2, [["1 cake (9 g)", 9]]],
  ["Honey", "snacks", 304, 0.3, 82.4, 0, 0.2, [["1 tbsp (21 g)", 21]]],
  // Drinks
  ["Orange juice", "drinks", 45, 0.7, 10.4, 0.2, 0.2, [["1 glass (248 g)", 248]]],
  ["Cola, regular", "drinks", 42, 0, 10.6, 0, 0, [["1 can (355 g)", 355]]],
  ["Coffee, black", "drinks", 1, 0.1, 0, 0, 0, [["1 cup (240 g)", 240]]],
  ["Latte with 2% milk", "drinks", 54, 3.4, 5.3, 2.1, 0, [["Medium (360 g)", 360]]],
  ["Sports drink", "drinks", 26, 0, 6.4, 0, 0, [["1 bottle (591 g)", 591]]],
];

export const LOCAL_FOODS: LocalFood[] = ROWS.map(([name, category, kcal, protein, carbs, fat, fiber, servings]) => ({
  name,
  category,
  kcal,
  protein,
  carbs,
  fat,
  fiber,
  servings: [...servings.map(([label, grams]) => ({ label, grams })), ...(servings.some(([, g]) => g === 100) ? [] : [{ label: "100 g", grams: 100 }])],
}));
