import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createAuthHandler } from './auth.mjs'
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function setup(t, options = {}) {
  const auth = createAuthHandler({ username: 'test-admin', password: 'test-password-123', ...options })
  const server = createServer((req, res) => { void auth(req, res, () => { res.writeHead(404); res.end() }) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const login = (password = 'test-password-123', origin = base) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ username: 'test-admin', password }) })
  return { base, login }
}
test('password validation, cookie session and logout invalidation', async t => {
  const { base, login } = await setup(t)
  assert.equal((await login('wrong-password')).status, 401)
  const result = await login()
  assert.equal(result.status, 200)
  const setCookie = result.headers.get('set-cookie')
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Strict/)
  const cookie = setCookie.split(';')[0]
  const session = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } })
  assert.deepEqual((await session.json()).user, { username: 'test-admin' })
  assert.match(session.headers.get('cache-control'), /no-store/)
  const fake = await fetch(`${base}/api/auth/session`, { headers: { Cookie: 'werewolf_session=fake' } })
  assert.equal((await fake.json()).user, null)
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Origin: base, Cookie: cookie } })
  assert.equal(logout.status, 200)
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  const expired = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie } })
  assert.equal((await expired.json()).user, null)
})
test('rejects cross-origin login and malformed requests', async t => {
  const { base, login } = await setup(t)
  assert.equal((await login('test-password-123', 'https://other.example')).status, 403)
  const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: 'invalid-json' })
  assert.equal(malformed.status, 400)
})
test('rate limits repeated incorrect passwords', async t => {
  const { login } = await setup(t)
  for(let i=0;i<5;i++)assert.equal((await login('wrong')).status, 401)
  const blocked = await login()
  assert.equal(blocked.status, 429)
  assert.ok(Number(blocked.headers.get('retry-after')) > 0)
})
test('sets Secure cookie when configured for HTTPS', async t => {
  const { login } = await setup(t, { secure: true })
  assert.match((await login()).headers.get('set-cookie'), /; Secure/)
})

test('session survives server recreation, renews cookie and persists logout', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'werewolf-auth-'))
  const sessionFile = join(directory, 'sessions.json')
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const original = await setup(t, { sessionFile })
  const login = await original.login()
  const cookie = login.headers.get('set-cookie').split(';')[0]
  assert.ok(!readFileSync(sessionFile, 'utf8').includes(cookie.split('=')[1]))
  assert.equal(statSync(sessionFile).mode & 0o777, 0o600)
  const recreated = await setup(t, { sessionFile })
  const session = await fetch(`${recreated.base}/api/auth/session`, { headers: { Cookie: cookie } })
  assert.equal((await session.json()).user.username, 'test-admin')
  assert.match(session.headers.get('set-cookie'), /Max-Age=31536000/)
  await fetch(`${recreated.base}/api/auth/logout`, { method: 'POST', headers: { Origin: recreated.base, Cookie: cookie } })
  const afterLogout = await setup(t, { sessionFile })
  const revoked = await fetch(`${afterLogout.base}/api/auth/session`, { headers: { Cookie: cookie } })
  assert.equal((await revoked.json()).user, null)
})
