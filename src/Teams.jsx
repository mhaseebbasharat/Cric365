import { useRef, useState } from 'react';
import { api } from './api.js';
import TeamLogo from './TeamLogo.jsx';
import Cropper from './Cropper.jsx';
import { Empty, Modal, Tag, TAGS, isActive, mainTeam } from './ui.jsx';

// Click a team to open its players. Logos are cropped and shown round.
function TeamModal({ team, players, teams, matches, run, onClose, pickLogo }) {
  const main = mainTeam(teams).name;
  const squad = players.filter((p) => p.teams.includes(team.name));
  const others = players.filter((p) => !p.teams.includes(team.name));
  const [add, setAdd] = useState('');
  const done = matches.filter((m) => m.status === 'completed' && (m.teamA === team.name || m.teamB === team.name));
  const isMain = team.tag === 'Main';
  const drop = (p) => {
    const text = isMain ? `Remove ${p.name} from ${team.name}? This also removes them from every Domestic team.` : `Remove ${p.name} from ${team.name}? They stay in your other teams.`;
    if (window.confirm(text)) run(() => api.removeFromTeam(p._id, team.name));
  };
  const note = isMain ? 'Everyone in a Domestic team is automatically here.' : team.tag === 'Domestic' ? `Players added here are automatically added to ${main} too.` : 'Players here are not added to the Main team.';
  return (
    <Modal title={team.name} onClose={onClose}>
      <div className="tm-head">
        <TeamLogo team={team} size={84} />
        <div>
          <Tag tag={team.tag} />
          <p className="hint">{squad.length} player{squad.length === 1 ? '' : 's'}{done.length ? `, played ${done.length}, won ${done.filter((m) => m.winner === team.name).length}` : ''}</p>
          <p className="hint">{note}</p>
          <button className="ghost" onClick={() => pickLogo(team)}>{team.logoUrl ? 'Change logo' : 'Upload logo'}</button>
        </div>
      </div>
      <h3 className="mh3">Players</h3>
      {squad.length === 0 ? <Empty>No players in this team yet.</Empty> : (
        <ul className="roster-list">
          {squad.map((p) => (
            <li key={p._id}>
              <span className="jn">{p.jerseyNo ? `#${p.jerseyNo}` : '–'}</span>
              <span className="pn">{p.name}<small>{p.role} &middot; ID {p.playerId}</small></span>
              <button className="ghost" onClick={() => drop(p)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <form className="row addrow" onSubmit={(e) => { e.preventDefault(); add && run(() => api.addToTeam(add, team.name)).then((ok) => ok && setAdd('')); }}>
          <label>Add an existing player to {team.name}
            <select value={add} onChange={(e) => setAdd(e.target.value)}>
              <option value="">Choose a player</option>
              {others.map((p) => <option key={p._id} value={p._id}>{p.jerseyNo ? `#${p.jerseyNo} ` : ''}{p.name} ({p.playerId})</option>)}
            </select>
          </label>
          <button className="primary" disabled={!add}>Add</button>
        </form>
      )}
      <p className="hint">The same player can be in many teams. It is always one person with one ID, so their stats are the same everywhere.</p>
      {!isMain && <button className="danger" onClick={() => window.confirm(`Remove the team ${team.name}?`) && run(() => api.removeTeam(team._id)).then((ok) => ok && onClose())}>Remove team</button>}
    </Modal>
  );
}

export default function Teams({ data, run }) {
  const { teams, matches } = data;
  const players = data.players.filter(isActive);
  const [f, setF] = useState({ name: '', tag: 'Domestic', kitColor: '#12402F', kitColor2: '#C8A45A', logoUrl: '' });
  const [openId, setOpenId] = useState(null);
  const [crop, setCrop] = useState(null);   // { file, team? }  team missing = logo for the new-team form
  const file = useRef(), target = useRef();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const open = teams.find((t) => t._id === openId);
  const pickLogo = (team) => { target.current = team || null; file.current.click(); };
  const logoDone = (url) => {
    const team = crop.team; setCrop(null);
    team ? run(() => api.updateTeam(team._id, { logoUrl: url })) : setF((x) => ({ ...x, logoUrl: url }));
  };
  const count = (t) => players.filter((p) => p.teams.includes(t.name)).length;

  return (
    <>
      <div className="ph"><div><h1 className="title">Teams</h1><p className="sub">Click a team to see its players. The tag shows what kind of team it is. Players in a Domestic team are added to your Main team automatically.</p></div></div>
      {teams.length === 0 && <Empty>No teams yet.</Empty>}
      <ul className="tgrid">
        {teams.map((t) => (
          <li key={t._id}>
            <button className="tcardbtn" onClick={() => setOpenId(t._id)}>
              <TeamLogo team={t} size={64} />
              <span className="tname">{t.name}</span>
              <Tag tag={t.tag} />
              <small>{count(t)} players</small>
            </button>
          </li>
        ))}
      </ul>

      <form className="sec form" onSubmit={(e) => { e.preventDefault(); run(() => api.addTeam(f)).then((ok) => ok && setF({ ...f, name: '', logoUrl: '' })); }}>
        <h2>Add a team</h2>
        <div className="row">
          <label>Team name<input required value={f.name} onChange={set('name')} /></label>
          <label>Tag<select value={f.tag} onChange={set('tag')}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Primary colour<input type="color" value={f.kitColor} onChange={set('kitColor')} /></label>
          <label>Accent colour<input type="color" value={f.kitColor2} onChange={set('kitColor2')} /></label>
        </div>
        <div className="row">
          <label>Logo (optional, you can crop it. A badge is drawn if you skip it)
            <button type="button" className="ghost" onClick={() => pickLogo(null)}>{f.logoUrl ? 'Change logo' : 'Choose logo'}</button>
          </label>
          <TeamLogo team={{ ...f }} size={56} />
          <button className="primary">Add team</button>
        </div>
      </form>

      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const x = e.target.files[0]; e.target.value = ''; x && setCrop({ file: x, team: target.current }); }} />
      {open && <TeamModal team={open} players={players} teams={teams} matches={matches} run={run} onClose={() => setOpenId(null)} pickLogo={pickLogo} />}
      {crop && <Cropper file={crop.file} title="Crop logo" round aspect={1} outW={256} onDone={logoDone} onCancel={() => setCrop(null)} />}
    </>
  );
}
