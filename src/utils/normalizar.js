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

/**
 * Capitaliza la primera letra de cada palabra para mostrar nombres prolijos
 * en la UI y en los .json. Util cuando el operador tipea apurado
 * sin atender al casing.
 *
 * Ejemplos:
 *   capitalizar("juan perez")  -> "Juan Perez"
 *   capitalizar("MARIA GARCIA") -> "Maria Garcia"
 *   capitalizar("doña marina") -> "Doña Marina"
 *   capitalizar(" pedro ")     -> "Pedro"
 *   capitalizar("")            -> ""
 *
 * Nota: si el operador necesita preservar minusculas intencionales en
 * descriptores (ej: "Blanca suegra Javier"), puede editar el nombre desde
 * la pestana SuperAdmin -> Base de clientes despues del registro.
 *
 * @param {string} v
 * @returns {string}
 */
export function capitalizar(v) {
  if (!v) return '';
  return v
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(palabra => palabra.length > 0
      ? palabra[0].toUpperCase() + palabra.slice(1)
      : palabra
    )
    .join(' ');
}
