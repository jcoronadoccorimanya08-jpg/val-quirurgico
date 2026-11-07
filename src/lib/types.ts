import type { ISODate } from './dates';

/** Meta que cambia con las semanas del ciclo (por ejemplo, Meditar 10 min → 15 min). */
export interface HabitLevel {
  fromWeek: number;
  name: string;
}

export interface Habit {
  /** Identificador estable: el historial se guarda con este id, aunque cambie el nombre. */
  id: string;
  name: string;
  /** Versión mínima para un día malo (núcleo). */
  min?: string;
  /** Pasos que se muestran como guía (por ejemplo, la rutina de la mañana). */
  steps?: string[];
  levels?: HabitLevel[];
}

export type Theme = 'system' | 'dark' | 'light';

/** Temporada de exámenes: esos días solo cuenta el núcleo. */
export interface ExamPeriod {
  from: ISODate;
  to: ISODate;
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  /** false = guardado para "más adelante". */
  active: boolean;
}

/** Premio especial con fecha (por ejemplo, un viaje). Se escribe en la app: nunca va en el código. */
export interface SpecialPrize {
  name: string;
  /** Fecha del premio (opcional), para la cuenta regresiva. */
  date?: ISODate;
  /** Desde cuándo se puede desbloquear. */
  unlockDate: ISODate;
  /** Semanas ganadas necesarias para desbloquearlo. */
  requiredWeeks: number;
  claimedAt?: string;
}

/** Gran premio compartido con Bitácora: se gana con semanas victoriosas (el promedio de las dos apps llega a 80 %). Se escribe en la app. */
export interface SharedGrand {
  name: string;
  /** Semanas victoriosas necesarias. */
  weeks: number;
}

export interface Settings {
  startDate: ISODate;
  cycleLength: number;
  /** Días ganados necesarios en una semana de 7 días para ganarla. */
  weeklyGoal: number;
  core: Habit[];
  extras: Habit[];
  /** Hábitos guardados para vacaciones: no cuentan hasta que los actives. */
  vacation: Habit[];
  /** Porcentaje del día que vale el núcleo (el resto, los secundarios). */
  coreWeight: number;
  /** Porcentaje mínimo para ganar el día. */
  dayGoal: number;
  exam: ExamPeriod | null;
  /** Bs que suma al fondo cada semana ganada. */
  fundPerWeek: number;
  catalog: CatalogItem[];
  special: SpecialPrize | null;
  /** Opcional: los estados guardados antes no lo tienen (se lee como null). */
  grand: SharedGrand | null;
  theme: Theme;
  /** Minutos fuera de la app antes de pedir el patrón otra vez (0 = al salir). */
  autoLockMinutes: number;
  createdAt: string;
  lastBackupAt?: string;
}

/** Ánimo del día: 1 = muy mal … 5 = muy bien. */
export type Mood = 1 | 2 | 3 | 4 | 5;

export interface DayLog {
  core: Record<string, boolean>;
  extra: Record<string, boolean>;
  /** Día salvado con un comodín: cuenta como ganado. */
  wildcard?: boolean;
  mood?: Mood;
  updatedAt?: string;
}

export type ChestOutcome = 'bs20' | 'bs50' | 'wildcard' | 'movie';

export interface Chest {
  outcome: ChestOutcome;
  openedAt: string;
}

export interface Redemption {
  id: string;
  itemId: string;
  name: string;
  price: number;
  at: string;
}

export interface AppState {
  schema: 2;
  settings: Settings;
  days: Record<ISODate, DayLog>;
  /** Cofres abiertos, por número de semana del ciclo. */
  chests: Record<string, Chest>;
  redemptions: Redemption[];
}

export type HabitKind = 'core' | 'extra';
