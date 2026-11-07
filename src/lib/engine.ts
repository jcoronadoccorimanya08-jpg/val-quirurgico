/**
 * Reglas del ciclo. Solo funciones puras: reciben los datos y "hoy". Pruebas en tests/engine.test.ts.
 *
 * - Porcentaje del día: el núcleo vale `coreWeight` (60%) repartido entre sus hábitos y los secundarios
 *   el resto (40%). Se gana el día con `dayGoal` (65%) o más.
 * - Modo examen: esos días solo cuenta el núcleo (cada hábito vale lo mismo).
 * - Modo viaje: esos días solo cuentan los hábitos elegidos (los demás ni suman ni restan) y puede tener otra meta.
 * - Un día salvado con comodín cuenta como ganado.
 * - Semanas de 7 días desde el inicio; se gana la semana con `weeklyGoal` días ganados (6 de 7).
 *   El último tramo es más corto y su meta baja en lo que le falta para 7.
 */
import { addDays, diffDays, maxDate, minDate, rangeDates, type ISODate } from './dates';
import type { DayLog, Habit, HabitKind, Settings } from './types';

export type Days = Record<ISODate, DayLog>;
type Cycle = Pick<Settings, 'startDate' | 'cycleLength'>;
type Scoring = Pick<Settings, 'core' | 'extras' | 'coreWeight' | 'dayGoal' | 'exam' | 'trip'>;

const EPS = 1e-9;

export interface Segment {
  index: number;
  start: ISODate;
  end: ISODate;
  length: number;
  goal: number;
  isFinal: boolean;
}

export type CyclePhase = 'before' | 'active' | 'finished';
export type SegmentStatus = 'future' | 'active' | 'won' | 'missed';
export type DayState = 'won' | 'partial' | 'empty' | 'future' | 'outside';

export interface SegmentProgress {
  segment: Segment;
  status: SegmentStatus;
  /** Días ganados hasta hoy dentro del tramo. */
  completed: number;
  elapsed: number;
}

// ---------- Ciclo ----------

export function cycleEnd(s: Cycle): ISODate {
  return addDays(s.startDate, s.cycleLength - 1);
}

export function dayNumber(start: ISODate, date: ISODate): number {
  return diffDays(start, date) + 1;
}

export function cyclePhase(s: Cycle, today: ISODate): CyclePhase {
  if (today < s.startDate) return 'before';
  if (today > cycleEnd(s)) return 'finished';
  return 'active';
}

export function lastPlayableDay(s: Cycle, today: ISODate): ISODate {
  return minDate(today, cycleEnd(s));
}

export function isEditable(s: Cycle, date: ISODate, today: ISODate): boolean {
  return date >= s.startDate && date <= lastPlayableDay(s, today);
}

/** Semana del ciclo (1, 2, …) a la que pertenece una fecha. */
export function weekOf(start: ISODate, date: ISODate): number {
  return Math.floor(diffDays(start, date) / 7) + 1;
}

/** Nombre del hábito para esa fecha (aplica metas por semana, como Meditar 10 → 15 min). */
export function habitLabel(h: Habit, start: ISODate, date: ISODate): string {
  if (!h.levels?.length) return h.name;
  const week = Math.max(1, weekOf(start, date));
  let name = h.levels[0]!.name;
  for (const lv of h.levels) if (week >= lv.fromWeek) name = lv.name;
  return name;
}

// ---------- Porcentaje del día ----------

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

export function extraCount(days: Days, date: ISODate, extras: Habit[]): number {
  let n = 0;
  for (const h of extras) if (isDone(days, date, 'extra', h.id)) n++;
  return n;
}

export function isExamDay(s: Pick<Settings, 'exam'>, date: ISODate): boolean {
  return Boolean(s.exam && date >= s.exam.from && date <= s.exam.to);
}

export function isTripDay(s: Pick<Settings, 'trip'>, date: ISODate): boolean {
  return Boolean(s.trip && date >= s.trip.from && date <= s.trip.to);
}

/** Hábitos que cuentan ese día: en viaje, los elegidos; en exámenes, solo el núcleo; si no, todos. */
export function countedHabits(s: Scoring, date: ISODate): { core: Habit[]; extras: Habit[] } {
  if (isTripDay(s, date)) {
    const ids = new Set(s.trip!.habits);
    return { core: s.core.filter((h) => ids.has(h.id)), extras: s.extras.filter((h) => ids.has(h.id)) };
  }
  if (isExamDay(s, date)) return { core: s.core, extras: [] };
  return { core: s.core, extras: s.extras };
}

/** Meta del día (en viaje puede ser otra). */
export function goalOn(s: Scoring, date: ISODate): number {
  return isTripDay(s, date) && s.trip?.dayGoal ? s.trip.dayGoal : s.dayGoal;
}

/** Cuánto vale cada hábito que cuenta ese día (en puntos de porcentaje). */
export function weights(s: Scoring, date: ISODate): { core: number; extra: number } {
  const { core, extras } = countedHabits(s, date);
  if (core.length === 0) return { core: 0, extra: extras.length ? 100 / extras.length : 0 };
  if (extras.length === 0) return { core: 100 / core.length, extra: 0 };
  return { core: s.coreWeight / core.length, extra: (100 - s.coreWeight) / extras.length };
}

export function dayPct(s: Scoring, days: Days, date: ISODate): number {
  const w = weights(s, date);
  const { core, extras } = countedHabits(s, date);
  return Math.min(100, coreCount(days, date, core) * w.core + extraCount(days, date, extras) * w.extra);
}

export function isWon(s: Scoring, days: Days, date: ISODate): boolean {
  return Boolean(days[date]?.wildcard) || dayPct(s, days, date) >= goalOn(s, date) - EPS;
}

/**
 * Lo mínimo que falta para ganar el día: cuántos del núcleo y cuántos secundarios.
 * Prefiere la opción con menos hábitos; si empatan, la que usa más núcleo.
 */
export function neededToWin(s: Scoring, days: Days, date: ISODate): { core: number; extra: number } | null {
  if (isWon(s, days, date)) return { core: 0, extra: 0 };
  const w = weights(s, date);
  const pct = dayPct(s, days, date);
  const goal = goalOn(s, date);
  const { core, extras } = countedHabits(s, date);
  const coreLeft = core.length - coreCount(days, date, core);
  const extraLeft = w.extra > 0 ? extras.length - extraCount(days, date, extras) : 0;
  let best: { core: number; extra: number } | null = null;
  for (let c = 0; c <= coreLeft; c++) {
    for (let e = 0; e <= extraLeft; e++) {
      if (pct + c * w.core + e * w.extra < goal - EPS) continue;
      if (!best || c + e < best.core + best.extra || (c + e === best.core + best.extra && c > best.core)) best = { core: c, extra: e };
      break;
    }
  }
  return best;
}

export function dayState(s: Cycle & Scoring, days: Days, date: ISODate, today: ISODate): DayState {
  if (date < s.startDate || date > cycleEnd(s)) return 'outside';
  if (date > today) return 'future';
  if (isWon(s, days, date)) return 'won';
  return dayPct(s, days, date) > 0 ? 'partial' : 'empty';
}

// ---------- Semanas ----------

export function goalFor(length: number, weeklyGoal: number): number {
  return Math.max(1, Math.min(length, weeklyGoal - (7 - length)));
}

export function buildSegments(s: Pick<Settings, 'startDate' | 'cycleLength' | 'weeklyGoal'>): Segment[] {
  const count = Math.ceil(s.cycleLength / 7);
  const out: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(s.startDate, i * 7);
    const length = Math.min(7, s.cycleLength - i * 7);
    out.push({ index: i + 1, start, end: addDays(start, length - 1), length, goal: goalFor(length, s.weeklyGoal), isFinal: i === count - 1 });
  }
  return out;
}

export function segmentFor(segments: Segment[], date: ISODate): Segment | undefined {
  return segments.find((seg) => date >= seg.start && date <= seg.end);
}

export function segmentProgress(segment: Segment, s: Scoring, days: Days, today: ISODate): SegmentProgress {
  if (today < segment.start) return { segment, status: 'future', completed: 0, elapsed: 0 };
  const counted = rangeDates(segment.start, minDate(today, segment.end));
  const completed = counted.filter((d) => isWon(s, days, d)).length;
  const elapsed = counted.length;
  if (completed >= segment.goal) return { segment, status: 'won', completed, elapsed };
  let open = 0;
  if (today <= segment.end) open = (isWon(s, days, today) ? 0 : 1) + diffDays(today, segment.end);
  return { segment, status: completed + open >= segment.goal ? 'active' : 'missed', completed, elapsed };
}

export function allSegmentProgress(s: Settings, days: Days, today: ISODate): SegmentProgress[] {
  return buildSegments(s).map((seg) => segmentProgress(seg, s, days, today));
}

/** Porcentaje promedio de una semana (días que ya pasaron o son hoy). */
export function segmentPct(seg: Segment, s: Scoring, days: Days, today: ISODate): number {
  if (today < seg.start) return 0;
  const dates = rangeDates(seg.start, minDate(today, seg.end));
  if (!dates.length) return 0;
  return dates.reduce((sum, d) => sum + dayPct(s, days, d), 0) / dates.length;
}

// ---------- Rachas ----------

export function currentStreak(days: Days, kind: HabitKind, id: string, s: Cycle, today: ISODate): number {
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

export function bestStreak(days: Days, kind: HabitKind, id: string, s: Cycle, today: ISODate): number {
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

/** Días ganados seguidos. Si hoy todavía no está ganado, cuenta desde ayer. */
export function wonStreak(s: Settings, days: Days, today: ISODate): number {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return 0;
  let d = ref;
  if (ref === today && !isWon(s, days, d)) d = addDays(d, -1);
  let n = 0;
  while (d >= s.startDate && isWon(s, days, d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ---------- Estadísticas ----------

/** Días que cuentan para promedios: los pasados, y hoy solo si ya tiene algo marcado. */
export function countedDays(s: Settings, days: Days, today: ISODate): ISODate[] {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return [];
  const list = rangeDates(s.startDate, ref);
  if (ref === today && dayPct(s, days, today) === 0 && !days[today]?.wildcard) list.pop();
  return list;
}

export interface CycleStats {
  phase: CyclePhase;
  dayNumber: number;
  wonDays: number;
  avgPct: number;
  segmentsWon: number;
  segmentsTotal: number;
  daysLeft: number;
}

export function cycleStats(s: Settings, days: Days, today: ISODate): CycleStats {
  const phase = cyclePhase(s, today);
  const counted = countedDays(s, days, today);
  const won = counted.filter((d) => isWon(s, days, d)).length;
  const avg = counted.length ? counted.reduce((sum, d) => sum + dayPct(s, days, d), 0) / counted.length : 0;
  const progress = allSegmentProgress(s, days, today);
  return {
    phase,
    dayNumber: Math.max(0, Math.min(s.cycleLength, dayNumber(s.startDate, today))),
    wonDays: won,
    avgPct: Math.round(avg),
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

/** Serie diaria para el gráfico de montaña: porcentaje de cada día y promedio móvil de 7 días. */
export function dailySeries(s: Settings, days: Days, today: ISODate): { date: ISODate; pct: number; avg7: number; won: boolean }[] {
  const ref = lastPlayableDay(s, today);
  if (ref < s.startDate) return [];
  const dates = rangeDates(s.startDate, ref);
  const pcts = dates.map((d) => dayPct(s, days, d));
  return dates.map((date, i) => {
    const from = Math.max(0, i - 6);
    const slice = pcts.slice(from, i + 1);
    return { date, pct: pcts[i]!, avg7: slice.reduce((a, b) => a + b, 0) / slice.length, won: isWon(s, days, date) };
  });
}

export function lastDays(today: ISODate, n: number, s: Cycle): ISODate[] {
  const ref = lastPlayableDay(s, today);
  const from = maxDate(s.startDate, addDays(ref, -(n - 1)));
  return ref < s.startDate ? [] : rangeDates(from, ref);
}

/** Porcentaje de cada semana que ya empezó, por fecha de inicio (lo que se comparte para la semana victoriosa). */
export function weeklyPcts(s: Settings, days: Days, today: ISODate): Record<ISODate, number> {
  const out: Record<ISODate, number> = {};
  for (const seg of buildSegments(s)) {
    if (today < seg.start) continue;
    out[seg.start] = Math.round(segmentPct(seg, s, days, today) * 10) / 10;
  }
  return out;
}

export interface MoodStat {
  mood: 1 | 2 | 3 | 4 | 5;
  days: number;
  avgPct: number;
}

/** Cuántos días marcaste cada ánimo y tu porcentaje promedio esos días. */
export function moodStats(s: Settings, days: Days, dates: ISODate[]): MoodStat[] {
  const out: MoodStat[] = [];
  for (const mood of [5, 4, 3, 2, 1] as const) {
    const list = dates.filter((d) => days[d]?.mood === mood);
    if (list.length) out.push({ mood, days: list.length, avgPct: list.reduce((a, d) => a + dayPct(s, days, d), 0) / list.length });
  }
  return out;
}
