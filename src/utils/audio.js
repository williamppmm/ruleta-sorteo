/**
 * Utilidades de audio — rescatadas del prototipo sin cambios.
 */

let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioCtx
}

/**
 * Emite un beep de frecuencia y duración configurables.
 * @param {number} freq  - Frecuencia en Hz (default 880)
 * @param {number} dur   - Duración en segundos (default 0.06)
 * @param {number} gain  - Volumen 0–1 (default 0.05)
 */
export function beep(freq = 880, dur = 0.06, gain = 0.05) {
  try {
    const ctx = getCtx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.value = gain
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur)
  } catch (e) {
    // Silenciar errores de audio para no interrumpir la animación
  }
}

/** Ding de victoria: dos tonos ascendentes. Rescatado del prototipo. */
export function ding() {
  beep(880, 0.09, 0.06)
  setTimeout(() => beep(1320, 0.12, 0.05), 80)
}
