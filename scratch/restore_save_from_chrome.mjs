import fs from 'fs';
import path from 'path';
import os from 'os';

function findChromeDbPath() {
  const levelDbDirs = [
    path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Local Storage/leveldb'),
    path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Profile 1/Local Storage/leveldb'),
  ];
  const needle = Buffer.from('farm_obstacles');

  for (const dir of levelDbDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir)
      .filter(file => file.endsWith('.ldb'))
      .map(file => path.join(dir, file));

    for (const file of files) {
      const data = fs.readFileSync(file);
      if (data.includes(needle)) return file;
    }
  }

  throw new Error('farm_obstacles を含む Chrome Local Storage の .ldb が見つかりませんでした。');
}

const chromeDbPath = process.env.CHROME_LEVELDB_FILE || findChromeDbPath();
const savePath = path.resolve('saves/save_data.json');
const backupPath = path.resolve('saves/save_data.before-restore-20260616-1219.json');

const buf = fs.readFileSync(chromeDbPath);

function readVarint(b, off) {
  let result = 0n;
  let shift = 0n;
  let pos = off;
  while (pos < b.length) {
    const byte = b[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [Number(result), pos];
    shift += 7n;
  }
  throw new Error('bad varint');
}

function readBlockHandle(b, off) {
  const [offset, p1] = readVarint(b, off);
  const [size, p2] = readVarint(b, p1);
  return [{ offset, size }, p2];
}

function snappyUncompress(input) {
  let pos = 0;
  const [decodedLen, p0] = readVarint(input, 0);
  pos = p0;
  const out = Buffer.alloc(decodedLen);
  let op = 0;
  while (pos < input.length) {
    const tag = input[pos++];
    const type = tag & 0x03;
    if (type === 0) {
      let len = tag >> 2;
      if (len < 60) {
        len += 1;
      } else {
        const bytes = len - 59;
        let v = 0;
        for (let i = 0; i < bytes; i += 1) v |= input[pos++] << (8 * i);
        len = v + 1;
      }
      input.copy(out, op, pos, pos + len);
      pos += len;
      op += len;
      continue;
    }
    if (type === 1) {
      const len = ((tag >> 2) & 0x7) + 4;
      const offset = ((tag & 0xe0) << 3) | input[pos++];
      for (let i = 0; i < len; i += 1) out[op + i] = out[op - offset + i];
      op += len;
      continue;
    }
    if (type === 2) {
      const len = (tag >> 2) + 1;
      const offset = input[pos] | (input[pos + 1] << 8);
      pos += 2;
      for (let i = 0; i < len; i += 1) out[op + i] = out[op - offset + i];
      op += len;
      continue;
    }
    const len = (tag >> 2) + 1;
    const offset =
      input[pos] |
      (input[pos + 1] << 8) |
      (input[pos + 2] << 16) |
      (input[pos + 3] << 24);
    pos += 4;
    for (let i = 0; i < len; i += 1) out[op + i] = out[op - offset + i];
    op += len;
  }
  return out;
}

function parseBlock(block) {
  const restartCount = block.readUInt32LE(block.length - 4);
  const restartsOffset = block.length - 4 - restartCount * 4;
  let pos = 0;
  let lastKey = Buffer.alloc(0);
  const entries = [];
  while (pos < restartsOffset) {
    const [shared, p1] = readVarint(block, pos);
    const [nonShared, p2] = readVarint(block, p1);
    const [valueLen, p3] = readVarint(block, p2);
    const keyDelta = block.subarray(p3, p3 + nonShared);
    const key = Buffer.concat([lastKey.subarray(0, shared), keyDelta]);
    const value = block.subarray(p3 + nonShared, p3 + nonShared + valueLen);
    entries.push({ key, value });
    lastKey = key;
    pos = p3 + nonShared + valueLen;
  }
  return entries;
}

function readTableBlock(handle) {
  const raw = buf.subarray(handle.offset, handle.offset + handle.size);
  const type = buf[handle.offset + handle.size];
  if (type === 0) return raw;
  if (type === 1) return snappyUncompress(raw);
  throw new Error(`unsupported compression type ${type}`);
}

function readEntries() {
  const footerStart = buf.length - 48;
  const [, metaEnd] = readBlockHandle(buf, footerStart);
  const [indexHandle] = readBlockHandle(buf, metaEnd);
  const indexEntries = parseBlock(readTableBlock(indexHandle));
  const entries = [];
  for (const indexEntry of indexEntries) {
    const [handle] = readBlockHandle(indexEntry.value, 0);
    entries.push(...parseBlock(readTableBlock(handle)));
  }
  return entries.map((entry) => ({
    key: entry.key.toString('latin1'),
    value: entry.value.toString('latin1'),
    valueLen: entry.value.length,
  }));
}

const entries = readEntries();

function getEntry(origin, name, largest = true) {
  const matches = entries.filter((entry) => (
    entry.key.includes(origin) && entry.key.includes(`\u0001${name}`)
  ));
  if (!matches.length) throw new Error(`missing ${origin} ${name}`);
  if (largest) matches.sort((a, b) => b.valueLen - a.valueLen);
  return matches[0].value.startsWith('\u0001') ? matches[0].value.slice(1) : matches[0].value;
}

function getJson(origin, name, largest = true) {
  return JSON.parse(getEntry(origin, name, largest));
}

const zones = [
  { id: '1781485855659', x: 1370, y: 506, w: 56.177436440677866, h: 52.733315677966175, type: 'sagi', map: 'farm' },
  { id: 'default_takiura_waterfall', x: 279, y: 88, w: 553, h: 511, type: 'waterfall', map: 'takiura' },
  { id: 'default_waterfall_day_flow', x: 824, y: 194, w: 265, h: 328, type: 'waterfall', map: 'waterfall' },
  { id: '1781510038889', x: 1540.1705693783967, y: 480.5869565217391, w: 32.52842809364529, h: 33.85785953177253, type: 'kamo', map: 'farm' },
  { id: '1781516467136', x: 1586.4016393442623, y: 522.2049180327868, w: 34.06967213114763, h: 33.44262295081967, type: 'kamo', map: 'farm' },
  { id: '1781518614931', x: 795.8483606557377, y: 586.6352459016393, w: 34.35655737704917, h: 30.959016393442653, type: 'iwana', map: 'waterfall' },
  { id: '1781518623466', x: 948, y: 533, w: 34.1639344262295, h: 32.30737704918033, type: 'iwana', map: 'waterfall' },
  { id: '1781519319317', x: 787.7131147540983, y: 179.47540983606558, w: 31.397540983606632, h: 33.9795081967213, type: 'sagi', map: 'waterfall' },
  { id: '1781519692576', x: 1462, y: 440, w: 20, h: 20, type: 'iwana', map: 'farm', timeOfDay: 'morning' },
  { id: '1781519706600', x: 1460.8565573770493, y: 719.0450819672132, w: 20, h: 20, type: 'iwana', map: 'farm', timeOfDay: 'morning' },
  { id: '1781519722758', x: 1576, y: 999, w: 20, h: 20, type: 'iwana', map: 'farm', timeOfDay: 'morning' },
  { id: '1781525041939', x: 500.14344262295083, y: 270.8893442622951, w: 40.176229508196684, h: 98.61475409836066, type: 'smoke', map: 'farm' },
  { id: '1781526178465', x: 1459.3155737704917, y: 404.17622950819674, w: 21.86885245901658, h: 20.745901639344254, type: 'iwana', map: 'kawa', timeOfDay: 'morning' },
  { id: '1781526192626', x: 1507.0655737704917, y: 397.3155737704918, w: 25.28278688524597, h: 25.008196721311435, type: 'iwana', map: 'kawa', timeOfDay: 'morning' },
  { id: '1781526202652', x: 1320.545081967213, y: 815.1270491803278, w: 26.647540983606632, h: 25.98360655737713, type: 'iwana', map: 'kawa', timeOfDay: 'morning' },
  { id: '1781526217594', x: 1560.8196721311476, y: 132.56147540983608, w: 21.016393442622757, h: 22.82377049180326, type: 'iwana', map: 'kawa', timeOfDay: 'morning' },
  { id: 'default_doukutsu_waterfall_sound', x: 780, y: 360, w: 360, h: 360, type: 'waterfall', map: 'doukutsu' },
  { id: 'default_house_fireplace_flame', x: 879, y: 369, w: 74, h: 40, type: 'fireplace', map: 'house' },
];

const restored = {
  zones,
  doors: getJson('localhost:5174', 'farm_doors'),
  bgmVolume: Number(getEntry('localhost:5173', 'farm_bgm_volume')),
  seVolume: Number(getEntry('localhost:5173', 'farm_se_volume')),
  voiceVolume: Number(getEntry('localhost:5173', 'farm_voice_volume')),
  audioGains: getJson('localhost:5173', 'farm_audio_gains'),
  mapBgmSources: {
    farm: '/bgm/farmbgm.wav',
    house: '/bgm/ie.mp3',
    shed: '/bgm/ie.mp3',
    waterfall: '/se/zoon2.wav',
    kawa: '/bgm/farmbgm.wav',
    doukutsu: '/se/zoon2.wav',
    takiura: '/se/zoon2.wav',
  },
  obstacles: getJson('localhost:5173', 'farm_obstacles'),
  hideAreaTiles: {},
  footstepTiles: getJson('localhost:5173', 'farm_footsteps'),
  wallBumpSound: getEntry('localhost:5173', 'farm_wall_bump_sound'),
  bedTiles: getJson('localhost:5173', 'farm_bed_tiles'),
  workbenchTiles: {
    'shed_58,34': true, 'shed_59,34': true, 'shed_60,34': true, 'shed_61,35': true, 'shed_62,35': true,
    'shed_62,34': true, 'shed_61,34': true, 'shed_58,35': true, 'shed_59,35': true, 'shed_60,35': true,
  },
  fishingTiles: { 'farm_90,28': true, 'farm_90,29': true, 'farm_91,29': true, 'farm_91,28': true },
  inspectSpots: [
    { id: 'inspect_1781517937661', map: 'farm', x: 260, y: 560, w: 50, h: 20, label: 'ポスト', text: 'ポストを調べた。' },
    { id: 'inspect_1781524419248', map: 'shed', x: 870, y: 500, w: 60, h: 30, label: '作業台', text: '作業を開始。' },
  ],
  plantedCrops: {},
  fieldCorners: {
    left: { topLeft: { x: 308, y: 691 }, topRight: { x: 884, y: 693 }, bottomRight: { x: 884, y: 939 }, bottomLeft: { x: 306, y: 944 } },
    right: { topLeft: { x: 1006, y: 692 }, topRight: { x: 1352, y: 692 }, bottomRight: { x: 1353, y: 945 }, bottomLeft: { x: 1001, y: 941 } },
  },
  fieldGridSizes: { left: { cols: 10, rows: 6 }, right: { cols: 6, rows: 6 } },
  bathTubMaskZone: { x: 1260, y: 380, w: 50, h: 20 },
};

if (fs.existsSync(savePath) && !fs.existsSync(backupPath)) {
  fs.copyFileSync(savePath, backupPath);
}
fs.writeFileSync(savePath, `${JSON.stringify(restored, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  backupPath,
  doors: restored.doors.length,
  zones: restored.zones.length,
  obstacles: Object.keys(restored.obstacles).length,
  footstepTiles: Object.keys(restored.footstepTiles).length,
  fieldCorners: restored.fieldCorners,
  fieldGridSizes: restored.fieldGridSizes,
}, null, 2));
