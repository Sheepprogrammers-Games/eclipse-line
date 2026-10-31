import { COACH, COPY } from '../content/copy.js';
import { boxId, faceCenter } from '../engine/aabb.js';

export function coachState(game, level, _world, extras = {}) {
  const id = level.id;
  const lines = COACH[id] || [level.hint];
  if (game.coachMiss) return { text: game.coachMiss, target: null };

  if (game.lastFall === 'void') return { text: COPY.missVoid, target: null };
  if (game.lastFall === 'overexposure') return { text: COPY.missWhite, target: null };

  if (id === 'L1') {
    if (!game.shadowCast) {
      if (game.controlMode === 'shadow') {
        return { text: lines[1], target: { boxId: 'c', face: '+y' } };
      }
      return { text: lines[0], target: { boxId: 'c', face: '+y' } };
    }
    return { text: lines[2], target: { boxId: 'd', face: '+y' } };
  }
  if (id === 'L2') {
    const crateId = level.crates?.[0]?.id;
    const crate = (game.cratePos && crateId && game.cratePos[crateId]) || level.crates?.[0];
    const moved = extras.pathOpen === true;
    if (!moved) {
      return {
        text: lines[0],
        target: crate
          ? { world: [(crate.min[0] + crate.max[0]) / 2, crate.max[1] + 0.2, (crate.min[2] + crate.max[2]) / 2] }
          : null
      };
    }
    return { text: lines[1], target: { boxId: 'east', face: '+y' } };
  }
  if (id === 'L3') {
    if (!game.lanternHeld) {
      const p = level.pickup;
      return { text: lines[0], target: p ? { world: [p.x, p.y + 0.6, p.z] } : null };
    }
    return { text: lines[1], target: { boxId: 'end', face: '+y' } };
  }
  if (id === 'L4') {
    if (!closed(_world, 'noonGate')) {
      return { text: lines[0], target: switchOf(level, 'noonGate') };
    }
    if (!extras.pathOpen) return { text: lines[1], target: lampOf(level, 'noon') };
    return { text: lines[2], target: { boxId: 'e', face: '+y' } };
  }
  if (id === 'L5') {
    if (!closed(_world, 'shade')) {
      if (game.controlMode === 'shadow') {
        return { text: COPY.shadowSwitchNear, target: { boxId: 'shade', face: '+y' } };
      }
      return { text: lines[0], target: { boxId: 'shade', face: '+y' } };
    }
    return extras.pathOpen
      ? { text: lines[2], target: { boxId: 'east', face: '+y' } }
      : { text: lines[1], target: lampOf(level, 'right') };
  }
  if (id === 'L6') {
    if (!closed(_world, 'pad')) return { text: lines[0], target: switchOf(level, 'pad') };
    return extras.pathOpen
      ? { text: lines[2], target: { boxId: 'alcove', face: '+y' } }
      : { text: lines[1], target: mirrorOf(level) };
  }
  if (id === 'L7') return { text: lines[0], target: { boxId: level.goal.boxId, face: '+y' } };
  if (id === 'L8') {
    if (!closed(_world, 'burnGate')) return { text: lines[0], target: switchOf(level, 'burnGate') };
    if (extras.pathOpen) return { text: lines[1], target: { boxId: level.goal.boxId, face: '+y' } };
    return { text: lines[0], target: lampOf(level, 'burn') };
  }
  if (id === 'L9') {
    if (!game.lanternHeld) {
      const p = level.pickup;
      return { text: lines[0], target: p ? { world: [p.x, p.y + 0.6, p.z] } : null };
    }
    if (!closed(_world, 'mark')) return { text: lines[0], target: switchOf(level, 'mark') };
    return { text: lines[1], target: { boxId: 'roof', face: '+y' } };
  }
  if (id === 'L10') {
    if (!closed(_world, 'sunPad')) return { text: lines[0], target: lampOf(level, 'two') };
    return extras.pathOpen
      ? { text: lines[1], target: { boxId: 'sun', face: '+y' } }
      : { text: lines[1], target: switchOf(level, 'sunPad') };
  }
  return { text: level.hint, target: { boxId: level.goal.boxId, face: level.goal.face || '+y' } };
}

function closed(world, id) {
  return !!world?.closed?.[id];
}

function switchOf(level, id) {
  const sw = (level.switches || []).find(item => item.id === id);
  if (!sw) return null;
  if (sw.origin) return { world: [sw.origin[0], (sw.origin[1] || 0) + 0.45, sw.origin[2]] };
  const box = (level.boxes || []).find(item => item.id === sw.boxId);
  if (!box) return null;
  return { world: [(box.min[0] + box.max[0]) / 2, box.max[1] + 0.35, (box.min[2] + box.max[2]) / 2] };
}

function lampOf(level, id) {
  const lamp = (level.lamps || []).find(item => item.id === id) || (level.lamps || [])[0];
  return lamp ? { world: [lamp.origin[0], (lamp.origin[1] || 0) + 1.6, lamp.origin[2]] } : null;
}

function mirrorOf(level) {
  const mirror = (level.mirrors || [])[0];
  return mirror ? { world: [mirror.origin[0], mirror.origin[1] + 0.4, mirror.origin[2]] } : null;
}

export function resolveCoachTarget(target, world) {
  if (!target) return null;
  if (target.world) return target.world;
  const box = world?.boxes?.find(item => boxId(item) === target.boxId);
  if (!box) return null;
  return faceCenter(box, target.face || '+y');
}
