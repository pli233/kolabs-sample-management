// Electron main process: spawn the Python backend as a sidecar, then load the
// app from it. Electron handles downloads natively (unlike the old webview).
const { app, BrowserWindow, session, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')
const http = require('http')

let backend = null
let backendPort = 0

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

// Dev: run uvicorn from the repo venv. Packaged: run the bundled backend binary.
function spawnBackend(port) {
  const env = { ...process.env, PORT: String(port) }
  if (app.isPackaged) {
    const exe = path.join(process.resourcesPath, 'backend', 'kolabs-backend')
    return spawn(exe, [], { env })
  }
  const repo = path.join(__dirname, '..')
  const py = path.join(repo, 'backend', '.venv', 'bin', 'python')
  return spawn(py, ['server.py'], { cwd: path.join(repo, 'backend'), env })
}

function waitForHealth(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
          res.resume()
          if (res.statusCode === 200) resolve()
          else retry()
        })
        .on('error', retry)
    }
    const retry = () => {
      if (Date.now() > deadline) reject(new Error('backend did not start'))
      else setTimeout(tick, 200)
    }
    tick()
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    backgroundColor: '#0b1220',
    title: 'Kolabs Sample Management',
    webPreferences: { contextIsolation: true },
  })
  win.loadURL(`http://127.0.0.1:${backendPort}`)
  // Open external links (if any) in the system browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${backendPort}`)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

// Save exports straight to the user's Downloads folder.
function setupDownloads() {
  session.defaultSession.on('will-download', (_e, item) => {
    const dest = path.join(app.getPath('downloads'), item.getFilename())
    item.setSavePath(dest)
    item.once('done', (_evt, state) => {
      if (state === 'completed') shell.showItemInFolder(dest)
    })
  })
}

app.whenReady().then(async () => {
  try {
    backendPort = await freePort()
    console.log(`[kolabs] backend port ${backendPort}`)
    backend = spawnBackend(backendPort)
    backend.stdout?.on('data', (d) => process.stdout.write(`[backend] ${d}`))
    backend.stderr?.on('data', (d) => process.stdout.write(`[backend] ${d}`))
    backend.on('exit', (code) => {
      if (code && code !== 0 && !app.isQuitting) {
        dialog.showErrorBox('Backend stopped', `The backend exited (code ${code}).`)
      }
    })
    setupDownloads()
    await waitForHealth(backendPort)
    console.log('[kolabs] backend healthy; opening window')
    createWindow()
  } catch (err) {
    dialog.showErrorBox('Startup failed', String(err))
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function stopBackend() {
  if (backend) {
    backend.kill()
    backend = null
  }
}

app.on('before-quit', () => {
  app.isQuitting = true
  stopBackend()
})
app.on('window-all-closed', () => app.quit())
