#!/usr/bin/env node
// Re-pulls OHLCV + pad attribution for the simulator universe.
// Usage: node scripts/fetch-data.mjs [--limit N]
// Writes src/lib/data.json. Rate limited by GeckoTerminal — sleeps between calls.

import fs from "fs";
import path from "path";

const GT = "https://api.geckoterminal.com/api/v2";
const NET = "elysium";
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) {
      await sleep(12_000 + i * 8_000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }
  throw new Error(`rate limited after ${tries} tries: ${url}`);
}

async function topPools(pages = 2) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    const d = await get(`${GT}/networks/${NET}/pools?page=${p}&sort=h24_volume_usd_desc`);
    out.push(...(d.data || []));
    await sleep(2_500);
  }
  return out;
}

function shape(pool) {
  const a = pool.attributes;
  const base = pool.relationships?.base_token?.data?.id || "";
  const addr = base.includes("_") ? base.split("_").pop() : "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return {
    sym: (a.name || "").split("/")[0].trim(),
    addr,
    pool: a.address,
    vol24: Math.round(Number(a.volume_usd?.h24 || 0)),
    liq: Math.round(Number(a.reserve_in_usd || 0)),
    chg24: a.price_change_percentage?.h24 ?? null,
    created: a.pool_created_at,
  };
}

async function padOf(addr) {
  // ElyScreener renders the pad name as "← <Pad>" in the coin header.
  try {
    const res = await fetch(`https://elyscreener.com/coin/${addr}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; elysium-sim)" },
    });
    if (!res.ok) return { pad: "unknown", risk: "unknown", bots: null, devSold: false };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const m = text.match(/←\s*([A-Za-z0-9 .]{2,20}?)\s+(?:·|launches)/);
    const bots = text.match(/(\d+)%\s+held by bot bundles/);
    return {
      pad: (m?.[1] || "unknown").trim(),
      risk: /Risky|Caution/.test(text) ? "risky" : "safe",
      bots: bots ? Number(bots[1]) : null,
      devSold: /creator sold/.test(text),
    };
  } catch {
    return { pad: "unknown", risk: "unknown", bots: null, devSold: false };
  }
}

const PAD_IDS = { montra: "montra", ascend: "ascend", volta: "volta" };

function padId(name) {
  return PAD_IDS[String(name).toLowerCase()] || "other";
}

async function main() {
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 14);
  const pools = (await topPools(2)).map(shape).filter(Boolean);

  const seen = new Map();
  for (const t of pools) {
    const prev = seen.get(t.addr);
    if (!prev || t.vol24 > prev.vol24) seen.set(t.addr, t);
  }
  const majors = new Set(["HYPE", "USDC", "WHYPE", "KINETIQ", "KNTQ"]);
  const list = [...seen.values()].filter((t) => !majors.has(t.sym.toUpperCase())).slice(0, limit);

  console.log(`pools scanned: ${pools.length} | unique tokens: ${seen.size} | keeping ${list.length}`);

  const tokens = [];
  for (const t of list) {
    const meta = await padOf(t.addr);
    let candles = [];
    for (let attempt = 0; attempt < 3 && candles.length < 20; attempt++) {
      try {
        const d = await get(
          `${GT}/networks/${NET}/pools/${t.pool}/ohlcv/minute?aggregate=5&limit=1000`,
        );
        candles = d.data?.attributes?.ohlcv_list || [];
      } catch (e) {
        console.log(`  ${t.sym}: ${e.message}`);
        await sleep(10_000);
      }
    }
    console.log(
      `  ${t.sym.padEnd(11)} pad=${(meta.pad || "?").padEnd(9)} risk=${meta.risk.padEnd(7)} ` +
        `vol=$${t.vol24.toLocaleString().padStart(9)} bars=${String(candles.length).padStart(4)}`,
    );
    if (candles.length >= 20) {
      tokens.push({ ...t, pad: padId(meta.pad), risk: meta.risk, bots: meta.bots, devSold: meta.devSold, candles });
    }
    await sleep(3_000);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: "geckoterminal /networks/elysium ohlcv 5m + elyscreener pad attribution",
    tokens,
  };
  const dest = path.join(process.cwd(), "src", "lib", "data.json");
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log(`\nwrote ${dest} — ${tokens.length} tokens, ${tokens.reduce((s, t) => s + t.candles.length, 0)} bars`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
