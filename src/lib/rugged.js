// Rug / bundle / distribution scoring, computed from raw on-chain data we fetch ourselves.
//
// DESIGN RULE - no fabrication:
//   every metric in a score comes from a real response
//   (ely_balances, ely_clusters, es_dev_of, ely_trades, ely_tokens).
//   When a metric cannot be computed it stays null, renders as "-", and FAILS the check
//   rather than passing silently.

export const RULES = {
  maxClusterWallets: 8,
  minAgeMin: 5,
  maxAgeMin: 240, // fresh window: 4 hours. Older coins are not a "new launch".
  minHolders: 25,
  maxTop10ExPool: 45,
  maxTop1ExPool: 20,
  maxClusterSupplyPct: 10, // supply held by same-block bundle clusters
  maxClusterWallets: 900, // wallet count alone is not a rug signal on a busy chain
  maxDevPct: 8,
  minSafetyScore: 80,
  minLiquidityUsd: 2500,
  minVolumeUsd: 1500,
  minBuyers: 15,
  maxBuyPressure: 0.92,
};

const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

export function scoreToken(t, opts = {}) {
  const R = { ...RULES, ...opts };
  const checks = [];
  const add = (id, label, pass, value, limit, weight, fatal = false) =>
    checks.push({ id, label, pass: pass === null ? null : !!pass, value, limit, weight, fatal });

  const liq = t.liquidity || {};
  const ageMin = num(t.ageMin);
  const holders = num(t.holders) ?? 0;

  const top10 = num(liq.top10ExPoolPct);
  const top1 = num(liq.top1ExPoolPct);

  const clusterWallets = num(t.clusters?.clusterWallets);
  const botsPct = num(t.botsPct);

  const devPct = num(t.devPct);
  const devSold = t.devSold === true;
  const devSellCount = num(t.dev?.sells);

  const liqUsd = num(t.liquidityUsd);
  const vol24 = num(t.vol24) ?? 0;
  const buyers = num(t.buyers);
  const buys = num(t.buys24) ?? 0;
  const sells = num(t.sells24) ?? 0;
  const buyRatio = buys + sells > 0 ? buys / (buys + sells) : 0.5;
  const safety = num(t.safetyScore);

  add("age", `umur >= ${R.minAgeMin} menit`, ageMin != null && ageMin >= R.minAgeMin, ageMin == null ? null : +ageMin.toFixed(1), `${R.minAgeMin}m`, 8, true);
  add("holders", `holder >= ${R.minHolders}`, holders >= R.minHolders, holders, R.minHolders, 12, true);
  add("top10", `top10 tanpa pool <= ${R.maxTop10ExPool}%`, top10 != null && top10 <= R.maxTop10ExPool, top10, `${R.maxTop10ExPool}%`, 16, true);
  add("top1", `holder terbesar <= ${R.maxTop1ExPool}%`, top1 != null && top1 <= R.maxTop1ExPool, top1, `${R.maxTop1ExPool}%`, 8);
  // The cluster endpoint almost never publishes a real supply percentage: it returns the
  // sentinel 1e-25 for the overwhelming majority of coins, even ones whose holder
  // concentration is 90-100%. Reading that sentinel as "0% bundled" made every new coin
  // pass the bundle filter on missing data. So: anything at or below 1e-6 is UNKNOWN.
  // Not a pass, not a fail - a hole we refuse to paper over.
  const rawClusterPct = num(t.clusters?.clusterSupplyPct);
  const clusterKnown = rawClusterPct != null && rawClusterPct > 1e-6;
  const clusterSupplyPct = clusterKnown ? rawClusterPct : null;
  add(
    "bundleSupply",
    `supply bundle <= ${R.maxClusterSupplyPct}%`,
    clusterSupplyPct == null ? null : clusterSupplyPct <= R.maxClusterSupplyPct,
    clusterSupplyPct,
    clusterKnown ? `${R.maxClusterSupplyPct}%` : "indexer kosong",
    16,
    false,
  );

  // Real bundle signal we DO have: how many wallets the indexer grouped into clusters.
  const clusterWalletsN = num(t.clusters?.clusterWallets);
  add(
    "bundleWallets",
    `wallet ter-cluster <= ${R.maxClusterWallets}`,
    clusterWalletsN == null ? null : clusterWalletsN <= R.maxClusterWallets,
    clusterWalletsN,
    `${R.maxClusterWallets} wallet`,
    10,
    false,
  );
  add("bundlePct", "bundle bot <= 8% supply", botsPct == null ? null : botsPct <= 8, botsPct, "8%", 8);
  add("bundleWalletInfo", "wallet masuk bundle (info)", true, clusterWallets, "info", 0);
  add(
    "devHold",
    `dev hold <= ${R.maxDevPct}%`,
    devPct == null ? null : devPct <= R.maxDevPct,
    devPct,
    devPct == null ? "data dev tidak ada" : `${R.maxDevPct}%`,
    6,
  );
  add("devSold", "dev belum pernah jual", !devSold, devSellCount == null ? null : `${devSellCount} sell`, "0 sell", 12, true);
  add("liq", `likuiditas >= $${R.minLiquidityUsd}`, liqUsd != null && liqUsd >= R.minLiquidityUsd, liqUsd == null ? null : Math.round(liqUsd), `$${R.minLiquidityUsd}`, 8);
  add("vol", `volume >= $${R.minVolumeUsd}`, vol24 >= R.minVolumeUsd, Math.round(vol24), `$${R.minVolumeUsd}`, 5);
  add("buyers", `pembeli >= ${R.minBuyers}`, buyers != null && buyers >= R.minBuyers, buyers, R.minBuyers, 7);
  add("twoway", "market dua arah", buyRatio <= R.maxBuyPressure, +buyRatio.toFixed(2), `<=${R.maxBuyPressure}`, 4);
  if (safety != null) {
    add("safety", `skor safety indexer >= ${R.minSafetyScore}`, safety >= R.minSafetyScore, safety, R.minSafetyScore, 8);
  }

  const totalW = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass === true ? c.weight : 0), 0);
  const score = Math.round((earned / totalW) * 100);

  const failures = checks.filter((c) => c.pass !== true);
  const fatalFails = failures.filter((c) => c.fatal);
  const unknown = checks.filter((c) => c.pass === null);

  const verdict =
    fatalFails.length > 0 ? "AVOID" : score >= 88 ? "STRONG" : score >= 75 ? "OK" : score >= 60 ? "WEAK" : "AVOID";

  return {
    score,
    verdict,
    checks,
    failures: failures.map((f) => f.label),
    fatalFails: fatalFails.map((f) => f.label),
    unknown: unknown.map((f) => f.label),
    clusterKnown,
    passes: fatalFails.length === 0 && score >= 75,
  };
}

export function momentum(t, trades = []) {
  const chg = num(t.chg24) ?? 0;
  const buys = num(t.buys24) ?? 0;
  const sells = num(t.sells24) ?? 0;
  const buyRatio = buys + sells > 0 ? buys / (buys + sells) : 0.5;

  let inflow = 0;
  let b = 0;
  let s = 0;
  for (const tr of trades) {
    const h = num(tr.hype) ?? 0;
    if (tr.side === "buy") {
      inflow += h;
      b += 1;
    } else {
      inflow -= h;
      s += 1;
    }
  }

  const trend = chg > 50 ? "up-strong" : chg > 8 ? "up" : chg > -15 ? "flat" : "down";
  const signals = [];
  const risks = [];
  if (chg > 25) signals.push(`+${chg.toFixed(0)}% 24j`);
  if (buyRatio > 0.6) signals.push(`${(buyRatio * 100).toFixed(0)}% transaksi beli`);
  if (b > s) signals.push(`${b} buy vs ${s} sell di window terakhir`);
  if (inflow > 0) signals.push(`net inflow ${inflow.toFixed(2)} HYPE`);
  if (chg < -20) risks.push(`turun ${chg.toFixed(0)}% - jangan kejar pisau jatuh`);
  if (chg > 300) risks.push("sudah +300%, risiko beli di puncak");
  if (s > b * 1.5) risks.push("seller lebih banyak sekarang");

  return {
    trend,
    buyRatio: +buyRatio.toFixed(2),
    inflow: +inflow.toFixed(3),
    windowBuys: b,
    windowSells: s,
    signals,
    risks,
    upside: chg > 300 ? "low" : chg > 0 && buyRatio > 0.55 ? "medium" : "low",
  };
}

/** Bubble-map geometry from real balances (pool wallet excluded upstream). */
export function bubbleMap(balances, clusters, devAddr) {
  const total = balances.reduce((sum, x) => sum + Number(x.amount || 0), 0) || 1;
  const top = balances.slice(0, 70);
  const points = top.map((x, i) => {
    const pct = (Number(x.amount) / total) * 100;
    const seed = parseInt(String(x.holder).slice(2, 9), 16) || i * 977;
    const angle = ((seed % 3600) / 3600) * Math.PI * 2;
    const radius = 0.15 + ((seed % 1000) / 1000) * 0.75;
    return {
      holder: x.holder,
      pct: +pct.toFixed(3),
      x: +(0.5 + Math.cos(angle) * radius * 0.44).toFixed(4),
      y: +(0.5 + Math.sin(angle) * radius * 0.44).toFixed(4),
      r: +(0.014 + Math.pow(pct, 0.42) * 0.08).toFixed(4),
      isDev: devAddr ? String(x.holder).toLowerCase() === String(devAddr).toLowerCase() : false,
    };
  });

  const c = Array.isArray(clusters) ? clusters[0] : clusters;
  return {
    points,
    top1: points[0]?.pct ?? null,
    stats: {
      sampled: balances.length,
      clusterWallets: num(c?.cluster_wallets),
      clusters: num(c?.clusters),
      top10Pct: num(c?.top10_pct),
    },
  };
}

/**
 * "Should I buy this" blend: safety first, then momentum.
 * Safety is the gate; momentum decides the order among coins that already passed.
 */
export function buyScore(t) {
  const safety = t.analysis?.score ?? 0;
  const mom = t.mom || {};
  const trendBonus = mom.trend === "up-strong" ? 12 : mom.trend === "up" ? 8 : mom.trend === "flat" ? 2 : -6;
  const inflowBonus = Math.max(-8, Math.min(8, (mom.inflow || 0) / 5));
  const ratioBonus = ((mom.buyRatio ?? 0.5) - 0.5) * 20;
  return +(safety * 0.62 + trendBonus + inflowBonus + ratioBonus).toFixed(1);
}

export function rankCandidates(rows) {
  return [...rows].sort((a, b) => {
    const ap = a.analysis?.passes ? 1 : 0;
    const bp = b.analysis?.passes ? 1 : 0;
    if (ap !== bp) return bp - ap;
    // among coins that passed, order by buy attractiveness (safety + momentum)
    if (ap === 1) return buyScore(b) - buyScore(a);
    const as = a.analysis?.score ?? -1;
    const bs = b.analysis?.score ?? -1;
    if (as !== bs) return bs - as;
    return (b.mom?.inflow || 0) - (a.mom?.inflow || 0);
  });
}
