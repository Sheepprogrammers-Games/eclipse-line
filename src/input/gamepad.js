export const GAMEPAD_BUTTONS = Object.freeze({
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  lb: 4,
  rb: 5,
  back: 8,
  start: 9,
  leftStick: 10,
  rightStick: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15
});

const ACTION_BUTTONS = ['south', 'east', 'west', 'north', 'lb', 'rb', 'back', 'start'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buttonDown(button) {
  if (typeof button === 'number') return button > 0.5;
  return !!button && (button.pressed || button.value > 0.5);
}

export function deadzoneAxis(value, deadzone = 0.18) {
  const n = clamp(Number(value) || 0, -1, 1);
  const edge = clamp(Number(deadzone) || 0, 0, 0.95);
  const magnitude = Math.abs(n);
  if (magnitude <= edge) return 0;
  return Math.sign(n) * ((magnitude - edge) / (1 - edge));
}

export function selectGamepad(gamepads = []) {
  const connected = Array.from(gamepads || []).filter(pad => pad && pad.connected !== false);
  return connected.find(pad => pad.mapping === 'standard') || connected[0] || null;
}

export function readGamepad(pad, options = {}) {
  if (!pad) return null;
  const deadzone = options.deadzone ?? 0.18;
  const navThreshold = options.navThreshold ?? 0.58;
  const axes = pad.axes || [];
  const buttons = pad.buttons || [];
  const held = Object.fromEntries(ACTION_BUTTONS.map(name => (
    [name, buttonDown(buttons[GAMEPAD_BUTTONS[name]])]
  )));
  const moveX = deadzoneAxis(axes[0], deadzone);
  const moveY = deadzoneAxis(axes[1], deadzone);
  const dpadX = Number(buttonDown(buttons[GAMEPAD_BUTTONS.dpadRight]))
    - Number(buttonDown(buttons[GAMEPAD_BUTTONS.dpadLeft]));
  const dpadY = Number(buttonDown(buttons[GAMEPAD_BUTTONS.dpadDown]))
    - Number(buttonDown(buttons[GAMEPAD_BUTTONS.dpadUp]));
  const navX = dpadX || (Math.abs(moveX) >= navThreshold ? Math.sign(moveX) : 0);
  const navY = dpadY || (Math.abs(moveY) >= navThreshold ? Math.sign(moveY) : 0);

  return {
    connected: true,
    id: pad.id || 'Gamepad',
    index: Number.isFinite(pad.index) ? pad.index : 0,
    timestamp: Number(pad.timestamp) || 0,
    move: { x: moveX, z: -moveY },
    look: {
      x: deadzoneAxis(axes[2], deadzone),
      y: deadzoneAxis(axes[3], deadzone)
    },
    nav: { x: navX, y: navY },
    held
  };
}

function navKey(nav) {
  if (!nav?.x && !nav?.y) return '';
  if (Math.abs(nav.x) > Math.abs(nav.y)) return nav.x > 0 ? 'right' : 'left';
  return nav.y > 0 ? 'down' : 'up';
}

function navVector(key) {
  if (key === 'left') return { x: -1, y: 0 };
  if (key === 'right') return { x: 1, y: 0 };
  if (key === 'up') return { x: 0, y: -1 };
  if (key === 'down') return { x: 0, y: 1 };
  return { x: 0, y: 0 };
}

export function createGamepadTracker(options = {}) {
  const repeatDelay = options.repeatDelay ?? 320;
  const repeatInterval = options.repeatInterval ?? 110;
  let previousButtons = {};
  let previousNav = '';
  let nextRepeat = 0;
  let activeIndex = null;

  function reset() {
    previousButtons = {};
    previousNav = '';
    nextRepeat = 0;
    activeIndex = null;
  }

  function poll(pad, now = 0) {
    if (!pad) {
      reset();
      return null;
    }
    if (activeIndex !== pad.index) {
      reset();
      activeIndex = pad.index;
    }
    const snapshot = readGamepad(pad, options);
    const pressed = {};
    for (const name of ACTION_BUTTONS) {
      pressed[name] = !!snapshot.held[name] && !previousButtons[name];
    }

    const key = navKey(snapshot.nav);
    let navStep = { x: 0, y: 0 };
    if (key && key !== previousNav) {
      navStep = navVector(key);
      nextRepeat = now + repeatDelay;
    } else if (key && now >= nextRepeat) {
      navStep = navVector(key);
      nextRepeat = now + repeatInterval;
    } else if (!key) {
      nextRepeat = 0;
    }

    previousButtons = { ...snapshot.held };
    previousNav = key;
    return { ...snapshot, pressed, navStep };
  }

  return { poll, reset };
}
