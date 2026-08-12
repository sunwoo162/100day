import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')
const tempOutputDir = path.join(os.tmpdir(), 'harufit-desktop-release')
const finalOutputDir = path.join(rootDir, 'desktop-release')

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

fs.rmSync(tempOutputDir, { recursive: true, force: true })
fs.rmSync(finalOutputDir, { recursive: true, force: true })
fs.mkdirSync(finalOutputDir, { recursive: true })

run('pnpm', ['run', 'build'])
run('pnpm', ['exec', 'electron-builder', '--win', 'nsis', '--x64', `--config.directories.output=${tempOutputDir}`])

for (const entry of fs.readdirSync(tempOutputDir, { withFileTypes: true })) {
  if (entry.isDirectory()) continue
  const source = path.join(tempOutputDir, entry.name)
  const target = path.join(finalOutputDir, entry.name)
  fs.copyFileSync(source, target)
}

console.log(`하루핏 데스크톱 설치 파일 생성 완료: ${finalOutputDir}`)
