
import { fetchRecentSwaps, tapeStats } from "../src/lib/onchain.js";

const t0 = Date.now();
const { latest, trades, pools } = await fetchRecentSwaps({ lookback: 1200, maxTrades: 40 });
const dt = Date.now() - t0;
console.log(`pool map: ${pools.size} pools | latest ${latest} | ${trades.length} trade | ${dt}ms`);

const s = tapeStats(trades);
console.log(`resolved ${s.resolved}/${s.total} (unresolved ${s.unresolved})`);

const now = Date.now();
for (const t of trades.slice(0, 10)) {
  const age = t.at ? ((now - t.at) / 1000).toFixed(1) + "s" : "?";
  const hype = t.hype == null ? "-" : t.hype.toFixed(4);
  console.log(`  ${t.symbol || "(pool " + t.poolId.slice(0, 8) + ")"} | ${t.side || "?"} | ${hype} HYPE | age ${age} | blk ${t.block}`);
}
const ages = trades.filter(t => t.at).map(t => (now - t.at) / 1000).sort((a,b)=>a-b);
if (ages.length) console.log(`\nlag: min ${ages[0].toFixed(1)}s | median ${ages[Math.floor(ages.length/2)].toFixed(1)}s | max ${ages[ages.length-1].toFixed(1)}s`);
