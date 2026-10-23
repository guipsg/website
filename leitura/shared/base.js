// Laboratório de leitura — base comum dos cinco protótipos.
// Texto bíblico (Free Use Bible API, da AO Lab), leitor de passagens, janelas,
// progresso salvo no aparelho e diário pós-sessão.
(() => {
  'use strict';

  const API = 'https://bible.helloao.org/api/';
  const NS = 'leitura-v1';
  const PREFERIDA = /\bNVI\b|nova vers[ãa]o internacional/i;

  // ======================================================================
  // Armazenamento local (tudo em try/catch: pode falhar em aba anônima)
  // ======================================================================
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(`${NS}:${key}`);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, val) {
      try {
        localStorage.setItem(`${NS}:${key}`, JSON.stringify(val));
      } catch {}
    },
    del(key) {
      try {
        localStorage.removeItem(`${NS}:${key}`);
      } catch {}
    },
  };

  // ======================================================================
  // Referências OSIS
  // ======================================================================
  // OSIS -> [código USFM usado pela API, abreviação em português]
  const BOOKS = {
    Gen: ['GEN', 'Gn'], Exod: ['EXO', 'Êx'], Lev: ['LEV', 'Lv'], Num: ['NUM', 'Nm'], Deut: ['DEU', 'Dt'],
    Josh: ['JOS', 'Js'], Judg: ['JDG', 'Jz'], Ruth: ['RUT', 'Rt'], '1Sam': ['1SA', '1Sm'], '2Sam': ['2SA', '2Sm'],
    '1Kgs': ['1KI', '1Rs'], '2Kgs': ['2KI', '2Rs'], '1Chr': ['1CH', '1Cr'], '2Chr': ['2CH', '2Cr'], Ezra: ['EZR', 'Ed'],
    Neh: ['NEH', 'Ne'], Esth: ['EST', 'Et'], Job: ['JOB', 'Jó'], Ps: ['PSA', 'Sl'], Prov: ['PRO', 'Pv'],
    Eccl: ['ECC', 'Ec'], Song: ['SNG', 'Ct'], Isa: ['ISA', 'Is'], Jer: ['JER', 'Jr'], Lam: ['LAM', 'Lm'],
    Ezek: ['EZK', 'Ez'], Dan: ['DAN', 'Dn'], Hos: ['HOS', 'Os'], Joel: ['JOL', 'Jl'], Amos: ['AMO', 'Am'],
    Obad: ['OBA', 'Ob'], Jonah: ['JON', 'Jn'], Mic: ['MIC', 'Mq'], Nah: ['NAM', 'Na'], Hab: ['HAB', 'Hc'],
    Zeph: ['ZEP', 'Sf'], Hag: ['HAG', 'Ag'], Zech: ['ZEC', 'Zc'], Mal: ['MAL', 'Ml'],
    Matt: ['MAT', 'Mt'], Mark: ['MRK', 'Mc'], Luke: ['LUK', 'Lc'], John: ['JHN', 'Jo'], Acts: ['ACT', 'At'],
    Rom: ['ROM', 'Rm'], '1Cor': ['1CO', '1Co'], '2Cor': ['2CO', '2Co'], Gal: ['GAL', 'Gl'], Eph: ['EPH', 'Ef'],
    Phil: ['PHP', 'Fp'], Col: ['COL', 'Cl'], '1Thess': ['1TH', '1Ts'], '2Thess': ['2TH', '2Ts'], '1Tim': ['1TI', '1Tm'],
    '2Tim': ['2TI', '2Tm'], Titus: ['TIT', 'Tt'], Phlm: ['PHM', 'Fm'], Heb: ['HEB', 'Hb'], Jas: ['JAS', 'Tg'],
    '1Pet': ['1PE', '1Pe'], '2Pet': ['2PE', '2Pe'], '1John': ['1JN', '1Jo'], '2John': ['2JN', '2Jo'], '3John': ['3JN', '3Jo'],
    Jude: ['JUD', 'Jd'], Rev: ['REV', 'Ap'],
  };

  function parseVerse(s) {
    const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(s.trim());
    if (!m || !BOOKS[m[1]]) throw new Error(`Referência inválida: ${s}`);
    return { book: m[1], ch: +m[2], v: +m[3] };
  }
  function parseRange(s) {
    const [a, b] = s.split('-');
    const from = parseVerse(a);
    const to = b ? parseVerse(b) : from;
    return { book: from.book, from: { ch: from.ch, v: from.v }, to: { ch: to.ch, v: to.v } };
  }
  const keyOf = (book, ch, v) => `${book}.${ch}.${v}`;
  const cmp = (a, b) => a.ch - b.ch || a.v - b.v;
  function inRange(key, range) {
    if (!range) return false;
    const p = parseVerse(key);
    const r = typeof range === 'string' ? parseRange(range) : range;
    return p.book === r.book && cmp(p, r.from) >= 0 && cmp(p, r.to) <= 0;
  }
  function fmtRef(osis) {
    const r = parseRange(osis);
    const ab = BOOKS[r.book][1];
    const { from, to } = r;
    if (from.ch === to.ch && from.v === to.v) return `${ab} ${from.ch}:${from.v}`;
    if (from.ch === to.ch) return `${ab} ${from.ch}:${from.v}-${to.v}`;
    return `${ab} ${from.ch}:${from.v}–${to.ch}:${to.v}`;
  }

  // ======================================================================
  // Texto bíblico
  // ======================================================================
  let translationsPromise = null;
  const chapterCache = new Map();

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return res.json();
  }

  const bible = {
    // Traduções em português disponíveis na API.
    portuguese() {
      if (!translationsPromise) {
        translationsPromise = getJSON(`${API}available_translations.json`)
          .then((d) => d.translations.filter((t) => t.language === 'por'))
          .catch((e) => {
            translationsPromise = null;
            throw e;
          });
      }
      return translationsPromise;
    },
    current: () => store.get('traducao', null),
    set(t) {
      const slim = { id: t.id, name: t.name, shortName: t.shortName || '', licenseNotice: t.licenseNotice || '' };
      store.set('traducao', slim);
      return slim;
    },
    // Tradução em uso: a salva, ou a NVI se existir, ou pergunta ao usuário.
    async ensure() {
      const saved = bible.current();
      if (saved) return saved;
      const list = await bible.portuguese();
      const nvi = list.find((t) => PREFERIDA.test([t.id, t.name, t.shortName, t.englishName].join(' ')));
      if (nvi) return bible.set(nvi);
      return chooseTranslation({ semNVI: true });
    },
    async chapter(tid, book, ch) {
      const usfm = BOOKS[book][0];
      const ck = `${tid}/${usfm}/${ch}`;
      if (chapterCache.has(ck)) return chapterCache.get(ck);
      const cached = store.get(`cap:${ck}`, null);
      if (cached) {
        chapterCache.set(ck, cached);
        return cached;
      }
      const d = await getJSON(`${API}${encodeURIComponent(tid)}/${usfm}/${ch}.json`);
      const verses = d.chapter.content
        .filter((c) => c.type === 'verse')
        .map((c) => ({ v: c.number, text: verseText(c.content) }));
      chapterCache.set(ck, verses);
      store.set(`cap:${ck}`, verses);
      return verses;
    },
    // Versículos de um intervalo OSIS, inclusive atravessando capítulos.
    async verses(osis) {
      const t = await bible.ensure();
      const r = parseRange(osis);
      const out = [];
      for (let ch = r.from.ch; ch <= r.to.ch; ch++) {
        const list = await bible.chapter(t.id, r.book, ch);
        for (const x of list) {
          const p = { ch, v: x.v };
          if (cmp(p, r.from) >= 0 && cmp(p, r.to) <= 0) out.push({ key: keyOf(r.book, ch, x.v), ch, v: x.v, text: x.text });
        }
      }
      return out;
    },
  };

  function verseText(parts) {
    return parts
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p.text) return p.text;
        if (p.lineBreak) return ' ';
        return ''; // títulos internos e chamadas de nota ficam de fora
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s([,.;:!?])/g, '$1')
      .trim();
  }

  // ======================================================================
  // UI: elementos, janelas e avisos
  // ======================================================================
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  // Troca o conteúdo de `el`, achatando listas e ignorando valores falsos.
  function mount(el, ...kids) {
    el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  }

  // Janela modal. Resolve com o `value` da ação escolhida, ou null ao fechar.
  // `mount(close)` permite que o conteúdo feche a janela por conta própria.
  function modal({ title, body, actions = [{ label: 'Ok', value: true, primary: true }], dismissable = true, className = '', mount = null }) {
    return new Promise((resolve) => {
      const close = (val) => {
        back.classList.remove('show');
        setTimeout(() => back.remove(), 180);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const onKey = (e) => {
        if (e.key === 'Escape' && dismissable) close(null);
      };
      const box = h(
        'div',
        { class: `modal ${className}`, role: 'dialog', 'aria-modal': 'true' },
        title && h('h2', {}, title),
        h('div', { class: 'modal-body' }, body || ''),
        actions.length > 0 &&
          h(
            'div',
            { class: 'modal-actions' },
            actions.map((a) =>
              h('button', { class: a.primary ? 'btn primary' : 'btn', onclick: () => close(typeof a.value === 'function' ? a.value() : a.value) }, a.label),
            ),
          ),
      );
      const back = h('div', { class: 'backdrop', onclick: (e) => e.target === back && dismissable && close(null) }, box);
      document.body.append(back);
      requestAnimationFrame(() => back.classList.add('show'));
      document.addEventListener('keydown', onKey);
      const first = box.querySelector('textarea, input, .btn.primary');
      if (first) setTimeout(() => first.focus(), 50);
      if (mount) mount(close);
    });
  }

  // Opções em botões grandes. Resolve com o item escolhido, ou null.
  function escolha({ title, intro = null, opcoes, rotulo = (o) => o.texto, dismissable = true }) {
    const body = h('div', {}, intro, opcoes.map((o, i) => h('button', { class: 'opcao', 'data-i': i }, rotulo(o))));
    return modal({
      title,
      body,
      actions: [],
      dismissable,
      mount: (close) =>
        body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-i]');
          if (b) close(opcoes[+b.dataset.i]);
        }),
    });
  }

  let toastTimer = 0;
  function toast(msg, kind = '') {
    let el = document.querySelector('.toast');
    if (!el) {
      el = h('div', { class: 'toast', role: 'status' });
      document.body.append(el);
    }
    el.className = `toast show ${kind}`;
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  toast.hide = () => document.querySelector('.toast')?.classList.remove('show');

  // Vibração curta (só funciona no Android; no iPhone é ignorada).
  const buzz = (ms = 25) => {
    try {
      navigator.vibrate && navigator.vibrate(ms);
    } catch {}
  };

  async function chooseTranslation({ semNVI = false } = {}) {
    let list;
    try {
      list = await bible.portuguese();
    } catch (e) {
      await modal({
        title: 'Sem conexão com a API',
        body: h('p', {}, 'Não consegui carregar a lista de traduções da AO Lab. Verifique a internet e tente de novo.'),
      });
      throw e;
    }
    const cur = bible.current();
    const body = h(
      'div',
      {},
      semNVI && h('p', { class: 'aviso' }, 'A NVI não foi encontrada na API da AO Lab (ela é protegida por direitos autorais). Escolha outra tradução em português:'),
      h(
        'div',
        { class: 'lista-traducoes' },
        list.map((t) =>
          h(
            'button',
            { class: `opcao ${cur && cur.id === t.id ? 'sel' : ''}`, 'data-id': t.id },
            h('b', {}, t.shortName || t.id),
            ' ',
            h('span', {}, t.name),
          ),
        ),
      ),
    );
    const picked = await modal({
      title: 'Tradução',
      body,
      actions: [],
      dismissable: !semNVI,
      mount: (close) =>
        body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-id]');
          if (b) close(list.find((x) => x.id === b.dataset.id));
        }),
    });
    if (!picked) return bible.current();
    chapterCache.clear();
    return bible.set(picked);
  }

  // ======================================================================
  // Leitor de passagens
  // ======================================================================
  // Abre a passagem em tela cheia. Com `select`, o jogador toca num versículo e
  // confirma; resolve com a chave OSIS do versículo ("Gen.2.3") ou null.
  // `foco` (intervalo OSIS) esmaece o que está fora, como dica.
  // `brilhos` faz palavras do texto brilharem: [{ id, verso, formas, achado }], em
  // que `formas` são palavras inteiras ("sábado") ou radicais terminados em "*".
  // Tocar numa delas chama `onBrilho(brilho, textoTocado)`.
  function reader({ osis, contexto = null, title = null, prompt = '', select = false, foco = null, confirmLabel = null, brilhos = [], onBrilho = null }) {
    return new Promise((resolve) => {
      let selected = null;
      let showingContext = false;
      const list = h('div', { class: 'versos', 'aria-live': 'polite' }, h('p', { class: 'carregando' }, 'Carregando o texto…'));
      const confirm = select
        ? h('button', { class: 'btn primary', disabled: true, onclick: () => done(selected) }, confirmLabel || 'É isso')
        : h('button', { class: 'btn primary', onclick: () => done(true) }, confirmLabel || 'Terminei de ler');
      const status = h('span', { class: 'sel-status' }, select ? 'Toque no versículo' : '');
      const ctxBtn =
        contexto &&
        h('button', { class: 'btn link', onclick: () => {
          showingContext = !showingContext;
          ctxBtn.textContent = showingContext ? 'Mostrar só a passagem' : 'Ler o contexto';
          render();
        } }, 'Ler o contexto');
      const notice = h('p', { class: 'licenca' });
      const sheet = h(
        'div',
        { class: 'leitor', role: 'dialog', 'aria-modal': 'true' },
        h(
          'header',
          {},
          h('div', {}, h('div', { class: 'leitor-ref' }, title || fmtRef(osis)), h('div', { class: 'leitor-trad' })),
          h('button', { class: 'btn icone', 'aria-label': 'Fechar', onclick: () => done(null) }, '×'),
        ),
        prompt && h('p', { class: 'leitor-prompt' }, prompt),
        foco && h('p', { class: 'leitor-dica' }, 'Dica: concentre-se nos versículos destacados.'),
        list,
        ctxBtn && h('div', { class: 'leitor-ctx' }, ctxBtn),
        notice,
        h('footer', {}, status, confirm),
      );
      const back = h('div', { class: 'backdrop leitor-back' }, sheet);
      document.body.append(back);
      requestAnimationFrame(() => back.classList.add('show'));
      const onKey = (e) => e.key === 'Escape' && done(null);
      document.addEventListener('keydown', onKey);

      function done(val) {
        // Ao confirmar, sai na hora: o protótipo pode reabrir o leitor em seguida.
        if (val) back.remove();
        back.classList.remove('show');
        setTimeout(() => back.remove(), 180);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      }

      async function render() {
        list.replaceChildren(h('p', { class: 'carregando' }, 'Carregando o texto…'));
        try {
          const t = await bible.ensure();
          sheet.querySelector('.leitor-trad').textContent = t.shortName || t.name;
          notice.textContent = t.licenseNotice || '';
          const verses = await bible.verses(showingContext ? contexto : osis);
          const passage = parseRange(osis);
          let lastCh = null;
          const nodes = [];
          for (const x of verses) {
            if (x.ch !== lastCh && (passage.from.ch !== passage.to.ch || showingContext)) nodes.push(h('div', { class: 'cap' }, `Capítulo ${x.ch}`));
            lastCh = x.ch;
            const inPassage = inRange(x.key, passage);
            const cls = ['verso', showingContext && !inPassage ? 'contexto' : '', foco && !inRange(x.key, foco) ? 'fora' : '', selected === x.key ? 'sel' : '']
              .filter(Boolean)
              .join(' ');
            nodes.push(
              h(
                select ? 'button' : 'p',
                { class: cls, 'data-key': x.key, onclick: select ? () => pick(x.key) : null },
                h('sup', {}, x.v),
                ' ',
                comBrilhos(x),
              ),
            );
          }
          if (!nodes.length) nodes.push(h('p', { class: 'erro' }, 'Esta tradução não trouxe versículos para esse trecho.'));
          list.replaceChildren(...nodes);
        } catch (e) {
          console.error(e);
          list.replaceChildren(
            h('p', { class: 'erro' }, 'Não consegui carregar o texto. Verifique a conexão.'),
            h('div', { class: 'linha' },
              h('button', { class: 'btn', onclick: render }, 'Tentar de novo'),
              h('button', { class: 'btn', onclick: async () => { try { await chooseTranslation(); render(); } catch {} } }, 'Trocar tradução'),
            ),
          );
        }
      }

      // Quebra o texto do versículo em trechos, envolvendo as formas que brilham.
      function comBrilhos(x) {
        const bs = brilhos.filter((b) => b.verso === x.key);
        if (!bs.length) return x.text;
        const achados = [];
        for (const b of bs) {
          const alt = b.formas.map((f) => (f.endsWith('*') ? escapeRe(f.slice(0, -1)) + '\\p{L}*' : escapeRe(f))).join('|');
          const re = new RegExp(`(?<!\\p{L})(?:${alt})(?!\\p{L})`, 'giu');
          for (const m of x.text.matchAll(re)) achados.push({ i: m.index, fim: m.index + m[0].length, b });
        }
        achados.sort((a, z) => a.i - z.i);
        const partes = [];
        let pos = 0;
        for (const a of achados) {
          if (a.i < pos) continue;
          partes.push(x.text.slice(pos, a.i));
          const txt = x.text.slice(a.i, a.fim);
          partes.push(
            h('span', {
              class: `brilho ${a.b.achado ? 'achado' : ''}`,
              'data-brilho': a.b.id,
              role: 'button',
              tabindex: 0,
              onclick: (e) => tocarBrilho(e, a.b, txt),
              onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && tocarBrilho(e, a.b, txt),
            }, txt),
          );
          pos = a.fim;
        }
        partes.push(x.text.slice(pos));
        return partes;
      }

      async function tocarBrilho(e, b, txt) {
        e.preventDefault();
        e.stopPropagation(); // não seleciona o versículo
        buzz(15);
        if (onBrilho) await onBrilho(b, txt);
        b.achado = true;
        list.querySelectorAll(`.brilho[data-brilho="${b.id}"]`).forEach((el) => el.classList.add('achado'));
      }

      function pick(key) {
        selected = key;
        buzz(10);
        list.querySelectorAll('.verso').forEach((el) => el.classList.toggle('sel', el.dataset.key === key));
        status.textContent = `Selecionado: ${fmtRef(key)}`;
        confirm.disabled = false;
      }

      render();
    });
  }

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Confere um versículo contra `item.evidencia`. Conta erros por item em `erros`
  // (um objeto salvo no progresso) e, a partir do 2º erro, devolve a dica.
  function checkEvidence(item, key, erros) {
    if (item.evidencia.includes(key)) return { ok: true };
    erros[item.id] = (erros[item.id] || 0) + 1;
    const n = erros[item.id];
    return {
      ok: false,
      msg: item.retorno_erro || 'Esse trecho fala de outra coisa. Continue procurando.',
      foco: n >= 2 && item.dica ? item.dica : null,
    };
  }

  // ======================================================================
  // Conteúdo e progresso
  // ======================================================================
  async function loadPack(file) {
    const res = await fetch(`conteudo/${file}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Não encontrei o pacote ${file}`);
    return res.json();
  }

  function progress(proto, initial) {
    const key = `${proto}:progresso`;
    const data = Object.assign(structuredClone(initial), store.get(key, {}));
    return { data, save: () => store.set(key, data), reset: () => store.del(key) };
  }

  // ======================================================================
  // Diário (igual nos cinco protótipos)
  // ======================================================================
  const today = () => new Date().toLocaleDateString('sv'); // AAAA-MM-DD no fuso local
  const diario = () => store.get('diario', []);
  const saveDiario = (d) => store.set('diario', d);
  let sessionId = null;

  function textarea(name, placeholder) {
    return h('textarea', { name, rows: 3, placeholder });
  }

  // Chamado quando um protótipo abre. Faz as perguntas de "dia seguinte" e de
  // lembrança tardia antes de mostrar o conteúdo.
  async function startSession(proto, nome) {
    const entries = diario();
    const mine = entries.filter((e) => e.proto === proto);
    const sessions = mine.filter((e) => e.tipo === 'sessao');
    const d = today();

    // Lembrança tardia: 3 dias depois da primeira sessão, antes de rever o conteúdo.
    if (sessions.length && !mine.some((e) => e.tipo === 'lembranca')) {
      const dias = (Date.parse(d) - Date.parse(sessions[0].data)) / 864e5;
      if (dias >= 3) {
        const t = textarea('lembranca', 'Escreva de memória, sem consultar nada…');
        const r = await modal({
          title: 'Antes de continuar',
          body: h('div', {}, h('p', {}, `Já faz ${Math.floor(dias)} dias desde sua primeira sessão em ${nome}. O que você lembra do que aprendeu?`), t),
          actions: [
            { label: 'Agora não', value: null },
            { label: 'Salvar', value: () => t.value.trim(), primary: true },
          ],
          dismissable: false,
        });
        if (r) entries.push({ proto, tipo: 'lembranca', data: d, quando: new Date().toISOString(), texto: r });
      }
    }

    // Voltou num dia novo? Pergunta se foi por vontade própria.
    if (sessions.length && !sessions.some((e) => e.data === d)) {
      const r = await modal({
        title: 'Bem-vindo de volta',
        body: h('p', {}, 'Você abriu hoje por vontade própria, sem lembrete nem obrigação?'),
        actions: [
          { label: 'Não, foi lembrete', value: 'lembrete' },
          { label: 'Sim, quis voltar', value: 'vontade', primary: true },
        ],
        dismissable: false,
      });
      if (r) entries.push({ proto, tipo: 'retorno', data: d, quando: new Date().toISOString(), resposta: r });
    }

    sessionId = `${proto}-${Date.now()}`;
    entries.push({ proto, tipo: 'sessao', id: sessionId, data: d, inicio: new Date().toISOString() });
    saveDiario(entries);
  }

  async function endSession(proto) {
    const perguntas = textarea('perguntas', 'Quais perguntas surgiram sem o jogo pedir?');
    const travou = textarea('travou', 'Onde travou ou perdeu a vontade?');
    const tempo = h(
      'div',
      { class: 'escolhas' },
      ['quase tudo lendo', 'mais lendo', 'meio a meio', 'mais na interface'].map((op) =>
        h('label', {}, h('input', { type: 'radio', name: 'tempo', value: op }), ' ', op),
      ),
    );
    const r = await modal({
      title: 'Diário da sessão',
      body: h('div', { class: 'diario-form' },
        h('label', {}, '1. Perguntas que surgiram sozinhas', perguntas),
        h('div', {}, h('span', { class: 'rotulo' }, '2. Onde foi o seu tempo?'), tempo),
        h('label', {}, '3. Onde travou?', travou),
      ),
      actions: [
        { label: 'Pular', value: 'pular' },
        { label: 'Salvar', value: 'salvar', primary: true },
      ],
    });
    if (!r) return false;
    const entries = diario();
    const s = entries.find((e) => e.id === sessionId);
    if (s) {
      s.fim = new Date().toISOString();
      if (r === 'salvar') {
        s.perguntas = perguntas.value.trim();
        s.tempo = tempo.querySelector('input:checked')?.value || '';
        s.travou = travou.value.trim();
      }
    }
    saveDiario(entries);
    toast('Sessão registrada. Até a próxima!');
    return true;
  }

  window.Lab = {
    store, bible, BOOKS, parseVerse, parseRange, inRange, fmtRef,
    h, mount, modal, escolha, toast, buzz, reader, checkEvidence, chooseTranslation,
    loadPack, progress, startSession, endSession, diario,
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
})();
