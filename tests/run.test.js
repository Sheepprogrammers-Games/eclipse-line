import assert from 'node:assert/strict';
import { formatRunTime, mergeRunRecord, runRank } from '../src/ui/run.js';

assert.equal(formatRunTime(0), '00:00');
assert.equal(formatRunTime(65.8), '01:05');
assert.equal(formatRunTime(3661), '1:01:01');
assert.equal(runRank({ falls: 0, hintUsed: false }), '无痕');
assert.equal(runRank({ falls: 1, hintUsed: false }), '稳光');
assert.equal(runRank({ falls: 3, hintUsed: false }), '接线');
assert.equal(runRank({ falls: 0, hintUsed: true }), '显影');

const first = mergeRunRecord(null, { elapsed: 42.26, falls: 0, hintUsed: false });
assert.equal(first.record.bestTime, 42.3);
assert.equal(first.record.bestFalls, 0);
assert.equal(first.record.clears, 1);
assert.equal(first.newBest, true);
assert.equal(first.newFlawless, true);

const slower = mergeRunRecord(first.record, { elapsed: 55, falls: 4, hintUsed: true });
assert.equal(slower.record.bestTime, 42.3);
assert.equal(slower.record.bestFalls, 0);
assert.equal(slower.record.clears, 2);
assert.equal(slower.record.flawless, true);
assert.equal(slower.newBest, false);

console.log(JSON.stringify({ run: 'ok' }));
