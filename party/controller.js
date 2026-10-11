// Corrida da Sorte — controle no celular.
// O celular só mostra perguntas enviadas pelo computador e devolve a opção tocada.
(() => {
  'use strict';

  const ID_PREFIX = 'corridadasorte-v1-';
  const COLORS = ['#38bdf8', '#f472b6'];
  const $ = (s) => document.querySelector(s);

  let cid;
  try {
    cid = localStorage.getItem('corrida-cid');
    if (!cid) {
      cid = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('corrida-cid', cid);
    }
  } catch (e) {
    cid = Math.random().toString(36).slice(2, 12);
  }

  let room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let peer = null;
  let conn = null;
  let full = false;
  let retryTimer = null;
  let currentAsk = null;

  // ---------- Telas ----------
  function showJoin(on) {
    $('#join').style.display = on ? 'contents' : 'none';
    $('#view').style.display = on ? 'none' : 'contents';
  }

  function view(title, text, options, opts) {
    showJoin(false);
    $('#title').textContent = title || '';
    $('#text').textContent = text || '';
    const box = $('#options');
    box.innerHTML = '';
    box.classList.toggle('grid', !!(opts && opts.grid));
    (options || []).forEach((o) => {
      const b = document.createElement('button');
      b.className = 'btn' + (o.big ? ' big' : '') + (o.cls ? ' ' + o.cls : '');
      b.disabled = !!o.disabled;
      b.textContent = o.label;
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
    view(title, text, btn ? [{ label: btn.label, onclick: btn.onclick }] : []);
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
      // window.CORRIDA_PEER_OPTS permite usar um servidor PeerJS próprio (ex.: testes locais)
      peer = new Peer(window.CORRIDA_PEER_OPTS || {});
      peer.on('open', openConn);
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          message('Sala não encontrada', 'Confira o código ' + room + ' na tela do computador.', {
            label: 'Digitar outro código',
            onclick: () => { room = ''; showJoin(true); },
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
        const color = COLORS[m.slot] || COLORS[0];
        document.documentElement.style.setProperty('--player', color);
        $('#badge').textContent = 'Jogador ' + (m.slot + 1);
        $('#topbar').hidden = false;
        vibrate(60);
        break;
      }
      case 'full':
        full = true;
        message('Sala cheia', 'Já existem 2 jogadores conectados.');
        break;
      case 'stat':
        $('#coins').textContent = m.show ? '🪙 ' + m.coins : '';
        $('#items').textContent = (m.items || []).join(' ');
        break;
      case 'idle':
        currentAsk = null;
        view(m.title, m.text, []);
        break;
      case 'ask':
        currentAsk = m.id;
        vibrate(40);
        view(m.title, m.text, (m.options || []).map((o) => ({
          label: o.label,
          sub: o.sub,
          big: o.big,
          cls: o.cls,
          disabled: o.disabled,
          onclick: () => answer(m.id, o.id),
        })), { grid: m.grid });
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
    // Mostra algo imediatamente; o computador manda a próxima tela em seguida
    document.querySelectorAll('#options .btn').forEach((b) => { b.disabled = true; });
  }

  // Ping a cada segundo para o computador saber que o celular continua ali
  setInterval(() => send({ t: 'ping' }), 1000);

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !conn && room && !full) connect();
  });

  if (room) connect();
  else showJoin(true);
})();
