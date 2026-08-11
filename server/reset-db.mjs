import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'data', '100days.db')

if (fs.existsSync(dbPath)) {
  fs.rmSync(dbPath, { force: true })
  console.log(`Deleted: ${dbPath}`)
}

await import('./db.mjs')
console.log('Database reset. Empty tables and default study categories are ready.')
