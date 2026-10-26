// Desenho do mapa de perguntas, compartilhado pelo jogo e pelo editor: nós,
// pistas, selos, setas e o posicionamento automático.
(() => {
  'use strict';
  const el = Lousa.el;
  const TIPOS = { tema: 'tema', citacao: 'citação', alusao: 'alusão', mesma_palavra: 'mesma palavra' };

  function raio(n) {
    return n.tipo === 'sintese' ? 44 : 32;
  }
  function txt(cls, s) {
    const t = el('text', { class: cls });
    t.textContent = s;
    return t;
  }
  function selo(g, x, y, texto, extra = '') {
    g.append(el('circle', { class: `selo ${extra}`, cx: x, cy: y, r: 13 }));
    const t = txt('selo-txt', texto);
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    g.append(t);
  }
  function linha2(a, b, ra, rb, cls) {
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / d;
    const uy = (b.y - a.y) / d;
    return el('line', { class: cls, x1: a.x + ux * ra, y1: a.y + uy * ra, x2: b.x - ux * rb, y2: b.y - uy * rb });
  }
  function noSvg(p, classes, label, onActivate) {
    const g = el('g', { class: classes.filter(Boolean).join(' '), transform: `translate(${p.x},${p.y})`, tabindex: 0, role: 'button', 'aria-label': label });
    g.addEventListener('click', onActivate);
    g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onActivate()));
    return g;
  }
  function rotulo(g, texto, r) {
    wrap(texto || '', 14).forEach((line, i) => {
      const t = txt('rotulo', line);
      t.setAttribute('y', r + 26 + i * 22);
      g.append(t);
    });
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
  // Pontas de seta das pistas, uma por tipo (cores vêm do CSS).
  function garantirDefs(lousa) {
    const D = lousa.defs;
    if (D.querySelector('#seta-tema')) return;
    for (const t of Object.keys(TIPOS)) {
      const m = el('marker', { id: `seta-${t}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
      m.append(el('path', { d: 'M0,0 L10,5 L0,10 z', class: `seta-${t}` }));
      D.append(m);
    }
  }

  // Posição de cada nó e palavra. Nós com `pos` salva (pelo editor) ficam onde
  // estão; os outros vêm de um layout de forças determinístico, calculado sobre o
  // grafo inteiro para que nada mude de lugar quando novos nós aparecem.
  function posicoes(data) {
    const salvos = data.nos.filter((n) => n.pos);
    if (!salvos.length) return layout(data);
    const P = salvos.length === data.nos.length ? {} : layout(data);
    for (const n of salvos) P[n.id] = { x: n.pos.x, y: n.pos.y };
    // Palavras sem posição salva ficam acima da média dos nós ligados a elas;
    // as soltas, à esquerda.
    const xs = data.nos.map((n) => P[n.id].x);
    const ys = data.nos.map((n) => P[n.id].y);
    (data.palavras || []).forEach((w, i) => {
      if (w.pos) return void (P[`w:${w.id}`] = { x: w.pos.x, y: w.pos.y });
      const ligados = w.facetas.map((f) => P[f.no]).filter(Boolean);
      P[`w:${w.id}`] = ligados.length
        ? { x: ligados.reduce((s, p) => s + p.x, 0) / ligados.length, y: Math.min(...ligados.map((p) => p.y)) - 130 }
        : { x: Math.min(...xs) - 160, y: Math.min(...ys) + i * 120 };
    });
    return P;
  }

  function layout(data) {
    const pal = data.palavras || [];
    const ids = [...data.nos.map((n) => n.id), ...pal.map((w) => `w:${w.id}`)];
    const idx = new Map(ids.map((id, i) => [id, i]));
    const edges = [];
    data.nos.forEach((n) => (n.pistas || []).forEach((p) => idx.has(p.para) && edges.push([idx.get(n.id), idx.get(p.para), 210])));
    pal.forEach((w) => w.facetas.forEach((f) => idx.has(f.no) && edges.push([idx.get(`w:${w.id}`), idx.get(f.no), 170])));
    const N = ids.length;
    const P = ids.map((_, i) => ({ x: Math.cos((i / N) * Math.PI * 2) * 340, y: Math.sin((i / N) * Math.PI * 2) * 340 }));
    const ITER = 800;
    for (let it = 0; it < ITER; it++) {
      const F = P.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < N; i++)
        for (let j = 0; j < i; j++) {
          const dx = P[i].x - P[j].x;
          const dy = P[i].y - P[j].y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = 100000 / d2;
          F[i].x += (dx / d) * f; F[i].y += (dy / d) * f;
          F[j].x -= (dx / d) * f; F[j].y -= (dy / d) * f;
        }
      for (const [a, b, len] of edges) {
        const dx = P[b].x - P[a].x;
        const dy = P[b].y - P[a].y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - len) * 0.05;
        F[a].x += (dx / d) * f; F[a].y += (dy / d) * f;
        F[b].x -= (dx / d) * f; F[b].y -= (dy / d) * f;
      }
      const step = 1 - it / ITER;
      for (let i = 0; i < N; i++) {
        F[i].x -= P[i].x * 0.012;
        F[i].y -= P[i].y * 0.012;
        P[i].x += Math.max(-24, Math.min(24, F[i].x)) * step;
        P[i].y += Math.max(-24, Math.min(24, F[i].y)) * step;
      }
    }
    return Object.fromEntries(ids.map((id, i) => [id, P[i]]));
  }

  window.Desenho = { TIPOS, raio, txt, selo, linha2, noSvg, rotulo, garantirDefs, posicoes };
})();
