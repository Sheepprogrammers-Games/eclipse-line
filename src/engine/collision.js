function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Treat the player's footprint as a circle, and raised paper blocks as solid
 * prisms. Standing on a block's top remains valid.
 */
export function bodyOverlapsRaisedSolid(boxes, point, options = {}) {
  if (!point) return false;
  const x = finite(point.x);
  const y = finite(point.y);
  const z = finite(point.z);
  const radius = Math.max(0.01, finite(options.radius, 0.31));
  const height = Math.max(0.1, finite(options.height, 1.45));
  const epsilon = Math.max(0, finite(options.epsilon, 0.035));
  const stepUp = Math.max(0, finite(options.stepUp, 0));
  const steppable = typeof options.steppable === 'function' ? options.steppable : null;
  const radiusSq = radius * radius;

  return (boxes || []).some(box => {
    if (!Array.isArray(box?.min) || !Array.isArray(box?.max) || box.collision === false) return false;
    const bottom = finite(box.min?.[1]);
    const top = finite(box.max?.[1]);
    // 顶面只高出脚底一个跨步以内的盒子是台阶，不是墙。
    const reach = stepUp > 0 && (!steppable || steppable(box)) ? Math.max(epsilon, stepUp) : epsilon;
    if (y >= top - reach || y + height <= bottom + epsilon) return false;

    const nearestX = clamp(x, finite(box.min?.[0]), finite(box.max?.[0]));
    const nearestZ = clamp(z, finite(box.min?.[2]), finite(box.max?.[2]));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    return dx * dx + dz * dz < radiusSq - 1e-8;
  });
}

/**
 * 脚下应当站立的高度：取覆盖该点、且顶面在一个跨步之内的最高台面。
 * 台面重叠时选最高的一层，走到边界即踩上台阶，而不是斜穿过去。
 */
export function groundHeightAt(boxes, x, z, y, options = {}) {
  const px = finite(x);
  const pz = finite(z);
  const py = finite(y);
  const stepUp = Math.max(0, finite(options.stepUp, 0.65));
  const standable = typeof options.standable === 'function' ? options.standable : null;
  let best = null;
  for (const box of boxes || []) {
    if (!Array.isArray(box?.min) || !Array.isArray(box?.max)) continue;
    if (standable && !standable(box)) continue;
    if (px < finite(box.min[0]) || px > finite(box.max[0])) continue;
    if (pz < finite(box.min[2]) || pz > finite(box.max[2])) continue;
    const top = finite(box.max[1]);
    if (top - py > stepUp) continue;
    if (best == null || top > best) best = top;
  }
  return best;
}

export function bodyPathClearsRaisedSolids(boxes, points, options = {}) {
  if (!Array.isArray(points) || points.length === 0) return false;
  const spacing = Math.max(0.02, finite(options.spacing, 0.05));
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const length = Math.hypot(
      finite(b?.[0]) - finite(a?.[0]),
      finite(b?.[1]) - finite(a?.[1]),
      finite(b?.[2]) - finite(a?.[2])
    );
    const steps = Math.max(1, Math.ceil(length / spacing));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const point = {
        x: finite(a?.[0]) + (finite(b?.[0]) - finite(a?.[0])) * t,
        y: finite(a?.[1]) + (finite(b?.[1]) - finite(a?.[1])) * t,
        z: finite(a?.[2]) + (finite(b?.[2]) - finite(a?.[2])) * t
      };
      if (bodyOverlapsRaisedSolid(boxes, point, options)) return false;
    }
  }
  return true;
}
