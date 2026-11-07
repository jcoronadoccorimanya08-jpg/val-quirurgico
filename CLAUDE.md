# Val quirúrgico — guía para Claude

PWA personal de hábitos (ciclo de 90 días, núcleo de 4, porcentaje diario y fondo de premios). Se usa a diario en un Android Samsung, instalada desde Chrome.
Es la "App 1". Existe otra app separada y privada (Bitácora); no mezcles código ni datos entre ambas. Única excepción acordada: los porcentajes semanales de la semana victoriosa (ver abajo).

## Reglas del producto

- Interfaz en **español de Bolivia**, con tono directo e informal pero respetuoso. **Sin culpa**: un día fallado es información, no un fracaso.
- **Núcleo de 4:** dormir, rutina de la mañana (con sus pasos), gym y bloque profundo. La versión mínima cuenta como cumplida.
- **Porcentaje del día:** `coreWeight` (60 %) repartido en el núcleo y el resto en los secundarios. Se gana el día con `dayGoal` (65 %) o más. Un comodín gana el día.
- **Modo examen** (`exam`): esos días solo cuenta el núcleo (cada hábito vale igual).
- **Semanas** desde el inicio del ciclo, de 7 días; se gana con `weeklyGoal` (6) días ganados. El tramo final es más corto y su meta baja.
- **Fondo:** `fundPerWeek` (Bs 100) por semana ganada + bonos de cofres − canjes. Un comodín cada 2 semanas ganadas.
- Hábitos con `levels` cambian solos por semana (Meditar 10 → 15 min).
- **Semana victoriosa** (`src/lib/team.ts`): el promedio de la semana de Val Q y de Bitácora llega a 80 %. El **gran premio compartido** (`settings.grand`) pide N semanas victoriosas (9 de 13) y se reclama en Bitácora; en Hoy aparece después del premio especial.
- **Insignias** (`src/lib/badges.ts`): cada bloque de 2 semanas con `weeklyGoal × 2` días ganados sube un nivel (Bronce, Plata, Oro, Platino, Diamante, Leyenda). Un bloque perdido no quita nada.
- **Ánimo del día** (`DayLog.mood`, 1 a 5): un toque en Hoy; en Avance se ve tu porcentaje según tu ánimo.
- Marcar un día completo debe tomar menos de 30 segundos; los botones miden 48 px o más.

## Privacidad y datos

- El repositorio y el sitio son **públicos**: nunca pongas datos personales en el código ni en los commits (nombre, horarios, viajes, premios con fechas personales). El premio especial se escribe **en la app**.
- Los datos se guardan **solo cifrados** (`src/lib/vault.ts`): una llave de datos al azar, envuelta por el patrón (PBKDF2) y opcionalmente por la huella (passkey con PRF). Nunca guardes el patrón ni datos en texto plano. Preferencias sin cifrar permitidas: tema, aviso de instalación, aviso de huella y la última versión vista (`val-quirurgico.seen-version`, para «Novedades»). Además, para la semana victoriosa, cada app publica **solo números** (el porcentaje de cada semana, por fecha) en `val-quirurgico.semanas` y lee `bitacora.semanas`: nunca nombres de hábitos ni nada más.
- Estado con `schema: 2` validado en `src/lib/sanitize.ts`. Si cambias el formato, sube `schema` y migra. Un campo nuevo opcional con valor por defecto en `sanitize.ts` (como `grand`) no lo cambia. Nunca pierdas datos.
- Sin servidores, analítica ni librerías que llamen a internet.

## Reglas técnicas

- **Fechas:** siempre en `America/La_Paz` mediante `src/lib/dates.ts` (`todayISO`, `localDateOf`). Nunca uses `toISOString().slice(0, 10)` sobre la hora actual.
- **Lógica:** reglas en `src/lib/engine.ts` y `src/lib/rewards.ts`, funciones puras con pruebas en `tests/`. Si cambias una regla, cambia o agrega la prueba.
- **Respaldo:** archivo `.txt` (Chrome Android no comparte `.json`), con opciones de compartir, guardar y copiar.
- **Estilos:** usa los tokens de `src/styles/app.css`. No uses colores sueltos.

## Antes de entregar un cambio

```bash
npm run check   # typecheck + pruebas unitarias + build + pruebas en teléfono simulado
```

El push a `main` publica automáticamente en GitHub Pages; la app instalada ofrece «Actualizar» sola.
