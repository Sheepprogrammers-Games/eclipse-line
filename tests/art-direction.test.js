import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [level, atmosphere, paper, props, shadowfield, shadowavatar, shadowengine, camera, main, html, styles, artScript] = await Promise.all([
  readFile(new URL('../src/world/level.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/fx/atmosphere.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/fx/paper.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/world/props.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/world/shadowfield.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/world/shadowavatar.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/engine/shadow.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/fx/camera.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/gen-art.py', import.meta.url), 'utf8')
]);

await assert.rejects(access(new URL('../src/world/dressing.js', import.meta.url)));
await access(new URL('../assets/player-cutout.png', import.meta.url));
assert.doesNotMatch(level, /dressTile|addSkyline|tile-city|skyline/);
assert.doesNotMatch(`${atmosphere}\n${paper}\n${props}`, /0xff(?:c45a|d089|e4a8|9a28|5a3a|4a32)/i);
assert.match(atmosphere, /export function createAtmosphere[\s\S]*?return group;/);
assert.doesNotMatch(atmosphere, /Math\.random\(\)/);
assert.match(styles, /#coach\s*\{\s*display: none !important;/);
assert.match(styles, /#game,\s*#game \*\s*\{\s*letter-spacing: 0 !important;/);
assert.match(html, /aria-label="暂停"[^>]*>Ⅱ<\/button>/);
assert.match(main, /btn\.setAttribute\('aria-label', `切换到\$\{view\.name\}视角`\)/);
assert.match(main, /syncShadowField\(levelRoot, world/);
assert.match(main, /function levelFocus\(\)/);
assert.match(shadowfield, /player-shadow/);
assert.match(shadowfield, /shadow-target/);
assert.match(shadowavatar, /shadow-avatar/);
assert.match(shadowavatar, /shadow-tether/);
assert.match(shadowavatar, /shadow-projection/);
assert.match(shadowavatar, /function setProjectionPath/);
assert.match(shadowavatar, /pinned\?\.path \|\| pose\.path/);
assert.match(shadowavatar, /mesh\.position\.copy\(start\)/);
assert.doesNotMatch(shadowavatar, /setProjection\(projection, center\.sub/);
assert.match(shadowavatar, /registerPortraitMaterial/);
assert.match(shadowavatar, /size: 1\.68/);
assert.match(shadowengine, /projectShadowPoint/);
assert.match(camera, /PerspectiveCamera\(24/);
assert.match(camera, /AmbientLight\(PAPER, 1\.08\)/);
assert.match(camera, /fromScene\(envScene, 0\.04\)/);
assert.match(paper, /const hatch = makeHatchMap\(\)/);
assert.match(paper, /map: hatch/);
assert.match(level, /burn-mark/);
assert.match(props, /spec\.kind === 'lighthouse'/);
assert.match(props, /spec\.kind === 'eclipse'/);
assert.match(props, /function makeSpikeField/);
assert.match(props, /level\.hazards/);
assert.doesNotMatch(main, /assets\/(?:title-hero|still-l4|still-l7|still-l10)\.png/);
assert.match(main, /assets\/title-hero-v78\.png/);
assert.doesNotMatch(main, /floorProbe/);
assert.match(styles, /--panel:/);
assert.match(styles, /#stick-base::after/);
assert.match(styles, /\.title-card \.menu \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(styles, /@keyframes title-menu-arrive/);
assert.match(styles, /@media \(max-width: 559px\) \{[\s\S]*?#title \{[\s\S]*?padding-inline: 12px;[\s\S]*?\.title-card \.menu \{ width: min\(360px, 100%\);/);
assert.match(styles, /\.screen-overline\s*\{/);
assert.match(styles, /\.settings-card\s*\{/);
assert.match(styles, /\.credits-card\s*\{/);
assert.match(styles, /@media \(max-width: 559px\) and \(max-height: 680px\) \{[\s\S]*?\.settings-card \{[\s\S]*?padding: 16px 16px 12px;/);
assert.doesNotMatch(artScript, /paper-cut city|box buildings|paper city/i);

console.log(JSON.stringify({ artDirection: 'ok', palette: 'monochrome', cityDressing: false }));
