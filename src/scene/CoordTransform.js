import { IMG_W, IMG_H, PLANE_W, PLANE_H } from './SceneSetup.js';

const storeKey = 'sems_demo_cal_v2';
const saved = JSON.parse(localStorage.getItem(storeKey) || '{}');

const DEFAULT_CALIBRATION = {
  offsetX: 300,
  offsetY: 300,
  scaleX: 0.938,
  scaleY: 0.912
};

const offXEl = /** @type {HTMLInputElement} */ (document.getElementById('offX'));
const offYEl = /** @type {HTMLInputElement} */ (document.getElementById('offY'));
const scXEl = /** @type {HTMLInputElement} */ (document.getElementById('scX'));
const scYEl = /** @type {HTMLInputElement} */ (document.getElementById('scY'));
const offXVal = /** @type {HTMLElement} */ (document.getElementById('offXVal'));
const offYVal = /** @type {HTMLElement} */ (document.getElementById('offYVal'));
const scXVal = /** @type {HTMLElement} */ (document.getElementById('scXVal'));
const scYVal = /** @type {HTMLElement} */ (document.getElementById('scYVal'));

function normalizeScaleValue(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n > 10 ? n / 1000 : n;
}

offXEl.value = saved.offsetX ?? DEFAULT_CALIBRATION.offsetX;
offYEl.value = saved.offsetY ?? DEFAULT_CALIBRATION.offsetY;
scXEl.value = normalizeScaleValue(saved.scaleX, DEFAULT_CALIBRATION.scaleX).toFixed(3);
scYEl.value = normalizeScaleValue(saved.scaleY, DEFAULT_CALIBRATION.scaleY).toFixed(3);

export function readCal() {
  return {
    offsetX: Number.isFinite(+offXEl.value) ? +offXEl.value : DEFAULT_CALIBRATION.offsetX,
    offsetY: Number.isFinite(+offYEl.value) ? +offYEl.value : DEFAULT_CALIBRATION.offsetY,
    scaleX: normalizeScaleValue(scXEl.value, DEFAULT_CALIBRATION.scaleX),
    scaleY: normalizeScaleValue(scYEl.value, DEFAULT_CALIBRATION.scaleY)
  };
}

export function persistCal() {
  localStorage.setItem(storeKey, JSON.stringify(readCal()));
}

function syncCalLabels() {
  const cal = readCal();
  offXVal.textContent = cal.offsetX.toFixed(0);
  offYVal.textContent = cal.offsetY.toFixed(0);
  scXVal.textContent = cal.scaleX.toFixed(3);
  scYVal.textContent = cal.scaleY.toFixed(3);
}

syncCalLabels();

[offXEl, offYEl, scXEl, scYEl].forEach((el) => {
  el.addEventListener('input', syncCalLabels);
});

export let fb, baseScaleX, baseScaleY;

export function initCalibration(data) {
  fb = data.meta.fabricBounds;
  baseScaleX = IMG_W / (fb.maxX - fb.minX);
  baseScaleY = IMG_H / (fb.maxY - fb.minY);
}

export function fabricToPixel(x, y) {
  const cal = readCal();
  const sx = baseScaleX * cal.scaleX;
  const sy = baseScaleY * cal.scaleY;
  return {
    px: (x - fb.minX) * sx + cal.offsetX,
    py: (y - fb.minY) * sy + cal.offsetY
  };
}

export function pxToWorld(px, py) {
  return {
    x: (px / IMG_W - 0.5) * PLANE_W,
    z: (0.5 - py / IMG_H) * PLANE_H
  };
}

/** Inverse of pxToWorld: world (x,z) → pixel (px,py) */
export function worldToPx(x, z) {
  return {
    px: (x / PLANE_W + 0.5) * IMG_W,
    py: (0.5 - z / PLANE_H) * IMG_H
  };
}

/** Inverse of fabricToPixel: pixel (px,py) → fabric (x,y) */
export function pixelToFabric(px, py) {
  const cal = readCal();
  const sx = baseScaleX * cal.scaleX;
  const sy = baseScaleY * cal.scaleY;
  return {
    x: (px - cal.offsetX) / sx + fb.minX,
    y: (py - cal.offsetY) / sy + fb.minY
  };
}

/** Convert a world-unit length to fabric-unit length using current calibration. */
export function worldToFabricLength(worldLen) {
  const cal = readCal();
  const sx = baseScaleX * cal.scaleX;
  const pxPerWorld = IMG_W / PLANE_W;
  const px = worldLen * pxPerWorld;
  return px / sx;
}

export { offXEl, offYEl, scXEl, scYEl, DEFAULT_CALIBRATION, storeKey };
