// Neon Arena — tela do computador (host).
// Roda o jogo, recebe os controles dos celulares via WebRTC (PeerJS) e desenha tudo num canvas.
(() => {
  'use strict';

  // ======================================================================
  // Configuração
  // ======================================================================
  const W = 1600, H = 900;
  const ID_PREFIX = 'neonarena-v1-';
  const COLORS = ['#22d3ee', '#f472b6'];
  const WIN_SCORE = 5;
  const MAX_HP = 5;
  const PLAYER_R = 18;
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);

  // ======================================================================
  // Utilidades
  // ======================================================================
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function circleRect(c, r, rect) {
    const nx = clamp(c.x, rect.x, rect.x + rect.w);
    const ny = clamp(c.y, rect.y, rect.y + rect.h);
    return (c.x - nx) ** 2 + (c.y - ny) ** 2 < r * r;
  }

  // Empurra um círculo para fora de um retângulo (desliza na parede).
  function pushOut(o, r, rect) {
    const nx = clamp(o.x, rect.x, rect.x + rect.w);
    const ny = clamp(o.y, rect.y, rect.y + rect.h);
    let dx = o.x - nx, dy = o.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 === 0) {
      // Centro dentro do retângulo: sai pelo lado mais próximo
      const left = o.x - rect.x, right = rect.x + rect.w - o.x;
      const top = o.y - rect.y, bottom = rect.y + rect.h - o.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) o.x = rect.x - r;
      else if (m === right) o.x = rect.x + rect.w + r;
      else if (m === top) o.y = rect.y - r;
      else o.y = rect.y + rect.h + r;
      return true;
    }
    const d = Math.sqrt(d2);
    o.x = nx + (dx / d) * r;
    o.y = ny + (dy / d) * r;
    return true;
  }

  function keepIn(o, r) {
    o.x = clamp(o.x, r, W - r);
    o.y = clamp(o.y, r, H - r);
  }

  // ======================================================================
  // Áudio (sintetizado, sem arquivos)
  // ======================================================================
  let actx = null;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, slide) {
    const a = actx;
    if (!a || a.state !== 'running') return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.05, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  }
  function noise(dur, vol) {
    const a = actx;
    if (!a || a.state !== 'running') return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    const g = a.createGain();
    g.gain.value = vol || 0.15;
    src.buffer = buf;
    src.connect(g).connect(a.destination);
    src.start();
  }
  const sfx = {
    shoot: (i) => tone(i === 0 ? 880 : 660, 0.06, 'square', 0.025, 0.5),
    enemyShoot: () => tone(300, 0.08, 'sawtooth', 0.02, 0.6),
    hit: () => tone(200, 0.12, 'sawtooth', 0.06, 0.4),
    boom: () => noise(0.35, 0.18),
    bigBoom: () => { noise(0.9, 0.3); tone(80, 0.8, 'sine', 0.2, 0.3); },
    power: () => { tone(520, 0.08, 'triangle', 0.08); setTimeout(() => tone(780, 0.08, 'triangle', 0.08), 70); setTimeout(() => tone(1040, 0.12, 'triangle', 0.08), 140); },
    dash: () => tone(400, 0.12, 'sine', 0.05, 2.5),
    wave: () => { tone(330, 0.15, 'triangle', 0.08); setTimeout(() => tone(495, 0.25, 'triangle', 0.08), 150); },
    join: () => { tone(660, 0.08, 'triangle', 0.08); setTimeout(() => tone(990, 0.12, 'triangle', 0.08), 90); },
    revive: () => { tone(440, 0.1, 'triangle', 0.08); setTimeout(() => tone(660, 0.1, 'triangle', 0.08), 100); setTimeout(() => tone(880, 0.2, 'triangle', 0.08), 200); },
  };
  window.addEventListener('pointerdown', audio);
  window.addEventListener('keydown', audio);

  // ======================================================================
  // Jogadores / conexões
  // ======================================================================
  const emptyInput = () => ({ mx: 0, my: 0, ax: 0, ay: 0, d: 0, fire: 0 });
  // slot.type: null | 'phone' | 'kbA' | 'kbB'
  const slots = [0, 1].map((i) => ({ i, type: null, conn: null, cid: null, connected: false, lastSeen: 0, input: emptyInput() }));

  function slotLabel(s) {
    if (!s.type) return 'aguardando…';
    if (s.type === 'phone') return s.connected ? '📱 conectado' : '📱 reconectando…';
    return s.type === 'kbA' ? '⌨ WASD' : '⌨ setas';
  }
  function slotReady(s) { return s.type && (s.type !== 'phone' || s.connected); }

  function sendTo(i, msg) {
    const s = slots[i];
    if (s.type === 'phone' && s.conn && s.conn.open) {
      try { s.conn.send(msg); } catch (e) {}
    }
  }
  function broadcast(msg) { sendTo(0, msg); sendTo(1, msg); }
  function buzz(i, ms) { sendTo(i, { t: 'buzz', ms }); }

  function updateLobbyUI() {
    document.querySelectorAll('.slot').forEach((el) => {
      const s = slots[+el.dataset.i];
      el.classList.toggle('on', !!slotReady(s));
      el.querySelector('span').textContent = slotLabel(s);
    });
  }

  // ======================================================================
  // Rede (PeerJS)
  // ======================================================================
  let peer = null;
  let roomCode = '';

  function newCode() {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0];
    return c;
  }

  function netStatus(text, err) {
    const el = $('#net-status');
    el.textContent = text;
    el.classList.toggle('err', !!err);
  }

  function showRoom() {
    $('#room-code').textContent = roomCode;
    const url = new URL('controller.html?room=' + roomCode, location.href).href;
    $('#room-url').textContent = url;
    const box = $('#qr');
    if (typeof qrcode === 'function') {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } else {
      box.textContent = 'QR indisponível — use o link e o código.';
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
    roomCode = newCode();
    // window.NEON_PEER_OPTS permite apontar para um servidor PeerJS próprio (ex.: testes locais)
    peer = new Peer(ID_PREFIX + roomCode, window.NEON_PEER_OPTS || {});
    peer.on('open', () => {
      showRoom();
      if (location.protocol !== 'file:') netStatus('Pronto! Esperando os celulares…');
    });
    peer.on('connection', onConnection);
    peer.on('disconnected', () => {
      netStatus('Conexão com o servidor de pareamento perdida, reconectando…', true);
      setTimeout(() => { try { if (peer && !peer.destroyed) peer.reconnect(); } catch (e) {} }, 1500);
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        startPeer(); // código já em uso: gera outro
      } else if (err.type === 'peer-unavailable') {
        // irrelevante para o host
      } else {
        netStatus('Erro de rede: ' + err.type + '. Tentando novamente…', true);
        if (peer.destroyed) setTimeout(startPeer, 3000);
      }
    });
  }

  function onConnection(conn) {
    conn.on('data', (m) => handleMessage(conn, m));
    conn.on('close', () => dropConn(conn));
    conn.on('error', () => dropConn(conn));
  }

  function handleMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') return join(conn, String(m.cid || ''));
    const s = slots.find((x) => x.conn === conn);
    if (!s) return;
    s.lastSeen = performance.now();
    if (m.t === 'in') {
      s.input.mx = clamp(+m.mx || 0, -1, 1);
      s.input.my = clamp(+m.my || 0, -1, 1);
      s.input.ax = clamp(+m.ax || 0, -1, 1);
      s.input.ay = clamp(+m.ay || 0, -1, 1);
      s.input.d = m.d ? 1 : 0;
    } else if (m.t === 'cmd') {
      command(m.c);
    }
  }

  function join(conn, cid) {
    // Reconexão de um celular que já tinha vaga
    let s = slots.find((x) => x.type === 'phone' && x.cid === cid && cid);
    if (!s) s = slots.find((x) => !x.type);
    if (!s) {
      try { conn.send({ t: 'full' }); } catch (e) {}
      setTimeout(() => conn.close(), 500);
      return;
    }
    if (s.conn && s.conn !== conn) { try { s.conn.close(); } catch (e) {} }
    s.type = 'phone';
    s.conn = conn;
    s.cid = cid;
    s.connected = true;
    s.lastSeen = performance.now();
    s.input = emptyInput();
    sfx.join();
    sendTo(s.i, { t: 'welcome', slot: s.i });
    afterSlotsChanged();
    if (game.screen === 'paused' && slots.every(slotReady)) pauseReason = '';
    sendScreen(s.i);
    sendHud(true);
  }

  function dropConn(conn) {
    const s = slots.find((x) => x.conn === conn);
    if (!s) return;
    s.conn = null;
    s.connected = false;
    s.input = emptyInput();
    if (game.screen === 'lobby' || game.screen === 'menu') {
      // Fora da partida a vaga é liberada
      s.type = null;
      s.cid = null;
    } else if (game.screen === 'playing') {
      pause('Jogador ' + (s.i + 1) + ' desconectou — aguardando reconexão…');
    }
    afterSlotsChanged();
  }

  // Detecta celulares que pararam de responder (ex.: tela bloqueada)
  setInterval(() => {
    const now = performance.now();
    for (const s of slots) {
      if (s.type === 'phone' && s.connected && now - s.lastSeen > 6000) dropConn(s.conn);
    }
  }, 1000);

  function afterSlotsChanged() {
    updateLobbyUI();
    const ready = slots.every(slotReady);
    if (game.screen === 'lobby' && ready) setScreen('menu');
    else if (game.screen === 'menu' && !ready) setScreen('lobby');
    else sendScreen();
  }

  // ======================================================================
  // Teclado (alternativa ao celular, útil para testar)
  // ======================================================================
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (game.screen === 'lobby') {
      if (e.code === 'Space') kbJoin('kbA');
      if (e.code === 'Enter' || e.code === 'NumpadEnter') kbJoin('kbB');
    } else if (game.screen === 'menu') {
      if (e.code === 'Digit1' || e.code === 'Numpad1') command('versus');
      if (e.code === 'Digit2' || e.code === 'Numpad2') command('coop');
      if (e.code === 'Escape' || e.code === 'Backspace') kbLeaveAll();
    } else if (game.screen === 'playing') {
      if (e.code === 'KeyP' || e.code === 'Escape') command('pause');
    } else if (game.screen === 'paused') {
      if (e.code === 'KeyP' || e.code === 'Escape') command('resume');
      if (e.code === 'KeyM') command('menu');
    } else if (game.screen === 'over') {
      if (e.code === 'KeyR') command('again');
      if (e.code === 'KeyM' || e.code === 'Escape') command('menu');
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
    afterSlotsChanged();
  }
  function kbLeaveAll() {
    for (const s of slots) if (s.type === 'kbA' || s.type === 'kbB') s.type = null;
    afterSlotsChanged();
  }

  function readKeyboard(s) {
    const inp = s.input;
    const A = s.type === 'kbA';
    const up = A ? keys.KeyW : keys.ArrowUp;
    const down = A ? keys.KeyS : keys.ArrowDown;
    const left = A ? keys.KeyA : keys.ArrowLeft;
    const right = A ? keys.KeyD : keys.ArrowRight;
    inp.mx = (right ? 1 : 0) - (left ? 1 : 0);
    inp.my = (down ? 1 : 0) - (up ? 1 : 0);
    inp.fire = (A ? keys.Space : keys.Enter || keys.NumpadEnter) ? 1 : 0;
    inp.d = (A ? keys.ShiftLeft : keys.ShiftRight) ? 1 : 0;
    inp.ax = 0;
    inp.ay = 0;
  }

  // ======================================================================
  // Estado do jogo
  // ======================================================================
  const game = {
    screen: 'lobby', // lobby | menu | playing | paused | over
    mode: null, // versus | coop
    players: [],
    bullets: [],
    enemies: [],
    particles: [],
    powerups: [],
    texts: [],
    obstacles: [],
    time: 0,
    shake: 0,
    banner: null,
    // coop
    wave: 0,
    score: 0,
    spawnQueue: [],
    spawnTimer: 0,
    waveBreak: 0,
    kills: 0,
    // versus
    powerTimer: 0,
    winner: -1,
  };
  let pauseReason = '';

  const LAYOUTS = {
    versus: [
      { x: 760, y: 360, w: 80, h: 180 },
      { x: 420, y: 160, w: 140, h: 40 },
      { x: 1040, y: 160, w: 140, h: 40 },
      { x: 420, y: 700, w: 140, h: 40 },
      { x: 1040, y: 700, w: 140, h: 40 },
      { x: 300, y: 420, w: 40, h: 60 },
      { x: 1260, y: 420, w: 40, h: 60 },
    ],
    coop: [
      { x: 380, y: 230, w: 70, h: 70 },
      { x: 1150, y: 230, w: 70, h: 70 },
      { x: 380, y: 600, w: 70, h: 70 },
      { x: 1150, y: 600, w: 70, h: 70 },
    ],
  };
  const SPAWNS = {
    versus: [{ x: 140, y: 450, a: 0 }, { x: W - 140, y: 450, a: Math.PI }],
    coop: [{ x: 720, y: 450, a: -Math.PI / 2 }, { x: 880, y: 450, a: -Math.PI / 2 }],
  };

  function makePlayer(i) {
    const sp = SPAWNS[game.mode][i];
    return {
      i, x: sp.x, y: sp.y, vx: 0, vy: 0, ang: sp.a, r: PLAYER_R,
      hp: MAX_HP, alive: true, respawn: 0, inv: 1.5, cd: 0,
      dashCd: 0, dashT: 0, lastDash: 0,
      triple: 0, rapid: 0, shield: 0,
      score: 0, downT: 0, revive: 0, trail: [],
    };
  }

  function startGame(mode) {
    game.mode = mode;
    game.obstacles = LAYOUTS[mode];
    game.players = [makePlayer(0), makePlayer(1)];
    game.bullets = [];
    game.enemies = [];
    game.particles = [];
    game.powerups = [];
    game.texts = [];
    game.time = 0;
    game.shake = 0;
    game.wave = 0;
    game.score = 0;
    game.kills = 0;
    game.spawnQueue = [];
    game.spawnTimer = 0;
    game.waveBreak = 0;
    game.powerTimer = 4;
    game.winner = -1;
    if (mode === 'coop') nextWave();
    else banner('LUTEM!', 'Primeiro a ' + WIN_SCORE + ' abates vence', COLORS[0]);
    setScreen('playing');
    sendHud(true);
  }

  function banner(text, sub, color, dur) {
    game.banner = { text, sub, color: color || '#fff', t: dur || 2 };
  }

  // ======================================================================
  // Telas
  // ======================================================================
  function setScreen(s) {
    game.screen = s;
    $('#ov-lobby').classList.toggle('show', s === 'lobby');
    $('#ov-menu').classList.toggle('show', s === 'menu');
    $('#ov-pause').classList.toggle('show', s === 'paused');
    $('#ov-over').classList.toggle('show', s === 'over');
    if (s === 'paused') $('#pause-reason').textContent = pauseReason;
    for (const sl of slots) sl.input = emptyInput();
    sendScreen();
  }

  function overInfo() {
    if (game.mode === 'versus') {
      const [a, b] = game.players;
      return {
        title: 'Jogador ' + (game.winner + 1) + ' venceu!',
        text: 'Placar final: ' + a.score + ' × ' + b.score,
      };
    }
    return {
      title: 'Fim de jogo',
      text: 'Vocês chegaram à onda ' + game.wave + ' com ' + game.score.toLocaleString('pt-BR') + ' pontos.',
    };
  }

  function sendScreen(only) {
    const base = { t: 'screen', s: game.screen, mode: game.mode };
    if (game.screen === 'lobby') base.waiting = !slots.every(slotReady);
    if (game.screen === 'paused') base.reason = pauseReason;
    if (game.screen === 'over') Object.assign(base, overInfo());
    if (only === undefined) broadcast(base);
    else sendTo(only, base);
  }

  function pause(reason) {
    if (game.screen !== 'playing') return;
    pauseReason = reason || '';
    setScreen('paused');
  }

  function command(c) {
    audio();
    const ready = slots.every(slotReady);
    switch (c) {
      case 'versus':
      case 'coop':
        if (game.screen === 'menu' && ready) startGame(c);
        break;
      case 'pause':
        pause('Pausado por um jogador');
        break;
      case 'resume':
        if (game.screen === 'paused' && ready) { pauseReason = ''; setScreen('playing'); }
        break;
      case 'again':
        if (game.screen === 'over' && ready) startGame(game.mode);
        break;
      case 'menu':
        if (game.screen === 'over' || game.screen === 'paused') {
          // Libera vagas de celulares que não voltaram
          for (const s of slots) if (s.type === 'phone' && !s.connected) { s.type = null; s.cid = null; }
          setScreen(slots.every(slotReady) ? 'menu' : 'lobby');
          updateLobbyUI();
        }
        break;
    }
  }

  function endGame(winner) {
    if (game.screen !== 'playing') return;
    game.winner = winner;
    const info = overInfo();
    $('#over-title').textContent = info.title;
    $('#over-title').style.color = game.mode === 'versus' ? COLORS[winner] : '#a3e635';
    let html = '<p class="stat-line">' + info.text + '</p>';
    if (game.mode === 'coop') html += '<p class="stat-line">Inimigos destruídos: ' + game.kills + '</p>';
    $('#over-stats').innerHTML = html;
    if (game.mode === 'versus') {
      buzz(winner, 600);
      buzz(1 - winner, 200);
    } else {
      buzz(0, 500);
      buzz(1, 500);
    }
    game.screen = 'ending';
    setTimeout(() => { if (game.screen === 'ending') setScreen('over'); }, 1500);
  }

  // ======================================================================
  // HUD nos celulares
  // ======================================================================
  let lastHud = ['', ''];
  function sendHud(force) {
    for (let i = 0; i < 2; i++) {
      const p = game.players[i];
      if (!p) continue;
      const label = game.mode === 'versus'
        ? p.score + ' × ' + game.players[1 - i].score
        : 'Onda ' + game.wave + ' · ' + game.score;
      const msg = { t: 'hud', hp: Math.max(0, p.hp), max: MAX_HP, alive: p.alive, label };
      const key = JSON.stringify(msg);
      if (force || key !== lastHud[i]) {
        lastHud[i] = key;
        sendTo(i, msg);
      }
    }
  }

  // ======================================================================
  // Efeitos
  // ======================================================================
  function burst(x, y, color, n, speed, life) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.2, 1) * (speed || 300);
      game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 1) * (life || 0.6), max: life || 0.6, color, size: rand(1.5, 3.5) });
    }
  }
  function floatText(x, y, text, color) {
    game.texts.push({ x, y, text, color, life: 1 });
  }
  function shake(v) { game.shake = Math.max(game.shake, v); }

  // ======================================================================
  // Jogadores
  // ======================================================================
  function damagePlayer(p, dmg, attacker) {
    if (game.screen !== 'playing' || !p.alive || p.inv > 0 || p.dashT > 0) return;
    if (p.shield > 0) {
      burst(p.x, p.y, '#93c5fd', 6, 200, 0.3);
      return;
    }
    p.hp -= dmg;
    p.inv = 0.6;
    sfx.hit();
    shake(6);
    burst(p.x, p.y, COLORS[p.i], 12, 260, 0.5);
    buzz(p.i, 90);
    if (p.hp <= 0) killPlayer(p, attacker);
  }

  function killPlayer(p, attacker) {
    p.alive = false;
    p.hp = 0;
    p.vx = p.vy = 0;
    p.triple = p.rapid = p.shield = 0;
    sfx.boom();
    shake(14);
    burst(p.x, p.y, COLORS[p.i], 40, 450, 1);
    buzz(p.i, 350);
    if (game.mode === 'versus') {
      p.respawn = 2;
      const k = game.players[attacker !== undefined ? attacker : 1 - p.i];
      k.score++;
      buzz(k.i, 120);
      floatText(p.x, p.y - 30, '+1', COLORS[k.i]);
      if (k.score >= WIN_SCORE) {
        banner('JOGADOR ' + (k.i + 1) + ' VENCEU!', '', COLORS[k.i], 3);
        endGame(k.i);
      } else {
        banner(k.score + ' × ' + game.players[1 - k.i].score, '', COLORS[k.i], 1.2);
      }
    } else {
      p.downT = 0;
      p.revive = 0;
      const other = game.players[1 - p.i];
      if (!other.alive) {
        banner('GAME OVER', 'Onda ' + game.wave, '#fb7185', 3);
        endGame(-1);
      } else {
        floatText(p.x, p.y - 30, 'CAÍDO! Reanime!', COLORS[p.i]);
      }
    }
  }

  function respawnPlayer(p) {
    const sp = SPAWNS[game.mode][p.i];
    // Na competição, renasce no ponto mais distante do adversário
    let spot = sp;
    if (game.mode === 'versus') {
      const o = game.players[1 - p.i];
      const options = [SPAWNS.versus[0], SPAWNS.versus[1], { x: 800, y: 80, a: Math.PI / 2 }, { x: 800, y: H - 80, a: -Math.PI / 2 }];
      spot = options.reduce((best, s) => (dist2(s, o) > dist2(best, o) ? s : best), options[0]);
    }
    Object.assign(p, { x: spot.x, y: spot.y, ang: spot.a, vx: 0, vy: 0, hp: MAX_HP, alive: true, inv: 2, respawn: 0 });
    burst(p.x, p.y, COLORS[p.i], 20, 200, 0.5);
  }

  function updatePlayer(p, dt) {
    const s = slots[p.i];
    if (s.type === 'kbA' || s.type === 'kbB') readKeyboard(s);
    const inp = s.input;

    if (!p.alive) {
      if (game.mode === 'versus') {
        p.respawn -= dt;
        if (p.respawn <= 0) respawnPlayer(p);
      } else {
        p.downT += dt;
        const other = game.players[1 - p.i];
        if (other.alive && dist2(p, other) < 80 * 80) {
          p.revive += dt;
          if (p.revive >= 2) {
            p.alive = true;
            p.hp = 3;
            p.inv = 2;
            sfx.revive();
            burst(p.x, p.y, '#a3e635', 30, 250, 0.7);
            floatText(p.x, p.y - 30, 'REANIMADO!', '#a3e635');
            buzz(p.i, 150);
            buzz(other.i, 80);
          }
        } else {
          p.revive = Math.max(0, p.revive - dt * 0.5);
        }
      }
      return;
    }

    p.inv = Math.max(0, p.inv - dt);
    p.cd -= dt;
    p.dashCd -= dt;
    p.triple = Math.max(0, p.triple - dt);
    p.rapid = Math.max(0, p.rapid - dt);
    p.shield = Math.max(0, p.shield - dt);

    let mx = inp.mx, my = inp.my;
    let ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
    if (ml < 0.12) { mx = 0; my = 0; ml = 0; }

    // Dash
    const dashPressed = inp.d && !p.lastDash;
    p.lastDash = inp.d;
    if (dashPressed && p.dashCd <= 0) {
      let dx = mx, dy = my;
      if (ml === 0) { dx = Math.cos(p.ang); dy = Math.sin(p.ang); }
      const dl = Math.hypot(dx, dy) || 1;
      p.vx = (dx / dl) * 1150;
      p.vy = (dy / dl) * 1150;
      p.dashT = 0.16;
      p.dashCd = 1.1;
      sfx.dash();
      burst(p.x, p.y, COLORS[p.i], 10, 150, 0.3);
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
    } else {
      const speed = 430;
      const k = Math.min(1, dt * 12);
      p.vx += (mx * speed - p.vx) * k;
      p.vy += (my * speed - p.vy) * k;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    for (const o of game.obstacles) pushOut(p, p.r, o);
    keepIn(p, p.r);

    // Mira: analógico direito (celular) ou direção de movimento (teclado)
    const al = Math.hypot(inp.ax, inp.ay);
    let firing = false;
    if (al > 0.3) {
      p.ang = Math.atan2(inp.ay, inp.ax);
      firing = true;
    } else if (ml > 0) {
      p.ang = Math.atan2(my, mx);
    }
    if (inp.fire) firing = true;

    if (firing && p.cd <= 0) {
      p.cd = p.rapid > 0 ? 0.085 : 0.17;
      const spreads = p.triple > 0 ? [-0.17, 0, 0.17] : [0];
      for (const sp of spreads) {
        const a = p.ang + sp;
        game.bullets.push({
          x: p.x + Math.cos(a) * (p.r + 4), y: p.y + Math.sin(a) * (p.r + 4),
          vx: Math.cos(a) * 920, vy: Math.sin(a) * 920,
          life: 1.1, owner: p.i, enemy: false, r: 4, dmg: 1, color: COLORS[p.i],
        });
      }
      sfx.shoot(p.i);
    }

    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 10) p.trail.shift();
  }

  // ======================================================================
  // Power-ups
  // ======================================================================
  const POWER = {
    triple: { color: '#facc15', label: '3x', name: 'TIRO TRIPLO' },
    rapid: { color: '#fb923c', label: '»', name: 'TIRO RÁPIDO' },
    shield: { color: '#93c5fd', label: '◈', name: 'ESCUDO' },
    heal: { color: '#4ade80', label: '+', name: '+2 VIDA' },
  };

  function freeSpot(r) {
    for (let tries = 0; tries < 40; tries++) {
      const pt = { x: rand(80, W - 80), y: rand(80, H - 80) };
      if (game.obstacles.some((o) => circleRect(pt, r + 10, o))) continue;
      if (game.players.some((p) => dist2(p, pt) < 120 * 120)) continue;
      return pt;
    }
    return { x: W / 2, y: 80 };
  }

  function spawnPowerup(x, y, type) {
    game.powerups.push({ x, y, type: type || pick(Object.keys(POWER)), life: 12, r: 14, t: 0 });
  }

  function updatePowerups(dt) {
    if (game.mode === 'versus') {
      game.powerTimer -= dt;
      if (game.powerTimer <= 0) {
        game.powerTimer = rand(6, 10);
        if (game.powerups.length < 2) {
          const pt = freeSpot(14);
          spawnPowerup(pt.x, pt.y);
        }
      }
    }
    for (const pu of game.powerups) {
      pu.life -= dt;
      pu.t += dt;
      for (const p of game.players) {
        if (!p.alive || pu.life <= 0) continue;
        if (dist2(p, pu) < (p.r + pu.r) ** 2) {
          pu.life = 0;
          applyPower(p, pu.type);
        }
      }
    }
    game.powerups = game.powerups.filter((pu) => pu.life > 0);
  }

  function applyPower(p, type) {
    if (type === 'triple') p.triple = 9;
    if (type === 'rapid') p.rapid = 9;
    if (type === 'shield') p.shield = 6;
    if (type === 'heal') p.hp = Math.min(MAX_HP, p.hp + 2);
    sfx.power();
    buzz(p.i, 40);
    floatText(p.x, p.y - 30, POWER[type].name, POWER[type].color);
    burst(p.x, p.y, POWER[type].color, 16, 200, 0.5);
  }

  // ======================================================================
  // Inimigos (modo cooperativo)
  // ======================================================================
  const ENEMY = {
    chaser: { r: 15, hp: 2, speed: 165, color: '#a3e635', score: 100, contact: 1 },
    shooter: { r: 17, hp: 3, speed: 120, color: '#fb923c', score: 200, contact: 1 },
    tank: { r: 30, hp: 14, speed: 60, color: '#c084fc', score: 500, contact: 2 },
    boss: { r: 62, hp: 120, speed: 70, color: '#f43f5e', score: 5000, contact: 2 },
  };

  function nextWave() {
    game.wave++;
    const w = game.wave;
    const q = [];
    if (w % 5 === 0) {
      q.push('boss');
      for (let k = 0; k < 4 + w; k++) q.push('chaser');
    } else {
      const n = 5 + w * 2;
      for (let k = 0; k < n; k++) {
        const r = Math.random();
        if (w >= 3 && r < Math.min(0.12, 0.03 * (w - 2))) q.push('tank');
        else if (w >= 2 && r < 0.35) q.push('shooter');
        else q.push('chaser');
      }
    }
    game.spawnQueue = q;
    game.spawnTimer = 1.5;
    game.waveBreak = 0;
    sfx.wave();
    banner('ONDA ' + w, w % 5 === 0 ? 'CHEFÃO!' : 'Prepare-se', w % 5 === 0 ? '#f43f5e' : '#a3e635', 2.2);
    sendHud();
  }

  function spawnEnemy(type) {
    const def = ENEMY[type];
    const side = (Math.random() * 4) | 0;
    let x, y;
    if (side === 0) { x = rand(0, W); y = -def.r; }
    else if (side === 1) { x = W + def.r; y = rand(0, H); }
    else if (side === 2) { x = rand(0, W); y = H + def.r; }
    else { x = -def.r; y = rand(0, H); }
    if (type === 'boss') { x = W / 2; y = -def.r; }
    const hpScale = 1 + (game.wave - 1) * 0.08;
    const hp = type === 'boss' ? def.hp + game.wave * 25 : Math.ceil(def.hp * hpScale);
    game.enemies.push({
      type, x, y, vx: 0, vy: 0, r: def.r, hp, maxHp: hp,
      speed: def.speed * (1 + Math.min(0.5, (game.wave - 1) * 0.04)),
      color: def.color, cd: rand(1, 2.5), t: 0, flash: 0, entering: true, strafe: Math.random() < 0.5 ? 1 : -1,
    });
  }

  function nearestPlayer(e) {
    let best = null, bd = Infinity;
    for (const p of game.players) {
      if (!p.alive) continue;
      const d = dist2(p, e);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function enemyShoot(e, ang, speed, r, color) {
    game.bullets.push({
      x: e.x + Math.cos(ang) * e.r, y: e.y + Math.sin(ang) * e.r,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      life: 4, enemy: true, r: r || 6, dmg: 1, color: color || e.color,
    });
  }

  function updateEnemies(dt) {
    // Fila de nascimento
    if (game.spawnQueue.length) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnEnemy(game.spawnQueue.shift());
        game.spawnTimer = Math.max(0.25, 0.8 - game.wave * 0.03);
      }
    } else if (!game.enemies.length && game.screen === 'playing') {
      if (game.waveBreak === 0) {
        game.waveBreak = 2.5;
        // Fim da onda: reanima e cura um pouco
        for (const p of game.players) {
          if (!p.alive) { p.alive = true; p.hp = 3; p.inv = 2; burst(p.x, p.y, '#a3e635', 20, 200, 0.5); }
          else p.hp = Math.min(MAX_HP, p.hp + 1);
        }
        banner('ONDA ' + game.wave + ' COMPLETA', '+1 vida', '#a3e635', 2);
        sendHud();
      } else {
        game.waveBreak -= dt;
        if (game.waveBreak <= 0) nextWave();
      }
    }

    for (const e of game.enemies) {
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      const target = nearestPlayer(e);
      if (e.entering && e.x > e.r && e.x < W - e.r && e.y > e.r && e.y < H - e.r) e.entering = false;

      let dx = 0, dy = 0;
      if (target) {
        const tx = target.x - e.x, ty = target.y - e.y;
        const d = Math.hypot(tx, ty) || 1;
        if (e.type === 'chaser' || e.type === 'tank') {
          dx = tx / d; dy = ty / d;
        } else if (e.type === 'shooter') {
          const want = 340;
          const radial = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
          dx = (tx / d) * radial + (-ty / d) * 0.7 * e.strafe;
          dy = (ty / d) * radial + (tx / d) * 0.7 * e.strafe;
          if (Math.random() < dt * 0.3) e.strafe *= -1;
        } else if (e.type === 'boss') {
          // Flutua em volta do centro
          const cx = W / 2 + Math.cos(e.t * 0.4) * 380, cy = H / 2 + Math.sin(e.t * 0.7) * 200;
          dx = (cx - e.x) / 200; dy = (cy - e.y) / 200;
          const l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
        }
        if (e.entering && e.type !== 'boss') {
          dx = (W / 2 - e.x); dy = (H / 2 - e.y);
          const l = Math.hypot(dx, dy) || 1;
          dx /= l; dy /= l;
        }

        // Ataques
        e.cd -= dt;
        if (!e.entering && e.cd <= 0) {
          const aim = Math.atan2(target.y - e.y, target.x - e.x);
          if (e.type === 'shooter') {
            enemyShoot(e, aim, 360);
            e.cd = rand(1.4, 2.2);
            sfx.enemyShoot();
          } else if (e.type === 'tank') {
            for (let k = 0; k < 8; k++) enemyShoot(e, (k / 8) * Math.PI * 2 + e.t, 240, 7);
            e.cd = 3;
            sfx.enemyShoot();
          } else if (e.type === 'boss') {
            const phase = Math.floor(e.t / 6) % 3;
            if (phase === 0) {
              for (let k = 0; k < 3; k++) enemyShoot(e, e.t * 2.2 + (k * Math.PI * 2) / 3, 260, 8);
              e.cd = 0.12;
            } else if (phase === 1) {
              for (let k = -2; k <= 2; k++) enemyShoot(e, aim + k * 0.16, 380, 7);
              e.cd = 0.9;
            } else {
              for (let k = 0; k < 16; k++) enemyShoot(e, (k / 16) * Math.PI * 2, 220, 8);
              if (game.enemies.length < 14) { spawnEnemy('chaser'); spawnEnemy('chaser'); }
              e.cd = 2;
            }
            sfx.enemyShoot();
          }
        }
      }

      e.vx += (dx * e.speed - e.vx) * Math.min(1, dt * 4);
      e.vy += (dy * e.speed - e.vy) * Math.min(1, dt * 4);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (!e.entering) {
        if (e.type !== 'boss') for (const o of game.obstacles) pushOut(e, e.r, o);
        keepIn(e, e.r);
      }

      // Contato com jogadores
      for (const p of game.players) {
        if (!p.alive || e.hp <= 0) continue;
        if (dist2(p, e) < (p.r + e.r) ** 2) {
          damagePlayer(p, ENEMY[e.type].contact);
          if (e.type === 'chaser') {
            e.hp = 0;
            killEnemy(e, -1);
          } else {
            // Empurrão
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            p.vx += Math.cos(a) * 500;
            p.vy += Math.sin(a) * 500;
          }
        }
      }
    }

    // Separação simples para os inimigos não se empilharem
    const es = game.enemies;
    for (let a = 0; a < es.length; a++) {
      for (let b = a + 1; b < es.length; b++) {
        const A = es[a], B = es[b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const min = A.r + B.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = (min - d) / 2;
          const nx = dx / d, ny = dy / d;
          const wa = A.type === 'boss' ? 0 : 1, wb = B.type === 'boss' ? 0 : 1;
          A.x -= nx * push * wa * (wb ? 1 : 2);
          A.y -= ny * push * wa * (wb ? 1 : 2);
          B.x += nx * push * wb * (wa ? 1 : 2);
          B.y += ny * push * wb * (wa ? 1 : 2);
        }
      }
    }

    game.enemies = game.enemies.filter((e) => e.hp > 0);
  }

  function killEnemy(e, by) {
    const def = ENEMY[e.type];
    game.kills++;
    if (by >= 0) {
      game.score += def.score;
      floatText(e.x, e.y - e.r, '+' + def.score, COLORS[by]);
    }
    if (e.type === 'boss') {
      sfx.bigBoom();
      shake(30);
      burst(e.x, e.y, e.color, 120, 700, 1.6);
      burst(e.x, e.y, '#fff', 40, 400, 1);
      spawnPowerup(e.x - 40, e.y, 'heal');
      spawnPowerup(e.x + 40, e.y, pick(['triple', 'rapid', 'shield']));
      buzz(0, 300);
      buzz(1, 300);
    } else {
      sfx.boom();
      shake(e.type === 'tank' ? 12 : 4);
      burst(e.x, e.y, e.color, e.type === 'tank' ? 40 : 18, 350, 0.7);
      const chance = e.type === 'tank' ? 0.5 : 0.07;
      if (Math.random() < chance) spawnPowerup(e.x, e.y);
    }
    sendHud();
  }

  // ======================================================================
  // Projéteis
  // ======================================================================
  function updateBullets(dt) {
    for (const b of game.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) { b.life = 0; continue; }
      if (game.obstacles.some((o) => circleRect(b, b.r, o))) {
        b.life = 0;
        burst(b.x, b.y, b.color, 4, 120, 0.25);
        continue;
      }
      if (b.enemy) {
        for (const p of game.players) {
          if (p.alive && dist2(p, b) < (p.r + b.r) ** 2) {
            b.life = 0;
            damagePlayer(p, b.dmg);
            break;
          }
        }
      } else if (game.mode === 'versus') {
        const p = game.players[1 - b.owner];
        if (p.alive && dist2(p, b) < (p.r + b.r) ** 2) {
          b.life = 0;
          damagePlayer(p, b.dmg, b.owner);
        }
      } else {
        for (const e of game.enemies) {
          if (e.hp > 0 && dist2(e, b) < (e.r + b.r) ** 2) {
            b.life = 0;
            e.hp -= b.dmg;
            e.flash = 0.08;
            burst(b.x, b.y, e.color, 3, 150, 0.2);
            if (e.hp <= 0) killEnemy(e, b.owner);
            break;
          }
        }
      }
    }
    game.bullets = game.bullets.filter((b) => b.life > 0);
  }

  // ======================================================================
  // Loop principal
  // ======================================================================
  function update(dt) {
    const running = game.screen === 'playing' || game.screen === 'ending';
    if (running) {
      game.time += dt;
      for (const p of game.players) updatePlayer(p, dt);
      if (game.mode === 'coop') updateEnemies(dt);
      updateBullets(dt);
      updatePowerups(dt);
      sendHud();
    }
    if (game.screen !== 'paused') {
      for (const pt of game.particles) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.life -= dt;
      }
      game.particles = game.particles.filter((pt) => pt.life > 0);
      if (game.particles.length > 1500) game.particles.splice(0, game.particles.length - 1500);
      for (const t of game.texts) { t.y -= 40 * dt; t.life -= dt; }
      game.texts = game.texts.filter((t) => t.life > 0);
      if (game.banner) { game.banner.t -= dt; if (game.banner.t <= 0) game.banner = null; }
      game.shake = Math.max(0, game.shake - dt * 40);
    }
  }

  // ======================================================================
  // Desenho
  // ======================================================================
  let scale = 1;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function drawBackground() {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80, 100, 200, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 50) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // Borda da arena
    ctx.strokeStyle = 'rgba(140, 160, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }

  function drawObstacles() {
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#7c3aed';
    for (const o of game.obstacles) {
      ctx.fillStyle = 'rgba(124, 58, 237, 0.14)';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
    }
    ctx.restore();
  }

  function drawShip(p) {
    const color = COLORS[p.i];
    // Rastro
    if (p.alive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < p.trail.length; k++) {
        const t = p.trail[k];
        ctx.globalAlpha = (k / p.trail.length) * (p.dashT > 0 ? 0.6 : 0.2);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, p.r * 0.5 * (k / p.trail.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (!p.alive) {
      if (game.mode === 'coop') {
        // Nave caída + anel de reanimação
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(game.time * 6) * 0.2;
        ctx.strokeStyle = color;
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#a3e635';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + (p.revive / 2) * Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('P' + (p.i + 1) + ' CAÍDO', p.x, p.y + 50);
        ctx.restore();
      }
      return;
    }

    const blink = p.inv > 0 && Math.floor(game.time * 20) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.ang);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(5, 6, 15, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.r + 6, 0);
    ctx.lineTo(-p.r, -p.r * 0.85);
    ctx.lineTo(-p.r * 0.45, 0);
    ctx.lineTo(-p.r, p.r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (p.shield > 0) {
      ctx.save();
      ctx.globalAlpha = p.shield < 1.5 ? 0.3 + Math.sin(game.time * 20) * 0.3 : 0.6;
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#93c5fd';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Barrinha de vida e rótulo
    ctx.fillStyle = color;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P' + (p.i + 1), p.x, p.y - p.r - 16);
    const bw = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(p.x - bw / 2, p.y - p.r - 12, bw, 4);
    ctx.fillStyle = p.hp <= 2 ? '#fb7185' : color;
    ctx.fillRect(p.x - bw / 2, p.y - p.r - 12, (bw * p.hp) / MAX_HP, 4);
    if (p.dashCd > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(p.x - bw / 2, p.y + p.r + 8, bw * (1 - p.dashCd / 1.1), 2);
    }
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.shadowBlur = 18;
      ctx.shadowColor = e.color;
      ctx.strokeStyle = e.flash > 0 ? '#fff' : e.color;
      ctx.fillStyle = e.flash > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(5,6,15,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (e.type === 'chaser') {
        ctx.rotate(e.t * 4);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        }
      } else if (e.type === 'shooter') {
        ctx.rotate(e.t);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
        }
      } else if (e.type === 'tank') {
        ctx.rotate(e.t * 0.5);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const rr = k % 2 ? e.r * 0.8 : e.r;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
      } else {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2 + e.t * 0.6;
          const rr = k % 2 ? e.r * 0.78 : e.r;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (e.type === 'boss') {
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.35 + Math.sin(e.t * 6) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      if (e.type === 'tank' && e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(e.x - 25, e.y - e.r - 12, 50, 4);
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x - 25, e.y - e.r - 12, (50 * e.hp) / e.maxHp, 4);
      }
    }
    // Barra de vida do chefão
    const boss = game.enemies.find((e) => e.type === 'boss');
    if (boss) {
      const bw = 600;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(W / 2 - bw / 2, H - 36, bw, 12);
      ctx.fillStyle = boss.color;
      ctx.fillRect(W / 2 - bw / 2, H - 36, (bw * boss.hp) / boss.maxHp, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CHEFÃO', W / 2, H - 44);
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of game.bullets) {
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (b.enemy) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPowerups() {
    for (const pu of game.powerups) {
      if (pu.life < 3 && Math.floor(pu.life * 8) % 2 === 0) continue;
      const def = POWER[pu.type];
      const bob = Math.sin(pu.t * 4) * 3;
      ctx.save();
      ctx.translate(pu.x, pu.y + bob);
      ctx.rotate(pu.t);
      ctx.shadowBlur = 20;
      ctx.shadowColor = def.color;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-pu.r, -pu.r, pu.r * 2, pu.r * 2);
      ctx.restore();
      ctx.fillStyle = def.color;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, pu.x, pu.y + bob + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.restore();
    for (const t of game.texts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    ctx.save();
    ctx.font = 'bold 20px system-ui, sans-serif';
    for (const p of game.players) {
      const left = p.i === 0;
      const x = left ? 24 : W - 24;
      ctx.textAlign = left ? 'left' : 'right';
      ctx.fillStyle = COLORS[p.i];
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS[p.i];
      const name = 'JOGADOR ' + (p.i + 1) + (slots[p.i].type === 'phone' ? ' 📱' : ' ⌨');
      ctx.fillText(name, x, 34);
      ctx.shadowBlur = 0;
      // Corações
      let hearts = '';
      for (let k = 0; k < MAX_HP; k++) hearts += k < p.hp ? '♥' : '♡';
      ctx.fillStyle = '#fb7185';
      ctx.fillText(hearts, x, 60);
      // Power-ups ativos
      const pw = [];
      if (p.triple > 0) pw.push('3x ' + Math.ceil(p.triple));
      if (p.rapid > 0) pw.push('» ' + Math.ceil(p.rapid));
      if (p.shield > 0) pw.push('◈ ' + Math.ceil(p.shield));
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.fillText(pw.join('   '), x, 82);
      ctx.font = 'bold 20px system-ui, sans-serif';
    }
    ctx.textAlign = 'center';
    if (game.mode === 'versus') {
      const [a, b] = game.players;
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.fillStyle = COLORS[0];
      ctx.fillText(a.score, W / 2 - 50, 52);
      ctx.fillStyle = '#8b93b8';
      ctx.fillText('×', W / 2, 50);
      ctx.fillStyle = COLORS[1];
      ctx.fillText(b.score, W / 2 + 50, 52);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#8b93b8';
      ctx.fillText('PRIMEIRO A ' + WIN_SCORE, W / 2, 74);
    } else {
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.fillStyle = '#a3e635';
      ctx.fillText('ONDA ' + game.wave, W / 2, 36);
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = '#e8ecff';
      ctx.fillText(game.score.toLocaleString('pt-BR'), W / 2, 64);
    }
    ctx.restore();

    if (game.banner) {
      const b = game.banner;
      const a = Math.min(1, b.t * 2);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = '900 84px system-ui, sans-serif';
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 30;
      ctx.shadowColor = b.color;
      ctx.fillText(b.text, W / 2, H / 2 - 10);
      if (b.sub) {
        ctx.shadowBlur = 0;
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.fillStyle = '#e8ecff';
        ctx.fillText(b.sub, W / 2, H / 2 + 36);
      }
      ctx.restore();
    }
  }

  // Fundo animado para as telas de lobby/menu
  const attract = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-40, 40), vy: rand(-40, 40), c: pick(COLORS.concat(['#a3e635', '#a78bfa'])) }));
  function drawAttract(dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of attract) {
      s.x = (s.x + s.vx * dt + W) % W;
      s.y = (s.y + s.vy * dt + H) % H;
      ctx.fillStyle = s.c;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render(dt) {
    ctx.save();
    if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    drawBackground();
    if (game.mode && game.screen !== 'lobby' && game.screen !== 'menu') {
      drawObstacles();
      drawPowerups();
      drawEnemies();
      for (const p of game.players) drawShip(p);
      drawBullets();
      drawParticles();
      drawHud();
    } else {
      drawAttract(dt);
    }
    ctx.restore();
  }

  // Passo fixo de simulação (60 Hz) para o jogo ficar igual em qualquer monitor
  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(dt);
    requestAnimationFrame(frame);
  }

  // Pausa automática se a aba do computador for escondida
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('A janela do jogo foi minimizada');
  });

  // Ganchos para testes automatizados
  window.__neon = { game, slots, command };

  updateLobbyUI();
  startPeer();
  requestAnimationFrame(frame);
})();
