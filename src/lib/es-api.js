// ElyScreener REST + RPC client. All endpoints below were verified live on 2026-11-09
// and all of them return `access-control-allow-origin: *`, so the browser can call them directly.

export const BASE = "https://elyscreener.com/api";

export const ENDPOINTS = {
  tok: (q) => `${BASE}/ely_tokens?${q}`,
  safetyAll: (off = 0, lim = 1000) => `${BASE}/rpc/es_safety?limit=${lim}&offset=${off}`,
  safetyOne: (addr) => `${BASE}/rpc/es_safety?token=eq.${addr}`,
  balances: (addr, lim = 120) =>
    `${BASE}/ely_balances?select=holder,amount&token=eq.${addr}&order=amount.desc&limit=${lim}`,
  clusters: (addr) => `${BASE}/rpc/ely_clusters?p_coin=${addr}`,
  devOf: (addr) => `${BASE}/rpc/es_dev_of?p_coin=${addr}`,
  coinPnl: (addr) => `${BASE}/rpc/es_coin_pnl?p_coin=${addr}`,
  trades: (addr, lim = 300) =>
    `${BASE}/ely_trades?select=at,side,hype,amount,price_hype,trader,tx,block&token=eq.${addr}&order=at.desc&limit=${lim}`,
  spark: () => `${BASE}/rpc/es_spark`,
  smartBuys: (h = 24) => `${BASE}/rpc/es_smart_buys?p_hours=${h}`,
  smartWallets: (d = 7, l = 60) => `${BASE}/rpc/es_smart_wallets?p_days=${d}&p_limit=${l}`,
  devSells: (h = 24) => `${BASE}/rpc/es_dev_sells?p_hours=${h}`,
  padTotals: () => `${BASE}/rpc/es_pad_totals`,
  hype: () => `${BASE}/ely_meta?select=v&k=eq.hype_usd&limit=1`,

  // --- live feeds: the same queries ElyScreener's own UI runs (verified in app.js) ---
  // trade tape, their cadence is 2s
  liveTrades: (lim = 60) =>
    `${BASE}/ely_trades?select=token,side,hype,at,price_hype,trader&order=at.desc&limit=${lim}`,
  // price/mcap/volume pulse for the busiest coins, their cadence is 2.5s (150 rows)
  pulse: () =>
    `${BASE}/ely_tokens?select=address,price_hype,mcap_usd,vol24_hype,buys24,sells24,change24,holders,last_trade_at&order=vol24_hype.desc&limit=150`,
  // newest coins, for catching a launch the minute it happens
  newborn: (lim = 25) =>
    `${BASE}/ely_tokens?select=address,symbol,launchpad,created_at,price_hype,mcap_usd,holders,vol24_hype&order=created_at.desc&limit=${lim}`,
};

const HDR = { Accept: "application/json" };

async function getJson(url, { timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: HDR, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  hypeUsd: async () => {
    const d = await getJson(ENDPOINTS.hype());
    return Number(d?.[0]?.v) || 0;
  },

  /** tokens ordered by created_at desc, optionally by volume */
  tokens: async ({ order = "created_at.desc", limit = 300 } = {}) => {
    const sel =
      "address,name,symbol,launchpad,pool,price_hype,mcap_usd,vol24_hype,holders,top10_pct,created_at,creator,buys24,sells24,change24,supply";
    return getJson(ENDPOINTS.tok(`select=${sel}&order=${order}&limit=${limit}`));
  },

  safetyOne: async (addr) => {
    try {
      const d = await getJson(ENDPOINTS.safetyOne(addr));
      return d?.[0] || null;
    } catch {
      return null;
    }
  },

  balances: (addr) => getJson(ENDPOINTS.balances(addr)),
  clusters: (addr) => getJson(ENDPOINTS.clusters(addr)).catch(() => []),
  devOf: (addr) => getJson(ENDPOINTS.devOf(addr)).catch(() => []),
  coinPnl: (addr) => getJson(ENDPOINTS.coinPnl(addr)).catch(() => []),
  trades: (addr, lim) => getJson(ENDPOINTS.trades(addr, lim)).catch(() => []),
  smartWallets: (d, l) => getJson(ENDPOINTS.smartWallets(d, l)).catch(() => []),
  devSells: (h) => getJson(ENDPOINTS.devSells(h)).catch(() => []),
  padTotals: () => getJson(ENDPOINTS.padTotals()).catch(() => []),

  // Live feed calls. They must never throw into the UI: a failed tick keeps the last value.
  liveTrades: (lim) => getJson(ENDPOINTS.liveTrades(lim), { timeout: 8000 }).catch(() => null),
  pulse: () => getJson(ENDPOINTS.pulse(), { timeout: 8000 }).catch(() => null),
  newborn: (lim) => getJson(ENDPOINTS.newborn(lim), { timeout: 8000 }).catch(() => null),
};
