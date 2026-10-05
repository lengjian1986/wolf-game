import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function createDatabase(env) {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'AUTH_USERNAME', 'AUTH_PASSWORD']) if (!env[key]) throw new Error(`Missing ${key}`)
  const pool = mysql.createPool({ host: env.DB_HOST, port: Number(env.DB_PORT || 3306), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 5, charset: 'utf8mb4', dateStrings: true, timezone: '+09:00' })
  let initialization
  async function initialize() {
    const statements = [
      `CREATE TABLE IF NOT EXISTS members (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(24) NOT NULL UNIQUE, type VARCHAR(12) NOT NULL, total INT NOT NULL DEFAULT 0, remaining INT NOT NULL DEFAULT 0, expiry DATE NULL, purchased DATETIME NOT NULL) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS records (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, member_id INT UNSIGNED NOT NULL, member VARCHAR(24) NOT NULL, time DATETIME NOT NULL, action VARCHAR(8) NOT NULL, note VARCHAR(255) NOT NULL, amount INT NOT NULL, INDEX(member_id,time)) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS games (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, date DATE NOT NULL, start TIME NOT NULL, end TIME NOT NULL, state VARCHAR(12) NOT NULL DEFAULT '未开始', capacity INT NOT NULL, INDEX(date)) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS seats (game_id INT UNSIGNED NOT NULL, number INT NOT NULL, member_id INT UNSIGNED NULL, name VARCHAR(24) NOT NULL, role VARCHAR(24) NOT NULL DEFAULT '', arrival TIME NOT NULL, status VARCHAR(8) NOT NULL, note VARCHAR(200) NOT NULL DEFAULT '', PRIMARY KEY(game_id,number), UNIQUE KEY unique_player(game_id,member_id), FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE, FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE SET NULL) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS settings (id TINYINT PRIMARY KEY, shop VARCHAR(24) NOT NULL) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS users (username VARCHAR(100) PRIMARY KEY, salt CHAR(32) NOT NULL, password_hash CHAR(128) NOT NULL) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS migrations (name VARCHAR(64) PRIMARY KEY) ENGINE=InnoDB`,
      `CREATE TABLE IF NOT EXISTS sessions (token_hash CHAR(64) PRIMARY KEY, username VARCHAR(100) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE) ENGINE=InnoDB`,
    ]
    for (const sql of statements) await pool.query(sql)
    await pool.execute('INSERT IGNORE INTO settings(id,shop) VALUES(1,?)', ['狼人杀店铺'])
    const salt = randomBytes(16)
    await pool.execute('INSERT IGNORE INTO users(username,salt,password_hash) VALUES(?,?,?)', [env.AUTH_USERNAME, salt.toString('hex'), scryptSync(env.AUTH_PASSWORD, salt, 64).toString('hex')])
    const connection=await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [migration]=await connection.execute('INSERT IGNORE INTO migrations(name) VALUES(?)',['legacy-sessions-to-mysql'])
      if(migration.affectedRows && env.DB_MIGRATE_SESSIONS!=='false') {
        let saved={}
        try { saved=JSON.parse(await readFile(new URL('./.sessions.json',import.meta.url),'utf8')) } catch(error) { if(error.code!=='ENOENT') throw error }
        for(const [key,user] of Object.entries(saved)) if(/^[a-f0-9]{64}$/.test(key)&&user?.username===env.AUTH_USERNAME) await connection.execute('INSERT IGNORE INTO sessions(token_hash,username) VALUES(?,?)',[key,user.username])
      }
      await connection.commit()
    } catch(error) {await connection.rollback();throw error} finally {connection.release()}
  }
  function ready() { return initialization ||= initialize().catch(error => { initialization = undefined; throw error }) }
  const sessionStore = {
    async get(key) { if (!key) return; await ready(); const [rows] = await pool.execute('SELECT username FROM sessions WHERE token_hash=?', [key]); return rows[0] },
    async set(key, user) { await ready(); await pool.execute('INSERT INTO sessions(token_hash,username) VALUES(?,?)', [key, user.username]) },
    async delete(key) { if (!key) return; await ready(); await pool.execute('DELETE FROM sessions WHERE token_hash=?', [key]) },
  }
  async function verifyCredentials(username, password) {
    await ready()
    const [rows] = await pool.execute('SELECT salt,password_hash FROM users WHERE BINARY username=?', [username])
    const row = rows[0]
    const actual = scryptSync(password, row ? Buffer.from(row.salt, 'hex') : Buffer.alloc(16), 64)
    return !!row && timingSafeEqual(actual, Buffer.from(row.password_hash, 'hex'))
  }
  return { pool, ready, sessionStore, verifyCredentials }
}

export async function readData(connection) {
  const [members] = await connection.query('SELECT id,name,type,total,remaining,COALESCE(CAST(expiry AS CHAR),\'\') AS expiry,DATE_FORMAT(purchased,\'%Y-%m-%d %H:%i\') AS purchased FROM members ORDER BY id DESC')
  const [records] = await connection.query('SELECT id,member_id AS memberId,member,DATE_FORMAT(time,\'%Y-%m-%d %H:%i\') AS time,action,note,amount FROM records ORDER BY id DESC')
  const [games] = await connection.query('SELECT id,CAST(date AS CHAR) AS date,TIME_FORMAT(start,\'%H:%i\') AS start,TIME_FORMAT(end,\'%H:%i\') AS end,state,capacity FROM games ORDER BY date DESC,start,id')
  const [seats] = await connection.query('SELECT game_id AS gameId,number,member_id AS memberId,name,role,TIME_FORMAT(arrival,\'%H:%i\') AS arrival,status,note FROM seats ORDER BY game_id,number')
  const current=Date.now()
  for (const game of games) {
    game.seats = seats.filter(s => s.gameId === game.id).map(({ gameId, ...s }) => s)
    const start=new Date(`${game.date}T${game.start}:00+09:00`).getTime()
    let end=new Date(`${game.date}T${game.end}:00+09:00`).getTime()
    if(end<=start)end+=24*60*60*1000
    game.state=current<start?'未开始':current<end?'进行中':'已结束'
  }
  const [settings] = await connection.query('SELECT shop FROM settings WHERE id=1')
  return { members, records, games, shop: settings[0].shop }
}
