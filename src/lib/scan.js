// Scanner: turns raw ElyScreener rows into analysed candidates.
// NO FABRICATION RULE: anything this file cannot compute from live data stays null
// and renders as "-" in the UI. Missing safety data is shown, never guessed.

import { api } from "./es-api.js";
import { scoreToken, momentum, bubbleMap, rankCandidates, RULES } from "./rugged.js";

// 0xe2e1... is the Elysium liquidity-pool wallet: verified as holder #1 on
// VOLTA / EACCAT / CHAMELEON at exactly the pool's share. Never count it as a whale.
export const POOL_WALLET = "0xe2e105d3f7209a9da11f83ccf3e7398a753823f1";

const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

export function ageMinutes(created_at) {
  if (!created_at) return null;
  const t = new Date(created_at).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 60000;
}

export function shapeToken(t, hypeUsd) {
  return {
    addr: t.address,
    sym: t.symbol,
    name: t.name,
    pad: t.launchpad || "unknown",
    pool: t.pool || null,
    creator: t.creator || null,
    priceHype: num(t.price_hype),
    priceUsd: num(t.price_hype) != null ? num(t.price_hype) * hypeUsd : null,
    mcap: num(t.mcap_usd),
    vol24: num(t.vol24_hype) != null ? num(t.vol24_hype) * hypeUsd : null,
    holders: num(t.holders) ?? 0,
    supply: t.supply ? Number(t.supply) : null,
    top10: num(t.top10_pct),
    buys24: num(t.buys24) ?? 0,
    sells24: num(t.sells24) ?? 0,
    chg24: num(t.change24),
    createdAt: t.created_at,
    ageMin: ageMinutes(t.created_at),
    liquidityUsd: null,
    buyers: null,
    safetyScore: null,
    botsPct: null,
    devPct: null,
    devSold: null,
    safetyWhy: [],
    clusters: null,
    dev: null,
    liquidity: null,
    bubble: null,
    recentTrades: [],
  };
}

/** Deep per-coin analysis. Every number comes from a real request. */
export async function deepScan(token, { withBalances = true, withTrades = true } = {}) {
  const out = { ...token };

  const [safety, clusters, dev, trades] = await Promise.all([
    api.safetyOne(token.addr),
    api.clusters(token.addr),
    api.devOf(token.addr),
    withTrades ? api.trades(token.addr, 120) : Promise.resolve([]),
  ]);

  if (safety) {
    out.safetyScore = num(safety.score);
    out.botsPct = num(safety.bots_pct);
    out.devPct = num(safety.dev_pct);
    out.devSold = safety.dev_sold === true;
    out.safetyWhy = Array.isArray(safety.why) ? safety.why : [];
  } else {
    out.safetyScore = null;
    out.safetyWhy = ["indexer belum memberi skor safety"];
  }

  const c = Array.isArray(clusters) ? clusters[0] : clusters;
  if (c) {
    out.clusters = {
      holders: num(c.holders),
      clusterWallets: num(c.cluster_wallets),
      clusters: num(c.clusters),
      clusterSupplyPct: num(c.cluster_supply_pct) > 1e-6 ? num(c.cluster_supply_pct) : 0,
      top10Pct: num(c.top10_pct),
      biggestClusterPct: num(c.biggest_cluster_pct) > 1e-6 ? num(c.biggest_cluster_pct) : 0,
    };
  }

  const d = Array.isArray(dev) ? dev[0] : dev;
  if (d) {
    out.dev = {
      creator: d.creator,
      holdingPct: num(d.holding_pct),
      soldHype: num(d.sold_hype),
      sells: num(d.sells),
      lastSell: d.last_sell || null,
    };
    if (out.devPct == null) out.devPct = out.dev.holdingPct;
    if (out.devSold == null) out.devSold = (num(d.sells) || 0) > 0;
  }

  if (Array.isArray(trades) && trades.length) {
    out.recentTrades = trades.slice(0, 60);
    const buyerSet = new Set(trades.filter((t) => t.side === "buy").map((t) => String(t.trader).toLowerCase()));
    out.buyers = buyerSet.size;
  }

  if (withBalances) {
    const bal = await api.balances(token.addr);
    if (Array.isArray(bal) && bal.length) {
      const poolRow = bal.find((b) => String(b.holder).toLowerCase() === POOL_WALLET);
      const holdersOnly = bal.filter((b) => String(b.holder).toLowerCase() !== POOL_WALLET);
      // Denominator must be the real on-chain supply, not the sum of the sampled rows:
      // the balances endpoint returns only the top N holders, so sum(sample) < supply and
      // dividing by it inflated concentration (produced a 265% top-10 reading).
      // Denominator: the larger of the indexed supply and the sampled total.
      // Some rows carry a stale `supply` (STOCKIUM indexed 206.9e24 while a single holder
      // held 151% of it). Using max() keeps concentration <= 100% and we flag the mismatch
      // instead of hiding it.
      const sampleTotal = bal.reduce((s, b) => s + Number(b.amount || 0), 0) || 1;
      const indexedSupply = num(token.supply) || 0;
      const supply = Math.max(indexedSupply, sampleTotal);
      const supplyInconsistent = indexedSupply > 0 && sampleTotal > indexedSupply * 1.02;

      const poolSharePct = poolRow ? +((Number(poolRow.amount) / supply) * 100).toFixed(2) : null;
      const top10ExPool = +(
        (holdersOnly.slice(0, 10).reduce((s, b) => s + Number(b.amount || 0), 0) / supply) *
        100
      ).toFixed(2);
      const top1ExPool = holdersOnly.length
        ? +((Number(holdersOnly[0].amount) / supply) * 100).toFixed(2)
        : null;

      out.liquidity = {
        poolWallet: poolRow?.holder || null,
        poolSharePct,
        sampled: holdersOnly.length,
        sampleCoveragePct: +(
          (bal.reduce((s2, b) => s2 + Number(b.amount || 0), 0) / supply) *
          100
        ).toFixed(1),
        top10ExPoolPct: top10ExPool,
        top1ExPoolPct: top1ExPool,
        apiTop10Pct: num(token.top10),
        supplyInconsistent,
      };

      // USD liquidity estimate = pool share x market cap (the pool's token-side value).
      // Flagged as an estimate in the UI; never presented as a quoted pool reserve.
      if (poolSharePct != null && out.mcap) {
        out.liquidityUsd = +((poolSharePct / 100) * out.mcap).toFixed(0);
        out.liquidityIsEstimate = true;
      }

      out.bubble = bubbleMap(holdersOnly, clusters, token.creator);
    }
  }

  out.analysis = scoreToken(out);
  out.mom = momentum(out, out.recentTrades || []);
  return out;
}

/**
 * Full market scan:
 *  1. newest tokens + highest-volume tokens (merged)
 *  2. drop pre-traction noise
 *  3. deep-scan survivors, bounded so the page stays responsive
 */
export async function scanMarket({ limit = 300, maxDeepScan = 12, rules = {}, onProgress = null } = {}) {
  const R = { ...RULES, ...rules };
  const [hypeUsd, newest, volumed] = await Promise.all([
    api.hypeUsd(),
    api.tokens({ order: "created_at.desc", limit }),
    api.tokens({ order: "vol24_hype.desc", limit: 200 }),
  ]);

  const byAddr = new Map();
  for (const t of [...newest, ...volumed]) {
    const prev = byAddr.get(t.address);
    if (!prev || new Date(t.created_at) > new Date(prev.created_at)) byAddr.set(t.address, t);
  }
  const raw = [...byAddr.values()];
  const shaped = raw.map((t) => shapeToken(t, hypeUsd));

  const anyTraction = shaped.filter((t) => t.holders >= 10 && (t.vol24 || 0) > 0);
  const young = anyTraction.filter((t) => t.ageMin != null && t.ageMin < R.minAgeMin);

  // NEWEST FIRST. The user wants fresh launches, not 12-day-old winners:
  // only coins inside the fresh window are eligible, ordered by momentum then age.
  const fresh = anyTraction.filter(
    (t) => t.ageMin != null && t.ageMin >= R.minAgeMin && t.ageMin <= R.maxAgeMin,
  );
  fresh.sort((a, b) => (b.vol24 || 0) - (a.vol24 || 0) || b.holders - a.holders);

  // Established coins are kept separately for context, not recommended as "new".
  const established = anyTraction
    .filter((t) => t.ageMin != null && t.ageMin > R.maxAgeMin)
    .sort((a, b) => b.holders - a.holders)
    .slice(0, 8);

  const eligible = fresh;
  const toScan = fresh.slice(0, maxDeepScan);

  const scanned = [];
  for (let i = 0; i < toScan.length; i++) {
    if (onProgress) onProgress({ i, total: toScan.length, sym: toScan[i].sym });
    try {
      scanned.push(await deepScan(toScan[i]));
    } catch (e) {
      scanned.push({ ...toScan[i], error: String(e?.message || e) });
    }
  }

  const ranked = rankCandidates(scanned);
  const recommended = ranked.filter((r) => r.analysis?.passes);
  const watchlist = young
    .sort((a, b) => b.holders - a.holders)
    .slice(0, 12)
    .map((t) => ({ ...t, analysis: scoreToken(t) }));

  return {
    hypeUsd,
    scannedAt: new Date().toISOString(),
    stats: {
      fetched: raw.length,
      eligible: eligible.length,
      established: established.length,
      deepScanned: scanned.length,
      passed: recommended.length,
      threshold: R,
    },
    ranked,
    recommended,
    watchlist,
    established,
  };
}

export { RULES };
