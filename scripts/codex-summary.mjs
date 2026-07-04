import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = process.cwd();
const MAX_SECTION_LINES = 120;
const MAX_TOTAL_LINES = 320;
const MAX_LINE_LENGTH = 500;
const excludedNames = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.next', '.vite', 'out',
  'assets', 'images', 'audio', 'video',
]);
const searchableExtensions = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.scss', '.html',
  '.json', '.md', '.yaml', '.yml',
]);
const excludedFiles = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'server.js',
  'scripts/codex-summary.mjs',
]);

const output = [];

function appendSection(title, content, limit = MAX_SECTION_LINES) {
  output.push(`\n## ${title}`);
  const lines = String(content || '(なし)').split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(0, limit)) {
    output.push(line.length > MAX_LINE_LENGTH ? `${line.slice(0, MAX_LINE_LENGTH)} …` : line);
  }
  if (lines.length > limit) output.push(`… ${lines.length - limit}行を省略`);
}

function safeGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 2 * 1024 * 1024,
    }).trim();
  } catch (error) {
    return `取得失敗: ${error.message}`;
  }
}

function walk(directory, files = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || excludedNames.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

appendSection('git status --short', safeGit(['status', '--short']));
appendSection('git diff --stat', safeGit(['diff', '--stat']));

try {
  const recentFiles = walk(resolve(root, 'src'))
    .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 30)
    .map(({ path }) => relative(root, path));
  appendSection('最近更新された src ファイル（最大30件）', recentFiles.join('\n'));
} catch (error) {
  appendSection('最近更新された src ファイル', `取得失敗: ${error.message}`);
}

try {
  const matches = [];
  const pattern = /TODO|FIXME|console\.error|throw\s+new\s+Error/;
  const extensionOf = (path) => path.slice(path.lastIndexOf('.')).toLowerCase();

  for (const path of walk(root)) {
    const projectPath = relative(root, path);
    if (matches.length >= 50 || excludedFiles.has(projectPath) || !searchableExtensions.has(extensionOf(path))) continue;
    let stats;
    try {
      stats = statSync(path);
      if (stats.size > 1024 * 1024) continue;
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length && matches.length < 50; index += 1) {
        if (pattern.test(lines[index])) {
          matches.push(`${projectPath}:${index + 1}: ${lines[index].trim()}`);
        }
      }
    } catch {
      // 読み込めないファイルは安全にスキップする。
    }
  }
  appendSection('TODO / FIXME / console.error / throw new Error（最大50件）', matches.join('\n'));
} catch (error) {
  appendSection('要確認コード', `検索失敗: ${error.message}`);
}

if (output.length > MAX_TOTAL_LINES) {
  output.length = MAX_TOTAL_LINES;
  output.push('… 出力が長いため省略しました');
}

console.log(output.join('\n').trim());
