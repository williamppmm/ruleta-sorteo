/**
 * Módulo de Probabilidades
 *
 * Selecciona un ganador mediante selección ponderada por grupo de estrellas,
 * usando aleatoridad criptográficamente segura.
 *
 * Pesos base por nivel:
 *   3★ → 60  (clientes frecuentes de alto valor)
 *   2★ → 30  (clientes diarios, inversión media-baja)
 *   1★ → 10  (clientes ocasionales)
 *   0★ →  0  (visitantes del día — solo compiten si no hay otros)
 *
 * Algoritmo:
 *   1. Aplicar vetos (intradía e interdía)
 *   2. Si solo hay 0★ → selección uniforme
 *   3. Excluir 0★ del pool efectivo
 *   4. Seleccionar grupo (3★/2★/1★) con ruleta ponderada
 *   5. Dentro del grupo ganador → selección uniforme entre sus miembros
 */

import { normalizar } from '../utils/normalizar.js';
import { clasificarParticipantes } from './vetos.js';

const PESOS_BASE = { 3: 60, 2: 30, 1: 10 };

/**
 * Selección de índice criptográficamente segura.
 * Rescatada del prototipo sin cambios.
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
 * Corregido respecto al prototipo (que usaba 1 como default).
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
 * Selecciona el ganador del sorteo aplicando vetos y pesos por estrellas.
 *
 * @param {Object[]} participantes - Todos los participantes visibles en el sorteo
 * @param {Object[]} clientes - Base de clientes con estrellas y fechaUltimoPremio
 * @param {Object[]} ganadoresDelDia - Ganadores de rondas anteriores del mismo día
 * @returns {Object} El participante ganador (con su nombre y datos originales)
 */
export function seleccionarGanador(participantes, clientes = [], ganadoresDelDia = []) {
  if (participantes.length === 0) {
    throw new Error('No hay participantes en el sorteo.');
  }

  // 1. Aplicar vetos — elegibles excluye intradía + interdía
  const { elegibles, vetadosIntradia } = clasificarParticipantes(
    participantes,
    clientes,
    ganadoresDelDia
  );

  // 2. Caso borde: todos vetados → usar todos (siempre debe haber ganador)
  const pool = elegibles.length > 0 ? elegibles : participantes;

  // 3. Enriquecer pool con estrellas desde la base de clientes
  const poolConEstrellas = pool.map(p => ({
    ...p,
    estrellas: obtenerEstrellas(p.nombre, clientes),
  }));

  // 4. Caso especial: todos tienen 0★ → selección uniforme
  const maxEstrellas = Math.max(...poolConEstrellas.map(p => p.estrellas));
  if (maxEstrellas === 0) {
    return pool[secureIndex(pool.length)];
  }

  // 5. Excluir los de 0★ del pool efectivo (hay participantes con más estrellas)
  const poolEfectivo = poolConEstrellas.filter(p => p.estrellas > 0);

  // 6. Agrupar por nivel de estrellas
  const grupos = { 3: [], 2: [], 1: [] };
  for (const p of poolEfectivo) {
    grupos[p.estrellas].push(p);
  }

  // 7. Construir grupos activos y peso total (normalización automática)
  const gruposActivos = [];
  let pesoTotal = 0;

  for (const nivel of [3, 2, 1]) {
    if (grupos[nivel].length > 0) {
      gruposActivos.push({ nivel, peso: PESOS_BASE[nivel], miembros: grupos[nivel] });
      pesoTotal += PESOS_BASE[nivel];
    }
  }

  // 8. Seleccionar grupo con ruleta ponderada (pesos normalizados automáticamente)
  const roll = secureIndex(pesoTotal);
  let acumulado = 0;
  let grupoSeleccionado = gruposActivos[0];

  for (const g of gruposActivos) {
    acumulado += g.peso;
    if (roll < acumulado) {
      grupoSeleccionado = g;
      break;
    }
  }

  // 9. Selección uniforme dentro del grupo ganador
  return grupoSeleccionado.miembros[secureIndex(grupoSeleccionado.miembros.length)];
}
