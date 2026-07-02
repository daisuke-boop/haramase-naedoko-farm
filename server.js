// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 4173;
var SAVE_DIR = process.env.FARM_SAVE_DIR ? path.resolve(process.env.FARM_SAVE_DIR) : path.resolve(__dirname, "saves");
var SAVE_FILE = path.resolve(SAVE_DIR, "save_data.json");
var PREVIOUS_SAVE_FILE = path.resolve(SAVE_DIR, "save_data.previous.json");
var AUTO_SAVE_FILE = path.resolve(SAVE_DIR, "save_data.autosave.json");
var PREVIOUS_AUTO_SAVE_FILE = path.resolve(SAVE_DIR, "save_data.autosave.previous.json");
var MAP_SETTINGS_FILE = path.resolve(SAVE_DIR, "map_settings.json");
var SAVE_SLOT_COUNT = 5;
var AUTO_SAVE_SLOT = 0;
var FARM_GIRL_CARD_BACK_SRC = "/img/card.png";
var FARM_GIRL_CARD_IMAGES = ["/img/chibiichi-card.jpg", "/img/ruby-card.jpg", "/img/mel-card.jpg"];
var OPEN_FARM_GIRL_CARD_COUNT = FARM_GIRL_CARD_IMAGES.filter((src) => src !== FARM_GIRL_CARD_BACK_SRC).length;
var GRID_COLS = 128;
var GRID_ROWS = 72;
var VALID_MAPS = /* @__PURE__ */ new Set(["farm", "house", "shed", "waterfall", "kawa", "doukutsu", "takiura"]);
var TILE_RECORD_FIELDS = ["obstacles", "hideAreaTiles", "bedTiles", "workbenchTiles", "fishingTiles", "miningTiles", "loggingTiles"];
var FOOTSTEP_SOUNDS = /* @__PURE__ */ new Set(["soil", "grass", "foot", "rainw", "rock", "jutan"]);
var MAP_SETTINGS_FIELDS = [
  "zones",
  "doors",
  "obstacles",
  "hideAreaTiles",
  "footstepTiles",
  "wallBumpSound",
  "bedTiles",
  "workbenchTiles",
  "fishingTiles",
  "miningTiles",
  "loggingTiles",
  "inspectSpots",
  "fieldCorners",
  "fieldGridSizes",
  "mapBgmSources",
  "bathTubMaskZone"
];
var normalizeTileRecord = (raw, isValidValue) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next = {};
  Object.entries(raw).forEach(([rawKey, value]) => {
    if (!isValidValue(value)) return;
    let map = "farm";
    let tilePart = rawKey;
    const separatorIndex = rawKey.indexOf("_");
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
var sanitizeSaveData = (raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next = { ...raw };
  TILE_RECORD_FIELDS.forEach((field) => {
    next[field] = normalizeTileRecord(next[field], (value) => value === true);
  });
  next.footstepTiles = normalizeTileRecord(
    next.footstepTiles,
    (value) => typeof value === "string" && FOOTSTEP_SOUNDS.has(value)
  );
  return next;
};
var countObstacleMaps = (obstacles) => {
  const counts = {};
  if (!obstacles || typeof obstacles !== "object" || Array.isArray(obstacles)) return counts;
  Object.keys(obstacles).forEach((key) => {
    const separatorIndex = key.indexOf("_");
    const map = separatorIndex > 0 ? key.slice(0, separatorIndex) : "farm";
    counts[map] = (counts[map] ?? 0) + 1;
  });
  return counts;
};
var countRecordEntries = (value) => value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : 0;
var countArrayEntries = (value) => Array.isArray(value) ? value.length : 0;
var getMapSettingsFootprint = (data) => ({
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
  fieldGridSizes: countRecordEntries(data.fieldGridSizes)
});
var hasRichMapSettings = (data) => {
  const footprint = getMapSettingsFootprint(data);
  return footprint.doors >= 8 || footprint.zones >= 8 || footprint.obstacles >= 100 || footprint.hideAreaTiles >= 100 || footprint.bedTiles >= 10 || footprint.workbenchTiles >= 5 || footprint.fishingTiles >= 3 || footprint.miningTiles >= 3 || footprint.loggingTiles >= 3 || footprint.inspectSpots >= 3;
};
var hasSuspiciousMapSettingsLoss = (currentData, nextData) => {
  if (!hasRichMapSettings(currentData)) return false;
  const current = getMapSettingsFootprint(currentData);
  const next = getMapSettingsFootprint(nextData);
  const lostLargeRecord = current.obstacles >= 100 && next.obstacles < current.obstacles * 0.65 || current.hideAreaTiles >= 100 && next.hideAreaTiles < current.hideAreaTiles * 0.65;
  const looksLikeInitialMapState = next.zones <= 5 && next.doors <= 8 && next.obstacles === 0 && next.hideAreaTiles === 0 && next.workbenchTiles === 0 && next.fishingTiles === 0 && next.miningTiles === 0 && next.loggingTiles === 0;
  const lostSetupTiles = current.bedTiles >= 10 && next.bedTiles < current.bedTiles * 0.65 || current.workbenchTiles >= 5 && next.workbenchTiles < current.workbenchTiles * 0.65 || current.fishingTiles >= 3 && next.fishingTiles < current.fishingTiles * 0.65 || current.miningTiles >= 3 && next.miningTiles < current.miningTiles * 0.65 || current.loggingTiles >= 3 && next.loggingTiles < current.loggingTiles * 0.65;
  const lostZones = current.zones >= 8 && next.zones < current.zones * 0.65;
  const lostDoors = current.doors >= 8 && next.doors < current.doors * 0.75;
  return lostLargeRecord || looksLikeInitialMapState || lostSetupTiles || lostZones || lostDoors;
};
var extractMapSettings = (data) => Object.fromEntries(
  MAP_SETTINGS_FIELDS.filter((field) => field in data).map((field) => [field, data[field]])
);
var getSaveSlot = (rawSlot) => {
  const slot = Number(rawSlot ?? 1);
  return Number.isInteger(slot) && slot >= AUTO_SAVE_SLOT && slot <= SAVE_SLOT_COUNT ? slot : 1;
};
var getSaveFileForSlot = (slot) => slot === AUTO_SAVE_SLOT ? AUTO_SAVE_FILE : slot === 1 ? SAVE_FILE : path.resolve(SAVE_DIR, `save_data.slot${slot}.json`);
var getPreviousSaveFileForSlot = (slot) => slot === AUTO_SAVE_SLOT ? PREVIOUS_AUTO_SAVE_FILE : slot === 1 ? PREVIOUS_SAVE_FILE : path.resolve(SAVE_DIR, `save_data.slot${slot}.previous.json`);
var createSaveSlotSummary = (slot) => {
  const saveFile = getSaveFileForSlot(slot);
  if (!fs.existsSync(saveFile)) {
    return { slot, exists: false };
  }
  const data = JSON.parse(fs.readFileSync(saveFile, "utf8"));
  const stat = fs.statSync(saveFile);
  const turn = typeof data.turn === "number" && Number.isFinite(data.turn) ? data.turn : 0;
  const day = Math.floor(turn / 4) + 1;
  const debt = typeof data.debt === "number" && Number.isFinite(data.debt) ? data.debt : 1e8;
  const gold = typeof data.gold === "number" && Number.isFinite(data.gold) ? data.gold : 5e3;
  const map = typeof data.currentMap === "string" && VALID_MAPS.has(data.currentMap) ? data.currentMap : "farm";
  const ownedGirlCount = Array.isArray(data.ownedGirls) ? data.ownedGirls.length : Array.isArray(data.unlockedGirls) ? data.unlockedGirls.length : OPEN_FARM_GIRL_CARD_COUNT;
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
    caughtFishCount
  };
};
var hasSuspiciousObstacleLoss = (currentData, nextData) => {
  const currentCounts = countObstacleMaps(currentData.obstacles);
  const nextCounts = countObstacleMaps(nextData.obstacles);
  return Object.entries(currentCounts).some(([map, currentCount]) => {
    if (currentCount < 100) return false;
    const nextCount = nextCounts[map] ?? 0;
    return nextCount === 0 || nextCount < currentCount * 0.65;
  });
};
app.use(express.json({ limit: "50mb" }));
app.get("/api/save", (req, res) => {
  try {
    const slot = getSaveSlot(req.query.slot);
    const saveFile = getSaveFileForSlot(slot);
    if (fs.existsSync(saveFile)) {
      const data = fs.readFileSync(saveFile, "utf8");
      res.setHeader("Content-Type", "application/json");
      return res.send(data);
    } else {
      return res.json({});
    }
  } catch (error) {
    console.error("\u30BB\u30FC\u30D6\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    return res.status(500).json({ error: "\u30BB\u30FC\u30D6\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
  }
});
app.get("/api/save-slots", (req, res) => {
  try {
    return res.json(Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => createSaveSlotSummary(index + 1)));
  } catch (error) {
    console.error("\u30BB\u30FC\u30D6\u30B9\u30ED\u30C3\u30C8\u4E00\u89A7\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    return res.status(500).json({ error: "\u30BB\u30FC\u30D6\u30B9\u30ED\u30C3\u30C8\u4E00\u89A7\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
  }
});
app.get("/api/map-settings", (req, res) => {
  try {
    if (!fs.existsSync(MAP_SETTINGS_FILE)) return res.json({});
    return res.json(JSON.parse(fs.readFileSync(MAP_SETTINGS_FILE, "utf8")));
  } catch (error) {
    console.error("\u30DE\u30C3\u30D7\u8A2D\u5B9A\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    return res.status(500).json({ error: "\u30DE\u30C3\u30D7\u8A2D\u5B9A\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
  }
});
app.delete("/api/save", (req, res) => {
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
    console.error("\u30BB\u30FC\u30D6\u30C7\u30FC\u30BF\u306E\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    return res.status(500).json({ error: "\u30BB\u30FC\u30D6\u30C7\u30FC\u30BF\u306E\u524A\u9664\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
  }
});
app.post("/api/save", (req, res) => {
  try {
    const slot = getSaveSlot(req.query.slot);
    const saveFile = getSaveFileForSlot(slot);
    const previousSaveFile = getPreviousSaveFileForSlot(slot);
    const sanitizedBody = sanitizeSaveData(req.body);
    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }
    const baselineSaveFile = fs.existsSync(MAP_SETTINGS_FILE) ? MAP_SETTINGS_FILE : fs.existsSync(saveFile) ? saveFile : fs.existsSync(previousSaveFile) ? previousSaveFile : null;
    if (baselineSaveFile) {
      const currentData = JSON.parse(fs.readFileSync(baselineSaveFile, "utf8"));
      const currentObstacleCount = countRecordEntries(currentData.obstacles);
      const nextObstacleCount = Object.keys(sanitizedBody.obstacles ?? {}).length;
      const currentDoorCount = Array.isArray(currentData.doors) ? currentData.doors.length : 0;
      const nextDoorCount = Array.isArray(sanitizedBody.doors) ? sanitizedBody.doors.length : 0;
      const currentZoneCount = Array.isArray(currentData.zones) ? currentData.zones.length : 0;
      const nextZoneCount = Array.isArray(sanitizedBody.zones) ? sanitizedBody.zones.length : 0;
      const looksLikeInitialReset = currentObstacleCount > 100 && currentDoorCount > 8 && currentZoneCount > 8 && nextObstacleCount === 0 && nextDoorCount <= 6 && nextZoneCount <= 4;
      const looksLikeMapObstacleLoss = hasSuspiciousObstacleLoss(currentData, sanitizedBody);
      const looksLikeMapSettingsLoss = hasSuspiciousMapSettingsLoss(currentData, sanitizedBody);
      if (looksLikeInitialReset || looksLikeMapObstacleLoss || looksLikeMapSettingsLoss) {
        console.warn("\u30DE\u30C3\u30D7\u8A2D\u5B9A\u304C\u5927\u304D\u304F\u6B20\u3051\u308B\u30BB\u30FC\u30D6\u4E0A\u66F8\u304D\u3092\u62D2\u5426\u3057\u307E\u3057\u305F\u3002");
        return res.status(409).json({ error: "\u30DE\u30C3\u30D7\u8A2D\u5B9A\u304C\u5927\u304D\u304F\u6B20\u3051\u308B\u30BB\u30FC\u30D6\u4E0A\u66F8\u304D\u3092\u62D2\u5426\u3057\u307E\u3057\u305F\u3002" });
      }
      if (fs.existsSync(saveFile)) {
        fs.copyFileSync(saveFile, previousSaveFile);
      }
    }
    fs.writeFileSync(saveFile, JSON.stringify(sanitizedBody, null, 2), "utf8");
    if (hasRichMapSettings(sanitizedBody)) {
      fs.writeFileSync(MAP_SETTINGS_FILE, JSON.stringify(extractMapSettings(sanitizedBody), null, 2), "utf8");
    }
    return res.json({ success: true });
  } catch (error) {
    console.error("\u30BB\u30FC\u30D6\u30C7\u30FC\u30BF\u306E\u66F8\u304D\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F:", error);
    return res.status(500).json({ error: "\u30BB\u30FC\u30D6\u30C7\u30FC\u30BF\u306E\u66F8\u304D\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002" });
  }
});
var distPath = path.resolve(__dirname, "dist");
var publicImgPath = path.resolve(__dirname, "public", "img");
if (fs.existsSync(publicImgPath)) {
  app.use(
    "/img",
    express.static(publicImgPath, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store");
      }
    })
  );
}
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
app.listen(PORT, () => {
  console.log(`\u30B5\u30FC\u30D0\u30FC\u304C\u30DD\u30FC\u30C8 ${PORT} \u3067\u8D77\u52D5\u3057\u307E\u3057\u305F\u3002`);
  console.log(`\u30BB\u30FC\u30D6\u30D5\u30A9\u30EB\u30C0: ${SAVE_DIR}`);
});
