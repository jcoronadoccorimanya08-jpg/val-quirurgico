import { Icon } from '../components/Icon';
import { ScreenHeader, SectionTitle } from '../components/ui';
import { formatLong, formatRange, plural, rangeDates, type ISODate } from '../lib/dates';
import { allSegmentProgress, coreCount, cycleStats, habitStats } from '../lib/engine';
import type { AppState, Settings } from '../lib/types';

interface Props {
  state: AppState;
  today: ISODate;
  onOpenDay: (d: ISODate) => void;
}

export function ProgressScreen({ state, today, onOpenDay }: Props) {
  const s = state.settings as Settings;
  const stats = cycleStats(s, state.days, today);
  const progress = allSegmentProgress(s, state.days, today);
  const core = habitStats(s, state.days, today, 'core');
  const extras = habitStats(s, state.days, today, 'extra');
  const maxLen = 7;

  return (
    <>
      <ScreenHeader eyebrow="Avance" title="Tu ciclo" subtitle={`${formatRange(s.startDate, progress[progress.length - 1]?.segment.end ?? s.startDate)}`} />

      <div className="tiles">
        <div className="tile">
          <b className="num">{stats.completeDays}</b>
          <span>días completos 3/3</span>
        </div>
        <div className="tile">
          <b className="num">
            {stats.completionPct}
            <small>%</small>
          </b>
          <span>cumplimiento del núcleo</span>
        </div>
        <div className="tile">
          <b className="num">
            {stats.segmentsWon}
            <small>/{stats.segmentsTotal}</small>
          </b>
          <span>semanas ganadas</span>
        </div>
        <div className="tile">
          <b className="num">{stats.daysLeft}</b>
          <span>{stats.phase === 'before' ? 'días de ciclo' : 'días por delante'}</span>
        </div>
      </div>

      <SectionTitle aside="toca un día para editarlo">Mapa del ciclo</SectionTitle>
      <section className="card">
        <div className="heat" role="grid" aria-label="Días del ciclo por semana">
          {progress.map((p) => {
            const dates = rangeDates(p.segment.start, p.segment.end);
            const pad = maxLen - dates.length;
            return (
              <div key={p.segment.index} role="row" style={{ display: 'contents' }}>
                <span className="wk" role="rowheader">
                  {p.segment.isFinal ? 'Fin' : `S${p.segment.index}`}
                </span>
                {dates.map((d) => {
                  const future = d > today;
                  const n = coreCount(state.days, d, s.core);
                  const cls = future ? 'future' : `s${Math.min(3, n)}`;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="gridcell"
                      className={`cell ${cls} ${d === today ? 'today' : ''}`}
                      disabled={future}
                      aria-label={`${formatLong(d)}: ${future ? 'por venir' : `${n} de ${s.core.length}`}`}
                      onClick={() => onOpenDay(d)}
                    />
                  );
                })}
                {Array.from({ length: pad }, (_, i) => (
                  <span key={`pad-${i}`} className="cell void" aria-hidden="true" />
                ))}
                <span className={`tail ${p.segment.isFinal ? 'final' : ''}`} aria-label={p.status === 'won' ? 'ganada' : undefined}>
                  {p.status === 'won' ? <Icon name={p.segment.isFinal ? 'trophy' : 'check'} size={15} /> : null}
                </span>
              </div>
            );
          })}
        </div>
        <div className="legend" aria-hidden="true">
          0
          <i style={{ background: 'var(--heat-0)' }} />
          <i style={{ background: 'var(--heat-1)' }} />
          <i style={{ background: 'var(--heat-2)' }} />
          <i style={{ background: 'var(--heat-3)' }} />3 de 3
        </div>
      </section>

      <SectionTitle aside={`meta ${s.weeklyGoal}/7`}>Días completos por semana</SectionTitle>
      <section className="card">
        <div className="weeks-chart" role="img" aria-label="Días completos en cada semana del ciclo">
          <div className="goal-line" style={{ bottom: `${22 + (s.weeklyGoal / 7) * 96}px` }} />
          {progress.map((p) => (
            <div key={p.segment.index} className={`col ${p.status} ${p.segment.isFinal ? 'final' : ''}`}>
              <div className="track">
                <i style={{ height: `${(p.completed / 7) * 100}%` }} />
              </div>
              <span>{p.segment.isFinal ? 'F' : p.segment.index}</span>
            </div>
          ))}
        </div>
      </section>

      <SectionTitle>Núcleo</SectionTitle>
      <section className="card">
        {core.map((h) => (
          <div key={h.habit.id} className="hstat">
            <div className="hstat-head">
              <b>{h.habit.name}</b>
              <span>
                {h.pct}% · racha {h.current} · mejor {h.best}
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${h.pct}%` }} />
            </div>
          </div>
        ))}
        {stats.phase === 'before' && <p>Las estadísticas aparecen cuando empiece el ciclo.</p>}
      </section>

      {extras.length > 0 && (
        <>
          <SectionTitle>Secundarios</SectionTitle>
          <section className="card">
            {extras.map((h) => (
              <div key={h.habit.id} className="hstat">
                <div className="hstat-head">
                  <b>{h.habit.name}</b>
                  <span>
                    {plural(h.done, 'día', 'días')} · racha {h.current}
                  </span>
                </div>
                <div className="bar info">
                  <i style={{ width: `${h.pct}%` }} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
