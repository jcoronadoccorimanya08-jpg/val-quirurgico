# Val quirúrgico

App para el celular que acompaña un ciclo de **90 días**: 3 rachas núcleo, hábitos secundarios y **un premio por cada semana cumplida**.
Funciona sin internet, se instala con su propio ícono y guarda los datos solo en el teléfono.

**Abrir la app:** https://jcoronadoccorimanya08-jpg.github.io/val-quirurgico/

## Instalarla en Android (Samsung)

1. Abre el link en **Chrome**.
2. Toca **Instalar** en el aviso que aparece abajo, o abre el menú **⋮ → Instalar aplicación**.
3. Ábrela desde el ícono **Val Q** de tu pantalla de inicio.

## Cómo funciona

- **Las 3 rachas del núcleo:** dormir de 23:00 a 6:00, gym y un bloque profundo de estudio sin celular. Cada una tiene una **versión mínima** para los días malos, y la versión mínima también cuenta.
- **Día completo:** cuando marcas las 3.
- **Semanas y premios:** el ciclo se divide en 12 semanas de 7 días y un tramo final (días 85 a 90). Ganas el premio de la semana con **6 de 7 días completos**, y el tramo final con 5 de 6. La meta se puede ajustar en Ajustes.
- **Secundarios:** Anki, Atrium, ajedrez, etc. Se marcan sin presión y también llevan su racha.
- **Corregir días:** con las flechas, o tocando un día en *Avance*, puedes marcar días anteriores.
- **Reporte para Claude:** en Ajustes, copia o comparte tu resumen de la semana y pégalo en Claude para recibir un análisis.

## Tus datos

- Se guardan **solo en este teléfono**, con doble copia (IndexedDB y localStorage). No hay servidores, cuentas ni analítica.
- Haz un **respaldo** de vez en cuando (Ajustes → Respaldo → Guardar en Drive). La app te lo recuerda cada 7 días.
- Para pasarte a otro teléfono: instala la app y elige **Restaurar un respaldo**.

## Desarrollo

Requiere Node 22.

```bash
npm ci            # instalar dependencias
npm run dev       # servidor de desarrollo
npm test          # pruebas de las reglas (Vitest)
npm run e2e       # pruebas en un teléfono simulado (Playwright)
npm run check     # todo lo anterior + build, antes de subir cambios
npm run icons     # regenerar los íconos desde el diseño vectorial
```

Cada `push` a `main` corre las pruebas y, si pasan, publica en GitHub Pages (`.github/workflows/deploy.yml`).
Cuando hay una versión nueva, la app instalada muestra el aviso **«Hay una versión nueva → Actualizar»**.

### Estructura

| Ruta | Qué contiene |
| --- | --- |
| `src/lib/engine.ts` | Reglas del ciclo: semanas, metas, rachas y estadísticas (funciones puras) |
| `src/lib/dates.ts` | Fechas en hora de La Paz y formato en español |
| `src/lib/storage.ts` | Guardado local y validación de datos |
| `src/lib/store.ts` | Estado de la app y acciones |
| `src/screens/` | Pantallas: Hoy, Premios, Avance, Ajustes y la bienvenida |
| `tests/` | Pruebas unitarias |
| `e2e/` | Pruebas de punta a punta en un Galaxy simulado |

## Créditos

Tipografía [Inter](https://rsms.me/inter/) (OFL). Íconos basados en [Lucide](https://lucide.dev) (ISC).
