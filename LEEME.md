# Val quirúrgico — App de rachas (PWA)

Tracker de hábitos de 90 días. Funciona sin internet y los datos quedan en el celular.

## Archivos
- `index.html` — la app completa
- `manifest.json` — datos de instalación (nombre, iconos, pantalla completa)
- `sw.js` — service worker (modo sin internet)
- `icon-192.png`, `icon-512.png`, `icon-maskable.png` — iconos

## Para publicarla (elige UNA)

### A. Netlify Drop — 30 segundos, sin cuenta
1. Entra a https://app.netlify.com/drop
2. Arrastra ESTA carpeta completa (no el .zip)
3. Te da un link https. Ese es el link de tu app.

### B. GitHub Pages — gratis, link estable
1. Crea un repositorio público llamado `val-quirurgico`
2. Sube estos archivos a la raíz
3. Settings → Pages → Source: `main` / carpeta `/ (root)` → Save
4. En 1–2 min queda en `https://TU-USUARIO.github.io/val-quirurgico/`

## Para instalarla en el celular
Abre el link en el celular y:
- **Android (Chrome):** menú ⋮ → "Instalar aplicación" / "Añadir a pantalla de inicio"
- **iPhone (Safari):** botón Compartir → "Añadir a pantalla de inicio"

Queda con icono propio y se abre a pantalla completa, sin barra de navegador.

## Uso
- **Hoy:** marca las 3 rachas del núcleo + lo secundario. Marca de noche, antes de dormir.
- **Avance:** mapa de calor de 8 semanas, % del ciclo, desglose por hábito.
- **Ajustes:** "Copiar reporte para Claude" (lo pegas en el chat y te hace de entrenador),
  descargar respaldo y restaurar respaldo.

## Importante
Los datos viven en el navegador del celular. Descarga el respaldo de vez en cuando
(Ajustes → Descargar respaldo) para no perder el historial si cambias de celular o
borras los datos del navegador.

## Configuración del ciclo
Están al inicio del `<script>` en `index.html`:
`START="2026-09-21"`, `END="2026-12-19"`, `TOTAL=90`, y las listas `CORE` y `EXTRA`.
