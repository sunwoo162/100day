import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'

const api = spawn(process.execPath, ['server/index.mjs'], {
  stdio: 'inherit',
})

const web = spawn(
  isWindows ? 'npm run dev:web' : 'npm',
  isWindows ? [] : ['run', 'dev:web'],
  {
    stdio: 'inherit',
    shell: isWindows,
  },
)

const children = [api, web]
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