import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { createAuthHandler } from './server/auth.mjs'
import { createDatabase } from './server/database.mjs'
import { createApiHandler } from './server/api.mjs'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv('mysql', process.cwd(), ''), ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string,string>
  const db = createDatabase(env)
  const api = createApiHandler(db)
  const auth = createAuthHandler({
    sessionStore: db.sessionStore, verifyCredentials: db.verifyCredentials,
    username: env.AUTH_USERNAME,
    password: env.AUTH_PASSWORD,
    secure: process.env.AUTH_SECURE_COOKIE === 'true' || env.AUTH_SECURE_COOKIE === 'true',
  })
  const authPlugin: Plugin = {
    name: 'werewolf-auth',
    configureServer(server) { server.middlewares.use(auth); server.middlewares.use(api); server.httpServer?.once('close', () => { void db.pool.end() }) },
    configurePreviewServer(server) { server.middlewares.use(auth); server.middlewares.use(api); server.httpServer.once('close', () => { void db.pool.end() }) },
  }
  return { plugins: [vue(), authPlugin], server: { host: '0.0.0.0' } }
})
