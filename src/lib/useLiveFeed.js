"use client";

// Live data feeds for the cockpit.
//
// HONESTY NOTE, and the reason this file exists separately from scan.js:
// there is no websocket, no SSE, and no push feed on Elysium. RPC nodes on chain 99901
// block eth_getLogs and expose no event subscription, so an event-driven tape is not
// possible from a browser. The fastest real path is the indexer's REST API, which
// ElyScreener's own UI polls every 2 seconds.
//
// So this hook polls at the indexer's own cadence and - critically - measures and shows
// the age of the data it renders. No fake ticking, no interpolated prices, no "live"
// badge that does not correspond to a real fetch timestamp.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/es-api";
import { fetchRecentSwaps, tapeStats } from "@/lib/onchain";

const TAPE_MS = 1_000; // on-chain tape: polled every second, data is 3-7s old at source
const PULSE_MS = 3_000; // price/mcap/volume pulse for the busiest coins
const NEWBORN_MS = 5_000; // new launches

export function useLiveFeed({ enabled = true } = {}) {
  const [trades, setTrades] = useState([]);
  const [prices, setPrices] = useState({});
  const [newborn, setNewborn] = useState([]);
  const [health, setHealth] = useState({
    tapeAt: null, // when we last successfully fetched the tape
    pulseAt: null,
    tapeLagMs: null, // age of the newest trade *in the data*, vs our clock
    ticks: 0,
    errors: 0,
    latencyMs: null, // how long the request itself took
    source: null, // "chain" | "indexer"
    block: null,
    resolved: null,
    unresolved: null,
  });

  const seenRef = useRef(new Set());
  const atRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let tapeT, pulseT, newT;

    const tapeLoop = async () => {
      const t0 = performance.now();
      let rows = null;
      try {
        // chain-first: newest swaps from the archive RPC, no indexer batch wait
        rows = await fetchRecentSwaps({ lookback: 1200, maxTrades: 60 });
      } catch {
        rows = null;
      }
      const rtt = performance.now() - t0;
      if (!alive) return;

      if (rows && rows.trades.length) {
        const list = rows.trades;
        const newestAt = Math.max(...list.filter((t) => t.at).map((t) => t.at), 0);
        const lag = newestAt ? Date.now() - newestAt : null;

        setTrades((prev) => {
          const fresh = list.filter((t) => !seenRef.current.has(t.txHash));
          fresh.forEach((t) => seenRef.current.add(t.txHash));
          if (!fresh.length) return prev;
          const next = [...fresh, ...prev];
          // bound the dedupe set so it cannot grow forever
          if (seenRef.current.size > 4000) seenRef.current = new Set(next.slice(0, 2000).map((t) => t.txHash));
          return next.slice(0, 150);
        });

        const st = tapeStats(list);
        setHealth((h) => ({
          ...h,
          tapeAt: Date.now(),
          tapeLagMs: lag,
          latencyMs: Math.round(rtt),
          ticks: h.ticks + 1,
          errors: 0,
          source: "chain",
          block: rows.latest,
          resolved: st.resolved,
          unresolved: st.unresolved,
        }));
      } else {
        // chain path failed (rate limit / RPC down): fall back to the indexer tape so the
        // panel keeps moving, and say so instead of silently pretending nothing changed
        const fb = await api.liveTrades(60);
        if (alive && Array.isArray(fb) && fb.length) {
          const newest = fb.reduce((m, r) => (r.at > m ? r.at : m), fb[0].at);
          setTrades((prev) => {
            const fresh = fb
              .map((r) => ({ ...r, txHash: `${r.token}:${r.at}:${r.hype}`, symbol: r.token?.slice(0, 6) }))
              .filter((r) => !seenRef.current.has(r.txHash));
            fresh.forEach((r) => seenRef.current.add(r.txHash));
            if (!fresh.length) return prev;
            return [...fresh, ...prev].slice(0, 150);
          });
          setHealth((h) => ({
            ...h,
            tapeAt: Date.now(),
            tapeLagMs: Date.now() - new Date(newest).getTime(),
            latencyMs: Math.round(rtt),
            ticks: h.ticks + 1,
            source: "indexer",
            errors: 0,
          }));
        } else if (alive) {
          setHealth((h) => ({ ...h, errors: h.errors + 1 }));
        }
      }
      tapeT = setTimeout(tapeLoop, TAPE_MS);
    };

    const pulseLoop = async () => {
      const rows = await api.pulse();
      if (!alive) return;
      if (Array.isArray(rows)) {
        const map = {};
        for (const r of rows) {
          map[String(r.address).toLowerCase()] = {
            price: r.price_hype,
            mcap: r.mcap_usd,
            vol24: r.vol24_hype,
            buys: r.buys24,
            sells: r.sells24,
            chg24: r.change24,
            holders: r.holders,
            lastTradeAt: r.last_trade_at,
          };
        }
        setPrices(map);
        setHealth((h) => ({ ...h, pulseAt: Date.now() }));
      }
      pulseT = setTimeout(pulseLoop, PULSE_MS);
    };

    const newbornLoop = async () => {
      const rows = await api.newborn(25);
      if (!alive) return;
      if (Array.isArray(rows)) setNewborn(rows);
      newT = setTimeout(newbornLoop, NEWBORN_MS);
    };

    tapeLoop();
    pulseLoop();
    newbornLoop();

    return () => {
      alive = false;
      clearTimeout(tapeT);
      clearTimeout(pulseT);
      clearTimeout(newT);
    };
  }, [enabled]);

  // ticking clock so the UI can render the true age of the feed between fetches
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  return { trades, prices, newborn, health, now };
}
