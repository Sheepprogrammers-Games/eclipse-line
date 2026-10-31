import assert from 'node:assert/strict';
import { deserializeSave, serializeSave, writeSave, loadSave, SAVE_KEY, RESUME_VERSION } from '../src/save.js';

const store = new Map();
const storage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value))
};

const first = loadSave(storage);
assert.equal(first.highest, 0);
assert.deepEqual(first.hidden, [false, false, false]);

assert.equal(first.seenTutorial, false);
assert.equal(first.started, false);
assert.equal(first.showTimer, true);
assert.equal(first.vibration, true);
assert.equal(first.muted, false);
assert.equal(first.resume, null);
assert.equal(first.records.length, 10);

const saved = writeSave({ highest: 4, hidden: [true, false, true], reduceFlash: true, music: 0.2, muted: true, seenTutorial: true, started: true }, storage);
assert.equal(saved.highest, 4);
assert.equal(saved.seenTutorial, true);
assert.equal(saved.started, true);
assert.equal(storage.getItem(SAVE_KEY).includes('reduceFlash'), true);

const round = deserializeSave(serializeSave(saved));
assert.equal(round.reduceFlash, true);
assert.equal(round.hidden[2], true);
assert.equal(round.music, 0.2);
assert.equal(round.muted, true);

const resume = {
  version: RESUME_VERSION,
  index: 3,
  snapshot: {
    label: '纸闸已固定',
    time: 12.5,
    pose: { x: 1, y: 0.4, z: 2, boxId: 'path', face: '+y', yaw: 0 },
    yaw: { noon: 1.2 },
    enabled: { noon: true },
    lampPos: {},
    cratePos: {},
    lanternHeld: false,
    lanternOn: false,
    shadowCast: {
      boxId: 'c',
      face: '+y',
      lightId: 'cross',
      mode: 'bridge',
      origin: [3, 0.7, 1.2],
      shape: {
        start: [3, 0.7, 1.2],
        tip: [5, 0.7, 1.2],
        direction: [1, 0, 0],
        length: 2,
        width: 0.7,
        path: [[3, 0.7, 1.2], [4, 1.2, 1.2], [5, 0.7, 1.2]]
      }
    },
    shadowPose: {
      x: 3.4,
      y: 0.8,
      z: 1.1,
      boxId: 'path',
      face: '+y',
      yaw: 0.4,
      length: 3.75,
      path: [[1, 0.4, 2], [3.4, 0.8, 1.1]],
      detached: true,
      lightId: 'cross'
    },
    shadowDetached: true,
    shadowAnchor: { x: 1, y: 0.4, z: 2, boxId: 'path', face: '+y', yaw: 0 },
    controlMode: 'shadow',
    levers: { noonGate: true },
    viewIndex: 1,
    slowmo: 1,
    slowmoUntil: 0
  },
  stats: { elapsed: 18.75, falls: 2, hintUsed: true }
};
const progressed = writeSave({
  resume,
  showTimer: false,
  vibration: false,
  records: [{ bestTime: 44.2, bestFalls: 1, clears: 3, flawless: true }]
}, storage);
assert.equal(progressed.resume.index, 3);
assert.equal(progressed.resume.snapshot.pose.boxId, 'path');
assert.equal(progressed.resume.snapshot.shadowCast.lightId, 'cross');
assert.deepEqual(progressed.resume.snapshot.shadowCast.origin, [3, 0.7, 1.2]);
assert.equal(progressed.resume.snapshot.shadowCast.shape.length, 2);
assert.deepEqual(progressed.resume.snapshot.shadowCast.shape.path, [[3, 0.7, 1.2], [4, 1.2, 1.2], [5, 0.7, 1.2]]);
assert.equal(progressed.resume.snapshot.shadowPose.boxId, 'path');
assert.equal(progressed.resume.snapshot.shadowPose.detached, true);
assert.equal(progressed.resume.snapshot.shadowPose.length, 3.75);
assert.deepEqual(progressed.resume.snapshot.shadowPose.path, [[1, 0.4, 2], [3.4, 0.8, 1.1]]);
assert.equal(progressed.resume.snapshot.controlMode, 'shadow');
assert.equal(progressed.resume.snapshot.shadowAnchor.boxId, 'path');
assert.equal(progressed.resume.stats.falls, 2);
assert.equal(progressed.records[0].bestTime, 44.2);
assert.equal(progressed.records[0].flawless, true);
assert.equal(progressed.records.length, 10);
assert.equal(progressed.showTimer, false);
assert.equal(progressed.vibration, false);

const freeResume = writeSave({
  resume: {
    ...resume,
    snapshot: {
      ...resume.snapshot,
      shadowCast: {
        ...resume.snapshot.shadowCast,
        boxId: '__free-shadow__',
        lightId: 'glow'
      }
    }
  }
}, storage);
assert.equal(freeResume.resume.snapshot.shadowCast.boxId, '__free-shadow__');
assert.equal(freeResume.resume.snapshot.shadowCast.shape.start[0], 3);

const legacyResume = deserializeSave(JSON.stringify({ resume: { ...resume, version: 1 } }));
assert.equal(legacyResume.resume, null);
const v2Resume = deserializeSave(JSON.stringify({ resume: { ...resume, version: 2 } }));
assert.equal(v2Resume.resume, null);
const v3Resume = deserializeSave(JSON.stringify({ resume: { ...resume, version: 3 } }));
assert.equal(v3Resume.resume, null);
const v4Resume = deserializeSave(JSON.stringify({ resume: { ...resume, version: 4 } }));
assert.equal(v4Resume.resume, null, 'old geometry checkpoints must not restore into redesigned levels');
const v5Resume = deserializeSave(JSON.stringify({ resume: { ...resume, version: 5 } }));
assert.equal(v5Resume.resume, null, 'checkpoints created before solid-wall shadow collision must be discarded');

const malformed = deserializeSave(JSON.stringify({
  resume: { index: 99, snapshot: {} },
  records: [{ bestTime: -4, clears: -1 }]
}));
assert.equal(malformed.resume, null);
assert.equal(malformed.records[0], null);

const missingPose = deserializeSave(JSON.stringify({
  resume: { index: 1, snapshot: { pose: { boxId: 'west' } } }
}));
assert.equal(missingPose.resume, null);

const brokenCrate = deserializeSave(JSON.stringify({
  resume: {
    index: 1,
    snapshot: {
      pose: { x: 1, y: 0.4, z: 1, boxId: 'west' },
      cratePos: { box: { min: null, max: [1, 2, 3] } }
    }
  }
}));
assert.equal(brokenCrate.resume, null);

const brokenShadow = deserializeSave(JSON.stringify({
  resume: {
    index: 0,
    snapshot: {
      pose: { x: 1, y: 0.4, z: 1, boxId: 'a' },
      shadowCast: { boxId: 'c', lightId: 'cross', origin: ['bad', 0, 0] }
    }
  }
}));
assert.equal(brokenShadow.resume, null);

console.log(JSON.stringify({ save: 'ok' }));
