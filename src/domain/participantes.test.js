import { describe, it, expect } from 'vitest';
import {
  MIN_PARTICIPANTES_POR_RONDA,
  validarDuplicado,
  participantesFaltantes,
  cumpleMinimoParticipantes,
} from './participantes.js';

const participantes = [
  { id: 1, nombre: 'Ana',    horaRegistro: new Date().toISOString() },
  { id: 2, nombre: 'Bob',    horaRegistro: new Date().toISOString() },
  { id: 3, nombre: 'carlos', horaRegistro: new Date().toISOString() },
];

describe('MIN_PARTICIPANTES_POR_RONDA', () => {
  it('es 10', () => expect(MIN_PARTICIPANTES_POR_RONDA).toBe(10));
});

describe('validarDuplicado', () => {
  it('detecta duplicado exacto', () => {
    expect(validarDuplicado('Ana', participantes)).toBe(true);
  });
  it('detecta duplicado case-insensitive', () => {
    expect(validarDuplicado('ana', participantes)).toBe(true);
    expect(validarDuplicado('ANA', participantes)).toBe(true);
  });
  it('detecta duplicado ignorando espacios extra', () => {
    expect(validarDuplicado('  Ana  ', participantes)).toBe(true);
  });
  it('nombre nuevo no es duplicado', () => {
    expect(validarDuplicado('Diana', participantes)).toBe(false);
  });
  it('excluye el propio ID en edición', () => {
    expect(validarDuplicado('Ana', participantes, 1)).toBe(false);
  });
  it('sigue detectando duplicado si el ID excluido es diferente', () => {
    expect(validarDuplicado('Ana', participantes, 99)).toBe(true);
  });
});

describe('participantesFaltantes', () => {
  it('devuelve 0 cuando se cumple el mínimo', () => {
    expect(participantesFaltantes(10)).toBe(0);
    expect(participantesFaltantes(15)).toBe(0);
  });
  it('devuelve la diferencia cuando faltan participantes', () => {
    expect(participantesFaltantes(7)).toBe(3);
    expect(participantesFaltantes(0)).toBe(10);
  });
});

describe('cumpleMinimoParticipantes', () => {
  it('primera ronda con 10+ participantes → cumple', () => {
    expect(cumpleMinimoParticipantes(10, true)).toBe(true);
    expect(cumpleMinimoParticipantes(15, true)).toBe(true);
  });
  it('primera ronda con menos de 10 → no cumple', () => {
    expect(cumpleMinimoParticipantes(9, true)).toBe(false);
    expect(cumpleMinimoParticipantes(0, true)).toBe(false);
  });
  it('ronda posterior ignora el mínimo (ya se validó antes)', () => {
    expect(cumpleMinimoParticipantes(1, false)).toBe(true);
    expect(cumpleMinimoParticipantes(0, false)).toBe(true);
  });
});
