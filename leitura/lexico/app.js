// Protótipo 4 — Léxico vivo.
// O jogador encontra a mesma palavra hebraica em vários contextos, anota o que
// ela parece significar e escolhe qual faceta cada ocorrência revela. As escolhas
// são conferidas em lote, e o sentido completo se monta aos poucos.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, fmtRef } = Lab;
  const app = document.getElementById('app');

  Lab.boot({
    proto: 'lexico',
    titulo: 'Léxico vivo',
    pack: '4-lexico.json',
    initial: { palavra: null, lidas: [], notas: {}, escolhas: {}, certas: [], erradas: [], definicoes: {}, convite: false },
  })
    .then(start)
    .catch((e) => {
      console.error(e);
      app.append(h('p', { class: 'erro' }, 'Não consegui carregar o pacote de conteúdo.'));
    });

  function start({ data, prog }) {
    const S = prog.data;
    const byId = new Map(data.palavras.map((w) => [w.id, w]));
    const k = (w, i) => `${w.id}.${i}`;
    const certasDe = (w) => w.ocorrencias.filter((_, i) => S.certas.includes(k(w, i))).length;
    const completa = (w) => certasDe(w) === w.ocorrencias.length;

    render();
    if (!S.convite) convite();

    function render() {
      const w = S.palavra && byId.get(S.palavra);
      Lab.mount(app, w ? telaPalavra(w) : telaInicio());
      window.scrollTo(0, 0);
    }
    function ir(id) {
      S.palavra = id;
      prog.save();
      render();
    }

    function telaInicio() {
      return [
        h('h2', {}, data.pergunta_central),
        ...data.palavras.map((w) => {
          const pct = (certasDe(w) / w.ocorrencias.length) * 100;
          return h(
            'button',
            { class: 'opcao', onclick: () => ir(w.id) },
            h(
              'div',
              { class: 'palavra-card' },
              h('span', { class: 'original' }, w.original),
              h(
                'div',
                { style: 'flex:1' },
                h('b', {}, w.transliteracao),
                completa(w) && h('span', { class: 'tag ok', style: 'margin-left:8px' }, '✓ decifrada'),
                h('div', { class: 'muted', style: 'font-size:14px' }, w.traducoes_comuns.slice(0, 3).join(' · '), '…'),
                h('div', { class: 'barra' }, h('i', { style: `width:${pct}%` })),
              ),
            ),
          );
        }),
      ];
    }

    function telaPalavra(w) {
      const lote = w.confirmar_apos;
      const lotes = [];
      for (let i = 0; i < w.ocorrencias.length; i += lote) lotes.push([i, Math.min(i + lote, w.ocorrencias.length)]);
      const facetasConhecidas = w.facetas.filter((f) => w.ocorrencias.some((o, i) => o.faceta === f.id && S.certas.includes(k(w, i))));
      return [
        h('button', { class: 'btn link', onclick: () => ir(null) }, '← Todas as palavras'),
        h('p', { class: 'original grande' }, w.original),
        h('p', { class: 'translit' }, `${w.transliteracao} · ${w.lingua}`),
        h('div', { class: 'chips' }, w.traducoes_comuns.map((t) => h('span', {}, t))),
        h('p', { class: 'card' }, w.pergunta_inicial),
        h(
          'section',
          { class: 'card saber' },
          h('h3', { style: 'margin:0' }, `O que você já sabe sobre ${w.transliteracao}`),
          h('p', { class: 'muted', style: 'font-size:14px' }, `${facetasConhecidas.length} de ${w.facetas.length} facetas descobertas`),
          facetasConhecidas.length ? h('ul', {}, facetasConhecidas.map((f) => h('li', {}, f.descricao))) : h('p', { class: 'vazio' }, 'Ainda nada confirmado. Leia as ocorrências abaixo.'),
        ),
        ...lotes.map(([a, b], li) => {
          const idx = Array.from({ length: b - a }, (_, j) => a + j);
          const pendentes = idx.filter((i) => !S.certas.includes(k(w, i)));
          const prontas = pendentes.length > 0 && pendentes.every((i) => S.escolhas[k(w, i)] && !S.erradas.includes(k(w, i)));
          return h(
            'section',
            {},
            h(
              'div',
              { class: 'lote' },
              h('h3', { style: 'margin:0' }, `Lote ${li + 1}`),
              pendentes.length === 0
                ? h('span', { class: 'tag ok' }, '✓ conferido')
                : h('button', { class: 'btn primary', disabled: !prontas, onclick: () => conferir(w, idx) }, 'Conferir lote'),
            ),
            idx.map((i) => ocorrencia(w, i)),
          );
        }),
        completa(w) && definicao(w),
      ];
    }

    function ocorrencia(w, i) {
      const o = w.ocorrencias[i];
      const key = k(w, i);
      const certa = S.certas.includes(key);
      const errada = S.erradas.includes(key);
      const escolha = S.escolhas[key] && todasFacetas(w).find((f) => f.id === S.escolhas[key]);
      return h(
        'button',
        { class: `opcao ocor ${certa ? 'certa' : errada ? 'errada' : ''}`, onclick: () => estudar(w, i) },
        h('b', {}, fmtRef(data.passagens[o.passagem].osis)),
        ' ',
        h(
          'span',
          { class: 'estado' },
          certa ? '✓ confirmada' : errada ? '✗ escolha outra faceta' : escolha ? 'aguardando conferência' : S.lidas.includes(key) ? 'lida' : 'não lida',
        ),
        S.notas[key] && h('div', { class: 'nota-sua' }, `Sua nota: ${S.notas[key]}`),
        escolha && !certa && h('div', { style: 'font-size:14px' }, `Faceta: ${escolha.descricao}`),
        certa && h('div', { class: 'revelacao', style: 'font-size:15px' }, o.nota),
      );
    }

    function todasFacetas(w) {
      return [...w.facetas, ...w.facetas_distratoras];
    }

    async function estudar(w, i) {
      const o = w.ocorrencias[i];
      const key = k(w, i);
      const pas = data.passagens[o.passagem];
      await reader({
        osis: pas.osis,
        contexto: pas.contexto,
        prompt: `Procure a palavra que traduz ${w.transliteracao} (pode aparecer como ${w.traducoes_comuns.slice(0, 3).join(', ')}…). O que ela quer dizer aqui?`,
      });
      if (!S.lidas.includes(key)) S.lidas.push(key);
      prog.save();
      if (S.certas.includes(key)) return render();

      const nota = h('textarea', { rows: 2, placeholder: 'Com suas palavras: o que ela parece significar aqui?' });
      nota.value = S.notas[key] || '';
      const op = await Lab.escolha({
        title: `${w.transliteracao} em ${fmtRef(pas.osis)}`,
        intro: h('div', {}, nota, h('p', { class: 'muted', style: 'margin-top:12px' }, 'Qual faceta da palavra esta ocorrência revela?')),
        opcoes: Lab.shuffle(todasFacetas(w)),
        rotulo: (f) => f.descricao,
      });
      if (nota.value.trim()) S.notas[key] = nota.value.trim();
      if (op) {
        S.escolhas[key] = op.id;
        S.erradas = S.erradas.filter((x) => x !== key);
      }
      prog.save();
      render();
    }

    async function conferir(w, idx) {
      const pend = idx.filter((i) => !S.certas.includes(k(w, i)));
      let acertos = 0;
      for (const i of pend) {
        const key = k(w, i);
        if (S.escolhas[key] === w.ocorrencias[i].faceta) {
          S.certas.push(key);
          acertos++;
        } else S.erradas.push(key);
      }
      prog.save();
      buzz(acertos === pend.length ? 60 : 15);
      render();
      if (acertos === pend.length) toast(`✓ ${acertos} de ${pend.length}: lote confirmado.`, 'ok');
      else toast(`${acertos} de ${pend.length} certas. As outras pedem outra leitura.`, 'erro');
      if (completa(w)) setTimeout(() => document.querySelector('.definicao textarea')?.focus(), 300);
    }

    function definicao(w) {
      const feita = S.definicoes[w.id];
      if (feita) {
        return h(
          'section',
          { class: 'card definicao' },
          h('h3', { style: 'margin-top:0' }, 'Sua definição'),
          h('p', {}, feita),
          h('h3', {}, 'Síntese de referência'),
          h('div', { class: 'revelacao' }, w.sintese),
        );
      }
      const t = h('textarea', { rows: 4, placeholder: `Defina ${w.transliteracao} com suas palavras…` });
      return h(
        'section',
        { class: 'card definicao' },
        h('h3', { style: 'margin-top:0' }, 'Palavra decifrada'),
        h('p', {}, `Antes de ver a síntese, escreva sua própria definição de ${w.transliteracao}.`),
        t,
        h('div', { class: 'linha', style: 'margin-top:10px' }, h('button', { class: 'btn primary', onclick: () => salvarDefinicao(w, t.value.trim()) }, 'Comparar com a síntese')),
      );
    }

    async function salvarDefinicao(w, texto) {
      if (!texto) return toast('Escreva algo antes de comparar.');
      S.definicoes[w.id] = texto;
      prog.save();
      render();
      if (data.palavras.every(completa) && data.palavras.every((x) => S.definicoes[x.id])) {
        const r = await modal({
          title: 'Léxico completo',
          body: h('p', {}, 'Você decifrou as três palavras. Quer registrar a sessão no diário agora?'),
          actions: [
            { label: 'Agora não', value: null },
            { label: 'Abrir o diário', value: true, primary: true },
          ],
        });
        if (r) Lab.endSession('lexico');
      }
    }

    function convite() {
      Lab.escolha({ title: data.convite.pergunta, opcoes: data.convite.opcoes, dismissable: false }).then((op) => {
        S.convite = true;
        prog.save();
        if (op && op.leva_a) ir(op.leva_a);
      });
    }
  }
})();
