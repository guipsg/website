// Lousa — superfície SVG em tela cheia, que se move arrastando e aproxima com
// pinça, roda do mouse ou botões. As telas desenham dentro de `lousa.mundo`, em
// coordenadas do mundo; a lousa só mexe no viewBox.
(() => {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const ARRASTO_MIN = 6; // px de movimento antes de um toque virar arrasto

  function el(tag, attrs = {}) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function criarLousa(container) {
    const svg = el('svg', { class: 'lousa-svg', role: 'application' });
    const defs = el('defs');
    const grade = el('g', { class: 'lousa-grade' });
    const mundo = el('g', { class: 'lousa-mundo' });
    svg.append(defs, grade, mundo);
    container.append(svg);

    for (let i = -4000; i <= 4000; i += 100) {
      grade.append(el('line', { x1: i, y1: -4000, x2: i, y2: 4000 }));
      grade.append(el('line', { x1: -4000, y1: i, x2: 4000, y2: i }));
    }

    let vb = { x: -500, y: -500, w: 1000, h: 1000 };
    let base = 1000; // largura do enquadramento atual, referência para os limites de zoom
    const tam = () => ({ w: svg.clientWidth || innerWidth, h: svg.clientHeight || innerHeight });
    const aplicar = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);

    function enquadrar(caixa, margem = 120) {
      const { w: cw, h: ch } = tam();
      const r = ch / cw;
      let w = Math.max(caixa.w + margem * 2, 600);
      let hh = caixa.h + margem * 2;
      if (hh / w > r) w = hh / r;
      else hh = w * r;
      vb = { x: caixa.x + caixa.w / 2 - w / 2, y: caixa.y + caixa.h / 2 - hh / 2, w, h: hh };
      base = w;
      aplicar();
    }

    // Aproxima mantendo fixo o ponto do mundo sob (sx, sy), em px da tela.
    function zoom(fator, sx, sy) {
      const { w: cw, h: ch } = tam();
      if (sx == null) [sx, sy] = [cw / 2, ch / 2];
      const novoW = Math.min(base * 3, Math.max(base / 4, vb.w / fator));
      const f = novoW / vb.w;
      const wx = vb.x + (sx / cw) * vb.w;
      const wy = vb.y + (sy / ch) * vb.h;
      vb = { x: wx - (wx - vb.x) * f, y: wy - (wy - vb.y) * f, w: novoW, h: vb.h * f };
      aplicar();
    }

    function mover(dxPx, dyPx) {
      const { w: cw } = tam();
      const k = vb.w / cw;
      vb.x -= dxPx * k;
      vb.y -= dyPx * k;
      aplicar();
    }

    // ---------- ponteiros: arrastar, pinça ----------
    const ponteiros = new Map();
    let ultimaPinca = null;
    const estado = { arrastou: false };

    svg.addEventListener('pointerdown', (e) => {
      ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
      if (ponteiros.size === 1) estado.arrastou = false;
      ultimaPinca = null;
    });
    addEventListener('pointermove', (e) => {
      const p = ponteiros.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > ARRASTO_MIN) estado.arrastou = true;
      if (ponteiros.size === 1 && estado.arrastou) mover(dx, dy);
      else if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = svg.getBoundingClientRect();
        if (ultimaPinca) zoom(d / ultimaPinca, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        ultimaPinca = d;
        estado.arrastou = true;
      }
    });
    const soltar = (e) => {
      ponteiros.delete(e.pointerId);
      ultimaPinca = null;
    };
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    // Um clique que terminou um arrasto não deve abrir nada.
    svg.addEventListener('click', (e) => {
      if (estado.arrastou) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
    addEventListener('resize', () => {
      const { w: cw, h: ch } = tam();
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      vb.h = vb.w * (ch / cw);
      vb.x = cx - vb.w / 2;
      vb.y = cy - vb.h / 2;
      aplicar();
    });

    aplicar();
    return {
      svg, defs, mundo, el, enquadrar, zoom, mover,
      limpar() {
        mundo.replaceChildren();
      },
    };
  }

  window.Lousa = { criar: criarLousa, el };
})();
