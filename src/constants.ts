import type {
  AudioCategory,
  FieldCornerMap,
  FieldGridSizeMap,
  FootstepSound,
  GameMap,
  PlayerDirection,
  TimeOfDay,
  WallBumpSound,
} from './types';

export const mapBgUrls = {
  morning: '/img/bokujo-asa.jpg',
  day: '/img/bokujo-hiru.jpg',
  evening: '/img/bokujo-yuu.jpg',
  night: '/img/bokujo-yoru.jpg'
};

export const waterfallBgUrls = {
  morning: '/img/takitsubo-asa.jpg',
  day: '/img/takitsubo-hiru.jpg',
  evening: '/img/takitsubo-yuu.jpg',
  night: '/img/takitsubo-yoru.jpg'
};

export const kawaBgUrls = {
  morning: '/img/kawa-asa.jpg',
  day: '/img/kawa-hiru.jpg',
  evening: '/img/kawa-yuu.jpg',
  night: '/img/kawa-yoru.jpg'
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: '朝 🌅',
  day: '昼 ☀️',
  evening: '夕方 🌇',
  night: '夜 🌙',
};

// 畑の四隅の座標（1920x1080キャンバス上のピクセル座標）
export const LEFT_FIELD_CORNERS = {
  topLeft: { x: 195, y: 556 },
  topRight: { x: 775, y: 556 },
  bottomRight: { x: 755, y: 849 },
  bottomLeft: { x: 150, y: 849 }
};

export const RIGHT_FIELD_CORNERS = {
  topLeft: { x: 910, y: 558 },
  topRight: { x: 1665, y: 558 },
  bottomRight: { x: 1640, y: 855 },
  bottomLeft: { x: 893, y: 855 }
};

export const mapBackgrounds: Record<GameMap, string | Record<TimeOfDay, string>> = {
  farm: mapBgUrls,
  waterfall: waterfallBgUrls,
  kawa: kawaBgUrls,
  house: '/img/ie.png',
  shed: '/img/koya.png',
  doukutsu: '/img/doukutsu.png',
  takiura: '/img/takiura.png',
};

export const DEFAULT_FIELD_CORNERS: FieldCornerMap = {
  left: LEFT_FIELD_CORNERS,
  right: RIGHT_FIELD_CORNERS,
};

export const DEFAULT_FIELD_GRID_SIZES: FieldGridSizeMap = {
  left: { cols: 21, rows: 10 },
  right: { cols: 26, rows: 10 },
};

export const playerSpriteUrls: Record<PlayerDirection, string> = {
  down: new URL('./assets/images/player_down.png', import.meta.url).href,
  up: new URL('./assets/images/player_up.png', import.meta.url).href,
  left: new URL('./assets/images/player_left.png', import.meta.url).href,
  right: new URL('./assets/images/player_right.png', import.meta.url).href,
};

export const playerWalkSpriteUrls = {
  downWalk1: new URL('./assets/images/player_down_walk1.png', import.meta.url).href,
  downWalk2: new URL('./assets/images/player_down_walk2.png', import.meta.url).href,
  upWalk1: new URL('./assets/images/player_up_walk1.png', import.meta.url).href,
  upWalk2: new URL('./assets/images/player_up_walk2.png', import.meta.url).href,
  leftWalk1: new URL('./assets/images/player_left_walk1.png', import.meta.url).href,
};

export const furoSpriteUrls: Record<PlayerDirection, string> = {
  down: new URL('./assets/images/furo_down.png', import.meta.url).href,
  up: new URL('./assets/images/furo_up.png', import.meta.url).href,
  left: new URL('./assets/images/furo_left.png', import.meta.url).href,
  right: new URL('./assets/images/furo_right.png', import.meta.url).href,
};

export const furoWalkSpriteUrls = {
  downWalk1: new URL('./assets/images/furo_down_walk1.png', import.meta.url).href,
  downWalk2: new URL('./assets/images/furo_down_walk2.png', import.meta.url).href,
  upWalk1: new URL('./assets/images/furo_up_walk1.png', import.meta.url).href,
  upWalk2: new URL('./assets/images/furo_up_walk2.png', import.meta.url).href,
  leftWalk1: new URL('./assets/images/furo_left_walk1.png', import.meta.url).href,
  leftWalk2: new URL('./assets/images/furo_left_walk2.png', import.meta.url).href,
  rightWalk1: new URL('./assets/images/furo_right_walk1.png', import.meta.url).href,
  rightWalk2: new URL('./assets/images/furo_right_walk2.png', import.meta.url).href,
};

export const playerWalkSprites: Record<PlayerDirection, [string, string, string, string]> = {
  down: [
    playerSpriteUrls.down,
    playerWalkSpriteUrls.downWalk1,
    playerSpriteUrls.down,
    playerWalkSpriteUrls.downWalk2,
  ],
  up: [
    playerSpriteUrls.up,
    playerWalkSpriteUrls.upWalk1,
    playerSpriteUrls.up,
    playerWalkSpriteUrls.upWalk2,
  ],
  left: [
    playerSpriteUrls.left,
    playerWalkSpriteUrls.leftWalk1,
    playerSpriteUrls.left,
    playerWalkSpriteUrls.leftWalk1,
  ],
  right: [
    playerSpriteUrls.left,
    playerWalkSpriteUrls.leftWalk1,
    playerSpriteUrls.left,
    playerWalkSpriteUrls.leftWalk1,
  ],
};

export const furoWalkSprites: Record<PlayerDirection, [string, string, string, string]> = {
  down: [
    furoSpriteUrls.down,
    furoWalkSpriteUrls.downWalk1,
    furoSpriteUrls.down,
    furoWalkSpriteUrls.downWalk2,
  ],
  up: [
    furoSpriteUrls.up,
    furoWalkSpriteUrls.upWalk1,
    furoSpriteUrls.up,
    furoWalkSpriteUrls.upWalk2,
  ],
  left: [
    furoSpriteUrls.left,
    furoWalkSpriteUrls.leftWalk1,
    furoSpriteUrls.left,
    furoWalkSpriteUrls.leftWalk2,
  ],
  right: [
    furoSpriteUrls.right,
    furoWalkSpriteUrls.rightWalk1,
    furoSpriteUrls.right,
    furoWalkSpriteUrls.rightWalk2,
  ],
};

export const FOOTSTEP_SOUNDS: Record<FootstepSound, { label: string; src: string; color: string; playbackRate: number }> = {
  soil: { label: '土', src: '/se/soil.mp3', color: 'bg-amber-700/50', playbackRate: 2.0 },
  grass: { label: '草', src: '/se/grass.mp3', color: 'bg-green-500/45', playbackRate: 2.0 },
  foot: { label: '家の床', src: '/se/foot.mp3', color: 'bg-orange-300/45', playbackRate: 2.0 },
  rainw: { label: '濡れ地面', src: '/se/rainw.mp3', color: 'bg-sky-500/45', playbackRate: 2.0 },
  rock: { label: '石・タイル', src: '/se/rock.mp3', color: 'bg-slate-400/45', playbackRate: 2.0 },
  jutan: { label: '絨毯', src: '/se/jutan.mp3', color: 'bg-red-400/45', playbackRate: 2.0 },
};

export const WALL_BUMP_SOUNDS: Record<WallBumpSound, { label: string; src: string | null }> = {
  soil: { label: '土', src: '/se/soil.mp3' },
  grass: { label: '草', src: '/se/grass.mp3' },
  foot: { label: '家の床', src: '/se/foot.mp3' },
  rainw: { label: '濡れ地面', src: '/se/rainw.mp3' },
  rock: { label: '石・タイル', src: '/se/rock.mp3' },
  jutan: { label: '絨毯', src: '/se/jutan.mp3' },
  door: { label: 'ドン', src: '/se/don.mp3' },
  off: { label: 'なし', src: null },
};

export const IWANA_SPLASH_SOUND_SRC = '/se/Water-splash.mp3';
export const KURUMI_DEFAULT_SPRITE_W = 96;
export const KURUMI_DEFAULT_SPRITE_H = 132;
export const SPEED = 4;
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const DEBUG_PANEL_WIDTH = 240;
export const DIALOG_BOX_DEFAULT_WIDTH = 640;
export const DIALOG_BOX_MIN_HEIGHT = 120;
export const DIALOG_BOX_MIN_WIDTH = 420;
export const DIALOG_BOX_MAX_HEIGHT = 420;
export const DEFAULT_SYSTEM_MESSAGE = '「アニメ領域設定」でマップ上に動きを配置し、煙突から煙を出したり池に鳥を浮かべることができます。';
export const WATERFALL_BASIN_POINT = { x: 610, y: 560 };
export const TAKIURA_WATERFALL_POINT = { x: 514, y: 520 };
export const DOUKUTSU_WATERFALL_POINT = { x: 960, y: 540 };
export const HOUSE_FIREPLACE_POINT = { x: 950, y: 435 };
export const WATERFALL_HEAR_DISTANCE = 900;
export const WATERFALL_MIN_GAIN = 0.18;
export const WATERFALL_SOUND_SRC = '/se/taki.mp3';
export const RIVER_SOUND_SRC = '/se/river.mp3';
export const CICADA_SOUND_SRC = '/se/semi.mp3';
export const FIREPLACE_SOUND_SRC = '/se/Fireplace.mp3';
export const UI_CURSOR_SOUND_SRC = '/se/cursor.mp3';
export const UI_FIX_SOUND_SRC = '/se/fix.mp3';
export const UI_SUCCESS_SOUND_SRC = '/se/success.mp3';
export const BATH_CHANGE_SOUND_SRC = '/se/cloak.mp3';
export const BATH_SPLASH_SOUND_SRC = '/se/chapon.mp3';
export const FISH_RESULT_SOUND_SRC = '/voice/fish-result.wav';
export const FISH_LOSE_SOUND_SRC = '/voice/fish-lose.wav';
export const TITLE_BGM_SRC = '/bgm/title.mp3';
export const SHOP_BGM_SRC = '/bgm/shop.mp3';
export const KURUMI_SHOP_SOUND_SRC = '/voice/kurumi.wav';
export const KURUMI_START_SOUND_SRC = '/voice/kurumi-start.wav';
export const KURUMI_START2_SOUND_SRC = '/voice/kurumi-start2.wav';
export const KURUMI_START3_SOUND_SRC = '/voice/kurumi-start3.wav';
export const KURUMI_START4_SOUND_SRC = '/voice/kurumi-start4.wav';
export const KURUMI_START5_SOUND_SRC = '/voice/kurumi-start5.wav';
export const RIVER_HEAR_DISTANCE = 360;
export const FIREPLACE_HEAR_DISTANCE = 520;
export const FARM_RIVER_POINTS = [
  { x: 1390, y: 235 },
  { x: 1490, y: 360 },
  { x: 1480, y: 500 },
  { x: 1590, y: 650 },
  { x: 1540, y: 850 },
  { x: 1480, y: 1040 },
];

export const AUDIO_FILE_ENTRIES: { src: string; label: string; category: AudioCategory }[] = [
  { src: TITLE_BGM_SRC, label: 'BGM: タイトル', category: 'bgm' },
  { src: '/bgm/farmbgm.wav', label: 'BGM: 牧場', category: 'bgm' },
  { src: '/bgm/ie.mp3', label: 'BGM: 家・小屋', category: 'bgm' },
  { src: '/bgm/yado.mp3', label: 'BGM: 宿（就寝）', category: 'bgm' },
  { src: SHOP_BGM_SRC, label: 'BGM: くるみ商店', category: 'bgm' },
  { src: '/se/zoon2.wav', label: 'BGM: 滝ゾーン', category: 'bgm' },
  { src: WATERFALL_SOUND_SRC, label: 'SE: 滝の音', category: 'se' },
  { src: FIREPLACE_SOUND_SRC, label: 'SE: 暖炉 Fireplace', category: 'se' },
  { src: RIVER_SOUND_SRC, label: 'SE: 川の音', category: 'se' },
  { src: CICADA_SOUND_SRC, label: 'SE: セミ', category: 'se' },
  { src: '/se/soil.mp3', label: 'SE: 土（歩行）', category: 'se' },
  { src: '/se/grass.mp3', label: 'SE: 草（歩行）', category: 'se' },
  { src: '/se/foot.mp3', label: 'SE: 家の床', category: 'se' },
  { src: '/se/rainw.mp3', label: 'SE: 濡れ地面', category: 'se' },
  { src: '/se/rock.mp3', label: 'SE: 石・タイル', category: 'se' },
  { src: '/se/jutan.mp3', label: 'SE: 絨毯', category: 'se' },
  { src: '/se/don.mp3', label: 'SE: ドン（壁）', category: 'se' },
  { src: '/se/door.mp3', label: 'SE: ドア', category: 'se' },
  { src: '/se/suzume.mp3', label: 'SE: 雀（就寝）', category: 'se' },
  { src: '/se/bird.wav', label: 'SE: 鳥の羽ばたき', category: 'se' },
  { src: IWANA_SPLASH_SOUND_SRC, label: 'SE: 魚の水はね', category: 'se' },
  { src: UI_CURSOR_SOUND_SRC, label: 'SE: カーソル', category: 'se' },
  { src: UI_FIX_SOUND_SRC, label: 'SE: 決定', category: 'se' },
  { src: UI_SUCCESS_SOUND_SRC, label: 'SE: 成功', category: 'se' },
  { src: BATH_CHANGE_SOUND_SRC, label: 'SE: 風呂着替え', category: 'se' },
  { src: BATH_SPLASH_SOUND_SRC, label: 'SE: 風呂ちゃぽん', category: 'se' },
  { src: FISH_RESULT_SOUND_SRC, label: 'VOICE: 釣果', category: 'voice' },
  { src: FISH_LOSE_SOUND_SRC, label: 'VOICE: 釣り失敗', category: 'voice' },
  { src: KURUMI_SHOP_SOUND_SRC, label: 'VOICE: くるみ商店あいさつ', category: 'voice' },
  { src: KURUMI_START_SOUND_SRC, label: 'VOICE: くるみ初回会話', category: 'voice' },
  { src: KURUMI_START2_SOUND_SRC, label: 'VOICE: くるみ 村説明', category: 'voice' },
  { src: KURUMI_START3_SOUND_SRC, label: 'VOICE: くるみ 借金説明', category: 'voice' },
  { src: KURUMI_START4_SOUND_SRC, label: 'VOICE: くるみ 苗床説明', category: 'voice' },
  { src: KURUMI_START5_SOUND_SRC, label: 'VOICE: くるみ パンツ質問', category: 'voice' },
];

export const BGM_FILE_ENTRIES = AUDIO_FILE_ENTRIES.filter(entry => entry.category === 'bgm');

export const DEFAULT_MAP_BGM_SOURCES: Record<GameMap, string> = {
  farm: '/bgm/farmbgm.wav',
  house: '/bgm/ie.mp3',
  shed: '/bgm/ie.mp3',
  waterfall: '/se/zoon2.wav',
  kawa: '/bgm/farmbgm.wav',
  doukutsu: '/se/zoon2.wav',
  takiura: '/se/zoon2.wav',
};

export const DEFAULT_AUDIO_GAINS: Record<string, number> = {
  '/bgm/ie.mp3': 1.8,
  [FIREPLACE_SOUND_SRC]: 1,
  [KURUMI_SHOP_SOUND_SRC]: 1,
};
