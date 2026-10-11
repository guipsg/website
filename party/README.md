# Corrida da Sorte 🎲

Jogo de tabuleiro **por turnos** para **2 jogadores**, no estilo "party game": a tela fica no computador e os **celulares viram o controle**. Não exige agilidade: tudo é feito tocando em botões, no seu tempo.

## Modos

- **🏆 Competição**: corrida até a bandeira 🏁. Quem chegar primeiro vence. No caminho, junte moedas, compre itens e atrapalhe o rival.
- **🤝 Cooperativo**: um monstro 👹 persegue vocês. Os dois precisam chegar à bandeira antes de serem alcançados. Ele dorme na 1ª rodada e depois anda de 2 a 4 casas por rodada.

## Como jogar

1. Abra `party/` no computador.
2. Cada jogador escaneia o QR code com o celular (ou abre `party/controller.html` e digita o código).
3. Escolham o modo pelo celular.

Em cada rodada, cada jogador pode **usar 1 item** e depois **rola o dado** pelo celular. No fim da rodada tem um **minigame** com escolhas secretas no celular.

### Casas

| Casa | Competição | Cooperativo |
|---|---|---|
| 🔵 +3 | ganha 3 moedas | ganha 3 moedas |
| 🔴 | perde 3 moedas | o monstro avança 2 |
| 🟢 ? | evento surpresa (vento, buraco, tesouro, pedágio, troca de lugar…) | evento surpresa (monstro tropeça, carona…) |
| 🛒 | loja de itens | loja de itens |
| 🌀 | atalho: pague 5 moedas e avance 4 | idem |

Na competição, quem parar na mesma casa do rival rouba 3 moedas dele (**encontrão**).

### Itens (máx. 3 na mochila)

- 🎲 **Dado Duplo** (6): rola dois dados
- 🍄 **Cogumelo** (4): +3 casas
- 🌟 **Dado Dourado** (10): você escolhe o número
- ⚡ **Raio** (7, competição): o rival volta 4 casas
- 🦝 **Ladrão** (5, competição): rouba 5 moedas
- ⛓ **Corrente** (6, cooperativo): o monstro volta 4 casas
- 🧲 **Ímã** (5, cooperativo): puxa o parceiro que ficou para trás até a sua casa

### Minigames

📦 Três Baús · 🃏 Maior ou Menor · 💣 Arriscar ou Parar · ✊ Pedra, Papel e Tesoura (competição) · 🔨 Leilão Secreto (competição) · 🪵 Barricada (cooperativo)

## Sem celular

No lobby, aperte `Espaço` (jogador ⌨ A, responde com as teclas `1`…`7`) e/ou `Enter` (jogador ⌨ B, responde com `Z X C V B N M`). As opções aparecem na tela.

## Técnico

Mesma base do Neon Arena (`../game/`): site estático, conexão celular ↔ computador por WebRTC com [PeerJS](https://peerjs.com/) (bibliotecas em `../game/vendor/`). O computador roda toda a lógica; o celular só mostra as perguntas e devolve a opção tocada. Para usar um servidor PeerJS próprio, defina `window.CORRIDA_PEER_OPTS = { host, port, path, secure }`.
