import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM環境用の __dirname 互換処理
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4173;
const SAVE_DIR = process.env.FARM_SAVE_DIR
  ? path.resolve(process.env.FARM_SAVE_DIR)
  : path.resolve(__dirname, 'saves');
const SAVE_FILE = path.resolve(SAVE_DIR, 'save_data.json');
const PREVIOUS_SAVE_FILE = path.resolve(SAVE_DIR, 'save_data.previous.json');
const AUTO_SAVE_FILE = path.resolve(SAVE_DIR, 'save_data.autosave.json');
const PREVIOUS_AUTO_SAVE_FILE = path.resolve(SAVE_DIR, 'save_data.autosave.previous.json');
const MAP_SETTINGS_FILE = path.resolve(SAVE_DIR, 'map_settings.json');
const SAVE_SLOT_COUNT = 5;
const AUTO_SAVE_SLOT = 0;
const FARM_GIRL_CARD_BACK_SRC = '/img/card.png';
const FARM_GIRL_CARD_IMAGES = ['/img/chibiichi-card.jpg', '/img/ruby-card.jpg', '/img/mel-card.jpg'];
const OPEN_FARM_GIRL_CARD_COUNT = FARM_GIRL_CARD_IMAGES.filter(src => src !== FARM_GIRL_CARD_BACK_SRC).length;
const GRID_COLS = 128;
const GRID_ROWS = 72;
const VALID_MAPS = new Set(['farm', 'house', 'shed', 'waterfall', 'kawa', 'doukutsu', 'takiura']);
const TILE_RECORD_FIELDS = ['obstacles', 'hideAreaTiles', 'bedTiles', 'workbenchTiles', 'fishingTiles', 'miningTiles', 'loggingTiles'];
const FOOTSTEP_SOUNDS = new Set(['soil', 'grass', 'foot', 'rainw', 'rock', 'jutan']);
const MAP_SETTINGS_FIELDS = [
  'zones', 'doors', 'obstacles', 'hideAreaTiles', 'footstepTiles', 'wallBumpSound',
  'bedTiles', 'workbenchTiles', 'fishingTiles', 'miningTiles', 'loggingTiles',
  'inspectSpots', 'fieldCorners', 'fieldGridSizes', 'mapBgmSources', 'bathTubMaskZone',
] as const;

const normalizeTileRecord = (
  raw: unknown,
  isValidValue: (value: unknown) => boolean
) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const next: Record<string, unknown> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([rawKey, value]) => {
    if (!isValidValue(value)) return;

    let map = 'farm';
    let tilePart = rawKey;
    const separatorIndex = rawKey.indexOf('_');
    if (separatorIndex > 0) {
      const mapPart = rawKey.slice(0, separatorIndex);
      if (!VALID_MAPS.has(mapPart)) return;
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

const sanitizeSaveData = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const next = { ...(raw as Record<string, unknown>) };
  TILE_RECORD_FIELDS.forEach(field => {
    next[field] = normalizeTileRecord(next[field], value => value === true);
  });
  next.footstepTiles = normalizeTileRecord(
    next.footstepTiles,
    value => typeof value === 'string' && FOOTSTEP_SOUNDS.has(value)
  );
  return next;
};

const countObstacleMaps = (obstacles: unknown) => {
  const counts: Record<string, number> = {};
  if (!obstacles || typeof obstacles !== 'object' || Array.isArray(obstacles)) return counts;

  Object.keys(obstacles as Record<string, unknown>).forEach(key => {
    const separatorIndex = key.indexOf('_');
    const map = separatorIndex > 0 ? key.slice(0, separatorIndex) : 'farm';
    counts[map] = (counts[map] ?? 0) + 1;
  });
  return counts;
};

const countRecordEntries = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value as Record<string, unknown>).length
    : 0
);

const countArrayEntries = (value: unknown) => Array.isArray(value) ? value.length : 0;

const getMapSettingsFootprint = (data: Record<string, unknown>) => ({
  doors: countArrayEntries(data.doors),
  zones: countArrayEntries(data.zones),
  obstacles: countRecordEntries(data.obstacles),
  hideAreaTiles: countRecordEntries(data.hideAreaTiles),
  bedTiles: countRecordEntries(data.bedTiles),
  workbenchTiles: countRecordEntries(data.workbenchTiles),
  fishingTiles: countRecordEntries(data.fishingTiles),
  miningTiles: countRecordEntries(data.miningTiles),
  loggingTiles: countRecordEntries(data.loggingTiles),
  inspectSpots: countArrayEntries(data.inspectSpots),
  fieldCorners: countRecordEntries(data.fieldCorners),
  fieldGridSizes: countRecordEntries(data.fieldGridSizes),
});

const hasRichMapSettings = (data: Record<string, unknown>) => {
  const footprint = getMapSettingsFootprint(data);
  return (
    footprint.doors >= 8 ||
    footprint.zones >= 8 ||
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

const hasSuspiciousMapSettingsLoss = (currentData: Record<string, unknown>, nextData: Record<string, unknown>) => {
  if (!hasRichMapSettings(currentData)) return false;

  const current = getMapSettingsFootprint(currentData);
  const next = getMapSettingsFootprint(nextData);
  const lostLargeRecord = (
    (current.obstacles >= 100 && next.obstacles < current.obstacles * 0.65) ||
    (current.hideAreaTiles >= 100 && next.hideAreaTiles < current.hideAreaTiles * 0.65)
  );
  const looksLikeInitialMapState = (
    next.zones <= 5 &&
    next.doors <= 8 &&
    next.obstacles === 0 &&
    next.hideAreaTiles === 0 &&
    next.workbenchTiles === 0 &&
    next.fishingTiles === 0
    && next.miningTiles === 0 &&
    next.loggingTiles === 0
  );
  const lostSetupTiles = (
    (current.bedTiles >= 10 && next.bedTiles < current.bedTiles * 0.65) ||
    (current.workbenchTiles >= 5 && next.workbenchTiles < current.workbenchTiles * 0.65) ||
    (current.fishingTiles >= 3 && next.fishingTiles < current.fishingTiles * 0.65) ||
    (current.miningTiles >= 3 && next.miningTiles < current.miningTiles * 0.65) ||
    (current.loggingTiles >= 3 && next.loggingTiles < current.loggingTiles * 0.65)
  );
  const lostZones = current.zones >= 8 && next.zones < current.zones * 0.65;
  const lostDoors = current.doors >= 8 && next.doors < current.doors * 0.75;

  return lostLargeRecord || looksLikeInitialMapState || lostSetupTiles || lostZones || lostDoors;
};

const extractMapSettings = (data: Record<string, unknown>) => Object.fromEntries(
  MAP_SETTINGS_FIELDS
    .filter(field => field in data)
    .map(field => [field, data[field]])
);

const getSaveSlot = (rawSlot: unknown) => {
  const slot = Number(rawSlot ?? 1);
  return Number.isInteger(slot) && slot >= AUTO_SAVE_SLOT && slot <= SAVE_SLOT_COUNT ? slot : 1;
};

const getSaveFileForSlot = (slot: number) => (
  slot === AUTO_SAVE_SLOT ? AUTO_SAVE_FILE : slot === 1 ? SAVE_FILE : path.resolve(SAVE_DIR, `save_data.slot${slot}.json`)
);

const getPreviousSaveFileForSlot = (slot: number) => (
  slot === AUTO_SAVE_SLOT ? PREVIOUS_AUTO_SAVE_FILE : slot === 1 ? PREVIOUS_SAVE_FILE : path.resolve(SAVE_DIR, `save_data.slot${slot}.previous.json`)
);

const createSaveSlotSummary = (slot: number) => {
  const saveFile = getSaveFileForSlot(slot);
  if (!fs.existsSync(saveFile)) {
    return { slot, exists: false };
  }

  const data = JSON.parse(fs.readFileSync(saveFile, 'utf8')) as Record<string, unknown>;
  const stat = fs.statSync(saveFile);
  const turn = typeof data.turn === 'number' && Number.isFinite(data.turn) ? data.turn : 0;
  const day = Math.floor(turn / 4) + 1;
  const debt = typeof data.debt === 'number' && Number.isFinite(data.debt) ? data.debt : 100000000;
  const gold = typeof data.gold === 'number' && Number.isFinite(data.gold) ? data.gold : 5000;
  const map = typeof data.currentMap === 'string' && VALID_MAPS.has(data.currentMap) ? data.currentMap : 'farm';
  const ownedGirlCount = Array.isArray(data.ownedGirls)
    ? data.ownedGirls.length
    : Array.isArray(data.unlockedGirls)
      ? data.unlockedGirls.length
      : OPEN_FARM_GIRL_CARD_COUNT;
  const caughtFishCount = Array.isArray(data.caughtFishIds) ? data.caughtFishIds.length : 0;

  return {
    slot,
    exists: true,
    day,
    debt,
    gold,
    map,
    updatedAt: stat.mtime.toISOString(),
    ownedGirlCount,
    caughtFishCount,
  };
};

const hasSuspiciousObstacleLoss = (currentData: Record<string, unknown>, nextData: Record<string, unknown>) => {
  const currentCounts = countObstacleMaps(currentData.obstacles);
  const nextCounts = countObstacleMaps(nextData.obstacles);

  return Object.entries(currentCounts).some(([map, currentCount]) => {
    if (currentCount < 100) return false;
    const nextCount = nextCounts[map] ?? 0;
    return nextCount === 0 || nextCount < currentCount * 0.65;
  });
};

app.use(express.json({ limit: '50mb' }));

// セーブデータの取得 API
app.get('/api/save', (req, res) => {
  try {
    const slot = getSaveSlot(req.query.slot);
    const saveFile = getSaveFileForSlot(slot);
    if (fs.existsSync(saveFile)) {
      const data = fs.readFileSync(saveFile, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      return res.send(data);
    } else {
      return res.json({});
    }
  } catch (error) {
    console.error('セーブデータの読み込みに失敗しました:', error);
    return res.status(500).json({ error: 'セーブデータの読み込みに失敗しました。' });
  }
});

app.get('/api/save-slots', (req, res) => {
  try {
    return res.json(Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => createSaveSlotSummary(index + 1)));
  } catch (error) {
    console.error('セーブスロット一覧の読み込みに失敗しました:', error);
    return res.status(500).json({ error: 'セーブスロット一覧の読み込みに失敗しました。' });
  }
});

app.get('/api/map-settings', (req, res) => {
  try {
    if (!fs.existsSync(MAP_SETTINGS_FILE)) return res.json({});
    return res.json(JSON.parse(fs.readFileSync(MAP_SETTINGS_FILE, 'utf8')));
  } catch (error) {
    console.error('マップ設定の読み込みに失敗しました:', error);
    return res.status(500).json({ error: 'マップ設定の読み込みに失敗しました。' });
  }
});

app.delete('/api/save', (req, res) => {
  try {
    const slot = getSaveSlot(req.query.slot);
    const saveFile = getSaveFileForSlot(slot);
    const previousSaveFile = getPreviousSaveFileForSlot(slot);

    if (fs.existsSync(saveFile)) {
      fs.unlinkSync(saveFile);
    }
    if (fs.existsSync(previousSaveFile)) {
      fs.unlinkSync(previousSaveFile);
    }

    return res.json({ success: true, slot });
  } catch (error) {
    console.error('セーブデータの削除に失敗しました:', error);
    return res.status(500).json({ error: 'セーブデータの削除に失敗しました。' });
  }
});

// セーブデータの書き込み API
app.post('/api/save', (req, res) => {
  try {
    const slot = getSaveSlot(req.query.slot);
    const saveFile = getSaveFileForSlot(slot);
    const previousSaveFile = getPreviousSaveFileForSlot(slot);
    const sanitizedBody = sanitizeSaveData(req.body);

    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    const baselineSaveFile = fs.existsSync(MAP_SETTINGS_FILE)
      ? MAP_SETTINGS_FILE
      : fs.existsSync(saveFile)
      ? saveFile
      : fs.existsSync(previousSaveFile)
        ? previousSaveFile
        : null;

    if (baselineSaveFile) {
      const currentData = JSON.parse(fs.readFileSync(baselineSaveFile, 'utf8'));
      const currentObstacleCount = countRecordEntries(currentData.obstacles);
      const nextObstacleCount = Object.keys(sanitizedBody.obstacles ?? {}).length;
      const currentDoorCount = Array.isArray(currentData.doors) ? currentData.doors.length : 0;
      const nextDoorCount = Array.isArray(sanitizedBody.doors) ? sanitizedBody.doors.length : 0;
      const currentZoneCount = Array.isArray(currentData.zones) ? currentData.zones.length : 0;
      const nextZoneCount = Array.isArray(sanitizedBody.zones) ? sanitizedBody.zones.length : 0;
      const looksLikeInitialReset =
        currentObstacleCount > 100 &&
        currentDoorCount > 8 &&
        currentZoneCount > 8 &&
        nextObstacleCount === 0 &&
            nextDoorCount <= 6 &&
        nextZoneCount <= 4;
      const looksLikeMapObstacleLoss = hasSuspiciousObstacleLoss(currentData, sanitizedBody);
      const looksLikeMapSettingsLoss = hasSuspiciousMapSettingsLoss(currentData, sanitizedBody);

      if (looksLikeInitialReset || looksLikeMapObstacleLoss || looksLikeMapSettingsLoss) {
        console.warn('マップ設定が大きく欠けるセーブ上書きを拒否しました。');
        return res.status(409).json({ error: 'マップ設定が大きく欠けるセーブ上書きを拒否しました。' });
      }

      if (fs.existsSync(saveFile)) {
        fs.copyFileSync(saveFile, previousSaveFile);
      }
    }

    fs.writeFileSync(saveFile, JSON.stringify(sanitizedBody, null, 2), 'utf8');
    if (hasRichMapSettings(sanitizedBody)) {
      fs.writeFileSync(MAP_SETTINGS_FILE, JSON.stringify(extractMapSettings(sanitizedBody), null, 2), 'utf8');
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('セーブデータの書き込みに失敗しました:', error);
    return res.status(500).json({ error: 'セーブデータの書き込みに失敗しました。' });
  }
});

// ビルド後の静的ファイル配信
const distPath = path.resolve(__dirname, 'dist');
const publicImgPath = path.resolve(__dirname, 'public', 'img');

if (fs.existsSync(publicImgPath)) {
  app.use(
    '/img',
    express.static(publicImgPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
      },
    })
  );
}

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました。`);
  console.log(`セーブフォルダ: ${SAVE_DIR}`);
});
