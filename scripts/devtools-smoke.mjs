import http from 'node:http';
import { writeFile } from 'node:fs/promises';

const base = process.env.CDP_URL || 'http://127.0.0.1:9224';
const targetUrl = process.env.GAME_URL || 'http://127.0.0.1:8766/';
const width = Number(process.env.VIEWPORT_WIDTH) || 1280;
const height = Number(process.env.VIEWPORT_HEIGHT) || 800;
const mobile = process.env.MOBILE === '1';
const screenshotPath = process.env.SCREENSHOT || '/tmp/eclipse-line-play.png';
const bodyScreenshotPath = process.env.BODY_SCREENSHOT || screenshotPath.replace(/\.png$/i, '-body.png');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}${path}`, options, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 400) reject(new Error(`${response.statusCode} ${body}`));
        else {
          try {
            resolve(body ? JSON.parse(body) : null);
          } catch {
            resolve(body);
          }
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const target = await request('/json/new?about:blank', { method: 'PUT' });
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const waiting = new Map();
const events = [];
socket.addEventListener('message', message => {
  const data = JSON.parse(message.data);
  if (data.id && waiting.has(data.id)) {
    const { resolve, reject } = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.error) reject(new Error(data.error.message));
    else resolve(data.result);
  } else if (data.method) events.push(data);
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
  return result.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Network.clearBrowserCache');
await send('Storage.clearDataForOrigin', {
  origin: new URL(targetUrl).origin,
  storageTypes: 'local_storage'
});
await send('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: mobile ? 2 : 1,
  mobile,
  screenWidth: width,
  screenHeight: height
});
await send('Page.navigate', { url: targetUrl });
await new Promise(resolve => setTimeout(resolve, 2200));

const runtimeErrors = events
  .filter(event => event.method === 'Runtime.exceptionThrown' || event.method === 'Log.entryAdded')
  .map(event => ({
    method: event.method,
    text: event.params?.entry?.text
      || event.params?.exceptionDetails?.exception?.description
      || event.params?.exceptionDetails?.text,
    url: event.params?.entry?.url || event.params?.exceptionDetails?.url,
    line: event.params?.entry?.lineNumber || event.params?.exceptionDetails?.lineNumber
  }));

const title = await evaluate(`({
  ready: document.body.dataset.ready,
  bootHidden: document.querySelector('#boot-screen').classList.contains('hidden'),
  bootClass: document.querySelector('#boot-screen').className,
  titleOpen: document.querySelector('#title').classList.contains('open'),
  canvas: [document.querySelector('#view').width, document.querySelector('#view').height]
})`);

await evaluate(`document.querySelector('#btn-start').click()`);
await new Promise(resolve => setTimeout(resolve, 120));
for (let i = 0; i < 3; i += 1) {
  await evaluate(`document.querySelector('#guide-next').click()`);
  await new Promise(resolve => setTimeout(resolve, 80));
}
await new Promise(resolve => setTimeout(resolve, 1800));
if (mobile) {
  await evaluate(`document.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }))`);
  await new Promise(resolve => setTimeout(resolve, 80));
}

const afterLever = await evaluate(`({
  objective: document.querySelector('#objective-text').textContent,
  nearby: document.querySelector('#nearby-prompt-text').textContent
})`);
const beforeSwap = await evaluate(`({
  controlMode: document.querySelector('#control-state').dataset.mode,
  control: document.querySelector('#control-state-text').textContent,
  swapVisible: !document.querySelector('#shadow-switch').classList.contains('hidden')
})`);
const bodyScreenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile(bodyScreenshotPath, Buffer.from(bodyScreenshot.data, 'base64'));
if (mobile) await evaluate(`document.querySelector('#shadow-switch').click()`);
else await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x', bubbles: true }))`);
await new Promise(resolve => setTimeout(resolve, 700));

// Complete the authored L1 hand-off in the browser, using the live camera to
// find the target instead of a brittle hard-coded screenshot coordinate.
const shadowTargetPoint = await evaluate(`(() => {
  const debug = window.__eclipseDebug;
  const box = debug.level().boxes.find(item => item.id === 'c');
  const center = new debug.THREE.Vector3(
    (box.min[0] + box.max[0]) / 2,
    box.max[1] + 0.04,
    (box.min[2] + box.max[2]) / 2
  ).project(debug.app.camera);
  return { x: (center.x + 1) * innerWidth / 2, y: (1 - center.y) * innerHeight / 2 };
})()`);
if (mobile) {
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: shadowTargetPoint.x, y: shadowTargetPoint.y }]
  });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
} else {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: shadowTargetPoint.x, y: shadowTargetPoint.y, button: 'left', clickCount: 1
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: shadowTargetPoint.x, y: shadowTargetPoint.y, button: 'left', clickCount: 1
  });
}
await new Promise(resolve => setTimeout(resolve, 9000));
const shadowTargetState = await evaluate(`(() => {
  const debug = window.__eclipseDebug;
  return {
    shadowBox: debug.game.shadowPose?.boxId,
    shadeClosed: !!debug.game.levers?.shade,
    objective: document.querySelector('#objective-text').textContent
  };
})()`);
if (shadowTargetState.shadowBox !== 'c' || !shadowTargetState.shadeClosed) {
  throw new Error(`L1 shadow target was not latched: ${JSON.stringify(shadowTargetState)}`);
}
if (mobile) await evaluate(`document.querySelector('#shadow-switch').click()`);
else await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x', bubbles: true }))`);
await new Promise(resolve => setTimeout(resolve, 900));
const returnedBody = await evaluate(`(() => {
  const debug = window.__eclipseDebug;
  return { face: debug.game.face?.boxId, dying: !!debug.game.dying, mode: debug.game.controlMode };
})()`);
if (returnedBody.face !== 'c' || returnedBody.dying || returnedBody.mode !== 'body') {
  throw new Error(`L1 body return failed: ${JSON.stringify(returnedBody)}`);
}

const play = await evaluate(`new Promise(resolve => requestAnimationFrame(() => {
  const canvasPixels = (() => {
    const canvas = document.querySelector('#view');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return null;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const sample = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, sample);
    let nonBlack = 0;
    let bright = 0;
    let checksum = 2166136261;
    for (let offset = 0; offset < sample.length; offset += 4) {
      const light = sample[offset] + sample[offset + 1] + sample[offset + 2];
      if (light > 24) nonBlack += 1;
      if (light > 192) bright += 1;
      checksum ^= light;
      checksum = Math.imul(checksum, 16777619);
    }
    return { width, height, nonBlack, bright, checksum: checksum >>> 0 };
  })();
  resolve({
    hud: !document.querySelector('#hud').classList.contains('hidden'),
    objective: document.querySelector('#objective-text').textContent,
    control: document.querySelector('#control-state-text').textContent,
    controlVisible: !document.querySelector('#control-state').classList.contains('hidden'),
    controlMode: document.querySelector('#control-state').dataset.mode,
    swapVisible: !document.querySelector('#shadow-switch').classList.contains('hidden'),
    views: document.querySelectorAll('#views button').length,
    canvasPixels
  });
}))`);

const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

const exceptions = events
  .filter(event => event.method === 'Runtime.exceptionThrown')
  .map(event => event.params?.exceptionDetails?.exception?.description
    || event.params?.exceptionDetails?.text
    || event.method)
  .filter(text => !/favicon/i.test(text));

console.log(JSON.stringify({ viewport: { width, height, mobile }, title, afterLever, beforeSwap, shadowTargetState, returnedBody, play, bodyScreenshotPath, screenshotPath, exceptions }));
socket.close();
if (runtimeErrors.length) console.error(JSON.stringify(runtimeErrors, null, 2));
if (play.controlMode !== 'body' || exceptions.length || (mobile && (!beforeSwap.swapVisible || !play.swapVisible))) process.exitCode = 1;
