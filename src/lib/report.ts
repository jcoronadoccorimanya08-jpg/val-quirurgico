import { formatNumeric, formatRange, type ISODate } from './dates';
import {
  allSegmentProgress,
  coreCount,
  cycleStats,
  habitStats,
  isDone,
  lastDays,
  type SegmentStatus,
} from './engine';
import type { AppState, Settings } from './types';

export const STATUS_LABEL: Record<SegmentStatus, string> = {
  future: 'por venir',
  active: 'en curso',
  won: 'ganada',
  missed: 'no alcanzada',
};

/** Reporte en texto plano para pegarlo en Claude y recibir un análisis. */
export function buildReport(state: Pick<AppState, 'days' | 'rewards'> & { settings: Settings }, today: ISODate): string {
  const { settings: s, days, rewards } = state;
  const stats = cycleStats(s, days, today);
  const progress = allSegmentProgress(s, days, today);
  const current =
    progress.find((p) => today >= p.segment.start && today <= p.segment.end) ??
    (stats.phase === 'finished' ? progress[progress.length - 1] : progress[0]);

  const lines: string[] = [];
  lines.push(`REPORTE · Val quirúrgico · día ${stats.dayNumber}/${s.cycleLength} · ${today}`);

  if (current) {
    const seg = current.segment;
    const label = seg.isFinal ? 'Tramo final' : `Semana ${seg.index}`;
    lines.push(
      `${label} (${formatRange(seg.start, seg.end)}): ${current.completed}/${seg.length} días completos · meta ${seg.goal} · ${STATUS_LABEL[current.status]}`,
    );
    lines.push(`Premio de este tramo: ${rewards[String(seg.index)]?.text?.trim() || 'sin definir'}`);
  }

  lines.push(
    `Semanas ganadas: ${stats.segmentsWon}/${stats.segmentsTotal} · Cumplimiento del núcleo: ${stats.completionPct}% · Días completos: ${stats.completeDays}`,
  );

  lines.push('Núcleo:');
  for (const h of habitStats(s, days, today, 'core')) {
    lines.push(`- ${h.habit.name}: racha ${h.current} · mejor ${h.best} · ${h.done}/${h.counted} días (${h.pct}%)`);
  }

  const week = lastDays(today, 7, s);
  if (week.length) {
    const extras = s.extras.map((h) => `${h.name} ${week.filter((d) => isDone(days, d, 'extra', h.id)).length}/${week.length}`);
    if (extras.length) lines.push(`Secundarios (últimos ${week.length} días): ${extras.join(', ')}`);
    lines.push(
      `Últimos ${week.length} días (núcleo): ${week.map((d) => `${formatNumeric(d)} ${coreCount(days, d, s.core)}/${s.core.length}`).join(', ')}`,
    );
  }

  return lines.join('\n');
}
