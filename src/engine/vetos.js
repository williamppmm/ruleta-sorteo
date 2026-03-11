/**
 * Módulo de Vetos
 *
 * VETO INTRADÍA
 *   Un ganador no aparece en la cuadrícula del siguiente sorteo del mismo día.
 *   Se compara por nombre normalizado.
 *   Los vetados intradía se eliminan visualmente de la lista de participantes.
 *
 * VETO INTERDÍA
 *   Un ganador no puede ganar en los 2 días calendario siguientes a su victoria.
 *   SÍ aparece en la cuadrícula (el público lo ve participar).
 *   El algoritmo lo filtra internamente antes de calcular probabilidades.
 */

import { normalizar } from '../utils/normalizar.js';

/**
 * Veto intradía: el participante ya ganó en alguna ronda del sorteo de hoy.
 *
 * @param {Object} participante - { nombre, ... }
 * @param {Object[]} ganadoresDelDia - Array de objetos { nombre, ... } que ya ganaron hoy
 * @returns {boolean}
 */
export function estaVetadoIntradia(participante, ganadoresDelDia = []) {
  const nombreNorm = normalizar(participante.nombre);
  return ganadoresDelDia.some(g => normalizar(g.nombre) === nombreNorm);
}

/**
 * Veto interdía: el participante ganó hace 1 o 2 días calendario.
 * La comparación es por días enteros (no horas exactas).
 *
 * @param {Object} participante - { nombre, ... }
 * @param {Object[]} clientes - Base de clientes con { key, fechaUltimoPremio, ... }
 * @returns {boolean}
 */
export function estaVetadoInterdia(participante, clientes = []) {
  const key = normalizar(participante.nombre);
  const cliente = clientes.find(c => c.key === key);
  if (!cliente || !cliente.fechaUltimoPremio) return false;

  // Comparar días calendario completos (no ms exactos)
  const hoy = new Date(new Date().toDateString());
  const fechaGanado = new Date(new Date(cliente.fechaUltimoPremio).toDateString());
  const diffDias = Math.floor((hoy - fechaGanado) / 86400000);

  // 0 = ganó hoy, 1 = ayer, 2 = antes de ayer → vetado en los tres casos
  return diffDias >= 0 && diffDias <= 2;
}

/**
 * Clasifica participantes en elegibles y vetados (intradía + interdía).
 * Los vetados interdía aún aparecen en la cuadrícula visual; solo se usan
 * aquí para excluirlos del cálculo de probabilidades.
 *
 * @param {Object[]} participantes
 * @param {Object[]} clientes
 * @param {Object[]} ganadoresDelDia
 * @returns {{ elegibles: Object[], vetadosIntradia: Object[], vetadosInterdia: Object[] }}
 */
export function clasificarParticipantes(participantes, clientes = [], ganadoresDelDia = []) {
  const vetadosIntradia = [];
  const vetadosInterdia = [];
  const elegibles = [];

  for (const p of participantes) {
    if (estaVetadoIntradia(p, ganadoresDelDia)) {
      vetadosIntradia.push(p);
    } else if (estaVetadoInterdia(p, clientes)) {
      vetadosInterdia.push(p);
    } else {
      elegibles.push(p);
    }
  }

  return { elegibles, vetadosIntradia, vetadosInterdia };
}
