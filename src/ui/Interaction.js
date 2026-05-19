import * as THREE from 'three';
import { camera, renderer, placeTooltipAt } from '../scene/SceneSetup.js';
import { boothMeshes } from '../scene/BoothBuilder.js';
import { highlight, updateSidebar, focusMesh } from './Sidebar.js';
import { openMarkerFor } from './BoothMarker.js';
import { handlePoiClick, poiMeshes } from '../scene/PoiMarkers.js';
import { sel } from '../state.js';

const tooltip = /** @type {HTMLElement} */ (document.getElementById('tooltip'));
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function setMouse(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}

export function initInteraction() {
  renderer.domElement.addEventListener('mousemove', (ev) => {
    setMouse(ev);
    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(boothMeshes, false);
    if (hits.length) {
      const m = /** @type {THREE.Intersection} */ (hits[0]).object;
      if (sel.hovered !== m) {
        if (sel.hovered && sel.hovered !== sel.selected) highlight(sel.hovered, false);
        sel.hovered = m;
        if (sel.hovered !== sel.selected) highlight(sel.hovered, true);
      }
      const b = m.userData.booth;
      tooltip.style.display = 'block';

      const center =
        sel.hovered.userData.center || sel.hovered.getWorldPosition(new THREE.Vector3());
      placeTooltipAt(center, tooltip);

      tooltip.innerHTML = `<b>${b.boothNo}</b> \u2022 ${b.status} \u2022 $${b.price}`;
      renderer.domElement.style.cursor = 'pointer';
    } else {
      if (sel.hovered && sel.hovered !== sel.selected) highlight(sel.hovered, false);
      sel.hovered = null;
      tooltip.style.display = 'none';
      renderer.domElement.style.cursor = '';
    }
  });

  renderer.domElement.addEventListener('click', () => {
    // Check POI click first
    raycaster.setFromCamera(mouse, camera);
    const poiHits = raycaster.intersectObjects(poiMeshes, false);
    if (handlePoiClick(poiHits)) return;

    // Then check booth click
    if (!sel.hovered) return;
    if (sel.selected && sel.selected !== sel.hovered) highlight(sel.selected, false);
    sel.selected = sel.hovered;
    highlight(sel.selected, true);
    updateSidebar(sel.selected.userData.booth);
    focusMesh(sel.selected);
    openMarkerFor(sel.selected);
  });
}
