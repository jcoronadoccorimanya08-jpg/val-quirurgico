import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../src/lib/backup';
import {
  decryptBytes,
  decryptJSON,
  deriveKey,
  encryptBytes,
  encryptJSON,
  importDataKey,
  keyFromPrf,
  newDataKey,
  randomBytes,
  toB64,
} from '../src/lib/crypto';
import { sanitizeState } from '../src/lib/sanitize';
import { initialState } from '../src/lib/store';

const ITER = 1000;

describe('cifrado por sobre', () => {
  it('la llave de datos se abre con el patrón correcto y con la huella', async () => {
    const dk = newDataKey();
    const salt = randomBytes(16);
    const wrappedByPattern = await encryptBytes(await deriveKey('1-5-9-6', salt, ITER), dk);
    const prf = randomBytes(32);
    const wrappedByBio = await encryptBytes(await keyFromPrf(prf), dk);

    expect(await decryptBytes(await deriveKey('1-5-9-6', salt, ITER), wrappedByPattern)).toEqual(dk);
    expect(await decryptBytes(await keyFromPrf(prf), wrappedByBio)).toEqual(dk);
    await expect(decryptBytes(await deriveKey('1-2-3-6', salt, ITER), wrappedByPattern)).rejects.toBeTruthy();
    await expect(decryptBytes(await keyFromPrf(randomBytes(32)), wrappedByBio)).rejects.toBeTruthy();
  });

  it('los datos cifrados no muestran el contenido', async () => {
    const key = await importDataKey(newDataKey());
    const state = initialState('2026-11-08', null);
    const sealed = await encryptJSON(key, state);
    expect(sealed.ct).not.toContain('Bloque profundo');
    expect(sanitizeState(await decryptJSON(key, sealed))?.settings.core).toHaveLength(4);
  });
});

describe('respaldo en texto', () => {
  it('se lee de vuelta y rechaza otros archivos', async () => {
    const salt = randomBytes(16);
    const record = {
      v: 2 as const,
      lock: { pattern: { iter: ITER, salt: toB64(salt), wrapped: await encryptBytes(await deriveKey('1-5-9', salt, ITER), newDataKey()) } },
      data: await encryptJSON(await importDataKey(newDataKey()), { x: 1 }),
    };
    expect(parseBackup(serializeBackup(record))).toEqual(record);
    expect(() => parseBackup('hola')).toThrow('El texto no es un respaldo válido.');
    expect(() => parseBackup('{"app":"bitacora"}')).toThrow('Este respaldo no es de Val Q.');
  });
});

describe('pegar el respaldo sin dolores de cabeza', () => {
  it('si pegas solo el nombre del archivo, te lo dice', () => {
    expect(() => parseBackup('val-q-respaldo-2026-11-15.txt')).toThrow('Pegaste solo el nombre del archivo');
  });

  it('acepta texto de más alrededor y caracteres invisibles', async () => {
    const salt = randomBytes(16);
    const record = {
      v: 2 as const,
      lock: { pattern: { iter: ITER, salt: toB64(salt), wrapped: await encryptBytes(await deriveKey('1-5-9', salt, ITER), newDataKey()) } },
      data: await encryptJSON(await importDataKey(newDataKey()), { x: 1 }),
    };
    expect(parseBackup(`Respaldo:\n​${serializeBackup(record)}\n`)).toEqual(record);
  });
});
