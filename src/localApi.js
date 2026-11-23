// Cric365 runs entirely on this device: no server, no database, no internet.
// This file does what the old Express + MongoDB backend did, and keeps everything in the phone's own storage.
import * as S from './scoring.js';

const ROLES = ['Captain', 'Vice Captain', 'All-Rounder', 'Bowling All-Rounder', 'Batsman', 'Bowler', 'Wicket-Keeper'];
const TAGS = ['Main', 'Domestic', 'Outside', 'Academy', 'Other'];
const EXTRAS = ['none', 'wide', 'noball', 'bye', 'legbye'];

// ---------- Storage: IndexedDB (big, for logos and photos), then localStorage, then memory ----------
const DB_NAME = 'cric365', STORE = 'kv', KEY = 'state';
const blank = () => ({ users: [], teams: [], players: [], tournaments: [], matches: [], session: null });
let db = blank();
let idb = null;

const openIdb = () => new Promise((resolve) => {
  try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});
const idbGet = () => new Promise((resolve) => {
  try { const r = idb.transaction(STORE).objectStore(STORE).get(KEY); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); } catch { resolve(null); }
});
let saving = Promise.resolve();
const save = () => {
  const snapshot = JSON.stringify(db);
  saving = saving.then(() => new Promise((resolve) => {
    if (idb) {
      try { const tx = idb.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(snapshot, KEY); tx.oncomplete = resolve; tx.onerror = resolve; tx.onabort = resolve; return; } catch { /* fall through */ }
    }
    try { localStorage.setItem('cric365_db', snapshot); } catch { /* memory only */ }
    resolve();
  }));
  return saving;
};

const ready = (async () => {
  let raw = null;
  if (typeof indexedDB !== 'undefined') { idb = await openIdb(); if (idb) raw = await idbGet(); }
  if (!raw) { try { raw = localStorage.getItem('cric365_db'); } catch { /* none */ } }
  if (raw) { try { db = { ...blank(), ...JSON.parse(raw) }; } catch { db = blank(); } }
})();

// ---------- Small helpers ----------
const rnd = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(16).slice(2) + Date.now().toString(16));
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (m) => { throw new Error(m); };
const trim = (s) => String(s == null ? '' : s).trim();
const listeners = new Set();
const notify = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });

const uid = () => (db.session && db.users.some((u) => u._id === db.session) ? db.session : fail('Please sign in.'));
const mine = (k) => db[k].filter((x) => x.owner === uid());
const byId = (k, id) => db[k].find((x) => x._id === id && x.owner === uid());

// Every change goes through here: run it, save, and tell open screens to refresh.
const mutate = async (fn) => { await ready; const out = fn(); await save(); notify(); return out; };
const read = async (fn) => { await ready; return fn(); };

// ---------- Accounts (stored on this device only) ----------
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hash(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (globalThis.crypto && crypto.subtle) return toHex(await crypto.subtle.digest('SHA-256', data));
  let h = 5381; for (const c of data) h = ((h * 33) ^ c) >>> 0; return String(h); // very old WebView fallback
}
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, club: u.club });

async function signup({ name, email, password, club } = {}) {
  await ready;
  if (!trim(name)) fail('Please enter your name');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) fail('Please enter a valid email');
  if (!password || String(password).length < 6) fail('Password must be at least 6 characters');
  const mail = trim(email).toLowerCase();
  if (db.users.some((u) => u.email === mail)) fail('An account with this email already exists. Please sign in.');
  const clubName = trim(club) || `${trim(name)}'s Club`;
  const salt = rnd();
  const u = { _id: rnd(), name: trim(name), email: mail, salt, passHash: await hash(password, salt), club: clubName, createdAt: now() };
  db.users.push(u);
  db.teams.push({ _id: rnd(), owner: u._id, name: clubName, tag: 'Main', locked: true, city: '', formedYear: 2024, logoUrl: '', kitColor: '#0E3B2C', kitColor2: '#E3A81B', createdAt: now(), updatedAt: now() });
  db.session = u._id;
  await save(); notify();
  return { token: `local:${u._id}`, user: publicUser(u) };
}
async function login(email, password) {
  await ready;
  const u = db.users.find((x) => x.email === trim(email).toLowerCase());
  if (!u || (await hash(password, u.salt)) !== u.passHash) fail('Wrong email or password.');
  db.session = u._id; await save();
  return { token: `local:${u._id}`, user: publicUser(u) };
}
const me = () => read(() => { const u = db.users.find((x) => x._id === db.session); if (!u) fail('Please sign in.'); return { user: publicUser(u) }; });
const signOut = async () => { await ready; db.session = null; await save(); };

// ---------- Team membership rules ----------
function resolveTeams(names) {
  const all = mine('teams');
  const list = [...new Set((names || []).filter(Boolean))];
  const docs = list.map((n) => all.find((x) => x.name === n) || fail(`Team "${n}" not found`));
  const main = all.find((t) => t.tag === 'Main');
  if (main && docs.some((t) => t.tag === 'Domestic') && !list.includes(main.name)) list.unshift(main.name);
  if (!list.length) fail('Choose a team');
  return list;
}
// Removing a player from their last team removes them. With match history they stay as inactive so old scorecards keep the name.
function retire(p) {
  const used = db.matches.some((m) => m.owner === p.owner && [...m.playersA, ...m.playersB].includes(p._id));
  if (used) { p.teams = []; p.active = false; p.updatedAt = now(); return 'archived'; }
  db.players = db.players.filter((x) => x !== p);
  return 'removed';
}
const findPlayer = (id) => byId('players', id) || fail('Player not found');
const slug = (s) => String(s).normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase() || 'PLAYER';
function nextPlayerId(name, jerseyNo) {
  const base = `${slug(name)}-${String(Number(jerseyNo) || 0).padStart(2, '0')}`;
  let id = base, n = 1;
  while (mine('players').some((p) => p.playerId === id)) id = `${base}-${++n}`;
  return id;
}
const checkRole = (r) => { if (!r) fail('Player role is required'); if (!ROLES.includes(r)) fail(`"${r}" is not a valid role`); };
function newPlayer({ name, role, jerseyNo, imageUrl }, teams) {
  const p = { _id: rnd(), owner: uid(), playerId: nextPlayerId(name, jerseyNo), name: trim(name), role, jerseyNo: Number(jerseyNo) || 0, teams, active: true, imageUrl: imageUrl || '', createdAt: now(), updatedAt: now() };
  db.players.push(p);
  return p;
}

// ---------- Matches ----------
const lastBallInfo = (b) => ({
  batsman: String(b.batsman), bowler: String(b.bowler),
  wicket: b.wicket && b.wicket.kind ? { kind: b.wicket.kind, fielder: b.wicket.fielder ? String(b.wicket.fielder) : null, playerOut: b.wicket.playerOut ? String(b.wicket.playerOut) : null } : null
});
const matchOut = (doc) => {
  const o = clone(doc);
  const { balls, ...rest } = o;
  const rules = o.status === 'live' ? S.rules(o, o.currentInnings) : null;
  const kinds = rules && Object.fromEntries(EXTRAS.map((x) => [x, S.allowedKinds(x, rules.freeHit)]));
  return { ...rest, crease: o.crease || {}, ballCount: balls.length, lastBall: balls.length ? S.ballLabel(balls[balls.length - 1]) : null, last: balls.length ? lastBallInfo(balls[balls.length - 1]) : null, endPreview: o.status === 'live' ? S.endResult(o, 'result') : null, recent: balls.filter((b) => b.innings === o.currentInnings).slice(-12).map(S.ballLabel), summary: S.summary(o), card: S.scorecard(o), rules, kinds };
};
const findMatch = (id) => byId('matches', id) || fail('Match not found');
const touch = (m) => { m.updatedAt = now(); return m; };

// ---------- Sample data ----------
const SAMPLE_TEAMS = [
  { name: 'Green Storm', tag: 'Domestic', formedYear: 2021, kitColor: '#1E8C4E', kitColor2: '#0B2B1C' },
  { name: 'Shani Sixers', tag: 'Domestic', formedYear: 2021, kitColor: '#6A2C91', kitColor2: '#F2C230' },
  { name: 'Shaheen 11', tag: 'Domestic', formedYear: 2022, kitColor: '#1F4FA8', kitColor2: '#E8EEF9' },
  { name: 'Wah Warriors', tag: 'Outside', formedYear: 2022, kitColor: '#B3261E', kitColor2: '#F4F6F2' },
  { name: 'Taxila Tigers', tag: 'Outside', formedYear: 2023, kitColor: '#D9822B', kitColor2: '#1A1A1A' }
];
const SAMPLE_TOURNAMENTS = [
  { name: 'Test Championship', kind: 'Domestic', overs: 20, teams: ['Green Storm', 'Shani Sixers', 'Shaheen 11'] },
  { name: 'Azadi Cup', kind: 'Domestic', overs: 20, teams: ['Green Storm', 'Shani Sixers'] },
  { name: 'Champions Tournament', kind: 'Open', overs: 20, teams: ['Green Storm', 'Wah Warriors', 'Taxila Tigers'] }
];
const SAMPLE_ROLES = ['Captain', 'Vice Captain', 'Wicket-Keeper', 'All-Rounder', 'All-Rounder', 'Bowling All-Rounder', 'Bowling All-Rounder', 'Batsman', 'Batsman', 'Bowler', 'Bowler'];
const SAMPLE_SQUADS = {
  'Green Storm': ['Ahmed Raza', 'Zain Abbas', 'Bilal Khan', 'Talha Mehmood', 'Adeel Farooq', 'Hamza Tariq', 'Waqas Ahmad', 'Rizwan Qureshi', 'Shoaib Anwar', 'Imran Yousaf', 'Arslan Haider'],
  'Shani Sixers': ['Usman Ali', 'Faizan Malik', 'Haseeb Nawaz', 'Fahad Mirza', 'Yasir Latif', 'Saad Hussain', 'Moiz Siddiqui', 'Taimoor Zafar', 'Owais Rana', 'Noman Iqbal', 'Junaid Akram'],
  'Shaheen 11': ['Daniyal Shah', 'Kamran Butt', 'Asad Cheema', 'Mubashir Gill', 'Furqan Dar', 'Ibrahim Sheikh', 'Salman Rafiq', 'Tayyab Niazi', 'Waleed Aziz', 'Rehan Javed', 'Hassan Mushtaq'],
  'Wah Warriors': ['Anas Pervaiz', 'Haris Naeem', 'Mohsin Kayani', 'Zeeshan Abid', 'Adnan Sabir', 'Shahzaib Rauf', 'Naveed Akhtar', 'Sameer Bukhari', 'Qasim Ghafoor', 'Tariq Mansoor', 'Ammar Hanif'],
  'Taxila Tigers': ['Fawad Alam', 'Rashid Minhas', 'Irfan Baig', 'Sohail Tanvir', 'Babar Hayat', 'Jamal Uddin', 'Nasir Chaudhry', 'Kashif Lodhi', 'Mazhar Gondal', 'Danish Awan', 'Zubair Satti']
};
const JERSEY_BASE = { 'Green Storm': 0, 'Shani Sixers': 20, 'Shaheen 11': 40, 'Wah Warriors': 60, 'Taxila Tigers': 80 };

// ---------- The API (same shape the screens already use) ----------
export const api = {
  login, signup, me, signOut,
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

  loadSample: () => mutate(() => {
    const owner = uid(), main = mine('teams').find((t) => t.tag === 'Main');
    const have = new Set(mine('teams').map((t) => t.name));
    const fresh = SAMPLE_TEAMS.filter((t) => !have.has(t.name));
    fresh.forEach((t) => db.teams.push({ _id: rnd(), owner, locked: false, city: '', logoUrl: '', createdAt: now(), updatedAt: now(), ...t }));
    let added = 0;
    for (const [team, names] of Object.entries(SAMPLE_SQUADS)) {
      const domestic = SAMPLE_TEAMS.find((t) => t.name === team).tag === 'Domestic';
      names.forEach((name, i) => {
        const jerseyNo = i + 1 + JERSEY_BASE[team];
        if (mine('players').some((p) => p.name === name && p.jerseyNo === jerseyNo)) return;
        newPlayer({ name, role: SAMPLE_ROLES[i], jerseyNo }, domestic && main ? [main.name, team] : [team]);
        added++;
      });
    }
    for (const t of SAMPLE_TOURNAMENTS) if (!mine('tournaments').some((x) => x.name === t.name)) db.tournaments.push({ _id: rnd(), owner, createdAt: now(), updatedAt: now(), ...t });
    return { teams: fresh.length, players: added };
  }),

  // Players
  players: () => read(() => clone(mine('players')).sort((a, b) => (a.jerseyNo - b.jerseyNo) || a.name.localeCompare(b.name))),
  addPlayer: (d) => mutate(() => {
    const { name, role, jerseyNo, imageUrl, teams } = d || {};
    if (!trim(name)) fail('Player name is required');
    checkRole(role);
    const dup = mine('players').find((p) => p.name.toLowerCase() === trim(name).toLowerCase() && p.jerseyNo === (Number(jerseyNo) || 0));
    if (dup) fail(`${dup.name} #${dup.jerseyNo} already exists (ID ${dup.playerId}). Open their card and use Teams to add them to another team, so their stats stay in one place.`);
    return clone(newPlayer({ name, role, jerseyNo, imageUrl }, resolveTeams(teams)));
  }),
  updatePlayer: (id, d) => mutate(() => {
    const p = byId('players', id) || fail('Player not found');
    if (d.name !== undefined) { if (!trim(d.name)) fail('Player name is required'); p.name = trim(d.name); }
    if (d.role !== undefined) { checkRole(d.role); p.role = d.role; }
    if (d.jerseyNo !== undefined) p.jerseyNo = Number(d.jerseyNo) || 0;
    if (d.imageUrl !== undefined) p.imageUrl = d.imageUrl || '';
    p.updatedAt = now();
    return clone(p);
  }),
  removePlayer: (id) => mutate(() => ({ message: `Player ${retire(findPlayer(id))}` })),
  addToTeam: (id, team, from) => mutate(() => {
    const p = findPlayer(id);
    if (!mine('teams').some((t) => t.name === team)) fail(`Team "${team}" not found`);
    if (p.teams.includes(team)) fail(`${p.name} is already in ${team}`);
    let names = [...p.teams, team];
    if (from) {
      const src = mine('teams').find((t) => t.name === from);
      if (!src || !p.teams.includes(from)) fail(`${p.name} is not in ${from}`);
      if (src.tag === 'Main') fail('Players cannot be moved out of the Main team. Remove them instead.');
      names = names.filter((n) => n !== from);
    }
    p.teams = resolveTeams(names); p.active = true; p.updatedAt = now();
    return clone(p);
  }),
  removeFromTeam: (id, team) => mutate(() => {
    const p = findPlayer(id);
    if (!p.teams.includes(team)) fail(`${p.name} is not in ${team}`);
    const t = mine('teams').find((x) => x.name === team);
    let next;
    if (t && t.tag === 'Main') { const dom = mine('teams').filter((x) => x.tag === 'Domestic').map((x) => x.name); next = p.teams.filter((n) => n !== team && !dom.includes(n)); }
    else next = p.teams.filter((n) => n !== team);
    if (!next.length) return { message: `Player ${retire(p)}` };
    p.teams = next; p.updatedAt = now();
    return clone(p);
  }),

  // Teams
  teams: () => read(() => clone(mine('teams')).sort((a, b) => a.tag.localeCompare(b.tag) || a.name.localeCompare(b.name))),
  addTeam: (d) => mutate(() => {
    const { name, tag, city, kitColor, kitColor2, logoUrl } = d || {};
    if (!TAGS.includes(tag) || tag === 'Main') fail('Choose a tag: Domestic, Outside, Academy or Other. Your Main team already exists.');
    if (!trim(name)) fail('Team name is required');
    if (mine('teams').some((t) => t.name === trim(name))) fail('That name already exists');
    const t = { _id: rnd(), owner: uid(), name: trim(name), tag, locked: false, city: city || '', formedYear: 2024, logoUrl: logoUrl || '', kitColor: kitColor || '#0E3B2C', kitColor2: kitColor2 || '#E3A81B', createdAt: now(), updatedAt: now() };
    db.teams.push(t);
    return clone(t);
  }),
  updateTeam: (id, d) => mutate(() => {
    const cur = byId('teams', id) || fail('Team not found');
    const { logoUrl, kitColor, kitColor2, city, tag } = d;
    if (tag && tag !== cur.tag) {
      if (cur.tag === 'Main' || tag === 'Main') fail('The Main team tag cannot be changed.');
      if (!TAGS.includes(tag)) fail('Unknown tag');
      cur.tag = tag;
    }
    if (logoUrl !== undefined) cur.logoUrl = logoUrl;
    if (kitColor !== undefined) cur.kitColor = kitColor;
    if (kitColor2 !== undefined) cur.kitColor2 = kitColor2;
    if (city !== undefined) cur.city = city;
    cur.updatedAt = now();
    // A team that becomes Domestic: its players become Main team members too.
    if (tag === 'Domestic') {
      const main = mine('teams').find((t) => t.tag === 'Main');
      if (main) mine('players').forEach((p) => { if (p.teams.includes(cur.name) && !p.teams.includes(main.name)) p.teams.push(main.name); });
    }
    return clone(cur);
  }),
  removeTeam: (id) => mutate(() => {
    const team = byId('teams', id) || fail('Team not found');
    if (team.locked || team.tag === 'Main') fail('The Main team can never be removed. You can remove its players.');
    const count = mine('players').filter((p) => p.teams.includes(team.name)).length;
    if (count) fail(`${team.name} still has ${count} player(s). Remove them from the team first.`);
    if (mine('matches').some((m) => m.teamA === team.name || m.teamB === team.name)) fail(`${team.name} has matches on record.`);
    db.teams = db.teams.filter((t) => t !== team);
    return { message: 'Team removed' };
  }),

  // Tournaments
  tournaments: () => read(() => clone(mine('tournaments')).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))),
  addTournament: (d) => mutate(() => {
    const { name, kind, overs, teams } = d || {};
    if (!['Domestic', 'Open'].includes(kind)) fail('Choose Domestic or Open');
    if (!trim(name)) fail('Tournament name is required');
    const list = tournamentTeams(teams);
    if (mine('tournaments').some((t) => t.name === trim(name))) fail('That name already exists');
    const t = { _id: rnd(), owner: uid(), name: trim(name), kind, teams: list, overs: Math.min(50, Math.max(1, Number(overs) || 20)), createdAt: now(), updatedAt: now() };
    db.tournaments.push(t);
    return clone(t);
  }),
  setTournamentTeams: (id, teams) => mutate(() => {
    const t = byId('tournaments', id) || fail('Tournament not found');
    const list = tournamentTeams(teams);
    const played = new Set(mine('matches').filter((m) => m.tournament === t.name).flatMap((m) => [m.teamA, m.teamB]));
    const stuck = [...played].filter((n) => !list.includes(n));
    if (stuck.length) fail(`${stuck.join(', ')} already has matches in ${t.name}, so it must stay.`);
    t.teams = list; t.updatedAt = now();
    return clone(t);
  }),
  removeTournament: (id) => mutate(() => {
    const t = byId('tournaments', id) || fail('Tournament not found');
    if (mine('matches').some((m) => m.tournament === t.name)) fail(`${t.name} has matches on record, so it cannot be removed.`);
    db.tournaments = db.tournaments.filter((x) => x !== t);
    return { message: 'Tournament removed' };
  }),
  tables: () => read(() => {
    const ms = clone(mine('matches'));
    const out = Object.fromEntries(mine('tournaments').map((t) => [t.name, S.computeTable(ms, t.name, t.teams)]));
    out.__friendly = S.computeTable(ms, '', []);
    return out;
  }),

  // Matches & scoring
  matches: () => read(() => mine('matches').slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(matchOut)),
  stats: () => read(() => S.computeStats(clone(mine('matches')))),
  createMatch: (d) => mutate(() => {
    const { tournament, stage, teamA, teamB, overs, tossWinner, decision } = d || {};
    const t = tournament ? mine('tournaments').find((x) => x.name === tournament) : null;
    if (tournament && !t) fail('Tournament not found');
    if (!teamA || !teamB || teamA === teamB) fail('Pick two different teams');
    const teams = mine('teams');
    if (!teams.some((x) => x.name === teamA) || !teams.some((x) => x.name === teamB)) fail('Team not found');
    if (t && t.teams.length && ![teamA, teamB].every((n) => t.teams.includes(n))) fail(`Both teams must be taking part in ${t.name}. Add them to the tournament first.`);
    const pick = (n, chosen) => {
      const pool = mine('players').filter((p) => p.active && p.teams.includes(n)).sort((a, b) => (a.jerseyNo - b.jerseyNo) || a.name.localeCompare(b.name)).map((p) => p._id);
      const ids = Array.isArray(chosen) && chosen.length ? chosen.map(String) : pool.slice(0, 11);
      if (ids.some((x) => !pool.includes(x))) fail(`Every player must be a member of ${n}`);
      if (new Set(ids).size !== ids.length) fail('A player was chosen twice');
      if (ids.length < 2 || ids.length > 11) fail(`${n}: choose between 2 and 11 players`);
      return ids;
    };
    const playersA = pick(teamA, d.playersA), playersB = pick(teamB, d.playersB);
    const both = playersA.filter((x) => playersB.includes(x));
    if (both.length) { const p = byId('players', both[0]); fail(`${p ? p.name : 'A player'} is chosen for both teams. A player can only play for one side in a match.`); }
    const toss = tossWinner === teamB ? teamB : teamA, dec = decision === 'bowl' ? 'bowl' : 'bat';
    const other = toss === teamA ? teamB : teamA;
    const m = {
      _id: rnd(), owner: uid(), title: `${teamA} vs ${teamB}`, tournament: t ? t.name : '', category: t ? t.kind : 'Domestic', stage: t ? (trim(stage) || 'League') : 'Friendly',
      teamA, teamB, playersA, playersB, overs: Math.min(50, Math.max(1, Number(overs) || (t && t.overs) || 20)), tossWinner: toss, tossDecision: dec, battingFirst: dec === 'bat' ? toss : other,
      status: 'scheduled', currentInnings: 1, crease: { striker: null, nonStriker: null, bowler: null }, balls: [], result: '', winner: '', manualEnd: false, noResult: false, createdAt: now(), updatedAt: now()
    };
    db.matches.push(m);
    return matchOut(m);
  }),
  startMatch: (id) => mutate(() => {
    const m = findMatch(id);
    if (m.status !== 'scheduled') fail('Match already started');
    m.status = 'live';
    return matchOut(touch(m));
  }),
  setCrease: (id, body) => mutate(() => {
    const m = findMatch(id);
    if (m.status !== 'live') fail('Match is not live');
    const inn = m.currentInnings;
    const bat = S.squadOf(m, S.battingTeam(m, inn)), bowl = S.squadOf(m, S.bowlingTeam(m, inn));
    const c = m.crease || {};
    const next = { striker: S.id(c.striker), nonStriker: S.id(c.nonStriker), bowler: S.id(c.bowler) };
    for (const k of Object.keys(next)) if (k in body) next[k] = body[k] || null;
    const out = S.outIds(m, inn);
    for (const k of ['striker', 'nonStriker']) {
      if (next[k] && !bat.includes(next[k])) fail('That player is not in the batting team');
      if (next[k] && out.includes(next[k])) fail('That batter is already out');
    }
    if (next.striker && next.striker === next.nonStriker) fail('Striker and non-striker must be different');
    if (next.bowler) {
      if (!bowl.includes(next.bowler)) fail('That player is not in the bowling team');
      const r = S.rules(m, inn), bowled = m.balls.filter((b) => b.innings === inn && S.isLegal(b) && S.id(b.bowler) === next.bowler).length;
      if (r.lastBowler === next.bowler && bowl.length > 1) fail('The same bowler cannot bowl two overs in a row');
      if (bowled >= r.maxBowlerOvers * 6) fail(`A bowler can bowl at most ${r.maxBowlerOvers} overs in this match`);
    }
    m.crease = next;
    return matchOut(touch(m));
  }),
  addBall: (id, body) => mutate(() => {
    const m = findMatch(id);
    if (m.status !== 'live') fail('Match is not live');
    const c = m.crease || {};
    if (!c.striker || !c.nonStriker || !c.bowler) fail('Select striker, non-striker and bowler first');
    const { runs = 0, extra = 'none', extraRuns = 0, wicket } = body || {};
    if (!EXTRAS.includes(extra)) fail('Unknown extra');
    const nRuns = Math.floor(Number(runs) || 0), nExtra = Math.floor(Number(extraRuns) || 0);
    if (nRuns < 0 || nRuns > 7 || nExtra < 0 || nExtra > 7) fail('Runs must be between 0 and 7');
    if (extra !== 'none' && extra !== 'noball' && nRuns) fail('Runs off the bat cannot be scored on a wide, bye or leg bye');
    const crease = { striker: S.id(c.striker), nonStriker: S.id(c.nonStriker), bowler: S.id(c.bowler) };
    const free = S.isFreeHit(m, m.currentInnings);
    const ball = { innings: m.currentInnings, batsman: crease.striker, nonStriker: crease.nonStriker, bowler: crease.bowler, runs: nRuns, extra, extraRuns: nExtra, freeHit: free, creaseBefore: crease };
    if (wicket && wicket.kind) {
      if (!S.KINDS.includes(wicket.kind)) fail('Unknown dismissal');
      if (!S.allowedKinds(extra, free).includes(wicket.kind))
        fail(free ? 'This is a free hit. Only a run out is possible.' : `A batter cannot be out ${wicket.kind} on a ${extra === 'noball' ? 'no ball' : extra === 'legbye' ? 'leg bye' : extra}.`);
      const out = S.id(wicket.playerOut || crease.striker);
      if (![crease.striker, crease.nonStriker].includes(out)) fail('Only a batter at the crease can be out');
      ball.wicket = { kind: wicket.kind, playerOut: out, fielder: wicket.fielder || null };
      if (ball.wicket.fielder) {
        const bowlSide = S.squadOf(m, S.bowlingTeam(m, m.currentInnings));
        if (!bowlSide.includes(S.id(ball.wicket.fielder))) fail('The fielder must be in the bowling team');
      }
      if (wicket.kind === 'caught' && !ball.wicket.fielder) fail('Choose who took the catch');
      if (wicket.kind === 'stumped' && !ball.wicket.fielder) fail('Choose the wicket-keeper');
    }
    m.balls.push(ball);
    let { striker, nonStriker, bowler } = crease;
    if ((ball.runs + ball.extraRuns) % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    if (ball.wicket) { const o = S.id(ball.wicket.playerOut); if (striker === o) striker = null; else if (nonStriker === o) nonStriker = null; }
    const inn = S.inningsSummary(m, ball.innings);
    if (S.isLegal(ball) && inn.legal % 6 === 0) { [striker, nonStriker] = [nonStriker, striker]; bowler = null; }
    const d = S.derive(m);
    const reset = d.currentInnings !== ball.innings || d.status === 'completed';
    Object.assign(m, d);
    m.crease = reset ? { striker: null, nonStriker: null, bowler: null } : { striker, nonStriker, bowler };
    return matchOut(touch(m));
  }),
  endMatch: (id, mode) => mutate(() => {
    const m = findMatch(id);
    if (m.status !== 'live') fail('Only a live match can be ended');
    const r = S.endResult(m, mode === 'noresult' ? 'noresult' : 'result');
    Object.assign(m, { status: 'completed', result: r.result, winner: r.winner, noResult: r.noResult, manualEnd: true });
    return matchOut(touch(m));
  }),
  resumeMatch: (id) => mutate(() => {
    const m = findMatch(id);
    if (!m.manualEnd) fail('This match was not ended early');
    m.manualEnd = false; m.noResult = false;
    Object.assign(m, S.derive(m));
    if (m.status === 'scheduled') m.status = 'live';
    return matchOut(touch(m));
  }),
  undoBall: (id) => mutate(() => {
    const m = findMatch(id);
    if (!m.balls.length) fail('No balls to undo');
    const last = m.balls.pop();
    m.manualEnd = false; m.noResult = false;
    Object.assign(m, S.derive(m));
    m.crease = last.creaseBefore;
    return matchOut(touch(m));
  }),
  removeMatch: (id) => mutate(() => { db.matches = db.matches.filter((m) => !(m._id === id && m.owner === uid())); return { message: 'Match removed' }; }),

  // Backup: your data lives only on this phone, so save a copy now and then.
  exportData: () => read(() => JSON.stringify(db)),
  importData: (text) => mutate(() => {
    let d; try { d = JSON.parse(text); } catch { fail('That is not a Cric365 backup file'); }
    if (!d || !Array.isArray(d.users) || !Array.isArray(d.matches)) fail('That is not a Cric365 backup file');
    db = { ...blank(), ...d };
  })
};

function tournamentTeams(names) {
  const list = [...new Set((names || []).filter(Boolean))];
  if (list.length < 2) fail('Add at least 2 teams to the tournament');
  const have = mine('teams').map((t) => t.name);
  if (!list.every((n) => have.includes(n))) fail('One of the teams was not found');
  return list;
}
