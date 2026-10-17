# Modelos 3D dos personagens

Coloque aqui os arquivos `.glb` (ou `.gltf`) dos personagens e aponte para eles em `../characters.js`:

```js
model: { url: 'models/personagem-a.glb', scale: 1, rotationY: Math.PI, offsetY: 0 }
```

Recomendações para o modelo:

- Altura de ~1,2 unidade (o kart tem ~2,2 de comprimento). Ajuste com `scale`.
- Olhando para **+Z** (frente do kart); senão gire com `rotationY`.
- Origem no assento; ajuste a altura com `offsetY`.
- Low-poly e texturas pequenas (≤ 1024 px): a tela é renderizada duas vezes (tela dividida).
- Se o arquivo não carregar, o jogo usa o placeholder e mostra um aviso no console.
