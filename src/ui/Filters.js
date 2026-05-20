import { scene, hemi, dir } from '../scene/SceneSetup.js';
import { boothMeshes, boothByNo } from '../scene/BoothBuilder.js';
import { highlight } from './Sidebar.js';
import { sel } from '../state.js';

let currentFilter = 'ALL';

/** @type {HTMLInputElement} */ (document.getElementById('q')).addEventListener(
  'input',
  applyFilters,
);
[...document.querySelectorAll('.chip')].forEach((ch) => {
  const chip = /** @type {HTMLElement} */ (ch);
  chip.addEventListener('click', () => {
    [...document.querySelectorAll('.chip')].forEach(
      (x) => /** @type {HTMLElement} */ (x).classList.remove('active'),
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
    if (sel.selected) {
      highlight(sel.selected, true);
    }
  },
);

/** @type {HTMLInputElement} */ (document.getElementById('night')).addEventListener(
  'change',
  (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target.checked) {
      hemi.intensity = 0.55;
      dir.intensity = 0.65;
      /** @type {import('three').Fog} */ (scene.fog).color.set(0x02050b);
    } else {
      hemi.intensity = 0.95;
      dir.intensity = 1.1;
      /** @type {import('three').Fog} */ (scene.fog).color.set(0x05070b);
    }
  },
);

// ── Route Combobox (datalist) ────────────────────────────────

/** @type {Array<string>} */
let allFloors = [];
/** @type {Record<string, string[]>} */
const floorBoothNos = {};

const fromInput = /** @type {HTMLInputElement} */ (document.getElementById('fromInput'));
const toInput = /** @type {HTMLInputElement} */ (document.getElementById('toInput'));
const fromFloorSelect = /** @type {HTMLSelectElement} */ (
  document.getElementById('fromFloorSelect')
);
const toFloorSelect = /** @type {HTMLSelectElement} */ (document.getElementById('toFloorSelect'));
const fromBoothList = /** @type {HTMLDataListElement} */ (document.getElementById('fromBoothList'));
const toBoothList = /** @type {HTMLDataListElement} */ (document.getElementById('toBoothList'));

function updateDatalist(which) {
  const floorSelect = which === 'from' ? fromFloorSelect : toFloorSelect;
  const datalist = which === 'from' ? fromBoothList : toBoothList;
  const floorName = floorSelect.value;

  let booths = [];
  if (!floorName || floorName === 'all') {
    for (const nos of Object.values(floorBoothNos)) {
      booths.push(...nos);
    }
  } else {
    booths = floorBoothNos[floorName] || [];
  }

  datalist.innerHTML = booths.map((no) => `<option value="${no}">`).join('');
}

function setupDatalist(which) {
  const floorSelect = which === 'from' ? fromFloorSelect : toFloorSelect;
  floorSelect.addEventListener('change', () => {
    updateDatalist(which);
  });
}

setupDatalist('from');
setupDatalist('to');

/** Initialize floor selectors from floors.json and pre-fetch booth data. */
export async function initComboboxFloors() {
  try {
    const res = await fetch('./data/floors.json');
    allFloors = await res.json();
  } catch {
    allFloors = [];
  }

  const floorOptions = allFloors.map((f) => `<option value="${f}">${f}</option>`).join('');
  fromFloorSelect.innerHTML = `<option value="">Select floor...</option>${floorOptions}`;
  toFloorSelect.innerHTML = `<option value="">Select floor...</option>${floorOptions}`;

  // Pre-fetch all floor data
  for (const floorName of allFloors) {
    try {
      const res = await fetch(`./data/json/${floorName}.json`);
      const data = await res.json();
      floorBoothNos[floorName] = data.booths
        .map((b) => b.boothNo)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      floorBoothNos[floorName] = [];
    }
  }

  // Initial datalist population
  updateDatalist('from');
  updateDatalist('to');
}

export function fillDropdowns(data) {
  // Legacy: called on floor load, but datalist now uses pre-fetched data
  const floorName = data.meta?.floorName || 'unknown';
  floorBoothNos[floorName] = data.booths.map((b) => b.boothNo).sort((a, b) => a.localeCompare(b));
}

export function boothCenterWorld(no) {
  const m = boothByNo.get(no);
  if (!m) {
    return { x: 0, z: 0 };
  }
  const c = m.userData.center;
  return { x: c.x, z: c.z };
}

export { fromInput, toInput };
