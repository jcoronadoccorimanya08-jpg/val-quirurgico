/**
 * Focus Flow → «Bloque profundo». Focus Flow publica en este teléfono SOLO números (`focusflow.dias`: minutos
 * de cada día y si cumplió su meta). Si un día estudiaste un bloque de 25 minutos o más, tu «Bloque profundo»
 * de ese día se marca solo (la versión mínima ya cuenta). Nunca se desmarca nada, y si lo quitas a mano, no
 * vuelve a marcarse (`focusApplied`).
 */
import { addDays, isValidISODate, type ISODate } from './dates';
import { habitActive } from './engine';
import type { AppState } from './types';

export const FOCUS_KEY = 'focusflow.dias';
export const FOCUS_HABIT = 'estudio';
/** Un bloque de 25 minutos (la versión mínima del hábito). */
export const FOCUS_MIN = 25;

export type FocusDays = Record<ISODate, { m: number; meta: boolean }>;

export function parseFocusDays(text: string | null): FocusDays {
  try {
    const o = JSON.parse(text ?? 'null') as { v?: number; days?: Record<string, { m?: unknown; meta?: unknown }> } | null;
    if (!o || o.v !== 1 || typeof o.days !== 'object' || !o.days) return {};
    const out: FocusDays = {};
    for (const [d, x] of Object.entries(o.days)) {
      if (!isValidISODate(d) || typeof x?.m !== 'number' || !Number.isFinite(x.m)) continue;
      out[d] = { m: Math.max(0, Math.round(x.m)), meta: x.meta === true };
    }
    return out;
  } catch {
    return {};
  }
}

export function readFocusDays(): FocusDays {
  try {
    return parseFocusDays(localStorage.getItem(FOCUS_KEY));
  } catch {
    return {};
  }
}

/** Días de la última semana que se pueden marcar solos. */
export function focusDatesToMark(state: AppState, days: FocusDays, today: ISODate): ISODate[] {
  const s = state.settings;
  const habit = s.core.find((h) => h.id === FOCUS_HABIT);
  if (!habit) return [];
  const applied = new Set(s.focusApplied ?? []);
  const out: ISODate[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    if (d < s.startDate || !habitActive(habit, d) || applied.has(d)) continue;
    if ((days[d]?.m ?? 0) < FOCUS_MIN) continue;
    if (state.days[d]?.core?.[FOCUS_HABIT]) continue;
    out.push(d);
  }
  return out;
}
