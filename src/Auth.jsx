import { useState } from 'react';
import { api, auth } from './api.js';
import { BRAND } from './ui.jsx';

// Sign in or create an account. Anyone can sign up; every account has its own teams, players and matches.
export default function Auth({ onDone }) {
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ name: '', club: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = mode === 'in' ? await api.login(f.email, f.password) : await api.signup(f);
      auth.set(r.token); onDone(r.user);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="authwrap">
      <div className="authcard">
        <h1 className="title">{BRAND}</h1>
        <p className="sub">Run your cricket club: teams, players, live scoring and stats. Sign in to your own space or create one in a minute.</p>
        <div className="tabs" role="tablist">
          <button className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setErr(''); }}>Sign in</button>
          <button className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setErr(''); }}>Create account</button>
        </div>
        <form className="form" onSubmit={submit}>
          {mode === 'up' && (
            <>
              <label>Your name<input autoFocus required autoComplete="name" value={f.name} onChange={set('name')} /></label>
              <label>Your club / main team name<input required placeholder="e.g. Lalazar Sixers" value={f.club} onChange={set('club')} /></label>
            </>
          )}
          <label>Email<input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></label>
          <label>Password<input type="password" required minLength={mode === 'up' ? 6 : undefined} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} /></label>
          {mode === 'up' && <p className="hint">Your club becomes your Main team. Players you add to any Domestic team are added to it automatically. Your data is private to your account.</p>}
          {err && <p className="err" role="alert">{err}</p>}
          <button className="primary" disabled={busy}>{busy ? 'Please wait' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
      </div>
    </div>
  );
}
