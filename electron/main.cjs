const { app, BrowserWindow, Menu, Tray, shell, session } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const appRootDir = path.resolve(__dirname, '..')
const rootDir = app.isPackaged ? path.join(process.resourcesPath, 'app') : appRootDir
const iconPath = path.join(rootDir, 'assets', 'icon.ico')
const isWindows = process.platform === 'win32'
const devServerUrl = process.env.HARUFIT_DESKTOP_DEV_SERVER_URL || ''
const baseAppUrl = devServerUrl || 'http://localhost:4000'
const apiBaseUrl = 'http://localhost:4000/api'
const children = new Set()
let desktopTrackerProcess = null
let authTrackerTimer = null
let logDir = ''
let mainWindow = null
let tray = null
let isQuitting = false

function withDesktopFlag(url) {
  const parsed = new URL(url)
  parsed.searchParams.set('desktop', '1')
  return parsed.toString()
}

function logDesktop(message) {
  try {
    if (!logDir) logDir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(path.join(logDir, 'desktop.log'), `[${new Date().toISOString()}] ${message}\n`, 'utf8')
  } catch {
    // Logging must not interrupt the desktop app.
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex < 1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

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
  loadEnvFile(path.join(rootDir, '.env'))
  loadEnvFile(path.join(app.getPath('userData'), '.env'))

  const serverPath = path.join(rootDir, 'server', 'index.mjs')
  spawnChild(process.execPath, [serverPath], {
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      API_PORT: process.env.API_PORT || '4000',
      WEB_ORIGIN: devServerUrl || 'http://localhost:4000',
      API_ORIGIN: process.env.API_ORIGIN || 'http://localhost:4000',
    },
  })
}

async function sessionCookieHeader() {
  const cookies = await session.defaultSession.cookies.get({ url: 'http://localhost:4000', name: 'sid' })
  if (!cookies.length) return ''
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
}

async function sendDesktopUsage(appName, minutes) {
  const cookie = await sessionCookieHeader()
  if (!cookie) {
    logDesktop('skip desktop usage: no session cookie')
    return
  }
  const response = await fetch(`${apiBaseUrl}/track/desktop`, {
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
  }).catch(error => {
    logDesktop(`desktop usage request failed: ${error?.message || error}`)
    return null
  })
  if (response && !response.ok) {
    const text = await response.text().catch(() => '')
    logDesktop(`desktop usage rejected: ${response.status} ${text}`)
  }
}

function startDesktopTracker() {
  if (!isWindows || desktopTrackerProcess) return
  const intervalSeconds = 1
  const idleLimitSeconds = 180
  const scriptPath = path.join(rootDir, 'scripts', 'windows-active-app-watch.ps1')
  logDesktop(`start desktop tracker: ${scriptPath}`)
  desktopTrackerProcess = spawnChild('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-IntervalSeconds',
    String(intervalSeconds),
    '-IdleLimitSeconds',
    String(idleLimitSeconds),
  ], { stdio: ['ignore', 'pipe', 'ignore'] })

  let buffer = ''
  desktopTrackerProcess.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const active = JSON.parse(line)
        if (!active?.active || !active?.appName) continue
        sendDesktopUsage(String(active.appName).slice(0, 160), Number(active.intervalSeconds || intervalSeconds) / 60)
      } catch {
        // Tracking should never interrupt the desktop shell.
      }
    }
  })

  desktopTrackerProcess.on('exit', () => {
    logDesktop('desktop tracker exited')
    desktopTrackerProcess = null
  })
}

function stopDesktopTracker() {
  if (!desktopTrackerProcess || desktopTrackerProcess.killed) return
  desktopTrackerProcess.kill()
  desktopTrackerProcess = null
}

function startDesktopTrackerAfterLogin() {
  if (!isWindows || authTrackerTimer) return
  const check = async () => {
    const cookie = await sessionCookieHeader()
    if (cookie) startDesktopTracker()
    else stopDesktopTracker()
  }
  check()
  authTrackerTimer = setInterval(check, 2000)
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  mainWindow.show()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

function createTray() {
  if (tray || !isWindows) return
  tray = new Tray(iconPath)
  tray.setToolTip('하루핏 - 백그라운드 측정 중')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '하루핏 열기', click: showMainWindow },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
  tray.on('click', showMainWindow)
}

function enableAutoLaunch() {
  if (!isWindows || !app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    path: process.execPath,
  })
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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: '하루핏',
    icon: iconPath,
    backgroundColor: '#0d0d0d',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-navigate', () => {
    startDesktopTrackerAfterLogin()
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  loadWhenReady(mainWindow, withDesktopFlag(baseAppUrl))
}

app.whenReady().then(() => {
  enableAutoLaunch()
  startApiServer()
  startDesktopTrackerAfterLogin()
  createTray()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
})

app.on('before-quit', () => {
  isQuitting = true
  if (authTrackerTimer) clearInterval(authTrackerTimer)
  if (desktopTrackerProcess && !desktopTrackerProcess.killed) desktopTrackerProcess.kill()
  for (const child of children) {
    if (!child.killed) child.kill()
  }
})
