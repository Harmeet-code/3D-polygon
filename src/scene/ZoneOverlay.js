import * as THREE from 'three';
import { scene } from './SceneSetup.js';
import { fabricToPixel, pxToWorld, worldToPx, pixelToFabric } from './CoordTransform.js';

/** @type {THREE.Group | null} */
let zoneGroup = null;

const COLOR_FINAL = 0x888888;
const OPACITY_FINAL = 0.15;
const COLOR_PROPOSED = 0x44aaff;
const OPACITY_PROPOSED = 0.25;

/** Build a mesh for a rect zone. */
function buildRectMesh(zone, color, opacity) {
  const g = new THREE.Group();

  // Convert world coords to pixel coords for rendering
  const x1 = zone.x;
  const z1 = zone.y;
  const x2 = zone.x + zone.w;
  const z2 = zone.y + zone.h;

  const verts = [
    x1,
    0.03,
    z1,
    x2,
    0.03,
    z1,
    x2,
    0.03,
    z2,
    x1,
    0.03,
    z1,
    x2,
    0.03,
    z2,
    x1,
    0.03,
    z2,
  ];

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  g.add(new THREE.Mesh(geom, mat));

  // Outline
  const linePts = [
    new THREE.Vector3(x1, 0.035, z1),
    new THREE.Vector3(x2, 0.035, z1),
    new THREE.Vector3(x2, 0.035, z2),
    new THREE.Vector3(x1, 0.035, z2),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(1, opacity * 2),
  });
  g.add(new THREE.LineLoop(lineGeom, lineMat));

  return g;
}

/** Build a mesh for a polygon zone. */
function buildPolygonMesh(zone, color, opacity) {
  const g = new THREE.Group();

  const pts = zone.points.map((/** @type {number[]} */ fp) => {
    const { px, py } = fabricToPixel(fp[0], fp[1]);
    return pxToWorld(px, py);
  });

  if (pts.length < 3) {
    return g;
  }

  // Triangle fan
  const allVerts = [];
  const anchor = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    allVerts.push(anchor.x, 0.03, anchor.z, a.x, 0.03, a.z, b.x, 0.03, b.z);
  }

  if (allVerts.length > 0) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    g.add(new THREE.Mesh(geom, mat));
  }

  // Outline
  const linePts = pts.map((p) => new THREE.Vector3(p.x, 0.035, p.z));
  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(1, opacity * 2),
  });
  g.add(new THREE.LineLoop(lineGeom, lineMat));

  return g;
}

/** Build zone overlay from finalized zones + current proposed zone. */
export function updateZoneOverlay(finalZones, currentZone) {
  clearZoneOverlay();
  zoneGroup = new THREE.Group();
  zoneGroup.renderOrder = 4;

  // Final zones: grey translucent
  for (const z of finalZones) {
    if (z.type === 'rect') {
      zoneGroup.add(buildRectMesh(z, COLOR_FINAL, OPACITY_FINAL));
    } else if (z.type === 'polygon') {
      zoneGroup.add(buildPolygonMesh(z, COLOR_FINAL, OPACITY_FINAL));
    }
  }

  // Current zone: blue translucent
  if (currentZone) {
    if (currentZone.type === 'rect') {
      const { p1, p2 } = currentZone;
      const rectZone = {
        id: 'current',
        type: 'rect',
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.z, p2.z),
        w: Math.abs(p2.x - p1.x),
        h: Math.abs(p2.z - p1.z),
      };
      zoneGroup.add(buildRectMesh(rectZone, COLOR_PROPOSED, OPACITY_PROPOSED));
    } else if (currentZone.type === 'polygon' && currentZone.points.length >= 2) {
      const polyZone = {
        id: 'current',
        type: 'polygon',
        points: currentZone.points.map((wp) => {
          const { px, py } = worldToPx(wp.x, wp.z);
          const { x, y } = pixelToFabric(px, py);
          return [Math.round(x), Math.round(y)];
        }),
      };
      zoneGroup.add(buildPolygonMesh(polyZone, COLOR_PROPOSED, OPACITY_PROPOSED));
    }
  }

  scene.add(zoneGroup);
}

/** Build zone overlay from data (used on floor load). */
export function buildZoneOverlay(data) {
  const zones = data?.meta?.walkableZones || [];
  if (zones.length === 0) {
    clearZoneOverlay();
    return;
  }

  clearZoneOverlay();
  zoneGroup = new THREE.Group();
  zoneGroup.renderOrder = 4;

  for (const z of zones) {
    if (z.type === 'rect') {
      // Convert fabric coords to world coords for rendering
      const p1 = fabricToPixel(z.x, z.y);
      const p2 = fabricToPixel(z.x + z.w, z.y + z.h);
      const w1 = pxToWorld(p1.px, p1.py);
      const w2 = pxToWorld(p2.px, p2.py);

      const rectZone = {
        id: z.id,
        type: 'rect',
        x: Math.min(w1.x, w2.x),
        y: Math.min(w1.z, w2.z),
        w: Math.abs(w2.x - w1.x),
        h: Math.abs(w2.z - w1.z),
      };
      zoneGroup.add(buildRectMesh(rectZone, COLOR_FINAL, OPACITY_FINAL));
    } else if (z.type === 'polygon') {
      zoneGroup.add(buildPolygonMesh(z, COLOR_FINAL, OPACITY_FINAL));
    }
  }

  scene.add(zoneGroup);
}

export function clearZoneOverlay() {
  if (zoneGroup) {
    scene.remove(zoneGroup);
    zoneGroup.traverse((/** @type {any} */ c) => {
      if (c.geometry) {
        c.geometry.dispose();
      }
      if (c.material) {
        c.material.dispose();
      }
    });
    zoneGroup = null;
  }
}
