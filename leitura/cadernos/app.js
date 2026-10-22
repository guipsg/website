// Protótipo 2 — Cadernos.
// As pistas vêm das anotações de um estudioso fictício. O jogador lê a passagem,
// marca o versículo e decide se ele confirma, corrige ou completa a anotação.
(() => {
  'use strict';
  const { h, modal, toast, buzz, reader, checkEvidence, fmtRef } = Lab;
  const app = document.getElementById('app');
  const ESTADOS = { pergunta: 'Pergunta', hipotese: 'Hipótese', interrompida: 'Interrompida' };
  const ACOES = { confirmar: 'Confirma', corrigir: 'Corrige', completar: 'Completa' };
  const FEITO = { confirmar: 'confirmada', corrigir: 'corrigida', completar: 'completada' };

  Lab.boot({
    proto: 'cadernos',
    titulo: 'Cadernos',
    pack: '2-cadernos.json',
    initial: { resolvidas: [], vistas: [], erros: {}, foco: {}, convite: false, final: '' },
  })
    .then(start)
    .catch((e) => {
      console.error(e);
      app.append(h('p', { class: 'erro' }, 'Não consegui carregar o pacote de conteúdo.'));
    });

  function start({ data, prog }) {
    const S = prog.data;
    const byId = new Map(data.anotacoes.map((a) => [a.id, a]));
    const isDone = (id) => S.resolvidas.includes(id);
    const isVisible = (a) => a.inicial || data.anotacoes.some((b) => isDone(b.id) && b.libera.includes(a.id));

    render();
    if (!S.convite) convite();

    function render() {
      const visiveis = data.anotacoes.filter(isVisible);
      const pendentes = visiveis.filter((a) => !isDone(a.id));
      const feitas = visiveis.filter((a) => isDone(a.id));
      const fin = data.pergunta_final;
      const finalPronta = fin.requer.every(isDone);
      Lab.mount(app, 
        h('h2', {}, data.estudioso.nome),
        h('details', { class: 'card estudioso', open: S.resolvidas.length === 0 }, h('summary', {}, 'Sobre os cadernos'), h('p', {}, data.estudioso.apresentacao)),
        h('p', { class: 'muted' }, `${S.resolvidas.length} de ${data.anotacoes.length} anotações resolvidas`),
        finalPronta && pagFinal(),
        pendentes.map(pagina),
        feitas.length > 0 && h('h3', {}, 'Já resolvidas'),
        feitas.map(pagina),
      );
    }

    function pagina(a) {
      const done = isDone(a.id);
      const nova = !done && !S.vistas.includes(a.id);
      return h(
        'button',
        { class: `pagina ${done ? 'feita' : ''}`, onclick: () => abrir(a) },
        h(
          'div',
          { class: 'topo-pag' },
          h('span', { class: 'tag' }, ESTADOS[a.estado]),
          nova && h('span', { class: 'tag novo' }, 'nova página'),
          done && h('span', { class: 'tag ok' }, `✓ ${FEITO[a.acao_esperada]}`),
          h('span', { class: 'muted', style: 'font-size:13px' }, fmtRef(data.passagens[a.passagem].osis)),
        ),
        h('p', { class: `manuscrito ${done && a.acao_esperada === 'corrigir' ? 'riscado' : ''}` }, a.texto),
        done && h('div', { class: 'revelacao' }, a.revelacao),
        done && a.nota_do_estudioso_depois &&
          h('div', { class: 'depois' }, h('div', { class: 'rot' }, 'Anotação posterior do professor'), h('p', { class: 'manuscrito' }, a.nota_do_estudioso_depois)),
      );
    }

    function pagFinal() {
      const fin = data.pergunta_final;
      return h(
        'button',
        { class: 'pagina ultima', onclick: abrirFinal },
        h('div', { class: 'topo-pag' }, h('span', { class: 'tag novo' }, 'última página'), S.final && h('span', { class: 'tag ok' }, '✓ escrita')),
        h('p', { class: 'manuscrito' }, fin.texto),
      );
    }

    async function abrir(a) {
      if (!S.vistas.includes(a.id)) {
        S.vistas.push(a.id);
        prog.save();
      }
      const pas = data.passagens[a.passagem];
      if (isDone(a.id)) {
        const r = await modal({
          title: `${ESTADOS[a.estado]} · ${fmtRef(pas.osis)}`,
          body: h('div', {}, h('p', { class: 'manuscrito' }, a.texto), h('div', { class: 'revelacao' }, a.revelacao)),
          actions: [
            { label: 'Reler a passagem', value: 'ler' },
            { label: 'Fechar', value: null, primary: true },
          ],
        });
        if (r === 'ler') await reader({ osis: pas.osis, contexto: pas.contexto });
        return render();
      }
      render();
      const r = await modal({
        title: ESTADOS[a.estado],
        body: h('div', {}, h('p', { class: 'manuscrito' }, a.texto), h('p', { class: 'muted' }, `O professor deixou a referência: ${fmtRef(pas.osis)}.`)),
        actions: [
          { label: 'Depois', value: null },
          { label: 'Ir ao texto', value: 'ler', primary: true },
        ],
      });
      if (r === 'ler') investigar(a);
    }

    async function investigar(a) {
      const pas = data.passagens[a.passagem];
      let key = null;
      for (;;) {
        if (!key) {
          key = await reader({
            osis: pas.osis,
            contexto: pas.contexto,
            prompt: `Anotação: "${a.texto}" Marque o versículo que responde a ela.`,
            select: true,
            foco: S.foco[a.id] || null,
          });
          if (!key) return;
          const res = checkEvidence(a, key, S.erros);
          if (!res.ok) {
            if (res.foco) S.foco[a.id] = res.foco;
            prog.save();
            toast(res.msg, 'erro');
            key = null;
            continue;
          }
        }
        // Versículo certo: agora, o que ele faz com a anotação?
        const acao = await escolherAcao(a, key);
        if (!acao) return;
        if (acao === a.acao_esperada) break;
        S.erros[a.id] = (S.erros[a.id] || 0) + 1;
        prog.save();
        toast('O versículo é esse, mas releia a anotação: o texto confirma, corrige ou completa o que o professor escreveu?', 'erro');
      }
      S.resolvidas.push(a.id);
      prog.save();
      toast.hide();
      buzz(40);
      const liberadas = a.libera.filter((id) => !isDone(id) && !S.vistas.includes(id));
      render();
      await modal({
        title: `✓ Anotação ${FEITO[a.acao_esperada]}`,
        body: h(
          'div',
          {},
          h('div', { class: 'revelacao' }, a.revelacao),
          a.nota_do_estudioso_depois && h('div', { class: 'depois' }, h('div', { class: 'rot' }, 'Logo abaixo, o professor escreveu depois:'), h('p', { class: 'manuscrito' }, a.nota_do_estudioso_depois)),
          liberadas.length > 0 && h('p', { class: 'aviso' }, liberadas.length === 1 ? 'Uma página nova se soltou do caderno.' : `${liberadas.length} páginas novas se soltaram do caderno.`),
        ),
        actions: [{ label: 'Voltar ao caderno', value: true, primary: true }],
      });
      render();
    }

    async function escolherAcao(a, key) {
      const op = await Lab.escolha({
        title: 'O que o texto faz com a anotação?',
        intro: h('div', {}, h('p', { class: 'manuscrito' }, a.texto), h('p', {}, `Você marcou ${fmtRef(key)}. Esse versículo…`)),
        opcoes: Object.entries(ACOES).map(([k, rot]) => ({ k, texto: `${rot} a anotação` })),
      });
      return op && op.k;
    }

    async function abrirFinal() {
      const fin = data.pergunta_final;
      if (S.final) return mostrarComparacao();
      const t = h('textarea', { rows: 7, placeholder: 'Escreva com suas palavras…' });
      const r = await modal({
        title: 'A última página',
        body: h('div', {}, h('p', { class: 'manuscrito' }, fin.texto), t),
        actions: [
          { label: 'Depois', value: null },
          { label: 'Guardar no caderno', value: () => t.value.trim(), primary: true },
        ],
      });
      if (!r) return;
      S.final = r;
      prog.save();
      render();
      await mostrarComparacao();
      const d = await modal({
        title: 'Caderno completo',
        body: h('p', {}, 'Quer registrar a sessão no diário agora?'),
        actions: [
          { label: 'Agora não', value: null },
          { label: 'Abrir o diário', value: true, primary: true },
        ],
      });
      if (d) Lab.endSession('cadernos');
    }

    function mostrarComparacao() {
      return modal({
        title: 'Sua resposta e a síntese',
        body: h(
          'div',
          { class: 'comparacao' },
          h('div', {}, h('b', {}, 'Você escreveu'), h('p', { class: 'manuscrito' }, S.final)),
          h('div', {}, h('b', {}, 'Síntese de referência'), h('p', {}, data.pergunta_final.sintese)),
        ),
      });
    }

    function convite() {
      Lab.escolha({ title: data.convite.pergunta, opcoes: data.convite.opcoes, dismissable: false }).then((op) => {
        S.convite = true;
        prog.save();
        if (op && op.leva_a) abrir(byId.get(op.leva_a));
      });
    }
  }
})();
