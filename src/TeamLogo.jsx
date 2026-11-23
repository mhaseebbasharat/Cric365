const initials = (name = '') => {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w));
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
};

// Logos are always shown round. An uploaded (cropped) logo fills the circle; otherwise a round badge
// is drawn from the team's colours and initials.
export default function TeamLogo({ team = {}, name, size = 48 }) {
  const label = team.name || name || '';
  const ring = { width: size, height: size, borderRadius: '50%', display: 'block', flexShrink: 0 };
  if (team.logoUrl) return <img src={team.logoUrl} width={size} height={size} alt={`${label} logo`} style={{ ...ring, objectFit: 'cover', background: '#0d1b16', border: '1px solid rgba(255,255,255,.14)' }} />;
  const body = team.kitColor || '#12402F', trim = team.kitColor2 || '#C8A45A';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${label} logo`} style={ring}>
      <circle cx="50" cy="50" r="49" fill={body} />
      <circle cx="50" cy="50" r="43" fill="none" stroke={trim} strokeWidth="3" />
      <text x="50" y="64" textAnchor="middle" fontFamily="Big Shoulders Display, sans-serif" fontWeight="800" fontSize="42" fill={trim}>{initials(label)}</text>
    </svg>
  );
}
