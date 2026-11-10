/**
 * Cambios de una sola vez sobre tus datos, sin perder nada. Cada uno queda anotado en `settings.applied`
 * para no repetirse (si después lo cambias a mano, no vuelve). Funciones puras, con pruebas en tests/migrations.test.ts.
 */
import { READING_CORE } from './config';
import { addDays, type ISODate } from './dates';
import { cyclePhase, isWon } from './engine';
import type { AppState } from './types';

/**
 * Lectura 30 min entra al núcleo (día malo: 15 min), con el mismo peso que los otros. Cuenta desde hoy; si hoy ya
 * ganaste el día, desde mañana, para no quitártelo. Los días anteriores no cambian. En el modo viaje también cuenta.
 */
export function addReadingToCore(state: AppState, today: ISODate): AppState {
  const s = state.settings;
  const id = READING_CORE.id;
  if ((s.applied ?? []).includes(id)) return state;
  const applied = [...(s.applied ?? []), id];
  if (s.core.some((h) => h.id === id)) return { ...state, settings: { ...s, applied } };
  const phase = cyclePhase(s, today);
  const since = phase === 'before' ? undefined : phase === 'active' && !isWon(s, state.days, today) ? today : addDays(today, 1);
  const habit = since && since > s.startDate ? { ...READING_CORE, since } : { ...READING_CORE };
  const trip = s.trip && !s.trip.habits.includes(id) ? { ...s.trip, habits: [...s.trip.habits, id] } : s.trip;
  return { ...state, settings: { ...s, core: [...s.core, habit], trip, applied } };
}

/** Todo lo de una sola vez, en orden. Devuelve el mismo objeto si no cambió nada. */
export function applyMigrations(state: AppState, today: ISODate): AppState {
  return addReadingToCore(state, today);
}
