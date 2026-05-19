import * as THREE from 'three';
import { scene } from './SceneSetup.js';
import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { flyTo } from '../ui/Sidebar.js';

/** @type {THREE.Group | null} */
let poiGroup = null;
/** @type {THREE.Object3D[]} */
export const poiMeshes = [];

export function buildPoiMarkers(data) {
  clearPoiMarkers();
  poiGroup = new THREE.Group();
  poiGroup.renderOrder = 6;

  // Stair markers
  const stairs = data.meta.stairs || [];
  for (const s of stairs) {
    if (!s.position) continue;
    const { px, py } = fabricToPixel(s.position.x, s.position.y);
    const { x, z } = pxToWorld(px, py);

    const cylGeom = new THREE.CylinderGeometry(0.8, 0.8, 2.5, 12);
    const cylMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x44aaff,
      emissiveIntensity: 0.3,
      roughness: 0.6,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(cylGeom, cylMat);
    mesh.position.set(x, 1.25, z);
    mesh.userData.poiType = 'stair';
    mesh.userData.poiId = s.id;
    mesh.userData.poiLabel = s.label || s.id;
    mesh.userData.poiInfo = `Stair: ${s.label || s.id} | Type: ${s.type || 'staircase'} | Connects: ${(s.connects || []).join(', ')}`;
    poiMeshes.push(mesh);
    poiGroup.add(mesh);
  }

  // Entrance markers
  const entrances = data.meta.entrances || [];
  for (const e of entrances) {
    if (!e.position) continue;
    const { px, py } = fabricToPixel(e.position.x, e.position.y);
    const { x, z } = pxToWorld(px, py);

    const ringGeom = new THREE.RingGeometry(0.6, 1.0, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(ringGeom, ringMat);
    mesh.position.set(x, 0.05, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.poiType = 'entrance';
    mesh.userData.poiId = e.id;
    mesh.userData.poiLabel = e.label || e.id;
    mesh.userData.poiInfo = `Entrance: ${e.label || e.id}${e.description ? ' | ' + e.description : ''}`;
    poiMeshes.push(mesh);
    poiGroup.add(mesh);
  }

  scene.add(poiGroup);
}

export function clearPoiMarkers() {
  poiMeshes.length = 0;
  if (poiGroup) {
    scene.remove(poiGroup);
    poiGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    poiGroup = null;
  }
}

/** @type {THREE.Mesh | null} */
let routeStairRing = null;

/** Highlight the stair used for multi-floor route transition with pulsing ring. */
export function highlightRouteStair(stairId, data) {
  clearRouteStairHighlight();
  const stair = (data.meta.stairs || []).find((/** @type {{id:string}} */ s) => s.id === stairId);
  if (!stair || !stair.position) return;
  const { px, py } = fabricToPixel(stair.position.x, stair.position.y);
  const { x, z } = pxToWorld(px, py);

  const ringGeom = new THREE.RingGeometry(1.5, 2.0, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  routeStairRing = new THREE.Mesh(ringGeom, ringMat);
  routeStairRing.position.set(x, 0.06, z);
  routeStairRing.rotation.x = -Math.PI / 2;
  routeStairRing.userData._pulseTime = 0;
  scene.add(routeStairRing);
}

export function clearRouteStairHighlight() {
  if (routeStairRing) {
    scene.remove(routeStairRing);
    routeStairRing.geometry.dispose();
    const mat = /** @type {THREE.Material} */ (routeStairRing.material);
    mat.dispose();
    routeStairRing = null;
  }
}

/** Animate pulsing ring (call from render loop). */
export function updateRouteStairPulse() {
  if (!routeStairRing) return;
  const t = performance.now() * 0.003;
  const scale = 1 + 0.2 * Math.sin(t);
  routeStairRing.scale.set(scale, scale, 1);
  const mat = /** @type {THREE.MeshBasicMaterial} */ (routeStairRing.material);
  mat.opacity = 0.3 + 0.3 * Math.sin(t + 1);
}

/** Handle click on a POI marker. Returns true if a POI was hit. */
export function handlePoiClick(intersects) {
  for (const hit of intersects) {
    const obj = hit.object;
    if (obj.userData.poiType) {
      const info = obj.userData.poiInfo;
      if (info) alert(info);
      const pos = obj.position;
      flyTo(new THREE.Vector3(pos.x + 15, 15, pos.z + 15), pos.clone(), 600);
      return true;
    }
  }
  return false;
}
