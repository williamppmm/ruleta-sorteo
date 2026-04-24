import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore.jsx'
import { normalizar } from '../utils/normalizar.js'
import { fmtHora, fmtFechaLarga } from '../utils/helpers.js'
import {
  MIN_PARTICIPANTES_POR_RONDA,
  validarDuplicado,
  participantesFaltantes,
} from '../domain/participantes.js'
import { normalizarPremios, puedeIrAlSorteo as calcPuedeIrAlSorteo } from '../domain/rondas.js'

const PASSWORD_ADMIN = '1980'

export default function AdminPanel({ onIrAlSorteo, onVerGanadores }) {
  const { state, derived } = useStore()
  const [tab, setTab] = useState('config')
  const hayGanadoresSesion = (state.config.idsRondasDelDia?.length ?? 0) > 0
  const faltantesMinimos = participantesFaltantes(state.participantes.length)
  const puedeIr = calcPuedeIrAlSorteo(
    state.config, derived.sorteoTerminado,
    state.participantes.length, MIN_PARTICIPANTES_POR_RONDA
  )
  const esPrimerSorteoDeLaSesion = (state.config.idsRondasDelDia?.length ?? 0) === 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Panel de configuración</h1>
        {hayGanadoresSesion && (
          <button
            onClick={onVerGanadores}
            className="bg-white/10 hover:bg-white/15 text-white font-semibold
              border border-white/15 px-5 py-3 rounded-xl transition text-sm sm:text-base"
          >
            Ver ganadores
          </button>
        )}
        {state.config.registroCerrado && !derived.sorteoTerminado && (
          <button
            onClick={onIrAlSorteo}
            disabled={!puedeIr}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black
              px-6 py-3 rounded-xl transition text-base sm:text-lg shadow-lg
              shadow-yellow-900/50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Ir al Sorteo →
          </button>
        )}
      </div>

      {state.config.registroCerrado && !derived.sorteoTerminado && esPrimerSorteoDeLaSesion && !puedeIr && (
        <div className="mb-6 rounded-xl border border-orange-700/70 bg-orange-950/30 px-4 py-3 text-sm text-orange-200">
          Se requieren minimo {MIN_PARTICIPANTES_POR_RONDA} participantes para iniciar una ronda.
          Actualmente hay {state.participantes.length} y faltan {faltantesMinimos}.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2 flex-wrap">
        {[
          { id: 'config',        label: 'Configuración' },
          { id: 'participantes', label: `Participantes (${state.participantes.length})` },
          { id: 'historial',     label: 'Historial' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition
              ${tab === t.id
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config'        && <SeccionConfig />}
      {tab === 'participantes' && <SeccionParticipantes />}
      {tab === 'historial'     && <SeccionHistorial />}
    </div>
  )
}

// ─────────────────────────────────────────────
// Sección A — Configuración del sorteo
// ─────────────────────────────────────────────
function SeccionConfig() {
  const { state, actions, derived } = useStore()
  const cfg = state.config
  const cerrado = cfg.registroCerrado

  // Campos locales para edición (se sincronizan al perder foco / cambiar)
  const [titulo, setTitulo]       = useState(cfg.titulo)
  const [horaInicio, setHoraInicio] = useState(cfg.horaInicio)
  const [totalRondas, setTotalRondas] = useState(cfg.totalRondas)
  const [premios, setPremios]     = useState(
    cfg.premiosPorRonda.length ? cfg.premiosPorRonda : ['']
  )

  // Sincronizar rondas ↔ premios cuando cambia totalRondas
  function handleRondasChange(valor) {
    const n = Math.max(1, parseInt(valor) || 1)
    setTotalRondas(n)
    setPremios(prev => normalizarPremios(prev, n))
  }

  function handlePremioChange(i, valor) {
    setPremios(prev => prev.map((p, idx) => idx === i ? valor : p))
  }

  async function guardar() {
    await actions.setConfig({
      titulo,
      horaInicio,
      totalRondas,
      premiosPorRonda: premios,
    })
  }

  async function cerrarRegistro() {
    await guardar()
    await actions.cerrarRegistro()
  }

  async function reabrirRegistro() {
    await actions.setConfig({ registroCerrado: false, fechaCierre: null })
  }

  const rondasCompletadas = cfg.idsRondasDelDia?.length ?? 0
  const rondaDisplay = Math.min(rondasCompletadas + 1, cfg.totalRondas)

  return (
    <div className="space-y-6">
      {/* Estado del registro */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border
        ${derived.sorteoTerminado
          ? 'bg-yellow-950/40 border-yellow-700 text-yellow-300'
          : cerrado
            ? 'bg-red-950/40 border-red-800 text-red-300'
            : 'bg-green-950/40 border-green-800 text-green-300'}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${
          derived.sorteoTerminado ? 'bg-yellow-400' : cerrado ? 'bg-red-400' : 'bg-green-400'
        }`} />
        <span className="font-semibold text-sm">
          {derived.sorteoTerminado
            ? 'Sesión finalizada'
            : cerrado
              ? 'Registro cerrado'
              : 'Registro abierto'}
        </span>
        {cerrado && cfg.fechaCierre && !derived.sorteoTerminado && (
          <span className="text-xs opacity-60 ml-1">
            — cerrado a las {fmtHora(cfg.fechaCierre)}
          </span>
        )}
        <span className="ml-auto text-xs opacity-60">
          Ronda {rondaDisplay} de {cfg.totalRondas}
        </span>
      </div>

      {/* Formulario de config */}
      <fieldset disabled={cerrado} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-gray-400 text-sm font-medium">Título del sorteo</span>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              onBlur={guardar}
              placeholder="Sorteo en Vivo"
              className="bg-gray-800 text-white rounded-xl px-4 py-2.5 border border-gray-600
                focus:border-yellow-400 outline-none placeholder-gray-600 disabled:opacity-40"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-gray-400 text-sm font-medium">Hora de inicio (cierre automático)</span>
            <input
              type="time"
              value={horaInicio}
              onChange={e => { setHoraInicio(e.target.value); }}
              onBlur={guardar}
              className="bg-gray-800 text-white rounded-xl px-4 py-2.5 border border-gray-600
                focus:border-yellow-400 outline-none disabled:opacity-40"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 max-w-xs">
          <span className="text-gray-400 text-sm font-medium">Número de rondas</span>
          <input
            type="number"
            min="1"
            value={totalRondas}
            onChange={e => handleRondasChange(e.target.value)}
            onBlur={guardar}
            className="bg-gray-800 text-white rounded-xl px-4 py-2.5 border border-gray-600
              focus:border-yellow-400 outline-none w-24 disabled:opacity-40"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-gray-400 text-sm font-medium">Premio por ronda</span>
          <div className="flex flex-wrap gap-3">
            {premios.map((p, i) => (
              <label key={i} className="flex flex-col gap-1">
                <span className="text-gray-500 text-xs">Ronda {i + 1}</span>
                <input
                  type="text"
                  value={p}
                  onChange={e => handlePremioChange(i, e.target.value)}
                  onBlur={guardar}
                  placeholder="Ej: 5000"
                  className="bg-gray-800 text-white rounded-xl px-3 py-2 border border-gray-600
                    focus:border-yellow-400 outline-none w-32 placeholder-gray-600 disabled:opacity-40"
                />
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* Botones de acción */}
      <div className="flex gap-3 pt-2">
        {derived.sorteoTerminado ? (
          <button
            onClick={actions.nuevaSesion}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold
              px-6 py-2.5 rounded-xl transition"
          >
            Programar nueva sesión de sorteo
          </button>
        ) : !cerrado ? (
          <button
            onClick={cerrarRegistro}
            className="bg-red-700 hover:bg-red-600 text-white font-bold
              px-6 py-2.5 rounded-xl transition"
          >
            Cerrar Registro
          </button>
        ) : (
          <button
            onClick={reabrirRegistro}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold
              px-5 py-2.5 rounded-xl transition text-sm"
          >
            Reabrir registro
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sección B — Registro de participantes
// ─────────────────────────────────────────────
function SeccionParticipantes() {
  const { state, actions } = useStore()
  const cerrado = state.config.registroCerrado

  const [nombre, setNombre]           = useState('')
  const [msgError, setMsgError]       = useState('')
  const [msgOk, setMsgOk]             = useState('')
  const [editandoId, setEditandoId]   = useState(null)
  const [editNombre, setEditNombre]   = useState('')
  const [confirmBorrar, setConfirmBorrar] = useState(null)
  const [pwdBorrar, setPwdBorrar]     = useState('')
  const [pwdError, setPwdError]       = useState(false)
  const [sugerenciaActiva, setSugerenciaActiva] = useState(-1)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Autocompletado desde base de clientes.
  // Ordena por cercania: coincidencia exacta -> prefijo -> subcadena; dentro
  // de cada nivel, orden alfabetico. La primera sugerencia siempre es la mas
  // probable, que es la que Enter/TAB autocompletan por defecto.
  const sugerencias = useMemo(() => {
    const q = normalizar(nombre)
    if (!q) return []
    return state.clientes
      .map(c => {
        const norm = normalizar(c.nombre)
        if (!norm.includes(q)) return null
        let rank = 2                         // subcadena en cualquier posicion
        if (norm === q) rank = 0             // coincidencia exacta
        else if (norm.startsWith(q)) rank = 1 // prefijo
        return { cliente: c, rank }
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank
        || a.cliente.nombre.localeCompare(b.cliente.nombre))
      .slice(0, 8)
      .map(x => x.cliente)
  }, [nombre, state.clientes])

  useEffect(() => {
    if (!cerrado) inputRef.current?.focus()
  }, [cerrado])

  async function ejecutarRegistro(n) {
    const nombre_trim = n.trim()
    if (!nombre_trim) { setMsgError('Nombre obligatorio.'); return }

    if (validarDuplicado(nombre_trim, state.participantes)) {
      setMsgError(`${nombre_trim} ya está registrado.`)
      setMsgOk('')
      setNombre('')
      setSugerenciaActiva(-1)
      setTimeout(() => setMsgError(''), 2500)
      inputRef.current?.focus()
      return
    }

    await actions.addParticipante(nombre_trim)
    setNombre('')
    setMsgError('')
    setSugerenciaActiva(-1)
    setMsgOk('Participante registrado.')
    setTimeout(() => setMsgOk(''), 2000)
    inputRef.current?.focus()
  }

  function registrar(e) {
    e.preventDefault()
    // Si hay sugerencias visibles, priorizar la más cercana (primera de la lista)
    // o la que el usuario haya resaltado con flechas. Evita registrar prefijos
    // como "Pao" cuando existe "Paola" en la base.
    if (sugerencias.length > 0) {
      const idx = sugerenciaActiva >= 0 ? sugerenciaActiva : 0
      ejecutarRegistro(sugerencias[idx].nombre)
    } else {
      ejecutarRegistro(nombre)
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      if (sugerencias.length === 0) return
      e.preventDefault()
      setSugerenciaActiva(prev => Math.min(prev + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      if (sugerencias.length === 0) return
      e.preventDefault()
      setSugerenciaActiva(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Tab' && sugerencias.length > 0) {
      // TAB completa con la sugerencia más cercana sin salir del input.
      e.preventDefault()
      const idx = sugerenciaActiva >= 0 ? sugerenciaActiva : 0
      ejecutarRegistro(sugerencias[idx].nombre)
    } else if (e.key === 'Escape') {
      setSugerenciaActiva(-1)
      setNombre('')
    }
    // Enter se deja al submit del formulario (ver `registrar`), que ya aplica
    // la misma logica de priorizar la sugerencia mas cercana.
  }

  async function guardarEdicion(p) {
    const n = editNombre.trim()
    if (!n) { setEditandoId(null); return }
    if (validarDuplicado(n, state.participantes, p.id)) {
      alert('Nombre duplicado.')
      return
    }
    await actions.updateParticipante(p.id, n)
    setEditandoId(null)
  }

  function iniciarBorrado(p) {
    setConfirmBorrar(p)
    setPwdBorrar('')
    setPwdError(false)
  }

  async function confirmarBorrado() {
    if (pwdBorrar !== PASSWORD_ADMIN) { setPwdError(true); return }
    await actions.deleteParticipante(confirmBorrar.id)
    setConfirmBorrar(null)
  }

  return (
    <div>
      {/* Formulario de registro */}
      <form onSubmit={registrar} className="flex flex-col gap-2 mb-5">
        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setMsgError(''); setSugerenciaActiva(-1) }}
              onKeyDown={handleInputKeyDown}
              placeholder="Nombre del participante"
              disabled={cerrado}
              autoComplete="off"
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-2.5
                border border-gray-600 focus:border-yellow-400 outline-none
                placeholder-gray-500 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={cerrado}
              className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40
                text-black font-bold px-6 py-2.5 rounded-xl transition"
            >
              Registrar
            </button>
          </div>

          {/* Sugerencias de autocompletado */}
          {sugerencias.length > 0 && !cerrado && (
            <ul className="absolute top-full left-0 right-16 z-20 mt-1
              bg-gray-800 border border-gray-600 rounded-xl overflow-hidden shadow-xl">
              {sugerencias.map((c, idx) => {
                // La primera sugerencia se resalta por defecto: es la que
                // Enter/TAB autocompletan si el usuario no ha navegado con flechas.
                const seleccionExplicita = sugerenciaActiva === idx
                const seleccionPorDefecto = sugerenciaActiva === -1 && idx === 0
                const destacada = seleccionExplicita || seleccionPorDefecto
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onMouseDown={() => { setNombre(c.nombre); setSugerenciaActiva(-1) }}
                      className={`w-full px-4 py-2.5 transition text-left flex items-center justify-between gap-3
                        ${destacada ? 'bg-yellow-500/20 text-yellow-200' : 'hover:bg-gray-700 text-white'}`}
                    >
                      <span>{c.nombre}</span>
                      {destacada && (
                        <span className="text-[10px] uppercase tracking-wider text-yellow-300/70 font-semibold">
                          Enter / Tab
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {msgError && <p className="text-red-400 text-sm">{msgError}</p>}
        {msgOk    && <p className="text-green-400 text-sm">{msgOk}</p>}
        {cerrado  && <p className="text-orange-400 text-sm">El registro está cerrado.</p>}
      </form>

      {/* Tabla de participantes */}
      {state.participantes.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          Aún no hay participantes registrados.
        </p>
      ) : (
        <div className="overflow-x-auto" ref={listRef}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-700">
                <th className="pb-2 pr-3 font-medium">#</th>
                <th className="pb-2 pr-3 font-medium">Nombre</th>
                <th className="pb-2 pr-3 font-medium">Hora</th>
                <th className="pb-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.participantes.map((p, i) => {
                const editando = editandoId === p.id
                return (
                  <tr key={p.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition">
                    <td className="py-3 pr-3 text-gray-500">{i + 1}</td>

                    {/* Nombre / editor inline */}
                    <td className="py-3 pr-3">
                      {editando ? (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  guardarEdicion(p)
                              if (e.key === 'Escape') setEditandoId(null)
                            }}
                            className="bg-gray-700 text-white rounded-lg px-3 py-1
                              border border-yellow-400 outline-none text-sm w-40"
                          />
                          <button onClick={() => guardarEdicion(p)}
                            className="text-green-400 hover:text-green-300 text-xs font-bold">✓</button>
                          <button onClick={() => setEditandoId(null)}
                            className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                        </div>
                      ) : (
                        <span className="text-white font-medium">{p.nombre}</span>
                      )}
                    </td>

                    <td className="py-3 pr-3 text-gray-400">{fmtHora(p.horaRegistro)}</td>

                    <td className="py-3">
                      <div className="flex gap-3">
                        {!cerrado && (
                          <>
                            <button
                              onClick={() => { setEditandoId(p.id); setEditNombre(p.nombre) }}
                              className="text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => iniciarBorrado(p)}
                              className="text-red-600 hover:text-red-400 text-xs font-medium transition"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                        {cerrado && <span className="text-gray-600 text-xs">—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-gray-500 text-sm mt-3">
            Total: {state.participantes.length} participante{state.participantes.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Modal de confirmación con contraseña */}
      {confirmBorrar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Eliminar participante</h3>
            <p className="text-gray-400 text-sm mb-4">
              ¿Eliminar a <span className="text-white font-semibold">{confirmBorrar.nombre}</span>?
              Ingresa la contraseña de admin.
            </p>
            <input
              autoFocus
              type="password"
              value={pwdBorrar}
              onChange={e => { setPwdBorrar(e.target.value); setPwdError(false) }}
              onKeyDown={e => { if (e.key === 'Enter') confirmarBorrado() }}
              placeholder="Contraseña"
              className={`w-full bg-gray-800 text-white text-center tracking-widest rounded-xl
                px-4 py-2.5 border outline-none mb-2 transition
                ${pwdError ? 'border-red-500' : 'border-gray-600 focus:border-yellow-400'}`}
            />
            {pwdError && <p className="text-red-400 text-xs mb-2 text-center">Contraseña incorrecta</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={confirmarBorrado}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2 rounded-xl transition"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmBorrar(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-xl transition"
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
// Sección C — Historial de ganadores
// ─────────────────────────────────────────────
function SeccionHistorial() {
  const { state, actions } = useStore()
  const [confirmandoPagoId, setConfirmandoPagoId] = useState(null)

  async function registrarPago(id) {
    await actions.registrarPago(id)
    setConfirmandoPagoId(null)
  }

  if (state.sorteos.length === 0) {
    return (
      <p className="text-gray-500 text-center py-10">
        Aún no se han realizado sorteos.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-gray-700">
            <th className="pb-2 pr-3 font-medium">Ganador</th>
            <th className="pb-2 pr-3 font-medium">Fecha</th>
            <th className="pb-2 pr-3 font-medium">Premio</th>
            <th className="pb-2 pr-3 font-medium">Estado</th>
            <th className="pb-2 font-medium">Fecha de pago</th>
          </tr>
        </thead>
        <tbody>
          {state.sorteos.map(s => {
            const confirmando = confirmandoPagoId === s.id
            return (
              <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition">
                <td className="py-3 pr-3 text-white font-medium">{s.ganadorNombre}</td>
                <td className="py-3 pr-3 text-gray-400">{fmtFechaLarga(s.fecha)} {s.hora}</td>
                <td className="py-3 pr-3 text-yellow-400 font-bold">{s.valorPremio}</td>
                <td className="py-3 pr-3">
                  {s.pagado ? (
                    <span className="text-green-400 font-semibold">✓ Pagado</span>
                  ) : confirmando ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => registrarPago(s.id)}
                        className="text-green-400 hover:text-green-300 text-xs font-bold"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmandoPagoId(null)}
                        className="text-gray-500 hover:text-gray-300 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoPagoId(s.id)}
                      className="text-orange-400 hover:text-orange-300 text-xs font-semibold
                        border border-orange-700 hover:border-orange-500 px-3 py-1 rounded-lg transition"
                    >
                      Registrar pago
                    </button>
                  )}
                </td>
                <td className="py-3 text-gray-400">
                  {s.fechaPago ? fmtFechaLarga(s.fechaPago) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// fmtHora y fmtFechaLarga importados desde src/utils/helpers.js
