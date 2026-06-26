import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

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

const events = [];
const findings = [];
const addEvent = (type, detail) => events.push({ at: new Date().toISOString(), type, detail });
const addFinding = (severity, type, detail) => findings.push({ severity, type, detail });

let server;
let browser;

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

const writeReport = async status => {
  const report = {
    scenario,
    status,
    startedAt: events[0]?.at,
    finishedAt: new Date().toISOString(),
    baseUrl,
    saveDir,
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
  const page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      addFinding('error', 'console-error', message.text());
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
  await page.getByRole('button', { name: 'はじめから' }).click();
  await page.getByRole('button', { name: /セーブスロット 1/ }).click();
  await page.getByRole('button', { name: scenario.difficulty }).click();
  await page.locator('img[alt="孕ませ苗床ファーム タイトル"]').waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByText('1日目', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  addEvent('game-started', `${scenario.difficulty} / 1日目`);

  await page.screenshot({ path: path.join(reportDir, 'game-started.png'), fullPage: true });
  const layoutCandidates = await collectLayoutCandidates(page);
  for (const candidate of layoutCandidates) addFinding('candidate', candidate.issue, candidate);

  if (!scenario.finishAfterStart) {
    addFinding('info', 'expected-incomplete', '1日目の行動方針は次段階で実装します。ゲーム本編の不具合ではありません。');
    await writeReport('expected-incomplete');
  } else {
    await writeReport(findings.some(item => item.severity === 'error') ? 'failed' : 'passed');
  }
} catch (error) {
  addFinding('error', 'runner-failure', error instanceof Error ? error.stack ?? error.message : String(error));
  await writeReport('failed');
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (server && !server.killed) server.kill('SIGTERM');
  console.log(`レポート: ${reportDir}`);
}
