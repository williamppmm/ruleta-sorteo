/**
 * Dominio: Clientes
 *
 * Reglas de negocio relacionadas con la base permanente de clientes:
 * importación, edición de nombre, y estado de veto visible.
 */

import { normalizar } from '../utils/normalizar.js';

// ── Importación desde .txt ─────────────────────────────────────────────────

/**
 * Parsea un archivo .txt de clientes con el formato:
 *   nombre, estrellas
 * o usando punto y coma como separador. Las líneas que empiezan con # se ignoran.
 *
 * @param {string} texto - Contenido del archivo .txt
 * @returns {{ clientes: Array<{nombre:string, estrellas:number}>, errores: string[] }}
 */
export function parsearTxt(texto) {
  const lineas = texto.split('\n');
  const resultado = [];
  const errores = [];

  lineas.forEach((linea, i) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) return;

    const partes = limpia.split(/[,;]/).map(p => p.trim());
    const nombre = partes[0];

    if (!nombre) {
      errores.push(`Línea ${i + 1}: nombre vacío`);
      return;
    }

    let estrellas = 0;
    if (partes[1] !== undefined) {
      const n = parseInt(partes[1]);
      if (isNaN(n)) {
        errores.push(`Línea ${i + 1}: "${partes[1]}" no es un número válido de estrellas — se usará 0`);
      } else {
        estrellas = Math.max(0, Math.min(3, n));
      }
    }

    resultado.push({ nombre, estrellas });
  });

  return { clientes: resultado, errores };
}

// ── Merge de importación ───────────────────────────────────────────────────

/**
 * Determina qué acción tomar para cada cliente de una importación.
 * Compara con la base actual y clasifica en: nuevo, actualizar, omitir.
 *
 * @param {Array<{nombre:string, estrellas:number}>} importados
 * @param {Object[]} clientesActuales - Base de clientes con { key, estrellas }
 * @returns {Array<{cliente, accion: 'nuevo'|'actualizar'|'omitir', clienteExistente?}>}
 */
export function planificarImportacion(importados, clientesActuales) {
  return importados.map(c => {
    const key = normalizar(c.nombre);
    const existente = clientesActuales.find(x => x.key === key);

    if (!existente) {
      return { cliente: c, accion: 'nuevo' };
    }
    if (existente.estrellas !== c.estrellas) {
      return { cliente: c, accion: 'actualizar', clienteExistente: existente };
    }
    return { cliente: c, accion: 'omitir' };
  });
}
