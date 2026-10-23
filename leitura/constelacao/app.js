// Constelação — o protótipo que mistura os outros.
// Base: o grafo de perguntas (nós de passagem, resolvidos marcando o versículo).
// Por cima: nós de palavra (léxico com letras e raiz), uma síntese em bloco de
// dedução e a vista Linha, com silhuetas e previsões antes de abrir cada nó.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, checkEvidence, fmtRef } = Lab;
  const app = document.getElementById('app');
  const SVG = 'http://www.w3.org/2000/svg';
  const TIPOS = { tema: 'tema', citacao: 'citação', alusao: 'alusão', mesma_palavra: 'mesma palavra' };
  const CORES = { tema: '#8b9ab8', citacao: '#f0a040', alusao: '#b48ce0', mesma_palavra: '#6cc2a8' };

  Lab.boot({
    proto: 'constelacao',
    titulo: 'Constelação',
    pack: 'descanso.json',
    initial: {
      resolvidos: [], vistos: [], erros: {}, foco: {}, previsoes: {},
      escolhas: {}, confirmadas: {}, erradas: {}, palavrasVistas: [], definicoes: {},
      deducao: {}, testadas: [], convite: false, aba: 'mapa',
    },
  })
    .then(start)
    .catch((e) => {
      console.error(e);
      app.append(h('p', { class: 'erro' }, 'Não consegui carregar o pacote de conteúdo.'));
    });

  function start({ data, prog }) {
    const S = prog.data;
    const byId = new Map(data.nos.map((n) => [n.id, n]));
    const palavras = new Map(data.palavras.map((w) => [w.id, w]));
    const wid = (w) => `w:${w.id}`;
    const pos = layout();
    let destaque = new Set();

    // ---------------- estado derivado ----------------
    const isResolved = (id) => S.resolvidos.includes(id);
    const isOpen = (id) =>
      !isResolved(id) && (byId.get(id).tipo === 'inicio' || data.nos.some((n) => isResolved(n.id) && n.pistas.some((p) => p.para === id)));
    const isVisible = (id) => isResolved(id) || isOpen(id);
    const passagensResolvidas = () => S.resolvidos.filter((id) => byId.get(id).tipo !== 'sintese').length;
    const palavraVisivel = (w) => passagensResolvidas() >= w.aparece_apos && w.facetas.some((f) => isResolved(f.no));
    const confirmadas = (w) => S.confirmadas[w.id] || [];
    const escolhas = (w) => (S.escolhas[w.id] ||= {});
    const erradas = (w) => S.erradas[w.id] || [];
    const palavraCompleta = (w) => confirmadas(w).length === w.facetas.length;
    // Escolhas feitas e ainda não conferidas (as erradas precisam ser refeitas antes).
    const pendentes = (w) => w.facetas.filter((f) => isResolved(f.no) && escolhas(w)[f.no] && !confirmadas(w).includes(f.id) && !erradas(w).includes(f.no));
    const semEscolha = (w) => w.facetas.filter((f) => isResolved(f.no) && !confirmadas(w).includes(f.id) && (!escolhas(w)[f.no] || erradas(w).includes(f.no)));

    render();
    if (!S.convite) convite();

    // ---------------- tela ----------------
    function render() {
      Lab.mount(
        app,
        h('p', { class: 'muted' }, data.tema),
        h('h2', {}, data.pergunta_central),
        h(
          'div',
          { class: 'abas' },
          h('button', { class: S.aba === 'mapa' ? 'ativa' : '', onclick: () => setAba('mapa') }, 'Constelação'),
          h('button', { class: S.aba === 'linha' ? 'ativa' : '', onclick: () => setAba('linha') }, 'Linha'),
        ),
        S.aba === 'mapa' ? mapa() : linha(),
      );
      destaque = new Set();
    }
    function setAba(a) {
      S.aba = a;
      prog.save();
      render();
    }

    function mapa() {
      const nos = data.nos.filter((n) => isVisible(n.id));
      const pals = data.palavras.filter(palavraVisivel);
      const ids = [...nos.map((n) => n.id), ...pals.map(wid)];
      const xs = ids.map((id) => pos[id].x);
      const ys = ids.map((id) => pos[id].y);
      const pad = 110;
      let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
      // Ajusta a caixa à proporção do painel, para o grafo ocupar a tela toda.
      const ratio = Math.min(app.clientWidth || 360, 728) / Math.min(innerHeight * 0.68, 560);
      let w = Math.max(x1 - x0, 480);
      let hh = Math.max(y1 - y0, 480 / ratio);
      if (w / hh < ratio) w = hh * ratio;
      else hh = w / ratio;
      const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
      [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - hh / 2, cy + hh / 2];

      const svg = el('svg', { viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Mapa da constelação' });
      const defs = el('defs');
      for (const t of Object.keys(TIPOS)) {
        const m = el('marker', { id: `seta-${t}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
        m.append(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: CORES[t] }));
        defs.append(m);
      }
      svg.append(defs);
      const grade = el('g', { class: 'grade' });
      for (let x = Math.floor(x0 / 100) * 100; x < x1; x += 100) grade.append(el('line', { x1: x, y1: y0, x2: x, y2: y1 }));
      for (let y = Math.floor(y0 / 100) * 100; y < y1; y += 100) grade.append(el('line', { x1: x0, y1: y, x2: x1, y2: y }));
      svg.append(grade);

      // Palavra -> passagens onde ela aparece (só as já resolvidas).
      for (const wd of pals) {
        for (const f of wd.facetas) {
          if (!isResolved(f.no)) continue;
          const ok = confirmadas(wd).includes(f.id);
          svg.append(linha2(pos[wid(wd)], pos[f.no], 40, raio(byId.get(f.no)) + 4, `aresta e-palavra ${ok ? '' : 'pendente'}`));
        }
      }
      // Pistas de nós resolvidos. Tracejada enquanto o destino é "?".
      for (const n of data.nos) {
        if (!isResolved(n.id)) continue;
        for (const p of n.pistas) {
          const ln = linha2(pos[n.id], pos[p.para], raio(n), raio(byId.get(p.para)) + 6, `aresta e-${p.tipo} ${isResolved(p.para) ? '' : 'pendente'}`);
          ln.setAttribute('marker-end', `url(#seta-${p.tipo})`);
          svg.append(ln);
        }
      }

      for (const n of nos) {
        const res = isResolved(n.id);
        const novo = destaque.has(n.id) || (!res && !S.vistos.includes(n.id));
        const g = noSvg(pos[n.id], ['no', res ? 'resolvido' : 'aberto', n.tipo === 'sintese' ? 'sintese' : '', novo ? 'novo' : ''], `${n.titulo}${res ? ', entendido' : ', pergunta aberta'}`, () => abrir(n));
        g.append(el('circle', { r: raio(n) }));
        g.append(txt('icone', res ? '✓' : '?'));
        rotulo(g, n.titulo, raio(n));
        svg.append(g);
      }
      for (const wd of pals) {
        const novo = !S.palavrasVistas.includes(wd.id);
        const g = noSvg(pos[wid(wd)], ['no', 'palavra', palavraCompleta(wd) ? 'completa' : '', novo ? 'novo' : ''], `Palavra ${wd.transliteracao}`, () => abrirPalavra(wd));
        g.append(el('rect', { x: -44, y: -32, width: 88, height: 64, rx: 14 }));
        g.append(txt('icone', wd.original.replace(/[֑-ׇ]/g, '')));
        rotulo(g, wd.transliteracao, 32);
        const n = semEscolha(wd).length + (pendentes(wd).length >= limiteConferir(wd) ? 1 : 0);
        if (n && !palavraCompleta(wd)) {
          g.append(el('circle', { class: 'selo', cx: 42, cy: -30, r: 13 }));
          const s = txt('selo-txt', '!');
          s.setAttribute('x', 42);
          s.setAttribute('y', -30);
          g.append(s);
        }
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
          Object.entries(TIPOS).map(([t, nome]) => h('span', {}, h('i', { style: `background:${CORES[t]}` }), nome)),
          h('span', {}, '▢ palavra'),
          h('span', {}, 'tracejado = ainda não confirmado'),
        ),
      );
    }

    function linha() {
      const pals = data.palavras.filter(palavraVisivel);
      return h(
        'div',
        {},
        pals.length > 0 &&
          h('div', { class: 'palavras-faixa' }, pals.map((wd) => h('button', { class: 'chip-palavra', onclick: () => abrirPalavra(wd) }, h('span', { class: 'heb' }, wd.original), wd.transliteracao, palavraCompleta(wd) && ' ✓'))),
        data.epocas.map((ep) => {
          const nos = data.nos.filter((n) => n.epoca === ep.id);
          return h(
            'section',
            { class: `era ${nos.some((n) => isResolved(n.id)) ? 'tocada' : ''}` },
            h('h3', {}, ep.titulo),
            nos.map((n) => itemLinha(n)),
          );
        }),
      );
    }

    function itemLinha(n) {
      const pas = data.passagens[n.passagem];
      if (isResolved(n.id)) {
        const p = n.previsao;
        const dada = S.previsoes[n.id];
        return h(
          'button',
          { class: 'item-linha', onclick: () => abrir(n) },
          h('b', {}, `✓ ${n.titulo}`), ' ', h('span', { class: 'ref' }, fmtRef(pas.osis)),
          p && dada >= 0 && h('div', { class: `prev ${dada === p.correta ? 'acertou' : 'errou'}` }, `Previsão: ${p.opcoes[dada]} ${dada === p.correta ? '✓' : '✗'}`),
        );
      }
      if (isOpen(n.id)) {
        return h(
          'button',
          { class: 'item-linha aberto', onclick: () => abrir(n) },
          h('b', {}, `? ${n.titulo}`),
          h('div', {}, n.pergunta),
          n.previsao && S.previsoes[n.id] == null && h('div', { class: 'ref' }, 'Dá para prever antes de ler'),
        );
      }
      return h('button', { class: 'item-linha oculto', onclick: () => toast('Ainda nenhuma pista leva até aqui.') }, n.silhueta || '? ? ?');
    }

    // ---------------- nós de passagem ----------------
    async function abrir(n) {
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
        const key = await reader({ osis: pas.osis, contexto: pas.contexto, prompt: n.pergunta, select: true, foco: S.foco[n.id] || null });
        if (!key) return render();
        const res = checkEvidence(n, key, S.erros);
        if (res.ok) break;
        if (res.foco) S.foco[n.id] = res.foco;
        prog.save();
        toast(res.msg, 'erro');
      }
      const palavrasAntes = data.palavras.filter(palavraVisivel).map((w) => w.id);
      S.resolvidos.push(n.id);
      prog.save();
      toast.hide();
      buzz(40);
      destaque = new Set(n.pistas.map((p) => p.para).filter((id) => !isResolved(id)));
      render();
      await modal({
        title: `✓ ${n.titulo}`,
        body: h('div', {}, h('div', { class: 'revelacao' }, n.revelacao), previsaoFeita(n), pistasDe(n, true)),
        actions: [{ label: 'Continuar', value: true, primary: true }],
      });
      // Palavras: avisa as que surgiram agora e pergunta a faceta das já visíveis.
      for (const wd of data.palavras) {
        if (!palavraVisivel(wd)) continue;
        const f = wd.facetas.find((x) => x.no === n.id);
        if (!palavrasAntes.includes(wd.id)) {
          await modal({
            title: 'Uma palavra apareceu na constelação',
            body: h('div', {}, h('p', { class: 'heb-grande' }, wd.original), h('p', { class: 'translit' }, wd.transliteracao), h('p', {}, wd.pergunta_inicial)),
            actions: [{ label: 'Ver no mapa', value: true, primary: true }],
          });
        } else if (f) await escolherFaceta(wd, f);
      }
      render();
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
      return h(
        'div',
        {},
        h('h3', {}, novas ? 'Novas pistas' : 'Pistas'),
        h('ul', { class: 'pistas-lista' }, n.pistas.map((p) => {
          const alvo = byId.get(p.para);
          return h('li', {}, h('b', {}, isResolved(p.para) ? alvo.titulo : `? ${alvo.titulo}`), ` (${TIPOS[p.tipo]}): ${p.texto}`);
        })),
      );
    }

    // ---------------- palavras ----------------
    const limiteConferir = (wd) => Math.min(wd.confirmar_apos, wd.facetas.length - confirmadas(wd).length);
    const podeConferir = (wd) => {
      const p = pendentes(wd).length;
      const todasAbertas = wd.facetas.every((f) => isResolved(f.no));
      return p > 0 && (p >= limiteConferir(wd) || (todasAbertas && semEscolha(wd).length === 0));
    };

    async function escolherFaceta(wd, f) {
      const op = await Lab.escolha({
        title: `${wd.transliteracao} em ${fmtRef(data.passagens[byId.get(f.no).passagem].osis)}`,
        intro: h('div', {}, h('p', { class: 'heb-grande', style: 'font-size:44px' }, wd.original), h('p', {}, `Esta passagem usa ${wd.transliteracao}. O que ela revela sobre a palavra?`)),
        opcoes: [...Lab.shuffle([...wd.facetas, ...wd.facetas_distratoras]), { id: null, descricao: 'Decidir depois' }],
        rotulo: (x) => x.descricao,
      });
      if (!op || !op.id) return;
      escolhas(wd)[f.no] = op.id;
      S.erradas[wd.id] = erradas(wd).filter((x) => x !== f.no);
      prog.save();
      if (podeConferir(wd)) toast(`Você já pode conferir as escolhas de ${wd.transliteracao}.`);
    }

    function abrirPalavra(wd) {
      if (!S.palavrasVistas.includes(wd.id)) {
        S.palavrasVistas.push(wd.id);
        prog.save();
      }
      let letraSel = null;
      const corpo = h('div', {});
      const desenhar = () => {
        const L = letraSel != null ? wd.letras[letraSel] : null;
        const ocultas = wd.facetas.filter((f) => !isResolved(f.no)).length;
        Lab.mount(
          corpo,
          h('p', { class: 'heb-grande' }, wd.original),
          h('p', { class: 'translit' }, `${wd.transliteracao} · ${wd.lingua}`),
          h('p', {}, wd.pergunta_inicial),
          h('div', { class: 'letras', 'aria-label': 'Letras, da direita para a esquerda' },
            wd.letras.map((l, i) => h('button', { class: `letra ${l.papel === 'raiz' ? 'raiz' : ''} ${i === letraSel ? 'sel' : ''}`, onclick: () => { letraSel = i === letraSel ? null : i; desenhar(); } },
              h('span', { class: 'g' }, l.glifo), h('span', { class: 'n' }, l.nome)))),
          L
            ? h('div', { class: 'letra-info' },
                h('b', {}, `${L.nome} (${L.glifo})`), ` · som "${L.som}" · valor ${L.valor}`,
                h('div', {}, `Nesta palavra: ${L.papel === 'raiz' ? 'faz parte da raiz' : L.papel}`),
                h('div', { class: 'cur' }, `O nome da letra vem de um desenho antigo: ${L.desenho}. É a origem da letra, não o sentido da palavra.`))
            : h('p', { class: 'muted', style: 'font-size:14px' }, 'Toque numa letra. As de borda destacada formam a raiz.'),
          h('div', { class: 'raiz' },
            h('div', {}, 'Raiz ', h('span', { class: 'heb', dir: 'rtl' }, wd.raiz.letras), ` (${wd.raiz.translit}): `, h('b', {}, wd.raiz.sentido)),
            h('ul', {}, wd.raiz.familia.map((x) => h('li', {}, h('span', { class: 'heb', style: 'font-size:19px' }, x.palavra), ` ${x.translit}: ${x.sentido}`)))),
          h('h3', {}, `Facetas (${confirmadas(wd).length} de ${wd.facetas.length} confirmadas)`),
          wd.facetas.filter((f) => isResolved(f.no)).map((f) => facetaLinha(wd, f, desenhar)),
          ocultas > 0 && h('p', { class: 'muted', style: 'font-size:14px' }, `A palavra aparece em mais ${ocultas} ${ocultas === 1 ? 'passagem' : 'passagens'} que você ainda não encontrou.`),
          !palavraCompleta(wd) &&
            h('div', { class: 'linha', style: 'margin-top:8px' },
              h('button', { class: 'btn primary', disabled: !podeConferir(wd), onclick: () => conferir(wd, desenhar) }, `Conferir escolhas (${pendentes(wd).length})`),
              !podeConferir(wd) && h('span', { class: 'muted', style: 'font-size:13px' }, `As escolhas são conferidas em grupos de ${limiteConferir(wd)}.`)),
          palavraCompleta(wd) && definicao(wd, desenhar),
        );
      };
      desenhar();
      return modal({ title: wd.titulo, body: corpo, actions: [{ label: 'Fechar', value: null, primary: true }] }).then(render);
    }

    function facetaLinha(wd, f, desenhar) {
      const ref = fmtRef(data.passagens[byId.get(f.no).passagem].osis);
      const todas = [...wd.facetas, ...wd.facetas_distratoras];
      const esc = todas.find((x) => x.id === escolhas(wd)[f.no]);
      if (confirmadas(wd).includes(f.id)) return h('div', { class: 'faceta-linha certa' }, h('span', { class: 'desc' }, `✓ ${f.descricao}`), h('span', { class: 'muted' }, ref));
      const errada = erradas(wd).includes(f.no);
      return h(
        'div',
        { class: `faceta-linha ${errada ? 'errada' : ''}` },
        h('span', { class: 'desc' }, h('b', {}, ref), ' ', errada ? `✗ ${esc.descricao}` : esc ? esc.descricao : 'sem escolha'),
        h('button', { class: 'btn', onclick: async () => { await escolherFaceta(wd, f); desenhar(); } }, esc && !errada ? 'Trocar' : 'Escolher'),
      );
    }

    function conferir(wd, desenhar) {
      let ok = 0;
      const lote = pendentes(wd);
      for (const f of lote) {
        if (escolhas(wd)[f.no] === f.id) {
          (S.confirmadas[wd.id] ||= []).push(f.id);
          ok++;
        } else (S.erradas[wd.id] ||= []).push(f.no);
      }
      prog.save();
      buzz(ok === lote.length ? 60 : 15);
      toast(ok === lote.length ? `✓ ${ok} de ${lote.length} confirmadas.` : `${ok} de ${lote.length} certas. As marcadas com ✗ pedem outra leitura.`, ok === lote.length ? 'ok' : 'erro');
      desenhar();
    }

    function definicao(wd, desenhar) {
      if (S.definicoes[wd.id]) {
        return h('div', {}, h('h3', {}, 'Sua definição'), h('p', {}, S.definicoes[wd.id]), h('h3', {}, 'Síntese de referência'), h('div', { class: 'revelacao' }, wd.sintese));
      }
      const t = h('textarea', { rows: 3, placeholder: `Defina ${wd.transliteracao} com suas palavras…` });
      return h('div', {}, h('h3', {}, 'Palavra decifrada'), h('p', {}, 'Antes de ver a síntese, escreva sua própria definição.'), t,
        h('div', { class: 'linha', style: 'margin-top:8px' }, h('button', { class: 'btn primary', onclick: () => {
          if (!t.value.trim()) return toast('Escreva algo antes de comparar.');
          S.definicoes[wd.id] = t.value.trim();
          prog.save();
          desenhar();
        } }, 'Comparar com a síntese')));
    }

    // ---------------- síntese em bloco de dedução ----------------
    function abrirSintese(n) {
      const D = n.deducao;
      const pas = data.passagens[n.passagem];
      const corpo = h('div', {});
      const completa = () => D.frases.every((f) => Object.keys(f.lacunas).every((k) => S.deducao[`${f.id}.${k}`]));
      const certa = () => D.frases.every((f) => Object.entries(f.lacunas).every(([k, v]) => S.deducao[`${f.id}.${k}`] === v));
      return modal({
        title: n.titulo,
        body: corpo,
        actions: [{ label: 'Fechar', value: null }],
        mount: (close) => {
          const desenhar = () => {
            Lab.mount(
              corpo,
              h('p', {}, n.pergunta),
              h('p', { class: 'muted', style: 'font-size:14px' }, 'As três frases só se confirmam juntas.'),
              h('button', { class: 'btn', onclick: () => reader({ osis: pas.osis, contexto: pas.contexto }) }, `Ler ${fmtRef(pas.osis)}`),
              D.frases.map((f) => frase(f)),
              completa() && !certa() && h('p', { class: 'aviso' }, 'As três frases estão preenchidas, mas ainda não se confirmam. Alguma lacuna está errada.'),
            );
          };
          const frase = (f) => {
            const partes = [];
            const re = /\{(\w+)\}/g;
            let last = 0;
            let m;
            while ((m = re.exec(f.modelo))) {
              partes.push(f.modelo.slice(last, m.index));
              const slot = m[1];
              const val = S.deducao[`${f.id}.${slot}`];
              partes.push(h('button', { class: `lacuna ${val ? '' : 'vazia'}`, onclick: () => preencher(f, slot) }, val || '______'));
              last = re.lastIndex;
            }
            partes.push(f.modelo.slice(last));
            return h('p', { class: 'frase' }, partes);
          };
          const preencher = async (f, slot) => {
            const k = `${f.id}.${slot}`;
            const atual = S.deducao[k];
            const termos = h('div', { class: 'termos' }, D.banco_termos.map((t) => h('button', { class: `termo ${t === atual ? 'sel' : ''}`, 'data-t': t }, t)));
            const v = await modal({
              title: 'Escolha um termo',
              body: termos,
              actions: atual ? [{ label: 'Limpar lacuna', value: '' }] : [],
              mount: (fechar) => termos.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) fechar(b.dataset.t); }),
            });
            if (v == null) return;
            if (v) S.deducao[k] = v;
            else delete S.deducao[k];
            if (completa()) {
              const combo = JSON.stringify(S.deducao);
              if (!S.testadas.includes(combo)) S.testadas.push(combo);
            }
            prog.save();
            if (completa() && certa()) {
              close(null);
              return concluirSintese(n);
            }
            desenhar();
          };
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
        title: 'Constelação completa',
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

    // ---------------- layout ----------------
    // Forças determinísticas sobre o grafo inteiro (passagens e palavras), para
    // que nada mude de lugar quando novos nós aparecem.
    function layout() {
      const ids = [...data.nos.map((n) => n.id), ...data.palavras.map(wid)];
      const idx = new Map(ids.map((id, i) => [id, i]));
      const edges = [];
      data.nos.forEach((n) => n.pistas.forEach((p) => edges.push([idx.get(n.id), idx.get(p.para), 210])));
      data.palavras.forEach((w) => w.facetas.forEach((f) => edges.push([idx.get(wid(w)), idx.get(f.no), 170])));
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
  }

  // ======================================================================
  // Utilitários do SVG
  // ======================================================================
  function raio(n) {
    return n.tipo === 'sintese' ? 44 : 32;
  }
  function el(tag, attrs = {}) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  function txt(cls, s) {
    const t = el('text', { class: cls });
    t.textContent = s;
    return t;
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
})();
