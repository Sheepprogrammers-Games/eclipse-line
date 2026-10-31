const KIND_BIAS = Object.freeze({
  lever: 0,
  pickup: 0.02,
  crate: 0.06,
  mirror: 0.22,
  lamp: 0.55
});

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function originOf(candidate) {
  const origin = candidate?.origin;
  if (!Array.isArray(origin) || origin.length < 3) return null;
  const point = origin.slice(0, 3).map(value => Number(value));
  return point.every(Number.isFinite) ? point : null;
}

export function selectContextAction(candidates = [], pose = {}, facing = null, options = {}) {
  const maxDistance = Math.max(0, finite(options.maxDistance, 3.15));
  const maxHeight = Math.max(0, finite(options.maxHeight, 2.6));
  const px = finite(pose.x);
  const py = finite(pose.y);
  const pz = finite(pose.z);
  const fx = finite(facing?.x);
  const fz = finite(facing?.z);
  const facingLength = Math.hypot(fx, fz);
  let best = null;

  candidates.forEach((candidate, order) => {
    if (!candidate || candidate.disabled) return;
    const origin = originOf(candidate);
    if (!origin) return;
    const dx = origin[0] - px;
    const dz = origin[2] - pz;
    const dy = Math.abs(origin[1] - py);
    const distance = Math.hypot(dx, dz);
    const radius = Math.max(0, finite(candidate.radius, maxDistance));
    if (distance > radius || dy > maxHeight) return;

    let behindPenalty = 0;
    if (facingLength > 0.01 && distance > 0.01) {
      const alignment = (dx * fx + dz * fz) / (distance * facingLength);
      if (alignment < -0.25) behindPenalty = (Math.abs(alignment) + 0.25) * 1.2;
    }
    const bias = KIND_BIAS[candidate.kind] ?? 0.35;
    const score = distance + behindPenalty + bias;
    if (!best || score < best.score || (score === best.score && order < best.order)) {
      best = { ...candidate, distance, score, order };
    }
  });

  if (!best) return null;
  const { score: _score, order: _order, ...result } = best;
  return result;
}
