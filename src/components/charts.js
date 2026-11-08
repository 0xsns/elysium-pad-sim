// Small SVG chart primitives — no chart library, keeps the bundle tiny.

export function EquityCurve({ points, color = "#40ffd0", height = 96 }) {
  if (!points || points.length < 2) {
    return <div className="text-[11px] text-dim">no trades</div>;
  }
  const w = 320;
  const h = height;
  const pad = 6;
  const xs = points.map((p) => p.ts);
  const ys = points.map((p) => p.equity);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) || minX + 1;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY || 1;

  const X = (t) => pad + ((t - minX) / (maxX - minX || 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - minY) / spanY) * (h - pad * 2);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.ts).toFixed(1)},${Y(p.equity).toFixed(1)}`).join(" ");
  const area = `${d} L${X(points[points.length - 1].ts).toFixed(1)},${h - pad} L${X(points[0].ts).toFixed(1)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`g-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${color.replace("#", "")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkline({ candles, up }) {
  if (!candles || candles.length < 2) return null;
  const pts = candles.slice(0, 48).map((c) => c[4]).reverse();
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 80;
  const h = 20;
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke={up ? "#7dffb2" : "#ff5c72"} strokeWidth="1.2" />
    </svg>
  );
}
