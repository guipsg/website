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

## Criar e compartilhar estudos: o mural

Criar um estudo é estudar: você lê, anota, liga uma ideia à outra e volta
a cada anotação para aprofundá-la. O estudo jogável é o que amadurece
nesse mural.

Em Temas, toque no "+" e em **Criar estudo**. O mural usa o mesmo quadro
do jogo, com uma barra embaixo: **+ Nota, Ler, Falta, Testar, Estudo**.

- **Anotar:** toque duas vezes no vazio (ou em "+ Nota") e escreva o que
  percebeu, do seu jeito.
- **Ler e fixar:** "Ler" abre qualquer trecho, inclusive um capítulo
  inteiro (`Gn 2`). Toque nos versículos que chamaram atenção e em
  "Fixar no mural": nasce uma nota com o texto e esses versículos.
- **Aprofundar em camadas:** tocar numa nota a seleciona; tocar de novo
  (ou "Aprofundar") abre as camadas dela, já na do próximo passo:
  1. **Nota:** o que você percebeu (e, se quiser, um nome curto no mapa);
  2. **Texto:** a passagem, escrita em português (`Gn 2:1-3`), com o
     trecho logo abaixo para conferir;
  3. **Pergunta:** que pergunta isso desperta;
  4. **Resposta:** os versículos que respondem, marcados no leitor
     (e uma dica opcional);
  5. **Revelação:** o que se entende ao achar a resposta.

  Em "Mais" ficam o papel no jogo, a síntese, o retorno ao errar e a
  previsão. As marquinhas sobre a nota mostram as camadas feitas. Com
  texto, pergunta, resposta e revelação, a nota **amadurece**: fica sólida
  e passa a entrar no jogo. As outras continuam no mural como anotação
  sua e não atrapalham nada.
- **Ligar:** com uma nota selecionada, puxe a bolinha ao lado dela até
  outra nota, como um fio. A ligação nasce fina e pontilhada; toque nela
  para dizer **por que** as notas se ligam (vira a pista do jogo) e o
  tipo. Com motivo, ela fica sólida e mais grossa. Dá para inverter o
  sentido ou desfazer.
- **Pulso:** ao tocar numa nota, um sinal corre pelas ligações até as
  vizinhas e as vizinhas delas, como entre neurônios. Notas com muitas
  ligações ganham um halo mais forte.
- **Arrastar** uma nota muda o lugar dela; arrastar o vazio move o mural.
- **Falta** mostra o que impede jogar, o próximo passo de cada nota em
  andamento (tocar leva direto à camada) e conselhos de design.
- **Testar** joga só as notas maduras, do zero, com "Voltar ao editor"
  no fim. Uma nota madura sem ligação madura chegando é um começo do
  jogo; em "Mais" dá para marcar outras como começo.
- **Estudo** tem título, descrição, pergunta central, cor, autor,
  licença e **Exportar**, que sobe a versão e oferece o arquivo
  (`.estudo.json`) para baixar ou copiar. O arquivo leva o mural inteiro:
  quem joga vê as notas maduras, e quem duplica vê também as anotações em
  andamento do autor.

### O estudo como artigo

No fim, o mural vira um texto corrido, no estilo de uma newsletter
(Substack). Ele aparece em três lugares: no botão **Artigo** do cartão em
Temas, em **Ler como artigo** ao terminar um estudo e no mural (em
"Estudo", ou em "Falta" quando todas as notas amadureceram).

- **Cabeçalho:** título, a pergunta central como subtítulo, autor, data e
  tempo de leitura.
- **Seções:** cada nota madura vira uma, com o nome, a pergunta, a nota de
  quem criou, os versículos da resposta (buscados na tradução em uso) e a
  revelação. A ordem segue as ligações: uma nota vem depois das que levam
  até ela, e a síntese fecha. O motivo de cada ligação aparece como ponte
  antes da nota seguinte.
- **Fim:** as palavras do estudo, se houver, e **Ainda em aberto**, com as
  notas em andamento como perguntas.
- **Copiar** leva o artigo com formatação, para colar no editor do
  Substack. **Baixar** gera uma página HTML avulsa.

### Estudo de referência: O Cordeiro

"O Cordeiro" vem com o jogo como exemplo de mural deixado quase incompleto
de propósito.

- **Maduras (3):** "Deus proverá" (Gn 22), "Sangue na porta" (Êx 12) e
  "Eis o Cordeiro" (Jo 1). Elas já dão um jogo curto.
- **Em andamento (5):** cada uma numa camada diferente.
  - Só a nota: Abel e 1 Pedro.
  - Nota e texto: Ap 5.
  - Até a pergunta: Is 53.
  - Faltando só a revelação: Jo 19.
- **Ligações:** algumas com motivo, outras ainda sem.

Abra o artigo dele para ver como fica um estudo em andamento. Para mexer,
use "Duplicar para editar".

Tudo é salvo no aparelho a cada mudança. Quem recebe o arquivo abre pelo
menu → **Importar estudo**, escolhendo o arquivo ou colando o texto. A
importação confere a estrutura e os erros antes de instalar, e mostra o
título, o autor, a licença e o tamanho do estudo. Se o estudo já existe
no aparelho, a versão nova substitui a antiga e o progresso continua.

O conteúdo importado é sempre exibido como texto, nunca como HTML.

O mural ainda não cria palavras hebraicas nem a síntese de arrastar. Um
estudo duplicado mantém as dele, e elas podem ser movidas.

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
  editor.js           mural de estudo (criação)
  artigo.js           o estudo lido como artigo, para copiar ou baixar
  estudos.js          formato dos estudos, armazenamento, referências em português, validação
  desenho.js          desenho de nós e pistas, posicionamento
  lousa.js            superfície SVG em tela cheia com arrastar e zoom
  shared/base.js      API da Bíblia, leitor (palavras que brilham, seleção de versículos), janelas, progresso, diário
  shared/base.css     estilos comuns, mobile primeiro, tema claro/escuro
  conteudo/sistema.json   estudos que vêm com o jogo e temas desconhecidos
  conteudo/descanso.json  o estudo Descanso
  conteudo/cordeiro.json  O Cordeiro, mural de referência quase incompleto
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

### Estudo (formato 5)

O mesmo arquivo serve para os estudos do jogo, os criados no mural e os
trocados entre pessoas. O formato 5 permite notas ainda em andamento: o
jogo usa só as maduras (com passagem, pergunta, resposta dentro da
passagem e revelação). O formato 4 continua sendo lido.

```jsonc
{
  "formato": "estudo-biblico", "versao_formato": 5,
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
    "id": "...", "tipo": "inicio | pergunta | sintese", "titulo": "nome no mapa (opcional)",
    "nota": "o que quem criou percebeu (não aparece no jogo)",
    "pergunta": "...", "passagem": "<id>",
    "evidencia": ["Gen.2.3"],            // qualquer um conta como acerto
    "dica": "Gen.2.2-Gen.2.3",           // mostrada depois de 2 erros
    "retorno_erro": "opcional",
    "previsao": { "pergunta": "...", "opcoes": ["..."], "correta": 0, "retorno": "..." },  // opcional
    "revelacao": "...",
    "pistas": [{ "para": "<id>", "tipo": "citacao | mesma_palavra | alusao | tema", "texto": "o motivo da ligação" }],
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
- `tipo` "pergunta" quer dizer automático: a nota começa o jogo se nenhuma
  ligação madura chega nela. "inicio" força o começo.
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
