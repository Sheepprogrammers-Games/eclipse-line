export function dragCrate(crate, axis, delta, limit) {
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const next = crate.min[i] + delta;
  const lo = limit[0];
  const hi = limit[1];
  const clamped = Math.max(lo, Math.min(hi, next));
  const shift = clamped - crate.min[i];
  crate.min[i] += shift;
  crate.max[i] += shift;
  return crate;
}
