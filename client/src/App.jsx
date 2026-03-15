import React, { useState, useEffect, useCallback } from 'react';
import Login    from './components/Login.jsx';
import Signup   from './components/Signup.jsx';
import ChatList from './components/ChatList.jsx';
import ChatView from './components/ChatView.jsx';
import Settings from './components/Settings.jsx';
import Toast    from './components/Toast.jsx';
import { CallModal, IncomingCallPopup, useCallManager } from './components/CallModal.jsx';
import { connectSocket, disconnectSocket } from './utils/socket.js';
import { requestNotificationPermission, notifyMessage } from './utils/notifications.js';
import { getTheme, toggleTheme, applyTheme } from './utils/theme.js';

export default function App() {
  const [authView,       setAuthView]       = useState('login');
  const [user,           setUser]           = useState(null);
  const [token,          setToken]          = useState(null);
  const [loginKey,       setLoginKey]       = useState(0);   // increments on every login to force socket reconnect
  const [users,          setUsers]          = useState([]);
  const [groups,         setGroups]         = useState([]);
  const [activeChat,     setActiveChat]     = useState(null);
  const [showSettings,   setShowSettings]   = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [toast,          setToast]          = useState({ msg: '', type: 'success' });
  const [sock,           setSock]           = useState(null);
  const [theme,          setThemeState]     = useState(getTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Restore session on page load
  useEffect(() => {
    try {
      const t = localStorage.getItem('hd_token');
      const u = localStorage.getItem('hd_user');
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
        setLoginKey(k => k + 1); // trigger socket connect
      }
    } catch {}
  }, []);

  // Connect socket — re-runs on every login (loginKey changes)
  useEffect(() => {
    if (!token) return;
    const s = connectSocket(token);
    setSock(s);

    s.on('user:online', ({ uid, online }) =>
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, online } : u)));

    s.on('message:notify', ({ from, fromName, text }) =>
      notifyMessage(fromName, text));

    return () => {
      s.off('user:online');
      s.off('message:notify');
    };
  }, [loginKey]); // <-- loginKey, NOT token. Forces reconnect on every login

  const callMgr = useCallManager(sock, user, users);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  }, []);

  const onLogin = useCallback((data) => {
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('hd_token', data.token);
    localStorage.setItem('hd_user', JSON.stringify(data.user));
    setLoginKey(k => k + 1); // always force socket reconnect, even for same account
    requestNotificationPermission();
  }, []);

  const onLogout = useCallback(() => {
    disconnectSocket();
    localStorage.removeItem('hd_token');
    localStorage.removeItem('hd_user');
    setUser(null); setToken(null); setSock(null);
    setUsers([]); setGroups([]); setActiveChat(null);
    setShowSettings(false); setAuthView('login');
  }, []);

  const openChat = useCallback((data, type = 'dm') => {
    setActiveChat({ type, data });
    setShowMobileChat(true);
  }, []);

  const handleSetUser = useCallback((updated) => {
    setUser(updated);
    localStorage.setItem('hd_user', JSON.stringify(updated));
  }, []);

  const handleToggleTheme = () => setThemeState(toggleTheme());

  if (!user || !token) return (
    <div className="auth-page">
      <div className="auth-bg-blob b1"/><div className="auth-bg-blob b2"/><div className="auth-bg-blob b3"/>
      {authView === 'login'
        ? <Login  onLogin={onLogin} showToast={showToast} goTo={() => setAuthView('signup')}/>
        : <Signup onLogin={onLogin} showToast={showToast} goTo={() => setAuthView('login')}/>
      }
      <Toast msg={toast.msg} type={toast.type}/>
    </div>
  );

  return (
    <div className="app">
      <aside className={'sidebar' + (showMobileChat ? ' sidebar--mobile-hidden' : '')}>
        <ChatList
          token={token} user={user} users={users} setUsers={setUsers}
          groups={groups} setGroups={setGroups}
          activeChat={activeChat} openChat={openChat}
          onSettings={() => setShowSettings(true)}
          onLogout={onLogout} showToast={showToast}
          theme={theme} onToggleTheme={handleToggleTheme}
        />
      </aside>
      <main className={'main-area' + (!showMobileChat ? ' main-area--mobile-hidden' : '')}>
        {activeChat
          ? <ChatView
              token={token} user={user} users={users}
              activeChat={activeChat}
              onBack={() => setShowMobileChat(false)}
              showToast={showToast}
              onStartCall={callMgr.startCall}
              onUpdateUsers={setUsers}
            />
          : <WelcomeScreen user={user}/>
        }
      </main>

      {showSettings && (
        <Settings token={token} user={user} setUser={handleSetUser}
          onClose={() => setShowSettings(false)} onLogout={onLogout} showToast={showToast}/>
      )}

      <IncomingCallPopup call={callMgr.incomingCall} onAnswer={callMgr.answerCall} onReject={callMgr.rejectCall}/>
      {callMgr.activeCall && (
        <CallModal call={callMgr.activeCall} onEnd={callMgr.endCall}
          localVidRef={callMgr.localVidRef} remoteVidRef={callMgr.remoteVidRef}
          localStream={callMgr.localStream}/>
      )}
      <Toast msg={toast.msg} type={toast.type}/>
    </div>
  );
}

function WelcomeScreen({ user }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-logo"><span>H</span><span>D</span></div>
      <div className="welcome-title">Welcome, {user?.name?.split(' ')[0]}!</div>
      <div className="welcome-sub">Select a conversation or group from the sidebar.</div>
    </div>
  );
}
