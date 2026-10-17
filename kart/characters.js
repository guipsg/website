// Personagens jogáveis do Kart.
//
// Por enquanto são PLACEHOLDERS: o piloto é desenhado com formas simples (cápsula + cabeça).
// Para trocar por um modelo 3D de verdade, coloque o arquivo .glb/.gltf em kart/models/
// e preencha o campo `model` do personagem, por exemplo:
//
//   model: { url: 'models/personagem-a.glb', scale: 1, rotationY: Math.PI, offsetY: 0 }
//
// O jogo carrega o modelo automaticamente (GLTFLoader) e, se der erro, continua com o
// placeholder. O modelo deve ter ~1,2 unidade de altura, olhar para +Z e ter a origem
// no assento do kart (ajuste com scale / rotationY / offsetY se precisar).
//
// `stats` mudam a dirigibilidade (1 = padrão):
//   speed    → velocidade máxima
//   accel    → aceleração
//   handling → velocidade da curva

export const CHARACTERS = [
  {
    id: 'a',
    name: 'Personagem A',
    tagline: 'Velocista',
    desc: 'Mais rápido nas retas, curva um pouco mais aberta.',
    color: '#ef4444', // cor do corpo do placeholder
    accent: '#facc15', // cor do capacete / detalhes
    stats: { speed: 1.06, accel: 0.94, handling: 0.92 },
    model: null,
  },
  {
    id: 'b',
    name: 'Personagem B',
    tagline: 'Equilibrado',
    desc: 'Acelera rápido e faz curvas mais fechadas.',
    color: '#22c55e',
    accent: '#60a5fa',
    stats: { speed: 0.96, accel: 1.08, handling: 1.12 },
    model: null,
  },
];

export const characterById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
