import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';
import { resolveWorld } from '../src/engine/resolve.js';
import { walkableFaces } from '../src/engine/walkable.js';
import { buildGraph, findPath } from '../src/engine/path.js';
import { groundHeightAt } from '../src/engine/collision.js';
import { faceCenter, boxId } from '../src/engine/aabb.js';

const RADIUS = 0.31;
const HEIGHT = 1.45;
const STEP_UP = 0.65;

// 复刻 followPath 的落点解算：水平线性推进，高度按台阶跳变。
function walkSegment(world, path, k) {
  const boxes = new Map(world.boxes.map(box => [box.id || boxId(box), box]));
  const stepBoxes = new Set();
  for (const ref of path) {
    const box = boxes.get(ref.boxId);
    if (box) stepBoxes.add(box);
  }
  const pts = path.map(ref => faceCenter(boxes.get(ref.boxId), ref.face));
  const total = pts.slice(1).reduce((sum, point, index) => sum
    + Math.hypot(point[0] - pts[index][0], point[1] - pts[index][1], point[2] - pts[index][2]), 0);
  let dist = k * total;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.001;
    if (dist > seg) {
      dist -= seg;
      continue;
    }
    const t = dist / seg;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const ramp = a[1] + (b[1] - a[1]) * t;
    const ground = groundHeightAt(world.boxes, x, z, Math.min(a[1], b[1]), {
      stepUp: Math.abs(b[1] - a[1]) + 0.05,
      standable: box => stepBoxes.has(box)
    });
    return { x, y: ground == null ? ramp : ground, z };
  }
  return { x: pts.at(-1)[0], y: pts.at(-1)[1], z: pts.at(-1)[2] };
}

// 点击寻路必须和自由移动一样贴着台面走：整条轨迹上身体都不得插进实体。
const offenders = [];
for (const level of LEVELS) {
  const world = resolveWorld(level, 0, {});
  const faces = walkableFaces(world, { walls: !!level.walls });
  const graph = buildGraph(world, faces, { walls: !!level.walls });
  for (const node of graph.nodes.values()) {
    for (const neighbor of node.neighbors) {
      const path = findPath(graph, node.ref, neighbor);
      if (!path || path.length < 2) continue;
      const boxes = new Map(world.boxes.map(box => [box.id || boxId(box), box]));
      const stepBoxes = new Set();
      for (const ref of path) {
        const box = boxes.get(ref.boxId);
        if (box) stepBoxes.add(box);
      }
      let worst = 0;
      for (let step = 0; step <= 220; step += 1) {
        const at = walkSegment(world, path, step / 220);
        // 脚必须落在路线经过的某个台面顶上，不能陷进台阶体内。
        const ground = groundHeightAt(world.boxes, at.x, at.z, at.y - STEP_UP, {
          stepUp: 2 * STEP_UP,
          standable: box => stepBoxes.has(box)
        });
        if (ground == null) continue;
        worst = Math.max(worst, ground - at.y);
      }
      if (worst > 0.02) {
        offenders.push(`${level.id} ${node.ref.boxId}->${neighbor.boxId} 陷入 ${worst.toFixed(2)}m`);
      }
    }
  }
}
assert.deepEqual(offenders, [], `点击寻路穿模：\n${offenders.join('\n')}`);

console.log(JSON.stringify({ pathwalk: 'ok', levels: LEVELS.length }));
