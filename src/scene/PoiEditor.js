import * as THREE from 'three';
import { scene, camera, renderer, PLANE_W, PLANE_H } from './SceneSetup.js';
import { worldToPx, pixelToFabric } from './CoordTransform.js';

// ── State ────────────────────────────────────────────────────

/** @type {'add-stair'|'add-entrance'|'remove'|null} */
let mode = null;
/** @type {THREE.Group|null} */
let ghostGroup = null;
/** @type {{x:number,z:number}|null} */
let ghostWorldPos = null;
let ghostRotationDeg = 0;
/** @type {{x:number,z:number}|null} */
let placedPos = null;
/** @type {{id:string, type:string}|null} */
let selectedPoi = null;

let currentDataFn = null;
let currentFloorFn = null;
let placedCounter = 0;
let toastTimer = null;

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

// ── Ghost Builders ───────────────────────────────────────────

function makeGhostMat(color, opacity) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 0.5,
    metalness: 0.1
  });
}

function buildGhostStair(rotDeg) {
  const g = new THREE.Group();
  const mat = makeGhostMat(0x44aaff, 0.5);

  const stepW = 2.8,
    stepD = 0.7,
    stepH = 0.22,
    n = 10;
  const totalH = n * stepH;

  // Steps as stacked boxes
  for (let i = 0; i < n; i++) {
    const y = i * stepH;
    const z = -i * stepD;
    const box = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), mat);
    box.position.set(0, y + stepH / 2, z);
    g.add(box);
  }

  // Side stringers
  const strMat = makeGhostMat(0x2266cc, 0.35);
  for (const side of [-1, 1]) {
    const sx = side * (stepW / 2 + 0.12);
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.1);
    shape.lineTo(0, 0);
    for (let i = 0; i < n; i++) {
      const xs = side * (-i * stepD);
      shape.lineTo(xs, i * stepH);
      shape.lineTo(xs, i * stepH + stepH);
    }
    shape.lineTo(side * (-(n - 1) * stepD - stepD), n * stepH);
    shape.lineTo(side * (-(n - 1) * stepD - stepD), -0.1);
    shape.closePath();
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    const m = new THREE.Mesh(geom, strMat);
    m.position.set(sx, 0, 0);
    m.rotation.y = (Math.PI / 2) * -side;
    m.position.z = -0.04;
    g.add(m);
  }

  // Handrail edges (simplified as lines)
  const lineMat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
  for (const side of [-1, 1]) {
    const sx = side * (stepW / 2 + 0.2);
    const pts = [new THREE.Vector3(sx, totalH + 1.0, 0)];
    for (let i = 0; i <= n - 1; i++) {
      pts.push(new THREE.Vector3(sx, totalH + 1.0, -i * stepD));
    }
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lineGeom, lineMat);
    g.add(line);
  }

  // Landing platform
  const landMat = makeGhostMat(0x44aaff, 0.3);
  const landing = new THREE.Mesh(new THREE.BoxGeometry(stepW + 0.3, 0.08, stepD), landMat);
  landing.position.set(0, totalH, -(n - 1) * stepD - stepD / 2);
  g.add(landing);

  // Direction arrow on floor
  const arrowMat = new THREE.LineBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.7
  });
  const arrowPts = [new THREE.Vector3(0, 0.01, 1.5), new THREE.Vector3(0, 0.01, -1.0)];
  const arrowGeom = new THREE.BufferGeometry().setFromPoints(arrowPts);
  const arrowLine = new THREE.Line(arrowGeom, arrowMat);
  g.add(arrowLine);
  // Arrowhead
  const headPts = [
    new THREE.Vector3(0, 0.01, -1.0),
    new THREE.Vector3(0.3, 0.01, -0.3),
    new THREE.Vector3(-0.3, 0.01, -0.3),
    new THREE.Vector3(0, 0.01, -1.0)
  ];
  const headGeom = new THREE.BufferGeometry().setFromPoints(headPts);
  const headLine = new THREE.Line(headGeom, arrowMat);
  g.add(headLine);

  // Floor disc
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.5, 24), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.005;
  g.add(disc);

  g.rotation.y = THREE.MathUtils.degToRad(rotDeg);
  return g;
}

function buildGhostEntrance(rotDeg) {
  const g = new THREE.Group();
  const mat = makeGhostMat(0xffd700, 0.4);
  const matDark = makeGhostMat(0xcc9900, 0.25);

  const pillarW = 0.35,
    pillarD = 0.35,
    pillarH = 3.2;
  const beamH = 0.4,
    beamD = 0.5,
    openingW = 2.2;
  const totalW = openingW + 2 * pillarW;

  // Base
  const baseBox = new THREE.Mesh(new THREE.BoxGeometry(totalW + 0.6, 0.1, pillarD + 0.8), matDark);
  baseBox.position.set(0, 0.05, 0);
  g.add(baseBox);

  // Pillars
  const pillarGeom = new THREE.BoxGeometry(pillarW, pillarH, pillarD);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pillarGeom, mat);
    p.position.set(side * (openingW / 2 + pillarW / 2), pillarH / 2, 0);
    g.add(p);
  }

  // Beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(totalW + 0.3, beamH, beamD), mat);
  beam.position.set(0, pillarH + beamH / 2, 0);
  g.add(beam);

  // Arch outline as line
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6 });
  const halfW = openingW / 2;
  const archH = 1.0;
  const pts = [];
  const segments = 16;
  pts.push(new THREE.Vector3(-halfW, 0, pillarD / 2 + 0.02));
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = Math.PI * t;
    pts.push(
      new THREE.Vector3(
        Math.cos(angle) * halfW,
        Math.sin(angle) * archH + (pillarH - archH),
        pillarD / 2 + 0.02
      )
    );
  }
  pts.push(new THREE.Vector3(halfW, 0, pillarD / 2 + 0.02));
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(lineGeom, lineMat);
  g.add(line);

  // Floor disc
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.005;
  g.add(disc);

  g.rotation.y = THREE.MathUtils.degToRad(rotDeg);
  return g;
}

// ── Ghost Placement ──────────────────────────────────────────

function getFloorPosition(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouseVec.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseVec.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const pt = new THREE.Vector3();
  const hit = raycaster.ray.intersectPlane(floorPlane, pt);
  if (!hit) return null;
  const halfW = PLANE_W / 2;
  const halfH = PLANE_H / 2;
  if (pt.x < -halfW || pt.x > halfW || pt.z < -halfH || pt.z > halfH) return null;
  return pt;
}

function rebuildGhost() {
  if (ghostGroup) {
    scene.remove(ghostGroup);
    ghostGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    ghostGroup = null;
  }
  if (!mode || !ghostWorldPos) return;
  const buildFn = mode === 'add-stair' ? buildGhostStair : buildGhostEntrance;
  ghostGroup = buildFn(ghostRotationDeg);
  ghostGroup.position.set(ghostWorldPos.x, 0, ghostWorldPos.z);
  scene.add(ghostGroup);
}

// ── Public API ───────────────────────────────────────────────

export function initPoiEditor(getData, getFloor) {
  currentDataFn = getData;
  currentFloorFn = getFloor;
}

export function setMode(newMode) {
  if (mode === newMode) {
    cancelPlacement();
    return false;
  }
  cancelPlacement();
  mode = newMode;
  placedPos = null;
  selectedPoi = null;
  placedCounter = 0;
  if (mode) {
    renderer.domElement.style.cursor = mode === 'remove' ? 'pointer' : 'crosshair';
  } else {
    renderer.domElement.style.cursor = '';
  }
  updateUI();
  return true;
}

export function getMode() {
  return mode;
}

export function setRotation(deg) {
  ghostRotationDeg = deg;
  if (ghostGroup) {
    ghostGroup.rotation.y = THREE.MathUtils.degToRad(deg);
  }
}

export function applyPlacement() {
  const data = currentDataFn ? currentDataFn() : null;
  const floorName = currentFloorFn ? currentFloorFn() : null;
  if (!data || !floorName) return;

  if (mode === 'remove' && selectedPoi) {
    const actionStr = `// In ${floorName}.json, remove the entry with id "${selectedPoi.id}" from meta.${selectedPoi.type === 'stair' ? 'stairs' : 'entrances'}
{
  "_action": "remove",
  "_targetFile": "${floorName}",
  "_targetId": "${selectedPoi.id}",
  "_targetArray": "${selectedPoi.type === 'stair' ? 'stairs' : 'entrances'}"
}`;
    navigator.clipboard
      .writeText(actionStr)
      .then(() => {
        showToast('Removal JSON copied to clipboard');
      })
      .catch(() => {
        showToast('Failed to copy');
      });
    cancelPlacement();
    return;
  }

  if (!placedPos && mode && mode !== 'remove') {
    showToast('Click on the floor to place first');
    return;
  }
  if (!mode || mode === 'remove') return;

  const wp = placedPos || ghostWorldPos;
  if (!wp) {
    showToast('Move mouse over the floor');
    return;
  }

  const { px, py } = worldToPx(wp.x, wp.z);
  const { x: fx, y: fy } = pixelToFabric(px, py);
  const rot = ghostRotationDeg;

  placedCounter++;
  const label = `${mode === 'add-stair' ? 'Staircase' : 'Entrance'} ${placedCounter}`;
  const id = `${mode === 'add-stair' ? 'stair' : 'entrance'}-placed-${placedCounter}`;

  let jsonStr;
  if (mode === 'add-stair') {
    jsonStr = `// Add this entry to meta.stairs[] in ${floorName}.json
{
  "id": "${id}",
  "label": "${label}",
  "connects": [],
  "position": { "x": ${fx.toFixed(1)}, "y": ${fy.toFixed(1)} },
  "type": "staircase",
  "rotation": ${rot.toFixed(1)}
}`;
  } else {
    jsonStr = `// Add this entry to meta.entrances[] in ${floorName}.json
{
  "id": "${id}",
  "label": "${label}",
  "position": { "x": ${fx.toFixed(1)}, "y": ${fy.toFixed(1)} },
  "rotation": ${rot.toFixed(1)}
}`;
  }

  navigator.clipboard
    .writeText(jsonStr)
    .then(() => {
      showToast('JSON copied to clipboard. Paste into the floor file.');
    })
    .catch(() => {
      showToast('Failed to copy');
    });
}

export function cancelPlacement() {
  if (ghostGroup) {
    scene.remove(ghostGroup);
    ghostGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    ghostGroup = null;
  }
  ghostWorldPos = null;
  placedPos = null;
  selectedPoi = null;
  mode = null;
  renderer.domElement.style.cursor = '';
  updateUI();
}

export function handleMouseMove(event) {
  if (!mode || mode === 'remove') return;
  const pt = getFloorPosition(event);
  if (pt) {
    ghostWorldPos = { x: pt.x, z: pt.z };
    if (!placedPos) {
      rebuildGhost();
    } else if (ghostGroup) {
      // Ghost stays at placed position but we still track mouse for info
    }
  }
}

export function handleClick(event) {
  if (!mode) return false;
  if (mode !== 'remove') {
    const pt = getFloorPosition(event);
    if (!pt) return false;
    if (!placedPos) {
      // First click: lock position
      placedPos = { x: pt.x, z: pt.z };
      ghostWorldPos = placedPos;
      rebuildGhost();
      updateUI();
      return true;
    }
    // Already placed — ignore subsequent clicks
    return true;
  }
  return false;
}

export function selectPoiForRemoval(id, type) {
  selectedPoi = { id, type };
  updateUI();
}

export function getSelectedPoi() {
  return selectedPoi;
}

function updateUI() {
  const statusEl = document.getElementById('poiEditorStatus');
  if (!statusEl) return;
  if (mode === 'add-stair') {
    statusEl.textContent = placedPos
      ? 'Position locked. Rotate with slider, then Apply.'
      : 'Click on the floor to place staircase.';
    statusEl.style.color = 'var(--accent)';
  } else if (mode === 'add-entrance') {
    statusEl.textContent = placedPos
      ? 'Position locked. Rotate with slider, then Apply.'
      : 'Click on the floor to place entrance.';
    statusEl.style.color = 'var(--accent)';
  } else if (mode === 'remove') {
    if (selectedPoi) {
      statusEl.textContent = `Selected: ${selectedPoi.id}. Click Apply to copy removal JSON.`;
      statusEl.style.color = 'var(--bad)';
    } else {
      statusEl.textContent = 'Click a stair or entrance in the scene to mark for removal.';
      statusEl.style.color = 'var(--bad)';
    }
  } else {
    statusEl.textContent = '';
  }

  const applyBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('poiApplyBtn'));
  const cancelBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('poiCancelBtn'));
  const rotSlider = /** @type {HTMLInputElement|null} */ (document.getElementById('poiRotSlider'));
  const rotVal = document.getElementById('poiRotVal');
  if (applyBtn) applyBtn.disabled = !mode;
  if (cancelBtn) cancelBtn.disabled = !mode;
  if (rotSlider) rotSlider.disabled = !mode || mode === 'remove';
  if (rotVal) rotVal.textContent = mode === 'remove' ? '' : `${ghostRotationDeg.toFixed(0)}\u00b0`;
}

function showToast(msg) {
  let toast = document.getElementById('poiToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'poiToast';
    toast.style.cssText =
      'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:12px;background:rgba(0,0,0,.82);color:#fff;font-size:13px;z-index:999;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.12);transition:opacity .3s;pointer-events:none';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 3000);
}

// ── Export state for Interaction.js ──────────────────────────

export function getGhostWorldPos() {
  return ghostWorldPos;
}
