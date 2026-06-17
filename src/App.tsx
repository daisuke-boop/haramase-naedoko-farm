import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  RIVER_HEAR_DISTANCE,
  RIVER_SOUND_SRC,
  SHOP_BGM_SRC,
  SPEED,
  TAKIURA_WATERFALL_POINT,
  TIME_OF_DAY_LABELS,
  UI_CURSOR_SOUND_SRC,
  UI_FIX_SOUND_SRC,
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
  autoTrigger?: boolean;
  imageSrc?: string;
  videoSrc?: string;
  seSrc?: string;
  voiceSrc?: string;
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
};

const FISHING_KEEP_GREEN_MIN = 42;
const FISHING_KEEP_GREEN_MAX = 58;
const FISHING_FISH_MAX_HP = 100;
const FISHING_TENSION_MAX = 100;
const FISHING_SCENE_CAST_SRC = '/img/fishing1.jpg';
const FISHING_SCENE_UKI_SRC = '/img/uki.jpg';
const FISHING_SCENE_HIT_SRC = '/img/hit.jpg';
const FISHING_SCENE_HIT_OVERLAY_SRC = '/img/hit.png';
const FISHING_SCENE_RESULT_SRC = '/img/1ugui.jpg';
const FISHING_SCENE_ESCAPE_SRC = '/img/fishing4.jpg';
const FISHING_CAST_SOUND_SRC = '/se/fishing.wav';
const FISHING_REEL_SOUND_SRC = '/se/reel.mp3';
const FISHING_BGM_SRC = '/bgm/fishking.mp3';

type KurumiTradeReward = {
  threshold: number;
  imageSrc: string;
  message: string;
  voiceSrc: string;
};

type FishZukanEntry = {
  id: string;
  no: number;
  name: string;
  imageSrc: string;
};

const KURUMI_TRADE_REWARDS: KurumiTradeReward[] = [
  { threshold: 1000, imageSrc: '/img/kurumi-pantsu.png', message: 'いつもありがとう！お礼だよっ！', voiceSrc: '/voice/kurumi1.wav' },
  { threshold: 1500, imageSrc: '/img/kurumi-pai.png', message: '嬉しいなーっ♪サービスだよっ！', voiceSrc: '/voice/kurumi2.wav' },
  { threshold: 2000, imageSrc: '/img/kurumi-hadaka.png', message: 'もう！お兄さんったら！', voiceSrc: '/voice/kurumi3.wav' },
];

const FISH_ZUKAN_ENTRIES: FishZukanEntry[] = [
  { id: 'ugui', no: 1, name: 'ウグイ', imageSrc: '/img/1ugui.jpg' },
  { id: 'nijimasu', no: 2, name: 'ニジマス', imageSrc: '/img/2nijimasu.jpg' },
  { id: 'ayu', no: 3, name: 'アユ', imageSrc: '/img/3ayu.jpg' },
  { id: 'iwana', no: 4, name: 'イワナ', imageSrc: '/img/4iwana.jpg' },
  { id: 'shakuiwana', no: 5, name: '尺イワナ', imageSrc: '/img/5shakuiwana.jpg' },
  { id: 'sakuramasu', no: 6, name: 'サクラマス', imageSrc: '/img/6sakuramasu.jpg' },
  { id: 'sake', no: 7, name: 'サケ', imageSrc: '/img/7sake.jpg' },
  { id: 'raigyo', no: 8, name: 'ライギョ', imageSrc: '/img/8raigyo.jpg' },
  { id: 'mozukugani', no: 9, name: 'モクズガニ', imageSrc: '/img/9mozukugani.jpg' },
  { id: 'oonamazu', no: 10, name: '大ナマズ', imageSrc: '/img/10oonamazu.jpg' },
];

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

  const [setupMode, setSetupMode] = useState<'none' | 'animation' | 'collision' | 'hideArea' | 'doors' | 'footstep' | 'crops' | 'bed' | 'bathTub'>('none');

  // RPGメニュー状態
  const [menuOpen, setMenuOpen] = useState(true);
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
    cardImg: ['/img/chibiichi-card.png', '/img/ruby-card.png', '/img/mel-card.png'][index] ?? '/img/card.png',
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
  const [equippedItems, setEquippedItems] = useState<Record<string, string>>({
    '主人公-slot1': '竹の釣竿',
    '主人公-slot2': 'のこぎり',
    '主人公-slot3': 'つるはし',
    '主人公-slot4': '農神の指輪',
    'ちびいち-slot1': '小さな鈴',
    'ちびいち-slot2': '',
  });
  const [selectedSkillName, setSelectedSkillName] = useState('農具の扱い');
  const selectedSkillNameRef = useRef('農具の扱い');
  const [selectedStatusGirlIndex, setSelectedStatusGirlIndex] = useState(0);
  const selectedStatusGirlIndexRef = useRef(0);
  const [selectedFarmGirlIndex, setSelectedFarmGirlIndex] = useState(0);
  const selectedFarmGirlIndexRef = useRef(0);
  const [selectedFarmFacilityIndex, setSelectedFarmFacilityIndex] = useState(0);
  const selectedFarmFacilityIndexRef = useRef(0);
  const [zukanFilter, setZukanFilter] = useState('通常');
  const zukanFilterRef = useRef('通常');
  const [selectedZukanIndex, setSelectedZukanIndex] = useState(0);
  const selectedZukanIndexRef = useRef(0);
  const [caughtFishIds, setCaughtFishIds] = useState<string[]>([]);
  const [fishBestSizes, setFishBestSizes] = useState<Record<string, number>>({});
  const [fishSizeUpdatedIds, setFishSizeUpdatedIds] = useState<string[]>([]);
  const [systemNotice, setSystemNotice] = useState('システム項目を選択してください。');
  const systemNoticeRef = useRef('システム項目を選択してください。');
  const [selectedSystemActionIndex, setSelectedSystemActionIndex] = useState(0);
  const selectedSystemActionIndexRef = useRef(0);
  const [gold, setGold] = useState(5000);
  const [kurumiTradeTotal, setKurumiTradeTotal] = useState(0);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, number>>({
    '薬草': 0,
    '携帯おにぎり': 0,
    '気付け水': 0,
    '小さな釣り餌': 0,
    '川魚': 0,
    '木材': 20,
    '石材': 2,
    '薬草の葉': 3,
    '川魚の鱗': 3,
    '小さな宝石': 1,
    '古びた硬貨': 2,
    '乾いたハーブ': 3,
    '余った作物': 4,
    '古い鍵': 1,
    '農場契約書': 1,
    '母屋の地図': 1,
    '娘管理台帳': 1,
    '竹の釣竿': 1,
    '丈夫な釣竿': 1,
    '高級釣竿': 1,
    'のこぎり': 1,
    '丈夫なのこぎり': 1,
    '高級のこぎり': 1,
    'つるはし': 1,
    '丈夫なつるはし': 1,
    '高級つるはし': 1,
    '農神の指輪': 1,
  });
  const heroLevel = 1;
  const actionCountMax = 5 + Math.max(0, heroLevel - 1);
  const actionCountCurrent = actionCountMax;
  const actionCountLabel = `${actionCountCurrent}/${actionCountMax}`;
  const [shopItems, setShopItems] = useState([
    { name: '薬草', price: 120, stock: 8, type: '買う', desc: '体力を少し回復する定番の薬草です。' },
    { name: '携帯おにぎり', price: 260, stock: 5, type: '買う', desc: '探索前の腹ごしらえに便利です。' },
    { name: '小さな釣り餌', price: 80, stock: 12, type: '買う', desc: '川釣りで使える小さな餌です。' },
    { name: '木材', price: 40, stock: 20, type: '売る', desc: '農場設備の修理にも使える素材です。' },
    { name: '川魚の鱗', price: 180, stock: 3, type: '売る', desc: '光沢のある素材。くるみが買い取ってくれます。' },
  ]);
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
    const itemByTab: Record<string, string[]> = {
      '消耗品': ['薬草', '携帯おにぎり', '気付け水', '小さな釣り餌'],
      '素材': ['川魚', '木材', '石材', '薬草の葉', '川魚の鱗'],
      '装備品': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', 'のこぎり', '丈夫なのこぎり', '高級のこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '農神の指輪'],
      '売却品': ['小さな宝石', '古びた硬貨', '乾いたハーブ', '余った作物'],
      'だいじなもの': ['古い鍵', '農場契約書', '母屋の地図', '娘管理台帳'],
    };
    const selectedTabItems = itemByTab[itemMenuTab] ?? itemByTab['消耗品'];
    const activeItem = selectedTabItems.includes(selectedItemName) ? selectedItemName : selectedTabItems[0];

    if (id === 'item') {
      return (
        <div className="grid grid-cols-[190px_1fr_260px] gap-4 h-full">
          <div className="flex flex-col gap-2">
            {tabs.map((tab, index) => (
              <button
                key={tab}
                type="button"
                onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setItemMenuTab(tab); setSelectedItemName(itemByTab[tab][0]); }}
                onMouseEnter={() => { if (itemMenuTab !== tab) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setItemMenuTab(tab); setSelectedItemName(itemByTab[tab][0]); }}
                style={{ ...menuPanelBaseStyle, background: itemMenuTab === tab ? 'rgba(74,88,35,0.82)' : menuPanelBaseStyle.background }}
                className="text-left cursor-pointer hover:brightness-125"
              >
                <div style={menuValueStyle}>{tab}</div>
                <div style={menuTinyLabelStyle}>{itemMenuTab === tab ? '選択中' : `${itemByTab[tab].length}個`}</div>
              </button>
            ))}
          </div>
          <div style={menuPanelBaseStyle}>
            <div className="grid grid-cols-2 gap-3">
              {selectedTabItems.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedItemName(name); }}
                  onMouseEnter={() => { if (activeItem !== name) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedItemName(name); }}
                  className={`flex justify-between items-center px-4 py-3 border rounded cursor-pointer text-left ${activeItem === name ? 'bg-[#bc6c25]/45 border-white' : 'bg-black/35 border-[#5a3010] hover:bg-[#3a2418]'}`}
                >
                  <span className="text-[#fdf6e3] font-bold">{name}</span>
                  <span className="text-[#dda15e] text-sm">x{inventoryCounts[name] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
            <div style={menuTinyLabelStyle}>選択アイテム</div>
            <div className="text-[#fdf6e3] text-2xl font-bold">{activeItem}</div>
            <div className="text-[#c8a87a] leading-relaxed">カテゴリ: {itemMenuTab}<br />使用・確認・整理の対象になります。</div>
            <button onClick={() => { playFixSound(); setDialogMessage(`${activeItem}を確認しました。`); }} className="mt-auto bg-[#4a5823] hover:bg-[#60732d] border-2 border-[#a3b18a] rounded px-4 py-3 font-bold cursor-pointer">
              確認する
            </button>
          </div>
        </div>
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
          slotLabels: ['釣具系', '採取道具系', '採取道具系', 'アクセサリー'],
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
        '釣具系': ['竹の釣竿', '丈夫な釣竿', '高級釣竿'],
        '採取道具系': ['のこぎり', '丈夫なのこぎり', '高級のこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし'],
        'アクセサリー': ['農神の指輪'],
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
        <div className="grid grid-cols-[58%_1fr] gap-5 h-full">
          <div style={menuPanelBaseStyle} className="grid grid-cols-2 gap-4 h-full">
            {equipmentCharacters.map((char) => (
              <button
                key={char.label}
                type="button"
                onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedEquipmentSlot(`${char.label}-slot1`); }}
                onMouseEnter={() => { if (!selectedEquipmentSlot.startsWith(char.label)) playCursorSound(); }}
                onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setEquipmentActionOpen(false); setSelectedEquipmentSlot(`${char.label}-slot1`); }}
                className={`farm-menu-character-stage relative overflow-hidden border cursor-pointer flex flex-col items-center justify-end p-4 ${selectedEquipmentSlot.startsWith(char.label) ? 'is-selected border-white ring-4 ring-[#ffd166]/50' : 'border-[#5a3010]'}`}
              >
                <div className="absolute inset-x-8 bottom-8 h-28 rounded-full bg-black/30 blur-xl" />
                <img src={char.img} className="relative z-10 max-h-[630px] w-full object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.45)]" alt={char.label} />
                <div className="relative z-20 w-full mt-3 rounded-xl bg-black/45 border border-white/10 px-4 py-3 text-left">
                  <div className="text-[#fdf6e3] text-2xl font-bold">{char.label}</div>
                  <div className="text-xl">{renderStars(char.affinity)}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={menuPanelBaseStyle} className="flex flex-col gap-4">
              <div key={selectedEquipmentCharacter.label}>
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
                <div className="mt-4 rounded-lg border-2 border-[#dda15e] bg-black/35 p-4 shadow-inner">
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
                    <div className="mt-3">
                      <div className="mb-2 text-[#c8a87a] text-sm">装備欄</div>
                      <div className="grid grid-cols-1 gap-2">
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
                            className={`flex items-center justify-between rounded border px-4 py-3 text-left cursor-pointer hover:bg-[#3a2418] ${
                              selectedEquipmentOptionIndex === optionIndex ? 'border-white bg-[#bc6c25]/45' : 'border-[#5a3010] bg-[#2d1b15]/72'
                            }`}
                          >
                            <span className="text-[#fdf6e3] font-bold">{name}</span>
                            <span className="text-[#dda15e] text-sm">x{inventoryCounts[name] ?? 0}</span>
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
      const currentDay = Math.floor(turn / 4) + 1;
      const repaymentCycleDays = 7;
      const daysUntilRepayment = repaymentCycleDays - ((currentDay - 1) % repaymentCycleDays);
      const farmOverviewItems = [
        ['信用度', '35 / 100'],
        ['次の返済日', `残り ${daysUntilRepayment} 日`],
        ['借入金', '100,000,000 G'],
        ['金利', '3.2%'],
        ['経過日数', `${currentDay} 日`],
        ['行動回数', actionCountLabel],
      ];
      const farmFacilityItems = ['柵 Lv1', '電気柵 未設置', '箱罠 x2'];
      const farmInfoItems = [...farmOverviewItems, ...farmFacilityItems.map(item => ['設備', item])];
      return (
        <div className="grid grid-cols-[220px_1fr_280px] gap-4 h-full">
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
          <div style={menuPanelBaseStyle} className="overflow-hidden">
            <div className="grid grid-cols-5 gap-3 h-full">
              {menuGirls.map((girl, index) => (
                <button
                  key={girl.name}
                  type="button"
                  onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedFarmGirlIndex(index); }}
                  onMouseEnter={() => { if (selectedFarmGirlIndex !== index) playCursorSound(); }}
                  onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('secondary'); setSelectedFarmGirlIndex(index); setDialogMessage(`${girl.name}のお世話画面を開きました。`); }}
                  className={`farm-girl-card-button relative overflow-hidden border rounded cursor-pointer text-left ${selectedFarmGirlIndex === index ? 'is-selected border-white' : 'border-[#6b3b2f]'}`}
                >
                  <img src={girl.cardImg} alt={girl.name} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/12 to-transparent" />
                  <div className="absolute left-2 right-2 bottom-2 rounded bg-black/55 border border-white/10 px-2 py-1.5">
                    <div className="text-[#fff7dc] font-bold text-sm leading-tight">{girl.name}</div>
                    <div className="text-[10px] text-[#ffd45a] leading-none">{renderStars(girl.affinity)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div style={menuPanelBaseStyle} className="flex flex-col gap-3">
            <div className="farm-girl-card-preview relative overflow-hidden rounded border border-[#f1c27d]/70">
              <img src={selectedFarmGirl.cardImg} alt={selectedFarmGirl.name} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-transparent" />
              <div className="absolute left-3 right-3 bottom-3 rounded bg-black/58 border border-white/10 px-3 py-2">
                <div className="text-[#fff7dc] text-2xl font-bold leading-tight">{selectedFarmGirl.name}</div>
                <div className="mt-1 text-lg">{renderStars(selectedFarmGirl.affinity)}</div>
              </div>
            </div>
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
        </div>
      );
    }

    if (id === 'zukan') {
      const isFishZukan = zukanFilter === '魚';
      const zukanFilters = ['通常', '魚', '妊娠', 'レアリティ', '未入手'];
      const selectedFish = FISH_ZUKAN_ENTRIES[Math.min(selectedZukanIndex, FISH_ZUKAN_ENTRIES.length - 1)];
      const selectedFishCaught = !!selectedFish && caughtFishIds.includes(selectedFish.id);
      const selectedFishBestSize = selectedFish ? fishBestSizes[selectedFish.id] : undefined;
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
          <div style={menuPanelBaseStyle} className={`grid grid-cols-5 gap-2 flex-1 ${isFishZukan ? 'auto-rows-fr' : ''}`}>
            {isFishZukan ? FISH_ZUKAN_ENTRIES.map((fish, index) => {
              const caught = caughtFishIds.includes(fish.id);
              const hasSizeUpdate = fishSizeUpdatedIds.includes(fish.id);
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
                      <span className="text-[#fdf6e3] font-bold">No.{fish.no}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${caught ? 'bg-[#4a5823] text-[#d9f99d]' : 'bg-[#2d1b15] text-[#dda15e]'}`}>
                        {caught ? '釣果済' : '未発見'}
                      </span>
                    </div>
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
                <div className="rounded-full border border-[#ffd166]/60 bg-[#2d1b15]/80 px-3 py-1 text-sm font-bold text-[#ffd166] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  最大の釣果: {selectedFishCaught && selectedFishBestSize ? `${selectedFishBestSize.toFixed(1)}cm` : '--.-cm'}
                </div>
                {selectedFishHasUpdate && (
                  <div className="rounded-full border border-[#67e8f9]/80 bg-[linear-gradient(135deg,#67e8f9,#ffd166)] px-4 py-1 text-sm font-black text-[#21110b] shadow-[0_0_18px_rgba(103,232,249,0.62),inset_0_1px_0_rgba(255,255,255,0.45)]">
                    NEW RECORD
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
      { label: 'セーブ', bgImage: '/img/save.png' },
      { label: 'ロード', bgImage: '/img/load.png' },
      { label: 'タイトルへ戻る', bgImage: '/img/title.png' },
    ];

    return (
      <div className="grid grid-cols-3 gap-3 h-full">
        {systemActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            onPointerDown={() => { setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedSystemActionIndex(index); setSystemNotice(`${action.label}を選択しました。`); }}
            onMouseEnter={() => { playCursorSound(); setSelectedSystemActionIndex(index); }}
            onClick={() => { playFixSound(); setMenuFocusArea('content'); setMenuContentFocus('primary'); setSelectedSystemActionIndex(index); setSystemNotice(`${action.label}を選択しました。`); }}
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

  const [sleepPromptVisible, setSleepPromptVisible] = useState(false);
  const [craftPromptVisible, setCraftPromptVisible] = useState(false);
  const [fishingPromptVisible, setFishingPromptVisible] = useState(false);
  const [fishingMiniGameOpen, setFishingMiniGameOpen] = useState(false);
  const [fishingMiniGameStage, setFishingMiniGameStage] = useState<'direction' | 'power' | 'bite' | 'hit' | 'keep' | 'result'>('direction');
  const [fishingGauge, setFishingGauge] = useState(0);
  const [fishingCastAngle, setFishingCastAngle] = useState(0);
  const [fishingCastPower, setFishingCastPower] = useState(0);
  const [fishingFanConfigs, setFishingFanConfigs] = useState<Record<string, FishingFanConfig>>(loadFishingFanConfigs);
  const equippedFishingRod = equippedItems['主人公-slot1'] || '竹の釣竿';
  const fishingFanConfig = fishingFanConfigs[equippedFishingRod] ?? DEFAULT_FISHING_FAN_CONFIG;
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
  const [fishingBiteCountdown, setFishingBiteCountdown] = useState(3);
  const [fishingKeepSeconds, setFishingKeepSeconds] = useState(3);
  const [fishingKeepMissSeconds, setFishingKeepMissSeconds] = useState(0);
  const [fishingFishHp, setFishingFishHp] = useState(FISHING_FISH_MAX_HP);
  const [fishingTension, setFishingTension] = useState(0);
  const [fishingResultText, setFishingResultText] = useState('');
  const [fishingResultSizeCm, setFishingResultSizeCm] = useState('');
  const [fishingResultImageSrc, setFishingResultImageSrc] = useState(FISHING_SCENE_RESULT_SRC);
  const [isFishingHitSplashActive, setIsFishingHitSplashActive] = useState(false);
  const [isFishingHitIntroActive, setIsFishingHitIntroActive] = useState(false);
  const [fishingHitCountdown, setFishingHitCountdown] = useState(3);
  const [fishingHitLimitSeconds, setFishingHitLimitSeconds] = useState(10);
  const [isFishingKeepPressed, setIsFishingKeepPressed] = useState(false);
  const [kurumiShopOpen, setKurumiShopOpen] = useState(false);
  const [selectedShopItemIndex, setSelectedShopItemIndex] = useState(0);
  const [selectedShopControl, setSelectedShopControl] = useState<'items' | 'action' | 'close'>('items');
  const [isShopTradePose, setIsShopTradePose] = useState(false);
  const [activeKurumiTradeReward, setActiveKurumiTradeReward] = useState<KurumiTradeReward | null>(null);
  const [shownKurumiTradeRewardThresholds, setShownKurumiTradeRewardThresholds] = useState<number[]>([]);
  const shopTradePoseTimerRef = useRef<number | null>(null);
  const kurumiTradeRewardTimerRef = useRef<number | null>(null);
  const [confirmPromptChoice, setConfirmPromptChoice] = useState<'yes' | 'no'>('yes');
  const [sleepFadeOpacity, setSleepFadeOpacity] = useState(0);
  const [isSleepSequenceActive, setIsSleepSequenceActive] = useState(false);
  const sleepPromptBlockedRef = useRef(false);
  const craftPromptBlockedRef = useRef(false);
  const fishingPromptBlockedRef = useRef(false);
  const fishingGaugeDirectionRef = useRef(1);
  const fishingBiteTimerRef = useRef<number | null>(null);
  const fishingHitSplashTimerRef = useRef<number | null>(null);
  const fishingHitIntroTimerRef = useRef<number | null>(null);
  const fishingHitCountdownTimerRef = useRef<number | null>(null);
  const fishingRiverAudioRef = useRef<HTMLAudioElement | null>(null);
  const fishingReelAudioRef = useRef<HTMLAudioElement | null>(null);
  const isFishingKeepPressedRef = useRef(false);
  const movementLockedRef = useRef(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState<AnimZone[]>(defaultZones.map(ensureAnimZoneSpriteSize));
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);

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

  const [selectedAudioFile, setSelectedAudioFile] = useState('/bgm/farmbgm.wav');
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const bgmStartedRef = useRef(false);
  const bgmSourceRef = useRef('/bgm/farmbgm.wav');
  const bgmFadeRafRef = useRef<number | null>(null);
  const bgmFadingRef = useRef(false);
  const wasFishingBgmActiveRef = useRef(false);
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

  useEffect(() => {
     movementLockedRef.current = sleepPromptVisible || craftPromptVisible || fishingPromptVisible || fishingMiniGameOpen || kurumiShopOpen || isSleepSequenceActive;
  }, [sleepPromptVisible, craftPromptVisible, fishingPromptVisible, fishingMiniGameOpen, kurumiShopOpen, isSleepSequenceActive]);

  useEffect(() => {
     if (sleepPromptVisible || craftPromptVisible || fishingPromptVisible) {
        setConfirmPromptChoice('yes');
     }
  }, [sleepPromptVisible, craftPromptVisible, fishingPromptVisible]);

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
           const nextGauge = Math.max(0, Math.min(100, fishingGauge + (isFishingKeepPressedRef.current ? -2.6 : 1.8)));
           const isInGreenZone = nextGauge >= FISHING_KEEP_GREEN_MIN && nextGauge <= FISHING_KEEP_GREEN_MAX;
           setFishingGauge(nextGauge);
           setFishingFishHp(prev => isInGreenZone ? Math.max(0, prev - 1.15) : prev);
           setFishingTension(prev => (
              isInGreenZone
                 ? Math.max(0, prev - 0.8)
                 : Math.min(FISHING_TENSION_MAX, prev + 2.4)
           ));
        }
     }, 50);
     return () => window.clearInterval(timerId);
  }, [fishingMiniGameOpen, fishingMiniGameStage, fishingGauge, isFishingHitSplashActive]);

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
        window.clearTimeout(fishingBiteTimerRef.current);
     }
     const waitMs = 10000 + Math.random() * 20000;
     fishingBiteTimerRef.current = window.setTimeout(() => {
        setFishingMiniGameStage('hit');
        setFishingGauge(0);
        fishingGaugeDirectionRef.current = 1;
        fishingBiteTimerRef.current = null;
     }, waitMs);
     return () => {
        if (fishingBiteTimerRef.current !== null) {
           window.clearTimeout(fishingBiteTimerRef.current);
           fishingBiteTimerRef.current = null;
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
              setFishingResultText('魚に逃げられた...');
              setDialogMessage('魚に逃げられた...');
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
        const ugui = FISH_ZUKAN_ENTRIES[0];
        if (ugui && !caughtFishIds.includes(ugui.id)) {
          setCaughtFishIds(prev => [...prev, ugui.id]);
        }
        const sizeValue = Number((10 + Math.random() * 10).toFixed(1));
        const sizeCm = sizeValue.toFixed(1);
        if (ugui && sizeValue > (fishBestSizes[ugui.id] ?? 0)) {
          setFishBestSizes(prev => ({ ...prev, [ugui.id]: sizeValue }));
          setFishSizeUpdatedIds(prev => prev.includes(ugui.id) ? prev : [...prev, ugui.id]);
        }
        setInventoryCounts(prev => ({ ...prev, '川魚': (prev['川魚'] ?? 0) + 1 }));
        setFishingResultSizeCm(sizeCm);
        setFishingResultImageSrc(FISHING_SCENE_RESULT_SRC);
        setFishingResultText('お見事！ウグイを釣り上げた。');
        setDialogMessage(`お見事！ウグイを釣り上げた。`);
        playUiSound(IWANA_SPLASH_SOUND_SRC);
        setFishingMiniGameStage('result');
        return;
     }
     if (fishingTension >= FISHING_TENSION_MAX) {
        setFishingResultImageSrc(FISHING_SCENE_ESCAPE_SRC);
        setFishingResultSizeCm('');
        setFishingResultText('糸が切れて魚に逃げられた...');
        setDialogMessage('糸が切れて魚に逃げられた...');
        setFishingMiniGameStage('result');
     }
  }, [caughtFishIds, fishBestSizes, fishingFishHp, fishingTension, fishingMiniGameOpen, fishingMiniGameStage]);

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
  const [footstepTiles, setFootstepTiles] = useState<Record<string, FootstepSound>>({});
  const [selectedFootstepSound, setSelectedFootstepSound] = useState<FootstepSound | 'erase'>('grass');
  const [footstepBrushSize, setFootstepBrushSize] = useState<1 | 3 | 5>(1);
  const [wallBumpSound, setWallBumpSound] = useState<WallBumpSound>('door');
  const [footstepDrawMode, setFootstepDrawMode] = useState<FootstepSound | 'erase' | null>(null);

  const [bedTiles, setBedTiles] = useState<Record<string, boolean>>(createDefaultBedTiles());
  const [workbenchTiles, setWorkbenchTiles] = useState<Record<string, boolean>>({});
  const [fishingTiles, setFishingTiles] = useState<Record<string, boolean>>({});
  const [selectedEventTileType, setSelectedEventTileType] = useState<'bed' | 'workbench' | 'fishing' | 'inspect' | 'auto'>('bed');
  const [bedDrawMode, setBedDrawMode] = useState<boolean | null>(null);
  const [bathTubMaskZone, setBathTubMaskZone] = useState<RectZone>(DEFAULT_HOUSE_BATH_TUB_MASK_ZONE);

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

  // 起動時のセーブデータロード
  useEffect(() => {
    let active = true;
    fetch('/api/save')
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        if (data && Object.keys(data).length > 0) {
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
          
          if (data.wallBumpSound) setWallBumpSound(data.wallBumpSound);
          if (data.bedTiles) setBedTiles(normalizeTileRecord(data.bedTiles, isEnabledTileValue));
          if (data.workbenchTiles) setWorkbenchTiles(normalizeTileRecord(data.workbenchTiles, isEnabledTileValue));
          if (data.fishingTiles) setFishingTiles(normalizeTileRecord(data.fishingTiles, isEnabledTileValue));
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
        setIsLoading(false);
      })
      .catch(err => {
        console.error('セーブデータの読み込みに失敗しました:', err);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // 状態変更を検知して自動セーブする useEffect
  useEffect(() => {
    if (isLoading) return; // ロード中は保存しない

    const timer = setTimeout(() => {
      const saveData = {
        zones,
        doors,
        bgmVolume,
        seVolume,
        voiceVolume,
        audioGains,
        mapBgmSources,
        obstacles: normalizeTileRecord(obstacles, isEnabledTileValue),
        hideAreaTiles: normalizeTileRecord(hideAreaTiles, isEnabledTileValue),
        footstepTiles: normalizeTileRecord(footstepTiles, isFootstepTileValue),
        wallBumpSound,
        bedTiles: normalizeTileRecord(bedTiles, isEnabledTileValue),
        workbenchTiles: normalizeTileRecord(workbenchTiles, isEnabledTileValue),
        fishingTiles: normalizeTileRecord(fishingTiles, isEnabledTileValue),
        inspectSpots,
        plantedCrops,
        fieldCorners,
        fieldGridSizes,
        caughtFishIds,
        fishBestSizes,
        bathTubMaskZone
      };

      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData)
      }).catch(err => {
        console.error('自動セーブに失敗しました:', err);
      });
    }, 1000); // 1秒デバウンス

    return () => clearTimeout(timer);
  }, [
    isLoading,
    zones,
    doors,
    bgmVolume,
    seVolume,
    voiceVolume,
    audioGains,
    mapBgmSources,
    obstacles,
    hideAreaTiles,
    footstepTiles,
    wallBumpSound,
    bedTiles,
    workbenchTiles,
    fishingTiles,
    inspectSpots,
    plantedCrops,
    fieldCorners,
    fieldGridSizes,
    caughtFishIds,
    fishBestSizes,
    bathTubMaskZone
  ]);

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

  const resetFieldCorners = () => {
    setFieldCorners(DEFAULT_FIELD_CORNERS);
  };

  const resetFieldGridSizes = () => {
    setFieldGridSizes(DEFAULT_FIELD_GRID_SIZES);
    setPlantedCrops({});
  };

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

  const playVoiceSound = (src: string) => {
    try {
      const audio = new Audio(src);
      audio.volume = getEffectiveVolume(src, voiceVolumeRef.current, audioGainsRef.current);
      audio.currentTime = 0;
      void audio.play();
    } catch (e) {
      console.error(e);
    }
  };

  const playCursorSound = () => playUiSound(UI_CURSOR_SOUND_SRC);
  const playFixSound = () => playUiSound(UI_FIX_SOUND_SRC);

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

  useEffect(() => {
     return () => {
        if (shopTradePoseTimerRef.current !== null) {
           window.clearTimeout(shopTradePoseTimerRef.current);
        }
        if (kurumiTradeRewardTimerRef.current !== null) {
           window.clearTimeout(kurumiTradeRewardTimerRef.current);
        }
        if (fishingBiteTimerRef.current !== null) {
           window.clearTimeout(fishingBiteTimerRef.current);
        }
        if (fishingHitSplashTimerRef.current !== null) {
           window.clearTimeout(fishingHitSplashTimerRef.current);
        }
        if (fishingHitCountdownTimerRef.current !== null) {
           window.clearInterval(fishingHitCountdownTimerRef.current);
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
     const item = shopItems[selectedShopItemIndex] ?? shopItems[0];
     if (item.stock <= 0) {
        playFixSound();
        setDialogMessage(item.type === '買う' ? '売り切れです。' : '売却できる在庫がありません。');
        return;
     }
     if (item.type === '買う' && gold < item.price) {
        playFixSound();
        setDialogMessage('ゴールドが足りません。');
        return;
     }
     playUiSound('/se/coin.mp3');
     const nextTradeTotal = kurumiTradeTotal + item.price;
     const availableRewards = KURUMI_TRADE_REWARDS.filter(reward => (
        nextTradeTotal >= reward.threshold && !shownKurumiTradeRewardThresholds.includes(reward.threshold)
     ));
     const nextReward = availableRewards[availableRewards.length - 1] ?? null;
     setKurumiTradeTotal(nextTradeTotal);
     setGold(prev => item.type === '買う' ? prev - item.price : prev + item.price);
     setShopItems(prev => prev.map((shopItem, index) => (
        index === selectedShopItemIndex ? { ...shopItem, stock: Math.max(0, shopItem.stock - 1) } : shopItem
     )));
     setInventoryCounts(prev => ({
        ...prev,
        [item.name]: Math.max(0, (prev[item.name] ?? 0) + (item.type === '買う' ? 1 : -1)),
     }));
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
    setActiveAutoEventMessage(spot.text || spot.label || 'イベントが発生しました。');
    setActiveAutoEventSpot(spot);
    if (spot.seSrc) playEventAudio(spot.seSrc, 'se');
    if (spot.voiceSrc) playEventAudio(spot.voiceSrc, 'voice');
  };

  const closeAutoEventOverlay = () => {
    clickTargetRef.current = null;
    setClickTargetMarker(null);
    fadeOutEventAudio();
    setActiveAutoEventSpot(null);
    setActiveAutoEventMessage('');
    setDisplayedAutoEventMessage('');
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

    const currentSource = kurumiShopOpen ? SHOP_BGM_SRC : mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap];
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

    const currentSource = kurumiShopOpen ? SHOP_BGM_SRC : mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap];
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
      setTurn(t => (Math.floor(t / 4) + 1) * 4);
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
    setDialogMessage('クラフトを開始しました。');
  };

  const cancelCraftPrompt = () => {
    setCraftPromptVisible(false);
    craftPromptBlockedRef.current = true;
  };

  const startFishingPrompt = () => {
    setFishingPromptVisible(false);
    fishingPromptBlockedRef.current = true;
    setFishingMiniGameOpen(true);
    setFishingMiniGameStage('direction');
    setFishingGauge(50);
    setFishingCastAngle(0);
    setFishingCastPower(0);
    setFishingBiteCountdown(3);
    setFishingKeepSeconds(3);
    setFishingKeepMissSeconds(0);
    setFishingFishHp(FISHING_FISH_MAX_HP);
    setFishingTension(0);
    setFishingResultSizeCm('');
    setFishingResultImageSrc(FISHING_SCENE_RESULT_SRC);
    setIsFishingHitSplashActive(false);
    setFishingHitCountdown(3);
    setFishingHitLimitSeconds(10);
    setIsFishingKeepPressed(false);
    setFishingResultText('');
    fishingGaugeDirectionRef.current = 1;
    setDialogMessage('釣りを開始しました。');
  };

  const cancelFishingPrompt = () => {
    setFishingPromptVisible(false);
    fishingPromptBlockedRef.current = true;
  };

  const finishFishingMiniGame = () => {
    if (fishingBiteTimerRef.current !== null) {
      window.clearTimeout(fishingBiteTimerRef.current);
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
    setFishingMiniGameOpen(false);
    setFishingMiniGameStage('direction');
    setIsFishingHitSplashActive(false);
    setIsFishingHitIntroActive(false);
    setFishingHitCountdown(3);
    setFishingHitLimitSeconds(10);
    setIsFishingKeepPressed(false);
    setFishingResultText('');
    setFishingResultSizeCm('');
    setFishingResultImageSrc(FISHING_SCENE_RESULT_SRC);
    fishingPromptBlockedRef.current = true;
  };

  const handleFishingMiniGameAction = () => {
    playFixSound();
    if (fishingMiniGameStage === 'result') {
      finishFishingMiniGame();
      return;
    }
    if (isFishingHitSplashActive) {
      return;
    }
    if (fishingMiniGameStage === 'direction') {
      setFishingCastAngle(Math.round((fishingGauge - 50) * 1.2));
      setFishingMiniGameStage('power');
      setFishingGauge(0);
      fishingGaugeDirectionRef.current = 1;
      return;
    }
    if (fishingMiniGameStage === 'power') {
      setFishingCastPower(Math.round(fishingGauge));
      playUiSound(FISHING_CAST_SOUND_SRC);
      setFishingMiniGameStage('bite');
      setFishingGauge(50);
      setFishingHitLimitSeconds(10);
      setDialogMessage('魚の反応を待っています...');
      return;
    }
    if (fishingMiniGameStage === 'bite') {
      return;
    }
    if (fishingMiniGameStage === 'hit') {
      const success = fishingGauge >= 42 && fishingGauge <= 58;
      if (success) {
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
        fishingHitIntroTimerRef.current = window.setTimeout(() => {
          setIsFishingHitIntroActive(false);
          fishingHitIntroTimerRef.current = null;
        }, 700);
        fishingHitCountdownTimerRef.current = window.setInterval(() => {
          setFishingHitCountdown(prev => Math.max(1, prev - 1));
        }, 1000);
        fishingHitSplashTimerRef.current = window.setTimeout(() => {
          setIsFishingHitSplashActive(false);
          setIsFishingHitIntroActive(false);
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
        }, 3000);
        return;
      }
      setFishingResultImageSrc(FISHING_SCENE_ESCAPE_SRC);
      setFishingResultSizeCm('');
      setFishingResultText('HITを逃した...');
      setDialogMessage('HITを逃した...');
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
    return (
      x >= bathTubMaskZone.x &&
      x <= bathTubMaskZone.x + bathTubMaskZone.w &&
      y >= bathTubMaskZone.y &&
      y <= bathTubMaskZone.y + bathTubMaskZone.h
    );
  };

  const isPlayerInBath = isPlayerInBathArea(pos.x, pos.y, currentMap);
  const isPlayerInBathTubMask = isPlayerInBathTub(pos.x, pos.y, currentMap);

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

  const times: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];
  const timeOfDay = times[turn % 4];

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
    const audio = new Audio('/bgm/farmbgm.wav');
    audio.loop = true;
    audio.volume = getEffectiveVolume('/bgm/farmbgm.wav', bgmVolume, audioGainsRef.current);
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
    if (fishingMiniGameOpen || wasFishingBgmActiveRef.current) return;

    const nextSource = kurumiShopOpen ? SHOP_BGM_SRC : mapBgmSources[currentMap] ?? DEFAULT_MAP_BGM_SOURCES[currentMap];
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
  }, [currentMap, bgmVolume, audioGains, mapBgmSources, kurumiShopOpen, fishingMiniGameOpen]);

  // BGM音量変更時の反映
  useEffect(() => {
    if (fishingMiniGameOpen || wasFishingBgmActiveRef.current) return;
    if (bgmRef.current && !bgmFadingRef.current) {
      bgmRef.current.volume = getEffectiveVolume(bgmSourceRef.current, bgmVolume, audioGainsRef.current);
    }
  }, [bgmVolume, audioGains, fishingMiniGameOpen]);

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

      if (activeAutoEventSpot) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          closeAutoEventOverlay();
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
              const currentType = shopItems[prev]?.type ?? '買う';
              const sameTypeItems = shopItems
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
              const sellIndex = shopItems.findIndex(item => item.type === '売る');
              if (sellIndex >= 0) setSelectedShopItemIndex(sellIndex);
              setSelectedShopControl('items');
            }
          } else {
            const currentType = shopItems[selectedShopItemIndex]?.type ?? '買う';
            if (e.key === 'ArrowRight' && currentType === '買う') {
              const sellIndex = shopItems.findIndex(item => item.type === '売る');
              if (sellIndex >= 0) setSelectedShopItemIndex(sellIndex);
            } else if (e.key === 'ArrowRight') {
              setSelectedShopControl('action');
            } else if (e.key === 'ArrowLeft' && currentType === '売る') {
              const buyIndex = shopItems.findIndex(item => item.type === '買う');
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

      if (sleepPromptVisible || craftPromptVisible || fishingPromptVisible) {
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
          } else {
            cancelFishingPrompt();
          }
          return;
        }
        return;
      }

      if (!menuOpenRef.current && setupMode === 'none' && (e.key === 'Enter' || e.key === ' ')) {
        const playerPos = posRef.current;
        const currentKurumi = zones.find(zone => (
          zone.type === 'kurumi' &&
          (!zone.map || zone.map === currentMapRef.current) &&
          isAnimZoneVisibleAtTime(zone, timeOfDay)
        ));
        if (currentKurumi) {
          const kurumiCenterX = currentKurumi.x + currentKurumi.w / 2;
          const kurumiCenterY = currentKurumi.y + currentKurumi.h / 2;
          const dx = playerPos.x - kurumiCenterX;
          const dy = playerPos.y - kurumiCenterY;
          if (Math.sqrt(dx * dx + dy * dy) < 180) {
            e.preventDefault();
            playFixSound();
            playVoiceSound(KURUMI_SHOP_SOUND_SRC);
            clickTargetRef.current = null;
            setClickTargetMarker(null);
            setKurumiShopOpen(true);
            setSelectedShopItemIndex(0);
            setSelectedShopControl('items');
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
        const itemByTab: Record<string, string[]> = {
          '消耗品': ['薬草', '携帯おにぎり', '気付け水', '小さな釣り餌'],
          '素材': ['川魚', '木材', '石材', '薬草の葉', '川魚の鱗'],
          '装備品': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', 'のこぎり', '丈夫なのこぎり', '高級のこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '農神の指輪'],
          '売却品': ['小さな宝石', '古びた硬貨', '乾いたハーブ', '余った作物'],
          'だいじなもの': ['古い鍵', '農場契約書', '母屋の地図', '娘管理台帳'],
        };
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
            const currentItems = itemByTab[itemMenuTabRef.current] ?? itemByTab['消耗品'];
            const currentIndex = Math.max(0, currentItems.indexOf(selectedItemNameRef.current));

            if (menuContentFocusRef.current === 'primary') {
              if (e.key === 'ArrowLeft') {
                setMenuFocusArea('nav');
              } else if (e.key === 'ArrowRight') {
                setMenuContentFocus('secondary');
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const nextTab = tabs[Math.max(0, Math.min(tabs.length - 1, tabIndex + (e.key === 'ArrowDown' ? 1 : -1)))];
                setItemMenuTab(nextTab);
                setSelectedItemName(itemByTab[nextTab][0]);
              }
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
            if (e.key === 'ArrowUp' && currentIndex < 5) {
              setMenuContentFocus('primary');
              return;
            }
            if (e.key === 'ArrowLeft' && currentIndex % 5 === 0) {
              setMenuContentFocus('primary');
              return;
            }
            setSelectedZukanIndex(moveGridIndex(currentIndex, e.key, 5, zukanLength));
            return;
          }

          if (currentMenuItem.id === 'item') {
            const tabs = Object.keys(itemByTab);
            const currentItems = itemByTab[itemMenuTabRef.current] ?? itemByTab['消耗品'];
            const currentIndex = Math.max(0, currentItems.indexOf(selectedItemNameRef.current));
            if (e.key === 'ArrowLeft' && currentIndex % 2 === 0) {
              const tabIndex = Math.max(0, tabs.indexOf(itemMenuTabRef.current));
              if (tabIndex === 0) {
                setMenuFocusArea('nav');
              } else {
                const nextTab = tabs[tabIndex - 1];
                setItemMenuTab(nextTab);
                setSelectedItemName(itemByTab[nextTab][0]);
              }
              return;
            }
            if (e.key === 'ArrowRight' && currentIndex % 2 === 1) {
              const tabIndex = Math.max(0, tabs.indexOf(itemMenuTabRef.current));
              const nextTab = tabs[Math.min(tabs.length - 1, tabIndex + 1)];
              setItemMenuTab(nextTab);
              setSelectedItemName(itemByTab[nextTab][0]);
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
              '釣具系': ['竹の釣竿', '丈夫な釣竿', '高級釣竿'],
              '採取道具系': ['のこぎり', '丈夫なのこぎり', '高級のこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし'],
              'アクセサリー': ['農神の指輪'],
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
              if (e.key === 'ArrowLeft') {
                setEquipmentActionOpen(false);
              } else if (!currentEquippedItem && currentEquipableItems.length > 0 && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                setSelectedEquipmentOptionIndex(prev => (
                  prev + (e.key === 'ArrowDown' ? 1 : -1) + currentEquipableItems.length
                ) % currentEquipableItems.length);
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
            if (e.key === 'ArrowLeft' && currentIndex % 5 === 0) {
              setMenuFocusArea('nav');
              return;
            }
            setSelectedZukanIndex(moveGridIndex(currentIndex, e.key, 5, zukanLength));
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
            const itemByTab: Record<string, string[]> = {
              '消耗品': ['薬草', '携帯おにぎり', '気付け水', '小さな釣り餌'],
              '素材': ['川魚', '木材', '石材', '薬草の葉', '川魚の鱗'],
              '装備品': ['竹の釣竿', '丈夫な釣竿', '高級釣竿', 'のこぎり', '丈夫なのこぎり', '高級のこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし', '農神の指輪'],
              '売却品': ['小さな宝石', '古びた硬貨', '乾いたハーブ', '余った作物'],
              'だいじなもの': ['古い鍵', '農場契約書', '母屋の地図', '娘管理台帳'],
            };
            setSelectedItemName(prev => {
              const currentItems = itemByTab[itemMenuTabRef.current] ?? itemByTab['消耗品'];
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
              const currentDay = Math.floor(turn / 4) + 1;
              const repaymentCycleDays = 7;
              const daysUntilRepayment = repaymentCycleDays - ((currentDay - 1) % repaymentCycleDays);
              const farmInfoItems = [
                ['信用度', '35 / 100'],
                ['次の返済日', `残り ${daysUntilRepayment} 日`],
                ['借入金', '100,000,000 G'],
                ['金利', '3.2%'],
                ['経過日数', `${currentDay} 日`],
                ['設備', '柵 Lv1'],
                ['設備', '電気柵 未設置'],
                ['設備', '箱罠 x2'],
              ];
              const selectedInfo = farmInfoItems[selectedFarmFacilityIndexRef.current];
              if (selectedInfo) setDialogMessage(`${selectedInfo[0]}: ${selectedInfo[1]}`);
            } else {
              const selectedName = menuGirls[selectedFarmGirlIndexRef.current]?.name;
              if (selectedName) setDialogMessage(`${selectedName}のお世話画面を開きました。`);
            }
          } else if (currentMenuItem.id === 'item') {
            setDialogMessage(`${selectedItemNameRef.current}を確認しました。`);
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
              '釣具系': ['竹の釣竿', '丈夫な釣竿', '高級釣竿'],
              '採取道具系': ['のこぎり', '丈夫なのこぎり', '高級のこぎり', 'つるはし', '丈夫なつるはし', '高級つるはし'],
              'アクセサリー': ['農神の指輪'],
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
        const currentDoors = doorsRef.current.filter(d => d.map === currentMapRef.current);
        for (const d of currentDoors) {
           // プレイヤーの足元の衝突判定矩形（[x - 15, x + 15] x [y - 10, y]）と扉の矩形（[d.x, d.x + d.w] x [d.y, d.y + d.h]）の交差判定を行います。
           // これにより、扉の手前に衝突判定の壁があっても、プレイヤーが少し重なるだけでワープできるようになります。
           const pLeft = nx - 15;
           const pRight = nx + 15;
           const pTop = ny - 10;
           const pBottom = ny;
           
           if (pRight >= d.x && pLeft <= d.x + d.w && pBottom >= d.y && pTop <= d.y + d.h) {
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
      } else if (!craftPromptBlockedRef.current && !isInBed) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setCraftPromptVisible(true);
        movementLockedRef.current = true;
      }

      const isInFishingPoint = isTouchingFishingPoint(currentX, currentY);
      const hasEquippedFishingRod = Boolean(equippedItems['主人公-slot1'] && equippedItems['主人公-slot1'].includes('釣竿'));
      if (!isInFishingPoint) {
        fishingPromptBlockedRef.current = false;
      } else if (!fishingPromptBlockedRef.current && !isInBed && !isInWorkbench && hasEquippedFishingRod) {
        moved = false;
        clickTargetRef.current = null;
        setClickTargetMarker(null);
        setFishingPromptVisible(true);
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
  }, [setupMode, bedTiles, workbenchTiles, fishingTiles, sleepPromptVisible, craftPromptVisible, fishingPromptVisible, confirmPromptChoice, activeAutoEventSpot, kurumiShopOpen, selectedShopControl, selectedShopItemIndex, shopItems, gold, equipmentActionOpen, equippedItems, inventoryCounts, caughtFishIds, fishingMiniGameOpen, fishingMiniGameStage]);

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
                 : fishingTiles;
           const drawMode = !currentTiles[key];
           setBedDrawMode(drawMode);
           if (selectedEventTileType === 'bed') {
              paintBedTile(clickX, clickY, drawMode);
           } else if (selectedEventTileType === 'workbench') {
              paintWorkbenchTile(clickX, clickY, drawMode);
           } else {
              paintFishingTile(clickX, clickY, drawMode);
           }
        }
     } else if (setupMode === 'bathTub') {
        if (currentMap !== 'house') return;
        setBathTubMaskZone(prev => {
           const nextX = Math.round((clickX - prev.w / 2) / 10) * 10;
           const nextY = Math.round((clickY - prev.h / 2) / 10) * 10;
           return {
              ...prev,
              x: Math.max(0, Math.min(nextX, GAME_WIDTH - prev.w)),
              y: Math.max(0, Math.min(nextY, GAME_HEIGHT - prev.h)),
           };
        });
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
     } else if (setupMode === 'footstep' && footstepDrawMode) {
        paintFootstepTile(clickX, clickY, footstepDrawMode);
     } else if (setupMode === 'bed' && bedDrawMode !== null) {
        if (selectedEventTileType === 'bed' && currentMap === 'house') {
           paintBedTile(clickX, clickY, bedDrawMode);
        } else if (selectedEventTileType === 'workbench') {
           paintWorkbenchTile(clickX, clickY, bedDrawMode);
        } else if (selectedEventTileType === 'fishing') {
           paintFishingTile(clickX, clickY, bedDrawMode);
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

     const handlePointerUp = () => {
        setIsDraggingDebug(false);
     };

     window.addEventListener('pointermove', handlePointerMove);
     window.addEventListener('pointerup', handlePointerUp);
     return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
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

  const handleAnimationZoneClick = (id: string) => {
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
     if (Math.sqrt(dx * dx + dy * dy) >= 180) return;

     playFixSound();
     playVoiceSound(KURUMI_SHOP_SOUND_SRC);
     clickTargetRef.current = null;
     setClickTargetMarker(null);
     setSelectedShopItemIndex(0);
     setSelectedShopControl('items');
     setKurumiShopOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-4 py-8 overflow-hidden select-none" style={{ fontFamily: '"DotGothic16", sans-serif' }}>
      <div style={{ width: 1920 * scale, height: 1156 * scale, position: 'relative' }}>
        <div className="w-[1920px] bg-[#9bb869] border-[8px] border-[#222] rounded-md flex flex-col relative overflow-hidden shadow-2xl" style={{ height: '1156px', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          
        {/* Header UI */}
        <div className="h-[60px] bg-[#2d1b15] border-b-[4px] border-[#bc6c25] flex items-center justify-between px-6 z-40 text-[#fdf6e3]">
          <div className="flex gap-10 text-lg">
            <span className="flex items-center gap-2">
              <span className="text-[#a3b18a] text-sm mt-1">DAY</span> 
              {String(Math.floor(turn / 4) + 1).padStart(3, '0')}
            </span>
            <span className="flex items-center gap-2 text-[#f4a261]">
              <span className="text-[#fdf6e3] text-sm mt-1">TIME</span> 
              {timeLabels[timeOfDay]}
            </span>
            <span className="flex items-center gap-2 text-[#dda15e]">
              <span className="text-[#fdf6e3] text-sm mt-1">GOLD</span> {gold.toLocaleString()} G
            </span>
            <span className="flex items-center gap-2 text-[#a3b18a]">
              <span className="text-[#fdf6e3] text-sm mt-1">行動回数</span> {actionCountLabel}
            </span>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={() => setTurn(t => t + 1)} 
               className="px-3 py-1 text-sm border-2 bg-[#dda15e] border-[#bc6c25] text-[#2d1b15] hover:bg-[#e9b872] shadow-sm font-bold cursor-pointer"
             >
               🕒 ターン進む
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
                 {/* 右 of 畑 (26列 x 10行, 1マス30px) */}
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
              zones={zones.filter(z => (!z.map || z.map === currentMap) && isAnimZoneVisibleAtTime(z, timeOfDay))} 
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
                    return (
                       <div 
                          key={idx} 
                          className={`border-[0.5px] border-black/10 transition-colors ${isFishingTile ? 'bg-cyan-300/60' : isWorkbenchTile ? 'bg-sky-400/55' : isBedTile ? 'bg-violet-500/50' : 'hover:bg-white/20'}`} 
                       />
                    );
                 })}
              </div>
           )}

           {/* Bath Tub Mask Overlay */}
           {setupMode === 'bathTub' && currentMap === 'house' && (
              <div
                 onPointerDown={handleBathTubMaskDragStart}
                 className="absolute z-40 border-[3px] border-dashed border-cyan-200 bg-cyan-300/35 cursor-move shadow-[0_0_16px_rgba(103,232,249,0.75)]"
                 style={{ left: bathTubMaskZone.x, top: bathTubMaskZone.y, width: bathTubMaskZone.w, height: bathTubMaskZone.h }}
              >
                 <div className="absolute -top-6 left-0 bg-cyan-700 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap select-none">
                    ♨️ 湯船マスク
                 </div>
                 <div
                    onPointerDown={handleBathTubMaskResizeStart}
                    className="absolute bottom-[-7px] right-[-7px] w-4 h-4 bg-yellow-300 border-2 border-black cursor-se-resize z-50 rounded-sm"
                    title="サイズ変更"
                 />
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
             const equippedRod = equippedFishingRod;
             const isSturdyRod = equippedRod === '丈夫な釣竿' || equippedRod === '高級釣竿';
             const radiusX = fishingFanConfig.width / 2;
             const radiusY = fishingFanConfig.height;
             const width = radiusX * 2 + 108;
             const height = radiusY + 76;
             const centerX = width / 2;
             const baseY = height - 24;
             const angleDeg = (fishingGauge - 50) * 1.2;
             const angleRad = angleDeg * Math.PI / 180;
             const needleLength = radiusY - 18;
             const needleX = centerX + Math.sin(angleRad) * needleLength;
             const needleY = baseY - Math.cos(angleRad) * needleLength;
             const leftX = centerX - radiusX;
             const rightX = centerX + radiusX;
             const topY = baseY - radiusY;
             const sweetSpotRadiusX = radiusX * (isSturdyRod ? 0.34 : 0.28);
             const sweetSpotRadiusY = radiusY * (isSturdyRod ? 0.44 : 0.36);

             return (
             <div
                className="absolute z-[82] pointer-events-auto -translate-x-1/2 -translate-y-full"
                style={{ left: pos.x, top: Math.max(height + 62, pos.y - 34), width, height }}
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
                   <path
                      d={`M${centerX} ${baseY} L${leftX} ${topY} A${radiusX} ${radiusY} 0 0 1 ${rightX} ${topY} Z`}
                      fill={`rgba(253, 246, 227, ${fishingFanConfig.opacity})`}
                   />
                   <path
                      d={`M${centerX} ${baseY} L${centerX - sweetSpotRadiusX} ${baseY - sweetSpotRadiusY} A${sweetSpotRadiusX} ${sweetSpotRadiusY} 0 0 1 ${centerX + sweetSpotRadiusX} ${baseY - sweetSpotRadiusY} Z`}
                      fill="rgba(255, 209, 102, 0.16)"
                   />
                   <line
                      x1={centerX}
                      y1={baseY}
                      x2={needleX}
                      y2={needleY}
                      stroke="#ffd166"
                      strokeWidth="8"
                      strokeLinecap="round"
                   />
                   <line
                      x1={centerX}
                      y1={baseY}
                      x2={needleX}
                      y2={needleY}
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="2"
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
             />
          )}

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

        {fishingMiniGameOpen && fishingMiniGameStage !== 'direction' && (() => {
           const fishingSceneImage = fishingMiniGameStage === 'result'
              ? fishingResultImageSrc
              : fishingMiniGameStage === 'power'
                 ? FISHING_SCENE_CAST_SRC
                 : (fishingMiniGameStage === 'hit' || fishingMiniGameStage === 'keep')
                 ? FISHING_SCENE_HIT_SRC
                 : FISHING_SCENE_UKI_SRC;
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
                    <img
                       key={fishingSceneImage}
                       src={fishingSceneImage}
                       alt="釣り"
                       className="h-full w-full object-cover opacity-100 transition-opacity duration-700"
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.28)_100%)]" />
                    {(fishingMiniGameStage === 'hit' || isFishingHitSplashActive) && (
                       <>
                          {(!isFishingHitSplashActive || isFishingHitIntroActive) && (
                             <img
                                key={isFishingHitIntroActive ? 'hit-intro' : 'hit-gauge'}
                                src={FISHING_SCENE_HIT_OVERLAY_SRC}
                                alt="HIT"
                                className="absolute inset-0 z-20 h-full w-full object-cover animate-[farmHitFrameBurst_0.62s_cubic-bezier(0.16,1.18,0.28,1)_both] drop-shadow-[0_0_26px_rgba(255,209,102,0.95)]"
                             />
                          )}
                          {isFishingHitSplashActive && (
                             <div className="absolute inset-0 bg-black/10">
                                <img
                                   key={fishingHitCountdown}
                                   src={`/img/${fishingHitCountdown}.png`}
                                   alt={`${fishingHitCountdown}`}
                                   className={`absolute left-1/2 top-1/2 h-[76%] max-h-[360px] w-[76%] max-w-[360px] -translate-x-1/2 -translate-y-1/2 object-contain animate-[farmHitZoom_0.28s_cubic-bezier(0.2,1.35,0.28,1)_both] drop-shadow-[0_0_26px_rgba(255,209,102,0.95)] ${isFishingHitIntroActive ? 'opacity-0' : 'opacity-100'}`}
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
                                      left: `${FISHING_KEEP_GREEN_MIN}%`,
                                      width: `${FISHING_KEEP_GREEN_MAX - FISHING_KEEP_GREEN_MIN}%`,
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
                                ? '水面を見つめて、魚が食いつく瞬間を待とう'
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
                             <div className="rounded bg-[#22c55e]/25 px-2 py-1 text-[#bbf7d0]">90-100% BEST</div>
                             <div className="rounded bg-[#ef4444]/25 px-2 py-1 text-[#fecaca]">100-105% OVER</div>
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
                       <div className="mt-3 text-sm text-[#c8a87a]">クリック / Enter / Space で閉じる</div>
                    </div>
                 )}
              </div>
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
                    </div>
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
           shopItems={shopItems}
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
                           <p className="text-[17px] font-bold">湯船に浸かった時だけ肩まで隠す範囲を調整します。</p>
                           <p className="text-[#a3b18a] text-[13px] mt-1">家マップで水色の枠をドラッグ、右下ハンドルでサイズ変更。マップクリックで枠を移動できます。</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1a100d]/95 border-[2px] border-[#bc6c25] rounded-lg p-2 text-xs text-[#fdf6e3] z-50">
                           <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                              {(['x', 'y', 'w', 'h'] as const).map(key => (
                                 <label key={key} className="flex items-center gap-1 uppercase">{key}:
                                    <input
                                       type="number"
                                       value={Math.round(bathTubMaskZone[key])}
                                       onChange={(e) => {
                                          const val = Number(e.target.value);
                                          setBathTubMaskZone(prev => {
                                             const next = { ...prev, [key]: val };
                                             next.w = Math.max(20, Math.min(next.w, GAME_WIDTH - next.x));
                                             next.h = Math.max(20, Math.min(next.h, GAME_HEIGHT - next.y));
                                             next.x = Math.max(0, Math.min(next.x, GAME_WIDTH - next.w));
                                             next.y = Math.max(0, Math.min(next.y, GAME_HEIGHT - next.h));
                                             return next;
                                          });
                                       }}
                                       className="bg-black text-[#fdf6e3] border border-[#bc6c25] rounded w-16 px-1 text-center font-bold"
                                    />
                                 </label>
                              ))}
                           </div>
                           <button
                              onClick={() => setBathTubMaskZone(DEFAULT_HOUSE_BATH_TUB_MASK_ZONE)}
                              className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs px-3 py-2 rounded cursor-pointer font-bold transition-colors self-end"
                           >
                              初期位置
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
                        <div className="flex items-center gap-2">
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
        />
      </div>
     </div>
    </div>
  );
}
