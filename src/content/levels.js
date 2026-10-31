function tile(id, x, z, w = 2, d = 2.4, extra = {}) {
  const y = extra.y ?? 0;
  const h = extra.h ?? 0.4;
  return {
    id,
    min: [x, y, z],
    max: [x + w, y + h, z + d],
    role: extra.role || 'solid',
    walkable: extra.walkable
  };
}

function lamp(id, x, y, z, extra = {}) {
  return {
    id,
    type: extra.type || 'spot',
    origin: [x, y, z],
    yaw: extra.yaw ?? 0,
    baseYaw: extra.baseYaw ?? extra.yaw ?? 0,
    tilt: extra.tilt ?? 0,
    angle: extra.angle ?? Math.PI / 2.6,
    range: extra.range ?? 14,
    enabled: extra.enabled !== false,
    detents: extra.detents,
    rotate: extra.rotate || 0,
    delay: extra.delay || 0,
    togglable: extra.togglable || false,
    movable: extra.movable || false,
    moveRange: extra.moveRange,
    moveStep: extra.moveStep,
    aimable: extra.rotate ? false : extra.aimable !== false,
    turn: extra.turn || 1,
    followView: extra.followView || false,
    power: extra.power,
    disabledBy: extra.disabledBy,
    disableWhen: extra.disableWhen,
    coverBeam: extra.coverBeam || false,
    skipBoxIds: extra.skipBoxIds,
    ignoreBoxIds: extra.ignoreBoxIds,
    onlyBoxIds: extra.onlyBoxIds
  };
}

function crate(id, x, z, extra = {}) {
  const w = extra.w ?? 1.4;
  const d = extra.d ?? 1.6;
  const h = extra.h ?? 2.2;
  const y = extra.y ?? 0.4;
  return {
    id,
    role: 'crate',
    walkable: false,
    min: [x, y, z],
    max: [x + w, y + h, z + d],
    axis: extra.axis || 'z',
    limit: extra.limit || [-2, 4]
  };
}

function pillar(id, x, z, extra = {}) {
  const w = extra.w ?? 0.9;
  const d = extra.d ?? 0.9;
  const h = extra.h ?? 3.4;
  const y = extra.y ?? 0.4;
  return {
    id,
    role: 'pillar',
    walkable: false,
    min: [x, y, z],
    max: [x + w, y + h, z + d]
  };
}

function look(name, pitch, yaw, dist, extra = {}) {
  return {
    id: extra.id || name,
    name,
    pitch,
    yaw,
    dist,
    roll: extra.roll || 0,
    yawBias: extra.yawBias || 0,
    sunTilt: extra.sunTilt,
    fov: extra.fov,
    portraitBoost: extra.portraitBoost,
    portraitYaw: extra.portraitYaw
  };
}

export const LEVELS = [
  {
    id: 'L1',
    chapter: 1,
    name: '影钉试炼',
    hint: '出生台绝对安全。调节灯距，让影子从脚底跨过地刺并折上高台；影子可在任意长度钉住，冻结后形状不会再变。',
    referenceStyle: true,
    spawn: { x: 1.15, y: 1, z: 1.78, boxId: 'a', face: '+y' },
    goal: { boxId: 'd', face: '+y' },
    focus: [3.4, 0.82, 8.2],
    reveal: { on: 'shadowTarget', focus: [3.4, 0.82, 8.2], slowmo: 0.45, hold: 0.6 },
    portraitFocus: [2.15, 0.82, 6.8],
    focusFollow: 0.035,
    views: [
      look('封面', 45, -115, 38, { fov: 30, portraitBoost: 1.12, portraitYaw: -122 }),
      look('俯视', 67, -92, 34, { fov: 27 }),
      look('影线', 32, -10, 34, { fov: 29 })
    ],
    camera: look('封面', 45, -115, 38, { fov: 30, portraitBoost: 1.12, portraitYaw: -122 }),
    walls: false,
    shadowCast: true,
    shadowControl: { enabled: true, swap: false, lightId: 'glow', switchRadius: 0.92, maxDistance: 18, maxGap: 5.2, pinMaxLength: 6.8, rampRun: 0.82 },
    shadowTargets: [{
      boxId: 'c',
      face: '+y',
      lightId: 'glow',
      mode: 'bridge',
      maxDistance: 5.4,
      captureRadius: 0.72,
      origin: [4.7, 1.94, 6.8]
    }],
    boxes: [
      tile('a', -1.4, 0, 8, 3.8, { h: 1 }),
      tile('b', 0.2, 3.8, 2.2, 4, { h: 0.94 }),
      tile('c', 2.2, 5.8, 5, 2, { y: 1, h: 0.94 }),
      tile('k', 5.2, 7.8, 2, 2.4, { y: 1, h: 0.94 }),
      tile('e', 3.2, 10.2, 4, 2, { y: 1, h: 0.94 }),
      tile('f', 1.2, 10.2, 2, 3, { y: 1, h: 0.94 }),
      tile('g', -1.6, 12.2, 3, 2.5, { y: 1, h: 0.94 }),
      tile('d', -1.2, 14.7, 5.8, 3.2, { role: 'goal', y: 1, h: 0.94 })
    ],
    hazards: [{ id: 'spike-pit', type: 'spikes', x: 2.4, z: 3.8, w: 4.2, d: 2, y: 0.12, rows: 4, columns: 8 }],
    lights: [
      lamp('glow', 1.1, 3.9, -6, {
        type: 'point',
        range: 18,
        aimable: false,
        movable: true,
        moveRange: [2.4, 9.5],
        moveStep: 0.7,
        onlyBoxIds: ['a']
      }),
      lamp('sun', 6.5, 14, 24, {
        type: 'point',
        yaw: -2.53,
        tilt: 0.57,
        angle: Math.PI / 10,
        range: 30,
        aimable: false,
        coverBeam: true,
        onlyBoxIds: ['b', 'c', 'k', 'e', 'f', 'g', 'd']
      }),
    ],
    crates: [],
    lamps: [{ id: 'glow', origin: [1.1, 1.2, -2.8], tall: true }],
    switches: [
      { id: 'shade', kind: 'shadow', boxId: 'c', face: '+y', origin: [4.7, 1.94, 6.8], shadowRadius: 0.92 }
    ],
    wires: [],
    silhouette: 0
  },
  {
    id: 'L2',
    chapter: 1,
    name: '遮光搬运场',
    hint: '大厅和主路完全同高。纸箱挡住前方主光，连续推入上方侧槽，整条直桥显影后直接前往终点。',
    spawn: { x: 1.35, y: 0.6, z: 2.4, boxId: 'west', face: '+y' },
    goal: { boxId: 'east', face: '+y' },
    focus: [5.9, 0.55, 2.65],
    reveal: { on: 'crate', focus: [5.9, 0.55, 2.65], slowmo: 0.45, hold: 0.6 },
    views: [look('全景', 48, -46, 30), look('顶视', 69, -89, 28)],
    camera: look('全景', 48, -46, 30),
    walls: false,
    boxes: [
      tile('west', 0, 0, 4.2, 4, { h: 0.6 }),
      tile('bay', 2.2, 4, 2, 2.6, { h: 0.6 }),
      tile('bridge', 4.2, 1.2, 4.6, 2.6, { h: 0.6 }),
      tile('east', 8.8, 0.6, 3.4, 4, { role: 'goal', h: 0.6 })
    ],
    lights: [
      lamp('porch', 1.5, 5.2, 2.4, { type: 'point', range: 8, aimable: false, onlyBoxIds: ['west', 'bay'] }),
      lamp('sun', 1.45, 5.8, 2.4, {
        type: 'point',
        range: 18,
        aimable: false,
        onlyBoxIds: ['bridge', 'east']
      })
    ],
    crates: [crate('box', 4, 0.9, { w: 1.8, d: 2.6, h: 2.7, y: 0.6, axis: 'z', limit: [0.9, 4] })],
    lamps: [
      { id: 'porch', origin: [-0.45, 1.45, 2.4], small: true },
      { id: 'sun', origin: [1.45, 1.9, -0.6] }
    ],
    silhouette: 1
  },
  {
    id: 'L3',
    chapter: 1,
    name: '提灯接力',
    hint: '起点门灯始终安全。拾起提灯后，沿宽窄交替的纸台逐段接光，每一步都有稳定落脚处。',
    spawn: { x: 0.9, y: 0.52, z: 1.2, boxId: 'start', face: '+y' },
    goal: { boxId: 'end', face: '+y' },
    focus: [4.7, 0.72, 3.15],
    reveal: { on: 'lanternOff', focus: [4.7, 0.72, 3.15], slowmo: 0.45, hold: 0.6 },
    views: [look('全景', 46, -50, 29), look('折线', 67, -89, 27)],
    camera: look('全景', 46, -50, 29),
    walls: false,
    lantern: true,
    boxes: [
      tile('start', 0, 0, 2, 2.65, { h: 0.52 }),
      tile('lip', 1.8, 0.1, 1.35, 2.35, { y: 0.28, h: 0.46 }),
      tile('g0', 3, 0, 1.8, 2.55, { y: 0.52, h: 0.46 }),
      tile('g1', 4.55, 0.15, 1.8, 2.45, { y: 0.28, h: 0.46 }),
      tile('g2', 4.55, 2.35, 1.8, 2.4, { h: 0.5 }),
      tile('g3', 2.95, 2.5, 1.85, 2.2, { y: 0.28, h: 0.46 }),
      tile('g4', 2.95, 4.55, 1.85, 2.35, { y: 0.52, h: 0.46 }),
      tile('end', 4.55, 4.35, 3, 2.8, { role: 'goal', h: 0.58 })
    ],
    lights: [
      lamp('porch', 1.05, 3.4, 1.2, {
        type: 'point',
        range: 4.2,
        aimable: false,
        onlyBoxIds: ['start', 'lip']
      })
    ],
    crates: [],
    lamps: [{ id: 'porch', origin: [-0.5, 1.35, 1.2], small: true }],
    pickup: { x: 2.4, y: 0.76, z: 1.2 },
    pickupTo: { boxId: 'lip', face: '+y' },
    silhouette: 2
  },
  {
    id: 'L4',
    solution: [{ levers: { noonGate: true }, yaw: { noon: 0.75 } }],
    chapter: 2,
    name: '双光校准室',
    hint: '先从独立晨光区走到纸闸，再为第二盏灯通电并校准方向。黑暗与过曝都不能承重。',
    spawn: { x: 5.3, y: 0.58, z: 1.5, boxId: 'a', face: '+y' },
    goal: { boxId: 'e', face: '+y' },
    focus: [6.8, 0.66, 5.9],
    reveal: { on: 'lever', focus: [6.8, 0.66, 5.9], slowmo: 0.45, hold: 0.6 },
    views: [look('全景', 51, -43, 37), look('六面', 70, -89, 34)],
    camera: look('全景', 51, -43, 37),
    walls: false,
    slowmoOnOverexposure: true,
    monument: { kind: 'prism', origin: [1.5, 0.42, 6.6], radius: 1.05, height: 2.8 },
    boxes: [
      tile('a', 3.8, 0, 3, 3, { h: 0.58 }),
      tile('b', 4.55, 2.9, 1.5, 1.6, { y: 0.18, h: 0.46 }),
      tile('c', 3.8, 4.4, 3, 3, { y: 0.36, h: 0.5 }),
      tile('d', 6.7, 5.15, 1.6, 1.5, { y: 0.18, h: 0.46 }),
      tile('p', 8.2, 4.4, 3, 3, { h: 0.56 }),
      tile('q', 8.95, 7.3, 1.5, 1.6, { y: 0.2, h: 0.46 }),
      tile('r', 8.2, 8.8, 3, 3, { y: 0.38, h: 0.5 }),
      tile('e', 5.2, 8.8, 3, 3, { role: 'goal', h: 0.6 })
    ],
    lights: [
      lamp('dawn', 5.35, 7.6, 3.2, {
        type: 'point',
        range: 18,
        aimable: false,
        onlyBoxIds: ['a', 'b', 'c', 'd']
      }),
      lamp('noon', 3.4, 7.2, 3.2, {
        tilt: 0.78,
        yaw: 0.18,
        angle: Math.PI / 7.8,
        range: 18,
        enabled: false,
        power: 'noonGate',
        onlyBoxIds: ['p', 'q', 'r', 'e']
      })
    ],
    crates: [],
    lamps: [
      { id: 'dawn', origin: [2.35, 1.8, -0.45] },
      { id: 'noon', origin: [11.9, 2.2, 3.45], tall: true }
    ],
    switches: [{ id: 'noonGate', kind: 'lever', boxId: 'c', origin: [5.3, 0.86, 5.35] }],
    wires: [{ from: 'noonGate', to: 'noon' }],
    silhouette: 3
  },
  {
    id: 'L5',
    solution: [{ yaw: { left: 0.18, right: -0.4 } }],
    chapter: 2,
    name: '影印门闩',
    hint: '将任意合适长度的影子钉在纸眼上；冻结影子持续压住按钮，人可以离开去调另一盏灯并穿门。',
    spawn: { x: 1.2, y: 0.52, z: 1.2, boxId: 'west', face: '+y' },
    goal: { boxId: 'east', face: '+y' },
    focus: [6.9, 0.72, 2.25],
    reveal: { on: 'shadowTarget', focus: [6.9, 0.72, 2.25], slowmo: 0.45, hold: 0.6 },
    views: [look('全景', 50, -31, 35), look('纸眼', 69, -89, 32)],
    camera: look('全景', 50, -31, 35),
    walls: false,
    shadowCast: true,
    shadowControl: { enabled: true, swap: false, switchRadius: 0.82, maxDistance: 12, maxGap: 3.2, pinMaxLength: 4.2 },
    shadowTargets: [{
      boxId: 'shade',
      face: '+y',
      lightId: 'left',
      mode: 'switch',
      maxDistance: 4.4,
      maxShadowLength: 4.2,
      captureRadius: 0.58,
      origin: [3.83, 0.64, 0.48]
    }],
    boxes: [
      tile('west', 0, 0, 2.55, 2.6, { h: 0.52 }),
      tile('n1', 2.35, 0.08, 1.95, 2.32, { y: 0.18, h: 0.46 }),
      tile('n2', 4.2, 0, 1.8, 2.4, { y: 0.08, h: 0.48 }),
      tile('n3', 4, 2.4, 5.6, 2.2, { y: 0.22, h: 0.5 }),
      tile('n4', 7.8, 0, 1.8, 2.4, { y: 0.08, h: 0.48 }),
      tile('n5', 9.5, 0.08, 2, 2.32, { y: 0.18, h: 0.46 }),
      tile('east', 11.35, 0, 2.75, 2.6, { role: 'goal', h: 0.56 }),
      pillar('obelisk', 4.45, -0.72, { w: 0.95, d: 1.08, h: 3.7 }),
      pillar('obelisk2', 8.05, -0.72, { w: 0.95, d: 1.08, h: 3.7 }),
      { id: 'shade', min: [3.48, 0.52, 0.22], max: [4.18, 0.64, 0.74], role: 'solid', walkable: false }
    ],
    lights: [
      lamp('left', 1.15, 4.9, -1.55, {
        tilt: 0.86,
        yaw: 0.45,
        angle: Math.PI / 7.6,
        range: 16,
        skipBoxIds: ['n4', 'n5', 'east'],
        ignoreBoxIds: ['n1', 'n2']
      }),
      lamp('right', 12.7, 4.9, -1.55, {
        tilt: 0.86,
        yaw: -0.18,
        angle: Math.PI / 7.6,
        range: 16,
        skipBoxIds: ['west', 'n1'],
        enabled: false,
        power: 'shade'
      })
    ],
    crates: [],
    lamps: [{ id: 'left', origin: [1.15, 1.6, -1.15] }, { id: 'right', origin: [12.7, 1.6, -1.15] }],
    switches: [{ id: 'shade', kind: 'shadow', boxId: 'shade', face: '+y', origin: [3.83, 0.64, 0.48], shadowRadius: 0.78 }],
    wires: [{ from: 'shade', to: 'right' }],
    hidden: { x: 5.1, z: 1.2, boxId: 'n2' },
    silhouette: 4
  },
  {
    id: 'L11',
    solution: [{ yaw: { swing: 0 } }],
    chapter: 2,
    name: '错开',
    hint: '走廊被两束光同时照着，白得站不住。把可转的那盏灯挪开，让走廊只剩一束光，它让出的光再去照亮北面的出口。',
    spawn: { x: -1.7, y: 0.5, z: 6, boxId: 's', face: '+y' },
    goal: { boxId: 'g', face: '+y' },
    focus: [3.4, 0.62, 6],
    reveal: { on: 'lamp', focus: [3.4, 0.62, 6], slowmo: 0.45, hold: 0.7 },
    views: [look('全景', 49, -38, 34), look('走廊', 66, -88, 30)],
    camera: look('全景', 49, -38, 34),
    walls: false,
    boxes: [
      tile('s', -3.2, 4.8, 3, 2.4, { h: 0.5 }),
      tile('c1', -0.2, 4.8, 2.4, 2.4, { h: 0.5 }),
      tile('c2', 2.2, 4.8, 2.4, 2.4, { h: 0.5 }),
      tile('c3', 4.6, 4.8, 2.4, 2.4, { h: 0.5 }),
      tile('n1', 4.6, 7.2, 2.4, 2.1, { h: 0.5 }),
      tile('g', 4.6, 9.3, 3, 2.4, { role: 'goal', h: 0.5 })
    ],
    lights: [
      lamp('flat', 1.6, 7.4, 6, {
        type: 'point',
        range: 20,
        aimable: false,
        onlyBoxIds: ['s', 'c1', 'c2', 'c3']
      }),
      lamp('swing', 6, 6.5, 6, {
        tilt: 0.605,
        yaw: -Math.PI / 2,
        angle: Math.PI / 7.2,
        range: 18,
        detents: 15,
        onlyBoxIds: ['c1', 'c2', 'c3', 'n1', 'g']
      })
    ],
    crates: [],
    lamps: [
      { id: 'flat', origin: [-3.6, 1.7, 3.4], small: true },
      { id: 'swing', origin: [7.9, 2.1, 4.4], tall: true }
    ],
    switches: [],
    wires: [],
    silhouette: 5
  },
  {
    id: 'L6',
    solution: [{ yaw: { fold: 0.95 }, levers: { pad: true } }],
    chapter: 2,
    name: '镜桥工坊',
    hint: '出生厅由固定灯照亮。踩住踏印为纸镜通电，再转镜把光送入悬空长廊。',
    spawn: { x: 1.25, y: 0.54, z: 1.1, boxId: 'hall', face: '+y' },
    goal: { boxId: 'alcove', face: '+y' },
    focus: [4.2, 0.72, 4.2],
    reveal: { on: 'lamp', focus: [4.2, 0.72, 4.2], slowmo: 0.45, hold: 0.6 },
    views: [look('全景', 48, 14, 31), look('折角', 69, -89, 28), look('镜面', 31, -8, 29)],
    camera: look('全景', 48, 14, 31),
    walls: false,
    boxes: [
      tile('hall', 0, 0, 4.8, 2.4, { h: 0.54 }),
      tile('pad', 4.55, 0.04, 3, 2.26, { y: 0.12, h: 0.5 }),
      tile('neck', 4.9, 2.15, 2.6, 2.35, { y: 0.32, h: 0.5 }),
      tile('mid', 4.9, 4.35, 2.6, 2.35, { y: 0.58, h: 0.5 }),
      tile('alcove', 4.9, 6.55, 3, 2.8, { role: 'goal', y: 0.32, h: 0.58 })
    ],
    lights: [
      lamp('porch', 3.2, 3.1, 1.1, {
        tilt: 0.06,
        yaw: 0.2,
        angle: Math.PI / 2.6,
        range: 7.2,
        aimable: false,
        skipBoxIds: ['neck', 'mid', 'alcove']
      }),
      lamp('beam', 1.4, 3.9, 1.1, {
        tilt: 0.92,
        yaw: Math.PI / 2,
        angle: Math.PI / 11,
        range: 10,
        enabled: false,
        power: 'pad',
        skipBoxIds: ['hall', 'pad']
      })
    ],
    crates: [],
    mirrors: [{ id: 'fold', origin: [6.35, 1.25, 2.05], yaw: 2.02, parent: 'beam', detents: 10, turn: -1 }],
    lamps: [{ id: 'porch', origin: [1.15, 1.2, -0.32], small: true }, { id: 'beam', origin: [1.55, 1.7, -0.35] }],
    switches: [{ id: 'pad', kind: 'plate', boxId: 'pad', origin: [6, 0.62, 1.1] }],
    wires: [{ from: 'pad', to: 'beam' }],
    silhouette: 5
  },
  {
    id: 'L15',
    solution: [{ yaw: { near: 2.88, far: 0 } }],
    chapter: 2,
    name: '回声镜',
    hint: '一束光，两面纸镜。各转一面，把同一束光劈成两段送进折廊——但两段折光落在同一块纸上，那块纸也会白掉。',
    spawn: { x: 1.5, y: 0.54, z: 1.5, boxId: 'hall', face: '+y' },
    goal: { boxId: 'vault', face: '+y' },
    focus: [3.6, 0.66, 6.6],
    reveal: { on: 'lamp', focus: [3.6, 0.66, 6.6], slowmo: 0.45, hold: 0.7 },
    views: [look('全景', 49, -40, 34), look('折角', 68, -88, 30)],
    camera: look('全景', 49, -40, 34),
    walls: false,
    boxes: [
      tile('hall', 0, 0, 3, 3, { h: 0.54 }),
      tile('n1', 0, 3, 3, 2.4, { h: 0.54 }),
      tile('n2', 0, 5.4, 3, 2.4, { h: 0.54 }),
      tile('bend', 3, 5.4, 2.4, 2.4, { h: 0.54 }),
      tile('vault', 5.4, 5.4, 3, 2.4, { role: 'goal', h: 0.54 })
    ],
    lights: [
      lamp('porch', 1.5, 4.4, 1.5, {
        type: 'point',
        range: 7,
        aimable: false,
        onlyBoxIds: ['hall']
      }),
      lamp('beam', 1.5, 5, -2.5, {
        tilt: 0.35,
        yaw: 0,
        angle: Math.PI / 9,
        range: 22,
        aimable: false,
        skipBoxIds: ['hall'],
        onlyBoxIds: ['n1', 'n2', 'bend', 'vault']
      })
    ],
    crates: [],
    mirrors: [
      { id: 'near', origin: [1.5, 1.25, 4.2], yaw: 1.2, parent: 'beam', detents: 15, turn: 1 },
      { id: 'far', origin: [4.2, 1.25, 6.6], yaw: 1.2, parent: 'beam', detents: 15, turn: -1 }
    ],
    lamps: [
      { id: 'porch', origin: [-0.6, 1.5, 1.5], small: true },
      { id: 'beam', origin: [1.5, 2.2, -2.5], tall: true }
    ],
    switches: [],
    wires: [],
    silhouette: 5
  },
  {
    id: 'L7',
    chapter: 3,
    name: '灯塔环跑',
    hint: '出生台由港灯永久托住。等待灯塔扫亮下一块纸，再跟随光束完成整圈。',
    spawn: { x: 1, y: 0.56, z: 1, boxId: 's0', face: '+y' },
    goal: { boxId: 's15', face: '+y' },
    focus: [5, 0.78, 5],
    reveal: { on: 'seamSweep', focus: [5, 0.78, 5], slowmo: 0.45, hold: 0.6 },
    views: [look('灯塔', 54, -45, 38), look('时针', 72, -90, 35)],
    camera: look('灯塔', 54, -45, 38),
    walls: false,
    monument: { kind: 'lighthouse', origin: [5, 0.42, 5], scale: 1.16 },
    boxes: [
      tile('s0', 0, 0, 2, 2, { h: 0.56 }),
      tile('s1', 0, 2, 2, 2, { y: 0.1, h: 0.5 }),
      tile('s2', 0, 4, 2, 2, { h: 0.52 }),
      tile('s3', 0, 6, 2, 2, { y: 0.12, h: 0.5 }),
      tile('s4', 0, 8, 2, 2, { h: 0.56 }),
      tile('s5', 2, 8, 2, 2, { y: 0.1, h: 0.5 }),
      tile('s6', 4, 8, 2, 2, { h: 0.52 }),
      tile('s7', 6, 8, 2, 2, { y: 0.12, h: 0.5 }),
      tile('s8', 8, 8, 2, 2, { h: 0.56 }),
      tile('s9', 8, 6, 2, 2, { y: 0.1, h: 0.5 }),
      tile('s10', 8, 4, 2, 2, { h: 0.52 }),
      tile('s11', 8, 2, 2, 2, { y: 0.12, h: 0.5 }),
      tile('s12', 8, 0, 2, 2, { h: 0.56 }),
      tile('s13', 6, 0, 2, 2, { y: 0.48, h: 0.5 }),
      tile('s14', 4, 0, 2, 2, { y: 0.92, h: 0.52 }),
      tile('s15', 2, 0, 2, 2, { role: 'goal', y: 1.36, h: 0.56 })
    ],
    lights: [
      lamp('harbor', 1, 4.8, 1, {
        type: 'point',
        range: 7,
        aimable: false,
        onlyBoxIds: ['s0']
      }),
      lamp('tower', 5, 7.2, 5, {
        yaw: -2.36,
        baseYaw: -2.36,
        tilt: 0.7,
        angle: Math.PI / 10,
        range: 15,
        rotate: 0.16,
        delay: 4.2,
        onlyBoxIds: Array.from({ length: 15 }, (_, index) => `s${index + 1}`)
      })
    ],
    crates: [],
    lamps: [],
    silhouette: 6
  },
  {
    id: 'L8',
    solution: [{ levers: { burnGate: true }, yaw: { burn: 0.7 } }],
    chapter: 3,
    name: '驱影回廊',
    hint: '固定门灯保护出生区。离开安全台后为远灯通电，把光扫过两只影兽，再走折返路线。',
    spawn: { x: 1.1, y: 0.54, z: 1.2, boxId: 'a', face: '+y' },
    goal: { boxId: 'f', face: '+y' },
    focus: [5.1, 0.68, 2.35],
    reveal: { on: 'lever', focus: [5.1, 0.68, 2.35], slowmo: 0.45, hold: 0.6 },
    views: [look('全景', 48, -45, 31), look('折返', 69, -89, 29)],
    camera: look('全景', 48, -45, 31),
    walls: false,
    boxes: [
      tile('a', 0, 0.05, 2.35, 2.45, { h: 0.54 }),
      tile('b', 2.15, 0, 2.4, 2.5, { y: 0.28, h: 0.48 }),
      tile('c', 4.35, 0.1, 2.4, 2.3, { y: 0.5, h: 0.48 }),
      tile('d', 6.55, 0, 2.4, 2.5, { y: 0.28, h: 0.48 }),
      tile('e', 6.55, 2.35, 2.4, 2.4, { y: 0.5, h: 0.48 }),
      tile('f', 4.35, 2.35, 2.4, 2.55, { role: 'goal', h: 0.58 }),
      tile('spur', 4.4, -1.45, 2.2, 1.48, { y: 0.5 }),
      tile('pit', 8.8, 0, 1.5, 2.4)
    ],
    lights: [
      lamp('keep', 1.05, 4.8, 1.2, {
        type: 'point',
        range: 8,
        aimable: false,
        onlyBoxIds: ['a', 'b']
      }),
      lamp('burn', 3.1, 6, -1, {
        tilt: 0.9,
        yaw: -0.95,
        angle: Math.PI / 6,
        range: 16,
        enabled: false,
        power: 'burnGate',
        onlyBoxIds: ['c', 'd', 'e', 'f', 'beast', 'beast2']
      })
    ],
    crates: [],
    shadows: [
      { id: 'beast', role: 'shadow', walkable: false, min: [4.55, 0.98, 0.3], max: [6.45, 2.7, 2.05] },
      { id: 'beast2', role: 'shadow', walkable: false, min: [6.75, 0.98, 2.55], max: [8.65, 2.7, 4.35] }
    ],
    lamps: [{ id: 'keep', origin: [-0.4, 1.7, 1.2] }, { id: 'burn', origin: [3.1, 2.2, -1] }],
    switches: [{ id: 'burnGate', kind: 'lever', boxId: 'b', origin: [3.2, 0.76, 1.15] }],
    wires: [{ from: 'burnGate', to: 'burn' }],
    hidden: { x: 3.3, z: 1.2, boxId: 'b' },
    silhouette: 7
  },
  {
    id: 'L14',
    solution: [{ route: ['dock', 't1', 't2', 't3', 't4', 't5', 't6', 'quay'], limit: 90 }],
    chapter: 3,
    name: '双塔',
    hint: '两座塔各扫各的。一块纸被一束光扫到才站得住，被两束同时扫到就白得站不住——等两条缝错开的那一刻再迈步。',
    spawn: { x: 1, y: 0.56, z: 1, boxId: 'dock', face: '+y' },
    goal: { boxId: 'quay', face: '+y' },
    focus: [7, 0.68, 1],
    reveal: { on: 'seamSweep', focus: [7, 0.68, 1], slowmo: 0.4, hold: 0.8 },
    views: [look('全景', 47, -41, 36), look('长廊', 68, -88, 32)],
    camera: look('全景', 47, -41, 36),
    walls: false,
    boxes: [
      tile('dock', 0, 0, 2, 2, { h: 0.56 }),
      tile('t1', 2, 0, 2, 2, { h: 0.56 }),
      tile('t2', 4, 0, 2, 2, { h: 0.56 }),
      tile('t3', 6, 0, 2, 2, { h: 0.56 }),
      tile('t4', 8, 0, 2, 2, { h: 0.56 }),
      tile('t5', 10, 0, 2, 2, { h: 0.56 }),
      tile('t6', 12, 0, 2, 2, { h: 0.56 }),
      tile('quay', 14, 0, 2.6, 2, { role: 'goal', h: 0.56 })
    ],
    lights: [
      lamp('dockLamp', 1, 4.2, 1, {
        type: 'point',
        range: 6,
        aimable: false,
        onlyBoxIds: ['dock']
      }),
      lamp('quayLamp', 15.3, 4.2, 1, {
        type: 'point',
        range: 6,
        aimable: false,
        onlyBoxIds: ['quay']
      }),
      lamp('west', 3, 6, -5, {
        yaw: -0.72,
        baseYaw: -0.72,
        tilt: 0.973,
        angle: Math.PI / 8,
        range: 20,
        rotate: 0.26,
        onlyBoxIds: ['t1', 't2', 't3', 't4']
      }),
      lamp('east', 11, 6, -5, {
        yaw: 0.72,
        baseYaw: 0.72,
        tilt: 0.973,
        angle: Math.PI / 8,
        range: 20,
        rotate: -0.26,
        delay: 4,
        onlyBoxIds: ['t3', 't4', 't5', 't6']
      })
    ],
    crates: [],
    lamps: [
      { id: 'dockLamp', origin: [-0.6, 1.5, 1], small: true },
      { id: 'quayLamp', origin: [16.9, 1.5, 1], small: true },
      { id: 'west', origin: [3, 2.4, -5], tall: true },
      { id: 'east', origin: [11, 2.4, -5], tall: true }
    ],
    switches: [],
    wires: [],
    silhouette: 8
  },
  {
    id: 'L13',
    solution: [{ levers: { douse: true } }],
    chapter: 3,
    name: '关灯',
    hint: '前面整条路都白得站不住，因为两盏灯同时照着它。纸闸不会点亮什么——它会掐掉一盏。少一盏光，路才回来。',
    spawn: { x: 1.3, y: 0.56, z: 1.3, boxId: 'porch', face: '+y' },
    goal: { boxId: 'far', face: '+y' },
    focus: [6.4, 0.68, 1.3],
    reveal: { on: 'lever', focus: [6.4, 0.68, 1.3], slowmo: 0.42, hold: 0.8 },
    views: [look('全景', 48, -42, 33), look('长廊', 67, -88, 29)],
    camera: look('全景', 48, -42, 33),
    walls: false,
    boxes: [
      tile('porch', 0, 0, 2.6, 2.6, { h: 0.56 }),
      tile('gate', 2.6, 0, 2.4, 2.6, { h: 0.56 }),
      tile('mid', 5, 0, 2.6, 2.6, { h: 0.56 }),
      tile('span', 7.6, 0, 2.6, 2.6, { h: 0.56 }),
      tile('far', 10.2, 0, 3, 2.6, { role: 'goal', h: 0.56 })
    ],
    lights: [
      lamp('hold', 1.3, 4.6, 1.3, {
        type: 'point',
        range: 9,
        aimable: false,
        onlyBoxIds: ['porch', 'gate']
      }),
      lamp('wash', 8.4, 6.2, 1.3, {
        type: 'point',
        range: 20,
        aimable: false,
        onlyBoxIds: ['mid', 'span', 'far']
      }),
      lamp('glare', 8.4, 5.4, 1.3, {
        type: 'point',
        range: 20,
        aimable: false,
        disabledBy: 'douse',
        onlyBoxIds: ['mid', 'span', 'far']
      })
    ],
    crates: [],
    lamps: [
      { id: 'hold', origin: [-0.55, 1.6, 1.3], small: true },
      { id: 'wash', origin: [8.4, 2.2, -1.6], tall: true },
      { id: 'glare', origin: [11.4, 2.2, -1.6], tall: true }
    ],
    switches: [{ id: 'douse', kind: 'lever', boxId: 'gate', origin: [3.8, 0.84, 1.3] }],
    wires: [{ from: 'douse', to: 'glare' }],
    silhouette: 6
  },
  {
    id: 'L12',
    solution: [{ yaw: { cull: 0 } }],
    chapter: 3,
    name: '影群',
    hint: '两只影兽堵在东头，只有光能烧掉它们。但同一束光扫到中段，那段路会白得站不住——找到只烧兽、不烧路的角度。',
    spawn: { x: 1.2, y: 0.54, z: 1.2, boxId: 'a', face: '+y' },
    goal: { boxId: 'f', face: '+y' },
    focus: [10.8, 0.66, 1.2],
    reveal: { on: 'lamp', focus: [10.8, 0.66, 1.2], slowmo: 0.42, hold: 0.75 },
    views: [look('全景', 47, -40, 38), look('长廊', 68, -88, 33)],
    camera: look('全景', 47, -40, 38),
    walls: false,
    boxes: [
      tile('a', 0, 0, 2.4, 2.4, { h: 0.54 }),
      tile('b', 2.4, 0, 2.4, 2.4, { h: 0.54 }),
      tile('c', 4.8, 0, 2.4, 2.4, { h: 0.54 }),
      tile('d', 7.2, 0, 2.4, 2.4, { h: 0.54 }),
      tile('e', 9.6, 0, 2.4, 2.4, { h: 0.54 }),
      tile('f', 12, 0, 2.4, 2.4, { role: 'goal', h: 0.54 })
    ],
    lights: [
      lamp('keep', 1.2, 4.5, 1.2, {
        type: 'point',
        range: 9,
        aimable: false,
        onlyBoxIds: ['a', 'b']
      }),
      lamp('haze', 7.2, 5, 1.2, {
        type: 'point',
        range: 9,
        aimable: false,
        onlyBoxIds: ['c', 'd']
      }),
      lamp('cull', 12, 6.5, -3, {
        tilt: Math.PI / 4,
        yaw: -Math.PI / 3,
        angle: Math.PI / 11,
        range: 18,
        detents: 15,
        onlyBoxIds: ['c', 'd', 'e', 'f', 'maw', 'maw2']
      })
    ],
    crates: [],
    shadows: [
      { id: 'maw', role: 'shadow', walkable: false, min: [9.8, 0.54, 0.3], max: [11.8, 2.3, 2.1] },
      { id: 'maw2', role: 'shadow', walkable: false, min: [12.2, 0.54, 0.3], max: [14.2, 2.3, 2.1] }
    ],
    lamps: [
      { id: 'keep', origin: [-0.5, 1.7, 1.2], small: true },
      { id: 'haze', origin: [7.2, 1.9, -1.4], small: true },
      { id: 'cull', origin: [12, 2.3, -3], tall: true }
    ],
    switches: [],
    wires: [],
    silhouette: 7
  },
  {
    id: 'L9',
    chapter: 3,
    name: '提灯阶塔',
    hint: '用提灯逐级照亮矮梯，每级高度都在可攀范围内；点亮高处纸符后，屋顶天光开启。',
    spawn: { x: 1.4, y: 0.56, z: 1.4, boxId: 'ground', face: '+y' },
    goal: { boxId: 'roof', face: '+y' },
    focus: [5.1, 1.55, 3.2],
    reveal: { on: 'lit', focus: [5.1, 1.55, 3.2], slowmo: 0.45, hold: 0.6 },
    views: [look('折梯', 43, -52, 33), look('顶视', 70, -89, 31), look('侧影', 27, 7, 31)],
    camera: look('折梯', 43, -52, 33),
    walls: false,
    lantern: true,
    lanternSkip: ['roof'],
    lanternIgnore: [],
    boxes: [
      tile('ground', 0, 0, 3, 3, { h: 0.56 }),
      tile('yard', 3, 0.6, 2, 1.8, { y: 0.22, h: 0.48 }),
      tile('step', 5, 0.6, 1.2, 1.8, { y: 0.22, h: 0.48 }),
      tile('a1', 6.15, 0.55, 1.55, 1.55, { y: 0.38, h: 0.45 }),
      tile('a2', 6.15, 1.95, 1.55, 1.55, { y: 0.8, h: 0.45 }),
      tile('a3', 4.7, 1.95, 1.55, 1.55, { y: 1.22, h: 0.45 }),
      tile('a4', 4.7, 3.35, 1.55, 1.55, { y: 1.64, h: 0.45 }),
      tile('ledge', 6.15, 3.35, 1.75, 1.55, { y: 2.06, h: 0.45 }),
      tile('b1', 7.75, 3.35, 1.55, 1.55, { y: 2.48, h: 0.45 }),
      tile('b2', 7.75, 4.75, 1.55, 1.55, { y: 2.9, h: 0.45 }),
      tile('roof', 5.1, 4.75, 2.8, 2.55, { y: 3.32, h: 0.58, role: 'goal' })
    ],
    lights: [
      lamp('porch', 1.2, 3.5, 1.4, {
        type: 'point',
        range: 4.8,
        aimable: false,
        onlyBoxIds: ['ground', 'yard']
      }),
      lamp('sky', 6.5, 8.8, 6.2, {
        type: 'point',
        range: 8,
        enabled: false,
        power: 'mark',
        aimable: false,
        onlyBoxIds: ['roof']
      })
    ],
    crates: [],
    lamps: [{ id: 'porch', origin: [-0.45, 1.55, 1.4] }, { id: 'sky', origin: [9.7, 3.2, 6.2], tall: true }],
    pickup: { x: 4, y: 0.7, z: 1.5 },
    pickupTo: { boxId: 'yard', face: '+y' },
    switches: [{ id: 'mark', kind: 'lit', boxId: 'ledge', face: '+y', origin: [7, 2.66, 4.1] }],
    wires: [{ from: 'mark', to: 'sky' }],
    silhouette: 8
  },
  {
    id: 'L10',
    solution: [{ yaw: { two: 0.7 }, levers: { sunPad: true } }],
    chapter: 4,
    name: '日蚀终线',
    hint: '安全起点之后依次复习转灯、踏印和三段折路；每完成一步都会留下稳定检查点。',
    spawn: { x: 1.5, y: 0.62, z: 1.5, boxId: 'a', face: '+y' },
    goal: { boxId: 'sun', face: '+y' },
    focus: [4.7, 1.65, 3.45],
    reveal: { on: 'lamp', focus: [4.7, 1.65, 3.45], slowmo: 0.45, hold: 0.6 },
    views: [look('日蚀', 43, -39, 34), look('折线', 68, -89, 31), look('日轮', 30, -28, 36)],
    camera: look('日蚀', 43, -39, 34),
    walls: false,
    ending: true,
    monument: { kind: 'eclipse', origin: [6.2, 6.8, 7.4], radius: 1.5, yaw: -36 },
    boxes: [
      tile('a', 0, 0, 3, 3, { h: 0.62 }),
      tile('b', 2.9, 0.65, 1.8, 1.7, { y: 0.22, h: 0.46 }),
      tile('c', 4.5, 0.65, 2.4, 1.7, { y: 0.44, h: 0.46 }),
      tile('k', 6.7, 0.65, 1.8, 1.7, { y: 0.66, h: 0.46 }),
      tile('d', 6.7, 2.15, 1.8, 2.4, { y: 0.88, h: 0.46 }),
      tile('e', 6.7, 4.35, 1.8, 2, { y: 1.1, h: 0.46 }),
      tile('sun', 3.9, 4.35, 3, 2.6, { y: 1.32, h: 0.58, role: 'goal' }),
      pillar('needle', 5.75, -0.48, { w: 0.78, d: 0.86, h: 3.5, y: 0.9 })
    ],
    lights: [
      lamp('one', 1.5, 5.6, 1.5, {
        type: 'point',
        range: 9,
        aimable: false,
        onlyBoxIds: ['a', 'b']
      }),
      lamp('two', 2.6, 7, -1.6, {
        angle: Math.PI / 7.4,
        range: 16,
        tilt: 0.82,
        yaw: 0.18,
        turn: -1,
        onlyBoxIds: ['c', 'k']
      }),
      lamp('three', 6.2, 8.2, 5.3, {
        type: 'point',
        range: 12,
        enabled: false,
        power: 'sunPad',
        aimable: false,
        onlyBoxIds: ['d', 'e', 'sun']
      })
    ],
    crates: [],
    lamps: [
      { id: 'one', origin: [-0.55, 1.9, 1.5] },
      { id: 'two', origin: [2.6, 2.3, -1.6], tall: true },
      { id: 'three', origin: [9.1, 2.7, 5.45], tall: true }
    ],
    switches: [{ id: 'sunPad', kind: 'plate', boxId: 'k', origin: [7.6, 1.12, 1.5] }],
    wires: [{ from: 'sunPad', to: 'three' }],
    hidden: { x: 5.7, z: 1.5, boxId: 'c' },
    silhouette: 9
  }
];

export function levelIndex(id) {
  return LEVELS.findIndex(level => level.id === id);
}
