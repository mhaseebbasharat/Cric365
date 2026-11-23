import { useEffect, useMemo, useRef, useState } from 'react';
import { DURATION, CONTACT, MILESTONE_LABEL } from './fxTiming.js';

// Full-screen celebration for a 4, a 6, a wicket, or a match win. It ignores clicks and removes itself.
const LOOK = {
  four: { word: 'FOUR!', sub: 'Cracked to the boundary', crowd: ['👏', '🙌', '👏', '🎉', '👏', '🙌', '👏'], ms: 2800 },
  six: { word: 'SIX!', sub: 'That is out of the ground!', crowd: ['🙌', '🎉', '🙌', '🤩', '🙌', '🎉', '🙌'], ms: 3200 },
  wicket: { word: 'OUT!', sub: 'Wicket!', crowd: ['😮', '👏', '😮', '👏', '😮'], ms: 2600 },
  catch: { word: 'CAUGHT!', sub: 'Taken safely in the deep', crowd: ['😮', '🙌', '😮', '👏', '😮'], ms: 3400 },
  runout: { word: 'RUN OUT!', sub: 'Short of the crease', crowd: ['😮', '🙌', '😮', '👏', '😮'], ms: 3400 },
  milestone: { word: 'CONGRATULATIONS!', sub: '', crowd: ['👏', '🙌', '🎉', '👏', '🤩', '🙌', '👏', '🎊', '👏'], ms: 6500 },
  win: { word: 'WINNERS!', sub: '', crowd: ['🎉', '🙌', '🏆', '🙌', '🎉', '👏', '🎊'], ms: 5000 }
};
const COLORS = { milestone: ['#c8a45a', '#ffd76a', '#ffffff', '#3fb67b', '#e5484d'], four: ['#3fb67b', '#8be3b3', '#ffffff', '#c8a45a'], six: ['#c8a45a', '#ffd76a', '#ffffff', '#ff8e3c'], win: ['#c8a45a', '#ffd76a', '#3fb67b', '#ffffff', '#e5484d'], wicket: [], catch: [], runout: [] };

let ctx;
// Crowd noise made in the browser (no audio files needed). Fails quietly if sound is blocked.
function applause(t) {
  // many short filtered noise bursts = hands clapping, on top of a swelling crowd roar
  const len = Math.floor(ctx.sampleRate * 0.06), clap = ctx.createBuffer(1, len, ctx.sampleRate), c = clap.getChannelData(0);
  for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18));
  const total = 6.5;
  for (let i = 0; i < 260; i++) {
    const at = t + Math.pow(Math.random(), 1.3) * total, env = Math.min(1, (at - t) / 0.8) * Math.min(1, (t + total + 0.5 - at) / 1.5);
    const s = ctx.createBufferSource(); s.buffer = clap; s.playbackRate.value = 0.7 + Math.random() * 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 1500;
    const g = ctx.createGain(); g.gain.value = (0.05 + Math.random() * 0.12) * Math.max(0.15, env);
    s.connect(hp); hp.connect(g); g.connect(ctx.destination); s.start(at);
  }
}
function playSound(kind) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    if (kind === 'milestone') applause(ctx.currentTime);
    const t = ctx.currentTime, dur = kind === 'six' ? 2.6 : kind === 'win' ? 4 : kind === 'four' ? 1.8 : kind === 'catch' || kind === 'runout' ? 1.6 : 1.1;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kind === 'wicket' || kind === 'catch' || kind === 'runout' ? 600 : 1300; bp.Q.value = 0.6;
    const g = ctx.createGain(), peak = kind === 'six' || kind === 'win' ? 0.55 : kind === 'milestone' ? 0.3 : 0.38;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(t);
    const hit = (f0, f1, len, vol) => { // short "thwack" of bat on ball, or stumps going down
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
      og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(og); og.connect(ctx.destination); o.start(t); o.stop(t + len);
    };
    if (kind === 'four' || kind === 'six') hit(220, 70, 0.14, 0.6);
    if (kind === 'wicket' || kind === 'runout') hit(120, 45, 0.35, 0.7);   // stumps going down
    if (kind === 'catch') hit(170, 80, 0.22, 0.55);                         // ball landing in the palms
  } catch { /* sound is optional */ }
}
// The bat meeting the ball, played earlier than the main sound on a catch (the 3D scene hits the ball long before the catch is taken).
function playBat() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.14);
    g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.14);
  } catch { /* sound is optional */ }
}

const Ball = (p) => <circle r="7" fill="#d0342c" stroke="#fff" strokeWidth="1" {...p} />;
const Batter = () => (
  <g stroke="#e7ede8" strokeWidth="5" strokeLinecap="round" fill="none">
    <circle cx="100" cy="62" r="11" fill="#e7ede8" stroke="none" />
    <path d="M100 74 L100 112 M100 112 L88 148 M100 112 L114 148 M100 86 L124 100" />
    <g className="fx-swing"><path d="M124 100 L172 70" stroke="#c8a45a" strokeWidth="9" /></g>
  </g>
);

function Scene({ kind, text }) {
  if (kind === 'four') return (
    <svg viewBox="0 0 420 170" className="fx-svg">
      <line x1="0" y1="150" x2="420" y2="150" stroke="#2f7a57" strokeWidth="3" />
      <line x1="388" y1="140" x2="388" y2="160" stroke="#fff" strokeWidth="4" strokeDasharray="4 4" />
      <Batter />
      <g className="fx-roll"><Ball cx="150" cy="143" /></g>
    </svg>
  );
  if (kind === 'six') return (
    <svg viewBox="0 0 420 170" className="fx-svg">
      <line x1="0" y1="150" x2="420" y2="150" stroke="#2f7a57" strokeWidth="3" />
      <Batter />
      <g className="fx-six-x"><g className="fx-six-y"><Ball cx="150" cy="120" /></g></g>
    </svg>
  );
  if (kind === 'wicket') return (
    <svg viewBox="0 0 420 170" className="fx-svg">
      <line x1="0" y1="150" x2="420" y2="150" stroke="#2f7a57" strokeWidth="3" />
      <g className="fx-stumps" stroke="#e7ede8" strokeWidth="6" strokeLinecap="round">
        <path d="M185 150 L185 70 M210 150 L210 70 M235 150 L235 70" />
      </g>
      <path className="fx-bail1" d="M182 66 L206 66" stroke="#c8a45a" strokeWidth="5" strokeLinecap="round" />
      <path className="fx-bail2" d="M214 66 L238 66" stroke="#c8a45a" strokeWidth="5" strokeLinecap="round" />
      <g className="fx-bowled"><Ball cx="40" cy="120" /></g>
    </svg>
  );
  if (kind === 'catch') return (
    <svg viewBox="0 0 420 170" className="fx-svg">
      <line x1="0" y1="150" x2="420" y2="150" stroke="#2f7a57" strokeWidth="3" />
      <Batter />
      <g stroke="#e7ede8" strokeWidth="5" strokeLinecap="round" fill="none">
        <circle cx="340" cy="92" r="10" fill="#e7ede8" stroke="none" />
        <path d="M340 102 L340 134 M340 134 L328 150 M340 134 L352 150" />
        <path className="fx-hands" d="M340 110 L326 80 M340 110 L354 80" />
      </g>
      <g className="fx-catch-x"><g className="fx-catch-y"><Ball cx="150" cy="120" /></g></g>
    </svg>
  );
  if (kind === 'runout') return (
    <svg viewBox="0 0 420 170" className="fx-svg">
      <line x1="0" y1="150" x2="420" y2="150" stroke="#2f7a57" strokeWidth="3" />
      <line x1="330" y1="140" x2="330" y2="160" stroke="#fff" strokeWidth="4" strokeDasharray="4 4" />
      <g className="fx-runner" stroke="#e7ede8" strokeWidth="5" strokeLinecap="round" fill="none">
        <circle cx="60" cy="72" r="11" fill="#e7ede8" stroke="none" />
        <path d="M60 84 L66 118 M66 118 L52 148 M66 118 L84 140 M62 96 L88 86" />
        <path d="M88 86 L104 104" stroke="#c8a45a" strokeWidth="8" />
      </g>
      <g className="fx-ro-stumps" stroke="#e7ede8" strokeWidth="6" strokeLinecap="round">
        <path d="M365 150 L365 80 M385 150 L385 80 M405 150 L405 80" />
      </g>
      <path className="fx-bail1" d="M362 76 L380 76" stroke="#c8a45a" strokeWidth="5" strokeLinecap="round" />
      <path className="fx-bail2" d="M390 76 L408 76" stroke="#c8a45a" strokeWidth="5" strokeLinecap="round" />
      <g className="fx-throw"><Ball cx="30" cy="110" /></g>
    </svg>
  );
  return <div className="fx-trophy">{kind === 'milestone' ? '🏏' : '🏆'}<span>{text}</span></div>;
}

function Fx2D({ kind, text, sound, onDone, n }) {
  const look = LOOK[kind];
  useEffect(() => {
    if (sound) playSound(kind);
    const t = setTimeout(onDone, look.ms);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line
  const bits = useMemo(() => {
    const n = { four: 26, six: 44, win: 60, wicket: 0, catch: 0, runout: 0 }[kind], c = COLORS[kind];
    return Array.from({ length: n }, () => ({ x: Math.random() * 100, d: Math.random() * 0.8, t: 1.6 + Math.random() * 1.6, c: c[Math.floor(Math.random() * c.length)], w: 6 + Math.random() * 8 }));
  }, [kind]);
  return (
    <div className={`fx fx-${kind}`} aria-live="polite">
      <div className="fx-flash" />
      {bits.map((b, i) => <i key={i} className="fx-bit" style={{ left: `${b.x}%`, background: b.c, width: b.w, height: b.w * 1.6, animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }} />)}
      <div className="fx-center">
        <Scene kind={kind} text={text} />
        <div className="fx-word">{kind === 'win' ? `${text} WON!` : look.word}</div>
        {kind === 'milestone' ? <div className="fx-sub">{text} reaches {n}! {MILESTONE_LABEL[n]}</div> : kind !== 'win' && <div className="fx-sub">{look.sub}</div>}
      </div>
      <div className="fx-crowd">{look.crowd.map((e, i) => <span key={i} style={{ animationDelay: `${i * 0.09}s` }}>{e}</span>)}</div>
    </div>
  );
}

// ---------- 3D version: a stadium scene with players, umpire and crowd (three.js, loaded on demand) ----------
function Fx3D({ kind, text, sound, colors, onDone, onFail, n, info, outStriker }) {
  const host = useRef();
  const [cut, setCut] = useState(0);
  const look = LOOK[kind], contact = CONTACT[kind], dur = DURATION[kind];
  useEffect(() => {
    let dead = false, dispose = null; const timers = [];
    const label = { word: kind === 'milestone' ? `${n} RUNS` : kind === 'win' ? 'CHAMPIONS' : look.word.replace('!', ''), line: kind === 'win' ? text : info ? info.name : text || '' };
    import('./stage3d.js').then((m) => m.start(host.current, { kind, ...colors, label, outStriker, onFail, onCut: () => setCut((c) => c + 1) })).then((r) => {
      if (dead) { r.dispose(); return; }
      dispose = r.dispose;
      if (sound) timers.push(setTimeout(() => playSound(kind), contact * 1000));
      if (sound && kind === 'catch') timers.push(setTimeout(playBat, 2050));
      timers.push(setTimeout(onDone, dur * 1000));
    }).catch(() => !dead && onFail());
    return () => { dead = true; timers.forEach(clearTimeout); if (dispose) dispose(); };
  }, []); // eslint-disable-line
  const bits = useMemo(() => {
    const n = { four: 26, six: 44, win: 60, wicket: 0, catch: 0, runout: 0 }[kind], c = COLORS[kind];
    return Array.from({ length: n }, () => ({ x: Math.random() * 100, d: contact + Math.random() * 0.8, t: 1.8 + Math.random() * 1.6, c: c[Math.floor(Math.random() * c.length)], w: 6 + Math.random() * 8 }));
  }, [kind]); // eslint-disable-line
  return (
    <div className={`fx fx-${kind} fx-3d`} style={{ animationDelay: `${dur - 0.4}s` }} aria-live="polite">
      <div className="fx-flash" />
      <div className="fx3d" style={{ '--d': `${contact}s` }}>
        <div ref={host} className="fx3d-view" />
        <span className="fx3d-tag"><i className="dot" />CRIC365 LIVE</span>
        <div className="fx3d-bar top" /><div className="fx3d-bar bottom" />
        {cut > 0 && <div key={cut} className="fx3d-cut" />}
        {info && kind !== 'milestone' && kind !== 'win' && (
          <div className="lt">
            <b className={`lt-tag lt-${kind}`}>{look.word.replace('!', '')}</b>
            <div><div className="lt-name">{info.name}</div><div className="lt-sub">{info.sub}</div></div>
          </div>
        )}
        {kind === 'milestone' ? (
          <>
            <div className="fx3d-banner"><div className="fx-word">CONGRATULATIONS!</div></div>
            <div className="ms-card">
              <div className="ms-num">{n}</div>
              <div><div className="ms-label">{MILESTONE_LABEL[n]}</div><div className="ms-name">{text}</div></div>
            </div>
          </>
        ) : (
          <div className="fx3d-banner">
            <div className="fx-word">{kind === 'win' ? `${text} WON!` : look.word}</div>
            {kind !== 'win' && <div className="fx-sub">{look.sub}</div>}
          </div>
        )}
      </div>
      {bits.map((b, i) => <i key={i} className="fx-bit" style={{ left: `${b.x}%`, background: b.c, width: b.w, height: b.w * 1.6, animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }} />)}
    </div>
  );
}

const canWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
};

// Shows the 3D scene. If WebGL is missing, the user prefers reduced motion, or anything fails, the 2D animation is used instead.
export default function BallFx(props) {
  const [mode, setMode] = useState(() => (canWebGL() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '3d' : '2d'));
  return mode === '3d' ? <Fx3D {...props} colors={props.colors || {}} onFail={() => setMode('2d')} /> : <Fx2D {...props} />;
}
