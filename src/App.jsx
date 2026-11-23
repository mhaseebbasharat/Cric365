import { useCallback, useEffect, useState } from 'react';
import { api, auth } from './api.js';
import TeamLogo from './TeamLogo.jsx';
import Dashboard from './Dashboard.jsx';
import Squad from './Squad.jsx';
import Matches from './Matches.jsx';
import Teams from './Teams.jsx';
import Tournaments from './Tournaments.jsx';
import Auth from './Auth.jsx';
import { mainTeam, BRAND } from './ui.jsx';

const TABS = [['dash', 'Home'], ['squad', 'Players'], ['matches', 'Matches'], ['tournaments', 'Tournaments'], ['teams', 'Teams']];
const EMPTY = { players: [], teams: [], tournaments: [], tables: {}, matches: [], stats: {} };

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!auth.get());
  const [data, setData] = useState(EMPTY);
  const [live, setLive] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('dash');
  const [openId, setOpenId] = useState(null);

  // Restore a saved sign-in
  useEffect(() => {
    if (auth.get()) api.me().then((r) => setUser(r.user)).catch(() => auth.clear()).finally(() => setChecking(false));
    const out = () => { setUser(null); setData(EMPTY); setMsg(''); };
    window.addEventListener('c365-signout', out);
    return () => window.removeEventListener('c365-signout', out);
  }, []);

  const load = useCallback(async () => {
    try {
      const [players, teams, tournaments, tables, matches, stats] = await Promise.all([api.players(), api.teams(), api.tournaments(), api.tables(), api.matches(), api.stats()]);
      setData({ players, teams, tournaments, tables, matches, stats });
    } catch (e) { if (auth.get()) setMsg('Could not load your data from this device. Close and reopen the app.'); }
  }, []);

  // Real time: the server pushes an "update" event whenever something in YOUR account changes
  useEffect(() => {
    if (!user) return;
    load();
    setLive(true);
    const off = api.subscribe(load);
    return () => off();
  }, [user, load]);

  const run = async (fn) => {
    try { await fn(); setMsg(''); await load(); return true; }
    catch (e) { setMsg(e.message); return false; }
  };
  const go = (t) => { setTab(t); setOpenId(null); };
  const openMatch = (id) => { setTab('matches'); setOpenId(id); };
  const signOut = () => { auth.clear(); setUser(null); setData(EMPTY); setTab('dash'); setOpenId(null); };
  const liveCount = data.matches.filter((m) => m.status === 'live').length;

  if (checking) return null;
  if (!user) return <Auth onDone={(u) => { setUser(u); setMsg(''); }} />;

  const main = mainTeam(data.teams);
  // You always own your own data, so every screen can edit (admin is always true once signed in).
  const admin = true;
  return (
    <>
      <header className="bar">
        <div className="bar-in">
          <button className="brand" onClick={() => go('dash')}><TeamLogo team={main} size={34} /><span>{BRAND}</span></button>
          <nav aria-label="Main">
            {TABS.map(([k, l]) => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{l}{k === 'matches' && liveCount > 0 && <i className="dot" title={`${liveCount} live`} />}</button>
            ))}
          </nav>
          <div className="bar-right">
            <span className={`sync ${live ? 'ok' : ''}`}><i />{live ? 'Live' : 'Offline'}</span>
            <span className="who" title={user.email}>{user.name}</span>
            <button className="ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      {msg && <div className="alert" role="alert"><span>{msg}</span><button className="ghost" onClick={() => setMsg('')}>Dismiss</button></div>}
      <main className="wrap">
        {tab === 'dash' && <Dashboard data={data} openMatch={openMatch} run={run} />}
        {tab === 'squad' && <Squad data={data} run={run} admin={admin} />}
        {tab === 'matches' && <Matches data={data} run={run} admin={admin} openId={openId} setOpenId={setOpenId} />}
        {tab === 'tournaments' && <Tournaments data={data} run={run} admin={admin} openMatch={openMatch} />}
        {tab === 'teams' && <Teams data={data} run={run} admin={admin} />}
      </main>
      <footer className="foot"><span>{BRAND} &middot; {user.club}</span></footer>
    </>
  );
}
