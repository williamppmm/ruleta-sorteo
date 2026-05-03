import { useState } from 'react'
import { useStore } from './store/useStore.jsx'
import PasswordGate   from './components/PasswordGate.jsx'
import AdminPanel     from './panels/AdminPanel.jsx'
import SuperAdminPanel from './panels/SuperAdminPanel.jsx'
import SorteoPanel    from './panels/SorteoPanel.jsx'
import GanadoresPanel from './panels/GanadoresPanel.jsx'
import { isElectron } from './services/desktopApi.js'
import { verificarPermiso, saveHandle, soportaFileSystemAccess } from './store/handleStore.js'

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

  // En web, bloquear la app si no hay carpeta compartida autorizada.
  // Impide que cualquier sorteo se ejecute contra IndexedDB por accidente.
  if (!isElectron && state.modoPersistencia.tipo === 'idb') {
    return <BloqueoCarpeta modoPersistencia={state.modoPersistencia} />
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

function BloqueoCarpeta({ modoPersistencia }) {
  const [ocupado, setOcupado] = useState(false)
  const [error,   setError]   = useState('')
  const handle = modoPersistencia.handlePendiente
  const nombre = modoPersistencia.nombre

  if (!soportaFileSystemAccess) {
    return (
      <div className="aurora-bg min-h-screen flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-red-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <p className="text-5xl mb-4">⚠️</p>
          <h2 className="text-red-400 text-xl font-bold mb-2">Navegador no compatible</h2>
          <p className="text-gray-400 text-sm">
            Esta app requiere <strong>Chrome</strong> o <strong>Edge</strong> para acceder a la carpeta compartida.
          </p>
        </div>
      </div>
    )
  }

  async function reautorizar() {
    setOcupado(true)
    setError('')
    try {
      const ok = await verificarPermiso(handle, true)
      if (ok) { window.location.reload(); return }
      setError('Permiso denegado. Intenta de nuevo.')
    } catch {
      setError('No se pudo solicitar el permiso.')
    }
    setOcupado(false)
  }

  async function conectar() {
    setOcupado(true)
    setError('')
    try {
      const h = await window.showDirectoryPicker({ mode: 'readwrite' })
      await saveHandle(h)
      window.location.reload()
    } catch (e) {
      if (e.name !== 'AbortError') setError('No se pudo conectar la carpeta.')
      setOcupado(false)
    }
  }

  return (
    <div className="aurora-bg min-h-screen flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-yellow-400/30 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <p className="text-5xl mb-4">📁</p>
        <h2 className="text-yellow-400 text-2xl font-bold mb-2">Carpeta requerida</h2>
        {handle ? (
          <>
            <p className="text-gray-300 text-sm mb-1">
              La carpeta <span className="text-white font-semibold">"{nombre}"</span> necesita
              ser autorizada para continuar.
            </p>
            <p className="text-gray-500 text-xs mb-6">
              El navegador requiere confirmación cada sesión para acceder a archivos locales.
            </p>
            <button
              onClick={reautorizar}
              disabled={ocupado}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold py-3 rounded-xl transition disabled:opacity-50"
            >
              {ocupado ? 'Autorizando...' : `Autorizar "${nombre}"`}
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-300 text-sm mb-6">
              Esta app requiere conectar la carpeta compartida (Dropbox) para funcionar.
              Sin ella no se puede ejecutar ningún sorteo.
            </p>
            <button
              onClick={conectar}
              disabled={ocupado}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold py-3 rounded-xl transition disabled:opacity-50"
            >
              {ocupado ? 'Conectando...' : 'Conectar carpeta compartida'}
            </button>
          </>
        )}
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    </div>
  )
}

function TopNav({ panel, setPanel }) {
  // El botón SuperAdmin se oculta tras la diana: el operador ve solo la marca
  // "🎯 Sorteo" como decoración; el super admin sabe que clicar el icono
  // abre el gate con contraseña 1980. Ademas Admin General queda como panel
  // por defecto sin botones visibles de navegacion.
  const enAdmin = panel === PANELES.ADMIN
  return (
    <nav className="flex items-center gap-2 px-4 py-3 sticky top-0 z-50"
      style={{ background: 'rgba(10,10,20,.95)', borderBottom: '1px solid rgba(255,215,0,.1)', backdropFilter: 'blur(10px)' }}>
      <button
        type="button"
        onClick={() => setPanel(enAdmin ? PANELES.SUPERADMIN : PANELES.ADMIN)}
        title={enAdmin ? 'Acceso super admin' : 'Volver al panel general'}
        className="text-yellow-400 font-black text-lg tracking-wide
          hover:text-yellow-300 transition focus:outline-none
          focus-visible:ring-2 focus-visible:ring-yellow-400 rounded"
        style={{ cursor: 'pointer' }}
      >
        🎯 Sorteo
      </button>
    </nav>
  )
}
