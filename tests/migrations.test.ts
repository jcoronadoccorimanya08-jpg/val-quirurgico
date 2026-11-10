import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE, DEFAULT_EXTRAS, READING_CORE } from '../src/lib/config';
import { countedHabits, dayPct, isWon, weights, wonStreak } from '../src/lib/engine';
import { addReadingToCore, applyMigrations } from '../src/lib/migrations';
import { sanitizeState } from '../src/lib/sanitize';
import { initialState } from '../src/lib/store';
import type { AppState } from '../src/lib/types';

const START = '2026-11-09';

/** Como estaban tus datos antes: núcleo de 4. */
function oldState(): AppState {
  const st = initialState(START, null);
  st.settings.core = st.settings.core.filter((h) => h.id !== READING_CORE.id);
  return st;
}

const CORE4 = Object.fromEntries(DEFAULT_CORE.filter((h) => h.id !== READING_CORE.id).map((h) => [h.id, true]));
const EXTRA = { [DEFAULT_EXTRAS[0]!.id]: true };

describe('lectura 30 min entra al núcleo', () => {
  it('cuenta desde hoy, con el mismo peso; tus días pasados no cambian', () => {
    const st = oldState();
    st.days['2026-11-09'] = { core: CORE4, extra: EXTRA };
    const before = Math.round(dayPct(st.settings, st.days, '2026-11-09'));
    const next = addReadingToCore(st, '2026-11-10');
    const reading = next.settings.core.find((h) => h.id === READING_CORE.id)!;
    expect(next.settings.core).toHaveLength(5);
    expect(reading).toMatchObject({ name: 'Lectura 30 min', min: 'Día malo: 15 minutos.', since: '2026-11-10' });
    expect(next.settings.applied).toEqual([READING_CORE.id]);
    // Ayer: igual que antes (4 del núcleo, 15 % c/u). Hoy: 5 del núcleo, 12 % c/u.
    expect(Math.round(dayPct(next.settings, next.days, '2026-11-09'))).toBe(before);
    expect(isWon(next.settings, next.days, '2026-11-09')).toBe(true);
    expect(weights(next.settings, '2026-11-09').core).toBe(15);
    expect(weights(next.settings, '2026-11-10').core).toBe(12);
    expect(countedHabits(next.settings, '2026-11-10').core.map((h) => h.id)).toContain(READING_CORE.id);
    expect(wonStreak(next.settings, next.days, '2026-11-10')).toBe(1);
  });

  it('si hoy ya ganaste el día, empieza mañana para no quitártelo', () => {
    const st = oldState();
    st.days['2026-11-10'] = { core: CORE4, extra: EXTRA };
    expect(isWon(st.settings, st.days, '2026-11-10')).toBe(true);
    const next = addReadingToCore(st, '2026-11-10');
    expect(next.settings.core.at(-1)!.since).toBe('2026-11-11');
    expect(isWon(next.settings, next.days, '2026-11-10')).toBe(true);
  });

  it('en el viaje también cuenta', () => {
    const st = oldState();
    st.settings.trip = { from: '2026-12-22', to: '2027-02-15', habits: ['sueno', 'rutina', 'gym'], dayGoal: 60 };
    const next = addReadingToCore(st, '2026-11-10');
    expect(next.settings.trip!.habits).toEqual(['sueno', 'rutina', 'gym', READING_CORE.id]);
    expect(countedHabits(next.settings, '2026-12-25').core.map((h) => h.id)).toEqual(['sueno', 'rutina', 'gym', READING_CORE.id]);
  });

  it('una sola vez: no se repite ni vuelve si después la quitas', () => {
    const st = oldState();
    const once = applyMigrations(st, '2026-11-10');
    expect(applyMigrations(once, '2026-11-12')).toBe(once);
    const removed = { ...once, settings: { ...once.settings, core: once.settings.core.filter((h) => h.id !== READING_CORE.id) } };
    expect(applyMigrations(removed, '2026-11-12')).toBe(removed);
    // Un ciclo nuevo ya la trae: solo se anota como aplicada.
    const fresh = initialState(START, null);
    expect(applyMigrations(fresh, '2026-11-10').settings.core).toHaveLength(5);
    expect(applyMigrations(fresh, '2026-11-10').settings.applied).toEqual([READING_CORE.id]);
  });

  it('antes del ciclo cuenta desde el primer día', () => {
    const next = addReadingToCore(oldState(), '2026-11-08');
    expect(next.settings.core.at(-1)!.since).toBeUndefined();
  });

  it('el respaldo guarda la fecha de inicio y lo ya aplicado', () => {
    const next = addReadingToCore(oldState(), '2026-11-10');
    const back = sanitizeState(JSON.parse(JSON.stringify(next)))!;
    expect(back.settings.core.at(-1)!.since).toBe('2026-11-10');
    expect(back.settings.applied).toEqual([READING_CORE.id]);
  });
});
