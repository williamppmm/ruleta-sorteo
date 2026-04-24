/**
 * Helpers de formato — rescatados del prototipo sin cambios.
 */

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const pad = n => String(n).padStart(2, '0')

/** "HH:MM:SS" */
export function fmtTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** "DD-mes-YYYY HH:MM am/pm" */
export function fmtLong(d) {
  let h = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${pad(d.getDate())}-${MESES[d.getMonth()]}-${d.getFullYear()} ${h}:${pad(d.getMinutes())} ${ampm}`
}

/**
 * Formatea un valor de premio: agrega $ y puntos de miles.
 * Rescatado del prototipo sin cambios.
 * @param {string|number} value
 * @returns {string} Ej: "$5.000"
 */
export function formatPrize(value) {
  if (!value) return ''
  const numbers = String(value).replace(/[^\d]/g, '')
  if (!numbers) return String(value)
  const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return String(value).includes('$') ? '$' + formatted : '$' + formatted
}

/** Escapa HTML para evitar XSS al insertar texto en el DOM. */
export function safeText(v) {
  const div = document.createElement('div')
  div.textContent = v || ''
  return div.innerHTML
}

/**
 * Formatea un ISO string como "HH:MM:SS".
 * Devuelve "—" si el valor es nulo o inválido.
 * @param {string|null} iso
 * @returns {string}
 */
export function fmtHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * Formatea un ISO string como "DD mmm YYYY" (ej: "08 abr 2026").
 * Devuelve "—" si el valor es nulo.
 * @param {string|null} iso
 * @returns {string}
 */
export function fmtFechaCorta(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/**
 * Formatea un ISO string como "DD mmm YYYY" (alias de fmtFechaCorta).
 * @param {string|null} iso
 * @returns {string}
 */
export const fmtFechaLarga = fmtFechaCorta
