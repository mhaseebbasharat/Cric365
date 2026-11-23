import { useState } from 'react';
import { api } from './api.js';
import TeamLogo from './TeamLogo.jsx';
import { ScoreCard } from './Dashboard.jsx';
import { Empty, Tag, teamOf } from './ui.jsx';


function Table({ rows, teams }) {
  if (!rows || rows.length === 0) return <Empty>No teams yet.</Empty>;
  return (
    <div className="scroll"><table className="tbl">
      <thead><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NRR</th><th>Pts</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={r.team}>
          <td><span className="tm"><span className="pos">{i + 1}</span><TeamLogo team={teamOf(teams, r.team)} size={22} />{r.team}</span></td>
          <td>{r.played}</td><td>{r.won}</td><td>{r.lost}</td><td>{r.tied}</td>
          <td>{r.nrr > 0 ? '+' : ''}{r.nrr.toFixed(3)}</td><td><b>{r.points}</b></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

function TeamPick({ options, picked, onChange }) {
  const toggle = (n) => onChange(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]);
  return (
    <fieldset className="checks">
      <legend>Teams taking part ({picked.length} chosen)</legend>
      {options.length === 0 && <p className="hint">No teams yet. Add them on the Teams page first.</p>}
      {options.map((t) => <label key={t._id} className="check"><input type="checkbox" checked={picked.includes(t.name)} onChange={() => toggle(t.name)} /><TeamLogo team={t} size={20} />{t.name} <Tag tag={t.tag} /></label>)}
    </fieldset>
  );
}

export default function Tournaments({ data, run, admin, openMatch }) {
  const { tournaments, tables, matches, teams } = data;
  const [f, setF] = useState({ name: '', kind: 'Open', overs: 20, teams: [] });
  const [edit, setEdit] = useState(null);   // { id, teams }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const groups = [['Your tournaments', null, 'Any of your teams can take part in any tournament.']];
  const friendly = matches.filter((m) => !m.tournament);

  return (
    <>
      <div className="ph"><div><h1 className="title">Tournaments</h1><p className="sub">Points table: 2 points for a win, 1 for a tie. Ties on points go to net run rate.</p></div></div>
      {groups.map(([title, kind, note]) => (
        <section key={title} className="sec">
          <h2>{title}</h2>
          <p className="hint">{note}</p>
          {tournaments.length === 0 && <Empty>No tournaments yet. Add one below.</Empty>}
          {tournaments.map((t) => {
            const list = matches.filter((m) => m.tournament === t.name);
            const live = list.filter((m) => m.status === 'live').length;
            const editing = edit && edit.id === t._id;
            return (
              <article key={t._id} className="tcard">
                <div className="tcard-h">
                  <h3>{t.name}<span className="badge">{t.kind}</span>{live > 0 && <span className="badge live"><i className="dot" />{live} live</span>}</h3>
                  <span className="hint">{t.teams.length} teams, {list.length} matches, {t.overs} overs</span>
                  {admin && <button className="ghost" onClick={() => setEdit(editing ? null : { id: t._id, teams: t.teams })}>{editing ? 'Cancel' : 'Edit teams'}</button>}
                  {admin && <button className="danger" onClick={() => window.confirm(`Remove ${t.name}?`) && run(() => api.removeTournament(t._id))}>Remove</button>}
                </div>
                {editing && (
                  <div className="form">
                    <TeamPick options={teams} picked={edit.teams} onChange={(x) => setEdit({ ...edit, teams: x })} />
                    <button className="primary" disabled={edit.teams.length < 2} onClick={() => run(() => api.setTournamentTeams(t._id, edit.teams)).then((ok) => ok && setEdit(null))}>Save teams</button>
                  </div>
                )}
                {t.teams.length === 0 && <p className="hint">No teams added yet. Use Edit teams to add them.</p>}
                <Table rows={tables[t.name]} teams={teams} />
                {list.length > 0 && <div className="mgrid">{list.slice(0, 6).map((m) => <ScoreCard key={m._id} m={m} teams={teams} onOpen={openMatch} />)}</div>}
              </article>
            );
          })}
        </section>
      ))}

      <section className="sec">
        <h2>Friendly matches</h2>
        <p className="hint">Matches between your teams that are not part of a tournament.</p>
        <article className="tcard">
          <Table rows={tables.__friendly} teams={teams} />
          {friendly.length > 0 && <div className="mgrid">{friendly.slice(0, 6).map((m) => <ScoreCard key={m._id} m={m} teams={teams} onOpen={openMatch} />)}</div>}
        </article>
      </section>

      {admin && (
        <form className="sec form" onSubmit={(e) => { e.preventDefault(); run(() => api.addTournament({ ...f, overs: Number(f.overs) || 20 })).then((ok) => ok && setF({ ...f, name: '', teams: [] })); }}>
          <h2>Add a tournament</h2>
          <div className="row">
            <label>Name<input required value={f.name} onChange={set('name')} /></label>
            <label>Type<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="Domestic">Domestic</option><option value="Open">Open</option></select></label>
            <label>Overs per side<input type="number" min="1" max="50" value={f.overs} onChange={set('overs')} /></label>
          </div>
          <TeamPick options={teams} picked={f.teams} onChange={(x) => setF({ ...f, teams: x })} />
          <button className="primary" disabled={f.teams.length < 2}>Add tournament</button>
        </form>
      )}
    </>
  );
}
