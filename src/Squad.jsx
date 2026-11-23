import { useRef, useState } from 'react';
import { api } from './api.js';
import PlayerArt from './PlayerArt.jsx';
import TeamLogo from './TeamLogo.jsx';
import Cropper from './Cropper.jsx';
import { Modal, Empty, Kpi, Tag, ROLES, fmt, sum, teamOf, plural, homeTeam, isActive, mainTeam } from './ui.jsx';

function PlayerCard({ p, team, s = {}, admin, onTeams, onRemove, onPhoto }) {
  const file = useRef();
  const lead = p.role === 'Captain' || p.role === 'Vice Captain';
  return (
    <article className="pcard">
      {p.imageUrl ? <img src={p.imageUrl} width="250" height="500" alt={p.name} /> : <PlayerArt team={team} number={p.jerseyNo || ''} />}
      <div className="shade" />
      {lead && <span className="lead-badge" title={p.role}>{p.role === 'Captain' ? 'C' : 'VC'}</span>}
      {admin && (
        <div className="ptools">
          <button onClick={() => file.current.click()}>Photo</button>
          <button onClick={onTeams}>Teams</button>
          <button onClick={onRemove}>Remove</button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onPhoto(e.target.files[0])} />
        </div>
      )}
      <div className="pmeta">
        <h3>{p.name}</h3>
        <p className="role">{p.role}</p>
        <p className="teams">{p.teams.join(', ')}</p>
        <p className="pid" title="Unique player ID">ID {p.playerId}</p>
        <dl>
          <div><dt>Matches</dt><dd>{s.matches || 0}</dd></div>
          <div><dt>Runs</dt><dd>{s.runs || 0}</dd></div>
          <div><dt>Wickets</dt><dd>{s.wickets || 0}</dd></div>
          <div><dt>Average</dt><dd>{fmt(s.average)}</dd></div>
          <div><dt>Strike rate</dt><dd>{fmt(s.strikeRate)}</dd></div>
          <div><dt>Economy</dt><dd>{fmt(s.economy, 2)}</dd></div>
        </dl>
      </div>
    </article>
  );
}

export default function Squad({ data, run, admin }) {
  const { teams, stats } = data;
  const players = data.players.filter(isActive);
  const main = mainTeam(teams);
  const [filter, setFilter] = useState('all');
  const [role, setRole] = useState('all');
  const [modal, setModal] = useState(null);
  const [crop, setCrop] = useState(null);   // { file, player }
  const inTeam = (p) => filter === 'all' || p.teams.includes(filter);
  const shown = players.filter(inTeam).filter((p) => role === 'all' || p.role === role);
  const st = (p) => stats[p._id] || {};
  const current = teams.find((t) => t.name === filter) || main;
  const roleNote = filter === 'all' ? 'Every player in your club. A player in several teams appears once, with one ID and one set of stats.' : current.tag === 'Main' ? 'Everyone in a Domestic team is automatically here.' : `${current.tag} team`;

  const remove = (p) => {
    const only = filter !== 'all' && current.tag !== 'Main' ? filter : null;
    const text = only ? `Remove ${p.name} from ${only}? They stay in your other teams.` : `Remove ${p.name} from ${main.name}? This removes them from every Domestic team too.`;
    if (window.confirm(text)) run(() => api.removeFromTeam(p._id, only || (p.teams.includes(main.name) ? main.name : p.teams[0])));
  };

  return (
    <>
      <div className="ph">
        <div className="phl">
          <TeamLogo team={filter === 'all' ? main : current} size={64} />
          <div><h1 className="title">{filter === 'all' ? 'Players' : filter}</h1><p className="sub">{roleNote}</p></div>
        </div>
        {admin && <button className="primary" onClick={() => setModal({ t: 'add' })}>Add player</button>}
      </div>

      <div className="filters">
        <label>Team
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All players</option>
            {teams.map((t) => <option key={t._id} value={t.name}>{t.name} ({t.tag})</option>)}
          </select>
        </label>
        <div className="tabs" role="tablist">
          {['all', ...ROLES].map((r) => (
            <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>
              {r === 'all' ? 'All' : plural(r)} <small>{players.filter((p) => inTeam(p) && (r === 'all' || p.role === r)).length}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="kpis">
        <Kpi n={shown.length} l="Players" />
        <Kpi n={sum(shown, (p) => st(p).matches)} l="Match appearances" />
        <Kpi n={sum(shown, (p) => st(p).runs)} l="Runs" />
        <Kpi n={sum(shown, (p) => st(p).wickets)} l="Wickets" />
      </div>

      {shown.length === 0 ? <Empty>No players match this view.</Empty> : (
        <div className="cards">
          {shown.map((p) => (
            <PlayerCard key={p._id} p={p} s={st(p)} admin={admin} team={teamOf(teams, homeTeam(p, main.name))}
              onTeams={() => setModal({ t: 'teams', id: p._id })}
              onRemove={() => remove(p)}
              onPhoto={(f) => setCrop({ file: f, player: p })} />
          ))}
        </div>
      )}

      {modal?.t === 'add' && <Modal title="Add player" onClose={() => setModal(null)}><AddForm teams={teams} players={players} main={main} onSave={(d) => run(() => api.addPlayer(d)).then((ok) => ok && setModal(null))} /></Modal>}
      {modal?.t === 'teams' && players.some((x) => x._id === modal.id) && <Modal title="Player teams" onClose={() => setModal(null)}><TeamsForm p={players.find((x) => x._id === modal.id)} teams={teams} main={main} run={run} close={() => setModal(null)} /></Modal>}
      {crop && <Cropper file={crop.file} title={`Crop photo: ${crop.player.name}`} aspect={0.5} outW={250} onCancel={() => setCrop(null)}
        onDone={(url) => { const p = crop.player; setCrop(null); run(() => api.updatePlayer(p._id, { imageUrl: url })); }} />}
    </>
  );
}

function AddForm({ teams, players, main, onSave }) {
  const firstDomestic = teams.find((t) => t.tag === 'Domestic') || main;
  const [f, setF] = useState({ name: '', role: 'Batsman', jerseyNo: '', imageUrl: '' });
  const [picked, setPicked] = useState([firstDomestic.name].filter(Boolean));
  const [file, setFile] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (n) => setPicked(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]);
  const dup = players.find((p) => p.name.trim().toLowerCase() === f.name.trim().toLowerCase() && (p.jerseyNo || 0) === (Number(f.jerseyNo) || 0) && f.name.trim());
  const autoMain = picked.some((n) => teams.find((t) => t.name === n)?.tag === 'Domestic') && !picked.includes(main.name);
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); onSave({ ...f, jerseyNo: Number(f.jerseyNo) || 0, teams: picked }); }}>
      <label>Name<input required value={f.name} onChange={set('name')} /></label>
      <div className="row">
        <label>Role<select value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Shirt number<input type="number" min="0" value={f.jerseyNo} onChange={set('jerseyNo')} /></label>
      </div>
      <p className="hint">The player ID is made from the name and number, for example AHMED-RAZA-07. It is unique and never changes.</p>
      {dup && <p className="err">{dup.name} #{dup.jerseyNo} already exists (ID {dup.playerId}). Do not add them again. Use Teams on their card to put them in another team, so their stats stay in one place.</p>}
      <fieldset className="checks">
        <legend>Teams</legend>
        {teams.map((t) => <label key={t._id} className="check"><input type="checkbox" checked={picked.includes(t.name)} onChange={() => toggle(t.name)} />{t.name} <Tag tag={t.tag} /></label>)}
      </fieldset>
      {autoMain && <p className="hint">{main.name} (Main team) is added automatically because a Domestic team is selected.</p>}
      <label>Photo (optional, you can crop it to 250 by 500)
        <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files[0] || null); e.target.value = ''; }} />
      </label>
      {f.imageUrl && <img src={f.imageUrl} width="125" height="250" alt="Preview" />}
      {file && <Cropper file={file} title="Crop photo" aspect={0.5} outW={250} onCancel={() => setFile(null)} onDone={(url) => { setF({ ...f, imageUrl: url }); setFile(null); }} />}
      <p className="hint">New players start with zero stats. They build up as the player takes part in scored matches.</p>
      <button className="primary" disabled={!picked.length || !!dup}>Save player</button>
    </form>
  );
}

// Add the same player to another team, move them, or take them out of a team. There is never a second copy of the player.
function TeamsForm({ p, teams, main, run, close }) {
  const options = teams.filter((t) => !p.teams.includes(t.name));
  const leavable = p.teams.filter((t) => t !== main.name);
  const [mode, setMode] = useState('copy');
  const [to, setTo] = useState(options[0]?.name || '');
  const [from, setFrom] = useState(leavable[0] || '');
  const tagOf = (n) => teams.find((t) => t.name === n)?.tag;
  const drop = (t) => {
    const text = t === main.name ? `Remove ${p.name} from ${main.name}? This removes them from every Domestic team too.` : `Remove ${p.name} from ${t}?`;
    if (window.confirm(text)) run(() => api.removeFromTeam(p._id, t)).then((ok) => ok && close());
  };
  return (
    <div className="form">
      <p className="hint">{p.name} &middot; ID {p.playerId}. One player, one ID, one set of stats, in as many teams as you like. Domestic teams add them to {main.name} automatically.</p>
      <ul className="chips">
        {p.teams.map((t) => (
          <li key={t} className="chip"><b>{t} <Tag tag={tagOf(t)} /></b>
            <button className="ghost" onClick={() => drop(t)}>{t === main.name ? 'Remove from club' : 'Remove'}</button>
          </li>
        ))}
      </ul>
      {options.length > 0 && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); run(() => api.addToTeam(p._id, to, mode === 'move' ? from : undefined)).then((ok) => ok && close()); }}>
          <div className="row">
            <label>Action<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="copy">Add to another team</option><option value="move" disabled={!leavable.length}>Move from a team</option></select></label>
            <label>To team<select value={to} onChange={(e) => setTo(e.target.value)}>{options.map((t) => <option key={t._id} value={t.name}>{t.name} ({t.tag})</option>)}</select></label>
            {mode === 'move' && <label>Leave<select value={from} onChange={(e) => setFrom(e.target.value)}>{leavable.map((t) => <option key={t}>{t}</option>)}</select></label>}
          </div>
          <button className="primary" disabled={!to}>{mode === 'move' ? 'Move player' : 'Add to team'}</button>
        </form>
      )}
    </div>
  );
}
