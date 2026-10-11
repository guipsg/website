// Corrida da Sorte — tela do computador (host).
// Jogo de tabuleiro por turnos estilo "party game". O computador roda tudo; os celulares
// só respondem perguntas (rolar dado, usar item, comprar, escolher no minigame).
(() => {
  'use strict';

  // ======================================================================
  // Configuração
  // ======================================================================
  const W = 1600, H = 900;
  const ID_PREFIX = 'corridadasorte-v1-';
  const COLORS = ['#38bdf8', '#f472b6'];
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const START_COINS = 10;
  const MAX_ITEMS = 3;
  const MONSTER_START = -6;

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const lerp = (a, b, t) => a + (b - a) * t;
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const name = (i) => 'Jogador ' + (i + 1);

  // ======================================================================
  // Tabuleiro: 40 casas em zigue-zague (4 linhas × 10 colunas)
  // ======================================================================
  const COLS = 10, ROWS = 4, N = COLS * ROWS, FINISH = N - 1;
  // B = azul (+3), R = vermelha, E = evento (?), S = loja, A = atalho
  const LAYOUT = ('0' + 'BBEBSBRBAB' + 'EBRBSBEBRB' + 'ABEBRSBEBR' + 'BEBSRBAE' + 'F').split('');
  const NODES = [];
  for (let k = 0; k < N; k++) {
    const r = Math.floor(k / COLS);
    const c = r % 2 === 0 ? k % COLS : COLS - 1 - (k % COLS);
    NODES.push({ x: 170 + c * 140, y: 236 + r * 158, type: LAYOUT[k] });
  }
  function nodeXY(idx) {
    if (idx < 0) return { x: 62, y: 236 + Math.min(4, -idx) * 8 };
    return NODES[Math.min(idx, FINISH)];
  }

  const SPACE_STYLE = {
    '0': { color: '#a78bfa', label: 'INÍCIO' },
    F: { color: '#facc15', label: '🏁' },
    B: { color: '#3b82f6', label: '+3' },
    R: { color: '#ef4444', label: '−3' },
    E: { color: '#22c55e', label: '?' },
    S: { color: '#f59e0b', label: '🛒' },
    A: { color: '#8b5cf6', label: '🌀' },
  };

  // ======================================================================
  // Itens
  // ======================================================================
  const ITEMS = {
    duplo: { icon: '🎲', name: 'Dado Duplo', price: 6, desc: 'Rola dois dados', modes: ['versus', 'coop'] },
    cogumelo: { icon: '🍄', name: 'Cogumelo', price: 4, desc: '+3 casas no dado', modes: ['versus', 'coop'] },
    dourado: { icon: '🌟', name: 'Dado Dourado', price: 10, desc: 'Você escolhe o número (1 a 6)', modes: ['versus', 'coop'] },
    raio: { icon: '⚡', name: 'Raio', price: 7, desc: 'O rival volta 4 casas', modes: ['versus'] },
    ladrao: { icon: '🦝', name: 'Ladrão', price: 5, desc: 'Rouba 5 moedas do rival', modes: ['versus'] },
    corrente: { icon: '⛓', name: 'Corrente', price: 6, desc: 'O monstro volta 4 casas', modes: ['coop'] },
    ima: { icon: '🧲', name: 'Ímã', price: 5, desc: 'Puxa o parceiro que está atrás até a sua casa', modes: ['coop'] },
  };
  const itemsFor = (mode) => Object.keys(ITEMS).filter((k) => ITEMS[k].modes.includes(mode));

  // ======================================================================
  // Áudio sintetizado
  // ======================================================================
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
    tick: () => tone(900, 0.03, 'square', 0.02),
    step: () => tone(520, 0.07, 'triangle', 0.05, 1.4),
    coin: () => { tone(988, 0.08, 'square', 0.04); tone(1319, 0.2, 'square', 0.04, null, 0.08); },
    bad: () => tone(220, 0.35, 'sawtooth', 0.05, 0.5),
    good: () => [523, 659, 784].forEach((f, k) => tone(f, 0.15, 'triangle', 0.07, null, k * 0.08)),
    monster: () => { tone(110, 0.5, 'sawtooth', 0.08, 0.6); tone(82, 0.6, 'square', 0.04, 0.7, 0.1); },
    fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, 0.22, 'triangle', 0.08, null, k * 0.13)),
    join: () => { tone(660, 0.08); tone(990, 0.12, 'triangle', 0.06, null, 0.09); },
    reveal: () => tone(300, 0.4, 'triangle', 0.06, 3),
  };
  window.addEventListener('pointerdown', audio);
  window.addEventListener('keydown', audio);

  // ======================================================================
  // Vagas dos jogadores
  // ======================================================================
  // type: null | 'phone' | 'kbA' | 'kbB'
  const slots = [0, 1].map((i) => ({ i, type: null, conn: null, cid: null, connected: false, lastSeen: 0, pending: null, idle: { title: 'Conectado!', text: 'Aguarde…' }, lastStat: '' }));
  const slotReady = (s) => !!s.type && (s.type !== 'phone' || s.connected);
  const allReady = () => slots.every(slotReady);

  function sendTo(i, msg) {
    const s = slots[i];
    if (s.type === 'phone' && s.conn && s.conn.open) {
      try { s.conn.send(msg); } catch (e) {}
    }
  }
  function buzz(i, ms) { sendTo(i, { t: 'buzz', ms }); }

  function setIdle(i, title, text) {
    slots[i].idle = { title, text: text || '' };
    if (!slots[i].pending) sendTo(i, { t: 'idle', title, text: text || '' });
  }
  function setIdleBoth(title, text) { setIdle(0, title, text); setIdle(1, title, text); }

  function updateLobbyUI() {
    document.querySelectorAll('.slot').forEach((el) => {
      const s = slots[+el.dataset.i];
      el.classList.toggle('on', slotReady(s));
      let label = 'aguardando…';
      if (s.type === 'phone') label = s.connected ? '📱 conectado' : '📱 reconectando…';
      else if (s.type === 'kbA') label = '⌨ teclas 1–7';
      else if (s.type === 'kbB') label = '⌨ teclas Z–M';
      el.querySelector('span').textContent = label;
    });
  }

  // ======================================================================
  // Perguntas aos jogadores (celular ou teclado)
  // ======================================================================
  let token = 0;
  let askSeq = 0;
  const ABORT = { abort: true };

  function sendAsk(i) {
    const p = slots[i].pending;
    if (p) sendTo(i, Object.assign({ t: 'ask', id: p.id }, p.spec));
  }

  // Faz uma pergunta e devolve uma Promise com o id da opção escolhida.
  function ask(i, spec) {
    const t = token;
    return new Promise((resolve, reject) => {
      const id = ++askSeq;
      slots[i].pending = {
        id, spec, t,
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

  // Pergunta aos dois; vale a primeira resposta.
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
      if (s.pending) {
        const p = s.pending;
        s.pending = null;
        p.reject(ABORT);
      }
    }
  }

  // Espera que é cancelada quando o fluxo do jogo muda (ex.: voltar ao lobby)
  function sleep(ms) {
    const t = token;
    return new Promise((resolve, reject) => setTimeout(() => (t === token ? resolve() : reject(ABORT)), ms));
  }

  const tweens = [];
  function animate(ms, step) {
    const t = token;
    return new Promise((resolve, reject) => {
      tweens.push({ start: performance.now(), ms, step, t, resolve, reject });
    });
  }

  function runFlow(fn) {
    token++;
    cancelAsks();
    if (fn) fn().catch((e) => { if (e !== ABORT) console.error(e); });
  }

  // ======================================================================
  // Rede (PeerJS)
  // ======================================================================
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
    // window.CORRIDA_PEER_OPTS permite usar um servidor PeerJS próprio (ex.: testes locais)
    peer = new Peer(ID_PREFIX + roomCode, window.CORRIDA_PEER_OPTS || {});
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
    Object.assign(s, { type: 'phone', conn, cid, connected: true, lastSeen: performance.now(), lastStat: '' });
    sfx.join();
    sendTo(s.i, { t: 'welcome', slot: s.i });
    if (s.pending) sendAsk(s.i);
    else sendTo(s.i, Object.assign({ t: 'idle' }, s.idle));
    slotsChanged();
  }

  function dropConn(conn) {
    const s = slots.find((x) => x.conn === conn);
    if (!s) return;
    s.conn = null;
    s.connected = false;
    // Fora da partida a vaga é liberada; durante a partida fica reservada para reconectar
    if (game.screen === 'lobby' || game.screen === 'menu') {
      s.type = null;
      s.cid = null;
    }
    slotsChanged();
  }

  setInterval(() => {
    const now = performance.now();
    for (const s of slots) {
      if (s.type === 'phone' && s.connected && now - s.lastSeen > 6000) dropConn(s.conn);
    }
  }, 1000);

  function slotsChanged() {
    updateLobbyUI();
    if (game.screen === 'lobby' && allReady()) runFlow(menuFlow);
    else if (game.screen === 'menu' && !allReady()) toLobby();
  }

  // ======================================================================
  // Teclado (alternativa ao celular)
  // ======================================================================
  const KEYS_A = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'];
  const KEYS_B = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'];
  const KEY_LABEL_A = ['1', '2', '3', '4', '5', '6', '7'];
  const KEY_LABEL_B = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (game.screen === 'lobby') {
      if (e.code === 'Space') kbJoin('kbA');
      if (e.code === 'Enter' || e.code === 'NumpadEnter') kbJoin('kbB');
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    if (e.code === 'Escape' && (game.screen === 'menu' || game.screen === 'over')) {
      for (const s of slots) if (s.type === 'kbA' || s.type === 'kbB') s.type = null;
      toLobby();
      return;
    }
    for (const s of slots) {
      if (!s.pending) continue;
      const keys = s.type === 'kbA' ? KEYS_A : s.type === 'kbB' ? KEYS_B : null;
      if (!keys) continue;
      const k = keys.indexOf(e.code);
      const opts = s.pending.spec.options;
      if (k >= 0 && k < opts.length) answer(s.i, s.pending.id, opts[k].id);
    }
  });

  function kbJoin(type) {
    if (slots.some((s) => s.type === type)) return;
    const s = slots.find((x) => !x.type);
    if (!s) return;
    s.type = type;
    sfx.join();
    slotsChanged();
  }

  // ======================================================================
  // Estado do jogo
  // ======================================================================
  const game = {
    screen: 'lobby', // lobby | menu | playing | over
    mode: null,
    round: 0,
    players: [],
    monster: null,
    active: -1,
    banner: null,
    dice: null,
    texts: [],
    mg: null,
    result: null,
    lastMg: null,
    time: 0,
  };

  function setScreen(s) {
    game.screen = s;
    $('#ov-lobby').classList.toggle('show', s === 'lobby');
    $('#ov-menu').classList.toggle('show', s === 'menu');
  }

  function toLobby() {
    runFlow(null);
    for (const s of slots) if (s.type === 'phone' && !s.connected) { s.type = null; s.cid = null; }
    setScreen('lobby');
    updateLobbyUI();
    setIdleBoth('Conectado!', 'Aguardando o outro jogador entrar…');
    if (allReady()) runFlow(menuFlow);
  }

  function banner(text, sub, color, ms) {
    game.banner = { text, sub: sub || '', color: color || '#fff', until: performance.now() + (ms || 2000) };
  }
  function floatText(idx, text, color) {
    const n = nodeXY(idx);
    game.texts.push({ x: n.x, y: n.y - 40, text, color: color || '#fff', life: 1.6 });
  }

  // ======================================================================
  // Fluxo: menu → partida → resultado
  // ======================================================================
  async function menuFlow() {
    setScreen('menu');
    game.mode = null;
    const { opt } = await askRace({
      title: 'Escolha o modo',
      text: 'Qualquer um dos dois pode escolher.',
      options: [
        { id: 'versus', label: '🏆 Competição', sub: 'Corrida: quem chegar primeiro vence', cls: 'versus' },
        { id: 'coop', label: '🤝 Cooperativo', sub: 'Fujam juntos do monstro', cls: 'coop' },
      ],
    });
    await gameFlow(opt);
  }

  function makePlayer(i) {
    const n = nodeXY(0);
    return { i, pos: 0, coins: START_COINS, items: [], finished: false, x: n.x, y: n.y, z: 0 };
  }

  async function gameFlow(mode) {
    game.mode = mode;
    game.round = 0;
    game.players = [makePlayer(0), makePlayer(1)];
    game.monster = mode === 'coop' ? { pos: MONSTER_START, x: nodeXY(MONSTER_START).x, y: nodeXY(MONSTER_START).y, z: 0 } : null;
    game.result = null;
    game.mg = null;
    game.dice = null;
    game.texts = [];
    game.active = -1;
    setScreen('playing');
    setIdleBoth('A partida vai começar!', 'Olhe para a tela do computador.');
    if (mode === 'versus') banner('🏆 COMPETIÇÃO', 'Quem chegar primeiro à 🏁 vence!', '#facc15', 2800);
    else banner('🤝 COOPERATIVO', 'Os dois precisam chegar à 🏁 antes do monstro 👹', '#4ade80', 3200);
    sfx.good();
    await sleep(3000);

    while (!game.result) {
      game.round++;
      const order = game.round % 2 === 1 ? [0, 1] : [1, 0];
      banner('RODADA ' + game.round, order[0] === 0 ? 'Jogador 1 começa' : 'Jogador 2 começa', '#e9d5ff', 1600);
      await sleep(1700);
      for (const i of order) {
        if (game.result) break;
        const p = game.players[i];
        if (p.finished) continue;
        await playerTurn(p);
        checkEnd();
      }
      if (game.result) break;
      if (mode === 'coop') {
        await monsterTurn();
        checkEnd();
        if (game.result) break;
      }
      await minigame();
      checkEnd();
    }
    await showResult();
  }

  function checkEnd() {
    if (game.result) return;
    const [a, b] = game.players;
    if (game.mode === 'versus') {
      const w = game.players.find((p) => p.finished);
      if (w) game.result = { win: true, winner: w.i };
    } else {
      const m = game.monster;
      const caught = game.players.find((p) => !p.finished && m.pos >= p.pos);
      if (caught) game.result = { win: false, caught: caught.i };
      else if (a.finished && b.finished) game.result = { win: true };
    }
  }

  async function showResult() {
    game.active = -1;
    game.dice = null;
    game.mg = null;
    const r = game.result;
    let title, text;
    if (game.mode === 'versus') {
      title = name(r.winner) + ' venceu! 🏆';
      text = 'Chegou primeiro à bandeira em ' + game.round + ' rodadas.';
      sfx.fanfare();
      buzz(r.winner, 600);
      buzz(1 - r.winner, 200);
    } else if (r.win) {
      title = 'Vocês escaparam! 🎉';
      text = 'Os dois chegaram à bandeira em ' + game.round + ' rodadas.';
      sfx.fanfare();
      buzz(0, 500);
      buzz(1, 500);
    } else {
      title = 'O monstro pegou o ' + name(r.caught) + '! 👹';
      text = 'Fim de jogo na rodada ' + game.round + '. Tentem de novo!';
      sfx.monster();
      buzz(0, 400);
      buzz(1, 400);
    }
    game.overlay = { title, text, color: game.mode === 'versus' ? COLORS[r.winner] : r.win ? '#4ade80' : '#ef4444' };
    setScreen('over');
    await sleep(1500);
    const { opt } = await askRace({
      title, text,
      options: [
        { id: 'again', label: '🔁 Jogar de novo', big: true },
        { id: 'menu', label: '📋 Trocar de modo' },
      ],
    });
    game.overlay = null;
    if (opt === 'again') await gameFlow(game.mode);
    else await menuFlow();
  }

  // ======================================================================
  // Turno de um jogador
  // ======================================================================
  function usable(p, key) {
    const other = game.players[1 - p.i];
    if (key === 'raio') return other.pos > 0 && !other.finished;
    if (key === 'ladrao') return other.coins > 0;
    if (key === 'ima') return !other.finished && other.pos < p.pos;
    return true;
  }

  async function playerTurn(p) {
    const other = game.players[1 - p.i];
    game.active = p.i;
    banner('Vez do ' + name(p.i), '', COLORS[p.i], 1500);
    setIdle(other.i, 'Vez do ' + name(p.i), 'Acompanhe na tela do computador.');
    setIdle(p.i, 'Sua vez!', '');
    buzz(p.i, 80);

    let dice = 1, bonus = 0, fixed = 0, usedItem = false;
    for (;;) {
      const options = [{ id: 'roll', label: '🎲 Rolar o dado', big: true }];
      if (!usedItem) {
        p.items.forEach((key, k) => {
          const it = ITEMS[key];
          options.push({ id: 'item' + k, label: it.icon + ' Usar ' + it.name, sub: it.desc, disabled: !usable(p, key) });
        });
      }
      const text = usedItem ? 'Agora role o dado!' : p.items.length ? 'Você pode usar 1 item antes de rolar.' : 'Toque para rolar o dado.';
      const opt = await ask(p.i, { title: 'Sua vez!', text, options });
      if (opt === 'roll') break;
      const k = +opt.slice(4);
      const key = p.items[k];
      p.items.splice(k, 1);
      usedItem = true;
      const it = ITEMS[key];
      banner(it.icon + ' ' + it.name + '!', name(p.i) + ' usou um item', COLORS[p.i], 1500);
      sfx.good();
      if (key === 'duplo') dice = 2;
      else if (key === 'cogumelo') bonus = 3;
      else if (key === 'dourado') {
        const n = await ask(p.i, {
          title: '🌟 Dado Dourado', text: 'Escolha o número que vai sair:', grid: true,
          options: [1, 2, 3, 4, 5, 6].map((v) => ({ id: v, label: String(v) })),
        });
        fixed = n;
      } else if (key === 'raio') {
        await sleep(800);
        sfx.bad();
        buzz(other.i, 300);
        floatText(other.pos, '⚡ −4', '#facc15');
        await moveBy(other, -4);
      } else if (key === 'ladrao') {
        const v = Math.min(5, other.coins);
        other.coins -= v;
        p.coins += v;
        sfx.coin();
        floatText(p.pos, '🦝 +' + v + ' 🪙', '#facc15');
        floatText(other.pos, '−' + v + ' 🪙', '#ef4444');
        buzz(other.i, 200);
      } else if (key === 'corrente') {
        await sleep(600);
        await moveMonster(-4);
      } else if (key === 'ima') {
        await sleep(600);
        floatText(other.pos, '🧲', '#4ade80');
        await moveTo(other, p.pos);
      }
      await sleep(900);
    }

    // Rolagem
    setIdle(p.i, '🎲 Rolando…', 'Olhe para a tela do computador!');
    let values;
    if (fixed) values = [fixed];
    else values = Array.from({ length: dice }, () => randInt(1, 6));
    const total = values.reduce((a, b) => a + b, 0) + bonus;
    await rollDice(values, bonus);
    await moveBy(p, total);

    if (p.finished) {
      sfx.fanfare();
      banner(name(p.i) + ' chegou! 🏁', game.mode === 'coop' && !other.finished ? 'Agora falta o parceiro!' : '', COLORS[p.i], 2200);
      buzz(p.i, 300);
      await sleep(2200);
    } else {
      await landOn(p);
    }
    game.dice = null;
    game.active = -1;
    setIdle(p.i, 'Aguarde…', 'Vez do outro jogador.');
  }

  async function rollDice(values, bonus) {
    game.dice = { values: values.map(() => randInt(1, 6)), bonus: 0, rolling: true };
    const t0 = performance.now();
    while (performance.now() - t0 < 1100) {
      game.dice.values = values.map(() => randInt(1, 6));
      sfx.tick();
      await sleep(70);
    }
    game.dice = { values, bonus, rolling: false };
    sfx.reveal();
    await sleep(900);
  }

  // ======================================================================
  // Movimento
  // ======================================================================
  async function hop(obj, idx) {
    const from = { x: obj.x, y: obj.y };
    const to = nodeXY(idx);
    await animate(230, (k) => {
      obj.x = lerp(from.x, to.x, k);
      obj.y = lerp(from.y, to.y, k);
      obj.z = Math.sin(k * Math.PI) * 28;
    });
    obj.pos = idx;
    obj.z = 0;
    sfx.step();
  }

  async function moveBy(p, n) {
    const dir = Math.sign(n);
    for (let k = 0; k < Math.abs(n); k++) {
      const next = p.pos + dir;
      if (next < 0) break;
      await hop(p, next);
      if (next >= FINISH) { p.finished = true; break; }
    }
  }

  async function moveTo(p, idx) {
    if (idx === p.pos) return;
    await moveBy(p, idx - p.pos);
  }

  async function moveMonster(n) {
    const m = game.monster;
    if (n > 0) sfx.monster();
    const dir = Math.sign(n);
    for (let k = 0; k < Math.abs(n); k++) {
      const next = m.pos + dir;
      if (next < MONSTER_START - 3) break;
      await hop(m, next);
    }
    floatText(Math.max(0, m.pos), n > 0 ? '👹 +' + n : '👹 ' + n, n > 0 ? '#ef4444' : '#4ade80');
  }

  async function monsterTurn() {
    game.active = -1;
    if (game.round === 1) {
      banner('👹 O monstro está acordando… 😴', 'Ele começa a correr na próxima rodada!', '#fca5a5', 2000);
      await sleep(2100);
      return;
    }
    const steps = randInt(2, 4);
    setIdleBoth('O monstro está vindo! 👹', 'Torçam para ele andar pouco…');
    banner('👹 Vez do monstro', 'Ele vai andar ' + steps + ' casas!', '#ef4444', 1800);
    await rollDice([steps], 0);
    game.dice = null;
    await moveMonster(steps);
    buzz(0, 120);
    buzz(1, 120);
    await sleep(700);
  }

  // ======================================================================
  // Casas do tabuleiro
  // ======================================================================
  function giveCoins(p, v) {
    const before = p.coins;
    p.coins = Math.max(0, p.coins + v);
    const real = p.coins - before;
    floatText(p.pos, (real >= 0 ? '+' : '') + real + ' 🪙', real >= 0 ? '#facc15' : '#ef4444');
    if (real > 0) sfx.coin();
    else if (real < 0) sfx.bad();
    return real;
  }

  function giveItem(p, key) {
    if (p.items.length >= MAX_ITEMS) return false;
    p.items.push(key);
    floatText(p.pos, ITEMS[key].icon + ' ' + ITEMS[key].name, '#e9d5ff');
    return true;
  }

  async function landOn(p) {
    const other = game.players[1 - p.i];
    const type = NODES[p.pos].type;
    if (type === 'B') {
      giveCoins(p, 3);
      await sleep(900);
    } else if (type === 'R') {
      if (game.mode === 'versus') {
        giveCoins(p, -3);
        buzz(p.i, 150);
        await sleep(900);
      } else {
        banner('Casa vermelha!', 'O monstro avança 2 casas', '#ef4444', 1500);
        await sleep(800);
        await moveMonster(2);
      }
    } else if (type === 'E') {
      await eventSpace(p);
    } else if (type === 'S') {
      await shop(p);
    } else if (type === 'A') {
      await shortcut(p);
    }

    // Encontro na mesma casa (competição): rouba 3 moedas
    if (game.mode === 'versus' && !p.finished && !other.finished && p.pos > 0 && p.pos === other.pos && other.coins > 0) {
      const v = Math.min(3, other.coins);
      other.coins -= v;
      p.coins += v;
      banner('Encontrão! 💥', name(p.i) + ' roubou ' + v + ' moedas', COLORS[p.i], 1600);
      sfx.coin();
      buzz(other.i, 200);
      await sleep(1600);
    }
  }

  async function shortcut(p) {
    banner('🌀 Atalho!', 'Pague 5 moedas para avançar 4 casas', '#a78bfa', 1500);
    if (p.coins < 5) {
      setIdle(p.i, 'Atalho 🌀', 'Você não tem moedas suficientes (precisa de 5).');
      await sleep(1600);
      return;
    }
    const opt = await ask(p.i, {
      title: '🌀 Atalho', text: 'Pagar 5 moedas para avançar 4 casas?',
      options: [{ id: 'yes', label: '✅ Pagar 5 🪙', big: true }, { id: 'no', label: 'Não, obrigado' }],
    });
    if (opt === 'yes') {
      p.coins -= 5;
      sfx.good();
      await moveBy(p, 4);
      if (p.finished) return;
    }
    await sleep(400);
  }

  async function shop(p) {
    banner('🛒 Loja', name(p.i) + ' está fazendo compras', '#f59e0b', 1500);
    const list = itemsFor(game.mode);
    for (;;) {
      const full = p.items.length >= MAX_ITEMS;
      const options = list.map((key) => {
        const it = ITEMS[key];
        return { id: key, label: it.icon + ' ' + it.name + ' — ' + it.price + ' 🪙', sub: it.desc, disabled: full || p.coins < it.price };
      });
      options.push({ id: 'exit', label: '🚪 Sair da loja' });
      const text = 'Você tem ' + p.coins + ' moedas.' + (full ? '\nSua mochila está cheia (máx. ' + MAX_ITEMS + ' itens).' : '');
      const opt = await ask(p.i, { title: '🛒 Loja', text, options });
      if (opt === 'exit') break;
      const it = ITEMS[opt];
      if (p.coins < it.price || p.items.length >= MAX_ITEMS) continue;
      p.coins -= it.price;
      p.items.push(opt);
      sfx.coin();
      floatText(p.pos, it.icon + ' comprou!', '#facc15');
    }
  }

  async function eventSpace(p) {
    const other = game.players[1 - p.i];
    const versus = [
      { w: 3, text: 'Vento a favor! Avance 3 casas.', run: () => moveBy(p, 3) },
      { w: 3, text: 'Buraco! Volte 3 casas.', run: () => moveBy(p, -3) },
      { w: 3, text: 'Baú do tesouro! Ganhe 8 moedas.', run: () => giveCoins(p, 8) },
      { w: 2, text: 'Pedágio! Dê 4 moedas ao rival.', run: () => { const v = -giveCoins(p, -4); other.coins += v; } },
      { w: 2, text: 'Presente! Ganhe um item surpresa.', run: () => { if (!giveItem(p, pick(itemsFor('versus')))) giveCoins(p, 5); } },
      { w: 1, text: 'Troca-troca! Você troca de lugar com o rival.', run: () => swap(p, other) },
    ];
    const coop = [
      { w: 3, text: 'Vento a favor! Avance 3 casas.', run: () => moveBy(p, 3) },
      { w: 2, text: 'Buraco! Volte 2 casas.', run: () => moveBy(p, -2) },
      { w: 3, text: 'Baú do tesouro! Ganhe 6 moedas.', run: () => giveCoins(p, 6) },
      { w: 2, text: 'O monstro tropeçou! Ele volta 3 casas.', run: () => moveMonster(-3) },
      { w: 2, text: 'O monstro farejou vocês! Ele avança 2 casas.', run: () => moveMonster(2) },
      { w: 2, text: 'Presente! Ganhe um item surpresa.', run: () => { if (!giveItem(p, pick(itemsFor('coop')))) giveCoins(p, 5); } },
      { w: 2, text: 'Carona! Seu parceiro avança 2 casas.', run: () => (other.finished ? giveCoins(p, 4) : moveBy(other, 2)) },
    ];
    const list = game.mode === 'versus' ? versus : coop;
    const total = list.reduce((a, e) => a + e.w, 0);
    let r = Math.random() * total;
    const ev = list.find((e) => (r -= e.w) < 0) || list[0];
    banner('❓ Evento', ev.text, '#22c55e', 2400);
    setIdle(p.i, '❓ Evento', ev.text);
    sfx.reveal();
    await sleep(1600);
    await ev.run();
    await sleep(900);
  }

  async function swap(a, b) {
    const pa = a.pos, pb = b.pos;
    const A = nodeXY(pa), B = nodeXY(pb);
    await animate(600, (k) => {
      a.x = lerp(A.x, B.x, k); a.y = lerp(A.y, B.y, k); a.z = Math.sin(k * Math.PI) * 60;
      b.x = lerp(B.x, A.x, k); b.y = lerp(B.y, A.y, k); b.z = Math.sin(k * Math.PI) * 60;
    });
    a.pos = pb; b.pos = pa; a.z = b.z = 0;
    sfx.good();
  }

  // ======================================================================
  // Minigames (no fim de cada rodada, escolhas secretas no celular)
  // ======================================================================
  const MINIGAMES = [
    { id: 'baus', modes: ['versus', 'coop'], run: mgChests },
    { id: 'maior', modes: ['versus', 'coop'], run: mgHigherLower },
    { id: 'arriscar', modes: ['versus', 'coop'], run: mgPushLuck },
    { id: 'ppt', modes: ['versus'], run: mgRps },
    { id: 'leilao', modes: ['versus'], run: mgAuction },
    { id: 'barricada', modes: ['coop'], run: mgBarricade },
  ];

  async function minigame() {
    const list = MINIGAMES.filter((m) => m.modes.includes(game.mode) && m.id !== game.lastMg);
    const mg = pick(list);
    game.lastMg = mg.id;
    game.active = -1;
    setIdleBoth('🎮 Minigame!', 'Olhe para a tela do computador.');
    sfx.fanfare();
    banner('🎮 MINIGAME!', '', '#facc15', 1400);
    await sleep(1500);
    await mg.run();
    game.mg = null;
  }

  function openMg(title, rules) {
    game.mg = { title, rules, big: '', bigSize: 80, status: ['', ''], result: '' };
    return game.mg;
  }

  // Pergunta aos dois ao mesmo tempo, mostrando quem já escolheu
  function askBoth(specs, mg, who) {
    const ids = who || [0, 1];
    ids.forEach((i) => { mg.status[i] = 'escolhendo…'; });
    return Promise.all(ids.map((i) => ask(i, specs[i] || specs[0]).then((v) => {
      mg.status[i] = '✔ pronto';
      sfx.tick();
      return v;
    })));
  }

  async function mgChests() {
    const coop = game.mode === 'coop';
    const mg = openMg('📦 Três Baús', coop
      ? 'Cada um abre um baú. Dois têm moedas… e um tem o monstro! (Se abrirem o mesmo, os dois ganham o mesmo prêmio.)'
      : 'Cada um escolhe um baú em segredo. Um tem 10 moedas, outro 4 e outro uma bomba (−5). Se escolherem o mesmo, dividem!');
    const contents = shuffle(coop ? [8, 4, 'M'] : [10, 4, -5]);
    mg.big = '📦     📦     📦';
    await sleep(2500);
    const spec = {
      title: '📦 Três Baús', text: 'Escolha um baú em segredo:',
      options: [0, 1, 2].map((k) => ({ id: k, label: '📦 Baú ' + (k + 1) })),
    };
    const [a, b] = await askBoth([spec], mg);
    sfx.reveal();
    const show = (c) => (c === 'M' ? '👹' : c < 0 ? '💣' : '🪙' + c);
    mg.big = contents.map(show).join('    ');
    mg.status = ['abriu o baú ' + (a + 1), 'abriu o baú ' + (b + 1)];
    await sleep(1200);
    const res = [];
    if (coop) {
      const picks = [a, b];
      picks.forEach((k, i) => { if (contents[k] !== 'M') { game.players[i].coins += contents[k]; res.push(name(i) + ' +' + contents[k] + ' 🪙'); } });
      if (picks.some((k) => contents[k] === 'M')) {
        res.push('O monstro escapou do baú! 👹 +2');
        mg.result = res.join(' · ');
        await sleep(1500);
        game.mg = null;
        await moveMonster(2);
        return;
      }
      sfx.coin();
    } else if (a === b) {
      const v = contents[a];
      const each = v > 0 ? Math.floor(v / 2) : v;
      game.players.forEach((p) => { p.coins = Math.max(0, p.coins + each); });
      res.push('Mesmo baú! Cada um: ' + (each > 0 ? '+' : '') + each + ' 🪙');
      v > 0 ? sfx.coin() : sfx.bad();
    } else {
      [a, b].forEach((k, i) => {
        const p = game.players[i];
        p.coins = Math.max(0, p.coins + contents[k]);
        res.push(name(i) + ': ' + (contents[k] > 0 ? '+' : '') + contents[k] + ' 🪙');
      });
      sfx.coin();
    }
    mg.result = res.join(' · ');
    await sleep(3200);
  }

  async function mgHigherLower() {
    const coop = game.mode === 'coop';
    const mg = openMg('🃏 Maior ou Menor', 'A próxima carta (1 a 10) vai ser maior ou menor que esta? Quem acertar ganha 5 moedas.' +
      (coop ? ' Se os dois acertarem, o monstro recua 2 casas!' : ''));
    const card = randInt(2, 9);
    let next;
    do { next = randInt(1, 10); } while (next === card);
    mg.big = '🂠 ' + card;
    await sleep(2200);
    const spec = {
      title: '🃏 Maior ou Menor', text: 'A carta na tela é ' + card + '. A próxima será…',
      options: [{ id: 'up', label: '⬆ Maior' }, { id: 'down', label: '⬇ Menor' }],
    };
    const picks = await askBoth([spec], mg);
    sfx.reveal();
    mg.big = card + '  →  ' + next;
    const right = picks.map((v) => (v === 'up') === (next > card));
    mg.status = right.map((ok, i) => (picks[i] === 'up' ? 'Maior' : 'Menor') + (ok ? ' ✅' : ' ❌'));
    right.forEach((ok, i) => { if (ok) game.players[i].coins += 5; });
    const res = right.map((ok, i) => name(i) + (ok ? ' +5 🪙' : ' errou')).join(' · ');
    mg.result = res;
    right.some(Boolean) ? sfx.coin() : sfx.bad();
    await sleep(2600);
    if (coop && right[0] && right[1]) {
      mg.result = 'Os dois acertaram! O monstro recua 2 casas.';
      await sleep(1200);
      game.mg = null;
      await moveMonster(-2);
    }
  }

  async function mgPushLuck() {
    const mg = openMg('💣 Arriscar ou Parar', 'A cada carta o pote ganha 3 moedas. Pare a qualquer momento para levar o pote — mas se sair uma bomba, quem ainda estiver no jogo perde tudo!');
    const pot = [2, 2];
    const inGame = [true, true];
    const banked = [0, 0];
    mg.big = 'Pote: 🪙 2';
    await sleep(2800);
    for (let round = 1; round <= 6 && inGame.some(Boolean); round++) {
      const who = [0, 1].filter((i) => inGame[i]);
      const specs = [0, 1].map((i) => ({
        title: '💣 Arriscar ou Parar', text: 'Seu pote: ' + pot[i] + ' moedas.\nChance de bomba aumenta a cada carta.',
        options: [{ id: 'go', label: '🎲 Continuar' }, { id: 'stop', label: '✋ Parar e levar ' + pot[i] + ' 🪙' }],
      }));
      const picks = await askBoth(specs, mg, who);
      who.forEach((i, k) => {
        if (picks[k] === 'stop') {
          inGame[i] = false;
          banked[i] = pot[i];
          mg.status[i] = '✋ parou com ' + pot[i] + ' 🪙';
        }
      });
      if (!inGame.some(Boolean)) break;
      await sleep(600);
      const bomb = Math.random() < 0.12 + round * 0.08;
      sfx.reveal();
      if (bomb) {
        mg.big = '💣 BOMBA!';
        sfx.bad();
        [0, 1].forEach((i) => { if (inGame[i]) { inGame[i] = false; pot[i] = 0; mg.status[i] = '💥 perdeu o pote'; buzz(i, 300); } });
        break;
      }
      [0, 1].forEach((i) => { if (inGame[i]) { pot[i] += 3; mg.status[i] = 'no jogo · pote ' + pot[i]; } });
      mg.big = '🪙 +3  (carta ' + round + ')';
      await sleep(900);
    }
    // Quem continuou até o fim sem bomba leva o pote
    [0, 1].forEach((i) => { if (inGame[i]) banked[i] = pot[i]; });
    banked.forEach((v, i) => { game.players[i].coins += v; });
    mg.result = banked.map((v, i) => name(i) + ' +' + v + ' 🪙').join(' · ');
    if (banked.some((v) => v > 0)) sfx.coin();
    await sleep(3000);
  }

  async function mgRps() {
    const mg = openMg('✊ Pedra, Papel e Tesoura', 'Quem vencer ganha 6 moedas. Empate? Joga de novo (até 3 vezes).');
    const ICON = { r: '✊', p: '✋', s: '✌' };
    const beats = { r: 's', p: 'r', s: 'p' };
    mg.big = '✊ ✋ ✌';
    await sleep(2000);
    for (let k = 0; k < 3; k++) {
      const spec = {
        title: '✊ Pedra, Papel e Tesoura', text: 'Escolha em segredo:',
        options: [{ id: 'r', label: '✊ Pedra' }, { id: 'p', label: '✋ Papel' }, { id: 's', label: '✌ Tesoura' }],
      };
      const [a, b] = await askBoth([spec], mg);
      sfx.reveal();
      mg.big = ICON[a] + '  vs  ' + ICON[b];
      mg.status = ['', ''];
      if (a === b) {
        mg.result = 'Empate! De novo…';
        await sleep(1800);
        mg.result = '';
        continue;
      }
      const w = beats[a] === b ? 0 : 1;
      game.players[w].coins += 6;
      mg.result = name(w) + ' venceu! +6 🪙';
      sfx.coin();
      buzz(w, 200);
      await sleep(2800);
      return;
    }
    mg.result = 'Três empates! Ninguém ganha.';
    await sleep(2200);
  }

  async function mgAuction() {
    const key = pick(itemsFor('versus'));
    const it = ITEMS[key];
    const mg = openMg('🔨 Leilão Secreto', 'Cada um dá um lance em segredo pelo item. O maior lance leva (e paga). Empate: ninguém leva.');
    mg.big = it.icon + ' ' + it.name;
    mg.bigSize = 60;
    await sleep(2500);
    const specs = game.players.map((p) => {
      const full = p.items.length >= MAX_ITEMS;
      return {
        title: '🔨 Leilão: ' + it.icon + ' ' + it.name, text: it.desc + '\nVocê tem ' + p.coins + ' moedas.' + (full ? '\n(Mochila cheia: só pode dar lance 0.)' : ''),
        grid: true,
        options: [0, 2, 4, 6, 8, 10].map((v) => ({ id: v, label: v + ' 🪙', disabled: v > p.coins || (full && v > 0) })),
      };
    });
    const [a, b] = await askBoth(specs, mg);
    sfx.reveal();
    mg.status = ['lance: ' + a + ' 🪙', 'lance: ' + b + ' 🪙'];
    if (a === b) {
      mg.result = 'Empate! Ninguém leva o item.';
    } else {
      const w = a > b ? 0 : 1;
      const p = game.players[w];
      p.coins -= Math.max(a, b);
      p.items.push(key);
      mg.result = name(w) + ' levou ' + it.icon + ' ' + it.name + '!';
      sfx.good();
    }
    await sleep(3000);
  }

  async function mgBarricade() {
    const target = randInt(5, 8);
    const mg = openMg('🪵 Barricada', 'Construam uma barricada com pelo menos ' + target + ' tábuas. Cada um escolhe: 2 tábuas garantidas ou arriscar (0 ou 5). Conseguiram? O monstro recua 3. Não? Ele avança 1.');
    mg.big = 'Meta: 🪵 ' + target;
    await sleep(2800);
    const spec = {
      title: '🪵 Barricada', text: 'Meta: ' + target + ' tábuas. O que você traz?',
      options: [{ id: 'safe', label: '🪵🪵 2 tábuas garantidas' }, { id: 'risk', label: '🎲 Arriscar: 0 ou 5 tábuas' }],
    };
    const picks = await askBoth([spec], mg);
    sfx.reveal();
    const got = picks.map((v) => (v === 'safe' ? 2 : Math.random() < 0.5 ? 0 : 5));
    const sum = got[0] + got[1];
    mg.status = got.map((v, i) => (picks[i] === 'safe' ? 'garantido: ' : 'arriscou: ') + v + ' 🪵');
    mg.big = '🪵 ' + sum + ' / ' + target;
    const ok = sum >= target;
    mg.result = ok ? 'Barricada pronta! O monstro recua 3 casas.' : 'Não deu… o monstro avança 1 casa.';
    ok ? sfx.good() : sfx.bad();
    await sleep(2600);
    game.mg = null;
    await moveMonster(ok ? -3 : 1);
  }

  // ======================================================================
  // Estatísticas no celular
  // ======================================================================
  function sendStats() {
    for (const s of slots) {
      const p = game.players[s.i];
      const msg = p && game.screen !== 'menu' && game.screen !== 'lobby'
        ? { t: 'stat', show: true, coins: p.coins, items: p.items.map((k) => ITEMS[k].icon) }
        : { t: 'stat', show: false, items: [] };
      const key = JSON.stringify(msg);
      if (key !== s.lastStat) {
        s.lastStat = key;
        sendTo(s.i, msg);
      }
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

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    ctx.fillText(str, x, y);
  }

  // Quebra um texto em linhas que cabem na largura
  function wrap(str, maxW, size) {
    ctx.font = '500 ' + size + 'px "Segoe UI", system-ui, sans-serif';
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1a0f3d');
    g.addColorStop(1, '#0d0820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // estrelinhas
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 0; k < 70; k++) {
      const x = (k * 263) % W, y = (k * 157) % H;
      const tw = 0.5 + 0.5 * Math.sin(game.time * 2 + k);
      ctx.globalAlpha = 0.15 + tw * 0.35;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoard() {
    // Caminho
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.25)';
    ctx.lineWidth = 34;
    ctx.beginPath();
    NODES.forEach((n, k) => (k ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(233, 213, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 14]);
    ctx.stroke();
    ctx.restore();

    // Casas
    NODES.forEach((n, k) => {
      const st = SPACE_STYLE[n.type];
      const r = n.type === '0' || n.type === 'F' ? 42 : 32;
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = st.color;
      ctx.fillStyle = st.color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.stroke();
      let label = st.label;
      if (n.type === 'R' && game.mode === 'coop') label = '👹';
      const size = n.type === '0' ? 15 : label.length > 2 ? 18 : 24;
      ctx.textBaseline = 'middle';
      text(label, n.x, n.y + 1, size, '#fff');
      ctx.textBaseline = 'alphabetic';
      if (k > 0 && k < FINISH) text(String(k), n.x + r - 4, n.y + r + 4, 11, 'rgba(255,255,255,0.45)', 'center', '600');
    });
  }

  function drawPawn(p) {
    const color = COLORS[p.i];
    const other = game.players[1 - p.i];
    let ox = 0;
    if (other && other.pos === p.pos && !p.z && !other.z) ox = p.i === 0 ? -16 : 16;
    const x = p.x + ox, y = p.y - p.z;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x + ox, p.y + 14, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (game.active === p.i) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(game.time * 6);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y - 6, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 18, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 8);
    ctx.quadraticCurveTo(x, y - 30, x + 15, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y - 18, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    text(String(p.i + 1), x, y - 17, 15, '#0d0820', 'center', '900');
    ctx.textBaseline = 'alphabetic';
  }

  function drawMonster() {
    const m = game.monster;
    if (!m) return;
    const bob = Math.sin(game.time * 5) * 3;
    ctx.textBaseline = 'middle';
    ctx.font = '54px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👹', m.x, m.y - 30 - m.z + bob);
    ctx.textBaseline = 'alphabetic';
    if (m.pos < 0) text(m.pos + ' casas', m.x, m.y + 22, 13, '#fca5a5');
  }

  function drawHud() {
    for (const p of game.players) {
      const left = p.i === 0;
      const x = left ? 24 : W - 24 - 440;
      const active = game.active === p.i;
      ctx.save();
      roundRect(x, 18, 440, 116, 18);
      ctx.fillStyle = 'rgba(24, 16, 52, 0.85)';
      ctx.fill();
      ctx.lineWidth = active ? 4 : 2;
      ctx.strokeStyle = active ? COLORS[p.i] : 'rgba(190,160,255,0.25)';
      if (active) { ctx.shadowBlur = 20; ctx.shadowColor = COLORS[p.i]; }
      ctx.stroke();
      ctx.restore();
      const s = slots[p.i];
      text(name(p.i) + (s.type === 'phone' ? (s.connected ? ' 📱' : ' 📵') : ' ⌨'), x + 20, 54, 24, COLORS[p.i], 'left', '900');
      text(p.finished ? '🏁 Chegou!' : 'Casa ' + p.pos + ' / ' + FINISH, x + 420, 54, 18, '#e9d5ff', 'right');
      text('🪙 ' + p.coins, x + 20, 100, 30, '#facc15', 'left', '900');
      const icons = p.items.map((k) => ITEMS[k].icon).join(' ');
      text(icons || 'sem itens', x + 420, 100, icons ? 30 : 16, icons ? '#fff' : 'rgba(255,255,255,0.4)', 'right', icons ? 'bold' : '500');
      if (s.type === 'phone' && !s.connected) text('desconectado — aguardando…', x + 220, 126, 14, '#fb7185');
    }
    text('RODADA ' + Math.max(1, game.round), W / 2, 56, 30, '#e9d5ff', 'center', '900');
    if (game.mode === 'versus') {
      text('🏆 Competição', W / 2, 90, 18, '#facc15');
    } else {
      text('🤝 Cooperativo', W / 2, 90, 18, '#4ade80');
      const behind = game.players.filter((p) => !p.finished);
      if (behind.length) {
        const gap = Math.min(...behind.map((p) => p.pos)) - game.monster.pos;
        text('👹 a ' + gap + ' casa' + (gap === 1 ? '' : 's') + ' de vocês', W / 2, 120, 18, gap <= 4 ? '#f87171' : '#fca5a5');
      }
    }
  }

  function drawDie(cx, cy, size, v) {
    roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.18);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c4b5fd';
    ctx.stroke();
    const P = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    }[v] || [];
    ctx.fillStyle = '#1e1640';
    for (const [dx, dy] of P) {
      ctx.beginPath();
      ctx.arc(cx + dx * size * 0.27, cy + dy * size * 0.27, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDice() {
    const d = game.dice;
    if (!d) return;
    const size = 120, gap = 30;
    const n = d.values.length;
    const w = n * size + (n - 1) * gap;
    const cy = 470;
    roundRect(W / 2 - w / 2 - 40, cy - size / 2 - 40, w + 80, size + (d.rolling ? 80 : 130), 24);
    ctx.fillStyle = 'rgba(13, 8, 32, 0.85)';
    ctx.fill();
    d.values.forEach((v, k) => {
      const cx = W / 2 - w / 2 + size / 2 + k * (size + gap);
      const wob = d.rolling ? Math.sin(game.time * 40 + k) * 8 : 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(wob * 0.02);
      drawDie(0, 0, size, v);
      ctx.restore();
    });
    if (!d.rolling) {
      const sum = d.values.reduce((a, b) => a + b, 0) + d.bonus;
      const extra = d.bonus ? ' (+' + d.bonus + ')' : '';
      text('= ' + sum + extra, W / 2, cy + size / 2 + 60, 40, '#facc15', 'center', '900');
    }
  }

  function drawBanner() {
    const b = game.banner;
    if (!b) return;
    const left = b.until - performance.now();
    if (left <= 0) { game.banner = null; return; }
    const a = Math.min(1, left / 300);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(13, 8, 32, 0.8)';
    // Faixa embaixo do tabuleiro para não esconder os peões
    roundRect(W / 2 - 560, 792, 1120, 98, 20);
    ctx.fill();
    ctx.shadowBlur = 24;
    ctx.shadowColor = b.color;
    text(b.text, W / 2, b.sub ? 836 : 854, 38, b.color, 'center', '900');
    ctx.shadowBlur = 0;
    if (b.sub) text(b.sub, W / 2, 874, 22, '#f3efff', 'center', '600');
    ctx.restore();
  }

  function drawTexts(dt) {
    for (const t of game.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(13,8,32,0.9)';
      ctx.font = '900 26px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    game.texts = game.texts.filter((t) => t.life > 0);
  }

  function drawPanel(title, color, lines, opts) {
    const w = 1000, h = (opts && opts.h) || 520;
    const x = W / 2 - w / 2, y = H / 2 - h / 2 + 40;
    ctx.fillStyle = 'rgba(8, 4, 20, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    roundRect(x, y, w, h, 26);
    ctx.fillStyle = 'rgba(30, 20, 64, 0.97)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.restore();
    text(title, W / 2, y + 66, 46, color, 'center', '900');
    return { x, y, w, h };
  }

  function drawMinigame() {
    const mg = game.mg;
    if (!mg) return;
    const box = drawPanel(mg.title, '#facc15', []);
    const lines = wrap(mg.rules, box.w - 100, 20);
    lines.forEach((l, k) => text(l, W / 2, box.y + 108 + k * 28, 20, '#d8ccff', 'center', '500'));
    if (mg.big) {
      ctx.textBaseline = 'middle';
      text(mg.big, W / 2, box.y + 270, mg.bigSize, '#fff', 'center', '900');
      ctx.textBaseline = 'alphabetic';
    }
    [0, 1].forEach((i) => {
      const x = i === 0 ? box.x + 60 : box.x + box.w - 60;
      text(name(i), x, box.y + 390, 22, COLORS[i], i === 0 ? 'left' : 'right', '900');
      text(mg.status[i] || '', x, box.y + 420, 20, '#f3efff', i === 0 ? 'left' : 'right', '600');
    });
    if (mg.result) text(mg.result, W / 2, box.y + 485, 28, '#facc15', 'center', '900');
  }

  function drawOverlay() {
    const o = game.overlay;
    if (!o) return;
    const box = drawPanel(o.title, o.color, [], { h: 380 });
    text(o.text, W / 2, box.y + 140, 26, '#f3efff', 'center', '600');
    [0, 1].forEach((i) => {
      const p = game.players[i];
      text(name(i) + ': 🪙 ' + p.coins + (p.finished ? '  🏁' : '  casa ' + p.pos), W / 2, box.y + 210 + i * 40, 24, COLORS[i]);
    });
    text('Escolham no celular: jogar de novo ou trocar de modo', W / 2, box.y + 330, 18, '#a39bc4', 'center', '500');
  }

  // Painel com as opções para quem joga no teclado
  function drawKeyboardHelp() {
    let y = 170;
    for (const s of slots) {
      if (!s.pending || (s.type !== 'kbA' && s.type !== 'kbB')) continue;
      const labels = s.type === 'kbA' ? KEY_LABEL_A : KEY_LABEL_B;
      const opts = s.pending.spec.options.slice(0, 7).map((o, k) => '[' + labels[k] + '] ' + o.label + (o.disabled ? ' ✖' : '')).join('   ');
      const str = '⌨ ' + name(s.i) + ' — ' + s.pending.spec.title + ':   ' + opts;
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      const w = Math.min(W - 40, ctx.measureText(str).width + 30);
      roundRect(W / 2 - w / 2, y - 26, w, 34, 10);
      ctx.fillStyle = 'rgba(13, 8, 32, 0.92)';
      ctx.fill();
      ctx.strokeStyle = COLORS[s.i];
      ctx.lineWidth = 2;
      ctx.stroke();
      text(str, W / 2, y - 3, 16, '#f3efff');
      y += 38;
    }
  }

  // ======================================================================
  // Loop
  // ======================================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.time += dt;

    for (let k = tweens.length - 1; k >= 0; k--) {
      const tw = tweens[k];
      if (tw.t !== token) { tweens.splice(k, 1); tw.reject(ABORT); continue; }
      const p = Math.min(1, (now - tw.start) / tw.ms);
      tw.step(p);
      if (p >= 1) { tweens.splice(k, 1); tw.resolve(); }
    }

    drawBackground();
    if (game.mode && game.screen !== 'lobby' && game.screen !== 'menu') {
      drawBoard();
      drawMonster();
      for (const p of game.players) drawPawn(p);
      drawHud();
      drawTexts(dt);
      drawDice();
      drawBanner();
      drawMinigame();
      drawOverlay();
    }
    drawKeyboardHelp();
    sendStats();
    requestAnimationFrame(frame);
  }

  // Ganchos para testes automatizados
  window.__corrida = { game, slots, answer };

  updateLobbyUI();
  startPeer();
  requestAnimationFrame(frame);
})();
