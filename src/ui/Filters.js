import * as THREE from 'three';
import { hemi, dir, scene } from '../scene/SceneSetup.js';
import { boothMeshes, boothByNo } from '../scene/BoothBuilder.js';
import { highlight } from './Sidebar.js';
import { sel } from '../state.js';

let currentFilter = 'ALL';

export const fromSelect = /** @type {HTMLSelectElement} */ (document.getElementById('fromSelect'));
export const toSelect = /** @type {HTMLSelectElement} */ (document.getElementById('toSelect'));

/** @type {HTMLInputElement} */ (document.getElementById('q')).addEventListener(
  'input',
  applyFilters
);
[...document.querySelectorAll('.chip')].forEach((ch) => {
  const chip = /** @type {HTMLElement} */ (ch);
  chip.addEventListener('click', () => {
    [...document.querySelectorAll('.chip')].forEach((x) =>
      /** @type {HTMLElement} */ (x).classList.remove('active')
    );
    chip.classList.add('active');
    currentFilter = chip.dataset.filter ?? 'ALL';
    applyFilters();
  });
});

export function applyFilters() {
  const q = /** @type {HTMLInputElement} */ (document.getElementById('q')).value
    .trim()
    .toLowerCase();
  boothMeshes.forEach((m) => {
    const b = m.userData.booth;
    const matchStatus = currentFilter === 'ALL' || b.status === currentFilter;
    const matchText =
      !q || b.boothNo.toLowerCase().includes(q) || (b.company || '').toLowerCase().includes(q);
    m.visible = matchStatus && matchText;
  });
}

/** @type {HTMLInputElement} */ (document.getElementById('heatmap')).addEventListener(
  'change',
  () => {
    boothMeshes.forEach((m) => highlight(m, false));
    if (sel.selected) highlight(sel.selected, true);
  }
);

/** @type {HTMLInputElement} */ (document.getElementById('night')).addEventListener(
  'change',
  (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.checked) {
      hemi.intensity = 0.55;
      dir.intensity = 0.65;
      /** @type {THREE.Fog} */ (scene.fog).color.set(0x02050b);
    } else {
      hemi.intensity = 0.95;
      dir.intensity = 1.1;
      /** @type {THREE.Fog} */ (scene.fog).color.set(0x05070b);
    }
  }
);

export function fillDropdowns(data) {
  const boothNos = data.booths.map((b) => b.boothNo).sort((a, b) => a.localeCompare(b));
  fromSelect.innerHTML = boothNos.map((x) => `<option value="${x}">${x}</option>`).join('');
  toSelect.innerHTML = boothNos.map((x) => `<option value="${x}">${x}</option>`).join('');
  if (boothNos.length > 1) toSelect.value = boothNos[1];
}

export function boothCenterWorld(no) {
  const m = boothByNo.get(no);
  if (!m) return { x: 0, z: 0 };
  const c = m.userData.center;
  return { x: c.x, z: c.z };
}
