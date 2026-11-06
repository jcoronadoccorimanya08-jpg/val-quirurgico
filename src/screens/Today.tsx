import { Icon } from '../components/Icon';
import { InstallCard } from '../components/InstallCard';
import { SectionTitle } from '../components/ui';
import { WeekCard } from '../components/WeekCard';
import { APP_NAME, LEMA } from '../lib/config';
import { addDays, diffDays, formatLong, localDateOf, type ISODate } from '../lib/dates';
import {
  buildSegments,
  completeStreak,
  coreCount,
  currentStreak,
  bestStreak,
  cycleEnd,
  cyclePhase,
  cycleStats,
  isComplete,
  isDone,
  isEditable,
  lastPlayableDay,
  segmentFor,
  segmentProgress,
} from '../lib/engine';
import { haptic, toast } from '../lib/feedback';
import { actions, getState } from '../lib/store';
import type { AppState, HabitKind, Settings } from '../lib/types';

interface Props {
  state: AppState;
  today: ISODate;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  onGoRewards: () => void;
  onBackup: () => void;
}

const STREAK_MILESTONES = [7, 14, 21, 30, 45, 60, 90];

export function TodayScreen({ state, today, selected, onSelect, onGoRewards, onBackup }: Props) {
  const s = state.settings as Settings;
  const phase = cyclePhase(s, today);
  const stats = cycleStats(s, state.days, today);
  const editable = isEditable(s, selected, today);
  const playable = lastPlayableDay(s, today);
  const streak = completeStreak(s, state.days, today);

  const onToggle = (kind: HabitKind, id: string) => {
    if (!editable) return;
    const seg = segmentFor(buildSegments(s), selected);
    const before = getState();
    const wasComplete = isComplete(before.days, selected, s.core);
    const wasWon = seg ? segmentProgress(seg, before.days, s.core, today).status === 'won' : false;
    const wasDone = isDone(before.days, selected, kind, id);

    actions.toggle(selected, kind, id);
    haptic(10);

    if (kind !== 'core' || wasDone) return;
    const after = getState();
    const nowWon = seg ? segmentProgress(seg, after.days, s.core, today).status === 'won' : false;
    if (seg && !wasWon && nowWon) {
      toast(seg.isFinal ? 'Gran premio desbloqueado. Reclámalo.' : `Semana ${seg.index} ganada. Reclama tu premio.`, 'reward');
      haptic([20, 60, 20, 60, 40]);
      return;
    }
    if (!wasComplete && isComplete(after.days, selected, s.core)) {
      toast('Día completo: 3 de 3.', 'success');
      haptic([15, 40, 15]);
      return;
    }
    const habit = s.core.find((h) => h.id === id);
    const run = currentStreak(after.days, 'core', id, s, today);
    if (habit && selected === today && STREAK_MILESTONES.includes(run)) toast(`${habit.name}: ${run} días seguidos.`, 'success');
  };

  const dayLabel =
    selected === today ? 'Hoy' : selected === addDays(today, -1) ? 'Ayer' : `Hace ${diffDays(selected, today)} días`;

  const backupDue = needsBackup(s, state, today);
  const coreDone = coreCount(state.days, selected, s.core);
  const extrasDone = s.extras.filter((h) => isDone(state.days, selected, 'extra', h.id)).length;

  return (
    <>
      <header className="screen-head">
        <div className="screen-head-text">
          <div className="eyebrow">{APP_NAME}</div>
          <h1 className="title">
            {phase === 'before' ? 'Tu ciclo está por empezar' : phase === 'finished' ? 'Ciclo completado' : `Día ${stats.dayNumber} de ${s.cycleLength}`}
          </h1>
          <p className="subtitle">{LEMA}</p>
        </div>
        {phase !== 'before' && (
          <div className="streak-pill" title="Días seguidos con las 3 rachas">
            <Icon name="flame" size={20} />
            <b>{streak}</b>
            <span>
              {streak === 1 ? 'día' : 'días'}
              <br />
              3/3
            </span>
          </div>
        )}
      </header>

      {phase !== 'before' && (
        <div className="cycle-bar" aria-hidden="true">
          <i style={{ width: `${(stats.dayNumber / s.cycleLength) * 100}%` }} />
        </div>
      )}

      <InstallCard appName="Val Q" dismissible />

      {backupDue && (
        <div className="banner">
          <Icon name="shield" />
          <div className="txt">
            <b>Respalda tu avance</b>
            Guarda una copia por si cambias o pierdes el teléfono.
          </div>
          <button type="button" className="btn sm" onClick={onBackup}>
            Respaldar
          </button>
        </div>
      )}

      {phase === 'before' ? (
        <BeforeStart s={s} today={today} onGoRewards={onGoRewards} />
      ) : (
        <>
          {phase === 'finished' && <FinishedCard s={s} state={state} today={today} />}

          <nav className="daynav" aria-label="Día que estás marcando">
            <button
              type="button"
              className="arrow"
              aria-label="Día anterior"
              disabled={selected <= s.startDate}
              onClick={() => onSelect(addDays(selected, -1))}
            >
              <Icon name="chevronLeft" />
            </button>
            <div className="label">
              <strong>{phase === 'finished' && selected === playable ? 'Último día' : dayLabel}</strong>
              <span>{formatLong(selected)}</span>
            </div>
            <button
              type="button"
              className="arrow"
              aria-label="Día siguiente"
              disabled={selected >= playable}
              onClick={() => onSelect(addDays(selected, 1))}
            >
              <Icon name="chevronRight" />
            </button>
          </nav>
          {selected !== playable && (
            <button type="button" className="back-today" onClick={() => onSelect(playable)}>
              Volver a {phase === 'finished' ? 'el último día' : 'hoy'}
            </button>
          )}

          <WeekCard
            s={s}
            state={state}
            date={selected}
            today={today}
            onPickDay={onSelect}
            onGoRewards={onGoRewards}
            onClaim={(i) => {
              actions.claimReward(i);
              haptic([20, 60, 20]);
              toast('Premio reclamado. Te lo ganaste.', 'reward');
            }}
          />

          <SectionTitle aside={`${coreDone}/${s.core.length}`}>Las 3 rachas · núcleo</SectionTitle>
          {s.core.map((h) => {
            const on = isDone(state.days, selected, 'core', h.id);
            return (
              <button
                key={h.id}
                type="button"
                className="habit"
                aria-pressed={on}
                disabled={!editable}
                onClick={() => onToggle('core', h.id)}
              >
                <span className="check">
                  <Icon name="check" size={24} />
                </span>
                <span className="body">
                  <span className="name">{h.name}</span>
                  {h.min && <span className="min">{h.min}</span>}
                </span>
                <span className="streak">
                  <b>{currentStreak(state.days, 'core', h.id, s, today)}</b>
                  <span>racha</span>
                  <small>mejor {bestStreak(state.days, 'core', h.id, s, today)}</small>
                </span>
              </button>
            );
          })}

          {s.extras.length > 0 && (
            <>
              <SectionTitle aside={`${extrasDone}/${s.extras.length}`}>Secundarios · sin presión</SectionTitle>
              <div className="list">
                {s.extras.map((h) => {
                  const on = isDone(state.days, selected, 'extra', h.id);
                  const run = currentStreak(state.days, 'extra', h.id, s, today);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      className="row"
                      aria-pressed={on}
                      disabled={!editable}
                      onClick={() => onToggle('extra', h.id)}
                    >
                      <span className="box">
                        <Icon name="check" size={16} />
                      </span>
                      <span className="label">{h.name}</span>
                      <span className="meta">{run > 0 ? `${run} d` : ''}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <p className="fine">Márcalo cada noche, antes de las 23:00. Si un día se te pasó, vuelve atrás y corrígelo.</p>
        </>
      )}
    </>
  );
}

function needsBackup(s: Settings, state: AppState, today: ISODate): boolean {
  const marked = Object.keys(state.days).filter((d) => d >= s.startDate).length;
  if (marked < 5) return false;
  if (!s.lastBackupAt) return true;
  return diffDays(localDateOf(s.lastBackupAt), today) >= 7;
}

function BeforeStart({ s, today, onGoRewards }: { s: Settings; today: ISODate; onGoRewards: () => void }) {
  const left = diffDays(today, s.startDate);
  return (
    <section className="card">
      <div className="card-title">Empieza el {formatLong(s.startDate)}</div>
      <p>
        {left === 1 ? 'Falta 1 día.' : `Faltan ${left} días.`} Aprovecha para definir tus premios: uno por cada semana que cumplas y un gran premio al
        final.
      </p>
      <button type="button" className="btn primary block" style={{ marginTop: 14 }} onClick={onGoRewards}>
        <Icon name="gift" size={18} /> Definir mis premios
      </button>
      <button
        type="button"
        className="btn block"
        style={{ marginTop: 8 }}
        onClick={() => {
          actions.setStartDate(today);
          toast('Tu ciclo empieza hoy.', 'success');
        }}
      >
        <Icon name="calendar" size={18} /> Prefiero empezar hoy
      </button>
    </section>
  );
}

function FinishedCard({ s, state, today }: { s: Settings; state: AppState; today: ISODate }) {
  const st = cycleStats(s, state.days, today);
  return (
    <section className="card week final" style={{ marginBottom: 12 }}>
      <div className="card-title">Terminaste tus {s.cycleLength} días</div>
      <p>
        {st.completeDays} días completos · {st.completionPct}% de cumplimiento · {st.segmentsWon} de {st.segmentsTotal} semanas ganadas. El ciclo
        terminó el {formatLong(cycleEnd(s))}. Puedes empezar uno nuevo desde Ajustes.
      </p>
    </section>
  );
}
