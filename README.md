# Val quirúrgico

App para el celular que acompaña un ciclo de **90 días**: 4 rachas núcleo, hábitos secundarios, un **porcentaje por día** y un **fondo de premios** que crece con cada semana ganada.
Funciona sin internet, se instala con su propio ícono y guarda todo **cifrado** en el teléfono, protegido con **patrón y huella**.

**Abrir la app:** https://jcoronadoccorimanya08-jpg.github.io/val-quirurgico/

## Instalarla en Android (Samsung)

1. Copia el link y ábrelo en **Chrome** (no dentro de otra app).
2. Toca **Instalar** en la tarjeta verde, o el menú **⋮ → Instalar aplicación**.
3. Ábrela desde el ícono **Val Q**. Si no está en la pantalla de inicio, búscala en tus aplicaciones.

## Cómo funciona

- **Núcleo (4):** dormir, rutina de la mañana, gym y bloque profundo de estudio. Cada uno tiene una **versión mínima** para los días malos, que también cuenta.
- **Porcentaje del día:** el núcleo vale 60 % y los secundarios 40 %. **Ganas el día con 65 % o más.** Sin el núcleo no se puede ganar.
- **Modo examen:** en esas fechas solo cuenta el núcleo y ganas el día con 3 de 4.
- **Semanas:** 12 semanas de 7 días y un tramo final. Ganas la semana con **6 de 7 días ganados**.
- **Fondo de premios:** cada semana ganada suma **Bs 100**. Con el fondo canjeas los premios de tu lista (cada uno con su precio).
- **Cofre sorpresa** por cada semana ganada (+20 o +50 Bs, un comodín o una noche de peli) y **comodín** cada 2 semanas ganadas, para salvar un día malo.
- **Premio especial** con fecha (por ejemplo, un viaje): se desbloquea desde una fecha si ganaste las semanas que elijas. Se escribe en la app.
- **Avance:** tu montaña (promedio de 7 días y cada día), mapa del ciclo, semanas y cada hábito.
- **Reporte:** tarjeta de la semana, **imagen** para compartir y texto para pegar en Claude.

## Tus datos

- Se guardan **solo en este teléfono** y **cifrados**: AES-GCM con una llave al azar, que se abre con tu **patrón** (PBKDF2) o con tu **huella** (passkey con PRF). No hay cuentas ni servidores.
- **Si olvidas el patrón, los datos no se pueden recuperar.** Haz respaldos: Ajustes → Respaldo → *Guardar en Drive o compartir*, *Guardar en el celular* o *Copiar respaldo*. El respaldo es un `.txt` cifrado que se abre con tu patrón.

## Desarrollo

Requiere Node 22.

```bash
npm ci
npm run dev       # servidor de desarrollo
npm test          # reglas, premios y cifrado (Vitest)
npm run e2e       # pruebas en un teléfono simulado (Playwright), incluida la huella simulada
npm run check     # todo lo anterior + build
npm run icons     # regenerar los íconos
```

Cada `push` a `main` corre las pruebas y, si pasan, publica en GitHub Pages. La app instalada muestra **«Hay una versión nueva → Actualizar»**.

### Estructura

| Ruta | Qué contiene |
| --- | --- |
| `src/lib/engine.ts` | Reglas: porcentaje del día, modo examen, semanas, rachas y estadísticas |
| `src/lib/rewards.ts` | Fondo, cofres, comodines y premio especial |
| `src/lib/crypto.ts`, `biometric.ts`, `vault.ts` | Cifrado, huella (passkeys) y bóveda local |
| `src/lib/store.ts` | Estado, bloqueo y acciones |
| `src/screens/` | Hoy, Premios, Avance, Ajustes, bienvenida y bloqueo |
| `tests/`, `e2e/` | Pruebas unitarias y en un Galaxy simulado |

## Créditos

Tipografía [Inter](https://rsms.me/inter/) (OFL). Íconos basados en [Lucide](https://lucide.dev) (ISC).
