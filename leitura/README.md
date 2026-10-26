# Laboratório de leitura bíblica

Protótipo pessoal de um jogo de estudo bíblico inspirado no ship log de
*Outer Wilds*: você avança porque entende, não porque ganha pontos.

Ele saiu de uma rodada de testes com cinco protótipos. Cadernos foi
descartado, e as mecânicas que funcionaram (grafo de perguntas, léxico,
dedução) foram juntadas num jogo só. Um editor permite criar estudos
novos e trocá-los com outras pessoas em arquivo.

## Como o jogo funciona

Duas telas num quadro de tela cheia (papel pontilhado, claro ou escuro
conforme o tema do aparelho). Arraste para mover; aproxime com pinça, roda
do mouse ou os botões + e −. O botão ⤢ enquadra tudo.

1. **Temas:** a tela de seleção. Cada círculo é um estudo: os que vêm
   com o jogo, os que você criou e os que importou.
   - Preenchido com a cor do estudo: você já começou.
   - Só o contorno: disponível, ainda não começado.
   - Tracejado com "+": criar um estudo novo ou importar um.
   - Tracejado com "?": ainda desconhecido.

   Os pontinhos embaixo são as palavras hebraicas do estudo, preenchidos
   quando descobertos. Toque num estudo para ver o autor e as ações:
   Abrir, Editar (os seus), Duplicar para editar (os do jogo e os
   importados) e Excluir.
2. **Mapa de perguntas:** o grafo do tema.
   - **Nó de passagem:** um "?" aparece quando uma pista aponta para ele.
     Você lê e marca o versículo que responde. Alguns deixam prever a
     resposta antes de ler.
   - **Nós novos:** ao resolver um nó, nenhuma janela abre. As perguntas
     liberadas aparecem no mapa com um selo "!", que some quando você as
     abre. Um aviso no rodapé oferece "Ver o que entendi".
   - **Palavras que brilham:** durante a leitura, certas palavras do
     texto brilham. Tocar numa delas revela a palavra hebraica por trás
     (por exemplo, "repousou" → *shabat*), e o nó da palavra surge no mapa
     com "!". Numa passagem que mostra uma faceta da palavra, você escolhe
     qual é e a resposta é conferida na hora. Um número no nó da palavra
     indica facetas esperando resposta.
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

Um estudo termina na síntese de arrastar, quando tem uma, ou quando
todas as perguntas foram entendidas.

O menu (☰) tem a tradução, o diário, a importação de estudos, o
encerramento da sessão e a opção de recomeçar o estudo.

## Criar e compartilhar estudos

Em Temas, toque no "+" e em **Criar estudo**. O editor usa o mesmo
quadro do jogo, com uma barra embaixo:

- **+ Nó** cria uma pergunta no meio da vista e abre o painel dela.
- **Toque num nó** para editar: tipo (início, pergunta ou síntese),
  título, pergunta, passagem (escrita em português, como `Gn 2:1-3` ou
  `Mc 2:23–3:6`), contexto, evidência e dica (marcadas tocando nos
  versículos, no próprio leitor), revelação, retorno ao errar, previsão
  e, na síntese, quais perguntas ela exige. Cada campo tem uma frase de
  orientação.
- **Arraste um nó** para mudar o lugar dele. O quadro se move arrastando
  o vazio.
- **Ligar a outro nó** (no painel) cria uma pista: toque no nó de
  destino, escolha o tipo de ligação e escreva o texto. Tocar no vazio
  cancela.
- **Estudo** tem título, descrição, pergunta central, cor, autor e
  licença. O nome do autor fica guardado para os próximos estudos.
- **Verificar** lista os erros (impedem testar e exportar) e os avisos
  (conselhos de design, como perguntas que pedem só um fato). Tocar num
  item abre o nó. O topo mostra a contagem o tempo todo, e os nós com
  erro levam um "⚠".
- **Testar** joga o rascunho do zero, com um progresso separado, e
  "Voltar ao editor" no fim.
- **Exportar** sobe a versão do estudo e oferece o arquivo
  (`.estudo.json`) para baixar ou copiar.

Tudo é salvo no aparelho a cada mudança. Quem recebe o arquivo abre pelo
menu → **Importar estudo**, escolhendo o arquivo ou colando o texto. A
importação confere a estrutura e os erros antes de instalar, e mostra o
título, o autor, a licença e o tamanho do estudo. Se o estudo já existe
no aparelho, a versão nova substitui a antiga e o progresso continua.

O conteúdo importado é sempre exibido como texto, nunca como HTML.

Nesta fase o editor ainda não cria palavras hebraicas nem a síntese de
arrastar. Um estudo duplicado mantém as dele, e elas podem ser movidas no
mapa.

### Modo de teste

Para testar o fluxo rápido, ligue **Menu → Modo de teste**. O botão do menu
fica contornado em laranja enquanto o modo está ligado. Com ele, aparece
"⚡ Completar (teste)":

- num nó de passagem, marca como entendido sem ler (vale também para nós
  ainda bloqueados por requisitos);
- num nó de palavra, encontra todos os usos e confirma todas as facetas;
- na síntese, conclui o tema.

A escolha fica salva no aparelho até você desligar.

## Como rodar

Os arquivos são estáticos e não precisam de build. Sirva a raiz do site
(`python3 -m http.server`) e abra `http://localhost:8000/leitura/`.
Abrir o arquivo direto (`file://`) não funciona, porque o navegador
bloqueia a leitura dos JSON.

```
leitura/
  index.html          página do jogo (estilos da lousa, das janelas e do editor)
  app.js              telas Temas e mapa de perguntas, palavras, síntese, menu, importação
  editor.js           editor de estudos
  estudos.js          formato dos estudos, armazenamento, referências em português, validação
  desenho.js          desenho de nós e pistas, posicionamento
  lousa.js            superfície SVG em tela cheia com arrastar e zoom
  shared/base.js      API da Bíblia, leitor (palavras que brilham, seleção de versículos), janelas, progresso, diário
  shared/base.css     estilos comuns, mobile primeiro, tema claro/escuro
  conteudo/sistema.json   estudos que vêm com o jogo e temas desconhecidos
  conteudo/descanso.json  o estudo Descanso
```

O progresso de cada estudo, os estudos criados ou importados e o diário
ficam no `localStorage` do aparelho.

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
{
  "estudos": ["descanso.json"],                         // estudos que vêm com o jogo
  "desconhecidos": [{ "id": "cordeiro", "luas": 2 }]    // círculos "?"; "luas" = pontos de palavra
}
```

### Estudo (formato 4)

O mesmo arquivo serve para os estudos do jogo, os criados no editor e os
trocados entre pessoas.

```jsonc
{
  "formato": "estudo-biblico", "versao_formato": 4,
  "id": "descanso",                       // estável: o progresso fica guardado por ele
  "versao": 1,                            // sobe a cada exportação
  "criado_em": "…", "atualizado_em": "…",
  "autor": { "nome": "…" }, "licenca": "CC BY 4.0", "idioma": "pt-BR",
  "traducao_referencia": "porbr2018",     // a tradução usada ao escrever
  "titulo": "Descanso", "descricao": "…", "cor": "#d9a441",
  "pergunta_central": "...",
  "convite": { "pergunta": "...", "opcoes": [{ "texto": "...", "leva_a": "<id de nó ou null>" }] },  // opcional: sem ele, o jogo monta um com os nós de início
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
    "pos": { "x": 0, "y": 0 },           // opcional: lugar no mapa (o editor sempre grava)
    "requer": ["<ids>"], "requer_palavras": ["<ids>"],   // opcional: a pergunta só abre depois destes
    "deducao": {                                        // opcional, só na síntese de arrastar
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
    "sintese": "...",
    "pos": { "x": 0, "y": 0 }            // opcional
  }]
}
```

- Os arquivos não trazem texto bíblico, só referências OSIS.
- Um nó do tipo síntese sem `deducao` funciona como uma pergunta comum.
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
