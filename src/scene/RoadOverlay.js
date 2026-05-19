import * as THREE from 'three';
import { scene } from './SceneSetup.js';
import { fabricToPixel, pxToWorld } from './CoordTransform.js';
import { polylineToCorridor } from './PolylineCorridor.js';

/** @type {THREE.Group | null} */
let roadGroup = null;

export function buildRoadOverlay(data) {
  clearRoadOverlay();
  const roads = data.meta.roads || [];
  if (roads.length === 0) return;

  roadGroup = new THREE.Group();
  roadGroup.renderOrder = 5;

  // Collect all triangle vertices for merged surface
  const allVerts = [];

  for (const road of roads) {
    const radius = road.width || 200;
    const corridor = polylineToCorridor(road.points, radius);
    if (corridor.length < 3) continue;

    const wp = corridor.map((/** @type {number[]} */ pt) => {
      const { px, py } = fabricToPixel(pt[0], pt[1]);
      return pxToWorld(px, py);
    });
    if (wp.length < 3) continue;

    const anchor = /** @type {{x:number,z:number}} */ (wp[0]);
    // Triangle fan from first vertex
    for (let i = 1; i < wp.length - 1; i++) {
      const a = /** @type {{x:number,z:number}} */ (wp[i]);
      const b = /** @type {{x:number,z:number}} */ (wp[i + 1]);
      allVerts.push(anchor.x, 0.04, anchor.z, a.x, 0.04, a.z, b.x, 0.04, b.z);
    }

    // Outline loop
    const linePts = wp.map(
      (/** @type {{x:number,z:number}} */ p) => new THREE.Vector3(p.x, 0.05, p.z)
    );
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x3a3a4a,
      transparent: true,
      opacity: 0.4
    });
    roadGroup.add(new THREE.LineLoop(lineGeom, lineMat));
  }

  if (allVerts.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2a2a2a,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    roadGroup.add(new THREE.Mesh(geom, mat));
  }

  scene.add(roadGroup);
}

export function clearRoadOverlay() {
  if (roadGroup) {
    scene.remove(roadGroup);
    roadGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    roadGroup = null;
  }
}
