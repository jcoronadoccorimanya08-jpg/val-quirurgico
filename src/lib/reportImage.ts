/**
 * Reporte semanal como imagen de 1080 × 1350 (tamaño de un post de Instagram), dibujado en el teléfono.
 */
import { LEMA } from './config';
import { formatRange, todayISO, type ISODate } from './dates';
import { allSegmentProgress, cycleStats, dailySeries, habitStats, segmentPct, wonStreak } from './engine';
import { fund, nextCatalogGoal } from './rewards';
import type { AppState } from './types';

const W = 1080;
const H = 1350;

function css(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderReportImage(state: AppState, today: ISODate): Promise<Blob> {
  await document.fonts?.ready;
  const s = state.settings;
  const progress = allSegmentProgress(s, state.days, today);
  const current = progress.find((p) => today >= p.segment.start && today <= p.segment.end) ?? progress[progress.length - 1]!;
  const seg = current.segment;
  const weekPct = Math.round(segmentPct(seg, s, state.days, today));
  const stats = cycleStats(s, state.days, today);
  const f = fund(s, state, progress);
  const streak = wonStreak(s, state.days, today);
  const series = dailySeries(s, state.days, today);
  const core = habitStats(s, state.days, today, 'core');
  const next = nextCatalogGoal(s, f.balance, new Set(state.redemptions.map((r) => r.itemId)));

  const accent = '#2ee6a8';
  const info = '#5ab6ff';
  const gold = '#ffc247';
  const text = '#eef3f8';
  const muted = '#93a0b3';
  const font = css('--font', 'system-ui, sans-serif');

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#121a26');
  bg.addColorStop(1, '#07090d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 10, W * 0.85, 120, 520);
  glow.addColorStop(0, 'rgba(46,230,168,0.18)');
  glow.addColorStop(1, 'rgba(46,230,168,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const P = 80;
  ctx.textBaseline = 'alphabetic';

  // Encabezado
  ctx.fillStyle = accent;
  ctx.font = `700 30px ${font}`;
  ctx.fillText('VAL QUIRÚRGICO', P, 120);
  ctx.fillStyle = text;
  ctx.font = `800 76px ${font}`;
  ctx.fillText(seg.isFinal ? 'Tramo final' : `Semana ${seg.index}`, P, 210);
  ctx.fillStyle = muted;
  ctx.font = `500 34px ${font}`;
  ctx.fillText(`${formatRange(seg.start, seg.end)} · día ${stats.dayNumber} de ${s.cycleLength}`, P, 262);

  // Anillo con el porcentaje de la semana
  const cx = W - P - 150;
  const cy = 200;
  const r = 118;
  ctx.lineWidth = 26;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, info);
  ring.addColorStop(1, accent);
  ctx.strokeStyle = ring;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(0.01, weekPct)) / 100);
  ctx.stroke();
  ctx.fillStyle = text;
  ctx.textAlign = 'center';
  ctx.font = `800 78px ${font}`;
  ctx.fillText(`${weekPct}%`, cx, cy + 22);
  ctx.fillStyle = muted;
  ctx.font = `600 24px ${font}`;
  ctx.fillText('promedio', cx, cy + 58);
  ctx.textAlign = 'left';

  // Tarjetas de cifras
  const cards: [string, string, string][] = [
    [`${current.completed}/${seg.length}`, 'días ganados', current.status === 'won' ? accent : text],
    [`${streak}`, 'días seguidos', gold],
    [`Bs ${f.balance}`, 'en tu fondo', accent],
  ];
  const cw = (W - P * 2 - 40) / 3;
  cards.forEach(([big, small, color], i) => {
    const x = P + i * (cw + 20);
    roundRect(ctx, x, 340, cw, 150, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `800 56px ${font}`;
    ctx.fillText(big, x + 32, 418);
    ctx.fillStyle = muted;
    ctx.font = `500 28px ${font}`;
    ctx.fillText(small, x + 32, 462);
  });

  // Montaña del ciclo
  const mx = P;
  const my = 560;
  const mw = W - P * 2;
  const mh = 230;
  ctx.fillStyle = muted;
  ctx.font = `700 26px ${font}`;
  ctx.fillText('TU MONTAÑA', mx, my - 18);
  const n = Math.max(14, series.length, 2);
  const px = (i: number) => mx + (i / (n - 1)) * mw;
  const py = (v: number) => my + (1 - v / 100) * mh;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  for (const v of [0, 50, 100]) {
    ctx.beginPath();
    ctx.moveTo(mx, py(v));
    ctx.lineTo(mx + mw, py(v));
    ctx.stroke();
  }
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(mx, py(s.dayGoal));
  ctx.lineTo(mx + mw, py(s.dayGoal));
  ctx.stroke();
  ctx.setLineDash([]);
  if (series.length) {
    const path = new Path2D();
    path.moveTo(px(0), py(series[0]!.avg7));
    for (let i = 1; i < series.length; i++) {
      const x0 = px(i - 1);
      const x1 = px(i);
      const c = (x0 + x1) / 2;
      path.bezierCurveTo(c, py(series[i - 1]!.avg7), c, py(series[i]!.avg7), x1, py(series[i]!.avg7));
    }
    const area = new Path2D(path);
    area.lineTo(px(series.length - 1), py(0));
    area.lineTo(px(0), py(0));
    area.closePath();
    const grad = ctx.createLinearGradient(0, my, 0, my + mh);
    grad.addColorStop(0, 'rgba(46,230,168,0.55)');
    grad.addColorStop(1, 'rgba(46,230,168,0.02)');
    ctx.fillStyle = grad;
    ctx.fill(area);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.stroke(path);
    series.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(px(i), py(p.pct), p.won ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = p.won ? accent : info;
      ctx.fill();
    });
  }
  ctx.fillStyle = muted;
  ctx.font = `500 24px ${font}`;
  ctx.fillText(`meta ${s.dayGoal}%`, mx + mw - 130, py(s.dayGoal) - 12);

  // Núcleo
  let y = 870;
  ctx.fillStyle = muted;
  ctx.font = `700 26px ${font}`;
  ctx.fillText('NÚCLEO', P, y);
  y += 30;
  for (const h of core) {
    y += 50;
    ctx.fillStyle = text;
    ctx.font = `600 32px ${font}`;
    ctx.fillText(h.habit.name.length > 30 ? `${h.habit.name.slice(0, 29)}…` : h.habit.name, P, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = `800 32px ${font}`;
    ctx.fillText(`${h.pct}%`, W - P, y);
    ctx.textAlign = 'left';
    roundRect(ctx, P, y + 14, W - P * 2, 12, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    roundRect(ctx, P, y + 14, Math.max(12, ((W - P * 2) * h.pct) / 100), 12, 6);
    ctx.fillStyle = accent;
    ctx.fill();
    y += 24;
  }

  // Pie
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, H - 120, W, 120);
  ctx.fillStyle = text;
  ctx.font = `700 30px ${font}`;
  ctx.fillText(next ? `Próximo premio: ${next.name} (Bs ${next.price})` : LEMA, P, H - 64);
  ctx.fillStyle = muted;
  ctx.font = `500 24px ${font}`;
  ctx.fillText(`Val Q · ${todayISO()}`, P, H - 28);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}
