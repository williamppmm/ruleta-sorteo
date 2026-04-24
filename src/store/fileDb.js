/**
 * Capa de persistencia basada en archivos JSON (modo Electron).
 *
 * Replica la misma interfaz pública que db.js para que
 * persistence.js pueda intercambiarlos de forma transparente.
 *
 * Archivos:
 *   clientes.json      → base permanente de clientes
 *   participantes.json → participantes del sorteo activo
 *   sorteos.json       → historial permanente de sorteos
 *   config.json        → configuración de la app
 *
 * Notas de contrato:
 *   - add()  devuelve el ID numérico generado (igual que IndexedDB autoincrement)
 *   - put()  devuelve la key del registro (igual que IndexedDB put)
 *   - remove(), clear() no retornan valor significativo
 */

import { desktopApi } from '../services/desktopApi.js'

// ── Mapa store → archivo ───────────────────────────────────────────────────

const FILE = {
  clientes:      'clientes.json',
  participantes: 'participantes.json',
  sorteos:       'sorteos.json',
  config:        'config.json',
}

// Campo que actúa como clave primaria por store
const KEY_FIELD = {
  clientes:      'key',
  participantes: 'id',
  sorteos:       'id',
}

// ── Helpers de bajo nivel ──────────────────────────────────────────────────

async function readAll(storeName) {
  const data = await desktopApi.readFile(FILE[storeName])
  return Array.isArray(data) ? data : []
}

async function writeAll(storeName, data) {
  await desktopApi.writeFile(FILE[storeName], data)
}

// ── CRUD genérico ──────────────────────────────────────────────────────────

/** Devuelve todos los registros de un store. */
export async function getAll(storeName) {
  return readAll(storeName)
}

/** Devuelve un registro por su key, o undefined. */
export async function get(storeName, key) {
  const all  = await readAll(storeName)
  const kf   = KEY_FIELD[storeName]
  return all.find(item => item[kf] === key)
}

/**
 * Inserta o reemplaza un registro (upsert).
 * Devuelve la key del registro, igual que IDBObjectStore.put().
 */
export async function put(storeName, record) {
  const all = await readAll(storeName)
  const kf  = KEY_FIELD[storeName]
  const idx = all.findIndex(item => item[kf] === record[kf])
  if (idx >= 0) {
    all[idx] = record
  } else {
    all.push(record)
  }
  await writeAll(storeName, all)
  return record[kf]
}

/**
 * Inserta un registro nuevo generando un ID autoincremental.
 * Devuelve el ID numérico generado, igual que IDBObjectStore.add().
 */
export async function add(storeName, record) {
  const all   = await readAll(storeName)
  const maxId = all.reduce((m, item) => Math.max(m, item.id ?? 0), 0)
  const id    = maxId + 1
  all.push({ ...record, id })
  await writeAll(storeName, all)
  return id
}

/** Elimina un registro por su key. */
export async function remove(storeName, key) {
  const all      = await readAll(storeName)
  const kf       = KEY_FIELD[storeName]
  const filtered = all.filter(item => item[kf] !== key)
  await writeAll(storeName, filtered)
}

/** Elimina todos los registros de un store. */
export async function clear(storeName) {
  await writeAll(storeName, [])
}

/**
 * Escribe un array completo de registros en un store, reemplazando el contenido.
 * Más eficiente que clear + put individual para operaciones masivas (ej. restaurar backup).
 */
export async function writeAllRecords(storeName, records) {
  await writeAll(storeName, records)
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
}

/** Lee la config y la fusiona con los valores por defecto. */
export async function getConfig() {
  const data = await desktopApi.readFile(FILE.config)
  return data ? { ...CONFIG_DEFAULT, ...data } : { ...CONFIG_DEFAULT }
}

/** Persiste la config completa. */
export async function saveConfig(config) {
  await desktopApi.writeFile(FILE.config, { ...config, key: 'app' })
}

// ── Carga inicial ──────────────────────────────────────────────────────────

/** Carga todo el estado inicial de la app desde los archivos JSON. */
export async function cargarEstadoInicial() {
  const [clientes, participantes, sorteos, config] = await Promise.all([
    readAll('clientes'),
    readAll('participantes'),
    readAll('sorteos'),
    getConfig(),
  ])

  return {
    clientes:      clientes.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    participantes: participantes.sort((a, b) => new Date(a.horaRegistro) - new Date(b.horaRegistro)),
    sorteos:       sorteos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    config,
  }
}
