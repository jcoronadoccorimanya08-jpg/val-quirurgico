/**
 * Estado global de la app. Cada cambio se guarda de inmediato en el teléfono.
 */
import { useSyncExternalStore } from 'react';
import { CYCLE_LENGTH, DEFAULT_CORE, DEFAULT_EXTRAS, DEFAULT_WEEKLY_GOAL, MAX_EXTRAS } from './config';
import type { ISODate } from './dates';
import { clearState, emptyState, loadState, requestPersistence, saveState } from './storage';
import type { AppState, HabitKind, Settings } from './types';

type Listener = () => void;

let state: AppState = emptyState();
let ready = false;
const listeners = new Set<Listener>();
const errorListeners = new Set<(message: string) => void>();

function emit() {
  for (const l of listeners) l();
}

function commit(next: AppState) {
  state = next;
  emit();
  saveState(next).catch(() => {
    for (const l of errorListeners) l('No se pudo guardar. Revisa el espacio de tu teléfono.');
  });
}

export function onSaveError(cb: (message: string) => void): () => void {
  errorListeners.add(cb);
  return () => errorListeners.delete(cb);
}

export async function initStore(): Promise<void> {
  state = await loadState();
  ready = true;
  emit();
}

export function getState(): AppState {
  return state;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useStoreReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}

function withSettings(fn: (s: Settings) => Settings) {
  if (!state.settings) return;
  commit({ ...state, settings: fn(state.settings) });
}

function newId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export const actions = {
  startCycle(startDate: ISODate) {
    const settings: Settings = {
      startDate,
      cycleLength: CYCLE_LENGTH,
      weeklyGoal: DEFAULT_WEEKLY_GOAL,
      core: DEFAULT_CORE.map((h) => ({ ...h })),
      extras: DEFAULT_EXTRAS.map((h) => ({ ...h })),
      theme: state.settings?.theme ?? 'system',
      createdAt: new Date().toISOString(),
    };
    commit({ ...state, settings });
    void requestPersistence();
  },

  /** Ciclo nuevo conservando hábitos y preferencias. Los premios se reinician. */
  restartCycle(startDate: ISODate) {
    if (!state.settings) return;
    commit({ ...state, settings: { ...state.settings, startDate }, rewards: {} });
  },

  toggle(date: ISODate, kind: HabitKind, id: string) {
    const prev = state.days[date] ?? { core: {}, extra: {} };
    const group = kind === 'core' ? 'core' : 'extra';
    const flags = { ...prev[group] };
    if (flags[id]) delete flags[id];
    else flags[id] = true;
    const day = { ...prev, [group]: flags, updatedAt: new Date().toISOString() };
    commit({ ...state, days: { ...state.days, [date]: day } });
  },

  setRewardText(index: number, text: string) {
    const key = String(index);
    const prev = state.rewards[key] ?? { text: '' };
    commit({ ...state, rewards: { ...state.rewards, [key]: { ...prev, text: text.slice(0, 80) } } });
  },

  claimReward(index: number) {
    const key = String(index);
    const prev = state.rewards[key] ?? { text: '' };
    commit({ ...state, rewards: { ...state.rewards, [key]: { ...prev, claimedAt: new Date().toISOString() } } });
  },

  setStartDate(startDate: ISODate) {
    withSettings((s) => ({ ...s, startDate }));
  },

  setWeeklyGoal(goal: number) {
    withSettings((s) => ({ ...s, weeklyGoal: Math.max(1, Math.min(7, Math.round(goal))) }));
  },

  setTheme(theme: Settings['theme']) {
    withSettings((s) => ({ ...s, theme }));
  },

  updateHabit(kind: HabitKind, id: string, patch: { name?: string; min?: string }) {
    withSettings((s) => {
      const key = kind === 'core' ? 'core' : 'extras';
      const list = s[key].map((h) => {
        if (h.id !== id) return h;
        const next = { ...h };
        if (patch.name !== undefined) next.name = patch.name.slice(0, 80);
        if (patch.min !== undefined) next.min = patch.min.slice(0, 140);
        return next;
      });
      return { ...s, [key]: list };
    });
  },

  addExtra(name: string) {
    const clean = name.trim().slice(0, 80);
    if (!clean) return;
    withSettings((s) => (s.extras.length >= MAX_EXTRAS ? s : { ...s, extras: [...s.extras, { id: newId('h'), name: clean }] }));
  },

  removeExtra(id: string) {
    withSettings((s) => ({ ...s, extras: s.extras.filter((h) => h.id !== id) }));
  },

  moveExtra(id: string, dir: -1 | 1) {
    withSettings((s) => {
      const i = s.extras.findIndex((h) => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.extras.length) return s;
      const extras = [...s.extras];
      [extras[i], extras[j]] = [extras[j]!, extras[i]!];
      return { ...s, extras };
    });
  },

  markBackup() {
    withSettings((s) => ({ ...s, lastBackupAt: new Date().toISOString() }));
  },

  replaceAll(next: AppState) {
    commit(next);
    void requestPersistence();
  },

  async resetAll() {
    await clearState();
    state = emptyState();
    emit();
  },
};
