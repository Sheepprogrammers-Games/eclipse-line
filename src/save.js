export const SAVE_KEY = 'eclipse-line-save';
export const RESUME_VERSION = 9;

// 关卡总数由战役数据决定，存档结构不再写死。
export let LEVEL_COUNT = 10;

export function setLevelCount(count) {
  const n = Math.floor(Number(count));
  if (Number.isFinite(n) && n > 0) LEVEL_COUNT = n;
  return LEVEL_COUNT;
}

export const SAVE_DEFAULT = {
  highest: 0,
  current: 0,
  hidden: [false, false, false],
  music: 0.72,
  sfx: 0.8,
  muted: false,
  quality: 'high',
  reduceFlash: false,
  showTimer: true,
  vibration: true,
  hintUsed: false,
  seenTutorial: false,
  started: false,
  records: Array.from({ length: LEVEL_COUNT }, () => null),
  resume: null
};

function finiteOrNull(value, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(max, n);
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bestTime = finiteOrNull(raw.bestTime, 24 * 60 * 60);
  const bestFalls = finiteOrNull(raw.bestFalls, 999);
  const clears = finiteOrNull(raw.clears, 9999);
  if (bestTime == null && bestFalls == null && !clears && !raw.flawless) return null;
  return {
    bestTime,
    bestFalls: bestFalls == null ? null : Math.floor(bestFalls),
    clears: Math.floor(clears || 0),
    flawless: !!raw.flawless
  };
}

function clonePlain(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function objectMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeFlagMap(value) {
  if (value == null) return {};
  const source = objectMap(value);
  if (!source) return null;
  return Object.fromEntries(Object.entries(source).map(([key, flag]) => [key, !!flag]));
}

function normalizeNumberMap(value) {
  if (value == null) return {};
  const source = objectMap(value);
  if (!source) return null;
  const result = {};
  for (const [key, raw] of Object.entries(source)) {
    const number = Number(raw);
    if (!Number.isFinite(number)) return null;
    result[key] = number;
  }
  return result;
}

function finiteVector(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const vector = value.slice(0, 3).map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function normalizeVectorMap(value) {
  if (value == null) return {};
  const source = objectMap(value);
  if (!source) return null;
  const result = {};
  for (const [key, raw] of Object.entries(source)) {
    const vector = finiteVector(raw);
    if (!vector) return null;
    result[key] = vector;
  }
  return result;
}

function normalizeShadowCast(value) {
  const source = objectMap(value);
  const origin = finiteVector(source?.origin);
  if (!source || !origin || typeof source.boxId !== 'string' || !source.boxId) return null;
  if (typeof source.lightId !== 'string' || !source.lightId) return null;
  let shape = null;
  if (source.shape != null) {
    const rawShape = objectMap(source.shape);
    const start = finiteVector(rawShape?.start);
    const tip = finiteVector(rawShape?.tip);
    const direction = finiteVector(rawShape?.direction);
    const path = Array.isArray(rawShape?.path)
      ? rawShape.path.map(finiteVector)
      : null;
    const length = Number(rawShape?.length);
    const width = Number(rawShape?.width);
    if (!rawShape || !start || !tip || !direction
      || (path && (path.length < 2 || path.some(point => !point)))
      || !Number.isFinite(length) || length < 0.05 || !Number.isFinite(width) || width <= 0) {
      return null;
    }
    shape = { start, tip, direction, length, width, path };
  }
  return {
    boxId: source.boxId,
    face: /^[+-][xyz]$/.test(source.face) ? source.face : '+y',
    lightId: source.lightId,
    mode: source.mode === 'switch' ? 'switch' : 'bridge',
    origin,
    shape
  };
}

function normalizeShadowPose(value) {
  const source = objectMap(value);
  const x = Number(source?.x);
  const y = Number(source?.y);
  const z = Number(source?.z);
  if (!source || ![x, y, z].every(Number.isFinite) || typeof source.boxId !== 'string' || !source.boxId) return null;
  const result = {
    x,
    y,
    z,
    boxId: source.boxId,
    face: /^[+-][xyz]$/.test(source.face) ? source.face : '+y',
    yaw: Number.isFinite(Number(source.yaw)) ? Number(source.yaw) : 0,
    detached: !!source.detached,
    lightId: typeof source.lightId === 'string' ? source.lightId : null
  };
  if (Number.isFinite(Number(source.length))) result.length = Math.max(0, Number(source.length));
  if (Array.isArray(source.path)) {
    const path = source.path.map(finiteVector);
    if (path.some(point => !point)) return null;
    result.path = path;
  }
  return result;
}

function normalizeShadowAnchor(value) {
  const source = objectMap(value);
  if (!source) return null;
  const x = Number(source.x);
  const y = Number(source.y);
  const z = Number(source.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return {
    x,
    y,
    z,
    boxId: typeof source.boxId === 'string' && source.boxId ? source.boxId : null,
    face: /^[+-][xyz]$/.test(source.face) ? source.face : '+y',
    yaw: Number.isFinite(Number(source.yaw)) ? Number(source.yaw) : 0
  };
}

function normalizeCrateMap(value) {
  if (value == null) return {};
  const source = objectMap(value);
  if (!source) return null;
  const result = {};
  for (const [key, raw] of Object.entries(source)) {
    const crate = objectMap(raw);
    const min = finiteVector(crate?.min);
    const max = finiteVector(crate?.max);
    if (!crate || !min || !max) return null;
    const clone = clonePlain(crate);
    result[key] = { ...clone, min, max };
  }
  return result;
}

function normalizeResume(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawVersion = Number(raw.version);
  // Level geometry is part of a checkpoint. Never restore a pose authored
  // against an older campaign layout; long-term unlocks and records still load.
  if (rawVersion !== RESUME_VERSION) return null;
  const index = Math.floor(Number(raw.index));
  const snapshot = clonePlain(raw.snapshot);
  if (!Number.isFinite(index) || index < 0 || index >= LEVEL_COUNT) return null;
  const pose = objectMap(snapshot?.pose);
  const x = Number(pose?.x);
  const y = Number(pose?.y);
  const z = Number(pose?.z);
  if (!pose || typeof pose.boxId !== 'string' || !pose.boxId) return null;
  if (![x, y, z].every(Number.isFinite)) return null;
  const yaw = normalizeNumberMap(snapshot.yaw);
  const enabled = normalizeFlagMap(snapshot.enabled);
  const lampPos = normalizeVectorMap(snapshot.lampPos);
  const cratePos = normalizeCrateMap(snapshot.cratePos);
  const levers = normalizeFlagMap(snapshot.levers);
  const shadowCast = snapshot.shadowCast == null ? null : normalizeShadowCast(snapshot.shadowCast);
  const shadowPose = snapshot.shadowPose == null ? null : normalizeShadowPose(snapshot.shadowPose);
  const shadowAnchor = snapshot.shadowAnchor == null ? null : normalizeShadowAnchor(snapshot.shadowAnchor);
  if (!yaw || !enabled || !lampPos || !cratePos || !levers) return null;
  if (snapshot.shadowCast != null && !shadowCast) return null;
  if (snapshot.shadowPose != null && !shadowPose) return null;
  if (snapshot.shadowAnchor != null && !shadowAnchor) return null;
  const normalizedSnapshot = {
    ...snapshot,
    label: typeof snapshot.label === 'string' ? snapshot.label : '蚀线已固化',
    time: finiteOrNull(snapshot.time, 24 * 60 * 60) || 0,
    pose: {
      ...pose,
      x,
      y,
      z,
      face: /^[+-][xyz]$/.test(pose.face) ? pose.face : '+y',
      yaw: Number.isFinite(Number(pose.yaw)) ? Number(pose.yaw) : 0
    },
    yaw,
    enabled,
    lampPos,
    cratePos,
    lanternHeld: !!snapshot.lanternHeld,
    lanternOn: !!snapshot.lanternOn,
    shadowCast,
    shadowPose,
    shadowDetached: !!snapshot.shadowDetached,
    shadowAnchor,
    controlMode: snapshot.controlMode === 'shadow' ? 'shadow' : 'body',
    levers,
    viewIndex: Math.max(0, Math.min(8, Math.floor(Number(snapshot.viewIndex) || 0))),
    slowmo: Math.max(0.1, Math.min(1, Number(snapshot.slowmo) || 1)),
    slowmoUntil: finiteOrNull(snapshot.slowmoUntil, 24 * 60 * 60) || 0
  };
  return {
    version: RESUME_VERSION,
    index,
    snapshot: normalizedSnapshot,
    stats: {
      elapsed: finiteOrNull(raw.stats?.elapsed, 24 * 60 * 60) || 0,
      falls: Math.floor(finiteOrNull(raw.stats?.falls, 999) || 0),
      hintUsed: !!raw.stats?.hintUsed
    }
  };
}

export function normalizeSave(raw = {}) {
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.slice(0, 3) : [];
  while (hidden.length < 3) hidden.push(false);
  const records = Array.isArray(raw.records) ? raw.records.slice(0, LEVEL_COUNT) : [];
  while (records.length < LEVEL_COUNT) records.push(null);
  return {
    highest: Math.max(0, Math.min(LEVEL_COUNT, Number(raw.highest) || 0)),
    current: Math.max(0, Math.min(LEVEL_COUNT - 1, Number(raw.current) || 0)),
    hidden: hidden.map(Boolean),
    music: clamp01(raw.music ?? SAVE_DEFAULT.music),
    sfx: clamp01(raw.sfx ?? SAVE_DEFAULT.sfx),
    muted: !!raw.muted,
    quality: raw.quality === 'low' ? 'low' : 'high',
    reduceFlash: !!raw.reduceFlash,
    showTimer: raw.showTimer !== false,
    vibration: raw.vibration !== false,
    hintUsed: !!raw.hintUsed,
    seenTutorial: !!raw.seenTutorial,
    started: !!raw.started,
    records: records.map(normalizeRecord),
    resume: normalizeResume(raw.resume)
  };
}

function clamp01(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0.7;
  return Math.max(0, Math.min(1, n));
}

export function serializeSave(data) {
  return JSON.stringify(normalizeSave(data));
}

export function deserializeSave(text) {
  if (!text) return normalizeSave();
  try {
    return normalizeSave(JSON.parse(text));
  } catch {
    return normalizeSave();
  }
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    return deserializeSave(storage?.getItem(SAVE_KEY));
  } catch {
    return normalizeSave();
  }
}

export function writeSave(partial, storage = globalThis.localStorage) {
  const next = normalizeSave({ ...loadSave(storage), ...partial });
  storage?.setItem(SAVE_KEY, serializeSave(next));
  return next;
}
