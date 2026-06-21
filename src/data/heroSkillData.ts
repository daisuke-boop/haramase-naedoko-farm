export type HeroSkillCategory = 'battle' | 'farm' | 'gather' | 'companion' | 'special';

export type HeroSkillEffectType =
  | 'heroHpPercent'
  | 'beastDamagePercent'
  | 'damageReductionPercent'
  | 'harvestAmountPercent'
  | 'sellPricePercent'
  | 'interestReductionPercent'
  | 'fishingRarePercent'
  | 'miningRarePercent'
  | 'lumberRarePercent'
  | 'companionTrustGainPercent'
  | 'companionHarvestPenaltyReductionPercent'
  | 'specialStateRecoveryBonus'
  | 'unlockHybridCultivation';

export type HeroSkillData = {
  id: string;
  name: string;
  category: HeroSkillCategory;
  costSP: number;
  description: string;
  effectType: HeroSkillEffectType;
  effectValue: number;
  maxRank: number;
  requiredHeroLevel: number;
  requiredSkillIds: readonly string[];
  isHidden: boolean;
};

export const HERO_SKILL_CATEGORY_LABELS: Readonly<Record<HeroSkillCategory, string>> = {
  battle: '戦闘',
  farm: '農場',
  gather: '採集',
  companion: '同行',
  special: '特殊',
};

export const HERO_SKILL_CATEGORIES: readonly HeroSkillCategory[] = [
  'battle',
  'farm',
  'gather',
  'companion',
  'special',
];

export const HERO_SKILL_DATA: readonly HeroSkillData[] = [
  { id: 'battle_hp_up', name: '頑丈な身体', category: 'battle', costSP: 2, description: '最大HPを増加する。', effectType: 'heroHpPercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'battle_beast_damage_up', name: '獣狩り', category: 'battle', costSP: 2, description: '獣へのダメージを増加する。', effectType: 'beastDamagePercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'battle_damage_reduce', name: '守りの心得', category: 'battle', costSP: 2, description: '受けるダメージを軽減する。', effectType: 'damageReductionPercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'farm_harvest_up', name: '農場知識', category: 'farm', costSP: 2, description: '収穫量を増加する。', effectType: 'harvestAmountPercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'farm_sell_up', name: '商売上手', category: 'farm', costSP: 2, description: '売値を増加する。', effectType: 'sellPricePercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'farm_interest_down', name: '交渉術', category: 'farm', costSP: 2, description: '金利を軽減する。', effectType: 'interestReductionPercent', effectValue: 0.3, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'gather_fishing_rare_up', name: '釣り名人', category: 'gather', costSP: 2, description: '釣りのレア率を増加する。', effectType: 'fishingRarePercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'gather_mining_rare_up', name: '採掘知識', category: 'gather', costSP: 2, description: '採掘のレア率を増加する。', effectType: 'miningRarePercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'gather_lumber_rare_up', name: '伐採知識', category: 'gather', costSP: 2, description: '伐採のレア率を増加する。', effectType: 'lumberRarePercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'companion_trust_up', name: '仲間想い', category: 'companion', costSP: 3, description: '同行娘の信頼度上昇を補助する。', effectType: 'companionTrustGainPercent', effectValue: 50, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'companion_harvest_penalty_down', name: '畑を任せる心得', category: 'companion', costSP: 3, description: '同行中の収穫ペナルティを軽減する。', effectType: 'companionHarvestPenaltyReductionPercent', effectValue: 25, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'special_life_understanding', name: '生命の理解', category: 'special', costSP: 3, description: '特殊状態の回復を補助する。', effectType: 'specialStateRecoveryBonus', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false },
  { id: 'special_hybrid_cultivation', name: '混合育成', category: 'special', costSP: 5, description: '特殊植物の解放に備える。', effectType: 'unlockHybridCultivation', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['special_life_understanding'], isHidden: false },
];

export const getHeroSkillById = (id: string): HeroSkillData | undefined => HERO_SKILL_DATA.find(skill => skill.id === id);

export const getHeroSkillsByCategory = (category: HeroSkillCategory): readonly HeroSkillData[] => (
  HERO_SKILL_DATA.filter(skill => skill.category === category)
);
