/**
 * Almacen auxiliar en IndexedDB para persistir el FileSystemDirectoryHandle.
 *
 * El handle es un objeto opaco del navegador que no se puede serializar a
 * JSON ni a localStorage, pero si se puede guardar en IndexedDB.
 * Vive en su propia base (sorteo_handle_db) para no chocar con sorteo_db
 * que guarda los datos de negocio.
 */

const HANDLE_DB    = 'sorteo_handle_db';
const HANDLE_STORE = 'handles';
const HANDLE_KEY   = 'dataFolder';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function saveHandle(handle) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

export async function loadHandle() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function clearHandle() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Verifica el permiso de lectura/escritura de un handle.
 *
 * @param {FileSystemDirectoryHandle} handle
 * @param {boolean} interactivo - Si true, solicita permiso al usuario (requiere gesto)
 * @returns {Promise<boolean>} true si el permiso esta concedido
 */
export async function verificarPermiso(handle, interactivo = false) {
  if (!handle || typeof handle.queryPermission !== 'function') return false;
  const opts = { mode: 'readwrite' };
  let estado = await handle.queryPermission(opts);
  if (estado === 'granted') return true;
  if (estado === 'denied')  return false;
  // estado === 'prompt'
  if (!interactivo) return false;
  estado = await handle.requestPermission(opts);
  return estado === 'granted';
}

/** Flag de disponibilidad del File System Access API en este navegador. */
export const soportaFileSystemAccess =
  typeof window !== 'undefined'
  && typeof window.showDirectoryPicker === 'function';
