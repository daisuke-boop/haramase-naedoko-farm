// 使い方: npm run build 2>&1 | npm run codex:error
// 単体実行: printf 'Type error: example\n' | node scripts/codex-error-summary.mjs

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
const importantPattern = /error|failed|exception|cannot find|syntax|type\s*error|referenceerror|module not found/i;
const selectedIndexes = new Set();

for (let index = 0; index < lines.length; index += 1) {
  if (!importantPattern.test(lines[index])) continue;
  for (let contextIndex = Math.max(0, index - 2); contextIndex <= Math.min(lines.length - 1, index + 2); contextIndex += 1) {
    selectedIndexes.add(contextIndex);
  }
}

const seenLines = new Set();
const result = [];
for (const index of [...selectedIndexes].sort((a, b) => a - b)) {
  const line = lines[index];
  const normalized = line.trim();
  if (normalized && seenLines.has(normalized)) continue;
  if (normalized) seenLines.add(normalized);
  result.push(`${index + 1}: ${line}`);
  if (result.length >= 120) break;
}

if (result.length === 0) {
  console.log('重要エラーに該当する行は見つかりませんでした。');
} else {
  console.log(result.join('\n'));
  if (selectedIndexes.size > result.length) console.log('… 重複または120行超過分を省略しました');
}
