const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'docs' || entry.name === 'node_modules') continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const name of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(root, name), path.join(dist, name));
}
copyDir(path.join(root, 'src'), path.join(dist, 'src'));
copyDir(path.join(root, 'vendor'), path.join(dist, 'vendor'));

// 只带真正被引用到的素材，旧版静帧不进投稿包。
function referencedAssets() {
  const used = new Set();
  const scan = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(absolute); continue; }
      if (!/\.(js|html|css|json)$/i.test(entry.name)) continue;
      const text = fs.readFileSync(absolute, 'utf8');
      for (const match of text.matchAll(/assets\/([A-Za-z0-9_.-]+)/g)) used.add(match[1]);
    }
  };
  scan(path.join(dist, 'src'));
  for (const name of ['index.html', 'styles.css']) {
    const text = fs.readFileSync(path.join(dist, name), 'utf8');
    for (const match of text.matchAll(/assets\/([A-Za-z0-9_.-]+)/g)) used.add(match[1]);
  }
  return used;
}

const wanted = referencedAssets();
const assetsOut = path.join(dist, 'assets');
fs.mkdirSync(assetsOut, { recursive: true });
let skipped = 0;
for (const entry of fs.readdirSync(path.join(root, 'assets'), { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (!wanted.has(entry.name)) { skipped += 1; continue; }
  fs.copyFileSync(path.join(root, 'assets', entry.name), path.join(assetsOut, entry.name));
}

const start = `#!/bin/sh
cd "$(dirname "$0")"
PORT="\${ECLIPSE_LINE_PORT:-8765}"
printf '蚀线已启动：http://127.0.0.1:%s/\n' "$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1
`;
fs.writeFileSync(path.join(dist, '开始游戏.command'), start, { mode: 0o755 });

function releaseFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...releaseFiles(absolute));
    else if (entry.name !== 'SHA256SUMS.txt') files.push(absolute);
  }
  return files;
}

const checksums = releaseFiles(dist)
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map(file => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const relative = path.relative(dist, file).split(path.sep).join('/');
    return `${hash}  ${relative}`;
  })
  .join('\n');
fs.writeFileSync(path.join(dist, 'SHA256SUMS.txt'), `${checksums}\n`);

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(absolute) : fs.statSync(absolute).size;
  }
  return total;
}
console.log('packed', dist);
console.log(`  素材 ${wanted.size} 个，跳过未引用 ${skipped} 个`);
console.log(`  体积 ${(dirSize(dist) / 1024 / 1024).toFixed(1)} MB`);
