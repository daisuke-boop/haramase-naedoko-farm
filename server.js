// server.ts
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 4173;
var SAVE_DIR = path.resolve(__dirname, "saves");
var SAVE_FILE = path.resolve(SAVE_DIR, "save_data.json");
var PREVIOUS_SAVE_FILE = path.resolve(SAVE_DIR, "save_data.previous.json");
var GRID_COLS = 128;
var GRID_ROWS = 72;
var VALID_MAPS = /* @__PURE__ */ new Set(["farm", "house", "shed", "waterfall", "kawa", "doukutsu", "takiura"]);
var TILE_RECORD_FIELDS = ["obstacles", "hideAreaTiles", "bedTiles", "workbenchTiles", "fishingTiles"];
var FOOTSTEP_SOUNDS = /* @__PURE__ */ new Set(["soil", "grass", "foot", "rainw", "rock", "jutan"]);
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
    if (fs.existsSync(SAVE_FILE)) {
      const data = fs.readFileSync(SAVE_FILE, "utf8");
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
app.post("/api/save", (req, res) => {
  try {
    const sanitizedBody = sanitizeSaveData(req.body);
    if (!fs.existsSync(SAVE_DIR)) {
      fs.mkdirSync(SAVE_DIR, { recursive: true });
    }
    if (fs.existsSync(SAVE_FILE)) {
      const currentData = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
      const currentObstacleCount = Object.keys(currentData.obstacles ?? {}).length;
      const nextObstacleCount = Object.keys(sanitizedBody.obstacles ?? {}).length;
      const currentDoorCount = Array.isArray(currentData.doors) ? currentData.doors.length : 0;
      const nextDoorCount = Array.isArray(sanitizedBody.doors) ? sanitizedBody.doors.length : 0;
      const currentZoneCount = Array.isArray(currentData.zones) ? currentData.zones.length : 0;
      const nextZoneCount = Array.isArray(sanitizedBody.zones) ? sanitizedBody.zones.length : 0;
      const looksLikeInitialReset = currentObstacleCount > 100 && currentDoorCount > 8 && currentZoneCount > 8 && nextObstacleCount === 0 && nextDoorCount <= 6 && nextZoneCount <= 4;
      const looksLikeMapObstacleLoss = hasSuspiciousObstacleLoss(currentData, sanitizedBody);
      if (looksLikeInitialReset || looksLikeMapObstacleLoss) {
        console.warn("\u885D\u7A81\u8A2D\u5B9A\u304C\u5927\u304D\u304F\u6B20\u3051\u308B\u30BB\u30FC\u30D6\u4E0A\u66F8\u304D\u3092\u62D2\u5426\u3057\u307E\u3057\u305F\u3002");
        return res.status(409).json({ error: "\u885D\u7A81\u8A2D\u5B9A\u304C\u5927\u304D\u304F\u6B20\u3051\u308B\u30BB\u30FC\u30D6\u4E0A\u66F8\u304D\u3092\u62D2\u5426\u3057\u307E\u3057\u305F\u3002" });
      }
      fs.copyFileSync(SAVE_FILE, PREVIOUS_SAVE_FILE);
    }
    fs.writeFileSync(SAVE_FILE, JSON.stringify(sanitizedBody, null, 2), "utf8");
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
