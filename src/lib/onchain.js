// On-chain trade tape for Elysium, read straight from an archive RPC.
//
// WHY THIS EXISTS
// The ElyScreener indexer batches its writes: measured 2026-11-08, the newest row in
// `ely_trades` was routinely 60-120s old, then jumped to ~6s when a batch landed. That is
// a ~60s floor no matter how often you poll. There is no websocket and no SSE anywhere in
// their client.
//
// Elysium blocks are ~0.07s. The Uniswap-v4 PoolManager emits a Swap event per trade and
// node.eleos.fun serves eth_getLogs with CORS `*` at 1,200 req/min, so the newest trades
// are readable from chain within a block or two instead of waiting for an index batch.
//
// HOW THE SIDES ARE RESOLVED (the part that is easy to get wrong)
// The Swap event carries amount0/amount1 in the PoolKey's ordering. A naive "amount1
// negative means sell" heuristic produced nonsense (1.78M-HYPE trades), because pools are
// sorted by currency address and the token can be either side. We resolve it exactly:
// `ely_tokens` exposes `pool` (= the v4 poolId, which equals Swap topic1) and `token_is0`.
// The HYPE leg is amount1 when token_is0 is true, otherwise amount0. Sign convention is the
// pool's: positive means the pool received that currency, so HYPE > 0 is the trader buying.

export const RPC = "https://node.eleos.fun";
const INDEXER = "https://elyscreener.com/api";

const POOL_MANAGER = "0xe2e105d3f7209a9da11f83ccf3e7398a753823f1";
// keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)")
const SWAP_TOPIC = "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";

let idc = 1;

async function rpc(method, params, { timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: idc++, method, params }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
  } finally {
    clearTimeout(t);
  }
}

function signed(word) {
  let v = BigInt(word);
  if (v >= 1n << 255n) v -= 1n << 256n;
  return v;
}

const abs = (b) => (b < 0n ? -b : b);
const toNum = (b) => Number(b) / 1e18;

let poolCache = { at: 0, map: new Map() };

/** poolId -> { symbol, addr, isToken0, launchpad }, cached briefly. */
export async function poolMap({ maxAgeMs = 120000 } = {}) {
  if (Date.now() - poolCache.at < maxAgeMs && poolCache.map.size) return poolCache.map;
  const url = `${INDEXER}/ely_tokens?select=address,symbol,pool,launchpad,token_is0&order=vol24_hype.desc&limit=1000`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`indexer HTTP ${res.status}`);
  const rows = await res.json();
  const map = new Map();
  for (const r of rows) {
    if (!r.pool) continue;
    map.set(String(r.pool).toLowerCase(), {
      symbol: r.symbol,
      addr: String(r.address).toLowerCase(),
      isToken0: r.token_is0 === true,
      launchpad: r.launchpad,
    });
  }
  poolCache = { at: Date.now(), map };
  return map;
}

/** Decode one Swap log. Returns null when the payload is not the v4 shape. */
export function decodeSwap(log, meta, blockTime) {
  const d = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  const words = [];
  for (let i = 0; i + 64 <= d.length; i += 64) words.push("0x" + d.slice(i, i + 64));
  if (words.length < 5) return null;

  const amount0 = signed(words[0]);
  const amount1 = signed(words[1]);
  const sqrtP = BigInt(words[2]);
  const tick = Number(signed(words[4]));

  let hypeLeg = null;
  let tokenLeg = null;
  if (meta) {
    hypeLeg = meta.isToken0 ? amount1 : amount0;
    tokenLeg = meta.isToken0 ? amount0 : amount1;
  }

  const side = hypeLeg == null ? null : hypeLeg > 0n ? "buy" : "sell";

  let price = null;
  if (sqrtP > 0n && meta) {
    const ratio = (Number(sqrtP) / 2 ** 96) ** 2;
    price = meta.isToken0 ? ratio : 1 / ratio;
  }

  return {
    txHash: log.transactionHash,
    block: parseInt(log.blockNumber, 16),
    poolId: String(log.topics[1]).toLowerCase(),
    sender: "0x" + log.topics[2].slice(-40),
    symbol: meta ? meta.symbol : null,
    token: meta ? meta.addr : null,
    launchpad: meta ? meta.launchpad : null,
    side,
    hype: hypeLeg == null ? null : toNum(abs(hypeLeg)),
    tokens: tokenLeg == null ? null : toNum(abs(tokenLeg)),
    price,
    tick,
    at: blockTime,
  };
}

/** Newest swaps straight from chain. lookback stays under the node's 2,000-block cap. */
export async function fetchRecentSwaps({ lookback = 1200, maxTrades = 40 } = {}) {
  const [latestHex, pools] = await Promise.all([rpc("eth_blockNumber", []), poolMap()]);
  const latest = parseInt(latestHex, 16);
  const from = Math.max(0, latest - lookback);

  const logs = await rpc("eth_getLogs", [
    {
      address: POOL_MANAGER,
      topics: [SWAP_TOPIC],
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + latest.toString(16),
    },
  ]);
  if (!Array.isArray(logs) || !logs.length) return { latest, trades: [], pools };

  const newestFirst = [...logs].sort(
    (a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16),
  );

  const blocks = [];
  const seen = new Set();
  for (const l of newestFirst) {
    if (seen.has(l.blockNumber)) continue;
    seen.add(l.blockNumber);
    blocks.push(l.blockNumber);
    if (blocks.length >= 20) break;
  }

  const times = {};
  await Promise.all(
    blocks.map(async (bn) => {
      try {
        const b = await rpc("eth_getBlockByNumber", [bn, false]);
        times[bn] = b && b.timestamp ? parseInt(b.timestamp, 16) * 1000 : null;
      } catch {
        times[bn] = null;
      }
    }),
  );

  const trades = [];
  for (const l of newestFirst) {
    const meta = pools.get(String(l.topics[1]).toLowerCase()) || null;
    const t = decodeSwap(l, meta, times[l.blockNumber] == null ? null : times[l.blockNumber]);
    if (t) trades.push(t);
    if (trades.length >= maxTrades) break;
  }

  return { latest, trades, pools };
}

export function tapeStats(trades) {
  const resolved = trades.filter((t) => t.side != null);
  return { total: trades.length, resolved: resolved.length, unresolved: trades.length - resolved.length };
}

export async function blockNumber() {
  return parseInt(await rpc("eth_blockNumber", []), 16);
}
