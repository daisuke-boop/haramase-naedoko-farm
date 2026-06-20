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

export type BeastDropData = {
  beastId: BeastId;
  drops: readonly string[];
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
  1: { level: 1, hp: 100, attack: 10, defense: 5, speed: 5, cumulativeSp: 0 },
  2: { level: 2, hp: 130, attack: 15, defense: 8, speed: 7, cumulativeSp: 3 },
  3: { level: 3, hp: 170, attack: 22, defense: 12, speed: 9, cumulativeSp: 7 },
  4: { level: 4, hp: 220, attack: 32, defense: 18, speed: 12, cumulativeSp: 12 },
  5: { level: 5, hp: 300, attack: 45, defense: 25, speed: 15, cumulativeSp: 18 },
};

export const BEAST_BATTLE_DATA: readonly BeastBattleData[] = [
  { id: 'mole', name: 'モグラ', hp: 40, attack: 8, defense: 2, speed: 4, difficulty: 'easy' },
  { id: 'rabbit', name: 'ウサギ', hp: 50, attack: 10, defense: 3, speed: 8, difficulty: 'easy' },
  { id: 'monkey', name: '猿', hp: 70, attack: 13, defense: 5, speed: 10, difficulty: 'easy' },
  { id: 'boar', name: '猪', hp: 120, attack: 20, defense: 8, speed: 8, difficulty: 'normal' },
  { id: 'bear', name: '熊', hp: 180, attack: 28, defense: 12, speed: 6, difficulty: 'normal' },
  { id: 'great_fang_beast', name: '大牙の獣', hp: 240, attack: 35, defense: 16, speed: 9, difficulty: 'normal' },
  { id: 'giant_bear', name: '巨熊', hp: 400, attack: 50, defense: 25, speed: 7, difficulty: 'hard' },
  { id: 'mountain_lord', name: '山の主', hp: 650, attack: 70, defense: 35, speed: 12, difficulty: 'hard' },
] as const;

export const BEAST_DROP_DATA: readonly BeastDropData[] = [
  { beastId: 'mole', drops: ['モグラの爪', 'モグラの肉', '小石'] },
  { beastId: 'rabbit', drops: ['鋭い前歯', 'ウサギの靭帯', '綺麗な小石'] },
  { beastId: 'monkey', drops: ['猿の牙', '猿の肉', '光る木の実'] },
  { beastId: 'boar', drops: ['猪の牙', '猪の肉', '猪の硬皮'] },
  { beastId: 'bear', drops: ['熊の爪', '熊の剛糸', '熊の胆石'] },
  { beastId: 'great_fang_beast', drops: ['鋭い牙', '獣の丈夫な筋', '鋭い爪'] },
  { beastId: 'giant_bear', drops: ['巨獣の鋼角', '巨獣の強剛糸', '聖域の結晶'] },
  { beastId: 'mountain_lord', drops: ['神獣の角', '神獣の絹糸', '伝説の雫'] },
] as const;

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
    bonus: { attack: 12, criticalRate: 10, beastDamageBonus: 10 },
  },
  {
    id: 'heaven_judgment',
    name: '天の裁き',
    type: 'weapon',
    bonus: { attack: 25, criticalRate: 20, beastDamageBonus: 25 },
  },
  {
    id: 'fur_clothes',
    name: '毛皮の服',
    type: 'armor',
    bonus: { defense: 4, hp: 20 },
  },
  {
    id: 'hard_fang_armor',
    name: '剛牙の鎧',
    type: 'armor',
    bonus: { defense: 12, hp: 50, beastDamageReduction: 10 },
  },
  {
    id: 'sanctuary_blessing',
    name: '神域の加護',
    type: 'armor',
    bonus: { defense: 20, hp: 100, statusAilmentResistance: true },
  },
] as const;
