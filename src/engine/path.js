import { boxId, faceCenter, length, sub } from './aabb.js';
import { faceKey } from './walkable.js';

function axisIndex(face) {
  return face[1] === 'x' ? 0 : face[1] === 'y' ? 1 : 2;
}

export function faceEdges(box, face) {
  const axis = axisIndex(face);
  const plane = face[0] === '+' ? box.max[axis] : box.min[axis];
  const [u, v] = [0, 1, 2].filter(index => index !== axis);
  const u0 = box.min[u];
  const u1 = box.max[u];
  const v0 = box.min[v];
  const v1 = box.max[v];
  return [
    { fixed: [[axis, plane], [u, u0]], free: v, lo: v0, hi: v1 },
    { fixed: [[axis, plane], [u, u1]], free: v, lo: v0, hi: v1 },
    { fixed: [[axis, plane], [v, v0]], free: u, lo: u0, hi: u1 },
    { fixed: [[axis, plane], [v, v1]], free: u, lo: u0, hi: u1 }
  ];
}

function fixedClose(a, b, eps) {
  if (a.length !== b.length) return false;
  const used = new Set();
  for (const [axis, value] of a) {
    const match = b.findIndex((pair, index) => !used.has(index) && pair[0] === axis && Math.abs(pair[1] - value) <= eps);
    if (match < 0) return false;
    used.add(match);
  }
  return true;
}

export function facesShareEdge(boxA, faceA, boxB, faceB, eps = 0.05) {
  const ea = faceEdges(boxA, faceA);
  const eb = faceEdges(boxB, faceB);
  for (const a of ea) {
    for (const b of eb) {
      if (a.free !== b.free) continue;
      if (!fixedClose(a.fixed, b.fixed, eps)) continue;
      const lo = Math.max(a.lo, b.lo);
      const hi = Math.min(a.hi, b.hi);
      if (hi - lo >= Math.max(0.08, eps)) return true;
    }
  }
  return false;
}

function findBox(world, id) {
  return world.boxes.find(box => boxId(box) === id) || null;
}

function dihedralOk(faceA, faceB, walls) {
  const floors = (faceA === '+y') + (faceB === '+y');
  if (floors === 2) return true;
  if (floors === 1) return walls;
  return walls;
}

function topRect(box, face) {
  if (face !== '+y') return null;
  return {
    y: box.max[1],
    x0: box.min[0],
    x1: box.max[0],
    z0: box.min[2],
    z1: box.max[2]
  };
}

export function facesStepAdjacent(boxA, faceA, boxB, faceB) {
  const a = topRect(boxA, faceA);
  const b = topRect(boxB, faceB);
  if (!a || !b) return false;
  if (Math.abs(a.y - b.y) > 0.65) return false;
  const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
  const gapX = overlapX >= 0 ? 0 : Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1);
  const gapZ = overlapZ >= 0 ? 0 : Math.max(a.z0, b.z0) - Math.min(a.z1, b.z1);
  return (gapX <= 0.12 && overlapZ >= 0.18) || (gapZ <= 0.12 && overlapX >= 0.18);
}

function wallRect(box, face) {
  if (face === '+y' || face === '-y') return null;
  const axis = face[1] === 'x' ? 0 : 2;
  const plane = face[0] === '+' ? box.max[axis] : box.min[axis];
  return {
    axis,
    plane,
    y0: box.min[1],
    y1: box.max[1],
    u0: axis === 0 ? box.min[2] : box.min[0],
    u1: axis === 0 ? box.max[2] : box.max[0]
  };
}

export function floorWallAdjacent(floorBox, floorFace, wallBox, wallFace) {
  if (floorFace !== '+y') return false;
  const wall = wallRect(wallBox, wallFace);
  if (!wall) return false;
  const floorY = floorBox.max[1];
  if (floorY < wall.y0 - 0.08 || floorY > wall.y1 + 0.08) return false;
  const floorU0 = wall.axis === 0 ? floorBox.min[2] : floorBox.min[0];
  const floorU1 = wall.axis === 0 ? floorBox.max[2] : floorBox.max[0];
  const overlap = Math.min(floorU1, wall.u1) - Math.max(floorU0, wall.u0);
  if (overlap < 0.18) return false;
  const floorPlane = wall.axis === 0
    ? (Math.abs(floorBox.max[0] - wall.plane) <= 0.12 ? floorBox.max[0]
      : Math.abs(floorBox.min[0] - wall.plane) <= 0.12 ? floorBox.min[0]
        : null)
    : (Math.abs(floorBox.max[2] - wall.plane) <= 0.12 ? floorBox.max[2]
      : Math.abs(floorBox.min[2] - wall.plane) <= 0.12 ? floorBox.min[2]
        : null);
  return floorPlane != null;
}

function adjacent(boxA, faceA, boxB, faceB, walls) {
  if (facesShareEdge(boxA, faceA, boxB, faceB)) return true;
  if (facesStepAdjacent(boxA, faceA, boxB, faceB)) return true;
  if (!walls) return false;
  return floorWallAdjacent(boxA, faceA, boxB, faceB) || floorWallAdjacent(boxB, faceB, boxA, faceA);
}

export function buildGraph(world, faces, { walls = false } = {}) {
  const allowWalls = walls || !!world.walls;
  const nodes = new Map();
  for (const face of faces) {
    const box = findBox(world, face.boxId);
    if (!box) continue;
    nodes.set(faceKey(face), {
      ref: face,
      center: faceCenter(box, face.face),
      neighbors: []
    });
  }
  const list = [...nodes.values()];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const na = list[i];
      const nb = list[j];
      if (!dihedralOk(na.ref.face, nb.ref.face, allowWalls)) continue;
      const boxA = findBox(world, na.ref.boxId);
      const boxB = findBox(world, nb.ref.boxId);
      if (!adjacent(boxA, na.ref.face, boxB, nb.ref.face, allowWalls)) continue;
      na.neighbors.push(nb.ref);
      nb.neighbors.push(na.ref);
    }
  }
  return { nodes, walls: allowWalls };
}

export function findPath(graph, from, to) {
  const start = faceKey(from);
  const goal = faceKey(to);
  if (!graph.nodes.has(start) || !graph.nodes.has(goal)) return null;
  if (start === goal) return [from];

  const open = [{ key: start, g: 0, f: 0 }];
  const came = new Map();
  const gScore = new Map([[start, 0]]);
  const goalCenter = graph.nodes.get(goal).center;

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (current.key === goal) {
      const path = [];
      let key = goal;
      while (key) {
        path.push(graph.nodes.get(key).ref);
        key = came.get(key);
      }
      path.reverse();
      return path;
    }
    const node = graph.nodes.get(current.key);
    for (const next of node.neighbors) {
      const nkey = faceKey(next);
      const neighbor = graph.nodes.get(nkey);
      const tentative = gScore.get(current.key) + length(sub(neighbor.center, node.center));
      if (tentative + 1e-9 >= (gScore.get(nkey) ?? Infinity)) continue;
      came.set(nkey, current.key);
      gScore.set(nkey, tentative);
      const h = length(sub(goalCenter, neighbor.center));
      open.push({ key: nkey, g: tentative, f: tentative + h });
    }
  }
  return null;
}
