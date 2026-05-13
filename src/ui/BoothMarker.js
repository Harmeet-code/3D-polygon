import * as THREE from 'three';
import { worldToScreen, clamp } from '../scene/SceneSetup.js';

const boothMarker = /** @type {HTMLElement} */ (document.getElementById('boothMarker'));
const markerTitle = /** @type {HTMLElement} */ (document.getElementById('markerTitle'));
const markerClose = /** @type {HTMLElement} */ (document.getElementById('markerClose'));
const markerVideo = /** @type {HTMLIFrameElement} */ (document.getElementById('markerVideo'));

let markerMesh = null;

function getYouTubeEmbedUrl(inputUrl) {
  try {
    const u = new URL(inputUrl);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`;
    }
    const id = u.searchParams.get('v');
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`;
  } catch (e) {}
  return 'https://www.youtube.com/embed/TwzjLk0JIsk?autoplay=1&mute=1&playsinline=1&rel=0';
}

const YT_LINK = 'https://youtu.be/TwzjLk0JIsk?si=_UFzAz9h_wvfrQ9s';
const YT_EMBED = getYouTubeEmbedUrl(YT_LINK);

export function openMarkerFor(mesh) {
  markerMesh = mesh;
  const b = mesh.userData.booth;
  markerTitle.textContent = `Booth ${b.boothNo}`;
  markerVideo.src = YT_EMBED;
  boothMarker.style.display = 'block';
  positionMarker();
}

function closeMarker() {
  boothMarker.style.display = 'none';
  markerMesh = null;
  markerVideo.src = '';
}

markerClose.addEventListener('click', closeMarker);

export function positionMarker() {
  if (!markerMesh) return;
  const center = markerMesh.userData.center || markerMesh.getWorldPosition(new THREE.Vector3());
  const { x, y, ndcZ, rect } = worldToScreen(center);

  if (ndcZ < -1 || ndcZ > 1) {
    boothMarker.style.display = 'none';
    return;
  }

  boothMarker.style.display = 'block';
  boothMarker.style.left = `${x}px`;
  boothMarker.style.top = `${y}px`;

  const pad = 10;
  const w = boothMarker.offsetWidth;
  const h = boothMarker.offsetHeight;

  const cx = clamp(x, pad + w / 2, rect.width - pad - w / 2);
  const cy = clamp(y, pad + h, rect.height - pad);

  boothMarker.style.left = `${cx}px`;
  boothMarker.style.top = `${cy}px`;
}
