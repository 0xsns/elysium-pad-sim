import { scanMarket } from "../src/lib/scan.js";
import { buyScore } from "../src/lib/rugged.js";

const t0 = Date.now();
const r = await scanMarket({
  limit: 400,
  maxDeepScan: 10,
  onProgress: (p) => process.stdout.write(`\r  scanning ${p.i + 1}/${p.total} ${p.sym}            `),
});

console.log("\n=== SCAN DONE in", ((Date.now() - t0) / 1000).toFixed(1) + "s ===");
console.log(
  `HYPE $${r.hypeUsd.toFixed(2)} | fetched ${r.stats.fetched} | eligible ${r.stats.eligible} | scanned ${r.stats.deepScanned} | passed ${r.stats.passed}`,
);

for (const c of r.ranked) {
  const a = c.analysis;
  const l = c.liquidity;
  console.log(
    `${String(c.sym).slice(0, 12).padEnd(13)} ${String(c.pad).padEnd(8)} score=${String(a.score).padStart(3)} ${String(
      a.verdict,
    ).padEnd(6)} pass=${String(a.passes).padEnd(5)} top10=${c.top10}% top10ex=${l ? l.top10ExPoolPct : "-"}% bots=${
      c.botsPct == null ? "null" : c.botsPct.toFixed(1)
    } devSold=${c.devSold} safety=${c.safetyScore}`,
  );
  if (a.fatalFails.length) console.log("      FATAL:", a.fatalFails.join(" | "));
}

if (r.recommended.length) {
  console.log("\n>>> RECOMMENDED FOR MANUAL BUY");
  for (const c of r.recommended) {
    console.log(`   ${c.sym.padEnd(11)} buy=${String(buyScore(c)).padStart(5)} safety=${c.analysis.score} trend=${c.mom.trend.padEnd(9)} inflow=${c.mom.inflow} HYPE`);
  }
} else {
  console.log("\n>>> NO COIN PASSED THE FILTER RIGHT NOW — that is the honest result");
}
