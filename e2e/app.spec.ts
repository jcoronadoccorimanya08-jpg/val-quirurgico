import { expect, test, type Page } from '@playwright/test';

// Sábado 7 de noviembre de 2026, 21:00 en La Paz. "Mañana" = domingo 8.
const SATURDAY_NIGHT = new Date('2026-11-07T21:00:00-04:00');
const PATTERN = [1, 2, 3, 6, 9];

async function draw(page: Page, dots: number[]) {
  const centers = [];
  for (const d of dots) {
    const box = await page.locator(`[data-dot="${d}"]`).first().boundingBox();
    if (!box) throw new Error(`sin punto ${d}`);
    centers.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  await page.mouse.move(centers[0]!.x, centers[0]!.y);
  await page.mouse.down();
  for (const c of centers.slice(1)) await page.mouse.move(c.x, c.y, { steps: 6 });
  await page.mouse.up();
}

async function onboard(page: Page, { exam }: { exam: boolean }) {
  await page.clock.install({ time: SATURDAY_NIGHT });
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¿Cuándo empiezas?' })).toBeVisible();
  await page.getByRole('button', { name: /^Hoy/ }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { name: '¿Estás en exámenes?' })).toBeVisible();
  await page.getByRole('button', { name: exam ? /^Sí, hasta el/ : /^No/ }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { name: 'Crea tu patrón' })).toBeVisible();
  await draw(page, PATTERN);
  await expect(page.getByRole('heading', { name: 'Repite tu patrón' })).toBeVisible();
  await draw(page, PATTERN);
  await expect(page.getByRole('heading', { name: 'Día 1 de 90' })).toBeVisible();
}

const CORE = ['Dormir 23:00 – 6:00', 'Rutina de la mañana', 'Gym', 'Bloque profundo sin celular'];

test('crea el patrón, gana el día con 65% y lo protege al recargar', async ({ page }) => {
  await onboard(page, { exam: false });
  await expect(page.getByText('Levantarte y tender la cama')).toBeVisible(); // pasos de la rutina

  for (const name of CORE) await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByLabel('Porcentaje del día')).toContainText('60');
  await expect(page.getByLabel('Porcentaje del día')).toContainText('Te falta 1 secundario');
  await page.getByRole('button', { name: /Anki/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '¡Día ganado! 66%' })).toBeVisible();

  // Al recargar pide el patrón; uno incorrecto no abre
  await page.reload();
  await expect(page.getByText('Dibuja tu patrón')).toBeVisible();
  await draw(page, [1, 4, 7, 8]);
  await expect(page.getByRole('alert')).toHaveText('Patrón incorrecto.');
  await draw(page, PATTERN);
  await expect(page.getByRole('heading', { name: 'Día 1 de 90' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Gym/ })).toHaveAttribute('aria-pressed', 'true');

  // Todo queda cifrado: los nombres no aparecen en el almacenamiento
  const raw = await page.evaluate(() => localStorage.getItem('val-quirurgico.vault') ?? '');
  expect(raw.length).toBeGreaterThan(100);
  expect(raw).not.toContain('Gym');
  expect(raw).not.toContain('Rutina');
});

test('modo examen: con 3 del núcleo ganas el día', async ({ page }) => {
  await onboard(page, { exam: true });
  await expect(page.getByText(/Modo examen hasta el/)).toBeVisible();
  for (const name of CORE.slice(0, 3)) await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('status').filter({ hasText: '¡Día ganado! 75%' })).toBeVisible();
});

test('meditar sube a 15 minutos desde la semana 2', async ({ page }) => {
  await onboard(page, { exam: false });
  await expect(page.getByRole('button', { name: /Meditar 10 min/ })).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-15T21:00:00-04:00'));
  await page.reload();
  await draw(page, PATTERN);
  await expect(page.getByRole('button', { name: /Meditar 15 min/ })).toBeVisible();
});

test('premios: fondo, lista con precios y premio especial editable', async ({ page }) => {
  await onboard(page, { exam: false });
  await page.locator('nav.nav').getByRole('button', { name: 'Premios' }).click();
  await expect(page.locator('.fund-amount')).toContainText('0');
  for (const p of ['Perfume', 'Carne en un buen lugar', 'Karting o escalada', 'Zapatillas']) await expect(page.getByLabel(p, { exact: true })).toBeVisible();
  await expect(page.getByText('Más adelante')).toBeVisible();
  await page.getByRole('button', { name: 'Editar premio especial' }).click();
  await page.getByPlaceholder('Ej.: Vuelo a…').fill('Mi viaje');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('region', { name: 'Premio especial' })).toContainText('Mi viaje');
  await page.locator('nav.nav').getByRole('button', { name: 'Hoy' }).click();
  await expect(page.getByRole('button', { name: 'Tu meta' })).toContainText('Mi viaje');
});

test('respaldo: se copia como texto y se restaura con su patrón', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await onboard(page, { exam: false });
  await page.getByRole('button', { name: /^Gym/ }).click();
  await page.locator('nav.nav').getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Copiar respaldo' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Respaldo copiado' })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('"app":"val-quirurgico"');
  expect(text).not.toContain('Gym');

  await page.getByRole('button', { name: 'Restaurar pegando el texto' }).click();
  await page.getByLabel('Texto del respaldo').fill(text);
  await page.getByRole('button', { name: 'Usar este respaldo' }).click();
  await expect(page.getByRole('heading', { name: 'Patrón del respaldo' })).toBeVisible();
  await draw(page, PATTERN);
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Respaldo restaurado' })).toBeVisible();
});

test('huella: se activa y abre la app', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  try {
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        hasPrf: true,
        automaticPresenceSimulation: true,
      },
    });
  } catch {
    test.skip(true, 'Este Chromium no simula huella con PRF');
  }
  await onboard(page, { exam: false });
  await page.locator('nav.nav').getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Activar' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Huella activada.' })).toBeVisible();
  // Al bloquear, la app pide la huella sola y vuelve a abrir.
  await page.getByRole('button', { name: 'Bloquear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Día 1 de 90' })).toBeVisible();
  // Y al volver a abrir la app también entra con la huella.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Día 1 de 90' })).toBeVisible();
});

test('avance muestra la montaña', async ({ page }) => {
  await onboard(page, { exam: false });
  await page.getByRole('button', { name: /^Gym/ }).click();
  await page.locator('nav.nav').getByRole('button', { name: 'Avance' }).click();
  await expect(page.getByRole('img', { name: /Tu porcentaje diario/ })).toBeVisible();
});

test('la bienvenida funciona sin internet y explica cómo instalar', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('region', { name: 'Instalar la app' })).toContainText('«Instalar aplicación»');
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test('si la app ya está instalada, lo dice', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getInstalledRelatedApps', { value: async () => [{ platform: 'webapp' }] });
  });
  await page.goto('./');
  await expect(page.getByRole('status', { name: 'App instalada' })).toContainText('Ya la tienes instalada');
});
