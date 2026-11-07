import { useEffect, useState } from 'react';
import { celebrate } from '../components/Confetti';
import { GoalCard } from '../components/GoalCard';
import { Icon } from '../components/Icon';
import { HowItWorks, WhatsNewBanner } from '../components/HowItWorks';
import { InstallCard } from '../components/InstallCard';
import { MoodPicker } from '../components/MoodPicker';
import { SectionTitle } from '../components/ui';
import { WeekCard } from '../components/WeekCard';
import { APP_NAME, LEMA } from '../lib/config';
import { addDays, diffDays, formatLong, localDateOf, type ISODate } from '../lib/dates';
import {
  allSegmentProgress,
  bestStreak,
  buildSegments,
  currentStreak,
  cyclePhase,
  cycleStats,
  dayPct,
  habitLabel,
  isDone,
  isEditable,
  countedHabits,
  goalOn,
  isExamDay,
  isTripDay,
  isWon,
  lastPlayableDay,
  neededToWin,
  segmentFor,
  segmentProgress,
  weights,
  wonStreak,
} from '../lib/engine';
import { haptic, toast } from '../lib/feedback';
import { badgeBlocks, earnedTiers } from '../lib/badges';
import { wildcards } from '../lib/rewards';
import { actions, biometricSupport, enableBiometric, getState, lock } from '../lib/store';
import type { AppState, HabitKind, Settings } from '../lib/types';

interface Props {
  state: AppState;
  today: ISODate;
  hasBio: boolean;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  onGoRewards: () => void;
  onBackup: () => void;
}

const BIO_PROMO_KEY = 'val-quirurgico.bio-promo';

export function TodayScreen({ state, today, hasBio, selected, onSelect, onGoRewards, onBackup }: Props) {
  const s = state.settings;
  const phase = cyclePhase(s, today);
  const stats = cycleStats(s, state.days, today);
  const editable = isEditable(s, selected, today);
  const playable = lastPlayableDay(s, today);
  const streak = wonStreak(s, state.days, today);
  const trip = isTripDay(s, selected);
  const exam = !trip && isExamDay(s, selected);
  const goal = goalOn(s, selected);
  const counted = countedHabits(s, selected);
  const countsHabit = (id: string) => !trip || counted.core.some((h) => h.id === id) || counted.extras.some((h) => h.id === id);
  const pct = Math.round(dayPct(s, state.days, selected));
  const won = isWon(s, state.days, selected);
  const need = neededToWin(s, state.days, selected);
  const w = weights(s, selected);
  const wild = wildcards(state, allSegmentProgress(s, state.days, today));
  const usedWildcard = Boolean(state.days[selected]?.wildcard);
  const [help, setHelp] = useState(false);

  const onToggle = (kind: HabitKind, id: string) => {
    if (!editable) return;
    const seg = segmentFor(buildSegments(s), selected);
    const before = getState();
    if (!before) return;
    const wasWon = isWon(s, before.days, selected);
    const weekWasWon = seg ? segmentProgress(seg, s, before.days, today).status === 'won' : false;
    const tiersBefore = earnedTiers(badgeBlocks(s, before.days, today)).length;
    actions.toggle(selected, kind, id);
    haptic(10);
    const after = getState();
    if (!after) return;
    const weekNowWon = seg ? segmentProgress(seg, s, after.days, today).status === 'won' : false;
    const tiers = earnedTiers(badgeBlocks(s, after.days, today));
    if (tiers.length > tiersBefore) {
      celebrate('week');
      haptic([20, 60, 20, 60, 40]);
      toast(`¡Insignia ${tiers[tiers.length - 1]}! ${s.weeklyGoal * 2} días ganados en 2 semanas.`, 'reward');
    } else if (seg && !weekWasWon && weekNowWon) {
      celebrate('week');
      haptic([20, 60, 20, 60, 40]);
      toast(`¡Semana ${seg.index} ganada! +${s.fundPerWeek} Bs y un cofre en Premios.`, 'reward');
    } else if (!wasWon && isWon(s, after.days, selected)) {
      celebrate('day');
      haptic([15, 40, 15]);
      toast(`¡Día ganado! ${Math.round(dayPct(s, after.days, selected))}%`, 'success');
    }
  };

  const dayLabel = selected === today ? 'Hoy' : selected === addDays(today, -1) ? 'Ayer' : `Hace ${diffDays(selected, today)} días`;
  const coreDone = s.core.filter((h) => isDone(state.days, selected, 'core', h.id)).length;
  const extrasDone = s.extras.filter((h) => isDone(state.days, selected, 'extra', h.id)).length;
  const countedDone =
    counted.core.filter((h) => isDone(state.days, selected, 'core', h.id)).length + counted.extras.filter((h) => isDone(state.days, selected, 'extra', h.id)).length;

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
        <div className="head-actions">
          {phase !== 'before' && (
            <div className={`streak-pill ${streak >= 7 ? 'hot' : ''}`} title="Días ganados seguidos">
              <Icon name="flame" size={20} />
              <b>{streak}</b>
              <span>{streak === 1 ? 'día' : 'días'}</span>
            </div>
          )}
          <button type="button" className="icon-btn" aria-label="Bloquear ahora" onClick={lock}>
            <Icon name="lock" />
          </button>
        </div>
      </header>

      {phase !== 'before' && (
        <div className="cycle-bar" aria-hidden="true">
          <i style={{ width: `${(stats.dayNumber / s.cycleLength) * 100}%` }} />
        </div>
      )}

      <GoalCard state={state} today={today} onOpen={onGoRewards} />
      {!hasBio && <BioPromo />}
      <InstallCard appName="Val Q" dismissible />
      <WhatsNewBanner onOpen={() => setHelp(true)} />
      {needsBackup(s, state, today) && (
        <div className="banner">
          <Icon name="shield" />
          <div className="txt">
            <b>Respalda tu avance</b>
            Guárdalo en Drive por si cambias o pierdes el teléfono.
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
          <nav className="daynav" aria-label="Día que estás marcando">
            <button type="button" className="arrow" aria-label="Día anterior" disabled={selected <= s.startDate} onClick={() => onSelect(addDays(selected, -1))}>
              <Icon name="chevronLeft" />
            </button>
            <div className="label">
              <strong>{phase === 'finished' && selected === playable ? 'Último día' : dayLabel}</strong>
              <span>{formatLong(selected)}</span>
            </div>
            <button type="button" className="arrow" aria-label="Día siguiente" disabled={selected >= playable} onClick={() => onSelect(addDays(selected, 1))}>
              <Icon name="chevronRight" />
            </button>
          </nav>
          {selected !== playable && (
            <button type="button" className="back-today" onClick={() => onSelect(playable)}>
              Volver a hoy
            </button>
          )}

          <section className={`card score ${won ? 'won' : ''}`} aria-label="Porcentaje del día">
            <div className="score-top">
              <div className="score-num">
                <b>{pct}</b>
                <span>%</span>
              </div>
              <div className="score-text">
                <b>{won ? (usedWildcard && pct < goal ? 'Día salvado con comodín' : '¡Día ganado!') : `Meta: ${goal}%`}</b>
                <span>
                  {won
                    ? trip
                      ? `Modo viaje · ${countedDone}/${counted.core.length + counted.extras.length} de los que cuentan`
                      : `Núcleo ${coreDone}/${s.core.length}${exam ? ' · modo examen' : ` · secundarios ${extrasDone}/${s.extras.length}`}`
                    : need
                      ? `Te falta ${describeNeed(need)}.`
                      : 'Hoy ya no alcanza la meta.'}
                </span>
              </div>
            </div>
            <div className="score-bar" aria-hidden="true">
              <i style={{ width: `${pct}%` }} />
              <em style={{ left: `${goal}%` }} />
            </div>
            {exam && <p className="score-note">Modo examen hasta el {formatLong(s.exam!.to)}: solo cuenta el núcleo. Ganas con 3 de 4.</p>}
            {trip && (
              <p className="score-note">
                Modo viaje hasta el {formatLong(s.trip!.to)}: cuentan {counted.core.length + counted.extras.length} hábitos y ganas con {goal} %. Los demás ni suman ni restan.
              </p>
            )}
            {editable && !won && wild.available > 0 && (
              <button
                type="button"
                className="btn gold block sm"
                style={{ marginTop: 12 }}
                onClick={() => {
                  actions.useWildcard(selected);
                  celebrate('day');
                  toast('Comodín usado: este día cuenta como ganado.', 'reward');
                }}
              >
                <Icon name="sparkles" size={17} /> Usar un comodín (tienes {wild.available})
              </button>
            )}
            {editable && usedWildcard && (
              <button type="button" className="link-btn" onClick={() => actions.removeWildcard(selected)}>
                Quitar el comodín de este día
              </button>
            )}
          </section>

          <WeekCard s={s} state={state} date={selected} today={today} onPickDay={onSelect} />

          <SectionTitle aside={trip ? `${counted.core.length} cuentan en el viaje` : `${coreDone}/${s.core.length} · ${Math.round(w.core)}% c/u`}>Núcleo</SectionTitle>
          {s.core.map((h) => {
            const on = isDone(state.days, selected, 'core', h.id);
            return (
              <button key={h.id} type="button" className={`habit ${countsHabit(h.id) ? '' : 'off'}`} aria-pressed={on} disabled={!editable} onClick={() => onToggle('core', h.id)}>
                <span className="check">
                  <Icon name="check" size={24} />
                </span>
                <span className="body">
                  <span className="name">{habitLabel(h, s.startDate, selected)}</span>
                  {h.steps && (
                    <span className="steps-list">
                      {h.steps.map((st) => (
                        <span key={st}>{st}</span>
                      ))}
                    </span>
                  )}
                  {h.min && <span className="min">{h.min}</span>}
                  {!countsHabit(h.id) && <span className="min">No cuenta en el viaje</span>}
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
              <SectionTitle
                aside={
                  trip
                    ? `${counted.extras.length} cuentan en el viaje`
                    : exam
                      ? 'no cuentan en exámenes'
                      : `${extrasDone}/${s.extras.length} · ${w.extra.toFixed(1).replace('.', ',')}% c/u`
                }
              >
                Secundarios
              </SectionTitle>
              <div className="list">
                {s.extras.map((h) => {
                  const on = isDone(state.days, selected, 'extra', h.id);
                  const run = currentStreak(state.days, 'extra', h.id, s, today);
                  return (
                    <button key={h.id} type="button" className={`row ${countsHabit(h.id) ? '' : 'off'}`} aria-pressed={on} disabled={!editable} onClick={() => onToggle('extra', h.id)}>
                      <span className="box">
                        <Icon name="check" size={16} />
                      </span>
                      <span className="label">{habitLabel(h, s.startDate, selected)}</span>
                      <span className="meta">{!countsHabit(h.id) ? 'no cuenta' : run > 0 ? `${run} d` : ''}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <MoodPicker
            value={state.days[selected]?.mood}
            disabled={!editable}
            onChange={(m) => {
              actions.setMood(selected, m);
              haptic(8);
            }}
          />

          <p className="fine">Márcalo cada noche, antes de las 23:00. Si un día se te pasó, vuelve atrás y corrígelo.</p>
        </>
      )}
      {help && <HowItWorks s={s} onClose={() => setHelp(false)} />}
    </>
  );
}

function describeNeed(n: { core: number; extra: number }): string {
  const parts: string[] = [];
  if (n.core) parts.push(n.core === 1 ? '1 del núcleo' : `${n.core} del núcleo`);
  if (n.extra) parts.push(n.extra === 1 ? '1 secundario' : `${n.extra} secundarios`);
  return parts.join(' y ');
}

function needsBackup(s: Settings, state: AppState, today: ISODate): boolean {
  const marked = Object.keys(state.days).filter((d) => d >= s.startDate).length;
  if (marked < 5) return false;
  if (!s.lastBackupAt) return true;
  return diffDays(localDateOf(s.lastBackupAt), today) >= 7;
}

function BioPromo() {
  const [support, setSupport] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(BIO_PROMO_KEY) === 'hide';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    void biometricSupport().then(setSupport);
  }, []);
  if (hidden || !support || support === 'no') return null;
  const hide = () => {
    try {
      localStorage.setItem(BIO_PROMO_KEY, 'hide');
    } catch {
      /* nada */
    }
    setHidden(true);
  };
  return (
    <div className="banner install" role="region" aria-label="Activar huella">
      <Icon name="fingerprint" />
      <div className="txt">
        <b>Entra con tu huella</b>
        Más rápido que el patrón, y tus datos siguen cifrados.
      </div>
      <button
        type="button"
        className="btn primary sm"
        onClick={async () => {
          try {
            await enableBiometric();
            toast('Huella activada.', 'success');
          } catch (e) {
            const m = e instanceof Error ? e.message : '';
            if (m === 'NOPRF') {
              toast('Tu teléfono no permite usar la huella aquí. Sigue con tu patrón.', 'error');
              hide();
            } else toast('No se activó la huella.', 'error');
          }
        }}
      >
        Activar
      </button>
      <button type="button" className="icon-btn" aria-label="Ahora no" onClick={hide}>
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

function BeforeStart({ s, today, onGoRewards }: { s: Settings; today: ISODate; onGoRewards: () => void }) {
  const left = diffDays(today, s.startDate);
  return (
    <section className="card">
      <div className="card-title">Empieza el {formatLong(s.startDate)}</div>
      <p>{left === 1 ? 'Falta 1 día.' : `Faltan ${left} días.`} Revisa tus premios: cada semana ganada suma {s.fundPerWeek} Bs a tu fondo.</p>
      <button type="button" className="btn primary block" style={{ marginTop: 14 }} onClick={onGoRewards}>
        <Icon name="gift" size={18} /> Ver mis premios
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
