import { formatNumeric, formatRange, type ISODate } from './dates';
import {
  allSegmentProgress,
  cycleStats,
  dayPct,
  habitLabel,
  habitStats,
  isDone,
  isExamDay,
  isWon,
  lastDays,
  moodStats,
  segmentPct,
  wonStreak,
  type SegmentStatus,
} from './engine';
import { badgeBlocks, earnedTiers } from './badges';
import { fund } from './rewards';
import type { AppState } from './types';

export const STATUS_LABEL: Record<SegmentStatus, string> = {
  future: 'por venir',
  active: 'en curso',
  won: 'ganada',
  missed: 'no alcanzada',
};

/** Reporte en texto ordenado, para pegarlo en Claude y recibir un análisis. */
export function buildReport(state: AppState, today: ISODate): string {
  const s = state.settings;
  const stats = cycleStats(s, state.days, today);
  const progress = allSegmentProgress(s, state.days, today);
  const current = progress.find((p) => today >= p.segment.start && today <= p.segment.end) ?? progress[progress.length - 1];
  const f = fund(s, state, progress);
  const week = lastDays(today, 7, s);
  const L: string[] = [];

  L.push(`VAL Q · REPORTE · día ${stats.dayNumber} de ${s.cycleLength} (${today})`);
  if (isExamDay(s, today)) L.push(`Modo examen hasta el ${s.exam!.to}: solo cuenta el núcleo.`);
  L.push('');
  if (current) {
    const seg = current.segment;
    L.push(`SEMANA ${seg.index} (${formatRange(seg.start, seg.end)})`);
    L.push(`• Días ganados: ${current.completed} de ${seg.length} (meta ${seg.goal}) · ${STATUS_LABEL[current.status]}`);
    L.push(`• Promedio de la semana: ${Math.round(segmentPct(seg, s, state.days, today))}%`);
  }
  L.push('');
  L.push('CICLO');
  L.push(`• Días ganados: ${stats.wonDays} · promedio diario ${stats.avgPct}% · racha actual ${wonStreak(s, state.days, today)} días`);
  L.push(`• Semanas ganadas: ${stats.segmentsWon} de ${stats.segmentsTotal} · fondo de premios: Bs ${f.balance}`);
  const tiers = earnedTiers(badgeBlocks(s, state.days, today));
  L.push(`• Insignias: ${tiers.length ? tiers.join(', ') : 'todavía ninguna'}`);
  const moods = moodStats(s, state.days, week);
  if (moods.length) L.push(`• Ánimo (7 días): ${moods.map((m) => `${m.mood}/5 → ${Math.round(m.avgPct)}% (${m.days} d)`).join(' · ')}`);
  L.push('');
  L.push('NÚCLEO');
  for (const h of habitStats(s, state.days, today, 'core')) L.push(`• ${h.habit.name}: ${h.pct}% · racha ${h.current} · mejor ${h.best}`);
  if (week.length) {
    L.push('');
    L.push(`SECUNDARIOS (últimos ${week.length} días)`);
    for (const h of s.extras) L.push(`• ${habitLabel(h, s.startDate, today)}: ${week.filter((d) => isDone(state.days, d, 'extra', h.id)).length}/${week.length}`);
    L.push('');
    L.push('DÍA A DÍA');
    L.push(week.map((d) => `${formatNumeric(d)} ${Math.round(dayPct(s, state.days, d))}%${isWon(s, state.days, d) ? ' ✓' : ''}`).join(' · '));
  }
  return L.join('\n');
}
