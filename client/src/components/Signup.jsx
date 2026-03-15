import React, { useState } from 'react';
import { apiPost } from '../utils/api.js';

export default function Signup({ onLogin, showToast, goTo }) {
  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password || !form.confirm) {
      showToast('Fill all fields', 'error'); return;
    }
    if (form.password !== form.confirm) { showToast("Passwords don't match", 'error'); return; }
    if (form.password.length < 6) { showToast('Password min 6 chars', 'error'); return; }
    setLoading(true);
    try {
      const data = await apiPost('/register', { name: form.name, email: form.email, password: form.password });
      onLogin(data);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { k: 'name',     label: 'Full Name',       type: 'text',     ph: 'Your full name' },
    { k: 'email',    label: 'Email',            type: 'email',    ph: 'your@email.com' },
    { k: 'password', label: 'Password',         type: 'password', ph: 'Min 6 characters' },
    { k: 'confirm',  label: 'Confirm Password', type: 'password', ph: 'Repeat password' },
  ];

  return (
    <div className="auth-card">
      <div className="auth-card-header" style={{ paddingBottom: 20 }}>
        <div className="logo-mark"><span>H</span><span>D</span></div>
        <div className="auth-card-title">Create Account</div>
        <div className="auth-card-sub">Join HD Messenger today</div>
      </div>
      <div className="auth-card-body">
        {fields.map(({ k, label, type, ph }) => (
          <div className="field" key={k}>
            <label className="field-label">{label}</label>
            <input className="field-input" type={type} placeholder={ph}
              value={form[k]} onChange={e => set(k, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignup()} />
          </div>
        ))}
        <button className="btn-primary" onClick={handleSignup} disabled={loading}>
          {loading ? <span className="spinner"/> : 'Create Account'}
        </button>
        <p className="form-link">
          Have an account?{' '}
          <a onClick={goTo}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
