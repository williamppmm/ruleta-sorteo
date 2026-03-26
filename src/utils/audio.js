/**
 * Utilidades de audio - rescatadas del prototipo.
 */

let audioCtx = null
let compressor = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    // Compresor dinamico: maximiza la señal antes de la salida (clave para HDMI/TV)
    compressor = audioCtx.createDynamicsCompressor()
    compressor.threshold.value = -6
    compressor.knee.value = 3
    compressor.ratio.value = 4
    compressor.attack.value = 0.002
    compressor.release.value = 0.1
    compressor.connect(audioCtx.destination)
  }
  // Reanudar si el contexto fue suspendido (ej: cambio de dispositivo HDMI)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

/**
 * Emite un beep de frecuencia y duracion configurables.
 * @param {number} freq  - Frecuencia en Hz (default 880)
 * @param {number} dur   - Duracion en segundos (default 0.06)
 * @param {number} gain  - Volumen 0-1 (default 0.35)
 */
export function beep(freq = 880, dur = 0.06, gain = 0.35) {
  try {
    const ctx = getCtx()
    reproducirTonoProgramado(ctx, freq, ctx.currentTime, dur, gain)
  } catch (e) {
    // Silenciar errores de audio para no interrumpir la animacion.
  }
}

/** Ding de victoria: dos tonos ascendentes con reloj de AudioContext. */
export function ding() {
  try {
    const ctx = getCtx()
    const base = ctx.currentTime
    reproducirTonoProgramado(ctx, 880, base, 0.085, 0.45)
    reproducirTonoProgramado(ctx, 1320, base + 0.078, 0.115, 0.4)
  } catch (e) {
    // Silenciar errores de audio para no interrumpir la animacion.
  }
}

function reproducirTonoProgramado(ctx, freq, startAt, dur, gain) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, startAt)
  g.gain.setValueAtTime(0.0001, startAt)
  g.gain.linearRampToValueAtTime(gain, startAt + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
  o.connect(g)
  g.connect(compressor)
  o.start(startAt)
  o.stop(startAt + dur)
}
