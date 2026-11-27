import { describe, expect, it } from 'vitest';
import { focusDatesToMark, parseFocusDays } from '../src/lib/focus';
import { initialState } from '../src/lib/store';

describe('Focus Flow → Bloque profundo', () => {
  it('lee solo números y fechas válidas', () => {
    expect(parseFocusDays('{"v":1,"days":{"2026-11-26":{"m":30,"meta":false},"x":{"m":5},"2026-11-25":{"m":"a"}}}')).toEqual({ '2026-11-26': { m: 30, meta: false } });
    expect(parseFocusDays('basura')).toEqual({});
  });
  it('marca los días de la última semana con 25 min o más, sin repetir ni pisar', () => {
    const s = initialState('2026-11-20', null);
    const days = { '2026-11-25': { m: 25, meta: false }, '2026-11-26': { m: 10, meta: false }, '2026-11-27': { m: 120, meta: true }, '2026-11-10': { m: 300, meta: true } };
    expect(focusDatesToMark(s, days, '2026-11-27')).toEqual(['2026-11-25', '2026-11-27']);
    const marked = { ...s, days: { '2026-11-25': { core: { estudio: true }, extra: {} } } };
    expect(focusDatesToMark(marked, days, '2026-11-27')).toEqual(['2026-11-27']);
    const applied = { ...s, settings: { ...s.settings, focusApplied: ['2026-11-27'] } };
    expect(focusDatesToMark(applied, days, '2026-11-27')).toEqual(['2026-11-25']);
  });
});
