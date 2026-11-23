// Pure scoring maths. Everything shown in the app (scores, scorecards, player stats, points tables)
// is derived from ball events, so "undo" and live updates always stay correct.
const BOWLER_KINDS = ['bowled', 'caught', 'lbw', 'stumped', 'hit wicket'];
const KINDS = [...BOWLER_KINDS, 'run out'];
const id = (x) => (x ? String(x) : null);
const isLegal = (b) => b.extra !== 'wide' && b.extra !== 'noball';
const penalty = (b) => (b.extra === 'wide' || b.extra === 'noball' ? 1 : 0);
const totalRuns = (b) => (b.runs || 0) + (b.extraRuns || 0) + penalty(b);
const bowlerRuns = (b) => (b.runs || 0) + penalty(b) + (b.extra === 'wide' ? b.extraRuns || 0 : 0); // byes and leg byes are not charged to the bowler
const wicketOf = (b) => (b.wicket && b.wicket.kind ? b.wicket : null);
const ov = (legal) => `${Math.floor(legal / 6)}.${legal % 6}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const battingTeam = (m, inn) => (inn === 1 ? m.battingFirst : m.battingFirst === m.teamA ? m.teamB : m.teamA);
const bowlingTeam = (m, inn) => (battingTeam(m, inn) === m.teamA ? m.teamB : m.teamA);
const squadOf = (m, team) => (team === m.teamA ? m.playersA : m.playersB).map(String);
const maxWickets = (m, inn) => Math.max(1, squadOf(m, battingTeam(m, inn)).length - 1);

// ---- Laws of the game the scorer must follow ----
// On a no ball / free hit only a run out is possible. A wide can also be stumped or hit wicket.
function allowedKinds(extra, freeHit) {
  if (freeHit || extra === 'noball') return ['run out'];
  if (extra === 'wide') return ['stumped', 'hit wicket', 'run out'];
  if (extra === 'bye' || extra === 'legbye') return ['hit wicket', 'run out'];
  return KINDS;
}
// The ball after a no ball is a free hit. Wides in between do not cancel it.
function isFreeHit(m, inn) {
  const bs = m.balls.filter((b) => b.innings === inn);
  for (let i = bs.length - 1; i >= 0; i--) { if (bs[i].extra === 'wide') continue; return bs[i].extra === 'noball'; }
  return false;
}
// A bowler may bowl at most one fifth of the overs (20 overs = 4 each). Smaller squads get a fair share.
const maxBowlerOvers = (m, inn) => Math.ceil(m.overs / Math.min(5, Math.max(1, squadOf(m, bowlingTeam(m, inn)).length)));
// Bowler of the over that just finished: cannot bowl the next one.
function lastOverBowler(m, inn) {
  const bs = m.balls.filter((b) => b.innings === inn), legal = bs.filter(isLegal).length;
  if (!legal || legal % 6 !== 0) return null;
  for (let i = bs.length - 1; i >= 0; i--) if (isLegal(bs[i])) return id(bs[i].bowler);
  return null;
}
const rules = (m, inn) => ({ freeHit: isFreeHit(m, inn), maxBowlerOvers: maxBowlerOvers(m, inn), lastBowler: lastOverBowler(m, inn) });

function inningsSummary(m, inn) {
  let runs = 0, wickets = 0, legal = 0;
  const x = { wd: 0, nb: 0, b: 0, lb: 0 };
  for (const b of m.balls) {
    if (b.innings !== inn) continue;
    runs += totalRuns(b);
    if (isLegal(b)) legal++;
    if (wicketOf(b)) wickets++;
    if (b.extra === 'wide') x.wd += 1 + (b.extraRuns || 0);
    if (b.extra === 'noball') x.nb += 1;
    if (b.extra === 'bye') x.b += b.extraRuns || 0;
    if (b.extra === 'legbye') x.lb += b.extraRuns || 0;
  }
  return { runs, wickets, legal, extras: x.wd + x.nb + x.b + x.lb, extrasDetail: x, overs: ov(legal) };
}

// Works out innings / status / result from the balls, so undo "just works".
function derive(m) {
  if (!m.balls.length) return { currentInnings: 1, status: m.status === 'scheduled' ? 'scheduled' : 'live', result: '', winner: '' };
  const s1 = inningsSummary(m, 1), s2 = inningsSummary(m, 2), limit = m.overs * 6;
  const over1 = s1.wickets >= maxWickets(m, 1) || s1.legal >= limit;
  const out = { currentInnings: over1 ? 2 : 1, status: 'live', result: '', winner: '' };
  if (!over1) return out;
  const chased = s2.runs > s1.runs;
  if (chased || s2.wickets >= maxWickets(m, 2) || s2.legal >= limit) {
    out.status = 'completed';
    const t1 = battingTeam(m, 1), t2 = battingTeam(m, 2);
    if (chased) {
      const left = limit - s2.legal;
      out.winner = t2;
      out.result = `${t2} won by ${plural(maxWickets(m, 2) - s2.wickets, 'wicket')}${left > 0 ? ` (${plural(left, 'ball')} left)` : ''}`;
    } else if (s2.runs < s1.runs) { out.winner = t1; out.result = `${t1} won by ${plural(s1.runs - s2.runs, 'run')}`; }
    else out.result = 'Match tied';
  }
  return out;
}

function summary(m) {
  const s1 = inningsSummary(m, 1), s2 = inningsSummary(m, 2), inn = m.currentInnings, cur = inn === 1 ? s1 : s2, limit = m.overs * 6;
  const target = s1.legal >= limit || s1.wickets >= maxWickets(m, 1) ? s1.runs + 1 : null;
  const left = limit - cur.legal;
  const crr = cur.legal ? (cur.runs / cur.legal) * 6 : 0;
  return {
    battingTeam: battingTeam(m, inn), bowlingTeam: bowlingTeam(m, inn),
    inn: [{ team: battingTeam(m, 1), ...s1 }, { team: battingTeam(m, 2), ...s2 }],
    target,
    ballsLeft: left,
    runRate: +crr.toFixed(2),
    requiredRate: inn === 2 && target && left > 0 ? +(((target - cur.runs) / left) * 6).toFixed(2) : null,
    projected: inn === 1 && cur.legal ? Math.round((crr * limit) / 6) : null
  };
}

function outIds(m, inn) {
  return m.balls.filter((b) => b.innings === inn && wicketOf(b)).map((b) => id(b.wicket.playerOut));
}

function scorecard(m) {
  return [1, 2].map((inn) => {
    const bats = new Map(), bowls = new Map(), fow = [], overs = [];
    const bat = (pid) => { if (pid && !bats.has(pid)) bats.set(pid, { id: pid, runs: 0, balls: 0, fours: 0, sixes: 0, out: null }); return bats.get(pid); };
    const bowl = (pid) => { if (!bowls.has(pid)) bowls.set(pid, { id: pid, legal: 0, runs: 0, wickets: 0, maidens: 0, dots: 0, wides: 0, noballs: 0 }); return bowls.get(pid); };
    let legal = 0, runs = 0, wkts = 0, pRuns = 0, pBalls = 0;
    for (const b of m.balls) {
      if (b.innings !== inn) continue;
      const idx = Math.floor(legal / 6);
      const o = (overs[idx] ||= { over: idx + 1, bowler: id(b.bowler), runs: 0, bowlerRuns: 0, wickets: 0, legal: 0, balls: [] });
      const s = bat(id(b.batsman)); bat(id(b.nonStriker));
      s.runs += b.runs || 0;
      if (b.extra !== 'wide') s.balls++;
      if (b.runs === 4) s.fours++;
      if (b.runs === 6) s.sixes++;
      const w = bowl(id(b.bowler)), br = bowlerRuns(b);
      w.runs += br;
      if (b.extra === 'wide') w.wides++;
      if (b.extra === 'noball') w.noballs++;
      if (isLegal(b)) { w.legal++; legal++; o.legal++; if (br === 0) w.dots++; }
      o.runs += totalRuns(b); o.bowlerRuns += br; o.balls.push(ballLabel(b));
      runs += totalRuns(b); pRuns += totalRuns(b); if (isLegal(b)) pBalls++;
      const wk = wicketOf(b);
      if (wk) {
        const out = bat(id(wk.playerOut));
        const byBowler = BOWLER_KINDS.includes(wk.kind);
        out.out = { kind: wk.kind, bowler: byBowler ? id(b.bowler) : null, fielder: id(wk.fielder) };
        if (byBowler) w.wickets++;
        o.wickets++; wkts++;
        fow.push({ wkt: wkts, runs, out: id(wk.playerOut), over: ov(legal) });
        pRuns = 0; pBalls = 0;
      }
    }
    for (const o of overs) if (o && o.legal === 6 && o.bowlerRuns === 0) bowl(o.bowler).maidens++;
    const squad = squadOf(m, battingTeam(m, inn));
    return {
      innings: inn, team: battingTeam(m, inn), ...inningsSummary(m, inn),
      batting: [...bats.values()],
      yetToBat: squad.filter((p) => !bats.has(p)),
      bowling: [...bowls.values()].map((w) => ({ ...w, overs: ov(w.legal), economy: w.legal ? +(w.runs / (w.legal / 6)).toFixed(2) : 0 })),
      fow,
      overList: overs.filter(Boolean).map(({ bowlerRuns: br, ...o }) => ({ ...o, maiden: o.legal === 6 && br === 0 })),
      partnership: { runs: pRuns, balls: pBalls }
    };
  });
}

const ballLabel = (b) => {
  if (wicketOf(b)) return 'W';
  const n = (b.runs || 0) + (b.extraRuns || 0);
  return { wide: `${n ? n + 1 : ''}Wd`, noball: `${b.runs ? b.runs + 1 : ''}Nb`, bye: `${n}B`, legbye: `${n}Lb`, none: String(n) }[b.extra];
};

// Career stats for every player, recalculated from all matches.
function computeStats(matches) {
  const S = {};
  const g = (pid) => (S[pid] ||= { matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, notOuts: 0, highest: 0, fifties: 0, hundreds: 0, ducks: 0,
    wickets: 0, legalBowled: 0, conceded: 0, maidens: 0, dots: 0, fiveWickets: 0, best: null, catches: 0, stumpings: 0, runOuts: 0 });
  for (const m of matches) {
    if (m.status !== 'scheduled') [...m.playersA, ...m.playersB].forEach((p) => g(String(p)).matches++);
    const perInn = {}, outKeys = new Map(), bowlInn = {}, overs = {}, legalCt = {};
    for (const b of m.balls) {
      const bt = id(b.batsman), bw = id(b.bowler), bs = g(bt), key = `${b.innings}-${bt}`;
      bs.runs += b.runs || 0;
      if (b.extra !== 'wide') bs.balls++;
      if (b.runs === 4) bs.fours++;
      if (b.runs === 6) bs.sixes++;
      perInn[key] = (perInn[key] || 0) + (b.runs || 0);
      bs.highest = Math.max(bs.highest, perInn[key]);
      const w = g(bw), br = bowlerRuns(b), bi = (bowlInn[`${b.innings}-${bw}`] ||= { pid: bw, w: 0, r: 0 });
      w.conceded += br; bi.r += br;
      const idx = Math.floor((legalCt[b.innings] || 0) / 6);
      const o = (overs[`${b.innings}-${idx}`] ||= { pid: bw, legal: 0, runs: 0 });
      o.runs += br;
      if (isLegal(b)) { w.legalBowled++; o.legal++; legalCt[b.innings] = (legalCt[b.innings] || 0) + 1; if (br === 0) w.dots++; }
      const wk = wicketOf(b);
      if (wk) {
        const po = id(wk.playerOut);
        g(po).outs++; outKeys.set(`${b.innings}-${po}`, po);
        if (BOWLER_KINDS.includes(wk.kind)) { w.wickets++; bi.w++; }
        const f = id(wk.fielder);
        if (f) { if (wk.kind === 'caught') g(f).catches++; else if (wk.kind === 'stumped') g(f).stumpings++; else if (wk.kind === 'run out') g(f).runOuts++; }
      }
    }
    const seen = new Set();
    for (const b of m.balls) for (const pid of [id(b.batsman), id(b.nonStriker)]) { const k = `${b.innings}-${pid}`; if (pid && !seen.has(k)) { seen.add(k); g(pid).innings++; } }
    for (const [k, r] of Object.entries(perInn)) { const pid = k.split('-')[1]; if (r >= 100) g(pid).hundreds++; else if (r >= 50) g(pid).fifties++; }
    for (const [k, pid] of outKeys) if (!perInn[k]) g(pid).ducks++;
    for (const o of Object.values(overs)) if (o.legal === 6 && o.runs === 0) g(o.pid).maidens++;
    for (const bi of Object.values(bowlInn)) {
      const s = g(bi.pid);
      if (bi.w >= 5) s.fiveWickets++;
      if (bi.w > 0 && (!s.best || bi.w > s.best.w || (bi.w === s.best.w && bi.r < s.best.r))) s.best = { w: bi.w, r: bi.r };
    }
  }
  for (const s of Object.values(S)) {
    s.notOuts = Math.max(0, s.innings - s.outs);
    s.average = s.outs ? +(s.runs / s.outs).toFixed(1) : null;
    s.strikeRate = s.balls ? +((s.runs / s.balls) * 100).toFixed(1) : null;
    s.overs = ov(s.legalBowled);
    s.economy = s.legalBowled ? +(s.conceded / (s.legalBowled / 6)).toFixed(2) : null;
    s.bowlAverage = s.wickets ? +(s.conceded / s.wickets).toFixed(1) : null;
    s.bowlStrikeRate = s.wickets ? +(s.legalBowled / s.wickets).toFixed(1) : null;
  }
  return S;
}

// Points table for one tournament: 2 points for a win, 1 each for a tie, with net run rate.
function computeTable(matches, tournament, registered = []) {
  const T = {};
  const g = (n) => (T[n] ||= { team: n, played: 0, won: 0, lost: 0, tied: 0, points: 0, rf: 0, of: 0, ra: 0, oa: 0 });
  registered.forEach(g); // every team taking part is listed, even before it plays
  for (const m of matches) {
    if ((m.tournament || '') !== tournament) continue;
    g(m.teamA); g(m.teamB);
    if (m.status !== 'completed' || m.noResult) continue; // abandoned matches give no points
    const s1 = inningsSummary(m, 1), s2 = inningsSummary(m, 2), t1 = battingTeam(m, 1), t2 = battingTeam(m, 2);
    const faced = (s, inn) => (s.wickets >= maxWickets(m, inn) ? m.overs : s.legal / 6); // all out counts as the full quota
    const A = g(t1), B = g(t2);
    A.rf += s1.runs; A.of += faced(s1, 1); A.ra += s2.runs; A.oa += faced(s2, 2);
    B.rf += s2.runs; B.of += faced(s2, 2); B.ra += s1.runs; B.oa += faced(s1, 1);
    A.played++; B.played++;
    if (m.winner) { const W = g(m.winner), L = m.winner === t1 ? B : A; W.won++; W.points += 2; L.lost++; }
    else { A.tied++; B.tied++; A.points++; B.points++; }
  }
  return Object.values(T)
    .map(({ rf, of, ra, oa, ...r }) => ({ ...r, nrr: of && oa ? +(rf / of - ra / oa).toFixed(3) : 0 }))
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr || a.team.localeCompare(b.team));
}

// Result if the scorer ends the match now. "noresult" = abandoned. Otherwise the side ahead wins, but only once the second innings has started.
function endResult(m, mode) {
  const none = { result: 'No result (match ended early)', winner: '', noResult: true };
  if (mode === 'noresult' || m.currentInnings !== 2) return none;
  const s1 = inningsSummary(m, 1), s2 = inningsSummary(m, 2), t1 = battingTeam(m, 1), t2 = battingTeam(m, 2);
  if (!s2.legal) return none;
  if (s2.runs > s1.runs) return { result: `${t2} won by ${plural(maxWickets(m, 2) - s2.wickets, 'wicket')} (match ended early)`, winner: t2, noResult: false };
  if (s2.runs < s1.runs) return { result: `${t1} won by ${plural(s1.runs - s2.runs, 'run')} (match ended early)`, winner: t1, noResult: false };
  return { result: 'Match tied (match ended early)', winner: '', noResult: false };
}

export { endResult, KINDS, BOWLER_KINDS, id, isLegal, battingTeam, bowlingTeam, squadOf, inningsSummary, derive, summary, scorecard, outIds, ballLabel, computeStats, computeTable, allowedKinds, isFreeHit, rules, maxBowlerOvers, lastOverBowler };
