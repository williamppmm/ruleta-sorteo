/**
 * Capa de persistencia unificada
 *
 * Detecta en tiempo de ejecucion que backend usar:
 *   1. Electron (window.electronAPI) -> fileDb (archivos JSON via IPC nativo)
 *   2. Carpeta vinculada via File System Access API -> fsHandleDb
 *   3. Fallback -> db (IndexedDB del navegador)
 *
 * El modo (1) se detecta inmediatamente por la presencia de window.electronAPI.
 * El modo (2) requiere que el usuario haya vinculado previamente una carpeta
 * y que el permiso siga concedido. Si no, se cae al modo (3).
 *
 * useStore.jsx importa desde aqui y llama a inicializarBackend() antes de la
 * primera carga de datos.
 */

import * as idb  from './db.js'
import * as fdb  from './fileDb.js'
import * as fsdb from './fsHandleDb.js'
import { loadHandle, verificarPermiso, soportaFileSystemAccess } from './handleStore.js'

// Re-exportar constantes que useStore.jsx necesita
export { STORES }         from './db.js'
export { CONFIG_DEFAULT } from './db.js'

// Estado del backend seleccionado.
// Default: IndexedDB puro, hasta que inicializarBackend resuelva otra cosa.
let _backend = idb
let _modo = { tipo: 'idb' }

/**
 * Resuelve y activa el backend apropiado para este entorno.
 * Debe llamarse antes de la primera operacion de persistencia.
 *
 * @returns {Promise<{tipo: string, nombre?: string, handlePendiente?: FileSystemDirectoryHandle}>}
 */
export async function inicializarBackend() {
  // Modo Electron: siempre prioritario si esta disponible
  if (typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined') {
    _backend = fdb
    _modo    = { tipo: 'electron' }
    return _modo
  }

  // Modo carpeta: si hay un handle guardado y con permiso vigente
  if (soportaFileSystemAccess) {
    try {
      const handle = await loadHandle()
      if (handle) {
        const permitido = await verificarPermiso(handle, false)
        if (permitido) {
          fsdb.setDirHandle(handle)
          _backend = fsdb
          _modo    = { tipo: 'carpeta', handle, nombre: handle.name }
          return _modo
        }
        // Handle guardado pero el permiso caduco (o esta en 'prompt').
        // Nos quedamos con IndexedDB por ahora; la UI tendra que pedir el
        // re-otorgamiento con un gesto del usuario.
        _backend = idb
        _modo = { tipo: 'idb', handlePendiente: handle, nombre: handle.name }
        return _modo
      }
    } catch (err) {
      console.warn('[persistence] Error al cargar handle:', err?.message)
    }
  }

  _backend = idb
  _modo    = { tipo: 'idb' }
  return _modo
}

/**
 * Activa el modo carpeta con un handle ya autorizado.
 * La UI debe llamar esta funcion despues de showDirectoryPicker + save.
 */
export function activarBackendCarpeta(handle) {
  fsdb.setDirHandle(handle)
  _backend = fsdb
  _modo    = { tipo: 'carpeta', handle, nombre: handle.name }
}

/** Vuelve al modo IndexedDB puro (desvincula carpeta). */
export function desactivarBackendCarpeta() {
  fsdb.clearDirHandle()
  _backend = idb
  _modo    = { tipo: 'idb' }
}

/** Informa el modo actual (util para la UI). */
export function modoActual() {
  return _modo
}

/**
 * Lee el contenido de una carpeta candidata sin activar el backend.
 * Util para decidir como migrar al vincular una carpeta nueva.
 */
export async function inspeccionarCarpeta(handle) {
  fsdb.setDirHandle(handle)
  return fsdb.cargarEstadoInicial()
}

/**
 * Escribe un snapshot de datos en una carpeta candidata sin activar el backend.
 * Util para migrar datos locales a la carpeta al vincularla por primera vez.
 *
 * @param {FileSystemDirectoryHandle} handle
 * @param {{ clientes, participantes, sorteos, config }} datos
 */
export async function escribirInicialEnCarpeta(handle, datos) {
  fsdb.setDirHandle(handle)
  await fsdb.writeAllRecords('clientes',      datos.clientes      || [])
  await fsdb.writeAllRecords('participantes', datos.participantes || [])
  await fsdb.writeAllRecords('sorteos',       datos.sorteos       || [])
  if (datos.config) await fsdb.saveConfig(datos.config)
}

// ── API publica (misma interfaz que db.js / fileDb.js / fsHandleDb.js) ────

export const cargarEstadoInicial = ()                     => _backend.cargarEstadoInicial()
export const getConfig           = ()                     => _backend.getConfig()
export const saveConfig          = (cfg)                  => _backend.saveConfig(cfg)
export const getAll              = (store)                => _backend.getAll(store)
export const get                 = (store, key)           => _backend.get(store, key)
export const put                 = (store, rec)           => _backend.put(store, rec)
export const add                 = (store, rec)           => _backend.add(store, rec)
export const remove              = (store, key)           => _backend.remove(store, key)
export const clear               = (store)                => _backend.clear(store)
export const writeAllRecords     = (store, records)       => _backend.writeAllRecords(store, records)
