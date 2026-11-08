"use client";

// Visual primitives for the cockpit. Everything renders real data; when a value is
// null the component shows "-" and never a made-up number.

export const fmtUsd = (v, d = 0) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `$${n.toFixed(d)}`;
};

export const fmtPct = (v, d = 1) =>
  v == null || Number.isNaN(Number(v)) ? "-" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(d)}%`;

export const fmtNum = (v) => (v == null || Number.isNaN(Number(v)) ? "-" : Number(v).toLocaleString("en-US"));

/** Prices: readable at every magnitude, never mixed styles in one column. */
export const fmtPrice = (v) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  const n = Number(v);
  if (n === 0) return "$0";
  if (n < 0.00001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  if (n < 1000) return `$${n.toFixed(4)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

export const fmtAge = (m) => {
  if (m == null || Number.isNaN(Number(m))) return "-";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  return `${Math.floor(m / 1440)}d`;
};

export const shortAddr = (a, n = 4) => (a ? `${a.slice(0, 6)}...${a.slice(-n)}` : "-");

export const tone = (v) => (v == null ? "text-dim" : v > 0 ? "text-mint" : v < 0 ? "text-coral" : "text-dim");

export function Spark({ points, up, w = 92, h = 26 }) {
  if (!points || points.length < 2) return <div className="h-[26px] w-[92px] text-[9px] text-dim">no data</div>;
  const vals = points.slice(-60).map((p) => p[1]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke={up ? "#7dffb2" : "#ff5c72"} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Candle chart from real trade prints (price_hype over time). */
export function PriceChart({ trades, height = 130 }) {
  if (!trades || trades.length < 3) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[10px] text-dim">
        belum cukup trade untuk grafik
      </div>
    );
  }
  const rows = [...trades].reverse().map((t) => ({ p: Number(t.price_hype), side: t.side }));
  const w = 360;
  const h = height;
  const pad = 4;
  const min = Math.min(...rows.map((r) => r.p));
  const max = Math.max(...rows.map((r) => r.p));
  const span = max - min || max || 1;
  const X = (i) => pad + (i / (rows.length - 1 || 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const line = rows.map((r, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(r.p).toFixed(1)}`).join("");
  const area = `${line} L${X(rows.length - 1).toFixed(1)},${h - pad} L${X(0).toFixed(1)},${h - pad} Z`;
  const up = rows[rows.length - 1].p >= rows[0].p;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={up ? "#7dffb2" : "#ff5c72"} stopOpacity="0.25" />
          <stop offset="100%" stopColor={up ? "#7dffb2" : "#ff5c72"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pg)" />
      <path d={line} fill="none" stroke={up ? "#7dffb2" : "#ff5c72"} strokeWidth="1.4" strokeLinejoin="round" />
      {rows.map((r, i) =>
        r.side === "buy" ? (
          <circle key={i} cx={X(i)} cy={Y(r.p)} r="1.4" fill="#40ffd0" opacity="0.9" />
        ) : (
          <circle key={i} cx={X(i)} cy={Y(r.p)} r="1.4" fill="#ff5c72" opacity="0.9" />
        ),
      )}
    </svg>
  );
}

/** Bubble map: real holder balances drawn as bubbles, dev wallet highlighted. */
export function BubbleMap({ bubble, size = 300 }) {
  if (!bubble?.points?.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-[10px] text-dim">
        data holder belum tersedia
      </div>
    );
  }
  return (
    <div className="relative">
      <svg viewBox="0 0 1 1" width={size} height={size} className="mx-auto block">
        <circle cx="0.5" cy="0.5" r="0.5" fill="#0a0f14" stroke="#16232e" strokeWidth="0.004" />
        {bubble.points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.isDev ? "#ffb020" : p.pct >= 2 ? "#40ffd0" : "#2a6f7f"}
              fillOpacity={p.isDev ? 0.85 : p.pct >= 2 ? 0.55 : 0.35}
              stroke={p.isDev ? "#ffb020" : p.pct >= 2 ? "#40ffd0" : "#1d4a55"}
              strokeWidth="0.003"
            />
            {p.pct >= 3 && (
              <text
                x={p.x}
                y={p.y + 0.012}
                textAnchor="middle"
                fontSize="0.028"
                fill="#cfe8f0"
                style={{ pointerEvents: "none" }}
              >
                {p.pct.toFixed(0)}%
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px] text-dim">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-teal/60" /> whale ≥2%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber" /> dev
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2a6f7f]" /> holder kecil
        </span>
        <span>· {bubble.stats?.sampled ?? bubble.points.length} wallet</span>
      </div>
    </div>
  );
}

/** Checklist: every rule, the measured value, and pass/fail. Show the work. */
export function CheckList({ checks, limit = 99 }) {
  if (!checks?.length) return null;
  return (
    <div className="space-y-0.5">
      {checks.slice(0, limit).map((c) => (
        <div key={c.id} className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className={c.pass === true ? "text-dim" : c.fatal ? "text-coral" : "text-amber"}>
            {c.pass === true ? "✓" : c.pass === null ? "?" : "✕"} {c.label}
          </span>
          <span className={`tabnum shrink-0 ${c.pass === true ? "text-mint" : c.pass === null ? "text-dim" : "text-coral"}`}>
            {typeof c.value === "number" ? c.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : (c.value ?? "-")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ScoreRing({ score, verdict, size = 46 }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const color = verdict === "STRONG" ? "#40ffd0" : verdict === "OK" ? "#7dffb2" : verdict === "WEAK" ? "#ffb020" : "#ff5c72";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#16232e" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabnum text-[11px] font-semibold" style={{ color }}>
          {score ?? "-"}
        </span>
      </div>
    </div>
  );
}
