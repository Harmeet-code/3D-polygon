import * as THREE from 'three';
import { scene, camera, renderer, PLANE_W, PLANE_H } from './SceneSetup.js';
import { worldToPx, pixelToFabric, worldToFabricLength } from './CoordTransform.js';
import { polylineToCorridor } from './PolylineCorridor.js';

// ── State ────────────────────────────────────────────────────

/** @type {'add-road'|null} */
let mode = null;
/** @type {Array<{points:Array<{x:number,z:number}>, width:number}>} */
let segments = [];
/** @type {Array<{x:number,z:number}>} */
let currentPoints = [];
let currentWidth = 2.0;
/** @type {THREE.Group|null} */
let ghostGroup = null;
let currentDataFn = null;
let currentFloorFn = null;
let toastTimer = null;
let _idCounter = 0;

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();

// ── Helpers ──────────────────────────────────────────────────

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

function buildCorridorMesh(worldPoints, width, color, opacity) {
  const g = new THREE.Group();
  if (worldPoints.length < 2) return g;

  const pts2d = worldPoints.map((/** @type {{x:number,z:number}} */ p) => [p.x, p.z]);
  const corridor = polylineToCorridor(pts2d, width);
  if (corridor.length < 3) return g;

  const wp = corridor.map((pt) => {
    const px = /** @type {number} */ (pt[0]);
    const pz = /** @type {number} */ (pt[1]);
    return { x: px, z: pz };
  });

  // Filled mesh
  const allVerts = [];
  const anchor = /** @type {{x:number,z:number}} */ (wp[0]);
  for (let i = 1; i < wp.length - 1; i++) {
    const a = /** @type {{x:number,z:number}} */ (wp[i]);
    const b = /** @type {{x:number,z:number}} */ (wp[i + 1]);
    allVerts.push(anchor.x, 0.02, anchor.z, a.x, 0.02, a.z, b.x, 0.02, b.z);
  }

  if (allVerts.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    g.add(new THREE.Mesh(geom, mat));
  }

  // Outline
  const linePts = wp.map((p) => new THREE.Vector3(p.x, 0.025, p.z));
  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(1, opacity * 1.5)
  });
  g.add(new THREE.LineLoop(lineGeom, lineMat));

  return g;
}

function buildGhost() {
  if (ghostGroup) {
    scene.remove(ghostGroup);
    ghostGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    ghostGroup = null;
  }
  if (!mode) return;

  ghostGroup = new THREE.Group();

  // Completed segments — dark translucent
  for (const seg of segments) {
    if (seg.points.length >= 2) {
      const m = buildCorridorMesh(seg.points, seg.width, 0x2a2a2a, 0.3);
      ghostGroup.add(m);
    }
  }

  // Current segment — blue translucent
  if (currentPoints.length >= 2) {
    const m = buildCorridorMesh(currentPoints, currentWidth, 0x44aaff, 0.25);
    ghostGroup.add(m);
  }

  // Points — small spheres
  const pointMat = new THREE.MeshBasicMaterial({ color: 0x88ddff });
  const pointGeom = new THREE.SphereGeometry(0.15, 8, 8);
  for (const p of currentPoints) {
    const sphere = new THREE.Mesh(pointGeom, pointMat);
    sphere.position.set(p.x, 0.02, p.z);
    ghostGroup.add(sphere);
  }
  // Completed segment points — darker
  const doneMat = new THREE.MeshBasicMaterial({ color: 0x557788 });
  for (const seg of segments) {
    for (const p of seg.points) {
      const sphere = new THREE.Mesh(pointGeom, doneMat);
      sphere.position.set(p.x, 0.02, p.z);
      ghostGroup.add(sphere);
    }
  }

  // Centerline for current segment
  if (currentPoints.length >= 2) {
    const linePts = currentPoints.map(
      (/** @type {{x:number,z:number}} */ p) => new THREE.Vector3(p.x, 0.03, p.z)
    );
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x88ddff });
    ghostGroup.add(new THREE.Line(lineGeom, lineMat));
  }

  scene.add(ghostGroup);
}

// ── Public API ───────────────────────────────────────────────

export function initRoadEditor(getData, getFloor) {
  currentDataFn = getData;
  currentFloorFn = getFloor;
}

export function setMode(newMode) {
  if (mode === newMode) {
    cancelRoads();
    return false;
  }
  cancelRoads();
  mode = newMode;
  currentPoints = [];
  segments = [];
  _idCounter = 0;
  renderer.domElement.style.cursor = 'crosshair';
  updateUI();
  return true;
}

export function getMode() {
  return mode;
}

export function setWidth(val) {
  currentWidth = val;
  if (currentPoints.length >= 2) buildGhost();
  updateUI();
}

export function addPoint(wx, wz) {
  if (!mode) return;
  currentPoints.push({ x: wx, z: wz });
  buildGhost();
  updateUI();
}

export function finishSegment() {
  if (!mode) return;
  if (currentPoints.length < 2) return;
  segments.push({
    points: currentPoints.slice(),
    width: currentWidth
  });
  currentPoints = [];
  buildGhost();
  updateUI();
}

export function undoLastPoint() {
  if (currentPoints.length > 0) {
    currentPoints.pop();
    buildGhost();
    updateUI();
  }
}

export function applyRoads() {
  const data = currentDataFn ? currentDataFn() : null;
  const floorName = currentFloorFn ? currentFloorFn() : null;
  if (!data || !floorName) return;

  // Include current unfinished segment if it has 2+ points
  const allSegments = segments.slice();
  if (currentPoints.length >= 2) {
    allSegments.push({
      points: currentPoints.slice(),
      width: currentWidth
    });
  }

  if (allSegments.length === 0) {
    showToast('Draw at least one road segment first');
    return;
  }

  const entries = allSegments.map((seg) => {
    _idCounter++;
    const fabricPts = seg.points.map((/** @type {{x:number,z:number}} */ wp) => {
      const { px, py } = worldToPx(wp.x, wp.z);
      const { x, y } = pixelToFabric(px, py);
      return [Math.round(x), Math.round(y)];
    });
    const fabricWidth = Math.round(worldToFabricLength(seg.width));
    return {
      id: 'road-' + _idCounter,
      points: fabricPts,
      width: fabricWidth
    };
  });

  const jsonStr =
    '// Add these entries to meta.roads[] in ' +
    floorName +
    '.json\n' +
    JSON.stringify(entries, null, 2);

  navigator.clipboard
    .writeText(jsonStr)
    .then(() => {
      showToast('Road JSON copied. Paste into the floor file.');
    })
    .catch(() => {
      showToast('Failed to copy');
    });
}

export function cancelRoads() {
  if (ghostGroup) {
    scene.remove(ghostGroup);
    ghostGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    ghostGroup = null;
  }
  currentPoints = [];
  segments = [];
  _idCounter = 0;
  mode = null;
  renderer.domElement.style.cursor = '';
  updateUI();
}

export function handleMouseMove(_event) {
  // Reserved for cursor-track preview
}

export function handleClick(event) {
  if (mode !== 'add-road') return false;
  const pt = getFloorPosition(event);
  if (!pt) return false;
  addPoint(pt.x, pt.z);
  return true;
}

export function handleRightClick(event) {
  if (mode !== 'add-road') return false;
  event.preventDefault();
  finishSegment();
  return true;
}

function updateUI() {
  const statusEl = document.getElementById('roadEditorStatus');
  if (!statusEl) return;
  if (mode === 'add-road') {
    const n = currentPoints.length;
    const segN = segments.length;
    const total = segN + (n >= 2 ? 1 : 0);
    statusEl.textContent =
      segN +
      ' segment(s) drawn, ' +
      n +
      ' point(s) current. Left-click add point, right-click finish segment. Total: ' +
      total +
      ' road(s).';
    statusEl.style.color = 'var(--accent)';
  } else {
    statusEl.textContent = '';
  }

  const applyBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('roadApplyBtn'));
  const cancelBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('roadCancelBtn')
  );
  const undoBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('roadUndoBtn'));
  const widthSlider = /** @type {HTMLInputElement|null} */ (
    document.getElementById('roadWidthSlider')
  );
  const widthVal = document.getElementById('roadWidthVal');
  const totalRoads = segments.length + (currentPoints.length >= 2 ? 1 : 0);
  if (applyBtn) applyBtn.disabled = !mode || totalRoads === 0;
  if (cancelBtn) cancelBtn.disabled = !mode;
  if (undoBtn) undoBtn.disabled = !mode || currentPoints.length === 0;
  if (widthSlider) widthSlider.disabled = !mode;
  if (widthVal) widthVal.textContent = mode ? currentWidth.toFixed(1) : '';
}

function showToast(msg) {
  let toast = document.getElementById('roadToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'roadToast';
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
