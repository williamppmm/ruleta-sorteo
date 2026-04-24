/**
 * Puente hacia las APIs de Electron desde el renderer.
 *
 * Cuando la app corre como escritorio (Electron), usa window.electronAPI
 * que el preload expone vía contextBridge.
 *
 * Cuando corre como web (GitHub Pages, etc.), todos los métodos
 * devuelven null/false sin lanzar errores.
 */

export const isElectron =
  typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'

export const desktopApi = {
  isAvailable: isElectron,

  // ── Archivos de datos ────────────────────────────────────────────────────
  readFile:    (filename)       => isElectron
    ? window.electronAPI.readFile(filename)
    : Promise.resolve(null),

  writeFile:   (filename, data) => isElectron
    ? window.electronAPI.writeFile(filename, data)
    : Promise.resolve(false),

  getDataPath: ()               => isElectron
    ? window.electronAPI.getDataPath()
    : Promise.resolve(null),

  // ── Gestión de carpeta de datos ──────────────────────────────────────────
  /** Abre el diálogo nativo para elegir carpeta. Retorna la ruta o null. */
  selectDataFolder: () => isElectron
    ? window.electronAPI.selectDataFolder()
    : Promise.resolve(null),

  /**
   * Cambia la carpeta de datos y migra los archivos existentes.
   * @param {string} newPath
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  changeDataPath: (newPath) => isElectron
    ? window.electronAPI.changeDataPath(newPath)
    : Promise.resolve({ ok: false, error: 'No disponible fuera de Electron' }),

  /** Abre la carpeta de datos en el explorador de archivos. */
  openDataFolder: () => isElectron
    ? window.electronAPI.openDataFolder()
    : Promise.resolve(false),

  // ── Backup y restauración ────────────────────────────────────────────────
  /**
   * Exporta los datos actuales a un archivo JSON elegido por el usuario.
   * @returns {Promise<{ ok: boolean, filePath?: string, canceled?: boolean, error?: string }>}
   */
  exportBackup: () => isElectron
    ? window.electronAPI.exportBackup()
    : Promise.resolve({ ok: false, error: 'No disponible fuera de Electron' }),

  /**
   * Abre un archivo JSON de backup y retorna su contenido validado.
   * @returns {Promise<{ ok: boolean, datos?: object, canceled?: boolean, error?: string }>}
   */
  importBackup: () => isElectron
    ? window.electronAPI.importBackup()
    : Promise.resolve({ ok: false, error: 'No disponible fuera de Electron' }),
}
