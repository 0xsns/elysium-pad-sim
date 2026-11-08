// Deterministic paper-trading engine for Elysium launchpads.
// Same seed + same config => same result. Nothing random without a seed.

export const DEFAULTS = {
  startUsd: 10,
  pads: ["montra", "ascend", "volta"],
  perPadUsd: 3.3333,
  entryPct: 80,
  tpPct: 60,
  slPct: 35,
  trailPct: 25,
  maxHoldMin: 45,
  feeBps: 100, // 1% round-trip (v4 swap fee + gas amortised)
  gasUsd: 0.0035, // HYPE gas per tx on Elysium, measured from chain config
  seed: 1337,
  // skip tokens whose liquidity is too thin for the position to be realistic
  minLiqUsd: 5_000,
  // ignore tokens flagged risky / dev-sold when safety filter is on
  safetyFilter: true,
};

// mulberry32 — small, fast, good enough for reproducible sims
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run one simulation.
 * @param {Array} candles  [[ts, price, ...]] newest-first from GeckoTerminal (or oldest-first, we sort)
 * @param {string} tokenSym
 * @param {object} cfg
 */
export function simulate(candles, tokenSym, cfgIn = {}) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const rows = [...candles].sort((a, b) => a[0] - b[0]); // oldest -> newest
  if (rows.length < 3) {
    return { token: tokenSym, trades: [], equity: cfg.startUsd, error: "not enough candles" };
  }

  const rng = makeRng(cfg.seed + rows.length);
  const trades = [];
  let equity = cfg.startUsd;
  let pos = null;
  let i = 1;

  while (i < rows.length) {
    const [ts, o, h, l, c] = rows[i];
    const prevPrice = rows[i - 1][4];

    if (!pos) {
      // ENTRY: only when the last bar closed green and we have room to run
      const momentum = (c - prevPrice) / prevPrice;
      if (momentum > 0.02 && rng() < 0.35) {
        const size = equity * (cfg.entryPct / 100);
        if (size >= 0.5) {
          const feeUsd = (size * cfg.feeBps) / 10000 + cfg.gasUsd;
          pos = {
            entryTs: ts,
            entryPrice: c,
            sizeUsd: size,
            tokensOut: (size - feeUsd) / c,
            peak: c,
            feeUsd,
            high: h,
            low: l,
          };
          equity -= size;
        }
      }
      i += 1;
      continue;
    }

    // hold: track the running peak for trailing stop
    if (c > pos.peak) pos.peak = c;
    const pnlPct = ((c - pos.entryPrice) / pos.entryPrice) * 100;
    const drawdown = ((pos.peak - c) / pos.peak) * 100;
    const heldMin = (ts - pos.entryTs) / 60;

    let reason = null;
    if (pnlPct >= cfg.tpPct) reason = "take-profit";
    else if (pnlPct <= -cfg.slPct) reason = "stop-loss";
    else if (drawdown >= cfg.trailPct && pnlPct > 0) reason = "trailing-stop";
    else if (heldMin >= cfg.maxHoldMin) reason = "time-stop";

    if (reason) {
      const grossUsd = pos.tokensOut * c;
      const feeUsd = (grossUsd * cfg.feeBps) / 10000 + cfg.gasUsd;
      const netUsd = grossUsd - feeUsd;
      const pnlUsd = netUsd - pos.sizeUsd;
      equity += netUsd;
      trades.push({
        token: tokenSym,
        entryTs: pos.entryTs,
        exitTs: ts,
        entryPrice: pos.entryPrice,
        exitPrice: c,
        sizeUsd: +pos.sizeUsd.toFixed(4),
        pnlPct: +pnlPct.toFixed(2),
        pnlUsd: +pnlUsd.toFixed(4),
        heldMin: +heldMin.toFixed(1),
        reason,
        feesUsd: +(feeUsd + pos.feeUsd).toFixed(4),
      });
      pos = null;
    }
    i += 1;
  }

  // mark open position to the last close (no forced sale)
  let openPos = null;
  if (pos) {
    const last = rows[rows.length - 1];
    const markUsd = pos.tokensOut * last[4];
    openPos = {
      token: tokenSym,
      entryPrice: pos.entryPrice,
      markPrice: last[4],
      sizeUsd: +pos.sizeUsd.toFixed(4),
      markUsd: +markUsd.toFixed(4),
      pnlPct: +(((markUsd - pos.sizeUsd) / pos.sizeUsd) * 100).toFixed(2),
    };
    equity += markUsd;
  }

  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));

  return {
    token: tokenSym,
    startUsd: cfg.startUsd,
    equity: +equity.toFixed(4),
    pnlUsd: +(equity - cfg.startUsd).toFixed(4),
    pnlPct: +(((equity - cfg.startUsd) / cfg.startUsd) * 100).toFixed(2),
    trades,
    tradeCount: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? +((wins.length / trades.length) * 100).toFixed(1) : 0,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 99 : 0,
    avgWinPct: wins.length ? +(wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length).toFixed(2) : 0,
    avgLossPct: losses.length ? +(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length).toFixed(2) : 0,
    bestPct: trades.length ? +Math.max(...trades.map((t) => t.pnlPct)).toFixed(2) : 0,
    worstPct: trades.length ? +Math.min(...trades.map((t) => t.pnlPct)).toFixed(2) : 0,
    openPos,
    totalFees: +trades.reduce((s, t) => s + t.feesUsd, 0).toFixed(4),
    curve: buildCurve(rows, trades, cfg.startUsd),
    error: null,
  };
}

// equity curve sampled at trade exits + the endpoints
function buildCurve(rows, trades, startUsd) {
  const pts = [{ ts: rows[0][0], equity: startUsd }];
  let eq = startUsd;
  for (const t of trades) {
    eq += t.pnlUsd;
    pts.push({ ts: t.exitTs, equity: +eq.toFixed(4) });
  }
  pts.push({ ts: rows[rows.length - 1][0], equity: +eq.toFixed(4) });
  return pts;
}

/** Split a $10 bankroll across the selected pads and run each token. */
export function runPortfolio(tokensByPad, cfgIn = {}) {
  const cfg = { ...DEFAULTS, ...cfgIn };
  const padIds = cfg.pads;
  const perPad = +(cfg.startUsd / padIds.length).toFixed(4);
  const padResults = [];

  for (const padId of padIds) {
    const entry = tokensByPad[padId] || [];
    let eligible = entry.filter((t) => (t.liq ?? 0) >= cfg.minLiqUsd || (t.vol24 ?? 0) > 50_000);
    if (cfg.safetyFilter) {
      eligible = eligible.filter((t) => t.risk !== "risky" && !t.devSold);
    }
    // split the pad budget evenly over its eligible tokens
    const perToken = eligible.length ? +(perPad / eligible.length).toFixed(4) : 0;
    const runs = eligible
      .map((t) => ({ token: t, sim: t.candles ? simulate(t.candles, t.sym, { ...cfg, startUsd: perToken }) : null }))
      .filter((r) => r.sim && !r.sim.error);

    const padEquity = runs.reduce((s, r) => s + r.sim.equity, 0);
    padResults.push({
      pad: padId,
      budget: perPad,
      equity: +padEquity.toFixed(4),
      pnlUsd: +(padEquity - perPad).toFixed(4),
      pnlPct: perPad ? +(((padEquity - perPad) / perPad) * 100).toFixed(2) : 0,
      tokens: runs.length,
      skipped: entry.length - eligible.length,
      runs: runs.map((r) => ({
        sym: r.token.sym,
        addr: r.token.addr,
        liq: r.token.liq,
        vol24: r.token.vol24,
        risk: r.token.risk,
        bots: r.token.bots,
        devSold: r.token.devSold,
        budget: perToken,
        ...r.sim,
      })),
    });
  }

  const equity = padResults.reduce((s, p) => s + p.equity, 0);
  const allTrades = padResults.flatMap((p) => p.runs.flatMap((r) => r.trades || []));
  const wins = allTrades.filter((t) => t.pnlUsd > 0).length;

  return {
    cfg,
    startUsd: cfg.startUsd,
    equity: +equity.toFixed(4),
    pnlUsd: +(equity - cfg.startUsd).toFixed(4),
    pnlPct: +(((equity - cfg.startUsd) / cfg.startUsd) * 100).toFixed(2),
    trades: allTrades.length,
    winRate: allTrades.length ? +((wins / allTrades.length) * 100).toFixed(1) : 0,
    pads: padResults,
  };
}
