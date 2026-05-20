import * as THREE from 'three';
import { camera, controls } from '../scene/SceneSetup.js';
import { heatColor, minPrice, maxPrice } from '../scene/BoothBuilder.js';
import { sel } from '../state.js';

const statusPill = /** @type {HTMLElement} */ (document.getElementById('statusPill'));
const statusDot = /** @type {HTMLElement} */ (document.getElementById('statusDot'));
const statusText = /** @type {HTMLElement} */ (document.getElementById('statusText'));
const kv = /** @type {HTMLElement} */ (document.getElementById('kv'));
const boothNoEl = /** @type {HTMLElement} */ (document.getElementById('boothNo'));
const companyEl = /** @type {HTMLElement} */ (document.getElementById('company'));
const sizeEl = /** @type {HTMLElement} */ (document.getElementById('size'));
const priceEl = /** @type {HTMLElement} */ (document.getElementById('price'));
export const focusBtn = /** @type {HTMLButtonElement} */ (document.getElementById('focusBtn'));

export function updateSidebar(b) {
  if (!b) {
    statusPill.style.display = 'none';
    kv.style.display = 'none';
    /** @type {HTMLElement} */ (document.getElementById('infoTitle')).textContent =
      'Select a booth';
    /** @type {HTMLElement} */ (document.getElementById('infoHint')).textContent =
      'Click any booth.';
    focusBtn.disabled = true;
    return;
  }
  /** @type {HTMLElement} */ (document.getElementById('infoTitle')).textContent = 'Booth Selected';
  /** @type {HTMLElement} */ (document.getElementById('infoHint')).textContent =
    'Focus / Route / Filters / Heatmap';
  statusPill.style.display = 'inline-flex';
  kv.style.display = 'grid';

  statusText.textContent = b.status;
  statusDot.style.background =
    b.status === 'AVAILABLE' ? 'var(--good)' : b.status === 'BOOKED' ? 'var(--bad)' : 'var(--warn)';

  boothNoEl.textContent = b.boothNo;
  companyEl.textContent = b.company ?? '\u2014';
  sizeEl.textContent = b.size ?? '\u2014';
  priceEl.textContent = (b.price ?? '\u2014').toString();

  focusBtn.disabled = false;
}

export function highlight(mesh, on) {
  if (!mesh) {return;}
  if (on) {
    mesh.material.emissive = new THREE.Color(0x6aa9ff).multiplyScalar(0.65);
    mesh.scale.set(1.05, 1.02, 1.05);
  } else {
    const b = mesh.userData.booth;
    const heat = /** @type {HTMLInputElement} */ (document.getElementById('heatmap')).checked;
    let color = b.boothColor ? parseInt(b.boothColor.slice(1), 16) : 0x2ecc71;
    if (heat) {
      const t = ((+b.price || minPrice) - minPrice) / Math.max(1e-6, maxPrice - minPrice);
      color = heatColor(t);
    }
    mesh.material.color.setHex(color);
    mesh.material.emissive = new THREE.Color(color).multiplyScalar(0.05);
    mesh.scale.set(1, 1, 1);
  }
}

export function flyTo(targetPos, targetLook, ms = 900) {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const start = performance.now();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function step(now) {
    const t = Math.min(1, (now - start) / ms);
    const e = ease(t);
    camera.position.lerpVectors(startPos, targetPos, e);
    controls.target.lerpVectors(startTarget, targetLook, e);
    controls.update();
    if (t < 1) {requestAnimationFrame(step);}
  }
  requestAnimationFrame(step);
}

export function focusMesh(mesh) {
  const c = mesh.userData.center.clone();
  flyTo(c.clone().add(new THREE.Vector3(18, 18, 22)), c.clone(), 850);
}

focusBtn.addEventListener('click', () => {
  if (sel.selected) {focusMesh(sel.selected);}
});
