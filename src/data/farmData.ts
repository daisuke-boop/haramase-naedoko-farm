import type { GirlUnlockTier } from './girlData';

export type FarmGirlPresenceState =
  | 'not_owned'
  | 'planted'
  | 'growing'
  | 'appeared'
  | 'joined'
  | 'lover'
  | 'temporarily_away';

export type FarmGirlCropData = {
  girlId: string;
  seedName: string;
  harvestItemName: string;
  unlockTier: GirlUnlockTier;
  growthDays: number;
  harvestIntervalDays: number;
  baseHarvestAmount: number;
  baseSellPrice: number;
  rareHarvestItemName?: string;
  rareHarvestChance?: number;
  rareSellPrice?: number;
  uniquePerGirl: true;
  canHaveMultiple: false;
};

export type FarmGirlOwnershipState = {
  girlId: string;
  presenceState: FarmGirlPresenceState;
};

export const farmSellPriceMultiplier = 1;

export const getFarmHarvestBaseSellPrice = (
  data: Pick<FarmGirlCropData, 'baseSellPrice'>,
  multiplier = farmSellPriceMultiplier,
): number => (
  Math.round(data.baseSellPrice * multiplier)
);

// 将来の実売価格想定:
// baseSellPrice × farmSellPriceMultiplier × 信頼度補正 × 品質補正
export const getFarmHarvestSellPrice = (
  data: Pick<FarmGirlCropData, 'baseSellPrice'>,
  trustMultiplier = 1,
  qualityMultiplier = 1,
  multiplier = farmSellPriceMultiplier,
): number => (
  Math.round(data.baseSellPrice * multiplier * trustMultiplier * qualityMultiplier)
);

export const FARM_GIRL_CROP_DATA: readonly FarmGirlCropData[] = [
  {
    girlId: 'chibiichi',
    seedName: 'いちごの苗娘',
    harvestItemName: 'ちびいちのいちご',
    unlockTier: 'initial',
    growthDays: 2,
    harvestIntervalDays: 2,
    baseHarvestAmount: 2,
    baseSellPrice: 4_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'mel',
    seedName: 'メロンの苗娘',
    harvestItemName: 'メルのメロン',
    unlockTier: 'initial',
    growthDays: 3,
    harvestIntervalDays: 3,
    baseHarvestAmount: 1,
    baseSellPrice: 15_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'ruby',
    seedName: 'トマトの苗娘',
    harvestItemName: 'ルビーのトマト',
    unlockTier: 'initial',
    growthDays: 2,
    harvestIntervalDays: 2,
    baseHarvestAmount: 3,
    baseSellPrice: 3_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'viola',
    seedName: 'ブドウの苗娘',
    harvestItemName: 'ヴィオラのブドウ',
    unlockTier: 'mid',
    growthDays: 4,
    harvestIntervalDays: 3,
    baseHarvestAmount: 2,
    baseSellPrice: 25_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'nazuna',
    seedName: 'なすの苗娘',
    harvestItemName: 'ナズナのなす',
    unlockTier: 'mid',
    growthDays: 3,
    harvestIntervalDays: 2,
    baseHarvestAmount: 2,
    baseSellPrice: 10_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'kabune',
    seedName: 'かぶの苗娘',
    harvestItemName: 'かぶねのかぶ',
    unlockTier: 'mid',
    growthDays: 2,
    harvestIntervalDays: 2,
    baseHarvestAmount: 2,
    baseSellPrice: 8_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'caro',
    seedName: 'にんじんの苗娘',
    harvestItemName: 'キャロのにんじん',
    unlockTier: 'mid',
    growthDays: 3,
    harvestIntervalDays: 2,
    baseHarvestAmount: 2,
    baseSellPrice: 9_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'theta',
    seedName: 'しいたけの苗娘',
    harvestItemName: 'シータのしいたけ',
    unlockTier: 'mid',
    growthDays: 4,
    harvestIntervalDays: 3,
    baseHarvestAmount: 3,
    baseSellPrice: 9_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'cure',
    seedName: 'きゅうりの苗娘',
    harvestItemName: 'キュアのきゅうり',
    unlockTier: 'mid',
    growthDays: 3,
    harvestIntervalDays: 2,
    baseHarvestAmount: 3,
    baseSellPrice: 8_500,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'shiro',
    seedName: 'だいこんの苗娘',
    harvestItemName: 'シロのだいこん',
    unlockTier: 'mid',
    growthDays: 3,
    harvestIntervalDays: 3,
    baseHarvestAmount: 2,
    baseSellPrice: 12_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'momona',
    seedName: 'ももの苗娘',
    harvestItemName: 'ももなのもも',
    unlockTier: 'mid',
    growthDays: 5,
    harvestIntervalDays: 4,
    baseHarvestAmount: 1,
    baseSellPrice: 35_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'pan',
    seedName: 'かぼちゃの苗娘',
    harvestItemName: 'パンのかぼちゃ',
    unlockTier: 'mid',
    growthDays: 5,
    harvestIntervalDays: 4,
    baseHarvestAmount: 1,
    baseSellPrice: 30_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'puti',
    seedName: 'ドラフルの苗娘',
    harvestItemName: 'プティのドラゴンフルーツ',
    unlockTier: 'final',
    growthDays: 6,
    harvestIntervalDays: 4,
    baseHarvestAmount: 1,
    baseSellPrice: 80_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'roma',
    seedName: 'ロマネの苗娘',
    harvestItemName: 'ロマのロマネスコ',
    unlockTier: 'final',
    growthDays: 6,
    harvestIntervalDays: 4,
    baseHarvestAmount: 1,
    baseSellPrice: 120_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
  {
    girlId: 'saffy',
    seedName: 'サフランの苗娘',
    harvestItemName: 'サフィのサフラン',
    unlockTier: 'final',
    growthDays: 7,
    harvestIntervalDays: 5,
    baseHarvestAmount: 1,
    baseSellPrice: 180_000,
    uniquePerGirl: true,
    canHaveMultiple: false,
  },
] as const;

export const isFarmGirlDuplicateBlocked = (presenceState: FarmGirlPresenceState): boolean => (
  presenceState !== 'not_owned'
);
