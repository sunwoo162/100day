const { app, BrowserWindow, shell, session } = require('electron')
const { execFile, spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const appRootDir = path.resolve(__dirname, '..')
const rootDir = app.isPackaged ? path.join(process.resourcesPath, 'app') : appRootDir
const isWindows = process.platform === 'win32'
const devServerUrl = process.env.HARUFIT_DESKTOP_DEV_SERVER_URL || ''
const appUrl = devServerUrl || 'http://localhost:4000'
const apiBaseUrl = 'http://localhost:4000/api'
const children = new Set()
let desktopTrackerTimer = null

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: options.stdio || 'ignore',
    shell: options.shell || false,
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true,
  })
  children.add(child)
  child.on('exit', () => children.delete(child))
  return child
}

function startApiServer() {
  const serverPath = path.join(rootDir, 'server', 'index.mjs')
  spawnChild(process.execPath, [serverPath], {
    env: {
      API_PORT: process.env.API_PORT || '4000',
      WEB_ORIGIN: devServerUrl || 'http://localhost:4000',
      API_ORIGIN: process.env.API_ORIGIN || 'http://localhost:4000',
    },
  })
}

function startWindowsTrackerIfConfigured() {
  if (!isWindows) return
  const configPath = path.join(os.homedir(), '.harufit-tracker.json')
  const trackerPath = path.join(rootDir, 'scripts', 'windows-pc-tracker.ps1')
  if (!fs.existsSync(configPath) || !fs.existsSync(trackerPath)) return
  spawnChild('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    trackerPath,
    '-ConfigPath',
    configPath,
    '-ApiBase',
    'http://localhost:4000/api',
  ])
}

function readActiveWindowsApp() {
  const scriptPath = path.join(rootDir, 'scripts', 'windows-active-app.ps1')
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      cwd: rootDir,
      windowsHide: true,
      timeout: 10000,
    }, (error, stdout) => {
      if (error) return reject(error)
      try {
        resolve(JSON.parse(String(stdout || '{}')))
      } catch (parseError) {
        reject(parseError)
      }
    })
  })
}

async function sessionCookieHeader() {
  const cookies = await session.defaultSession.cookies.get({ url: 'http://localhost:4000', name: 'sid' })
  if (!cookies.length) return ''
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
}

async function sendDesktopUsage(appName, minutes) {
  const cookie = await sessionCookieHeader()
  if (!cookie) return
  await fetch(`${apiBaseUrl}/track/desktop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      app_name: appName,
      minutes,
      occurred_at: new Date().toISOString(),
    }),
  }).catch(() => {})
}

function startDesktopTracker() {
  if (!isWindows || desktopTrackerTimer) return
  const intervalSeconds = 15
  const idleLimitSeconds = 180
  desktopTrackerTimer = setInterval(async () => {
    try {
      const active = await readActiveWindowsApp()
      if (!active?.appName || Number(active.idleSeconds || 0) >= idleLimitSeconds) return
      await sendDesktopUsage(String(active.appName).slice(0, 160), intervalSeconds / 60)
    } catch {
      // Tracking should never interrupt the desktop shell.
    }
  }, intervalSeconds * 1000)
}

async function loadWhenReady(win, url, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await win.loadURL(url)
      return
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  await win.loadURL(url)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: '하루핏',
    backgroundColor: '#0d0d0d',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  loadWhenReady(win, appUrl)
}

app.whenReady().then(() => {
  startApiServer()
  startWindowsTrackerIfConfigured()
  startDesktopTracker()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (desktopTrackerTimer) clearInterval(desktopTrackerTimer)
  for (const child of children) {
    if (!child.killed) child.kill()
  }
})
