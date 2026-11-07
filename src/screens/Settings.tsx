import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { PatternPad } from '../components/PatternPad';
import { ReportCard } from '../components/ReportCard';
import { checkForUpdate } from '../components/UpdateBanner';
import { ConfirmDialog, ScreenHeader, SectionTitle } from '../components/ui';
import { canShareFiles, downloadBackupText, parseBackup, serializeBackup, shareBackupText } from '../lib/backup';
import { AUTOLOCK_OPTIONS, MAX_EXTRAS, defaultExam } from '../lib/config';
import { diffDays, formatLong, formatShort, isValidISODate, localDateOf, nextMonday, plural, weekday, type ISODate } from '../lib/dates';
import { cyclePhase, habitLabel } from '../lib/engine';
import { toast } from '../lib/feedback';
import { useInstallPrompt } from '../lib/hooks';
import { buildReport } from '../lib/report';
import {
  actions,
  biometricSupport,
  changePattern,
  currentBackup,
  disableBiometric,
  enableBiometric,
  lock,
  openBackup,
  replaceState,
  verifyPattern,
} from '../lib/store';
import type { AppState, Habit, Theme } from '../lib/types';
import type { VaultRecord } from '../lib/vault';

type Pending = { kind: 'start'; date: ISODate } | { kind: 'restart'; date: ISODate } | { kind: 'restore'; state: AppState } | null;
type Overlay = { kind: 'pattern' } | { kind: 'backup'; record: Pick<VaultRecord, 'lock' | 'data'> } | null;

export function SettingsScreen({ state, today, hasBio }: { state: AppState; today: ISODate; hasBio: boolean }) {
  const s = state.settings;
  const [pending, setPending] = useState<Pending>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [bioSupport, setBioSupport] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { installed, canInstall, install } = useInstallPrompt();
  const shareFiles = canShareFiles();
  const phase = cyclePhase(s, today);
  const restartDate = weekday(today) === weekday(s.startDate) ? today : nextMonday(today);
  const report = buildReport(state, today);

  useEffect(() => {
    void biometricSupport().then(setBioSupport);
  }, []);

  const backupText = async () => {
    const rec = await currentBackup();
    return rec ? serializeBackup(rec) : null;
  };

  const doBackup = async (mode: 'share' | 'download' | 'copy') => {
    try {
      const text = await backupText();
      if (!text) return;
      if (mode === 'share') {
        if ((await shareBackupText(text)) === 'cancelled') return;
      } else if (mode === 'download') downloadBackupText(text);
      else await navigator.clipboard.writeText(text);
      actions.markBackup();
      toast(mode === 'copy' ? 'Respaldo copiado. Pégalo en una nota o en WhatsApp.' : 'Respaldo listo.', 'success');
    } catch {
      toast('No se pudo crear el respaldo. Prueba con «Copiar».', 'error');
    }
  };

  const readBackup = (text: string) => {
    try {
      setOverlay({ kind: 'backup', record: parseBackup(text) });
      setPaste(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Respaldo inválido.', 'error');
    }
  };

  const lastBackup = s.lastBackupAt ? localDateOf(s.lastBackupAt) : null;
  const lastBackupText = !lastBackup
    ? 'Todavía no hiciste ningún respaldo.'
    : lastBackup === today
      ? 'Último respaldo: hoy.'
      : `Último respaldo: hace ${plural(diffDays(lastBackup, today), 'día', 'días')} (${formatShort(lastBackup)}).`;

  return (
    <>
      <ScreenHeader eyebrow="Ajustes" title="Tu configuración" subtitle="Cifrada y guardada solo en este teléfono." />

      <SectionTitle>Seguridad</SectionTitle>
      <div className="group">
        <Item
          title="Entrar con huella"
          note={
            hasBio
              ? 'Activada. El patrón sigue sirviendo si la huella falla.'
              : bioSupport === 'no'
                ? 'Tu teléfono o tu Chrome no lo permiten. Sigue con tu patrón.'
                : 'Más rápido que el patrón. Tus datos siguen cifrados.'
          }
        >
          {hasBio ? (
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                await disableBiometric();
                toast('Huella desactivada.');
              }}
            >
              Quitar
            </button>
          ) : bioSupport !== 'no' ? (
            <button
              type="button"
              className="btn primary sm"
              onClick={async () => {
                try {
                  await enableBiometric();
                  toast('Huella activada.', 'success');
                } catch (e) {
                  const m = e instanceof Error ? e.message : '';
                  toast(m === 'NOPRF' ? 'Tu teléfono no permite usar la huella aquí.' : 'No se activó la huella.', 'error');
                  if (m === 'NOPRF') setBioSupport('no');
                }
              }}
            >
              <Icon name="fingerprint" size={17} /> Activar
            </button>
          ) : null}
        </Item>
        <Item title="Cambiar patrón">
          <button type="button" className="btn sm" onClick={() => setOverlay({ kind: 'pattern' })}>
            Cambiar
          </button>
        </Item>
        <div className="item col">
          <div className="txt">
            <b>Pedir el patrón</b>
            <span>Cuando sales de la app y vuelves.</span>
          </div>
          <div className="segmented" role="group" aria-label="Bloqueo automático" style={{ marginTop: 10 }}>
            {AUTOLOCK_OPTIONS.map((m) => (
              <button key={m} type="button" aria-pressed={s.autoLockMinutes === m} onClick={() => actions.setAutoLock(m)}>
                {m === 0 ? 'Al salir' : `${m} min`}
              </button>
            ))}
          </div>
        </div>
        <Item title="Bloquear ahora">
          <button type="button" className="btn sm" onClick={lock}>
            <Icon name="lock" size={16} /> Bloquear
          </button>
        </Item>
      </div>

      <SectionTitle>Ciclo</SectionTitle>
      <div className="group">
        <Item title="Inicio del ciclo" note={`${formatLong(s.startDate)} · ${s.cycleLength} días`}>
          <input
            className="field"
            type="date"
            value={s.startDate}
            aria-label="Fecha de inicio del ciclo"
            onChange={(e) => {
              const v = e.target.value;
              if (isValidISODate(v) && v !== s.startDate) setPending({ kind: 'start', date: v });
            }}
          />
        </Item>
        <div className="item col">
          <div className="item-row">
            <div className="txt">
              <b>Modo examen</b>
              <span>{s.exam ? `Del ${formatShort(s.exam.from)} al ${formatShort(s.exam.to)}: solo cuenta el núcleo.` : 'Desactivado.'}</span>
            </div>
            <button
              type="button"
              className={`switch ${s.exam ? 'on' : ''}`}
              role="switch"
              aria-checked={Boolean(s.exam)}
              aria-label="Modo examen"
              onClick={() => actions.setExam(s.exam ? null : defaultExam(s.startDate))}
            >
              <i />
            </button>
          </div>
          {s.exam && (
            <div className="row2" style={{ marginTop: 10 }}>
              <label className="lbl-field">
                Desde
                <input
                  className="field"
                  type="date"
                  value={s.exam.from}
                  onChange={(e) => isValidISODate(e.target.value) && e.target.value <= s.exam!.to && actions.setExam({ ...s.exam!, from: e.target.value })}
                />
              </label>
              <label className="lbl-field">
                Hasta
                <input
                  className="field"
                  type="date"
                  value={s.exam.to}
                  onChange={(e) => isValidISODate(e.target.value) && e.target.value >= s.exam!.from && actions.setExam({ ...s.exam!, to: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>
        <Stepper title="Meta del día" note={`Ganas el día con ${s.dayGoal}% o más`} value={s.dayGoal} min={50} max={90} step={5} suffix="%" onChange={(v) => actions.setNumber('dayGoal', v)} />
        <Stepper
          title="Peso del núcleo"
          note={`Núcleo ${s.coreWeight}% · secundarios ${100 - s.coreWeight}%`}
          value={s.coreWeight}
          min={40}
          max={80}
          step={5}
          suffix="%"
          onChange={(v) => actions.setNumber('coreWeight', v)}
        />
        <Stepper title="Meta semanal" note={`${s.weeklyGoal} de 7 días ganados`} value={s.weeklyGoal} min={4} max={7} step={1} onChange={(v) => actions.setNumber('weeklyGoal', v)} />
        <Item title="Empezar un ciclo nuevo" note={phase === 'finished' ? 'Tu ciclo terminó.' : 'Reinicia semanas, cofres y canjes. Tus hábitos se conservan.'}>
          <button type="button" className="btn sm" onClick={() => setPending({ kind: 'restart', date: restartDate })}>
            Nuevo
          </button>
        </Item>
      </div>

      <SectionTitle>Núcleo</SectionTitle>
      <div className="group">
        {s.core.map((h, i) => (
          <div key={h.id} className="habit-edit">
            <div className="tag">Núcleo {i + 1}</div>
            <TextField value={h.name} label={`Nombre del núcleo ${i + 1}`} onCommit={(name) => name && actions.updateHabit('core', h.id, { name })} />
            <TextField value={h.min ?? ''} label={`Versión mínima del núcleo ${i + 1}`} placeholder="Versión mínima para un día malo" onCommit={(min) => actions.updateHabit('core', h.id, { min })} />
          </div>
        ))}
      </div>

      <SectionTitle aside={`${s.extras.length}/${MAX_EXTRAS}`}>Secundarios</SectionTitle>
      <div className="group">
        {s.extras.map((h, i) => (
          <div key={h.id} className="extra-edit">
            <TextField
              value={h.levels ? habitLabel(h, s.startDate, today) : h.name}
              label={`Secundario ${i + 1}`}
              onCommit={(name) => name && name !== habitLabel(h, s.startDate, today) && actions.updateHabit('extra', h.id, { name })}
            />
            <button type="button" className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => actions.moveExtra(h.id, -1)}>
              <Icon name="chevronUp" size={20} />
            </button>
            <button type="button" className="icon-btn" aria-label={`Guardar ${h.name} para vacaciones`} onClick={() => actions.toVacation(h.id)}>
              <Icon name="pause" size={18} />
            </button>
          </div>
        ))}
        {s.extras.length < MAX_EXTRAS && <AddExtra />}
      </div>
      <p className="fine" style={{ marginTop: 8, textAlign: 'left' }}>
        <Icon name="pause" size={13} /> guarda un hábito para vacaciones: deja de contar y su historial se conserva.
      </p>

      {s.vacation.length > 0 && (
        <>
          <SectionTitle>Para vacaciones</SectionTitle>
          <div className="group">
            {s.vacation.map((h: Habit) => (
              <div key={h.id} className="item">
                <div className="txt">
                  <b>{h.name}</b>
                  <span>Guardado. No cuenta hasta que lo actives.</span>
                </div>
                <button type="button" className="btn sm" disabled={s.extras.length >= MAX_EXTRAS} onClick={() => actions.fromVacation(h.id)}>
                  Activar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Premios</SectionTitle>
      <div className="group">
        <Stepper title="Por semana ganada" note={`Cada semana ganada suma Bs ${s.fundPerWeek} a tu fondo`} value={s.fundPerWeek} min={50} max={300} step={10} prefix="Bs " onChange={(v) => actions.setNumber('fundPerWeek', v)} />
      </div>

      <SectionTitle>Apariencia</SectionTitle>
      <div className="group">
        <div className="item col">
          <div className="segmented" role="group" aria-label="Tema">
            {(
              [
                ['system', 'Automático'],
                ['dark', 'Oscuro'],
                ['light', 'Claro'],
              ] as [Theme, string][]
            ).map(([t, label]) => (
              <button key={t} type="button" aria-pressed={s.theme === t} onClick={() => actions.setTheme(t)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SectionTitle>Reporte para Claude</SectionTitle>
      <ReportCard state={state} today={today} report={report} />

      <SectionTitle>Respaldo</SectionTitle>
      <div className="group">
        <div className="item col">
          <div className="txt">
            <b>Copia de seguridad cifrada</b>
            <span>{lastBackupText} Se abre solo con tu patrón. Guárdala en Drive por si cambias de teléfono.</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {shareFiles && (
              <button type="button" className="btn primary block" onClick={() => void doBackup('share')}>
                <Icon name="share" size={18} /> Guardar en Drive o compartir
              </button>
            )}
            <button type="button" className={`btn block ${shareFiles ? '' : 'primary'}`} onClick={() => void doBackup('download')}>
              <Icon name="download" size={18} /> Guardar en el celular
            </button>
            <button type="button" className="btn block" onClick={() => void doBackup('copy')}>
              <Icon name="copy" size={18} /> Copiar respaldo
            </button>
            <button type="button" className="btn ghost block" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={18} /> Restaurar desde archivo
            </button>
            <button type="button" className="btn ghost block" onClick={() => setPaste(paste === null ? '' : null)}>
              Restaurar pegando el texto
            </button>
            {paste !== null && (
              <div className="paste-box">
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Pega aquí el texto del respaldo" aria-label="Texto del respaldo" spellCheck={false} />
                <button type="button" className="btn primary block" disabled={!paste.trim()} onClick={() => readBackup(paste)}>
                  Usar este respaldo
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="text/plain,.txt,application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) readBackup(await f.text());
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <SectionTitle>App</SectionTitle>
      <div className="group">
        <Item
          title={installed ? 'Instalada en tu teléfono' : 'Instalar en tu teléfono'}
          note={installed ? 'Ábrela desde su ícono. Funciona sin internet.' : canInstall ? 'Queda con su ícono y funciona sin internet.' : 'En Chrome: menú ⋮ → «Instalar aplicación».'}
        >
          {canInstall ? (
            <button type="button" className="btn primary sm" onClick={() => void install()}>
              <Icon name="phone" size={17} /> Instalar
            </button>
          ) : null}
        </Item>
        <Item title="Actualizaciones" note={`Versión ${__APP_VERSION__}`}>
          <button
            type="button"
            className="btn sm"
            onClick={async () => {
              const found = await checkForUpdate().catch(() => false);
              toast(found ? 'Descargando la versión nueva…' : 'Ya tienes la última versión.');
            }}
          >
            <Icon name="refresh" size={17} /> Buscar
          </button>
        </Item>
      </div>

      <p className="fine">Val quirúrgico · tus datos están cifrados y no salen de este teléfono.</p>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        {...confirmContent(pending, s.cycleLength)}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === 'start') {
            actions.setStartDate(pending.date);
            toast('Fecha de inicio actualizada.');
          } else if (pending.kind === 'restart') {
            actions.restartCycle(pending.date);
            toast('Ciclo nuevo listo.', 'success');
          } else if (pending.kind === 'restore') {
            replaceState(pending.state);
            toast('Respaldo restaurado. Sigues con tu patrón actual.', 'success');
          }
        }}
      />

      {overlay?.kind === 'pattern' && <ChangePattern onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'backup' && (
        <BackupPattern
          record={overlay.record}
          onClose={() => setOverlay(null)}
          onOpened={(st) => {
            setOverlay(null);
            setPending({ kind: 'restore', state: st });
          }}
        />
      )}
    </>
  );
}

function confirmContent(p: Pending, cycleLength: number): { title: string; body: ReactNode; confirmLabel: string; danger?: boolean } {
  switch (p?.kind) {
    case 'start':
      return { title: 'Cambiar la fecha de inicio', body: `Tu ciclo empezaría el ${formatLong(p.date)}. Las semanas se recalculan; tus marcas se conservan por fecha.`, confirmLabel: 'Cambiar' };
    case 'restart':
      return {
        title: 'Empezar un ciclo nuevo',
        body: `El nuevo ciclo de ${cycleLength} días empezaría el ${formatLong(p.date)}. Se reinician las semanas, los cofres y los canjes; tus hábitos se conservan. Haz un respaldo antes si quieres guardar este ciclo.`,
        confirmLabel: 'Empezar',
      };
    case 'restore':
      return { title: 'Restaurar respaldo', body: 'Esto reemplaza todos los datos actuales por los del respaldo.', confirmLabel: 'Restaurar', danger: true };
    default:
      return { title: '', body: '', confirmLabel: 'Aceptar' };
  }
}

function ChangePattern({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'current' | 'new' | 'repeat'>('current');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState<string>();
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const title = step === 'current' ? 'Tu patrón actual' : step === 'new' ? 'Nuevo patrón' : 'Repite el nuevo patrón';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Cambiar patrón">
      <button type="button" className="icon-btn overlay-close" aria-label="Cerrar" onClick={onClose}>
        <Icon name="x" />
      </button>
      <main className="lock">
        <h1>{title}</h1>
        <PatternPad
          key={step}
          resetKey={reset}
          error={Boolean(err)}
          disabled={busy}
          onComplete={async (p) => {
            if (step === 'current') {
              setBusy(true);
              const ok = await verifyPattern(p);
              setBusy(false);
              if (!ok) {
                setErr('Patrón incorrecto.');
                setReset((r) => r + 1);
                return;
              }
              setErr(undefined);
              setStep('new');
            } else if (step === 'new') {
              setFirst(p);
              setStep('repeat');
            } else if (p !== first) {
              setErr('No coincide. Dibuja otra vez el nuevo patrón.');
              setStep('new');
            } else {
              setBusy(true);
              await changePattern(p);
              toast('Patrón actualizado. Haz un respaldo nuevo.', 'success');
              onClose();
            }
          }}
        />
        <p className="pin-error" role="alert">
          {busy ? 'Un momento…' : (err ?? '')}
        </p>
      </main>
    </div>
  );
}

function BackupPattern({ record, onClose, onOpened }: { record: Pick<VaultRecord, 'lock' | 'data'>; onClose: () => void; onOpened: (s: AppState) => void }) {
  const [err, setErr] = useState<string>();
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Patrón del respaldo">
      <button type="button" className="icon-btn overlay-close" aria-label="Cerrar" onClick={onClose}>
        <Icon name="x" />
      </button>
      <main className="lock">
        <h1>Patrón del respaldo</h1>
        <p>El que tenías cuando hiciste este respaldo.</p>
        <PatternPad
          resetKey={reset}
          error={Boolean(err)}
          disabled={busy}
          onComplete={async (p) => {
            setBusy(true);
            const st = await openBackup(record, p);
            setBusy(false);
            if (!st) {
              setErr('Patrón incorrecto.');
              setReset((r) => r + 1);
              return;
            }
            onOpened(st);
          }}
        />
        <p className="pin-error" role="alert">
          {busy ? 'Abriendo…' : (err ?? '')}
        </p>
      </main>
    </div>
  );
}

function Item({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="item">
      <div className="txt">
        <b>{title}</b>
        {note && <span>{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Stepper(props: { title: string; note: string; value: number; min: number; max: number; step: number; prefix?: string; suffix?: string; onChange: (v: number) => void }) {
  const { title, note, value, min, max, step, prefix = '', suffix = '', onChange } = props;
  return (
    <Item title={title} note={note}>
      <div className="stepper">
        <button type="button" aria-label={`Bajar ${title}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <output aria-live="polite">
          {prefix}
          {value}
          {suffix}
        </output>
        <button type="button" aria-label={`Subir ${title}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
      </div>
    </Item>
  );
}

function TextField({ value, label, placeholder, onCommit }: { value: string; label: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setV(value);
  }
  return (
    <input
      className="field"
      type="text"
      value={v}
      maxLength={label.includes('mínima') ? 140 : 80}
      placeholder={placeholder}
      aria-label={label}
      enterKeyHint="done"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const clean = v.trim();
        if (clean !== value) onCommit(clean);
        if (!clean && !placeholder) setV(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function AddExtra() {
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    actions.addExtra(name);
    setName('');
    toast('Hábito agregado.');
  };
  return (
    <div className="add-row">
      <input
        className="field"
        type="text"
        value={name}
        maxLength={80}
        placeholder="Nuevo secundario"
        aria-label="Nuevo secundario"
        enterKeyHint="done"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <button type="button" className="btn primary" aria-label="Agregar hábito" onClick={add} disabled={!name.trim()}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}
