import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';
import { auditLevel } from '../scripts/check-level.mjs';

// 带 solution 的关卡必须自证：出生点恒安全、起始不可直达终点、按解法可抵达。
const audited = LEVELS.filter(level => level.solution);
assert.ok(audited.length >= 5, '应有若干关卡登记了可验证的解法');

const failures = [];
for (const level of audited) {
  const report = auditLevel(level);
  if (report.problems.length) failures.push(`${level.id} ${level.name}: ${report.problems.join('；')}`);
}
assert.deepEqual(failures, [], `关卡验收未通过：\n${failures.join('\n')}`);

// 章节必须连续成段，避免章间穿插导致选关界面错乱。
const chapters = LEVELS.map(level => level.chapter);
for (let i = 1; i < chapters.length; i += 1) {
  assert.ok(chapters[i] >= chapters[i - 1], `第 ${i + 1} 关的章号比前一关小，章节顺序被打乱`);
}

// 每关都要有名字、提示与演出配置。
for (const level of LEVELS) {
  assert.ok(level.name, `${level.id} 缺少关卡名`);
  assert.ok(level.hint, `${level.id} 缺少提示文案`);
  assert.ok(level.reveal, `${level.id} 缺少揭示时刻`);
  assert.ok(level.spawn?.boxId && level.goal?.boxId, `${level.id} 缺少出生点或终点`);
}

console.log(JSON.stringify({ newlevels: 'ok', total: LEVELS.length, audited: audited.length }));
