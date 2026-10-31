// 关卡验收：出生点是否恒安全、起始是否不可直达终点、给定解法下是否可达。
// 用法：node scripts/check-level.mjs [关卡ID...]
import { LEVELS } from '../src/content/levels.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { walkableFaces } from '../src/engine/walkable.js';
import { buildGraph, findPath } from '../src/engine/path.js';
import { lightCount } from '../src/engine/lights.js';
import { faceCenter } from '../src/engine/aabb.js';

function worldOf(level, extras = {}, time = 0) {
  const first = resolveWorld(level, time, { ...extras, shadows: level.shadows || [] });
  const remain = (level.shadows || []).filter(
    shadow => lightCount(first, { boxId: shadow.id, face: '+y' }) === 0
  );
  return resolveWorld(level, time, { ...extras, shadows: remain });
}

export function routeExists(level, extras = {}, time = 0) {
  const world = worldOf(level, extras, time);
  const faces = walkableFaces(world, { walls: level.walls });
  const graph = buildGraph(world, faces, { walls: level.walls });
  return findPath(
    graph,
    { boxId: level.spawn.boxId, face: level.spawn.face || '+y' },
    { boxId: level.goal.boxId, face: level.goal.face || '+y' }
  );
}

/**
 * 时序验收：模拟玩家沿指定纸面依次前进。只有下一块此刻恰好单光才迈步，
 * 且脚下这块在整个过程中都必须保持单光，否则算掉下去。
 */
export function simulateTimedRoute(level, route, options = {}) {
  const speed = options.speed ?? 3.15;
  const dt = options.dt ?? 0.05;
  const limit = options.limit ?? 60;
  const boxes = Object.fromEntries((level.boxes || []).map(box => [box.id, box]));
  const litNow = (id, time) => lightCount(worldOf(level, options.extras || {}, time), {
    boxId: id,
    face: '+y'
  }) === 1;

  let index = 0;
  let time = 0;
  let travel = null;
  while (time < limit) {
    const here = route[index];
    if (!litNow(here, time) && !travel) {
      return { ok: false, reason: `${here} 在 ${time.toFixed(2)}s 时不是单光，玩家会坠落`, time };
    }
    if (travel) {
      travel.left -= speed * dt;
      if (travel.left <= 0) {
        index += 1;
        travel = null;
        if (route[index] === level.goal.boxId) return { ok: true, time };
      }
    } else if (index + 1 < route.length) {
      const next = route[index + 1];
      const a = faceCenter(boxes[here], '+y');
      const b = faceCenter(boxes[next], '+y');
      const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      // 谨慎的玩家会先看清：脚下和对面在整个跨越过程中都得稳住，
      // 落地后还要留出余量，否则宁可等下一次机会。
      const cross = span / speed;
      const dwell = options.dwell ?? 0.9;
      let safe = true;
      for (let ahead = 0; ahead <= cross + dwell; ahead += dt) {
        if (!litNow(next, time + ahead)) { safe = false; break; }
        if (ahead <= cross && !litNow(here, time + ahead)) { safe = false; break; }
      }
      if (safe) travel = { left: span };
    } else {
      return { ok: here === level.goal.boxId, time };
    }
    time += dt;
  }
  return { ok: false, reason: `${limit}s 内没能走完，卡在 ${route[index]}`, time };
}

export function auditLevel(level) {
  const problems = [];
  for (const time of [0, 0.5, 1, 2]) {
    const count = lightCount(worldOf(level, {}, time), {
      boxId: level.spawn.boxId,
      face: level.spawn.face || '+y'
    });
    if (count !== 1) problems.push(`出生点在 ${time}s 时光照为 ${count}，必须恒为 1`);
  }
  const open = routeExists(level);
  if (open) problems.push('起始状态即可直达终点，这是走廊不是谜题');
  const solution = level.solution;
  if (!solution) problems.push('缺少 solution 字段，无法验证可通关');
  else {
    const solved = solution.some(entry => {
      if (Array.isArray(entry?.route)) {
        const run = simulateTimedRoute(level, entry.route, entry);
        if (!run.ok) problems.push(`时序解法失败：${run.reason}`);
        return run.ok;
      }
      return !!routeExists(level, entry);
    });
    if (!solved && !problems.some(p => p.startsWith('时序解法失败'))) {
      problems.push('按 solution 给出的状态仍无法抵达终点');
    }
  }
  const world = worldOf(level);
  return {
    id: level.id,
    name: level.name,
    chapter: level.chapter,
    boxes: (level.boxes || []).length,
    lights: (level.lights || []).length,
    walkableAtStart: walkableFaces(world, { walls: level.walls }).length,
    problems
  };
}

// 仅在直接运行时输出报告，被测试导入时保持安静。
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const wanted = process.argv.slice(2);
  const targets = wanted.length ? LEVELS.filter(l => wanted.includes(l.id)) : LEVELS;
  let bad = 0;
  for (const level of targets) {
    const report = auditLevel(level);
    const mark = report.problems.length ? '✗' : '✓';
    if (report.problems.length) bad += 1;
    console.log(`${mark} ${report.id.padEnd(5)} ${report.name.padEnd(8)} 第${report.chapter}章 `
      + `盒${String(report.boxes).padStart(2)} 灯${report.lights} 起始可走面${report.walkableAtStart}`);
    for (const problem of report.problems) console.log(`      ${problem}`);
  }
  console.log(`\n共 ${targets.length} 关，${bad} 关有问题`);
}
