/**
 * Módulo de Probabilidades
 *
 * Selecciona un ganador con prioridad estricta por nivel de estrellas:
 * cualquier 3★ pesa más que cualquier 2★, cualquier 2★ más que cualquier 1★,
 * y un 0★ solo gana si no hay nadie con estrellas en el pool.
 *
 * Algoritmo:
 *   1. Aplicar veto intradía — un ganador del evento actual no participa otra vez.
 *   2. nivel_max = máximo de estrellas entre los elegibles.
 *   3. candidatos = elegibles con estrellas === nivel_max.
 *   4. Ganador uniforme entre los candidatos (aleatoriedad criptográfica).
 *
 * Si todos los participantes están vetados, se hace fallback al pool completo
 * para garantizar que siempre haya un ganador.
 */

import { normalizar } from '../utils/normalizar.js';
import { clasificarParticipantes } from './vetos.js';

/**
 * Selección de índice criptográficamente segura.
 *
 * @param {number} max - Límite exclusivo (devuelve un valor en [0, max))
 * @returns {number}
 */
export function secureIndex(max) {
  const buf = new Uint32Array(1);
  const limit = 0xffffffff - (0xffffffff % max);
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/**
 * Obtiene las estrellas de un participante buscando en la base de clientes.
 * Default: 0★ si el nombre no existe en la base.
 *
 * @param {string} nombre - Nombre del participante
 * @param {Object[]} clientes - Array con { key, estrellas }
 * @returns {number} 0, 1, 2 o 3
 */
export function obtenerEstrellas(nombre, clientes = []) {
  const key = normalizar(nombre);
  const cliente = clientes.find(c => c.key === key);
  return cliente ? (cliente.estrellas ?? 0) : 0;
}

/**
 * Selecciona el ganador del sorteo con prioridad estricta por estrellas.
 *
 * @param {Object[]} participantes - Todos los participantes visibles en el sorteo
 * @param {Object[]} clientes - Base de clientes con estrellas
 * @param {Object[]} ganadoresDelDia - Ganadores de rondas anteriores del mismo evento
 * @returns {Object} El participante ganador (con su nombre y datos originales)
 */
export function seleccionarGanador(participantes, clientes = [], ganadoresDelDia = []) {
  if (participantes.length === 0) {
    throw new Error('No hay participantes en el sorteo.');
  }

  // 1. Aplicar veto intradía — excluir a quienes ya ganaron en este evento.
  const { elegibles } = clasificarParticipantes(participantes, clientes, ganadoresDelDia);

  // 2. Fallback: si todos están vetados, usar todos (siempre debe haber ganador).
  const pool = elegibles.length > 0 ? elegibles : participantes;

  // 3. Enriquecer con estrellas desde la base de clientes.
  const poolConEstrellas = pool.map(p => ({
    ...p,
    estrellas: obtenerEstrellas(p.nombre, clientes),
  }));

  // 4. Prioridad estricta: solo compiten quienes tienen el nivel máximo de estrellas.
  const maxEstrellas = Math.max(...poolConEstrellas.map(p => p.estrellas));
  const candidatos = poolConEstrellas.filter(p => p.estrellas === maxEstrellas);

  // 5. Ganador uniforme entre los candidatos.
  return candidatos[secureIndex(candidatos.length)];
}
