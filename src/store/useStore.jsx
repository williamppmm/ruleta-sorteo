/**
 * Store global de la aplicación
 *
 * Patrón: useContext + useReducer
 * - El estado en memoria se actualiza con dispatch (síncrono).
 * - Las acciones persisten a IndexedDB antes de despachar.
 * - useStore() expone { state, actions } a cualquier componente.
 */

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  STORES, CONFIG_DEFAULT, cargarEstadoInicial, saveConfig,
  put, add, remove, clear, writeAllRecords,
  inicializarBackend,
} from './persistence.js';
import { normalizar } from '../utils/normalizar.js';

// ─────────────────────────────────────────────
// Identidad estable de clientes
// ─────────────────────────────────────────────

/** Genera un ID opaco que no cambia aunque se renombre el cliente. */
function generarClienteId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Migración de datos heredados (IndexedDB o JSON sin clienteId).
 *
 * - Asigna clienteId a clientes que no lo tienen.
 * - Backfilla ganadorClienteId en sorteos históricos usando el ganadorKey.
 *
 * Solo persiste los registros que realmente cambiaron.
 */
async function migrarIdentidad(clientes, sorteos) {
  // 1. Asignar clienteId a clientes sin él
  const clientesMigrados = clientes.map(c =>
    c.clienteId ? c : { ...c, clienteId: generarClienteId() }
  );

  // 2. Backfill ganadorClienteId en sorteos sin él
  const sorteosMigrados = sorteos.map(s => {
    if (s.ganadorClienteId !== undefined) return s;
    const cid = clientesMigrados.find(c => c.key === s.ganadorKey)?.clienteId ?? null;
    return { ...s, ganadorClienteId: cid };
  });

  // 3. Persistir solo los que cambiaron
  const clientesCambiados = clientesMigrados.filter(c =>
    !clientes.some(o => o.key === c.key && o.clienteId)
  );
  const sorteosCambiados = sorteosMigrados.filter(s =>
    !sorteos.some(o => o.id === s.id && o.ganadorClienteId !== undefined)
  );

  for (const c of clientesCambiados) await put(STORES.CLIENTES, c);
  for (const s of sorteosCambiados) await put(STORES.SORTEOS, s);

  return { clientes: clientesMigrados, sorteos: sorteosMigrados };
}

// ─────────────────────────────────────────────
// Estado inicial
// ─────────────────────────────────────────────
const ESTADO_INICIAL = {
  clientes:      [],
  participantes: [],
  sorteos:       [],
  config: {
    key: 'app',
    titulo: '',
    horaInicio: '',
    totalRondas: 1,
    premiosPorRonda: [''],
    rondaActual: 0,
    registroCerrado: false,
    fechaCierre: null,
    idsRondasDelDia: [],
  },
  /**
   * Modo de persistencia activo (determinado en tiempo de ejecucion).
   * Valores posibles: { tipo: 'electron' | 'carpeta' | 'idb', nombre?, handlePendiente? }
   * La UI usa esto para mostrar "Conectar carpeta" o re-autorizar.
   */
  modoPersistencia: { tipo: 'idb' },
  cargando: true,
  error: null,
};

// ─────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'CARGAR_TODO':
      return {
        ...state,
        ...action.payload,
        cargando: false,
        error: null,
      };

    case 'ERROR_CARGA':
      return { ...state, cargando: false, error: action.payload };

    // ── Config ──────────────────────────────
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.payload } };

    // ── Participantes ────────────────────────
    case 'ADD_PARTICIPANTE':
      return {
        ...state,
        participantes: [...state.participantes, action.payload]
          .sort((a, b) => new Date(a.horaRegistro) - new Date(b.horaRegistro)),
      };

    case 'UPDATE_PARTICIPANTE':
      return {
        ...state,
        participantes: state.participantes.map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };

    case 'DELETE_PARTICIPANTE':
      return {
        ...state,
        participantes: state.participantes.filter(p => p.id !== action.payload),
      };

    case 'CLEAR_PARTICIPANTES':
      return { ...state, participantes: [] };

    // ── Clientes ─────────────────────────────
    case 'UPSERT_CLIENTE':
      return {
        ...state,
        clientes: (() => {
          const existe = state.clientes.find(c => c.key === action.payload.key);
          const lista = existe
            ? state.clientes.map(c => c.key === action.payload.key ? { ...c, ...action.payload } : c)
            : [...state.clientes, action.payload];
          return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
        })(),
      };

    case 'DELETE_CLIENTE':
      return {
        ...state,
        clientes: state.clientes.filter(c => c.key !== action.payload),
      };

    // ── Sorteos ───────────────────────────────
    case 'ADD_SORTEO':
      return {
        ...state,
        sorteos: [action.payload, ...state.sorteos],
      };

    case 'PAGAR_SORTEO':
      return {
        ...state,
        sorteos: state.sorteos.map(s =>
          s.id === action.payload.id
            ? { ...s, pagado: true, fechaPago: action.payload.fechaPago }
            : s
        ),
      };

    case 'RESET_TODO':
      return {
        ...state,
        clientes: [],
        participantes: [],
        sorteos: [],
        config: { ...CONFIG_DEFAULT },
      };

    case 'RESTAURAR_BACKUP':
      return {
        ...state,
        clientes:      action.payload.clientes,
        participantes: action.payload.participantes,
        sorteos:       action.payload.sorteos,
        config:        action.payload.config,
      };

    case 'SET_MODO_PERSISTENCIA':
      return { ...state, modoPersistencia: action.payload };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────
// Contexto
// ─────────────────────────────────────────────
const StoreContext = createContext(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, ESTADO_INICIAL);

  // Carga inicial:
  //   1. Resuelve el backend de persistencia (Electron / carpeta / IndexedDB).
  //   2. Carga los 4 stores con ese backend.
  //   3. Aplica migracion de identidad (backfill clienteId) si hace falta.
  useEffect(() => {
    (async () => {
      try {
        const modoPersistencia = await inicializarBackend();
        const datos            = await cargarEstadoInicial();
        const migrado          = await migrarIdentidad(datos.clientes, datos.sorteos);
        dispatch({
          type: 'CARGAR_TODO',
          payload: { ...datos, ...migrado, modoPersistencia },
        });
      } catch (err) {
        dispatch({ type: 'ERROR_CARGA', payload: err.message });
      }
    })();
  }, []);

  // ── Acciones ─────────────────────────────────

  /** Actualiza la configuración del sorteo. */
  const setConfig = useCallback(async (cambios) => {
    const nueva = { ...state.config, ...cambios };
    await saveConfig(nueva);
    dispatch({ type: 'SET_CONFIG', payload: cambios });
  }, [state.config]);

  /**
   * Registra un participante nuevo.
   * Si el nombre no existe en la base de clientes, lo crea con 0 estrellas.
   */
  const addParticipante = useCallback(async (nombre) => {
    const key = normalizar(nombre);
    const horaRegistro = new Date().toISOString();

    // Persist participante
    const id = await add(STORES.PARTICIPANTES, { nombre, horaRegistro });
    dispatch({ type: 'ADD_PARTICIPANTE', payload: { id, nombre, horaRegistro } });

    // Crear cliente si no existe
    const existeCliente = state.clientes.some(c => c.key === key);
    if (!existeCliente) {
      const cliente = {
        key,
        nombre,
        estrellas:        0,
        clienteId:        generarClienteId(),
        fechaRegistro:    horaRegistro,
        fechaUltimoPremio: null,
      };
      await put(STORES.CLIENTES, cliente);
      dispatch({ type: 'UPSERT_CLIENTE', payload: cliente });
    }
  }, [state.clientes]);

  /**
   * Determina si un cliente puede eliminarse sin riesgo:
   * fue creado por una registracion concreta, tiene 0 estrellas y jamas gano.
   * Se usa al borrar o renombrar un participante para no dejar clientes huerfanos.
   */
  const clienteEsDescartableDesdeRegistro = useCallback((cliente, horaRegistroParticipante) => {
    if (!cliente) return false;
    if (cliente.fechaRegistro !== horaRegistroParticipante) return false;
    if ((cliente.estrellas ?? 0) !== 0) return false;
    const gano = state.sorteos.some(s =>
      s.ganadorKey === cliente.key
      || (cliente.clienteId && s.ganadorClienteId === cliente.clienteId)
    );
    return !gano;
  }, [state.sorteos]);

  /** Edita el nombre de un participante (y vincula con cliente si aplica). */
  const updateParticipante = useCallback(async (id, nuevoNombre) => {
    const participanteAnterior = state.participantes.find(p => p.id === id);
    const horaRegistro = participanteAnterior?.horaRegistro;
    const key = normalizar(nuevoNombre);
    const actualizado = { id, nombre: nuevoNombre, horaRegistro };

    await put(STORES.PARTICIPANTES, actualizado);
    dispatch({ type: 'UPDATE_PARTICIPANTE', payload: actualizado });

    // Si el nombre anterior dejo un cliente huerfano (creado por esta misma
    // registracion, sin estrellas y sin historial de premios), limpiarlo.
    if (participanteAnterior) {
      const keyAnterior = normalizar(participanteAnterior.nombre);
      if (keyAnterior !== key) {
        const clienteAnterior = state.clientes.find(c => c.key === keyAnterior);
        if (clienteEsDescartableDesdeRegistro(clienteAnterior, participanteAnterior.horaRegistro)) {
          await remove(STORES.CLIENTES, keyAnterior);
          dispatch({ type: 'DELETE_CLIENTE', payload: keyAnterior });
        }
      }
    }

    // Crear cliente si el nuevo nombre no existe
    const existeCliente = state.clientes.some(c => c.key === key);
    if (!existeCliente) {
      const cliente = {
        key,
        nombre:           nuevoNombre,
        estrellas:        0,
        clienteId:        generarClienteId(),
        fechaRegistro:    new Date().toISOString(),
        fechaUltimoPremio: null,
      };
      await put(STORES.CLIENTES, cliente);
      dispatch({ type: 'UPSERT_CLIENTE', payload: cliente });
    }
  }, [state.participantes, state.clientes, clienteEsDescartableDesdeRegistro]);

  /**
   * Elimina un participante del sorteo activo.
   * Si ese participante genero un cliente huerfano (creado por esta misma
   * registracion, sin estrellas ni historial), tambien se borra del .json
   * para que no reaparezca en autocompletado.
   */
  const deleteParticipante = useCallback(async (id) => {
    const participante = state.participantes.find(p => p.id === id);

    await remove(STORES.PARTICIPANTES, id);
    dispatch({ type: 'DELETE_PARTICIPANTE', payload: id });

    if (participante) {
      const key = normalizar(participante.nombre);
      const cliente = state.clientes.find(c => c.key === key);
      if (clienteEsDescartableDesdeRegistro(cliente, participante.horaRegistro)) {
        await remove(STORES.CLIENTES, key);
        dispatch({ type: 'DELETE_CLIENTE', payload: key });
      }
    }
  }, [state.participantes, state.clientes, clienteEsDescartableDesdeRegistro]);

  /** Limpia todos los participantes (entre rondas). */
  const clearParticipantes = useCallback(async () => {
    await clear(STORES.PARTICIPANTES);
    dispatch({ type: 'CLEAR_PARTICIPANTES' });
  }, []);

  /** Cierra el registro de participantes. */
  const cerrarRegistro = useCallback(async () => {
    const cambios = { registroCerrado: true, fechaCierre: new Date().toISOString() };
    await saveConfig({ ...state.config, ...cambios });
    dispatch({ type: 'SET_CONFIG', payload: cambios });
  }, [state.config]);

  /** Avanza a la siguiente ronda (conserva participantes y registro cerrado, solo incrementa ronda). */
  const siguienteRonda = useCallback(async () => {
    const nuevaRonda = state.config.rondaActual + 1;
    const cambios = { rondaActual: nuevaRonda };
    await saveConfig({ ...state.config, ...cambios });
    dispatch({ type: 'SET_CONFIG', payload: cambios });
  }, [state.config]);

  /**
   * Inicia una nueva sesión de sorteo tras haber corrido uno previo.
   *
   * Resetea toda la configuración del evento y los inscritos para empezar
   * en blanco. Cada sorteo es un evento distinto (titulo nuevo, a veces
   * diferente numero de rondas o premios), asi que el operador define
   * desde cero en cada programacion.
   *
   * Lo unico que NO se toca:
   *   - Historial de sorteos (para ver ganadores pasados y registrar pagos pendientes).
   *   - Base de clientes con estrellas (la calificacion es permanente).
   */
  const nuevaSesion = useCallback(async () => {
    await clear(STORES.PARTICIPANTES);
    const cambios = {
      titulo:          '',
      horaInicio:      '',
      totalRondas:     1,
      premiosPorRonda: [''],
      rondaActual:     0,
      registroCerrado: false,
      fechaCierre:     null,
      idsRondasDelDia: [],
    };
    await saveConfig({ ...state.config, ...cambios });
    dispatch({ type: 'CLEAR_PARTICIPANTES' });
    dispatch({ type: 'SET_CONFIG', payload: cambios });
  }, [state.config]);

  /** Borra toda la informacion persistida de la app y reinicia la configuracion. */
  const borrarTodo = useCallback(async () => {
    await Promise.all([
      clear(STORES.CLIENTES),
      clear(STORES.PARTICIPANTES),
      clear(STORES.SORTEOS),
    ]);
    await saveConfig({ ...CONFIG_DEFAULT });
    dispatch({ type: 'RESET_TODO' });
  }, []);

  /**
   * Restaura la app desde un objeto de backup.
   * Reemplaza todos los stores y la configuración con los datos del backup.
   * @param {{ clientes, participantes, sorteos, config }} datos
   */
  const restaurarBackup = useCallback(async (datos) => {
    await Promise.all([
      writeAllRecords(STORES.CLIENTES,      datos.clientes      ?? []),
      writeAllRecords(STORES.PARTICIPANTES, datos.participantes ?? []),
      writeAllRecords(STORES.SORTEOS,       datos.sorteos       ?? []),
    ]);
    const config = { ...CONFIG_DEFAULT, ...(datos.config ?? {}) };
    await saveConfig(config);

    // Ordenar igual que cargarEstadoInicial para que el estado sea consistente
    const payload = {
      clientes:      [...(datos.clientes ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      participantes: [...(datos.participantes ?? [])].sort((a, b) => new Date(a.horaRegistro) - new Date(b.horaRegistro)),
      sorteos:       [...(datos.sorteos ?? [])].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
      config,
    };
    dispatch({ type: 'RESTAURAR_BACKUP', payload });
  }, []);

  // ── CRUD Clientes ────────────────────────────

  /** Crea o actualiza un cliente en la base permanente. */
  const upsertCliente = useCallback(async (cliente) => {
    const registro = {
      key:              normalizar(cliente.nombre),
      nombre:           cliente.nombre,
      estrellas:        cliente.estrellas ?? 0,
      clienteId:        cliente.clienteId ?? generarClienteId(),
      fechaRegistro:    cliente.fechaRegistro ?? new Date().toISOString(),
      fechaUltimoPremio: cliente.fechaUltimoPremio ?? null,
    };
    await put(STORES.CLIENTES, registro);
    dispatch({ type: 'UPSERT_CLIENTE', payload: registro });
  }, []);

  /** Elimina un cliente de la base permanente. */
  const deleteCliente = useCallback(async (key) => {
    await remove(STORES.CLIENTES, key);
    dispatch({ type: 'DELETE_CLIENTE', payload: key });
  }, []);

  // ── Sorteos ──────────────────────────────────

  /**
   * Registra un ganador:
   *   1. Persiste el sorteo en historial.
   *   2. Actualiza fechaUltimoPremio del cliente.
   *   3. Agrega el ID a idsRondasDelDia en config.
   */
  const registrarGanador = useCallback(async ({ ganadorNombre, valorPremio, titulo }) => {
    const fecha = new Date().toISOString();
    const pad = n => String(n).padStart(2, '0');
    const d = new Date(fecha);
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const ganadorKey = normalizar(ganadorNombre);

    // Persistir sorteo
    const clienteGanador = state.clientes.find(c => c.key === ganadorKey);
    const sorteo = {
      fecha,
      hora,
      titulo: titulo || state.config.titulo || 'Sorteo',
      valorPremio,
      ganadorNombre,
      ganadorKey,
      ganadorClienteId: clienteGanador?.clienteId ?? null,
      totalParticipantes: state.participantes.length,
      pagado: false,
      fechaPago: null,
    };
    const id = await add(STORES.SORTEOS, sorteo);
    const sorteoCompleto = { ...sorteo, id };
    dispatch({ type: 'ADD_SORTEO', payload: sorteoCompleto });

    // Actualizar fechaUltimoPremio del cliente
    const clienteActual = state.clientes.find(c => c.key === ganadorKey);
    if (clienteActual) {
      const clienteActualizado = { ...clienteActual, fechaUltimoPremio: fecha };
      await put(STORES.CLIENTES, clienteActualizado);
      dispatch({ type: 'UPSERT_CLIENTE', payload: clienteActualizado });
    }

    // Registrar ID en config del día
    const idsActualizados = [...(state.config.idsRondasDelDia || []), id];
    const cambiosConfig = { idsRondasDelDia: idsActualizados };
    await saveConfig({ ...state.config, ...cambiosConfig });
    dispatch({ type: 'SET_CONFIG', payload: cambiosConfig });

    return sorteoCompleto;
  }, [state.participantes, state.clientes, state.config]);

  /** Actualiza el modo de persistencia en el estado (tras conectar/desconectar carpeta). */
  const setModoPersistencia = useCallback((modo) => {
    dispatch({ type: 'SET_MODO_PERSISTENCIA', payload: modo });
  }, []);

  /** Registra el pago de un premio. */
  const registrarPago = useCallback(async (idSorteo) => {
    const fechaPago = new Date().toISOString();
    const sorteo = state.sorteos.find(s => s.id === idSorteo);
    if (!sorteo) return;

    const actualizado = { ...sorteo, pagado: true, fechaPago };
    await put(STORES.SORTEOS, actualizado);
    dispatch({ type: 'PAGAR_SORTEO', payload: { id: idSorteo, fechaPago } });
  }, [state.sorteos]);

  // ── Estado derivado ───────────────────────────

  /** Ganadores de las rondas del día actual (para veto intradía). */
  const ganadoresDelDia = state.sorteos
    .filter(s => state.config.idsRondasDelDia?.includes(s.id))
    .map(s => ({ nombre: s.ganadorNombre }));

  /** Premio de la ronda actual según configuración. */
  const premioRondaActual = state.config.premiosPorRonda?.[state.config.rondaActual] ?? '';

  /** ¿El sorteo del día está terminado? (todas las rondas completadas) */
  const sorteoTerminado =
    (state.config.idsRondasDelDia?.length ?? 0) >= state.config.totalRondas;

  return (
    <StoreContext.Provider value={{
      state,
      actions: {
        setConfig,
        addParticipante,
        updateParticipante,
        deleteParticipante,
        clearParticipantes,
        cerrarRegistro,
        siguienteRonda,
        nuevaSesion,
        borrarTodo,
        restaurarBackup,
        upsertCliente,
        deleteCliente,
        registrarGanador,
        registrarPago,
        setModoPersistencia,
      },
      derived: {
        ganadoresDelDia,
        premioRondaActual,
        sorteoTerminado,
      },
    }}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Hook principal de acceso al store.
 * @returns {{ state, actions, derived }}
 */
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>');
  return ctx;
}
