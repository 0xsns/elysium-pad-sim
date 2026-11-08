import fs from "fs";
import { runPortfolio } from "../src/lib/sim.js";

const data = JSON.parse(fs.readFileSync("./src/lib/data.json", "utf8"));
const byPad = {};
for (const t of data.tokens) (byPad[t.pad] ||= []).push(t);

const res = runPortfolio(byPad, {});
console.log("BANKROLL $10 over 3 pads");
console.log("equity  $%s  (%s%)", res.equity, res.pnlPct);
console.log("trades  %s   winrate %s%", res.trades, res.winRate);
for (const p of res.pads) {
  console.log(`\n[${p.pad}] budget $${p.budget} -> $${p.equity} (${p.pnlPct}%) | tokens ${p.tokens} skipped ${p.skipped}`);
  for (const r of p.runs) {
    console.log(`   ${r.sym.padEnd(10)} $${String(r.budget).padEnd(7)} -> $${String(r.equity).padEnd(8)} ${String(r.pnlPct).padStart(7)}%  ${r.tradeCount} trades  wr ${r.winRate}%  pf ${r.profitFactor}${r.openPos ? "  [open " + r.openPos.pnlPct + "%]" : ""}`);
  }
}
