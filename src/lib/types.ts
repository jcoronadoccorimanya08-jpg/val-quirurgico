import type { ISODate } from './dates';

export interface Habit {
  /** Identificador estable: el historial se guarda con este id, aunque cambie el nombre. */
  id: string;
  name: string;
  /** Versión mínima para un día malo (solo hábitos del núcleo). */
  min?: string;
}

export type Theme = 'system' | 'dark' | 'light';

export interface Settings {
  startDate: ISODate;
  cycleLength: number;
  /** Días completos necesarios en una semana de 7 días para ganar su premio. */
  weeklyGoal: number;
  core: Habit[];
  extras: Habit[];
  theme: Theme;
  createdAt: string;
  lastBackupAt?: string;
}

export interface DayLog {
  core: Record<string, boolean>;
  extra: Record<string, boolean>;
  updatedAt?: string;
}

export interface Reward {
  text: string;
  claimedAt?: string;
}

export interface AppState {
  schema: 1;
  settings: Settings | null;
  days: Record<ISODate, DayLog>;
  /** Premios por número de semana del ciclo ('1' … '13'). */
  rewards: Record<string, Reward>;
}

export type HabitKind = 'core' | 'extra';
