import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, main] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8')
]);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'index.html contains duplicate ids');

const titleMenuIndexes = [...html.matchAll(/data-menu-index="([^"]+)"/g)].map(match => match[1]);
assert.equal(titleMenuIndexes.length, 6);
assert.equal(new Set(titleMenuIndexes).size, titleMenuIndexes.length);

const referenced = [...main.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(match => match[1]);
for (const id of new Set(referenced)) {
  assert.ok(ids.includes(id), `Missing DOM element #${id}`);
}

assert.match(html, /styles\.css\?v=107/);
assert.match(html, /main\.js\?v=113/);
assert.match(main, /awaitingNeutralInput/);
assert.match(main, /boxId: target\?\.boxId \|\| '__free-shadow__'/);
assert.match(main, /frozenShadowHitAt/);
assert.match(main, /engine\/shadow\.js\?v=113/);
assert.match(main, /engine\/collision\.js\?v=113/);
assert.match(main, /engine\/crate\.js\?v=113/);
assert.match(main, /save\.js\?v=113/);
assert.match(main, /content\/levels\.js\?v=113/);
assert.match(main, /content\/copy\.js\?v=113/);
assert.match(main, /exposureMeter\.dataset\.player/);
assert.match(main, /bodyCanStandAt\(direct\)/);
assert.match(main, /bodyCanStandAt\(frozen\)/);
assert.match(main, /shadowHitBlockedBySolid\(game\.world\?\.boxes, hit\)/);
assert.match(main, /level\(\)\.lantern && game\.lanternHeld \? \{ \.\.\.game\.enabled, porch: false \}/);
assert.match(main, /game\.lanternHeld = false/);
assert.match(main, /game\.shadowPose = null;[\s\S]*refreshShadowPose\(true\);/);
assert.match(main, /onFrozenShadow && !walkHitAt/);
assert.match(main, /clearTransientInput\(\);[\s\S]*spawnLevel\(index\);/);
assert.match(main, /if \(game\.awaitingNeutralInput\)[\s\S]*Math\.hypot\(x, z\) <= 0\.08/);
assert.equal((html.match(/class="screen-overline"/g) || []).length, 5);
assert.ok(ids.includes('shadow-action'));
assert.ok(ids.includes('shadow-switch'));
assert.ok(ids.includes('control-state'));
assert.ok(ids.includes('exposure-meter'));
assert.ok(ids.includes('boot-screen'));

console.log(JSON.stringify({ dom: 'ok', ids: ids.length }));
