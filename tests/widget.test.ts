import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE, DEFAULT_EXTRAS } from '../src/lib/config';
import { rangeDates } from '../src/lib/dates';
import { initialState } from '../src/lib/store';
import { buildWidgetPayload } from '../src/lib/widget';

const START = '2026-11-09';
const CORE = Object.fromEntries(DEFAULT_CORE.map((h) => [h.id, true]));
const EXTRA = { [DEFAULT_EXTRAS[0]!.id]: true };

describe('resumen para el widget', () => {
  it('antes del inicio no hay días', () => {
    const st = initialState(START, null);
    const p = buildWidgetPayload(st, '2026-11-08');
    expect(p).toMatchObject({ v: 1, app: 'valq', dayNumber: 0, streak: 0, days: [] });
  });

  it('solo números: racha, % de hoy y los últimos 14 días', () => {
    const st = initialState(START, null);
    for (const d of rangeDates('2026-11-09', '2026-11-11')) st.days[d] = { core: CORE, extra: EXTRA };
    const p = buildWidgetPayload(st, '2026-11-12');
    expect(p.dayNumber).toBe(4);
    expect(p.days.map((x) => x.w)).toEqual([true, true, true, false]);
    expect(p.streak).toBe(3);
    expect(p.todayPct).toBe(0);
    expect(p.goal).toBe(st.settings.dayGoal);
    const later = buildWidgetPayload(st, '2026-12-01');
    expect(later.days).toHaveLength(14);
    // El widget de Val Q sí muestra el núcleo (nombres cortos); los secundarios no van.
    expect(JSON.stringify(p)).not.toContain('Anki');
  });

  it('muestra la meta: el premio especial antes de su fecha y después el gran premio', () => {
    const st = initialState(START, null);
    st.settings.special = { name: 'Premio de prueba', date: '2026-12-01', unlockDate: '2026-11-29', requiredWeeks: 2 };
    st.settings.grand = { name: 'Gran premio', weeks: 9 };
    expect(buildWidgetPayload(st, '2026-11-20').prize).toEqual({ name: 'Premio de prueba', daysLeft: 11 });
    expect(buildWidgetPayload(st, '2026-12-02').prize).toEqual({ name: 'Gran premio', daysLeft: 66 });
  });
});

describe('widget v2', () => {
  it('núcleo de hoy con nombre corto, frase y color', async () => {
    const { shortName, streakPhrase } = await import('../src/lib/widget');
    const st = initialState(START, null);
    st.days['2026-11-12'] = { core: { [DEFAULT_CORE[2]!.id]: true }, extra: {} };
    const p = buildWidgetPayload(st, '2026-11-12');
    expect(p.core.map((c) => c.n)).toEqual(DEFAULT_CORE.map((h) => shortName(h.name)));
    expect(p.core[2]).toMatchObject({ done: true, counts: true });
    expect(p.accent).toBe('verde');
    expect(shortName('Gym (versión mínima)')).toBe('Gym');
    expect(streakPhrase({ started: true, streak: 0, todayWon: false, yesterdayWon: false, dayNumber: 4 })).toBe('Hoy no se negocia');
    expect(streakPhrase({ started: true, streak: 8, todayWon: true, yesterdayWon: true, dayNumber: 9 })).toBe('¡Gran racha! Día ganado');
    expect(streakPhrase({ started: false, streak: 0, todayWon: false, yesterdayWon: false, dayNumber: 0 })).toBe('Tu ciclo está por empezar');
  });
});

describe('widget v3: cambia de día solo y avisa si estás en modo prueba', () => {
  it('manda mañana y pasado mañana tal como se verían sin abrir la app', () => {
    const st = initialState(START, null);
    for (const d of rangeDates('2026-11-09', '2026-11-11')) st.days[d] = { core: CORE, extra: EXTRA };
    const p = buildWidgetPayload(st, '2026-11-11');
    expect(p.todayWon).toBe(true);
    expect(p.streak).toBe(3);
    expect(p.ahead.map((f) => f.today)).toEqual(['2026-11-12', '2026-11-13']);
    // Mañana todavía no está ganado: la racha cuenta desde hoy. Pasado mañana, sin marcar mañana, vuelve a cero.
    expect(p.ahead[0]).toMatchObject({ dayNumber: 4, streak: 3, todayPct: 0, todayWon: false });
    expect(p.ahead[1]).toMatchObject({ dayNumber: 5, streak: 0 });
    expect(p.ahead[0]!.core.every((c) => !c.done)).toBe(true);
    expect(JSON.stringify(p.ahead)).not.toContain('ahead');
  });

  it('semana, lo que falta para ganar hoy, lo que falta marcar e insignias', () => {
    const st = initialState(START, null);
    st.days['2026-11-09'] = { core: CORE, extra: EXTRA };
    st.days['2026-11-10'] = { core: { [DEFAULT_CORE[0]!.id]: true }, extra: {} };
    const p = buildWidgetPayload(st, '2026-11-10');
    expect(p.start).toBe(START);
    expect(p.week).toEqual({ n: 1, start: START, len: 7, won: 1, goal: st.settings.weeklyGoal });
    expect(p.todayWon).toBe(false);
    expect(p.need).toBeGreaterThan(0);
    expect(p.left).toBe(DEFAULT_CORE.length - 1 + st.settings.extras.length);
    expect(p.badges).toBe(0);
    const won = buildWidgetPayload(st, '2026-11-09');
    expect(won.need).toBe(0);
    // Antes del ciclo: primera semana, nada que marcar.
    const before = buildWidgetPayload(st, '2026-11-08');
    expect(before).toMatchObject({ dayNumber: 0, need: null, left: 0, week: { n: 1, won: 0 } });
    expect(before.ahead[0]).toMatchObject({ today: START, dayNumber: 1 });
  });

  it('modo prueba: marcado y sin días adelantados', () => {
    const st = initialState(START, null);
    const p = buildWidgetPayload(st, '2026-11-20', { test: true });
    expect(p.test).toBe(true);
    expect(p.ahead).toEqual([]);
    expect(buildWidgetPayload(st, '2026-11-20').test).toBeUndefined();
  });

  it('solo acepta el canal de Chrome en nombre de la app Rachas', async () => {
    const { isRachasOrigin } = await import('../src/lib/widget');
    const self = 'https://jcoronadoccorimanya08-jpg.github.io';
    expect(isRachasOrigin('android-app://jcoronadoccorimanya08-jpg.github.io/io.github.jcoronadoccorimanya08.rachas', self)).toBe(true);
    expect(isRachasOrigin('android-app://io.github.jcoronadoccorimanya08.rachas', self)).toBe(true);
    expect(isRachasOrigin(self, self)).toBe(true);
    expect(isRachasOrigin('android-app://io.github.jcoronadoccorimanya08.rachas.otra', self)).toBe(false);
    expect(isRachasOrigin('android-app://otra.app/io.github.otro', self)).toBe(false);
    expect(isRachasOrigin('https://otro-sitio.example', self)).toBe(false);
  });
});
