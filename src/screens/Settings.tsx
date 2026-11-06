import { useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { checkForUpdate } from '../components/UpdateBanner';
import { ConfirmDialog, ScreenHeader, SectionTitle } from '../components/ui';
import { canShareFiles, downloadBackup, parseBackup, shareBackup } from '../lib/backup';
import { MAX_EXTRAS } from '../lib/config';
import { diffDays, formatLong, formatShort, isValidISODate, localDateOf, nextMonday, plural, weekday, type ISODate } from '../lib/dates';
import { cyclePhase } from '../lib/engine';
import { toast } from '../lib/feedback';
import { useInstallPrompt } from '../lib/hooks';
import { buildReport } from '../lib/report';
import { actions, getState } from '../lib/store';
import type { AppState, Habit, Settings, Theme } from '../lib/types';

type Pending =
  | { kind: 'start'; date: ISODate }
  | { kind: 'restart'; date: ISODate }
  | { kind: 'restore'; state: AppState }
  | { kind: 'reset' }
  | { kind: 'remove'; habit: Habit }
  | null;

export function SettingsScreen({ state, today }: { state: AppState; today: ISODate }) {
  const s = state.settings as Settings;
  const [pending, setPending] = useState<Pending>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { installed, canInstall, install } = useInstallPrompt();
  const phase = cyclePhase(s, today);
  const restartDate = weekday(today) === 1 ? today : nextMonday(today);
  const shareFiles = canShareFiles();

  const report = buildReport({ settings: s, days: state.days, rewards: state.rewards }, today);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast('Reporte copiado. Pégalo en Claude.', 'success');
    } catch {
      toast('No se pudo copiar. Usa "Compartir".', 'error');
    }
  };

  const shareReport = async () => {
    try {
      await navigator.share({ text: report, title: 'Reporte · Val quirúrgico' });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) void copyReport();
    }
  };

  const backupNow = async (mode: 'share' | 'download') => {
    try {
      if (mode === 'share') {
        const r = await shareBackup(getState());
        if (r === 'cancelled') return;
      } else downloadBackup(getState());
      actions.markBackup();
      toast('Respaldo listo.', 'success');
    } catch {
      toast('No se pudo crear el respaldo.', 'error');
    }
  };

  const onFile = async (file: File) => {
    try {
      setPending({ kind: 'restore', state: parseBackup(await file.text()) });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Archivo inválido.', 'error');
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
      <ScreenHeader eyebrow="Ajustes" title="Tu configuración" subtitle="Todo se guarda solo en este teléfono." />

      <SectionTitle>Ciclo</SectionTitle>
      <div className="group">
        <Item title="Inicio del ciclo" note={formatLong(s.startDate)}>
          <input
            className="field"
            type="date"
            value={s.startDate}
            onChange={(e) => {
              const v = e.target.value;
              if (isValidISODate(v) && v !== s.startDate) setPending({ kind: 'start', date: v });
            }}
            aria-label="Fecha de inicio del ciclo"
          />
        </Item>
        <Item title="Meta semanal" note={`${s.weeklyGoal} de 7 días completos para ganar el premio`}>
          <div className="stepper">
            <button type="button" aria-label="Bajar meta" disabled={s.weeklyGoal <= 4} onClick={() => actions.setWeeklyGoal(s.weeklyGoal - 1)}>
              −
            </button>
            <output aria-live="polite">{s.weeklyGoal}</output>
            <button type="button" aria-label="Subir meta" disabled={s.weeklyGoal >= 7} onClick={() => actions.setWeeklyGoal(s.weeklyGoal + 1)}>
              +
            </button>
          </div>
        </Item>
        <Item
          title="Empezar un ciclo nuevo"
          note={phase === 'finished' ? `Tu ciclo terminó. El nuevo empezaría el ${formatLong(restartDate)}.` : 'Reinicia semanas y premios. Tus hábitos se conservan.'}
        >
          <button type="button" className="btn sm" onClick={() => setPending({ kind: 'restart', date: restartDate })}>
            Nuevo
          </button>
        </Item>
      </div>

      <SectionTitle>Las 3 rachas · núcleo</SectionTitle>
      <div className="group">
        {s.core.map((h, i) => (
          <div key={h.id} className="habit-edit">
            <div className="tag">Racha {i + 1}</div>
            <TextField value={h.name} label={`Nombre de la racha ${i + 1}`} onCommit={(name) => name && actions.updateHabit('core', h.id, { name })} />
            <TextField
              value={h.min ?? ''}
              label={`Versión mínima de la racha ${i + 1}`}
              placeholder="Versión mínima para un día malo"
              onCommit={(min) => actions.updateHabit('core', h.id, { min })}
            />
          </div>
        ))}
      </div>

      <SectionTitle aside={`${s.extras.length}/${MAX_EXTRAS}`}>Secundarios</SectionTitle>
      <div className="group">
        {s.extras.map((h, i) => (
          <div key={h.id} className="extra-edit">
            <TextField value={h.name} label={`Hábito secundario ${i + 1}`} onCommit={(name) => name && actions.updateHabit('extra', h.id, { name })} />
            <button type="button" className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => actions.moveExtra(h.id, -1)}>
              <Icon name="chevronUp" size={20} />
            </button>
            <button type="button" className="icon-btn danger" aria-label={`Quitar ${h.name}`} onClick={() => setPending({ kind: 'remove', habit: h })}>
              <Icon name="trash" size={19} />
            </button>
          </div>
        ))}
        {s.extras.length < MAX_EXTRAS && <AddExtra />}
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
      <div className="group">
        <div className="item col">
          <div className="txt">
            <b>Tu resumen de la semana</b>
            <span>Cópialo o compártelo con Claude y recibe un análisis de cómo vas.</span>
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => void copyReport()}>
              <Icon name="copy" size={18} /> Copiar
            </button>
            <button type="button" className="btn" onClick={() => void shareReport()}>
              <Icon name="share" size={18} /> Compartir
            </button>
          </div>
          <details>
            <summary>Ver el reporte</summary>
            <pre className="report-preview">{report}</pre>
          </details>
        </div>
      </div>

      <SectionTitle>Respaldo</SectionTitle>
      <div className="group">
        <div className="item col">
          <div className="txt">
            <b>Copia de seguridad</b>
            <span>{lastBackupText} Guárdala en Google Drive para no perder tu avance si cambias de teléfono.</span>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {shareFiles && (
              <button type="button" className="btn primary block" onClick={() => void backupNow('share')}>
                <Icon name="share" size={18} /> Guardar en Drive o compartir
              </button>
            )}
            <button type="button" className={`btn block ${shareFiles ? '' : 'primary'}`} onClick={() => void backupNow('download')}>
              <Icon name="download" size={18} /> Descargar archivo
            </button>
            <button type="button" className="btn block" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={18} /> Restaurar desde archivo
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <SectionTitle>App</SectionTitle>
      <div className="group">
        <Item
          title={installed ? 'Instalada en tu teléfono' : 'Instalar en tu teléfono'}
          note={
            installed
              ? 'Ábrela desde su ícono. Funciona sin internet.'
              : canInstall
                ? 'Queda con su propio ícono y funciona sin internet.'
                : 'En Chrome: menú ⋮ → «Instalar aplicación».'
          }
        >
          {canInstall ? (
            <button type="button" className="btn primary sm" onClick={() => void install()}>
              <Icon name="phone" size={17} /> Instalar
            </button>
          ) : installed ? (
            <Icon name="check" className="muted" />
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

      <SectionTitle>Zona de cuidado</SectionTitle>
      <div className="group">
        <Item title="Borrar todos mis datos" note="Elimina marcas, premios y ajustes de este teléfono.">
          <button type="button" className="btn danger sm" onClick={() => setPending({ kind: 'reset' })}>
            Borrar
          </button>
        </Item>
      </div>

      <p className="fine">Val quirúrgico · tus datos no salen de este teléfono.</p>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        {...confirmContent(pending, s)}
        onConfirm={() => {
          if (!pending) return;
          if (pending.kind === 'start') {
            actions.setStartDate(pending.date);
            toast('Fecha de inicio actualizada.');
          } else if (pending.kind === 'restart') {
            actions.restartCycle(pending.date);
            toast('Ciclo nuevo listo.', 'success');
          } else if (pending.kind === 'restore') {
            actions.replaceAll(pending.state);
            toast('Respaldo restaurado.', 'success');
          } else if (pending.kind === 'reset') {
            void actions.resetAll();
          } else if (pending.kind === 'remove') {
            actions.removeExtra(pending.habit.id);
            toast(`Quitaste «${pending.habit.name}».`);
          }
        }}
      />
    </>
  );
}

function confirmContent(p: Pending, s: Settings): { title: string; body: ReactNode; confirmLabel: string; danger?: boolean } {
  switch (p?.kind) {
    case 'start':
      return {
        title: 'Cambiar la fecha de inicio',
        body: `El ciclo empezaría el ${formatLong(p.date)}. Las semanas se recalculan; tus marcas se conservan por fecha.`,
        confirmLabel: 'Cambiar',
      };
    case 'restart':
      return {
        title: 'Empezar un ciclo nuevo',
        body: `El nuevo ciclo de ${s.cycleLength} días empezaría el ${formatLong(p.date)}. Los premios se reinician; tus hábitos se conservan. Haz un respaldo antes si quieres guardar el ciclo actual.`,
        confirmLabel: 'Empezar',
      };
    case 'restore':
      return {
        title: 'Restaurar respaldo',
        body: 'Esto reemplaza todos los datos actuales de este teléfono por los del archivo.',
        confirmLabel: 'Restaurar',
        danger: true,
      };
    case 'reset':
      return {
        title: '¿Borrar todo?',
        body: 'Se eliminan tus marcas, premios y ajustes. No se puede deshacer, salvo que tengas un respaldo.',
        confirmLabel: 'Borrar todo',
        danger: true,
      };
    case 'remove':
      return {
        title: `Quitar «${p.habit.name}»`,
        body: 'Deja de aparecer en tu lista diaria. Lo que ya marcaste queda guardado.',
        confirmLabel: 'Quitar',
        danger: true,
      };
    default:
      return { title: '', body: '', confirmLabel: 'Aceptar' };
  }
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
        placeholder="Nuevo hábito secundario"
        aria-label="Nuevo hábito secundario"
        enterKeyHint="done"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <button type="button" className="btn primary" aria-label="Agregar hábito" onClick={add} disabled={!name.trim()}>
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}
