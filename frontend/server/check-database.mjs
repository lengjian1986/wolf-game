import { loadEnv } from 'vite'
import { createDatabase, readData } from './database.mjs'
const env={...loadEnv('mysql',process.cwd(),''),...loadEnv('development',process.cwd(),''),...process.env}
const db=createDatabase(env)
try { await db.ready(); const data=await readData(db.pool); console.log(JSON.stringify({connected:true,members:data.members.length,games:data.games.length,records:data.records.length,shop:data.shop})); }
finally { await db.pool.end() }
