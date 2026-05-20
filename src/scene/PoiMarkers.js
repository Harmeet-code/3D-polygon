import * as THREE from 'three';
import { scene } from './SceneSetup.js';
import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { flyTo } from '../ui/Sidebar.js';

/** @type {THREE.Group | null} */
let poiGroup = null;
/** @type {THREE.Object3D[]} */
export const poiMeshes = [];

// ── Staircase Builder ────────────────────────────────────────

function buildStaircase(wx, wz, rotDeg) {
  const group = new THREE.Group();
  const matConcrete = new THREE.MeshStandardMaterial({
    color: 0x9a9a9a,
    roughness: 0.85,
    metalness: 0.05,
  });
  const matRiser = new THREE.MeshStandardMaterial({
    color: 0x6a6a6a,
    roughness: 0.9,
    metalness: 0.05,
  });
  const matMetal = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.4,
    metalness: 0.7,
  });
  const stepW = 2.8;
  const stepD = 0.7;
  const stepH = 0.22;
  const n = 10;
  const totalRise = n * stepH;

  // Common click target for the whole staircase (invisible box at center)
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(stepW + 0.6, totalRise, stepD * n + 0.6),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.set(0, totalRise / 2, (-stepD * (n - 1)) / 2);

  // Steps
  for (let i = 0; i < n; i++) {
    const y = i * stepH;
    const z = -i * stepD;

    // Riser
    const riser = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, 0.03), matRiser);
    riser.position.set(0, y + stepH / 2, z - stepD / 2);
    group.add(riser);

    // Tread slab
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(stepW, 0.04, stepD),
      i === 0 ? matConcrete : matRiser,
    );
    tread.position.set(0, y + stepH, z);
    group.add(tread);

    // Tread top surface (slightly lighter)
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(stepW - 0.04, 0.02, stepD - 0.04),
      matConcrete,
    );
    top.position.set(0, y + stepH + 0.02, z);
    group.add(top);
  }

  // Side stringers
  for (const side of [-1, 1]) {
    const sx = side * (stepW / 2 + 0.12);
    // Create stringer profile as a shape
    const shape = new THREE.Shape();
    const pts = [
      [0, -0.1],
      [0, 0],
    ];
    for (let i = 0; i < n; i++) {
      const xs = side * (-i * stepD);
      pts.push([xs, i * stepH]);
      pts.push([xs, i * stepH + stepH]);
    }
    pts.push([side * (-(n - 1) * stepD - stepD), n * stepH]);
    pts.push([side * (-(n - 1) * stepD - stepD), -0.1]);

    const first = /** @type {[number, number]} */ (pts[0]);
    shape.moveTo(first[0], first[1]);
    for (let k = 1; k < pts.length; k++) {
      const p = /** @type {[number, number]} */ (pts[k]);
      shape.lineTo(p[0], p[1]);
    }
    shape.closePath();

    const extSettings = { depth: 0.08, bevelEnabled: false };
    const geom = new THREE.ExtrudeGeometry(shape, extSettings);
    const stringer = new THREE.Mesh(geom, matConcrete);
    stringer.position.set(sx, 0, 0);
    stringer.rotation.y = (Math.PI / 2) * -side;
    stringer.position.z = -0.04;
    group.add(stringer);
  }

  // Handrails
  const railH = 1.0;
  const railY = totalRise + railH;
  for (const side of [-1, 1]) {
    const sx = side * (stepW / 2 + 0.2);

    // Top rail (follows the slope)
    const railShape = new THREE.Shape();
    railShape.moveTo(0, railY);
    railShape.lineTo(-(n - 1) * stepD, railY);
    const railPath = new THREE.Path();
    railPath.moveTo(0, railY);
    railPath.lineTo(-(n - 1) * stepD, railY);
    const railPts = railPath.getPoints(20);
    const railGeom = new THREE.BufferGeometry().setFromPoints(
      railPts.map((p) => new THREE.Vector3(p.x, p.y, 0)),
    );
    const railLine = new THREE.Line(
      railGeom,
      new THREE.LineBasicMaterial({ color: 0x999999, linewidth: 1 }),
    );
    railLine.position.set(sx, 0, 0);
    group.add(railLine);

    // Balusters at each step
    for (let i = 0; i < n; i++) {
      const by = i * stepH;
      const bz = -i * stepD;
      const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, railH, 6), matMetal);
      baluster.position.set(sx, by + railH / 2, bz);
      group.add(baluster);
    }
  }

  // Landing platform at top
  const landMat = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a,
    roughness: 0.85,
    metalness: 0.05,
  });
  const landing = new THREE.Mesh(new THREE.BoxGeometry(stepW + 0.3, 0.08, stepD), landMat);
  landing.position.set(0, totalRise, -(n - 1) * stepD - stepD / 2);
  group.add(landing);

  group.add(hitBox);
  group.position.set(wx, 0, wz);

  // Apply rotation (degrees). Default 0 = facing negative Z.
  if (rotDeg) {
    group.rotation.y = THREE.MathUtils.degToRad(rotDeg);
  }

  return { group, hitBox };
}

// ── Door / Entrance Builder ─────────────────────────────────

function buildEntrance(wx, wz, rotDeg) {
  const group = new THREE.Group();

  const matStone = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.8,
    metalness: 0.05,
  });
  const matStoneDark = new THREE.MeshStandardMaterial({
    color: 0x999999,
    roughness: 0.85,
    metalness: 0.05,
  });
  const matGlow = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });

  const pillarW = 0.35;
  const pillarD = 0.35;
  const pillarH = 3.2;
  const beamH = 0.4;
  const beamD = 0.5;
  const openingW = 2.2;
  const totalW = openingW + 2 * pillarW;

  // Common click target
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(totalW + 0.3, pillarH + beamH + 0.3, pillarD + 0.3),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.set(0, (pillarH + beamH) / 2, 0);

  // Base platform
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(totalW + 0.6, 0.1, pillarD + 0.8),
    matStoneDark,
  );
  base.position.set(0, 0.05, 0);
  group.add(base);

  // Left pillar
  const pillarGeom = new THREE.BoxGeometry(pillarW, pillarH, pillarD);
  const leftPillar = new THREE.Mesh(pillarGeom, matStone);
  leftPillar.position.set(-openingW / 2 - pillarW / 2, pillarH / 2, 0);
  group.add(leftPillar);

  // Pillar fluting (vertical grooves)
  for (const side of [-1, 1]) {
    for (let f = -1; f <= 1; f += 2) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.02, pillarH * 0.8, 0.02), matStoneDark);
      groove.position.set(side * (openingW / 2 + pillarW / 2) + f * 0.08, pillarH * 0.6, 0);
      group.add(groove);
    }
  }

  // Right pillar
  const rightPillar = new THREE.Mesh(pillarGeom, matStone);
  rightPillar.position.set(openingW / 2 + pillarW / 2, pillarH / 2, 0);
  group.add(rightPillar);

  // Pillar capitals (decorative top)
  const capGeom = new THREE.BoxGeometry(pillarW + 0.08, 0.12, pillarD + 0.08);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(capGeom, matStoneDark);
    cap.position.set(side * (openingW / 2 + pillarW / 2), pillarH, 0);
    group.add(cap);
  }

  // Horizontal beam (entablature)
  const beamGeom = new THREE.BoxGeometry(totalW + 0.3, beamH, beamD);
  const beam = new THREE.Mesh(beamGeom, matStone);
  beam.position.set(0, pillarH + beamH / 2, 0);
  group.add(beam);

  // Beam decorative band
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(totalW - 0.2, 0.06, beamD + 0.04),
    matStoneDark,
  );
  band.position.set(0, pillarH + beamH * 0.75, 0);
  group.add(band);

  // Arch ring inside the opening
  const archShape = new THREE.Shape();
  const halfW = openingW / 2;
  const archH = 1.0;
  archShape.moveTo(-halfW, 0);
  archShape.lineTo(-halfW, pillarH - archH);
  archShape.quadraticCurveTo(-halfW, pillarH, 0, pillarH);
  archShape.quadraticCurveTo(halfW, pillarH, halfW, pillarH - archH);
  archShape.lineTo(halfW, 0);
  archShape.lineTo(-halfW, 0);

  const archGeom = new THREE.ShapeGeometry(archShape);
  const archFill = new THREE.Mesh(archGeom, matGlow);
  archFill.position.set(0, 0, pillarD / 2 + 0.01);
  group.add(archFill);

  // Back arch fill (same glow on back side)
  const archBack = new THREE.Mesh(archGeom, matGlow);
  archBack.position.set(0, 0, -pillarD / 2 - 0.01);
  group.add(archBack);

  // Arch outline (visible edge) - front
  const arcPts = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = Math.PI * t;
    const ax = Math.cos(angle) * halfW;
    const ay = Math.sin(angle) * archH + (pillarH - archH);
    arcPts.push(new THREE.Vector3(ax, ay, pillarD / 2 + 0.02));
  }
  // Vertical edges
  arcPts.unshift(new THREE.Vector3(-halfW, 0, pillarD / 2 + 0.02));
  arcPts.push(new THREE.Vector3(halfW, 0, pillarD / 2 + 0.02));

  const arcLineGeom = new THREE.BufferGeometry().setFromPoints(arcPts);
  const arcLine = new THREE.Line(arcLineGeom, new THREE.LineBasicMaterial({ color: 0xffd700 }));
  group.add(arcLine);

  // Back arch outline
  const arcPtsBack = arcPts.map((p) => new THREE.Vector3(p.x, p.y, -pillarD / 2 - 0.02));
  const arcBackGeom = new THREE.BufferGeometry().setFromPoints(arcPtsBack);
  const arcBackLine = new THREE.Line(arcBackGeom, new THREE.LineBasicMaterial({ color: 0xffd700 }));
  group.add(arcBackLine);

  // Threshold step
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(openingW + 0.2, 0.08, pillarD + 0.2),
    matStoneDark,
  );
  threshold.position.set(0, 0.1, 0);
  group.add(threshold);

  // Sign / nameplate above beam
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(totalW - 0.4, 0.25, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.2 }),
  );
  sign.position.set(0, pillarH + beamH + 0.15, beamD / 2 + 0.025);
  group.add(sign);

  // Glowing sign border
  const signBorder = new THREE.EdgesGeometry(new THREE.BoxGeometry(totalW - 0.4, 0.25, 0.05));
  const signLine = new THREE.LineSegments(
    signBorder,
    new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5 }),
  );
  signLine.position.copy(sign.position);
  group.add(signLine);

  group.add(hitBox);
  group.position.set(wx, 0, wz);
  if (rotDeg) {
    group.rotation.y = THREE.MathUtils.degToRad(rotDeg);
  }

  return { group, hitBox };
}

// ── Public API ───────────────────────────────────────────────

export function buildPoiMarkers(data) {
  clearPoiMarkers();
  poiGroup = new THREE.Group();
  poiGroup.renderOrder = 6;

  // Stair markers
  const stairs = data.meta.stairs || [];
  for (const s of stairs) {
    if (!s.position) {continue;}
    const { px, py } = fabricToPixel(s.position.x, s.position.y);
    const { x, z } = pxToWorld(px, py);

    const { group, hitBox } = buildStaircase(x, z, s.rotation);
    hitBox.userData.poiType = 'stair';
    hitBox.userData.poiId = s.id;
    hitBox.userData.poiLabel = s.label || s.id;
    hitBox.userData.poiInfo = `Stair: ${s.label || s.id} | Type: ${s.type || 'staircase'} | Connects: ${(s.connects || []).join(', ')}`;
    poiMeshes.push(hitBox);
    poiGroup.add(group);
  }

  // Entrance markers
  const entrances = data.meta.entrances || [];
  for (const e of entrances) {
    if (!e.position) {continue;}
    const { px, py } = fabricToPixel(e.position.x, e.position.y);
    const { x, z } = pxToWorld(px, py);

    const { group, hitBox } = buildEntrance(x, z, e.rotation);
    hitBox.userData.poiType = 'entrance';
    hitBox.userData.poiId = e.id;
    hitBox.userData.poiLabel = e.label || e.id;
    hitBox.userData.poiInfo = `Entrance: ${e.label || e.id}${e.description ? ` | ${  e.description}` : ''}`;
    poiMeshes.push(hitBox);
    poiGroup.add(group);
  }

  scene.add(poiGroup);
}

export function clearPoiMarkers() {
  poiMeshes.length = 0;
  if (poiGroup) {
    scene.remove(poiGroup);
    poiGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) {c.geometry.dispose();}
      if (c.material) {c.material.dispose();}
    });
    poiGroup = null;
  }
}

// ── Route Stair Highlight ────────────────────────────────────

/** @type {THREE.Mesh | null} */
let routeStairRing = null;

/** Highlight the stair used for multi-floor route transition with pulsing ring. */
export function highlightRouteStair(stairId, data) {
  clearRouteStairHighlight();
  const stair = (data.meta.stairs || []).find((/** @type {{id:string}} */ s) => s.id === stairId);
  if (!stair || !stair.position) {return;}
  const { px, py } = fabricToPixel(stair.position.x, stair.position.y);
  const { x, z } = pxToWorld(px, py);

  const ringGeom = new THREE.RingGeometry(1.5, 2.0, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  routeStairRing = new THREE.Mesh(ringGeom, ringMat);
  routeStairRing.position.set(x, 0.06, z);
  routeStairRing.rotation.x = -Math.PI / 2;
  routeStairRing.userData._pulseTime = 0;
  scene.add(routeStairRing);
}

export function clearRouteStairHighlight() {
  if (routeStairRing) {
    scene.remove(routeStairRing);
    routeStairRing.geometry.dispose();
    const mat = /** @type {THREE.Material} */ (routeStairRing.material);
    mat.dispose();
    routeStairRing = null;
  }
}

/** Animate pulsing ring (call from render loop). */
export function updateRouteStairPulse() {
  if (!routeStairRing) {return;}
  const t = performance.now() * 0.003;
  const scale = 1 + 0.2 * Math.sin(t);
  routeStairRing.scale.set(scale, scale, 1);
  const mat = /** @type {THREE.MeshBasicMaterial} */ (routeStairRing.material);
  mat.opacity = 0.3 + 0.3 * Math.sin(t + 1);
}

/** Handle click on a POI marker. Returns true if a POI was hit. */
export function handlePoiClick(intersects) {
  for (const hit of intersects) {
    const obj = hit.object;
    if (obj.userData.poiType) {
      const info = obj.userData.poiInfo;
      if (info) {alert(info);}
      const pos = obj.position;
      flyTo(new THREE.Vector3(pos.x + 15, 15, pos.z + 15), pos.clone(), 600);
      return true;
    }
  }
  return false;
}
