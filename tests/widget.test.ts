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
    expect(shortName('Dormir 23:00 – 6:00')).toBe('Dormir');
    expect(streakPhrase({ started: true, streak: 0, todayWon: false, yesterdayWon: false, dayNumber: 4 })).toBe('Hoy no se negocia');
    expect(streakPhrase({ started: true, streak: 8, todayWon: true, yesterdayWon: true, dayNumber: 9 })).toBe('¡Gran racha! Día ganado');
    expect(streakPhrase({ started: false, streak: 0, todayWon: false, yesterdayWon: false, dayNumber: 0 })).toBe('Tu ciclo está por empezar');
  });
});
