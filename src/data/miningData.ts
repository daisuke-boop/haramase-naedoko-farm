import { getItemCountIncludingDebug, toBaseItemName } from './debugItemData';

export type PickaxeName = 'つるはし' | '丈夫なつるはし' | '高級つるはし' | '伝説のつるはし';

export type OreData = {
  id: string;
  name: string;
  minWeight: number;
  maxWeight: number;
  baseSellPrice: number;
};

export type OreRarityTier = 'normal' | 'mediumRare' | 'highRare' | 'topRare';

export type MiningPerformanceBonus = {
  mediumRareMultiplier: number;
  highRareMultiplier: number;
  topRareMultiplier: number;
  label: 'なし' | '小' | '中' | '大' | '大＋FULL COMBO';
};

export const TEMP_MINING_LIMIT_PER_TIME_SLOT = 3;
const MIN_ORE_QUALITY_MULTIPLIER = 0.8;
const MAX_ORE_QUALITY_MULTIPLIER = 1.3;

export const ORE_DATA: readonly OreData[] = [
  { id: 'muddy_iron', name: '泥混じりの鉄鉱石', minWeight: 500, maxWeight: 2000, baseSellPrice: 420 },
  { id: 'soft_copper', name: '軟らかい銅鉱石', minWeight: 500, maxWeight: 2000, baseSellPrice: 520 },
  { id: 'brittle_lead', name: '脆い鉛鉱石', minWeight: 500, maxWeight: 2000, baseSellPrice: 650 },
  { id: 'light_coal', name: '軽石炭', minWeight: 100, maxWeight: 1000, baseSellPrice: 360 },
  { id: 'quality_iron', name: '良質な鉄鉱石', minWeight: 1000, maxWeight: 5000, baseSellPrice: 3600 },
  { id: 'tin', name: '錫鉱石', minWeight: 1000, maxWeight: 5000, baseSellPrice: 4400 },
  { id: 'silver', name: '銀鉱石', minWeight: 1000, maxWeight: 5000, baseSellPrice: 6200 },
  { id: 'gold', name: '金鉱石', minWeight: 2000, maxWeight: 8000, baseSellPrice: 18000 },
  { id: 'steel', name: '鋼鉄石', minWeight: 2000, maxWeight: 8000, baseSellPrice: 7200 },
  { id: 'sanctuary_gem', name: '聖域の輝石', minWeight: 5000, maxWeight: 10000, baseSellPrice: 85000 },
] as const;

export const PICKAXE_RANKS: readonly PickaxeName[] = ['つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし'];

export const PICKAXE_ORE_WEIGHTS: Readonly<Record<PickaxeName, Readonly<Record<OreData['id'], number>>>> = {
  'つるはし': { muddy_iron: 35, soft_copper: 30, brittle_lead: 20, light_coal: 15, quality_iron: 0, tin: 0, silver: 0, gold: 0, steel: 0, sanctuary_gem: 0 },
  '丈夫なつるはし': { muddy_iron: 25, soft_copper: 20, brittle_lead: 15, light_coal: 15, quality_iron: 10, tin: 8, silver: 5, gold: 0, steel: 2, sanctuary_gem: 0 },
  '高級つるはし': { muddy_iron: 0, soft_copper: 0, brittle_lead: 0, light_coal: 0, quality_iron: 30, tin: 25, silver: 20, gold: 10, steel: 12, sanctuary_gem: 3 },
  '伝説のつるはし': { muddy_iron: 0, soft_copper: 0, brittle_lead: 0, light_coal: 0, quality_iron: 0, tin: 0, silver: 20, gold: 30, steel: 25, sanctuary_gem: 25 },
};

export const getOreRarityTier = (oreId: OreData['id']): OreRarityTier => {
  if (oreId === 'sanctuary_gem') return 'topRare';
  if (oreId === 'gold') return 'highRare';
  if (oreId === 'quality_iron' || oreId === 'tin' || oreId === 'silver' || oreId === 'steel') return 'mediumRare';
  return 'normal';
};

export const getMiningPerformanceBonus = (miningGauge: number, fullCombo: boolean): MiningPerformanceBonus => {
  if (miningGauge >= 95) {
    return {
      mediumRareMultiplier: 1.15 * (fullCombo ? 1.05 : 1),
      highRareMultiplier: 1.05 * (fullCombo ? 1.03 : 1),
      topRareMultiplier: 1.02,
      label: fullCombo ? '大＋FULL COMBO' : '大',
    };
  }
  if (miningGauge >= 80) {
    return {
      mediumRareMultiplier: 1.1 * (fullCombo ? 1.05 : 1),
      highRareMultiplier: 1.03 * (fullCombo ? 1.03 : 1),
      topRareMultiplier: 1,
      label: '中',
    };
  }
  if (miningGauge >= 50) {
    return {
      mediumRareMultiplier: 1.05 * (fullCombo ? 1.05 : 1),
      highRareMultiplier: fullCombo ? 1.03 : 1,
      topRareMultiplier: 1,
      label: '小',
    };
  }
  return {
    mediumRareMultiplier: fullCombo ? 1.05 : 1,
    highRareMultiplier: fullCombo ? 1.03 : 1,
    topRareMultiplier: 1,
    label: 'なし',
  };
};

export const getMiningRareChanceLabel = (miningGauge: number, fullCombo: boolean): MiningPerformanceBonus['label'] => {
  if (miningGauge >= 95) return fullCombo ? '大＋FULL COMBO' : '大';
  if (miningGauge >= 80) return '中';
  if (miningGauge >= 50) return '小';
  return 'なし';
};

export const getMiningRewardQuantity = (oreId: OreData['id'], miningGauge: number): number => {
  const rarity = getOreRarityTier(oreId);
  if (rarity === 'highRare' || rarity === 'topRare') return 1;
  if (rarity === 'mediumRare') return miningGauge >= 95 ? 2 : 1;
  if (miningGauge >= 95) return 3;
  if (miningGauge >= 80) return 2;
  return 1;
};

export const getMiningWeightMultiplier = (miningGauge: number, fullCombo: boolean): number => {
  const baseMultiplier = miningGauge >= 95
    ? 1.2
    : miningGauge >= 80
      ? 1.1
      : miningGauge >= 50
        ? 1
        : 0.8;
  return baseMultiplier + (fullCombo ? 0.05 : 0);
};

export const isPickaxeName = (name: string): name is PickaxeName => PICKAXE_RANKS.includes(toBaseItemName(name) as PickaxeName);

export const getHighestOwnedPickaxe = (
  equippedItems: Readonly<Record<string, string>>,
  inventoryCounts: Readonly<Record<string, number>>,
): PickaxeName => {
  const candidates = [
    ...Object.values(equippedItems).map(toBaseItemName).filter(isPickaxeName),
    ...PICKAXE_RANKS.filter(name => getItemCountIncludingDebug(inventoryCounts, name) > 0),
  ];
  return candidates.reduce<PickaxeName>((highest, pickaxe) => (
    PICKAXE_RANKS.indexOf(pickaxe) > PICKAXE_RANKS.indexOf(highest) ? pickaxe : highest
  ), 'つるはし');
};

export const selectOreReward = (pickaxe: PickaxeName, random = Math.random): OreData => {
  const weighted = ORE_DATA.map(ore => ({ ore, weight: PICKAXE_ORE_WEIGHTS[pickaxe][ore.id] ?? 0 })).filter(entry => entry.weight > 0);
  let roll = random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.ore;
  }
  return weighted[weighted.length - 1]?.ore ?? ORE_DATA[0];
};

export const selectOreRewardWithPerformance = (
  pickaxe: PickaxeName,
  miningGauge: number,
  fullCombo: boolean,
  rareRateMultiplier = 1,
  random = Math.random,
): OreData => {
  const bonus = getMiningPerformanceBonus(miningGauge, fullCombo);
  const weighted = ORE_DATA.map(ore => {
    const baseWeight = PICKAXE_ORE_WEIGHTS[pickaxe][ore.id] ?? 0;
    if (baseWeight <= 0) return { ore, weight: 0 };
    const rarity = getOreRarityTier(ore.id);
    const skillMultiplier = rarity === 'normal' ? 1 : rareRateMultiplier;
    const multiplier = rarity === 'topRare'
      ? bonus.topRareMultiplier
      : rarity === 'highRare'
        ? bonus.highRareMultiplier
        : rarity === 'mediumRare'
          ? bonus.mediumRareMultiplier
          : 1;
    return { ore, weight: baseWeight * multiplier * skillMultiplier };
  }).filter(entry => entry.weight > 0);
  let roll = random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.ore;
  }
  return weighted[weighted.length - 1]?.ore ?? ORE_DATA[0];
};

export const createOreWeight = (ore: OreData, random = Math.random): number => (
  Math.round(ore.minWeight + (ore.maxWeight - ore.minWeight) * random())
);

export const getOreQualityMultiplier = (ore: OreData, weight: number): number => {
  const ratio = ore.maxWeight <= ore.minWeight ? 1 : Math.max(0, Math.min(1, (weight - ore.minWeight) / (ore.maxWeight - ore.minWeight)));
  return MIN_ORE_QUALITY_MULTIPLIER + (MAX_ORE_QUALITY_MULTIPLIER - MIN_ORE_QUALITY_MULTIPLIER) * ratio;
};

export const getOreQualityPercent = (ore: OreData, weight: number): number => (
  Math.round(getOreQualityMultiplier(ore, weight) * 100)
);

export const getOreSellPrice = (ore: OreData, weight: number): number => {
  return Math.round(ore.baseSellPrice * getOreQualityMultiplier(ore, weight));
};
