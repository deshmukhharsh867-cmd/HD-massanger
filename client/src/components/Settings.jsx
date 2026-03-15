import React, { useState, useRef } from 'react';
import Avatar from './Avatar.jsx';
import { apiPut, apiPost } from '../utils/api.js';
import { requestNotificationPermission, getNotificationPermission } from '../utils/notifications.js';

const isAdmin = (user) =>
  user?.name?.toLowerCase() === 'admin' && user?.email === 'admin@admin.com';

export default function Settings({ token, user, setUser, onClose, onLogout, showToast }) {
  const [name,         setName]         = useState(user?.name || '');
  const [status,       setStatus]       = useState(user?.status || '');
  const [loading,      setLoading]      = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [showLogout,   setShowLogout]   = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const admin = isAdmin(user);
  const c = user?.avatar_color || '#7c5cbf'; // user's personal color

  const save = async () => {
    if (!name.trim()) { showToast('Name required', 'error'); return; }
    setLoading(true);
    try {
      const updated = await apiPut('/profile', { name: name.trim(), status: status.trim() }, token);
      setUser(updated); showToast('Profile saved ✓');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Only images allowed', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Max 5 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setPhotoLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const updated = await apiPost('/profile/photo', { data: base64, mimeType: file.type }, token);
      setUser(updated); setPhotoPreview(null); showToast('Photo updated ✓');
    } catch (e) { setPhotoPreview(null); showToast(e.message || 'Upload failed', 'error'); }
    finally { setPhotoLoading(false); e.target.value = ''; }
  };

  const currentAvatar = photoPreview || user?.avatar_url || null;

  // Colors for styling — gold for admin, user's color for others
  const heroColor  = admin ? '#ffd166' : c;
  const heroBg     = admin ? 'linear-gradient(180deg,#1a1200 0%,#0f0a00 70%,transparent 100%)'
                           : `linear-gradient(180deg,${c}28 0%,${c}0a 70%,transparent 100%)`;
  const ringBg     = admin ? 'linear-gradient(135deg,#ffd166,#ffaa00,#ff6b35,#ffd166)'
                           : `linear-gradient(135deg,${c},#ffffff88,${c})`;
  const ringGlow   = admin ? `0 0 24px rgba(255,209,102,.6),0 0 48px rgba(255,170,0,.25)`
                           : `0 0 20px ${c}88,0 0 40px ${c}44`;
  const innerBg    = admin ? '#0f0a00' : 'var(--navy1)';
  const badgeBg    = admin ? 'linear-gradient(90deg,rgba(255,209,102,.15),rgba(255,170,0,.2),rgba(255,209,102,.15))'
                           : `linear-gradient(90deg,${c}22,${c}33,${c}22)`;
  const badgeBorder= admin ? 'rgba(255,209,102,.5)' : `${c}88`;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="settings-header" style={{
          background: admin ? 'linear-gradient(135deg,#1a1200,#2a1f00)' : `linear-gradient(135deg,${c}22,${c}0a)`,
          borderBottom: `1.5px solid ${admin ? 'rgba(255,209,102,.3)' : c+'44'}`
        }}>
          <span className="settings-title shine-text" style={{
            '--shine-color': heroColor,
          }}>
            {admin ? '👑 Admin Profile' : '✨ My Profile'}
          </span>
          <button className="icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="#e8edf5" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* ── Profile Hero (ALL users get this) ── */}
        <div className="profile-hero" style={{background: heroBg}}>
          <div className="profile-hero-glow" style={{background:`radial-gradient(circle,${heroColor}33 0%,transparent 70%)`}}/>

          {/* Icon — crown for admin, star for users */}
          <div className="profile-hero-topicon" style={{filter:`drop-shadow(0 0 10px ${heroColor}99)`}}>
            {admin ? '👑' : '⭐'}
          </div>

          {/* Avatar ring */}
          <div className="profile-hero-avatar-wrap" onClick={()=>fileInputRef.current?.click()} title="Tap to change photo">
            <div className="profile-ring-outer" style={{background:ringBg, boxShadow:ringGlow}}>
              <div style={{padding:3,borderRadius:'50%',background:innerBg}}>
                <Avatar name={user?.name} color={c} size={88} avatarUrl={currentAvatar}/>
              </div>
            </div>
            <div className="avatar-change-overlay">
              {photoLoading
                ? <span className="spinner" style={{width:18,height:18}}/>
                : <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2a2 2 0 012 2v.5h2.5A1.5 1.5 0 0115 6v8a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 14V6a1.5 1.5 0 011.5-1.5H7V4a2 2 0 012-2z" stroke="white" strokeWidth="1.4"/><circle cx="9" cy="10" r="2.2" stroke="white" strokeWidth="1.4"/></svg>
              }
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePhotoChange}/>

          {/* Name */}
          <div className="profile-hero-name shine-text" style={{'--shine-color': heroColor}}>
            {user?.name}
          </div>

          {/* Badge — ADMINISTRATOR for admin, MEMBER for others */}
          <div className="profile-hero-badge" style={{background:badgeBg, border:`1px solid ${badgeBorder}`}}>
            <span>{admin ? '⚡' : '✦'}</span>
            <span style={{color: heroColor}}>{admin ? 'ADMINISTRATOR' : 'MEMBER'}</span>
            <span>{admin ? '⚡' : '✦'}</span>
          </div>

          <div className="profile-hero-email" style={{color:`${heroColor}88`}}>{user?.email}</div>
          <div className="profile-hero-status" style={{color:`${heroColor}bb`}}>{user?.status || (admin ? 'System Administrator' : 'HD Messenger User')}</div>

          {/* Stats */}
          <div className="profile-hero-stats" style={{borderColor:`${heroColor}33`,background:`${heroColor}08`}}>
            {admin
              ? <>
                  <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>∞</span><span className="phs-lbl">Access</span></div>
                  <div className="phs-div" style={{background:`${heroColor}33`}}/>
                  <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>VIP</span><span className="phs-lbl">Status</span></div>
                  <div className="phs-div" style={{background:`${heroColor}33`}}/>
                  <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>👑</span><span className="phs-lbl">Admin</span></div>
                </>
              : <>
                  <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>HD</span><span className="phs-lbl">App</span></div>
                  <div className="phs-div" style={{background:`${heroColor}33`}}/>
                  <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>⭐</span><span className="phs-lbl">Member</span></div>
                  <div className="phs-div" style={{background:`${heroColor}33`}}/>
                  <div className="phs-item"><span className="phs-val" style={{color:heroColor}}>🔒</span><span className="phs-lbl">Secure</span></div>
                </>
            }
          </div>
          <div className="avatar-hint" style={{color:`${heroColor}66`,marginTop:8}}>Tap photo to change</div>
        </div>

        {/* Edit fields */}
        <div className="settings-body">
          <div className="settings-section-title">Edit Profile</div>
          <div className="settings-field">
            <label className="field-label">Display Name</label>
            <input className="settings-input" style={{'--focus-color':heroColor}} type="text"
              value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
          </div>
          <div className="settings-field">
            <label className="field-label">Status Message</label>
            <input className="settings-input" style={{'--focus-color':heroColor}} type="text"
              value={status} onChange={e=>setStatus(e.target.value)} placeholder="What's on your mind?"/>
          </div>
          <button className="btn-save" style={{
            background:`linear-gradient(135deg,${heroColor},${admin?'#ffaa00':c+'cc'})`,
            color: admin ? '#1a0f00' : '#fff',
            boxShadow:`0 4px 20px ${heroColor}55`
          }} onClick={save} disabled={loading}>
            {loading ? <span className="spinner"/> : admin ? '👑 Save Changes' : '✨ Save Changes'}
          </button>

          <div className="settings-section-title" style={{marginTop:20}}>Notifications & Account</div>
          <NotificationRow showToast={showToast}/>

          <div className="settings-row" style={{opacity:.6,cursor:'default'}}>
            <div className="settings-row-icon" style={{background:'rgba(45,212,160,.15)'}}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#2dd4a0" strokeWidth="1.8"/><path d="M9 6v3l2 2" stroke="#2dd4a0" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <div>
              <div className="settings-row-label">Version</div>
              <div className="settings-row-sub">HD Messenger v3.0 — Node.js + React</div>
            </div>
          </div>

          {/* Admin only — DB panel */}
          {admin && (
            <div className="settings-row settings-row--vip" onClick={()=>window.open('/admin?key=hd_admin_2025','_blank')}>
              <div className="settings-row-icon" style={{background:'rgba(255,209,102,.15)'}}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="2" stroke="#ffd166" strokeWidth="1.8"/><path d="M2 7h14M6 3v4M12 3v4" stroke="#ffd166" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div className="settings-row-label" style={{color:'#ffd166'}}>👑 Database Admin</div>
                <div className="settings-row-sub">View users, messages & data ↗</div>
              </div>
              <span style={{marginLeft:'auto',color:'#ffd166',fontWeight:900}}>→</span>
            </div>
          )}

          <div className="settings-row" onClick={()=>setShowLogout(true)}>
            <div className="settings-row-icon" style={{background:'rgba(232,67,147,.15)'}}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 3H3a1 1 0 00-1 1v10a1 1 0 001 1h4M12 13l4-4-4-4M16 9H7" stroke="#e84393" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div className="settings-row-label" style={{color:'var(--pink)'}}>Log Out</div>
              <div className="settings-row-sub">Sign out of your account</div>
            </div>
          </div>
        </div>
      </div>

      {showLogout && (
        <div className="dialog-overlay" onClick={()=>setShowLogout(false)}>
          <div className="dialog" onClick={e=>e.stopPropagation()}>
            <div className="dialog-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M10 5H6a2 2 0 00-2 2v12a2 2 0 002 2h4M17 18l5-5-5-5M22 13H10" stroke="#ff6b35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="dialog-title">Log out?</div>
            <div className="dialog-sub">You'll be returned to the login screen.</div>
            <div className="dialog-actions">
              <button className="btn-no" onClick={()=>setShowLogout(false)}>Cancel</button>
              <button className="btn-yes" onClick={()=>{setShowLogout(false);onClose();onLogout();}}>Log Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ showToast }) {
  const [perm, setPerm] = useState(getNotificationPermission());
  const handleToggle = async () => {
    if (perm==='granted'){showToast('Disable in browser site settings','error');return;}
    if (perm==='denied') {showToast('Blocked — enable in browser settings','error');return;}
    await requestNotificationPermission();
    setPerm(getNotificationPermission());
    if (getNotificationPermission()==='granted') showToast('Notifications enabled ✓');
    else showToast('Not granted','error');
  };
  const label = perm==='granted'?'Enabled':perm==='denied'?'Blocked':'Click to enable';
  const color = perm==='granted'?'var(--green)':perm==='denied'?'var(--pink)':'var(--muted)';
  return (
    <div className="settings-row" onClick={handleToggle} style={{cursor:perm==='granted'?'default':'pointer'}}>
      <div className="settings-row-icon" style={{background:perm==='granted'?'rgba(45,212,160,.15)':'rgba(255,107,53,.15)'}}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2a5 5 0 00-5 5v3l-1.5 2.5h13L14 10V7a5 5 0 00-5-5z" stroke={perm==='granted'?'#2dd4a0':'#ff6b35'} strokeWidth="1.6"/>
          <path d="M7 14.5a2 2 0 004 0" stroke={perm==='granted'?'#2dd4a0':'#ff6b35'} strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div className="settings-row-label">Push Notifications</div>
        <div className="settings-row-sub" style={{color}}>{label}</div>
      </div>
      {perm!=='denied' && (
        <div className={'notif-toggle'+(perm==='granted'?' notif-toggle--on':'')}><div className="notif-thumb"/></div>
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file);
  });
}
