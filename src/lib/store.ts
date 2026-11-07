/**
 * Estado de Val Q + bloqueo con patrón y huella.
 * Mientras la app está abierta, la llave de los datos vive solo en memoria. Cada cambio se cifra y se guarda al instante.
 */
import { useSyncExternalStore } from 'react';
import { biometricSupport, prfWithBiometric, registerBiometric } from './biometric';
import {
  CYCLE_LENGTH,
  DEFAULT_CATALOG,
  DEFAULT_CORE,
  DEFAULT_CORE_WEIGHT,
  DEFAULT_DAY_GOAL,
  DEFAULT_EXTRAS,
  DEFAULT_FUND_PER_WEEK,
  DEFAULT_VACATION,
  DEFAULT_WEEKLY_GOAL,
  MAX_EXTRAS,
  SHORT_NAME,
  defaultSpecial,
} from './config';
import {
  KDF_ITERATIONS,
  decryptBytes,
  decryptJSON,
  deriveKey,
  encryptBytes,
  encryptJSON,
  fromB64,
  importDataKey,
  keyFromPrf,
  newDataKey,
  randomBytes,
  toB64,
} from './crypto';
import type { ISODate } from './dates';
import { chestFromRoll } from './rewards';
import { sanitizeState } from './sanitize';
import type { AppState, CatalogItem, ExamPeriod, Habit, HabitKind, Settings, SpecialPrize } from './types';
import { deleteVault, readVault, removeLegacyPlaintext, requestPersistence, writeVault, type LockRecord, type VaultRecord } from './vault';

export type Phase = 'loading' | 'setup' | 'locked' | 'unlocked';

interface Snapshot {
  phase: Phase;
  state: AppState | null;
  /** La huella está activada en este teléfono. */
  hasBio: boolean;
}

let snap: Snapshot = { phase: 'loading', state: null, hasBio: false };
let dkRaw: Uint8Array<ArrayBuffer> | null = null;
let dataKey: CryptoKey | null = null;
let lockRec: LockRecord | null = null;
let writing: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const errorListeners = new Set<(m: string) => void>();

function emit() {
  for (const l of listeners) l();
}

function set(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  emit();
}

export function useStore(): Snapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snap,
    () => snap,
  );
}

export function getState(): AppState | null {
  return snap.state;
}

export function onSaveError(cb: (m: string) => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

function persist(): Promise<void> {
  writing = writing.then(async () => {
    const st = snap.state;
    if (!dataKey || !st || !lockRec) return;
    try {
      const record: VaultRecord = { v: 2, savedAt: Date.now(), lock: lockRec, data: await encryptJSON(dataKey, st) };
      await writeVault(record);
    } catch {
      for (const l of errorListeners) l('No se pudo guardar. Revisa el espacio del teléfono.');
    }
  });
  return writing;
}

export function flush(): Promise<void> {
  return writing;
}

function commit(next: AppState) {
  set({ state: next });
  void persist();
}

// ---------- Bóveda ----------

export async function initStore(): Promise<void> {
  removeLegacyPlaintext();
  const v = await readVault();
  lockRec = v?.lock ?? null;
  set({ phase: v ? 'locked' : 'setup', state: null, hasBio: Boolean(v?.lock.bio) });
}

async function patternLock(pattern: string, raw: Uint8Array<ArrayBuffer>) {
  const salt = randomBytes(16);
  const kek = await deriveKey(pattern, salt, KDF_ITERATIONS);
  return { iter: KDF_ITERATIONS, salt: toB64(salt), wrapped: await encryptBytes(kek, raw) };
}

async function openWith(raw: Uint8Array<ArrayBuffer>, record: VaultRecord): Promise<AppState | null> {
  const key = await importDataKey(raw);
  const state = sanitizeState(await decryptJSON(key, record.data));
  if (!state) return null;
  dkRaw = raw;
  dataKey = key;
  return state;
}

export async function createVault(pattern: string, state: AppState): Promise<void> {
  const raw = newDataKey();
  dkRaw = raw;
  dataKey = await importDataKey(raw);
  lockRec = { pattern: await patternLock(pattern, raw) };
  set({ phase: 'unlocked', state, hasBio: false });
  await persist();
  void requestPersistence();
}

/** Devuelve la llave de los datos si el patrón es correcto. */
async function unwrapWithPattern(lock: LockRecord, pattern: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const kek = await deriveKey(pattern, fromB64(lock.pattern.salt), lock.pattern.iter);
    return await decryptBytes(kek, lock.pattern.wrapped);
  } catch {
    return null;
  }
}

export async function unlockWithPattern(pattern: string): Promise<boolean> {
  const v = await readVault();
  if (!v) {
    set({ phase: 'setup' });
    return false;
  }
  const raw = await unwrapWithPattern(v.lock, pattern);
  if (!raw) return false;
  const state = await openWith(raw, v);
  if (!state) return false;
  lockRec = v.lock;
  set({ phase: 'unlocked', state, hasBio: Boolean(v.lock.bio) });
  return true;
}

/** 'ok' | 'fail' (huella rechazada o cancelada) | 'unavailable' */
export async function unlockWithBiometric(): Promise<'ok' | 'fail' | 'unavailable'> {
  const v = await readVault();
  const bio = v?.lock.bio;
  if (!v || !bio) return 'unavailable';
  try {
    const prf = await prfWithBiometric(bio.credId, bio.prfSalt);
    const raw = await decryptBytes(await keyFromPrf(prf), bio.wrapped);
    const state = await openWith(raw, v);
    if (!state) return 'fail';
    lockRec = v.lock;
    set({ phase: 'unlocked', state, hasBio: true });
    return 'ok';
  } catch {
    return 'fail';
  }
}

export async function verifyPattern(pattern: string): Promise<boolean> {
  const v = await readVault();
  return Boolean(v && (await unwrapWithPattern(v.lock, pattern)));
}

export async function changePattern(pattern: string): Promise<void> {
  if (!dkRaw || !lockRec) return;
  await writing;
  lockRec = { ...lockRec, pattern: await patternLock(pattern, dkRaw) };
  await persist();
}

export { biometricSupport };

/** Activa la huella. Lanza 'NOPRF' si el teléfono no lo permite, o 'CANCEL' si se canceló. */
export async function enableBiometric(): Promise<void> {
  if (!dkRaw || !lockRec) throw new Error('LOCKED');
  const reg = await registerBiometric(SHORT_NAME);
  const wrapped = await encryptBytes(await keyFromPrf(reg.prfOutput), dkRaw);
  lockRec = { ...lockRec, bio: { credId: reg.credId, prfSalt: reg.prfSalt, wrapped } };
  set({ hasBio: true });
  await persist();
}

export async function disableBiometric(): Promise<void> {
  if (!lockRec) return;
  const { bio: _bio, ...rest } = lockRec;
  void _bio;
  lockRec = rest;
  set({ hasBio: false });
  await persist();
}

export function lock() {
  if (snap.phase !== 'unlocked') return;
  dkRaw = null;
  dataKey = null;
  set({ phase: 'locked', state: null });
}

/** Solo para «¿Olvidaste tu patrón?». */
export async function wipeAll(): Promise<void> {
  await writing;
  dkRaw = null;
  dataKey = null;
  lockRec = null;
  await deleteVault();
  set({ phase: 'setup', state: null, hasBio: false });
}

// ---------- Respaldo ----------

/** Copia cifrada de tus datos, que se abre con tu patrón actual (sin la huella, que es de este teléfono). */
export async function currentBackup(): Promise<Omit<VaultRecord, 'savedAt'> | null> {
  if (!dataKey || !lockRec || !snap.state) return null;
  await writing;
  return { v: 2, lock: { pattern: lockRec.pattern }, data: await encryptJSON(dataKey, snap.state) };
}

/** Abre un respaldo con su patrón. null si el patrón no es el correcto. */
export async function openBackup(record: Pick<VaultRecord, 'lock' | 'data'>, pattern: string): Promise<AppState | null> {
  const raw = await unwrapWithPattern(record.lock, pattern);
  if (!raw) return null;
  try {
    return sanitizeState(await decryptJSON(await importDataKey(raw), record.data));
  } catch {
    return null;
  }
}

/** Reemplaza los datos actuales por los de un respaldo (se guardan con tu patrón actual). */
export function replaceState(next: AppState) {
  commit(next);
}

// ---------- Estado inicial ----------

export function initialState(startDate: ISODate, exam: ExamPeriod | null, theme: Settings['theme'] = 'system'): AppState {
  const settings: Settings = {
    startDate,
    cycleLength: CYCLE_LENGTH,
    weeklyGoal: DEFAULT_WEEKLY_GOAL,
    core: structuredClone(DEFAULT_CORE),
    extras: structuredClone(DEFAULT_EXTRAS),
    vacation: structuredClone(DEFAULT_VACATION),
    coreWeight: DEFAULT_CORE_WEIGHT,
    dayGoal: DEFAULT_DAY_GOAL,
    exam,
    fundPerWeek: DEFAULT_FUND_PER_WEEK,
    catalog: structuredClone(DEFAULT_CATALOG),
    special: defaultSpecial(startDate),
    theme,
    autoLockMinutes: 1,
    createdAt: new Date().toISOString(),
  };
  return { schema: 2, settings, days: {}, chests: {}, redemptions: [] };
}

// ---------- Acciones ----------

function update(fn: (s: AppState) => AppState) {
  if (!snap.state) return;
  commit(fn(snap.state));
}

function updateSettings(fn: (s: Settings) => Settings) {
  update((st) => ({ ...st, settings: fn(st.settings) }));
}

function newId(prefix: string): string {
  return `${prefix}-${toB64(randomBytes(6)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase()}`;
}

export const actions = {
  toggle(date: ISODate, kind: HabitKind, id: string) {
    update((st) => {
      const prev = st.days[date] ?? { core: {}, extra: {} };
      const group = kind === 'core' ? 'core' : 'extra';
      const flags = { ...prev[group] };
      if (flags[id]) delete flags[id];
      else flags[id] = true;
      return { ...st, days: { ...st.days, [date]: { ...prev, [group]: flags, updatedAt: new Date().toISOString() } } };
    });
  },

  useWildcard(date: ISODate) {
    update((st) => {
      const prev = st.days[date] ?? { core: {}, extra: {} };
      return { ...st, days: { ...st.days, [date]: { ...prev, wildcard: true, updatedAt: new Date().toISOString() } } };
    });
  },

  removeWildcard(date: ISODate) {
    update((st) => {
      const prev = st.days[date];
      if (!prev) return st;
      const { wildcard: _w, ...rest } = prev;
      void _w;
      return { ...st, days: { ...st.days, [date]: rest } };
    });
  },

  /** Abre el cofre de una semana ganada y devuelve lo que salió. */
  openChest(week: number): AppState['chests'][string] | null {
    const st = snap.state;
    if (!st || st.chests[String(week)]) return null;
    const roll = crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
    const chest = { outcome: chestFromRoll(roll), openedAt: new Date().toISOString() };
    commit({ ...st, chests: { ...st.chests, [String(week)]: chest } });
    return chest;
  },

  redeem(item: CatalogItem) {
    update((st) => ({
      ...st,
      redemptions: [...st.redemptions, { id: newId('r'), itemId: item.id, name: item.name, price: item.price, at: new Date().toISOString() }],
    }));
  },

  claimSpecial() {
    updateSettings((s) => (s.special ? { ...s, special: { ...s.special, claimedAt: new Date().toISOString() } } : s));
  },

  setSpecial(special: SpecialPrize | null) {
    updateSettings((s) => ({ ...s, special }));
  },

  upsertCatalogItem(item: CatalogItem) {
    updateSettings((s) => {
      const exists = s.catalog.some((c) => c.id === item.id);
      return { ...s, catalog: exists ? s.catalog.map((c) => (c.id === item.id ? item : c)) : [...s.catalog, item] };
    });
  },

  addCatalogItem(name: string, price: number) {
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    updateSettings((s) => ({ ...s, catalog: [...s.catalog, { id: newId('p'), name: clean, price: Math.max(0, Math.round(price)), active: true }] }));
  },

  removeCatalogItem(id: string) {
    updateSettings((s) => ({ ...s, catalog: s.catalog.filter((c) => c.id !== id) }));
  },

  setStartDate(startDate: ISODate) {
    updateSettings((s) => ({ ...s, startDate }));
  },

  restartCycle(startDate: ISODate) {
    update((st) => ({ ...st, settings: { ...st.settings, startDate, special: st.settings.special ? { ...st.settings.special, claimedAt: undefined } : null }, chests: {}, redemptions: [] }));
  },

  setNumber(key: 'weeklyGoal' | 'dayGoal' | 'coreWeight' | 'fundPerWeek', value: number) {
    updateSettings((s) => ({ ...s, [key]: value }));
  },

  setExam(exam: ExamPeriod | null) {
    updateSettings((s) => ({ ...s, exam }));
  },

  setTheme(theme: Settings['theme']) {
    updateSettings((s) => ({ ...s, theme }));
  },

  setAutoLock(minutes: number) {
    updateSettings((s) => ({ ...s, autoLockMinutes: minutes }));
  },

  updateHabit(kind: HabitKind, id: string, patch: { name?: string; min?: string }) {
    updateSettings((s) => {
      const key = kind === 'core' ? 'core' : 'extras';
      return {
        ...s,
        [key]: s[key].map((h) => {
          if (h.id !== id) return h;
          const next: Habit = { ...h };
          if (patch.name !== undefined) {
            next.name = patch.name.slice(0, 80);
            delete next.levels; // si cambias el nombre a mano, deja de cambiar solo por semana
          }
          if (patch.min !== undefined) next.min = patch.min.slice(0, 140);
          return next;
        }),
      };
    });
  },

  addExtra(name: string) {
    const clean = name.trim().slice(0, 80);
    if (!clean) return;
    updateSettings((s) => (s.extras.length >= MAX_EXTRAS ? s : { ...s, extras: [...s.extras, { id: newId('h'), name: clean }] }));
  },

  moveExtra(id: string, dir: -1 | 1) {
    updateSettings((s) => {
      const i = s.extras.findIndex((h) => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.extras.length) return s;
      const extras = [...s.extras];
      [extras[i], extras[j]] = [extras[j]!, extras[i]!];
      return { ...s, extras };
    });
  },

  /** Guarda un secundario para vacaciones: deja de contar, pero su historial se conserva. */
  toVacation(id: string) {
    updateSettings((s) => {
      const h = s.extras.find((x) => x.id === id);
      if (!h) return s;
      return { ...s, extras: s.extras.filter((x) => x.id !== id), vacation: [...s.vacation, h] };
    });
  },

  fromVacation(id: string) {
    updateSettings((s) => {
      const h = s.vacation.find((x) => x.id === id);
      if (!h || s.extras.length >= MAX_EXTRAS) return s;
      return { ...s, vacation: s.vacation.filter((x) => x.id !== id), extras: [...s.extras, h] };
    });
  },

  markBackup() {
    updateSettings((s) => ({ ...s, lastBackupAt: new Date().toISOString() }));
  },
};
