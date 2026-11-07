import { useEffect, useRef, useState } from 'react';

type Level = 'day' | 'week';
const listeners = new Set<(l: Level) => void>();

/** Celebración: confeti breve al ganar el día y más largo al ganar la semana. */
export function celebrate(level: Level = 'day') {
  listeners.forEach((l) => l(level));
}

const COLORS = ['#2ee6a8', '#5ab6ff', '#ffc247', '#ff6b78', '#e9eef5'];

export function ConfettiHost() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let raf = 0;
    const run = (level: Level) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setActive(true);
      requestAnimationFrame(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.scale(dpr, dpr);
        const n = level === 'week' ? 160 : 70;
        const parts = Array.from({ length: n }, () => ({
          x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
          y: innerHeight * 0.35,
          vx: (Math.random() - 0.5) * 9,
          vy: -Math.random() * 11 - 4,
          r: Math.random() * 4 + 3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          c: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        }));
        const duration = level === 'week' ? 2600 : 1600;
        const t0 = performance.now();
        cancelAnimationFrame(raf);
        const tick = (t: number) => {
          const k = (t - t0) / duration;
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          for (const p of parts) {
            p.vy += 0.32;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - k);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.c;
            ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
            ctx.restore();
          }
          if (k < 1) raf = requestAnimationFrame(tick);
          else {
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            setActive(false);
          }
        };
        raf = requestAnimationFrame(tick);
      });
    };
    listeners.add(run);
    return () => {
      listeners.delete(run);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className={`confetti ${active ? 'on' : ''}`} aria-hidden="true" />;
}
