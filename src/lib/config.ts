import { addDays, type ISODate } from './dates';
import type { CatalogItem, ExamPeriod, Habit, SpecialPrize } from './types';

export const APP_NAME = 'Val quirúrgico';
export const SHORT_NAME = 'Val Q';
export const LEMA = 'La presión es un privilegio';
export const CYCLE_LENGTH = 90;
export const DEFAULT_WEEKLY_GOAL = 6;
export const DEFAULT_CORE_WEIGHT = 60;
export const DEFAULT_DAY_GOAL = 65;
export const DEFAULT_FUND_PER_WEEK = 100;
export const MAX_EXTRAS = 12;
export const AUTOLOCK_OPTIONS = [0, 1, 5] as const;

export const DEFAULT_CORE: Habit[] = [
  { id: 'sueno', name: 'Dormir 23:00 – 6:00', min: 'Día malo: acostarte antes de las 00:00 y dormir 7 h.' },
  {
    id: 'rutina',
    name: 'Rutina de la mañana',
    min: 'Día malo: levantarte a tu hora y tender la cama.',
    steps: [
      'Levantarte y tender la cama',
      'Aseo y uniforme (ducha de 5 min; cara, dientes y barba)',
      'Cocinar y comer tu desayuno',
      'Agradecimiento y afirmaciones en el camino',
    ],
  },
  { id: 'gym', name: 'Gym', min: 'Día malo: 20 minutos, aunque sea lo básico.' },
  { id: 'estudio', name: 'Bloque profundo sin celular', min: 'Día malo: un bloque de 25 minutos.' },
];

export const DEFAULT_EXTRAS: Habit[] = [
  { id: 'anki', name: 'Anki (10–20 min)' },
  { id: 'atrium', name: 'Un caso en Atrium' },
  { id: 'ajedrez', name: 'Una partida de ajedrez' },
  { id: 'sudoku', name: 'Un sudoku' },
  { id: 'lectura', name: 'Lectura de la U (cualquier tema)' },
  { id: 'diario', name: 'Diario del día' },
  {
    id: 'meditar',
    name: 'Meditar',
    levels: [
      { fromWeek: 1, name: 'Meditar 10 min' },
      { fromWeek: 2, name: 'Meditar 15 min' },
    ],
  },
];

export const DEFAULT_VACATION: Habit[] = [
  { id: 'suenos', name: 'Bitácora de sueños' },
  { id: 'negocio', name: 'Bloque de negocio' },
];

export const DEFAULT_CATALOG: CatalogItem[] = [
  { id: 'perfume', name: 'Perfume', price: 150, active: true },
  { id: 'carne', name: 'Carne en un buen lugar', price: 250, active: true },
  { id: 'experiencia', name: 'Karting o escalada', price: 300, active: true },
  { id: 'zapatillas', name: 'Zapatillas', price: 400, active: true },
  { id: 'ropa', name: 'Ropa deportiva', price: 250, active: false },
  { id: 'gym-extra', name: 'Algo para el gym', price: 200, active: false },
  { id: 'libro', name: 'Libro o curso', price: 150, active: false },
];

/** Temporada de exámenes sugerida: desde el inicio hasta el 20 de diciembre (si cae dentro del ciclo). */
export function defaultExam(start: ISODate): ExamPeriod {
  const year = Number(start.slice(0, 4));
  let to = `${year}-12-20`;
  if (to < start || to > addDays(start, CYCLE_LENGTH - 1)) to = addDays(start, 41);
  return { from: start, to };
}

/** Premio especial sugerido: se desbloquea al terminar la semana 3 con 2 semanas ganadas. */
export function defaultSpecial(start: ISODate): SpecialPrize {
  return { name: 'Premio especial', unlockDate: addDays(start, 21), requiredWeeks: 2 };
}

export const CHEST_LABEL: Record<'bs20' | 'bs50' | 'wildcard' | 'movie', string> = {
  bs20: '+20 Bs al fondo',
  bs50: '+50 Bs al fondo',
  wildcard: 'Un comodín',
  movie: 'Noche de peli en tu cuarto',
};
