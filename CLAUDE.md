# Val quirúrgico — guía para Claude

PWA personal de hábitos (ciclo de 90 días, 3 rachas núcleo y un premio por semana). Se usa a diario en un Android Samsung, instalada desde Chrome.
Es la "App 1". Existe otra app separada y privada; no mezcles código ni datos entre ambas.

## Reglas del producto

- Interfaz en **español de Bolivia**, con tono directo e informal pero respetuoso. **Sin culpa**: un día fallado es información, no un fracaso.
- Ciclo de 90 días = 12 semanas de 7 días + tramo final de 6 días (gran premio).
- Día completo = las 3 rachas del núcleo marcadas. La versión mínima cuenta como cumplida.
- Una semana se gana con `weeklyGoal` días completos (6 por defecto). En un tramo corto, la meta se reduce en lo que le falta para 7 (tramo final: 5 de 6).
- Si hoy todavía no está marcado, no rompe ninguna racha: se cuenta desde ayer.
- Marcar un día completo debe tomar menos de 30 segundos; los botones miden 48 px o más.

## Reglas técnicas

- **Fechas:** siempre en `America/La_Paz` mediante `src/lib/dates.ts` (`todayISO`, `localDateOf`). Nunca uses `toISOString().slice(0, 10)` sobre la hora actual.
- **Lógica:** todas las reglas viven en `src/lib/engine.ts` como funciones puras con pruebas en `tests/engine.test.ts`. Si cambias una regla, cambia o agrega la prueba.
- **Datos:** un solo registro versionado (`schema: 1`), guardado en IndexedDB con copia sincrónica en localStorage (`src/lib/storage.ts`). Si cambias el formato, sube `schema` y agrega la migración en `sanitizeState`. Nunca pierdas datos del usuario.
- **Privacidad:** sin servidores, analítica ni librerías que llamen a internet. El repositorio es **público**: no pongas datos personales en el código ni en los commits.
- **Estilos:** usa los tokens de `src/styles/app.css` (tema oscuro y claro). No uses colores sueltos.
- **Íconos de la app:** `npm run icons` los genera desde `scripts/make-icons.mjs`.

## Antes de entregar un cambio

```bash
npm run check   # typecheck + pruebas unitarias + build + pruebas en teléfono simulado
```

El push a `main` publica automáticamente en GitHub Pages; la app instalada ofrece «Actualizar» sola.
