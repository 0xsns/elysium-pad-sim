"use client";

// Live components: trade tape, feed-health strip, newborn launches, live prices.
// Everything shows the real age of the data. Nothing pretends to be fresher than it is.

import { useEffect, useRef, useState } from "react";
import { fmtUsd, fmtPrice, fmtAge, shortAddr } from "@/components/viz";

const ago = (ms) => {
  if (ms == null || Number.isNaN(ms)) return "-";
  const s = Math.max(0, ms / 1000);
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

/** Health strip: how fresh is what you are looking at, measured, not claimed. */
export function FeedHealth({ health, now }) {
  const lag = health.tapeAt ? now - health.tapeAt : null;
  const lagOk = lag != null && lag < 3500;
  const dead = health.errors > 3;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border hair bg-panel/60 px-2.5 py-1.5 text-[10px]">
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${dead ? "bg-coral" : lagOk ? "bg-teal" : "bg-amber"}`}
          style={{ boxShadow: dead ? "none" : "0 0 8px currentColor" }}
        />
        <span className={dead ? "text-coral" : lagOk ? "text-teal" : "text-amber"}>
          {dead ? "feed terganggu" : lagOk ? "live" : "menyusul"}
        </span>
      </span>
      <span className="text-dim">
        tarikan terakhir <span className="tabnum text-white">{ago(lag)}</span> lalu
      </span>
      <span className="text-dim">
        umur trade terbaru <span className="tabnum text-white">{health.tapeLagMs != null ? ago(health.tapeLagMs) : "-"}</span>
      </span>
      <span className="text-dim">
        rtt <span className="tabnum text-white">{health.latencyMs != null ? `${health.latencyMs}ms` : "-"}</span>
      </span>
      <span className="text-dim">
        tick <span className="tabnum text-white">{health.ticks}</span>
      </span>
      <span className="text-dim">
        sumber{" "}
        <span className={health.source === "chain" ? "text-teal" : "text-amber"}>
          {health.source === "chain" ? `chain blk ${health.block ?? "-"}` : health.source === "indexer" ? "indexer (fallback)" : "-"}
        </span>
      </span>
      {health.resolved != null && (
        <span className="text-dim">
          resolved <span className="tabnum text-white">{health.resolved}</span>
          {health.unresolved ? <span className="text-amber"> / {health.unresolved} tanpa pool</span> : null}
        </span>
      )}
      <span className="ml-auto text-[9px] text-dim/80">poll 1s · chain langsung, tanpa websocket</span>
    </div>
  );
}

/** The trade tape: real prints, newest first, with age per row. */
export function TradeTape({ trades, prices, symbols, onPick, now }) {
  if (!trades?.length) {
    return <div className="px-2 py-6 text-center text-[10px] text-dim">menunggu trade pertama...</div>;
  }
  return (
    <div className="max-h-[340px] overflow-y-auto">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-panel text-[9px] uppercase tracking-wide text-dim">
          <tr>
            <th className="px-2 py-1 text-left font-normal">umur</th>
            <th className="px-2 py-1 text-left font-normal">coin</th>
            <th className="px-2 py-1 text-left font-normal">side</th>
            <th className="px-2 py-1 text-right font-normal">HYPE</th>
            <th className="px-2 py-1 text-right font-normal">harga</th>
            <th className="px-2 py-1 text-right font-normal">trader</th>
          </tr>
        </thead>
        <tbody className="tabnum">
          {trades.slice(0, 60).map((t, i) => {
            const age = now - new Date(t.at).getTime();
            const sym = t.symbol || symbols?.[String(t.token).toLowerCase()] || shortAddr(t.poolId || t.token);
            // price shown from the pulse feed when available, else the print itself
            const p = t.price ?? prices?.[String(t.token || "").toLowerCase()]?.price ?? t.price_hype;
            return (
              <tr
                key={`${t.token}-${t.at}-${t.side}-${i}`}
                onClick={() => t.token && onPick?.(String(t.token).toLowerCase())}
                className={`cursor-pointer border-t hair/60 hover:bg-white/[0.04] ${age < 4000 ? "bg-teal/[0.05]" : ""}`}
              >
                <td className={`px-2 py-0.5 ${age < 4000 ? "text-teal" : "text-dim"}`}>{ago(age)}</td>
                <td className="px-2 py-0.5 text-white">{sym}</td>
                <td className={`px-2 py-0.5 ${t.side === "buy" ? "text-mint" : t.side === "sell" ? "text-coral" : "text-dim"}`}>{t.side || "?"}</td>
                <td className={`px-2 py-0.5 text-right ${t.side === "buy" ? "text-mint/80" : "text-coral/80"}`}>
                  {t.hype == null ? "-" : Number(t.hype).toFixed(3)}
                </td>
                <td className="px-2 py-0.5 text-right text-white/70">{fmtPrice(p)}</td>
                <td className="px-2 py-0.5 text-right text-dim">{shortAddr(t.sender || t.trader, 3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Newest launches, caught the moment the indexer publishes them. */
export function Newborns({ rows, now, onPick }) {
  if (!rows?.length) return <div className="px-2 py-4 text-center text-[10px] text-dim">belum ada</div>;
  return (
    <div className="max-h-[220px] space-y-0.5 overflow-y-auto">
      {rows.map((r) => {
        const ageMin = (now - new Date(r.created_at).getTime()) / 60000;
        const tooYoung = ageMin < 5;
        return (
          <button
            key={r.address}
            onClick={() => onPick?.(String(r.address).toLowerCase())}
            className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left text-[10px] hover:bg-white/[0.04]"
          >
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-white">{r.symbol}</span>
              <span className="shrink-0 text-[8.5px] uppercase text-dim">{r.launchpad}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabnum">
              <span className="text-dim">{fmtUsd(r.mcap_usd)}</span>
              <span className={tooYoung ? "text-amber" : "text-white/70"}>{fmtAge(ageMin)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
