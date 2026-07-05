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
type Options = { runs: number; days: number; difficulty: GameDifficulty | 'all'; seed: number; mining: number; logging: number; fishing: number };

const DIFFICULTIES: readonly GameDifficulty[] = ['easy', 'normal', 'hard'];
const ATTACK_RATE: Record<GameDifficulty, number> = { easy: 0.18, normal: 0.20, hard: 0.25 };
const FIRST_REPAYMENT_DAY: Record<GameDifficulty, number> = { easy: 8, normal: 16, hard: 24 };
const MINIMUM_REPAYMENT: Record<GameDifficulty, number> = { easy: 50_000, normal: 200_000, hard: 500_000 };
const INITIAL_DEBT: Record<GameDifficulty, number> = { easy: 400_000, normal: 3_000_000, hard: 10_000_000 };
const MOUNTAIN_LORD_RATE = 0.20;
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
const RECIPE_MIN_DIFFICULTY: Readonly<Record<(typeof RECIPE_ORDER)[number], GameDifficulty>> = {
  '【レシピ】木剣': 'easy', '【レシピ】毛皮の服': 'easy', '【レシピ】丈夫なつるはし': 'easy',
  '【レシピ】丈夫なのこぎり': 'easy', '【レシピ】丈夫な釣竿': 'easy', '【レシピ】獣殺し': 'easy',
  '【レシピ】剛牙の鎧': 'easy', '【レシピ】高級つるはし': 'easy', '【レシピ】高級のこぎり': 'easy',
  '【レシピ】高級釣竿': 'easy', '【レシピ】天の裁き': 'normal', '【レシピ】神域の加護': 'normal',
  '【レシピ】伝説のつるはし': 'hard', '【レシピ】伝説ののこぎり': 'hard', '【レシピ】伝説の釣り竿': 'hard',
};
type SeedPlan = { girlId: string; minDifficulty: GameDifficulty; day?: number; repayments?: number; credit?: number; price?: number; items?: Record<string, number> };
const SEED_PLANS: readonly SeedPlan[] = [
  { girlId: 'viola', minDifficulty: 'easy', day: 5, price: 120_000 },
  { girlId: 'nazuna', minDifficulty: 'easy', items: { 'しなやかな軟木': 8, '軟らかい銅鉱石': 8 } },
  { girlId: 'kabune', minDifficulty: 'easy', repayments: 1 },
  { girlId: 'caro', minDifficulty: 'normal', day: 9, repayments: 1, price: 180_000 },
  { girlId: 'theta', minDifficulty: 'normal', items: { '堅実な中木': 10, '良質な鉄鉱石': 8 } },
  { girlId: 'cure', minDifficulty: 'normal', repayments: 1 },
  { girlId: 'shiro', minDifficulty: 'normal', repayments: 3, credit: 15 },
  { girlId: 'momona', minDifficulty: 'normal', day: 10 },
  { girlId: 'pan', minDifficulty: 'normal', items: { '堅実な中木': 12, '錫鉱石': 10 } },
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

const parseArgs = (): Options => {
  const values = new Map<string, string>();
  process.argv.slice(2).forEach((arg, index, args) => {
    if (!arg.startsWith('--')) return;
    const [key, inline] = arg.slice(2).split('=', 2);
    values.set(key, inline ?? args[index + 1] ?? '');
  });
  const difficulty = values.get('difficulty') ?? 'all';
  if (![...DIFFICULTIES, 'all'].includes(difficulty as GameDifficulty | 'all')) throw new Error(`不明な難易度: ${difficulty}`);
  return {
    runs: Math.max(1, Number(values.get('runs') ?? 10_000)),
    days: Math.max(1, Number(values.get('days') ?? 120)),
    difficulty: difficulty as Options['difficulty'],
    seed: Number(values.get('seed') ?? 20260705),
    mining: Math.max(0, Number(values.get('mining') ?? 2)),
    logging: Math.max(0, Number(values.get('logging') ?? 2)),
    fishing: Math.max(0, Number(values.get('fishing') ?? 2)),
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

const simulate = (difficulty: GameDifficulty, options: Options, recipes: Record<string, Recipe>) => {
  const completionDays = Object.fromEntries(RECIPE_ORDER.map(name => [name, [] as number[]]));
  const repaymentSuccesses: number[] = [];
  const endingGold: number[] = [];
  const seedAcquisitionDays = Object.fromEntries(SEED_PLANS.map(plan => [plan.girlId, [] as number[]]));
  const unreachable = new Set<string>();
  const availableBeasts = BEAST_BATTLE_DATA.filter(beast => beast.difficulty === difficulty && beast.id !== 'mountain_lord');

  for (let run = 0; run < options.runs; run += 1) {
    const random = mulberry32(options.seed + run * 10_007 + DIFFICULTIES.indexOf(difficulty) * 1_000_003);
    const inventory: Inventory = { 'つるはし': 1, 'のこぎり': 1, '竹の釣竿': 1 };
    const completed = new Set<string>();
    const plantedGirls = new Map<string, { plantedDay: number; trust: number }>([
      ['chibiichi', { plantedDay: 0, trust: 0 }], ['mel', { plantedDay: 0, trust: 0 }], ['ruby', { plantedDay: 0, trust: 0 }],
    ]);
    let pickaxe: PickaxeName = 'つるはし';
    let saw: SawName = 'のこぎり';
    let fishingRod: FishingRodName = '竹の釣竿';
    const caughtFishIds = new Set<string>();
    let scheduledAttackDay: number | null = null;
    let gold = 5_000;
    let debt = INITIAL_DEBT[difficulty];
    let repayments = 0;
    let shopStock: Record<string, number> = {};

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
        const weights = LUMBER_DATA.map(lumber => ({ value: lumber, weight: SAW_LUMBER_WEIGHTS[saw][lumber.id] ?? 0 })).filter(entry => entry.weight > 0);
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
        const mountainLord = difficulty === 'hard' && random() < MOUNTAIN_LORD_RATE;
        const giantBear = !mountainLord && difficulty === 'normal' && heroLevel >= 4 && random() < 0.25;
        const enemyCount = mountainLord || giantBear ? 1 : difficulty === 'easy' ? 1 : difficulty === 'normal' ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * 2);
        for (let enemy = 0; enemy < enemyCount; enemy += 1) {
          const beast = mountainLord
            ? BEAST_BATTLE_DATA.find(entry => entry.id === 'mountain_lord')!
            : giantBear
              ? BEAST_BATTLE_DATA.find(entry => entry.id === 'giant_bear')!
              : availableBeasts[Math.floor(random() * availableBeasts.length)];
          const drops = BEAST_DROP_DATA.find(entry => entry.beastId === beast.id)?.drops ?? [];
          drops.filter(drop => random() < drop.dropRate).map(drop => ({ drop, order: random() })).sort((a, b) => a.order - b.order).slice(0, 2).forEach(({ drop }) => {
            add(inventory, drop.dropItemName, drop.dropCountMin + Math.floor(random() * (drop.dropCountMax - drop.dropCountMin + 1)));
          });
        }
        scheduledAttackDay = null;
      } else if (scheduledAttackDay === null && random() < ATTACK_RATE[difficulty]) {
        scheduledAttackDay = day + (difficulty === 'easy' ? 1 + Math.floor(random() * 2) : 1);
      }

      for (const recipeName of RECIPE_ORDER) {
        if (DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[recipeName])) continue;
        if (completed.has(recipeName)) continue;
        const recipe = recipes[recipeName];
        if (!recipe) continue;
        const missingMaterials = Object.entries(recipe.materials).filter(([name, count]) => (inventory[name] ?? 0) < count);
        const canCompleteFromShop = missingMaterials.length > 0 && missingMaterials.every(([name]) => name in BASIC_MATERIAL_SHOP);
        if (canCompleteFromShop) {
          for (const [name, count] of missingMaterials) {
            const offer = BASIC_MATERIAL_SHOP[name as keyof typeof BASIC_MATERIAL_SHOP];
            if (heroLevel < offer.requiredLevel) continue;
            const needed = count - (inventory[name] ?? 0);
            const purchasable = Math.min(needed, shopStock[name] ?? 0, Math.floor(gold / offer.price));
            if (purchasable <= 0) continue;
            gold -= purchasable * offer.price;
            shopStock[name] -= purchasable;
            add(inventory, name, purchasable);
          }
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
      for (const plan of SEED_PLANS) {
        if (plantedGirls.has(plan.girlId) || DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(plan.minDifficulty)) continue;
        if ((plan.day ?? 1) > day || (plan.repayments ?? 0) > repayments || (plan.credit ?? 0) > farmCredit) continue;
        if (plan.girlId === 'momona' && plantedGirls.size < 3) continue;
        if (plan.items && !Object.entries(plan.items).every(([name, count]) => (inventory[name] ?? 0) >= count)) continue;
        const price = plan.price ?? 0;
        if (gold - price < MINIMUM_REPAYMENT[difficulty]) continue;
        Object.entries(plan.items ?? {}).forEach(([name, count]) => { inventory[name] -= count; });
        gold -= price;
        plantedGirls.set(plan.girlId, { plantedDay: day, trust: 0 });
        seedAcquisitionDays[plan.girlId].push(day);
      }

      const reserve: Inventory = {};
      RECIPE_ORDER.forEach(recipeName => {
        if (completed.has(recipeName) || DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[recipeName])) return;
        Object.entries(recipes[recipeName]?.materials ?? {}).forEach(([name, count]) => { reserve[name] = (reserve[name] ?? 0) + count; });
      });
      SEED_PLANS.forEach(plan => {
        if (plantedGirls.has(plan.girlId) || DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(plan.minDifficulty)) return;
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
        const payment = Math.min(debt, MINIMUM_REPAYMENT[difficulty]);
        if (gold >= payment) { gold -= payment; debt -= payment; repayments += 1; }
      }
    }
    RECIPE_ORDER.forEach(name => {
      if (DIFFICULTIES.indexOf(difficulty) >= DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[name]) && !completed.has(name)) unreachable.add(name);
    });
    repaymentSuccesses.push(repayments);
    endingGold.push(gold);
  }

  console.log(`\n=== ${difficulty.toUpperCase()} / ${options.runs.toLocaleString()}回 / ${options.days}日 ===`);
  console.log(`前提: 毎日 採掘${options.mining}回・伐採${options.logging}回・釣り${options.fishing}回、苗娘を最短収穫、襲撃は全勝、余剰素材は売却、素材が揃えば順番に自動クラフト`);
  console.log('レシピ                      完成率   平均日   遅い10%');
  RECIPE_ORDER.forEach(name => {
    if (DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(RECIPE_MIN_DIFFICULTY[name])) {
      console.log(`${name.padEnd(27)}   対象外      -         -`);
      return;
    }
    const days = completionDays[name];
    const rate = days.length / options.runs * 100;
    console.log(`${name.padEnd(27)} ${rate.toFixed(1).padStart(6)}% ${days.length ? average(days).toFixed(1).padStart(8) : '       -'} ${days.length ? String(percentile(days, 0.9)).padStart(9) : '        -'}`);
  });
  console.log(`最低返済成功回数: 平均 ${average(repaymentSuccesses).toFixed(1)}回 / 終了時所持金: 平均 ¥${Math.round(average(endingGold)).toLocaleString()}`);
  const acquiredSeedSummaries = SEED_PLANS.flatMap(plan => {
    if (DIFFICULTIES.indexOf(difficulty) < DIFFICULTIES.indexOf(plan.minDifficulty)) return [];
    const days = seedAcquisitionDays[plan.girlId];
    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === plan.girlId);
    return [`${crop?.seedName ?? plan.girlId}: ${(days.length / options.runs * 100).toFixed(1)}% / 平均${days.length ? average(days).toFixed(1) : '-'}日`];
  });
  if (acquiredSeedSummaries.length > 0) console.log(`追加苗娘: ${acquiredSeedSummaries.join('｜')}`);
  const neverCompleted = [...unreachable].filter(name => completionDays[name].length === 0);
  if (neverCompleted.length > 0) console.log(`到達不能候補: ${neverCompleted.join('、')}`);
};

const options = parseArgs();
const recipes = loadRecipes();
const targets = options.difficulty === 'all' ? DIFFICULTIES : [options.difficulty];
targets.forEach(difficulty => simulate(difficulty, options, recipes));
