import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthHandler } from './auth.mjs'
import { createDatabase } from './database.mjs'
import { createApiHandler } from './api.mjs'
import './environment.mjs'

if (!process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD) {
  console.error('Set AUTH_USERNAME and AUTH_PASSWORD before starting the production server.')
  process.exit(1)
}
const root = fileURLToPath(new URL('../dist/', import.meta.url))
const db = createDatabase(process.env)
await db.ready()
const api = createApiHandler(db)
const auth = createAuthHandler({ sessionStore: db.sessionStore, verifyCredentials: db.verifyCredentials, username: process.env.AUTH_USERNAME, password: process.env.AUTH_PASSWORD, secure: process.env.AUTH_SECURE_COOKIE === 'true' })
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }
const server = createServer((req, res) => {
  void auth(req, res, () => api(req, res, () => serve(req, res))).catch(() => { if (!res.headersSent) res.writeHead(500); res.end() })
})
async function serve(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
  let pathname
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { res.writeHead(400); res.end(); return }
  const target = resolve(root, `.${pathname}`)
  if (target !== resolve(root) && !target.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return }
  try {
    let content, file = target
    try { content = await readFile(file) } catch {
      if (extname(pathname) || pathname.startsWith('/api/')) { res.writeHead(404); res.end(); return }
      file = resolve(root, 'index.html'); content = await readFile(file)
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' })
    res.end(req.method === 'HEAD' ? undefined : content)
  } catch { res.writeHead(503); res.end('Build the frontend before starting the server.') }
}
server.listen(Number(process.env.APP_PORT || 3000), process.env.APP_HOST || '127.0.0.1', () => { console.log(`Werewolf app: http://${process.env.APP_HOST || '127.0.0.1'}:${process.env.APP_PORT || 3000}`) })

for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>{void db.pool.end().then(()=>process.exit(0))});setTimeout(()=>process.exit(1),10000).unref()})
