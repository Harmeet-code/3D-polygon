import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export let scene, camera, renderer, controls, hemi, dir, floor, floorTex, grid;
export let IMG_W, IMG_H, PLANE_W, PLANE_H;
export const boothGroup = new THREE.Group();
export const outlineGroup = new THREE.Group();

boothGroup.position.y = 0.06;
outlineGroup.position.y = 0.11;

export function worldToScreen(worldVec3) {
  const v = worldVec3.clone().project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (v.x * 0.5 + 0.5) * rect.width,
    y: (-v.y * 0.5 + 0.5) * rect.height,
    ndcZ: v.z,
    rect
  };
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function placeTooltipAt(worldPos, tooltip) {
  const { x, y, ndcZ, rect } = worldToScreen(worldPos);
  if (ndcZ < -1 || ndcZ > 1) {
    tooltip.style.display = 'none';
    return;
  }
  tooltip.style.display = 'block';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  const pad = 8;
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;
  const cx = clamp(x, pad + w / 2, rect.width - pad - w / 2);
  const cy = clamp(y, pad + h, rect.height - pad);
  tooltip.style.left = `${cx}px`;
  tooltip.style.top = `${cy}px`;
}

export async function initScene(stage) {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070b, 80, 240);

  camera = new THREE.PerspectiveCamera(55, stage.clientWidth / stage.clientHeight, 0.1, 1000);
  camera.position.set(70, 70, 90);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  stage.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 25;
  controls.maxDistance = 260;
  controls.target.set(0, 0, 0);

  hemi = new THREE.HemisphereLight(0xaecbff, 0x081018, 0.95);
  scene.add(hemi);
  dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(80, 120, 60);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  floorTex = await new Promise((res, rej) =>
    new THREE.TextureLoader().load(encodeURI('./data/DenverFloorPlan1.jpg'), res, undefined, rej)
  );
  floorTex.colorSpace = THREE.SRGBColorSpace;

  IMG_W = floorTex.image.width;
  IMG_H = floorTex.image.height;
  PLANE_W = 140;
  PLANE_H = PLANE_W * (IMG_H / IMG_W);

  floor = new THREE.Mesh(
    new THREE.PlaneGeometry(PLANE_W, PLANE_H),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  grid = new THREE.GridHelper(PLANE_W, 60, 0x20324a, 0x132033);
  grid.position.y = 0.02;
  grid.material.opacity = 0.18;
  grid.material.transparent = true;
  scene.add(grid);
  floor.renderOrder = -10;

  scene.add(boothGroup);
  scene.add(outlineGroup);
}
