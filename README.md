# Elysium Rug Cockpit

Live scanner for every launchpad on **Elysium** (Kinetiq's L2 for Hyperliquid, chain `99901`).

It reads the open ElyScreener API directly from the browser, scores each new coin for rug risk
**from raw on-chain data**, and produces a shortlist of fresh launches that clear every filter — so you can
buy manually.

**It holds no keys, signs nothing, and cannot trade.** It is an analysis panel, not a bot.

Live: https://elysium-pad-sim.vercel.app

---

## What it actually does

Every 60 seconds (auto, pausable):

1. Pulls the token index (`ely_tokens`) — ~500 coins, ordered by creation.
2. Keeps only **fresh launches**: age between **5 minutes and 4 hours** with real traction.
3. Deep-scans the top N by volume. For each one it fetches:
   - `ely_balances` — holder balances (top 120)
   - `rpc/ely_clusters` — cluster/funder grouping = **bundle detection**
   - `rpc/es_dev_of` — which wallet deployed it, whether the dev sold
   - `ely_trades` — recent prints, used for the price chart and buy/sell flow
4. Computes its **own** safety score and rejects anything that trips a fatal rule.

Nothing is copied from a third-party score, and a metric that cannot be computed is rendered `-` rather than
guessed.

---

## The filters

| Rule | Threshold | Why |
|---|---|---|
| age | ≥ 5 min, ≤ 4 h | "new launch", not a 12-day-old coin |
| holders | ≥ 25 | real distribution, not 3 wallets |
| top10 excluding pool | ≤ 45% | a few wallets cannot dump on you |
| largest holder excluding pool | ≤ 20% | no single whale owns the coin |
| bundle (cluster supply) | ≤ 10% | no coordinated sniper bundle |
| dev sold | never | the person who deployed it is still in |
| dev holding | ≤ 8% | dev can't nuke the chart |
| liquidity | ≥ $2.5K | you can actually exit |
| buyers | ≥ 15 | there is demand, not just one wallet |

A **fatal** failure removes the coin from recommendations no matter how good the score is. **Non-fatal**
notes are shown on the card (`LOLOS · 2 catatan`) so you can see the trade-off instead of a false all-clear.

### Two metrics worth understanding

**The LP pool wallet is excluded from holder math.** `0xe2e1...` shows up as holder #1 on most coins because it
holds the pool's token side — 82% of VEYRA's supply. Counting it would mark every coin as "82% concentrated".
It is filtered out before concentration is computed.

**Liquidity is an estimate.** The API exposes no pool reserves, so `liq est` = share of supply held by the pool
× market cap. It is directionally right (thin vs deep) and labelled `*` everywhere it appears.

---

## Why there is no trading bot

Every pool on Elysium is **Uniswap v4**. A swap needs a registered router that encodes the `PoolKey`
(`currency0`, `currency1`, `fee`, `tickSpacing`, `hooks`) plus `Actions`/`Params`. On chain `99901` these are
not deployed:

```
SwapRouter02    -> 0x
UniversalRouter -> 0x
V3 Factory      -> 0x
V4 PoolManager  -> 0x
Permit2         -> deployed
WHYPE           -> deployed
```

With no router there is no public swap path, so a "signing bot" would produce 100% failed transactions.
That is why this repo ships an analysis panel instead of a fake executor.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

CORS on the ElyScreener API is `access-control-allow-origin: *`, so no backend proxy is needed.
To inspect the scanner from the CLI:

```bash
node scripts/test-scan.mjs
```

---

## Stack

- Next.js App Router, React client components, Tailwind
- Custom SVG for the price chart, bubble map, and score rings — no chart library
- ElyScreener REST as the only data source

Muted text is `#94aab8` on `#05070a` (8.4:1 contrast, WCAG AAA) because the original grey was unreadable on
OLED screens.

---

## Honest limits

- **A coin on this list can still rug.** These filters remove the obvious patterns, not every scam.
- **Rate limits are real.** The panel scans ~10 coins per cycle; raising scan depth slows the cycle.
- **No slippage, MEV, or exit-liquidity modelling.** Liq is an estimate.
- **Not financial advice.** Size positions so zero is survivable.
