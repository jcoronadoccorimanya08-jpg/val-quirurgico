import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE } from '../src/lib/config';
import { rangeDates } from '../src/lib/dates';
import { weeklyPcts, type Days } from '../src/lib/engine';
import { sanitizeState } from '../src/lib/sanitize';
import { initialState } from '../src/lib/store';
import { parseShare, teamWeeks, victoryCount } from '../src/lib/team';

const START = '2026-11-08';

describe('semana victoriosa (Val Q)', () => {
  it('comparte el promedio de cada semana que ya empezó', () => {
    const st = initialState(START, null);
    const days: Days = {};
    const core = Object.fromEntries(DEFAULT_CORE.map((h) => [h.id, true]));
    for (const d of rangeDates('2026-11-08', '2026-11-14')) days[d] = { core, extra: {} };
    const pcts = weeklyPcts(st.settings, days, '2026-11-15');
    expect(pcts['2026-11-08']).toBe(60); // solo el núcleo: 60 %
    expect(pcts['2026-11-15']).toBe(0);
    expect(Object.keys(pcts)).toHaveLength(2);
  });

  it('cuenta la semana cuando el promedio con Bitácora llega a 80 %', () => {
    const weeks = [
      { index: 1, start: '2026-11-08', end: '2026-11-14' },
      { index: 2, start: '2026-11-15', end: '2026-11-21' },
    ];
    const list = teamWeeks(weeks, { '2026-11-08': 70, '2026-11-15': 95 }, { '2026-11-08': 90, '2026-11-15': 60 }, '2026-11-22');
    expect(list.map((w) => w.victory)).toEqual([true, false]);
    expect(victoryCount(list)).toBe(1);
  });

  it('lee el registro de Bitácora y descarta lo que no son números', () => {
    expect(parseShare(JSON.stringify({ v: 1, start: START, weeks: { '2026-11-08': 88.5, hola: 1 } }))?.weeks).toEqual({ '2026-11-08': 88.5 });
    expect(parseShare('{}')).toBeNull();
  });

  it('el gran premio compartido es opcional y se conserva al restaurar', () => {
    const st = initialState(START, null);
    expect(st.settings.grand).toBeNull();
    const withGrand = sanitizeState({ ...st, settings: { ...st.settings, grand: { name: 'Gran premio', weeks: 30 } } });
    expect(withGrand?.settings.grand).toEqual({ name: 'Gran premio', weeks: 9 });
    const { grand: _g, ...older } = st.settings;
    void _g;
    expect(sanitizeState({ ...st, settings: older })?.settings.grand).toBeNull();
  });
});
