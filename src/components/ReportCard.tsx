import { useState } from 'react';
import { formatRange, rangeDates, weekdayInitial, type ISODate } from '../lib/dates';
import { allSegmentProgress, dayPct, habitStats, isWon, segmentPct } from '../lib/engine';
import { toast } from '../lib/feedback';
import { renderReportImage } from '../lib/reportImage';
import { fund } from '../lib/rewards';
import type { AppState } from '../lib/types';
import { Icon } from './Icon';

/** Reporte de la semana: tarjeta visual + imagen para compartir + texto para Claude. */
export function ReportCard({ state, today, report }: { state: AppState; today: ISODate; report: string }) {
  const s = state.settings;
  const progress = allSegmentProgress(s, state.days, today);
  const current = progress.find((p) => today >= p.segment.start && today <= p.segment.end) ?? progress[progress.length - 1];
  const [busy, setBusy] = useState(false);
  const [showText, setShowText] = useState(false);
  if (!current) return null;
  const seg = current.segment;
  const weekPct = Math.round(segmentPct(seg, s, state.days, today));
  const f = fund(s, state, progress);
  const core = habitStats(s, state.days, today, 'core');

  const shareImage = async () => {
    setBusy(true);
    try {
      const blob = await renderReportImage(state, today);
      const file = new File([blob], `val-q-semana-${seg.index}.png`, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Val Q · Semana ${seg.index}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('Imagen guardada en tus descargas.', 'success');
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) toast('No se pudo crear la imagen.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast('Reporte copiado. Pégalo en Claude.', 'success');
    } catch {
      toast('No se pudo copiar.', 'error');
    }
  };

  return (
    <section className="card report" aria-label="Reporte de la semana">
      <div className="report-head">
        <div>
          <div className="goal-eyebrow">{seg.isFinal ? 'Tramo final' : `Semana ${seg.index}`}</div>
          <div className="card-title">{formatRange(seg.start, seg.end)}</div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {current.completed} de {seg.length} días ganados · Bs {f.balance} en tu fondo
          </div>
        </div>
        <div className="report-pct">
          <b>{weekPct}%</b>
          <span>promedio</span>
        </div>
      </div>
      <div className="report-days" aria-hidden="true">
        {rangeDates(seg.start, seg.end).map((d) => {
          const p = d > today ? 0 : dayPct(s, state.days, d);
          return (
            <div key={d} className={`rd ${d > today ? 'future' : isWon(s, state.days, d) ? 'won' : ''}`}>
              <i style={{ height: `${Math.max(4, p)}%` }} />
              <span>{weekdayInitial(d)}</span>
            </div>
          );
        })}
      </div>
      <div className="report-core">
        {core.map((h) => (
          <div key={h.habit.id}>
            <span>{h.habit.name}</span>
            <b>{h.pct}%</b>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" disabled={busy} onClick={() => void shareImage()}>
          <Icon name="share" size={18} /> {busy ? 'Creando…' : 'Imagen'}
        </button>
        <button type="button" className="btn" onClick={() => void copy()}>
          <Icon name="copy" size={18} /> Copiar para Claude
        </button>
      </div>
      <button type="button" className="link-btn" onClick={() => setShowText((v) => !v)} aria-expanded={showText}>
        {showText ? 'Ocultar el texto' : 'Ver el texto para Claude'}
      </button>
      {showText && <div className="report-text">{report}</div>}
    </section>
  );
}
