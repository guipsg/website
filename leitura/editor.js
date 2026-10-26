// Editor de estudos: monta o mapa de perguntas na mesma lousa do jogo. Toque
// num nó para editar, arraste para mover, "Ligar a outro nó" cria uma pista.
// Cada mudança fica salva no aparelho; Testar joga o rascunho e Exportar gera o
// arquivo para compartilhar.
(() => {
  'use strict';
  const { h, modal, toast, fmtRef } = Lab;
  const { TIPOS, raio, txt, selo, linha2, noSvg, rotulo } = Desenho;
  const el = Lousa.el;
  const TIPOS_NO = { inicio: 'Início: aberto desde o começo', pergunta: 'Pergunta: aberta por uma pista', sintese: 'Síntese: junta outras perguntas' };
  const ICONES = { inicio: '▶', pergunta: '?', sintese: '✦' };
  const DESCRICAO_PISTA = {
    tema: 'Tema: os dois textos tratam do mesmo assunto',
    citacao: 'Citação: um texto cita o outro',
    alusao: 'Alusão: um texto lembra o outro sem citar',
    mesma_palavra: 'Mesma palavra: o mesmo termo no original',
  };

  let E = null; // estudo em edição
  let ctx = null; // lousa, topo e navegação, vindos do app
  let ligando = null; // id do nó de onde sai a pista que está sendo criada
  let soltouEm = 0; // fim do último arrasto de nó, para não abrir o painel junto
  let ouvindoVazio = false;

  function abrir(estudo, contexto) {
    ctx = contexto;
    E = Estudos.preparar(estudo);
    // Congela as posições automáticas para nada pular quando o grafo muda.
    const P = Desenho.posicoes(E);
    const fixar = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });
    for (const n of E.nos) n.pos ||= fixar(P[n.id]);
    for (const w of E.palavras) w.pos ||= fixar(P[`w:${w.id}`]);
    salvar();
    ligando = null;
    ctx.usarTela({ tipo: 'editor', enquadrar, voltar: sair });
    ligarBarra();
    render();
    enquadrar();
  }

  const salvar = () => Estudos.salvar(E, 'meu');
  const nome = (n) => n.titulo?.trim() || 'nó sem título';
  const porId = (id) => E.nos.find((n) => n.id === id);

  function sair() {
    ligando = null;
    ctx.temas(E.id);
  }

  function enquadrar() {
    if (!E.nos.length) return ctx.lousa.enquadrar({ x: -200, y: -200, w: 400, h: 400 }, 120);
    const xs = E.nos.map((n) => n.pos.x);
    const ys = E.nos.map((n) => n.pos.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    ctx.lousa.enquadrar({ x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 + 40 }, 160);
  }

  function ligarBarra() {
    const acoes = { novo: novoNo, estudo: painelEstudo, verificar, testar, exportar };
    ctx.$('#barra-editor').querySelectorAll('[data-acao]').forEach((b) => (b.onclick = () => acoes[b.dataset.acao]()));
    if (ouvindoVazio) return;
    ouvindoVazio = true;
    // Tocar no vazio cancela a ligação em andamento.
    ctx.lousa.svg.addEventListener('click', (e) => {
      if (!ligando || e.target.closest('.no')) return;
      ligando = null;
      render();
      toast('Ligação cancelada.');
    });
  }

  // ======================================================================
  // Mapa
  // ======================================================================
  function render() {
    const { erros, avisos } = Estudos.validar(E);
    ctx.hud(E.titulo?.trim() || 'Estudo sem título', `Editando · ${erros.length} ${erros.length === 1 ? 'erro' : 'erros'} · ${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}`, true);
    document.body.classList.add('editando');
    ctx.$('#barra-editor').hidden = false;
    ctx.$('#verificar').classList.toggle('tem-erro', erros.length > 0);
    desenhar(new Set(erros.map((x) => x.no).filter(Boolean)));
    const info = ctx.$('#info');
    if (ligando) {
      Lab.mount(info, h('p', {}, `Nova pista saindo de "${nome(porId(ligando))}". Toque no nó que ela abre.`),
        h('button', { class: 'btn', onclick: () => { ligando = null; render(); } }, 'Cancelar'));
      info.hidden = false;
    } else info.hidden = true;
  }

  function desenhar(comErro = new Set()) {
    const L = ctx.lousa;
    L.limpar();
    Desenho.garantirDefs(L);
    const M = L.mundo;
    const P = Desenho.posicoes(E);
    // Palavras (vindas de um estudo duplicado) aparecem, mas ainda não se editam aqui.
    for (const w of E.palavras) {
      for (const f of w.facetas) if (porId(f.no)) M.append(linha2(P[`w:${w.id}`], P[f.no], 40, raio(porId(f.no)) + 4, 'aresta e-palavra'));
    }
    for (const n of E.nos) {
      for (const p of n.pistas) {
        const alvo = porId(p.para);
        if (!alvo) continue;
        const ln = linha2(n.pos, alvo.pos, raio(n), raio(alvo) + 6, `aresta e-${p.tipo}`);
        ln.setAttribute('marker-end', `url(#seta-${p.tipo})`);
        M.append(ln);
      }
    }
    for (const w of E.palavras) {
      const g = noSvg(P[`w:${w.id}`], ['no', 'palavra'], `Palavra ${w.transliteracao}`, () => Date.now() - soltouEm > 300 && toast('As palavras ainda não se editam aqui, mas dá para arrastar.'));
      g.addEventListener('pointerdown', (e) => arrastar(e, w));
      g.append(el('rect', { x: -44, y: -32, width: 88, height: 64, rx: 14 }));
      g.append(txt('icone', w.original.replace(/[\u0591-\u05C7]/g, '')));
      rotulo(g, w.transliteracao, 32);
      M.append(g);
    }
    for (const n of E.nos) {
      const g = noSvg(n.pos, ['no', 'edicao', `tipo-${n.tipo}`, n.tipo === 'sintese' ? 'sintese' : '', ligando === n.id ? 'origem' : ''], `${nome(n)}, ${n.tipo}`, () => tocar(n));
      g.append(el('circle', { r: raio(n) }));
      g.append(txt('icone', ICONES[n.tipo]));
      rotulo(g, n.titulo?.trim() || 'sem título', raio(n));
      if (comErro.has(n.id)) selo(g, raio(n) * 0.75, -raio(n) * 0.75, '⚠', 'erro');
      g.addEventListener('pointerdown', (e) => arrastar(e, n));
      M.append(g);
    }
  }

  function tocar(n) {
    if (Date.now() - soltouEm < 300) return;
    if (ligando) return ligar(n);
    painelNo(n);
  }

  // Arrastar um nó (ou palavra) o muda de lugar; o quadro só se move arrastando o vazio.
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

  function novoNo() {
    // O lugar livre mais perto do centro da vista, em anéis ao redor dele.
    const c = ctx.lousa.centro();
    let p = null;
    for (let r = 0; !p; r += 140) {
      const passos = r ? Math.round((2 * Math.PI * r) / 140) : 1;
      for (let i = 0; i < passos && !p; i++) {
        const q = { x: Math.round(c.x + r * Math.cos((i / passos) * 2 * Math.PI)), y: Math.round(c.y + r * Math.sin((i / passos) * 2 * Math.PI)) };
        if (!E.nos.some((n) => Math.hypot(n.pos.x - q.x, n.pos.y - q.y) < 130)) p = q;
      }
    }
    let k = E.nos.length + 1;
    while (porId(`n${k}`)) k++;
    const n = { id: `n${k}`, tipo: E.nos.some((x) => x.tipo === 'inicio') ? 'pergunta' : 'inicio', titulo: '', pergunta: '', passagem: '', evidencia: [], revelacao: '', pistas: [], pos: p };
    E.nos.push(n);
    salvar();
    render();
    if (!ctx.lousa.contem(p.x, p.y, 80)) enquadrar();
    painelNo(n);
  }

  async function ligar(alvo) {
    const origem = porId(ligando);
    ligando = null;
    render();
    if (!origem || origem.id === alvo.id) return toast('Uma pista liga dois nós diferentes.');
    if (origem.pistas.some((p) => p.para === alvo.id)) return toast('Já existe uma pista entre esses nós.');
    const tipo = await Lab.escolha({
      title: `Pista para "${nome(alvo)}"`,
      intro: h('p', {}, 'Que ligação leva de um texto ao outro?'),
      opcoes: Object.keys(TIPOS).map((k) => ({ k, texto: DESCRICAO_PISTA[k] })),
    });
    if (!tipo) return;
    const campo = h('textarea', { rows: 3, 'aria-label': 'Texto da pista', placeholder: 'Ex.: Jesus diz ser senhor do sábado. Onde o sábado começou?' });
    const r = await modal({
      title: 'Texto da pista',
      body: h('div', { class: 'form' }, h('p', { class: 'guia' }, 'O que, no texto já lido, faz querer abrir o próximo? Sugira sem entregar a resposta.'), campo),
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Criar pista', value: () => ({ texto: campo.value.trim() }), primary: true },
      ],
    });
    if (!r) return;
    origem.pistas.push({ para: alvo.id, tipo: tipo.k, texto: r.texto });
    salvar();
    render();
    toast(`Pista criada: "${nome(origem)}" → "${nome(alvo)}".`, 'ok');
  }

  // ======================================================================
  // Painéis
  // ======================================================================
  const campo = (rotuloTxt, guia, ...kids) => h('div', { class: 'campo' }, h('span', { class: 'rotulo' }, rotuloTxt), guia && h('span', { class: 'guia' }, guia), ...kids);
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

  function painelNo(n) {
    let fechar = () => {};
    const pas = () => E.passagens[n.passagem];
    const mudou = () => {
      salvar();
      render();
    };

    // Passagem e contexto: cada nó tem a sua, guardada em passagens["p_<id>"].
    const statusRef = h('span', { class: 'status' });
    const statusCtx = h('span', { class: 'status' });
    const ref = h('input', { type: 'text', placeholder: 'Gn 2:1-3', 'aria-label': 'Passagem' });
    ref.value = pas() ? pas().ref || fmtRef(pas().osis) : '';
    const ctxIn = h('input', { type: 'text', placeholder: 'Gn 1:1–2:3 (opcional)', 'aria-label': 'Contexto' });
    ctxIn.value = pas()?.contexto ? fmtRef(pas().contexto) : '';
    const status = (s, ok, msg) => {
      s.textContent = msg;
      s.className = `status ${ok ? 'ok' : 'erro'}`;
    };
    const lerRef = (mudar) => {
      const t = ref.value.trim();
      if (!t) return status(statusRef, false, 'Escreva onde está a resposta.');
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
      atualizarTexto();
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

    // Evidência e dica: marcadas tocando nos versículos, no próprio leitor.
    const secTexto = h('div', {});
    const atualizarTexto = () => {
      const p = pas();
      const fora = (n.evidencia || []).filter((v) => p && !Lab.inRange(v, p.osis));
      Lab.mount(
        secTexto,
        campo('Evidência', 'Os versículos que respondem. Qualquer um deles conta como acerto.',
          h('p', { class: 'valor' }, n.evidencia?.length ? n.evidencia.map(fmtRef).join(', ') : 'Nenhum versículo marcado.'),
          fora.length > 0 && h('p', { class: 'status erro' }, `Fora da passagem: ${fora.map(fmtRef).join(', ')}. Marque de novo.`),
          h('button', { class: 'btn', type: 'button', disabled: !p, onclick: marcarEvidencia }, 'Marcar no texto')),
        campo('Dica (opcional)', 'Depois de dois erros, o leitor destaca este trecho.',
          h('p', { class: 'valor' }, n.dica ? fmtRef(n.dica) : 'Sem dica.'),
          h('div', { class: 'linha' },
            h('button', { class: 'btn', type: 'button', disabled: !p, onclick: marcarDica }, 'Marcar trecho'),
            n.dica && h('button', { class: 'btn', type: 'button', onclick: () => { delete n.dica; mudou(); atualizarTexto(); } }, 'Remover dica'))),
      );
    };
    async function marcarEvidencia() {
      const p = pas();
      const r = await Lab.reader({ osis: p.osis, title: 'Evidência', prompt: n.pergunta || 'Quais versículos respondem à pergunta?', varios: true, marcados: (n.evidencia || []).filter((v) => Lab.inRange(v, p.osis)) });
      if (!r) return;
      n.evidencia = r;
      mudou();
      atualizarTexto();
    }
    async function marcarDica() {
      const p = pas();
      // A dica antiga só volta marcada se ainda couber na passagem.
      const r0 = n.dica && Lab.parseRange(n.dica);
      const cabe = r0 && Lab.inRange(`${r0.book}.${r0.from.ch}.${r0.from.v}`, p.osis) && Lab.inRange(`${r0.book}.${r0.to.ch}.${r0.to.v}`, p.osis);
      const r = await Lab.reader({ osis: p.osis, title: 'Dica', prompt: 'Toque no primeiro e no último versículo do trecho que a dica destaca.', faixa: true, marcados: cabe ? n.dica : null });
      if (!r) return;
      n.dica = r;
      mudou();
      atualizarTexto();
    }
    atualizarTexto();

    // Previsão: opcional, guardada só quando algo foi escrito.
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

    // Requisitos da síntese.
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
        }) : h('p', { class: 'valor' }, 'Ainda não há outros nós.')));
    };
    atualizarRequer();

    // Pistas que saem deste nó.
    const secPistas = h('div', {});
    const atualizarPistas = () => Lab.mount(
      secPistas,
      campo('Pistas', 'Cada pista abre outro nó quando este é entendido.',
        n.pistas.map((p, i) => {
          const alvo = porId(p.para);
          const texto = entrada(p, 'texto', { rotuloAria: `Texto da pista para ${alvo ? nome(alvo) : 'nó apagado'}`, ph: 'Texto da pista' });
          return h('div', { class: 'pista-item' },
            h('div', { class: 'linha' }, h('b', {}, `→ ${alvo ? nome(alvo) : 'nó que não existe mais'}`),
              h('button', { class: 'btn link', type: 'button', onclick: () => { n.pistas.splice(i, 1); mudou(); atualizarPistas(); } }, 'Remover')),
            seletor(Object.keys(TIPOS).map((k) => [k, DESCRICAO_PISTA[k]]), p.tipo, (v) => { p.tipo = v; mudou(); }, 'Tipo da pista'),
            texto);
        }),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          fechar(null);
          ligando = n.id;
          render();
        } }, 'Ligar a outro nó')),
    );
    atualizarPistas();

    const corpo = h('div', { class: 'form' },
      campo('Tipo', null, seletor(Object.entries(TIPOS_NO), n.tipo, (v) => { n.tipo = v; mudou(); atualizarRequer(); }, 'Tipo do nó')),
      campo('Título', 'Curto: aparece no mapa.', entrada(n, 'titulo', { ph: 'O sétimo dia', rotuloAria: 'Título' })),
      campo('Pergunta', 'O que a pessoa vai procurar no texto. Perguntas de "por quê" e "como" despertam mais curiosidade que as de fato.', entrada(n, 'pergunta', { linhas: 2, rotuloAria: 'Pergunta', ph: 'Por que Deus descansou, se não se cansa?' })),
      campo('Passagem', 'Onde está a resposta. Ex.: Gn 2:1-3 ou Mc 2:23–3:6.', ref, statusRef),
      campo('Contexto (opcional)', 'Um trecho maior que a pessoa pode abrir para ver o entorno.', ctxIn, statusCtx),
      secTexto,
      campo('Revelação', 'O que a pessoa entende ao achar a resposta. Aparece só depois do acerto.', entrada(n, 'revelacao', { linhas: 4, rotuloAria: 'Revelação' })),
      campo('Retorno ao errar (opcional)', 'O que dizer quando a pessoa marca outro versículo.', entrada(n, 'retorno_erro', { rotuloAria: 'Retorno ao errar', ph: 'Esse trecho fala de outra coisa.' })),
      h('details', { class: 'campo', open: n.previsao ? true : null },
        h('summary', {}, 'Previsão (opcional)'),
        h('span', { class: 'guia' }, 'Antes de ler, a pessoa aposta numa resposta. Errar não custa nada e deixa a leitura mais atenta.'),
        prevPergunta, prevOpcoes, h('span', { class: 'guia' }, 'Opção certa:'), prevCorreta, prevRetorno),
      secRequer,
      secPistas,
      h('button', { class: 'btn perigo', type: 'button', onclick: () => excluirNo(n, fechar) }, 'Excluir nó'),
    );
    modal({
      title: nome(n) === 'nó sem título' ? 'Novo nó' : nome(n),
      body: corpo,
      actions: [{ label: 'Fechar', value: null, primary: true }],
      focar: !n.titulo, // num nó que já existe, o teclado do celular não abre sozinho
      mount: (close) => (fechar = close),
    }).then(() => render());
  }

  async function excluirNo(n, fecharPainel) {
    const chegam = E.nos.filter((x) => x.pistas.some((p) => p.para === n.id)).length;
    const r = await modal({
      title: `Excluir "${nome(n)}"?`,
      body: h('p', {}, chegam ? `${chegam} ${chegam === 1 ? 'pista que chega' : 'pistas que chegam'} nele também ${chegam === 1 ? 'sai' : 'saem'}.` : 'Nenhuma pista chega nele.'),
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
    fecharPainel(null);
    render();
  }

  function painelEstudo() {
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
      ),
      actions: [{ label: 'Fechar', value: null, primary: true }],
    }).then(() => render());
  }

  function verificar() {
    const { erros, avisos } = Estudos.validar(E);
    let fechar = () => {};
    const item = (x, tipo) => h('button', { class: `opcao verif ${tipo}`, onclick: () => {
      fechar(null);
      const n = x.no && porId(x.no);
      n ? painelNo(n) : painelEstudo();
    } }, `${tipo === 'erro' ? '✗' : '△'} ${x.msg}`);
    modal({
      title: 'Verificar',
      body: h('div', {},
        erros.length ? h('h3', {}, `Erros (${erros.length})`) : h('p', { class: 'status ok' }, '✓ Nenhum erro: o estudo pode ser testado e exportado.'),
        erros.length > 0 && h('p', { class: 'guia' }, 'Erros impedem testar e exportar. Toque num erro para ir até ele.'),
        erros.map((x) => item(x, 'erro')),
        avisos.length > 0 && h('h3', {}, `Avisos (${avisos.length})`),
        avisos.length > 0 && h('p', { class: 'guia' }, 'Avisos não impedem nada: são conselhos para o estudo despertar mais curiosidade.'),
        avisos.map((x) => item(x, 'aviso'))),
      actions: [{ label: 'Fechar', value: null, primary: true }],
      mount: (close) => (fechar = close),
    });
  }

  function testar() {
    if (Estudos.validar(E).erros.length) {
      toast('Corrija os erros antes de testar.', 'erro');
      return verificar();
    }
    // Progresso próprio do teste, que recomeça a cada vez.
    const chave = `teste-${E.id}`;
    Lab.store.del(`${chave}:progresso`);
    ligando = null;
    const estudo = E;
    ctx.abrirEstudo(Estudos.preparar(structuredClone(E)), { chave, voltar: () => abrir(estudo, ctx) });
  }

  function exportar() {
    if (Estudos.validar(E).erros.length) {
      toast('Corrija os erros antes de exportar.', 'erro');
      return verificar();
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
    }).then(() => render());
  }

  window.Editor = { abrir };
})();
