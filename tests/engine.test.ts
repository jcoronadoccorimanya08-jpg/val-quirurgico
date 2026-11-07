import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE, DEFAULT_EXTRAS } from '../src/lib/config';
import { addDays, rangeDates } from '../src/lib/dates';
import {
  allSegmentProgress,
  bestStreak,
  buildSegments,
  currentStreak,
  cycleStats,
  dailySeries,
  dayPct,
  dayState,
  goalFor,
  habitLabel,
  isEditable,
  isWon,
  neededToWin,
  segmentProgress,
  wonStreak,
  type Days,
} from '../src/lib/engine';
import { buildReport } from '../src/lib/report';
import { initialState } from '../src/lib/store';
import type { Settings } from '../src/lib/types';

const START = '2026-11-08'; // domingo

function settings(over: Partial<Settings> = {}): Settings {
  return { ...initialState(START, null).settings, ...over };
}

const CORE = DEFAULT_CORE.map((h) => h.id); // 4
const EXTRAS = DEFAULT_EXTRAS.map((h) => h.id); // 7

function mark(days: Days, dates: string[], core: string[], extra: string[] = []): Days {
  for (const d of dates) {
    const log = (days[d] ??= { core: {}, extra: {} });
    for (const id of core) log.core[id] = true;
    for (const id of extra) log.extra[id] = true;
  }
  return days;
}

describe('hábitos por defecto', () => {
  it('núcleo de 4 (con la rutina de la mañana) y 7 secundarios', () => {
    const s = settings();
    expect(s.core.map((h) => h.id)).toEqual(['sueno', 'rutina', 'gym', 'estudio']);
    expect(s.core[1]?.steps?.length).toBe(4);
    expect(s.extras).toHaveLength(7);
    expect(s.extras.map((h) => h.id)).toContain('lectura');
    expect(s.extras.map((h) => h.id)).not.toContain('sinapsis');
    expect(s.vacation.map((h) => h.id)).toEqual(['suenos', 'negocio']);
  });

  it('meditar sube de 10 a 15 minutos desde la semana 2', () => {
    const med = DEFAULT_EXTRAS.find((h) => h.id === 'meditar')!;
    expect(habitLabel(med, START, '2026-11-08')).toBe('Meditar 10 min');
    expect(habitLabel(med, START, '2026-11-14')).toBe('Meditar 10 min');
    expect(habitLabel(med, START, '2026-11-15')).toBe('Meditar 15 min');
    expect(habitLabel(med, START, '2027-01-20')).toBe('Meditar 15 min');
  });
});

describe('porcentaje del día (núcleo 60% / secundarios 40%, gana con 65%)', () => {
  const s = settings();
  const d = '2026-11-09';

  it('núcleo completo + 1 secundario gana', () => {
    const days = mark({}, [d], CORE, EXTRAS.slice(0, 1));
    expect(dayPct(s, days, d)).toBeCloseTo(65.71, 1);
    expect(isWon(s, days, d)).toBe(true);
  });

  it('solo el núcleo (60%) no alcanza', () => {
    const days = mark({}, [d], CORE);
    expect(dayPct(s, days, d)).toBeCloseTo(60, 5);
    expect(isWon(s, days, d)).toBe(false);
    expect(neededToWin(s, days, d)).toEqual({ core: 0, extra: 1 });
  });

  it('3 del núcleo necesitan 4 secundarios', () => {
    expect(isWon(s, mark({}, [d], CORE.slice(0, 3), EXTRAS.slice(0, 3)), d)).toBe(false);
    expect(isWon(s, mark({}, [d], CORE.slice(0, 3), EXTRAS.slice(0, 4)), d)).toBe(true);
  });

  it('2 del núcleo necesitan los 7 secundarios; 1 del núcleo no puede ganar', () => {
    expect(isWon(s, mark({}, [d], CORE.slice(0, 2), EXTRAS), d)).toBe(true);
    expect(isWon(s, mark({}, [d], CORE.slice(0, 2), EXTRAS.slice(0, 6)), d)).toBe(false);
    expect(isWon(s, mark({}, [d], CORE.slice(0, 1), EXTRAS), d)).toBe(false);
  });

  it('sugiere lo mínimo que falta, prefiriendo el núcleo', () => {
    expect(neededToWin(s, {}, d)).toEqual({ core: 4, extra: 1 });
    expect(neededToWin(s, mark({}, [d], CORE.slice(0, 3)), d)).toEqual({ core: 1, extra: 1 });
  });

  it('un comodín gana el día', () => {
    const days: Days = { [d]: { core: {}, extra: {}, wildcard: true } };
    expect(isWon(s, days, d)).toBe(true);
  });
});

describe('modo examen', () => {
  const s = settings({ exam: { from: START, to: '2026-12-20' } });
  const d = '2026-11-10';

  it('solo cuenta el núcleo: 3 de 4 gana', () => {
    const days = mark({}, [d], CORE.slice(0, 3));
    expect(dayPct(s, days, d)).toBe(75);
    expect(isWon(s, days, d)).toBe(true);
  });

  it('2 de 4 no gana aunque hagas todos los secundarios', () => {
    const days = mark({}, [d], CORE.slice(0, 2), EXTRAS);
    expect(dayPct(s, days, d)).toBe(50);
    expect(isWon(s, days, d)).toBe(false);
  });

  it('después del examen vuelve la regla normal', () => {
    const after = '2026-12-21';
    const days = mark({}, [after], CORE.slice(0, 3));
    expect(isWon(s, days, after)).toBe(false);
  });
});

describe('semanas de domingo a sábado', () => {
  const s = settings();
  const segs = buildSegments(s);

  it('12 semanas y un tramo final; el día 90 es el 5 de febrero', () => {
    expect(segs).toHaveLength(13);
    expect(segs[0]).toMatchObject({ start: '2026-11-08', end: '2026-11-14', goal: 6 });
    expect(segs[12]).toMatchObject({ start: '2027-01-31', end: '2027-02-05', length: 6, goal: 5, isFinal: true });
    expect(goalFor(6, 6)).toBe(5);
  });

  it('se gana con 6 días ganados', () => {
    const days = mark({}, rangeDates('2026-11-08', '2026-11-13'), CORE, EXTRAS.slice(0, 1));
    expect(segmentProgress(segs[0]!, s, days, '2026-11-13').status).toBe('won');
  });

  it('no alcanzada cuando ya no quedan días suficientes', () => {
    expect(segmentProgress(segs[0]!, s, {}, '2026-11-10').status).toBe('missed');
  });
});

describe('rachas', () => {
  const s = settings();

  it('días ganados seguidos (hoy sin marcar no rompe)', () => {
    const days = mark({}, ['2026-11-08', '2026-11-09'], CORE, EXTRAS.slice(0, 1));
    expect(wonStreak(s, days, '2026-11-10')).toBe(2);
    expect(wonStreak(s, days, '2026-11-11')).toBe(0);
  });

  it('por hábito', () => {
    const days = mark({}, ['2026-11-08', '2026-11-09', '2026-11-11'], ['gym']);
    expect(currentStreak(days, 'core', 'gym', s, '2026-11-12')).toBe(1);
    expect(bestStreak(days, 'core', 'gym', s, '2026-11-12')).toBe(2);
  });
});

describe('estadísticas', () => {
  const s = settings();

  it('ciclo y serie para el gráfico', () => {
    const days = mark({}, ['2026-11-08'], CORE, EXTRAS.slice(0, 1));
    mark(days, ['2026-11-09'], CORE.slice(0, 2));
    const st = cycleStats(s, days, '2026-11-10');
    expect(st).toMatchObject({ phase: 'active', dayNumber: 3, wonDays: 1 });
    const series = dailySeries(s, days, '2026-11-09');
    expect(series).toHaveLength(2);
    expect(series[0]!.won).toBe(true);
    expect(series[1]!.pct).toBeCloseTo(30, 5);
    expect(series[1]!.avg7).toBeCloseTo((65.714 + 30) / 2, 1);
  });

  it('antes y después del ciclo', () => {
    expect(cycleStats(s, {}, '2026-11-07')).toMatchObject({ phase: 'before', daysLeft: 90 });
    expect(cycleStats(s, {}, addDays(START, 200))).toMatchObject({ phase: 'finished', dayNumber: 90, daysLeft: 0 });
  });

  it('estado visual y días editables', () => {
    const days = mark({}, ['2026-11-08'], CORE, EXTRAS.slice(0, 1));
    mark(days, ['2026-11-09'], ['gym']);
    expect(dayState(s, days, '2026-11-08', '2026-11-10')).toBe('won');
    expect(dayState(s, days, '2026-11-09', '2026-11-10')).toBe('partial');
    expect(dayState(s, days, '2026-11-10', '2026-11-10')).toBe('empty');
    expect(dayState(s, days, '2026-11-11', '2026-11-10')).toBe('future');
    expect(isEditable(s, '2026-11-11', '2026-11-10')).toBe(false);
  });

  it('reporte para Claude', () => {
    const state = initialState(START, null);
    mark(state.days, ['2026-11-08', '2026-11-09'], CORE, EXTRAS.slice(0, 2));
    const text = buildReport(state, '2026-11-09');
    expect(text).toContain('VAL Q · REPORTE · día 2 de 90');
    expect(text).toContain('SEMANA 1');
    expect(text).toContain('• Días ganados: 2 de 7 (meta 6) · en curso');
    expect(text).toContain('Meditar 10 min');
    expect(allSegmentProgress(state.settings, state.days, '2026-11-09')[0]!.completed).toBe(2);
  });
});
