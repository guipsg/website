// Mural de estudo: criar um estudo é estudar. Você lê e fixa o que chamou
// atenção, anota, liga uma nota à outra puxando um fio e volta a cada nota para
// aprofundá-la em camadas (texto, pergunta, resposta, revelação). Uma nota com
// todas as camadas amadurece e entra no jogo; as outras ficam como anotação.
// Tocar numa nota dispara um pulso que corre pelas ligações, como um sinal
// entre neurônios. Tudo fica salvo no aparelho a cada mudança.
(() => {
  'use strict';
  const { h, modal, toast, fmtRef } = Lab;
  const { TIPOS, raio, txt, selo, rotulo } = Desenho;
  const el = Lousa.el;
  const DESCRICAO_PISTA = {
    tema: 'Tema: os dois textos tratam do mesmo assunto',
    citacao: 'Citação: um texto cita o outro',
    alusao: 'Alusão: um texto lembra o outro sem citar',
    mesma_palavra: 'Mesma palavra: o mesmo termo no original',
  };
  const NOME_CAMADA = { nota: 'Nota', texto: 'Texto', pergunta: 'Pergunta', resposta: 'Resposta', revelacao: 'Revelação' };
  const PAPEIS = [
    ['pergunta', 'Automático: começa o jogo se nenhuma ligação chega nela'],
    ['inicio', 'Começar por aqui, mesmo com ligações chegando'],
    ['sintese', 'Síntese: junta outras perguntas'],
  ];

  let E = null; // estudo em edição
  let ctx = null; // lousa, topo e navegação, vindos do app
  let sel = null; // nota selecionada
  let ligando = null; // nota de onde sai uma ligação feita por toques
  let soltouEm = 0; // fim do último arrasto, para o toque não contar junto
  let ouvindoVazio = false;
  let ultimoVazio = null; // para reconhecer o toque duplo no vazio
  let ultimaLeitura = '';
  let maduras = new Set();

  const salvar = () => Estudos.salvar(E, 'meu');
  const porId = (id) => E.nos.find((n) => n.id === id);
  const nome = (n) => Estudos.rotuloNo(n, E);
  const madura = (n) => Estudos.madura(n, E);
  const editando = () => document.body.classList.contains('editando');

  function abrir(estudo, contexto) {
    ctx = contexto;
    E = Estudos.preparar(estudo);
    // Congela as posições automáticas para nada pular quando o mural muda.
    const P = Desenho.posicoes(E);
    const fixar = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });
    for (const n of E.nos) n.pos ||= fixar(P[n.id]);
    for (const w of E.palavras) w.pos ||= fixar(P[`w:${w.id}`]);
    salvar();
    sel = null;
    ligando = null;
    maduras = new Set(E.nos.filter(madura).map((n) => n.id));
    ctx.usarTela({ tipo: 'editor', enquadrar, voltar: sair });
    ligarBarra();
    render();
    enquadrar();
    if (!E.nos.length) toast('Toque duas vezes no mural para anotar, ou use "Ler" para fixar um texto.');
  }

  function sair() {
    sel = ligando = null;
    ctx.temas(E.id);
  }

  function enquadrar() {
    const pts = [...E.nos.map((n) => n.pos), ...E.palavras.map((w) => w.pos)];
    if (!pts.length) return ctx.lousa.enquadrar({ x: -200, y: -200, w: 400, h: 400 }, 120);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    ctx.lousa.enquadrar({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 + 40 }, 160);
  }

  function ligarBarra() {
    const acoes = { nota: () => novaNota(ctx.lousa.centro()), ler: lerEFixar, falta: verFaltas, testar, estudo: painelEstudo };
    ctx.$('#barra-editor').querySelectorAll('[data-acao]').forEach((b) => (b.onclick = () => acoes[b.dataset.acao]()));
    if (ouvindoVazio) return;
    ouvindoVazio = true;
    // Toque no vazio: cancela a ligação, solta a seleção; toque duplo cria uma nota.
    ctx.lousa.svg.addEventListener('click', (e) => {
      if (!editando() || e.target.closest('.no, .toque-ligacao')) return;
      if (ligando) {
        ligando = null;
        render();
        return toast('Ligação cancelada.');
      }
      const agora = Date.now();
      const u = ultimoVazio;
      if (u && agora - u.t < 450 && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 30) {
        ultimoVazio = null;
        return novaNota(ctx.lousa.paraMundo(e.clientX, e.clientY));
      }
      ultimoVazio = { t: agora, x: e.clientX, y: e.clientY };
      if (sel) {
        sel = null;
        render();
      }
    });
  }

  // ======================================================================
  // Mural
  // ======================================================================
  function render() {
    const { erros, faltas } = Estudos.validar(E);
    const agora = new Set(E.nos.filter(madura).map((n) => n.id));
    const novas = [...agora].filter((id) => !maduras.has(id));
    maduras = agora;
    if (novas.length === 1) toast(`"${nome(porId(novas[0]))}" amadureceu: agora entra no jogo.`, 'ok');
    ctx.hud(E.titulo?.trim() || 'Estudo sem título', `Mural · ${agora.size} de ${E.nos.length} ${E.nos.length === 1 ? 'madura' : 'maduras'}${erros.length ? ` · ${erros.length} ${erros.length === 1 ? 'problema' : 'problemas'}` : ''}`, true);
    document.body.classList.add('editando');
    ctx.$('#barra-editor').hidden = false;
    const b = ctx.$('#falta');
    const pendentes = erros.length + faltas.length;
    b.textContent = pendentes ? `Falta · ${pendentes}` : '✓ Pronto';
    b.classList.toggle('tem-erro', erros.length > 0);
    desenhar(new Set(erros.map((x) => x.no).filter(Boolean)), new Set(novas));
    cartao();
  }

  // Ligações são curvas suaves; o ponto de controle fica ao lado do meio, então
  // A→B e B→A não se sobrepõem.
  const controle = (a, b) => ({ x: (a.x + b.x) / 2 - (b.y - a.y) * 0.18, y: (a.y + b.y) / 2 + (b.x - a.x) * 0.18 });
  const naCurva = (a, c, b, t) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  function recuar(p, rumo, r) {
    const d = Math.hypot(rumo.x - p.x, rumo.y - p.y) || 1;
    return { x: p.x + ((rumo.x - p.x) / d) * r, y: p.y + ((rumo.y - p.y) / d) * r };
  }
  function caminho(a, b, ra, rb) {
    const c = controle(a, b);
    const p = recuar(a, c, ra);
    const q = recuar(b, c, rb);
    return `M${p.x},${p.y} Q${c.x},${c.y} ${q.x},${q.y}`;
  }
  const grau = (n) => n.pistas.length + E.nos.filter((m) => m.pistas.some((p) => p.para === n.id)).length;

  function desenhar(comErro = new Set(), novas = new Set()) {
    const L = ctx.lousa;
    L.limpar();
    Desenho.garantirDefs(L);
    const M = L.mundo;
    // Palavras (vindas de um estudo duplicado): aparecem e se movem, mas ainda não se editam.
    for (const w of E.palavras) {
      for (const f of w.facetas) {
        const n = porId(f.no);
        if (n) M.append(el('path', { class: 'aresta e-palavra', d: caminho(w.pos, n.pos, 40, raio(n) + 4) }));
      }
    }
    for (const n of E.nos) {
      n.pistas.forEach((p, i) => {
        const alvo = porId(p.para);
        if (!alvo) return;
        const d = caminho(n.pos, alvo.pos, raio(n) + 2, raio(alvo) + 8);
        const crua = !maduras.has(n.id) || !maduras.has(alvo.id);
        const ln = el('path', { class: `aresta e-${p.tipo} ${p.texto?.trim() ? 'com-motivo' : 'sem-motivo'} ${crua ? 'crua' : ''}`, d });
        ln.setAttribute('marker-end', `url(#seta-${p.tipo})`);
        const toque = el('path', { class: 'toque-ligacao', d, role: 'button', tabindex: 0, 'aria-label': `Ligação de ${nome(n)} para ${nome(alvo)}` });
        toque.addEventListener('click', () => painelLigacao(n, i));
        toque.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), painelLigacao(n, i)));
        M.append(ln, toque);
      });
    }
    for (const w of E.palavras) {
      const g = Desenho.noSvg(w.pos, ['no', 'palavra'], `Palavra ${w.transliteracao}`, () => Date.now() - soltouEm > 300 && toast('As palavras ainda não se editam aqui, mas dá para arrastar.'));
      g.append(el('rect', { x: -44, y: -32, width: 88, height: 64, rx: 14 }));
      g.append(txt('icone', w.original.replace(/[\u0591-\u05C7]/g, '')));
      rotulo(g, w.transliteracao, 32);
      g.addEventListener('pointerdown', (e) => arrastar(e, w));
      M.append(g);
    }
    for (const n of E.nos) {
      const r = raio(n);
      const ok = maduras.has(n.id);
      const g = Desenho.noSvg(n.pos, ['no', 'edicao', ok ? 'madura' : 'crua', sel === n.id ? 'selecionada' : '', ligando === n.id ? 'origem' : '', novas.has(n.id) ? 'novo' : ''], `${nome(n)}, ${ok ? 'madura' : 'em andamento'}`, () => tocar(n));
      g.setAttribute('data-id', n.id);
      // Quanto mais ligada, mais forte o halo, como um centro do raciocínio.
      const k = grau(n);
      if (k) g.append(el('circle', { class: 'halo', r: r + 8 + 4 * Math.min(k, 6) }));
      if (sel === n.id) g.append(el('circle', { class: 'anel-sel', r: r + 7 }));
      g.append(el('circle', { class: 'disco', r }));
      const comeco = ok && (n.tipo === 'inicio' || (n.tipo !== 'sintese' && !E.nos.some((m) => maduras.has(m.id) && m.pistas.some((p) => p.para === n.id))));
      g.append(txt('icone', !ok ? '✎' : n.tipo === 'sintese' ? '✦' : comeco ? '▶' : '?'));
      rotulo(g, nome(n), r);
      // Notas em andamento: uma marca por camada já feita.
      if (!ok) {
        const c = Estudos.camadas(n, E);
        Estudos.CAMADAS.forEach((cam, i) => g.append(el('circle', { class: `marca ${c[cam] ? 'feita' : ''}`, cx: (i - 2) * 11, cy: -r - 11, r: 3.6 })));
      }
      if (comErro.has(n.id)) selo(g, r * 0.75, -r * 0.75, '⚠', 'erro');
      g.addEventListener('pointerdown', (e) => arrastar(e, n));
      // A bolinha ao lado da nota selecionada: puxe até outra nota para ligar.
      if (sel === n.id && !ligando) {
        const fio = el('circle', { class: 'puxador', cx: r + 22, cy: 0, r: 12, 'aria-label': 'Puxar uma ligação' });
        fio.addEventListener('pointerdown', (e) => puxar(e, n));
        g.append(fio);
      }
      M.append(g);
    }
  }

  // Cartão da nota selecionada (ou o aviso do modo de ligar por toques).
  function cartao() {
    const info = ctx.$('#info');
    if (ligando) {
      Lab.mount(info, h('p', {}, `Ligação saindo de "${nome(porId(ligando))}". Toque na nota de destino.`),
        h('button', { class: 'btn', onclick: () => { ligando = null; render(); } }, 'Cancelar'));
      info.hidden = false;
      return;
    }
    const n = sel && porId(sel);
    if (!n) return void (info.hidden = true);
    const passo = Estudos.proximoPasso(n, E);
    const k = grau(n);
    Lab.mount(info,
      h('h2', {}, nome(n)),
      h('p', {}, passo ? `Próximo passo: ${passo.msg}` : '✓ Madura: entra no jogo.'),
      h('p', { class: 'guia' }, k ? `Ligada a ${k} ${k === 1 ? 'nota' : 'notas'}. Puxe a bolinha ● até outra nota para ligar.` : 'Puxe a bolinha ● ao lado da nota até outra para ligar.'),
      h('div', { class: 'linha' }, h('button', { class: 'btn primary', onclick: () => aprofundar(n) }, 'Aprofundar')));
    info.hidden = false;
  }

  function tocar(n) {
    if (Date.now() - soltouEm < 300) return;
    if (ligando) return ligar(n);
    if (sel === n.id) return aprofundar(n);
    sel = n.id;
    render();
    pulso(n);
  }

  // ---------------------------------------------------------------- pulso
  // Um sinal sai da nota tocada e corre pelas ligações, duas camadas adiante.
  function pulso(origem) {
    const M = ctx.lousa.mundo;
    const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const vistos = new Set([origem.id]);
    const acender = (id) => {
      const g = M.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!g) return;
      g.classList.add('aceso');
      setTimeout(() => g.classList.remove('aceso'), 700);
    };
    const correr = (a, b, deTras, nivel) => {
      if (calmo) return;
      const c = controle(a, b);
      const ponto = el('circle', { class: `impulso nivel-${nivel}`, r: nivel === 1 ? 7 : 5 });
      M.append(ponto);
      const t0 = performance.now();
      const passo = (t) => {
        const f = Math.min(1, (t - t0) / 480);
        const s = deTras ? 1 - f : f;
        const p = naCurva(a, c, b, s * s * (3 - 2 * s));
        ponto.setAttribute('cx', p.x);
        ponto.setAttribute('cy', p.y);
        if (f < 1 && ponto.isConnected) requestAnimationFrame(passo);
        else ponto.remove();
      };
      requestAnimationFrame(passo);
    };
    const onda = (ids, nivel) => {
      if (nivel > 2 || !ids.length) return;
      const proximos = [];
      for (const id of ids) {
        const n = porId(id);
        const ligacoes = [...n.pistas.map((p) => [n, porId(p.para), false]), ...E.nos.filter((m) => m.pistas.some((p) => p.para === id)).map((m) => [m, n, true])];
        for (const [a, b, deTras] of ligacoes) {
          const outro = deTras ? a : b;
          if (!outro || vistos.has(outro.id)) continue;
          vistos.add(outro.id);
          proximos.push(outro.id);
          correr(a.pos, b.pos, deTras, nivel);
        }
      }
      setTimeout(() => {
        proximos.forEach(acender);
        onda(proximos, nivel + 1);
      }, calmo ? 0 : 480);
    };
    onda([origem.id], 1);
  }

  // ---------------------------------------------------------------- mexer
  // Arrastar uma nota (ou palavra) a muda de lugar; o mural se move arrastando o vazio.
  function arrastar(e, n) {
    if (e.button > 0 || ligando) return;
    e.stopPropagation();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const p0 = ctx.lousa.paraMundo(x0, y0);
    const ini = { ...n.pos };
    let moveu = false;
    const mover = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      if (!moveu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      moveu = true;
      const p = ctx.lousa.paraMundo(ev.clientX, ev.clientY);
      n.pos = { x: Math.round(ini.x + p.x - p0.x), y: Math.round(ini.y + p.y - p0.y) };
      desenhar();
    };
    const soltar = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', soltar);
      removeEventListener('pointercancel', soltar);
      if (!moveu) return;
      soltouEm = Date.now();
      salvar();
      render();
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
  }

  // Puxar um fio da bolinha até outra nota cria a ligação.
  function puxar(e, n) {
    e.stopPropagation();
    e.preventDefault();
    const M = ctx.lousa.mundo;
    const fio = el('path', { class: 'fio' });
    M.append(fio);
    let alvo = null;
    const sobre = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.no.edicao')?.getAttribute('data-id');
    const mover = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const p = ctx.lousa.paraMundo(ev.clientX, ev.clientY);
      fio.setAttribute('d', `M${n.pos.x},${n.pos.y} Q${controle(n.pos, p).x},${controle(n.pos, p).y} ${p.x},${p.y}`);
      const id = sobre(ev);
      const novo = id && id !== n.id ? id : null;
      if (novo !== alvo) {
        M.querySelector('.alvo-fio')?.classList.remove('alvo-fio');
        alvo = novo;
        if (alvo) M.querySelector(`[data-id="${CSS.escape(alvo)}"]`)?.classList.add('alvo-fio');
      }
    };
    const soltar = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      removeEventListener('pointermove', mover);
      removeEventListener('pointerup', soltar);
      removeEventListener('pointercancel', soltar);
      soltouEm = Date.now();
      fio.remove();
      const id = sobre(ev);
      if (id && id !== n.id) criarLigacao(n, porId(id));
      else render();
    };
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
  }

  // A ligação nasce sem motivo (fina, pontilhada); o motivo vem depois.
  function criarLigacao(origem, alvo) {
    if (!alvo || origem.id === alvo.id) return render();
    if (origem.pistas.some((p) => p.para === alvo.id)) {
      render();
      return toast('Essas notas já estão ligadas.');
    }
    origem.pistas.push({ para: alvo.id, tipo: 'tema', texto: '' });
    salvar();
    sel = origem.id;
    render();
    pulso(origem);
    toast('Ligadas. Toque na ligação para dizer por quê.', 'ok');
  }

  function ligar(alvo) {
    const origem = porId(ligando);
    ligando = null;
    criarLigacao(origem, alvo);
  }

  // O lugar livre mais perto de `c`, em anéis ao redor dele.
  function lugarLivre(c) {
    for (let r = 0; ; r += 140) {
      const passos = r ? Math.round((2 * Math.PI * r) / 140) : 1;
      for (let i = 0; i < passos; i++) {
        const q = { x: Math.round(c.x + r * Math.cos((i / passos) * 2 * Math.PI)), y: Math.round(c.y + r * Math.sin((i / passos) * 2 * Math.PI)) };
        if (!E.nos.some((n) => Math.hypot(n.pos.x - q.x, n.pos.y - q.y) < 130)) return q;
      }
    }
  }

  // ---------------------------------------------------------------- anotar
  // Nota rápida: só o que você percebeu. `base` traz o texto fixado na leitura.
  async function novaNota(ponto, base = null) {
    const campo = h('textarea', { rows: 3, 'aria-label': 'Nota', placeholder: 'O que você percebeu?' });
    const r = await modal({
      title: 'Nova nota',
      body: h('div', { class: 'form' },
        base && h('p', { class: 'valor' }, `Fixando ${base.evidencia.map(fmtRef).join(', ')}`),
        campo,
        h('p', { class: 'guia' }, 'Escreva do seu jeito. Depois você volta e aprofunda: texto, pergunta, resposta e revelação.')),
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Fixar no mural', value: () => ({ nota: campo.value.trim() }), primary: true },
      ],
    });
    if (!r) return;
    if (!r.nota && !base) return toast('Nota vazia: nada foi fixado.');
    let k = E.nos.length + 1;
    while (porId(`n${k}`)) k++;
    const n = { id: `n${k}`, tipo: 'pergunta', titulo: '', nota: r.nota, pergunta: '', passagem: '', evidencia: [], revelacao: '', pistas: [], pos: lugarLivre(ponto) };
    if (base) {
      E.passagens[`p_${n.id}`] = { ref: fmtRef(base.passagem), osis: base.passagem };
      n.passagem = `p_${n.id}`;
      n.evidencia = base.evidencia;
    }
    E.nos.push(n);
    salvar();
    sel = n.id;
    render();
    if (!ctx.lousa.contem(n.pos.x, n.pos.y, 80)) enquadrar();
  }

  // Ler qualquer trecho e fixar no mural os versículos que chamaram atenção.
  async function lerEFixar() {
    const campo = h('input', { type: 'text', 'aria-label': 'Referência', placeholder: 'Gn 2 ou Mc 2:23–3:6' });
    campo.value = ultimaLeitura;
    const status = h('span', { class: 'status' });
    const ler = () => Estudos.refParaOsis(campo.value, { capitulo: true });
    const conferir = () => {
      const r = ler();
      status.textContent = campo.value.trim() ? (r.erro ? r.erro : `✓ ${r.capitulo ? campo.value.trim() : fmtRef(r.osis)}`) : '';
      status.className = `status ${r.erro ? 'erro' : 'ok'}`;
    };
    campo.addEventListener('input', conferir);
    conferir();
    const ref = await modal({
      title: 'Ler',
      body: h('div', { class: 'form' }, h('p', { class: 'guia' }, 'Leia e fixe no mural o que chamar sua atenção. Pode ser um capítulo inteiro.'), campo, status),
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Abrir', value: ler, primary: true },
      ],
    });
    if (!ref) return;
    if (ref.erro) return toast(ref.erro, 'erro');
    ultimaLeitura = campo.value.trim();
    const versos = await Lab.reader({ osis: ref.osis, title: ref.capitulo ? ultimaLeitura : fmtRef(ref.osis), prompt: 'Toque nos versículos que chamaram sua atenção.', varios: true, confirmLabel: 'Fixar no mural' });
    if (!versos) return;
    // De um capítulo inteiro, a nota guarda só o trecho entre os versículos marcados.
    const passagem = !ref.capitulo ? ref.osis : versos.length === 1 ? versos[0] : `${versos[0]}-${versos[versos.length - 1]}`;
    await novaNota(sel ? lugarLivre({ x: porId(sel).pos.x + 160, y: porId(sel).pos.y }) : ctx.lousa.centro(), { passagem, evidencia: versos });
  }

  // ======================================================================
  // Aprofundar uma nota
  // ======================================================================
  const campo = (rotuloTxt, guia, ...kids) => h('div', { class: 'campo' }, rotuloTxt && h('span', { class: 'rotulo' }, rotuloTxt), guia && h('span', { class: 'guia' }, guia), ...kids);
  function entrada(obj, k, { linhas = 0, ph = '', rotuloAria = '', depois = null } = {}) {
    const i = h(linhas ? 'textarea' : 'input', { rows: linhas || null, type: linhas ? null : 'text', placeholder: ph, 'aria-label': rotuloAria });
    i.value = obj[k] || '';
    i.addEventListener('input', () => {
      obj[k] = i.value;
      salvar();
      render();
      depois?.();
    });
    return i;
  }
  function seletor(opcoes, atual, aoMudar, rotuloAria) {
    const s = h('select', { 'aria-label': rotuloAria }, opcoes.map(([v, t]) => h('option', { value: v }, t)));
    s.value = atual;
    s.addEventListener('change', () => aoMudar(s.value));
    return s;
  }

  // Cada camada é uma seção que abre e fecha. Abre já aberta a do próximo passo.
  function aprofundar(n, abrirCamada = null) {
    let fechar = () => {};
    const pas = () => E.passagens[n.passagem];
    const cabecalho = h('p', { class: 'camadas-estado' });
    const resumos = {};
    const secoes = {};
    const mudou = () => {
      salvar();
      render();
      atualizar();
    };
    const ent = (k, opcoes) => entrada(n, k, { ...opcoes, depois: atualizar });
    const camada = (k, ...kids) => {
      resumos[k] = h('span', {});
      secoes[k] = h('details', { class: 'camada' }, h('summary', {}, resumos[k]), ...kids);
      return secoes[k];
    };
    function atualizar() {
      const c = Estudos.camadas(n, E);
      const passo = Estudos.proximoPasso(n, E);
      const feitas = Estudos.CAMADAS.filter((k) => c[k]).length;
      cabecalho.textContent = passo ? `${Estudos.CAMADAS.map((k) => (c[k] ? '●' : '○')).join(' ')}  ${feitas} de 5 · próximo: ${passo.msg}` : '✓ Madura: entra no jogo.';
      cabecalho.className = `camadas-estado ${passo ? '' : 'ok'}`;
      const extra = {
        nota: n.nota?.trim() && `${n.nota.trim().slice(0, 40)}${n.nota.trim().length > 40 ? '…' : ''}`,
        texto: pas() && fmtRef(pas().osis),
        pergunta: n.pergunta?.trim() && `${n.pergunta.trim().slice(0, 40)}${n.pergunta.trim().length > 40 ? '…' : ''}`,
        resposta: n.evidencia?.length && n.evidencia.map(fmtRef).join(', '),
        revelacao: c.revelacao && 'escrita',
      };
      for (const k of Estudos.CAMADAS) resumos[k].textContent = `${c[k] ? '✓' : '○'} ${NOME_CAMADA[k]}${extra[k] ? ` · ${extra[k]}` : ''}`;
    }

    // --- texto: passagem, contexto e o trecho para conferir
    const statusRef = h('span', { class: 'status' });
    const statusCtx = h('span', { class: 'status' });
    const trecho = h('div', { class: 'trecho', 'aria-live': 'polite' });
    const ref = h('input', { type: 'text', placeholder: 'Gn 2:1-3', 'aria-label': 'Passagem' });
    ref.value = pas() ? pas().ref || fmtRef(pas().osis) : '';
    const ctxIn = h('input', { type: 'text', placeholder: 'Gn 1:1–2:3 (opcional)', 'aria-label': 'Contexto' });
    ctxIn.value = pas()?.contexto ? fmtRef(pas().contexto) : '';
    const status = (s, ok, msg) => {
      s.textContent = msg;
      s.className = `status ${ok ? 'ok' : 'erro'}`;
    };
    let carregando = 0;
    const mostrarTrecho = () => {
      clearTimeout(carregando);
      if (!pas()) return Lab.mount(trecho);
      const osis = pas().osis;
      carregando = setTimeout(async () => {
        try {
          const vs = await Lab.bible.verses(osis);
          if (pas()?.osis !== osis) return;
          Lab.mount(trecho, vs.slice(0, 12).map((v) => h('p', {}, h('sup', {}, v.v), ' ', v.text)), vs.length > 12 && h('p', { class: 'muted' }, `… mais ${vs.length - 12} versículos`));
        } catch {
          Lab.mount(trecho, h('p', { class: 'muted' }, 'Não consegui carregar o texto agora.'));
        }
      }, 350);
    };
    const lerRef = (mudar) => {
      const t = ref.value.trim();
      if (!t) return status(statusRef, false, 'Escreva onde isso aparece.');
      const r = Estudos.refParaOsis(t);
      if (r.erro) return status(statusRef, false, r.erro);
      status(statusRef, true, `✓ ${fmtRef(r.osis)}`);
      if (!mudar) return;
      const k = `p_${n.id}`;
      const antiga = pas();
      E.passagens[k] = { ref: t, osis: r.osis, ...(antiga?.contexto ? { contexto: antiga.contexto } : {}) };
      n.passagem = k;
      Estudos.limparPassagens(E);
      mudou();
      atualizarResposta();
      mostrarTrecho();
    };
    const lerCtx = (mudar) => {
      const t = ctxIn.value.trim();
      if (!t) {
        statusCtx.textContent = '';
        if (mudar && pas()?.contexto) {
          delete pas().contexto;
          mudou();
        }
        return;
      }
      const r = Estudos.refParaOsis(t);
      if (r.erro) return status(statusCtx, false, r.erro);
      if (!pas()) return status(statusCtx, false, 'Escreva a passagem primeiro.');
      status(statusCtx, true, `✓ ${fmtRef(r.osis)}`);
      if (mudar) {
        pas().contexto = r.osis;
        mudou();
      }
    };
    ref.addEventListener('input', () => lerRef(true));
    ctxIn.addEventListener('input', () => lerCtx(true));
    lerRef(false);
    lerCtx(false);
    mostrarTrecho();

    // --- resposta: evidência e dica, marcadas tocando nos versículos
    const secResposta = h('div', {});
    const atualizarResposta = () => {
      const p = pas();
      const fora = (n.evidencia || []).filter((v) => p && !Lab.inRange(v, p.osis));
      Lab.mount(
        secResposta,
        campo(null, 'Os versículos que respondem à pergunta. Qualquer um deles conta como acerto.',
          h('p', { class: 'valor' }, n.evidencia?.length ? n.evidencia.map(fmtRef).join(', ') : 'Nenhum versículo marcado.'),
          fora.length > 0 && h('p', { class: 'status erro' }, `Fora do texto: ${fora.map(fmtRef).join(', ')}. Marque de novo.`),
          !p && h('p', { class: 'status erro' }, 'Escreva o texto primeiro.'),
          h('button', { class: 'btn', type: 'button', disabled: !p, onclick: marcarEvidencia }, 'Marcar no texto')),
        campo('Dica (opcional)', 'Depois de dois erros, o leitor destaca este trecho.',
          h('p', { class: 'valor' }, n.dica ? fmtRef(n.dica) : 'Sem dica.'),
          h('div', { class: 'linha' },
            h('button', { class: 'btn', type: 'button', disabled: !p, onclick: marcarDica }, 'Marcar trecho'),
            n.dica && h('button', { class: 'btn', type: 'button', onclick: () => { delete n.dica; mudou(); atualizarResposta(); } }, 'Remover dica'))),
      );
    };
    async function marcarEvidencia() {
      const p = pas();
      const r = await Lab.reader({ osis: p.osis, title: 'Resposta', prompt: n.pergunta || 'Quais versículos respondem?', varios: true, marcados: (n.evidencia || []).filter((v) => Lab.inRange(v, p.osis)) });
      if (!r) return;
      n.evidencia = r;
      mudou();
      atualizarResposta();
    }
    async function marcarDica() {
      const p = pas();
      // A dica antiga só volta marcada se ainda couber no texto.
      const r0 = n.dica && Lab.parseRange(n.dica);
      const cabe = r0 && Lab.inRange(`${r0.book}.${r0.from.ch}.${r0.from.v}`, p.osis) && Lab.inRange(`${r0.book}.${r0.to.ch}.${r0.to.v}`, p.osis);
      const r = await Lab.reader({ osis: p.osis, title: 'Dica', prompt: 'Toque no primeiro e no último versículo do trecho que a dica destaca.', faixa: true, marcados: cabe ? n.dica : null });
      if (!r) return;
      n.dica = r;
      mudou();
      atualizarResposta();
    }
    atualizarResposta();

    // --- extras: papel no jogo, síntese, retorno ao errar, previsão
    const prev = n.previsao ? structuredClone(n.previsao) : { pergunta: '', opcoes: [], correta: 0, retorno: '' };
    const prevPergunta = h('input', { type: 'text', 'aria-label': 'Pergunta da previsão', placeholder: 'Antes de ler: o que você acha que…?' });
    prevPergunta.value = prev.pergunta;
    const prevOpcoes = h('textarea', { rows: 3, 'aria-label': 'Opções da previsão', placeholder: 'Uma opção por linha' });
    prevOpcoes.value = prev.opcoes.join('\n');
    const prevCorreta = h('select', { 'aria-label': 'Opção correta' });
    const prevRetorno = h('input', { type: 'text', 'aria-label': 'Retorno da previsão', placeholder: 'O que dizer depois da aposta' });
    prevRetorno.value = prev.retorno || '';
    const opcoesPrev = () => prevOpcoes.value.split('\n').map((x) => x.trim()).filter(Boolean);
    const montarCorreta = (v) => {
      Lab.mount(prevCorreta, opcoesPrev().map((o, i) => h('option', { value: i }, o)));
      prevCorreta.value = String(Math.min(v, Math.max(0, opcoesPrev().length - 1)));
    };
    montarCorreta(prev.correta || 0);
    const salvarPrev = () => {
      const vazia = !prevPergunta.value.trim() && !opcoesPrev().length && !prevRetorno.value.trim();
      if (vazia) delete n.previsao;
      else n.previsao = { pergunta: prevPergunta.value, opcoes: opcoesPrev(), correta: +prevCorreta.value || 0, retorno: prevRetorno.value };
      mudou();
    };
    prevPergunta.addEventListener('input', salvarPrev);
    prevOpcoes.addEventListener('input', () => {
      montarCorreta(+prevCorreta.value || 0);
      salvarPrev();
    });
    prevCorreta.addEventListener('change', salvarPrev);
    prevRetorno.addEventListener('input', salvarPrev);

    const secRequer = h('div', {});
    const atualizarRequer = () => {
      const outros = E.nos.filter((x) => x.id !== n.id);
      Lab.mount(secRequer, n.tipo === 'sintese' && campo('Só abre depois de entender', 'Marque as perguntas que a síntese junta.',
        outros.length ? outros.map((x) => {
          const c = h('input', { type: 'checkbox' });
          c.checked = (n.requer || []).includes(x.id);
          c.addEventListener('change', () => {
            n.requer = outros.filter((o) => (o.id === x.id ? c.checked : (n.requer || []).includes(o.id))).map((o) => o.id);
            if (!n.requer.length) delete n.requer;
            mudou();
          });
          return h('label', { class: 'check' }, c, ` ${nome(x)}`);
        }) : h('p', { class: 'valor' }, 'Ainda não há outras notas.')));
    };
    atualizarRequer();

    // --- ligações que saem e que chegam
    const secLigacoes = h('div', {});
    const atualizarLigacoes = () => {
      const chegam = E.nos.filter((m) => m.pistas.some((p) => p.para === n.id));
      const item = (texto, motivo, abrirLig) => h('button', { class: 'opcao ligacao-item', type: 'button', onclick: abrirLig }, h('b', {}, texto), h('span', { class: 'muted' }, motivo?.trim() ? ` · ${motivo.trim()}` : ' · sem motivo ainda'));
      Lab.mount(secLigacoes,
        n.pistas.map((p, i) => item(`→ ${porId(p.para) ? nome(porId(p.para)) : 'nota que não existe mais'}`, p.texto, () => painelLigacao(n, i).then(atualizarLigacoes))),
        chegam.map((m) => item(`← ${nome(m)}`, m.pistas.find((p) => p.para === n.id).texto, () => painelLigacao(m, m.pistas.findIndex((p) => p.para === n.id)).then(atualizarLigacoes))),
        !n.pistas.length && !chegam.length && h('p', { class: 'valor' }, 'Nenhuma ligação ainda.'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          fechar(null);
          sel = null;
          ligando = n.id;
          render();
        } }, 'Ligar tocando em outra nota'));
    };
    atualizarLigacoes();

    const corpo = h('div', { class: 'form' },
      cabecalho,
      camada('nota',
        campo(null, 'O que você percebeu? Escreva do seu jeito.', ent('nota', { linhas: 3, rotuloAria: 'Nota', ph: 'Deus descansou… mas Deus se cansa?' })),
        campo('Nome no mapa (opcional)', 'Sem nome, o mapa mostra o começo da nota.', ent('titulo', { ph: 'O sétimo dia', rotuloAria: 'Nome no mapa' }))),
      camada('texto',
        campo(null, 'Em que passagem isso aparece? Ex.: Gn 2:1-3 ou Mc 2:23–3:6.', ref, statusRef),
        trecho,
        campo('Contexto (opcional)', 'Um trecho maior que o leitor pode abrir para ver o entorno.', ctxIn, statusCtx)),
      camada('pergunta',
        campo(null, 'Que pergunta isso desperta? Perguntas de "por quê" e "como" puxam mais curiosidade que as de fato.', ent('pergunta', { linhas: 2, rotuloAria: 'Pergunta', ph: 'Por que Deus descansou, se não se cansa?' }))),
      camada('resposta', secResposta),
      camada('revelacao',
        campo(null, 'O que se entende ao achar a resposta? Aparece para o leitor só depois do acerto.', ent('revelacao', { linhas: 4, rotuloAria: 'Revelação' }))),
      (secoes.extras = h('details', { class: 'camada' }, h('summary', {}, 'Mais (opcional)'),
        campo('Papel no jogo', null, seletor(PAPEIS, n.tipo === 'inicio' || n.tipo === 'sintese' ? n.tipo : 'pergunta', (v) => { n.tipo = v; mudou(); atualizarRequer(); }, 'Papel no jogo')),
        secRequer,
        campo('Retorno ao errar', 'O que dizer quando o leitor marca outro versículo.', ent('retorno_erro', { rotuloAria: 'Retorno ao errar', ph: 'Esse trecho fala de outra coisa.' })),
        campo('Previsão', 'Antes de ler, o leitor aposta numa resposta. Errar não custa nada e deixa a leitura mais atenta.',
          prevPergunta, prevOpcoes, h('span', { class: 'guia' }, 'Opção certa:'), prevCorreta, prevRetorno))),
      h('details', { class: 'camada', open: true }, h('summary', {}, 'Ligações'), secLigacoes),
      h('button', { class: 'btn perigo', type: 'button', onclick: () => excluirNo(n, fechar) }, 'Excluir nota'),
    );
    atualizar();
    const alvo = abrirCamada || Estudos.proximoPasso(n, E)?.camada;
    const aberta = !n.nota?.trim() && !pas() ? 'nota' : alvo;
    if (secoes[aberta]) secoes[aberta].open = true;
    modal({
      title: nome(n),
      body: corpo,
      actions: [{ label: 'Fechar', value: null, primary: true }],
      focar: false,
      mount: (close) => (fechar = close),
    }).then(() => render());
  }

  async function excluirNo(n, fecharPainel) {
    const chegam = E.nos.filter((x) => x.pistas.some((p) => p.para === n.id)).length;
    const total = chegam + n.pistas.length;
    const r = await modal({
      title: `Excluir "${nome(n)}"?`,
      body: h('p', {}, total ? `${total} ${total === 1 ? 'ligação sai' : 'ligações saem'} junto.` : 'Ela não tem ligações.'),
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Excluir', value: true, primary: true },
      ],
    });
    if (!r) return;
    E.nos = E.nos.filter((x) => x.id !== n.id);
    for (const x of E.nos) {
      x.pistas = x.pistas.filter((p) => p.para !== n.id);
      if (x.requer) x.requer = x.requer.filter((id) => id !== n.id);
    }
    Estudos.limparPassagens(E);
    salvar();
    sel = null;
    fecharPainel(null);
    render();
  }

  // Aprofundar uma ligação: por que as notas se ligam (vira a pista do jogo).
  function painelLigacao(origem, i) {
    const p = origem.pistas[i];
    const alvo = porId(p.para);
    let fechar = () => {};
    return modal({
      title: `${nome(origem)} → ${alvo ? nome(alvo) : '?'}`,
      body: h('div', { class: 'form' },
        campo('Por que se ligam?', 'Vira a pista que o leitor vê ao entender a primeira nota. Sugira sem entregar a resposta.', entrada(p, 'texto', { linhas: 3, rotuloAria: 'Motivo da ligação', ph: 'Jesus diz ser senhor do sábado. Onde o sábado começou?' })),
        campo('Tipo', null, seletor(Object.keys(TIPOS).map((k) => [k, DESCRICAO_PISTA[k]]), p.tipo, (v) => { p.tipo = v; salvar(); render(); }, 'Tipo da ligação')),
        h('div', { class: 'linha' },
          alvo && h('button', { class: 'btn', type: 'button', onclick: () => {
            if (alvo.pistas.some((x) => x.para === origem.id)) return toast('Já existe a ligação no outro sentido.');
            origem.pistas.splice(i, 1);
            alvo.pistas.push({ ...p, para: origem.id });
            salvar();
            fechar(null);
          } }, 'Inverter sentido'),
          h('button', { class: 'btn perigo', type: 'button', onclick: () => {
            origem.pistas.splice(i, 1);
            salvar();
            fechar(null);
          } }, 'Desfazer ligação'))),
      actions: [{ label: 'Fechar', value: null, primary: true }],
      focar: !p.texto?.trim(),
      mount: (close) => (fechar = close),
    }).then(() => render());
  }

  // ======================================================================
  // Estudo, o que falta, testar e exportar
  // ======================================================================
  function painelEstudo() {
    let fechar = () => {};
    const cor = h('input', { type: 'color', 'aria-label': 'Cor' });
    cor.value = Estudos.corSegura(E.cor);
    cor.addEventListener('input', () => {
      E.cor = Estudos.corSegura(cor.value);
      salvar();
    });
    const autor = h('input', { type: 'text', 'aria-label': 'Seu nome', placeholder: 'Seu nome' });
    autor.value = E.autor?.nome || '';
    autor.addEventListener('input', () => {
      E.autor = { nome: autor.value };
      Lab.store.set('autor-nome', autor.value.trim());
      salvar();
      render();
    });
    modal({
      title: 'Estudo',
      body: h('div', { class: 'form' },
        campo('Título', null, entrada(E, 'titulo', { rotuloAria: 'Título do estudo', ph: 'Descanso' })),
        campo('Descrição', 'Uma ou duas frases para quem vai escolher o estudo.', entrada(E, 'descricao', { linhas: 2, rotuloAria: 'Descrição' })),
        campo('Pergunta central', 'A pergunta que o estudo inteiro tenta responder.', entrada(E, 'pergunta_central', { linhas: 2, rotuloAria: 'Pergunta central' })),
        campo('Cor', 'A cor do estudo na tela de temas.', cor),
        campo('Autor', 'Aparece para quem receber o estudo. Fica guardado para os próximos.', autor),
        campo('Licença', 'O que outras pessoas podem fazer com o seu estudo.', seletor(Estudos.LICENCAS.map((l) => [l, l]), E.licenca, (v) => { E.licenca = v; salvar(); }, 'Licença')),
        campo('Artigo', 'O mural lido como um texto corrido: as notas maduras viram seções e as em andamento fecham como perguntas em aberto.',
          h('button', { class: 'btn', type: 'button', onclick: () => { fechar(null); Artigo.abrir(E); } }, 'Ver como artigo')),
        campo('Compartilhar', 'O arquivo leva o mural inteiro: quem só joga vê as notas maduras; quem duplica vê também as suas anotações.',
          h('button', { class: 'btn primary', type: 'button', onclick: () => { fechar(null); exportar(); } }, 'Exportar'))),
      actions: [{ label: 'Fechar', value: null, primary: true }],
      focar: false,
      mount: (close) => (fechar = close),
    }).then(() => render());
  }

  function verFaltas() {
    const { erros, avisos, faltas } = Estudos.validar(E);
    let fechar = () => {};
    const ir = (x, camadaAlvo) => () => {
      fechar(null);
      const n = x.no && porId(x.no);
      if (!n) return painelEstudo();
      sel = n.id;
      render();
      aprofundar(n, camadaAlvo);
    };
    const item = (x, cls, texto, camadaAlvo) => h('button', { class: `opcao verif ${cls}`, onclick: ir(x, camadaAlvo) }, texto);
    modal({
      title: 'O que falta',
      body: h('div', {},
        erros.length > 0 && h('h3', {}, 'Impede jogar'),
        erros.map((x) => item(x, 'erro', `✗ ${x.msg}`)),
        faltas.length > 0 && h('h3', {}, `Notas em andamento (${faltas.length})`),
        faltas.length > 0 && h('p', { class: 'guia' }, 'Não impedem nada: só as notas maduras entram no jogo. Toque para continuar de onde parou.'),
        faltas.map((x) => item(x, 'falta', `${nome(porId(x.no))}: ${x.msg}`, x.camada)),
        !erros.length && !faltas.length && h('p', { class: 'status ok' }, '✓ Todas as notas amadureceram. Dá para testar, exportar e transformar o mural em artigo.'),
        !erros.length && !faltas.length && h('button', { class: 'btn primary', onclick: () => { fechar(null); Artigo.abrir(E); } }, 'Transformar em artigo'),
        avisos.length > 0 && h('h3', {}, `Conselhos (${avisos.length})`),
        avisos.map((x) => item(x, 'aviso', `△ ${x.msg}`))),
      actions: [(erros.length || faltas.length) && E.nos.some(madura) && { label: 'Ver como artigo', value: 'artigo' }, { label: 'Fechar', value: null, primary: true }].filter(Boolean),
      mount: (close) => (fechar = close),
    }).then((r) => r === 'artigo' && Artigo.abrir(E));
  }

  function testar() {
    if (Estudos.validar(E).erros.length) {
      toast('Resolva o que impede jogar antes de testar.', 'erro');
      return verFaltas();
    }
    // Progresso próprio do teste, que recomeça a cada vez.
    const chave = `teste-${E.id}`;
    Lab.store.del(`${chave}:progresso`);
    const jogo = Estudos.paraJogo(E);
    const fora = E.nos.length - jogo.nos.length;
    sel = ligando = null;
    const estudo = E;
    ctx.abrirEstudo(Estudos.preparar(jogo), { chave, voltar: () => abrir(estudo, ctx), artigo: estudo });
    if (fora) toast(`${fora} ${fora === 1 ? 'nota em andamento ficou' : 'notas em andamento ficaram'} de fora do teste.`);
  }

  function exportar() {
    if (Estudos.validar(E).erros.length) {
      toast('Resolva o que impede jogar antes de exportar.', 'erro');
      return verFaltas();
    }
    E.versao = (E.versao || 0) + 1;
    E.atualizado_em = Estudos.agora();
    E.versao_formato = Estudos.VERSAO_FORMATO;
    salvar();
    const json = JSON.stringify(E, null, 2);
    const area = h('textarea', { rows: 8, readonly: true, class: 'json', 'aria-label': 'Arquivo do estudo' });
    area.value = json;
    const arquivo = `${(E.titulo || 'estudo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estudo'}.estudo.json`;
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        area.select();
        document.execCommand('copy');
      }
      toast('Estudo copiado.', 'ok');
    };
    const baixar = () => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = h('a', { href: url, download: arquivo });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    modal({
      title: 'Exportar',
      body: h('div', { class: 'form' },
        h('p', {}, `Versão ${E.versao}. Envie o arquivo ou o texto para outra pessoa: ela abre pelo menu → Importar estudo.`),
        h('div', { class: 'linha' }, h('button', { class: 'btn primary', type: 'button', onclick: baixar }, 'Baixar arquivo'), h('button', { class: 'btn', type: 'button', onclick: copiar }, 'Copiar')),
        area),
      actions: [{ label: 'Fechar', value: null }],
      focar: false,
    }).then(() => render());
  }

  window.Editor = { abrir };
})();
