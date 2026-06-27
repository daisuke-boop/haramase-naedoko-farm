import type { TimeOfDay } from '../types';
import { toBaseItemName } from './debugItemData';

export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type FishingRodName = '竹の釣竿' | '丈夫な釣竿' | '高級釣竿' | '伝説の釣り竿';
export type FishRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type FishingFishData = {
  id: string;
  no: number;
  name: string;
  imageSrc: string;
  minSize: number;
  maxSize: number;
  minPrice: number | null;
  maxPrice: number | null;
  bossPrice: number | null;
  unlockDifficulty: GameDifficulty;
  sellable: boolean;
  rarity: FishRarity;
  fixedSize?: number;
  oneTime?: boolean;
  note: string;
};

// App.tsx の既存UI・価格計算との互換用。新規データの正本は FishingFishData。
export type FishZukanEntry = FishingFishData & {
  level: number;
  sizeMin: number;
  sizeMax: number;
  priceMin?: number;
  priceMax?: number;
  nushiPrice?: number;
};

export const DEFAULT_FISHING_ROD: FishingRodName = '竹の釣竿';

export const FISHING_FISH_DATA: readonly FishingFishData[] = [
  { id: 'eda', no: 0, name: '枝', imageSrc: '/img/0eda.jpg', minSize: 5, maxSize: 15, minPrice: 3, maxPrice: 3, bossPrice: 3, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: 'ゴミ・流木' },
  { id: 'gomu', no: 1, name: '使用済みコンドーム', imageSrc: '/img/1kondom.jpg', minSize: 10, maxSize: 20, minPrice: 20, maxPrice: 100, bossPrice: 500, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: 'ゴミ・長靴の破片など' },
  { id: 'funa', no: 2, name: 'フナ', imageSrc: '/img/2funa.jpg', minSize: 15, maxSize: 30, minPrice: 100, maxPrice: 500, bossPrice: 2500, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: '実在・中型' },
  { id: 'oikawa', no: 3, name: 'オイカワ', imageSrc: '/img/3oikawa.jpg', minSize: 10, maxSize: 15, minPrice: 60, maxPrice: 300, bossPrice: 1500, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: '実在・小型' },
  { id: 'ugui', no: 4, name: 'ウグイ', imageSrc: '/img/4ugui.jpg', minSize: 20, maxSize: 40, minPrice: 160, maxPrice: 800, bossPrice: 4000, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: '実在・中型' },
  { id: 'dojo', no: 5, name: 'どじょう', imageSrc: '/img/5dojo.jpg', minSize: 10, maxSize: 15, minPrice: 40, maxPrice: 200, bossPrice: 1000, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: '実在・小型' },
  { id: 'haze', no: 6, name: 'ハゼ', imageSrc: '/img/6haze.jpg', minSize: 10, maxSize: 20, minPrice: 50, maxPrice: 250, bossPrice: 1250, unlockDifficulty: 'easy', sellable: true, rarity: 'common', note: '実在・小型' },
  { id: 'pantsu', no: 7, name: 'パンツ', imageSrc: '/img/7usagi.jpg', minSize: 20, maxSize: 20, minPrice: 50, maxPrice: 100, bossPrice: 100, unlockDifficulty: 'easy', sellable: true, rarity: 'uncommon', fixedSize: 20, oneTime: true, note: 'ゲーム的ジョーク枠' },
  { id: 'nijimasu', no: 8, name: 'ニジマス', imageSrc: '/img/8nijimasu.jpg', minSize: 30, maxSize: 40, minPrice: 600, maxPrice: 3000, bossPrice: 15000, unlockDifficulty: 'easy', sellable: true, rarity: 'uncommon', note: '実在・大型' },
  { id: 'yamame', no: 9, name: 'ヤマメ', imageSrc: '/img/9yamame.jpg', minSize: 20, maxSize: 40, minPrice: 240, maxPrice: 2000, bossPrice: 8000, unlockDifficulty: 'easy', sellable: true, rarity: 'uncommon', note: '実在・中型' },
  { id: 'uroko', no: 10, name: '人魚の鱗', imageSrc: '/img/10uroko.jpg', minSize: 8, maxSize: 8, minPrice: 3000, maxPrice: 3000, bossPrice: 15000, unlockDifficulty: 'normal', sellable: true, rarity: 'rare', fixedSize: 8, note: 'レアアイテム' },
  { id: 'iwana', no: 11, name: 'イワナ', imageSrc: '/img/11iwana.jpg', minSize: 30, maxSize: 50, minPrice: 800, maxPrice: 4000, bossPrice: 20000, unlockDifficulty: 'normal', sellable: true, rarity: 'uncommon', note: '実在・大型' },
  { id: 'ayu', no: 12, name: '鮎', imageSrc: '/img/12ayu.jpg', minSize: 20, maxSize: 30, minPrice: 300, maxPrice: 1500, bossPrice: 7500, unlockDifficulty: 'normal', sellable: true, rarity: 'uncommon', note: '実在・中型' },
  { id: 'shakuiwana', no: 13, name: '尺イワナ', imageSrc: '/img/13shakuiwana.jpg', minSize: 50, maxSize: 70, minPrice: 1600, maxPrice: 8000, bossPrice: 40000, unlockDifficulty: 'normal', sellable: true, rarity: 'rare', note: '尺を基準とした個体' },
  { id: 'sakuramasu', no: 14, name: 'サクラマス', imageSrc: '/img/14sakuramasu.jpg', minSize: 60, maxSize: 100, minPrice: 2000, maxPrice: 10000, bossPrice: 50000, unlockDifficulty: 'normal', sellable: true, rarity: 'rare', note: '実在・大型' },
  { id: 'sake', no: 15, name: 'サケ', imageSrc: '/img/15sake.jpg', minSize: 100, maxSize: 120, minPrice: 3000, maxPrice: 15000, bossPrice: 75000, unlockDifficulty: 'normal', sellable: true, rarity: 'rare', note: '実在・特大' },
  { id: 'raigyo', no: 16, name: 'ライギョ', imageSrc: '/img/16raigyo.jpg', minSize: 100, maxSize: 150, minPrice: 2400, maxPrice: 12000, bossPrice: 60000, unlockDifficulty: 'normal', sellable: true, rarity: 'rare', note: '実在・大型' },
  { id: 'mozukugani', no: 17, name: 'モズクガニ', imageSrc: '/img/17mozukugani.jpg', minSize: 50, maxSize: 80, minPrice: 400, maxPrice: 2000, bossPrice: 10000, unlockDifficulty: 'normal', sellable: true, rarity: 'uncommon', note: '実在・甲殻類' },
  { id: 'itou', no: 18, name: 'イトウ', imageSrc: '/img/18itou.jpg', minSize: 60, maxSize: 150, minPrice: 6000, maxPrice: 30000, bossPrice: 150000, unlockDifficulty: 'normal', sellable: true, rarity: 'legendary', note: '実在・幻の巨大魚' },
  { id: 'akibin', no: 19, name: '手紙の入った空き瓶', imageSrc: '/img/19akibin.jpg', minSize: 26, maxSize: 26, minPrice: null, maxPrice: null, bossPrice: null, unlockDifficulty: 'hard', sellable: false, rarity: 'rare', fixedSize: 26, oneTime: true, note: 'R-19 レアアイテム' },
  { id: 'oonamazu', no: 20, name: 'オオナマズ', imageSrc: '/img/20oonamazu.jpg', minSize: 80, maxSize: 150, minPrice: 10000, maxPrice: 50000, bossPrice: 250000, unlockDifficulty: 'hard', sellable: true, rarity: 'legendary', note: '実在・巨大' },
  { id: 'nishikigoi', no: 21, name: '錦鯉', imageSrc: '/img/21nishikigoi.jpg', minSize: 100, maxSize: 200, minPrice: 4000, maxPrice: 20000, bossPrice: 100000, unlockDifficulty: 'hard', sellable: true, rarity: 'rare', note: '実在・特大' },
  { id: 'aoningyo', no: 22, name: '青い人魚', imageSrc: '/img/22aoningyo.jpg', minSize: 165, maxSize: 165, minPrice: 1000000, maxPrice: 1000000, bossPrice: 5000000, unlockDifficulty: 'hard', sellable: true, rarity: 'legendary', fixedSize: 165, oneTime: true, note: 'HARD限定・一度限りのファンタジー枠' },
  { id: 'kiironingyo', no: 23, name: '黄色い人魚', imageSrc: '/img/23kiironingyo.jpg', minSize: 145, maxSize: 145, minPrice: 500000, maxPrice: 500000, bossPrice: 2500000, unlockDifficulty: 'hard', sellable: true, rarity: 'legendary', fixedSize: 145, oneTime: true, note: 'HARD限定・一度限りのファンタジー枠' },
  { id: 'pinkningyo', no: 24, name: 'ピンクの人魚', imageSrc: '/img/24pinkningyo.jpg', minSize: 162, maxSize: 162, minPrice: 750000, maxPrice: 750000, bossPrice: 3750000, unlockDifficulty: 'hard', sellable: true, rarity: 'legendary', fixedSize: 162, oneTime: true, note: 'HARD限定・一度限りのファンタジー枠' },
] as const;

export const FISHING_ROD_CATCH_TABLE: Readonly<Record<FishingRodName, readonly number[]>> = {
  '竹の釣竿': [0, 1, 2, 3, 4, 5],
  '丈夫な釣竿': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  '高級釣竿': Array.from({ length: 20 }, (_, no) => no),
  '伝説の釣り竿': Array.from({ length: 25 }, (_, no) => no),
};

export const FISHING_DIFFICULTY_MAX_NO: Readonly<Record<GameDifficulty, number>> = {
  easy: 9,
  normal: 18,
  hard: 24,
};

export const FISHING_RARITY_BASE_WEIGHTS: Readonly<Record<FishRarity, number>> = {
  common: 100,
  uncommon: 58,
  rare: 24,
  legendary: 6,
};

export const FISHING_TIME_OF_DAY_MODIFIERS: Readonly<Record<TimeOfDay, Readonly<Record<FishRarity, number>>>> = {
  morning: { common: 1.15, uncommon: 1.1, rare: 0.9, legendary: 0.7 },
  day: { common: 1.2, uncommon: 1, rare: 0.8, legendary: 0.6 },
  evening: { common: 0.9, uncommon: 1.15, rare: 1.25, legendary: 1.1 },
  night: { common: 0.75, uncommon: 1, rare: 1.35, legendary: 1.6 },
};

// 超高額の人魚はHARD・伝説の釣り竿限定に加え、個別倍率で夢枠の確率に抑える。
export const FISHING_FISH_WEIGHT_MULTIPLIERS: Readonly<Record<string, number>> = {
  kiironingyo: 0.5,
  pinkningyo: 0.2,
  aoningyo: 0.03,
};
const MERMAID_FISH_IDS = new Set(['aoningyo', 'kiironingyo', 'pinkningyo']);
const MERMAID_FISH_TARGET_RATES: Readonly<Record<string, number>> = {
  aoningyo: 0.05,
  kiironingyo: 0.03,
  pinkningyo: 0.02,
};

// 将来、釣り全体の経済価値を一括調整するための倍率。現在の価格は変更しない。
export const sellPriceMultiplier = 1;

export const FISH_ZUKAN_ENTRIES: readonly FishZukanEntry[] = FISHING_FISH_DATA.map(fish => ({
  ...fish,
  level: fish.no,
  sizeMin: fish.minSize,
  sizeMax: fish.maxSize,
  ...(fish.minPrice === null ? {} : { priceMin: fish.minPrice }),
  ...(fish.maxPrice === null ? {} : { priceMax: fish.maxPrice }),
  ...(fish.bossPrice === null ? {} : { nushiPrice: fish.bossPrice }),
}));

export const isFishingRodName = (name: string): name is FishingRodName => name in FISHING_ROD_CATCH_TABLE;

export const getFishingRodName = (name: string): FishingRodName => (
  isFishingRodName(toBaseItemName(name)) ? toBaseItemName(name) as FishingRodName : DEFAULT_FISHING_ROD
);

export const FISHING_ROD_RANKS: readonly FishingRodName[] = [
  '竹の釣竿',
  '丈夫な釣竿',
  '高級釣竿',
  '伝説の釣り竿',
];

export const getFishingRodRank = (name: string): number => (
  isFishingRodName(name) ? FISHING_ROD_RANKS.indexOf(name) : -1
);

export const shouldEquipCraftedFishingRod = (currentRod: string, craftedRod: FishingRodName): boolean => (
  getFishingRodRank(craftedRod) > getFishingRodRank(currentRod)
);

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getFishSizeRatio = (fish: FishingFishData, size: number): number => {
  if (fish.maxSize <= fish.minSize) return 1;
  return clampNumber((size - fish.minSize) / (fish.maxSize - fish.minSize), 0, 1);
};

export const isFishBossSize = (fish: FishingFishData, size: number): boolean => size >= fish.maxSize;

export const getFishSellPrice = (
  fish: FishingFishData,
  size: number,
  isBoss = isFishBossSize(fish, size),
): number | null => {
  if (!fish.sellable || fish.minPrice === null || fish.maxPrice === null) return null;
  const basePrice = isBoss
    ? fish.bossPrice ?? fish.maxPrice
    : fish.minPrice === fish.maxPrice || fish.maxSize <= fish.minSize
      ? fish.minPrice
      : fish.minPrice + (fish.maxPrice - fish.minPrice) * getFishSizeRatio(fish, size);
  return Math.round(basePrice * sellPriceMultiplier);
};

export type FishingSelectionParams = {
  difficulty: GameDifficulty;
  rodName: string;
  timeOfDay: TimeOfDay;
  caughtIds?: readonly string[];
  rareRateMultiplier?: number;
  mermaidUnlocked?: boolean;
  random?: () => number;
};

export const getFishingCandidates = ({
  difficulty,
  rodName,
  caughtIds = [],
  mermaidUnlocked = false,
}: Omit<FishingSelectionParams, 'timeOfDay' | 'random'>): readonly FishZukanEntry[] => {
  const maxNo = FISHING_DIFFICULTY_MAX_NO[difficulty];
  const catchableNos = FISHING_ROD_CATCH_TABLE[getFishingRodName(rodName)];

  return FISH_ZUKAN_ENTRIES.filter(fish => (
    fish.no <= maxNo &&
    catchableNos.includes(fish.no) &&
    (mermaidUnlocked || !MERMAID_FISH_IDS.has(fish.id)) &&
    (!fish.oneTime || !caughtIds.includes(fish.id))
  ));
};

export const selectFishingTargetFish = ({
  difficulty,
  rodName,
  timeOfDay,
  caughtIds = [],
  rareRateMultiplier = 1,
  mermaidUnlocked = false,
  random = Math.random,
}: FishingSelectionParams): FishZukanEntry => {
  const candidates = getFishingCandidates({ difficulty, rodName, caughtIds, mermaidUnlocked });
  const fallback = FISH_ZUKAN_ENTRIES[0];
  if (candidates.length === 0) return fallback;

  const mermaidCandidates = candidates.filter(fish => MERMAID_FISH_IDS.has(fish.id));
  const mermaidTotalRate = mermaidCandidates.reduce((sum, fish) => sum + (MERMAID_FISH_TARGET_RATES[fish.id] ?? 0), 0);
  if (mermaidTotalRate > 0) {
    let mermaidRoll = random();
    for (const fish of mermaidCandidates) {
      mermaidRoll -= MERMAID_FISH_TARGET_RATES[fish.id] ?? 0;
      if (mermaidRoll <= 0) return fish;
    }
  }

  const weighted = candidates.filter(fish => !MERMAID_FISH_IDS.has(fish.id)).map(fish => ({
    fish,
    weight:
      FISHING_RARITY_BASE_WEIGHTS[fish.rarity] *
      FISHING_TIME_OF_DAY_MODIFIERS[timeOfDay][fish.rarity] *
      (fish.rarity === 'common' ? 1 : rareRateMultiplier) *
      (FISHING_FISH_WEIGHT_MULTIPLIERS[fish.id] ?? 1),
  }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.fish;
  }

  return weighted[weighted.length - 1]?.fish ?? fallback;
};
