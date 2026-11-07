import { formatRange, rangeDates, weekdayInitial, type ISODate } from '../lib/dates';
import { buildSegments, dayPct, dayState, segmentFor, segmentProgress } from '../lib/engine';
import type { AppState, Settings } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  s: Settings;
  state: AppState;
  date: ISODate;
  today: ISODate;
  onPickDay: (d: ISODate) => void;
}

export function WeekCard({ s, state, date, today, onPickDay }: Props) {
  const seg = segmentFor(buildSegments(s), date);
  if (!seg) return null;
  const prog = segmentProgress(seg, s, state.days, today);
  const dates = rangeDates(seg.start, seg.end);
  const missing = Math.max(0, seg.goal - prog.completed);

  let status: string;
  if (prog.status === 'won') status = `Semana ganada: +${s.fundPerWeek} Bs al fondo.`;
  else if (prog.status === 'missed') status = 'Esta semana no llegó a la meta. La siguiente cuenta igual.';
  else status = `Te ${missing === 1 ? 'falta 1 día ganado' : `faltan ${missing} días ganados`} para sumar ${s.fundPerWeek} Bs.`;

  return (
    <section className={`card week ${prog.status === 'won' ? 'won' : ''} ${seg.isFinal ? 'final' : ''}`} aria-label={seg.isFinal ? 'Tramo final' : `Semana ${seg.index}`}>
      <div className="week-head">
        <div>
          <div className="week-title">{seg.isFinal ? 'Tramo final' : `Semana ${seg.index} de 12`}</div>
          <div className="week-dates">
            {formatRange(seg.start, seg.end)} · meta {seg.goal} de {seg.length}
          </div>
        </div>
        <div className="week-count">
          <b>
            {prog.completed}/{seg.goal}
          </b>
          <span>días ganados</span>
        </div>
      </div>
      <div className="dots" style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
        {dates.map((d) => {
          const st = dayState(s, state.days, d, today);
          const pct = Math.round(dayPct(s, state.days, d));
          return (
            <button
              key={d}
              type="button"
              className={`dot ${st} ${d === date ? 'selected' : ''} ${d === today ? 'today' : ''}`}
              disabled={d > today}
              onClick={() => onPickDay(d)}
              aria-label={`${d}: ${st === 'won' ? 'ganado' : st === 'future' ? 'por venir' : `${pct}%`}`}
            >
              <span>{weekdayInitial(d)}</span>
              <i>{st === 'won' ? <Icon name="check" size={16} /> : st === 'partial' ? <small>{pct}</small> : null}</i>
            </button>
          );
        })}
      </div>
      <p className={`week-status ${prog.status === 'won' ? 'won' : ''}`}>{status}</p>
    </section>
  );
}
