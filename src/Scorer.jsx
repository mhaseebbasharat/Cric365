import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import TeamLogo from './TeamLogo.jsx';
import BallFx from './BallFx.jsx';
import { MILESTONES } from './fxTiming.js';
import { Modal, useIndex, fmt, score, teamOf, dismissal } from './ui.jsx';

const EXTRAS = [['wide', 'Wide'], ['noball', 'No ball'], ['bye', 'Bye'], ['legbye', 'Leg bye']];
const NEEDS_FIELDER = ['caught', 'stumped'];

export default function Scorer({ match: m, players, teams, run, admin, back }) {
  const P = useIndex(players);
  const nm = (id) => P[id]?.name || '–';
  const inn = m.currentInnings, s = m.summary, live = m.status === 'live';
  const cur = s.inn[inn - 1], card = m.card[inn - 1];
  const batIds = s.battingTeam === m.teamA ? m.playersA : m.playersB;
  const bowlIds = s.bowlingTeam === m.teamA ? m.playersA : m.playersB;
  const out = card.batting.filter((b) => b.out).map((b) => b.id);
  const c = m.crease, rules = m.rules || {};
  const bowled = Object.fromEntries(card.bowling.map((w) => [w.id, w.legal]));
  const maxBalls = (rules.maxBowlerOvers || 0) * 6;

  const [sel, setSel] = useState({ striker: '', nonStriker: '', bowler: '' });
  const [extra, setExtra] = useState('none');
  const [wk, setWk] = useState(null);
  useEffect(() => { import('./stage3d.js').then((m) => m.preload()).catch(() => {}); }, []); // warm up the 3D scene so the first 4 or 6 plays instantly
  const [ending, setEnding] = useState(false);
  const [fx, setFx] = useState(null);
  const [sound, setSound] = useState(() => localStorage.getItem('cric365_sound') !== 'off');
  const toggleSound = () => setSound((v) => { localStorage.setItem('cric365_sound', v ? 'off' : 'on'); return !v; });

  // Celebrations: a batter reaching 50, 100, 150 or 200 (applause and congratulations), a new 4, 6 or wicket, or the match being won.
  // Works for the scorer and for anyone watching live.
  const prevBalls = useRef(null), prevStatus = useRef(null), prevRuns = useRef(null);
  useEffect(() => {
    const runsNow = Object.fromEntries(m.card.flatMap((x) => x.batting.map((b) => [b.id, b.runs])));
    if (prevBalls.current !== null && m.ballCount > prevBalls.current) {
      const hit = prevRuns.current && Object.keys(runsNow).map((id) => ({ id, from: prevRuns.current[id] || 0, to: runsNow[id] })).find((r) => MILESTONES.some((k) => r.from < k && r.to >= k));
      if (hit) {
        const n = MILESTONES.find((k) => hit.from < k && hit.to >= k);
        setFx({ kind: 'milestone', n, text: nm(hit.id), id: Date.now(), colors: { bat: teamOf(teams, s.battingTeam).kitColor, bowl: teamOf(teams, s.bowlingTeam).kitColor } });
      } else {
        // A wicket plays its own scene: caught out, run out, or the stumps going down (bowled, lbw, stumped, hit wicket).
        const w = m.last && m.last.wicket;
        const kind = m.lastBall === 'W' ? (w && w.kind === 'caught' ? 'catch' : w && w.kind === 'run out' ? 'runout' : 'wicket') : { 6: 'six', 4: 'four' }[m.lastBall];
        const isOut = m.lastBall === 'W';
        const who = m.last ? runsNow[m.last.batsman] : null, bb = m.last ? m.card.flatMap((x) => x.batting).find((b) => b.id === m.last.batsman) : null;
        const outId = isOut && m.last ? (w && w.playerOut) || m.last.batsman : null;
        const outStriker = !w || !w.playerOut || String(w.playerOut) === String(m.last.batsman);   // for a run out: which batter was short of the crease
        const how = !w ? '' : w.kind === 'caught' ? dismissal({ kind: 'caught', fielder: w.fielder, bowler: m.last.bowler }, nm) : w.kind === 'run out' ? dismissal({ kind: 'run out', fielder: w.fielder }, nm) : `b ${nm(m.last.bowler)}`;
        const info = m.last ? { name: isOut ? `${nm(outId)} is out` : `${nm(m.last.batsman)}  ${who ?? ''}${bb ? ` (${bb.balls})` : ''}`, sub: isOut ? how : `b ${nm(m.last.bowler)}` } : null;
        if (kind) setFx({ kind, info, outStriker, id: Date.now(), colors: { bat: teamOf(teams, s.battingTeam).kitColor, bowl: teamOf(teams, s.bowlingTeam).kitColor } });
      }
    }
    prevBalls.current = m.ballCount; prevRuns.current = runsNow;
  }, [m.ballCount]); // eslint-disable-line
  useEffect(() => {
    if (prevStatus.current === 'live' && m.status === 'completed' && m.winner) setFx({ kind: 'win', text: m.winner, id: Date.now(), colors: { team: teamOf(teams, m.winner).kitColor } });
    prevStatus.current = m.status;
  }, [m.status]); // eslint-disable-line
  useEffect(() => setSel({ striker: c.striker || '', nonStriker: c.nonStriker || '', bowler: c.bowler || '' }), [c.striker, c.nonStriker, c.bowler]);
  const ready = c.striker && c.nonStriker && c.bowler;
  const dirty = sel.striker !== (c.striker || '') || sel.nonStriker !== (c.nonStriker || '') || sel.bowler !== (c.bowler || '');
  const canApply = sel.striker && sel.nonStriker && sel.bowler && dirty;

  const bat = extra === 'none' || extra === 'noball';
  const ball = async (n) => {
    if (await run(() => api.addBall(m._id, { runs: bat ? n : 0, extraRuns: bat ? 0 : n, extra }))) setExtra('none');
  };
  const kinds = (m.kinds && m.kinds[extra]) || [];
  const kind = wk && (kinds.includes(wk.kind) ? wk.kind : kinds[0]);
  const needF = wk && (NEEDS_FIELDER.includes(kind) || kind === 'run out');
  const wkOk = wk && kind && (!NEEDS_FIELDER.includes(kind) || wk.fielder);
  const confirmWicket = async () => {
    const n = kind === 'run out' ? wk.runs : 0;
    const body = { runs: bat ? n : 0, extraRuns: bat ? 0 : n, extra, wicket: { kind, playerOut: wk.out === 'striker' ? c.striker : c.nonStriker, fielder: needF && wk.fielder ? wk.fielder : null } };
    if (await run(() => api.addBall(m._id, body))) { setWk(null); setExtra('none'); }
  };
  const swap = () => run(() => api.setCrease(m._id, { striker: c.nonStriker, nonStriker: c.striker }));

  const chase = inn === 2 && s.target && live;
  const bowlerOption = (id) => `${nm(id)}${bowled[id] ? ` (${Math.floor(bowled[id] / 6)}.${bowled[id] % 6}/${rules.maxBowlerOvers} ov)` : ''}`;
  const pickBat = (key, exclude) => (
    <select value={sel[key]} onChange={(e) => setSel({ ...sel, [key]: e.target.value })}>
      <option value="">Select</option>
      {batIds.filter((id) => id === sel[key] || !exclude.includes(id)).map((id) => <option key={id} value={id}>{nm(id)}</option>)}
    </select>
  );
  const pickBowler = (
    <select value={sel.bowler} onChange={(e) => setSel({ ...sel, bowler: e.target.value })}>
      <option value="">Select</option>
      {bowlIds.filter((id) => id === sel.bowler || (id !== rules.lastBowler && (bowled[id] || 0) < maxBalls)).map((id) => <option key={id} value={id}>{bowlerOption(id)}</option>)}
    </select>
  );
  const need = !c.bowler && m.ballCount > 0 && rules.lastBowler ? 'Over complete. Choose the next bowler. The last bowler cannot bowl again.'
    : (!c.striker || !c.nonStriker) && m.ballCount > 0 ? 'Wicket. Choose the next batter, then confirm.'
    : !ready ? 'Choose the two batters and the bowler for the next ball.' : '';

  const atCrease = (id) => card.batting.find((b) => b.id === id);
  const figures = (w) => (w ? `${w.overs}-${w.maidens}-${w.runs}-${w.wickets}` : '0.0-0-0-0');
  const thisOver = card.overList.length ? card.overList[card.overList.length - 1] : null;
  const all = m.card.flatMap((x) => x.batting.map((b) => ({ ...b, team: x.team })));
  const allBowl = m.card.flatMap((x) => x.bowling);
  const topBat = [...all].sort((a, b) => b.runs - a.runs)[0];
  const topBowl = [...allBowl].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];

  return (
    <>
      <div className="ph">
        <button className="ghost" onClick={back}>All matches</button>
        <button className="ghost" onClick={toggleSound} title="Cheering and crowd sounds">Sound: {sound ? 'on' : 'off'}</button>
        {admin && <button className="danger" onClick={() => window.confirm('Delete this match and all its scoring?') && run(() => api.removeMatch(m._id)).then(back)}>Delete match</button>}
      </div>

      <section className="hero">
        <p className="hero-meta">{live ? <><i className="dot" />Live</> : m.status === 'completed' ? (m.noResult ? 'No result' : 'Final') : 'Scheduled'}<span>{m.tournament ? `${m.tournament}, ${m.stage}` : 'Friendly match'}, {m.overs} overs</span></p>
        <div className="hero-grid">
          {s.inn.map((x, i) => (
            <div key={i} className={`hero-team ${live && m.currentInnings === i + 1 ? 'now' : ''}`}>
              <TeamLogo team={teamOf(teams, x.team)} size={64} />
              <div><b>{x.team}</b><span>{x.legal ? `${x.overs} overs` : m.currentInnings === i + 1 && live ? 'Batting' : 'Yet to bat'}</span></div>
              <strong>{x.legal || m.currentInnings === i + 1 ? score(x) : '–'}</strong>
            </div>
          ))}
        </div>
        <p className="toss">{m.tossWinner} won the toss and chose to {m.tossDecision} first</p>
        {m.status === 'completed' && <p className="result">{m.result}</p>}
        {live && (
          <p className="result">
            {chase ? `${s.battingTeam} need ${s.target - cur.runs} from ${s.ballsLeft} balls` : `Run rate ${s.runRate.toFixed(2)}`}
            {chase && s.requiredRate != null && <small className="rates"> Run rate {s.runRate.toFixed(2)}, required {s.requiredRate.toFixed(2)}</small>}
            {!chase && s.projected != null && <small className="rates"> Projected {s.projected}</small>}
          </p>
        )}
        {live && rules.freeHit && <p className="freehit">FREE HIT: only a run out is possible</p>}
        {m.recent.length > 0 && live && <div className="balls" aria-label="Recent balls">{m.recent.map((b, i) => <span key={i} className={`ball b-${b.replace(/\d/g, '') || 'n'}-${b}`}>{b}</span>)}</div>}
      </section>

      {live && (c.striker || c.nonStriker || c.bowler) && (
        <section className="now-strip">
          {[c.striker, c.nonStriker].map((id, i) => {
            const b = id && atCrease(id);
            return <div key={i}><small>{i === 0 ? 'On strike' : 'Non-striker'}</small><b>{id ? nm(id) : 'Waiting'}{i === 0 && id ? '*' : ''}</b><span>{b ? `${b.runs} (${b.balls})  ${b.fours}x4  ${b.sixes}x6` : id ? '0 (0)' : ''}</span></div>;
          })}
          <div><small>Bowling</small><b>{c.bowler ? nm(c.bowler) : 'Waiting'}</b><span>{c.bowler ? figures(card.bowling.find((w) => w.id === c.bowler)) : ''}</span></div>
          <div><small>Partnership</small><b>{card.partnership.runs}</b><span>{card.partnership.balls} balls</span></div>
        </section>
      )}

      {admin && m.status === 'scheduled' && <button className="primary lg" onClick={() => run(() => api.startMatch(m._id))}>Start match</button>}

      {admin && live && (
        <section className="sec console">
          <h2>Scoring, {s.battingTeam} batting</h2>
          <div className="row">
            <label>Striker{pickBat('striker', [...out, sel.nonStriker])}</label>
            <label>Non-striker{pickBat('nonStriker', [...out, sel.striker])}</label>
            <label>Bowler{pickBowler}</label>
            <button className={canApply ? 'primary' : 'ghost'} disabled={!canApply} onClick={() => run(() => api.setCrease(m._id, sel))}>Confirm players</button>
            <button className="ghost" disabled={!c.striker || !c.nonStriker} onClick={swap}>Swap batters</button>
          </div>
          {need && <p className="hint need">{need}</p>}
          <div className={`padgrid ${ready ? '' : 'off'}`}>
            <div className="extras">{EXTRAS.map(([k, l]) => <button key={k} className={extra === k ? 'on' : ''} disabled={!ready} onClick={() => { setExtra(extra === k ? 'none' : k); setWk(null); }}>{l}</button>)}</div>
            <div className="runs">{[0, 1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={`r${n}`} disabled={!ready || (!bat && n > 5)} onClick={() => ball(n)}>{n}</button>)}</div>
            <div className="extras">
              <button className="danger" disabled={!ready} onClick={() => setWk(wk ? null : { out: 'striker', fielder: '', runs: 0, kind: 'bowled' })}>Wicket</button>
              <button className="ghost" disabled={!m.ballCount} onClick={() => run(() => api.undoBall(m._id))}>Undo last ball</button>
              <button className="danger" onClick={() => setEnding(true)}>End match</button>
            </div>
          </div>
          {extra !== 'none' && <p className="hint">{extra === 'wide' || extra === 'noball' ? 'One penalty run is added automatically. ' : ''}Now tap the runs {bat ? 'the batter scored' : 'that were run'}, or 0 for none.</p>}
          {wk && (
            <div className="row wk">
              <label>How<select value={kind} onChange={(e) => setWk({ ...wk, kind: e.target.value })}>{kinds.map((k) => <option key={k}>{k}</option>)}</select></label>
              <label>Who is out<select value={wk.out} onChange={(e) => setWk({ ...wk, out: e.target.value })}><option value="striker">{nm(c.striker)}, striker</option><option value="nonStriker">{nm(c.nonStriker)}, non-striker</option></select></label>
              {needF && <label>{kind === 'caught' ? 'Caught by' : kind === 'stumped' ? 'Wicket-keeper' : 'Fielder (optional)'}<select value={wk.fielder} onChange={(e) => setWk({ ...wk, fielder: e.target.value })}><option value="">Select</option>{bowlIds.map((id) => <option key={id} value={id}>{nm(id)}</option>)}</select></label>}
              {kind === 'run out' && <label>Runs completed<select value={wk.runs} onChange={(e) => setWk({ ...wk, runs: +e.target.value })}>{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select></label>}
              <button className="danger" disabled={!wkOk} onClick={confirmWicket}>Confirm wicket</button>
            </div>
          )}
          {thisOver && thisOver.legal < 6 && <p className="hint">This over: {thisOver.balls.join('  ')}</p>}
        </section>
      )}
      {admin && m.status === 'completed' && m.manualEnd && <button className="ghost" onClick={() => run(() => api.resumeMatch(m._id))}>Resume match</button>}
      {admin && m.status === 'completed' && !m.manualEnd && m.ballCount > 0 && <button className="ghost" onClick={() => run(() => api.undoBall(m._id))}>Undo last ball and reopen match</button>}

      {ending && (
        <Modal title="End match" onClose={() => setEnding(false)}>
          <div className="form">
            <p className="hint">Use this if the match must stop early (rain, bad light, time). You can resume it afterwards.</p>
            <p><b>If you end it now:</b> {m.endPreview ? m.endPreview.result : ''}</p>
            <button className="primary" disabled={!m.endPreview || m.endPreview.noResult} onClick={() => run(() => api.endMatch(m._id, 'result')).then((ok) => ok && setEnding(false))}>End match with the current result</button>
            {m.endPreview && m.endPreview.noResult && <p className="hint">A result needs the second innings to have started. You can still end it as no result.</p>}
            <button className="danger" onClick={() => run(() => api.endMatch(m._id, 'noresult')).then((ok) => ok && setEnding(false))}>End as no result (abandoned, no points)</button>
            <button className="ghost" onClick={() => setEnding(false)}>Keep playing</button>
          </div>
        </Modal>
      )}
      {fx && <BallFx key={fx.id} kind={fx.kind} text={fx.text} n={fx.n} info={fx.info} outStriker={fx.outStriker} colors={fx.colors} sound={sound} onDone={() => setFx(null)} />}

      {m.status === 'completed' && topBat && topBowl && (
        <section className="sec tops">
          <div><small>Top scorer</small><b>{nm(topBat.id)}</b><span>{topBat.runs} ({topBat.balls}), {topBat.team}</span></div>
          <div><small>Best bowler</small><b>{nm(topBowl.id)}</b><span>{topBowl.wickets}/{topBowl.runs} in {topBowl.overs} overs</span></div>
        </section>
      )}

      {m.card.filter((x, i) => x.batting.length || (live && i + 1 === inn)).map((x) => (
        <section key={x.innings} className="sec">
          <h2>{x.team}<small>{score(x)} after {x.overs} overs</small></h2>
          <div className="scroll"><table className="tbl">
            <thead><tr><th>Batter</th><th /><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
            <tbody>{x.batting.map((b) => {
              const at = live && x.innings === inn && !b.out && (b.id === c.striker || b.id === c.nonStriker);
              return (
                <tr key={b.id} className={at ? 'at' : ''}>
                  <td>{nm(b.id)}{at && b.id === c.striker ? '*' : ''}{b.runs >= 100 ? <span className="mile">100</span> : b.runs >= 50 ? <span className="mile">50</span> : null}</td>
                  <td className="dim">{b.out ? dismissal(b.out, nm) : at ? 'batting' : 'not out'}</td>
                  <td><b>{b.runs}</b></td><td>{b.balls}</td><td>{b.fours}</td><td>{b.sixes}</td><td>{b.balls ? fmt((b.runs / b.balls) * 100) : '–'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          <p className="line"><b>Extras {x.extras}</b> (wd {x.extrasDetail.wd}, nb {x.extrasDetail.nb}, b {x.extrasDetail.b}, lb {x.extrasDetail.lb})<span>Total {score(x)} ({x.overs} ov)</span></p>
          {x.yetToBat.length > 0 && x.batting.length > 0 && <p className="line dim">Did not bat: {x.yetToBat.map(nm).join(', ')}</p>}
          {x.fow.length > 0 && <p className="line dim">Fall of wickets: {x.fow.map((f) => `${f.runs}-${f.wkt} (${nm(f.out)}, ${f.over} ov)`).join(', ')}</p>}
          <div className="scroll"><table className="tbl">
            <thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Dots</th><th>Wd</th><th>Nb</th></tr></thead>
            <tbody>{x.bowling.map((w) => <tr key={w.id}><td>{nm(w.id)}</td><td>{w.overs}</td><td>{w.maidens}</td><td>{w.runs}</td><td><b>{w.wickets}</b></td><td>{fmt(w.economy, 2)}</td><td>{w.dots}</td><td>{w.wides}</td><td>{w.noballs}</td></tr>)}</tbody>
          </table></div>
          {x.overList.length > 0 && (
            <details className="roster">
              <summary>Over by over</summary>
              <table className="tbl"><thead><tr><th>Over</th><th>Bowler</th><th>Balls</th><th>Runs</th></tr></thead>
                <tbody>{x.overList.map((o) => <tr key={o.over}><td>{o.over}{o.maiden ? ' (maiden)' : ''}</td><td className="dim">{nm(o.bowler)}</td><td className="dim">{o.balls.join(' ')}</td><td><b>{o.runs}</b>{o.wickets ? `, ${o.wickets}W` : ''}</td></tr>)}</tbody>
              </table>
            </details>
          )}
        </section>
      ))}
    </>
  );
}
