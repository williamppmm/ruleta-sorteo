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
