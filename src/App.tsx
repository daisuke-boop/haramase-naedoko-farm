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
import { BATTLE_EQUIPMENT_DATA, BEAST_BATTLE_DATA, BEAST_DROP_DATA, BEAST_DROP_SELL_PRICES, HERO_BATTLE_STATS_BY_LEVEL, type BattleStats, type BeastId } from './data/battleData';
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
  getMiningRewardQuantity,
  getMiningWeightMultiplier,
  getOreQualityPercent,
  getOreRarityTier,
  getOreSellPrice,
  isPickaxeName,
  selectOreReward,
  selectOreRewardWithPerformance,
  type PickaxeName,
} from './data/miningData';
import { FARM_GIRL_CROP_DATA, getFarmHarvestSellPrice, type FarmGirlCropData } from './data/farmData';
import { getFarmFieldConfig, getInitiallyUnlockedFarmFieldConfigs, isFarmFieldInitiallyUnlocked } from './data/farmFieldData';
import { GIRL_DATA } from './data/girlData';
import { GIRL_SEED_ACQUISITION_DATA, INITIAL_OWNED_GIRL_SEEDS } from './data/girlSeedAcquisitionData';
import {
  createDebugInventoryCounts,
  getItemCountIncludingDebug,
  toBaseItemName,
  toDebugItemName,
} from './data/debugItemData';
import {
  HERO_SKILL_CATEGORIES,
  HERO_SKILL_CATEGORY_LABELS,
  HERO_SKILL_DATA,
  getHeroSkillById,
  getHeroSkillsByCategory,
  type HeroSkillCategory,
  type HeroSkillData,
} from './data/heroSkillData';
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

const TITLE_START_TRANSITION_MS = 1500;
const TITLE_START_SOUND_SRC = '/se/start.mp3';
const CURRENT_SAVE_SCHEMA_VERSION = 2;
const MIN_DIRECT_LOAD_SAVE_SCHEMA_VERSION = 2;

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
const POST_EVENT_IMAGE_SRC = 'post.jpg';
const POST_DEBT_NOTICE_IMAGE_SRC = '/img/shakuyousho.png';
const POST_DEBT_NOTICE_SOUND_SRC = '/se/shock.mp3';
const POST_DEBT_NOTICE_SEEN_STORAGE_KEY = 'farm_post_debt_notice_seen';
const POST_DEBT_NOTICE_REPEAT_TEXT = 'お爺さんが危ない連中から借りた借用書が入っている。';
const isPostDebtNoticeEvent = (spot: InspectSpot | null) => {
  if (!spot) return false;
  const imageSrc = spot.imageSrc?.trim().replace(/^\/+/, '');
  return spot.label === 'ポスト' && imageSrc === POST_EVENT_IMAGE_SRC;
};
const hasSeenPostDebtNotice = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(POST_DEBT_NOTICE_SEEN_STORAGE_KEY) === 'true';
};
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

const NEW_GAME_START_POSITION = { x: 610, y: 700 } as const;
const OPENING_WALK_OBJECTIVE = 'まずは村を歩き回ってみよう！';
const KURUMI_INTRO_OBJECTIVE = 'くるみに話しかけて村のことを聞こう！';
const OPENING_MAP_TRANSITIONS_BEFORE_KURUMI = 2;

const defaultDoors: WarpDoor[] = [
  // 牧場 -> 家 (左上)
  { id: 'door_to_house', map: 'farm', targetMap: 'house', x: 420, y: 320, w: 60, h: 60, spawnX: 960, spawnY: 770 },
  // 牧場 -> 小屋 (右下付近)
  { id: 'door_to_shed', map: 'farm', targetMap: 'shed', x: 1560, y: 640, w: 60, h: 60, spawnX: 960, spawnY: 650 },
  // 家 -> 牧場 (下部の出口)
  { id: 'door_house_exit', map: 'house', targetMap: 'farm', x: 930, y: 1000, w: 100, h: 60, spawnX: NEW_GAME_START_POSITION.x, spawnY: NEW_GAME_START_POSITION.y },
  // 小屋 -> 牧場 (下部の出口)
  { id: 'door_shed_exit', map: 'shed', targetMap: 'farm', x: 930, y: 1000, w: 100, h: 60, spawnX: 1560, spawnY: 745 },
  // 牧場 -> 洞窟
  { id: 'door_to_doukutsu', map: 'farm', targetMap: 'doukutsu', x: 1000, y: 100, w: 60, h: 60, spawnX: 960, spawnY: 900 },
  // 洞窟 -> 牧場
  { id: 'door_doukutsu_exit', map: 'doukutsu', targetMap: 'farm', x: 930, y: 1000, w: 100, h: 60, spawnX: 1080, spawnY: 250 },
];

const requiredRouteDoors: WarpDoor[] = [
  { id: 'door_to_waterfall', map: 'farm', targetMap: 'waterfall', x: 940, y: 320, w: 70, h: 50, spawnX: 930, spawnY: 940 },
  { id: 'door_waterfall_exit', map: 'waterfall', targetMap: 'farm', x: 890, y: 1020, w: 120, h: 60, spawnX: 970, spawnY: 455 },
  { id: 'door_1781485591085', map: 'farm', targetMap: 'kawa', x: 920, y: 1040, w: 60, h: 60, spawnX: 940, spawnY: 170 },
  { id: 'door_1781485617403', map: 'kawa', targetMap: 'farm', x: 870, y: 0, w: 140, h: 80, spawnX: 950, spawnY: 985 },
];

const DOOR_SPAWN_CLEARANCE_PX = 90;
const DOOR_SPAWN_MAX_FIX_PASSES = 4;

const clampDoorSpawn = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const getDistanceToDoorRect = (x: number, y: number, door: WarpDoor) => {
  const dx = Math.max(door.x - x, 0, x - (door.x + door.w));
  const dy = Math.max(door.y - y, 0, y - (door.y + door.h));
  return Math.hypot(dx, dy);
};

const pushSpawnAwayFromDoor = (door: WarpDoor, blockingDoor: WarpDoor): WarpDoor => {
  const centerX = blockingDoor.x + blockingDoor.w / 2;
  const centerY = blockingDoor.y + blockingDoor.h / 2;
  const dx = door.spawnX - centerX;
  const dy = door.spawnY - centerY;
  const useHorizontal = Math.abs(dx / Math.max(1, blockingDoor.w)) > Math.abs(dy / Math.max(1, blockingDoor.h));

  if (useHorizontal) {
    const direction = dx >= 0 ? 1 : -1;
    return {
      ...door,
      spawnX: clampDoorSpawn(
        centerX + direction * (blockingDoor.w / 2 + DOOR_SPAWN_CLEARANCE_PX),
        30,
        GAME_WIDTH - 30,
      ),
    };
  }

  const direction = dy >= 0 ? 1 : -1;
  return {
    ...door,
    spawnY: clampDoorSpawn(
      centerY + direction * (blockingDoor.h / 2 + DOOR_SPAWN_CLEARANCE_PX),
      50,
      GAME_HEIGHT - 10,
    ),
  };
};

const ensureSafeDoorSpawns = (doors: WarpDoor[]) => {
  let next = doors;
  for (let pass = 0; pass < DOOR_SPAWN_MAX_FIX_PASSES; pass += 1) {
    let changed = false;
    next = next.map(door => {
      const blockingDoor = next.find(candidate => (
        candidate.id !== door.id &&
        candidate.map === door.targetMap &&
        getDistanceToDoorRect(door.spawnX, door.spawnY, candidate) < DOOR_SPAWN_CLEARANCE_PX
      ));
      if (!blockingDoor) return door;
      changed = true;
      return pushSpawnAwayFromDoor(door, blockingDoor);
    });
    if (!changed) break;
  }
  return next;
};

const ensureRequiredRouteDoors = (doors: WarpDoor[]) => {
  const requiredRouteKeys = new Set(requiredRouteDoors.map(door => `${door.map}->${door.targetMap}`));
  const next = doors.filter(door => !requiredRouteKeys.has(`${door.map}->${door.targetMap}`));
  requiredRouteDoors.forEach(routeDoor => {
    next.push(routeDoor);
  });
  return ensureSafeDoorSpawns(next);
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

const getBgmEffectiveVolume = (src: string, categoryVolume: number, audioGains: Record<string, number>) => {
  return src === TITLE_BGM_SRC || src.endsWith(TITLE_BGM_SRC)
    ? Math.min(1, categoryVolume * TITLE_BGM_VOLUME_MULTIPLIER)
    : getEffectiveVolume(src, categoryVolume, audioGains);
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
  category?: string;
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
type MiningTutorialStep = 'arrows' | 'timing' | 'reward';
type SeedAfterPlantTutorialStep = 'rooted' | 'growth_days' | 'care';
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
type KurumiIntroTopicId = 'village' | 'debt' | 'naedoko' | 'pantsu' | 'grandpa';
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

type GameMode = 'story' | 'endlessNursery';
type TitleTheme = 'default' | 'endlessUnlocked';
type CollectionProgress = {
  collectedGirlIds: string[];
  caughtFishIds: string[];
  craftedItemIds: string[];
  unlockedEventIds: string[];
  defeatedBeastIds: string[];
};

type EndlessStats = {
  daysPlayed: number;
  totalHarvestCount: number;
  totalFishCaught: number;
  totalTreesCut: number;
  totalOresMined: number;
  totalBeastsDefeated: number;
  totalGirlsCollected: number;
  totalTrustEventsUnlocked: number;
  totalMoneyEarned: number;
};

const createInitialCollectionProgress = (): CollectionProgress => ({
  collectedGirlIds: [],
  caughtFishIds: [],
  craftedItemIds: [],
  unlockedEventIds: [],
  defeatedBeastIds: [],
});

const createInitialEndlessStats = (): EndlessStats => ({
  daysPlayed: 0,
  totalHarvestCount: 0,
  totalFishCaught: 0,
  totalTreesCut: 0,
  totalOresMined: 0,
  totalBeastsDefeated: 0,
  totalGirlsCollected: 0,
  totalTrustEventsUnlocked: 0,
  totalMoneyEarned: 0,
});

const TITLE_IMAGE_SOURCES: Readonly<Record<TitleTheme, string | null>> = {
  default: '/img/titleview.jpg',
  endlessUnlocked: null,
};
const CIRCLE_INTRO_VIDEO_SRC = '/voice/circle.mp4';
const TITLE_RANDOM_VOICE_SRCS = [
  '/voice/koe/kiironingyo.wav',
  '/voice/koe/kyaro.wav',
  '/voice/koe/kyua.wav',
  '/voice/koe/roma.wav',
  '/voice/koe/shita.wav',
  '/voice/koe/viora.wav',
  '/voice/koe/mel.wav',
  '/voice/koe/nazuna.wav',
  '/voice/koe/ruby.wav',
  '/voice/koe/aoningyo.wav',
  '/voice/koe/kabuna.wav',
  '/voice/koe/momona.wav',
  '/voice/koe/chibiichi.wav',
  '/voice/koe/puthi.wav',
  '/voice/koe/pinkningyo.wav',
  '/voice/koe/pan.wav',
  '/voice/koe/safi.wav',
  '/voice/koe/shiro.wav',
] as const;
const DEFAULT_MASTER_VOLUME = 0.1;
const TITLE_BGM_VOLUME_MULTIPLIER = 0.25;
const ENDLESS_NURSERY_UNLOCK_STORAGE_KEY = 'farm_has_unlocked_endless_nursery_mode';

type FarmGirlState = 'none' | 'planted' | 'growing' | 'appeared' | 'companion' | 'lover';
type FarmGirlCondition = 'normal' | 'affected';

type FarmGirlSaveState = {
  girlId: string;
  state: FarmGirlState;
  cardRevealed: boolean;
  plantedDay: number | null;
  growthProgress: number;
  quality: number;
  careDay: number | null;
  caressCount: number;
  fingerCount: number;
  fertilizeCount: number;
  lastHarvestDay: number | null;
  trust: number;
  unlockedTrustEventIds: string[];
  condition: FarmGirlCondition;
  conditionDay: number | null;
  conditionSource: string | null;
  hybridAdapted: boolean;
};

type FarmFieldSlotState = {
  fieldId: FieldId;
  slotIndex: number;
  girlId: string | null;
  state: Extract<FarmGirlState, 'none' | 'growing' | 'appeared'>;
  plantedDay: number | null;
};
type FarmSlotInteractionStage = 'confirmHarvest' | 'confirmPlant' | 'selectSeed' | 'confirmSeed';
const FARM_SEED_SLOT_PLACEMENTS: Readonly<Record<string, { offsetX: number; offsetY: number; scale: number }>> = {
  left_1: { offsetX: 102, offsetY: 53, scale: 86 },
  left_2: { offsetX: 101, offsetY: 53, scale: 86 },
  left_3: { offsetX: 101, offsetY: 52, scale: 86 },
  left_4: { offsetX: 101, offsetY: 52, scale: 86 },
  left_5: { offsetX: 101, offsetY: 52, scale: 86 },
  left_6: { offsetX: 101, offsetY: 53, scale: 86 },
  right_1: { offsetX: 100, offsetY: 51, scale: 86 },
  right_2: { offsetX: 101, offsetY: 52, scale: 86 },
  right_3: { offsetX: 103, offsetY: 51, scale: 86 },
  right_4: { offsetX: 102, offsetY: 52, scale: 86 },
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
type BattleEncounterType = 'test' | 'beastAttack';
type BattleTurn = 'party' | 'enemy' | 'partner';
type BattleTurnEntry = {
  kind: BattleTurn;
  unitId: string;
  speed: number;
};
type BattlePose = 'idle' | 'attack' | 'hurt' | 'defend' | 'skill';
type BattleMotionState = {
  actorId: string;
  pose: BattlePose;
  key: number;
} | null;
type BattleHitEffectState = {
  targetId: string;
  key: number;
} | null;
type BattleSupportEffectState = {
  targetId: string;
  key: number;
} | null;
type BattleDamagePopup = {
  targetId: string;
  damage: number;
  critical: boolean;
  healing: boolean;
  spRecovery: boolean;
  key: number;
};
type MiningDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';
type MiningRhythmNote = {
  id: number;
  direction: MiningDirection;
  hitAt: number;
  judgement: 'PERFECT' | 'GOOD' | 'BAD' | 'MISS' | null;
};
type MiningResultReward = {
  oreName: string;
  quantity: number;
  qualityPercent: number;
  estimatedSellPrice: number;
};
type MiningRhythmTimingsByBgm = Record<string, number[]>;

type BattlePreviewState = {
  hero: BattleUnitState & { level: number; defending: boolean };
  allies: (BattleUnitState | null)[];
  beasts: (BattleUnitState | null)[];
  logs: string[];
  result: BattlePreviewResult;
  loot: BattleLootEntry[];
  lootGranted: boolean;
  encounterType: BattleEncounterType;
  farmDamageResolved: boolean;
  turn?: BattleTurn;
  turnQueue: BattleTurnEntry[];
  turnIndex: number;
  battleSp: number;
  maxBattleSp: number;
  partnerSkillUses: number;
  partnerSkillMaxUses: number;
  partnerDropRateBonus: number;
  healingItemUses: number;
  reviveItemUses: number;
  bgmSource: string;
};
type BattlePartnerSkillDisplay = { partnerId: string; text: string; key: number } | null;
type BattleItemKind = 'heal' | 'revive';
type BattleItemSelectionStep = 'item' | 'target';
type BattleConsumableItem = {
  name: string;
  kind: BattleItemKind;
  price: number;
  desc: string;
  unlockRepaymentCount: number;
  healAmount?: number;
  reviveHpRate?: number;
};

const DIFFICULTY_ORDER: Readonly<Record<GameDifficulty, number>> = {
  easy: 0,
  normal: 1,
  hard: 2,
};
const BATTLE_BACKGROUND_SOURCES: Readonly<Record<GameDifficulty, string>> = {
  easy: '/img/battle/battle1.jpg',
  normal: '/img/battle/battle2.jpg',
  hard: '/img/battle/battle3.jpg',
};
const MOUNTAIN_LORD_BATTLE_BGM_SRC = '/bgm/battle2.mp3';
const RANDOM_BATTLE_BGM_SOURCES = ['/bgm/battle1.mp3', '/bgm/battle3.mp3'] as const;
const BATTLE_VICTORY_BGM_SOURCES: Readonly<Record<GameDifficulty, string>> = {
  easy: '/bgm/victory1.wav',
  normal: '/bgm/victory2.wav',
  hard: '/bgm/victory3.wav',
};
const BATTLE_SE_SOURCES = {
  cure: '/se/cure.mp3',
  guard: '/se/battle-bougyo.mp3',
  hit: ['/se/battle-dageki1.mp3', '/se/battle-dageki2.mp3', '/se/battle-dageki3.mp3'],
  lose: '/se/battle-lose.wav',
  skill: '/se/battle-skill.mp3',
} as const;
const PARTNER_SUPPORT_SKILL_IDS = new Set(['viola', 'kabune', 'caro', 'cure', 'shiro', 'momona', 'pan', 'puti', 'roma', 'saffy']);
const BATTLE_HEALING_ITEM_USE_LIMIT = 2;
const BATTLE_REVIVE_ITEM_USE_LIMIT = 1;
const BATTLE_CONSUMABLE_ITEMS: readonly BattleConsumableItem[] = [
  {
    name: 'いやし草もち',
    kind: 'heal',
    healAmount: 30,
    price: 4_800,
    unlockRepaymentCount: 0,
    desc: '味方1人のHPを30回復する。戦闘中の回復アイテムは1バトル合計2回まで使えます。',
  },
  {
    name: '生命ミルク',
    kind: 'heal',
    healAmount: 60,
    price: 12_000,
    unlockRepaymentCount: 1,
    desc: '味方1人のHPを60回復する。初回返済後に入荷します。',
  },
  {
    name: '女神の蜜薬',
    kind: 'heal',
    healAmount: 120,
    price: 32_000,
    unlockRepaymentCount: 2,
    desc: '味方1人のHPを120回復する高級薬。中盤以降の切り札です。',
  },
  {
    name: 'めざめの鈴',
    kind: 'revive',
    reviveHpRate: 0.25,
    price: 58_000,
    unlockRepaymentCount: 1,
    desc: '戦闘不能の味方1人をHP25%で復活させる。蘇生アイテムは1バトル合計1回まで使えます。',
  },
  {
    name: '生命の種火',
    kind: 'revive',
    reviveHpRate: 0.5,
    price: 120_000,
    unlockRepaymentCount: 2,
    desc: '戦闘不能の味方1人をHP50%で復活させる。強敵戦の保険です。',
  },
  {
    name: '天命の雫',
    kind: 'revive',
    reviveHpRate: 0.8,
    price: 300_000,
    unlockRepaymentCount: 3,
    desc: '戦闘不能の味方1人をHP80%で復活させる究極の雫。終盤の切り札です。',
  },
];
const DEBUG_BATTLE_CONSUMABLE_ITEM_NAMES = BATTLE_CONSUMABLE_ITEMS.map(item => toDebugItemName(item.name));
const getBattleConsumableItem = (name: string): BattleConsumableItem | undefined => (
  BATTLE_CONSUMABLE_ITEMS.find(item => item.name === name)
);
const BATTLE_BEAST_SPRITE_SOURCES: Readonly<Record<string, string>> = {
  mole: '/img/battle/teki-mogura.png',
  rabbit: '/img/battle/teki-usagi.png',
  monkey: '/img/battle/teki-saru.png',
  boar: '/img/battle/teki-inosisi.png',
  bear: '/img/battle/teki-kuma.png',
  great_fang_beast: '/img/battle/teki-taiga.png',
  giant_bear: '/img/battle/teki-kyoguma.png',
  mountain_lord: '/img/battle/teki-yamanonushi.png',
};
const BATTLE_GIRL_SPRITE_SOURCES: Readonly<Record<string, string>> = {
  chibiichi: '/img/battle/battle2d-ibiichi.png',
  mel: '/img/battle/battle2d-mel.png',
  ruby: '/img/battle/battle2d-ruby.png',
  viola: '/img/battle/battle2d-viora.png',
  nazuna: '/img/battle/battle2d-nazuna.png',
  kabune: '/img/battle/battle2d-kabune.png',
  caro: '/img/battle/battle2d-kyaro.png',
  theta: '/img/battle/battle2d-shita.png',
  cure: '/img/battle/battle2d-kyua.png',
  shiro: '/img/battle/battle2d-shiro.png',
  momona: '/img/battle/battle2d-momona.png',
  pan: '/img/battle/battle2d-pan.png',
  puti: '/img/battle/battle2d-puthi.png',
  roma: '/img/battle/battle2d-roma.png',
  saffy: '/img/battle/battle2d-safi.png',
};
const BATTLE_SPRITE_FRAME_COUNT = 5;
const BATTLE_BEAST_FRAME_COUNT = 5;
const BATTLE_POSE_FRAME_INDEX: Readonly<Record<BattlePose, number>> = {
  idle: 0,
  attack: 3,
  hurt: 4,
  defend: 2,
  skill: 3,
};
const BATTLE_BEAST_POSE_FRAME_INDEX: Readonly<Record<BattlePose, number>> = {
  idle: 0,
  attack: 1,
  hurt: 2,
  defend: 0,
  skill: 1,
};
const BATTLE_ENEMY_TURN_DELAY_MS = 2000;
const BATTLE_ATTACK_MOTION_DURATION_MS = 1100;
const BATTLE_RESULT_REVEAL_DELAY_MS = 1250;
const BATTLE_SKILL_SP_COST = 2;
type PartnerSkillPreview = {
  name: string;
  description: string;
  effectLabel: string;
  maxUses: 0 | 1 | 2;
};
type PartnerBattleProfile = BattleStats & { skill: PartnerSkillPreview };
const PARTNER_SKILL_PREVIEWS: Readonly<Record<string, PartnerSkillPreview>> = {
  chibiichi: { name: '固有スキルなし', description: '基本能力で戦闘を支える。', effectLabel: 'なし', maxUses: 0 },
  mel: { name: '固有スキルなし', description: '基本能力で戦闘を支える。', effectLabel: 'なし', maxUses: 0 },
  ruby: { name: '固有スキルなし', description: '基本能力で戦闘を支える。', effectLabel: 'なし', maxUses: 0 },
  viola: { name: '静謐の集中', description: '戦闘SPを回復する。', effectLabel: 'SP+2', maxUses: 1 },
  nazuna: { name: '崩し打ち', description: '敵の防御を一時的に下げる。', effectLabel: '敵防御-2', maxUses: 1 },
  kabune: { name: 'やさしい手当て', description: 'HPが減った味方を回復する。', effectLabel: 'HP+10', maxUses: 2 },
  caro: { name: '疾風の号令', description: '主人公の素早さを高める。', effectLabel: '素早さ+3', maxUses: 1 },
  theta: { name: '幸運の目利き', description: '戦利品の獲得率を高める。', effectLabel: 'ドロップ+10%', maxUses: 1 },
  cure: { name: '命のしずく', description: '瀕死の主人公を回復する。', effectLabel: 'HP+15', maxUses: 1 },
  shiro: { name: '白壁の守り', description: '受けるダメージを軽減する。', effectLabel: '被ダメ-8%', maxUses: 1 },
  momona: { name: '桃色の祝福', description: '主人公の会心率を高める。', effectLabel: '会心+5%', maxUses: 1 },
  pan: { name: 'かぼちゃの盾', description: '最初に受ける攻撃を和らげる。', effectLabel: '被ダメ-15%', maxUses: 1 },
  puti: { name: '竜火の追撃', description: '攻撃後に追撃することがある。', effectLabel: '追撃+1', maxUses: 2 },
  roma: { name: '森羅の幸運', description: '希少な戦利品を見つけやすくする。', effectLabel: 'レア率+10%', maxUses: 1 },
  saffy: { name: '黄金の加護', description: '戦闘SPを回復する。', effectLabel: 'SP+2', maxUses: 2 },
};
const PARTNER_BATTLE_PROFILES: Readonly<Record<string, PartnerBattleProfile>> = Object.fromEntries([
  ['chibiichi', [75, 14, 5, 7]], ['mel', [75, 14, 5, 7]], ['ruby', [75, 14, 5, 7]],
  ['viola', [82, 15, 5, 8]], ['nazuna', [88, 17, 6, 8]], ['kabune', [95, 16, 7, 7]],
  ['caro', [92, 17, 6, 11]], ['theta', [100, 18, 7, 9]], ['cure', [108, 18, 8, 8]],
  ['shiro', [115, 19, 12, 8]], ['momona', [120, 21, 9, 10]], ['pan', [135, 20, 14, 8]],
  ['puti', [145, 28, 11, 12]], ['roma', [155, 25, 12, 13]], ['saffy', [170, 26, 15, 14]],
].map(([id, [hp, attack, defense, speed]]) => [id as string, { hp, attack, defense, speed, skill: PARTNER_SKILL_PREVIEWS[id as string] }])) as Readonly<Record<string, PartnerBattleProfile>>;

const FARM_GIRL_CARD_BACK_SRC = '/img/card.png';
const FARM_GIRL_CARD_IMAGES: Readonly<Record<string, string>> = {
  chibiichi: '/img/chibiichi-card.png',
  mel: '/img/mel-card.png',
  ruby: '/img/ruby-card.png',
  viola: '/img/viora-card.png',
  nazuna: '/img/nazuna-card.png',
  kabune: '/img/kabune-card.png',
  caro: '/img/kyaro-card.png',
  theta: '/img/shita-card.png',
  cure: '/img/kyua-card.png',
  shiro: '/img/shiro-card.png',
  momona: '/img/momona-card.png',
  pan: '/img/pan-card.png',
  puti: '/img/puthi-card.png',
  roma: '/img/roma-card.png',
  saffy: '/img/safi-card.png',
};
const FARM_GIRL_DETAIL_IMAGES: Readonly<Record<string, string>> = {
  chibiichi: '/img/chibiichi-pro.jpg',
  mel: '/img/mel-pro.jpg',
  ruby: '/img/ruby-pro.jpg',
  viola: '/img/viora-pro.jpg',
  nazuna: '/img/nasuna-pro.jpg',
  kabune: '/img/kabune-pro.jpg',
  caro: '/img/kyaro-pro.jpg',
  theta: '/img/shita-pro.jpg',
  cure: '/img/kyua-pro.jpg',
  shiro: '/img/shiro-pro.jpg',
  momona: '/img/momona-pro.jpg',
  pan: '/img/pan-pro.jpg',
  puti: '/img/puthi-pro.jpg',
  roma: '/img/roma-pro.jpg',
  saffy: '/img/safi-pro.jpg',
};
const OPEN_FARM_GIRL_CARD_COUNT = Object.keys(FARM_GIRL_CARD_IMAGES).length;

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
  { id: 'grandpa', label: 'お爺さんとの関係は？', answer: 'えっ！そ、それは...内緒っ♡\nでも、ユウのこともお爺さん、毎日のように話してたんだよっ！\nユウの事もどうか頼む！って。\nだから、色々お世話するね♪', voiceSrc: '/voice/kurumi-start1.wav' },
];
const KURUMI_INTRO_TOPIC_IDS = KURUMI_INTRO_TOPICS.map(topic => topic.id);
const KURUMI_INTRO_CLOSE_FADE_MS = 650;
const SEED_PLANT_TUTORIAL_STEPS = [
  'ユウは好奇心いっぱいだねーっ！\nくるみもできる限りお手伝いするね！\nそれじゃあ最初にやることを教えるねっ。\nまずは、お爺さんから預かってる\n苗娘を3つあげる！',
  'この苗娘は、すっごい貴重なんだよっ！\nでも、育てるのがとっても大変みたいで\n収穫するのも難しいんだって！\nだけど、ユウのお爺さんが持ってた指輪の力と\n精力を使って安定的に育てる方法を開発したの！',
  'くるみもお爺さんの収穫の\nお手伝いしたんだよっ！\nどうやったら気持ちよく...じゃなかった\n品質のいい野菜や果物が出来るか\n色々試したの♪\nだから、ユウもきっと上手に育成出来ると\n思うから頑張ってね！',
  '苗娘は植えたあと、日数が進むと育っていくよ。\n色々と難しいこともあると思うけど、\nくるみもお手伝いしちゃうよーっ！\n明日は橋の近くで釣りも教えるけど、\n今日はまず畑に苗娘を植えてみよっ♪',
] as const;
const SEED_PLANT_TUTORIAL_VOICE_SRCS = SEED_PLANT_TUTORIAL_STEPS.map((_, index) => `/voice/kurumi-seed${index + 1}.wav`);
const STARTER_SEED_OBJECTIVE = 'くるみからもらった苗娘を左畑に植えよう！';
const SEED_AFTER_PLANT_TUTORIAL_STEPS: (DebugDialogueStep & { id: SeedAfterPlantTutorialStep })[] = [
  {
    id: 'rooted',
    debugKey: 'seed_after_plant_tutorial_rooted',
    message: 'できたできたっ！\nこれで苗娘が畑に根づいたよ♪\n日数が進むと少しずつ育って、\nお世話の仕方で品質も変わっていくの。',
    voiceSrc: '/voice/kurumi-seed5.wav',
  },
  {
    id: 'growth_days',
    debugKey: 'seed_after_plant_tutorial_growth_days',
    message: 'ほら、畑をよく見てごらん！\n成長中って横に0/2日とか0/3日って\n書いてあるでしょ？\nこの日数育てると苗娘は収穫できるよっ！',
    voiceSrc: '/voice/kurumi-seed6.wav',
  },
  {
    id: 'care',
    debugKey: 'seed_after_plant_tutorial_care',
    message: 'まずは初収穫を目指してみてね！\n収穫までに苗のお世話もすることが出来るから\n色々試してみるといいよ♪\n明日また様子を見に来よっ！\n今日はここまで！また明日ね♡',
    voiceSrc: '/voice/kurumi-seed7.wav',
  },
];

const PROLOGUE_LETTERS: readonly { text: string; voiceSrc: string }[] = [
  { text: 'ユウへ\n\n元気か？ 爺ちゃんはもう長くない。\nそこで、爺ちゃんを大切にしてくれたお前に\n爺ちゃんの命よりも大事なものをユウに残す。\nこれは遺言じゃ！', voiceSrc: '/voice/jii01.wav' },
  { text: '爺ちゃんの大事な畑を継いでくれ！\nそこには可愛い「娘たち」がたくさんおる。\n日々愛でて、肥料をやって\nたっぷり可愛がってやれば、\nすぐに実って、\n最高の笑顔を見せてくれるんじゃぞ。', voiceSrc: '/voice/jii02.wav' },
  { text: 'ふふ、爺ちゃんの若い頃を思い出すな......\n毎日イチャイチャ、\n娘たちと一緒に暮らせるぞ！\n最高の人生が待ってる。\n絶対に後悔はさせん！', voiceSrc: '/voice/jii03.wav' },
  { text: 'さあ、すぐに村に来い。\n家の鍵と指輪は同封した。\n楽しみにしてるぞ！\n\n爺ちゃんより', voiceSrc: '/voice/jii04.wav' },
  { text: '……あ、そうじゃ！\nすっかり伝えるのを忘れておったわ！\n爺さん、くるみちゃんと遊びすぎて...じゃなくて\n畑の経営に失敗して、結構やばい所に\n莫大な借金を作ってしまったんじゃ！', voiceSrc: '/voice/jii05.wav' },
  { text: 'じゃから、その畑で「特別な娘たち」を育てて、\n高く売って返済するしか道はないんじゃ！\n一緒に同封した農神の指輪の力は、\nユウの底なしの精力に反応して\n必ずや、、、\nあとは頼んだぞ！てへっ♡', voiceSrc: '/voice/jii06.wav' },
];

const FISH_ITEM_NAMES = new Set(FISH_ZUKAN_ENTRIES.map(fish => fish.name));
const LUMBER_ITEM_NAMES = new Set(LUMBER_DATA.map(lumber => lumber.name));
const ORE_ITEM_NAMES = new Set(ORE_DATA.map(ore => ore.name));
const FARM_HARVEST_ITEM_NAMES = new Set(FARM_GIRL_CROP_DATA.map(crop => crop.harvestItemName));
const MINING_RHYTHM_DIRECTIONS: readonly MiningDirection[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const MINING_BGM_SOURCES = {
  normal: '/bgm/saikutu2.wav?v=20260620-mining-safe',
  mediumRare: '/bgm/saikutu3.wav?v=20260620-mining-safe',
  highRare: '/bgm/saikutu1.wav?v=20260620-mining-safe',
} as const;
const MINING_BGM_OPTIONS = [
  { id: 'normal', label: '通常鉱石 saikutu2.wav', src: MINING_BGM_SOURCES.normal },
  { id: 'mediumRare', label: '中レア鉱石 saikutu3.wav', src: MINING_BGM_SOURCES.mediumRare },
  { id: 'highRare', label: 'レア鉱石 saikutu1.wav', src: MINING_BGM_SOURCES.highRare },
] as const;
const MINING_RHYTHM_STORAGE_KEY = 'farmMiningRhythmTimings';
const MINING_COUNTDOWN_SECONDS = 3;
const MINING_NOTE_FALL_MS = 1600;
const MINING_GAME_DURATION_MS = 10_000;
const MINING_JUDGEMENT_LINE_TOP_PERCENT = 68;
const MINING_NON_FULL_COMBO_MAX_GAUGE = 99;
const MINING_SE_SOURCES = {
  perfect: '/se/tsuruhashi2.mp3',
  good: '/se/tsuruhashi1.mp3',
  bad: '/se/tsuruhashi4.mp3',
  reward: '/se/tsuruhashi3.mp3',
} as const;
const MINING_COMBO_VOICE_SOURCES = {
  combo: '/voice/combo.wav',
  sugoi: '/voice/sugoi.wav',
  fullCombo: '/voice/fullcombo.wav',
} as const;
const getMiningArrowImageSrc = (direction: MiningDirection): string => ({
  ArrowUp: '/img/arrow up.png',
  ArrowDown: '/img/arrow down.png',
  ArrowLeft: '/img/arrow left.png',
  ArrowRight: '/img/arrow right.png',
}[direction]);
const getMiningArrowLaneLeftPercent = (direction: MiningDirection): number => ({
  ArrowLeft: 38,
  ArrowDown: 46,
  ArrowUp: 54,
  ArrowRight: 62,
}[direction]);
const getMiningBgmSource = (oreId: string): string => {
  if (['gold', 'sanctuary_gem'].includes(oreId)) return MINING_BGM_SOURCES.highRare;
  if (['quality_iron', 'tin', 'silver', 'steel'].includes(oreId)) return MINING_BGM_SOURCES.mediumRare;
  return MINING_BGM_SOURCES.normal;
};
const getMiningRhythmIntervalMs = (oreId: string): number => {
  if (['muddy_iron', 'soft_copper', 'brittle_lead', 'light_coal'].includes(oreId)) return 850;
  if (['quality_iron', 'tin', 'silver'].includes(oreId)) return 700;
  return 550;
};
const getMiningRhythmDirectionLabel = (direction: MiningDirection): string => ({
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}[direction]);
const getRandomMiningDirection = (): MiningDirection => (
  MINING_RHYTHM_DIRECTIONS[Math.floor(Math.random() * MINING_RHYTHM_DIRECTIONS.length)]
);
const normalizeMiningRhythmTimings = (value: unknown): number[] => (
  Array.isArray(value)
    ? value
      .filter((timing): timing is number => typeof timing === 'number' && Number.isFinite(timing))
      .filter(timing => timing >= 250 && timing <= MINING_GAME_DURATION_MS - 250)
      .sort((a, b) => a - b)
      .slice(0, 16)
    : []
);
const loadMiningRhythmTimings = (): MiningRhythmTimingsByBgm => {
  try {
    const stored = window.localStorage.getItem(MINING_RHYTHM_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const legacyTimings = normalizeMiningRhythmTimings(parsed);
      return legacyTimings.length > 0 ? { [MINING_BGM_SOURCES.normal]: legacyTimings } : {};
    }
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([src, value]) => [src, normalizeMiningRhythmTimings(value)] as const)
        .filter(([, timings]) => timings.length > 0),
    );
  } catch {
    return {};
  }
};
const saveMiningRhythmTimings = (timingsByBgm: MiningRhythmTimingsByBgm) => {
  window.localStorage.setItem(MINING_RHYTHM_STORAGE_KEY, JSON.stringify(timingsByBgm));
};
const BEAST_ATTACK_FARM_THEFT_RANGE: Readonly<Record<GameDifficulty, { min: number; max: number }>> = {
  easy: { min: 1, max: 3 },
  normal: { min: 3, max: 8 },
  hard: { min: 5, max: 15 },
};
const createBeastAttackFarmTheft = (
  inventoryCounts: Record<string, number>,
  difficulty: GameDifficulty,
  random = Math.random,
): Array<{ itemName: string; count: number }> => {
  const range = BEAST_ATTACK_FARM_THEFT_RANGE[difficulty];
  const targetCount = range.min + Math.floor(random() * (range.max - range.min + 1));
  const remaining = new Map(
    Array.from(FARM_HARVEST_ITEM_NAMES)
      .map(itemName => [itemName, Math.max(0, inventoryCounts[itemName] ?? 0)] as const)
      .filter(([, count]) => count > 0),
  );
  const stolen = new Map<string, number>();
  for (let index = 0; index < targetCount; index += 1) {
    const candidates = Array.from(remaining.entries()).filter(([, count]) => count > 0);
    if (candidates.length === 0) break;
    const [itemName, count] = candidates[Math.floor(random() * candidates.length)];
    remaining.set(itemName, count - 1);
    stolen.set(itemName, (stolen.get(itemName) ?? 0) + 1);
  }
  return Array.from(stolen, ([itemName, count]) => ({ itemName, count }));
};
const FISHING_NUSHI_RING_NAME = '釣神の指輪';
const FISHING_NUSHI_DEBUG_RING_NAME = '釣神の指輪（デバッグ用）';
const withDebugItemVariants = (itemNames: readonly string[]): string[] => (
  itemNames.flatMap(itemName => [itemName, toDebugItemName(itemName)])
);
const REMOVED_LEGACY_ITEM_NAMES = ['薬草', '携帯おにぎり', '小さな釣り餌'] as const;
const REMOVED_LEGACY_ITEM_VARIANTS = withDebugItemVariants(REMOVED_LEGACY_ITEM_NAMES);
const LEGACY_ITEM_NAME_RENAMES: Readonly<Record<string, string>> = {
  'めるのメロン': 'メルのメロン',
  'ぱんちゃんのかぼちゃ': 'パンのかぼちゃ',
  'ぱんのかぼちゃ': 'パンのかぼちゃ',
  'サフィーのサフラン': 'サフィのサフラン',
};
const migrateInventoryItemNames = (inventoryCounts: Record<string, number>): Record<string, number> => {
  const next = { ...inventoryCounts };
  let changed = false;
  Object.entries(LEGACY_ITEM_NAME_RENAMES).forEach(([oldName, newName]) => {
    [oldName, toDebugItemName(oldName)].forEach(oldItemName => {
      const count = next[oldItemName] ?? 0;
      if (count <= 0) return;
      const newItemName = oldItemName === oldName ? newName : toDebugItemName(newName);
      next[newItemName] = (next[newItemName] ?? 0) + count;
      delete next[oldItemName];
      changed = true;
    });
  });
  return changed ? next : inventoryCounts;
};
const ITEM_MENU_NORMAL_ITEMS: Record<string, string[]> = {
  '消耗品': [...BATTLE_CONSUMABLE_ITEMS.map(item => item.name)],
  '素材': Array.from(new Set([
    '木材', '川魚の鱗', 'モグラの爪', 'ウサギの靭帯', '軟らかい銅鉱石', '泥混じりの鉄鉱石', '柔らかな若枝',
    '軽石炭', 'しなやかな軟木', '猪の牙', '熊の剛糸', '良質な鉄鉱石', '堅実な中木',
    '巨獣の鋼角', '神獣の絹糸', '金鉱石', '不朽の鉄木', '脆い鉛鉱石', '錫鉱石', '銀鉱石', '鋼鉄石', '聖域の輝石',
    '猪の硬皮', '巨獣の強剛糸', '古代の神木',
    ...BEAST_DROP_DATA.flatMap(drop => drop.drops.map(item => item.dropItemName)),
  ])),
  '装備品': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿', 'のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし', '農神の指輪', FISHING_NUSHI_RING_NAME, '木剣', '獣殺し', '天の裁き', '毛皮の服', '剛牙の鎧', '神域の加護'],
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
const ALL_NORMAL_ITEM_NAMES = Array.from(new Set([
  ...Object.values(ITEM_MENU_NORMAL_ITEMS).flat(),
  ...FISH_ZUKAN_ENTRIES.map(item => item.name),
  ...LUMBER_DATA.map(item => item.name),
  ...ORE_DATA.map(item => item.name),
  ...FARM_GIRL_CROP_DATA.map(item => item.harvestItemName),
  ...BEAST_DROP_DATA.flatMap(drop => drop.drops.map(item => item.dropItemName)),
]));
const ITEM_MENU_BASE_ITEMS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ITEM_MENU_NORMAL_ITEMS).map(([category, itemNames]) => [
    category,
    [...itemNames, ...itemNames.map(toDebugItemName)],
  ]),
);
const INITIAL_INVENTORY_COUNTS: Record<string, number> = createDebugInventoryCounts(ALL_NORMAL_ITEM_NAMES);
const INITIAL_EQUIPPED_ITEMS: Record<string, string> = {
  '主人公-slot1': '',
  '主人公-slot2': '',
  '主人公-slot3': '',
  '主人公-slot4': '',
  'ちびいち-slot1': '',
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
const ITEM_MENU_CUSTOM_EFFECT_TEXT: Record<string, string> = {
  '使用済みコンドーム': 'くるみになぜか売却できる何かに使われたゴムです。一体誰が使ったんだろう？サイズが大きいほど高く買い取ってもらえます。',
  '川魚の鱗': '川魚から取れるきらめく鱗。細工や道具の補強に使え、くるみも喜んで買い取ってくれます。',
  '木材': '農場設備の修理やクラフトに使う基本素材。まずはこれを集めると開拓が進みます。',
  'モグラの爪': '地中を掘り進むモグラの丈夫な爪。初級道具の刃や補強材にぴったりです。',
  'ウサギの靭帯': 'よく跳ねるウサギから取れるしなやかな素材。道具の固定や弦の代わりに使えます。',
  '猪の牙': '荒ぶる猪の鋭い牙。高級道具や武器に獣の力を宿す素材です。',
  '猪の硬皮': '刃を通しにくい猪の皮。防具や道具のグリップ補強に向いています。',
  '熊の剛糸': '熊の体毛からより分けた強い繊維。高級釣竿や装備作りに使います。',
  '巨獣の鋼角': '巨獣から得られる金属のような角。伝説級の道具を作るための主素材です。',
  '巨獣の強剛糸': '巨獣の体から取れる極太の繊維。強い衝撃にも耐える希少素材です。',
  '神獣の絹糸': '山の主が落とす神秘的な糸。伝説級の装備に祝福を通すための素材です。',
  '農神の指輪': '農場仕事に小さな加護をくれる指輪。畑仕事の成果を底上げしてくれるお守りです。',
  [FISHING_NUSHI_RING_NAME]: '川のヌシに認められた釣り人の指輪。大物との縁をぐっと引き寄せます。',
  '木剣': '村で扱いやすいよう削られた木の剣。獣相手の最初の護身用装備です。',
  '獣殺し': '獣の弱点を狙いやすい重めの剣。強敵との戦いで攻撃力と会心を支えます。',
  '天の裁き': '山の雷を写したような剣。獣への決定打を狙える終盤向けの武器です。',
  '毛皮の服': '冷える朝の畑でも動きやすい毛皮服。HPと防御を少し底上げします。',
  '剛牙の鎧': '獣の牙と硬皮で仕立てた鎧。獣から受ける痛手を抑える頼れる防具です。',
  '神域の加護': '山奥の神域に伝わる守り具。HPと防御を高め、状態異常にも強くなります。',
};
const getItemMenuEffectText = (itemName: string, itemCategory: string): string => {
  if (!itemName) return 'アイテムを選ぶと、ここに効果や使い道が表示されます。';

  const baseItemName = toBaseItemName(itemName);
  const customEffectText = ITEM_MENU_CUSTOM_EFFECT_TEXT[baseItemName];
  if (customEffectText) return customEffectText;

  const battleItem = getBattleConsumableItem(baseItemName);
  if (battleItem) return battleItem.desc;

  const recipeConfig = CRAFT_RECIPE_CONFIGS[baseItemName as CraftRecipeId];
  if (recipeConfig) {
    return `${recipeConfig.output}をクラフトできるようになるレシピです。必要素材はレシピ詳細で確認できます。`;
  }

  const fish = FISH_ZUKAN_ENTRIES.find(entry => entry.name === baseItemName);
  if (fish) {
    return fish.sellable === false
      ? 'だいじなものとして保管される特別な魚です。図鑑やイベント確認に使います。'
      : 'くるみに売却できる魚です。サイズが大きいほど高く買い取ってもらえます。';
  }

  if (LUMBER_ITEM_NAMES.has(baseItemName)) return `${baseItemName}は村の森で取れる木材です。道具作りに使え、太く立派なものほど高値で売れます。`;
  if (ORE_ITEM_NAMES.has(baseItemName)) return `${baseItemName}は洞窟で掘れる鉱石です。道具作りに使え、重く質の良いものほど高値で売れます。`;
  if (FARM_HARVEST_ITEM_NAMES.has(baseItemName)) return `${baseItemName}は農場で育った実りです。くるみに売れば借金返済の大事な資金になります。`;

  if (isFishingRodName(baseItemName)) return '釣りで使う装備です。上位の釣竿ほど狙える魚が増えます。';
  if (isSawName(baseItemName)) return '伐採で使う装備です。上位ののこぎりほど良い木材を狙えます。';
  if (isPickaxeName(baseItemName)) return '採掘で使う装備です。上位のつるはしほど希少な鉱石を狙えます。';

  if (itemCategory === '素材') return `${baseItemName}は開拓やクラフトに使える素材です。今すぐ使わなくても、村での生活を進めるほど出番が増えます。`;
  if (itemCategory === '装備品') return `${baseItemName}は装備メニューで身につけられる品です。畑仕事、探索、戦闘のどこかで力を貸してくれます。`;
  if (itemCategory === '売却品') return `${baseItemName}はくるみに売却できる品です。今日の稼ぎとして返済資金に回せます。`;
  if (itemCategory === 'だいじなもの') return `${baseItemName}は村での進行に関わる大切な品です。なくさないように保管されています。`;

  return `${baseItemName}ははらませ村で見つけた品です。詳しい使い道が分かるまで、大事に持っておきましょう。`;
};
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
      message: 'どの岩で採掘できるかランダムなんだけどー、\nまずは練習用に、ポストの下にある岩を調べてみよー♪\nそこで採掘のやり方をちゃんと教えるねっ！',
      voiceSrc: '/voice/craft11.wav',
    },
  ],
};
const MINING_TUTORIAL_STEPS: (DebugDialogueStep & { id: MiningTutorialStep })[] = [
  {
    id: 'arrows',
    debugKey: 'mining_tutorial_arrows',
    message: '採掘では、画面の上から矢印が落ちてくるよ！\n矢印が黄色い判定ラインに重なった瞬間に、同じ方向キーを押してねっ♪',
    voiceSrc: '/voice/saikutu1.wav',
  },
  {
    id: 'timing',
    debugKey: 'mining_tutorial_timing',
    message: 'タイミングが合うとPERFECTやGOOD！\n採掘ゲージが増えていくから、焦らずラインをよーく見てね。\nMISSが続くと岩を砕ききれないから注意だよっ！',
    voiceSrc: '/voice/saikutu2.wav',
  },
  {
    id: 'reward',
    debugKey: 'mining_tutorial_reward',
    message: 'うまく掘れると、鉱石の数や品質がよくなりやすいんだぁ。\nじゃあ説明はここまで！\nこの岩で実際に採掘してみよー♪',
    voiceSrc: '/voice/saikutu3.wav',
  },
];
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
const COMPANION_TRAIL_DELAY_FRAMES = 18;
const COMPANION_FOLLOW_DISTANCE = 54;
const DEBUG_INITIAL_GIRL_TRUST = 20; // 最終ビルドでは 0 に戻す
const DEBUG_APPEARED_GIRL_IDS = new Set(
  [] as string[]
); // 最終ビルドでは空に戻す
const CRAFT_SUCCESS_SOUND_SRC = '/se/craft.mp3';
const LOGGING_SUCCESS_SOUND_SRC = '/se/success.mp3';
const LOGGING_CUT_SOUND_SRC = '/se/saw.wav';
const LOGGING_BGM_SRC = '/bgm/tree.mp3';
const LOGGING_RESULT_SOUND_SRC = '/se/nushi.mp3';

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getCompanionRestPosition = (
  position: { x: number; y: number },
  direction: 'up' | 'down' | 'left' | 'right',
) => {
  const offset = {
    up: { x: 0, y: COMPANION_FOLLOW_DISTANCE },
    down: { x: 0, y: -COMPANION_FOLLOW_DISTANCE },
    left: { x: COMPANION_FOLLOW_DISTANCE, y: 0 },
    right: { x: -COMPANION_FOLLOW_DISTANCE, y: 0 },
  }[direction];
  return { x: position.x + offset.x, y: position.y + offset.y, direction, isWalking: false };
};
const shouldEquipCraftedGatheringTool = (currentTool: string, craftedTool: string) => {
  if (isSawName(craftedTool)) {
    return !isSawName(currentTool) || SAW_RANKS.indexOf(craftedTool) > SAW_RANKS.indexOf(currentTool);
  }
  if (isPickaxeName(craftedTool)) {
    return !isPickaxeName(currentTool) || PICKAXE_RANKS.indexOf(craftedTool) > PICKAXE_RANKS.indexOf(currentTool);
  }
  return false;
};
const getEquippedPickaxe = (equippedItems: Readonly<Record<string, string>>): PickaxeName => {
  const equippedPickaxe = toBaseItemName(equippedItems['主人公-slot3'] ?? '');
  return isPickaxeName(equippedPickaxe) ? equippedPickaxe : 'つるはし';
};
const hasEquippedPickaxe = (equippedItems: Readonly<Record<string, string>>) => {
  return isPickaxeName(toBaseItemName(equippedItems['主人公-slot3'] ?? ''));
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
  easy: 1_500_000,
  normal: 10_000_000,
  hard: 30_000_000,
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
const getFarmQualityMultiplier = (quality: number): number => {
  if (quality >= 100) return 1.25;
  if (quality >= 75) return 1.20;
  if (quality >= 50) return 1.10;
  if (quality >= 25) return 1.00;
  return 0.90;
};
const getFarmQualityLabel = (quality: number): string => {
  if (quality >= 100) return '最高品質';
  if (quality >= 75) return '極上';
  if (quality >= 50) return '上質';
  if (quality >= 25) return '良い';
  return 'ふつう';
};
type CompanionHarvestModifier = {
  multiplier: number;
  isFutureLoverBonusEligible: boolean;
};
const getCompanionHarvestModifier = (isCompanion: boolean, trust: number): CompanionHarvestModifier => {
  if (!isCompanion || trust >= 80) {
    return { multiplier: 1, isFutureLoverBonusEligible: isCompanion && trust >= 100 };
  }
  if (trust >= 60) return { multiplier: 0.75, isFutureLoverBonusEligible: false };
  if (trust >= 40) return { multiplier: 0.5, isFutureLoverBonusEligible: false };
  return { multiplier: 0, isFutureLoverBonusEligible: false };
};
const getFarmHarvestAmount = (baseAmount: number, trust: number, companionHarvestMultiplier = 1) => (
  companionHarvestMultiplier <= 0
    ? 0
    : Math.max(1, Math.round(baseAmount * getFarmTrustBonus(trust).harvestMultiplier * companionHarvestMultiplier))
);
const getAffectedHarvestMultiplier = (condition: FarmGirlCondition, difficulty: GameDifficulty) => (
  condition === 'affected' && difficulty === 'hard' ? 0.9 : 1
);
const getAffectedTrustGain = (condition: FarmGirlCondition) => (
  condition === 'affected' ? Math.max(1, Math.round(TRUST_GAIN_ON_HARVEST * 0.5)) : TRUST_GAIN_ON_HARVEST
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
    .map(([, name]) => toBaseItemName(name));
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
const createRandomBeastUnits = (difficulty: GameDifficulty, allowMountainLord = true): (BattleUnitState | null)[] => {
  const count = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
  const candidates = BEAST_BATTLE_DATA.filter(beast => beast.difficulty === difficulty && (allowMountainLord || beast.id !== 'mountain_lord'));
  const fallbackCandidates = candidates.length > 0 ? candidates : BEAST_BATTLE_DATA.filter(beast => DIFFICULTY_ORDER[beast.difficulty] <= DIFFICULTY_ORDER[difficulty]);
  const beasts = Array.from({ length: count }, () => createBattleUnitFromBeast(fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)]));
  if (beasts.some(beast => beast.id === 'mountain_lord')) {
    const mountainLord = beasts.find(beast => beast.id === 'mountain_lord') ?? createBattleUnitFromBeast(BEAST_BATTLE_DATA.find(beast => beast.id === 'mountain_lord') ?? fallbackCandidates[0]);
    return [mountainLord, null, null];
  }
  return [...beasts, ...Array.from({ length: Math.max(0, 3 - beasts.length) }, () => null)];
};
const createMountainLordUnit = (): (BattleUnitState | null)[] => {
  const mountainLord = BEAST_BATTLE_DATA.find(beast => beast.id === 'mountain_lord');
  return mountainLord ? [createBattleUnitFromBeast(mountainLord), null, null] : createRandomBeastUnits('hard');
};
const createBattleUnitFromCompanionGirl = (girlId: string | null): BattleUnitState | null => {
  if (!girlId) return null;
  const girl = GIRL_DATA.find(candidate => candidate.id === girlId);
  if (!girl) return null;

  const profile = PARTNER_BATTLE_PROFILES[girl.id] ?? { hp: 75, attack: 14, defense: 5, speed: 7 };

  return {
    id: girl.id,
    name: girl.girlName,
    maxHp: profile.hp,
    hp: profile.hp,
    attack: profile.attack,
    defense: profile.defense,
    speed: profile.speed,
  };
};
const createBattleTurnQueue = (
  hero: BattleUnitState,
  allies: readonly (BattleUnitState | null)[],
  beasts: readonly (BattleUnitState | null)[],
): BattleTurnEntry[] => {
  const entries: BattleTurnEntry[] = [
    ...(hero.hp > 0 ? [{ kind: 'party' as const, unitId: hero.id, speed: hero.speed }] : []),
    ...allies.filter((ally): ally is BattleUnitState => Boolean(ally && ally.hp > 0)).map(ally => ({ kind: 'partner' as const, unitId: ally.id, speed: ally.speed })),
    ...beasts.filter((beast): beast is BattleUnitState => Boolean(beast && beast.hp > 0)).map(beast => ({ kind: 'enemy' as const, unitId: beast.id, speed: beast.speed })),
  ];
  const tiePriority: Readonly<Record<BattleTurn, number>> = { party: 0, partner: 1, enemy: 2 };
  return entries.sort((left, right) => right.speed - left.speed || tiePriority[left.kind] - tiePriority[right.kind]);
};
const getNextBattleTurn = (
  hero: BattleUnitState,
  allies: readonly (BattleUnitState | null)[],
  beasts: readonly (BattleUnitState | null)[],
  queue: readonly BattleTurnEntry[],
  turnIndex: number,
) => {
  const isAlive = (entry: BattleTurnEntry) => {
    if (entry.kind === 'party') return hero.id === entry.unitId && hero.hp > 0;
    const units = entry.kind === 'partner' ? allies : beasts;
    return units.some(unit => unit?.id === entry.unitId && unit.hp > 0);
  };
  for (let index = turnIndex + 1; index < queue.length; index += 1) {
    const entry = queue[index];
    if (isAlive(entry)) return { turnQueue: queue, turnIndex: index, turn: entry.kind };
  }
  const turnQueue = createBattleTurnQueue(hero, allies, beasts);
  const firstTurn = turnQueue[0];
  return { turnQueue, turnIndex: 0, turn: firstTurn?.kind ?? 'party' };
};
const createInitialBattlePreviewState = (
  equippedItems: Record<string, string> = {},
  beastUnits: (BattleUnitState | null)[] | null = null,
  companionGirlId: string | null = null,
  encounterType: BattleEncounterType = 'test',
  currentHeroLevel: HeroLevel = 1,
  unlockedHeroSkills: readonly string[] = [],
): BattlePreviewState => {
  const heroStats = HERO_BATTLE_STATS_BY_LEVEL[currentHeroLevel];
  const equipmentBonus = getHeroBattleEquipmentBonus(equippedItems);
  const mole = BEAST_BATTLE_DATA.find(beast => beast.id === 'mole') ?? BEAST_BATTLE_DATA[0];
  const initialBeasts = (beastUnits ?? [createBattleUnitFromBeast(mole), null, null]).map(beast => {
    if (!beast) return null;
    return {
      ...beast,
      attack: unlockedHeroSkills.includes('battle_enemy_attack_down_trap')
        ? Math.max(1, Math.round(beast.attack * 0.9))
        : beast.attack,
      defense: unlockedHeroSkills.includes('battle_enemy_defense_down_trap')
        ? Math.max(0, Math.round(beast.defense * 0.9))
        : beast.defense,
    };
  });
  const companion = createBattleUnitFromCompanionGirl(companionGirlId);
  const battleBgmSource = initialBeasts.some(beast => beast?.id === 'mountain_lord')
    ? MOUNTAIN_LORD_BATTLE_BGM_SRC
    : RANDOM_BATTLE_BGM_SOURCES[Math.floor(Math.random() * RANDOM_BATTLE_BGM_SOURCES.length)];
  const heroMaxHp = Math.round((heroStats.hp + equipmentBonus.hp) * (unlockedHeroSkills.includes('battle_hp_up') ? 1.1 : 1));
  const hero: BattlePreviewState['hero'] = {
    id: 'hero',
    name: '主人公',
    level: heroStats.level,
    maxHp: heroMaxHp,
    hp: heroMaxHp,
    attack: heroStats.attack + equipmentBonus.attack,
    defense: heroStats.defense + equipmentBonus.defense,
    speed: heroStats.speed,
    criticalRate: equipmentBonus.criticalRate,
    beastDamageMultiplier: equipmentBonus.beastDamageMultiplier * (unlockedHeroSkills.includes('battle_beast_damage_up') ? 1.1 : 1),
    beastDamageReduction: equipmentBonus.beastDamageReduction + (unlockedHeroSkills.includes('battle_damage_reduce') ? 10 : 0),
    statusResistance: equipmentBonus.statusResistance,
    defending: false,
  };
  const allies = [companion, null, null];
  const turnQueue = createBattleTurnQueue(hero, allies, initialBeasts);
  const maxBattleSp = 4 + heroStats.level * 2;
  const basePartnerSkillMaxUses = companion ? (PARTNER_SKILL_PREVIEWS[companion.id]?.maxUses ?? 0) : 0;
  const partnerSkillMaxUses = basePartnerSkillMaxUses > 0 && unlockedHeroSkills.includes('companion_battle_support')
    ? basePartnerSkillMaxUses + 1
    : basePartnerSkillMaxUses;
  return {
    hero,
    allies,
    beasts: initialBeasts,
    logs: [
      `${initialBeasts.filter(Boolean).map(beast => beast?.name).join('、')}が現れた！`,
      '主人公は身構えている。',
      ...(companion ? [`${companion.name}が同行している。`] : []),
      ...(unlockedHeroSkills.includes('battle_enemy_attack_down_trap') ? ['足くくり罠：敵攻撃力を下げた！'] : []),
      ...(unlockedHeroSkills.includes('battle_enemy_defense_down_trap') ? ['電撃罠：敵防御力を下げた！'] : []),
    ],
    result: 'ongoing',
    loot: [],
    lootGranted: false,
    encounterType,
    farmDamageResolved: false,
    turn: turnQueue[0]?.kind ?? 'party',
    turnQueue,
    turnIndex: 0,
    battleSp: maxBattleSp,
    maxBattleSp,
    partnerSkillUses: 0,
    partnerSkillMaxUses,
    partnerDropRateBonus: 0,
    healingItemUses: 0,
    reviveItemUses: 0,
    bgmSource: battleBgmSource,
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
const rollBattleLoot = (beasts: readonly (BattleUnitState | null)[], dropRateBonus = 0): BattleLootEntry[] => {
  const defeatedBeasts = beasts.filter((beast): beast is BattleUnitState => Boolean(beast && beast.hp <= 0));
  const highestDifficulty = defeatedBeasts.reduce<GameDifficulty>((highest, beast) => {
    const beastDifficulty = BEAST_BATTLE_DATA.find(data => data.id === beast.id)?.difficulty ?? 'easy';
    return DIFFICULTY_ORDER[beastDifficulty] > DIFFICULTY_ORDER[highest] ? beastDifficulty : highest;
  }, 'easy');
  const sellValueLimit: Readonly<Record<GameDifficulty, number>> = {
    easy: 3_000,
    normal: 25_000,
    hard: 200_000,
  };
  let remainingSellValue = sellValueLimit[highestDifficulty];
  const lootMap = new Map<string, BattleLootEntry>();
  defeatedBeasts.forEach(beast => {
    const dropData = BEAST_DROP_DATA.find(drop => drop.beastId === beast.id as BeastId);
    const successfulDrops = (dropData?.drops ?? [])
      .filter(drop => Math.random() < Math.min(1, drop.dropRate + dropRateBonus))
      .map(drop => ({ drop, order: Math.random() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, 2)
      .map(({ drop }) => drop);
    successfulDrops.forEach(drop => {
      if (drop.sellPrice > remainingSellValue) return;
      const min = Math.max(0, Math.floor(drop.dropCountMin));
      const max = Math.max(min, Math.floor(drop.dropCountMax));
      const count = min + Math.floor(Math.random() * (max - min + 1));
      if (count <= 0) return;
      remainingSellValue -= drop.sellPrice * count;
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
  state: DEBUG_APPEARED_GIRL_IDS.has(girl.id) ? 'appeared' : 'none',
  cardRevealed: DEBUG_APPEARED_GIRL_IDS.has(girl.id),
  plantedDay: null,
  growthProgress: 0,
  quality: DEBUG_APPEARED_GIRL_IDS.has(girl.id) ? 50 : 0,
  careDay: null,
  caressCount: 0,
  fingerCount: 0,
  fertilizeCount: 0,
  lastHarvestDay: null,
  trust: DEBUG_INITIAL_GIRL_TRUST,
  unlockedTrustEventIds: [],
  condition: 'normal',
  conditionDay: null,
  conditionSource: null,
  hybridAdapted: false,
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
      state: DEBUG_APPEARED_GIRL_IDS.has(girl.id)
        ? 'appeared'
        : isFarmGirlState(entry.state) ? entry.state : 'none',
      cardRevealed: DEBUG_APPEARED_GIRL_IDS.has(girl.id)
        ? true
        : typeof entry.cardRevealed === 'boolean'
        ? entry.cardRevealed && typeof entry.lastHarvestDay === 'number'
        : false,
      plantedDay: typeof entry.plantedDay === 'number' && Number.isInteger(entry.plantedDay) && entry.plantedDay > 0 ? entry.plantedDay : null,
      growthProgress: typeof entry.growthProgress === 'number' && Number.isFinite(entry.growthProgress) ? clampNumber(entry.growthProgress, 0, 100) : 0,
      quality: typeof entry.quality === 'number' && Number.isFinite(entry.quality)
        ? clampNumber(Math.round(entry.quality), 0, 100)
        : entry.state === 'appeared' || entry.state === 'companion' || entry.state === 'lover' ? 50 : 0,
      careDay: typeof entry.careDay === 'number' && Number.isInteger(entry.careDay) && entry.careDay > 0 ? entry.careDay : null,
      caressCount: typeof entry.caressCount === 'number' && Number.isInteger(entry.caressCount) && entry.caressCount >= 0 ? entry.caressCount : 0,
      fingerCount: typeof entry.fingerCount === 'number' && Number.isInteger(entry.fingerCount) && entry.fingerCount >= 0 ? entry.fingerCount : 0,
      fertilizeCount: typeof entry.fertilizeCount === 'number' && Number.isInteger(entry.fertilizeCount) && entry.fertilizeCount >= 0 ? entry.fertilizeCount : 0,
      lastHarvestDay: typeof entry.lastHarvestDay === 'number' && Number.isInteger(entry.lastHarvestDay) && entry.lastHarvestDay > 0 ? entry.lastHarvestDay : null,
      trust: DEBUG_INITIAL_GIRL_TRUST,
      unlockedTrustEventIds: Array.isArray(entry.unlockedTrustEventIds)
        ? entry.unlockedTrustEventIds.filter((id): id is string => typeof id === 'string')
        : [],
      condition: entry.condition === 'affected' ? 'affected' : 'normal',
      conditionDay: typeof entry.conditionDay === 'number' && Number.isInteger(entry.conditionDay) && entry.conditionDay > 0
        ? entry.conditionDay
        : null,
      conditionSource: typeof entry.conditionSource === 'string' ? entry.conditionSource : null,
      hybridAdapted: typeof entry.hybridAdapted === 'boolean' ? entry.hybridAdapted : false,
    };
  });
};
const normalizeOwnedGirlSeeds = (raw: unknown): string[] => {
  const savedSeeds = Array.isArray(raw)
    ? raw.filter((seedId): seedId is string => typeof seedId === 'string')
    : [];
  return Array.from(new Set(savedSeeds));
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
  easy: { min: 0.5, max: 1.2 },
  normal: { min: 1.2, max: 2.2 },
  hard: { min: 1.0, max: 2.5 },
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
const MINIMUM_REPAYMENT_BY_DIFFICULTY: Readonly<Record<GameDifficulty, number>> = {
  easy: 50_000,
  normal: 200_000,
  hard: 500_000,
};
const ADDITIONAL_REPAYMENT_OPTIONS = [50_000, 100_000, 300_000] as const;
type HeroLevel = 1 | 2 | 3 | 4 | 5;
type HeroLevelRequirement = {
  level: Exclude<HeroLevel, 1>;
  successfulRepaymentCount: number;
  farmCredit: number;
};
const MAX_HERO_LEVEL: HeroLevel = 5;
const SP_GAIN_PER_LEVEL = 2;
const HERO_LEVEL_REQUIREMENTS: readonly HeroLevelRequirement[] = [
  { level: 2, successfulRepaymentCount: 1, farmCredit: 20 },
  { level: 3, successfulRepaymentCount: 2, farmCredit: 40 },
  { level: 4, successfulRepaymentCount: 4, farmCredit: 60 },
  { level: 5, successfulRepaymentCount: 6, farmCredit: 80 },
];
const getNextHeroLevelRequirement = (heroLevel: HeroLevel): HeroLevelRequirement | null => (
  HERO_LEVEL_REQUIREMENTS.find(requirement => requirement.level === heroLevel + 1) ?? null
);
const canLevelUpHero = (heroLevel: HeroLevel, successfulRepaymentCount: number, farmCredit: number): boolean => {
  const requirement = getNextHeroLevelRequirement(heroLevel);
  return Boolean(
    requirement && (
      successfulRepaymentCount >= requirement.successfulRepaymentCount ||
      farmCredit >= requirement.farmCredit
    )
  );
};
const grantHeroSP = (currentSP: number, amount = SP_GAIN_PER_LEVEL): number => Math.max(0, currentSP + amount);
const getHeroStarDisplay = (heroLevel: HeroLevel): readonly boolean[] => (
  Array.from({ length: MAX_HERO_LEVEL }, (_, index) => index < heroLevel)
);
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
  { id: 'easy', label: 'イージー', debt: INITIAL_DEBT_BY_DIFFICULTY.easy, desc: '借金額 150万円' },
  { id: 'normal', label: 'ノーマル', debt: INITIAL_DEBT_BY_DIFFICULTY.normal, desc: '借金額 1000万円' },
  { id: 'hard', label: 'ハード', debt: INITIAL_DEBT_BY_DIFFICULTY.hard, desc: '借金額 3000万円' },
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
  // 同行娘は主人公の少し前の足跡をたどる。旋回時も横へワープせず、後ろを自然に追従する。
  const [companionFollow, setCompanionFollow] = useState({ x: 960, y: 540, direction: 'down' as const, isWalking: false });
  const companionTrailRef = useRef<Array<{ x: number; y: number; direction: 'up' | 'down' | 'left' | 'right'; isWalking: boolean }>>([]);
  const [isWalking, setIsWalking] = useState(false);
  const [scale, setScale] = useState(1);
  const keys = useRef<{ [key: string]: boolean }>({});
  const posRef = useRef(pos);
  useEffect(() => { posRef.current = pos; }, [pos]);
  const [topSplashVisible, setTopSplashVisible] = useState(true);
  const [circleIntroVisible, setCircleIntroVisible] = useState(false);
  const [bootMode, setBootMode] = useState<'title' | 'loadingSave' | 'playing'>('title');
  const [titlePanelMode, setTitlePanelMode] = useState<'none' | 'new' | 'difficulty' | 'load' | 'endless' | 'config'>('none');
  const [titleStartTransitionPhase, setTitleStartTransitionPhase] = useState<'idle' | 'fadeOut' | 'fadeIn'>('idle');
  const [currentSaveSlot, setCurrentSaveSlot] = useState(1);
  const [startingNewGame, setStartingNewGame] = useState(false);
  const [pendingNewGameSlot, setPendingNewGameSlot] = useState<number | null>(null);
  const [pendingNewGameDifficulty, setPendingNewGameDifficulty] = useState<GameDifficulty>('hard');
  const [pendingNewGameMode, setPendingNewGameMode] = useState<GameMode>('story');
  const [systemSlotMode, setSystemSlotMode] = useState<'none' | 'save' | 'load'>('none');
  const [saveSlotSummaries, setSaveSlotSummaries] = useState<SaveSlotSummary[]>([]);
  const [pendingDeleteSaveSlot, setPendingDeleteSaveSlot] = useState<number | null>(null);
  const [pendingOverwriteSaveSlot, setPendingOverwriteSaveSlot] = useState<number | null>(null);
  const [missingSaveSlot, setMissingSaveSlot] = useState<number | null>(null);
  // 新規開始時だけ表示する導入。既存セーブや通常プレイには影響させない。
  const [prologueOpen, setPrologueOpen] = useState(false);
  const [prologuePage, setProloguePage] = useState(0);
  const [prologueRingReveal, setPrologueRingReveal] = useState(false);
  const [prologueRingRevealReady, setPrologueRingRevealReady] = useState(false);
  const [nextObjective, setNextObjective] = useState<string | null>(null);
  const [openingMapTransitionCount, setOpeningMapTransitionCount] = useState(0);
  const prologueInputLockedRef = useRef(false);
  const prologuePageRef = useRef(prologuePage);
  const prologueRingRevealRef = useRef(prologueRingReveal);
  const autoSaveBlockedSlotsRef = useRef<Set<number>>(new Set());
  const pendingNewGameModeRef = useRef<GameMode>(pendingNewGameMode);
  const pendingNewGameDifficultyRef = useRef<GameDifficulty>(pendingNewGameDifficulty);
  const titleStartTransitionTimerRef = useRef<number | null>(null);
  const titleStartTransitionPhaseRef = useRef(titleStartTransitionPhase);
  useEffect(() => { pendingNewGameModeRef.current = pendingNewGameMode; }, [pendingNewGameMode]);
  useEffect(() => { pendingNewGameDifficultyRef.current = pendingNewGameDifficulty; }, [pendingNewGameDifficulty]);
  useEffect(() => { titleStartTransitionPhaseRef.current = titleStartTransitionPhase; }, [titleStartTransitionPhase]);
  useEffect(() => () => {
    if (titleStartTransitionTimerRef.current !== null) {
      window.clearTimeout(titleStartTransitionTimerRef.current);
    }
  }, []);

  const [setupMode, setSetupMode] = useState<'none' | 'animation' | 'collision' | 'hideArea' | 'doors' | 'footstep' | 'crops' | 'bed' | 'bathTub'>('none');

  // RPGメニュー状態
  const [menuOpen, setMenuOpen] = useState(true);
  const [battlePreviewOpen, setBattlePreviewOpen] = useState(false);
  const [battleIntroPhase, setBattleIntroPhase] = useState<3 | 2 | 1 | 'start' | null>(null);
  const [battlePreviewState, setBattlePreviewState] = useState<BattlePreviewState>(createInitialBattlePreviewState);
  const [battlePartnerSkillDisplay, setBattlePartnerSkillDisplay] = useState<BattlePartnerSkillDisplay>(null);
  const [battleMotion, setBattleMotion] = useState<BattleMotionState>(null);
  const [battleHitEffect, setBattleHitEffect] = useState<BattleHitEffectState>(null);
  const [battleSupportEffect, setBattleSupportEffect] = useState<BattleSupportEffectState>(null);
  const [battleDamagePopups, setBattleDamagePopups] = useState<BattleDamagePopup[]>([]);
  const [battleResultReveal, setBattleResultReveal] = useState(false);
  const previousBattleVitalsRef = useRef<{ hpById: Record<string, number>; battleSp: number } | null>(null);
  const resolvedPartnerTurnRef = useRef<string | null>(null);
  const battleLogRef = useRef<HTMLDivElement | null>(null);
  const battleLoseSoundPlayedRef = useRef(false);
  const [battleItemPanelOpen, setBattleItemPanelOpen] = useState(false);
  const [battleItemSelectionStep, setBattleItemSelectionStep] = useState<BattleItemSelectionStep>('item');
  const [selectedBattleCommandIndex, setSelectedBattleCommandIndex] = useState(0);
  const [selectedBattleItemIndex, setSelectedBattleItemIndex] = useState(0);
  const [selectedBattleItemTargetIndex, setSelectedBattleItemTargetIndex] = useState(0);
  const [battleTestBeastId, setBattleTestBeastId] = useState<BeastId>('mole');
  const [battleTestPartnerId, setBattleTestPartnerId] = useState<string>('');
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
  // キーボードで現在操作している「領域」そのものを黄色い枠で示す。
  // 個々の選択肢ではなく、矢印キーが届くボックス全体を囲う。
  const menuKeyboardFocusStyle = (isActive: boolean): React.CSSProperties => (
    isActive
      ? {
          outline: '3px solid #fff200',
          outlineOffset: '3px',
          boxShadow: '0 0 22px rgba(255, 242, 0, 0.58), inset 0 0 0 1px rgba(255, 249, 170, 0.72)',
        }
      : {}
  );
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
  const [debugGirlAffinities, setDebugGirlAffinities] = useState<Record<string, number>>({});
  const menuGirls = GIRL_DATA.map((girl, index) => ({
    id: girl.id,
    name: girl.girlName,
    trait: ['素直', '内気', '勝気', '甘えん坊', '好奇心旺盛'][index % 5],
    stage: ['未受精', '受精準備', '受精初期'][index % 3],
    level: 1,
    affinity: debugGirlAffinities[girl.id] ?? 1,
    cardImg: FARM_GIRL_CARD_IMAGES[girl.id] ?? FARM_GIRL_CARD_BACK_SRC,
    detailImg: FARM_GIRL_DETAIL_IMAGES[girl.id] ?? FARM_GIRL_CARD_BACK_SRC,
  }));
  const farmGirlEquipmentComments: Record<string, string> = {
    chibiichi: '小さな体で一生懸命ついてきてくれる、最初の相棒。畑でも探索でも、そばにいるだけで少し心強い。',
    mel: '甘く落ち着いた雰囲気でユウを支えるメロンの苗娘。無理をしがちな場面ほど、やさしく背中を押してくれる。',
    ruby: '明るく元気なトマトの苗娘。前向きな勢いで、重たい空気もぱっと軽くしてくれる。',
    viola: '静かな色気と芯の強さを持つブドウの苗娘。落ち着いた判断で探索を支えてくれる。',
    nazuna: '素朴で面倒見のいいなすの苗娘。田舎暮らしに慣れないユウを、自然体で助けてくれる。',
    kabune: 'まっすぐで頼もしいかぶの苗娘。足元を固めるように、堅実なサポートをしてくれる。',
    caro: '軽やかで反応の早いにんじんの苗娘。テンポよく動きたい時に頼れる同行者。',
    theta: '不思議な運を連れてくるしいたけの苗娘。見落としそうな拾い物や好機に気づかせてくれる。',
    cure: '清らかな雰囲気のきゅうりの苗娘。疲れた時ほど、そっと癒やしてくれる存在。',
    shiro: '落ち着いた守りの気配を持つだいこんの苗娘。危ない場面でユウをしっかり支える。',
    momona: 'やわらかく華やかなももの苗娘。場を明るくし、ユウの気持ちを前向きにしてくれる。',
    pan: 'どっしり頼れるかぼちゃの苗娘。小さな盾のように、ユウの前に立って守ってくれる。',
    puti: '竜の実のような力を秘めた苗娘。ここぞという時に大きな一押しをくれる。',
    roma: '少し変わった感性を持つロマネスコの苗娘。珍しいものを見つける勘が鋭い。',
    saffy: '黄金色の気配をまとったサフランの苗娘。苦しい返済生活にも希望を灯してくれる。',
  };
  const [itemMenuTab, setItemMenuTab] = useState('消耗品');
  const itemMenuTabRef = useRef('消耗品');
  const [selectedItemName, setSelectedItemName] = useState('いやし草もち');
  const selectedItemNameRef = useRef('いやし草もち');
  const [selectedEquipmentSlot, setSelectedEquipmentSlot] = useState('主人公-slot1');
  const selectedEquipmentSlotRef = useRef('主人公-slot1');
  const [equipmentActionOpen, setEquipmentActionOpen] = useState(false);
  const [selectedEquipmentOptionIndex, setSelectedEquipmentOptionIndex] = useState(0);
  const selectedEquipmentOptionIndexRef = useRef(0);
  const [equippedItems, setEquippedItems] = useState<Record<string, string>>(() => ({ ...INITIAL_EQUIPPED_ITEMS }));
  const equippedItemsRef = useRef(equippedItems);
  const [selectedSkillName, setSelectedSkillName] = useState('battle_hp_up');
  const selectedSkillNameRef = useRef('battle_hp_up');
  const [selectedSkillCategory, setSelectedSkillCategory] = useState<HeroSkillCategory>('farm');
  const selectedSkillCategoryRef = useRef<HeroSkillCategory>('farm');
  const [pendingSkillUnlockId, setPendingSkillUnlockId] = useState<string | null>(null);
  const [skillUnlockChoice, setSkillUnlockChoice] = useState<'yes' | 'no'>('yes');
  const [skillUnlockNotice, setSkillUnlockNotice] = useState<string | null>(null);
  const [skillUnlockSparkles, setSkillUnlockSparkles] = useState(false);
  const [selectedStatusGirlIndex, setSelectedStatusGirlIndex] = useState(0);
  const selectedStatusGirlIndexRef = useRef(0);
  const [selectedFarmGirlIndex, setSelectedFarmGirlIndex] = useState(0);
  const selectedFarmGirlIndexRef = useRef(0);
  const selectedFarmGirlForDetail = menuGirls[selectedFarmGirlIndex] ?? menuGirls[0];
  const [farmGirlDetailOpen, setFarmGirlDetailOpen] = useState(false);
  const [farmGirls, setFarmGirls] = useState<FarmGirlSaveState[]>(createInitialFarmGirls);
  const [revealingFarmGirlIds, setRevealingFarmGirlIds] = useState<string[]>([]);
  const [ownedGirlSeeds, setOwnedGirlSeeds] = useState<string[]>([]);
  const [farmFieldSlots, setFarmFieldSlots] = useState<FarmFieldSlotState[]>(() => createInitialFarmFieldSlots('hard'));
  const [plantingSeedId, setPlantingSeedId] = useState<string | null>(null);
  const [farmSlotInteractionStage, setFarmSlotInteractionStage] = useState<FarmSlotInteractionStage | null>(null);
  const [activeFarmSlotKey, setActiveFarmSlotKey] = useState<string | null>(null);
  const [farmSlotConfirmChoice, setFarmSlotConfirmChoice] = useState<'yes' | 'no'>('yes');
  const [selectedNearbySeedIndex, setSelectedNearbySeedIndex] = useState(0);
  const [pendingNearbySeedId, setPendingNearbySeedId] = useState<string | null>(null);
  const [nearbyFarmSlotKey, setNearbyFarmSlotKey] = useState<string | null>(null);
  const farmSlotInteractionBlockedRef = useRef<string | null>(null);
  const [showFarmPlantButtonPreview, setShowFarmPlantButtonPreview] = useState(false);
  const [selectedFarmPlantButtonKey, setSelectedFarmPlantButtonKey] = useState('left_1');
  const [farmPlantButtonPlacements, setFarmPlantButtonPlacements] = useState<Record<string, { offsetX: number; offsetY: number }>>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem('farm_plant_button_placements') ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    window.localStorage.setItem('farm_plant_button_placements', JSON.stringify(farmPlantButtonPlacements));
  }, [farmPlantButtonPlacements]);
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
  const [zukanFilter, setZukanFilter] = useState('苗娘');
  const zukanFilterRef = useRef('苗娘');
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
  const [miningMiniGameOpen, setMiningMiniGameOpen] = useState(false);
  const [miningMiniGamePhase, setMiningMiniGamePhase] = useState<'countdown' | 'playing' | 'result'>('countdown');
  const [miningCountdown, setMiningCountdown] = useState(MINING_COUNTDOWN_SECONDS);
  const [miningMiniGamePointId, setMiningMiniGamePointId] = useState<string | null>(null);
  const [miningPreviewOre, setMiningPreviewOre] = useState<(typeof ORE_DATA)[number] | null>(null);
  const [miningNotes, setMiningNotes] = useState<MiningRhythmNote[]>([]);
  const [miningElapsedMs, setMiningElapsedMs] = useState(0);
  const [miningGauge, setMiningGauge] = useState(0);
  const [miningLastJudgement, setMiningLastJudgement] = useState<'PERFECT' | 'GOOD' | 'BAD' | 'MISS' | null>(null);
  const [miningResultText, setMiningResultText] = useState('');
  const [miningResultGauge, setMiningResultGauge] = useState(0);
  const [miningResultReward, setMiningResultReward] = useState<MiningResultReward | null>(null);
  const [miningResultFullCombo, setMiningResultFullCombo] = useState(false);
  const [miningImpactKey, setMiningImpactKey] = useState(0);
  const [miningImpactJudgement, setMiningImpactJudgement] = useState<'PERFECT' | 'GOOD' | 'BAD' | null>(null);
  const [, setMiningCombo] = useState(0);
  const [miningComboEffect, setMiningComboEffect] = useState<{ id: number; src: string } | null>(null);
  const [miningSparkle, setMiningSparkle] = useState<FishingBiteSparkle | null>(null);
  const [miningRhythmTimings, setMiningRhythmTimings] = useState<MiningRhythmTimingsByBgm>(loadMiningRhythmTimings);
  const [miningRhythmRecording, setMiningRhythmRecording] = useState(false);
  const [miningRhythmRecordingSource, setMiningRhythmRecordingSource] = useState<string>(MINING_BGM_SOURCES.normal);
  const [miningRhythmRecordedTimings, setMiningRhythmRecordedTimings] = useState<number[]>([]);
  const [systemNotice, setSystemNotice] = useState('システム項目を選択してください。');
  const systemNoticeRef = useRef('システム項目を選択してください。');
  const [selectedSystemActionIndex, setSelectedSystemActionIndex] = useState(0);
  const selectedSystemActionIndexRef = useRef(0);
  const [gold, setGold] = useState(5000);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('hard');
  const [gameMode, setGameMode] = useState<GameMode>('story');
  const [hasUnlockedEndlessNurseryMode, setHasUnlockedEndlessNurseryMode] = useState(() => (
    localStorage.getItem(ENDLESS_NURSERY_UNLOCK_STORAGE_KEY) === 'true'
  ));
  const [collectionProgress, setCollectionProgress] = useState<CollectionProgress>(createInitialCollectionProgress);
  const [endlessStats, setEndlessStats] = useState<EndlessStats>(createInitialEndlessStats);
  const [debtAmount, setDebtAmount] = useState(() => getInitialDebtAmount('hard'));
  const [repaymentCycleDays, setRepaymentCycleDays] = useState(DEFAULT_REPAYMENT_CYCLE_DAYS);
  const [repaymentEventPending, setRepaymentEventPending] = useState(false);
  const [selectedAdditionalRepayment, setSelectedAdditionalRepayment] = useState<(typeof ADDITIONAL_REPAYMENT_OPTIONS)[number]>(50_000);
  const [storyCleared, setStoryCleared] = useState(false);
  const [farmCredit, setFarmCredit] = useState(0);
  const [successfulRepaymentCount, setSuccessfulRepaymentCount] = useState(0);
  const [missedRepaymentCount, setMissedRepaymentCount] = useState(0);
  const [heroLevel, setHeroLevel] = useState<HeroLevel>(1);
  const [heroSP, setHeroSP] = useState(0);
  const [unlockedHeroSkills, setUnlockedHeroSkills] = useState<string[]>([]);
  const [hasBeastPremonition, setHasBeastPremonition] = useState(false);
  const [premonitionDay, setPremonitionDay] = useState<number | null>(null);
  const [scheduledBeastAttackDay, setScheduledBeastAttackDay] = useState<number | null>(null);
  const [mountainLordAttackPending, setMountainLordAttackPending] = useState(false);
  const [beastAttackPending, setBeastAttackPending] = useState(false);
  const [companionGirlId, setCompanionGirlId] = useState<string | null>(null);
  const [currentWeeklyInterestRate, setCurrentWeeklyInterestRate] = useState(() => createWeeklyInterestRate('hard', 0, 0));
  const [interestRateCycleIndex, setInterestRateCycleIndex] = useState(0);
  const [currentAP, setCurrentAP] = useState(5);
  const [kurumiTradeTotal, setKurumiTradeTotal] = useState(0);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>(() => ({ ...INITIAL_INVENTORY_COUNTS }));
  const maxAPPerTimeSlot = 5;
  const actionCountLabel = `${currentAP}/${maxAPPerTimeSlot}`;
  const nextHeroLevelRequirement = getNextHeroLevelRequirement(heroLevel);
  const nextHeroLevelRequirementText = nextHeroLevelRequirement
    ? `返済成功あと${Math.max(0, nextHeroLevelRequirement.successfulRepaymentCount - successfulRepaymentCount)}回 または 農場信用度${nextHeroLevelRequirement.farmCredit}`
    : '最大成長';
  const titleTheme: TitleTheme = hasUnlockedEndlessNurseryMode ? 'endlessUnlocked' : 'default';
  const isEndlessNurseryMode = () => gameMode === 'endlessNursery';
  const isEndlessTitleTheme = () => titleTheme === 'endlessUnlocked';
  const canStartEndlessNurseryMode = () => hasUnlockedEndlessNurseryMode;
  const unlockEndlessNurseryMode = () => setHasUnlockedEndlessNurseryMode(true);
  const incrementEndlessStat = (key: keyof EndlessStats, amount = 1) => {
    if (!isEndlessNurseryMode()) return;
    setEndlessStats(previous => ({ ...previous, [key]: previous[key] + amount }));
  };
  const getCollectionCompletionRate = () => {
    const totalTrustEventCount = GIRL_DATA.reduce((sum, girl) => sum + girl.trustEvents.length, 0);
    const total = GIRL_DATA.length + FISH_ZUKAN_ENTRIES.length + totalTrustEventCount + BEAST_BATTLE_DATA.length + CRAFT_RECIPE_IDS.length;
    const completed =
      collectionProgress.collectedGirlIds.length +
      collectionProgress.caughtFishIds.length +
      collectionProgress.unlockedEventIds.length +
      collectionProgress.defeatedBeastIds.length +
      collectionProgress.craftedItemIds.length;
    return total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  };
  const getEndlessCompletionTitle = (completionRate: number) => {
    if (completionRate >= 100) return '∞ 苗床マスター';
    if (completionRate >= 75) return '伝説の苗床';
    if (completionRate >= 50) return '繁栄する農場';
    if (completionRate >= 25) return '開拓者';
    return '苗床初心者';
  };
  const titleImageSrc = TITLE_IMAGE_SOURCES[titleTheme] ?? TITLE_IMAGE_SOURCES.default;
  const companionGirlName = companionGirlId
    ? GIRL_DATA.find(girl => girl.id === companionGirlId)?.girlName ?? companionGirlId
    : null;
  const hasHeroSkill = (skillId: string) => unlockedHeroSkills.includes(skillId);
  const getHeroSkillMultiplier = (skillId: string, percentBonus: number) => (
    hasHeroSkill(skillId) ? 1 + percentBonus / 100 : 1
  );
  const getSkillAdjustedWeeklyInterestRate = (rate: number) => (
    Number(clampNumber(rate - (hasHeroSkill('farm_interest_down') ? 0.3 : 0), MIN_INTEREST_RATE, MAX_INTEREST_RATE).toFixed(1))
  );
  const getSkillAdjustedCompanionHarvestModifier = (isCompanion: boolean, trust: number): CompanionHarvestModifier => {
    if (!hasHeroSkill('companion_harvest_penalty_down')) return getCompanionHarvestModifier(isCompanion, trust);
    if (!isCompanion) return { multiplier: 1, isFutureLoverBonusEligible: false };
    if (trust >= 80) return { multiplier: 1, isFutureLoverBonusEligible: trust >= 100 };
    if (trust >= 60) return { multiplier: 0.9, isFutureLoverBonusEligible: false };
    if (trust >= 40) return { multiplier: 0.7, isFutureLoverBonusEligible: false };
    if (trust >= 20) return { multiplier: 0.35, isFutureLoverBonusEligible: false };
    return { multiplier: 0, isFutureLoverBonusEligible: false };
  };
  const getSkillAdjustedTrustGain = (condition: FarmGirlCondition) => (
    Math.max(1, Math.round(getAffectedTrustGain(condition) * getHeroSkillMultiplier('companion_trust_up', 25)))
  );
  const getSkillAdjustedSeedlingCareLimit = (
    action: 'caress' | 'finger' | 'fertilize',
    crop: Pick<FarmGirlCropData, 'growthDays'>,
  ) => {
    if (action === 'caress' && hasHeroSkill('farm_caress')) return 2;
    if (action === 'finger' && hasHeroSkill('farm_fingering')) return 2;
    if (action === 'fertilize' && hasHeroSkill('farm_abstinence') && crop.growthDays >= 5) return 2;
    return 1;
  };
  const getHybridCultivationSuccessRate = () => (hasHeroSkill('special_adaptation_research') ? 0.8 : 0.65);
  const getHybridBlessingMultiplier = (farmGirl?: Pick<FarmGirlSaveState, 'hybridAdapted'> | null) => (
    farmGirl?.hybridAdapted && hasHeroSkill('special_hybrid_blessing') ? 1.15 : 1
  );
  const getSkillAdjustedFarmQuality = (quality: number, farmGirl?: Pick<FarmGirlSaveState, 'hybridAdapted'> | null) => (
    farmGirl?.hybridAdapted && hasHeroSkill('special_hybrid_blessing') ? Math.max(quality, 60) : quality
  );
  const getGatheringRareRateMultiplier = () => (hasHeroSkill('gather_lumber_rare_up') ? 1.05 : 1);
  const getGatheringMinFloorBonus = () => (hasHeroSkill('gather_tool_care') ? 0.1 : 0);
  const getSkillAdjustedFishSize = (fish: FishZukanEntry, size: number) => {
    const minFloorBonus = getGatheringMinFloorBonus();
    if (minFloorBonus <= 0 || fish.sizeMax <= fish.sizeMin || typeof fish.fixedSize === 'number') return size;
    const minSize = fish.sizeMin + (fish.sizeMax - fish.sizeMin) * minFloorBonus;
    return Number(Math.max(size, minSize).toFixed(1));
  };
  const applyCompanionRegenPerHeroTurn = (
    hero: BattlePreviewState['hero'],
    allies: readonly (BattleUnitState | null)[],
    turnLogs: string[],
  ) => {
    if (!hasHeroSkill('battle_companion_regen')) return;
    const activeCompanion = allies.find(ally => ally && ally.hp > 0);
    if (!activeCompanion || hero.hp <= 0 || hero.hp >= hero.maxHp) return;
    const recoveredHp = Math.min(hero.maxHp - hero.hp, 3 + Math.floor(Math.random() * 3));
    if (recoveredHp <= 0) return;
    hero.hp += recoveredHp;
    turnLogs.push(`母乳分泌促進：主人公のHPが${recoveredHp}回復！`);
    triggerBattleSupportEffect(hero.id);
    triggerBattleDamagePopup(hero.id, recoveredHp, false, true);
    playUiSound(BATTLE_SE_SOURCES.cure);
  };
  const canUnlockHeroSkill = (skillId: string) => {
    const skill = getHeroSkillById(skillId);
    if (!skill || hasHeroSkill(skillId)) return false;
    return heroSP >= skill.costSP &&
      heroLevel >= skill.requiredHeroLevel &&
      skill.requiredSkillIds.every(requiredSkillId => hasHeroSkill(requiredSkillId));
  };
  const unlockHeroSkill = (skillId: string) => {
    const skill = getHeroSkillById(skillId);
    if (!skill || !canUnlockHeroSkill(skillId)) return;
    setHeroSP(currentSP => currentSP - skill.costSP);
    setUnlockedHeroSkills(currentSkills => (
      currentSkills.includes(skillId) ? currentSkills : [...currentSkills, skillId]
    ));
    setDialogMessage(`${skill.name}を習得した！`);
  };
  const requestHeroSkillUnlock = (skillId: string) => {
    const skill = getHeroSkillById(skillId);
    if (!skill || hasHeroSkill(skillId)) return;
    if (heroSP < skill.costSP) {
      setSkillUnlockNotice(`SPが足りません。\n必要SP：${skill.costSP} / 現在SP：${heroSP}`);
      return;
    }
    if (!canUnlockHeroSkill(skillId)) {
      setSkillUnlockNotice(`${skill.name}はまだ取得できません。\n${getHeroSkillById(skill.requiredSkillIds[0] ?? '')?.name ?? '必要条件'}を確認してください。`);
      return;
    }
    setSkillUnlockChoice('yes');
    setPendingSkillUnlockId(skillId);
  };
  const confirmHeroSkillUnlock = (skillIdOverride?: string, choiceOverride?: 'yes' | 'no') => {
    const skillId = skillIdOverride ?? pendingSkillUnlockId;
    if (!skillId) return;
    if ((choiceOverride ?? skillUnlockChoice) === 'no') {
      setPendingSkillUnlockId(null);
      return;
    }
    const skill = getHeroSkillById(skillId);
    if (!skill || !canUnlockHeroSkill(skillId)) {
      setPendingSkillUnlockId(null);
      setSkillUnlockNotice('取得条件が変わったため、習得できませんでした。');
      return;
    }
    unlockHeroSkill(skillId);
    playUiSound('/se/cure.mp3');
    setPendingSkillUnlockId(null);
    setSkillUnlockSparkles(true);
    window.setTimeout(() => setSkillUnlockSparkles(false), 1100);
  };
  const [shopItems, setShopItems] = useState<ShopItem[]>([
    ...BATTLE_CONSUMABLE_ITEMS.map(item => ({
      name: item.name,
      price: item.price,
      stock: 99,
      type: '買う' as const,
      category: item.kind === 'heal' ? '戦闘回復' : '戦闘蘇生',
      desc: item.desc,
    })),
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
    const quality = getSkillAdjustedFarmQuality(farmGirl?.quality ?? 50, farmGirl);
    const price = getFarmHarvestSellPrice(
      crop,
      getFarmTrustBonus(farmGirl?.trust ?? 0).sellMultiplier,
      getFarmQualityMultiplier(quality),
      getHeroSkillMultiplier('farm_sell_up', 8) * getHybridBlessingMultiplier(farmGirl),
    );
    return [{
      name: crop.harvestItemName,
      price,
      stock,
      type: '売る',
      desc: `${crop.harvestItemName}。品質 ${quality}（${getFarmQualityLabel(quality)}）の農場収穫物です。`,
    }];
  });
  const battleMaterialShopItems = Object.entries(BEAST_DROP_SELL_PRICES).flatMap<ShopItem>(([name, price]) => {
    const stock = inventoryCounts[name] ?? 0;
    if (stock <= 0) return [];
    return [{
      name,
      price,
      stock,
      type: '売る',
      category: '素材',
      desc: `${name}。装備や道具のクラフトに使える獣素材です。`,
    }];
  });
  const shopItemsForDisplay = [
    ...shopItems.filter(item => (
      item.type === '買う' &&
      item.stock > 0 &&
      (getBattleConsumableItem(item.name)?.unlockRepaymentCount ?? 0) <= successfulRepaymentCount &&
      (!isRecipeItemName(item.name) || (inventoryCounts[item.name] ?? 0) === 0)
    )),
    ...fishShopItems,
    ...lumberShopItems,
    ...oreShopItems,
    ...farmHarvestShopItems,
    ...battleMaterialShopItems,
    ...shopItems.filter(item => item.type === '売る' && (inventoryCounts[item.name] ?? 0) > 0),
  ];

  useEffect(() => {
    setShopItems(prev => {
      const next = prev.filter(item => !REMOVED_LEGACY_ITEM_NAMES.includes(item.name as typeof REMOVED_LEGACY_ITEM_NAMES[number]));
      return next.length === prev.length ? prev : next;
    });
    setInventoryCounts(prev => {
      const next = migrateInventoryItemNames(prev);
      let changed = false;
      if (next !== prev) changed = true;
      REMOVED_LEGACY_ITEM_VARIANTS.forEach(itemName => {
        if ((next[itemName] ?? 0) > 0) {
          delete next[itemName];
          changed = true;
        }
      });
      DEBUG_BATTLE_CONSUMABLE_ITEM_NAMES.forEach(itemName => {
        if ((next[itemName] ?? 0) <= 0) {
          next[itemName] = 1;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    if (REMOVED_LEGACY_ITEM_VARIANTS.includes(selectedItemName)) {
      setSelectedItemName('いやし草もち');
      selectedItemNameRef.current = 'いやし草もち';
    } else {
      const renamedSelectedItemName = LEGACY_ITEM_NAME_RENAMES[toBaseItemName(selectedItemName)];
      if (renamedSelectedItemName) {
        const nextSelectedItemName = selectedItemName === toDebugItemName(toBaseItemName(selectedItemName))
          ? toDebugItemName(renamedSelectedItemName)
          : renamedSelectedItemName;
        setSelectedItemName(nextSelectedItemName);
        selectedItemNameRef.current = nextSelectedItemName;
      }
    }
  }, [inventoryCounts, selectedItemName]);

  const renderMenuDetail = (id: MenuItemId) => {
    const tabs = ['消耗品', '素材', '装備品', '売却品', 'だいじなもの'];
    const zukanGirlCards = Array.from({ length: 20 }).map((_, index) => {
      const girl = menuGirls[index];
      const farmGirl = girl ? farmGirls.find(entry => entry.girlId === girl.id) : undefined;
      const unlocked = Boolean(farmGirl?.cardRevealed);
      return { girl, unlocked };
    });
    const itemByTab = createItemMenuItems(inventoryCounts);
    const getOwnedMenuItems = (items: string[]) => items.filter(name => (inventoryCounts[name] ?? 0) > 0);
    const selectedTabItems = getOwnedMenuItems(itemByTab[itemMenuTab] ?? itemByTab['消耗品']);
    const activeItem = selectedTabItems.includes(selectedItemName) ? selectedItemName : selectedTabItems[0] ?? '';
    const activeRecipe = activeItem ? RECIPE_DETAILS[activeItem] : undefined;
    const activeItemEffectText = craftRecipeSelectMode
      ? '作りたいレシピを選んでください。'
      : getItemMenuEffectText(activeItem, itemMenuTab);

    if (id === 'item') {
      return (
        <>
          <div className="grid grid-cols-[190px_1fr_260px] gap-4 h-full">
            <div className="flex flex-col gap-2 rounded-2xl" style={menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'primary')}>
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
            <div style={{ ...menuPanelBaseStyle, ...menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'secondary') }}>
              {selectedTabItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectedTabItems.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    data-menu-item-name={name}
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
                    className={`flex justify-between items-center px-4 py-3 border rounded cursor-pointer text-left ${activeItem === name ? 'bg-[#bc6c25]/45 border-white ring-4 ring-[#ffd166]/70 shadow-[0_0_18px_rgba(255,209,102,0.42)]' : 'bg-black/35 border-[#5a3010] hover:bg-[#3a2418]'}`}
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
                効果: {activeItemEffectText}
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
      const companionEquipmentGirl = companionGirlId ? GIRL_DATA.find(girl => girl.id === companionGirlId) : undefined;
      const heroBattleStats = HERO_BATTLE_STATS_BY_LEVEL[heroLevel];
      const heroBattleEquipmentBonus = getHeroBattleEquipmentBonus(equippedItems);
      const heroBattleMaxHp = Math.round((heroBattleStats.hp + heroBattleEquipmentBonus.hp) * (hasHeroSkill('battle_hp_up') ? 1.1 : 1));
      const equipmentCharacters = [
        {
          slotOwner: '主人公',
          label: 'ユウ',
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
          stats: [
            ['攻撃力', heroBattleStats.attack + heroBattleEquipmentBonus.attack],
            ['防御力', heroBattleStats.defense + heroBattleEquipmentBonus.defense],
            ['素早さ', heroBattleStats.speed],
            ['HP', heroBattleMaxHp],
          ],
          description: '都会から来た純粋な少年。\n爺ちゃんのエロい遺言を真に受けて田舎へ。\n借金地獄に突き落とされながらも、娘たちを孕ませ育てて\n完済を目指す頑張り屋！',
        },
        ...(companionEquipmentGirl ? [{
          slotOwner: companionEquipmentGirl.girlName,
          label: companionEquipmentGirl.girlName,
          img: FARM_GIRL_CARD_IMAGES[companionEquipmentGirl.id] ?? '/img/nae.png',
          level: 1,
          role: '',
          affinity: menuGirls.find(girl => girl.id === companionEquipmentGirl.id)?.affinity ?? 1,
          slotLabels: ['slot1', 'slot2'],
          slots: [
            equippedItems[`${companionEquipmentGirl.girlName}-slot1`] || '未装備',
            equippedItems[`${companionEquipmentGirl.girlName}-slot2`] || '未装備',
          ],
          stats: [
            ['攻撃力', 6],
            ['防御力', 5],
            ['素早さ', 16],
            ['HP', 18],
          ],
          description: farmGirlEquipmentComments[companionEquipmentGirl.id] ?? `${companionEquipmentGirl.girlName}が同行中。ユウの旅をそばで支えてくれます。`,
        }] : []),
      ];
      const selectedEquipmentCharacter = equipmentCharacters.find(char => selectedEquipmentSlot.startsWith(char.slotOwner)) ?? equipmentCharacters[0];
      const selectedEquipmentSlotMatch = /slot(\d+)$/.exec(selectedEquipmentSlot);
      const selectedEquipmentSlotIndex = selectedEquipmentSlotMatch ? Math.max(0, Number(selectedEquipmentSlotMatch[1]) - 1) : 0;
      const selectedEquipmentSlotLabel = selectedEquipmentCharacter.slotLabels[selectedEquipmentSlotIndex] ?? `slot${selectedEquipmentSlotIndex + 1}`;
      const selectedEquippedItem = equippedItems[selectedEquipmentSlot] || '';
      const equipmentOptionsBySlot: Record<string, string[]> = {
        '釣具・武器系': withDebugItemVariants(['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿', '木剣', '獣殺し', '天の裁き']),
        '採取道具系': withDebugItemVariants(['のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし']),
        'アクセサリー・防具': withDebugItemVariants(['農神の指輪', FISHING_NUSHI_RING_NAME, '毛皮の服', '剛牙の鎧', '神域の加護']),
        'slot1': ['小さな鈴'],
        'slot2': [],
      };
      const equippedItemNames = Object.entries(equippedItems)
        .filter(([slotId, name]) => slotId !== selectedEquipmentSlot && Boolean(name))
        .map(([, name]) => name);
      const equipableItems = (equipmentOptionsBySlot[selectedEquipmentSlotLabel] ?? []).filter(name => (
        (inventoryCounts[name] ?? 0) > 0 && !equippedItemNames.includes(name)
      ));
      const showEquipmentPicker = equipmentActionOpen && menuContentFocus === 'secondary' && !selectedEquippedItem;
      const equipSelectedItem = (name: string) => {
        playFixSound();
        setEquippedItems(prev => ({ ...prev, [selectedEquipmentSlot]: name }));
        setDialogMessage(`${name}を装備しました。`);
      };
      return (
        <div className="relative grid h-full min-h-0 grid-cols-[58%_1fr] gap-5 pb-10">
          <div style={{ ...menuPanelBaseStyle, ...menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'primary') }} className="grid h-full min-h-0 grid-cols-2 gap-4 overflow-hidden">
            {equipmentCharacters.map((char) => (
              <button
                key={char.slotOwner}
                type="button"
                onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedEquipmentSlot(`${char.slotOwner}-slot1`); }}
                onMouseEnter={() => { if (!selectedEquipmentSlot.startsWith(char.slotOwner)) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setEquipmentActionOpen(false); setSelectedEquipmentSlot(`${char.slotOwner}-slot1`); }}
                className={`farm-menu-character-stage relative flex cursor-pointer flex-col items-center justify-end overflow-hidden border p-4 pb-6 ${selectedEquipmentSlot.startsWith(char.slotOwner) ? 'is-selected border-white ring-4 ring-[#ffd166]/50' : 'border-[#5a3010]'}`}
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
          <div style={{ ...menuPanelBaseStyle, ...menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'secondary') }} className="flex min-h-0 flex-col gap-4 overflow-hidden">
              <div key={selectedEquipmentCharacter.slotOwner} className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-20 h-24 rounded border border-[#f1c27d]/60 bg-black/35 overflow-hidden flex items-end justify-center">
                    <img src={selectedEquipmentCharacter.img} className="max-h-full w-full object-contain" alt={selectedEquipmentCharacter.label} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[#fdf6e3] text-3xl font-bold leading-tight">{selectedEquipmentCharacter.label}</div>
                    <div className="mt-1 text-xl">{renderStars(selectedEquipmentCharacter.affinity)}</div>
                  </div>
                </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedEquipmentCharacter.slots.map((item, slotIndex) => {
                  const slot = `slot${slotIndex + 1}`;
                  const slotId = `${selectedEquipmentCharacter.slotOwner}-${slot}`;
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
                    <div className="mt-3 rounded border border-[#5a3010] bg-black/30 px-4 py-3 text-[#c8a87a]">
                      上の大きな装備一覧から選択
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {selectedEquipmentCharacter.stats.map(([label, value]) => (
                  <div key={label} className="flex justify-between bg-black/25 border border-[#5a3010]/70 rounded px-4 py-3">
                    <span className="text-[#c8a87a]">{label}</span>
                    <span className="text-[#fdf6e3] text-xl font-bold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 whitespace-pre-line bg-black/30 border border-[#5a3010] rounded p-4 text-[#c8a87a] leading-relaxed">
                {selectedEquipmentCharacter.description}
              </div>
            </div>
          </div>
          {showEquipmentPicker && (
            <div className="absolute inset-x-6 top-4 z-30 rounded-lg border-2 border-[#ffd166] bg-[#1b100c]/95 p-5 shadow-[0_0_34px_rgba(0,0,0,0.75),0_0_22px_rgba(255,209,102,0.35)]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black tracking-[0.12em] text-[#dda15e]">装備一覧</div>
                  <div className="mt-1 text-2xl font-black leading-tight text-[#fff7dc]">{selectedEquipmentSlotLabel}</div>
                  <div className="mt-1 text-sm font-bold text-[#c8a87a]">{selectedEquipmentCharacter.label}に装備するアイテムを選択</div>
                </div>
                <div className="rounded border border-[#5a3010] bg-black/35 px-3 py-2 text-right text-xs font-bold leading-relaxed text-[#d7b98a]">
                  ↑↓←→ 選択<br />Enter 決定 / Esc 戻る
                </div>
              </div>
              <div className="grid max-h-[300px] grid-cols-3 gap-3 overflow-y-auto pr-2">
                {equipableItems.length > 0 ? equipableItems.map((name, optionIndex) => (
                  <button
                    key={name}
                    type="button"
                    data-equipment-option-index={optionIndex}
                    onPointerDown={(e) => { e.stopPropagation(); setSelectedEquipmentOptionIndex(optionIndex); }}
                    onClick={() => equipSelectedItem(name)}
                    className={`relative flex min-h-[76px] items-center justify-between gap-3 rounded border px-4 py-3 pl-9 text-left transition hover:bg-[#3a2418] ${
                      selectedEquipmentOptionIndex === optionIndex
                        ? 'border-white bg-[#bc6c25]/75 ring-4 ring-[#ffd166]/75 shadow-[0_0_22px_rgba(255,209,102,0.45)]'
                        : 'border-[#7a4317] bg-[#2d1b15]/88'
                    }`}
                  >
                    {selectedEquipmentOptionIndex === optionIndex && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-black text-[#ffd166]">▶</span>
                    )}
                    <span className="min-w-0 break-keep text-base font-black leading-snug text-[#fdf6e3]">{name}</span>
                    <span className="shrink-0 rounded bg-black/30 px-2 py-1 text-sm font-bold text-[#dda15e]">x{inventoryCounts[name] ?? 0}</span>
                  </button>
                )) : (
                  <div className="col-span-3 rounded border border-[#5a3010] bg-black/35 px-5 py-6 text-center text-lg font-bold text-[#c8a87a]">
                    装備できるアイテムがありません。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (id === 'status') {
      const rawSelectedSkill = getHeroSkillById(selectedSkillName);
      const isHeroSkillVisible = (skill: HeroSkillData) => (
        !skill.isHidden || (
          heroLevel >= skill.requiredHeroLevel &&
          skill.requiredSkillIds.every(requiredSkillId => hasHeroSkill(requiredSkillId))
        )
      );
      const getUnlockBlockReason = (skill: HeroSkillData) => {
        if (hasHeroSkill(skill.id)) return '取得済み';
        if (heroSP < skill.costSP) return 'SP不足';
        if (heroLevel < skill.requiredHeroLevel) return '成長度不足';
        const missingSkill = skill.requiredSkillIds.find(requiredSkillId => !hasHeroSkill(requiredSkillId));
        return missingSkill ? `${getHeroSkillById(missingSkill)?.name ?? missingSkill} が必要` : '取得可能';
      };
      const selectedCategorySkills = getHeroSkillsByCategory(selectedSkillCategory).filter(isHeroSkillVisible);
      const selectedSkill = selectedCategorySkills.find(skill => skill.id === rawSelectedSkill?.id) ?? selectedCategorySkills[0] ?? rawSelectedSkill ?? HERO_SKILL_DATA[0];
      const selectTreeSkill = (skill: HeroSkillData) => {
        playFixSound();
        setMenuFocusArea('content');
        setMenuContentFocus('primary');
        setSelectedSkillName(skill.id);
      };
      const selectTreeCategory = (category: HeroSkillCategory) => {
        playFixSound();
        setSelectedSkillCategory(category);
        const firstSkill = getHeroSkillsByCategory(category).find(isHeroSkillVisible);
        if (firstSkill) setSelectedSkillName(firstSkill.id);
      };
      const skillIconSheetIndexes: Record<string, number> = {
        farm_harvest_up: 0,
        farm_sell_up: 1,
        farm_interest_down: 2,
        gather_fishing_rare_up: 3,
        gather_mining_rare_up: 4,
        gather_lumber_rare_up: 5,
        gather_tool_care: 6,
        battle_hp_up: 7,
        battle_damage_reduce: 8,
        battle_enemy_attack_down_trap: 9,
        battle_enemy_defense_down_trap: 10,
        battle_beast_damage_up: 11,
        battle_companion_regen: 12,
        companion_trust_up: 13,
        companion_harvest_penalty_down: 14,
        companion_battle_support: 15,
        special_life_understanding: 16,
        special_hybrid_cultivation: 17,
        special_adaptation_research: 18,
        special_hybrid_blessing: 19,
        farm_seedling_care: 20,
        farm_quality_eye: 21,
        farm_caress: 22,
        farm_fingering: 23,
        farm_abstinence: 24,
      };
      const renderSkillIcon = (skill: HeroSkillData, className = '') => {
        const sheetIndex = skillIconSheetIndexes[skill.id];
        if (sheetIndex === undefined) {
          return (
            <span className={`grid place-items-center text-4xl leading-none ${className}`}>
              {skill.icon}
            </span>
          );
        }
        const column = sheetIndex % 5;
        const row = Math.floor(sheetIndex / 5);
        const iconZoom = 1.12;
        const iconOffset = (iconZoom - 1) * 50;
        return (
          <span className={`relative grid place-items-center overflow-hidden ${className}`} aria-hidden="true">
            <span className="relative block aspect-[16/9] w-full overflow-hidden">
              <img
                src="/img/skill.png"
                alt=""
                className="absolute max-w-none"
                style={{
                  width: `${500 * iconZoom}%`,
                  height: 'auto',
                  left: `${-(column * 100 * iconZoom + iconOffset)}%`,
                  top: `${-(row * 100 * iconZoom + iconOffset)}%`,
                }}
              />
            </span>
          </span>
        );
      };
      const renderSkillBadge = (label: string, className = '') => (
        <span className={`rounded-full border-2 px-2.5 py-1 text-base font-black leading-none shadow-lg ${className}`}>
          {label}
        </span>
      );
      const getSkillEffectSummary = (skill: HeroSkillData) => {
        switch (skill.id) {
          case 'farm_seedling_care':
          case 'farm_quality_eye':
          case 'farm_caress':
          case 'farm_fingering':
          case 'farm_abstinence':
          case 'farm_harvest_up':
          case 'farm_sell_up':
          case 'farm_interest_down':
          case 'battle_enemy_attack_down_trap':
          case 'battle_enemy_defense_down_trap':
          case 'battle_beast_damage_up':
          case 'battle_companion_regen':
          case 'gather_fishing_rare_up':
          case 'gather_mining_rare_up':
          case 'gather_lumber_rare_up':
          case 'gather_tool_care':
          case 'companion_trust_up':
          case 'companion_harvest_penalty_down':
          case 'companion_battle_support':
          case 'special_life_understanding':
          case 'special_hybrid_cultivation':
          case 'special_adaptation_research':
          case 'special_hybrid_blessing':
            return skill.description;
        }
        switch (skill.effectType) {
          case 'sellPricePercent':
            return `売値 +${skill.effectValue}%`;
          case 'harvestAmountPercent':
            return `収穫量 +${skill.effectValue}%`;
          case 'interestReductionPercent':
            return `金利 -${skill.effectValue}%`;
          case 'qualityDailyCapBonus':
            return skill.effectValue > 0 ? `日次品質上限 +${skill.effectValue}` : '品質系スキルを解放';
          case 'fertilizerGrowthCapBonus':
            return `肥料短縮上限 +${skill.effectValue}`;
          case 'heroHpPercent':
            return `最大HP +${skill.effectValue}%`;
          case 'damageReductionPercent':
            return `被ダメージ -${skill.effectValue}%`;
          case 'beastDamagePercent':
            return `獣へのダメージ +${skill.effectValue}%`;
          case 'enemyAttackDownTrap':
            return `敵攻撃 -${skill.effectValue}%`;
          case 'enemyDefenseDownTrap':
            return `敵防御 -${skill.effectValue}%`;
          case 'companionRegenPerTurn':
            return '毎ターン HP 3-5回復';
          case 'gatheringPointRevealNearby':
            return '近くの採集点を表示';
          case 'gatheringPointRevealAll':
            return '採集点アイコンを表示';
          case 'lumberRarePercent':
          case 'fishingRarePercent':
          case 'miningRarePercent':
            return `レア率 +${skill.effectValue}%`;
          case 'gatheringMinSizePercent':
            return `サイズ/重量最低値 +${skill.effectValue}%`;
          case 'companionTrustGainPercent':
            return `同行信頼度 +${skill.effectValue}%`;
          case 'companionHarvestPenaltyReductionPercent':
            return `同行収穫ペナルティ軽減 +${skill.effectValue}%`;
          case 'companionBattleSupportMaxUses':
            return '戦闘支援回数 +1';
          case 'specialStateRecoveryBonus':
            return '看病AP 0 / 回復短縮';
          case 'unlockHybridCultivation':
            return '混合育成を解放';
          case 'hybridSuccessPercent':
            return `特殊適応成功率 +${skill.effectValue}%`;
          case 'hybridBlessing':
            return '交雑適性を付与';
          case 'nurseryGrowthSupport':
            return '農場スキルの起点';
        }
      };
      const nodeLeft = (column: number) => 12 + column * 19;
      const nodeTop = (row: number) => 14 + row * 20;
      const getShortenedLinePoints = (from: HeroSkillData, to: HeroSkillData) => {
        const x1 = nodeLeft(from.treeColumn);
        const y1 = nodeTop(from.treeRow);
        const x2 = nodeLeft(to.treeColumn);
        const y2 = nodeTop(to.treeRow);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.hypot(dx, dy) || 1;
        const shorten = 7;
        return {
          x1: x1 + (dx / distance) * shorten,
          y1: y1 + (dy / distance) * shorten,
          x2: x2 - (dx / distance) * shorten,
          y2: y2 - (dy / distance) * shorten,
        };
      };
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-3 h-full">
          <div style={menuPanelBaseStyle} className="overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[#fdf6e3] text-3xl font-bold">主人公スキルツリー</div>
                <div className="text-[#c8a87a] text-base">SPを使って主人公の育成方針を選ぼう</div>
              </div>
              <div className="rounded border border-[#ffd166]/70 bg-black/35 px-4 py-2 text-lg text-[#ffd166] font-bold">SP：{heroSP}</div>
            </div>
            <div className="grid h-[620px] grid-cols-[130px_minmax(0,1fr)] gap-3">
              <div className="flex min-h-0 flex-col rounded border border-[#5a3010] bg-black/25 p-2" style={menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'primary')}>
                <div className="mb-2 px-2 text-base font-black text-[#c8a87a]">系統</div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  {HERO_SKILL_CATEGORIES.map(category => (
                    <button
                      key={category}
                      type="button"
                      onPointerDown={(event) => { event.stopPropagation(); selectTreeCategory(category); }}
                      onClick={(event) => event.stopPropagation()}
                      className={`flex min-h-0 flex-1 w-full items-center justify-center border px-3 py-2 text-center text-lg font-black ${
                        selectedSkillCategory === category
                          ? 'border-[#fff1b8] bg-[#8d4e22] text-[#fff7dc] ring-4 ring-[#ffd166]/70 shadow-[0_0_20px_rgba(255,209,102,0.5)]'
                          : 'border-[#5a3010] bg-black/30 text-[#d7b98a] hover:bg-[#3a2418]'
                      }`}
                    >
                      {HERO_SKILL_CATEGORY_LABELS[category]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative overflow-hidden rounded border-2 border-[#76502c] bg-[radial-gradient(circle_at_50%_0%,rgba(213,149,81,0.2),transparent_46%),linear-gradient(135deg,rgba(46,28,18,0.96),rgba(18,13,11,0.96))]" style={menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'secondary')}>
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-[#76502c]/80 bg-black/35 px-4 py-3">
                  <div className="flex items-center gap-2 text-2xl font-black text-[#fff1b8]">{HERO_SKILL_CATEGORY_LABELS[selectedSkillCategory]}スキル</div>
                  <div className="text-sm font-bold text-[#c8a87a]">接続線は前提スキルを示します</div>
                </div>
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {selectedCategorySkills.flatMap(skill => skill.treeParentIds.map(parentId => {
                    const parent = selectedCategorySkills.find(candidate => candidate.id === parentId);
                    if (!parent) return null;
                    const active = hasHeroSkill(parent.id) && (hasHeroSkill(skill.id) || canUnlockHeroSkill(skill.id));
                    const line = getShortenedLinePoints(parent, skill);
                    return <line key={`${parent.id}-${skill.id}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={active ? '#ffd166' : '#5a4032'} strokeWidth="0.45" />;
                  }))}
                </svg>
                {selectedCategorySkills.map(skill => {
                  const isSelected = selectedSkill?.id === skill.id;
                  const isUnlocked = hasHeroSkill(skill.id);
                  const canUnlock = canUnlockHeroSkill(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onPointerDown={(event) => { event.stopPropagation(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); selectTreeSkill(skill); }}
                      onMouseEnter={() => { if (!isSelected) playCursorSound(); }}
                      onClick={(event) => event.stopPropagation()}
                      style={{ left: `${nodeLeft(skill.treeColumn)}%`, top: `${nodeTop(skill.treeRow)}%` }}
                      className={`absolute z-10 grid h-[146px] w-[122px] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_1fr_auto_auto] place-items-center rounded-lg border-2 p-2 text-center transition ${
                        isSelected
                          ? 'border-white bg-[#a75a27] ring-4 ring-[#fff1a8]/75 shadow-[0_0_0_3px_rgba(255,209,102,0.3),0_0_28px_rgba(255,209,102,0.55)]'
                          : isUnlocked
                            ? 'border-[#d8ff9a] bg-[#426b2c] ring-4 ring-[#bbf7a5]/65 shadow-[0_0_0_3px_rgba(216,255,154,0.2),0_0_28px_rgba(147,209,120,0.55)]'
                            : canUnlock
                              ? 'border-[#7be0d3] bg-[#1e5a58] hover:bg-[#28736f]'
                              : 'border-[#5a4032] bg-[#1a100d]/90 hover:bg-[#3a2418]'
                      }`}
                    >
                      {renderSkillBadge(
                        isUnlocked ? '取得済み' : '未取得',
                        `absolute -top-4 ${isUnlocked ? 'border-[#f0ffd0] bg-[#2f7a2e] text-[#f6ffe9] shadow-[0_0_18px_rgba(216,255,154,0.72)]' : 'border-[#ffcb9a] bg-[#6b341f] text-[#fff0dc]'}`
                      )}
                      <span className="mt-2 grid h-[78px] w-[78px] place-items-center overflow-hidden">
                        {renderSkillIcon(skill, 'h-full w-full rounded-full')}
                      </span>
                      <span className="mt-1 flex h-10 items-center text-center text-base font-black leading-tight text-[#fff7dc]">{skill.name}</span>
                      {renderSkillBadge('SP ' + skill.costSP, 'border-[#ffd166]/85 bg-[#3a2418] text-[#ffd166]')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
            <div style={menuTinyLabelStyle}>選択スキル</div>
            {selectedSkill && (
              <div className="grid h-[118px] place-items-center">
                {renderSkillIcon(selectedSkill, 'h-[112px] w-[112px] rounded-full')}
              </div>
            )}
            <div className="text-[#fdf6e3] text-3xl font-bold">{selectedSkill?.name ?? 'スキル未選択'}</div>
            <div className="rounded border border-[#5a3010] bg-black/30 p-3">
              <div style={menuTinyLabelStyle}>系統</div>
              <div className="mt-1 text-[#ffd166] text-xl font-bold">{selectedSkill ? HERO_SKILL_CATEGORY_LABELS[selectedSkill.category] : '-'}</div>
            </div>
            <div className="rounded border border-[#5a3010] bg-black/30 p-3 text-base font-bold text-[#f3d8a8] leading-relaxed">
              {selectedSkill?.description ?? 'スキルを選択してください。'}
            </div>
            {selectedSkill && (
              <>
                <div className="rounded border border-[#5a3010] bg-black/25 p-3 text-sm font-bold">
                  {getSkillEffectSummary(selectedSkill) !== selectedSkill.description && (
                    <div className="mb-3 rounded border border-[#ffd166]/50 bg-[#3a2418]/70 px-3 py-2 text-base text-[#ffd166]">{getSkillEffectSummary(selectedSkill)}</div>
                  )}
                  <div className="flex items-center justify-between gap-2 text-[#fdf6e3]"><span>必要SP</span>{renderSkillBadge('SP ' + selectedSkill.costSP, 'border-[#ffd166]/85 bg-[#3a2418] text-[#ffd166]')}</div>
                  <div className="mt-2 flex justify-between gap-2 text-[#fdf6e3]"><span>必要成長度</span><span>★{selectedSkill.requiredHeroLevel}</span></div>
                  <div className="mt-2 text-xs text-[#c8a87a]">{getUnlockBlockReason(selectedSkill)}</div>
                </div>
                <button
                  type="button"
                  disabled={hasHeroSkill(selectedSkill.id)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    playFixSound();
                    requestHeroSkillUnlock(selectedSkill.id);
                  }}
                  onClick={() => { playFixSound(); requestHeroSkillUnlock(selectedSkill.id); }}
                  className="rounded border-2 border-[#a3b18a] bg-[#4a5823] px-4 py-3 font-bold text-[#fff7dc] transition hover:bg-[#60732d] disabled:cursor-not-allowed disabled:border-[#5a3010] disabled:bg-black/30 disabled:text-[#8f7b63]"
                >
                  {hasHeroSkill(selectedSkill.id) ? '✓ 取得済み' : `SP ${selectedSkill.costSP} で取得`}
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    if (id === 'farm') {
      const selectedFarmGirl = menuGirls[selectedFarmGirlIndex] ?? menuGirls[0];
      const selectedGirlData = GIRL_DATA.find(girl => girl.id === selectedFarmGirl.id);
      const getSeedDataByGirlId = (girlId: string) => GIRL_SEED_ACQUISITION_DATA.find(seed => seed.girlId === girlId);
      const isFarmGirlSeedOwned = (girlId: string) => {
        const seed = getSeedDataByGirlId(girlId);
        return Boolean(seed && ownedGirlSeeds.includes(seed.seedId));
      };
      const getFarmGirlCardDisplay = (girlId: string) => {
        const seed = getSeedDataByGirlId(girlId);
        const farmGirl = farmGirls.find(entry => entry.girlId === girlId);
        const isOwnedSeed = Boolean(seed && ownedGirlSeeds.includes(seed.seedId));
        const isRevealing = revealingFarmGirlIds.includes(girlId);
        const isGirlRevealed = Boolean(farmGirl?.cardRevealed || isRevealing);
        if (!isOwnedSeed) {
          return {
            imageSrc: FARM_GIRL_CARD_BACK_SRC,
            imageAlt: '未所持の苗娘カード',
            label: '？？？？',
            subLabel: '未所持',
            showStars: false,
            showDetail: false,
            isRevealing: false,
          };
        }
        if (!isGirlRevealed) {
          return {
            imageSrc: '/img/nae.png',
            imageAlt: seed?.seedName ?? '苗娘',
            label: seed?.seedName ?? '苗娘',
            subLabel: farmGirl ? getFarmGirlStateDisplay(girlId, farmGirl.state) : '苗所持',
            showStars: false,
            showDetail: false,
            isRevealing,
          };
        }
        return {
          imageSrc: FARM_GIRL_CARD_IMAGES[girlId] ?? FARM_GIRL_CARD_BACK_SRC,
          imageAlt: menuGirls.find(girl => girl.id === girlId)?.name ?? seed?.seedName ?? '苗娘',
          label: menuGirls.find(girl => girl.id === girlId)?.name ?? seed?.seedName ?? '苗娘',
          subLabel: '娘カード',
          showStars: true,
          showDetail: true,
          isRevealing,
        };
      };
      const selectedFarmGirlState = selectedGirlData
        ? farmGirls.find(girl => girl.girlId === selectedGirlData.id)
        : undefined;
      const selectedHarvestInfo = selectedGirlData ? getFarmGirlHarvestInfo(selectedGirlData.id) : null;
      const selectedSeedlingCrop = selectedGirlData
        ? FARM_GIRL_CROP_DATA.find(crop => crop.girlId === selectedGirlData.id)
        : undefined;
      const selectedTrustBonus = getFarmTrustBonus(selectedFarmGirlState?.trust ?? 0);
      const selectedGirlCanBecomeCompanion = Boolean(
        selectedGirlData &&
        selectedFarmGirlState?.state === 'appeared' &&
        selectedFarmGirlState.cardRevealed &&
        selectedFarmGirlState.trust >= 20 &&
        selectedFarmGirlState.condition !== 'affected'
      );
      const selectedGirlIsCompanion = Boolean(selectedGirlData && companionGirlId === selectedGirlData.id);
      const selectedCompanionHarvestModifier = getSkillAdjustedCompanionHarvestModifier(
        selectedGirlIsCompanion,
        selectedFarmGirlState?.trust ?? 0,
      );
      const selectedAffectedHarvestMultiplier = getAffectedHarvestMultiplier(
        selectedFarmGirlState?.condition ?? 'normal',
        difficulty,
      );
      const selectedFarmGirlEffectiveQuality = getSkillAdjustedFarmQuality(selectedFarmGirlState?.quality ?? 50, selectedFarmGirlState);
      const selectedFarmGirlQualityMultiplier = getFarmQualityMultiplier(selectedFarmGirlEffectiveQuality);
      const selectedFarmGirlSellMultiplier =
        getHeroSkillMultiplier('farm_sell_up', 8) * getHybridBlessingMultiplier(selectedFarmGirlState);
      const selectedFarmGirlEstimatedSellPrice = selectedSeedlingCrop
        ? getFarmHarvestSellPrice(
          selectedSeedlingCrop,
          getFarmTrustBonus(selectedFarmGirlState?.trust ?? 0).sellMultiplier,
          selectedFarmGirlQualityMultiplier,
          selectedFarmGirlSellMultiplier,
        )
        : null;
      const plantingSeedData = plantingSeedId
        ? GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === plantingSeedId)
        : undefined;
      const plantableFarmFieldSlots = getPlantableFarmFieldSlots();
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
      const ownedFarmGirlSeedCount = menuGirls.filter(girl => isFarmGirlSeedOwned(girl.id)).length;
      const selectedFarmGirlStatusText = selectedGirlData
        ? getFarmGirlStateDisplay(selectedGirlData.id, selectedFarmGirlState?.state ?? 'none')
        : farmGirlStateLabels[selectedFarmGirlState?.state ?? 'none'];
      const selectedFarmGirlConditionText = selectedFarmGirlState?.condition === 'affected'
        ? `${selectedFarmGirlStatusText} / 傷つき`
        : selectedFarmGirlStatusText;
      const selectedSeedlingCareIsToday = selectedFarmGirlState?.careDay === currentDay;
      const selectedSeedlingCareCounts = {
        caress: selectedSeedlingCareIsToday ? selectedFarmGirlState?.caressCount ?? 0 : 0,
        finger: selectedSeedlingCareIsToday ? selectedFarmGirlState?.fingerCount ?? 0 : 0,
        fertilize: selectedSeedlingCareIsToday ? selectedFarmGirlState?.fertilizeCount ?? 0 : 0,
      };
      const selectedSeedlingCareLimits = selectedSeedlingCrop
        ? {
          caress: getSkillAdjustedSeedlingCareLimit('caress', selectedSeedlingCrop),
          finger: getSkillAdjustedSeedlingCareLimit('finger', selectedSeedlingCrop),
          fertilize: getSkillAdjustedSeedlingCareLimit('fertilize', selectedSeedlingCrop),
        }
        : { caress: 1, finger: 1, fertilize: 1 };
      return (
        <div className="relative grid h-full min-h-0 grid-cols-[minmax(0,1fr)_420px] gap-4">
          <div style={{ ...menuPanelBaseStyle, ...menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'secondary') }} className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div style={menuTinyLabelStyle}>娘カード一覧</div>
                <div className="text-[#fdf6e3] text-lg font-bold leading-tight">カードで選択・「詳細」で画像表示</div>
              </div>
              <div className="text-[#d7b98a] text-sm font-bold">{ownedFarmGirlSeedCount} / {menuGirls.length}</div>
            </div>
            {hasBeastPremonition && (
              <div className="rounded-lg border border-[#ffd166]/65 bg-[#3a2508]/80 px-3 py-2 text-sm font-black text-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.18)]">
                ⚠ 警戒中
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="farm-girl-card-grid grid min-h-0 h-full grid-cols-5 gap-3 overflow-y-auto pr-2">
                {menuGirls.map((girl, index) => (
                  (() => {
                    const farmGirl = farmGirls.find(entry => entry.girlId === girl.id);
                    const cardDisplay = getFarmGirlCardDisplay(girl.id);
                    return (
                  <div
                    key={girl.id}
                    data-farm-girl-index={index}
                    onMouseEnter={() => { if (selectedFarmGirlIndex !== index) playCursorSound(); }}
                    className={`farm-girl-card-button relative overflow-hidden border rounded text-left ${selectedFarmGirlIndex === index ? 'is-selected border-white' : 'border-[#6b3b2f]'}`}
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        playFixSound();
                        setMenuFocusArea('content');
                        setMenuContentFocus('secondary');
                        setSelectedFarmGirlIndex(index);
                      }}
                      onClick={(event) => {
                        if (event.detail !== 0) return;
                        playFixSound();
                        setMenuFocusArea('content');
                        setMenuContentFocus('secondary');
                        setSelectedFarmGirlIndex(index);
                      }}
                      className="absolute inset-0 cursor-pointer text-left"
                      aria-label={`${girl.name}を選択`}
                    >
                      <img
                        src={cardDisplay.imageSrc}
                        alt={cardDisplay.imageAlt}
                        className={`absolute inset-0 h-full w-full object-contain p-1.5 ${cardDisplay.isRevealing ? 'farm-girl-card-reveal-image' : ''}`}
                      />
                      {cardDisplay.isRevealing && <div className="farm-girl-card-reveal-sparkles" aria-hidden="true" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/8 to-transparent" />
                      <div className="absolute left-2 right-2 bottom-2 rounded border border-white/10 bg-black/58 px-2 py-1 pr-14">
                        <div className="text-[#fff7dc] font-bold text-xs leading-tight">{cardDisplay.label}</div>
                        {cardDisplay.showStars ? (
                          <div className="text-[9px] text-[#ffd45a] leading-none">{renderStars(girl.affinity)}</div>
                        ) : (
                          <div className="text-[9px] font-bold leading-none text-[#c8a87a]">{cardDisplay.subLabel}</div>
                        )}
                      </div>
                    </button>
                    {cardDisplay.showDetail && (
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          playFixSound();
                          setMenuFocusArea('content');
                          setMenuContentFocus('secondary');
                          setSelectedFarmGirlIndex(index);
                          setFarmGirlDetailOpen(true);
                          setDialogMessage(`${girl.name}の詳細情報を表示しました。`);
                        }}
                        className="absolute bottom-3 right-3 z-10 rounded border border-[#ffd166]/75 bg-[#5b3518]/95 px-2 py-1 text-[10px] font-black leading-none text-[#fff4ca] hover:bg-[#7a4a24]"
                      >
                        詳細
                      </button>
                    )}
                  </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>
          <div style={{ ...menuPanelBaseStyle, ...menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'primary') }} className="farm-menu-scroll-area flex min-h-0 flex-col gap-4 overflow-y-auto pr-2 text-base">
            <div className="bg-black/30 border border-[#5a3010]/70 rounded px-4 py-4">
              <div style={menuTinyLabelStyle}>詳細</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-base">
                <div className="rounded bg-black/25 px-4 py-4">
                  <div className="text-[#c8a87a] text-sm font-bold">レベル</div>
                  <div className="mt-1 text-[#fdf6e3] text-3xl font-black leading-none">Lv {selectedFarmGirl.level}</div>
                </div>
                <div className="rounded bg-black/25 px-4 py-4">
                  <div className="text-[#c8a87a] text-sm font-bold">状態</div>
                  <div className="mt-1 text-[#fdf6e3] text-xl font-black leading-tight">{selectedFarmGirlConditionText}</div>
                </div>
                {selectedFarmGirlState?.condition === 'affected' && (
                  <div className="col-span-2 rounded bg-black/25 px-4 py-4">
                    <div className="text-sm font-bold text-[#d8c4e8]">看病すると回復できます</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playFixSound();
                          careForFarmGirl(selectedFarmGirlState.girlId);
                        }}
                        className="rounded border border-[#d8a8ff]/80 bg-[#5b276a]/80 px-4 py-2 text-sm font-black text-[#fff5fd] transition hover:bg-[#7d388f]"
                      >
                        看病する（{hasHeroSkill('special_life_understanding') ? 'AP 0' : 'AP 1'}）
                      </button>
                      {hasHeroSkill('special_hybrid_cultivation') && (
                        <button
                          type="button"
                          disabled={selectedFarmGirlState.hybridAdapted}
                          onClick={() => {
                            playFixSound();
                            tryHybridCultivation(selectedFarmGirlState.girlId);
                          }}
                          className="rounded border border-[#f0abfc]/80 bg-[#5b214f]/80 px-4 py-2 text-sm font-black text-[#fff0fb] transition hover:bg-[#7b2e6c] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {selectedFarmGirlState.hybridAdapted ? '混合適応済み' : `混合育成 ${Math.round(getHybridCultivationSuccessRate() * 100)}%`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {selectedGirlData && selectedFarmGirlState?.state === 'growing' && (
                  <div className="col-span-2 rounded bg-black/25 px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[#c8a87a] text-sm font-bold">苗のお世話</div>
                      <div className="text-base font-bold text-[#ffd166]">品質 {selectedFarmGirlState.quality} / 100（{getFarmQualityLabel(selectedFarmGirlState.quality)}）</div>
                    </div>
                    <div className="mt-1 text-sm font-bold text-[#a3b18a]">品質は擬人化後の作物売値に反映されます。</div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        disabled={selectedSeedlingCareCounts.caress >= selectedSeedlingCareLimits.caress || currentAP <= 0}
                        onClick={() => { playFixSound(); careForSeedling(selectedGirlData.id, 'caress'); }}
                        className="rounded border border-[#e5a6c8]/80 bg-[#6d3157]/80 px-3 py-3 text-sm font-black text-[#fff1f7] transition hover:bg-[#8d4170] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        愛撫<br />+3〜6 品質
                      </button>
                      <button
                        type="button"
                        disabled={selectedSeedlingCareCounts.finger >= selectedSeedlingCareLimits.finger || currentAP <= 0}
                        onClick={() => { playFixSound(); careForSeedling(selectedGirlData.id, 'finger'); }}
                        className="rounded border border-[#c7a6e5]/80 bg-[#4c356e]/80 px-3 py-3 text-sm font-black text-[#f6efff] transition hover:bg-[#62458b] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        指入れ<br />+6〜10 品質
                      </button>
                      <button
                        type="button"
                        disabled={selectedSeedlingCareCounts.fertilize >= selectedSeedlingCareLimits.fertilize || currentAP <= 0}
                        onClick={() => { playFixSound(); careForSeedling(selectedGirlData.id, 'fertilize'); }}
                        className="rounded border border-[#a3d977]/80 bg-[#3f6528]/80 px-3 py-3 text-sm font-black text-[#f1ffe4] transition hover:bg-[#517f34] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        肥料注入<br />成長 +1日
                      </button>
                    </div>
                    <div className="mt-2 text-xs font-bold text-[#c8a87a]">各お世話は苗ごとに1日1回・AP 1を消費します。</div>
                  </div>
                )}
                {selectedGirlData && selectedFarmGirlState && (
                  <div className="col-span-2 rounded bg-black/25 px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[#c8a87a] text-sm font-bold">同行</div>
                        <div className={`mt-1 text-xl font-black leading-tight ${selectedGirlIsCompanion ? 'text-[#ffd166]' : 'text-[#fdf6e3]'}`}>
                          {selectedGirlIsCompanion ? '⚔ 同行中' : '同行していません'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!selectedGirlIsCompanion && !selectedGirlCanBecomeCompanion}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!selectedGirlIsCompanion && !selectedGirlCanBecomeCompanion) return;
                          playFixSound();
                          setCompanionGirlId(selectedGirlIsCompanion ? null : selectedGirlData.id);
                          setDialogMessage(
                            selectedGirlIsCompanion
                              ? `${selectedGirlData.girlName}との同行を解除しました。`
                              : `${selectedGirlData.girlName}と同行することにしました。`,
                          );
                        }}
                        className={`rounded border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:border-[#4d4d4d] disabled:bg-[#292929] disabled:text-[#8d8d8d] ${
                          selectedGirlIsCompanion
                            ? 'border-[#a66a36] bg-[#4b2818] text-[#ffe2ad] hover:bg-[#63351d]'
                            : 'border-[#50785d] bg-[#27472d] text-[#dbffe2] hover:bg-[#345f3b]'
                        }`}
                      >
                        {selectedGirlIsCompanion ? '同行解除' : '同行する'}
                      </button>
                    </div>
                    {!selectedGirlIsCompanion && !selectedGirlCanBecomeCompanion && (
                      <div className="mt-2 text-sm text-[#c8a87a]">
                        同行には娘カード解放・信頼度20以上が必要です。
                      </div>
                    )}
                  </div>
                )}
                {selectedGirlData && selectedFarmGirlState && (
                  <div className="col-span-2 rounded bg-black/25 px-4 py-4">
                    <div className="text-[#c8a87a] text-sm font-bold">信頼度</div>
                    <div className="mt-1 text-xl font-black text-[#fdf6e3]">
                      信頼度 {selectedFarmGirlState.trust} / 100
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold">
                      <div className="rounded bg-black/25 px-3 py-2 text-[#a3b18a]">
                        収穫量補正：×{selectedTrustBonus.harvestMultiplier}
                      </div>
                      <div className="rounded bg-black/25 px-3 py-2 text-[#ffd166]">
                        売値補正：×{selectedTrustBonus.sellMultiplier}
                      </div>
                      {selectedGirlIsCompanion && (
                        <div className="col-span-2 rounded bg-black/25 px-3 py-2 text-[#f4c7ff]">
                          同行中収穫補正：{Math.round(selectedCompanionHarvestModifier.multiplier * 100)}%
                        </div>
                      )}
                    </div>
                    {selectedFarmGirlState.state === 'appeared' && (
                      <div className="mt-2 rounded bg-black/25 px-3 py-2 text-sm font-bold text-[#f0d58a]">
                        作物品質：{selectedFarmGirlEffectiveQuality} / 100（{getFarmQualityLabel(selectedFarmGirlEffectiveQuality)}・売値 ×{selectedFarmGirlQualityMultiplier}）
                      </div>
                    )}
                    {selectedFarmGirlState.hybridAdapted && (
                      <div className="mt-2 rounded border border-[#f0abfc]/45 bg-[#321433]/60 px-3 py-2 text-sm font-bold text-[#ffe4fb]">
                        <div className="text-xs font-black text-[#f5b8ff]">交雑適性</div>
                        <div className="mt-1">{hasHeroSkill('special_hybrid_blessing') ? '作物売値 +15% / 品質最低値60' : '混合育成に適応済み'}</div>
                        {!hasHeroSkill('special_hybrid_blessing') && (
                          <div className="mt-1 text-xs text-[#d8b4fe]">交雑の恵み取得後に追加効果が発動します。</div>
                        )}
                      </div>
                    )}
                    {hasHeroSkill('farm_quality_eye') && selectedFarmGirlEstimatedSellPrice !== null && (
                      <div className="mt-2 rounded border border-[#67e8f9]/45 bg-[#0f3440]/45 px-3 py-2 text-sm font-bold text-[#c9f7ff]">
                        <div className="text-xs font-black text-[#8ee9f7]">品質眼</div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded bg-black/25 px-2 py-1">
                            <div className="text-[10px] text-[#9fdbe6]">現在品質</div>
                            <div>{selectedFarmGirlState.quality} / 100</div>
                          </div>
                          <div className="rounded bg-black/25 px-2 py-1">
                            <div className="text-[10px] text-[#9fdbe6]">補正後品質</div>
                            <div>{selectedFarmGirlEffectiveQuality} / 100</div>
                          </div>
                          <div className="rounded bg-black/25 px-2 py-1">
                            <div className="text-[10px] text-[#9fdbe6]">品質倍率</div>
                            <div>×{selectedFarmGirlQualityMultiplier}</div>
                          </div>
                          <div className="rounded bg-black/25 px-2 py-1">
                            <div className="text-[10px] text-[#9fdbe6]">売値倍率</div>
                            <div>×{Number((selectedTrustBonus.sellMultiplier * selectedFarmGirlSellMultiplier).toFixed(2))}</div>
                          </div>
                        </div>
                        <div className="mt-2 rounded border border-[#67e8f9]/30 bg-black/25 px-2 py-1 text-right text-base text-[#e7fbff]">
                          予想売値 {selectedFarmGirlEstimatedSellPrice.toLocaleString()}G
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {selectedGirlData && selectedHarvestInfo?.crop && selectedFarmGirlState?.state === 'appeared' && (
                  <div className="col-span-2 rounded bg-black/25 px-4 py-4">
                    <div className="text-[#c8a87a] text-sm font-bold">収穫</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="min-w-0 text-lg font-black leading-tight text-[#fdf6e3]">
                        {selectedCompanionHarvestModifier.multiplier === 0
                          ? '同行中のため収穫できません'
                          : selectedHarvestInfo.canHarvest
                          ? `${selectedHarvestInfo.crop.harvestItemName} x${getFarmHarvestAmount(selectedHarvestInfo.crop.baseHarvestAmount, selectedFarmGirlState.trust, selectedCompanionHarvestModifier.multiplier * selectedAffectedHarvestMultiplier * getHeroSkillMultiplier('farm_harvest_up', 5))}`
                          : `次回収穫まであと${selectedHarvestInfo.daysUntilHarvest ?? 0}日`}
                      </div>
                      <button
                        type="button"
                        disabled={!selectedHarvestInfo.canHarvest || selectedCompanionHarvestModifier.multiplier === 0}
                        onClick={() => {
                          if (!selectedGirlData || !selectedHarvestInfo.canHarvest || selectedCompanionHarvestModifier.multiplier === 0) return;
                          playFixSound();
                          harvestFarmGirl(selectedGirlData.id);
                        }}
                        className={`shrink-0 rounded border px-4 py-2 text-sm font-black ${
                          selectedHarvestInfo.canHarvest && selectedCompanionHarvestModifier.multiplier > 0
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
                  ※植え付け後も苗娘は恒久アンロックとして所持したままです。APは消費しません。
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (id === 'zukan') {
      const isFishZukan = zukanFilter === '魚';
      const zukanFilters = ['苗娘', '魚'];

      return (
        <div className="flex flex-col gap-3 h-full">
          <div className="flex gap-2 rounded-lg" style={menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'primary')}>
            {zukanFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setZukanFilter(filter); setSelectedZukanIndex(0); }}
                onMouseEnter={() => { if (zukanFilter !== filter) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setZukanFilter(filter); setSelectedZukanIndex(0); }}
                className={`px-3 py-2 rounded border font-bold cursor-pointer ${zukanFilter === filter ? 'bg-[#bc6c25] border-white text-white ring-4 ring-[#ffd166]/70 shadow-[0_0_18px_rgba(255,209,102,0.42)]' : 'bg-black/35 border-[#5a3010] text-[#dda15e] hover:bg-[#3a2418]'}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div
            style={{ ...menuPanelBaseStyle, ...menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'secondary') }}
            className={isFishZukan
              ? 'grid min-h-0 flex-1 grid-cols-5 auto-rows-[190px] gap-2 overflow-y-auto pr-2'
              : 'grid min-h-0 flex-1 grid-cols-5 auto-rows-[200px] gap-3 overflow-y-auto pr-2'
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
                  data-zukan-index={index}
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  onMouseEnter={() => { if (selectedZukanIndex !== index) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  className={`relative overflow-hidden rounded-lg border p-2 text-left cursor-pointer transition-colors ${selectedZukanIndex === index ? 'bg-[#bc6c25]/45 border-white ring-4 ring-[#ffd166]/70 shadow-[0_0_18px_rgba(255,209,102,0.42)]' : 'bg-black/35 border-[#5a3010] hover:bg-[#3a2418]'}`}
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
            }) : zukanGirlCards.map(({ girl, unlocked }, index) => (
                <button
                  key={girl?.id ?? `empty-${index}`}
                  type="button"
                  data-zukan-index={index}
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  onMouseEnter={() => { if (selectedZukanIndex !== index) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedZukanIndex(index); }}
                  className={`relative overflow-hidden rounded-lg border p-2 text-left cursor-pointer ${selectedZukanIndex === index ? 'bg-[#bc6c25]/45 border-white ring-4 ring-[#ffd166]/70 shadow-[0_0_18px_rgba(255,209,102,0.42)]' : 'bg-black/35 border-[#5a3010] hover:bg-[#3a2418]'}`}
                >
                  {girl && unlocked ? (
                    <>
                      <img src={girl.cardImg} alt={girl.name} className="absolute inset-0 h-full w-full object-contain p-2" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                      <div className="absolute left-2 right-2 bottom-2 rounded bg-black/58 px-2 py-1">
                        <div className="text-[#fdf6e3] text-sm font-black leading-tight">{girl.name}</div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center rounded border border-[#5a3010]/70 bg-black/35 text-center">
                      <div className="text-[#dda15e] text-xs font-bold">No.{index + 1}</div>
                      <div className="mt-2 text-[#8f7b63] text-lg font-black">未解放</div>
                    </div>
                  )}
                </button>
              ))}
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
      <div className="grid grid-cols-3 gap-3 h-full rounded-2xl" style={menuKeyboardFocusStyle(menuFocusArea === 'content' && menuContentFocus === 'primary')}>
        {systemActions.map((action, index) => (
	          <button
	            key={action.label}
	            type="button"
	            data-system-action-index={index}
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
  useEffect(() => { selectedSkillCategoryRef.current = selectedSkillCategory; }, [selectedSkillCategory]);
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
  const [miningPromptVisible, setMiningPromptVisible] = useState(false);
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
  const [loggingResultRewards, setLoggingResultRewards] = useState<ReturnType<typeof createLumberRewards>>([]);
  const [loggingResultSawName, setLoggingResultSawName] = useState('');
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
  const [miningTutorialCompleted, setMiningTutorialCompleted] = useState(false);
  const [miningTutorialOpen, setMiningTutorialOpen] = useState(false);
  const [miningTutorialStepIndex, setMiningTutorialStepIndex] = useState(0);
  const [selectedMiningTutorialAction, setSelectedMiningTutorialAction] = useState<'later' | 'next'>('next');
  const [loggingAngleSuccess, setLoggingAngleSuccess] = useState(false);
  
  const equippedSaw = toBaseItemName(
    (equippedItems['主人公-slot2']?.includes('のこぎり') ? equippedItems['主人公-slot2'] : null) ||
    (equippedItems['主人公-slot3']?.includes('のこぎり') ? equippedItems['主人公-slot3'] : null) ||
    'のこぎり'
  );
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
  const [shopNoticeMessage, setShopNoticeMessage] = useState('');
  const [activeKurumiTradeReward, setActiveKurumiTradeReward] = useState<KurumiTradeReward | null>(null);
  const [shownKurumiTradeRewardThresholds, setShownKurumiTradeRewardThresholds] = useState<number[]>([]);
  const [kurumiIntroOpen, setKurumiIntroOpen] = useState(false);
  const [kurumiIntroMessage, setKurumiIntroMessage] = useState(KURUMI_INTRO_FIRST_MESSAGE);
  const [kurumiIntroSelectedIndex, setKurumiIntroSelectedIndex] = useState(0);
  const [kurumiIntroAskedTopics, setKurumiIntroAskedTopics] = useState<KurumiIntroTopicId[]>([]);
  const [kurumiIntroCompletedDay, setKurumiIntroCompletedDay] = useState<number | null>(null);
  const [kurumiIntroClosing, setKurumiIntroClosing] = useState(false);
  const [hasReceivedKurumiStarterSeeds, setHasReceivedKurumiStarterSeeds] = useState(false);
  const [seedPlantTutorialOpen, setSeedPlantTutorialOpen] = useState(false);
  const [seedPlantTutorialStepIndex, setSeedPlantTutorialStepIndex] = useState(0);
  const [seedAfterPlantTutorialCompleted, setSeedAfterPlantTutorialCompleted] = useState(false);
  const [seedAfterPlantTutorialOpen, setSeedAfterPlantTutorialOpen] = useState(false);
  const [seedAfterPlantTutorialStepIndex, setSeedAfterPlantTutorialStepIndex] = useState(0);
  const shopTradePoseTimerRef = useRef<number | null>(null);
  const shopNoticeTimerRef = useRef<number | null>(null);
  const kurumiTradeRewardTimerRef = useRef<number | null>(null);
  const kurumiIntroCloseTimerRef = useRef<number | null>(null);
  const seedPlantTutorialVoiceRef = useRef<HTMLAudioElement | null>(null);
  const seedAfterPlantTutorialVoiceRef = useRef<HTMLAudioElement | null>(null);
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
  const miningPromptBlockedRef = useRef(false);
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
  const miningMiniGameStartedAtRef = useRef<number | null>(null);
  const miningFinishTimerRef = useRef<number | null>(null);
  const miningCountdownTimerRef = useRef<number | null>(null);
  const miningGaugeRef = useRef(0);
  const miningHadGoodRef = useRef(false);
  const miningFullComboRef = useRef(true);
  const miningComboRef = useRef(0);
  const miningBgmRef = useRef<HTMLAudioElement | null>(null);
  const miningBgmSourceRef = useRef<string | null>(null);
  const miningPausedMainBgmRef = useRef(false);
  const miningComboEffectTimerRef = useRef<number | null>(null);
  const miningSparkleTimerRef = useRef<number | null>(null);
  const miningRhythmRecordingStartedAtRef = useRef<number | null>(null);
  const miningRhythmRecordingSourceRef = useRef<string>(MINING_BGM_SOURCES.normal);
  const miningRhythmRecordedTimingsRef = useRef<number[]>([]);
  const miningRhythmAudioRef = useRef<HTMLAudioElement | null>(null);
  const miningRhythmRecordingTimerRef = useRef<number | null>(null);
  const miningSeAudioRefs = useRef<Partial<Record<keyof typeof MINING_SE_SOURCES, HTMLAudioElement>>>({});
  const movementLockedRef = useRef(false);
  const lastWarpedAtRef = useRef(0);
  const warpReentryLockedRef = useRef(false);
  const mapTransitioningRef = useRef(false);
  const mapTransitionTimerRef = useRef<number | null>(null);
  const mapTransitionUnlockTimerRef = useRef<number | null>(null);
  
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
  const [mapTransitionPhase, setMapTransitionPhase] = useState<'idle' | 'fadeOut' | 'fadeIn'>('idle');
  useEffect(() => () => {
    if (mapTransitionTimerRef.current !== null) {
      window.clearTimeout(mapTransitionTimerRef.current);
    }
    if (mapTransitionUnlockTimerRef.current !== null) {
      window.clearTimeout(mapTransitionUnlockTimerRef.current);
    }
  }, []);
  useEffect(() => {
    const initialFollow = getCompanionRestPosition(posRef.current, dir);
    companionTrailRef.current = Array.from({ length: COMPANION_TRAIL_DELAY_FRAMES }, () => initialFollow);
    setCompanionFollow(initialFollow);
  }, [companionGirlId, currentMap]);
  const [doors, setDoors] = useState<WarpDoor[]>(() => ensureRequiredRouteDoors(defaultDoors));
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [inspectSpots, setInspectSpots] = useState<InspectSpot[]>([]);
  const [selectedInspectSpotId, setSelectedInspectSpotId] = useState<string | null>(null);

  // Debug Panel Draggable Position State
  const [debugPanelPos, setDebugPanelPos] = useState({ x: 1920 - DEBUG_PANEL_WIDTH - 16, y: 108 });
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
  const [bgmVolume, setBgmVolume] = useState<number>(DEFAULT_MASTER_VOLUME);
  const [seVolume, setSeVolume] = useState<number>(DEFAULT_MASTER_VOLUME);
  const [voiceVolume, setVoiceVolume] = useState<number>(DEFAULT_MASTER_VOLUME);
  const [textDisplaySpeedLevel, setTextDisplaySpeedLevel] = useState<number>(3);
  const [audioGains, setAudioGains] = useState<Record<string, number>>(DEFAULT_AUDIO_GAINS);
  const [mapBgmSources, setMapBgmSources] = useState<Record<GameMap, string>>(DEFAULT_MAP_BGM_SOURCES);
  const [activeAutoEventSpot, setActiveAutoEventSpot] = useState<InspectSpot | null>(null);
  const [activePostDebtNoticeFirstView, setActivePostDebtNoticeFirstView] = useState(false);
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
  const prologueBgmRef = useRef<HTMLAudioElement | null>(null);
  const prologueVoiceRef = useRef<HTMLAudioElement | null>(null);
  const topSplashAudioRef = useRef<HTMLAudioElement | null>(null);
  const titleRandomVoiceRef = useRef<HTMLAudioElement | null>(null);
  const titleRandomVoicePlayedRef = useRef(false);
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
     movementLockedRef.current = sleepPromptVisible || craftPromptVisible || fishingPromptVisible || miningPromptVisible || loggingPromptVisible || fishingMiniGameOpen || miningMiniGameOpen || miningRhythmRecording || craftMiniGameOpen || fishingTutorialOpen || fishingTutorialEndingOpen || sawCraftTutorialIntroOpen || sawCraftTutorialShedDialogueOpen || gatheringTutorialOpen || miningTutorialOpen || kurumiShopOpen || kurumiIntroOpen || seedPlantTutorialOpen || seedAfterPlantTutorialOpen || isSleepSequenceActive || beastAttackPending || repaymentEventPending || battlePreviewOpen || farmSlotInteractionStage !== null;
  }, [sleepPromptVisible, craftPromptVisible, fishingPromptVisible, miningPromptVisible, loggingPromptVisible, fishingMiniGameOpen, miningMiniGameOpen, miningRhythmRecording, craftMiniGameOpen, fishingTutorialOpen, fishingTutorialEndingOpen, sawCraftTutorialIntroOpen, sawCraftTutorialShedDialogueOpen, gatheringTutorialOpen, miningTutorialOpen, kurumiShopOpen, kurumiIntroOpen, seedPlantTutorialOpen, seedAfterPlantTutorialOpen, isSleepSequenceActive, beastAttackPending, repaymentEventPending, battlePreviewOpen, farmSlotInteractionStage]);

  useEffect(() => {
     if (sleepPromptVisible || craftPromptVisible || fishingPromptVisible || miningPromptVisible || loggingPromptVisible) {
        setConfirmPromptChoice('yes');
     }
  }, [sleepPromptVisible, craftPromptVisible, fishingPromptVisible, miningPromptVisible, loggingPromptVisible]);

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
        const sizeValue = getSkillAdjustedFishSize(
          caughtFish,
          fishingTargetSizeValue ?? createFishingTargetSize(caughtFish, fishingBiteScore, fishingBiteCombo),
        );
        const sizeCm = sizeValue.toFixed(1);
        const isNewRecord = !!caughtFish && sizeValue > (fishBestSizes[caughtFish.id] ?? 0);
        if (isNewRecord && caughtFish) {
          setFishBestSizes(prev => ({ ...prev, [caughtFish.id]: sizeValue }));
          setFishSizeUpdatedIds(prev => prev.includes(caughtFish.id) ? prev : [...prev, caughtFish.id]);
        }
        setInventoryCounts(prev => ({ ...prev, [caughtFish.name]: (prev[caughtFish.name] ?? 0) + 1 }));
        incrementEndlessStat('totalFishCaught');
        if (isEndlessNurseryMode()) {
          setCollectionProgress(previous => ({
            ...previous,
            caughtFishIds: previous.caughtFishIds.includes(caughtFish.id)
              ? previous.caughtFishIds
              : [...previous.caughtFishIds, caughtFish.id],
          }));
        }
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
  const POST_MINING_TUTORIAL_POINT = {
    id: 'farm_post_mining_tutorial_rock',
    map: 'farm' as GameMap,
    x: 175,
    y: 705,
    w: 115,
    h: 110,
  };
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

  const countSaveRecordEntries = (value: unknown) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value as Record<string, unknown>).length
      : 0
  );
  const countSaveArrayEntries = (value: unknown) => Array.isArray(value) ? value.length : 0;
  const getSaveMapSettingsFootprint = (data: Record<string, unknown>) => ({
    zones: countSaveArrayEntries(data.zones),
    doors: countSaveArrayEntries(data.doors),
    obstacles: countSaveRecordEntries(data.obstacles),
    hideAreaTiles: countSaveRecordEntries(data.hideAreaTiles),
    bedTiles: countSaveRecordEntries(data.bedTiles),
    workbenchTiles: countSaveRecordEntries(data.workbenchTiles),
    fishingTiles: countSaveRecordEntries(data.fishingTiles),
    miningTiles: countSaveRecordEntries(data.miningTiles),
    loggingTiles: countSaveRecordEntries(data.loggingTiles),
    inspectSpots: countSaveArrayEntries(data.inspectSpots),
  });
  const hasLoadableLegacyMapSettings = (data: Record<string, unknown>) => {
    const footprint = getSaveMapSettingsFootprint(data);
    return (
      footprint.zones >= 8 ||
      footprint.doors >= 8 ||
      footprint.obstacles >= 100 ||
      footprint.hideAreaTiles >= 100 ||
      footprint.bedTiles >= 10 ||
      footprint.workbenchTiles >= 5 ||
      footprint.fishingTiles >= 3 ||
      footprint.miningTiles >= 3 ||
      footprint.loggingTiles >= 3 ||
      footprint.inspectSpots >= 3
    );
  };
  const hasDefaultLargeFieldGrid = (data: Record<string, unknown>) => {
    const rawGridSizes = data.fieldGridSizes;
    if (!rawGridSizes || typeof rawGridSizes !== 'object' || Array.isArray(rawGridSizes)) return false;
    const gridSizes = rawGridSizes as Partial<FieldGridSizeMap>;
    return (
      gridSizes.left?.cols === DEFAULT_FIELD_GRID_SIZES.left.cols &&
      gridSizes.left?.rows === DEFAULT_FIELD_GRID_SIZES.left.rows &&
      gridSizes.right?.cols === DEFAULT_FIELD_GRID_SIZES.right.cols &&
      gridSizes.right?.rows === DEFAULT_FIELD_GRID_SIZES.right.rows
    );
  };
  const shouldBlockUnsafeLegacySaveLoad = (data: Record<string, unknown>) => {
    const schemaVersion = data.saveSchemaVersion;
    if (typeof schemaVersion === 'number' && schemaVersion >= MIN_DIRECT_LOAD_SAVE_SCHEMA_VERSION) return false;
    if (hasLoadableLegacyMapSettings(data)) return false;

    const footprint = getSaveMapSettingsFootprint(data);
    const looksLikeUnconfiguredMap = (
      footprint.zones <= defaultZones.length &&
      footprint.doors <= defaultDoors.length &&
      footprint.obstacles === 0 &&
      footprint.hideAreaTiles === 0 &&
      footprint.workbenchTiles === 0 &&
      footprint.fishingTiles === 0 &&
      footprint.miningTiles === 0 &&
      footprint.loggingTiles === 0 &&
      footprint.inspectSpots === 0
    );

    return looksLikeUnconfiguredMap || hasDefaultLargeFieldGrid(data);
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
        if (
          !startingNewGame &&
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          Object.keys(data).length > 0 &&
          shouldBlockUnsafeLegacySaveLoad(data as Record<string, unknown>)
        ) {
          console.warn('未設定の古いセーブデータの読み込みを中止しました。');
          setSystemNotice('古い未設定セーブを検出したため、読み込みを中止しました。データは削除していません。');
          setStartingNewGame(false);
          setBootMode('title');
          setMenuOpen(false);
          setIsLoading(false);
          return;
        }
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
	          setBgmVolume(DEFAULT_MASTER_VOLUME);
	          setSeVolume(DEFAULT_MASTER_VOLUME);
	          setVoiceVolume(DEFAULT_MASTER_VOLUME);
	          const loadedDifficulty = typeof data.difficulty === 'string' && DIFFICULTY_OPTIONS.some(option => option.id === data.difficulty)
	            ? data.difficulty as GameDifficulty
	            : 'hard';
	          setDifficulty(loadedDifficulty);
	          setGameMode(data.gameMode === 'endlessNursery' ? 'endlessNursery' : 'story');
	          setHasUnlockedEndlessNurseryMode(
	            data.hasUnlockedEndlessNurseryMode === true ||
	            localStorage.getItem(ENDLESS_NURSERY_UNLOCK_STORAGE_KEY) === 'true'
	          );
	          const loadedCollectionProgress = data.collectionProgress as Partial<CollectionProgress> | undefined;
	          setCollectionProgress({
	            collectedGirlIds: Array.isArray(loadedCollectionProgress?.collectedGirlIds) ? loadedCollectionProgress.collectedGirlIds.filter((id): id is string => typeof id === 'string') : [],
	            caughtFishIds: Array.isArray(loadedCollectionProgress?.caughtFishIds) ? loadedCollectionProgress.caughtFishIds.filter((id): id is string => typeof id === 'string') : [],
	            craftedItemIds: Array.isArray(loadedCollectionProgress?.craftedItemIds) ? loadedCollectionProgress.craftedItemIds.filter((id): id is string => typeof id === 'string') : [],
	            unlockedEventIds: Array.isArray(loadedCollectionProgress?.unlockedEventIds) ? loadedCollectionProgress.unlockedEventIds.filter((id): id is string => typeof id === 'string') : [],
	            defeatedBeastIds: Array.isArray(loadedCollectionProgress?.defeatedBeastIds) ? loadedCollectionProgress.defeatedBeastIds.filter((id): id is string => typeof id === 'string') : [],
	          });
	          const loadedEndlessStats = data.endlessStats as Partial<EndlessStats> | undefined;
	          setEndlessStats({
	            daysPlayed: typeof loadedEndlessStats?.daysPlayed === 'number' && loadedEndlessStats.daysPlayed >= 0 ? Math.floor(loadedEndlessStats.daysPlayed) : 0,
	            totalHarvestCount: typeof loadedEndlessStats?.totalHarvestCount === 'number' && loadedEndlessStats.totalHarvestCount >= 0 ? Math.floor(loadedEndlessStats.totalHarvestCount) : 0,
	            totalFishCaught: typeof loadedEndlessStats?.totalFishCaught === 'number' && loadedEndlessStats.totalFishCaught >= 0 ? Math.floor(loadedEndlessStats.totalFishCaught) : 0,
	            totalTreesCut: typeof loadedEndlessStats?.totalTreesCut === 'number' && loadedEndlessStats.totalTreesCut >= 0 ? Math.floor(loadedEndlessStats.totalTreesCut) : 0,
	            totalOresMined: typeof loadedEndlessStats?.totalOresMined === 'number' && loadedEndlessStats.totalOresMined >= 0 ? Math.floor(loadedEndlessStats.totalOresMined) : 0,
	            totalBeastsDefeated: typeof loadedEndlessStats?.totalBeastsDefeated === 'number' && loadedEndlessStats.totalBeastsDefeated >= 0 ? Math.floor(loadedEndlessStats.totalBeastsDefeated) : 0,
	            totalGirlsCollected: typeof loadedEndlessStats?.totalGirlsCollected === 'number' && loadedEndlessStats.totalGirlsCollected >= 0 ? Math.floor(loadedEndlessStats.totalGirlsCollected) : 0,
	            totalTrustEventsUnlocked: typeof loadedEndlessStats?.totalTrustEventsUnlocked === 'number' && loadedEndlessStats.totalTrustEventsUnlocked >= 0 ? Math.floor(loadedEndlessStats.totalTrustEventsUnlocked) : 0,
	            totalMoneyEarned: typeof loadedEndlessStats?.totalMoneyEarned === 'number' && loadedEndlessStats.totalMoneyEarned >= 0 ? Math.floor(loadedEndlessStats.totalMoneyEarned) : 0,
	          });
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
	          setRepaymentEventPending(false);
	          setStoryCleared(data.storyCleared === true);
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
	          setSuccessfulRepaymentCount(
	            typeof data.successfulRepaymentCount === 'number' && Number.isInteger(data.successfulRepaymentCount) && data.successfulRepaymentCount >= 0
	              ? data.successfulRepaymentCount
	              : 0
	          );
	          setMissedRepaymentCount(loadedMissedRepaymentCount);
	          setHeroLevel(
	            typeof data.heroLevel === 'number' && Number.isInteger(data.heroLevel) && data.heroLevel >= 1 && data.heroLevel <= MAX_HERO_LEVEL
	              ? data.heroLevel as HeroLevel
	              : 1
	          );
	          setHeroSP(
	            typeof data.heroSP === 'number' && Number.isInteger(data.heroSP) && data.heroSP >= 0
	              ? data.heroSP
	              : 0
	          );
	          setDebugGirlAffinities(
	            data.debugGirlAffinities && typeof data.debugGirlAffinities === 'object' && !Array.isArray(data.debugGirlAffinities)
	              ? Object.fromEntries(
	                Object.entries(data.debugGirlAffinities as Record<string, unknown>)
	                  .filter(([girlId, value]) => GIRL_DATA.some(girl => girl.id === girlId) && typeof value === 'number' && Number.isInteger(value))
	                  .map(([girlId, value]) => [girlId, clampNumber(value as number, 1, 5)])
	              )
	              : {}
	          );
	          setUnlockedHeroSkills(
	            Array.isArray(data.unlockedHeroSkills)
	              ? Array.from(new Set(data.unlockedHeroSkills.filter((skillId): skillId is string => (
	                typeof skillId === 'string' && Boolean(getHeroSkillById(skillId))
	              ))))
	              : []
	          );
	          setHasBeastPremonition(typeof data.hasBeastPremonition === 'boolean' ? data.hasBeastPremonition : false);
	          setPremonitionDay(typeof data.premonitionDay === 'number' && Number.isInteger(data.premonitionDay) && data.premonitionDay > 0 ? data.premonitionDay : null);
	          setScheduledBeastAttackDay(typeof data.scheduledBeastAttackDay === 'number' && Number.isInteger(data.scheduledBeastAttackDay) && data.scheduledBeastAttackDay > 0 ? data.scheduledBeastAttackDay : null);
	          setMountainLordAttackPending(typeof data.mountainLordAttackPending === 'boolean' ? data.mountainLordAttackPending : false);
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
	          const loadedOwnedGirlSeeds = normalizeOwnedGirlSeeds(data.ownedGirlSeeds);
	          setOwnedGirlSeeds(loadedOwnedGirlSeeds);
	          setHasReceivedKurumiStarterSeeds(
	            typeof data.hasReceivedKurumiStarterSeeds === 'boolean'
	              ? data.hasReceivedKurumiStarterSeeds
	              : INITIAL_OWNED_GIRL_SEEDS.some(seedId => loadedOwnedGirlSeeds.includes(seedId))
	          );
	          setSeedAfterPlantTutorialCompleted(typeof data.seedAfterPlantTutorialCompleted === 'boolean' ? data.seedAfterPlantTutorialCompleted : false);
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
            setInventoryCounts(prev => migrateInventoryItemNames({
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
          if (typeof data.loggingTutorialCompleted === 'boolean') {
            setLoggingTutorialCompleted(data.loggingTutorialCompleted);
          }
          if (typeof data.miningTutorialCompleted === 'boolean') {
            setMiningTutorialCompleted(data.miningTutorialCompleted);
          }
          if (Array.isArray(data.craftedRecipeIds)) {
            setCraftedRecipeIds(data.craftedRecipeIds.filter((name: unknown): name is CraftRecipeId => (
              typeof name === 'string' && isCraftRecipeId(name)
            )));
          }
          if (typeof data.gatheringTutorialCompleted === 'boolean') {
            setGatheringTutorialCompleted(data.gatheringTutorialCompleted);
          }
          if (data.gatheringTutorialChoice === 'logging' || data.gatheringTutorialChoice === 'mining') {
            setGatheringTutorialChoice(data.gatheringTutorialChoice);
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
          setOpeningMapTransitionCount(
            typeof data.openingMapTransitionCount === 'number' &&
            Number.isInteger(data.openingMapTransitionCount) &&
            data.openingMapTransitionCount >= 0
              ? data.openingMapTransitionCount
              : 0
          );
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
          const requestedNewGameMode = pendingNewGameModeRef.current;
          const requestedNewGameDifficulty = pendingNewGameDifficultyRef.current;
          window.localStorage.removeItem(POST_DEBT_NOTICE_SEEN_STORAGE_KEY);
          if (mapSettingsForNewGame) {
            applyMapSettingsSnapshot(mapSettingsForNewGame);
          }
          setTurn(0);
          setGold(5000);
          setBgmVolume(DEFAULT_MASTER_VOLUME);
          setSeVolume(DEFAULT_MASTER_VOLUME);
          setVoiceVolume(DEFAULT_MASTER_VOLUME);
          const difficultyOption = DIFFICULTY_OPTIONS.find(option => option.id === requestedNewGameDifficulty) ?? DIFFICULTY_OPTIONS[2];
          setDifficulty(difficultyOption.id);
          setGameMode(requestedNewGameMode);
          setDebtAmount(requestedNewGameMode === 'endlessNursery' ? 0 : getInitialDebtAmount(difficultyOption.id));
          setRepaymentCycleDays(DEFAULT_REPAYMENT_CYCLE_DAYS);
          setRepaymentEventPending(false);
          setStoryCleared(false);
          setFarmCredit(0);
          setCollectionProgress(createInitialCollectionProgress());
          setEndlessStats(createInitialEndlessStats());
          setSuccessfulRepaymentCount(0);
          setMissedRepaymentCount(0);
          setHeroLevel(1);
          setHeroSP(0);
          setDebugGirlAffinities({});
          setUnlockedHeroSkills([]);
          setHasBeastPremonition(false);
          setPremonitionDay(null);
          setScheduledBeastAttackDay(null);
          setMountainLordAttackPending(false);
          setBeastAttackPending(false);
          setCompanionGirlId(null);
          setCurrentWeeklyInterestRate(createWeeklyInterestRate(difficultyOption.id, 0, 0));
          setInterestRateCycleIndex(0);
          setCurrentAP(maxAPPerTimeSlot);
          setKurumiTradeTotal(0);
          setShownKurumiTradeRewardThresholds([]);
          setFarmGirls(createInitialFarmGirls());
          setOwnedGirlSeeds([]);
          setHasReceivedKurumiStarterSeeds(false);
          setSeedPlantTutorialOpen(false);
          setSeedPlantTutorialStepIndex(0);
          setSeedAfterPlantTutorialCompleted(false);
          setSeedAfterPlantTutorialOpen(false);
          setSeedAfterPlantTutorialStepIndex(0);
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
          setLoggingTutorialCompleted(false);
          setMiningTutorialCompleted(false);
          setGatheringTutorialCompleted(false);
          setGatheringTutorialChoice(null);
          setIsFishingTutorialRun(false);
          setFishingTutorialResult(null);
          setNextObjective(null);
          setOpeningMapTransitionCount(0);
          setProloguePage(0);
          setPrologueRingReveal(false);
          setPrologueRingRevealReady(false);
          setPrologueOpen(requestedNewGameMode === 'story');
          setInventoryCounts({ ...INITIAL_INVENTORY_COUNTS });
          setEquippedItems({ ...INITIAL_EQUIPPED_ITEMS });
          equippedItemsRef.current = { ...INITIAL_EQUIPPED_ITEMS };
          setCurrentMap('farm');
          currentMapRef.current = 'farm';
          setPos({ ...NEW_GAME_START_POSITION });
          posRef.current = { ...NEW_GAME_START_POSITION };
          setDir('down');
          setDialogMessage(DEFAULT_SYSTEM_MESSAGE);
          setShowDialog(false);
        }
        setStartingNewGame(false);
        setBootMode('playing');
        setMenuOpen(false);
        setIsLoading(false);
        if (startingNewGame && pendingNewGameModeRef.current === 'story' && titleStartTransitionPhaseRef.current === 'fadeOut') {
          titleStartTransitionPhaseRef.current = 'fadeIn';
          setTitleStartTransitionPhase('fadeIn');
          if (titleStartTransitionTimerRef.current !== null) {
            window.clearTimeout(titleStartTransitionTimerRef.current);
          }
          titleStartTransitionTimerRef.current = window.setTimeout(() => {
            titleStartTransitionPhaseRef.current = 'idle';
            setTitleStartTransitionPhase('idle');
          }, TITLE_START_TRANSITION_MS);
        }
      })
      .catch(err => {
        console.error('セーブデータの読み込みに失敗しました:', err);
        setStartingNewGame(false);
        setBootMode('playing');
        setMenuOpen(false);
        setIsLoading(false);
        if (titleStartTransitionPhaseRef.current === 'fadeOut') {
          titleStartTransitionPhaseRef.current = 'fadeIn';
          setTitleStartTransitionPhase('fadeIn');
          if (titleStartTransitionTimerRef.current !== null) {
            window.clearTimeout(titleStartTransitionTimerRef.current);
          }
          titleStartTransitionTimerRef.current = window.setTimeout(() => {
            titleStartTransitionPhaseRef.current = 'idle';
            setTitleStartTransitionPhase('idle');
          }, TITLE_START_TRANSITION_MS);
        }
      });

    return () => {
      active = false;
    };
  }, [bootMode, currentSaveSlot, startingNewGame, pendingNewGameDifficulty, pendingNewGameMode]);

  const createSaveData = () => ({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    turn,
    gold,
    gameMode,
    hasUnlockedEndlessNurseryMode,
    collectionProgress,
    endlessStats,
    debt: debtAmount,
    debtAmount,
    repaymentCycleDays,
    storyCleared,
    farmCredit,
    successfulRepaymentCount,
    missedRepaymentCount,
    heroLevel,
    heroSP,
    debugGirlAffinities,
    unlockedHeroSkills,
    hasBeastPremonition,
    premonitionDay,
    scheduledBeastAttackDay,
    mountainLordAttackPending,
    beastAttackPending,
    companionGirlId,
    currentWeeklyInterestRate,
    interestRateCycleIndex,
    farmGirls,
    ownedGirlSeeds,
    hasReceivedKurumiStarterSeeds,
    seedAfterPlantTutorialCompleted,
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
    loggingTutorialCompleted,
    miningTutorialCompleted,
    craftedRecipeIds,
    gatheringTutorialCompleted,
    gatheringTutorialChoice,
    kurumiIntroAskedTopics,
    kurumiIntroCompletedDay,
    openingMapTransitionCount,
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
    titleRandomVoicePlayedRef.current = false;
    setBootMode('title');
  };

  useEffect(() => {
    if (titlePanelMode === 'new' || titlePanelMode === 'load' || titlePanelMode === 'endless' || systemSlotMode !== 'none') {
      refreshSaveSlotSummaries();
    }
  }, [titlePanelMode, systemSlotMode]);

  useEffect(() => {
    if (hasUnlockedEndlessNurseryMode) {
      localStorage.setItem(ENDLESS_NURSERY_UNLOCK_STORAGE_KEY, 'true');
    }
  }, [hasUnlockedEndlessNurseryMode]);

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
    gameMode,
    hasUnlockedEndlessNurseryMode,
    collectionProgress,
    endlessStats,
    debtAmount,
    repaymentCycleDays,
    storyCleared,
    farmCredit,
    successfulRepaymentCount,
    missedRepaymentCount,
    heroLevel,
    heroSP,
    unlockedHeroSkills,
    hasBeastPremonition,
    premonitionDay,
    scheduledBeastAttackDay,
    mountainLordAttackPending,
    beastAttackPending,
    companionGirlId,
    currentWeeklyInterestRate,
    interestRateCycleIndex,
    farmGirls,
    ownedGirlSeeds,
    hasReceivedKurumiStarterSeeds,
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
    loggingTutorialCompleted,
    miningTutorialCompleted,
    craftedRecipeIds,
    gatheringTutorialCompleted,
    gatheringTutorialChoice,
    kurumiIntroAskedTopics,
    kurumiIntroCompletedDay,
    openingMapTransitionCount,
    bathTubMaskZone
  ]);

  const beginNewGameInSlot = (slot: number, mode: GameMode) => {
    playFixSound();
    pendingNewGameModeRef.current = mode;
    setPendingNewGameMode(mode);
    const summary = getSlotSummary(slot);
    if (summary?.exists) {
      setPendingOverwriteSaveSlot(slot);
      setConfirmPromptChoice('no');
      return;
    }
    setPendingNewGameSlot(slot);
    setTitlePanelMode(mode === 'endlessNursery' ? 'endless' : 'difficulty');
  };

  const startNewGameInSlot = (slot: number) => beginNewGameInSlot(slot, 'story');
  const startEndlessNurseryInSlot = (slot: number) => beginNewGameInSlot(slot, 'endlessNursery');

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
    setTitlePanelMode(pendingNewGameMode === 'endlessNursery' ? 'endless' : 'difficulty');
  };

  const startNewGameWithDifficulty = (difficultyId: GameDifficulty) => {
    if (titleStartTransitionPhaseRef.current !== 'idle') return;
    const slot = pendingNewGameSlot ?? 1;
    const difficultyOption = DIFFICULTY_OPTIONS.find(option => option.id === difficultyId) ?? DIFFICULTY_OPTIONS[2];
    pendingNewGameDifficultyRef.current = difficultyOption.id;
    pendingNewGameModeRef.current = 'story';
    setPendingNewGameDifficulty(difficultyOption.id);
    setPendingNewGameMode('story');
    playUiSound(TITLE_START_SOUND_SRC);
    setTitlePanelMode('none');
    titleStartTransitionPhaseRef.current = 'fadeOut';
    setTitleStartTransitionPhase('fadeOut');
    if (titleStartTransitionTimerRef.current !== null) {
      window.clearTimeout(titleStartTransitionTimerRef.current);
    }
    titleStartTransitionTimerRef.current = window.setTimeout(() => {
      autoSaveBlockedSlotsRef.current.delete(slot);
      setCurrentSaveSlot(slot);
      setStartingNewGame(true);
      setBootMode('loadingSave');
    }, TITLE_START_TRANSITION_MS);
  };

  const startEndlessNurseryMode = () => {
    if (!canStartEndlessNurseryMode()) return;
    const slot = pendingNewGameSlot ?? 1;
    playFixSound();
    pendingNewGameDifficultyRef.current = 'hard';
    pendingNewGameModeRef.current = 'endlessNursery';
    autoSaveBlockedSlotsRef.current.delete(slot);
    setCurrentSaveSlot(slot);
    setPendingNewGameDifficulty('hard');
    setPendingNewGameMode('endlessNursery');
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
    const columns = slot.fieldId === 'left' ? 3 : 2;
    const rows = 2;
    const zeroBasedIndex = slot.slotIndex - 1;
    const column = zeroBasedIndex % columns;
    const row = Math.floor(zeroBasedIndex / columns);
    const u = (column + 0.5) / columns;
    const v = (Math.min(row, rows - 1) + 0.5) / rows;
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
    setBattleMotion(null);
    setBattleHitEffect(null);
    setBattleSupportEffect(null);
    setBattleDamagePopups([]);
    previousBattleVitalsRef.current = null;
    resolvedPartnerTurnRef.current = null;
    setBattlePartnerSkillDisplay(null);
    setBattleItemPanelOpen(false);
    setBattleItemSelectionStep('item');
    setSelectedBattleCommandIndex(0);
    setSelectedBattleItemIndex(0);
    setSelectedBattleItemTargetIndex(0);
    const selectedBeast = BEAST_BATTLE_DATA.find(beast => beast.id === battleTestBeastId) ?? BEAST_BATTLE_DATA[0];
    const testBeasts = [createBattleUnitFromBeast(selectedBeast), null, null];
    setBattlePreviewState(createInitialBattlePreviewState(equippedItems, testBeasts, battleTestPartnerId || null, 'test', heroLevel, unlockedHeroSkills));
    setBattleIntroPhase(3);
    setBattlePreviewOpen(true);
  };

  const getBattleResult = (hero: BattlePreviewState['hero'], allies: BattlePreviewState['allies'], beasts: BattlePreviewState['beasts']): BattlePreviewResult => {
    const partyAlive = hero.hp > 0 || allies.some(ally => (ally?.hp ?? 0) > 0);
    const beastsAlive = beasts.some(beast => (beast?.hp ?? 0) > 0);
    if (!partyAlive) return 'defeat';
    if (!beastsAlive) return 'victory';
    return 'ongoing';
  };

  const openBattlePreviewWithBeasts = (beasts: (BattleUnitState | null)[], encounterType: BattleEncounterType = 'test') => {
    playFixSound();
    setBattleMotion(null);
    setBattleHitEffect(null);
    setBattleSupportEffect(null);
    setBattleDamagePopups([]);
    previousBattleVitalsRef.current = null;
    resolvedPartnerTurnRef.current = null;
    setBattlePartnerSkillDisplay(null);
    setBattleItemPanelOpen(false);
    setBattleItemSelectionStep('item');
    setSelectedBattleCommandIndex(0);
    setSelectedBattleItemIndex(0);
    setSelectedBattleItemTargetIndex(0);
    setBattlePreviewState(createInitialBattlePreviewState(equippedItems, beasts, companionGirlId, encounterType, heroLevel, unlockedHeroSkills));
    setBattleIntroPhase(3);
    setBattlePreviewOpen(true);
  };

  const handleBeastAttackFight = () => {
    const beasts = mountainLordAttackPending ? createMountainLordUnit() : createRandomBeastUnits(difficulty, false);
    setBeastAttackPending(false);
    setHasBeastPremonition(false);
    setScheduledBeastAttackDay(null);
    setPremonitionDay(null);
    setMountainLordAttackPending(false);
    openBattlePreviewWithBeasts(beasts, 'beastAttack');
  };

  const proceedToNextDay = () => {
    const nextDay = currentDay + 1;
    const completedGirlIds = farmGirls.flatMap(girl => {
      if (girl.state !== 'growing') return [];
      const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girl.girlId);
      if (!crop) return [];
      return girl.growthProgress + 1 >= crop.growthDays ? [girl.girlId] : [];
    });
    const completedGirlNames = completedGirlIds.map(girlId => (
      GIRL_DATA.find(girl => girl.id === girlId)?.girlName ?? girlId
    ));
    const affectedRecoveryDays = hasHeroSkill('special_life_understanding') ? 2 : 3;
    const recoveredGirlIds = farmGirls
      .filter(girl => (
        girl.condition === 'affected' &&
        girl.conditionDay !== null &&
        nextDay - girl.conditionDay >= affectedRecoveryDays
      ))
      .map(girl => girl.girlId);
    const recoveredGirlNames = recoveredGirlIds.map(girlId => (
      GIRL_DATA.find(girl => girl.id === girlId)?.girlName ?? girlId
    ));

    setTurn(t => (Math.floor(t / 4) + 1) * 4);
    setCurrentAP(maxAPPerTimeSlot);
    setDepletedMiningPointIds({});
    setDepletedLoggingPointIds({});
    incrementEndlessStat('daysPlayed');
    setFarmGirls(prev => prev.map(girl => {
      const recoveredGirl = recoveredGirlIds.includes(girl.girlId)
        ? { ...girl, condition: 'normal' as const, conditionDay: null, conditionSource: null }
        : girl;
      if (recoveredGirl.state !== 'growing') return recoveredGirl;
      const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === recoveredGirl.girlId);
      if (!crop) return recoveredGirl;
      const nextGrowthProgress = recoveredGirl.growthProgress + 1;
      return {
        ...recoveredGirl,
        growthProgress: nextGrowthProgress,
        state: nextGrowthProgress >= crop.growthDays ? 'appeared' : 'growing',
      };
    }));
    setFarmFieldSlots(prev => prev.map(slot => (
      slot.girlId && completedGirlIds.includes(slot.girlId)
        ? { ...slot, state: 'appeared' }
        : slot
    )));
    if (completedGirlIds.length > 0 && isEndlessNurseryMode()) {
      setEndlessStats(previous => ({
        ...previous,
        totalGirlsCollected: previous.totalGirlsCollected + completedGirlIds.length,
      }));
      setCollectionProgress(previous => ({
        ...previous,
        collectedGirlIds: Array.from(new Set([...previous.collectedGirlIds, ...completedGirlIds])),
      }));
    }
    const dayAdvanceMessages = [
      ...(completedGirlNames.length > 0 ? [`${completedGirlNames.join('、')}が畑に現れた！`] : []),
      ...recoveredGirlNames.map(name => `${name}は少し落ち着いたようだ。`),
    ];
    if (dayAdvanceMessages.length > 0) {
      setDialogMessage(dayAdvanceMessages.join('\n'));
    }
  };

  const handleBeastAttackWatch = () => {
    setDialogMessage('畑の様子を見守ることにした……');
    setBeastAttackPending(false);
    setHasBeastPremonition(false);
    setPremonitionDay(null);
    setScheduledBeastAttackDay(null);
    setMountainLordAttackPending(false);
    proceedToNextDay();
  };

  const getBattleSpritePose = (unitId: string): BattlePose => (
    battleMotion?.actorId === unitId ? battleMotion.pose : battleIntroPhase !== null ? 'idle' : 'defend'
  );

  const triggerBattleMotion = (actorId: string, pose: BattlePose, durationMs = 420) => {
    const key = Date.now();
    setBattleMotion({ actorId, pose, key });
    window.setTimeout(() => {
      setBattleMotion(current => (
        current?.actorId === actorId && current.key === key ? null : current
      ));
    }, durationMs);
  };

  const triggerBattleHitEffect = (targetId: string, durationMs = 360) => {
    const key = Date.now();
    setBattleHitEffect({ targetId, key });
    window.setTimeout(() => {
      setBattleHitEffect(current => (
        current?.targetId === targetId && current.key === key ? null : current
      ));
    }, durationMs);
  };

  const triggerBattleSupportEffect = (targetId: string, durationMs = 760) => {
    const key = Date.now();
    setBattleSupportEffect({ targetId, key });
    window.setTimeout(() => {
      setBattleSupportEffect(current => (
        current?.targetId === targetId && current.key === key ? null : current
      ));
    }, durationMs);
  };

  const triggerBattleDamagePopup = (
    targetId: string,
    damage: number,
    critical = false,
    healing = false,
    spRecovery = false,
  ) => {
    const key = Date.now() + Math.random();
    setBattleDamagePopups(current => [...current, { targetId, damage, critical, healing, spRecovery, key }]);
    window.setTimeout(() => {
      setBattleDamagePopups(current => current.filter(popup => popup.key !== key));
    }, 900);
  };

  useEffect(() => {
    if (!battlePreviewOpen) {
      previousBattleVitalsRef.current = null;
      return;
    }

    const units = [
      battlePreviewState.hero,
      ...battlePreviewState.allies.filter((ally): ally is BattleUnitState => Boolean(ally)),
      ...battlePreviewState.beasts.filter((beast): beast is BattleUnitState => Boolean(beast)),
    ];
    const hpById = Object.fromEntries(units.map(unit => [unit.id, unit.hp]));
    const previous = previousBattleVitalsRef.current;
    previousBattleVitalsRef.current = { hpById, battleSp: battlePreviewState.battleSp };
    if (!previous) return;

    units.forEach(unit => {
      const previousHp = previous.hpById[unit.id];
      if (previousHp === undefined || previousHp === unit.hp) return;
      if (unit.hp < previousHp) {
        triggerBattleDamagePopup(unit.id, previousHp - unit.hp);
        triggerBattleHitEffect(unit.id);
        triggerBattleMotion(unit.id, 'hurt', 300);
      } else {
        triggerBattleDamagePopup(unit.id, unit.hp - previousHp, false, true);
      }
    });

    if (battlePreviewState.battleSp > previous.battleSp) {
      triggerBattleDamagePopup(
        battlePreviewState.hero.id,
        battlePreviewState.battleSp - previous.battleSp,
        false,
        false,
        true,
      );
    }
  }, [battlePreviewOpen, battlePreviewState.hero, battlePreviewState.allies, battlePreviewState.beasts, battlePreviewState.battleSp]);

  useEffect(() => {
    const isResolved = battlePreviewState.result === 'victory' || battlePreviewState.result === 'defeat';
    if (!battlePreviewOpen || !isResolved) {
      setBattleResultReveal(false);
      return;
    }
    const timer = window.setTimeout(() => setBattleResultReveal(true), BATTLE_RESULT_REVEAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [battlePreviewOpen, battlePreviewState.result]);

  useEffect(() => {
    const logElement = battleLogRef.current;
    if (!battlePreviewOpen || !logElement) return;
    logElement.scrollTop = logElement.scrollHeight;
  }, [battlePreviewOpen, battlePreviewState.logs]);

  const triggerPartnerSkillDisplay = (partnerId: string, skillName: string) => {
    const key = Date.now();
    setBattlePartnerSkillDisplay({ partnerId, text: skillName, key });
    window.setTimeout(() => {
      setBattlePartnerSkillDisplay(current => current?.key === key ? null : current);
    }, 1100);
  };

  const playBattleHitSe = () => {
    const sources = BATTLE_SE_SOURCES.hit;
    playUiSound(sources[Math.floor(Math.random() * sources.length)]);
  };

  const getBattleBeastSpriteSrc = (beastId: string): string => (
    BATTLE_BEAST_SPRITE_SOURCES[beastId] ?? BATTLE_BEAST_SPRITE_SOURCES.mole
  );

  const getBattleGirlSpriteSrc = (girlId: string): string => (
    BATTLE_GIRL_SPRITE_SOURCES[girlId] ?? '/img/battle/battle2d-ruby.png'
  );

  const getBattleGirlDownSpriteSrc = (girlId: string): string => (
    girlId === 'hero'
      ? '/img/battle/battle2d-player-down.png'
      : getBattleGirlSpriteSrc(girlId).replace(/\.png$/, '-down.png')
  );

  const getBattleItemOwnedCount = (itemName: string) => getItemCountIncludingDebug(inventoryCounts, itemName);

  const hasBattleDebugItem = (itemName: string) => (inventoryCounts[toDebugItemName(itemName)] ?? 0) > 0;

  const getBattleItemInventoryKeyToConsume = (itemName: string) => (
    hasBattleDebugItem(itemName) ? toDebugItemName(itemName) : itemName
  );

  const getAvailableBattleItems = () => BATTLE_CONSUMABLE_ITEMS.filter(item => getBattleItemOwnedCount(item.name) > 0);

  const getBattleItemTargets = (item: BattleConsumableItem, state = battlePreviewState) => {
    const units = [state.hero, ...state.allies.filter((ally): ally is BattleUnitState => Boolean(ally))];
    return units.filter(unit => item.kind === 'revive' ? unit.hp <= 0 : unit.hp > 0);
  };

  const closeBattleItemPanel = () => {
    setBattleItemPanelOpen(false);
    setBattleItemSelectionStep('item');
  };

  const openBattleItemPanel = () => {
    const availableItems = getAvailableBattleItems();
    if (availableItems.length === 0) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, '使える戦闘アイテムを持っていない。'].slice(-12) }));
      return;
    }
    setSelectedBattleItemIndex(0);
    setSelectedBattleItemTargetIndex(0);
    setBattleItemSelectionStep('item');
    setBattleItemPanelOpen(true);
  };

  const consumeBattleItem = (item: BattleConsumableItem, targetId: string) => {
    const current = battlePreviewState;
    if (current.result !== 'ongoing') return;
    if ((current.turn ?? 'party') !== 'party' || current.turnQueue[current.turnIndex]?.unitId !== current.hero.id) return;
    if (getBattleItemOwnedCount(item.name) <= 0) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, `${item.name}を持っていない。`].slice(-12) }));
      return;
    }
    const isDebugItem = hasBattleDebugItem(item.name);
    if (!isDebugItem && item.kind === 'heal' && current.healingItemUses >= BATTLE_HEALING_ITEM_USE_LIMIT) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, '回復アイテムはこのバトルではもう使えない。'].slice(-12) }));
      return;
    }
    if (!isDebugItem && item.kind === 'revive' && current.reviveItemUses >= BATTLE_REVIVE_ITEM_USE_LIMIT) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, '蘇生アイテムはこのバトルではもう使えない。'].slice(-12) }));
      return;
    }

    const hero = { ...current.hero };
    const allies = current.allies.map(ally => ally ? { ...ally } : null);
    const beasts = current.beasts.map(beast => beast ? { ...beast } : null);
    const target = targetId === hero.id
      ? hero
      : allies.find((ally): ally is BattleUnitState => Boolean(ally && ally.id === targetId));
    if (!target) return;
    if (item.kind === 'heal' && target.hp <= 0) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, `${target.name}には今使えない。`].slice(-12) }));
      return;
    }
    if (item.kind === 'revive' && target.hp > 0) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, `${target.name}は戦闘不能ではない。`].slice(-12) }));
      return;
    }

    const turnLogs: string[] = [`${item.name}を使った！`];
    let recoveredHp = 0;
    if (item.kind === 'heal') {
      const healAmount = item.healAmount ?? 0;
      const beforeHp = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + healAmount);
      recoveredHp = target.hp - beforeHp;
      turnLogs.push(`${target.name}のHPが${recoveredHp}回復した！`);
    } else {
      const reviveHp = Math.max(1, Math.round(target.maxHp * (item.reviveHpRate ?? 0.25)));
      target.hp = Math.min(target.maxHp, reviveHp);
      recoveredHp = target.hp;
      turnLogs.push(`${target.name}がHP${target.hp}で復活した！`);
    }

    triggerBattleSupportEffect(target.id);
    playUiSound(BATTLE_SE_SOURCES.cure);
    const inventoryKey = getBattleItemInventoryKeyToConsume(item.name);
    if (inventoryKey !== toDebugItemName(item.name)) {
      setInventoryCounts(prev => ({ ...prev, [inventoryKey]: Math.max(0, (prev[inventoryKey] ?? 0) - 1) }));
    }

    const nextTurn = getNextBattleTurn(hero, allies, beasts, current.turnQueue, current.turnIndex);
    setBattlePreviewState(prev => ({
      ...prev,
      hero,
      allies,
      beasts,
      logs: [...prev.logs, ...turnLogs].slice(-12),
      healingItemUses: prev.healingItemUses + (item.kind === 'heal' ? 1 : 0),
      reviveItemUses: prev.reviveItemUses + (item.kind === 'revive' ? 1 : 0),
      ...nextTurn,
    }));
    closeBattleItemPanel();
  };

  useEffect(() => {
    if (!battleItemPanelOpen) return;
    const selector = battleItemSelectionStep === 'item'
      ? `[data-battle-item-index="${selectedBattleItemIndex}"]`
      : `[data-battle-item-target-index="${selectedBattleItemTargetIndex}"]`;
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'nearest' });
  }, [battleItemPanelOpen, battleItemSelectionStep, selectedBattleItemIndex, selectedBattleItemTargetIndex]);

  useEffect(() => {
    if (!menuOpen) return;
    const selectedMenuId = selectedMenuItem.id;
    const selectors: Partial<Record<MenuItemId, string>> = {
      item: `[data-menu-item-name="${CSS.escape(selectedItemName)}"]`,
      equipment: `[data-equipment-option-index="${selectedEquipmentOptionIndex}"]`,
      farm: `[data-farm-girl-index="${selectedFarmGirlIndex}"]`,
      zukan: `[data-zukan-index="${selectedZukanIndex}"]`,
      system: `[data-system-action-index="${selectedSystemActionIndex}"]`,
    };
    const selector = selectors[selectedMenuId];
    if (!selector) return;
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'nearest' });
  }, [
    menuOpen,
    selectedMenuItem.id,
    selectedItemName,
    selectedEquipmentOptionIndex,
    selectedFarmGirlIndex,
    selectedZukanIndex,
    selectedSystemActionIndex,
  ]);

  useEffect(() => {
    if (farmSlotInteractionStage !== 'selectSeed') return;
    document
      .querySelector<HTMLElement>(`[data-nearby-seed-index="${selectedNearbySeedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [farmSlotInteractionStage, selectedNearbySeedIndex]);

  const handleBattlePreviewCommand = (command: string) => {
    playFixSound();
    if (battleIntroPhase !== null) return;
    if ((battlePreviewState.turn ?? 'party') !== 'party' || battlePreviewState.turnQueue[battlePreviewState.turnIndex]?.unitId !== 'hero') return;
    if (command === 'アイテム') {
      openBattleItemPanel();
      return;
    }
    if (command === '強攻撃' && battlePreviewState.battleSp < BATTLE_SKILL_SP_COST) {
      setBattlePreviewState(prev => ({ ...prev, logs: [...prev.logs, '戦闘SPが足りない！'].slice(-12) }));
      return;
    }
    if (command === '攻撃') {
      triggerBattleMotion('hero', 'attack', BATTLE_ATTACK_MOTION_DURATION_MS);
      playBattleHitSe();
    }
    if (command === '強攻撃') {
      triggerBattleMotion('hero', 'skill', 520);
      playUiSound(BATTLE_SE_SOURCES.skill);
    }
    if (command === '防御') {
      triggerBattleMotion('hero', 'defend', 560);
    }
    setBattlePreviewState(prev => {
      if (prev.result !== 'ongoing') return prev;
      if ((prev.turn ?? 'party') !== 'party' || prev.turnQueue[prev.turnIndex]?.unitId !== prev.hero.id) return prev;
      const hero = { ...prev.hero };
      const allies = prev.allies.map(ally => ally ? { ...ally } : null);
      const beasts = prev.beasts.map(beast => beast ? { ...beast } : null);
      let battleSp = prev.battleSp;
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
          playUiSound(BATTLE_SE_SOURCES.guard);
          triggerBattleMotion(hero.id, 'defend', 360);
          turnLogs.push('主人公は防御してダメージを半減した！');
        }
        target.hp = Math.max(0, target.hp - damage);
        return { damage, critical: result.critical };
      };

      if (command === 'あきらめる') {
        return { ...prev, logs: [...prev.logs, '主人公たちは戦闘から離脱した。'].slice(-12), result: 'escaped' };
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

      if (command === '強攻撃') {
        const target = beasts.find(beast => beast && beast.hp > 0);
        if (!target) {
          const result = getBattleResult(hero, allies, beasts);
          return { ...prev, hero, allies, beasts, result };
        }
        battleSp -= BATTLE_SKILL_SP_COST;
        const skillAttacker = { ...hero, attack: Math.round(hero.attack * 1.45), criticalRate: (hero.criticalRate ?? 0) + 5 };
        turnLogs.push('主人公の強攻撃！');
        const { damage, critical } = damageTarget(target, skillAttacker, { isBeastTarget: true });
        if (critical) turnLogs.push('クリティカル！');
        turnLogs.push(`${target.name}に${damage}ダメージ！`);
        if (target.hp <= 0) turnLogs.push(`${target.name}を倒した！`);
      }

      let result = getBattleResult(hero, allies, beasts);
      if (result !== 'ongoing') {
        turnLogs.push(result === 'victory' ? '勝利！' : '敗北...');
        const loot = result === 'victory' ? rollBattleLoot(beasts, prev.partnerDropRateBonus) : [];
        loot.forEach(item => turnLogs.push(`${item.itemName} ×${item.count} を手に入れた！`));
        return { ...prev, hero, allies, beasts, logs: [...prev.logs, ...turnLogs].slice(-12), result, loot, lootGranted: false, battleSp, turn: 'party' };
      }

      applyCompanionRegenPerHeroTurn(hero, allies, turnLogs);
      result = getBattleResult(hero, allies, beasts);
      const loot = result === 'victory' ? rollBattleLoot(beasts, prev.partnerDropRateBonus) : [];
      if (result === 'victory') {
        turnLogs.push('勝利！');
        loot.forEach(item => turnLogs.push(`${item.itemName} ×${item.count} を手に入れた！`));
      }
      if (result === 'defeat') turnLogs.push('敗北...');
      const nextTurn = getNextBattleTurn(hero, allies, beasts, prev.turnQueue, prev.turnIndex);
      return {
        ...prev,
        hero,
        allies,
        beasts,
        logs: [...prev.logs, ...turnLogs].slice(-12),
        result,
        loot,
        lootGranted: false,
        battleSp,
        ...(result === 'ongoing' ? nextTurn : { turn: 'party' }),
      };
    });
  };

  useEffect(() => {
    if (!battlePreviewOpen || battleIntroPhase === null) return;

    playVoiceSound('/voice/3.wav');
    const timers = [
      window.setTimeout(() => {
        setBattleIntroPhase(2);
        playVoiceSound('/voice/2.wav');
      }, 1000),
      window.setTimeout(() => {
        setBattleIntroPhase(1);
        playVoiceSound('/voice/1.wav');
      }, 2000),
      window.setTimeout(() => setBattleIntroPhase('start'), 3000),
      window.setTimeout(() => setBattleIntroPhase(null), 3700),
    ];
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [battlePreviewOpen]);

  useEffect(() => {
    if (!battlePreviewOpen) return;
    if (battleIntroPhase !== null) return;
    if (battlePreviewState.result !== 'ongoing') return;
    if ((battlePreviewState.turn ?? 'party') !== 'enemy') return;

    const timer = window.setTimeout(() => {
      setBattlePreviewState(prev => {
        if (prev.result !== 'ongoing') return prev;
        if ((prev.turn ?? 'party') !== 'enemy') return prev;

        const hero = { ...prev.hero };
        const allies = prev.allies.map(ally => ally ? { ...ally } : null);
        const beasts = prev.beasts.map(beast => beast ? { ...beast } : null);
        const turnLogs: string[] = [];

        const activeTurn = prev.turnQueue[prev.turnIndex];
        const beast = beasts.find(candidate => candidate?.id === activeTurn?.unitId);
        if (activeTurn?.kind !== 'enemy' || !beast || beast.hp <= 0) {
          const nextTurn = getNextBattleTurn(hero, allies, beasts, prev.turnQueue, prev.turnIndex);
          return { ...prev, hero, allies, beasts, ...nextTurn };
        }
        {
          const aliveAllies = allies.filter((ally): ally is BattleUnitState => Boolean(ally && ally.hp > 0));
          const targetHero = hero.hp > 0 && (aliveAllies.length === 0 || Math.random() < 0.7);
          const target = targetHero ? hero : aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
          if (!target) {
            const result = getBattleResult(hero, allies, beasts);
            const nextTurn = getNextBattleTurn(hero, allies, beasts, prev.turnQueue, prev.turnIndex);
            return { ...prev, hero, allies, beasts, result, ...(result === 'ongoing' ? nextTurn : { turn: 'party' }) };
          }
          turnLogs.push(`${beast.name}の攻撃！`);
          triggerBattleMotion(beast.id, 'attack', BATTLE_ATTACK_MOTION_DURATION_MS);
          playBattleHitSe();

          if (target.id === hero.id) {
            const result = calculateBattleDamage(beast, target, { isBeastAttacker: true });
            let damage = result.damage;
            if (target.defending) {
              damage = Math.max(1, Math.round(damage * 0.5));
              target.defending = false;
              playUiSound(BATTLE_SE_SOURCES.guard);
              window.setTimeout(() => triggerBattleMotion(target.id, 'defend', 300), 180);
              turnLogs.push('主人公は防御してダメージを半減した！');
            }
            target.hp = Math.max(0, target.hp - damage);
            if (result.critical) turnLogs.push('クリティカル！');
            turnLogs.push(`主人公に${damage}ダメージ！`);
            if (target.hp <= 0) turnLogs.push('主人公は倒れた！');
          } else {
            const result = calculateBattleDamage(beast, target, { isBeastAttacker: true });
            target.hp = Math.max(0, target.hp - result.damage);
            if (result.critical) turnLogs.push('クリティカル！');
            turnLogs.push(`${target.name}に${result.damage}ダメージ！`);
            if (target.hp <= 0) turnLogs.push(`${target.name}は倒れた！`);
          }
        }

        const result = getBattleResult(hero, allies, beasts);
        if (result === 'defeat') turnLogs.push('敗北...');
        const nextTurn = getNextBattleTurn(hero, allies, beasts, prev.turnQueue, prev.turnIndex);
        return {
          ...prev,
          hero,
          allies,
          beasts,
          logs: [...prev.logs, ...turnLogs].slice(-12),
          result,
          loot: result === 'victory' ? rollBattleLoot(beasts, prev.partnerDropRateBonus) : prev.loot,
          lootGranted: result === 'victory' ? false : prev.lootGranted,
          ...(result === 'ongoing' ? nextTurn : { turn: 'party' }),
        };
      });
    }, BATTLE_ENEMY_TURN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [battlePreviewOpen, battleIntroPhase, battlePreviewState.turn, battlePreviewState.turnIndex, battlePreviewState.result]);

  useEffect(() => {
    if (!battlePreviewOpen) return;
    if (battleIntroPhase !== null) return;
    if (battlePreviewState.result !== 'ongoing') return;
    if ((battlePreviewState.turn ?? 'party') !== 'partner') {
      resolvedPartnerTurnRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      const activeTurn = battlePreviewState.turnQueue[battlePreviewState.turnIndex];
      const turnKey = `${battlePreviewState.turnIndex}:${activeTurn?.unitId ?? ''}`;
      if (resolvedPartnerTurnRef.current === turnKey) return;
      resolvedPartnerTurnRef.current = turnKey;
      const partnerSkillRoll = Math.random();
      let partnerSkillEffectsPlayed = false;
      let partnerAttackEffectsPlayed = false;
      setBattlePreviewState(prev => {
        if (prev.result !== 'ongoing') return prev;
        if ((prev.turn ?? 'party') !== 'partner') return prev;

        const hero = { ...prev.hero };
        const allies = prev.allies.map(ally => ally ? { ...ally } : null);
        const beasts = prev.beasts.map(beast => beast ? { ...beast } : null);
        const activeTurn = prev.turnQueue[prev.turnIndex];
        const partner = allies.find((ally): ally is BattleUnitState => Boolean(ally?.id === activeTurn?.unitId && ally.hp > 0));
        const target = beasts.find((beast): beast is BattleUnitState => Boolean(beast && beast.hp > 0));
        if (activeTurn?.kind !== 'partner' || !partner || !target) {
          const result = getBattleResult(hero, allies, beasts);
          const nextTurn = getNextBattleTurn(hero, allies, beasts, prev.turnQueue, prev.turnIndex);
          return { ...prev, hero, allies, beasts, result, ...(result === 'ongoing' ? nextTurn : { turn: 'party' }) };
        }

        const turnLogs: string[] = [`${partner.name}の攻撃！`];
        const skill = PARTNER_SKILL_PREVIEWS[partner.id];
        let partnerSkillUses = prev.partnerSkillUses;
        let battleSp = prev.battleSp;
        let partnerDropRateBonus = prev.partnerDropRateBonus;
        let isPutiFollowUp = false;
        let usedSupportSkill = false;
        let supportEffectTargetId = hero.id;
        let recoveredHp = 0;
        let recoveredSp = 0;
        const canUsePartnerSkill = skill &&
          partnerSkillUses < prev.partnerSkillMaxUses &&
          (
            partner.id === 'viola' || partner.id === 'saffy'
              ? battleSp < prev.maxBattleSp
              : partner.id === 'kabune'
                ? hero.hp > 0 && hero.hp < hero.maxHp
                : partner.id === 'cure'
                  ? hero.hp > 0 && hero.hp < hero.maxHp
                  : true
          );
        if (canUsePartnerSkill && partnerSkillRoll < 0.5) {
          partnerSkillUses = Math.min(prev.partnerSkillMaxUses, partnerSkillUses + 1);
          usedSupportSkill = PARTNER_SUPPORT_SKILL_IDS.has(partner.id);
          turnLogs.push(`${partner.name}の${skill.name}！`);
          const shouldPlaySkillEffects = !partnerSkillEffectsPlayed;
          if (shouldPlaySkillEffects) {
            partnerSkillEffectsPlayed = true;
            triggerPartnerSkillDisplay(partner.id, skill.name);
            if (usedSupportSkill) {
              triggerBattleMotion(partner.id, 'defend', 520);
            }
          }
          switch (partner.id) {
            case 'viola': {
              const beforeSp = battleSp;
              battleSp = Math.min(prev.maxBattleSp, battleSp + 2);
              recoveredSp = battleSp - beforeSp;
              break;
            }
            case 'nazuna': target.defense = Math.max(0, target.defense - 2); break;
            case 'kabune': {
              const recipient = [hero, ...allies.filter((ally): ally is BattleUnitState => Boolean(ally && ally.hp > 0))]
                .filter(unit => unit.hp < unit.maxHp)
                .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
              if (!recipient) break;
              const beforeHp = recipient.hp;
              recipient.hp = Math.min(recipient.maxHp, recipient.hp + 10);
              recoveredHp = recipient.hp - beforeHp;
              supportEffectTargetId = recipient.id;
              break;
            }
            case 'caro': hero.speed += 3; break;
            case 'theta': partnerDropRateBonus += 0.10; break;
            case 'cure': {
              const beforeHp = hero.hp;
              hero.hp = Math.min(hero.maxHp, hero.hp + 15);
              recoveredHp = hero.hp - beforeHp;
              break;
            }
            case 'shiro': hero.beastDamageReduction = (hero.beastDamageReduction ?? 0) + 8; break;
            case 'momona': hero.criticalRate = (hero.criticalRate ?? 0) + 5; break;
            case 'pan': hero.beastDamageReduction = (hero.beastDamageReduction ?? 0) + 15; break;
            case 'puti': isPutiFollowUp = true; break;
            case 'roma': partnerDropRateBonus += 0.10; break;
            case 'saffy': {
              const beforeSp = battleSp;
              battleSp = Math.min(prev.maxBattleSp, battleSp + 2);
              recoveredSp = battleSp - beforeSp;
              break;
            }
          }
          if (usedSupportSkill && shouldPlaySkillEffects) {
            triggerBattleSupportEffect(supportEffectTargetId);
            playUiSound(BATTLE_SE_SOURCES.cure);
          }
        }
        if (!partnerAttackEffectsPlayed) {
          partnerAttackEffectsPlayed = true;
          window.setTimeout(() => {
            triggerBattleMotion(partner.id, 'attack', BATTLE_ATTACK_MOTION_DURATION_MS);
            playBattleHitSe();
          }, usedSupportSkill ? 520 : 0);
        }

        const { damage, critical } = calculateBattleDamage(partner, target, { isBeastTarget: true });
        target.hp = Math.max(0, target.hp - damage);
        if (critical) turnLogs.push('クリティカル！');
        turnLogs.push(`${target.name}に${damage}ダメージ！`);
        if (target.hp <= 0) turnLogs.push(`${target.name}を倒した！`);
        if (isPutiFollowUp && target.hp > 0) {
          const followUp = calculateBattleDamage(partner, target, { isBeastTarget: true });
          target.hp = Math.max(0, target.hp - followUp.damage);
          turnLogs.push(`追撃！ ${target.name}に${followUp.damage}ダメージ！`);
          if (target.hp <= 0) turnLogs.push(`${target.name}を倒した！`);
        }

        const result = getBattleResult(hero, allies, beasts);
        if (result !== 'ongoing') {
          turnLogs.push(result === 'victory' ? '勝利！' : '敗北...');
          const loot = result === 'victory' ? rollBattleLoot(beasts, partnerDropRateBonus) : [];
          loot.forEach(item => turnLogs.push(`${item.itemName} ×${item.count} を手に入れた！`));
          return { ...prev, hero, allies, beasts, logs: [...prev.logs, ...turnLogs].slice(-12), result, loot, lootGranted: false, battleSp, partnerSkillUses, partnerDropRateBonus, turn: 'party' };
        }

        const nextTurn = getNextBattleTurn(hero, allies, beasts, prev.turnQueue, prev.turnIndex);
        return {
          ...prev,
          hero,
          allies,
          beasts,
          logs: [...prev.logs, ...turnLogs].slice(-12),
          result,
          battleSp,
          partnerSkillUses,
          partnerDropRateBonus,
          ...nextTurn,
        };
      });
    }, 850);

    return () => window.clearTimeout(timer);
  }, [battlePreviewOpen, battleIntroPhase, battlePreviewState.turn, battlePreviewState.turnIndex, battlePreviewState.result]);

  useEffect(() => {
    if (battlePreviewState.result !== 'victory') return;
    if (battlePreviewState.lootGranted) return;
    if (gameMode === 'endlessNursery') {
      const defeatedBeasts = battlePreviewState.beasts.filter((beast): beast is BattleUnitState => Boolean(beast && beast.hp <= 0));
      setEndlessStats(previous => ({
        ...previous,
        totalBeastsDefeated: previous.totalBeastsDefeated + defeatedBeasts.length,
      }));
      setCollectionProgress(previous => ({
        ...previous,
        defeatedBeastIds: Array.from(new Set([
          ...previous.defeatedBeastIds,
          ...defeatedBeasts.map(beast => beast.id),
        ])),
      }));
    }
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
  }, [battlePreviewState.result, battlePreviewState.loot, battlePreviewState.lootGranted, gameMode]);

  useEffect(() => {
    if (!battlePreviewOpen || battlePreviewState.result !== 'defeat') {
      battleLoseSoundPlayedRef.current = false;
      return;
    }
    if (battleLoseSoundPlayedRef.current) return;
    battleLoseSoundPlayedRef.current = true;
    playUiSound(BATTLE_SE_SOURCES.lose);
  }, [battlePreviewOpen, battlePreviewState.result]);

  useEffect(() => {
    if (battlePreviewState.result !== 'defeat') return;
    if (battlePreviewState.encounterType !== 'beastAttack' || battlePreviewState.farmDamageResolved) return;

    const farmTheft = createBeastAttackFarmTheft(inventoryCounts, difficulty);
    if (farmTheft.length > 0) {
      setInventoryCounts(previous => {
        const next = { ...previous };
        farmTheft.forEach(({ itemName, count }) => {
          next[itemName] = Math.max(0, (next[itemName] ?? 0) - count);
        });
        return next;
      });
    }

    const affectedCandidates = difficulty === 'easy'
      ? []
      : farmGirls.filter(girl => girl.state === 'appeared' || girl.state === 'companion' || girl.state === 'lover');
    const affectedGirl = affectedCandidates.length > 0
      ? affectedCandidates[Math.floor(Math.random() * affectedCandidates.length)]
      : null;
    const sourceBeasts = battlePreviewState.beasts.filter((beast): beast is BattleUnitState => Boolean(beast));
    const sourceBeast = sourceBeasts.length > 0
      ? sourceBeasts[Math.floor(Math.random() * sourceBeasts.length)]
      : null;
    const battleConditionDay = Math.floor(turn / 4) + 1;
    const trustLoss = difficulty === 'hard' ? 10 : 5;
    if (affectedGirl) {
      setFarmGirls(previous => previous.map(girl => (
        girl.girlId === affectedGirl.girlId
          ? {
            ...girl,
            trust: Math.max(0, girl.trust - trustLoss),
            condition: 'affected',
            conditionDay: battleConditionDay,
            conditionSource: sourceBeast?.id ?? null,
          }
          : girl
      )));
      if (companionGirlId === affectedGirl.girlId) setCompanionGirlId(null);
    }

    const farmDamageLogs = farmTheft.length > 0
      ? ['獣に作物を荒らされた……', ...farmTheft.map(({ itemName, count }) => `${itemName} ×${count} を失った。`)]
      : ['獣に作物を荒らされた……', '盗まれる収穫物はなかった。'];
    if (affectedGirl) {
      const affectedGirlName = GIRL_DATA.find(girl => girl.id === affectedGirl.girlId)?.girlName ?? affectedGirl.girlId;
      farmDamageLogs.push(
        difficulty === 'hard'
          ? `${affectedGirlName}が深く傷ついている……`
          : `${affectedGirlName}が獣に怯えている……`,
        difficulty === 'hard' ? '信頼度が下がった。' : '信頼度が少し下がった。',
      );
    }
    setDialogMessage(farmDamageLogs.join('\n'));
    setBattlePreviewState(previous => (
      previous.result === 'defeat' && previous.encounterType === 'beastAttack'
        ? { ...previous, logs: [...previous.logs, ...farmDamageLogs].slice(-12), farmDamageResolved: true }
        : previous
    ));
  }, [battlePreviewState.beasts, battlePreviewState.encounterType, battlePreviewState.farmDamageResolved, battlePreviewState.result, companionGirlId, difficulty, farmGirls, inventoryCounts, turn]);

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

  const stopPrologueVoice = () => {
    if (!prologueVoiceRef.current) return;
    prologueVoiceRef.current.pause();
    prologueVoiceRef.current.currentTime = 0;
    prologueVoiceRef.current = null;
  };

  useEffect(() => {
    prologuePageRef.current = prologuePage;
  }, [prologuePage]);

  useEffect(() => {
    prologueRingRevealRef.current = prologueRingReveal;
  }, [prologueRingReveal]);

  const finishPrologue = () => {
    stopPrologueVoice();
    fadeOutAudio(prologueBgmRef.current, 1200);
    window.setTimeout(() => {
      prologueBgmRef.current = null;
    }, 1200);
    setPrologueOpen(false);
    setNextObjective(OPENING_WALK_OBJECTIVE);
    setDialogMessage(OPENING_WALK_OBJECTIVE);
  };

  const advancePrologue = () => {
    if (prologueInputLockedRef.current) return;
    prologueInputLockedRef.current = true;
    window.setTimeout(() => {
      prologueInputLockedRef.current = false;
    }, 400);

    const currentProloguePage = prologuePageRef.current;
    const isRingRevealOpen = prologueRingRevealRef.current;

    if (isRingRevealOpen) {
      playFixSound();
      prologueRingRevealRef.current = false;
      prologuePageRef.current = 4;
      setPrologueRingReveal(false);
      setPrologueRingRevealReady(false);
      setProloguePage(4);
      return;
    }
    if (currentProloguePage === 3) {
      prologueRingRevealRef.current = true;
      setPrologueRingRevealReady(false);
      setPrologueRingReveal(true);
      playUiSound('/se/cure.mp3');
      return;
    }
    if (currentProloguePage < PROLOGUE_LETTERS.length - 1) {
      playFixSound();
      const nextPage = currentProloguePage + 1;
      prologuePageRef.current = nextPage;
      setProloguePage(nextPage);
      return;
    }
    if (currentProloguePage === PROLOGUE_LETTERS.length - 1) {
      playFixSound();
      stopPrologueVoice();
      fadeOutAudio(prologueBgmRef.current, 1200);
      window.setTimeout(() => {
        prologueBgmRef.current = null;
      }, 1200);
      prologuePageRef.current = PROLOGUE_LETTERS.length;
      setProloguePage(PROLOGUE_LETTERS.length);
      return;
    }
    finishPrologue();
  };

  const goBackPrologueLetter = () => {
    if (prologueInputLockedRef.current || prologuePage <= 0 || prologuePage >= PROLOGUE_LETTERS.length) return;
    prologueInputLockedRef.current = true;
    window.setTimeout(() => {
      prologueInputLockedRef.current = false;
    }, 400);
    playFixSound();
    setProloguePage(page => Math.max(0, page - 1));
  };

  useEffect(() => {
    if (!prologueRingReveal) return;
    setPrologueRingRevealReady(true);
  }, [prologueRingReveal]);

  useEffect(() => {
    if (!prologueOpen || prologuePage >= PROLOGUE_LETTERS.length) return;
    if (!prologueBgmRef.current) {
      const audio = new Audio('/bgm/jii.mp3');
      audio.loop = true;
      audio.volume = getEffectiveVolume('/bgm/jii.mp3', bgmVolume, audioGainsRef.current);
      prologueBgmRef.current = audio;
      audio.play().catch(err => console.log('Prologue BGM autoplay blocked', err));
      return;
    }
    prologueBgmRef.current.volume = getEffectiveVolume('/bgm/jii.mp3', bgmVolume, audioGainsRef.current);
  }, [prologueOpen, bgmVolume, audioGains]);

  useEffect(() => {
    if (!prologueOpen || prologuePage >= PROLOGUE_LETTERS.length) return;
    stopPrologueVoice();
    prologueVoiceRef.current = playVoiceSound(PROLOGUE_LETTERS[prologuePage]?.voiceSrc ?? '');
  }, [prologueOpen, prologuePage]);

  useEffect(() => {
    if (!prologueOpen) return;
    const handlePrologueKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (prologueRingRevealRef.current) {
        playFixSound();
        prologueInputLockedRef.current = false;
        prologueRingRevealRef.current = false;
        prologuePageRef.current = 4;
        setPrologueRingReveal(false);
        setPrologueRingRevealReady(false);
        setProloguePage(4);
        return;
      }
      if (event.repeat) return;
      advancePrologue();
    };
    window.addEventListener('keydown', handlePrologueKeyDown, true);
    return () => window.removeEventListener('keydown', handlePrologueKeyDown, true);
  }, [prologueOpen, prologuePage, prologueRingReveal]);

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
  const stopSeedPlantTutorialVoice = () => {
    if (!seedPlantTutorialVoiceRef.current) return;
    seedPlantTutorialVoiceRef.current.pause();
    seedPlantTutorialVoiceRef.current.currentTime = 0;
    seedPlantTutorialVoiceRef.current = null;
  };
  const playSeedPlantTutorialVoice = (stepIndex: number) => {
    stopSeedPlantTutorialVoice();
    const voiceSrc = SEED_PLANT_TUTORIAL_VOICE_SRCS[stepIndex];
    if (!voiceSrc) return;
    seedPlantTutorialVoiceRef.current = playVoiceSound(voiceSrc);
  };
  const stopSeedAfterPlantTutorialVoice = () => {
    if (!seedAfterPlantTutorialVoiceRef.current) return;
    seedAfterPlantTutorialVoiceRef.current.pause();
    seedAfterPlantTutorialVoiceRef.current.currentTime = 0;
    seedAfterPlantTutorialVoiceRef.current = null;
  };
  const playSeedAfterPlantTutorialVoice = (stepIndex: number) => {
    stopSeedAfterPlantTutorialVoice();
    const voiceSrc = SEED_AFTER_PLANT_TUTORIAL_STEPS[stepIndex]?.voiceSrc;
    if (!voiceSrc) return;
    seedAfterPlantTutorialVoiceRef.current = playVoiceSound(voiceSrc);
  };
  const grantKurumiStarterSeeds = () => {
    if (hasReceivedKurumiStarterSeeds) return;
    setOwnedGirlSeeds(prev => Array.from(new Set([...prev, ...INITIAL_OWNED_GIRL_SEEDS])));
    setHasReceivedKurumiStarterSeeds(true);
    setSeedPlantTutorialStepIndex(0);
    setSeedPlantTutorialOpen(true);
    playSeedPlantTutorialVoice(0);
    setNextObjective(STARTER_SEED_OBJECTIVE);
    setDialogMessage(STARTER_SEED_OBJECTIVE);
  };
  const getFarmFieldLabel = (fieldId: FieldId) => fieldId === 'left' ? '左畑' : '右畑';
  const getPlantableFarmFieldSlots = () => farmFieldSlots.filter(slot => slot.girlId === null && slot.state === 'none');
  const getFarmGirlHarvestInfo = (girlId: string) => {
    const farmGirl = farmGirls.find(girl => girl.girlId === girlId);
    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girlId);
    const fieldSlot = farmFieldSlots.find(slot => slot.girlId === girlId);
    if (fieldSlot && fieldSlot.state !== 'appeared') {
      const growthProgress = farmGirl?.growthProgress ?? 0;
      const daysUntilHarvest = crop ? Math.max(1, crop.growthDays - growthProgress) : null;
      return { canHarvest: false, daysUntilHarvest, crop, farmGirl };
    }
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
    const companionHarvestModifier = getSkillAdjustedCompanionHarvestModifier(companionGirlId === girlId, trustBeforeHarvest);
    if (companionHarvestModifier.multiplier === 0) {
      setDialogMessage('同行中のため収穫できません');
      return;
    }
    const harvestAmount = getFarmHarvestAmount(
      crop.baseHarvestAmount,
      trustBeforeHarvest,
      companionHarvestModifier.multiplier *
        getAffectedHarvestMultiplier(farmGirl?.condition ?? 'normal', difficulty) *
        getHeroSkillMultiplier('farm_harvest_up', 5),
    );
    const trustGain = getSkillAdjustedTrustGain(farmGirl?.condition ?? 'normal');
    const nextTrust = Math.min(100, (farmGirl?.trust ?? girl?.initialTrust ?? 0) + trustGain);
    const newlyUnlockedTrustEvents = girl?.trustEvents.filter(event => (
      nextTrust >= event.trust && !(farmGirl?.unlockedTrustEventIds ?? []).includes(event.eventId)
    )) ?? [];
    const isFirstHarvestReveal = !farmGirl?.cardRevealed;
    setInventoryCounts(prev => ({
      ...prev,
      [crop.harvestItemName]: (prev[crop.harvestItemName] ?? 0) + harvestAmount,
    }));
    setFarmGirls(prev => prev.map(entry => (
      entry.girlId === girlId
        ? {
          ...entry,
          cardRevealed: true,
          lastHarvestDay: currentDay,
          trust: Math.min(100, entry.trust + trustGain),
          unlockedTrustEventIds: Array.from(new Set([
            ...entry.unlockedTrustEventIds,
            ...newlyUnlockedTrustEvents.map(event => event.eventId),
          ])),
        }
        : entry
    )));
    if (isFirstHarvestReveal) {
      setRevealingFarmGirlIds(previous => Array.from(new Set([...previous, girlId])));
      window.setTimeout(() => {
        setRevealingFarmGirlIds(previous => previous.filter(revealingGirlId => revealingGirlId !== girlId));
      }, 1400);
    }
    incrementEndlessStat('totalHarvestCount', harvestAmount);
    if (newlyUnlockedTrustEvents.length > 0 && isEndlessNurseryMode()) {
      setEndlessStats(previous => ({
        ...previous,
        totalTrustEventsUnlocked: previous.totalTrustEventsUnlocked + newlyUnlockedTrustEvents.length,
      }));
      setCollectionProgress(previous => ({
        ...previous,
        unlockedEventIds: Array.from(new Set([
          ...previous.unlockedEventIds,
          ...newlyUnlockedTrustEvents.map(event => event.eventId),
        ])),
      }));
    }
    setDialogMessage(
      isFirstHarvestReveal
        ? `${girl?.girlName ?? crop.seedName}が初めて収穫できた！\n苗カードが娘カードに変化しました。`
        : newlyUnlockedTrustEvents.length > 0
        ? `${girl?.girlName ?? crop.seedName}との信頼イベントが解放された！`
        : `${girl?.girlName ?? crop.seedName}から${crop.harvestItemName}を${harvestAmount}個収穫しました。信頼度 +${trustGain}`
    );
  };
  const careForSeedling = (girlId: string, action: 'caress' | 'finger' | 'fertilize') => {
    const farmGirl = farmGirls.find(girl => girl.girlId === girlId);
    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girlId);
    if (!farmGirl || !crop || farmGirl.state !== 'growing') {
      setDialogMessage('成長中の苗娘にだけお世話できます。');
      return;
    }
    if (currentAP <= 0) {
      setDialogMessage(EXHAUSTED_ACTION_MESSAGE);
      return;
    }
    const currentCount = farmGirl.careDay === currentDay
      ? action === 'caress' ? farmGirl.caressCount : action === 'finger' ? farmGirl.fingerCount : farmGirl.fertilizeCount
      : 0;
    const careLimit = getSkillAdjustedSeedlingCareLimit(action, crop);
    if (currentCount >= careLimit) {
      setDialogMessage('このお世話は今日はもう行いました。');
      return;
    }

    const baseQualityGain = action === 'caress'
      ? 3 + Math.floor(Math.random() * 4)
      : action === 'finger'
        ? 6 + Math.floor(Math.random() * 5)
        : 0;
    const qualityGain = currentCount >= 1 ? Math.max(1, Math.round(baseQualityGain * 0.5)) : baseQualityGain;
    const nextGrowthProgress = action === 'fertilize'
      ? Math.min(crop.growthDays, farmGirl.growthProgress + 1)
      : farmGirl.growthProgress;
    const hasAppeared = nextGrowthProgress >= crop.growthDays;
    consumeAPForAction();
    setFarmGirls(previous => previous.map(girl => {
      if (girl.girlId !== girlId) return girl;
      const isSameDay = girl.careDay === currentDay;
      return {
        ...girl,
        growthProgress: nextGrowthProgress,
        state: hasAppeared ? 'appeared' : girl.state,
        quality: clampNumber(girl.quality + qualityGain, 0, 100),
        careDay: currentDay,
        caressCount: action === 'caress' ? (isSameDay ? girl.caressCount : 0) + 1 : (isSameDay ? girl.caressCount : 0),
        fingerCount: action === 'finger' ? (isSameDay ? girl.fingerCount : 0) + 1 : (isSameDay ? girl.fingerCount : 0),
        fertilizeCount: action === 'fertilize' ? (isSameDay ? girl.fertilizeCount : 0) + 1 : (isSameDay ? girl.fertilizeCount : 0),
      };
    }));
    if (hasAppeared) {
      setFarmFieldSlots(previous => previous.map(slot => (
        slot.girlId === girlId ? { ...slot, state: 'appeared' } : slot
      )));
    }
    const actionLabel = action === 'caress' ? '愛撫' : action === 'finger' ? '指入れ' : '肥料注入';
    const result = action === 'fertilize'
      ? `成長度が1日進みました${hasAppeared ? '。擬人化しました！' : '。'}`
      : `品質が${qualityGain}上がりました。`;
    setDialogMessage(`${actionLabel}：${result}`);
  };
  const plantGirlSeedToSlot = (seedId: string, fieldId: FieldId, slotIndex: number) => {
    const seedData = GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === seedId);
    if (!seedData || !ownedGirlSeeds.includes(seedId)) {
      setDialogMessage('この苗娘はまだ所持していません。');
      return;
    }

    const farmGirl = farmGirls.find(girl => girl.girlId === seedData.girlId);
    if (!farmGirl || isGirlPlantedInFarmField(seedData.girlId)) {
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

    const initialQuality = clampNumber(
      30 + Math.floor(Math.random() * 11) + (hasHeroSkill('farm_seedling_care') ? 5 : 0),
      0,
      100,
    );
    setFarmGirls(prev => prev.map(girl => (
      girl.girlId === seedData.girlId
        ? {
          ...girl,
          state: 'growing',
          cardRevealed: false,
          plantedDay: currentDay,
          growthProgress: 0,
          quality: initialQuality,
          careDay: null,
          caressCount: 0,
          fingerCount: 0,
          fertilizeCount: 0,
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
  const getFarmSlotByKey = (slotKey: string | null) => {
    if (!slotKey) return null;
    return farmFieldSlots.find(slot => `${slot.fieldId}_${slot.slotIndex}` === slotKey) ?? null;
  };
  const isGirlPlantedInFarmField = (girlId: string) => farmFieldSlots.some(slot => slot.girlId === girlId);
  const nearbyOwnedSeedOptions = ownedGirlSeeds.flatMap(seedId => {
    const seed = GIRL_SEED_ACQUISITION_DATA.find(entry => entry.seedId === seedId);
    if (!seed) return [];
    const isPlanted = isGirlPlantedInFarmField(seed.girlId);
    return [{ ...seed, isPlanted }];
  });
  const getFirstPlantableNearbySeedIndex = () => Math.max(0, nearbyOwnedSeedOptions.findIndex(seed => !seed.isPlanted));
  const getNextPlantableNearbySeedIndex = (currentIndex: number, direction: 1 | -1) => {
    const plantableIndexes = nearbyOwnedSeedOptions
      .map((seed, index) => seed.isPlanted ? -1 : index)
      .filter(index => index >= 0);
    if (plantableIndexes.length === 0) return currentIndex;
    const currentPlantableIndex = plantableIndexes.indexOf(currentIndex);
    if (currentPlantableIndex === -1) {
      return direction > 0 ? plantableIndexes[0] : plantableIndexes[plantableIndexes.length - 1];
    }
    return plantableIndexes[(currentPlantableIndex + direction + plantableIndexes.length) % plantableIndexes.length];
  };
  const closeFarmSlotInteraction = (blockCurrentSlot = true) => {
    if (blockCurrentSlot) farmSlotInteractionBlockedRef.current = activeFarmSlotKey;
    setFarmSlotInteractionStage(null);
    setActiveFarmSlotKey(null);
    setPendingNearbySeedId(null);
    setFarmSlotConfirmChoice('yes');
  };
  const openFarmSlotInteraction = (slotKey: string) => {
    const slot = getFarmSlotByKey(slotKey);
    if (!slot || currentMapRef.current !== 'farm' || menuOpenRef.current || setupMode !== 'none') return;
    if (!slot.girlId) {
      setActiveFarmSlotKey(slotKey);
      setFarmSlotConfirmChoice('yes');
      setFarmSlotInteractionStage('confirmPlant');
      playFixSound();
      return;
    }
    const harvestInfo = getFarmGirlHarvestInfo(slot.girlId);
    if (!harvestInfo.canHarvest || companionGirlId === slot.girlId) return;
    setActiveFarmSlotKey(slotKey);
    setFarmSlotConfirmChoice('yes');
    setFarmSlotInteractionStage('confirmHarvest');
    playFixSound();
  };

  useEffect(() => {
    if (currentMap !== 'farm' || setupMode !== 'none' || menuOpen || farmSlotInteractionStage !== null || isWalking || movementLockedRef.current) {
      setNearbyFarmSlotKey(null);
      return;
    }
    const playerPos = posRef.current;
    const candidates = farmFieldSlots.flatMap(slot => {
      const slotKey = `${slot.fieldId}_${slot.slotIndex}`;
      const basePoint = getFarmFieldSlotPoint(slot);
      const placement = slot.girlId
        ? FARM_SEED_SLOT_PLACEMENTS[slotKey] ?? { offsetX: 0, offsetY: 0 }
        : farmPlantButtonPlacements[slotKey] ?? { offsetX: 0, offsetY: 0 };
      const dx = playerPos.x - (basePoint.x + placement.offsetX);
      const dy = playerPos.y - (basePoint.y + placement.offsetY);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const canHarvest = slot.girlId
        ? getFarmGirlHarvestInfo(slot.girlId).canHarvest && companionGirlId !== slot.girlId
        : false;
      return distance <= 105 && (!slot.girlId || canHarvest) ? [{ slotKey, distance }] : [];
    }).sort((left, right) => left.distance - right.distance);
    const nextSlotKey = candidates[0]?.slotKey ?? null;
    setNearbyFarmSlotKey(nextSlotKey);
    if (!nextSlotKey) {
      farmSlotInteractionBlockedRef.current = null;
      return;
    }
    if (farmSlotInteractionBlockedRef.current === nextSlotKey) return;
    const timer = window.setTimeout(() => openFarmSlotInteraction(nextSlotKey), 450);
    return () => window.clearTimeout(timer);
  }, [pos, isWalking, currentMap, setupMode, menuOpen, farmSlotInteractionStage, farmFieldSlots, farmGirls, companionGirlId, turn, farmPlantButtonPlacements]);

  useEffect(() => {
    if (!farmSlotInteractionStage) return;
    const handleFarmSlotInteractionKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeFarmSlotInteraction();
        return;
      }
      if (farmSlotInteractionStage === 'selectSeed') {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          if (nearbyOwnedSeedOptions.length === 0) return;
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          setSelectedNearbySeedIndex(index => getNextPlantableNearbySeedIndex(index, direction));
          playCursorSound();
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          const selectedSeed = nearbyOwnedSeedOptions[selectedNearbySeedIndex];
          if (!selectedSeed || selectedSeed.isPlanted) return;
          setPendingNearbySeedId(selectedSeed.seedId);
          setFarmSlotConfirmChoice('yes');
          setFarmSlotInteractionStage('confirmSeed');
          playFixSound();
        }
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setFarmSlotConfirmChoice(choice => choice === 'yes' ? 'no' : 'yes');
        playCursorSound();
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (farmSlotConfirmChoice === 'no') {
        closeFarmSlotInteraction();
        return;
      }
      const slot = getFarmSlotByKey(activeFarmSlotKey);
      if (!slot) {
        closeFarmSlotInteraction();
        return;
      }
      if (farmSlotInteractionStage === 'confirmHarvest' && slot.girlId) {
        harvestFarmGirl(slot.girlId);
        closeFarmSlotInteraction();
      } else if (farmSlotInteractionStage === 'confirmPlant') {
        setSelectedNearbySeedIndex(getFirstPlantableNearbySeedIndex());
        setFarmSlotInteractionStage('selectSeed');
      } else if (farmSlotInteractionStage === 'confirmSeed' && pendingNearbySeedId) {
        plantGirlSeedToSlot(pendingNearbySeedId, slot.fieldId, slot.slotIndex);
        closeFarmSlotInteraction();
      }
    };
    window.addEventListener('keydown', handleFarmSlotInteractionKeyDown, true);
    return () => window.removeEventListener('keydown', handleFarmSlotInteractionKeyDown, true);
  }, [farmSlotInteractionStage, farmSlotConfirmChoice, activeFarmSlotKey, pendingNearbySeedId, selectedNearbySeedIndex, nearbyOwnedSeedOptions]);

  useEffect(() => {
    if (!nearbyFarmSlotKey || farmSlotInteractionStage || menuOpen || setupMode !== 'none') return;
    const handleNearbyFarmSlotKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key.toLowerCase() !== 'h') return;
      event.preventDefault();
      event.stopPropagation();
      openFarmSlotInteraction(nearbyFarmSlotKey);
    };
    window.addEventListener('keydown', handleNearbyFarmSlotKeyDown, true);
    return () => window.removeEventListener('keydown', handleNearbyFarmSlotKeyDown, true);
  }, [nearbyFarmSlotKey, farmSlotInteractionStage, menuOpen, setupMode, farmFieldSlots, farmGirls, companionGirlId, turn]);
  useEffect(() => {
    if (bootMode !== 'playing') return;
    if (gameMode !== 'story') return;
    if (currentRepaymentCycleIndex <= interestRateCycleIndex) return;
    setCurrentWeeklyInterestRate(createWeeklyInterestRate(difficulty, farmCredit, missedRepaymentCount));
    setInterestRateCycleIndex(currentRepaymentCycleIndex);
  }, [bootMode, currentRepaymentCycleIndex, difficulty, farmCredit, gameMode, interestRateCycleIndex, missedRepaymentCount]);
  useEffect(() => {
    if (bootMode !== 'playing') return;
    if (!canLevelUpHero(heroLevel, successfulRepaymentCount, farmCredit)) return;

    setHeroLevel(level => Math.min(MAX_HERO_LEVEL, level + 1) as HeroLevel);
    setHeroSP(currentSP => grantHeroSP(currentSP));
    setDialogMessage('主人公の経験が増した！\n★が1つ輝いた！');
  }, [bootMode, farmCredit, heroLevel, successfulRepaymentCount]);
  const advanceToNextDay = (skipRepaymentEvent = false) => {
    if (
      !skipRepaymentEvent &&
      gameMode === 'story' &&
      !storyCleared &&
      timeOfDay === 'night' &&
      currentDay % repaymentCycleDays === 0
    ) {
      setRepaymentEventPending(true);
      return;
    }
    const nextDay = currentDay + 1;
    if (
      hasBeastPremonition &&
      scheduledBeastAttackDay !== null &&
      nextDay >= scheduledBeastAttackDay
    ) {
      setHasBeastPremonition(false);
      setBeastAttackPending(true);
      setDialogMessage(mountainLordAttackPending ? 'いつもと違う気配をビリビリ感じる。' : '畑の方から物音がする……');
      return;
    }

    proceedToNextDay();

    if (
      timeOfDay === 'night' &&
      !hasBeastPremonition &&
      scheduledBeastAttackDay === null &&
      Math.random() < BEAST_PREMONITION_RATE_BY_DIFFICULTY[difficulty]
    ) {
      const isMountainLordAttack = difficulty === 'hard' && Math.random() < 0.8;
      setHasBeastPremonition(true);
      setPremonitionDay(currentDay);
      setScheduledBeastAttackDay(getScheduledBeastAttackDay(difficulty, currentDay));
      setMountainLordAttackPending(isMountainLordAttack);
      setDialogMessage(isMountainLordAttack ? '畑の向こうから、重い足音が響いてくる……' : 'なんだか嫌な予感がする……');
    }
  };
  const skillAdjustedWeeklyInterestRate = getSkillAdjustedWeeklyInterestRate(currentWeeklyInterestRate);
  const currentRepaymentInterest = Math.round(debtAmount * (skillAdjustedWeeklyInterestRate / 100));
  const currentMinimumRepayment = Math.min(MINIMUM_REPAYMENT_BY_DIFFICULTY[difficulty], debtAmount);
  const nextScheduledRepayment = currentMinimumRepayment + currentRepaymentInterest;
  const finishRepaymentEvent = (nextFarmCredit: number, nextMissedRepaymentCount: number, message: string) => {
    setFarmCredit(Math.max(0, Math.min(100, nextFarmCredit)));
    setMissedRepaymentCount(Math.max(0, nextMissedRepaymentCount));
    setCurrentWeeklyInterestRate(createWeeklyInterestRate(difficulty, Math.max(0, Math.min(100, nextFarmCredit)), Math.max(0, nextMissedRepaymentCount)));
    setInterestRateCycleIndex(Math.floor(currentDay / repaymentCycleDays));
    setRepaymentEventPending(false);
    setDialogMessage(message);
    advanceToNextDay(true);
  };
  const handleMinimumRepayment = () => {
    const payment = currentMinimumRepayment + currentRepaymentInterest;
    if (gold < payment) {
      setDialogMessage('所持金が足りません');
      return;
    }
    const nextDebt = Math.max(0, debtAmount - currentMinimumRepayment);
    setGold(value => value - payment);
    setDebtAmount(nextDebt);
    setSuccessfulRepaymentCount(value => value + 1);
    if (nextDebt <= 0) {
      setStoryCleared(true);
      unlockEndlessNurseryMode();
    }
    finishRepaymentEvent(farmCredit + 5, missedRepaymentCount, nextDebt <= 0 ? '借金を完済した！' : '最低返済を完了した。');
  };
  const handleAdditionalRepayment = () => {
    const principalPayment = Math.min(debtAmount, currentMinimumRepayment + selectedAdditionalRepayment);
    const payment = principalPayment + currentRepaymentInterest;
    if (gold < payment) {
      setDialogMessage('所持金が足りません');
      return;
    }
    const nextDebt = Math.max(0, debtAmount - principalPayment);
    setGold(value => value - payment);
    setDebtAmount(nextDebt);
    setSuccessfulRepaymentCount(value => value + 1);
    if (nextDebt <= 0) {
      setStoryCleared(true);
      unlockEndlessNurseryMode();
    }
    finishRepaymentEvent(farmCredit + 8, missedRepaymentCount, nextDebt <= 0 ? '借金を完済した！' : '多めの返済を完了した。');
  };
  const handleSkipRepayment = () => {
    finishRepaymentEvent(farmCredit - 10, missedRepaymentCount + 1, '今回は返済を見送った。');
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
  const careForFarmGirl = (girlId: string) => {
    const targetGirl = farmGirls.find(girl => girl.girlId === girlId);
    if (!targetGirl || targetGirl.condition !== 'affected') return;
    if (!hasHeroSkill('special_life_understanding') && currentAP <= 0) {
      setDialogMessage(timeOfDay === 'night' ? EXHAUSTED_ACTION_MESSAGE : '疲れていて看病できない');
      return;
    }

    if (!hasHeroSkill('special_life_understanding')) consumeAPForAction();
    setFarmGirls(previous => previous.map(girl => (
      girl.girlId === girlId
        ? {
          ...girl,
          condition: 'normal',
          conditionDay: null,
          conditionSource: null,
          trust: Math.min(100, girl.trust + 2),
        }
        : girl
    )));
    const girlName = GIRL_DATA.find(girl => girl.id === girlId)?.girlName ?? girlId;
    setDialogMessage(`${girlName}を看病した。\n少し安心したようだ。`);
  };
  const tryHybridCultivation = (girlId: string) => {
    const targetGirl = farmGirls.find(girl => girl.girlId === girlId);
    const girlName = GIRL_DATA.find(girl => girl.id === girlId)?.girlName ?? girlId;
    if (!hasHeroSkill('special_hybrid_cultivation')) {
      setDialogMessage('混合育成の知識がまだ足りません。');
      return;
    }
    if (!targetGirl || targetGirl.condition !== 'affected') {
      setDialogMessage('混合育成はNTR後の苗娘にだけ試せます。');
      return;
    }
    if (targetGirl.hybridAdapted) {
      setDialogMessage(`${girlName}はすでに混合育成に適応しています。\n${hasHeroSkill('special_hybrid_blessing') ? '交雑の恵み：作物売値 +15%、品質最低値60' : '交雑の恵みを取得すると追加効果が発動します。'}`);
      return;
    }
    const successRate = getHybridCultivationSuccessRate();
    const success = Math.random() < successRate;
    if (success) {
      setFarmGirls(previous => previous.map(girl => (
        girl.girlId === girlId
          ? {
            ...girl,
            hybridAdapted: true,
            quality: hasHeroSkill('special_hybrid_blessing') ? Math.max(girl.quality, 60) : girl.quality,
          }
          : girl
      )));
      setDialogMessage(`${girlName}の混合育成に成功した。\n成功率 ${Math.round(successRate * 100)}% / 交雑適性を獲得しました。\n${hasHeroSkill('special_hybrid_blessing') ? '交雑の恵み：作物売値 +15%、品質最低値60' : '交雑の恵みを取得すると追加効果が発動します。'}`);
      return;
    }
    setDialogMessage(`${girlName}の混合育成はまだ安定しなかった。\n成功率 ${Math.round(successRate * 100)}% / もう一度試せます。`);
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
      ...createOptions('苗娘植え後会話', SEED_AFTER_PLANT_TUTORIAL_STEPS),
      ...createOptions('のこぎり会話', SAW_CRAFT_TUTORIAL_STEPS),
      ...createOptions('つるはし会話', PICKAXE_CRAFT_TUTORIAL_STEPS),
      ...createOptions('小屋会話', SAW_CRAFT_SHED_TUTORIAL_STEPS),
      ...createOptions('採取共通会話', GATHERING_TUTORIAL_COMMON_STEPS),
      ...createOptions('伐採会話', GATHERING_TUTORIAL_BRANCH_STEPS.logging),
      ...createOptions('採掘会話', GATHERING_TUTORIAL_BRANCH_STEPS.mining),
      ...createOptions('採掘説明', MINING_TUTORIAL_STEPS),
    ];
  }, [debugDialogueOverrides]);
  const isKurumiShopUnlocked = kurumiIntroCompletedDay !== null && currentDay > kurumiIntroCompletedDay;
  const getIsNearFishingPoint = () => {
    const { x, y } = posRef.current;
    const minGridX = Math.floor((x - 15) / TILE_SIZE);
    const maxGridX = Math.floor((x + 15) / TILE_SIZE);
    const minGridY = Math.floor((y - 10) / TILE_SIZE);
    const maxGridY = Math.floor(y / TILE_SIZE);
    for (let gx = minGridX; gx <= maxGridX; gx += 1) {
      for (let gy = minGridY; gy <= maxGridY; gy += 1) {
        if (fishingTiles[`${currentMap}_${gx},${gy}`]) return true;
      }
    }
    return false;
  };
  const getNearbyMiningPointIdForHud = () => {
    const { x, y } = posRef.current;
    const canUsePostMiningTutorialPoint = (
      gatheringTutorialCompleted &&
      gatheringTutorialChoice === 'mining' &&
      !miningTutorialCompleted
    );
    if (
      canUsePostMiningTutorialPoint &&
      currentMap === POST_MINING_TUTORIAL_POINT.map &&
      x + 18 >= POST_MINING_TUTORIAL_POINT.x &&
      x - 18 <= POST_MINING_TUTORIAL_POINT.x + POST_MINING_TUTORIAL_POINT.w &&
      y >= POST_MINING_TUTORIAL_POINT.y &&
      y - 34 <= POST_MINING_TUTORIAL_POINT.y + POST_MINING_TUTORIAL_POINT.h
    ) {
      return POST_MINING_TUTORIAL_POINT.id;
    }
    const minGridX = Math.floor((x - 15) / TILE_SIZE);
    const maxGridX = Math.floor((x + 15) / TILE_SIZE);
    const minGridY = Math.floor((y - 10) / TILE_SIZE);
    const maxGridY = Math.floor(y / TILE_SIZE);
    for (let gx = minGridX; gx <= maxGridX; gx += 1) {
      for (let gy = minGridY; gy <= maxGridY; gy += 1) {
        const pointId = `${currentMap}_${gx},${gy}`;
        if (miningTiles[pointId]) return pointId;
      }
    }
    return null;
  };
  const getIsNearLoggingTileForHud = () => {
    const { x, y } = posRef.current;
    const minGridX = Math.floor((x - 15) / TILE_SIZE);
    const maxGridX = Math.floor((x + 15) / TILE_SIZE);
    const minGridY = Math.floor((y - 10) / TILE_SIZE);
    const maxGridY = Math.floor(y / TILE_SIZE);
    for (let gx = minGridX; gx <= maxGridX; gx += 1) {
      for (let gy = minGridY; gy <= maxGridY; gy += 1) {
        if (loggingTiles[`${currentMap}_${gx},${gy}`]) return true;
      }
    }
    return false;
  };
  const hasFishingRodEquippedForHud = Boolean(equippedItems['主人公-slot1'] && equippedItems['主人公-slot1'].includes('釣竿'));
  const hasPickaxeEquippedForHud = hasEquippedPickaxe(equippedItems);
  const hasSawEquippedForHud = ['主人公-slot2', '主人公-slot3'].some(slotId => (
    equippedItems[slotId]?.includes('のこぎり')
  ));
  const hasFishingRodOwnedForHud = ITEM_MENU_NORMAL_ITEMS['装備品'].some(itemName => (
    isFishingRodName(itemName) && (inventoryCounts[itemName] ?? 0) > 0
  ));
  const hasPickaxeOwnedForHud = ITEM_MENU_NORMAL_ITEMS['装備品'].some(itemName => (
    isPickaxeName(itemName) && (inventoryCounts[itemName] ?? 0) > 0
  ));
  const hasSawOwnedForHud = ITEM_MENU_NORMAL_ITEMS['装備品'].some(itemName => (
    isSawName(itemName) && (inventoryCounts[itemName] ?? 0) > 0
  ));
  const hasHarvestableFarmGirl = farmFieldSlots.some(slot => (
    slot.girlId !== null &&
    companionGirlId !== slot.girlId &&
    getFarmGirlHarvestInfo(slot.girlId).canHarvest
  ));
  const hasSeedlingCareRemaining = farmGirls.some(girl => {
    if (girl.state !== 'growing') return false;
    const isSameDay = girl.careDay === currentDay;
    return !isSameDay || girl.caressCount < 1 || girl.fingerCount < 1 || girl.fertilizeCount < 1;
  });
  const hasPlantableSeedAndField = (
    getPlantableFarmFieldSlots().length > 0 &&
    ownedGirlSeeds.some(seedId => {
      const seed = GIRL_SEED_ACQUISITION_DATA.find(entry => entry.seedId === seedId);
      return seed && !isGirlPlantedInFarmField(seed.girlId);
    })
  );
  const hasSellableShopItem = isKurumiShopUnlocked && shopItemsForDisplay.some(item => item.type === '売る' && item.stock > 0);
  const hasUnlockableHeroSkill = HERO_SKILL_DATA.some(skill => canUnlockHeroSkill(skill.id));
  const hasNewFarmGirlCard = farmGirls.some(girl => girl.state === 'appeared' && !girl.cardRevealed);
  const hasNewRepaymentShopItem = successfulRepaymentCount > 0 && BATTLE_CONSUMABLE_ITEMS.some(item => (
    item.unlockRepaymentCount === successfulRepaymentCount &&
    shopItemsForDisplay.some(shopItem => shopItem.type === '買う' && shopItem.name === item.name)
  ));
  const supplementalHudNotice = (() => {
    if (bootMode !== 'playing' || prologueOpen) return null;
    if (!isEndlessNurseryMode() && daysUntilRepayment <= 2 && gold < nextScheduledRepayment) return '返済資金が不足中';
    if (!isEndlessNurseryMode() && daysUntilRepayment === 1) return `明日返済：予定 ¥${nextScheduledRepayment.toLocaleString()}`;
    if (timeOfDay === 'night' && currentAP <= 0 && currentMap !== 'house') return '自宅のベッドで休めます';
    if (timeOfDay === 'night' && currentAP <= 0) return '今日はもう休もう';
    if (currentAP > 0 && currentAP <= 1 && timeOfDay !== 'night') return '残りAPに注意';
    if (hasHarvestableFarmGirl) return '収穫できる娘あり';
    if (currentAP > 0 && hasSeedlingCareRemaining) return '苗娘のお世話が残っています';
    if (hasPlantableSeedAndField) return '空き畑に苗を植えられます';
    if (getIsNearFishingPoint() && hasFishingRodOwnedForHud && !hasFishingRodEquippedForHud) return '釣竿を装備すると釣りできます';
    if (getNearbyMiningPointIdForHud() && hasPickaxeOwnedForHud && !hasPickaxeEquippedForHud) return 'つるはしを装備すると採掘できます';
    if (getIsNearLoggingTileForHud() && hasSawOwnedForHud && !hasSawEquippedForHud) return 'のこぎりを装備すると伐採できます';
    if (hasBeastPremonition) return mountainLordAttackPending ? '巨大な気配に注意' : '畑を警戒中';
    if (hasSellableShopItem) return '売れる品があります';
    if (hasUnlockableHeroSkill) return 'SPでスキル取得できます';
    if (hasNewFarmGirlCard) return '新しい娘カードを確認できます';
    if (hasNewRepaymentShopItem) return 'くるみ商店に新商品入荷';
    return null;
  })();
  const hasAskedAllKurumiIntroTopics = KURUMI_INTRO_TOPIC_IDS.every(id => kurumiIntroAskedTopics.includes(id));
  const isOpeningWalkObjectiveActive = (
    bootMode === 'playing' &&
    currentDay === 1 &&
    kurumiIntroCompletedDay === null &&
    nextObjective === OPENING_WALK_OBJECTIVE &&
    openingMapTransitionCount < OPENING_MAP_TRANSITIONS_BEFORE_KURUMI
  );
  const shouldShowFishingTutorialKurumi = bootMode === 'playing' && currentMap === 'farm' && currentDay === 2 && !fishingTutorialCompleted;
  const shouldOfferSeedAfterPlantTutorial = farmFieldSlots.some(slot => slot.girlId && slot.state === 'growing') && !seedAfterPlantTutorialCompleted;
  const currentFishingTutorialStep = FISHING_TUTORIAL_STEPS[fishingTutorialStepIndex] ?? FISHING_TUTORIAL_STEPS[0];
  const currentFishingTutorialEndingStep = FISHING_TUTORIAL_END_STEPS[fishingTutorialEndingStepIndex] ?? FISHING_TUTORIAL_END_STEPS[0];
  const currentSeedAfterPlantTutorialStep = SEED_AFTER_PLANT_TUTORIAL_STEPS[seedAfterPlantTutorialStepIndex] ?? SEED_AFTER_PLANT_TUTORIAL_STEPS[0];
  const currentLoggingTutorialStep = LOGGING_TUTORIAL_STEPS[loggingTutorialStepIndex] ?? LOGGING_TUTORIAL_STEPS[0];
  const currentMiningTutorialStep = MINING_TUTORIAL_STEPS[miningTutorialStepIndex] ?? MINING_TUTORIAL_STEPS[0];
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
  const hudObjective = useMemo(() => {
    if (bootMode !== 'playing' || prologueOpen) return null;
    if (isOpeningWalkObjectiveActive) return OPENING_WALK_OBJECTIVE;
    const hasUnplantedStarterSeed = INITIAL_OWNED_GIRL_SEEDS.some(seedId => {
      const seed = GIRL_SEED_ACQUISITION_DATA.find(entry => entry.seedId === seedId);
      return seed && ownedGirlSeeds.includes(seedId) && !farmFieldSlots.some(slot => slot.girlId === seed.girlId);
    });
    if (kurumiIntroOpen) return hasAskedAllKurumiIntroTopics ? 'くるみとの会話を終えよう！' : 'くるみに気になることを一通り聞こう！';
    if (seedPlantTutorialOpen) return 'くるみから苗娘の植え方を教わろう！';
    if (seedAfterPlantTutorialOpen) return 'くるみから畑の見方を教わろう！';
    if (fishingTutorialOpen) return 'くるみの釣り説明を聞こう！';
    if (fishingMiniGameOpen && isFishingTutorialRun) return '釣りの練習を成功させよう！';
    if (fishingTutorialEndingOpen) return 'くるみの話を最後まで聞こう！';
    if (sawCraftTutorialIntroOpen) return 'くるみからクラフトの説明を聞こう！';
    if (sawCraftTutorialReady) return 'クラフト小屋でくるみに話しかけよう！';
    if (sawCraftTutorialShedDialogueOpen) return '小屋でくるみの説明を聞こう！';
    if (sawCraftTutorialWorkbenchReady) return 'クラフト台で道具を作ろう！';
    if (craftMiniGameOpen) return 'クラフトを成功させよう！';
    if (gatheringTutorialOpen) return 'くるみから採取のコツを聞こう！';
    if (loggingTutorialOpen) return '伐採の説明を聞こう！';
    if (loggingMiniGameOpen && isLoggingTutorialRun) return '伐採の練習を成功させよう！';
    if (miningTutorialOpen) return '採掘の説明を聞こう！';
    if (miningMiniGameOpen) return '採掘リズムに集中しよう！';
    if (kurumiIntroCompletedDay === null) return KURUMI_INTRO_OBJECTIVE;
    if (hasReceivedKurumiStarterSeeds && hasUnplantedStarterSeed) return STARTER_SEED_OBJECTIVE;
    if (shouldOfferSeedAfterPlantTutorial) return 'くるみに植えた苗娘の様子を聞こう！';
    if (currentDay <= kurumiIntroCompletedDay) return '明日、橋の近くでくるみに釣りを教わろう！';
    if (!fishingTutorialCompleted) return '橋の近くにいるくるみに釣りを教わろう！';
    if (!sawCraftTutorialCompleted) return 'くるみからレシピを買って道具を作ろう！';
    if (!gatheringTutorialCompleted) return 'くるみに採取のコツを聞こう！';
    if (!loggingTutorialCompleted && gatheringTutorialChoice === 'logging') return '伐採できる木を探して、のこぎりを使ってみよう！';
    if (!miningTutorialCompleted && gatheringTutorialChoice === 'mining') return 'ポストの下にある岩を調べて採掘してみよう！';
    return '畑を育てて返済資金を稼ごう！';
  }, [
    bootMode,
    prologueOpen,
    isOpeningWalkObjectiveActive,
    kurumiIntroOpen,
    hasAskedAllKurumiIntroTopics,
    fishingTutorialOpen,
    fishingMiniGameOpen,
    isFishingTutorialRun,
    fishingTutorialEndingOpen,
    sawCraftTutorialIntroOpen,
    sawCraftTutorialReady,
    sawCraftTutorialShedDialogueOpen,
    sawCraftTutorialWorkbenchReady,
    craftMiniGameOpen,
    gatheringTutorialOpen,
    loggingTutorialOpen,
    loggingMiniGameOpen,
    isLoggingTutorialRun,
    miningTutorialOpen,
    miningMiniGameOpen,
    kurumiIntroCompletedDay,
    hasReceivedKurumiStarterSeeds,
    seedPlantTutorialOpen,
    ownedGirlSeeds,
    farmFieldSlots,
    currentDay,
    fishingTutorialCompleted,
    sawCraftTutorialCompleted,
    gatheringTutorialCompleted,
    loggingTutorialCompleted,
    miningTutorialCompleted,
    gatheringTutorialChoice,
  ]);
  const activeAutoEventMessages = activeAutoEventSpot
     ? isPostDebtNoticeEvent(activeAutoEventSpot) && !activePostDebtNoticeFirstView
        ? [POST_DEBT_NOTICE_REPEAT_TEXT]
        : activeAutoEventSpot.texts?.length
          ? activeAutoEventSpot.texts
          : [activeAutoEventSpot.text || activeAutoEventSpot.label || 'イベントが発生しました。']
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

  const renderSeedAfterPlantTutorialVisual = () => {
    const plantedSlot = farmFieldSlots.find(slot => slot.girlId && slot.state === 'growing') ?? farmFieldSlots.find(slot => slot.girlId);
    const girlId = plantedSlot?.girlId ?? INITIAL_OWNED_GIRL_SEEDS
      .map(seedId => GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === seedId)?.girlId)
      .find(Boolean) ?? null;
    const seed = GIRL_SEED_ACQUISITION_DATA.find(entry => entry.girlId === girlId);
    const crop = FARM_GIRL_CROP_DATA.find(entry => entry.girlId === girlId);
    const farmGirl = farmGirls.find(entry => entry.girlId === girlId);
    const growthProgress = farmGirl?.growthProgress ?? 0;
    const growthDays = crop?.growthDays ?? 2;
    const fieldLabel = plantedSlot ? `${getFarmFieldLabel(plantedSlot.fieldId)} ${plantedSlot.slotIndex}` : '畑';
    const isGrowthDaysStep = currentSeedAfterPlantTutorialStep.id === 'growth_days';
    const isCareStep = currentSeedAfterPlantTutorialStep.id === 'care';

    return (
      <div className="absolute inset-x-7 bottom-10 h-[440px] overflow-hidden rounded-xl border-2 border-[#ffd166]/70 bg-[linear-gradient(180deg,rgba(73,44,16,0.96),rgba(26,16,13,0.98))] shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_58%,rgba(132,86,32,0.75),rgba(37,24,15,0.96)_68%)]" />
        <div className="absolute left-1/2 top-[54%] h-[230px] w-[360px] -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] rounded-[45%] border-4 border-[#7c4a1f] bg-[repeating-linear-gradient(90deg,#3f2714_0_24px,#5d3719_24px_48px)] shadow-[inset_0_10px_25px_rgba(0,0,0,0.55),0_20px_30px_rgba(0,0,0,0.45)]" />
        <div className="absolute left-1/2 top-[48%] h-[132px] w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-[#ffd166] bg-[#1a100d]/92 p-2 shadow-[0_0_24px_rgba(255,209,102,0.5)]">
          <img src="/img/nae.png" alt={seed?.seedName ?? '苗娘'} className="h-full w-full object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.55)]" />
        </div>
        <div className="absolute inset-x-5 top-5 rounded-xl border border-[#ffd166]/60 bg-[#1a100d]/90 px-4 py-3 text-center shadow-xl">
          <div className="text-sm font-black tracking-[0.18em] text-[#ffd166]">PLANTED SEED</div>
          <div className="mt-1 text-2xl font-black text-[#fff7dc]">{seed?.seedName ?? '苗娘'} / {fieldLabel}</div>
        </div>
        <div className={`absolute left-7 right-7 bottom-6 grid gap-3 ${isCareStep ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className={`rounded-lg border px-3 py-3 text-center font-black shadow-lg ${isGrowthDaysStep ? 'scale-105 border-[#fff3b0] bg-[#9a5a1d] text-white' : 'border-[#ffd166]/60 bg-black/55 text-[#ffe8a3]'}`}>
            <div className="text-xs tracking-[0.14em] text-[#ffd166]">成長中</div>
            <div className="mt-1 text-2xl">{growthProgress}/{growthDays}日</div>
          </div>
          <div className={`rounded-lg border px-3 py-3 text-center font-black shadow-lg ${!isGrowthDaysStep && !isCareStep ? 'scale-105 border-[#fff3b0] bg-[#4a5823] text-white' : 'border-[#ffd166]/60 bg-black/55 text-[#ffe8a3]'}`}>
            <div className="text-xs tracking-[0.14em] text-[#ffd166]">品質</div>
            <div className="mt-1 text-2xl">{farmGirl?.quality ?? 30}</div>
          </div>
          {isCareStep && (
            <div className="scale-105 rounded-lg border border-[#fff3b0] bg-[#5a3010] px-3 py-3 text-center font-black text-white shadow-lg">
              <div className="text-xs tracking-[0.14em] text-[#ffd166]">お世話</div>
              <div className="mt-1 text-xl">収穫まで可</div>
            </div>
          )}
        </div>
      </div>
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

  const renderMiningTutorialVisual = () => {
    const isTimingStep = currentMiningTutorialStep.id === 'timing';
    const isRewardStep = currentMiningTutorialStep.id === 'reward';
    return (
      <div className="absolute inset-x-7 bottom-10 h-[440px] overflow-hidden rounded-xl border-2 border-[#a5b4fc]/65 bg-black shadow-[inset_0_0_28px_rgba(0,0,0,0.65)]">
        <img src="/img/saikutu1.jpg" alt="採掘の説明" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-black/15" />
        <div className="absolute inset-x-5 top-5 rounded-xl border border-[#a5b4fc]/55 bg-[#111827]/88 px-4 py-3">
          <div className="text-center text-sm font-black tracking-[0.18em] text-[#a5b4fc]">MINING RHYTHM</div>
          <div className="mt-2 text-center text-xl font-black text-[#fdf6e3]">
            {isRewardStep ? '成功すると鉱石ゲット！' : isTimingStep ? 'ラインで方向キー！' : '矢印が上から落ちてくる！'}
          </div>
        </div>
        <div className="absolute inset-x-8 top-[46%] h-2 -translate-y-1/2 border-y border-[#fef08a] bg-[#eab308]/75 shadow-[0_0_18px_rgba(253,224,71,0.85)]" />
        <div className="absolute left-8 top-[42%] rounded bg-black/65 px-2 py-1 text-xs font-black text-[#fef08a]">判定ライン</div>
        {!isRewardStep && (
          <>
            <img
              src="/img/arrow down.png"
              alt="下方向"
              className={`absolute left-1/2 h-24 w-24 -translate-x-1/2 object-contain drop-shadow-[0_0_14px_rgba(165,180,252,0.9)] ${isTimingStep ? 'top-[34%]' : 'top-[16%]'}`}
            />
            <div className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-[#a5b4fc]/70 bg-black/70 px-5 py-2 text-sm font-black text-[#dbeafe]">
              {isTimingStep ? '重なった瞬間に ↓ キー！' : '矢印と同じ方向キーを準備！'}
            </div>
          </>
        )}
        {isRewardStep && (
          <div className="absolute inset-x-5 bottom-5 rounded-xl border border-[#ffd166]/60 bg-[#2d1b15]/92 p-4">
            <div className="mb-3 text-center text-2xl font-black text-[#ffd166]">GOOD MINING!</div>
            <div className="grid grid-cols-2 gap-2 text-sm font-black">
              <div className="rounded bg-black/35 px-3 py-2 text-[#cbd5e1]">品質</div>
              <div className="rounded bg-black/35 px-3 py-2 text-right text-[#ffd166]">120%</div>
              <div className="rounded bg-black/35 px-3 py-2 text-[#cbd5e1]">売却額</div>
              <div className="rounded bg-black/35 px-3 py-2 text-right text-[#fef08a]">アップ</div>
            </div>
          </div>
        )}
      </div>
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
        if (shopNoticeTimerRef.current !== null) {
           window.clearTimeout(shopNoticeTimerRef.current);
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
        if (seedPlantTutorialVoiceRef.current) {
           seedPlantTutorialVoiceRef.current.pause();
           seedPlantTutorialVoiceRef.current = null;
        }
        if (seedAfterPlantTutorialVoiceRef.current) {
           seedAfterPlantTutorialVoiceRef.current.pause();
           seedAfterPlantTutorialVoiceRef.current = null;
        }
        if (titleRandomVoiceRef.current) {
           titleRandomVoiceRef.current.pause();
           titleRandomVoiceRef.current = null;
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
     const needsGatheringTutorialGuide = !gatheringTutorialCompleted || !loggingTutorialCompleted || !miningTutorialCompleted;
     if (shouldOfferSeedAfterPlantTutorial) {
        openSeedAfterPlantTutorial();
        return;
     }
     if (isGatheringTutorialReady && needsGatheringTutorialGuide) {
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
        grantKurumiStarterSeeds();
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
  const closeSeedPlantTutorial = () => {
     playFixSound();
     stopSeedPlantTutorialVoice();
     setSeedPlantTutorialOpen(false);
     setSeedPlantTutorialStepIndex(0);
     setDialogMessage(STARTER_SEED_OBJECTIVE);
  };
  const advanceSeedPlantTutorial = () => {
     playFixSound();
     if (seedPlantTutorialStepIndex >= SEED_PLANT_TUTORIAL_STEPS.length - 1) {
        closeSeedPlantTutorial();
        return;
     }
     const nextStepIndex = Math.min(SEED_PLANT_TUTORIAL_STEPS.length - 1, seedPlantTutorialStepIndex + 1);
     setSeedPlantTutorialStepIndex(nextStepIndex);
     playSeedPlantTutorialVoice(nextStepIndex);
  };
  const openSeedAfterPlantTutorial = () => {
     stopSeedPlantTutorialVoice();
     stopSeedAfterPlantTutorialVoice();
     setSeedAfterPlantTutorialStepIndex(0);
     setSeedAfterPlantTutorialOpen(true);
     playSeedAfterPlantTutorialVoice(0);
     setDialogMessage('くるみが植えた苗娘の様子を説明します。');
  };
  const closeSeedAfterPlantTutorial = (withSound = true) => {
     if (withSound) playFixSound();
     stopSeedAfterPlantTutorialVoice();
     setSeedAfterPlantTutorialOpen(false);
     setSeedAfterPlantTutorialStepIndex(0);
     setSeedAfterPlantTutorialCompleted(true);
     setDialogMessage('明日また苗娘の様子を見に行こう。');
  };
  const advanceSeedAfterPlantTutorial = () => {
     playFixSound();
     const nextStepIndex = seedAfterPlantTutorialStepIndex + 1;
     if (nextStepIndex >= SEED_AFTER_PLANT_TUTORIAL_STEPS.length) {
        closeSeedAfterPlantTutorial(false);
        return;
     }
     setSeedAfterPlantTutorialStepIndex(nextStepIndex);
     playSeedAfterPlantTutorialVoice(nextStepIndex);
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
    setLoggingResultRewards([]);
    setLoggingResultSawName('');
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

  const openMiningTutorial = () => {
    playFixSound();
    stopSawCraftTutorialVoice();
    setMiningTutorialOpen(true);
    setMiningTutorialStepIndex(0);
    setSelectedMiningTutorialAction('next');
    setMenuOpen(false);
    menuOpenRef.current = false;
    clickTargetRef.current = null;
    setClickTargetMarker(null);
    sawCraftTutorialVoiceRef.current = playVoiceSound(MINING_TUTORIAL_STEPS[0].voiceSrc);
  };

  const startMiningTutorialChallenge = () => {
    playFixSound();
    stopSawCraftTutorialVoice();
    setMiningTutorialOpen(false);
    setSelectedMiningTutorialAction('next');
    startMiningMiniGame(POST_MINING_TUTORIAL_POINT.id, { skipTutorial: true });
  };

  const advanceMiningTutorial = () => {
    playFixSound();
    if (miningTutorialStepIndex >= MINING_TUTORIAL_STEPS.length - 1) {
      startMiningTutorialChallenge();
      return;
    }
    const nextStepIndex = miningTutorialStepIndex + 1;
    stopSawCraftTutorialVoice();
    setMiningTutorialStepIndex(nextStepIndex);
    sawCraftTutorialVoiceRef.current = playVoiceSound(MINING_TUTORIAL_STEPS[nextStepIndex].voiceSrc);
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
    setLoggingResultRewards([]);
    setLoggingResultSawName('');
    setIsLoggingResultInputLocked(false);
    loggingPromptBlockedRef.current = true;
  };

  const grantLoggingRewards = () => {
    const rewardSaw = getHighestOwnedSaw(equippedItemsRef.current, inventoryCounts);
    const rewards = createLumberRewards(rewardSaw, LOGGING_REWARD_WOOD, Math.random, {
      rareRateMultiplier: getGatheringRareRateMultiplier(),
      minSizeFloorBonus: getGatheringMinFloorBonus(),
    });
    setLoggingResultRewards(rewards);
    setLoggingResultSawName(rewardSaw);
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
    incrementEndlessStat('totalTreesCut');
    consumeAPForAction();
  };

  const grantMiningReward = (
    pointId: string,
    ore: (typeof ORE_DATA)[number],
    weights: number[],
  ) => {
    const quantity = weights.length;
    setInventoryCounts(prev => ({ ...prev, [ore.name]: (prev[ore.name] ?? 0) + quantity }));
    setOreInventoryWeights(prev => ({ ...prev, [ore.name]: [...(prev[ore.name] ?? []), ...weights] }));
    setDepletedMiningPointIds(prev => ({ ...prev, [`${timeOfDay}_${pointId}`]: true }));
    setDialogMessage(`${ore.name}を${quantity}個採掘しました！`);
    if (pointId === POST_MINING_TUTORIAL_POINT.id) {
      setMiningTutorialCompleted(true);
    }
    incrementEndlessStat('totalOresMined', quantity);
    playFixSound();
    consumeAPForAction();
  };

  const stopMiningBgm = (resumeMainBgm = true) => {
    const miningAudio = miningBgmRef.current;
    if (miningAudio) {
      miningAudio.pause();
      miningAudio.currentTime = 0;
      miningAudio.src = '';
      miningBgmRef.current = null;
      miningBgmSourceRef.current = null;
    }
    if (resumeMainBgm && miningPausedMainBgmRef.current) {
      miningPausedMainBgmRef.current = false;
      resumeCurrentBgm();
    }
  };

  const startMiningBgm = (ore: (typeof ORE_DATA)[number], overrideSource?: string) => {
    stopMiningBgm(false);
    const mainBgm = bgmRef.current;
    miningPausedMainBgmRef.current = Boolean(mainBgm && !mainBgm.paused);
    mainBgm?.pause();

    const source = overrideSource ?? getMiningBgmSource(ore.id);
    const miningAudio = new Audio(source);
    miningAudio.preload = 'auto';
    miningAudio.loop = true;
    miningAudio.volume = Math.min(1, getEffectiveVolume(source, bgmVolume, audioGainsRef.current));
    miningBgmRef.current = miningAudio;
    miningBgmSourceRef.current = source;
    miningAudio.load();
    miningAudio.play().catch(error => {
      console.log('Mining BGM autoplay blocked', error);
    });
  };

  const ensureMiningBgmPlaying = () => {
    const miningAudio = miningBgmRef.current;
    const source = miningBgmSourceRef.current;
    if (!miningAudio || !source || !miningAudio.paused) return;
    miningAudio.volume = Math.min(1, getEffectiveVolume(source, bgmVolume, audioGainsRef.current));
    miningAudio.play().catch(error => {
      console.log('Mining BGM retry blocked', error);
    });
  };

  const playMiningSe = (type: keyof typeof MINING_SE_SOURCES) => {
    const source = MINING_SE_SOURCES[type];
    const baseAudio = miningSeAudioRefs.current[type] ?? new Audio(source);
    miningSeAudioRefs.current[type] = baseAudio;
    const audio = baseAudio.cloneNode(true) as HTMLAudioElement;
    audio.volume = Math.min(1, getEffectiveVolume(source, seVolumeRef.current, audioGainsRef.current));
    audio.play().catch(error => {
      console.log('Mining SE autoplay blocked', error);
    });
  };

  const triggerMiningImpact = (judgement: 'PERFECT' | 'GOOD' | 'BAD') => {
    playMiningSe(judgement === 'PERFECT' ? 'perfect' : judgement === 'GOOD' ? 'good' : 'bad');
    setMiningImpactJudgement(judgement);
    setMiningImpactKey(value => value + 1);
  };

  const getMiningComboImageSrc = (combo: number): string | null => {
    if (combo >= 10) return '/img/10combo.png';
    if (combo >= 5) return '/img/5combo.png';
    if (combo >= 3) return '/img/3combo.png';
    return null;
  };

  const showMiningComboEffect = (combo: number) => {
    const src = getMiningComboImageSrc(combo);
    if (!src) return;
    if (combo === 10) {
      playVoiceSound(MINING_COMBO_VOICE_SOURCES.sugoi);
    } else if (combo === 3 || combo === 5) {
      playVoiceSound(MINING_COMBO_VOICE_SOURCES.combo);
    }
    if (miningComboEffectTimerRef.current !== null) {
      window.clearTimeout(miningComboEffectTimerRef.current);
    }
    setMiningComboEffect({ id: Date.now(), src });
    miningComboEffectTimerRef.current = window.setTimeout(() => {
      setMiningComboEffect(null);
      miningComboEffectTimerRef.current = null;
    }, 900);
  };

  const showMiningSparkle = () => {
    if (miningSparkleTimerRef.current !== null) {
      window.clearTimeout(miningSparkleTimerRef.current);
    }
    setMiningSparkle({ x: 50, y: MINING_JUDGEMENT_LINE_TOP_PERCENT, id: Date.now() });
    miningSparkleTimerRef.current = window.setTimeout(() => {
      setMiningSparkle(null);
      miningSparkleTimerRef.current = null;
    }, 1200);
  };

  const createMiningNotes = (
    ore: (typeof ORE_DATA)[number],
    useRecordedRhythm = false,
    rhythmBgmSource?: string,
  ): MiningRhythmNote[] => {
    const bgmSource = rhythmBgmSource ?? getMiningBgmSource(ore.id);
    const recordedTimings = useRecordedRhythm ? (miningRhythmTimings[bgmSource] ?? []) : [];
    const hitTimings = recordedTimings.length > 0
      ? recordedTimings
      : Array.from({ length: 9 }, (_, index) => 1400 + index * getMiningRhythmIntervalMs(ore.id));
    return hitTimings.map((hitAt, index) => ({
      id: index,
      direction: getRandomMiningDirection(),
      hitAt,
      judgement: null,
    }));
  };

  const beginMiningPlaying = () => {
    miningMiniGameStartedAtRef.current = performance.now();
    setMiningElapsedMs(0);
    setMiningMiniGamePhase('playing');
  };

  const closeMiningMiniGame = () => {
    stopMiningBgm();
    if (miningComboEffectTimerRef.current !== null) {
      window.clearTimeout(miningComboEffectTimerRef.current);
      miningComboEffectTimerRef.current = null;
    }
    if (miningSparkleTimerRef.current !== null) {
      window.clearTimeout(miningSparkleTimerRef.current);
      miningSparkleTimerRef.current = null;
    }
    setMiningImpactJudgement(null);
    setMiningCombo(0);
    setMiningComboEffect(null);
    setMiningSparkle(null);
    if (miningFinishTimerRef.current !== null) {
      window.clearTimeout(miningFinishTimerRef.current);
      miningFinishTimerRef.current = null;
    }
    if (miningCountdownTimerRef.current !== null) {
      window.clearInterval(miningCountdownTimerRef.current);
      miningCountdownTimerRef.current = null;
    }
    miningMiniGameStartedAtRef.current = null;
    setMiningMiniGameOpen(false);
    setMiningCountdown(MINING_COUNTDOWN_SECONDS);
    setMiningMiniGamePointId(null);
    setMiningPreviewOre(null);
    setMiningNotes([]);
    setMiningElapsedMs(0);
    setMiningGauge(0);
    setMiningLastJudgement(null);
    setMiningResultText('');
    setMiningResultGauge(0);
    setMiningResultReward(null);
    setMiningResultFullCombo(false);
  };

  const finishMiningMiniGame = () => {
    if (!miningMiniGameOpen || miningMiniGamePhase !== 'playing') return;
    stopMiningBgm();
    const successful = miningHadGoodRef.current;
    const fullCombo = miningFullComboRef.current;
    const gauge = Math.min(fullCombo ? 100 : MINING_NON_FULL_COMBO_MAX_GAUGE, miningGaugeRef.current);
    setMiningResultGauge(gauge);
    setMiningResultFullCombo(fullCombo);
    setMiningMiniGamePhase('result');
    setMiningNotes(previous => previous.map(note => (
      note.judgement === null ? { ...note, judgement: 'MISS' } : note
    )));
    if (!successful || !miningMiniGamePointId || !miningPreviewOre) {
      setMiningResultText('採掘失敗……岩を砕ききれなかった。');
      setDialogMessage('採掘に失敗しました。');
      return;
    }
    if (fullCombo) {
      playVoiceSound(MINING_COMBO_VOICE_SOURCES.fullCombo);
    }

    const pickaxe = getEquippedPickaxe(equippedItemsRef.current);
    const rewardOre = selectOreRewardWithPerformance(pickaxe, gauge, fullCombo, getGatheringRareRateMultiplier());
    const quantity = getMiningRewardQuantity(rewardOre.id, gauge);
    const weightMultiplier = getMiningWeightMultiplier(gauge, fullCombo);
    const minWeightFloor = rewardOre.minWeight + (rewardOre.maxWeight - rewardOre.minWeight) * getGatheringMinFloorBonus();
    const rewardWeights = Array.from({ length: quantity }, () => (
      Math.max(
        1,
        Math.round(minWeightFloor),
        Math.min(Math.round(rewardOre.maxWeight * 1.3), Math.round(createOreWeight(rewardOre) * weightMultiplier)),
      )
    ));
    const estimatedSellPrice = rewardWeights.reduce((sum, weight) => sum + getOreSellPrice(rewardOre, weight), 0);
    const qualityPercent = Math.round(
      rewardWeights.reduce((sum, weight) => sum + getOreQualityPercent(rewardOre, weight), 0) / rewardWeights.length,
    );
    const rewardLabel = getOreRarityTier(rewardOre.id) === 'topRare'
      ? '希少鉱石'
      : quantity >= 3
        ? '大量'
        : quantity >= 2
          ? '多め'
          : gauge >= 50
            ? '通常'
            : '少量';
    setMiningPreviewOre(rewardOre);
    setMiningResultReward({
      oreName: rewardOre.name,
      quantity,
      qualityPercent,
      estimatedSellPrice,
    });
    playMiningSe('reward');
    grantMiningReward(miningMiniGamePointId, rewardOre, rewardWeights);
    setMiningResultText(`${rewardLabel}採掘！`);
  };

  const startMiningMiniGame = (
    pointId: string,
    options: { ignoreAP?: boolean; useRecordedRhythm?: boolean; rhythmBgmSource?: string; skipTutorial?: boolean } = {},
  ) => {
    if (!options.ignoreAP && currentAP <= 0) {
      canStartAPAction();
      return;
    }
    if (
      pointId === POST_MINING_TUTORIAL_POINT.id &&
      gatheringTutorialCompleted &&
      gatheringTutorialChoice === 'mining' &&
      !miningTutorialCompleted &&
      !options.skipTutorial
    ) {
      openMiningTutorial();
      return;
    }
    const pickaxe = getEquippedPickaxe(equippedItemsRef.current);
    const ore = selectOreReward(pickaxe);
    const rhythmBgmSource = options.rhythmBgmSource ?? getMiningBgmSource(ore.id);
    const useRecordedRhythm = options.useRecordedRhythm ?? ((miningRhythmTimings[rhythmBgmSource]?.length ?? 0) > 0);
    const notes = createMiningNotes(ore, useRecordedRhythm, rhythmBgmSource);
    miningMiniGameStartedAtRef.current = null;
    miningGaugeRef.current = 0;
    miningHadGoodRef.current = false;
    miningFullComboRef.current = true;
    miningComboRef.current = 0;
    setMiningMiniGamePointId(pointId);
    setMiningPreviewOre(ore);
    setMiningNotes(notes);
    setMiningGauge(0);
    setMiningElapsedMs(0);
    setMiningLastJudgement(null);
    setMiningResultText('');
    setMiningResultGauge(0);
    setMiningResultReward(null);
    setMiningResultFullCombo(false);
    setMiningCombo(0);
    setMiningComboEffect(null);
    setMiningSparkle(null);
    setMiningCountdown(MINING_COUNTDOWN_SECONDS);
    setMiningMiniGamePhase('countdown');
    setMiningMiniGameOpen(true);
    playVoiceSound('/voice/3.wav');
    if (miningCountdownTimerRef.current !== null) {
      window.clearInterval(miningCountdownTimerRef.current);
    }
    miningCountdownTimerRef.current = window.setInterval(() => {
      setMiningCountdown(prev => {
        const next = prev - 1;
        if (next > 0) {
          playVoiceSound(`/voice/${next}.wav`);
          return next;
        }
        if (miningCountdownTimerRef.current !== null) {
          window.clearInterval(miningCountdownTimerRef.current);
          miningCountdownTimerRef.current = null;
        }
        startMiningBgm(ore, rhythmBgmSource);
        beginMiningPlaying();
        return 1;
      });
    }, 1000);
    playFixSound();
  };

  const handleMiningRhythmInput = (direction: MiningDirection) => {
    if (!miningMiniGameOpen || miningMiniGamePhase !== 'playing' || miningMiniGameStartedAtRef.current === null) return;
    ensureMiningBgmPlaying();
    const elapsed = performance.now() - miningMiniGameStartedAtRef.current;
    const candidates = miningNotes.filter(note => note.judgement === null);
    const closest = candidates.reduce<MiningRhythmNote | null>((best, note) => (
      !best || Math.abs(note.hitAt - elapsed) < Math.abs(best.hitAt - elapsed) ? note : best
    ), null);
    const distance = closest ? Math.abs(closest.hitAt - elapsed) : Number.POSITIVE_INFINITY;
    const judgement = !closest || distance > 400 || closest.direction !== direction
      ? 'BAD'
      : distance <= 100
        ? 'PERFECT'
        : distance <= 220
          ? 'GOOD'
          : 'BAD';
    const gaugeGain = judgement === 'PERFECT' ? 12 : judgement === 'GOOD' ? 7 : 2;
    if (judgement === 'BAD') miningFullComboRef.current = false;
    triggerMiningImpact(judgement);
    if (judgement === 'PERFECT' || judgement === 'GOOD') {
      const nextCombo = miningComboRef.current + 1;
      miningComboRef.current = nextCombo;
      setMiningCombo(nextCombo);
      showMiningComboEffect(nextCombo);
      showMiningSparkle();
    } else {
      miningComboRef.current = 0;
      setMiningCombo(0);
    }
    miningGaugeRef.current = Math.min(100, miningGaugeRef.current + gaugeGain);
    if (judgement === 'PERFECT' || judgement === 'GOOD') miningHadGoodRef.current = true;
    setMiningGauge(miningGaugeRef.current);
    setMiningLastJudgement(judgement);
    if (closest && distance <= 400) {
      setMiningNotes(previous => previous.map(note => (
        note.id === closest.id ? { ...note, judgement } : note
      )));
    }
  };

  const finishMiningRhythmRecording = (shouldSave = true) => {
    const audio = miningRhythmAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      miningRhythmAudioRef.current = null;
    }
    if (miningRhythmRecordingTimerRef.current !== null) {
      window.clearTimeout(miningRhythmRecordingTimerRef.current);
      miningRhythmRecordingTimerRef.current = null;
    }
    const timings = [...miningRhythmRecordedTimingsRef.current].sort((a, b) => a - b);
    if (shouldSave && timings.length > 0) {
      const source = miningRhythmRecordingSourceRef.current;
      setMiningRhythmTimings(prev => {
        const next = { ...prev, [source]: timings };
        saveMiningRhythmTimings(next);
        return next;
      });
      const label = MINING_BGM_OPTIONS.find(option => option.src === source)?.label ?? source;
      setDialogMessage(`${label} の採掘リズムを${timings.length}点記録しました。`);
    } else if (!shouldSave) {
      setDialogMessage('採掘リズム記録をキャンセルしました。');
    } else {
      setDialogMessage('採掘リズムが記録されませんでした。');
    }
    miningRhythmRecordingStartedAtRef.current = null;
    setMiningRhythmRecording(false);
  };

  const recordMiningRhythmBeat = () => {
    if (!miningRhythmRecording || miningRhythmRecordingStartedAtRef.current === null) return;
    const elapsed = Math.round(performance.now() - miningRhythmRecordingStartedAtRef.current);
    if (elapsed < 250 || elapsed > MINING_GAME_DURATION_MS - 250) return;
    setMiningRhythmRecordedTimings(prev => {
      if (prev.some(timing => Math.abs(timing - elapsed) < 120)) return prev;
      playFixSound();
      const next = [...prev, elapsed].sort((a, b) => a - b).slice(0, 16);
      miningRhythmRecordedTimingsRef.current = next;
      return next;
    });
  };

  const startMiningRhythmRecording = (bgmSource = MINING_BGM_SOURCES.normal) => {
    if (miningRhythmRecording) return;
    setMenuOpen(false);
    menuOpenRef.current = false;
    setMiningRhythmRecordedTimings([]);
    miningRhythmRecordedTimingsRef.current = [];
    setMiningRhythmRecordingSource(bgmSource);
    miningRhythmRecordingSourceRef.current = bgmSource;
    setMiningRhythmRecording(true);
    miningRhythmRecordingStartedAtRef.current = performance.now();
    const audio = new Audio(bgmSource);
    audio.volume = Math.min(1, getEffectiveVolume(bgmSource, bgmVolume, audioGainsRef.current));
    miningRhythmAudioRef.current = audio;
    audio.play().catch(error => console.log('Mining rhythm record BGM blocked', error));
    const label = MINING_BGM_OPTIONS.find(option => option.src === bgmSource)?.label ?? bgmSource;
    setDialogMessage(`採掘リズム記録中：${label} に合わせてクリック / Space / Enter。保存はボタンで行います。`);
  };

  useEffect(() => {
    if (!miningRhythmRecording) return;
    const handleRhythmKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      recordMiningRhythmBeat();
    };
    window.addEventListener('keydown', handleRhythmKeyDown, true);
    return () => window.removeEventListener('keydown', handleRhythmKeyDown, true);
  }, [miningRhythmRecording]);

  useEffect(() => {
    if (!miningMiniGameOpen || miningMiniGamePhase !== 'playing' || miningMiniGameStartedAtRef.current === null) return;
    const update = () => {
      const elapsed = performance.now() - (miningMiniGameStartedAtRef.current ?? performance.now());
      setMiningElapsedMs(elapsed);
      setMiningNotes(previous => {
        if (previous.some(note => note.judgement === null && elapsed > note.hitAt + 400)) {
          miningFullComboRef.current = false;
        }
        return previous.map(note => (
          note.judgement === null && elapsed > note.hitAt + 400
            ? { ...note, judgement: 'MISS' }
            : note
        ));
      });
    };
    update();
    const intervalId = window.setInterval(update, 50);
    miningFinishTimerRef.current = window.setTimeout(() => {
      finishMiningMiniGame();
    }, 10_000);
    return () => {
      window.clearInterval(intervalId);
      if (miningFinishTimerRef.current !== null) {
        window.clearTimeout(miningFinishTimerRef.current);
        miningFinishTimerRef.current = null;
      }
    };
  }, [miningMiniGameOpen, miningMiniGamePhase]);

  useEffect(() => {
    if (!miningMiniGameOpen || miningMiniGamePhase !== 'playing') return;
    const handleMiningKeyDown = (event: KeyboardEvent) => {
      if (!MINING_RHYTHM_DIRECTIONS.includes(event.key as MiningDirection) || event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      handleMiningRhythmInput(event.key as MiningDirection);
    };
    window.addEventListener('keydown', handleMiningKeyDown, true);
    return () => window.removeEventListener('keydown', handleMiningKeyDown, true);
  }, [miningMiniGameOpen, miningMiniGamePhase, miningNotes]);

  useEffect(() => {
    if (miningMiniGameOpen) return;
    stopMiningBgm();
  }, [miningMiniGameOpen]);

  useEffect(() => {
    (Object.entries(MINING_SE_SOURCES) as Array<[keyof typeof MINING_SE_SOURCES, string]>).forEach(([type, source]) => {
      const audio = new Audio(source);
      audio.preload = 'auto';
      audio.load();
      miningSeAudioRefs.current[type] = audio;
    });
  }, []);

  useEffect(() => () => {
    const miningAudio = miningBgmRef.current;
    if (miningAudio) {
      miningAudio.pause();
      miningAudio.currentTime = 0;
      miningBgmRef.current = null;
    }
    if (miningCountdownTimerRef.current !== null) {
      window.clearInterval(miningCountdownTimerRef.current);
      miningCountdownTimerRef.current = null;
    }
    if (miningComboEffectTimerRef.current !== null) {
      window.clearTimeout(miningComboEffectTimerRef.current);
      miningComboEffectTimerRef.current = null;
    }
    if (miningSparkleTimerRef.current !== null) {
      window.clearTimeout(miningSparkleTimerRef.current);
      miningSparkleTimerRef.current = null;
    }
    if (miningRhythmRecordingTimerRef.current !== null) {
      window.clearTimeout(miningRhythmRecordingTimerRef.current);
      miningRhythmRecordingTimerRef.current = null;
    }
    if (miningRhythmAudioRef.current) {
      miningRhythmAudioRef.current.pause();
      miningRhythmAudioRef.current = null;
    }
  }, []);

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
     setLoggingResultRewards([]);
     setLoggingResultSawName('');
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
            setLoggingResultRewards([]);
            setLoggingResultSawName('');
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

  useEffect(() => {
    if (!loggingMiniGameOpen) return;
    const handleLoggingKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (loggingMiniGameStage === 'result' && isLoggingTutorialRun) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopImmediatePropagation();
          playCursorSound();
          setLoggingSelectedResultAction(event.key === 'ArrowLeft' ? 'retry' : 'complete');
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (isLoggingResultInputLocked) return;
          if (loggingSelectedResultAction === 'retry') {
            retryLoggingTutorial();
          } else {
            completeLoggingTutorial();
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!isLoggingResultInputLocked) completeLoggingTutorial();
          return;
        }
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopImmediatePropagation();
        handleLoggingMiniGameAction();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        playFixSound();
        finishLoggingMiniGame();
      }
    };
    window.addEventListener('keydown', handleLoggingKeyDown, true);
    return () => window.removeEventListener('keydown', handleLoggingKeyDown, true);
  }, [loggingMiniGameOpen, loggingMiniGameStage, isLoggingTutorialRun, isLoggingResultInputLocked, loggingSelectedResultAction, loggingGauge, loggingProgress, loggingCombo]);

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
        if (isEndlessNurseryMode()) {
          setCollectionProgress(previous => ({
            ...previous,
            craftedItemIds: previous.craftedItemIds.includes(craftMiniGameRecipeName)
              ? previous.craftedItemIds
              : [...previous.craftedItemIds, craftMiniGameRecipeName],
          }));
        }
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
     setShopNoticeMessage('');
     setKurumiShopOpen(false);
  };

  const showShopNotice = (message: string) => {
     setShopNoticeMessage(message);
     if (shopNoticeTimerRef.current !== null) {
        window.clearTimeout(shopNoticeTimerRef.current);
     }
     shopNoticeTimerRef.current = window.setTimeout(() => {
        setShopNoticeMessage('');
        shopNoticeTimerRef.current = null;
     }, 2200);
  };

  const handleShopItemClick = (index: number) => {
     playFixSound();
     setShopNoticeMessage('');
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
        showShopNotice(`お金が足りません\n必要：${tradePrice.toLocaleString()} G / 所持：${gold.toLocaleString()} G`);
        setDialogMessage('お金が足りません。');
        return;
     }
     setShopNoticeMessage('');
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
     if (item.type === '売る') incrementEndlessStat('totalMoneyEarned', tradePrice);
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
    const isPostDebtEvent = isPostDebtNoticeEvent(spot);
    const shouldShowPostDebtNotice = isPostDebtEvent && !hasSeenPostDebtNotice();
    const messages = isPostDebtEvent && !shouldShowPostDebtNotice
      ? [POST_DEBT_NOTICE_REPEAT_TEXT]
      : spot.texts?.length
        ? spot.texts
        : [spot.text || spot.label || 'イベントが発生しました。'];
    setActiveAutoEventMessageIndex(0);
    setActiveAutoEventMessage(messages[0]);
    setActivePostDebtNoticeFirstView(shouldShowPostDebtNotice);
    setActiveAutoEventSpot(spot);
    if (spot.seSrc) playEventAudio(spot.seSrc, 'se');
    if (shouldShowPostDebtNotice) {
      playEventAudio(POST_DEBT_NOTICE_SOUND_SRC, 'se');
      window.localStorage.setItem(POST_DEBT_NOTICE_SEEN_STORAGE_KEY, 'true');
    }
    if (spot.voiceSrc) playEventAudio(spot.voiceSrc, 'voice');
  };

  const closeAutoEventOverlay = () => {
    clickTargetRef.current = null;
    setClickTargetMarker(null);
    fadeOutEventAudio();
    if (autoEventBgmMutedRef.current) {
      autoEventBgmMutedRef.current = false;
      const targetVolume = getBgmEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
      fadeBgmTo(targetVolume, 900);
    }
    setActiveAutoEventSpot(null);
    setActivePostDebtNoticeFirstView(false);
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

    const houseBgmTarget = getBgmEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
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

  const startMiningPrompt = () => {
    if (!activeMiningPointId) {
      setMiningPromptVisible(false);
      miningPromptBlockedRef.current = true;
      return;
    }
    if (!hasEquippedPickaxe(equippedItemsRef.current)) {
      setMiningPromptVisible(false);
      setDialogMessage('採掘にはつるはしを装備する必要があります。');
      miningPromptBlockedRef.current = true;
      return;
    }
    setMiningPromptVisible(false);
    miningPromptBlockedRef.current = true;
    startMiningMiniGame(activeMiningPointId);
  };

  const cancelMiningPrompt = () => {
    setMiningPromptVisible(false);
    setActiveMiningPointId(null);
    miningPromptBlockedRef.current = true;
  };

  const beginFishingHitStage = (biteScore: number, biteCombo: number) => {
    const equippedAccessory = equippedItemsRef.current['主人公-slot4']?.trim() ?? '';
    const baseEquippedAccessory = toBaseItemName(equippedAccessory);
    const nushiRateMultiplier = baseEquippedAccessory === FISHING_NUSHI_RING_NAME
      ? FISHING_NUSHI_RING_RATE_MULTIPLIER
      : 1;
    const nushiDebugRate = null;
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
      rareRateMultiplier: getGatheringRareRateMultiplier(),
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
  const chibiichiCompanionSprites = {
    down: '/img/companions/chibiichi_idle.png',
    up: '/img/companions/chibiichi_back.png',
    left: '/img/companions/chibiichi_idle.png',
    right: '/img/companions/chibiichi_idle.png',
  };
  const chibiichiCompanionWalkSprites = {
    down: [
      chibiichiCompanionSprites.down,
      '/img/companions/chibiichi_walk1.png',
      chibiichiCompanionSprites.down,
      '/img/companions/chibiichi_walk2.png',
    ],
    up: [
      chibiichiCompanionSprites.up,
      chibiichiCompanionSprites.up,
      chibiichiCompanionSprites.up,
      chibiichiCompanionSprites.up,
    ],
    left: [
      chibiichiCompanionSprites.left,
      '/img/companions/chibiichi_walk1.png',
      chibiichiCompanionSprites.left,
      '/img/companions/chibiichi_walk2.png',
    ],
    right: [
      chibiichiCompanionSprites.right,
      '/img/companions/chibiichi_walk1.png',
      chibiichiCompanionSprites.right,
      '/img/companions/chibiichi_walk2.png',
    ],
  } as const;
  const chibiichiCompanionSpriteSheet = {
    url: '/img/chibiichi-walk.png',
    columns: 3,
    rows: 3,
    sourceWidth: 1330,
    sourceHeight: 1182,
    cellWidth: 402,
    cellHeight: 394,
    offsetX: 60,
    offsetY: 0,
    stabilizeMotion: true,
    frameOffsets: {
      0: { x: 0, y: 0 },
      1: { x: 0, y: -3 },
      2: { x: 0, y: -4 },
      3: { x: 0, y: 0 },
      4: { x: 0, y: 0 },
      5: { x: 0, y: 0 },
      6: { x: 0, y: 0 },
      7: { x: 0, y: 3 },
      8: { x: 0, y: 3 },
    },
    frames: {
      down: [0, 1, 0, 2],
      up: [3, 4, 3, 5],
      left: [6, 7, 6, 8],
      right: [6, 7, 6, 8],
    },
  } as const;
  const melCompanionSpriteSheet = {
    url: '/img/mel-walk.png',
    columns: 3,
    rows: 3,
    sourceWidth: 1254,
    sourceHeight: 1254,
    cellWidth: 418,
    cellHeight: 418,
    stabilizeMotion: true,
    frameOffsets: {
      0: { x: 0, y: 0 },
      1: { x: 29, y: 1 },
      2: { x: 60, y: 1 },
      3: { x: 0, y: 0 },
      4: { x: 36, y: 0 },
      5: { x: 67, y: 0 },
      6: { x: 0, y: 0 },
      7: { x: 36, y: 1 },
      8: { x: 65, y: 1 },
    },
    frames: {
      down: [0, 1, 0, 2],
      up: [3, 4, 3, 5],
      left: [6, 7, 6, 8],
      right: [6, 7, 6, 8],
    },
  } as const;
  const companionSpriteSheet = companionGirlId === 'chibiichi'
    ? chibiichiCompanionSpriteSheet
    : companionGirlId === 'mel'
      ? melCompanionSpriteSheet
      : null;
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

  useEffect(() => {
    if (!topSplashVisible) return;
    const audio = new Audio('/se/top.wav');
    audio.volume = getEffectiveVolume('/se/top.wav', seVolumeRef.current, audioGainsRef.current);
    topSplashAudioRef.current = audio;
    audio.play().catch(err => console.log('Top splash audio autoplay blocked', err));
    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (topSplashAudioRef.current === audio) topSplashAudioRef.current = null;
    };
  }, [topSplashVisible]);

  useEffect(() => {
    const isTitleVisible = bootMode === 'title' && !topSplashVisible && !circleIntroVisible;
    if (!isTitleVisible) {
      if (titleRandomVoiceRef.current) {
        titleRandomVoiceRef.current.pause();
        titleRandomVoiceRef.current.currentTime = 0;
        titleRandomVoiceRef.current = null;
      }
      return;
    }
    if (titleRandomVoicePlayedRef.current) return;

    titleRandomVoicePlayedRef.current = true;
    const voiceSrc = TITLE_RANDOM_VOICE_SRCS[Math.floor(Math.random() * TITLE_RANDOM_VOICE_SRCS.length)];
    titleRandomVoiceRef.current = playVoiceSound(voiceSrc);
  }, [bootMode, topSplashVisible, circleIntroVisible]);

  const closeTopSplash = () => {
    if (!topSplashVisible) return;
    const audio = topSplashAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      topSplashAudioRef.current = null;
    }
    setTopSplashVisible(false);
    setCircleIntroVisible(true);
  };

  const closeCircleIntro = () => {
    if (!circleIntroVisible) return;
    titleRandomVoicePlayedRef.current = false;
    setCircleIntroVisible(false);
  };

  useEffect(() => {
    if (!topSplashVisible) return;
    const handleTopSplashKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      closeTopSplash();
    };
    window.addEventListener('keydown', handleTopSplashKeyDown, true);
    return () => window.removeEventListener('keydown', handleTopSplashKeyDown, true);
  }, [topSplashVisible]);

  useEffect(() => {
    if (!circleIntroVisible) return;
    const handleCircleIntroKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      closeCircleIntro();
    };
    window.addEventListener('keydown', handleCircleIntroKeyDown, true);
    return () => window.removeEventListener('keydown', handleCircleIntroKeyDown, true);
  }, [circleIntroVisible]);

  // BGMの初期化と自動再生処理
  useEffect(() => {
    const audio = new Audio(TITLE_BGM_SRC);
    audio.loop = true;
    audio.volume = getBgmEffectiveVolume(TITLE_BGM_SRC, bgmVolume, audioGainsRef.current);
    bgmRef.current = audio;

    const startBgm = () => {
      if (topSplashVisible || circleIntroVisible) return;
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
  }, [topSplashVisible, circleIntroVisible]);

  // マップに応じてBGMを切り替える
  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    if (prologueOpen) {
      audio.pause();
      return;
    }
    if (battlePreviewOpen) return;
    if (fishingMiniGameOpen || wasFishingBgmActiveRef.current || loggingMiniGameOpen || wasLoggingBgmActiveRef.current || miningMiniGameOpen) return;
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

    const shouldResume = bgmStartedRef.current;
    bgmSourceRef.current = nextSource;
    audio.pause();
    audio.src = nextSource;
    audio.loop = true;
    audio.volume = getBgmEffectiveVolume(nextSource, bgmVolume, audioGainsRef.current);
    audio.currentTime = 0;

    if (shouldResume) {
      audio.play().then(() => {
        bgmStartedRef.current = true;
      }).catch((err) => {
        console.log("BGM switch autoplay blocked", err);
      });
    }
  }, [bootMode, currentMap, bgmVolume, audioGains, mapBgmSources, kurumiShopOpen, kurumiIntroOpen, fishingTutorialOpen, fishingTutorialEndingOpen, sawCraftTutorialIntroOpen, sawCraftTutorialShedDialogueOpen, gatheringTutorialOpen, fishingMiniGameOpen, loggingMiniGameOpen, miningMiniGameOpen, battlePreviewOpen, activeAutoEventSpot, prologueOpen]);

  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    if (!battlePreviewOpen) return;
    if (battlePreviewState.result !== 'ongoing') return;
    cancelBgmFade();
    const nextSource = battlePreviewState.bgmSource;
    if (bgmSourceRef.current !== nextSource) {
      bgmSourceRef.current = nextSource;
      audio.pause();
      audio.src = nextSource;
      audio.loop = true;
      audio.currentTime = 0;
    }
    audio.volume = getEffectiveVolume(nextSource, bgmVolume, audioGainsRef.current);
    audio.play().then(() => {
      bgmStartedRef.current = true;
    }).catch((err) => {
      console.log("Battle BGM autoplay blocked", err);
    });
  }, [battlePreviewOpen, battlePreviewState.result, battlePreviewState.bgmSource, bgmVolume, audioGains]);

  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    if (!battlePreviewOpen) return;
    if (battlePreviewState.result === 'victory') {
      const nextSource = BATTLE_VICTORY_BGM_SOURCES[difficulty];
      if (bgmSourceRef.current !== nextSource) {
        cancelBgmFade();
        bgmSourceRef.current = nextSource;
        audio.pause();
        audio.src = nextSource;
        audio.loop = false;
        audio.currentTime = 0;
      }
      audio.volume = getEffectiveVolume(nextSource, bgmVolume, audioGainsRef.current);
      audio.play().then(() => {
        bgmStartedRef.current = true;
      }).catch((err) => {
        console.log("Battle victory BGM autoplay blocked", err);
      });

      const fadeTimer = window.setTimeout(() => {
        fadeBgmTo(0, 3000, () => {
          audio.pause();
          audio.currentTime = 0;
        });
      }, 1600);
      return () => window.clearTimeout(fadeTimer);
    }

    if (battlePreviewState.result !== 'defeat') return;

    fadeBgmTo(0, 3000, () => {
      audio.pause();
      audio.currentTime = 0;
    });
  }, [battlePreviewOpen, battlePreviewState.result, difficulty, bgmVolume, audioGains]);

  // BGM音量変更時の反映
  useEffect(() => {
    if (battlePreviewOpen) return;
    if (fishingMiniGameOpen || wasFishingBgmActiveRef.current || loggingMiniGameOpen || wasLoggingBgmActiveRef.current || miningMiniGameOpen) return;
    if (activeAutoEventSpot) return;
    if (bgmRef.current && !bgmFadingRef.current) {
      bgmRef.current.volume = getBgmEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
    }
  }, [bgmVolume, audioGains, fishingMiniGameOpen, loggingMiniGameOpen, miningMiniGameOpen, battlePreviewOpen, activeAutoEventSpot]);

  useEffect(() => {
    const miningAudio = miningBgmRef.current;
    if (!miningAudio) return;
    miningAudio.volume = Math.min(1, getEffectiveVolume(miningAudio.src, bgmVolume, audioGainsRef.current));
  }, [bgmVolume, audioGains]);

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
      if (miningMiniGameOpen) return;

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

      // 確認ダイアログが開いている間は、背後のスキルツリーへキー入力を渡さない。
      if (pendingSkillUnlockId) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const nextChoice = e.key === 'ArrowLeft' ? 'yes' : 'no';
          if (skillUnlockChoice !== nextChoice) playCursorSound();
          setSkillUnlockChoice(nextChoice);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playFixSound();
          confirmHeroSkillUnlock();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          setPendingSkillUnlockId(null);
          return;
        }
        return;
      }

      if (skillUnlockNotice || skillUnlockSparkles) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          setSkillUnlockNotice(null);
        }
        return;
      }

      if (battlePreviewOpen) {
        if (e.repeat) return;
        const actionButtons = ['攻撃', '強攻撃', '防御', 'アイテム', 'あきらめる'];
        const activeTurn = battlePreviewState.turnQueue[battlePreviewState.turnIndex];
        const isHeroTurn = battlePreviewState.result === 'ongoing' &&
          (battlePreviewState.turn ?? 'party') === 'party' &&
          activeTurn?.unitId === battlePreviewState.hero.id &&
          battleIntroPhase === null;

        if (battleItemPanelOpen) {
          const availableItems = getAvailableBattleItems();
          const selectedItem = availableItems[Math.min(selectedBattleItemIndex, Math.max(0, availableItems.length - 1))];
          const targets = selectedItem ? getBattleItemTargets(selectedItem) : [];
          if (e.key === 'Escape') {
            e.preventDefault();
            playFixSound();
            if (battleItemSelectionStep === 'target') {
              setBattleItemSelectionStep('item');
            } else {
              closeBattleItemPanel();
            }
            return;
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            playCursorSound();
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            if (battleItemSelectionStep === 'item') {
              setSelectedBattleItemIndex(prev => availableItems.length > 0 ? (prev + delta + availableItems.length) % availableItems.length : 0);
            } else {
              setSelectedBattleItemTargetIndex(prev => targets.length > 0 ? (prev + delta + targets.length) % targets.length : 0);
            }
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (battleItemSelectionStep === 'item') {
              if (!selectedItem) return;
              playFixSound();
              setSelectedBattleItemTargetIndex(0);
              setBattleItemSelectionStep('target');
            } else if (selectedItem && targets.length > 0) {
              const target = targets[Math.min(selectedBattleItemTargetIndex, targets.length - 1)];
              if (target) {
                playFixSound();
                consumeBattleItem(selectedItem, target.id);
              }
            }
            return;
          }
          return;
        }

        if (battlePreviewState.result !== 'ongoing') {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            playFixSound();
            setBattleMotion(null);
            setBattlePreviewOpen(false);
          }
          return;
        }
        if (!isHeroTurn) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          playCursorSound();
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          setSelectedBattleCommandIndex(prev => (prev + delta + actionButtons.length) % actionButtons.length);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBattlePreviewCommand(actionButtons[selectedBattleCommandIndex] ?? actionButtons[0]);
          return;
        }
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
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
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

      if (miningTutorialOpen) {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          playCursorSound();
          setSelectedMiningTutorialAction(e.key === 'ArrowLeft' ? 'later' : 'next');
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (selectedMiningTutorialAction === 'later') {
            playFixSound();
            stopSawCraftTutorialVoice();
            setMiningTutorialOpen(false);
          } else {
            advanceMiningTutorial();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          playFixSound();
          stopSawCraftTutorialVoice();
          setMiningTutorialOpen(false);
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

      if (seedAfterPlantTutorialOpen) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advanceSeedAfterPlantTutorial();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSeedAfterPlantTutorial();
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

      if (seedPlantTutorialOpen) {
        if (e.repeat) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advanceSeedPlantTutorial();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSeedPlantTutorial();
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

      if (sleepPromptVisible || craftPromptVisible || fishingPromptVisible || miningPromptVisible || loggingPromptVisible) {
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
          } else if (miningPromptVisible) {
            if (confirmPromptChoice === 'yes') {
              startMiningPrompt();
            } else {
              cancelMiningPrompt();
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
          } else if (miningPromptVisible) {
            cancelMiningPrompt();
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
            setMiningPromptVisible(true);
            miningPromptBlockedRef.current = true;
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
          !isOpeningWalkObjectiveActive &&
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
            const categories = HERO_SKILL_CATEGORIES;
            const activeCategory = selectedSkillCategoryRef.current;
            const visibleSkills = getHeroSkillsByCategory(activeCategory).filter(skill => (
              !skill.isHidden || (
                heroLevel >= skill.requiredHeroLevel &&
                skill.requiredSkillIds.every(requiredSkillId => unlockedHeroSkills.includes(requiredSkillId))
              )
            ));
            if (menuContentFocusRef.current === 'primary') {
              const categoryIndex = Math.max(0, categories.indexOf(activeCategory));
              if (e.key === 'ArrowLeft') {
                setMenuFocusArea('nav');
                return;
              }
              if (e.key === 'ArrowRight') {
                const firstSkill = visibleSkills[0];
                if (firstSkill) setSelectedSkillName(firstSkill.id);
                setMenuContentFocus('secondary');
                return;
              }
              const nextCategory = categories[Math.max(0, Math.min(categories.length - 1, categoryIndex + (e.key === 'ArrowDown' ? 1 : -1)))];
              setSelectedSkillCategory(nextCategory);
              const firstSkill = getHeroSkillsByCategory(nextCategory).find(skill => !skill.isHidden);
              if (firstSkill) setSelectedSkillName(firstSkill.id);
              return;
            }
            if (e.key === 'ArrowLeft' && (getHeroSkillById(selectedSkillNameRef.current)?.treeColumn ?? 0) === 0) {
              setMenuContentFocus('primary');
              return;
            }
            const currentSkill = visibleSkills.find(skill => skill.id === selectedSkillNameRef.current) ?? visibleSkills[0];
            if (!currentSkill) return;
            const candidates = visibleSkills.filter(skill => {
              if (skill.id === currentSkill.id) return false;
              if (e.key === 'ArrowLeft') return skill.treeColumn < currentSkill.treeColumn;
              if (e.key === 'ArrowRight') return skill.treeColumn > currentSkill.treeColumn;
              if (e.key === 'ArrowUp') return skill.treeRow < currentSkill.treeRow;
              return skill.treeRow > currentSkill.treeRow;
            });
            const nextSkill = candidates.sort((left, right) => {
              const leftDistance = Math.abs(left.treeColumn - currentSkill.treeColumn) + Math.abs(left.treeRow - currentSkill.treeRow);
              const rightDistance = Math.abs(right.treeColumn - currentSkill.treeColumn) + Math.abs(right.treeRow - currentSkill.treeRow);
              return leftDistance - rightDistance;
            })[0];
            if (nextSkill) setSelectedSkillName(nextSkill.id);
            return;
          }

          if (currentMenuItem.id === 'zukan') {
            const filters = ['苗娘', '魚'];
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
            const zukanLength = zukanFilterRef.current === '魚' ? FISH_ZUKAN_ENTRIES.length : 20;
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
            const companionEquipmentLabel = companionGirlId ? GIRL_DATA.find(girl => girl.id === companionGirlId)?.girlName : undefined;
            const equipmentLabels = ['主人公', ...(companionEquipmentLabel ? [companionEquipmentLabel] : [])];
            const currentIndex = Math.max(0, equipmentLabels.findIndex(label => selectedEquipmentSlotRef.current.startsWith(label)));
            const slotCounts: Record<string, number> = { '主人公': 4, 'ちびいち': 2 };
            const currentLabel = equipmentLabels[currentIndex];
            const currentSlotMatch = /slot(\d+)$/.exec(selectedEquipmentSlotRef.current);
            const currentSlotIndex = Math.max(0, Math.min((slotCounts[currentLabel] ?? 2) - 1, currentSlotMatch ? Number(currentSlotMatch[1]) - 1 : 0));
            const currentSlot = `slot${currentSlotIndex + 1}`;
            const slotLabelsByCharacter: Record<string, string[]> = {
              '主人公': ['釣具・武器系', '採取道具系', '採取道具系', 'アクセサリー・防具'],
              'ちびいち': ['slot1', 'slot2'],
            };
            const optionsBySlot: Record<string, string[]> = {
              '釣具・武器系': withDebugItemVariants(['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿', '木剣', '獣殺し', '天の裁き']),
              '採取道具系': withDebugItemVariants(['のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし']),
              'アクセサリー・防具': withDebugItemVariants(['農神の指輪', FISHING_NUSHI_RING_NAME, '毛皮の服', '剛牙の鎧', '神域の加護']),
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
                  if (e.key === 'ArrowLeft' && clampedPrev % 3 === 0) {
                    setEquipmentActionOpen(false);
                    return clampedPrev;
                  }
                  const moveBy = e.key === 'ArrowDown' ? 3 : e.key === 'ArrowUp' ? -3 : e.key === 'ArrowRight' ? 1 : -1;
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
            const currentIndex = selectedFarmGirlIndexRef.current;
            const farmGirlColumnCount = 5;
            if (e.key === 'ArrowLeft' && currentIndex % farmGirlColumnCount === 0) {
              setMenuFocusArea('nav');
              return;
            }
            setMenuContentFocus('secondary');
            setSelectedFarmGirlIndex(moveGridIndex(currentIndex, e.key, farmGirlColumnCount, menuGirls.length));
            return;
          }

          if (currentMenuItem.id === 'zukan') {
            const currentIndex = selectedZukanIndexRef.current;
            const zukanLength = zukanFilterRef.current === '魚' ? FISH_ZUKAN_ENTRIES.length : 20;
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
            const companionEquipmentLabel = companionGirlId ? GIRL_DATA.find(girl => girl.id === companionGirlId)?.girlName : undefined;
            const equipmentLabels = ['主人公', ...(companionEquipmentLabel ? [companionEquipmentLabel] : [])];
            const currentIndex = Math.max(0, equipmentLabels.findIndex(label => selectedEquipmentSlotRef.current.startsWith(label)));
            const nextLabel = equipmentLabels[(currentIndex + moveBy + equipmentLabels.length) % equipmentLabels.length];
            setSelectedEquipmentSlot(`${nextLabel}-slot1`);
          } else if (currentMenuItem.id === 'status') {
            setSelectedStatusGirlIndex(prev => (prev + moveBy + 15) % 15);
          } else if (currentMenuItem.id === 'farm') {
            setSelectedFarmGirlIndex(prev => (prev + moveBy + 15) % 15);
          } else if (currentMenuItem.id === 'zukan') {
            const zukanLength = zukanFilterRef.current === '魚' ? FISH_ZUKAN_ENTRIES.length : 20;
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
            const selectedName = menuGirls[selectedFarmGirlIndexRef.current]?.name;
            if (selectedName) {
              setFarmGirlDetailOpen(true);
              setDialogMessage(`${selectedName}の詳細情報を表示しました。`);
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
            const companionEquipmentLabel = companionGirlId ? GIRL_DATA.find(girl => girl.id === companionGirlId)?.girlName : undefined;
            const equipmentLabels = ['主人公', ...(companionEquipmentLabel ? [companionEquipmentLabel] : [])];
            const currentIndex = Math.max(0, equipmentLabels.findIndex(label => selectedEquipmentSlotRef.current.startsWith(label)));
            const currentLabel = equipmentLabels[currentIndex];
            const currentSlotMatch = /slot(\d+)$/.exec(selectedEquipmentSlotRef.current);
            const currentSlotIndex = Math.max(0, currentSlotMatch ? Number(currentSlotMatch[1]) - 1 : 0);
            const slotLabelsByCharacter: Record<string, string[]> = {
              '主人公': ['釣具・武器系', '採取道具系', '採取道具系', 'アクセサリー・防具'],
              'ちびいち': ['slot1', 'slot2'],
            };
            const optionsBySlot: Record<string, string[]> = {
              '釣具・武器系': withDebugItemVariants(['竹の釣竿', '丈夫な釣竿', '高級釣竿', '伝説の釣り竿', '木剣', '獣殺し', '天の裁き']),
              '採取道具系': withDebugItemVariants(['のこぎり', '丈夫なのこぎり', '高級のこぎり', '伝説ののこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '伝説のつるはし']),
              'アクセサリー・防具': withDebugItemVariants(['農神の指輪', FISHING_NUSHI_RING_NAME, '毛皮の服', '剛牙の鎧', '神域の加護']),
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
            if (menuContentFocusRef.current === 'primary') {
              const firstSkill = getHeroSkillsByCategory(selectedSkillCategoryRef.current)[0];
              if (firstSkill) setSelectedSkillName(firstSkill.id);
              setMenuContentFocus('secondary');
            } else {
              requestHeroSkillUnlock(selectedSkillNameRef.current);
            }
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

    const loopStartPos = posRef.current;
    const safePos = getSafeSpawnPosition(loopStartPos.x, loopStartPos.y);
    let currentX = safePos.x; 
    let currentY = safePos.y; 
    let currentDir = dir;

    // 衝突を回避した場合、posステートも安全な位置に更新
    if (safePos.x !== loopStartPos.x || safePos.y !== loopStartPos.y) {
       posRef.current = safePos;
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
      const canUsePostMiningTutorialPoint = (
        gatheringTutorialCompleted &&
        gatheringTutorialChoice === 'mining' &&
        !miningTutorialCompleted
      );
      if (
        canUsePostMiningTutorialPoint &&
        currentMapRef.current === POST_MINING_TUTORIAL_POINT.map &&
        x + 18 >= POST_MINING_TUTORIAL_POINT.x &&
        x - 18 <= POST_MINING_TUTORIAL_POINT.x + POST_MINING_TUTORIAL_POINT.w &&
        y >= POST_MINING_TUTORIAL_POINT.y &&
        y - 34 <= POST_MINING_TUTORIAL_POINT.y + POST_MINING_TUTORIAL_POINT.h
      ) {
        return POST_MINING_TUTORIAL_POINT.id;
      }
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

    const getFootDoorAt = (map: GameMap, x: number, y: number) => {
      return doorsRef.current.find(d => (
        d.map === map &&
        d.w > 0 &&
        d.h > 0 &&
        x >= d.x &&
        x <= d.x + d.w &&
        y >= d.y &&
        y <= d.y + d.h
      )) ?? null;
    };

    const completeOpeningMapTransition = () => {
      setOpeningMapTransitionCount(prev => {
        if (
          bootMode === 'playing' &&
          currentDay === 1 &&
          kurumiIntroCompletedDay === null &&
          nextObjective === OPENING_WALK_OBJECTIVE &&
          prev < OPENING_MAP_TRANSITIONS_BEFORE_KURUMI
        ) {
          const nextCount = prev + 1;
          if (nextCount >= OPENING_MAP_TRANSITIONS_BEFORE_KURUMI) {
            setNextObjective(KURUMI_INTRO_OBJECTIVE);
            setDialogMessage(KURUMI_INTRO_OBJECTIVE);
          }
          return nextCount;
        }
        return prev;
      });
    };

    const startMapTransition = (door: WarpDoor) => {
      if (mapTransitioningRef.current) return;

      mapTransitioningRef.current = true;
      warpReentryLockedRef.current = true;
      lastWarpedAtRef.current = performance.now();
      keys.current = {};
      clickTargetRef.current = null;
      setClickTargetMarker(null);
      setIsWalking(false);
      setMapTransitionPhase('fadeOut');
      playDoorSound();

      if (mapTransitionTimerRef.current !== null) {
        window.clearTimeout(mapTransitionTimerRef.current);
      }
      if (mapTransitionUnlockTimerRef.current !== null) {
        window.clearTimeout(mapTransitionUnlockTimerRef.current);
      }

      mapTransitionTimerRef.current = window.setTimeout(() => {
        const nextPosition = { x: door.spawnX, y: door.spawnY };
        currentMapRef.current = door.targetMap;
        currentX = nextPosition.x;
        currentY = nextPosition.y;
        posRef.current = nextPosition;
        setCurrentMap(door.targetMap);
        setPos(nextPosition);
        setDir(currentDir);
        completeOpeningMapTransition();
        setMapTransitionPhase('fadeIn');

        mapTransitionUnlockTimerRef.current = window.setTimeout(() => {
          keys.current = {};
          clickTargetRef.current = null;
          setClickTargetMarker(null);
          warpReentryLockedRef.current = false;
          mapTransitioningRef.current = false;
          setMapTransitionPhase('idle');
          mapTransitionUnlockTimerRef.current = null;
        }, 380);
        mapTransitionTimerRef.current = null;
      }, 260);
    };

    const gameLoop = () => {
      if (setupMode !== 'none') return; // Pause movement in setup menu

      if (mapTransitioningRef.current) {
        setIsWalking(false);
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }

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
      let warped = false;
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

      if (
        warpReentryLockedRef.current &&
        !keyPressed &&
        !getFootDoorAt(currentMapRef.current, currentX, currentY)
      ) {
        warpReentryLockedRef.current = false;
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
        warped = false;
        const canWarp = !warpReentryLockedRef.current && performance.now() - lastWarpedAtRef.current >= WARP_COOLDOWN_MS;
        if (canWarp) {
          const d = getFootDoorAt(currentMapRef.current, nx, ny);
          if (d) {
            startMapTransition(d);
            warped = true;
            moved = false; // ワープ後は一旦歩行停止
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
      const hasMiningToolEquipped = hasEquippedPickaxe(equippedItemsRef.current);
      const canInspectMiningPoint = Boolean(
        miningPointId &&
        !isInBed &&
        !isInWorkbench &&
        !isInFishingPoint &&
        hasMiningToolEquipped &&
        !isAPActionExhausted
      );
      setActiveMiningPointId(canInspectMiningPoint ? miningPointId : null);
      if (!canInspectMiningPoint) {
        miningPromptBlockedRef.current = false;
      } else if (miningPointId && !miningPromptBlockedRef.current && !miningPromptVisible) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setMiningPromptVisible(true);
        movementLockedRef.current = true;
      }

      const touchedLoggingPoint = activeLoggingPoints.find(point => (
        point.map === currentMapRef.current &&
        currentX + 18 >= point.x &&
        currentX - 18 <= point.x + point.w &&
        currentY >= point.y &&
        currentY - 34 <= point.y + point.h
      ));
      const hasEquippedSaw = ['主人公-slot2', '主人公-slot3'].some(slotId => (
        equippedItemsRef.current[slotId]?.includes('のこぎり')
      ));
      if (!touchedLoggingPoint) {
        setActiveLoggingPointId(null);
        loggingPromptBlockedRef.current = false;
      } else if (!loggingPromptBlockedRef.current && !loggingPromptVisible && !isInBed && !isInWorkbench && !isInFishingPoint && hasEquippedSaw && !isAPActionExhausted) {
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

      const companionStep = { x: currentX, y: currentY, direction: currentDir, isWalking: moved };
      if (warped) {
        // マップ移動時は前マップの足跡を破棄して、娘が置き去りになるのを防ぐ。
        const companionRestPosition = getCompanionRestPosition(companionStep, currentDir);
        companionTrailRef.current = Array.from({ length: COMPANION_TRAIL_DELAY_FRAMES }, () => companionRestPosition);
        setCompanionFollow(companionRestPosition);
      } else if (moved) {
        companionTrailRef.current.push(companionStep);
        if (companionTrailRef.current.length > COMPANION_TRAIL_DELAY_FRAMES) {
          companionTrailRef.current.shift();
        }
        setCompanionFollow(companionTrailRef.current[0] ?? companionStep);
      } else {
        // 主人公が止まったら、娘も現在位置のまま待機ポーズへ戻す。
        setCompanionFollow(previous => previous.isWalking ? { ...previous, isWalking: false } : previous);
      }

      posRef.current = { x: currentX, y: currentY };
      setPos(posRef.current);
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
  }, [setupMode, bedTiles, workbenchTiles, fishingTiles, miningTiles, depletedMiningPointIds, activeMiningPointId, loggingTiles, activeLoggingPoints, activeLoggingPointId, sleepPromptVisible, craftPromptVisible, fishingPromptVisible, miningPromptVisible, loggingPromptVisible, confirmPromptChoice, pendingDeleteSaveSlot, pendingOverwriteSaveSlot, activeAutoEventSpot, activeAutoEventMessage, activeAutoEventMessageIndex, activeAutoEventMessages, displayedAutoEventMessage, turn, currentAP, kurumiShopOpen, kurumiIntroOpen, kurumiIntroSelectedIndex, kurumiIntroAskedTopics, kurumiIntroCompletedDay, seedPlantTutorialOpen, seedPlantTutorialStepIndex, seedAfterPlantTutorialOpen, seedAfterPlantTutorialStepIndex, selectedShopControl, selectedShopItemIndex, shopItems, gold, equipmentActionOpen, equippedItems, inventoryCounts, caughtFishIds, fishingMiniGameOpen, fishingMiniGameStage, miningMiniGameOpen, isFishingResultInputLocked, fishingTutorialOpen, fishingTutorialEndingOpen, fishingTutorialEndingStepIndex, sawCraftTutorialIntroOpen, sawCraftTutorialIntroStepIndex, sawCraftTutorialReady, sawCraftTutorialShedDialogueOpen, sawCraftTutorialWorkbenchReady, gatheringTutorialCompleted, gatheringTutorialChoice, miningTutorialCompleted, selectedFishingTutorialAction, selectedFishingResultAction, recipeDetailOpen, farmGirlDetailOpen, bootMode, timeOfDay, isOpeningWalkObjectiveActive, currentDay, nextObjective, battlePreviewOpen, battlePreviewState, battleIntroPhase, battleItemPanelOpen, battleItemSelectionStep, selectedBattleCommandIndex, selectedBattleItemIndex, selectedBattleItemTargetIndex]);

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
        const clickedPostMiningTutorialRock = (
          gatheringTutorialCompleted &&
          gatheringTutorialChoice === 'mining' &&
          !miningTutorialCompleted &&
          currentMap === POST_MINING_TUTORIAL_POINT.map &&
          clickX >= POST_MINING_TUTORIAL_POINT.x &&
          clickX <= POST_MINING_TUTORIAL_POINT.x + POST_MINING_TUTORIAL_POINT.w &&
          clickY >= POST_MINING_TUTORIAL_POINT.y &&
          clickY <= POST_MINING_TUTORIAL_POINT.y + POST_MINING_TUTORIAL_POINT.h
        );
        if (clickedPostMiningTutorialRock) {
          const depletedKey = `${timeOfDay}_${POST_MINING_TUTORIAL_POINT.id}`;
          const minedCountThisTimeSlot = Object.keys(depletedMiningPointIds).filter(key => (
            key.startsWith(`${timeOfDay}_`) && depletedMiningPointIds[key]
          )).length;
          clickTargetRef.current = null;
          setClickTargetMarker(null);
          if (timeOfDay === 'night' && currentAP <= 0) {
            setDialogMessage(EXHAUSTED_ACTION_MESSAGE);
          } else if (depletedMiningPointIds[depletedKey]) {
            setDialogMessage('この採掘ポイントは、この時間帯にはもう採掘済みです。');
          } else if (minedCountThisTimeSlot >= TEMP_MINING_LIMIT_PER_TIME_SLOT) {
            setDialogMessage(`この時間帯に採掘できるのは${TEMP_MINING_LIMIT_PER_TIME_SLOT}回までです。`);
          } else if (!hasEquippedPickaxe(equippedItemsRef.current)) {
            setDialogMessage('採掘にはつるはしを装備する必要があります。');
          } else {
            setActiveMiningPointId(POST_MINING_TUTORIAL_POINT.id);
            setMiningPromptVisible(true);
            miningPromptBlockedRef.current = true;
          }
          return;
        }
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
          {topSplashVisible && (
            <button
              type="button"
              aria-label="トップ画面を閉じてタイトルへ進む"
              onPointerDown={(event) => {
                event.preventDefault();
                closeTopSplash();
              }}
              className="absolute inset-0 z-[500] cursor-pointer bg-black p-0"
            >
              <img src="/img/top.jpg" alt="" className="h-full w-full object-cover" />
            </button>
          )}
          {circleIntroVisible && (
            <button
              type="button"
              aria-label="イントロ動画をスキップしてタイトルへ進む"
              onPointerDown={(event) => {
                event.preventDefault();
                closeCircleIntro();
              }}
              className="absolute inset-0 z-[500] cursor-pointer bg-black p-0"
            >
              <video
                src={CIRCLE_INTRO_VIDEO_SRC}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
                onLoadedMetadata={(event) => {
                  event.currentTarget.volume = DEFAULT_MASTER_VOLUME;
                }}
                onEnded={closeCircleIntro}
              />
            </button>
          )}
          {mapTransitionPhase !== 'idle' && (
            <div
              className={`pointer-events-auto absolute inset-0 z-[260] bg-black transition-opacity ease-in-out ${
                mapTransitionPhase === 'fadeOut'
                  ? 'opacity-100 duration-[240ms]'
                  : 'opacity-0 duration-[260ms]'
              }`}
              aria-hidden="true"
            />
          )}
          {titleStartTransitionPhase !== 'idle' && (
            <div
              className={`pointer-events-auto absolute inset-0 z-[520] bg-black ${
                titleStartTransitionPhase === 'fadeOut' ? 'title-start-fade-out' : 'title-start-fade-in'
              }`}
              aria-hidden="true"
            />
          )}
          {bootMode !== 'playing' && (
            <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black">
              <div className="relative aspect-[1672/941] w-full max-h-full overflow-hidden bg-black">
                <img src={titleImageSrc} alt="孕ませ苗床ファーム タイトル" className="absolute inset-0 h-full w-full object-contain" />
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
                {isEndlessTitleTheme() && (
                  <button
                    type="button"
                    aria-label="無限苗床モード"
                    onClick={() => { playFixSound(); setTitlePanelMode('endless'); }}
                    className="absolute left-1/2 top-[73%] -translate-x-1/2 rounded-full border-2 border-[#ffd166] bg-[#5b276a]/92 px-8 py-3 text-xl font-black text-[#fff5fd] shadow-[0_0_24px_rgba(255,209,102,0.38)] transition hover:scale-105 hover:bg-[#7d388f]"
                  >
                    🌸 無限苗床モード
                  </button>
                )}

                {titlePanelMode !== 'none' && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/58 px-8">
                    <div className="w-[560px] rounded-lg border-4 border-[#ffd166] bg-[#1a100d]/95 p-6 text-[#fdf6e3] shadow-[0_20px_60px_rgba(0,0,0,0.72)]">
	                      <div className="mb-5 flex items-center justify-between gap-4">
	                        <div className="text-3xl font-black">
	                          {titlePanelMode === 'new' ? 'はじめから' : titlePanelMode === 'difficulty' ? '難易度選択' : titlePanelMode === 'load' ? 'つづきから' : titlePanelMode === 'endless' ? '無限苗床モード' : 'コンフィグ'}
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

	                      {(titlePanelMode === 'new' || titlePanelMode === 'load' || titlePanelMode === 'endless') && (
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
                                    onClick={() => titlePanelMode === 'new' ? startNewGameInSlot(slot) : titlePanelMode === 'endless' ? startEndlessNurseryInSlot(slot) : continueGameFromSlot(slot)}
                                    className="grid w-full gap-1 rounded border-2 border-[#bc6c25] bg-[#2d1b15]/90 px-5 py-3 pr-16 text-left text-[#fdf6e3] hover:border-white hover:bg-[#4a2a1f]"
                                  >
                                    <span className="flex items-center justify-between gap-4 text-xl font-black">
                                      <span>セーブスロット {slot}</span>
                                      <span className="text-sm text-[#dda15e]">{titlePanelMode === 'new' ? '新規開始' : titlePanelMode === 'endless' ? '無限開始' : 'ロード'}</span>
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

	                      {titlePanelMode === 'endless' && pendingNewGameSlot !== null && (
	                        <div className="mt-4 rounded border border-[#d8a8ff]/70 bg-[#2a1231]/70 p-4">
	                          <div className="text-lg font-black text-[#f4ddff]">無限苗床モードを開始します</div>
	                          <div className="mt-2 text-sm font-bold text-[#d8c4e8]">借金・返済・ゲームオーバーのない、自由なやり込みモードです。</div>
	                          <button
	                            type="button"
	                            onClick={startEndlessNurseryMode}
	                            className="mt-4 w-full rounded border-2 border-[#ffd166] bg-[#6b2a78] px-5 py-3 text-lg font-black text-[#fff5fd] hover:bg-[#873796]"
	                          >
	                            🌸 このスロットで開始
	                          </button>
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
        <div className="h-[74px] bg-[#2d1b15] border-b-[4px] border-[#bc6c25] flex items-center px-5 z-40 text-[#fdf6e3]">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-lg font-black">
            <span className="flex shrink-0 items-baseline gap-1.5">
              <span className="text-sm text-[#a3b18a]">DAY</span>
              <span className="text-2xl">{currentDay}日目</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1.5 text-[#f4a261]">
              <span className="text-sm text-[#fdf6e3]">TIME</span>
              <span className="text-2xl">{timeLabels[timeOfDay]}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1.5 text-[#a3b18a]">
              <span className="text-sm text-[#fdf6e3]">AP</span>
              <span className="text-2xl">{actionCountLabel}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1.5 text-[#dda15e]">
              <span className="text-sm text-[#fdf6e3]">GOLD</span>
              <span className="text-2xl">{gold.toLocaleString()} G</span>
            </span>
            {isEndlessNurseryMode() ? (
              <span className="shrink-0 rounded border border-[#f4c7ff]/55 bg-[#421a4d]/65 px-2.5 py-1 text-base text-[#f4c7ff]">借金なし / 返済なし</span>
            ) : (
              <span className="shrink-0 rounded border border-[#ffdd99]/45 bg-[#3a2508]/70 px-2 py-1 text-sm text-[#ffdd99]">
                借金 ¥{debtAmount.toLocaleString()} / 返済まであと{daysUntilRepayment}日 / 予定 ¥{nextScheduledRepayment.toLocaleString()}
              </span>
            )}
            <span className="shrink-0 text-base text-[#a5d8ff]">同行：{companionGirlName ?? 'なし'}</span>
            <span className="flex shrink-0 items-center gap-1.5" aria-label={`主人公成長度 ${heroLevel} / ${MAX_HERO_LEVEL}、SP ${heroSP}`}>
              <span className="text-xl tracking-tight">
                {getHeroStarDisplay(heroLevel).map((isUnlocked, starIndex) => (
                  <span key={starIndex} className={isUnlocked ? 'text-[#ffd45a]' : 'text-[#6b7280]'}>★</span>
                ))}
              </span>
              <span className="text-sm font-bold text-[#d8c4a5]">SP:{heroSP}</span>
            </span>
            {hudObjective && (
              <span className="min-w-[140px] max-w-[360px] flex-1 truncate rounded border border-[#ffd166]/80 bg-[#4a310b]/88 px-2.5 py-1.5 text-sm text-[#fff1a8] shadow-[0_0_14px_rgba(255,209,102,0.22)]">
                NEXT　{hudObjective}
              </span>
            )}
            {supplementalHudNotice && (
              <span className="max-w-[250px] shrink-0 truncate rounded border border-[#67e8f9]/70 bg-[#0f3440]/82 px-2.5 py-1.5 text-sm text-[#c9f7ff] shadow-[0_0_12px_rgba(103,232,249,0.2)]">
                ! {supplementalHudNotice}
              </span>
            )}
            {hasBeastPremonition && (
              <span className="shrink-0 text-base text-[#ffd166] drop-shadow-[0_0_8px_rgba(255,209,102,0.45)]">
                {mountainLordAttackPending ? '⚠ 巨大な気配' : '⚠ 獣の気配'}
              </span>
            )}
          </div>
        </div>

        {bootMode === 'playing' && (
          <div className="absolute right-4 top-[84px] z-[45] flex flex-wrap items-center justify-end gap-2 text-[#fdf6e3]">
             <button
               onClick={openBattlePreview}
               className="px-3 py-1 text-sm border-2 bg-[#5a3010] border-[#dda15e] text-[#fdf6e3] hover:bg-[#7a4317] shadow-sm font-bold cursor-pointer"
             >
               ⚔️ 戦闘テスト
             </button>
             <label className="flex items-center gap-1 text-xs font-bold text-[#fdf6e3]">
               敵
               <select
                 value={battleTestBeastId}
                 onChange={(event) => setBattleTestBeastId(event.target.value as BeastId)}
                 className="h-8 rounded border-2 border-[#76502c] bg-[#1a100d] px-2 text-xs font-bold text-[#fdf6e3]"
                 aria-label="戦闘テストの敵"
               >
                 {BEAST_BATTLE_DATA.map(beast => (
                   <option key={beast.id} value={beast.id}>
                     {beast.name}
                   </option>
                 ))}
               </select>
             </label>
             <label className="flex items-center gap-1 text-xs font-bold text-[#fdf6e3]">
               相棒
               <select
                 value={battleTestPartnerId}
                 onChange={(event) => setBattleTestPartnerId(event.target.value)}
                 className="h-8 max-w-[120px] rounded border-2 border-[#76502c] bg-[#1a100d] px-2 text-xs font-bold text-[#fdf6e3]"
                 aria-label="戦闘テストのパートナー"
               >
                 <option value="">なし</option>
                 {GIRL_DATA.map(girl => (
                   <option key={girl.id} value={girl.id}>
                     {girl.girlName}
                   </option>
                 ))}
               </select>
             </label>
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
        )}

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
                    const slotKey = `${slot.fieldId}_${slot.slotIndex}`;
                    const slotPlacement = FARM_SEED_SLOT_PLACEMENTS[slotKey] ?? { offsetX: 0, offsetY: 0, scale: 100 };
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
                    const isGirlCardRevealed = Boolean(farmGirl?.cardRevealed);
                    const actualSlotName = slot.state === 'appeared' && isGirlCardRevealed
                       ? girl?.girlName ?? '娘'
                       : seed?.seedName ?? '苗娘';
                    const slotName = actualSlotName;
                    const isNtr = farmGirl?.condition === 'affected';
                    const isCompanion = companionGirlId === slot.girlId;
                    const canHarvest = Boolean(harvestInfo?.canHarvest);
                    // 受精システム実装前は通常を未受精、affected をNTRとして表示する。
                    const fertilizationStatus = isNtr ? 'NTR' : '未受精';
                    return (
                       <button
                          key={`${slot.fieldId}_${slot.slotIndex}_${slot.girlId}`}
                          type="button"
                          disabled={!canHarvest || isCompanion}
                          aria-label={canHarvest && !isCompanion ? `${slotName}を収穫` : `${slotName} ${slotStatus}`}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openFarmSlotInteraction(slotKey);
                          }}
                          onPointerUp={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border-0 bg-transparent p-0 text-center font-black ${
                            canHarvest && !isCompanion
                              ? 'cursor-pointer pointer-events-auto transition-transform hover:scale-[1.04] focus:outline-none focus:ring-4 focus:ring-lime-200/80'
                              : 'pointer-events-none'
                          }`}
                          style={{
                            left: point.x + slotPlacement.offsetX,
                            top: point.y + slotPlacement.offsetY,
                            transform: `translate(-50%, -50%) scale(${slotPlacement.scale / 100})`,
                          }}
                       >
                          <div className="flex w-[92px] flex-col items-center gap-1">
                            <div className="w-full truncate rounded-md border border-[#ffd166]/80 bg-[#1a100d]/92 px-1 py-1 text-[11px] leading-none text-white shadow-[0_3px_8px_rgba(0,0,0,0.55)]">
                              {slotName}
                            </div>
                            <div className={`relative h-20 w-16 overflow-hidden rounded-xl border-2 shadow-[0_4px_12px_rgba(0,0,0,0.55)] ${
                              slot.state === 'appeared'
                                 ? 'border-[#86efac]/90 bg-[#14532d]/88'
                                 : 'border-[#ffd166]/85 bg-[#1a100d]/82'
                            }`}>
                              <img
                                src={slot.state === 'appeared' && isGirlCardRevealed
                                  ? FARM_GIRL_CARD_IMAGES[slot.girlId ?? ''] ?? '/img/nae.png'
                                  : '/img/nae.png'}
                                alt={slotName}
                                className="h-full w-full object-contain"
                              />
                              {isCompanion && (
                                <div className="absolute inset-x-1 bottom-1 rounded border border-cyan-100 bg-cyan-700/95 px-1 py-1 text-[10px] leading-none text-white shadow">
                                  同行中
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={`flex w-[104px] flex-col gap-1.5 rounded-md border px-1.5 py-1.5 text-[11px] leading-tight shadow-[0_3px_8px_rgba(0,0,0,0.55)] ${
                            slot.state === 'appeared'
                               ? 'border-[#86efac]/90 bg-[#14532d]/90 text-[#dcfce7]'
                               : 'border-[#ffd166]/85 bg-[#1a100d]/90 text-[#ffe8a3]'
                          }`}>
                            <div className="whitespace-nowrap text-[11px] text-white">{slotStatus}</div>
                            <div className={`rounded-md border px-1 py-1.5 text-center text-[12px] leading-none text-white ${
                              fertilizationStatus === 'NTR'
                                ? 'border-red-300 bg-red-700'
                                : 'border-slate-300 bg-slate-600'
                            }`}>
                              {fertilizationStatus}
                            </div>
                            <div className={`rounded-md border px-1 py-1.5 text-center text-[12px] leading-none ${
                              canHarvest
                                ? 'border-lime-200 bg-green-700 text-lime-50'
                                : 'border-white/10 bg-slate-950/65 text-slate-500 grayscale'
                            }`}>
                              {canHarvest && !isCompanion ? '収穫可 / H' : '収穫不可'}
                            </div>
                          </div>
                       </button>
                    );
                 })}
                 {(showFarmPlantButtonPreview
                    ? (['left', 'right'] as FieldId[]).flatMap(fieldId => (
                        Array.from(
                          { length: fieldId === 'left' ? 6 : 4 },
                          (_, index): FarmFieldSlotState => farmFieldSlots.find(slot => slot.fieldId === fieldId && slot.slotIndex === index + 1) ?? {
                            fieldId,
                            slotIndex: index + 1,
                            girlId: null,
                            state: 'none',
                            plantedDay: null,
                          },
                        )
                      ))
                    : farmFieldSlots
                 ).map(slot => {
                    const slotKey = `${slot.fieldId}_${slot.slotIndex}`;
                    const point = getFarmFieldSlotPoint(slot);
                    const placement = farmPlantButtonPlacements[slotKey] ?? { offsetX: 0, offsetY: 0 };
                    if (!showFarmPlantButtonPreview && slot.girlId) return null;
                    const isNearby = nearbyFarmSlotKey === slotKey;
                    const isSelectedPreview = showFarmPlantButtonPreview && selectedFarmPlantButtonKey === slotKey;
                    return (
                      <button
                        key={`farm_action_${slotKey}`}
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onPointerUp={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openFarmSlotInteraction(slotKey);
                        }}
                        className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-[#ffd166]/65 bg-[#1a100d]/65 px-3 py-1.5 text-[12px] font-black text-[#ffe8a3] shadow-[0_4px_10px_rgba(0,0,0,0.55)] transition-all ${
                          isNearby ? 'scale-110 opacity-100 ring-2 ring-white/70' : 'opacity-55 hover:opacity-100'
                        } ${isSelectedPreview ? 'opacity-100 ring-4 ring-white' : ''}`}
                        style={{
                          left: point.x + placement.offsetX,
                          top: point.y + placement.offsetY,
                        }}
                      >
                        ＋ 植える
                      </button>
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
                 !(isOpeningWalkObjectiveActive && z.type === 'kurumi') &&
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

           {setupMode === 'none' && (hasHeroSkill('gather_fishing_rare_up') || hasHeroSkill('gather_mining_rare_up')) && (() => {
              const revealAllGatheringPoints = hasHeroSkill('gather_mining_rare_up');
              const gatheringRevealRadius = 105;
              const getDistanceToRect = (x: number, y: number, w: number, h: number) => {
                 const dx = Math.max(x - pos.x, 0, pos.x - (x + w));
                 const dy = Math.max(y - pos.y, 0, pos.y - (y + h));
                 return Math.hypot(dx, dy);
              };
              const getGatheringMarkerOpacity = (x: number, y: number, w: number, h: number) => {
                 if (revealAllGatheringPoints) return 1;
                 const distance = getDistanceToRect(x, y, w, h);
                 if (distance > gatheringRevealRadius) return 0;
                 return 0.42 + (1 - distance / gatheringRevealRadius) * 0.58;
              };
              const createTileMarkerGroups = (
                 tiles: Record<string, boolean>,
                 type: 'fish' | 'mine',
                 label: string,
                 icon: string,
                 color: string,
                 isAvailable: (key: string) => boolean = () => true,
              ) => {
                 const mapTiles = Object.keys(tiles)
                    .filter(key => tiles[key] && isAvailable(key))
                    .map(key => {
                       const [mapKey, posKey] = key.split('_');
                       if (mapKey !== currentMap || !posKey) return null;
                       const [gx, gy] = posKey.split(',').map(Number);
                       if (!Number.isInteger(gx) || !Number.isInteger(gy)) return null;
                       return { key, gx, gy };
                    })
                    .filter((tile): tile is { key: string; gx: number; gy: number } => tile !== null);
                 const remaining = new Set(mapTiles.map(tile => tile.key));
                 const byGrid = new Map(mapTiles.map(tile => [`${tile.gx},${tile.gy}`, tile]));
                 const groups: Array<{ id: string; label: string; icon: string; x: number; y: number; w: number; h: number; color: string }> = [];

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
                          const nextTile = byGrid.get(`${gx},${gy}`);
                          if (!nextTile || !remaining.has(nextTile.key)) return;
                          remaining.delete(nextTile.key);
                          stack.push(nextTile);
                       });
                    }

                    const xs = component.map(item => item.gx);
                    const ys = component.map(item => item.gy);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    groups.push({
                       id: `${type}_${currentMap}_${minX},${minY}_${component.length}`,
                       label,
                       icon,
                       x: minX * TILE_SIZE,
                       y: minY * TILE_SIZE,
                       w: (maxX - minX + 1) * TILE_SIZE,
                       h: (maxY - minY + 1) * TILE_SIZE,
                       color,
                    });
                 });

                 return groups;
              };
              const tileMarkerEntries = [
                 ...createTileMarkerGroups(fishingTiles, 'fish', '釣り', '🎣', '#67e8f9'),
                 ...createTileMarkerGroups(miningTiles, 'mine', '採掘', '⛏', '#d6d3d1', key => !depletedMiningPointIds[`${timeOfDay}_${key}`]),
              ];
              const loggingMarkerEntries = activeLoggingPoints
                 .filter(point => point.map === currentMap)
                 .map(point => ({ id: `log_${point.id}`, label: '伐採', icon: '🪓', x: point.x, y: point.y, w: point.w, h: point.h, color: '#86efac' }));
              return [...tileMarkerEntries, ...loggingMarkerEntries]
                 .map(point => ({ ...point, opacity: getGatheringMarkerOpacity(point.x, point.y, point.w, point.h) }))
                 .filter(point => point.opacity > 0)
                 .map(point => {
                    const markerX = point.x + point.w / 2;
                    const markerY = Math.max(30, point.y - 22);
                    return (
                       <div
                          key={point.id}
                          className="pointer-events-none absolute z-[36] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-black/70 text-base font-black shadow-[0_0_12px_rgba(0,0,0,0.55)]"
                          style={{
                             left: markerX,
                             top: markerY,
                             width: 34,
                             height: 34,
                             borderColor: point.color,
                             color: point.color,
                             opacity: point.opacity,
                             animation: 'doorMarkerFloat 2.2s ease-in-out infinite',
                          }}
                          title={point.label}
                          aria-label={point.label}
                       >
                          {point.icon}
                       </div>
                    );
                 });
           })()}

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

          {/* 同行娘は主人公の移動履歴をたどるため、曲がり角でも後ろを自然に追従する。 */}
          {setupMode !== 'animation' && companionSpriteSheet && !isPlayerInBath && (
            <Character
              x={companionFollow.x}
              y={companionFollow.y}
              direction={companionFollow.direction}
              isWalking={companionFollow.isWalking}
              customSprites={chibiichiCompanionSprites}
              isHidden={isPlayerInHideArea(companionFollow.x, companionFollow.y, currentMap)}
              playerWalkSprites={chibiichiCompanionWalkSprites}
              mirrorRightSprite
              walkFrameMs={150}
              scale={1}
              showGroundShadow={false}
              spriteSheet={companionSpriteSheet}
            />
          )}

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
            const companion = allies[0];
            const companionSkill = companion ? PARTNER_SKILL_PREVIEWS[companion.id] ?? null : null;
            const activeTurn = battlePreviewState.turnQueue[battlePreviewState.turnIndex];
            const isHeroTurn = (battlePreviewState.turn ?? 'party') === 'party' && activeTurn?.unitId === hero.id;
            const actionButtons = ['攻撃', '強攻撃', '防御', 'アイテム', 'あきらめる'];
            const aliveBeasts = beasts.filter((beast): beast is BattleUnitState => Boolean(beast));
            const mainBeast = aliveBeasts[0] ?? null;
            const battleBackgroundSrc = BATTLE_BACKGROUND_SOURCES[difficulty];
            const countdownFrameIndex = battleIntroPhase === 3 ? 0 : battleIntroPhase === 2 ? 1 : 2;
            const battleResultFrameIndex = result === 'victory' ? 0 : 1;
            const partnerSkillRemainingUses = Math.max(0, battlePreviewState.partnerSkillMaxUses - battlePreviewState.partnerSkillUses);
            const availableBattleItems = getAvailableBattleItems();
            const selectedBattleItem = availableBattleItems[Math.min(selectedBattleItemIndex, Math.max(0, availableBattleItems.length - 1))];
            const battleItemTargets = selectedBattleItem ? getBattleItemTargets(selectedBattleItem) : [];
            const selectedBattleItemTarget = battleItemTargets[Math.min(selectedBattleItemTargetIndex, Math.max(0, battleItemTargets.length - 1))];
            const healingItemRemainingUses = Math.max(0, BATTLE_HEALING_ITEM_USE_LIMIT - battlePreviewState.healingItemUses);
            const reviveItemRemainingUses = Math.max(0, BATTLE_REVIVE_ITEM_USE_LIMIT - battlePreviewState.reviveItemUses);
            const recentBattleLogs = logs.slice(-5);
            const renderHpBar = (hp: number, maxHp: number, colorClass = 'bg-[#4ade80]') => (
              <div className="h-3.5 overflow-hidden rounded-full border border-white/20 bg-black/65 p-px shadow-[inset_0_1px_2px_rgba(0,0,0,0.85)]">
                <div
                  className={`h-full rounded-full ${colorClass} shadow-[0_0_8px_currentColor] transition-[width] duration-300 ease-out`}
                  style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                />
              </div>
            );
            const renderDamagePopups = (targetId: string, positionClass = '') => battleDamagePopups
              .filter(popup => popup.targetId === targetId)
              .map(popup => (
                <span
                  key={popup.key}
                  className={`battle-damage-popup ${positionClass} ${popup.spRecovery ? 'is-sp-recovery' : popup.healing ? 'is-healing' : popup.critical ? 'is-critical' : ''}`}
                >
                  {popup.spRecovery ? `SP +${popup.damage}` : `${popup.healing ? '+' : ''}${popup.damage}`}
                </span>
              ));
            const renderSpriteSheet = (
              unit: BattleUnitState,
              src: string,
              frameCount: number,
              frameIndex: number,
              className: string,
              imgClassName = '',
            ) => (
              <div className={className}>
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    src={src}
                    alt={unit.name}
                    className={`absolute top-0 h-full max-w-none object-fill ${imgClassName}`}
                    style={{
                      width: `${frameCount * 100}%`,
                      left: `-${frameIndex * 100}%`,
                    }}
                  />
                </div>
                {renderDamagePopups(unit.id)}
              </div>
            );
            const renderHeroSprite = () => {
              const isDown = hero.hp <= 0;
              if (isDown) {
                return (
                  <div className="absolute bottom-[8px] right-[8%] z-[5] w-[260px] aspect-square overflow-visible drop-shadow-[0_18px_16px_rgba(0,0,0,0.65)]">
                    <img src={getBattleGirlDownSpriteSrc(hero.id)} alt={`${hero.name} 倒れ`} className="h-full w-full object-contain" />
                    {renderDamagePopups(hero.id)}
                  </div>
                );
              }
              const pose = getBattleSpritePose(hero.id);
              const frameIndex = BATTLE_POSE_FRAME_INDEX[pose] ?? 0;
              const isActiveDefendMotion = battleMotion?.actorId === hero.id && battleMotion.pose === 'defend';
              const motionClass = pose === 'skill'
                ? 'battle-actor-strong-attack'
                : pose === 'attack'
                ? 'battle-actor-attack-right'
                : pose === 'hurt'
                  ? 'battle-actor-hurt'
                  : isActiveDefendMotion
                    ? 'battle-actor-defend'
                    : '';
              const hitEffectClass = battleHitEffect?.targetId === hero.id ? 'battle-hit-effect' : '';
              const supportEffectClass = battleSupportEffect?.targetId === hero.id ? 'battle-support-effect' : '';
              return renderSpriteSheet(
                hero,
                '/img/battle/battle2d-player.png',
                BATTLE_SPRITE_FRAME_COUNT,
                frameIndex,
                `absolute bottom-[8px] right-[17%] z-[5] w-[145px] aspect-[384/1080] overflow-visible drop-shadow-[0_18px_16px_rgba(0,0,0,0.65)] battle-actor-idle ${motionClass} ${hitEffectClass} ${supportEffectClass}`,
              );
            };
            const renderCompanionSprite = () => {
              if (!companion) return null;
              const isDown = companion.hp <= 0;
              const pose = getBattleSpritePose(companion.id);
              const frameIndex = BATTLE_POSE_FRAME_INDEX[pose] ?? 0;
              const isActiveDefendMotion = battleMotion?.actorId === companion.id && battleMotion.pose === 'defend';
              const motionClass = isDown
                ? ''
                : pose === 'attack' || pose === 'skill'
                  ? 'battle-actor-attack-right'
                  : pose === 'hurt'
                    ? 'battle-actor-hurt'
                    : isActiveDefendMotion
                      ? 'battle-actor-defend'
                    : '';
              const hitEffectClass = battleHitEffect?.targetId === companion.id ? 'battle-hit-effect' : '';
              const supportEffectClass = battleSupportEffect?.targetId === companion.id ? 'battle-support-effect' : '';
              return (
                <div className={`absolute ${isDown ? 'bottom-[118px] right-[0%] w-[210px] aspect-square' : 'bottom-[128px] right-[5%] w-[112px] aspect-[384/1080] battle-actor-idle'} z-[4] overflow-visible opacity-95 drop-shadow-[0_14px_12px_rgba(0,0,0,0.58)] ${motionClass} ${hitEffectClass} ${supportEffectClass}`}>
                  {!isDown && companionSkill && companionSkill.maxUses > 0 && (
                    <div className={`battle-partner-skill-bubble ${battlePartnerSkillDisplay?.partnerId === companion.id ? 'is-active' : ''}`}>
                      {battlePartnerSkillDisplay?.partnerId === companion.id
                        ? battlePartnerSkillDisplay.text
                        : battlePreviewState.partnerSkillMaxUses > 0
                          ? `特殊効果：${companionSkill.effectLabel} ${partnerSkillRemainingUses}/${battlePreviewState.partnerSkillMaxUses}`
                          : `特殊効果：${companionSkill.effectLabel}`}
                    </div>
                  )}
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={isDown ? getBattleGirlDownSpriteSrc(companion.id) : getBattleGirlSpriteSrc(companion.id)}
                      alt={isDown ? `${companion.name} 倒れ` : companion.name}
                      className={isDown ? 'h-full w-full object-contain' : 'absolute top-0 h-full max-w-none object-fill'}
                      onError={isDown ? event => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = getBattleGirlSpriteSrc(companion.id);
                        event.currentTarget.className = 'h-full w-full object-contain opacity-65';
                      } : undefined}
                      style={isDown ? undefined : {
                        width: `${BATTLE_SPRITE_FRAME_COUNT * 100}%`,
                        left: `-${frameIndex * 100}%`,
                      }}
                    />
                  </div>
                  {renderDamagePopups(companion.id)}
                </div>
              );
            };
            const renderBeastSprite = (beast: BattleUnitState, index: number) => {
              const isDefeated = beast.hp <= 0;
              const pose = isDefeated ? 'hurt' : getBattleSpritePose(beast.id);
              const frameIndex = BATTLE_BEAST_POSE_FRAME_INDEX[pose] ?? 0;
              const motionClass = isDefeated
                ? 'battle-actor-defeated'
                : pose === 'attack'
                ? 'battle-actor-attack-left'
                : pose === 'hurt'
                  ? 'battle-actor-hurt'
                  : '';
              const hitEffectClass = battleHitEffect?.targetId === beast.id ? 'battle-hit-effect' : '';
              const isMountainLord = beast.id === 'mountain_lord';
              const isGiantBear = beast.id === 'giant_bear';
              const left = isMountainLord ? 8 : 14 + index * 7;
              const bottom = isMountainLord ? -118 : 16 + index * 70;
              const widthClass = isMountainLord ? 'w-[290px]' : isGiantBear ? 'w-[189px]' : 'w-[145px]';
              return (
                <div
                  key={beast.id}
                  className={`absolute z-[4] ${widthClass} aspect-[384/1080] overflow-visible drop-shadow-[0_14px_12px_rgba(0,0,0,0.62)] ${isDefeated ? '' : 'battle-actor-idle'} ${motionClass} ${hitEffectClass}`}
                  style={{ left: `${left}%`, bottom }}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={getBattleBeastSpriteSrc(beast.id)}
                      alt={beast.name}
                      className="absolute top-0 h-full max-w-none object-fill"
                      style={{
                        width: `${BATTLE_BEAST_FRAME_COUNT * 100}%`,
                        left: `-${frameIndex * 100}%`,
                      }}
                    />
                  </div>
                  {renderDamagePopups(beast.id, 'is-beast')}
                </div>
              );
            };
            const heroStars = getHeroStarDisplay(hero.level as HeroLevel);

            return (
              <div
                className="absolute inset-0 z-[115] flex items-center justify-center bg-black/65 p-8"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <div className="relative aspect-[16/9] w-[1320px] max-w-[calc(100%-32px)] overflow-hidden rounded-2xl border-4 border-[#dda15e] bg-[#140d0b] text-[#fdf6e3] shadow-[0_28px_80px_rgba(0,0,0,0.78)]">
                  <img src={battleBackgroundSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34),transparent_22%,transparent_65%,rgba(0,0,0,0.62)),radial-gradient(circle_at_center,transparent_38%,rgba(0,0,0,0.42))]" />
                  <div className="absolute inset-x-[34px] bottom-[198px] top-[54px] z-[3]">
                    <div className="absolute bottom-0 left-[60px] right-[60px] z-[2] h-[92px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,209,102,0.26),rgba(0,0,0,0.18)_58%,transparent_70%)]" />
                    {aliveBeasts.map((beast, index) => renderBeastSprite(beast, index))}
                    {renderCompanionSprite()}
                    {renderHeroSprite()}
                  </div>
                  <div className="absolute bottom-[18px] left-6 right-6 z-[8] grid grid-cols-[minmax(430px,1.45fr)_minmax(360px,1fr)_250px] grid-rows-[76px_96px] gap-3">
                    <div className="rounded-xl border-2 border-[#dda15e]/55 bg-[#0d1117]/90 px-4 py-2.5">
                      <div className="mb-1 text-base font-black leading-tight">
                        <span>{mainBeast?.name ?? '獣'}</span>
                      </div>
                      {mainBeast && (
                        <div className="grid grid-cols-[minmax(0,1fr)_58px] items-center gap-3 text-base font-black tabular-nums">
                          {renderHpBar(mainBeast.hp, mainBeast.maxHp, 'bg-[#ef4444]')}
                          <span className="whitespace-nowrap text-right">{mainBeast.hp}/{mainBeast.maxHp}</span>
                        </div>
                      )}
                    </div>
                    <div className="col-start-1 row-start-2 rounded-xl border-2 border-[#dda15e]/55 bg-[#0d1117]/90 px-5 py-2">
                      <div className="grid h-full grid-rows-[22px_18px_22px] gap-y-1 text-base font-black leading-none tabular-nums">
                        <div className="grid min-w-0 grid-cols-[168px_minmax(0,1fr)_58px] items-center gap-3">
                          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap">
                            <span className="min-w-0 truncate">主人公 <span>{heroStars.map((filled, index) => (
                              <span key={index} className={filled ? 'text-[#ffd166]' : 'text-[#5a4a31]'}>★</span>
                            ))}</span></span>
                            <span>HP</span>
                          </div>
                          {renderHpBar(hero.hp, hero.maxHp, 'bg-[#22c55e]')}
                          <span className="whitespace-nowrap text-right">{hero.hp}/{hero.maxHp}</span>
                        </div>
                        <div className="grid min-h-[16px] grid-cols-[168px_minmax(0,1fr)_58px] items-center gap-3 text-[#7dd3fc]">
                          <span className="flex h-full items-center justify-end">SP</span>
                          {renderHpBar(battlePreviewState.battleSp, battlePreviewState.maxBattleSp, 'bg-[#38bdf8]')}
                          <span className="whitespace-nowrap text-right">{battlePreviewState.battleSp}/{battlePreviewState.maxBattleSp}</span>
                        </div>
                        {companion && (
                          <div className="grid min-w-0 grid-cols-[168px_minmax(0,1fr)_58px] items-center gap-3">
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap">
                              <span className="min-w-0 truncate">{companion.name}</span>
                              <span>HP</span>
                            </div>
                            {renderHpBar(companion.hp, companion.maxHp, 'bg-[#f59e0b]')}
                            <span className="whitespace-nowrap text-right">{companion.hp}/{companion.maxHp}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="row-span-2 rounded-xl border-2 border-[#dda15e]/55 bg-[#0d1117]/90 p-2.5">
                      <div className="grid h-full grid-rows-5 gap-1.5">
                        {result === 'ongoing' ? actionButtons.map((label, index) => (
                          (() => {
                            const isAvailable = battleIntroPhase === null && isHeroTurn && (label !== '強攻撃' || battlePreviewState.battleSp >= BATTLE_SKILL_SP_COST);
                            const selected = index === selectedBattleCommandIndex && !battleItemPanelOpen;
                            return <button
                              key={label}
                              type="button"
                              onPointerDown={() => setSelectedBattleCommandIndex(index)}
                              onClick={() => handleBattlePreviewCommand(label)}
                              disabled={!isAvailable}
                              className={`flex min-h-0 items-center justify-center rounded-lg border-2 px-4 py-0 text-lg font-black leading-none whitespace-nowrap shadow-[0_3px_0_rgba(0,0,0,0.35)] transition-colors ${
                              isAvailable
                                ? selected
                                  ? 'border-white bg-[#4a5823] text-[#fdf6e3] hover:border-white hover:bg-[#60732d]'
                                  : 'border-[#c8a87a] bg-[#202938] text-[#fdf6e3] hover:border-white hover:bg-[#2f3c52]'
                                : 'border-[#55606f] bg-[#111827] text-[#94a3b8] opacity-70'
                            }`}
                          >
                            {label === '強攻撃' ? `強攻撃 SP${BATTLE_SKILL_SP_COST}` : label}
                          </button>;
                          })()
                        )) : (
                          <button
                            type="button"
                            onClick={() => { playFixSound(); setBattleMotion(null); setBattlePreviewOpen(false); }}
                            className="row-span-5 flex min-h-0 items-center justify-center rounded-lg border-2 border-[#c8a87a] bg-[#202938] px-4 py-0 text-lg font-black leading-none text-[#fdf6e3] shadow-[0_3px_0_rgba(0,0,0,0.35)] transition-colors hover:border-white hover:bg-[#2f3c52]"
                          >
                            戦闘を閉じる
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-start-2 row-span-2 row-start-1 rounded-xl border-2 border-[#dda15e]/55 bg-[#0d1117]/90 px-5 py-4 text-lg font-bold leading-relaxed">
                      <div ref={battleLogRef} className="h-full overflow-y-auto break-words pr-2">
                        {recentBattleLogs.map((log, index) => (
                          <p
                            key={`${index}-${log}`}
                            className={log.includes('クリティカル')
                              ? 'text-[#fb7185]'
                              : companionSkill && log.includes(companionSkill.name)
                                ? 'text-[#c4b5fd]'
                                : index === recentBattleLogs.length - 1
                                  ? 'text-[#ffd166]'
                                  : undefined}
                          >
                            {log}
                          </p>
                        ))}
                        {result === 'victory' && battlePreviewState.loot.length > 0 && (
                          <p className="mt-2 text-[#bbf7d0]">
                            戦利品: {battlePreviewState.loot.map(item => `${item.itemName} x${item.count}`).join(' / ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {battleItemPanelOpen && result === 'ongoing' && (
                    <div className="absolute inset-0 z-[17] flex items-center justify-center bg-black/42 px-6" aria-live="polite">
                      <div className="grid w-[760px] max-w-full grid-cols-[1fr_260px] gap-4 rounded-xl border-2 border-[#fdf6e3]/70 bg-[#111827]/96 p-4 text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.72)]">
                        <div className="min-w-0">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xl font-black text-[#ffd166]">アイテム</div>
                              <div className="text-xs font-bold text-[#c8a87a]">↑↓ 選択 / Enter 決定・次へ / Esc 戻る</div>
                            </div>
                            <div className="rounded border border-[#67e8f9]/60 bg-black/35 px-3 py-2 text-right text-xs font-black leading-relaxed">
                              <div>回復 あと {healingItemRemainingUses}/{BATTLE_HEALING_ITEM_USE_LIMIT}</div>
                              <div>蘇生 あと {reviveItemRemainingUses}/{BATTLE_REVIVE_ITEM_USE_LIMIT}</div>
                            </div>
                          </div>
                          {battleItemSelectionStep === 'item' ? (
                            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-2">
                              {availableBattleItems.map((item, index) => {
                                const selected = index === selectedBattleItemIndex;
                                const count = getBattleItemOwnedCount(item.name);
                                const isDebugItem = hasBattleDebugItem(item.name);
                                const exhausted = !isDebugItem && (item.kind === 'heal' ? healingItemRemainingUses <= 0 : reviveItemRemainingUses <= 0);
                                return (
                                  <button
                                    key={item.name}
                                    type="button"
                                    data-battle-item-index={index}
                                    onClick={() => {
                                      setSelectedBattleItemIndex(index);
                                      setSelectedBattleItemTargetIndex(0);
                                      setBattleItemSelectionStep('target');
                                    }}
                                    className={`grid min-h-[58px] w-full grid-cols-[26px_minmax(0,1fr)_74px] items-center gap-2 rounded-lg border px-3 py-2 text-left ${selected ? 'border-white bg-[#4a5823]/75' : 'border-[#5a3010] bg-black/30 hover:bg-[#2d1b15]'} ${exhausted ? 'opacity-55' : ''}`}
                                  >
                                    <span className="text-center text-[#ffd166]">{selected ? '▶' : ''}</span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-base font-black">{item.name}</span>
                                      <span className="block truncate text-xs font-bold text-[#c8a87a]">{item.kind === 'heal' ? `HP ${item.healAmount} 回復` : `HP ${Math.round((item.reviveHpRate ?? 0) * 100)}% 蘇生`}</span>
                                    </span>
                                    <span className="text-right text-sm font-black text-[#ffd166]">{isDebugItem ? '∞' : `x${count}`}</span>
                                  </button>
                                );
                              })}
                              {availableBattleItems.length === 0 && (
                                <div className="rounded-lg border border-[#5a3010] bg-black/30 p-5 text-center font-bold text-[#c8a87a]">
                                  戦闘中に使えるアイテムを持っていません。
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="rounded border border-[#dda15e]/55 bg-black/30 px-3 py-2 text-sm font-bold text-[#ffd166]">
                                {selectedBattleItem?.name ?? 'アイテム'} を誰に使う？
                              </div>
                              {battleItemTargets.map((target, index) => {
                                const selected = index === selectedBattleItemTargetIndex;
                                return (
                                  <button
                                    key={target.id}
                                    type="button"
                                    data-battle-item-target-index={index}
                                    onClick={() => selectedBattleItem && consumeBattleItem(selectedBattleItem, target.id)}
                                    className={`grid min-h-[54px] w-full grid-cols-[26px_minmax(0,1fr)_110px] items-center gap-2 rounded-lg border px-3 py-2 text-left ${selected ? 'border-white bg-[#60732d]/75' : 'border-[#5a3010] bg-black/30 hover:bg-[#2d1b15]'}`}
                                  >
                                    <span className="text-center text-[#ffd166]">{selected ? '▶' : ''}</span>
                                    <span className="font-black">{target.name}</span>
                                    <span className="text-right text-sm font-black text-[#fdf6e3]">HP {target.hp}/{target.maxHp}</span>
                                  </button>
                                );
                              })}
                              {battleItemTargets.length === 0 && (
                                <div className="rounded-lg border border-[#5a3010] bg-black/30 p-5 text-center font-bold text-[#c8a87a]">
                                  このアイテムを使える対象がいません。
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg border border-[#dda15e]/50 bg-black/30 p-3">
                          <div className="text-xs font-black tracking-[0.16em] text-[#dda15e]">DETAIL</div>
                          <div className="mt-2 text-lg font-black text-[#fdf6e3]">{selectedBattleItem?.name ?? '-'}</div>
                          <p className="mt-3 text-sm font-bold leading-relaxed text-[#c8a87a]">{selectedBattleItem?.desc ?? 'アイテムを選んでください。'}</p>
                          <button
                            type="button"
                            onClick={closeBattleItemPanel}
                            className="mt-5 w-full rounded-lg border-2 border-[#c8a87a] bg-[#202938] px-4 py-3 text-base font-black text-[#fdf6e3] hover:border-white hover:bg-[#2f3c52]"
                          >
                            戻る
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {battleResultReveal && (result === 'victory' || result === 'defeat') && (
                    <div className="pointer-events-none absolute inset-0 z-[18] flex items-center justify-center px-6" aria-live="polite">
                      <div className={`w-[1120px] max-w-[95%] aspect-[32/9] overflow-hidden drop-shadow-[0_16px_32px_rgba(0,0,0,0.82)] ${result === 'victory' ? 'battle-result-win' : 'battle-result-lose'}`}>
                        <img
                          src="/img/winlose.png"
                          alt={result === 'victory' ? 'WIN' : 'LOSE'}
                          className="relative h-[200%] w-full max-w-none object-fill"
                          style={{ top: `-${battleResultFrameIndex * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {battleIntroPhase !== null && (
                    <div className="absolute inset-0 z-[20] flex items-center justify-center bg-black/48" aria-live="polite">
                      {battleIntroPhase === 'start' ? (
                        <img src="/img/battle-start.png" alt="BATTLE START!" className="w-[78%] max-w-[980px] object-contain animate-[battleStartExit_0.7s_cubic-bezier(0.16,0.88,0.25,1)_both] drop-shadow-[0_12px_28px_rgba(0,0,0,0.8)]" />
                      ) : (
                        <div className="w-[260px] aspect-[1/2] overflow-hidden">
                          <img
                            src="/img/battle321.png"
                            alt={`${battleIntroPhase}`}
                            className="relative h-full w-[300%] max-w-none object-fill drop-shadow-[0_12px_28px_rgba(0,0,0,0.8)]"
                            style={{ left: `-${countdownFrameIndex * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
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
                    height: 920,
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 80,
                    display: 'flex',
                    flexDirection: 'column',
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

                  <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr]">
                    {/* メニューアイテムリスト */}
                    <div
                      style={{
                        padding: '14px 10px 14px 16px',
                        borderRight: '1px solid rgba(255,221,166,0.14)',
                        background: 'rgba(8, 8, 8, 0.16)',
                        ...menuKeyboardFocusStyle(menuFocusArea === 'nav'),
                        // 外側に出した outline は親の overflow: hidden で左辺が切れるため、左メニューでは内側に描画する。
                        outlineOffset: menuFocusArea === 'nav' ? '-3px' : undefined,
                      }}
                    >
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
                    <div className="min-h-0 overflow-hidden p-5 text-[#fdf6e3]">
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
                    {mountainLordAttackPending ? 'いつもと違う気配をビリビリ感じる。' : '畑の方から物音がする……'}<br />
                    {mountainLordAttackPending ? 'これまでとは違う何かが、こちらへ近づいている。' : '獣が作物を狙っているようだ！'}
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

        {miningPromptVisible && (
           <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/20">
              <div className="bg-[#1a100d]/95 border-[4px] border-[#cbd5e1] rounded-xl p-6 text-[#fdf6e3] shadow-2xl w-[380px] h-[180px] text-center flex flex-col items-center justify-center">
                 <div className="text-2xl font-bold mb-4">採掘しますか？</div>
                 <div className="flex justify-center gap-4">
                    <button
                       onClick={() => { playFixSound(); startMiningPrompt(); }}
                       onMouseEnter={() => {
                          if (confirmPromptChoice !== 'yes') playCursorSound();
                          setConfirmPromptChoice('yes');
                       }}
                       className={`w-[120px] h-[52px] bg-[#4a5823] hover:bg-[#60732d] border-2 rounded-lg text-lg font-bold cursor-pointer transition-colors ${confirmPromptChoice === 'yes' ? 'border-white ring-4 ring-[#ffd166]/70' : 'border-[#a3b18a]'}`}
                    >
                       はい
                    </button>
                    <button
                       onClick={() => { playFixSound(); cancelMiningPrompt(); }}
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

         {miningRhythmRecording && (() => {
           const recordingLabel = MINING_BGM_OPTIONS.find(option => option.src === miningRhythmRecordingSource)?.label ?? miningRhythmRecordingSource;
           return (
             <div
               className="absolute inset-0 z-[86] flex items-center justify-center bg-black/70 pointer-events-auto"
               onPointerDown={(event) => {
                 event.preventDefault();
                 recordMiningRhythmBeat();
               }}
             >
               <div
                 className="w-[640px] max-w-[calc(100%-32px)] rounded-2xl border-[4px] border-fuchsia-300 bg-[linear-gradient(180deg,rgba(50,16,48,0.98),rgba(16,8,22,0.98))] p-6 text-center text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.75),0_0_28px_rgba(240,171,252,0.25)]"
                 onPointerDown={(event) => event.stopPropagation()}
               >
                 <div className="mb-2 text-sm font-black tracking-[0.24em] text-fuchsia-200">MINING RHYTHM RECORD</div>
                 <div className="mb-3 text-2xl font-black text-white drop-shadow-[0_0_14px_rgba(240,171,252,0.55)]">BGMに合わせてリズムを記録</div>
                 <div className="mb-4 rounded-xl border border-fuchsia-300/35 bg-black/35 px-4 py-3 text-sm font-bold text-fuchsia-100">
                   {recordingLabel}
                 </div>
                 <button
                   type="button"
                   onPointerDown={(event) => {
                     event.preventDefault();
                     event.stopPropagation();
                     recordMiningRhythmBeat();
                   }}
                   className="mb-4 h-36 w-full rounded-2xl border-[3px] border-[#ffd166] bg-[radial-gradient(circle,rgba(255,209,102,0.22),rgba(126,34,206,0.28),rgba(0,0,0,0.2))] text-2xl font-black text-[#ffd166] shadow-[inset_0_0_24px_rgba(255,209,102,0.18),0_0_24px_rgba(255,209,102,0.22)] transition-transform active:scale-[0.98]"
                 >
                   ここをBGMに合わせてクリック
                 </button>
                 <div className="mb-4 grid grid-cols-2 gap-3 text-sm font-bold">
                   <div className="rounded-xl border border-white/15 bg-black/25 px-3 py-2">
                     記録数 <span className="text-[#ffd166]">{miningRhythmRecordedTimings.length}</span>
                   </div>
                   <div className="rounded-xl border border-white/15 bg-black/25 px-3 py-2">
                     保存 <span className="text-[#86efac]">ボタンで終了</span>
                   </div>
                 </div>
                 <div className="mb-4 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-[#c4b5fd]">
                   BGMが終わっても閉じません。先頭10秒内のクリックを採掘譜面として保存します。
                 </div>
                 <div className="flex justify-center gap-3">
                   <button
                     type="button"
                     onPointerDown={(event) => event.stopPropagation()}
                     onClick={() => finishMiningRhythmRecording(true)}
                     className="h-11 rounded-lg border-2 border-[#86efac] bg-[#14532d] px-6 text-sm font-black text-white hover:bg-[#15803d]"
                   >
                     保存して終了
                   </button>
                   <button
                     type="button"
                     onPointerDown={(event) => event.stopPropagation()}
                     onClick={() => finishMiningRhythmRecording(false)}
                     className="h-11 rounded-lg border-2 border-white/40 bg-black/45 px-6 text-sm font-black text-white hover:bg-white/15"
                   >
                     キャンセル
                   </button>
                 </div>
               </div>
             </div>
           );
         })()}

         {miningMiniGameOpen && (() => {
            const remainingSeconds = Math.max(0, Math.ceil((10_000 - miningElapsedMs) / 1000));
            const gaugePercent = Math.min(100, miningGauge);
            const miningRockStage = Math.min(5, Math.max(1, Math.floor(gaugePercent / 20) + 1));
            const miningRockAnimationClass = miningImpactJudgement === 'PERFECT'
              ? 'farm-mining-rock-perfect'
              : miningImpactJudgement === 'GOOD'
                ? 'farm-mining-rock-good'
                : miningImpactJudgement === 'BAD'
                  ? 'farm-mining-rock-bad'
                  : '';
            const isMiningBackgroundLooping = miningMiniGamePhase === 'playing';
            const miningResultImageSrc = miningMiniGamePhase === 'result'
              ? miningResultReward
                ? '/img/saikutuok.jpg'
                : '/img/saikutung.jpg'
              : null;
            return (
              <div
                className="absolute inset-0 z-[84] flex items-center justify-center bg-black/45 pointer-events-auto"
                onPointerDown={() => ensureMiningBgmPlaying()}
              >
                <div className="w-[820px] max-w-[calc(100%-32px)] rounded-2xl border-[4px] border-[#a5b4fc] bg-[linear-gradient(180deg,rgba(39,22,16,0.98),rgba(14,9,8,0.98))] p-5 text-center text-[#fdf6e3] shadow-[0_18px_48px_rgba(0,0,0,0.72),inset_0_0_24px_rgba(165,180,252,0.08)]">
                  <div className="mb-2 text-sm font-bold tracking-[0.22em] text-[#a5b4fc] drop-shadow-[0_0_10px_rgba(165,180,252,0.7)]">MINING</div>
                  <div className="mb-3 text-2xl font-bold drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
                    {miningMiniGamePhase === 'countdown' ? '採掘開始！' : miningMiniGamePhase === 'playing' ? 'リズムよく岩を砕こう！' : '採掘結果'}
                  </div>
                  <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-xl border-2 border-[#fdf6e3]/70 bg-black shadow-[inset_0_0_24px_rgba(0,0,0,0.72),0_10px_28px_rgba(0,0,0,0.55)]">
                    <img
                      src={miningResultImageSrc ?? '/img/saikutu1.jpg'}
                      alt={miningResultImageSrc ? (miningResultReward ? '採掘成功' : '採掘失敗') : '採掘する主人公'}
                      className={`absolute inset-0 z-[1] h-full w-full object-cover ${isMiningBackgroundLooping ? 'farm-mining-dissolve-a' : 'opacity-100'}`}
                    />
                    {miningMiniGamePhase !== 'result' && (
                      <>
                        <img
                          src="/img/saikutu2.jpg"
                          alt=""
                          aria-hidden="true"
                          className={`absolute inset-0 z-[1] h-full w-full object-cover ${isMiningBackgroundLooping ? 'farm-mining-dissolve-b' : 'opacity-0'}`}
                        />
                        <div className="absolute inset-0 z-[1] bg-black/18" />
                        <div className="pointer-events-none absolute bottom-0 left-1/2 z-[2] h-[52%] -translate-x-1/2">
                          <img
                            key={`rock-${miningImpactKey}`}
                            src={`/img/iwa${miningRockStage}.png`}
                            alt={`ヒビ入り岩 段階${miningRockStage}`}
                            className={`h-full w-auto object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.7)] ${miningRockAnimationClass}`}
                          />
                        </div>
                        <div
                          className="absolute inset-x-0 z-[3] h-2 -translate-y-1/2 border-y border-[#fef08a] bg-[#eab308]/55 shadow-[0_0_18px_rgba(253,224,71,0.85)]"
                          style={{ top: `${MINING_JUDGEMENT_LINE_TOP_PERCENT}%` }}
                        />
                        <div
                          className="absolute left-3 z-[3] -translate-y-full text-xs font-black text-[#fef08a]"
                          style={{ top: `${MINING_JUDGEMENT_LINE_TOP_PERCENT - 2}%` }}
                        >
                          判定ライン
                        </div>
                      </>
                    )}
                    {miningSparkle && (
                      <div
                        key={miningSparkle.id}
                        className="pointer-events-none absolute z-[6] -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${miningSparkle.x}%`,
                          top: `${miningSparkle.y}%`,
                        }}
                      >
                        <video
                          key={miningSparkle.id}
                          src={FISHING_BITE_SPARKLE_WEBM_SRC}
                          className="h-64 w-64 -translate-x-1/2 -translate-y-1/2 object-contain opacity-100 drop-shadow-[0_0_18px_rgba(255,255,255,0.85)]"
                          autoPlay
                          muted
                          playsInline
                          preload="auto"
                        />
                      </div>
                    )}
                    {miningMiniGamePhase === 'countdown' && (
                      <div className="absolute inset-0 z-[6] bg-black/10">
                        <img
                          key={miningCountdown}
                          src={`/img/${miningCountdown}.png`}
                          alt={`${miningCountdown}`}
                          className="absolute inset-x-[10%] top-[7%] h-[76%] w-[80%] object-cover animate-[farmCountdownFrameBurst_0.34s_cubic-bezier(0.2,1.35,0.28,1)_both] drop-shadow-[0_0_26px_rgba(255,209,102,0.95)]"
                        />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border-2 border-[#ffd166]/80 bg-black/70 px-6 py-2 text-lg font-black text-[#ffd166] shadow-[0_0_18px_rgba(255,209,102,0.45)]">
                          採掘開始まで
                        </div>
                      </div>
                    )}
                    {miningMiniGamePhase === 'playing' && miningNotes.map(note => {
                      const top = ((miningElapsedMs - (note.hitAt - MINING_NOTE_FALL_MS)) / MINING_NOTE_FALL_MS) * MINING_JUDGEMENT_LINE_TOP_PERCENT;
                      if (top < -12 || top > 110) return null;
                      const isHit = note.judgement !== null;
                      return (
                        <img
                          key={note.id}
                          src={getMiningArrowImageSrc(note.direction)}
                          alt={getMiningRhythmDirectionLabel(note.direction)}
                          className={`absolute z-[4] h-28 w-28 -translate-x-1/2 -translate-y-1/2 object-contain transition-opacity ${
                            isHit ? 'opacity-30' : 'opacity-100 drop-shadow-[0_0_12px_rgba(165,180,252,0.95)]'
                          }`}
                          style={{
                            left: `${getMiningArrowLaneLeftPercent(note.direction)}%`,
                            top: `${top}%`,
                          }}
                        />
                      );
                    })}
                    {miningMiniGamePhase !== 'result' && (
                      <div className="absolute left-1/2 top-4 z-[5] -translate-x-1/2 rounded-full border-2 border-[#fef08a]/80 bg-black/70 px-7 py-2 text-2xl font-black text-[#fef08a] shadow-[0_0_18px_rgba(253,224,71,0.45)] drop-shadow-[0_3px_0_rgba(0,0,0,0.95)]">
                        {miningMiniGamePhase === 'countdown'
                          ? `開始 ${miningCountdown}`
                          : `残り ${remainingSeconds}秒`}
                      </div>
                    )}
                    {miningComboEffect && (
                      <div
                        key={miningComboEffect.id}
                        className="pointer-events-none absolute left-[18%] top-1/2 z-[7] w-[300px] -translate-x-1/2 -translate-y-1/2"
                      >
                        <img
                          src={miningComboEffect.src}
                          alt=""
                          className="h-auto w-full drop-shadow-[0_0_28px_rgba(255,90,0,0.95)]"
                        />
                      </div>
                    )}
                    {miningMiniGamePhase === 'result' && miningResultFullCombo && (
                      <div className="pointer-events-none absolute left-[18%] top-1/2 z-[7] w-[300px] -translate-x-1/2 -translate-y-1/2">
                        <img
                          src="/img/fullcombo.png"
                          alt="FULL COMBO"
                          className="h-auto w-full drop-shadow-[0_0_28px_rgba(254,240,138,0.85)]"
                        />
                      </div>
                    )}
                  </div>
                  <div className="mb-3 h-8 text-xl font-black">
                    {miningMiniGamePhase === 'countdown' && (
                      <span className="text-[#ffd166]">3・2・1でスタート！</span>
                    )}
                    {miningMiniGamePhase === 'playing' && (
                      <span className={
                        miningLastJudgement === 'PERFECT' ? 'text-[#fef08a]' :
                          miningLastJudgement === 'GOOD' ? 'text-[#86efac]' :
                            miningLastJudgement === 'BAD' ? 'text-[#fca5a5]' : 'text-[#cbd5e1]'
                      }>
                        {miningLastJudgement ?? ''}
                      </span>
                    )}
                    {miningMiniGamePhase === 'result' && <span className="text-[#ffd166]">{miningResultText}</span>}
                  </div>
                  <div className="relative h-10 overflow-hidden rounded-full border-2 border-[#fdf6e3]/90 bg-[linear-gradient(180deg,rgba(0,0,0,0.72),rgba(45,27,21,0.72))] shadow-[inset_0_3px_8px_rgba(0,0,0,0.75),0_6px_18px_rgba(0,0,0,0.35)]">
                    <div className="h-full bg-[linear-gradient(90deg,#60a5fa,#a78bfa,#f0abfc)] transition-[width] duration-150" style={{ width: `${gaugePercent}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]">採掘ゲージ {gaugePercent}%</div>
                  </div>
                  {miningMiniGamePhase === 'result' && (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[#a5b4fc]/35 bg-black/30 px-4 py-3 text-sm font-bold">
                        <div className="text-left text-[#cbd5e1]">獲得鉱石</div>
                        <div className="text-right text-[#fdf6e3]">{miningResultReward?.oreName ?? 'なし'}</div>
                        <div className="text-left text-[#cbd5e1]">個数</div>
                        <div className="text-right text-[#fdf6e3]">{miningResultReward ? `${miningResultReward.quantity}個` : '-'}</div>
                        <div className="text-left text-[#cbd5e1]">品質</div>
                        <div className="text-right text-[#ffd166]">{miningResultReward ? `${miningResultReward.qualityPercent}%` : '-'}</div>
                        <div className="text-left text-[#cbd5e1]">採掘スコア</div>
                        <div className="text-right text-[#fdf6e3]">{miningResultGauge}%</div>
                      </div>
                      <button type="button" onClick={closeMiningMiniGame} className="mt-4 h-12 w-60 rounded-lg border-2 border-[#a5b4fc] bg-[#3730a3] px-8 text-sm font-black leading-none text-white transition-all hover:border-white hover:bg-[#4f46e5]">
                        閉じる
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
         })()}

         {loggingMiniGameOpen && (() => {
            const isDirection = loggingMiniGameStage === 'direction';
            const isAction = loggingMiniGameStage === 'action';
            const isResult = loggingMiniGameStage === 'result';
            const loggingRewardRows = Array.from(
              loggingResultRewards.reduce((map, reward) => {
                const current = map.get(reward.lumber.name) ?? {
                  name: reward.lumber.name,
                  count: 0,
                  maxSize: 0,
                  estimatedSellPrice: 0,
                };
                current.count += 1;
                current.maxSize = Math.max(current.maxSize, reward.size);
                current.estimatedSellPrice += getLumberSellPrice(reward.lumber, reward.size);
                map.set(reward.lumber.name, current);
                return map;
              }, new Map<string, { name: string; count: number; maxSize: number; estimatedSellPrice: number }>()),
              ([, row]) => row,
            );
            const loggingTotalSellPrice = loggingRewardRows.reduce((sum, row) => sum + row.estimatedSellPrice, 0);

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
                              <>
                                 <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[#86efac]/35 bg-black/30 px-4 py-3 text-sm font-bold">
                                    <div className="text-left text-[#cbd5e1]">使用のこぎり</div>
                                    <div className="text-right text-[#fdf6e3]">{loggingResultSawName || '-'}</div>
                                    <div className="text-left text-[#cbd5e1]">伐採スコア</div>
                                    <div className="text-right text-[#ffd166]">{loggingProgress}%</div>
                                    <div className="text-left text-[#cbd5e1]">獲得木材</div>
                                    <div className="text-right text-[#fdf6e3]">
                                       {loggingRewardRows.length > 0 ? `${loggingRewardRows.reduce((sum, row) => sum + row.count, 0)}個` : 'なし'}
                                    </div>
                                    <div className="text-left text-[#cbd5e1]">売却目安</div>
                                    <div className="text-right text-[#ffd166]">{loggingRewardRows.length > 0 ? `${loggingTotalSellPrice.toLocaleString()}G` : '-'}</div>
                                 </div>
                                 {loggingRewardRows.length > 0 && (
                                    <div className="mt-3 max-h-28 space-y-1 overflow-y-auto pr-1 text-left">
                                       {loggingRewardRows.map(row => (
                                          <div key={row.name} className="grid grid-cols-[minmax(0,1fr)_64px_96px] gap-2 rounded border border-[#76502c]/70 bg-[#1a100d]/70 px-3 py-2 text-xs font-bold">
                                             <div className="truncate text-[#fdf6e3]">{row.name}</div>
                                             <div className="text-right text-[#bbf7d0]">x{row.count}</div>
                                             <div className="text-right text-[#ffd166]">最大 {row.maxSize.toFixed(1)}cm</div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                                 <div className="mt-3 text-sm text-[#c8a87a]">
                                    {!isLoggingResultInputLocked && 'クリック / Enter / Space で閉じる'}
                                 </div>
                              </>
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

        {repaymentEventPending && gameMode === 'story' && (
          <div className="absolute inset-0 z-[260] flex items-center justify-center bg-black/75 px-8">
            <div className="w-[620px] rounded-xl border-4 border-[#ffd166] bg-[#1a100d]/96 p-7 text-[#fdf6e3] shadow-[0_24px_80px_rgba(0,0,0,0.78)]">
              <div className="text-center text-3xl font-black text-[#ffd166]">返済期日</div>
              <div className="mt-2 text-center text-sm font-bold text-[#d7b98a]">翌朝へ進む前に、今回の返済方針を選んでください。</div>
              <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-[#76502c] bg-black/30 p-4 text-sm font-bold">
                <div>借金残額 <span className="float-right text-[#ffdd99]">¥{debtAmount.toLocaleString()}</span></div>
                <div>所持金 <span className="float-right text-[#ffd166]">¥{gold.toLocaleString()}</span></div>
                <div>現在金利 <span className="float-right">{formatInterestRate(skillAdjustedWeeklyInterestRate)}</span></div>
                <div>今回利息 <span className="float-right text-[#ffdd99]">¥{currentRepaymentInterest.toLocaleString()}</span></div>
                <div>最低返済額 <span className="float-right">¥{currentMinimumRepayment.toLocaleString()}</span></div>
                <div>農場信用度 <span className="float-right">{farmCredit}</span></div>
                <div className="col-span-2">返済遅延回数 <span className="float-right">{missedRepaymentCount}</span></div>
              </div>
              <div className="mt-5 grid gap-3">
                <button type="button" onClick={handleMinimumRepayment} className="rounded-lg border-2 border-[#86efac] bg-[#14532d] px-5 py-3 text-left font-black hover:bg-[#166534]">
                  最低返済する <span className="float-right">¥{(currentMinimumRepayment + currentRepaymentInterest).toLocaleString()}</span>
                </button>
                <div className="rounded-lg border border-[#a78bfa]/70 bg-[#28184a]/65 p-3">
                  <div className="text-sm font-black text-[#e9d5ff]">多めに返済する</div>
                  <div className="mt-2 flex gap-2">
                    {ADDITIONAL_REPAYMENT_OPTIONS.map(amount => (
                      <button key={amount} type="button" onClick={() => setSelectedAdditionalRepayment(amount)} className={`flex-1 rounded border px-2 py-1 text-xs font-bold ${selectedAdditionalRepayment === amount ? 'border-white bg-[#7c3aed] text-white' : 'border-[#6b4b9b] bg-black/30 text-[#ddd6fe]'}`}>＋{amount.toLocaleString()}G</button>
                    ))}
                  </div>
                  <button type="button" onClick={handleAdditionalRepayment} className="mt-3 w-full rounded border-2 border-[#c4b5fd] bg-[#5b21b6] px-4 py-2 font-black hover:bg-[#6d28d9]">
                    多めに返済する（¥{(Math.min(debtAmount, currentMinimumRepayment + selectedAdditionalRepayment) + currentRepaymentInterest).toLocaleString()}）
                  </button>
                </div>
                <button type="button" onClick={handleSkipRepayment} className="rounded-lg border-2 border-[#b45309] bg-[#4a2a12] px-5 py-3 text-left font-black text-[#ffe2ad] hover:bg-[#63351d]">
                  今回は見送る <span className="float-right text-sm">信用度 -10 / 遅延 +1</span>
                </button>
              </div>
            </div>
          </div>
        )}

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
                       <div className="relative">
                          <img
                             src={resolveEventMediaSrc(activeAutoEventSpot.imageSrc, 'img')}
                             alt={activeAutoEventSpot.label}
                             className="block max-w-full max-h-[780px] object-contain"
                          />
                          {activePostDebtNoticeFirstView && isPostDebtNoticeEvent(activeAutoEventSpot) && (
                             <img
                                src={POST_DEBT_NOTICE_IMAGE_SRC}
                                alt="借用書"
                                className="pointer-events-none absolute left-1/2 top-1/2 z-10 max-h-[72%] max-w-[74%] -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.72)]"
                             />
                          )}
                       </div>
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

        {miningTutorialOpen && (
           <div className="absolute inset-0 z-[88] flex items-center justify-center bg-black/55 px-8">
              <div className="grid h-[690px] w-[1120px] grid-cols-[1fr_390px] overflow-hidden rounded-2xl border-[4px] border-[#a5b4fc] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#a5b4fc]">MINING LESSON</div>
                       <div className="mt-2 text-3xl font-black">採掘のチュートリアル</div>
                    </div>
                    <div className="min-h-[260px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-5 text-[21px] font-bold leading-[1.48]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentMiningTutorialStep.debugKey, currentMiningTutorialStep.message)}」
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <div className="text-sm font-bold text-[#a3b18a]">
                          {miningTutorialStepIndex + 1} / {MINING_TUTORIAL_STEPS.length}
                       </div>
                       <div className="flex gap-3">
                          <button
                             type="button"
                             onMouseEnter={() => setSelectedMiningTutorialAction('later')}
                             onClick={() => {
                                playFixSound();
                                stopSawCraftTutorialVoice();
                                setMiningTutorialOpen(false);
                             }}
                             className={`rounded-lg border-2 px-5 py-2 text-sm font-black transition-all ${
                                selectedMiningTutorialAction === 'later'
                                   ? 'scale-105 border-[#ffd166] bg-[#5a3010] text-[#fdf6e3] shadow-[0_0_16px_rgba(255,209,102,0.45)]'
                                   : 'border-[#5a3010] bg-black/45 text-[#dda15e] hover:bg-[#3a2418]'
                             }`}
                          >
                             あとで
                          </button>
                          <button
                             type="button"
                             onMouseEnter={() => setSelectedMiningTutorialAction('next')}
                             onClick={advanceMiningTutorial}
                             className={`rounded-lg border-2 px-6 py-2 text-sm font-black transition-all ${
                                selectedMiningTutorialAction === 'next'
                                   ? 'scale-105 border-[#e0e7ff] bg-[#3730a3] text-white shadow-[0_0_18px_rgba(165,180,252,0.55)]'
                                   : 'border-[#312e81] bg-[#1e1b4b] text-[#c7d2fe] hover:bg-[#3730a3] hover:text-white'
                             }`}
                          >
                             {miningTutorialStepIndex >= MINING_TUTORIAL_STEPS.length - 1 ? '採掘してみる！' : '次へ'}
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="relative border-l border-[#a5b4fc]/45 bg-gradient-to-b from-[#202047] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[19px] font-bold leading-snug">鉱石の掘り方を覚えよっ！</div>
                    </div>
                    {renderMiningTutorialVisual()}
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

        {seedAfterPlantTutorialOpen && (
           <div className="absolute inset-0 z-[88] flex items-center justify-center bg-black/55 px-8">
              <div className="grid h-[690px] w-[1120px] grid-cols-[1fr_390px] overflow-hidden rounded-2xl border-[4px] border-[#ffd166] bg-[#1a100d]/96 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col gap-4 p-8">
                    <div>
                       <div className="text-sm font-bold tracking-[0.28em] text-[#ffd166]">SEED CHECK</div>
                       <div className="mt-2 text-3xl font-black">植えた苗娘を見てみよう</div>
                    </div>
                    <div className="min-h-[260px] flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/85 p-5 text-[21px] font-bold leading-[1.48]">
                       くるみ
                       {'\n'}「{getDebugDialogueMessage(currentSeedAfterPlantTutorialStep.debugKey, currentSeedAfterPlantTutorialStep.message)}」
                    </div>
                    <div className="flex items-center justify-between gap-4">
                       <div className="text-sm font-bold text-[#c8a87a]">
                          {seedAfterPlantTutorialStepIndex + 1} / {SEED_AFTER_PLANT_TUTORIAL_STEPS.length}
                       </div>
                       <button
                          type="button"
                          onClick={advanceSeedAfterPlantTutorial}
                          className="rounded-lg border-2 border-[#fff3b0] bg-[#9a5a1d] px-7 py-2 text-sm font-black text-white shadow-[0_0_18px_rgba(255,209,102,0.55)] transition hover:bg-[#b45309]"
                       >
                          {seedAfterPlantTutorialStepIndex >= SEED_AFTER_PLANT_TUTORIAL_STEPS.length - 1 ? 'おわり' : '次へ'}
                       </button>
                    </div>
                 </div>
                 <div className="relative border-l border-[#ffd166]/45 bg-gradient-to-b from-[#3b2418] to-[#160d0a]">
                    <div className="absolute left-8 right-8 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-6 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[19px] font-bold leading-snug">畑の見方を覚えよっ！</div>
                    </div>
                    {renderSeedAfterPlantTutorialVisual()}
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

        {seedPlantTutorialOpen && (
           <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/58 px-8">
              <div className="grid h-[620px] w-[980px] grid-cols-[1fr_360px] overflow-hidden rounded-2xl border-[4px] border-[#ffd166] bg-[#1a100d]/97 text-[#fdf6e3] shadow-2xl">
                 <div className="flex min-h-0 flex-col p-8">
                    <div className="text-sm font-bold tracking-[0.28em] text-[#86efac]">SEED TUTORIAL</div>
                    <div className="mt-2 text-3xl font-black text-[#fff3b0]">苗娘を植えてみよう</div>
                    <div className="mt-6 flex-1 whitespace-pre-line rounded-xl border-2 border-[#bc6c25]/70 bg-[#2d1b15]/82 p-6 text-[22px] font-black leading-[1.65]">
                       {SEED_PLANT_TUTORIAL_STEPS[seedPlantTutorialStepIndex]}
                    </div>
                    {seedPlantTutorialStepIndex === 0 && (
                       <div className="mt-4 grid grid-cols-3 gap-3 text-center text-base font-black text-[#fff7dc]">
                          {INITIAL_OWNED_GIRL_SEEDS.map(seedId => {
                             const seed = GIRL_SEED_ACQUISITION_DATA.find(entry => entry.seedId === seedId);
                             return (
                                <div key={seedId} className="rounded-xl border-2 border-[#ffd166]/65 bg-[#4a310b]/85 px-3 py-3">
                                   {seed?.seedName ?? seedId}
                                </div>
                             );
                          })}
                       </div>
                    )}
                    <div className="mt-6 flex items-center justify-between">
                       <div className="text-sm font-bold text-[#c8a87a]">{seedPlantTutorialStepIndex + 1} / {SEED_PLANT_TUTORIAL_STEPS.length}</div>
                       <button
                          type="button"
                          onClick={advanceSeedPlantTutorial}
                          className="rounded-xl border-2 border-[#fff3b0] bg-[#9a5a1d] px-8 py-3 text-lg font-black text-white shadow-[0_0_18px_rgba(255,209,102,0.35)] transition hover:bg-[#b45309]"
                       >
                          {seedPlantTutorialStepIndex >= SEED_PLANT_TUTORIAL_STEPS.length - 1 ? '植えに行く' : '次へ'}
                       </button>
                    </div>
                 </div>
                 <div className="relative border-l border-[#bc6c25]/60 bg-gradient-to-b from-[#3b2418] to-[#160d0a]">
                    <div className="absolute left-7 right-7 top-8 z-10 rounded-2xl border-2 border-[#f1c27d]/80 bg-[#fdf6e3]/95 px-5 py-4 text-[#2d1b15] shadow-xl">
                       <div className="text-2xl font-black tracking-wide">くるみ</div>
                       <div className="mt-1 text-[18px] font-bold leading-snug">まずは苗娘を植えてみよう！</div>
                    </div>
                    <img
                       src="/img/kurumi.png"
                       alt="くるみ"
                       className="absolute inset-x-0 bottom-0 mx-auto h-[520px] w-[390px] object-contain object-bottom drop-shadow-[0_28px_32px_rgba(0,0,0,0.6)]"
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
           shopNoticeMessage={shopNoticeMessage}
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

        {farmSlotInteractionStage && (() => {
          const activeSlot = getFarmSlotByKey(activeFarmSlotKey);
          const pendingSeed = GIRL_SEED_ACQUISITION_DATA.find(seed => seed.seedId === pendingNearbySeedId);
          const title = farmSlotInteractionStage === 'confirmHarvest'
            ? '収穫しますか？'
            : farmSlotInteractionStage === 'confirmPlant'
              ? '苗娘を植える？'
              : farmSlotInteractionStage === 'confirmSeed'
                ? `${pendingSeed?.seedName ?? '苗娘'}を植えますか？`
                : '植える苗娘を選んでください';
          const confirmAction = (choice: 'yes' | 'no') => {
            if (choice === 'no') {
              closeFarmSlotInteraction();
              return;
            }
            if (!activeSlot) return closeFarmSlotInteraction();
            if (farmSlotInteractionStage === 'confirmHarvest' && activeSlot.girlId) {
              harvestFarmGirl(activeSlot.girlId);
              closeFarmSlotInteraction();
            } else if (farmSlotInteractionStage === 'confirmPlant') {
              setSelectedNearbySeedIndex(getFirstPlantableNearbySeedIndex());
              setFarmSlotInteractionStage('selectSeed');
            } else if (farmSlotInteractionStage === 'confirmSeed' && pendingNearbySeedId) {
              plantGirlSeedToSlot(pendingNearbySeedId, activeSlot.fieldId, activeSlot.slotIndex);
              closeFarmSlotInteraction();
            }
          };
          return (
            <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/48 px-6 pointer-events-auto">
              <div
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeFarmSlotInteraction();
                }}
                className="w-[520px] max-w-[92vw] rounded-2xl border-[3px] border-[#ffd166] bg-[#1a100d]/97 p-5 text-[#fdf6e3] shadow-[0_24px_70px_rgba(0,0,0,0.75)]"
              >
                <div className="text-center text-xl font-black text-[#fff3b0]">{title}</div>
                {farmSlotInteractionStage === 'selectSeed' ? (
                  <>
                    <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {nearbyOwnedSeedOptions.length === 0 ? (
                        <div className="rounded-lg border border-[#8a7060] bg-black/30 p-5 text-center font-bold text-[#c8a87a]">
                          植えられる所持苗がありません
                        </div>
                      ) : nearbyOwnedSeedOptions.map((seed, index) => (
                        <button
                          key={seed.seedId}
                          type="button"
                          data-nearby-seed-index={index}
                          onMouseEnter={() => {
                            if (seed.isPlanted) return;
                            if (selectedNearbySeedIndex !== index) playCursorSound();
                            setSelectedNearbySeedIndex(index);
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (seed.isPlanted) return;
                            setSelectedNearbySeedIndex(index);
                            setPendingNearbySeedId(seed.seedId);
                            setFarmSlotConfirmChoice('yes');
                            setFarmSlotInteractionStage('confirmSeed');
                            playFixSound();
                          }}
                          className={`flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left text-base font-black transition-colors ${
                            seed.isPlanted
                              ? 'cursor-not-allowed border-gray-700 bg-gray-900/70 text-gray-500'
                              : selectedNearbySeedIndex === index
                                ? 'border-white bg-[#9a5a1d] text-white ring-2 ring-[#ffd166]'
                                : 'border-[#6b3d1e] bg-[#2d1b15] text-[#fdf6e3] hover:bg-[#4a2a18]'
                          }`}
                        >
                          <span>{seed.seedName}</span>
                          <span className="text-sm">{seed.isPlanted ? '植え付け中' : '植え付け可'}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 text-center text-sm font-bold text-[#c8a87a]">↑↓ 選択　Enter 決定　Esc 戻る　マウス操作対応</div>
                  </>
                ) : (
                  <>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      {(['yes', 'no'] as const).map(choice => (
                        <button
                          key={choice}
                          type="button"
                          onMouseEnter={() => setFarmSlotConfirmChoice(choice)}
                          onClick={() => {
                            setFarmSlotConfirmChoice(choice);
                            confirmAction(choice);
                          }}
                          className={`h-14 rounded-xl border-2 text-lg font-black transition-colors ${
                            farmSlotConfirmChoice === choice
                              ? 'border-white bg-[#bc6c25] text-white ring-4 ring-[#ffd166]/60'
                              : 'border-[#6b3d1e] bg-[#2d1b15] text-[#c8a87a]'
                          }`}
                        >
                          {choice === 'yes' ? 'はい' : 'いいえ'}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 text-center text-sm font-bold text-[#c8a87a]">←→ 選択　Enter 決定　Esc キャンセル　マウス操作対応</div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        <DebugPanel
           setupMode={setupMode}
           debugPanelPos={debugPanelPos}
           handleDebugDragStart={handleDebugDragStart}
           setTurn={setTurn}
           heroLevel={heroLevel}
           setDebugHeroLevel={(level) => {
             setHeroLevel(Math.max(1, Math.min(MAX_HERO_LEVEL, Math.round(level))) as HeroLevel);
           }}
           heroSP={heroSP}
           setHeroSP={setHeroSP}
           debugGirlAffinities={menuGirls.map(girl => ({ id: girl.id, name: girl.name, affinity: girl.affinity }))}
           adjustDebugGirlAffinity={(girlId, delta) => {
             setDebugGirlAffinities(previous => {
               const currentAffinity = previous[girlId] ?? 1;
               return {
                 ...previous,
                 [girlId]: Math.max(1, Math.min(5, currentAffinity + delta)),
               };
             });
           }}
           currentHeroSkillCategoryLabel={HERO_SKILL_CATEGORY_LABELS[selectedSkillCategory]}
           unlockedHeroSkillCount={unlockedHeroSkills.length}
           onUnlockCurrentHeroSkillCategory={() => {
             const categorySkillIds = getHeroSkillsByCategory(selectedSkillCategory)
               .filter(skill => !skill.isHidden)
               .map(skill => skill.id);
             setUnlockedHeroSkills(previous => Array.from(new Set([...previous, ...categorySkillIds])));
             setDialogMessage(`${HERO_SKILL_CATEGORY_LABELS[selectedSkillCategory]}スキルをデバッグ取得しました。`);
           }}
           onResetCurrentHeroSkillCategory={() => {
             const categorySkillIds = new Set(
               getHeroSkillsByCategory(selectedSkillCategory)
                 .filter(skill => !skill.isHidden)
                 .map(skill => skill.id),
             );
             setUnlockedHeroSkills(previous => previous.filter(skillId => !categorySkillIds.has(skillId)));
             setDialogMessage(`${HERO_SKILL_CATEGORY_LABELS[selectedSkillCategory]}スキルをデバッグ解除しました。`);
           }}
           onStartMiningMiniGameTest={(bgmSource) => {
             setMenuOpen(false);
             menuOpenRef.current = false;
             startMiningMiniGame('debug_mining_test', {
               ignoreAP: true,
               useRecordedRhythm: (miningRhythmTimings[bgmSource]?.length ?? 0) > 0,
               rhythmBgmSource: bgmSource,
             });
           }}
           onStartMiningRhythmRecording={startMiningRhythmRecording}
           miningRhythmOptions={MINING_BGM_OPTIONS}
           miningRhythmTimingCounts={Object.fromEntries(
             MINING_BGM_OPTIONS.map(option => [option.src, miningRhythmTimings[option.src]?.length ?? 0]),
           )}
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
           showFarmPlantButtonPreview={showFarmPlantButtonPreview}
           setShowFarmPlantButtonPreview={setShowFarmPlantButtonPreview}
           selectedFarmPlantButtonKey={selectedFarmPlantButtonKey}
           setSelectedFarmPlantButtonKey={setSelectedFarmPlantButtonKey}
           farmPlantButtonPlacements={farmPlantButtonPlacements}
           setFarmPlantButtonPlacements={setFarmPlantButtonPlacements}
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
        {farmGirlDetailOpen && farmGirls.find(girl => girl.girlId === selectedFarmGirlForDetail.id)?.cardRevealed && createPortal(
           <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/62 px-8 py-6 pointer-events-auto"
              onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setFarmGirlDetailOpen(false); }}
           >
              <div
                 className="farm-girl-detail-modal relative grid h-full max-h-[740px] w-full max-w-[980px] grid-cols-[minmax(0,1fr)_260px] overflow-hidden rounded border border-[#f1c27d]/80 bg-[#160d12] shadow-[0_26px_70px_rgba(0,0,0,0.72)]"
                 onClick={(event) => event.stopPropagation()}
              >
                 <button
                    type="button"
                    onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setFarmGirlDetailOpen(false); }}
                    className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded border border-white/35 bg-black/65 text-xl font-bold text-[#fff7dc] hover:bg-[#4a241b]"
                    aria-label="詳細を閉じる"
                 >
                    ×
                 </button>
                 <div className="relative min-h-0 bg-black">
                    <img src={selectedFarmGirlForDetail.detailImg} alt={`${selectedFarmGirlForDetail.name} 詳細`} className="absolute inset-0 h-full w-full object-contain" />
                 </div>
                 <div className="flex flex-col gap-3 border-l border-[#76502c]/70 bg-[#24140f] p-4 pr-5">
                    <div style={menuTinyLabelStyle}>詳細カード</div>
                    <div className="farm-girl-card-preview relative overflow-hidden rounded border border-[#f1c27d]/70">
                       <img src={selectedFarmGirlForDetail.cardImg} alt={selectedFarmGirlForDetail.name} className="absolute inset-0 h-full w-full object-contain p-2" />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-transparent" />
                       <div className="absolute left-3 right-3 bottom-3 rounded bg-black/58 border border-white/10 px-3 py-2">
                          <div className="text-[#fff7dc] text-xl font-bold leading-tight">{selectedFarmGirlForDetail.name}</div>
                          <div className="mt-1 text-base">{renderStars(selectedFarmGirlForDetail.affinity)}</div>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                       <div className="rounded bg-black/25 px-2 py-2">
                          <div className="text-[#c8a87a] text-xs">レベル</div>
                          <div className="text-[#fdf6e3] text-lg font-bold">Lv {selectedFarmGirlForDetail.level}</div>
                       </div>
                       <div className="rounded bg-black/25 px-2 py-2">
                          <div className="text-[#c8a87a] text-xs">星</div>
                          <div className="text-[#ffd45a] text-lg font-bold">{selectedFarmGirlForDetail.affinity} / 5</div>
                       </div>
                       <div className="rounded bg-black/25 px-2 py-2">
                          <div className="text-[#c8a87a] text-xs">性格</div>
                          <div className="text-[#fdf6e3] font-bold">{selectedFarmGirlForDetail.trait}</div>
                       </div>
                       <div className="rounded bg-black/25 px-2 py-2">
                          <div className="text-[#c8a87a] text-xs">状態</div>
                          <div className="text-[#fdf6e3] font-bold">{selectedFarmGirlForDetail.stage}</div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        , document.body)}
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
        {prologueOpen && createPortal(
          <div className="fixed inset-0 z-[10100] flex items-center justify-center overflow-hidden bg-black px-6 py-8 text-[#3b2212]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url(/img/jiihaikei.jpg)' }}
              aria-hidden="true"
            />
            {prologueRingReveal ? (
              <button
                type="button"
                onClick={advancePrologue}
                className="relative h-full w-full max-w-[1120px] cursor-pointer opacity-100 transition-opacity duration-1000"
                aria-label="指輪と家の鍵の演出を閉じる"
              >
                <span className="prologue-image-frame absolute left-1/2 top-1/2 block w-[min(92vw,1120px)] -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-1000">
                  <img
                    src="/img/yubiwa.jpg"
                    alt="古びた農神の指輪と家の鍵"
                    className="block max-h-[86vh] w-full object-contain"
                    ref={image => {
                      if (image) requestAnimationFrame(() => image.parentElement?.classList.replace('opacity-0', 'opacity-100'));
                    }}
                  />
                  <span className="absolute bottom-[7%] left-1/2 z-10 w-[min(82%,760px)] -translate-x-1/2 rounded-2xl border-2 border-[#fff1a8] bg-[#2b170d]/88 px-6 py-4 text-center text-[clamp(18px,2vw,28px)] font-black leading-snug text-[#fff7dc] shadow-[0_12px_28px_rgba(0,0,0,0.62)]">
                    よく見ると、封筒の中にもう1通の手紙が入っていた！
                  </span>
                </span>
                <span className="absolute bottom-[4%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/55 px-5 py-2 text-lg font-black text-[#fff7dc] transition-opacity duration-300">
                  クリック / Enter で続ける
                </span>
              </button>
            ) : prologuePage < PROLOGUE_LETTERS.length ? (
              <div className="relative h-full w-full max-w-[1120px]">
                <div className="absolute left-1/2 top-1/2 h-[min(92vh,820px)] w-[min(92vw,1080px)] -translate-x-1/2 -translate-y-1/2 bg-contain bg-center bg-no-repeat drop-shadow-[0_24px_36px_rgba(0,0,0,0.78)]" style={{ backgroundImage: 'url(/img/jiitegami.png)' }}>
                  <div className="absolute left-[29%] right-[29%] top-[17%] bottom-[16%] flex flex-col overflow-hidden font-['DotGothic16']">
                    <div className="mb-2 text-center text-[clamp(10px,0.9vw,14px)] font-black text-[#6a3a18]/80">
                      手紙 {prologuePage + 1} / 6
                    </div>
                    <div className="whitespace-pre-line break-words text-center text-[clamp(13px,1.35vw,20px)] font-black leading-[1.7] tracking-normal">
                      {PROLOGUE_LETTERS[prologuePage].text}
                    </div>
                    <div className="mt-auto flex justify-center gap-4">
                      <button
                        type="button"
                        onClick={goBackPrologueLetter}
                        disabled={prologuePage <= 0}
                        className="rounded border-2 border-[#6b3b18] bg-[#d8b170]/85 px-7 py-3 text-lg font-black text-[#3b2212] shadow-md transition hover:bg-[#efd39b] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#d8b170]/85"
                      >
                        戻る
                      </button>
                      <button type="button" onClick={advancePrologue} className="rounded border-2 border-[#6b3b18] bg-[#f7dfaf]/90 px-8 py-3 text-lg font-black text-[#3b2212] shadow-md transition hover:bg-[#fff2ca]">
                        {prologuePage === PROLOGUE_LETTERS.length - 1 ? '手紙を閉じる' : '次へ'}　Enter
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-[920px] rounded-2xl border-4 border-[#ffd166] bg-[linear-gradient(180deg,rgba(43,24,14,.96),rgba(16,9,7,.98))] p-10 text-center text-[#fff7dc] shadow-[0_26px_80px_rgba(0,0,0,.8)]">
                <div className="text-3xl font-black text-[#ffd166]">孕ませ村へ</div>
                <div className="mt-8 whitespace-pre-line text-2xl font-black leading-relaxed">女の子と毎日イチャイチャできると思っていたユウに{`\n`}この後、莫大な借金地獄が待っていようとは...。{`\n`}その重大さにユウはまだ、気がついていないのだった......</div>
                <button type="button" onClick={finishPrologue} className="mt-10 rounded border-2 border-[#fff1a8] bg-[#6b3b18] px-10 py-4 text-xl font-black text-[#fff7dc] transition hover:bg-[#8b4d22]">Enter</button>
              </div>
            )}
          </div>, document.body)}
        {(pendingSkillUnlockId || skillUnlockNotice || skillUnlockSparkles) && createPortal(
          <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/65 px-6">
            {skillUnlockSparkles && <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.95)_0_2px,transparent_3px),radial-gradient(circle_at_75%_22%,rgba(255,209,102,.95)_0_3px,transparent_5px),radial-gradient(circle_at_40%_75%,rgba(255,173,222,.9)_0_3px,transparent_5px)]" />}
            <div className="relative w-full max-w-md border-2 border-[#ffd166] bg-[#24140f] p-6 text-[#fff7dc] shadow-[0_20px_70px_rgba(0,0,0,.75)]">
              {pendingSkillUnlockId ? (() => {
                const skill = getHeroSkillById(pendingSkillUnlockId);
                if (!skill) return null;
                return <>
                  <div className="text-center text-2xl font-black text-[#ffd166]">スキルを習得しますか？</div>
                  <div className="mt-4 rounded border border-[#76502c] bg-black/30 p-4"><div className="text-xl font-black">{skill.name}</div><div className="mt-2 text-sm text-[#d7b98a]">SP {skill.costSP} を消費します</div></div>
                  <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onMouseEnter={() => setSkillUnlockChoice('yes')} onClick={() => { setSkillUnlockChoice('yes'); confirmHeroSkillUnlock(skill.id, 'yes'); }} className={`border px-4 py-3 font-black transition ${skillUnlockChoice === 'yes' ? 'border-white bg-[#14532d] ring-4 ring-[#ffd166]/80 shadow-[0_0_22px_rgba(255,209,102,0.55)]' : 'border-[#86efac] bg-[#14532d]/65'}`}>はい</button><button type="button" onMouseEnter={() => setSkillUnlockChoice('no')} onClick={() => { setSkillUnlockChoice('no'); setPendingSkillUnlockId(null); }} className={`border px-4 py-3 font-black transition ${skillUnlockChoice === 'no' ? 'border-white bg-[#6b3b18] ring-4 ring-[#ffd166]/80 shadow-[0_0_22px_rgba(255,209,102,0.55)]' : 'border-[#c8a87a] bg-black/30'}`}>いいえ</button></div>
                </>;
              })() : skillUnlockNotice ? <><div className="text-center text-xl font-black text-[#ffcf8a]">スキルを習得できません</div><div className="mt-4 whitespace-pre-line rounded border border-[#76502c] bg-black/30 p-4 text-center font-bold">{skillUnlockNotice}</div><button type="button" onClick={() => setSkillUnlockNotice(null)} className="mt-5 w-full border border-[#ffd166] bg-[#6b3b18] px-4 py-3 font-black">閉じる</button></> : <div className="py-12 text-center text-3xl font-black text-[#fff1a8]">スキル習得！</div>}
            </div>
          </div>, document.body)}
      </div>
     </div>
    </div>
  );
}
