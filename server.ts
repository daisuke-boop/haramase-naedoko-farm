import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM環境用の __dirname 互換処理
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4173;
const SAVE_DIR = path.resolve(__dirname, 'saves');
const SAVE_FILE = path.resolve(SAVE_DIR, 'save_data.json');
const PREVIOUS_SAVE_FILE = path.resolve(SAVE_DIR, 'save_data.previous.json');
const GRID_COLS = 128;
const GRID_ROWS = 72;
const VALID_MAPS = new Set(['farm', 'house', 'shed', 'waterfall', 'kawa', 'doukutsu', 'takiura']);
const TILE_RECORD_FIELDS = ['obstacles', 'hideAreaTiles', 'bedTiles', 'workbenchTiles', 'fishingTiles'];
const FOOTSTEP_SOUNDS = new Set(['soil', 'grass', 'foot', 'rainw', 'rock', 'jutan']);

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
    if (fs.existsSync(SAVE_FILE)) {
      const data = fs.readFileSync(SAVE_FILE, 'utf8');
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

// セーブデータの書き込み API
app.post('/api/save', (req, res) => {
  try {
    const sanitizedBody = sanitizeSaveData(req.body);

    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }

    if (fs.existsSync(SAVE_FILE)) {
      const currentData = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      const currentObstacleCount = Object.keys(currentData.obstacles ?? {}).length;
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

      if (looksLikeInitialReset || looksLikeMapObstacleLoss) {
        console.warn('衝突設定が大きく欠けるセーブ上書きを拒否しました。');
        return res.status(409).json({ error: '衝突設定が大きく欠けるセーブ上書きを拒否しました。' });
      }

      fs.copyFileSync(SAVE_FILE, PREVIOUS_SAVE_FILE);
    }

    fs.writeFileSync(SAVE_FILE, JSON.stringify(sanitizedBody, null, 2), 'utf8');
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
