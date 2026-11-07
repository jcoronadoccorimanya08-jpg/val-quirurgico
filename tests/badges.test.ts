import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE, DEFAULT_EXTRAS } from '../src/lib/config';
import { addDays, rangeDates } from '../src/lib/dates';
import { badgeBlocks, earnedTiers, TIERS } from '../src/lib/badges';
import { moodStats, type Days } from '../src/lib/engine';
import { sanitizeState } from '../src/lib/sanitize';
import { initialState } from '../src/lib/store';

const START = '2026-11-08';
const CORE = Object.fromEntries(DEFAULT_CORE.map((h) => [h.id, true]));
const EXTRA = { [DEFAULT_EXTRAS[0]!.id]: true };

function win(days: Days, dates: string[]): Days {
  for (const d of dates) days[d] = { core: CORE, extra: EXTRA };
  return days;
}

describe('insignias cada 2 semanas', () => {
  const st = initialState(START, null);

  it('6 bloques de 2 semanas; la última semana corta no cuenta', () => {
    const blocks = badgeBlocks(st.settings, {}, '2026-11-01');
    expect(blocks).toHaveLength(6);
    expect(blocks[0]).toMatchObject({ weeks: [1, 2], start: '2026-11-08', end: '2026-11-21', status: 'future', need: 12 });
    expect(blocks[5]).toMatchObject({ weeks: [11, 12], end: '2027-01-30' });
  });

  it('se gana con 12 días ganados en el bloque, aunque falten días', () => {
    const days = win({}, rangeDates('2026-11-08', addDays('2026-11-08', 11))); // 12 días
    const [b1] = badgeBlocks(st.settings, days, '2026-11-19');
    expect(b1).toMatchObject({ status: 'earned', won: 12 });
    expect(earnedTiers(badgeBlocks(st.settings, days, '2026-11-19'))).toEqual(['Bronce']);
  });

  it('un bloque perdido no quita niveles: la siguiente insignia ganada es Bronce', () => {
    const days = win({}, rangeDates('2026-11-22', '2026-12-03')); // bloque 2, 12 días
    const blocks = badgeBlocks(st.settings, days, '2026-12-04');
    expect(blocks[0]!.status).toBe('missed');
    expect(blocks[1]!.status).toBe('earned');
    expect(earnedTiers(blocks)).toEqual([TIERS[0]]);
  });

  it('sigue abierto mientras todavía alcanza', () => {
    const days = win({}, rangeDates('2026-11-08', '2026-11-10'));
    expect(badgeBlocks(st.settings, days, '2026-11-11')[0]).toMatchObject({ status: 'open', won: 3 });
    // 8 días sin ganar: ya no alcanza 12 de 14
    expect(badgeBlocks(st.settings, {}, '2026-11-16')[0]!.status).toBe('missed');
  });
});

describe('ánimo del día', () => {
  it('promedia tu porcentaje según el ánimo', () => {
    const st = initialState(START, null);
    const days: Days = {
      '2026-11-08': { core: CORE, extra: {}, mood: 5 },
      '2026-11-09': { core: {}, extra: {}, mood: 2 },
      '2026-11-10': { core: CORE, extra: {}, mood: 5 },
    };
    expect(moodStats(st.settings, days, rangeDates('2026-11-08', '2026-11-10'))).toEqual([
      { mood: 5, days: 2, avgPct: 60 },
      { mood: 2, days: 1, avgPct: 0 },
    ]);
  });

  it('se guarda cifrado con el día y se valida al restaurar', () => {
    const st = initialState(START, null);
    const back = sanitizeState({ ...st, days: { '2026-11-08': { core: {}, extra: {}, mood: 4 }, '2026-11-09': { core: {}, extra: {}, mood: 9 } } });
    expect(back?.days['2026-11-08']?.mood).toBe(4);
    expect(back?.days['2026-11-09']?.mood).toBeUndefined();
  });
});
