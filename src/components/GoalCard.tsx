import { diffDays, formatLong, type ISODate } from '../lib/dates';
import { allSegmentProgress } from '../lib/engine';
import { fund, nextCatalogGoal, specialStatus } from '../lib/rewards';
import type { AppState } from '../lib/types';
import { Icon } from './Icon';

/** Tu meta, todos los días arriba en Hoy: el premio especial y, si no hay, el próximo premio del fondo. */
export function GoalCard({ state, today, onOpen }: { state: AppState; today: ISODate; onOpen: () => void }) {
  const s = state.settings;
  const progress = allSegmentProgress(s, state.days, today);
  const f = fund(s, state, progress);
  const sp = s.special;
  const st = specialStatus(s, progress, today);
  const showSpecial = sp && st.kind !== 'none' && st.kind !== 'claimed' && (!sp.date || today <= sp.date);

  if (showSpecial && sp) {
    const days = sp.date ? diffDays(today, sp.date) : null;
    let line: string;
    if (st.kind === 'available') line = '¡Desbloqueado! Ya puedes reclamarlo.';
    else if (st.kind === 'locked' && st.reason === 'date')
      line = `Se desbloquea el ${formatLong(st.unlockDate)} · ya tienes ${st.weeksWon} de ${st.required} semanas.`;
    else if (st.kind === 'locked')
      line = `Llevas ${st.weeksWon} de ${st.required} semanas ganadas${today < st.unlockDate ? ` · se desbloquea el ${formatLong(st.unlockDate)}` : ''}.`;
    else line = '';
    return (
      <button type="button" className={`goal ${st.kind === 'available' ? 'ready' : ''}`} onClick={onOpen} aria-label="Tu meta">
        <span className="goal-icon">
          <Icon name="target" size={22} />
        </span>
        <span className="goal-body">
          <span className="goal-eyebrow">Tu meta</span>
          <b>{sp.name}</b>
          <span className="goal-sub">{line}</span>
        </span>
        {days !== null && days >= 0 && (
          <span className="goal-count">
            <b>{days}</b>
            <small>{days === 1 ? 'día' : 'días'}</small>
          </span>
        )}
      </button>
    );
  }

  const redeemed = new Set(state.redemptions.map((r) => r.itemId));
  const next = nextCatalogGoal(s, f.balance, redeemed);
  if (!next) return null;
  const left = Math.max(0, next.price - f.balance);
  return (
    <button type="button" className={`goal ${left === 0 ? 'ready' : ''}`} onClick={onOpen} aria-label="Tu meta">
      <span className="goal-icon">
        <Icon name="gift" size={22} />
      </span>
      <span className="goal-body">
        <span className="goal-eyebrow">Tu próximo premio</span>
        <b>{next.name}</b>
        <span className="goal-sub">{left === 0 ? '¡Ya te alcanza! Canjéalo en Premios.' : `Te faltan Bs ${left} · tienes Bs ${f.balance}`}</span>
      </span>
      <span className="goal-count">
        <b>{Math.min(100, Math.round((f.balance / Math.max(1, next.price)) * 100))}%</b>
        <small>listo</small>
      </span>
    </button>
  );
}
