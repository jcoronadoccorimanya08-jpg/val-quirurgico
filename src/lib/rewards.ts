/**
 * Premios: fondo en Bs por semana ganada, cofres sorpresa, comodines y premio especial.
 * Funciones puras (salvo la elección al azar del cofre, que recibe el azar como parámetro).
 */
import type { ISODate } from './dates';
import type { SegmentProgress } from './engine';
import type { AppState, ChestOutcome, Settings } from './types';

export function wonSegments(progress: SegmentProgress[]): SegmentProgress[] {
  return progress.filter((p) => p.status === 'won');
}

export const CHEST_BONUS: Record<ChestOutcome, number> = { bs20: 20, bs50: 50, wildcard: 0, movie: 0 };

export interface Fund {
  earned: number;
  bonus: number;
  spent: number;
  balance: number;
  weeksWon: number;
}

export function fund(s: Settings, state: Pick<AppState, 'chests' | 'redemptions'>, progress: SegmentProgress[]): Fund {
  const weeksWon = wonSegments(progress).length;
  const earned = weeksWon * s.fundPerWeek;
  const bonus = Object.values(state.chests).reduce((sum, c) => sum + CHEST_BONUS[c.outcome], 0);
  const spent = state.redemptions.reduce((sum, r) => sum + r.price, 0);
  return { earned, bonus, spent, balance: earned + bonus - spent, weeksWon };
}

/** Semanas ganadas cuyo cofre todavía no se abrió. */
export function pendingChests(progress: SegmentProgress[], state: Pick<AppState, 'chests'>): number[] {
  return wonSegments(progress)
    .map((p) => p.segment.index)
    .filter((i) => !state.chests[String(i)]);
}

/** Elige el contenido de un cofre. `roll` es un número entre 0 y 1. */
export function chestFromRoll(roll: number): ChestOutcome {
  if (roll < 0.35) return 'bs20';
  if (roll < 0.55) return 'bs50';
  if (roll < 0.8) return 'wildcard';
  return 'movie';
}

export interface Wildcards {
  earned: number;
  used: number;
  available: number;
}

/** Un comodín cada 2 semanas ganadas, más los que salgan en cofres. */
export function wildcards(state: Pick<AppState, 'chests' | 'days'>, progress: SegmentProgress[]): Wildcards {
  const fromWeeks = Math.floor(wonSegments(progress).length / 2);
  const fromChests = Object.values(state.chests).filter((c) => c.outcome === 'wildcard').length;
  const used = Object.values(state.days).filter((d) => d.wildcard).length;
  const earned = fromWeeks + fromChests;
  return { earned, used, available: Math.max(0, earned - used) };
}

export type SpecialStatus =
  | { kind: 'none' }
  | { kind: 'claimed'; claimedAt: string }
  | { kind: 'available' }
  | { kind: 'locked'; weeksWon: number; required: number; unlockDate: ISODate; reason: 'date' | 'weeks' | 'both' };

export function specialStatus(s: Settings, progress: SegmentProgress[], today: ISODate): SpecialStatus {
  const sp = s.special;
  if (!sp) return { kind: 'none' };
  if (sp.claimedAt) return { kind: 'claimed', claimedAt: sp.claimedAt };
  const weeksWon = wonSegments(progress).length;
  const dateOk = today >= sp.unlockDate;
  const weeksOk = weeksWon >= sp.requiredWeeks;
  if (dateOk && weeksOk) return { kind: 'available' };
  return { kind: 'locked', weeksWon, required: sp.requiredWeeks, unlockDate: sp.unlockDate, reason: !dateOk && !weeksOk ? 'both' : !dateOk ? 'date' : 'weeks' };
}

/** Próximo premio del catálogo que todavía no alcanza el fondo (el más barato de los activos). */
export function nextCatalogGoal(s: Settings, balance: number, redeemedIds: Set<string>) {
  const active = s.catalog.filter((c) => c.active && !redeemedIds.has(c.id)).sort((a, b) => a.price - b.price);
  return active.find((c) => c.price > balance) ?? active[0] ?? null;
}
