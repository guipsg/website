// Neon Arena — controle no celular.
// Conecta ao computador (host) via WebRTC usando PeerJS e envia o estado dos analógicos.
(() => {
  'use strict';

  const ID_PREFIX = 'neonarena-v1-';
  const COLORS = ['#22d3ee', '#f472b6'];
  const $ = (s) => document.querySelector(s);

  let cid;
  try {
    cid = localStorage.getItem('neonarena-cid');
    if (!cid) {
      cid = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('neonarena-cid', cid);
    }
  } catch (e) {
    cid = Math.random().toString(36).slice(2, 12);
  }

  let room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let peer = null;
  let conn = null;
  let slot = -1;
  let screen = '';
  let retryTimer = null;
  let full = false;

  // ---------- Telas ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('show', el.id === id));
  }

  function message(title, text, btn) {
    $('#msg-title').textContent = title;
    $('#msg-text').textContent = text || '';
    const b = $('#msg-btn');
    if (btn) {
      b.hidden = false;
      b.textContent = btn.label;
      b.onclick = btn.onclick;
    } else {
      b.hidden = true;
    }
    show('s-msg');
  }

  function setSlot(i) {
    slot = i;
    const color = COLORS[i] || COLORS[0];
    document.documentElement.style.setProperty('--player', color);
    document.querySelectorAll('.badge').forEach((b) => {
      b.textContent = 'Jogador ' + (i + 1);
      b.hidden = false;
    });
  }

  // ---------- Conexão ----------
  function startJoin() {
    if (!room) {
      show('s-join');
      setTimeout(() => $('#code').focus(), 50);
      return;
    }
    connect();
  }

  $('#join-btn').onclick = () => {
    const v = $('#code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length !== 4) {
      $('#code').focus();
      return;
    }
    room = v;
    try { history.replaceState(null, '', '?room=' + room); } catch (e) {}
    connect();
  };
  $('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#join-btn').click(); });

  function scheduleRetry(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, ms);
  }

  function connect() {
    clearTimeout(retryTimer);
    if (full) return;
    message('Conectando…', 'Sala ' + room);
    if (typeof Peer === 'undefined') {
      message('Erro', 'Não foi possível carregar a biblioteca de conexão. Verifique sua internet.', { label: 'Tentar de novo', onclick: () => location.reload() });
      return;
    }
    if (!peer || peer.destroyed) {
      peer = new Peer(window.NEON_PEER_OPTS || {});
      peer.on('open', openConn);
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          message('Sala não encontrada', 'Confira o código ' + room + ' na tela do computador.', {
            label: 'Digitar outro código',
            onclick: () => { room = ''; show('s-join'); },
          });
        } else {
          message('Reconectando…', 'Problema de rede (' + err.type + ').');
          scheduleRetry(2500);
        }
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    } else if (peer.open) {
      openConn();
    } else if (peer.disconnected) {
      try { peer.reconnect(); } catch (e) {}
    }
  }

  function openConn() {
    if (conn) { try { conn.close(); } catch (e) {} }
    const c = peer.connect(ID_PREFIX + room, { serialization: 'json', reliable: true });
    conn = c;
    const timeout = setTimeout(() => {
      if (conn === c && !c.open) { message('Reconectando…', 'O computador não respondeu.'); scheduleRetry(1000); }
    }, 8000);
    c.on('open', () => {
      clearTimeout(timeout);
      send({ t: 'hello', cid });
    });
    c.on('data', onData);
    c.on('close', () => {
      if (conn !== c) return;
      conn = null;
      if (full) return;
      message('Conexão perdida', 'Tentando reconectar…');
      scheduleRetry(1500);
    });
    c.on('error', () => {});
  }

  function send(msg) {
    if (conn && conn.open) {
      try { conn.send(msg); } catch (e) {}
    }
  }

  function onData(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'welcome':
        setSlot(m.slot);
        vibrate(60);
        break;
      case 'full':
        full = true;
        message('Sala cheia', 'Já existem 2 jogadores conectados.');
        break;
      case 'screen':
        applyScreen(m);
        break;
      case 'hud':
        $('#hearts').textContent = m.alive === false ? '✖ caído' : '♥'.repeat(Math.max(0, m.hp)) + '♡'.repeat(Math.max(0, m.max - m.hp));
        $('#pad-score').textContent = m.label || '';
        break;
      case 'buzz':
        vibrate(m.ms);
        break;
    }
  }

  function applyScreen(m) {
    screen = m.s;
    if (screen !== 'playing') resetInput();
    if (screen === 'lobby') {
      message('Conectado!', m.waiting ? 'Aguardando o outro jogador entrar…' : 'Preparando…');
    } else if (screen === 'menu') {
      show('s-menu');
    } else if (screen === 'playing') {
      show('s-pad');
      requestWakeLock();
    } else if (screen === 'paused') {
      $('#over-title').textContent = 'Pausado';
      $('#over-text').textContent = m.reason || '';
      const b = $('#over-main');
      b.textContent = 'Continuar';
      b.dataset.cmd = 'resume';
      show('s-over');
    } else if (screen === 'over') {
      $('#over-title').textContent = m.title || 'Fim de jogo';
      $('#over-text').textContent = m.text || '';
      const b = $('#over-main');
      b.textContent = 'Jogar de novo';
      b.dataset.cmd = 'again';
      show('s-over');
    }
  }

  // Botões de comando (data-cmd)
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cmd]');
    if (!el) return;
    send({ t: 'cmd', c: el.dataset.cmd });
    vibrate(20);
  });

  // ---------- Analógicos ----------
  const input = { mx: 0, my: 0, ax: 0, ay: 0, d: 0 };
  const RADIUS = 60;

  function makeStick(zone, onMove) {
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    let pid = null;
    let ox = 0, oy = 0;

    function place(el, x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    function center() {
      const r = zone.getBoundingClientRect();
      place(base, r.width / 2, r.height / 2);
      place(knob, r.width / 2, r.height / 2);
    }
    function release() {
      pid = null;
      zone.classList.remove('active');
      center();
      onMove(0, 0);
    }

    zone.addEventListener('pointerdown', (e) => {
      if (pid !== null) return;
      e.preventDefault();
      pid = e.pointerId;
      try { zone.setPointerCapture(pid); } catch (err) {}
      const r = zone.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      place(base, ox, oy);
      place(knob, ox, oy);
      zone.classList.add('active');
      onMove(0, 0, true);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      e.preventDefault();
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - r.left - ox;
      let dy = e.clientY - r.top - oy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
      place(knob, ox + dx, oy + dy);
      onMove(dx / RADIUS, dy / RADIUS);
    });
    zone.addEventListener('pointerup', (e) => { if (e.pointerId === pid) release(); });
    zone.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) release(); });
    window.addEventListener('resize', () => { if (pid === null) center(); });
    return { release, center };
  }

  const q = (v) => Math.round(v * 100) / 100;
  const moveStick = makeStick($('#zone-move'), (x, y) => { input.mx = q(x); input.my = q(y); });
  const aimStick = makeStick($('#zone-aim'), (x, y) => { input.ax = q(x); input.ay = q(y); });

  const dash = $('#dash');
  dash.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.d = 1;
    dash.classList.add('down');
    vibrate(15);
  });
  const dashUp = () => { input.d = 0; dash.classList.remove('down'); };
  dash.addEventListener('pointerup', dashUp);
  dash.addEventListener('pointercancel', dashUp);
  dash.addEventListener('pointerleave', dashUp);

  function resetInput() {
    moveStick.release();
    aimStick.release();
    dashUp();
  }

  // Envia a entrada ~30x por segundo quando muda e um "ping" a cada segundo.
  let lastSent = '';
  let lastSentAt = 0;
  setInterval(() => {
    const now = performance.now();
    if (screen === 'playing') {
      const s = JSON.stringify(input);
      if (s !== lastSent || now - lastSentAt > 1000) {
        lastSent = s;
        lastSentAt = now;
        send({ t: 'in', mx: input.mx, my: input.my, ax: input.ax, ay: input.ay, d: input.d });
      }
    } else if (now - lastSentAt > 1000) {
      lastSentAt = now;
      send({ t: 'ping' });
    }
  }, 33);

  // ---------- Utilidades ----------
  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (screen === 'playing') requestWakeLock();
      if (!conn && room && !full) connect();
    }
  });

  // Evita zoom por gesto / menu de contexto durante o jogo
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  startJoin();
})();
