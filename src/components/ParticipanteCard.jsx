/**
 * Tarjeta de participante en la cuadrícula del sorteo.
 * Todos los participantes se ven iguales visualmente — el público no distingue vetados.
 *
 * @param {{ nombre: string, index: number, activa: boolean, ganadora: boolean }} props
 */
export default function ParticipanteCard({ nombre, index, activa, ganadora }) {
  const COLORES = [
    'from-blue-800 to-blue-600',
    'from-purple-800 to-purple-600',
    'from-rose-800 to-rose-600',
    'from-emerald-800 to-emerald-600',
    'from-orange-800 to-orange-600',
    'from-cyan-800 to-cyan-600',
  ]
  const color = COLORES[index % COLORES.length]

  return (
    <div
      className={`
        relative flex items-center justify-center rounded-2xl p-3
        bg-gradient-to-br ${color}
        border-2 transition-all duration-75 select-none
        min-h-[80px]
        ${activa  ? 'border-yellow-300 scale-105 shadow-[0_0_20px_rgba(253,224,71,0.6)] z-10' : 'border-transparent'}
        ${ganadora ? 'border-yellow-400 scale-110 shadow-[0_0_40px_rgba(253,224,71,0.9)] z-20 ring-2 ring-yellow-300' : ''}
      `}
    >
      <span className="text-white font-bold text-center leading-tight break-words
        text-base sm:text-lg" style={{ wordBreak: 'break-word' }}>
        {nombre}
      </span>
    </div>
  )
}
