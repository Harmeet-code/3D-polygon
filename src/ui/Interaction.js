import * as THREE from 'three';
import { camera, renderer, placeTooltipAt } from '../scene/SceneSetup.js';
import { boothMeshes } from '../scene/BoothBuilder.js';
import { highlight, updateSidebar, focusMesh } from './Sidebar.js';
import { openMarkerFor } from './BoothMarker.js';
import { handlePoiClick, poiMeshes } from '../scene/PoiMarkers.js';
import {
  getMode,
  handleMouseMove as poiHandleMouseMove,
  handleClick as poiHandleClick,
  selectPoiForRemoval
} from '../scene/PoiEditor.js';
import {
  getMode as getRoadMode,
  handleClick as roadHandleClick,
  handleRightClick as roadHandleRightClick,
  handleMouseMove as roadHandleMouseMove
} from '../scene/RoadEditor.js';
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
    // Let editors handle mouse move
    poiHandleMouseMove(ev);
    roadHandleMouseMove(ev);

    setMouse(ev);
    raycaster.setFromCamera(mouse, camera);

    // Skip booth hover if in any editor mode
    const poiMode = getMode();
    const roadMode = getRoadMode();
    if (poiMode || roadMode) {
      if (sel.hovered && sel.hovered !== sel.selected) highlight(sel.hovered, false);
      sel.hovered = null;
      tooltip.style.display = 'none';
      renderer.domElement.style.cursor = 'crosshair';
      return;
    }

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
      renderer.domElement.style.cursor = poiMode ? 'crosshair' : '';
    }
  });

  renderer.domElement.addEventListener('click', (ev) => {
    // Road editor takes highest priority
    const roadMode = getRoadMode();
    if (roadMode === 'add-road') {
      roadHandleClick(ev);
      return;
    }

    // PoiEditor takes next priority
    const poiMode = getMode();
    if (poiMode === 'add-stair' || poiMode === 'add-entrance') {
      poiHandleClick(ev);
      return;
    }
    if (poiMode === 'remove') {
      raycaster.setFromCamera(mouse, camera);
      const poiHits = raycaster.intersectObjects(poiMeshes, false);
      for (const hit of poiHits) {
        const obj = hit.object;
        if (obj.userData.poiType) {
          selectPoiForRemoval(obj.userData.poiId, obj.userData.poiType);
          return;
        }
      }
      return;
    }

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

  // Right-click for road editor finish segment
  renderer.domElement.addEventListener('contextmenu', (ev) => {
    const roadMode = getRoadMode();
    if (roadMode === 'add-road') {
      roadHandleRightClick(ev);
      return;
    }
  });
}
