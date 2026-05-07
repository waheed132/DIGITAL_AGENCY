/** Kill stale 5173, then start Vite (stable LAN URL with strictPort). */
import { execSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { getPrimaryLanIPv4 } from '../dev/lanIpv4.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendRoot = path.join(root, '..', 'backend')
const killCli = path.join(root, 'node_modules', 'kill-port', 'cli.js')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const backendBase = (process.env.VITE_BACKEND_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const backendHealthUrl = `${backendBase}/api/health`

async function isBackendUp() {
  try {
    const res = await fetch(backendHealthUrl, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

function pickPhpBin() {
  const candidates = [
    process.env.PHP_BIN,
    'C:\\xampp\\php\\php.exe',
    'C:\\xamppp\\php\\php.exe',
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p))
}

let backendChild = null

try {
  execSync(`${JSON.stringify(process.execPath)} ${JSON.stringify(killCli)} 5173`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
} catch {
  // Port already free or kill failed — continue to Vite
}

const ip = getPrimaryLanIPv4()
const port = 5173
console.log('')
console.log('\x1b[32m  Phone (same Wi‑Fi):\x1b[0m  http://' + (ip || '?') + ':' + port + '/')
console.log('  (If ? — run ipconfig; set VITE_DEV_HMR_HOST if needed)\n')

if (!(await isBackendUp())) {
  const phpBin = pickPhpBin()
  if (phpBin && fs.existsSync(path.join(backendRoot, 'artisan'))) {
    console.log('\x1b[33m  API not running on\x1b[0m ' + backendBase)
    console.log('\x1b[33m  Starting Laravel API automatically...\x1b[0m\n')
    backendChild = spawn(phpBin, ['artisan', 'serve', '--host=127.0.0.1', '--port=8000'], {
      cwd: backendRoot,
      stdio: 'inherit',
      windowsHide: true,
    })
  } else {
    console.log('\x1b[31m  API is offline:\x1b[0m ' + backendBase)
    console.log('  Start it manually, e.g.:')
    console.log('  C:\\xamppp\\php\\php.exe artisan serve --host=127.0.0.1 --port=8000\n')
  }
}

const child = spawn(process.execPath, [viteBin], { cwd: root, stdio: 'inherit' })
child.on('exit', (code, signal) => {
  if (backendChild && !backendChild.killed) {
    backendChild.kill()
  }
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
