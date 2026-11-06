import { describe, expect, it } from 'vitest';
import { addDays, rangeDates } from '../src/lib/dates';
import {
  bestStreak,
  buildSegments,
  completeStreak,
  currentStreak,
  cycleStats,
  dayState,
  goalFor,
  habitStats,
  isEditable,
  segmentProgress,
  type Days,
} from '../src/lib/engine';
import { buildReport } from '../src/lib/report';
import type { Settings } from '../src/lib/types';

const START = '2026-11-09'; // lunes

function settings(over: Partial<Settings> = {}): Settings {
  return {
    startDate: START,
    cycleLength: 90,
    weeklyGoal: 6,
    core: [
      { id: 'a', name: 'Dormir' },
      { id: 'b', name: 'Gym' },
      { id: 'c', name: 'Estudio' },
    ],
    extras: [
      { id: 'x', name: 'Anki' },
      { id: 'y', name: 'Ajedrez' },
    ],
    theme: 'system',
    createdAt: '2026-11-06T12:00:00.000Z',
    ...over,
  };
}

/** Marca los hábitos del núcleo indicados en cada fecha. */
function mark(days: Days, dates: string[], core: string[] = ['a', 'b', 'c'], extra: string[] = []): Days {
  for (const d of dates) {
    const log = (days[d] ??= { core: {}, extra: {} });
    for (const id of core) log.core[id] = true;
    for (const id of extra) log.extra[id] = true;
  }
  return days;
}

describe('tramos del ciclo de 90 días', () => {
  const segs = buildSegments(settings());

  it('son 12 semanas de 7 días y un tramo final de 6 días', () => {
    expect(segs).toHaveLength(13);
    expect(segs.slice(0, 12).every((s) => s.length === 7)).toBe(true);
    expect(segs[0]).toMatchObject({ index: 1, start: '2026-11-09', end: '2026-11-15', goal: 6, isFinal: false });
    expect(segs[12]).toMatchObject({ index: 13, start: '2027-02-01', end: '2027-02-06', length: 6, goal: 5, isFinal: true });
  });

  it('la meta se ajusta en tramos cortos y nunca baja de 1', () => {
    expect(goalFor(7, 6)).toBe(6);
    expect(goalFor(6, 6)).toBe(5);
    expect(goalFor(6, 7)).toBe(6);
    expect(goalFor(3, 6)).toBe(2);
    expect(goalFor(1, 6)).toBe(1);
  });
});

describe('estado de cada semana', () => {
  const s = settings();
  const seg = buildSegments(s)[0]!;

  it('por venir antes de que empiece', () => {
    expect(segmentProgress(seg, {}, s.core, '2026-11-08').status).toBe('future');
  });

  it('en curso mientras la meta todavía se puede alcanzar', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10']);
    expect(segmentProgress(seg, days, s.core, '2026-11-11')).toMatchObject({ status: 'active', completed: 2, elapsed: 3 });
  });

  it('un día fallado todavía permite ganar la semana (6 de 7)', () => {
    expect(segmentProgress(seg, {}, s.core, '2026-11-10').status).toBe('active');
  });

  it('ganada al llegar a 6 días completos, aunque falte un día', () => {
    const days = mark({}, rangeDates('2026-11-09', '2026-11-14'));
    expect(segmentProgress(seg, days, s.core, '2026-11-14').status).toBe('won');
  });

  it('no alcanzada cuando ya no hay días suficientes', () => {
    expect(segmentProgress(seg, {}, s.core, '2026-11-11').status).toBe('missed');
  });

  it('no alcanzada si terminó con 5 de 7', () => {
    const days = mark({}, rangeDates('2026-11-09', '2026-11-13'));
    expect(segmentProgress(seg, days, s.core, '2026-11-20')).toMatchObject({ status: 'missed', completed: 5 });
  });

  it('un día con 2 de 3 no cuenta como completo', () => {
    const days = mark({}, rangeDates('2026-11-09', '2026-11-14'), ['a', 'b']);
    expect(segmentProgress(seg, days, s.core, '2026-11-14').completed).toBe(0);
  });
});

describe('rachas por hábito', () => {
  const s = settings();

  it('si hoy aún no está marcado, la racha cuenta hasta ayer', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10', '2026-11-11'], ['a']);
    expect(currentStreak(days, 'core', 'a', s, '2026-11-12')).toBe(3);
  });

  it('al marcar hoy, la racha sube', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'], ['a']);
    expect(currentStreak(days, 'core', 'a', s, '2026-11-12')).toBe(4);
  });

  it('un día sin marcar en el pasado corta la racha', () => {
    const days = mark({}, ['2026-11-09', '2026-11-11'], ['a']);
    expect(currentStreak(days, 'core', 'a', s, '2026-11-12')).toBe(1);
  });

  it('antes del inicio no hay racha', () => {
    expect(currentStreak({}, 'core', 'a', s, '2026-11-08')).toBe(0);
  });

  it('calcula la mejor racha', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14'], ['a']);
    expect(bestStreak(days, 'core', 'a', s, '2026-11-15')).toBe(3);
  });

  it('las rachas de secundarios funcionan igual', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10'], [], ['x']);
    expect(currentStreak(days, 'extra', 'x', s, '2026-11-10')).toBe(2);
  });

  it('racha de días completos 3/3', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10']);
    mark(days, ['2026-11-11'], ['a']);
    expect(completeStreak(s, days, '2026-11-11')).toBe(2);
    expect(completeStreak(s, days, '2026-11-12')).toBe(0);
  });
});

describe('estadísticas del ciclo', () => {
  const s = settings();

  it('antes de empezar', () => {
    expect(cycleStats(s, {}, '2026-11-06')).toMatchObject({ phase: 'before', dayNumber: 0, daysLeft: 90 });
  });

  it('hoy sin marcar no baja el porcentaje', () => {
    const days = mark({}, ['2026-11-09']);
    mark(days, ['2026-11-10'], ['a']);
    const st = cycleStats(s, days, '2026-11-11');
    expect(st).toMatchObject({ phase: 'active', dayNumber: 3, completeDays: 1, completionPct: 67, daysLeft: 87 });
  });

  it('ciclo terminado', () => {
    const st = cycleStats(s, {}, addDays(START, 120));
    expect(st).toMatchObject({ phase: 'finished', dayNumber: 90, daysLeft: 0, segmentsTotal: 13 });
  });

  it('cuenta semanas ganadas', () => {
    const days = mark({}, rangeDates('2026-11-09', '2026-11-22'));
    expect(cycleStats(s, days, '2026-11-22').segmentsWon).toBe(2);
  });

  it('porcentaje por hábito', () => {
    const days = mark({}, ['2026-11-09', '2026-11-10'], ['a']);
    const [a] = habitStats(s, days, '2026-11-11', 'core');
    expect(a).toMatchObject({ done: 2, counted: 2, pct: 100, current: 2, best: 2 });
  });
});

describe('días editables y estado visual', () => {
  const s = settings();

  it('solo se editan días entre el inicio y hoy', () => {
    expect(isEditable(s, '2026-11-08', '2026-11-12')).toBe(false);
    expect(isEditable(s, '2026-11-12', '2026-11-12')).toBe(true);
    expect(isEditable(s, '2026-11-13', '2026-11-12')).toBe(false);
  });

  it('clasifica los días', () => {
    const days = mark({}, ['2026-11-09']);
    mark(days, ['2026-11-10'], ['a']);
    expect(dayState(s, days, s.core, '2026-11-09', '2026-11-12')).toBe('complete');
    expect(dayState(s, days, s.core, '2026-11-10', '2026-11-12')).toBe('partial');
    expect(dayState(s, days, s.core, '2026-11-11', '2026-11-12')).toBe('empty');
    expect(dayState(s, days, s.core, '2026-11-13', '2026-11-12')).toBe('future');
    expect(dayState(s, days, s.core, '2026-11-01', '2026-11-12')).toBe('outside');
  });
});

describe('reporte para Claude', () => {
  it('incluye día, semana, premio y núcleo', () => {
    const s = settings();
    const days = mark({}, ['2026-11-09', '2026-11-10'], ['a', 'b', 'c'], ['x']);
    const text = buildReport({ settings: s, days, rewards: { '1': { text: 'Comer carne' } } }, '2026-11-11');
    expect(text).toContain('día 3/90');
    expect(text).toContain('Semana 1 (9–15 nov): 2/7 días completos · meta 6 · en curso');
    expect(text).toContain('Premio de este tramo: Comer carne');
    expect(text).toContain('- Dormir: racha 2 · mejor 2 · 2/2 días (100%)');
    expect(text).toContain('Anki 2/3');
  });
});
