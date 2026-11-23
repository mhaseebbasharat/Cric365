import { useMemo } from 'react';

export const BRAND = 'Cric365';
export const TAGS = ['Domestic', 'Outside', 'Academy', 'Other'];   // tags you can give a team (Main is automatic)
export const mainTeam = (teams) => teams.find((t) => t.tag === 'Main') || { name: '' };
export const ROLES = ['Captain', 'Vice Captain', 'All-Rounder', 'Bowling All-Rounder', 'Batsman', 'Bowler', 'Wicket-Keeper'];
export const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '–' : Number(v).toFixed(d));
export const useIndex = (list) => useMemo(() => Object.fromEntries(list.map((x) => [x._id, x])), [list]);
export const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
export const score = (s) => `${s.runs}/${s.wickets}`;
export const isActive = (p) => p.active !== false;
// The team shown on a player's card: first team that is not the Main team, otherwise the Main team.
export const homeTeam = (p, mainName) => (p.teams || []).find((t) => t !== mainName) || (p.teams || [])[0] || mainName;
export const dismissal = (o, nm) => {
  if (!o) return 'not out';
  const f = o.fielder ? nm(o.fielder) : '', b = o.bowler ? nm(o.bowler) : '';
  if (o.kind === 'caught') return o.fielder && o.fielder === o.bowler ? `c & b ${b}` : `c ${f} b ${b}`;
  if (o.kind === 'stumped') return `st ${f} b ${b}`;
  if (o.kind === 'run out') return f ? `run out (${f})` : 'run out';
  return `${o.kind} ${b ? 'b ' + b : ''}`.trim();
};
export const teamOf = (teams, name) => teams.find((t) => t.name === name) || { name };
export const plural = (r) => (r === 'All-Rounder' ? 'All-Rounders' : r === 'Bowling All-Rounder' ? 'Bowling All-Rounders' : r === 'Batsman' ? 'Batsmen' : r === 'Wicket-Keeper' ? 'Wicket-Keepers' : r === 'Bowler' ? 'Bowlers' : r);

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><h2>{title}</h2><button className="ghost" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

export const Tag = ({ tag }) => <span className={`tag tag-${String(tag).toLowerCase()}`}>{tag}</span>;
export const Kpi = ({ n, l }) => <div className="kpi"><strong>{n}</strong><span>{l}</span></div>;
export const Empty = ({ children }) => <p className="empty">{children}</p>;
