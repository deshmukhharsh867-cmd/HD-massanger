require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const initSqlJs = require('sql.js');
const fs   = require('fs');
const path = require('path');

// ALWAYS relative to this file (server/), never cwd — this fixes the login bug
const DB_PATH = path.join(__dirname, 'hd-messenger.db');

let db = null, queries = null;

function save() {
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
  catch (e) { console.error('DB save error:', e.message); }
}
function all(sql, params=[]) {
  const s=db.prepare(sql); s.bind(params);
  const rows=[]; while(s.step()) rows.push(s.getAsObject()); s.free(); return rows;
}
function get(sql, params=[]) {
  const s=db.prepare(sql); s.bind(params);
  let row=null; if(s.step()) row=s.getAsObject(); s.free(); return row;
}
function run(sql, params=[]) { db.run(sql, params); save(); }

function buildQueries() { return {
  createUser:    { run: ({uid,name,email,password,avatar_color}) =>
    run('INSERT INTO users(uid,name,email,password,avatar_color)VALUES(?,?,?,?,?)',[uid,name,email,password,avatar_color]) },
  getUserByEmail:{ get: e  => get('SELECT * FROM users WHERE email=?',[e]) },
  getUserById:   { get: id => get('SELECT * FROM users WHERE uid=?',[id]) },
  getUsersExcept:{ all: uid => all('SELECT uid,name,email,status,online,avatar_color,avatar_url FROM users WHERE uid!=?',[uid]) },
  updateOnline:  { run: (on,uid) => run('UPDATE users SET online=? WHERE uid=?',[on,uid]) },
  updateProfile: { run: (name,status,uid) => run('UPDATE users SET name=?,status=? WHERE uid=?',[name,status,uid]) },
  updateAvatar:  { run: (url,uid) => run('UPDATE users SET avatar_url=? WHERE uid=?',[url,uid]) },
  insertMessage: { run: ({room_id,sender_id,sender_name,text,type}) => {
    db.run('INSERT INTO messages(room_id,sender_id,sender_name,text,type)VALUES(?,?,?,?,?)',
      [room_id,sender_id,sender_name,text,type]); save();
    return { lastInsertRowid: get('SELECT last_insert_rowid() AS id').id };
  }},
  getMessages:   { all: rid => all('SELECT * FROM(SELECT * FROM messages WHERE room_id=? AND deleted=0 ORDER BY created_at DESC LIMIT 200)sub ORDER BY created_at ASC',[rid]) },
  deleteMessage: { run: (id,uid) => run('UPDATE messages SET deleted=1 WHERE id=? AND sender_id=?',[id,uid]) },
  clearRoom:     { run: (rid) => run('DELETE FROM messages WHERE room_id=?',[rid]) },
  markRead:      { run: (rid,uid) => run('UPDATE messages SET read_at=CURRENT_TIMESTAMP WHERE room_id=? AND sender_id!=? AND read_at IS NULL',[rid,uid]) },
  createGroup:   { run: ({gid,name,created_by}) => run('INSERT INTO groups(gid,name,created_by)VALUES(?,?,?)',[gid,name,created_by]) },
  addGroupMember:   { run: (gid,uid) => run('INSERT OR IGNORE INTO group_members(gid,uid)VALUES(?,?)',[gid,uid]) },
  removeGroupMember:{ run: (gid,uid) => run('DELETE FROM group_members WHERE gid=? AND uid=?',[gid,uid]) },
  getGroup:         { get: gid => get('SELECT * FROM groups WHERE gid=?',[gid]) },
  getGroupMembers:  { all: gid => all('SELECT u.uid,u.name,u.avatar_color,u.avatar_url,u.online FROM group_members gm JOIN users u ON u.uid=gm.uid WHERE gm.gid=?',[gid]) },
  getUserGroups:    { all: uid => all('SELECT g.* FROM groups g JOIN group_members gm ON gm.gid=g.gid WHERE gm.uid=?',[uid]) },
  insertGroupMsg:{ run: ({room_id,sender_id,sender_name,text,type}) => {
    db.run('INSERT INTO messages(room_id,sender_id,sender_name,text,type)VALUES(?,?,?,?,?)',
      [room_id,sender_id,sender_name,text,type]); save();
    return { lastInsertRowid: get('SELECT last_insert_rowid() AS id').id };
  }},
  pinMessage:   { run: (mid,uid) => run('INSERT OR IGNORE INTO pinned_messages(message_id,pinned_by)VALUES(?,?)',[mid,uid]) },
  unpinMessage: { run: (mid) => run('DELETE FROM pinned_messages WHERE message_id=?',[mid]) },
  getPinned:    { all: rid => all('SELECT m.*,pm.pinned_at FROM messages m JOIN pinned_messages pm ON pm.message_id=m.id WHERE m.room_id=? ORDER BY pm.pinned_at DESC',[rid]) },
  muteUser:    { run: (uid,tid) => run('INSERT OR IGNORE INTO muted_users(uid,target_uid)VALUES(?,?)',[uid,tid]) },
  unmuteUser:  { run: (uid,tid) => run('DELETE FROM muted_users WHERE uid=? AND target_uid=?',[uid,tid]) },
  isMuted:     { get: (uid,tid) => get('SELECT 1 FROM muted_users WHERE uid=? AND target_uid=?',[uid,tid]) },
  blockUser:   { run: (uid,tid) => run('INSERT OR IGNORE INTO blocked_users(uid,target_uid)VALUES(?,?)',[uid,tid]) },
  unblockUser: { run: (uid,tid) => run('DELETE FROM blocked_users WHERE uid=? AND target_uid=?',[uid,tid]) },
  isBlocked:   { get: (uid,tid) => get('SELECT 1 FROM blocked_users WHERE(uid=?AND target_uid=?)OR(uid=?AND target_uid=?)',[uid,tid,tid,uid]) },
  getMutedList:  { all: uid => all('SELECT target_uid FROM muted_users WHERE uid=?',[uid]) },
  getBlockedList:{ all: uid => all('SELECT target_uid FROM blocked_users WHERE uid=?',[uid]) },
  // DB admin viewer
  allUsers:    { all: () => all('SELECT id,uid,name,email,status,online,avatar_color,created_at FROM users ORDER BY id DESC') },
  allMessages: { all: () => all('SELECT id,room_id,sender_name,SUBSTR(text,1,80) as text,type,deleted,created_at FROM messages ORDER BY id DESC LIMIT 200') },
  deleteUser:  { run: (uid) => run('DELETE FROM users WHERE uid=?',[uid]) },
  stats:       { get: () => get('SELECT (SELECT COUNT(*) FROM users) as users,(SELECT COUNT(*) FROM messages WHERE deleted=0) as messages,(SELECT COUNT(*) FROM groups) as groups') },
};}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('✅ DB loaded from:', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('✅ DB created at:', DB_PATH);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      status TEXT DEFAULT 'Hey there! Using HD Messenger 👋',
      online INTEGER DEFAULT 0, avatar_color TEXT DEFAULT '#7c5cbf',
      avatar_url TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL, sender_name TEXT NOT NULL, text TEXT NOT NULL,
      type TEXT DEFAULT 'text', deleted INTEGER DEFAULT 0,
      read_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS groups(
      gid TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_color TEXT DEFAULT '#7c5cbf',
      created_by TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS group_members(
      gid TEXT NOT NULL, uid TEXT NOT NULL, PRIMARY KEY(gid,uid)
    );
    CREATE TABLE IF NOT EXISTS pinned_messages(
      message_id INTEGER PRIMARY KEY, pinned_by TEXT NOT NULL,
      pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS muted_users(uid TEXT NOT NULL, target_uid TEXT NOT NULL, PRIMARY KEY(uid,target_uid));
    CREATE TABLE IF NOT EXISTS blocked_users(uid TEXT NOT NULL, target_uid TEXT NOT NULL, PRIMARY KEY(uid,target_uid));
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_group_members ON group_members(uid);
  `);

  for(const col of [
    'ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL',
    'ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0',
    'ALTER TABLE messages ADD COLUMN read_at DATETIME DEFAULT NULL',
  ]) { try { db.run(col); } catch {} }

  db.run('UPDATE users SET online=0');
  save();
  queries = buildQueries();
}

module.exports = { init, get queries(){ return queries; }, get dbPath(){ return DB_PATH; } };
