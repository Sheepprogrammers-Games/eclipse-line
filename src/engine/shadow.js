import { boxId } from './aabb.js';
import { isWalkRole } from './walkable.js';

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function distance2d(a, b) {
  return Math.hypot((a[0] || 0) - (b[0] || 0), (a[2] || 0) - (b[2] || 0));
}

function pointOnTop(box, x, z, pad = 0.06) {
  return x >= box.min[0] - pad
    && x <= box.max[0] + pad
    && z >= box.min[2] - pad
    && z <= box.max[2] + pad;
}

/**
 * Project a body through a lamp and keep the whole shadow path as data.
 * `projectShadowPoint` remains the compact endpoint API used by older saves;
 * this companion gives the controller a stable ray direction and a readable
 * stretch value for interpolation and UI feedback.
 */
export function shadowRay(position, light, options = {}) {
  if (!position || !light?.origin) return null;
  const height = Math.max(0.18, finite(options.height, 1.02));
  const source = [finite(position.x), finite(position.y) + height, finite(position.z)];
  const origin = light.origin.slice(0, 3).map(value => finite(value));
  const ray = source.map((value, index) => value - origin[index]);
  const length = Math.hypot(...ray) || 1;
  if (Math.abs(ray[1]) < 1e-5) return null;
  return {
    origin,
    source,
    direction: ray.map(value => value / length),
    distance: length,
    lightId: light.id || null
  };
}

/**
 * Resolve the physical projection of the body's top point onto a horizontal
 * surface. Keeping the source, endpoint and length together prevents the
 * renderer and puzzle rules from inventing a second, unrelated shadow size.
 */
export function shadowProjection(position, light, floorY = position?.y || 0, options = {}) {
  const path = shadowRay(position, light, options);
  if (!path) return null;
  const { source, origin, lightId } = path;
  const ray = source.map((value, index) => value - origin[index]);
  if (Math.abs(ray[1]) < 1e-5) return null;
  const t = (finite(floorY) - origin[1]) / ray[1];
  if (!(t > 0)) return null;
  const endpoint = [
    origin[0] + ray[0] * t,
    finite(floorY) + finite(options.offset, 0.035),
    origin[2] + ray[2] * t
  ];
  const distance = Math.hypot(endpoint[0] - source[0], endpoint[2] - source[2]);
  const maxDistance = finite(options.maxDistance, 0);
  if (maxDistance > 0 && distance > maxDistance) return null;
  return {
    source: source.slice(),
    endpoint,
    direction: [endpoint[0] - source[0], 0, endpoint[2] - source[2]],
    length: distance,
    stretch: Math.max(0.25, t),
    lightId
  };
}

function pushPathPoint(path, point) {
  const next = point.map(value => finite(value));
  const previous = path[path.length - 1];
  if (previous && Math.hypot(
    next[0] - previous[0],
    next[1] - previous[1],
    next[2] - previous[2]
  ) < 0.015) return;
  path.push(next);
}

/**
 * Fold a ground projection up onto higher walkable tops. The short sloped
 * transition is both visually readable as a crease and traversable as an
 * authored shadow ramp instead of an instantaneous vertical teleport.
 */
export function foldShadowPath(start, tip, boxes = [], options = {}) {
  if (!start || !tip) return [];
  const root = [finite(start[0]), finite(start[1]), finite(start[2])];
  const end = [finite(tip[0]), finite(tip[1]), finite(tip[2])];
  const dx = end[0] - root[0];
  const dz = end[2] - root[2];
  const horizontal = Math.hypot(dx, dz);
  if (horizontal < 0.05) return [root, end];
  const baseY = root[1];
  const surfaceAt = t => {
    const x = root[0] + dx * t;
    const z = root[2] + dz * t;
    let height = baseY;
    for (const box of boxes || []) {
      if (!isWalkRole(box)) continue;
      if (x < box.min[0] - 0.015 || x > box.max[0] + 0.015) continue;
      if (z < box.min[2] - 0.015 || z > box.max[2] + 0.015) continue;
      const top = finite(box.max[1], baseY);
      if (top > height + 0.06) height = top;
    }
    return height;
  };
  const pointAt = (t, y) => [root[0] + dx * t, y, root[2] + dz * t];
  const samples = Math.max(32, Math.min(128, Math.ceil(horizontal * 18)));
  const rampRun = Math.max(0.42, finite(options.rampRun, 0.82));
  const rampT = Math.min(0.24, rampRun / horizontal);
  const landingClearance = Math.max(0.18, finite(options.landingClearance, 0.32));
  const clearanceT = Math.min(0.12, landingClearance / horizontal);
  const path = [root];
  let height = baseY;
  let lastTransition = 0;

  for (let index = 1; index <= samples; index += 1) {
    const t = index / samples;
    const nextHeight = surfaceAt(t);
    if (Math.abs(nextHeight - height) <= 0.06) continue;
    if (nextHeight > height) {
      // Reach the new height before the body crosses the wall plane. Without
      // this short upper landing, the shadow is mathematically walkable but
      // the player's lower half enters the platform volume and gets clipped.
      const riseEnd = Math.max(lastTransition, t - clearanceT);
      const riseStart = Math.max(lastTransition, riseEnd - rampT);
      pushPathPoint(path, pointAt(riseStart, height));
      pushPathPoint(path, pointAt(riseEnd, nextHeight));
      pushPathPoint(path, pointAt(t, nextHeight));
      lastTransition = t;
    } else {
      pushPathPoint(path, pointAt(t, height));
      const fallStart = Math.min(1, t + clearanceT);
      const fallEnd = Math.min(1, fallStart + rampT);
      pushPathPoint(path, pointAt(fallStart, height));
      pushPathPoint(path, pointAt(fallEnd, nextHeight));
      lastTransition = fallEnd;
    }
    height = nextHeight;
  }

  pushPathPoint(path, [end[0], surfaceAt(1), end[2]]);
  return path;
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(
      points[index][0] - points[index - 1][0],
      points[index][1] - points[index - 1][1],
      points[index][2] - points[index - 1][2]
    );
  }
  return total;
}

/** Capture a cast shadow as immutable plain data for bridges and switches. */
export function freezeShadowShape(start, tip, options = {}) {
  if (!start || !tip) return null;
  const root = [finite(start.x ?? start[0]), finite(start.y ?? start[1]), finite(start.z ?? start[2])];
  const end = [finite(tip.x ?? tip[0]), finite(tip.y ?? tip[1]), finite(tip.z ?? tip[2])];
  const dx = end[0] - root[0];
  const dz = end[2] - root[2];
  const horizontalLength = Math.hypot(dx, dz);
  if (horizontalLength < 0.05) return null;
  const rawPath = Array.isArray(options.path) && options.path.length >= 2
    ? options.path.map(point => point.slice(0, 3).map(value => finite(value)))
    : [root.slice(), end.slice()];
  rawPath[0] = root.slice();
  rawPath[rawPath.length - 1] = end.slice();
  const length = pathLength(rawPath);
  const width = Math.max(0.32, Math.min(1.2, finite(options.width, 0.54 + length * 0.045)));
  return Object.freeze({
    start: Object.freeze(root),
    tip: Object.freeze(end),
    direction: Object.freeze([dx / horizontalLength, 0, dz / horizontalLength]),
    length,
    width,
    path: Object.freeze(rawPath.map(point => Object.freeze(point)))
  });
}

/** Return the matching point inside the frozen tapered shadow footprint. */
export function shadowShapeAt(shape, x, z, padding = 0, referenceY = null) {
  if (!shape || !Array.isArray(shape.start) || !Array.isArray(shape.tip)) return null;
  const points = Array.isArray(shape.path) && shape.path.length >= 2
    ? shape.path
    : [shape.start, shape.tip];
  const fallbackLength = pathLength(points);
  const length = finite(shape.length, fallbackLength);
  if (length < 0.05) return null;
  const margin = Math.max(0, finite(padding));
  const width = Math.max(0.32, finite(shape.width, 0.54));
  let traversed = 0;
  let best = null;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const sx = finite(b[0]) - finite(a[0]);
    const sz = finite(b[2]) - finite(a[2]);
    const horizontal = Math.hypot(sx, sz);
    const segmentLength = Math.hypot(sx, finite(b[1]) - finite(a[1]), sz);
    if (horizontal < 0.01) {
      traversed += segmentLength;
      continue;
    }
    const ux = sx / horizontal;
    const uz = sz / horizontal;
    const px = finite(x) - finite(a[0]);
    const pz = finite(z) - finite(a[2]);
    const along = px * ux + pz * uz;
    // Padding widens the walkable silhouette, but internal crease endpoints
    // must stay exact. Extending every segment lengthwise lets the previous
    // low segment overlap the ramp and hold the player inside the wall.
    const before = index === 1 ? margin : 0;
    const after = index === points.length - 1 ? margin : 0;
    if (along < -before || along > horizontal + after) {
      traversed += segmentLength;
      continue;
    }
    const localT = Math.max(0, Math.min(1, along / horizontal));
    const lateral = Math.abs(px * -uz + pz * ux);
    const surfaceT = Math.max(0, Math.min(1, (traversed + segmentLength * localT) / length));
    const halfWidth = width * (0.31 + surfaceT * 0.14) + margin;
    if (lateral > halfWidth) {
      traversed += segmentLength;
      continue;
    }
    const y = finite(a[1]) + (finite(b[1]) - finite(a[1])) * localT;
    const yPenalty = Number.isFinite(Number(referenceY)) ? Math.abs(y - Number(referenceY)) * 0.85 : 0;
    const score = lateral + yPenalty;
    if (!best || score < best.score) {
      best = { x: finite(x), y, z: finite(z), t: surfaceT, halfWidth, score };
    }
    traversed += segmentLength;
  }
  if (!best) return null;
  const { score: _score, ...result } = best;
  return result;
}

/** Reject a shadow foothold whose center lies inside a raised paper solid. */
export function shadowHitBlockedBySolid(boxes, hit, clearance = 0.14) {
  if (!hit) return false;
  const wallClearance = Math.max(0, finite(clearance, 0.14));
  return (boxes || []).some(box => {
    if (!isWalkRole(box)) return false;
    const top = finite(box.max?.[1]);
    const bottom = finite(box.min?.[1]);
    if (finite(hit.y) >= top - 0.04 || finite(hit.y) < bottom - 0.05) return false;
    return finite(hit.x) >= finite(box.min?.[0]) - wallClearance
      && finite(hit.x) <= finite(box.max?.[0]) + wallClearance
      && finite(hit.z) >= finite(box.min?.[2]) - wallClearance
      && finite(hit.z) <= finite(box.max?.[2]) + wallClearance;
  });
}

/**
 * Projects the top of a body through a point light onto a horizontal paper
 * surface. The result is intentionally plain data so the same calculation can
 * drive rendering, input and tests without coupling to Three.js.
 */
export function projectShadowPoint(position, light, floorY = position?.y || 0, options = {}) {
  const projected = shadowProjection(position, light, floorY, options);
  if (!projected) return null;
  const { source, endpoint, lightId } = projected;
  return {
    x: endpoint[0],
    y: endpoint[1],
    z: endpoint[2],
    source,
    lightId,
    stretch: projected.stretch,
    distance: projected.length
  };
}

/**
 * Return ordered intersections of the light ray with walkable top faces.
 * Keeping this separate from the renderer makes shadow travel deterministic
 * and prevents the avatar from jumping to an unrelated nearby platform.
 */
export function shadowSurfacePath(world, position, light, options = {}) {
  const ray = shadowRay(position, light, options);
  if (!ray || !world) return [];
  const floorY = finite(options.floorY, position?.y || 0);
  const maxDistance = finite(options.maxDistance, 14);
  const maxGap = finite(options.maxGap, 2.8);
  const hits = [];
  for (const box of world.boxes || []) {
    if (!isWalkRole(box)) continue;
    const dy = box.max[1] - ray.origin[1];
    if (Math.abs(ray.direction[1]) < 1e-5) continue;
    const t = dy / ray.direction[1];
    if (!(t > ray.distance + 0.01) || t > maxDistance) continue;
    const x = ray.origin[0] + ray.direction[0] * t;
    const z = ray.origin[2] + ray.direction[2] * t;
    if (!pointOnTop(box, x, z)) continue;
    const heightDelta = Math.abs(box.max[1] - floorY);
    if (heightDelta > finite(options.maxStep, 2.4)) continue;
    hits.push({
      x,
      y: box.max[1] + finite(options.offset, 0.035),
      z,
      boxId: boxId(box),
      face: '+y',
      t,
      lightId: ray.lightId
    });
  }
  hits.sort((a, b) => a.t - b.t || a.boxId.localeCompare(b.boxId));
  if (hits.length < 2 || maxGap <= 0) return hits;
  const connected = [hits[0]];
  for (let i = 1; i < hits.length; i += 1) {
    const previous = connected[connected.length - 1];
    const gap = Math.hypot(hits[i].x - previous.x, hits[i].z - previous.z);
    if (gap <= maxGap && Math.abs(hits[i].y - previous.y) <= finite(options.maxStep, 2.4)) {
      connected.push(hits[i]);
    }
  }
  return connected;
}

export function shadowSurfaceAt(world, position, light, options = {}) {
  const path = shadowSurfacePath(world, position, light, options);
  if (!path.length) return null;
  const preferred = options.boxId ? path.find(item => item.boxId === options.boxId) : null;
  return preferred || path[0];
}

/** Find the nearest walkable top under a projected point. */
export function nearestShadowSurface(world, point, referenceY = 0, options = {}) {
  if (!world || !point) return null;
  const maxDistance = finite(options.maxDistance, 8);
  const maxStep = finite(options.maxStep, 1.6);
  let best = null;
  for (const box of world.boxes || []) {
    if (!isWalkRole(box)) continue;
    const inside = point.x >= box.min[0] - 0.06
      && point.x <= box.max[0] + 0.06
      && point.z >= box.min[2] - 0.06
      && point.z <= box.max[2] + 0.06;
    const x = Math.min(box.max[0], Math.max(box.min[0], point.x));
    const z = Math.min(box.max[2], Math.max(box.min[2], point.z));
    const distance = Math.hypot(x - point.x, z - point.z);
    const dy = Math.abs(box.max[1] - referenceY);
    if ((!inside && distance > maxDistance) || dy > maxStep) continue;
    const score = distance + dy * 0.24;
    if (!best || score < best.score) {
      best = {
        x,
        y: box.max[1] + 0.035,
        z,
        boxId: boxId(box),
        face: '+y',
        distance,
        score
      };
    }
  }
  return best;
}

export function cloneShadowPose(pose) {
  if (!pose || typeof pose !== 'object') return null;
  const result = {
    x: finite(pose.x),
    y: finite(pose.y),
    z: finite(pose.z),
    boxId: typeof pose.boxId === 'string' ? pose.boxId : null,
    face: /^[+-][xyz]$/.test(pose.face) ? pose.face : '+y',
    yaw: finite(pose.yaw),
    detached: !!pose.detached,
    lightId: typeof pose.lightId === 'string' ? pose.lightId : null
  };
  if (Number.isFinite(Number(pose.length))) result.length = Math.max(0, Number(pose.length));
  if (Array.isArray(pose.path)) {
    result.path = pose.path
      .filter(point => Array.isArray(point) && point.length >= 3)
      .map(point => point.slice(0, 3).map(value => finite(value)));
  }
  return result;
}

/** Exchange the body and detached shadow coordinates without renderer state. */
export function swapShadowPositions(body, shadow) {
  const bodyPose = cloneShadowPose(body);
  const shadowPose = cloneShadowPose(shadow);
  if (!bodyPose || !shadowPose || !bodyPose.boxId || !shadowPose.boxId) return null;
  const result = {
    body: { ...shadowPose, detached: false },
    shadow: {
      ...bodyPose,
      detached: true,
      lightId: shadowPose.lightId || bodyPose.lightId || null
    },
    anchor: {
      x: bodyPose.x,
      y: bodyPose.y,
      z: bodyPose.z,
      boxId: bodyPose.boxId,
      face: bodyPose.face,
      yaw: bodyPose.yaw
    }
  };
  if (Number.isFinite(Number(bodyPose.length)) || Number.isFinite(Number(shadowPose.length))) {
    result.shadow.length = Math.hypot(bodyPose.x - shadowPose.x, bodyPose.z - shadowPose.z);
    result.body.length = Number.isFinite(Number(shadowPose.length))
      ? Math.max(0, Number(shadowPose.length))
      : result.shadow.length;
  }
  return result;
}

export function shadowPoseNearSwitch(pose, sw, world = null, radius = 0.72) {
  if (!pose || !sw) return false;
  let origin = sw.origin;
  if (!origin && world) {
    const box = (world.boxes || []).find(item => boxId(item) === sw.boxId);
    if (box) origin = [
      (box.min[0] + box.max[0]) / 2,
      box.max[1],
      (box.min[2] + box.max[2]) / 2
    ];
  }
  if (!Array.isArray(origin)) return false;
  const limit = finite(sw.shadowRadius, finite(radius, 0.72));
  const horizontal = distance2d([pose.x, pose.y, pose.z], origin);
  return horizontal <= limit && Math.abs(finite(pose.y) - finite(origin[1])) <= 1.35;
}

export function shadowTipNearTarget(pose, target, radius = 0.9) {
  if (!pose || !target) return false;
  const origin = target.origin;
  if (!Array.isArray(origin)) return false;
  const limit = Math.max(0.12, finite(target.captureRadius, finite(radius, 0.9)));
  return Math.hypot(finite(pose.x) - finite(origin[0]), finite(pose.z) - finite(origin[2])) <= limit
    && Math.abs(finite(pose.y) - finite(origin[1])) <= Math.max(1.35, limit);
}

export function shadowPoseSignature(pose) {
  if (!pose) return 'none';
  return [pose.boxId || '', Math.round(finite(pose.x) * 20), Math.round(finite(pose.z) * 20)].join(':');
}

export function shadowControlState(state = {}) {
  const mode = state.mode === 'shadow' ? 'shadow' : 'body';
  const detached = !!state.detached;
  return {
    mode,
    detached,
    canSwap: detached && !!state.pose,
    label: mode === 'shadow' ? 'shadow' : 'body'
  };
}

export function clampShadowToTether(point, anchor, maxDistance = 8) {
  if (!point || !anchor) return point ? { ...point, clamped: false } : null;
  const limit = Math.max(0.25, finite(maxDistance, 8));
  const dx = finite(point.x) - finite(anchor.x);
  const dz = finite(point.z) - finite(anchor.z);
  const distance = Math.hypot(dx, dz);
  if (distance <= limit || distance < 1e-6) return { ...point, clamped: false, distance };
  const scale = limit / distance;
  return {
    ...point,
    x: finite(anchor.x) + dx * scale,
    z: finite(anchor.z) + dz * scale,
    clamped: true,
    distance: limit
  };
}
