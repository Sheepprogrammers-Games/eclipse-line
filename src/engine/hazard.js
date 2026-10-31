function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function hazardAtPoint(hazards, x, z, padding = 0) {
  const px = finite(x);
  const pz = finite(z);
  const inset = Math.max(0, finite(padding));
  for (const hazard of hazards || []) {
    const minX = finite(hazard.x) + inset;
    const minZ = finite(hazard.z) + inset;
    const maxX = finite(hazard.x) + Math.max(0, finite(hazard.w)) - inset;
    const maxZ = finite(hazard.z) + Math.max(0, finite(hazard.d)) - inset;
    if (px < minX || px > maxX || pz < minZ || pz > maxZ) continue;
    return { ...hazard, kind: hazard.type === 'spikes' ? 'spikes' : 'void' };
  }
  return null;
}
