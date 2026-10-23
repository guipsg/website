# Laboratório de leitura bíblica

Protótipos pessoais para testar **como** um conteúdo bíblico é absorvido.

Depois da primeira rodada de testes, Cadernos saiu e as três mecânicas que
funcionaram (dedução, léxico e linha do tempo) foram juntadas sobre o grafo
de perguntas, na **Constelação**. As versões separadas continuam disponíveis
para comparação.

| Protótipo | Pacote | Tema | O que precisa provar |
|---|---|---|---|
| **Constelação** (combinado) | `conteudo/descanso.json` | Descanso | Palavras, síntese em bloco e previsões fazem abrir mais passagens, ou só dão mais trabalho? |
| Mesa de dedução | `conteudo/3-deducao.json` | Melquisedeque | Dá para ter o "eureka" sem parecer prova? |
| Léxico vivo | `conteudo/4-lexico.json` | *Hesed*, *kavod*, *shalom* | Estudar palavras sustenta a curiosidade sozinho? |
| Linha da promessa | `conteudo/5-promessa.json` | O descendente prometido | O panorama puxa para frente mesmo sendo linear? |

> Os pacotes contêm as respostas. Se quiser jogar sem saber, não abra os
> JSON. Deixe o protótipo mostrar.

## Como usar

Abra `leitura/` no navegador do celular. No site publicado, o endereço é
`<seu-site>/leitura/`. A página não aparece no hub de propósito, porque é
de uso pessoal.

Os arquivos são estáticos e não precisam de build. Para rodar no
computador, sirva a pasta raiz do site (`python3 -m http.server`) e abra
`http://localhost:8000/leitura/`. Abrir o arquivo direto (`file://`) não
funciona, porque o navegador bloqueia a leitura dos JSON.

```
leitura/
  index.html          início: protótipos, tradução, diário (copiar/baixar)
  shared/base.js      API da Bíblia, leitor de passagens, janelas, progresso, diário
  shared/base.css     estilos comuns, mobile primeiro, tema claro/escuro
  constelacao/        protótipo combinado
  deducao/            mesa de dedução (separada)
  lexico/             léxico vivo (separado)
  promessa/           linha da promessa (separada)
  conteudo/           pacotes JSON
```

O progresso de cada protótipo e o diário ficam no `localStorage` do
aparelho. Use "Recomeçar" na página inicial para zerar um protótipo, e
"Baixar diário" para guardar as respostas fora do navegador.

### Tradução (API da AO Lab)

O texto vem da [Free Use Bible API](https://bible.helloao.org/), da AO
Lab: `GET /api/available_translations.json` e
`GET /api/{tradução}/{livro}/{capítulo}.json`. A base procura uma tradução
em português chamada NVI (ou "Nova Versão Internacional"). **Se a API não
tiver a NVI, o que é provável, porque a API só publica textos de uso livre
e a NVI pertence à Biblica**, o laboratório pede para você escolher outra
tradução em português. A escolha pode ser trocada a qualquer momento no
topo de cada protótipo ou na página inicial. Os capítulos já baixados
ficam em cache no aparelho.

## Base comum

Todos os protótipos compartilham:

1. **O mesmo leitor de passagens**: texto limpo, sem elementos de jogo,
   com toque em um versículo para selecioná-lo e confirmação explícita.
2. **O mesmo formato de passagem** (abaixo).
3. **O mesmo diário pós-sessão** (abaixo).

Assim, o que muda entre eles é só a camada de jogo, e a comparação mede
a mecânica, não a interface de leitura.

### Texto bíblico

Os pacotes **não contêm texto bíblico**, só referências. O leitor busca
cada referência OSIS na API da AO Lab, na tradução escolhida (ver "Como
usar").

Atenção: os códigos OSIS seguem a numeração de versículos usual das
Bíblias em português e inglês. Ela difere da numeração hebraica em alguns
Salmos e em Isaías 9.

## Formato comum

Todo pacote tem:

```jsonc
{
  "prototipo": "constelacao | deducao | lexico | promessa",
  "versao": 1,                      // a Constelação usa 2
  "tema": "texto curto",
  "pergunta_central": "a grande pergunta que o pacote responde",
  "convite": {                      // autonomia: pergunta em vez de missão
    "pergunta": "texto",
    "opcoes": [{ "texto": "...", "leva_a": "id opcional" }]
  },
  "passagens": {
    "<id>": {
      "ref": "Gn 2:2-3",            // exibição em português
      "osis": "Gen.2.2-Gen.2.3",    // intervalo exibido no leitor
      "contexto": "Gen.2.1-Gen.2.4", // opcional: trecho maior que contém a passagem, oferecido como "ler o contexto"
      "ver_tambem": ["Gen.22.15-Gen.22.18"] // opcional: referências em outros lugares
    }
  }
  // ...campos específicos da mecânica (ver abaixo)
}
```

**Evidência** é sempre uma lista de versículos OSIS individuais
(`"Gen.2.3"`). Qualquer um deles conta como acerto. **Dica** é um
intervalo OSIS menor que a passagem, mostrado depois de 2 erros, para
afunilar a busca sem entregar a resposta.

Errar nunca tira progresso. Toda resposta errada mostra um retorno
informativo (`retorno_erro`) ou genérico ("esse trecho fala de outra
coisa, continue procurando").

### Constelação (combinado)

O pacote tem `epocas`, `nos` e `palavras`.

```jsonc
"epocas": [{ "id": "criacao", "titulo": "Criação" }],   // em ordem: a vista Linha segue esta ordem
"nos": [{
  "id": "...",
  "tipo": "inicio | pergunta | sintese",
  "titulo": "...",
  "epoca": "<id de epocas>",
  "silhueta": "o que a vista Linha mostra enquanto o nó está oculto",
  "pergunta": "...",
  "passagem": "<id>",
  "evidencia": ["..."], "dica": "...",          // não usados no nó com "deducao"
  "previsao": { "pergunta": "...", "opcoes": ["..."], "correta": 0, "retorno": "..." }, // opcional
  "revelacao": "...",
  "pistas": [{ "para": "<id>", "tipo": "citacao | mesma_palavra | alusao | tema", "texto": "..." }],
  "requer": ["<ids>"],                          // só na síntese
  "deducao": {                                  // só na síntese: um bloco de frases
    "banco_termos": ["..."],
    "frases": [{ "id": "f1", "modelo": "… {a} …", "lacunas": { "a": "termo" } }]
  }
}],
"palavras": [{
  "id": "shabat", "titulo": "Shabat", "original": "שַׁבָּת", "transliteracao": "shabat", "lingua": "hebraico",
  "aparece_apos": 2,          // passagens resolvidas antes de a palavra surgir no mapa
  "confirmar_apos": 3,        // tamanho do grupo de escolhas conferidas juntas
  "pergunta_inicial": "...",
  "letras": [{ "glifo": "ש", "nome": "Shin", "som": "sh", "valor": 300, "papel": "raiz | prefixo… | terminação…", "desenho": "dente" }],
  "raiz": { "letras": "ש ב ת", "translit": "sh-b-t", "sentido": "cessar", "familia": [{ "palavra": "…", "translit": "…", "sentido": "…" }] },
  "facetas": [{ "id": "...", "descricao": "...", "no": "<id do nó que revela esta faceta>" }],
  "facetas_distratoras": [{ "id": "...", "descricao": "..." }],
  "sintese": "..."
}]
```

Regras:

- Um nó fica **oculto** até uma pista resolvida apontar para ele. No
  grafo ele não aparece. Na vista Linha, aparece como silhueta na sua época.
- Antes de ler um nó com `previsao`, o jogador pode prever a resposta (ou
  pular). O acerto aparece depois, sem afetar o progresso.
- Uma palavra surge quando `aparece_apos` passagens foram resolvidas e
  uma das passagens dela também. Ao resolver uma passagem ligada a uma
  palavra já visível, o jogador escolhe qual faceta aquela passagem revela.
  As escolhas são conferidas em grupos de `confirmar_apos`.
- As letras mostram nome, som, valor e papel na palavra. O `desenho` é a
  origem do nome da letra e aparece marcado como curiosidade: ele não
  define o sentido da palavra. O sentido vem da **raiz** e da família dela.
- A síntese abre quando todos os `requer` estão resolvidos e se confirma
  só quando todas as frases do bloco estão certas.

### Mesa de dedução

```jsonc
"cartas": [{ "id": "c1", "passagem": "<id>" }],
"banco_termos": ["...", "..."],     // inclui distratores
"frases": [{
  "id": "f1",
  "modelo": "Melquisedeque era ao mesmo tempo {a} e {b}.",
  "lacunas": { "a": "rei", "b": "sacerdote" },
  "aceita_ordem_livre": true,       // opcional: {a} e {b} podem trocar
  "cartas_base": ["c1"]
}],
"blocos": [{ "frases": ["f1","f2","f3"], "revelacao": "mostrada quando o bloco fecha" }]
```

Uma frase nunca é validada sozinha. O protótipo só diz "este bloco está
certo" quando **as três frases do bloco** estão corretas, no estilo
*Return of the Obra Dinn*.

### Léxico vivo

```jsonc
"palavras": [{
  "id": "hesed",
  "original": "חֶסֶד",
  "transliteracao": "hesed",
  "lingua": "hebraico",
  "traducoes_comuns": ["misericórdia", "bondade", "..."],
  "pergunta_inicial": "provocação antes da primeira ocorrência",
  "facetas": [{ "id": "...", "descricao": "..." }],
  "facetas_distratoras": [{ "id": "...", "descricao": "..." }],
  "ocorrencias": [{ "passagem": "<id>", "faceta": "<id>", "nota": "revelada depois da escolha" }],
  "confirmar_apos": 4,
  "sintese": "definição de referência, comparada com a do jogador no fim"
}]
```

Fluxo: o jogador lê uma ocorrência e anota livremente o que acha que a
palavra significa ali. Depois escolhe qual faceta (entre as verdadeiras
e as distratoras, embaralhadas) aquela ocorrência revela. As escolhas não
são corrigidas uma a uma. Elas são validadas em lote a cada
`confirmar_apos` ocorrências, e só então as `nota`s aparecem. No fim, ele
escreve a própria definição e a compara com a `sintese`.

### Linha da promessa

```jsonc
"epocas": [{
  "id": "...",
  "titulo": "...",
  "passagem": "<id>",
  "evidencia": ["..."],
  "acrescimo": "o que a promessa ganha nesta época",
  "silhueta_da_proxima": "teaser vago da época seguinte",
  "previsao": {                    // feita antes de abrir a próxima época
    "pergunta": "...",
    "opcoes": ["...", "..."],
    "correta": 0,
    "retorno": "explicação mostrada depois"
  }
}]
```

## Diário pós-sessão (igual em todos)

Os protótipos fazem essas perguntas sozinhos: as três primeiras no botão
"Encerrar", a quarta quando você abre num dia novo e a quinta 3 dias
depois da primeira sessão, antes de mostrar o conteúdo.

Responda em menos de 1 minuto, logo depois de cada sessão:

1. Que perguntas surgiram **sem o jogo pedir**? (escreva quais)
2. Quanto do tempo foi lendo o texto e quanto mexendo na interface?
   (estimativa)
3. Onde travou ou perdeu a vontade?

No dia seguinte:

4. Abri sem lembrete? (sim/não)

De 3 a 7 dias depois, sem consultar nada:

5. Escreva de memória o que aprendeu com o pacote.

**Critério final:** vence o protótipo com mais "abri sem lembrete" e a
melhor lembrança tardia. Ideias dos outros podem ser incorporadas a ele.
