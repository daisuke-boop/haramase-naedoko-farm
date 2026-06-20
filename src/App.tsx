import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { FieldGrid, type Point } from './components/FieldGrid';
import Character from './Character';
import DialogBox from './DialogBox';
import ShopOverlay from './ShopOverlay';
import AnimationLayer from './AnimationLayer';
import DebugPanel from './DebugPanel';
import MapEditorPanel from './MapEditorPanel';
import {
  AUDIO_FILE_ENTRIES,
  BATH_CHANGE_SOUND_SRC,
  BATH_SPLASH_SOUND_SRC,
  BGM_FILE_ENTRIES,
  CICADA_SOUND_SRC,
  DEBUG_PANEL_WIDTH,
  DEFAULT_AUDIO_GAINS,
  DEFAULT_FIELD_CORNERS,
  DEFAULT_FIELD_GRID_SIZES,
  DEFAULT_MAP_BGM_SOURCES,
  DEFAULT_SYSTEM_MESSAGE,
  DIALOG_BOX_DEFAULT_WIDTH,
  DIALOG_BOX_MAX_HEIGHT,
  DIALOG_BOX_MIN_HEIGHT,
  DIALOG_BOX_MIN_WIDTH,
  DOUKUTSU_WATERFALL_POINT,
  FARM_RIVER_POINTS,
  FISH_LOSE_SOUND_SRC,
  FISH_RESULT_SOUND_SRC,
  FIREPLACE_HEAR_DISTANCE,
  FIREPLACE_SOUND_SRC,
  FOOTSTEP_SOUNDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOUSE_FIREPLACE_POINT,
  IWANA_SPLASH_SOUND_SRC,
  KURUMI_DEFAULT_SPRITE_H,
  KURUMI_DEFAULT_SPRITE_W,
  KURUMI_SHOP_SOUND_SRC,
  KURUMI_START2_SOUND_SRC,
  KURUMI_START3_SOUND_SRC,
  KURUMI_START4_SOUND_SRC,
  KURUMI_START5_SOUND_SRC,
  KURUMI_START_SOUND_SRC,
  RIVER_HEAR_DISTANCE,
  RIVER_SOUND_SRC,
  SHOP_BGM_SRC,
  SPEED,
  TAKIURA_WATERFALL_POINT,
  TIME_OF_DAY_LABELS,
  TITLE_BGM_SRC,
  UI_CURSOR_SOUND_SRC,
  UI_FIX_SOUND_SRC,
  UI_SUCCESS_SOUND_SRC,
  WALL_BUMP_SOUNDS,
  WATERFALL_BASIN_POINT,
  WATERFALL_HEAR_DISTANCE,
  WATERFALL_MIN_GAIN,
  WATERFALL_SOUND_SRC,
  furoWalkSprites,
  mapBackgrounds,
  playerSpriteUrls,
  playerWalkSprites,
} from './constants';
import {
  DEFAULT_FISHING_ROD,
  FISH_ZUKAN_ENTRIES,
  getFishSellPrice,
  getFishingRodName,
  isFishBossSize,
  isFishingRodName,
  selectFishingTargetFish,
  shouldEquipCraftedFishingRod,
  type FishZukanEntry,
  type FishingRodName,
  type GameDifficulty,
} from './data/fishingData';
import { BATTLE_EQUIPMENT_DATA, BEAST_BATTLE_DATA, BEAST_DROP_DATA, HERO_BATTLE_STATS_BY_LEVEL, type BattleStats, type BeastId } from './data/battleData';
import {
  LUMBER_DATA,
  SAW_RANKS,
  createLumberRewards,
  getHighestOwnedSaw,
  getLumberSellPrice,
  isSawName,
} from './data/lumberData';
import {
  ORE_DATA,
  PICKAXE_RANKS,
  TEMP_MINING_LIMIT_PER_TIME_SLOT,
  createOreWeight,
  getHighestOwnedPickaxe,
  getOreSellPrice,
  isPickaxeName,
  selectOreReward,
} from './data/miningData';
import { FARM_GIRL_CROP_DATA, getFarmHarvestSellPrice } from './data/farmData';
import { getFarmFieldConfig, getInitiallyUnlockedFarmFieldConfigs, isFarmFieldInitiallyUnlocked } from './data/farmFieldData';
import { GIRL_DATA } from './data/girlData';
import { GIRL_SEED_ACQUISITION_DATA, INITIAL_OWNED_GIRL_SEEDS } from './data/girlSeedAcquisitionData';
import type {
  AnimZone,
  AnimZoneTime,
  CollisionDrawMode,
  FieldCornerKey,
  FieldCornerMap,
  FieldCorners,
  FieldGridSize,
  FieldGridSizeMap,
  FieldId,
  FootstepSound,
  GameMap,
  HideAreaDrawMode,
  MonoAudioGraph,
  RectZone,
  TimeOfDay,
  WallBumpSound,
  WarpDoor,
} from './types';

const getMapBackgroundUrl = (map: GameMap, timeOfDay: TimeOfDay) => {
  const background = mapBackgrounds[map];
  return typeof background === 'string' ? background : background[timeOfDay];
};

const getMapBackgroundSize = (map: GameMap) => {
  if (map === 'house') return '50%';
  if (map === 'shed') return '25%';
  return '100% 100%';
};

const getMapLabel = (map: GameMap) => {
  switch (map) {
    case 'farm': return '牧場';
    case 'house': return '家';
    case 'shed': return '小屋';
    case 'waterfall': return '滝';
    case 'kawa': return '川';
    case 'doukutsu': return '洞窟';
    case 'takiura': return '滝裏';
  }
};

const LOGGING_POINT_COUNT_BY_TIME: Record<TimeOfDay, number> = {
  morning: 10,
  day: 10,
  evening: 10,
  night: 10,
};
const LOGGING_POINT_MAPS: GameMap[] = ['farm', 'waterfall', 'kawa'];
const LOGGING_REWARD_WOOD = 3;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const shuffleBySeed = <T,>(items: T[], seed: string) => (
  [...items].sort((a, b) => hashString(`${seed}:${JSON.stringify(a)}`) - hashString(`${seed}:${JSON.stringify(b)}`))
);


// === BACKGROUND ANIMATION LOGIC ===

type InspectSpot = {
  id: string;
  map: GameMap;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  text: string;
  texts?: string[];
  autoTrigger?: boolean;
  imageSrc?: string;
  videoSrc?: string;
  seSrc?: string;
  voiceSrc?: string;
};
type LoggingPoint = { id: string; map: GameMap; x: number; y: number; w: number; h: number };
const monoAudioGraphs = new WeakMap<HTMLAudioElement, MonoAudioGraph>();

const forceMonoPlayback = (audio: HTMLAudioElement) => {
  if (typeof window === 'undefined' || monoAudioGraphs.has(audio)) return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const source = context.createMediaElementSource(audio);
  const splitter = context.createChannelSplitter(2);
  const leftGain = context.createGain();
  const rightGain = context.createGain();
  const merger = context.createChannelMerger(2);

  leftGain.gain.value = 0.5;
  rightGain.gain.value = 0.5;
  source.connect(splitter);
  splitter.connect(leftGain, 0);
  splitter.connect(rightGain, 1);
  leftGain.connect(merger, 0, 0);
  leftGain.connect(merger, 0, 1);
  rightGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  merger.connect(context.destination);

  monoAudioGraphs.set(audio, { context, source, splitter, leftGain, rightGain, merger });
};

const resumeMonoPlayback = (audio: HTMLAudioElement) => {
  const graph = monoAudioGraphs.get(audio);
  if (graph?.context.state === 'suspended') {
    void graph.context.resume();
  }
};

const defaultDoors: WarpDoor[] = [
  // 牧場 -> 家 (左上)
  { id: 'door_to_house', map: 'farm', targetMap: 'house', x: 420, y: 320, w: 60, h: 60, spawnX: 960, spawnY: 770 },
  // 牧場 -> 小屋 (右下付近)
  { id: 'door_to_shed', map: 'farm', targetMap: 'shed', x: 1560, y: 640, w: 60, h: 60, spawnX: 960, spawnY: 650 },
  // 家 -> 牧場 (下部の出口)
  { id: 'door_house_exit', map: 'house', targetMap: 'farm', x: 930, y: 1000, w: 100, h: 60, spawnX: 450, spawnY: 380 },
  // 小屋 -> 牧場 (下部の出口)
  { id: 'door_shed_exit', map: 'shed', targetMap: 'farm', x: 930, y: 1000, w: 100, h: 60, spawnX: 1560, spawnY: 700 },
  // 牧場 -> 洞窟
  { id: 'door_to_doukutsu', map: 'farm', targetMap: 'doukutsu', x: 1000, y: 100, w: 60, h: 60, spawnX: 960, spawnY: 900 },
  // 洞窟 -> 牧場
  { id: 'door_doukutsu_exit', map: 'doukutsu', targetMap: 'farm', x: 930, y: 1000, w: 100, h: 60, spawnX: 1000, spawnY: 200 },
];

const requiredRouteDoors: WarpDoor[] = [
  { id: 'door_to_waterfall', map: 'farm', targetMap: 'waterfall', x: 940, y: 320, w: 70, h: 50, spawnX: 930, spawnY: 1020 },
  { id: 'door_waterfall_exit', map: 'waterfall', targetMap: 'farm', x: 890, y: 1020, w: 120, h: 60, spawnX: 970, spawnY: 420 },
];

const ensureRequiredRouteDoors = (doors: WarpDoor[]) => {
  const next = [...doors];
  requiredRouteDoors.forEach(routeDoor => {
    const sameIdIndex = next.findIndex(d => d.id === routeDoor.id);
    if (sameIdIndex >= 0) {
      next[sameIdIndex] = routeDoor;
      return;
    }

    const hasSameRoute = next.some(d => d.map === routeDoor.map && d.targetMap === routeDoor.targetMap);
    if (!hasSameRoute) {
      next.push(routeDoor);
    }
  });
  return next;
};

const HOUSE_BED_SLEEP_ZONE = { x: 545, y: 345, w: 140, h: 175 };
const HOUSE_BATH_ZONE: RectZone = { x: 1200, y: 355, w: 150, h: 105 };
const DEFAULT_HOUSE_BATH_TUB_MASK_ZONE: RectZone = { x: 1218, y: 372, w: 118, h: 58 };

const defaultZones: AnimZone[] = [
  { id: '1', x: 175, y: 110, w: 40, h: 40, type: 'smoke', map: 'farm' },
  { id: 'default_takiura_waterfall', x: 234, y: 123, w: 560, h: 760, type: 'waterfall', map: 'takiura' },
  { id: 'default_waterfall_day_flow', x: 690, y: 120, w: 430, h: 500, type: 'waterfall', map: 'waterfall' },
  { id: 'default_doukutsu_waterfall_sound', x: 780, y: 360, w: 360, h: 360, type: 'waterfall', map: 'doukutsu' },
  { id: 'default_house_fireplace_flame', x: 904, y: 394, w: 92, h: 78, type: 'fireplace', map: 'house' },
];

const requiredDefaultZones = defaultZones.filter(zone => zone.type !== 'smoke');
const ensureAnimZoneSpriteSize = (zone: AnimZone): AnimZone => ({
  ...zone,
  spriteW: Math.max(8, zone.spriteW ?? zone.w),
  spriteH: Math.max(8, zone.spriteH ?? zone.h),
});

const ensureRequiredZones = (zones: AnimZone[]) => {
  const next = [...zones];
  requiredDefaultZones.forEach(defaultZone => {
    if (defaultZone.type === 'waterfall' && next.some(zone => zone.map === defaultZone.map && zone.type === defaultZone.type)) {
      return;
    }
    if (!next.some(zone => zone.id === defaultZone.id)) {
      next.push(defaultZone);
    }
  });
  return next.map(ensureAnimZoneSpriteSize);
};

const isAnimZoneVisibleAtTime = (zone: AnimZone, timeOfDay: TimeOfDay) => {
  if (zone.type === 'kurumi' && timeOfDay === 'night') return true;
  if (zone.timeOfDays && zone.timeOfDays.length > 0) return zone.timeOfDays.includes(timeOfDay);
  return !zone.timeOfDay || zone.timeOfDay === timeOfDay;
};

const getAnimZoneTimeLabel = (time: AnimZoneTime) => {
  if (time === 'all') return '全時間';
  return TIME_OF_DAY_LABELS[time];
};

// === GAME ENGINE ===

const getFileGain = (src: string, audioGains: Record<string, number>) => {
  return audioGains[src] ?? DEFAULT_AUDIO_GAINS[src] ?? 1;
};

const getEffectiveVolume = (src: string, categoryVolume: number, audioGains: Record<string, number>) => {
  return Math.min(1, categoryVolume * getFileGain(src, audioGains));
};

const getDistanceToPolyline = (point: { x: number; y: number }, linePoints: { x: number; y: number }[]) => {
  if (linePoints.length === 0) return Infinity;

  let minDistance = Infinity;
  for (let i = 0; i < linePoints.length - 1; i++) {
    const start = linePoints[i];
    const end = linePoints[i + 1];
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLengthSq = segmentX * segmentX + segmentY * segmentY;
    const t = segmentLengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / segmentLengthSq));
    const nearestX = start.x + t * segmentX;
    const nearestY = start.y + t * segmentY;
    const dx = point.x - nearestX;
    const dy = point.y - nearestY;
    minDistance = Math.min(minDistance, Math.sqrt(dx * dx + dy * dy));
  }

  return minDistance;
};

const getRiverVolume = (currentMap: GameMap, pos: { x: number; y: number }) => {
  if (currentMap === 'kawa') return 1;
  if (currentMap !== 'farm') return 0;

  const distance = getDistanceToPolyline(pos, FARM_RIVER_POINTS);
  return 1 - Math.min(distance / RIVER_HEAR_DISTANCE, 1);
};

const getWaterfallSoundPoint = (currentMap: GameMap) => {
  if (currentMap === 'waterfall') return WATERFALL_BASIN_POINT;
  if (currentMap === 'takiura') return TAKIURA_WATERFALL_POINT;
  if (currentMap === 'doukutsu') return DOUKUTSU_WATERFALL_POINT;
  return null;
};

const hasWaterfallSoundMap = (currentMap: GameMap) => {
  return currentMap === 'waterfall' || currentMap === 'takiura' || currentMap === 'doukutsu';
};

type FishingFanConfig = {
  width: number;
  height: number;
  opacity: number;
};


const DEFAULT_FISHING_FAN_CONFIG: FishingFanConfig = {
  width: 420,
  height: 155,
  opacity: 0.28,
};

const DEFAULT_FISHING_FAN_CONFIGS: Record<string, FishingFanConfig> = {
  '竹の釣竿': DEFAULT_FISHING_FAN_CONFIG,
  '丈夫な釣竿': {
    width: 520,
    height: 190,
    opacity: 0.24,
  },
  '高級釣竿': {
    width: 600,
    height: 220,
    opacity: 0.22,
  },
  '伝説の釣り竿': {
    width: 680,
    height: 250,
    opacity: 0.2,
  },
};

const FISHING_KEEP_GREEN_MIN = 42;
const FISHING_KEEP_GREEN_MAX = 58;
const FISHING_KEEP_GREEN_CENTER = 50;
const FISHING_KEEP_GREEN_SUCCESS_WIDTH = FISHING_KEEP_GREEN_MAX - FISHING_KEEP_GREEN_MIN;
const FISHING_KEEP_GREEN_FAIL_WIDTH = FISHING_KEEP_GREEN_SUCCESS_WIDTH / 2;
const FISHING_FISH_MAX_HP = 100;
const FISHING_TENSION_MAX = 100;
const FISHING_BITE_ROUNDS = 5;
const FISHING_BITE_TARGET_SIZE = 72;
const FISHING_BITE_START_SIZE = 172;
const FISHING_BITE_END_SIZE = 42;
const FISHING_BITE_ROUND_MS_LIST = [2500, 2000, 1500, 1000, 600];
const FISHING_SCENE_CAST_SRC = '/img/fishing1.jpg';
const FISHING_SCENE_BATTLE_A_SRC = '/img/fishing2.jpg';
const FISHING_SCENE_BATTLE_B_SRC = '/img/fishing3.jpg';
const FISHING_SCENE_UKI_SRC = '/img/uki.jpg';
const FISHING_SCENE_HIT_SRC = '/img/hit.jpg';
const FISHING_SCENE_NUSHI_SRC = '/img/nushi.png';
const FISHING_SCENE_HIT_OVERLAY_SRC = '/img/hit.png';
const FISHING_SCENE_RESULT_SRC = '/img/0eda.jpg';
const FISHING_SCENE_ESCAPE_SRC = '/img/fishing4.jpg';
const FISHING_BITE_SPARKLE_WEBM_SRC = '/video/sparkle.webm';
const FISHING_CAST_SOUND_SRC = '/se/fishing.wav';
const FISHING_REEL_SOUND_SRC = '/se/reel.mp3';
const FISHING_NUSHI_SOUND_SRC = '/voice/kawanushi.wav';
const FISHING_NUSHI_COUNTDOWN_DELAY_MS = 1200;
const FISHING_BGM_SRC = '/bgm/fishking.mp3';
const DEBUG_DIALOGUE_STORAGE_KEY = 'farmDebugDialogueOverrides';
const VOICE_AUDIO_CACHE_VERSION = '20260619-craft4-fix';

type KurumiTradeReward = {
  threshold: number;
  imageSrc: string;
  message: string;
  voiceSrc: string;
};


type ShopItem = {
  name: string;
  price: number;
  stock: number;
  type: '買う' | '売る';
  desc: string;
  fishName?: string;
  fishPrice?: number;
  sizedInventoryName?: string;
  sizedInventoryPrice?: number;
};

type FishingBiteCircle = {
  x: number;
  y: number;
  outerSize: number;
};

type FishingBiteSparkle = {
  x: number;
  y: number;
  id: number;
};

type DebugDialogueStep = {
  debugKey: string;
  message: string;
  voiceSrc?: string;
  imageSrc?: string;
};

type FishingTutorialStep = 'intro' | 'rod' | 'direction' | 'power' | 'bite' | 'hit' | 'result';
type FishingTutorialResult = 'success' | 'fail' | null;
type CraftCircle = { id: number; x: number; y: number; size: number; expiresAt: number; durationMs: number };
type CraftRecipeId =
  | '【レシピ】のこぎり'
  | '【レシピ】つるはし'
  | '【レシピ】丈夫なつるはし'
  | '【レシピ】丈夫なのこぎり'
  | '【レシピ】高級つるはし'
  | '【レシピ】高級のこぎり'
  | '【レシピ】伝説のつるはし'
  | '【レシピ】伝説ののこぎり'
  | '【レシピ】丈夫な釣竿'
  | '【レシピ】高級釣竿'
  | '【レシピ】伝説の釣り竿';
const isRecipeItemName = (name: string) => name.startsWith('【レシピ】');
type GatheringTutorialChoice = 'logging' | 'mining';
type CraftRecipeConfig = {
  output: string;
  materials: Record<string, number>;
  circleCountRange: [number, number];
  circleDurationRangeMs: [number, number];
  scorePerCircle: number;
};
type KurumiIntroTopicId = 'village' | 'debt' | 'naedoko' | 'pantsu';
type SaveSlotSummary = {
  slot: number;
  exists: boolean;
  day?: number;
  debt?: number;
  gold?: number;
  map?: GameMap;
  updatedAt?: string;
  ownedGirlCount?: number;
  caughtFishCount?: number;
};

type FarmGirlState = 'none' | 'planted' | 'growing' | 'appeared' | 'companion' | 'lover';

type FarmGirlSaveState = {
  girlId: string;
  state: FarmGirlState;
  plantedDay: number | null;
  growthProgress: number;
  lastHarvestDay: number | null;
  trust: number;
  unlockedTrustEventIds: string[];
};

type FarmFieldSlotState = {
  fieldId: FieldId;
  slotIndex: number;
  girlId: string | null;
  state: Extract<FarmGirlState, 'none' | 'growing' | 'appeared'>;
  plantedDay: number | null;
};

type BattleUnitState = BattleStats & {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  criticalRate?: number;
  beastDamageMultiplier?: number;
  beastDamageReduction?: number;
  statusResistance?: boolean;
};

type BattleLootEntry = {
  itemId: string;
  itemName: string;
  count: number;
};

type BattlePreviewResult = 'ongoing' | 'victory' | 'defeat' | 'escaped';

type BattlePreviewState = {
  hero: BattleUnitState & { level: number; defending: boolean };
  allies: (BattleUnitState | null)[];
  beasts: (BattleUnitState | null)[];
  logs: string[];
  result: BattlePreviewResult;
  loot: BattleLootEntry[];
  lootGranted: boolean;
};

const DIFFICULTY_ORDER: Readonly<Record<GameDifficulty, number>> = {
  easy: 0,
  normal: 1,
  hard: 2,
};

const FARM_GIRL_CARD_BACK_SRC = '/img/card.png';
const FARM_GIRL_CARD_IMAGES = ['/img/chibiichi-card.jpg', '/img/ruby-card.jpg', '/img/mel-card.jpg'];
const OPEN_FARM_GIRL_CARD_COUNT = FARM_GIRL_CARD_IMAGES.filter(src => src !== FARM_GIRL_CARD_BACK_SRC).length;

const KURUMI_TRADE_REWARDS: KurumiTradeReward[] = [
  { threshold: 1000, imageSrc: '/img/kurumi-pantsu.png', message: 'いつもありがとう！お礼だよっ！', voiceSrc: '/voice/kurumi1.wav' },
  { threshold: 1500, imageSrc: '/img/kurumi-pai.png', message: '嬉しいなーっ♪サービスだよっ！', voiceSrc: '/voice/kurumi2.wav' },
  { threshold: 2000, imageSrc: '/img/kurumi-hadaka.png', message: 'もう！お兄さんったら！', voiceSrc: '/voice/kurumi3.wav' },
];
const KURUMI_INTRO_FIRST_MESSAGE = '私はくるみだよっ！\nはらませ村でいろんなものを取引してるんだー！\nお兄ちゃんは借金がいっぱいあるって聞いたから、\nくるみが色々手伝ってあげるねっ！\n何か聞きたいことはある？';
const KURUMI_INTRO_TOPICS: { id: KurumiIntroTopicId; label: string; answer: string; voiceSrc?: string }[] = [
  { id: 'village', label: '孕ませ村とは？', answer: '初めて来た人はみーんな\nその名前で驚くみたい。\nくるみは何とも思わないけどねー！\nでも、とってもいいとこだよ♪\nかわいい野菜や果物も育つし、\n釣りしたり洞窟探検したり楽しいとこだよっ！', voiceSrc: KURUMI_START2_SOUND_SRC },
  { id: 'debt', label: '借金の返し方は？', answer: 'うーん、育てた野菜や果物売ったり...かなぁ。\nあっ！くるみねー、色々ものを作るの得意なんだぁー！\nだから、もし素材とか欲しいものがあったら\nまた話しかけてね。\nあと、釣りも得意なんだぁ。\nそうだっ！釣りのやり方も教えるから、\n興味があったら教えてあげる！\n明日そこの橋の上で待ってるね！', voiceSrc: KURUMI_START3_SOUND_SRC },
  { id: 'naedoko', label: '苗床って？', answer: '孕ませ村の特産品の事だよっ！\n野菜や果物の苗床っていう女の子たちを育てたら、\nたっくさん美味しい野菜や果物ができるんだよー！\n幸い、むふふぅーっ！\nおにぃさんはあっちの方も強そうだし...\nきっといい野菜や果物が育つと思うよっ！', voiceSrc: KURUMI_START4_SOUND_SRC },
  { id: 'pantsu', label: 'パンツ見せて！', answer: 'えー、どうしょっかなぁー！...考えとくねっ♡', voiceSrc: KURUMI_START5_SOUND_SRC },
];
const KURUMI_INTRO_TOPIC_IDS = KURUMI_INTRO_TOPICS.map(topic => topic.id);
const KURUMI_INTRO_CLOSE_FADE_MS = 650;

const FISH_ITEM_NAMES = new Set(FISH_ZUKAN_ENTRIES.map(fish => fish.name));
const LUMBER_ITEM_NAMES = new Set(LUMBER_DATA.map(lumber => lumber.name));
const ORE_ITEM_NAMES = new Set(ORE_DATA.map(ore => ore.name));
const FARM_HARVEST_ITEM_NAMES = new Set(FARM_GIRL_CROP_DATA.map(crop => crop.harvestItemName));
const FISHING_NUSHI_RING_NAME = '釣神の指輪';
const FISHING_NUSHI_DEBUG_RING_NAME = '釣神の指輪（デバッグ用）';
const ITEM_MENU_BASE_ITEMS: Record<string, string[]> = {
  '消耗品': ['薬草', '気付け水', '小さな釣り餌'],
  '素材': [
    '木材', '川魚の鱗', 'モグラの爪', 'ウサギの靭帯', '軟らかい銅鉱石', '泥混じりの鉄鉱石', '柔らかな若枝',
    '軽石炭', 'しなやかな軟木', '猪の牙', '熊の剛糸', '良質な鉄鉱石', '堅実な中木',
    '巨獣の鋼角', '神獣の絹糸', '金鉱石', '不朽の鉄木', '脆い鉛鉱石', '錫鉱石', '銀鉱石', '鋼鉄石', '聖域の輝石',
    '猪の硬皮', '巨獣の強剛糸', '古代の神木',
  ],
  '装備品': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿', 'のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし', '農神の指輪', FISHING_NUSHI_RING_NAME, FISHING_NUSHI_DEBUG_RING_NAME],
  '売却品': [],
  'だいじなもの': [
    '【レシピ】のこぎり',
    '【レシピ】つるはし',
    '【レシピ】丈夫なつるはし',
    '【レシピ】丈夫なのこぎり',
    '【レシピ】高級つるはし',
    '【レシピ】高級のこぎり',
    '【レシピ】伝説のつるはし',
    '【レシピ】伝説ののこぎり',
    '【レシピ】丈夫な釣竿',
    '【レシピ】高級釣竿',
    '【レシピ】伝説の釣り竿',
  ],
};
const INITIAL_INVENTORY_COUNTS: Record<string, number> = {
  '【レシピ】丈夫な釣竿': 1, '【レシピ】高級釣竿': 1, '【レシピ】伝説の釣り竿': 1,
  'のこぎり': 1,
  'つるはし': 1,
  '農神の指輪': 1,
  [FISHING_NUSHI_RING_NAME]: 1,
  [FISHING_NUSHI_DEBUG_RING_NAME]: 1,
};
const INITIAL_EQUIPPED_ITEMS: Record<string, string> = {
  '主人公-slot1': '',
  '主人公-slot2': 'のこぎり',
  '主人公-slot3': 'つるはし',
  '主人公-slot4': '農神の指輪',
  'ちびいち-slot1': '小さな鈴',
  'ちびいち-slot2': '',
};
const createItemMenuItems = (inventoryCounts: Record<string, number>) => {
  const ownedFishNames = FISH_ZUKAN_ENTRIES
    .filter(fish => (inventoryCounts[fish.name] ?? 0) > 0)
    .map(fish => fish.name);
  const sellableFishNames = ownedFishNames.filter(name => {
    const fish = FISH_ZUKAN_ENTRIES.find(entry => entry.name === name);
    return fish?.sellable !== false;
  });
  const keyFishNames = ownedFishNames.filter(name => {
    const fish = FISH_ZUKAN_ENTRIES.find(entry => entry.name === name);
    return fish?.sellable === false;
  });
  const ownedFarmHarvestNames = FARM_GIRL_CROP_DATA
    .filter(crop => (inventoryCounts[crop.harvestItemName] ?? 0) > 0)
    .map(crop => crop.harvestItemName);

  return {
    ...ITEM_MENU_BASE_ITEMS,
    '売却品': [...sellableFishNames, ...ownedFarmHarvestNames, ...ITEM_MENU_BASE_ITEMS['売却品']],
    'だいじなもの': [...keyFishNames, ...ITEM_MENU_BASE_ITEMS['だいじなもの']],
  };
};
const RECIPE_DETAILS: Record<string, { title: string; materials: string[]; steps: string[]; note: string }> = {
  '【レシピ】のこぎり': {
    title: 'レシピ：のこぎり',
    materials: ['モグラの爪（5）', 'ウサギの靭帯（2）', '軟らかい銅鉱石（1）', '柔らかな若枝（2）'],
    steps: ['銅鉱石に爪を並べ、靭帯で固定する。', '枝で挟み、柄を作る。'],
    note: '注意：無理な力は厳禁。すぐに爪が欠けるぞ。',
  },
  '【レシピ】つるはし': {
    title: 'レシピ：つるはし',
    materials: ['モグラの爪（5）', 'ウサギの靭帯（2）', '泥混じりの鉄鉱石（1）', '柔らかな若枝（2）'],
    steps: ['鉄鉱石に爪を刺し、靭帯で固定する。', '枝を十字に組み、柄を作る。'],
    note: '注意：岩を叩くとすぐ鈍る。小石掘りから始めよ。',
  },
  '【レシピ】丈夫なつるはし': {
    title: 'レシピ：丈夫なつるはし',
    materials: ['モグラの爪（10）', 'ウサギの靭帯（5）', '泥混じりの鉄鉱石（3）', '柔らかな若枝（5）'],
    steps: ['鉄鉱石を束ねて先端を厚くする。', '若枝の柄を靭帯で締め、モグラの爪で掘削力を補強する。'],
    note: '錫鉱石や鋼鉄石を低確率で狙える中級つるはし。',
  },
  '【レシピ】丈夫なのこぎり': {
    title: 'レシピ：丈夫なのこぎり',
    materials: ['モグラの爪（10）', 'ウサギの靭帯（5）', '軟らかい銅鉱石（3）', '柔らかな若枝（5）'],
    steps: ['銅鉱石を薄く伸ばし、爪を刃として並べる。', '若枝の柄へ靭帯できつく固定する。'],
    note: 'しなやかな軟木と堅実な中木を狙える中級のこぎり。',
  },
  '【レシピ】高級つるはし': {
    title: 'レシピ：高級つるはし',
    materials: ['猪の牙（5）', '猪の硬皮（2）', '錫鉱石（3）', '堅実な中木（5）', 'モグラの爪（20）', 'ウサギの靭帯（10）'],
    steps: ['堅実な中木を芯にして錫鉱石で先端を固める。', '猪の牙と硬皮で衝撃に強い掘削具へ仕上げる。'],
    note: '中盤以降の鉱石を安定して掘り出せる上位つるはし。',
  },
  '【レシピ】高級のこぎり': {
    title: 'レシピ：高級のこぎり',
    materials: ['猪の牙（5）', '猪の硬皮（2）', '錫鉱石（3）', '堅実な中木（5）', 'モグラの爪（20）', 'ウサギの靭帯（10）'],
    steps: ['堅実な中木でしならない柄を作る。', '錫鉱石と猪の牙を刃に組み込み、硬皮で握りを補強する。'],
    note: '不朽の鉄木と古代の神木を低確率で狙える上位のこぎり。',
  },
  '【レシピ】伝説のつるはし': {
    title: 'レシピ：伝説のつるはし',
    materials: ['巨獣の鋼角（5）', '巨獣の強剛糸（2）', '鋼鉄石（5）', '古代の神木（3）', '猪の牙（10）', '猪の硬皮（5）'],
    steps: ['古代の神木に鋼鉄石を打ち込み、折れない芯を作る。', '巨獣の鋼角と強剛糸で、岩盤を砕く先端へ仕上げる。'],
    note: '最上位鉱石を狙える伝説級のつるはし。',
  },
  '【レシピ】伝説ののこぎり': {
    title: 'レシピ：伝説ののこぎり',
    materials: ['巨獣の鋼角（5）', '巨獣の強剛糸（2）', '鋼鉄石（5）', '古代の神木（3）', '猪の牙（10）', '猪の硬皮（5）'],
    steps: ['古代の神木を柄にして鋼鉄石で刃の土台を作る。', '巨獣の鋼角を刃先に並べ、強剛糸で締め上げる。'],
    note: '古代の神木まで安定して狙える伝説級ののこぎり。',
  },
  '【レシピ】丈夫な釣竿': {
    title: 'レシピ：丈夫な釣竿',
    materials: ['モグラの爪（5）', 'ウサギの靭帯（10）', '軽石炭（2）', 'しなやかな軟木（3）'],
    steps: ['軟木をしならせ、爪で継ぎ目を固定する。', '靭帯を撚って糸を作り、軽石炭で接合部を補強する。'],
    note: '竹の釣竿より遠くへ投げられ、釣れる魚の種類が増える。',
  },
  '【レシピ】高級釣竿': {
    title: 'レシピ：高級釣竿',
    materials: ['猪の牙（5）', '熊の剛糸（10）', '良質な鉄鉱石（5）', '堅実な中木（5）', '丈夫な釣竿（1）'],
    steps: ['丈夫な釣竿を芯にして中木と鉄鉱石で補強する。', '猪の牙を留め具に加工し、熊の剛糸を張る。'],
    note: '丈夫な釣竿を素材として消費する上位装備。',
  },
  '【レシピ】伝説の釣り竿': {
    title: 'レシピ：伝説の釣り竿',
    materials: ['巨獣の鋼角（5）', '神獣の絹糸（5）', '金鉱石（5）', '不朽の鉄木（3）', '高級釣竿（1）', '熊の剛糸（20）'],
    steps: ['高級釣竿へ鉄木と鋼角を組み込み、金鉱石で接合する。', '神獣の絹糸と熊の剛糸を重ね、折れない釣り糸に仕上げる。'],
    note: 'すべての魚を狙える最高ランクの釣竿。',
  },
};
const CRAFT_RECIPE_CONFIGS: Record<CraftRecipeId, CraftRecipeConfig> = {
  '【レシピ】のこぎり': {
    output: 'のこぎり',
    materials: { 'モグラの爪': 5, 'ウサギの靭帯': 2, '軟らかい銅鉱石': 1, '柔らかな若枝': 2 },
    circleCountRange: [5, 6],
    circleDurationRangeMs: [2000, 3000],
    scorePerCircle: 18,
  },
  '【レシピ】つるはし': {
    output: 'つるはし',
    materials: { 'モグラの爪': 5, 'ウサギの靭帯': 2, '泥混じりの鉄鉱石': 1, '柔らかな若枝': 2 },
    circleCountRange: [10, 14],
    circleDurationRangeMs: [1200, 1800],
    scorePerCircle: 9,
  },
  '【レシピ】丈夫なつるはし': {
    output: '丈夫なつるはし',
    materials: { 'モグラの爪': 10, 'ウサギの靭帯': 5, '泥混じりの鉄鉱石': 3, '柔らかな若枝': 5 },
    circleCountRange: [8, 10],
    circleDurationRangeMs: [1500, 2200],
    scorePerCircle: 12,
  },
  '【レシピ】丈夫なのこぎり': {
    output: '丈夫なのこぎり',
    materials: { 'モグラの爪': 10, 'ウサギの靭帯': 5, '軟らかい銅鉱石': 3, '柔らかな若枝': 5 },
    circleCountRange: [8, 10],
    circleDurationRangeMs: [1500, 2200],
    scorePerCircle: 12,
  },
  '【レシピ】高級つるはし': {
    output: '高級つるはし',
    materials: { '猪の牙': 5, '猪の硬皮': 2, '錫鉱石': 3, '堅実な中木': 5, 'モグラの爪': 20, 'ウサギの靭帯': 10 },
    circleCountRange: [10, 13],
    circleDurationRangeMs: [1300, 2000],
    scorePerCircle: 10,
  },
  '【レシピ】高級のこぎり': {
    output: '高級のこぎり',
    materials: { '猪の牙': 5, '猪の硬皮': 2, '錫鉱石': 3, '堅実な中木': 5, 'モグラの爪': 20, 'ウサギの靭帯': 10 },
    circleCountRange: [10, 13],
    circleDurationRangeMs: [1300, 2000],
    scorePerCircle: 10,
  },
  '【レシピ】伝説のつるはし': {
    output: '伝説のつるはし',
    materials: { '巨獣の鋼角': 5, '巨獣の強剛糸': 2, '鋼鉄石': 5, '古代の神木': 3, '猪の牙': 10, '猪の硬皮': 5 },
    circleCountRange: [12, 15],
    circleDurationRangeMs: [1100, 1800],
    scorePerCircle: 8,
  },
  '【レシピ】伝説ののこぎり': {
    output: '伝説ののこぎり',
    materials: { '巨獣の鋼角': 5, '巨獣の強剛糸': 2, '鋼鉄石': 5, '古代の神木': 3, '猪の牙': 10, '猪の硬皮': 5 },
    circleCountRange: [12, 15],
    circleDurationRangeMs: [1100, 1800],
    scorePerCircle: 8,
  },
  '【レシピ】丈夫な釣竿': {
    output: '丈夫な釣竿',
    materials: { 'モグラの爪': 5, 'ウサギの靭帯': 10, '軽石炭': 2, 'しなやかな軟木': 3 },
    circleCountRange: [7, 9],
    circleDurationRangeMs: [1700, 2400],
    scorePerCircle: 13,
  },
  '【レシピ】高級釣竿': {
    output: '高級釣竿',
    materials: { '猪の牙': 5, '熊の剛糸': 10, '良質な鉄鉱石': 5, '堅実な中木': 5, '丈夫な釣竿': 1 },
    circleCountRange: [9, 12],
    circleDurationRangeMs: [1400, 2100],
    scorePerCircle: 11,
  },
  '【レシピ】伝説の釣り竿': {
    output: '伝説の釣り竿',
    materials: { '巨獣の鋼角': 5, '神獣の絹糸': 5, '金鉱石': 5, '不朽の鉄木': 3, '高級釣竿': 1, '熊の剛糸': 20 },
    circleCountRange: [12, 15],
    circleDurationRangeMs: [1100, 1800],
    scorePerCircle: 8,
  },
};
const CRAFT_RECIPE_IDS = Object.keys(CRAFT_RECIPE_CONFIGS) as CraftRecipeId[];
const FISHING_TUTORIAL_KURUMI_ZONE = { x: 1366, y: 636, w: 44, h: 62 };
const FISHING_TUTORIAL_KURUMI_LABEL_W = 210;
const FISHING_TUTORIAL_KURUMI_LABEL_H = 54;
const FISHING_TUTORIAL_INTERACT_DISTANCE = 72;
const KURUMI_INTERACT_DISTANCE = 88;
const FISHING_TUTORIAL_KURUMI_APPROACH_POINT = {
  x: FISHING_TUTORIAL_KURUMI_ZONE.x + FISHING_TUTORIAL_KURUMI_ZONE.w / 2,
  y: FISHING_TUTORIAL_KURUMI_ZONE.y + FISHING_TUTORIAL_KURUMI_ZONE.h + 36,
};
const FISHING_TUTORIAL_STEPS: (DebugDialogueStep & { id: FishingTutorialStep })[] = [
  {
    id: 'intro',
    debugKey: 'fishing_tutorial_intro',
    message: 'くるみが釣りを教えちゃうよっ！\n孕ませ村は水が綺麗で、\n魚がたっくさんいるんだよっ！\n釣った魚はくるみが買い取ることもできるしー、\n何か他のことにも使えるかもしれないから、\n釣りを覚えておいて損はないよ♪',
  },
  {
    id: 'rod',
    debugKey: 'fishing_tutorial_rod',
    message: 'はい、これ！\n初心者も扱いやすい竹の釣り竿！\nさっそくここで釣ってみよう！\n今はチュートリアルだから何回もチャレンジできるけど、\nチュートリアルが終わったら\n行動ポイントを消費するから気をつけてねっ',
    imageSrc: '/img/takesao.jpg',
  },
  {
    id: 'direction',
    debugKey: 'fishing_tutorial_direction',
    message: 'まずは投げるポイントを決めよう！\n扇型の黄色い部分に向かって投げると\n釣りやすくなるから、\nしっかり狙って投げてねっ！',
  },
  {
    id: 'power',
    debugKey: 'fishing_tutorial_power',
    message: '次は投げる強さを決めるよっ！\nバーが左右に動いてるから、\nいいタイミングで決定してね！\n強く投げれば投げるほど釣れやすくなるよ！',
  },
  {
    id: 'bite',
    debugKey: 'fishing_tutorial_bite',
    message: '次はタイミングゲームだよ！\n円が重なるタイミングで\n決定ボタンを押してね！\n連続で成功すればするほど、\n大きな魚が釣れるかも？',
  },
  {
    id: 'hit',
    debugKey: 'fishing_tutorial_hit',
    message: '魚が掛かった！\nここまで来ればもう少し！\n決定ボタンを押したり離したりして、\n緑のゾーンをキープしてね！',
  },
  {
    id: 'result',
    debugKey: 'fishing_tutorial_result',
    message: '説明はここまで！\nそれじゃ、お兄さんも実際に釣ってみよっ♪',
  },
];
const FISHING_TUTORIAL_VOICE_SRCS = FISHING_TUTORIAL_STEPS.map((_, index) => `/voice/kurumi-fish${index + 1}.wav`);
const FISHING_TUTORIAL_END_STEPS: DebugDialogueStep[] = [
  {
    debugKey: 'fishing_tutorial_end_1',
    message: 'いろんな場所で釣りができるから試して見てねっ！\nあっ！あと、釣り以外にも木を伐採して\n木材を採取したり、北の洞窟にいけば珍しい鉱石の採掘もできるんだー！',
    voiceSrc: '/voice/kurumi-fish8.wav',
  },
  {
    debugKey: 'fishing_tutorial_end_2',
    message: 'もし伐採とか採掘に興味があるなら、それに必要な道具のレシピを\nくるみが売ってあげるから、あとでくるみのところまで来てねっ♡\nじゃっ、まったねー！',
    voiceSrc: '/voice/kurumi-fish9.wav',
  },
];
const SAW_CRAFT_TUTORIAL_STEPS: DebugDialogueStep[] = [
  {
    debugKey: 'saw_craft_tutorial_1',
    message: 'あっ！それは伐採に必要なのこぎりのレシピだよっ！\nクラフトするのにいろんな素材がいるんだけど、お兄さんは初めてだから\n最初だけ素材をあげるね！',
    voiceSrc: '/voice/craft1.wav',
  },
  {
    debugKey: 'saw_craft_tutorial_2',
    message: 'レシピはいつでもだいじなものから見れるから、気になったら確認してみてねっ！\nじゃあ、早速のこぎりを作ってみよー♪\nちょうどお兄さんのお家の横にクラフト小屋があるからそこに集合ねっ♡',
    voiceSrc: '/voice/craft2.wav',
  },
];
const LOGGING_TUTORIAL_STEPS: (DebugDialogueStep & { id: string })[] = [
  {
    id: 'intro',
    debugKey: 'gathering_tutorial_logging_intro',
    message: 'すごーい♪伐採できる木を見つけたね！\nじゃあ、ここからはどうやって木材を切り出すのか\nくるみが手取り足取り腰取り教えちゃうね♡',
    voiceSrc: '/voice/tree1.wav',
  },
  {
    id: 'direction',
    debugKey: 'gathering_tutorial_logging_direction',
    message: 'まずは、こんな感じでのこぎりを入れる角度を決めてね！\n一番伐採しやすい角度が黄色い範囲で出てるから、\nそこを狙って決定ボタンを押してみよう！',
    voiceSrc: '/voice/tree2.wav',
  },
  {
    id: 'action',
    debugKey: 'gathering_tutorial_logging_action',
    message: '次は実際にのこぎりで切っていくよ！\n下にバーが表示されてカーソルが動いてるから黄色い部分で\nタイミングよくクリックしてねっ♪\n連続で黄色い範囲にカーソルを止めるとコンボが繋がって\n早く伐採できるようになるよ！\n何度か繰り返して100％になったら伐採成功ーっ！',
    voiceSrc: '/voice/tree3.wav',
  },
  {
    id: 'fail_explain',
    debugKey: 'gathering_tutorial_logging_fail_explain',
    message: '逆に黄色い範囲以外でクリックしちゃうと\n伐採率が減っていっちゃうから注意！0％を下回ると\n失敗しちゃうから、気をつけてねっ♪\nものは試しっ、早速やってみよー！',
    voiceSrc: '/voice/tree4.wav',
  },
];
const LOGGING_MINIGAME_CONFIG = {
  tickMs: 50,
  directionSpeed: 4,
  actionSpeedBySaw: {
    'のこぎり': 4,
    '丈夫なのこぎり': 3,
    '高級のこぎり': 2,
  },
  directionSweetMin: 40,
  directionSweetMax: 60,
  actionSweetWidth: {
    goodAngle: 30,
    badAngle: 15,
  },
  progressPerCut: {
    min: 3,
    max: 8,
  },
  comboProgressMultiplier: 1.1,
  comboSpeedMultiplier: 1.2,
  missPenalty: {
    tutorial: 10,
    normal: 15,
  },
} as const;
const PICKAXE_CRAFT_TUTORIAL_STEPS: DebugDialogueStep[] = [
  {
    debugKey: 'pickaxe_craft_tutorial_1',
    message: 'あっ！それは採掘に必要なつるはしのレシピだよっ！\nクラフトするのにいろんな素材がいるんだけど、お兄さんは初めてだから\n最初だけ素材をあげるね！',
    voiceSrc: '/voice/craft5.wav',
  },
  {
    debugKey: 'pickaxe_craft_tutorial_2',
    message: 'レシピはいつでもだいじなものから見れるから、\n気になったら確認してみてねっ！\nじゃあ、早速つるはし\nを作ってみよー♪\nちょうどお兄さんのお家の横にクラフト小屋があるから\nそこに集合ねっ♡',
    voiceSrc: '/voice/craft13.wav',
  },
];
const GATHERING_TUTORIAL_COMMON_STEPS: DebugDialogueStep[] = [
  {
    debugKey: 'gathering_tutorial_common_1',
    message: 'おっ！お兄さんクラフトの才能もあるんだねぇ♪\nすっごーい！\n釣りもできるしクラフトもできるし、\nも・し・か・し・て...\nあっちの方も得意なのかしらー？♡',
    voiceSrc: '/voice/craft6.wav',
  },
  {
    debugKey: 'gathering_tutorial_common_2',
    message: 'じゃーあ、今作ったのこぎりと、つるはしで素材集め！\nやってみよー♪\nどっちから始める？わくわく、わくわく♡',
    voiceSrc: '/voice/craft7.wav',
  },
];
const GATHERING_TUTORIAL_BRANCH_STEPS: Record<GatheringTutorialChoice, DebugDialogueStep[]> = {
  logging: [
    {
      debugKey: 'gathering_tutorial_logging_1',
      message: '孕ませ村には、たーーっくさんの木が生えてるんだぁ。\nこの木材を使えば、他にもいろんなアイテムがクラフトできるから\n色々と挑戦してみてねっ！',
      voiceSrc: '/voice/craft8.wav',
    },
    {
      debugKey: 'gathering_tutorial_logging_2',
      message: 'どの木が伐採できるかランダムなんだけどー、\nお兄さんなら簡単に見つけられるよねっ！\n試しにこのマップにある木をどれか調べてみよー♪',
      voiceSrc: '/voice/craft9.wav',
    },
  ],
  mining: [
    {
      debugKey: 'gathering_tutorial_mining_1',
      message: '孕ませ村には、たーーっくさんの鉱石が眠ってるんだぁ♪\n採取した鉱石を使えば、いろんなアイテムがクラフトできるから\n色々と挑戦してみてねっ！',
      voiceSrc: '/voice/craft10.wav',
    },
    {
      debugKey: 'gathering_tutorial_mining_2',
      message: 'どの岩で採掘できるかランダムなんだけどー、\nお兄さんなら簡単に見つけられるよねっ！\n試しにポストの下にある岩を調べてみよー♪',
      voiceSrc: '/voice/craft11.wav',
    },
  ],
};
const SAW_CRAFT_SHED_TUTORIAL_STEP: DebugDialogueStep = {
  debugKey: 'saw_craft_tutorial_3',
  message: '早速きてくれてありがとう♡\nくるみ嬉しいなぁー♪\nこのクラフト台を調べるとレシピが出るから\n好きなレシピを選んでみてねっ！',
  voiceSrc: '/voice/craft3.wav',
};
const SAW_CRAFT_SHED_TUTORIAL_STEPS: DebugDialogueStep[] = [
  SAW_CRAFT_SHED_TUTORIAL_STEP,
  {
    debugKey: 'saw_craft_tutorial_4',
    message: 'レシピを選んで素材が揃ってるとクラフトできるよ！\nクラフト中は出てくる円をタッチしてね♪\n成功率が70％を超えると成功！！\nじゃ、やってみよーっ。',
    voiceSrc: '/voice/craft4.wav',
  },
];
const CRAFT_TUTORIAL_KURUMI_ZONE = { x: 940, y: 480, w: 60, h: 60 };
const CRAFT_TUTORIAL_KURUMI_LABEL_W = 210;
const CRAFT_TUTORIAL_KURUMI_LABEL_H = 54;
const WARP_COOLDOWN_MS = 450;
const CRAFT_SUCCESS_SOUND_SRC = '/se/craft.mp3';
const LOGGING_SUCCESS_SOUND_SRC = '/se/success.mp3';
const LOGGING_CUT_SOUND_SRC = '/se/saw.wav';
const LOGGING_BGM_SRC = '/bgm/tree.mp3';
const LOGGING_RESULT_SOUND_SRC = '/se/nushi.mp3';

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const shouldEquipCraftedGatheringTool = (currentTool: string, craftedTool: string) => {
  if (isSawName(craftedTool)) {
    return !isSawName(currentTool) || SAW_RANKS.indexOf(craftedTool) > SAW_RANKS.indexOf(currentTool);
  }
  if (isPickaxeName(craftedTool)) {
    return !isPickaxeName(currentTool) || PICKAXE_RANKS.indexOf(craftedTool) > PICKAXE_RANKS.indexOf(currentTool);
  }
  return false;
};
const getFishingFanSweetWidth = (fishLevel: number) => {
  if (fishLevel >= 22) return 5;
  return Number((80 - (75 * clampNumber(fishLevel, 0, 22)) / 22).toFixed(1));
};
const createFishingFanSweetRange = (fish: FishZukanEntry) => {
  const width = getFishingFanSweetWidth(fish.level);
  const start = Number((Math.random() * (100 - width)).toFixed(1));
  return {
    min: start,
    max: Number((start + width).toFixed(1)),
  };
};
const getFishSizeRatio = (fish: FishZukanEntry, size: number) => {
  if (fish.sizeMax <= fish.sizeMin) return 1;
  return clampNumber((size - fish.sizeMin) / (fish.sizeMax - fish.sizeMin), 0, 1);
};
const isNushiSize = (fish: FishZukanEntry, size: number) => isFishBossSize(fish, size);
const getFishingBiteMultiplier = (biteCombo: number) => 1 + Math.min(1, biteCombo / FISHING_BITE_ROUNDS);
const getFishingNushiBaseRate = () => 0.01 + Math.random() * 0.03;
const FISHING_NUSHI_RING_RATE_MULTIPLIER = 3;
const FISHING_NUSHI_RING_DEBUG_RATE = 0.5;
const rollFishingNushi = (fish: FishZukanEntry, biteCombo: number, rateMultiplier = 1, debugRate: number | null = null) => {
  const baseRate = debugRate ?? getFishingNushiBaseRate() * rateMultiplier;
  const finalRate = clampNumber(baseRate * getFishingBiteMultiplier(biteCombo), 0, 1);
  return Math.random() < finalRate;
};
const createFishingTargetSize = (fish: FishZukanEntry, biteScore: number, biteCombo: number) => {
  if (typeof fish.fixedSize === 'number') return fish.fixedSize;
  const quality = clampNumber((biteScore / FISHING_BITE_ROUNDS) * 0.72 + (biteCombo / FISHING_BITE_ROUNDS) * 0.28, 0, 1);
  const lowRoll = Math.random() * (0.45 + quality * 0.35);
  const highBonus = Math.max(0, quality - 0.45) * Math.random() * 0.35;
  const sizeRatio = clampNumber(lowRoll + highBonus, 0, 1);
  return Number((fish.sizeMin + (fish.sizeMax - fish.sizeMin) * sizeRatio).toFixed(1));
};
const INITIAL_DEBT_BY_DIFFICULTY: Readonly<Record<GameDifficulty, number>> = {
  easy: 5_000_000,
  normal: 20_000_000,
  hard: 100_000_000,
};
const DEFAULT_REPAYMENT_CYCLE_DAYS = 7;
const EXHAUSTED_ACTION_MESSAGE = '疲れてこれ以上行動できない。自宅のベッドで休もう。';
const TRUST_GAIN_ON_HARVEST = 3;
const FARM_TRUST_BONUS_TIERS = [
  { minTrust: 100, harvestMultiplier: 1.5, sellMultiplier: 1.25 },
  { minTrust: 80, harvestMultiplier: 1.4, sellMultiplier: 1.15 },
  { minTrust: 60, harvestMultiplier: 1.3, sellMultiplier: 1.1 },
  { minTrust: 40, harvestMultiplier: 1.2, sellMultiplier: 1.05 },
  { minTrust: 20, harvestMultiplier: 1.1, sellMultiplier: 1.0 },
  { minTrust: 0, harvestMultiplier: 1.0, sellMultiplier: 1.0 },
] as const;
const getFarmTrustBonus = (trust: number) => (
  FARM_TRUST_BONUS_TIERS.find(tier => trust >= tier.minTrust) ?? FARM_TRUST_BONUS_TIERS[FARM_TRUST_BONUS_TIERS.length - 1]
);
const getFarmHarvestAmount = (baseAmount: number, trust: number) => (
  Math.max(1, Math.round(baseAmount * getFarmTrustBonus(trust).harvestMultiplier))
);
const BEAST_PREMONITION_RATE_BY_DIFFICULTY: Readonly<Record<GameDifficulty, number>> = {
  easy: 0.12,
  normal: 0.18,
  hard: 0.25,
};
const getScheduledBeastAttackDay = (difficulty: GameDifficulty, currentDay: number) => (
  difficulty === 'easy'
    ? currentDay + 1 + Math.floor(Math.random() * 2)
    : currentDay + 1
);
const getHeroBattleEquipmentBonus = (equippedItems: Record<string, string>) => {
  const equippedNames = Object.entries(equippedItems)
    .filter(([slotId, name]) => slotId.startsWith('主人公-') && Boolean(name))
    .map(([, name]) => name);
  return BATTLE_EQUIPMENT_DATA
    .filter(equipment => equippedNames.includes(equipment.name))
    .reduce(
      (bonus, equipment) => ({
        attack: bonus.attack + (equipment.bonus.attack ?? 0),
        defense: bonus.defense + (equipment.bonus.defense ?? 0),
        hp: bonus.hp + (equipment.bonus.hp ?? 0),
        criticalRate: bonus.criticalRate + (equipment.bonus.criticalRate ?? 0),
        beastDamageMultiplier: bonus.beastDamageMultiplier * (1 + (equipment.bonus.beastDamageBonus ?? 0) / 100),
        beastDamageReduction: bonus.beastDamageReduction + (equipment.bonus.beastDamageReduction ?? 0),
        statusResistance: bonus.statusResistance || Boolean(equipment.bonus.statusAilmentResistance),
        equippedNames: [...bonus.equippedNames, equipment.name],
      }),
      {
        attack: 0,
        defense: 0,
        hp: 0,
        criticalRate: 0,
        beastDamageMultiplier: 1,
        beastDamageReduction: 0,
        statusResistance: false,
        equippedNames: [] as string[],
      }
    );
};
const createBattleUnitFromBeast = (beast: (typeof BEAST_BATTLE_DATA)[number]): BattleUnitState => ({
  id: beast.id,
  name: beast.name,
  maxHp: beast.hp,
  hp: beast.hp,
  attack: beast.attack,
  defense: beast.defense,
  speed: beast.speed,
});
const createRandomBeastUnits = (difficulty: GameDifficulty): (BattleUnitState | null)[] => {
  const count = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
  const candidates = BEAST_BATTLE_DATA.filter(beast => DIFFICULTY_ORDER[beast.difficulty] <= DIFFICULTY_ORDER[difficulty]);
  const beasts = Array.from({ length: count }, () => createBattleUnitFromBeast(candidates[Math.floor(Math.random() * candidates.length)]));
  return [...beasts, ...Array.from({ length: Math.max(0, 3 - beasts.length) }, () => null)];
};
const createInitialBattlePreviewState = (
  equippedItems: Record<string, string> = {},
  beastUnits: (BattleUnitState | null)[] | null = null,
): BattlePreviewState => {
  const heroStats = HERO_BATTLE_STATS_BY_LEVEL[1];
  const equipmentBonus = getHeroBattleEquipmentBonus(equippedItems);
  const mole = BEAST_BATTLE_DATA.find(beast => beast.id === 'mole') ?? BEAST_BATTLE_DATA[0];
  const initialBeasts = beastUnits ?? [createBattleUnitFromBeast(mole), null, null];
  const heroMaxHp = heroStats.hp + equipmentBonus.hp;
  return {
    hero: {
      id: 'hero',
      name: '主人公',
      level: heroStats.level,
      maxHp: heroMaxHp,
      hp: heroMaxHp,
      attack: heroStats.attack + equipmentBonus.attack,
      defense: heroStats.defense + equipmentBonus.defense,
      speed: heroStats.speed,
      criticalRate: equipmentBonus.criticalRate,
      beastDamageMultiplier: equipmentBonus.beastDamageMultiplier,
      beastDamageReduction: equipmentBonus.beastDamageReduction,
      statusResistance: equipmentBonus.statusResistance,
      defending: false,
    },
    allies: [
      { id: 'chibiichi', name: 'ちびいち', maxHp: 80, hp: 80, attack: 7, defense: 3, speed: 6 },
      null,
      null,
    ],
    beasts: initialBeasts,
    logs: [
      `野生の${initialBeasts.filter(Boolean).map(beast => beast?.name).join('、')}が現れた！`,
      '主人公は身構えている。',
      'ちびいちは後ろから応援している。',
      equipmentBonus.equippedNames.length > 0
        ? `装備補正：${equipmentBonus.equippedNames.join('、')}を反映。`
        : '装備補正：戦闘用装備なし。',
    ],
    result: 'ongoing',
    loot: [],
    lootGranted: false,
  };
};
const calculateBattleDamage = (
  attacker: Pick<BattleUnitState, 'attack' | 'criticalRate' | 'beastDamageMultiplier'>,
  target: Pick<BattleUnitState, 'defense' | 'beastDamageReduction'>,
  options: { isBeastTarget?: boolean; isBeastAttacker?: boolean } = {},
) => {
  const baseDamage = Math.max(1, attacker.attack - target.defense);
  const variance = 0.9 + Math.random() * 0.2;
  const critical = Math.random() * 100 < (attacker.criticalRate ?? 0);
  const beastMultiplier = options.isBeastTarget ? (attacker.beastDamageMultiplier ?? 1) : 1;
  const reductionMultiplier = options.isBeastAttacker ? Math.max(0, 1 - (target.beastDamageReduction ?? 0) / 100) : 1;
  const damage = Math.max(1, Math.round(baseDamage * variance * (critical ? 2 : 1) * beastMultiplier * reductionMultiplier));
  return { damage, critical };
};
const rollBattleLoot = (beasts: readonly (BattleUnitState | null)[]): BattleLootEntry[] => {
  const lootMap = new Map<string, BattleLootEntry>();
  beasts.filter((beast): beast is BattleUnitState => Boolean(beast)).forEach(beast => {
    const dropData = BEAST_DROP_DATA.find(drop => drop.beastId === beast.id as BeastId);
    dropData?.drops.forEach(drop => {
      const min = Math.max(0, Math.floor(drop.dropCountMin));
      const max = Math.max(min, Math.floor(drop.dropCountMax));
      const count = min + Math.floor(Math.random() * (max - min + 1));
      if (count <= 0) return;
      const current = lootMap.get(drop.dropItemName) ?? {
        itemId: drop.dropItemId,
        itemName: drop.dropItemName,
        count: 0,
      };
      current.count += count;
      lootMap.set(drop.dropItemName, current);
    });
  });
  return Array.from(lootMap.values());
};
const FARM_GIRL_ACTIVE_STATES: readonly FarmGirlState[] = ['planted', 'growing', 'appeared', 'companion', 'lover'];
const isFarmGirlState = (value: unknown): value is FarmGirlState => (
  value === 'none' ||
  value === 'planted' ||
  value === 'growing' ||
  value === 'appeared' ||
  value === 'companion' ||
  value === 'lover'
);
const createInitialFarmGirls = (): FarmGirlSaveState[] => GIRL_DATA.map(girl => ({
  girlId: girl.id,
  state: 'none',
  plantedDay: null,
  growthProgress: 0,
  lastHarvestDay: null,
  trust: girl.initialTrust,
  unlockedTrustEventIds: [],
}));
const normalizeFarmGirls = (raw: unknown): FarmGirlSaveState[] => {
  const rawEntries = Array.isArray(raw) ? raw : [];
  const rawByGirlId = new Map<string, unknown>(
    rawEntries
      .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
      .map(entry => [(entry as { girlId?: unknown }).girlId, entry])
      .filter((entry): entry is [string, unknown] => typeof entry[0] === 'string')
  );

  return GIRL_DATA.map(girl => {
    const rawEntry = rawByGirlId.get(girl.id);
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      return createInitialFarmGirls().find(state => state.girlId === girl.id)!;
    }
    const entry = rawEntry as Record<string, unknown>;
    return {
      girlId: girl.id,
      state: isFarmGirlState(entry.state) ? entry.state : 'none',
      plantedDay: typeof entry.plantedDay === 'number' && Number.isInteger(entry.plantedDay) && entry.plantedDay > 0 ? entry.plantedDay : null,
      growthProgress: typeof entry.growthProgress === 'number' && Number.isFinite(entry.growthProgress) ? clampNumber(entry.growthProgress, 0, 100) : 0,
      lastHarvestDay: typeof entry.lastHarvestDay === 'number' && Number.isInteger(entry.lastHarvestDay) && entry.lastHarvestDay > 0 ? entry.lastHarvestDay : null,
      trust: typeof entry.trust === 'number' && Number.isFinite(entry.trust) ? clampNumber(entry.trust, 0, 100) : girl.initialTrust,
      unlockedTrustEventIds: Array.isArray(entry.unlockedTrustEventIds)
        ? entry.unlockedTrustEventIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  });
};
const normalizeOwnedGirlSeeds = (raw: unknown): string[] => {
  const savedSeeds = Array.isArray(raw)
    ? raw.filter((seedId): seedId is string => typeof seedId === 'string')
    : [];
  return Array.from(new Set([...INITIAL_OWNED_GIRL_SEEDS, ...savedSeeds]));
};
const createInitialFarmFieldSlots = (difficultyId: GameDifficulty): FarmFieldSlotState[] => (
  getInitiallyUnlockedFarmFieldConfigs(difficultyId).flatMap(config => (
    Array.from({ length: config.slotCount }, (_, index) => ({
      fieldId: config.fieldId,
      slotIndex: index + 1,
      girlId: null,
      state: 'none',
      plantedDay: null,
    }))
  ))
);
const normalizeFarmFieldSlots = (raw: unknown, difficultyId: GameDifficulty): FarmFieldSlotState[] => {
  const rawEntries = Array.isArray(raw) ? raw : [];
  const rawBySlotKey = new Map<string, unknown>(
    rawEntries
      .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
      .map(entry => {
        const slot = entry as { fieldId?: unknown; slotIndex?: unknown };
        return [`${slot.fieldId}_${slot.slotIndex}`, entry] as const;
      })
  );

  return createInitialFarmFieldSlots(difficultyId).map(slot => {
    const rawSlot = rawBySlotKey.get(`${slot.fieldId}_${slot.slotIndex}`);
    if (!rawSlot || typeof rawSlot !== 'object' || Array.isArray(rawSlot)) return slot;

    const entry = rawSlot as Record<string, unknown>;
    const girlId = typeof entry.girlId === 'string' && GIRL_DATA.some(girl => girl.id === entry.girlId)
      ? entry.girlId
      : null;
    return {
      ...slot,
      girlId,
      state: girlId && entry.state === 'appeared' ? 'appeared' : girlId ? 'growing' : 'none',
      plantedDay: typeof entry.plantedDay === 'number' && Number.isInteger(entry.plantedDay) && entry.plantedDay > 0
        ? entry.plantedDay
        : null,
    };
  });
};
const isFarmGirlDuplicateBlocked = (farmGirls: readonly FarmGirlSaveState[], girlId: string): boolean => {
  const cropData = FARM_GIRL_CROP_DATA.find(data => data.girlId === girlId);
  if (!cropData?.uniquePerGirl || cropData.canHaveMultiple) return false;
  return farmGirls.some(girl => girl.girlId === girlId && FARM_GIRL_ACTIVE_STATES.includes(girl.state));
};
const INTEREST_RATE_RANGE_BY_DIFFICULTY: Readonly<Record<GameDifficulty, { min: number; max: number }>> = {
  easy: { min: 1.0, max: 3.2 },
  normal: { min: 1.5, max: 4.2 },
  hard: { min: 2.0, max: 5.0 },
};
const FARM_CREDIT_INTEREST_DISCOUNTS = [
  { min: 80, discount: 1.2 },
  { min: 60, discount: 0.8 },
  { min: 40, discount: 0.5 },
  { min: 20, discount: 0.2 },
  { min: 0, discount: 0 },
] as const;
const MISSED_REPAYMENT_PENALTY_RATE = 0.5;
const MIN_INTEREST_RATE = 0.5;
const MAX_INTEREST_RATE = 8.0;
const getInitialDebtAmount = (difficultyId: GameDifficulty) => INITIAL_DEBT_BY_DIFFICULTY[difficultyId];
const getFarmCreditInterestDiscount = (farmCredit: number) => (
  FARM_CREDIT_INTEREST_DISCOUNTS.find(entry => farmCredit >= entry.min)?.discount ?? 0
);
const getMissedRepaymentPenalty = (missedRepaymentCount: number) => Math.max(0, missedRepaymentCount) * MISSED_REPAYMENT_PENALTY_RATE;
const createWeeklyInterestRate = (
  difficultyId: GameDifficulty,
  farmCredit: number,
  missedRepaymentCount: number,
  random = Math.random,
) => {
  const range = INTEREST_RATE_RANGE_BY_DIFFICULTY[difficultyId];
  const baseRate = range.min + (range.max - range.min) * random();
  const rate = baseRate - getFarmCreditInterestDiscount(farmCredit) + getMissedRepaymentPenalty(missedRepaymentCount);
  return Number(clampNumber(rate, MIN_INTEREST_RATE, MAX_INTEREST_RATE).toFixed(1));
};
const DIFFICULTY_OPTIONS: { id: GameDifficulty; label: string; debt: number; desc: string }[] = [
  { id: 'easy', label: 'イージー', debt: INITIAL_DEBT_BY_DIFFICULTY.easy, desc: '借金額 500万円' },
  { id: 'normal', label: 'ノーマル', debt: INITIAL_DEBT_BY_DIFFICULTY.normal, desc: '借金額 2000万円' },
  { id: 'hard', label: 'ハード', debt: INITIAL_DEBT_BY_DIFFICULTY.hard, desc: '借金額 1億円' },
];
const DEFAULT_DEBT = getInitialDebtAmount('hard');

const loadFishingFanConfigs = (): Record<string, FishingFanConfig> => {
  try {
    const saved = localStorage.getItem('farm_fishing_fan_configs');
    if (!saved) return DEFAULT_FISHING_FAN_CONFIGS;
    const parsed = JSON.parse(saved) as Record<string, Partial<FishingFanConfig>>;
    return Object.entries(parsed).reduce<Record<string, FishingFanConfig>>((configs, [rodName, config]) => {
      configs[rodName] = {
        width: typeof config.width === 'number' ? config.width : DEFAULT_FISHING_FAN_CONFIG.width,
        height: typeof config.height === 'number' ? config.height : DEFAULT_FISHING_FAN_CONFIG.height,
        opacity: typeof config.opacity === 'number' ? config.opacity : DEFAULT_FISHING_FAN_CONFIG.opacity,
      };
      return configs;
    }, { ...DEFAULT_FISHING_FAN_CONFIGS });
  } catch {
    return DEFAULT_FISHING_FAN_CONFIGS;
  }
};

export default function App() {
  const [pos, setPos] = useState({ x: 960, y: 540 }); // 起動（リセット）時は常にマップ中央からスタート
  const [dir, setDir] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [isWalking, setIsWalking] = useState(false);
  const [scale, setScale] = useState(1);
  const keys = useRef<{ [key: string]: boolean }>({});
  const posRef = useRef(pos);
  useEffect(() => { posRef.current = pos; }, [pos]);
  const [bootMode, setBootMode] = useState<'title' | 'loadingSave' | 'playing'>('title');
  const [titlePanelMode, setTitlePanelMode] = useState<'none' | 'new' | 'difficulty' | 'load' | 'config'>('none');
  const [currentSaveSlot, setCurrentSaveSlot] = useState(1);
  const [startingNewGame, setStartingNewGame] = useState(false);
  const [pendingNewGameSlot, setPendingNewGameSlot] = useState<number | null>(null);
  const [pendingNewGameDifficulty, setPendingNewGameDifficulty] = useState<GameDifficulty>('hard');
  const [systemSlotMode, setSystemSlotMode] = useState<'none' | 'save' | 'load'>('none');
  const [saveSlotSummaries, setSaveSlotSummaries] = useState<SaveSlotSummary[]>([]);
  const [pendingDeleteSaveSlot, setPendingDeleteSaveSlot] = useState<number | null>(null);
  const [pendingOverwriteSaveSlot, setPendingOverwriteSaveSlot] = useState<number | null>(null);
  const [missingSaveSlot, setMissingSaveSlot] = useState<number | null>(null);
  const autoSaveBlockedSlotsRef = useRef<Set<number>>(new Set());

  const [setupMode, setSetupMode] = useState<'none' | 'animation' | 'collision' | 'hideArea' | 'doors' | 'footstep' | 'crops' | 'bed' | 'bathTub'>('none');

  // RPGメニュー状態
  const [menuOpen, setMenuOpen] = useState(true);
  const [battlePreviewOpen, setBattlePreviewOpen] = useState(false);
  const [battlePreviewState, setBattlePreviewState] = useState<BattlePreviewState>(createInitialBattlePreviewState);
  const menuOpenRef = useRef(false);
  const [menuSelectedIndex, setMenuSelectedIndex] = useState(3);
  const menuSelectedIndexRef = useRef(3);
  const [menuFocusArea, setMenuFocusArea] = useState<'nav' | 'content'>('nav');
  const menuFocusAreaRef = useRef<'nav' | 'content'>('nav');
  const [menuContentFocus, setMenuContentFocus] = useState<'primary' | 'secondary'>('primary');
  const menuContentFocusRef = useRef<'primary' | 'secondary'>('primary');
  const MENU_ITEMS = [
    { id: 'item',      label: 'アイテム',   icon: '🎒' },
    { id: 'equipment', label: '装備',       icon: '⚔️' },
    { id: 'status',    label: 'スキルツリー', icon: '🌳' },
    { id: 'farm',      label: '農場',       icon: '🌾' },
    { id: 'zukan',     label: '図鑑',       icon: '📖' },
    { id: 'system',    label: 'システム',   icon: '⚙️' },
  ] as const;
  type MenuItemId = typeof MENU_ITEMS[number]['id'];
  const selectedMenuItem = MENU_ITEMS[menuSelectedIndex] ?? MENU_ITEMS[0];
  const menuPanelBaseStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, rgba(59, 38, 26, 0.86) 0%, rgba(28, 19, 15, 0.9) 100%)',
    border: '1px solid rgba(232, 184, 122, 0.32)',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0 18px 36px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,241,210,0.12)',
    backdropFilter: 'blur(6px)',
  };
  const menuTinyLabelStyle: React.CSSProperties = {
    color: '#dda15e',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: '0.06em',
  };
  const menuValueStyle: React.CSSProperties = {
    color: '#fdf6e3',
    fontSize: 16,
    fontWeight: 'bold',
  };
  const renderStars = (value: number) => Array.from({ length: 5 }).map((_, index) => {
    const isActive = index < value;
    return (
      <span
        key={index}
        style={{
          display: 'inline-block',
          color: isActive ? '#ffd45a' : '#5a4634',
          fontSize: '1.08em',
          lineHeight: 1,
          marginRight: 2,
          transform: isActive ? 'translateY(-1px) rotate(-4deg)' : 'none',
          filter: isActive ? 'drop-shadow(0 2px 0 #9a5a17) drop-shadow(0 4px 5px rgba(0,0,0,0.35))' : 'none',
          textShadow: isActive
            ? '0 -1px 0 #fff2a8, 1px 0 0 #f29a2e, -1px 1px 0 #b86a1d, 0 0 8px rgba(255, 210, 83, 0.45)'
            : '0 1px 0 rgba(0,0,0,0.45)',
        }}
      >
        ★
      </span>
    );
  });
  const menuGirls = Array.from({ length: 15 }).map((_, index) => ({
    name: ['ちびいち', 'ルビー', 'メル'][index] ?? `娘${String(index + 1).padStart(2, '0')}`,
    trait: ['素直', '内気', '勝気', '甘えん坊', '好奇心旺盛'][index % 5],
    stage: ['未受精', '受精準備', '受精初期'][index % 3],
    level: 1,
    affinity: 1,
    cardImg: FARM_GIRL_CARD_IMAGES[index] ?? FARM_GIRL_CARD_BACK_SRC,
    detailImg: ['/img/chibiichi-pro.jpg', '/img/ruby-pro.jpg', '/img/mel-pro.jpg'][index] ?? '/img/card.png',
  }));
  const [itemMenuTab, setItemMenuTab] = useState('消耗品');
  const itemMenuTabRef = useRef('消耗品');
  const [selectedItemName, setSelectedItemName] = useState('薬草');
  const selectedItemNameRef = useRef('薬草');
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState('主人公-slot1');
  const selectedEquipmentSlotRef = useRef('主人公-slot1');
  const [equipmentActionOpen, setEquipmentActionOpen] = useState(false);
  const [selectedEquipmentOptionIndex, setSelectedEquipmentOptionIndex] = useState(0);
  const selectedEquipmentOptionIndexRef = useRef(0);
  const [equippedItems, setEquippedItems] = useState<Record<string, string>>(() => ({ ...INITIAL_EQUIPPED_ITEMS }));
  const equippedItemsRef = useRef(equippedItems);
  const [selectedSkillName, setSelectedSkillName] = useState('農具の扱い');
  const selectedSkillNameRef = useRef('農具の扱い');
  const [selectedStatusGirlIndex, setSelectedStatusGirlIndex] = useState(0);
  const selectedStatusGirlIndexRef = useRef(0);
  const [selectedFarmGirlIndex, setSelectedFarmGirlIndex] = useState(0);
  const selectedFarmGirlIndexRef = useRef(0);
  const [farmGirlDetailOpen, setFarmGirlDetailOpen] = useState(false);
  const [farmGirls, setFarmGirls] = useState<FarmGirlSaveState[]>(createInitialFarmGirls);
  const [ownedGirlSeeds, setOwnedGirlSeeds] = useState<string[]>(() => [...INITIAL_OWNED_GIRL_SEEDS]);
  const [farmFieldSlots, setFarmFieldSlots] = useState<FarmFieldSlotState[]>(() => createInitialFarmFieldSlots('hard'));
  const [plantingSeedId, setPlantingSeedId] = useState<string | null>(null);
  const [recipeDetailOpen, setRecipeDetailOpen] = useState(false);
  const [selectedRecipeName, setSelectedRecipeName] = useState('');
  const [craftRecipeSelectMode, setCraftRecipeSelectMode] = useState(false);
  const [craftConfirmRecipeName, setCraftConfirmRecipeName] = useState<CraftRecipeId | null>(null);
  const [craftInsufficientRecipeName, setCraftInsufficientRecipeName] = useState<CraftRecipeId | null>(null);
  const [craftMiniGameOpen, setCraftMiniGameOpen] = useState(false);
  const [craftMiniGameRecipeName, setCraftMiniGameRecipeName] = useState<CraftRecipeId | null>(null);
  const [craftMiniGameCircles, setCraftMiniGameCircles] = useState<CraftCircle[]>([]);
  const [craftMiniGameScore, setCraftMiniGameScore] = useState(0);
  const [craftMiniGameTargetCount, setCraftMiniGameTargetCount] = useState(0);
  const [craftMiniGameSpawnedCount, setCraftMiniGameSpawnedCount] = useState(0);
  const [craftMiniGameResult, setCraftMiniGameResult] = useState<'success' | 'fail' | null>(null);
  const [selectedFarmFacilityIndex, setSelectedFarmFacilityIndex] = useState(0);
  const selectedFarmFacilityIndexRef = useRef(0);
  const [zukanFilter, setZukanFilter] = useState('通常');
  const zukanFilterRef = useRef('通常');
  const [selectedZukanIndex, setSelectedZukanIndex] = useState(0);
  const selectedZukanIndexRef = useRef(0);
  const [caughtFishIds, setCaughtFishIds] = useState<string[]>([]);
  const [nushiCaughtFishIds, setNushiCaughtFishIds] = useState<string[]>([]);
  const [fishBestSizes, setFishBestSizes] = useState<Record<string, number>>({});
  const [fishSizeUpdatedIds, setFishSizeUpdatedIds] = useState<string[]>([]);
  const [fishInventorySizes, setFishInventorySizes] = useState<Record<string, number[]>>({});
  const [lumberInventorySizes, setLumberInventorySizes] = useState<Record<string, number[]>>({});
  const [oreInventoryWeights, setOreInventoryWeights] = useState<Record<string, number[]>>({});
  const [depletedMiningPointIds, setDepletedMiningPointIds] = useState<Record<string, boolean>>({});
  const [activeMiningPointId, setActiveMiningPointId] = useState<string | null>(null);
  const [systemNotice, setSystemNotice] = useState('システム項目を選択してください。');
  const systemNoticeRef = useRef('システム項目を選択してください。');
  const [selectedSystemActionIndex, setSelectedSystemActionIndex] = useState(0);
  const selectedSystemActionIndexRef = useRef(0);
  const [gold, setGold] = useState(5000);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('hard');
  const [debtAmount, setDebtAmount] = useState(() => getInitialDebtAmount('hard'));
  const [repaymentCycleDays, setRepaymentCycleDays] = useState(DEFAULT_REPAYMENT_CYCLE_DAYS);
  const [farmCredit, setFarmCredit] = useState(0);
  const [missedRepaymentCount, setMissedRepaymentCount] = useState(0);
  const [hasBeastPremonition, setHasBeastPremonition] = useState(false);
  const [premonitionDay, setPremonitionDay] = useState<number | null>(null);
  const [scheduledBeastAttackDay, setScheduledBeastAttackDay] = useState<number | null>(null);
  const [beastAttackPending, setBeastAttackPending] = useState(false);
  const [companionGirlId, setCompanionGirlId] = useState<string | null>(null);
  const [currentWeeklyInterestRate, setCurrentWeeklyInterestRate] = useState(() => createWeeklyInterestRate('hard', 0, 0));
  const [interestRateCycleIndex, setInterestRateCycleIndex] = useState(0);
  const [currentAP, setCurrentAP] = useState(5);
  const [kurumiTradeTotal, setKurumiTradeTotal] = useState(0);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>(() => ({ ...INITIAL_INVENTORY_COUNTS }));
  const heroLevel = 1;
  const maxAPPerTimeSlot = 5 + Math.max(0, heroLevel - 1);
  const actionCountLabel = `${currentAP}/${maxAPPerTimeSlot}`;
  const companionGirlName = companionGirlId
    ? GIRL_DATA.find(girl => girl.id === companionGirlId)?.girlName ?? companionGirlId
    : null;
  const [shopItems, setShopItems] = useState<ShopItem[]>([
    { name: '薬草', price: 120, stock: 8, type: '買う', desc: '体力を少し回復する定番の薬草です。' },
    { name: '携帯おにぎり', price: 260, stock: 5, type: '買う', desc: '探索前の腹ごしらえに便利です。' },
    { name: '小さな釣り餌', price: 80, stock: 12, type: '買う', desc: '川釣りで使える小さな餌です。' },
    { name: '【レシピ】のこぎり', price: 500, stock: 1, type: '買う', desc: 'のこぎりの作り方が書かれたレシピです。' },
    { name: '【レシピ】つるはし', price: 500, stock: 1, type: '買う', desc: 'つるはしの作り方が書かれたレシピです。' },
    { name: '木材', price: 40, stock: 20, type: '売る', desc: '農場設備の修理にも使える素材です。' },
    { name: '川魚の鱗', price: 180, stock: 3, type: '売る', desc: '光沢のある素材。くるみが買い取ってくれます。' },
  ]);
  const fishShopItems = FISH_ZUKAN_ENTRIES.flatMap<ShopItem>(fish => {
    if (fish.sellable === false) return [];
    const priceCounts = new Map<number, { count: number; sizes: number[] }>();
    (fishInventorySizes[fish.name] ?? []).forEach(size => {
      const price = getFishSellPrice(fish, size);
      if (price === null) return;
      const current = priceCounts.get(price) ?? { count: 0, sizes: [] };
      current.count += 1;
      current.sizes.push(size);
      priceCounts.set(price, current);
    });
    return Array.from(priceCounts.entries())
      .sort(([priceA], [priceB]) => priceB - priceA)
      .map(([price, { count, sizes }]) => {
        const maxSize = Math.max(...sizes);
        const nushi = sizes.some(size => isNushiSize(fish, size));
        return {
          name: `${fish.name} ${maxSize.toFixed(1)}cm${nushi ? ' ヌシ' : ''}`,
          fishName: fish.name,
          fishPrice: price,
          price,
          stock: count,
          type: '売る',
          desc: `${fish.name} ${maxSize.toFixed(1)}cm。${nushi ? 'ヌシ価格で特別に高く買い取ります。' : 'サイズに応じた価格で買い取ります。'}`,
        };
      });
  });
  const lumberShopItems = LUMBER_DATA.flatMap<ShopItem>(lumber => {
    const priceCounts = new Map<number, { count: number; sizes: number[] }>();
    (lumberInventorySizes[lumber.name] ?? []).forEach(size => {
      const price = getLumberSellPrice(lumber, size);
      const current = priceCounts.get(price) ?? { count: 0, sizes: [] };
      current.count += 1;
      current.sizes.push(size);
      priceCounts.set(price, current);
    });
    return Array.from(priceCounts.entries())
      .sort(([priceA], [priceB]) => priceB - priceA)
      .map(([price, { count, sizes }]) => {
        const maxSize = Math.max(...sizes);
        return {
          name: `${lumber.name} ${maxSize.toFixed(1)}cm`,
          sizedInventoryName: lumber.name,
          sizedInventoryPrice: price,
          price,
          stock: count,
          type: '売る',
          desc: `${lumber.name} ${maxSize.toFixed(1)}cm。サイズに応じた価格で買い取ります。`,
        };
      });
  });
  const oreShopItems = ORE_DATA.flatMap<ShopItem>(ore => {
    const priceCounts = new Map<number, { count: number; weights: number[] }>();
    (oreInventoryWeights[ore.name] ?? []).forEach(weight => {
      const price = getOreSellPrice(ore, weight);
      const current = priceCounts.get(price) ?? { count: 0, weights: [] };
      current.count += 1;
      current.weights.push(weight);
      priceCounts.set(price, current);
    });
    return Array.from(priceCounts.entries()).sort(([a], [b]) => b - a).map(([price, { count, weights }]) => ({
      name: `${ore.name} ${Math.max(...weights).toLocaleString()}g`,
      sizedInventoryName: ore.name,
      sizedInventoryPrice: price,
      price,
      stock: count,
      type: '売る',
      desc: `${ore.name}。重量に応じた価格で買い取ります。`,
    }));
  });
  const farmHarvestShopItems = FARM_GIRL_CROP_DATA.flatMap<ShopItem>(crop => {
    const stock = inventoryCounts[crop.harvestItemName] ?? 0;
    if (stock <= 0) return [];
    const farmGirl = farmGirls.find(girl => girl.girlId === crop.girlId);
    const price = getFarmHarvestSellPrice(crop, getFarmTrustBonus(farmGirl?.trust ?? 0).sellMultiplier);
    return [{
      name: crop.harvestItemName,
      price,
      stock,
      type: '売る',
      desc: `${crop.harvestItemName}。農場で収穫した作物です。`,
    }];
  });
  const shopItemsForDisplay = [
    ...shopItems.filter(item => (
      item.type === '買う' &&
      item.stock > 0 &&
      (!isRecipeItemName(item.name) || (inventoryCounts[item.name] ?? 0) === 0)
    )),
    ...fishShopItems,
    ...lumberShopItems,
    ...oreShopItems,
    ...farmHarvestShopItems,
    ...shopItems.filter(item => item.type === '売る' && (inventoryCounts[item.name] ?? 0) > 0),
  ];
  const renderMenuDetail = (id: MenuItemId) => {
    const tabs = ['消耗品', '素材', '装備品', '売却品', 'だいじなもの'];
    const stats = [
      ['攻撃力', 12],
      ['防御力', 8],
      ['素早さ', 10],
      ['魅力', 14],
    ];
    const skillTreeBranches = [
      {
        label: '農作業',
        color: 'emerald',
        skills: ['農具の扱い', '連続耕し', '収穫効率', '水やり上手', '豊作の勘'],
      },
      {
        label: '探索',
        color: 'sky',
        skills: ['採取上手', '釣り勘', '足取り軽快', '洞窟慣れ', '滝裏探索'],
      },
      {
        label: '交渉・防衛',
        color: 'amber',
        skills: ['交渉術', '防衛指揮', '威圧耐性', '罠の知識', '守りの采配'],
      },
    ];
    const skillNodes = skillTreeBranches.flatMap(branch => branch.skills);
    const zukanCards = Array.from({ length: 15 }).map((_, index) => ['通常', '妊娠', 'レア', '未入手'][index % 4]);
    const itemByTab = createItemMenuItems(inventoryCounts);
    const getOwnedMenuItems = (items: string[]) => items.filter(name => (inventoryCounts[name] ?? 0) > 0);
    const selectedTabItems = getOwnedMenuItems(itemByTab[itemMenuTab] ?? itemByTab['消耗品']);
    const activeItem = selectedTabItems.includes(selectedItemName) ? selectedItemName : selectedTabItems[0] ?? '';
    const activeRecipe = activeItem ? RECIPE_DETAILS[activeItem] : undefined;

    if (id === 'item') {
      return (
        <>
          <div className="grid grid-cols-[190px_1fr_260px] gap-4 h-full">
            <div className="flex flex-col gap-2">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setItemMenuTab(tab); setSelectedItemName(getOwnedMenuItems(itemByTab[tab])[0] ?? ''); }}
                  onMouseEnter={() => { if (itemMenuTab !== tab) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setItemMenuTab(tab); setSelectedItemName(getOwnedMenuItems(itemByTab[tab])[0] ?? ''); }}
                  style={{ ...menuPanelBaseStyle, background: itemMenuTab === tab ? 'rgba(74,88,35,0.82)' : menuPanelBaseStyle.background }}
                  className="text-left cursor-pointer hover:brightness-125"
                >
                  <div style={menuValueStyle}>{tab}</div>
                  <div style={menuTinyLabelStyle}>{itemMenuTab === tab ? '選択中' : `${getOwnedMenuItems(itemByTab[tab]).length}個`}</div>
                </button>
              ))}
            </div>
            <div style={menuPanelBaseStyle}>
              {selectedTabItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectedTabItems.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    onPointerDown={() => {
                      setMenuFocusArea('content');
                      setMenuContentFocus('secondary');
                      setSelectedItemName(name);
                      if (!craftRecipeSelectMode && RECIPE_DETAILS[name]) {
                        openRecipeDetail(name);
                      }
                    }}
                    onMouseEnter={() => { if (activeItem !== name) playCursorSound(); }}
                    onClick={() => {
                      setMenuFocusArea('content');
                      setMenuContentFocus('secondary');
                      setSelectedItemName(name);
                      if (craftRecipeSelectMode && itemMenuTab === 'だいじなもの') {
                        handleCraftRecipeSelected(name);
                      } else {
                        playFixSound();
                        if (RECIPE_DETAILS[name]) openRecipeDetail(name);
                      }
                    }}
                    className={`flex justify-between items-center px-4 py-3 border rounded cursor-pointer text-left ${activeItem === name ? 'bg-[#bc6c25]/45 border-white' : 'bg-black/35 border-[#5a3010] hover:bg-[#3a2418]'}`}
                  >
                    <span className="text-[#fdf6e3] font-bold">{name}</span>
                    <span className="text-[#dda15e] text-sm">x{inventoryCounts[name] ?? 0}</span>
                  </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-[#c8a87a]">
                  このカテゴリの所持アイテムはありません。
                </div>
              )}
            </div>
            <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
              <div style={menuTinyLabelStyle}>選択アイテム</div>
              <div className="text-[#fdf6e3] text-2xl font-bold">{activeItem || '未所持'}</div>
              <div className="text-[#c8a87a] leading-relaxed">
                カテゴリ: {itemMenuTab}<br />
                {craftRecipeSelectMode ? '作りたいレシピを選んでください。' : '使用・確認・整理の対象になります。'}
              </div>
              {craftRecipeSelectMode && (
                <button
                  disabled={!activeItem || !isCraftRecipeId(activeItem)}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCraftRecipeSelected(activeItem);
                  }}
                  className="mt-auto bg-[#8d6420] hover:bg-[#b87924] border-2 border-[#ffd166] rounded px-4 py-3 font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                >
                  このレシピで作る
                </button>
              )}
              {!activeRecipe && (
                <button disabled={!activeItem} onClick={() => { playFixSound(); setDialogMessage(`${activeItem}を確認しました。`); }} className="mt-auto bg-[#4a5823] hover:bg-[#60732d] border-2 border-[#a3b18a] rounded px-4 py-3 font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-45">
                  確認する
                </button>
              )}
            </div>
          </div>
        </>
      );
    }

    if (id === 'equipment') {
      const equipmentCharacters = [
        {
          label: '主人公',
          img: '/img/player.png?v=20260616-player-1',
          level: 1,
          role: '農具・探索',
          affinity: 1,
          slotLabels: ['釣具・武器系', '採取道具系', '採取道具系', 'アクセサリー・防具'],
          slots: [
            equippedItems['主人公-slot1'] || '未装備',
            equippedItems['主人公-slot2'] || '未装備',
            equippedItems['主人公-slot3'] || '未装備',
            equippedItems['主人公-slot4'] || '未装備',
          ],
          stats: [12, 8, 10, 14],
          description: '農具と探索を担当します。装備で移動や作業効率を伸ばせます。',
        },
        {
          label: 'ちびいち',
          img: '/img/chibiichi.png?v=20260616-restore-2',
          level: 1,
          role: '農場サポート',
          affinity: 2,
          slotLabels: ['slot1', 'slot2'],
          slots: [
            equippedItems['ちびいち-slot1'] || '未装備',
            equippedItems['ちびいち-slot2'] || '未装備',
          ],
          stats: [6, 5, 16, 18],
          description: 'サポート役として農場を手伝います。素早さと魅力が高めです。',
        },
      ];
      const selectedEquipmentCharacter = equipmentCharacters.find(char => selectedEquipmentSlot.startsWith(char.label)) ?? equipmentCharacters[0];
      const selectedEquipmentSlotMatch = /slot(\d+)$/.exec(selectedEquipmentSlot);
      const selectedEquipmentSlotIndex = selectedEquipmentSlotMatch ? Math.max(0, Number(selectedEquipmentSlotMatch[1]) - 1) : 0;
      const selectedEquipmentSlotLabel = selectedEquipmentCharacter.slotLabels[selectedEquipmentSlotIndex] ?? `slot${selectedEquipmentSlotIndex + 1}`;
      const selectedEquippedItem = equippedItems[selectedEquipmentSlot] || '';
      const equipmentOptionsBySlot: Record<string, string[]> = {
        '釣具・武器系': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿', '木剣', '獣殺し', '天の裁き'],
        '採取道具系': ['のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし'],
        'アクセサリー・防具': ['農神の指輪', FISHING_NUSHI_RING_NAME, FISHING_NUSHI_DEBUG_RING_NAME, '毛皮の服', '剛牙の鎧', '神域の加護'],
        'slot1': ['小さな鈴'],
        'slot2': [],
      };
      const equippedItemNames = Object.entries(equippedItems)
        .filter(([slotId, name]) => slotId !== selectedEquipmentSlot && Boolean(name))
        .map(([, name]) => name);
      const equipableItems = (equipmentOptionsBySlot[selectedEquipmentSlotLabel] ?? []).filter(name => (
        (inventoryCounts[name] ?? 0) > 0 && !equippedItemNames.includes(name)
      ));
      return (
        <div className="grid h-full min-h-0 grid-cols-[58%_1fr] gap-5 pb-10">
          <div style={menuPanelBaseStyle} className="grid h-full min-h-0 grid-cols-2 gap-4 overflow-hidden">
            {equipmentCharacters.map((char) => (
              <button
                key={char.label}
                type="button"
                onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedEquipmentSlot(`${char.label}-slot1`); }}
                onMouseEnter={() => { if (!selectedEquipmentSlot.startsWith(char.label)) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setEquipmentActionOpen(false); setSelectedEquipmentSlot(`${char.label}-slot1`); }}
                className={`farm-menu-character-stage relative flex cursor-pointer flex-col items-center justify-end overflow-hidden border p-4 pb-6 ${selectedEquipmentSlot.startsWith(char.label) ? 'is-selected border-white ring-4 ring-[#ffd166]/50' : 'border-[#5a3010]'}`}
              >
                <div className="absolute inset-x-8 bottom-24 h-28 rounded-full bg-black/30 blur-xl" />
                <img src={char.img} className="relative z-10 max-h-[545px] min-h-0 w-full flex-1 object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.45)]" alt={char.label} />
                <div className="relative z-20 mt-3 min-h-[82px] w-full rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-left">
                  <div className="truncate text-2xl font-bold leading-tight text-[#fdf6e3]">{char.label}</div>
                  <div className="text-xl">{renderStars(char.affinity)}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={menuPanelBaseStyle} className="flex min-h-0 flex-col gap-4 overflow-hidden">
              <div key={selectedEquipmentCharacter.label} className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-20 h-24 rounded border border-[#f1c27d]/60 bg-black/35 overflow-hidden flex items-end justify-center">
                    <img src={selectedEquipmentCharacter.img} className="max-h-full w-full object-contain" alt={selectedEquipmentCharacter.label} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[#fdf6e3] text-3xl font-bold leading-tight">{selectedEquipmentCharacter.label}</div>
                    <div className="mt-1 text-[#dda15e] text-sm font-bold">Lv {selectedEquipmentCharacter.level} / {selectedEquipmentCharacter.role}</div>
                    <div className="mt-1 text-xl">{renderStars(selectedEquipmentCharacter.affinity)}</div>
                  </div>
                </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedEquipmentCharacter.slots.map((item, slotIndex) => {
                  const slot = `slot${slotIndex + 1}`;
                  const slotId = `${selectedEquipmentCharacter.label}-${slot}`;
                  return (
                  <button
                    key={slot}
                    type="button"
                    onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedEquipmentSlot(slotId); setEquipmentActionOpen(true); }}
                    onMouseEnter={() => { if (selectedEquipmentSlot !== slotId) playCursorSound(); }}
                    onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedEquipmentSlot(slotId); setEquipmentActionOpen(true); }}
                    className={`text-left rounded px-3 py-2 cursor-pointer ${selectedEquipmentSlot === slotId ? 'bg-[#bc6c25]/45 border-2 border-white ring-2 ring-[#ffd166]/55' : 'bg-black/35 border border-[#5a3010] hover:bg-[#3a2418]'}`}
                  >
                    <div style={menuTinyLabelStyle}>{selectedEquipmentCharacter.slotLabels[slotIndex] ?? slot}</div>
                    <div style={menuValueStyle}>{item}</div>
                    {selectedEquipmentSlot === slotId && (
                      <div className="mt-1 text-[10px] text-[#ffd166] font-bold">
                        {equipmentActionOpen ? '操作中' : 'Enter / クリックで操作'}
                      </div>
                    )}
                  </button>
                )})}
              </div>
              {equipmentActionOpen && menuContentFocus === 'secondary' && (
                <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-lg border-2 border-[#dda15e] bg-black/35 p-4 shadow-inner">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div style={menuTinyLabelStyle}>装備操作</div>
                      <div className="text-[#fdf6e3] text-lg font-bold">{selectedEquipmentSlotLabel}</div>
                    </div>
                    <div className="text-right text-[11px] text-[#c8a87a] leading-snug">Esc / ← で戻る<br />Enterで決定</div>
                  </div>
                  {selectedEquippedItem ? (
                    <div className="mt-3 rounded border border-[#5a3010] bg-[#2d1b15]/72 p-3">
                      <div className="text-[#c8a87a] text-sm">現在装備中</div>
                      <div className="mt-1 text-[#ffd166] text-xl font-bold">{selectedEquippedItem}</div>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          playFixSound();
                          setEquippedItems(prev => ({ ...prev, [selectedEquipmentSlot]: '' }));
                          setDialogMessage(`${selectedEquippedItem}を外しました。`);
                        }}
                        className="mt-3 w-full rounded border-2 border-white bg-[#7a4317] px-4 py-2 text-[#fdf6e3] font-bold cursor-pointer shadow-[0_0_16px_rgba(255,209,102,0.35)] hover:bg-[#8d4f1b]"
                      >
                        外す
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex min-h-0 flex-1 flex-col">
                      <div className="mb-2 text-[#c8a87a] text-sm">装備欄</div>
                      <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto pr-2">
                        {equipableItems.length > 0 ? equipableItems.map((name, optionIndex) => (
                          <button
                            key={name}
                            type="button"
                            onPointerDown={(e) => { e.stopPropagation(); setSelectedEquipmentOptionIndex(optionIndex); }}
                            onClick={() => {
                              playFixSound();
                              setEquippedItems(prev => ({ ...prev, [selectedEquipmentSlot]: name }));
                              setDialogMessage(`${name}を装備しました。`);
                            }}
                            className={`relative flex min-h-[62px] items-center justify-between gap-2 rounded border px-4 py-3 pl-8 text-left cursor-pointer hover:bg-[#3a2418] ${
                              selectedEquipmentOptionIndex === optionIndex
                                ? 'border-white bg-[#bc6c25]/65 ring-2 ring-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.45)]'
                                : 'border-[#5a3010] bg-[#2d1b15]/72'
                            }`}
                          >
                            {selectedEquipmentOptionIndex === optionIndex && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ffd166] font-black">▶</span>
                            )}
                            <span className="min-w-0 break-keep text-[#fdf6e3] font-bold leading-snug">{name}</span>
                            <span className="shrink-0 text-[#dda15e] text-sm">x{inventoryCounts[name] ?? 0}</span>
                          </button>
                        )) : (
                          <div className="rounded border border-[#5a3010] bg-black/30 px-4 py-3 text-[#c8a87a]">
                            装備できるアイテムがありません。
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {stats.map(([label], index) => (
                  <div key={label} className="flex justify-between bg-black/25 border border-[#5a3010]/70 rounded px-4 py-3">
                    <span className="text-[#c8a87a]">{label}</span>
                    <span className="text-[#fdf6e3] text-xl font-bold">{selectedEquipmentCharacter.stats[index]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 bg-black/30 border border-[#5a3010] rounded p-4 text-[#c8a87a] leading-relaxed">
                {selectedEquipmentCharacter.description}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (id === 'status') {
      const selectedBranch = skillTreeBranches.find(branch => branch.skills.includes(selectedSkillName)) ?? skillTreeBranches[0];
      return (
        <div className="grid grid-cols-[1fr_320px] gap-4 h-full">
          <div style={menuPanelBaseStyle} className="overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[#fdf6e3] text-2xl font-bold">主人公スキルツリー</div>
                <div className="text-[#c8a87a] text-sm">農作業・探索・交渉防衛の3系統</div>
              </div>
              <div className="rounded border border-[#ffd166]/70 bg-black/35 px-3 py-2 text-[#ffd166] font-bold">SP 3</div>
            </div>
            <div className="grid grid-cols-3 gap-4 h-[640px]">
              {skillTreeBranches.map((branch) => (
                <div key={branch.label} className="relative rounded border border-[#5a3010] bg-black/25 p-3 overflow-hidden">
                  <div className="mb-4 text-center text-[#fdf6e3] text-lg font-bold">{branch.label}</div>
                  <div className="absolute left-1/2 top-[70px] bottom-8 w-[2px] -translate-x-1/2 bg-[#bc6c25]/55" />
                  <div className="relative flex h-[560px] flex-col items-center justify-between">
                    {branch.skills.map((skill, index) => {
                      const isSelected = selectedSkillName === skill;
                      const isUnlocked = index < 2;
                      return (
                        <button
                          key={skill}
                          type="button"
                          onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedSkillName(skill); }}
                          onMouseEnter={() => { if (!isSelected) playCursorSound(); }}
                          onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedSkillName(skill); }}
                          className={`relative z-10 w-full rounded-lg border px-3 py-3 text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#bc6c25]/70 border-white shadow-[0_0_18px_rgba(255,209,102,0.38)]'
                              : isUnlocked
                                ? 'bg-[#4a5823]/82 border-[#a3b18a] hover:bg-[#60732d]'
                                : 'bg-[#1a100d]/88 border-[#5a3010] hover:bg-[#3a2418]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${isUnlocked ? 'border-[#ffd166] text-[#ffd166]' : 'border-[#8a7060] text-[#8a7060]'}`}>
                              {index + 1}
                            </span>
                            <span className="text-[#fdf6e3] font-bold">{skill}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#c8a87a]">{isUnlocked ? '習得済み' : '未習得'}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
            <div style={menuTinyLabelStyle}>選択スキル</div>
            <div className="text-[#fdf6e3] text-3xl font-bold">{selectedSkillName}</div>
            <div className="rounded border border-[#5a3010] bg-black/30 p-3">
              <div style={menuTinyLabelStyle}>系統</div>
              <div className="mt-1 text-[#ffd166] text-xl font-bold">{selectedBranch.label}</div>
            </div>
            <div className="rounded border border-[#5a3010] bg-black/30 p-3 text-[#c8a87a] leading-relaxed">
              主人公専用スキルです。農作業の効率、探索時の移動・採取、交渉や防衛の成功率に影響します。
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded border border-[#5a3010] bg-black/25 px-3 py-2">
                  <div className="text-[#c8a87a] text-xs">{label}</div>
                  <div className="text-[#fdf6e3] text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (id === 'farm') {
      const selectedFarmGirl = menuGirls[selectedFarmGirlIndex] ?? menuGirls[0];
      const selectedGirlData = GIRL_DATA.find(girl => girl.girlName === selectedFarmGirl.name);
      const selectedGirlSeed = selectedGirlData
        ? GIRL_SEED_ACQUISITION_DATA.find(seed => seed.girlId === selectedGirlData.id)
        : undefined;
      const selectedFarmGirlState = selectedGirlData
        ? farmGirls.find(girl => girl.girlId === selectedGirlData.id)
        : undefined;
      const selectedGirlSeedOwned = selectedGirlSeed ? ownedGirlSeeds.includes(selectedGirlSeed.seedId) : false;
      const selectedHarvestInfo = selectedGirlData ? getFarmGirlHarvestInfo(selectedGirlData.id) : null;
      const selectedNextTrustEvent = selectedGirlData && selectedFarmGirlState
        ? selectedGirlData.trustEvents.find(event => !selectedFarmGirlState.unlockedTrustEventIds.includes(event.eventId))
        : undefined;
      const selectedTrustBonus = getFarmTrustBonus(selectedFarmGirlState?.trust ?? 0);
      const selectedGirlCanBecomeCompanion = Boolean(
        selectedGirlData &&
        selectedFarmGirlState?.state === 'appeared' &&
        selectedFarmGirlState.trust >= 20
      );
      const selectedGirlIsCompanion = Boolean(selectedGirlData && companionGirlId === selectedGirlData.id);
      const plantingSeedData = plantingSeedId
        ? GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === plantingSeedId)
        : undefined;
      const plantableFarmFieldSlots = getPlantableFarmFieldSlots();
      const unlockTierLabels = { initial: '初期解放', mid: '中盤解放', final: '終盤解放' } as const;
      const farmGirlStateLabels: Record<FarmGirlState, string> = {
        none: '未出現',
        planted: '植え付け中',
        growing: '成長中',
        appeared: '出現中',
        companion: '仲間',
        lover: '恋人',
      };
      const getFarmGirlStateDisplay = (girlId: string, fallbackState: FarmGirlState = 'none') => {
        const farmGirl = farmGirls.find(entry => entry.girlId === girlId);
        const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girlId);
        const state = farmGirl?.state ?? fallbackState;
        if (state === 'growing') {
          return `成長中 ${farmGirl?.growthProgress ?? 0} / ${crop?.growthDays ?? '?'} 日`;
        }
        return farmGirlStateLabels[state];
      };
      const ownedSeedIds = Array.from(new Set(ownedGirlSeeds));
      const ownedGirlSeedRows = ownedSeedIds.flatMap(seedId => {
        const seedData = GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === seedId);
        if (!seedData) return [];
        const girl = GIRL_DATA.find(entry => entry.id === seedData.girlId);
        const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === seedData.girlId);
        const farmGirl = farmGirls.find(entry => entry.girlId === seedData.girlId);
        const canPlant = (farmGirl?.state ?? 'none') === 'none' && !isFarmGirlDuplicateBlocked(farmGirls, seedData.girlId);
        const harvestInfo = getFarmGirlHarvestInfo(seedData.girlId);
        const trustBonus = getFarmTrustBonus(farmGirl?.trust ?? 0);
        return [{
          seedId,
          girlId: seedData.girlId,
          seedName: seedData.seedName,
          girlName: girl?.girlName ?? seedData.girlId,
          cropName: girl?.cropName ?? crop?.harvestItemName ?? '未設定',
          unlockTier: unlockTierLabels[girl?.unlockTier ?? crop?.unlockTier ?? 'initial'],
          state: getFarmGirlStateDisplay(seedData.girlId, farmGirl?.state ?? 'none'),
          canPlant,
          canHarvest: harvestInfo.canHarvest,
          daysUntilHarvest: harvestInfo.daysUntilHarvest,
          harvestItemName: crop?.harvestItemName ?? '未設定',
          harvestAmount: crop ? getFarmHarvestAmount(crop.baseHarvestAmount, farmGirl?.trust ?? 0) : 0,
          harvestPrice: crop ? getFarmHarvestSellPrice(crop, trustBonus.sellMultiplier) : 0,
          harvestMultiplier: trustBonus.harvestMultiplier,
          sellMultiplier: trustBonus.sellMultiplier,
          plantAvailability: canPlant
            ? '植え付け可'
            : '重複不可',
        }];
      });
      const farmOverviewItems = [
        ['現在金利', formatInterestRate(currentWeeklyInterestRate)],
        ['農場信用度', `${farmCredit}`],
        ['信用補正', `-${formatInterestRate(farmCreditInterestDiscount)}`],
        ['返済遅延補正', `+${formatInterestRate(missedRepaymentPenalty)}`],
        ['次回返済まで', `あと${daysUntilRepayment}日`],
        ['借金残額', `¥${debtAmount.toLocaleString()}`],
        ['経過日数', `${currentDay} 日`],
        ['行動回数', actionCountLabel],
      ];
      const farmFacilityItems = ['柵 Lv1', '電気柵 未設置', '箱罠 x2'];
      const farmInfoItems = [...farmOverviewItems, ...farmFacilityItems.map(item => ['設備', item])];
      return (
        <div className="relative grid grid-cols-[220px_1fr_280px] gap-4 h-full">
          <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
            {farmOverviewItems.map(([label, value], index) => (
              <button
                key={label}
                type="button"
                onMouseEnter={() => { if (selectedFarmFacilityIndex !== index) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedFarmFacilityIndex(index); }}
                className={`text-left cursor-pointer rounded p-3 ${selectedFarmFacilityIndex === index ? 'bg-[#bc6c25]/45 border border-white' : 'bg-black/30 border border-[#5a3010]/70 hover:bg-[#3a2418]'}`}
              >
                <div style={menuTinyLabelStyle}>{label}</div>
                <div className="text-[#fdf6e3] text-lg font-bold whitespace-nowrap leading-tight">{value}</div>
              </button>
            ))}
            <div className="mt-auto bg-[#1d120f]/80 border border-[#76502c]/70 rounded p-3">
              <div style={menuTinyLabelStyle}>選択中</div>
              <div className="text-[#fdf6e3] text-2xl font-bold">{selectedFarmGirl.name}</div>
              <div className="mt-1 text-lg">{renderStars(selectedFarmGirl.affinity)}</div>
              <div className="mt-2 text-[#d7b98a] text-sm leading-relaxed">{selectedFarmGirl.trait} / {selectedFarmGirl.stage}</div>
            </div>
          </div>
          <div style={menuPanelBaseStyle} className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div style={menuTinyLabelStyle}>娘カード一覧</div>
                <div className="text-[#fdf6e3] text-lg font-bold leading-tight">クリックで中央に詳細表示</div>
              </div>
              <div className="text-[#d7b98a] text-sm font-bold">{menuGirls.length} / {menuGirls.length}</div>
            </div>
            {hasBeastPremonition && (
              <div className="rounded-lg border border-[#ffd166]/65 bg-[#3a2508]/80 px-3 py-2 text-sm font-black text-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.18)]">
                ⚠ 警戒中
              </div>
            )}
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_270px] gap-3 overflow-hidden">
              <div className="farm-girl-card-grid grid min-h-0 grid-cols-3 gap-3 overflow-hidden">
                {menuGirls.map((girl, index) => (
                  <button
                    key={girl.name}
                    type="button"
                    onMouseEnter={() => { if (selectedFarmGirlIndex !== index) playCursorSound(); }}
                    onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedFarmGirlIndex(index); setFarmGirlDetailOpen(true); setDialogMessage(`${girl.name}の詳細情報を表示しました。`); }}
                    className={`farm-girl-card-button relative overflow-hidden border rounded cursor-pointer text-left ${selectedFarmGirlIndex === index ? 'is-selected border-white' : 'border-[#6b3b2f]'}`}
                  >
                    <img src={girl.cardImg} alt={girl.name} className="absolute inset-0 h-full w-full object-contain p-1.5" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/8 to-transparent" />
                    <div className="absolute left-2 right-2 bottom-2 rounded bg-black/58 border border-white/10 px-2 py-1">
                      <div className="text-[#fff7dc] font-bold text-xs leading-tight">{girl.name}</div>
                      <div className="text-[9px] text-[#ffd45a] leading-none">{renderStars(girl.affinity)}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="min-h-0 rounded border border-[#5a3010]/80 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div style={menuTinyLabelStyle}>所持している娘苗</div>
                    <div className="text-[#fdf6e3] text-xs font-bold">解放済み畑へ植え付け可能</div>
                  </div>
                  <div className="rounded border border-[#ffd166]/55 bg-black/35 px-2 py-1 text-xs font-bold text-[#ffd166]">
                    {ownedGirlSeedRows.length} 種
                  </div>
                </div>
                <div className="grid gap-2">
                  {ownedGirlSeedRows.map(seed => (
                    <div
                      key={seed.seedId}
                      className="rounded border border-[#76502c]/70 bg-[#1d120f]/75 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[#fff7dc]">{seed.seedName}</div>
                        <div className="mt-1 text-xs font-bold text-[#d7b98a]">
                          {seed.girlName} / {seed.cropName}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold leading-relaxed">
                        <div className="rounded bg-black/25 px-2 py-1 text-[#ffd166]">{seed.unlockTier}</div>
                        <div className="rounded bg-black/25 px-2 py-1 text-[#a3b18a]">状態: {seed.state}</div>
                      </div>
                      <button
                        type="button"
                        disabled={!seed.canPlant}
                        onMouseEnter={() => { if (seed.canPlant) playCursorSound(); }}
                        onClick={() => {
                          if (!seed.canPlant) return;
                          playFixSound();
                          setPlantingSeedId(seed.seedId);
                        }}
                        className={`mt-2 w-full rounded border px-3 py-1 text-[11px] font-black transition-colors ${
                          seed.canPlant
                            ? 'border-[#ffd166]/75 bg-[#4a5823]/80 text-[#fff7dc] hover:bg-[#60732d]'
                            : 'border-[#76502c]/70 bg-black/40 text-[#8f7b63] disabled:cursor-not-allowed'
                        }`}
                      >
                        {seed.plantAvailability}
                      </button>
                      {seed.state === '出現中' && (
                        <button
                          type="button"
                          disabled={!seed.canHarvest}
                          onMouseEnter={() => { if (seed.canHarvest) playCursorSound(); }}
                          onClick={() => {
                            if (!seed.canHarvest) return;
                            playFixSound();
                            harvestFarmGirl(seed.girlId);
                          }}
                          className={`mt-2 w-full rounded border px-3 py-1 text-[11px] font-black transition-colors ${
                            seed.canHarvest
                              ? 'border-[#86efac]/80 bg-[#14532d]/85 text-[#f0fdf4] hover:bg-[#166534]'
                              : 'border-[#76502c]/70 bg-black/40 text-[#8f7b63] disabled:cursor-not-allowed'
                          }`}
                        >
                          {seed.canHarvest
                            ? `収穫 ${seed.harvestItemName} x${seed.harvestAmount}`
                            : `次回収穫まであと${seed.daysUntilHarvest ?? 0}日`}
                        </button>
                      )}
                      {seed.state === '出現中' && (
                        <div className="mt-1 text-[10px] font-bold text-[#c8a87a]">
                          売却目安: {seed.harvestPrice.toLocaleString()}G / 個
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { playFixSound(); setFarmGirlDetailOpen(true); setDialogMessage(`${selectedFarmGirl.name}の詳細情報を表示しました。`); }}
              className="farm-girl-card-preview relative overflow-hidden rounded border border-[#f1c27d]/70 cursor-pointer"
            >
              <img src={selectedFarmGirl.cardImg} alt={selectedFarmGirl.name} className="absolute inset-0 h-full w-full object-contain p-2" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-transparent" />
              <div className="absolute left-3 right-3 bottom-3 rounded bg-black/58 border border-white/10 px-3 py-2">
                <div className="text-[#fff7dc] text-2xl font-bold leading-tight">{selectedFarmGirl.name}</div>
                <div className="mt-1 text-lg">{renderStars(selectedFarmGirl.affinity)}</div>
              </div>
            </button>
            <div className="bg-black/30 border border-[#5a3010]/70 rounded px-3 py-3">
              <div style={menuTinyLabelStyle}>詳細</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded bg-black/25 px-2 py-2">
                  <div className="text-[#c8a87a] text-xs">レベル</div>
                  <div className="text-[#fdf6e3] text-lg font-bold">Lv {selectedFarmGirl.level}</div>
                </div>
                <div className="rounded bg-black/25 px-2 py-2">
                  <div className="text-[#c8a87a] text-xs">星</div>
                  <div className="text-[#ffd45a] text-lg font-bold">{selectedFarmGirl.affinity} / 5</div>
                </div>
                <div className="rounded bg-black/25 px-2 py-2">
                  <div className="text-[#c8a87a] text-xs">性格</div>
                  <div className="text-[#fdf6e3] font-bold">{selectedFarmGirl.trait}</div>
                </div>
                <div className="rounded bg-black/25 px-2 py-2">
                  <div className="text-[#c8a87a] text-xs">状態</div>
                  <div className="text-[#fdf6e3] font-bold">{selectedFarmGirl.stage}</div>
                </div>
                <div className="rounded bg-black/25 px-2 py-2">
                  <div className="text-[#c8a87a] text-xs">娘苗所持</div>
                  <div className="text-[#fdf6e3] font-bold">{selectedGirlSeedOwned ? 'あり' : 'なし'}</div>
                </div>
                <div className="rounded bg-black/25 px-2 py-2">
                  <div className="text-[#c8a87a] text-xs">現在状態</div>
                  <div className="text-[#fdf6e3] font-bold">
                    {selectedGirlData
                      ? getFarmGirlStateDisplay(selectedGirlData.id, selectedFarmGirlState?.state ?? 'none')
                      : farmGirlStateLabels[selectedFarmGirlState?.state ?? 'none']}
                  </div>
                </div>
                {selectedGirlData && selectedFarmGirlState && (
                  <div className="col-span-2 rounded bg-black/25 px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[#c8a87a] text-xs">同行</div>
                        <div className={`mt-1 text-sm font-bold ${selectedGirlIsCompanion ? 'text-[#ffd166]' : 'text-[#fdf6e3]'}`}>
                          {selectedGirlIsCompanion ? '⚔ 同行中' : '同行していません'}
                        </div>
                      </div>
                      {selectedGirlIsCompanion ? (
                        <button
                          type="button"
                          onClick={() => {
                            playFixSound();
                            setCompanionGirlId(null);
                            setDialogMessage(`${selectedGirlData.girlName}との同行を解除しました。`);
                          }}
                          className="rounded border border-[#a66a36] bg-[#4b2818] px-3 py-1.5 text-xs font-bold text-[#ffe2ad] transition hover:bg-[#63351d]"
                        >
                          同行解除
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!selectedGirlCanBecomeCompanion}
                          onClick={() => {
                            if (!selectedGirlCanBecomeCompanion) return;
                            playFixSound();
                            setCompanionGirlId(selectedGirlData.id);
                            setDialogMessage(`${selectedGirlData.girlName}と同行することにしました。`);
                          }}
                          className="rounded border border-[#50785d] bg-[#27472d] px-3 py-1.5 text-xs font-bold text-[#dbffe2] transition hover:bg-[#345f3b] disabled:cursor-not-allowed disabled:border-[#4d4d4d] disabled:bg-[#292929] disabled:text-[#8d8d8d]"
                        >
                          同行する
                        </button>
                      )}
                    </div>
                    {!selectedGirlIsCompanion && !selectedGirlCanBecomeCompanion && (
                      <div className="mt-2 text-[11px] text-[#c8a87a]">
                        同行には「出現中」かつ信頼度20以上が必要です。
                      </div>
                    )}
                  </div>
                )}
                {selectedGirlData && selectedFarmGirlState && (
                  <div className="col-span-2 rounded bg-black/25 px-2 py-2">
                    <div className="text-[#c8a87a] text-xs">信頼度</div>
                    <div className="mt-1 text-sm font-bold text-[#fdf6e3]">
                      信頼度 {selectedFarmGirlState.trust} / 100
                    </div>
                    <div className="mt-1 text-xs font-bold text-[#ffd166]">
                      {selectedNextTrustEvent
                        ? `次のイベント：${selectedNextTrustEvent.trust}まであと${Math.max(0, selectedNextTrustEvent.trust - selectedFarmGirlState.trust)}`
                        : '信頼イベントはすべて解放済み'}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold">
                      <div className="rounded bg-black/25 px-2 py-1 text-[#a3b18a]">
                        収穫量補正：×{selectedTrustBonus.harvestMultiplier}
                      </div>
                      <div className="rounded bg-black/25 px-2 py-1 text-[#ffd166]">
                        売値補正：×{selectedTrustBonus.sellMultiplier}
                      </div>
                    </div>
                  </div>
                )}
                {selectedGirlData && selectedHarvestInfo?.crop && selectedFarmGirlState?.state === 'appeared' && (
                  <div className="col-span-2 rounded bg-black/25 px-2 py-2">
                    <div className="text-[#c8a87a] text-xs">収穫</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm font-bold text-[#fdf6e3]">
                        {selectedHarvestInfo.canHarvest
                          ? `${selectedHarvestInfo.crop.harvestItemName} x${getFarmHarvestAmount(selectedHarvestInfo.crop.baseHarvestAmount, selectedFarmGirlState.trust)}`
                          : `次回収穫まであと${selectedHarvestInfo.daysUntilHarvest ?? 0}日`}
                      </div>
                      <button
                        type="button"
                        disabled={!selectedHarvestInfo.canHarvest}
                        onClick={() => {
                          if (!selectedGirlData || !selectedHarvestInfo.canHarvest) return;
                          playFixSound();
                          harvestFarmGirl(selectedGirlData.id);
                        }}
                        className={`shrink-0 rounded border px-3 py-1 text-xs font-black ${
                          selectedHarvestInfo.canHarvest
                            ? 'border-[#86efac]/80 bg-[#14532d]/85 text-[#f0fdf4] hover:bg-[#166534]'
                            : 'border-[#76502c]/70 bg-black/40 text-[#8f7b63] disabled:cursor-not-allowed'
                        }`}
                      >
                        収穫
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {farmFacilityItems.map((item, index) => {
                const facilityIndex = farmOverviewItems.length + index;
                return (
                <button
                  key={item}
                  type="button"
                  onMouseEnter={() => { if (selectedFarmFacilityIndex !== facilityIndex) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedFarmFacilityIndex(facilityIndex); }}
                  className={`text-left cursor-pointer rounded px-3 py-2 text-[#fdf6e3] font-bold ${selectedFarmFacilityIndex === facilityIndex ? 'bg-[#bc6c25]/45 border border-white' : 'bg-black/30 border border-[#5a3010]/70 hover:bg-[#3a2418]'}`}
                >
                  {item}
                </button>
              )})}
            </div>
            <div className="bg-black/30 border border-[#5a3010]/70 rounded px-3 py-2 text-[#d7b98a] text-sm">
              <div style={menuTinyLabelStyle}>選択中の農場項目</div>
              <div className="mt-1 text-[#fdf6e3] font-bold">{farmInfoItems[selectedFarmFacilityIndex]?.[0]}: {farmInfoItems[selectedFarmFacilityIndex]?.[1]}</div>
            </div>
          </div>
          {plantingSeedData && (
            <div
              className="absolute inset-0 z-[90] flex items-center justify-center rounded bg-black/55 px-8 py-6"
              onPointerDown={() => { playFixSound(); setPlantingSeedId(null); }}
            >
              <div
                className="w-[440px] rounded-xl border-2 border-[#ffd166]/80 bg-[#1a100d]/96 p-5 text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.68)]"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div style={menuTinyLabelStyle}>植え付け先を選択</div>
                    <div className="mt-1 text-xl font-black">{plantingSeedData.seedName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { playFixSound(); setPlantingSeedId(null); }}
                    className="flex h-8 w-8 items-center justify-center rounded border border-white/30 bg-black/45 text-lg font-black hover:bg-[#4a241b]"
                    aria-label="植え付け先選択を閉じる"
                  >
                    ×
                  </button>
                </div>
                {plantableFarmFieldSlots.length > 0 ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {plantableFarmFieldSlots.map(slot => (
                      <button
                        key={`${slot.fieldId}_${slot.slotIndex}`}
                        type="button"
                        onMouseEnter={playCursorSound}
                        onClick={() => {
                          playFixSound();
                          plantGirlSeedToSlot(plantingSeedData.seedId, slot.fieldId, slot.slotIndex);
                        }}
                        className="rounded-lg border border-[#a3b18a]/80 bg-[#243a1f]/90 px-3 py-3 text-left font-black text-[#fff7dc] transition-colors hover:border-white hover:bg-[#36572d]"
                      >
                        {getFarmFieldLabel(slot.fieldId)} {slot.slotIndex}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-[#76502c]/80 bg-black/35 px-4 py-5 text-center font-bold text-[#ffd166]">
                    空いている畑がありません
                  </div>
                )}
                <div className="mt-4 text-xs font-bold leading-relaxed text-[#c8a87a]">
                  ※植え付け後も娘苗は恒久アンロックとして所持したままです。APは消費しません。
                </div>
              </div>
            </div>
          )}
          {farmGirlDetailOpen && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/58 px-8 py-6"
              onPointerDown={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setFarmGirlDetailOpen(false); }}
            >
              <div className="farm-girl-detail-modal relative grid h-full max-h-[740px] w-full max-w-[980px] grid-cols-[minmax(0,1fr)_260px] overflow-hidden rounded border border-[#f1c27d]/80 bg-[#160d12] shadow-[0_26px_70px_rgba(0,0,0,0.72)]">
                <button
                  type="button"
                  onPointerDown={(event) => { event.stopPropagation(); playFixSound(); setFarmGirlDetailOpen(false); }}
                  className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded border border-white/35 bg-black/65 text-xl font-bold text-[#fff7dc] hover:bg-[#4a241b]"
                  aria-label="詳細を閉じる"
                >
                  ×
                </button>
                <div
                  className="relative min-h-0 bg-black"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <img src={selectedFarmGirl.detailImg} alt={`${selectedFarmGirl.name} 詳細`} className="absolute inset-0 h-full w-full object-contain" />
                </div>
                <div className="flex flex-col gap-3 border-l border-[#76502c]/70 bg-[#24140f] p-4 pr-5">
                  <div style={menuTinyLabelStyle}>詳細カード</div>
                  <div className="farm-girl-card-preview relative overflow-hidden rounded border border-[#f1c27d]/70">
                    <img src={selectedFarmGirl.cardImg} alt={selectedFarmGirl.name} className="absolute inset-0 h-full w-full object-contain p-2" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-transparent" />
                    <div className="absolute left-3 right-3 bottom-3 rounded bg-black/58 border border-white/10 px-3 py-2">
                      <div className="text-[#fff7dc] text-xl font-bold leading-tight">{selectedFarmGirl.name}</div>
                      <div className="mt-1 text-base">{renderStars(selectedFarmGirl.affinity)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded bg-black/25 px-2 py-2">
                      <div className="text-[#c8a87a] text-xs">レベル</div>
                      <div className="text-[#fdf6e3] text-lg font-bold">Lv {selectedFarmGirl.level}</div>
                    </div>
                    <div className="rounded bg-black/25 px-2 py-2">
                      <div className="text-[#c8a87a] text-xs">星</div>
                      <div className="text-[#ffd45a] text-lg font-bold">{selectedFarmGirl.affinity} / 5</div>
                    </div>
                    <div className="rounded bg-black/25 px-2 py-2">
                      <div className="text-[#c8a87a] text-xs">性格</div>
                      <div className="text-[#fdf6e3] font-bold">{selectedFarmGirl.trait}</div>
                    </div>
                    <div className="rounded bg-black/25 px-2 py-2">
                      <div className="text-[#c8a87a] text-xs">状態</div>
                      <div className="text-[#fdf6e3] font-bold">{selectedFarmGirl.stage}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (id === 'zukan') {
      const isFishZukan = zukanFilter === '魚';
      const zukanFilters = ['通常', '魚', '妊娠', 'レアリティ', '未入手'];
      const selectedFish = FISH_ZUKAN_ENTRIES[Math.min(selectedZukanIndex, FISH_ZUKAN_ENTRIES.length - 1)];
      const selectedFishCaught = !!selectedFish && caughtFishIds.includes(selectedFish.id);
      const selectedFishSizeHistory = selectedFish ? fishInventorySizes[selectedFish.name] ?? [] : [];
      const selectedFishBestSizeFromHistory = selectedFishSizeHistory.length > 0 ? Math.max(...selectedFishSizeHistory) : undefined;
      const selectedFishBestSize = selectedFish ? fishBestSizes[selectedFish.id] ?? selectedFishBestSizeFromHistory : undefined;
      const selectedFishIsNushiCaught = !!selectedFish && (
        nushiCaughtFishIds.includes(selectedFish.id) ||
        (selectedFishBestSize !== undefined && isNushiSize(selectedFish, selectedFishBestSize))
      );
      const selectedFishHasUpdate = !!selectedFish && fishSizeUpdatedIds.includes(selectedFish.id);
      const fishProgress = Math.round((caughtFishIds.length / FISH_ZUKAN_ENTRIES.length) * 100);

      return (
        <div className="flex flex-col gap-3 h-full">
          <div className="flex gap-2">
            {zukanFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setZukanFilter(filter); setSelectedZukanIndex(0); }}
                onMouseEnter={() => { if (zukanFilter !== filter) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setZukanFilter(filter); setSelectedZukanIndex(0); }}
                className={`px-3 py-2 rounded border font-bold cursor-pointer ${zukanFilter === filter ? 'bg-[#bc6c25] border-white text-white' : 'bg-black/35 border-[#5a3010] text-[#dda15e] hover:bg-[#3a2418]'}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div
            style={menuPanelBaseStyle}
            className={isFishZukan
              ? 'grid min-h-0 flex-1 grid-cols-5 auto-rows-[190px] gap-2 overflow-y-auto pr-2'
              : 'grid grid-cols-5 gap-2 flex-1'
            }
          >
            {isFishZukan ? FISH_ZUKAN_ENTRIES.map((fish, index) => {
              const caught = caughtFishIds.includes(fish.id);
              const hasSizeUpdate = fishSizeUpdatedIds.includes(fish.id);
              const sizeHistory = fishInventorySizes[fish.name] ?? [];
              const bestSizeFromHistory = sizeHistory.length > 0 ? Math.max(...sizeHistory) : undefined;
              const bestSize = fishBestSizes[fish.id] ?? bestSizeFromHistory;
              const isNushiCaught = caught && (
                nushiCaughtFishIds.includes(fish.id) ||
                (bestSize !== undefined && isNushiSize(fish, bestSize))
              );
              return (
                <button
                  key={fish.id}
                  type="button"
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  onMouseEnter={() => { if (selectedZukanIndex !== index) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  className={`relative overflow-hidden rounded-lg border p-2 text-left cursor-pointer transition-colors ${selectedZukanIndex === index ? 'bg-[#bc6c25]/45 border-white' : 'bg-black/35 border-[#5a3010] hover:bg-[#3a2418]'}`}
                >
                  <div className="relative z-10 flex h-full flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#fdf6e3]">No.{fish.no}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${caught ? 'bg-[#4a5823] text-[#d9f99d]' : 'bg-[#2d1b15] text-[#dda15e]'}`}>
                        {caught ? '釣果済' : '未発見'}
                      </span>
                    </div>
                    {isNushiCaught && (
                      <div className="absolute right-2 top-8 z-20 rounded-full border border-[#fff7ad] bg-[linear-gradient(135deg,#fff7ad,#ffd166_42%,#67e8f9)] px-2.5 py-1 text-[10px] font-black text-[#2d1b15] shadow-[0_0_16px_rgba(255,209,102,0.85),0_0_26px_rgba(103,232,249,0.45)]">
                        ヌシ
                      </div>
                    )}
                    <div className="relative aspect-[4/3] overflow-hidden rounded border border-[#5a3010]/80 bg-[#140c09]">
                      {caught ? (
                        <img src={fish.imageSrc} alt={fish.name} className="h-full w-full object-cover" />
                      ) : (
                        <img src="/img/fishcard.png" alt="魚カード裏面" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#fdf6e3]">{caught ? fish.name : '？？？？'}</span>
                      {hasSizeUpdate && (
                        <span className="rounded-full border border-[#67e8f9]/70 bg-[linear-gradient(135deg,rgba(103,232,249,0.95),rgba(255,209,102,0.9))] px-2 py-0.5 text-[9px] font-black text-[#21110b] shadow-[0_0_14px_rgba(103,232,249,0.55)]">
                          更新
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            }) : zukanCards.map((kind, index) => (
                <button
                  key={`${kind}-${index}`}
                  type="button"
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  onMouseEnter={() => { if (selectedZukanIndex !== index) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  className={`text-left rounded p-2 flex flex-col justify-between cursor-pointer ${selectedZukanIndex === index ? 'bg-[#bc6c25]/45 border border-white' : 'bg-black/35 border border-[#5a3010] hover:bg-[#3a2418]'}`}
                >
                  <div className="text-[#fdf6e3] font-bold">No.{index + 1}</div>
                  <div className="text-[#dda15e] text-xs">{kind}</div>
                  <div className="text-[10px] text-[#a3b18a]">プロフィール / 回想</div>
                </button>
              ))}
          </div>
          <div className="bg-black/30 rounded p-3 border border-[#5a3010]">
            {isFishZukan ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[#fdf6e3] font-bold">No.{selectedFish?.no ?? 1} {selectedFishCaught ? selectedFish?.name : '？？？？'}</div>
                {selectedFish && (
                  <div className="rounded-full border border-[#67e8f9]/45 bg-[#0f2430]/80 px-3 py-1 text-sm font-bold text-[#67e8f9]">
                    難度 {selectedFish.level} / {selectedFish.fixedSize ? `${selectedFish.fixedSize.toFixed(1)}cm固定` : `${selectedFish.sizeMin}-${selectedFish.sizeMax}cm`}
                  </div>
                )}
                <div className="rounded-full border border-[#ffd166]/60 bg-[#2d1b15]/80 px-3 py-1 text-sm font-bold text-[#ffd166] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  最大の釣果: {selectedFishCaught && selectedFishBestSize ? `${selectedFishBestSize.toFixed(1)}cm` : '--.-cm'}
                </div>
                {selectedFishHasUpdate && (
                  <div className="rounded-full border border-[#67e8f9]/80 bg-[linear-gradient(135deg,#67e8f9,#ffd166)] px-4 py-1 text-sm font-black text-[#21110b] shadow-[0_0_18px_rgba(103,232,249,0.62),inset_0_1px_0_rgba(255,255,255,0.45)]">
                    NEW RECORD
                  </div>
                )}
                {selectedFishIsNushiCaught && (
                  <div className="rounded-full border border-[#fff7ad] bg-[linear-gradient(135deg,#fff7ad,#ffd166_42%,#67e8f9)] px-4 py-1 text-sm font-black text-[#2d1b15] shadow-[0_0_18px_rgba(255,209,102,0.82),0_0_26px_rgba(103,232,249,0.48),inset_0_1px_0_rgba(255,255,255,0.55)]">
                    ヌシ
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[#fdf6e3] font-bold">No.{selectedZukanIndex + 1} 詳細</div>
            )}
            <div className="text-[#dda15e] text-sm">
              {isFishZukan
                ? (selectedFishCaught ? '釣りで発見済み。画像が図鑑に登録されました。' : 'まだ釣っていません。釣り上げると魚の画像が表示されます。')
                : `フィルタ: ${zukanFilter} / シーン回想を選択できます。`}
            </div>
          </div>
          <div className="h-5 bg-black/50 border border-[#5a3010] rounded overflow-hidden">
            <div className="h-full bg-[#bc6c25]" style={{ width: isFishZukan ? `${fishProgress}%` : '32%' }} />
          </div>
        </div>
      );
    }

    const systemActions = [
      { label: 'セーブ', bgImage: '/img/save.jpg', action: () => setSystemSlotMode('save') },
      { label: 'ロード', bgImage: '/img/load.jpg', action: () => setSystemSlotMode('load') },
      { label: 'タイトルへ戻る', bgImage: '/img/title.jpg', action: returnToTitle },
    ];

    return (
      <div className="grid grid-cols-3 gap-3 h-full">
        {systemActions.map((action, index) => (
	          <button
	            key={action.label}
	            type="button"
	            onPointerDown={(event) => {
	              event.preventDefault();
	              event.stopPropagation();
	              playFixSound();
	              setMenuFocusArea('content');
	              setMenuContentFocus('primary');
	              setSelectedSystemActionIndex(index);
	              setSystemNotice(`${action.label}を選択しました。`);
	              action.action();
	            }}
	            onMouseEnter={() => { playCursorSound(); setSelectedSystemActionIndex(index); }}
	            onClick={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedSystemActionIndex(index); setSystemNotice(`${action.label}を選択しました。`); }}
            className={`farm-menu-system-action has-art group relative overflow-hidden border-2 border-[#bc6c25] cursor-pointer ${selectedSystemActionIndex === index ? 'is-selected' : ''}`}
            style={{
              backgroundImage: `url("${action.bgImage}")`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
            aria-label={action.label}
          >
            <div className="farm-menu-system-action-label">
              {selectedSystemActionIndex === index ? '▶ ' : ''}{action.label}
            </div>
            {selectedSystemActionIndex === index && (
              <div className="farm-menu-system-action-badge">選択中</div>
            )}
          </button>
        ))}
        <div style={menuPanelBaseStyle} className="col-span-3 grid grid-cols-4 gap-4">
          {[
            { label: 'BGM', value: bgmVolume, setValue: (value: number) => setBgmVolume(value), color: '#facc15', percentClass: 'text-yellow-200' },
            { label: 'SE', value: seVolume, setValue: (value: number) => setSeVolume(value), color: '#22c55e', percentClass: 'text-green-200' },
            { label: 'VOICE', value: voiceVolume, setValue: (value: number) => setVoiceVolume(value), color: '#3b82f6', percentClass: 'text-blue-200' },
          ].map(({ label, value, setValue, color, percentClass }) => {
            const percent = Math.round(value * 100);
            return (
              <div key={label} className="rounded border border-[#5a3010]/70 bg-black/25 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div style={menuTinyLabelStyle}>{label}</div>
                  <span className={`farm-volume-percent ${percentClass}`}>{percent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={(e) => setValue(Number(e.target.value) / 100)}
                  className="farm-volume-slider mt-3 w-full cursor-pointer"
                  style={{ background: `linear-gradient(90deg, ${color} 0%, ${color} ${percent}%, #374151 ${percent}%, #374151 100%)` }}
                  aria-label={`${label}ゲイン`}
                />
                <div className="mt-2 text-[11px] text-[#c8a87a]">{label}ゲイン設定: {percent}%</div>
              </div>
            );
          })}
          <div className="rounded border border-[#5a3010]/70 bg-black/25 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div style={menuTinyLabelStyle}>テキスト表示スピード</div>
              <span className="farm-volume-percent text-orange-200">{textDisplaySpeedLevel >= 5 ? '一瞬' : `${textDisplaySpeedLevel}/5`}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={textDisplaySpeedLevel}
              onChange={(e) => setTextDisplaySpeedLevel(Number(e.target.value))}
              className="farm-volume-slider mt-3 w-full cursor-pointer"
              style={{ background: `linear-gradient(90deg, #fb923c 0%, #fb923c ${(textDisplaySpeedLevel - 1) * 25}%, #374151 ${(textDisplaySpeedLevel - 1) * 25}%, #374151 100%)` }}
              aria-label="テキスト表示スピード"
            />
            <div className="mt-2 text-[11px] text-[#c8a87a]">表示速度: {textDisplaySpeedLevel >= 5 ? '一瞬' : `${textDisplaySpeedLevel}/5`}</div>
          </div>
        </div>
        <div style={menuPanelBaseStyle} className="col-span-3 text-[#fdf6e3] font-bold">{systemNotice}</div>
      </div>
    );
  };
  // クリック移動の目標座標（null = クリック移動なし）
  const clickTargetRef = useRef<{ x: number; y: number } | null>(null);
  const [clickTargetMarker, setClickTargetMarker] = useState<{ x: number; y: number } | null>(null);
  const suppressNextMapPointerRef = useRef(false);
  const stuckStartRef = useRef<number | null>(null);
  
  useEffect(() => {
    menuOpenRef.current = menuOpen;
    if (menuOpen) {
      clickTargetRef.current = null;
      setClickTargetMarker(null);
    } else {
      setFishSizeUpdatedIds([]);
    }
  }, [menuOpen]);
  useEffect(() => { menuSelectedIndexRef.current = menuSelectedIndex; }, [menuSelectedIndex]);
  useEffect(() => { menuFocusAreaRef.current = menuFocusArea; }, [menuFocusArea]);
  useEffect(() => { menuContentFocusRef.current = menuContentFocus; }, [menuContentFocus]);
  useEffect(() => { itemMenuTabRef.current = itemMenuTab; }, [itemMenuTab]);
  useEffect(() => { selectedItemNameRef.current = selectedItemName; }, [selectedItemName]);
  useEffect(() => { selectedEquipmentSlotRef.current = selectedEquipmentSlot; }, [selectedEquipmentSlot]);
  useEffect(() => { selectedEquipmentOptionIndexRef.current = selectedEquipmentOptionIndex; }, [selectedEquipmentOptionIndex]);
  useEffect(() => { setSelectedEquipmentOptionIndex(0); }, [selectedEquipmentSlot, equipmentActionOpen]);
  useEffect(() => { selectedSkillNameRef.current = selectedSkillName; }, [selectedSkillName]);
  useEffect(() => { selectedStatusGirlIndexRef.current = selectedStatusGirlIndex; }, [selectedStatusGirlIndex]);
  useEffect(() => { selectedFarmGirlIndexRef.current = selectedFarmGirlIndex; }, [selectedFarmGirlIndex]);
  useEffect(() => { selectedFarmFacilityIndexRef.current = selectedFarmFacilityIndex; }, [selectedFarmFacilityIndex]);
  useEffect(() => { zukanFilterRef.current = zukanFilter; }, [zukanFilter]);
  useEffect(() => { selectedZukanIndexRef.current = selectedZukanIndex; }, [selectedZukanIndex]);
  useEffect(() => { systemNoticeRef.current = systemNotice; }, [systemNotice]);
  useEffect(() => { selectedSystemActionIndexRef.current = selectedSystemActionIndex; }, [selectedSystemActionIndex]);
  useEffect(() => { equippedItemsRef.current = equippedItems; }, [equippedItems]);

  const [sleepPromptVisible, setSleepPromptVisible] = useState(false);
  const [craftPromptVisible, setCraftPromptVisible] = useState(false);
  const [fishingPromptVisible, setFishingPromptVisible] = useState(false);
  const [loggingPromptVisible, setLoggingPromptVisible] = useState(false);
  const [activeLoggingPointId, setActiveLoggingPointId] = useState<string | null>(null);
  const [depletedLoggingPointIds, setDepletedLoggingPointIds] = useState<Record<string, boolean>>({});
  const [fishingMiniGameOpen, setFishingMiniGameOpen] = useState(false);
  const [fishingMiniGameStage, setFishingMiniGameStage] = useState<'direction' | 'power' | 'bite' | 'hit' | 'keep' | 'result'>('direction');
  const [fishingGauge, setFishingGauge] = useState(0);
  const fishingGaugeRef = useRef(0);
  const [fishingCastAngle, setFishingCastAngle] = useState(0);
  const [fishingCastPower, setFishingCastPower] = useState(0);
  const [fishingFanConfigs, setFishingFanConfigs] = useState<Record<string, FishingFanConfig>>(loadFishingFanConfigs);
  const equippedFishingRod = equippedItems['主人公-slot1']
    ? getFishingRodName(equippedItems['主人公-slot1'])
    : DEFAULT_FISHING_ROD;
  const fishingFanConfig = fishingFanConfigs[equippedFishingRod] ?? DEFAULT_FISHING_FAN_CONFIG;
  useEffect(() => {
    fishingGaugeRef.current = fishingGauge;
  }, [fishingGauge]);
  const setFishingFanWidth = (width: number) => {
    setFishingFanConfigs(prev => ({
      ...prev,
      [equippedFishingRod]: { ...(prev[equippedFishingRod] ?? DEFAULT_FISHING_FAN_CONFIG), width },
    }));
  };
  const setFishingFanHeight = (height: number) => {
    setFishingFanConfigs(prev => ({
      ...prev,
      [equippedFishingRod]: { ...(prev[equippedFishingRod] ?? DEFAULT_FISHING_FAN_CONFIG), height },
    }));
  };
  const setFishingFanOpacity = (opacity: number) => {
    setFishingFanConfigs(prev => ({
      ...prev,
      [equippedFishingRod]: { ...(prev[equippedFishingRod] ?? DEFAULT_FISHING_FAN_CONFIG), opacity },
    }));
  };
  useEffect(() => {
    localStorage.setItem('farm_fishing_fan_configs', JSON.stringify(fishingFanConfigs));
  }, [fishingFanConfigs]);
  const [fishingBiteRound, setFishingBiteRound] = useState(1);
  const [fishingBiteScore, setFishingBiteScore] = useState(0);
  const [fishingBiteCombo, setFishingBiteCombo] = useState(0);
  const fishingBiteScoreRef = useRef(0);
  const fishingBiteComboRef = useRef(0);
  const [fishingBiteCircle, setFishingBiteCircle] = useState<FishingBiteCircle>({
    x: 50,
    y: 50,
    outerSize: FISHING_BITE_START_SIZE,
  });
  const [fishingBiteSparkle, setFishingBiteSparkle] = useState<FishingBiteSparkle | null>(null);
  useEffect(() => { fishingBiteScoreRef.current = fishingBiteScore; }, [fishingBiteScore]);
  useEffect(() => { fishingBiteComboRef.current = fishingBiteCombo; }, [fishingBiteCombo]);
  const [fishingKeepSeconds, setFishingKeepSeconds] = useState(3);
  const [fishingKeepMissSeconds, setFishingKeepMissSeconds] = useState(0);
  const [fishingFishHp, setFishingFishHp] = useState(FISHING_FISH_MAX_HP);
  const [fishingTension, setFishingTension] = useState(0);
  const [fishingHitGreenWidth, setFishingHitGreenWidth] = useState(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
  const [fishingKeepGreenWidth, setFishingKeepGreenWidth] = useState(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
  const [fishingFanSweetMin, setFishingFanSweetMin] = useState(FISHING_KEEP_GREEN_MIN);
  const [fishingFanSweetMax, setFishingFanSweetMax] = useState(FISHING_KEEP_GREEN_MAX);
  const [fishingTargetFish, setFishingTargetFish] = useState<FishZukanEntry>(FISH_ZUKAN_ENTRIES[0]);
  const [fishingTargetSizeValue, setFishingTargetSizeValue] = useState<number | null>(null);
  const [fishingTargetIsNushi, setFishingTargetIsNushi] = useState(false);
  const fishingHitGreenMin = FISHING_KEEP_GREEN_CENTER - fishingHitGreenWidth / 2;
  const fishingHitGreenMax = FISHING_KEEP_GREEN_CENTER + fishingHitGreenWidth / 2;
  const fishingKeepGreenMin = FISHING_KEEP_GREEN_CENTER - fishingKeepGreenWidth / 2;
  const fishingKeepGreenMax = FISHING_KEEP_GREEN_CENTER + fishingKeepGreenWidth / 2;
  const [fishingResultText, setFishingResultText] = useState('');
  const [fishingResultSizeCm, setFishingResultSizeCm] = useState('');
  const [fishingResultImageSrc, setFishingResultImageSrc] = useState(FISHING_SCENE_RESULT_SRC);
  const [fishingResultIsNewRecord, setFishingResultIsNewRecord] = useState(false);
  const [isFishingHitSplashActive, setIsFishingHitSplashActive] = useState(false);
  const [isFishingHitIntroActive, setIsFishingHitIntroActive] = useState(false);
  const [isFishingNushiIntroActive, setIsFishingNushiIntroActive] = useState(false);
  const [fishingTutorialCompleted, setFishingTutorialCompleted] = useState(false);
  const [fishingTutorialOpen, setFishingTutorialOpen] = useState(false);
  const [fishingTutorialStepIndex, setFishingTutorialStepIndex] = useState(0);
  const [fishingTutorialEndingOpen, setFishingTutorialEndingOpen] = useState(false);
  const [fishingTutorialEndingStepIndex, setFishingTutorialEndingStepIndex] = useState(0);
  const [sawCraftTutorialIntroOpen, setSawCraftTutorialIntroOpen] = useState(false);
  const [sawCraftTutorialIntroStepIndex, setSawCraftTutorialIntroStepIndex] = useState(0);
  const [craftTutorialRecipeName, setCraftTutorialRecipeName] = useState<CraftRecipeId>('【レシピ】のこぎり');
  const [sawCraftTutorialReady, setSawCraftTutorialReady] = useState(false);
  const [sawCraftTutorialShedDialogueOpen, setSawCraftTutorialShedDialogueOpen] = useState(false);
  const [sawCraftTutorialShedStepIndex, setSawCraftTutorialShedStepIndex] = useState(0);
  const [sawCraftTutorialWorkbenchReady, setSawCraftTutorialWorkbenchReady] = useState(false);

  const [loggingMiniGameOpen, setLoggingMiniGameOpen] = useState(false);
  const [loggingMiniGameStage, setLoggingMiniGameStage] = useState<'direction' | 'action' | 'result'>('direction');
  const [loggingGauge, setLoggingGauge] = useState(0);
  const loggingGaugeRef = useRef(0);
  useEffect(() => {
    loggingGaugeRef.current = loggingGauge;
  }, [loggingGauge]);
  const [loggingProgress, setLoggingProgress] = useState(0);
  const [loggingCombo, setLoggingCombo] = useState(0);
  const [loggingComboEffectKey, setLoggingComboEffectKey] = useState(0);
  const loggingComboEffectTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (loggingComboEffectTimerRef.current !== null) {
      window.clearTimeout(loggingComboEffectTimerRef.current);
    }
  }, []);
  const [loggingSelectedResultAction, setLoggingSelectedResultAction] = useState<'retry' | 'complete'>('retry');
  const [isLoggingResultInputLocked, setIsLoggingResultInputLocked] = useState(false);
  const [loggingTutorialCompleted, setLoggingTutorialCompleted] = useState(false);
  const [loggingTutorialOpen, setLoggingTutorialOpen] = useState(false);
  const [loggingTutorialStepIndex, setLoggingTutorialStepIndex] = useState(0);
  const [selectedLoggingTutorialAction, setSelectedLoggingTutorialAction] = useState<'later' | 'next'>('next');
  const [isLoggingTutorialRun, setIsLoggingTutorialRun] = useState(false);
  const [loggingTutorialResult, setLoggingTutorialResult] = useState<'success' | 'fail' | null>(null);
  const [loggingAngleSuccess, setLoggingAngleSuccess] = useState(false);
  
  const equippedSaw = (equippedItems['主人公-slot2']?.includes('のこぎり') ? equippedItems['主人公-slot2'] : null) ||
                     (equippedItems['主人公-slot3']?.includes('のこぎり') ? equippedItems['主人公-slot3'] : null) ||
                     'のこぎり';
  const [sawCraftTutorialCompleted, setSawCraftTutorialCompleted] = useState(false);
  const [craftedRecipeIds, setCraftedRecipeIds] = useState<CraftRecipeId[]>([]);
  const [gatheringTutorialOpen, setGatheringTutorialOpen] = useState(false);
  const [gatheringTutorialStepIndex, setGatheringTutorialStepIndex] = useState(0);
  const [gatheringTutorialChoice, setGatheringTutorialChoice] = useState<GatheringTutorialChoice | null>(null);
  const [selectedGatheringTutorialChoice, setSelectedGatheringTutorialChoice] = useState<GatheringTutorialChoice>('logging');
  const [gatheringTutorialCompleted, setGatheringTutorialCompleted] = useState(false);
  const [selectedFishingTutorialAction, setSelectedFishingTutorialAction] = useState<'later' | 'next'>('next');
  const [selectedFishingResultAction, setSelectedFishingResultAction] = useState<'retry' | 'complete'>('retry');
  const [isFishingTutorialRun, setIsFishingTutorialRun] = useState(false);
  const [fishingTutorialResult, setFishingTutorialResult] = useState<FishingTutorialResult>(null);
  const [fishingHitCountdown, setFishingHitCountdown] = useState(3);
  const [fishingHitLimitSeconds, setFishingHitLimitSeconds] = useState(10);
  const [isFishingResultInputLocked, setIsFishingResultInputLocked] = useState(false);
  const [isFishingKeepPressed, setIsFishingKeepPressed] = useState(false);
  const [kurumiShopOpen, setKurumiShopOpen] = useState(false);
  const [selectedShopItemIndex, setSelectedShopItemIndex] = useState(0);
  const [selectedShopControl, setSelectedShopControl] = useState<'items' | 'action' | 'close'>('items');
  const [isShopTradePose, setIsShopTradePose] = useState(false);
  const [activeKurumiTradeReward, setActiveKurumiTradeReward] = useState<KurumiTradeReward | null>(null);
  const [shownKurumiTradeRewardThresholds, setShownKurumiTradeRewardThresholds] = useState<number[]>([]);
  const [kurumiIntroOpen, setKurumiIntroOpen] = useState(false);
  const [kurumiIntroMessage, setKurumiIntroMessage] = useState(KURUMI_INTRO_FIRST_MESSAGE);
  const [kurumiIntroSelectedIndex, setKurumiIntroSelectedIndex] = useState(0);
  const [kurumiIntroAskedTopics, setKurumiIntroAskedTopics] = useState<KurumiIntroTopicId[]>([]);
  const [kurumiIntroCompletedDay, setKurumiIntroCompletedDay] = useState<number | null>(null);
  const [kurumiIntroClosing, setKurumiIntroClosing] = useState(false);
  const shopTradePoseTimerRef = useRef<number | null>(null);
  const kurumiTradeRewardTimerRef = useRef<number | null>(null);
  const kurumiIntroCloseTimerRef = useRef<number | null>(null);
  const fishingTutorialVoiceRef = useRef<HTMLAudioElement | null>(null);
  const sawCraftTutorialVoiceRef = useRef<HTMLAudioElement | null>(null);
  const sawCraftTutorialIntroVoiceKeyRef = useRef<string | null>(null);
  const [confirmPromptChoice, setConfirmPromptChoice] = useState<'yes' | 'no'>('yes');
  const [craftPromptSource, setCraftPromptSource] = useState<'kurumi' | 'workbench' | null>(null);
  const [sleepFadeOpacity, setSleepFadeOpacity] = useState(0);
  const [isSleepSequenceActive, setIsSleepSequenceActive] = useState(false);
  const sleepPromptBlockedRef = useRef(false);
  const craftPromptBlockedRef = useRef(false);
  const fishingPromptBlockedRef = useRef(false);
  const loggingPromptBlockedRef = useRef(false);
  const fishingGaugeDirectionRef = useRef(1);
  const fishingBiteTimerRef = useRef<number | null>(null);
  const fishingHitSplashTimerRef = useRef<number | null>(null);
  const fishingHitIntroTimerRef = useRef<number | null>(null);
  const fishingHitCountdownTimerRef = useRef<number | null>(null);
  const fishingNushiVoiceRef = useRef<HTMLAudioElement | null>(null);
  const fishingResultLockTimerRef = useRef<number | null>(null);
  const fishingBiteSparkleTimerRef = useRef<number | null>(null);
  const fishingRiverAudioRef = useRef<HTMLAudioElement | null>(null);
  const fishingReelAudioRef = useRef<HTMLAudioElement | null>(null);
  const isFishingKeepPressedRef = useRef(false);
  const movementLockedRef = useRef(false);
  const lastWarpedAtRef = useRef(0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [zones, setZones] = useState<AnimZone[]>(defaultZones.map(ensureAnimZoneSpriteSize));
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  const times: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];
  const timeOfDay = times[turn % 4];

  // プレイヤードラッグ状態
  const [isDraggingPlayer, setIsDraggingPlayer] = useState(false);
  const playerDragStart = useRef({ x: 0, y: 0 });
  const playerDragStartPos = useRef({ x: 0, y: 0 });

  // 扉ドラッグ・リサイズ状態
  const [draggingDoorId, setDraggingDoorId] = useState<string | null>(null);
  const [resizingDoorId, setResizingDoorId] = useState<string | null>(null);
  const [draggingSpawnDoorId, setDraggingSpawnDoorId] = useState<string | null>(null);
  const doorDragStart = useRef({ x: 0, y: 0 });
  const doorDragStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const spawnDragStart = useRef({ x: 0, y: 0 });
  const spawnDragStartPos = useRef({ x: 0, y: 0 });
  const [draggingInspectSpotId, setDraggingInspectSpotId] = useState<string | null>(null);
  const [resizingInspectSpotId, setResizingInspectSpotId] = useState<string | null>(null);
  const inspectSpotDragStart = useRef({ x: 0, y: 0 });
  const inspectSpotStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [draggingBathTubMask, setDraggingBathTubMask] = useState(false);
  const [resizingBathTubMask, setResizingBathTubMask] = useState(false);
  const bathTubMaskDragStart = useRef({ x: 0, y: 0 });
  const bathTubMaskStartRect = useRef<RectZone>(DEFAULT_HOUSE_BATH_TUB_MASK_ZONE);

  // Warp Doors State
  const [currentMap, setCurrentMap] = useState<GameMap>('farm');
  const [doors, setDoors] = useState<WarpDoor[]>(defaultDoors);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [inspectSpots, setInspectSpots] = useState<InspectSpot[]>([]);
  const [selectedInspectSpotId, setSelectedInspectSpotId] = useState<string | null>(null);

  // Debug Panel Draggable Position State
  const [debugPanelPos, setDebugPanelPos] = useState({ x: 1920 - DEBUG_PANEL_WIDTH - 16, y: 76 });
  const [isDraggingDebug, setIsDraggingDebug] = useState(false);
  const debugDragStart = useRef({ x: 0, y: 0 });

  // Dialog Opacity Level State (1 to 5)
  const [opacityLevel, setOpacityLevel] = useState<number>(3); // Default level 3 (50%)
  const [dialogHovered, setDialogHovered] = useState(false);
  const [showDialog, setShowDialog] = useState<boolean>(false); // Hidden until an inspect/event message opens it
  const [dialogMessage, setDialogMessage] = useState(DEFAULT_SYSTEM_MESSAGE);
  const [debugDialogueOverrides, setDebugDialogueOverrides] = useState<Record<string, string>>(() => {
    try {
      const stored = window.localStorage.getItem(DEBUG_DIALOGUE_STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [dialogBoxPos, setDialogBoxPos] = useState({ x: 16, y: 1156 - DIALOG_BOX_MIN_HEIGHT - 16 });
  const [dialogBoxSize, setDialogBoxSize] = useState({ width: DIALOG_BOX_DEFAULT_WIDTH, height: DIALOG_BOX_MIN_HEIGHT });
  const [isDraggingDialog, setIsDraggingDialog] = useState(false);
  const [isResizingDialog, setIsResizingDialog] = useState(false);
  const dialogDragStart = useRef({ x: 0, y: 0 });
  const dialogDragStartPos = useRef({ x: 0, y: 0 });
  const dialogResizeStart = useRef({ x: 0, y: 0 });
  const dialogResizeStartSize = useRef({ width: DIALOG_BOX_DEFAULT_WIDTH, height: DIALOG_BOX_MIN_HEIGHT });
  const opacityMap = [0.1, 0.3, 0.5, 0.75, 1.0];

  // 音量設定 (BGM, SE, VOICE)
  const [bgmVolume, setBgmVolume] = useState<number>(0.2);
  const [seVolume, setSeVolume] = useState<number>(0.2);
  const [voiceVolume, setVoiceVolume] = useState<number>(0.8);
  const [textDisplaySpeedLevel, setTextDisplaySpeedLevel] = useState<number>(3);
  const [audioGains, setAudioGains] = useState<Record<string, number>>(DEFAULT_AUDIO_GAINS);
  const [mapBgmSources, setMapBgmSources] = useState<Record<GameMap, string>>(DEFAULT_MAP_BGM_SOURCES);
  const [activeAutoEventSpot, setActiveAutoEventSpot] = useState<InspectSpot | null>(null);
  const [activeAutoEventMessage, setActiveAutoEventMessage] = useState('');
  const [displayedAutoEventMessage, setDisplayedAutoEventMessage] = useState('');
  const [activeAutoEventMessageIndex, setActiveAutoEventMessageIndex] = useState(0);

  const [selectedAudioFile, setSelectedAudioFile] = useState('/bgm/farmbgm.wav');
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmStartedRef = useRef(false);
  const bgmSourceRef = useRef(TITLE_BGM_SRC);
  const bgmFadeRafRef = useRef<number | null>(null);
  const bgmFadingRef = useRef(false);
  const autoEventBgmMutedRef = useRef(false);
  const wasFishingBgmActiveRef = useRef(false);
  const wasLoggingBgmActiveRef = useRef(false);
  const walkSoundRef = useRef<HTMLAudioElement | null>(null);
  const wasPlayerInBathRef = useRef(false);
  const wasPlayerInBathTubRef = useRef(false);
  const waterfallSoundRef = useRef<HTMLAudioElement | null>(null);
  const riverSoundRef = useRef<HTMLAudioElement | null>(null);
  const fireplaceSoundRef = useRef<HTMLAudioElement | null>(null);
  const cicadaSoundRef = useRef<HTMLAudioElement | null>(null);
  const autoEventTypeTimerRef = useRef<number | null>(null);
  const typeSoundRef = useRef<HTMLAudioElement | null>(null);
  const walkSoundTypeRef = useRef<FootstepSound>('soil');
  const wallBumpLastPlayedRef = useRef(0);

  const seVolumeRef = useRef<number>(seVolume);
  const voiceVolumeRef = useRef<number>(voiceVolume);
  const audioGainsRef = useRef<Record<string, number>>(audioGains);
  const eventAudioRefs = useRef<HTMLAudioElement[]>([]);
  const kurumiIntroVoiceRef = useRef<HTMLAudioElement | null>(null);
  const triggeredAutoEventIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
     seVolumeRef.current = seVolume;
  }, [seVolume]);

  useEffect(() => {
     voiceVolumeRef.current = voiceVolume;
  }, [voiceVolume]);

  useEffect(() => {
     audioGainsRef.current = audioGains;
  }, [audioGains]);

  useEffect(() => {
     if (typeSoundRef.current) {
        typeSoundRef.current.volume = getEffectiveVolume('/se/type.mp3', seVolume, audioGainsRef.current);
     }
  }, [seVolume, audioGains]);

  const selectedAudioGain = getFileGain(selectedAudioFile, audioGains);
  const currentMapBgmSource = mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap];
  const currentMapBgmLabel = BGM_FILE_ENTRIES.find(entry => entry.src === currentMapBgmSource)?.label ?? currentMapBgmSource;
  const setCurrentMapBgmSource = (src: string) => {
    setMapBgmSources(prev => ({ ...prev, [currentMap]: src }));
  };

  const setSelectedAudioGain = (gain: number) => {
    setAudioGains(prev => ({ ...prev, [selectedAudioFile]: Math.max(0, Math.min(gain, 3)) }));
  };

  const setAllAudioGains = (gain: number) => {
    const clampedGain = Math.max(0, Math.min(gain, 3));
    setAudioGains(prev => {
      const next = { ...prev };
      AUDIO_FILE_ENTRIES.forEach(entry => {
        next[entry.src] = clampedGain;
      });
      return next;
    });
  };

  useEffect(() => {
    try {
      if (Object.keys(debugDialogueOverrides).length === 0) {
        window.localStorage.removeItem(DEBUG_DIALOGUE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(DEBUG_DIALOGUE_STORAGE_KEY, JSON.stringify(debugDialogueOverrides));
      }
    } catch {
      // Debug-only storage must never block normal gameplay.
    }
  }, [debugDialogueOverrides]);

  useEffect(() => {
     movementLockedRef.current = sleepPromptVisible || craftPromptVisible || fishingPromptVisible || loggingPromptVisible || fishingMiniGameOpen || craftMiniGameOpen || fishingTutorialOpen || fishingTutorialEndingOpen || sawCraftTutorialIntroOpen || sawCraftTutorialShedDialogueOpen || gatheringTutorialOpen || kurumiShopOpen || kurumiIntroOpen || isSleepSequenceActive || beastAttackPending || battlePreviewOpen;
  }, [sleepPromptVisible, craftPromptVisible, fishingPromptVisible, loggingPromptVisible, fishingMiniGameOpen, craftMiniGameOpen, fishingTutorialOpen, fishingTutorialEndingOpen, sawCraftTutorialIntroOpen, sawCraftTutorialShedDialogueOpen, gatheringTutorialOpen, kurumiShopOpen, kurumiIntroOpen, isSleepSequenceActive, beastAttackPending, battlePreviewOpen]);

  useEffect(() => {
     if (sleepPromptVisible || craftPromptVisible || fishingPromptVisible || loggingPromptVisible) {
        setConfirmPromptChoice('yes');
     }
  }, [sleepPromptVisible, craftPromptVisible, fishingPromptVisible, loggingPromptVisible]);

  useEffect(() => {
     if (!fishingMiniGameOpen) {
        if (fishingRiverAudioRef.current) {
           fishingRiverAudioRef.current.pause();
           fishingRiverAudioRef.current = null;
        }
        return;
     }
     const audio = new Audio(RIVER_SOUND_SRC);
     audio.loop = true;
     audio.volume = Math.min(1, getEffectiveVolume(RIVER_SOUND_SRC, seVolumeRef.current, audioGainsRef.current));
     fishingRiverAudioRef.current = audio;
     audio.play().catch((err) => {
        console.log("Fishing river sound autoplay blocked", err);
     });
     return () => {
        audio.pause();
        if (fishingRiverAudioRef.current === audio) fishingRiverAudioRef.current = null;
     };
  }, [fishingMiniGameOpen]);

  useEffect(() => {
     if (fishingRiverAudioRef.current) {
        fishingRiverAudioRef.current.volume = Math.min(1, getEffectiveVolume(RIVER_SOUND_SRC, seVolume, audioGainsRef.current));
     }
  }, [seVolume, audioGains]);

  useEffect(() => {
     if (!fishingMiniGameOpen || fishingMiniGameStage !== 'keep') {
        if (fishingReelAudioRef.current) {
           fishingReelAudioRef.current.pause();
           fishingReelAudioRef.current = null;
        }
        return;
     }
     const audio = new Audio(FISHING_REEL_SOUND_SRC);
     audio.loop = true;
     audio.volume = Math.min(1, getEffectiveVolume(FISHING_REEL_SOUND_SRC, seVolumeRef.current, audioGainsRef.current));
     fishingReelAudioRef.current = audio;
     audio.play().catch((err) => {
        console.log("Fishing reel sound autoplay blocked", err);
     });
     return () => {
        audio.pause();
        if (fishingReelAudioRef.current === audio) fishingReelAudioRef.current = null;
     };
  }, [fishingMiniGameOpen, fishingMiniGameStage]);

  useEffect(() => {
     if (fishingReelAudioRef.current) {
        fishingReelAudioRef.current.volume = Math.min(1, getEffectiveVolume(FISHING_REEL_SOUND_SRC, seVolume, audioGainsRef.current));
     }
  }, [seVolume, audioGains]);

  useEffect(() => {
     if (!fishingMiniGameOpen || fishingMiniGameStage === 'bite' || fishingMiniGameStage === 'result' || isFishingHitSplashActive) return;
     const timerId = window.setInterval(() => {
        if (fishingMiniGameStage === 'direction' || fishingMiniGameStage === 'hit') {
           setFishingGauge(prev => {
              let next = prev + fishingGaugeDirectionRef.current * (fishingMiniGameStage === 'direction' ? 2 : 3);
              if (next >= 100) {
                 next = 100;
                 fishingGaugeDirectionRef.current = -1;
              }
              if (next <= 0) {
                 next = 0;
                 fishingGaugeDirectionRef.current = 1;
              }
              return next;
           });
           return;
        }

        if (fishingMiniGameStage === 'power') {
           setFishingGauge(prev => {
              let next = prev + fishingGaugeDirectionRef.current * 3.5;
              if (next >= 105) {
                 next = 105;
                 fishingGaugeDirectionRef.current = -1;
              }
              if (next <= 0) {
                 next = 0;
                 fishingGaugeDirectionRef.current = 1;
              }
              return next;
           });
           return;
        }

	        if (fishingMiniGameStage === 'keep') {
             const targetSize = fishingTargetSizeValue ?? fishingTargetFish.sizeMin;
             const sizeRatio = getFishSizeRatio(fishingTargetFish, targetSize);
             const levelRatio = clampNumber(fishingTargetFish.level / 24, 0, 1);
             const hpDamage = Math.max(0.34, 1.15 - levelRatio * 0.36 - sizeRatio * 0.44);
             const tensionGain = 2.1 + levelRatio * 1.35 + sizeRatio * 1.1;
	           const nextGauge = Math.max(0, Math.min(100, fishingGauge + (isFishingKeepPressedRef.current ? -2.6 : 1.8)));
	           const isInGreenZone = nextGauge >= fishingKeepGreenMin && nextGauge <= fishingKeepGreenMax;
	           setFishingGauge(nextGauge);
	           setFishingFishHp(prev => isInGreenZone ? Math.max(0, prev - hpDamage) : prev);
           setFishingTension(prev => (
              isInGreenZone
                 ? Math.max(0, prev - 0.8)
                 : Math.min(FISHING_TENSION_MAX, prev + tensionGain)
           ));
        }
     }, 50);
     return () => window.clearInterval(timerId);
	  }, [fishingKeepGreenMax, fishingKeepGreenMin, fishingMiniGameOpen, fishingMiniGameStage, fishingGauge, isFishingHitSplashActive, fishingTargetFish, fishingTargetSizeValue]);

  const loggingGaugeDirectionRef = useRef(1);
  useEffect(() => {
    if (!loggingMiniGameOpen || loggingMiniGameStage === 'result') return;
    
    const baseActionSpeed = equippedSaw.includes('高級')
      ? LOGGING_MINIGAME_CONFIG.actionSpeedBySaw['高級のこぎり']
      : equippedSaw.includes('丈夫な')
        ? LOGGING_MINIGAME_CONFIG.actionSpeedBySaw['丈夫なのこぎり']
        : LOGGING_MINIGAME_CONFIG.actionSpeedBySaw['のこぎり'];
    const actionSpeed = baseActionSpeed * Math.pow(LOGGING_MINIGAME_CONFIG.comboSpeedMultiplier, loggingCombo);

    const timerId = window.setInterval(() => {
      if (loggingMiniGameStage === 'direction') {
        setLoggingGauge(prev => {
          let next = prev + loggingGaugeDirectionRef.current * LOGGING_MINIGAME_CONFIG.directionSpeed;
          if (next >= 100) {
            next = 100;
            loggingGaugeDirectionRef.current = -1;
          }
          if (next <= 0) {
            next = 0;
            loggingGaugeDirectionRef.current = 1;
          }
          return next;
        });
      } else if (loggingMiniGameStage === 'action') {
        setLoggingGauge(prev => {
          let next = prev + loggingGaugeDirectionRef.current * actionSpeed;
          if (next >= 100) {
            next = 100;
            loggingGaugeDirectionRef.current = -1;
          }
          if (next <= 0) {
            next = 0;
            loggingGaugeDirectionRef.current = 1;
          }
          return next;
        });
      }
    }, LOGGING_MINIGAME_CONFIG.tickMs);
    return () => window.clearInterval(timerId);
  }, [loggingMiniGameOpen, loggingMiniGameStage, equippedSaw, loggingCombo]);

  useEffect(() => {
    if (!loggingMiniGameOpen || loggingMiniGameStage !== 'result') return;
    setIsLoggingResultInputLocked(true);
    const timerId = window.setTimeout(() => {
      setIsLoggingResultInputLocked(false);
    }, isLoggingTutorialRun ? 1000 : 2000);
    return () => window.clearTimeout(timerId);
  }, [loggingMiniGameOpen, loggingMiniGameStage, isLoggingTutorialRun]);

  const loggingTutorialVoiceRef = useRef<HTMLAudioElement | null>(null);
  const playLoggingTutorialVoice = (stepIndex: number) => {
    stopLoggingTutorialVoice();
    const step = LOGGING_TUTORIAL_STEPS[stepIndex];
    if (step && step.voiceSrc) {
      const audio = new Audio(step.voiceSrc);
      audio.volume = getEffectiveVolume(step.voiceSrc, voiceVolumeRef.current, audioGainsRef.current);
      loggingTutorialVoiceRef.current = audio;
      audio.play().catch(err => console.log('Logging voice blocked', err));
    }
  };
  const stopLoggingTutorialVoice = () => {
    if (loggingTutorialVoiceRef.current) {
      loggingTutorialVoiceRef.current.pause();
      loggingTutorialVoiceRef.current.currentTime = 0;
      loggingTutorialVoiceRef.current = null;
    }
  };

  useEffect(() => {
     isFishingKeepPressedRef.current = isFishingKeepPressed;
  }, [isFishingKeepPressed]);

  useEffect(() => {
     if (fishingMiniGameStage !== 'keep') {
        setIsFishingKeepPressed(false);
     }
  }, [fishingMiniGameStage]);

  useEffect(() => {
     if (!fishingMiniGameOpen || fishingMiniGameStage !== 'bite') return;
     if (fishingBiteTimerRef.current !== null) {
        window.clearInterval(fishingBiteTimerRef.current);
     }
     const roundStartedAt = Date.now();
     const roundMs = FISHING_BITE_ROUND_MS_LIST[fishingBiteRound - 1] ?? FISHING_BITE_ROUND_MS_LIST[FISHING_BITE_ROUND_MS_LIST.length - 1];
     fishingBiteTimerRef.current = window.setInterval(() => {
        const progress = Math.min(1, (Date.now() - roundStartedAt) / roundMs);
        const nextSize = FISHING_BITE_START_SIZE - (FISHING_BITE_START_SIZE - FISHING_BITE_END_SIZE) * progress;
        setFishingBiteCircle(prev => ({ ...prev, outerSize: nextSize }));
        if (progress < 1) return;
        if (fishingBiteTimerRef.current !== null) {
           window.clearInterval(fishingBiteTimerRef.current);
           fishingBiteTimerRef.current = null;
        }
        setFishingBiteRound(prev => {
           if (prev >= FISHING_BITE_ROUNDS) {
              beginFishingHitStage(fishingBiteScoreRef.current, fishingBiteComboRef.current);
              return prev;
           }
           setFishingBiteCircle({
              x: 18 + Math.random() * 64,
              y: 20 + Math.random() * 56,
              outerSize: FISHING_BITE_START_SIZE,
           });
           return prev + 1;
        });
     }, 33);
     return () => {
        if (fishingBiteTimerRef.current !== null) {
           window.clearInterval(fishingBiteTimerRef.current);
           fishingBiteTimerRef.current = null;
        }
     };
  }, [fishingMiniGameOpen, fishingMiniGameStage, fishingBiteRound]);

  useEffect(() => {
     if (!fishingMiniGameOpen || fishingMiniGameStage !== 'result') return;
     setIsFishingResultInputLocked(true);
     if (fishingResultLockTimerRef.current !== null) {
        window.clearTimeout(fishingResultLockTimerRef.current);
     }
     fishingResultLockTimerRef.current = window.setTimeout(() => {
        setIsFishingResultInputLocked(false);
        fishingResultLockTimerRef.current = null;
     }, 1000);

     return () => {
        if (fishingResultLockTimerRef.current !== null) {
           window.clearTimeout(fishingResultLockTimerRef.current);
           fishingResultLockTimerRef.current = null;
        }
     };
  }, [fishingMiniGameOpen, fishingMiniGameStage]);

  useEffect(() => {
     if (!fishingMiniGameOpen || fishingMiniGameStage !== 'hit' || isFishingHitSplashActive) return;
     setFishingHitLimitSeconds(10);
     const timerId = window.setInterval(() => {
        setFishingHitLimitSeconds(prev => {
           const next = Math.max(0, Number((prev - 0.1).toFixed(1)));
           if (next <= 0) {
              window.clearInterval(timerId);
              setFishingResultImageSrc(FISHING_SCENE_ESCAPE_SRC);
              setFishingResultSizeCm('');
              setFishingResultIsNewRecord(false);
              setFishingResultText('魚に逃げられた...');
              setDialogMessage('魚に逃げられた...');
              if (isFishingTutorialRun) setFishingTutorialResult('fail');
              playVoiceSound(FISH_LOSE_SOUND_SRC);
              setFishingMiniGameStage('result');
           }
           return next;
        });
     }, 100);
     return () => window.clearInterval(timerId);
  }, [fishingMiniGameOpen, fishingMiniGameStage, isFishingHitSplashActive]);

  useEffect(() => {
     if (!fishingMiniGameOpen || fishingMiniGameStage !== 'keep') return;
     if (fishingFishHp <= 0) {
        const caughtFish = fishingTargetFish;
        if (caughtFish && !caughtFishIds.includes(caughtFish.id)) {
          setCaughtFishIds(prev => [...prev, caughtFish.id]);
        }
        const sizeValue = fishingTargetSizeValue ?? createFishingTargetSize(caughtFish, fishingBiteScore, fishingBiteCombo);
        const sizeCm = sizeValue.toFixed(1);
        const isNewRecord = !!caughtFish && sizeValue > (fishBestSizes[caughtFish.id] ?? 0);
        if (isNewRecord && caughtFish) {
          setFishBestSizes(prev => ({ ...prev, [caughtFish.id]: sizeValue }));
          setFishSizeUpdatedIds(prev => prev.includes(caughtFish.id) ? prev : [...prev, caughtFish.id]);
        }
        setInventoryCounts(prev => ({ ...prev, [caughtFish.name]: (prev[caughtFish.name] ?? 0) + 1 }));
        setFishInventorySizes(prev => ({
          ...prev,
          [caughtFish.name]: [...(prev[caughtFish.name] ?? []), sizeValue],
        }));
        setFishingResultSizeCm(sizeCm);
        setFishingResultImageSrc(caughtFish.imageSrc);
        setFishingResultIsNewRecord(isNewRecord);
        const isNushiCatch = fishingTargetIsNushi || isNushiSize(caughtFish, sizeValue);
        if (isNushiCatch && caughtFish) {
          setNushiCaughtFishIds(prev => prev.includes(caughtFish.id) ? prev : [...prev, caughtFish.id]);
        }
        const catchResultText = isNushiCatch
          ? `なんとヌシが釣れた！${caughtFish.name}を釣り上げた。`
          : `お見事！${caughtFish.name}を釣り上げた。`;
        setFishingResultText(catchResultText);
        setDialogMessage(catchResultText);
        if (isFishingTutorialRun) setFishingTutorialResult('success');
        if (!isFishingTutorialRun) consumeAPForAction();
        playUiSound(IWANA_SPLASH_SOUND_SRC);
        playVoiceSound(FISH_RESULT_SOUND_SRC);
        setIsFishingResultInputLocked(true);
        if (fishingResultLockTimerRef.current !== null) {
          window.clearTimeout(fishingResultLockTimerRef.current);
        }
        fishingResultLockTimerRef.current = window.setTimeout(() => {
          setIsFishingResultInputLocked(false);
          fishingResultLockTimerRef.current = null;
        }, 3000);
        setFishingMiniGameStage('result');
        return;
     }
     if (fishingTension >= FISHING_TENSION_MAX) {
        setFishingResultImageSrc(FISHING_SCENE_ESCAPE_SRC);
        setFishingResultSizeCm('');
        setFishingResultIsNewRecord(false);
        setFishingResultText('糸が切れて魚に逃げられた...');
        setDialogMessage('糸が切れて魚に逃げられた...');
        if (isFishingTutorialRun) setFishingTutorialResult('fail');
        playVoiceSound(FISH_LOSE_SOUND_SRC);
        setFishingMiniGameStage('result');
     }
  }, [caughtFishIds, currentAP, fishBestSizes, fishingBiteCombo, fishingBiteScore, fishingFishHp, fishingTargetFish, fishingTargetIsNushi, fishingTargetSizeValue, fishingTension, fishingMiniGameOpen, fishingMiniGameStage, isFishingTutorialRun, maxAPPerTimeSlot, timeOfDay]);

  const TILE_SIZE = 15;
  const GRID_COLS = 128; // 1920 / 15
  const GRID_ROWS = 72; // 1080 / 15
  const validGameMaps = Object.keys(mapBackgrounds) as GameMap[];
  const isGameMap = (value: string): value is GameMap => validGameMaps.includes(value as GameMap);
  const isEnabledTileValue = (value: unknown): value is true => value === true;
  const isFootstepTileValue = (value: unknown): value is FootstepSound => (
    typeof value === 'string' && value in FOOTSTEP_SOUNDS
  );

  const normalizeTileRecord = <T,>(
    raw: unknown,
    isValidValue: (value: unknown) => value is T
  ): Record<string, T> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const next: Record<string, T> = {};
    Object.entries(raw as Record<string, unknown>).forEach(([rawKey, value]) => {
      if (!isValidValue(value)) return;

      let map: GameMap = 'farm';
      let tilePart = rawKey;
      const separatorIndex = rawKey.indexOf('_');
      if (separatorIndex > 0) {
        const mapPart = rawKey.slice(0, separatorIndex);
        if (!isGameMap(mapPart)) return;
        map = mapPart;
        tilePart = rawKey.slice(separatorIndex + 1);
      }

      const match = /^(\d+),(\d+)$/.exec(tilePart);
      if (!match) return;

      const gx = Number(match[1]);
      const gy = Number(match[2]);
      if (!Number.isInteger(gx) || !Number.isInteger(gy)) return;
      if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;

      next[`${map}_${gx},${gy}`] = value;
    });
    return next;
  };

  const createDefaultBedTiles = () => {
    const tiles: Record<string, boolean> = {};
    const minGridX = Math.floor(HOUSE_BED_SLEEP_ZONE.x / TILE_SIZE);
    const maxGridX = Math.floor((HOUSE_BED_SLEEP_ZONE.x + HOUSE_BED_SLEEP_ZONE.w) / TILE_SIZE);
    const minGridY = Math.floor(HOUSE_BED_SLEEP_ZONE.y / TILE_SIZE);
    const maxGridY = Math.floor((HOUSE_BED_SLEEP_ZONE.y + HOUSE_BED_SLEEP_ZONE.h) / TILE_SIZE);

    for (let gx = minGridX; gx <= maxGridX; gx++) {
      for (let gy = minGridY; gy <= maxGridY; gy++) {
        tiles[`house_${gx},${gy}`] = true;
      }
    }
    return tiles;
  };

  const [obstacles, setObstacles] = useState<Record<string, boolean>>({});
  const [selectedCollisionDrawMode, setSelectedCollisionDrawMode] = useState<CollisionDrawMode>('paint');
  const [collisionBrushSize, setCollisionBrushSize] = useState<1 | 3 | 5>(1);
  const [hideAreaTiles, setHideAreaTiles] = useState<Record<string, boolean>>({});
  const [selectedHideAreaDrawMode, setSelectedHideAreaDrawMode] = useState<HideAreaDrawMode>('paint');
  const [hideAreaBrushSize, setHideAreaBrushSize] = useState<1 | 3 | 5>(1);
  const [bathTubMaskTiles, setBathTubMaskTiles] = useState<Record<string, boolean>>({});
  const [selectedBathTubMaskDrawMode, setSelectedBathTubMaskDrawMode] = useState<HideAreaDrawMode>('paint');
  const [bathTubMaskBrushSize, setBathTubMaskBrushSize] = useState<1 | 3 | 5>(1);
  const [footstepTiles, setFootstepTiles] = useState<Record<string, FootstepSound>>({});
  const [selectedFootstepSound, setSelectedFootstepSound] = useState<FootstepSound | 'erase'>('grass');
  const [footstepBrushSize, setFootstepBrushSize] = useState<1 | 3 | 5>(1);
  const [wallBumpSound, setWallBumpSound] = useState<WallBumpSound>('door');
  const [footstepDrawMode, setFootstepDrawMode] = useState<FootstepSound | 'erase' | null>(null);

  const [bedTiles, setBedTiles] = useState<Record<string, boolean>>(createDefaultBedTiles());
  const [workbenchTiles, setWorkbenchTiles] = useState<Record<string, boolean>>({});
  const [fishingTiles, setFishingTiles] = useState<Record<string, boolean>>({});
  const [miningTiles, setMiningTiles] = useState<Record<string, boolean>>({});
  const [loggingTiles, setLoggingTiles] = useState<Record<string, boolean>>({});
  const [selectedEventTileType, setSelectedEventTileType] = useState<'bed' | 'workbench' | 'fishing' | 'mining' | 'logging' | 'inspect' | 'auto'>('bed');
  const [bedDrawMode, setBedDrawMode] = useState<boolean | null>(null);
  const [bathTubMaskZone, setBathTubMaskZone] = useState<RectZone>(DEFAULT_HOUSE_BATH_TUB_MASK_ZONE);

  const createCurrentMapSettingsSnapshot = () => ({
    zones,
    doors,
    obstacles,
    hideAreaTiles,
    bathTubMaskTiles,
    footstepTiles,
    wallBumpSound,
    bedTiles,
    workbenchTiles,
    fishingTiles,
    miningTiles,
    loggingTiles,
    inspectSpots,
    fieldCorners,
    fieldGridSizes,
    mapBgmSources,
    bathTubMaskZone,
  });

  const createMapSettingsSnapshotFromSave = (data: Record<string, unknown>) => {
    const current = createCurrentMapSettingsSnapshot();
    const nextZones = Array.isArray(data.zones) ? ensureRequiredZones(data.zones as AnimZone[]) : current.zones;
    let nextDoors = current.doors;
    if (Array.isArray(data.doors)) {
      const migratedDoors = (data.doors as WarpDoor[]).map(d => {
        if (d.id === 'door_to_house' && d.spawnY === 900) return { ...d, spawnY: 770 };
        if (d.id === 'door_to_shed' && d.spawnY === 900) return { ...d, spawnY: 650 };
        return d;
      });
      nextDoors = ensureRequiredRouteDoors(migratedDoors);
    }

    const nextMapBgms = { ...current.mapBgmSources };
    if (data.mapBgmSources && typeof data.mapBgmSources === 'object') {
      const bgmSrcSet = new Set(BGM_FILE_ENTRIES.map(entry => entry.src));
      Object.entries(data.mapBgmSources as Partial<Record<GameMap, string>>).forEach(([map, src]) => {
        if (map in DEFAULT_MAP_BGM_SOURCES && typeof src === 'string' && bgmSrcSet.has(src)) {
          nextMapBgms[map as GameMap] = src;
        }
      });
    }

    return {
      zones: nextZones,
      doors: nextDoors,
      obstacles: data.obstacles ? normalizeTileRecord(data.obstacles, isEnabledTileValue) : current.obstacles,
      hideAreaTiles: data.hideAreaTiles ? normalizeTileRecord(data.hideAreaTiles, isEnabledTileValue) : current.hideAreaTiles,
      bathTubMaskTiles: data.bathTubMaskTiles ? normalizeTileRecord(data.bathTubMaskTiles, isEnabledTileValue) : current.bathTubMaskTiles,
      footstepTiles: data.footstepTiles ? normalizeTileRecord(data.footstepTiles, isFootstepTileValue) : current.footstepTiles,
      wallBumpSound: typeof data.wallBumpSound === 'string' ? data.wallBumpSound as WallBumpSound : current.wallBumpSound,
      bedTiles: data.bedTiles ? normalizeTileRecord(data.bedTiles, isEnabledTileValue) : current.bedTiles,
      workbenchTiles: data.workbenchTiles ? normalizeTileRecord(data.workbenchTiles, isEnabledTileValue) : current.workbenchTiles,
      fishingTiles: data.fishingTiles ? normalizeTileRecord(data.fishingTiles, isEnabledTileValue) : current.fishingTiles,
      miningTiles: data.miningTiles ? normalizeTileRecord(data.miningTiles, isEnabledTileValue) : current.miningTiles,
      loggingTiles: data.loggingTiles ? normalizeTileRecord(data.loggingTiles, isEnabledTileValue) : current.loggingTiles,
      inspectSpots: Array.isArray(data.inspectSpots)
        ? data.inspectSpots.filter((spot: InspectSpot) => (
          spot &&
          typeof spot.id === 'string' &&
          spot.map in mapBackgrounds &&
          typeof spot.x === 'number' &&
          typeof spot.y === 'number' &&
          typeof spot.w === 'number' &&
          typeof spot.h === 'number' &&
          typeof spot.label === 'string' &&
          typeof spot.text === 'string'
        ))
        : current.inspectSpots,
      fieldCorners: data.fieldCorners ? data.fieldCorners as FieldCornerMap : current.fieldCorners,
      fieldGridSizes: data.fieldGridSizes ? data.fieldGridSizes as FieldGridSizeMap : current.fieldGridSizes,
      mapBgmSources: nextMapBgms,
      bathTubMaskZone: (
        data.bathTubMaskZone &&
        typeof (data.bathTubMaskZone as RectZone).x === 'number' &&
        typeof (data.bathTubMaskZone as RectZone).y === 'number' &&
        typeof (data.bathTubMaskZone as RectZone).w === 'number' &&
        typeof (data.bathTubMaskZone as RectZone).h === 'number'
      ) ? data.bathTubMaskZone as RectZone : current.bathTubMaskZone,
    };
  };

  const applyMapSettingsSnapshot = (snapshot: ReturnType<typeof createCurrentMapSettingsSnapshot>) => {
    setZones(snapshot.zones);
    setDoors(snapshot.doors);
    setObstacles(snapshot.obstacles);
    setHideAreaTiles(snapshot.hideAreaTiles);
    setBathTubMaskTiles(snapshot.bathTubMaskTiles);
    setFootstepTiles(snapshot.footstepTiles);
    setWallBumpSound(snapshot.wallBumpSound);
    setBedTiles(snapshot.bedTiles);
    setWorkbenchTiles(snapshot.workbenchTiles);
    setFishingTiles(snapshot.fishingTiles);
    setMiningTiles(snapshot.miningTiles);
    setLoggingTiles(snapshot.loggingTiles);
    setInspectSpots(snapshot.inspectSpots);
    setFieldCorners(snapshot.fieldCorners);
    setFieldGridSizes(snapshot.fieldGridSizes);
    setMapBgmSources(snapshot.mapBgmSources);
    setBathTubMaskZone(snapshot.bathTubMaskZone);
  };

  const [plantedCrops, setPlantedCrops] = useState<Record<string, boolean>>({});
  const [fieldCorners, setFieldCorners] = useState<FieldCornerMap>(DEFAULT_FIELD_CORNERS);
  const [fieldGridSizes, setFieldGridSizes] = useState<FieldGridSizeMap>(DEFAULT_FIELD_GRID_SIZES);
  const [draggingFieldCorner, setDraggingFieldCorner] = useState<{ fieldId: FieldId; corner: FieldCornerKey } | null>(null);

  const currentMapRef = useRef(currentMap);
  useEffect(() => { currentMapRef.current = currentMap; }, [currentMap]);

  const doorsRef = useRef(doors);
  useEffect(() => { doorsRef.current = doors; }, [doors]);

  const inspectSpotsRef = useRef(inspectSpots);
  useEffect(() => { inspectSpotsRef.current = inspectSpots; }, [inspectSpots]);

  const obstaclesRef = useRef(obstacles);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);

  const wallBumpSoundRef = useRef<WallBumpSound>(wallBumpSound);
  useEffect(() => {
     wallBumpSoundRef.current = wallBumpSound;
  }, [wallBumpSound]);

  const [isDrawing, setIsDrawing] = useState<boolean | null>(null); // null = drawing not active, true = add obstacle, false = remove obstacle
  const lastCollisionPaintPoint = useRef<{ x: number; y: number } | null>(null);
  const hideAreaDrawModeRef = useRef<HideAreaDrawMode | null>(null);
  const lastHideAreaPaintPoint = useRef<{ x: number; y: number } | null>(null);
  const bathTubMaskDrawModeRef = useRef<HideAreaDrawMode | null>(null);
  const lastBathTubMaskPaintPoint = useRef<{ x: number; y: number } | null>(null);

  // 起動時のセーブデータロード
  useEffect(() => {
    if (bootMode !== 'loadingSave') return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetch(`/api/save?slot=${currentSaveSlot}`).then(res => res.json()),
      startingNewGame
        ? fetch('/api/map-settings').then(res => res.json())
        : Promise.resolve(null),
    ])
      .then(([data, savedMapSettings]) => {
        if (!active) return;
        const loadedSaveData = data && typeof data === 'object' && !Array.isArray(data)
          ? data as Record<string, unknown>
          : {};
        const canonicalMapSettings = savedMapSettings && typeof savedMapSettings === 'object' && !Array.isArray(savedMapSettings)
          ? savedMapSettings as Record<string, unknown>
          : loadedSaveData;
        const mapSettingsForNewGame = startingNewGame
          ? createMapSettingsSnapshotFromSave(canonicalMapSettings)
          : null;
        if (data && Object.keys(data).length > 0) {
	          if (
	            typeof data.turn === 'number' &&
	            Number.isInteger(data.turn) &&
	            data.turn >= 0
	          ) {
	            setTurn(data.turn);
	          }
	          if (typeof data.currentMap === 'string' && data.currentMap in mapBackgrounds) {
	            setCurrentMap(data.currentMap as GameMap);
	            currentMapRef.current = data.currentMap as GameMap;
	          }
	          if (data.zones) setZones(ensureRequiredZones(data.zones));
          if (data.doors) {
            const parsedDoors = data.doors as WarpDoor[];
            const migratedDoors = parsedDoors.map(d => {
              if (d.id === 'door_to_house' && d.spawnY === 900) {
                return { ...d, spawnY: 770 };
              }
              if (d.id === 'door_to_shed' && d.spawnY === 900) {
                return { ...d, spawnY: 650 };
              }
              return d;
            });
            setDoors(ensureRequiredRouteDoors(migratedDoors));
          }
	          if (typeof data.bgmVolume === 'number') setBgmVolume(data.bgmVolume);
	          if (typeof data.seVolume === 'number') setSeVolume(data.seVolume);
	          if (typeof data.voiceVolume === 'number') setVoiceVolume(data.voiceVolume);
	          const loadedDifficulty = typeof data.difficulty === 'string' && DIFFICULTY_OPTIONS.some(option => option.id === data.difficulty)
	            ? data.difficulty as GameDifficulty
	            : 'hard';
	          setDifficulty(loadedDifficulty);
	          const loadedDebtAmount = typeof data.debtAmount === 'number' && Number.isFinite(data.debtAmount) && data.debtAmount >= 0
	            ? data.debtAmount
	            : typeof data.debt === 'number' && Number.isFinite(data.debt) && data.debt >= 0
	              ? data.debt
	              : getInitialDebtAmount(loadedDifficulty);
	          setDebtAmount(loadedDebtAmount);
	          setRepaymentCycleDays(
	            typeof data.repaymentCycleDays === 'number' && Number.isInteger(data.repaymentCycleDays) && data.repaymentCycleDays > 0
	              ? data.repaymentCycleDays
	              : DEFAULT_REPAYMENT_CYCLE_DAYS
	          );
	          const loadedFarmCredit = typeof data.farmCredit === 'number' && Number.isFinite(data.farmCredit)
	            ? clampNumber(data.farmCredit, 0, 100)
	            : 0;
	          const loadedMissedRepaymentCount = typeof data.missedRepaymentCount === 'number' && Number.isInteger(data.missedRepaymentCount) && data.missedRepaymentCount >= 0
	            ? data.missedRepaymentCount
	            : 0;
	          const loadedRepaymentCycleDays = typeof data.repaymentCycleDays === 'number' && Number.isInteger(data.repaymentCycleDays) && data.repaymentCycleDays > 0
	            ? data.repaymentCycleDays
	            : DEFAULT_REPAYMENT_CYCLE_DAYS;
	          const loadedTurn = typeof data.turn === 'number' && Number.isInteger(data.turn) && data.turn >= 0 ? data.turn : 0;
	          const loadedCurrentDay = Math.floor(loadedTurn / 4) + 1;
	          const loadedInterestCycleIndex = Math.floor((loadedCurrentDay - 1) / loadedRepaymentCycleDays);
	          setFarmCredit(loadedFarmCredit);
	          setMissedRepaymentCount(loadedMissedRepaymentCount);
	          setHasBeastPremonition(typeof data.hasBeastPremonition === 'boolean' ? data.hasBeastPremonition : false);
	          setPremonitionDay(typeof data.premonitionDay === 'number' && Number.isInteger(data.premonitionDay) && data.premonitionDay > 0 ? data.premonitionDay : null);
	          setScheduledBeastAttackDay(typeof data.scheduledBeastAttackDay === 'number' && Number.isInteger(data.scheduledBeastAttackDay) && data.scheduledBeastAttackDay > 0 ? data.scheduledBeastAttackDay : null);
	          setBeastAttackPending(typeof data.beastAttackPending === 'boolean' ? data.beastAttackPending : false);
	          setCompanionGirlId(typeof data.companionGirlId === 'string' && GIRL_DATA.some(girl => girl.id === data.companionGirlId) ? data.companionGirlId : null);
	          setCurrentWeeklyInterestRate(
	            typeof data.currentWeeklyInterestRate === 'number' && Number.isFinite(data.currentWeeklyInterestRate)
	              ? clampNumber(data.currentWeeklyInterestRate, MIN_INTEREST_RATE, MAX_INTEREST_RATE)
	              : createWeeklyInterestRate(loadedDifficulty, loadedFarmCredit, loadedMissedRepaymentCount)
	          );
	          setInterestRateCycleIndex(
	            typeof data.interestRateCycleIndex === 'number' && Number.isInteger(data.interestRateCycleIndex) && data.interestRateCycleIndex >= 0
	              ? data.interestRateCycleIndex
	              : loadedInterestCycleIndex
	          );
	          setFarmGirls(normalizeFarmGirls(data.farmGirls));
	          setOwnedGirlSeeds(normalizeOwnedGirlSeeds(data.ownedGirlSeeds));
	          setFarmFieldSlots(normalizeFarmFieldSlots(data.farmFieldSlots, loadedDifficulty));
	          setCurrentAP(
	            typeof data.currentAP === 'number' && Number.isInteger(data.currentAP) && data.currentAP >= 0
	              ? Math.min(data.currentAP, maxAPPerTimeSlot)
	              : maxAPPerTimeSlot
	          );
          if (data.audioGains) {
            const migratedAudioGains = { ...data.audioGains };
            if (typeof migratedAudioGains['/taki.mp3'] === 'number' && typeof migratedAudioGains[WATERFALL_SOUND_SRC] !== 'number') {
              migratedAudioGains[WATERFALL_SOUND_SRC] = migratedAudioGains['/taki.mp3'];
            }
            if (typeof migratedAudioGains['/semi.mp3'] === 'number' && typeof migratedAudioGains[CICADA_SOUND_SRC] !== 'number') {
              migratedAudioGains[CICADA_SOUND_SRC] = migratedAudioGains['/semi.mp3'];
            }
            setAudioGains({ ...DEFAULT_AUDIO_GAINS, ...migratedAudioGains });
          }
          if (data.mapBgmSources) {
            const bgmSrcSet = new Set(BGM_FILE_ENTRIES.map(entry => entry.src));
            const parsedMapBgms = data.mapBgmSources as Partial<Record<GameMap, string>>;
            const nextMapBgms = { ...DEFAULT_MAP_BGM_SOURCES };
            Object.entries(parsedMapBgms).forEach(([map, src]) => {
              if (map in DEFAULT_MAP_BGM_SOURCES && typeof src === 'string' && bgmSrcSet.has(src)) {
                nextMapBgms[map as GameMap] = src;
              }
            });
            setMapBgmSources(nextMapBgms);
          }
          
          if (data.obstacles) {
            setObstacles(normalizeTileRecord(data.obstacles, isEnabledTileValue));
          }
          
          if (data.footstepTiles) {
            setFootstepTiles(normalizeTileRecord(data.footstepTiles, isFootstepTileValue));
          }

          if (data.hideAreaTiles) {
            setHideAreaTiles(normalizeTileRecord(data.hideAreaTiles, isEnabledTileValue));
          }

          if (data.bathTubMaskTiles) {
            setBathTubMaskTiles(normalizeTileRecord(data.bathTubMaskTiles, isEnabledTileValue));
          }
          
          if (data.wallBumpSound) setWallBumpSound(data.wallBumpSound);
          if (data.bedTiles) setBedTiles(normalizeTileRecord(data.bedTiles, isEnabledTileValue));
          if (data.workbenchTiles) setWorkbenchTiles(normalizeTileRecord(data.workbenchTiles, isEnabledTileValue));
          if (data.fishingTiles) setFishingTiles(normalizeTileRecord(data.fishingTiles, isEnabledTileValue));
          if (data.miningTiles) setMiningTiles(normalizeTileRecord(data.miningTiles, isEnabledTileValue));
          if (data.loggingTiles) setLoggingTiles(normalizeTileRecord(data.loggingTiles, isEnabledTileValue));
          if (Array.isArray(data.inspectSpots)) {
            setInspectSpots(data.inspectSpots.filter((spot: InspectSpot) => (
              spot &&
              typeof spot.id === 'string' &&
              spot.map in mapBackgrounds &&
              typeof spot.x === 'number' &&
              typeof spot.y === 'number' &&
              typeof spot.w === 'number' &&
              typeof spot.h === 'number' &&
              typeof spot.label === 'string' &&
              typeof spot.text === 'string'
            )));
          }
          if (data.plantedCrops) setPlantedCrops(data.plantedCrops);
          if (data.fieldCorners) setFieldCorners(data.fieldCorners);
          if (data.fieldGridSizes) setFieldGridSizes(data.fieldGridSizes);
          if (Array.isArray(data.caughtFishIds)) {
            setCaughtFishIds(data.caughtFishIds.filter((id: unknown): id is string => (
              typeof id === 'string' && FISH_ZUKAN_ENTRIES.some(fish => fish.id === id)
            )));
          }
          if (Array.isArray(data.nushiCaughtFishIds)) {
            setNushiCaughtFishIds(data.nushiCaughtFishIds.filter((id: unknown): id is string => (
              typeof id === 'string' && FISH_ZUKAN_ENTRIES.some(fish => fish.id === id)
            )));
          }
          if (data.fishBestSizes && typeof data.fishBestSizes === 'object') {
            const parsedBestSizes = data.fishBestSizes as Record<string, unknown>;
            setFishBestSizes(Object.fromEntries(
              Object.entries(parsedBestSizes).filter(([id, size]) => (
                FISH_ZUKAN_ENTRIES.some(fish => fish.id === id) &&
                typeof size === 'number' &&
                Number.isFinite(size)
              ))
            ) as Record<string, number>);
          }
          if (data.inventoryCounts && typeof data.inventoryCounts === 'object') {
            const parsedInventoryCounts = data.inventoryCounts as Record<string, unknown>;
            setInventoryCounts(prev => ({
              ...prev,
              ...Object.fromEntries(
                Object.entries(parsedInventoryCounts).filter(([, count]) => (
                  typeof count === 'number' &&
                  Number.isFinite(count) &&
                  count >= 0
                ))
              ) as Record<string, number>,
            }));
          }
          if (data.equippedItems && typeof data.equippedItems === 'object') {
            const parsedEquippedItems = data.equippedItems as Record<string, unknown>;
            setEquippedItems(prev => ({
              ...prev,
              ...Object.fromEntries(
                Object.entries(parsedEquippedItems)
                  .filter(([, item]) => typeof item === 'string')
              ) as Record<string, string>,
            }));
          }
          if (data.fishInventorySizes && typeof data.fishInventorySizes === 'object') {
            const parsedFishInventorySizes = data.fishInventorySizes as Record<string, unknown>;
            setFishInventorySizes(Object.fromEntries(
              Object.entries(parsedFishInventorySizes)
                .filter(([name, sizes]) => FISH_ITEM_NAMES.has(name) && Array.isArray(sizes))
                .map(([name, sizes]) => [
                  name,
                  (sizes as unknown[]).filter((size): size is number => (
                    typeof size === 'number' &&
                    Number.isFinite(size) &&
                    size > 0
                  )),
                ])
            ) as Record<string, number[]>);
          }
          if (data.lumberInventorySizes && typeof data.lumberInventorySizes === 'object') {
            const parsedLumberInventorySizes = data.lumberInventorySizes as Record<string, unknown>;
            setLumberInventorySizes(Object.fromEntries(
              Object.entries(parsedLumberInventorySizes)
                .filter(([name, sizes]) => LUMBER_ITEM_NAMES.has(name) && Array.isArray(sizes))
                .map(([name, sizes]) => [
                  name,
                  (sizes as unknown[]).filter((size): size is number => (
                    typeof size === 'number' &&
                    Number.isFinite(size) &&
                    size > 0
                  )),
                ])
            ) as Record<string, number[]>);
          }
          if (data.oreInventoryWeights && typeof data.oreInventoryWeights === 'object') {
            const parsedOreWeights = data.oreInventoryWeights as Record<string, unknown>;
            setOreInventoryWeights(Object.fromEntries(
              Object.entries(parsedOreWeights)
                .filter(([name, weights]) => ORE_ITEM_NAMES.has(name) && Array.isArray(weights))
                .map(([name, weights]) => [
                  name,
                  (weights as unknown[]).filter((weight): weight is number => (
                    typeof weight === 'number' && Number.isFinite(weight) && weight > 0
                  )),
                ])
            ) as Record<string, number[]>);
          }
          if (data.depletedMiningPointIds && typeof data.depletedMiningPointIds === 'object') {
            setDepletedMiningPointIds(normalizeTileRecord(data.depletedMiningPointIds, isEnabledTileValue));
          }
          if (typeof data.fishingTutorialCompleted === 'boolean') {
            setFishingTutorialCompleted(data.fishingTutorialCompleted);
          }
          if (typeof data.sawCraftTutorialReady === 'boolean') {
            setSawCraftTutorialReady(data.sawCraftTutorialReady);
          }
          if (isCraftRecipeId(data.craftTutorialRecipeName)) {
            setCraftTutorialRecipeName(data.craftTutorialRecipeName);
          }
          if (typeof data.sawCraftTutorialWorkbenchReady === 'boolean') {
            setSawCraftTutorialWorkbenchReady(data.sawCraftTutorialWorkbenchReady);
          }
          if (typeof data.sawCraftTutorialCompleted === 'boolean') {
            setSawCraftTutorialCompleted(data.sawCraftTutorialCompleted);
          }
          if (Array.isArray(data.craftedRecipeIds)) {
            setCraftedRecipeIds(data.craftedRecipeIds.filter((name: unknown): name is CraftRecipeId => (
              typeof name === 'string' && isCraftRecipeId(name)
            )));
          }
          if (typeof data.gatheringTutorialCompleted === 'boolean') {
            setGatheringTutorialCompleted(data.gatheringTutorialCompleted);
          }
          if (data.fishingTutorialCompleted === true) {
            setInventoryCounts(prev => ({ ...prev, '竹の釣竿': Math.max(1, prev['竹の釣竿'] ?? 0) }));
            setEquippedItems(prev => ({ ...prev, '主人公-slot1': '竹の釣竿' }));
          } else {
            setInventoryCounts(prev => ({ ...prev, '竹の釣竿': 0 }));
            setEquippedItems(prev => ({
              ...prev,
              '主人公-slot1': prev['主人公-slot1'] === '竹の釣竿' ? '' : prev['主人公-slot1'],
            }));
          }
          if (Array.isArray(data.kurumiIntroAskedTopics)) {
            setKurumiIntroAskedTopics(data.kurumiIntroAskedTopics.filter((id: unknown): id is KurumiIntroTopicId => (
              typeof id === 'string' && KURUMI_INTRO_TOPIC_IDS.includes(id as KurumiIntroTopicId)
            )));
          }
          if (
            typeof data.kurumiIntroCompletedDay === 'number' &&
            Number.isFinite(data.kurumiIntroCompletedDay) &&
            data.kurumiIntroCompletedDay >= 1
          ) {
            setKurumiIntroCompletedDay(data.kurumiIntroCompletedDay);
          }
          if (
            data.bathTubMaskZone &&
            typeof data.bathTubMaskZone.x === 'number' &&
            typeof data.bathTubMaskZone.y === 'number' &&
            typeof data.bathTubMaskZone.w === 'number' &&
            typeof data.bathTubMaskZone.h === 'number'
          ) {
            setBathTubMaskZone(data.bathTubMaskZone);
          }
        }
        if (startingNewGame) {
          if (mapSettingsForNewGame) {
            applyMapSettingsSnapshot(mapSettingsForNewGame);
          }
          setTurn(0);
          setGold(5000);
          const difficultyOption = DIFFICULTY_OPTIONS.find(option => option.id === pendingNewGameDifficulty) ?? DIFFICULTY_OPTIONS[2];
          setDifficulty(difficultyOption.id);
          setDebtAmount(getInitialDebtAmount(difficultyOption.id));
          setRepaymentCycleDays(DEFAULT_REPAYMENT_CYCLE_DAYS);
          setFarmCredit(0);
          setMissedRepaymentCount(0);
          setHasBeastPremonition(false);
          setPremonitionDay(null);
          setScheduledBeastAttackDay(null);
          setBeastAttackPending(false);
          setCompanionGirlId(null);
          setCurrentWeeklyInterestRate(createWeeklyInterestRate(difficultyOption.id, 0, 0));
          setInterestRateCycleIndex(0);
          setCurrentAP(maxAPPerTimeSlot);
          setKurumiTradeTotal(0);
          setShownKurumiTradeRewardThresholds([]);
          setFarmGirls(createInitialFarmGirls());
          setOwnedGirlSeeds([...INITIAL_OWNED_GIRL_SEEDS]);
          setFarmFieldSlots(createInitialFarmFieldSlots(difficultyOption.id));
          setPlantingSeedId(null);
          setKurumiIntroAskedTopics([]);
          setKurumiIntroCompletedDay(null);
          setCaughtFishIds([]);
          setNushiCaughtFishIds([]);
          setFishBestSizes({});
          setFishSizeUpdatedIds([]);
          setFishInventorySizes({});
          setLumberInventorySizes({});
          setOreInventoryWeights({});
          setDepletedMiningPointIds({});
          setFishingTutorialCompleted(false);
          setFishingTutorialOpen(false);
          setSawCraftTutorialIntroOpen(false);
          setSawCraftTutorialIntroStepIndex(0);
          setSawCraftTutorialReady(false);
          setSawCraftTutorialShedDialogueOpen(false);
          setSawCraftTutorialWorkbenchReady(false);
          setSawCraftTutorialCompleted(false);
          setIsFishingTutorialRun(false);
          setFishingTutorialResult(null);
          setInventoryCounts({ ...INITIAL_INVENTORY_COUNTS });
          setEquippedItems({ ...INITIAL_EQUIPPED_ITEMS });
          equippedItemsRef.current = { ...INITIAL_EQUIPPED_ITEMS };
          setCurrentMap('farm');
          currentMapRef.current = 'farm';
          setPos({ x: 960, y: 540 });
          posRef.current = { x: 960, y: 540 };
          setDir('down');
          setDialogMessage(DEFAULT_SYSTEM_MESSAGE);
          setShowDialog(false);
        }
        setStartingNewGame(false);
        setBootMode('playing');
        setMenuOpen(false);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('セーブデータの読み込みに失敗しました:', err);
        setStartingNewGame(false);
        setBootMode('playing');
        setMenuOpen(false);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bootMode, currentSaveSlot, startingNewGame, pendingNewGameDifficulty]);

  const createSaveData = () => ({
    turn,
    gold,
    debt: debtAmount,
    debtAmount,
    repaymentCycleDays,
    farmCredit,
    missedRepaymentCount,
    hasBeastPremonition,
    premonitionDay,
    scheduledBeastAttackDay,
    beastAttackPending,
    companionGirlId,
    currentWeeklyInterestRate,
    interestRateCycleIndex,
    farmGirls,
    ownedGirlSeeds,
    farmFieldSlots,
    currentAP,
    maxAPPerTimeSlot,
    difficulty,
    currentMap,
    zones,
    doors,
    bgmVolume,
    seVolume,
    voiceVolume,
    audioGains,
    mapBgmSources,
    obstacles: normalizeTileRecord(obstacles, isEnabledTileValue),
    hideAreaTiles: normalizeTileRecord(hideAreaTiles, isEnabledTileValue),
    bathTubMaskTiles: normalizeTileRecord(bathTubMaskTiles, isEnabledTileValue),
    footstepTiles: normalizeTileRecord(footstepTiles, isFootstepTileValue),
    wallBumpSound,
    bedTiles: normalizeTileRecord(bedTiles, isEnabledTileValue),
    workbenchTiles: normalizeTileRecord(workbenchTiles, isEnabledTileValue),
    fishingTiles: normalizeTileRecord(fishingTiles, isEnabledTileValue),
    miningTiles: normalizeTileRecord(miningTiles, isEnabledTileValue),
    loggingTiles: normalizeTileRecord(loggingTiles, isEnabledTileValue),
    inspectSpots,
    plantedCrops,
    fieldCorners,
    fieldGridSizes,
    inventoryCounts,
    equippedItems,
    caughtFishIds,
    nushiCaughtFishIds,
    fishBestSizes,
    fishInventorySizes,
    lumberInventorySizes,
    oreInventoryWeights,
    depletedMiningPointIds,
    fishingTutorialCompleted,
    craftTutorialRecipeName,
    sawCraftTutorialReady,
    sawCraftTutorialWorkbenchReady,
    sawCraftTutorialCompleted,
    craftedRecipeIds,
    gatheringTutorialCompleted,
    kurumiIntroAskedTopics,
    kurumiIntroCompletedDay,
    bathTubMaskZone
  });

  const refreshSaveSlotSummaries = () => {
    fetch('/api/save-slots')
      .then(res => res.json())
      .then((data: SaveSlotSummary[]) => {
        if (Array.isArray(data)) {
          setSaveSlotSummaries(data.map(summary => (
            autoSaveBlockedSlotsRef.current.has(summary.slot)
              ? { slot: summary.slot, exists: false }
              : summary
          )));
        }
      })
      .catch(err => {
        console.error('セーブスロット一覧の読み込みに失敗しました:', err);
      });
  };

  const saveGameToSlot = (slot: number) => {
    playFixSound();
    autoSaveBlockedSlotsRef.current.delete(slot);
    fetch(`/api/save?slot=${slot}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createSaveData())
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setCurrentSaveSlot(slot);
        setSystemNotice(`スロット${slot}にセーブしました。`);
        setDialogMessage(`スロット${slot}にセーブしました。`);
        refreshSaveSlotSummaries();
        setSystemSlotMode('none');
      })
      .catch(err => {
        console.error('手動セーブに失敗しました:', err);
        setSystemNotice('セーブに失敗しました。');
      });
  };

  const loadGameFromSystemSlot = (slot: number) => {
    playFixSound();
    setCurrentSaveSlot(slot);
    setStartingNewGame(false);
    setSystemSlotMode('none');
    setMenuOpen(false);
    setBootMode('loadingSave');
  };

  const deleteSaveSlot = (slot: number) => {
    const summary = getSlotSummary(slot);
    if (!summary?.exists) return;

    playCursorSound();
    setConfirmPromptChoice('no');
    setPendingDeleteSaveSlot(slot);
  };

  const cancelDeleteSaveSlot = () => {
    if (pendingDeleteSaveSlot === currentSaveSlot) {
      autoSaveBlockedSlotsRef.current.delete(pendingDeleteSaveSlot);
    }
    setPendingDeleteSaveSlot(null);
    setConfirmPromptChoice('no');
  };

  const confirmDeleteSaveSlot = () => {
    if (pendingDeleteSaveSlot === null) return;
    const slot = pendingDeleteSaveSlot;

    autoSaveBlockedSlotsRef.current.add(slot);
    setPendingDeleteSaveSlot(null);
    fetch(`/api/save?slot=${slot}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveSlotSummaries(prev => prev.map(summary => (
          summary.slot === slot ? { slot, exists: false } : summary
        )));
        setSystemNotice(`スロット${slot}のセーブデータを削除しました。`);
        refreshSaveSlotSummaries();
      })
      .catch(err => {
        autoSaveBlockedSlotsRef.current.delete(slot);
        console.error('セーブデータの削除に失敗しました:', err);
        setSystemNotice('セーブデータの削除に失敗しました。');
      });
  };

  const returnToTitle = () => {
    playFixSound();
    setSystemSlotMode('none');
    setTitlePanelMode('none');
    setMenuOpen(false);
    setBootMode('title');
  };

  useEffect(() => {
    if (titlePanelMode === 'new' || titlePanelMode === 'load' || systemSlotMode !== 'none') {
      refreshSaveSlotSummaries();
    }
  }, [titlePanelMode, systemSlotMode]);

  // 状態変更を検知して自動セーブする useEffect
  useEffect(() => {
    if (isLoading) return; // ロード中は保存しない
    if (bootMode !== 'playing') return; // タイトル画面では保存しない
    if (pendingDeleteSaveSlot !== null) return; // 削除確認中に予約済み自動セーブを残さない
    if (autoSaveBlockedSlotsRef.current.has(currentSaveSlot)) return; // 削除直後のスロットを自動復活させない

    const timer = setTimeout(() => {
      fetch(`/api/save?slot=${currentSaveSlot}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createSaveData())
      }).catch(err => {
        console.error('自動セーブに失敗しました:', err);
      });
    }, 1000); // 1秒デバウンス

    return () => clearTimeout(timer);
  }, [
    isLoading,
    bootMode,
    pendingDeleteSaveSlot,
    currentSaveSlot,
    turn,
    currentAP,
    maxAPPerTimeSlot,
    currentMap,
    debtAmount,
    repaymentCycleDays,
    farmCredit,
    missedRepaymentCount,
    hasBeastPremonition,
    premonitionDay,
    scheduledBeastAttackDay,
    beastAttackPending,
    companionGirlId,
    currentWeeklyInterestRate,
    interestRateCycleIndex,
    farmGirls,
    ownedGirlSeeds,
    farmFieldSlots,
    difficulty,
    zones,
    doors,
    bgmVolume,
    seVolume,
    voiceVolume,
    audioGains,
    mapBgmSources,
    obstacles,
    hideAreaTiles,
    bathTubMaskTiles,
    footstepTiles,
    wallBumpSound,
    bedTiles,
    workbenchTiles,
    fishingTiles,
    miningTiles,
    loggingTiles,
    inspectSpots,
    plantedCrops,
    fieldCorners,
    fieldGridSizes,
    inventoryCounts,
    equippedItems,
    caughtFishIds,
    nushiCaughtFishIds,
    fishBestSizes,
    fishInventorySizes,
    lumberInventorySizes,
    oreInventoryWeights,
    depletedMiningPointIds,
    fishingTutorialCompleted,
    craftTutorialRecipeName,
    sawCraftTutorialReady,
    sawCraftTutorialWorkbenchReady,
    sawCraftTutorialCompleted,
    craftedRecipeIds,
    gatheringTutorialCompleted,
    kurumiIntroAskedTopics,
    kurumiIntroCompletedDay,
    bathTubMaskZone
  ]);

  const startNewGameInSlot = (slot: number) => {
    playFixSound();
    const summary = getSlotSummary(slot);
    if (summary?.exists) {
      setPendingOverwriteSaveSlot(slot);
      setConfirmPromptChoice('no');
      return;
    }
    setPendingNewGameSlot(slot);
    setTitlePanelMode('difficulty');
  };

  const cancelOverwriteSaveSlot = () => {
    playFixSound();
    setPendingOverwriteSaveSlot(null);
    setConfirmPromptChoice('no');
  };

  const confirmOverwriteSaveSlot = () => {
    if (pendingOverwriteSaveSlot === null) return;
    playFixSound();
    setPendingNewGameSlot(pendingOverwriteSaveSlot);
    setPendingOverwriteSaveSlot(null);
    setConfirmPromptChoice('no');
    setTitlePanelMode('difficulty');
  };

  const startNewGameWithDifficulty = (difficultyId: GameDifficulty) => {
    const slot = pendingNewGameSlot ?? 1;
    const difficultyOption = DIFFICULTY_OPTIONS.find(option => option.id === difficultyId) ?? DIFFICULTY_OPTIONS[2];
    playFixSound();
    autoSaveBlockedSlotsRef.current.delete(slot);
    setCurrentSaveSlot(slot);
    setPendingNewGameDifficulty(difficultyOption.id);
    setStartingNewGame(true);
    setTitlePanelMode('none');
    setBootMode('loadingSave');
  };

  const continueGameFromSlot = (slot: number) => {
    playFixSound();
    if (!getSlotSummary(slot)?.exists) {
      setMissingSaveSlot(slot);
      return;
    }
    autoSaveBlockedSlotsRef.current.delete(slot);
    setCurrentSaveSlot(slot);
    setStartingNewGame(false);
    setTitlePanelMode('none');
    setBootMode('loadingSave');
  };

  const getFootstepTileKey = (x: number, y: number, map: GameMap) => {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    return `${map}_${gx},${gy}`;
  };

  const saveFootstepTiles = (next: Record<string, FootstepSound>) => {
    // 自動セーブされるため空とします
  };

  const saveBedTiles = (next: Record<string, boolean>) => {
    // 自動セーブされるため空とします
  };

  const savePlantedCrops = (next: Record<string, boolean>) => {
    // 自動セーブされるため空とします
  };

  const saveFieldCorners = (next: FieldCornerMap) => {
    // 自動セーブされるため空とします
  };

  const saveFieldGridSizes = (next: FieldGridSizeMap) => {
    // 自動セーブされるため空とします
  };

  const updateFieldGridSize = (fieldId: FieldId, key: keyof FieldGridSize, value: number) => {
    const safeValue = Math.max(1, Math.min(60, Math.round(value || 1)));
    setFieldGridSizes(prev => {
      return {
        ...prev,
        [fieldId]: {
          ...prev[fieldId],
          [key]: safeValue,
        },
      };
    });
    setPlantedCrops({});
  };

  const handleCropCellClick = (fieldId: string, col: number, row: number) => {
    const key = `${fieldId}_${col},${row}`;
    setPlantedCrops(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const getFarmFieldSlotPoint = (slot: FarmFieldSlotState): Point => {
    const corners = fieldCorners[slot.fieldId];
    const slotCount = getFarmFieldConfig(difficulty, slot.fieldId).slotCount;
    const u = (slot.slotIndex - 0.5) / slotCount;
    const v = 0.5;
    return {
      x: (1 - u) * (1 - v) * corners.topLeft.x + u * (1 - v) * corners.topRight.x + u * v * corners.bottomRight.x + (1 - u) * v * corners.bottomLeft.x,
      y: (1 - u) * (1 - v) * corners.topLeft.y + u * (1 - v) * corners.topRight.y + u * v * corners.bottomRight.y + (1 - u) * v * corners.bottomLeft.y,
    };
  };

  const resetFieldCorners = () => {
    setFieldCorners(DEFAULT_FIELD_CORNERS);
  };

  const resetFieldGridSizes = () => {
    setFieldGridSizes(DEFAULT_FIELD_GRID_SIZES);
    setPlantedCrops({});
  };

  const openBattlePreview = () => {
    playFixSound();
    setBattlePreviewState(createInitialBattlePreviewState(equippedItems));
    setBattlePreviewOpen(true);
  };

  const getBattleResult = (hero: BattlePreviewState['hero'], allies: BattlePreviewState['allies'], beasts: BattlePreviewState['beasts']): BattlePreviewResult => {
    const partyAlive = hero.hp > 0 || allies.some(ally => (ally?.hp ?? 0) > 0);
    const beastsAlive = beasts.some(beast => (beast?.hp ?? 0) > 0);
    if (!partyAlive) return 'defeat';
    if (!beastsAlive) return 'victory';
    return 'ongoing';
  };

  const openBattlePreviewWithBeasts = (beasts: (BattleUnitState | null)[]) => {
    playFixSound();
    setBattlePreviewState(createInitialBattlePreviewState(equippedItems, beasts));
    setBattlePreviewOpen(true);
  };

  const handleBeastAttackFight = () => {
    const beasts = createRandomBeastUnits(difficulty);
    setBeastAttackPending(false);
    setHasBeastPremonition(false);
    setScheduledBeastAttackDay(null);
    setPremonitionDay(null);
    openBattlePreviewWithBeasts(beasts);
  };

  const proceedToNextDay = () => {
    const completedGirlIds = farmGirls.flatMap(girl => {
      if (girl.state !== 'growing') return [];
      const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girl.girlId);
      if (!crop) return [];
      return girl.growthProgress + 1 >= crop.growthDays ? [girl.girlId] : [];
    });
    const completedGirlNames = completedGirlIds.map(girlId => (
      GIRL_DATA.find(girl => girl.id === girlId)?.girlName ?? girlId
    ));

    setTurn(t => (Math.floor(t / 4) + 1) * 4);
    setCurrentAP(maxAPPerTimeSlot);
    setDepletedMiningPointIds({});
    setDepletedLoggingPointIds({});
    setFarmGirls(prev => prev.map(girl => {
      if (girl.state !== 'growing') return girl;
      const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girl.girlId);
      if (!crop) return girl;
      const nextGrowthProgress = girl.growthProgress + 1;
      return {
        ...girl,
        growthProgress: nextGrowthProgress,
        state: nextGrowthProgress >= crop.growthDays ? 'appeared' : 'growing',
      };
    }));
    setFarmFieldSlots(prev => prev.map(slot => (
      slot.girlId && completedGirlIds.includes(slot.girlId)
        ? { ...slot, state: 'appeared' }
        : slot
    )));
    if (completedGirlNames.length > 0) {
      setDialogMessage(`${completedGirlNames.join('、')}が畑に現れた！`);
    }
  };

  const handleBeastAttackWatch = () => {
    setDialogMessage('畑の様子を見守ることにした……');
    setBeastAttackPending(false);
    setHasBeastPremonition(false);
    setPremonitionDay(null);
    setScheduledBeastAttackDay(null);
    proceedToNextDay();
  };

  const handleBattlePreviewCommand = (command: string) => {
    playFixSound();
    setBattlePreviewState(prev => {
      if (prev.result !== 'ongoing') return prev;
      const hero = { ...prev.hero };
      const allies = prev.allies.map(ally => ally ? { ...ally } : null);
      const beasts = prev.beasts.map(beast => beast ? { ...beast } : null);
      const turnLogs: string[] = [];
      const damageTarget = (
        target: BattleUnitState,
        attacker: BattleUnitState,
        options: { isHeroTarget?: boolean; isBeastTarget?: boolean; isBeastAttacker?: boolean } = {},
      ) => {
        const result = calculateBattleDamage(attacker, target, options);
        let damage = result.damage;
        if (options.isHeroTarget && hero.defending) {
          damage = Math.max(1, Math.round(damage * 0.5));
          hero.defending = false;
          turnLogs.push('主人公は防御してダメージを半減した！');
        }
        target.hp = Math.max(0, target.hp - damage);
        return { damage, critical: result.critical };
      };

      if (command === '逃げる') {
        return { ...prev, logs: [...prev.logs, '主人公たちは戦闘から離脱した。'].slice(-12), result: 'escaped' };
      }

      if (command === 'スキル' || command === 'アイテム') {
        return { ...prev, logs: [...prev.logs, `${command}はまだ未実装です。`].slice(-12) };
      }

      if (command === '防御') {
        hero.defending = true;
        turnLogs.push('主人公は防御の構えを取った！');
      }

      if (command === '攻撃') {
        const target = beasts.find(beast => beast && beast.hp > 0);
        if (!target) {
          const result = getBattleResult(hero, allies, beasts);
          return { ...prev, hero, allies, beasts, result };
        }
        turnLogs.push('主人公の攻撃！');
        const { damage, critical } = damageTarget(target, hero, { isBeastTarget: true });
        if (critical) turnLogs.push('クリティカル！');
        turnLogs.push(`${target.name}に${damage}ダメージ！`);
        if (target.hp <= 0) turnLogs.push(`${target.name}を倒した！`);
      }

      let result = getBattleResult(hero, allies, beasts);
      if (result !== 'ongoing') {
        turnLogs.push(result === 'victory' ? '勝利！' : '敗北...');
        const loot = result === 'victory' ? rollBattleLoot(beasts) : [];
        loot.forEach(item => turnLogs.push(`${item.itemName} ×${item.count} を手に入れた！`));
        return { hero, allies, beasts, logs: [...prev.logs, ...turnLogs].slice(-12), result, loot, lootGranted: false };
      }

      allies.forEach(ally => {
        if (!ally || ally.hp <= 0) return;
        const aliveBeasts = beasts.filter((beast): beast is BattleUnitState => Boolean(beast && beast.hp > 0));
        if (aliveBeasts.length === 0) return;
        const target = aliveBeasts[Math.floor(Math.random() * aliveBeasts.length)];
        turnLogs.push(`${ally.name}の攻撃！`);
        const { damage, critical } = damageTarget(target, ally, { isBeastTarget: true });
        if (critical) turnLogs.push('クリティカル！');
        turnLogs.push(`${target.name}に${damage}ダメージ！`);
        if (target.hp <= 0) turnLogs.push(`${target.name}を倒した！`);
      });

      result = getBattleResult(hero, allies, beasts);
      if (result !== 'ongoing') {
        turnLogs.push(result === 'victory' ? '勝利！' : '敗北...');
        const loot = result === 'victory' ? rollBattleLoot(beasts) : [];
        loot.forEach(item => turnLogs.push(`${item.itemName} ×${item.count} を手に入れた！`));
        return { hero, allies, beasts, logs: [...prev.logs, ...turnLogs].slice(-12), result, loot, lootGranted: false };
      }

      beasts.forEach(beast => {
        if (!beast || beast.hp <= 0) return;
        const aliveAllies = allies.filter((ally): ally is BattleUnitState => Boolean(ally && ally.hp > 0));
        const targetHero = hero.hp > 0 && (aliveAllies.length === 0 || Math.random() < 0.7);
        turnLogs.push(`${beast.name}の攻撃！`);
        if (targetHero) {
          const { damage, critical } = damageTarget(hero, beast, { isHeroTarget: true, isBeastAttacker: true });
          if (critical) turnLogs.push('クリティカル！');
          turnLogs.push(`主人公に${damage}ダメージ！`);
          if (hero.hp <= 0) turnLogs.push('主人公は倒れた！');
          return;
        }
        const target = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
        const { damage, critical } = damageTarget(target, beast, { isBeastAttacker: true });
        if (critical) turnLogs.push('クリティカル！');
        turnLogs.push(`${target.name}に${damage}ダメージ！`);
        if (target.hp <= 0) turnLogs.push(`${target.name}は倒れた！`);
      });

      result = getBattleResult(hero, allies, beasts);
      const loot = result === 'victory' ? rollBattleLoot(beasts) : [];
      if (result === 'victory') {
        turnLogs.push('勝利！');
        loot.forEach(item => turnLogs.push(`${item.itemName} ×${item.count} を手に入れた！`));
      }
      if (result === 'defeat') turnLogs.push('敗北...');
      return { hero, allies, beasts, logs: [...prev.logs, ...turnLogs].slice(-12), result, loot, lootGranted: false };
    });
  };

  useEffect(() => {
    if (battlePreviewState.result !== 'victory') return;
    if (battlePreviewState.lootGranted) return;
    if (battlePreviewState.loot.length === 0) {
      setBattlePreviewState(prev => prev.result === 'victory' ? { ...prev, lootGranted: true } : prev);
      return;
    }

    setInventoryCounts(prev => {
      const next = { ...prev };
      battlePreviewState.loot.forEach(item => {
        next[item.itemName] = (next[item.itemName] ?? 0) + item.count;
      });
      return next;
    });
    setBattlePreviewState(prev => prev.result === 'victory' ? { ...prev, lootGranted: true } : prev);
  }, [battlePreviewState.result, battlePreviewState.loot, battlePreviewState.lootGranted]);

  const playSleepSound = (src: string) => {
    try {
      const audio = new Audio(src);
      const categoryVolume = src.startsWith('/bgm/') ? bgmVolume : seVolumeRef.current;
      audio.volume = getEffectiveVolume(src, categoryVolume, audioGainsRef.current);
      void audio.play();
    } catch (e) {
      console.error(e);
    }
  };

  const playUiSound = (src: string) => {
    try {
      const audio = new Audio(src);
      audio.volume = getEffectiveVolume(src, seVolumeRef.current, audioGainsRef.current);
      audio.currentTime = 0;
      void audio.play();
    } catch (e) {
      console.error(e);
    }
  };

  const getVoicePlaybackSrc = (src: string) => {
    if (!src.startsWith('/voice/')) return src;
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}v=${VOICE_AUDIO_CACHE_VERSION}`;
  };

  const playVoiceSound = (src: string) => {
    try {
      const audio = new Audio(getVoicePlaybackSrc(src));
      audio.volume = getEffectiveVolume(src, voiceVolumeRef.current, audioGainsRef.current);
      audio.currentTime = 0;
      void audio.play();
      return audio;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const fadeOutAudio = (audio: HTMLAudioElement | null, fadeMs = 500) => {
    if (!audio) return;
    const startVolume = audio.volume;
    const startTime = performance.now();
    const fade = (now: number) => {
      const progress = Math.min((now - startTime) / fadeMs, 1);
      audio.volume = startVolume * (1 - progress);
      if (progress < 1) {
        requestAnimationFrame(fade);
        return;
      }
      audio.pause();
      audio.currentTime = 0;
    };
    requestAnimationFrame(fade);
  };

  const playKurumiIntroVoice = (src: string) => {
    if (kurumiIntroVoiceRef.current) {
      kurumiIntroVoiceRef.current.pause();
      kurumiIntroVoiceRef.current.currentTime = 0;
      kurumiIntroVoiceRef.current = null;
    }
    kurumiIntroVoiceRef.current = playVoiceSound(src);
  };

  const stopFishingTutorialVoice = () => {
    if (!fishingTutorialVoiceRef.current) return;
    fishingTutorialVoiceRef.current.pause();
    fishingTutorialVoiceRef.current.currentTime = 0;
    fishingTutorialVoiceRef.current = null;
  };

  const playFishingTutorialVoice = (stepIndex: number) => {
    stopFishingTutorialVoice();
    const voiceSrc = FISHING_TUTORIAL_VOICE_SRCS[stepIndex];
    if (!voiceSrc) return;
    fishingTutorialVoiceRef.current = playVoiceSound(voiceSrc);
  };

  const playCursorSound = () => playUiSound(UI_CURSOR_SOUND_SRC);
  const playFixSound = () => playUiSound(UI_FIX_SOUND_SRC);
  const currentDay = Math.floor(turn / 4) + 1;
  const daysUntilRepayment = repaymentCycleDays - ((currentDay - 1) % repaymentCycleDays);
  const currentRepaymentCycleIndex = Math.floor((currentDay - 1) / repaymentCycleDays);
  const farmCreditInterestDiscount = getFarmCreditInterestDiscount(farmCredit);
  const missedRepaymentPenalty = getMissedRepaymentPenalty(missedRepaymentCount);
  const formatInterestRate = (rate: number) => `${rate.toFixed(1)}%`;
  const addOwnedGirlSeed = (seedId: string) => {
    setOwnedGirlSeeds(prev => prev.includes(seedId) ? prev : [...prev, seedId]);
  };
  const getFarmFieldLabel = (fieldId: FieldId) => fieldId === 'left' ? '左畑' : '右畑';
  const getPlantableFarmFieldSlots = () => farmFieldSlots.filter(slot => slot.girlId === null && slot.state === 'none');
  const getFarmGirlHarvestInfo = (girlId: string) => {
    const farmGirl = farmGirls.find(girl => girl.girlId === girlId);
    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girlId);
    if (!farmGirl || !crop || farmGirl.state !== 'appeared') {
      return { canHarvest: false, daysUntilHarvest: null, crop, farmGirl };
    }
    if (farmGirl.lastHarvestDay === null) {
      return { canHarvest: true, daysUntilHarvest: 0, crop, farmGirl };
    }
    const daysSinceHarvest = currentDay - farmGirl.lastHarvestDay;
    const daysUntilHarvest = Math.max(0, crop.harvestIntervalDays - daysSinceHarvest);
    return { canHarvest: daysUntilHarvest <= 0, daysUntilHarvest, crop, farmGirl };
  };
  const harvestFarmGirl = (girlId: string) => {
    const girl = GIRL_DATA.find(entry => entry.id === girlId);
    const { canHarvest, daysUntilHarvest, crop, farmGirl } = getFarmGirlHarvestInfo(girlId);
    if (!crop) {
      setDialogMessage('収穫データが見つかりません。');
      return;
    }
    if (!canHarvest) {
      setDialogMessage(`次回収穫まであと${daysUntilHarvest ?? crop.harvestIntervalDays}日です。`);
      return;
    }

    const trustBeforeHarvest = farmGirl?.trust ?? girl?.initialTrust ?? 0;
    const harvestAmount = getFarmHarvestAmount(crop.baseHarvestAmount, trustBeforeHarvest);
    const nextTrust = Math.min(100, (farmGirl?.trust ?? girl?.initialTrust ?? 0) + TRUST_GAIN_ON_HARVEST);
    const newlyUnlockedTrustEvents = girl?.trustEvents.filter(event => (
      nextTrust >= event.trust && !(farmGirl?.unlockedTrustEventIds ?? []).includes(event.eventId)
    )) ?? [];
    setInventoryCounts(prev => ({
      ...prev,
      [crop.harvestItemName]: (prev[crop.harvestItemName] ?? 0) + harvestAmount,
    }));
    setFarmGirls(prev => prev.map(entry => (
      entry.girlId === girlId
        ? {
          ...entry,
          lastHarvestDay: currentDay,
          trust: Math.min(100, entry.trust + TRUST_GAIN_ON_HARVEST),
          unlockedTrustEventIds: Array.from(new Set([
            ...entry.unlockedTrustEventIds,
            ...newlyUnlockedTrustEvents.map(event => event.eventId),
          ])),
        }
        : entry
    )));
    setDialogMessage(
      newlyUnlockedTrustEvents.length > 0
        ? `${girl?.girlName ?? crop.seedName}との信頼イベントが解放された！`
        : `${girl?.girlName ?? crop.seedName}から${crop.harvestItemName}を${harvestAmount}個収穫しました。信頼度 +${TRUST_GAIN_ON_HARVEST}`
    );
  };
  const plantGirlSeedToSlot = (seedId: string, fieldId: FieldId, slotIndex: number) => {
    const seedData = GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === seedId);
    if (!seedData || !ownedGirlSeeds.includes(seedId)) {
      setDialogMessage('この娘苗はまだ所持していません。');
      return;
    }

    const farmGirl = farmGirls.find(girl => girl.girlId === seedData.girlId);
    if (!farmGirl || farmGirl.state !== 'none' || isFarmGirlDuplicateBlocked(farmGirls, seedData.girlId)) {
      setDialogMessage('同じ娘はすでに存在しているため、植え付けできません。');
      return;
    }

    const targetSlot = farmFieldSlots.find(slot => (
      slot.fieldId === fieldId &&
      slot.slotIndex === slotIndex &&
      slot.girlId === null &&
      slot.state === 'none'
    ));
    if (!targetSlot) {
      setDialogMessage('その畑スロットには植え付けできません。');
      return;
    }

    setFarmGirls(prev => prev.map(girl => (
      girl.girlId === seedData.girlId
        ? {
          ...girl,
          state: 'growing',
          plantedDay: currentDay,
          growthProgress: 0,
          lastHarvestDay: null,
        }
        : girl
    )));
    setFarmFieldSlots(prev => prev.map(slot => (
      slot.fieldId === fieldId && slot.slotIndex === slotIndex
        ? {
          ...slot,
          girlId: seedData.girlId,
          state: 'growing',
          plantedDay: currentDay,
        }
        : slot
    )));
    setPlantingSeedId(null);
    setDialogMessage(`${seedData.seedName}を${getFarmFieldLabel(fieldId)} ${slotIndex}に植えました。`);
  };
  useEffect(() => {
    if (bootMode !== 'playing') return;
    if (currentRepaymentCycleIndex <= interestRateCycleIndex) return;
    setCurrentWeeklyInterestRate(createWeeklyInterestRate(difficulty, farmCredit, missedRepaymentCount));
    setInterestRateCycleIndex(currentRepaymentCycleIndex);
  }, [bootMode, currentRepaymentCycleIndex, difficulty, farmCredit, interestRateCycleIndex, missedRepaymentCount]);
  const advanceToNextDay = () => {
    const nextDay = currentDay + 1;
    if (
      hasBeastPremonition &&
      scheduledBeastAttackDay !== null &&
      nextDay >= scheduledBeastAttackDay
    ) {
      setHasBeastPremonition(false);
      setBeastAttackPending(true);
      setDialogMessage('畑の方から物音がする……');
      return;
    }

    proceedToNextDay();

    if (
      timeOfDay === 'night' &&
      !hasBeastPremonition &&
      scheduledBeastAttackDay === null &&
      Math.random() < BEAST_PREMONITION_RATE_BY_DIFFICULTY[difficulty]
    ) {
      setHasBeastPremonition(true);
      setPremonitionDay(currentDay);
      setScheduledBeastAttackDay(getScheduledBeastAttackDay(difficulty, currentDay));
      setDialogMessage('なんだか嫌な予感がする……');
    }
  };
  const advanceToNextTimeSlot = () => {
    if (timeOfDay === 'night') {
      setCurrentAP(0);
      setDialogMessage(EXHAUSTED_ACTION_MESSAGE);
      return;
    }
    setTurn(t => t + 1);
    setCurrentAP(maxAPPerTimeSlot);
  };
  const canStartAPAction = () => {
    if (currentAP > 0) return true;
    if (timeOfDay === 'night') {
      setDialogMessage(EXHAUSTED_ACTION_MESSAGE);
      return false;
    }
    advanceToNextTimeSlot();
    return false;
  };
  const consumeAPForAction = () => {
    if (currentAP <= 0) return canStartAPAction();
    const nextAP = currentAP - 1;
    if (nextAP > 0) {
      setCurrentAP(nextAP);
      return true;
    }
    if (timeOfDay === 'night') {
      setCurrentAP(0);
      setDialogMessage(EXHAUSTED_ACTION_MESSAGE);
      return true;
    }
    setTurn(t => t + 1);
    setCurrentAP(maxAPPerTimeSlot);
    return true;
  };
  const getDebugDialogueMessage = (debugKey: string, defaultMessage: string) => debugDialogueOverrides[debugKey] ?? defaultMessage;
  const saveDebugDialogueOverride = (debugKey: string, message: string) => {
    setDebugDialogueOverrides(prev => ({ ...prev, [debugKey]: message }));
  };
  const resetDebugDialogueOverride = (debugKey: string) => {
    setDebugDialogueOverrides(prev => {
      const next = { ...prev };
      delete next[debugKey];
      return next;
    });
  };
  const debugDialogueOptions = useMemo(() => {
    const createOptions = (groupLabel: string, steps: DebugDialogueStep[]) => steps.map((step, index) => ({
      key: step.debugKey,
      label: `${groupLabel} ${index + 1}`,
      defaultMessage: step.message,
      currentMessage: getDebugDialogueMessage(step.debugKey, step.message),
    }));
    return [
      ...createOptions('釣り説明', FISHING_TUTORIAL_STEPS),
      ...createOptions('釣り後会話', FISHING_TUTORIAL_END_STEPS),
      ...createOptions('のこぎり会話', SAW_CRAFT_TUTORIAL_STEPS),
      ...createOptions('つるはし会話', PICKAXE_CRAFT_TUTORIAL_STEPS),
      ...createOptions('小屋会話', SAW_CRAFT_SHED_TUTORIAL_STEPS),
      ...createOptions('採取共通会話', GATHERING_TUTORIAL_COMMON_STEPS),
      ...createOptions('伐採会話', GATHERING_TUTORIAL_BRANCH_STEPS.logging),
      ...createOptions('採掘会話', GATHERING_TUTORIAL_BRANCH_STEPS.mining),
    ];
  }, [debugDialogueOverrides]);
  const isKurumiShopUnlocked = kurumiIntroCompletedDay !== null && currentDay > kurumiIntroCompletedDay;
  const hasAskedAllKurumiIntroTopics = KURUMI_INTRO_TOPIC_IDS.every(id => kurumiIntroAskedTopics.includes(id));
  const shouldShowFishingTutorialKurumi = bootMode === 'playing' && currentMap === 'farm' && currentDay === 2 && !fishingTutorialCompleted;
  const currentFishingTutorialStep = FISHING_TUTORIAL_STEPS[fishingTutorialStepIndex] ?? FISHING_TUTORIAL_STEPS[0];
  const currentFishingTutorialEndingStep = FISHING_TUTORIAL_END_STEPS[fishingTutorialEndingStepIndex] ?? FISHING_TUTORIAL_END_STEPS[0];
  const currentLoggingTutorialStep = LOGGING_TUTORIAL_STEPS[loggingTutorialStepIndex] ?? LOGGING_TUTORIAL_STEPS[0];
  const currentCraftTutorialSteps = craftTutorialRecipeName === '【レシピ】つるはし'
    ? PICKAXE_CRAFT_TUTORIAL_STEPS
    : SAW_CRAFT_TUTORIAL_STEPS;
  const currentSawCraftTutorialStep = currentCraftTutorialSteps[sawCraftTutorialIntroStepIndex] ?? currentCraftTutorialSteps[0];
  const currentSawCraftShedTutorialStep = SAW_CRAFT_SHED_TUTORIAL_STEPS[sawCraftTutorialShedStepIndex] ?? SAW_CRAFT_SHED_TUTORIAL_STEPS[0];
  const currentGatheringTutorialSteps = gatheringTutorialChoice
    ? GATHERING_TUTORIAL_BRANCH_STEPS[gatheringTutorialChoice]
    : GATHERING_TUTORIAL_COMMON_STEPS;
  const currentGatheringTutorialStep = currentGatheringTutorialSteps[gatheringTutorialStepIndex] ?? currentGatheringTutorialSteps[0];
  const isGatheringTutorialChoiceStep = gatheringTutorialChoice === null && gatheringTutorialStepIndex === GATHERING_TUTORIAL_COMMON_STEPS.length - 1;
  const activeAutoEventMessages = activeAutoEventSpot
     ? (activeAutoEventSpot.texts?.length ? activeAutoEventSpot.texts : [activeAutoEventSpot.text || activeAutoEventSpot.label || 'イベントが発生しました。'])
     : [];
  const isNearFishingTutorialKurumi = (playerPos = posRef.current) => {
    const kurumiCenterX = FISHING_TUTORIAL_KURUMI_ZONE.x + FISHING_TUTORIAL_KURUMI_ZONE.w / 2;
    const kurumiCenterY = FISHING_TUTORIAL_KURUMI_ZONE.y + FISHING_TUTORIAL_KURUMI_ZONE.h / 2;
    const dx = playerPos.x - kurumiCenterX;
    const dy = playerPos.y - kurumiCenterY;
    return Math.sqrt(dx * dx + dy * dy) <= FISHING_TUTORIAL_INTERACT_DISTANCE;
  };

  const isNearSawCraftTutorialKurumi = (playerPos = posRef.current) => {
    const kurumiCenterX = CRAFT_TUTORIAL_KURUMI_ZONE.x + CRAFT_TUTORIAL_KURUMI_ZONE.w / 2;
    const kurumiCenterY = CRAFT_TUTORIAL_KURUMI_ZONE.y + CRAFT_TUTORIAL_KURUMI_ZONE.h / 2;
    const dx = playerPos.x - kurumiCenterX;
    const dy = playerPos.y - kurumiCenterY;
    return Math.sqrt(dx * dx + dy * dy) <= FISHING_TUTORIAL_INTERACT_DISTANCE;
  };

  const openFishingTutorial = () => {
    playFixSound();
    setFishingTutorialOpen(true);
    setFishingTutorialStepIndex(0);
    setSelectedFishingTutorialAction('next');
    setFishingTutorialResult(null);
    playFishingTutorialVoice(0);
    setMenuOpen(false);
    clickTargetRef.current = null;
    setClickTargetMarker(null);
  };

  const startFishingTutorialChallenge = () => {
    playFixSound();
    stopFishingTutorialVoice();
    setFishingTutorialOpen(false);
    setFishingTutorialResult(null);
    setSelectedFishingResultAction('retry');
    setIsFishingTutorialRun(true);
    const targetFish = FISH_ZUKAN_ENTRIES[0];
    const sweetRange = createFishingFanSweetRange(targetFish);
    setFishingTargetFish(targetFish);
    setFishingTargetSizeValue(null);
    setFishingTargetIsNushi(false);
    setFishingFanSweetMin(sweetRange.min);
    setFishingFanSweetMax(sweetRange.max);
    setFishingMiniGameOpen(true);
    setFishingMiniGameStage('direction');
    setFishingGauge(50);
    setFishingCastAngle(0);
    setFishingCastPower(0);
    setFishingBiteRound(1);
    setFishingBiteScore(0);
    setFishingBiteCombo(0);
    setFishingBiteCircle({ x: 50, y: 50, outerSize: FISHING_BITE_START_SIZE });
    setFishingFishHp(FISHING_FISH_MAX_HP);
    setFishingTension(0);
    setFishingHitGreenWidth(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
    setFishingKeepGreenWidth(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
    setFishingResultSizeCm('');
    setFishingResultIsNewRecord(false);
    setFishingResultImageSrc(FISHING_SCENE_RESULT_SRC);
    setFishingResultText('');
    setSelectedFishingResultAction('retry');
    setIsFishingHitSplashActive(false);
    setIsFishingHitIntroActive(false);
    setFishingHitCountdown(3);
    setFishingHitLimitSeconds(10);
    setIsFishingKeepPressed(false);
    fishingGaugeDirectionRef.current = 1;
    setDialogMessage('くるみの釣りチュートリアルを開始しました。');
  };

  const advanceFishingTutorial = () => {
    playFixSound();
    if (fishingTutorialStepIndex >= FISHING_TUTORIAL_STEPS.length - 1) {
      startFishingTutorialChallenge();
      return;
    }
    const nextStepIndex = fishingTutorialStepIndex + 1;
    setFishingTutorialStepIndex(nextStepIndex);
    playFishingTutorialVoice(nextStepIndex);
  };

  const openFishingTutorialEnding = () => {
    stopFishingTutorialVoice();
    setFishingTutorialEndingOpen(true);
    setFishingTutorialEndingStepIndex(0);
    setSelectedFishingTutorialAction('next');
    fishingTutorialVoiceRef.current = playVoiceSound(FISHING_TUTORIAL_END_STEPS[0].voiceSrc);
  };

  const closeFishingTutorialEnding = (withSound = true) => {
    if (withSound) playFixSound();
    stopFishingTutorialVoice();
    setFishingTutorialEndingOpen(false);
    setFishingTutorialEndingStepIndex(0);
    setDialogMessage('くるみ「じゃっ、まったねー！」');
  };

  const advanceFishingTutorialEnding = () => {
    playFixSound();
    const nextStepIndex = fishingTutorialEndingStepIndex + 1;
    if (nextStepIndex >= FISHING_TUTORIAL_END_STEPS.length) {
      closeFishingTutorialEnding(false);
      return;
    }
    stopFishingTutorialVoice();
    setFishingTutorialEndingStepIndex(nextStepIndex);
    fishingTutorialVoiceRef.current = playVoiceSound(FISHING_TUTORIAL_END_STEPS[nextStepIndex].voiceSrc);
  };

  const stopSawCraftTutorialVoice = () => {
    if (!sawCraftTutorialVoiceRef.current) return;
    sawCraftTutorialVoiceRef.current.pause();
    sawCraftTutorialVoiceRef.current.currentTime = 0;
    sawCraftTutorialVoiceRef.current = null;
  };

  const playSawCraftTutorialIntroVoice = (stepIndex: number, steps = currentCraftTutorialSteps) => {
    const step = steps[stepIndex];
    if (!step) return;
    const voiceKey = `${craftTutorialRecipeName}:${stepIndex}:${step.voiceSrc}`;
    if (sawCraftTutorialIntroVoiceKeyRef.current === voiceKey) return;
    stopSawCraftTutorialVoice();
    sawCraftTutorialIntroVoiceKeyRef.current = voiceKey;
    sawCraftTutorialVoiceRef.current = playVoiceSound(step.voiceSrc);
  };

  const startGatheringTutorial = () => {
    stopSawCraftTutorialVoice();
    sawCraftTutorialIntroVoiceKeyRef.current = null;
    setGatheringTutorialChoice(null);
    setSelectedGatheringTutorialChoice('logging');
    setGatheringTutorialStepIndex(0);
    setGatheringTutorialOpen(true);
    sawCraftTutorialVoiceRef.current = playVoiceSound(GATHERING_TUTORIAL_COMMON_STEPS[0].voiceSrc);
  };

  const advanceGatheringTutorial = () => {
    if (isGatheringTutorialChoiceStep) return;
    playFixSound();
    const nextStepIndex = gatheringTutorialStepIndex + 1;
    if (nextStepIndex >= currentGatheringTutorialSteps.length) {
      stopSawCraftTutorialVoice();
      setGatheringTutorialOpen(false);
      setGatheringTutorialCompleted(true);
      setDialogMessage(gatheringTutorialChoice === 'mining'
        ? 'ポストの下にある岩を調べてみよう。'
        : 'このマップにある伐採できる木を探してみよう。');
      return;
    }
    stopSawCraftTutorialVoice();
    setGatheringTutorialStepIndex(nextStepIndex);
    sawCraftTutorialVoiceRef.current = playVoiceSound(currentGatheringTutorialSteps[nextStepIndex].voiceSrc);
  };

  const chooseGatheringTutorial = (choice: GatheringTutorialChoice) => {
    playFixSound();
    stopSawCraftTutorialVoice();
    setGatheringTutorialChoice(choice);
    setGatheringTutorialStepIndex(0);
    sawCraftTutorialVoiceRef.current = playVoiceSound(GATHERING_TUTORIAL_BRANCH_STEPS[choice][0].voiceSrc);
  };

  const moveToSawCraftTutorialShed = () => {
    const shedEntrance = doorsRef.current.find(door => door.map === 'farm' && door.targetMap === 'shed');
    const shedStartPos = shedEntrance
      ? { x: shedEntrance.spawnX, y: shedEntrance.spawnY }
      : { x: 960, y: 650 };
    stopSawCraftTutorialVoice();
    setSawCraftTutorialIntroOpen(false);
    setSawCraftTutorialIntroStepIndex(0);
    setSawCraftTutorialReady(true);
    setSawCraftTutorialShedDialogueOpen(false);
    setSawCraftTutorialWorkbenchReady(false);
    setKurumiShopOpen(false);
    setCurrentMap('shed');
    currentMapRef.current = 'shed';
    setPos(shedStartPos);
    posRef.current = shedStartPos;
    setDir('right');
    sawCraftTutorialIntroVoiceKeyRef.current = null;
    setDialogMessage('クラフト小屋でくるみが待っています。');
    setShowDialog(true);
    clickTargetRef.current = null;
    setClickTargetMarker(null);
  };

  const openSawCraftTutorialIntro = (recipeName: CraftRecipeId = '【レシピ】のこぎり') => {
    stopSawCraftTutorialVoice();
    setCraftTutorialRecipeName(recipeName);
    setSawCraftTutorialIntroOpen(true);
    setSawCraftTutorialIntroStepIndex(0);
    const tutorialSteps = recipeName === '【レシピ】つるはし'
      ? PICKAXE_CRAFT_TUTORIAL_STEPS
      : SAW_CRAFT_TUTORIAL_STEPS;
    sawCraftTutorialIntroVoiceKeyRef.current = null;
    playSawCraftTutorialIntroVoice(0, tutorialSteps);
  };

  const advanceSawCraftTutorialIntro = () => {
    playFixSound();
    const nextStepIndex = sawCraftTutorialIntroStepIndex + 1;
    if (nextStepIndex >= currentCraftTutorialSteps.length) {
      moveToSawCraftTutorialShed();
      return;
    }
    setSawCraftTutorialIntroStepIndex(nextStepIndex);
    playSawCraftTutorialIntroVoice(nextStepIndex);
  };

  useEffect(() => {
    if (!sawCraftTutorialIntroOpen) return;
    playSawCraftTutorialIntroVoice(sawCraftTutorialIntroStepIndex);
  }, [sawCraftTutorialIntroOpen, sawCraftTutorialIntroStepIndex, craftTutorialRecipeName, currentSawCraftTutorialStep.voiceSrc]);

  const openSawCraftTutorialShedDialogue = () => {
    stopSawCraftTutorialVoice();
    sawCraftTutorialIntroVoiceKeyRef.current = null;
    setSawCraftTutorialShedStepIndex(0);
    setSawCraftTutorialShedDialogueOpen(true);
    sawCraftTutorialVoiceRef.current = playVoiceSound(SAW_CRAFT_SHED_TUTORIAL_STEPS[0].voiceSrc);
  };

  const finishSawCraftTutorialShedDialogue = () => {
    playFixSound();
    stopSawCraftTutorialVoice();
    setSawCraftTutorialShedDialogueOpen(false);
    setSawCraftTutorialShedStepIndex(0);
    setSawCraftTutorialReady(false);
    setSawCraftTutorialWorkbenchReady(true);
    craftPromptBlockedRef.current = false;
    const toolName = craftTutorialRecipeName === '【レシピ】つるはし' ? 'つるはし' : 'のこぎり';
    setDialogMessage(`クラフト台を調べて、${toolName}を作ってみよう。`);
  };

  const advanceSawCraftTutorialShedDialogue = () => {
    const nextStepIndex = sawCraftTutorialShedStepIndex + 1;
    if (nextStepIndex >= SAW_CRAFT_SHED_TUTORIAL_STEPS.length) {
      finishSawCraftTutorialShedDialogue();
      return;
    }
    playFixSound();
    stopSawCraftTutorialVoice();
    setSawCraftTutorialShedStepIndex(nextStepIndex);
    sawCraftTutorialVoiceRef.current = playVoiceSound(SAW_CRAFT_SHED_TUTORIAL_STEPS[nextStepIndex].voiceSrc);
  };

  const renderFishingTutorialVisual = () => {
    if (currentFishingTutorialStep.imageSrc) {
      return (
        <img
          src={currentFishingTutorialStep.imageSrc}
          alt="竹の釣り竿"
          className="absolute inset-x-8 bottom-12 mx-auto h-[430px] w-[320px] rounded-xl border-2 border-[#ffd166]/70 bg-black/55 object-contain object-center p-4 drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
        />
      );
    }

    if (currentFishingTutorialStep.id === 'direction') {
      return (
        <div className="absolute inset-x-8 bottom-12 h-[430px] rounded-xl border-2 border-[#67e8f9]/60 bg-[radial-gradient(circle_at_50%_75%,rgba(20,83,45,0.95),rgba(12,28,37,0.95))] p-5 shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
          <div className="absolute inset-x-0 top-5 text-center text-sm font-black tracking-[0.18em] text-[#67e8f9]">CAST POINT</div>
          <div className="absolute inset-x-0 bottom-7 mx-auto h-[250px] w-[260px]">
            <div className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#ffd166] shadow-[0_0_16px_rgba(255,209,102,0.9)]" />
            <svg viewBox="0 0 260 250" className="absolute inset-0 overflow-visible">
              <path d="M130 230 L38 48 A120 120 0 0 1 222 48 Z" fill="rgba(253,246,227,0.22)" stroke="rgba(253,246,227,0.75)" strokeWidth="3" />
              <path d="M130 230 L96 55 A120 120 0 0 1 180 60 Z" fill="rgba(255,209,102,0.72)" />
              <line x1="130" y1="230" x2="130" y2="38" stroke="#67e8f9" strokeWidth="5" strokeLinecap="round" className="farm-tutorial-fan-needle" />
            </svg>
          </div>
        </div>
      );
    }

    if (currentFishingTutorialStep.id === 'power') {
      return (
        <div className="absolute inset-x-8 bottom-12 flex h-[430px] flex-col justify-end rounded-xl border-2 border-[#ffd166]/60 bg-[linear-gradient(180deg,rgba(18,28,39,0.96),rgba(45,27,21,0.96))] p-6 shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
          <div className="absolute inset-x-0 top-8 text-center text-sm font-black tracking-[0.18em] text-[#ffd166]">POWER</div>
          <div className="mb-24 text-center text-5xl font-black text-[#fdf6e3] drop-shadow-[0_0_18px_rgba(255,209,102,0.35)]">投げる強さ</div>
          <div className="relative h-12 overflow-hidden rounded-full border-2 border-[#fdf6e3]/85 bg-black/70 shadow-[inset_0_4px_10px_rgba(0,0,0,0.75)]">
            <div className="absolute left-[66%] top-0 h-full w-[19%] bg-[#eab308]/85" />
            <div className="absolute left-[85%] top-0 h-full w-[10%] bg-[#22c55e]/90" />
            <div className="absolute left-[95%] top-0 h-full w-[5%] bg-[#ef4444]/90" />
            <div className="farm-tutorial-power-marker absolute top-1/2 h-[150%] w-4 -translate-y-1/2 rounded-full bg-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.95),0_0_0_2px_rgba(255,255,255,0.5)]" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-black">
            <div className="rounded bg-[#eab308]/25 py-1 text-[#fde68a]">GOOD</div>
            <div className="rounded bg-[#22c55e]/25 py-1 text-[#bbf7d0]">BEST</div>
            <div className="rounded bg-[#ef4444]/25 py-1 text-[#fecaca]">MAX</div>
          </div>
        </div>
      );
    }

    if (currentFishingTutorialStep.id === 'bite') {
      return (
        <div className="absolute inset-x-8 bottom-12 h-[430px] rounded-xl border-2 border-[#67e8f9]/60 bg-[radial-gradient(circle_at_50%_45%,rgba(14,116,144,0.75),rgba(8,13,23,0.96))] p-6 shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
          <div className="absolute inset-x-0 top-8 text-center text-sm font-black tracking-[0.18em] text-[#67e8f9]">TIMING</div>
          <div className="absolute left-1/2 top-[53%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-[#fdf6e3] bg-[#22c55e]/24 shadow-[0_0_22px_rgba(34,197,94,0.9),inset_0_0_16px_rgba(255,255,255,0.35)]" />
          <div className="farm-tutorial-bite-ring absolute left-1/2 top-[53%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[7px] border-[#ffd166] bg-[#ffd166]/10 shadow-[0_0_28px_rgba(255,209,102,0.9)]" />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-[#ffd166]/70 bg-black/55 px-5 py-2 text-sm font-black text-[#ffd166]">重なった瞬間に決定！</div>
        </div>
      );
    }

    if (currentFishingTutorialStep.id === 'hit') {
      return (
        <div className="absolute inset-x-8 bottom-12 h-[430px] rounded-xl border-2 border-[#ffd166]/60 bg-[linear-gradient(180deg,rgba(58,21,21,0.96),rgba(15,23,42,0.96))] p-6 shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
          <div className="farm-tutorial-hit-count absolute inset-x-0 top-10 text-center text-7xl font-black text-[#ffd166] drop-shadow-[0_0_20px_rgba(255,209,102,0.85)]" />
          <div className="absolute inset-x-8 top-36 rounded-2xl border-2 border-[#fdf6e3]/65 bg-black/50 p-5">
            <div className="mb-4 text-center text-xl font-black text-[#fdf6e3]">グリーンをキープ！</div>
            <div className="relative h-12 overflow-hidden rounded-full border-2 border-[#fdf6e3]/85 bg-black/75 shadow-[inset_0_4px_10px_rgba(0,0,0,0.75)]">
              <div className="absolute left-[38%] top-0 h-full w-[24%] bg-[linear-gradient(180deg,rgba(134,239,172,0.95),rgba(34,197,94,0.78))] shadow-[0_0_18px_rgba(34,197,94,0.65)]" />
              <div className="farm-tutorial-keep-marker absolute top-1/2 h-[150%] w-4 -translate-y-1/2 rounded-full bg-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.95),0_0_0_2px_rgba(255,255,255,0.5)]" />
            </div>
            <div className="mt-5 rounded-xl border border-[#ffd166]/55 bg-[#2d1414]/88 px-4 py-3 text-center text-[15px] font-black leading-snug text-[#ffe4a3] shadow-[0_0_16px_rgba(239,68,68,0.18)]">
              グリーンから外れると魚が逃げやすくなるぞ！
            </div>
          </div>
        </div>
      );
    }

    return (
      <img
        src="/img/kurumi.png"
        alt="くるみ"
        className="absolute inset-x-0 bottom-0 mx-auto h-[560px] w-[430px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
      />
    );
  };

  const renderLoggingTutorialVisual = () => {
    if (currentLoggingTutorialStep.id === 'direction') {
      return (
        <div className="absolute inset-x-7 bottom-10 h-[440px] overflow-hidden rounded-xl border-2 border-[#86efac]/60 bg-black shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
          <img src="/img/tree.jpg" alt="伐採する木" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute left-[43%] top-[38%] h-[210px] w-[300px] -translate-y-1/2 rotate-90">
            <svg viewBox="0 0 300 210" className="h-full w-full overflow-visible drop-shadow-[0_8px_14px_rgba(0,0,0,0.7)]">
              <path d="M150 198 L38 42 A140 140 0 0 1 262 42 Z" fill="rgba(253,246,227,0.28)" stroke="rgba(253,246,227,0.82)" strokeWidth="3" />
              <path d="M150 198 L116 35 A140 140 0 0 1 184 35 Z" fill="rgba(255,209,102,0.78)" />
              <line x1="150" y1="198" x2="150" y2="25" stroke="#ffd166" strokeWidth="6" strokeLinecap="round" className="farm-logging-tutorial-fan-needle" />
              <circle cx="150" cy="198" r="8" fill="#fdf6e3" stroke="#ffd166" strokeWidth="3" />
            </svg>
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#ffd166]/75 bg-black/65 px-5 py-2 text-sm font-black text-[#ffd166]">
            黄色い範囲で角度を決定！
          </div>
        </div>
      );
    }

    if (currentLoggingTutorialStep.id === 'action' || currentLoggingTutorialStep.id === 'fail_explain') {
      const isFailDemo = currentLoggingTutorialStep.id === 'fail_explain';
      return (
        <div className="absolute inset-x-7 bottom-10 h-[440px] overflow-hidden rounded-xl border-2 border-[#86efac]/60 bg-black shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
          <img src="/img/noko1.jpg" alt="" className="farm-logging-dissolve-a absolute inset-0 h-full w-full object-cover" />
          <img src="/img/noko2.jpg" alt="" className="farm-logging-dissolve-b absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/10" />
          <div className="absolute inset-x-5 bottom-5 rounded-xl border border-[#86efac]/45 bg-[#102116]/92 p-4">
            <div className="mb-2 flex items-center justify-between text-sm font-black">
              <span className="text-[#bbf7d0]">伐採進行率</span>
              <span className={isFailDemo ? 'text-[#fecaca]' : 'text-[#fdf6e3]'}>
                {isFailDemo ? '0%' : '100%'}
              </span>
            </div>
            <div className="mb-4 h-5 overflow-hidden rounded-full border border-white/70 bg-black/70">
              <div className={`h-full ${isFailDemo ? 'farm-logging-tutorial-fail-progress bg-[#ef4444]' : 'farm-logging-tutorial-success-progress bg-[#4ade80]'}`} />
            </div>
            <div className="relative h-10 overflow-hidden rounded-full border-2 border-[#fdf6e3]/85 bg-black/75">
              <div className="absolute left-[42%] top-0 h-full w-[22%] bg-[#eab308]/85 shadow-[0_0_16px_rgba(234,179,8,0.6)]" />
              <div className={`absolute top-1/2 h-[135%] w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.95)] ${isFailDemo ? 'farm-logging-tutorial-fail-marker' : 'farm-logging-tutorial-action-marker'}`} />
            </div>
            <div className={`mt-3 text-center text-xl font-black ${isFailDemo ? 'farm-logging-tutorial-fail-text text-[#fca5a5]' : 'farm-logging-tutorial-success-text text-[#ffd166]'}`}>
              {isFailDemo ? '伐採失敗！' : 'COMBO！ 伐採成功！'}
            </div>
          </div>
        </div>
      );
    }

    return (
      <img
        src="/img/kurumi.png"
        alt="くるみ"
        className="absolute inset-x-0 bottom-0 mx-auto h-[560px] w-[430px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
      />
    );
  };

  const retryFishingTutorial = () => {
    finishFishingMiniGame();
    window.setTimeout(() => {
      setIsFishingTutorialRun(true);
      startFishingTutorialChallenge();
    }, 0);
  };

  const completeFishingTutorial = () => {
    playFixSound();
    stopFishingTutorialVoice();
    setInventoryCounts(prev => ({ ...prev, '竹の釣竿': Math.max(1, prev['竹の釣竿'] ?? 0) }));
    setEquippedItems(prev => ({ ...prev, '主人公-slot1': '竹の釣竿' }));
    setFishingTutorialCompleted(true);
    setFishingTutorialOpen(false);
    setFishingTutorialResult(null);
    setIsFishingTutorialRun(false);
    finishFishingMiniGame();
    openFishingTutorialEnding();
  };

  useEffect(() => {
     if (autoEventTypeTimerRef.current !== null) {
        window.clearInterval(autoEventTypeTimerRef.current);
        autoEventTypeTimerRef.current = null;
     }
     if (typeSoundRef.current) {
        typeSoundRef.current.pause();
        typeSoundRef.current.currentTime = 0;
        typeSoundRef.current = null;
     }

     if (!activeAutoEventSpot || !activeAutoEventMessage) {
        setDisplayedAutoEventMessage('');
        return;
     }

     const typeIntervals = [90, 65, 45, 25, 0];
     const typeIntervalMs = typeIntervals[Math.min(4, Math.max(0, textDisplaySpeedLevel - 1))];
     if (typeIntervalMs === 0) {
        setDisplayedAutoEventMessage(activeAutoEventMessage);
        return;
     }

     let nextIndex = 0;
     setDisplayedAutoEventMessage('');
     const typeAudio = new Audio('/se/type.mp3');
     typeAudio.loop = true;
     typeAudio.playbackRate = 1;
     typeAudio.volume = getEffectiveVolume('/se/type.mp3', seVolumeRef.current, audioGainsRef.current);
     typeSoundRef.current = typeAudio;
     void typeAudio.play().catch((error) => {
        console.error('タイプ音の再生に失敗しました:', error);
     });
     autoEventTypeTimerRef.current = window.setInterval(() => {
        nextIndex += 1;
        setDisplayedAutoEventMessage(activeAutoEventMessage.slice(0, nextIndex));
        if (nextIndex >= activeAutoEventMessage.length && autoEventTypeTimerRef.current !== null) {
           window.clearInterval(autoEventTypeTimerRef.current);
           autoEventTypeTimerRef.current = null;
           if (typeSoundRef.current) {
              typeSoundRef.current.pause();
              typeSoundRef.current.currentTime = 0;
              typeSoundRef.current = null;
           }
        }
     }, typeIntervalMs);

     return () => {
        if (autoEventTypeTimerRef.current !== null) {
           window.clearInterval(autoEventTypeTimerRef.current);
           autoEventTypeTimerRef.current = null;
        }
        if (typeSoundRef.current) {
           typeSoundRef.current.pause();
           typeSoundRef.current.currentTime = 0;
           typeSoundRef.current = null;
        }
     };
  }, [activeAutoEventSpot, activeAutoEventMessage, textDisplaySpeedLevel]);

  const advanceAutoEventOverlay = () => {
    if (!activeAutoEventSpot) return;

    if (displayedAutoEventMessage.length < activeAutoEventMessage.length) {
      if (autoEventTypeTimerRef.current !== null) {
        window.clearInterval(autoEventTypeTimerRef.current);
        autoEventTypeTimerRef.current = null;
      }
      if (typeSoundRef.current) {
        typeSoundRef.current.pause();
        typeSoundRef.current.currentTime = 0;
        typeSoundRef.current = null;
      }
      setDisplayedAutoEventMessage(activeAutoEventMessage);
      return;
    }

    const nextIndex = activeAutoEventMessageIndex + 1;
    if (nextIndex < activeAutoEventMessages.length) {
      playFixSound();
      setActiveAutoEventMessageIndex(nextIndex);
      setActiveAutoEventMessage(activeAutoEventMessages[nextIndex]);
      return;
    }

    closeAutoEventOverlay();
  };

  useEffect(() => {
     return () => {
        if (shopTradePoseTimerRef.current !== null) {
           window.clearTimeout(shopTradePoseTimerRef.current);
        }
        if (kurumiTradeRewardTimerRef.current !== null) {
           window.clearTimeout(kurumiTradeRewardTimerRef.current);
        }
        if (kurumiIntroCloseTimerRef.current !== null) {
           window.clearTimeout(kurumiIntroCloseTimerRef.current);
        }
        if (kurumiIntroVoiceRef.current) {
           kurumiIntroVoiceRef.current.pause();
           kurumiIntroVoiceRef.current = null;
        }
        if (fishingTutorialVoiceRef.current) {
           fishingTutorialVoiceRef.current.pause();
           fishingTutorialVoiceRef.current = null;
        }
        if (fishingNushiVoiceRef.current) {
           fishingNushiVoiceRef.current.pause();
           fishingNushiVoiceRef.current = null;
        }
        if (fishingBiteTimerRef.current !== null) {
           window.clearInterval(fishingBiteTimerRef.current);
        }
        if (fishingHitSplashTimerRef.current !== null) {
           window.clearTimeout(fishingHitSplashTimerRef.current);
        }
        if (fishingHitCountdownTimerRef.current !== null) {
           window.clearInterval(fishingHitCountdownTimerRef.current);
        }
        if (fishingBiteSparkleTimerRef.current !== null) {
           window.clearTimeout(fishingBiteSparkleTimerRef.current);
        }
        if (fishingResultLockTimerRef.current !== null) {
           window.clearTimeout(fishingResultLockTimerRef.current);
        }
        if (fishingRiverAudioRef.current) {
           fishingRiverAudioRef.current.pause();
           fishingRiverAudioRef.current = null;
        }
        if (fishingReelAudioRef.current) {
           fishingReelAudioRef.current.pause();
           fishingReelAudioRef.current = null;
        }
     };
  }, []);

  const handleShopBackdropPointerDown = () => {
     playFixSound();
     setKurumiShopOpen(false);
  };

  const openKurumiShop = () => {
     playVoiceSound(KURUMI_SHOP_SOUND_SRC);
     setSelectedShopItemIndex(0);
     setSelectedShopControl('items');
     setKurumiShopOpen(true);
  };

  const startKurumiIntro = () => {
     if (kurumiIntroCloseTimerRef.current !== null) {
        window.clearTimeout(kurumiIntroCloseTimerRef.current);
        kurumiIntroCloseTimerRef.current = null;
     }
     playKurumiIntroVoice(KURUMI_START_SOUND_SRC);
     setKurumiIntroMessage(KURUMI_INTRO_FIRST_MESSAGE);
     setKurumiIntroSelectedIndex(0);
     setKurumiIntroClosing(false);
     setKurumiIntroOpen(true);
  };

  const startKurumiInteraction = () => {
     clickTargetRef.current = null;
     setClickTargetMarker(null);
     const hasSawRecipe = (inventoryCounts['【レシピ】のこぎり'] ?? 0) > 0;
     const hasPickaxeRecipe = (inventoryCounts['【レシピ】つるはし'] ?? 0) > 0;
     const hasSawTool = (inventoryCounts['のこぎり'] ?? 0) > 0;
     const hasPickaxeTool = (inventoryCounts['つるはし'] ?? 0) > 0;
     const isGatheringTutorialReady = hasSawRecipe && hasPickaxeRecipe && hasSawTool && hasPickaxeTool;
     if (isGatheringTutorialReady && !gatheringTutorialCompleted) {
        startGatheringTutorial();
        return;
     }
     if (isKurumiShopUnlocked) {
        openKurumiShop();
     } else {
        startKurumiIntro();
     }
  };

  const closeKurumiIntro = (shouldPlaySound = true) => {
     if (kurumiIntroClosing) return;
     if (shouldPlaySound) playFixSound();
     if (!hasAskedAllKurumiIntroTopics) {
        setKurumiIntroMessage('えへへ、まだ聞けることがあるよっ！気になることを一通り聞いてみてね。');
        return;
     }
     if (hasAskedAllKurumiIntroTopics && kurumiIntroCompletedDay === null) {
        setKurumiIntroCompletedDay(currentDay);
     }
     setKurumiIntroClosing(true);
     fadeOutAudio(kurumiIntroVoiceRef.current, KURUMI_INTRO_CLOSE_FADE_MS);
     kurumiIntroCloseTimerRef.current = window.setTimeout(() => {
        setKurumiIntroOpen(false);
        setKurumiIntroClosing(false);
        kurumiIntroVoiceRef.current = null;
        kurumiIntroCloseTimerRef.current = null;
     }, KURUMI_INTRO_CLOSE_FADE_MS);
  };

  const handleKurumiIntroChoice = (index = kurumiIntroSelectedIndex) => {
     if (kurumiIntroClosing) return;
     const topic = KURUMI_INTRO_TOPICS[index];
     playFixSound();
     if (!topic) {
        closeKurumiIntro(false);
        return;
     }
     setKurumiIntroMessage(topic.answer);
     if (topic.voiceSrc) {
        playKurumiIntroVoice(topic.voiceSrc);
     }
     setKurumiIntroAskedTopics(prev => {
        const next = prev.includes(topic.id) ? prev : [...prev, topic.id];
        if (
           kurumiIntroCompletedDay === null &&
           KURUMI_INTRO_TOPIC_IDS.every(id => next.includes(id))
        ) {
           setKurumiIntroCompletedDay(currentDay);
        }
        return next;
     });
  };
  const openRecipeDetail = (recipeName: string) => {
     if (!RECIPE_DETAILS[recipeName]) return false;
     setSelectedRecipeName(recipeName);
     setRecipeDetailOpen(true);
     return true;
  };

  const isCraftRecipeId = (name: string): name is CraftRecipeId => name in CRAFT_RECIPE_CONFIGS;

  const getMissingCraftMaterials = (recipeName: CraftRecipeId) => {
     const config = CRAFT_RECIPE_CONFIGS[recipeName];
     return Object.entries(config.materials).filter(([materialName, requiredCount]) => (
        (inventoryCounts[materialName] ?? 0) < requiredCount
     ));
  };

  const openCraftRecipeMenu = () => {
     setCraftRecipeSelectMode(true);
     setMenuOpen(true);
     menuOpenRef.current = true;
     setMenuSelectedIndex(0);
     menuSelectedIndexRef.current = 0;
     setMenuFocusArea('content');
     setMenuContentFocus('secondary');
     setItemMenuTab('だいじなもの');
     itemMenuTabRef.current = 'だいじなもの';
     const firstOwnedRecipe = CRAFT_RECIPE_IDS.find(name => (inventoryCounts[name] ?? 0) > 0);
     const selectedRecipe = firstOwnedRecipe ?? '';
     setSelectedItemName(selectedRecipe);
     selectedItemNameRef.current = selectedRecipe;
     setDialogMessage('作りたいレシピを選んでください。');
   };

  const handleCraftRecipeSelected = (recipeName: string) => {
     if (!isCraftRecipeId(recipeName)) {
        playFixSound();
        setDialogMessage('クラフトできるレシピを選んでください。');
        return;
     }
     playFixSound();
     setSelectedItemName(recipeName);
     setSelectedRecipeName(recipeName);
     if (getMissingCraftMaterials(recipeName).length > 0) {
        setCraftInsufficientRecipeName(recipeName);
        setCraftConfirmRecipeName(null);
        return;
     }
     setCraftConfirmRecipeName(recipeName);
     setCraftInsufficientRecipeName(null);
     setConfirmPromptChoice('yes');
  };

  const randomInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

  const createCraftCircle = (durationMs: number): CraftCircle => {
     const size = randomInt(58, 86);
     return {
        id: Date.now() + Math.random(),
        x: randomInt(16, 100 - 16),
        y: randomInt(18, 82),
        size,
        expiresAt: Date.now() + durationMs,
        durationMs,
     };
  };

  const spawnNextCraftCircle = (recipeName: CraftRecipeId | null, spawnedCount: number, targetCount: number) => {
     if (spawnedCount >= targetCount) return;
     const durationRange = recipeName
        ? CRAFT_RECIPE_CONFIGS[recipeName].circleDurationRangeMs
        : [760, 1180] as const;
     const durationMs = randomInt(durationRange[0], durationRange[1]);
     setCraftMiniGameCircles([createCraftCircle(durationMs)]);
     setCraftMiniGameSpawnedCount(spawnedCount + 1);
  };

  const startCraftMiniGame = (recipeName: CraftRecipeId) => {
     if (getMissingCraftMaterials(recipeName).length > 0) {
        setCraftConfirmRecipeName(null);
        setCraftInsufficientRecipeName(recipeName);
        return;
     }
     const config = CRAFT_RECIPE_CONFIGS[recipeName];
     const targetCount = randomInt(config.circleCountRange[0], config.circleCountRange[1]);
     setCraftConfirmRecipeName(null);
     setRecipeDetailOpen(false);
     setMenuOpen(false);
     menuOpenRef.current = false;
     setCraftRecipeSelectMode(false);
     setCraftMiniGameOpen(true);
     setCraftMiniGameRecipeName(recipeName);
     setCraftMiniGameScore(0);
     setCraftMiniGameTargetCount(targetCount);
     setCraftMiniGameSpawnedCount(0);
     setCraftMiniGameResult(null);
     spawnNextCraftCircle(recipeName, 0, targetCount);
  };

  const openLoggingTutorial = () => {
    playFixSound();
    setLoggingTutorialOpen(true);
    setLoggingTutorialStepIndex(0);
    setSelectedLoggingTutorialAction('next');
    setLoggingTutorialResult(null);
    playLoggingTutorialVoice(0);
    setMenuOpen(false);
    clickTargetRef.current = null;
    setClickTargetMarker(null);
  };

  const startLoggingTutorialChallenge = () => {
    playFixSound();
    stopLoggingTutorialVoice();
    setLoggingTutorialOpen(false);
    setLoggingTutorialResult(null);
    setIsLoggingTutorialRun(true);
    
    setLoggingMiniGameOpen(true);
    setLoggingMiniGameStage('direction');
    setLoggingGauge(50);
    setLoggingProgress(0);
    setLoggingCombo(0);
    loggingGaugeDirectionRef.current = 1;
    setDialogMessage('伐採チュートリアル：のこぎりを引く角度を決めましょう。');
  };

  const advanceLoggingTutorial = () => {
    playFixSound();
    if (loggingTutorialStepIndex >= LOGGING_TUTORIAL_STEPS.length - 1) {
      startLoggingTutorialChallenge();
      return;
    }
    const nextStepIndex = loggingTutorialStepIndex + 1;
    setLoggingTutorialStepIndex(nextStepIndex);
    playLoggingTutorialVoice(nextStepIndex);
  };

  const retryLoggingTutorial = () => {
    finishLoggingMiniGame();
    window.setTimeout(() => {
      setIsLoggingTutorialRun(true);
      startLoggingTutorialChallenge();
    }, 0);
  };

  const completeLoggingTutorial = () => {
    playFixSound();
    stopLoggingTutorialVoice();
    setLoggingTutorialCompleted(true);
    setLoggingTutorialOpen(false);
    setLoggingTutorialResult(null);
    setIsLoggingTutorialRun(false);
    finishLoggingMiniGame();
    setDialogMessage('くるみ「これで完璧だねっ♪ どんどん木を切ってね！」');
  };

  const finishLoggingMiniGame = () => {
    if (loggingComboEffectTimerRef.current !== null) {
      window.clearTimeout(loggingComboEffectTimerRef.current);
      loggingComboEffectTimerRef.current = null;
    }
    setLoggingMiniGameOpen(false);
    setLoggingProgress(0);
    setLoggingCombo(0);
    setLoggingComboEffectKey(0);
    setIsLoggingResultInputLocked(false);
    loggingPromptBlockedRef.current = true;
  };

  const grantLoggingRewards = () => {
    const rewardSaw = getHighestOwnedSaw(equippedItemsRef.current, inventoryCounts);
    const rewards = createLumberRewards(rewardSaw, LOGGING_REWARD_WOOD);
    setInventoryCounts(prev => {
      const next = { ...prev };
      rewards.forEach(({ lumber }) => {
        next[lumber.name] = (next[lumber.name] ?? 0) + 1;
      });
      return next;
    });
    setLumberInventorySizes(prev => {
      const next = { ...prev };
      rewards.forEach(({ lumber, size }) => {
        next[lumber.name] = [...(next[lumber.name] ?? []), size];
      });
      return next;
    });
    const rewardSummary = Array.from(new Set(rewards.map(({ lumber }) => lumber.name)))
      .map(name => `${name}×${rewards.filter(({ lumber }) => lumber.name === name).length}`)
      .join('、');
    setDialogMessage(`${rewardSummary}を切り出しました！`);
    consumeAPForAction();
  };

  const grantMiningReward = (pointId: string) => {
    if (!canStartAPAction()) return;
    const pickaxe = getHighestOwnedPickaxe(equippedItemsRef.current, inventoryCounts);
    const ore = selectOreReward(pickaxe);
    const weight = createOreWeight(ore);
    setInventoryCounts(prev => ({ ...prev, [ore.name]: (prev[ore.name] ?? 0) + 1 }));
    setOreInventoryWeights(prev => ({ ...prev, [ore.name]: [...(prev[ore.name] ?? []), weight] }));
    setDepletedMiningPointIds(prev => ({ ...prev, [`${timeOfDay}_${pointId}`]: true }));
    setDialogMessage(`${ore.name} ${weight.toLocaleString()}gを採掘しました！`);
    playFixSound();
    consumeAPForAction();
  };

  const startLoggingMiniGame = () => {
     if (!activeLoggingPointId) return;
     if (!canStartAPAction()) {
        setLoggingPromptVisible(false);
        loggingPromptBlockedRef.current = true;
        return;
     }
     const hasSaw = ['主人公-slot2', '主人公-slot3'].some(slotId => (
       equippedItemsRef.current[slotId]?.includes('のこぎり')
     ));
     if (!hasSaw) {
        setLoggingPromptVisible(false);
        setActiveLoggingPointId(null);
        loggingPromptBlockedRef.current = true;
        setDialogMessage('伐採にはのこぎりを装備してください。');
        return;
     }

     if (!loggingTutorialCompleted) {
        setLoggingPromptVisible(false);
        loggingPromptBlockedRef.current = true;
        openLoggingTutorial();
        return;
     }

     setLoggingPromptVisible(false);
     loggingPromptBlockedRef.current = true;
     setMenuOpen(false);
     menuOpenRef.current = false;
     
     setLoggingMiniGameOpen(true);
     setLoggingMiniGameStage('direction');
     setLoggingGauge(50);
     setLoggingProgress(0);
     setLoggingCombo(0);
     setIsLoggingTutorialRun(false);
     setLoggingTutorialResult(null);
     loggingGaugeDirectionRef.current = 1;
     setDialogMessage('のこぎりを引く角度を決めましょう。');
  };

  const handleLoggingMiniGameAction = () => {
    if (loggingMiniGameStage === 'result') {
      if (isLoggingTutorialRun) return;
      if (isLoggingResultInputLocked) return;
      playFixSound();
      finishLoggingMiniGame();
      return;
    }
    playFixSound();

    if (loggingMiniGameStage === 'direction') {
      const sweetMin = LOGGING_MINIGAME_CONFIG.directionSweetMin;
      const sweetMax = LOGGING_MINIGAME_CONFIG.directionSweetMax;
      const fanSuccess = loggingGaugeRef.current >= sweetMin && loggingGaugeRef.current <= sweetMax;
      setLoggingAngleSuccess(fanSuccess);
      setLoggingMiniGameStage('action');
      setLoggingGauge(0);
      loggingGaugeDirectionRef.current = 1;
      setDialogMessage(fanSuccess ? '角度成功！タイミングよく切り込みを入れましょう！' : '角度失敗...タイミングよく切り込みを入れましょう！');
      return;
    }

    if (loggingMiniGameStage === 'action') {
      const targetWidth = loggingAngleSuccess
        ? LOGGING_MINIGAME_CONFIG.actionSweetWidth.goodAngle
        : LOGGING_MINIGAME_CONFIG.actionSweetWidth.badAngle;
      const minSweet = 50 - targetWidth / 2;
      const maxSweet = 50 + targetWidth / 2;
      const timingSuccess = loggingGaugeRef.current >= minSweet && loggingGaugeRef.current <= maxSweet;

      if (timingSuccess) {
        playUiSound(LOGGING_CUT_SOUND_SRC);
        const nextCombo = loggingCombo + 1;
        setLoggingCombo(nextCombo);
        if (nextCombo >= 2) {
          playUiSound(LOGGING_SUCCESS_SOUND_SRC);
          setLoggingComboEffectKey(prev => prev + 1);
          if (loggingComboEffectTimerRef.current !== null) {
            window.clearTimeout(loggingComboEffectTimerRef.current);
          }
          loggingComboEffectTimerRef.current = window.setTimeout(() => {
            setLoggingComboEffectKey(0);
            loggingComboEffectTimerRef.current = null;
          }, 850);
        }
        
        const baseIncrease = randomInt(
          LOGGING_MINIGAME_CONFIG.progressPerCut.min,
          LOGGING_MINIGAME_CONFIG.progressPerCut.max,
        );
        let sawBonus = 0;
        if (equippedSaw.includes('丈夫な')) sawBonus = 2;
        else if (equippedSaw.includes('高級')) sawBonus = 4;
        
        const multiplier = Math.pow(LOGGING_MINIGAME_CONFIG.comboProgressMultiplier, nextCombo);
        const increase = Math.round((baseIncrease + sawBonus) * multiplier);
        
        setLoggingProgress(prev => {
          const next = Math.min(100, prev + increase);
          if (next >= 100) {
            setLoggingMiniGameStage('result');
            fadeBgmTo(0, 700, () => {
              playUiSound(LOGGING_RESULT_SOUND_SRC);
            });
            if (nextCombo < 2) {
              playUiSound(LOGGING_SUCCESS_SOUND_SRC);
            }
            if (isLoggingTutorialRun) {
              setLoggingTutorialResult('success');
              setDialogMessage('木の伐採に成功しました！お見事！');
            } else {
              grantLoggingRewards();
              if (activeLoggingPointId) {
                setDepletedLoggingPointIds(prevDepleted => ({ ...prevDepleted, [`${timeOfDay}_${activeLoggingPointId}`]: true }));
              }
            }
          }
          return next;
        });
      } else {
        setLoggingCombo(0);
        setLoggingComboEffectKey(0);
        if (loggingComboEffectTimerRef.current !== null) {
          window.clearTimeout(loggingComboEffectTimerRef.current);
          loggingComboEffectTimerRef.current = null;
        }
        const decrease = isLoggingTutorialRun
          ? LOGGING_MINIGAME_CONFIG.missPenalty.tutorial
          : LOGGING_MINIGAME_CONFIG.missPenalty.normal;
        setLoggingProgress(prev => {
          const next = prev - decrease;
          if (next <= 0) {
            setLoggingMiniGameStage('result');
            if (isLoggingTutorialRun) {
              setLoggingTutorialResult('fail');
              setDialogMessage('のこぎりの刃が挟まり、失敗しました。');
            } else {
              setDialogMessage('伐採に失敗しました。');
            }
            return 0;
          }
          return next;
        });
      }
    }
  };

  const finishCraftMiniGame = (result: 'success' | 'fail') => {
     setCraftMiniGameCircles([]);
     setCraftMiniGameResult(result);
     if (!craftMiniGameRecipeName) {
        if (result === 'success' && activeLoggingPointId) {
           grantLoggingRewards();
           setDepletedLoggingPointIds(prev => ({ ...prev, [`${timeOfDay}_${activeLoggingPointId}`]: true }));
        } else {
           setDialogMessage('伐採に失敗しました。');
        }
        return;
     }
     const config = CRAFT_RECIPE_CONFIGS[craftMiniGameRecipeName];
     if (result === 'success') {
        playUiSound(CRAFT_SUCCESS_SOUND_SRC);
        setInventoryCounts(prev => {
           const next = { ...prev };
           Object.entries(config.materials).forEach(([materialName, requiredCount]) => {
              next[materialName] = Math.max(0, (next[materialName] ?? 0) - Number(requiredCount));
           });
           next[config.output] = (next[config.output] ?? 0) + 1;
           return next;
        });
        if (isFishingRodName(config.output)) {
           setEquippedItems(prev => (
             shouldEquipCraftedFishingRod(prev['主人公-slot1'] ?? '', config.output)
               ? { ...prev, '主人公-slot1': config.output }
               : prev
           ));
        } else if (isSawName(config.output)) {
           setEquippedItems(prev => (
             shouldEquipCraftedGatheringTool(prev['主人公-slot2'] ?? '', config.output)
               ? { ...prev, '主人公-slot2': config.output }
               : prev
           ));
        } else if (isPickaxeName(config.output)) {
           setEquippedItems(prev => (
             shouldEquipCraftedGatheringTool(prev['主人公-slot3'] ?? '', config.output)
               ? { ...prev, '主人公-slot3': config.output }
               : prev
           ));
        }
        if (sawCraftTutorialWorkbenchReady && craftMiniGameRecipeName === craftTutorialRecipeName) {
           setSawCraftTutorialWorkbenchReady(false);
           setSawCraftTutorialCompleted(true);
        }
        setCraftedRecipeIds(prev => prev.includes(craftMiniGameRecipeName) ? prev : [...prev, craftMiniGameRecipeName]);
        setDialogMessage(`${config.output}のクラフトに成功しました！`);
     } else {
        setDialogMessage(`${config.output}のクラフトに失敗しました。`);
     }
  };

  const handleCraftCircleClick = (circleId: number) => {
     if (craftMiniGameResult) return;
     playFixSound();
     const scorePerCircle = craftMiniGameRecipeName
        ? CRAFT_RECIPE_CONFIGS[craftMiniGameRecipeName].scorePerCircle
        : 14;
     setCraftMiniGameCircles(prev => prev.filter(circle => circle.id !== circleId));
     setCraftMiniGameScore(prev => Math.min(100, prev + scorePerCircle));
     window.setTimeout(() => {
        spawnNextCraftCircle(craftMiniGameRecipeName, craftMiniGameSpawnedCount, craftMiniGameTargetCount);
     }, 120);
  };

  const closeCraftMiniGame = () => {
     playFixSound();
     setCraftMiniGameOpen(false);
     setCraftMiniGameRecipeName(null);
     setCraftMiniGameCircles([]);
     setCraftMiniGameResult(null);
     setCraftMiniGameTargetCount(0);
     setCraftMiniGameSpawnedCount(0);
     setCraftMiniGameScore(0);
     setActiveLoggingPointId(null);
  };

  useEffect(() => {
     if (!craftMiniGameOpen || craftMiniGameResult) return;
     const timer = window.setInterval(() => {
        const now = Date.now();
        setCraftMiniGameCircles(prev => {
           const activeCircles = prev.filter(circle => circle.expiresAt > now);
           if (activeCircles.length !== prev.length) {
              window.setTimeout(() => {
                 spawnNextCraftCircle(craftMiniGameRecipeName, craftMiniGameSpawnedCount, craftMiniGameTargetCount);
              }, 120);
           }
           return activeCircles;
        });
     }, 80);
     return () => window.clearInterval(timer);
  }, [craftMiniGameOpen, craftMiniGameRecipeName, craftMiniGameResult, craftMiniGameSpawnedCount, craftMiniGameTargetCount]);

  useEffect(() => {
     if (!craftMiniGameOpen || craftMiniGameResult || craftMiniGameTargetCount <= 0) return;
     if (craftMiniGameSpawnedCount >= craftMiniGameTargetCount && craftMiniGameCircles.length === 0) {
        finishCraftMiniGame(craftMiniGameScore >= 70 ? 'success' : 'fail');
     }
  }, [activeLoggingPointId, craftMiniGameOpen, craftMiniGameRecipeName, craftMiniGameResult, craftMiniGameTargetCount, craftMiniGameSpawnedCount, craftMiniGameCircles.length, craftMiniGameScore, timeOfDay]);

  const handleShopCloseClick = () => {
     playFixSound();
     setKurumiShopOpen(false);
  };

  const handleShopItemClick = (index: number) => {
     playFixSound();
     setSelectedShopItemIndex(index);
     setSelectedShopControl('items');
  };

  const handleShopActionClick = () => {
     const item = shopItemsForDisplay[selectedShopItemIndex] ?? shopItemsForDisplay[0];
     const itemStock = item.type === '売る'
        ? (item.fishName || item.sizedInventoryName ? item.stock : (inventoryCounts[item.name] ?? 0))
        : item.stock;
     const tradePrice = item.price;
     if (itemStock <= 0) {
        playFixSound();
        setDialogMessage(item.type === '買う' ? '売り切れです。' : '売却できる在庫がありません。');
        return;
     }
     if (item.type === '買う' && gold < tradePrice) {
        playFixSound();
        setDialogMessage('ゴールドが足りません。');
        return;
     }
     playUiSound('/se/coin.mp3');
     const nextTradeTotal = kurumiTradeTotal + tradePrice;
     const availableRewards = KURUMI_TRADE_REWARDS.filter(reward => (
        nextTradeTotal >= reward.threshold && !shownKurumiTradeRewardThresholds.includes(reward.threshold)
     ));
     const nextReward = availableRewards[availableRewards.length - 1] ?? null;
     const tutorialRecipeName = isCraftRecipeId(item.name) ? item.name : null;
     const shouldStartCraftTutorial = item.type === '買う' && tutorialRecipeName !== null && !sawCraftTutorialReady && !sawCraftTutorialWorkbenchReady;
     setKurumiTradeTotal(nextTradeTotal);
     setGold(prev => item.type === '買う' ? prev - tradePrice : prev + tradePrice);
     if (item.type === '買う') {
        setShopItems(prev => prev.map((shopItem, index) => (
           shopItem.name === item.name
             ? { ...shopItem, stock: isRecipeItemName(shopItem.name) ? 0 : Math.max(0, shopItem.stock - 1) }
             : shopItem
        )));
     }
     const inventoryName = item.fishName ?? item.sizedInventoryName ?? item.name;
     setInventoryCounts(prev => {
        const next = {
           ...prev,
           [inventoryName]: Math.max(0, (prev[inventoryName] ?? 0) + (item.type === '買う' ? 1 : -1)),
        };
        if (shouldStartCraftTutorial && tutorialRecipeName) {
           Object.entries(CRAFT_RECIPE_CONFIGS[tutorialRecipeName].materials).forEach(([materialName, count]) => {
              next[materialName] = (next[materialName] ?? 0) + count;
           });
        }
        return next;
     });
     if (item.type === '売る' && item.fishName && typeof item.fishPrice === 'number') {
        setFishInventorySizes(prev => ({
           ...prev,
           [item.fishName!]: (prev[item.fishName!] ?? []).filter((size, index, sizes) => {
              const price = getFishSellPrice(FISH_ZUKAN_ENTRIES.find(fish => fish.name === item.fishName) ?? FISH_ZUKAN_ENTRIES[0], size);
              const firstMatchingIndex = sizes.findIndex(candidateSize => (
                 getFishSellPrice(FISH_ZUKAN_ENTRIES.find(fish => fish.name === item.fishName) ?? FISH_ZUKAN_ENTRIES[0], candidateSize) === item.fishPrice
              ));
              return price !== item.fishPrice || index !== firstMatchingIndex;
           }),
        }));
     }
     if (item.type === '売る' && item.sizedInventoryName && typeof item.sizedInventoryPrice === 'number') {
        const lumber = LUMBER_DATA.find(entry => entry.name === item.sizedInventoryName);
        if (lumber) {
          setLumberInventorySizes(prev => ({
            ...prev,
            [item.sizedInventoryName!]: (prev[item.sizedInventoryName!] ?? []).filter((size, index, sizes) => {
              const firstMatchingIndex = sizes.findIndex(candidateSize => (
                getLumberSellPrice(lumber, candidateSize) === item.sizedInventoryPrice
              ));
              return getLumberSellPrice(lumber, size) !== item.sizedInventoryPrice || index !== firstMatchingIndex;
            }),
          }));
        }
        const ore = ORE_DATA.find(entry => entry.name === item.sizedInventoryName);
        if (ore) {
          setOreInventoryWeights(prev => ({
            ...prev,
            [item.sizedInventoryName!]: (prev[item.sizedInventoryName!] ?? []).filter((weight, index, weights) => {
              const firstMatchingIndex = weights.findIndex(candidateWeight => (
                getOreSellPrice(ore, candidateWeight) === item.sizedInventoryPrice
              ));
              return getOreSellPrice(ore, weight) !== item.sizedInventoryPrice || index !== firstMatchingIndex;
            }),
          }));
        }
     }
     setDialogMessage(`${item.name}を${item.type === '買う' ? '購入' : '売却'}しました。`);
     setIsShopTradePose(true);
     if (shopTradePoseTimerRef.current !== null) {
        window.clearTimeout(shopTradePoseTimerRef.current);
     }
     shopTradePoseTimerRef.current = window.setTimeout(() => {
        setIsShopTradePose(false);
        shopTradePoseTimerRef.current = null;
     }, 2000);
     if (nextReward) {
        setShownKurumiTradeRewardThresholds(prev => [...prev, nextReward.threshold]);
        setActiveKurumiTradeReward(nextReward);
        setIsShopTradePose(false);
        setDialogMessage(nextReward.message);
        playVoiceSound(nextReward.voiceSrc);
        if (kurumiTradeRewardTimerRef.current !== null) {
           window.clearTimeout(kurumiTradeRewardTimerRef.current);
        }
        kurumiTradeRewardTimerRef.current = window.setTimeout(() => {
           setActiveKurumiTradeReward(null);
           kurumiTradeRewardTimerRef.current = null;
        }, 5000);
     }
     if (shouldStartCraftTutorial && tutorialRecipeName) {
        setKurumiShopOpen(false);
        setDialogMessage('くるみからクラフト用の素材を受け取りました。');
        openSawCraftTutorialIntro(tutorialRecipeName);
     }
  };

  const isResolvedEventAssetSrc = (src: string) => (
    src.startsWith('/') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:')
  );

  const resolveEventAssetSrc = (src: string, folder: 'img' | 'video' | 'se' | 'voice') => {
    const trimmed = src.trim();
    if (!trimmed) return '';
    if (isResolvedEventAssetSrc(trimmed)) return trimmed;
    if (trimmed.startsWith(`${folder}/`)) return `/${trimmed}`;
    return `/${folder}/${trimmed}`;
  };

  const resolveEventMediaSrc = (src: string, folder: 'img' | 'video') => resolveEventAssetSrc(src, folder);

  const resolveEventAudioSrc = (src: string, category: 'se' | 'voice') => {
    return resolveEventAssetSrc(src, category);
  };

  const getEventAudioFallbackSrc = (src: string, category: 'se' | 'voice') => {
    if (category !== 'voice') return '';
    if (src.startsWith('/voice/')) return src.replace(/^\/voice\//, '/se/');
    if (src.startsWith('voice/')) return `/se/${src.replace(/^voice\//, '')}`;
    if (!src.startsWith('/') && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      return `/se/${src}`;
    }
    return '';
  };

  const playEventAudio = (src: string, category: 'se' | 'voice') => {
    const audioSrc = resolveEventAudioSrc(src, category);
    if (!audioSrc) return;
    const fallbackSrc = getEventAudioFallbackSrc(src.trim(), category);
    try {
      const playResolvedAudio = (resolvedSrc: string, isFallback = false) => {
        const audio = new Audio(resolvedSrc);
        const categoryVolume = category === 'voice' ? voiceVolumeRef.current : seVolumeRef.current;
        audio.volume = getEffectiveVolume(resolvedSrc, categoryVolume, audioGainsRef.current);
        audio.currentTime = 0;
        eventAudioRefs.current.push(audio);
        audio.addEventListener('ended', () => {
          eventAudioRefs.current = eventAudioRefs.current.filter(item => item !== audio);
        }, { once: true });
        audio.addEventListener('error', () => {
          eventAudioRefs.current = eventAudioRefs.current.filter(item => item !== audio);
          if (!isFallback && fallbackSrc && fallbackSrc !== resolvedSrc) {
            playResolvedAudio(fallbackSrc, true);
            return;
          }
          console.error('自動イベント音声の読み込みに失敗しました:', resolvedSrc, audio.error);
        }, { once: true });
        void audio.play().catch((error) => {
          eventAudioRefs.current = eventAudioRefs.current.filter(item => item !== audio);
          if (!isFallback && fallbackSrc && fallbackSrc !== resolvedSrc) {
            playResolvedAudio(fallbackSrc, true);
            return;
          }
          console.error('自動イベント音声の再生に失敗しました:', resolvedSrc, error);
        });
      };

      playResolvedAudio(audioSrc);
    } catch (e) {
      console.error(e);
    }
  };

  const fadeOutEventAudio = (fadeMs = 500) => {
    const audios = [...eventAudioRefs.current];
    eventAudioRefs.current = [];
    audios.forEach(audio => {
      const startVolume = audio.volume;
      const startTime = performance.now();
      const fade = (now: number) => {
        const progress = Math.min((now - startTime) / fadeMs, 1);
        audio.volume = startVolume * (1 - progress);
        if (progress < 1) {
          requestAnimationFrame(fade);
          return;
        }
        audio.pause();
        audio.currentTime = 0;
      };
      requestAnimationFrame(fade);
    });
  };

  const triggerAutoEventSpot = (spot: InspectSpot) => {
    triggeredAutoEventIdsRef.current.add(spot.id);
    clickTargetRef.current = null;
    setClickTargetMarker(null);
    autoEventBgmMutedRef.current = true;
    fadeBgmTo(0, 900);
    const messages = spot.texts?.length ? spot.texts : [spot.text || spot.label || 'イベントが発生しました。'];
    setActiveAutoEventMessageIndex(0);
    setActiveAutoEventMessage(messages[0]);
    setActiveAutoEventSpot(spot);
    if (spot.seSrc) playEventAudio(spot.seSrc, 'se');
    if (spot.voiceSrc) playEventAudio(spot.voiceSrc, 'voice');
  };

  const closeAutoEventOverlay = () => {
    clickTargetRef.current = null;
    setClickTargetMarker(null);
    fadeOutEventAudio();
    if (autoEventBgmMutedRef.current) {
      autoEventBgmMutedRef.current = false;
      const targetVolume = getEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
      fadeBgmTo(targetVolume, 900);
    }
    setActiveAutoEventSpot(null);
    setActiveAutoEventMessage('');
    setDisplayedAutoEventMessage('');
    setActiveAutoEventMessageIndex(0);
  };

  const playSleepFadeOutSound = (src: string, fadeMs: number) => {
    try {
      const audio = new Audio(src);
      const startVolume = getEffectiveVolume(src, seVolumeRef.current, audioGainsRef.current);
      const startedAt = performance.now();
      audio.volume = startVolume;
      void audio.play();

      const fade = () => {
        const progress = Math.min((performance.now() - startedAt) / fadeMs, 1);
        audio.volume = startVolume * (1 - progress);
        if (progress < 1) {
          window.requestAnimationFrame(fade);
        } else {
          audio.pause();
          audio.currentTime = 0;
        }
      };

      window.requestAnimationFrame(fade);
    } catch (e) {
      console.error(e);
    }
  };

  const cancelBgmFade = () => {
    if (bgmFadeRafRef.current !== null) {
      cancelAnimationFrame(bgmFadeRafRef.current);
      bgmFadeRafRef.current = null;
    }
    bgmFadingRef.current = false;
  };

  const fadeBgmTo = (targetVolume: number, fadeMs: number, onComplete?: () => void) => {
    const audio = bgmRef.current;
    if (!audio) return;

    cancelBgmFade();
    bgmFadingRef.current = true;
    const startVolume = audio.volume;
    const startedAt = performance.now();

    const fade = () => {
      const progress = Math.min((performance.now() - startedAt) / fadeMs, 1);
      audio.volume = startVolume + (targetVolume - startVolume) * progress;
      if (progress < 1) {
        bgmFadeRafRef.current = requestAnimationFrame(fade);
      } else {
        bgmFadeRafRef.current = null;
        bgmFadingRef.current = false;
        onComplete?.();
      }
    };

    bgmFadeRafRef.current = requestAnimationFrame(fade);
  };

  const resumeCurrentBgm = () => {
    const audio = bgmRef.current;
    if (!audio) return;

    const isKurumiConversationOpen =
      kurumiShopOpen ||
      kurumiIntroOpen ||
      fishingTutorialOpen ||
      fishingTutorialEndingOpen ||
      sawCraftTutorialIntroOpen ||
      sawCraftTutorialShedDialogueOpen ||
      gatheringTutorialOpen;
    const currentSource = isKurumiConversationOpen ? SHOP_BGM_SRC : mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap];
    if (bgmSourceRef.current !== currentSource) {
      bgmSourceRef.current = currentSource;
      audio.pause();
      audio.src = currentSource;
      audio.loop = true;
      audio.currentTime = 0;
    }

    if (audio.paused) {
      audio.play().then(() => {
        bgmStartedRef.current = true;
      }).catch((err) => {
        console.log("BGM resume after sleep blocked", err);
      });
    }
  };

  const switchToCurrentBgm = (volume: number) => {
    const audio = bgmRef.current;
    if (!audio) return;

    const isKurumiConversationOpen =
      kurumiShopOpen ||
      kurumiIntroOpen ||
      fishingTutorialOpen ||
      fishingTutorialEndingOpen ||
      sawCraftTutorialIntroOpen ||
      sawCraftTutorialShedDialogueOpen ||
      gatheringTutorialOpen;
    const currentSource = isKurumiConversationOpen ? SHOP_BGM_SRC : mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap];
    bgmSourceRef.current = currentSource;
    audio.pause();
    audio.src = currentSource;
    audio.loop = true;
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().then(() => {
      bgmStartedRef.current = true;
    }).catch((err) => {
      console.log("BGM resume after fishing blocked", err);
    });
  };

  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;

    if (fishingMiniGameOpen) {
      wasFishingBgmActiveRef.current = true;
      cancelBgmFade();
      if (bgmSourceRef.current !== FISHING_BGM_SRC) {
        bgmSourceRef.current = FISHING_BGM_SRC;
        audio.pause();
        audio.src = FISHING_BGM_SRC;
        audio.loop = true;
        audio.currentTime = 0;
      }
      audio.volume = getEffectiveVolume(FISHING_BGM_SRC, bgmVolume, audioGainsRef.current);
      audio.play().then(() => {
        bgmStartedRef.current = true;
      }).catch((err) => {
        console.log("Fishing BGM autoplay blocked", err);
      });
      return;
    }

    if (wasFishingBgmActiveRef.current) {
      fadeBgmTo(0, 1400, () => {
        switchToCurrentBgm(0);
        const currentSource = bgmSourceRef.current;
        const targetVolume = getEffectiveVolume(currentSource, bgmVolume, audioGainsRef.current);
        fadeBgmTo(targetVolume, 1200, () => {
          wasFishingBgmActiveRef.current = false;
        });
      });
    }
  }, [fishingMiniGameOpen, bgmVolume, audioGains]);

  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio || fishingMiniGameOpen) return;

    if (loggingMiniGameOpen) {
      wasLoggingBgmActiveRef.current = true;
      cancelBgmFade();
      if (bgmSourceRef.current !== LOGGING_BGM_SRC) {
        bgmSourceRef.current = LOGGING_BGM_SRC;
        audio.pause();
        audio.src = LOGGING_BGM_SRC;
        audio.loop = true;
        audio.currentTime = 0;
      }
      audio.volume = getEffectiveVolume(LOGGING_BGM_SRC, bgmVolume, audioGainsRef.current);
      audio.play().then(() => {
        bgmStartedRef.current = true;
      }).catch((err) => {
        console.log("Logging BGM autoplay blocked", err);
      });
      return;
    }

    if (wasLoggingBgmActiveRef.current) {
      fadeBgmTo(0, 500, () => {
        switchToCurrentBgm(0);
        const currentSource = bgmSourceRef.current;
        const targetVolume = getEffectiveVolume(currentSource, bgmVolume, audioGainsRef.current);
        fadeBgmTo(targetVolume, 700, () => {
          wasLoggingBgmActiveRef.current = false;
        });
      });
    }
  }, [loggingMiniGameOpen, fishingMiniGameOpen, bgmVolume, audioGains]);

  const startSleepSequence = () => {
    setSleepPromptVisible(false);
    setIsSleepSequenceActive(true);
    setIsWalking(false);
    clickTargetRef.current = null;
    setClickTargetMarker(null);
    setSleepFadeOpacity(0);

    const houseBgmTarget = getEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
    fadeBgmTo(0, 2000);
    playSleepSound('/bgm/yado.mp3');

    window.requestAnimationFrame(() => {
      setSleepFadeOpacity(1);
    });

    window.setTimeout(() => {
      advanceToNextDay();
      playSleepFadeOutSound('/se/suzume.mp3', 3000);
      setSleepFadeOpacity(0);
      resumeCurrentBgm();
      fadeBgmTo(houseBgmTarget, 2000);
      window.setTimeout(() => {
        setIsSleepSequenceActive(false);
        sleepPromptBlockedRef.current = true;
      }, 2000);
    }, 2000);
  };

  const cancelSleepPrompt = () => {
    setSleepPromptVisible(false);
    sleepPromptBlockedRef.current = true;
  };

  const startCraftPrompt = () => {
    setCraftPromptVisible(false);
    craftPromptBlockedRef.current = true;
    if (craftPromptSource === 'kurumi' && sawCraftTutorialReady) {
      setCraftPromptSource(null);
      openSawCraftTutorialShedDialogue();
      return;
    }
    setCraftPromptSource(null);
    openCraftRecipeMenu();
  };

  const cancelCraftPrompt = () => {
    setCraftPromptVisible(false);
    setCraftPromptSource(null);
    craftPromptBlockedRef.current = true;
  };

  const cancelLoggingPrompt = () => {
    setLoggingPromptVisible(false);
    setActiveLoggingPointId(null);
    loggingPromptBlockedRef.current = true;
  };

  const beginFishingHitStage = (biteScore: number, biteCombo: number) => {
    const equippedAccessory = equippedItemsRef.current['主人公-slot4']?.trim() ?? '';
    const nushiRateMultiplier = equippedAccessory === FISHING_NUSHI_RING_NAME
      ? FISHING_NUSHI_RING_RATE_MULTIPLIER
      : 1;
    const nushiDebugRate = equippedAccessory === FISHING_NUSHI_DEBUG_RING_NAME
      ? FISHING_NUSHI_RING_DEBUG_RATE
      : null;
    const isNushiTarget = rollFishingNushi(fishingTargetFish, biteCombo, nushiRateMultiplier, nushiDebugRate);
    const targetSize = isNushiTarget
      ? fishingTargetFish.sizeMax
      : createFishingTargetSize(fishingTargetFish, biteScore, biteCombo);
    const sizeRatio = getFishSizeRatio(fishingTargetFish, targetSize);
    const levelRatio = clampNumber(fishingTargetFish.level / 24, 0, 1);
    const hitDifficultyScale = Math.max(0.42, 1 - levelRatio * 0.22 - sizeRatio * 0.24);
    const keepDifficultyScale = Math.max(0.36, 1 - levelRatio * 0.2 - sizeRatio * 0.36);

    setFishingTargetSizeValue(targetSize);
    setFishingTargetIsNushi(isNushiTarget);
    setFishingHitGreenWidth(prev => Math.max(4, prev * hitDifficultyScale));
    setFishingKeepGreenWidth(prev => Math.max(4, prev * keepDifficultyScale));
    setFishingMiniGameStage('hit');
    setFishingGauge(0);
    setFishingHitLimitSeconds(10);
    fishingGaugeDirectionRef.current = 1;
  };

  const startFishingPrompt = () => {
    if (!canStartAPAction()) {
      setFishingPromptVisible(false);
      fishingPromptBlockedRef.current = true;
      return;
    }
    const targetFish = selectFishingTargetFish({
      difficulty,
      rodName: equippedFishingRod,
      timeOfDay,
      caughtIds: caughtFishIds,
    });
    const sweetRange = createFishingFanSweetRange(targetFish);

    setFishingPromptVisible(false);
    fishingPromptBlockedRef.current = true;
    setIsFishingTutorialRun(false);
    setFishingTutorialResult(null);
    setFishingTargetFish(targetFish);
    setFishingTargetSizeValue(null);
    setFishingTargetIsNushi(false);
    setFishingFanSweetMin(sweetRange.min);
    setFishingFanSweetMax(sweetRange.max);
    setFishingMiniGameOpen(true);
    setFishingMiniGameStage('direction');
    setFishingGauge(50);
    setFishingCastAngle(0);
    setFishingCastPower(0);
    setFishingBiteRound(1);
    setFishingBiteScore(0);
    setFishingBiteCombo(0);
    setFishingBiteCircle({
      x: 50,
      y: 50,
      outerSize: FISHING_BITE_START_SIZE,
    });
    setFishingKeepSeconds(3);
    setFishingKeepMissSeconds(0);
	    setFishingFishHp(FISHING_FISH_MAX_HP);
	    setFishingTension(0);
	    setFishingHitGreenWidth(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
	    setFishingKeepGreenWidth(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
	    setFishingResultSizeCm('');
    setFishingResultIsNewRecord(false);
    setFishingResultImageSrc(FISHING_SCENE_RESULT_SRC);
    setIsFishingHitSplashActive(false);
    setIsFishingNushiIntroActive(false);
    setFishingHitCountdown(3);
    setFishingHitLimitSeconds(10);
    setIsFishingKeepPressed(false);
	    setFishingResultText('');
    fishingGaugeDirectionRef.current = 1;
    setDialogMessage(`${targetFish.name}の気配がする...`);
  };

  const cancelFishingPrompt = () => {
    setFishingPromptVisible(false);
    fishingPromptBlockedRef.current = true;
  };

  const finishFishingMiniGame = () => {
    if (fishingBiteTimerRef.current !== null) {
      window.clearInterval(fishingBiteTimerRef.current);
      fishingBiteTimerRef.current = null;
    }
    if (fishingHitSplashTimerRef.current !== null) {
      window.clearTimeout(fishingHitSplashTimerRef.current);
      fishingHitSplashTimerRef.current = null;
    }
    if (fishingHitIntroTimerRef.current !== null) {
      window.clearTimeout(fishingHitIntroTimerRef.current);
      fishingHitIntroTimerRef.current = null;
    }
    if (fishingHitCountdownTimerRef.current !== null) {
      window.clearInterval(fishingHitCountdownTimerRef.current);
      fishingHitCountdownTimerRef.current = null;
    }
    if (fishingBiteSparkleTimerRef.current !== null) {
      window.clearTimeout(fishingBiteSparkleTimerRef.current);
      fishingBiteSparkleTimerRef.current = null;
    }
    if (fishingResultLockTimerRef.current !== null) {
      window.clearTimeout(fishingResultLockTimerRef.current);
      fishingResultLockTimerRef.current = null;
    }
    if (fishingNushiVoiceRef.current) {
      fishingNushiVoiceRef.current.pause();
      fishingNushiVoiceRef.current = null;
    }
    setFishingMiniGameOpen(false);
    setFishingMiniGameStage('direction');
    setFishingTargetIsNushi(false);
    setIsFishingHitSplashActive(false);
    setIsFishingHitIntroActive(false);
    setIsFishingNushiIntroActive(false);
    setIsFishingResultInputLocked(false);
    setFishingHitCountdown(3);
    setFishingHitLimitSeconds(10);
    setFishingBiteRound(1);
    setFishingBiteScore(0);
    setFishingBiteCombo(0);
    setFishingBiteCircle({
      x: 50,
      y: 50,
      outerSize: FISHING_BITE_START_SIZE,
    });
	    setFishingBiteSparkle(null);
	    setIsFishingKeepPressed(false);
	    setFishingHitGreenWidth(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
	    setFishingKeepGreenWidth(FISHING_KEEP_GREEN_SUCCESS_WIDTH);
    setFishingResultText('');
    setFishingResultSizeCm('');
    setFishingResultIsNewRecord(false);
    setFishingResultImageSrc(FISHING_SCENE_RESULT_SRC);
    setSelectedFishingResultAction('retry');
    setIsFishingTutorialRun(false);
    setFishingTutorialResult(null);
    fishingPromptBlockedRef.current = true;
  };

  const handleFishingMiniGameAction = () => {
    if (fishingMiniGameStage === 'result') {
      if (isFishingTutorialRun) return;
      if (isFishingResultInputLocked) return;
      playFixSound();
      finishFishingMiniGame();
      return;
    }
    playFixSound();
    if (isFishingHitSplashActive) {
      return;
    }
	    if (fishingMiniGameStage === 'direction') {
	      const fanSuccess = fishingGauge >= fishingFanSweetMin && fishingGauge <= fishingFanSweetMax;
	      setFishingHitGreenWidth(fanSuccess ? FISHING_KEEP_GREEN_SUCCESS_WIDTH : FISHING_KEEP_GREEN_FAIL_WIDTH);
      setFishingCastAngle(Math.round((fishingGauge - 50) * 1.2));
      setFishingMiniGameStage('power');
      setFishingGauge(0);
      fishingGaugeDirectionRef.current = 1;
      return;
    }
	    if (fishingMiniGameStage === 'power') {
	      const castPower = Math.round(fishingGauge);
	      const powerAccuracy = Math.max(0, 1 - Math.abs(castPower - 105) / 105);
	      setFishingCastPower(castPower);
	      setFishingKeepGreenWidth(FISHING_KEEP_GREEN_FAIL_WIDTH * (1 + powerAccuracy));
      playUiSound(FISHING_CAST_SOUND_SRC);
      setFishingMiniGameStage('bite');
      setFishingGauge(50);
      setFishingBiteRound(1);
      setFishingBiteScore(0);
      setFishingBiteCombo(0);
      setFishingBiteCircle({
        x: 18 + Math.random() * 64,
        y: 20 + Math.random() * 56,
        outerSize: FISHING_BITE_START_SIZE,
      });
      setFishingHitLimitSeconds(10);
      setDialogMessage('魚の反応を狙っています...');
      return;
    }
    if (fishingMiniGameStage === 'bite') {
      const timingDiff = Math.abs(fishingBiteCircle.outerSize - FISHING_BITE_TARGET_SIZE);
      const biteSucceeded = timingDiff <= 16;
      const nextBiteScore = biteSucceeded ? Math.min(FISHING_BITE_ROUNDS, fishingBiteScore + 1) : fishingBiteScore;
      const nextBiteCombo = biteSucceeded ? Math.min(FISHING_BITE_ROUNDS, fishingBiteCombo + 1) : 0;
      if (biteSucceeded) {
        setFishingBiteScore(prev => Math.min(FISHING_BITE_ROUNDS, prev + 1));
        setFishingBiteCombo(prev => Math.min(FISHING_BITE_ROUNDS, prev + 1));
        setFishingBiteSparkle({
          x: fishingBiteCircle.x,
          y: fishingBiteCircle.y,
          id: Date.now(),
        });
        if (fishingBiteSparkleTimerRef.current !== null) {
          window.clearTimeout(fishingBiteSparkleTimerRef.current);
        }
        fishingBiteSparkleTimerRef.current = window.setTimeout(() => {
          setFishingBiteSparkle(null);
          fishingBiteSparkleTimerRef.current = null;
        }, 2000);
        playUiSound(UI_SUCCESS_SOUND_SRC);
      } else {
        setFishingBiteCombo(0);
      }
      if (fishingBiteTimerRef.current !== null) {
        window.clearInterval(fishingBiteTimerRef.current);
        fishingBiteTimerRef.current = null;
      }
      setFishingBiteRound(prev => {
        if (prev >= FISHING_BITE_ROUNDS) {
          beginFishingHitStage(nextBiteScore, nextBiteCombo);
          return prev;
        }
        setFishingBiteCircle({
          x: 18 + Math.random() * 64,
          y: 20 + Math.random() * 56,
          outerSize: FISHING_BITE_START_SIZE,
        });
        return prev + 1;
      });
      return;
    }
    if (fishingMiniGameStage === 'hit') {
      const hitGauge = fishingGaugeRef.current;
      const success = hitGauge >= fishingHitGreenMin && hitGauge <= fishingHitGreenMax;
      if (success) {
        const isNushiHit = fishingTargetIsNushi || (fishingTargetSizeValue !== null && isNushiSize(fishingTargetFish, fishingTargetSizeValue));
	        setIsFishingHitSplashActive(true);
	        setIsFishingHitIntroActive(true);
	        setFishingHitCountdown(3);
	        setDialogMessage('HIT！');
	        playUiSound(IWANA_SPLASH_SOUND_SRC);
        if (fishingHitSplashTimerRef.current !== null) {
          window.clearTimeout(fishingHitSplashTimerRef.current);
        }
        if (fishingHitIntroTimerRef.current !== null) {
          window.clearTimeout(fishingHitIntroTimerRef.current);
        }
        if (fishingHitCountdownTimerRef.current !== null) {
          window.clearInterval(fishingHitCountdownTimerRef.current);
        }
        if (fishingNushiVoiceRef.current) {
          fishingNushiVoiceRef.current.pause();
          fishingNushiVoiceRef.current = null;
        }
        fishingHitIntroTimerRef.current = window.setTimeout(() => {
          setIsFishingHitIntroActive(false);
          fishingHitIntroTimerRef.current = null;
	        }, 700);
        const startFishingKeepStage = () => {
          setIsFishingHitSplashActive(false);
          setIsFishingHitIntroActive(false);
          setIsFishingNushiIntroActive(false);
          if (fishingHitIntroTimerRef.current !== null) {
            window.clearTimeout(fishingHitIntroTimerRef.current);
            fishingHitIntroTimerRef.current = null;
          }
          if (fishingHitCountdownTimerRef.current !== null) {
            window.clearInterval(fishingHitCountdownTimerRef.current);
            fishingHitCountdownTimerRef.current = null;
          }
          setFishingMiniGameStage('keep');
          setFishingGauge(0);
          setFishingKeepSeconds(3);
          setFishingKeepMissSeconds(0);
          setFishingFishHp(FISHING_FISH_MAX_HP);
          setFishingTension(0);
          setDialogMessage('HIT！長押しで緑ゾーンをキープ！');
          fishingHitSplashTimerRef.current = null;
        };
        const startFishingHitCountdown = () => {
          setIsFishingNushiIntroActive(false);
          setIsFishingHitIntroActive(false);
          setFishingHitCountdown(3);
          playVoiceSound('/voice/3.wav');
          fishingHitCountdownTimerRef.current = window.setInterval(() => {
            setFishingHitCountdown(prev => {
              const next = Math.max(1, prev - 1);
              if (next !== prev) playVoiceSound(`/voice/${next}.wav`);
              return next;
            });
          }, 1000);
          fishingHitSplashTimerRef.current = window.setTimeout(startFishingKeepStage, 3000);
        };
        if (isNushiHit) {
          setIsFishingNushiIntroActive(true);
          const nushiVoice = playVoiceSound(FISHING_NUSHI_SOUND_SRC);
          fishingNushiVoiceRef.current = nushiVoice ?? null;
          if (nushiVoice) {
            nushiVoice.addEventListener('ended', () => {
              if (fishingNushiVoiceRef.current === nushiVoice) {
                fishingNushiVoiceRef.current = null;
              }
              startFishingHitCountdown();
            }, { once: true });
          } else {
            fishingHitCountdownTimerRef.current = window.setTimeout(startFishingHitCountdown, FISHING_NUSHI_COUNTDOWN_DELAY_MS);
          }
        } else {
          fishingHitCountdownTimerRef.current = window.setTimeout(startFishingHitCountdown, 0);
        }
        return;
      }
      setFishingResultImageSrc(FISHING_SCENE_ESCAPE_SRC);
      setFishingResultSizeCm('');
      setFishingResultIsNewRecord(false);
      setFishingResultText('魚を逃してしまった...');
      setDialogMessage('魚を逃してしまった...');
      if (isFishingTutorialRun) setFishingTutorialResult('fail');
      playVoiceSound(FISH_LOSE_SOUND_SRC);
      setFishingMiniGameStage('result');
      return;
    }
    if (fishingMiniGameStage === 'keep') {
      setIsFishingKeepPressed(true);
      return;
    }
    finishFishingMiniGame();
  };

  const releaseFishingKeepPress = () => {
    if (fishingMiniGameStage !== 'keep') return;
    setIsFishingKeepPressed(false);
  };

  const paintCollisionBrush = (
    x: number,
    y: number,
    drawMode: CollisionDrawMode,
    from?: { x: number; y: number } | null
  ) => {
    const start = from ?? { x, y };
    const distance = Math.hypot(x - start.x, y - start.y);
    const steps = Math.max(1, Math.ceil(distance / (TILE_SIZE * 0.5)));
    const brushRadius = Math.floor(collisionBrushSize / 2);

    setObstacles(prev => {
      const next = { ...prev };
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = start.x + (x - start.x) * t;
        const py = start.y + (y - start.y) * t;
        const centerGx = Math.floor(px / TILE_SIZE);
        const centerGy = Math.floor(py / TILE_SIZE);

        for (let gx = centerGx - brushRadius; gx <= centerGx + brushRadius; gx++) {
          for (let gy = centerGy - brushRadius; gy <= centerGy + brushRadius; gy++) {
            if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) continue;
            const key = `${currentMap}_${gx},${gy}`;
            if (drawMode === 'paint') {
              next[key] = true;
            } else {
              delete next[key];
            }
          }
        }
      }
      return next;
    });
  };

  const paintHideAreaBrush = (
    x: number,
    y: number,
    drawMode: HideAreaDrawMode,
    from?: { x: number; y: number } | null
  ) => {
    const start = from ?? { x, y };
    const distance = Math.hypot(x - start.x, y - start.y);
    const steps = Math.max(1, Math.ceil(distance / (TILE_SIZE * 0.5)));
    const brushRadius = Math.floor(hideAreaBrushSize / 2);

    setHideAreaTiles(prev => {
      const next = { ...prev };
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = start.x + (x - start.x) * t;
        const py = start.y + (y - start.y) * t;
        const centerGx = Math.floor(px / TILE_SIZE);
        const centerGy = Math.floor(py / TILE_SIZE);

        for (let gx = centerGx - brushRadius; gx <= centerGx + brushRadius; gx++) {
          for (let gy = centerGy - brushRadius; gy <= centerGy + brushRadius; gy++) {
            if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) continue;
            const key = `${currentMap}_${gx},${gy}`;
            if (drawMode === 'paint') {
              next[key] = true;
            } else {
              delete next[key];
            }
          }
        }
      }
      return next;
    });
  };

  const paintBathTubMaskBrush = (
    x: number,
    y: number,
    drawMode: HideAreaDrawMode,
    from?: { x: number; y: number } | null
  ) => {
    if (currentMap !== 'house') return;

    const start = from ?? { x, y };
    const distance = Math.hypot(x - start.x, y - start.y);
    const steps = Math.max(1, Math.ceil(distance / (TILE_SIZE * 0.5)));
    const brushRadius = Math.floor(bathTubMaskBrushSize / 2);

    setBathTubMaskTiles(prev => {
      const next = { ...prev };
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = start.x + (x - start.x) * t;
        const py = start.y + (y - start.y) * t;
        const centerGx = Math.floor(px / TILE_SIZE);
        const centerGy = Math.floor(py / TILE_SIZE);

        for (let gx = centerGx - brushRadius; gx <= centerGx + brushRadius; gx++) {
          for (let gy = centerGy - brushRadius; gy <= centerGy + brushRadius; gy++) {
            if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) continue;
            const key = `house_${gx},${gy}`;
            if (drawMode === 'paint') {
              next[key] = true;
            } else {
              delete next[key];
            }
          }
        }
      }
      return next;
    });
  };

  const isPlayerInHideArea = (x: number, y: number, map: GameMap) => {
    const checkPoints = [
      { x, y },
      { x: x - 12, y },
      { x: x + 12, y },
      { x, y: y - 18 },
    ];
    return checkPoints.some(point => {
      const gx = Math.floor(point.x / TILE_SIZE);
      const gy = Math.floor(point.y / TILE_SIZE);
      if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return false;
      return !!hideAreaTiles[`${map}_${gx},${gy}`];
    });
  };

  const isPlayerInBathArea = (x: number, y: number, map: GameMap) => {
    if (map !== 'house') return false;
    return (
      x + 14 >= HOUSE_BATH_ZONE.x &&
      x - 14 <= HOUSE_BATH_ZONE.x + HOUSE_BATH_ZONE.w &&
      y >= HOUSE_BATH_ZONE.y &&
      y - 34 <= HOUSE_BATH_ZONE.y + HOUSE_BATH_ZONE.h
    );
  };

  const isPlayerInBathTub = (x: number, y: number, map: GameMap) => {
    if (map !== 'house') return false;
    const hasTileMask = Object.keys(bathTubMaskTiles).some(key => key.startsWith('house_'));
    if (hasTileMask) {
      const checkPoints = [
        { x, y },
        { x: x - 12, y },
        { x: x + 12, y },
      ];
      return checkPoints.some(point => {
        const gx = Math.floor(point.x / TILE_SIZE);
        const gy = Math.floor(point.y / TILE_SIZE);
        if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return false;
        return !!bathTubMaskTiles[`house_${gx},${gy}`];
      });
    }
    return (
      x >= bathTubMaskZone.x &&
      x <= bathTubMaskZone.x + bathTubMaskZone.w &&
      y >= bathTubMaskZone.y &&
      y <= bathTubMaskZone.y + bathTubMaskZone.h
    );
  };

  const isPlayerInBath = isPlayerInBathArea(pos.x, pos.y, currentMap);
  const isPlayerInBathTubMask = isPlayerInBath && isPlayerInBathTub(pos.x, pos.y, currentMap);

  useEffect(() => {
    if (isPlayerInBath !== wasPlayerInBathRef.current) {
      const audio = new Audio(BATH_CHANGE_SOUND_SRC);
      audio.volume = getEffectiveVolume(BATH_CHANGE_SOUND_SRC, seVolumeRef.current, audioGainsRef.current);
      void audio.play().catch((err) => {
        console.log("Bath change sound autoplay blocked", err);
      });
    }
    wasPlayerInBathRef.current = isPlayerInBath;
  }, [isPlayerInBath]);

  useEffect(() => {
    if (isPlayerInBathTubMask && !wasPlayerInBathTubRef.current) {
      const audio = new Audio(BATH_SPLASH_SOUND_SRC);
      audio.volume = getEffectiveVolume(BATH_SPLASH_SOUND_SRC, seVolumeRef.current, audioGainsRef.current);
      void audio.play().catch((err) => {
        console.log("Bath splash sound autoplay blocked", err);
      });
    }
    wasPlayerInBathTubRef.current = isPlayerInBathTubMask;
  }, [isPlayerInBathTubMask]);

  const paintFootstepTile = (x: number, y: number, drawMode: FootstepSound | 'erase') => {
    const centerGx = Math.floor(x / TILE_SIZE);
    const centerGy = Math.floor(y / TILE_SIZE);
    if (centerGx < 0 || centerGx >= GRID_COLS || centerGy < 0 || centerGy >= GRID_ROWS) return;

    const brushRadius = Math.floor(footstepBrushSize / 2);
    setFootstepTiles(prev => {
      const next = { ...prev };
      for (let gx = centerGx - brushRadius; gx <= centerGx + brushRadius; gx++) {
        for (let gy = centerGy - brushRadius; gy <= centerGy + brushRadius; gy++) {
          if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) continue;
          const key = `${currentMap}_${gx},${gy}`;
          if (drawMode === 'erase') {
            delete next[key];
          } else {
            next[key] = drawMode;
          }
        }
      }
      saveFootstepTiles(next);
      return next;
    });
  };

  const paintBedTile = (x: number, y: number, drawMode: boolean) => {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;

    const key = `house_${gx},${gy}`;
    setBedTiles(prev => {
      const next = { ...prev };
      if (drawMode) {
        next[key] = true;
      } else {
        delete next[key];
      }
      saveBedTiles(next);
      return next;
    });
  };

  const paintWorkbenchTile = (x: number, y: number, drawMode: boolean) => {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;

    const key = `${currentMap}_${gx},${gy}`;
    setWorkbenchTiles(prev => {
      const next = { ...prev };
      if (drawMode) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const paintFishingTile = (x: number, y: number, drawMode: boolean) => {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;

    const key = `${currentMap}_${gx},${gy}`;
    setFishingTiles(prev => {
      const next = { ...prev };
      if (drawMode) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const paintMiningTile = (x: number, y: number, drawMode: boolean) => {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;

    const key = `${currentMap}_${gx},${gy}`;
    setMiningTiles(prev => {
      const next = { ...prev };
      if (drawMode) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const paintLoggingTile = (x: number, y: number, drawMode: boolean) => {
    const gx = Math.floor(x / TILE_SIZE);
    const gy = Math.floor(y / TILE_SIZE);
    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;

    const key = `${currentMap}_${gx},${gy}`;
    setLoggingTiles(prev => {
      const next = { ...prev };
      if (drawMode) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const loggingPointTargetCount = LOGGING_POINT_COUNT_BY_TIME[timeOfDay];
  const loggingCandidatePoints = useMemo<LoggingPoint[]>(() => {
    const candidates: LoggingPoint[] = [];

    LOGGING_POINT_MAPS.forEach(map => {
      const mapTiles = Object.keys(obstacles)
        .filter(key => key.startsWith(`${map}_`) && obstacles[key])
        .map(key => {
          const [, posKey] = key.split('_');
          const [gx, gy] = posKey.split(',').map(Number);
          return { gx, gy, key };
        })
        .filter(tile => Number.isInteger(tile.gx) && Number.isInteger(tile.gy));
      const remaining = new Set(mapTiles.map(tile => tile.key));
      const byKey = new Map(mapTiles.map(tile => [tile.key, tile]));

      mapTiles.forEach(tile => {
        if (!remaining.has(tile.key)) return;
        const stack = [tile];
        const component: typeof mapTiles = [];
        remaining.delete(tile.key);
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) continue;
          component.push(current);
          [
            [current.gx + 1, current.gy],
            [current.gx - 1, current.gy],
            [current.gx, current.gy + 1],
            [current.gx, current.gy - 1],
          ].forEach(([gx, gy]) => {
            const nextKey = `${map}_${gx},${gy}`;
            const nextTile = byKey.get(nextKey);
            if (!nextTile || !remaining.has(nextKey)) return;
            remaining.delete(nextKey);
            stack.push(nextTile);
          });
        }

        const xs = component.map(t => t.gx);
        const ys = component.map(t => t.gy);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const tileW = maxX - minX + 1;
        const tileH = maxY - minY + 1;
        if (component.length < 1 || component.length > 18 || tileW > 4 || tileH > 8) return;

        candidates.push({
          id: `${map}_${minX},${minY}_${tileW}x${tileH}`,
          map,
          x: minX * TILE_SIZE,
          y: minY * TILE_SIZE,
          w: tileW * TILE_SIZE,
          h: tileH * TILE_SIZE,
        });
      });
    });

    Object.keys(loggingTiles).forEach(key => {
      if (!loggingTiles[key]) return;
      const [mapKey, posKey] = key.split('_');
      if (!LOGGING_POINT_MAPS.includes(mapKey as GameMap) || !posKey) return;
      const [gx, gy] = posKey.split(',').map(Number);
      if (!Number.isInteger(gx) || !Number.isInteger(gy)) return;
      candidates.push({
        id: `manual_${mapKey}_${gx},${gy}`,
        map: mapKey as GameMap,
        x: gx * TILE_SIZE,
        y: gy * TILE_SIZE,
        w: TILE_SIZE,
        h: TILE_SIZE,
      });
    });

    return candidates;
  }, [obstacles, loggingTiles]);
  const activeLoggingPoints = useMemo<LoggingPoint[]>(() => {
    const available = loggingCandidatePoints.filter(point => !depletedLoggingPointIds[`${timeOfDay}_${point.id}`]);
    const byMap = LOGGING_POINT_MAPS
      .map(map => ({ map, points: available.filter(point => point.map === map) }))
      .filter(group => group.points.length > 0);
    const selected: LoggingPoint[] = [];
    const selectedIds = new Set<string>();
    byMap.forEach(group => {
      const first = shuffleBySeed<LoggingPoint>(group.points, `${turn}_${timeOfDay}_${group.map}_required`)[0];
      if (first) {
        selected.push(first);
        selectedIds.add(first.id);
      }
    });

    const targetCount = Math.max(loggingPointTargetCount, selected.length);
    const remainingSlots = Math.max(0, targetCount - selected.length);
    shuffleBySeed<LoggingPoint>(available.filter(point => !selectedIds.has(point.id)), `${turn}_${timeOfDay}_extra`)
      .slice(0, remainingSlots)
      .forEach(point => selected.push(point));
    return selected.slice(0, targetCount);
  }, [depletedLoggingPointIds, loggingCandidatePoints, loggingPointTargetCount, timeOfDay, turn]);

  const timeLabels = {
    ...TIME_OF_DAY_LABELS
  };

  useEffect(() => {
     if (!selectedZoneId) return;
     const selectedZone = zones.find(z => z.id === selectedZoneId);
     if (!selectedZone || (selectedZone.map && selectedZone.map !== currentMap) || !isAnimZoneVisibleAtTime(selectedZone, timeOfDay)) {
        setSelectedZoneId(null);
     }
  }, [selectedZoneId, zones, currentMap, timeOfDay]);

  useEffect(() => {
    const urls = new Set<string>();
    Object.values(mapBackgrounds).forEach(background => {
      if (typeof background === 'string') {
        urls.add(background);
      } else {
        Object.values(background).forEach(url => urls.add(url));
      }
    });

    urls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);



  const customSprites = {
    down: playerSpriteUrls.down,
    up: playerSpriteUrls.up,
    left: playerSpriteUrls.left,
    right: playerSpriteUrls.right
  };

  useEffect(() => {
    const handleResize = () => {
      const availableWidth = window.innerWidth - 32;
      const availableHeight = window.innerHeight - 64;
      setScale(Math.min(availableWidth / 1920, availableHeight / 1156, 1));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // BGMの初期化と自動再生処理
  useEffect(() => {
    const audio = new Audio(TITLE_BGM_SRC);
    audio.loop = true;
    audio.volume = getEffectiveVolume(TITLE_BGM_SRC, bgmVolume, audioGainsRef.current);
    bgmRef.current = audio;

    const startBgm = () => {
      audio.play().then(() => {
        bgmStartedRef.current = true;
        window.removeEventListener('click', startBgm);
        window.removeEventListener('keydown', startBgm);
      }).catch((err) => {
        console.log("Autoplay blocked, waiting for interaction", err);
      });
    };

    window.addEventListener('click', startBgm);
    window.addEventListener('keydown', startBgm);

    // 初回の再生試行
    startBgm();

    return () => {
      audio.pause();
      window.removeEventListener('click', startBgm);
      window.removeEventListener('keydown', startBgm);
    };
  }, []);

  // マップに応じてBGMを切り替える
  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    if (fishingMiniGameOpen || wasFishingBgmActiveRef.current || loggingMiniGameOpen || wasLoggingBgmActiveRef.current) return;
    if (activeAutoEventSpot) return;

    const isKurumiConversationOpen =
      kurumiShopOpen ||
      kurumiIntroOpen ||
      fishingTutorialOpen ||
      fishingTutorialEndingOpen ||
      sawCraftTutorialIntroOpen ||
      sawCraftTutorialShedDialogueOpen ||
      gatheringTutorialOpen;
    const nextSource = bootMode === 'playing'
      ? isKurumiConversationOpen ? SHOP_BGM_SRC : mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap]
      : TITLE_BGM_SRC;
    if (bgmSourceRef.current === nextSource) return;

    const shouldResume = bgmStartedRef.current && !audio.paused;
    bgmSourceRef.current = nextSource;
    audio.pause();
    audio.src = nextSource;
    audio.loop = true;
    audio.volume = getEffectiveVolume(nextSource, bgmVolume, audioGainsRef.current);
    audio.currentTime = 0;

    if (shouldResume) {
      audio.play().then(() => {
        bgmStartedRef.current = true;
      }).catch((err) => {
        console.log("BGM switch autoplay blocked", err);
      });
    }
  }, [bootMode, currentMap, bgmVolume, audioGains, mapBgmSources, kurumiShopOpen, kurumiIntroOpen, fishingTutorialOpen, fishingTutorialEndingOpen, sawCraftTutorialIntroOpen, sawCraftTutorialShedDialogueOpen, gatheringTutorialOpen, fishingMiniGameOpen, loggingMiniGameOpen, activeAutoEventSpot]);

  // BGM音量変更時の反映
  useEffect(() => {
    if (fishingMiniGameOpen || wasFishingBgmActiveRef.current || loggingMiniGameOpen || wasLoggingBgmActiveRef.current) return;
    if (activeAutoEventSpot) return;
    if (bgmRef.current && !bgmFadingRef.current) {
      bgmRef.current.volume = getEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
    }
  }, [bgmVolume, audioGains, fishingMiniGameOpen, loggingMiniGameOpen, activeAutoEventSpot]);

  // マップ専用の環境音
  useEffect(() => {
    const waterfallAudio = new Audio(WATERFALL_SOUND_SRC);
    waterfallAudio.loop = true;
    waterfallAudio.volume = 0;
    forceMonoPlayback(waterfallAudio);
    waterfallSoundRef.current = waterfallAudio;

    const riverAudio = new Audio(RIVER_SOUND_SRC);
    riverAudio.loop = true;
    riverAudio.volume = 0;
    forceMonoPlayback(riverAudio);
    riverSoundRef.current = riverAudio;

    const fireplaceAudio = new Audio(FIREPLACE_SOUND_SRC);
    fireplaceAudio.loop = true;
    fireplaceAudio.volume = 0;
    forceMonoPlayback(fireplaceAudio);
    fireplaceSoundRef.current = fireplaceAudio;

    const cicadaAudio = new Audio(CICADA_SOUND_SRC);
    cicadaAudio.loop = true;
    cicadaAudio.volume = getEffectiveVolume(CICADA_SOUND_SRC, seVolumeRef.current, audioGainsRef.current);
    cicadaSoundRef.current = cicadaAudio;

    return () => {
      waterfallAudio.pause();
      riverAudio.pause();
      fireplaceAudio.pause();
      cicadaAudio.pause();
    };
  }, []);

  useEffect(() => {
    const waterfallAudio = waterfallSoundRef.current;
    const riverAudio = riverSoundRef.current;
    const fireplaceAudio = fireplaceSoundRef.current;
    const cicadaAudio = cicadaSoundRef.current;
    if (!waterfallAudio || !riverAudio || !fireplaceAudio || !cicadaAudio) return;

    if (hasWaterfallSoundMap(currentMap)) {
      resumeMonoPlayback(waterfallAudio);
      waterfallAudio.play().catch((err) => {
        console.log("Waterfall sound autoplay blocked", err);
      });
    } else {
      waterfallAudio.pause();
    }

    if (currentMap === 'waterfall') {
      cicadaAudio.play().catch((err) => {
        console.log("Cicada sound autoplay blocked", err);
      });
    } else {
      cicadaAudio.pause();
    }

    if (currentMap === 'farm' || currentMap === 'kawa') {
      resumeMonoPlayback(riverAudio);
      riverAudio.play().catch((err) => {
        console.log("River sound autoplay blocked", err);
      });
    } else {
      riverAudio.pause();
    }

    if (currentMap === 'house') {
      resumeMonoPlayback(fireplaceAudio);
      fireplaceAudio.play().catch((err) => {
        console.log("Fireplace sound autoplay blocked", err);
      });
    } else {
      fireplaceAudio.pause();
    }
  }, [currentMap]);

  useEffect(() => {
    const waterfallAudio = waterfallSoundRef.current;
    const riverAudio = riverSoundRef.current;
    const fireplaceAudio = fireplaceSoundRef.current;
    const cicadaAudio = cicadaSoundRef.current;
    if (!waterfallAudio || !riverAudio || !fireplaceAudio || !cicadaAudio) return;

    cicadaAudio.volume = currentMap === 'waterfall'
      ? getEffectiveVolume(CICADA_SOUND_SRC, seVolume, audioGainsRef.current)
      : 0;

    riverAudio.volume = Math.min(1, getEffectiveVolume(RIVER_SOUND_SRC, seVolume, audioGainsRef.current) * getRiverVolume(currentMap, pos));

    if (currentMap === 'house') {
      const dx = pos.x - HOUSE_FIREPLACE_POINT.x;
      const dy = pos.y - HOUSE_FIREPLACE_POINT.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const proximityGain = 1 - Math.min(distance / FIREPLACE_HEAR_DISTANCE, 1);
      fireplaceAudio.volume = Math.min(1, getEffectiveVolume(FIREPLACE_SOUND_SRC, seVolume, audioGainsRef.current) * proximityGain);
    } else {
      fireplaceAudio.volume = 0;
    }

    const waterfallSoundZone = zones.find(zone => (
      zone.map === currentMap &&
      zone.type === 'waterfall' &&
      isAnimZoneVisibleAtTime(zone, timeOfDay)
    ));
    const waterfallSoundPoint = waterfallSoundZone
      ? {
          x: waterfallSoundZone.x + waterfallSoundZone.w / 2,
          y: waterfallSoundZone.y + waterfallSoundZone.h / 2,
        }
      : getWaterfallSoundPoint(currentMap);
    if (!waterfallSoundPoint) {
      waterfallAudio.volume = 0;
      return;
    }

    const dx = pos.x - waterfallSoundPoint.x;
    const dy = pos.y - waterfallSoundPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const closeness = 1 - Math.min(distance / WATERFALL_HEAR_DISTANCE, 1);
    const proximityGain = WATERFALL_MIN_GAIN + (1 - WATERFALL_MIN_GAIN) * closeness;
    waterfallAudio.volume = Math.min(1, getEffectiveVolume(WATERFALL_SOUND_SRC, seVolume, audioGainsRef.current) * proximityGain);
  }, [currentMap, pos.x, pos.y, seVolume, audioGains, zones, timeOfDay]);

  // 歩行音 (soil.mp3) の初期化
  useEffect(() => {
    const audio = new Audio('/se/soil.mp3');
    audio.loop = true;
    audio.playbackRate = FOOTSTEP_SOUNDS.soil.playbackRate;
    audio.volume = getEffectiveVolume('/se/soil.mp3', seVolume, audioGainsRef.current);
    walkSoundRef.current = audio;

    return () => {
      audio.pause();
    };
  }, []);

  // SE音量変更時の歩行音への反映
  useEffect(() => {
    if (walkSoundRef.current) {
      const src = walkSoundRef.current.src ? new URL(walkSoundRef.current.src).pathname : '/se/soil.mp3';
      walkSoundRef.current.volume = getEffectiveVolume(src, seVolume, audioGainsRef.current);
    }
  }, [seVolume, audioGains]);

  // 足元マスに応じて歩行音を切り替える
  useEffect(() => {
    const audio = walkSoundRef.current;
    if (!audio) return;

    const tileKey = getFootstepTileKey(pos.x, pos.y, currentMap);
    const nextSound = footstepTiles[tileKey] ?? 'soil';
    if (walkSoundTypeRef.current === nextSound) return;

    const wasPlaying = !audio.paused;
    walkSoundTypeRef.current = nextSound;
    audio.pause();
    audio.src = FOOTSTEP_SOUNDS[nextSound].src;
    audio.loop = true;
    audio.playbackRate = FOOTSTEP_SOUNDS[nextSound].playbackRate;
    audio.volume = getEffectiveVolume(FOOTSTEP_SOUNDS[nextSound].src, seVolumeRef.current, audioGainsRef.current);
    audio.currentTime = 0;
    if (wasPlaying && isWalking && setupMode === 'none') {
      audio.play().catch((err) => {
        console.log("Walk sound switch blocked", err);
      });
    }
  }, [pos.x, pos.y, currentMap, footstepTiles, isWalking, setupMode]);

  // 歩行状態に応じた再生・停止
  useEffect(() => {
    const audio = walkSoundRef.current;
    if (!audio) return;

    if (isWalking && setupMode === 'none') {
      audio.play().catch((err) => {
        console.log("Walk sound autoplay blocked", err);
      });
    } else {
      audio.pause();
    }
  }, [isWalking, setupMode]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const handleKeyDown = (e: KeyboardEvent) => { 
      keys.current[e.key] = true; 
      if (e.key.length === 1) keys.current[e.key.toLowerCase()] = true; 
      
      // ゲームの操作キーが押された場合はブラウザのスクロールを防ぐ
      const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 's', 'a', 'd', 'q', 'e', ' ', 'enter'];
      if (gameKeys.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }

      if (pendingDeleteSaveSlot !== null) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const nextChoice = e.key === 'ArrowLeft' ? 'yes' : 'no';
          if (confirmPromptChoice !== nextChoice) playCursorSound();
          setConfirmPromptChoice(nextChoice);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playFixSound();
          if (confirmPromptChoice === 'yes') {
            confirmDeleteSaveSlot();
          } else {
            cancelDeleteSaveSlot();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          cancelDeleteSaveSlot();
          return;
        }
        return;
      }

      if (pendingOverwriteSaveSlot !== null) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const nextChoice = e.key === 'ArrowLeft' ? 'yes' : 'no';
          if (confirmPromptChoice !== nextChoice) playCursorSound();
          setConfirmPromptChoice(nextChoice);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (confirmPromptChoice === 'yes') {
            confirmOverwriteSaveSlot();
          } else {
            cancelOverwriteSaveSlot();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelOverwriteSaveSlot();
          return;
        }
        return;
      }

      if (bootMode !== 'playing') {
        return;
      }

      if (craftConfirmRecipeName) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playCursorSound();
          setConfirmPromptChoice(prev => prev === 'yes' ? 'no' : 'yes');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (confirmPromptChoice === 'yes') {
            startCraftMiniGame(craftConfirmRecipeName);
          } else {
            playFixSound();
            setCraftConfirmRecipeName(null);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          setCraftConfirmRecipeName(null);
          return;
        }
        return;
      }

      if (craftInsufficientRecipeName) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          setCraftInsufficientRecipeName(null);
        }
        return;
      }

      if (craftMiniGameOpen) {
        if (e.repeat) return;
        if (craftMiniGameResult && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
          e.preventDefault();
          closeCraftMiniGame();
        }
        return;
      }

      if (recipeDetailOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          setMenuFocusArea('content');
          setMenuContentFocus('secondary');
          setRecipeDetailOpen(false);
        }
        return;
      }

      if (farmGirlDetailOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playFixSound();
          setMenuFocusArea('content');
          setMenuContentFocus('secondary');
          setFarmGirlDetailOpen(false);
        }
        return;
      }

      if (activeAutoEventSpot) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advanceAutoEventOverlay();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeAutoEventOverlay();
        }
        return;
      }

      if (gatheringTutorialOpen) {
        if (e.repeat) return;
        if (isGatheringTutorialChoiceStep && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          playCursorSound();
          setSelectedGatheringTutorialChoice(prev => prev === 'logging' ? 'mining' : 'logging');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isGatheringTutorialChoiceStep) {
            chooseGatheringTutorial(selectedGatheringTutorialChoice);
          } else {
            advanceGatheringTutorial();
          }
          return;
        }
        return;
      }

      if (loggingTutorialOpen) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playCursorSound();
          setSelectedLoggingTutorialAction(e.key === 'ArrowLeft' ? 'later' : 'next');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (selectedLoggingTutorialAction === 'later') {
            playFixSound();
            stopLoggingTutorialVoice();
            setLoggingTutorialOpen(false);
          } else {
            advanceLoggingTutorial();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          stopLoggingTutorialVoice();
          setLoggingTutorialOpen(false);
          return;
        }
        return;
      }

      if (fishingTutorialOpen) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playCursorSound();
          setSelectedFishingTutorialAction(e.key === 'ArrowLeft' ? 'later' : 'next');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (selectedFishingTutorialAction === 'later') {
            playFixSound();
            stopFishingTutorialVoice();
            setFishingTutorialOpen(false);
          } else {
            advanceFishingTutorial();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          stopFishingTutorialVoice();
          setFishingTutorialOpen(false);
          return;
        }
        return;
      }

      if (fishingTutorialEndingOpen) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advanceFishingTutorialEnding();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeFishingTutorialEnding();
          return;
        }
        return;
      }

      if (sawCraftTutorialIntroOpen) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advanceSawCraftTutorialIntro();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          moveToSawCraftTutorialShed();
          return;
        }
        return;
      }

      if (sawCraftTutorialShedDialogueOpen) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          advanceSawCraftTutorialShedDialogue();
        }
        return;
      }

      if (kurumiIntroOpen) {
        if (kurumiIntroClosing) {
          e.preventDefault();
          return;
        }
        if (e.repeat) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          playCursorSound();
          setKurumiIntroSelectedIndex(prev => {
            const choiceCount = KURUMI_INTRO_TOPICS.length + 1;
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            return (prev + delta + choiceCount) % choiceCount;
          });
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleKurumiIntroChoice();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeKurumiIntro();
          return;
        }
        return;
      }

      if (kurumiShopOpen) {
        if (e.repeat) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          setKurumiShopOpen(false);
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          playCursorSound();
          if (selectedShopControl === 'close') {
            setSelectedShopControl('action');
          } else if (selectedShopControl === 'action') {
            setSelectedShopControl(e.key === 'ArrowUp' ? 'close' : 'items');
          } else {
            setSelectedShopItemIndex(prev => {
              const currentType = shopItemsForDisplay[prev]?.type ?? '買う';
              const sameTypeItems = shopItemsForDisplay
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.type === currentType);
              const currentColumnIndex = Math.max(0, sameTypeItems.findIndex(({ index }) => index === prev));
              const delta = e.key === 'ArrowDown' ? 1 : -1;
              return sameTypeItems[(currentColumnIndex + delta + sameTypeItems.length) % sameTypeItems.length]?.index ?? prev;
            });
          }
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playCursorSound();
          if (selectedShopControl === 'close') {
            setSelectedShopControl('action');
          } else if (selectedShopControl === 'action') {
            if (e.key === 'ArrowRight') {
              setSelectedShopControl('close');
            } else {
              const sellIndex = shopItemsForDisplay.findIndex(item => item.type === '売る');
              if (sellIndex >= 0) setSelectedShopItemIndex(sellIndex);
              setSelectedShopControl('items');
            }
          } else {
            const currentType = shopItemsForDisplay[selectedShopItemIndex]?.type ?? '買う';
            if (e.key === 'ArrowRight' && currentType === '買う') {
              const sellIndex = shopItemsForDisplay.findIndex(item => item.type === '売る');
              if (sellIndex >= 0) setSelectedShopItemIndex(sellIndex);
            } else if (e.key === 'ArrowRight') {
              setSelectedShopControl('action');
            } else if (e.key === 'ArrowLeft' && currentType === '売る') {
              const buyIndex = shopItemsForDisplay.findIndex(item => item.type === '買う');
              if (buyIndex >= 0) setSelectedShopItemIndex(buyIndex);
            } else {
              setSelectedShopControl('action');
            }
          }
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (selectedShopControl === 'close') {
            handleShopCloseClick();
          } else if (selectedShopControl === 'action') {
            handleShopActionClick();
          } else {
            playFixSound();
            setSelectedShopControl('action');
          }
          return;
        }
        return;
      }

      if (fishingMiniGameOpen) {
        if (e.repeat) return;
        if (fishingMiniGameStage === 'result' && isFishingResultInputLocked) {
          e.preventDefault();
          return;
        }
        if (fishingMiniGameStage === 'result' && isFishingTutorialRun) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            playCursorSound();
            setSelectedFishingResultAction(e.key === 'ArrowLeft' ? 'retry' : 'complete');
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (selectedFishingResultAction === 'retry') {
              retryFishingTutorial();
            } else {
              completeFishingTutorial();
            }
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            completeFishingTutorial();
            return;
          }
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleFishingMiniGameAction();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          finishFishingMiniGame();
          return;
        }
        return;
      }

      if (sleepPromptVisible || craftPromptVisible || fishingPromptVisible || loggingPromptVisible) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playCursorSound();
          setConfirmPromptChoice(prev => prev === 'yes' ? 'no' : 'yes');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playFixSound();
          if (sleepPromptVisible) {
            if (confirmPromptChoice === 'yes') {
              startSleepSequence();
            } else {
              cancelSleepPrompt();
            }
          } else if (craftPromptVisible) {
            if (confirmPromptChoice === 'yes') {
              startCraftPrompt();
            } else {
              cancelCraftPrompt();
            }
          } else if (fishingPromptVisible) {
            if (confirmPromptChoice === 'yes') {
              startFishingPrompt();
            } else {
              cancelFishingPrompt();
            }
          } else if (confirmPromptChoice === 'yes') {
            startLoggingMiniGame();
          } else {
            cancelLoggingPrompt();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          if (sleepPromptVisible) {
            cancelSleepPrompt();
          } else if (craftPromptVisible) {
            cancelCraftPrompt();
          } else if (fishingPromptVisible) {
            cancelFishingPrompt();
          } else {
            cancelLoggingPrompt();
          }
          return;
        }
        return;
      }

      if (!menuOpenRef.current && setupMode === 'none' && (e.key === 'Enter' || e.key === ' ')) {
        const playerPos = posRef.current;
        if (activeMiningPointId) {
          e.preventDefault();
          const depletedKey = `${timeOfDay}_${activeMiningPointId}`;
          const minedCountThisTimeSlot = Object.keys(depletedMiningPointIds).filter(key => (
            key.startsWith(`${timeOfDay}_`) && depletedMiningPointIds[key]
          )).length;
          if (depletedMiningPointIds[depletedKey]) {
            setDialogMessage('この採掘ポイントは、この時間帯にはもう採掘済みです。');
          } else if (minedCountThisTimeSlot >= TEMP_MINING_LIMIT_PER_TIME_SLOT) {
            setDialogMessage(`この時間帯に採掘できるのは${TEMP_MINING_LIMIT_PER_TIME_SLOT}回までです。`);
          } else {
            grantMiningReward(activeMiningPointId);
          }
          return;
        }
        if (shouldShowFishingTutorialKurumi) {
          if (isNearFishingTutorialKurumi(playerPos)) {
            e.preventDefault();
            openFishingTutorial();
            return;
          }
        }
        if (sawCraftTutorialReady && currentMapRef.current === 'shed' && isNearSawCraftTutorialKurumi(playerPos)) {
          e.preventDefault();
          playFixSound();
          openSawCraftTutorialShedDialogue();
          return;
        }
        const currentKurumi = zones.find(zone => (
          zone.type === 'kurumi' &&
          !sawCraftTutorialReady &&
          (!zone.map || zone.map === currentMapRef.current) &&
          isAnimZoneVisibleAtTime(zone, timeOfDay)
        ));
        if (currentKurumi) {
          const kurumiCenterX = currentKurumi.x + currentKurumi.w / 2;
          const kurumiCenterY = currentKurumi.y + currentKurumi.h / 2;
          const dx = playerPos.x - kurumiCenterX;
          const dy = playerPos.y - kurumiCenterY;
          if (Math.sqrt(dx * dx + dy * dy) <= KURUMI_INTERACT_DISTANCE) {
            e.preventDefault();
            playFixSound();
            startKurumiInteraction();
            return;
          }
        }
        const currentSpots = inspectSpotsRef.current.filter(spot => spot.map === currentMapRef.current && !spot.autoTrigger);
        const foundSpot = currentSpots.find(spot => (
          playerPos.x + 18 >= spot.x &&
          playerPos.x - 18 <= spot.x + spot.w &&
          playerPos.y >= spot.y &&
          playerPos.y - 34 <= spot.y + spot.h
        ));
        if (foundSpot) {
          e.preventDefault();
          clickTargetRef.current = null;
          setClickTargetMarker(null);
          setDialogMessage(foundSpot.text || foundSpot.label);
          setShowDialog(true);
        }
      }

      // RPGメニュー操作
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        playFixSound();
        setMenuOpen(prev => !prev);
        setMenuSelectedIndex(0);
        setMenuFocusArea('nav');
      }
      // メニューが開いているときのナビゲーション
      if (menuOpenRef.current) {
        if (e.repeat) return;
        const currentMenuItem: { id: string; label: string; icon: string } = MENU_ITEMS[menuSelectedIndexRef.current] ?? MENU_ITEMS[0];
        const moveBy = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const itemByTab = createItemMenuItems(inventoryCounts);
        const getOwnedMenuItems = (items: string[]) => items.filter(name => (inventoryCounts[name] ?? 0) > 0);
        const moveGridIndex = (currentIndex: number, key: string, columns: number, length: number) => {
          if (key === 'ArrowLeft') return currentIndex % columns === 0 ? currentIndex : currentIndex - 1;
          if (key === 'ArrowRight') return currentIndex % columns === columns - 1 || currentIndex + 1 >= length ? currentIndex : currentIndex + 1;
          if (key === 'ArrowUp') return Math.max(0, currentIndex - columns);
          if (key === 'ArrowDown') return Math.min(length - 1, currentIndex + columns);
          return currentIndex;
        };

        if (menuFocusAreaRef.current === 'nav' && e.key === 'ArrowUp') {
          e.preventDefault();
          playCursorSound();
          setMenuSelectedIndex(prev => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
        } else if (menuFocusAreaRef.current === 'nav' && e.key === 'ArrowDown') {
          e.preventDefault();
          playCursorSound();
          setMenuSelectedIndex(prev => (prev + 1) % MENU_ITEMS.length);
        } else if (menuFocusAreaRef.current === 'nav' && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          playFixSound();
          setMenuFocusArea('content');
          setMenuContentFocus('primary');
        } else if (menuFocusAreaRef.current === 'content' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          playCursorSound();

          if (currentMenuItem.id === 'item') {
            const tabs = Object.keys(itemByTab);
            const tabIndex = Math.max(0, tabs.indexOf(itemMenuTabRef.current));
            const currentItems = getOwnedMenuItems(itemByTab[itemMenuTabRef.current] ?? itemByTab['消耗品']);
            const currentIndex = Math.max(0, currentItems.indexOf(selectedItemNameRef.current));

            if (menuContentFocusRef.current === 'primary') {
              if (e.key === 'ArrowLeft') {
                setMenuFocusArea('nav');
              } else if (e.key === 'ArrowRight') {
                setMenuContentFocus('secondary');
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const nextTab = tabs[Math.max(0, Math.min(tabs.length - 1, tabIndex + (e.key === 'ArrowDown' ? 1 : -1)))];
                setItemMenuTab(nextTab);
                setSelectedItemName(getOwnedMenuItems(itemByTab[nextTab])[0] ?? '');
              }
              return;
            }

            if (currentItems.length === 0) {
              setMenuContentFocus('primary');
              return;
            }
            if (e.key === 'ArrowLeft' && currentIndex % 2 === 0) {
              setMenuContentFocus('primary');
              return;
            }
            setSelectedItemName(currentItems[moveGridIndex(currentIndex, e.key, 2, currentItems.length)]);
            return;
          }

          if (currentMenuItem.id === 'status') {
            const skillNodesForKeys = [
              '農具の扱い', '連続耕し', '収穫効率', '水やり上手', '豊作の勘',
              '採取上手', '釣り勘', '足取り軽快', '洞窟慣れ', '滝裏探索',
              '交渉術', '防衛指揮', '威圧耐性', '罠の知識', '守りの采配',
            ];
            const skillIndex = Math.max(0, skillNodesForKeys.indexOf(selectedSkillNameRef.current));
            if (e.key === 'ArrowLeft' && skillIndex < 5) {
              setMenuFocusArea('nav');
              return;
            }
            setMenuContentFocus('primary');
            setSelectedSkillName(skillNodesForKeys[moveGridIndex(skillIndex, e.key, 5, skillNodesForKeys.length)]);
            return;
          }

          if (currentMenuItem.id === 'zukan') {
            const filters = ['通常', '魚', '妊娠', 'レアリティ', '未入手'];
            const filterIndex = Math.max(0, filters.indexOf(zukanFilterRef.current));
            if (menuContentFocusRef.current === 'primary') {
              if (e.key === 'ArrowLeft' && filterIndex === 0) {
                setMenuFocusArea('nav');
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                const nextFilter = filters[Math.max(0, Math.min(filters.length - 1, filterIndex + (e.key === 'ArrowRight' ? 1 : -1)))];
                setZukanFilter(nextFilter);
                setSelectedZukanIndex(0);
              } else if (e.key === 'ArrowDown') {
                setMenuContentFocus('secondary');
              }
              return;
            }

            const currentIndex = selectedZukanIndexRef.current;
            const zukanLength = zukanFilterRef.current === '魚' ? FISH_ZUKAN_ENTRIES.length : 15;
            const zukanColumnCount = 5;
            if (e.key === 'ArrowUp' && currentIndex < zukanColumnCount) {
              setMenuContentFocus('primary');
              return;
            }
            if (e.key === 'ArrowLeft' && currentIndex % zukanColumnCount === 0) {
              setMenuContentFocus('primary');
              return;
            }
            setSelectedZukanIndex(moveGridIndex(currentIndex, e.key, zukanColumnCount, zukanLength));
            return;
          }

          if (currentMenuItem.id === 'item') {
            const tabs = Object.keys(itemByTab);
            const currentItems = getOwnedMenuItems(itemByTab[itemMenuTabRef.current] ?? itemByTab['消耗品']);
            const currentIndex = Math.max(0, currentItems.indexOf(selectedItemNameRef.current));
            if (currentItems.length === 0) {
              setMenuContentFocus('primary');
              return;
            }
            if (e.key === 'ArrowLeft' && currentIndex % 2 === 0) {
              const tabIndex = Math.max(0, tabs.indexOf(itemMenuTabRef.current));
              if (tabIndex === 0) {
                setMenuFocusArea('nav');
              } else {
                const nextTab = tabs[tabIndex - 1];
                setItemMenuTab(nextTab);
                setSelectedItemName(getOwnedMenuItems(itemByTab[nextTab])[0] ?? '');
              }
              return;
            }
            if (e.key === 'ArrowRight' && currentIndex % 2 === 1) {
              const tabIndex = Math.max(0, tabs.indexOf(itemMenuTabRef.current));
              const nextTab = tabs[Math.min(tabs.length - 1, tabIndex + 1)];
              setItemMenuTab(nextTab);
              setSelectedItemName(getOwnedMenuItems(itemByTab[nextTab])[0] ?? '');
              return;
            }
            setSelectedItemName(currentItems[moveGridIndex(currentIndex, e.key, 2, currentItems.length)]);
            return;
          }

          if (currentMenuItem.id === 'equipment') {
            const equipmentLabels = ['主人公', 'ちびいち'];
            const currentIndex = Math.max(0, equipmentLabels.findIndex(label => selectedEquipmentSlotRef.current.startsWith(label)));
            const slotCounts: Record<string, number> = { '主人公': 4, 'ちびいち': 2 };
            const currentLabel = equipmentLabels[currentIndex];
            const currentSlotMatch = /slot(\d+)$/.exec(selectedEquipmentSlotRef.current);
            const currentSlotIndex = Math.max(0, Math.min((slotCounts[currentLabel] ?? 2) - 1, currentSlotMatch ? Number(currentSlotMatch[1]) - 1 : 0));
            const currentSlot = `slot${currentSlotIndex + 1}`;
            const slotLabelsByCharacter: Record<string, string[]> = {
              '主人公': ['釣具系', '採取道具系', '採取道具系', 'アクセサリー'],
              'ちびいち': ['slot1', 'slot2'],
            };
            const optionsBySlot: Record<string, string[]> = {
              '釣具系': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿'],
              '採取道具系': ['のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし'],
              'アクセサリー': ['農神の指輪', FISHING_NUSHI_RING_NAME, FISHING_NUSHI_DEBUG_RING_NAME],
              'slot1': ['小さな鈴'],
              'slot2': [],
            };
            const currentSlotLabel = slotLabelsByCharacter[currentLabel]?.[currentSlotIndex] ?? currentSlot;
            const currentEquippedItem = equippedItems[selectedEquipmentSlotRef.current] || '';
            const equippedItemNames = Object.entries(equippedItems)
              .filter(([slotId, name]) => slotId !== selectedEquipmentSlotRef.current && Boolean(name))
              .map(([, name]) => name);
            const currentEquipableItems = (optionsBySlot[currentSlotLabel] ?? []).filter(name => (
              (inventoryCounts[name] ?? 0) > 0 && !equippedItemNames.includes(name)
            ));
            if (equipmentActionOpen && menuContentFocusRef.current === 'secondary') {
              if (!currentEquippedItem && currentEquipableItems.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                setSelectedEquipmentOptionIndex(prev => {
                  const clampedPrev = Math.max(0, Math.min(currentEquipableItems.length - 1, prev));
                  if (e.key === 'ArrowLeft' && clampedPrev % 2 === 0) {
                    setEquipmentActionOpen(false);
                    return clampedPrev;
                  }
                  const moveBy = e.key === 'ArrowDown' ? 2 : e.key === 'ArrowUp' ? -2 : e.key === 'ArrowRight' ? 1 : -1;
                  return Math.max(0, Math.min(currentEquipableItems.length - 1, clampedPrev + moveBy));
                });
              } else if (e.key === 'ArrowLeft') {
                setEquipmentActionOpen(false);
              }
              return;
            }
            if (menuContentFocusRef.current === 'primary') {
              if (e.key === 'ArrowLeft' && currentIndex === 0) {
                setMenuFocusArea('nav');
                return;
              }
              if (e.key === 'ArrowDown') {
                setMenuContentFocus('secondary');
                setSelectedEquipmentSlot(`${equipmentLabels[currentIndex]}-${currentSlot}`);
                return;
              }
              const nextIndex = e.key === 'ArrowRight' ? Math.min(equipmentLabels.length - 1, currentIndex + 1) : e.key === 'ArrowLeft' ? Math.max(0, currentIndex - 1) : currentIndex;
              setSelectedEquipmentSlot(`${equipmentLabels[nextIndex]}-slot1`);
              return;
            }

            if (e.key === 'ArrowUp') {
              setMenuContentFocus('primary');
              return;
            }
            if (e.key === 'ArrowLeft' && currentSlotIndex === 0) {
              setMenuContentFocus('primary');
              return;
            }
            const slotCount = slotCounts[currentLabel] ?? 2;
            const nextSlotIndex = e.key === 'ArrowRight'
              ? Math.min(slotCount - 1, currentSlotIndex + 1)
              : e.key === 'ArrowLeft'
                ? Math.max(0, currentSlotIndex - 1)
                : e.key === 'ArrowDown'
                  ? Math.min(slotCount - 1, currentSlotIndex + 2)
                  : currentSlotIndex;
            const nextSlot = `slot${nextSlotIndex + 1}`;
            setSelectedEquipmentSlot(`${equipmentLabels[currentIndex]}-${nextSlot}`);
            return;
          }

          if (currentMenuItem.id === 'status') {
            const currentIndex = selectedStatusGirlIndexRef.current;
            if (e.key === 'ArrowLeft' && currentIndex % 3 === 0) {
              setMenuFocusArea('nav');
              return;
            }
            setSelectedStatusGirlIndex(moveGridIndex(currentIndex, e.key, 3, 15));
            return;
          }

          if (currentMenuItem.id === 'farm') {
            const facilityCount = 8;
            if (menuContentFocusRef.current === 'primary') {
              const currentIndex = selectedFarmFacilityIndexRef.current;
              if (e.key === 'ArrowLeft') {
                setMenuFocusArea('nav');
              } else if (e.key === 'ArrowRight') {
                setMenuContentFocus('secondary');
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                setSelectedFarmFacilityIndex(Math.max(0, Math.min(facilityCount - 1, currentIndex + (e.key === 'ArrowDown' ? 1 : -1))));
              }
              return;
            }

            const currentIndex = selectedFarmGirlIndexRef.current;
            if (e.key === 'ArrowLeft' && currentIndex % 5 === 0) {
              setMenuContentFocus('primary');
              return;
            }
            setSelectedFarmGirlIndex(moveGridIndex(currentIndex, e.key, 5, 15));
            return;
          }

          if (currentMenuItem.id === 'zukan') {
            const currentIndex = selectedZukanIndexRef.current;
            const zukanLength = zukanFilterRef.current === '魚' ? FISH_ZUKAN_ENTRIES.length : 15;
            const zukanColumnCount = 5;
            if (e.key === 'ArrowLeft' && currentIndex % zukanColumnCount === 0) {
              setMenuFocusArea('nav');
              return;
            }
            setSelectedZukanIndex(moveGridIndex(currentIndex, e.key, zukanColumnCount, zukanLength));
            return;
          }

          if (currentMenuItem.id === 'system') {
            const actions = ['セーブ', 'ロード', 'タイトルへ戻る'];
            const currentIndex = selectedSystemActionIndexRef.current;
            if (e.key === 'ArrowLeft' && currentIndex === 0) {
              setMenuFocusArea('nav');
              return;
            }
            const nextIndex = e.key === 'ArrowRight' ? Math.min(actions.length - 1, currentIndex + 1) : e.key === 'ArrowLeft' ? Math.max(0, currentIndex - 1) : currentIndex;
            setSelectedSystemActionIndex(nextIndex);
            setSystemNotice(`${actions[nextIndex]}を選択しました。`);
            return;
          }

          if (currentMenuItem.id === 'item') {
            const itemByTab = createItemMenuItems(inventoryCounts);
            const getOwnedMenuItems = (items: string[]) => items.filter(name => (inventoryCounts[name] ?? 0) > 0);
            setSelectedItemName(prev => {
              const currentItems = getOwnedMenuItems(itemByTab[itemMenuTabRef.current] ?? itemByTab['消耗品']);
              if (currentItems.length === 0) return '';
              const currentIndex = Math.max(0, currentItems.indexOf(prev));
              return currentItems[(currentIndex + moveBy + currentItems.length) % currentItems.length];
            });
          } else if (currentMenuItem.id === 'equipment') {
            const equipmentLabels = ['主人公', 'ちびいち'];
            const currentIndex = Math.max(0, equipmentLabels.findIndex(label => selectedEquipmentSlotRef.current.startsWith(label)));
            const nextLabel = equipmentLabels[(currentIndex + moveBy + equipmentLabels.length) % equipmentLabels.length];
            setSelectedEquipmentSlot(`${nextLabel}-slot1`);
          } else if (currentMenuItem.id === 'status') {
            setSelectedStatusGirlIndex(prev => (prev + moveBy + 15) % 15);
          } else if (currentMenuItem.id === 'farm') {
            setSelectedFarmGirlIndex(prev => (prev + moveBy + 15) % 15);
          } else if (currentMenuItem.id === 'zukan') {
            const zukanLength = zukanFilterRef.current === '魚' ? FISH_ZUKAN_ENTRIES.length : 15;
            setSelectedZukanIndex(prev => (prev + moveBy + zukanLength) % zukanLength);
          } else if (currentMenuItem.id === 'system') {
            const actions = ['セーブ', 'ロード', 'タイトルへ戻る'];
            const currentIndex = actions.findIndex(action => systemNoticeRef.current.includes(action));
            const nextAction = actions[((currentIndex >= 0 ? currentIndex : 0) + moveBy + actions.length) % actions.length];
            setSystemNotice(`${nextAction}を選択しました。`);
          }
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playFixSound();
          if (currentMenuItem.id === 'farm') {
            if (menuContentFocusRef.current === 'primary') {
              const farmInfoItems = [
                ['現在金利', formatInterestRate(currentWeeklyInterestRate)],
                ['農場信用度', `${farmCredit}`],
                ['信用補正', `-${formatInterestRate(farmCreditInterestDiscount)}`],
                ['返済遅延補正', `+${formatInterestRate(missedRepaymentPenalty)}`],
                ['次回返済まで', `あと${daysUntilRepayment}日`],
                ['借金残額', `¥${debtAmount.toLocaleString()}`],
                ['経過日数', `${currentDay} 日`],
                ['設備', '柵 Lv1'],
                ['設備', '電気柵 未設置'],
                ['設備', '箱罠 x2'],
              ];
              const selectedInfo = farmInfoItems[selectedFarmFacilityIndexRef.current];
              if (selectedInfo) setDialogMessage(`${selectedInfo[0]}: ${selectedInfo[1]}`);
            } else {
              const selectedName = menuGirls[selectedFarmGirlIndexRef.current]?.name;
              if (selectedName) setDialogMessage(`${selectedName}の詳細情報を表示しました。`);
            }
          } else if (currentMenuItem.id === 'item') {
            if (craftRecipeSelectMode && itemMenuTabRef.current === 'だいじなもの') {
              handleCraftRecipeSelected(selectedItemNameRef.current);
            } else {
              openRecipeDetail(selectedItemNameRef.current);
              setDialogMessage(`${selectedItemNameRef.current}を確認しました。`);
            }
          } else if (currentMenuItem.id === 'equipment') {
            if (!equipmentActionOpen) {
              setMenuContentFocus('secondary');
              setEquipmentActionOpen(true);
              return;
            }
            const equipmentLabels = ['主人公', 'ちびいち'];
            const currentIndex = Math.max(0, equipmentLabels.findIndex(label => selectedEquipmentSlotRef.current.startsWith(label)));
            const currentLabel = equipmentLabels[currentIndex];
            const currentSlotMatch = /slot(\d+)$/.exec(selectedEquipmentSlotRef.current);
            const currentSlotIndex = Math.max(0, currentSlotMatch ? Number(currentSlotMatch[1]) - 1 : 0);
            const slotLabelsByCharacter: Record<string, string[]> = {
              '主人公': ['釣具系', '採取道具系', '採取道具系', 'アクセサリー'],
              'ちびいち': ['slot1', 'slot2'],
            };
            const optionsBySlot: Record<string, string[]> = {
              '釣具系': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿'],
              '採取道具系': ['のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし'],
              'アクセサリー': ['農神の指輪', FISHING_NUSHI_RING_NAME, FISHING_NUSHI_DEBUG_RING_NAME],
              'slot1': ['小さな鈴'],
              'slot2': [],
            };
            const currentSlotLabel = slotLabelsByCharacter[currentLabel]?.[currentSlotIndex] ?? `slot${currentSlotIndex + 1}`;
            const currentEquippedItem = equippedItems[selectedEquipmentSlotRef.current] || '';
            if (currentEquippedItem) {
              setEquippedItems(prev => ({ ...prev, [selectedEquipmentSlotRef.current]: '' }));
              setDialogMessage(`${currentEquippedItem}を外しました。`);
              return;
            }
            const equippedItemNames = Object.entries(equippedItems)
              .filter(([slotId, name]) => slotId !== selectedEquipmentSlotRef.current && Boolean(name))
              .map(([, name]) => name);
            const equipableItems = (optionsBySlot[currentSlotLabel] ?? []).filter(name => (
              (inventoryCounts[name] ?? 0) > 0 && !equippedItemNames.includes(name)
            ));
            const nextItem = equipableItems[Math.max(0, Math.min(equipableItems.length - 1, selectedEquipmentOptionIndexRef.current))];
            if (nextItem) {
              setEquippedItems(prev => ({ ...prev, [selectedEquipmentSlotRef.current]: nextItem }));
              setDialogMessage(`${nextItem}を装備しました。`);
            } else {
              setDialogMessage('装備できるアイテムがありません。');
            }
          } else if (currentMenuItem.id === 'status') {
            setDialogMessage(`${selectedSkillNameRef.current}を確認しました。`);
          } else if (currentMenuItem.id === 'zukan') {
            if (zukanFilterRef.current === '魚') {
              const fish = FISH_ZUKAN_ENTRIES[selectedZukanIndexRef.current];
              const caught = fish ? caughtFishIds.includes(fish.id) : false;
              setDialogMessage(caught && fish ? `${fish.name}を確認しました。` : 'まだ釣っていない魚です。');
            } else {
              setDialogMessage(`No.${selectedZukanIndexRef.current + 1}を確認しました。`);
            }
	          } else if (currentMenuItem.id === 'system') {
	            const actions = ['セーブ', 'ロード', 'タイトルへ戻る'];
	            const action = actions[selectedSystemActionIndexRef.current] ?? actions[0];
	            setSystemNotice(`${action}を選択しました。`);
	            setDialogMessage(`${action}を選択しました。`);
	            if (action === 'セーブ') {
	              setSystemSlotMode('save');
	            } else if (action === 'ロード') {
	              setSystemSlotMode('load');
	            } else {
	              returnToTitle();
	            }
	          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          if (currentMenuItem.id === 'equipment' && equipmentActionOpen) {
            setEquipmentActionOpen(false);
            return;
          }
          if (menuFocusAreaRef.current === 'content') {
            if (menuContentFocusRef.current === 'secondary') {
              setMenuContentFocus('primary');
              return;
            }
            setMenuFocusArea('nav');
            return;
          }
          clickTargetRef.current = null;
          setClickTargetMarker(null);
          setCraftRecipeSelectMode(false);
          setMenuOpen(false);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      keys.current[e.key] = false; 
      if (e.key.length === 1) keys.current[e.key.toLowerCase()] = false; 
      if (fishingMiniGameOpen && fishingMiniGameStage === 'keep' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        releaseFishingKeepPress();
        return;
      }
      
      const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 's', 'a', 'd', 'q', 'e', ' '];
      if (gameKeys.includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrameId: number;

    // 初期位置が衝突しているかチェックし、最も近い安全な場所にずらす
    const getSafeSpawnPosition = (startX: number, startY: number) => {
      const isPositionColliding = (x: number, y: number) => {
        const minGridX = Math.floor((x - 15) / TILE_SIZE);
        const maxGridX = Math.floor((x + 15) / TILE_SIZE);
        const minGridY = Math.floor((y - 10) / TILE_SIZE);
        const maxGridY = Math.floor(y / TILE_SIZE);

        for (let gx = minGridX; gx <= maxGridX; gx++) {
          for (let gy = minGridY; gy <= maxGridY; gy++) {
            if (obstaclesRef.current[`${currentMapRef.current}_${gx},${gy}`]) {
              return true;
            }
          }
        }
        return false;
      };

      if (!isPositionColliding(startX, startY)) {
        return { x: startX, y: startY };
      }

      // 螺旋状に一番近い安全なマスを探索
      for (let r = 1; r < 30; r++) {
         for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
               if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
               const px = startX + dx * TILE_SIZE;
               const py = startY + dy * TILE_SIZE;
               
               if (px >= 30 && px <= GAME_WIDTH - 30 && py >= 50 && py <= GAME_HEIGHT - 10) {
                  if (!isPositionColliding(px, py)) {
                     return { x: px, y: py };
                  }
               }
            }
         }
      }
      return { x: startX, y: startY };
    };

    const safePos = getSafeSpawnPosition(pos.x, pos.y);
    let currentX = safePos.x; 
    let currentY = safePos.y; 
    let currentDir = dir;

    // 衝突を回避した場合、posステートも安全な位置に更新
    if (safePos.x !== pos.x || safePos.y !== pos.y) {
       setPos(safePos);
    }

    // Door SFX
    const playDoorSound = () => {
      try {
        const audio = new Audio('/se/door.mp3');
        audio.volume = getEffectiveVolume('/se/door.mp3', seVolumeRef.current, audioGainsRef.current);
        void audio.play();
      } catch (e) {
        console.error(e);
      }
    };

    const playWallBumpSound = () => {
      const sound = WALL_BUMP_SOUNDS[wallBumpSoundRef.current];
      if (!sound.src) return;

      const now = performance.now();
      if (now - wallBumpLastPlayedRef.current < 260) return;
      wallBumpLastPlayedRef.current = now;

      try {
        const audio = new Audio(sound.src);
        audio.volume = getEffectiveVolume(sound.src, seVolumeRef.current, audioGainsRef.current);
        audio.playbackRate = wallBumpSoundRef.current === 'door' ? 1.25 : 2.0;
        void audio.play();
      } catch (e) {
        console.error(e);
      }
    };

    const checkCollision = (x: number, y: number) => {
      // プレイヤーの足元の判定矩形 [x - 15, x + 15] x [y - 10, y]
      const pLeft = x - 15;
      const pRight = x + 15;
      const pTop = y - 10;
      const pBottom = y;

      if (currentMapRef.current === 'shed' && (sawCraftTutorialReady || sawCraftTutorialWorkbenchReady)) {
        const kurumiLeft = CRAFT_TUTORIAL_KURUMI_ZONE.x;
        const kurumiRight = kurumiLeft + CRAFT_TUTORIAL_KURUMI_ZONE.w;
        const kurumiTop = CRAFT_TUTORIAL_KURUMI_ZONE.y + CRAFT_TUTORIAL_KURUMI_ZONE.h * 0.55;
        const kurumiBottom = CRAFT_TUTORIAL_KURUMI_ZONE.y + CRAFT_TUTORIAL_KURUMI_ZONE.h;

        if (
          pRight >= kurumiLeft &&
          pLeft <= kurumiRight &&
          pBottom >= kurumiTop &&
          pTop <= kurumiBottom
        ) {
          return true;
        }
      }

      if (currentMapRef.current === 'farm' && timeOfDay === 'night') {
        const kurumiZone = zones.find(zone => zone.type === 'kurumi' && (!zone.map || zone.map === 'farm'));
        if (kurumiZone) {
          const zoneSpriteW = Math.max(8, kurumiZone.spriteW ?? kurumiZone.w);
          const zoneSpriteH = Math.max(8, kurumiZone.spriteH ?? kurumiZone.h);
          const tentContainerWidth = (
            zoneSpriteW >= kurumiZone.w
              ? Math.min(KURUMI_DEFAULT_SPRITE_W, Math.max(8, kurumiZone.w))
              : zoneSpriteW
          ) * 2;
          const tentContainerHeight = (
            zoneSpriteH >= kurumiZone.h
              ? Math.min(KURUMI_DEFAULT_SPRITE_H, Math.max(8, kurumiZone.h))
              : zoneSpriteH
          ) * 2;
          const tentRenderedSize = Math.min(tentContainerWidth, tentContainerHeight);
          const tentWidth = tentRenderedSize * 0.82;
          const tentHeight = tentRenderedSize * 0.35;
          const tentCenterX = kurumiZone.x + kurumiZone.w / 2;
          const tentCenterY = kurumiZone.y + kurumiZone.h / 2 + tentRenderedSize * 0.12;
          const tentLeft = tentCenterX - tentWidth / 2;
          const tentRight = tentCenterX + tentWidth / 2;
          const tentTop = tentCenterY - tentHeight / 2;
          const tentBottom = tentCenterY + tentHeight / 2;

          if (
            pRight >= tentLeft &&
            pLeft <= tentRight &&
            pBottom >= tentTop &&
            pTop <= tentBottom
          ) {
            return true;
          }
        }
      }

      const doorPadding = 8;
      const isOnDoor = doorsRef.current
        .filter(d => d.map === currentMapRef.current)
        .some(d => (
          pRight >= d.x - doorPadding &&
          pLeft <= d.x + d.w + doorPadding &&
          pBottom >= d.y - doorPadding &&
          pTop <= d.y + d.h + doorPadding
        ));

      if (isOnDoor) return false;

      const minGridX = Math.floor((x - 15) / TILE_SIZE);
      const maxGridX = Math.floor((x + 15) / TILE_SIZE);
      const minGridY = Math.floor((y - 10) / TILE_SIZE);
      const maxGridY = Math.floor(y / TILE_SIZE);

      for (let gx = minGridX; gx <= maxGridX; gx++) {
        for (let gy = minGridY; gy <= maxGridY; gy++) {
          if (obstaclesRef.current[`${currentMapRef.current}_${gx},${gy}`]) {
            return true;
          }
        }
      }
      return false;
    };

    const isTouchingBed = (x: number, y: number) => {
      if (currentMapRef.current !== 'house') return false;

      const pLeft = x - 15;
      const pRight = x + 15;
      const pTop = y - 10;
      const pBottom = y;

      const minGridX = Math.floor(pLeft / TILE_SIZE);
      const maxGridX = Math.floor(pRight / TILE_SIZE);
      const minGridY = Math.floor(pTop / TILE_SIZE);
      const maxGridY = Math.floor(pBottom / TILE_SIZE);

      for (let gx = minGridX; gx <= maxGridX; gx++) {
        for (let gy = minGridY; gy <= maxGridY; gy++) {
          if (bedTiles[`house_${gx},${gy}`]) return true;
        }
      }
      return false;
    };

    const isTouchingWorkbench = (x: number, y: number) => {
      const pLeft = x - 15;
      const pRight = x + 15;
      const pTop = y - 10;
      const pBottom = y;

      const minGridX = Math.floor(pLeft / TILE_SIZE);
      const maxGridX = Math.floor(pRight / TILE_SIZE);
      const minGridY = Math.floor(pTop / TILE_SIZE);
      const maxGridY = Math.floor(pBottom / TILE_SIZE);

      for (let gx = minGridX; gx <= maxGridX; gx++) {
        for (let gy = minGridY; gy <= maxGridY; gy++) {
          if (workbenchTiles[`${currentMapRef.current}_${gx},${gy}`]) return true;
        }
      }
      return false;
    };

    const isTouchingFishingPoint = (x: number, y: number) => {
      const pLeft = x - 15;
      const pRight = x + 15;
      const pTop = y - 10;
      const pBottom = y;

      const minGridX = Math.floor(pLeft / TILE_SIZE);
      const maxGridX = Math.floor(pRight / TILE_SIZE);
      const minGridY = Math.floor(pTop / TILE_SIZE);
      const maxGridY = Math.floor(pBottom / TILE_SIZE);

      for (let gx = minGridX; gx <= maxGridX; gx++) {
        for (let gy = minGridY; gy <= maxGridY; gy++) {
          if (fishingTiles[`${currentMapRef.current}_${gx},${gy}`]) return true;
        }
      }
      return false;
    };

    const getTouchingMiningPointId = (x: number, y: number) => {
      const minGridX = Math.floor((x - 15) / TILE_SIZE);
      const maxGridX = Math.floor((x + 15) / TILE_SIZE);
      const minGridY = Math.floor((y - 10) / TILE_SIZE);
      const maxGridY = Math.floor(y / TILE_SIZE);
      for (let gx = minGridX; gx <= maxGridX; gx++) {
        for (let gy = minGridY; gy <= maxGridY; gy++) {
          const pointId = `${currentMapRef.current}_${gx},${gy}`;
          if (miningTiles[pointId]) return pointId;
        }
      }
      return null;
    };

    const gameLoop = () => {
      if (setupMode !== 'none') return; // Pause movement in setup menu

      if (menuOpenRef.current) {
        setIsWalking(false);
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      if (movementLockedRef.current) {
        setIsWalking(false);
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

      let moved = false;
      let newDir = currentDir;
      const startX = currentX;
      const startY = currentY;
      let nx = currentX; let ny = currentY;

      const keyPressed =
        keys.current['ArrowUp'] || keys.current['w'] ||
        keys.current['ArrowDown'] || keys.current['s'] ||
        keys.current['ArrowLeft'] || keys.current['a'] || keys.current['q'] ||
        keys.current['ArrowRight'] || keys.current['d'] || keys.current['e'];

      if (keyPressed) {
        // キー入力があればクリック移動をキャンセル
        clickTargetRef.current = null;
        setClickTargetMarker(null);
      }

      if (keys.current['ArrowUp'] || keys.current['w']) { ny -= SPEED; newDir = 'up'; moved = true; }
      if (keys.current['ArrowDown'] || keys.current['s']) { ny += SPEED; newDir = 'down'; moved = true; }
      if (keys.current['ArrowLeft'] || keys.current['a'] || keys.current['q']) { nx -= SPEED; newDir = 'left'; moved = true; }
      if (keys.current['ArrowRight'] || keys.current['d'] || keys.current['e']) { nx += SPEED; newDir = 'right'; moved = true; }

      // クリック移動（キー入力がないときのみ）
      if (!moved && clickTargetRef.current) {
        const target = clickTargetRef.current;
        const dx = target.x - currentX;
        const dy = target.y - currentY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= SPEED) {
          // 目標に到達
          nx = target.x;
          ny = target.y;
          clickTargetRef.current = null;
          setClickTargetMarker(null);
          moved = dist > 1;
        } else {
          // 目標に向かって SPEED 分だけ移動
          nx = currentX + (dx / dist) * SPEED;
          ny = currentY + (dy / dist) * SPEED;
          moved = true;
        }

        // 移動方向からキャラクターの向きを決定
        if (moved) {
          if (Math.abs(dx) > Math.abs(dy)) {
            newDir = dx > 0 ? 'right' : 'left';
          } else {
            newDir = dy > 0 ? 'down' : 'up';
          }
        }
      }

      if (moved) {
        nx = Math.max(30, Math.min(nx, GAME_WIDTH - 30));
        ny = Math.max(50, Math.min(ny, GAME_HEIGHT - 10));
        
        // 扉（ワープゾーン）衝突判定
        let warped = false;
        const canWarp = performance.now() - lastWarpedAtRef.current >= WARP_COOLDOWN_MS;
        if (canWarp) {
          const currentDoors = doorsRef.current.filter(d => d.map === currentMapRef.current);
          for (const d of currentDoors) {
             // プレイヤーの足元の衝突判定矩形（[x - 15, x + 15] x [y - 10, y]）と扉の矩形（[d.x, d.x + d.w] x [d.y, d.y + d.h]）の交差判定を行います。
             // これにより、扉の手前に衝突判定の壁があっても、プレイヤーが少し重なるだけでワープできるようになります。
             const pLeft = nx - 15;
             const pRight = nx + 15;
             const pTop = ny - 10;
             const pBottom = ny;
             
             if (pRight >= d.x && pLeft <= d.x + d.w && pBottom >= d.y && pTop <= d.y + d.h) {
                lastWarpedAtRef.current = performance.now();
                playDoorSound();
                setCurrentMap(d.targetMap);
                currentMapRef.current = d.targetMap; // 即座にRefも更新し、次フレームの判定ズレを防ぐ
                currentX = d.spawnX;
                currentY = d.spawnY;
                clickTargetRef.current = null; // ワープ後はクリック移動キャンセル
                setClickTargetMarker(null);
                warped = true;
                moved = false; // ワープ後は一旦歩行停止
                break;
             }
          }
        }

        if (!warped) {
           // 衝突判定とスライド移動処理
           if (!checkCollision(nx, ny)) {
             currentX = nx;
             currentY = ny;
           } else {
             if (currentMapRef.current === 'farm') {
               playWallBumpSound();
             }
             // 片方の軸だけ動かして滑らせるスライド判定
             const collisionX = checkCollision(nx, currentY);
             const collisionY = checkCollision(currentX, ny);
             
             if (!collisionX) {
               currentX = nx;
             } else if (!collisionY) {
               currentY = ny;
             } else {
               moved = false; // 両軸ともぶつかったら歩行停止

               
             }
           }
        }
      }
      currentDir = newDir;

      // クリック移動スタック判定（動けない状態が2秒続いたらキャンセル）
      const isPositionChanged = (currentX !== startX || currentY !== startY);
      if (clickTargetRef.current !== null) {
         if (!isPositionChanged) {
            if (stuckStartRef.current === null) {
               stuckStartRef.current = Date.now();
            } else if (Date.now() - stuckStartRef.current >= 2000) {
               clickTargetRef.current = null;
               setClickTargetMarker(null);
               stuckStartRef.current = null;
               moved = false;
            }
         } else {
            stuckStartRef.current = null;
         }
      } else {
         stuckStartRef.current = null;
      }

      const isInBed = isTouchingBed(currentX, currentY);
      if (!isInBed) {
        sleepPromptBlockedRef.current = false;
      } else if (!sleepPromptBlockedRef.current) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setSleepPromptVisible(true);
        movementLockedRef.current = true;
      }

      const isInWorkbench = isTouchingWorkbench(currentX, currentY);
      if (!isInWorkbench) {
        craftPromptBlockedRef.current = false;
      } else if (!craftPromptBlockedRef.current && !isInBed && !sawCraftTutorialReady && !sawCraftTutorialShedDialogueOpen) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setCraftPromptSource('workbench');
        setCraftPromptVisible(true);
        movementLockedRef.current = true;
      }

      const isAPActionExhausted = timeOfDay === 'night' && currentAP <= 0;
      const isInFishingPoint = isTouchingFishingPoint(currentX, currentY);
      const hasEquippedFishingRod = Boolean(equippedItems['主人公-slot1'] && equippedItems['主人公-slot1'].includes('釣竿'));
      if (!isInFishingPoint) {
        fishingPromptBlockedRef.current = false;
      } else if (!fishingPromptBlockedRef.current && !isInBed && !isInWorkbench && hasEquippedFishingRod && !isAPActionExhausted) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setFishingPromptVisible(true);
        movementLockedRef.current = true;
      }

      const miningPointId = getTouchingMiningPointId(currentX, currentY);
      const canInspectMiningPoint = Boolean(
        miningPointId &&
        !isInBed &&
        !isInWorkbench &&
        !isInFishingPoint &&
        !isAPActionExhausted
      );
      setActiveMiningPointId(canInspectMiningPoint ? miningPointId : null);

      const touchedLoggingPoint = activeLoggingPoints.find(point => (
        point.map === currentMapRef.current &&
        currentX + 18 >= point.x &&
        currentX - 18 <= point.x + point.w &&
        currentY >= point.y &&
        currentY - 34 <= point.y + point.h
      ));
      if (!touchedLoggingPoint) {
        setActiveLoggingPointId(null);
        loggingPromptBlockedRef.current = false;
      } else if (!loggingPromptBlockedRef.current && !loggingPromptVisible && !isInBed && !isInWorkbench && !isInFishingPoint && !isAPActionExhausted) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setActiveLoggingPointId(touchedLoggingPoint.id);
        setLoggingPromptVisible(true);
        movementLockedRef.current = true;
      }

      const currentAutoEventSpots = inspectSpotsRef.current.filter(spot => (
        spot.autoTrigger &&
        spot.map === currentMapRef.current &&
        currentX + 18 >= spot.x &&
        currentX - 18 <= spot.x + spot.w &&
        currentY >= spot.y &&
        currentY - 34 <= spot.y + spot.h
      ));
      const currentAutoEventIds = new Set(currentAutoEventSpots.map(spot => spot.id));
      triggeredAutoEventIdsRef.current.forEach(id => {
        if (!currentAutoEventIds.has(id)) triggeredAutoEventIdsRef.current.delete(id);
      });
      const nextAutoEvent = currentAutoEventSpots.find(spot => !triggeredAutoEventIdsRef.current.has(spot.id));
      if (nextAutoEvent) {
        triggerAutoEventSpot(nextAutoEvent);
      }

      setPos({ x: currentX, y: currentY });
      setDir(currentDir);
      setIsWalking(moved);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    if (setupMode === 'none') {
       animationFrameId = requestAnimationFrame(gameLoop);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [setupMode, bedTiles, workbenchTiles, fishingTiles, miningTiles, depletedMiningPointIds, activeMiningPointId, loggingTiles, activeLoggingPoints, activeLoggingPointId, sleepPromptVisible, craftPromptVisible, fishingPromptVisible, loggingPromptVisible, confirmPromptChoice, pendingDeleteSaveSlot, pendingOverwriteSaveSlot, activeAutoEventSpot, activeAutoEventMessage, activeAutoEventMessageIndex, activeAutoEventMessages, displayedAutoEventMessage, turn, currentAP, kurumiShopOpen, kurumiIntroOpen, kurumiIntroSelectedIndex, kurumiIntroAskedTopics, kurumiIntroCompletedDay, selectedShopControl, selectedShopItemIndex, shopItems, gold, equipmentActionOpen, equippedItems, inventoryCounts, caughtFishIds, fishingMiniGameOpen, fishingMiniGameStage, isFishingResultInputLocked, fishingTutorialOpen, fishingTutorialEndingOpen, fishingTutorialEndingStepIndex, sawCraftTutorialIntroOpen, sawCraftTutorialIntroStepIndex, sawCraftTutorialReady, sawCraftTutorialShedDialogueOpen, sawCraftTutorialWorkbenchReady, selectedFishingTutorialAction, selectedFishingResultAction, recipeDetailOpen, farmGirlDetailOpen, bootMode, timeOfDay]);

  // Zone creation states
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number, y: number } | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [resizingZoneId, setResizingZoneId] = useState<string | null>(null);
  const zoneDragStart = useRef({ x: 0, y: 0 });
  const zoneDragStartRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleMapPointerDown = (e: React.PointerEvent) => {
     if (suppressNextMapPointerRef.current) {
        suppressNextMapPointerRef.current = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        return;
     }
     e.currentTarget.setPointerCapture(e.pointerId);
     const rect = e.currentTarget.getBoundingClientRect();
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;

     if (setupMode === 'animation') {
        setDragStart({ x: clickX, y: clickY });
        setDragCurrent({ x: clickX, y: clickY });
     } else if (setupMode === 'collision') {
        const gx = Math.floor(clickX / TILE_SIZE);
        const gy = Math.floor(clickY / TILE_SIZE);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
           const isRightButton = e.button === 2 || (e.buttons & 2) === 2;
           const drawMode: CollisionDrawMode = e.shiftKey || isRightButton ? 'erase' : selectedCollisionDrawMode;
           const willBeObstacle = drawMode === 'paint';
           setIsDrawing(willBeObstacle);
           setDragStart({ x: clickX, y: clickY });
           setDragCurrent({ x: clickX, y: clickY });
           lastCollisionPaintPoint.current = { x: clickX, y: clickY };
           paintCollisionBrush(clickX, clickY, drawMode);
        }
     } else if (setupMode === 'hideArea') {
        const gx = Math.floor(clickX / TILE_SIZE);
        const gy = Math.floor(clickY / TILE_SIZE);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
           const drawMode: HideAreaDrawMode = e.shiftKey ? 'erase' : selectedHideAreaDrawMode;
           hideAreaDrawModeRef.current = drawMode;
           setDragStart({ x: clickX, y: clickY });
           setDragCurrent({ x: clickX, y: clickY });
           lastHideAreaPaintPoint.current = { x: clickX, y: clickY };
           paintHideAreaBrush(clickX, clickY, drawMode);
        }
     } else if (setupMode === 'footstep') {
        const gx = Math.floor(clickX / TILE_SIZE);
        const gy = Math.floor(clickY / TILE_SIZE);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
           const key = `${currentMap}_${gx},${gy}`;
           const drawMode = selectedFootstepSound === 'erase' || footstepTiles[key] === selectedFootstepSound
              ? 'erase'
              : selectedFootstepSound;
           setFootstepDrawMode(drawMode);
           paintFootstepTile(clickX, clickY, drawMode);
        }
     } else if (setupMode === 'bed') {
        if (selectedEventTileType === 'inspect' || selectedEventTileType === 'auto') {
           const gx = Math.floor(clickX / 20) * 20;
           const gy = Math.floor(clickY / 20) * 20;
           const isAutoEvent = selectedEventTileType === 'auto';
           const newId = `${isAutoEvent ? 'auto_event' : 'inspect'}_${Date.now()}`;
           setInspectSpots(prev => ([
             ...prev,
             {
               id: newId,
               map: currentMap,
               x: gx,
               y: gy,
               w: 100,
               h: 70,
               label: isAutoEvent ? '自動イベント' : '調べる',
               text: isAutoEvent ? 'イベントが発生しました。' : 'ここを調べた。',
               autoTrigger: isAutoEvent,
             },
           ]));
           setSelectedInspectSpotId(newId);
           return;
        }
        if (selectedEventTileType === 'bed' && currentMap !== 'house') return;
        const gx = Math.floor(clickX / TILE_SIZE);
        const gy = Math.floor(clickY / TILE_SIZE);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
           const key = selectedEventTileType === 'bed' ? `house_${gx},${gy}` : `${currentMap}_${gx},${gy}`;
           const currentTiles = selectedEventTileType === 'bed'
              ? bedTiles
              : selectedEventTileType === 'workbench'
                 ? workbenchTiles
                 : selectedEventTileType === 'fishing'
                    ? fishingTiles
                    : selectedEventTileType === 'mining'
                       ? miningTiles
                       : loggingTiles;
           const drawMode = !currentTiles[key];
           setBedDrawMode(drawMode);
           if (selectedEventTileType === 'bed') {
              paintBedTile(clickX, clickY, drawMode);
           } else if (selectedEventTileType === 'workbench') {
              paintWorkbenchTile(clickX, clickY, drawMode);
           } else if (selectedEventTileType === 'fishing') {
              paintFishingTile(clickX, clickY, drawMode);
           } else if (selectedEventTileType === 'mining') {
              paintMiningTile(clickX, clickY, drawMode);
           } else {
              paintLoggingTile(clickX, clickY, drawMode);
           }
        }
     } else if (setupMode === 'bathTub') {
        if (currentMap !== 'house') return;
        const gx = Math.floor(clickX / TILE_SIZE);
        const gy = Math.floor(clickY / TILE_SIZE);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
           const isRightButton = e.button === 2 || (e.buttons & 2) === 2;
           const drawMode: HideAreaDrawMode = e.shiftKey || isRightButton ? 'erase' : selectedBathTubMaskDrawMode;
           bathTubMaskDrawModeRef.current = drawMode;
           setDragStart({ x: clickX, y: clickY });
           setDragCurrent({ x: clickX, y: clickY });
           lastBathTubMaskPaintPoint.current = { x: clickX, y: clickY };
           paintBathTubMaskBrush(clickX, clickY, drawMode);
        }
     } else if (setupMode === 'doors') {
        // Create new door where clicked
        const gx = Math.floor(clickX / 20) * 20; // snap to 20px
        const gy = Math.floor(clickY / 20) * 20;
        const newId = `door_${Date.now()}`;
        setDoors(prev => {
           const next = [...prev, { id: newId, map: currentMap, targetMap: 'farm', x: gx, y: gy, w: 60, h: 60, spawnX: 960, spawnY: 900 }];
           return next;
        });
        setSelectedDoorId(newId);
     } else {
        // 通常プレイ中: クリック移動の目標を設定
        clickTargetRef.current = { x: clickX, y: clickY };
        setClickTargetMarker({ x: clickX, y: clickY });
     }
  };
  const handleMapPointerMove = (e: React.PointerEvent) => {
     const rect = e.currentTarget.getBoundingClientRect();
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;

     if (setupMode === 'animation' && dragStart) {
        setDragCurrent({ x: clickX, y: clickY });
     } else if (setupMode === 'collision' && isDrawing !== null) {
        const drawMode: CollisionDrawMode = (e.buttons & 2) === 2 ? 'erase' : isDrawing ? 'paint' : 'erase';
        setDragCurrent({ x: clickX, y: clickY });
        paintCollisionBrush(
           clickX,
           clickY,
           drawMode,
           lastCollisionPaintPoint.current
        );
        lastCollisionPaintPoint.current = { x: clickX, y: clickY };
     } else if (setupMode === 'hideArea' && hideAreaDrawModeRef.current) {
        setDragCurrent({ x: clickX, y: clickY });
        paintHideAreaBrush(
           clickX,
           clickY,
           hideAreaDrawModeRef.current,
           lastHideAreaPaintPoint.current
        );
        lastHideAreaPaintPoint.current = { x: clickX, y: clickY };
     } else if (setupMode === 'bathTub' && bathTubMaskDrawModeRef.current) {
        if (currentMap !== 'house') return;
        setDragCurrent({ x: clickX, y: clickY });
        paintBathTubMaskBrush(
           clickX,
           clickY,
           bathTubMaskDrawModeRef.current,
           lastBathTubMaskPaintPoint.current
        );
        lastBathTubMaskPaintPoint.current = { x: clickX, y: clickY };
     } else if (setupMode === 'footstep' && footstepDrawMode) {
        paintFootstepTile(clickX, clickY, footstepDrawMode);
     } else if (setupMode === 'bed' && bedDrawMode !== null) {
        if (selectedEventTileType === 'bed' && currentMap === 'house') {
           paintBedTile(clickX, clickY, bedDrawMode);
        } else if (selectedEventTileType === 'workbench') {
           paintWorkbenchTile(clickX, clickY, bedDrawMode);
        } else if (selectedEventTileType === 'fishing') {
           paintFishingTile(clickX, clickY, bedDrawMode);
        } else if (selectedEventTileType === 'mining') {
           paintMiningTile(clickX, clickY, bedDrawMode);
        } else if (selectedEventTileType === 'logging') {
           paintLoggingTile(clickX, clickY, bedDrawMode);
        }
     }
  };

  const handleZoneDragStart = (e: React.PointerEvent, zoneId: string) => {
     e.stopPropagation();
     setSelectedZoneId(zoneId);

     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();

     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     const zone = zones.find(z => z.id === zoneId);
     if (!zone) return;
     if (zone.spriteW === undefined || zone.spriteH === undefined) {
        setZones(prev => prev.map(z => z.id === zoneId ? ensureAnimZoneSpriteSize(z) : z));
     }

     setDraggingZoneId(zoneId);
     zoneDragStart.current = { x: clickX, y: clickY };
     zoneDragStartRect.current = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
     setDragStart(null);
     setDragCurrent(null);
  };

  const handleZoneResizeStart = (e: React.PointerEvent, zoneId: string) => {
     e.stopPropagation();
     setSelectedZoneId(zoneId);

     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();

     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     const zone = zones.find(z => z.id === zoneId);
     if (!zone) return;
     if (zone.spriteW === undefined || zone.spriteH === undefined) {
        setZones(prev => prev.map(z => z.id === zoneId ? ensureAnimZoneSpriteSize(z) : z));
     }

     setResizingZoneId(zoneId);
     zoneDragStart.current = { x: clickX, y: clickY };
     zoneDragStartRect.current = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
     setDragStart(null);
     setDragCurrent(null);
  };

  useEffect(() => {
     if (!draggingZoneId && !resizingZoneId) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rect = mapElement.getBoundingClientRect();

        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        const dx = currentX - zoneDragStart.current.x;
        const dy = currentY - zoneDragStart.current.y;

        if (draggingZoneId) {
           setZones(prev => prev.map(z => {
              if (z.id !== draggingZoneId) return z;
              const maxX = Math.max(0, GAME_WIDTH - zoneDragStartRect.current.w);
              const maxY = Math.max(0, GAME_HEIGHT - zoneDragStartRect.current.h);
              return {
                 ...z,
                 x: Math.round(Math.max(0, Math.min(zoneDragStartRect.current.x + dx, maxX))),
                 y: Math.round(Math.max(0, Math.min(zoneDragStartRect.current.y + dy, maxY))),
              };
           }));
        } else if (resizingZoneId) {
           setZones(prev => prev.map(z => {
              if (z.id !== resizingZoneId) return z;
              const newW = Math.max(20, Math.round(zoneDragStartRect.current.w + dx));
              const newH = Math.max(20, Math.round(zoneDragStartRect.current.h + dy));
              return {
                 ...z,
                 w: Math.min(newW, GAME_WIDTH - z.x),
                 h: Math.min(newH, GAME_HEIGHT - z.y),
              };
           }));
        }
     };

     const handlePointerUp = () => {
        setDraggingZoneId(null);
        setResizingZoneId(null);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [draggingZoneId, resizingZoneId, scale]);

  const handleDebugDragStart = (e: React.PointerEvent) => {
     e.stopPropagation();
     setIsDraggingDebug(true);
     const rect = e.currentTarget.parentElement?.getBoundingClientRect();
     if (rect) {
        debugDragStart.current = {
           x: (e.clientX - rect.left) / scale,
           y: (e.clientY - rect.top) / scale
        };
     }
  };

  const handleFieldCornerDragStart = (e: React.PointerEvent, fieldId: FieldId, corner: FieldCornerKey) => {
     e.stopPropagation();
     setDraggingFieldCorner({ fieldId, corner });
  };

  useEffect(() => {
     if (!isDraggingDebug) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (mapElement) {
           const rect = mapElement.getBoundingClientRect();
           const x = (e.clientX - rect.left) / scale - debugDragStart.current.x;
           const y = (e.clientY - rect.top) / scale - debugDragStart.current.y;
           
           // Keep inside map bounds
           setDebugPanelPos({
              x: Math.max(0, Math.min(x, 1920 - DEBUG_PANEL_WIDTH)),
              y: Math.max(0, Math.min(y, 1080 - 160))
           });
        }
     };

     const stopDebugDragging = () => {
        setIsDraggingDebug(false);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', stopDebugDragging, true);
     window.addEventListener('pointercancel', stopDebugDragging, true);
     window.addEventListener('blur', stopDebugDragging);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', stopDebugDragging, true);
        window.removeEventListener('pointercancel', stopDebugDragging, true);
        window.removeEventListener('blur', stopDebugDragging);
     };
  }, [isDraggingDebug, scale]);

  const handleDialogDragStart = (e: React.PointerEvent) => {
     const target = e.target as HTMLElement;
     if (target.closest('button, input, select, textarea, label')) return;

     e.stopPropagation();
     setIsDraggingDialog(true);
     const rect = e.currentTarget.parentElement?.getBoundingClientRect();
     if (rect) {
        dialogDragStart.current = {
           x: (e.clientX - rect.left) / scale,
           y: (e.clientY - rect.top) / scale
        };
        dialogDragStartPos.current = dialogBoxPos;
     }
  };

  useEffect(() => {
     if (!isDraggingDialog) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rootElement = mapElement.parentElement;
        if (!rootElement) return;
        const rect = rootElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        const dx = x - dialogDragStart.current.x;
        const dy = y - dialogDragStart.current.y;

        setDialogBoxPos({
           x: Math.max(0, Math.min(dialogDragStartPos.current.x + dx, GAME_WIDTH - dialogBoxSize.width)),
           y: Math.max(0, Math.min(dialogDragStartPos.current.y + dy, 1156 - dialogBoxSize.height))
        });
     };

     const handlePointerUp = () => {
        setIsDraggingDialog(false);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [isDraggingDialog, scale, dialogBoxSize]);

  const handleDialogResizeStart = (e: React.PointerEvent) => {
     e.stopPropagation();
     setIsResizingDialog(true);
     const mapElement = document.querySelector('.cursor-crosshair');
     const rootElement = mapElement?.parentElement;
     const rect = rootElement?.getBoundingClientRect();
     if (rect) {
        dialogResizeStart.current = {
           x: (e.clientX - rect.left) / scale,
           y: (e.clientY - rect.top) / scale
        };
        dialogResizeStartSize.current = dialogBoxSize;
     }
  };

  useEffect(() => {
     if (!isResizingDialog) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rootElement = mapElement.parentElement;
        if (!rootElement) return;
        const rect = rootElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        const dx = x - dialogResizeStart.current.x;
        const dy = y - dialogResizeStart.current.y;

        setDialogBoxSize({
           width: Math.max(DIALOG_BOX_MIN_WIDTH, Math.min(dialogResizeStartSize.current.width + dx, GAME_WIDTH - dialogBoxPos.x)),
           height: Math.max(DIALOG_BOX_MIN_HEIGHT, Math.min(dialogResizeStartSize.current.height + dy, Math.min(DIALOG_BOX_MAX_HEIGHT, 1156 - dialogBoxPos.y)))
        });
     };

     const handlePointerUp = () => {
        setIsResizingDialog(false);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [isResizingDialog, scale, dialogBoxPos]);

  useEffect(() => {
     if (!draggingFieldCorner) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rect = mapElement.getBoundingClientRect();
        const x = Math.max(0, Math.min((e.clientX - rect.left) / scale, GAME_WIDTH));
        const y = Math.max(0, Math.min((e.clientY - rect.top) / scale, GAME_HEIGHT));

        setFieldCorners(prev => {
           const next: FieldCornerMap = {
              ...prev,
              [draggingFieldCorner.fieldId]: {
                 ...prev[draggingFieldCorner.fieldId],
                 [draggingFieldCorner.corner]: { x: Math.round(x), y: Math.round(y) },
              },
           };
           saveFieldCorners(next);
           return next;
        });
     };

     const handlePointerUp = () => {
        setDraggingFieldCorner(null);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [draggingFieldCorner, scale]);

  // プレイヤーのドラッグ開始
  const handlePlayerDragStart = (e: React.PointerEvent) => {
     e.stopPropagation();
     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     
     setIsDraggingPlayer(true);
     playerDragStart.current = { x: clickX, y: clickY };
     playerDragStartPos.current = { x: pos.x, y: pos.y };
  };

  // 扉のドラッグ開始
  const handleDoorDragStart = (e: React.PointerEvent, doorId: string) => {
     e.stopPropagation();
     setSelectedDoorId(doorId);
     
     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     
     const door = doors.find(d => d.id === doorId);
     if (!door) return;
     
     setDraggingDoorId(doorId);
     doorDragStart.current = { x: clickX, y: clickY };
     doorDragStartRect.current = { x: door.x, y: door.y, w: door.w, h: door.h };
  };

  // 扉のリサイズ開始
  const handleDoorResizeStart = (e: React.PointerEvent, doorId: string) => {
     e.stopPropagation();
     
     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     
     const door = doors.find(d => d.id === doorId);
     if (!door) return;
     
     setResizingDoorId(doorId);
     doorDragStart.current = { x: clickX, y: clickY };
     doorDragStartRect.current = { x: door.x, y: door.y, w: door.w, h: door.h };
  };

  // 出現位置（スタート場所）のドラッグ開始
  const handleSpawnDragStart = (e: React.PointerEvent, doorId: string) => {
     e.stopPropagation();
     
     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     
     const door = doors.find(d => d.id === doorId);
     if (!door) return;
     
     setDraggingSpawnDoorId(doorId);
     spawnDragStart.current = { x: clickX, y: clickY };
     spawnDragStartPos.current = { x: door.spawnX, y: door.spawnY };
  };

  const handleInspectSpotDragStart = (e: React.PointerEvent, spotId: string) => {
     e.stopPropagation();
     setSelectedInspectSpotId(spotId);

     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     const spot = inspectSpots.find(s => s.id === spotId);
     if (!spot) return;

     setDraggingInspectSpotId(spotId);
     inspectSpotDragStart.current = { x: clickX, y: clickY };
     inspectSpotStartRect.current = { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
  };

  const handleInspectSpotResizeStart = (e: React.PointerEvent, spotId: string) => {
     e.stopPropagation();
     setSelectedInspectSpotId(spotId);

     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     const clickX = (e.clientX - rect.left) / scale;
     const clickY = (e.clientY - rect.top) / scale;
     const spot = inspectSpots.find(s => s.id === spotId);
     if (!spot) return;

     setResizingInspectSpotId(spotId);
     inspectSpotDragStart.current = { x: clickX, y: clickY };
     inspectSpotStartRect.current = { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
  };

  const handleBathTubMaskDragStart = (e: React.PointerEvent) => {
     e.stopPropagation();
     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     bathTubMaskDragStart.current = {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
     };
     bathTubMaskStartRect.current = bathTubMaskZone;
     setDraggingBathTubMask(true);
  };

  const handleBathTubMaskResizeStart = (e: React.PointerEvent) => {
     e.stopPropagation();
     const mapElement = document.querySelector('.cursor-crosshair');
     if (!mapElement) return;
     const rect = mapElement.getBoundingClientRect();
     bathTubMaskDragStart.current = {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
     };
     bathTubMaskStartRect.current = bathTubMaskZone;
     setResizingBathTubMask(true);
  };

  // プレイヤードラッグ用の window イベント処理
  useEffect(() => {
     if (!isDraggingPlayer) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rect = mapElement.getBoundingClientRect();
        
        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        
        const dx = currentX - playerDragStart.current.x;
        const dy = currentY - playerDragStart.current.y;
        
        const newX = Math.max(30, Math.min(playerDragStartPos.current.x + dx, GAME_WIDTH - 30));
        const newY = Math.max(50, Math.min(playerDragStartPos.current.y + dy, GAME_HEIGHT - 10));
        
        setPos({ x: newX, y: newY });
     };

     const handlePointerUp = () => {
        setIsDraggingPlayer(false);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [isDraggingPlayer, scale]);


  // 扉ドラッグ・リサイズ・出現位置ドラッグ用の window イベント処理
  useEffect(() => {
     if (!draggingDoorId && !resizingDoorId && !draggingSpawnDoorId) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rect = mapElement.getBoundingClientRect();
        
        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        
        const dx = currentX - (draggingSpawnDoorId ? spawnDragStart.current.x : doorDragStart.current.x);
        const dy = currentY - (draggingSpawnDoorId ? spawnDragStart.current.y : doorDragStart.current.y);
        
        if (draggingDoorId) {
           const newX = Math.round((doorDragStartRect.current.x + dx) / 10) * 10;
           const newY = Math.round((doorDragStartRect.current.y + dy) / 10) * 10;
           
           setDoors(prev => {
              const next = prev.map(d => d.id === draggingDoorId ? { 
                 ...d, 
                 x: Math.max(0, Math.min(newX, GAME_WIDTH - d.w)),
                 y: Math.max(0, Math.min(newY, GAME_HEIGHT - d.h))
              } : d);
              return next;
           });
        } else if (resizingDoorId) {
           const newW = Math.max(20, Math.round((doorDragStartRect.current.w + dx) / 10) * 10);
           const newH = Math.max(20, Math.round((doorDragStartRect.current.h + dy) / 10) * 10);
           
           setDoors(prev => {
              const next = prev.map(d => d.id === resizingDoorId ? { 
                 ...d, 
                 w: Math.min(newW, GAME_WIDTH - d.x),
                 h: Math.min(newH, GAME_HEIGHT - d.y)
              } : d);
              return next;
           });
        } else if (draggingSpawnDoorId) {
           const newSpawnX = Math.round((spawnDragStartPos.current.x + dx) / 10) * 10;
           const newSpawnY = Math.round((spawnDragStartPos.current.y + dy) / 10) * 10;
           
           setDoors(prev => {
              const next = prev.map(d => d.id === draggingSpawnDoorId ? { 
                 ...d, 
                 spawnX: Math.max(30, Math.min(newSpawnX, GAME_WIDTH - 30)),
                 spawnY: Math.max(50, Math.min(newSpawnY, GAME_HEIGHT - 10))
              } : d);
              return next;
           });
        }
     };

     const handlePointerUp = () => {
        setDraggingDoorId(null);
        setResizingDoorId(null);
        setDraggingSpawnDoorId(null);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [draggingDoorId, resizingDoorId, draggingSpawnDoorId, scale]);

  useEffect(() => {
     if (!draggingInspectSpotId && !resizingInspectSpotId) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rect = mapElement.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        const dx = currentX - inspectSpotDragStart.current.x;
        const dy = currentY - inspectSpotDragStart.current.y;

        if (draggingInspectSpotId) {
           const newX = Math.round((inspectSpotStartRect.current.x + dx) / 10) * 10;
           const newY = Math.round((inspectSpotStartRect.current.y + dy) / 10) * 10;
           setInspectSpots(prev => prev.map(spot => spot.id === draggingInspectSpotId ? {
              ...spot,
              x: Math.max(0, Math.min(newX, GAME_WIDTH - spot.w)),
              y: Math.max(0, Math.min(newY, GAME_HEIGHT - spot.h)),
           } : spot));
        } else if (resizingInspectSpotId) {
           const newW = Math.max(20, Math.round((inspectSpotStartRect.current.w + dx) / 10) * 10);
           const newH = Math.max(20, Math.round((inspectSpotStartRect.current.h + dy) / 10) * 10);
           setInspectSpots(prev => prev.map(spot => spot.id === resizingInspectSpotId ? {
              ...spot,
              w: Math.min(newW, GAME_WIDTH - spot.x),
              h: Math.min(newH, GAME_HEIGHT - spot.y),
           } : spot));
        }
     };

     const handlePointerUp = () => {
        setDraggingInspectSpotId(null);
        setResizingInspectSpotId(null);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [draggingInspectSpotId, resizingInspectSpotId, scale]);

  useEffect(() => {
     if (!draggingBathTubMask && !resizingBathTubMask) return;

     const handlePointerMove = (e: PointerEvent) => {
        const mapElement = document.querySelector('.cursor-crosshair');
        if (!mapElement) return;
        const rect = mapElement.getBoundingClientRect();
        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        const dx = currentX - bathTubMaskDragStart.current.x;
        const dy = currentY - bathTubMaskDragStart.current.y;

        if (draggingBathTubMask) {
           const newX = Math.round((bathTubMaskStartRect.current.x + dx) / 10) * 10;
           const newY = Math.round((bathTubMaskStartRect.current.y + dy) / 10) * 10;
           setBathTubMaskZone(prev => ({
              ...prev,
              x: Math.max(0, Math.min(newX, GAME_WIDTH - prev.w)),
              y: Math.max(0, Math.min(newY, GAME_HEIGHT - prev.h)),
           }));
        } else if (resizingBathTubMask) {
           const newW = Math.max(20, Math.round((bathTubMaskStartRect.current.w + dx) / 10) * 10);
           const newH = Math.max(20, Math.round((bathTubMaskStartRect.current.h + dy) / 10) * 10);
           setBathTubMaskZone(prev => ({
              ...prev,
              w: Math.min(newW, GAME_WIDTH - prev.x),
              h: Math.min(newH, GAME_HEIGHT - prev.y),
           }));
        }
     };

     const handlePointerUp = () => {
        setDraggingBathTubMask(false);
        setResizingBathTubMask(false);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
     };
  }, [draggingBathTubMask, resizingBathTubMask, scale]);

  // zones（アニメ領域）は自動セーブに含まれます

  const handleMapPointerUp = () => {
     if (setupMode === 'animation' && dragStart && dragCurrent) {
        const x = Math.min(dragStart.x, dragCurrent.x);
        const y = Math.min(dragStart.y, dragCurrent.y);
        const w = Math.abs(dragCurrent.x - dragStart.x);
        const h = Math.abs(dragCurrent.y - dragStart.y);
        
        if (w > 10 && h > 10) {
           // window.prompt fails in iframes without certain permissions.
           // Default to 'smoke', users can cycle it by clicking locally later.
           const newId = Date.now().toString();
           setZones(prev => [...prev, { id: newId, x, y, w, h, spriteW: w, spriteH: h, type: 'smoke', map: currentMap, timeOfDays: [timeOfDay] }]);
           setSelectedZoneId(newId);
        }
        setDragStart(null); setDragCurrent(null);
     } else if (setupMode === 'collision') {
        setDragStart(null); setDragCurrent(null);
        lastCollisionPaintPoint.current = null;
     } else if (setupMode === 'hideArea') {
        setDragStart(null); setDragCurrent(null);
        hideAreaDrawModeRef.current = null;
        lastHideAreaPaintPoint.current = null;
     } else if (setupMode === 'bathTub') {
        setDragStart(null); setDragCurrent(null);
        bathTubMaskDrawModeRef.current = null;
        lastBathTubMaskPaintPoint.current = null;
     }
     setIsDrawing(null);
     setFootstepDrawMode(null);
     setBedDrawMode(null);
  }

  const cycleZoneType = (id: string) => {
     setZones(prev => prev.map(z => {
        if (z.id === id) {
           const nextType = z.type === 'smoke' ? 'bird' : z.type === 'bird' ? 'kamo' : z.type === 'kamo' ? 'sagi' : z.type === 'sagi' ? 'water' : z.type === 'water' ? 'waterfall' : z.type === 'waterfall' ? 'iwana' : z.type === 'iwana' ? 'fireplace' : 'smoke';
           return { ...z, type: nextType };
        }
        return z;
     }));
  }

  const handleAnimationZoneClick = (id: string, clickPoint?: { x: number; y: number }) => {
     if (setupMode === 'animation') {
        cycleZoneType(id);
        return;
     }

     const zone = zones.find(z => z.id === id);
     if (!zone || zone.type !== 'kurumi') return;
     if ((zone.map && zone.map !== currentMap) || !isAnimZoneVisibleAtTime(zone, timeOfDay)) return;

     const kurumiCenterX = zone.x + zone.w / 2;
     const kurumiCenterY = zone.y + zone.h / 2;
     const dx = pos.x - kurumiCenterX;
     const dy = pos.y - kurumiCenterY;
     if (Math.sqrt(dx * dx + dy * dy) > KURUMI_INTERACT_DISTANCE) {
        const approachPoint = clickPoint ?? {
           x: kurumiCenterX,
           y: zone.y + zone.h + 36,
        };
        clickTargetRef.current = approachPoint;
        setClickTargetMarker(approachPoint);
        setDialogMessage('くるみの近くまで移動します。');
        return;
     }

     playFixSound();
     startKurumiInteraction();
  };

  const getSlotSummary = (slot: number) => saveSlotSummaries.find(summary => summary.slot === slot);
  const formatSlotSummary = (slot: number) => {
     const summary = getSlotSummary(slot);
     if (!summary?.exists) return '空きスロット';
     const day = summary.day ?? 1;
     const debt = (summary.debt ?? 100000000).toLocaleString();
     const goldText = (summary.gold ?? 0).toLocaleString();
     const ownedGirlCount = summary.ownedGirlCount ?? OPEN_FARM_GIRL_CARD_COUNT;
     return `${day}日目 / 借金 ${debt} G / 所持金 ${goldText} G / 取得娘数 ${ownedGirlCount}人`;
  };
  const formatSlotUpdatedAt = (slot: number) => {
     const summary = getSlotSummary(slot);
     if (!summary?.updatedAt) return '';
     const date = new Date(summary.updatedAt);
     if (Number.isNaN(date.getTime())) return '';
     return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  const selectedRecipeDetail = selectedRecipeName ? RECIPE_DETAILS[selectedRecipeName] : undefined;

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 py-8 overflow-hidden select-none" style={{ fontFamily: '"DotGothic16", sans-serif' }}>
      <div style={{ width: 1920 * scale, height: 1156 * scale, position: 'relative' }}>
        <div className="w-[1920px] bg-[#9bb869] border-[8px] border-[#222] rounded-md flex flex-col relative overflow-hidden shadow-2xl" style={{ height: '1156px', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {bootMode !== 'playing' && (
            <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black">
              <div className="relative aspect-[1672/941] w-full max-h-full overflow-hidden bg-black">
                <img src="/img/titleview.jpg" alt="孕ませ苗床ファーム タイトル" className="absolute inset-0 h-full w-full object-contain" />
                <button
                  type="button"
                  aria-label="はじめから"
                  onClick={() => { playFixSound(); setTitlePanelMode('new'); }}
                  className="absolute left-[12.8%] top-[83.9%] h-[9.6%] w-[22.8%] cursor-pointer rounded opacity-0"
                />
                <button
                  type="button"
                  aria-label="つづきから"
                  onClick={() => { playFixSound(); setTitlePanelMode('load'); }}
                  className="absolute left-[38.4%] top-[83.5%] h-[9.8%] w-[20.5%] cursor-pointer rounded opacity-0"
                />
                <button
                  type="button"
                  aria-label="コンフィグ"
                  onClick={() => { playFixSound(); setTitlePanelMode('config'); }}
                  className="absolute left-[61.2%] top-[83.7%] h-[9.8%] w-[19.4%] cursor-pointer rounded opacity-0"
                />

                {titlePanelMode !== 'none' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/58 px-8">
                    <div className="w-[560px] rounded-lg border-4 border-[#ffd166] bg-[#1a100d]/95 p-6 text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
	                      <div className="mb-5 flex items-center justify-between gap-4">
	                        <div className="text-3xl font-black">
	                          {titlePanelMode === 'new' ? 'はじめから' : titlePanelMode === 'difficulty' ? '難易度選択' : titlePanelMode === 'load' ? 'つづきから' : 'コンフィグ'}
	                        </div>
                        <button
                          type="button"
                          onClick={() => { playFixSound(); setPendingOverwriteSaveSlot(null); setTitlePanelMode('none'); }}
                          className="h-10 w-10 rounded border border-white/40 bg-black/60 text-2xl font-black text-[#fff7dc]"
                          aria-label="閉じる"
                        >
                          ×
                        </button>
                      </div>

	                      {(titlePanelMode === 'new' || titlePanelMode === 'load') && (
                        <div className="grid gap-3">
                          {Array.from({ length: 5 }).map((_, index) => {
                            const slot = index + 1;
                            const summary = getSlotSummary(slot);
                            return (
	                              <div
	                                key={slot}
	                                className="relative"
	                              >
                                  {summary?.exists && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deleteSaveSlot(slot);
                                      }}
                                      className="absolute right-2 top-2 z-10 rounded border border-[#ff9b85]/80 bg-[#5a1f17]/95 px-2 py-1 text-xs font-black text-[#fff7dc] shadow hover:border-white hover:bg-[#8a2f24]"
                                      aria-label={`セーブスロット${slot}を削除`}
                                    >
                                      削除
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => titlePanelMode === 'new' ? startNewGameInSlot(slot) : continueGameFromSlot(slot)}
                                    className="grid w-full gap-1 rounded border-2 border-[#bc6c25] bg-[#2d1b15]/90 px-5 py-3 pr-16 text-left text-[#fdf6e3] hover:border-white hover:bg-[#4a2a1f]"
                                  >
                                    <span className="flex items-center justify-between gap-4 text-xl font-black">
                                      <span>セーブスロット {slot}</span>
                                      <span className="text-sm text-[#dda15e]">{titlePanelMode === 'new' ? '新規開始' : 'ロード'}</span>
                                    </span>
                                    <span className="text-sm font-bold text-[#ffd166]">{formatSlotSummary(slot)}</span>
                                    {formatSlotUpdatedAt(slot) && (
                                      <span className="text-xs font-bold text-[#a3b18a]">更新 {formatSlotUpdatedAt(slot)}</span>
                                    )}
                                  </button>
	                              </div>
                            );
                          })}
                        </div>
	                      )}

	                      {titlePanelMode === 'difficulty' && (
	                        <div className="grid gap-3">
	                          <div className="rounded border border-[#bc6c25]/70 bg-black/35 px-4 py-3 text-sm font-bold text-[#dda15e]">
	                            セーブスロット {pendingNewGameSlot ?? 1} で開始する難易度を選択してください。
	                          </div>
	                          {DIFFICULTY_OPTIONS.map(option => (
	                            <button
	                              key={option.id}
	                              type="button"
	                              onClick={() => startNewGameWithDifficulty(option.id)}
	                              className="grid gap-1 rounded border-2 border-[#bc6c25] bg-[#2d1b15]/90 px-5 py-4 text-left text-[#fdf6e3] hover:border-white hover:bg-[#4a2a1f]"
	                            >
	                              <span className="text-2xl font-black">{option.label}</span>
	                              <span className="text-base font-bold text-[#ffd166]">{option.desc}</span>
	                            </button>
	                          ))}
	                        </div>
	                      )}

	                      {titlePanelMode === 'config' && (
                        <div className="grid gap-5">
                          {[
                            { label: 'BGM', value: bgmVolume, setValue: setBgmVolume },
                            { label: 'SE', value: seVolume, setValue: setSeVolume },
                            { label: 'VOICE', value: voiceVolume, setValue: setVoiceVolume },
                          ].map(({ label, value, setValue }) => (
                            <label key={label} className="grid gap-2">
                              <div className="flex items-center justify-between text-lg font-black">
                                <span>{label}</span>
                                <span className="text-[#ffd166]">{Math.round(value * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(value * 100)}
                                onChange={(event) => setValue(Number(event.target.value) / 100)}
                                className="farm-volume-slider w-full cursor-pointer"
                              />
                            </label>
                          ))}
                        </div>
                      )}

                      {bootMode === 'loadingSave' && (
                        <div className="mt-4 rounded bg-black/40 px-4 py-2 text-center text-sm font-bold text-[#ffd166]">ロード中...</div>
                      )}
                    </div>
                  </div>
                )}
	              </div>
	            </div>
	          )}
	          {bootMode === 'playing' && systemSlotMode !== 'none' && (
	            <div className="absolute inset-0 z-[310] flex items-center justify-center bg-black/62 px-8">
	              <div className="w-[680px] rounded-lg border-4 border-[#ffd166] bg-[#1a100d]/96 p-6 text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
	                <div className="mb-5 flex items-center justify-between gap-4">
	                  <div>
	                    <div className="text-3xl font-black">{systemSlotMode === 'save' ? 'セーブ' : 'ロード'}</div>
	                    <div className="mt-1 text-sm font-bold text-[#dda15e]">
	                      {systemSlotMode === 'save' ? '保存先のスロットを選択してください。' : '読み込むスロットを選択してください。'}
	                    </div>
	                  </div>
	                  <button
	                    type="button"
	                    onClick={() => { playFixSound(); setSystemSlotMode('none'); }}
	                    className="h-10 w-10 rounded border border-white/40 bg-black/60 text-2xl font-black text-[#fff7dc]"
	                    aria-label="閉じる"
	                  >
	                    ×
	                  </button>
	                </div>
	                <div className="grid gap-3">
	                  {Array.from({ length: 5 }).map((_, index) => {
	                    const slot = index + 1;
	                    const summary = getSlotSummary(slot);
	                    const disabled = systemSlotMode === 'load' && !summary?.exists;
	                    return (
	                      <div
	                        key={slot}
                          className="relative"
	                      >
                          {summary?.exists && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteSaveSlot(slot);
                              }}
                              className="absolute right-2 top-2 z-10 rounded border border-[#ff9b85]/80 bg-[#5a1f17]/95 px-2 py-1 text-xs font-black text-[#fff7dc] shadow hover:border-white hover:bg-[#8a2f24]"
                              aria-label={`セーブスロット${slot}を削除`}
                            >
                              削除
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => systemSlotMode === 'save' ? saveGameToSlot(slot) : loadGameFromSystemSlot(slot)}
                            className={`grid w-full gap-1 rounded border-2 px-5 py-3 pr-16 text-left ${
                              disabled
                                ? 'cursor-not-allowed border-[#5a3010] bg-black/45 text-[#8a7060]'
                                : 'border-[#bc6c25] bg-[#2d1b15]/90 text-[#fdf6e3] hover:border-white hover:bg-[#4a2a1f]'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-4 text-xl font-black">
                              <span>セーブスロット {slot}</span>
                              <span className="text-sm text-[#dda15e]">{systemSlotMode === 'save' ? 'ここに保存' : 'ロード'}</span>
                            </span>
                            <span className="text-sm font-bold text-[#ffd166]">{formatSlotSummary(slot)}</span>
                            {formatSlotUpdatedAt(slot) && (
                              <span className="text-xs font-bold text-[#a3b18a]">更新 {formatSlotUpdatedAt(slot)}</span>
                            )}
                          </button>
	                      </div>
	                    );
	                  })}
	                </div>
	              </div>
	            </div>
	          )}

          {pendingDeleteSaveSlot !== null && (
            <div className="absolute inset-0 z-[360] flex items-center justify-center bg-black/60 px-8">
              <div className="w-[440px] rounded-xl border-4 border-[#ff9b85] bg-[#1a100d]/96 p-6 text-center text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
                <div className="text-2xl font-black">本当に削除しますか？</div>
                <div className="mt-3 text-base font-bold leading-relaxed text-[#ffd166]">
                  セーブスロット {pendingDeleteSaveSlot} のデータを削除します。
                </div>
                <div className="mt-6 flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => { playFixSound(); confirmDeleteSaveSlot(); }}
                    onMouseEnter={() => {
                      if (confirmPromptChoice !== 'yes') playCursorSound();
                      setConfirmPromptChoice('yes');
                    }}
                    className={`h-[52px] w-[128px] rounded-lg border-2 bg-[#4a5823] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#60732d] ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                  >
                    はい
                  </button>
                  <button
                    type="button"
                    onClick={() => { playFixSound(); cancelDeleteSaveSlot(); }}
                    onMouseEnter={() => {
                      if (confirmPromptChoice !== 'no') playCursorSound();
                      setConfirmPromptChoice('no');
                    }}
                    className={`h-[52px] w-[128px] rounded-lg border-2 bg-[#5a2a1f] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#753527] ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                  >
                    いいえ
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingOverwriteSaveSlot !== null && (
            <div className="absolute inset-0 z-[360] flex items-center justify-center bg-black/60 px-8">
              <div className="w-[460px] rounded-xl border-4 border-[#ffd166] bg-[#1a100d]/96 p-6 text-center text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
                <div className="text-2xl font-black">セーブデータを上書きしますか？</div>
                <div className="mt-3 text-base font-bold leading-relaxed text-[#ffd166]">
                  セーブスロット {pendingOverwriteSaveSlot} には既存データがあります。<br />
                  はじめから開始すると、このスロットに上書きされます。
                </div>
                <div className="mt-6 flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={confirmOverwriteSaveSlot}
                    onMouseEnter={() => {
                      if (confirmPromptChoice !== 'yes') playCursorSound();
                      setConfirmPromptChoice('yes');
                    }}
                    className={`h-[52px] w-[128px] rounded-lg border-2 bg-[#4a5823] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#60732d] ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                  >
                    はい
                  </button>
                  <button
                    type="button"
                    onClick={cancelOverwriteSaveSlot}
                    onMouseEnter={() => {
                      if (confirmPromptChoice !== 'no') playCursorSound();
                      setConfirmPromptChoice('no');
                    }}
                    className={`h-[52px] w-[128px] rounded-lg border-2 bg-[#5a2a1f] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#753527] ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                  >
                    いいえ
                  </button>
                </div>
              </div>
            </div>
          )}

          {missingSaveSlot !== null && (
            <div className="absolute inset-0 z-[370] flex items-center justify-center bg-black/60 px-8">
              <div className="w-[420px] rounded-xl border-4 border-[#ffd166] bg-[#1a100d]/96 p-6 text-center text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
                <div className="text-2xl font-black">データがありません</div>
                <div className="mt-3 text-base font-bold text-[#ffd166]">
                  セーブスロット {missingSaveSlot} にセーブデータがありません。
                </div>
                <button
                  type="button"
                  onClick={() => { playFixSound(); setMissingSaveSlot(null); }}
                  className="mt-6 h-[52px] w-[128px] rounded-lg border-2 border-[#a3b18a] bg-[#4a5823] text-lg font-black text-[#fff7dc] transition-colors hover:border-white hover:bg-[#60732d]"
                >
                  OK
                </button>
              </div>
            </div>
          )}
	          
	        {/* Header UI */}
        <div className="h-[74px] bg-[#2d1b15] border-b-[4px] border-[#bc6c25] flex items-center justify-between px-6 z-40 text-[#fdf6e3]">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-lg">
              <span className="flex items-center gap-2">
                <span className="text-[#a3b18a] text-sm mt-1">DAY</span> 
                {currentDay}日目
              </span>
              <span className="flex items-center gap-2 text-[#f4a261]">
                <span className="text-[#fdf6e3] text-sm mt-1">TIME</span> 
                {timeLabels[timeOfDay]}
              </span>
              <span className="flex items-center gap-2 text-[#a3b18a]">
                <span className="text-[#fdf6e3] text-sm mt-1">AP</span> {actionCountLabel}
              </span>
              <span className="flex items-center gap-2 text-[#dda15e]">
                <span className="text-[#fdf6e3] text-sm mt-1">GOLD</span> {gold.toLocaleString()} G
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm font-bold">
              <span className="text-[#ffdd99]">借金：¥{debtAmount.toLocaleString()}</span>
              <span className="text-[#fdf6e3]">返済まで：あと{daysUntilRepayment}日</span>
              <span className="text-[#a5d8ff]">同行：{companionGirlName ?? 'なし'}</span>
              {hasBeastPremonition && (
                <span className="text-[#ffd166] drop-shadow-[0_0_8px_rgba(255,209,102,0.45)]">
                  ⚠ 獣が近くにいる気配がする
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={advanceToNextTimeSlot} 
               className="px-3 py-1 text-sm border-2 bg-[#dda15e] border-[#bc6c25] text-[#2d1b15] hover:bg-[#e9b872] shadow-sm font-bold cursor-pointer"
             >
               🕒 ターン進む
             </button>
             <button
               onClick={openBattlePreview}
               className="px-3 py-1 text-sm border-2 bg-[#5a3010] border-[#dda15e] text-[#fdf6e3] hover:bg-[#7a4317] shadow-sm font-bold cursor-pointer"
             >
               ⚔️ 戦闘テスト
             </button>
             <button onClick={() => setSetupMode(setupMode === 'animation' ? 'none' : 'animation')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'animation' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               🎬 アニメ領域設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'collision' ? 'none' : 'collision')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'collision' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               🚧 衝突設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'hideArea' ? 'none' : 'hideArea')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'hideArea' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               🌳 隠れ設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'footstep' ? 'none' : 'footstep')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'footstep' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               👣 足音設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'crops' ? 'none' : 'crops')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'crops' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               🌱 作物設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'bed' ? 'none' : 'bed')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'bed' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               ✨ イベント設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'bathTub' ? 'none' : 'bathTub')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'bathTub' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               ♨️ 湯船設定
             </button>
             <button onClick={() => setSetupMode(setupMode === 'doors' ? 'none' : 'doors')} className={`px-3 py-1 text-sm border-2 ${setupMode === 'doors' ? 'bg-[#bc6c25] border-white' : 'bg-[#4a5823] border-[#a3b18a]'} shadow-sm`}>
               🚪 扉設定
             </button>
          </div>
        </div>

        {/* Map */}
        <div 
          className={`relative flex-grow cursor-crosshair ${setupMode === 'none' ? 'cursor-pointer' : 'cursor-crosshair'}`} 
          onPointerDown={handleMapPointerDown} onPointerMove={handleMapPointerMove} onPointerUp={handleMapPointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (setupMode === 'none') {
              suppressNextMapPointerRef.current = true;
              clickTargetRef.current = null;
              setClickTargetMarker(null);
              setMenuOpen(prev => !prev);
              setMenuSelectedIndex(0);
            }
          }}
          style={{ 
            width: GAME_WIDTH, 
            height: GAME_HEIGHT, 
            touchAction: 'none',
            backgroundImage: `url(${getMapBackgroundUrl(currentMap, timeOfDay)})`, 
            backgroundSize: getMapBackgroundSize(currentMap),
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: currentMap === 'house' || currentMap === 'shed' ? '#2d1b15' : undefined,
            imageRendering: 'pixelated'
          }}
        >           {/* Field Grid (畑のマス目) */}
           {currentMap === 'farm' && (
              <>
                 {/* 左の畑 (21列 x 10行, 1マス30px) */}
                 {isFarmFieldInitiallyUnlocked(difficulty, 'left') && (
                    <FieldGrid
                       fieldId="left"
                       topLeft={fieldCorners.left.topLeft}
                       topRight={fieldCorners.left.topRight}
                       bottomRight={fieldCorners.left.bottomRight}
                       bottomLeft={fieldCorners.left.bottomLeft}
                       cols={fieldGridSizes.left.cols}
                       rows={fieldGridSizes.left.rows}
                       plantedCells={plantedCrops}
                       isPlantMode={setupMode === 'crops'}
                       onCellClick={handleCropCellClick}
                    />
                 )}
                 {/* 右の畑 (26列 x 10行, 1マス30px) */}
                 {isFarmFieldInitiallyUnlocked(difficulty, 'right') && (
                    <FieldGrid
                       fieldId="right"
                       topLeft={fieldCorners.right.topLeft}
                       topRight={fieldCorners.right.topRight}
                       bottomRight={fieldCorners.right.bottomRight}
                       bottomLeft={fieldCorners.right.bottomLeft}
                       cols={fieldGridSizes.right.cols}
                       rows={fieldGridSizes.right.rows}
                       plantedCells={plantedCrops}
                       isPlantMode={setupMode === 'crops'}
                       onCellClick={handleCropCellClick}
                    />
                 )}
                 {farmFieldSlots.filter(slot => slot.girlId).map(slot => {
                    const point = getFarmFieldSlotPoint(slot);
                    const girl = GIRL_DATA.find(entry => entry.id === slot.girlId);
                    const seed = GIRL_SEED_ACQUISITION_DATA.find(entry => entry.girlId === slot.girlId);
                    const farmGirl = farmGirls.find(entry => entry.girlId === slot.girlId);
                    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === slot.girlId);
                    const harvestInfo = slot.girlId ? getFarmGirlHarvestInfo(slot.girlId) : null;
                    const slotStatus = slot.state === 'appeared'
                       ? harvestInfo?.canHarvest
                          ? '出現中・収穫可'
                          : `出現中・あと${harvestInfo?.daysUntilHarvest ?? 0}日`
                       : `成長中 ${farmGirl?.growthProgress ?? 0}/${crop?.growthDays ?? '?'}日`;
                    return (
                       <div
                          key={`${slot.fieldId}_${slot.slotIndex}_${slot.girlId}`}
                          className={`pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-3 py-1 text-center text-[12px] font-black text-[#fff7dc] shadow-[0_4px_12px_rgba(0,0,0,0.55)] ${
                             slot.state === 'appeared'
                                ? 'border-[#86efac]/90 bg-[#14532d]/88'
                                : 'border-[#ffd166]/85 bg-[#1a100d]/82'
                          }`}
                          style={{ left: point.x, top: point.y }}
                       >
                          <div>{girl?.girlName ?? seed?.seedName ?? '娘苗'}</div>
                          <div className="text-[10px] leading-tight text-[#ffe8a3]">{slotStatus}</div>
                       </div>
                    );
                 })}
                 {setupMode === 'crops' && (Object.entries(fieldCorners) as [FieldId, FieldCorners][]).map(([fieldId, corners]) => (
                    (Object.entries(corners) as [FieldCornerKey, Point][]).map(([corner, point]) => (
                       <div
                          key={`${fieldId}_${corner}`}
                          onPointerDown={(e) => handleFieldCornerDragStart(e, fieldId, corner)}
                          className={`absolute z-40 w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] cursor-move shadow-lg flex items-center justify-center text-[10px] font-bold text-white select-none ${
                             draggingFieldCorner?.fieldId === fieldId && draggingFieldCorner.corner === corner
                                ? 'bg-yellow-400 border-white text-[#2d1b15] scale-125'
                                : fieldId === 'left'
                                   ? 'bg-green-600 border-white'
                                   : 'bg-sky-600 border-white'
                          }`}
                          style={{ left: point.x, top: point.y }}
                          title={`${fieldId === 'left' ? '左畑' : '右畑'} ${corner}`}
                       >
                          {corner === 'topLeft' ? '左上' : corner === 'topRight' ? '右上' : corner === 'bottomRight' ? '右下' : '左下'}
                       </div>
                    ))
                 ))}
              </>
           )}

           {/* Background Distortion Animations */}
           <AnimationLayer 
              zones={zones.filter(z => (
                 (!z.map || z.map === currentMap) &&
                 isAnimZoneVisibleAtTime(z, timeOfDay) &&
                 !(shouldShowFishingTutorialKurumi && z.type === 'kurumi') &&
                 !(sawCraftTutorialReady && z.type === 'kurumi')
              ))} 
              isSetupMode={setupMode === 'animation'} 
              onZoneDelete={(id) => {
                 setZones(z => z.filter(x => x.id !== id));
                 if (selectedZoneId === id) setSelectedZoneId(null);
              }} 
	              onZoneClick={handleAnimationZoneClick}
	              selectedZoneId={selectedZoneId}
	              onSelect={setSelectedZoneId}
	              onZoneDragStart={handleZoneDragStart}
	              onZoneResizeStart={handleZoneResizeStart}
	              timeOfDay={timeOfDay}
                 seVolume={seVolume}
                 audioGains={audioGains}
                 getEffectiveVolume={getEffectiveVolume}
                 iwanaSplashSoundSrc={IWANA_SPLASH_SOUND_SRC}
                 kurumiDefaultSpriteW={KURUMI_DEFAULT_SPRITE_W}
                 kurumiDefaultSpriteH={KURUMI_DEFAULT_SPRITE_H}
	           />

           {/* Collision Grid Overlay */}
           {setupMode === 'collision' && (
              <div className="absolute inset-0 z-10 pointer-events-none grid" style={{
                 gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                 gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
              }}>
                 {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
                    const gx = idx % GRID_COLS;
                    const gy = Math.floor(idx / GRID_COLS);
                    const isObstacle = !!obstacles[`${currentMap}_${gx},${gy}`];
                    const tileX = gx * TILE_SIZE;
                    const tileY = gy * TILE_SIZE;
                    const isDoorPassage = doors.some(d => (
                       d.map === currentMap &&
                       tileX + TILE_SIZE >= d.x &&
                       tileX <= d.x + d.w &&
                       tileY + TILE_SIZE >= d.y &&
                       tileY <= d.y + d.h
                    ));
                    return (
                       <div 
                          key={idx} 
                          className={`border-[0.5px] border-black/10 transition-colors ${isDoorPassage ? 'bg-yellow-300/45' : isObstacle ? 'bg-white/60' : 'hover:bg-white/20'}`} 
                       />
                    );
                 })}
              </div>
           )}

           {/* Hide Area Grid Overlay */}
           {setupMode === 'hideArea' && (
              <div className="absolute inset-0 z-10 pointer-events-none grid" style={{
                 gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                 gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
              }}>
                 {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
                    const gx = idx % GRID_COLS;
                    const gy = Math.floor(idx / GRID_COLS);
                    const isHideArea = !!hideAreaTiles[`${currentMap}_${gx},${gy}`];
                    const isObstacle = !!obstacles[`${currentMap}_${gx},${gy}`];
                    return (
                       <div 
                          key={idx} 
                          className={`border-[0.5px] border-black/10 transition-colors ${isHideArea ? 'bg-emerald-300/45' : isObstacle ? 'bg-white/25' : 'hover:bg-emerald-200/20'}`} 
                       />
                    );
                 })}
              </div>
           )}

           {/* Footstep Sound Grid Overlay */}
           {setupMode === 'footstep' && (
              <div className="absolute inset-0 z-10 pointer-events-none grid" style={{
                 gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                 gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
              }}>
                 {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
                    const gx = idx % GRID_COLS;
                    const gy = Math.floor(idx / GRID_COLS);
                    const soundType = footstepTiles[`${currentMap}_${gx},${gy}`];
                    return (
                       <div 
                          key={idx} 
                          className={`border-[0.5px] border-black/10 transition-colors ${soundType ? FOOTSTEP_SOUNDS[soundType].color : 'hover:bg-white/20'}`} 
                       />
                    );
                 })}
              </div>
           )}

           {/* Event Zone Grid Overlay */}
           {setupMode === 'bed' && (
              <div className="absolute inset-0 z-10 pointer-events-none grid" style={{
                 gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                 gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
              }}>
                 {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
                    const gx = idx % GRID_COLS;
                    const gy = Math.floor(idx / GRID_COLS);
                    const isBedTile = currentMap === 'house' && !!bedTiles[`house_${gx},${gy}`];
                    const isWorkbenchTile = !!workbenchTiles[`${currentMap}_${gx},${gy}`];
                    const isFishingTile = !!fishingTiles[`${currentMap}_${gx},${gy}`];
                    const isMiningTile = !!miningTiles[`${currentMap}_${gx},${gy}`];
                    const isLoggingTile = !!loggingTiles[`${currentMap}_${gx},${gy}`];
                    return (
                       <div 
                          key={idx} 
                          className={`border-[0.5px] border-black/10 transition-colors ${isLoggingTile ? 'bg-emerald-400/55' : isMiningTile ? 'bg-stone-300/60' : isFishingTile ? 'bg-cyan-300/60' : isWorkbenchTile ? 'bg-sky-400/55' : isBedTile ? 'bg-violet-500/50' : 'hover:bg-white/20'}`} 
                       />
                    );
                 })}
              </div>
           )}

           {/* Bath Tub Mask Grid Overlay */}
           {setupMode === 'bathTub' && currentMap === 'house' && (
              <div className="absolute inset-0 z-10 pointer-events-none grid" style={{
                 gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                 gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`
              }}>
                 {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
                    const gx = idx % GRID_COLS;
                    const gy = Math.floor(idx / GRID_COLS);
                    const isMaskTile = !!bathTubMaskTiles[`house_${gx},${gy}`];
                    const isObstacle = !!obstacles[`house_${gx},${gy}`];
                    return (
                       <div
                          key={idx}
                          className={`border-[0.5px] border-black/10 transition-colors ${isMaskTile ? 'bg-cyan-300/50' : isObstacle ? 'bg-white/25' : 'hover:bg-cyan-200/20'}`}
                       />
                    );
                 })}
              </div>
           )}

           {setupMode === 'bathTub' && currentMap !== 'house' && (
              <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 bg-black/75 border-2 border-cyan-300 text-white px-4 py-3 rounded-md text-lg font-bold pointer-events-none">
                 湯船マスクは家マップで調整します
              </div>
           )}

           {/* Warp Doors Overlay */}
           {setupMode === 'doors' && doors.filter(d => d.map === currentMap).map(d => (
              <div 
                 key={d.id}
                 onPointerDown={(e) => handleDoorDragStart(e, d.id)}
                 onClick={(e) => { e.stopPropagation(); }}
                 onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDoors(prev => {
                       const next = prev.filter(x => x.id !== d.id);
                       localStorage.setItem('farm_doors', JSON.stringify(next));
                       return next;
                    });
                    if (selectedDoorId === d.id) setSelectedDoorId(null);
                 }}
                 className={`absolute border-[3px] border-dashed cursor-pointer z-30 transition-colors ${selectedDoorId === d.id ? 'border-yellow-400 bg-yellow-400/40' : 'border-green-500 bg-green-500/20'}`}
                 style={{ left: d.x, top: d.y, width: d.w, height: d.h }}
              >
                 <span className="absolute -top-5 left-0 bg-green-700 text-white text-[10px] px-1 rounded whitespace-nowrap select-none">
                    🚪 {getMapLabel(d.targetMap)}行き
                 </span>

                 {/* リサイズハンドル（右下） */}
                 {selectedDoorId === d.id && (
                    <div 
                       onPointerDown={(e) => handleDoorResizeStart(e, d.id)}
                       className="absolute bottom-[-6px] right-[-6px] w-3 h-3 bg-yellow-400 border border-black cursor-se-resize z-50 rounded-sm"
                    />
                 )}

                 {/* 簡単な削除用の×ボタン */}
                 <button 
                    onPointerDown={(e) => e.stopPropagation()} // マップ側の新規扉作成（onPointerDown）を防ぐ
                    onClick={(e) => { 
                       e.stopPropagation(); 
                       setDoors(prev => {
                          const next = prev.filter(x => x.id !== d.id);
                          localStorage.setItem('farm_doors', JSON.stringify(next));
                          return next;
                       });
                       if (selectedDoorId === d.id) setSelectedDoorId(null);
                    }} 
                    className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-full flex justify-center items-center font-bold shadow-md cursor-pointer pointer-events-auto z-50 text-[10px]"
                 >
                    ×
                 </button>
              </div>
           ))}

           {/* Spawn Pins Overlay */}
           {setupMode === 'doors' && doors.filter(d => d.targetMap === currentMap).map(d => (
              <div 
                 key={`spawn_${d.id}`}
                 onPointerDown={(e) => handleSpawnDragStart(e, d.id)}
                 className={`absolute flex flex-col items-center justify-end cursor-move z-40 transition-transform ${draggingSpawnDoorId === d.id ? 'scale-110' : ''}`}
                 style={{ left: d.spawnX - 15, top: d.spawnY - 40, width: 30, height: 40 }}
                 title={`${getMapLabel(d.map)}からの出現位置`}
              >
                 <div className="text-3xl drop-shadow-md pointer-events-none select-none">📍</div>
                 <div className="bg-black/70 text-white text-[10px] px-1 rounded mt-1 whitespace-nowrap pointer-events-none select-none">
                    {getMapLabel(d.map)}から
                 </div>
                 <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                       e.stopPropagation();
                       setDoors(prev => {
                          const next = prev.filter(x => x.id !== d.id);
                          localStorage.setItem('farm_doors', JSON.stringify(next));
                          return next;
                       });
                       if (selectedDoorId === d.id) setSelectedDoorId(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-full flex justify-center items-center font-bold shadow-md cursor-pointer pointer-events-auto z-50 text-[10px] border border-white/90"
                    title={`${getMapLabel(d.map)}からの出現位置を削除`}
                 >
                    ×
                 </button>
              </div>
           ))}

           {/* Play mode entrance / exit markers */}
           {setupMode === 'none' && doors.filter(d => d.map === currentMap).map(d => {
              const markerX = d.x + d.w / 2;
              const markerY = Math.max(28, d.y - 28);
              return (
                 <div
                    key={`door_marker_${d.id}`}
                    className="absolute z-[35] pointer-events-none flex flex-col items-center"
                    style={{
                       left: markerX,
                       top: markerY,
                       animation: 'doorMarkerFloat 2.2s ease-in-out infinite',
                    }}
                    title={`${getMapLabel(d.targetMap)}への入口`}
                 >
                    <div className="w-5 h-5 rounded-full bg-black/25 blur-[1px]" />
                    <div
                       className="absolute top-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
                       style={{
                          width: 0,
                          height: 0,
                          borderLeft: '8px solid transparent',
                          borderRight: '8px solid transparent',
                          borderTop: '12px solid #ffd166',
                          filter: 'drop-shadow(0 0 5px rgba(255, 209, 102, 0.75))',
                       }}
                    />
                    <div
                       className="absolute top-[6px]"
                       style={{
                          width: 0,
                          height: 0,
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: '7px solid #fff3b0',
                       }}
                    />
                 </div>
              );
           })} 

           {setupMode === 'none' && shouldShowFishingTutorialKurumi && (
              <button
                 type="button"
                 onPointerDown={(e) => e.stopPropagation()}
                 onClick={(e) => {
                    e.stopPropagation();
                    if (!isNearFishingTutorialKurumi(pos)) {
                       clickTargetRef.current = FISHING_TUTORIAL_KURUMI_APPROACH_POINT;
                       setClickTargetMarker(FISHING_TUTORIAL_KURUMI_APPROACH_POINT);
                       setDialogMessage('くるみの近くまで移動します。');
                       return;
                    }
                    openFishingTutorial();
                 }}
                 className="absolute z-[38] cursor-pointer border-0 bg-transparent p-0 text-left"
                 style={{
                    left: FISHING_TUTORIAL_KURUMI_ZONE.x + FISHING_TUTORIAL_KURUMI_ZONE.w / 2 - FISHING_TUTORIAL_KURUMI_LABEL_W / 2,
                    top: FISHING_TUTORIAL_KURUMI_ZONE.y - FISHING_TUTORIAL_KURUMI_LABEL_H,
                    width: FISHING_TUTORIAL_KURUMI_LABEL_W,
                    height: FISHING_TUTORIAL_KURUMI_ZONE.h + FISHING_TUTORIAL_KURUMI_LABEL_H,
                 }}
                 aria-label="釣りのチュートリアル"
              >
                 <div className="pointer-events-none absolute left-0 top-0 w-full rounded-2xl border-2 border-[#67e8f9] bg-[#1a100d]/95 px-4 py-2 text-center text-sm font-black text-[#fdf6e3] shadow-[0_0_18px_rgba(103,232,249,0.45)]">
                    釣りのチュートリアル
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[12px] border-x-transparent border-t-[#67e8f9]" />
                 </div>
                 <img
                    src="/img/kurumi1.png"
                    alt="くるみ"
                    className="pointer-events-none absolute bottom-0 left-1/2 object-contain object-bottom drop-shadow-[0_12px_14px_rgba(0,0,0,0.55)]"
                    style={{
                       width: FISHING_TUTORIAL_KURUMI_ZONE.w,
                       height: FISHING_TUTORIAL_KURUMI_ZONE.h,
                       transform: 'translateX(-50%)',
                    }}
                 />
              </button>
           )}

           {setupMode === 'none' && sawCraftTutorialReady && currentMap === 'shed' && (
              <button
                 type="button"
                 onPointerDown={(e) => e.stopPropagation()}
                 onClick={(e) => {
                    e.stopPropagation();
                    if (!isNearSawCraftTutorialKurumi(pos)) {
                       clickTargetRef.current = {
                          x: CRAFT_TUTORIAL_KURUMI_ZONE.x - 70,
                          y: CRAFT_TUTORIAL_KURUMI_ZONE.y + CRAFT_TUTORIAL_KURUMI_ZONE.h,
                       };
                       setClickTargetMarker(clickTargetRef.current);
                       setDialogMessage('くるみの近くまで移動します。');
                       return;
                    }
                    playFixSound();
                    openSawCraftTutorialShedDialogue();
                 }}
                 className="absolute z-[38] cursor-pointer border-0 bg-transparent p-0 text-left"
                 style={{
                    left: CRAFT_TUTORIAL_KURUMI_ZONE.x + CRAFT_TUTORIAL_KURUMI_ZONE.w / 2 - CRAFT_TUTORIAL_KURUMI_LABEL_W / 2,
                    top: CRAFT_TUTORIAL_KURUMI_ZONE.y - CRAFT_TUTORIAL_KURUMI_LABEL_H,
                    width: CRAFT_TUTORIAL_KURUMI_LABEL_W,
                    height: CRAFT_TUTORIAL_KURUMI_ZONE.h + CRAFT_TUTORIAL_KURUMI_LABEL_H,
                 }}
                 aria-label="クラフトを始める"
              >
                 <div className="pointer-events-none absolute left-0 top-0 w-full rounded-2xl border-2 border-[#ffd166] bg-[#1a100d]/95 px-4 py-2 text-center text-sm font-black text-[#fdf6e3] shadow-[0_0_18px_rgba(255,209,102,0.45)]">
                    クラフトを始める
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[12px] border-x-transparent border-t-[#ffd166]" />
                 </div>
                 <img
                    src="/img/kurumi1.png"
                    alt="くるみ"
                    className="pointer-events-none absolute bottom-0 left-1/2 object-contain object-bottom drop-shadow-[0_12px_14px_rgba(0,0,0,0.55)]"
                    style={{
                       width: CRAFT_TUTORIAL_KURUMI_ZONE.w,
                       height: CRAFT_TUTORIAL_KURUMI_ZONE.h,
                       transform: 'translateX(-50%)',
                    }}
                 />
              </button>
           )}

           {setupMode === 'none' && sawCraftTutorialWorkbenchReady && currentMap === 'shed' && (
              <div
                 className="pointer-events-none absolute z-[38]"
                 style={{
                    left: CRAFT_TUTORIAL_KURUMI_ZONE.x,
                    top: CRAFT_TUTORIAL_KURUMI_ZONE.y,
                    width: CRAFT_TUTORIAL_KURUMI_ZONE.w,
                    height: CRAFT_TUTORIAL_KURUMI_ZONE.h,
                 }}
                 aria-label="くるみ"
              >
                 <img
                    src="/img/kurumi1.png"
                    alt="くるみ"
                    className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_14px_rgba(0,0,0,0.55)]"
                 />
              </div>
           )}

           {/* Play mode inspect markers */}
           {setupMode === 'none' && inspectSpots.filter(spot => spot.map === currentMap && !spot.autoTrigger).map(spot => {
              const markerX = spot.x + spot.w / 2;
              const markerY = Math.max(28, spot.y - 28);
              return (
                 <div
                    key={`inspect_marker_${spot.id}`}
                    className="absolute z-[35] pointer-events-none flex flex-col items-center"
                    style={{
                       left: markerX,
                       top: markerY,
                       animation: 'doorMarkerFloat 2.2s ease-in-out infinite',
                    }}
                    title={spot.label}
                 >
                    <div className="w-5 h-5 rounded-full bg-black/25 blur-[1px]" />
                    <div
                       className="absolute top-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
                       style={{
                          width: 0,
                          height: 0,
                          borderLeft: '8px solid transparent',
                          borderRight: '8px solid transparent',
                          borderTop: '12px solid #ffd166',
                          filter: 'drop-shadow(0 0 5px rgba(255, 209, 102, 0.75))',
                       }}
                    />
                    <div
                       className="absolute top-[6px]"
                       style={{
                          width: 0,
                          height: 0,
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: '7px solid #fff3b0',
                       }}
                    />
                 </div>
              );
           })}

           {/* Inspect / Auto Event Spot Overlay */}
           {setupMode === 'bed' && (selectedEventTileType === 'inspect' || selectedEventTileType === 'auto') && inspectSpots.filter(spot => (
              spot.map === currentMap &&
              (selectedEventTileType === 'auto' ? spot.autoTrigger : !spot.autoTrigger)
           )).map(spot => (
              <div
                 key={spot.id}
                 onPointerDown={(e) => handleInspectSpotDragStart(e, spot.id)}
                 className={`absolute z-40 border-2 cursor-move shadow-lg ${spot.autoTrigger ? 'bg-rose-500/20' : 'bg-fuchsia-500/20'} ${
                    selectedInspectSpotId === spot.id
                       ? spot.autoTrigger ? 'border-white ring-4 ring-rose-400/70' : 'border-white ring-4 ring-fuchsia-400/70'
                       : spot.autoTrigger ? 'border-rose-400' : 'border-fuchsia-400'
                 }`}
                 style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
              >
                 <div className={`absolute -top-5 left-0 text-white text-[10px] px-1 rounded whitespace-nowrap select-none ${spot.autoTrigger ? 'bg-rose-700' : 'bg-fuchsia-700'}`}>
                    {spot.autoTrigger ? '🎬' : '🔎'} {spot.label}
                 </div>
                 {selectedInspectSpotId === spot.id && (
                    <div
                       onPointerDown={(e) => handleInspectSpotResizeStart(e, spot.id)}
                       className="absolute bottom-[-6px] right-[-6px] w-3 h-3 bg-yellow-400 border border-black cursor-se-resize z-50 rounded-sm"
                    />
                 )}
                 <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                       e.stopPropagation();
                       setInspectSpots(prev => prev.filter(s => s.id !== spot.id));
                       if (selectedInspectSpotId === spot.id) setSelectedInspectSpotId(null);
                    }}
                    className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-500 text-white w-5 h-5 rounded-full flex justify-center items-center font-bold shadow-md cursor-pointer pointer-events-auto z-50 text-[10px]"
                    title={spot.autoTrigger ? '自動イベントを削除' : '調査スポットを削除'}
                 >
                    ×
                 </button>
              </div>
           ))}

           {/* SVG drag box */}
           {setupMode === 'animation' && dragStart && dragCurrent && (
             <div className="absolute border-2 border-red-500 bg-red-500/30 z-50 pointer-events-none" 
                  style={{ 
                      left: Math.min(dragStart.x, dragCurrent.x), top: Math.min(dragStart.y, dragCurrent.y),
                      width: Math.abs(dragCurrent.x - dragStart.x), height: Math.abs(dragCurrent.y - dragStart.y) 
                  }} />
           )}

          {setupMode === 'none' && clickTargetMarker && (
             <div
                className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ left: clickTargetMarker.x, top: clickTargetMarker.y }}
             >
                <div className="absolute left-1/2 top-1/2 w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/55 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.45)] animate-ping" />
                <div className="absolute left-1/2 top-1/2 w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fdf6e3]/75 bg-[#2d1b15]/20" />
                <div className="absolute left-1/2 top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fdf6e3]/85 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
             </div>
          )}

          {setupMode === 'none' && fishingMiniGameOpen && fishingMiniGameStage === 'direction' && (
             <div
                className="absolute inset-0 z-[79] flex cursor-pointer items-center justify-center bg-black/28 pointer-events-auto"
                onPointerDown={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   handleFishingMiniGameAction();
                }}
             >
                <div className="w-[820px] max-w-[calc(100%-32px)] rounded-2xl border-[4px] border-[#67e8f9] bg-[linear-gradient(180deg,rgba(39,22,16,0.98),rgba(14,9,8,0.98))] p-5 text-center text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.72),inset_0_0_24px_rgba(103,232,249,0.08)]">
                   <div className="mb-2 text-sm font-bold tracking-[0.22em] text-[#67e8f9] drop-shadow-[0_0_10px_rgba(103,232,249,0.7)]">FISHING</div>
                   <div className="mb-3 text-2xl font-bold drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">投げる方向を決めよう</div>
                   <div className="mb-3 text-base font-bold text-[#ffd166] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
                      黄色い範囲に合わせて投げればHITしやすくなるぞ！
                   </div>
                   <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl border-2 border-[#fdf6e3]/70 bg-black shadow-[inset_0_0_24px_rgba(0,0,0,0.72),0_10px_28px_rgba(0,0,0,0.55)]">
                      <img
                         src={FISHING_SCENE_CAST_SRC}
                         alt="釣り場"
                         className="h-full w-full object-cover opacity-100 transition-opacity duration-700"
                      />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]" />
                   </div>
                   <div className="inline-flex rounded-full border border-[#67e8f9]/25 bg-black/25 px-4 py-1.5 text-xs font-bold text-[#dda15e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      {equippedFishingRod} / クリック・Enter・Space
                   </div>
                </div>
             </div>
          )}

          {setupMode === 'none' && fishingMiniGameOpen && fishingMiniGameStage === 'direction' && (() => {
             const radiusX = fishingFanConfig.width / 2;
             const radiusY = fishingFanConfig.height;
             const width = radiusX * 2 + 108;
             const height = radiusY + 76;
             const centerX = width / 2;
             const baseY = height - 24;
             const angleDeg = (fishingGauge - 50) * 1.2;
             const angleRad = angleDeg * Math.PI / 180;
             const fanRayLength = Math.hypot(radiusX, radiusY);
             const needleLength = fanRayLength;
             const needleX = centerX + Math.sin(angleRad) * needleLength;
             const needleY = baseY - Math.cos(angleRad) * needleLength;
             const leftX = centerX - radiusX;
             const rightX = centerX + radiusX;
             const topY = baseY - radiusY;
             const fanPath = `M${centerX} ${baseY} L${leftX} ${topY} A${radiusX} ${radiusY} 0 0 1 ${rightX} ${topY} Z`;
             const sweetSpotLeftAngle = (fishingFanSweetMin - 50) * 1.2 * Math.PI / 180;
             const sweetSpotRightAngle = (fishingFanSweetMax - 50) * 1.2 * Math.PI / 180;
             const sweetSpotLength = fanRayLength;
             const sweetLeftX = centerX + Math.sin(sweetSpotLeftAngle) * sweetSpotLength;
             const sweetLeftY = baseY - Math.cos(sweetSpotLeftAngle) * sweetSpotLength;
             const sweetRightX = centerX + Math.sin(sweetSpotRightAngle) * sweetSpotLength;
             const sweetRightY = baseY - Math.cos(sweetSpotRightAngle) * sweetSpotLength;
             const sweetSpotPath = `M${centerX} ${baseY} L${sweetLeftX} ${sweetLeftY} A${radiusX} ${radiusY} 0 0 1 ${sweetRightX} ${sweetRightY} Z`;
             const overlayLeft = isFishingTutorialRun
                ? clampNumber(pos.x + 260, width / 2 + 24, GAME_WIDTH - width / 2 - 260)
                : pos.x;

             return (
             <div
                className="absolute z-[82] pointer-events-auto -translate-x-1/2 -translate-y-full"
                style={{ left: overlayLeft, top: Math.max(height + 62, pos.y - 34), width, height }}
                onPointerDown={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   handleFishingMiniGameAction();
                }}
             >
                <svg
                   viewBox={`0 0 ${width} ${height}`}
                   className="absolute left-0 top-0 h-full w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]"
                   aria-hidden="true"
                >
                   <defs>
                      <clipPath id="fishing-direction-fan-clip">
                         <path d={fanPath} />
                      </clipPath>
                   </defs>
                   <path
                      d={fanPath}
                      fill={`rgba(253, 246, 227, ${fishingFanConfig.opacity})`}
                   />
                   <path
                      d={sweetSpotPath}
                      clipPath="url(#fishing-direction-fan-clip)"
                      fill="rgba(255, 209, 102, 0.34)"
                      stroke="rgba(255, 247, 173, 0.72)"
                      strokeWidth="1"
                   />
                   <line
                      x1={centerX}
                      y1={baseY}
                      x2={needleX}
                      y2={needleY}
                      clipPath="url(#fishing-direction-fan-clip)"
                      stroke="#ffd166"
                      strokeWidth="4"
                      strokeLinecap="round"
                   />
                   <line
                      x1={centerX}
                      y1={baseY}
                      x2={needleX}
                      y2={needleY}
                      clipPath="url(#fishing-direction-fan-clip)"
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                   />
                </svg>
                <div
                   className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fdf6e3] bg-[#1a100d] shadow-[0_0_10px_rgba(253,246,227,0.7)]"
                   style={{ left: centerX, top: baseY }}
                />
             </div>
             );
          })()}

          {/* Player */}
          {setupMode !== 'animation' && (
             <Character
                x={pos.x}
                y={pos.y}
                direction={dir}
                isWalking={isWalking}
                customSprites={customSprites}
                isHidden={isPlayerInHideArea(pos.x, pos.y, currentMap)}
                isBathMasked={isPlayerInBathTubMask}
                playerWalkSprites={playerWalkSprites}
                overrideWalkSprites={isPlayerInBath ? furoWalkSprites : undefined}
                walkFrameMs={isPlayerInBath ? 240 : undefined}
             />
          )}

          {battlePreviewOpen && (() => {
            const { hero, allies, beasts, logs, result } = battlePreviewState;
            const actionButtons = ['攻撃', 'スキル', '防御', 'アイテム', '逃げる'];
            const renderHpBar = (hp: number, maxHp: number, colorClass = 'bg-[#4ade80]') => (
              <div className="mt-2 h-3 overflow-hidden rounded-full border border-white/20 bg-black/45">
                <div
                  className={`h-full rounded-full transition-[width] ${colorClass}`}
                  style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                />
              </div>
            );
            const resultLabel = result === 'victory'
              ? '勝利'
              : result === 'defeat'
                ? '敗北'
                : result === 'escaped'
                  ? '離脱'
                  : '戦闘中';

            return (
              <div className="absolute inset-0 z-[115] flex items-center justify-center bg-black/65 p-8">
                <div className="relative grid h-[820px] w-[1320px] grid-rows-[auto_minmax(0,1fr)_110px] overflow-hidden rounded-2xl border-4 border-[#dda15e] bg-[#140d0b]/97 text-[#fdf6e3] shadow-[0_28px_80px_rgba(0,0,0,0.78)]">
                  <div className="flex items-center justify-between border-b border-[#dda15e]/35 bg-[#2d1b15]/95 px-6 py-4">
                    <div>
                      <div className="text-xs font-black tracking-[0.28em] text-[#ffd166]">BATTLE PREVIEW</div>
                      <div className="mt-1 text-3xl font-black">戦闘画面 仮UI</div>
                    </div>
                    <div className={`rounded-full border px-4 py-2 text-sm font-black ${
                      result === 'ongoing'
                        ? 'border-[#ffd166]/60 bg-black/35 text-[#ffd166]'
                        : result === 'victory'
                          ? 'border-[#86efac]/70 bg-[#14532d]/70 text-[#f0fdf4]'
                          : result === 'defeat'
                            ? 'border-[#fca5a5]/70 bg-[#450a0a]/70 text-[#fee2e2]'
                            : 'border-[#c8a87a]/70 bg-black/45 text-[#fdf6e3]'
                    }`}>
                      {resultLabel}
                    </div>
                    <button
                      type="button"
                      onClick={() => { playFixSound(); setBattlePreviewOpen(false); }}
                      className="rounded-lg border-2 border-[#fdf6e3]/70 bg-black/45 px-5 py-2 text-lg font-black hover:bg-[#5a3010]"
                    >
                      閉じる
                    </button>
                  </div>

                  <div className="grid min-h-0 grid-cols-[330px_minmax(0,1fr)_330px] gap-5 p-6">
                    <div className="flex min-h-0 flex-col gap-4">
                      <div className="rounded-xl border-2 border-[#67e8f9]/70 bg-[#102333]/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                        <div className="text-xs font-black tracking-[0.18em] text-[#67e8f9]">HERO</div>
                        <div className="mt-2 text-2xl font-black">主人公 Lv{hero.level}</div>
                        <div className="mt-1 text-sm font-bold text-[#bbf7d0]">HP {hero.hp} / {hero.maxHp}{hero.defending ? ' / 防御中' : ''}</div>
                        {renderHpBar(hero.hp, hero.maxHp, 'bg-[#22c55e]')}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                          <div className="rounded bg-black/30 px-3 py-2">HP {hero.hp}</div>
                          <div className="rounded bg-black/30 px-3 py-2">攻撃 {hero.attack}</div>
                          <div className="rounded bg-black/30 px-3 py-2">防御 {hero.defense}</div>
                          <div className="rounded bg-black/30 px-3 py-2">素早さ {hero.speed}</div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold text-[#d7b98a]">
                          <div className="rounded bg-black/25 px-2 py-1">会心 {hero.criticalRate ?? 0}%</div>
                          <div className="rounded bg-black/25 px-2 py-1">獣特効 ×{(hero.beastDamageMultiplier ?? 1).toFixed(2)}</div>
                          <div className="rounded bg-black/25 px-2 py-1">獣軽減 {hero.beastDamageReduction ?? 0}%</div>
                          <div className="rounded bg-black/25 px-2 py-1">耐性 {hero.statusResistance ? 'あり' : 'なし'}</div>
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-[#76502c]/80 bg-black/25 p-4">
                        <div className="text-xs font-black tracking-[0.18em] text-[#ffd166]">同行娘 最大3枠</div>
                        {allies.map((ally, index) => (
                          <div
                            key={index}
                            className={`min-h-[92px] rounded-lg border px-4 py-3 ${
                              ally
                                ? 'border-[#f1c27d]/80 bg-[#3a2418]/88'
                                : 'border-[#5a3010]/70 bg-black/28 text-[#8f7b63]'
                            }`}
                          >
                            {ally ? (
                              <>
                                <div className="text-xl font-black">{ally.name}</div>
                                <div className="mt-1 text-sm font-bold text-[#d7b98a]">同行娘 / HP {ally.hp} / {ally.maxHp}</div>
                                {renderHpBar(ally.hp, ally.maxHp, 'bg-[#f59e0b]')}
                                <div className="mt-1 text-xs font-bold text-[#a3b18a]">{ally.hp > 0 ? '待機' : '戦闘不能'}</div>
                              </>
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm font-bold">空き枠 {index + 1}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-xl border-2 border-[#5a3010] bg-[#1d120f]/88 p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black tracking-[0.18em] text-[#dda15e]">BATTLE LOG</div>
                          <div className="mt-1 text-xl font-black">戦闘ログ</div>
                        </div>
                        <div className="rounded-full border border-[#ffd166]/50 bg-black/35 px-3 py-1 text-xs font-black text-[#ffd166]">仮表示</div>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-hidden rounded-lg border border-[#76502c]/60 bg-black/35 p-4 text-base font-bold leading-relaxed text-[#fdf6e3]">
                        {logs.map((log, index) => (
                          <p key={`${index}-${log}`} className={index >= logs.length - 1 ? 'text-[#ffd166]' : undefined}>{log}</p>
                        ))}
                        <p className="text-[#c8a87a]">※素材ドロップ・襲撃イベント・SPスキルはまだ未接続です。</p>
                      </div>
                      {result === 'victory' && (
                        <div className="mt-4 rounded-xl border-2 border-[#86efac]/70 bg-[#10251a]/90 p-4">
                          <div className="text-lg font-black text-[#bbf7d0]">戦利品</div>
                          {battlePreviewState.loot.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-sm font-bold text-[#fdf6e3]">
                              {battlePreviewState.loot.map(item => (
                                <li key={item.itemId}>・{item.itemName} ×{item.count}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-2 text-sm font-bold text-[#c8a87a]">戦利品はありません。</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex min-h-0 flex-col gap-3">
                      <div className="rounded-xl border border-[#bc4749]/80 bg-[#341416]/88 p-4">
                        <div className="text-xs font-black tracking-[0.18em] text-[#ffb4a2]">獣 最大3枠</div>
                      </div>
                      {beasts.map((beast, index) => (
                        <div
                          key={index}
                          className={`min-h-[136px] rounded-xl border px-4 py-3 ${
                            beast
                              ? 'border-[#ef4444]/75 bg-[#3a1010]/90'
                              : 'border-[#5a3010]/70 bg-black/25 text-[#8f7b63]'
                          }`}
                        >
                          {beast ? (
                            <>
                              <div className="text-2xl font-black">{beast.name}</div>
                              <div className="mt-1 text-sm font-bold text-[#fecaca]">HP {beast.hp} / {beast.maxHp}</div>
                              {renderHpBar(beast.hp, beast.maxHp, 'bg-[#ef4444]')}
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
                                <div className="rounded bg-black/30 px-2 py-1">HP {beast.hp}</div>
                                <div className="rounded bg-black/30 px-2 py-1">攻撃 {beast.attack}</div>
                                <div className="rounded bg-black/30 px-2 py-1">防御 {beast.defense}</div>
                                <div className="rounded bg-black/30 px-2 py-1">素早さ {beast.speed}</div>
                              </div>
                            </>
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm font-bold">空き枠 {index + 1}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-4 border-t border-[#dda15e]/35 bg-[#2d1b15]/95 p-5">
                    {actionButtons.map(label => (
                      <button
                        key={label}
                        type="button"
                        disabled={result !== 'ongoing'}
                        onClick={() => handleBattlePreviewCommand(label)}
                        className={`rounded-xl border-2 px-4 py-4 text-xl font-black text-[#fdf6e3] shadow-[0_4px_0_rgba(0,0,0,0.35)] ${
                          result === 'ongoing'
                            ? 'border-[#a3b18a] bg-[#4a5823] hover:border-white hover:bg-[#60732d]'
                            : 'cursor-not-allowed border-[#5a3010] bg-black/35 text-[#8f7b63]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* RPGメニューボックス */}
          {setupMode === 'none' && (
            <div
              className={`absolute ${menuOpen ? 'z-[90]' : 'z-50'}`}
              style={menuOpen ? { left: 80, top: 54 } : { left: 24, top: 24 }}
            >
              {/* メニューを開くボタン（閉じているとき） */}
              {!menuOpen && (
                <button
                  onClick={() => { playFixSound(); setMenuOpen(true); setMenuSelectedIndex(3); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#fdf6e3] cursor-pointer select-none"
                  style={{
                    background: 'linear-gradient(180deg, #3b2a1a 0%, #1a100d 100%)',
                    border: '3px solid #bc6c25',
                    borderRadius: '6px',
                    boxShadow: '0 0 0 1px #5a3010, 0 4px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,220,150,0.15)',
                    fontFamily: '"DotGothic16", sans-serif',
                    letterSpacing: '0.05em',
                  }}
                >
                  <span style={{ fontSize: 16 }}>📋</span>
                  <span>メニュー</span>
                  <span style={{ fontSize: 11, color: '#a3b18a', marginLeft: 4 }}>[M]</span>
                </button>
              )}

              {/* メニューパネル（開いているとき） */}
              {menuOpen && (
                <div
                  className="farm-menu-window"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    suppressNextMapPointerRef.current = true;
                    clickTargetRef.current = null;
                    setClickTargetMarker(null);
                    playFixSound();
                    setMenuOpen(false);
                  }}
                  style={{
                    background: 'linear-gradient(145deg, rgba(44,31,25,0.96) 0%, rgba(20,15,14,0.98) 55%, rgba(35,28,22,0.96) 100%)',
                    border: '1px solid rgba(255, 221, 166, 0.34)',
                    borderRadius: '24px',
                    boxShadow: '0 28px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(120,74,38,0.65), inset 0 1px 0 rgba(255,242,211,0.14)',
                    width: 1760,
                    minHeight: 920,
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 80,
                  }}
                >
                  {/* タイトルバー */}
                  <div
                    style={{
                      background: 'linear-gradient(90deg, rgba(118,78,43,0.92) 0%, rgba(75,49,32,0.88) 45%, rgba(42,32,28,0.72) 100%)',
                      borderBottom: '1px solid rgba(255, 221, 166, 0.22)',
                      padding: '14px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                      <span style={{ color: '#fdf6e3', fontWeight: 'bold', fontSize: 20 }}>📋 メニュー</span>
                    <span style={{ color: '#d8c7a5', fontSize: 13 }}>
                      {selectedMenuItem.icon} {selectedMenuItem.label} / カーソル: {menuFocusArea === 'nav' ? '左メニュー' : menuContentFocus === 'primary' ? '項目選択' : '詳細選択'} / [Esc]戻る・閉じる
                    </span>
                  </div>

                  <div className="grid grid-cols-[260px_1fr]" style={{ height: 800 }}>
                    {/* メニューアイテムリスト */}
                    <div style={{ padding: '14px 10px', borderRight: '1px solid rgba(255,221,166,0.14)', background: 'rgba(8, 8, 8, 0.16)' }}>
                      {MENU_ITEMS.map((item, idx) => {
                        const isSelected = menuSelectedIndex === idx;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                              playFixSound();
                              setMenuSelectedIndex(idx);
                              setMenuFocusArea('nav');
                              setMenuContentFocus('primary');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              width: '100%',
                              padding: '16px 18px',
                              cursor: 'pointer',
                              background: isSelected
                                ? 'linear-gradient(135deg, rgba(188,108,37,0.58) 0%, rgba(91,70,41,0.44) 100%)'
                                : 'transparent',
                              border: isSelected ? '1px solid rgba(255,236,200,0.38)' : '1px solid transparent',
                              borderRadius: 16,
                              transition: 'background 0.12s',
                              position: 'relative',
                              textAlign: 'left',
                              boxShadow: isSelected ? '0 12px 28px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,244,214,0.2)' : 'none',
                            }}
                            aria-pressed={isSelected}
                            onMouseEnter={() => {
                              if (menuSelectedIndex !== idx) playCursorSound();
                              setMenuSelectedIndex(idx);
                              setMenuFocusArea('nav');
                              setMenuContentFocus('primary');
                            }}
                          >
                            <span style={{ width: 16, color: '#f4a261', opacity: isSelected ? 1 : 0, fontWeight: 'bold' }}>▶</span>
                            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                            <span style={{ color: isSelected ? '#fdf6e3' : '#c8a87a', fontSize: 20, fontWeight: isSelected ? 'bold' : 'normal', letterSpacing: '0.05em' }}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-5 text-[#fdf6e3] overflow-hidden">
                      {renderMenuDetail(selectedMenuItem.id)}
                    </div>
                  </div>

                  {/* フッター（操作説明） */}
                  <div
                    style={{
                      borderTop: '2px solid #3b2010',
                      padding: '5px 14px',
                      display: 'flex',
                      gap: 16,
                      background: 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <span style={{ color: '#8a7060', fontSize: 10 }}>↑↓ 選択</span>
                    <span style={{ color: '#8a7060', fontSize: 10 }}>Enter 決定</span>
                    <span style={{ color: '#8a7060', fontSize: 10 }}>Esc 閉じる</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {beastAttackPending && (
           <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/65">
              <div className="w-[520px] rounded-2xl border-[4px] border-[#bc4749] bg-[#1a100d]/97 p-7 text-center text-[#fdf6e3] shadow-[0_24px_70px_rgba(0,0,0,0.72)]">
                 <div className="text-4xl font-black tracking-wide text-[#ffd166]">🐾 獣襲撃！</div>
                 <div className="mt-5 rounded-xl border border-[#76502c]/75 bg-black/35 px-5 py-4 text-lg font-bold leading-relaxed text-[#fdf6e3]">
                    畑の方から物音がする……<br />
                    獣が作物を狙っているようだ！
                 </div>
                 <div className="mt-6 flex justify-center gap-4">
                    <button
                       type="button"
                       onClick={handleBeastAttackFight}
                       onMouseEnter={playCursorSound}
                       className="h-[56px] w-[150px] rounded-lg border-2 border-[#ffd166] bg-[#7a2718] text-lg font-black text-[#fff7dc] shadow-[0_4px_0_rgba(0,0,0,0.45)] hover:bg-[#9b3320]"
                    >
                       迎え撃つ
                    </button>
                    <button
                       type="button"
                       onClick={handleBeastAttackWatch}
                       onMouseEnter={playCursorSound}
                       className="h-[56px] w-[150px] rounded-lg border-2 border-[#a3b18a] bg-[#4a5823] text-lg font-black text-[#fff7dc] shadow-[0_4px_0_rgba(0,0,0,0.45)] hover:bg-[#60732d]"
                    >
                       様子を見る
                    </button>
                 </div>
                 <div className="mt-4 text-xs font-bold text-[#c8a87a]">
                    ※今回は農場被害・娘被害・イベント分岐はまだ発生しません。
                 </div>
              </div>
           </div>
        )}

        {sleepPromptVisible && (
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/20">
              <div className="bg-[#1a100d]/95 border-[4px] border-[#dda15e] rounded-xl p-6 text-[#fdf6e3] shadow-2xl w-[380px] h-[180px] text-center flex flex-col items-center justify-center">
                 <div className="text-2xl font-bold mb-4">眠る？</div>
                 <div className="flex justify-center gap-4">
                    <button
                       onClick={() => { playFixSound(); startSleepSequence(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'yes') playCursorSound();
                          setConfirmPromptChoice('yes');
                       }}
                       className={`w-[120px] h-[52px] bg-[#4a5823] hover:bg-[#60732d] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                    >
                       はい
                    </button>
                    <button
                       onClick={() => { playFixSound(); cancelSleepPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'no') playCursorSound();
                          setConfirmPromptChoice('no');
                       }}
                       className={`w-[120px] h-[52px] bg-[#5a2a1f] hover:bg-[#753527] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                    >
                       いいえ
                    </button>
                 </div>
              </div>
           </div>
        )}

        {craftPromptVisible && (
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/20">
              <div className="bg-[#1a100d]/95 border-[4px] border-[#dda15e] rounded-xl p-6 text-[#fdf6e3] shadow-2xl w-[380px] h-[180px] text-center flex flex-col items-center justify-center">
                 <div className="text-2xl font-bold mb-4">クラフトする？</div>
                 <div className="flex justify-center gap-4">
                    <button
                       onClick={() => { playFixSound(); startCraftPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'yes') playCursorSound();
                          setConfirmPromptChoice('yes');
                       }}
                       className={`w-[120px] h-[52px] bg-[#4a5823] hover:bg-[#60732d] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                    >
                       はい
                    </button>
                    <button
                       onClick={() => { playFixSound(); cancelCraftPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'no') playCursorSound();
                          setConfirmPromptChoice('no');
                       }}
                       className={`w-[120px] h-[52px] bg-[#5a2a1f] hover:bg-[#753527] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                    >
                       いいえ
                    </button>
                 </div>
              </div>
           </div>
        )}

        {fishingPromptVisible && (
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/20">
              <div className="bg-[#1a100d]/95 border-[4px] border-[#67e8f9] rounded-xl p-6 text-[#fdf6e3] shadow-2xl w-[380px] h-[180px] text-center flex flex-col items-center justify-center">
                 <div className="text-2xl font-bold mb-4">釣りをしますか？</div>
                 <div className="flex justify-center gap-4">
                    <button
                       onClick={() => { playFixSound(); startFishingPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'yes') playCursorSound();
                          setConfirmPromptChoice('yes');
                       }}
                       className={`w-[120px] h-[52px] bg-[#4a5823] hover:bg-[#60732d] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                    >
                       はい
                    </button>
                    <button
                       onClick={() => { playFixSound(); cancelFishingPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'no') playCursorSound();
                          setConfirmPromptChoice('no');
                       }}
                       className={`w-[120px] h-[52px] bg-[#5a2a1f] hover:bg-[#753527] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                    >
                       いいえ
                    </button>
                 </div>
              </div>
           </div>
        )}

        {loggingPromptVisible && (
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/20">
              <div className="bg-[#1a100d]/95 border-[4px] border-[#86efac] rounded-xl p-6 text-[#fdf6e3] shadow-2xl w-[380px] h-[180px] text-center flex flex-col items-center justify-center">
                 <div className="text-2xl font-bold mb-4">伐採しますか？</div>
                 <div className="flex justify-center gap-4">
                    <button
                       onClick={() => { playFixSound(); startLoggingMiniGame(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'yes') playCursorSound();
                          setConfirmPromptChoice('yes');
                       }}
                       className={`w-[120px] h-[52px] bg-[#4a5823] hover:bg-[#60732d] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                    >
                       はい
                    </button>
                    <button
                       onClick={() => { playFixSound(); cancelLoggingPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'no') playCursorSound();
                          setConfirmPromptChoice('no');
                       }}
                       className={`w-[120px] h-[52px] bg-[#5a2a1f] hover:bg-[#753527] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                    >
                       いいえ
                    </button>
                 </div>
              </div>
           </div>
        )}

        {fishingMiniGameOpen && fishingMiniGameStage !== 'direction' && (() => {
           const isFishingNushiTarget = fishingTargetIsNushi || (fishingTargetSizeValue !== null && isNushiSize(fishingTargetFish, fishingTargetSizeValue));
           const isFishingNushiScene = isFishingNushiTarget && (
              isFishingNushiIntroActive ||
              (fishingMiniGameStage === 'hit' && !isFishingHitSplashActive)
           );
           const fishingSceneImage = fishingMiniGameStage === 'result'
              ? fishingResultImageSrc
              : fishingMiniGameStage === 'power'
                 ? FISHING_SCENE_CAST_SRC
              : (fishingMiniGameStage === 'hit' || fishingMiniGameStage === 'keep')
                 ? FISHING_SCENE_HIT_SRC
                 : FISHING_SCENE_UKI_SRC;
           const useFishingDissolveScene = (fishingMiniGameStage === 'hit' || fishingMiniGameStage === 'keep') && fishingSceneImage === FISHING_SCENE_HIT_SRC;
           const stageTitle = fishingMiniGameStage === 'power'
              ? '投げる位置を決めよう'
              : fishingMiniGameStage === 'bite'
                 ? '魚の反応を待っています...'
                 : fishingMiniGameStage === 'hit'
                    ? 'HIT！'
                    : fishingMiniGameStage === 'keep'
                       ? '魚との駆け引き！'
                       : '釣果';
           const gaugeLeft = fishingMiniGameStage === 'power' ? (fishingGauge / 105) * 100 : fishingGauge;

           return (
           <div
              className="absolute inset-0 z-[80] flex items-center justify-center bg-black/45 pointer-events-auto"
              onPointerDown={(e) => {
                 e.preventDefault();
                 handleFishingMiniGameAction();
              }}
              onPointerUp={(e) => {
                 e.preventDefault();
                 releaseFishingKeepPress();
              }}
              onPointerLeave={releaseFishingKeepPress}
              onPointerCancel={releaseFishingKeepPress}
           >
              <div className="w-[820px] max-w-[calc(100%-32px)] rounded-2xl border-[4px] border-[#67e8f9] bg-[linear-gradient(180deg,rgba(39,22,16,0.98),rgba(14,9,8,0.98))] p-5 text-center text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.72),inset_0_0_24px_rgba(103,232,249,0.08)]">
                 <div className="mb-2 text-sm font-bold tracking-[0.22em] text-[#67e8f9] drop-shadow-[0_0_10px_rgba(103,232,249,0.7)]">FISHING</div>
                 <div className="mb-3 text-2xl font-bold drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
                    {stageTitle}
                 </div>
                 <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl border-2 border-[#fdf6e3]/70 bg-black shadow-[inset_0_0_24px_rgba(0,0,0,0.72),0_10px_28px_rgba(0,0,0,0.55)]">
                    {useFishingDissolveScene ? (
                       <>
                          <img
                             src={FISHING_SCENE_BATTLE_A_SRC}
                             alt="釣り"
                             className="farm-fishing-dissolve-a absolute inset-0 h-full w-full object-cover"
                             onError={(event) => {
                                event.currentTarget.src = FISHING_SCENE_ESCAPE_SRC;
                             }}
                          />
                          <img
                             src={FISHING_SCENE_BATTLE_B_SRC}
                             alt="釣り"
                             className="farm-fishing-dissolve-b absolute inset-0 h-full w-full object-cover"
                             onError={(event) => {
                                event.currentTarget.src = FISHING_SCENE_ESCAPE_SRC;
                             }}
                          />
                       </>
                    ) : (
                       <img
                          key={fishingSceneImage}
                          src={fishingSceneImage}
                          alt="釣り"
                          className="h-full w-full object-cover opacity-100 transition-opacity duration-700"
                          onError={(event) => {
                             event.currentTarget.src = FISHING_SCENE_ESCAPE_SRC;
                          }}
                       />
                    )}
                    {isFishingNushiScene && (
                       <img
                          src={FISHING_SCENE_NUSHI_SRC}
                          alt="ヌシ"
                          className="farm-fishing-nushi-burst pointer-events-none absolute inset-0 z-[18] h-full w-full object-contain"
                          onError={(event) => {
                             event.currentTarget.style.display = 'none';
                          }}
                       />
                    )}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.28)_100%)]" />
                    {fishingMiniGameStage === 'bite' && (
                       <div className="absolute inset-0 z-20">
                          <div
                             className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-[#fdf6e3] bg-[#22c55e]/24 shadow-[0_0_18px_rgba(34,197,94,0.9),inset_0_0_14px_rgba(255,255,255,0.42)]"
                             style={{
                                left: `${fishingBiteCircle.x}%`,
                                top: `${fishingBiteCircle.y}%`,
                                width: FISHING_BITE_TARGET_SIZE,
                                height: FISHING_BITE_TARGET_SIZE,
                             }}
                          />
                          <div
                             className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-[#ffd166] bg-[#ffd166]/10 shadow-[0_0_24px_rgba(255,209,102,0.85)]"
                             style={{
                                left: `${fishingBiteCircle.x}%`,
                                top: `${fishingBiteCircle.y}%`,
                                width: fishingBiteCircle.outerSize,
                                height: fishingBiteCircle.outerSize,
                             }}
                          />
                          {fishingBiteSparkle && (
                             <div
                                key={fishingBiteSparkle.id}
                                className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
                                style={{
                                   left: `${fishingBiteSparkle.x}%`,
                                   top: `${fishingBiteSparkle.y}%`,
                                }}
                             >
                                <video
                                   key={fishingBiteSparkle.id}
                                   src={FISHING_BITE_SPARKLE_WEBM_SRC}
                                   className="h-64 w-64 -translate-x-1/2 -translate-y-1/2 object-contain opacity-100 drop-shadow-[0_0_18px_rgba(255,255,255,0.85)]"
                                   autoPlay
                                   muted
                                   playsInline
                                   preload="auto"
                                />
                             </div>
                          )}
                          <div className="absolute left-4 top-4 rounded-full border border-[#67e8f9]/70 bg-black/65 px-4 py-2 text-sm font-black text-[#fdf6e3] shadow-[0_0_12px_rgba(103,232,249,0.35)]">
                             {fishingBiteRound}/{FISHING_BITE_ROUNDS}　成功 {fishingBiteScore}　コンボ {fishingBiteCombo}連 x{getFishingBiteMultiplier(fishingBiteCombo).toFixed(1)}
                          </div>
                       </div>
                    )}
                    {(fishingMiniGameStage === 'hit' || isFishingHitSplashActive) && (
                       <>
                          {!isFishingHitSplashActive && !isFishingNushiScene && (
                             <img
                                key={isFishingHitIntroActive ? 'hit-intro' : 'hit-gauge'}
                                src={FISHING_SCENE_HIT_OVERLAY_SRC}
                                alt="HIT"
                                className="absolute inset-0 z-20 h-full w-full object-cover animate-[farmHitFrameBurst_0.62s_cubic-bezier(0.16,1.18,0.28,1)_both] drop-shadow-[0_0_26px_rgba(255,209,102,0.95)]"
                             />
                          )}
                          {isFishingHitSplashActive && !isFishingNushiIntroActive && (
                             <div className="absolute inset-0 bg-black/10">
                               <img
                                   key={fishingHitCountdown}
                                   src={`/img/${fishingHitCountdown}.png`}
                                   alt={`${fishingHitCountdown}`}
                                   className={`absolute inset-x-[10%] top-[7%] z-20 h-[76%] w-[80%] object-cover animate-[farmCountdownFrameBurst_0.34s_cubic-bezier(0.2,1.35,0.28,1)_both] drop-shadow-[0_0_26px_rgba(255,209,102,0.95)] ${isFishingHitIntroActive ? 'opacity-0' : 'opacity-100'}`}
                                />
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border-2 border-[#ffd166]/80 bg-black/70 px-6 py-2 text-lg font-black text-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.45)]">
                                   テンション開始まで
                                </div>
                             </div>
                          )}
                       </>
                    )}
                 </div>
                 {fishingMiniGameStage !== 'result' ? (
                    <>
                       {fishingMiniGameStage !== 'bite' && (
                          <div className="relative h-10 overflow-hidden rounded-full border-2 border-[#fdf6e3]/90 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(45,27,21,0.72))] shadow-[inset_0_3px_8px_rgba(0,0,0,0.75),0_6px_18px_rgba(0,0,0,0.35)]">
                             {fishingMiniGameStage === 'power' && (
                                <>
                                   <div className="absolute left-[66.666%] top-0 h-full w-[19.048%] bg-[#eab308]/80" />
                                   <div className="absolute left-[85.714%] top-0 h-full w-[9.524%] bg-[#22c55e]/85" />
                                   <div className="absolute left-[95.238%] top-0 h-full w-[4.762%] bg-[#ef4444]/85" />
                                </>
                             )}
	                             {(fishingMiniGameStage === 'hit' || fishingMiniGameStage === 'keep') && (
	                                <div
	                                   className="absolute top-0 h-full bg-[linear-gradient(180deg,rgba(134,239,172,0.92),rgba(34,197,94,0.72))] shadow-[0_0_18px_rgba(34,197,94,0.55)]"
	                                   style={{
	                                      left: `${fishingMiniGameStage === 'keep' ? fishingKeepGreenMin : fishingHitGreenMin}%`,
	                                      width: `${fishingMiniGameStage === 'keep' ? fishingKeepGreenWidth : fishingHitGreenWidth}%`,
	                                   }}
	                                />
	                             )}
                             <div
                                className="absolute top-1/2 h-[130%] w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd166] shadow-[0_0_16px_rgba(255,209,102,0.95),0_0_0_2px_rgba(255,255,255,0.4)]"
                                style={{ left: `${gaugeLeft}%` }}
                             />
                          </div>
                       )}
                       <div className="mt-4 text-sm text-[#c8a87a]">
                          {fishingMiniGameStage === 'power'
                             ? `クリック / Enter / Space で強さ決定  ${Math.round(fishingGauge)}%`
                             : fishingMiniGameStage === 'bite'
                                ? '外側の円が内側の円と重なる瞬間を狙え！'
                                : fishingMiniGameStage === 'hit'
                                   ? '真ん中の緑ゾーンで止めろ！'
                                   : `緑ゾーン内で魚の体力を削る / 外れるとテンション上昇`}
                       </div>
                       {fishingMiniGameStage === 'hit' && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#ffd166]/60 bg-black/35 px-4 py-1.5 text-sm font-black text-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.25)]">
                             残り {fishingHitLimitSeconds.toFixed(1)} 秒
                          </div>
                       )}
	                       {fishingMiniGameStage === 'power' && (
	                          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-bold">
	                             <div className="rounded bg-[#eab308]/25 px-2 py-1 text-[#fde68a]">70-90% GOOD</div>
	                             <div className="rounded bg-[#22c55e]/25 px-2 py-1 text-[#bbf7d0]">100-105% BEST</div>
	                             <div className="rounded bg-[#ef4444]/25 px-2 py-1 text-[#fecaca]">105% MAX</div>
	                          </div>
	                       )}
                       {fishingMiniGameStage === 'keep' && (
                          <div className="mt-2 rounded-full border border-[#67e8f9]/25 bg-black/25 px-4 py-1.5 text-xs font-bold text-[#dda15e]">
                             長押しで左へ戻す / 離すと右へ進む / テンションMAXで糸切れ
                          </div>
                       )}
                       {fishingMiniGameStage === 'keep' && (
                          <div className="mt-5 grid gap-4 text-left">
                             <div className="rounded-2xl border border-[#86efac]/35 bg-[#0f1f16]/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                <div className="mb-2 flex items-center justify-between text-[14px] font-black text-[#bbf7d0]">
                                   <span>魚の体力</span>
                                   <span className="rounded-full bg-black/35 px-3 py-0.5 text-[#fdf6e3]">{Math.ceil(Math.max(0, fishingFishHp))}%</span>
                                </div>
                                <div className="relative h-7 overflow-hidden rounded-full border-2 border-[#bbf7d0]/70 bg-black/60 shadow-[inset_0_3px_8px_rgba(0,0,0,0.75)]">
                                   <div
                                      className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a,#4ade80,#bbf7d0)] shadow-[0_0_18px_rgba(74,222,128,0.55)] transition-[width]"
                                      style={{ width: `${Math.max(0, Math.min(100, fishingFishHp))}%` }}
                                   />
                                   <div className="pointer-events-none absolute inset-x-2 top-1 h-2 rounded-full bg-white/20" />
                                </div>
                             </div>
                             <div className="rounded-2xl border border-[#fca5a5]/35 bg-[#251111]/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                <div className="mb-2 flex items-center justify-between text-[14px] font-black text-[#fecaca]">
                                   <span>テンション</span>
                                   <span className="rounded-full bg-black/35 px-3 py-0.5 text-[#fdf6e3]">{Math.floor(Math.max(0, fishingTension))}%</span>
                                </div>
                                <div className="relative h-7 overflow-hidden rounded-full border-2 border-[#fca5a5]/70 bg-black/60 shadow-[inset_0_3px_8px_rgba(0,0,0,0.75)]">
                                   <div
                                      className="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#facc15_70%,#ef4444_90%)] shadow-[0_0_18px_rgba(56,189,248,0.45)] transition-[width]"
                                      style={{ width: `${Math.max(0, Math.min(100, fishingTension))}%` }}
                                   />
                                   <div className="absolute left-[70%] top-0 h-full w-[20%] bg-[#eab308]/35" />
                                   <div className="absolute left-[90%] top-0 h-full w-[10%] bg-[#ef4444]/45" />
                                   <div className="pointer-events-none absolute inset-x-2 top-1 h-2 rounded-full bg-white/18" />
                                </div>
                                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-black">
                                   <div className="rounded-full border border-[#38bdf8]/35 bg-[#38bdf8]/18 px-2 py-1 text-[#bae6fd]">0-70% 安定</div>
                                   <div className="rounded-full border border-[#eab308]/40 bg-[#eab308]/25 px-2 py-1 text-[#fde68a]">70-90% 注意</div>
                                   <div className="rounded-full border border-[#ef4444]/45 bg-[#ef4444]/25 px-2 py-1 text-[#fecaca]">90-100% 危険</div>
                                </div>
                             </div>
                          </div>
                       )}
                    </>
                 ) : (
                    <div className="rounded-2xl border border-[#ffd166]/55 bg-black/35 p-4">
                       <div className="text-2xl font-black text-[#ffd166]">{fishingResultText}</div>
                       {fishingResultSizeCm && <div className="mt-2 text-[#dda15e]">サイズ: {fishingResultSizeCm}cm</div>}
                       {fishingResultIsNewRecord && (
                          <div className="mt-3 inline-flex items-center rounded-full border-2 border-[#fff7ad] bg-[linear-gradient(180deg,#fff7ad,#f59e0b)] px-5 py-1.5 text-sm font-black text-[#2d1b15] shadow-[0_0_18px_rgba(255,209,102,0.75)]">
                             記録更新！
                          </div>
                       )}
                       {isFishingTutorialRun ? (
                          <div className="mt-4 grid gap-3">
                             <div className="whitespace-pre-line rounded-xl border border-[#dda15e]/45 bg-[#2d1b15]/72 px-4 py-3 text-left text-sm font-bold leading-relaxed text-[#fdf6e3]">
                                {fishingTutorialResult === 'success'
                                   ? 'くるみ\n「やったぁー！\nお兄さん初めてなのに上手〜！\nこの調子でどんどん釣って、\n釣り名人になってね♪\n大きい魚ほど暴れるけど、\nそのぶんくるみが高く買い取っちゃうよ！\nこれで立派な釣り人デビューだね♪」'
                                   : 'くるみ\n「あーっ、逃げられちゃった！\nでも大丈夫！\n釣りは焦らないのがコツだから、もう一回やってみよう！」'}
                             </div>
                             <div className="flex justify-center gap-6 px-8">
                                <button
                                   type="button"
                                   disabled={isFishingResultInputLocked}
                                   onMouseEnter={() => {
                                      if (!isFishingResultInputLocked) setSelectedFishingResultAction('retry');
                                   }}
                                   onPointerDown={(event) => event.stopPropagation()}
                                   onClick={(event) => {
                                      event.stopPropagation();
                                      if (!isFishingResultInputLocked) retryFishingTutorial();
                                   }}
                                   className={`relative flex h-12 w-60 items-center justify-center rounded-lg border-2 px-8 text-sm font-black leading-none transition-all whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55 ${
                                      selectedFishingResultAction === 'retry' && !isFishingResultInputLocked
                                         ? 'border-[#fdf6e3] bg-[#0e7490] text-white shadow-[0_0_18px_rgba(103,232,249,0.85)] ring-2 ring-[#67e8f9]'
                                         : 'border-[#67e8f9] bg-[#164e63] text-[#fdf6e3] hover:bg-[#0e7490]'
                                   }`}
                                >
                                   {selectedFishingResultAction === 'retry' && !isFishingResultInputLocked && (
                                      <span className="absolute left-5 text-[#ffd166]">▶</span>
                                   )}
                                   もう一度挑戦！
                                </button>
                                <button
                                   type="button"
                                   disabled={isFishingResultInputLocked}
                                   onMouseEnter={() => {
                                      if (!isFishingResultInputLocked) setSelectedFishingResultAction('complete');
                                   }}
                                   onPointerDown={(event) => event.stopPropagation()}
                                   onClick={(event) => {
                                      event.stopPropagation();
                                      if (!isFishingResultInputLocked) completeFishingTutorial();
                                   }}
                                   className={`relative flex h-12 w-60 items-center justify-center rounded-lg border-2 px-8 text-sm font-black leading-none transition-all whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55 ${
                                      selectedFishingResultAction === 'complete' && !isFishingResultInputLocked
                                         ? 'border-[#fdf6e3] bg-[#b45309] text-white shadow-[0_0_18px_rgba(255,209,102,0.85)] ring-2 ring-[#ffd166]'
                                         : 'border-[#ffd166] bg-[#7a4317] text-[#fdf6e3] hover:bg-[#8d4f1b]'
                                   }`}
                                >
                                   {selectedFishingResultAction === 'complete' && !isFishingResultInputLocked && (
                                      <span className="absolute left-5 text-[#67e8f9]">▶</span>
                                   )}
                                   チュートリアルを終わる
                                </button>
                             </div>
                          </div>
                       ) : (
                          <div className="mt-3 text-sm text-[#c8a87a]">
                             {!isFishingResultInputLocked && 'クリック / Enter / Space で閉じる'}
                          </div>
                       )}
                    </div>
                 )}
              </div>
           </div>
           );
        })()}

         {loggingMiniGameOpen && (() => {
            const isDirection = loggingMiniGameStage === 'direction';
            const isAction = loggingMiniGameStage === 'action';
            const isResult = loggingMiniGameStage === 'result';

            const stageTitle = isDirection
               ? 'のこぎりを入れる角度を決めよう'
               : isAction
                  ? 'タイミングよくのこぎりを挽こう！'
                  : '伐採結果';

            const needleAngle = (loggingGauge - 50) * 1.2;

            return (
               <div
                  className="absolute inset-0 z-[80] flex items-center justify-center bg-black/45 pointer-events-auto"
                  onPointerDown={(e) => {
                     e.preventDefault();
                     handleLoggingMiniGameAction();
                  }}
               >
                  <div className="w-[820px] max-w-[calc(100%-32px)] rounded-2xl border-[4px] border-[#86efac] bg-[linear-gradient(180deg,rgba(22,39,26,0.98),rgba(8,14,9,0.98))] p-5 text-center text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.72),inset_0_0_24px_rgba(134,239,172,0.08)]">
                     <div className="mb-2 text-sm font-bold tracking-[0.22em] text-[#86efac] drop-shadow-[0_0_10px_rgba(134,239,172,0.7)]">FORESTRY</div>
                     <div className="mb-3 text-2xl font-bold drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
                        {stageTitle}
                     </div>
                     
                     <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl border-2 border-[#fdf6e3]/70 bg-black shadow-[inset_0_0_24px_rgba(0,0,0,0.72),0_10px_28px_rgba(0,0,0,0.55)]">
                        {/* 背景画像 */}
                        {isAction ? (
                           <>
                              <img
                                 src="/img/noko1.jpg"
                                 alt="のこぎり1"
                                 className="farm-logging-dissolve-a absolute inset-0 h-full w-full object-cover"
                                 onError={(event) => {
                                    event.currentTarget.src = '/img/tree.jpg';
                                 }}
                              />
                              <img
                                 src="/img/noko2.jpg"
                                 alt="のこぎり2"
                                 className="farm-logging-dissolve-b absolute inset-0 h-full w-full object-cover"
                                 onError={(event) => {
                                    event.currentTarget.src = '/img/tree.jpg';
                                 }}
                              />
                           </>
                        ) : isResult ? (
                           <img
                              src={loggingProgress >= 100 ? '/img/treeok.jpg' : '/img/treeng.jpg'}
                              alt={loggingProgress >= 100 ? '伐採成功' : '伐採失敗'}
                              className="h-full w-full object-cover object-top"
                              onError={(event) => {
                                 event.currentTarget.src = '/img/tree.jpg';
                              }}
                           />
                        ) : (
                           <img
                              src="/img/tree.jpg"
                              alt="木"
                              className="h-full w-full object-cover"
                           />
                        )}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.28)_100%)]" />

                        {/* 方向決定フェーズのSVG扇型ゲージ（木に重ねて表示するため回転させて右側に配置） */}
                        {isDirection && (() => {
                           const radiusX = 130;
                           const radiusY = 130;
                           const width = 360;
                           const height = 300;
                           const centerX = width / 2;
                           const baseY = height - 24;
                           
                           const leftX = centerX - radiusX;
                           const rightX = centerX + radiusX;
                           const topY = baseY - radiusY;
                           const fanPath = `M${centerX} ${baseY} L${leftX} ${topY} A${radiusX} ${radiusY} 0 0 1 ${rightX} ${topY} Z`;
                           
                           const sweetSpotLeftAngle = (LOGGING_MINIGAME_CONFIG.directionSweetMin - 50) * 1.2 * Math.PI / 180;
                           const sweetSpotRightAngle = (LOGGING_MINIGAME_CONFIG.directionSweetMax - 50) * 1.2 * Math.PI / 180;
                           const sweetLeftX = centerX + Math.sin(sweetSpotLeftAngle) * radiusX;
                           const sweetLeftY = baseY - Math.cos(sweetSpotLeftAngle) * radiusY;
                           const sweetRightX = centerX + Math.sin(sweetSpotRightAngle) * radiusX;
                           const sweetRightY = baseY - Math.cos(sweetSpotRightAngle) * radiusY;
                           const sweetSpotPath = `M${centerX} ${baseY} L${sweetLeftX} ${sweetLeftY} A${radiusX} ${radiusY} 0 0 1 ${sweetRightX} ${sweetRightY} Z`;

                           const angleRad = needleAngle * Math.PI / 180;
                           const needleX = centerX + Math.sin(angleRad) * radiusX;
                           const needleY = baseY - Math.cos(angleRad) * radiusY;

                           return (
                              <div 
                                 className="absolute pointer-events-none" 
                                 style={{
                                    left: '50%',
                                    top: '50%',
                                    width,
                                    height,
                                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                                    transformOrigin: 'center'
                                 }}
                              >
                                 <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
                                    <defs>
                                       <clipPath id="logging-direction-clip"><path d={fanPath} /></clipPath>
                                    </defs>
                                    <path d={fanPath} fill="rgba(253, 246, 227, 0.4)" />
                                    <path d={sweetSpotPath} clipPath="url(#logging-direction-clip)" fill="rgba(255, 209, 102, 0.5)" stroke="rgba(255,247,173,0.8)" strokeWidth="1.25" />
                                    <line
                                       x1={centerX}
                                       y1={baseY}
                                       x2={needleX}
                                       y2={needleY}
                                       clipPath="url(#logging-direction-clip)"
                                       stroke="#ffd166"
                                       strokeWidth="5"
                                       strokeLinecap="round"
                                    />
                                    <line
                                       x1={centerX}
                                       y1={baseY}
                                       x2={needleX}
                                       y2={needleY}
                                       clipPath="url(#logging-direction-clip)"
                                       stroke="rgba(255,255,255,0.4)"
                                       strokeWidth="1.5"
                                       strokeLinecap="round"
                                    />
                                 </svg>
                              </div>
                           );
                        })()}
                     </div>

                     {/* 進行中（角度・挽き）のゲージコントロール */}
                     {!isResult ? (
                        <>
                           {isAction && (() => {
                              const targetWidth = loggingAngleSuccess ? 30 : 15;
                              const minSweet = 50 - targetWidth / 2;
                              const maxSweet = 50 + targetWidth / 2;

                              return (
                                 <div className="relative h-10 overflow-hidden rounded-full border-2 border-[#fdf6e3]/90 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(21,45,27,0.72))] shadow-[inset_0_3px_8px_rgba(0,0,0,0.75),0_6px_18px_rgba(0,0,0,0.35)]">
                                    {/* 黄色成功エリア */}
                                    <div 
                                       className="absolute top-0 h-full bg-[linear-gradient(180deg,rgba(254,240,138,0.92),rgba(234,179,8,0.72))] shadow-[0_0_18px_rgba(234,179,8,0.55)]"
                                       style={{ left: `${minSweet}%`, width: `${targetWidth}%` }}
                                    />
                                    {/* 往復針 */}
                                    <div 
                                       className="absolute top-1/2 h-[130%] w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd166] shadow-[0_0_16px_rgba(255,209,102,0.95),0_0_0_2px_rgba(255,255,255,0.4)]"
                                       style={{ left: `${loggingGauge}%` }}
                                    />
                                 </div>
                              );
                           })()}
                           
                           <div className="mt-4 text-sm text-[#c8a87a]">
                              {isDirection 
                                 ? 'クリック / Enter / Space でのこぎりを入れる角度を決定' 
                                 : '黄色い範囲でタイミングよく決定！ 外れると伐採率が低下します'}
                           </div>
                           
                           {isAction && (
                              <div className="mt-5 grid gap-4 text-left">
                                 {/* 伐採進行率 */}
                                 <div className="rounded-2xl border border-[#86efac]/35 bg-[#0f2516]/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                    <div className="mb-2 flex items-center justify-between text-[14px] font-black text-[#bbf7d0]">
                                       <span>伐採進行率</span>
                                       <span className="rounded-full bg-black/35 px-3 py-0.5 text-[#fdf6e3]">{loggingProgress}%</span>
                                    </div>
                                    <div className="relative h-7 overflow-hidden rounded-full border-2 border-[#bbf7d0]/70 bg-black/60 shadow-[inset_0_3px_8px_rgba(0,0,0,0.75)]">
                                       <div 
                                          className="h-full rounded-full bg-[linear-gradient(90deg,#16a34a,#4ade80,#bbf7d0)] shadow-[0_0_18px_rgba(74,222,128,0.55)] transition-[width]"
                                          style={{ width: `${loggingProgress}%` }}
                                       />
                                       <div className="pointer-events-none absolute inset-x-2 top-1 h-2 rounded-full bg-white/20" />
                                    </div>
                                 </div>
                                 <div className="text-center text-sm font-bold text-[#ffd166]">
                                    現在 {loggingCombo}連コンボ中！(挽き増加量UP)
                                 </div>
                              </div>
                           )}
                        </>
                     ) : (
                        /* 結果フェーズ */
                        <div className="rounded-2xl border border-[#86efac]/55 bg-black/35 p-4">
                           <div className="text-2xl font-black text-[#86efac]">{loggingProgress >= 100 ? '伐採成功！' : '伐採失敗...'}</div>
                           {isLoggingTutorialRun ? (
                              <div className="mt-4 grid gap-3">
                                 <div className="whitespace-pre-line rounded-xl border border-[#86efac]/45 bg-[#16251b]/72 px-4 py-3 text-left text-sm font-bold leading-relaxed text-[#fdf6e3]">
                                    {loggingTutorialResult === 'success'
                                       ? 'くるみ\n「やったぁー！\nお兄さん初めてなのに上手〜！\nこれで立派なのこぎり使いデビューだね♪」'
                                       : 'くるみ\n「あーっ、刃が挟まっちゃったね！\nでも大丈夫！\nのこぎりは焦らずゆっくり挽くのがコツだよ、もう一回やってみよう！」'}
                                 </div>
                                 <div className="flex justify-center gap-6 px-8">
                                    <button
                                       type="button"
                                       disabled={isLoggingResultInputLocked}
                                       onMouseEnter={() => {
                                          if (!isLoggingResultInputLocked) setLoggingSelectedResultAction('retry');
                                       }}
                                       onPointerDown={(event) => event.stopPropagation()}
                                       onClick={(event) => {
                                          event.stopPropagation();
                                          if (!isLoggingResultInputLocked) retryLoggingTutorial();
                                       }}
                                       className={`relative flex h-12 w-60 items-center justify-center rounded-lg border-2 px-8 text-sm font-black leading-none transition-all whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55 ${
                                          loggingSelectedResultAction === 'retry' && !isLoggingResultInputLocked
                                             ? 'border-[#fdf6e3] bg-[#0e7490] text-white shadow-[0_0_18px_rgba(103,232,249,0.85)] ring-2 ring-[#67e8f9]'
                                             : 'border-[#67e8f9] bg-[#164e63] text-[#fdf6e3] hover:bg-[#0e7490]'
                                       }`}
                                    >
                                       {loggingSelectedResultAction === 'retry' && !isLoggingResultInputLocked && (
                                          <span className="absolute left-5 text-[#ffd166]">▶</span>
                                       )}
                                       もう一度挑戦！
                                    </button>
                                    <button
                                       type="button"
                                       disabled={isLoggingResultInputLocked}
                                       onMouseEnter={() => {
                                          if (!isLoggingResultInputLocked) setLoggingSelectedResultAction('complete');
                                       }}
                                       onPointerDown={(event) => event.stopPropagation()}
                                       onClick={(event) => {
                                          event.stopPropagation();
                                          if (!isLoggingResultInputLocked) completeLoggingTutorial();
                                       }}
                                       className={`relative flex h-12 w-60 items-center justify-center rounded-lg border-2 px-8 text-sm font-black leading-none transition-all whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55 ${
                                          loggingSelectedResultAction === 'complete' && !isLoggingResultInputLocked
                                             ? 'border-[#fdf6e3] bg-[#b45309] text-white shadow-[0_0_18px_rgba(255,209,102,0.85)] ring-2 ring-[#ffd166]'
                                             : 'border-[#ffd166] bg-[#7a4317] text-[#fdf6e3] hover:bg-[#8d4f1b]'
                                       }`}
                                    >
                                       {loggingSelectedResultAction === 'complete' && !isLoggingResultInputLocked && (
                                          <span className="absolute left-5 text-[#67e8f9]">▶</span>
                                       )}
                                       チュートリアルを終わる
                                    </button>
                                 </div>
                              </div>
                           ) : (
                              <div className="mt-3 text-sm text-[#c8a87a]">
                                 {!isLoggingResultInputLocked && 'クリック / Enter / Space で閉じる'}
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                  {loggingComboEffectKey > 0 && (
                     <div
                        key={loggingComboEffectKey}
                        className="farm-logging-combo-effect pointer-events-none absolute left-[calc(50%_-_300px)] top-1/2 z-20 w-[360px] max-w-[42vw] -translate-x-1/2 -translate-y-1/2"
                     >
                        <img
                           src="/img/combo.png"
                           alt=""
                           className="h-auto w-full drop-shadow-[0_0_28px_rgba(255,90,0,0.95)]"
                        />
                     </div>
                  )}
               </div>
            );
         })()}

        {isSleepSequenceActive && (
           <div
              className="absolute inset-0 z-[90] bg-black pointer-events-auto"
              style={{
                 opacity: sleepFadeOpacity,
                 transition: 'opacity 2000ms linear',
              }}
           />
        )}

        {activeAutoEventSpot && (
           <div
              className="absolute inset-0 z-[88] flex items-center justify-center bg-black/58 pointer-events-auto cursor-pointer"
              onPointerDown={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 closeAutoEventOverlay();
              }}
           >
              <div className="relative flex h-full w-full items-center justify-center px-12 pb-52 pt-12">
                 <button
                    type="button"
                    onClick={closeAutoEventOverlay}
                    className="absolute right-8 top-8 z-20 rounded bg-black/70 border border-white/50 px-3 py-1 text-white font-bold cursor-pointer hover:bg-[#5a3010]"
                 >
                    閉じる
                 </button>
                 <div className="relative max-h-full max-w-[82%] rounded-xl border-4 border-[#f1c27d] bg-[#1a100d]/95 shadow-2xl overflow-hidden">
                    {activeAutoEventSpot.videoSrc ? (
                       <video
                          src={resolveEventMediaSrc(activeAutoEventSpot.videoSrc, 'video')}
                          className="block max-w-full max-h-[780px] object-contain"
                          autoPlay
                          controls
                       />
                    ) : activeAutoEventSpot.imageSrc ? (
                       <img
                          src={resolveEventMediaSrc(activeAutoEventSpot.imageSrc, 'img')}
                          alt={activeAutoEventSpot.label}
                          className="block max-w-full max-h-[780px] object-contain"
                       />
                    ) : (
                       <div className="flex h-[420px] w-[820px] items-center justify-center bg-[#2d1b15] text-[#fdf6e3] text-3xl font-bold">
                          {activeAutoEventSpot.label}
                       </div>
                    )}
                 </div>
                 <div className="absolute left-1/2 bottom-12 z-20 w-[82%] max-w-[1420px] -translate-x-1/2 rounded-xl border-[4px] border-[#bc6c25] bg-[#1a100d]/96 p-3 shadow-2xl">
                    <div className="rounded-lg border-[3px] border-[#dda15e] bg-[#2d1b15]/96 px-6 py-5 text-[#fdf6e3] shadow-inner">
                       <div className="mb-2 inline-flex rounded-md border-2 border-[#fdf6e3] bg-[#bc6c25] px-3 py-[2px] text-xs font-bold tracking-widest text-white shadow-sm">
                          {activeAutoEventSpot.label || 'イベント'}
                       </div>
                       <p className="min-h-[64px] text-[22px] leading-relaxed">
                          {displayedAutoEventMessage}
                       </p>
                       {activeAutoEventMessages.length > 1 && (
                          <div className="mt-3 text-right text-xs font-bold text-[#dda15e]">
                             {activeAutoEventMessageIndex + 1} / {activeAutoEventMessages.length}
                          </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {gatheringTutorialOpen && (
           <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/58 px-8">
              <div className="grid h-[620px] w-[1080px] grid-cols-[1fr_380px] overflow-hidden rounded-2xl border-[4px] border-[#ffd166] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#67e8f9]">GATHERING LESSON</div>
                       <div className="mt-2 text-3xl font-black">素材集めの準備</div>
                    </div>
                    <div className="min-h-[300px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-6 text-[22px] font-bold leading-[1.55]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentGatheringTutorialStep.debugKey, currentGatheringTutorialStep.message)}」
                    </div>
                    {isGatheringTutorialChoiceStep ? (
                       <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-bold text-[#a3b18a]">←→ 選択 / Enter 決定</div>
                          <div className="flex gap-3">
                             <button
                                type="button"
                                onMouseEnter={() => {
                                  if (selectedGatheringTutorialChoice !== 'logging') playCursorSound();
                                  setSelectedGatheringTutorialChoice('logging');
                                }}
                                onClick={() => chooseGatheringTutorial('logging')}
                                className={`relative flex h-12 w-36 items-center justify-center rounded-lg border-2 px-5 text-sm font-black transition-all ${
                                   selectedGatheringTutorialChoice === 'logging'
                                      ? 'scale-105 border-[#fff3b0] bg-[#9a5a1d] text-white shadow-[0_0_18px_rgba(255,209,102,0.55)]'
                                      : 'border-[#8d6420] bg-[#5a3010] text-[#dda15e] hover:bg-[#7a4317] hover:text-[#fdf6e3]'
                                }`}
                             >
                                伐採？
                             </button>
                             <button
                                type="button"
                                onMouseEnter={() => {
                                  if (selectedGatheringTutorialChoice !== 'mining') playCursorSound();
                                  setSelectedGatheringTutorialChoice('mining');
                                }}
                                onClick={() => chooseGatheringTutorial('mining')}
                                className={`relative flex h-12 w-36 items-center justify-center rounded-lg border-2 px-5 text-sm font-black transition-all ${
                                   selectedGatheringTutorialChoice === 'mining'
                                      ? 'scale-105 border-[#fff3b0] bg-[#9a5a1d] text-white shadow-[0_0_18px_rgba(255,209,102,0.55)]'
                                      : 'border-[#8d6420] bg-[#5a3010] text-[#dda15e] hover:bg-[#7a4317] hover:text-[#fdf6e3]'
                                }`}
                             >
                                採掘？
                             </button>
                          </div>
                       </div>
                    ) : (
                       <div className="flex items-center justify-between gap-4">
                          <div className="text-sm font-bold text-[#a3b18a]">
                             {gatheringTutorialStepIndex + 1} / {currentGatheringTutorialSteps.length}
                          </div>
                          <button
                             type="button"
                             onPointerDown={(event) => event.stopPropagation()}
                             onClick={advanceGatheringTutorial}
                             className="relative flex h-12 w-44 items-center justify-center rounded-lg border-2 border-[#fff3b0] bg-[#9a5a1d] px-6 text-sm font-black leading-none text-white shadow-[0_0_18px_rgba(255,209,102,0.45)] transition-all hover:scale-105 hover:bg-[#b45309] whitespace-nowrap"
                          >
                             <span className="absolute left-5 text-[#67e8f9]">▶</span>
                             {gatheringTutorialStepIndex >= currentGatheringTutorialSteps.length - 1 ? 'おわり' : '次へ'}
                          </button>
                       </div>
                    )}
                 </div>
                 <div className="relative border-l border-[#ffd166]/45 bg-gradient-to-b from-[#4a2a14] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[18px] font-bold leading-snug">素材集めもやってみよっ！</div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-0 mx-auto h-[540px] w-[410px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
                    />
                 </div>
              </div>
           </div>
        )}

        {loggingTutorialOpen && (
           <div className="absolute inset-0 z-[88] flex items-center justify-center bg-black/55 px-8">
              <div className="grid h-[690px] w-[1120px] grid-cols-[1fr_390px] overflow-hidden rounded-2xl border-[4px] border-[#86efac] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#86efac]">FORESTRY LESSON</div>
                       <div className="mt-2 text-3xl font-black">伐採のチュートリアル</div>
                    </div>
                    <div className="min-h-[260px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-5 text-[21px] font-bold leading-[1.48]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentLoggingTutorialStep.debugKey, currentLoggingTutorialStep.message)}」
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <div className="text-sm font-bold text-[#a3b18a]">
                          {loggingTutorialStepIndex + 1} / {LOGGING_TUTORIAL_STEPS.length}
                       </div>
                       <div className="flex gap-3">
                          <button
                             type="button"
                             onMouseEnter={() => setSelectedLoggingTutorialAction('later')}
                             onClick={() => {
                                playFixSound();
                                stopLoggingTutorialVoice();
                                setLoggingTutorialOpen(false);
                             }}
                             className={`rounded-lg border-2 px-5 py-2 text-sm font-black transition-all ${
                                selectedLoggingTutorialAction === 'later'
                                   ? 'scale-105 border-[#ffd166] bg-[#5a3010] text-[#fdf6e3] shadow-[0_0_16px_rgba(255,209,102,0.45)]'
                                   : 'border-[#5a3010] bg-black/45 text-[#dda15e] hover:bg-[#3a2418]'
                             }`}
                          >
                             あとで
                          </button>
                          <button
                             type="button"
                             onMouseEnter={() => setSelectedLoggingTutorialAction('next')}
                             onClick={advanceLoggingTutorial}
                             className={`rounded-lg border-2 px-6 py-2 text-sm font-black transition-all ${
                                selectedLoggingTutorialAction === 'next'
                                   ? 'scale-105 border-[#f0fdf4] bg-[#15803d] text-white shadow-[0_0_18px_rgba(134,239,172,0.55)]'
                                   : 'border-[#166534] bg-[#14532d] text-[#bbf7d0] hover:bg-[#15803d] hover:text-white'
                             }`}
                          >
                             {loggingTutorialStepIndex >= LOGGING_TUTORIAL_STEPS.length - 1 ? '伐採してみる！' : '次へ'}
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="relative border-l border-[#86efac]/45 bg-gradient-to-b from-[#17351f] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[19px] font-bold leading-snug">木材の切り出し方を覚えよっ！</div>
                    </div>
                    {renderLoggingTutorialVisual()}
                 </div>
              </div>
           </div>
        )}

        {fishingTutorialOpen && (
           <div className="absolute inset-0 z-[88] flex items-center justify-center bg-black/55 px-8">
              <div className="grid h-[690px] w-[1120px] grid-cols-[1fr_390px] overflow-hidden rounded-2xl border-[4px] border-[#67e8f9] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#67e8f9]">FISHING LESSON</div>
                       <div className="mt-2 text-3xl font-black">釣りのチュートリアル</div>
                    </div>
                    <div className="min-h-[260px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-5 text-[21px] font-bold leading-[1.48]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentFishingTutorialStep.debugKey, currentFishingTutorialStep.message)}」
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <div className="text-sm font-bold text-[#a3b18a]">
                          {fishingTutorialStepIndex + 1} / {FISHING_TUTORIAL_STEPS.length}
                       </div>
                       <div className="flex gap-3">
                          <button
                             type="button"
                             onMouseEnter={() => setSelectedFishingTutorialAction('later')}
                             onClick={() => { playFixSound(); stopFishingTutorialVoice(); setFishingTutorialOpen(false); }}
                             className={`rounded-lg border-2 px-5 py-2 text-sm font-black transition-all ${
                                selectedFishingTutorialAction === 'later'
                                   ? 'scale-105 border-[#ffd166] bg-[#5a3010] text-[#fdf6e3] shadow-[0_0_16px_rgba(255,209,102,0.45)]'
                                   : 'border-[#5a3010] bg-black/45 text-[#dda15e] hover:bg-[#3a2418]'
                             }`}
                          >
                             あとで
                          </button>
                          <button
                             type="button"
                             onMouseEnter={() => setSelectedFishingTutorialAction('next')}
                             onClick={advanceFishingTutorial}
                             className={`rounded-lg border-2 px-6 py-2 text-sm font-black transition-all ${
                                selectedFishingTutorialAction === 'next'
                                   ? 'scale-105 border-[#fff3b0] bg-[#9a5a1d] text-white shadow-[0_0_18px_rgba(255,209,102,0.55)]'
                                   : 'border-[#8d6420] bg-[#5a3010] text-[#dda15e] hover:bg-[#7a4317] hover:text-[#fdf6e3]'
                             }`}
                          >
                             {fishingTutorialStepIndex >= FISHING_TUTORIAL_STEPS.length - 1 ? '釣ってみる！' : '次へ'}
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="relative border-l border-[#67e8f9]/45 bg-gradient-to-b from-[#15313a] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[19px] font-bold leading-snug">ここで釣りを覚えよっ！</div>
                    </div>
                    {renderFishingTutorialVisual()}
                 </div>
              </div>
           </div>
        )}

        {fishingTutorialEndingOpen && (
           <div className="absolute inset-0 z-[88] flex items-center justify-center bg-black/55 px-8">
              <div className="grid h-[620px] w-[1080px] grid-cols-[1fr_380px] overflow-hidden rounded-2xl border-[4px] border-[#dda15e] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#ffd166]">KURUMI</div>
                       <div className="mt-2 text-3xl font-black">くるみ</div>
                    </div>
                    <div className="min-h-[300px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-6 text-[22px] font-bold leading-[1.55]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentFishingTutorialEndingStep.debugKey, currentFishingTutorialEndingStep.message)}」
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <div className="text-sm font-bold text-[#a3b18a]">
                          {fishingTutorialEndingStepIndex + 1} / {FISHING_TUTORIAL_END_STEPS.length}
                       </div>
                       <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={advanceFishingTutorialEnding}
                          className="relative flex h-12 w-44 items-center justify-center rounded-lg border-2 border-[#fff3b0] bg-[#9a5a1d] px-6 text-sm font-black leading-none text-white shadow-[0_0_18px_rgba(255,209,102,0.45)] transition-all hover:scale-105 hover:bg-[#b45309] whitespace-nowrap"
                       >
                          <span className="absolute left-5 text-[#67e8f9]">▶</span>
                          {fishingTutorialEndingStepIndex >= FISHING_TUTORIAL_END_STEPS.length - 1 ? 'おわり' : '次へ'}
                       </button>
                    </div>
                 </div>
                 <div className="relative border-l border-[#dda15e]/45 bg-gradient-to-b from-[#4a2a14] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[18px] font-bold leading-snug">またお店にも来てねっ！</div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-0 mx-auto h-[540px] w-[410px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
                    />
                 </div>
              </div>
           </div>
        )}

        {sawCraftTutorialIntroOpen && (
           <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/58 px-8">
              <div className="grid h-[620px] w-[1080px] grid-cols-[1fr_380px] overflow-hidden rounded-2xl border-[4px] border-[#ffd166] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#67e8f9]">CRAFT LESSON</div>
                       <div className="mt-2 text-3xl font-black">クラフトの準備</div>
                    </div>
                    <div className="min-h-[300px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-6 text-[22px] font-bold leading-[1.55]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentSawCraftTutorialStep.debugKey, currentSawCraftTutorialStep.message)}」
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <div className="text-sm font-bold text-[#a3b18a]">
                          {sawCraftTutorialIntroStepIndex + 1} / {currentCraftTutorialSteps.length}
                       </div>
                       <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={advanceSawCraftTutorialIntro}
                          className="relative flex h-12 w-44 items-center justify-center rounded-lg border-2 border-[#fff3b0] bg-[#9a5a1d] px-6 text-sm font-black leading-none text-white shadow-[0_0_18px_rgba(255,209,102,0.45)] transition-all hover:scale-105 hover:bg-[#b45309] whitespace-nowrap"
                       >
                          <span className="absolute left-5 text-[#67e8f9]">▶</span>
                          {sawCraftTutorialIntroStepIndex >= currentCraftTutorialSteps.length - 1 ? '小屋へ行く' : '次へ'}
                       </button>
                    </div>
                 </div>
                 <div className="relative border-l border-[#ffd166]/45 bg-gradient-to-b from-[#4a2a14] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[18px] font-bold leading-snug">最初の素材はサービスだよっ！</div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-0 mx-auto h-[540px] w-[410px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
                    />
                 </div>
              </div>
           </div>
        )}

        {sawCraftTutorialShedDialogueOpen && (
           <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/58 px-8">
              <div className="grid h-[620px] w-[1080px] grid-cols-[1fr_380px] overflow-hidden rounded-2xl border-[4px] border-[#ffd166] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#67e8f9]">CRAFT LESSON</div>
                       <div className="mt-2 text-3xl font-black">クラフト小屋</div>
                    </div>
                    <div className="min-h-[300px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-6 text-[22px] font-bold leading-[1.55]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentSawCraftShedTutorialStep.debugKey, currentSawCraftShedTutorialStep.message)}」
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="text-sm font-bold text-[#a3b18a]">
                          {sawCraftTutorialShedStepIndex + 1} / {SAW_CRAFT_SHED_TUTORIAL_STEPS.length}
                       </div>
                       <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={advanceSawCraftTutorialShedDialogue}
                          className="relative flex h-12 w-44 items-center justify-center rounded-lg border-2 border-[#fff3b0] bg-[#9a5a1d] px-6 text-sm font-black leading-none text-white shadow-[0_0_18px_rgba(255,209,102,0.45)] transition-all hover:scale-105 hover:bg-[#b45309] whitespace-nowrap"
                       >
                          <span className="absolute left-5 text-[#67e8f9]">▶</span>
                          {sawCraftTutorialShedStepIndex >= SAW_CRAFT_SHED_TUTORIAL_STEPS.length - 1 ? 'レシピを選ぶ' : '次へ'}
                       </button>
                    </div>
                 </div>
                 <div className="relative border-l border-[#ffd166]/45 bg-gradient-to-b from-[#4a2a14] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[18px] font-bold leading-snug">クラフト台を調べてみてねっ！</div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-0 mx-auto h-[540px] w-[410px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
                    />
                 </div>
              </div>
           </div>
        )}

        {kurumiIntroOpen && (
           <div className={`absolute inset-0 z-[89] flex items-center justify-center bg-black/55 transition-opacity duration-[650ms] ${kurumiIntroClosing ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'}`}>
              <div className="grid h-[720px] w-[1120px] grid-cols-[1fr_430px] overflow-hidden rounded-2xl border-[4px] border-[#dda15e] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 min-w-0 flex-col gap-3 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#67e8f9]">KURUMI</div>
                       <div className="mt-2 text-3xl font-black">くるみ</div>
                    </div>
                    <div className="h-[244px] overflow-y-auto whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/80 p-5 pr-6 text-[17px] font-bold leading-[1.45]">
                       {kurumiIntroMessage}
                    </div>
                    <div className="grid gap-2">
                       {[...KURUMI_INTRO_TOPICS, { id: 'close' as const, label: 'とくにない', answer: '' }].map((topic, index) => {
                          const isSelected = kurumiIntroSelectedIndex === index;
                          const isAsked = topic.id !== 'close' && kurumiIntroAskedTopics.includes(topic.id);
                          const canClose = topic.id !== 'close' || hasAskedAllKurumiIntroTopics;
                          return (
                             <button
                                key={topic.id}
                                type="button"
                                onMouseEnter={() => {
                                  if (!isSelected) playCursorSound();
                                  setKurumiIntroSelectedIndex(index);
                                }}
                                onClick={() => handleKurumiIntroChoice(index)}
                                className={`flex h-[48px] items-center justify-between rounded-lg border-2 px-5 text-left text-[18px] font-bold transition-colors ${
                                  isSelected ? 'border-white bg-[#bc6c25]/70' : 'border-[#5a3010] bg-[#2d1b15]/75 hover:bg-[#3a2418]'
                                } ${canClose ? 'text-[#fdf6e3]' : 'text-[#8a7060]'}`}
                             >
                                <span>{topic.label}</span>
                                {isAsked && <span className="rounded-full border border-[#ffd166]/70 px-3 py-1 text-sm text-[#ffd166]">聞いた</span>}
                             </button>
                          );
                       })}
                    </div>
                    <div className="mt-auto flex gap-4 text-sm font-bold text-[#a3b18a]">
                       <span>↑↓ 選択</span>
                       <span>Enter 決定</span>
                       <span>{hasAskedAllKurumiIntroTopics ? 'Esc 終了' : '全部聞くと終了できます'}</span>
                    </div>
                 </div>
                 <div className="relative border-l border-[#bc6c25]/60 bg-gradient-to-b from-[#3b2418] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[20px] font-bold leading-snug">なんでも聞いてねっ！</div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-0 mx-auto h-[610px] w-[500px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
                    />
                 </div>
              </div>
           </div>
        )}

        <ShopOverlay
           kurumiShopOpen={kurumiShopOpen}
           selectedShopItemIndex={selectedShopItemIndex}
           selectedShopControl={selectedShopControl}
           setSelectedShopControl={setSelectedShopControl}
           setSelectedShopItemIndex={setSelectedShopItemIndex}
           shopItems={shopItemsForDisplay}
           inventoryCounts={inventoryCounts}
           gold={gold}
           kurumiTradeTotal={kurumiTradeTotal}
           isShopTradePose={isShopTradePose}
           kurumiRewardImageSrc={activeKurumiTradeReward?.imageSrc}
           kurumiRewardMessage={activeKurumiTradeReward?.message}
           menuTinyLabelStyle={menuTinyLabelStyle}
           handleShopBackdropPointerDown={handleShopBackdropPointerDown}
           handleShopCloseClick={handleShopCloseClick}
           handleShopItemClick={handleShopItemClick}
           handleShopActionClick={handleShopActionClick}
        />

        {/* Bottom Dialogue Box */}
        <DialogBox
           showDialog={showDialog}
           handleDialogDragStart={handleDialogDragStart}
           setDialogHovered={setDialogHovered}
           isDraggingDialog={isDraggingDialog}
           dialogBoxPos={dialogBoxPos}
           dialogBoxSize={dialogBoxSize}
           dialogHovered={dialogHovered}
           opacityMap={opacityMap}
           opacityLevel={opacityLevel}
           handleDialogResizeStart={handleDialogResizeStart}
           isResizingDialog={isResizingDialog}
        >
                {setupMode === 'none' ? (
                  <>
                     <div className="absolute top-1 left-4 bg-[#bc6c25] border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white tracking-widest shadow-sm">システム</div>
                     <p className="text-[17px] mt-0 select-none">
                        {dialogMessage}
                     </p>
                  </>
                ) : setupMode === 'animation' ? (
                   <MapEditorPanel
                     selectedZoneId={selectedZoneId}
                     zones={zones}
                     setZones={setZones}
                     setSelectedZoneId={setSelectedZoneId}
                     getAnimZoneTimeLabel={getAnimZoneTimeLabel}
                     kurumiDefaultSpriteW={KURUMI_DEFAULT_SPRITE_W}
                     kurumiDefaultSpriteH={KURUMI_DEFAULT_SPRITE_H}
                   />
                ) : setupMode === 'collision' ? (
                   <MapEditorPanel
                     setupMode="collision"
                     selectedZoneId={selectedZoneId}
                     zones={zones}
                     setZones={setZones}
                     setSelectedZoneId={setSelectedZoneId}
                     getAnimZoneTimeLabel={getAnimZoneTimeLabel}
                     kurumiDefaultSpriteW={KURUMI_DEFAULT_SPRITE_W}
                     kurumiDefaultSpriteH={KURUMI_DEFAULT_SPRITE_H}
                     currentMap={currentMap}
                     selectedCollisionDrawMode={selectedCollisionDrawMode}
                     setSelectedCollisionDrawMode={setSelectedCollisionDrawMode}
                     collisionBrushSize={collisionBrushSize}
                     setCollisionBrushSize={setCollisionBrushSize}
                     setObstacles={setObstacles}
                   />
                ) : setupMode === 'footstep' ? (
                   <MapEditorPanel
                     setupMode="footstep"
                     selectedZoneId={selectedZoneId}
                     zones={zones}
                     setZones={setZones}
                     setSelectedZoneId={setSelectedZoneId}
                     getAnimZoneTimeLabel={getAnimZoneTimeLabel}
                     kurumiDefaultSpriteW={KURUMI_DEFAULT_SPRITE_W}
                     kurumiDefaultSpriteH={KURUMI_DEFAULT_SPRITE_H}
                     currentMap={currentMap}
                     selectedFootstepSound={selectedFootstepSound}
                     setSelectedFootstepSound={setSelectedFootstepSound}
                     wallBumpSound={wallBumpSound}
                     setWallBumpSound={setWallBumpSound}
                     footstepBrushSize={footstepBrushSize}
                     setFootstepBrushSize={setFootstepBrushSize}
                     setFootstepTiles={setFootstepTiles}
                     saveFootstepTiles={saveFootstepTiles}
                     FOOTSTEP_SOUNDS={FOOTSTEP_SOUNDS}
                     WALL_BUMP_SOUNDS={WALL_BUMP_SOUNDS}
                   />
                ) : setupMode === 'hideArea' ? (
                   <MapEditorPanel
                     setupMode="hideArea"
                     selectedZoneId={selectedZoneId}
                     zones={zones}
                     setZones={setZones}
                     setSelectedZoneId={setSelectedZoneId}
                     getAnimZoneTimeLabel={getAnimZoneTimeLabel}
                     kurumiDefaultSpriteW={KURUMI_DEFAULT_SPRITE_W}
                     kurumiDefaultSpriteH={KURUMI_DEFAULT_SPRITE_H}
                     currentMap={currentMap}
                     selectedHideAreaDrawMode={selectedHideAreaDrawMode}
                     setSelectedHideAreaDrawMode={setSelectedHideAreaDrawMode}
                     hideAreaBrushSize={hideAreaBrushSize}
                     setHideAreaBrushSize={setHideAreaBrushSize}
                     setHideAreaTiles={setHideAreaTiles}
                   />
                ) : setupMode === 'bathTub' ? (
                   <>
                     <div className="absolute top-1 left-4 bg-cyan-700 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">湯船マスク設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">湯船で人物を肩まで隠すマスをなぞって塗ります。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">水色のマスにプレイヤーの足元が入るとマスクがかかります。Shiftか右クリックで一時的に消せます。</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                           <div className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">モード</span>
                              <div className="flex gap-2">
                                 {(['paint', 'erase'] as HideAreaDrawMode[]).map(mode => (
                                    <button
                                       key={mode}
                                       onClick={() => setSelectedBathTubMaskDrawMode(mode)}
                                       className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${selectedBathTubMaskDrawMode === mode ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                    >
                                       {mode === 'paint' ? '塗る' : '消す'}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <div className="flex flex-col gap-1">
                              <span className="text-[#dda15e] font-bold">ブラシ</span>
                              <div className="flex gap-2">
                                 {([1, 3, 5] as const).map(size => (
                                    <button
                                       key={size}
                                       onClick={() => setBathTubMaskBrushSize(size)}
                                       className={`px-3 py-2 rounded border font-bold cursor-pointer transition-colors ${bathTubMaskBrushSize === size ? 'bg-[#bc6c25] border-white text-white' : 'bg-black border-[#bc6c25] text-[#dda15e] hover:bg-[#3a2418]'}`}
                                    >
                                       {size}
                                    </button>
                                 ))}
                              </div>
                           </div>
                           <div className="text-[#a3b18a] font-bold whitespace-nowrap">
                              {Object.keys(bathTubMaskTiles).filter(key => key.startsWith('house_')).length} マス
                           </div>
                           <button
                              onClick={() => { if(window.confirm('湯船マスクのマス指定をクリアしますか？')) {
                                 setBathTubMaskTiles(prev => {
                                    const next = { ...prev };
                                    Object.keys(next).forEach(key => {
                                       if (key.startsWith('house_')) delete next[key];
                                    });
                                    return next;
                                 });
                              } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors self-end"
                           >
                              クリア
                           </button>
                           {currentMap !== 'house' && (
                              <div className="text-yellow-200 font-bold whitespace-nowrap">
                                 家マップで調整
                              </div>
                           )}
                        </div>
                     </div>
                   </>
                ) : setupMode === 'crops' ? (
                   <>
                     <div className="absolute top-1 left-4 bg-green-600 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">作物設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">畑の斜めマスをクリックして、作物を植える/抜くを切り替えます。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">四隅の丸いハンドルをドラッグすると、畑の形に合わせてグリッドを調整できます。</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                           {(['left', 'right'] as FieldId[]).map(fieldId => (
                              <div key={fieldId} className="flex flex-col gap-1">
                                 <span className="text-[#dda15e] font-bold">{fieldId === 'left' ? '左畑' : '右畑'}</span>
                                 <div className="flex gap-2">
                                    <label className="flex items-center gap-1">列:
                                       <input
                                          type="number"
                                          min="1"
                                          max="60"
                                          value={fieldGridSizes[fieldId].cols}
                                          onChange={(e) => updateFieldGridSize(fieldId, 'cols', Number(e.target.value))}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-12 px-1 text-center font-bold"
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">行:
                                       <input
                                          type="number"
                                          min="1"
                                          max="60"
                                          value={fieldGridSizes[fieldId].rows}
                                          onChange={(e) => updateFieldGridSize(fieldId, 'rows', Number(e.target.value))}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-12 px-1 text-center font-bold"
                                       />
                                    </label>
                                 </div>
                              </div>
                           ))}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                           <button 
                              onClick={() => { if(window.confirm('畑グリッドの四隅を初期位置に戻しますか？')) resetFieldCorners(); }} 
                              className="bg-[#4a5823] hover:bg-[#60732d] text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              畑位置リセット
                           </button>
                           <button 
                              onClick={() => { if(window.confirm('畑の列数・行数を初期値に戻しますか？作物配置はクリアされます。')) resetFieldGridSizes(); }} 
                              className="bg-[#4a5823] hover:bg-[#60732d] text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              マス数リセット
                           </button>
                           <button 
                              onClick={() => { if(window.confirm('すべての作物をクリアしますか？')) { setPlantedCrops({}); localStorage.removeItem('farm_planted_crops'); } }} 
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              作物を全クリア
                           </button>
                        </div>
                     </div>
                   </>
                ) : setupMode === 'bed' ? (
                   <>
                     <div className="absolute top-1 left-4 bg-violet-600 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">イベント設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">イベント種別を選び、クリックまたはドラッグで反応範囲を指定します。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">
                              {selectedEventTileType === 'bed'
                                 ? (currentMap === 'house' ? '紫色のマスに入ると「眠る？」が表示されます。' : 'ベッドは家マップで設定してください。')
                                 : selectedEventTileType === 'workbench'
                                    ? '青色のマスに入ると「クラフトする？」が表示されます。'
                                    : selectedEventTileType === 'fishing'
                                       ? '水色のマスに入ると「釣りをする？」が表示されます。'
                                       : selectedEventTileType === 'mining'
                                          ? '灰色のマスに入ると採掘イベント用の反応範囲になります。'
                                          : selectedEventTileType === 'logging'
                                             ? '緑色のマスに入ると伐採イベント用の反応範囲になります。'
                                             : selectedEventTileType === 'inspect'
                                                ? 'マップクリックで調べられる場所を作成します。Enter または Space で調べられます。'
                                                : 'マップクリックで自動イベント領域を作成します。範囲に入ると画像・動画・SE・VOICEを自動再生します。'}
                           </p>
                        </div>
                        <div className="flex items-center gap-2">
                           <button
                              onClick={() => setSelectedEventTileType('bed')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'bed' ? 'bg-violet-600 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              🛏 ベッド
                           </button>
                           <button
                              onClick={() => setSelectedEventTileType('workbench')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'workbench' ? 'bg-sky-600 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              🛠 作業台
                           </button>
                           <button
                              onClick={() => setSelectedEventTileType('fishing')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'fishing' ? 'bg-cyan-600 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              🎣 釣り
                           </button>
                           <button
                              onClick={() => setSelectedEventTileType('mining')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'mining' ? 'bg-stone-600 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              ⛏ 採掘
                           </button>
                           <button
                              onClick={() => setSelectedEventTileType('logging')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'logging' ? 'bg-emerald-700 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              🪓 伐採
                           </button>
                           <button
                              onClick={() => setSelectedEventTileType('inspect')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'inspect' ? 'bg-fuchsia-700 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              🔎 調査
                           </button>
                           <button
                              onClick={() => setSelectedEventTileType('auto')}
                              className={`text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors border ${selectedEventTileType === 'auto' ? 'bg-rose-700 border-white text-white' : 'bg-[#2d1b15] border-[#dda15e] text-[#dda15e] hover:bg-[#4a5823]'}`}
                           >
                              🎬 自動イベント
                           </button>
                           <button
                              onClick={() => {
                                 const next = createDefaultBedTiles();
                                 setBedTiles(next);
                                 saveBedTiles(next);
                              }}
                              className="bg-[#4a5823] hover:bg-[#60732d] text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              ベッド初期化
                           </button>
                           <button
                              onClick={() => { if(window.confirm('ベッド判定マスをすべてクリアしますか？')) { setBedTiles({}); saveBedTiles({}); } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              ベッド全クリア
                           </button>
                           <button
                              onClick={() => { if(window.confirm('作業台判定マスをすべてクリアしますか？')) { setWorkbenchTiles({}); } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              作業台全クリア
                           </button>
                           <button
                              onClick={() => { if(window.confirm('釣りポイントをすべてクリアしますか？')) { setFishingTiles({}); } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              釣り全クリア
                           </button>
                           <button
                              onClick={() => { if(window.confirm('採掘ポイントをすべてクリアしますか？')) { setMiningTiles({}); } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              採掘全クリア
                           </button>
                           <button
                              onClick={() => { if(window.confirm('伐採ポイントをすべてクリアしますか？')) { setLoggingTiles({}); } }}
                              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors"
                           >
                              伐採全クリア
                           </button>
                        </div>
                        {(selectedEventTileType === 'inspect' || selectedEventTileType === 'auto') && selectedInspectSpotId && (() => {
                           const spot = inspectSpots.find(s => s.id === selectedInspectSpotId);
                           if (!spot) return null;
                           if (selectedEventTileType === 'auto' && !spot.autoTrigger) return null;
                           if (selectedEventTileType === 'inspect' && spot.autoTrigger) return null;
                           const updateSpot = (patch: Partial<InspectSpot>) => {
                              setInspectSpots(prev => prev.map(s => s.id === selectedInspectSpotId ? { ...s, ...patch } : s));
                           };
                           const isAutoEventSpot = Boolean(spot.autoTrigger);
                           return (
                              <div className="flex gap-3 items-center bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                                 <div className="flex flex-col gap-1 w-36">
                                    <span className="text-[#dda15e] font-bold">表示名</span>
                                    <input
                                       value={spot.label}
                                       onChange={(e) => updateSpot({ label: e.target.value })}
                                       className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-1"
                                    />
                                    <span className="text-[#dda15e] font-bold">本文</span>
                                    <textarea
                                       value={spot.text}
                                       onChange={(e) => updateSpot({ text: e.target.value })}
                                       className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-1 h-16 resize-none"
                                    />
                                 </div>
                                 {isAutoEventSpot && (
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 w-[360px]">
                                       {[
                                          ['画像', 'imageSrc', 'event.png'],
                                          ['動画', 'videoSrc', 'event.mp4'],
                                          ['SE', 'seSrc', 'event.mp3'],
                                          ['VOICE', 'voiceSrc', 'voice.mp3'],
                                       ].map(([label, key, placeholder]) => (
                                          <label key={key} className="flex flex-col gap-1">
                                             <span className="text-[#dda15e] font-bold">{label}</span>
                                             <div className="flex gap-1">
                                                <input
                                                   value={(spot[key as keyof InspectSpot] as string | undefined) ?? ''}
                                                   placeholder={placeholder}
                                                   onChange={(e) => updateSpot({ [key]: e.target.value } as Partial<InspectSpot>)}
                                                   className="min-w-0 flex-1 bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-1"
                                                />
                                                {(key === 'seSrc' || key === 'voiceSrc') && (
                                                   <button
                                                      type="button"
                                                      onClick={() => playEventAudio((spot[key as keyof InspectSpot] as string | undefined) ?? '', key === 'seSrc' ? 'se' : 'voice')}
                                                      className="bg-[#4a5823] hover:bg-[#60732d] border border-[#a3b18a] rounded px-2 text-[10px] font-bold cursor-pointer"
                                                   >
                                                      試聴
                                                   </button>
                                                )}
                                             </div>
                                          </label>
                                       ))}
                                    </div>
                                 )}
                                 <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    {(['x', 'y', 'w', 'h'] as const).map(key => (
                                       <label key={key} className="flex items-center gap-1 uppercase">
                                          {key}:
                                          <input
                                             type="number"
                                             value={Math.round(spot[key])}
                                             onChange={(e) => updateSpot({ [key]: Number(e.target.value) })}
                                             className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold"
                                          />
                                       </label>
                                    ))}
                                 </div>
                                 <button
                                    onClick={() => {
                                       setInspectSpots(prev => prev.filter(s => s.id !== selectedInspectSpotId));
                                       setSelectedInspectSpotId(null);
                                    }}
                                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-2 py-1 rounded transition-colors self-stretch flex items-center cursor-pointer"
                                 >
                                    削除
                                 </button>
                              </div>
                           );
                        })()}
                     </div>
                   </>
                ) : (
                   <>
                     <div className="absolute top-1 left-4 bg-green-600 border-[2px] border-[#fdf6e3] rounded-md px-3 py-[2px] text-xs font-bold text-white shadow-sm">扉設定中</div>
                     <div className="flex gap-6 h-full items-center w-full">
                        <div className="flex-grow select-none">
                           <p className="text-[17px] font-bold">マップクリックで新しい扉を作成、枠をクリックして選択します。</p>
                           <div className="flex gap-4 items-center mt-1">
                              <p className="text-[#a3b18a] text-[13px]">設定はブラウザに自動保存されます。</p>
                              <button 
                                 onClick={() => { if(window.confirm('すべての扉設定を初期状態にリセットしますか？')) { setDoors(ensureRequiredRouteDoors(defaultDoors)); localStorage.removeItem('farm_doors'); setSelectedDoorId(null); } }} 
                                 className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded cursor-pointer font-bold transition-colors"
                              >
                                 ⚠️ 扉リセット
                              </button>
                           </div>
                        </div>
                        {selectedDoorId && (() => {
                           const door = doors.find(d => d.id === selectedDoorId);
                           if (!door) return null;
                           return (
                              <div className="flex gap-4 items-center bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                                 <div className="flex flex-col gap-1">
                                    <span className="text-[#dda15e] font-bold">扉の行き先</span>
                                    <select 
                                       value={door.targetMap} 
                                       onChange={(e) => {
                                          const val = e.target.value as GameMap;
                                          setDoors(prev => {
                                             const next = prev.map(d => d.id === selectedDoorId ? { ...d, targetMap: val } : d);
                                             localStorage.setItem('farm_doors', JSON.stringify(next));
                                             return next;
                                          });
                                       }}
                                       className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded px-1 cursor-pointer"
                                    >
                                       <option value="farm">牧場 (farm)</option>
                                       <option value="house">家 (house)</option>
                                       <option value="shed">小屋 (shed)</option>
                                       <option value="waterfall">滝 (waterfall)</option>
                                       <option value="kawa">川 (kawa)</option>
                                       <option value="doukutsu">洞窟 (doukutsu)</option>
                                       <option value="takiura">滝裏 (takiura)</option>
                                    </select>
                                 </div>
                                 <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    <label className="flex items-center gap-1">X:
                                       <input 
                                          type="number" 
                                          value={Math.round(door.x)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setDoors(prev => {
                                                const next = prev.map(d => d.id === selectedDoorId ? { ...d, x: val } : d);
                                                localStorage.setItem('farm_doors', JSON.stringify(next));
                                                return next;
                                             });
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">Y:
                                       <input 
                                          type="number" 
                                          value={Math.round(door.y)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setDoors(prev => {
                                                const next = prev.map(d => d.id === selectedDoorId ? { ...d, y: val } : d);
                                                localStorage.setItem('farm_doors', JSON.stringify(next));
                                                return next;
                                             });
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">W:
                                       <input 
                                          type="number" 
                                          value={Math.round(door.w)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setDoors(prev => {
                                                const next = prev.map(d => d.id === selectedDoorId ? { ...d, w: val } : d);
                                                localStorage.setItem('farm_doors', JSON.stringify(next));
                                                return next;
                                             });
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1">H:
                                       <input 
                                          type="number" 
                                          value={Math.round(door.h)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setDoors(prev => {
                                                const next = prev.map(d => d.id === selectedDoorId ? { ...d, h: val } : d);
                                                localStorage.setItem('farm_doors', JSON.stringify(next));
                                                return next;
                                             });
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                 </div>
                                 <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    <label className="flex items-center gap-1 text-[10px]">出現X:
                                       <input 
                                          type="number" 
                                          value={Math.round(door.spawnX)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setDoors(prev => {
                                                const next = prev.map(d => d.id === selectedDoorId ? { ...d, spawnX: val } : d);
                                                localStorage.setItem('farm_doors', JSON.stringify(next));
                                                return next;
                                             });
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                    <label className="flex items-center gap-1 text-[10px]">出現Y:
                                       <input 
                                          type="number" 
                                          value={Math.round(door.spawnY)} 
                                          onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setDoors(prev => {
                                                const next = prev.map(d => d.id === selectedDoorId ? { ...d, spawnY: val } : d);
                                                localStorage.setItem('farm_doors', JSON.stringify(next));
                                                return next;
                                             });
                                          }}
                                          className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-14 px-1 text-center font-bold" 
                                       />
                                    </label>
                                 </div>
                                 <button 
                                    onClick={() => {
                                       setDoors(prev => {
                                          const next = prev.filter(d => d.id !== selectedDoorId);
                                          localStorage.setItem('farm_doors', JSON.stringify(next));
                                          return next;
                                       });
                                       setSelectedDoorId(null);
                                    }} 
                                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-2 py-1 rounded transition-colors self-stretch flex items-center cursor-pointer"
                                 >
                                    削除
                                 </button>
                              </div>
                           );
                        })()}
                     </div>
                   </>
                )}
        </DialogBox>

        <DebugPanel
           setupMode={setupMode}
           debugPanelPos={debugPanelPos}
           handleDebugDragStart={handleDebugDragStart}
           setTurn={setTurn}
           timeOfDay={timeOfDay}
           currentMap={currentMap}
           getMapLabel={getMapLabel}
           currentMapBgmSource={currentMapBgmSource}
           setCurrentMapBgmSource={setCurrentMapBgmSource}
           currentMapBgmLabel={currentMapBgmLabel}
           BGM_FILE_ENTRIES={BGM_FILE_ENTRIES}
           bgmVolume={bgmVolume}
           setBgmVolume={setBgmVolume}
           seVolume={seVolume}
           setSeVolume={setSeVolume}
           voiceVolume={voiceVolume}
           setVoiceVolume={setVoiceVolume}
           selectedAudioFile={selectedAudioFile}
           setSelectedAudioFile={setSelectedAudioFile}
           selectedAudioGain={selectedAudioGain}
           setSelectedAudioGain={setSelectedAudioGain}
           setAllAudioGains={setAllAudioGains}
           AUDIO_FILE_ENTRIES={AUDIO_FILE_ENTRIES}
           opacityMap={opacityMap}
           opacityLevel={opacityLevel}
           setOpacityLevel={setOpacityLevel}
           showDialog={showDialog}
           setShowDialog={setShowDialog}
           fishingFanRodLabel={equippedFishingRod}
           fishingFanWidth={fishingFanConfig.width}
           setFishingFanWidth={setFishingFanWidth}
           fishingFanHeight={fishingFanConfig.height}
           setFishingFanHeight={setFishingFanHeight}
           fishingFanOpacity={fishingFanConfig.opacity}
           setFishingFanOpacity={setFishingFanOpacity}
           fishingFanSweetMin={fishingFanSweetMin}
           setFishingFanSweetMin={setFishingFanSweetMin}
           fishingFanSweetMax={fishingFanSweetMax}
           setFishingFanSweetMax={setFishingFanSweetMax}
           debugDialogueOptions={debugDialogueOptions}
           onSaveDebugDialogue={saveDebugDialogueOverride}
           onResetDebugDialogue={resetDebugDialogueOverride}
        />
        {craftConfirmRecipeName && (
           <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/62 px-8 pointer-events-auto">
              <div className="w-[520px] rounded-xl border-4 border-[#ffd166] bg-[#1a100d]/96 p-6 text-center text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
                 <div className="text-2xl font-black">クラフトする？</div>
                 <div className="mt-3 text-lg font-bold text-[#ffd166]">
                    {CRAFT_RECIPE_CONFIGS[craftConfirmRecipeName].output}を作ります。
                 </div>
                 <div className="mt-4 rounded-lg border border-[#bc6c25]/70 bg-black/30 p-3 text-left text-sm font-bold text-[#fdf6e3]">
                    {Object.entries(CRAFT_RECIPE_CONFIGS[craftConfirmRecipeName].materials).map(([materialName, count]) => (
                       <div key={materialName} className="flex justify-between">
                          <span>{materialName}</span>
                          <span>{inventoryCounts[materialName] ?? 0} / {count}</span>
                       </div>
                    ))}
                 </div>
                 <div className="mt-6 flex justify-center gap-4">
                    <button
                       type="button"
                       onMouseEnter={() => setConfirmPromptChoice('yes')}
                       onClick={() => startCraftMiniGame(craftConfirmRecipeName)}
                       className={`h-[52px] w-[128px] rounded-lg border-2 bg-[#4a5823] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#60732d] ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                    >
                       はい
                    </button>
                    <button
                       type="button"
                       onMouseEnter={() => setConfirmPromptChoice('no')}
                       onClick={() => { playFixSound(); setCraftConfirmRecipeName(null); }}
                       className={`h-[52px] w-[128px] rounded-lg border-2 bg-[#5a2a1f] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#753527] ${confirmPromptChoice === 'no' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#bc6c25]'}`}
                    >
                       いいえ
                    </button>
                 </div>
              </div>
           </div>
        )}

        {craftInsufficientRecipeName && (
           <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/62 px-8 pointer-events-auto">
              <div className="w-[520px] rounded-xl border-4 border-[#bc6c25] bg-[#1a100d]/96 p-6 text-center text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
                 <div className="text-2xl font-black">素材が足りません</div>
                 <div className="mt-4 rounded-lg border border-[#bc6c25]/70 bg-black/30 p-3 text-left text-sm font-bold text-[#fdf6e3]">
                    {Object.entries(CRAFT_RECIPE_CONFIGS[craftInsufficientRecipeName].materials).map(([materialName, count]) => {
                       const owned = inventoryCounts[materialName] ?? 0;
                       return (
                          <div key={materialName} className={`flex justify-between ${owned < count ? 'text-[#ffb4a2]' : 'text-[#bbf7d0]'}`}>
                             <span>{materialName}</span>
                             <span>{owned} / {count}</span>
                          </div>
                       );
                    })}
                 </div>
                 <button
                    type="button"
                    onClick={() => { playFixSound(); setCraftInsufficientRecipeName(null); }}
                    className="mt-6 h-[52px] w-[220px] rounded-lg border-2 border-[#ffd166] bg-[#7a4317] text-lg font-black text-[#fff7dc] transition-colors hover:bg-[#9a5a1d]"
                 >
                    素材が足りません
                 </button>
              </div>
           </div>
        )}

        {craftMiniGameOpen && (
           <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/82 px-8 py-6 pointer-events-auto">
              <div className="relative h-[min(88vh,820px)] w-[min(92vw,1180px)] overflow-hidden rounded-2xl border-4 border-[#67e8f9] bg-[#1a100d] text-[#fdf6e3] shadow-[0_30px_80px_rgba(0,0,0,0.75),0_0_32px_rgba(103,232,249,0.28)]">
                 <img src="/img/kurafuto1.jpg" alt="" className="craft-dissolve-a absolute inset-0 h-full w-full object-cover" />
                 <img src="/img/kurafuto2.jpg" alt="" className="craft-dissolve-b absolute inset-0 h-full w-full object-cover" />
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(20,83,45,0.22),rgba(0,0,0,0.62)_68%)]" />
                 <div className="absolute left-6 right-6 top-5 z-10 flex items-start justify-between gap-4">
                    <div className="rounded-xl border-2 border-[#67e8f9]/80 bg-[#1a100d]/90 px-5 py-3 shadow-[0_14px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.16)]">
                       <div className="text-xs font-black tracking-[0.22em] text-[#67e8f9]">{craftMiniGameRecipeName ? 'CRAFT TIMING' : 'LOGGING TIMING'}</div>
                       <div className="text-2xl font-black">{craftMiniGameRecipeName ? CRAFT_RECIPE_CONFIGS[craftMiniGameRecipeName].output : '伐採'}</div>
                       <div className="mt-1 text-sm font-bold text-[#ffd166]">{craftMiniGameRecipeName ? '光る円をクリックして成功率を上げよう' : '光る円をクリックして木材を切り出そう'}</div>
                    </div>
                    <div className="rounded-xl border-2 border-[#ffd166]/80 bg-[#2d1414]/88 px-5 py-3 text-right shadow-[0_14px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)]">
                       <div className="text-xs font-black tracking-[0.18em] text-[#ffd166]">TARGET</div>
                       <div className="text-xl font-black">{craftMiniGameSpawnedCount} / {craftMiniGameTargetCount}</div>
                    </div>
                 </div>
                 <div className="absolute inset-x-8 bottom-8 z-10 rounded-2xl border-2 border-[#fdf6e3]/70 bg-[#1a100d]/88 p-5 shadow-[0_18px_34px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.18)]">
                    <div className="mb-3 flex items-center justify-between text-sm font-black tracking-[0.08em]">
                       <span className="text-[#67e8f9]">CRAFT RATE</span>
                       <span className={craftMiniGameScore >= 70 ? 'text-[#fde047] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]' : 'text-[#fdf6e3]'}>{Math.round(craftMiniGameScore)}%</span>
                    </div>
                    <div className="relative h-12 overflow-hidden rounded-full border-2 border-[#fdf6e3]/90 bg-[linear-gradient(180deg,#120907,#050302)] shadow-[inset_0_5px_12px_rgba(0,0,0,0.86),0_5px_0_rgba(0,0,0,0.42)]">
                       <div className="absolute inset-y-0 left-[70%] w-[30%] bg-[linear-gradient(180deg,rgba(255,241,118,0.34),rgba(234,179,8,0.2)_48%,rgba(133,77,14,0.3))]" />
                       <div
                          className="craft-rate-fill h-full transition-all duration-200"
                          style={{ width: `${Math.min(100, craftMiniGameScore)}%` }}
                       />
                       <div className="absolute inset-x-2 top-[5px] h-[34%] rounded-full bg-white/30 blur-[1px]" />
                       <div className="absolute inset-x-0 bottom-0 h-[38%] bg-black/22" />
                       <div className="absolute left-[70%] top-0 h-full w-[4px] bg-[#fff7dc] shadow-[0_0_10px_rgba(255,255,255,1),0_0_18px_rgba(250,204,21,0.8)]" />
                       <div className="absolute left-[calc(70%+10px)] top-1/2 -translate-y-1/2 text-xs font-black tracking-[0.18em] text-[#fde047] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">SUCCESS</div>
                    </div>
                 </div>
                 {craftMiniGameCircles.map(circle => (
                    <button
                       key={circle.id}
                       type="button"
                       onClick={() => handleCraftCircleClick(circle.id)}
                       className="craft-click-circle absolute z-20 rounded-full border-[5px] border-[#fdf6e3] bg-[#67e8f9]/28 shadow-[0_0_24px_rgba(103,232,249,0.95),0_0_42px_rgba(255,209,102,0.42),inset_0_0_18px_rgba(255,255,255,0.62)]"
                       style={{
                          left: `${circle.x}%`,
                          top: `${circle.y}%`,
                          width: circle.size,
                          height: circle.size,
                          marginLeft: -circle.size / 2,
                          marginTop: -circle.size / 2,
                          animationDuration: `${circle.durationMs}ms`,
                       }}
                       aria-label="クラフト円"
                    />
                 ))}
                 {craftMiniGameResult && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/68">
                       <div className="w-[460px] rounded-xl border-4 border-[#ffd166] bg-[#1a100d]/96 p-7 text-center shadow-2xl">
                          <div className={`text-4xl font-black ${craftMiniGameResult === 'success' ? 'text-[#fde047]' : 'text-[#ffb4a2]'}`}>
                             {craftMiniGameRecipeName
                                ? (craftMiniGameResult === 'success' ? 'クラフト成功！' : 'クラフト失敗')
                                : (craftMiniGameResult === 'success' ? '伐採成功！' : '伐採失敗')}
                          </div>
                          <div className="mt-3 text-lg font-bold text-[#fdf6e3]">成功率 {Math.round(craftMiniGameScore)}%</div>
                          <button
                             type="button"
                             onClick={closeCraftMiniGame}
                             className="mt-6 h-[52px] w-[160px] rounded-lg border-2 border-[#ffd166] bg-[#8d6420] text-lg font-black text-white hover:bg-[#b87924]"
                          >
                             閉じる
                          </button>
                       </div>
                    </div>
                 )}
              </div>
           </div>
        )}
        {recipeDetailOpen && selectedRecipeDetail && createPortal(
           <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/62 px-8 py-6 pointer-events-auto"
              onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setRecipeDetailOpen(false); }}
           >
              <div className="recipe-detail-modal relative h-[min(86vh,820px)] w-[min(72vw,690px)]" onClick={(event) => event.stopPropagation()}>
                 <img src="/img/recipe.jpg" alt={selectedRecipeDetail.title} className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_28px_70px_rgba(0,0,0,0.72)]" />
                 <button
                    type="button"
                    onClick={() => { playFixSound(); setRecipeDetailOpen(false); }}
                    className="absolute right-[10%] top-[7%] z-20 flex h-10 w-10 items-center justify-center rounded border border-[#5b3518]/70 bg-[#2b160b]/80 text-xl font-black text-[#fff1b8] hover:bg-[#5a2c13]"
                    aria-label="レシピを閉じる"
                 >
                    ×
                 </button>
                 <div className="recipe-detail-text absolute left-[15%] right-[15%] top-[14%] bottom-[11%] z-10 flex flex-col text-[#3b2212]">
                    <div className="text-center text-[30px] font-black leading-tight text-[#2b170d]">{selectedRecipeDetail.title}</div>
                    <div className="mt-8 text-[20px] font-black leading-tight">必要素材</div>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-[20px] font-black leading-tight">
                       {selectedRecipeDetail.materials.map(material => (
                          <div key={material}>{material}</div>
                       ))}
                    </div>
                    <div className="mt-8 text-[20px] font-black leading-tight">手順</div>
                    <div className="mt-2 flex flex-col gap-2 text-[18px] font-black leading-[1.55]">
                       {selectedRecipeDetail.steps.map(step => (
                          <div key={step}>{step}</div>
                       ))}
                    </div>
                    <div className="mt-auto pb-7 text-[16px] font-black leading-[1.55]">{selectedRecipeDetail.note}</div>
                 </div>
              </div>
           </div>
        , document.body)}
      </div>
     </div>
    </div>
  );
}
