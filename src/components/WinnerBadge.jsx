import { useId } from 'react'

/**
 * Badges SVG de posición — rescatados del prototipo sin cambios.
 * @param {{ index: number }} props  — 0=oro, 1=plata, 2=bronce, 3+=estrella
 */
export default function WinnerBadge({ index }) {
  const id = useId()
  const uid = `badge_${index}_${id.replace(/:/g, '')}`

  if (index === 0) return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" role="img" aria-label="Primer lugar">
      <defs>
        <linearGradient id={`${uid}Gold`} x1="0" x2="1">
          <stop offset="0%" stopColor="#ffd95a"/>
          <stop offset="100%" stopColor="#ffb703"/>
        </linearGradient>
      </defs>
      <path d="M16 4h10l6 18H22z" fill="#2f9cff"/>
      <path d="M38 4h10l-6 18H32z" fill="#e83f6f"/>
      <circle cx="32" cy="36" r="19" fill={`url(#${uid}Gold)`} stroke="#ffe79a" strokeWidth="2"/>
      <circle cx="32" cy="36" r="13" fill="none" stroke="#fff0b3" strokeWidth="2" opacity=".7"/>
      <path d="M32 25l3.2 6.5 7.1 1-5.1 5 1.2 7-6.4-3.4-6.4 3.4 1.2-7-5.1-5 7.1-1z" fill="#fff4c2"/>
    </svg>
  )

  if (index === 1) return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" role="img" aria-label="Segundo lugar">
      <defs>
        <linearGradient id={`${uid}Silver`} x1="0" x2="1">
          <stop offset="0%" stopColor="#f4f8ff"/>
          <stop offset="100%" stopColor="#aeb8c6"/>
        </linearGradient>
      </defs>
      <path d="M16 4h10l6 18H22z" fill="#34b3ff"/>
      <path d="M38 4h10l-6 18H32z" fill="#7a57d1"/>
      <circle cx="32" cy="36" r="19" fill={`url(#${uid}Silver)`} stroke="#dfe6f0" strokeWidth="2"/>
      <circle cx="32" cy="36" r="13" fill="none" stroke="#ffffff" strokeWidth="2" opacity=".65"/>
      <text x="32" y="41" textAnchor="middle" fontSize="18" fontWeight="800" fill="#4b5563">2</text>
    </svg>
  )

  if (index === 2) return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" role="img" aria-label="Tercer lugar">
      <defs>
        <linearGradient id={`${uid}Bronze`} x1="0" x2="1">
          <stop offset="0%" stopColor="#e6a470"/>
          <stop offset="100%" stopColor="#9f542a"/>
        </linearGradient>
      </defs>
      <path d="M16 4h10l6 18H22z" fill="#43c7b8"/>
      <path d="M38 4h10l-6 18H32z" fill="#ff6b6b"/>
      <circle cx="32" cy="36" r="19" fill={`url(#${uid}Bronze)`} stroke="#f2c2a2" strokeWidth="2"/>
      <circle cx="32" cy="36" r="13" fill="none" stroke="#ffd9bf" strokeWidth="2" opacity=".6"/>
      <text x="32" y="41" textAnchor="middle" fontSize="18" fontWeight="800" fill="#5f2b11">3</text>
    </svg>
  )

  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" role="img" aria-label="Ganador">
      <defs>
        <linearGradient id={`${uid}Blue`} x1="0" x2="1">
          <stop offset="0%" stopColor="#5ec7ff"/>
          <stop offset="100%" stopColor="#1d62ff"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="19" fill={`url(#${uid}Blue)`} stroke="#9fd9ff" strokeWidth="2"/>
      <path d="M32 21l3.2 6.5 7.1 1-5.1 5 1.2 7-6.4-3.4-6.4 3.4 1.2-7-5.1-5 7.1-1z" fill="#e6f5ff"/>
    </svg>
  )
}
