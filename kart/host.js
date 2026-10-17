// Turbo Kart — tela do computador (host).
// Corrida de kart 3D (three.js) em tela dividida para 2 jogadores, com 2–4 karts da CPU.
// Os celulares mandam volante/acelerador/freio/item via WebRTC (PeerJS).
import * as THREE from 'three';
import { CHARACTERS, characterById } from './characters.js?v=20261017c'; // ?v= força o navegador a baixar a versão nova (mude junto com o index.html)
import { clone as cloneSkinned } from './vendor/addons/utils/SkeletonUtils.js';

// ========================================================================
// Configuração
// ========================================================================
const ID_PREFIX = 'turbokart-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const COLORS = ['#3b82f6', '#ec4899'];
const CPU_COLORS = ['#f97316', '#a855f7', '#14b8a6', '#eab308'];
const CPU_NAMES = ['CPU Laranja', 'CPU Roxo', 'CPU Verde-água', 'CPU Amarelo'];
const LAPS = 3;
const ROAD_HALF = 8; // meia largura da pista
const KERB = 1.6; // largura da zebra
const WALL = ROAD_HALF + 9; // distância do muro até o centro
const KART_R = 1.3;
const BASE_SPEED = 30; // velocidade máxima base (unidades/s)
const FINISH_GRACE = 20; // segundos que a corrida continua depois do 1º jogador terminar
const COOP_POINTS = [10, 7, 5, 3];

const $ = (s) => document.querySelector(s);
const testHooks = { autopilot: false, view: null }; // usado só pelos testes automatizados
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const ordinal = (n) => n + 'º';
const fmtTime = (t) => { const m = Math.floor(t / 60); const s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };

// ========================================================================
// Áudio sintetizado
// ========================================================================
let actx = null;
function audio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type, vol, slide, delay) {
  const a = actx;
  if (!a || a.state !== 'running') return;
  const t0 = a.currentTime + (delay || 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type || 'triangle';
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(vol || 0.06, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur);
}
const sfx = {
  beep: () => tone(440, 0.25, 'square', 0.06),
  go: () => tone(880, 0.6, 'square', 0.07),
  box: () => [660, 880, 1100].forEach((f, k) => tone(f, 0.08, 'square', 0.03, null, k * 0.05)),
  item: () => tone(1200, 0.05, 'square', 0.02),
  boost: () => tone(300, 0.5, 'sawtooth', 0.06, 3),
  spin: () => tone(500, 0.6, 'triangle', 0.08, 0.3),
  hit: () => tone(140, 0.25, 'square', 0.07, 0.5),
  lap: () => [784, 988].forEach((f, k) => tone(f, 0.15, 'triangle', 0.07, null, k * 0.12)),
  finish: () => [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, 0.2, 'triangle', 0.08, null, k * 0.12)),
  join: () => { tone(660, 0.08); tone(990, 0.12, 'triangle', 0.06, null, 0.09); },
};
window.addEventListener('pointerdown', audio);
window.addEventListener('keydown', audio);

// Ronco do motor dos dois jogadores
const engines = [];
function engineUpdate(i, speed, on) {
  const a = actx;
  if (!a || a.state !== 'running') return;
  if (!engines[i]) {
    const o = a.createOscillator();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    o.type = 'sawtooth';
    f.type = 'lowpass';
    f.frequency.value = 500;
    g.gain.value = 0;
    o.connect(f).connect(g).connect(a.destination);
    o.start();
    engines[i] = { o, g };
  }
  const e = engines[i];
  e.o.frequency.setTargetAtTime(55 + Math.abs(speed) * 4.5 + i * 7, a.currentTime, 0.05);
  e.g.gain.setTargetAtTime(on ? 0.025 : 0, a.currentTime, 0.1);
}

// ========================================================================
// Vagas dos jogadores, perguntas e fluxo (mesma base dos outros jogos)
// ========================================================================
// type: null | 'phone' | 'kbA' | 'kbB'
const emptyInput = () => ({ s: 0, g: 0, b: 0, i: 0 });
const slots = [0, 1].map((i) => ({
  i, type: null, conn: null, cid: null, connected: false, lastSeen: 0,
  pending: null, idle: { title: 'Conectado!', text: 'Aguarde…' }, input: emptyInput(), lastItem: 0, lastHud: '', driving: false,
}));
const slotReady = (s) => !!s.type && (s.type !== 'phone' || s.connected);
const allReady = () => slots.every(slotReady);

function sendTo(i, msg) {
  const s = slots[i];
  if (s.type === 'phone' && s.conn && s.conn.open) {
    try { s.conn.send(msg); } catch (e) {}
  }
}
function buzz(i, ms) { if (i >= 0) sendTo(i, { t: 'buzz', ms }); }
function setIdle(i, title, text) {
  const s = slots[i];
  s.idle = { title, text: text || '' };
  s.driving = false;
  if (!s.pending) sendTo(i, { t: 'idle', title, text: text || '' });
}
function setIdleBoth(title, text) { setIdle(0, title, text); setIdle(1, title, text); }
function setDriving(on) {
  for (const s of slots) {
    s.driving = on;
    s.input = emptyInput();
    s.lastItem = 0;
    s.lastHud = '';
    if (on) sendTo(s.i, { t: 'drive' });
  }
}

function updateLobbyUI() {
  document.querySelectorAll('.slot').forEach((el) => {
    const s = slots[+el.dataset.i];
    el.classList.toggle('on', slotReady(s));
    let label = 'aguardando…';
    if (s.type === 'phone') label = s.connected ? '📱 conectado' : '📱 reconectando…';
    else if (s.type === 'kbA') label = '⌨ WASD + E';
    else if (s.type === 'kbB') label = '⌨ setas + Shift';
    el.querySelector('span').textContent = label;
  });
  const n = slots.filter(slotReady).length;
  const bar = document.querySelector('#ov-lobby .pick-name');
  if (bar) bar.textContent = n === 2 ? 'Todos prontos! 🏁' : n === 1 ? '1 jogador conectado · falta 1' : 'Esperando os 2 jogadores entrarem…';
}

let token = 0;
let askSeq = 0;
const ABORT = { abort: true };

function sendAsk(i) {
  const p = slots[i].pending;
  if (p) sendTo(i, Object.assign({ t: 'ask', id: p.id }, p.spec));
}
function ask(i, spec) {
  return new Promise((resolve, reject) => {
    const id = ++askSeq;
    slots[i].driving = false;
    slots[i].pending = {
      id, spec,
      resolve: (opt) => {
        slots[i].pending = null;
        sendTo(i, Object.assign({ t: 'idle' }, slots[i].idle));
        resolve(opt);
      },
      reject,
    };
    sendAsk(i);
  });
}
function askRace(spec) {
  return new Promise((resolve, reject) => {
    let done = false;
    [0, 1].forEach((i) => {
      ask(i, spec).then((opt) => {
        if (done) return;
        done = true;
        const other = slots[1 - i];
        if (other.pending) {
          other.pending = null;
          sendTo(other.i, Object.assign({ t: 'idle' }, other.idle));
        }
        resolve({ i, opt });
      }, (e) => { if (!done) { done = true; reject(e); } });
    });
  });
}
function answer(i, id, opt) {
  const p = slots[i].pending;
  if (!p || p.id !== id) return;
  const o = p.spec.options.find((x) => x.id === opt);
  if (!o || o.disabled) return;
  p.resolve(opt);
}
function cancelAsks() {
  for (const s of slots) {
    if (s.pending) { const p = s.pending; s.pending = null; p.reject(ABORT); }
  }
  if (pickState.waiter) { const w = pickState.waiter; pickState.waiter = null; w.reject(ABORT); }
}
function sleep(ms) {
  const t = token;
  return new Promise((resolve, reject) => setTimeout(() => (t === token ? resolve() : reject(ABORT)), ms));
}
function runFlow(fn) {
  token++;
  cancelAsks();
  if (fn) fn().catch((e) => { if (e !== ABORT) console.error(e); });
}

// ========================================================================
// Rede (PeerJS)
// ========================================================================
let peer = null;
let roomCode = '';
function netStatus(text, err) {
  const el = $('#net-status');
  el.textContent = text;
  el.classList.toggle('err', !!err);
}
function showRoom() {
  $('#room-code').textContent = roomCode;
  const url = new URL('controller.html?room=' + roomCode, location.href).href;
  $('#room-url').textContent = url;
  if (typeof qrcode === 'function') {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  } else {
    $('#qr').textContent = 'QR indisponível — use o link e o código.';
  }
  if (location.protocol === 'file:') {
    netStatus('Abra esta página por um servidor web (http/https) para o celular conseguir acessar o link.', true);
  }
}
function startPeer() {
  if (typeof Peer === 'undefined') {
    netStatus('Não foi possível carregar a biblioteca de rede. Jogue pelo teclado ou verifique a internet.', true);
    return;
  }
  roomCode = '';
  for (let k = 0; k < 4; k++) roomCode += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
  // window.KART_PEER_OPTS permite usar um servidor PeerJS próprio (ex.: testes locais)
  peer = new Peer(ID_PREFIX + roomCode, window.KART_PEER_OPTS || {});
  peer.on('open', () => {
    showRoom();
    if (location.protocol !== 'file:') netStatus('Pronto! Esperando os celulares…');
  });
  peer.on('connection', (conn) => {
    conn.on('data', (m) => onMessage(conn, m));
    conn.on('close', () => dropConn(conn));
    conn.on('error', () => dropConn(conn));
  });
  peer.on('disconnected', () => {
    netStatus('Conexão com o servidor de pareamento perdida, reconectando…', true);
    setTimeout(() => { try { if (peer && !peer.destroyed) peer.reconnect(); } catch (e) {} }, 1500);
  });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') {
      peer.destroy();
      startPeer();
    } else if (err.type !== 'peer-unavailable') {
      netStatus('Erro de rede: ' + err.type + '. Tentando novamente…', true);
      if (peer.destroyed) setTimeout(startPeer, 3000);
    }
  });
}
function onMessage(conn, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello') return join(conn, String(m.cid || ''));
  const s = slots.find((x) => x.conn === conn);
  if (!s) return;
  s.lastSeen = performance.now();
  if (m.t === 'answer') answer(s.i, m.id, m.opt);
  else if (m.t === 'nav') pickNav(s.i, String(m.d));
  else if (m.t === 'in') {
    s.input.s = clamp(+m.s || 0, -1, 1);
    s.input.g = m.g ? 1 : 0;
    s.input.b = m.b ? 1 : 0;
    s.input.i = +m.i || 0;
  }
}
function join(conn, cid) {
  let s = slots.find((x) => x.type === 'phone' && cid && x.cid === cid);
  if (!s) s = slots.find((x) => !x.type);
  if (!s) {
    try { conn.send({ t: 'full' }); } catch (e) {}
    setTimeout(() => conn.close(), 500);
    return;
  }
  if (s.conn && s.conn !== conn) { try { s.conn.close(); } catch (e) {} }
  Object.assign(s, { type: 'phone', conn, cid, connected: true, lastSeen: performance.now(), input: emptyInput(), lastHud: '' });
  sfx.join();
  sendTo(s.i, { t: 'welcome', slot: s.i });
  if (s.pending) sendAsk(s.i);
  else if (state.screen === 'race') { s.driving = true; sendTo(s.i, { t: 'drive' }); s.lastItem = -1; }
  else if (state.screen === 'pick') sendPickState(s.i);
  else sendTo(s.i, Object.assign({ t: 'idle' }, s.idle));
  slotsChanged();
}
function dropConn(conn) {
  const s = slots.find((x) => x.conn === conn);
  if (!s) return;
  s.conn = null;
  s.connected = false;
  s.input = emptyInput();
  if (state.screen === 'lobby' || state.screen === 'menu' || state.screen === 'pick') { s.type = null; s.cid = null; }
  slotsChanged();
}
setInterval(() => {
  const now = performance.now();
  for (const s of slots) if (s.type === 'phone' && s.connected && now - s.lastSeen > 6000) dropConn(s.conn);
}, 1000);
function slotsChanged() {
  updateLobbyUI();
  if (state.screen === 'lobby' && allReady()) runFlow(menuFlow);
  else if ((state.screen === 'menu' || state.screen === 'pick') && !allReady()) toLobby();
}

// ========================================================================
// Teclado
// ========================================================================
const keys = {};
const ASK_KEYS = [['Digit1', 'Digit2', 'Digit3'], ['Digit9', 'Digit0', 'Minus']];
// Seleção de piloto pelo teclado (como um controle: direcional + OK + voltar)
const PICK_KEYS_A = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyE: 'ok', Space: 'ok', KeyQ: 'back' };
const PICK_KEYS_B = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'ok', NumpadEnter: 'ok', ShiftRight: 'ok', Backspace: 'back', Slash: 'back' };
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (state.screen === 'lobby') {
    if (e.code === 'Space') kbJoin('kbA');
    if (e.code === 'Enter' || e.code === 'NumpadEnter') kbJoin('kbB');
  } else if (state.screen === 'pick') {
    for (const s of slots) {
      const map = s.type === 'kbA' ? PICK_KEYS_A : s.type === 'kbB' ? PICK_KEYS_B : null;
      if (map && map[e.code]) pickNav(s.i, map[e.code]);
    }
  } else if (e.code === 'Escape' && state.screen !== 'race') {
    for (const s of slots) if (s.type === 'kbA' || s.type === 'kbB') s.type = null;
    toLobby();
  }
  for (const s of slots) {
    if (!s.pending || (s.type !== 'kbA' && s.type !== 'kbB')) continue;
    const k = ASK_KEYS[s.type === 'kbA' ? 0 : 1].indexOf(e.code);
    const opts = s.pending.spec.options;
    if (k >= 0 && k < opts.length) answer(s.i, s.pending.id, opts[k].id);
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function kbJoin(type) {
  if (slots.some((s) => s.type === type)) return;
  const s = slots.find((x) => !x.type);
  if (!s) return;
  s.type = type;
  sfx.join();
  slotsChanged();
}
function readKeyboard(s, dt) {
  const A = s.type === 'kbA';
  const left = A ? keys.KeyA : keys.ArrowLeft;
  const right = A ? keys.KeyD : keys.ArrowRight;
  const target = (right ? 1 : 0) - (left ? 1 : 0);
  const k = Math.min(1, dt * 6);
  s.input.s += (target - s.input.s) * k;
  s.input.g = (A ? keys.KeyW : keys.ArrowUp) ? 1 : 0;
  s.input.b = (A ? keys.KeyS : keys.ArrowDown) ? 1 : 0;
  const itemKey = A ? keys.KeyE : keys.ShiftRight || keys.Slash;
  if (itemKey && !s.kbItemHeld) s.input.i++;
  s.kbItemHeld = !!itemKey;
}

// ========================================================================
// Cena 3D
// ========================================================================
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8ecbff');
scene.fog = new THREE.Fog('#8ecbff', 140, 420);
scene.add(new THREE.HemisphereLight('#dff1ff', '#4d7a3a', 1.6));
const sun = new THREE.DirectionalLight('#fff5e0', 1.8);
sun.position.set(80, 140, 40);
scene.add(sun);

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// ------------------------------------------------------------------------
// Pista: curva fechada (Catmull-Rom) amostrada em N pontos
// ------------------------------------------------------------------------
// Pontos de controle (x, z). Raio mínimo das curvas ≈ 23 (> distância do muro), sem trechos se sobrepondo.
const CONTROL = [
  [0, 0], [80, 0], [150, -4], [200, 22], [215, 80], [192, 134], [140, 152], [100, 136],
  [60, 150], [36, 198], [-22, 216], [-92, 198], [-130, 156], [-122, 108], [-146, 62], [-130, 12], [-78, -8],
];
const curve = new THREE.CatmullRomCurve3(CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
const N = 1000;
const C = []; // centro
const T = []; // tangente
const S = []; // lateral (direita)
for (let k = 0; k < N; k++) {
  const p = curve.getPointAt(k / N);
  const t = curve.getTangentAt(k / N).setY(0).normalize();
  C.push(p);
  T.push(t);
  S.push(new THREE.Vector3(-t.z, 0, t.x));
}
let TRACK_LEN = 0;
for (let k = 0; k < N; k++) TRACK_LEN += C[k].distanceTo(C[(k + 1) % N]);
const SPACING = TRACK_LEN / N;
const at = (k) => ((k % N) + N) % N;
// Rotação (em z) de um plano deitado (rotation.x = -90°) para seu eixo X local ficar na direção v
const flatYaw = (v) => Math.atan2(-v.z, v.x);

// Ponto mais próximo do centro, buscando perto do último índice conhecido
function nearestIdx(x, z, guess, win) {
  let best = guess, bd = Infinity;
  for (let d = -win; d <= win; d++) {
    const k = at(guess + d);
    const dx = x - C[k].x, dz = z - C[k].z;
    const dd = dx * dx + dz * dz;
    if (dd < bd) { bd = dd; best = k; }
  }
  return best;
}
function nearestIdxGlobal(x, z) {
  return nearestIdx(x, z, 0, N / 2);
}
function lateralOf(x, z, k) {
  return (x - C[k].x) * S[k].x + (z - C[k].z) * S[k].z;
}

// Faixa ao longo da pista entre duas distâncias laterais
function ribbon(from, to, y, material, vScale) {
  const pos = [], uv = [], idx = [];
  let v = 0;
  for (let k = 0; k <= N; k++) {
    const c = C[at(k)], s = S[at(k)];
    pos.push(c.x + s.x * from, y, c.z + s.z * from, c.x + s.x * to, y, c.z + s.z * to);
    uv.push(0, v, 1, v);
    v += SPACING / vScale;
    if (k < N) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // anti-horário visto de cima
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  scene.add(m);
  return m;
}

// Chão de grama
const grassTex = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#5fae4a';
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < 2500; k++) {
    g.fillStyle = Math.random() < 0.5 ? '#56a243' : '#6bbb54';
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
}, true);
grassTex.repeat.set(90, 90);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: grassTex }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(40, -0.02, 100);
scene.add(ground);

// Asfalto com faixas
const roadTex = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#4b4f5c';
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < 1800; k++) {
    g.fillStyle = Math.random() < 0.5 ? '#454956' : '#535867';
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.fillStyle = '#f1f1f1';
  g.fillRect(6, 0, 6, h);
  g.fillRect(w - 12, 0, 6, h);
  g.fillStyle = '#f6d35b';
  g.fillRect(w / 2 - 3, 0, 6, h / 2);
}, true);
ribbon(-ROAD_HALF, ROAD_HALF, 0.02, new THREE.MeshLambertMaterial({ map: roadTex }), 10);

const kerbTex = canvasTexture(32, 64, (g, w, h) => {
  g.fillStyle = '#e11d48';
  g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#ffffff';
  g.fillRect(0, h / 2, w, h / 2);
}, true);
const kerbMat = new THREE.MeshLambertMaterial({ map: kerbTex });
ribbon(-ROAD_HALF - KERB, -ROAD_HALF, 0.04, kerbMat, 3);
ribbon(ROAD_HALF, ROAD_HALF + KERB, 0.04, kerbMat, 3);

// Muros baixos (faixa vertical dos dois lados)
function wall(lat) {
  const pos = [], uv = [], idx = [];
  let v = 0;
  for (let k = 0; k <= N; k++) {
    const c = C[at(k)], s = S[at(k)];
    const x = c.x + s.x * lat, z = c.z + s.z * lat;
    pos.push(x, 0, z, x, 1.3, z);
    uv.push(v, 0, v, 1);
    v += SPACING / 4;
    if (k < N) {
      const a = k * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tex = canvasTexture(64, 32, (c, w, h) => {
    c.fillStyle = '#f8fafc';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#2563eb';
    c.fillRect(0, 0, w / 2, h);
  }, true);
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })));
}
wall(-WALL);
wall(WALL);

// Linha de chegada quadriculada
const checkerTex = canvasTexture(128, 32, (g, w, h) => {
  const q = 16;
  for (let y = 0; y < h; y += q) for (let x = 0; x < w; x += q) {
    g.fillStyle = ((x + y) / q) % 2 ? '#111' : '#fff';
    g.fillRect(x, y, q, q);
  }
});
const startLine = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 2.5), new THREE.MeshLambertMaterial({ map: checkerTex }));
startLine.rotation.x = -Math.PI / 2;
startLine.rotation.z = flatYaw(S[0]); // largura do quadriculado na lateral da pista
startLine.position.copy(C[0]).setY(0.05);
scene.add(startLine);
// Pórtico de largada
{
  const mat = new THREE.MeshLambertMaterial({ color: '#334155' });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), mat);
    post.position.copy(C[0]).addScaledVector(S[0], side * (ROAD_HALF + 2.5)).setY(4);
    scene.add(post);
  }
  const bannerTex = canvasTexture(512, 64, (g, w, h) => {
    g.fillStyle = '#111827';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#facc15';
    g.font = 'italic 900 44px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🏁 TURBO KART 🏁', w / 2, h / 2 + 2);
  });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 6, 2, 0.5), [
    mat, mat, mat, mat, new THREE.MeshBasicMaterial({ map: bannerTex }), new THREE.MeshBasicMaterial({ map: bannerTex }),
  ]);
  banner.position.copy(C[0]).setY(8);
  banner.rotation.y = Math.atan2(-S[0].z, S[0].x);
  scene.add(banner);
}

// Árvores e montanhas (decoração)
{
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6);
  const leafGeo = new THREE.ConeGeometry(2.4, 6, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#7c4a22' });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#2f7d32' });
  const spots = [];
  for (let k = 0; k < 900 && spots.length < 220; k++) {
    const x = rand(-260, 330), z = rand(-140, 340);
    const i = nearestIdxGlobal(x, z);
    const d = Math.hypot(x - C[i].x, z - C[i].z);
    if (d < WALL + 5) continue;
    spots.push([x, z, rand(0.7, 1.4)]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z, s], k) => {
    m.makeScale(s, s, s).setPosition(x, 1.2 * s, z);
    trunks.setMatrixAt(k, m);
    m.makeScale(s, s, s).setPosition(x, 5 * s, z);
    leaves.setMatrixAt(k, m);
  });
  scene.add(trunks, leaves);
  const mtMat = new THREE.MeshLambertMaterial({ color: '#6b8fb0' });
  const snowMat = new THREE.MeshLambertMaterial({ color: '#f1f5f9' });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = rand(330, 380), h = rand(50, 110);
    const mt = new THREE.Mesh(new THREE.ConeGeometry(rand(50, 80), h, 6), mtMat);
    mt.position.set(40 + Math.cos(a) * r, h / 2 - 2, 100 + Math.sin(a) * r);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rand(14, 20), h * 0.25, 6), snowMat);
    cap.position.set(mt.position.x, h - h * 0.125 - 2, mt.position.z);
    scene.add(mt, cap);
  }
}

// ------------------------------------------------------------------------
// Caixas de item e placas de turbo
// ------------------------------------------------------------------------
const boxTex = canvasTexture(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#f472b6');
  gr.addColorStop(0.5, '#facc15');
  gr.addColorStop(1, '#38bdf8');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff';
  g.lineWidth = 8;
  g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#fff';
  g.font = '900 90px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', w / 2, h / 2 + 6);
});
const boxGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
const boxMat = new THREE.MeshLambertMaterial({ map: boxTex, transparent: true, opacity: 0.92 });
const itemBoxes = [];
for (const f of [0.2, 0.52, 0.8]) {
  const k = Math.floor(f * N);
  for (const lat of [-5.5, -1.8, 1.8, 5.5]) {
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    const p = C[k].clone().addScaledVector(S[k], lat);
    mesh.position.set(p.x, 1.3, p.z);
    scene.add(mesh);
    itemBoxes.push({ mesh, x: p.x, z: p.z, respawn: 0, phase: Math.random() * 6 });
  }
}

const boostTex = canvasTexture(64, 128, (g, w, h) => {
  g.fillStyle = '#f97316';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fde047';
  for (let y = 0; y < h; y += 64) {
    g.beginPath();
    g.moveTo(8, y + 46); g.lineTo(w / 2, y + 14); g.lineTo(w - 8, y + 46); g.lineTo(w - 8, y + 60); g.lineTo(w / 2, y + 28); g.lineTo(8, y + 60);
    g.closePath();
    g.fill();
  }
}, true);
boostTex.repeat.set(1, 2);
const boostPads = [];
for (const [f, lat] of [[0.09, 0], [0.36, -3], [0.64, 3]]) {
  const k = Math.floor(f * N);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ map: boostTex }));
  pad.rotation.x = -Math.PI / 2;
  pad.rotation.z = Math.atan2(-T[k].x, -T[k].z); // setas apontando no sentido da corrida
  const p = C[k].clone().addScaledVector(S[k], lat);
  pad.position.set(p.x, 0.06, p.z);
  scene.add(pad);
  boostPads.push({ x: p.x, z: p.z, k });
}

// ========================================================================
// Karts
// ========================================================================
function labelSprite(text, color) {
  const tex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(10,15,35,0.75)';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 18);
    g.fill();
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '900 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
  // Tamanho fixo na tela (não fica gigante quando o kart está perto da câmera)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, sizeAttenuation: false }));
  sp.scale.set(0.11, 0.0275, 1);
  sp.position.y = 2.8;
  sp.renderOrder = 10;
  return sp;
}

// Placeholder do piloto (troque por um modelo em characters.js)
function buildDriver(char) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 4, 10), new THREE.MeshLambertMaterial({ color: char.color }));
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), new THREE.MeshLambertMaterial({ color: '#f5d0a9' }));
  head.position.y = 1.45;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: char.accent }));
  helmet.position.y = 1.5;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.12), new THREE.MeshLambertMaterial({ color: '#0f172a' }));
  visor.position.set(0, 1.47, 0.34);
  // Letra do personagem no peito, para diferenciar os placeholders
  const tagTex = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(w / 2, h / 2, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = char.color;
    c.font = '900 40px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(char.id.toUpperCase(), w / 2, h / 2 + 2);
  });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }));
  tag.position.set(0, 0.85, 0.43);
  g.add(body, head, helmet, visor, tag);
  return g;
}

// ------------------------------------------------------------------------
// Modelos 3D dos personagens (glTF/GLB, com suporte a compressão Draco)
// ------------------------------------------------------------------------
let loaderPromise = null;
function getLoader() {
  if (!loaderPromise) {
    loaderPromise = Promise.all([
      import('./vendor/addons/loaders/GLTFLoader.js'),
      import('./vendor/addons/loaders/DRACOLoader.js'),
    ]).then(([g, d]) => {
      const loader = new g.GLTFLoader();
      const draco = new d.DRACOLoader();
      draco.setDecoderPath(new URL('./vendor/addons/libs/draco/', import.meta.url).href);
      loader.setDRACOLoader(draco);
      return loader;
    });
  }
  return loaderPromise;
}
const modelCache = new Map(); // url -> Promise<gltf>
function loadModel(url) {
  if (!modelCache.has(url)) modelCache.set(url, getLoader().then((l) => l.loadAsync(url)));
  return modelCache.get(url);
}

// Pose sentada para o rig dos Miis (ossos apontam no +Y local; o modelo olha para +Z).
// Cada osso é apontado numa direção no espaço do modelo, dos pais para os filhos.
// Os nomes vêm sem ponto porque o three.js remove "." dos nomes ("thigh.L" → "thighL").
const SEAT_POSE = [
  ['thighL', [0.1, -0.05, 1]],
  ['thighR', [-0.1, -0.05, 1]],
  ['shinL', [0, -1, 0.3]],
  ['shinR', [0, -1, 0.3]],
  ['footL', [0, 0.2, 1]],
  ['footR', [0, 0.2, 1]],
  ['upperarmL', [0.35, -0.55, 0.75]],
  ['upperarmR', [-0.35, -0.55, 0.75]],
  ['forearmL', [-0.3, 0.05, 1]],
  ['forearmR', [0.3, 0.05, 1]],
];
// Ossos usados no aceno de comemoração (só a parte de cima, para continuar sentado)
const WAVE_BONES = new Set(['spine', 'neck', 'head', 'shoulderL', 'upperarmL', 'forearmL', 'handL', 'shoulderR', 'upperarmR', 'forearmR', 'handR']);

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _va = new THREE.Vector3();
function aimBone(bone, dir) {
  bone.updateWorldMatrix(true, false);
  bone.getWorldQuaternion(_qa);
  _va.set(0, 1, 0).applyQuaternion(_qa).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(_va, new THREE.Vector3(...dir).normalize());
  const worldQ = delta.multiply(_qa);
  bone.parent.getWorldQuaternion(_qb);
  bone.quaternion.copy(_qb.invert().multiply(worldQ));
  bone.updateWorldMatrix(false, true);
}
function applySeatPose(obj) {
  obj.updateMatrixWorld(true);
  for (const [name, dir] of SEAT_POSE) {
    const bone = obj.getObjectByName(name);
    if (bone && bone.parent) aimBone(bone, dir);
  }
}

function loadCharacterModel(char, body, placeholder, kart) {
  const m = char.model;
  if (!m || !m.url) return;
  loadModel(m.url).then((gltf) => {
    if (!body.parent || !body.parent.parent) return; // o kart já saiu da cena
    const obj = cloneSkinned(gltf.scene); // clone com esqueleto próprio (vários karts podem usar o mesmo modelo)
    if (m.pose !== false) applySeatPose(obj);
    obj.traverse((o) => { if (o.isMesh) o.frustumCulled = false; }); // a pose muda o volume da malha
    const holder = new THREE.Group();
    holder.add(obj);
    holder.scale.setScalar(m.scale || 1);
    holder.rotation.y = m.rotationY || 0;
    holder.position.set(0, m.offsetY || 0, m.offsetZ || 0);
    placeholder.visible = false;
    body.add(holder);
    const clip = gltf.animations.find((a) => /wave/i.test(a.name));
    if (clip && kart) {
      const tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') && WAVE_BONES.has(t.name.slice(0, -'.quaternion'.length)));
      if (tracks.length) {
        kart.mixer = new THREE.AnimationMixer(obj);
        kart.waveAction = kart.mixer.clipAction(new THREE.AnimationClip('wave-upper', clip.duration, tracks));
      }
    }
  }).catch((err) => console.warn('Não foi possível carregar o modelo de ' + char.name + ' (' + m.url + '). Usando placeholder.', err));
}

// Carrega os modelos logo no início, para já estarem prontos na corrida
for (const c of CHARACTERS) if (c.model && c.model.url) loadModel(c.model.url).catch(() => {});

function buildKart(color, char, kart, target = scene) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // gira no "rodopio" e inclina nas curvas
  root.add(body);
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: '#1f2937' });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 2.3), paint);
  chassis.position.y = 0.42;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.6), paint);
  nose.position.set(0, 0.5, 1.3);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.25), dark);
  bumper.position.set(0, 0.35, 1.62);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.4), dark);
  spoiler.position.set(0, 1.0, -1.15);
  const sPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), dark);
  sPost.position.set(0, 0.78, -1.1);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.25), dark);
  seat.position.set(0, 0.8, -0.78);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 16), dark);
  steering.position.set(0, 0.82, 0.08);
  steering.rotation.x = -1.1;
  body.add(chassis, nose, bumper, spoiler, sPost, seat, steering);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z, front] of [[-0.85, 0.85, 1], [0.85, 0.85, 1], [-0.85, -0.85, 0], [0.85, -0.85, 0]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, 0.38, z);
    w.userData.front = front;
    body.add(w);
    wheels.push(w);
  }
  const driver = buildDriver(char);
  driver.position.set(0, 0.35, -0.35);
  body.add(driver);
  loadCharacterModel(char, body, driver, kart);
  // Chama do turbo
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 8), new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.5, -1.7);
  flame.visible = false;
  body.add(flame);
  // Sombra simples
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.scale.set(0.8, 1.2, 1);
  root.add(shadow);
  target.add(root);
  return { root, body, wheels, flame, paint };
}

const ITEMS = {
  cogumelo: { icon: '🍄', name: 'Cogumelo turbo' },
  banana: { icon: '🍌', name: 'Banana' },
  casco: { icon: '🔴', name: 'Casco teleguiado' },
  estrela: { icon: '⭐', name: 'Estrela' },
};
const ITEM_KEYS = Object.keys(ITEMS);

const state = {
  screen: 'lobby', // lobby | menu | pick | race | results
  mode: null,
  karts: [],
  hazards: [], // bananas
  shells: [],
  phase: 'idle', // idle | countdown | racing | done
  raceTime: 0,
  countdown: 0,
  firstHumanFinish: null,
  picks: [null, null],
  attract: true,
};

function makeKart(opts) {
  const char = characterById(opts.charId);
  const k = {
    id: state.karts.length,
    human: opts.human, // índice do jogador ou -1
    team: opts.human >= 0 ? 'human' : 'cpu',
    name: opts.name,
    color: opts.color,
    char,
    x: 0, z: 0, heading: 0, speed: 0, steer: 0,
    idx: 0, travel: 0, lapShown: 1,
    finished: false, finishTime: 0, rank: 0,
    item: null, rolling: 0, boost: 0, spin: 0, star: 0, offroad: false, wrongT: 0, msg: '', msgT: 0,
    lastBox: -1, padCd: 0,
    ai: { lane: rand(-3, 3), laneT: rand(1, 4), itemT: rand(1, 4), skill: opts.skill || 0.9, stuckT: 0 },
    prevGas: 0, startBoost: false,
  };
  k.mesh = buildKart(opts.color, char, k);
  if (opts.label) {
    const lbl = labelSprite(opts.label, opts.color);
    if (opts.human >= 0) lbl.layers.set(1 + opts.human); // não aparece na câmera do próprio jogador
    k.mesh.root.add(lbl);
  }
  state.karts.push(k);
  return k;
}

function clearKarts() {
  for (const k of state.karts) {
    scene.remove(k.mesh.root);
    // Geometrias dos modelos .glb são compartilhadas pelo cache, então só descarta as do kart
    k.mesh.root.traverse((o) => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); });
  }
  state.karts = [];
  for (const h of state.hazards) scene.remove(h.mesh);
  for (const s of state.shells) scene.remove(s.mesh);
  state.hazards = [];
  state.shells = [];
}

// Coloca os karts no grid de largada (atrás da linha)
function placeOnGrid(order) {
  order.forEach((k, n) => {
    const row = Math.floor(n / 2);
    const back = Math.round((7 + row * 6.5) / SPACING);
    const idx = at(-back);
    const lat = n % 2 === 0 ? -3.2 : 3.2;
    k.x = C[idx].x + S[idx].x * lat;
    k.z = C[idx].z + S[idx].z * lat;
    k.heading = Math.atan2(T[idx].x, T[idx].z);
    k.idx = idx;
    k.travel = idx - N;
    k.speed = 0;
    k.mesh.root.position.set(k.x, 0, k.z);
    k.mesh.root.rotation.y = k.heading;
  });
}

// ========================================================================
// Física e regras
// ========================================================================
const cameras = [0, 1].map((i) => {
  const cam = new THREE.PerspectiveCamera(68, 2, 0.3, 900);
  cam.layers.enableAll();
  cam.layers.disable(1 + i);
  cam.userData.init = false;
  return cam;
});
const attractCam = new THREE.PerspectiveCamera(55, 16 / 9, 0.5, 1200);

function forward(k) { return { x: Math.sin(k.heading), z: Math.cos(k.heading) }; }

function rankedKarts() {
  return state.karts.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.travel - a.travel;
  });
}

function setMsg(k, text, secs) { k.msg = text; k.msgT = secs || 1.5; }

function spinOut(k, by) {
  if (k.star > 0 || k.spin > 0) return;
  k.spin = 1.25;
  k.speed *= 0.25;
  if (k.human >= 0) { buzz(k.human, 350); sfx.spin(); setMsg(k, '💫 Rodou!', 1.2); }
  if (by && by.human >= 0 && by !== k) buzz(by.human, 80);
}

// Fogo amigo desligado no cooperativo entre os dois jogadores
function canHit(owner, target) {
  if (!owner || owner === target) return owner !== target;
  if (state.mode === 'coop' && owner.team === 'human' && target.team === 'human') return false;
  return true;
}

function rollItem(k) {
  const n = state.karts.length;
  const r = k.rank || n; // 1 = primeiro
  const behind = (r - 1) / Math.max(1, n - 1); // 0 = líder, 1 = último
  const w = {
    cogumelo: 2 + behind * 3,
    banana: 3.5 - behind * 3,
    casco: behind > 0 ? 1.5 + behind * 1.5 : 0.4,
    estrela: behind > 0.6 ? 1.2 : 0,
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let x = Math.random() * total;
  for (const key of ITEM_KEYS) { x -= w[key]; if (x < 0) return key; }
  return 'cogumelo';
}

function useItem(k) {
  if (!k.item || k.rolling > 0 || k.spin > 0) return;
  const it = k.item;
  k.item = null;
  const f = forward(k);
  if (it === 'cogumelo') {
    k.boost = 1.4;
    if (k.human >= 0) { sfx.boost(); buzz(k.human, 120); }
  } else if (it === 'estrela') {
    k.star = 6;
    k.boost = Math.max(k.boost, 0.5);
    if (k.human >= 0) { sfx.boost(); buzz(k.human, 200); }
  } else if (it === 'banana') {
    const mesh = buildBanana();
    const x = k.x - f.x * 2.6, z = k.z - f.z * 2.6;
    mesh.position.set(x, 0.3, z);
    scene.add(mesh);
    state.hazards.push({ x, z, owner: k, mesh, age: 0 });
    if (state.hazards.length > 14) scene.remove(state.hazards.shift().mesh);
    if (k.human >= 0) sfx.item();
  } else if (it === 'casco') {
    // Mira no kart logo à frente (que possa ser atingido)
    const ranked = rankedKarts();
    let target = null;
    for (let r = ranked.indexOf(k) - 1; r >= 0; r--) {
      if (!ranked[r].finished && canHit(k, ranked[r])) { target = ranked[r]; break; }
    }
    const mesh = buildShell();
    mesh.position.set(k.x + f.x * 2.2, 0.5, k.z + f.z * 2.2);
    scene.add(mesh);
    state.shells.push({ x: mesh.position.x, z: mesh.position.z, heading: k.heading, idx: k.idx, owner: k, target, mesh, life: 7, speed: Math.max(48, k.speed + 18) });
    if (k.human >= 0) sfx.item();
  }
}

function buildBanana() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#facc15' });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 3, 8), mat);
    c.rotation.z = s * 0.6;
    c.position.x = s * 0.18;
    g.add(c);
  }
  return g;
}
function buildShell() {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#dc2626' }));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 14), new THREE.MeshLambertMaterial({ color: '#fef3c7' }));
  base.position.y = -0.05;
  g.add(s, base);
  return g;
}

function kartInput(k, dt) {
  // Entrada do jogador (celular ou teclado) — ou piloto automático (CPU / depois de terminar)
  if (k.human >= 0 && !k.finished && !testHooks.autopilot) {
    const s = slots[k.human];
    if (s.type === 'kbA' || s.type === 'kbB') readKeyboard(s, dt);
    const inp = s.input;
    if (inp.i !== s.lastItem) {
      if (s.lastItem !== -1) useItem(k);
      s.lastItem = inp.i;
    }
    return { steer: inp.s, gas: inp.g, brake: inp.b };
  }
  return aiInput(k, dt);
}

function aiInput(k, dt) {
  const ai = k.ai;
  ai.laneT -= dt;
  if (ai.laneT <= 0) { ai.laneT = rand(2, 5); ai.lane = rand(-4.5, 4.5); }
  const look = Math.round((9 + Math.abs(k.speed) * 0.35) / SPACING);
  const t = at(k.idx + look);
  const tx = C[t].x + S[t].x * ai.lane, tz = C[t].z + S[t].z * ai.lane;
  const want = Math.atan2(tx - k.x, tz - k.z);
  const diff = wrapAngle(want - k.heading);
  let steer = clamp(-diff * 2.6, -1, 1);
  let gas = 1, brake = 0;
  if (Math.abs(diff) > 0.9 && k.speed > 14) { gas = 0; brake = 1; }
  // Preso no muro: dá ré um pouco
  if (state.phase === 'racing' && Math.abs(k.speed) < 2) ai.stuckT += dt; else ai.stuckT = Math.max(0, ai.stuckT - dt);
  if (ai.stuckT > 1.5) { gas = 0; brake = 1; steer = -steer; if (ai.stuckT > 2.6) ai.stuckT = 0; }
  // Itens
  if (k.item && k.rolling <= 0 && !k.finished) {
    ai.itemT -= dt;
    if (ai.itemT <= 0) { useItem(k); ai.itemT = rand(2, 6); }
  }
  return { steer, gas, brake };
}

function cpuSpeedFactor(k) {
  if (k.team !== 'cpu') return 1;
  // "Elástico": CPU acelera se ficou muito para trás dos jogadores e alivia se abriu vantagem
  const humans = state.karts.filter((h) => h.team === 'human');
  if (!humans.length) return k.ai.skill;
  const best = Math.max(...humans.map((h) => h.travel));
  const gap = (k.travel - best) / N; // em voltas
  let f = k.ai.skill;
  if (gap < -0.12) f += 0.09;
  else if (gap > 0.15) f -= 0.07;
  return f;
}

function updateKart(k, dt) {
  const racing = state.phase === 'racing';
  let { steer, gas, brake } = state.phase === 'countdown' ? { steer: 0, gas: 0, brake: 0 } : kartInput(k, dt);
  if (state.phase === 'countdown' && k.human >= 0) {
    // Largada turbo: segurar o acelerador no "1"
    const s = slots[k.human];
    if (s.type === 'kbA' || s.type === 'kbB') readKeyboard(s, dt);
    k.startBoost = state.countdown < 1.2 && state.countdown > 0 && s.input.g === 1;
  }
  if (!racing && state.phase !== 'idle' && state.phase !== 'done') { gas = 0; brake = 0; }

  k.boost = Math.max(0, k.boost - dt);
  k.star = Math.max(0, k.star - dt);
  k.padCd = Math.max(0, k.padCd - dt);
  k.msgT = Math.max(0, k.msgT - dt);
  if (k.spin > 0) { k.spin -= dt; gas = 0; brake = 0; steer = 0; }
  if (k.rolling > 0) {
    k.rolling -= dt;
    if (k.rolling <= 0) {
      k.item = rollItem(k);
      if (k.human >= 0) sfx.box();
    }
  }

  const st = k.char.stats;
  let maxV = BASE_SPEED * st.speed * cpuSpeedFactor(k);
  if (k.offroad && k.star <= 0) maxV *= 0.5;
  if (k.boost > 0) maxV *= 1.42;
  if (k.star > 0) maxV *= 1.18;
  const accel = 17 * st.accel * (k.boost > 0 ? 2.2 : 1);

  if (gas && !brake) {
    if (k.speed < maxV) k.speed = Math.min(maxV, k.speed + accel * dt * (k.speed < 0 ? 2 : 1));
  } else if (brake) {
    if (k.speed > 0.5) k.speed -= 38 * dt;
    else k.speed = Math.max(-10, k.speed - 14 * dt);
  } else {
    const drag = 8 * dt;
    k.speed = Math.abs(k.speed) <= drag ? 0 : k.speed - Math.sign(k.speed) * drag;
  }
  if (k.speed > maxV) k.speed = Math.max(maxV, k.speed - 26 * dt);

  // Direção (curva mais aberta em alta velocidade)
  k.steer += (steer - k.steer) * Math.min(1, dt * 10);
  const sp = Math.abs(k.speed);
  const turn = 2.15 * st.handling * clamp(sp / 7, 0, 1) * (1 - 0.32 * Math.min(1, sp / 40));
  k.heading -= k.steer * turn * dt * Math.sign(k.speed || 1);

  const f = forward(k);
  k.x += f.x * k.speed * dt;
  k.z += f.z * k.speed * dt;

  // Posição em relação à pista
  k.idx = nearestIdx(k.x, k.z, k.idx, 30);
  const lat = lateralOf(k.x, k.z, k.idx);
  k.offroad = Math.abs(lat) > ROAD_HALF + KERB * 0.7;
  if (Math.abs(lat) > WALL - KART_R) {
    const sgn = Math.sign(lat);
    const back = lat - sgn * (WALL - KART_R);
    k.x -= S[k.idx].x * back;
    k.z -= S[k.idx].z * back;
    if (Math.abs(k.speed) > 8) {
      k.speed *= 0.55;
      if (k.human >= 0) { buzz(k.human, 60); sfx.hit(); }
    }
  }

  // Distância percorrida (com volta completa)
  const prev = k.travelIdx === undefined ? k.idx : k.travelIdx;
  let d = k.idx - prev;
  if (d > N / 2) d -= N;
  if (d < -N / 2) d += N;
  k.travel += d;
  k.travelIdx = k.idx;

  if (racing && !k.finished) {
    const lap = Math.floor(k.travel / N) + 1;
    if (lap > k.lapShown && lap <= LAPS) {
      k.lapShown = lap;
      if (k.human >= 0) {
        sfx.lap();
        setMsg(k, lap === LAPS ? '🔔 ÚLTIMA VOLTA!' : 'Volta ' + lap + '/' + LAPS, 2);
      }
    }
    if (k.travel >= LAPS * N) {
      k.finished = true;
      k.finishTime = state.raceTime;
      if (k.waveAction) k.waveAction.play(); // comemora acenando
      if (k.human >= 0) {
        sfx.finish();
        buzz(k.human, 500);
        if (state.firstHumanFinish === null) state.firstHumanFinish = state.raceTime;
      }
    }
    // Contramão
    const dot = f.x * T[k.idx].x + f.z * T[k.idx].z;
    if (k.speed > 4 && dot < -0.35) k.wrongT += dt; else k.wrongT = 0;
  }

  // Caixas de item
  for (const b of itemBoxes) {
    if (b.respawn > 0) continue;
    if ((k.x - b.x) ** 2 + (k.z - b.z) ** 2 < 2.4 ** 2) {
      b.respawn = 3;
      b.mesh.visible = false;
      if (!k.item && k.rolling <= 0) {
        k.rolling = 1.1;
        if (k.human >= 0) { sfx.box(); buzz(k.human, 40); }
      }
    }
  }
  // Placas de turbo
  if (k.padCd <= 0) {
    for (const p of boostPads) {
      if ((k.x - p.x) ** 2 + (k.z - p.z) ** 2 < 2.6 ** 2) {
        k.boost = Math.max(k.boost, 1.0);
        k.padCd = 0.5;
        if (k.human >= 0) { sfx.boost(); buzz(k.human, 60); }
      }
    }
  }
}

function collideKarts() {
  const ks = state.karts;
  for (let a = 0; a < ks.length; a++) {
    for (let b = a + 1; b < ks.length; b++) {
      const A = ks[a], B = ks[b];
      const dx = B.x - A.x, dz = B.z - A.z;
      const d2 = dx * dx + dz * dz;
      const min = KART_R * 2;
      if (d2 > 0 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        A.x -= nx * push; A.z -= nz * push;
        B.x += nx * push; B.z += nz * push;
        // Estrela derruba quem encostar
        if (A.star > 0 && B.star <= 0 && canHit(A, B)) spinOut(B, A);
        else if (B.star > 0 && A.star <= 0 && canHit(B, A)) spinOut(A, B);
        else {
          A.speed *= 0.97;
          B.speed *= 0.97;
          if (A.human >= 0) buzz(A.human, 30);
          if (B.human >= 0) buzz(B.human, 30);
        }
      }
    }
  }
}

function updateHazards(dt) {
  for (let i = state.hazards.length - 1; i >= 0; i--) {
    const h = state.hazards[i];
    h.age += dt;
    h.mesh.rotation.y += dt;
    for (const k of state.karts) {
      if (h.age < 0.4 && k === h.owner) continue;
      if ((k.x - h.x) ** 2 + (k.z - h.z) ** 2 < 1.6 ** 2 && (k === h.owner || canHit(h.owner, k))) {
        spinOut(k, h.owner);
        scene.remove(h.mesh);
        state.hazards.splice(i, 1);
        break;
      }
    }
  }
  for (let i = state.shells.length - 1; i >= 0; i--) {
    const s = state.shells[i];
    s.life -= dt;
    let want;
    if (s.target && !s.target.finished) {
      want = Math.atan2(s.target.x - s.x, s.target.z - s.z);
    } else {
      const t = at(s.idx + Math.round(10 / SPACING));
      want = Math.atan2(C[t].x - s.x, C[t].z - s.z);
    }
    s.heading += clamp(wrapAngle(want - s.heading), -4 * dt, 4 * dt);
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
    s.idx = nearestIdx(s.x, s.z, s.idx, 30);
    s.mesh.position.set(s.x, 0.5, s.z);
    s.mesh.rotation.y += dt * 12;
    let gone = s.life <= 0 || Math.abs(lateralOf(s.x, s.z, s.idx)) > WALL;
    for (const k of state.karts) {
      if (gone) break;
      if (k === s.owner && s.life > 6.4) continue;
      if ((k.x - s.x) ** 2 + (k.z - s.z) ** 2 < 1.8 ** 2 && canHit(s.owner, k)) {
        spinOut(k, s.owner);
        gone = true;
      }
    }
    if (gone) { scene.remove(s.mesh); state.shells.splice(i, 1); }
  }
}

function updateVisuals(dt, t) {
  for (const k of state.karts) {
    const m = k.mesh;
    if (k.mixer && k.waveAction.isRunning()) k.mixer.update(dt);
    m.root.position.set(k.x, 0, k.z);
    m.root.rotation.y = k.heading;
    m.body.rotation.y = k.spin > 0 ? (1.25 - k.spin) * Math.PI * 3.2 : -k.steer * 0.18 * Math.min(1, Math.abs(k.speed) / 10);
    m.body.rotation.z = k.steer * 0.06 * Math.min(1, Math.abs(k.speed) / 20);
    m.body.position.y = k.offroad && Math.abs(k.speed) > 3 ? Math.abs(Math.sin(t * 30 + k.id)) * 0.06 : 0;
    for (const w of m.wheels) {
      w.rotation.x += k.speed * dt / 0.38;
      if (w.userData.front) w.rotation.y = -k.steer * 0.45;
    }
    m.flame.visible = k.boost > 0;
    if (k.boost > 0) m.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    if (k.star > 0) m.paint.color.setHSL((t * 2 + k.id * 0.1) % 1, 0.9, 0.55);
    else m.paint.color.set(k.color);
  }
  for (const b of itemBoxes) {
    if (b.respawn > 0) {
      b.respawn -= dt;
      if (b.respawn <= 0) b.mesh.visible = true;
    }
    b.mesh.rotation.y += dt * 1.4;
    b.mesh.rotation.x = Math.sin(t + b.phase) * 0.3;
    b.mesh.position.y = 1.3 + Math.sin(t * 2 + b.phase) * 0.2;
  }
  boostTex.offset.y = (boostTex.offset.y - dt * 1.5) % 1;
}

function updateCamera(cam, k, dt) {
  const f = forward(k);
  const back = 7.2, up = 3.1;
  const tx = k.x - f.x * back, tz = k.z - f.z * back;
  if (!cam.userData.init) {
    cam.position.set(tx, up, tz);
    cam.userData.init = true;
  }
  const a = 1 - Math.exp(-dt * 7);
  cam.position.x += (tx - cam.position.x) * a;
  cam.position.z += (tz - cam.position.z) * a;
  cam.position.y += (up - cam.position.y) * a;
  cam.lookAt(k.x + f.x * 4, 1.1, k.z + f.z * 4);
  const fov = 68 + (k.boost > 0 ? 8 : 0);
  if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * a; cam.updateProjectionMatrix(); }
}

// ========================================================================
// HUD
// ========================================================================
const huds = [0, 1].map((i) => {
  const el = document.querySelector('.hud[data-i="' + i + '"]');
  return { el, pos: el.querySelector('.pos'), lap: el.querySelector('.lap'), item: el.querySelector('.item'), speed: el.querySelector('.speed'), name: el.querySelector('.name'), msg: el.querySelector('.msg') };
});
let rollIconT = 0;

function updateHud(dt) {
  rollIconT += dt;
  const n = state.karts.length;
  for (const k of state.karts) {
    if (k.human < 0) continue;
    const h = huds[k.human];
    const s = slots[k.human];
    h.pos.innerHTML = ordinal(k.rank) + '<small>/' + n + '</small>';
    h.pos.style.color = k.rank === 1 ? '#facc15' : '#fff';
    h.lap.textContent = k.finished ? '🏁 ' + fmtTime(k.finishTime) : 'Volta ' + Math.min(LAPS, Math.max(1, k.lapShown)) + '/' + LAPS;
    const icon = k.rolling > 0 ? ITEMS[ITEM_KEYS[Math.floor(rollIconT * 12) % ITEM_KEYS.length]].icon : k.item ? ITEMS[k.item].icon : '';
    h.item.textContent = icon;
    h.item.classList.toggle('rolling', k.rolling > 0);
    h.speed.textContent = Math.round(Math.abs(k.speed) * 4) + ' km/h';
    h.name.innerHTML = '<span style="color:' + COLORS[k.human] + '">Jogador ' + (k.human + 1) + '</span> · ' + k.char.name +
      (s.type === 'phone' && !s.connected ? ' · <span style="color:#f87171">📵 desconectado</span>' : '');
    let msg = '', warn = false;
    if (k.finished) msg = '🏁 ' + ordinal(k.rank) + ' lugar!';
    else if (k.wrongT > 1) { msg = '⚠ CONTRAMÃO'; warn = true; }
    else if (k.msgT > 0) msg = k.msg;
    h.msg.textContent = msg;
    h.msg.classList.toggle('warn', warn);
    // HUD no celular
    const text = k.finished ? '🏁 ' + ordinal(k.rank) + ' lugar' : ordinal(k.rank) + '/' + n + ' · Volta ' + Math.min(LAPS, k.lapShown) + '/' + LAPS;
    const msgPhone = { t: 'hud', text, item: k.item ? ITEMS[k.item].icon : k.rolling > 0 ? '🎲' : '🎁' };
    const key = JSON.stringify(msgPhone);
    if (key !== s.lastHud) { s.lastHud = key; sendTo(k.human, msgPhone); }
    engineUpdate(k.human, k.speed, state.screen === 'race');
  }
}

const mini = $('#minimap');
const mctx = mini.getContext('2d');
const MM = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of C) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const sc = 190 / Math.max(maxX - minX, maxZ - minZ);
  return { sc, ox: 110 - ((minX + maxX) / 2) * sc, oz: 110 - ((minZ + maxZ) / 2) * sc };
})();
function drawMinimap() {
  mctx.clearRect(0, 0, 220, 220);
  mctx.fillStyle = 'rgba(10,15,35,0.55)';
  mctx.beginPath();
  mctx.roundRect(0, 0, 220, 220, 20);
  mctx.fill();
  mctx.strokeStyle = 'rgba(255,255,255,0.85)';
  mctx.lineWidth = 7;
  mctx.lineJoin = 'round';
  mctx.beginPath();
  for (let k = 0; k <= N; k += 5) {
    const p = C[at(k)];
    const x = MM.ox + p.x * MM.sc, y = MM.oz + p.z * MM.sc;
    k ? mctx.lineTo(x, y) : mctx.moveTo(x, y);
  }
  mctx.stroke();
  for (const k of state.karts.slice().sort((a, b) => (a.human >= 0) - (b.human >= 0))) {
    const x = MM.ox + k.x * MM.sc, y = MM.oz + k.z * MM.sc;
    mctx.fillStyle = k.color;
    mctx.strokeStyle = '#fff';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.arc(x, y, k.human >= 0 ? 7 : 4.5, 0, Math.PI * 2);
    mctx.fill();
    mctx.stroke();
  }
}

// ========================================================================
// Telas e fluxo
// ========================================================================
function setScreen(s) {
  state.screen = s;
  $('#ov-lobby').classList.toggle('show', s === 'lobby');
  $('#ov-menu').classList.toggle('show', s === 'menu');
  $('#ov-pick').classList.toggle('show', s === 'pick');
  document.body.classList.toggle('picking', s === 'pick');
  $('#ov-results').classList.toggle('show', s === 'results');
  document.querySelectorAll('.hud').forEach((h) => h.classList.toggle('show', s === 'race'));
  mini.classList.toggle('show', s === 'race');
  if (s !== 'race') { engineUpdate(0, 0, false); engineUpdate(1, 0, false); }
}

function toLobby() {
  runFlow(null);
  for (const s of slots) if (s.type === 'phone' && !s.connected) { s.type = null; s.cid = null; }
  setScreen('lobby');
  startAttract();
  updateLobbyUI();
  setIdleBoth('Conectado!', 'Aguardando o outro jogador entrar…');
  if (allReady()) runFlow(menuFlow);
}

async function menuFlow() {
  setScreen('menu');
  if (!state.attract) startAttract();
  setIdleBoth('Escolha o modo', '');
  const { opt } = await askRace({
    title: 'Escolha o modo', text: 'Qualquer um dos dois pode escolher. 3 voltas.',
    options: [
      { id: 'versus', label: '🏆 Competição', sub: 'Vocês dois + 4 CPUs. Quem chegar na frente vence.', cls: 'versus' },
      { id: 'coop', label: '🤝 Cooperativo', sub: 'Equipe contra 2 CPUs rápidas. Posições valem pontos.', cls: 'coop' },
    ],
  });
  await pickFlow(opt);
}

// ------------------------------------------------------------------------
// Seleção de piloto (estilo Mario Kart): grade de retratos + kart girando
// ------------------------------------------------------------------------
const PICK_COLS = 6;
const PICK_SLOTS = Math.max(12, Math.ceil(CHARACTERS.length / PICK_COLS) * PICK_COLS); // "?" = vagas para novos pilotos
const pickState = { cursor: [0, 0], ready: [false, false], waiter: null, built: false };
const pickEls = { tiles: [], cursors: [] };
const portraits = {}; // id -> dataURL

function buildPickGrid() {
  if (pickState.built) return;
  pickState.built = true;
  const grid = $('#pick-grid');
  grid.style.gridTemplateColumns = 'repeat(' + PICK_COLS + ', 1fr)';
  for (let n = 0; n < PICK_SLOTS; n++) {
    const c = CHARACTERS[n];
    const tile = document.createElement('div');
    tile.className = 'tile' + (c ? '' : ' locked');
    if (c) {
      tile.style.setProperty('--c', c.color);
      tile.innerHTML = '<div class="face" style="background:' + c.color + '">' + c.name.slice(0, 1) + '</div>';
    } else {
      tile.innerHTML = '<div class="q">?</div>';
    }
    grid.appendChild(tile);
    pickEls.tiles.push(tile);
  }
  for (let i = 0; i < 2; i++) {
    const cur = document.createElement('div');
    cur.className = 'cursor';
    cur.dataset.i = i;
    cur.innerHTML = '<span class="tag">' + (i + 1) + 'P</span><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i>';
    grid.appendChild(cur);
    pickEls.cursors.push(cur);
  }
  renderPortraits();
}

// Gera os retratos da grade a partir dos próprios modelos 3D (close no rosto)
async function renderPortraits() {
  const list = CHARACTERS.filter((c) => c.model && c.model.url);
  if (!list.length) return;
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { return; }
  r.setSize(256, 256);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#8aa', 2.2));
  const key = new THREE.DirectionalLight('#fff', 2.2);
  key.position.set(1.5, 2.5, 4);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  for (const c of list) {
    try {
      const gltf = await loadModel(c.model.url);
      const obj = cloneSkinned(gltf.scene);
      sc.add(obj);
      obj.updateMatrixWorld(true);
      // Enquadra o rosto: usa o osso "head" (base da cabeça) se existir, senão o topo do modelo
      const box = new THREE.Box3().setFromObject(obj);
      const h = Math.max(0.1, box.max.y - box.min.y);
      const headBone = obj.getObjectByName('head');
      const headY = headBone ? headBone.getWorldPosition(new THREE.Vector3()).y : box.max.y - h * 0.35;
      const ty = headY + h * 0.17; // centro do rosto
      cam.position.set(h * 0.18, ty + h * 0.03, h * 0.78);
      cam.lookAt(0, ty, 0);
      r.render(sc, cam);
      portraits[c.id] = r.domElement.toDataURL('image/png');
      sc.remove(obj);
      const tile = pickEls.tiles[CHARACTERS.indexOf(c)];
      if (tile) tile.innerHTML = '<img alt="" src="' + portraits[c.id] + '">';
    } catch (e) { /* fica com a letra */ }
  }
  r.dispose();
}

// Vitrine: um kart girando numa plataforma para cada jogador
const showroom = new THREE.Scene();
showroom.add(new THREE.HemisphereLight('#ffffff', '#6b7a99', 2.0));
{
  const sl = new THREE.DirectionalLight('#ffffff', 2.4);
  sl.position.set(4, 8, 6);
  showroom.add(sl);
}
const stages = [0, 1].map((i) => {
  const g = new THREE.Group();
  g.position.x = i === 0 ? -40 : 40;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 48), new THREE.MeshStandardMaterial({ color: '#2d3240', roughness: 0.6, metalness: 0.3 }));
  base.position.y = -0.25;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.04, 48), new THREE.MeshStandardMaterial({ color: '#3d4456', roughness: 0.5, metalness: 0.2 }));
  top.position.y = 0.01;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: COLORS[i] }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.02;
  const spin = new THREE.Group();
  spin.scale.setScalar(1.6); // kart grande na vitrine, quase do tamanho da plataforma
  g.add(base, top, ring, spin);
  showroom.add(g);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  return { g, spin, cam, charId: null, kart: null, hop: 0 };
});

function showOnStage(i, char) {
  const st = stages[i];
  if (st.charId === char.id) return;
  st.charId = char.id;
  if (st.kart) {
    st.spin.remove(st.kart.root);
    st.kart.root.traverse((o) => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); });
  }
  st.kart = buildKart(COLORS[i], char, null, st.spin);
}

function cursorChar(i) { return CHARACTERS[pickState.cursor[i]] || null; }

function updatePickUI() {
  for (let i = 0; i < 2; i++) {
    const idx = pickState.cursor[i];
    const tile = pickEls.tiles[idx];
    const cur = pickEls.cursors[i];
    if (tile && cur) {
      const both = pickState.cursor[0] === pickState.cursor[1];
      cur.style.left = tile.offsetLeft + 'px';
      cur.style.top = tile.offsetTop + 'px';
      cur.style.width = tile.offsetWidth + 'px';
      cur.style.height = tile.offsetHeight + 'px';
      cur.classList.toggle('shared', both && i === 1);
      cur.classList.toggle('ready', pickState.ready[i]);
    }
    const c = cursorChar(i);
    const box = document.querySelector('.pick-stage[data-i="' + i + '"]');
    box.querySelector('.pname').textContent = c ? c.name : 'Em breve';
    box.querySelector('.ptag').textContent = c ? c.tagline : 'Novo piloto chegando';
    box.querySelector('.pstats').innerHTML = c
      ? statRow('Velocidade', c.stats.speed) + statRow('Aceleração', c.stats.accel) + statRow('Curva', c.stats.handling)
      : '';
    box.classList.toggle('ready', pickState.ready[i]);
    if (c) showOnStage(i, c);
    else if (stages[i].kart) { stages[i].spin.remove(stages[i].kart.root); stages[i].kart = null; stages[i].charId = null; }
  }
  pickEls.tiles.forEach((t, n) => {
    t.classList.toggle('picked', pickState.ready.some((r, i) => r && pickState.cursor[i] === n));
  });
  const bar = document.querySelector('#pick-name');
  bar.innerHTML = [0, 1].map((i) => {
    const c = cursorChar(i);
    return '<span style="color:' + COLORS[i] + '">' + (i + 1) + 'P</span> ' + (c ? c.name : '?') + (pickState.ready[i] ? ' ✔' : '');
  }).join('<b>·</b>');
}

function statRow(label, v) {
  const pct = Math.round(clamp((v - 0.8) / 0.4, 0.08, 1) * 100);
  return '<div class="stat"><span>' + label + '</span><div class="meter"><i style="width:' + pct + '%"></i></div></div>';
}

function sendPickState(i) {
  const c = cursorChar(i);
  sendTo(i, {
    t: 'pick',
    name: c ? c.name : 'Em breve',
    sub: c ? c.tagline + ' — ' + c.desc : 'Este piloto ainda vai chegar!',
    color: c ? c.color : '#64748b',
    portrait: c && portraits[c.id] ? true : false,
    ready: pickState.ready[i],
  });
}

function pickNav(i, d) {
  if (state.screen !== 'pick') return;
  audio();
  if (d === 'back') {
    if (pickState.ready[i]) {
      pickState.ready[i] = false;
      sfx.item();
    } else if (!pickState.ready[0] && !pickState.ready[1] && pickState.waiter) {
      const w = pickState.waiter;
      pickState.waiter = null;
      w.resolve('back');
      return;
    }
  } else if (d === 'ok') {
    if (pickState.ready[i]) return;
    const c = cursorChar(i);
    if (!c) { sfx.hit(); buzz(i, 120); return; }
    pickState.ready[i] = true;
    stages[i].hop = 1;
    sfx.box();
    buzz(i, 80);
  } else if (!pickState.ready[i]) {
    const n = pickState.cursor[i];
    const col = n % PICK_COLS, row = Math.floor(n / PICK_COLS), rows = PICK_SLOTS / PICK_COLS;
    let nc = col, nr = row;
    if (d === 'left') nc = (col + PICK_COLS - 1) % PICK_COLS;
    if (d === 'right') nc = (col + 1) % PICK_COLS;
    if (d === 'up') nr = (row + rows - 1) % rows;
    if (d === 'down') nr = (row + 1) % rows;
    pickState.cursor[i] = nr * PICK_COLS + nc;
    sfx.item();
  }
  updatePickUI();
  sendPickState(i);
  if (pickState.ready[0] && pickState.ready[1] && pickState.waiter) {
    const w = pickState.waiter;
    pickState.waiter = null;
    w.resolve('go');
  }
}

async function pickFlow(mode) {
  buildPickGrid();
  setScreen('pick');
  // Começa no último piloto escolhido (ou P1 no primeiro e P2 no segundo)
  for (let i = 0; i < 2; i++) {
    const prev = CHARACTERS.findIndex((c) => c.id === state.picks[i]);
    pickState.cursor[i] = prev >= 0 ? prev : Math.min(i, CHARACTERS.length - 1);
    pickState.ready[i] = false;
    slots[i].driving = false;
    sendPickState(i);
  }
  requestAnimationFrame(updatePickUI);
  const res = await new Promise((resolve, reject) => { pickState.waiter = { resolve, reject }; });
  if (res === 'back') {
    await menuFlow();
    return;
  }
  const picks = [0, 1].map((i) => cursorChar(i).id);
  state.picks = picks;
  setIdleBoth('Prontos! 🏁', 'A corrida vai começar…');
  sfx.finish();
  await sleep(1300);
  await raceFlow(mode, picks);
}

function bar(v) {
  const n = Math.round(clamp((v - 0.85) / 0.3, 0, 1) * 4) + 1;
  return '●'.repeat(n) + '○'.repeat(5 - n);
}

function startAttract() {
  clearKarts();
  state.attract = true;
  state.phase = 'idle';
  state.mode = null;
  for (let n = 0; n < 5; n++) {
    makeKart({ human: -1, name: CPU_NAMES[n % 4], color: n === 4 ? COLORS[0] : CPU_COLORS[n % 4], charId: CHARACTERS[n % 2].id, label: '', skill: rand(0.75, 0.95) });
  }
  placeOnGrid(state.karts);
}

async function raceFlow(mode, picks) {
  clearKarts();
  state.attract = false;
  state.mode = mode;
  const humans = [0, 1].map((i) => makeKart({ human: i, name: 'Jogador ' + (i + 1), color: COLORS[i], charId: picks[i], label: 'P' + (i + 1) }));
  const cpuCount = mode === 'coop' ? 2 : 4;
  const cpus = [];
  for (let n = 0; n < cpuCount; n++) {
    const skill = mode === 'coop' ? rand(0.95, 1.0) : rand(0.84, 0.95);
    cpus.push(makeKart({ human: -1, name: CPU_NAMES[n], color: CPU_COLORS[n], charId: CHARACTERS[n % 2].id, label: '', skill }));
  }
  // Grid: CPUs na frente, jogadores no meio, resto atrás
  const order = mode === 'coop' ? [cpus[0], cpus[1], humans[0], humans[1]] : [cpus[0], cpus[1], humans[0], humans[1], cpus[2], cpus[3]];
  placeOnGrid(order);
  state.karts.forEach((k) => { k.lapShown = 1; k.travelIdx = undefined; });
  cameras.forEach((c) => { c.userData.init = false; c.fov = 68; c.updateProjectionMatrix(); });
  state.raceTime = 0;
  state.firstHumanFinish = null;
  setScreen('race');
  setDriving(true);

  // Contagem regressiva
  state.phase = 'countdown';
  const cd = $('#countdown');
  for (const n of [3, 2, 1]) {
    state.countdown = n;
    cd.textContent = n;
    sfx.beep();
    buzz(0, 60);
    buzz(1, 60);
    await sleep(1000);
  }
  cd.textContent = 'JÁ!';
  sfx.go();
  buzz(0, 200);
  buzz(1, 200);
  for (const k of humans) if (k.startBoost) { k.boost = 1.1; setMsg(k, '🚀 Largada turbo!', 1.5); }
  state.phase = 'racing';
  setTimeout(() => { if (cd.textContent === 'JÁ!') cd.textContent = ''; }, 900);

  // Corrida: termina quando os dois jogadores cruzam a linha (ou FINISH_GRACE s depois do primeiro)
  for (;;) {
    await sleep(250);
    const humansDone = humans.every((k) => k.finished);
    const grace = state.firstHumanFinish !== null && state.raceTime - state.firstHumanFinish > FINISH_GRACE;
    if (humansDone || grace || state.raceTime > 600) break;
  }
  await sleep(humans.every((k) => k.finished) ? 2500 : 500);
  state.phase = 'done';
  cd.textContent = '';
  await resultsFlow(mode, picks);
}

async function resultsFlow(mode, picks) {
  const ranked = rankedKarts();
  ranked.forEach((k, n) => { k.rank = n + 1; });
  const [p1, p2] = state.karts.filter((k) => k.human >= 0).sort((a, b) => a.human - b.human);
  let title, sub;
  const rows = ranked.map((k, n) => {
    const pts = mode === 'coop' ? COOP_POINTS[n] || 0 : null;
    const pic = portraits[k.char.id]
      ? '<img alt="" src="' + portraits[k.char.id] + '">'
      : '<span class="face" style="background:' + k.char.color + '">' + k.char.name.slice(0, 1) + '</span>';
    const tag = k.human >= 0 ? '<i class="ptag-p p' + (k.human + 1) + '">' + (k.human + 1) + 'P</i>' : '';
    return '<div class="res-row' + (k.human >= 0 ? ' human p' + (k.human + 1) : '') + '" style="--kc:' + k.color + ';animation-delay:' + (n * 0.08) + 's">' +
      '<span class="res-pos pos' + (n + 1) + '">' + (n + 1) + '</span>' +
      '<span class="res-pic">' + pic + '</span>' +
      '<span class="res-name">' + tag + k.name + '<small>' + k.char.name + '</small></span>' +
      '<span class="res-time">' + (k.finished ? fmtTime(k.finishTime) : '—') + '</span>' +
      (pts !== null ? '<span class="res-pts">' + pts + ' pts</span>' : '') + '</div>';
  });
  if (mode === 'versus') {
    const w = p1.rank < p2.rank ? p1 : p2;
    title = 'JOGADOR ' + (w.human + 1) + ' VENCEU!';
    sub = 'Jogador 1 em ' + ordinal(p1.rank) + ' · Jogador 2 em ' + ordinal(p2.rank);
    buzz(w.human, 600);
  } else {
    const team = ranked.reduce((a, k, n) => a + (k.team === 'human' ? COOP_POINTS[n] || 0 : 0), 0);
    const cpu = ranked.reduce((a, k, n) => a + (k.team === 'cpu' ? COOP_POINTS[n] || 0 : 0), 0);
    title = team > cpu ? 'EQUIPE VENCEU! 🎉' : team === cpu ? 'EMPATE!' : 'A CPU VENCEU 😅';
    sub = 'Equipe ' + team + ' pts × ' + cpu + ' pts CPU';
    buzz(0, 400);
    buzz(1, 400);
  }
  $('#res-title').textContent = title;
  $('#res-sub').textContent = sub;
  $('#res-list').innerHTML = rows.join('');
  setDriving(false);
  setScreen('results');
  sfx.finish();
  const { opt } = await askRace({
    title, text: sub,
    options: [
      { id: 'again', label: '🔁 Correr de novo', big: true },
      { id: 'pick', label: '🧑 Trocar de piloto' },
      { id: 'menu', label: '📋 Trocar de modo' },
    ],
  });
  if (opt === 'again') await raceFlow(mode, picks);
  else if (opt === 'pick') await pickFlow(mode);
  else await menuFlow();
}

// ========================================================================
// Loop principal
// ========================================================================
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener('resize', () => { resize(); if (state.screen === 'pick') updatePickUI(); });
resize();

const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let elapsed = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  elapsed += dt;
  if (state.phase === 'countdown') state.countdown -= dt;
  if (state.phase === 'racing') state.raceTime += dt;

  // Física em passos fixos (estável em qualquer taxa de quadros)
  acc += dt;
  while (acc >= STEP) {
    for (const k of state.karts) updateKart(k, STEP);
    collideKarts();
    updateHazards(STEP);
    acc -= STEP;
  }
  if (state.phase !== 'idle') {
    const ranked = rankedKarts();
    ranked.forEach((k, n) => { k.rank = n + 1; });
  }
  updateVisuals(dt, elapsed);

  const w = window.innerWidth, h = window.innerHeight;
  renderer.setScissorTest(true);
  const humans = state.karts.filter((k) => k.human >= 0);
  if (state.screen === 'race' && humans.length === 2) {
    for (const k of humans) {
      const cam = cameras[k.human];
      updateCamera(cam, k, dt);
      cam.aspect = w / (h / 2);
      cam.updateProjectionMatrix();
      const y = k.human === 0 ? h / 2 : 0;
      renderer.setViewport(0, y, w, h / 2);
      renderer.setScissor(0, y, w, h / 2);
      renderer.render(scene, cam);
    }
    updateHud(dt);
    drawMinimap();
  } else if (state.screen === 'pick') {
    // Fundo transparente (o azul vem do CSS) + um kart girando para cada jogador
    renderer.setClearColor(0x000000, 0);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.clear();
    for (let i = 0; i < 2; i++) {
      const st = stages[i];
      const el = document.querySelector('.pick-stage[data-i="' + i + '"] .view');
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      st.spin.rotation.y += dt * (pickState.ready[i] ? 2.2 : 0.7);
      st.hop = Math.max(0, st.hop - dt * 2.5);
      st.spin.position.y = Math.sin(st.hop * Math.PI) * 0.8;
      st.cam.aspect = r.width / r.height;
      // Distância para a plataforma (raio ~2,8) caber inteira na largura e na altura da área
      const vHalf = Math.tan(THREE.MathUtils.degToRad(st.cam.fov / 2));
      const fit = Math.max(2.85 / (vHalf * st.cam.aspect), 1.55 / vHalf);
      st.cam.position.set(st.g.position.x, fit * 0.27, fit);
      st.cam.lookAt(st.g.position.x, 1.0, 0);
      st.cam.updateProjectionMatrix();
      const y = h - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setScissor(r.left, y, r.width, r.height);
      renderer.render(showroom, st.cam);
    }
  } else {
    // Câmera aérea girando em volta da pista (lobby, menus e resultado)
    const a = elapsed * 0.06;
    const v = testHooks.view; // câmera fixa usada pelos testes
    attractCam.position.set(...(v ? v.pos : [40 + Math.cos(a) * 260, 120, 100 + Math.sin(a) * 260]));
    attractCam.lookAt(...(v ? v.look : [30, 0, 100]));
    attractCam.aspect = w / h;
    attractCam.updateProjectionMatrix();
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.render(scene, attractCam);
  }
  requestAnimationFrame(frame);
}

// Ganchos para testes automatizados
window.__kart = { state, slots, answer, C, N, LAPS, testHooks };

startAttract();
updateLobbyUI();
startPeer();
requestAnimationFrame(frame);
