# Turbo Kart 🏎

Corrida de kart **3D** (estilo Mario Kart) para **2 jogadores** em tela dividida, no navegador do computador. O **celular é o volante**: ele tem botões de acelerar, frear/ré e item, e a direção pode ser feita pelo **giroscópio** (girando o celular como um volante) ou por um **volante virtual** na tela.

## Modos (3 voltas)

- **🏆 Competição**: os dois jogadores + 4 karts da CPU. Quem terminar na frente do outro vence. Os itens acertam todo mundo.
- **🤝 Cooperativo**: equipe contra 2 karts da CPU mais rápidos. As posições viram pontos (10/7/5/3) e a equipe com mais pontos vence. Sem fogo amigo: seus itens não atingem o parceiro.

## Como jogar

1. Abra `kart/` no computador. Ele precisa de WebGL, que qualquer navegador atual tem.
2. Cada jogador escaneia o QR code com o celular, ou abre `kart/controller.html` e digita o código.
3. Escolham o modo. Na **tela de seleção de piloto** (no estilo Mario Kart), o celular vira um controle: use o **direcional ◀ ▲ ▼ ▶** para mover o seu cursor (1P/2P) pela grade, **Ⓐ OK** para confirmar e **Ⓑ Voltar** para desfazer a escolha ou, se ninguém confirmou, voltar ao menu de modo. À direita, o kart do piloto que está sob o seu cursor gira numa plataforma, com os atributos ao lado. Os dois jogadores podem escolher o mesmo piloto. Os quadrados "?" são vagas para os próximos personagens.
4. Segure o celular **na horizontal**:
   - **⚡ ACELERAR** (botão grande à direita), **🛑 FREAR / RÉ** e **🎁 ITEM**.
   - **🎡 Volante**: arraste o volante da esquerda girando-o. Ele volta sozinho ao centro.
   - **📱 Giroscópio**: gire o celular como um volante. O meio é ajustado na hora em que você ativa; use **🎯 Centralizar** para reajustar. No iPhone, o navegador pede permissão. O giroscópio só funciona com o site em **HTTPS** (o GitHub Pages já é).

**Dicas:** segure o acelerador durante o "1" da contagem para ganhar uma **largada turbo**. Sair da pista (grama) deixa o kart lento. As placas laranjas com setas dão turbo.

### Itens (caixas "?" na pista)

| Item | Efeito |
|---|---|
| 🍄 Cogumelo turbo | Arrancada de velocidade |
| 🍌 Banana | Fica na pista atrás de você; quem passar por cima rodopia |
| 🔴 Casco teleguiado | Persegue o kart logo à sua frente |
| ⭐ Estrela | Fica invencível e mais rápido por 6 s; quem encostar em você rodopia |

Quem está mais para trás recebe itens melhores.

### Sem celular

No lobby: `Espaço` = jogador ⌨ A (`W A S D` + `E` para item; menus com `1` `2`) e `Enter` = jogador ⌨ B (setas + `Shift direito` para item; menus com `9` `0`). Na seleção de piloto: A usa `W A S D`, `E` (OK) e `Q` (voltar); B usa as setas, `Enter` (OK) e `Backspace` (voltar).

## Personagens

Os pilotos são dois **Miis** (`models/mii-masculino.glb` e `models/mii-feminino.glb`, com compressão Draco):

- **Mii Masculino** (moletom laranja): velocista, mais rápido nas retas e com curva mais aberta.
- **Mii Feminino** (moletom rosa): equilibrada, acelera mais rápido e faz curvas mais fechadas.

Os modelos vêm em pé. O jogo **senta o piloto no kart** girando os ossos do esqueleto (coxas para a frente, canelas para baixo e mãos no volante; ver `SEAT_POSE` em `host.js`). Quando o jogador cruza a linha de chegada, o piloto **acena**: o jogo usa a animação "Wave" do arquivo, mas só da cintura para cima.

Os retratos da grade de seleção são gerados na hora a partir dos próprios modelos 3D, com um close no rosto. A grade tem 12 vagas (6 colunas, constante `PICK_COLS` em `host.js`) e cresce sozinha se houver mais personagens.

Para trocar ou adicionar personagens, edite `characters.js`: nome, descrição, cores, atributos (`speed`, `accel`, `handling`) e o bloco `model` (arquivo, escala e posição no assento). Novos modelos com o mesmo esqueleto dos Miis (`thigh.L`, `shin.L`, `upperarm.L`…) já sentam sozinhos. Modelos com outro esqueleto podem usar `pose: false` e vir sentados do Blender. Se um modelo não carregar, o jogo usa um boneco placeholder.

## Técnico

- 3D com [three.js](https://threejs.org/) r160 (em `vendor/`, sem build), carregado como módulo ES. Os modelos .glb são carregados com GLTFLoader + DRACOLoader e clonados com SkeletonUtils, porque vários karts podem usar o mesmo personagem.
- Pista gerada a partir de uma curva Catmull-Rom (`CONTROL` em `host.js`), com raio mínimo de curva maior que a distância do muro, para a geometria nunca se dobrar.
- Física arcade em passo fixo de 120 Hz. A CPU segue a pista com "elástico" para manter a corrida disputada.
- Conexão celular ↔ computador por WebRTC com [PeerJS](https://peerjs.com/), como nos outros jogos (`../game/vendor/`). O celular envia volante, pedais e item ~30×/s. Para usar um servidor PeerJS próprio, defina `window.KART_PEER_OPTS`.
