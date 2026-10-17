# Modelos 3D dos personagens

| Arquivo | Personagem | Origem |
|---|---|---|
| `mii-masculino.glb` | Mii Masculino (moletom laranja) | `Mii_Character_draco.glb` |
| `mii-feminino.glb` | Mii Feminino (moletom rosa) | `Mii_Feminino_draco.glb` |

Os dois são exportados do Blender (glTF, compressão Draco), com esqueleto e a animação "Wave".

Para adicionar outro modelo, coloque o `.glb` aqui e aponte para ele em `../characters.js`:

```js
model: { url: 'models/novo.glb', scale: 0.86, offsetY: 0.17, offsetZ: -0.45, rotationY: 0 }
```

- O modelo deve olhar para **+Z**. Se não olhar, gire com `rotationY`.
- Com o mesmo esqueleto dos Miis (`hips`, `thigh.L/R`, `shin.L/R`, `upperarm.L/R`, `forearm.L/R`…), o jogo senta o piloto sozinho. Para outros esqueletos, use `pose: false` e exporte o modelo já sentado.
- Mantenha o arquivo leve (≤ 1 MB, texturas ≤ 1024 px), porque a tela é renderizada duas vezes (tela dividida) e há até 6 karts.
