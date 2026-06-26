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

const TRUST_MILESTONES: readonly GirlTrustMilestone[] = [20, 40, 60, 80, 100];
const TRUST_EVENT_LABELS: Readonly<Record<string, readonly string[]>> = {
  chibiichi: ['はじめてのいちご摘み', '甘い香りの約束', '小さな手の応援', '内緒のジャム作り', '真っ赤な実りの日'],
  mel: ['木陰のメロン相談', '水やり日和', '涼しい休憩時間', '完熟を待つ夜', '甘い果肉の誓い'],
  ruby: ['赤い実の挨拶', '畑の見回り隊', '夕焼けトマト畑', '情熱の収穫祭', 'ルビー色の約束'],
  viola: ['葡萄棚の出会い', '香りをたどって', '月下の試飲会', '紫の秘密', '熟成する想い'],
  nazuna: ['なす畑の手伝い', '雨上がりの足跡', '台所の作戦会議', '濃紺の夕涼み', 'やわらかな実り'],
  kabune: ['かぶ畑の小さな声', '土の中の宝探し', '白い根の贈り物', '丸い月の晩', '抜けない絆'],
  caro: ['にんじん色の朝', '走れ畑道', '元気印の配達', '夕暮れレース', 'まっすぐな気持ち'],
  theta: ['しいたけ小屋の灯り', '湿った森の約束', '胞子舞う午後', '木陰の研究会', '静かな森の絆'],
  cure: ['きゅうりの水音', '冷たい差し入れ', '畑の看病係', '夏夜の涼風', '潤いの約束'],
  shiro: ['だいこん畑の白い影', '雪色の手紙', '根気くらべ', '白月の守り', 'まっ白な誓い'],
  momona: ['桃色の挨拶', '甘い差し入れ', 'ふわり桃の香り', '秘密の果樹園', '桃色の未来'],
  pan: ['かぼちゃ畑の灯り', 'ころころ収穫日', '大きな実の相談', '収穫祭の準備', '黄金色の馬車'],
  puti: ['竜の果実の目覚め', '南国の風', '棘の向こう側', '熱帯夜の約束', '竜果の契り'],
  roma: ['不思議な渦巻き', '幾何学畑の午後', '緑の迷宮', '螺旋の秘密', '永遠のロマネスコ'],
  saffy: ['金色の香り', '小さな高級品', '朝露のサフラン', '黄金の取引', '幸運の花糸'],
};

const createTrustEvents = (girlId: string): readonly GirlTrustEvent[] => {
  const labels = TRUST_EVENT_LABELS[girlId] ?? ['初めて心を開く', '日常イベント', '固有スキル解放イベント', '特別な関係イベント', '恋人イベント'];
  return TRUST_MILESTONES.map((trust, index) => ({
    trust,
    eventId: `${girlId}_trust_${trust}`,
    label: labels[index] ?? `信頼度${trust}イベント`,
  }));
};

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
    girlName: 'ぱん',
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
    girlName: 'サフィ',
    unlockTier: 'final',
    initialTrust: 0,
    combatRole: '信用・支援型',
    farmRole: '金利・信用度補助',
    rarity: 'legendary',
    trustEvents: createTrustEvents('saffy'),
  },
] as const;
