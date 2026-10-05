import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync } from 'node:fs'

const SESSION_COOKIE = 'werewolf_session'
const COOKIE_AGE = 365 * 24 * 60 * 60
const WINDOW = 15 * 60 * 1000

export function createAuthHandler({ username, password, secure = false, sessionFile, sessionStore, verifyCredentials }) {
  if (!username || !password) throw new Error('Login account and password are required')
  const salt = randomBytes(16)
  const expectedHash = scryptSync(password, salt, 64)
  const sessions = new Map()
  const sessionKey = token => token ? createHash('sha256').update(token).digest('hex') : undefined
  if (sessionFile) {
    try {
      const saved = JSON.parse(readFileSync(sessionFile, 'utf8'))
      for (const [key, value] of Object.entries(saved)) {
        if (/^[a-f0-9]{64}$/.test(key) && value?.username === username) sessions.set(key, value)
      }
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('Unable to load saved login sessions', { cause: error }) }
  }
  function persist() {
    if (!sessionFile) return
    const temporary = `${sessionFile}.tmp`
    writeFileSync(temporary, JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 })
    renameSync(temporary, sessionFile)
  }
  const storage = sessionStore || {
    async get(key) { return sessions.get(key) },
    async set(key, value) { sessions.set(key, value); persist() },
    async delete(key) { sessions.delete(key); persist() },
  }
  const attempts = new Map()
  function reply(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  function cookie(token, age) {
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`
  }
  function getToken(req) {
    return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1)
  }
  return async function auth(req, res, next) {
    const path = (req.url || '').split('?')[0]
    if (!path.startsWith('/api/auth/')) {
      if (path.startsWith('/api/')) {
        try { req.authUser = await storage.get(sessionKey(getToken(req))) }
        catch { return reply(res, 503, { message: '数据库暂时不可用，请稍后重试。' }) }
      }
      return next()
    }
    const now = Date.now()
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
    if (req.method === 'POST') {
      let validOrigin = false
      try { validOrigin = new URL(req.headers.origin).host === req.headers.host } catch { /* Missing origins are not accepted for mutations. */ }
      if (!validOrigin) return reply(res, 403, { message: '请求来源无效，请刷新页面重试。' })
    }
    if (path === '/api/auth/session' && req.method === 'GET') {
      const token = getToken(req)
      let session
      try { session = await storage.get(sessionKey(token)) }
      catch { return reply(res, 503, { message: '数据库暂时不可用，请稍后重试。' }) }
      if (session) res.setHeader('Set-Cookie', cookie(token, COOKIE_AGE))
      return reply(res, 200, { user: session ? { username: session.username } : null })
    }
    if (path === '/api/auth/logout' && req.method === 'POST') {
      try { await storage.delete(sessionKey(getToken(req))) }
      catch { return reply(res, 503, { message: '退出失败，请稍后重试。' }) }
      res.setHeader('Set-Cookie', cookie('', 0))
      return reply(res, 200, { ok: true })
    }
    if (path !== '/api/auth/login' || req.method !== 'POST') return reply(res, 404, { message: '接口不存在。' })
    const ip = req.socket.remoteAddress || 'unknown'
    const failed = attempts.get(ip)
    if (failed && failed.count >= 5) {
      res.setHeader('Retry-After', String(Math.ceil((failed.until - now) / 1000)))
      return reply(res, 429, { message: '登录尝试过多，请 15 分钟后重试。' })
    }
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { message: '请求格式无效。' })
    let raw = ''
    try {
      for await (const chunk of req) {
        raw += chunk.toString()
        if (raw.length > 4096) return reply(res, 413, { message: '请求内容过长。' })
      }
      const input = JSON.parse(raw)
      if (typeof input.username !== 'string' || typeof input.password !== 'string' || input.username.length > 100 || input.password.length > 256) return reply(res, 400, { message: '请输入有效的账号和密码。' })
      const valid = verifyCredentials ? await verifyCredentials(input.username, input.password) : (timingSafeEqual(scryptSync(input.password, salt, 64), expectedHash) && input.username === username)
      if (!valid) {
        attempts.set(ip, { count: (failed?.count || 0) + 1, until: failed?.until || now + WINDOW })
        return reply(res, 401, { message: '账号或密码错误，请重新输入。' })
      }
      attempts.delete(ip)
      const token = randomBytes(32).toString('hex')
      await storage.delete(sessionKey(getToken(req)))
      await storage.set(sessionKey(token), { username: input.username })
      res.setHeader('Set-Cookie', cookie(token, COOKIE_AGE))
      return reply(res, 200, { user: { username: input.username } })
    } catch(error) {
      if(error instanceof SyntaxError || error instanceof TypeError) return reply(res,400,{message:'请求内容无效。'})
      return reply(res,503,{message:'登录服务暂时不可用，请稍后重试。'})
    }
  }
}
