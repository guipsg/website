// Protótipo 5 — Linha da promessa.
// Uma linha do tempo em que só a época atual está aberta e a próxima aparece
// como silhueta. Antes de abrir cada época, o jogador prevê o que ela vai trazer.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, checkEvidence, fmtRef } = Lab;
  const app = document.getElementById('app');

  Lab.boot({
    proto: 'promessa',
    titulo: 'Linha da promessa',
    pack: '5-promessa.json',
    initial: { resolvidas: [], previsoes: {}, erros: {}, foco: {}, silhuetas: false, convite: false },
  })
    .then(start)
    .catch((e) => {
      console.error(e);
      app.append(h('p', { class: 'erro' }, 'Não consegui carregar o pacote de conteúdo.'));
    });

  function start({ data, prog }) {
    const S = prog.data;
    const E = data.epocas;
    const isDone = (i) => S.resolvidas.includes(E[i].id);
    const previsaoPendente = (i) => isDone(i) && E[i].previsao && S.previsoes[E[i].id] == null;
    // Época atual: a primeira não resolvida, desde que a previsão anterior esteja feita.
    const atual = () => {
      const i = E.findIndex((_, j) => !isDone(j));
      if (i === -1) return -1;
      return i > 0 && previsaoPendente(i - 1) ? -2 : i;
    };

    render();
    if (!S.convite) convite();

    function render() {
      const cur = atual();
      Lab.mount(app, 
        h('p', { class: 'muted' }, data.tema),
        h('h2', {}, data.pergunta_central),
        h('p', { class: 'muted' }, `${S.resolvidas.length} de ${E.length} épocas abertas`),
        h('div', { class: 'linha-tempo' }, E.map((ep, i) => epoca(ep, i, cur))),
      );
    }

    function epoca(ep, i, cur) {
      const pas = data.passagens[ep.passagem];
      if (isDone(i)) {
        const p = ep.previsao;
        const dada = S.previsoes[ep.id];
        return h(
          'div',
          { class: 'epoca feita' },
          h(
            'div',
            { class: 'card' },
            h('h3', {}, ep.titulo),
            h('div', { class: 'muted', style: 'font-size:14px' }, fmtRef(pas.osis)),
            h('div', { class: 'revelacao' }, ep.acrescimo),
            h('button', { class: 'btn link', onclick: () => reader({ osis: pas.osis, contexto: pas.contexto }) }, 'Reler a passagem'),
            p && dada != null && h('p', { class: `prev ${dada === p.correta ? 'acertou' : 'errou'}` }, `Sua previsão para a próxima: "${p.opcoes[dada]}" ${dada === p.correta ? '✓' : '✗'}`),
            previsaoPendente(i) && h('button', { class: 'btn primary', onclick: () => prever(i) }, 'Fazer a previsão da próxima época'),
          ),
        );
      }
      if (i === cur) {
        return h(
          'div',
          { class: 'epoca atual' },
          h(
            'div',
            { class: 'card' },
            h('h3', {}, ep.titulo),
            i > 0 && E[i - 1].silhueta_da_proxima && h('p', { class: 'muted' }, h('i', {}, E[i - 1].silhueta_da_proxima)),
            h('p', {}, `Leia ${fmtRef(pas.osis)} e marque o versículo em que a promessa aparece nesta época.`),
            h('button', { class: 'btn primary', onclick: () => abrir(i) }, 'Abrir época'),
          ),
        );
      }
      // Futuro: silhueta (dita pela época anterior) ou só interrogação.
      const sil = i > 0 && (isDone(i - 1) || S.silhuetas) ? E[i - 1].silhueta_da_proxima : null;
      return h('div', { class: `epoca silhueta ${sil ? '' : 'oculta'}` }, h('div', { class: 'card' }, sil || '? ? ?'));
    }

    async function abrir(i) {
      const ep = E[i];
      const pas = data.passagens[ep.passagem];
      for (;;) {
        const key = await reader({
          osis: pas.osis,
          contexto: pas.contexto,
          title: `${ep.titulo} · ${fmtRef(pas.osis)}`,
          prompt: 'Marque o versículo em que a promessa aparece nesta época.',
          select: true,
          foco: S.foco[ep.id] || null,
        });
        if (!key) return;
        const res = checkEvidence(ep, key, S.erros);
        if (res.ok) break;
        if (res.foco) S.foco[ep.id] = res.foco;
        prog.save();
        toast(res.msg, 'erro');
      }
      S.resolvidas.push(ep.id);
      prog.save();
      toast.hide();
      buzz(40);
      render();
      await modal({
        title: `✓ ${ep.titulo}`,
        body: h('div', {}, h('p', { class: 'muted' }, 'O que a promessa ganha aqui:'), h('div', { class: 'revelacao' }, ep.acrescimo)),
        actions: [{ label: ep.previsao ? 'Olhar a próxima silhueta' : 'Continuar', value: true, primary: true }],
      });
      if (ep.previsao) return prever(i);
      render();
      const r = await modal({
        title: 'Fim da linha',
        body: h('p', {}, `Você atravessou as ${E.length} épocas e acertou ${acertos()} de ${E.filter((e) => e.previsao).length} previsões. Quer registrar a sessão no diário agora?`),
        actions: [
          { label: 'Agora não', value: null },
          { label: 'Abrir o diário', value: true, primary: true },
        ],
      });
      if (r) Lab.endSession('promessa');
    }

    async function prever(i) {
      const ep = E[i];
      const p = ep.previsao;
      const op = await Lab.escolha({
        title: 'Antes de abrir a próxima época',
        intro: h('div', {}, h('p', { class: 'aviso' }, h('i', {}, ep.silhueta_da_proxima)), h('p', {}, p.pergunta)),
        opcoes: p.opcoes.map((texto, idx) => ({ texto, idx })),
      });
      if (!op) return render();
      S.previsoes[ep.id] = op.idx;
      prog.save();
      const certo = op.idx === p.correta;
      render();
      await modal({
        title: certo ? '✓ Você previu certo' : 'Não exatamente',
        body: h('div', {}, !certo && h('p', {}, `A resposta: ${p.opcoes[p.correta]}.`), h('div', { class: 'revelacao' }, p.retorno)),
        actions: [{ label: 'Seguir na linha', value: true, primary: true }],
      });
      render();
    }

    function acertos() {
      return E.filter((e) => e.previsao && S.previsoes[e.id] === e.previsao.correta).length;
    }

    function convite() {
      Lab.escolha({ title: data.convite.pergunta, opcoes: data.convite.opcoes, dismissable: false }).then((op) => {
        S.convite = true;
        if (op && !op.leva_a) S.silhuetas = true;
        prog.save();
        render();
      });
    }
  }
})();
