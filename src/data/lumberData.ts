export type SawName = 'のこぎり' | '丈夫なのこぎり' | '高級のこぎり' | '伝説ののこぎり';

export type LumberData = {
  id: string;
  name: string;
  minSize: number;
  maxSize: number;
  basePriceMin: number;
  basePriceMax: number;
};

export const LUMBER_DATA: readonly LumberData[] = [
  { id: 'young_branch', name: '柔らかな若枝', minSize: 10, maxSize: 50, basePriceMin: 30, basePriceMax: 120 },
  { id: 'softwood', name: 'しなやかな軟木', minSize: 30, maxSize: 100, basePriceMin: 50, basePriceMax: 200 },
  { id: 'medium_wood', name: '堅実な中木', minSize: 50, maxSize: 120, basePriceMin: 200, basePriceMax: 800 },
  { id: 'hardwood', name: '重厚な硬木', minSize: 50, maxSize: 120, basePriceMin: 300, basePriceMax: 1200 },
  { id: 'ironwood', name: '不朽の鉄木', minSize: 100, maxSize: 140, basePriceMin: 1500, basePriceMax: 6000 },
  { id: 'ancient_tree', name: '古代の神木', minSize: 100, maxSize: 160, basePriceMin: 2000, basePriceMax: 15000 },
] as const;

export const sellPriceMultiplier = 100;

export const SAW_RANKS: readonly SawName[] = [
  'のこぎり',
  '丈夫なのこぎり',
  '高級のこぎり',
  '伝説ののこぎり',
];

export const SAW_LUMBER_WEIGHTS: Readonly<Record<SawName, Readonly<Record<LumberData['id'], number>>>> = {
  'のこぎり': {
    young_branch: 100, softwood: 0, medium_wood: 0, hardwood: 0, ironwood: 0, ancient_tree: 0,
  },
  '丈夫なのこぎり': {
    young_branch: 65, softwood: 30, medium_wood: 5, hardwood: 0, ironwood: 0, ancient_tree: 0,
  },
  '高級のこぎり': {
    young_branch: 35, softwood: 25, medium_wood: 20, hardwood: 15, ironwood: 4, ancient_tree: 1,
  },
  '伝説ののこぎり': {
    young_branch: 15, softwood: 15, medium_wood: 20, hardwood: 20, ironwood: 20, ancient_tree: 10,
  },
};

export const isSawName = (name: string): name is SawName => SAW_RANKS.includes(name as SawName);

export const getHighestOwnedSaw = (
  equippedItems: Readonly<Record<string, string>>,
  inventoryCounts: Readonly<Record<string, number>>,
): SawName => {
  const equippedSawNames = Object.values(equippedItems).filter(isSawName);
  const ownedSawNames = SAW_RANKS.filter(name => (inventoryCounts[name] ?? 0) > 0);
  const candidates = [...equippedSawNames, ...ownedSawNames];
  return candidates.reduce<SawName>((highest, saw) => (
    SAW_RANKS.indexOf(saw) > SAW_RANKS.indexOf(highest) ? saw : highest
  ), 'のこぎり');
};

export const selectLumberReward = (sawName: SawName, random = Math.random): LumberData => {
  const weighted = LUMBER_DATA
    .map(lumber => ({ lumber, weight: SAW_LUMBER_WEIGHTS[sawName][lumber.id] ?? 0 }))
    .filter(entry => entry.weight > 0);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * totalWeight;

  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.lumber;
  }

  return weighted[weighted.length - 1]?.lumber ?? LUMBER_DATA[0];
};

export const createLumberSize = (lumber: LumberData, random = Math.random): number => (
  Number((lumber.minSize + (lumber.maxSize - lumber.minSize) * random()).toFixed(1))
);

export const getLumberSellPrice = (lumber: LumberData, size: number): number => {
  if (lumber.maxSize <= lumber.minSize) return Math.round(lumber.basePriceMax * sellPriceMultiplier);
  const sizeRatio = Math.max(0, Math.min(1, (size - lumber.minSize) / (lumber.maxSize - lumber.minSize)));
  const basePrice = lumber.basePriceMin + (lumber.basePriceMax - lumber.basePriceMin) * sizeRatio;
  return Math.round(basePrice * sellPriceMultiplier);
};

export type LumberReward = {
  lumber: LumberData;
  size: number;
};

export const createLumberRewards = (
  sawName: SawName,
  count: number,
  random = Math.random,
): LumberReward[] => Array.from({ length: count }, () => {
  const lumber = selectLumberReward(sawName, random);
  return { lumber, size: createLumberSize(lumber, random) };
});
