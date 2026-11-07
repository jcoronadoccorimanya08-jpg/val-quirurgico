import { describe, expect, it } from 'vitest';
import { DEFAULT_CORE, DEFAULT_EXTRAS } from '../src/lib/config';
import { rangeDates } from '../src/lib/dates';
import { allSegmentProgress, type Days } from '../src/lib/engine';
import { chestFromRoll, fund, nextCatalogGoal, pendingChests, specialStatus, wildcards } from '../src/lib/rewards';
import { initialState } from '../src/lib/store';

const START = '2026-11-08';
const CORE = DEFAULT_CORE.map((h) => h.id);
const ONE_EXTRA = [DEFAULT_EXTRAS[0]!.id];

function winDays(days: Days, from: string, to: string): Days {
  for (const d of rangeDates(from, to)) days[d] = { core: Object.fromEntries(CORE.map((id) => [id, true])), extra: Object.fromEntries(ONE_EXTRA.map((id) => [id, true])) };
  return days;
}

describe('fondo de premios', () => {
  it('cada semana ganada suma 100 Bs; los cofres suman bonos y los canjes restan', () => {
    const st = initialState(START, null);
    winDays(st.days, '2026-11-08', '2026-11-21'); // semanas 1 y 2
    const progress = allSegmentProgress(st.settings, st.days, '2026-11-22');
    st.chests['1'] = { outcome: 'bs50', openedAt: '' };
    st.redemptions.push({ id: 'r1', itemId: 'perfume', name: 'Perfume', price: 150, at: '' });
    expect(fund(st.settings, st, progress)).toEqual({ earned: 200, bonus: 50, spent: 150, balance: 100, weeksWon: 2 });
    expect(pendingChests(progress, st)).toEqual([2]);
  });

  it('el próximo premio es el más barato que todavía no alcanzas', () => {
    const st = initialState(START, null);
    expect(nextCatalogGoal(st.settings, 0, new Set())?.name).toBe('Perfume');
    expect(nextCatalogGoal(st.settings, 200, new Set(['perfume']))?.name).toBe('Carne en un buen lugar');
  });
});

describe('cofres y comodines', () => {
  it('el azar se reparte entre los 4 premios del cofre', () => {
    expect(chestFromRoll(0.1)).toBe('bs20');
    expect(chestFromRoll(0.4)).toBe('bs50');
    expect(chestFromRoll(0.7)).toBe('wildcard');
    expect(chestFromRoll(0.95)).toBe('movie');
  });

  it('un comodín cada 2 semanas ganadas, más los de cofres, menos los usados', () => {
    const st = initialState(START, null);
    winDays(st.days, '2026-11-08', '2026-11-21');
    st.chests['1'] = { outcome: 'wildcard', openedAt: '' };
    st.days['2026-11-22'] = { core: {}, extra: {}, wildcard: true };
    const progress = allSegmentProgress(st.settings, st.days, '2026-11-23');
    expect(wildcards(st, progress)).toEqual({ earned: 2, used: 1, available: 1 });
  });
});

describe('premio especial', () => {
  it('se desbloquea desde su fecha si ganaste las semanas pedidas', () => {
    const st = initialState(START, null);
    expect(st.settings.special).toMatchObject({ unlockDate: '2026-11-29', requiredWeeks: 2 });
    winDays(st.days, '2026-11-08', '2026-11-21');
    const early = allSegmentProgress(st.settings, st.days, '2026-11-22');
    expect(specialStatus(st.settings, early, '2026-11-22')).toMatchObject({ kind: 'locked', reason: 'date' });
    const later = allSegmentProgress(st.settings, st.days, '2026-11-29');
    expect(specialStatus(st.settings, later, '2026-11-29')).toEqual({ kind: 'available' });
  });

  it('si no tienes las semanas, sigue bloqueado aunque pase la fecha', () => {
    const st = initialState(START, null);
    const progress = allSegmentProgress(st.settings, st.days, '2026-11-30');
    expect(specialStatus(st.settings, progress, '2026-11-30')).toMatchObject({ kind: 'locked', reason: 'weeks', weeksWon: 0, required: 2 });
  });
});
