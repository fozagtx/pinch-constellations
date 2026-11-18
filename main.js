import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Optional emulator (IWER) so the game can be shown on desktop as a Quest 3 with hands.
if (new URLSearchParams(location.search).has('emulate')) {
  try {
    const { XRDevice, metaQuest3 } = await import('https://esm.sh/iwer@2.8.0');
    const xrDevice = new XRDevice(metaQuest3);
    xrDevice.installRuntime({ forceInstall: true });
    xrDevice.primaryInputMode = 'hand';
    try {
      const { DevUI } = await import('https://esm.sh/@iwer/devui@2.8.0');
      new DevUI(xrDevice);
    } catch (e) { console.warn('DevUI unavailable', e); }
  } catch (e) { console.warn('IWER unavailable', e); }
}

// ---------- Levels (original patterns, coordinates in metres on a seated arc) ----------
const LEVELS = [
  { name: 'The Kite', stars: [[0, .16], [-.12, .02], [0, -.12], [.12, .02], [0, -.24]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]] },
  { name: 'The Lantern', stars: [[-.06, .18], [.06, .18], [-.14, .04], [.14, .04], [-.1, -.14], [.1, -.14], [0, -.22]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [4, 6], [5, 6]] },
  { name: 'The Heron', stars: [[-.2, .14], [-.1, .18], [-.04, .08], [.04, -.02], [.18, .02], [.06, -.12], [-.02, -.24], [.1, -.24]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5], [5, 6], [5, 7]] },
];
const PLANE_Z = -0.45;        // distance from the head at session start: airplane-seat reach
const GRAB_R = 0.05;          // pinch must start/end within 5 cm of a star

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] }));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 100);
scene.add(camera);

// Distant starfield for atmosphere
{
  const g = new THREE.BufferGeometry(); const p = [];
  for (let i = 0; i < 1500; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(20 + Math.random() * 10); p.push(v.x, v.y, v.z);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8899cc, size: 0.06 })));
}

const field = new THREE.Group();
scene.add(field);

// HUD
const hudCanvas = document.createElement('canvas'); hudCanvas.width = 1024; hudCanvas.height = 192;
const hudCtx = hudCanvas.getContext('2d');
const hudTex = new THREE.CanvasTexture(hudCanvas);
const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.075), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true }));
hud.position.set(0, 0.245, PLANE_Z);
scene.add(hud);
function drawHud(title, sub) {
  hudCtx.clearRect(0, 0, 1024, 192);
  hudCtx.fillStyle = '#e8ecff'; hudCtx.textAlign = 'center';
  hudCtx.font = '600 72px system-ui'; hudCtx.fillText(title, 512, 80);
  hudCtx.fillStyle = '#9fb4ff'; hudCtx.font = '44px system-ui'; hudCtx.fillText(sub, 512, 155);
  hudTex.needsUpdate = true;
}

// ---------- Audio ----------
let actx;
function tone(freq, dur = 0.5, type = 'sine', vol = 0.15) {
  actx ??= new AudioContext();
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
}
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

// ---------- Level state ----------
const starGeo = new THREE.SphereGeometry(0.012, 16, 12);
const hitGeo = new THREE.SphereGeometry(0.03, 8, 6);
let level = 0, stars = [], done = new Set(), ghostLines, startTime = performance.now(), flashes = [];

function key(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
function lineBetween(a, b, color, opacity) {
  const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function loadLevel(i) {
  field.clear(); stars = []; done = new Set();
  const L = LEVELS[i];
  L.stars.forEach(([x, y], idx) => {
    const z = PLANE_Z + (x * x) * 0.8; // gentle curve toward the user at the edges
    const m = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xbfd0ff }));
    m.position.set(x, y, z);
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.idx = idx; m.add(hit);
    field.add(m); stars.push(m);
  });
  ghostLines = new THREE.Group();
  L.edges.forEach(([a, b]) => ghostLines.add(lineBetween(stars[a].position, stars[b].position, 0x6677aa, 0.25)));
  field.add(ghostLines);
  drawHud(L.name, `0 / ${L.edges.length} lines`);
}

function tryConnect(a, b) {
  if (a === b || a == null || b == null) return;
  const L = LEVELS[level];
  const k = key(a, b);
  const isTarget = L.edges.some(([x, y]) => key(x, y) === k);
  if (isTarget && !done.has(k)) {
    done.add(k);
    field.add(lineBetween(stars[a].position, stars[b].position, 0xffe9a8, 1));
    [a, b].forEach(s => { stars[s].material.color.set(0xffe9a8); stars[s].userData.pulse = 1; });
    tone(SCALE[(done.size - 1) % SCALE.length]);
    drawHud(L.name, `${done.size} / ${L.edges.length} lines`);
    if (done.size === L.edges.length) completeLevel();
  } else if (!isTarget) {
    const l = lineBetween(stars[a].position, stars[b].position, 0xff6677, 0.9);
    field.add(l); flashes.push({ l, t: 0.6 }); tone(196, 0.3, 'triangle', 0.08);
  }
}

function completeLevel() {
  const L = LEVELS[level];
  [0, 2, 4, 7].forEach((n, i) => setTimeout(() => tone(SCALE[n], 0.9), i * 120));
  stars.forEach(s => (s.userData.pulse = 2));
  if (level + 1 < LEVELS.length) {
    drawHud(`${L.name} is lit`, 'Next constellation…');
    setTimeout(() => loadLevel(++level), 2500);
  } else {
    const secs = Math.round((performance.now() - startTime) / 1000);
    drawHud('The sky is lit', `${LEVELS.length} constellations in ${secs}s · pinch any star to replay`);
    level = -1;
  }
}

// ---------- Hand input (pinch = thumb tip near index tip) ----------
const hands = [0, 1].map(i => {
  const hand = renderer.xr.getHand(i);
  scene.add(hand);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fb4ff }));
  scene.add(tip); tip.visible = false;
  return { hand, tip, pinching: false, from: null, live: null, point: new THREE.Vector3() };
});

function nearestStar(p) {
  let best = null, bd = GRAB_R;
  stars.forEach((s, i) => { const d = s.getWorldPosition(new THREE.Vector3()).distanceTo(p); if (d < bd) { bd = d; best = i; } });
  return best;
}

function restartIfFinished() {
  if (level === -1) { level = 0; startTime = performance.now(); loadLevel(0); return true; }
  return false;
}

function beginDrag(h, starIdx) {
  if (starIdx == null) return;
  h.from = starIdx;
  h.live = lineBetween(stars[starIdx].position, stars[starIdx].position, 0xbfd0ff, 0.7);
  field.add(h.live);
  tone(SCALE[0] / 2, 0.15, 'sine', 0.05);
}
function moveDrag(h, p) {
  if (!h.live) return;
  const pos = h.live.geometry.attributes.position;
  const local = field.worldToLocal(p.clone());
  pos.setXYZ(1, local.x, local.y, local.z); pos.needsUpdate = true;
}
function endDrag(h, starIdx) {
  if (h.live) { field.remove(h.live); h.live.geometry.dispose(); h.live = null; }
  if (h.from != null) tryConnect(h.from, starIdx);
  h.from = null;
}

function updateHands() {
  for (const h of hands) {
    const j = h.hand.joints;
    const ti = j && j['index-finger-tip'], tt = j && j['thumb-tip'];
    if (!ti || !tt || !ti.visible) { h.tip.visible = false; if (h.pinching) { h.pinching = false; endDrag(h, null); } continue; }
    const a = ti.getWorldPosition(new THREE.Vector3()), b = tt.getWorldPosition(new THREE.Vector3());
    const d = a.distanceTo(b);
    h.point.copy(a).add(b).multiplyScalar(0.5);
    h.tip.visible = true; h.tip.position.copy(h.point);
    if (!h.pinching && d < 0.02) {
      h.pinching = true;
      if (!restartIfFinished()) beginDrag(h, nearestStar(h.point));
    } else if (h.pinching && d > 0.035) {
      h.pinching = false; endDrag(h, nearestStar(h.point));
    }
    h.tip.material.color.set(h.pinching ? 0xffe9a8 : 0x9fb4ff);
    if (h.pinching) moveDrag(h, h.point);
  }
}

// ---------- Mouse / touch fallback (desktop preview) ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const mouseHand = { from: null, live: null };
function pick(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(stars.map(s => s.children[0]))[0];
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLANE_Z);
  const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p);
  return { idx: hit ? hit.object.userData.idx : null, p };
}
renderer.domElement.addEventListener('pointerdown', e => { if (restartIfFinished()) return; beginDrag(mouseHand, pick(e).idx); });
renderer.domElement.addEventListener('pointermove', e => { if (mouseHand.live) moveDrag(mouseHand, pick(e).p); });
renderer.domElement.addEventListener('pointerup', e => endDrag(mouseHand, pick(e).idx));

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

// ---------- Loop ----------
const clock = new THREE.Clock();
loadLevel(0);
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta(), t = clock.elapsedTime;
  updateHands();
  stars.forEach((s, i) => {
    s.userData.pulse = Math.max(0, (s.userData.pulse || 0) - dt * 2);
    s.scale.setScalar(1 + 0.15 * Math.sin(t * 2 + i) + s.userData.pulse);
  });
  if (ghostLines) ghostLines.children.forEach(l => (l.material.opacity = 0.18 + 0.08 * Math.sin(t * 1.5)));
  flashes = flashes.filter(f => { f.t -= dt; f.l.material.opacity = Math.max(0, f.t); if (f.t <= 0) { field.remove(f.l); return false; } return true; });
  renderer.render(scene, camera);
});
