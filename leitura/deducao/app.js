// Protótipo 3 — Mesa de dedução.
// O jogador lê as cartas (passagens) e completa frases de síntese. Como em
// Return of the Obra Dinn, uma frase nunca é confirmada sozinha: só o bloco
// inteiro de três, quando todas estão certas.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, fmtRef } = Lab;
  const app = document.getElementById('app');
  const DICA_APOS = 3; // combinações erradas num bloco antes de mostrar as cartas de apoio

  Lab.boot({
    proto: 'deducao',
    titulo: 'Mesa de dedução',
    pack: '3-deducao.json',
    initial: { respostas: {}, resolvidos: [], tentativas: {}, testadas: {}, lidas: [], convite: false, aba: 'mesa' },
  })
    .then(start)
    .catch((e) => {
      console.error(e);
      app.append(h('p', { class: 'erro' }, 'Não consegui carregar o pacote de conteúdo.'));
    });

  function start({ data, prog }) {
    const S = prog.data;
    const frases = new Map(data.frases.map((f) => [f.id, f]));
    const cartas = new Map(data.cartas.map((c) => [c.id, c]));
    const blocoDe = (fid) => data.blocos.findIndex((b) => b.frases.includes(fid));

    render();
    if (!S.convite) convite();

    function render() {
      Lab.mount(app, 
        h('p', { class: 'muted' }, data.tema),
        h('h2', {}, data.pergunta_central),
        h(
          'div',
          { class: 'abas' },
          h('button', { class: S.aba === 'mesa' ? 'ativa' : '', onclick: () => setAba('mesa') }, 'Frases'),
          h('button', { class: S.aba === 'cartas' ? 'ativa' : '', onclick: () => setAba('cartas') }, `Cartas (${S.lidas.length}/${data.cartas.length})`),
        ),
        S.aba === 'mesa' ? mesa() : mostrarCartas(),
      );
    }
    function setAba(a) {
      S.aba = a;
      prog.save();
      render();
    }

    function mesa() {
      return h(
        'div',
        {},
        h('p', { class: 'muted' }, 'Toque nas lacunas para preencher. Um bloco só se confirma quando as três frases estiverem certas.'),
        data.blocos.map((b, i) => {
          const ok = S.resolvidos.includes(i);
          const cheio = b.frases.every(completa);
          const erros = S.tentativas[i] || 0;
          return h(
            'section',
            { class: `card bloco ${ok ? 'resolvido' : ''}` },
            h('h3', {}, `Bloco ${i + 1}`, ok ? h('span', { class: 'tag ok' }, '✓ confirmado') : h('span', { class: 'estado-bloco' }, `${b.frases.filter(completa).length}/3 frases completas`)),
            b.frases.map((fid) => frase(frases.get(fid), ok, erros >= DICA_APOS)),
            ok && h('div', { class: 'revelacao' }, b.revelacao),
            !ok && cheio && h('p', { class: 'aviso' }, 'Bloco completo, mas ainda não confirmado. Alguma lacuna está errada.'),
          );
        }),
      );
    }

    function completa(fid) {
      const f = frases.get(fid);
      return Object.keys(f.lacunas).every((k) => S.respostas[`${fid}.${k}`]);
    }

    function frase(f, travado, dica) {
      const partes = [];
      const re = /\{(\w+)\}/g;
      let last = 0;
      let m;
      while ((m = re.exec(f.modelo))) {
        partes.push(f.modelo.slice(last, m.index));
        const slot = m[1];
        const val = S.respostas[`${f.id}.${slot}`];
        partes.push(
          h('button', { class: `lacuna ${val ? '' : 'vazia'}`, disabled: travado, onclick: () => preencher(f, slot) }, val || '______'),
        );
        last = re.lastIndex;
      }
      partes.push(f.modelo.slice(last));
      return h(
        'div',
        {},
        h('p', { class: 'frase' }, partes),
        dica && !travado && h('p', { class: 'apoio' }, 'Apoio: ', f.cartas_base.map((c) => fmtRef(data.passagens[cartas.get(c).passagem].osis)).join(' · ')),
      );
    }

    async function preencher(f, slot) {
      const atual = S.respostas[`${f.id}.${slot}`];
      const body = h(
        'div',
        {},
        h('p', { class: 'muted' }, f.modelo.replace(/\{(\w+)\}/g, (_, k) => (k === slot ? '[ ? ]' : S.respostas[`${f.id}.${k}`] || '___'))),
        h('div', { class: 'termos' }, data.banco_termos.map((t) => h('button', { class: `termo ${t === atual ? 'sel' : ''}`, 'data-t': t }, t))),
      );
      const escolhido = await modal({
        title: 'Escolha um termo',
        body,
        actions: atual ? [{ label: 'Limpar lacuna', value: '' }] : [],
        mount: (close) =>
          body.addEventListener('click', (e) => {
            const b = e.target.closest('[data-t]');
            if (b) close(b.dataset.t);
          }),
      });
      if (escolhido == null) return;
      const k = `${f.id}.${slot}`;
      if (escolhido) S.respostas[k] = escolhido;
      else delete S.respostas[k];
      prog.save();
      conferir(blocoDe(f.id));
    }

    function certa(f) {
      const slots = Object.keys(f.lacunas);
      const dadas = slots.map((k) => S.respostas[`${f.id}.${k}`]);
      if (f.aceita_ordem_livre) {
        const a = dadas.slice().sort();
        const b = slots.map((k) => f.lacunas[k]).sort();
        return a.every((x, i) => x === b[i]);
      }
      return slots.every((k, i) => dadas[i] === f.lacunas[k]);
    }

    async function conferir(i) {
      const b = data.blocos[i];
      if (S.resolvidos.includes(i) || !b.frases.every(completa)) return render();
      if (b.frases.every((fid) => certa(frases.get(fid)))) {
        S.resolvidos.push(i);
        prog.save();
        buzz(60);
        render();
        await modal({ title: `✓ Bloco ${i + 1} confirmado`, body: h('div', { class: 'revelacao' }, b.revelacao), actions: [{ label: 'Continuar', value: true, primary: true }] });
        if (S.resolvidos.length === data.blocos.length) {
          const r = await modal({
            title: 'Caso resolvido',
            body: h('p', {}, 'Todas as frases foram confirmadas. Quer registrar a sessão no diário agora?'),
            actions: [
              { label: 'Agora não', value: null },
              { label: 'Abrir o diário', value: true, primary: true },
            ],
          });
          if (r) Lab.endSession('deducao');
        }
        return;
      }
      // Conta só combinações novas, para não punir quem só troca e destroca.
      const combo = b.frases.map((fid) => Object.keys(frases.get(fid).lacunas).map((k) => S.respostas[`${fid}.${k}`]).join('|')).join('/');
      S.testadas[i] = S.testadas[i] || [];
      if (!S.testadas[i].includes(combo)) {
        S.testadas[i].push(combo);
        S.tentativas[i] = (S.tentativas[i] || 0) + 1;
        if (S.tentativas[i] === DICA_APOS) toast('Dica liberada: cada frase agora mostra as cartas que a sustentam.');
      }
      prog.save();
      render();
    }

    function mostrarCartas() {
      return h(
        'div',
        {},
        h('p', { class: 'muted' }, 'Cada carta é uma passagem. Leia quantas quiser, na ordem que quiser.'),
        h(
          'div',
          { class: 'cartas' },
          data.cartas.map((c) => {
            const lida = S.lidas.includes(c.id);
            return h(
              'button',
              { class: `carta ${lida ? 'lida' : ''}`, onclick: () => lerCarta(c) },
              h('b', {}, fmtRef(data.passagens[c.passagem].osis)),
              h('span', { class: 'muted', style: 'font-size:13px' }, lida ? '✓ lida' : 'não lida'),
            );
          }),
        ),
      );
    }

    async function lerCarta(c) {
      const pas = data.passagens[c.passagem];
      await reader({ osis: pas.osis, contexto: pas.contexto });
      if (!S.lidas.includes(c.id)) {
        S.lidas.push(c.id);
        prog.save();
      }
      render();
    }

    function convite() {
      Lab.escolha({ title: data.convite.pergunta, opcoes: data.convite.opcoes, dismissable: false }).then(async (op) => {
        S.convite = true;
        prog.save();
        if (op && op.leva_a) {
          await lerCarta(cartas.get(op.leva_a));
          setAba('mesa');
        }
      });
    }
  }
})();
