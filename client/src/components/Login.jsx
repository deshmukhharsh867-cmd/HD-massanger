import React, { useState } from 'react';
import { apiPost } from '../utils/api.js';

export default function Login({ onLogin, showToast, goTo }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { showToast('Fill all fields', 'error'); return; }
    setLoading(true);
    try {
      const data = await apiPost('/login', { email, password });
      onLogin(data);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <div className="logo-mark"><span>H</span><span>D</span></div>
        <div className="auth-card-title">Welcome Back</div>
        <div className="auth-card-sub">Sign in to your account</div>
      </div>
      <div className="auth-card-body">
        <div className="field">
          <label className="field-label">Email</label>
          <input className="field-input" type="email" placeholder="your@email.com"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <div className="field">
          <label className="field-label">Password</label>
          <input className="field-input" type="password" placeholder="Your password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <button className="btn-primary" onClick={handleLogin} disabled={loading}>
          {loading ? <span className="spinner"/> : 'Sign In'}
        </button>
        <p className="form-link">
          No account?{' '}
          <a onClick={goTo}>Create one</a>
        </p>
      </div>
    </div>
  );
}
