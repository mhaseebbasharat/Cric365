import { api } from './api.js';
import TeamLogo from './TeamLogo.jsx';
import { Kpi, Empty, ROLES, useIndex, sum, score, teamOf, plural, homeTeam, isActive, mainTeam } from './ui.jsx';

export function ScoreCard({ m, teams, onOpen }) {
  const rows = m.summary.inn;
  return (
    <button className={`mc ${m.status}`} onClick={() => onOpen(m._id)}>
      <span className="mc-status">{m.status === 'live' ? <><i className="dot" />Live</> : m.status === 'completed' ? 'Final' : 'Scheduled'}</span>
      {rows.map((s, i) => (
        <span key={i} className="mc-row">
          <TeamLogo team={teamOf(teams, s.team)} size={28} />
          <b>{s.team}</b>
          <em>{s.legal || (m.status === 'live' && m.currentInnings === i + 1) ? <>{score(s)} <small>{s.overs}</small></> : '–'}</em>
        </span>
      ))}
      <small className="mc-foot">{m.status === 'completed' ? m.result : `${m.tournament || 'Friendly match'}, ${m.overs} overs`}</small>
    </button>
  );
}

function Board({ title, rows, P, k, sub, teams, main }) {
  return (
    <section className="sec">
      <h2>{title}</h2>
      {rows.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
        <table className="tbl lead"><tbody>
          {rows.map(([id, s], i) => (
            <tr key={id}>
              <td className="rk">{i + 1}</td>
              <td><TeamLogo team={teamOf(teams, homeTeam(P[id], main))} size={22} /></td>
              <td className="nm">{P[id].name}<small>{homeTeam(P[id], main)}, {sub(s)}</small></td>
              <td className="big">{s[k]}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </section>
  );
}

export default function Dashboard({ data, openMatch, run }) {
  const { matches, stats, teams, tournaments } = data;
  const players = data.players.filter(isActive);
  const mainT = mainTeam(teams);
  const club = players.filter((p) => p.teams.includes(mainT.name));
  const P = useIndex(players);
  const played = matches.filter((m) => m.status !== 'scheduled');
  const live = matches.filter((m) => m.status === 'live');
  const recent = matches.filter((m) => m.status === 'completed').slice(0, 3);
  const all = Object.entries(stats);
  const top = (k) => all.filter(([id, s]) => P[id] && s[k] > 0).sort((a, b) => b[1][k] - a[1][k]).slice(0, 5);

  return (
    <>
      <header className="club">
        <TeamLogo team={mainT} size={96} />
        <div>
          <h1 className="title">{mainT.name}</h1>
          <p className="sub">{club.length} players in your main team, {teams.length} teams in total, {tournaments.length} tournament{tournaments.length === 1 ? '' : 's'}.</p>
        </div>
      </header>

      <div className="kpis">
        <Kpi n={played.length} l="Matches played" />
        <Kpi n={sum(all, ([, s]) => s.runs).toLocaleString()} l="Runs scored" />
        <Kpi n={sum(all, ([, s]) => s.wickets)} l="Wickets taken" />
        <Kpi n={sum(all, ([, s]) => s.sixes)} l="Sixes" />
        <Kpi n={sum(all, ([, s]) => s.fours)} l="Fours" />
      </div>

      {live.length > 0 && (
        <section className="sec"><h2>Live now</h2><div className="mgrid">{live.map((m) => <ScoreCard key={m._id} m={m} teams={teams} onOpen={openMatch} />)}</div></section>
      )}
      {recent.length > 0 && (
        <section className="sec"><h2>Recent results</h2><div className="mgrid">{recent.map((m) => <ScoreCard key={m._id} m={m} teams={teams} onOpen={openMatch} />)}</div></section>
      )}

      {players.length === 0 && (
        <section className="sec">
          <h2>Get started</h2>
          <p className="empty">Add your teams on the Teams page and your players on the Players page. Or try it with sample teams and players first.</p>
          <button className="primary" onClick={() => run(() => api.loadSample())}>Load sample teams and players</button>
        </section>
      )}

      {played.length === 0 ? (
        <Empty>No matches have been scored yet. Create a match under Matches and start scoring. Every statistic is calculated from the balls you score.</Empty>
      ) : (
        <div className="two">
          <Board title="Most runs" rows={top('runs')} P={P} k="runs" sub={(s) => `${s.balls} balls`} teams={teams} main={mainT.name} />
          <Board title="Most wickets" rows={top('wickets')} P={P} k="wickets" sub={(s) => `${s.overs} overs`} teams={teams} main={mainT.name} />
          <Board title="Most sixes" rows={top('sixes')} P={P} k="sixes" sub={(s) => `${s.runs} runs`} teams={teams} main={mainT.name} />
          <Board title="Most catches" rows={top('catches')} P={P} k="catches" sub={(s) => `${s.matches} matches`} teams={teams} main={mainT.name} />
        </div>
      )}

      <section className="sec">
        <h2>{mainT.name} squad by role</h2>
        <ul className="roles">{ROLES.map((r) => <li key={r}><b>{club.filter((p) => p.role === r).length}</b>{plural(r)}</li>)}</ul>
      </section>
    </>
  );
}
