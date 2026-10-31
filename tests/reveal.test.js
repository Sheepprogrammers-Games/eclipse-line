import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS } from '../src/content/levels.js';

// main.js 里实际会调用 fireReveal 的事件名，演出配置只能用这些。
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const wired = new Set(
  [...source.matchAll(/fireReveal\(\s*'([a-zA-Z]+)'/g)].map(match => match[1])
);
for (const match of source.matchAll(/fireReveal\(([^')][^)]*)\)/g)) {
  // 动态实参（三元、变量）单独登记，避免误判为未接线。
  if (/lanternOn|shadowTarget|sw\.kind/.test(match[1])) {
    wired.add('lanternOn');
    wired.add('lanternOff');
    wired.add('shadowPinned');
    wired.add('shadowTarget');
    wired.add('plate');
    wired.add('lit');
  }
}

const missing = [];
for (const level of LEVELS) {
  assert.ok(level.reveal, `${level.id} 缺少揭示时刻配置`);
  const { on, focus, slowmo, hold } = level.reveal;
  assert.ok(typeof on === 'string' && on, `${level.id} 的 reveal.on 必须是事件名`);
  if (!wired.has(on)) missing.push(`${level.id} → ${on}`);
  assert.ok(Array.isArray(focus) && focus.length === 3 && focus.every(Number.isFinite),
    `${level.id} 的 reveal.focus 必须是三维坐标`);
  assert.ok(slowmo > 0 && slowmo <= 1, `${level.id} 的 slowmo 必须落在 (0,1]`);
  assert.ok(hold > 0 && hold <= 2, `${level.id} 的 hold 必须落在 (0,2]`);
}
assert.deepEqual(missing, [], `以下关卡的触发事件没有接线：\n${missing.join('\n')}`);

// 触发事件所依赖的机制必须真的存在于该关。
for (const level of LEVELS) {
  const on = level.reveal.on;
  if (on === 'crate') {
    assert.ok(level.crates?.length, `${level.id} 用了 crate 触发却没有纸箱`);
  }
  if (on === 'lever' || on === 'plate' || on === 'lit') {
    assert.ok((level.switches || []).some(sw => (sw.kind || 'lever') === on),
      `${level.id} 用了 ${on} 触发却没有对应的闸`);
  }
  if (on === 'lanternOn' || on === 'lanternOff') {
    assert.ok(level.lantern, `${level.id} 用了提灯触发却没有提灯`);
  }
  if (on === 'seamSweep') {
    assert.ok((level.lights || []).some(light => light.rotate),
      `${level.id} 用了缝隙触发却没有旋转灯`);
  }
  if (on === 'lamp') {
    assert.ok((level.lights || []).some(light => light.detents || light.turn)
      || (level.mirrors || []).length,
    `${level.id} 用了转灯触发却没有可转的灯或镜`);
  }
}

console.log(JSON.stringify({ reveal: 'ok', levels: LEVELS.length }));
