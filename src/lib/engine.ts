/**
 * Motor de rachas y semanas. Solo funciones puras: reciben los datos y "hoy", y no tocan el almacenamiento.
 * Todas las reglas del ciclo están aquí y tienen pruebas en tests/engine.test.ts.
 */
import { addDays, diffDays, maxDate, minDate, rangeDates, type ISODate } from './dates';
import type { DayLog, Habit, HabitKind, Settings } from './types';

export type Days = Record<ISODate, DayLog>;
type CycleSettings = Pick<Settings, 'startDate' | 'cycleLength' | 'weeklyGoal'>;

export interface Segment {
  /** 1 … 13 */
  index: number;
  start: ISODate;
  end: ISODate;
  length: number;
  /** Días completos necesarios para ganar el premio de este tramo. */
  goal: number;
  /** El último tramo del ciclo: el del gran premio. */
  isFinal: boolean;
}

export type CyclePhase = 'before' | 'active' | 'finished';
export type SegmentStatus = 'future' | 'active' | 'won' | 'missed';
export type DayState = 'complete' | 'partial' | 'empty' | 'future' | 'outside';

export interface SegmentProgress {
  segment: Segment;
  status: SegmentStatus;
  /** Días completos hasta hoy dentro del tramo. */
  completed: number;
  /** Días del tramo que ya pasaron o son hoy. */
  elapsed: number;
}

export function cycleEnd(s: Pick<Settings, 'startDate' | 'cycleLength'>): ISODate {
  return addDays(s.startDate, s.cycleLength - 1);
}

export function dayNumber(start: ISODate, date: ISODate): number {
  return diffDays(start, date) + 1;
}

export function cyclePhase(s: Pick<Settings, 'startDate' | 'cycleLength'>, today: ISODate): CyclePhase {
  if (today < s.startDate) return 'before';
  if (today > cycleEnd(s)) return 'finished';
  return 'active';
}

/** Último día del ciclo que ya se puede marcar: hoy, o el último día si el ciclo terminó. */
export function lastPlayableDay(s: Pick<Settings, 'startDate' | 'cycleLength'>, today: ISODate): ISODate {
  return minDate(today, cycleEnd(s));
}

/** Meta de un tramo: en un tramo corto se descuentan los días que le faltan para 7. */
export function goalFor(length: number, weeklyGoal: number): number {
  return Math.max(1, Math.min(length, weeklyGoal - (7 - length)));
}

export function buildSegments(s: CycleSettings): Segment[] {
  const count = Math.ceil(s.cycleLength / 7);
  const out: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(s.startDate, i * 7);
    const length = Math.min(7, s.cycleLength - i * 7);
    out.push({
      index: i + 1,
      start,
      end: addDays(start, length - 1),
      length,
      goal: goalFor(length, s.weeklyGoal),
      isFinal: i === count - 1,
    });
  }
  return out;
}

export function segmentFor(segments: Segment[], date: ISODate): Segment | undefined {
  return segments.find((seg) => date >= seg.start && date <= seg.end);
}

export function isDone(days: Days, date: ISODate, kind: HabitKind, id: string): boolean {
  const log = days[date];
  if (!log) return false;
  return Boolean(kind === 'core' ? log.core?.[id] : log.extra?.[id]);
}

export function coreCount(days: Days, date: ISODate, core: Habit[]): number {
  let n = 0;
  for (const h of core) if (isDone(days, date, 'core', h.id)) n++;
  return n;
}

export function isComplete(days: Days, date: ISODate, core: Habit[]): boolean {
  return core.length > 0 && coreCount(days, date, core) === core.length;
}

export function dayState(
  s: Pick<Settings, 'startDate' | 'cycleLength'>,
  days: Days,
  core: Habit[],
  date: ISODate,
  today: ISODate,
): DayState {
  if (date < s.startDate || date > cycleEnd(s)) return 'outside';
  if (date > today) return 'future';
  const n = coreCount(days, date, core);
  if (n === 0) return 'empty';
  return n === core.length ? 'complete' : 'partial';
}

export function segmentProgress(segment: Segment, days: Days, core: Habit[], today: ISODate): SegmentProgress {
  if (today < segment.start) return { segment, status: 'future', completed: 0, elapsed: 0 };

  const counted = rangeDates(segment.start, minDate(today, segment.end));
  const completed = counted.filter((d) => isComplete(days, d, core)).length;
  const elapsed = counted.length;
  if (completed >= segment.goal) return { segment, status: 'won', completed, elapsed };

  // Lo que todavía se puede sumar: hoy (si aún no está completo) y los días que faltan.
  let open = 0;
  if (today <= segment.end) {
    open = (isComplete(days, today, core) ? 0 : 1) + diffDays(today, segment.end);
  }
  const status: SegmentStatus = completed + open >= segment.goal ? 'active' : 'missed';
  return { segment, status, completed, elapsed };
}

export function allSegmentProgress(s: Settings, days: Days, today: ISODate): SegmentProgress[] {
  return buildSegments(s).map((seg) => segmentProgress(seg, days, s.core, today));
}

/**
 * Racha actual de un hábito. Si hoy todavía no está marcado, no rompe la racha:
 * se cuenta desde ayer, porque hoy aún se puede marcar.
 */
export function currentStreak(
  days: Days,
  kind: HabitKind,
  id: string,
  s: Pick<Settings, 'startDate' | 'cycleLength'>,
  today: ISODate,
): number {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return 0;
  let d = ref;
  if (ref === today && !isDone(days, d, kind, id)) d = addDays(d, -1);
  let n = 0;
  while (d >= s.startDate && isDone(days, d, kind, id)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(
  days: Days,
  kind: HabitKind,
  id: string,
  s: Pick<Settings, 'startDate' | 'cycleLength'>,
  today: ISODate,
): number {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return 0;
  let best = 0;
  let run = 0;
  for (const d of rangeDates(s.startDate, ref)) {
    if (isDone(days, d, kind, id)) {
      run++;
      if (run > best) best = run;
    } else run = 0;
  }
  return best;
}

/** Días que cuentan para porcentajes: los pasados, y hoy solo si ya tiene algo marcado. */
export function countedDays(s: Settings, days: Days, today: ISODate): ISODate[] {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return [];
  const list = rangeDates(s.startDate, ref);
  if (ref === today && coreCount(days, today, s.core) === 0 && !hasAnyExtra(days, today)) list.pop();
  return list;
}

function hasAnyExtra(days: Days, date: ISODate): boolean {
  const extra = days[date]?.extra;
  return Boolean(extra && Object.values(extra).some(Boolean));
}

export interface CycleStats {
  phase: CyclePhase;
  /** Día del ciclo (1 … cycleLength), limitado al rango. */
  dayNumber: number;
  completeDays: number;
  completionPct: number;
  segmentsWon: number;
  segmentsTotal: number;
  /** Días que quedan después de hoy. */
  daysLeft: number;
}

export function cycleStats(s: Settings, days: Days, today: ISODate): CycleStats {
  const phase = cyclePhase(s, today);
  const counted = countedDays(s, days, today);
  let points = 0;
  let complete = 0;
  for (const d of counted) {
    const n = coreCount(days, d, s.core);
    points += n;
    if (n === s.core.length && n > 0) complete++;
  }
  const possible = counted.length * s.core.length;
  const progress = allSegmentProgress(s, days, today);
  const rawDay = dayNumber(s.startDate, today);
  return {
    phase,
    dayNumber: Math.max(0, Math.min(s.cycleLength, rawDay)),
    completeDays: complete,
    completionPct: possible ? Math.round((points / possible) * 100) : 0,
    segmentsWon: progress.filter((p) => p.status === 'won').length,
    segmentsTotal: progress.length,
    daysLeft: phase === 'before' ? s.cycleLength : phase === 'finished' ? 0 : diffDays(today, cycleEnd(s)),
  };
}

export interface HabitStat {
  habit: Habit;
  kind: HabitKind;
  done: number;
  counted: number;
  pct: number;
  current: number;
  best: number;
}

export function habitStats(s: Settings, days: Days, today: ISODate, kind: HabitKind): HabitStat[] {
  const counted = countedDays(s, days, today);
  const list = kind === 'core' ? s.core : s.extras;
  return list.map((habit) => {
    const done = counted.filter((d) => isDone(days, d, kind, habit.id)).length;
    return {
      habit,
      kind,
      done,
      counted: counted.length,
      pct: counted.length ? Math.round((done / counted.length) * 100) : 0,
      current: currentStreak(days, kind, habit.id, s, today),
      best: bestStreak(days, kind, habit.id, s, today),
    };
  });
}

/** Cuántos días seguidos lleva completando el núcleo (3/3). Si hoy no está completo aún, cuenta desde ayer. */
export function completeStreak(s: Settings, days: Days, today: ISODate): number {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return 0;
  let d = ref;
  if (ref === today && !isComplete(days, d, s.core)) d = addDays(d, -1);
  let n = 0;
  while (d >= s.startDate && isComplete(days, d, s.core)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function lastDays(today: ISODate, n: number, s: Pick<Settings, 'startDate' | 'cycleLength'>): ISODate[] {
  const ref = lastPlayableDay(s, today);
  const from = maxDate(s.startDate, addDays(ref, -(n - 1)));
  return ref < s.startDate ? [] : rangeDates(from, ref);
}

/** Días que se pueden editar: desde el inicio del ciclo hasta hoy (o el último día del ciclo). */
export function isEditable(s: Pick<Settings, 'startDate' | 'cycleLength'>, date: ISODate, today: ISODate): boolean {
  return date >= s.startDate && date <= lastPlayableDay(s, today);
}
