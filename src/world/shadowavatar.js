import * as THREE from 'three';
import { createPortraitSprite, PORTRAIT_ASPECT, registerPortraitMaterial } from '../player/portrait.js';

const INK = 0x050607;
const PAPER = 0xf1eee6;

function edge(mesh, opacity = 0.54) {
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 18),
    new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity })
  ));
  return mesh;
}

function setLine(line, a, b) {
  const attribute = line.geometry.getAttribute('position');
  attribute.setXYZ(0, a.x, a.y, a.z);
  attribute.setXYZ(1, b.x, b.y, b.z);
  attribute.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function setRoute(line, points) {
  if (!line) return;
  const values = [];
  for (const point of points) values.push(point.x, point.y, point.z);
  const attribute = line.geometry.getAttribute('position');
  if (!attribute || attribute.count !== points.length) {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry();
    line.geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
  } else {
    points.forEach((point, index) => attribute.setXYZ(index, point.x, point.y, point.z));
    attribute.needsUpdate = true;
  }
  line.geometry.computeBoundingSphere();
}

function setProjection(mesh, start, direction, width, length, rise = 0) {
  if (!mesh) return;
  const forward = new THREE.Vector3(direction.x, 0, direction.z);
  if (forward.lengthSq() < 1e-5) forward.set(0, 0, 1);
  forward.normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const up = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, forward, up));
  // Local y already runs from zero to the full shadow length. Its origin is
  // therefore the player's feet, not the midpoint of the projection.
  mesh.position.copy(start);
  const geometry = mesh.geometry;
  const positions = geometry?.getAttribute('position');
  if (positions?.count === 4) {
    const near = width * 0.62;
    const far = width * 0.9;
    positions.setXYZ(0, -near / 2, 0, 0);
    positions.setXYZ(1, near / 2, 0, 0);
    positions.setXYZ(2, far / 2, length, rise);
    positions.setXYZ(3, -far / 2, length, rise);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  } else {
    mesh.scale.set(width / PORTRAIT_ASPECT, length, 1);
  }
}

function setProjectionPath(mesh, worldPoints, groupPosition, width) {
  if (!mesh || !Array.isArray(worldPoints) || worldPoints.length < 2) return;
  const points = worldPoints.map(point => new THREE.Vector3(...point));
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances[index - 1] + points[index].distanceTo(points[index - 1]));
  }
  const total = Math.max(0.01, distances[distances.length - 1]);
  const positions = [];
  const uvs = [];
  const indices = [];

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = next.clone().sub(previous).setY(0);
    if (tangent.lengthSq() < 1e-5) tangent.set(0, 0, 1);
    tangent.normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const t = distances[index] / total;
    const halfWidth = width * (0.31 + t * 0.14);
    const center = point.clone().sub(groupPosition);
    center.y += 0.022;
    const left = center.clone().addScaledVector(right, -halfWidth);
    const rightPoint = center.clone().addScaledVector(right, halfWidth);
    positions.push(left.x, left.y, left.z, rightPoint.x, rightPoint.y, rightPoint.z);
    const v = 0.075 + t * (0.93 - 0.075);
    uvs.push(0, v, 1, v);
    if (index > 0) {
      const a = (index - 1) * 2;
      const b = a + 1;
      const c = index * 2;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  });

  const geometry = mesh.geometry;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
}

function cutout(points, depth = 0.055) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export function createShadowAvatar() {
  const group = new THREE.Group();
  group.name = 'shadow-avatar';
  group.visible = false;
  group.renderOrder = 9;

  const ink = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  const head = edge(new THREE.Mesh(cutout([
    [-0.1, 0.48], [-0.13, 0.58], [-0.08, 0.7], [0.02, 0.75],
    [0.12, 0.67], [0.1, 0.52], [0.05, 0.47]
  ]), ink.clone()), 0.7);
  head.name = 'shadow-head';

  const body = edge(new THREE.Mesh(cutout([
    [-0.16, 0.48], [-0.1, 0.55], [0.11, 0.55], [0.17, 0.45],
    [0.28, 0.08], [0.11, 0.02], [0, 0.12], [-0.14, 0.02], [-0.27, 0.1]
  ]), ink.clone()), 0.6);
  body.name = 'shadow-body';

  const hair = edge(new THREE.Mesh(cutout([
    [-0.12, 0.63], [-0.23, 0.69], [-0.14, 0.74], [-0.19, 0.8],
    [-0.03, 0.77], [0.05, 0.86], [0.09, 0.76], [0.2, 0.79],
    [0.14, 0.69], [0.06, 0.72]
  ]), ink.clone()), 0.62);
  hair.name = 'shadow-hair';
  hair.position.z = 0.025;

  const left = edge(new THREE.Mesh(cutout([[-0.04, 0.42], [0.06, 0.4], [-0.08, 0.05], [-0.16, 0.05]], 0.04), ink.clone()), 0.46);
  left.name = 'shadow-arm-left';
  left.position.x = -0.12;
  const right = edge(new THREE.Mesh(cutout([[-0.06, 0.4], [0.04, 0.42], [0.17, 0.08], [0.08, 0.04]], 0.04), ink.clone()), 0.46);
  right.name = 'shadow-arm-right';
  right.position.x = 0.12;

  [body, head, hair, left, right].forEach(part => { part.visible = false; });
  const portrait = createPortraitSprite({
    name: 'shadow-portrait',
    size: 1.68,
    color: INK,
    opacity: 0.92,
    visible: false,
    renderOrder: 9
  });
  portrait.position.set(0, 0.01, 0.02);

  // The readable shadow is the same portrait projected onto the paper plane.
  // Keeping the source texture shared makes its contour match the player even
  // as the camera, silhouette progression, or paper lighting changes.
  const projection = new THREE.Mesh(
    // Keep the source figure's portrait aspect instead of stretching it into
    // the old square placeholder. The plane is later elongated along the
    // light direction to form the cast shadow.
    (() => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -0.25, 0, 0, 0.25, 0, 0, 0.25, 1, 0, -0.25, 1, 0
      ], 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
        // Remove the transparent source-image margins so the first visible
        // foot pixel coincides with the physical root of the projection.
        0, 0.075, 1, 0.075, 1, 0.93, 0, 0.93
      ], 2));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      return geometry;
    })(),
    new THREE.MeshBasicMaterial({
      map: portrait.material.map,
      color: INK,
      transparent: true,
      opacity: 0.64,
      alphaTest: 0.025,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true
    })
  );
  registerPortraitMaterial(projection.material);
  projection.name = 'shadow-projection';
  projection.renderOrder = 5;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.27, 0.33, 4),
    new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.name = 'shadow-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.rotation.z = Math.PI / 4;
  ring.position.y = 0.012;

  const tether = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: 0.18, depthWrite: false })
  );
  tether.name = 'shadow-tether';
  tether.renderOrder = 8;

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.405, 4),
    new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
  );
  pulse.name = 'shadow-pulse';
  pulse.rotation.x = -Math.PI / 2;
  pulse.rotation.z = Math.PI / 4;
  pulse.position.y = 0.014;

  const route = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: PAPER, transparent: true, opacity: 0.2, depthWrite: false })
  );
  route.name = 'shadow-route';
  route.renderOrder = 7;

  group.add(route, tether, pulse, ring, projection, body, head, hair, left, right, portrait);
  group.userData = { body, head, hair, left, right, portrait, projection, ring, pulse, tether, route, phase: 0, active: false };
  return group;
}

export function syncShadowAvatar(group, options = {}) {
  if (!group) return;
  const pose = options.pose;
  const visible = !!(options.enabled && pose);
  group.visible = visible;
  if (!visible) return;
  const data = group.userData;
  group.position.set(pose.x, pose.y, pose.z);
  // Child geometry and tether points are expressed in world-aligned local
  // coordinates; rotating the parent would apply the light direction twice.
  group.rotation.y = 0;
  const active = !!options.active;
  const referenceStyle = !!options.referenceStyle;
  const opacity = active ? 0.92 : pose.detached ? 0.52 : 0.24;
  for (const key of ['body', 'head', 'hair', 'left', 'right']) {
    const mesh = data[key];
    if (mesh?.material) mesh.material.opacity = opacity;
    const outline = mesh?.children?.[0];
    if (outline?.material) outline.material.opacity = Math.min(0.86, opacity * 0.82);
  }
  if (data.portrait?.material) {
    // The controllable shadow is the same cutout projected onto the paper.
    // Avoid drawing a second upright avatar at the landing point, which made
    // the silhouette read as a different character from the body.
    data.portrait.material.opacity = 0;
    data.portrait.visible = false;
  }
  const body = options.bodyPosition;
  const pinned = options.pinnedShape;
  const projection = data.projection;
  if (projection) {
    const detached = !!pose.detached;
    const start = pinned?.start
      ? new THREE.Vector3(...pinned.start)
      : body
        ? new THREE.Vector3(body.x, body.y, body.z)
        : new THREE.Vector3(pose.x, pose.y, pose.z);
    const pinnedTip = pinned?.tip ? new THREE.Vector3(...pinned.tip) : null;
    let direction = pinnedTip
      ? pinnedTip.clone().sub(start).setY(0)
      : new THREE.Vector3(pose.x - start.x, 0, pose.z - start.z);
    let distance = Math.hypot(direction.x, direction.z);
    if (distance < 0.05 && Number.isFinite(pose.yaw)) {
      direction.set(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
      distance = 0.9;
    }
    if (distance < 0.05 && options.light?.origin) {
      direction.set(pose.x - options.light.origin[0], 0, pose.z - options.light.origin[2]);
      distance = Math.hypot(direction.x, direction.z);
    }
    if (direction.lengthSq() < 1e-5) direction.set(0, 0, 1);
    direction.normalize();
    const physicalLength = Number.isFinite(Number(pinned?.length))
      ? Number(pinned.length)
      : Number.isFinite(Number(pose.length)) ? Number(pose.length) : distance;
    const length = detached
      ? Math.max(0.18, Math.min(18, physicalLength || distance))
      : Math.max(0.18, Math.min(18, physicalLength || distance));
    const root = start.clone().setY(start.y + 0.022);
    const endY = pinnedTip ? pinnedTip.y : pose.y;
    const width = Number.isFinite(Number(pinned?.width))
      ? Number(pinned.width)
      : 0.58 * Math.min(1.28, 1 + length * 0.045);
    const projectionPath = pinned?.path || pose.path;
    if (Array.isArray(projectionPath) && projectionPath.length >= 2) {
      setProjectionPath(projection, projectionPath, group.position, width);
    } else {
      setProjection(
        projection,
        root.sub(group.position),
        direction,
        width,
        length,
        endY - start.y
      );
    }
    projection.material.opacity = pinned ? 0.88 : detached ? (active ? 0.88 : 0.56) : 0.64;
    // The same textured silhouette remains in world space after pinning. Its
    // vertices are rebuilt from frozen data, so moving the body or lamp cannot
    // alter the pinned contour.
    projection.visible = true;
  }
  if (data.ring) data.ring.visible = !referenceStyle && !pinned;
  if (data.tether) data.tether.visible = !referenceStyle && !pinned;
  if (data.pulse) data.pulse.visible = !referenceStyle && !pinned;
  if (data.ring?.material) data.ring.material.opacity = active ? 0.86 : 0.5;
  if (data.tether?.material) data.tether.material.opacity = active ? 0.34 : 0.13;
  if (data.pulse?.material) data.pulse.material.opacity = active ? 0.24 : 0.08;
  if (data.route?.material) data.route.material.opacity = active ? 0.38 : 0.12;

  const route = options.route || [];
  if (data.route) {
    const points = route.map(item => new THREE.Vector3(item.x - pose.x, item.y - pose.y + 0.012, item.z - pose.z));
    setRoute(data.route, points);
    data.route.visible = !referenceStyle && !pinned && points.length > 1;
  }

  if (body && !pinned) {
    const localStart = new THREE.Vector3(body.x - pose.x, body.y + 0.03 - pose.y, body.z - pose.z);
    const localEnd = new THREE.Vector3(0, 0.03, 0);
    setLine(data.tether, localStart, localEnd);
    // The tether geometry is already in the avatar group's local space.
    data.tether.position.set(0, 0, 0);
  }
}

export function tickShadowAvatar(group, dt, time = 0) {
  if (!group?.visible) return;
  const data = group.userData;
  data.phase = time;
  const pulse = 1 + Math.sin(time * 4.4) * (data.active ? 0.1 : 0.045);
  data.pulse?.scale.setScalar(pulse);
  data.ring?.scale.setScalar(1 + Math.sin(time * 3.1) * (data.active ? 0.055 : 0.02));
}
