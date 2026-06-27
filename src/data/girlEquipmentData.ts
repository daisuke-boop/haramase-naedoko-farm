import { FARM_GIRL_CROP_DATA } from './farmData';

export const girlEquipmentSlots = 2;

export type GirlEquipmentSlotIndex = 1 | 2;

export type GirlEquipQuality = 'none' | 'normal' | 'good' | 'perfect';

export type GirlEquipmentMiniGameResult = 'fail' | 'normal' | 'good' | 'perfect';

export type GirlEquipmentBonusStats = {
  hp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  farmPower?: number;
  harvestAmountBonus?: number;
  sellPriceBonus?: number;
  trustGainBonus?: number;
};

export type GirlEquipmentSlot = {
  girlId: string;
  slotIndex: GirlEquipmentSlotIndex;
  equippedItemId: string | null;
  bonusStats: GirlEquipmentBonusStats;
  equipQuality: GirlEquipQuality;
};

export type GirlEquipmentMiniGameRankConfig = {
  resultRank: GirlEquipmentMiniGameResult;
  success: boolean;
  consumesHarvestItem: true;
  bonusMultiplier: number;
  description: string;
};

export type GirlEquipmentRequiredHarvestItem = {
  girlId: string;
  requiredHarvestItemId: string;
  requiredAmount: 1;
};

export const GIRL_EQUIPMENT_MINIGAME_RANK_CONFIGS: Readonly<Record<GirlEquipmentMiniGameResult, GirlEquipmentMiniGameRankConfig>> = {
  fail: {
    resultRank: 'fail',
    success: false,
    consumesHarvestItem: true,
    bonusMultiplier: 0,
    description: '装備失敗。作物は消費予定。補正なし。',
  },
  normal: {
    resultRank: 'normal',
    success: true,
    consumesHarvestItem: true,
    bonusMultiplier: 1.0,
    description: '装備成功。装備基本性能×1.0。',
  },
  good: {
    resultRank: 'good',
    success: true,
    consumesHarvestItem: true,
    bonusMultiplier: 1.0,
    description: '装備成功。装備基本性能×1.0。',
  },
  perfect: {
    resultRank: 'perfect',
    success: true,
    consumesHarvestItem: true,
    bonusMultiplier: 1.0,
    description: '装備成功。装備基本性能×1.0。',
  },
};

export const GIRL_EQUIPMENT_REQUIRED_HARVEST_ITEMS: readonly GirlEquipmentRequiredHarvestItem[] = FARM_GIRL_CROP_DATA.map(data => ({
  girlId: data.girlId,
  requiredHarvestItemId: data.harvestItemName,
  requiredAmount: 1,
}));

export const getGirlEquipmentSlots = (girlId: string): GirlEquipmentSlot[] => (
  Array.from({ length: girlEquipmentSlots }, (_, index) => ({
    girlId,
    slotIndex: (index + 1) as GirlEquipmentSlotIndex,
    equippedItemId: null,
    bonusStats: {},
    equipQuality: 'none',
  }))
);

export const getRequiredHarvestItemForGirlEquipment = (girlId: string): GirlEquipmentRequiredHarvestItem | null => (
  GIRL_EQUIPMENT_REQUIRED_HARVEST_ITEMS.find(item => item.girlId === girlId) ?? null
);

export const getGirlEquipmentBonusMultiplier = (resultRank: GirlEquipmentMiniGameResult): number => (
  GIRL_EQUIPMENT_MINIGAME_RANK_CONFIGS[resultRank].bonusMultiplier
);
