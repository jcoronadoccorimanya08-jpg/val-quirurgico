import type { Habit } from './types';

export const APP_NAME = 'Val quirúrgico';
export const LEMA = 'La presión es un privilegio';
export const CYCLE_LENGTH = 90;
export const DEFAULT_WEEKLY_GOAL = 6;
export const MAX_EXTRAS = 15;

export const DEFAULT_CORE: Habit[] = [
  { id: 'sueno', name: 'Dormir 23:00 – 6:00', min: 'Día malo: acostarte antes de las 00:00 y dormir 7 h.' },
  { id: 'gym', name: 'Gym', min: 'Día malo: 20 minutos, aunque sea lo básico.' },
  { id: 'estudio', name: 'Bloque profundo sin celular', min: 'Día malo: un bloque de 25 minutos.' },
];

export const DEFAULT_EXTRAS: Habit[] = [
  { id: 'anki', name: 'Anki (10–20 min)' },
  { id: 'atrium', name: 'Un caso en Atrium' },
  { id: 'ajedrez', name: 'Una partida de ajedrez' },
  { id: 'sudoku', name: 'Un sudoku' },
  { id: 'sinapsis', name: 'Sinapsis: 3 ejercicios de ojos' },
  { id: 'protocolo', name: 'Protocolo de la mañana' },
  { id: 'suenos', name: 'Bitácora de sueños' },
  { id: 'negocio', name: 'Bloque de negocio' },
  { id: 'diario', name: 'Diario del día' },
];
