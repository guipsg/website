// Protótipo 1 — Constelações.
// Um grafo de perguntas no estilo do ship log de Outer Wilds: cada "?" só aparece
// quando uma pista aponta para ele, e só se resolve marcando o versículo-evidência.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, checkEvidence, fmtRef } = Lab;
  const app = document.getElementById('app');
  const SVG = 'http://www.w3.org/2000/svg';
  const TIPOS = { tema: 'tema', citacao: 'citação', alusao: 'alusão', mesma_palavra: 'mesma palavra' };

  Lab.boot({
    proto: 'constelacoes',
    titulo: 'Constelações',
    pack: '1-constelacoes.json',
    initial: { resolvidos: [], vistos: [], erros: {}, foco: {}, convite: false, aba: 'mapa' },
  })
    .then(start)
    .catch((e) => {
      console.error(e);
      app.append(h('p', { class: 'erro' }, 'Não consegui carregar o pacote de conteúdo.'));
    });

  function start({ data, prog }) {
    const S = prog.data;
    const byId = new Map(data.nos.map((n) => [n.id, n]));
    const pos = layout(data.nos);
    let recemAbertos = new Set();

    const isResolved = (id) => S.resolvidos.includes(id);
    const isOpen = (id) =>
      !isResolved(id) && (byId.get(id).tipo === 'inicio' || data.nos.some((n) => isResolved(n.id) && n.pistas.some((p) => p.para === id)));
    const isVisible = (id) => isResolved(id) || isOpen(id);

    render();
    if (!S.convite) convite();

    // ------------------------------------------------------------------
    function render() {
      const abas = h(
        'div',
        { class: 'abas' },
        h('button', { class: S.aba === 'mapa' ? 'ativa' : '', onclick: () => setAba('mapa') }, 'Constelação'),
        h('button', { class: S.aba === 'lista' ? 'ativa' : '', onclick: () => setAba('lista') }, 'Perguntas'),
      );
      Lab.mount(app, 
        h('p', { class: 'muted' }, data.tema),
        h('h2', {}, data.pergunta_central),
        abas,
        S.aba === 'mapa' ? mapa() : lista(),
      );
      recemAbertos = new Set();
    }
    function setAba(a) {
      S.aba = a;
      prog.save();
      render();
    }

    function mapa() {
      const visiveis = data.nos.filter((n) => isVisible(n.id));
      const xs = visiveis.map((n) => pos[n.id].x);
      const ys = visiveis.map((n) => pos[n.id].y);
      const pad = 110;
      let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
      // Ajusta a caixa à proporção do painel, para o grafo ocupar a tela toda.
      const ratio = Math.min(app.clientWidth || 360, 728) / Math.min(innerHeight * 0.68, 560);
      const minW = 480;
      let w = Math.max(x1 - x0, minW);
      let hh = Math.max(y1 - y0, minW / ratio);
      if (w / hh < ratio) w = hh * ratio;
      else hh = w / ratio;
      const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
      [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - hh / 2, cy + hh / 2];

      const svg = el('svg', { viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Mapa da constelação' });
      const defs = el('defs');
      for (const t of Object.keys(TIPOS)) {
        const m = el('marker', { id: `seta-${t}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
        m.append(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: corDe(t) }));
        defs.append(m);
      }
      svg.append(defs);

      const grade = el('g', { class: 'grade' });
      for (let x = Math.floor(x0 / 100) * 100; x < x1; x += 100) grade.append(el('line', { x1: x, y1: y0, x2: x, y2: y1 }));
      for (let y = Math.floor(y0 / 100) * 100; y < y1; y += 100) grade.append(el('line', { x1: x0, y1: y, x2: x1, y2: y }));
      svg.append(grade);

      // Arestas: pistas de nós resolvidos. Tracejada enquanto o destino é "?".
      for (const n of data.nos) {
        if (!isResolved(n.id)) continue;
        for (const p of n.pistas) {
          const a = pos[n.id];
          const b = pos[p.para];
          const ra = raio(n);
          const rb = raio(byId.get(p.para)) + 6;
          const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const ux = (b.x - a.x) / d;
          const uy = (b.y - a.y) / d;
          svg.append(
            el('line', {
              class: `aresta e-${p.tipo} ${isResolved(p.para) ? '' : 'pendente'}`,
              x1: a.x + ux * ra, y1: a.y + uy * ra, x2: b.x - ux * rb, y2: b.y - uy * rb,
              'marker-end': `url(#seta-${p.tipo})`,
            }),
          );
        }
      }

      for (const n of visiveis) {
        const { x, y } = pos[n.id];
        const res = isResolved(n.id);
        const g = el('g', {
          class: ['no', res ? 'resolvido' : 'aberto', n.tipo === 'sintese' ? 'sintese' : '', recemAbertos.has(n.id) || (!res && !S.vistos.includes(n.id)) ? 'novo' : ''].join(' '),
          transform: `translate(${x},${y})`,
          tabindex: 0,
          role: 'button',
          'aria-label': `${n.titulo}${res ? ', resolvido' : ', pergunta aberta'}`,
        });
        g.append(el('circle', { r: raio(n) }));
        const ic = el('text', { class: 'icone' });
        ic.textContent = res ? '✓' : '?';
        g.append(ic);
        wrap(n.titulo, 14).forEach((line, i) => {
          const t = el('text', { class: 'rotulo', y: raio(n) + 26 + i * 22 });
          t.textContent = line;
          g.append(t);
        });
        g.addEventListener('click', () => abrir(n));
        g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && abrir(n));
        svg.append(g);
      }

      const total = data.nos.length;
      return h(
        'div',
        {},
        h('div', { class: 'painel' }, svg, h('div', { class: 'contagem' }, `${S.resolvidos.length} de ${total} entendidos`)),
        h(
          'div',
          { class: 'legenda' },
          Object.entries(TIPOS).map(([t, nome]) => h('span', {}, h('i', { style: `background:${corDe(t)}` }), nome)),
          h('span', {}, 'tracejado = ainda não visitado'),
        ),
      );
    }

    function lista() {
      const abertos = data.nos.filter((n) => isOpen(n.id));
      const feitos = data.nos.filter((n) => isResolved(n.id));
      return h(
        'div',
        {},
        h('h3', {}, `Perguntas abertas (${abertos.length})`),
        abertos.length ? abertos.map((n) => cartao(n)) : h('p', { class: 'muted' }, 'Nenhuma pergunta aberta.'),
        h('h3', {}, `Entendidos (${feitos.length})`),
        feitos.map((n) => cartao(n)),
      );
    }
    function cartao(n) {
      const res = isResolved(n.id);
      return h(
        'button',
        { class: 'opcao', onclick: () => abrir(n) },
        h('span', { class: `tag ${res ? 'ok' : !S.vistos.includes(n.id) ? 'novo' : ''}` }, res ? '✓ ' + n.titulo : '? ' + n.titulo),
        h('div', {}, res ? h('span', { class: 'muted' }, fmtRef(data.passagens[n.passagem].osis)) : n.pergunta),
      );
    }

    // ------------------------------------------------------------------
    async function abrir(n) {
      if (!S.vistos.includes(n.id)) {
        S.vistos.push(n.id);
        prog.save();
      }
      const pas = data.passagens[n.passagem];
      if (isResolved(n.id)) {
        const r = await modal({
          title: n.titulo,
          body: h('div', {}, h('p', { class: 'muted' }, fmtRef(pas.osis)), h('div', { class: 'revelacao' }, n.revelacao), pistasDe(n)),
          actions: [
            { label: 'Reler a passagem', value: 'ler' },
            { label: 'Fechar', value: null, primary: true },
          ],
        });
        if (r === 'ler') await reader({ osis: pas.osis, contexto: pas.contexto });
        return render();
      }
      if (n.requer && !n.requer.every(isResolved)) {
        const faltam = n.requer.filter((id) => !isResolved(id)).length;
        await modal({
          title: n.titulo,
          body: h('div', {}, h('p', {}, n.pergunta), h('p', { class: 'aviso' }, `Esta pergunta junta várias partes da constelação. Ainda faltam ${faltam} para você entender antes de tentar.`)),
        });
        return render();
      }
      const r = await modal({
        title: n.titulo,
        body: h('div', {}, h('p', {}, n.pergunta), h('p', { class: 'muted' }, `A resposta está em ${fmtRef(pas.osis)}.`)),
        actions: [
          { label: 'Depois', value: null },
          { label: 'Ler e responder', value: 'ler', primary: true },
        ],
      });
      render();
      if (r === 'ler') responder(n);
    }

    async function responder(n) {
      const pas = data.passagens[n.passagem];
      for (;;) {
        const key = await reader({
          osis: pas.osis,
          contexto: pas.contexto,
          prompt: n.pergunta,
          select: true,
          foco: S.foco[n.id] || null,
          confirmLabel: 'É isso',
        });
        if (!key) return;
        const res = checkEvidence(n, key, S.erros);
        if (res.ok) break;
        if (res.foco) S.foco[n.id] = res.foco;
        prog.save();
        toast(res.msg, 'erro');
      }
      S.resolvidos.push(n.id);
      prog.save();
      toast.hide();
      buzz(40);
      const novos = n.pistas.map((p) => p.para).filter((id) => !isResolved(id) && !S.vistos.includes(id));
      recemAbertos = new Set(novos);
      render();
      await modal({
        title: `✓ ${n.titulo}`,
        body: h('div', {}, h('div', { class: 'revelacao' }, n.revelacao), pistasDe(n, true)),
        actions: [{ label: 'Ver no mapa', value: true, primary: true }],
      });
      recemAbertos = new Set(novos);
      render();
      if (n.tipo === 'sintese') {
        const r = await modal({
          title: 'Constelação completa',
          body: h('p', {}, 'Você chegou à síntese. Quer registrar a sessão no diário agora?'),
          actions: [
            { label: 'Continuar explorando', value: null },
            { label: 'Abrir o diário', value: true, primary: true },
          ],
        });
        if (r) Lab.endSession('constelacoes');
      }
    }

    function pistasDe(n, novas = false) {
      if (!n.pistas.length) return null;
      return h(
        'div',
        {},
        h('h3', {}, novas ? 'Novas pistas' : 'Pistas'),
        h(
          'ul',
          { class: 'pistas-lista' },
          n.pistas.map((p) => {
            const alvo = byId.get(p.para);
            return h('li', {}, h('b', {}, isResolved(p.para) ? alvo.titulo : `? ${alvo.titulo}`), ` (${TIPOS[p.tipo]}): ${p.texto}`);
          }),
        ),
      );
    }

    function convite() {
      Lab.escolha({ title: data.convite.pergunta, opcoes: data.convite.opcoes, dismissable: false }).then((op) => {
        S.convite = true;
        prog.save();
        if (op && op.leva_a) abrir(byId.get(op.leva_a));
      });
    }
  }

  // ======================================================================
  // Layout e utilitários do SVG
  // ======================================================================
  function raio(n) {
    return n.tipo === 'sintese' ? 44 : 32;
  }

  function el(tag, attrs = {}) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function corDe(tipo) {
    return { tema: '#8b9ab8', citacao: '#f0a040', alusao: '#b48ce0', mesma_palavra: '#6cc2a8' }[tipo];
  }

  function wrap(text, max) {
    const lines = [];
    let cur = '';
    for (const w of text.split(' ')) {
      if (cur && (cur + ' ' + w).length > max) {
        lines.push(cur);
        cur = w;
      } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Layout de forças determinístico, calculado com o grafo inteiro para que os
  // nós não mudem de lugar quando novos aparecem.
  function layout(nodes) {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const edges = [];
    nodes.forEach((n) => n.pistas.forEach((p) => edges.push([idx.get(n.id), idx.get(p.para)])));
    const N = nodes.length;
    const P = nodes.map((_, i) => {
      const a = (i / N) * Math.PI * 2;
      return { x: Math.cos(a) * 320, y: Math.sin(a) * 320 };
    });
    const ITER = 700;
    for (let it = 0; it < ITER; it++) {
      const F = P.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < N; i++)
        for (let j = 0; j < i; j++) {
          const dx = P[i].x - P[j].x;
          const dy = P[i].y - P[j].y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = 90000 / d2;
          F[i].x += (dx / d) * f;
          F[i].y += (dy / d) * f;
          F[j].x -= (dx / d) * f;
          F[j].y -= (dy / d) * f;
        }
      for (const [a, b] of edges) {
        const dx = P[b].x - P[a].x;
        const dy = P[b].y - P[a].y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - 210) * 0.06;
        F[a].x += (dx / d) * f;
        F[a].y += (dy / d) * f;
        F[b].x -= (dx / d) * f;
        F[b].y -= (dy / d) * f;
      }
      const step = 1 - it / ITER;
      for (let i = 0; i < N; i++) {
        F[i].x -= P[i].x * 0.012;
        F[i].y -= P[i].y * 0.012;
        P[i].x += Math.max(-24, Math.min(24, F[i].x)) * step;
        P[i].y += Math.max(-24, Math.min(24, F[i].y)) * step;
      }
    }
    return Object.fromEntries(nodes.map((n, i) => [n.id, P[i]]));
  }
})();
