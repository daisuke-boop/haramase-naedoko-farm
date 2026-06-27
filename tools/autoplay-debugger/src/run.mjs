import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const { chromium } = await import('playwright-core');

const here = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(here, '..');
const projectDir = path.resolve(toolDir, '../..');
const scenarioId = process.argv[2] ?? 'startup-hard';
const scenarioPath = path.join(toolDir, 'scenarios', `${scenarioId}.json`);
const scenario = JSON.parse(await fs.readFile(scenarioPath, 'utf8'));
const port = Number(process.env.FARM_DEBUG_PORT ?? 4317);
const baseUrl = `http://127.0.0.1:${port}`;
const runtimeDir = path.join(toolDir, '.runtime', scenarioId);
const saveDir = path.join(runtimeDir, 'saves');
const reportRoot = path.join(projectDir, 'debug-reports');
const runStamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const reportDir = path.join(reportRoot, `${runStamp}_${scenarioId}`);
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await fs.rm(runtimeDir, { recursive: true, force: true });
await fs.mkdir(saveDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });
const canonicalMapSettings = path.join(projectDir, 'saves', 'map_settings.json');
try {
  await fs.copyFile(canonicalMapSettings, path.join(saveDir, 'map_settings.json'));
} catch (error) {
  throw new Error(`新規ゲーム用マップ設定を準備できませんでした: ${canonicalMapSettings}`, { cause: error });
}

const events = [];
const findings = [];
const findingKeys = new Set();
const runStartedAtMs = Date.now();
let gameStartedAtMs = null;
const formatDuration = ms => {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};
const humanEstimateConfig = {
  enabled: scenario.humanEstimate !== false,
  minMultiplier: Number(scenario.humanEstimateMinMultiplier ?? 4),
  eventExtraMs: Number(scenario.humanEstimateEventExtraMs ?? 1800),
};
const estimateHumanMs = autoMs => {
  if (!humanEstimateConfig.enabled || typeof autoMs !== 'number' || !Number.isFinite(autoMs)) return null;
  return Math.round(autoMs * humanEstimateConfig.minMultiplier + humanEstimateConfig.eventExtraMs);
};
const addEvent = (type, detail) => {
  const nowMs = Date.now();
  if (type === 'game-started' && gameStartedAtMs === null) gameStartedAtMs = nowMs;
  const playElapsedMs = gameStartedAtMs === null ? null : nowMs - gameStartedAtMs;
  events.push({
    at: new Date(nowMs).toISOString(),
    elapsedMs: nowMs - runStartedAtMs,
    playElapsedMs,
    humanEstimatedPlayMs: playElapsedMs === null ? null : estimateHumanMs(playElapsedMs),
    type,
    detail,
  });
};
const addFinding = (severity, type, detail) => {
  const key = `${severity}:${type}:${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  if (findingKeys.has(key)) return;
  findingKeys.add(key);
  findings.push({
    at: new Date().toISOString(),
    elapsedMs: Date.now() - runStartedAtMs,
    playElapsedMs: gameStartedAtMs === null ? null : Date.now() - gameStartedAtMs,
    humanEstimatedPlayMs: gameStartedAtMs === null ? null : estimateHumanMs(Date.now() - gameStartedAtMs),
    severity,
    type,
    detail,
  });
};

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const getFindingSummary = finding => {
  if (finding.detail && typeof finding.detail === 'object') {
    return finding.detail.symptom ?? finding.detail.label ?? finding.detail.objective ?? JSON.stringify(finding.detail);
  }
  if (finding.type === 'console-error') return 'ゲーム内部でJavaScriptエラーが出ています。';
  if (finding.type === 'runner-failure') return '自動プレイ中に停止しました。';
  if (finding.type === 'http-error') return '通信エラーが発生しました。';
  if (finding.type === 'request-failed') return '素材または通信の読み込みに失敗しました。';
  return String(finding.detail ?? finding.type);
};

const getFindingScreenshot = finding => (
  finding.detail && typeof finding.detail === 'object' && typeof finding.detail.screenshot === 'string'
    ? finding.detail.screenshot
    : null
);

const getSeverityLabel = severity => ({
  error: '要確認',
  warning: '注意',
  candidate: '候補',
}[severity] ?? severity);

const getStatusLabel = status => (
  status === 'passed'
    ? '完走しました'
    : findings.some(item => item.type === 'runner-failure')
      ? '途中停止しました'
      : '完走したが不具合候補あり'
);

let server;
let browser;
let page;

const waitForServer = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`ゲームサーバーが30秒以内に起動しませんでした: ${baseUrl}`);
};

const collectLayoutCandidates = async page => page.evaluate(() => {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const isVisible = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 1 && rect.height > 1;
  };

  return [...document.querySelectorAll('button, [role="button"], input, select, textarea, p, span, h1, h2, h3')]
    .filter(isVisible)
    .flatMap((element, index) => {
      const rect = element.getBoundingClientRect();
      const label = (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 100);
      const issues = [];
      if (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2) {
        issues.push('content-overflow');
      }
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) && (rect.left < -2 || rect.top < -2 || rect.right > viewportWidth + 2 || rect.bottom > viewportHeight + 2)) {
        issues.push('interactive-outside-viewport');
      }
      return issues.map(issue => ({ index, issue, label, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }));
    });
});

const clickUniqueRole = async (page, role, name) => {
  const locator = page.getByRole(role, { name, exact: true });
  const count = await locator.count();
  if (count !== 1) throw new Error(`${role}「${name}」の候補数が1ではありません: ${count}`);
  await locator.click();
};

const clickButtonContainingText = async (page, text) => {
  const locator = page.getByRole('button').filter({ hasText: text });
  const count = await locator.count();
  if (count < 1) throw new Error(`button「${text}」が見つかりません。`);
  await locator.nth(0).click();
};

const pressUntilVisible = async (page, key, locator, attempts = 12) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    if (await locator.isVisible().catch(() => false)) return true;
  }
  return false;
};

const getMapLocator = async page => {
  const locator = page.locator('div[style*="width: 1920px"][style*="height: 1080px"][style*="background-image"]');
  const count = await locator.count();
  if (count !== 1) throw new Error(`ゲームマップ要素の候補数が1ではありません: ${count}`);
  return locator;
};

const clickMapPoint = async (page, x, y, waitMs = 1600) => {
  const map = await getMapLocator(page);
  const box = await map.boundingBox();
  if (!box) throw new Error('ゲームマップの表示領域を取得できませんでした。');
  await page.mouse.click(box.x + x * box.width / 1920, box.y + y * box.height / 1080);
  await page.waitForTimeout(waitMs);
};

const moveThroughDoor = async (page, x, y, destinationLocator, destinationLabel) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await clickMapPoint(page, x, y, 3200);
    if (await destinationLocator.isVisible().catch(() => false)) return;
    addEvent('movement-retry', `${destinationLabel}への移動を再試行しました (${attempt}/3)`);
  }
  throw new Error(`${destinationLabel}へ3回試しても到達できませんでした。`);
};

const moveThroughDoorViaPoints = async (page, points, destinationLocator, destinationLabel) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    for (const [x, y, waitMs = 1400] of points) {
      await clickMapPoint(page, x, y, waitMs);
      if (await destinationLocator.isVisible().catch(() => false)) return;
    }
    addEvent('movement-retry', `${destinationLabel}への移動を再試行しました (${attempt}/3)`);
  }
  throw new Error(`${destinationLabel}へ3回試しても到達できませんでした。`);
};

const holdMoveKey = async (page, key, durationMs) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(300);
};

const interactWithKurumi = async (page, expectedText) => {
  const kurumiImage = page.locator('img[alt="kurumi"]');
  const imageCount = await kurumiImage.count();
  if (imageCount !== 1) throw new Error(`くるみ画像の候補数が1ではありません: ${imageCount}`);
  const clickableZone = page.locator('div.pointer-events-auto.cursor-pointer').filter({ has: kurumiImage });
  const zoneCount = await clickableZone.count();
  if (zoneCount !== 1) throw new Error(`くるみクリック領域の候補数が1ではありません: ${zoneCount}`);
  const expected = page.getByText(expectedText, { exact: true });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await clickableZone.click({ timeout: 5_000 });
    await page.waitForTimeout(attempt === 1 ? 10_000 : 1200);
    if (await expected.isVisible().catch(() => false)) return;
    addEvent('interaction-retry', `くるみとの会話開始を再試行しました (${attempt}/3)`);
  }
  throw new Error('くるみに3回話しかけても会話を開始できませんでした。');
};

const readVisibleObjective = page => page.evaluate(() => {
  const candidates = [...document.querySelectorAll('span')].filter(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.textContent?.includes('NEXT');
  });
  return candidates[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
});

const readPlayerPosition = page => page.evaluate(() => {
  const image = [...document.querySelectorAll('img[alt="Player"]')]
    .find(element => element.closest('div.absolute.pointer-events-none'));
  const container = image?.closest('div.absolute.pointer-events-none');
  const map = document.querySelector('div[style*="width: 1920px"][style*="height: 1080px"][style*="background-image"]');
  if (!(container instanceof HTMLElement) || !(map instanceof HTMLElement)) return null;
  const playerRect = container.getBoundingClientRect();
  const mapRect = map.getBoundingClientRect();
  if (mapRect.width <= 0 || mapRect.height <= 0) return null;
  return {
    x: (playerRect.left + playerRect.width / 2 - mapRect.left) * 1920 / mapRect.width,
    y: (playerRect.bottom - mapRect.top) * 1080 / mapRect.height,
  };
});

const sleepInHouseToNextDay = async (page, expectedDayText, screenshotName) => {
  for (const [x, y] of [[783, 584], [819, 531], [748, 451], [641, 416]]) {
    await clickMapPoint(page, x, y, 1400);
  }
  await page.getByText('眠る？', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickUniqueRole(page, 'button', 'はい');
  await page.getByText(expectedDayText, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.screenshot({ path: path.join(reportDir, screenshotName), fullPage: false, timeout: 15_000 });
  addEvent('day-reached', `${expectedDayText}へ到達しました`);
};

const sleepInHouseToRepaymentDeadline = async page => {
  for (const [x, y] of [[783, 584], [819, 531], [748, 451], [641, 416]]) {
    await clickMapPoint(page, x, y, 1400);
  }
  await page.getByText('眠る？', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickUniqueRole(page, 'button', 'はい');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await page.getByText('返済期日', { exact: true }).isVisible().catch(() => false)) {
      await page.screenshot({ path: path.join(reportDir, 'repayment-deadline.png'), fullPage: false, timeout: 15_000 });
      addEvent('repayment-deadline-reached', '7日目の就寝時に1回目の返済期日へ到達しました');
      return true;
    }
    if (await page.getByText('8日目', { exact: true }).isVisible().catch(() => false)) {
      const screenshot = 'repayment-missing-day-eight.png';
      await page.screenshot({ path: path.join(reportDir, screenshot), fullPage: false, timeout: 15_000 });
      addFinding('warning', 'repayment-deadline-missing', {
        symptom: '7日目の就寝後、返済期日画面が出ないまま8日目へ進みました。',
        expected: '返済期日画面',
        actual: '8日目へ進行',
        screenshot,
      });
      addEvent('repayment-deadline-missing', '返済期日画面が出ずに8日目へ進みました');
      return false;
    }
    await page.waitForTimeout(250);
  }
  const screenshot = 'repayment-deadline-timeout.png';
  await page.screenshot({ path: path.join(reportDir, screenshot), fullPage: false, timeout: 15_000 });
  addFinding('warning', 'repayment-deadline-timeout', {
    symptom: '7日目の就寝後、返済期日画面も8日目表示も15秒以内に確認できませんでした。',
    screenshot,
  });
  addEvent('repayment-deadline-timeout', '返済期日画面の待機がタイムアウトしました');
  return false;
};

const runDayOne = async (page, reportDir) => {
  for (let pageNo = 2; pageNo <= 4; pageNo += 1) {
    await clickUniqueRole(page, 'button', '次へ Enter');
    await page.getByText(`手紙 ${pageNo} / 6`, { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  }
  await clickUniqueRole(page, 'button', '次へ Enter');
  await page.getByRole('button', { name: '指輪と家の鍵の演出を閉じる', exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickUniqueRole(page, 'button', '指輪と家の鍵の演出を閉じる');
  await page.getByText('手紙 5 / 6', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickUniqueRole(page, 'button', '次へ Enter');
  await page.getByText('手紙 6 / 6', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickUniqueRole(page, 'button', '手紙を閉じる Enter');
  await page.getByText('孕ませ村へ', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickUniqueRole(page, 'button', 'Enter');
  addEvent('prologue-completed', '手紙と導入を通常操作で完了しました');

  await moveThroughDoor(page, 560, 545, page.locator('img[alt="fireplace"]'), '自宅');
  await moveThroughDoor(page, 855, 780, page.getByTitle('家への入口'), '牧場');
  addEvent('opening-walk-completed', '家へ入り牧場へ戻る通常移動を完了しました');

  for (const [x, y] of [[760, 680], [900, 680], [1000, 650], [1120, 650], [1120, 580]]) {
    await clickMapPoint(page, x, y, 1400);
  }
  await interactWithKurumi(page, 'KURUMI');
  const topics = ['孕ませ村とは？', '借金の返し方は？', '苗床って？', 'パンツ見せて！', 'お爺さんとの関係は？'];
  for (const topic of topics) {
    await clickUniqueRole(page, 'button', topic);
    await page.getByRole('button', { name: `${topic} 聞いた`, exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  }
  await clickUniqueRole(page, 'button', 'とくにない');
  await page.getByText('苗娘を植えてみよう', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  addEvent('kurumi-intro-completed', 'くるみの説明を一通り聞きました');

  for (let step = 2; step <= 4; step += 1) {
    await clickUniqueRole(page, 'button', '次へ');
    await page.getByText(`${step} / 4`, { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  }
  await clickUniqueRole(page, 'button', '植えに行く');
  const plantButtons = page.getByRole('button', { name: '＋ 植える', exact: true });
  const plantButtonCount = await plantButtons.count();
  if (plantButtonCount < 1) throw new Error('植えられる畑がありません。');
  await plantButtons.nth(0).click();
  await clickUniqueRole(page, 'button', 'はい');
  await clickUniqueRole(page, 'button', 'いちごの苗娘 植え付け可');
  await clickUniqueRole(page, 'button', 'はい');
  await page.getByRole('button', { name: 'いちごの苗娘 成長中 0/2日', exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  addEvent('seed-planted', 'いちごの苗娘を空き畑へ植えました');

  await interactWithKurumi(page, '植えた苗娘を見てみよう');
  for (let step = 2; step <= 5; step += 1) {
    await clickUniqueRole(page, 'button', '次へ');
    await page.getByText(`${step} / 5`, { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  }
  await clickUniqueRole(page, 'button', 'おわり');

  const objective = await readVisibleObjective(page);
  if (objective?.includes('苗娘を') && objective.includes('植えよう')) {
    const screenshot = 'objective-mismatch.png';
    await page.screenshot({ path: path.join(reportDir, screenshot), fullPage: false, timeout: 15_000 });
    addFinding('warning', 'objective-mismatch', {
      symptom: '苗娘を植えた後も、苗娘を植えるよう促す目標が表示され続けます。',
      objective,
      screenshot,
    });
  }

  for (const [x, y, waitMs] of [[1120, 680, 1400], [1000, 680, 1400], [900, 680, 1400], [760, 680, 1400], [650, 650, 1400], [567, 611, 1600]]) {
    await clickMapPoint(page, x, y, waitMs);
  }
  await moveThroughDoor(page, 560, 545, page.locator('img[alt="fireplace"]'), '自宅');
  await sleepInHouseToNextDay(page, '2日目', 'day-two-reached.png');
  addEvent('day-one-completed', '就寝して2日目へ到達しました');
};

const runDayThree = async page => {
  await runDayOne(page, reportDir);
  await sleepInHouseToNextDay(page, '3日目', 'day-three-reached.png');
  addEvent('multi-day-completed', '3日目へ到達する複数日チェックを完了しました');
};

const runDaySevenRepayment = async page => {
  await runDayOne(page, reportDir);
  for (const day of [3, 4, 5, 6, 7]) {
    await sleepInHouseToNextDay(page, `${day}日目`, `day-${day}-reached.png`);
  }
  const repaymentShown = await sleepInHouseToRepaymentDeadline(page);
  if (repaymentShown) {
    await clickButtonContainingText(page, '今回は見送る');
    await page.getByText('8日目', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(reportDir, 'day-eight-after-repayment.png'), fullPage: false, timeout: 15_000 });
    addEvent('first-repayment-completed', '1回目の返済イベントを見送りで処理し、8日目へ到達しました');
  }
};

const runHarvestSell = async page => {
  await runDayOne(page, reportDir);
  await sleepInHouseToNextDay(page, '3日目', 'day-three-before-harvest.png');
  await page.waitForTimeout(2500);
  const wakePosition = await readPlayerPosition(page);
  addEvent('wake-position', `3日目の起床位置: ${JSON.stringify(wakePosition)}`);
  const farmEntrance = page.getByTitle('家への入口');
  await holdMoveKey(page, 'ArrowRight', 1200);
  addEvent('move-position', `右移動後: ${JSON.stringify(await readPlayerPosition(page))}`);
  await holdMoveKey(page, 'ArrowDown', 750);
  addEvent('move-position', `下移動後: ${JSON.stringify(await readPlayerPosition(page))}`);
  await holdMoveKey(page, 'ArrowRight', 1000);
  addEvent('move-position', `2回目の右移動後: ${JSON.stringify(await readPlayerPosition(page))}`);
  await holdMoveKey(page, 'ArrowDown', 4100);
  addEvent('move-position', `2回目の下移動後: ${JSON.stringify(await readPlayerPosition(page))}`);
  await farmEntrance.waitFor({ state: 'visible', timeout: 8_000 });
  const harvestPrompt = page.getByText('収穫しますか？', { exact: true });
  const harvestButton = page.getByRole('button').filter({ hasText: '収穫可' }).first();
  const openedHarvestPrompt = await harvestButton.isVisible().catch(() => false);
  if (openedHarvestPrompt) {
    await harvestButton.click();
    await harvestPrompt.waitFor({ state: 'visible', timeout: 5_000 });
  }
  if (!openedHarvestPrompt) {
    const screenshot = 'harvest-prompt-missing.png';
    await page.screenshot({ path: path.join(reportDir, screenshot), fullPage: false, timeout: 15_000 });
    addFinding('error', 'harvest-prompt-missing', {
      symptom: '3日目に成熟した苗娘へ近づいても収穫確認が出ませんでした。',
      screenshot,
    });
    return;
  }
  await clickUniqueRole(page, 'button', 'はい');
  const firstHarvestReveal = page.locator('.farm-girl-reveal-spotlight');
  if (await firstHarvestReveal.isVisible().catch(() => false)) {
    await firstHarvestReveal.waitFor({ state: 'hidden', timeout: 25_000 });
  } else {
    await page.getByText('収穫しました！', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  }
  await page.screenshot({ path: path.join(reportDir, 'harvest-result.png'), fullPage: false, timeout: 15_000 });
  const okButton = page.getByRole('button', { name: 'OK', exact: true });
  if (await okButton.isVisible().catch(() => false)) await okButton.click();
  addEvent('harvest-completed', '成熟したいちごの苗娘を収穫しました');

  await interactWithKurumi(page, 'くるみ商店');
  await clickUniqueRole(page, 'button', '売却品');
  await page.getByRole('button', { name: /ちびいちのいちご/ }).click();
  const goldBeforeSale = Number((await readDayAndMoney(page)).money?.replaceAll(',', '') ?? 0);
  await clickUniqueRole(page, 'button', '売却する');
  await page.waitForTimeout(800);
  const goldAfterSale = Number((await readDayAndMoney(page)).money?.replaceAll(',', '') ?? 0);
  if (goldAfterSale <= goldBeforeSale) {
    throw new Error(`売却後に所持金が増えませんでした: ${goldBeforeSale}G -> ${goldAfterSale}G`);
  }
  await page.screenshot({ path: path.join(reportDir, 'sold-harvest.png'), fullPage: false, timeout: 15_000 });
  addEvent('sell-completed', `収穫物「ちびいちのいちご」を売却しました (${goldBeforeSale}G -> ${goldAfterSale}G)`);
};

const readDayAndMoney = page => page.evaluate(() => {
  const text = document.body.innerText.replace(/\s+/g, ' ');
  return {
    day: text.match(/(\d+)日目/)?.[1] ?? null,
    money: text.match(/GOLD\s*([\d,]+)\s*G/i)?.[1] ?? null,
  };
});

const runSaveLoad = async page => {
  await runDayOne(page, reportDir);
  await page.waitForTimeout(2500);
  const before = await readDayAndMoney(page);

  await page.keyboard.press('m');
  await page.getByText('📋 メニュー', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
  await clickButtonContainingText(page, 'システム');
  await clickUniqueRole(page, 'button', 'セーブ');
  await page.getByText('保存先のスロットを選択してください。', { exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /セーブスロット 2/ }).click();
  await page.getByText('スロット2にセーブしました。', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
  addEvent('manual-save-completed', '専用セーブ領域のスロット2へ保存しました');

  await clickUniqueRole(page, 'button', 'ロード');
  await page.getByText('読み込むスロットを選択してください。', { exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /セーブスロット 2/ }).click();
  await page.waitForTimeout(1500);
  const after = await readDayAndMoney(page);
  await page.screenshot({ path: path.join(reportDir, 'save-load-restored.png'), fullPage: false, timeout: 15_000 });

  if (before.day !== after.day || before.money !== after.money) {
    addFinding('error', 'save-load-state-mismatch', {
      symptom: 'ロード後の日付または所持金が保存時と一致しません。',
      expected: before,
      actual: after,
      screenshot: 'save-load-restored.png',
    });
    return;
  }
  addEvent('save-load-completed', `日付 ${after.day}日目・所持金 ${after.money}G の復元を確認しました`);
};

const exitHouseAfterSleep = async page => {
  await page.waitForTimeout(2500);
  await holdMoveKey(page, 'ArrowRight', 1200);
  await holdMoveKey(page, 'ArrowDown', 750);
  await holdMoveKey(page, 'ArrowRight', 1000);
  await holdMoveKey(page, 'ArrowDown', 4100);
  await page.getByTitle('家への入口').waitFor({ state: 'visible', timeout: 8_000 });
};

const runFishingAttempt = async page => {
  await page.getByText('投げる方向を決めよう', { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(7600);

  const keepLabel = page.getByText('魚の体力', { exact: true });
  const resultButton = page.getByRole('button', { name: 'チュートリアルを終わる', exact: true });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await keepLabel.isVisible().catch(() => false) || await resultButton.isVisible().catch(() => false)) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
  if (await keepLabel.isVisible().catch(() => false)) {
    for (let pulse = 0; pulse < 18 && !(await resultButton.isVisible().catch(() => false)); pulse += 1) {
      await page.keyboard.down('Enter');
      await page.waitForTimeout(260);
      await page.keyboard.up('Enter');
      await page.waitForTimeout(220);
    }
  }
  await resultButton.waitFor({ state: 'visible', timeout: 15_000 });
  return page.getByText(/お見事！.*釣り上げた。/).isVisible().catch(() => false);
};

const runFishing = async page => {
  await runDayOne(page, reportDir);
  await exitHouseAfterSleep(page);

  const tutorialButton = page.getByRole('button', { name: '釣りのチュートリアル', exact: true });
  await tutorialButton.click();
  await page.waitForTimeout(15_000);
  const lessonHeading = page.getByText('FISHING LESSON', { exact: true });
  if (!(await lessonHeading.isVisible().catch(() => false))) {
    await tutorialButton.click();
  }
  await lessonHeading.waitFor({ state: 'visible', timeout: 8_000 });
  for (let step = 1; step < 7; step += 1) {
    await clickButtonContainingText(page, step === 6 ? '釣ってみる！' : '次へ');
    await page.waitForTimeout(250);
  }

  const success = await runFishingAttempt(page);
  await page.screenshot({ path: path.join(reportDir, 'fishing-result.png'), fullPage: false, timeout: 15_000 });
  await page.waitForTimeout(1100);
  await clickUniqueRole(page, 'button', 'チュートリアルを終わる');
  for (let step = 0; step < 2; step += 1) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await page.getByText('FISHING LESSON', { exact: true }).waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
  addEvent('fishing-completed', success
    ? '釣りチュートリアルで魚を釣り上げました'
    : '釣りの全操作と失敗結果・チュートリアル終了を確認しました');
};

const writeReport = async status => {
  const finishedAtMs = Date.now();
  const screenshotFiles = (await fs.readdir(reportDir).catch(() => []))
    .filter(file => file.endsWith('.png'))
    .sort();
  const firstIssue = findings.find(item => item.severity === 'error' || item.severity === 'warning' || item.severity === 'candidate') ?? null;
  const timings = {
    totalElapsedMs: finishedAtMs - runStartedAtMs,
    totalElapsed: formatDuration(finishedAtMs - runStartedAtMs),
    playElapsedMs: gameStartedAtMs === null ? null : finishedAtMs - gameStartedAtMs,
    playElapsed: gameStartedAtMs === null ? null : formatDuration(finishedAtMs - gameStartedAtMs),
    humanEstimatedPlayMs: gameStartedAtMs === null ? null : estimateHumanMs(finishedAtMs - gameStartedAtMs),
    humanEstimatedPlayElapsed: gameStartedAtMs === null ? null : formatDuration(estimateHumanMs(finishedAtMs - gameStartedAtMs)),
    firstIssueElapsedMs: firstIssue?.elapsedMs ?? null,
    firstIssueElapsed: firstIssue ? formatDuration(firstIssue.elapsedMs) : null,
    firstIssuePlayElapsedMs: firstIssue?.playElapsedMs ?? null,
    firstIssuePlayElapsed: firstIssue?.playElapsedMs === null || firstIssue?.playElapsedMs === undefined ? null : formatDuration(firstIssue.playElapsedMs),
    firstIssueHumanEstimatedPlayMs: firstIssue?.humanEstimatedPlayMs ?? null,
    firstIssueHumanEstimatedPlayElapsed: firstIssue?.humanEstimatedPlayMs === null || firstIssue?.humanEstimatedPlayMs === undefined ? null : formatDuration(firstIssue.humanEstimatedPlayMs),
  };
  const report = {
    scenario,
    status,
    startedAt: events[0]?.at,
    finishedAt: new Date().toISOString(),
    timings,
    baseUrl,
    saveDir,
    screenshotFiles,
    findings,
    events,
  };
  await fs.writeFile(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
  const lines = [
    `# 自動デバッグ結果: ${scenario.id}`,
    '',
    `- 状態: ${status}`,
    `- 内容: ${scenario.description}`,
    `- 検出件数: ${findings.length}`,
    `- 実行時間: ${timings.totalElapsed}`,
    `- プレイ時間: ${timings.playElapsed ?? '未開始'}`,
    `- 通常プレイヤー想定時間: ${timings.humanEstimatedPlayElapsed ?? '未開始'}`,
    `- 最初の不具合候補まで: ${timings.firstIssuePlayElapsed ?? timings.firstIssueElapsed ?? 'なし'}`,
    `- 最初の不具合候補まで（通常プレイヤー想定）: ${timings.firstIssueHumanEstimatedPlayElapsed ?? 'なし'}`,
    `- 専用セーブ: ${saveDir}`,
    '',
    '## 検出事項',
    '',
    ...(findings.length ? findings.map(item => `- [${item.severity}] ${item.type}: ${typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}`) : ['- なし']),
    '',
    '## 主な操作',
    '',
    ...events.map(item => `- ${item.at} ${item.type}: ${typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail)}`),
  ];
  await fs.writeFile(path.join(reportDir, 'report.md'), `${lines.join('\n')}\n`);
  const finalScreenshot = screenshotFiles.includes('day-eight-after-repayment.png')
    ? 'day-eight-after-repayment.png'
    : screenshotFiles.includes('repayment-deadline.png')
      ? 'repayment-deadline.png'
      : screenshotFiles.includes('day-three-reached.png')
        ? 'day-three-reached.png'
        : screenshotFiles.includes('day-two-reached.png')
          ? 'day-two-reached.png'
          : null;
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>自動デバッグ結果 - ${escapeHtml(scenario.id)}</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; background: #140f0b; color: #fff7df; }
    body { margin: 0; background: radial-gradient(circle at top, #4a2b16 0, #1b120b 38%, #0d0907 100%); }
    main { max-width: 1120px; margin: 0 auto; padding: 28px 20px 48px; }
    .hero, .card { border: 1px solid rgba(255, 209, 102, .28); background: rgba(24, 15, 10, .86); box-shadow: 0 18px 50px rgba(0,0,0,.34); border-radius: 22px; }
    .hero { padding: 26px; }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: .02em; }
    h2 { margin: 28px 0 14px; font-size: 22px; }
    p { line-height: 1.75; }
    .muted { color: #d3b98d; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 20px; }
    .stat { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.06); border-radius: 16px; padding: 14px; }
    .stat .label { color: #d9bd8d; font-size: 13px; font-weight: 800; }
    .stat .value { margin-top: 7px; font-size: 20px; font-weight: 900; }
    .badge { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 7px 12px; font-weight: 900; }
    .badge.passed { background: #166534; color: #dcfce7; }
    .badge.failed { background: #7f1d1d; color: #fee2e2; }
    .grid { display: grid; gap: 16px; }
    .issue { padding: 18px; }
    .issue.error { border-color: rgba(248, 113, 113, .7); }
    .issue.warning { border-color: rgba(251, 191, 36, .7); }
    .issue.candidate { border-color: rgba(147, 197, 253, .6); }
    .issue-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .issue-title { font-size: 19px; font-weight: 900; }
    .pill { border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 900; background: rgba(255,255,255,.1); }
    pre { white-space: pre-wrap; word-break: break-word; background: rgba(0,0,0,.35); border-radius: 14px; padding: 12px; color: #f8e7c2; overflow: auto; }
    img { max-width: 100%; border-radius: 16px; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 10px 32px rgba(0,0,0,.38); }
    .timeline { margin: 0; padding-left: 20px; }
    .timeline li { margin: 8px 0; line-height: 1.55; }
    a { color: #fde68a; }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <span class="badge ${status === 'passed' ? 'passed' : 'failed'}">${escapeHtml(getStatusLabel(status))}</span>
    <h1>自動デバッグ結果</h1>
    <p class="muted">${escapeHtml(scenario.description)}</p>
    <div class="summary">
      <div class="stat"><div class="label">検出件数</div><div class="value">${findings.length}件</div></div>
      <div class="stat"><div class="label">実行時間</div><div class="value">${escapeHtml(timings.totalElapsed)}</div></div>
      <div class="stat"><div class="label">プレイ時間</div><div class="value">${escapeHtml(timings.playElapsed ?? '未開始')}</div></div>
      <div class="stat"><div class="label">通常プレイヤー想定時間</div><div class="value">${escapeHtml(timings.humanEstimatedPlayElapsed ?? '未開始')}</div></div>
      <div class="stat"><div class="label">最初の不具合候補まで</div><div class="value">${escapeHtml(timings.firstIssuePlayElapsed ?? timings.firstIssueElapsed ?? 'なし')}</div></div>
      <div class="stat"><div class="label">不具合候補まで（通常想定）</div><div class="value">${escapeHtml(timings.firstIssueHumanEstimatedPlayElapsed ?? 'なし')}</div></div>
    </div>
  </section>

  <h2>検出事項</h2>
  <section class="grid">
    ${findings.length ? findings.map((finding, index) => {
      const screenshot = getFindingScreenshot(finding);
      const detailText = typeof finding.detail === 'string' ? finding.detail : JSON.stringify(finding.detail, null, 2);
      return `<article class="card issue ${escapeHtml(finding.severity)}">
        <div class="issue-head">
          <div class="issue-title">${index + 1}. ${escapeHtml(getFindingSummary(finding))}</div>
          <div class="pill">${escapeHtml(getSeverityLabel(finding.severity))} / ${escapeHtml(finding.type)}</div>
        </div>
        <p class="muted">遭遇時間: ${escapeHtml(finding.playElapsedMs === null ? formatDuration(finding.elapsedMs) ?? '不明' : formatDuration(finding.playElapsedMs) ?? '不明')} / 通常想定: ${escapeHtml(finding.humanEstimatedPlayMs === null || finding.humanEstimatedPlayMs === undefined ? '未計算' : formatDuration(finding.humanEstimatedPlayMs) ?? '不明')}</p>
        ${screenshot ? `<p><img src="${escapeHtml(screenshot)}" alt="${escapeHtml(getFindingSummary(finding))} のスクリーンショット"></p>` : ''}
        <pre>${escapeHtml(detailText)}</pre>
      </article>`;
    }).join('\n') : '<article class="card issue"><p>不具合候補は検出されませんでした。</p></article>'}
  </section>

  ${finalScreenshot ? `<h2>到達画面</h2><p><img src="${escapeHtml(finalScreenshot)}" alt="自動プレイの最終到達画面"></p>` : ''}

  ${screenshotFiles.length ? `<h2>スクリーンショット一覧</h2><section class="grid">${screenshotFiles.map(file => `<article class="card issue"><p class="muted">${escapeHtml(file)}</p><img src="${escapeHtml(file)}" alt="${escapeHtml(file)}"></article>`).join('\n')}</section>` : ''}

  <h2>主な操作ログ</h2>
  <section class="card issue">
    <ol class="timeline">
      ${events.filter(item => !item.type.startsWith('server-')).map(item => `<li><strong>${escapeHtml(item.type)}</strong> <span class="muted">(${escapeHtml(item.playElapsedMs === null ? formatDuration(item.elapsedMs) ?? '開始前' : formatDuration(item.playElapsedMs) ?? '不明')})</span><br>${escapeHtml(typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail))}</li>`).join('\n')}
    </ol>
  </section>
</main>
</body>
</html>`;
  await fs.writeFile(path.join(reportDir, 'report.html'), html);
};

try {
  addEvent('run-start', scenario.description);
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: projectDir,
    env: { ...process.env, FARM_SAVE_DIR: saveDir, DISABLE_HMR: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => addEvent('server-stdout', chunk.toString().trim()));
  server.stderr.on('data', chunk => addEvent('server-stderr', chunk.toString().trim()));
  await waitForServer();

  browser = await chromium.launch({ executablePath: chromePath, headless: process.env.HEADFUL !== 'true' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.on('console', async message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      const location = message.location();
      const source = location.url
        ? ` @ ${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`
        : '';
      const argumentDetails = await Promise.all(message.args().slice(1).map(async argument => {
        try {
          const value = await argument.jsonValue();
          return typeof value === 'string' ? value : JSON.stringify(value);
        } catch {
          return '';
        }
      }));
      const details = argumentDetails.filter(Boolean).join('\n');
      addFinding('error', 'console-error', `${message.text()}${source}${details ? `\n${details}` : ''}`);
    }
  });
  page.on('pageerror', error => addFinding('error', 'page-error', error.message));
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText ?? '';
    if (reason !== 'net::ERR_ABORTED') {
      addFinding('warning', 'request-failed', `${request.method()} ${request.url()} ${reason}`);
    }
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      addFinding(response.status() >= 500 ? 'error' : 'warning', 'http-error', `${response.status()} ${response.url()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const splashCloseButton = page.getByRole('button', { name: 'トップ画面を閉じてタイトルへ進む' });
  if (await splashCloseButton.isVisible().catch(() => false)) {
    await splashCloseButton.click();
    addEvent('splash-closed', 'トップ画面からタイトルへ進みました');
  }
  const introSkipButton = page.getByRole('button', { name: 'イントロ動画をスキップしてタイトルへ進む', exact: true });
  if (await introSkipButton.isVisible().catch(() => false)) {
    await introSkipButton.click();
    addEvent('intro-skipped', '自動デバッグではタイトル前のイントロ動画をスキップしました');
  }
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.getByRole('button', { name: /セーブスロット 1/ }).click();
  await page.getByRole('button', { name: scenario.difficulty }).click();
  await page.locator('img[alt="孕ませ苗床ファーム タイトル"]').waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByText('1日目', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  addEvent('game-started', `${scenario.difficulty} / 1日目`);

  await page.screenshot({ path: path.join(reportDir, 'game-started.png'), fullPage: false, timeout: 15_000 });
  const layoutCandidates = await collectLayoutCandidates(page);
  for (const candidate of layoutCandidates) addFinding('candidate', candidate.issue, candidate);

  if (scenario.id === 'day-one') await runDayOne(page, reportDir);
  if (scenario.id === 'day-three') await runDayThree(page);
  if (scenario.id === 'day-seven-repayment') await runDaySevenRepayment(page);
  if (scenario.id === 'harvest-sell') await runHarvestSell(page);
  if (scenario.id === 'save-load') await runSaveLoad(page);
  if (scenario.id === 'fishing') await runFishing(page);
  await writeReport(findings.some(item => item.severity === 'error') ? 'failed' : 'passed');
} catch (error) {
  addFinding('error', 'runner-failure', error instanceof Error ? error.stack ?? error.message : String(error));
  if (page) {
    await page.screenshot({ path: path.join(reportDir, 'failure.png'), fullPage: false, timeout: 10_000 }).catch(() => {});
  }
  await writeReport('failed');
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server && !server.killed) server.kill('SIGTERM');
  console.log(`レポート: ${reportDir}`);
}
