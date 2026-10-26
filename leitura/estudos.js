// Estudos: o formato compartilhável, onde ficam guardados no aparelho, a
// conversão de referências em português e as validações usadas pelo editor
// (verificador) e pela importação de estudos de outras pessoas.
(() => {
  'use strict';
  const FORMATO = 'estudo-biblico';
  const VERSAO_FORMATO = 5; // 5: notas em andamento (ainda não maduras) e o campo `nota`
  const LICENCAS = ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0 (domínio público)', 'Todos os direitos reservados'];
  const TIPOS_NO = ['inicio', 'pergunta', 'sintese'];
  const TIPOS_PISTA = ['tema', 'citacao', 'alusao', 'mesma_palavra'];
  const agora = () => new Date().toISOString();

  // ---------------------------------------------------------------- guardar
  // Estudos criados ou importados ficam no aparelho: { id: { origem, estudo } }.
  const locais = () => Lab.store.get('estudos', {});
  function salvar(estudo, origem) {
    const t = locais();
    t[estudo.id] = { origem: origem || t[estudo.id]?.origem || 'meu', estudo };
    Lab.store.set('estudos', t);
  }
  function remover(id) {
    const t = locais();
    delete t[id];
    Lab.store.set('estudos', t);
    Lab.store.del(`${id}:progresso`);
  }

  // ---------------------------------------------------------------- criar
  function novoId() {
    try {
      return crypto.randomUUID();
    } catch {
      return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    }
  }
  const autorPadrao = () => Lab.store.get('autor-nome', '');

  function novo() {
    return {
      formato: FORMATO,
      versao_formato: VERSAO_FORMATO,
      id: novoId(),
      versao: 0, // sobe a cada exportação
      criado_em: agora(),
      atualizado_em: agora(),
      autor: { nome: autorPadrao() },
      licenca: LICENCAS[0],
      idioma: 'pt-BR',
      traducao_referencia: Lab.bible.current()?.id || '',
      titulo: 'Novo estudo',
      descricao: '',
      cor: '#7a9cc6',
      pergunta_central: '',
      passagens: {},
      nos: [],
      palavras: [],
    };
  }

  function duplicar(estudo) {
    const c = structuredClone(estudo);
    Object.assign(c, { id: novoId(), versao: 0, criado_em: agora(), atualizado_em: agora(), titulo: `${estudo.titulo} (cópia)`, autor: { nome: autorPadrao() } });
    return c;
  }

  // Convite inicial: o do estudo, ou um montado a partir dos nós de início.
  function convite(estudo) {
    if (estudo.convite) return estudo.convite;
    const inicios = estudo.nos.filter((n) => n.tipo === 'inicio');
    return {
      pergunta: inicios.length > 1 ? 'Por qual pergunta você quer começar?' : 'Por onde começar?',
      opcoes: [...inicios.map((n) => ({ texto: n.titulo || n.pergunta, leva_a: n.id })), { texto: 'Não sei, vou olhar o mapa', leva_a: null }],
    };
  }

  // ---------------------------------------------------------------- referências
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s.]+/g, '');
  const NOMES = {
    genesis: 'Gen', exodo: 'Exod', levitico: 'Lev', numeros: 'Num', deuteronomio: 'Deut', josue: 'Josh', juizes: 'Judg', rute: 'Ruth',
    '1samuel': '1Sam', '2samuel': '2Sam', '1reis': '1Kgs', '2reis': '2Kgs', '1cronicas': '1Chr', '2cronicas': '2Chr', esdras: 'Ezra',
    neemias: 'Neh', ester: 'Esth', jo: 'John', salmo: 'Ps', salmos: 'Ps', proverbios: 'Prov', eclesiastes: 'Eccl', cantares: 'Song',
    isaias: 'Isa', jeremias: 'Jer', lamentacoes: 'Lam', ezequiel: 'Ezek', daniel: 'Dan', oseias: 'Hos', joel: 'Joel', amos: 'Amos',
    obadias: 'Obad', jonas: 'Jonah', miqueias: 'Mic', naum: 'Nah', habacuque: 'Hab', sofonias: 'Zeph', ageu: 'Hag', zacarias: 'Zech',
    malaquias: 'Mal', mateus: 'Matt', marcos: 'Mark', lucas: 'Luke', joao: 'John', atos: 'Acts', romanos: 'Rom', '1corintios': '1Cor',
    '2corintios': '2Cor', galatas: 'Gal', efesios: 'Eph', filipenses: 'Phil', colossenses: 'Col', '1tessalonicenses': '1Thess',
    '2tessalonicenses': '2Thess', '1timoteo': '1Tim', '2timoteo': '2Tim', tito: 'Titus', filemom: 'Phlm', hebreus: 'Heb', tiago: 'Jas',
    '1pedro': '1Pet', '2pedro': '2Pet', '1joao': '1John', '2joao': '2John', '3joao': '3John', judas: 'Jude', apocalipse: 'Rev',
  };
  const LIVROS = { ...NOMES };
  for (const [osis, [, ab]] of Object.entries(Lab.BOOKS)) {
    LIVROS[norm(ab)] = osis;
    LIVROS[norm(osis)] = osis;
  }
  LIVROS.jo = 'John'; // "Jo" é João; Jó se escreve com acento e vira "jo" também, então "Jó" pede o nome inteiro
  LIVROS['jó'] = 'Job';

  // "Gn 2:1-3", "Mc 2:23–3:6", "1Sm 4:18", "Salmos 95.11" → { osis } ou { erro }.
  // Com `capitulo`, aceita também um capítulo inteiro ("Gn 2").
  function refParaOsis(texto, { capitulo = false } = {}) {
    const t = (texto || '').trim();
    if (!t) return { erro: 'Escreva uma referência, por exemplo Gn 2:1-3.' };
    const cap = capitulo && /^([1-3]?\s*[\p{L}]+)\.?\s*(\d+)$/u.exec(t);
    if (cap) {
      const r = refParaOsis(`${cap[1]} ${cap[2]}:1-176`);
      return r.erro ? r : { ...r, capitulo: true };
    }
    const m = /^([1-3]?\s*[\p{L}]+)\.?\s*(\d+)\s*[:.]\s*(\d+)(?:\s*[-–]\s*(?:(\d+)\s*[:.]\s*)?(\d+))?$/u.exec(t);
    if (!m) return { erro: 'Use o formato livro capítulo:versículo, como Gn 2:1-3.' };
    const chave = /^jó$/i.test(m[1].trim()) ? 'jó' : norm(m[1]);
    const livro = LIVROS[chave];
    if (!livro) return { erro: `Não reconheci o livro "${m[1]}".` };
    const c1 = +m[2];
    const v1 = +m[3];
    const c2 = m[4] ? +m[4] : c1;
    const v2 = m[5] ? +m[5] : v1;
    if (c2 < c1 || (c2 === c1 && v2 < v1)) return { erro: 'O fim do trecho vem antes do começo.' };
    const a = `${livro}.${c1}.${v1}`;
    const b = `${livro}.${c2}.${v2}`;
    return { osis: a === b ? a : `${a}-${b}` };
  }

  // ---------------------------------------------------------------- validar
  const str = (x, max) => typeof x === 'string' && x.length <= max;
  const osisOk = (o) => {
    try {
      Lab.parseRange(o);
      return true;
    } catch {
      return false;
    }
  };

  // Estrutura mínima de um arquivo de estudo, antes de instalar. Devolve o
  // motivo da recusa ou null. O conteúdo é sempre exibido como texto puro.
  function estruturaInvalida(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return 'O texto não é um estudo.';
    if (e.formato !== FORMATO) return 'Este arquivo não é um estudo do laboratório.';
    if (typeof e.versao_formato !== 'number' || e.versao_formato > VERSAO_FORMATO) return 'Este estudo foi feito numa versão mais nova do laboratório.';
    if (!str(e.id, 80) || !e.id) return 'O estudo não tem identificador.';
    if (!str(e.titulo, 120) || !e.titulo.trim()) return 'O estudo não tem título.';
    for (const k of ['descricao', 'pergunta_central', 'licenca', 'cor']) if (e[k] != null && !str(e[k], 2000)) return `O campo "${k}" é inválido.`;
    if (e.autor != null && (typeof e.autor !== 'object' || !str(e.autor.nome || '', 120))) return 'O autor é inválido.';
    if (!e.passagens || typeof e.passagens !== 'object' || Array.isArray(e.passagens)) return 'As passagens são inválidas.';
    for (const p of Object.values(e.passagens)) {
      if (!p || !osisOk(p.osis) || (p.contexto && !osisOk(p.contexto))) return 'Uma passagem tem referência inválida.';
    }
    if (!Array.isArray(e.nos) || e.nos.length > 300) return 'A lista de nós é inválida.';
    const ids = new Set();
    for (const n of e.nos) {
      if (!n || !str(n.id, 60) || !n.id || ids.has(n.id)) return 'Há nós sem identificador ou repetidos.';
      ids.add(n.id);
      if (!TIPOS_NO.includes(n.tipo)) return `O nó "${n.id}" tem um tipo desconhecido.`;
      for (const k of ['titulo', 'nota', 'pergunta', 'revelacao', 'retorno_erro', 'dica', 'passagem']) if (n[k] != null && !str(n[k], 4000)) return `O nó "${n.id}" tem um texto inválido.`;
      if (!Array.isArray(n.pistas || [])) return `As pistas do nó "${n.id}" são inválidas.`;
      for (const p of n.pistas || []) if (!p || !str(p.para, 60) || !TIPOS_PISTA.includes(p.tipo) || !str(p.texto || '', 1000)) return `Uma pista do nó "${n.id}" é inválida.`;
      if (n.evidencia && (!Array.isArray(n.evidencia) || n.evidencia.some((v) => !osisOk(v)))) return `A evidência do nó "${n.id}" é inválida.`;
      if (n.dica && !osisOk(n.dica)) return `A dica do nó "${n.id}" é inválida.`;
      if (n.requer && (!Array.isArray(n.requer) || !n.requer.every((r) => str(r, 60)))) return `O nó "${n.id}" tem requisitos inválidos.`;
      if (n.pos && (typeof n.pos.x !== 'number' || typeof n.pos.y !== 'number')) return `A posição do nó "${n.id}" é inválida.`;
    }
    if (e.palavras != null && !Array.isArray(e.palavras)) return 'As palavras são inválidas.';
    for (const w of e.palavras || []) {
      const lista = (x) => Array.isArray(x) && x.every((i) => i && typeof i === 'object');
      if (!w || !str(w.id, 60) || !str(w.transliteracao, 120) || !str(w.original, 120) || !lista(w.ocorrencias) || !lista(w.facetas) || !lista(w.letras) || !w.raiz || !lista(w.raiz.familia || []))
        return 'Uma palavra do estudo é inválida.';
      if (w.pos && (typeof w.pos.x !== 'number' || typeof w.pos.y !== 'number')) return `A posição de ${w.transliteracao} é inválida.`;
      if (w.ocorrencias.some((o) => !osisOk(o.verso) || !Array.isArray(o.formas) || !o.formas.every((f) => str(f, 60)))) return `As ocorrências de ${w.transliteracao} são inválidas.`;
    }
    for (const n of e.nos) {
      const d = n.deducao;
      if (d && (!Array.isArray(d.fichas) || !Array.isArray(d.frases) || d.frases.some((f) => !f || !str(f.modelo, 2000) || !f.lacunas || typeof f.lacunas !== 'object')))
        return `A síntese do nó "${n.id}" é inválida.`;
    }
    return null;
  }

  // Cor do estudo só entra no desenho se for um hex de 6 dígitos.
  const corSegura = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#7a9cc6');

  // Preenche o que é opcional no arquivo, para o jogo não tropeçar.
  function preparar(e) {
    e.palavras ||= [];
    e.autor ||= { nome: '' };
    for (const n of e.nos) n.pistas ||= [];
    return e;
  }

  // Remove passagens que nenhum nó usa mais (o editor cria uma por nó).
  function limparPassagens(e) {
    const usadas = new Set(e.nos.map((n) => n.passagem));
    for (const k of Object.keys(e.passagens)) if (!usadas.has(k)) delete e.passagens[k];
  }

  // ---------------------------------------------------------------- notas
  // Uma nota do mural se aprofunda em camadas. Com texto, pergunta, resposta e
  // revelação ela amadurece e entra no jogo; antes disso é anotação de quem cria.
  const CAMADAS = ['nota', 'texto', 'pergunta', 'resposta', 'revelacao'];
  const dentro = (v, osis) => {
    try {
      return Lab.inRange(v, osis);
    } catch {
      return false;
    }
  };
  const pontas = (faixa) => {
    const r = Lab.parseRange(faixa);
    return [`${r.book}.${r.from.ch}.${r.from.v}`, `${r.book}.${r.to.ch}.${r.to.v}`];
  };
  function camadas(n, e) {
    const pas = e.passagens[n.passagem];
    return {
      nota: !!n.nota?.trim(),
      texto: !!pas,
      pergunta: !!n.pergunta?.trim(),
      resposta: !!pas && (n.deducao ? true : !!n.evidencia?.length && n.evidencia.every((v) => dentro(v, pas.osis))),
      revelacao: !!n.revelacao?.trim(),
    };
  }
  function previsaoOk(p) {
    if (!p) return true;
    const opcoes = (p.opcoes || []).filter((o) => o?.trim());
    return !!p.pergunta?.trim() && opcoes.length >= 2 && p.correta >= 0 && p.correta < (p.opcoes || []).length && !!p.opcoes[p.correta]?.trim();
  }
  // O próximo passo de uma nota: { camada, msg }, ou null se ela já amadureceu.
  function proximoPasso(n, e) {
    const c = camadas(n, e);
    const pas = e.passagens[n.passagem];
    if (!c.texto) return { camada: 'texto', msg: 'Em que texto isso aparece?' };
    if (!c.pergunta) return { camada: 'pergunta', msg: 'Que pergunta isso desperta?' };
    if (!c.resposta) return { camada: 'resposta', msg: n.evidencia?.length ? 'A resposta ficou fora do texto: marque os versículos de novo.' : 'Quais versículos respondem à pergunta?' };
    if (!c.revelacao) return { camada: 'revelacao', msg: 'O que se entende ao achar a resposta?' };
    if (n.dica && !pontas(n.dica).every((v) => dentro(v, pas.osis))) return { camada: 'resposta', msg: 'A dica ficou fora do texto: marque de novo ou remova.' };
    if (!previsaoOk(n.previsao)) return { camada: 'extras', msg: 'Complete a previsão (pergunta, duas opções e a certa) ou apague-a.' };
    return null;
  }
  const madura = (n, e) => !proximoPasso(n, e);
  // Nome da nota no mapa: o título, o começo da nota ou da pergunta, ou o texto
  // fixado (com o estudo em `e`).
  function rotuloNo(n, e = null) {
    if (n.titulo?.trim()) return n.titulo.trim();
    const t = (n.nota || n.pergunta || '').trim().replace(/\s+/g, ' ');
    const pas = e?.passagens[n.passagem];
    if (!t) return pas ? Lab.fmtRef(pas.osis) : 'nota vazia';
    const palavras = t.split(' ');
    return palavras.length > 4 ? `${palavras.slice(0, 4).join(' ')}…` : t;
  }

  // O estudo que o jogo vê: só as notas maduras e as ligações entre elas. Uma
  // nota madura sem ligação madura chegando é um início.
  function paraJogo(e) {
    const j = structuredClone(e);
    const maduras = new Set(j.nos.filter((n) => madura(n, e)).map((n) => n.id));
    j.nos = j.nos.filter((n) => maduras.has(n.id));
    for (const n of j.nos) n.pistas = n.pistas.filter((p) => maduras.has(p.para));
    for (const n of j.nos) {
      n.titulo = rotuloNo(n, e);
      const chega = j.nos.some((m) => m.pistas.some((p) => p.para === n.id));
      if (n.tipo !== 'sintese' && !chega) n.tipo = 'inicio';
    }
    return j;
  }

  // ---------------------------------------------------------------- validar
  // Erros impedem testar e exportar; faltas são os próximos passos das notas
  // ainda em andamento (não impedem nada); avisos são conselhos de design
  // (vindos da skill de curiosidade).
  function validar(e) {
    const erros = [];
    const avisos = [];
    const faltas = [];
    const err = (msg, no) => erros.push({ msg, no });
    const av = (msg, no) => avisos.push({ msg, no });
    const ids = new Set(e.nos.map((n) => n.id));
    const maduras = new Set(e.nos.filter((n) => madura(n, e)).map((n) => n.id));
    const nome = (n) => rotuloNo(n, e);
    if (!e.titulo?.trim()) err('O estudo não tem título.');
    if (!maduras.size) err(e.nos.length ? 'Nenhuma nota amadureceu ainda: o jogo não teria nenhuma pergunta.' : 'O mural está vazio.');
    if (!e.pergunta_central?.trim()) av('O estudo não tem pergunta central.');
    if (!e.autor?.nome?.trim()) av('Escreva seu nome no estudo antes de compartilhar.');

    const saidas = (n) => (n.pistas || []).filter((p) => maduras.has(p.para)).length;
    const finais = e.nos.filter((n) => maduras.has(n.id) && n.tipo !== 'sintese' && !saidas(n)).length;
    for (const n of e.nos) {
      const passo = proximoPasso(n, e);
      if (passo) faltas.push({ msg: passo.msg, no: n.id, camada: passo.camada });
      for (const p of n.pistas || []) if (!ids.has(p.para)) err(`Uma ligação de "${nome(n)}" aponta para uma nota que não existe mais.`, n.id);
      for (const r of n.requer || []) {
        if (!ids.has(r)) err(`"${nome(n)}" exige uma nota que não existe mais.`, n.id);
        else if (maduras.has(n.id) && !maduras.has(r)) err(`"${nome(n)}" exige "${nome(e.nos.find((x) => x.id === r))}", que ainda não amadureceu.`, n.id);
      }
      if (n.deducao) {
        const fichas = n.deducao.fichas.map((f) => f.texto).sort();
        const lacunas = n.deducao.frases.flatMap((f) => Object.values(f.lacunas)).sort();
        if (JSON.stringify(fichas) !== JSON.stringify(lacunas)) err(`As palavras da síntese "${nome(n)}" não batem com as lacunas.`, n.id);
      }
      for (const p of n.pistas || []) {
        const alvo = e.nos.find((x) => x.id === p.para);
        if (alvo && !p.texto?.trim()) av(`A ligação "${nome(n)}" → "${nome(alvo)}" não diz por quê. Toque nela para escrever a pista.`, n.id);
      }
      if (!maduras.has(n.id)) continue;
      // Avisos de design, só para o que entra no jogo
      // Um fim é natural; vários fins deixam o mapa sem para onde convergir.
      if (n.tipo !== 'sintese' && !saidas(n) && finais > 1) av(`"${nome(n)}" não leva a nenhuma outra nota madura: o mapa tem ${finais} pontas soltas.`, n.id);
      if (/^\s*(o que|quem|qual|quais|quando|onde)\b/i.test(n.pergunta || '')) av(`A pergunta de "${nome(n)}" pede um fato. Perguntas de "por quê" ou "como" despertam mais curiosidade.`, n.id);
      if (n.revelacao.trim().length < 60) av(`A revelação de "${nome(n)}" está curta. O que a pessoa entende ao achar a resposta?`, n.id);
      if (n.tipo === 'sintese') {
        const caminhos = e.nos.filter((m) => maduras.has(m.id) && (m.pistas || []).some((p) => p.para === n.id)).length + (n.requer || []).length;
        if (caminhos < 2) av(`A síntese "${nome(n)}" tem um único caminho até ela.`, n.id);
      }
    }

    // Alcance no jogo: dos inícios, seguindo as ligações entre notas maduras.
    const jogo = paraJogo(e);
    const alcancados = new Set(jogo.nos.filter((n) => n.tipo === 'inicio').map((n) => n.id));
    const fila = [...alcancados];
    while (fila.length) {
      const id = fila.shift();
      const n = jogo.nos.find((x) => x.id === id);
      for (const p of n?.pistas || []) if (!alcancados.has(p.para)) (alcancados.add(p.para), fila.push(p.para));
    }
    for (const n of jogo.nos) if (!alcancados.has(n.id)) err(`Nenhum caminho do jogo leva até "${nome(n)}". Ligue uma nota madura a ela.`, n.id);

    for (const w of e.palavras || []) {
      for (const f of w.facetas || []) if (!maduras.has(f.no)) err(`Uma faceta de ${w.transliteracao} aponta para uma nota que não existe ou não amadureceu.`);
    }
    return { erros, avisos, faltas };
  }

  window.Estudos = { FORMATO, VERSAO_FORMATO, LICENCAS, CAMADAS, locais, salvar, remover, novo, novoId, duplicar, convite, refParaOsis, estruturaInvalida, validar, agora, corSegura, preparar, limparPassagens, camadas, proximoPasso, madura, rotuloNo, paraJogo };
})();
