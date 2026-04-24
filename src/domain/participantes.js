/**
 * Dominio: Participantes
 *
 * Reglas de negocio relacionadas con el registro de participantes
 * en una sesión de sorteo activa.
 */

import { normalizar } from '../utils/normalizar.js';

/** Mínimo de participantes requeridos para la primera ronda del día. */
export const MIN_PARTICIPANTES_POR_RONDA = 10;

/**
 * Comprueba si un nombre ya existe en la lista de participantes activos.
 * La comparación es por nombre normalizado para evitar duplicados por mayúsculas
 * o espacios extra.
 *
 * @param {string}   nombre       - Nombre a validar
 * @param {Object[]} participantes - Lista de participantes activos { id, nombre, ... }
 * @param {number|null} excluirId - ID a excluir de la búsqueda (útil en edición)
 * @returns {boolean} true si el nombre ya está registrado
 */
export function validarDuplicado(nombre, participantes, excluirId = null) {
  const norm = normalizar(nombre);
  return participantes.some(
    p => p.id !== excluirId && normalizar(p.nombre) === norm
  );
}

/**
 * Devuelve cuántos participantes faltan para cumplir el mínimo.
 *
 * @param {number} total - Participantes actuales
 * @returns {number} Faltantes (0 si ya se cumple el mínimo)
 */
export function participantesFaltantes(total) {
  return Math.max(MIN_PARTICIPANTES_POR_RONDA - total, 0);
}

/**
 * Verifica si hay suficientes participantes para iniciar la primera ronda.
 *
 * @param {number}  totalParticipantes
 * @param {boolean} esPrimerSorteo - true si aún no se ha completado ninguna ronda hoy
 * @returns {boolean}
 */
export function cumpleMinimoParticipantes(totalParticipantes, esPrimerSorteo) {
  return !esPrimerSorteo || totalParticipantes >= MIN_PARTICIPANTES_POR_RONDA;
}
