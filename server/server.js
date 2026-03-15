require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors:{origin:'*',methods:['GET','POST']}, maxHttpBufferSize:20*1024*1024 });
const PORT       = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'hd_messenger_secret_2025';

const UPLOADS_DIR = path.join(__dirname,'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR,{recursive:true});

app.use(cors());
app.use(express.json({limit:'20mb'}));
// Admin panel — must be before static middleware
app.get('/admin', (req,res) => res.sendFile(path.join(__dirname,'admin.html')));

app.use(express.static(path.join(__dirname,'../client/dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const COLORS  = ['#7c5cbf','#ff6b35','#e84393','#2dd4a0','#ffd166','#3a9bd5','#f72585','#4cc9f0'];
const pickColor = e => COLORS[Math.abs(e.split('').reduce((a,c)=>a+c.charCodeAt(0),0))%COLORS.length];
const roomId  = (a,b) => [a,b].sort().join('_');
const grpRoom = gid => `group:${gid}`;

function auth(req,res,next){
  const t=req.headers.authorization?.split(' ')[1];
  if(!t) return res.status(401).json({error:'No token'});
  try { req.user=jwt.verify(t,JWT_SECRET); next(); }
  catch { res.status(401).json({error:'Invalid token'}); }
}

const ALLOWED_TYPES = {
  'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp',
  'application/pdf':'pdf','text/plain':'txt','application/zip':'zip',
  'application/msword':'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
  'video/mp4':'mp4','video/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg',
};

// ── Auth ───────────────────────────────────────────────────────
app.post('/api/register', async (req,res) => {
  try {
    const {name,email,password}=req.body;
    if(!name||!email||!password) return res.status(400).json({error:'All fields required'});
    if(password.length<6) return res.status(400).json({error:'Password min 6 chars'});
    if(db.queries.getUserByEmail.get(email)) return res.status(409).json({error:'Email taken'});
    const uid=uuidv4(), hash=await bcrypt.hash(password,12);
    db.queries.createUser.run({uid,name,email,password:hash,avatar_color:pickColor(email)});
    const user=db.queries.getUserById.get(uid);
    const {password:_,...safe}=user;
    res.status(201).json({token:jwt.sign({uid,name,email},JWT_SECRET,{expiresIn:'7d'}),user:safe});
  } catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

app.post('/api/login', async (req,res) => {
  try {
    const {email,password}=req.body;
    if(!email||!password) return res.status(400).json({error:'Fields required'});
    const user=db.queries.getUserByEmail.get(email);
    if(!user) return res.status(401).json({error:'No account'});
    if(!await bcrypt.compare(password,user.password)) return res.status(401).json({error:'Wrong password'});
    const {password:_,...safe}=user;
    res.json({token:jwt.sign({uid:user.uid,name:user.name,email:user.email},JWT_SECRET,{expiresIn:'7d'}),user:safe});
  } catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

app.get('/api/users', auth, (req,res) => {
  try {
    const users = db.queries.getUsersExcept.all(req.user.uid);
    const blocked = db.queries.getBlockedList.all(req.user.uid).map(r=>r.target_uid);
    const muted   = db.queries.getMutedList.all(req.user.uid).map(r=>r.target_uid);
    res.json(users.map(u=>({
      ...u,
      isBlocked: blocked.includes(u.uid),
      isMuted:   muted.includes(u.uid)
    })));
  } catch(e){res.status(500).json({error:'Server error'});}
});

app.get('/api/messages/:partnerId', auth, (req,res) => {
  try {
    const rid=roomId(req.user.uid,req.params.partnerId);
    res.json(db.queries.getMessages.all(rid));
  } catch(e){res.status(500).json({error:'Server error'});}
});

app.delete('/api/messages/:id', auth, (req,res) => {
  try {
    db.queries.deleteMessage.run(parseInt(req.params.id), req.user.uid);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:'Server error'});}
});

// Clear all messages in a room
app.delete('/api/chat/:partnerId/clear', auth, (req,res) => {
  try {
    const rid = roomId(req.user.uid, req.params.partnerId);
    db.queries.clearRoom.run(rid);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:'Server error'});}
});

app.post('/api/messages/:partnerId/read', auth, (req,res) => {
  try {
    const rid=roomId(req.user.uid,req.params.partnerId);
    db.queries.markRead.run(rid,req.user.uid);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:'Server error'});}
});

app.put('/api/profile', auth, (req,res) => {
  try {
    const {name,status}=req.body;
    if(!name) return res.status(400).json({error:'Name required'});
    db.queries.updateProfile.run(name,status||'',req.user.uid);
    const user=db.queries.getUserById.get(req.user.uid);
    const {password:_,...safe}=user;
    res.json(safe);
  } catch(e){res.status(500).json({error:'Server error'});}
});

app.post('/api/profile/photo', auth, (req,res) => {
  try {
    const {data,mimeType}=req.body;
    if(!data||!mimeType) return res.status(400).json({error:'No data'});
    const ext=ALLOWED_TYPES[mimeType];
    if(!['jpg','png','gif','webp'].includes(ext)) return res.status(400).json({error:'Images only'});
    const buf=Buffer.from(data,'base64');
    if(buf.length>5*1024*1024) return res.status(400).json({error:'Max 5 MB'});
    const old=db.queries.getUserById.get(req.user.uid);
    if(old.avatar_url){const op=path.join(UPLOADS_DIR,path.basename(old.avatar_url));if(fs.existsSync(op))try{fs.unlinkSync(op);}catch{}}
    const fn=`avatar_${req.user.uid}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR,fn),buf);
    db.queries.updateAvatar.run(`/uploads/${fn}`,req.user.uid);
    const user=db.queries.getUserById.get(req.user.uid);
    const {password:_,...safe}=user;
    res.json(safe);
  } catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

app.post('/api/upload', auth, (req,res) => {
  try {
    const {data,mimeType,fileName}=req.body;
    if(!data||!mimeType||!fileName) return res.status(400).json({error:'Missing data'});
    const ext=ALLOWED_TYPES[mimeType];
    if(!ext) return res.status(400).json({error:'Type not allowed'});
    const buf=Buffer.from(data,'base64');
    if(buf.length>15*1024*1024) return res.status(400).json({error:'Max 15 MB'});
    const safe=fileName.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,60);
    const fn=`file_${uuidv4().slice(0,8)}_${safe}`;
    fs.writeFileSync(path.join(UPLOADS_DIR,fn),buf);
    res.json({url:`/uploads/${fn}`,fileName:safe,mimeType,size:buf.length});
  } catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

// ── Groups ─────────────────────────────────────────────────────
app.post('/api/groups', auth, (req,res) => {
  try {
    const {name,memberIds}=req.body;
    if(!name||!memberIds?.length) return res.status(400).json({error:'Name and members required'});
    const gid=uuidv4();
    db.queries.createGroup.run({gid,name,created_by:req.user.uid});
    const allMembers=[req.user.uid,...memberIds];
    allMembers.forEach(uid=>db.queries.addGroupMember.run(gid,uid));
    const group=db.queries.getGroup.get(gid);
    const members=db.queries.getGroupMembers.all(gid);
    res.status(201).json({...group,members});
  } catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

app.get('/api/groups', auth, (req,res) => {
  try {
    const groups=db.queries.getUserGroups.all(req.user.uid);
    res.json(groups.map(g=>({...g,members:db.queries.getGroupMembers.all(g.gid)})));
  } catch(e){res.status(500).json({error:'Server error'});}
});

app.get('/api/groups/:gid/messages', auth, (req,res) => {
  try { res.json(db.queries.getMessages.all(grpRoom(req.params.gid))); }
  catch(e){res.status(500).json({error:'Server error'});}
});

// ── Pins ───────────────────────────────────────────────────────
app.post('/api/messages/:id/pin', auth, (req,res) => {
  try { db.queries.pinMessage.run(parseInt(req.params.id),req.user.uid); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Server error'});}
});
app.delete('/api/messages/:id/pin', auth, (req,res) => {
  try { db.queries.unpinMessage.run(parseInt(req.params.id)); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Server error'});}
});
app.get('/api/pinned/:roomId', auth, (req,res) => {
  try { res.json(db.queries.getPinned.all(decodeURIComponent(req.params.roomId))); }
  catch(e){res.status(500).json({error:'Server error'});}
});

// ── Mute / Block ───────────────────────────────────────────────
app.post('/api/users/:uid/mute', auth, (req,res) => {
  try { db.queries.muteUser.run(req.user.uid,req.params.uid); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Server error'});}
});
app.delete('/api/users/:uid/mute', auth, (req,res) => {
  try { db.queries.unmuteUser.run(req.user.uid,req.params.uid); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Server error'});}
});
app.post('/api/users/:uid/block', auth, (req,res) => {
  try { db.queries.blockUser.run(req.user.uid,req.params.uid); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Server error'});}
});
app.delete('/api/users/:uid/block', auth, (req,res) => {
  try { db.queries.unblockUser.run(req.user.uid,req.params.uid); res.json({ok:true}); }
  catch(e){res.status(500).json({error:'Server error'});}
});

// ── AI Proxy (avoids browser CORS on Anthropic API) ────────────
app.post('/api/ai/chat', auth, async (req,res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_key_here') {
      return res.status(400).json({ error: 'GROQ_API_KEY not set in server/.env' });
    }
    const { system, messages, max_tokens } = req.body;

    // Convert to Groq format (OpenAI-compatible)
    const groqMessages = [];
    if (system) groqMessages.push({ role: 'system', content: system });
    groqMessages.push(...messages);

    const payload = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: max_tokens || 1000,
      messages: groqMessages
    });

    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${apiKey}`,
        }
      };
      const request = https.request(options, response => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try { resolve({ status: response.statusCode, body: JSON.parse(body) }); }
          catch(e) { reject(new Error('Invalid JSON from Groq')); }
        });
      });
      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    if (!data.body.choices?.[0]) {
      const errMsg = data.body.error?.message || JSON.stringify(data.body.error) || 'Unknown Groq error';
      return res.status(data.status).json({ error: errMsg });
    }

    // Convert Groq response → Anthropic-style so frontend stays the same
    const text = data.body.choices[0].message.content;
    res.json({ content: [{ type: 'text', text }] });

  } catch(e) {
    console.error('AI proxy error:', e.message);
    res.status(500).json({ error: 'AI request failed: ' + e.message });
  }
});

// ── DB Admin viewer ────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'hd_admin_2025';
function adminAuth(req,res,next){
  if(req.query.key===ADMIN_KEY||req.headers['x-admin-key']===ADMIN_KEY) return next();
  res.status(401).json({error:'Unauthorized'});
}
app.get('/api/admin/stats',    adminAuth, (req,res)=>res.json(db.queries.stats.get()));
app.get('/api/admin/users',    adminAuth, (req,res)=>res.json(db.queries.allUsers.all()));
app.get('/api/admin/messages', adminAuth, (req,res)=>res.json(db.queries.allMessages.all()));
app.delete('/api/admin/users/:uid', adminAuth, (req,res)=>{
  db.queries.deleteUser.run(req.params.uid); res.json({ok:true});
});



// SPA
app.get(/^(?!\/(api|admin)(\/|$)).*/, (req,res) => res.sendFile(path.join(__dirname,'../client/dist/index.html')));

// ── Socket.io ──────────────────────────────────────────────────
const onlineUsers = new Map();

io.use((socket,next)=>{
  const t=socket.handshake.auth.token;
  if(!t) return next(new Error('Auth required'));
  try { socket.user=jwt.verify(t,JWT_SECRET); next(); }
  catch { next(new Error('Invalid token')); }
});

io.on('connection', socket => {
  const {uid,name}=socket.user;
  onlineUsers.set(uid,socket.id);
  db.queries.updateOnline.run(1,uid);
  io.emit('user:online',{uid,online:true});
  socket.join(`user:${uid}`);

  socket.on('room:join', ({partnerId})=>socket.join(roomId(uid,partnerId)));
  socket.on('group:join', ({gid})=>socket.join(grpRoom(gid)));

  // DM message
  socket.on('message:send', ({partnerId,text})=>{
    if(!text?.trim()||!partnerId) return;
    if(db.queries.isBlocked.get(uid,partnerId)) return;
    const clean=text.trim().slice(0,2000), rid=roomId(uid,partnerId);
    const result=db.queries.insertMessage.run({room_id:rid,sender_id:uid,sender_name:name,text:clean,type:'text'});
    const msg={id:result.lastInsertRowid,room_id:rid,sender_id:uid,sender_name:name,text:clean,type:'text',created_at:new Date().toISOString(),deleted:0,read_at:null};
    io.to(rid).emit('message:new',msg);
    if(!db.queries.isMuted.get(partnerId,uid))
      io.to(`user:${partnerId}`).emit('message:notify',{from:uid,fromName:name,text:clean});
  });

  // DM file
  socket.on('message:file', ({partnerId,url,fileName,mimeType,size})=>{
    if(!partnerId||!url) return;
    if(db.queries.isBlocked.get(uid,partnerId)) return;
    const rid=roomId(uid,partnerId);
    const fileJson=JSON.stringify({url,fileName,mimeType,size});
    const result=db.queries.insertMessage.run({room_id:rid,sender_id:uid,sender_name:name,text:fileJson,type:'file'});
    const msg={id:result.lastInsertRowid,room_id:rid,sender_id:uid,sender_name:name,text:fileJson,type:'file',created_at:new Date().toISOString(),deleted:0,read_at:null};
    io.to(rid).emit('message:new',msg);
    if(!db.queries.isMuted.get(partnerId,uid))
      io.to(`user:${partnerId}`).emit('message:notify',{from:uid,fromName:name,text:`📎 ${fileName}`});
  });

  // Group message
  socket.on('group:send', ({gid,text})=>{
    if(!text?.trim()||!gid) return;
    const clean=text.trim().slice(0,2000), rid=grpRoom(gid);
    const result=db.queries.insertGroupMsg.run({room_id:rid,sender_id:uid,sender_name:name,text:clean,type:'text'});
    const msg={id:result.lastInsertRowid,room_id:rid,sender_id:uid,sender_name:name,text:clean,type:'text',created_at:new Date().toISOString(),deleted:0,read_at:null};
    io.to(rid).emit('message:new',msg);
    // Notify group members not in the room
    const members=db.queries.getGroupMembers.all(gid);
    members.filter(m=>m.uid!==uid).forEach(m=>{
      if(!db.queries.isMuted.get(m.uid,uid))
        io.to(`user:${m.uid}`).emit('message:notify',{from:uid,fromName:name,text:`[${db.queries.getGroup.get(gid)?.name}] ${clean}`});
    });
  });

  // Delete message
  socket.on('message:delete', ({messageId,roomId:rid})=>{
    db.queries.deleteMessage.run(messageId,uid);
    io.to(rid).emit('message:deleted',{messageId});
  });

  // Read receipt
  socket.on('message:read', ({partnerId})=>{
    const rid=roomId(uid,partnerId);
    db.queries.markRead.run(rid,uid);
    io.to(`user:${partnerId}`).emit('message:read',{reader:uid,roomId:rid});
  });

  socket.on('typing:start', ({partnerId})=>socket.to(roomId(uid,partnerId)).emit('typing:start',{uid,name}));
  socket.on('typing:stop',  ({partnerId})=>socket.to(roomId(uid,partnerId)).emit('typing:stop',{uid}));
  socket.on('group:typing:start', ({gid})=>socket.to(grpRoom(gid)).emit('typing:start',{uid,name}));
  socket.on('group:typing:stop',  ({gid})=>socket.to(grpRoom(gid)).emit('typing:stop',{uid}));

  // WebRTC
  socket.on('call:offer',  ({to,offer,callType})=>io.to(`user:${to}`).emit('call:incoming', {from:uid,fromName:name,offer,callType}));
  socket.on('call:answer', ({to,answer})         =>io.to(`user:${to}`).emit('call:answered',{from:uid,answer}));
  socket.on('call:ice',    ({to,candidate})       =>io.to(`user:${to}`).emit('call:ice',    {from:uid,candidate}));
  socket.on('call:reject', ({to})                 =>io.to(`user:${to}`).emit('call:rejected',{from:uid}));
  socket.on('call:end',    ({to})                 =>io.to(`user:${to}`).emit('call:ended',  {from:uid}));

  socket.on('disconnect', ()=>{
    onlineUsers.delete(uid);
    db.queries.updateOnline.run(0,uid);
    io.emit('user:online',{uid,online:false});
  });
});

(async()=>{
  await db.init();
  server.listen(PORT,()=>console.log(`\n  🚀 HD Messenger v3 → http://localhost:${PORT}\n`));
})();
