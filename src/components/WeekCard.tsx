import { formatRange, rangeDates, weekdayInitial, type ISODate } from '../lib/dates';
import { buildSegments, dayState, segmentFor, segmentProgress } from '../lib/engine';
import type { AppState, Settings } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  s: Settings;
  state: AppState;
  date: ISODate;
  today: ISODate;
  onPickDay: (d: ISODate) => void;
  onGoRewards: () => void;
  onClaim: (index: number) => void;
}

export function WeekCard({ s, state, date, today, onPickDay, onGoRewards, onClaim }: Props) {
  const seg = segmentFor(buildSegments(s), date);
  if (!seg) return null;
  const prog = segmentProgress(seg, state.days, s.core, today);
  const reward = state.rewards[String(seg.index)];
  const rewardText = reward?.text?.trim();
  const dates = rangeDates(seg.start, seg.end);
  const missing = Math.max(0, seg.goal - prog.completed);

  let status: string;
  if (prog.status === 'won') status = seg.isFinal ? 'Tramo final ganado.' : 'Semana ganada.';
  else if (prog.status === 'missed') status = 'Esta semana no llegó a la meta. La siguiente cuenta igual.';
  else status = `Te ${missing === 1 ? 'falta 1 día completo' : `faltan ${missing} días completos`} para el premio.`;

  return (
    <section
      className={`card week ${prog.status === 'won' ? 'won' : ''} ${seg.isFinal ? 'final' : ''}`}
      aria-label={seg.isFinal ? 'Tramo final' : `Semana ${seg.index}`}
    >
      <div className="week-head">
        <div>
          <div className="week-title">{seg.isFinal ? 'Tramo final · gran premio' : `Semana ${seg.index} de 12`}</div>
          <div className="week-dates">{formatRange(seg.start, seg.end)} · meta {seg.goal} de {seg.length}</div>
        </div>
        <div className="week-count">
          <b>
            {prog.completed}/{seg.goal}
          </b>
          <span>días completos</span>
        </div>
      </div>

      <div className="dots" style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
        {dates.map((d) => {
          const st = dayState(s, state.days, s.core, d, today);
          const cls = [st, d === date ? 'selected' : '', d === today ? 'today' : ''].join(' ');
          const disabled = d > today;
          return (
            <button
              key={d}
              type="button"
              className={`dot ${cls}`}
              disabled={disabled}
              onClick={() => onPickDay(d)}
              aria-label={`${d}: ${st === 'complete' ? 'completo' : st === 'partial' ? 'incompleto' : st === 'future' ? 'por venir' : 'sin marcar'}`}
            >
              <span>{weekdayInitial(d)}</span>
              <i>{st === 'complete' && <Icon name="check" size={16} />}</i>
            </button>
          );
        })}
      </div>

      <p className={`week-status ${prog.status === 'won' ? 'won' : ''}`}>{status}</p>

      <div className="reward-line">
        <Icon name={seg.isFinal ? 'trophy' : 'gift'} size={20} />
        <div className="txt">
          {reward?.claimedAt ? (
            <>
              <b>Premio reclamado</b>
              {rewardText ? `: ${rewardText}` : ''}
            </>
          ) : rewardText ? (
            <>
              Premio: <b>{rewardText}</b>
            </>
          ) : (
            <span className="muted">Todavía no definiste el premio.</span>
          )}
        </div>
        {prog.status === 'won' && !reward?.claimedAt && rewardText ? (
          <button type="button" className="btn gold sm" onClick={() => onClaim(seg.index)}>
            Reclamar
          </button>
        ) : !rewardText ? (
          <button type="button" className="link-btn" onClick={onGoRewards}>
            Definir
          </button>
        ) : null}
      </div>
    </section>
  );
}
