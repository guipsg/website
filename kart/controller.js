// Turbo Kart — controle no celular.
// Menus: o computador manda perguntas ("ask") e o celular devolve a opção tocada.
// Corrida: o celular envia ~30x/s o volante (-1..1), acelerador, freio e o botão de item.
(() => {
  'use strict';

  const ID_PREFIX = 'turbokart-v1-';
  const COLORS = ['#3b82f6', '#ec4899'];
  const $ = (s) => document.querySelector(s);

  let cid;
  try {
    cid = localStorage.getItem('kart-cid');
    if (!cid) {
      cid = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('kart-cid', cid);
    }
  } catch (e) {
    cid = Math.random().toString(36).slice(2, 12);
  }
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  let room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let peer = null;
  let conn = null;
  let full = false;
  let retryTimer = null;
  let currentAsk = null;
  let driving = false;

  // ---------- Telas ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('show', el.id === id));
  }

  function menu(title, text, options, opts) {
    show('s-menu');
    $('#title').textContent = title || '';
    $('#text').textContent = text || '';
    const box = $('#options');
    box.innerHTML = '';
    box.classList.toggle('two', !!(opts && opts.two));
    (options || []).forEach((o) => {
      const b = document.createElement('button');
      b.className = 'btn' + (o.big ? ' big' : '') + (o.cls ? ' ' + o.cls : '');
      b.disabled = !!o.disabled;
      if (o.color) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.style.background = o.color;
        chip.style.borderColor = o.accent || '#fff';
        b.appendChild(chip);
      }
      b.appendChild(document.createTextNode(o.label));
      if (o.sub) {
        const s = document.createElement('small');
        s.textContent = o.sub;
        b.appendChild(s);
      }
      b.onclick = o.onclick;
      box.appendChild(b);
    });
  }

  function message(title, text, btn) {
    currentAsk = null;
    driving = false;
    menu(title, text, btn ? [{ label: btn.label, onclick: btn.onclick }] : []);
  }

  // ---------- Conexão ----------
  $('#join-btn').onclick = () => {
    const v = $('#code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length !== 4) { $('#code').focus(); return; }
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
      // window.KART_PEER_OPTS permite usar um servidor PeerJS próprio (ex.: testes locais)
      peer = new Peer(window.KART_PEER_OPTS || {});
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
    c.on('open', () => { clearTimeout(timeout); send({ t: 'hello', cid }); });
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
    if (conn && conn.open) { try { conn.send(msg); } catch (e) {} }
  }

  function onData(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'welcome': {
        document.documentElement.style.setProperty('--player', COLORS[m.slot] || COLORS[0]);
        document.querySelectorAll('.badge').forEach((b) => { b.textContent = 'Jogador ' + (m.slot + 1); b.hidden = false; });
        vibrate(60);
        break;
      }
      case 'full':
        full = true;
        message('Sala cheia', 'Já existem 2 jogadores conectados.');
        break;
      case 'idle':
        currentAsk = null;
        driving = false;
        resetInput();
        menu(m.title, m.text, []);
        break;
      case 'ask':
        currentAsk = m.id;
        driving = false;
        resetInput();
        vibrate(40);
        menu(m.title, m.text, (m.options || []).map((o) => Object.assign({}, o, { onclick: () => answer(m.id, o.id) })), { two: m.two });
        break;
      case 'drive':
        currentAsk = null;
        if (!driving) {
          driving = true;
          resetInput();
          show('s-drive');
          requestWakeLock();
        }
        break;
      case 'pick':
        currentAsk = null;
        driving = false;
        resetInput();
        show('s-pick');
        $('#pk-chip').style.background = m.color || '#64748b';
        $('#pk-name').textContent = m.name || '';
        $('#pk-sub').textContent = m.sub || '';
        $('#pk-ready').hidden = !m.ready;
        break;
      case 'hud':
        $('#race-info').textContent = m.text || '';
        $('#item-ico').textContent = m.item || '🎁';
        break;
      case 'buzz':
        vibrate(m.ms);
        break;
    }
  }

  function answer(id, opt) {
    if (currentAsk !== id) return;
    currentAsk = null;
    send({ t: 'answer', id, opt });
    vibrate(20);
    document.querySelectorAll('#options .btn').forEach((b) => { b.disabled = true; });
  }

  // Direcional da seleção de piloto
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      send({ t: 'nav', d: el.dataset.nav });
      vibrate(15);
    });
  });

  // ---------- Entrada da corrida ----------
  const input = { s: 0, g: 0, b: 0, i: 0 }; // i = contador de toques no botão de item
  let steerMode = store.get('kart-steer') === 'gyro' ? 'gyro' : 'wheel';
  let wheelSteer = 0;
  let gyroSteer = 0;
  let gyroOffset = parseFloat(store.get('kart-gyro-offset') || '0') || 0;
  let gyroRaw = 0;
  let gyroOk = false;
  let needCalibration = false;
  const MAX_WHEEL_DEG = 110; // rotação do volante virtual que vale virar tudo
  const MAX_TILT_DEG = 32; // inclinação do celular que vale virar tudo

  function resetInput() {
    input.g = 0;
    input.b = 0;
    wheelSteer = 0;
    document.querySelectorAll('.pedal').forEach((p) => p.classList.remove('down'));
  }

  // Pedais com multitoque (cada botão guarda os dedos que o seguram)
  function pedal(el, key, onPress) {
    const ids = new Set();
    const set = () => {
      el.classList.toggle('down', ids.size > 0);
      if (key) input[key] = ids.size > 0 ? 1 : 0;
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      ids.add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      set();
      vibrate(12);
      if (onPress) onPress();
    });
    const up = (e) => { ids.delete(e.pointerId); set(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }
  pedal($('#btn-gas'), 'g');
  pedal($('#btn-brake'), 'b');
  pedal($('#btn-item'), null, () => { input.i = (input.i + 1) % 1000; });

  // Volante virtual: arraste girando em volta do centro
  const zone = $('#steer-zone');
  const wheel = $('#wheel');
  let wheelPid = null;
  let wheelStartAng = 0;
  let wheelStartSteer = 0;
  function angleAt(e) {
    const r = wheel.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }
  zone.addEventListener('pointerdown', (e) => {
    if (steerMode !== 'wheel' || wheelPid !== null) return;
    e.preventDefault();
    wheelPid = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch (err) {}
    wheelStartAng = angleAt(e);
    wheelStartSteer = wheelSteer;
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== wheelPid) return;
    let d = angleAt(e) - wheelStartAng;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    wheelSteer = Math.max(-1, Math.min(1, wheelStartSteer + d / MAX_WHEEL_DEG));
  });
  const wheelUp = (e) => { if (e.pointerId === wheelPid) { wheelPid = null; } };
  zone.addEventListener('pointerup', wheelUp);
  zone.addEventListener('pointercancel', wheelUp);

  // Giroscópio: ângulo da gravidade no plano da tela (funciona em pé ou inclinado)
  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta * Math.PI / 180;
    const g = e.gamma * Math.PI / 180;
    // Gravidade nas coordenadas do aparelho (a partir de beta/gamma, que são iguais no iOS e Android)
    const gx = Math.sin(g) * Math.cos(b);
    const gy = -Math.sin(b);
    if (Math.hypot(gx, gy) < 0.25) return; // celular quase deitado: leitura instável
    let ang = Math.atan2(gx, -gy) * 180 / Math.PI;
    const so = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    ang += so;
    while (ang > 180) ang -= 360;
    while (ang < -180) ang += 360;
    gyroRaw = ang;
    gyroOk = true;
    if (needCalibration) {
      needCalibration = false;
      gyroOffset = ang;
      store.set('kart-gyro-offset', String(gyroOffset));
    }
    let d = ang - gyroOffset;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    gyroSteer = Math.max(-1, Math.min(1, d / MAX_TILT_DEG));
  }

  async function enableGyro() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission(); // iOS pede permissão
        if (res !== 'granted') throw new Error('negado');
      }
      needCalibration = true; // centraliza na posição em que o jogador está segurando agora
      window.removeEventListener('deviceorientation', onOrientation);
      window.addEventListener('deviceorientation', onOrientation);
      setTimeout(() => {
        if (!gyroOk) {
          alert('Não foi possível ler o giroscópio deste celular (é preciso abrir o jogo por HTTPS). Usando o volante virtual.');
          setSteerMode('wheel');
        }
      }, 1500);
      return true;
    } catch (e) {
      alert('Permissão do giroscópio negada. Usando o volante virtual.');
      return false;
    }
  }

  async function setSteerMode(mode) {
    if (mode === 'gyro' && !(await enableGyro())) mode = 'wheel';
    steerMode = mode;
    store.set('kart-steer', mode);
    $('#mode-wheel').classList.toggle('on', mode === 'wheel');
    $('#mode-gyro').classList.toggle('on', mode === 'gyro');
    $('#calibrate').hidden = mode !== 'gyro';
    $('#steer-hint').textContent = mode === 'gyro'
      ? 'Gire o celular como um volante · 🎯 Centralizar ajusta o meio'
      : 'Arraste o volante para os lados';
  }
  $('#mode-wheel').onclick = () => setSteerMode('wheel');
  $('#mode-gyro').onclick = () => setSteerMode('gyro');
  $('#calibrate').onclick = () => {
    gyroOffset = gyroRaw;
    store.set('kart-gyro-offset', String(gyroOffset));
    vibrate(40);
  };
  // O giroscópio precisa de um toque do usuário para ser ativado (iOS), então só
  // restauramos a preferência visualmente; o primeiro toque em "Giroscópio" ativa de fato.
  if (steerMode === 'gyro') {
    steerMode = 'wheel';
    $('#mode-gyro').textContent = '📱 Giroscópio (toque)';
  }

  // Volante solta devagar para o centro quando ninguém está segurando
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (steerMode === 'wheel' && wheelPid === null && wheelSteer !== 0) {
      const back = dt * 4;
      wheelSteer = Math.abs(wheelSteer) <= back ? 0 : wheelSteer - Math.sign(wheelSteer) * back;
    }
    input.s = steerMode === 'gyro' ? gyroSteer : wheelSteer;
    wheel.style.transform = 'rotate(' + (input.s * (steerMode === 'gyro' ? MAX_TILT_DEG * 2 : MAX_WHEEL_DEG)) + 'deg)';
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Envio: ~30x/s durante a corrida; ping a cada segundo fora dela
  let lastSent = '';
  let lastSentAt = 0;
  setInterval(() => {
    const now = performance.now();
    if (driving) {
      const msg = { t: 'in', s: Math.round(input.s * 100) / 100, g: input.g, b: input.b, i: input.i };
      const key = JSON.stringify(msg);
      if (key !== lastSent || now - lastSentAt > 500) {
        lastSent = key;
        lastSentAt = now;
        send(msg);
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
      if (driving) requestWakeLock();
      if (!conn && room && !full) connect();
    }
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  if (room) connect();
  else show('s-join');
})();
