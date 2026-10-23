# Laboratório de leitura bíblica

Protótipo pessoal de um jogo de estudo bíblico inspirado no ship log de
*Outer Wilds*: você avança porque entende, não porque ganha pontos.

Ele saiu de uma rodada de testes com cinco protótipos. Cadernos foi
descartado, e as mecânicas que funcionaram (grafo de perguntas, léxico,
dedução) foram juntadas num jogo só.

## Como o jogo funciona

Duas telas em lousa de tela cheia. Arraste para mover; aproxime com pinça,
roda do mouse ou os botões + e −. O botão ⤢ enquadra tudo.

1. **Sistema:** a tela de seleção. Cada planeta é uma constelação
   (um tema).
   - Colorido: você já visitou.
   - Cinza: você ouviu falar, mas ainda não foi.
   - Só o contorno: ainda desconhecido.

   As luas são as palavras hebraicas daquele tema, preenchidas quando
   descobertas. Toque num planeta e em "Ver entradas".
2. **Constelação:** o grafo de perguntas.
   - **Nó de passagem:** um "?" aparece quando uma pista aponta para ele.
     Você lê e marca o versículo que responde. Alguns deixam prever a
     resposta antes de ler.
   - **Palavras que brilham:** durante a leitura, certas palavras do
     texto brilham. Tocar numa delas revela a palavra hebraica por trás
     (por exemplo, "repousou" → *shabat*), e o nó da palavra surge na
     constelação. Numa passagem que mostra uma faceta da palavra, você
     escolhe qual é e a resposta é conferida na hora.
   - **Nó de palavra:** mostra as letras (nome, som, valor, papel na
     palavra), a raiz e a família dela, todas as palavras do texto já
     encontradas que traduzem essa palavra, e as facetas descobertas.
     O desenho de origem de cada letra aparece como curiosidade: ele
     explica o nome da letra, não o sentido da palavra.
   - **Síntese:** abre quando as perguntas e as palavras exigidas foram
     encontradas. Você arrasta as palavras aprendidas para as lacunas
     das frases (ou toca na palavra e depois na lacuna). Não há
     distratores: quando todas as lacunas estão preenchidas, as erradas
     ficam marcadas em vermelho até serem trocadas.

O menu (☰) tem a tradução, o diário, o encerramento da sessão e a opção
de recomeçar a constelação.

## Como rodar

Os arquivos são estáticos e não precisam de build. Sirva a raiz do site
(`python3 -m http.server`) e abra `http://localhost:8000/leitura/`.
Abrir o arquivo direto (`file://`) não funciona, porque o navegador
bloqueia a leitura dos JSON.

```
leitura/
  index.html          página do jogo (estilos da lousa e das janelas)
  app.js              telas Sistema e Constelação, palavras, síntese, menu
  lousa.js            superfície SVG em tela cheia com arrastar e zoom
  shared/base.js      API da Bíblia, leitor (com palavras que brilham), janelas, progresso, diário
  shared/base.css     estilos comuns, mobile primeiro, tema claro/escuro
  conteudo/sistema.json   planetas da tela de seleção
  conteudo/descanso.json  a constelação Descanso
```

O progresso de cada constelação e o diário ficam no `localStorage` do
aparelho.

### Tradução (API da AO Lab)

O texto vem da [Free Use Bible API](https://bible.helloao.org/), da AO
Lab: `GET /api/available_translations.json` e
`GET /api/{tradução}/{livro}/{capítulo}.json`. O jogo procura uma
tradução em português chamada NVI. Se a API não tiver a NVI, o que é
provável, porque ela só publica textos de uso livre e a NVI pertence à
Biblica, o jogo pede para você escolher outra tradução em português. Os
capítulos já baixados ficam em cache.

Os pacotes não contêm texto bíblico, só referências OSIS (`Gen.2.3`), que
o leitor resolve na tradução escolhida.

## Formato do conteúdo

### `sistema.json`

```jsonc
{ "corpos": [
  { "id": "descanso", "titulo": "Descanso", "pacote": "descanso.json", "cor": "#d9a441", "raio": 62 },
  { "id": "cordeiro", "titulo": "O Cordeiro", "pacote": null, "cor": "#c7685a", "raio": 48, "luas": 2 }  // sem pacote: desconhecido
] }
```

### Pacote de constelação

```jsonc
{
  "prototipo": "constelacao", "versao": 3,
  "tema": "...", "pergunta_central": "...",
  "convite": { "pergunta": "...", "opcoes": [{ "texto": "...", "leva_a": "<id de nó ou null>" }] },
  "passagens": { "<id>": { "ref": "Gn 2:1-3", "osis": "Gen.2.1-Gen.2.3", "contexto": "opcional" } },
  "nos": [{
    "id": "...", "tipo": "inicio | pergunta | sintese", "titulo": "...",
    "pergunta": "...", "passagem": "<id>",
    "evidencia": ["Gen.2.3"],            // qualquer um conta como acerto
    "dica": "Gen.2.2-Gen.2.3",           // mostrada depois de 2 erros
    "retorno_erro": "opcional",
    "previsao": { "pergunta": "...", "opcoes": ["..."], "correta": 0, "retorno": "..." },  // opcional
    "revelacao": "...",
    "pistas": [{ "para": "<id>", "tipo": "citacao | mesma_palavra | alusao | tema", "texto": "..." }],
    "requer": ["<ids>"], "requer_palavras": ["<ids>"],   // só na síntese
    "deducao": {                                        // só na síntese
      "fichas": [{ "texto": "shavat", "palavra": "shabat" }],
      "frases": [{ "id": "f1", "modelo": "… {a} …", "lacunas": { "a": "shavat" } }]
    }
  }],
  "palavras": [{
    "id": "shabat", "titulo": "Shabat", "original": "שַׁבָּת", "transliteracao": "shabat", "lingua": "hebraico",
    "pergunta_inicial": "...",
    "letras": [{ "glifo": "ש", "nome": "Shin", "som": "sh", "valor": 300, "papel": "raiz", "desenho": "dente" }],
    "raiz": { "letras": "ש ב ת", "translit": "sh-b-t", "sentido": "cessar", "familia": [{ "palavra": "…", "translit": "…", "sentido": "…" }] },
    "ocorrencias": [{ "verso": "Gen.2.2", "formas": ["repousou", "descansou"], "nota": "opcional" }],
    "facetas": [{ "id": "...", "descricao": "...", "no": "<nó cuja passagem revela esta faceta>" }],
    "sintese": "..."
  }]
}
```

- `formas` são as palavras do texto que brilham naquele versículo:
  palavras inteiras, ou radicais terminados em `*`. Liste as variações das
  traduções mais comuns ("sábado", "repouso"…). Num mesmo versículo, duas
  palavras hebraicas podem ter formas diferentes (em Êx 20:11, "repouso" é
  *shabat* e "repousou" é *nuach*).
- Uma faceta é perguntada quando o jogador toca numa forma que brilha
  dentro da passagem do nó indicado em `no`.
- As fichas da síntese são exatamente as respostas: cada uma vai numa
  lacuna, sem sobras.

## Diário

O jogo pergunta sozinho:

- **no fim da sessão** (menu → Encerrar): que perguntas surgiram sem o
  jogo pedir, onde foi o seu tempo (lendo ou na interface) e onde travou;
- **ao abrir num dia novo:** se você voltou por vontade própria;
- **3 dias depois da primeira sessão:** o que você lembra, de memória,
  antes de ver o conteúdo.

O diário pode ser copiado em JSON pelo menu.
