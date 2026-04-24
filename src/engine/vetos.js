/**
 * Módulo de Vetos
 *
 * VETO INTRADÍA
 *   Un ganador del evento actual no vuelve a participar en las rondas siguientes
 *   del mismo evento. Se compara por nombre normalizado.
 *   Los vetados intradía se eliminan visualmente de la lista de participantes.
 *
 * Nota: el veto interdía (entre días) fue eliminado — los eventos son semanales,
 * no diarios, y la ventana de 0-2 días no corresponde a la realidad del negocio.
 * La prioridad entre ganadores recientes y nuevos se maneja con estrellas.
 */

import { normalizar } from '../utils/normalizar.js';

/**
 * Veto intradía: el participante ya ganó en alguna ronda del evento actual.
 *
 * @param {Object} participante - { nombre, ... }
 * @param {Object[]} ganadoresDelDia - Array de objetos { nombre, ... } que ya ganaron en este evento
 * @returns {boolean}
 */
export function estaVetadoIntradia(participante, ganadoresDelDia = []) {
  const nombreNorm = normalizar(participante.nombre);
  return ganadoresDelDia.some(g => normalizar(g.nombre) === nombreNorm);
}

/**
 * Clasifica participantes en elegibles y vetados intradía.
 *
 * @param {Object[]} participantes
 * @param {Object[]} _clientes - Conservado para compatibilidad con llamadas existentes; no se usa
 * @param {Object[]} ganadoresDelDia
 * @returns {{ elegibles: Object[], vetadosIntradia: Object[] }}
 */
export function clasificarParticipantes(participantes, _clientes = [], ganadoresDelDia = []) {
  const vetadosIntradia = [];
  const elegibles = [];

  for (const p of participantes) {
    if (estaVetadoIntradia(p, ganadoresDelDia)) {
      vetadosIntradia.push(p);
    } else {
      elegibles.push(p);
    }
  }

  return { elegibles, vetadosIntradia };
}
