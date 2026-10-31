import assert from 'node:assert/strict';
import {
  GAMEPAD_BUTTONS,
  createGamepadTracker,
  deadzoneAxis,
  readGamepad,
  selectGamepad
} from '../src/input/gamepad.js';

function pad({ axes = [0, 0, 0, 0], down = [], index = 0, mapping = 'standard' } = {}) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const button of down) buttons[button] = { pressed: true, value: 1 };
  return { axes, buttons, connected: true, id: `pad-${index}`, index, mapping, timestamp: 1 };
}

assert.equal(deadzoneAxis(0.12), 0);
assert.ok(deadzoneAxis(0.7) > 0.6);
assert.equal(deadzoneAxis(-1), -1);

const state = readGamepad(pad({
  axes: [0.6, -0.8, 0.5, -0.4],
  down: [GAMEPAD_BUTTONS.south, GAMEPAD_BUTTONS.dpadRight]
}));
assert.ok(state.move.x > 0);
assert.ok(state.move.z > 0);
assert.ok(state.look.x > 0);
assert.ok(state.look.y < 0);
assert.equal(state.nav.x, 1);
assert.equal(state.held.south, true);

const fallback = pad({ index: 1, mapping: '' });
const standard = pad({ index: 2 });
assert.equal(selectGamepad([fallback, null, standard]), standard);
assert.equal(selectGamepad([fallback]), fallback);

const tracker = createGamepadTracker({ repeatDelay: 300, repeatInterval: 100 });
const held = pad({ axes: [0, -1, 0, 0], down: [GAMEPAD_BUTTONS.south] });
let tick = tracker.poll(held, 0);
assert.equal(tick.pressed.south, true);
assert.deepEqual(tick.navStep, { x: 0, y: -1 });
tick = tracker.poll(held, 100);
assert.equal(tick.pressed.south, false);
assert.deepEqual(tick.navStep, { x: 0, y: 0 });
tick = tracker.poll(held, 300);
assert.deepEqual(tick.navStep, { x: 0, y: -1 });
tracker.poll(pad(), 310);
tick = tracker.poll(held, 320);
assert.equal(tick.pressed.south, true);
assert.deepEqual(tick.navStep, { x: 0, y: -1 });
tracker.poll(null, 400);
tick = tracker.poll(held, 410);
assert.equal(tick.pressed.south, true);

console.log(JSON.stringify({ gamepad: 'ok' }));
