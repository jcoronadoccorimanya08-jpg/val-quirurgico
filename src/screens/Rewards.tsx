import { useState } from 'react';
import { celebrate } from '../components/Confetti';
import { Icon } from '../components/Icon';
import { ConfirmDialog, ScreenHeader, SectionTitle } from '../components/ui';
import { CHEST_LABEL } from '../lib/config';
import { formatLong, formatRange, formatShort, isValidISODate, localDateOf, type ISODate } from '../lib/dates';
import { allSegmentProgress } from '../lib/engine';
import { haptic, toast } from '../lib/feedback';
import { fund, pendingChests, specialStatus, wildcards } from '../lib/rewards';
import { STATUS_LABEL } from '../lib/report';
import { actions } from '../lib/store';
import type { AppState, CatalogItem, SpecialPrize } from '../lib/types';

export function RewardsScreen({ state, today }: { state: AppState; today: ISODate }) {
  const s = state.settings;
  const progress = allSegmentProgress(s, state.days, today);
  const f = fund(s, state, progress);
  const chests = pendingChests(progress, state);
  const wild = wildcards(state, progress);
  const redeemed = new Map(state.redemptions.map((r) => [r.itemId, r]));
  const active = s.catalog.filter((c) => c.active).sort((a, b) => a.price - b.price);
  const later = s.catalog.filter((c) => !c.active);
  const [confirm, setConfirm] = useState<CatalogItem | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const history = [
    ...state.redemptions.map((r) => ({ at: r.at, text: `Canjeaste: ${r.name} (Bs ${r.price})` })),
    ...Object.entries(state.chests).map(([w, c]) => ({ at: c.openedAt, text: `Cofre de la semana ${w}: ${CHEST_LABEL[c.outcome]}` })),
    ...(s.special?.claimedAt ? [{ at: s.special.claimedAt, text: `Premio especial: ${s.special.name}` }] : []),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <>
      <ScreenHeader eyebrow="Premios" title="Tu fondo" subtitle={`+${s.fundPerWeek} Bs por cada semana ganada`} />

      <section className="card fund">
        <div className="fund-top">
          <span className="fund-icon">
            <Icon name="wallet" size={26} />
          </span>
          <div>
            <div className="fund-amount">
              <small>Bs</small> {f.balance}
            </div>
            <div className="muted">
              {f.weeksWon} {f.weeksWon === 1 ? 'semana ganada' : 'semanas ganadas'} · ganado {f.earned}
              {f.bonus ? ` · bonos ${f.bonus}` : ''}
              {f.spent ? ` · canjeado ${f.spent}` : ''}
            </div>
          </div>
        </div>
        <div className="fund-row">
          <span>
            <Icon name="sparkles" size={16} /> Comodines: <b>{wild.available}</b>
          </span>
          <span className="muted">uno cada 2 semanas ganadas</span>
        </div>
      </section>

      {chests.map((w) => (
        <section key={w} className="card chest">
          <div className="chest-body">
            <span className="chest-icon" aria-hidden="true">
              🎁
            </span>
            <div>
              <div className="card-title">Cofre de la semana {w}</div>
              <p>Ganaste la semana. Ábrelo y descubre tu sorpresa.</p>
            </div>
          </div>
          <button
            type="button"
            className="btn gold block"
            onClick={() => {
              const c = actions.openChest(w);
              if (!c) return;
              celebrate('week');
              haptic([20, 60, 20, 60, 40]);
              toast(`Te salió: ${CHEST_LABEL[c.outcome]}`, 'reward');
            }}
          >
            Abrir cofre
          </button>
        </section>
      ))}

      <SpecialCard state={state} today={today} />

      <SectionTitle aside={`${active.length} premios`}>Tu lista</SectionTitle>
      {active.map((item) => {
        const r = redeemed.get(item.id);
        const pct = Math.min(100, Math.round((f.balance / Math.max(1, item.price)) * 100));
        if (editing === item.id) return <ItemEditor key={item.id} item={item} onDone={() => setEditing(null)} />;
        return (
          <article key={item.id} className={`reward ${r ? 'claimed-item' : f.balance >= item.price ? 'won' : ''}`} aria-label={item.name}>
            <div className="reward-head">
              <div>
                <div className="reward-title">{item.name}</div>
                <div className="reward-dates">Bs {item.price}</div>
              </div>
              <button type="button" className="icon-btn" aria-label={`Editar ${item.name}`} onClick={() => setEditing(item.id)}>
                <Icon name="sliders" size={18} />
              </button>
            </div>
            {r ? (
              <div className="claimed-note">
                <Icon name="check" size={16} /> Canjeado el {formatShort(localDateOf(r.at))}
              </div>
            ) : (
              <>
                <div className="reward-progress">
                  <div className="bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  {pct}%
                </div>
                <button type="button" className="btn primary block" disabled={f.balance < item.price} onClick={() => setConfirm(item)}>
                  <Icon name="gift" size={18} /> {f.balance >= item.price ? 'Canjear' : `Te faltan Bs ${item.price - f.balance}`}
                </button>
              </>
            )}
          </article>
        );
      })}

      <div className="group" style={{ marginTop: 4 }}>
        <div className="add-row" style={{ paddingTop: 14 }}>
          <input className="field" value={newName} maxLength={60} placeholder="Nuevo premio" aria-label="Nuevo premio" onChange={(e) => setNewName(e.target.value)} />
          <input
            className="field price"
            value={newPrice}
            inputMode="numeric"
            placeholder="Bs"
            aria-label="Precio en Bs"
            onChange={(e) => setNewPrice(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
          <button
            type="button"
            className="btn primary"
            aria-label="Agregar premio"
            disabled={!newName.trim() || !newPrice}
            onClick={() => {
              actions.addCatalogItem(newName, Number(newPrice));
              setNewName('');
              setNewPrice('');
              toast('Premio agregado.');
            }}
          >
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>

      {later.length > 0 && (
        <>
          <SectionTitle>Más adelante</SectionTitle>
          <div className="group">
            {later.map((item) => (
              <div key={item.id} className="item">
                <div className="txt">
                  <b>{item.name}</b>
                  <span>Bs {item.price}</span>
                </div>
                <button type="button" className="btn sm" onClick={() => actions.upsertCatalogItem({ ...item, active: true })}>
                  Activar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle aside={`${progress.filter((p) => p.status === 'won').length} de ${progress.length}`}>Semanas</SectionTitle>
      <div className="weeks-grid">
        {progress.map((p) => (
          <div key={p.segment.index} className={`wk ${p.status}`} title={`${formatRange(p.segment.start, p.segment.end)} · ${STATUS_LABEL[p.status]}`}>
            <b>{p.segment.isFinal ? 'F' : p.segment.index}</b>
            <span>
              {p.completed}/{p.segment.goal}
            </span>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <>
          <SectionTitle>Historial de logros</SectionTitle>
          <div className="group">
            {history.map((h, i) => (
              <div key={i} className="item">
                <div className="txt">
                  <b>{h.text}</b>
                  <span>{h.at ? formatLong(localDateOf(h.at)) : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? `Canjear «${confirm.name}»` : ''}
        body={confirm ? `Se descuentan Bs ${confirm.price} de tu fondo. Te quedan Bs ${f.balance - confirm.price}. ¡Disfrútalo, te lo ganaste!` : ''}
        confirmLabel="Canjear"
        onConfirm={() => {
          if (!confirm) return;
          actions.redeem(confirm);
          celebrate('week');
          toast(`¡${confirm.name}! Te lo ganaste.`, 'reward');
        }}
      />
    </>
  );
}

function ItemEditor({ item, onDone }: { item: CatalogItem; onDone: () => void }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  return (
    <article className="reward">
      <input className="field" value={name} maxLength={60} aria-label="Nombre del premio" onChange={(e) => setName(e.target.value)} />
      <input className="field" value={price} inputMode="numeric" aria-label="Precio en Bs" onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 5))} />
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            actions.upsertCatalogItem({ ...item, active: false });
            onDone();
          }}
        >
          Para más adelante
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!name.trim() || !price}
          onClick={() => {
            actions.upsertCatalogItem({ ...item, name: name.trim(), price: Number(price) });
            onDone();
          }}
        >
          Guardar
        </button>
      </div>
      <button
        type="button"
        className="link-btn danger-link"
        onClick={() => {
          actions.removeCatalogItem(item.id);
          onDone();
        }}
      >
        Quitar de la lista
      </button>
    </article>
  );
}

function SpecialCard({ state, today }: { state: AppState; today: ISODate }) {
  const s = state.settings;
  const progress = allSegmentProgress(s, state.days, today);
  const st = specialStatus(s, progress, today);
  const [edit, setEdit] = useState(false);
  const sp = s.special;

  if (edit) return <SpecialEditor sp={sp} start={s.startDate} onDone={() => setEdit(false)} />;
  if (!sp)
    return (
      <button type="button" className="btn block" style={{ marginTop: 10 }} onClick={() => setEdit(true)}>
        <Icon name="target" size={18} /> Agregar un premio especial con fecha
      </button>
    );

  return (
    <section className={`card special ${st.kind === 'available' ? 'ready' : ''}`} aria-label="Premio especial">
      <div className="reward-head">
        <div>
          <div className="goal-eyebrow">Premio especial</div>
          <div className="card-title">{sp.name}</div>
          {sp.date && <div className="reward-dates">{formatLong(sp.date)}</div>}
        </div>
        <button type="button" className="icon-btn" aria-label="Editar premio especial" onClick={() => setEdit(true)}>
          <Icon name="sliders" size={18} />
        </button>
      </div>
      {st.kind === 'claimed' ? (
        <div className="claimed-note">
          <Icon name="check" size={16} /> Reclamado el {formatShort(localDateOf(st.claimedAt))}
        </div>
      ) : st.kind === 'available' ? (
        <button
          type="button"
          className="btn gold block"
          style={{ marginTop: 12 }}
          onClick={() => {
            actions.claimSpecial();
            celebrate('week');
            toast(`¡${sp.name}! Te lo ganaste.`, 'reward');
          }}
        >
          <Icon name="gift" size={18} /> Reclamar
        </button>
      ) : st.kind === 'locked' ? (
        <>
          <div className="reward-progress">
            <div className="bar">
              <i style={{ width: `${Math.min(100, (st.weeksWon / Math.max(1, st.required)) * 100)}%` }} />
            </div>
            {st.weeksWon}/{st.required} semanas
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            Se desbloquea desde el {formatLong(st.unlockDate)} con {st.required} semanas ganadas.
          </p>
        </>
      ) : null}
    </section>
  );
}

function SpecialEditor({ sp, start, onDone }: { sp: SpecialPrize | null; start: ISODate; onDone: () => void }) {
  const [name, setName] = useState(sp?.name ?? '');
  const [date, setDate] = useState(sp?.date ?? '');
  const [unlock, setUnlock] = useState(sp?.unlockDate ?? start);
  const [weeks, setWeeks] = useState(String(sp?.requiredWeeks ?? 2));
  const valid = name.trim() && isValidISODate(unlock);
  return (
    <section className="card special">
      <div className="card-title">Premio especial</div>
      <p>Un premio con fecha, por ejemplo un viaje. Se desbloquea desde una fecha si ganaste las semanas que pongas.</p>
      <label className="lbl-field">
        Nombre
        <input className="field" value={name} maxLength={60} placeholder="Ej.: Vuelo a…" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="lbl-field">
        Fecha del premio (opcional)
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="lbl-field">
        Se desbloquea desde
        <input className="field" type="date" value={unlock} onChange={(e) => setUnlock(e.target.value)} />
      </label>
      <label className="lbl-field">
        Semanas ganadas necesarias
        <input className="field" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      </label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!valid}
          onClick={() => {
            const next: SpecialPrize = { name: name.trim(), unlockDate: unlock, requiredWeeks: Math.min(13, Number(weeks || 0)) };
            if (isValidISODate(date)) next.date = date;
            if (sp?.claimedAt) next.claimedAt = sp.claimedAt;
            actions.setSpecial(next);
            toast('Premio especial guardado.', 'success');
            onDone();
          }}
        >
          Guardar
        </button>
      </div>
    </section>
  );
}
