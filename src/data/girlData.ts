export type GirlUnlockTier = 'initial' | 'mid' | 'final';

export type GirlRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type GirlTrustMilestone = 50 | 100;

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

export type CompanionSpeechMoment = 'morning' | 'harvest' | 'tired';

export const COMPANION_SPEECH_LINES: Readonly<Record<string, Readonly<Record<CompanionSpeechMoment, readonly string[]>>>> = {
  chibiichi: {
    morning: ['お兄ちゃん、今日もいっしょに行こっ♪'],
    harvest: ['わぁ、甘そうに育ったね！'],
    tired: ['つかれたら、ちびいちがぎゅってしてあげるね'],
  },
  kabune: {
    morning: ['さ、畑を見回るよ。遅れないで'],
    harvest: ['いい出来だね。土の声をちゃんと聞けてる'],
    tired: ['無理は禁物。休むのも仕事のうちだよ'],
  },
  caro: {
    morning: ['今日もダッシュでがんばろー！'],
    harvest: ['やった！元気いっぱいの収穫だね！'],
    tired: ['あと少しだけど、倒れたらダメだからねっ'],
  },
  cure: {
    morning: ['体調管理も作業効率の一部です'],
    harvest: ['品質は安定。良い傾向ですね'],
    tired: ['疲労が見えます。休息を推奨します'],
  },
  mel: {
    morning: ['ふふ、今日の畑も優しい香りがします'],
    harvest: ['大切に育てた気持ち、伝わっていますね'],
    tired: ['夜風が冷えます。そろそろ戻りましょう'],
  },
  momona: {
    morning: ['ねぇねぇ、今日はどこに連れてってくれるの？'],
    harvest: ['すごぉい、甘くて幸せな実りだね♪'],
    tired: ['もう少し一緒にいたいけど、休まなきゃだよ？'],
  },
  nazuna: {
    morning: ['今日も静かに、でもしっかり頑張るね'],
    harvest: ['きれいに育ってる……うれしい'],
    tired: ['疲れてない？無理してたら、すぐ分かるよ'],
  },
  pan: {
    morning: ['今日もお腹いっぱい働こっか♪'],
    harvest: ['ほくほくの収穫だね、料理したくなっちゃう'],
    tired: ['お腹すいた？帰ったら何か作ろうか'],
  },
  puti: {
    morning: ['ふふ、今日は刺激的な一日になりそうね'],
    harvest: ['悪くない実りね。もっと欲張ってもいいわよ'],
    tired: ['限界まで頑張る顔も、嫌いじゃないけどね'],
  },
  roma: {
    morning: ['畑の螺旋が、今日の流れを示している'],
    harvest: ['収穫とは、形になった時間の証明だね'],
    tired: ['夜は思考が深くなる。だが身体は休ませよう'],
  },
  ruby: {
    morning: ['今日も燃えていくわよ！'],
    harvest: ['いいじゃない！真っ赤に誇れる出来ね！'],
    tired: ['へばる前に言いなさいよ。支えてあげるから'],
  },
  saffy: {
    morning: ['朝露が美しいですね。参りましょう'],
    harvest: ['丁寧な手入れが、実りに宿っています'],
    tired: ['疲労を重ねるのは美しくありません。休みましょう'],
  },
  shiro: {
    morning: ['今日もそばにいていいですか？'],
    harvest: ['まっすぐ育ってくれて……よかった'],
    tired: ['無理しないで。あなたが倒れたら悲しいです'],
  },
  theta: {
    morning: ['畑仕事なら任せて。手を汚すのは好きだから'],
    harvest: ['うん、いい根っこしてる。これは強いよ'],
    tired: ['今日はここまでにしよ。明日の土も待ってる'],
  },
  viola: {
    morning: ['ふふ、今日も私を退屈させないでね'],
    harvest: ['いい実りね。あなたの手つき、上達してるわ'],
    tired: ['頑張りすぎ。少しは私に甘えてもいいのよ'],
  },
};

const TRUST_MILESTONES: readonly GirlTrustMilestone[] = [50, 100];
const TRUST_EVENT_LABELS: Readonly<Record<string, readonly string[]>> = {
  chibiichi: ['甘い香りの約束', '真っ赤な実りの日'],
  mel: ['完熟を待つ午後', '甘い果肉の誓い'],
  ruby: ['夕焼けトマト畑', 'ルビー色の約束'],
  viola: ['紫の秘密', '熟成する想い'],
  nazuna: ['雨上がりの足跡', 'やわらかな実り'],
  kabune: ['白い根の贈り物', '抜けない絆'],
  caro: ['夕暮れレース', 'まっすぐな気持ち'],
  theta: ['木陰の研究会', '静かな森の絆'],
  cure: ['夏夜の涼風', '潤いの約束'],
  shiro: ['白月の守り', 'まっ白な誓い'],
  momona: ['秘密の果樹園', '桃色の未来'],
  pan: ['収穫祭の準備', '黄金色の馬車'],
  puti: ['熱帯夜の約束', '竜果の契り'],
  roma: ['螺旋の秘密', '永遠のロマネスコ'],
  saffy: ['黄金の取引', '幸運の花糸'],
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
