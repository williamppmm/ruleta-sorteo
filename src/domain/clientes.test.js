import { describe, it, expect } from 'vitest';
import { parsearTxt, planificarImportacion } from './clientes.js';

// ═══════════════════════════════════════════════════════════════════════════
describe('parsearTxt', () => {
  it('parsea nombre y estrellas separados por coma', () => {
    const { clientes } = parsearTxt('Juan, 3');
    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toEqual({ nombre: 'Juan', estrellas: 3 });
  });

  it('parsea nombre y estrellas separados por punto y coma', () => {
    const { clientes } = parsearTxt('Maria; 2');
    expect(clientes[0]).toEqual({ nombre: 'Maria', estrellas: 2 });
  });

  it('usa 0 estrellas si no se especifican', () => {
    const { clientes } = parsearTxt('Visitante');
    expect(clientes[0].estrellas).toBe(0);
  });

  it('clampea estrellas al rango [0, 3]', () => {
    const { clientes } = parsearTxt('A, 5\nB, -1');
    expect(clientes[0].estrellas).toBe(3);
    expect(clientes[1].estrellas).toBe(0);
  });

  it('ignora líneas vacías', () => {
    const { clientes } = parsearTxt('\nJuan, 2\n\n');
    expect(clientes).toHaveLength(1);
  });

  it('ignora comentarios (#)', () => {
    const { clientes } = parsearTxt('# esto es un comentario\nJuan, 2');
    expect(clientes).toHaveLength(1);
    expect(clientes[0].nombre).toBe('Juan');
  });

  it('parsea múltiples clientes correctamente', () => {
    const txt = 'Ana, 3\nBob, 2\nCarlos, 1\nVisitante';
    const { clientes, errores } = parsearTxt(txt);
    expect(clientes).toHaveLength(4);
    expect(errores).toHaveLength(0);
  });

  it('reporta error cuando las estrellas no son un número', () => {
    const { clientes, errores } = parsearTxt('Juan, abc');
    expect(clientes[0].estrellas).toBe(0);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain('no es un número válido');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('planificarImportacion', () => {
  const clientesActuales = [
    { key: 'ana',  nombre: 'Ana',  estrellas: 3 },
    { key: 'bob',  nombre: 'Bob',  estrellas: 2 },
  ];

  it('cliente nuevo → accion: nuevo', () => {
    const plan = planificarImportacion([{ nombre: 'Carlos', estrellas: 1 }], clientesActuales);
    expect(plan[0].accion).toBe('nuevo');
  });

  it('cliente existente con mismas estrellas → accion: omitir', () => {
    const plan = planificarImportacion([{ nombre: 'Ana', estrellas: 3 }], clientesActuales);
    expect(plan[0].accion).toBe('omitir');
  });

  it('cliente existente con estrellas distintas → accion: actualizar', () => {
    const plan = planificarImportacion([{ nombre: 'Bob', estrellas: 3 }], clientesActuales);
    expect(plan[0].accion).toBe('actualizar');
    expect(plan[0].clienteExistente.key).toBe('bob');
  });

  it('comparación de key es case-insensitive', () => {
    const plan = planificarImportacion([{ nombre: 'ANA', estrellas: 3 }], clientesActuales);
    expect(plan[0].accion).toBe('omitir');
  });

  it('procesa lista mixta correctamente', () => {
    const importados = [
      { nombre: 'Ana',    estrellas: 3 }, // omitir
      { nombre: 'Bob',    estrellas: 1 }, // actualizar
      { nombre: 'Diana',  estrellas: 0 }, // nuevo
    ];
    const plan = planificarImportacion(importados, clientesActuales);
    expect(plan[0].accion).toBe('omitir');
    expect(plan[1].accion).toBe('actualizar');
    expect(plan[2].accion).toBe('nuevo');
  });

  it('lista vacía de importados → plan vacío', () => {
    expect(planificarImportacion([], clientesActuales)).toEqual([]);
  });
});
