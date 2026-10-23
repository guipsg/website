// Laboratório de leitura — o jogo.
// Duas telas sobre o mesmo quadro: Temas (a seleção) e o mapa de perguntas de um
// tema (o grafo, inspirado no ship log de Outer Wilds). Palavras hebraicas são
// descobertas tocando nas palavras que brilham durante a leitura, e a síntese
// final se monta arrastando as palavras aprendidas para os lugares certos.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, checkEvidence, fmtRef } = Lab;
  const el = Lousa.el;
  const lousa = Lousa.criar(document.getElementById('lousa'));
  const $ = (s) => document.querySelector(s);
  const TIPOS = { tema: 'tema', citacao: 'citação', alusao: 'alusão', mesma_palavra: 'mesma palavra' };
    const INICIAL = { visitado: false, resolvidos: [], vistos: [], erros: {}, foco: {}, previsoes: {}, achadas: {}, palavrasVistas: [], facetasOk: {}, definicoes: {}, sintese: {}, convite: false };

  let sistema = null;
  const pacotes = {}; // id do corpo -> dados do pacote
  let tela = null; // { tipo: 'sistema' } ou o mapa de um tema
  let selecionado = null;

  iniciar().catch((e) => {
    console.error(e);
    toast('Não consegui carregar o conteúdo.', 'erro');
  });

  async function iniciar() {
    sistema = await Lab.loadPack('sistema.json');
    for (const c of sistema.corpos) if (c.pacote) pacotes[c.id] = await Lab.loadPack(c.pacote);
    ligarHud();
    mostrarSistema();
    await Lab.startSession('constelacao', 'o laboratório');
    try {
      await Lab.bible.ensure();
    } catch {
      toast('Não consegui falar com a API da Bíblia. O texto tenta carregar de novo ao abrir uma passagem.', 'erro');
    }
  }

  const progressoDe = (id) => Lab.store.get(`${id}:progresso`, null);

  function ligarHud() {
    $('#voltar').onclick = () => mostrarSistema();
    $('#menu').onclick = abrirMenu;
    // Girou o celular: o sistema troca entre fila e pilha.
    let giro = 0;
    addEventListener('resize', () => {
      clearTimeout(giro);
      giro = setTimeout(() => {
        if (tela?.tipo === 'sistema') {
          desenharSistema();
          tela.enquadrar();
        }
      }, 200);
    });
    document.querySelectorAll('[data-zoom]').forEach((b) => {
      b.onclick = () => {
        const z = b.dataset.zoom;
        if (z === 'mais') lousa.zoom(1.35);
        else if (z === 'menos') lousa.zoom(1 / 1.35);
        else tela.enquadrar();
      };
    });
  }

  function hud(titulo, subtitulo, comVoltar) {
    $('#titulo').textContent = titulo;
    $('#subtitulo').textContent = subtitulo;
    $('#voltar').hidden = !comVoltar;
  }

  // ======================================================================
  // Sistema: a tela de seleção
  // ======================================================================
  // Em pé, os temas se empilham; deitado, ficam em fila.
  const emPe = () => innerHeight > innerWidth * 1.1;
  const posCorpo = (i) => (emPe() ? { x: 0, y: i * 300 } : { x: i * 290, y: 0 });

  function mostrarSistema() {
    const n = sistema.corpos.length;
    const caixa = () => (emPe() ? { x: -150, y: -190, w: 300, h: 300 * (n - 1) + 410 } : { x: -150, y: -110, w: 290 * (n - 1) + 300, h: 330 });
    tela = { tipo: 'sistema', enquadrar: () => lousa.enquadrar(caixa(), 60) };
    hud('Temas', 'Escolha um tema · arraste e aproxime', false);
    desenharSistema();
    tela.enquadrar();
    mostrarInfo();
  }

  function desenharSistema() {
    lousa.limpar();
    const M = lousa.mundo;
    garantirDefs();
    sistema.corpos.forEach((c, i) => {
      const { x, y } = posCorpo(i);
      const prog = progressoDe(c.id);
      const estado = !c.pacote ? 'desconhecido' : prog && prog.visitado ? 'visitado' : 'ouvido';
      const g = el('g', { class: `corpo ${selecionado === c.id ? 'selecionado' : ''}`, transform: `translate(${x},${y})`, tabindex: 0, role: 'button', 'aria-label': estado === 'desconhecido' ? 'Tema desconhecido' : c.titulo });
      const R = 62;
      g.append(el('circle', { class: 'anel', r: R + 14 }));
      // Visitado: a cor do tema. Conhecido: só o contorno. Desconhecido: tracejado.
      g.append(el('circle', { class: `medalha ${estado}`, r: R, ...(estado === 'visitado' ? { fill: c.cor } : {}) }));
      const letra = el('text', { class: `medalha-letra ${estado}` });
      letra.textContent = estado === 'desconhecido' ? '?' : c.titulo.replace(/^(O|A) /, '')[0];
      g.append(letra);
      // Um ponto por palavra do tema, preenchido quando descoberta.
      const pal = pacotes[c.id]?.palavras || Array.from({ length: c.luas || 1 }, (_, k) => ({ id: `${c.id}-${k}` }));
      pal.forEach((w, k) => {
        const achada = prog && (prog.achadas?.[w.id] || []).length > 0;
        g.append(el('circle', { class: `ponto-palavra ${achada ? 'achada' : ''}`, cx: (k - (pal.length - 1) / 2) * 30, cy: R + 30, r: 8 }));
      });
      if (estado !== 'desconhecido') {
        const t = el('text', { class: 'nome-corpo', y: R + 76 });
        t.textContent = c.titulo;
        g.append(t);
      }
      const escolher = () => {
        selecionado = c.id;
        desenharSistema();
        mostrarInfo();
      };
      g.addEventListener('click', escolher);
      g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), escolher()));
      M.append(g);
    });
  }

  function mostrarInfo() {
    const info = $('#info');
    const c = sistema.corpos.find((x) => x.id === selecionado);
    if (!c) {
      Lab.mount(info, h('p', { style: 'margin:0' }, 'Toque num tema para abrir.'));
      info.hidden = false;
      return;
    }
    if (!c.pacote) {
      Lab.mount(info, h('h2', {}, '? ? ?'), h('p', {}, 'Ainda nenhuma pista leva até este tema.'));
      info.hidden = false;
      return;
    }
    const d = pacotes[c.id];
    const p = progressoDe(c.id) || INICIAL;
    const palavras = d.palavras.filter((w) => (p.achadas?.[w.id] || []).length).length;
    Lab.mount(
      info,
      h('h2', {}, c.titulo),
      h('p', {}, p.visitado ? `${p.resolvidos.length} de ${d.nos.length} entendidos · ${palavras} de ${d.palavras.length} palavras` : 'Você ainda não começou este tema.'),
      h('button', { class: 'btn primary', onclick: () => abrirConstelacao(c) }, p.visitado ? 'Continuar' : 'Abrir'),
    );
    info.hidden = false;
  }

  function garantirDefs() {
    const D = lousa.defs;
    if (D.querySelector('#seta-tema')) return;
    for (const t of Object.keys(TIPOS)) {
      const m = el('marker', { id: `seta-${t}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
      m.append(el('path', { d: 'M0,0 L10,5 L0,10 z', class: `seta-${t}` }));
      D.append(m);
    }
  }

  // ======================================================================
  // Mapa de perguntas de um tema
  // ======================================================================
  function abrirConstelacao(corpo) {
    $('#info').hidden = true;
    const data = pacotes[corpo.id];
    const prog = Lab.progress(corpo.id, INICIAL);
    const S = prog.data;
    S.visitado = true;
    prog.save();
    const byId = new Map(data.nos.map((n) => [n.id, n]));
    const palavras = new Map(data.palavras.map((w) => [w.id, w]));
    const wid = (w) => `w:${w.id}`;
    const pos = layout(data);
    let destaque = new Set();

    // ---------------- estado derivado ----------------
    const isResolved = (id) => S.resolvidos.includes(id);
    const isOpen = (id) => !isResolved(id) && (byId.get(id).tipo === 'inicio' || data.nos.some((n) => isResolved(n.id) && n.pistas.some((p) => p.para === id)));
    const isVisible = (id) => isResolved(id) || isOpen(id);
    const achadas = (w) => (S.achadas[w.id] ||= []);
    const descoberta = (w) => achadas(w).length > 0;
    const facetasOk = (w) => (S.facetasOk[w.id] ||= []);
    const palavraCompleta = (w) => facetasOk(w).length === w.facetas.length;
    const passagemDe = (f) => data.passagens[byId.get(f.no).passagem].osis;
    // Facetas cuja passagem já teve uma ocorrência encontrada, mas ainda sem resposta.
    const facetasPendentes = (w) => w.facetas.filter((f) => !facetasOk(w).includes(f.id) && achadas(w).some((a) => Lab.inRange(a.verso, passagemDe(f))));
    // Nós de passagem onde a palavra já foi encontrada.
    const nosDaPalavra = (w) => data.nos.filter((n) => n.passagem && achadas(w).some((a) => Lab.inRange(a.verso, data.passagens[n.passagem].osis)));

    tela = { tipo: 'constelacao', enquadrar };
    render();
    enquadrar();
    if (!S.convite) convite();

    function enquadrar() {
      const ids = [...data.nos.filter((n) => isVisible(n.id)).map((n) => n.id), ...data.palavras.filter(descoberta).map(wid)];
      const xs = ids.map((id) => pos[id].x);
      const ys = ids.map((id) => pos[id].y);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      lousa.enquadrar({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 + 40 }, 150);
    }

    function render() {
      hud(corpo.titulo, `${S.resolvidos.length} de ${data.nos.length} entendidos · ${data.palavras.filter(descoberta).length} de ${data.palavras.length} palavras`, true);
      lousa.limpar();
      garantirDefs();
      const M = lousa.mundo;
      const nos = data.nos.filter((n) => isVisible(n.id));
      const pals = data.palavras.filter(descoberta);

      for (const w of pals) {
        for (const n of nosDaPalavra(w)) {
          if (!isVisible(n.id)) continue;
          M.append(linha2(pos[wid(w)], pos[n.id], 40, raio(n) + 4, 'aresta e-palavra'));
        }
      }
      for (const n of data.nos) {
        if (!isResolved(n.id)) continue;
        for (const p of n.pistas) {
          const ln = linha2(pos[n.id], pos[p.para], raio(n), raio(byId.get(p.para)) + 6, `aresta e-${p.tipo} ${isResolved(p.para) ? '' : 'pendente'}`);
          ln.setAttribute('marker-end', `url(#seta-${p.tipo})`);
          M.append(ln);
        }
      }
      for (const n of nos) {
        const res = isResolved(n.id);
        const novo = destaque.has(n.id) || (!res && !S.vistos.includes(n.id));
        const g = noSvg(pos[n.id], ['no', res ? 'resolvido' : 'aberto', n.tipo === 'sintese' ? 'sintese' : '', novo ? 'novo' : ''], `${n.titulo}${res ? ', entendido' : ', pergunta aberta'}`, () => abrir(n));
        g.append(el('circle', { r: raio(n) }));
        g.append(txt('icone', res ? '✓' : '?'));
        rotulo(g, n.titulo, raio(n));
        if (!res && !S.vistos.includes(n.id)) selo(g, raio(n) * 0.75, -raio(n) * 0.75, '!');
        M.append(g);
      }
      for (const w of pals) {
        const g = noSvg(pos[wid(w)], ['no', 'palavra', palavraCompleta(w) ? 'completa' : '', destaque.has(wid(w)) ? 'novo' : ''], `Palavra ${w.transliteracao}`, () => abrirPalavra(w));
        g.append(el('rect', { x: -44, y: -32, width: 88, height: 64, rx: 14 }));
        g.append(txt('icone', w.original.replace(/[\u0591-\u05C7]/g, '')));
        rotulo(g, w.transliteracao, 32);
        // "!" para palavra nova; um número quando há facetas esperando resposta.
        if (!S.palavrasVistas.includes(w.id)) selo(g, 42, -30, '!');
        else if (facetasPendentes(w).length) selo(g, 42, -30, String(facetasPendentes(w).length), 'numero');
        M.append(g);
      }
      destaque = new Set();
    }

    // ---------------- leitura com palavras que brilham ----------------
    function brilhosPara(osis, contexto) {
      const faixa = contexto || osis;
      const out = [];
      for (const w of data.palavras) {
        for (const o of w.ocorrencias) {
          if (Lab.inRange(o.verso, faixa)) out.push({ id: `${w.id}@${o.verso}`, palavra: w.id, verso: o.verso, formas: o.formas, nota: o.nota, achado: achadas(w).some((a) => a.verso === o.verso) });
        }
      }
      return out;
    }

    function ler(opcoes) {
      const pas = opcoes.pas;
      return reader({ ...opcoes, osis: pas.osis, contexto: pas.contexto, brilhos: brilhosPara(pas.osis, pas.contexto), onBrilho: tocouPalavra });
    }

    async function tocouPalavra(b, texto) {
      const w = palavras.get(b.palavra);
      const primeira = !descoberta(w);
      if (!achadas(w).some((a) => a.verso === b.verso)) {
        achadas(w).push({ verso: b.verso, texto });
        prog.save();
      }
      if (primeira) {
        destaque.add(wid(w));
        toast(`Nova palavra: "${texto}" traduz ${w.transliteracao}. Ela aparece no mapa com "!".`, 'ok');
      } else {
        toast(`"${texto}" → ${w.transliteracao}${b.nota ? `. ${b.nota}` : ''}`);
      }
      const f = w.facetas.find((x) => !facetasOk(w).includes(x.id) && Lab.inRange(b.verso, passagemDe(x)));
      if (f) await escolherFaceta(w, f);
    }

    // Uma faceta por vez, conferida na hora. Errou: a opção sai e tenta de novo.
    async function escolherFaceta(w, f) {
      const tentadas = [];
      for (;;) {
        const opcoes = w.facetas.filter((x) => !facetasOk(w).includes(x.id) && !tentadas.includes(x.id));
        const op = await Lab.escolha({
          title: `O que ${w.transliteracao} mostra aqui?`,
          intro: h('p', {}, `Neste trecho (${fmtRef(passagemDe(f))}), o que a palavra revela?`),
          opcoes: [...Lab.shuffle(opcoes), { id: null, descricao: 'Decidir depois' }],
          rotulo: (x) => x.descricao,
        });
        if (!op || !op.id) return render();
        if (op.id === f.id) {
          facetasOk(w).push(f.id);
          prog.save();
          buzz(40);
          toast(`✓ ${f.descricao}`, 'ok');
          return render();
        }
        tentadas.push(op.id);
        buzz(15);
        toast('Não é isso que este trecho mostra. Tente outra.', 'erro');
      }
    }

    // ---------------- nós de passagem ----------------
    async function abrir(n) {
      $('#info').hidden = true;
      if (!S.vistos.includes(n.id)) {
        S.vistos.push(n.id);
        prog.save();
      }
      const pas = data.passagens[n.passagem];
      if (isResolved(n.id)) {
        const r = await modal({
          title: n.titulo,
          body: h('div', {}, h('p', { class: 'muted' }, fmtRef(pas.osis)), h('div', { class: 'revelacao' }, n.revelacao), previsaoFeita(n), pistasDe(n)),
          actions: [
            { label: 'Reler a passagem', value: 'ler' },
            { label: 'Fechar', value: null, primary: true },
          ],
        });
        if (r === 'ler') await ler({ pas });
        return render();
      }
      const faltamNos = (n.requer || []).filter((id) => !isResolved(id)).length;
      const faltamPal = (n.requer_palavras || []).filter((id) => !descoberta(palavras.get(id))).length;
      if (faltamNos || faltamPal) {
        const partes = [faltamNos && `${faltamNos} ${faltamNos === 1 ? 'pergunta' : 'perguntas'} do mapa`, faltamPal && `${faltamPal} ${faltamPal === 1 ? 'palavra brilhando no texto' : 'palavras brilhando no texto'}`].filter(Boolean);
        await modal({
          title: n.titulo,
          body: h('div', {}, h('p', {}, n.pergunta), h('p', { class: 'aviso' }, `Esta pergunta junta várias partes do mapa. Antes, ainda falta encontrar ${partes.join(' e ')}.`)),
        });
        return render();
      }
      if (n.deducao) return abrirSintese(n);
      render();
      if (n.previsao && S.previsoes[n.id] == null) {
        const op = await Lab.escolha({
          title: n.titulo,
          intro: h('div', {}, h('p', {}, n.pergunta), h('p', { class: 'aviso' }, n.previsao.pergunta)),
          opcoes: [...n.previsao.opcoes.map((texto, idx) => ({ texto, idx })), { texto: 'Prefiro só ler', idx: -1 }],
        });
        if (!op) return;
        S.previsoes[n.id] = op.idx;
        prog.save();
      } else {
        const r = await modal({
          title: n.titulo,
          body: h('div', {}, h('p', {}, n.pergunta), h('p', { class: 'muted' }, `A resposta está em ${fmtRef(pas.osis)}.`)),
          actions: [
            { label: 'Depois', value: null },
            { label: 'Ler e responder', value: 'ler', primary: true },
          ],
        });
        if (r !== 'ler') return;
      }
      responder(n);
    }

    async function responder(n) {
      const pas = data.passagens[n.passagem];
      for (;;) {
        const key = await ler({ pas, prompt: n.pergunta, select: true, foco: S.foco[n.id] || null });
        if (!key) return render();
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
      destaque = new Set(n.pistas.map((p) => p.para).filter((id) => !isResolved(id)));
      render();
      avisoEntendido(n);
    }

    // Sem janela: os nós novos aparecem no mapa com "!", e o que se entendeu
    // fica a um toque, num aviso no rodapé.
    function avisoEntendido(n) {
      const info = $('#info');
      const novos = n.pistas.filter((p) => !S.vistos.includes(p.para) && !isResolved(p.para)).length;
      Lab.mount(
        info,
        h('h2', {}, `✓ ${n.titulo}`),
        h('p', {}, novos ? `${novos} ${novos === 1 ? 'pergunta nova apareceu' : 'perguntas novas apareceram'} no mapa com "!".` : 'Toque no nó quando quiser rever.'),
        h('div', { class: 'linha' },
          h('button', { class: 'btn primary', onclick: () => { info.hidden = true; abrir(n); } }, 'Ver o que entendi'),
          h('button', { class: 'btn', onclick: () => (info.hidden = true) }, 'Fechar')),
      );
      info.hidden = false;
    }

    function previsaoFeita(n) {
      const p = n.previsao;
      const dada = S.previsoes[n.id];
      if (!p || dada == null || dada < 0) return null;
      const certo = dada === p.correta;
      return h('p', { class: `prev ${certo ? 'acertou' : 'errou'}` }, `Sua previsão: ${p.opcoes[dada]} ${certo ? '✓' : '✗'}. ${p.retorno}`);
    }

    function pistasDe(n, novas = false) {
      if (!n.pistas.length) return null;
      return h('div', {}, h('h3', {}, novas ? 'Novas pistas' : 'Pistas'),
        h('ul', { class: 'pistas-lista' }, n.pistas.map((p) => {
          const alvo = byId.get(p.para);
          return h('li', {}, h('b', {}, isResolved(p.para) ? alvo.titulo : `? ${alvo.titulo}`), ` (${TIPOS[p.tipo]}): ${p.texto}`);
        })));
    }

    // ---------------- nó de palavra ----------------
    function abrirPalavra(w) {
      if (!S.palavrasVistas.includes(w.id)) {
        S.palavrasVistas.push(w.id);
        prog.save();
      }
      let letraSel = null;
      const corpoEl = h('div', {});
      const desenhar = () => {
        const L = letraSel != null ? w.letras[letraSel] : null;
        const faltam = w.ocorrencias.length - achadas(w).length;
        Lab.mount(
          corpoEl,
          h('p', { class: 'heb-grande' }, w.original),
          h('p', { class: 'translit' }, `${w.transliteracao} · ${w.lingua}`),
          h('p', {}, w.pergunta_inicial),
          h('div', { class: 'letras', 'aria-label': 'Letras, da direita para a esquerda' },
            w.letras.map((l, i) => h('button', { class: `letra ${l.papel === 'raiz' ? 'raiz' : ''} ${i === letraSel ? 'sel' : ''}`, onclick: () => { letraSel = i === letraSel ? null : i; desenhar(); } },
              h('span', { class: 'g' }, l.glifo), h('span', { class: 'n' }, l.nome)))),
          L
            ? h('div', { class: 'letra-info' }, h('b', {}, `${L.nome} (${L.glifo})`), ` · som "${L.som}" · valor ${L.valor}`,
                h('div', {}, `Nesta palavra: ${L.papel === 'raiz' ? 'faz parte da raiz' : L.papel}`),
                h('div', { class: 'cur' }, `O nome da letra vem de um desenho antigo: ${L.desenho}. É a origem da letra, não o sentido da palavra.`))
            : h('p', { class: 'muted', style: 'font-size:14px' }, 'Toque numa letra. As de borda destacada formam a raiz.'),
          h('div', { class: 'raiz' },
            h('div', {}, 'Raiz ', h('span', { class: 'heb', dir: 'rtl' }, w.raiz.letras), ` (${w.raiz.translit}): `, h('b', {}, w.raiz.sentido)),
            h('ul', {}, w.raiz.familia.map((x) => h('li', {}, h('span', { class: 'heb', style: 'font-size:19px' }, x.palavra), ` ${x.translit}: ${x.sentido}`)))),
          h('h3', {}, `No texto (${achadas(w).length} de ${w.ocorrencias.length})`),
          achadas(w).map((a) => {
            const o = w.ocorrencias.find((x) => x.verso === a.verso);
            return h('div', { class: 'achado-item' }, h('b', {}, a.texto), ` · ${fmtRef(a.verso)}`, o?.nota && h('div', { class: 'nota' }, o.nota));
          }),
          faltam > 0 && h('p', { class: 'muted', style: 'font-size:14px' }, `Mais ${faltam} ${faltam === 1 ? 'uso brilha' : 'usos brilham'} em passagens deste tema.`),
          h('h3', {}, `Facetas (${facetasOk(w).length} de ${w.facetas.length})`),
          w.facetas.filter((f) => facetasOk(w).includes(f.id)).map((f) => h('div', { class: 'faceta-linha certa' }, h('span', { class: 'desc' }, `✓ ${f.descricao}`), h('span', { class: 'muted' }, fmtRef(passagemDe(f))))),
          facetasPendentes(w).map((f) => h('div', { class: 'faceta-linha' }, h('span', { class: 'desc' }, `${fmtRef(passagemDe(f))}: o que a palavra mostra aqui?`),
            h('button', { class: 'btn', onclick: async () => { await escolherFaceta(w, f); desenhar(); } }, 'Escolher'))),
          palavraCompleta(w) && definicao(w, desenhar),
        );
      };
      desenhar();
      return modal({ title: w.titulo, body: corpoEl, actions: [{ label: 'Fechar', value: null, primary: true }] }).then(render);
    }

    function definicao(w, desenhar) {
      if (S.definicoes[w.id]) return h('div', {}, h('h3', {}, 'Sua definição'), h('p', {}, S.definicoes[w.id]), h('h3', {}, 'Síntese de referência'), h('div', { class: 'revelacao' }, w.sintese));
      const t = h('textarea', { rows: 3, id: `def-${w.id}`, placeholder: `Defina ${w.transliteracao} com suas palavras…` });
      return h('div', {}, h('h3', {}, 'Palavra decifrada'), h('p', {}, 'Antes de ver a síntese, escreva sua própria definição.'), t,
        h('div', { class: 'linha', style: 'margin-top:8px' }, h('button', { class: 'btn primary', onclick: () => {
          if (!t.value.trim()) return toast('Escreva algo antes de comparar.');
          S.definicoes[w.id] = t.value.trim();
          prog.save();
          desenhar();
        } }, 'Comparar com a síntese')));
    }

    // ---------------- síntese: arrastar as palavras aprendidas ----------------
    function abrirSintese(n) {
      const D = n.deducao;
      const pas = data.passagens[n.passagem];
      const vagas = D.frases.flatMap((f) => Object.keys(f.lacunas).map((k) => ({ id: `${f.id}.${k}`, certa: f.lacunas[k] })));
      const P = S.sintese; // vaga -> índice da ficha
      let marcarErros = false;
      let fichaSel = null;
      const corpoEl = h('div', {});
      const naBandeja = () => D.fichas.map((_, i) => i).filter((i) => !Object.values(P).includes(i));
      const ok = (v) => P[v.id] != null && D.fichas[P[v.id]].texto === v.certa;

      return modal({
        title: n.titulo,
        body: corpoEl,
        actions: [{ label: 'Fechar', value: null }],
        mount: (close) => {
          const desenhar = () => {
            Lab.mount(
              corpoEl,
              h('p', {}, n.pergunta),
              h('button', { class: 'btn', onclick: async () => { await ler({ pas }); desenhar(); } }, `Ler ${fmtRef(pas.osis)}`),
              D.frases.map((f) => frase(f)),
              h('div', { class: 'bandeja', 'data-bandeja': '1' }, naBandeja().map((i) => fichaEl(i)), naBandeja().length === 0 && h('span', { class: 'muted' }, 'Todas as palavras estão na mesa.')),
              marcarErros && vagas.some((v) => !ok(v)) && h('p', { class: 'aviso' }, 'As vagas em vermelho estão com a palavra errada. Arraste outra para lá.'),
            );
          };
          const frase = (f) => {
            const partes = [];
            const re = /\{(\w+)\}/g;
            let last = 0;
            let m;
            while ((m = re.exec(f.modelo))) {
              partes.push(f.modelo.slice(last, m.index));
              const v = vagas.find((x) => x.id === `${f.id}.${m[1]}`);
              const cheia = P[v.id] != null;
              const cls = ['vaga', cheia ? 'cheia' : '', cheia && marcarErros ? (ok(v) ? 'certa' : 'errada') : ''].join(' ');
              partes.push(h('span', { class: cls, 'data-vaga': v.id, role: 'button', tabindex: 0, onclick: () => tocarVaga(v) }, cheia ? D.fichas[P[v.id]].texto : '______'));
              last = re.lastIndex;
            }
            partes.push(f.modelo.slice(last));
            return h('p', { class: 'frase' }, partes);
          };
          const fichaEl = (i) => {
            const b = h('button', { class: `ficha ${fichaSel === i ? 'sel' : ''}`, 'data-ficha': i }, D.fichas[i].texto);
            b.addEventListener('pointerdown', (e) => arrastar(e, i, b));
            return b;
          };
          const travada = (v) => marcarErros && ok(v);
          const colocar = (i, vagaId) => {
            const v = vagas.find((x) => x.id === vagaId);
            if (!v || travada(v)) return;
            for (const k of Object.keys(P)) if (P[k] === i) delete P[k];
            P[vagaId] = i;
            fichaSel = null;
            prog.save();
            conferir();
          };
          const tocarVaga = (v) => {
            if (travada(v)) return;
            if (fichaSel != null) return colocar(fichaSel, v.id);
            if (P[v.id] != null) {
              delete P[v.id]; // volta para a bandeja
              prog.save();
              desenhar();
            }
          };
          // Arrasto com ponteiro (mouse e toque). Um toque sem arrastar seleciona a ficha.
          const arrastar = (e, i, origem) => {
            e.preventDefault();
            const x0 = e.clientX;
            const y0 = e.clientY;
            let fantasma = null;
            let alvo = null;
            let ultimoY = y0;
            let naBorda = null;
            // Parado perto da borda por um instante, a janela rola para alcançar
            // as frases fora da vista. A zona de baixo fica logo acima da bandeja.
            const rolagem = setInterval(() => {
              if (!fantasma) return;
              const caixa = corpoEl.closest('.modal');
              const topo = caixa.getBoundingClientRect().top;
              const bandeja = corpoEl.querySelector('.bandeja').getBoundingClientRect().top;
              const dir = ultimoY < topo + 60 ? -1 : ultimoY > bandeja - 50 && ultimoY < bandeja ? 1 : 0;
              if (!dir) return void (naBorda = null);
              naBorda ??= performance.now();
              if (performance.now() - naBorda > 300) caixa.scrollTop += dir * 12;
            }, 30);
            const mover = (ev) => {
              ultimoY = ev.clientY;
              if (!fantasma && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
              if (!fantasma) {
                fantasma = h('div', { class: 'ficha fantasma' }, D.fichas[i].texto);
                document.body.append(fantasma);
                origem.style.opacity = '0.4';
              }
              fantasma.style.left = `${ev.clientX}px`;
              fantasma.style.top = `${ev.clientY}px`;
              // Perto da borda da janela, rola para alcançar as frases fora da vista.
              const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-vaga]');
              if (alvo !== sob) {
                alvo?.classList.remove('alvo');
                alvo = sob;
                alvo?.classList.add('alvo');
              }
            };
            const soltar = (ev) => {
              clearInterval(rolagem);
              removeEventListener('pointermove', mover);
              removeEventListener('pointerup', soltar);
              removeEventListener('pointercancel', soltar);
              if (!fantasma) {
                fichaSel = fichaSel === i ? null : i;
                return desenhar();
              }
              fantasma.remove();
              origem.style.opacity = '';
              alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-vaga]') || null;
              if (alvo) colocar(i, alvo.dataset.vaga);
              else desenhar();
            };
            addEventListener('pointermove', mover);
            addEventListener('pointerup', soltar);
            addEventListener('pointercancel', soltar);
          };
          const conferir = () => {
            const todas = vagas.every((v) => P[v.id] != null);
            marcarErros = todas;
            if (todas && vagas.every(ok)) {
              close(null);
              return concluirSintese(n);
            }
            if (todas) buzz(15);
            desenhar();
          };
          marcarErros = vagas.every((v) => P[v.id] != null);
          desenhar();
        },
      }).then(render);
    }

    async function concluirSintese(n) {
      S.resolvidos.push(n.id);
      prog.save();
      buzz(60);
      render();
      await modal({ title: `✓ ${n.titulo}`, body: h('div', { class: 'revelacao' }, n.revelacao), actions: [{ label: 'Continuar', value: true, primary: true }] });
      const r = await modal({
        title: 'Tema completo',
        body: h('p', {}, 'Você chegou à síntese. Quer registrar a sessão no diário agora?'),
        actions: [
          { label: 'Continuar explorando', value: null },
          { label: 'Abrir o diário', value: true, primary: true },
        ],
      });
      if (r) Lab.endSession('constelacao');
    }

    function convite() {
      Lab.escolha({ title: data.convite.pergunta, opcoes: data.convite.opcoes, dismissable: false }).then((op) => {
        S.convite = true;
        prog.save();
        if (op && op.leva_a) abrir(byId.get(op.leva_a));
      });
    }

    tela.recomecar = () => {
      prog.reset();
      selecionado = corpo.id;
      mostrarSistema();
    };
  }

  // ======================================================================
  // Menu
  // ======================================================================
  async function abrirMenu() {
    const t = Lab.bible.current();
    const opcoes = [
      { k: 'traducao', texto: `Tradução: ${t ? t.shortName || t.name : 'escolher'}` },
      { k: 'diario', texto: 'Diário' },
      { k: 'encerrar', texto: 'Encerrar a sessão (diário)' },
      tela?.recomecar && { k: 'recomecar', texto: 'Recomeçar este tema' },
      { k: 'sobre', texto: 'Sobre o texto bíblico' },
    ].filter(Boolean);
    const op = await Lab.escolha({ title: 'Menu', opcoes });
    if (!op) return;
    if (op.k === 'traducao') {
      try {
        await Lab.chooseTranslation();
      } catch {}
    } else if (op.k === 'diario') verDiario();
    else if (op.k === 'encerrar') Lab.endSession('constelacao');
    else if (op.k === 'recomecar') {
      const r = await modal({
        title: 'Recomeçar este tema?',
        body: h('p', {}, 'Apaga o progresso deste tema. O diário é mantido.'),
        actions: [
          { label: 'Cancelar', value: null },
          { label: 'Apagar progresso', value: true, primary: true },
        ],
      });
      if (r) tela.recomecar();
    } else if (op.k === 'sobre') {
      const tr = Lab.bible.current();
      modal({ title: 'Texto bíblico', body: h('div', {}, h('p', {}, tr ? tr.name : 'Nenhuma tradução escolhida.'), tr?.licenseNotice && h('p', { class: 'muted' }, tr.licenseNotice)) });
    }
  }

  function verDiario() {
    const d = Lab.diario().slice().reverse();
    const json = JSON.stringify(Lab.diario(), null, 2);
    modal({
      title: 'Diário',
      body: h(
        'div',
        {},
        h('button', { class: 'btn', onclick: async () => {
          try {
            await navigator.clipboard.writeText(json);
            toast('Diário copiado.', 'ok');
          } catch {
            toast('Não consegui copiar.', 'erro');
          }
        } }, 'Copiar diário (JSON)'),
        d.length === 0 && h('p', { class: 'muted' }, 'Nenhuma sessão ainda.'),
        d.map((e) => {
          const quando = new Date(e.quando || e.inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
          const titulo = { sessao: 'Sessão', retorno: 'Voltou', lembranca: 'Lembrança tardia' }[e.tipo];
          return h('div', { class: 'entrada-diario' }, h('b', {}, titulo), ' ', h('span', { class: 'muted' }, quando),
            e.perguntas && h('div', {}, `Perguntas: ${e.perguntas}`),
            e.tempo && h('div', {}, `Tempo: ${e.tempo}`),
            e.travou && h('div', {}, `Travou: ${e.travou}`),
            e.resposta && h('div', {}, e.resposta === 'vontade' ? 'Por vontade própria' : 'Por lembrete ou obrigação'),
            e.texto && h('div', {}, e.texto));
        }),
      ),
    });
  }

  // ======================================================================
  // Desenho e layout
  // ======================================================================
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
    wrap(texto, 14).forEach((line, i) => {
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
  // Forças determinísticas sobre o grafo inteiro, para que nada mude de lugar
  // quando novos nós aparecem.
  function layout(data) {
    const ids = [...data.nos.map((n) => n.id), ...data.palavras.map((w) => `w:${w.id}`)];
    const idx = new Map(ids.map((id, i) => [id, i]));
    const edges = [];
    data.nos.forEach((n) => n.pistas.forEach((p) => edges.push([idx.get(n.id), idx.get(p.para), 210])));
    data.palavras.forEach((w) => w.facetas.forEach((f) => edges.push([idx.get(`w:${w.id}`), idx.get(f.no), 170])));
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
})();
