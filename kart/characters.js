// Personagens jogáveis do Kart.
//
// Cada personagem pode ter um modelo 3D (.glb/.gltf, Draco suportado) em kart/models/.
// O jogo carrega o modelo, senta o piloto no kart (pose dos ossos coxa/canela/braço — ver
// SEAT_POSE em host.js) e, ao cruzar a linha de chegada, toca a animação "Wave" só da cintura
// para cima. Se o modelo não carregar, usa o boneco placeholder.
//
// Campos de `model`:
//   url       → caminho do arquivo (relativo a kart/)
//   scale     → escala (os Miis têm ~1,9 de altura; o kart tem ~2,3 de comprimento)
//   offsetY   → altura em relação ao chão do kart
//   offsetZ   → frente (+) / trás (−) dentro do kart
//   rotationY → giro, se o modelo não olhar para +Z
//   pose      → false para não aplicar a pose sentada (modelos que já vêm sentados)
//
// `stats` mudam a dirigibilidade (1 = padrão):
//   speed    → velocidade máxima
//   accel    → aceleração
//   handling → velocidade da curva

const MII_MODEL = { scale: 0.86, offsetY: 0.17, offsetZ: -0.45, rotationY: 0 };

export const CHARACTERS = [
  {
    id: 'a',
    name: 'Mii Masculino',
    tagline: 'Velocista',
    desc: 'Mais rápido nas retas, curva um pouco mais aberta.',
    color: '#f05a0c', // moletom laranja (usado nos menus e no placeholder)
    accent: '#f3e3c0',
    stats: { speed: 1.06, accel: 0.94, handling: 0.92 },
    model: { url: 'models/mii-masculino.glb', ...MII_MODEL },
  },
  {
    id: 'b',
    name: 'Mii Feminino',
    tagline: 'Equilibrada',
    desc: 'Acelera rápido e faz curvas mais fechadas.',
    color: '#e8336a', // moletom rosa
    accent: '#f5d8b0',
    stats: { speed: 0.96, accel: 1.08, handling: 1.12 },
    model: { url: 'models/mii-feminino.glb', ...MII_MODEL },
  },
];

export const characterById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
