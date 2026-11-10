/** Validación del estado (al descifrar y al restaurar respaldos). */
import { CYCLE_LENGTH, DEFAULT_CORE_WEIGHT, DEFAULT_DAY_GOAL, DEFAULT_FUND_PER_WEEK } from './config';
import { isValidISODate } from './dates';
import { isAccent, isTextSize, isTheme } from './look';
import type { AppState, CatalogItem, Chest, ChestOutcome, CycleSummary, DayLog, Habit, Mood, Redemption, Settings, SharedGrand, SpecialPrize, Theme, TripMode } from './types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const num = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : def;

function habits(v: unknown, withMin: boolean): Habit[] {
  if (!Array.isArray(v)) return [];
  const out: Habit[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (!isObj(item)) continue;
    const id = str(item.id, 40);
    const name = str(item.name, 80);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const h: Habit = { id, name };
    if (isValidISODate(item.since)) h.since = item.since;
    const min = str(item.min, 140);
    if (withMin && min) h.min = min;
    if (Array.isArray(item.steps)) {
      const steps = item.steps.map((x) => str(x, 100)).filter((x): x is string => Boolean(x)).slice(0, 8);
      if (steps.length) h.steps = steps;
    }
    if (Array.isArray(item.levels)) {
      const levels = item.levels
        .filter(isObj)
        .map((l) => ({ fromWeek: num(l.fromWeek, 1, 60, 1), name: str(l.name, 80) ?? '' }))
        .filter((l) => l.name)
        .sort((a, b) => a.fromWeek - b.fromWeek)
        .slice(0, 6);
      if (levels.length) h.levels = levels;
    }
    out.push(h);
  }
  return out;
}

function catalog(v: unknown): CatalogItem[] {
  if (!Array.isArray(v)) return [];
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const c of v) {
    if (!isObj(c)) continue;
    const id = str(c.id, 40);
    const name = str(c.name, 60);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, price: Math.round(num(c.price, 0, 100000, 0)), active: c.active !== false });
  }
  return out.slice(0, 30);
}

function special(v: unknown): SpecialPrize | null {
  if (!isObj(v)) return null;
  const name = str(v.name, 60);
  if (!name || !isValidISODate(v.unlockDate)) return null;
  const sp: SpecialPrize = { name, unlockDate: v.unlockDate, requiredWeeks: Math.round(num(v.requiredWeeks, 0, 13, 2)) };
  if (isValidISODate(v.date)) sp.date = v.date;
  const c = str(v.claimedAt, 40);
  if (c) sp.claimedAt = c;
  return sp;
}

function trip(v: unknown): TripMode | null {
  if (!isObj(v) || !isValidISODate(v.from) || !isValidISODate(v.to) || v.from > v.to) return null;
  const habits = Array.isArray(v.habits) ? [...new Set(v.habits.map((x) => str(x, 40)).filter((x): x is string => Boolean(x)))].slice(0, 30) : [];
  if (!habits.length) return null;
  const t: TripMode = { from: v.from, to: v.to, habits };
  if (typeof v.dayGoal === 'number') t.dayGoal = Math.round(num(v.dayGoal, 1, 100, DEFAULT_DAY_GOAL));
  return t;
}

function grand(v: unknown): SharedGrand | null {
  if (!isObj(v)) return null;
  const name = str(v.name, 60);
  if (!name) return null;
  return { name, weeks: Math.round(num(v.weeks, 1, 13, 9)) };
}

function settings(v: unknown): Settings | null {
  if (!isObj(v) || !isValidISODate(v.startDate)) return null;
  const core = habits(v.core, true);
  if (!core.length) return null;
  const theme: Theme = isTheme(v.theme) ? v.theme : 'system';
  const exam = isObj(v.exam) && isValidISODate(v.exam.from) && isValidISODate(v.exam.to) && v.exam.from <= v.exam.to ? { from: v.exam.from, to: v.exam.to } : null;
  const s: Settings = {
    startDate: v.startDate,
    cycleLength: Math.round(num(v.cycleLength, 7, 365, CYCLE_LENGTH)),
    weeklyGoal: Math.round(num(v.weeklyGoal, 1, 7, 6)),
    core,
    extras: habits(v.extras, false),
    vacation: habits(v.vacation, false),
    coreWeight: num(v.coreWeight, 0, 100, DEFAULT_CORE_WEIGHT),
    dayGoal: num(v.dayGoal, 1, 100, DEFAULT_DAY_GOAL),
    exam,
    fundPerWeek: Math.round(num(v.fundPerWeek, 0, 10000, DEFAULT_FUND_PER_WEEK)),
    catalog: catalog(v.catalog),
    special: special(v.special),
    trip: trip(v.trip),
    grand: grand(v.grand),
    theme,
    autoLockMinutes: Math.round(num(v.autoLockMinutes, 0, 60, 1)),
    createdAt: str(v.createdAt, 40) ?? new Date().toISOString(),
  };
  const lb = str(v.lastBackupAt, 40);
  if (lb) s.lastBackupAt = lb;
  if (isAccent(v.accent) && v.accent !== 'verde') s.accent = v.accent;
  if (isTextSize(v.textSize) && v.textSize !== 'normal') s.textSize = v.textSize;
  if (Array.isArray(v.applied)) {
    const applied = v.applied.map((x) => str(x, 40)).filter((x): x is string => Boolean(x)).slice(0, 20);
    if (applied.length) s.applied = applied;
  }
  return s;
}

function flags(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isObj(v)) return out;
  for (const [k, val] of Object.entries(v)) if (val === true) out[k.slice(0, 40)] = true;
  return out;
}

const OUTCOMES: ChestOutcome[] = ['bs20', 'bs50', 'wildcard', 'movie'];

function history(v: unknown): CycleSummary[] {
  if (!Array.isArray(v)) return [];
  const out: CycleSummary[] = [];
  for (const c of v) {
    if (!isObj(c) || !isValidISODate(c.start) || !isValidISODate(c.end)) continue;
    const n = (x: unknown, max: number) => Math.round(num(x, 0, max, 0));
    out.push({
      start: c.start,
      end: c.end,
      days: n(c.days, 400),
      daysWon: n(c.daysWon, 400),
      avgPct: n(c.avgPct, 100),
      weeksWon: n(c.weeksWon, 60),
      weeksTotal: n(c.weeksTotal, 60),
      badges: n(c.badges, 20),
      fundEarned: n(c.fundEarned, 1_000_000),
      redeemed: n(c.redeemed, 1000),
      archivedAt: str(c.archivedAt, 40) ?? '',
    });
  }
  return out.slice(-50);
}

export function sanitizeState(raw: unknown): AppState | null {
  if (!isObj(raw) || raw.schema !== 2) return null;
  const s = settings(raw.settings);
  if (!s) return null;
  const state: AppState = { schema: 2, settings: s, days: {}, chests: {}, redemptions: [] };
  if (isObj(raw.days)) {
    for (const [date, log] of Object.entries(raw.days)) {
      if (!isValidISODate(date) || !isObj(log)) continue;
      const day: DayLog = { core: flags(log.core), extra: flags(log.extra) };
      if (log.wildcard === true) day.wildcard = true;
      if (typeof log.mood === 'number' && Number.isInteger(log.mood) && log.mood >= 1 && log.mood <= 5) day.mood = log.mood as Mood;
      const u = str(log.updatedAt, 40);
      if (u) day.updatedAt = u;
      state.days[date] = day;
    }
  }
  if (isObj(raw.chests)) {
    for (const [k, c] of Object.entries(raw.chests)) {
      if (!/^\d{1,2}$/.test(k) || !isObj(c) || !OUTCOMES.includes(c.outcome as ChestOutcome)) continue;
      const chest: Chest = { outcome: c.outcome as ChestOutcome, openedAt: str(c.openedAt, 40) ?? '' };
      state.chests[k] = chest;
    }
  }
  if (Array.isArray(raw.redemptions)) {
    for (const r of raw.redemptions) {
      if (!isObj(r)) continue;
      const id = str(r.id, 40);
      const itemId = str(r.itemId, 40);
      const name = str(r.name, 60);
      if (!id || !itemId || !name) continue;
      const red: Redemption = { id, itemId, name, price: Math.round(num(r.price, 0, 100000, 0)), at: str(r.at, 40) ?? '' };
      state.redemptions.push(red);
    }
  }
  const past = history(raw.history);
  if (past.length) state.history = past;
  return state;
}
