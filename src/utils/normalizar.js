/**
 * Normaliza un nombre para comparación consistente entre participantes y clientes.
 * Rescatado del prototipo (función `norm`) — sin cambios.
 *
 * @param {string} v
 * @returns {string} Lowercase, sin espacios extra al inicio/fin, espacios internos simples
 */
export function normalizar(v) {
  return (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
