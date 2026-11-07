import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { InstallCard } from '../components/InstallCard';
import { PatternPad } from '../components/PatternPad';
import { parseBackup } from '../lib/backup';
import { APP_NAME, LEMA, defaultExam } from '../lib/config';
import { addDays, formatLong, formatRange, isValidISODate, nextMonday, type ISODate } from '../lib/dates';
import { toast } from '../lib/feedback';
import { createVault, initialState, openBackup } from '../lib/store';
import type { ExamPeriod } from '../lib/types';
import type { VaultRecord } from '../lib/vault';

type Step = 'welcome' | 'start' | 'exam' | 'pattern' | 'pattern2' | 'restore' | 'restorePattern';
type StartChoice = 'today' | 'tomorrow' | 'monday' | 'custom';

export function Onboarding({ today, updateBanner }: { today: ISODate; updateBanner?: ReactNode }) {
  const [step, setStep] = useState<Step>('welcome');
  const tomorrow = addDays(today, 1);
  const monday = nextMonday(today);
  const [choice, setChoice] = useState<StartChoice>('tomorrow');
  const [custom, setCustom] = useState<ISODate>(tomorrow);
  const start = choice === 'today' ? today : choice === 'tomorrow' ? tomorrow : choice === 'monday' ? monday : custom;
  const [examOn, setExamOn] = useState(true);
  const [examTo, setExamTo] = useState<ISODate>(() => defaultExam(tomorrow).to);
  const [first, setFirst] = useState('');
  const [err, setErr] = useState<string>();
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');
  const [backup, setBackup] = useState<Pick<VaultRecord, 'lock' | 'data'> | null>(null);

  const exam: ExamPeriod | null = examOn && isValidISODate(examTo) && examTo >= start ? { from: start, to: examTo } : null;

  const finish = async (pattern: string) => {
    setBusy(true);
    await createVault(pattern, initialState(start, exam));
    toast('Listo. Tu Val Q está protegida.', 'success');
  };

  const readBackup = (text: string) => {
    try {
      setBackup(parseBackup(text));
      setErr(undefined);
      setStep('restorePattern');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Respaldo inválido.', 'error');
    }
  };

  if (step === 'welcome') {
    return (
      <main className="onb">
        {updateBanner}
        <img className="onb-logo" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={68} height={68} />
        <div>
          <h1>{APP_NAME}</h1>
          <p className="lema">{LEMA}</p>
        </div>
        <InstallCard appName="Val Q" />
        <ul className="pillars">
          <li>
            <span className="pi">
              <Icon name="flame" />
            </span>
            <div>
              <b>4 rachas núcleo</b>
              <span>Dormir, rutina de la mañana, gym y estudio profundo. Con versión mínima para los días malos.</span>
            </div>
          </li>
          <li>
            <span className="pi">
              <Icon name="target" />
            </span>
            <div>
              <b>Gana el día con 65%</b>
              <span>El núcleo vale 60% y tus secundarios 40%. Gana la semana con 6 de 7 días.</span>
            </div>
          </li>
          <li>
            <span className="pi">
              <Icon name="wallet" />
            </span>
            <div>
              <b>Fondo de premios</b>
              <span>Cada semana ganada suma 100 Bs. Canjéalos por los premios de tu lista, con cofres y comodines.</span>
            </div>
          </li>
          <li>
            <span className="pi">
              <Icon name="fingerprint" />
            </span>
            <div>
              <b>Solo tuya</b>
              <span>Protegida con patrón y huella, y cifrada en este teléfono.</span>
            </div>
          </li>
        </ul>
        <div className="stack">
          <button type="button" className="btn primary block" onClick={() => setStep('start')}>
            Empezar
          </button>
          <button type="button" className="btn ghost block" onClick={() => setStep('restore')}>
            <Icon name="upload" size={18} /> Restaurar un respaldo
          </button>
        </div>
      </main>
    );
  }

  if (step === 'start') {
    const valid = isValidISODate(start);
    const options: [StartChoice, string, string][] = [
      ['today', 'Hoy', formatLong(today)],
      ['tomorrow', 'Mañana', formatLong(tomorrow)],
    ];
    if (monday !== tomorrow) options.push(['monday', `El lunes ${formatLong(monday).split(' ').slice(1).join(' ')}`, 'Cada semana va de lunes a domingo.']);
    return (
      <main className="onb">
        <StepDots step={1} />
        <div>
          <h1 className="onb-title">¿Cuándo empiezas?</h1>
          <p className="muted">Tu ciclo dura 90 días. Cada semana empieza el mismo día de la semana que tu inicio.</p>
        </div>
        <section>
          {options.map(([id, title, sub]) => (
            <button key={id} type="button" className="choice" aria-pressed={choice === id} onClick={() => setChoice(id)}>
              <span className="radio" />
              <div>
                <b>{title}</b>
                <span>{sub}</span>
              </div>
            </button>
          ))}
          <button type="button" className="choice" aria-pressed={choice === 'custom'} onClick={() => setChoice('custom')}>
            <span className="radio" />
            <div>
              <b>Otra fecha</b>
              <span>{choice === 'custom' && isValidISODate(custom) ? formatLong(custom) : 'Elige el día de inicio'}</span>
            </div>
          </button>
          {choice === 'custom' && (
            <input className="field" style={{ marginTop: 8 }} type="date" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Fecha de inicio" />
          )}
        </section>
        {valid && <p className="fine">Ciclo: {formatRange(start, addDays(start, 89))}.</p>}
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setStep('welcome')}>
            Atrás
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              setExamTo(defaultExam(start).to);
              setStep('exam');
            }}
          >
            Siguiente
          </button>
        </div>
      </main>
    );
  }

  if (step === 'exam') {
    return (
      <main className="onb">
        <StepDots step={2} />
        <div>
          <h1 className="onb-title">¿Estás en exámenes?</h1>
          <p className="muted">En modo examen solo cuenta el núcleo: ganas el día con 3 de 4. Tus secundarios suman en el historial, pero no te restan.</p>
        </div>
        <section>
          <button type="button" className="choice" aria-pressed={examOn} onClick={() => setExamOn(true)}>
            <span className="radio" />
            <div>
              <b>Sí, hasta el…</b>
              <span>{isValidISODate(examTo) ? formatLong(examTo) : 'Elige la fecha'}</span>
            </div>
          </button>
          {examOn && (
            <input
              className="field"
              style={{ marginTop: 8 }}
              type="date"
              min={start}
              value={examTo}
              onChange={(e) => setExamTo(e.target.value)}
              aria-label="Último día de exámenes"
            />
          )}
          <button type="button" className="choice" aria-pressed={!examOn} onClick={() => setExamOn(false)}>
            <span className="radio" />
            <div>
              <b>No</b>
              <span>Lo puedes activar después en Ajustes.</span>
            </div>
          </button>
        </section>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => setStep('start')}>
            Atrás
          </button>
          <button type="button" className="btn primary" disabled={examOn && !exam} onClick={() => setStep('pattern')}>
            Siguiente
          </button>
        </div>
      </main>
    );
  }

  if (step === 'pattern' || step === 'pattern2') {
    return (
      <main className="lock">
        <StepDots step={3} />
        <h1>{step === 'pattern' ? 'Crea tu patrón' : 'Repite tu patrón'}</h1>
        <p>
          {step === 'pattern'
            ? 'Une al menos 4 puntos. Te lo pedirá al abrir la app. Después puedes activar tu huella.'
            : 'Dibújalo otra vez para confirmar.'}
        </p>
        <PatternPad
          key={step}
          resetKey={reset}
          error={Boolean(err)}
          disabled={busy}
          onComplete={(p) => {
            if (step === 'pattern') {
              setFirst(p);
              setErr(undefined);
              setStep('pattern2');
            } else if (p !== first) {
              setErr('No coincide. Vuelve a crearlo.');
              setReset((r) => r + 1);
              setStep('pattern');
            } else void finish(p);
          }}
        />
        <p className="pin-error" role="alert">
          {busy ? 'Protegiendo tus datos…' : (err ?? '')}
        </p>
        <button type="button" className="link-btn" disabled={busy} onClick={() => setStep('exam')}>
          Atrás
        </button>
      </main>
    );
  }

  if (step === 'restore') {
    return (
      <main className="onb">
        <div>
          <h1 className="onb-title">Restaurar un respaldo</h1>
          <p className="muted">Elige el archivo que guardaste (.txt) o pega su texto.</p>
        </div>
        <label className="btn block" style={{ cursor: 'pointer' }}>
          <Icon name="upload" size={18} /> Elegir archivo
          <input
            type="file"
            accept="text/plain,.txt,application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) readBackup(await f.text());
              e.target.value = '';
            }}
          />
        </label>
        <div className="paste-box">
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Pega aquí el texto del respaldo" aria-label="Texto del respaldo" spellCheck={false} />
          <button type="button" className="btn primary block" disabled={!pasted.trim()} onClick={() => readBackup(pasted)}>
            Usar este respaldo
          </button>
        </div>
        <button type="button" className="link-btn" onClick={() => setStep('welcome')}>
          Volver
        </button>
      </main>
    );
  }

  // restorePattern
  return (
    <main className="lock">
      <h1>Patrón del respaldo</h1>
      <p>Dibuja el patrón que tenías cuando hiciste el respaldo. Será tu patrón desde ahora.</p>
      <PatternPad
        resetKey={reset}
        error={Boolean(err)}
        disabled={busy}
        onComplete={async (p) => {
          if (!backup) return;
          setBusy(true);
          const st = await openBackup(backup, p);
          if (!st) {
            setBusy(false);
            setErr('Patrón incorrecto.');
            setReset((r) => r + 1);
            return;
          }
          await createVault(p, st);
          toast('Respaldo restaurado.', 'success');
        }}
      />
      <p className="pin-error" role="alert">
        {busy ? 'Abriendo…' : (err ?? '')}
      </p>
      <button type="button" className="link-btn" onClick={() => setStep('restore')}>
        Volver
      </button>
    </main>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="steps-dots" aria-label={`Paso ${step} de 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= step ? 'on' : ''} />
      ))}
    </div>
  );
}
