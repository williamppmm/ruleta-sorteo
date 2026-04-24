/**
 * Electron – Preload script
 *
 * Expone un puente seguro entre el proceso renderer (React)
 * y el proceso principal (Node.js) mediante contextBridge.
 *
 * Disponible en el renderer como: window.electronAPI
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Archivos de datos ──────────────────────────────────────────────────
  /** Lee un archivo JSON de la carpeta de datos. Retorna el objeto o null. */
  readFile:    (filename)       => ipcRenderer.invoke('read-file',    filename),
  /** Escribe datos en un archivo JSON de la carpeta de datos. */
  writeFile:   (filename, data) => ipcRenderer.invoke('write-file',   filename, data),
  /** Devuelve la ruta absoluta de la carpeta de datos activa. */
  getDataPath: ()               => ipcRenderer.invoke('get-data-path'),

  // ── Gestión de carpeta de datos ────────────────────────────────────────
  /** Abre el diálogo nativo para elegir una carpeta. Retorna la ruta o null. */
  selectDataFolder: ()          => ipcRenderer.invoke('select-data-folder'),
  /**
   * Cambia la carpeta de datos, migrando los archivos existentes.
   * @param {string} newPath
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  changeDataPath:   (newPath)   => ipcRenderer.invoke('change-data-path', newPath),
  /** Abre la carpeta de datos activa en el explorador de archivos. */
  openDataFolder:   ()          => ipcRenderer.invoke('open-data-folder'),

  // ── Backup y restauración ──────────────────────────────────────────────
  /**
   * Exporta los datos actuales a un archivo JSON elegido por el usuario.
   * @returns {Promise<{ ok: boolean, filePath?: string, canceled?: boolean, error?: string }>}
   */
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  /**
   * Abre un archivo JSON de backup y retorna su contenido validado.
   * @returns {Promise<{ ok: boolean, datos?: object, canceled?: boolean, error?: string }>}
   */
  importBackup: () => ipcRenderer.invoke('import-backup'),
})
