import * as THREE from 'three';
import {
  fabricToPixel,
  pxToWorld,
  worldToPx,
  pixelToFabric,
  offXEl,
  offYEl,
  scXEl,
  scYEl,
  fb,
  baseScaleX,
  baseScaleY,
} from '../scene/CoordTransform.js';
import { IMG_W, IMG_H, scene, boothGroup } from '../scene/SceneSetup.js';
import { buildBooths } from '../scene/BoothBuilder.js';

const debugSelect = /** @type {HTMLInputElement} */ (document.getElementById('debugSelect'));
const debugOverlayToggle = /** @type {HTMLInputElement} */ (
  document.getElementById('debugOverlayToggle')
);
const debugShowOrigin = /** @type {HTMLInputElement} */ (
  document.getElementById('debugShowOrigin')
);
const debugStatus = /** @type {HTMLElement} */ (document.getElementById('debugStatus'));
const debugAspect = /** @type {HTMLElement} */ (document.getElementById('debugAspect'));
const debugRef = /** @type {HTMLElement} */ (document.getElementById('debugRef'));
const debugTable = /** @type {HTMLElement} */ (document.getElementById('debugTable'));
const debugApply = /** @type {HTMLElement} */ (document.getElementById('debugApply'));
const debugCopyJson = /** @type {HTMLElement} */ (document.getElementById('debugCopyJson'));

export const debugOverlayGroup = new THREE.Group();

let _data = null;
let _refBooth = null;

// ── helpers ──────────────────────────────────────────────────

function getHeight(b) {
  return b.status === 'BOOKED' ? 2.0 : b.status === 'HOLD' ? 1.6 : 1.2;
}

function centroidPx(corners) {
  let cx = 0,
    cy = 0;
  corners.forEach((c) => {
    cx += c.pixel.px;
    cy += c.pixel.py;
  });
  return { px: cx / corners.length, py: cy / corners.length };
}

function computeCornerData(b) {
  return b.geometry.points.map(([fx, fy]) => {
    const pixel = fabricToPixel(fx, fy);
    const world = pxToWorld(pixel.px, pixel.py);
    const inside = pixel.px >= 0 && pixel.px <= IMG_W && pixel.py >= 0 && pixel.py <= IMG_H;
    return { fabric: { x: fx, y: fy }, pixel, world, inside };
  });
}

// ── aspect ratio ─────────────────────────────────────────────

function updateAspectInfo() {
  const fw = fb.maxX - fb.minX;
  const fh = fb.maxY - fb.minY;
  const imgAspect = IMG_W / IMG_H;
  const fabAspect = fw / fh;
  const ratio = baseScaleX / baseScaleY;
  const diffPct = (Math.abs(imgAspect - fabAspect) / ((imgAspect + fabAspect) / 2)) * 100;
  const cls = diffPct < 1 ? 'ok' : 'err';
  debugAspect.className = `tiny ${cls}`;
  debugAspect.textContent =
    `Img ${IMG_W}×${IMG_H} (${imgAspect.toFixed(3)}) · ` +
    `Fab ${fw.toFixed(0)}×${fh.toFixed(0)} (${fabAspect.toFixed(3)}) · ` +
    `Scale ratio ${ratio.toFixed(4)}${diffPct >= 1 ? ` · ⚠ ${diffPct.toFixed(1)}% mismatch` : ''}`;
  if (cls === 'err') {debugAspect.style.color = '#ffb020';}
  else {debugAspect.style.color = '';}
}

// ── table ────────────────────────────────────────────────────

function renderTable(corners) {
  if (!corners || corners.length === 0) {
    debugStatus.textContent = 'No geometry data';
    debugStatus.className = 'debugStatus';
    debugTable.innerHTML = '';
    return;
  }

  const allInside = corners.every((c) => c.inside);
  debugStatus.textContent = allInside
    ? 'All corners inside image bounds'
    : `${corners.filter((c) => !c.inside).length} corner(s) extend outside image`;
  debugStatus.className = `debugStatus ${allInside ? 'ok' : 'err'}`;

  const head =
    '<span>#</span><span>Fab X,Y</span><span>Pxl X,Y</span><span>Wld X</span><span>Wld Z</span><span></span>';
  let html = `<div class="debugGrid debugHead">${head}</div>`;

  corners.forEach((c, i) => {
    const isRef = _refBooth === debugSelect.value && i === 0;
    html += `<div class="debugGrid debugRow" data-idx="${i}">
      <span>${i + 1}</span>
      <span class="fabCell">${c.fabric.x.toFixed(2)}, ${c.fabric.y.toFixed(2)}</span>
      <span class="pxlCell">${c.pixel.px.toFixed(1)}, ${c.pixel.py.toFixed(1)}</span>
      <input class="debugInput wxInput" type="number" step="0.001" value="${c.world.x.toFixed(3)}" />
      <input class="debugInput wzInput" type="number" step="0.001" value="${c.world.z.toFixed(3)}" />
      <span class="statusCell">${isRef ? '📌' : c.inside ? '✅' : '❌'}</span>
    </div>`;
  });

  debugTable.innerHTML = html;
  debugTable
    .querySelectorAll('.wxInput, .wzInput')
    .forEach((el) => el.addEventListener('input', onWorldEdit));

  updateRefInfo();
}

function updateRefInfo() {
  if (!_refBooth) {
    debugRef.textContent = '';
    return;
  }
  const curNo = debugSelect.value;
  if (!curNo || curNo === _refBooth) {
    debugRef.textContent = `Ref: ${_refBooth}`;
    return;
  }
  const curB = _data.booths.find((x) => x.boothNo === curNo);
  const refB = _data.booths.find((x) => x.boothNo === _refBooth);
  if (!curB || !refB) {
    debugRef.textContent = `Ref: ${_refBooth}`;
    return;
  }

  const curC = computeCornerData(curB);
  const refC = computeCornerData(refB);
  const curCp = centroidPx(curC);
  const refCp = centroidPx(refC);
  const dpx = curCp.px - refCp.px;
  const dpy = curCp.py - refCp.py;

  debugRef.textContent = `Ref: ${_refBooth} · vs ${curNo}: Δpx [${dpx >= 0 ? '+' : ''}${dpx.toFixed(1)}, ${dpy >= 0 ? '+' : ''}${dpy.toFixed(1)}]`;
}

// ── overlay ──────────────────────────────────────────────────

export function clearOverlay() {
  while (debugOverlayGroup.children.length) {
    const o = debugOverlayGroup.children.pop();
    /** @type {any} */ (o).geometry?.dispose();
    /** @type {any} */ (o).material?.dispose();
  }
}

function buildOverlay(b, corners) {
  clearOverlay();
  if (!debugOverlayToggle.checked) {return;}

  const pts2 = corners.map((c) => new THREE.Vector2(c.world.x, c.world.z));
  const h = getHeight(b);
  const yPos = boothGroup.position.y + h + 0.02;

  // booth outline
  const linePts = pts2.map((p) => new THREE.Vector3(p.x, yPos, p.y));
  linePts.push(linePts[0].clone());
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
  debugOverlayGroup.add(new THREE.Line(lineGeo, lineMat));

  // corner markers
  const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  pts2.forEach((p) => {
    const m = new THREE.Mesh(sphereGeo, sphereMat);
    m.position.set(p.x, yPos, p.y);
    debugOverlayGroup.add(m);
  });

  // origin crosshair
  if (debugShowOrigin.checked) {buildOriginCrosshair();}
}

function buildOriginCrosshair() {
  const y = 0.01;
  const len = 5;
  const axLen = 3;

  // X axis (red)
  const xPts = [new THREE.Vector3(-len, y, 0), new THREE.Vector3(len, y, 0)];
  const xGeo = new THREE.BufferGeometry().setFromPoints(xPts);
  debugOverlayGroup.add(new THREE.Line(xGeo, new THREE.LineBasicMaterial({ color: 0xff4444 })));

  // Z axis (blue)
  const zPts = [new THREE.Vector3(0, y, -len), new THREE.Vector3(0, y, len)];
  const zGeo = new THREE.BufferGeometry().setFromPoints(zPts);
  debugOverlayGroup.add(new THREE.Line(zGeo, new THREE.LineBasicMaterial({ color: 0x4488ff })));

  // arrow heads
  const arrow = new THREE.ConeGeometry(0.2, 0.5, 6);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x4488ff });

  const axPos = new THREE.Mesh(arrow, redMat);
  axPos.position.set(axLen, y, 0);
  axPos.rotation.z = -Math.PI / 2;
  debugOverlayGroup.add(axPos);

  const azPos = new THREE.Mesh(arrow, blueMat);
  azPos.position.set(0, y, axLen);
  debugOverlayGroup.add(azPos);

  // center ring
  const ring = new THREE.RingGeometry(0.15, 0.25, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const ringMesh = new THREE.Mesh(ring, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(0, y, 0);
  debugOverlayGroup.add(ringMesh);
}

// ── edit / apply / copy ──────────────────────────────────────

function onWorldEdit() {
  const rows = debugTable.querySelectorAll('.debugRow');
  const corners = [];

  for (const row of rows) {
    const wx = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wxInput')).value);
    const wz = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wzInput')).value);
    if (!isFinite(wx) || !isFinite(wz)) {return;}

    const pixel = worldToPx(wx, wz);
    const fabric = pixelToFabric(pixel.px, pixel.py);
    const inside = pixel.px >= 0 && pixel.px <= IMG_W && pixel.py >= 0 && pixel.py <= IMG_H;

    /** @type {HTMLElement} */ (row.querySelector('.fabCell')).textContent =
      `${fabric.x.toFixed(2)}, ${fabric.y.toFixed(2)}`;
    /** @type {HTMLElement} */ (row.querySelector('.pxlCell')).textContent =
      `${pixel.px.toFixed(1)}, ${pixel.py.toFixed(1)}`;
    /** @type {HTMLElement} */ (row.querySelector('.statusCell')).textContent = inside
      ? '✅'
      : '❌';

    corners.push({ world: { x: wx, z: wz }, pixel, fabric, inside });
  }

  const allInside = corners.every((c) => c.inside);
  debugStatus.textContent = allInside
    ? 'All corners inside image bounds'
    : `${corners.filter((c) => !c.inside).length} corner(s) extend outside image`;
  debugStatus.className = `debugStatus ${allInside ? 'ok' : 'err'}`;

  if (debugOverlayToggle.checked) {
    const b = _data.booths.find((x) => x.boothNo === debugSelect.value);
    if (b) {buildOverlay(b, corners);}
  }
}

function currentFabricPoints() {
  const rows = debugTable.querySelectorAll('.debugRow');
  const pts = [];
  for (const row of rows) {
    const wx = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wxInput')).value);
    const wz = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wzInput')).value);
    if (!isFinite(wx) || !isFinite(wz)) {return null;}
    const pixel = worldToPx(wx, wz);
    const fabric = pixelToFabric(pixel.px, pixel.py);
    pts.push([fabric.x, fabric.y]);
  }
  return pts;
}

function onApply() {
  const boothNo = debugSelect.value;
  if (!boothNo) {return;}
  const b = _data.booths.find((x) => x.boothNo === boothNo);
  if (!b) {return;}
  const pts = currentFabricPoints();
  if (!pts || pts.length < 3) {return;}
  b.geometry.points = pts;
  const heat = /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked;
  buildBooths(_data, heat);
  onBoothSelect();
}

function onCopyJson() {
  const pts = currentFabricPoints();
  if (!pts) {return;}
  navigator.clipboard.writeText(JSON.stringify(pts, null, 2));
}

// ── selection ────────────────────────────────────────────────

function onBoothSelect() {
  const boothNo = debugSelect.value;
  if (!boothNo) {
    debugStatus.textContent = 'Select a booth';
    debugStatus.className = 'debugStatus';
    debugTable.innerHTML = '';
    clearOverlay();
    return;
  }

  const b = _data.booths.find((x) => x.boothNo === boothNo);
  if (!b) {
    debugStatus.textContent = 'Booth not found';
    debugStatus.className = 'debugStatus';
    debugTable.innerHTML = '';
    clearOverlay();
    return;
  }

  if (!b.geometry?.points || b.geometry.points.length < 3) {
    debugStatus.textContent = 'Invalid geometry (< 3 points)';
    debugStatus.className = 'debugStatus';
    debugTable.innerHTML = '';
    clearOverlay();
    return;
  }

  const corners = computeCornerData(b);
  renderTable(corners);

  if (debugOverlayToggle.checked) {buildOverlay(b, corners);}
  else {clearOverlay();}
}

function onOverlayToggle() {
  if (debugSelect.value) {onBoothSelect();}
  else {clearOverlay();}
}

function onShowOriginToggle() {
  if (debugSelect.value) {onBoothSelect();}
}

// ── init ──────────────────────────────────────────────────────

let _initDone = false;

export function initCoordDebug(data) {
  scene.add(debugOverlayGroup);
  reloadCoordDebug(data);

  if (_initDone) {return;}
  _initDone = true;

  debugSelect.addEventListener('change', onBoothSelect);
  debugOverlayToggle.addEventListener('change', onOverlayToggle);
  debugShowOrigin.addEventListener('change', onShowOriginToggle);
  debugApply.addEventListener('click', onApply);
  debugCopyJson.addEventListener('click', onCopyJson);
  debugRef.addEventListener('click', () => {
    if (debugSelect.value) {
      if (_refBooth === debugSelect.value) {_refBooth = null;}
      else {_refBooth = debugSelect.value;}
      onBoothSelect();
    }
  });

  const onCalInput = () => {
    if (debugSelect.value) {onBoothSelect();}
  };
  [offXEl, offYEl, scXEl, scYEl].forEach((el) => el.addEventListener('input', onCalInput));
}

export function reloadCoordDebug(data) {
  _data = data;
  _refBooth = null;
  debugSelect.value = '';
  debugStatus.textContent = 'Select a booth';
  debugStatus.className = 'debugStatus';
  debugTable.innerHTML = '';
  clearOverlay();

  const dl = /** @type {HTMLDataListElement} */ (document.getElementById('debugBoothList'));
  dl.innerHTML = '';
  data.booths.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.boothNo;
    dl.appendChild(opt);
  });

  updateAspectInfo();
}
