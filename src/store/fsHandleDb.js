/**
 * Capa de persistencia basada en File System Access API.
 *
 * Usa un FileSystemDirectoryHandle para leer y escribir JSON directamente
 * sobre una carpeta local del usuario (tipicamente una carpeta de Dropbox
 * desktop que sincroniza automaticamente al cloud).
 *
 * La interfaz publica coincide con db.js (IndexedDB) y fileDb.js (Electron)
 * para que persistence.js pueda intercambiarlas en runtime.
 *
 * Requiere que persistence.js llame a setDirHandle() con un handle ya
 * autorizado antes de usar cualquiera de los metodos CRUD.
 */

let _dirHandle = null;

const FILE = {
  clientes:      'clientes.json',
  participantes: 'participantes.json',
  sorteos:       'sorteos.json',
  config:        'config.json',
};

const KEY_FIELD = {
  clientes:      'key',
  participantes: 'id',
  sorteos:       'id',
};

/** Inyecta el handle del directorio activo. */
export function setDirHandle(handle) {
  _dirHandle = handle;
}

/** Libera el handle actual (para desactivar el backend sin recargar). */
export function clearDirHandle() {
  _dirHandle = null;
}

// ── Helpers de bajo nivel ──────────────────────────────────────────────────

async function readJson(filename) {
  if (!_dirHandle) throw new Error('No hay carpeta vinculada.');
  try {
    const fh = await _dirHandle.getFileHandle(filename, { create: false });
    const file = await fh.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (err) {
    // NotFoundError: el archivo aun no existe. Se considera "no hay datos".
    if (err.name === 'NotFoundError') return null;
    throw err;
  }
}

async function writeJson(filename, data) {
  if (!_dirHandle) throw new Error('No hay carpeta vinculada.');
  const fh = await _dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readAll(storeName) {
  const data = await readJson(FILE[storeName]);
  return Array.isArray(data) ? data : [];
}

async function writeAll(storeName, data) {
  await writeJson(FILE[storeName], data);
}

// ── CRUD generico ──────────────────────────────────────────────────────────

export async function getAll(storeName) {
  return readAll(storeName);
}

export async function get(storeName, key) {
  const all = await readAll(storeName);
  const kf  = KEY_FIELD[storeName];
  return all.find(item => item[kf] === key);
}

/** Upsert: inserta o reemplaza. Devuelve la key. */
export async function put(storeName, record) {
  const all = await readAll(storeName);
  const kf  = KEY_FIELD[storeName];
  const idx = all.findIndex(item => item[kf] === record[kf]);
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  await writeAll(storeName, all);
  return record[kf];
}

/** Insert con ID autoincremental. Devuelve el ID generado. */
export async function add(storeName, record) {
  const all   = await readAll(storeName);
  const maxId = all.reduce((m, item) => Math.max(m, item.id ?? 0), 0);
  const id    = maxId + 1;
  all.push({ ...record, id });
  await writeAll(storeName, all);
  return id;
}

export async function remove(storeName, key) {
  const all      = await readAll(storeName);
  const kf       = KEY_FIELD[storeName];
  const filtered = all.filter(item => item[kf] !== key);
  await writeAll(storeName, filtered);
}

export async function clear(storeName) {
  await writeAll(storeName, []);
}

export async function writeAllRecords(storeName, records) {
  await writeAll(storeName, records);
}

// ── Config ─────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULT = {
  key:              'app',
  titulo:           '',
  horaInicio:       '',
  totalRondas:      1,
  premiosPorRonda:  [''],
  rondaActual:      0,
  registroCerrado:  false,
  fechaCierre:      null,
  idsRondasDelDia:  [],
  idsSesionPasada:  [],
};

export async function getConfig() {
  const data = await readJson(FILE.config);
  return data ? { ...CONFIG_DEFAULT, ...data } : { ...CONFIG_DEFAULT };
}

export async function saveConfig(config) {
  await writeJson(FILE.config, { ...config, key: 'app' });
}

// ── Carga inicial ──────────────────────────────────────────────────────────

export async function cargarEstadoInicial() {
  const [clientes, participantes, sorteos, config] = await Promise.all([
    readAll('clientes'),
    readAll('participantes'),
    readAll('sorteos'),
    getConfig(),
  ]);

  return {
    clientes:      clientes.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    participantes: participantes.sort((a, b) => new Date(a.horaRegistro) - new Date(b.horaRegistro)),
    sorteos:       sorteos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    config,
  };
}

/** Indica si la carpeta actual esta vacia (ningun JSON tiene registros). */
export async function carpetaEstaVacia() {
  const datos = await cargarEstadoInicial();
  return (datos.clientes.length === 0
    && datos.participantes.length === 0
    && datos.sorteos.length === 0);
}
