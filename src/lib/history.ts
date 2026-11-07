/** Historial de ciclos: al empezar un ciclo nuevo se guarda un resumen del que termina. Funciones puras. */
import { badgeBlocks, earnedTiers } from './badges';
import { countedDays, cycleEnd, cycleStats, lastPlayableDay, allSegmentProgress } from './engine';
import { minDate, type ISODate } from './dates';
import { fund } from './rewards';
import type { AppState, CycleSummary } from './types';

/** Resumen del ciclo actual hasta hoy (o null si todavía no empezó). */
export function summarizeCycle(state: AppState, today: ISODate): CycleSummary | null {
  const s = state.settings;
  if (today < s.startDate) return null;
  const stats = cycleStats(s, state.days, today);
  const progress = allSegmentProgress(s, state.days, today);
  const f = fund(s, state, progress);
  return {
    start: s.startDate,
    end: minDate(lastPlayableDay(s, today), cycleEnd(s)),
    days: countedDays(s, state.days, today).length,
    daysWon: stats.wonDays,
    avgPct: stats.avgPct,
    weeksWon: stats.segmentsWon,
    weeksTotal: stats.segmentsTotal,
    badges: earnedTiers(badgeBlocks(s, state.days, today)).length,
    fundEarned: f.earned + f.bonus,
    redeemed: state.redemptions.length,
    archivedAt: new Date().toISOString(),
  };
}
