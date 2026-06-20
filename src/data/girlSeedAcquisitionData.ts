import type { GameDifficulty } from './fishingData';

export type GirlSeedAcquisitionType =
  | 'initialOwned'
  | 'shop'
  | 'materialExchange'
  | 'creditUnlock'
  | 'repaymentUnlock'
  | 'specialEvent';

export type RequiredGirlSeedItem = {
  itemName: string;
  amount: number;
};

export type GirlSeedAcquisitionData = {
  girlId: string;
  seedId: string;
  seedName: string;
  acquisitionType: GirlSeedAcquisitionType;
  unlockDifficulty: GameDifficulty;
  requiredFarmCredit?: number;
  requiredSuccessfulRepayments?: number;
  price?: number;
  requiredItems?: readonly RequiredGirlSeedItem[];
  eventId?: string;
  isRepeatable: false;
};

export type OwnedGirlSeedState = {
  ownedGirlSeeds: string[];
};

export const INITIAL_OWNED_GIRL_SEEDS: readonly string[] = [
  'ichigo',
  'melon',
  'tomato',
];

export const GIRL_SEED_ACQUISITION_DATA: readonly GirlSeedAcquisitionData[] = [
  {
    girlId: 'chibiichi',
    seedId: 'ichigo',
    seedName: 'いちごの娘苗',
    acquisitionType: 'initialOwned',
    unlockDifficulty: 'easy',
    isRepeatable: false,
  },
  {
    girlId: 'mel',
    seedId: 'melon',
    seedName: 'メロンの娘苗',
    acquisitionType: 'initialOwned',
    unlockDifficulty: 'easy',
    isRepeatable: false,
  },
  {
    girlId: 'ruby',
    seedId: 'tomato',
    seedName: 'トマトの娘苗',
    acquisitionType: 'initialOwned',
    unlockDifficulty: 'easy',
    isRepeatable: false,
  },
  {
    girlId: 'viola',
    seedId: 'grape',
    seedName: 'ブドウの娘苗',
    acquisitionType: 'shop',
    unlockDifficulty: 'easy',
    price: 120_000,
    isRepeatable: false,
  },
  {
    girlId: 'nazuna',
    seedId: 'eggplant',
    seedName: 'なすの娘苗',
    acquisitionType: 'materialExchange',
    unlockDifficulty: 'easy',
    requiredItems: [
      { itemName: 'しなやかな軟木', amount: 5 },
      { itemName: '軟らかい銅鉱石', amount: 5 },
      { itemName: 'ウサギの靭帯', amount: 8 },
    ],
    isRepeatable: false,
  },
  {
    girlId: 'kabune',
    seedId: 'turnip',
    seedName: 'かぶの娘苗',
    acquisitionType: 'creditUnlock',
    unlockDifficulty: 'easy',
    requiredFarmCredit: 10,
    isRepeatable: false,
  },
  {
    girlId: 'caro',
    seedId: 'carrot',
    seedName: 'にんじんの娘苗',
    acquisitionType: 'shop',
    unlockDifficulty: 'normal',
    price: 180_000,
    isRepeatable: false,
  },
  {
    girlId: 'theta',
    seedId: 'shiitake',
    seedName: 'しいたけの娘苗',
    acquisitionType: 'materialExchange',
    unlockDifficulty: 'normal',
    requiredItems: [
      { itemName: '堅実な中木', amount: 6 },
      { itemName: '良質な鉄鉱石', amount: 4 },
      { itemName: '猿の牙', amount: 5 },
    ],
    isRepeatable: false,
  },
  {
    girlId: 'cure',
    seedId: 'cucumber',
    seedName: 'きゅうりの娘苗',
    acquisitionType: 'repaymentUnlock',
    unlockDifficulty: 'normal',
    requiredSuccessfulRepayments: 1,
    isRepeatable: false,
  },
  {
    girlId: 'shiro',
    seedId: 'daikon',
    seedName: 'だいこんの娘苗',
    acquisitionType: 'creditUnlock',
    unlockDifficulty: 'normal',
    requiredFarmCredit: 25,
    isRepeatable: false,
  },
  {
    girlId: 'momona',
    seedId: 'peach',
    seedName: 'ももの娘苗',
    acquisitionType: 'specialEvent',
    unlockDifficulty: 'normal',
    eventId: 'momona_seed_unlock',
    isRepeatable: false,
  },
  {
    girlId: 'pan',
    seedId: 'pumpkin',
    seedName: 'かぼちゃの娘苗',
    acquisitionType: 'materialExchange',
    unlockDifficulty: 'normal',
    requiredItems: [
      { itemName: '猪の牙', amount: 8 },
      { itemName: '猪の硬皮', amount: 4 },
      { itemName: '錫鉱石', amount: 6 },
    ],
    isRepeatable: false,
  },
  {
    girlId: 'puti',
    seedId: 'dragon_fruit',
    seedName: 'ドラゴンフルーツの娘苗',
    acquisitionType: 'repaymentUnlock',
    unlockDifficulty: 'hard',
    requiredSuccessfulRepayments: 3,
    isRepeatable: false,
  },
  {
    girlId: 'roma',
    seedId: 'romanesco',
    seedName: 'ロマネスコの娘苗',
    acquisitionType: 'creditUnlock',
    unlockDifficulty: 'hard',
    requiredFarmCredit: 60,
    isRepeatable: false,
  },
  {
    girlId: 'saffy',
    seedId: 'saffron',
    seedName: 'サフランの娘苗',
    acquisitionType: 'specialEvent',
    unlockDifficulty: 'hard',
    eventId: 'saffy_seed_unlock',
    isRepeatable: false,
  },
] as const;
