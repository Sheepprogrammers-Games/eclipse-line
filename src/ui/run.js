function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function formatRunTime(value) {
  const total = Math.floor(finite(value));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function runRank({ falls = 0, hintUsed = false } = {}) {
  const count = Math.floor(finite(falls));
  if (count === 0 && !hintUsed) return '无痕';
  if (count <= 1 && !hintUsed) return '稳光';
  if (!hintUsed) return '接线';
  return '显影';
}

export function mergeRunRecord(previous, run = {}) {
  const elapsed = Math.round(Math.max(0.1, finite(run.elapsed, 0.1)) * 10) / 10;
  const falls = Math.floor(finite(run.falls));
  const hintUsed = !!run.hintUsed;
  const flawless = falls === 0 && !hintUsed;
  const oldTime = previous?.bestTime == null ? null : finite(previous.bestTime, null);
  const oldFalls = previous?.bestFalls == null ? null : Math.floor(finite(previous.bestFalls));
  const newBest = oldTime == null || elapsed < oldTime;
  const newFlawless = flawless && !previous?.flawless;
  const record = {
    bestTime: newBest ? elapsed : oldTime,
    bestFalls: oldFalls == null ? falls : Math.min(oldFalls, falls),
    clears: Math.floor(finite(previous?.clears)) + 1,
    flawless: !!previous?.flawless || flawless
  };
  return {
    elapsed,
    falls,
    hintUsed,
    flawless,
    rank: runRank({ falls, hintUsed }),
    newBest,
    newFlawless,
    record
  };
}
