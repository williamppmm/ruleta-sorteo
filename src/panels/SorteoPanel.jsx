import { useState, useRef, useCallback, useEffect } from 'react'
// eslint-disable-next-line no-unused-vars -- motion se usa como <motion.div> (JSX member expression)
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore.jsx'
import { seleccionarGanador } from '../engine/probabilidades.js'
import { estaVetadoIntradia } from '../engine/vetos.js'
import { formatPrize } from '../utils/helpers.js'
import { beep, ding } from '../utils/audio.js'
import { MIN_PARTICIPANTES_POR_RONDA, cumpleMinimoParticipantes, participantesFaltantes } from '../domain/participantes.js'
import { idsRondasPersistidos, indiceRondaActiva } from '../domain/rondas.js'

const DURACION_ANIMACION = 7200
const PAUSA_GANADOR_MS = 900
const COLORES = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6']

function secureIdx(max) {
  const buf = new Uint32Array(1)
  const limit = 0xffffffff - (0xffffffff % max)
  let x
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % max
}

function construirSecuencia(totalBoxes, targetIdx) {
  if (totalBoxes <= 1) return [targetIdx]

  let actual = secureIdx(totalBoxes)
  const secuencia = []
  const pasosBase = Math.max(30, totalBoxes * 9)

  for (let i = 0; i < pasosBase; i += 1) {
    actual = (actual + 1) % totalBoxes
    secuencia.push(actual)
  }

  return [
    ...secuencia,
    (targetIdx - 3 + totalBoxes) % totalBoxes,
    (targetIdx - 2 + totalBoxes) % totalBoxes,
    (targetIdx - 1 + totalBoxes) % totalBoxes,
    targetIdx,
    targetIdx,
    targetIdx,
  ]
}

export default function SorteoPanel({ onGanador }) {
  const { state, actions, derived } = useStore()
  const { recargarEstadoDesdeDisco } = actions
  const [fase, setFase] = useState('espera')
  const [ganadorNombre, setGanadorNombre] = useState(null)
  const [indiceActivo, setIndiceActivo] = useState(null)
  const [indiceGanador, setIndiceGanador] = useState(null)
  const [participantesSnapshot, setParticipantesSnapshot] = useState([])
  const [estadoSincronizacion, setEstadoSincronizacion] = useState('verificando')
  const [mensajeSincronizacion, setMensajeSincronizacion] = useState('Verificando datos del sorteo...')
  const animRef = useRef(null)
  const timeoutRef = useRef(null)
  const settleTimeoutRef = useRef(null)
  const sorteoEnCursoRef = useRef(false)

  const cfg = state.config
  const total = cfg.totalRondas
  const premio = derived.premioRondaActual

  const visibles = state.participantes.filter(
    p => !estaVetadoIntradia(p, derived.ganadoresDelDia)
  )
  const participantesRender = fase === 'espera' ? visibles : participantesSnapshot
  const rondasCompletadas = cfg.idsRondasDelDia?.length ?? 0
  const ronda = indiceRondaActiva(cfg)
  const todasRondasCompletadas = rondasCompletadas >= cfg.totalRondas
  const esPrimerSorteoDeLaSesion = rondasCompletadas === 0
  const faltantesMinimos = participantesFaltantes(visibles.length)
  const cumpleMinimo = cumpleMinimoParticipantes(visibles.length, esPrimerSorteoDeLaSesion)
  const datosListosParaSorteo = estadoSincronizacion === 'listo'

  const logDebug = useCallback((mensaje, data = null) => {
    const stamp = new Date().toLocaleTimeString('es-CO', { hour12: false })
    console.log(`[Sorteo ${stamp}] ${mensaje}`, data ?? '')
  }, [])

  const limpiarAnimacion = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
  }, [])

  useEffect(() => () => limpiarAnimacion(), [limpiarAnimacion])

  useEffect(() => {
    if (fase !== 'espera' || todasRondasCompletadas) return

    let cancelado = false

    async function verificarDatos() {
      try {
        await Promise.resolve()
        if (cancelado) return
        setEstadoSincronizacion('verificando')
        setMensajeSincronizacion('Verificando datos del sorteo...')

        const datos = await recargarEstadoDesdeDisco()
        if (cancelado) return
        if (!idsRondasPersistidos(datos.config, datos.sorteos)) {
          setEstadoSincronizacion('bloqueado')
          setMensajeSincronizacion('Esperando sincronizacion de la ronda anterior. Vuelve al panel y entra de nuevo en unos segundos.')
          return
        }
        setEstadoSincronizacion('listo')
        setMensajeSincronizacion('')
      } catch (err) {
        if (cancelado) return
        setEstadoSincronizacion('bloqueado')
        setMensajeSincronizacion('No se pudieron verificar los datos del sorteo: ' + err.message)
      }
    }

    verificarDatos()

    return () => {
      cancelado = true
    }
  }, [recargarEstadoDesdeDisco, fase, todasRondasCompletadas])

  const animarRuleta = useCallback((targetName, participantesAnimacion) => {
    return new Promise(resolve => {
      const targetIdx = participantesAnimacion.findIndex(p => p.nombre === targetName)
      if (targetIdx < 0) {
        logDebug('No se encontro el objetivo dentro de los participantes visibles.', {
          targetName,
          visibles: participantesAnimacion.map(p => p.nombre),
        })
        resolve()
        return
      }

      const secuencia = construirSecuencia(participantesAnimacion.length, targetIdx)
      // El targetIdx aparece por primera vez en la posición secuencia.length - 3
      const idxPrimerTarget = secuencia.length - 3
      const inicio = performance.now()
      let dingDisparado = false

      logDebug('Animacion iniciada.', {
        targetName,
        targetIdx,
        participantes: participantesAnimacion.map(p => p.nombre),
        pasos: secuencia.length,
      })

      setIndiceGanador(null)
      setIndiceActivo(secuencia[0] ?? targetIdx)

      function tick(now) {
        const progress = Math.min((now - inicio) / DURACION_ANIMACION, 1)
        const eased = 1 - Math.pow(1 - progress, 2.6)
        const idxSecuencia = Math.min(
          secuencia.length - 1,
          Math.floor(eased * secuencia.length)
        )
        const idx = secuencia[idxSecuencia] ?? targetIdx

        setIndiceActivo(prev => (prev === idx ? prev : idx))

        // Dispara ding y marca ganador en cuanto la animación visualmente aterriza
        if (!dingDisparado && idxSecuencia >= idxPrimerTarget) {
          setIndiceGanador(targetIdx)
          ding()
          dingDisparado = true
        }

        if (progress < 0.985) {
          if (!dingDisparado) {
          beep(500 + progress * 650, 0.025, 0.25 + progress * 0.1)
          }
          animRef.current = requestAnimationFrame(tick)
          return
        }

        setIndiceActivo(targetIdx)
        settleTimeoutRef.current = setTimeout(() => {
          setIndiceActivo(null)
          logDebug('Animacion finalizada.', { targetName, targetIdx })
          resolve()
        }, PAUSA_GANADOR_MS)
      }

      animRef.current = requestAnimationFrame(tick)
    })
  }, [logDebug])

  const iniciar = useCallback(async () => {
    if (sorteoEnCursoRef.current || fase !== 'espera' || visibles.length === 0) return
    if (todasRondasCompletadas) return
    if (!datosListosParaSorteo) return
    if (!cumpleMinimo) {
      logDebug('Intento bloqueado por minimo de participantes.', {
        visibles: visibles.length,
        minimo: MIN_PARTICIPANTES_POR_RONDA,
      })
      return
    }
    sorteoEnCursoRef.current = true

    let ganador
    let visiblesSorteo = []
    let premioSorteo = premio
    let configSorteo = cfg
    let snapshot
    try {
      snapshot = await actions.recargarEstadoDesdeDisco()
      configSorteo = snapshot.config

      const idsRondas = configSorteo.idsRondasDelDia || []
      if (idsRondas.length >= configSorteo.totalRondas) {
        logDebug('Intento bloqueado porque la sesion ya esta completa en disco.', {
          idsRondas,
          totalRondas: configSorteo.totalRondas,
        })
        sorteoEnCursoRef.current = false
        return
      }

      const ganadoresDelDiaActuales = snapshot.sorteos
        .filter(s => idsRondas.includes(s.id))
        .map(s => ({ nombre: s.ganadorNombre }))
      visiblesSorteo = snapshot.participantes.filter(
        p => !estaVetadoIntradia(p, ganadoresDelDiaActuales)
      )

      const esPrimerSorteoActual = idsRondas.length === 0
      if (!cumpleMinimoParticipantes(visiblesSorteo.length, esPrimerSorteoActual)) {
        logDebug('Intento bloqueado por minimo de participantes despues de recargar.', {
          visibles: visiblesSorteo.length,
          minimo: MIN_PARTICIPANTES_POR_RONDA,
        })
        sorteoEnCursoRef.current = false
        return
      }

      const indicePremio = idsRondas.length
      premioSorteo =
        configSorteo.premiosPorRonda?.[indicePremio]
        ?? configSorteo.premiosPorRonda?.[configSorteo.rondaActual]
        ?? premio

      ganador = seleccionarGanador(visiblesSorteo, snapshot.clientes, ganadoresDelDiaActuales)
      logDebug('Ganador calculado por el motor.', {
        ganador,
        visibles: visiblesSorteo.map(p => p.nombre),
        clientes: snapshot.clientes.length,
        ganadoresDelDia: ganadoresDelDiaActuales,
      })
    } catch (e) {
      sorteoEnCursoRef.current = false
      logDebug('Error al seleccionar ganador.', { message: e.message })
      alert('Error al seleccionar ganador: ' + e.message)
      return
    }

    if (!ganador?.nombre) {
      logDebug('El motor devolvio un resultado invalido.', { ganador })
      alert('El sorteo no pudo continuar porque el ganador calculado es invalido.')
      setFase('espera')
      sorteoEnCursoRef.current = false
      return
    }

    limpiarAnimacion()
    setGanadorNombre(null)
    setIndiceGanador(null)
    setParticipantesSnapshot(visiblesSorteo)
    setFase('animando')

    try {
      await animarRuleta(ganador.nombre, visiblesSorteo)

      const sorteo = await actions.registrarGanador({
        ganadorNombre: ganador.nombre,
        valorPremio: premioSorteo,
        titulo: configSorteo.titulo,
        clientesSnapshot: snapshot.clientes,
        totalParticipantes: snapshot.participantes.length,
      })
      logDebug('Ganador registrado en el historial.', { sorteo })

      setGanadorNombre(ganador.nombre)
      setFase('ganador')
      timeoutRef.current = setTimeout(() => onGanador(sorteo), 5200)
    } catch (e) {
      sorteoEnCursoRef.current = false
      setFase('espera')
      logDebug('Error al registrar el ganador.', { message: e.message })
      alert('Error al guardar el ganador: ' + e.message)
    }
  }, [
    actions,
    animarRuleta,
    cfg,
    fase,
    limpiarAnimacion,
    logDebug,
    onGanador,
    premio,
    cumpleMinimo,
    datosListosParaSorteo,
    todasRondasCompletadas,
    visibles,
  ])

  return (
    <div className="aurora-bg min-h-screen flex flex-col">
      <div style={{ visibility: fase === 'ganador' ? 'hidden' : 'visible' }}>
        <header className="text-center pt-6 pb-3 px-4 shrink-0">
        <h1
          className="font-black text-yellow-400 tracking-wide drop-shadow"
          style={{ fontSize: 'clamp(1.6rem, 3vw, 2.8rem)' }}
        >
          {cfg.titulo || 'Sorteo en Vivo'}
        </h1>
        <div
          className="flex items-center justify-center gap-6 mt-2 text-gray-300"
          style={{ fontSize: 'clamp(1rem, 1.6vw, 1.35rem)' }}
        >
          <span>
            Ronda <strong className="text-white">{ronda + 1}</strong> de {total}
          </span>
          <span className="text-gray-600">|</span>
          <span>
            {participantesRender.length} participante{participantesRender.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="text-center py-3 shrink-0">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Premio</p>
        <p
          className="prize-glow font-black text-yellow-300"
          style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)', lineHeight: 1.1 }}
        >
          {formatPrize(premio) || '-'}
        </p>
      </div>

      <div className="flex-1 px-4 pb-2 overflow-auto">
        <div
          className="mx-auto px-4 py-4 rounded-2xl"
          style={{
            maxWidth: 'min(1200px, 96vw)',
            background: 'linear-gradient(135deg,rgba(26,31,58,.6),rgba(30,35,71,.6))',
            border: '2px solid rgba(255,215,0,.25)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {participantesRender.length === 0 ? (
            <p className="text-gray-500 text-center py-10 text-xl">Sin participantes</p>
          ) : (
            <div className="grid-sorteo">
              {participantesRender.map((p, i) => (
                <div
                  key={p.id}
                  className={[
                    'participant-box',
                    COLORES[i % 6],
                    indiceActivo === i ? 'card-active' : '',
                    indiceGanador === i ? 'card-winner' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {p.nombre}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="text-center py-6 shrink-0">
        {fase === 'espera' && todasRondasCompletadas && (
          <div className="flex flex-col items-center gap-3">
            <p
              className="text-yellow-400 font-bold"
              style={{ fontSize: 'clamp(1.2rem, 1.8vw, 1.6rem)' }}
            >
              Todas las rondas completadas
            </p>
            <p className="text-gray-500" style={{ fontSize: 'clamp(.9rem, 1.2vw, 1.05rem)' }}>
              Vuelve al panel de configuración para programar una nueva sesión.
            </p>
          </div>
        )}

        {fase === 'espera' && !todasRondasCompletadas && (
          <div className="flex flex-col items-center gap-3">
            {datosListosParaSorteo ? (
              <button
                onClick={iniciar}
                disabled={participantesRender.length === 0 || !cumpleMinimo}
                className="font-black text-black bg-yellow-500 hover:bg-yellow-400
                  disabled:opacity-30 disabled:cursor-not-allowed
                  px-14 py-5 rounded-2xl transition-all duration-200 active:scale-95"
                style={{
                  fontSize: 'clamp(1.3rem, 2vw, 2rem)',
                  boxShadow: '0 0 40px rgba(234,179,8,.5)',
                }}
              >
                INICIAR SORTEO
              </button>
            ) : (
              <p
                className="text-yellow-300 font-bold"
                style={{ fontSize: 'clamp(1rem, 1.4vw, 1.25rem)' }}
              >
                {mensajeSincronizacion}
              </p>
            )}
            {esPrimerSorteoDeLaSesion && !cumpleMinimo && (
              <p
                className="text-gray-400"
                style={{ fontSize: 'clamp(.95rem, 1.2vw, 1.05rem)' }}
              >
                Se requieren minimo {MIN_PARTICIPANTES_POR_RONDA} participantes para iniciar. Faltan {faltantesMinimos}.
              </p>
            )}
          </div>
        )}

        {fase === 'animando' && (
          <p
            className="text-yellow-300 font-bold animate-pulse"
            style={{ fontSize: 'clamp(1.4rem, 2vw, 2rem)' }}
          >
            Sorteando...
          </p>
        )}

        {/* El nombre del ganador lo muestra GanadorOverlay — no se duplica aquí */}
      </div>

      </div>

      <AnimatePresence>
        {fase === 'ganador' && ganadorNombre && (
          <GanadorOverlay nombre={ganadorNombre} premio={premio} />
        )}
      </AnimatePresence>
    </div>
  )
}

// Fase 1: entrada + exhibicion del ganador
// Fase 2: salida con zoom + fade hacia GanadoresPanel
const SALIDA_INICIO_MS  = 3400
const SALIDA_DURACION_S = 1.5

function GanadorOverlay({ nombre, premio }) {
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSaliendo(true), SALIDA_INICIO_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      className="flex flex-col items-center justify-center overflow-hidden"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: 'rgba(4, 6, 18, 0.94)',
        background: `
          radial-gradient(60% 55% at 24% 18%, rgba(59,130,246,.18), transparent 62%),
          radial-gradient(58% 52% at 78% 20%, rgba(190,24,93,.15), transparent 60%),
          radial-gradient(85% 72% at 50% 86%, rgba(15,23,42,.94), rgba(3,7,18,.985))
        `,
        backdropFilter: 'blur(10px)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: saliendo ? 0 : 1 }}
      transition={{ duration: saliendo ? SALIDA_DURACION_S : 0.6, ease: saliendo ? [0.4, 0, 1, 1] : 'easeOut' }}
    >
      <motion.div
        className="relative z-10 select-none flex flex-col items-center px-8"
        initial={{ scale: 0.85, y: 40, opacity: 0 }}
        animate={saliendo
          ? { scale: 1.3, y: -50, opacity: 0 }
          : { scale: 1,   y: 0,   opacity: 1 }
        }
        transition={saliendo
          ? { duration: SALIDA_DURACION_S * 0.75, ease: [0.4, 0, 1, 1] }
          : { duration: 1.2, ease: [0.16, 1, 0.3, 1] }
        }
      >
        <motion.div
          className="absolute inset-0 blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,.22) 0%, rgba(168,85,247,.14) 34%, rgba(15,23,42,0) 72%)',
            transform: 'scale(1.5)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: saliendo ? 0 : [0, 1, 0.9, 1] }}
          transition={{ duration: 1.3 }}
        />

        <motion.h1
          className="relative z-20 text-center font-black uppercase leading-none"
          style={{
            fontSize: 'clamp(3.8rem, 13vw, 11rem)',
            fontFamily: 'Arial Black, Impact, sans-serif',
            background: 'linear-gradient(180deg, #f8fbff 0%, #dbeafe 24%, #93c5fd 58%, #f9fafb 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextStroke: '1px rgba(191,219,254,.2)',
          }}
          initial={{ letterSpacing: '-0.35em', y: 0 }}
          animate={{
            letterSpacing: ['-0.35em', '0.04em', '0.02em'],
            y: [0, -8, 0],
            textShadow: [
              '0 0 8px rgba(255,255,255,.12)',
              '0 0 18px rgba(147,197,253,.42), 0 0 34px rgba(59,130,246,.22)',
              '0 0 12px rgba(255,255,255,.18), 0 0 26px rgba(96,165,250,.2)',
            ],
          }}
          transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
        >
          GANADOR
        </motion.h1>

        <motion.div
          className="mx-auto mt-4 h-2 rounded-full"
          style={{
            width: 'min(65vw, 780px)',
            background: 'linear-gradient(90deg, rgba(96,165,250,0), rgba(191,219,254,.92), rgba(96,165,250,0))',
            filter: 'blur(1px)',
            boxShadow: '0 0 18px rgba(96,165,250,.35)',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1.1, 1], opacity: [0, 1, 0.85] }}
          transition={{ duration: 0.9, delay: 0.22, ease: 'easeOut' }}
        />

        <motion.p
          className="relative z-20 text-center font-black text-white leading-tight mt-6"
          style={{
            fontSize: 'clamp(2rem, 6vw, 5rem)',
            textShadow: '0 0 28px rgba(59,130,246,.18), 0 4px 20px rgba(0,0,0,.72)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {nombre}
        </motion.p>

        <motion.p
          className="relative z-20 text-center font-black mt-3"
          style={{
            fontSize: 'clamp(1.6rem, 3.5vw, 3rem)',
            background: 'linear-gradient(180deg, #fde68a 0%, #facc15 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 10px rgba(250,204,21,.24))',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1, ease: 'easeOut' }}
        >
          {formatPrize(premio)}
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
