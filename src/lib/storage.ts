/**
 * Almacenamiento local con doble copia:
 * - localStorage se escribe al instante (sincrónico), así nada se pierde si cierras la app de golpe.
 * - IndexedDB guarda la copia principal, más resistente y con más espacio.
 * Al abrir, se usa la copia más reciente de las dos.
 */
import { createStore, del, get, set } from 'idb-keyval';
import { isValidISODate } from './dates';
import type { AppState, DayLog, Habit, Reward, Settings, Theme } from './types';

const KEY = 'app-state';
const LS_KEY = 'val-quirurgico.state';
const store = typeof indexedDB !== 'undefined' ? createStore('val-quirurgico', 'state') : null;

interface Envelope {
  savedAt: number;
  state: unknown;
}

export function emptyState(): AppState {
  return { schema: 1, settings: null, days: {}, rewards: {} };
}

function readEnvelope(raw: unknown): { savedAt: number; state: AppState } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const env = raw as Partial<Envelope>;
  const state = sanitizeState(env.state);
  if (!state) return null;
  return { savedAt: typeof env.savedAt === 'number' ? env.savedAt : 0, state };
}

export async function loadState(): Promise<AppState> {
  let fromIdb: ReturnType<typeof readEnvelope> = null;
  let fromLs: ReturnType<typeof readEnvelope> = null;
  try {
    if (store) fromIdb = readEnvelope(await get(KEY, store));
  } catch {
    /* se usa la otra copia */
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) fromLs = readEnvelope(JSON.parse(raw));
  } catch {
    /* se usa la otra copia */
  }
  const best = [fromIdb, fromLs].filter((x) => x !== null).sort((a, b) => b.savedAt - a.savedAt)[0];
  return best?.state ?? emptyState();
}

export async function saveState(state: AppState): Promise<void> {
  const env: Envelope = { savedAt: Date.now(), state };
  let ok = false;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(env));
    ok = true;
  } catch {
    /* sin espacio en localStorage: queda IndexedDB */
  }
  if (store) {
    try {
      await set(KEY, env, store);
      ok = true;
    } catch {
      /* queda la copia de localStorage */
    }
  }
  if (!ok) throw new Error('No se pudo guardar');
}

export async function clearState(): Promise<void> {
  try {
    if (store) await del(KEY, store);
  } finally {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* nada */
    }
  }
}

/** Pide al navegador que no borre los datos de la app cuando falte espacio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// ---------- Validación (para datos guardados y respaldos importados) ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 160): string | null => (typeof v === 'string' ? v.slice(0, max) : null);

function sanitizeHabits(v: unknown, withMin: boolean): Habit[] | null {
  if (!Array.isArray(v)) return null;
  const out: Habit[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (!isObj(item)) continue;
    const id = str(item.id, 40);
    const name = str(item.name, 80);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const habit: Habit = { id, name };
    const min = str(item.min, 140);
    if (withMin && min) habit.min = min;
    out.push(habit);
  }
  return out;
}

function sanitizeSettings(v: unknown): Settings | null {
  if (!isObj(v)) return null;
  const core = sanitizeHabits(v.core, true);
  const extras = sanitizeHabits(v.extras, false);
  if (!isValidISODate(v.startDate) || !core || core.length === 0 || !extras) return null;
  const cycleLength = typeof v.cycleLength === 'number' && v.cycleLength >= 7 && v.cycleLength <= 365 ? Math.round(v.cycleLength) : 90;
  const weeklyGoal = typeof v.weeklyGoal === 'number' && v.weeklyGoal >= 1 && v.weeklyGoal <= 7 ? Math.round(v.weeklyGoal) : 6;
  const theme: Theme = v.theme === 'dark' || v.theme === 'light' ? v.theme : 'system';
  const settings: Settings = {
    startDate: v.startDate,
    cycleLength,
    weeklyGoal,
    core,
    extras,
    theme,
    createdAt: str(v.createdAt, 40) ?? new Date().toISOString(),
  };
  const lastBackupAt = str(v.lastBackupAt, 40);
  if (lastBackupAt) settings.lastBackupAt = lastBackupAt;
  return settings;
}

function sanitizeFlags(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!isObj(v)) return out;
  for (const [k, val] of Object.entries(v)) if (val === true) out[k.slice(0, 40)] = true;
  return out;
}

export function sanitizeState(raw: unknown): AppState | null {
  if (!isObj(raw) || raw.schema !== 1) return null;
  const state = emptyState();
  state.settings = raw.settings === null ? null : sanitizeSettings(raw.settings);
  if (isObj(raw.days)) {
    for (const [date, log] of Object.entries(raw.days)) {
      if (!isValidISODate(date) || !isObj(log)) continue;
      const day: DayLog = { core: sanitizeFlags(log.core), extra: sanitizeFlags(log.extra) };
      const updatedAt = str(log.updatedAt, 40);
      if (updatedAt) day.updatedAt = updatedAt;
      state.days[date] = day;
    }
  }
  if (isObj(raw.rewards)) {
    for (const [k, r] of Object.entries(raw.rewards)) {
      if (!/^\d{1,2}$/.test(k) || !isObj(r)) continue;
      const reward: Reward = { text: str(r.text, 80) ?? '' };
      const claimedAt = str(r.claimedAt, 40);
      if (claimedAt) reward.claimedAt = claimedAt;
      state.rewards[k] = reward;
    }
  }
  return state;
}
