/**
 * Respaldo cifrado como texto (.txt). Chrome en Android no deja compartir archivos .json,
 * pero sí .txt: así se puede mandar a Drive, WhatsApp o guardar en Archivos. También se puede copiar.
 */
import { todayISO } from './dates';
import { isWrapped } from './crypto';
import type { VaultRecord } from './vault';

const APP_ID = 'val-quirurgico';

type BackupRecord = Pick<VaultRecord, 'v' | 'lock' | 'data'>;

interface BackupFile {
  app: typeof APP_ID;
  kind: 'backup';
  schema: 2;
  exportedAt: string;
  vault: BackupRecord;
}

export function backupFileName(): string {
  return `val-q-respaldo-${todayISO()}.txt`;
}

export function serializeBackup(record: BackupRecord): string {
  const file: BackupFile = { app: APP_ID, kind: 'backup', schema: 2, exportedAt: new Date().toISOString(), vault: record };
  return JSON.stringify(file);
}

/**
 * Lee el JSON de un archivo o de un texto pegado, tolerando lo que se cuela al copiar: caracteres invisibles,
 * texto antes o después de las llaves y, si con eso no basta, espacios raros y comillas tipográficas.
 * Si solo se pegó el nombre del archivo, lo dice con claridad.
 */
export function readLooseJSON(text: string, invalid: string): unknown {
  const clean = text.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').trim();
  const a = clean.indexOf('{');
  const b = clean.lastIndexOf('}');
  if (a < 0 || b <= a) {
    if (/\.(txt|json)\s*\.*$/i.test(clean) || /configuraci[oó]n|respaldo/i.test(clean)) throw new Error('Pegaste solo el nombre del archivo. Copia todo su texto (empieza con «{») o elige el archivo con el botón de cargar.');
    throw new Error(invalid);
  }
  const body = clean.slice(a, b + 1);
  const spaces = body.replace(/[\u00a0\u2007\u202f]/g, ' ');
  // Primero tal cual; después con espacios normales; al final, también con comillas rectas.
  for (const candidate of [body, spaces, spaces.replace(/[\u201c-\u201f\u2033]/g, '"')]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* sigue con el siguiente intento */
    }
  }
  throw new Error(invalid);
}

/** Lee un respaldo (archivo o texto pegado). Lanza un Error con un mensaje claro si no sirve. */
export function parseBackup(text: string): BackupRecord {
  const f = readLooseJSON(text, 'El texto no es un respaldo válido.') as Partial<BackupFile> | null;
  if (!f || f.app !== APP_ID) throw new Error('Este respaldo no es de Val Q.');
  const v = f.vault;
  if (!v || v.v !== 2 || !isWrapped(v.data) || !v.lock?.pattern || !isWrapped(v.lock.pattern.wrapped)) {
    throw new Error('Este respaldo es de una versión anterior o está dañado.');
  }
  return { v: 2, lock: { pattern: v.lock.pattern }, data: v.data };
}

function textFile(text: string): File {
  return new File([text], backupFileName(), { type: 'text/plain' });
}

export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [textFile('{}')] });
  } catch {
    return false;
  }
}

/** Abre el menú de compartir de Android (Drive, WhatsApp, Archivos…). */
export async function shareBackupText(text: string): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share({ files: [textFile(text)], title: 'Respaldo de Val Q' });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export function downloadBackupText(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
