import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { createAuthHandler } from './server/auth.mjs'
import { createDatabase } from './server/database.mjs'
import { createApiHandler } from './server/api.mjs'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv('mysql', process.cwd(), ''), ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string,string>
  function backend(){
    const db=createDatabase(env)
    const auth=createAuthHandler({sessionStore:db.sessionStore,verifyCredentials:db.verifyCredentials,username:env.AUTH_USERNAME,password:env.AUTH_PASSWORD,secure:env.AUTH_SECURE_COOKIE==='true'})
    return {db,auth,api:createApiHandler(db)}
  }
  const authPlugin:Plugin={
    name:'werewolf-backend',
    configureServer(server){const {db,auth,api}=backend();server.middlewares.use(auth);server.middlewares.use(api);server.httpServer?.once('close',()=>{void db.pool.end()})},
    configurePreviewServer(server){const {db,auth,api}=backend();server.middlewares.use(auth);server.middlewares.use(api);server.httpServer.once('close',()=>{void db.pool.end()})},
  }
  return { plugins: [vue(), authPlugin], server: { host: '0.0.0.0' } }
})
