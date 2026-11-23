import { useEffect, useRef, useState } from 'react';
import { loadImage } from './images.js';
import { Modal } from './ui.jsx';

// Crop tool. Drag the picture to move it, use the slider (or mouse wheel) to zoom.
//   round  : the crop window is a circle and the result is shown round everywhere (team logos)
//   aspect : width / height of the crop window (1 = square, 0.5 = player card 250 x 500)
//   outW   : width in pixels of the saved picture
export default function Cropper({ file, title = 'Crop picture', round = false, aspect = 1, outW = 256, onDone, onCancel }) {
  const viewW = aspect >= 1 ? 280 : 190, viewH = Math.round(viewW / aspect);
  const [img, setImg] = useState(null);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(1);            // 1 = fits the whole picture inside, 4 = four times closer
  const [pos, setPos] = useState({ x: 0, y: 0 }); // picture centre, relative to the window centre
  const drag = useRef(null);

  useEffect(() => { loadImage(file).then(setImg).catch((e) => setErr(e.message)); }, [file]);

  const fit = img ? Math.min(viewW / img.width, viewH / img.height) : 1;      // whole picture visible
  const fill = img ? Math.max(viewW / img.width, viewH / img.height) : 1;     // window completely filled
  const scale = fit * zoom;
  const w = img ? img.width * scale : 0, h = img ? img.height * scale : 0;
  const clamp = (p, s = scale) => {
    const lim = (dim, view) => (dim <= view ? 0 : (dim - view) / 2);
    return { x: Math.max(-lim(img.width * s, viewW), Math.min(lim(img.width * s, viewW), p.x)), y: Math.max(-lim(img.height * s, viewH), Math.min(lim(img.height * s, viewH), p.y)) };
  };
  // Start with the window filled, which is what most people want.
  useEffect(() => { if (img) setZoom(Math.max(1, fill / fit)); }, [img]); // eslint-disable-line
  const setZ = (z) => { setZoom(z); if (img) setPos((p) => clamp(p, fit * z)); };

  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, p: pos }; };
  const move = (e) => { if (drag.current && img) setPos(clamp({ x: drag.current.p.x + e.clientX - drag.current.x, y: drag.current.p.y + e.clientY - drag.current.y })); };
  const up = () => { drag.current = null; };
  const wheel = (e) => { e.preventDefault(); setZ(Math.max(1, Math.min(5, zoom - e.deltaY * 0.0015))); };

  const save = () => {
    const k = outW / viewW, c = document.createElement('canvas');
    c.width = outW; c.height = Math.round(viewH * k);
    const ctx = c.getContext('2d');
    if (!round) { ctx.fillStyle = '#0a1612'; ctx.fillRect(0, 0, c.width, c.height); } // photos get a solid background, logos stay transparent
    ctx.drawImage(img, (viewW / 2 + pos.x - w / 2) * k, (viewH / 2 + pos.y - h / 2) * k, w * k, h * k);
    onDone(round ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88));
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="form">
        {err && <p className="err">{err}</p>}
        {!img && !err && <p className="hint">Loading picture</p>}
        {img && (
          <>
            <p className="hint">Drag the picture to position it. Zoom to choose how much to keep.{round ? ' The logo will be shown round.' : ''}</p>
            <div className={`crop ${round ? 'round' : ''}`} style={{ width: viewW, height: viewH }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
              <img src={img.src} alt="" draggable="false" style={{ width: w, height: h, left: viewW / 2 + pos.x - w / 2, top: viewH / 2 + pos.y - h / 2 }} />
            </div>
            <label>Zoom
              <input type="range" min="1" max="5" step="0.01" value={zoom} onChange={(e) => setZ(Number(e.target.value))} />
            </label>
            <div className="row">
              <button type="button" className="ghost" onClick={() => { setZ(1); setPos({ x: 0, y: 0 }); }}>Fit whole picture</button>
              <button type="button" className="ghost" onClick={() => { setZ(Math.max(1, fill / fit)); setPos({ x: 0, y: 0 }); }}>Fill the frame</button>
            </div>
            <div className="row">
              <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
              <button type="button" className="primary" onClick={save}>Save picture</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
