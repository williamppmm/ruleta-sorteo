/**
 * Capa de acceso a IndexedDB
 *
 * Rescatado del prototipo (openDB, reqP, os) y extendido con helpers CRUD.
 * Base de datos: "sorteo_db" — versión 1
 *
 * Object stores:
 *   clientes     → base permanente de clientes (key: nombre normalizado)
 *   participantes → participantes del sorteo activo (autoincrement)
 *   sorteos      → historial permanente de sorteos (autoincrement)
 *   config       → una sola entrada { key: "app", ...campos }
 */

const DB_NAME = 'sorteo_db';
const DB_VERSION = 1;

export const STORES = {
  CLIENTES:      'clientes',
  PARTICIPANTES: 'participantes',
  SORTEOS:       'sorteos',
  CONFIG:        'config',
};

let _db = null;

/**
 * Abre (o reutiliza) la conexión a la base de datos.
 * Rescatado del prototipo — sin cambios estructurales.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORES.CLIENTES))
        d.createObjectStore(STORES.CLIENTES, { keyPath: 'key' });
      if (!d.objectStoreNames.contains(STORES.PARTICIPANTES))
        d.createObjectStore(STORES.PARTICIPANTES, { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains(STORES.SORTEOS))
        d.createObjectStore(STORES.SORTEOS, { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains(STORES.CONFIG))
        d.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
    };

    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror  = () => reject(req.error);
  });
}

/**
 * Convierte un IDBRequest en Promise.
 * Rescatado del prototipo — sin cambios.
 * @param {IDBRequest} req
 * @returns {Promise<any>}
 */
export function reqP(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/**
 * Abre un object store en una transacción.
 * Rescatado del prototipo — sin cambios.
 * @param {string} name
 * @param {'readonly'|'readwrite'} mode
 * @returns {IDBObjectStore}
 */
export function os(name, mode = 'readonly') {
  return _db.transaction(name, mode).objectStore(name);
}

// ─────────────────────────────────────────────
// Helpers CRUD genéricos
// ─────────────────────────────────────────────

/** Devuelve todos los registros de un store. */
export async function getAll(storeName) {
  await openDB();
  return reqP(os(storeName).getAll());
}

/** Devuelve un registro por su key. */
export async function get(storeName, key) {
  await openDB();
  return reqP(os(storeName).get(key));
}

/** Inserta o reemplaza un registro (upsert). */
export async function put(storeName, record) {
  await openDB();
  return reqP(os(storeName, 'readwrite').put(record));
}

/** Inserta un registro nuevo (para stores con autoincrement). Devuelve el id generado. */
export async function add(storeName, record) {
  await openDB();
  return reqP(os(storeName, 'readwrite').add(record));
}

/** Elimina un registro por su key. */
export async function remove(storeName, key) {
  await openDB();
  return reqP(os(storeName, 'readwrite').delete(key));
}

/** Elimina todos los registros de un store. */
export async function clear(storeName) {
  await openDB();
  return reqP(os(storeName, 'readwrite').clear());
}

/**
 * Escribe un array completo de registros en un store, reemplazando el contenido.
 * Más eficiente que clear + put individual para operaciones masivas (ej. restaurar backup).
 */
export async function writeAllRecords(storeName, records) {
  await openDB();
  await reqP(os(storeName, 'readwrite').clear());
  for (const rec of records) {
    await reqP(os(storeName, 'readwrite').put(rec));
  }
}

// ─────────────────────────────────────────────
// Helpers específicos del dominio
// ─────────────────────────────────────────────

/** Config por defecto cuando no hay nada guardado. */
export const CONFIG_DEFAULT = {
  key: 'app',
  titulo: '',
  horaInicio: '',
  totalRondas: 1,
  premiosPorRonda: [''],
  rondaActual: 0,
  registroCerrado: false,
  fechaCierre: null,
  idsRondasDelDia: [],
  // Snapshot de la sesion anterior, utilizado por GanadoresPanel para
  // seguir mostrando los ganadores pasados mientras se configura la
  // proxima sesion (se setea desde nuevaSesion).
  idsSesionPasada: [],
};

/** Lee la config guardada y la fusiona con los valores por defecto. */
export async function getConfig() {
  await openDB();
  const guardada = await reqP(os(STORES.CONFIG).get('app'));
  return guardada ? { ...CONFIG_DEFAULT, ...guardada } : { ...CONFIG_DEFAULT };
}

/** Persiste la config completa. */
export async function saveConfig(config) {
  await openDB();
  return reqP(os(STORES.CONFIG, 'readwrite').put({ ...config, key: 'app' }));
}

/** Carga todo el estado inicial de la app desde IndexedDB. */
export async function cargarEstadoInicial() {
  await openDB();

  const [clientes, participantes, sorteos, config] = await Promise.all([
    getAll(STORES.CLIENTES),
    getAll(STORES.PARTICIPANTES),
    getAll(STORES.SORTEOS),
    getConfig(),
  ]);

  return {
    clientes:      clientes.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    participantes: participantes.sort((a, b) => new Date(a.horaRegistro) - new Date(b.horaRegistro)),
    sorteos:       sorteos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    config,
  };
}
