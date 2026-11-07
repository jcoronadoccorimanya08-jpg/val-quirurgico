/**
 * Insignias cada 2 semanas: Bronce, Plata, Oro, Platino, Diamante y Leyenda.
 * Cada bloque de 2 semanas se gana con 12 días ganados (6 por semana). Cada bloque ganado sube un nivel;
 * un bloque perdido no te quita nada. Funciones puras, con pruebas en tests/badges.test.ts.
 */
import { diffDays, minDate, rangeDates, type ISODate } from './dates';
import { buildSegments, isWon, type Days } from './engine';
import type { Settings } from './types';

export const TIERS = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Leyenda'] as const;
export type Tier = (typeof TIERS)[number];

export type BlockStatus = 'earned' | 'open' | 'missed' | 'future';

export interface BadgeBlock {
  index: number;
  /** Semanas del ciclo que abarca (por ejemplo, 3 y 4). */
  weeks: [number, number];
  start: ISODate;
  end: ISODate;
  status: BlockStatus;
  won: number;
  need: number;
}

export function badgeBlocks(s: Settings, days: Days, today: ISODate): BadgeBlock[] {
  const segs = buildSegments(s).filter((seg) => seg.length === 7);
  const need = s.weeklyGoal * 2;
  const out: BadgeBlock[] = [];
  for (let i = 0; i + 1 < segs.length && out.length < TIERS.length; i += 2) {
    const a = segs[i]!;
    const b = segs[i + 1]!;
    const base = { index: out.length + 1, weeks: [a.index, b.index] as [number, number], start: a.start, end: b.end, need };
    if (today < a.start) {
      out.push({ ...base, status: 'future', won: 0 });
      continue;
    }
    const won = rangeDates(a.start, minDate(today, b.end)).filter((d) => isWon(s, days, d)).length;
    // Lo que todavía se puede ganar: hoy (si no está ganado) y los días que faltan.
    const left = today <= b.end ? (isWon(s, days, today) ? 0 : 1) + diffDays(today, b.end) : 0;
    out.push({ ...base, status: won >= need ? 'earned' : won + left >= need ? 'open' : 'missed', won });
  }
  return out;
}

/** Insignias ganadas, en orden: la primera es Bronce, la segunda Plata… */
export function earnedTiers(blocks: BadgeBlock[]): Tier[] {
  return blocks.filter((b) => b.status === 'earned').map((_, i) => TIERS[i]!);
}
