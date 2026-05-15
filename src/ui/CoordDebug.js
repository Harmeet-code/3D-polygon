import * as THREE from 'three';
import {
  fabricToPixel,
  pxToWorld,
  offXEl,
  offYEl,
  scXEl,
  scYEl,
  readCal,
  fb,
  baseScaleX,
  baseScaleY
} from '../scene/CoordTransform.js';
import { IMG_W, IMG_H, PLANE_W, PLANE_H, scene, boothGroup } from '../scene/SceneSetup.js';
import { buildBooths } from '../scene/BoothBuilder.js';

const debugSelect = /** @type {HTMLInputElement} */ (document.getElementById('debugSelect'));
const debugOverlayToggle = /** @type {HTMLInputElement} */ (
  document.getElementById('debugOverlayToggle')
);
const debugStatus = /** @type {HTMLElement} */ (document.getElementById('debugStatus'));
const debugTable = /** @type {HTMLElement} */ (document.getElementById('debugTable'));
const debugApply = /** @type {HTMLElement} */ (document.getElementById('debugApply'));
const debugCopyJson = /** @type {HTMLElement} */ (document.getElementById('debugCopyJson'));

const debugOverlayGroup = new THREE.Group();

let _data = null;

function getHeight(b) {
  return b.status === 'BOOKED' ? 2.0 : b.status === 'HOLD' ? 1.6 : 1.2;
}

function worldToPixel(wx, wz) {
  return { px: (wx / PLANE_W + 0.5) * IMG_W, py: (0.5 - wz / PLANE_H) * IMG_H };
}

function pixelToFabric(px, py) {
  const cal = readCal();
  const sx = baseScaleX * cal.scaleX;
  const sy = baseScaleY * cal.scaleY;
  return { fx: (px - cal.offsetX) / sx + fb.minX, fy: (py - cal.offsetY) / sy + fb.minY };
}

function computeCornerData(b) {
  return b.geometry.points.map(([fx, fy]) => {
    const pixel = fabricToPixel(fx, fy);
    const world = pxToWorld(pixel.px, pixel.py);
    const inside = pixel.px >= 0 && pixel.px <= IMG_W && pixel.py >= 0 && pixel.py <= IMG_H;
    return { fabric: { x: fx, y: fy }, pixel, world, inside };
  });
}

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
    html += `<div class="debugGrid debugRow" data-idx="${i}">
      <span>${i + 1}</span>
      <span class="fabCell">${c.fabric.x.toFixed(2)}, ${c.fabric.y.toFixed(2)}</span>
      <span class="pxlCell">${c.pixel.px.toFixed(1)}, ${c.pixel.py.toFixed(1)}</span>
      <input class="debugInput wxInput" type="number" step="0.001" value="${c.world.x.toFixed(3)}" />
      <input class="debugInput wzInput" type="number" step="0.001" value="${c.world.z.toFixed(3)}" />
      <span class="statusCell">${c.inside ? '✅' : '❌'}</span>
    </div>`;
  });

  debugTable.innerHTML = html;
  debugTable
    .querySelectorAll('.wxInput, .wzInput')
    .forEach((el) => el.addEventListener('input', onWorldEdit));
}

function onWorldEdit() {
  const rows = debugTable.querySelectorAll('.debugRow');
  const corners = [];

  for (const row of rows) {
    const wx = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wxInput')).value);
    const wz = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wzInput')).value);
    if (!isFinite(wx) || !isFinite(wz)) return;

    const pixel = worldToPixel(wx, wz);
    const fabric = pixelToFabric(pixel.px, pixel.py);
    const inside = pixel.px >= 0 && pixel.px <= IMG_W && pixel.py >= 0 && pixel.py <= IMG_H;

    /** @type {HTMLElement} */ (row.querySelector('.fabCell')).textContent =
      `${fabric.fx.toFixed(2)}, ${fabric.fy.toFixed(2)}`;
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
    if (b) buildOverlay(b, corners);
  }
}

function clearOverlay() {
  while (debugOverlayGroup.children.length) {
    const o = debugOverlayGroup.children.pop();
    /** @type {any} */ (o).geometry?.dispose();
    /** @type {any} */ (o).material?.dispose();
  }
}

function buildOverlay(b, corners) {
  clearOverlay();
  if (!debugOverlayToggle.checked) return;

  const pts2 = corners.map((c) => new THREE.Vector2(c.world.x, c.world.z));
  const h = getHeight(b);
  const yPos = boothGroup.position.y + h + 0.02;

  const linePts = pts2.map((p) => new THREE.Vector3(p.x, yPos, p.y));
  linePts.push(linePts[0].clone());

  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
  debugOverlayGroup.add(new THREE.Line(lineGeo, lineMat));

  const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  pts2.forEach((p) => {
    const m = new THREE.Mesh(sphereGeo, sphereMat);
    m.position.set(p.x, yPos, p.y);
    debugOverlayGroup.add(m);
  });
}

function currentFabricPoints() {
  const rows = debugTable.querySelectorAll('.debugRow');
  const pts = [];
  for (const row of rows) {
    const wx = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wxInput')).value);
    const wz = parseFloat(/** @type {HTMLInputElement} */ (row.querySelector('.wzInput')).value);
    if (!isFinite(wx) || !isFinite(wz)) return null;
    const pixel = worldToPixel(wx, wz);
    const fabric = pixelToFabric(pixel.px, pixel.py);
    pts.push([fabric.fx, fabric.fy]);
  }
  return pts;
}

function onApply() {
  const boothNo = debugSelect.value;
  if (!boothNo) return;

  const b = _data.booths.find((x) => x.boothNo === boothNo);
  if (!b) return;

  const pts = currentFabricPoints();
  if (!pts || pts.length < 3) return;

  b.geometry.points = pts;
  const heat = /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked;
  buildBooths(_data, heat);
  onBoothSelect();
}

function onCopyJson() {
  const pts = currentFabricPoints();
  if (!pts) return;
  const json = JSON.stringify(pts, null, 2);
  navigator.clipboard.writeText(json);
}

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

  if (debugOverlayToggle.checked) buildOverlay(b, corners);
  else clearOverlay();
}

function onOverlayToggle() {
  if (debugSelect.value) onBoothSelect();
  else clearOverlay();
}

export function initCoordDebug(data) {
  scene.add(debugOverlayGroup);
  _data = data;

  const dl = /** @type {HTMLDataListElement} */ (document.getElementById('debugBoothList'));
  data.booths.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.boothNo;
    dl.appendChild(opt);
  });

  debugSelect.addEventListener('change', onBoothSelect);
  debugOverlayToggle.addEventListener('change', onOverlayToggle);
  debugApply.addEventListener('click', onApply);
  debugCopyJson.addEventListener('click', onCopyJson);

  const onCalInput = () => {
    if (debugSelect.value) onBoothSelect();
  };
  [offXEl, offYEl, scXEl, scYEl].forEach((el) => el.addEventListener('input', onCalInput));
}
