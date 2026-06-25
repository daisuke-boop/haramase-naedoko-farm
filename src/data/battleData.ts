import type { GameDifficulty } from './fishingData';

export type HeroBattleLevel = 1 | 2 | 3 | 4 | 5;

export type BattleStats = {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

export type HeroBattleStats = BattleStats & {
  level: HeroBattleLevel;
  cumulativeSp: number;
};

export type BeastId =
  | 'mole'
  | 'rabbit'
  | 'monkey'
  | 'boar'
  | 'bear'
  | 'great_fang_beast'
  | 'giant_bear'
  | 'mountain_lord';

export type BeastBattleData = BattleStats & {
  id: BeastId;
  name: string;
  difficulty: GameDifficulty;
};

export type BeastDropItem = {
  dropItemId: string;
  dropItemName: string;
  dropRate: number;
  dropCountMin: number;
  dropCountMax: number;
  sellPrice: number;
};

export type BeastDropData = {
  beastId: BeastId;
  drops: readonly BeastDropItem[];
};

export type SpSkillCategory =
  | 'attack'
  | 'defense'
  | 'support'
  | 'heal'
  | 'farm'
  | 'daughter';

export type SpSkillCost = {
  sp: number;
};

export type SpSkillDefinition = {
  id: string;
  name: string;
  category: SpSkillCategory;
  cost: SpSkillCost;
  description: string;
};

export type BattleEquipmentType = 'weapon' | 'armor';

export type BattleEquipmentBonus = {
  attack?: number;
  defense?: number;
  hp?: number;
  criticalRate?: number;
  beastDamageBonus?: number;
  beastDamageReduction?: number;
  statusAilmentResistance?: boolean;
};

export type BattleEquipmentData = {
  id: string;
  name: string;
  type: BattleEquipmentType;
  bonus: BattleEquipmentBonus;
};

export const HERO_BATTLE_STATS_BY_LEVEL: Readonly<Record<HeroBattleLevel, HeroBattleStats>> = {
  1: { level: 1, hp: 100, attack: 12, defense: 5, speed: 5, cumulativeSp: 0 },
  2: { level: 2, hp: 125, attack: 17, defense: 8, speed: 7, cumulativeSp: 3 },
  3: { level: 3, hp: 155, attack: 24, defense: 12, speed: 9, cumulativeSp: 7 },
  4: { level: 4, hp: 195, attack: 33, defense: 17, speed: 12, cumulativeSp: 12 },
  5: { level: 5, hp: 245, attack: 43, defense: 23, speed: 15, cumulativeSp: 18 },
};

export const BEAST_BATTLE_DATA: readonly BeastBattleData[] = [
  { id: 'mole', name: 'モグラ', hp: 42, attack: 7, defense: 1, speed: 4, difficulty: 'easy' },
  { id: 'rabbit', name: 'ウサギ', hp: 55, attack: 9, defense: 2, speed: 8, difficulty: 'easy' },
  { id: 'monkey', name: '猿', hp: 78, attack: 12, defense: 4, speed: 10, difficulty: 'easy' },
  { id: 'boar', name: '猪', hp: 90, attack: 14, defense: 5, speed: 8, difficulty: 'normal' },
  { id: 'bear', name: '熊', hp: 140, attack: 19, defense: 8, speed: 6, difficulty: 'normal' },
  { id: 'great_fang_beast', name: '大牙の獣', hp: 190, attack: 24, defense: 11, speed: 9, difficulty: 'normal' },
  { id: 'giant_bear', name: '巨熊', hp: 340, attack: 38, defense: 17, speed: 7, difficulty: 'hard' },
  { id: 'mountain_lord', name: '山の主', hp: 680, attack: 58, defense: 34, speed: 12, difficulty: 'hard' },
] as const;

export const BEAST_DROP_DATA: readonly BeastDropData[] = [
  { beastId: 'mole', drops: [
    { dropItemId: 'mole_claw', dropItemName: 'モグラの爪', dropRate: 0.70, dropCountMin: 1, dropCountMax: 1, sellPrice: 100 },
    { dropItemId: 'mole_meat', dropItemName: 'モグラの肉', dropRate: 0.40, dropCountMin: 1, dropCountMax: 1, sellPrice: 120 },
    { dropItemId: 'pebble', dropItemName: '小石', dropRate: 0.15, dropCountMin: 1, dropCountMax: 1, sellPrice: 80 },
  ] },
  { beastId: 'rabbit', drops: [
    { dropItemId: 'sharp_front_tooth', dropItemName: '鋭い前歯', dropRate: 0.70, dropCountMin: 1, dropCountMax: 1, sellPrice: 150 },
    { dropItemId: 'rabbit_ligament', dropItemName: 'ウサギの靭帯', dropRate: 0.40, dropCountMin: 1, dropCountMax: 1, sellPrice: 180 },
    { dropItemId: 'pretty_pebble', dropItemName: '綺麗な小石', dropRate: 0.15, dropCountMin: 1, dropCountMax: 1, sellPrice: 250 },
  ] },
  { beastId: 'monkey', drops: [
    { dropItemId: 'monkey_fang', dropItemName: '猿の牙', dropRate: 0.70, dropCountMin: 1, dropCountMax: 1, sellPrice: 200 },
    { dropItemId: 'monkey_meat', dropItemName: '猿の肉', dropRate: 0.40, dropCountMin: 1, dropCountMax: 1, sellPrice: 250 },
    { dropItemId: 'glowing_nut', dropItemName: '光る木の実', dropRate: 0.15, dropCountMin: 1, dropCountMax: 1, sellPrice: 400 },
  ] },
  { beastId: 'boar', drops: [
    { dropItemId: 'boar_fang', dropItemName: '猪の牙', dropRate: 0.75, dropCountMin: 1, dropCountMax: 1, sellPrice: 800 },
    { dropItemId: 'boar_meat', dropItemName: '猪の肉', dropRate: 0.45, dropCountMin: 1, dropCountMax: 1, sellPrice: 900 },
    { dropItemId: 'boar_hard_hide', dropItemName: '猪の硬皮', dropRate: 0.20, dropCountMin: 1, dropCountMax: 1, sellPrice: 1_200 },
  ] },
  { beastId: 'bear', drops: [
    { dropItemId: 'bear_claw', dropItemName: '熊の爪', dropRate: 0.75, dropCountMin: 1, dropCountMax: 1, sellPrice: 1_500 },
    { dropItemId: 'bear_strong_thread', dropItemName: '熊の剛糸', dropRate: 0.45, dropCountMin: 1, dropCountMax: 1, sellPrice: 2_000 },
    { dropItemId: 'bear_gallstone', dropItemName: '熊の胆石', dropRate: 0.20, dropCountMin: 1, dropCountMax: 1, sellPrice: 3_000 },
  ] },
  { beastId: 'great_fang_beast', drops: [
    { dropItemId: 'sharp_fang', dropItemName: '鋭い牙', dropRate: 0.75, dropCountMin: 1, dropCountMax: 1, sellPrice: 2_500 },
    { dropItemId: 'beast_tough_sinew', dropItemName: '獣の丈夫な筋', dropRate: 0.45, dropCountMin: 1, dropCountMax: 1, sellPrice: 3_000 },
    { dropItemId: 'sharp_claw', dropItemName: '鋭い爪', dropRate: 0.20, dropCountMin: 1, dropCountMax: 1, sellPrice: 4_000 },
  ] },
  { beastId: 'giant_bear', drops: [
    { dropItemId: 'giant_beast_steel_horn', dropItemName: '巨獣の鋼角', dropRate: 0.80, dropCountMin: 1, dropCountMax: 1, sellPrice: 10_000 },
    { dropItemId: 'giant_beast_strong_thread', dropItemName: '巨獣の強剛糸', dropRate: 0.50, dropCountMin: 1, dropCountMax: 1, sellPrice: 15_000 },
    { dropItemId: 'sanctuary_crystal', dropItemName: '聖域の結晶', dropRate: 0.15, dropCountMin: 1, dropCountMax: 1, sellPrice: 25_000 },
  ] },
  { beastId: 'mountain_lord', drops: [
    { dropItemId: 'divine_beast_horn', dropItemName: '神獣の角', dropRate: 0.80, dropCountMin: 1, dropCountMax: 1, sellPrice: 30_000 },
    { dropItemId: 'divine_beast_silk_thread', dropItemName: '神獣の絹糸', dropRate: 0.40, dropCountMin: 1, dropCountMax: 1, sellPrice: 50_000 },
    { dropItemId: 'legendary_drop', dropItemName: '伝説の雫', dropRate: 0.10, dropCountMin: 1, dropCountMax: 1, sellPrice: 80_000 },
  ] },
] as const;

export const BEAST_DROP_SELL_PRICES: Readonly<Record<string, number>> = Object.fromEntries(
  BEAST_DROP_DATA.flatMap(beast => beast.drops.map(drop => [drop.dropItemName, drop.sellPrice] as const)),
);

export const BATTLE_EQUIPMENT_DATA: readonly BattleEquipmentData[] = [
  {
    id: 'wooden_sword',
    name: '木剣',
    type: 'weapon',
    bonus: { attack: 4 },
  },
  {
    id: 'beast_slayer',
    name: '獣殺し',
    type: 'weapon',
    bonus: { attack: 9, criticalRate: 8, beastDamageBonus: 8 },
  },
  {
    id: 'heaven_judgment',
    name: '天の裁き',
    type: 'weapon',
    bonus: { attack: 16, criticalRate: 15, beastDamageBonus: 15 },
  },
  {
    id: 'fur_clothes',
    name: '毛皮の服',
    type: 'armor',
    bonus: { defense: 3, hp: 15 },
  },
  {
    id: 'hard_fang_armor',
    name: '剛牙の鎧',
    type: 'armor',
    bonus: { defense: 8, hp: 35, beastDamageReduction: 8 },
  },
  {
    id: 'sanctuary_blessing',
    name: '神域の加護',
    type: 'armor',
    bonus: { defense: 13, hp: 65, statusAilmentResistance: true },
  },
] as const;
