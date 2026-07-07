import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { BEAST_BATTLE_DATA, BEAST_DROP_DATA } from '../src/data/battleData.ts';
import { FARM_GIRL_CROP_DATA } from '../src/data/farmData.ts';
import { ORE_DATA, PICKAXE_ORE_WEIGHTS, getMiningRewardQuantity, type PickaxeName } from '../src/data/miningData.ts';
import { LUMBER_DATA, SAW_LUMBER_WEIGHTS, type SawName } from '../src/data/lumberData.ts';
import { getFishSellPrice, selectFishingTargetFish, type FishingRodName, type GameDifficulty } from '../src/data/fishingData.ts';

type Recipe = { output: string; materials: Record<string, number> };
type Inventory = Record<string, number>;
type RepaymentPolicy = 'minimum' | 'balanced' | 'maximum';
type Options = { runs: number; days: number; difficulty: GameDifficulty | 'all'; repayment: RepaymentPolicy | 'all'; seed: number; mining: number; logging: number; fishing: number; minutesPerDay: number };

const DIFFICULTIES: readonly GameDifficulty[] = ['easy', 'normal', 'hard'];
const REPAYMENT_POLICIES: readonly RepaymentPolicy[] = ['minimum', 'balanced', 'maximum'];
const ATTACK_RATE: Record<GameDifficulty, number> = { easy: 0.18, normal: 0.15, hard: 0.20 };
const FIRST_REPAYMENT_DAY: Record<GameDifficulty, number> = { easy: 8, normal: 16, hard: 24 };
const MINIMUM_REPAYMENT: Record<GameDifficulty, number> = { easy: 50_000, normal: 200_000, hard: 500_000 };
const ADDITIONAL_REPAYMENT_OPTIONS: Record<GameDifficulty, readonly number[]> = {
  easy: [10_000, 20_000],
  normal: [25_000, 50_000, 100_000],
  hard: [50_000, 100_000, 200_000],
};
const SPECIAL_REPAYMENT_UNLOCK_REMAINING_RATE = 0.25;
const INITIAL_DEBT: Record<GameDifficulty, number> = { easy: 400_000, normal: 3_000_000, hard: 10_000_000 };
const FIELD_EXPANSION: Record<GameDifficulty, { credit: number; cost: number }> = {
  easy: { credit: 5, cost: 100_000 }, normal: { credit: 20, cost: 300_000 }, hard: { credit: 30, cost: 500_000 },
};
const MOUNTAIN_LORD_RATE = 0.20;
const MOUNTAIN_LORD_SILK_DROP_RATE = 0.25;
const HARD_HIGH_GRADE_SAW_ANCIENT_TREE_WEIGHT = 1.8;
const BASIC_MATERIAL_SHOP = {
  'モグラの爪': { price: 400, stock: 2, requiredLevel: 1 },
  'ウサギの靭帯': { price: 700, stock: 2, requiredLevel: 1 },
  '猪の牙': { price: 2_500, stock: 1, requiredLevel: 2 },
  '猪の硬皮': { price: 4_000, stock: 1, requiredLevel: 2 },
  '熊の剛糸': { price: 6_000, stock: 1, requiredLevel: 3 },
} as const;
const RECIPE_ORDER = [
  '【レシピ】木剣', '【レシピ】毛皮の服', '【レシピ】丈夫なつるはし', '【レシピ】丈夫なのこぎり',
  '【レシピ】丈夫な釣竿', '【レシピ】獣殺し', '【レシピ】剛牙の鎧', '【レシピ】高級つるはし',
  '【レシピ】高級のこぎり', '【レシピ】高級釣竿', '【レシピ】天の裁き', '【レシピ】神域の加護',
  '【レシピ】伝説のつるはし', '【レシピ】伝説ののこぎり', '【レシピ】伝説の釣り竿',
] as const;
const LEGENDARY_RECIPE_NAMES = [
  '【レシピ】伝説のつるはし',
  '【レシピ】伝説ののこぎり',
  '【レシピ】伝説の釣り竿',
] as const;
const RECIPE_MIN_DIFFICULTY: Readonly<Record<(typeof RECIPE_ORDER)[number], GameDifficulty>> = {
  '【レシピ】木剣': 'easy', '【レシピ】毛皮の服': 'easy', '【レシピ】丈夫なつるはし': 'easy',
  '【レシピ】丈夫なのこぎり': 'easy', '【レシピ】丈夫な釣竿': 'easy', '【レシピ】獣殺し': 'easy',
  '【レシピ】剛牙の鎧': 'easy', '【レシピ】高級つるはし': 'easy', '【レシピ】高級のこぎり': 'easy',
  '【レシピ】高級釣竿': 'easy', '【レシピ】天の裁き': 'normal', '【レシピ】神域の加護': 'normal',
  '【レシピ】伝説のつるはし': 'hard', '【レシピ】伝説ののこぎり': 'hard', '【レシピ】伝説の釣り竿': 'hard',
};
type SeedPlan = {
  girlId: string;
  minDifficulty: GameDifficulty;
  day?: number;
  repayments?: number;
  credit?: number;
  price?: number;
  items?: Record<string, number>;
  requiresSturdySaw?: boolean;
  requiresSturdyGathering?: boolean;
};
const SEED_PLANS: readonly SeedPlan[] = [
  { girlId: 'viola', minDifficulty: 'easy', day: 5, price: 120_000 },
  { girlId: 'nazuna', minDifficulty: 'easy', requiresSturdySaw: true, items: { 'しなやかな軟木': 8, '軟らかい銅鉱石': 8 } },
  { girlId: 'kabune', minDifficulty: 'easy', repayments: 1 },
  { girlId: 'caro', minDifficulty: 'normal', day: 9, repayments: 1, price: 180_000 },
  { girlId: 'theta', minDifficulty: 'normal', requiresSturdyGathering: true, items: { '堅実な中木': 10, '良質な鉄鉱石': 8 } },
  { girlId: 'cure', minDifficulty: 'normal', repayments: 1 },
  { girlId: 'shiro', minDifficulty: 'normal', repayments: 3, credit: 15 },
  { girlId: 'momona', minDifficulty: 'normal', day: 10 },
  { girlId: 'pan', minDifficulty: 'normal', requiresSturdyGathering: true, items: { '堅実な中木': 12, '錫鉱石': 10 } },
  { girlId: 'puti', minDifficulty: 'hard', repayments: 3 },
  { girlId: 'roma', minDifficulty: 'hard', credit: 60 },
] as const;

const MATERIAL_SELL_PRICE: Readonly<Record<string, number>> = {
  ...Object.fromEntries(ORE_DATA.map(ore => [ore.name, Math.round(ore.baseSellPrice * 1.05)])),
  ...Object.fromEntries(LUMBER_DATA.map(lumber => [lumber.name, Math.round((lumber.basePriceMin + lumber.basePriceMax) / 2 * 10)])),
  ...Object.fromEntries(BEAST_DROP_DATA.flatMap(entry => entry.drops.map(drop => [drop.dropItemName, drop.sellPrice]))),
  '木材': 40,
};

const getTrustHarvestMultiplier = (trust: number) => trust >= 100 ? 1.5 : trust >= 80 ? 1.4 : trust >= 60 ? 1.3 : trust >= 40 ? 1.2 : trust >= 20 ? 1.1 : 1;
const getTrustSellMultiplier = (trust: number) => trust >= 100 ? 1.25 : trust >= 80 ? 1.15 : trust >= 60 ? 1.1 : trust >= 40 ? 1.05 : 1;

const hasInventory = (inventory: Inventory, name: string) => (inventory[name] ?? 0) > 0;
const hasRecipeProgress = (completed: ReadonlySet<string>, inventory: Inventory, recipeName: string, outputName: string) => (
  completed.has(recipeName) || hasInventory(inventory, recipeName) || hasInventory(inventory, outputName)
);
const hasBoarProgress = (completedBeasts: ReadonlySet<string>, inventory: Inventory) => (
  completedBeasts.has('boar') || hasInventory(inventory, '猪の牙') || hasInventory(inventory, '猪の硬皮')
);
const hasBearProgress = (completedBeasts: ReadonlySet<string>, inventory: Inventory) => (
  completedBeasts.has('bear') || hasInventory(inventory, '熊の剛糸')
);
const hasGiantBeastProgress = (completedBeasts: ReadonlySet<string>, inventory: Inventory) => (
  completedBeasts.has('giant_bear') ||
  completedBeasts.has('mountain_lord') ||
  hasInventory(inventory, '巨獣の鋼角') ||
  hasInventory(inventory, '巨獣の強剛糸') ||
  hasInventory(inventory, '神獣の絹糸')
);
const hasSturdySawProgress = (completed: ReadonlySet<string>, inventory: Inventory) => (
  hasRecipeProgress(completed, inventory, '【レシピ】丈夫なのこぎり', '丈夫なのこぎり')
);
const hasSturdyPickaxeProgress = (completed: ReadonlySet<string>, inventory: Inventory) => (
  hasRecipeProgress(completed, inventory, '【レシピ】丈夫なつるはし', '丈夫なつるはし')
);
const hasSturdyGatheringProgress = (completed: ReadonlySet<string>, inventory: Inventory) => (
  hasSturdySawProgress(completed, inventory) && hasSturdyPickaxeProgress(completed, inventory)
);

const isRecipeUnlocked = (
  recipeName: (typeof RECIPE_ORDER)[number],
  difficulty: GameDifficulty,
  day: number,
  heroLevel: number,
  repayments: number,
  debt: number,
  completed: ReadonlySet<string>,
  inventory: Inventory,
  defeatedBeasts: ReadonlySet<string>,
  mountainLordAttackPending: boolean,
) => {
  if (DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[recipeName])) return false;
  const boarProgress = hasBoarProgress(defeatedBeasts, inventory);
  const bearProgress = hasBearProgress(defeatedBeasts, inventory);
  const giantProgress = hasGiantBeastProgress(defeatedBeasts, inventory);
  const boarMaterialRoute = boarProgress || heroLevel >= 2 || repayments >= 2;
  const bearMaterialRoute = bearProgress || heroLevel >= 3 || repayments >= 3;
  switch (recipeName) {
    case '【レシピ】木剣':
    case '【レシピ】毛皮の服':
      return day >= 2 || boarProgress || bearProgress || giantProgress || repayments >= 2;
    case '【レシピ】丈夫なつるはし':
      return true;
    case '【レシピ】丈夫なのこぎり':
      return true;
    case '【レシピ】丈夫な釣竿':
      return hasRecipeProgress(completed, inventory, '【レシピ】のこぎり', 'のこぎり') &&
        hasRecipeProgress(completed, inventory, '【レシピ】つるはし', 'つるはし') &&
        hasSturdySawProgress(completed, inventory);
    case '【レシピ】獣殺し':
      return boarProgress;
    case '【レシピ】剛牙の鎧':
      return bearMaterialRoute && hasRecipeProgress(completed, inventory, '【レシピ】毛皮の服', '毛皮の服');
    case '【レシピ】高級つるはし':
    case '【レシピ】高級のこぎり':
      return boarMaterialRoute && hasSturdyGatheringProgress(completed, inventory);
    case '【レシピ】高級釣竿':
      return bearMaterialRoute && hasRecipeProgress(completed, inventory, '【レシピ】丈夫な釣竿', '丈夫な釣竿');
    case '【レシピ】天の裁き':
      return giantProgress && hasRecipeProgress(completed, inventory, '【レシピ】獣殺し', '獣殺し');
    case '【レシピ】神域の加護':
      return (giantProgress || mountainLordAttackPending) && hasRecipeProgress(completed, inventory, '【レシピ】剛牙の鎧', '剛牙の鎧');
    case '【レシピ】伝説のつるはし':
      return (giantProgress || debt <= 0) && hasRecipeProgress(completed, inventory, '【レシピ】高級つるはし', '高級つるはし');
    case '【レシピ】伝説ののこぎり':
      return (giantProgress || debt <= 0) && hasRecipeProgress(completed, inventory, '【レシピ】高級のこぎり', '高級のこぎり');
    case '【レシピ】伝説の釣り竿':
      return (giantProgress || debt <= 0) && hasRecipeProgress(completed, inventory, '【レシピ】高級釣竿', '高級釣竿');
    default:
      return false;
  }
};

const createHardStoryBeastIds = (day: number, heroLevel: number, random: () => number): readonly string[] => {
  if (day <= 20 || heroLevel <= 2) return random() < 0.5 ? ['bear'] : ['boar', 'great_fang_beast'];
  if (day <= 35 || heroLevel <= 3) return random() < 0.55 ? ['giant_bear'] : ['great_fang_beast', 'bear'];
  if (random() < 0.15) return ['giant_bear', 'giant_bear', 'giant_bear'];
  return random() < 0.55 ? ['giant_bear', 'giant_bear'] : ['giant_bear', 'great_fang_beast'];
};

const parseArgs = (): Options => {
  const values = new Map<string, string>();
  process.argv.slice(2).forEach((arg, index, args) => {
    if (!arg.startsWith('--')) return;
    const [key, inline] = arg.slice(2).split('=', 2);
    values.set(key, inline ?? args[index + 1] ?? '');
  });
  const difficulty = values.get('difficulty') ?? 'all';
  if (![...DIFFICULTIES, 'all'].includes(difficulty as GameDifficulty | 'all')) throw new Error(`不明な難易度: ${difficulty}`);
  const repayment = values.get('repayment') ?? 'all';
  if (![...REPAYMENT_POLICIES, 'all'].includes(repayment as RepaymentPolicy | 'all')) throw new Error(`不明な返済方針: ${repayment}`);
  return {
    runs: Math.max(1, Number(values.get('runs') ?? 10_000)),
    days: Math.max(1, Number(values.get('days') ?? values.get('day') ?? 120)),
    difficulty: difficulty as Options['difficulty'],
    repayment: repayment as Options['repayment'],
    seed: Number(values.get('seed') ?? 20260705),
    mining: Math.max(0, Number(values.get('mining') ?? 2)),
    logging: Math.max(0, Number(values.get('logging') ?? 2)),
    fishing: Math.max(0, Number(values.get('fishing') ?? 2)),
    minutesPerDay: Math.max(0.1, Number(values.get('minutes-per-day') ?? 7)),
  };
};

const readLiteral = (node: ts.Expression): unknown => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text.replaceAll('_', ''));
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -Number(readLiteral(node.operand));
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => readLiteral(element as ts.Expression));
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.flatMap(property => {
      if (!ts.isPropertyAssignment(property)) return [];
      const name = ts.isComputedPropertyName(property.name) ? null : property.name.getText().replace(/^['"]|['"]$/g, '');
      return name ? [[name, readLiteral(property.initializer)]] : [];
    }));
  }
  throw new Error(`未対応の設定式: ${node.getText().slice(0, 80)}`);
};

const loadRecipes = (): Record<string, Recipe> => {
  const appPath = path.resolve('src/App.tsx');
  const source = ts.createSourceFile(appPath, fs.readFileSync(appPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer: ts.Expression | undefined;
  source.forEachChild(node => {
    if (!ts.isVariableStatement(node)) return;
    node.declarationList.declarations.forEach(declaration => {
      if (declaration.name.getText() === 'CRAFT_RECIPE_CONFIGS') initializer = declaration.initializer;
    });
  });
  if (!initializer) throw new Error('CRAFT_RECIPE_CONFIGSを読み取れませんでした。');
  return readLiteral(initializer) as Record<string, Recipe>;
};

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
  return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
};

const weightedPick = <T>(entries: readonly { value: T; weight: number }[], random: () => number): T => {
  let roll = random() * entries.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
};

const add = (inventory: Inventory, name: string, count = 1) => { inventory[name] = (inventory[name] ?? 0) + count; };
const percentile = (values: number[], rate: number) => values.sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * rate))];
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const simulate = (difficulty: GameDifficulty, repaymentPolicy: RepaymentPolicy, options: Options, recipes: Record<string, Recipe>) => {
  const completionDays = Object.fromEntries(RECIPE_ORDER.map(name => [name, [] as number[]]));
  const repaymentSuccesses: number[] = [];
  const endingGold: number[] = [];
  const clearDays: number[] = [];
  const legendaryCompletionCounts = [0, 0, 0, 0];
  const legendaryMaterialShortages = Object.fromEntries(LEGENDARY_RECIPE_NAMES.map(name => [
    name,
    {} as Record<string, { runs: number; totalMissing: number }>,
  ])) as Record<(typeof LEGENDARY_RECIPE_NAMES)[number], Record<string, { runs: number; totalMissing: number }>>;
  const seedAcquisitionDays = Object.fromEntries(SEED_PLANS.map(plan => [plan.girlId, [] as number[]]));
  const unreachable = new Set<string>();
  const availableBeasts = BEAST_BATTLE_DATA.filter(beast => beast.difficulty === difficulty && beast.id !== 'mountain_lord');

  for (let run = 0; run < options.runs; run += 1) {
    const random = mulberry32(options.seed + run * 10_007 + DIFFICULTIES.indexOf(difficulty) * 1_000_003);
    const shuffledLegendaryRecipeNames = [...LEGENDARY_RECIPE_NAMES];
    for (let index = shuffledLegendaryRecipeNames.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffledLegendaryRecipeNames[index], shuffledLegendaryRecipeNames[swapIndex]] = [
        shuffledLegendaryRecipeNames[swapIndex],
        shuffledLegendaryRecipeNames[index],
      ];
    }
    const recipeOrder = [
      ...RECIPE_ORDER.filter(name => !LEGENDARY_RECIPE_NAMES.includes(name as (typeof LEGENDARY_RECIPE_NAMES)[number])),
      ...shuffledLegendaryRecipeNames,
    ];
    const inventory: Inventory = { 'つるはし': 1, 'のこぎり': 1, '竹の釣竿': 1 };
    const completed = new Set<string>();
    const plantedGirls = new Map<string, { plantedDay: number; trust: number }>([
      ['chibiichi', { plantedDay: 0, trust: 0 }], ['mel', { plantedDay: 0, trust: 0 }], ['ruby', { plantedDay: 0, trust: 0 }],
    ]);
    const ownedGirls = new Set(plantedGirls.keys());
    let fieldSlots = 6;
    let pickaxe: PickaxeName = 'つるはし';
    let saw: SawName = 'のこぎり';
    let fishingRod: FishingRodName = '竹の釣竿';
    const caughtFishIds = new Set<string>();
    let scheduledAttackDay: number | null = null;
    let scheduledMountainLordAttack = false;
    let gold = 5_000;
    let debt = INITIAL_DEBT[difficulty];
    let repayments = 0;
    let shopStock: Record<string, number> = {};
    let mountainLordDefeated = false;
    const defeatedBeasts = new Set<string>();

    for (let day = 1; day <= options.days; day += 1) {
      const heroLevel = repayments >= 10 ? 5 : repayments >= 6 ? 4 : repayments >= 3 ? 3 : repayments >= 1 ? 2 : 1;
      if (day === 1 || (day >= FIRST_REPAYMENT_DAY[difficulty] && (day - FIRST_REPAYMENT_DAY[difficulty]) % 8 === 0)) {
        shopStock = Object.fromEntries(Object.entries(BASIC_MATERIAL_SHOP).map(([name, item]) => [name, item.stock]));
      }
      plantedGirls.forEach((state, girlId) => {
        const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girlId);
        if (!crop) return;
        const firstHarvestDay = state.plantedDay + crop.growthDays;
        if (day < firstHarvestDay || (day - firstHarvestDay) % crop.harvestIntervalDays !== 0) return;
        const amount = Math.max(1, Math.round(crop.baseHarvestAmount * getTrustHarvestMultiplier(state.trust)));
        gold += Math.round(amount * crop.baseSellPrice * 1.1 * getTrustSellMultiplier(state.trust));
        state.trust = Math.min(100, state.trust + (['chibiichi', 'mel', 'ruby'].includes(girlId) ? 8 : Math.max(5, crop.harvestIntervalDays * 2)));
      });

      for (let attempt = 0; attempt < options.mining; attempt += 1) {
        const gaugeRoll = random();
        const gauge = gaugeRoll < 0.14 ? 95 : gaugeRoll < 0.42 ? 80 : 50;
        const weights = ORE_DATA.map(ore => ({ value: ore, weight: PICKAXE_ORE_WEIGHTS[pickaxe][ore.id] ?? 0 })).filter(entry => entry.weight > 0);
        const ore = weightedPick(weights, random);
        add(inventory, ore.name, getMiningRewardQuantity(ore.id, gauge));
      }
      for (let attempt = 0; attempt < options.logging; attempt += 1) {
        const weights = LUMBER_DATA.map(lumber => ({
          value: lumber,
          weight: difficulty === 'hard' && saw === '高級のこぎり' && lumber.id === 'ancient_tree'
            ? HARD_HIGH_GRADE_SAW_ANCIENT_TREE_WEIGHT
            : SAW_LUMBER_WEIGHTS[saw][lumber.id] ?? 0,
        })).filter(entry => entry.weight > 0);
        for (let reward = 0; reward < 3; reward += 1) add(inventory, weightedPick(weights, random).name);
        add(inventory, '木材');
      }
      for (let attempt = 0; attempt < options.fishing; attempt += 1) {
        const timeOfDay = (['morning', 'day', 'evening', 'night'] as const)[attempt % 4];
        const fish = selectFishingTargetFish({ difficulty, rodName: fishingRod, timeOfDay, caughtIds: [...caughtFishIds], random });
        const size = fish.minSize + (fish.maxSize - fish.minSize) * random();
        const price = getFishSellPrice(fish, size, false);
        if (price !== null) gold += price;
        if (fish.oneTime) caughtFishIds.add(fish.id);
      }

      if (scheduledAttackDay === day) {
        const mountainLord = scheduledMountainLordAttack;
        const giantBear = !mountainLord && difficulty === 'normal' && heroLevel >= 4 && random() < 0.25;
        const enemyIds = mountainLord
          ? ['mountain_lord']
          : giantBear
            ? ['giant_bear']
            : difficulty === 'hard'
              ? createHardStoryBeastIds(day, heroLevel, random)
              : Array.from({ length: difficulty === 'easy' ? 1 : 1 + Math.floor(random() * 2) }, () => (
                  availableBeasts[Math.floor(random() * availableBeasts.length)]?.id
                ));
        for (const enemyId of enemyIds) {
          const beast = BEAST_BATTLE_DATA.find(entry => entry.id === enemyId);
          if (!beast) continue;
          defeatedBeasts.add(beast.id);
          const drops = BEAST_DROP_DATA.find(entry => entry.beastId === beast.id)?.drops ?? [];
          if (beast.id === 'mountain_lord' && !mountainLordDefeated) {
            add(inventory, '神獣の角');
            add(inventory, '神獣の絹糸');
            mountainLordDefeated = true;
          }
          drops.filter(drop => random() < (drop.dropItemName === '神獣の絹糸' ? MOUNTAIN_LORD_SILK_DROP_RATE : drop.dropRate)).map(drop => ({ drop, order: random() })).sort((a, b) => a.order - b.order).slice(0, 2).forEach(({ drop }) => {
            add(inventory, drop.dropItemName, drop.dropCountMin + Math.floor(random() * (drop.dropCountMax - drop.dropCountMin + 1)));
          });
        }
        scheduledAttackDay = null;
        scheduledMountainLordAttack = false;
      } else if (scheduledAttackDay === null && random() < ATTACK_RATE[difficulty]) {
        scheduledMountainLordAttack = difficulty === 'hard' && random() < MOUNTAIN_LORD_RATE;
        scheduledAttackDay = day + (difficulty === 'easy' ? 1 + Math.floor(random() * 2) : 1);
      }

      for (const recipeName of recipeOrder) {
        if (!isRecipeUnlocked(recipeName, difficulty, day, heroLevel, repayments, debt, completed, inventory, defeatedBeasts, scheduledMountainLordAttack)) continue;
        if (completed.has(recipeName)) continue;
        const recipe = recipes[recipeName];
        if (!recipe) continue;
        const missingMaterials = Object.entries(recipe.materials).filter(([name, count]) => (inventory[name] ?? 0) < count);
        for (const [name, count] of missingMaterials) {
          if (!(name in BASIC_MATERIAL_SHOP)) continue;
          const offer = BASIC_MATERIAL_SHOP[name as keyof typeof BASIC_MATERIAL_SHOP];
          if (heroLevel < offer.requiredLevel) continue;
          const needed = count - (inventory[name] ?? 0);
          const purchasable = Math.min(needed, shopStock[name] ?? 0, Math.floor(gold / offer.price));
          if (purchasable <= 0) continue;
          gold -= purchasable * offer.price;
          shopStock[name] -= purchasable;
          add(inventory, name, purchasable);
        }
        const canCraft = Object.entries(recipe.materials).every(([name, count]) => (inventory[name] ?? 0) >= count);
        if (!canCraft) continue;
        Object.entries(recipe.materials).forEach(([name, count]) => { inventory[name] -= count; });
        add(inventory, recipe.output);
        completed.add(recipeName);
        completionDays[recipeName].push(day);
        if (recipe.output.includes('つるはし')) pickaxe = recipe.output as PickaxeName;
        if (recipe.output.includes('のこぎり')) saw = recipe.output as SawName;
        if (recipe.output.includes('釣竿') || recipe.output.includes('釣り竿')) fishingRod = recipe.output as FishingRodName;
      }

      const farmCredit = repayments * 5;
      const expansion = FIELD_EXPANSION[difficulty];
      if (fieldSlots === 6 && (repayments >= 1 || farmCredit >= expansion.credit) && gold - expansion.cost >= MINIMUM_REPAYMENT[difficulty]) {
        gold -= expansion.cost;
        fieldSlots = 10;
      }
      for (const girlId of ownedGirls) {
        if (plantedGirls.size >= fieldSlots) break;
        if (!plantedGirls.has(girlId)) plantedGirls.set(girlId, { plantedDay: day, trust: 0 });
      }
      for (const plan of SEED_PLANS) {
        if (ownedGirls.has(plan.girlId) || DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(plan.minDifficulty)) continue;
        if ((plan.day ?? 1) > day || (plan.repayments ?? 0) > repayments || (plan.credit ?? 0) > farmCredit) continue;
        if (plan.requiresSturdySaw && !hasSturdySawProgress(completed, inventory)) continue;
        if (plan.requiresSturdyGathering && !hasSturdyGatheringProgress(completed, inventory)) continue;
        if (plan.girlId === 'momona' && plantedGirls.size < 3) continue;
        if (plan.items && !Object.entries(plan.items).every(([name, count]) => (inventory[name] ?? 0) >= count)) continue;
        const price = plan.price ?? 0;
        if (gold - price < MINIMUM_REPAYMENT[difficulty]) continue;
        Object.entries(plan.items ?? {}).forEach(([name, count]) => { inventory[name] -= count; });
        gold -= price;
        ownedGirls.add(plan.girlId);
        if (plantedGirls.size < fieldSlots) plantedGirls.set(plan.girlId, { plantedDay: day, trust: 0 });
        seedAcquisitionDays[plan.girlId].push(day);
      }

      const reserve: Inventory = {};
      recipeOrder.forEach(recipeName => {
        if (completed.has(recipeName) || !isRecipeUnlocked(recipeName, difficulty, day, heroLevel, repayments, debt, completed, inventory, defeatedBeasts, scheduledMountainLordAttack)) return;
        Object.entries(recipes[recipeName]?.materials ?? {}).forEach(([name, count]) => { reserve[name] = (reserve[name] ?? 0) + count; });
      });
      SEED_PLANS.forEach(plan => {
        if (ownedGirls.has(plan.girlId) || DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(plan.minDifficulty)) return;
        if (plan.requiresSturdySaw && !hasSturdySawProgress(completed, inventory)) return;
        if (plan.requiresSturdyGathering && !hasSturdyGatheringProgress(completed, inventory)) return;
        Object.entries(plan.items ?? {}).forEach(([name, count]) => { reserve[name] = (reserve[name] ?? 0) + count; });
      });
      Object.entries(inventory).forEach(([name, count]) => {
        const sellPrice = MATERIAL_SELL_PRICE[name];
        if (!sellPrice) return;
        const surplus = Math.max(0, count - (reserve[name] ?? 0));
        if (surplus <= 0) return;
        inventory[name] -= surplus;
        gold += surplus * sellPrice;
      });

      if (day >= FIRST_REPAYMENT_DAY[difficulty] && (day - FIRST_REPAYMENT_DAY[difficulty]) % 8 === 0 && debt > 0) {
        const minimumPrincipal = Math.min(debt, MINIMUM_REPAYMENT[difficulty]);
        if (gold >= minimumPrincipal) {
          let principal = minimumPrincipal;
          if (repaymentPolicy === 'balanced') {
            const extraBudget = Math.max(0, gold - minimumPrincipal - MINIMUM_REPAYMENT[difficulty]);
            const additional = [...ADDITIONAL_REPAYMENT_OPTIONS[difficulty]].reverse().find(amount => amount <= extraBudget) ?? 0;
            principal = Math.min(debt, minimumPrincipal + additional);
          } else if (repaymentPolicy === 'maximum') {
            const specialRepaymentUnlocked = debt <= INITIAL_DEBT[difficulty] * SPECIAL_REPAYMENT_UNLOCK_REMAINING_RATE;
            principal = specialRepaymentUnlocked
              ? Math.min(debt, gold)
              : Math.min(debt, minimumPrincipal + ADDITIONAL_REPAYMENT_OPTIONS[difficulty].at(-1)!);
          }
          gold -= principal;
          debt -= principal;
          repayments += 1;
        }
      }
      if (debt <= 0) {
        clearDays.push(day);
        break;
      }
    }
    if (debt <= 0 && difficulty === 'hard') {
      const legendaryCompletedCount = LEGENDARY_RECIPE_NAMES.filter(recipeName => completed.has(recipeName)).length;
      legendaryCompletionCounts[legendaryCompletedCount] += 1;
      LEGENDARY_RECIPE_NAMES.forEach(recipeName => {
        if (completed.has(recipeName)) return;
        Object.entries(recipes[recipeName]?.materials ?? {}).forEach(([materialName, requiredCount]) => {
          const missing = Math.max(0, requiredCount - (inventory[materialName] ?? 0));
          if (missing <= 0) return;
          const current = legendaryMaterialShortages[recipeName][materialName] ?? { runs: 0, totalMissing: 0 };
          legendaryMaterialShortages[recipeName][materialName] = {
            runs: current.runs + 1,
            totalMissing: current.totalMissing + missing,
          };
        });
      });
    }
    RECIPE_ORDER.forEach(name => {
      if (DIFFICULTIES.indexOf(difficulty) >= DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[name]) && !completed.has(name)) unreachable.add(name);
    });
    repaymentSuccesses.push(repayments);
    endingGold.push(gold);
  }

  const repaymentLabel: Record<RepaymentPolicy, string> = { minimum: '最低返済', balanced: '余裕返済', maximum: '最大返済' };
  console.log(`\n=== ${difficulty.toUpperCase()} / ${repaymentLabel[repaymentPolicy]} / ${options.runs.toLocaleString()}回 / 最大${options.days}日 ===`);
  console.log(`前提: 毎日 採掘${options.mining}回・伐採${options.logging}回・釣り${options.fishing}回、苗娘を最短収穫、襲撃は全勝、余剰素材は売却、素材が揃えば順番に自動クラフト`);
  const clearRate = clearDays.length / options.runs * 100;
  const averageClearDay = clearDays.length > 0 ? average(clearDays) : null;
  const averagePlayHours = averageClearDay === null ? null : averageClearDay * options.minutesPerDay / 60;
  console.log(`完済率: ${clearRate.toFixed(1)}% / 平均完済日: ${averageClearDay?.toFixed(1) ?? '-'}日 / 想定プレイ時間: ${averagePlayHours?.toFixed(1) ?? '-'}時間（1日${options.minutesPerDay}分）`);
  console.log('レシピ                    完済前完成率   平均完成日   遅い10%');
  RECIPE_ORDER.forEach(name => {
    if (DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[name])) {
      console.log(`${name.padEnd(27)}       対象外          -         -`);
      return;
    }
    const days = completionDays[name];
    const rate = days.length / options.runs * 100;
    console.log(`${name.padEnd(27)} ${rate.toFixed(1).padStart(10)}% ${days.length ? average(days).toFixed(1).padStart(12) : '           -'} ${days.length ? String(percentile(days, 0.9)).padStart(9) : '        -'}`);
  });
  if (difficulty === 'hard' && clearDays.length > 0) {
    const completionRateAtLeast = (count: number) => (
      legendaryCompletionCounts.slice(count).reduce((sum, runs) => sum + runs, 0) / clearDays.length * 100
    );
    console.log(`伝説装備完成数: 1個以上 ${completionRateAtLeast(1).toFixed(1)}% / 2個以上 ${completionRateAtLeast(2).toFixed(1)}% / 全3個 ${completionRateAtLeast(3).toFixed(1)}%`);
    console.log('伝説装備の不足素材（完済時）:');
    LEGENDARY_RECIPE_NAMES.forEach(recipeName => {
      const shortages = Object.entries(legendaryMaterialShortages[recipeName])
        .sort(([, a], [, b]) => b.runs - a.runs)
        .map(([materialName, shortage]) => (
          `${materialName} ${shortage.runs / clearDays.length * 100 >= 0.05 ? (shortage.runs / clearDays.length * 100).toFixed(1) : '0.0'}% / 不足時平均${(shortage.totalMissing / shortage.runs).toFixed(1)}個`
        ));
      console.log(`  ${recipeName}: ${shortages.length > 0 ? shortages.join('｜') : '不足なし'}`);
    });
  }
  console.log(`最低返済成功回数: 平均 ${average(repaymentSuccesses).toFixed(1)}回 / 完済・期間終了時所持金: 平均 ¥${Math.round(average(endingGold)).toLocaleString()}`);
  const acquiredSeedSummaries = SEED_PLANS.flatMap(plan => {
    if (DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(plan.minDifficulty)) return [];
    const days = seedAcquisitionDays[plan.girlId];
    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === plan.girlId);
    return [`${crop?.seedName ?? plan.girlId}: ${(days.length / options.runs * 100).toFixed(1)}% / 平均${days.length ? average(days).toFixed(1) : '-'}日`];
  });
  if (acquiredSeedSummaries.length > 0) console.log(`追加苗娘: ${acquiredSeedSummaries.join('｜')}`);
  const neverCompleted = [...unreachable].filter(name => completionDays[name].length === 0);
  if (neverCompleted.length > 0) console.log(`完済前に完成しなかったレシピ: ${neverCompleted.join('、')}`);
};

const options = parseArgs();
const recipes = loadRecipes();
const targets = options.difficulty === 'all' ? DIFFICULTIES : [options.difficulty];
const repaymentTargets = options.repayment === 'all' ? REPAYMENT_POLICIES : [options.repayment];
targets.forEach(difficulty => repaymentTargets.forEach(policy => simulate(difficulty, policy, options, recipes)));
