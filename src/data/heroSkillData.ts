export type HeroSkillCategory = 'battle' | 'farm' | 'gather' | 'companion' | 'special';

export type HeroSkillEffectType =
  | 'heroHpPercent'
  | 'beastDamagePercent'
  | 'damageReductionPercent'
  | 'nurseryGrowthSupport'
  | 'qualityDailyCapBonus'
  | 'fertilizerGrowthCapBonus'
  | 'harvestAmountPercent'
  | 'sellPricePercent'
  | 'interestReductionPercent'
  | 'gatheringPointRevealNearby'
  | 'gatheringPointRevealAll'
  | 'gatheringMinSizePercent'
  | 'fishingRarePercent'
  | 'miningRarePercent'
  | 'lumberRarePercent'
  | 'companionTrustGainPercent'
  | 'companionHarvestPenaltyReductionPercent'
  | 'companionBattleSupportMaxUses'
  | 'enemyAttackDownTrap'
  | 'enemyDefenseDownTrap'
  | 'companionRegenPerTurn'
  | 'specialStateRecoveryBonus'
  | 'unlockHybridCultivation'
  | 'hybridSuccessPercent'
  | 'hybridBlessing';

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
  /** UI専用の接続。効果・取得判定には使わない。 */
  treeParentIds: readonly string[];
  treeColumn: number;
  treeRow: number;
  icon: string;
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
  { id: 'battle_hp_up', name: '体力強化', category: 'battle', costSP: 2, description: '最大HP +10%', effectType: 'heroHpPercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false, treeParentIds: [], treeColumn: 0, treeRow: 2, icon: '♥' },
  { id: 'battle_damage_reduce', name: '防御術', category: 'battle', costSP: 2, description: '被ダメージ -10%', effectType: 'damageReductionPercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['battle_hp_up'], isHidden: false, treeParentIds: ['battle_hp_up'], treeColumn: 1, treeRow: 2, icon: '🛡' },
  { id: 'battle_enemy_attack_down_trap', name: '足くくり罠', category: 'battle', costSP: 2, description: '戦闘開始時に1回だけ、敵攻撃力 -10%', effectType: 'enemyAttackDownTrap', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['battle_damage_reduce'], isHidden: false, treeParentIds: ['battle_damage_reduce'], treeColumn: 2, treeRow: 1, icon: '⌁' },
  { id: 'battle_enemy_defense_down_trap', name: '電撃罠', category: 'battle', costSP: 2, description: '戦闘開始時に1回だけ、敵防御力 -10%', effectType: 'enemyDefenseDownTrap', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['battle_enemy_attack_down_trap'], isHidden: false, treeParentIds: ['battle_enemy_attack_down_trap'], treeColumn: 3, treeRow: 1, icon: '⚡' },
  { id: 'battle_beast_damage_up', name: '獣狩り', category: 'battle', costSP: 2, description: '獣への与ダメージ +10%', effectType: 'beastDamagePercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['battle_damage_reduce'], isHidden: false, treeParentIds: ['battle_damage_reduce'], treeColumn: 2, treeRow: 3, icon: '⚔' },
  { id: 'battle_companion_regen', name: '母乳分泌促進', category: 'battle', costSP: 2, description: '同行娘がいる間、毎ターン主人公HPを 3〜5 回復', effectType: 'companionRegenPerTurn', effectValue: 4, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['battle_beast_damage_up'], isHidden: false, treeParentIds: ['battle_beast_damage_up'], treeColumn: 3, treeRow: 3, icon: '✚' },
  { id: 'farm_seedling_care', name: '育苗術', category: 'farm', costSP: 1, description: '苗娘植え付け時の品質+5', effectType: 'nurseryGrowthSupport', effectValue: 0, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false, treeParentIds: [], treeColumn: 0, treeRow: 2, icon: '🌱' },
  { id: 'farm_quality_eye', name: '品質眼', category: 'farm', costSP: 1, description: '品質・売値情報などを表示', effectType: 'qualityDailyCapBonus', effectValue: 0, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_seedling_care'], isHidden: false, treeParentIds: ['farm_seedling_care'], treeColumn: 1, treeRow: 2, icon: '◎' },
  { id: 'farm_caress', name: '愛撫術', category: 'farm', costSP: 2, description: '苗娘のお手入れ【愛撫】を1日2回可能にする。2回目は品質上昇50%', effectType: 'qualityDailyCapBonus', effectValue: 0, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_quality_eye'], isHidden: false, treeParentIds: ['farm_quality_eye'], treeColumn: 2, treeRow: 1, icon: '✋' },
  { id: 'farm_fingering', name: '指技', category: 'farm', costSP: 3, description: '苗娘のお手入れ【指入れ】を1日2回可能にする。2回目は品質上昇50%', effectType: 'qualityDailyCapBonus', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_caress'], isHidden: false, treeParentIds: ['farm_caress'], treeColumn: 3, treeRow: 1, icon: '☝' },
  { id: 'farm_abstinence', name: 'オナ禁', category: 'farm', costSP: 3, description: '収穫5日以上の苗で、肥料注入の上限回数を 1 → 2回', effectType: 'fertilizerGrowthCapBonus', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_fingering'], isHidden: false, treeParentIds: ['farm_fingering'], treeColumn: 4, treeRow: 1, icon: '✦' },
  { id: 'farm_harvest_up', name: '収穫術', category: 'farm', costSP: 2, description: '収穫量 +5%', effectType: 'harvestAmountPercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_quality_eye'], isHidden: false, treeParentIds: ['farm_quality_eye'], treeColumn: 2, treeRow: 3, icon: '🌾' },
  { id: 'farm_sell_up', name: '商才', category: 'farm', costSP: 3, description: '作物売値 +8%', effectType: 'sellPricePercent', effectValue: 8, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_harvest_up'], isHidden: false, treeParentIds: ['farm_harvest_up'], treeColumn: 3, treeRow: 3, icon: '¥' },
  { id: 'farm_interest_down', name: '交渉術', category: 'farm', costSP: 3, description: '返済金利 -0.3%', effectType: 'interestReductionPercent', effectValue: 0.3, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['farm_sell_up'], isHidden: false, treeParentIds: ['farm_sell_up'], treeColumn: 4, treeRow: 3, icon: '✦' },
  { id: 'gather_fishing_rare_up', name: '探索の勘 I', category: 'gather', costSP: 1, description: '釣り・採掘・伐採地点に近づくとアイコン表示', effectType: 'gatheringPointRevealNearby', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false, treeParentIds: [], treeColumn: 0, treeRow: 2, icon: '🎣' },
  { id: 'gather_mining_rare_up', name: '探索の勘 II', category: 'gather', costSP: 2, description: '全採集地点のアイコン表示', effectType: 'gatheringPointRevealAll', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['gather_fishing_rare_up'], isHidden: false, treeParentIds: ['gather_fishing_rare_up'], treeColumn: 1, treeRow: 2, icon: '⛏' },
  { id: 'gather_lumber_rare_up', name: '採集の目利き', category: 'gather', costSP: 4, description: '釣り・採掘・伐採のレア率を各 +5%', effectType: 'lumberRarePercent', effectValue: 5, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['gather_mining_rare_up'], isHidden: false, treeParentIds: ['gather_mining_rare_up'], treeColumn: 2, treeRow: 2, icon: '🪓' },
  { id: 'gather_tool_care', name: '道具の手入れ', category: 'gather', costSP: 5, description: '取得する魚サイズ・鉱石重量・木材サイズの最低値を10%アップ', effectType: 'gatheringMinSizePercent', effectValue: 10, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['gather_lumber_rare_up'], isHidden: false, treeParentIds: ['gather_lumber_rare_up'], treeColumn: 3, treeRow: 2, icon: '🔧' },
  { id: 'companion_trust_up', name: '信頼術', category: 'companion', costSP: 2, description: '同行娘の信頼度獲得量 +25%', effectType: 'companionTrustGainPercent', effectValue: 25, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false, treeParentIds: [], treeColumn: 0, treeRow: 2, icon: '♡' },
  { id: 'companion_harvest_penalty_down', name: '足並み揃え', category: 'companion', costSP: 2, description: '同行中の収穫ペナルティを軽減', effectType: 'companionHarvestPenaltyReductionPercent', effectValue: 25, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['companion_trust_up'], isHidden: false, treeParentIds: ['companion_trust_up'], treeColumn: 1, treeRow: 2, icon: '♧' },
  { id: 'companion_battle_support', name: '共闘術', category: 'companion', costSP: 2, description: '同行時の戦闘支援、最大発動回数 +1', effectType: 'companionBattleSupportMaxUses', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['companion_harvest_penalty_down'], isHidden: false, treeParentIds: ['companion_harvest_penalty_down'], treeColumn: 2, treeRow: 2, icon: '♢' },
  { id: 'special_life_understanding', name: '生命理解', category: 'special', costSP: 2, description: '看病のAP消費を0。放置時の傷つき回復を3日→2日', effectType: 'specialStateRecoveryBonus', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: [], isHidden: false, treeParentIds: [], treeColumn: 0, treeRow: 2, icon: '✚' },
  { id: 'special_hybrid_cultivation', name: '混合育成', category: 'special', costSP: 3, description: 'NTR後、混合育成の選択肢を解放', effectType: 'unlockHybridCultivation', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['special_life_understanding'], isHidden: false, treeParentIds: ['special_life_understanding'], treeColumn: 1, treeRow: 2, icon: '✺' },
  { id: 'special_adaptation_research', name: '適応研究', category: 'special', costSP: 2, description: '混合育成成功率 65% → 80%', effectType: 'hybridSuccessPercent', effectValue: 15, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['special_hybrid_cultivation'], isHidden: false, treeParentIds: ['special_hybrid_cultivation'], treeColumn: 2, treeRow: 2, icon: '✧' },
  { id: 'special_hybrid_blessing', name: '交雑の恵み', category: 'special', costSP: 5, description: '混合育成に成功した苗娘に交雑適性を付与：作物売値 +15%、品質最低値60', effectType: 'hybridBlessing', effectValue: 1, maxRank: 1, requiredHeroLevel: 1, requiredSkillIds: ['special_adaptation_research'], isHidden: false, treeParentIds: ['special_adaptation_research'], treeColumn: 3, treeRow: 2, icon: '✹' },
];

export const getHeroSkillById = (id: string): HeroSkillData | undefined => HERO_SKILL_DATA.find(skill => skill.id === id);

export const getHeroSkillsByCategory = (category: HeroSkillCategory): readonly HeroSkillData[] => (
  HERO_SKILL_DATA.filter(skill => skill.category === category)
);
