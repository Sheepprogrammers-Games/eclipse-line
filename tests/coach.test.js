import assert from 'node:assert/strict';
import { coachState } from '../src/ui/coach.js';
import { COPY } from '../src/content/copy.js';
import { LEVELS } from '../src/content/levels.js';

const byId = id => LEVELS.find(level => level.id === id);

const l1 = byId('L1');
const start = coachState({ face: { boxId: 'a', face: '+y' } }, l1, { boxes: l1.boxes, closed: {} });
assert.equal(start.target?.boxId, 'c');
assert.match(start.text, /灯靠近|灯远离|影长/);

const mid = coachState({ face: { boxId: 'b', face: '+y' }, controlMode: 'shadow' }, l1, { boxes: l1.boxes, closed: { gate: true } });
assert.equal(mid.target.boxId, 'c');
assert.match(mid.text, /折上去|钉住|折痕/);

const pinned = coachState({
  face: { boxId: 'b', face: '+y' },
  controlMode: 'body',
  shadowCast: { boxId: 'c', face: '+y', lightId: 'glow', shape: { length: 5.1 } }
}, l1, { boxes: l1.boxes, closed: { gate: true, shade: true } });
assert.equal(pinned.target.boxId, 'd');

const miss = coachState({ coachMiss: COPY.missEmpty, face: { boxId: 'a', face: '+y' } }, l1, {});
assert.equal(miss.text, COPY.missEmpty);
assert.equal(miss.target, null);

const l2 = byId('L2');
const crateIdle = coachState({ cratePos: { box: { min: [3.3, 0.4, 0.5], max: [5, 2.6, 2.1] } } }, l2, {});
assert.match(crateIdle.text, /纸箱/);

const l5 = byId('L5');
const eyeStart = coachState({ face: { boxId: 'west', face: '+y' } }, l5, { boxes: l5.boxes, closed: {} });
assert.match(eyeStart.text, /影端|钉住|菱标/);
assert.doesNotMatch(eyeStart.text, /交换/);

const l4 = byId('L4');
const noonOn = coachState({ enabled: { noon: true } }, l4, { closed: { noonGate: true } }, { pathOpen: true });
assert.match(noonOn.text, /进入终点|走过去|缝接上/);
const noonAim = coachState({ enabled: { noon: true } }, l4, { closed: { noonGate: true } }, { pathOpen: false });
assert.match(noonAim.text, /灯杆|光柱|灯/);
const noonOff = coachState({ enabled: { noon: false } }, l4, { closed: { noonGate: false } });
assert.match(noonOff.text, /闸|灯/);

const l6 = byId('L6');
const foldStart = coachState({}, l6, { closed: { pad: false } }, { pathOpen: false });
assert.match(foldStart.text, /亮着.*踏印|黑色长廊/);
assert.ok(foldStart.target?.world);

console.log(JSON.stringify({ coach: 'ok' }));
