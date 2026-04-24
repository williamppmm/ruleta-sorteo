/**
 * Tests del Motor de Probabilidades y Vetos
 *
 * Cubre los criterios actuales:
 *   - Prioridad estricta: 3★ > 2★ > 1★ > 0★ (cualquier nivel superior excluye a los inferiores)
 *   - 0★ solo gana si son los únicos en el pool
 *   - Veto intradía (un ganador no vuelve a participar en el mismo evento)
 *   - Cambio de ronda (pool sin ganador anterior)
 *   - Sesión finalizada (fallback: todos vetados)
 *   - Renombrado sin pérdida de identidad (clienteId stable)
 */

import { describe, it, expect } from 'vitest';
import { secureIndex, obtenerEstrellas, seleccionarGanador } from './probabilidades.js';
import { estaVetadoIntradia, clasificarParticipantes } from './vetos.js';
import { normalizar } from '../utils/normalizar.js';

// ── Fechas de referencia (para tests de identidad tras renombrado) ─────────
const ayer = new Date(Date.now() - 86400000).toISOString();

// ── Participantes de prueba ────────────────────────────────────────────────
const P = {
  ana:   { id: 1, nombre: 'Ana' },
  bob:   { id: 2, nombre: 'Bob' },
  carl:  { id: 3, nombre: 'Carl' },
  diana: { id: 4, nombre: 'Diana' },
  edgar: { id: 5, nombre: 'Edgar' },
};

// ── Base de clientes ───────────────────────────────────────────────────────
const clientes = [
  { key: 'ana',   nombre: 'Ana',   estrellas: 3, fechaUltimoPremio: null },
  { key: 'bob',   nombre: 'Bob',   estrellas: 2, fechaUltimoPremio: null },
  { key: 'carl',  nombre: 'Carl',  estrellas: 1, fechaUltimoPremio: null },
  { key: 'diana', nombre: 'Diana', estrellas: 0, fechaUltimoPremio: null },
  // Edgar ausente → default 0★
];

// ── helpers para tests estadísticos ───────────────────────────────────────
function contarGanadores(pool, clts, ganadoresDelDia, N = 300) {
  const conteo = {};
  for (let i = 0; i < N; i++) {
    const g = seleccionarGanador(pool, clts, ganadoresDelDia);
    conteo[g.nombre] = (conteo[g.nombre] ?? 0) + 1;
  }
  return conteo;
}

// ═══════════════════════════════════════════════════════════════════════════
describe('normalizar', () => {
  it('recorta espacios y convierte a minúsculas', () => {
    expect(normalizar('  Ana  ')).toBe('ana');
  });
  it('colapsa espacios internos múltiples', () => {
    expect(normalizar('Juan  Carlos')).toBe('juan carlos');
  });
  it('cadena vacía → cadena vacía', () => {
    expect(normalizar('')).toBe('');
  });
  it('null → cadena vacía', () => {
    expect(normalizar(null)).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('secureIndex', () => {
  it('siempre devuelve un índice dentro del rango', () => {
    for (let i = 0; i < 1000; i++) {
      const idx = secureIndex(5);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5);
    }
  });
  it('secureIndex(1) siempre devuelve 0', () => {
    for (let i = 0; i < 20; i++) {
      expect(secureIndex(1)).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('obtenerEstrellas', () => {
  it('Ana → 3★', () => expect(obtenerEstrellas('Ana', clientes)).toBe(3));
  it('Bob → 2★', () => expect(obtenerEstrellas('Bob', clientes)).toBe(2));
  it('carl (lowercase) → 1★', () => expect(obtenerEstrellas('carl', clientes)).toBe(1));
  it('Diana → 0★', () => expect(obtenerEstrellas('Diana', clientes)).toBe(0));
  it('Edgar (no en base) → 0★ por defecto', () => expect(obtenerEstrellas('Edgar', clientes)).toBe(0));
  it('desconocido → 0★, no 1★ como en el prototipo antiguo', () => {
    expect(obtenerEstrellas('Nadie', clientes)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Veto intradía', () => {
  const ganadoresDelDia = [{ nombre: 'Ana' }];

  it('Ana está vetada (ya ganó hoy)', () => {
    expect(estaVetadoIntradia(P.ana, ganadoresDelDia)).toBe(true);
  });
  it('Bob no está vetado', () => {
    expect(estaVetadoIntradia(P.bob, ganadoresDelDia)).toBe(false);
  });
  it('comparación insensible a mayúsculas y espacios', () => {
    expect(estaVetadoIntradia({ nombre: '  ANA  ' }, ganadoresDelDia)).toBe(true);
  });
  it('lista de ganadores vacía → nadie vetado', () => {
    expect(estaVetadoIntradia(P.ana, [])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('clasificarParticipantes', () => {
  const ganadoresDelDia = [{ nombre: 'Carl' }];

  const { elegibles, vetadosIntradia } = clasificarParticipantes(
    [P.ana, P.bob, P.carl, P.diana],
    clientes,
    ganadoresDelDia
  );

  it('Carl vetado intradía', () => {
    expect(vetadosIntradia).toHaveLength(1);
    expect(vetadosIntradia[0].nombre).toBe('Carl');
  });
  it('Ana, Bob y Diana son elegibles', () => {
    expect(elegibles).toHaveLength(3);
  });
  it('Ana está en elegibles', () => {
    expect(elegibles.some(e => e.nombre === 'Ana')).toBe(true);
  });
  it('Bob está en elegibles (ya no hay veto interdía)', () => {
    expect(elegibles.some(e => e.nombre === 'Bob')).toBe(true);
  });
  it('Diana está en elegibles', () => {
    expect(elegibles.some(e => e.nombre === 'Diana')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITERIOS FASE 5: Prioridad de estrellas
// ═══════════════════════════════════════════════════════════════════════════

describe('PRIORIDAD DE ESTRELLAS — 3★ excluye a 0★', () => {
  it('Diana (0★) nunca gana cuando Ana (3★) está en el pool', () => {
    const pool = [P.ana, P.diana];
    const conteo = contarGanadores(pool, clientes, []);
    expect(conteo['Diana'] ?? 0).toBe(0);
    expect(conteo['Ana']).toBeGreaterThan(0);
  });
});

describe('PRIORIDAD DE ESTRELLAS — 2★ excluye a 0★', () => {
  it('Diana (0★) nunca gana cuando Bob (2★) está en el pool', () => {
    const pool = [P.bob, P.diana];
    const conteo = contarGanadores(pool, clientes, []);
    expect(conteo['Diana'] ?? 0).toBe(0);
    expect(conteo['Bob']).toBeGreaterThan(0);
  });
});

describe('PRIORIDAD DE ESTRELLAS — 1★ excluye a 0★', () => {
  it('Diana (0★) nunca gana cuando Carl (1★) está en el pool', () => {
    const pool = [P.carl, P.diana];
    const conteo = contarGanadores(pool, clientes, []);
    expect(conteo['Diana'] ?? 0).toBe(0);
    expect(conteo['Carl']).toBeGreaterThan(0);
  });
});

describe('PRIORIDAD ESTRICTA — 3★ excluye a 2★', () => {
  it('Bob (2★) nunca gana cuando Ana (3★) está en el pool', () => {
    const pool = [P.ana, P.bob];
    const conteo = contarGanadores(pool, clientes, [], 400);
    expect(conteo['Bob'] ?? 0).toBe(0);
    expect(conteo['Ana']).toBe(400);
  });
});

describe('PRIORIDAD ESTRICTA — 3★ excluye a 1★', () => {
  it('Carl (1★) nunca gana cuando Ana (3★) está en el pool', () => {
    const pool = [P.ana, P.carl];
    const conteo = contarGanadores(pool, clientes, [], 400);
    expect(conteo['Carl'] ?? 0).toBe(0);
    expect(conteo['Ana']).toBe(400);
  });
});

describe('PRIORIDAD ESTRICTA — 2★ excluye a 1★', () => {
  it('Carl (1★) nunca gana cuando Bob (2★) está en el pool', () => {
    const pool = [P.bob, P.carl];
    const conteo = contarGanadores(pool, clientes, [], 400);
    expect(conteo['Carl'] ?? 0).toBe(0);
    expect(conteo['Bob']).toBe(400);
  });
});

describe('PRIORIDAD ESTRICTA — varios 3★ se reparten uniformemente', () => {
  it('con dos 3★ y un 2★, los 3★ concentran 100% de las victorias', () => {
    const otraEstrella3 = { id: 10, nombre: 'Elena' };
    const clts = [
      ...clientes,
      { key: 'elena', nombre: 'Elena', estrellas: 3, fechaUltimoPremio: null },
    ];
    const pool = [P.ana, otraEstrella3, P.bob];
    const conteo = contarGanadores(pool, clts, [], 500);
    expect((conteo['Ana'] ?? 0) + (conteo['Elena'] ?? 0)).toBe(500);
    expect(conteo['Bob'] ?? 0).toBe(0);
    // Ambos 3★ deberían ganar al menos una vez con 500 sorteos
    expect(conteo['Ana']).toBeGreaterThan(0);
    expect(conteo['Elena']).toBeGreaterThan(0);
  });
});

describe('PRIORIDAD ESTRICTA — tercera ronda sin 3★ (escenario guía del usuario)', () => {
  it('agotados los 3★ por veto intradía, los 2★ ganan sobre los 1★', () => {
    const otraEstrella3 = { id: 10, nombre: 'Elena' };
    const clts = [
      ...clientes,
      { key: 'elena', nombre: 'Elena', estrellas: 3, fechaUltimoPremio: null },
    ];
    const pool = [P.ana, otraEstrella3, P.bob, P.carl];
    // Ana y Elena ya ganaron las dos primeras rondas
    const ganadoresDelDia = [{ nombre: 'Ana' }, { nombre: 'Elena' }];
    const conteo = contarGanadores(pool, clts, ganadoresDelDia, 300);
    // Solo Bob (2★) debería ganar; Carl (1★) queda excluido por prioridad estricta
    expect(conteo['Bob']).toBe(300);
    expect(conteo['Carl'] ?? 0).toBe(0);
  });
});

describe('PRIORIDAD DE ESTRELLAS — 0★ gana solo si son los únicos', () => {
  it('Diana y Edgar (ambos 0★) pueden ganar cuando no hay nadie con más estrellas', () => {
    const clts = [{ key: 'diana', estrellas: 0, fechaUltimoPremio: null }];
    const pool = [P.diana, P.edgar];
    const conteo = contarGanadores(pool, clts, []);
    expect(conteo['Diana']).toBeGreaterThan(0);
    expect(conteo['Edgar']).toBeGreaterThan(0);
  });

  it('participante no en base (0★) nunca gana mientras haya alguien con estrellas', () => {
    const visitante = { id: 99, nombre: 'Visitante' };
    const pool = [P.ana, visitante];
    const conteo = contarGanadores(pool, clientes, [], 300);
    expect(conteo['Visitante'] ?? 0).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITERIOS FASE 5: Vetos en el contexto de selección
// ═══════════════════════════════════════════════════════════════════════════

describe('VETO INTRADÍA en selección', () => {
  it('Ana vetada intradía no puede ganar el sorteo', () => {
    const pool = [P.ana, P.bob, P.carl];
    const ganadoresDelDia = [{ nombre: 'Ana' }];
    const conteo = contarGanadores(pool, clientes, ganadoresDelDia);
    expect(conteo['Ana'] ?? 0).toBe(0);
  });
});

describe('FECHA DE ÚLTIMO PREMIO ya no veta', () => {
  it('Ana ganó ayer y aun así puede ganar hoy (eventos son semanales, no diarios)', () => {
    const clts = [
      { key: 'ana', estrellas: 3, fechaUltimoPremio: ayer },
      { key: 'bob', estrellas: 2, fechaUltimoPremio: null },
    ];
    const pool = [P.ana, P.bob];
    const conteo = contarGanadores(pool, clts, [], 200);
    // Sin veto interdía, Ana (3★) gana siempre por prioridad estricta
    expect(conteo['Ana']).toBe(200);
    expect(conteo['Bob'] ?? 0).toBe(0);
  });
});

describe('CAMBIO DE RONDA — el ganador de la ronda anterior no está en el pool', () => {
  it('Ana ganó ronda 1 (intradía), en ronda 2 no aparece en el pool visible', () => {
    // Simula AdminPanel filtrando participantes visibles antes de mostrar
    const todos = [P.ana, P.bob, P.carl];
    const ganadoresDelDia = [{ nombre: 'Ana' }];

    const { vetadosIntradia } = clasificarParticipantes(todos, clientes, ganadoresDelDia);
    const poolRonda2 = todos.filter(p =>
      !vetadosIntradia.some(v => v.id === p.id)
    );

    expect(poolRonda2.some(p => p.nombre === 'Ana')).toBe(false);
    expect(poolRonda2).toHaveLength(2);
  });
});

describe('SESIÓN FINALIZADA — fallback cuando todos están vetados', () => {
  it('si solo hay un participante y ya ganó, sigue siendo posible seleccionar ganador', () => {
    const soloAna = [P.ana];
    const ganadoresDelDia = [{ nombre: 'Ana' }];
    const ganador = seleccionarGanador(soloAna, clientes, ganadoresDelDia);
    expect(ganador.nombre).toBe('Ana');
  });

  it('sin participantes lanza error descriptivo', () => {
    expect(() => seleccionarGanador([], clientes, [])).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITERIOS FASE 5: Identidad de cliente (renombrado sin pérdida)
// ═══════════════════════════════════════════════════════════════════════════

describe('IDENTIDAD DE CLIENTE — renombrado no rompe historial ni estrellas', () => {
  it('clienteId es diferente para cada cliente generado', () => {
    // Simula el comportamiento de generarClienteId
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });

  it('historial se recupera por clienteId aunque el key haya cambiado', () => {
    // Simula el lookup de sorteosDelCliente después de renombrar
    const clienteId = 'abc123';

    const sorteos = [
      { id: 1, ganadorNombre: 'Juan',   ganadorKey: 'juan',   ganadorClienteId: clienteId },
      { id: 2, ganadorNombre: 'Juan P.', ganadorKey: 'juan p.', ganadorClienteId: clienteId },
      { id: 3, ganadorNombre: 'Maria',  ganadorKey: 'maria',  ganadorClienteId: 'otro' },
    ];

    // El cliente fue renombrado: key ya es 'juan p.'
    const clienteActual = { key: 'juan p.', clienteId };
    const historial = sorteos.filter(s =>
      (clienteActual.clienteId && s.ganadorClienteId === clienteActual.clienteId)
      || s.ganadorKey === clienteActual.key
    );

    expect(historial).toHaveLength(2);
    expect(historial.map(s => s.id)).toEqual([1, 2]);
  });

  it('veto interdía se conserva tras renombrado (busca por clienteId en base)', () => {
    // La fechaUltimoPremio está en el objeto cliente, no en el key.
    // Si el cliente conserva clienteId, la fechaUltimoPremio sobrevive.
    const clienteAntes = {
      key: 'juan',
      clienteId: 'abc123',
      estrellas: 3,
      fechaUltimoPremio: ayer,
    };

    // Renombrado: key cambia, clienteId y fechaUltimoPremio se preservan
    const clienteDespues = {
      ...clienteAntes,
      key: 'juan p.',
      nombre: 'Juan P.',
    };

    expect(clienteDespues.clienteId).toBe('abc123');
    expect(clienteDespues.fechaUltimoPremio).toBe(ayer);
    expect(clienteDespues.estrellas).toBe(3);
  });

  it('estrellas se conservan tras renombrado', () => {
    const clts = [
      { key: 'juan p.', nombre: 'Juan P.', clienteId: 'abc123', estrellas: 3 },
    ];
    // El motor busca estrellas por nombre → normalizar('Juan P.') = 'juan p.'
    expect(obtenerEstrellas('Juan P.', clts)).toBe(3);
  });
});
