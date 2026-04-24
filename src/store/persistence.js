/**
 * Capa de persistencia unificada
 *
 * Detecta en tiempo de ejecución si la app corre dentro de Electron
 * y delega a fileDb (archivos JSON) o a db (IndexedDB) según corresponda.
 *
 * useStore.jsx importa desde aquí — no necesita saber qué backend hay debajo.
 */

import * as idb  from './db.js'
import * as fdb  from './fileDb.js'

// Re-exportar constantes que useStore.jsx necesita
export { STORES }      from './db.js'
export { CONFIG_DEFAULT } from './db.js'

/** Selecciona el backend correcto en runtime. */
function db() {
  return (typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined')
    ? fdb
    : idb
}

// ── API pública (misma interfaz que db.js) ─────────────────────────────────

export const cargarEstadoInicial = ()                     => db().cargarEstadoInicial()
export const getConfig           = ()                     => db().getConfig()
export const saveConfig          = (cfg)                  => db().saveConfig(cfg)
export const getAll              = (store)                => db().getAll(store)
export const get                 = (store, key)           => db().get(store, key)
export const put                 = (store, rec)           => db().put(store, rec)
export const add                 = (store, rec)           => db().add(store, rec)
export const remove              = (store, key)           => db().remove(store, key)
export const clear               = (store)                => db().clear(store)
export const writeAllRecords     = (store, records)       => db().writeAllRecords(store, records)
