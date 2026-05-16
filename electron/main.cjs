/**
 * Electron – Proceso principal
 *
 * Responsabilidades:
 *  - Crear la ventana principal
 *  - Exponer handlers IPC para leer/escribir archivos JSON
 *  - Gestionar la ruta de datos con soporte de cambio y migración
 *  - Persistir preferencias de la app (prefs.json) en userData
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs   = require('fs')

// Silencia la advertencia "Insecure Content-Security-Policy" en modo desarrollo.
// Esa advertencia es informativa y solo aplica mientras Vite sirve con HMR
// (que necesita 'unsafe-eval'). En el build empaquetado no aparece.
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

// ── Preferencias de la app ─────────────────────────────────────────────────
// Se guardan en userData/prefs.json, separado de los datos del sorteo.

const PREFS_FILE = path.join(app.getPath('userData'), 'prefs.json')

function loadPrefs() {
  try {
    if (fs.existsSync(PREFS_FILE)) {
      return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'))
    }
  } catch (err) {
    console.error('[prefs] Error al leer prefs.json:', err.message)
  }
  return {}
}

function savePrefs(cambios) {
  try {
    const actual = loadPrefs()
    fs.writeFileSync(PREFS_FILE, JSON.stringify({ ...actual, ...cambios }, null, 2), 'utf8')
  } catch (err) {
    console.error('[prefs] Error al guardar prefs.json:', err.message)
  }
}

// ── Ruta de datos ──────────────────────────────────────────────────────────
// Valor inicial: userData/sorteo-data
// Se sobreescribe si el usuario eligió una carpeta diferente (guardada en prefs).

const DEFAULT_DATA_PATH = path.join(app.getPath('userData'), 'sorteo-data')
let dataPath = DEFAULT_DATA_PATH

function initDataPath() {
  const prefs = loadPrefs()
  if (prefs.dataPath) {
    if (fs.existsSync(prefs.dataPath)) {
      dataPath = prefs.dataPath
    } else {
      // Carpeta guardada ya no existe — volver al default y limpiar la pref
      console.warn('[data] Carpeta guardada no encontrada, usando default:', prefs.dataPath)
      savePrefs({ dataPath: null })
    }
  }
}

function ensureDataDir(targetPath) {
  const p = targetPath ?? dataPath
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true })
  }
}

function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmpPath, filePath)
}

// ── Ventana principal ──────────────────────────────────────────────────────
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  mainWindow.setMenuBarVisibility(false)

  const isDev = !app.isPackaged
  if (isDev) {
    loadDevURL(mainWindow)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

/**
 * En modo desarrollo espera a que Vite levante el servidor.
 * Reintenta cada segundo hasta 30 veces.
 */
async function loadDevURL(win) {
  const DEV_URL = 'http://localhost:5173'
  for (let i = 0; i < 30; i++) {
    try {
      await win.loadURL(DEV_URL)
      // DevTools no se abre automaticamente. Quien lo necesite puede hacerlo
      // con Ctrl+Shift+I o F12.
      return
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  win.loadURL(
    `data:text/html,<h2>No se pudo conectar a ${DEV_URL}.<br>Asegúrate de que Vite esté corriendo.</h2>`
  )
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

const DATA_FILES = ['clientes.json', 'participantes.json', 'sorteos.json', 'config.json']

function registerIpcHandlers() {

  // ── Archivos de datos ────────────────────────────────────────────────────

  /** Devuelve la ruta de datos activa. */
  ipcMain.handle('get-data-path', () => dataPath)

  /** Lee un archivo JSON de la carpeta de datos. Retorna el objeto o null. */
  ipcMain.handle('read-file', (_e, filename) => {
    try {
      const filePath = path.join(dataPath, filename)
      if (!fs.existsSync(filePath)) return null
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (err) {
      console.error('[read-file]', filename, err.message)
      return null
    }
  })

  /** Escribe datos JSON en la carpeta de datos. Retorna true/false. */
  ipcMain.handle('write-file', (_e, filename, data) => {
    try {
      ensureDataDir()
      const filePath = path.join(dataPath, filename)
      writeJsonAtomic(filePath, data)
      return true
    } catch (err) {
      console.error('[write-file]', filename, err.message)
      return false
    }
  })

  // ── Gestión de carpeta de datos ──────────────────────────────────────────

  /**
   * Abre el diálogo nativo para elegir una carpeta.
   * Retorna la ruta elegida o null si el usuario canceló.
   */
  ipcMain.handle('select-data-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title:       'Seleccionar carpeta de datos',
      defaultPath: dataPath,
      properties:  ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  /**
   * Cambia la carpeta de datos activa:
   *   1. Valida que la nueva carpeta exista (o la crea) y tenga permisos de escritura.
   *   2. Copia los archivos JSON existentes a la nueva carpeta.
   *   3. Actualiza dataPath en memoria y guarda la preferencia.
   *
   * Retorna { ok: true } o { ok: false, error: string }.
   */
  ipcMain.handle('change-data-path', (_e, newPath) => {
    try {
      if (!newPath || typeof newPath !== 'string') {
        return { ok: false, error: 'Ruta inválida.' }
      }

      const resolved = path.resolve(newPath)

      // Crear si no existe
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true })
      }

      // Verificar permisos de escritura con un archivo temporal
      const testFile = path.join(resolved, '.write-test')
      fs.writeFileSync(testFile, 'ok', 'utf8')
      fs.unlinkSync(testFile)

      // Copiar archivos existentes a la nueva carpeta
      for (const file of DATA_FILES) {
        const src = path.join(dataPath, file)
        const dst = path.join(resolved, file)
        if (fs.existsSync(src) && src !== dst) {
          fs.copyFileSync(src, dst)
        }
      }

      // Actualizar ruta en memoria y persistir preferencia
      dataPath = resolved
      savePrefs({ dataPath: resolved })

      return { ok: true }
    } catch (err) {
      console.error('[change-data-path]', err.message)
      return { ok: false, error: err.message }
    }
  })

  /**
   * Abre la carpeta de datos activa en el explorador de archivos.
   * Retorna true si se abrió correctamente.
   */
  ipcMain.handle('open-data-folder', async () => {
    ensureDataDir()
    const err = await shell.openPath(dataPath)
    return !err
  })

  // ── Backup y restauración ────────────────────────────────────────────────

  /**
   * Exporta un backup completo (los 4 stores) a un archivo .json elegido por el usuario.
   * Retorna { ok: true } o { ok: false, error: string } o { ok: false, canceled: true }.
   */
  ipcMain.handle('export-backup', async () => {
    // Elegir destino
    const defaultName = `sorteo-backup-${new Date().toISOString().slice(0, 10)}.json`
    const result = await dialog.showSaveDialog(mainWindow, {
      title:       'Guardar backup',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters:     [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }

    try {
      // Leer los 4 archivos
      const leer = (name) => {
        const p = path.join(dataPath, name)
        if (!fs.existsSync(p)) return null
        return JSON.parse(fs.readFileSync(p, 'utf8'))
      }
      const backup = {
        version:       1,
        fecha:         new Date().toISOString(),
        clientes:      leer('clientes.json')      ?? [],
        participantes: leer('participantes.json') ?? [],
        sorteos:       leer('sorteos.json')       ?? [],
        config:        leer('config.json')        ?? {},
      }
      fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf8')
      return { ok: true, filePath: result.filePath }
    } catch (err) {
      console.error('[export-backup]', err.message)
      return { ok: false, error: err.message }
    }
  })

  /**
   * Abre un archivo .json de backup y retorna su contenido validado.
   * Retorna { ok: true, datos } o { ok: false, error } o { ok: false, canceled: true }.
   */
  ipcMain.handle('import-backup', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title:      'Abrir backup',
      filters:    [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

    try {
      const raw  = fs.readFileSync(result.filePaths[0], 'utf8')
      const datos = JSON.parse(raw)

      // Validación mínima de estructura
      if (!datos || typeof datos !== 'object') throw new Error('Archivo inválido.')
      if (datos.version !== 1)                 throw new Error('Versión de backup no reconocida.')
      if (!Array.isArray(datos.clientes))      throw new Error('Campo "clientes" inválido.')
      if (!Array.isArray(datos.sorteos))       throw new Error('Campo "sorteos" inválido.')
      if (!Array.isArray(datos.participantes)) throw new Error('Campo "participantes" inválido.')

      return { ok: true, datos }
    } catch (err) {
      console.error('[import-backup]', err.message)
      return { ok: false, error: err.message }
    }
  })
}

// ── Ciclo de vida ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  initDataPath()
  ensureDataDir()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
