# Laboratório de leitura bíblica

Protótipos pessoais para testar **como** um conteúdo bíblico é absorvido.
São cinco mecânicas sobre a mesma base, e cada uma recebe um tema
diferente para que um teste não estrague o seguinte.

O foco não é o conteúdo, e sim a forma de absorção. Os pacotes em
`conteudo/` existem para alimentar os protótipos e podem ser trocados.

| # | Protótipo | Pacote | Tema | O que precisa provar |
|---|---|---|---|---|
| 1 | Constelações | `conteudo/1-constelacoes.json` | Descanso | O "?" puxa para dentro do texto? O grafo é legível no celular? |
| 2 | Cadernos | `conteudo/2-cadernos.json` | O Cordeiro | A voz de um estudioso aumenta a vontade de seguir? Corrigir uma hipótese dá satisfação? |
| 3 | Mesa de dedução | `conteudo/3-deducao.json` | Melquisedeque | Dá para ter o "eureka" sem parecer prova? |
| 4 | Léxico vivo | `conteudo/4-lexico.json` | *Hesed*, *kavod*, *shalom* | Estudar palavras sustenta a curiosidade sozinho? |
| 5 | Linha da promessa | `conteudo/5-promessa.json` | O descendente prometido | O panorama puxa para frente mesmo sendo linear? |

> Os pacotes contêm as respostas. Se quiser jogar sem saber, não abra os
> JSON. Deixe o protótipo mostrar.

## Base comum

Os cinco protótipos devem compartilhar:

1. **O mesmo leitor de passagens**: texto limpo, sem elementos de jogo,
   com toque em um versículo para selecioná-lo e confirmação explícita.
2. **O mesmo formato de passagem** (abaixo).
3. **O mesmo diário pós-sessão** (abaixo).

Assim, o que muda entre eles é só a camada de jogo, e a comparação mede
a mecânica, não a interface de leitura.

### Texto bíblico

Os pacotes **não contêm texto bíblico**, só referências. O site é
público, e as traduções mais usadas em português têm direitos autorais.
O leitor resolve cada referência OSIS contra uma fonte de texto escolhida
por você: um arquivo local fora do repositório, ou uma tradução de
domínio público se os protótipos forem publicados.

Atenção: os códigos OSIS seguem a numeração de versículos usual das
Bíblias em português e inglês. Ela difere da numeração hebraica em alguns
Salmos e em Isaías 9.

## Formato comum

Todo pacote tem:

```jsonc
{
  "prototipo": "constelacoes | cadernos | deducao | lexico | promessa",
  "versao": 1,
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

### 1. Constelações

```jsonc
"nos": [{
  "id": "...",
  "tipo": "inicio | pergunta | sintese",
  "titulo": "rótulo curto do nó",
  "pergunta": "o que aparece enquanto o nó é '?'",
  "passagem": "<id de passagens>",
  "evidencia": ["Gen.2.3"],
  "dica": "Gen.2.2-Gen.2.3",
  "revelacao": "resumo que o nó mostra depois de resolvido",
  "pistas": [{ "para": "<id>", "tipo": "citacao | mesma_palavra | alusao | tema", "texto": "o que a pista diz" }],
  "requer": ["<ids>"]             // só no nó de síntese
}]
```

Estados de um nó: **oculto** (ninguém apontou para ele), **?** (uma
pista resolvida aponta para ele), **resolvido**. O nó `inicio` já começa
como **?**.

### 2. Cadernos

```jsonc
"estudioso": { "nome": "...", "apresentacao": "..." },
"anotacoes": [{
  "id": "...",
  "inicial": true,                // opcional: visível desde o começo; as demais surgem via "libera"
  "estado": "pergunta | hipotese | interrompida",
  "texto": "a anotação como o estudioso a deixou (primeira pessoa)",
  "passagem": "<id>",
  "acao_esperada": "confirmar | corrigir | completar",
  "evidencia": ["..."],
  "dica": "...",
  "revelacao": "o que o jogador entende ao resolver",
  "nota_do_estudioso_depois": "opcional: uma anotação posterior dele, que só aparece depois",
  "libera": ["<ids>"]
}],
"pergunta_final": { "texto": "...", "requer": ["<ids>"], "sintese": "..." }
```

O jogador escolhe a ação (confirmar, corrigir ou completar) e então marca
a evidência. Acerta quando a ação e o versículo batem.

### 3. Mesa de dedução

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

### 4. Léxico vivo

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

### 5. Linha da promessa

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

## Diário pós-sessão (igual nos cinco)

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
