import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import mysql from 'mysql2/promise'
import { loadEnv } from 'vite'
import { createDatabase } from './database.mjs'
import { createApiHandler } from './api.mjs'
import { createAuthHandler } from './auth.mjs'
import { addCalendarMonth } from '../src/utils/memberDates.mjs'

test('MySQL API: persistence, authentication, concurrent deduction, cards, players and deletion', async () => {
  const env={...loadEnv('mysql',process.cwd(),''),...loadEnv('development',process.cwd(),''),...process.env}
  const database=`werewolf_test_${Date.now()}`
  assert.match(database,/^werewolf_test_\d+$/)
  const admin=await mysql.createConnection({host:env.DB_HOST,port:Number(env.DB_PORT),user:'root',password:env.DB_ROOT_PASSWORD})
  let db,server,cookie='',origin
  try {
    await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    db=createDatabase({...env,DB_NAME:database,DB_USER:'root',DB_PASSWORD:env.DB_ROOT_PASSWORD,DB_MIGRATE_SESSIONS:'false'})
    await db.ready()
    let api=createApiHandler(db)
    let auth=createAuthHandler({username:env.AUTH_USERNAME,password:env.AUTH_PASSWORD,sessionStore:db.sessionStore,verifyCredentials:db.verifyCredentials})
    server=createServer((req,res)=>{void auth(req,res,()=>api(req,res,()=>{res.writeHead(404);res.end()})).catch(error=>{res.writeHead(500);res.end(error.message)})})
    server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`
    const request=async(path,method='GET',body,expected=200,extra={})=>{
      const response=await fetch(origin+path,{method,headers:{cookie,origin,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)})
      const result=await response.json()
      assert.equal(response.status,expected,JSON.stringify(result))
      if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0]
      return result
    }
    await request('/api/data','GET',undefined,401)
    await request('/api/auth/login','POST',{username:env.AUTH_USERNAME,password:env.AUTH_PASSWORD})
    let {data}=await request('/api/data');assert.equal(data.members.length,0);assert.equal(data.games.length,0);assert.equal(data.records.length,0)
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const base={name:'接口次卡测试',type:'次卡',total:1,purchased:today+' 12:00',expiry:addCalendarMonth(today)}
    ;({data}=await request('/api/members','POST',base));const memberId=data.members[0].id
    await request('/api/members','POST',base,409)
    await request(`/api/members/${memberId}/balance`,'PATCH',{remaining:2},400)
    const responses=await Promise.all([fetch(origin+`/api/members/${memberId}/use`,{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:'{}'}),fetch(origin+`/api/members/${memberId}/use`,{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:'{}'})])
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,400])
    ;({data}=await request('/api/data'));assert.equal(data.members[0].remaining,0);assert.equal(data.records.filter(r=>r.action==='使用').length,1)
    await request(`/api/members/${memberId}/balance`,'PATCH',{remaining:1},403,{origin:'http://example.com'})
    ;({data}=await request(`/api/members/${memberId}/card`,'PATCH',{type:'月卡',total:0,remaining:0,expiry:'',monthMode:'add'}));assert.equal(data.members[0].expiry,addCalendarMonth(today))
    ;({data}=await request(`/api/members/${memberId}/card`,'PATCH',{type:'月卡',total:0,remaining:0,expiry:'',monthMode:'add'}));assert.equal(data.members[0].expiry,addCalendarMonth(addCalendarMonth(today)))
    await request(`/api/members/${memberId}/card`,'PATCH',{type:'月卡',total:0,remaining:0,expiry:'2090-02-30',monthMode:'custom'},400)
    ;({data}=await request(`/api/members/${memberId}/card`,'PATCH',{type:'普通会员',total:0,remaining:0,expiry:'',monthMode:'add'}));assert.equal(data.members[0].expiry,'')
    ;({data}=await request('/api/games','POST',{date:today,start:'22:00',end:'00:30',capacity:6}));const gameId=data.games[0].id
    const seat={memberId,role:'',arrival:'21:55',status:'准时',note:''}
    ;({data}=await request(`/api/games/${gameId}/seats`,'POST',seat));assert.equal(data.games[0].seats[0].role,'')
    await request(`/api/games/${gameId}/seats`,'POST',seat,400)
    await request(`/api/games/${gameId}/seats/1`,'PUT',{...seat,role:'自定义身份'})
    ;({data}=await request(`/api/games/${gameId}/seats/1`,'DELETE'));assert.equal(data.games[0].seats.length,0);assert.equal(data.members.length,1)
    await request(`/api/games/${gameId}/seats`,'POST',seat)
    await request('/api/settings','PATCH',{shop:'接口测试店铺'})
    // Replace the handler and pool to simulate a server restart with persisted sessions and business data.
    await db.pool.end()
    db=createDatabase({...env,DB_NAME:database,DB_USER:'root',DB_PASSWORD:env.DB_ROOT_PASSWORD,DB_MIGRATE_SESSIONS:'false'});await db.ready()
    auth=createAuthHandler({username:env.AUTH_USERNAME,password:env.AUTH_PASSWORD,sessionStore:db.sessionStore,verifyCredentials:db.verifyCredentials});api=createApiHandler(db)
    assert.equal((await request('/api/auth/session')).user.username,env.AUTH_USERNAME)
    ;({data}=await request('/api/data'));assert.equal(data.shop,'接口测试店铺');assert.equal(data.members.length,1);assert.equal(data.games[0].seats.length,1)
    ;({data}=await request(`/api/members/${memberId}`,'DELETE'));assert.equal(data.members.length,0);assert.equal(data.games[0].seats[0].memberId,null);assert.ok(data.records.length>0)
    await request(`/api/games/${gameId}/seats/1`,'PUT',{...seat,memberId:null})
    ;({data}=await request(`/api/games/${gameId}`,'DELETE'));assert.equal(data.games.length,0)
    const [[count]]=await db.pool.query('SELECT COUNT(*) AS n FROM seats');assert.equal(count.n,0)
    await request('/api/auth/logout','POST',{});await request('/api/data','GET',undefined,401)
    assert.equal(addCalendarMonth('2026-01-31'),'2026-02-28');assert.equal(addCalendarMonth('2028-01-31'),'2028-02-29')
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
    if(db)await db.pool.end()
    await admin.query(`DROP DATABASE IF EXISTS ${database}`)
    await admin.end()
  }
})
