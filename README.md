# LUCHA GAUCHA 🥊🧉

Juego de pelea 8-bit ambientado en la pampa argentina. Parodia satírica.
Stack: **Phaser 3** (web) + hosting en **Firebase**.

## Estado
- [x] Boceto de pantalla de selección (`public/index.html`)
- [ ] Motor de pelea (Phaser 3): movimiento, hitboxes, vida, rounds
- [ ] Sprites animados de los 2 personajes
- [ ] IA del jefe (CPU)
- [ ] Sonido 8-bit

## Personajes
- **El Comandante** (héroe) — grandote, vincha guerrillera, mate. Gana pensando en el otro.
- **El Pelucón** (villano/CPU) — petiso, peluca enorme, motosierra. No piensa en nadie.

## Correr local
Abrí `public/index.html` en el navegador (doble clic) o serví la carpeta:
```bash
cd public && python3 -m http.server 5500   # http://localhost:5500
```

## Deploy a Firebase (cuando tengas el hosting)
```bash
firebase login
# poné tu project id en .firebaserc
firebase deploy --only hosting
```
