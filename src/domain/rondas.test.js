import { describe, it, expect } from 'vitest';
import { normalizarPremios, puedeIrAlSorteo } from './rondas.js';

describe('normalizarPremios', () => {
  it('rellena con cadenas vacías si faltan entradas', () => {
    expect(normalizarPremios(['5000'], 3)).toEqual(['5000', '', '']);
  });
  it('recorta el exceso si hay más premios que rondas', () => {
    expect(normalizarPremios(['5000', '3000', '1000'], 2)).toEqual(['5000', '3000']);
  });
  it('no modifica si ya tiene el tamaño exacto', () => {
    expect(normalizarPremios(['5000', '3000'], 2)).toEqual(['5000', '3000']);
  });
  it('array vacío con 3 rondas → tres cadenas vacías', () => {
    expect(normalizarPremios([], 3)).toEqual(['', '', '']);
  });
  it('no muta el array original', () => {
    const original = ['5000'];
    normalizarPremios(original, 3);
    expect(original).toEqual(['5000']);
  });
});

describe('puedeIrAlSorteo', () => {
  const cfgBase = {
    registroCerrado: true,
    idsRondasDelDia: [],
  };

  it('registro cerrado + no terminado + primera ronda con mínimo → puede ir', () => {
    expect(puedeIrAlSorteo(cfgBase, false, 10, 10)).toBe(true);
  });

  it('registro abierto → no puede ir', () => {
    const cfg = { ...cfgBase, registroCerrado: false };
    expect(puedeIrAlSorteo(cfg, false, 10, 10)).toBe(false);
  });

  it('sorteo terminado → no puede ir', () => {
    expect(puedeIrAlSorteo(cfgBase, true, 10, 10)).toBe(false);
  });

  it('primera ronda con menos del mínimo → no puede ir', () => {
    expect(puedeIrAlSorteo(cfgBase, false, 9, 10)).toBe(false);
  });

  it('segunda ronda (ya hay una completada) ignora el mínimo', () => {
    const cfg = { ...cfgBase, idsRondasDelDia: [1] };
    expect(puedeIrAlSorteo(cfg, false, 1, 10)).toBe(true);
  });

  it('primera ronda con más del mínimo → puede ir', () => {
    expect(puedeIrAlSorteo(cfgBase, false, 20, 10)).toBe(true);
  });
});
