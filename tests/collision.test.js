import assert from 'node:assert/strict';
import { bodyOverlapsRaisedSolid, bodyPathClearsRaisedSolids } from '../src/engine/collision.js';
import { foldShadowPath } from '../src/engine/shadow.js';

const wall = { id: 'high', min: [-1, 1, 4], max: [1, 2, 7], role: 'solid' };
const radius = 0.31;

assert.equal(
  bodyOverlapsRaisedSolid([wall], { x: 0, y: 1, z: 3.7 }, { radius }),
  true,
  'the body must be blocked when its center is outside but its radius enters the wall'
);
assert.equal(
  bodyOverlapsRaisedSolid([wall], { x: 0, y: 1, z: 3.69 }, { radius }),
  false,
  'touching the wall is allowed without visible overlap'
);
assert.equal(
  bodyOverlapsRaisedSolid([wall], { x: 1.2, y: 1, z: 3.8 }, { radius }),
  true,
  'diagonal movement must respect the rounded wall corner'
);
assert.equal(
  bodyOverlapsRaisedSolid([wall], { x: 1.32, y: 1, z: 4.5 }, { radius }),
  false,
  'a body beside the wall can move along it'
);
assert.equal(
  bodyOverlapsRaisedSolid([wall], { x: 0, y: 2, z: 4.2 }, { radius }),
  false,
  'standing on the platform top must remain valid'
);
assert.equal(
  bodyOverlapsRaisedSolid(
    [{ id: 'pillar', min: [2, 1, 2], max: [3, 4, 3], role: 'pillar', walkable: false }],
    { x: 1.8, y: 1, z: 2.5 },
    { radius }
  ),
  true,
  'non-walkable props are still physical obstacles'
);

const climb = [
  [0, 1, 2.8],
  [0, 1, 3.18],
  [0, 2, 3.68],
  [0, 2, 4.2]
];
assert.equal(
  bodyPathClearsRaisedSolids([wall], climb, { radius }),
  true,
  'the folded shadow reaches platform height before the body crosses the wall'
);
assert.equal(
  bodyPathClearsRaisedSolids([wall], [[0, 1, 2.8], [0, 1, 4.2]], { radius }),
  false,
  'a flat shadow path cannot carry the body through a raised wall'
);

const l1HighPlatform = { id: 'c', min: [2.2, 1, 5.8], max: [7.2, 1.94, 7.8], role: 'solid' };
const l1Fold = foldShadowPath(
  [3.43, 1, 2.3],
  [4.7, 1.94, 6.8],
  [l1HighPlatform],
  { rampRun: 0.82 }
);
assert.equal(
  bodyPathClearsRaisedSolids([l1HighPlatform], l1Fold, { radius }),
  true,
  'the authored L1 folded shadow must lift the whole body clear before crossing the wall'
);
assert.ok(
  l1Fold.some(point => point[1] === 1.94 && point[2] <= 5.8 - radius),
  'L1 must reach the platform height at least one body radius before its wall'
);

console.log(JSON.stringify({ collision: 'ok', radius }));
