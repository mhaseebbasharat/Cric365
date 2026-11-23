import { useState } from 'react';
import { api } from './api.js';
import { Modal, Empty, isActive } from './ui.jsx';
import { ScoreCard } from './Dashboard.jsx';
import Scorer from './Scorer.jsx';

const STAGES = ['League', 'Quarter-final', 'Semi-final', 'Final', 'Third place'];

export default function Matches({ data, run, admin, openId, setOpenId }) {
  const { matches, teams, players, tournaments } = data;
  const [creating, setCreating] = useState(false);
  const [tn, setTn] = useState('all');
  const open = matches.find((m) => m._id === openId);
  if (open) return <Scorer key={open._id} match={open} players={players} teams={teams} run={run} admin={admin} back={() => setOpenId(null)} />;

  const shown = matches.filter((m) => tn === 'all' || (tn === '__friendly' ? !m.tournament : m.tournament === tn));
  const groups = [['Live now', 'live'], ['Scheduled', 'scheduled'], ['Completed', 'completed']];
  return (
    <>
      <div className="ph">
        <div><h1 className="title">Matches</h1><p className="sub">Scores update live as they are recorded.</p></div>
        {admin && <button className="primary" onClick={() => setCreating(true)}>New match</button>}
      </div>
      <div className="filters">
        <label>Show
          <select value={tn} onChange={(e) => setTn(e.target.value)}>
            <option value="all">All matches</option>
            <option value="__friendly">Friendly matches</option>
            {tournaments.map((t) => <option key={t._id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      {shown.length === 0 && <Empty>{admin ? 'No matches yet. Create one, start it, then score ball by ball.' : 'No matches have been played yet.'}</Empty>}
      {groups.map(([title, status]) => {
        const list = shown.filter((m) => m.status === status);
        return list.length > 0 && (
          <section key={status} className="sec"><h2>{title}</h2>
            <div className="mgrid">{list.map((m) => <ScoreCard key={m._id} m={m} teams={teams} onOpen={setOpenId} />)}</div>
          </section>
        );
      })}
      {creating && <Modal title="New match" onClose={() => setCreating(false)}><NewMatch tournaments={tournaments} teams={teams} players={players.filter(isActive)} onSave={(d) => run(() => api.createMatch(d)).then((ok) => ok && setCreating(false))} /></Modal>}
    </>
  );
}

function NewMatch({ tournaments, teams, players, onSave }) {
  const [tn, setTn] = useState('');   // empty = a domestic match, not part of a tournament
  const t = tournaments.find((x) => x.name === tn) || null;
  // Friendly match: any two of your teams. Tournament: only the teams taking part in it.
  const list = teams.filter((x) => !t || !t.teams?.length || t.teams.includes(x.name));
  const [a, setA] = useState(''), [b, setB] = useState('');
  const [stage, setStage] = useState('League');
  const [overs, setOvers] = useState('');
  const [toss, setToss] = useState('A'), [decision, setDecision] = useState('bat');
  const [xi, setXi] = useState({});
  const teamA = list.some((x) => x.name === a) ? a : list[0]?.name || '';
  const teamB = list.some((x) => x.name === b) && b !== teamA ? b : list.find((x) => x.name !== teamA)?.name || '';
  const pool = (n) => players.filter((p) => p.teams.includes(n)).sort((p, q) => (p.jerseyNo || 99) - (q.jerseyNo || 99));
  // One person cannot play for both sides, so by default team B skips anyone already picked for team A.
  const chosen = (n) => xi[n] ?? pool(n).filter((p) => n === teamA || !chosen(teamA).includes(p._id)).slice(0, 11).map((p) => p._id);
  const taken = (n, id) => chosen(n === teamA ? teamB : teamA).includes(id);
  const toggle = (n, id) => { const cur = chosen(n); setXi({ ...xi, [n]: cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 11 ? [...cur, id] : cur }); };
  const ready = teamA && teamB && teamA !== teamB && chosen(teamA).length >= 2 && chosen(teamB).length >= 2;

  const picker = (n) => (
    <fieldset className="checks xi">
      <legend>{n}: playing XI ({chosen(n).length}/11)</legend>
      {pool(n).length === 0 && <p className="hint">This team has no players yet.</p>}
      {pool(n).map((p) => (
        <label key={p._id} className="check"><input type="checkbox" checked={chosen(n).includes(p._id)} disabled={taken(n, p._id)} onChange={() => toggle(n, p._id)} />{p.jerseyNo ? `#${p.jerseyNo} ` : ''}{p.name}<small>{taken(n, p._id) ? 'playing for the other team' : p.role}</small></label>
      ))}
    </fieldset>
  );

  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      onSave({ tournament: tn, stage: t ? stage : 'Friendly', teamA, teamB, overs: overs === '' ? t?.overs || 20 : overs, tossWinner: toss === 'A' ? teamA : teamB, decision, playersA: chosen(teamA), playersB: chosen(teamB) });
    }}>
      <div className="row">
        <label>Match type<select value={tn} onChange={(e) => { setTn(e.target.value); setA(''); setB(''); setOvers(''); setXi({}); }}>
          <option value="">Friendly match (no tournament)</option>
          {tournaments.map((x) => <option key={x._id} value={x.name}>Tournament: {x.name}</option>)}
        </select></label>
        {t && <label>Stage<select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></label>}
      </div>
      <p className="hint">{!t ? 'Friendly match between any two of your teams. It counts in the Friendly matches table.' : t.teams?.length ? `Only the ${t.teams.length} teams taking part in ${t.name} can play. Add more teams from the Tournaments page.` : 'No teams are registered for this tournament yet, so any eligible team can play.'}</p>
      <div className="row">
        <label>Team A<select value={teamA} onChange={(e) => setA(e.target.value)}>{list.map((x) => <option key={x._id}>{x.name}</option>)}</select></label>
        <label>Team B<select value={teamB} onChange={(e) => setB(e.target.value)}>{list.filter((x) => x.name !== teamA).map((x) => <option key={x._id}>{x.name}</option>)}</select></label>
        <label>Overs<input type="number" min="1" max="50" value={overs === '' ? t?.overs || 20 : overs} onChange={(e) => setOvers(e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Toss won by<select value={toss} onChange={(e) => setToss(e.target.value)}><option value="A">{teamA}</option><option value="B">{teamB}</option></select></label>
        <label>Chose to<select value={decision} onChange={(e) => setDecision(e.target.value)}><option value="bat">Bat first</option><option value="bowl">Bowl first</option></select></label>
      </div>
      {teamA && teamB && <div className="two">{picker(teamA)}{picker(teamB)}</div>}
      <button className="primary" disabled={!ready}>Create match</button>
    </form>
  );
}
