import React, { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from './Avatar.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import { PersonaPicker, AIReplyPanel } from './AIMode.jsx';
import { apiGet, apiPost, apiDelete } from '../utils/api.js';
import { getSocket } from '../utils/socket.js';
import { fmtTime, fmtFileSize, isImage } from '../utils/helpers.js';

function roomId(a,b){ return [a,b].sort().join('_'); }
function grpRoom(gid){ return `group:${gid}`; }

export default function ChatView({ token, user, users, activeChat, onBack, showToast, onStartCall, onUpdateUsers }) {
  const isDM    = activeChat?.type === 'dm';
  const partner = isDM ? (users.find(u=>u.uid===activeChat.data?.uid)||activeChat.data) : null;
  const group   = !isDM ? activeChat?.data : null;
  const rid     = isDM ? roomId(user.uid, partner?.uid) : grpRoom(group?.gid);

  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [messages,      setMessages]     = useState([]);
  const [text,          setText]         = useState('');
  const [isTyping,      setIsTyping]     = useState(false);
  const [partnerTyping, setPT]           = useState(false);
  const [typingName,    setTypingName]   = useState('');
  const [msgSearch,     setMsgSearch]    = useState('');
  const [showMsgSearch, setShowMsgSearch]= useState(false);
  const [uploading,     setUploading]    = useState(false);
  const [showEmoji,     setShowEmoji]    = useState(false);
  const [pinnedMsgs,    setPinnedMsgs]   = useState([]);
  const [showPinned,    setShowPinned]   = useState(false);
  const [hoveredMsg,    setHoveredMsg]   = useState(null);
  const [allRead,       setAllRead]      = useState(false);
  const [aiPersona,     setAiPersona]    = useState(null);   // selected persona object
  const [showAIPicker,  setShowAIPicker] = useState(false);  // persona picker modal
  const [aiMessage,     setAiMessage]    = useState(null);   // message being analyzed

  const endRef       = useRef(null);
  const typingRef    = useRef(null);
  const msgSearchRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef     = useRef(null);
  const sock         = getSocket();

  // Load messages
  useEffect(() => {
    if (!token || !rid) return;
    setMessages([]); setMsgSearch(''); setShowMsgSearch(false); setShowPinned(false); setAllRead(false); setAiMessage(null);
    const url = isDM ? `/messages/${partner.uid}` : `/groups/${group.gid}/messages`;
    apiGet(url, token).then(msgs => { setMessages(msgs); scrollToEnd(false); }).catch(()=>{});

    // Load pinned
    apiGet(`/pinned/${encodeURIComponent(rid)}`, token).then(setPinnedMsgs).catch(()=>{});

    // Mark as read (DMs only)
    if (isDM && sock) {
      apiPost(`/messages/${partner.uid}/read`, {}, token).catch(()=>{});
      sock.emit('message:read', { partnerId: partner.uid });
    }
  }, [rid]);

  // Socket events
  useEffect(() => {
    if (!sock || !rid) return;
    if (isDM) sock.emit('room:join', { partnerId: partner.uid });
    else sock.emit('group:join', { gid: group.gid });

    const onMsg = msg => {
      if (msg.room_id === rid) {
        setMessages(p => [...p, msg]);
        scrollToEnd(true);
        // Auto-mark read if window focused
        if (isDM && document.hasFocus()) {
          apiPost(`/messages/${partner.uid}/read`, {}, token).catch(()=>{});
          sock.emit('message:read', { partnerId: partner.uid });
        }
      }
    };
    const onDeleted  = ({messageId}) => setMessages(p => p.filter(m=>m.id!==messageId));
    const onRead     = ({reader}) => { if (reader !== user.uid) setAllRead(true); };
    const onTypSt    = ({uid,name}) => { if(uid!==user.uid){setPT(true);setTypingName(name||'');} };
    const onTypSp    = ({uid})     => { if(uid!==user.uid) setPT(false); };

    sock.on('message:new',     onMsg);
    sock.on('message:deleted', onDeleted);
    sock.on('message:read',    onRead);
    sock.on('typing:start',    onTypSt);
    sock.on('typing:stop',     onTypSp);
    return () => {
      sock.off('message:new',     onMsg);
      sock.off('message:deleted', onDeleted);
      sock.off('message:read',    onRead);
      sock.off('typing:start',    onTypSt);
      sock.off('typing:stop',     onTypSp);
    };
  }, [rid, sock]);

  useEffect(() => { scrollToEnd(false); }, [messages]);

  function scrollToEnd(smooth=false) {
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:smooth?'smooth':'auto'}),50);
  }

  const handleSend = useCallback(() => {
    if (!text.trim() || !sock) return;
    if (isDM) sock.emit('message:send', {partnerId:partner.uid, text:text.trim()});
    else      sock.emit('group:send',   {gid:group.gid, text:text.trim()});
    setText(''); stopTyping();
  }, [text, isDM, partner, group, sock]);

  const handleKeyDown = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} };

  function handleInput(val) {
    setText(val);
    if (!sock) return;
    if (val && !isTyping) {
      setIsTyping(true);
      if(isDM) sock.emit('typing:start',{partnerId:partner.uid});
      else     sock.emit('group:typing:start',{gid:group.gid});
    }
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(stopTyping, 1500);
  }

  function stopTyping() {
    setIsTyping(false);
    if(!sock) return;
    if(isDM&&partner)  sock.emit('typing:stop',{partnerId:partner.uid});
    else if(!isDM&&group) sock.emit('group:typing:stop',{gid:group.gid});
  }

  // ── File send ──────────────────────────────────────────────────
  const handleFileSelect = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15*1024*1024) { showToast('Max 15 MB','error'); return; }
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await apiPost('/upload', {data:b64,mimeType:file.type,fileName:file.name}, token);
      if (isDM) sock.emit('message:file', {partnerId:partner.uid,...res});
    } catch(e) { showToast(e.message||'Upload failed','error'); }
    finally { setUploading(false); e.target.value=''; }
  };

  // ── Emoji ──────────────────────────────────────────────────────
  const insertEmoji = useCallback(emoji => {
    const inp = inputRef.current;
    if (inp) {
      const s=inp.selectionStart??text.length, end=inp.selectionEnd??text.length;
      const nxt = text.slice(0,s)+emoji+text.slice(end);
      setText(nxt);
      setTimeout(()=>{ inp.focus(); inp.setSelectionRange(s+emoji.length,s+emoji.length); },0);
    } else setText(t=>t+emoji);
  }, [text]);

  // ── Delete message ────────────────────────────────────────────
  const deleteMsg = async msg => {
    try {
      await apiDelete(`/messages/${msg.id}`, token);
      sock.emit('message:delete', {messageId:msg.id, roomId:rid});
      setMessages(p=>p.filter(m=>m.id!==msg.id));
    } catch(e) { showToast(e.message,'error'); }
  };

  // ── Pin / Unpin ────────────────────────────────────────────────
  const pinMsg = async msg => {
    const already = pinnedMsgs.find(p=>p.id===msg.id);
    try {
      if (already) {
        await apiDelete(`/messages/${msg.id}/pin`, token);
        setPinnedMsgs(p=>p.filter(x=>x.id!==msg.id));
        showToast('Unpinned');
      } else {
        await apiPost(`/messages/${msg.id}/pin`, {}, token);
        setPinnedMsgs(p=>[{...msg,pinned_at:new Date().toISOString()},...p]);
        showToast('📌 Pinned');
      }
    } catch(e) { showToast(e.message,'error'); }
  };

  // ── Search / grouping ──────────────────────────────────────────
  const displayMsgs = msgSearch.trim()
    ? messages.filter(m=>{
        const txt = m.type==='file' ? (tryParseFile(m.text)?.fileName||'') : m.text;
        return txt.toLowerCase().includes(msgSearch.toLowerCase());
      })
    : messages;
  const matchCount = msgSearch.trim() ? displayMsgs.length : null;
  const grouped    = groupMessages(displayMsgs, user.uid);

  const headerName = isDM ? partner?.name : group?.name;
  const headerSub  = isDM
    ? (partnerTyping ? `✍️ ${typingName||''}typing...` : partner?.online ? '● Online' : 'Offline')
    : (partnerTyping ? `✍️ ${typingName} typing...` : `${group?.members?.length||0} members`);

  const isBlocked = isDM && partner?.isBlocked;

  return (
    <div className="chat-main">
      {/* Header */}
      <div className="chat-header">
        <button className="back-btn back-btn--mobile" onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M14 4l-7 7 7 7" stroke="#e8edf5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="chat-header-avatar" style={{cursor: isDM ? 'pointer' : 'default'}} onClick={() => isDM && setShowPartnerProfile(true)}>
          {isDM
            ? <Avatar name={partner?.name} color={partner?.avatar_color} size={40} avatarUrl={partner?.avatar_url}/>
            : <div className="group-avatar group-avatar--sm" style={{background:group?.avatar_color||'#7c5cbf'}}>{group?.name?.slice(0,2).toUpperCase()}</div>
          }
        </div>
        <div className="chat-header-info" style={{cursor: isDM ? 'pointer' : 'default'}} onClick={() => isDM && setShowPartnerProfile(true)}>
          <div className="chat-header-name">{headerName}</div>
          <div className={'chat-header-status'+(isDM&&partner?.online?' online':'')}>
            {headerSub}
          </div>
        </div>
        <div className="header-actions">
          {/* AI Mode button - DM only */}
          {isDM && (
            <button
              className={'icon-btn ai-mode-btn' + (aiPersona ? ' ai-mode-btn--active' : '')}
              title={aiPersona ? `AI Mode: ${aiPersona.label}` : 'Enable AI Mode'}
              onClick={() => setShowAIPicker(true)}
              style={aiPersona ? { background: aiPersona.color + '33', borderColor: aiPersona.color } : {}}
            >
              {aiPersona
                ? <span style={{ fontSize: 14 }}>{aiPersona.emoji}</span>
                : <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <circle cx="8.5" cy="8.5" r="7" stroke="#e8edf5" strokeWidth="1.5"/>
                    <path d="M5.5 9.5c0-1.7 1.3-3 3-3s3 1.3 3 3" stroke="#e8edf5" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="6" cy="7" r="0.8" fill="#e8edf5"/>
                    <circle cx="11" cy="7" r="0.8" fill="#e8edf5"/>
                    <path d="M8.5 1.5v1M8.5 14v1M1.5 8.5h1M14 8.5h1" stroke="#e8edf5" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
              }
            </button>
          )}
          {pinnedMsgs.length>0 && (
            <button className={'icon-btn'+(showPinned?' msg-search-toggle--active':'')}
              title={`${pinnedMsgs.length} pinned`} onClick={()=>setShowPinned(s=>!s)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 1.5l5 5-2 2-1.5-.5-3 3 .5 2-1 1-3-3-3 3-1-1 3-3-3-3 1-1 2 .5 3-3-.5-1.5 2-2z" stroke="#e8edf5" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            </button>
          )}
          {isDM && (
            <>
              <button className="icon-btn call-icon-btn" title="Audio call" onClick={()=>onStartCall(partner,'audio')}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M14.5 11.5l-2-2a1.1 1.1 0 00-1.6 0l-.9.9a9 9 0 01-3.4-3.4l.9-.9a1.1 1.1 0 000-1.6l-2-2A1.1 1.1 0 004 2.6L2.7 3.9C2 4.6 1.8 5.6 2.3 6.5a14 14 0 008.2 8.2c.9.5 1.9.3 2.6-.4L14.4 13a1.1 1.1 0 00.1-1.5z" stroke="#e8edf5" strokeWidth="1.4" fill="none"/></svg>
              </button>
              <button className="icon-btn call-icon-btn" title="Video call" onClick={()=>onStartCall(partner,'video')}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="1" y="4" width="10" height="9" rx="1.5" stroke="#e8edf5" strokeWidth="1.4"/><path d="M11 7.5l4-2.5v7l-4-2.5" stroke="#e8edf5" strokeWidth="1.4" strokeLinejoin="round"/></svg>
              </button>
            </>
          )}
          <button className={'icon-btn msg-search-toggle'+(showMsgSearch?' msg-search-toggle--active':'')}
            title="Search" onClick={()=>{ setShowMsgSearch(s=>{ if(s)setMsgSearch(''); else setTimeout(()=>msgSearchRef.current?.focus(),50); return !s; }); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="#e8edf5" strokeWidth="1.6"/><path d="M11 11l4 4" stroke="#e8edf5" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
          {isDM && (
            <button className="icon-btn" title="Clear all chat" onClick={()=>setShowClearConfirm(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="#e84393" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Pinned bar */}
      {showPinned && pinnedMsgs.length>0 && (
        <div className="pinned-bar">
          <div className="pinned-bar-title">📌 Pinned Messages ({pinnedMsgs.length})</div>
          <div className="pinned-list">
            {pinnedMsgs.map(m=>(
              <div key={m.id} className="pinned-item">
                <div className="pinned-text">{m.type==='file'?'📎 File':m.text.slice(0,80)}</div>
                <button className="pinned-unpin" onClick={()=>pinMsg(m)} title="Unpin">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      {showMsgSearch && (
        <div className="msg-search-bar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{opacity:.5,flexShrink:0}}><circle cx="6" cy="6" r="4" stroke="#e8edf5" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="#e8edf5" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input ref={msgSearchRef} className="msg-search-input" type="text"
            placeholder="Search in conversation..." value={msgSearch} onChange={e=>setMsgSearch(e.target.value)}/>
          {matchCount!==null && <span className="msg-search-count">{matchCount} {matchCount===1?'match':'matches'}</span>}
          {msgSearch && <button className="search-clear" onClick={()=>setMsgSearch('')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="#7a8fa6" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>}
        </div>
      )}

      {/* Messages */}
      <div className="messages-area">
        {!displayMsgs.length && (
          <div className="empty-state">
            <div className="empty-icon">{msgSearch?'🔍':isDM?'👋':'👥'}</div>
            <div className="empty-title">{msgSearch?'No messages found':isDM?`Say hello to ${partner?.name}!`:`Welcome to ${group?.name}!`}</div>
            <div className="empty-sub">{msgSearch?`No messages match "${msgSearch}"`:isDM?'Your messages will appear here.':'Start the group conversation!'}</div>
            {/* AI starter button — show when AI mode is on and no messages yet */}
            {isDM && aiPersona && !msgSearch && messages.length === 0 && (
              <button className="ai-starter-btn" onClick={() => setAiMessage('__starter__')}>
                {aiPersona.emoji} Ask AI how to start chatting
              </button>
            )}
            {/* Nudge to enable AI if not on */}
            {isDM && !aiPersona && !msgSearch && messages.length === 0 && (
              <button className="ai-starter-btn ai-starter-btn--dim" onClick={() => setShowAIPicker(true)}>
                ✨ Enable AI Mode for opening ideas
              </button>
            )}
          </div>
        )}

        {grouped.map((grp,gi)=>(
          <React.Fragment key={gi}>
            {grp.dateLabel && <div className="date-divider">{grp.dateLabel}</div>}
            <div className={'msg-group '+(grp.isMe?'out':'in')}>
              {/* Show sender name in groups */}
              {!isDM && !grp.isMe && <div className="group-sender-name">{grp.messages[0]?.sender_name}</div>}
              {grp.messages.map((m,mi)=>(
                <div key={m.id} className="msg-row"
                  onMouseEnter={()=>setHoveredMsg(m.id)}
                  onMouseLeave={()=>setHoveredMsg(null)}>
                  <div className={'msg-bubble'+(m.type==='file'?' msg-bubble--file':'')+(aiPersona&&!grp.isMe?' msg-bubble--ai-glow':'')}>
                    {m.type==='file'
                      ? <FileBubble data={m.text}/>
                      : (msgSearch.trim()?highlightText(m.text,msgSearch):m.text)
                    }
                    {mi===grp.messages.length-1 && (
                      <span className="msg-time">
                        {fmtTime(m.created_at)}
                        {/* Read receipt (DM out only) */}
                        {isDM && grp.isMe && mi===grp.messages.length-1 && (
                          <span className={'read-tick'+(allRead?' read-tick--read':'')} title={allRead?'Seen':'Sent'}>
                            {allRead ? '✓✓' : '✓'}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Message actions toolbar */}
                  {hoveredMsg===m.id && (
                    <div className={'msg-actions'+(grp.isMe?' msg-actions--out':' msg-actions--in')}>
                      {/* AI Reply button - incoming messages only */}
                      {isDM && !grp.isMe && aiPersona && m.type!=='file' && (
                        <button className="msg-action-btn msg-action-btn--ai" title="Get AI reply"
                          onClick={()=>setAiMessage(m.text)}>
                          {aiPersona.emoji}
                        </button>
                      )}
                      <button className="msg-action-btn" title="Pin" onClick={()=>pinMsg(m)}>
                        {pinnedMsgs.find(p=>p.id===m.id)?'📌':'📍'}
                      </button>
                      {grp.isMe && (
                        <button className="msg-action-btn msg-action-btn--delete" title="Delete" onClick={()=>deleteMsg(m)}>
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M4 3v7h5V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </React.Fragment>
        ))}

        {partnerTyping && (
          <div className="typing-indicator">
            <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Blocked banner */}
      {isBlocked && (
        <div className="blocked-banner">
          🚫 You have blocked this user. Unblock in the sidebar to chat.
        </div>
      )}

      {/* Input */}
      {!isBlocked && (
        <div className="input-bar">
          <button className="attach-btn" onClick={()=>fileInputRef.current?.click()} title="Attach" disabled={uploading}>
            {uploading
              ? <span className="spinner" style={{width:16,height:16}}/>
              : <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15.5 8.5l-7.8 7.8a4.2 4.2 0 01-5.9-5.9L9.6 2.6a2.8 2.8 0 013.9 3.9L6.7 14a1.4 1.4 0 01-2-2L11 5.7" stroke="#7a8fa6" strokeWidth="1.6" strokeLinecap="round"/></svg>
            }
          </button>
          <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileSelect}/>

          <div className="emoji-wrap">
            <button className={'attach-btn emoji-toggle'+(showEmoji?' emoji-toggle--active':'')}
              onClick={()=>setShowEmoji(s=>!s)} title="Emoji">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7.5" stroke="#7a8fa6" strokeWidth="1.6"/>
                <circle cx="6.5" cy="7.5" r="1" fill="#7a8fa6"/>
                <circle cx="11.5" cy="7.5" r="1" fill="#7a8fa6"/>
                <path d="M5.5 11c.8 1.5 6.2 1.5 7 0" stroke="#7a8fa6" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={()=>setShowEmoji(false)}/>}
          </div>

          <input ref={inputRef} className="msg-input" type="text"
            placeholder="Type a message..." value={text}
            onChange={e=>handleInput(e.target.value)} onKeyDown={handleKeyDown}/>
          <button className="send-btn" onClick={handleSend}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 2L2 8l5 3 2 5 7-14z" fill="white"/></svg>
          </button>
        </div>
      )}

      {/* AI Reply Panel — slides up when a message is being analyzed */}
      {aiPersona && aiMessage && (
        <AIReplyPanel
          message={aiMessage === '__starter__' ? null : aiMessage}
          persona={aiPersona}
          partnerName={partner?.name}
          conversationHistory={messages}
          myUid={user.uid}
          onUseReply={(replyText) => {
            setText(replyText);
            setAiMessage(null);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          onDismiss={() => setAiMessage(null)}
        />
      )}

      {/* Persona Picker modal */}
      {showAIPicker && (
        <PersonaPicker
          partnerName={partner?.name}
          current={aiPersona}
          onSelect={setAiPersona}
          onClose={() => setShowAIPicker(false)}
        />
      )}

      {/* Partner Profile Card */}
      {showPartnerProfile && partner && (
        <PartnerProfileCard partner={partner} onClose={() => setShowPartnerProfile(false)} />
      )}

      {/* Clear Chat Confirm */}
      {showClearConfirm && (
        <div className="dialog-overlay" onClick={()=>setShowClearConfirm(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <div className="dialog-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 7h18M8 7V5h10v2M9 11v7M13 11v7M17 11v7M5 7l1.5 14h13L21 7" stroke="#e84393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="dialog-title">Clear all chat?</div>
            <div className="dialog-sub">All messages with {partner?.name} will be permanently deleted.</div>
            <div className="dialog-actions">
              <button className="btn-no" onClick={()=>setShowClearConfirm(false)}>Cancel</button>
              <button className="btn-yes" onClick={async ()=>{
                try {
                  await apiDelete(`/chat/${partner.uid}/clear`, token);
                  setMessages([]);
                  setPinnedMsgs([]);
                  setShowClearConfirm(false);
                  showToast('Chat cleared ✓');
                } catch(e){ showToast('Failed to clear','error'); setShowClearConfirm(false); }
              }}>Clear All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── File bubble ────────────────────────────────────────────────
function FileBubble({data}) {
  const file = tryParseFile(data);
  if (!file) return <span>{data}</span>;
  const {url,fileName,mimeType,size} = file;
  if (isImage(mimeType)) return (
    <div className="file-image-wrap">
      <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={fileName} className="file-image"/></a>
      <div className="file-image-name">{fileName}</div>
    </div>
  );
  return (
    <a href={url} download={fileName} className="file-attachment" target="_blank" rel="noopener noreferrer">
      <div className="file-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M13 2H6a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-5-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M13 2v7h7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg></div>
      <div className="file-info"><div className="file-name">{fileName}</div><div className="file-size">{fmtFileSize(size)}</div></div>
      <div className="file-dl"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M1 11h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></div>
    </a>
  );
}

function tryParseFile(t){ try{return JSON.parse(t);}catch{return null;} }
function fileToBase64(f){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(f); }); }

function highlightText(text,q){
  if(!q.trim()) return text;
  const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.split(re).map((p,i)=>re.test(p)?<mark key={i} className="msg-highlight">{p}</mark>:p);
}

function groupMessages(msgs,myUid){
  const groups=[]; let lastDate='',lastSender='',cur=null;
  msgs.forEach(m=>{
    const date=fmtDate(m.created_at), isMe=m.sender_id===myUid;
    const nd=date!==lastDate, ns=m.sender_id!==lastSender;
    if(nd||ns){ if(cur)groups.push(cur); cur={dateLabel:nd?date:null,isMe,messages:[m]}; lastDate=date;lastSender=m.sender_id; }
    else cur.messages.push(m);
  });
  if(cur) groups.push(cur);
  return groups;
}

function fmtDate(ts){
  const d=new Date(ts), now=new Date();
  if(d.toDateString()===now.toDateString()) return 'Today';
  const y=new Date(now); y.setDate(now.getDate()-1);
  if(d.toDateString()===y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

// ── Partner Profile Card ────────────────────────────────────────
function PartnerProfileCard({ partner, onClose }) {
  const isAdminUser = partner?.name?.toLowerCase() === 'admin' && partner?.email === 'admin@admin.com';
  const c = partner?.avatar_color || '#7c5cbf';
  const heroColor  = isAdminUser ? '#ffd166' : c;
  const ringBg     = isAdminUser
    ? 'linear-gradient(135deg,#ffd166,#ffaa00,#ff6b35,#ffd166)'
    : `linear-gradient(135deg,${c},#ffffff88,${c})`;
  const ringGlow   = isAdminUser
    ? '0 0 28px rgba(255,209,102,.7),0 0 56px rgba(255,170,0,.3)'
    : `0 0 22px ${c}99,0 0 44px ${c}44`;
  const heroBg     = isAdminUser
    ? 'linear-gradient(180deg,#1a1200 0%,#0f0a00 70%,#0d1117 100%)'
    : `linear-gradient(180deg,${c}28 0%,${c}0a 70%,transparent 100%)`;

  return (
    <div className="profile-card-overlay" onClick={onClose}>
      <div className="profile-card" onClick={e => e.stopPropagation()}>

        {/* Hero bg */}
        <div className="profile-card-hero" style={{background: heroBg}}>
          <div className="profile-hero-glow" style={{background:`radial-gradient(circle,${heroColor}44 0%,transparent 70%)`}}/>

          {/* Close */}
          <button className="profile-card-close" onClick={onClose}>✕</button>

          {/* Crown / Star */}
          <div className="profile-card-topicon" style={{filter:`drop-shadow(0 0 12px ${heroColor}bb)`}}>
            {isAdminUser ? '👑' : '⭐'}
          </div>

          {/* Avatar ring */}
          <div className="profile-card-ring" style={{background: ringBg, backgroundSize:'300% 300%', animation:'goldRing 3s linear infinite', boxShadow: ringGlow}}>
            <div style={{padding:3, borderRadius:'50%', background: isAdminUser ? '#0f0a00' : 'var(--navy1)'}}>
              <Avatar name={partner?.name} color={c} size={90} avatarUrl={partner?.avatar_url}/>
            </div>
          </div>

          {/* Name */}
          <div className="profile-card-name shine-text" style={{'--shine-color': heroColor}}>
            {partner?.name}
          </div>

          {/* Badge */}
          <div className="profile-card-badge" style={{
            background: isAdminUser
              ? 'linear-gradient(90deg,rgba(255,209,102,.15),rgba(255,170,0,.25),rgba(255,209,102,.15))'
              : `linear-gradient(90deg,${c}22,${c}44,${c}22)`,
            border: `1px solid ${isAdminUser ? 'rgba(255,209,102,.5)' : c+'88'}`
          }}>
            <span>{isAdminUser ? '⚡' : '✦'}</span>
            <span style={{color: heroColor, letterSpacing:2, fontWeight:900, fontSize:11}}>
              {isAdminUser ? 'ADMINISTRATOR' : 'MEMBER'}
            </span>
            <span>{isAdminUser ? '⚡' : '✦'}</span>
          </div>

          {/* Status */}
          <div className="profile-card-status" style={{color:`${heroColor}99`}}>
            {partner?.status || (isAdminUser ? 'System Administrator' : 'HD Messenger User')}
          </div>

          {/* Online indicator */}
          <div className="profile-card-online">
            <span className={'profile-card-dot' + (partner?.online ? ' online' : '')}/>
            <span style={{color: partner?.online ? '#2dd4a0' : 'var(--muted)', fontSize:12, fontWeight:700}}>
              {partner?.online ? 'Online now' : 'Offline'}
            </span>
          </div>

          {/* Stats */}
          <div className="profile-card-stats" style={{borderColor:`${heroColor}33`, background:`${heroColor}08`}}>
            {isAdminUser ? (
              <>
                <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>∞</span><span className="phs-lbl">Access</span></div>
                <div className="phs-div" style={{background:`${heroColor}33`}}/>
                <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>VIP</span><span className="phs-lbl">Status</span></div>
                <div className="phs-div" style={{background:`${heroColor}33`}}/>
                <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>👑</span><span className="phs-lbl">Admin</span></div>
              </>
            ) : (
              <>
                <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>HD</span><span className="phs-lbl">App</span></div>
                <div className="phs-div" style={{background:`${heroColor}33`}}/>
                <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>⭐</span><span className="phs-lbl">Member</span></div>
                <div className="phs-div" style={{background:`${heroColor}33`}}/>
                <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>🔒</span><span className="phs-lbl">Secure</span></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
