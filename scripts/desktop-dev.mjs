import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'

const web = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', ['run', 'dev:web'], {
  stdio: 'inherit',
  shell: false,
})

const electron = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', ['exec', 'electron', '.'], {
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    HARUFIT_DESKTOP_DEV_SERVER_URL: 'http://localhost:5173',
  },
})

const children = [web, electron]
let stopping = false

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(exitCode)
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

for (const child of children) {
  child.on('error', error => {
    console.error(error)
    stop(1)
  })

  child.on('exit', code => {
    if (!stopping && code && code !== 0) stop(code)
  })
}
