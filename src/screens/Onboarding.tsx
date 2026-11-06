import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { APP_NAME, LEMA } from '../lib/config';
import { addDays, formatLong, formatRange, isValidISODate, nextMonday, weekday, type ISODate } from '../lib/dates';
import { parseBackup } from '../lib/backup';
import { toast } from '../lib/feedback';
import { actions } from '../lib/store';

type Choice = 'today' | 'monday' | 'custom';

export function Onboarding({ today }: { today: ISODate }) {
  const isMonday = weekday(today) === 1;
  const monday = nextMonday(today);
  const [choice, setChoice] = useState<Choice>(isMonday ? 'today' : 'monday');
  const [custom, setCustom] = useState<ISODate>(today);
  const fileRef = useRef<HTMLInputElement>(null);

  const start = choice === 'today' ? today : choice === 'monday' ? monday : custom;
  const valid = isValidISODate(start);

  const restore = async (file: File) => {
    try {
      const state = parseBackup(await file.text());
      actions.replaceAll(state);
      toast('Respaldo restaurado.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo restaurar.', 'error');
    }
  };

  return (
    <main className="onb">
      <div>
        <img className="onb-logo" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={68} height={68} />
      </div>
      <div>
        <h1>{APP_NAME}</h1>
        <p className="lema">{LEMA}</p>
      </div>

      <ul className="pillars">
        <li>
          <span className="pi">
            <Icon name="flame" />
          </span>
          <div>
            <b>3 rachas núcleo</b>
            <span>Dormir, gym y estudio profundo. Con versión mínima para los días malos.</span>
          </div>
        </li>
        <li>
          <span className="pi">
            <Icon name="gift" />
          </span>
          <div>
            <b>Un premio por semana</b>
            <span>Ganas la semana con 6 de 7 días completos. Tú eliges el premio.</span>
          </div>
        </li>
        <li>
          <span className="pi">
            <Icon name="trophy" />
          </span>
          <div>
            <b>Ciclo de 90 días</b>
            <span>12 semanas y un tramo final con el gran premio.</span>
          </div>
        </li>
      </ul>

      <section aria-labelledby="start-title">
        <h2 id="start-title">¿Cuándo empiezas?</h2>
        <button type="button" className="choice" aria-pressed={choice === 'today'} onClick={() => setChoice('today')}>
          <span className="radio" />
          <div>
            <b>Hoy</b>
            <span>{formatLong(today)}</span>
          </div>
        </button>
        {!isMonday && (
          <button type="button" className="choice" aria-pressed={choice === 'monday'} onClick={() => setChoice('monday')}>
            <span className="radio" />
            <div>
              <b>El lunes {formatLong(monday).split(' ').slice(1).join(' ')}</b>
              <span>Recomendado: cada semana va de lunes a domingo.</span>
            </div>
          </button>
        )}
        <button type="button" className="choice" aria-pressed={choice === 'custom'} onClick={() => setChoice('custom')}>
          <span className="radio" />
          <div>
            <b>Otra fecha</b>
            <span>{choice === 'custom' && isValidISODate(custom) ? formatLong(custom) : 'Elige el día de inicio'}</span>
          </div>
        </button>
        {choice === 'custom' && (
          <input
            className="field"
            style={{ marginTop: 8 }}
            type="date"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Fecha de inicio"
          />
        )}
      </section>

      <div>
        <button type="button" className="btn primary block" disabled={!valid} onClick={() => valid && actions.startCycle(start)}>
          Empezar mi ciclo
        </button>
        {valid && (
          <p className="fine" style={{ marginTop: 10 }}>
            Semana 1: {formatRange(start, addDays(start, 6))}. Tus datos se guardan solo en este teléfono.
          </p>
        )}
        <button type="button" className="btn ghost block" style={{ marginTop: 6 }} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={18} /> Restaurar un respaldo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
            e.target.value = '';
          }}
        />
      </div>
    </main>
  );
}

