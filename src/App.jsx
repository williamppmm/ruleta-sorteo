import { useState } from 'react'
import { useStore } from './store/useStore.jsx'
import PasswordGate   from './components/PasswordGate.jsx'
import AdminPanel     from './panels/AdminPanel.jsx'
import SuperAdminPanel from './panels/SuperAdminPanel.jsx'
import SorteoPanel    from './panels/SorteoPanel.jsx'
import GanadoresPanel from './panels/GanadoresPanel.jsx'

const PANELES = {
  ADMIN:      'admin',
  SUPERADMIN: 'superadmin',
  SORTEO:     'sorteo',
  GANADORES:  'ganadores',
}

export default function App() {
  const { state } = useStore()
  const [panel, setPanel] = useState(PANELES.ADMIN)
  const [ultimoSorteo, setUltimoSorteo] = useState(null)

  if (state.cargando) {
    return (
      <div className="aurora-bg min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
        <p className="text-gray-400 text-lg">Cargando sistema...</p>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-red-400 text-5xl mb-4">⚠️</p>
          <p className="text-red-300 text-xl font-semibold mb-2">Error al cargar datos</p>
          <p className="text-gray-500 text-sm">{state.error}</p>
        </div>
      </div>
    )
  }

  // El Panel de Sorteo y Ganadores ocupan pantalla completa (sin nav)
  if (panel === PANELES.SORTEO) {
    return (
      <SorteoPanel
        onGanador={sorteo => {
          setUltimoSorteo(sorteo)
          setPanel(PANELES.GANADORES)
        }}
      />
    )
  }

  if (panel === PANELES.GANADORES) {
    return (
      <GanadoresPanel
        ultimoSorteo={ultimoSorteo || state.sorteos[0] || null}
        onVolverAdmin={() => setPanel(PANELES.ADMIN)}
        onSiguienteRonda={() => setPanel(PANELES.SORTEO)}
      />
    )
  }

  // SuperAdmin con PasswordGate
  if (panel === PANELES.SUPERADMIN) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <TopNav panel={panel} setPanel={p => setPanel(p)} />
        <PasswordGate onClose={() => setPanel(PANELES.ADMIN)}>
          <SuperAdminPanel />
        </PasswordGate>
      </div>
    )
  }

  // Admin General (default)
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <TopNav panel={panel} setPanel={setPanel} />
      <AdminPanel
        onIrAlSorteo={() => setPanel(PANELES.SORTEO)}
        onVerGanadores={() => setPanel(PANELES.GANADORES)}
      />
    </div>
  )
}

function TopNav({ panel, setPanel }) {
  const tabs = [
    { id: PANELES.ADMIN,      label: 'Admin General' },
    { id: PANELES.SUPERADMIN, label: 'SuperAdmin'    },
  ]
  return (
    <nav className="flex items-center gap-2 px-4 py-3 sticky top-0 z-50"
      style={{ background: 'rgba(10,10,20,.95)', borderBottom: '1px solid rgba(255,215,0,.1)', backdropFilter: 'blur(10px)' }}>
      <span className="text-yellow-400 font-black text-lg mr-3 hidden sm:block tracking-wide">
        🎯 Sorteo
      </span>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setPanel(id)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition
            ${panel === id
              ? 'bg-yellow-500 text-black shadow-md'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
