// Artigo: o estudo lido como um texto corrido, no estilo de uma newsletter
// (Substack). As notas maduras viram seções, na ordem em que as ligações levam
// de uma a outra, e o motivo de cada ligação faz a ponte entre elas. As notas
// ainda em andamento fecham o texto como perguntas em aberto. Dá para copiar
// (com formatação, para colar no Substack) ou baixar como página.
(() => {
  'use strict';
  const { h, toast, fmtRef } = Lab;

  const CSS = `
.artigo-back { position: fixed; inset: 0; z-index: 70; overflow: auto; background: var(--a-fundo); overscroll-behavior: contain; }
.artigo-barra { position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; align-items: center; padding: 10px 16px; padding-top: calc(10px + env(safe-area-inset-top, 0px)); background: var(--a-fundo); border-bottom: 1px solid var(--a-linha); }
.artigo-barra .espaco { flex: 1; }
.artigo-back, .artigo-pagina { --a-fundo: #fffdf8; --a-tinta: #1f1d1a; --a-suave: #6b655b; --a-linha: #e6e0d4; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .artigo-back, .artigo-pagina { --a-fundo: #191816; --a-tinta: #ece7dd; --a-suave: #a39c8f; --a-linha: #35322d; }
}
:root[data-theme='dark'] .artigo-back { --a-fundo: #191816; --a-tinta: #ece7dd; --a-suave: #a39c8f; --a-linha: #35322d; }
.artigo-pagina { margin: 0; background: var(--a-fundo); }
.artigo { max-width: 640px; margin: 0 auto; padding: 32px 20px 96px; color: var(--a-tinta); font: 19px/1.7 Georgia, 'Times New Roman', serif; overflow-wrap: break-word; }
.artigo h1 { font: 700 34px/1.15 Georgia, 'Times New Roman', serif; margin: 0 0 12px; }
.artigo .subtitulo { font-size: 21px; line-height: 1.4; color: var(--a-suave); margin: 0 0 24px; }
.artigo .assinatura { display: flex; align-items: center; gap: 12px; font: 15px/1.35 system-ui, sans-serif; color: var(--a-suave); padding: 14px 0; border-top: 1px solid var(--a-linha); border-bottom: 1px solid var(--a-linha); margin: 0 0 28px; }
.artigo .assinatura b { display: block; color: var(--a-tinta); }
.artigo .avatar { flex: none; width: 42px; height: 42px; border-radius: 50%; background: var(--a-cor, #c7685a); color: #1f1d1a; display: flex; align-items: center; justify-content: center; font: 700 18px system-ui, sans-serif; }
.artigo h2 { font: 700 25px/1.25 Georgia, 'Times New Roman', serif; margin: 44px 0 6px; }
.artigo .ponte + h2 { margin-top: 10px; }
.artigo .pergunta { font-style: italic; color: var(--a-suave); margin: 0 0 16px; }
.artigo .ponte { font: 15px/1.5 system-ui, sans-serif; color: var(--a-suave); border-left: 2px solid var(--a-linha); padding-left: 12px; margin: 40px 0 0; }
.artigo .ponte + .ponte { margin-top: 6px; }
.artigo blockquote { margin: 20px 0; padding: 2px 0 2px 18px; border-left: 3px solid var(--a-cor, #c7685a); }
.artigo blockquote p { margin: 6px 0; }
.artigo blockquote cite { display: block; font: 14px/1.4 system-ui, sans-serif; font-style: normal; color: var(--a-suave); margin-top: 8px; }
.artigo sup { font-size: 11px; color: var(--a-suave); margin-right: 3px; }
.artigo hr { border: 0; text-align: center; margin: 44px 0; }
.artigo hr::after { content: '* * *'; color: var(--a-suave); letter-spacing: 8px; }
.artigo .heb { font: 30px 'Times New Roman', serif; }
.artigo .palavra { margin: 18px 0; }
.artigo .palavra b { font-style: italic; }
.artigo .aberto li { margin: 14px 0; }
.artigo .aberto .ref { font: 14px system-ui, sans-serif; color: var(--a-suave); }
.artigo .carregando { font: 15px system-ui, sans-serif; color: var(--a-suave); }
.artigo .rodape { font: 14px/1.55 system-ui, sans-serif; color: var(--a-suave); border-top: 1px solid var(--a-linha); margin-top: 52px; padding-top: 16px; }
.artigo .rodape p { margin: 4px 0; }
`;
  function garantirEstilo() {
    if (document.getElementById('artigo-css')) return;
    document.head.append(h('style', { id: 'artigo-css' }, CSS));
  }

  // Ordem do texto: uma nota vem depois das que levam até ela (quando dá); a
  // síntese fecha.
  function roteiro(jogo) {
    const nos = jogo.nos.filter((n) => n.tipo !== 'sintese');
    const entram = new Map(nos.map((n) => [n.id, 0]));
    for (const n of nos) for (const p of n.pistas) if (entram.has(p.para)) entram.set(p.para, entram.get(p.para) + 1);
    const feitos = [];
    const resta = [...nos];
    while (resta.length) {
      const i = Math.max(0, resta.findIndex((n) => entram.get(n.id) === 0)); // num ciclo, segue a ordem do arquivo
      const [n] = resta.splice(i, 1);
      feitos.push(n);
      for (const p of n.pistas) if (entram.has(p.para)) entram.set(p.para, entram.get(p.para) - 1);
    }
    return [...feitos, ...jogo.nos.filter((n) => n.tipo === 'sintese')];
  }

  const palavrasDe = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;
  const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const nomeArquivo = (t) => `${(t || 'estudo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estudo'}`;

  async function abrir(estudo) {
    garantirEstilo();
    const e = Estudos.preparar(structuredClone(estudo));
    const jogo = Estudos.paraJogo(e);
    const ordem = roteiro(jogo);
    const abertas = e.nos.filter((n) => !Estudos.madura(n, e));
    const trad = Lab.bible.current();
    const cor = Estudos.corSegura(e.cor);
    const autor = e.autor?.nome?.trim() || 'Autor desconhecido';
    const carregar = [];

    // Os versículos da resposta (ou o começo da passagem), buscados na tradução em uso.
    function citacao(n) {
      const pas = jogo.passagens[n.passagem];
      if (!pas) return null;
      const bq = h('blockquote', {}, h('p', { class: 'carregando' }, 'Carregando o texto…'));
      carregar.push((async () => {
        try {
          const vs = await Lab.bible.verses(pas.osis);
          const escolhidos = n.evidencia?.length ? vs.filter((v) => n.evidencia.includes(v.key)) : vs.slice(0, 3);
          const ref = n.evidencia?.length ? `${n.evidencia.map(fmtRef).join(', ')} (em ${fmtRef(pas.osis)})` : fmtRef(pas.osis);
          Lab.mount(bq, escolhidos.map((v) => h('p', {}, h('sup', {}, v.v), v.text)), h('cite', {}, `${ref}${trad ? ` · ${trad.shortName || trad.name}` : ''}`));
        } catch {
          Lab.mount(bq, h('cite', {}, `${fmtRef(pas.osis)} (não consegui carregar o texto agora)`));
        }
      })());
      return bq;
    }

    function secao(n) {
      // As ligações que chegam nesta nota, com motivo, fazem a ponte.
      const pontes = jogo.nos.filter((m) => m.id !== n.id).flatMap((m) => m.pistas.filter((p) => p.para === n.id && p.texto?.trim()).map((p) => ({ de: m, texto: p.texto.trim() })));
      const frases = n.deducao?.frases.map((f) => f.modelo.replace(/\{(\w+)\}/g, (_, k) => f.lacunas[k] ?? '…'));
      return [
        pontes.map((p) => h('p', { class: 'ponte' }, `De “${p.de.titulo}”: ${p.texto}`)),
        h('h2', {}, n.titulo),
        n.pergunta?.trim() && h('p', { class: 'pergunta' }, n.pergunta.trim()),
        n.nota?.trim() && h('p', {}, n.nota.trim()),
        citacao(n),
        frases && h('ul', {}, frases.map((f) => h('li', {}, f))),
        n.revelacao?.trim() && h('p', {}, n.revelacao.trim()),
      ];
    }

    const tempo = h('span', {});
    const corpo = h('article', { class: 'artigo' },
      h('h1', {}, e.titulo),
      (e.pergunta_central?.trim() || e.descricao?.trim()) && h('p', { class: 'subtitulo' }, e.pergunta_central?.trim() || e.descricao.trim()),
      h('div', { class: 'assinatura' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, autor[0].toUpperCase()),
        h('span', {}, h('b', {}, autor), new Date(e.atualizado_em || Date.now()).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }), ' · ', tempo)),
      e.pergunta_central?.trim() && e.descricao?.trim() && h('p', {}, e.descricao.trim()),
      ordem.map(secao),
      e.palavras.length > 0 && [h('hr'), h('h2', {}, 'Palavras pelo caminho'),
        e.palavras.map((w) => h('div', { class: 'palavra' }, h('span', { class: 'heb', dir: 'rtl' }, w.original), ' ', h('b', {}, w.transliteracao), w.sintese && h('p', {}, w.sintese)))],
      abertas.length > 0 && [h('hr'), h('h2', {}, 'Ainda em aberto'),
        h('p', {}, ordem.length ? 'Notas que ainda estou investigando. Ficam aqui como perguntas, não como respostas.' : 'Este estudo ainda é só um mural de notas. Ficam aqui como perguntas, não como respostas.'),
        h('ul', { class: 'aberto' }, abertas.map((n) => {
          // Sem nome próprio, a nota é identificada pela referência, sem repetir o começo dela.
          const pas = e.passagens[n.passagem];
          const titulo = n.titulo?.trim();
          return h('li', {}, titulo && h('b', {}, titulo), pas && h('span', { class: 'ref' }, `${titulo ? ' · ' : ''}${fmtRef(pas.osis)}`),
            n.nota?.trim() && h('div', {}, n.nota.trim()),
            n.pergunta?.trim() && h('div', {}, h('i', {}, n.pergunta.trim())));
        }))],
      h('div', { class: 'rodape' },
        h('p', {}, `Escrito por ${autor}${e.licenca ? ` · ${e.licenca}` : ''}.`),
        trad && h('p', {}, `Texto bíblico: ${trad.name}${trad.licenseNotice ? `. ${trad.licenseNotice}` : ''}.`),
        h('p', {}, 'Feito no Laboratório de leitura, a partir de um mural de estudo.')),
    );
    corpo.style.setProperty('--a-cor', cor);
    const contar = () => {
      const min = Math.max(1, Math.round(palavrasDe(corpo.innerText) / 200));
      tempo.textContent = `${min} min de leitura`;
    };
    contar();
    const pronto = Promise.all(carregar).then(contar);

    const copiar = async () => {
      await pronto;
      const html = corpo.innerHTML;
      const texto = corpo.innerText;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) })]);
        toast('Artigo copiado. Cole no editor do Substack.', 'ok');
      } catch {
        try {
          await navigator.clipboard.writeText(texto);
          toast('Artigo copiado como texto simples.', 'ok');
        } catch {
          toast('Não consegui copiar. Use "Baixar".', 'erro');
        }
      }
    };
    const baixar = async () => {
      await pronto;
      const pagina = `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(e.titulo)}</title><style>${CSS}</style></head>\n<body class="artigo-pagina"><article class="artigo" style="--a-cor:${cor}">${corpo.innerHTML}</article></body></html>\n`;
      const url = URL.createObjectURL(new Blob([pagina], { type: 'text/html' }));
      const a = h('a', { href: url, download: `${nomeArquivo(e.titulo)}.html` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return new Promise((resolve) => {
      const fechar = () => {
        back.remove();
        document.removeEventListener('keydown', tecla);
        resolve();
      };
      const tecla = (ev) => ev.key === 'Escape' && fechar();
      const back = h('div', { class: 'artigo-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Artigo: ${e.titulo}` },
        h('div', { class: 'artigo-barra' },
          h('button', { class: 'btn icone', 'aria-label': 'Fechar o artigo', onclick: fechar }, '×'),
          h('span', { class: 'espaco' }),
          h('button', { class: 'btn', onclick: copiar }, 'Copiar'),
          h('button', { class: 'btn primary', onclick: baixar }, 'Baixar')),
        corpo);
      document.body.append(back);
      document.addEventListener('keydown', tecla);
    });
  }

  window.Artigo = { abrir };
})();
