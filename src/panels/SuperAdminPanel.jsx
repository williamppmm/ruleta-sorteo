import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore.jsx'
import StarRating from '../components/StarRating.jsx'
import { normalizar } from '../utils/normalizar.js'
import { isElectron, desktopApi } from '../services/desktopApi.js'
import { fmtFechaCorta, fmtHora } from '../utils/helpers.js'
import { parsearTxt, planificarImportacion } from '../domain/clientes.js'

const TABS = { CLIENTES: 'clientes', HISTORIAL: 'historial', IMPORTAR: 'importar', DATOS: 'datos', RESPALDO: 'respaldo' }
const PASSWORD_SUPERADMIN = '1980'

export default function SuperAdminPanel() {
  const { state, actions } = useStore()
  const [tab, setTab] = useState(TABS.CLIENTES)
  const [busqueda, setBusqueda] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [errorNuevo, setErrorNuevo] = useState('')
  const [editandoKey, setEditandoKey] = useState(null)
  const [editandoNombre, setEditandoNombre] = useState('')
  const [confirmandoKey, setConfirmandoKey] = useState(null)
  const [clienteHistorial, setClienteHistorial] = useState(null)
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const [passwordReset, setPasswordReset] = useState('')
  const [errorReset, setErrorReset] = useState(false)

  // Estado de importación
  const [preview, setPreview]         = useState(null)   // { clientes, errores, nombreArchivo }
  const [importando, setImportando]   = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)  // { nuevos, actualizados, omitidos }
  const fileRef = useRef(null)

  // ── Filtrado ──────────────────────────────────
  const clientesFiltrados = useMemo(() => {
    const q = normalizar(busqueda)
    return q
      ? state.clientes.filter(c => normalizar(c.nombre).includes(q))
      : state.clientes
  }, [state.clientes, busqueda])

  // ── Crear cliente ─────────────────────────────
  async function crearCliente(e) {
    e.preventDefault()
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    const key = normalizar(nombre)
    if (state.clientes.some(c => c.key === key)) {
      setErrorNuevo('Ya existe un cliente con ese nombre.')
      return
    }
    await actions.upsertCliente({ nombre, estrellas: 0 })
    setNuevoNombre('')
    setErrorNuevo('')
  }

  // ── Actualizar estrellas ──────────────────────
  async function cambiarEstrellas(cliente, nuevasEstrellas) {
    await actions.upsertCliente({ ...cliente, estrellas: nuevasEstrellas })
  }

  // ── Editar nombre ─────────────────────────────
  function iniciarEdicion(cliente) {
    setEditandoKey(cliente.key)
    setEditandoNombre(cliente.nombre)
  }

  async function guardarEdicion(cliente) {
    const nombre = editandoNombre.trim()
    if (!nombre) { setEditandoKey(null); return }
    const key = normalizar(nombre)
    // Si cambió el nombre: crear nuevo key, borrar el viejo
    if (key !== cliente.key) {
      if (state.clientes.some(c => c.key === key)) {
        alert('Ya existe un cliente con ese nombre.')
        return
      }
      await actions.deleteCliente(cliente.key)
    }
    await actions.upsertCliente({
      ...cliente,
      key,
      nombre,
    })
    setEditandoKey(null)
  }

  // ── Eliminar ──────────────────────────────────
  async function eliminarCliente(key) {
    await actions.deleteCliente(key)
    setConfirmandoKey(null)
  }

  async function confirmarBorradoTotal() {
    if (passwordReset !== PASSWORD_SUPERADMIN) {
      setErrorReset(true)
      return
    }

    await actions.borrarTodo()
    setConfirmandoReset(false)
    setPasswordReset('')
    setErrorReset(false)
    setClienteHistorial(null)
    setTab(TABS.CLIENTES)
    setBusqueda('')
    setNuevoNombre('')
    setErrorNuevo('')
    setPreview(null)
    setResultadoImport(null)
  }

  // ── Historial de un cliente ───────────────────
  function verHistorial(cliente) {
    setClienteHistorial(cliente)
    setTab(TABS.HISTORIAL)
  }

  const sorteosDelCliente = useMemo(() => {
    if (!clienteHistorial) return []
    return state.sorteos.filter(s =>
      // Preferir clienteId (sobrevive renombrados); fallback a key para sorteos heredados
      (clienteHistorial.clienteId && s.ganadorClienteId === clienteHistorial.clienteId)
      || s.ganadorKey === clienteHistorial.key
    )
  }, [clienteHistorial, state.sorteos])

  // ─────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-yellow-400">SuperAdmin</h1>
        <span className="text-gray-500 text-sm">
          {state.clientes.length} cliente{state.clientes.length !== 1 ? 's' : ''} en base
        </span>
      </div>

      <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-red-300">
              Zona de mantenimiento
            </p>
            <p className="text-sm text-red-100/80">
              Borra clientes, participantes, sorteos e informacion de la sesion actual.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmandoReset(true)
              setPasswordReset('')
              setErrorReset(false)
            }}
            className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
          >
            Borrar todos los registros
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2 flex-wrap">
        {[
          { id: TABS.CLIENTES,  label: 'Base de clientes' },
          { id: TABS.HISTORIAL, label: clienteHistorial ? `Historial — ${clienteHistorial.nombre}` : 'Historial' },
          { id: TABS.IMPORTAR,  label: 'Importar .txt' },
          ...(isElectron ? [{ id: TABS.DATOS,     label: 'Datos' }]    : []),
          { id: TABS.RESPALDO,  label: 'Respaldo' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-t font-semibold text-sm transition
              ${tab === t.id
                ? 'bg-yellow-500 text-black'
                : 'text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: DATOS ── */}
      {tab === TABS.DATOS && isElectron && <SeccionDatos />}

      {/* ── TAB: RESPALDO ── */}
      {tab === TABS.RESPALDO && (
        <SeccionRespaldo actions={actions} totalClientes={state.clientes.length} totalSorteos={state.sorteos.length} />
      )}

      {/* ── TAB: IMPORTAR ── */}
      {tab === TABS.IMPORTAR && (
        <SeccionImportar
          clientes={state.clientes}
          actions={actions}
          preview={preview}
          setPreview={setPreview}
          importando={importando}
          setImportando={setImportando}
          resultadoImport={resultadoImport}
          setResultadoImport={setResultadoImport}
          fileRef={fileRef}
        />
      )}

      {/* ── TAB: CLIENTES ── */}
      {tab === TABS.CLIENTES && (
        <div>
          {/* Crear cliente */}
          <form onSubmit={crearCliente} className="flex gap-2 mb-5">
            <input
              type="text"
              value={nuevoNombre}
              onChange={e => { setNuevoNombre(e.target.value); setErrorNuevo('') }}
              placeholder="Nombre del nuevo cliente"
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-2.5
                border border-gray-600 focus:border-yellow-400 outline-none placeholder-gray-500"
            />
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold
                px-5 py-2.5 rounded-xl transition"
            >
              + Agregar
            </button>
          </form>
          {errorNuevo && <p className="text-red-400 text-sm mb-4 -mt-3">{errorNuevo}</p>}

          {/* Buscador */}
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-2.5 mb-4
              border border-gray-700 focus:border-gray-500 outline-none placeholder-gray-500 text-sm"
          />

          {/* Tabla de clientes */}
          {clientesFiltrados.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay clientes registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="pb-2 pr-4 font-medium">#</th>
                    <th className="pb-2 pr-4 font-medium">Nombre</th>
                    <th className="pb-2 pr-4 font-medium">Estrellas</th>
                    <th className="pb-2 pr-4 font-medium">Último premio</th>
                    <th className="pb-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c, i) => {
                    const editando = editandoKey === c.key
                    const confirmando = confirmandoKey === c.key

                    return (
                      <tr key={c.key} className="border-b border-gray-800 hover:bg-gray-800/40 transition">
                        <td className="py-3 pr-4 text-gray-500">{i + 1}</td>

                        {/* Nombre / editor inline */}
                        <td className="py-3 pr-4">
                          {editando ? (
                            <div className="flex gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={editandoNombre}
                                onChange={e => setEditandoNombre(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') guardarEdicion(c)
                                  if (e.key === 'Escape') setEditandoKey(null)
                                }}
                                className="bg-gray-700 text-white rounded-lg px-3 py-1
                                  border border-yellow-400 outline-none text-sm w-36"
                              />
                              <button
                                onClick={() => guardarEdicion(c)}
                                className="text-green-400 hover:text-green-300 text-xs font-bold"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditandoKey(null)}
                                className="text-gray-500 hover:text-gray-300 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="text-white font-medium">{c.nombre}</span>
                          )}
                        </td>

                        {/* Estrellas */}
                        <td className="py-3 pr-4">
                          <StarRating
                            value={c.estrellas}
                            onChange={n => cambiarEstrellas(c, n)}
                            size="text-xl"
                          />
                        </td>

                        {/* Último premio */}
                        <td className="py-3 pr-4 text-gray-400">
                          {c.fechaUltimoPremio
                            ? `${fmtFechaCorta(c.fechaUltimoPremio)} ${fmtHora(c.fechaUltimoPremio)}`
                            : <span className="text-gray-600">—</span>
                          }
                        </td>

                        {/* Acciones */}
                        <td className="py-3">
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => iniciarEdicion(c)}
                              className="text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => verHistorial(c)}
                              className="text-gray-400 hover:text-gray-200 text-xs font-medium transition"
                            >
                              Historial
                            </button>
                            {confirmando ? (
                              <>
                                <button
                                  onClick={() => eliminarCliente(c.key)}
                                  className="text-red-400 hover:text-red-300 text-xs font-bold transition"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setConfirmandoKey(null)}
                                  className="text-gray-500 hover:text-gray-300 text-xs transition"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmandoKey(c.key)}
                                className="text-red-600 hover:text-red-400 text-xs font-medium transition"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {tab === TABS.HISTORIAL && (
        <div>
          {!clienteHistorial ? (
            <p className="text-gray-500 text-center py-8">
              Selecciona un cliente en la tabla para ver su historial.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">{clienteHistorial.nombre}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <StarRating value={clienteHistorial.estrellas} readonly size="text-lg" />
                    <span className="text-gray-500 text-sm">
                      {sorteosDelCliente.length} premio{sorteosDelCliente.length !== 1 ? 's' : ''} ganado{sorteosDelCliente.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setClienteHistorial(null); setTab(TABS.CLIENTES) }}
                  className="ml-auto text-gray-500 hover:text-gray-300 text-sm transition"
                >
                  ← Volver
                </button>
              </div>

              {sorteosDelCliente.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Este cliente aún no ha ganado ningún sorteo.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-2 pr-4 font-medium">Fecha</th>
                        <th className="pb-2 pr-4 font-medium">Hora</th>
                        <th className="pb-2 pr-4 font-medium">Premio</th>
                        <th className="pb-2 pr-4 font-medium">Estado pago</th>
                        <th className="pb-2 font-medium">Fecha pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorteosDelCliente.map(s => (
                        <tr key={s.id} className="border-b border-gray-800">
                          <td className="py-3 pr-4 text-white">{fmtFechaCorta(s.fecha)}</td>
                          <td className="py-3 pr-4 text-gray-400">{s.hora}</td>
                          <td className="py-3 pr-4 text-yellow-400 font-bold">{s.valorPremio}</td>
                          <td className="py-3 pr-4">
                            {s.pagado
                              ? <span className="text-green-400 font-semibold">✓ Pagado</span>
                              : <span className="text-orange-400">Pendiente</span>
                            }
                          </td>
                          <td className="py-3 text-gray-400">
                            {s.fechaPago ? fmtFechaCorta(s.fechaPago) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {confirmandoReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-900 bg-gray-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-white">Borrar todos los registros</h3>
            <p className="mb-4 text-sm text-gray-400">
              Esta accion eliminara clientes, participantes, historial de sorteos y reiniciara la configuracion.
              Ingresa la contrasena para continuar.
            </p>

            <input
              autoFocus
              type="password"
              value={passwordReset}
              onChange={e => {
                setPasswordReset(e.target.value)
                setErrorReset(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmarBorradoTotal()
              }}
              placeholder="Contrasena"
              className={`w-full rounded-xl border bg-gray-900 px-4 py-3 text-center tracking-widest text-white outline-none transition ${
                errorReset ? 'border-red-500' : 'border-gray-700 focus:border-red-400'
              }`}
            />

            {errorReset && (
              <p className="mt-2 text-center text-xs text-red-400">Contrasena incorrecta</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={confirmarBorradoTotal}
                className="flex-1 rounded-xl bg-red-700 py-3 font-bold text-white transition hover:bg-red-600"
              >
                Borrar todo
              </button>
              <button
                onClick={() => {
                  setConfirmandoReset(false)
                  setPasswordReset('')
                  setErrorReset(false)
                }}
                className="flex-1 rounded-xl bg-gray-800 py-3 font-semibold text-white transition hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Sección Datos (solo Electron)
// ─────────────────────────────────────────────
function SeccionDatos() {
  const [dataPath, setDataPath]   = useState(null)   // null = cargando
  const [estado, setEstado]       = useState(null)   // { ok, mensaje } | null
  const [ocupado, setOcupado]     = useState(false)

  // Cargar ruta actual al montar
  useEffect(() => {
    desktopApi.getDataPath().then(p => setDataPath(p))
  }, [])

  async function seleccionarCarpeta() {
    setEstado(null)
    const nuevaRuta = await desktopApi.selectDataFolder()
    if (!nuevaRuta) return   // usuario canceló

    setOcupado(true)
    const resultado = await desktopApi.changeDataPath(nuevaRuta)
    setOcupado(false)

    if (resultado.ok) {
      setDataPath(nuevaRuta)
      setEstado({ ok: true, mensaje: 'Carpeta cambiada correctamente. Los datos se migraron a la nueva ubicación.' })
    } else {
      setEstado({ ok: false, mensaje: `Error al cambiar carpeta: ${resultado.error}` })
    }
  }

  async function abrirCarpeta() {
    await desktopApi.openDataFolder()
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Ruta actual */}
      <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
          Carpeta de datos activa
        </p>
        <p className="font-mono text-sm text-yellow-300 break-all">
          {dataPath === null ? 'Cargando…' : dataPath}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Aquí se guardan <code className="text-gray-400">clientes.json</code>,{' '}
          <code className="text-gray-400">participantes.json</code>,{' '}
          <code className="text-gray-400">sorteos.json</code> y{' '}
          <code className="text-gray-400">config.json</code>.
        </p>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={seleccionarCarpeta}
          disabled={ocupado}
          className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black
            font-bold px-5 py-2.5 rounded-xl transition"
        >
          {ocupado ? 'Migrando…' : 'Seleccionar carpeta de datos'}
        </button>

        <button
          onClick={abrirCarpeta}
          className="bg-gray-700 hover:bg-gray-600 text-white font-semibold
            px-5 py-2.5 rounded-xl transition"
        >
          Abrir carpeta
        </button>
      </div>

      {/* Resultado */}
      {estado && (
        <div className={`rounded-xl border p-4 text-sm font-medium ${
          estado.ok
            ? 'border-green-700 bg-green-950/40 text-green-300'
            : 'border-red-700 bg-red-950/40 text-red-300'
        }`}>
          {estado.ok ? '✓ ' : '✕ '}{estado.mensaje}
        </div>
      )}

      {/* Nota informativa */}
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4 text-xs text-gray-500 space-y-1">
        <p>Al cambiar la carpeta, los archivos existentes se copian automáticamente a la nueva ubicación.</p>
        <p>Los archivos originales no se eliminan de la carpeta anterior.</p>
        <p>Si la carpeta destino no existe, se crea automáticamente.</p>
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────
// Sección Respaldo
// Export: disponible en web (descarga por el navegador) y en Electron (diálogo nativo).
// Restaurar: solo en Electron (el super admin trabaja sobre archivos locales).
// ─────────────────────────────────────────────
function SeccionRespaldo({ actions, totalClientes, totalSorteos }) {
  const { state } = useStore()
  const [estado,           setEstado]           = useState(null)   // { ok, mensaje } | null
  const [ocupado,          setOcupado]          = useState(false)
  const [confirmando,      setConfirmando]      = useState(false)
  const [passwordRestore,  setPasswordRestore]  = useState('')
  const [errorPassword,    setErrorPassword]    = useState(false)
  const [datosBackup,      setDatosBackup]      = useState(null)   // datos leídos, pendientes de confirmación

  async function exportar() {
    setEstado(null)
    setOcupado(true)

    if (isElectron) {
      const res = await desktopApi.exportBackup()
      setOcupado(false)
      if (res.canceled) return
      if (res.ok) {
        setEstado({ ok: true, mensaje: `Backup guardado en: ${res.filePath}` })
      } else {
        setEstado({ ok: false, mensaje: `Error al exportar: ${res.error}` })
      }
      return
    }

    // Web: construye el backup desde el estado actual y dispara descarga del navegador.
    try {
      const backup = {
        version:       1,
        fecha:         new Date().toISOString(),
        clientes:      state.clientes,
        participantes: state.participantes,
        sorteos:       state.sorteos,
        config:        state.config,
      }
      const nombre = `sorteo-backup-${new Date().toISOString().slice(0, 10)}.json`
      const blob   = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href       = url
      a.download   = nombre
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setEstado({ ok: true, mensaje: `Backup descargado: ${nombre}` })
    } catch (err) {
      setEstado({ ok: false, mensaje: `Error al generar backup: ${err.message}` })
    } finally {
      setOcupado(false)
    }
  }

  async function seleccionarBackup() {
    setEstado(null)
    setOcupado(true)
    const res = await desktopApi.importBackup()
    setOcupado(false)

    if (res.canceled) return
    if (!res.ok) {
      setEstado({ ok: false, mensaje: `Error al leer backup: ${res.error}` })
      return
    }

    // Mostrar confirmación antes de restaurar
    setDatosBackup(res.datos)
    setConfirmando(true)
    setPasswordRestore('')
    setErrorPassword(false)
  }

  async function confirmarRestore() {
    if (passwordRestore !== PASSWORD_SUPERADMIN) {
      setErrorPassword(true)
      return
    }
    setOcupado(true)
    await actions.restaurarBackup(datosBackup)
    setOcupado(false)
    setConfirmando(false)
    setDatosBackup(null)
    setPasswordRestore('')
    setEstado({ ok: true, mensaje: 'Backup restaurado correctamente.' })
  }

  function cancelarRestore() {
    setConfirmando(false)
    setDatosBackup(null)
    setPasswordRestore('')
    setErrorPassword(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Resumen del estado actual */}
      <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 text-sm text-gray-300 space-y-1">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Datos actuales</p>
        <p>{totalClientes} cliente{totalClientes !== 1 ? 's' : ''} en base</p>
        <p>{totalSorteos} sorteo{totalSorteos !== 1 ? 's' : ''} en historial</p>
      </div>

      {/* Exportar */}
      <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Exportar backup</p>
        <p className="text-sm text-gray-400 mb-4">
          Guarda todos los datos (clientes, historial, participantes y configuración) en un archivo JSON.
        </p>
        <button
          onClick={exportar}
          disabled={ocupado}
          className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black
            font-bold px-5 py-2.5 rounded-xl transition"
        >
          {ocupado ? 'Exportando…' : 'Exportar backup…'}
        </button>
      </div>

      {/* Importar / Restaurar — solo Electron */}
      {isElectron && (
      <div className="rounded-2xl border border-orange-900 bg-orange-950/20 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-1">Restaurar desde backup</p>
        <p className="text-sm text-orange-200/70 mb-4">
          Reemplaza <strong>todos</strong> los datos actuales con los del archivo de backup seleccionado.
          Esta acción no se puede deshacer.
        </p>

        {!confirmando ? (
          <button
            onClick={seleccionarBackup}
            disabled={ocupado}
            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white
              font-bold px-5 py-2.5 rounded-xl transition"
          >
            {ocupado ? 'Leyendo…' : 'Seleccionar archivo de backup…'}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-orange-700 bg-orange-950/40 p-3 text-sm text-orange-200">
              <p className="font-semibold mb-1">Backup seleccionado — confirmar restauración</p>
              <p className="text-orange-300/70 text-xs">
                {datosBackup?.clientes?.length ?? 0} clientes ·{' '}
                {datosBackup?.sorteos?.length ?? 0} sorteos ·{' '}
                Fecha: {datosBackup?.fecha ? new Date(datosBackup.fecha).toLocaleString() : '—'}
              </p>
            </div>

            <p className="text-sm text-gray-400">Ingresa la contraseña de SuperAdmin para confirmar:</p>
            <input
              type="password"
              value={passwordRestore}
              onChange={e => { setPasswordRestore(e.target.value); setErrorPassword(false) }}
              onKeyDown={e => e.key === 'Enter' && confirmarRestore()}
              placeholder="Contraseña"
              className={`bg-gray-800 text-white rounded-xl px-4 py-2.5 border outline-none
                ${errorPassword ? 'border-red-500' : 'border-gray-600 focus:border-orange-400'}`}
            />
            {errorPassword && <p className="text-red-400 text-sm">Contraseña incorrecta.</p>}

            <div className="flex gap-3">
              <button
                onClick={confirmarRestore}
                disabled={ocupado}
                className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white
                  font-bold px-5 py-2.5 rounded-xl transition"
              >
                {ocupado ? 'Restaurando…' : 'Restaurar'}
              </button>
              <button
                onClick={cancelarRestore}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold
                  px-5 py-2.5 rounded-xl transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Resultado */}
      {estado && (
        <div className={`rounded-xl border p-4 text-sm font-medium ${
          estado.ok
            ? 'border-green-700 bg-green-950/40 text-green-300'
            : 'border-red-700 bg-red-950/40 text-red-300'
        }`}>
          {estado.ok ? '✓ ' : '✕ '}{estado.mensaje}
        </div>
      )}

      {/* Nota */}
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4 text-xs text-gray-500 space-y-1">
        <p>El archivo de backup incluye clientes, historial de sorteos, participantes activos y configuración.</p>
        {isElectron
          ? <p>Al restaurar, los datos actuales son reemplazados completamente por los del backup.</p>
          : <p>Envía el archivo descargado al super admin para consolidar los datos del equipo.</p>
        }
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sección Importar .txt
// ─────────────────────────────────────────────
function SeccionImportar({ clientes, actions, preview, setPreview, importando, setImportando, resultadoImport, setResultadoImport, fileRef }) {

  function leerArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return
    setResultadoImport(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const { clientes: parsed, errores } = parsearTxt(ev.target.result)
      setPreview({ clientes: parsed, errores, nombreArchivo: archivo.name })
    }
    reader.readAsText(archivo, 'UTF-8')
    e.target.value = ''
  }

  async function confirmarImport() {
    if (!preview || importando) return
    setImportando(true)
    let nuevos = 0, actualizados = 0, omitidos = 0

    const plan = planificarImportacion(preview.clientes, clientes)
    for (const { cliente: c, accion, clienteExistente } of plan) {
      if (accion === 'nuevo') {
        await actions.upsertCliente({ nombre: c.nombre, estrellas: c.estrellas })
        nuevos++
      } else if (accion === 'actualizar') {
        await actions.upsertCliente({ ...clienteExistente, estrellas: c.estrellas })
        actualizados++
      } else {
        omitidos++
      }
    }

    setImportando(false)
    setResultadoImport({ nuevos, actualizados, omitidos })
    setPreview(null)
  }

  function cancelar() {
    setPreview(null)
    setResultadoImport(null)
  }

  const ESTRELLA_LABEL = { 0: '☆ 0★', 1: '⭐ 1★', 2: '⭐⭐ 2★', 3: '⭐⭐⭐ 3★' }

  return (
    <div className="space-y-6">

      {/* Instrucciones */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
        <h3 className="text-white font-bold mb-3 text-base">Formato del archivo .txt</h3>
        <pre className="text-gray-300 text-sm leading-relaxed font-mono bg-gray-900 rounded-xl p-4 overflow-x-auto whitespace-pre">{`# Comentario (se ignora)
Juan Pérez, 3
María García, 2
Carlos López, 1
Visitante Nuevo`}</pre>
        <ul className="mt-3 space-y-1 text-gray-400 text-sm">
          <li>• Una línea por cliente</li>
          <li>• Separador: coma <code className="text-yellow-300">,</code> o punto y coma <code className="text-yellow-300">;</code></li>
          <li>• Estrellas opcionales — si se omiten quedan en 0★</li>
          <li>• Clientes nuevos se agregan · Existentes se actualizan solo si cambian las estrellas</li>
        </ul>
      </div>

      {/* Selector de archivo */}
      {!preview && !resultadoImport && (
        <div
          className="flex flex-col items-center gap-4 py-10 border-2 border-dashed border-gray-600
            rounded-2xl hover:border-yellow-500 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <span className="text-5xl select-none">📄</span>
          <p className="text-gray-300 font-semibold">Clic para seleccionar un archivo .txt</p>
          <p className="text-gray-500 text-sm">Texto plano, codificación UTF-8</p>
          <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={leerArchivo} className="hidden" />
        </div>
      )}

      {/* Vista previa */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-white font-bold text-base">
              Vista previa — <span className="text-yellow-400">{preview.nombreArchivo}</span>
            </h3>
            <span className="text-gray-400 text-sm">
              {preview.clientes.length} cliente{preview.clientes.length !== 1 ? 's' : ''} detectado{preview.clientes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {preview.errores.length > 0 && (
            <div className="bg-orange-950/40 border border-orange-700 rounded-xl p-4">
              <p className="text-orange-400 font-semibold text-sm mb-2">Advertencias:</p>
              {preview.errores.map((err, i) => (
                <p key={i} className="text-orange-300 text-xs">{err}</p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-gray-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="py-2.5 px-4 font-medium">#</th>
                  <th className="py-2.5 pr-4 font-medium">Nombre</th>
                  <th className="py-2.5 pr-4 font-medium">Estrellas</th>
                  <th className="py-2.5 pr-4 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.clientes.map((c, i) => {
                  const key = normalizar(c.nombre)
                  const existente = clientes.find(x => x.key === key)
                  let estado, color
                  if (!existente) {
                    estado = 'Nuevo'; color = 'text-green-400'
                  } else if (existente.estrellas !== c.estrellas) {
                    estado = `${existente.estrellas}★ → ${c.estrellas}★`; color = 'text-yellow-400'
                  } else {
                    estado = 'Sin cambios'; color = 'text-gray-500'
                  }
                  return (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40">
                      <td className="py-2.5 px-4 text-gray-500">{i + 1}</td>
                      <td className="py-2.5 pr-4 text-white">{c.nombre}</td>
                      <td className="py-2.5 pr-4 text-gray-300 text-xs">{ESTRELLA_LABEL[c.estrellas]}</td>
                      <td className={`py-2.5 pr-4 text-xs font-semibold ${color}`}>{estado}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={confirmarImport}
              disabled={importando || preview.clientes.length === 0}
              className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black
                font-black px-8 py-3 rounded-xl transition active:scale-95"
            >
              {importando ? 'Importando...' : `Importar ${preview.clientes.length} cliente${preview.clientes.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={cancelar} disabled={importando}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-xl transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultadoImport && (
        <div className="bg-green-950/40 border border-green-700 rounded-2xl p-8 text-center space-y-4">
          <p className="text-5xl">✅</p>
          <p className="text-white font-bold text-lg">Importación completada</p>
          <div className="flex justify-center gap-10">
            <div><p className="text-green-400 font-black text-3xl">{resultadoImport.nuevos}</p><p className="text-gray-400 text-sm">nuevos</p></div>
            <div><p className="text-yellow-400 font-black text-3xl">{resultadoImport.actualizados}</p><p className="text-gray-400 text-sm">actualizados</p></div>
            <div><p className="text-gray-500 font-black text-3xl">{resultadoImport.omitidos}</p><p className="text-gray-400 text-sm">sin cambios</p></div>
          </div>
          <button onClick={cancelar}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm">
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}
