# Patada de Clandestino 🥊🧉

Juego de pelea web, parodia satírica argentina.
Stack: **Phaser 3** (local, sin CDN) + hosting en **Firebase**.

## Personajes
- **El Presidente** (héroe, jugador) — cara real sobre cuerpo camuflado, con mate. Gana pensando en el otro.
- **El Ex Presidente** (villano, CPU) — petiso, peluca enorme, motosierra.

## Estructura
```
public/
  index.html        página principal (el juego)
  seleccion.html    pantalla de selección
  js/game.js        motor completo (física, hitboxes, rounds, input)
  vendor/phaser.min.js   Phaser local (no depende de CDN)
  assets/           imágenes (presidente.png)
```

## Estado
- [x] Motor de pelea: movimiento, salto, hitboxes, vida, KO, mejor de 3 rounds
- [x] Controles teclado + botones táctiles (celular)
- [x] Responsivo (se adapta a cualquier pantalla)
- [x] Cara real del Presidente sobre cuerpo camuflado
- [ ] Sprites animados (idle/golpe)
- [ ] Lógica del rival (CPU) más avanzada
- [ ] Sonido

## Correr local
```bash
cd public && python3 -m http.server 5500   # http://localhost:5500
```

## Deploy a Firebase
```bash
firebase deploy --only hosting --project juegoclandestino
```
