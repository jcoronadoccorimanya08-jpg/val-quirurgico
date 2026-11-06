import { expect, test, type Page } from '@playwright/test';

// Lunes 9 de noviembre de 2026, 21:00 en La Paz.
const MONDAY_NIGHT = new Date('2026-11-09T21:00:00-04:00');

async function startCycle(page: Page) {
  await page.clock.install({ time: MONDAY_NIGHT });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '¿Cuándo empiezas?' })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar mi ciclo' }).click();
  await expect(page.getByRole('heading', { name: 'Día 1 de 90' })).toBeVisible();
}

test('marca un día completo, define un premio y lo conserva al recargar', async ({ page }) => {
  await startCycle(page);

  for (const name of ['Dormir 23:00 – 6:00', 'Gym', 'Bloque profundo sin celular']) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
  }
  await expect(page.getByRole('status').filter({ hasText: 'Día completo: 3 de 3.' })).toBeVisible();
  await expect(page.getByLabel('Semana 1', { exact: true }).getByText('1/6')).toBeVisible();

  await page.getByRole('button', { name: 'Premios' }).click();
  const reward = page.getByLabel('Premio de la semana 1', { exact: true });
  await reward.fill('Comer carne en un buen lugar');
  await reward.press('Enter');

  await page.reload();
  await expect(page.getByRole('button', { name: /Gym/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Comer carne en un buen lugar')).toBeVisible();

  await page.getByRole('button', { name: 'Avance' }).click();
  await expect(page.getByText('días completos 3/3')).toBeVisible();
  await expect(page.locator('.tile').first()).toContainText('1');
});

test('se puede corregir un día anterior', async ({ page }) => {
  await startCycle(page);
  await page.clock.setFixedTime(new Date('2026-11-10T21:00:00-04:00'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Día 2 de 90' })).toBeVisible();

  await page.getByRole('button', { name: 'Día anterior' }).click();
  await expect(page.getByText('Ayer')).toBeVisible();
  await page.getByRole('button', { name: /Gym/ }).click();
  await expect(page.getByRole('button', { name: /Gym/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Volver a hoy' }).click();
  await expect(page.getByRole('button', { name: /Gym/ })).toHaveAttribute('aria-pressed', 'false');
});

test('cambia el tema y genera el reporte', async ({ page }) => {
  await startCycle(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByText('Ver el reporte').click();
  await expect(page.locator('.report-preview')).toContainText('REPORTE · Val quirúrgico · día 1/90');
});

test('la primera pantalla ya funciona sin internet y explica cómo instalar', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('region', { name: 'Instalar la app' })).toContainText('«Instalar aplicación»');
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test('cuando Chrome ofrece instalar, aparece el botón Instalar', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __prompted: boolean }).__prompted = false;
    e.prompt = async () => {
      (window as unknown as { __prompted: boolean }).__prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  const card = page.getByRole('region', { name: 'Instalar la app' });
  await card.getByRole('button', { name: 'Instalar' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted: boolean }).__prompted)).toBe(true);
});

test('si elegiste el lunes, puedes empezar hoy igual', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T20:00:00-04:00') }); // viernes
  await page.goto('./');
  await page.getByRole('button', { name: 'Empezar mi ciclo' }).click(); // por defecto: el lunes
  await expect(page.getByRole('heading', { name: 'Tu ciclo está por empezar' })).toBeVisible();
  await page.getByRole('button', { name: 'Prefiero empezar hoy' }).click();
  await expect(page.getByRole('heading', { name: 'Día 1 de 90' })).toBeVisible();
});
