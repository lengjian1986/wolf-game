import { readData } from './database.mjs'
import { addCalendarMonth, monthRenewalBase } from '../src/utils/memberDates.mjs'
const types = ['月卡', '次卡', '普通会员']
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
const text = (value, max, label, optional = false) => { if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > max) fail(`${label}格式无效。`); return value.trim() }
const integer = (value, min, max, label) => { if (!Number.isInteger(value) || value < min || value > max) fail(`${label}须为 ${min}～${max} 的整数。`); return value }
function date(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0,4)) < 1000) fail('日期格式无效。'); const d = new Date(`${value}T12:00:00Z`); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) fail('日期格式无效。'); return value }
function time(value) { if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('时间格式无效。'); return value }
function datetime(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) fail('购买时间格式无效。'); date(value.slice(0,10)); time(value.slice(11)); return value }
function now() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date()).replace(',', '') }
function card(input, minimum) {
  if (!types.includes(input.type)) fail('请选择有效的会员类型。')
  if (input.type === '普通会员') return { type:input.type, total:0, remaining:0, expiry:null }
  const expiry = date(input.expiry)
  if (expiry < minimum) fail('有效期不能早于开始日期。')
  if (input.type === '月卡') return { type:input.type,total:0,remaining:0,expiry }
  return { type:input.type,total:integer(input.total,1,1000,'总次数'),remaining:integer(input.remaining,0,input.total,'剩余次数'),expiry }
}
async function member(c, id) { const [rows] = await c.execute('SELECT *,COALESCE(CAST(expiry AS CHAR),\'\') AS expiry FROM members WHERE id=? FOR UPDATE', [id]); if (!rows[0]) fail('该会员已不存在，请刷新列表。',404); return rows[0] }
async function game(c, id) { const [rows] = await c.execute('SELECT * FROM games WHERE id=? FOR UPDATE', [id]); if (!rows[0]) fail('该场次已不存在，请刷新列表。',404); return rows[0] }
async function record(c, m, action, note, amount, timestamp = now()) { await c.execute('INSERT INTO records(member_id,member,time,action,note,amount) VALUES(?,?,?,?,?,?)', [m.id,m.name,timestamp,action,note,amount]) }
const describe = m => m.type==='次卡'?`次卡（剩余 ${m.remaining}/${m.total} 次）`:m.type==='月卡'?`月卡（${m.expiry} 到期）`:'普通会员'

export function createApiHandler(db) {
  return async (req,res,next) => {
    const pathname = (req.url || '').split('?')[0]
    if (!pathname.startsWith('/api/')) return next()
    const reply = (status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)) }
    if (!req.authUser) return reply(401,{message:'请先登录。'})
    const routes = [
      ['POST',/^\/api\/members$/,'addMember'],['PATCH',/^\/api\/members\/(\d+)\/card$/,'changeCard'],['POST',/^\/api\/members\/(\d+)\/use$/,'useMember'],['PATCH',/^\/api\/members\/(\d+)\/balance$/,'adjust'],['DELETE',/^\/api\/members\/(\d+)$/,'deleteMember'],
      ['POST',/^\/api\/games$/,'addGame'],['DELETE',/^\/api\/games\/(\d+)$/,'deleteGame'],['POST',/^\/api\/games\/(\d+)\/seats$/,'addSeat'],['PUT',/^\/api\/games\/(\d+)\/seats\/(\d+)$/,'editSeat'],['DELETE',/^\/api\/games\/(\d+)\/seats\/(\d+)$/,'deleteSeat'],['PATCH',/^\/api\/settings$/,'settings'],
    ]
    let connection
    try {
      const isRead = pathname==='/api/data' && req.method==='GET'
      const route = routes.find(([method, pattern]) => method===req.method && pattern.test(pathname))
      if (!isRead && !route) return reply(404,{message:'接口不存在。'})
      let input = {}, id, number, action
      if (route) {
        let validOrigin=false
        try { validOrigin=new URL(req.headers.origin).host===req.headers.host } catch {}
        if (!validOrigin) fail('请求来源无效，请刷新页面重试。',403)
        if (req.method !== 'DELETE') {
          if (!req.headers['content-type']?.startsWith('application/json')) fail('请求格式无效。',415)
          let raw=''
          for await (const chunk of req) { raw+=chunk.toString(); if(raw.length>16384) fail('请求内容过长。',413) }
          try { input=JSON.parse(raw) } catch { fail('请求内容无效。') }
          if (!input || typeof input!=='object' || Array.isArray(input)) fail('请求内容无效。')
        }
        const match = pathname.match(route[1]); id=Number(match[1]); number=Number(match[2]); action=route[2]
      }
      await db.ready()
      connection=await db.pool.getConnection()
      await connection.beginTransaction()
      if (action==='addMember') {
        const name=text(input.name,24,'昵称'), purchased=datetime(input.purchased)
        const value=card({...input,remaining:input.total},purchased.slice(0,10))
        const [result]=await connection.execute('INSERT INTO members(name,type,total,remaining,expiry,purchased) VALUES(?,?,?,?,?,?)',[name,value.type,value.total,value.remaining,value.expiry,purchased])
        if(value.type!=='普通会员') await record(connection,{id:result.insertId,name},'购买',value.type==='次卡'?`次卡（${value.total}次）`:`月卡（${value.expiry} 到期）`,value.type==='次卡'?value.total:1,purchased)
      } else if (action==='changeCard') {
        const m=await member(connection,id)
        if(input.monthMode!=='add'&&input.monthMode!=='custom') fail('月卡有效期选项无效。')
        const expiry=input.type==='月卡'&&input.monthMode==='add'?addCalendarMonth(monthRenewalBase(m,now().slice(0,10))):input.expiry
        const value=card({...input,expiry},now().slice(0,10))
        if(m.type===value.type&&m.total===value.total&&m.remaining===value.remaining&&(m.expiry||null)===value.expiry) fail('会员设置没有变化。')
        await connection.execute('UPDATE members SET type=?,total=?,remaining=?,expiry=?,purchased=? WHERE id=?',[value.type,value.total,value.remaining,value.expiry,m.type!==value.type&&value.type!=='普通会员'?now():m.purchased,id])
        await record(connection,m,'调整',`${describe(m)} → ${describe(value)}`,value.type==='次卡'?value.remaining-m.remaining:0)
      } else if (action==='useMember') {
        const m=await member(connection,id)
        if(m.type==='普通会员') fail('普通会员无需扣次。')
        if(m.expiry<now().slice(0,10)) fail('会员卡已到期。')
        if(m.type==='次卡') { if(m.remaining<=0) fail('剩余次数不足。'); await connection.execute('UPDATE members SET remaining=remaining-1 WHERE id=?',[id]) }
        await record(connection,m,'使用','店铺签到',1)
      } else if (action==='adjust') {
        const m=await member(connection,id)
        if(m.type!=='次卡') fail('只有次卡可以调整次数。')
        const remaining=integer(input.remaining,0,m.total,'剩余次数')
        await connection.execute('UPDATE members SET remaining=? WHERE id=?',[remaining,id])
        await record(connection,m,'调整',`剩余次数调整为 ${remaining}`,remaining-m.remaining)
      } else if (action==='deleteMember') {
        await member(connection,id)
        await connection.execute('DELETE FROM members WHERE id=?',[id])
      } else if (action==='addGame') {
        await connection.execute('INSERT INTO games(date,start,end,capacity) VALUES(?,?,?,?)',[date(input.date),time(input.start),time(input.end),integer(input.capacity,6,20,'游戏人数')])
      } else if (action==='deleteGame') {
        await game(connection,id)
        await connection.execute('DELETE FROM games WHERE id=?',[id])
      } else if (action==='addSeat'||action==='editSeat') {
        const g=await game(connection,id)
        const [seats]=await connection.execute('SELECT number,member_id AS memberId,name FROM seats WHERE game_id=? ORDER BY number',[id])
        const existing=seats.find(s=>s.number===number)
        if(action==='editSeat'&&!existing) fail('该座位已不存在。',404)
        if(action==='addSeat') {
          if(seats.length>=g.capacity) fail('本局座位已满。')
          const used=new Set(seats.map(s=>s.number));number=1;while(used.has(number))number++
        }
        let memberId=null, name
        if(input.memberId!=null) {
          memberId=integer(input.memberId,1,4294967295,'会员编号')
          const m=await member(connection,memberId);name=m.name
          if(seats.some(s=>s.number!==number&&(s.memberId===memberId||(!s.memberId&&s.name===name)))) fail('该会员已经加入本局。')
        } else if(action==='editSeat'&&!existing.memberId) name=existing.name
        else fail('请从会员列表选择玩家。')
        const role=text(input.role,24,'身份',true),note=text(input.note,200,'备注',true),arrival=time(input.arrival)
        if(!['准时','迟到','早退'].includes(input.status)) fail('出勤状态无效。')
        if(action==='addSeat') await connection.execute('INSERT INTO seats(game_id,number,member_id,name,role,arrival,status,note) VALUES(?,?,?,?,?,?,?,?)',[id,number,memberId,name,role,arrival,input.status,note])
        else await connection.execute('UPDATE seats SET member_id=?,name=?,role=?,arrival=?,status=?,note=? WHERE game_id=? AND number=?',[memberId,name,role,arrival,input.status,note,id,number])
      } else if (action==='deleteSeat') {
        await game(connection,id)
        const [result]=await connection.execute('DELETE FROM seats WHERE game_id=? AND number=?',[id,integer(number,1,20,'座位号')])
        if(!result.affectedRows) fail('该玩家已从本局移除。',404)
      } else if (action==='settings') await connection.execute('UPDATE settings SET shop=? WHERE id=1',[text(input.shop,24,'店铺名称')])
      const data=await readData(connection)
      await connection.commit()
      reply(200,{data})
    } catch(error) {
      if(connection) await connection.rollback()
      if(error.code==='ER_DUP_ENTRY') return reply(409,{message:'昵称或对局玩家已存在，请刷新后重试。'})
      if(!error.status) console.error('Database API failed:',error.code||error.message)
      reply(error.status||503,{message:error.status?error.message:'数据库暂时不可用，请稍后重试。'})
    } finally { connection?.release() }
  }
}
