/**
 * Dominio: Rondas y Configuración del Sorteo
 *
 * Reglas de negocio relacionadas con la configuración de rondas,
 * habilitación del flujo de sorteo y estado de la sesión.
 */

/**
 * Ajusta el array de premios al número de rondas solicitadas.
 * - Si hay menos premios que rondas, rellena con cadenas vacías.
 * - Si hay más premios, recorta el exceso.
 *
 * @param {string[]} premiosActuales - Array actual de premios por ronda
 * @param {number}   nuevasCantidad  - Nuevo número de rondas
 * @returns {string[]} Array normalizado con exactamente `nuevasCantidad` elementos
 */
export function normalizarPremios(premiosActuales, nuevasCantidad) {
  const arr = [...premiosActuales];
  while (arr.length < nuevasCantidad) arr.push('');
  return arr.slice(0, nuevasCantidad);
}

export function rondasCompletadas(config) {
  return config.idsRondasDelDia?.length ?? 0;
}

export function indiceRondaActiva(config) {
  const total = config.totalRondas ?? 1;
  return Math.min(rondasCompletadas(config), Math.max(total - 1, 0));
}

export function idsRondasPersistidos(config, sorteos) {
  const ids = config.idsRondasDelDia ?? [];
  const idsSorteos = new Set(sorteos.map(s => s.id));
  return ids.every(id => idsSorteos.has(id));
}

/**
 * Determina si el operador puede avanzar al sorteo.
 *
 * Condiciones:
 *  1. El registro de participantes debe estar cerrado.
 *  2. El sorteo del día no debe estar terminado (todas las rondas completadas).
 *  3. Si es la primera ronda del día, debe haber al menos `minimoParticipantes`.
 *
 * @param {Object}  config
 * @param {boolean} config.registroCerrado
 * @param {boolean} sorteoTerminado
 * @param {number}  totalParticipantes
 * @param {number}  minimoParticipantes
 * @returns {boolean}
 */
export function puedeIrAlSorteo(config, sorteoTerminado, totalParticipantes, minimoParticipantes) {
  if (!config.registroCerrado) return false;
  if (sorteoTerminado) return false;
  const esPrimeraSesion = rondasCompletadas(config) === 0;
  if (esPrimeraSesion && totalParticipantes < minimoParticipantes) return false;
  return true;
}
