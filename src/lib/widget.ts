/**
 * Puente con el widget de Android (app «Rachas»). Solo funciona cuando Val Q se abre desde esa app:
 * Chrome le entrega a la página un canal (postMessage con un MessagePort) y por ahí le mandamos el resumen
 * que muestra el widget después de cada cambio. Si no hay app nativa, no pasa nada.
 */
import { useSyncExternalStore } from 'react';
import { badgeBlocks, earnedTiers } from './badges';
import { addDays, diffDays, maxDate, minDate, rangeDates, type ISODate } from './dates';
import {
  buildSegments,
  countedHabits,
  cycleEnd,
  cyclePhase,
  dayNumber,
  dayPct,
  goalOn,
  isDone,
  isWon,
  lastPlayableDay,
  neededToWin,
  segmentFor,
  segmentProgress,
  wonStreak,
} from './engine';
import type { Accent, AppState } from './types';

export interface WidgetDay {
  /** Fecha. */
  d: ISODate;
  /** Porcentaje del día (0–100). */
  p: number;
  /** Día ganado. */
  w: boolean;
}

/** Lo que muestra el widget en un día. */
export interface WidgetFrame {
  today: ISODate;
  dayNumber: number;
  cycleLength: number;
  /** Inicio del ciclo. */
  start: ISODate;
  streak: number;
  todayPct: number;
  todayWon: boolean;
  goal: number;
  /** Hábitos que faltan para ganar hoy: 0 si ya lo ganaste; null si hoy ya no alcanza o no es día del ciclo. */
  need: number | null;
  /** Hábitos que cuentan hoy y todavía no marcaste. */
  left: number;
  /** Últimos 14 días del ciclo (hasta hoy). */
  days: WidgetDay[];
  /** La semana del ciclo en la que estás: número, inicio, días, días ganados y meta. */
  week: { n: number; start: ISODate; len: number; won: number; goal: number } | null;
  /** Tu meta: el premio especial mientras no pase su fecha; después, el gran premio compartido. */
  prize?: { name: string; daysLeft: number };
  /** El núcleo de hoy: nombre corto, si ya lo marcaste y si cuenta (en el viaje puede no contar). */
  core: { n: string; done: boolean; counts: boolean }[];
  /** Frase según tu racha. */
  phrase: string;
  /** Insignias ganadas en el ciclo (1 = Bronce … 6 = Leyenda). */
  badges: number;
}

export interface WidgetPayload extends WidgetFrame {
  v: 1;
  app: 'valq';
  /** Color elegido en Ajustes → Apariencia. */
  accent: Accent;
  /** Modo prueba: el widget lo muestra tal cual, marcado como prueba. */
  test?: true;
  /** Mañana y pasado mañana tal como se verían sin abrir la app: así el widget cambia de día solo. */
  ahead: WidgetFrame[];
}

/** «Gym (versión mínima)» → «Gym». */
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

export function buildWidgetFrame(state: AppState, today: ISODate): WidgetFrame {
  const s = state.settings;
  const phase = cyclePhase(s, today);
  const active = phase === 'active';
  const ref = lastPlayableDay(s, today);
  const days =
    phase === 'before' ? [] : rangeDates(maxDate(s.startDate, addDays(ref, -13)), minDate(ref, cycleEnd(s))).map((d) => ({ d, p: Math.round(dayPct(s, state.days, d)), w: isWon(s, state.days, d) }));
  const counted = countedHabits(s, today);
  const needed = active ? neededToWin(s, state.days, today) : null;
  const segs = buildSegments(s);
  const seg = phase === 'before' ? segs[0] : segmentFor(segs, ref);
  const prog = seg ? segmentProgress(seg, s, state.days, ref) : null;
  const streak = wonStreak(s, state.days, today);
  const todayWon = active && isWon(s, state.days, today);
  const day = phase === 'before' ? 0 : Math.min(s.cycleLength, dayNumber(s.startDate, today));
  const yesterday = addDays(today, -1);
  const coreIds = new Set(counted.core.map((h) => h.id));
  const frame: WidgetFrame = {
    today,
    dayNumber: day,
    cycleLength: s.cycleLength,
    start: s.startDate,
    streak,
    todayPct: active ? Math.round(dayPct(s, state.days, today)) : 0,
    todayWon,
    goal: goalOn(s, today),
    need: needed ? needed.core + needed.extra : null,
    left: active ? counted.core.filter((h) => !isDone(state.days, today, 'core', h.id)).length + counted.extras.filter((h) => !isDone(state.days, today, 'extra', h.id)).length : 0,
    days,
    week: seg && prog ? { n: seg.index, start: seg.start, len: seg.length, won: prog.completed, goal: seg.goal } : null,
    core: s.core.map((h) => ({ n: shortName(h.name), done: active && isDone(state.days, today, 'core', h.id), counts: coreIds.has(h.id) })),
    phrase: streakPhrase({ started: phase !== 'before', streak, todayWon, yesterdayWon: yesterday >= s.startDate && isWon(s, state.days, yesterday), dayNumber: day }),
    badges: earnedTiers(badgeBlocks(s, state.days, today)).length,
  };
  const sp = s.special;
  if (sp && !sp.claimedAt && sp.date && today <= sp.date) frame.prize = { name: sp.name, daysLeft: diffDays(today, sp.date) };
  else if (s.grand) frame.prize = { name: s.grand.name, daysLeft: Math.max(0, diffDays(today, cycleEnd(s))) };
  return frame;
}

/** Cuántos días adelantados se mandan (por si no abres la app): mañana y pasado mañana. */
export const AHEAD_DAYS = 2;

export function buildWidgetPayload(state: AppState, today: ISODate, opts: { test?: boolean } = {}): WidgetPayload {
  const payload: WidgetPayload = {
    v: 1,
    app: 'valq',
    ...buildWidgetFrame(state, today),
    accent: state.settings.accent ?? 'verde',
    // En modo prueba la fecha es simulada: el widget no la cambia solo.
    ahead: opts.test ? [] : Array.from({ length: AHEAD_DAYS }, (_, i) => buildWidgetFrame(state, addDays(today, i + 1))),
  };
  if (opts.test) payload.test = true;
  return payload;
}

// ---------- Canal con la app «Rachas» ----------

/** Paquete de la app nativa «Rachas». */
const APP_PACKAGE = 'io.github.jcoronadoccorimanya08.rachas';

/**
 * ¿El mensaje lo manda Chrome en nombre de la app «Rachas»? Chrome identifica a la app verificada
 * como «android-app://<sitio>/<paquete>» (o «android-app://<paquete>»). Una página web no puede fingir ese origen.
 */
export function isRachasOrigin(origin: string, self: string): boolean {
  if (origin === self) return true;
  if (!origin.startsWith('android-app://')) return false;
  return origin.slice('android-app://'.length).split(/[/?#]/).includes(APP_PACKAGE);
}

/** off: no hay app nativa · connecting: llegó el canal · ready: la app respondió · saved: el widget guardó tu resumen. */
export type BridgeStatus = 'off' | 'connecting' | 'ready' | 'saved';

let port: MessagePort | null = null;
let last: string | null = null;
let started = false;
let status: BridgeStatus = 'off';
const listeners = new Set<() => void>();

function setStatus(next: BridgeStatus) {
  if (status === next) return;
  status = next;
  for (const f of listeners) f();
}

/** Estado del canal con el widget, para mostrarlo en Ajustes. */
export function useBridgeStatus(): BridgeStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
    () => 'off',
  );
}

/** Escucha el canal de la app nativa. Se llama al cargar la página, antes de que Chrome entregue el puerto. */
export function initWidgetBridge(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('message', (e: MessageEvent) => {
    if (!isRachasOrigin(e.origin, window.location.origin) || !e.ports || e.ports.length !== 1) return;
    port = e.ports[0]!;
    port.onmessage = (m: MessageEvent) => {
      const text = typeof m.data === 'string' ? m.data : '';
      if (text.startsWith('rachas:ok')) setStatus('saved');
      else if (text.startsWith('rachas:') && status !== 'saved') setStatus('ready');
    };
    setStatus('connecting');
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
