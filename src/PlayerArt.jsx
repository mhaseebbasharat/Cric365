import TeamLogo from './TeamLogo.jsx';

// Default 250 x 500 portrait when a player has no photo: team colours, shirt number and the team logo.
export default function PlayerArt({ team = {}, number = '' }) {
  const body = team.kitColor || '#12402F', trim = team.kitColor2 || '#C8A45A';
  const g = `pa${body.replace('#', '')}`;
  return (
    <div style={{ position: 'relative', width: 250, height: 500 }}>
      <svg width="250" height="500" viewBox="0 0 250 500" role="img" aria-label="Player portrait" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={body} /><stop offset="1" stopColor="#050c09" /></linearGradient>
          <pattern id={`${g}p`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="1.2" height="14" fill="#fff" opacity=".05" /></pattern>
        </defs>
        <rect width="250" height="500" fill={`url(#${g})`} />
        <rect width="250" height="500" fill={`url(#${g}p)`} />
        <text x="125" y="205" textAnchor="middle" fontFamily="Big Shoulders Display, sans-serif" fontWeight="800" fontSize="190" fill="none" stroke={trim} strokeOpacity=".55" strokeWidth="2">{number}</text>
        <circle cx="125" cy="262" r="40" fill="#000" opacity=".35" />
        <path d="M40 420 C40 340 80 312 125 312 C170 312 210 340 210 420 L210 500 L40 500Z" fill="#000" opacity=".35" />
      </svg>
      <div style={{ position: 'absolute', top: 14, left: 14 }}><TeamLogo team={team} size={40} /></div>
    </div>
  );
}
