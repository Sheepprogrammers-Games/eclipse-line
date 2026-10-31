// 打印某关在给定状态下每块纸面的光照数，用于关卡调试。
// 用法：node scripts/light-map.mjs L4 '{"levers":{"noonGate":true},"yaw":{"noon":0.75}}'
import { LEVELS } from '../src/content/levels.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { countsForWorld, lightsOnFace } from '../src/engine/lights.js';

const id = process.argv[2];
const extras = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const time = Number(process.argv[4] || 0);
const level = LEVELS.find(l => l.id === id);
if (!level) {
  console.error(`没有这一关：${id}`);
  process.exit(1);
}

const world = resolveWorld(level, time, { ...extras, shadows: level.shadows || [] });
const counts = countsForWorld(world);
console.log(`${level.id} ${level.name}  t=${time}s  ${JSON.stringify(extras)}`);
for (const box of world.boxes) {
  const key = `${box.id}:+y`;
  const n = counts.get(key) ?? 0;
  const who = lightsOnFace(world, { boxId: box.id, face: '+y' }).map(l => l.id).join(',');
  const state = n === 1 ? '可走' : n === 0 ? '影渊' : '过曝';
  console.log(`  ${String(box.id).padEnd(8)} ${n} ${state.padEnd(4)} ${who}`);
}
