/**
 * Tests del Motor de Probabilidades y Vetos (v2)
 * Ejecutar con: node src/engine/probabilidades.test.js
 */

import { secureIndex, obtenerEstrellas, seleccionarGanador } from './probabilidades.js';
import { estaVetadoIntradia, estaVetadoInterdia, clasificarParticipantes } from './vetos.js';
import { normalizar } from '../utils/normalizar.js';

// ─────────────────────────────────────────────
// Utilidades de test
// ─────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, mensaje) {
  if (condition) {
    console.log(`  ✓ ${mensaje}`);
    passed++;
  } else {
    console.error(`  ✗ FALLO: ${mensaje}`);
    failed++;
  }
}

function grupo(nombre, fn) {
  console.log(`\n${nombre}`);
  fn();
}

// ─────────────────────────────────────────────
// Datos de prueba
// ─────────────────────────────────────────────
const hoy = new Date().toDateString();
const ayer = new Date(Date.now() - 86400000).toISOString();
const hace2Dias = new Date(Date.now() - 2 * 86400000).toISOString();
const hace3Dias = new Date(Date.now() - 3 * 86400000).toISOString();

// Participantes (solo nombre + id, sin estrellas — las estrellas vienen de clientes)
const P = {
  ana:   { id: 1, nombre: 'Ana' },
  bob:   { id: 2, nombre: 'Bob' },
  carl:  { id: 3, nombre: 'Carl' },
  diana: { id: 4, nombre: 'Diana' },
  edgar: { id: 5, nombre: 'Edgar' },
};

// Base de clientes (con key normalizado y estrellas)
const clientes = [
  { key: 'ana',   nombre: 'Ana',   estrellas: 3, fechaUltimoPremio: null },
  { key: 'bob',   nombre: 'Bob',   estrellas: 2, fechaUltimoPremio: null },
  { key: 'carl',  nombre: 'Carl',  estrellas: 1, fechaUltimoPremio: null },
  { key: 'diana', nombre: 'Diana', estrellas: 0, fechaUltimoPremio: null },
  // Edgar no está en clientes → default 0★
];

// ─────────────────────────────────────────────
// normalizar
// ─────────────────────────────────────────────
grupo('NORMALIZAR', () => {
  assert(normalizar('  Ana  ') === 'ana', 'Recorta espacios y pasa a lowercase');
  assert(normalizar('Juan  Carlos') === 'juan carlos', 'Espacios internos múltiples → uno solo');
  assert(normalizar('') === '', 'Cadena vacía → cadena vacía');
  assert(normalizar(null) === '', 'null → cadena vacía');
});

// ─────────────────────────────────────────────
// obtenerEstrellas
// ─────────────────────────────────────────────
grupo('OBTENER ESTRELLAS', () => {
  assert(obtenerEstrellas('Ana', clientes) === 3, 'Ana tiene 3★');
  assert(obtenerEstrellas('Bob', clientes) === 2, 'Bob tiene 2★');
  assert(obtenerEstrellas('carl', clientes) === 1, 'Carl (lowercase) tiene 1★');
  assert(obtenerEstrellas('Diana', clientes) === 0, 'Diana tiene 0★');
  assert(obtenerEstrellas('Edgar', clientes) === 0, 'Edgar (no en base) → 0★ por defecto');
  assert(obtenerEstrellas('Nadie', clientes) === 0, 'Desconocido → 0★ (no 1★ como en prototipo)');
});

// ─────────────────────────────────────────────
// secureIndex
// ─────────────────────────────────────────────
grupo('SECURE INDEX', () => {
  // Ejecutar muchas veces y verificar que siempre está en rango
  let todosEnRango = true;
  for (let i = 0; i < 1000; i++) {
    const idx = secureIndex(5);
    if (idx < 0 || idx >= 5) { todosEnRango = false; break; }
  }
  assert(todosEnRango, '1000 llamadas a secureIndex(5) → siempre en [0, 5)');
  assert(secureIndex(1) === 0, 'secureIndex(1) siempre devuelve 0');
});

// ─────────────────────────────────────────────
// Veto intradía
// ─────────────────────────────────────────────
grupo('VETO INTRADÍA', () => {
  const ganadoresDelDia = [{ nombre: 'Ana' }];
  assert(estaVetadoIntradia(P.ana, ganadoresDelDia), 'Ana vetada (ganó hoy)');
  assert(!estaVetadoIntradia(P.bob, ganadoresDelDia), 'Bob no vetado');
  assert(estaVetadoIntradia({ nombre: '  ANA  ' }, ganadoresDelDia), 'Comparación insensible a mayúsculas/espacios');
});

// ─────────────────────────────────────────────
// Veto interdía
// ─────────────────────────────────────────────
grupo('VETO INTERDÍA', () => {
  const clientesConFechas = [
    { key: 'ana',  estrellas: 3, fechaUltimoPremio: ayer },
    { key: 'bob',  estrellas: 2, fechaUltimoPremio: hace2Dias },
    { key: 'carl', estrellas: 1, fechaUltimoPremio: hace3Dias },
    { key: 'diana', estrellas: 0, fechaUltimoPremio: null },
  ];

  assert(estaVetadoInterdia(P.ana, clientesConFechas), 'Ana vetada (ganó ayer = 1 día)');
  assert(estaVetadoInterdia(P.bob, clientesConFechas), 'Bob vetado (ganó hace 2 días)');
  assert(!estaVetadoInterdia(P.carl, clientesConFechas), 'Carl libre (ganó hace 3 días)');
  assert(!estaVetadoInterdia(P.diana, clientesConFechas), 'Diana libre (sin fechaUltimoPremio)');
  assert(!estaVetadoInterdia(P.edgar, clientesConFechas), 'Edgar libre (no está en base)');
});

// ─────────────────────────────────────────────
// clasificarParticipantes
// ─────────────────────────────────────────────
grupo('CLASIFICAR PARTICIPANTES', () => {
  const clientesConFechas = [
    ...clientes.filter(c => c.key !== 'bob'),
    { key: 'bob', estrellas: 2, fechaUltimoPremio: ayer }, // Bob vetado interdía
  ];
  const ganadoresDelDia = [{ nombre: 'Carl' }]; // Carl vetado intradía

  const { elegibles, vetadosIntradia, vetadosInterdia } = clasificarParticipantes(
    [P.ana, P.bob, P.carl, P.diana],
    clientesConFechas,
    ganadoresDelDia
  );

  assert(vetadosIntradia.length === 1 && vetadosIntradia[0].nombre === 'Carl', 'Carl vetado intradía');
  assert(vetadosInterdia.length === 1 && vetadosInterdia[0].nombre === 'Bob', 'Bob vetado interdía');
  assert(elegibles.length === 2, 'Ana y Diana son elegibles');
  assert(elegibles.some(e => e.nombre === 'Ana'), 'Ana elegible');
  assert(elegibles.some(e => e.nombre === 'Diana'), 'Diana elegible');
});

// ─────────────────────────────────────────────
// seleccionarGanador — casos de la tabla BITÁCORA
// ─────────────────────────────────────────────
grupo('SELECCIONAR GANADOR — Solo 3★', () => {
  const pool = [P.ana, { id: 5, nombre: 'Eva' }];
  const clts = [
    { key: 'ana', estrellas: 3, fechaUltimoPremio: null },
    { key: 'eva', estrellas: 3, fechaUltimoPremio: null },
  ];
  // 100 sorteos — ambos deben aparecer como ganadores
  const conteo = { Ana: 0, Eva: 0 };
  for (let i = 0; i < 100; i++) {
    const g = seleccionarGanador(pool, clts, []);
    conteo[g.nombre]++;
  }
  assert(conteo.Ana > 0 && conteo.Eva > 0, 'Solo 3★: ambos pueden ganar (sorteo puro)');
});

grupo('SELECCIONAR GANADOR — 3★ + 0★', () => {
  const pool = [P.ana, P.diana]; // Ana=3★, Diana=0★
  // En 200 sorteos, Diana nunca debe ganar
  let dianaGanó = false;
  for (let i = 0; i < 200; i++) {
    const g = seleccionarGanador(pool, clientes, []);
    if (g.nombre === 'Diana') { dianaGanó = true; break; }
  }
  assert(!dianaGanó, '3★+0★: Diana (0★) nunca gana mientras haya alguien con más estrellas');
});

grupo('SELECCIONAR GANADOR — Solo 0★ (siempre hay ganador)', () => {
  const soloVisitantes = [P.diana, P.edgar];
  const clts = [{ key: 'diana', estrellas: 0, fechaUltimoPremio: null }];
  // Edgar no está en base → también 0★
  const conteo = { Diana: 0, Edgar: 0 };
  for (let i = 0; i < 100; i++) {
    const g = seleccionarGanador(soloVisitantes, clts, []);
    conteo[g.nombre]++;
  }
  assert(conteo.Diana > 0 && conteo.Edgar > 0, 'Solo 0★: ambos pueden ganar (igualdad)');
});

grupo('SELECCIONAR GANADOR — 2★ + 1★ sin 3★', () => {
  const pool = [P.bob, P.carl]; // Bob=2★, Carl=1★
  // Pesos: 2★=30, 1★=10 → total=40. Bob 75%, Carl 25%
  const conteo = { Bob: 0, Carl: 0 };
  for (let i = 0; i < 400; i++) {
    const g = seleccionarGanador(pool, clientes, []);
    conteo[g.nombre]++;
  }
  // Con 400 sorteos, Carl debería salir ~100 veces (25%). Verificar que es menor a Bob
  assert(conteo.Bob > conteo.Carl, '2★+1★: Bob (2★) gana más que Carl (1★)');
  // Verificar que ambos pueden ganar
  assert(conteo.Carl > 0, 'Carl (1★) también puede ganar');
});

grupo('SELECCIONAR GANADOR — Con veto intradía', () => {
  const pool = [P.ana, P.bob, P.carl];
  const ganadoresDelDia = [{ nombre: 'Ana' }]; // Ana vetada
  let anaGanó = false;
  for (let i = 0; i < 100; i++) {
    const g = seleccionarGanador(pool, clientes, ganadoresDelDia);
    if (g.nombre === 'Ana') { anaGanó = true; break; }
  }
  assert(!anaGanó, 'Ana vetada intradía no puede ganar');
});

grupo('SELECCIONAR GANADOR — Fallback: todos vetados', () => {
  const soloAna = [P.ana];
  const ganadoresDelDia = [{ nombre: 'Ana' }]; // Ana vetada
  const g = seleccionarGanador(soloAna, clientes, ganadoresDelDia);
  assert(g.nombre === 'Ana', 'Caso borde: Ana gana aunque esté vetada (es la única)');
});

grupo('SELECCIONAR GANADOR — Sin participantes lanza error', () => {
  let lanzóError = false;
  try { seleccionarGanador([], clientes, []); } catch { lanzóError = true; }
  assert(lanzóError, 'Lanza error si no hay participantes');
});

grupo('SELECCIONAR GANADOR — Participante nuevo (no en base) = 0★', () => {
  const nuevoVisitante = { id: 99, nombre: 'Visitante Nuevo' };
  const pool = [P.ana, nuevoVisitante]; // Ana=3★, Visitante=0★ (no en base)
  let visitanteGanó = false;
  for (let i = 0; i < 200; i++) {
    const g = seleccionarGanador(pool, clientes, []);
    if (g.nombre === 'Visitante Nuevo') { visitanteGanó = true; break; }
  }
  assert(!visitanteGanó, 'Nombre no en base → 0★ → no gana mientras haya alguien con más estrellas');
});

// ─────────────────────────────────────────────
// Resultado final
// ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed === 0) {
  console.log('✅ Todos los tests pasaron correctamente.\n');
} else {
  console.log('❌ Hay tests fallidos. Revisar la implementación.\n');
  process.exit(1);
}
