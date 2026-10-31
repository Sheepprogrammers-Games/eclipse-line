import { lightCount } from './lights.js';

function copyPose(pose) {
  return {
    x: pose.x,
    y: pose.y,
    z: pose.z,
    boxId: pose.boxId,
    face: pose.face || '+y',
    yaw: pose.yaw || 0
  };
}

export function createRunState(spawn, now = 0) {
  const pose = copyPose(spawn);
  return {
    spawn: copyPose(spawn),
    pose: copyPose(spawn),
    stamps: [copyPose(spawn)],
    lockedUntil: now,
    lastFall: null,
    lastFlash: null
  };
}

export function stamp(state, pose) {
  const next = copyPose(pose);
  state.stamps.push(next);
  state.pose = copyPose(next);
  return next;
}

export function fall(state, kind, now = 0) {
  const last = state.stamps[state.stamps.length - 1] || state.spawn;
  const pose = copyPose(last);
  state.pose = pose;
  state.lastFall = kind;
  state.lastFlash = kind === 'overexposure' ? 'white' : 'black';
  state.lockedUntil = now + 1000;
  return { pose, flash: state.lastFlash, lockedUntil: state.lockedUntil };
}

export function inputLocked(state, now) {
  return now < state.lockedUntil;
}

export function checkpointIsSafe(world, snapshot) {
  const pose = snapshot?.pose || snapshot;
  if (!world || !pose || typeof pose.boxId !== 'string') return false;
  return lightCount(world, { boxId: pose.boxId, face: pose.face || '+y' }) === 1;
}
