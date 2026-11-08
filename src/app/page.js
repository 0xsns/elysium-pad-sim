"use client";

import { useMemo, useState } from "react";
import { PADS, TOKENS, PAD_BY_ID } from "@/lib/pads";
import { runPortfolio, DEFAULTS } from "@/lib/sim";
import { EquityCurve, Sparkline } from "@/components/charts";

const fmtUsd = (v, d = 2) =>
  `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtPct = (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const tone = (v) => (v > 0 ? "text-mint" : v < 0 ? "text-coral" : "text-dim");

function Stat({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border hair bg-panel/70 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-dim">{label}</div>
      <div className={`tabnum mt-1 text-[17px] font-semibold leading-none ${accent || "text-white"}`}>{value}</div>
      {sub ? <div className="mt-1 text-[10px] text-dim">{sub}</div> : null}
    </div>
  );
}

function Field({ label, value, min, max, step, onChange, suffix }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-dim">{label}</span>
        <span className="tabnum text-white">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-teal"
      />
    </label>
  );
}

export default function Page() {
  const [startUsd, setStartUsd] = useState(DEFAULTS.startUsd);
  const [tpPct, setTpPct] = useState(DEFAULTS.tpPct);
  const [slPct, setSlPct] = useState(DEFAULTS.slPct);
  const [trailPct, setTrailPct] = useState(DEFAULTS.trailPct);
  const [maxHoldMin, setMaxHoldMin] = useState(DEFAULTS.maxHoldMin);
  const [feeBps, setFeeBps] = useState(DEFAULTS.feeBps);
  const [seed, setSeed] = useState(DEFAULTS.seed);
  const [safetyFilter, setSafetyFilter] = useState(true);
  const [activePad, setActivePad] = useState("all");
  const [openTok, setOpenTok] = useState(null);

  const data = useMemo(() => {
    const byPad = {};
    for (const t of TOKENS) (byPad[t.pad] ||= []).push(t);
    // candles live in data.json, keyed by address
    return byPad;
  }, []);

  const candlesByAddr = useMemo(() => {
    // data.json is imported lazily to keep the initial bundle small
    return null;
  }, []);

  const [dataJson, setDataJson] = useState(null);
  if (dataJson === null && typeof window !== "undefined") {
    import("@/lib/data.json").then((m) => setDataJson(m.default || m));
  }

  const portfolio = useMemo(() => {
    if (!dataJson) return null;
    const byPad = {};
    for (const t of dataJson.tokens) (byPad[t.pad] ||= []).push(t);
    return runPortfolio(byPad, {
      startUsd,
      tpPct,
      slPct,
      trailPct,
      maxHoldMin,
      feeBps,
      seed,
      safetyFilter,
      pads: ["montra", "ascend", "volta"],
    });
  }, [dataJson, startUsd, tpPct, slPct, trailPct, maxHoldMin, feeBps, seed, safetyFilter]);

  const curve = useMemo(() => {
    if (!portfolio) return [];
    const all = portfolio.pads.flatMap((p) => p.runs.flatMap((r) => r.curve || []));
    if (!all.length) return [];
    const byTs = new Map();
    for (const pt of all) byTs.set(pt.ts, (byTs.get(pt.ts) || 0) + pt.equity);
    return [...byTs.entries()].sort((a, b) => a[0] - b[0]).map(([ts, equity]) => ({ ts, equity }));
  }, [portfolio]);

  const shownPads = activePad === "all" ? PADS.slice(0, 3) : PADS.filter((p) => p.id === activePad);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-teal shadow-[0_0_10px_#40ffd0]" />
            <h1 className="text-[19px] font-semibold tracking-tight text-white">Elysium Pad Sim</h1>
            <span className="rounded border hair px-1.5 py-0.5 text-[10px] text-dim">paper</span>
          </div>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-dim">
            $10 bankroll split across the three busiest launchpads on Elysium (chain 99901). Prices come from real
            Uniswap v4 pools — every trade below is replayed against actual 5-minute candles, not a random walk.
          </p>
        </div>
        <div className="text-right text-[10px] leading-relaxed text-dim">
          <div>
            data: <span className="text-white">GeckoTerminal</span> · pads: <span className="text-white">ElyScreener</span>
          </div>
          <div>
            candles 5m ·{" "}
            {dataJson
              ? dataJson.tokens.filter((t) => t.pad !== "other").reduce((s, t) => s + t.candles.length, 0).toLocaleString()
              : "…"}{" "}
            bars
          </div>
          <div>chain 99901 · gas HYPE</div>
        </div>
      </header>

      {/* hero stats */}
      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat
          label="Equity"
          value={portfolio ? fmtUsd(portfolio.equity) : "—"}
          sub={portfolio ? `from ${fmtUsd(portfolio.startUsd)}` : ""}
          accent="text-teal"
        />
        <Stat
          label="P&L"
          value={portfolio ? fmtPct(portfolio.pnlPct) : "—"}
          sub={portfolio ? fmtUsd(portfolio.pnlUsd) : ""}
          accent={portfolio ? tone(portfolio.pnlPct) : ""}
        />
        <Stat label="Trades" value={portfolio ? portfolio.trades : "—"} sub={portfolio ? `${portfolio.winRate}% win` : ""} />
        <Stat
          label="Best pad"
          value={portfolio ? PAD_BY_ID[[...portfolio.pads].sort((a, b) => b.pnlPct - a.pnlPct)[0].pad].name : "—"}
          sub={portfolio ? fmtPct([...portfolio.pads].sort((a, b) => b.pnlPct - a.pnlPct)[0].pnlPct) : ""}
          accent="text-mint"
        />
        <Stat
          label="Worst pad"
          value={portfolio ? PAD_BY_ID[[...portfolio.pads].sort((a, b) => a.pnlPct - b.pnlPct)[0].pad].name : "—"}
          sub={portfolio ? fmtPct([...portfolio.pads].sort((a, b) => a.pnlPct - b.pnlPct)[0].pnlPct) : ""}
          accent="text-coral"
        />
        <Stat label="Mode" value="paper" sub="no wallet, no funds" accent="text-amber" />
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* left column */}
        <div className="space-y-4">
          {/* equity curve */}
          <section className="rounded-xl border hair bg-panel/50 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[12px] font-medium text-white">Equity curve</h2>
              <div className="flex gap-1">
                {["all", ...PADS.slice(0, 3).map((p) => p.id)].map((k) => (
                  <button
                    key={k}
                    onClick={() => setActivePad(k)}
                    className={`rounded px-2 py-1 text-[10px] uppercase tracking-wide transition ${
                      activePad === k ? "bg-teal/15 text-teal" : "text-dim hover:text-white"
                    }`}
                  >
                    {k === "all" ? "all" : PAD_BY_ID[k].name}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              {curve.length > 1 ? (
                <EquityCurve points={curve} height={120} color="#40ffd0" />
              ) : (
                <div className="flex h-[120px] items-center justify-center text-[11px] text-dim">computing…</div>
              )}
            </div>
          </section>

          {/* pad cards */}
          {shownPads.map((pad) => {
            const pr = portfolio?.pads.find((p) => p.pad === pad.id);
            return (
              <section key={pad.id} className="rounded-xl border hair bg-panel/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pad.color }} />
                    <h2 className="text-[13px] font-medium text-white">{pad.name}</h2>
                    <span className="text-[11px] text-dim">{pad.blurb}</span>
                  </div>
                  <div className="tabnum flex items-center gap-3 text-[11px]">
                    <span className="text-dim">
                      budget <span className="text-white">{pr ? fmtUsd(pr.budget) : "—"}</span>
                    </span>
                    <span className="text-dim">
                      equity <span className={pr ? tone(pr.pnlUsd) : "text-white"}>{pr ? fmtUsd(pr.equity) : "—"}</span>
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${pr && pr.pnlPct >= 0 ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral"}`}>
                      {pr ? fmtPct(pr.pnlPct) : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-dim">
                  <span>24h pad volume {fmtUsd(pad.stats.vol24, 0)}</span>
                  <span>{pad.stats.trades24.toLocaleString()} trades</span>
                  <span>{pad.stats.holders.toLocaleString()} holders</span>
                  <span>{pad.stats.newToday.toLocaleString()} new today</span>
                  <span className="text-amber">alive after 24h {pad.stats.alive24h}%</span>
                  <span className="text-coral">creator sold {pad.stats.creatorSold}%</span>
                </div>

                <div className="mt-2.5 -mx-1 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-separate border-spacing-y-1 px-1 text-[11px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-dim">
                        <th className="pb-1 font-normal">token</th>
                        <th className="pb-1 text-right font-normal">24h vol</th>
                        <th className="pb-1 text-right font-normal">liq</th>
                        <th className="pb-1 text-right font-normal">pos</th>
                        <th className="pb-1 text-right font-normal">equity</th>
                        <th className="pb-1 text-right font-normal">pnl</th>
                        <th className="pb-1 text-right font-normal">trades</th>
                        <th className="pb-1 pl-3 font-normal">price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pr?.runs.map((r) => {
                        const t = TOKENS.find((x) => x.addr === r.addr);
                        const tk = dataJson?.tokens.find((x) => x.addr === r.addr);
                        const isOpen = openTok === r.addr;
                        return (
                          <>
                            <tr
                              key={r.addr}
                              onClick={() => setOpenTok(isOpen ? null : r.addr)}
                              className="cursor-pointer text-white/90 transition hover:bg-white/[0.03]"
                            >
                              <td className="rounded-l px-1 py-1.5">
                                <span className="flex items-center gap-1.5">
                                  {r.sym}
                                  {r.devSold ? <span className="text-[9px] text-coral">dev-sold</span> : null}
                                  {r.bots ? <span className="text-[9px] text-amber">{r.bots}% bots</span> : null}
                                </span>
                              </td>
                              <td className="tabnum px-1 text-right text-dim">{fmtUsd(r.vol24, 0)}</td>
                              <td className="tabnum px-1 text-right text-dim">{r.liq ? fmtUsd(r.liq, 0) : "—"}</td>
                              <td className="tabnum px-1 text-right text-dim">{fmtUsd(r.budget)}</td>
                              <td className="tabnum px-1 text-right">{fmtUsd(r.equity)}</td>
                              <td className={`tabnum px-1 text-right ${tone(r.pnlPct)}`}>{fmtPct(r.pnlPct)}</td>
                              <td className="tabnum px-1 text-right text-dim">{r.tradeCount}</td>
                              <td className="rounded-r px-1 pl-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Sparkline candles={tk?.candles} up={r.pnlPct >= 0} />
                                </div>
                              </td>
                            </tr>
                            {isOpen ? (
                              <tr key={`${r.addr}-d`}>
                                <td colSpan={8} className="rounded bg-ink px-2 py-2">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div>
                                      <div className="mb-1 text-[10px] uppercase tracking-wide text-dim">curve</div>
                                      <EquityCurve points={r.curve} height={70} color={r.pnlPct >= 0 ? "#7dffb2" : "#ff5c72"} />
                                    </div>
                                    <div className="tabnum space-y-0.5 text-[10px] text-dim">
                                      <div>winrate <span className="text-white">{r.winRate}%</span> · pf <span className="text-white">{r.profitFactor}</span></div>
                                      <div>avg win <span className="text-mint">{r.avgWinPct}%</span> · avg loss <span className="text-coral">{r.avgLossPct}%</span></div>
                                      <div>best <span className="text-mint">{r.bestPct}%</span> · worst <span className="text-coral">{r.worstPct}%</span></div>
                                      <div>fees paid <span className="text-white">{fmtUsd(r.totalFees, 3)}</span></div>
                                      {r.openPos ? (
                                        <div className="text-amber">
                                          open {fmtUsd(r.openPos.sizeUsd)} → {fmtUsd(r.openPos.markUsd)} ({fmtPct(r.openPos.pnlPct)})
                                        </div>
                                      ) : (
                                        <div>flat</div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-2 max-h-32 overflow-y-auto">
                                    <table className="w-full text-[10px]">
                                      <thead className="text-dim">
                                        <tr>
                                          <th className="text-left font-normal">entry→exit</th>
                                          <th className="text-right font-normal">pnl%</th>
                                          <th className="text-right font-normal">usd</th>
                                          <th className="text-right font-normal">held</th>
                                          <th className="text-right font-normal">why</th>
                                        </tr>
                                      </thead>
                                      <tbody className="tabnum">
                                        {(r.trades || []).slice(-8).reverse().map((tr, i) => (
                                          <tr key={i} className="text-white/80">
                                            <td className="py-0.5 text-dim">
                                              {new Date(tr.entryTs * 1000).toISOString().slice(5, 16)}
                                            </td>
                                            <td className={`text-right ${tone(tr.pnlPct)}`}>{tr.pnlPct}%</td>
                                            <td className={`text-right ${tone(tr.pnlUsd)}`}>{tr.pnlUsd}</td>
                                            <td className="text-right text-dim">{tr.heldMin}m</td>
                                            <td className="text-right text-dim">{tr.reason}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}


          {/* reference bots this is modelled on */}
          <section className="rounded-xl border hair bg-panel/40 p-3 text-[11px] leading-relaxed text-dim">
            <h3 className="mb-1.5 text-[12px] font-medium text-white">Reference bots this is modelled on</h3>
            <ul className="space-y-1">
              <li>
                <span className="text-white">chainstacklabs/pumpfun-bonkfun-bot</span> (Python, ⭐1.0k) — the incumbent
                open-source pump.fun sniper. Its config-object-per-strategy shape and take-profit / stop-loss loop are what
                the engine here copies.
              </li>
              <li>
                <span className="text-white">Now-Or-Neverr/BNB-Sniper-Bot-Fourmeme-TS</span> (TypeScript) — cleanest small
                reference: separate wallet / contract / monitor / bot classes. This sim keeps the same monitor-on-an-interval
                structure but swaps the chain adapter for a candle replay.
              </li>
              <li>
                <span className="text-white">0xhamssog/pons-sniper-bot</span> (TypeScript, Robinhood Chain) — most recent
                launchpad sniper; useful for how it treats bonding-curve quotes before a pool exists. Not used directly:
                Elysium pads launch straight into Uniswap v4 pools, so there is no pre-pool phase to model.
              </li>
              <li className="text-amber">
                None of these are dropped in as-is. They all sign transactions with a live key; this one deliberately does
                not have that code path.
              </li>
            </ul>
          </section>
          {/* how it works / honesty panel */}
          <section className="rounded-xl border hair bg-panel/40 p-3 text-[11px] leading-relaxed text-dim">
            <h3 className="mb-1.5 text-[12px] font-medium text-white">How this is built (no hand-waving)</h3>
            <ul className="space-y-1">
              <li>
                <span className="text-white">Universe.</span> 9 tokens are simulated — three per pad — using ElyScreener&apos;s
                token→pad attribution. Four more tokens belonged to pads outside this sim and are excluded rather than
                guessed into a bucket.
              </li>
              <li>
                <span className="text-white">Prices.</span> Real 5-minute OHLCV from GeckoTerminal for each token&apos;s Uniswap v4
                pool on Elysium. Between 30 and 1,000 bars per token, back to Nov 3 2026.
              </li>
              <li>
                <span className="text-white">Engine.</span> Momentum entry (green bar &gt; 2%), then take-profit / stop-loss /
                trailing-stop / time-stop. 1% round-trip fee plus $0.0035 gas per fill, amortised.
              </li>
              <li>
                <span className="text-white">Determinism.</span> A seeded RNG drives entry selection, so the same seed and
                config always reproduce the same trades. Change the seed to see variance.
              </li>
              <li className="text-amber">
                Honest limits: fills are assumed at the bar close with no slippage or MEV, and pool liquidity is not modelled.
                With $10 these are second-order — but on a $1k bankroll they would not be.
              </li>
            </ul>
          </section>
        </div>

        {/* right column — controls */}
        <aside className="space-y-3">
          <section className="rounded-xl border hair bg-panel/60 p-3">
            <h2 className="text-[12px] font-medium text-white">Parameters</h2>
            <div className="mt-2.5 space-y-3">
              <Field label="Bankroll" value={startUsd} min={1} max={100} step={1} onChange={setStartUsd} suffix=" USD" />
              <Field label="Take profit" value={tpPct} min={10} max={300} step={5} onChange={setTpPct} suffix="%" />
              <Field label="Stop loss" value={slPct} min={5} max={90} step={5} onChange={setSlPct} suffix="%" />
              <Field label="Trailing stop" value={trailPct} min={0} max={80} step={5} onChange={setTrailPct} suffix="%" />
              <Field label="Max hold" value={maxHoldMin} min={5} max={240} step={5} onChange={setMaxHoldMin} suffix=" min" />
              <Field label="Fee (round trip)" value={feeBps} min={0} max={500} step={25} onChange={setFeeBps} suffix=" bps" />
              <Field label="Seed" value={seed} min={1} max={9999} step={1} onChange={setSeed} />
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-dim">
              <input
                type="checkbox"
                checked={safetyFilter}
                onChange={(e) => setSafetyFilter(e.target.checked)}
                className="h-3 w-3 accent-teal"
              />
              skip risky / dev-sold tokens
            </label>

            <button
              onClick={() => {
                setStartUsd(DEFAULTS.startUsd);
                setTpPct(DEFAULTS.tpPct);
                setSlPct(DEFAULTS.slPct);
                setTrailPct(DEFAULTS.trailPct);
                setMaxHoldMin(DEFAULTS.maxHoldMin);
                setFeeBps(DEFAULTS.feeBps);
                setSeed(DEFAULTS.seed);
                setSafetyFilter(true);
              }}
              className="mt-3 w-full rounded border hair py-1.5 text-[11px] text-dim transition hover:border-teal/40 hover:text-teal"
            >
              reset to defaults
            </button>
          </section>

          <section className="rounded-xl border hair bg-panel/60 p-3">
            <h2 className="mb-1.5 text-[12px] font-medium text-white">Read this before you ape</h2>
            <ul className="space-y-1 text-[10.5px] leading-relaxed text-dim">
              <li>
                Montra and Ascend only keep <span className="text-amber">3%</span> and{" "}
                <span className="text-amber">12%</span> of coins alive past 24 hours. A random buy has a bad base rate no
                matter how good the bot is.
              </li>
              <li>Median holders per new coin is 1 on Montra. Most launches never get a second buyer.</li>
              <li>
                The sim can show +80% on $10. That is $8. Fees and gas are modelled, slippage and MEV are not — a live
                version on thin pools would give back part of that.
              </li>
              <li className="text-coral">This is a simulator. It cannot sign a transaction and holds no keys.</li>
            </ul>
          </section>

          <section className="rounded-xl border hair bg-panel/60 p-3 text-[10.5px] leading-relaxed text-dim">
            <h2 className="mb-1.5 text-[12px] font-medium text-white">Pads not included</h2>
            Kleos, BOXA, ElysPump and Obol all trade real volume (Kleos $737k/day, BOXA $3.8M/week) but ElyScreener does not
            expose a per-token pad mapping, so attributing their tokens would have meant guessing. Left out on purpose.
          </section>
        </aside>
      </div>

      <footer className="mt-8 border-t hair pt-3 text-[10px] leading-relaxed text-dim">
        Paper trading only. No wallet connection, no private keys, no transaction signing — the page cannot move funds.
        Data: GeckoTerminal OHLCV + ElyScreener pad attribution, captured 2026-11-09. Rebuild with{" "}
        <code className="text-white/70">npm run sim</code> for the CLI version.
      </footer>
    </main>
  );
}
