/**
 * Puente con el widget de Android (app «Rachas»). Solo funciona cuando Val Q se abre desde esa app:
 * la app nativa abre un canal (postMessage con un MessagePort) y aquí le mandamos un resumen de SOLO números
 * después de cada cambio. Si no hay app nativa, no pasa nada.
 */
import { addDays, diffDays, maxDate, minDate, rangeDates, type ISODate } from './dates';
import { countedHabits, cycleEnd, cyclePhase, dayNumber, dayPct, goalOn, isDone, isWon, lastPlayableDay, wonStreak } from './engine';
import type { Accent, AppState } from './types';

export interface WidgetDay {
  /** Fecha. */
  d: ISODate;
  /** Porcentaje del día (0–100). */
  p: number;
  /** Día ganado. */
  w: boolean;
}

export interface WidgetPayload {
  v: 1;
  app: 'valq';
  today: ISODate;
  dayNumber: number;
  cycleLength: number;
  streak: number;
  todayPct: number;
  todayWon: boolean;
  goal: number;
  /** Últimos 14 días del ciclo (hasta hoy). */
  days: WidgetDay[];
  /** Tu meta: el premio especial mientras no pase su fecha; después, el gran premio compartido. */
  prize?: { name: string; daysLeft: number };
  /** El núcleo de hoy: nombre corto, si ya lo marcaste y si cuenta (en el viaje puede no contar). */
  core: { n: string; done: boolean; counts: boolean }[];
  /** Frase según tu racha. */
  phrase: string;
  /** Color elegido en Ajustes → Apariencia. */
  accent: Accent;
}

/** «Dormir 23:00 – 6:00» → «Dormir». */
export function shortName(name: string): string {
  const first = name.trim().split(/[\s(·,–-]+/)[0] ?? name;
  return first.length > 8 ? `${first.slice(0, 7)}…` : first;
}

/** Frase del widget según cómo vas. Sin culpa: un día malo es información. */
export function streakPhrase(o: { started: boolean; streak: number; todayWon: boolean; yesterdayWon: boolean; dayNumber: number }): string {
  if (!o.started) return 'Tu ciclo está por empezar';
  if (o.todayWon) return o.streak >= 7 ? '¡Gran racha! Día ganado' : '¡Día ganado!';
  if (o.streak >= 14) return 'Imparable: cuida tu racha';
  if (o.streak >= 7) return '¡Gran racha! Hoy también';
  if (o.streak >= 3) return 'Vas encendido, sigue';
  if (o.streak >= 1) return 'Buen comienzo, sigue';
  if (o.dayNumber > 1 && !o.yesterdayWon) return 'Hoy no se negocia';
  return 'Hoy empieza tu racha';
}

export function buildWidgetPayload(state: AppState, today: ISODate): WidgetPayload {
  const s = state.settings;
  const phase = cyclePhase(s, today);
  const ref = lastPlayableDay(s, today);
  const days =
    phase === 'before' ? [] : rangeDates(maxDate(s.startDate, addDays(ref, -13)), minDate(ref, cycleEnd(s))).map((d) => ({ d, p: Math.round(dayPct(s, state.days, d)), w: isWon(s, state.days, d) }));
  const payload: WidgetPayload = {
    v: 1,
    app: 'valq',
    today,
    dayNumber: phase === 'before' ? 0 : Math.min(s.cycleLength, dayNumber(s.startDate, today)),
    cycleLength: s.cycleLength,
    streak: wonStreak(s, state.days, today),
    todayPct: phase === 'active' ? Math.round(dayPct(s, state.days, today)) : 0,
    todayWon: phase === 'active' && isWon(s, state.days, today),
    goal: goalOn(s, today),
    days,
    core: [],
    phrase: '',
    accent: s.accent ?? 'verde',
  };
  const counted = new Set(countedHabits(s, today).core.map((h) => h.id));
  payload.core = s.core.map((h) => ({ n: shortName(h.name), done: phase === 'active' && isDone(state.days, today, 'core', h.id), counts: counted.has(h.id) }));
  const yesterday = addDays(today, -1);
  payload.phrase = streakPhrase({
    started: phase !== 'before',
    streak: payload.streak,
    todayWon: payload.todayWon,
    yesterdayWon: yesterday >= s.startDate && isWon(s, state.days, yesterday),
    dayNumber: payload.dayNumber,
  });
  const sp = s.special;
  if (sp && !sp.claimedAt && sp.date && today <= sp.date) payload.prize = { name: sp.name, daysLeft: diffDays(today, sp.date) };
  else if (s.grand) payload.prize = { name: s.grand.name, daysLeft: Math.max(0, diffDays(today, cycleEnd(s))) };
  return payload;
}

/** Paquete de la app nativa «Rachas» (por si Chrome identifica el canal con el origen de la app). */
const APP_ORIGIN = 'android-app://io.github.jcoronadoccorimanya08.rachas';

let port: MessagePort | null = null;
let last: string | null = null;

/** Escucha el canal de la app nativa. Solo acepta mensajes de nuestro propio origen (la app verificada lo usa). */
export function initWidgetBridge(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('message', (e: MessageEvent) => {
    const trusted = e.origin === window.location.origin || e.origin.startsWith(APP_ORIGIN);
    if (!trusted || !e.ports || e.ports.length !== 1) return;
    port = e.ports[0]!;
    if (last) sendRaw(last);
  });
}

function sendRaw(msg: string) {
  try {
    port?.postMessage(msg);
  } catch {
    port = null;
  }
}

export function sendWidget(payload: WidgetPayload): void {
  last = JSON.stringify(payload);
  sendRaw(last);
}
