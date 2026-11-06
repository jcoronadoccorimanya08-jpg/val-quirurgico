import { todayISO } from './dates';
import { sanitizeState } from './storage';
import type { AppState } from './types';

const APP_ID = 'val-quirurgico';

export interface BackupFile {
  app: typeof APP_ID;
  schema: 1;
  exportedAt: string;
  state: AppState;
}

export function backupFileName(): string {
  return `val-quirurgico-respaldo-${todayISO()}.json`;
}

export function serializeBackup(state: AppState): string {
  const file: BackupFile = { app: APP_ID, schema: 1, exportedAt: new Date().toISOString(), state };
  return JSON.stringify(file, null, 1);
}

/** Lee un respaldo. Lanza un Error con un mensaje claro si el archivo no sirve. */
export function parseBackup(text: string): AppState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un respaldo válido.');
  }
  const file = raw as Partial<BackupFile> | null;
  if (!file || file.app !== APP_ID) throw new Error('Este archivo no es un respaldo de Val quirúrgico.');
  const state = sanitizeState(file.state);
  if (!state || !state.settings) throw new Error('El respaldo está incompleto o dañado.');
  return state;
}

function backupBlob(state: AppState): Blob {
  return new Blob([serializeBackup(state)], { type: 'application/json' });
}

export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Abre el menú de compartir de Android (Drive, WhatsApp, correo…) con el archivo de respaldo. */
export async function shareBackup(state: AppState): Promise<'shared' | 'cancelled'> {
  const file = new File([backupBlob(state)], backupFileName(), { type: 'application/json' });
  try {
    await navigator.share({ files: [file], title: 'Respaldo de Val quirúrgico' });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export function downloadBackup(state: AppState): void {
  const url = URL.createObjectURL(backupBlob(state));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
