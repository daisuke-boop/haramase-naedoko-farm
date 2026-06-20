export type PickaxeName = 'つるはし' | '丈夫なつるはし' | '高級つるはし' | '伝説のつるはし';

export type OreData = {
  id: string;
  name: string;
  minWeight: number;
  maxWeight: number;
  basePriceMin: number;
  basePriceMax: number;
};

export const sellPriceMultiplier = 100;
export const TEMP_MINING_LIMIT_PER_TIME_SLOT = 3;

export const ORE_DATA: readonly OreData[] = [
  { id: 'muddy_iron', name: '泥混じりの鉄鉱石', minWeight: 500, maxWeight: 2000, basePriceMin: 50, basePriceMax: 200 },
  { id: 'soft_copper', name: '軟らかい銅鉱石', minWeight: 500, maxWeight: 2000, basePriceMin: 60, basePriceMax: 240 },
  { id: 'brittle_lead', name: '脆い鉛鉱石', minWeight: 500, maxWeight: 2000, basePriceMin: 70, basePriceMax: 280 },
  { id: 'light_coal', name: '軽石炭', minWeight: 100, maxWeight: 1000, basePriceMin: 40, basePriceMax: 160 },
  { id: 'quality_iron', name: '良質な鉄鉱石', minWeight: 1000, maxWeight: 5000, basePriceMin: 300, basePriceMax: 1200 },
  { id: 'tin', name: '錫鉱石', minWeight: 1000, maxWeight: 5000, basePriceMin: 400, basePriceMax: 1600 },
  { id: 'silver', name: '銀鉱石', minWeight: 1000, maxWeight: 5000, basePriceMin: 500, basePriceMax: 2000 },
  { id: 'gold', name: '金鉱石', minWeight: 2000, maxWeight: 8000, basePriceMin: 2000, basePriceMax: 20000 },
  { id: 'steel', name: '鋼鉄石', minWeight: 2000, maxWeight: 8000, basePriceMin: 1500, basePriceMax: 8000 },
  { id: 'sanctuary_gem', name: '聖域の輝石', minWeight: 5000, maxWeight: 10000, basePriceMin: 8000, basePriceMax: 50000 },
] as const;

export const PICKAXE_RANKS: readonly PickaxeName[] = ['つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし'];

export const PICKAXE_ORE_WEIGHTS: Readonly<Record<PickaxeName, Readonly<Record<OreData['id'], number>>>> = {
  'つるはし': { muddy_iron: 35, soft_copper: 30, brittle_lead: 20, light_coal: 15, quality_iron: 0, tin: 0, silver: 0, gold: 0, steel: 0, sanctuary_gem: 0 },
  '丈夫なつるはし': { muddy_iron: 25, soft_copper: 20, brittle_lead: 15, light_coal: 15, quality_iron: 10, tin: 8, silver: 5, gold: 0, steel: 2, sanctuary_gem: 0 },
  '高級つるはし': { muddy_iron: 0, soft_copper: 0, brittle_lead: 0, light_coal: 0, quality_iron: 30, tin: 25, silver: 20, gold: 10, steel: 12, sanctuary_gem: 3 },
  '伝説のつるはし': { muddy_iron: 0, soft_copper: 0, brittle_lead: 0, light_coal: 0, quality_iron: 0, tin: 0, silver: 20, gold: 30, steel: 25, sanctuary_gem: 25 },
};

export const isPickaxeName = (name: string): name is PickaxeName => PICKAXE_RANKS.includes(name as PickaxeName);

export const getHighestOwnedPickaxe = (
  equippedItems: Readonly<Record<string, string>>,
  inventoryCounts: Readonly<Record<string, number>>,
): PickaxeName => {
  const candidates = [
    ...Object.values(equippedItems).filter(isPickaxeName),
    ...PICKAXE_RANKS.filter(name => (inventoryCounts[name] ?? 0) > 0),
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

export const createOreWeight = (ore: OreData, random = Math.random): number => (
  Math.round(ore.minWeight + (ore.maxWeight - ore.minWeight) * random())
);

export const getOreSellPrice = (ore: OreData, weight: number): number => {
  const ratio = ore.maxWeight <= ore.minWeight ? 1 : Math.max(0, Math.min(1, (weight - ore.minWeight) / (ore.maxWeight - ore.minWeight)));
  const basePrice = ore.basePriceMin + (ore.basePriceMax - ore.basePriceMin) * ratio;
  return Math.round(basePrice * sellPriceMultiplier);
};
