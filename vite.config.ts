import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import fs from 'fs';

const FARM_GIRL_CARD_BACK_SRC = '/img/card.png';
const FARM_GIRL_CARD_IMAGES = ['/img/chibiichi-card.jpg', '/img/ruby-card.jpg', '/img/mel-card.jpg'];
const OPEN_FARM_GIRL_CARD_COUNT = FARM_GIRL_CARD_IMAGES.filter(src => src !== FARM_GIRL_CARD_BACK_SRC).length;

export default defineConfig(() => {
  const saveDir = process.env.FARM_SAVE_DIR
    ? path.resolve(process.env.FARM_SAVE_DIR)
    : path.resolve(__dirname, 'saves');

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'save-api-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const requestUrl = new URL(req.url ?? '/', 'http://localhost');
            const getSaveSlot = () => {
              const slot = Number(requestUrl.searchParams.get('slot') ?? 1);
              return Number.isInteger(slot) && slot >= 1 && slot <= 5 ? slot : 1;
            };
            const getSavePath = (slot: number) => {
              return {
                saveDir,
                savePath: slot === 1
                  ? path.resolve(saveDir, 'save_data.json')
                  : path.resolve(saveDir, `save_data.slot${slot}.json`),
                previousSavePath: slot === 1
                  ? path.resolve(saveDir, 'save_data.previous.json')
                  : path.resolve(saveDir, `save_data.slot${slot}.previous.json`),
              };
            };
            const createSaveSlotSummary = (slot: number) => {
              const { savePath } = getSavePath(slot);
              if (!fs.existsSync(savePath)) return { slot, exists: false };
              const data = JSON.parse(fs.readFileSync(savePath, 'utf8'));
              const stat = fs.statSync(savePath);
              const turn = typeof data.turn === 'number' ? data.turn : 0;
              const ownedGirlCount = Array.isArray(data.ownedGirls)
                ? data.ownedGirls.length
                : Array.isArray(data.unlockedGirls)
                  ? data.unlockedGirls.length
                  : OPEN_FARM_GIRL_CARD_COUNT;
              return {
                slot,
                exists: true,
                day: Math.floor(turn / 4) + 1,
                debt: typeof data.debt === 'number' ? data.debt : 100000000,
                gold: typeof data.gold === 'number' ? data.gold : 5000,
                map: typeof data.currentMap === 'string' ? data.currentMap : 'farm',
                updatedAt: stat.mtime.toISOString(),
                ownedGirlCount,
                caughtFishCount: Array.isArray(data.caughtFishIds) ? data.caughtFishIds.length : 0,
              };
            };

            if (requestUrl.pathname === '/api/save-slots' && req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(Array.from({ length: 5 }, (_, index) => createSaveSlotSummary(index + 1))));
            } else if (requestUrl.pathname === '/api/save' && req.method === 'DELETE') {
              const { savePath, previousSavePath } = getSavePath(getSaveSlot());
              if (fs.existsSync(savePath)) {
                fs.unlinkSync(savePath);
              }
              if (fs.existsSync(previousSavePath)) {
                fs.unlinkSync(previousSavePath);
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } else if (requestUrl.pathname === '/api/save' && req.method === 'GET') {
              // セーブデータの取得処理
              const { savePath } = getSavePath(getSaveSlot());
              if (fs.existsSync(savePath)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(fs.readFileSync(savePath, 'utf8'));
              } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({}));
              }
            } else if (requestUrl.pathname === '/api/save' && req.method === 'POST') {
              // セーブデータの保存処理
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const { saveDir, savePath } = getSavePath(getSaveSlot());
                  if (!fs.existsSync(saveDir)) {
                    fs.mkdirSync(saveDir, { recursive: true });
                  }
                  fs.writeFileSync(savePath, JSON.stringify(JSON.parse(body), null, 2), 'utf8');
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } catch (e) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'セーブデータの書き込みに失敗しました' }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : {
            ignored: ['**/saves/**'],
          },
    },
  };
});
