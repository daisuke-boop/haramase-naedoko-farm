export type GirlUnlockTier = 'initial' | 'mid' | 'final';

export type GirlRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type GirlTrustMilestone = 20 | 40 | 60 | 80 | 100;

export type GirlTrustEvent = {
  trust: GirlTrustMilestone;
  eventId: string;
  label: string;
};

export type GirlData = {
  id: string;
  cropName: string;
  girlName: string;
  unlockTier: GirlUnlockTier;
  initialTrust: number;
  combatRole: string;
  farmRole: string;
  rarity: GirlRarity;
  trustEvents: readonly GirlTrustEvent[];
};

export type GirlTrustEventUnlockState = {
  unlockedTrustEventIds: string[];
};

const createTrustEvents = (girlId: string): readonly GirlTrustEvent[] => [
  { trust: 20, eventId: `${girlId}_trust_20`, label: '初めて心を開く' },
  { trust: 40, eventId: `${girlId}_trust_40`, label: '日常イベント' },
  { trust: 60, eventId: `${girlId}_trust_60`, label: '固有スキル解放イベント' },
  { trust: 80, eventId: `${girlId}_trust_80`, label: '特別な関係イベント' },
  { trust: 100, eventId: `${girlId}_trust_100`, label: '恋人イベント' },
];

export const GIRL_DATA: readonly GirlData[] = [
  {
    id: 'chibiichi',
    cropName: 'いちご',
    girlName: 'ちびいち',
    unlockTier: 'initial',
    initialTrust: 0,
    combatRole: '序盤向けサポート',
    farmRole: '信頼上昇が早い',
    rarity: 'common',
    trustEvents: createTrustEvents('chibiichi'),
  },
  {
    id: 'mel',
    cropName: 'メロン',
    girlName: 'メル',
    unlockTier: 'initial',
    initialTrust: 0,
    combatRole: '防御・安定型',
    farmRole: '農場の安定補助',
    rarity: 'common',
    trustEvents: createTrustEvents('mel'),
  },
  {
    id: 'ruby',
    cropName: 'トマト',
    girlName: 'ルビー',
    unlockTier: 'initial',
    initialTrust: 0,
    combatRole: '攻守バランス型',
    farmRole: '収穫量アップ',
    rarity: 'common',
    trustEvents: createTrustEvents('ruby'),
  },
  {
    id: 'viola',
    cropName: 'ブドウ',
    girlName: 'ヴィオラ',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '後方支援',
    farmRole: '売値アップ',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('viola'),
  },
  {
    id: 'nazuna',
    cropName: 'なす',
    girlName: 'ナズナ',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '戦闘補助',
    farmRole: '畑作業補助',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('nazuna'),
  },
  {
    id: 'kabune',
    cropName: 'かぶ',
    girlName: 'かぶね',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '回復・農場維持',
    farmRole: '農場維持',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('kabune'),
  },
  {
    id: 'caro',
    cropName: 'にんじん',
    girlName: 'キャロ',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '素早さ・探索',
    farmRole: '探索効率補助',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('caro'),
  },
  {
    id: 'theta',
    cropName: 'しいたけ',
    girlName: 'シータ',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '素材ドロップ補助',
    farmRole: '素材ドロップ補助',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('theta'),
  },
  {
    id: 'cure',
    cropName: 'きゅうり',
    girlName: 'キュア',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '状態異常回復',
    farmRole: '農場コンディション補助',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('cure'),
  },
  {
    id: 'shiro',
    cropName: 'だいこん',
    girlName: 'シロ',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '防御・被害軽減',
    farmRole: '被害軽減',
    rarity: 'uncommon',
    trustEvents: createTrustEvents('shiro'),
  },
  {
    id: 'momona',
    cropName: 'もも',
    girlName: 'ももな',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: '信頼度ボーナス',
    farmRole: '信頼度ボーナス',
    rarity: 'rare',
    trustEvents: createTrustEvents('momona'),
  },
  {
    id: 'pan',
    cropName: 'かぼちゃ',
    girlName: 'パン',
    unlockTier: 'mid',
    initialTrust: 0,
    combatRole: 'HP・防御補助',
    farmRole: '農場耐久補助',
    rarity: 'rare',
    trustEvents: createTrustEvents('pan'),
  },
  {
    id: 'puti',
    cropName: 'ドラゴンフルーツ',
    girlName: 'プティ',
    unlockTier: 'final',
    initialTrust: 0,
    combatRole: '高火力支援',
    farmRole: '高額収穫',
    rarity: 'legendary',
    trustEvents: createTrustEvents('puti'),
  },
  {
    id: 'roma',
    cropName: 'ロマネスコ',
    girlName: 'ロマ',
    unlockTier: 'final',
    initialTrust: 0,
    combatRole: 'レア素材率アップ',
    farmRole: 'レア素材率アップ',
    rarity: 'legendary',
    trustEvents: createTrustEvents('roma'),
  },
  {
    id: 'saffy',
    cropName: 'サフラン',
    girlName: 'サフィー',
    unlockTier: 'final',
    initialTrust: 0,
    combatRole: '信用・支援型',
    farmRole: '金利・信用度補助',
    rarity: 'legendary',
    trustEvents: createTrustEvents('saffy'),
  },
] as const;
