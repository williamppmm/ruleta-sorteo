import { useStore } from '../store/useStore.jsx'
import ConfettiScreen from '../components/ConfettiScreen.jsx'
import WinnerBadge from '../components/WinnerBadge.jsx'
import { formatPrize } from '../utils/helpers.js'

export default function GanadoresPanel({ ultimoSorteo, onSiguienteRonda, onVolverAdmin }) {
  const { state, actions } = useStore()
  const cfg = state.config

  const rondasCompletadas = cfg.idsRondasDelDia?.length ?? 0
  // Si la sesion actual no tiene ids pero la pasada si, estamos viendo los
  // ganadores del evento anterior mientras se configura el proximo.
  const viendoSesionPasada = rondasCompletadas === 0
    && (cfg.idsSesionPasada?.length ?? 0) > 0
  const idsMostrar = viendoSesionPasada
    ? cfg.idsSesionPasada
    : cfg.idsRondasDelDia
  const terminadaActual = rondasCompletadas >= cfg.totalRondas && rondasCompletadas > 0
  // Vista "sesion completa": cuando la sesion actual termino o cuando estamos
  // viendo la pasada. En ambos casos se muestra el listado completo sin
  // boton "Siguiente sorteo" (en la pasada no hay siguiente; en la actual
  // terminada tampoco).
  const mostrandoSesionCompleta = terminadaActual || viendoSesionPasada

  const ganadoresDelDia = state.sorteos
    .filter(s => idsMostrar?.includes(s.id))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  const ganadoresCompactos = ganadoresDelDia.length >= 3
  // Titulo y fecha para la vista "sesion completa": si estamos viendo la
  // sesion pasada, tomamos el titulo/fecha del primer ganador (la config
  // actual ya fue limpiada).
  const tituloVista = viendoSesionPasada
    ? (ganadoresDelDia[0]?.titulo || 'Sorteo')
    : (cfg.titulo || 'Sorteo en Vivo')
  const fechaVista = viendoSesionPasada
    ? (ganadoresDelDia[0]?.fecha || new Date().toISOString())
    : new Date().toISOString()

  async function handleSiguienteRonda() {
    await actions.siguienteRonda()
    onSiguienteRonda()
  }

  function fmtFecha(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="aurora-bg h-screen overflow-hidden">
      {/* Confetti solo cuando la sesion actual acaba de terminar, no al
          revisar la pasada (esos ganadores ya no son novedad). */}
      {terminadaActual && <ConfettiScreen />}

      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={onVolverAdmin}
          className="rounded-xl border border-white/10 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/65"
        >
          Volver al panel
        </button>
      </div>

      <div
        className="fade-in"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          overflow: 'hidden',
          paddingTop: mostrandoSesionCompleta ? '5.5rem' : '2.5rem',
          paddingBottom: mostrandoSesionCompleta ? '1.25rem' : '2.5rem',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
        }}
      >
        <div
          className="w-full text-center"
          style={{
            maxWidth: mostrandoSesionCompleta ? 'min(980px, 96vw)' : 'min(800px, 96vw)',
          }}
        >
        {!mostrandoSesionCompleta && ultimoSorteo && (
          <>
            <div className="mb-5 flex justify-center">
              <WinnerBadge index={rondasCompletadas - 1} />
            </div>

            <p
              className="mb-3 text-gray-400 uppercase tracking-widest"
              style={{ fontSize: 'clamp(1rem, 1.5vw, 1.3rem)' }}
            >
              Ganador
            </p>

            <h2
              className="mb-4 font-black leading-tight text-white"
              style={{
                fontSize: 'clamp(3rem, 8vw, 7rem)',
                textShadow: '0 0 40px rgba(255,255,255,.25)',
              }}
            >
              {ultimoSorteo.ganadorNombre}
            </h2>

            <p
              className="mb-3 font-black text-yellow-300 prize-glow"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)', lineHeight: 1.1 }}
            >
              {formatPrize(ultimoSorteo.valorPremio)}
            </p>

            <p
              className="mb-10 text-gray-500"
              style={{ fontSize: 'clamp(.9rem, 1.3vw, 1.1rem)' }}
            >
              {fmtFecha(ultimoSorteo.fecha)} - {ultimoSorteo.hora}
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={handleSiguienteRonda}
                className="rounded-2xl bg-yellow-500 px-14 py-5 font-black text-black transition-all duration-200 active:scale-95 hover:bg-yellow-400"
                style={{
                  fontSize: 'clamp(1.3rem, 2vw, 2rem)',
                  boxShadow: '0 0 40px rgba(234,179,8,.5)',
                }}
              >
                Siguiente sorteo
              </button>

              <button
                onClick={onVolverAdmin}
                className="rounded-2xl border border-white/15 bg-white/10 px-8 py-4 font-semibold text-white transition-all duration-200 active:scale-95 hover:bg-white/15"
                style={{ fontSize: 'clamp(1rem, 1.4vw, 1.1rem)' }}
              >
                Volver al panel
              </button>
            </div>

            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: cfg.totalRondas }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i < rondasCompletadas ? 'bg-yellow-400 w-10' : 'bg-gray-700 w-5'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {mostrandoSesionCompleta && (
          <>
            <p
              style={{
                fontSize: ganadoresCompactos ? 'clamp(2.2rem, 4vw, 3rem)' : 'clamp(3rem, 6vw, 5rem)',
                marginBottom: '.5rem',
              }}
            >
              🏆
            </p>

            <h2
              className="mb-2 font-black text-white"
              style={{ fontSize: ganadoresCompactos ? 'clamp(1.8rem, 3.2vw, 2.9rem)' : 'clamp(2rem, 4.5vw, 4rem)' }}
            >
              Sorteo finalizado
            </h2>

            <p
              className="text-gray-400"
              style={{
                fontSize: ganadoresCompactos ? 'clamp(.92rem, 1.2vw, 1.02rem)' : 'clamp(1rem, 1.6vw, 1.4rem)',
                marginBottom: ganadoresCompactos ? '1rem' : '1.8rem',
              }}
            >
              {tituloVista} - {fmtFecha(fechaVista)}
            </p>

            <div
              className="mx-auto w-full text-left"
              style={{
                maxWidth: 'min(940px, 92vw)',
                marginBottom: ganadoresCompactos ? '1rem' : '1.5rem',
              }}
            >
              {ganadoresDelDia.map((s, i) => (
                <div
                  key={s.id}
                  className="slide-in relative isolate flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,.02), rgba(255,255,255,.015))',
                    border: '1px solid rgba(255,255,255,.14)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 18px 50px rgba(0,0,0,.18)',
                    backdropFilter: 'blur(1px)',
                    animationDelay: `${i * 0.12}s`,
                    marginBottom: ganadoresCompactos ? '.7rem' : '1rem',
                    paddingTop: ganadoresCompactos ? '.8rem' : '1rem',
                    paddingBottom: ganadoresCompactos ? '.8rem' : '1rem',
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, rgba(255,255,255,.035), rgba(255,255,255,0) 28%, rgba(255,255,255,.02) 100%)',
                    }}
                  />

                  <div className="h-14 w-14 shrink-0">
                    <WinnerBadge index={i} />
                  </div>

                  <div className="relative z-10 min-w-0 flex-1">
                    <p
                      className="truncate font-black text-white"
                      style={{
                        fontSize: ganadoresCompactos ? 'clamp(1.02rem, 1.45vw, 1.32rem)' : 'clamp(1.2rem, 2vw, 1.8rem)',
                        textShadow: '0 2px 14px rgba(0,0,0,.55), 0 0 20px rgba(255,255,255,.08)',
                      }}
                    >
                      {s.ganadorNombre}
                    </p>
                    <p
                      className="text-sm text-gray-300"
                      style={{ textShadow: '0 1px 8px rgba(0,0,0,.45)' }}
                    >
                      {s.hora}
                    </p>
                  </div>

                  <div className="relative z-10 shrink-0 text-right">
                    <p
                      className="font-black text-yellow-300"
                      style={{
                        fontSize: ganadoresCompactos ? 'clamp(1.02rem, 1.45vw, 1.32rem)' : 'clamp(1.2rem, 2vw, 1.8rem)',
                        textShadow: '0 0 18px rgba(250,204,21,.2), 0 2px 14px rgba(0,0,0,.55)',
                      }}
                    >
                      {formatPrize(s.valorPremio)}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-semibold ${
                        s.pagado ? 'text-green-400' : 'text-orange-400'
                      }`}
                      style={{ textShadow: '0 1px 8px rgba(0,0,0,.45)' }}
                    >
                      {s.pagado ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600">
              Los pagos se registran desde el Panel de configuración - Historial
            </p>

            <div className="mt-4">
              <button
                onClick={onVolverAdmin}
                className="rounded-2xl border border-white/15 bg-white/10 px-8 py-3 font-semibold text-white transition-all duration-200 active:scale-95 hover:bg-white/15"
              >
                Volver al panel
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
