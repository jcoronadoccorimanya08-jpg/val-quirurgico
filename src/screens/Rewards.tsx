import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ScreenHeader, SectionTitle } from '../components/ui';
import { formatRange, formatShort, localDateOf, type ISODate } from '../lib/dates';
import { allSegmentProgress, type SegmentProgress } from '../lib/engine';
import { haptic, toast } from '../lib/feedback';
import { STATUS_LABEL } from '../lib/report';
import { actions } from '../lib/store';
import type { AppState, Reward, Settings } from '../lib/types';

const IDEAS = ['Comer carne en un buen lugar', 'Salida con amigos (planeada)', 'Ropa nueva', 'Un perfume', 'Un día libre de pantallas', 'Un libro'];

export function RewardsScreen({ state, today }: { state: AppState; today: ISODate }) {
  const s = state.settings as Settings;
  const progress = allSegmentProgress(s, state.days, today);
  const won = progress.filter((p) => p.status === 'won').length;
  const pending = progress.filter((p) => p.status === 'won' && !state.rewards[String(p.segment.index)]?.claimedAt).length;
  const final = progress[progress.length - 1];

  const fillNextEmpty = (idea: string) => {
    const target = progress.find((p) => p.status !== 'missed' && !state.rewards[String(p.segment.index)]?.text?.trim());
    if (!target) {
      toast('Ya tienes todos los premios definidos.');
      return;
    }
    actions.setRewardText(target.segment.index, idea);
    toast(`${target.segment.isFinal ? 'Gran premio' : `Semana ${target.segment.index}`}: ${idea}`);
  };

  return (
    <>
      <ScreenHeader
        eyebrow="Premios"
        title="Un premio por semana"
        subtitle={`${won} de ${progress.length} ganadas${pending ? ` · ${pending} por reclamar` : ''}`}
      />

      <section className="card">
        <div className="card-title">Cómo se gana</div>
        <p>
          Ganas la semana con <b>{s.weeklyGoal} de 7 días completos</b>, es decir, con las 3 rachas del núcleo marcadas. En un día malo vale la versión
          mínima. {final ? `El tramo final (${formatRange(final.segment.start, final.segment.end)}) es el gran premio: ${final.segment.goal} de ${final.segment.length} días.` : ''}
        </p>
        <div className="chips" aria-label="Ideas de premios">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="chip" onClick={() => fillNextEmpty(idea)}>
              + {idea}
            </button>
          ))}
        </div>
      </section>

      <SectionTitle aside={`${s.cycleLength} días`}>Tus premios</SectionTitle>
      {progress.map((p) => (
        <RewardRow key={p.segment.index} p={p} reward={state.rewards[String(p.segment.index)]} />
      ))}
    </>
  );
}

function RewardRow({ p, reward }: { p: SegmentProgress; reward: Reward | undefined }) {
  const { segment: seg, status, completed } = p;
  const [text, setText] = useState(reward?.text ?? '');
  useEffect(() => setText(reward?.text ?? ''), [reward?.text]);
  const save = () => {
    if (text !== (reward?.text ?? '')) actions.setRewardText(seg.index, text.trim());
  };
  const claimed = Boolean(reward?.claimedAt);
  const pct = Math.min(100, Math.round((completed / seg.goal) * 100));

  return (
    <article className={`reward ${status} ${seg.isFinal ? 'final' : ''}`} aria-label={seg.isFinal ? 'Gran premio' : `Semana ${seg.index}`}>
      <div className="reward-head">
        <div>
          <div className="reward-title">
            {seg.isFinal && <Icon name="trophy" size={18} />}
            {seg.isFinal ? 'Gran premio · tramo final' : `Semana ${seg.index}`}
          </div>
          <div className="reward-dates">
            {formatRange(seg.start, seg.end)} · meta {seg.goal} de {seg.length}
          </div>
        </div>
        <span className={`badge ${claimed ? 'claimed' : status}`}>{claimed ? 'Reclamado' : STATUS_LABEL[status]}</span>
      </div>

      {status !== 'future' && (
        <div className="reward-progress">
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          {completed}/{seg.goal}
        </div>
      )}

      <input
        className="field"
        type="text"
        inputMode="text"
        enterKeyHint="done"
        maxLength={80}
        placeholder={seg.isFinal ? 'Tu gran premio (ej.: un perfume)' : 'Tu premio de esta semana'}
        value={text}
        disabled={claimed}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={seg.isFinal ? 'Gran premio' : `Premio de la semana ${seg.index}`}
      />

      {claimed ? (
        <div className="claimed-note">
          <Icon name="check" size={16} /> Reclamado el {formatShort(localDateOf(reward!.claimedAt!))}
        </div>
      ) : status === 'won' ? (
        <button
          type="button"
          className={`btn ${seg.isFinal ? 'gold' : 'primary'} block`}
          disabled={!text.trim()}
          onClick={() => {
            save();
            actions.claimReward(seg.index);
            haptic([20, 60, 20]);
            toast('Premio reclamado. Te lo ganaste.', 'reward');
          }}
        >
          <Icon name="gift" size={18} /> {text.trim() ? 'Reclamar premio' : 'Escribe tu premio para reclamarlo'}
        </button>
      ) : null}
    </article>
  );
}
