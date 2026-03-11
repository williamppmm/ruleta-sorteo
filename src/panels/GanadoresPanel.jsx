import { useStore } from '../store/useStore.jsx'
import ConfettiScreen from '../components/ConfettiScreen.jsx'
import WinnerBadge from '../components/WinnerBadge.jsx'
import { formatPrize } from '../utils/helpers.js'

export default function GanadoresPanel({ ultimoSorteo, onSiguienteRonda, onVolverAdmin }) {
  const { state, actions } = useStore()
  const cfg = state.config

  const rondasCompletadas = cfg.idsRondasDelDia?.length ?? 0
  const esUltimaRonda = rondasCompletadas >= cfg.totalRondas

  const ganadoresDelDia = state.sorteos
    .filter(s => cfg.idsRondasDelDia?.includes(s.id))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .slice(0, cfg.totalRondas)

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
    <div className="aurora-bg min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {esUltimaRonda && <ConfettiScreen />}

      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={onVolverAdmin}
          className="rounded-xl border border-white/10 bg-black/45 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/65"
        >
          Volver al panel
        </button>
      </div>

      <div
        className="relative z-10 w-full text-center px-6 py-10 fade-in"
        style={{ maxWidth: 'min(800px, 96vw)' }}
      >
        {!esUltimaRonda && ultimoSorteo && (
          <>
            <div className="flex justify-center mb-5">
              <WinnerBadge index={rondasCompletadas - 1} />
            </div>

            <p
              className="text-gray-400 uppercase tracking-widest mb-3"
              style={{ fontSize: 'clamp(1rem, 1.5vw, 1.3rem)' }}
            >
              Ganador
            </p>

            <h2
              className="font-black text-white leading-tight mb-4"
              style={{
                fontSize: 'clamp(3rem, 8vw, 7rem)',
                textShadow: '0 0 40px rgba(255,255,255,.25)',
              }}
            >
              {ultimoSorteo.ganadorNombre}
            </h2>

            <p
              className="font-black text-yellow-300 prize-glow mb-3"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)', lineHeight: 1.1 }}
            >
              {formatPrize(ultimoSorteo.valorPremio)}
            </p>

            <p
              className="text-gray-500 mb-10"
              style={{ fontSize: 'clamp(.9rem, 1.3vw, 1.1rem)' }}
            >
              {fmtFecha(ultimoSorteo.fecha)} - {ultimoSorteo.hora}
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={handleSiguienteRonda}
                className="font-black text-black bg-yellow-500 hover:bg-yellow-400
                  px-14 py-5 rounded-2xl transition-all duration-200 active:scale-95"
                style={{
                  fontSize: 'clamp(1.3rem, 2vw, 2rem)',
                  boxShadow: '0 0 40px rgba(234,179,8,.5)',
                }}
              >
                Siguiente sorteo
              </button>

              <button
                onClick={onVolverAdmin}
                className="font-semibold text-white bg-white/10 hover:bg-white/15
                  border border-white/15 px-8 py-4 rounded-2xl transition-all duration-200 active:scale-95"
                style={{ fontSize: 'clamp(1rem, 1.4vw, 1.1rem)' }}
              >
                Volver al panel
              </button>
            </div>

            <div className="flex justify-center gap-2 mt-8">
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

        {esUltimaRonda && (
          <>
            <p style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}>🏆</p>

            <h2
              className="font-black text-white mb-2"
              style={{ fontSize: 'clamp(2rem, 4.5vw, 4rem)' }}
            >
              Sorteo finalizado
            </h2>

            <p
              className="text-gray-400 mb-8"
              style={{ fontSize: 'clamp(1rem, 1.6vw, 1.4rem)' }}
            >
              {cfg.titulo || 'Sorteo en Vivo'} - {fmtFecha(new Date().toISOString())}
            </p>

            <div className="space-y-4 mb-8 text-left">
              {ganadoresDelDia.map((s, i) => (
                <div
                  key={s.id}
                  className="slide-in flex items-center gap-4 rounded-2xl px-5 py-4"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid rgba(255,255,255,.1)',
                    animationDelay: `${i * 0.12}s`,
                  }}
                >
                  <div className="shrink-0 w-14 h-14">
                    <WinnerBadge index={i} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-white font-black truncate"
                      style={{ fontSize: 'clamp(1.2rem, 2vw, 1.8rem)' }}
                    >
                      {s.ganadorNombre}
                    </p>
                    <p className="text-gray-500 text-sm">{s.hora}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="text-yellow-300 font-black"
                      style={{ fontSize: 'clamp(1.2rem, 2vw, 1.8rem)' }}
                    >
                      {formatPrize(s.valorPremio)}
                    </p>
                    <p
                      className={`text-xs font-semibold mt-0.5 ${
                        s.pagado ? 'text-green-400' : 'text-orange-400'
                      }`}
                    >
                      {s.pagado ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-gray-600 text-sm">
              Los pagos se registran desde Panel Admin - Historial
            </p>

            <div className="mt-6">
              <button
                onClick={onVolverAdmin}
                className="font-semibold text-white bg-white/10 hover:bg-white/15
                  border border-white/15 px-8 py-4 rounded-2xl transition-all duration-200 active:scale-95"
              >
                Volver al panel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
