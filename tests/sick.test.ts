import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE, DEFAULT_EXTRAS, SICK_ITEMS } from '../src/lib/config';
import { canSetSick, dayPct, isWon, neededToWin, wonStreak, type Days } from '../src/lib/engine';
import { sanitizeState } from '../src/lib/sanitize';
import { initialState } from '../src/lib/store';
import { buildWidgetPayload } from '../src/lib/widget';

const START = '2026-11-09';
const CORE = Object.fromEntries(DEFAULT_CORE.map((h) => [h.id, true]));
const EXTRA = { [DEFAULT_EXTRAS[0]!.id]: true };
const all = Object.fromEntries(SICK_ITEMS.map((x) => [x.id, true]));

describe('modo enfermo', () => {
  it('ese día solo cuentan los 4 mínimos y se gana con todos', () => {
    const st = initialState(START, null);
    const d = '2026-11-16';
    st.days[d] = { core: {}, extra: {}, sick: true, sickDone: { recuperar: true, mente: true, academico: true } };
    expect(dayPct(st.settings, st.days, d)).toBe(75);
    expect(isWon(st.settings, st.days, d)).toBe(false);
    expect(neededToWin(st.settings, st.days, d)).toEqual({ core: 1, extra: 0 });
    st.days[d] = { core: {}, extra: {}, sick: true, sickDone: all };
    expect(isWon(st.settings, st.days, d)).toBe(true);
  });

  it('la racha sigue con días enfermo ganados', () => {
    const st = initialState(START, null);
    st.days['2026-11-15'] = { core: CORE, extra: EXTRA };
    st.days['2026-11-16'] = { core: {}, extra: {}, sick: true, sickDone: all };
    st.days['2026-11-17'] = { core: {}, extra: {}, sick: true, sickDone: all };
    expect(wonStreak(st.settings, st.days, '2026-11-17')).toBe(3);
  });

  it('máximo 3 días seguidos', () => {
    const days: Days = {};
    for (const d of ['2026-11-16', '2026-11-17', '2026-11-18']) days[d] = { core: {}, extra: {}, sick: true };
    expect(canSetSick(days, '2026-11-19')).toBe(false);
    expect(canSetSick(days, '2026-11-15')).toBe(false);
    expect(canSetSick(days, '2026-11-18')).toBe(true); // ya lo es: se puede quitar
    expect(canSetSick(days, '2026-11-21')).toBe(true);
  });

  it('se guarda en el respaldo y el widget muestra los mínimos', () => {
    const st = initialState(START, null);
    st.days['2026-11-16'] = { core: {}, extra: {}, sick: true, sickDone: { mente: true, otro: true } as Record<string, boolean> };
    const back = sanitizeState(JSON.parse(JSON.stringify(st)))!;
    expect(back.days['2026-11-16']).toMatchObject({ sick: true, sickDone: { mente: true } });
    expect(back.days['2026-11-16']!.sickDone).not.toHaveProperty('otro');
    const p = buildWidgetPayload(back, '2026-11-16');
    expect(p.core.map((c) => c.n)).toEqual(SICK_ITEMS.map((x) => x.short));
    expect(p.core.find((c) => c.n === 'Mente')!.done).toBe(true);
    expect(p.left).toBe(3);
    expect(p.phrase).toBe('Modo enfermo: cuídate');
  });
});
