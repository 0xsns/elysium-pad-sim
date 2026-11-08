# Elysium Pad Sim

Paper-trading simulator for the three busiest launchpads on **Elysium** (Kinetiq's L2 for Hyperliquid, chain `99901`).

**$10 bankroll. Real pool prices. Zero wallets.**

Live: https://elysium-pad-sim.vercel.app

---

## What this actually is

A **simulator**, not a trading bot. It cannot sign a transaction, it holds no keys, and there is no code path that
broadcasts anything. It replays real historical prices against a trading strategy so you can see how the strategy would
have performed before you risk money.

If you want a real bot, this repo is the wrong thing — see [Reference bots](#reference-bots) for the projects that do
sign transactions, and read their license and risk disclaimers first.

---

## The three pads

Ranked by 24h volume on ElyScreener, 2026-11-09:

| Pad | 24h volume | Trades | Holders | Alive after 24h | Creator sold |
|---|---|---|---|---|---|
| **Montra** | $5.94M | 48,300 | 9,163 | 3% | 3% |
| **Ascend** | $5.35M | 32,200 | 7,436 | 12% | 16% |
| **Volta** | $2.96M | 3,200 | 3,101 | 5% | 22% |

"A live after 24h" is the number that matters: on Montra **97 of every 100 new coins are dead within a day**. Median
holders per new coin on Montra is **1**. Any strategy that buys a random new coin is fighting that base rate.

Kleos, BOXA, ElysPump and Obol are all larger than Volta by some measures but ElyScreener does not publish a
token→pad mapping for them, so attributing their tokens would have meant guessing. They are left out on purpose.

---

## How the simulation works

**Data**
- Universe: 9 tokens, three per pad, each attributed to its launchpad via `elyscreener.com/coin/<address>`.
- Prices: 5-minute OHLCV from GeckoTerminal for each token's real Uniswap v4 pool on Elysium, captured 2026-11-09.
- 30 to 1,000 bars per token, back to 2026-11-03.

**Engine** (`src/lib/sim.js`)
- Entry: bar closes more than 2% above the previous close, and the seeded RNG passes a 35% gate.
- Exit, whichever hits first: take-profit, stop-loss, trailing stop off the running peak, or a time stop.
- Costs: 1% round-trip fee (`feeBps`) plus $0.0035 gas per fill, charged on both legs.
- Determinism: `mulberry32(seed + barCount)` drives entry selection. Same seed and config always reproduce the same
  trades — change the seed to see the variance.

**What is deliberately not modelled**
- Slippage and MEV. Fills happen at the bar close.
- Pool depth. A $1.11 position cannot move a pool; a $1,000 position on a $8.5k-liquidity pool absolutely can.
- Failed transactions, reorgs, and the chain simply being down.

On a $10 bankroll those omissions are second-order. The panel says so rather than hiding it.

---

## Run it

```bash
npm install
npm run dev        # panel at http://localhost:3000
npm run build      # production build
npm run sim        # CLI: prints the full trade sheet
```

## Refresh the data

```bash
node scripts/fetch-data.mjs   # re-pulls OHLCV + pad attribution
node scripts/run-sim.mjs      # replays the strategy on the fresh data
```

The shipped `src/lib/data.json` is a snapshot. Token prices move; re-run these before trusting any number on screen.

---

## Reference bots

These informed the structure. None of their code is vendored here.

- [chainstacklabs/pumpfun-bonkfun-bot](https://github.com/chainstacklabs/pumpfun-bonkfun-bot) — Python, ~1.0k stars.
  The per-strategy config object and TP/SL loop.
- [Now-Or-Neverr/BNB-Sniper-Bot-Fourmeme-TS](https://github.com/Now-Or-Neverr/BNB-Sniper-Bot-Fourmeme-TS) —
  TypeScript. Smallest clean split of wallet / contract / monitor / bot.
- [0xhamssog/pons-sniper-bot](https://github.com/0xhamssog/pons-sniper-bot) — TypeScript, Robinhood Chain. Bonding-curve
  quoting before a pool exists.

What changed for Elysium: pads there launch **straight into Uniswap v4 pools**, so there is no bonding-curve phase to
snipe and no factory event to listen for. That removes most of what those bots exist to do, which is why this is a
replay engine instead of a sniper.

---

## Warnings, stated plainly

- **Paper only.** No wallet, no keys, no signing. The page cannot move funds.
- **Past prices, not future prices.** A strategy that made +83% on last week's candles has no obligation to do it again.
- **Thin liquidity.** Total Elysium liquidity across tracked pools was ~$776k. Positions larger than ~2% of a pool's
  liquidity will move the price against you.
- **Not financial advice.** The base rate on these pads is brutal and the panel is built to show that, not to sell you a
  strategy.

## License

MIT.
