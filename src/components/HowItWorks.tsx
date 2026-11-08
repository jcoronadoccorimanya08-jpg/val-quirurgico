import { useEffect, useState } from 'react';
import { TIERS } from '../lib/badges';
import { OTHER_NAME, VICTORY_PCT } from '../lib/team';
import type { Settings } from '../lib/types';
import { Icon } from './Icon';

/** Lo nuevo de esta versión (se muestra una vez después de actualizar). */
export const WHATS_NEW = {
  version: __APP_VERSION__,
  items: [
    'Widget de Rachas: ahora sí recibe tu racha y cambia de día solo a medianoche.',
    'A las 22:30, un recordatorio para anotar tu lista (con Rachas 3.0).',
    'Ajustes → Widget y recordatorio: ves si tu widget está conectado.',
  ],
};

const SEEN_KEY = 'val-quirurgico.seen-version';

/** Todas las reglas, con tus números actuales. */
export function HowItWorks({ s, onClose }: { s: Settings; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const extraWeight = 100 - s.coreWeight;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Cómo funciona">
      <button type="button" className="icon-btn overlay-close" aria-label="Cerrar" onClick={onClose}>
        <Icon name="x" />
      </button>
      <main className="help">
        <div className="eyebrow">Val Q</div>
        <h1 className="title">Cómo funciona</h1>

        <section className="card">
          <div className="card-title">Tu día</div>
          <ul>
            <li>
              El <b>núcleo</b> ({s.core.length} hábitos) vale {s.coreWeight} % y los <b>secundarios</b>, {extraWeight} %. La versión mínima del núcleo también cuenta.
            </li>
            <li>
              <b>Ganas el día con {s.dayGoal} % o más.</b> Un comodín también lo gana.
            </li>
            <li>
              <b>Modo examen:</b> esos días solo cuenta el núcleo, y cada hábito vale lo mismo.
            </li>
            <li>
              <b>Modo viaje</b> (Ajustes → Ciclo): esas fechas solo cuentan los hábitos que elijas, con la meta que pongas. Los demás ni suman ni restan.
            </li>
            <li>Márcalo cada noche. Si un día se te pasó, vuelve atrás con la flecha y corrígelo.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-title">Tu semana y tu fondo</div>
          <ul>
            <li>
              <b>Ganas la semana con {s.weeklyGoal} de 7 días ganados.</b> El tramo final es más corto y su meta baja.
            </li>
            <li>
              Cada semana ganada suma <b>Bs {s.fundPerWeek}</b> a tu fondo y te da un <b>cofre sorpresa</b> (+20 o +50 Bs, un comodín o una noche de peli).
            </li>
            <li>Cada 2 semanas ganadas te llevas un <b>comodín</b> para salvar un día malo.</li>
            <li>Con tu fondo canjeas los premios de tu lista. El premio especial se desbloquea desde su fecha con las semanas que elegiste.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-title">Insignias</div>
          <ul>
            <li>
              Cada bloque de 2 semanas con <b>{s.weeklyGoal * 2} días ganados</b> sube un nivel: {TIERS.join(', ')}.
            </li>
            <li>Si un bloque no sale, no pierdes lo que ya ganaste: vas por el siguiente.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-title">Semana victoriosa con {OTHER_NAME}</div>
          <ul>
            <li>
              Si el promedio de tu semana en Val Q y en {OTHER_NAME} llega a <b>{VICTORY_PCT} %</b>, la semana es victoriosa.
            </li>
            <li>El gran premio compartido se gana con las semanas victoriosas que elegiste y se reclama en {OTHER_NAME} el último día del ciclo.</li>
            <li>Las dos apps se pasan solo esos porcentajes, nunca tus hábitos. Ponles el mismo inicio de ciclo.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-title">Tu ánimo</div>
          <ul>
            <li>Marca cómo estuvo tu ánimo con un toque. En Avance ves tu porcentaje según tu ánimo.</li>
          </ul>
        </section>

        <section className="card">
          <div className="card-title">Tus datos</div>
          <ul>
            <li>Se guardan cifrados solo en este teléfono y se abren con tu patrón o tu huella.</li>
            <li>
              <b>Haz un respaldo cada semana</b> (Ajustes → Respaldo). Si olvidas el patrón, nadie puede abrir tus datos.
            </li>
          </ul>
        </section>

        <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={onClose}>
          Entendido
        </button>
      </main>
    </div>
  );
}

/** Aviso en Hoy: «Cómo funciona» la primera vez y «Novedades» después de cada actualización. */
export function WhatsNewBanner({ onOpen }: { onOpen: () => void }) {
  const [seen, setSeen] = useState<string | null | undefined>(() => {
    try {
      return localStorage.getItem(SEEN_KEY);
    } catch {
      return WHATS_NEW.version;
    }
  });
  if (seen === WHATS_NEW.version) return null;
  const hide = () => {
    try {
      localStorage.setItem(SEEN_KEY, WHATS_NEW.version);
    } catch {
      /* nada */
    }
    setSeen(WHATS_NEW.version);
  };
  const first = seen === null;
  return (
    <div className="banner gold" role="region" aria-label={first ? 'Cómo funciona' : 'Novedades'}>
      <Icon name="sparkles" />
      <div className="txt">
        <b>{first ? '¿Cómo funciona Val Q?' : 'Novedades'}</b>
        {first ? 'Todas las reglas en un minuto.' : WHATS_NEW.items.join(' ')}
      </div>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          hide();
          onOpen();
        }}
      >
        Ver
      </button>
      <button type="button" className="icon-btn" aria-label="Cerrar aviso" onClick={hide}>
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
