---
name: curiosity-learning-design
description: "Projeta e audita experiências de aprendizagem movidas por curiosidade, inspiradas na análise de Outer Wilds (Adam Comella, 'Learning Design Insights from Outer Wilds'): recompensa por conhecimento em vez de recompensa extrínseca, autonomia sem objetivos impostos, falha barata como progresso, teia de Curiosidades e Pistas e mapa de conhecimento (ship log). Use em jogos educativos, de estudo ou de descoberta, e em qualquer design onde aprender seja a própria progressão (modos: design, audit, motivation, map, prototype)."
---

# Curiosity Learning Design

## Propósito

Transforme os insights de aprendizagem extraídos de *Outer Wilds* em um
procedimento prático para desenhar experiências em que **o jogador
aprende porque quer saber**, e não porque é mandado ou pago para isso.

A pergunta central não é "como motivo o jogador?", e sim **"que condições
crio para que ele se motive sozinho?"**. Esta skill usa o artigo como
lente de análise e repertório de técnicas, não como receita.

## Quando usar

- jogos educativos, de estudo, de investigação ou de descoberta;
- produtos em que o conhecimento do jogador é a progressão principal;
- decidir entre recompensas (pontos, badges, streaks) e outras formas de
  motivação;
- desenhar onboarding sem objetivos explícitos;
- desenhar ou revisar um mapa/grafo de conhecimento (estilo ship log);
- diagnosticar por que jogadores leem "por obrigação", pulam texto ou
  abandonam quando as recompensas acabam.

Não use para game feel de verbos em tempo real (use `game-feel`) nem como
substituto de uma análise sistêmica ampla (use `game-design-lens`). Esta
skill complementa ambas no eixo **motivação + aprendizagem**.

## Os cinco pilares

Detalhes, mecanismos e exemplos em
[references/principles.md](references/principles.md).

1. **Conhecimento como única recompensa.** O que persiste é o que o
   jogador sabe; o jogo muda o jogador, não o contrário. Evite
   recompensas tangíveis, esperadas e condicionadas à tarefa.
2. **Falha como progresso, vivida e não explicada.** Torne falhar barato
   e informativo; faça certas descobertas *exigirem* tentativas
   malsucedidas; cerque o jogador de modelos (personagens, textos) que
   tratam erro como avanço. Nunca pregue "mentalidade de crescimento".
3. **Autonomia.** Nenhum objetivo atribuído; quase nenhuma tarefa
   obrigatória; mundo explorável em qualquer ordem. Quando o vazio
   paralisa, **pergunte** ao jogador o que ele quer fazer, com poucas
   opções sugestivas e não vinculantes.
4. **Arquitetura de curiosidade.** Curiosidade → pista → exploração
   intencional → conhecimento. Estruture o conteúdo como uma teia de
   **Curiosidades** (respostas às grandes perguntas, de acesso exigente) e
   **Pistas** (fragmentos que revelam a existência de uma Curiosidade e
   apontam para outras pistas). Sinalize o que é relevante e faça todo
   texto conter algo acionável.
5. **Mapa de conhecimento.** Uma representação externa que cresce com o
   jogador e distingue *sei*, *ouvi falar* e *desconheço*. Serve como
   referência, convite ao desconhecido e sensação de progresso.

## Procedimento

### 1. Defina o contrato de aprendizagem

- O que o jogador deve **entender** ao final (as grandes perguntas)?
- Que conhecimento é **necessário** e qual é ambientação?
- Como o jogador *demonstra* que sabe algo (o conhecimento destrava
  acesso, interpretação ou ação)?
- Quais restrições existem (sessão curta, mobile, público, conteúdo
  real que não pode ser alterado)?

Separe `Observado`, `Inferido`, `Desconhecido` e `Assumido`.

### 2. Escreva as grandes perguntas primeiro

Liste de 3 a 7 perguntas que o jogador vai querer responder. Cada uma
vira uma **Curiosidade**. Uma pergunta que só o designer acha
interessante não é uma Curiosidade: valide-a com jogadores.

### 3. Monte a teia de Curiosidades e Pistas

- Ponto de partida: cada Curiosidade com cerca de três Pistas em lugares
  distintos; cada Pista entrega um pedaço do conhecimento necessário e
  aponta para outra Pista.
- Aceite a bagunça real: pistas em cadeia, pistas que não apontam para
  nada. Verifique só se **toda Curiosidade é alcançável por mais de um
  caminho**.
- Para cada Pista, escolha a técnica que desperta a pergunta (ver
  catálogo em `references/principles.md`): objeto distante visto, objeto
  distante mencionado, instância que quebra um padrão, informação
  contraditória.

### 4. Audite a motivação

Para cada recompensa, feedback ou sinal de progresso, classifique:

| Tipo | Efeito esperado (tarefas interessantes) |
|---|---|
| Tangível, esperado, condicionado à tarefa (pontos por capítulo, moeda por quiz) | tende a **reduzir** a motivação intrínseca de livre escolha |
| Verbal/informativo, inesperado (revelação, conexão, feedback sobre o que se entendeu) | tende a **aumentar** a motivação intrínseca |

Substitua o primeiro tipo pelo segundo sempre que possível. Trate a
pesquisa com humildade (ver "Cautelas").

### 5. Audite a autonomia

- Existe algum objetivo imposto? Algum passo obrigatório além do mínimo?
- O jogador escolhe a ordem? Consegue dizer *por que* foi para onde foi?
- Onde ele pode se sentir perdido? Ofereça um **convite com escolhas**
  (3 a 6 opções + "não sei"/"vou improvisar"), nunca uma ordem.

### 6. Audite a relevância

- Áreas com informação são visualmente distintas das vazias?
- Todo trecho de texto contém algo acionável?
- O jogador consegue distinguir pista de ambientação sem um marcador
  explícito de "importante"?

### 7. Desenhe o mapa de conhecimento

Defina estados (ex.: explorado em cor, ouvido falar em cinza/"?",
desconhecido em branco), as vistas (espacial e por relações/rumores), o
que cada nó mostra ao ser inspecionado e como o mapa começa quase vazio.

### 8. Prototipe e teste a pergunta mais arriscada

Prefira papel, cartões ou mock. Observe:

- que perguntas os jogadores formulam **em voz alta**;
- se exploram com intenção ou ao acaso;
- se conseguem dizer o que sabem e o que querem descobrir;
- onde ficaram paralisados pela falta de objetivo;
- se voltam ao mapa sem serem lembrados;
- o que fizeram depois que falharam.

## Formato de resposta

Adapte ao pedido, incluindo o que for útil:

- **Contrato de aprendizagem** e suposições;
- **Grandes perguntas** (Curiosidades);
- **Teia de Curiosidades e Pistas** (lista ou grafo em texto), com a
  técnica de curiosidade de cada pista;
- **Auditoria** de motivação, autonomia, falha e relevância: achado →
  causa → mudança → risco;
- **Mapa de conhecimento**: estados, vistas, conteúdo dos nós;
- **Menor protótipo/playtest** e o que observar;
- **Questões em aberto**.

## Modos

- **DESIGN:** a partir de um tema ou conteúdo, gere grandes perguntas,
  teia de pistas e mapa.
- **AUDIT:** examine um design existente pelos cinco pilares e
  priorize por impacto.
- **MOTIVATION:** foque em recompensas, feedback e o risco de
  substituir motivação intrínseca por extrínseca.
- **MAP:** desenhe ou revise o mapa/grafo de conhecimento.
- **PROTOTYPE:** traduza a dúvida principal no menor teste observável.

## Cautelas

- **A pesquisa sobre recompensas extrínsecas é disputada** (debate
  Deci × Cameron). Não afirme como fato que "recompensas destroem a
  motivação". Use só os dois pontos em que ambos os lados parecem
  concordar, e apenas para **tarefas já interessantes**: recompensas
  tangíveis, esperadas e condicionadas reduzem a motivação intrínseca de
  livre escolha; feedback verbal, inesperado e informativo a aumenta.
- Autonomia não é abandono: alguns jogadores ficam desconfortáveis sem
  objetivo. Ofereça apoio que **pergunta**, não que manda.
- Autonomia não exclui pedir ajuda.
- "Falha barata" exige que a falha **ensine** algo; falha sem informação
  é só punição sem custo.
- Um mapa completo desde o início sobrecarrega; um mapa que só registra
  sem mostrar o desconhecido não convida.
- Nada disso substitui playtest. Outer Wilds precisou de muitos testes
  para que a ausência de objetivos funcionasse.

## Anti-padrões

- Pontos, badges, streaks ou moeda como motor principal de algo que
  deveria ser interessante por si.
- Quest log com ordens ("vá até X") em vez de perguntas.
- Texto de lore que não serve para nada além de ambientar.
- Explicar ao jogador que errar faz parte, em vez de fazê-lo viver isso.
- Punir a falha com perda de progresso de conhecimento.
- Mostrar o mapa inteiro de uma vez.
- Declarar que o design "desperta curiosidade" sem ver jogadores
  formulando perguntas.

## Fonte

Síntese de Adam Comella, *Learning Design Insights from Outer Wilds:
Curiosity, Autonomy, Growth Mindset, and Intrinsic Motivation*
(Learning About Learning, 2023-11-23,
https://rigdern.github.io/a/learning-about-learning/learning-design-insights-from-outer-wilds/index.html).
Escrita em linguagem própria; não reproduz a prosa do artigo. O artigo
se apoia em Deci (*Why We Do What We Do*), Dweck (*Mindset*), Lillard
(*Montessori*), Chris Hecker (*Achievements Considered Harmful?*) e nas
palestras de Alex e Kelsey Beachum sobre Outer Wilds.
