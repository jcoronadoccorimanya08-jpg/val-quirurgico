import { Icon } from '../components/Icon';
import { Mountain } from '../components/Mountain';
import { ScreenHeader, SectionTitle } from '../components/ui';
import { formatLong, formatRange, rangeDates, type ISODate } from '../lib/dates';
import { allSegmentProgress, cycleEnd, cycleStats, dailySeries, dayPct, habitLabel, habitStats, isWon } from '../lib/engine';
import { OTHER_NAME, VICTORY_PCT, teamFor } from '../lib/team';
import type { AppState } from '../lib/types';

interface Props {
  state: AppState;
  today: ISODate;
  onOpenDay: (d: ISODate) => void;
}

function bucket(pct: number, won: boolean): string {
  if (won) return 's3';
  if (pct >= 40) return 's2';
  if (pct > 0) return 's1';
  return 's0';
}

export function ProgressScreen({ state, today, onOpenDay }: Props) {
  const s = state.settings;
  const stats = cycleStats(s, state.days, today);
  const progress = allSegmentProgress(s, state.days, today);
  const series = dailySeries(s, state.days, today);
  const core = habitStats(s, state.days, today, 'core');
  const extras = habitStats(s, state.days, today, 'extra');
  const team = teamFor(s, state.days, today);

  return (
    <>
      <ScreenHeader eyebrow="Avance" title="Tu ciclo" subtitle={formatRange(s.startDate, cycleEnd(s))} />

      <div className="tiles">
        <div className="tile">
          <b className="num">{stats.wonDays}</b>
          <span>días ganados</span>
        </div>
        <div className="tile">
          <b className="num">
            {stats.avgPct}
            <small>%</small>
          </b>
          <span>promedio diario</span>
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

      <SectionTitle aside="toca para ver un día">Tu montaña</SectionTitle>
      <section className="card">
        {series.length ? (
          <Mountain data={series} goal={s.dayGoal} onPick={onOpenDay} />
        ) : (
          <p style={{ marginTop: 0 }}>Tu montaña aparece cuando empiece el ciclo.</p>
        )}
      </section>

      <SectionTitle aside="toca un día para editarlo">Mapa del ciclo</SectionTitle>
      <section className="card">
        <div className="heat" role="grid" aria-label="Días del ciclo por semana">
          {progress.map((p) => {
            const dates = rangeDates(p.segment.start, p.segment.end);
            return (
              <div key={p.segment.index} role="row" style={{ display: 'contents' }}>
                <span className="wk" role="rowheader">
                  {p.segment.isFinal ? 'Fin' : `S${p.segment.index}`}
                </span>
                {dates.map((d) => {
                  const future = d > today;
                  const pct = dayPct(s, state.days, d);
                  return (
                    <button
                      key={d}
                      type="button"
                      role="gridcell"
                      className={`cell ${future ? 'future' : bucket(pct, isWon(s, state.days, d))} ${d === today ? 'today' : ''}`}
                      disabled={future}
                      aria-label={`${formatLong(d)}: ${future ? 'por venir' : `${Math.round(pct)}%`}`}
                      onClick={() => onOpenDay(d)}
                    />
                  );
                })}
                {Array.from({ length: 7 - dates.length }, (_, i) => (
                  <span key={`pad-${i}`} className="cell void" aria-hidden="true" />
                ))}
                <span className={`tail ${p.segment.isFinal ? 'final' : ''}`}>{p.status === 'won' ? <Icon name="check" size={15} /> : null}</span>
              </div>
            );
          })}
        </div>
        <div className="legend" aria-hidden="true">
          0%
          <i style={{ background: 'var(--heat-0)' }} />
          <i style={{ background: 'var(--heat-1)' }} />
          <i style={{ background: 'var(--heat-2)' }} />
          <i style={{ background: 'var(--heat-3)' }} />
          ganado
        </div>
      </section>

      <SectionTitle aside={`meta ${s.weeklyGoal} de 7`}>Días ganados por semana</SectionTitle>
      <section className="card">
        <div className="weeks-chart" role="img" aria-label="Días ganados en cada semana del ciclo">
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

      {(s.grand || team.other) && (
        <>
          <SectionTitle aside={`${team.victories} de ${team.list.length}`}>Semanas victoriosas</SectionTitle>
          <section className="card" aria-label="Semanas victoriosas">
            <div className="weeks-chart" role="img" aria-label={`Promedio de Val Q y ${OTHER_NAME} en cada semana`}>
              {team.list.map((w, i) => (
                <div key={w.index} className={`col ${w.victory ? 'victory' : w.avg !== null ? 'active' : ''}`}>
                  <b>{w.avg === null ? '' : Math.round(w.avg)}</b>
                  <div className="track">
                    <i style={{ height: `${w.avg === null ? 0 : Math.max(3, w.avg)}%` }} />
                  </div>
                  <span>{i === team.list.length - 1 ? 'F' : w.index}</span>
                </div>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              Promedio de Val Q y {OTHER_NAME} en cada semana. Dorado: {VICTORY_PCT} % o más.
              {!team.other ? ` Abre ${OTHER_NAME} en este teléfono para sumar sus semanas.` : !team.aligned ? ` ${OTHER_NAME} tiene otro inicio de ciclo.` : ''}
            </p>
          </section>
        </>
      )}

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
      </section>

      {extras.length > 0 && (
        <>
          <SectionTitle>Secundarios</SectionTitle>
          <section className="card">
            {extras.map((h) => (
              <div key={h.habit.id} className="hstat">
                <div className="hstat-head">
                  <b>{habitLabel(h.habit, s.startDate, today)}</b>
                  <span>
                    {h.done} {h.done === 1 ? 'día' : 'días'} · racha {h.current}
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
