import React, { useState, useEffect } from 'react';
import Avatar from './Avatar.jsx';
import { apiGet, apiPost, apiDelete } from '../utils/api.js';
import { getSocket } from '../utils/socket.js';
import { fmtTime } from '../utils/helpers.js';

export default function ChatList({ token, user, users, setUsers, groups, setGroups,
  activeChat, openChat, onSettings, onLogout, showToast, theme, onToggleTheme }) {

  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('all');
  const [tab,         setTab]         = useState('dms'); // 'dms' | 'groups'
  const [lastMsgs,    setLastMsgs]    = useState({});
  const [showLogout,  setShowLogout]  = useState(false);
  const [showNewGroup,setShowNewGroup]= useState(false);
  const [groupName,   setGroupName]   = useState('');
  const [groupPick,   setGroupPick]   = useState([]);
  const [ctxMenu,     setCtxMenu]     = useState(null); // {uid, x, y}

  useEffect(() => {
    if (!token) return;
    apiGet('/users', token).then(setUsers).catch(()=>showToast('Failed to load users','error'));
    apiGet('/groups', token).then(setGroups).catch(()=>{});
  }, [token]);

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const h = ({from,text}) => setLastMsgs(p=>({...p,[from]:{text,time:new Date().toISOString()}}));
    sock.on('message:notify', h);
    return () => sock.off('message:notify', h);
  }, []);

  // Filter DMs
  const filteredUsers = users.filter(u => {
    const matchName = u.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter==='all' || (filter==='online'?u.online:!u.online);
    return matchName && matchFilter;
  });

  const onlineCount  = users.filter(u=>u.online).length;
  const offlineCount = users.filter(u=>!u.online).length;

  const createGroup = async () => {
    if (!groupName.trim()) { showToast('Group name required','error'); return; }
    if (groupPick.length === 0) { showToast('Add at least one member','error'); return; }
    try {
      const g = await apiPost('/groups', {name:groupName.trim(), memberIds:groupPick}, token);
      setGroups(prev=>[...prev, g]);
      setShowNewGroup(false); setGroupName(''); setGroupPick([]);
      showToast('Group created ✓');
      openChat(g, 'group');
    } catch(e) { showToast(e.message,'error'); }
  };

  const handleMute = async (u, isMuted) => {
    try {
      if (isMuted) await apiDelete(`/users/${u.uid}/mute`, token);
      else await apiPost(`/users/${u.uid}/mute`, {}, token);
      setUsers(prev=>prev.map(x=>x.uid===u.uid?{...x,isMuted:!isMuted}:x));
      showToast(isMuted?'Unmuted':'Muted 🔇');
    } catch(e) { showToast(e.message,'error'); }
    setCtxMenu(null);
  };

  const handleBlock = async (u, isBlocked) => {
    try {
      if (isBlocked) await apiDelete(`/users/${u.uid}/block`, token);
      else await apiPost(`/users/${u.uid}/block`, {}, token);
      setUsers(prev=>prev.map(x=>x.uid===u.uid?{...x,isBlocked:!isBlocked}:x));
      showToast(isBlocked?'Unblocked':'Blocked 🚫');
    } catch(e) { showToast(e.message,'error'); }
    setCtxMenu(null);
  };

  const openCtxMenu = (e, u) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({uid:u.uid, x:e.clientX, y:e.clientY, user:u});
  };

  // Close ctx menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const isActiveChat = (type, id) =>
    activeChat?.type===type && (type==='dm'?activeChat.data?.uid===id:activeChat.data?.gid===id);

  return (
    <div className="chatlist">
      {/* Header */}
      <div className="chatlist-header">
        <span className="chatlist-title">HD MESSENGER</span>
        <div className="chatlist-actions">
          <button className="icon-btn" title={theme==='dark'?'Light mode':'Dark mode'} onClick={onToggleTheme}>
            {theme==='dark'
              ? <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="3.5" stroke="#e8edf5" strokeWidth="1.6"/><path d="M8.5 1v1.5M8.5 14v1.5M1 8.5h1.5M14 8.5h1.5M3.2 3.2l1.1 1.1M12.7 12.7l1.1 1.1M12.7 3.2l-1.1 1.1M3.2 12.7l1.1-1.1" stroke="#e8edf5" strokeWidth="1.6" strokeLinecap="round"/></svg>
              : <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M14 9.5A6 6 0 017 2.5a6.5 6.5 0 100 12 6 6 0 007-5z" stroke="#e8edf5" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            }
          </button>
          <button className="icon-btn" title="Settings" onClick={onSettings}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="8.5" cy="8.5" r="2.5" stroke="#e8edf5" strokeWidth="1.6"/><path d="M8.5 1v2M8.5 14v2M1 8.5h2M14 8.5h2M3.1 3.1l1.4 1.4M12.5 12.5l1.4 1.4M3.1 13.9l1.4-1.4M12.5 4.5l1.4-1.4" stroke="#e8edf5" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
          <button className="icon-btn" title="Log out" onClick={()=>setShowLogout(true)}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M6.5 2.5H3a1 1 0 00-1 1v10a1 1 0 001 1h3.5M11 13l4-4-4-4M15 8.5H6.5" stroke="#e8edf5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* My profile row */}
      <div className="me-row">
        <Avatar name={user?.name} color={user?.avatar_color} size={38} avatarUrl={user?.avatar_url}/>
        <div className="me-info">
          <div className="me-name">{user?.name}</div>
          <div className="me-status">{user?.status||'Hey there!'}</div>
        </div>
        <span className="online-badge">● Online</span>
      </div>

      {/* Tabs: DMs vs Groups */}
      <div className="list-tabs">
        <button className={'list-tab'+(tab==='dms'?' list-tab--active':'')} onClick={()=>setTab('dms')}>
          💬 Chats
        </button>
        <button className={'list-tab'+(tab==='groups'?' list-tab--active':'')} onClick={()=>setTab('groups')}>
          👥 Groups
          {groups.length>0 && <span className="tab-badge">{groups.length}</span>}
        </button>
      </div>

      {tab==='dms' && <>
        {/* Search */}
        <div className="search-bar">
          <div className="search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="#7a8fa6" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="#7a8fa6" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input className="search-input" type="text" placeholder="Search people..."
              value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <button className="search-clear" onClick={()=>setSearch('')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="#7a8fa6" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>}
          </div>
        </div>

        {/* Filter pills */}
        <div className="filter-bar">
          {[{key:'all',label:'All',count:users.length},{key:'online',label:'Online',count:onlineCount},{key:'offline',label:'Offline',count:offlineCount}]
            .map(({key,label,count})=>(
            <button key={key} className={'filter-pill'+(filter===key?' filter-pill--active':'')} onClick={()=>setFilter(key)}>
              {label}<span className="filter-pill-count">{count}</span>
            </button>
          ))}
        </div>

        {/* DM list */}
        <div className="chats-list">
          {!filteredUsers.length && (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <div className="empty-title">{search?'No results':filter!=='all'?`Nobody ${filter}`:'No users'}</div>
              <div className="empty-sub">{search?'Try a different name':filter!=='all'?'Try All filter':'Invite friends!'}</div>
            </div>
          )}
          {filteredUsers.map(u=>(
            <div key={u.uid}
              className={'chat-item'+(isActiveChat('dm',u.uid)?' chat-item--active':'')+(u.isBlocked?' chat-item--blocked':'')}
              onClick={()=>openChat(u,'dm')}
              onContextMenu={e=>openCtxMenu(e,u)}
            >
              <div style={{position:'relative',flexShrink:0}}>
                <Avatar name={u.name} color={u.avatar_color} size={46} avatarUrl={u.avatar_url}/>
                {u.online && <div className="online-dot"/>}
              </div>
              <div className="chat-info">
                <div className="chat-name">
                  {u.name}
                  {u.isMuted   && <span className="badge-muted" title="Muted">🔇</span>}
                  {u.isBlocked && <span className="badge-blocked" title="Blocked">🚫</span>}
                </div>
                <div className="chat-preview">{lastMsgs[u.uid]?.text||u.status||'Tap to chat'}</div>
              </div>
              <div className="chat-meta">
                {lastMsgs[u.uid] && <div className="chat-time">{fmtTime(lastMsgs[u.uid].time)}</div>}
              </div>
            </div>
          ))}
        </div>
      </>}

      {tab==='groups' && <>
        <div className="groups-header-row">
          <span className="groups-label">Your Groups</span>
          <button className="btn-new-group" onClick={()=>setShowNewGroup(true)}>+ New</button>
        </div>
        <div className="chats-list">
          {!groups.length && (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div className="empty-title">No groups yet</div>
              <div className="empty-sub">Create one to chat with multiple people</div>
            </div>
          )}
          {groups.map(g=>(
            <div key={g.gid}
              className={'chat-item'+(isActiveChat('group',g.gid)?' chat-item--active':'')}
              onClick={()=>openChat(g,'group')}
            >
              <div className="group-avatar" style={{background:g.avatar_color||'#7c5cbf'}}>
                {g.name.slice(0,2).toUpperCase()}
              </div>
              <div className="chat-info">
                <div className="chat-name">{g.name}</div>
                <div className="chat-preview">{g.members?.length||0} members</div>
              </div>
            </div>
          ))}
        </div>
      </>}

      {/* Context menu for mute/block */}
      {ctxMenu && (
        <div className="ctx-menu" style={{top:ctxMenu.y, left:Math.min(ctxMenu.x, window.innerWidth-160)}}
          onClick={e=>e.stopPropagation()}>
          <button className="ctx-item" onClick={()=>handleMute(ctxMenu.user, ctxMenu.user.isMuted)}>
            {ctxMenu.user.isMuted?'🔊 Unmute':'🔇 Mute notifications'}
          </button>
          <div className="ctx-divider"/>
          <button className="ctx-item ctx-item--danger" onClick={()=>handleBlock(ctxMenu.user, ctxMenu.user.isBlocked)}>
            {ctxMenu.user.isBlocked?'✅ Unblock':'🚫 Block user'}
          </button>
        </div>
      )}

      {/* New Group modal */}
      {showNewGroup && (
        <div className="dialog-overlay" onClick={()=>setShowNewGroup(false)}>
          <div className="dialog dialog--wide" onClick={e=>e.stopPropagation()}>
            <div className="dialog-title">Create Group</div>
            <div className="dialog-sub" style={{marginBottom:12}}>Name your group and pick members</div>
            <input className="settings-input" placeholder="Group name..." value={groupName}
              onChange={e=>setGroupName(e.target.value)} style={{marginBottom:12}}/>
            <div className="group-member-list">
              {users.filter(u=>!u.isBlocked).map(u=>(
                <label key={u.uid} className="group-member-row">
                  <input type="checkbox" checked={groupPick.includes(u.uid)}
                    onChange={e=>setGroupPick(p=>e.target.checked?[...p,u.uid]:p.filter(x=>x!==u.uid))}/>
                  <Avatar name={u.name} color={u.avatar_color} size={28} avatarUrl={u.avatar_url}/>
                  <span>{u.name}</span>
                </label>
              ))}
            </div>
            <div className="dialog-actions" style={{marginTop:16}}>
              <button className="btn-no" onClick={()=>setShowNewGroup(false)}>Cancel</button>
              <button className="btn-yes" onClick={createGroup}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Logout dialog */}
      {showLogout && (
        <div className="dialog-overlay" onClick={()=>setShowLogout(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <div className="dialog-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M10 5H6a2 2 0 00-2 2v12a2 2 0 002 2h4M17 18l5-5-5-5M22 13H10" stroke="#ff6b35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div className="dialog-title">Log out?</div>
            <div className="dialog-sub">You'll need to sign in again.</div>
            <div className="dialog-actions">
              <button className="btn-no" onClick={()=>setShowLogout(false)}>Cancel</button>
              <button className="btn-yes" onClick={()=>{setShowLogout(false);onLogout();}}>Log Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
