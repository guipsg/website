# Neon Arena 🎮

Jogo arcade para **2 jogadores** que roda no navegador do computador, com os **celulares como controle**.

- **⚔ Competição** — duelo na arena: cada abate vale 1 ponto, quem fizer 5 primeiro vence. Power-ups (tiro triplo, tiro rápido, escudo, vida) aparecem pela arena.
- **🛡 Cooperativo** — os dois sobrevivem juntos a ondas de inimigos (perseguidores, atiradores, tanques) com um chefão a cada 5 ondas. Se um jogador cair, o outro fica perto dele por 2 s para reanimá-lo; se os dois caírem, fim de jogo.

## Como jogar

1. Abra `game/` no computador (ex.: `https://<seu-site>/game/`).
2. Cada jogador escaneia o QR code com o celular (ou abre `game/controller.html` e digita o código de 4 letras).
3. Quando os dois estiverem conectados, qualquer um escolhe o modo pelo celular.

**Controle no celular:** analógico esquerdo = mover · analógico direito = mirar e atirar · botão **DASH** = esquiva rápida (fica invulnerável por um instante) · ❚❚ = pausa. O celular vibra quando você toma dano.

**Sem celular?** Dá para jogar no teclado do computador: no lobby aperte `Espaço` (WASD + Espaço para atirar + Shift esquerdo para dash) e/ou `Enter` (setas + Enter + Shift direito). No menu, `1` = Competição, `2` = Cooperativo; `P` pausa, `R` joga de novo, `M` volta ao menu.

## Como funciona

- Site 100% estático (funciona no GitHub Pages), sem servidor próprio.
- Os celulares se conectam direto ao computador via **WebRTC** usando [PeerJS](https://peerjs.com/). O servidor público gratuito do PeerJS é usado só para o "aperto de mão" inicial; depois os comandos vão direto entre os aparelhos.
- O computador roda toda a simulação (60 Hz fixos) e só manda para o celular o HUD (vida/placar) e as vibrações.
- Para usar um servidor PeerJS próprio, defina `window.NEON_PEER_OPTS = { host, port, path, secure }` antes de carregar `host.js` / `controller.js`.

Arquivos: `index.html` + `host.js` (tela do jogo), `controller.html` + `controller.js` (controle), `style.css`, `vendor/` (PeerJS e gerador de QR code, licença MIT).
