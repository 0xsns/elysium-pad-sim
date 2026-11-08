"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scanMarket, deepScan, RULES } from "@/lib/scan";
import { buyScore } from "@/lib/rugged";
import { useLiveFeed } from "@/lib/useLiveFeed";
import { FeedHealth, TradeTape, Newborns } from "@/components/live";
import {
  fmtUsd,
  fmtPrice,
  fmtPct,
  fmtNum,
  fmtAge,
  shortAddr,
  tone,
  Spark,
  PriceChart,
  BubbleMap,
  CheckList,
  ScoreRing,
} from "@/components/viz";

const POLL_MS = 15_000; // deep scan cadence; the live tab updates far faster

export default function Cockpit() {
  const [scan, setScan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState(null);
  const [auto, setAuto] = useState(true);
  const [tab, setTab] = useState("picks");
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [ageTick, setAgeTick] = useState(0);
  const [maxScan, setMaxScan] = useState(10);
  const inflight = useRef(false);

  // live feeds: trade tape 2s, price pulse 3s, newborns 5s
  const live = useLiveFeed({ enabled: true });
  const [liveSym, setLiveSym] = useState({});

  const run = useCallback(
    async (opts = {}) => {
      if (inflight.current) return;
      inflight.current = true;
      setBusy(true);
      setErr(null);
      try {
        const r = await scanMarket({
          maxDeepScan: opts.maxScan ?? maxScan,
          onProgress: (p) => setProgress(p),
        });
        setScan(r);
        setProgress(null);
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setBusy(false);
        inflight.current = false;
      }
    },
    [maxScan],
  );

  // first load + polling
  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => run(), POLL_MS);
    return () => clearInterval(id);
  }, [auto, run]);

  // keep "age" counters ticking between polls
  useEffect(() => {
    const id = setInterval(() => setAgeTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const openDetail = async (row) => {
    setSel(row.addr);
    setDetail(null);
    setDetailBusy(true);
    try {
      const d = await deepScan(row);
      setDetail(d);
    } catch (e) {
      setDetail({ ...row, error: String(e?.message || e) });
    } finally {
      setDetailBusy(false);
    }
  };

  // symbol lookup for the live tape (ranked coins + newborns)
  useEffect(() => {
    const m = {};
    for (const r of scan?.ranked ?? []) m[String(r.addr).toLowerCase()] = r.sym;
    for (const r of live.newborn ?? []) m[String(r.address).toLowerCase()] = r.symbol;
    if (Object.keys(m).length) setLiveSym(m);
  }, [scan, live.newborn]);

  // clicking a row in the tape/newborns focuses that coin
  const pickLive = (addr) => {
    const row = (scan?.ranked ?? []).find((r) => String(r.addr).toLowerCase() === addr);
    if (row) {
      openDetail(row);
      setTab("detail");
    }
  };

  const picks = scan?.recommended ?? [];
  const ranked = scan?.ranked ?? [];
  const watch = scan?.watchlist ?? [];
  const best = picks[0] || null;
  const active = detail || ranked.find((r) => r.addr === sel) || best;

  const stats = scan?.stats;

  return (
    <main className="mx-auto max-w-[1180px] px-3 pb-24 pt-5 sm:px-5">
      {/* ---------- header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${busy ? "bg-amber" : auto ? "bg-teal" : "bg-dim"}`}
              style={{ boxShadow: busy || auto ? "0 0 10px #40ffd0" : "none" }}
            />
            <h1 className="text-[18px] font-semibold tracking-tight text-white">Elysium Rug Cockpit</h1>
            <span className="rounded border hair px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-dim">
              {auto ? `scan ${POLL_MS / 1000}s · feed 1s` : "scan paused"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-dim">
            Bot scan launchpad Elysium terus-terusan: rug check, bundle, distribusi holder, momentum, lalu kasih daftar
            coin yang <span className="text-white">lolos semua filter</span> buat lu beli manual. Trade tape dibaca
            langsung dari chain (node.eleos.fun) tiap 1 detik, data 3-7 detik; angka yang nggak bisa dihitung
            ditampilkan &quot;-&quot;, bukan dikarang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <div className="rounded border hair px-2 py-1.5 text-dim">
            HYPE <span className="text-white">{scan ? `$${scan.hypeUsd.toFixed(2)}` : "-"}</span>
          </div>
          <div className="rounded border hair px-2 py-1.5 text-dim">
            scan <span className="text-white">{stats ? stats.deepScanned : "-"}</span>
            <span className="text-dim">/{stats ? stats.fetched : "-"}</span>
          </div>
          <div className="rounded border hair px-2 py-1.5 text-dim">
            lolos <span className="text-mint">{stats ? stats.passed : "-"}</span>
          </div>
          <button
            onClick={() => setAuto((a) => !a)}
            className={`rounded border px-2.5 py-1.5 transition ${
              auto ? "hair text-dim hover:border-white/30 hover:text-white" : "border-teal/50 text-teal"
            }`}
          >
            {auto ? "pause" : "resume"}
          </button>
          <button
            onClick={() => run()}
            disabled={busy}
            className="rounded border hair px-2.5 py-1.5 text-dim transition hover:border-teal/40 hover:text-teal disabled:opacity-40"
          >
            {busy ? "scanning..." : "scan now"}
          </button>
        </div>
      </header>

      <div className="mt-2">
        <FeedHealth health={live.health} now={live.now} />
      </div>

      {progress && (
        <div className="mt-2 text-[10px] text-teal">
          menganalisa {progress.sym} ({progress.i + 1}/{progress.total})...
        </div>
      )}
      {err && (
        <div className="mt-2 rounded border border-coral/40 bg-coral/5 px-2 py-1.5 text-[10px] text-coral">
          scan gagal: {err}
        </div>
      )}

      {/* ---------- top strip ---------- */}
      <section className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Coin lolos" value={stats ? stats.passed : "-"} sub={`dari ${stats ? stats.deepScanned : "-"} dianalisa`} accent="text-mint" />
        <Kpi label="Kandidat" value={stats ? stats.eligible : "-"} sub="umur ≥ 5m + traksi" />
        <Kpi label="Total token" value={stats ? stats.fetched : "-"} sub="di-index launchpad" />
        <Kpi
          label="Top pick"
          value={best ? best.sym : "—"}
          sub={best ? `safety ${best.analysis.score}/100` : "belum ada yang lolos"}
          accent="text-teal"
        />
        <Kpi
          label="Buy score"
          value={best ? buyScore(best) : "-"}
          sub="safety + momentum"
          accent="text-amber"
        />
        <Kpi
          label="Update"
          value={scan ? new Date(scan.scannedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "-"}
          sub={`auto ${auto ? "on" : "off"}`}
        />
      </section>

      {/* ---------- tabs ---------- */}
      <nav className="mt-4 flex items-center gap-1 border-b hair">
        {[
          ["picks", `Rekomendasi (${picks.length})`],
          ["all", `Semua dianalisa (${ranked.length})`],
          ["watch", `Belum 5 menit (${watch.length})`],
          ["live", "Live"],
          ["detail", active ? `Detail: ${active.sym}` : "Detail"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-[11px] transition ${
              tab === k ? "border-teal text-teal" : "border-transparent text-dim hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[9px] text-dim">
          <span>scan depth</span>
          <select
            value={maxScan}
            onChange={(e) => setMaxScan(Number(e.target.value))}
            className="rounded border hair bg-ink px-1 py-0.5 text-[9px] text-white"
          >
            {[6, 10, 14, 20].map((n) => (
              <option key={n} value={n}>
                {n} coin
              </option>
            ))}
          </select>
        </div>
      </nav>

      {/* ---------- content ---------- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_340px]">
        <div>
          {tab === "picks" && (
            <>
              <PicksTable rows={picks} onSelect={openDetail} sel={sel} ageTick={ageTick} prices={live.prices} />
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-dim">
                * liq est = porsi supply yang ada di pool x market cap. Perkiraan, bukan reserve pool yang dikutip
                langsung — dipakai buat nimbang apakah posisi lu kebesaran.
              </p>
            </>
          )}
          {tab === "all" && <PicksTable rows={ranked} onSelect={openDetail} sel={sel} ageTick={ageTick} showReason prices={live.prices} />}
          {tab === "watch" && <WatchTable rows={watch} onSelect={openDetail} ageTick={ageTick} />}
          {tab === "live" && (
            <div className="space-y-2">
              <FeedHealth health={live.health} now={live.now} />
              <section className="rounded-lg border hair bg-panel/60">
                <div className="flex items-center justify-between border-b hair px-2 py-1.5">
                  <span className="text-[10px] text-dim">trade tape · semua coin, terbaru di atas</span>
                  <span className="text-[9px] text-teal">{live.trades.length} print di buffer</span>
                </div>
                <TradeTape trades={live.trades} prices={live.prices} symbols={liveSym} onPick={pickLive} now={live.now} />
              </section>
            </div>
          )}
          {tab === "detail" && (
            <DetailPanel row={active} detail={detail} loading={detailBusy} onRefresh={() => active && openDetail(active)} />
          )}
        </div>

        <aside className="space-y-3 pb-6">
          <section className="rounded-lg border hair bg-panel/60 p-2.5">
            <h2 className="mb-1.5 text-[11px] font-medium text-white">Filter yang dipakai</h2>
            <div className="space-y-0.5 text-[10.5px] text-dim">
              <div>umur minimal <span className="text-white">{RULES.minAgeMin} menit</span></div>
              <div>holder minimal <span className="text-white">{RULES.minHolders}</span></div>
              <div>top10 tanpa pool ≤ <span className="text-white">{RULES.maxTop10ExPool}%</span></div>
              <div>holder terbesar ≤ <span className="text-white">{RULES.maxTop1ExPool}%</span></div>
              <div>
                supply bundle ≤ <span className="text-white">{RULES.maxClusterSupplyPct}%</span>{" "}
                <span className="text-amber">(data sering kosong)</span>
              </div>
              <div>wallet ter-cluster ≤ <span className="text-white">{RULES.maxClusterWallets}</span></div>
              <div>dev belum jual <span className="text-white">wajib</span></div>
              <div>dev hold ≤ <span className="text-white">{RULES.maxDevPct}%</span></div>
              <div>likuiditas ≥ <span className="text-white">{fmtUsd(RULES.minLiquidityUsd)}</span></div>
              <div>pembeli ≥ <span className="text-white">{RULES.minBuyers}</span></div>
            </div>
            <p className="mt-2 border-t hair pt-1.5 text-[9px] leading-relaxed text-amber">
              Skor dihitung sendiri dari balances + clusters + trades, bukan nyontek skor pihak ketiga. Yang gagal di
              aturan fatal langsung dibuang walau skornya tinggi.
            </p>
          </section>

          <section className="rounded-lg border hair bg-panel/60 p-2.5">
            <h2 className="mb-1.5 text-[11px] font-medium text-white">Cara baca</h2>
            <ul className="space-y-1 text-[10.5px] leading-relaxed text-dim">
              <li>
                <span className="text-white">Safety</span> = 0-100 dari distribusi holder, bundle, dev, likuiditas.
              </li>
              <li>
                <span className="text-white">Buy score</span> = safety 62% + momentum. Urutan rekomendasi pakai ini.
              </li>
              <li>
                <span className="text-teal">Bubble biru</span> = whale ≥2%, <span className="text-amber">kuning</span> ={" "}
                dev, kecil = holder biasa.
              </li>
              <li>Harga di grafik = harga trade asli (HYPE), bukan candle sintetis.</li>
              <li className="text-coral">Panel ini nggak bisa beli apa-apa. Nggak ada wallet, nggak ada key.</li>
            </ul>
          </section>

          <section className="rounded-lg border hair bg-panel/60 p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[11px] font-medium text-white">Launch terbaru</h2>
              <span className="text-[8.5px] text-teal">5s</span>
            </div>
            <Newborns rows={live.newborn} now={live.now} onPick={pickLive} />
          </section>

          {scan?.established?.length ? (
            <section className="rounded-lg border hair bg-panel/60 p-2.5">
              <h2 className="mb-1 text-[11px] font-medium text-white">Coin lama (bukan launch baru)</h2>
              <p className="mb-1 text-[9px] leading-relaxed text-dim">
                Umurnya di atas 4 jam, jadi nggak masuk rekomendasi. Dipantau buat konteks pasar.
              </p>
              <div className="space-y-0.5 text-[9px]">
                {scan.established.slice(0, 6).map((e) => (
                  <button
                    key={e.addr}
                    onClick={() => openDetail(e)}
                    className="flex w-full items-baseline justify-between gap-2 text-left hover:text-teal"
                  >
                    <span className="truncate text-white/80">{e.sym}</span>
                    <span className="tabnum shrink-0 text-dim">
                      {fmtAge(e.ageMin)} · {fmtUsd(e.vol24)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {scan?.scannedAt && (
            <section className="rounded-lg border hair bg-panel/40 p-2.5 text-[9px] leading-relaxed text-dim">
              <div>terakhir scan {new Date(scan.scannedAt).toLocaleString("en-GB")}</div>
              <div>threshold: safety ≥ 75 dan nol aturan fatal</div>
              <div className="mt-1 text-dim/70">
                Sumber: elyscreener.com/api (ely_tokens, ely_balances, ely_trades, rpc/ely_clusters, rpc/es_dev_of)
              </div>
            </section>
          )}
        </aside>
      </div>

      <footer className="mt-6 border-t hair pb-8 pt-2 text-[10px] leading-relaxed text-dim">
        Bukan saran finansial. Coin di daftar tetap bisa rug — filter ini cuma menyingkirkan pola paling jelas. Selalu
        cek sendiri sebelum beli, dan jangan pernah pakai ukuran posisi yang bikin sakit kalau nol.
      </footer>
    </main>
  );
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border hair bg-panel/70 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-[0.12em] text-dim">{label}</div>
      <div className={`tabnum mt-1 truncate text-[15px] font-semibold leading-none ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[9px] text-dim">{sub}</div>}
    </div>
  );
}

function PicksTable({ rows, onSelect, sel, ageTick, showReason, prices }) {
  if (!rows?.length) {
    return (
      <div className="rounded-lg border hair bg-panel/40 p-6 text-center">
        <div className="text-[12px] text-white">Belum ada coin yang lolos</div>
        <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-dim">
          Itu hasil yang jujur, bukan error. Mayoritas launch baru gagal di distribusi holder atau bundle. Panel scan
          tiap 15 detik; kalau ada yang lolos, muncul di sini otomatis.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const a = r.analysis || {};
        const m = r.mom || {};
        const l = r.liquidity || {};
        const agg = r.ageMin != null ? r.ageMin + (ageTick * 10) / 60 : null;
        // live pulse overrides the scan-time snapshot when the coin is in the feed
        const lv = prices?.[String(r.addr).toLowerCase()];
        const price = lv?.price ?? r.priceUsd;
        const mcap = lv?.mcap ?? r.mcap;
        const chg = lv?.chg24 ?? r.chg24;
        return (
          <button
            key={r.addr}
            onClick={() => onSelect(r)}
            className={`block w-full rounded-lg border p-2 text-left transition ${
              sel === r.addr ? "border-teal/50 bg-teal/[0.04]" : "hair bg-panel/50 hover:border-white/20"
            }`}
          >
            <div className="flex items-start gap-2">
              <ScoreRing score={a.score} verdict={a.verdict} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate text-[12.5px] font-semibold text-white">{r.sym}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/70">
                    {r.pad}
                  </span>
                  {r.safetyScore != null && (
                    <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] text-white/60">idx {r.safetyScore}</span>
                  )}
                  <span className={`text-[9px] ${m.trend === "up-strong" ? "text-mint" : m.trend === "up" ? "text-mint/80" : m.trend === "down" ? "text-coral" : "text-dim"}`}>
                    {m.trend}
                  </span>
                  <span
                      className={`rounded px-1 py-0.5 text-[8.5px] ${
                        a.clusterKnown ? "bg-white/10 text-white/60" : "bg-amber/15 text-amber"
                      }`}
                    >
                      {a.clusterKnown ? "bundle ok" : "bundle n/a"}
                    </span>
                    <span className="ml-auto text-[8.5px] text-dim">umur {fmtAge(agg)}</span>
                </div>

                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10.5px] sm:grid-cols-4">
                  <Cell k="harga" v={<span className={lv ? "text-teal" : ""}>{fmtPrice(price)}</span>} />
                  <Cell k="mcap" v={fmtUsd(mcap)} />
                  <Cell k="liq est*" v={fmtUsd(r.liquidityUsd)} />
                  <Cell k="vol 24j" v={fmtUsd(r.vol24)} />
                  <Cell k="holder" v={fmtNum(r.holders)} />
                  <Cell k="top10" v={<span className={l.top10ExPoolPct > 40 ? "text-amber" : "text-white"}>{l.top10ExPoolPct != null ? `${l.top10ExPoolPct}%` : "-"}</span>} />
                  <Cell k="buyer/win" v={fmtNum(r.buyers)} />
                  <Cell k="24j" v={<span className={tone(chg)}>{fmtPct(chg)}</span>} />
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-dim">
                    <span className="text-mint">buy {fmtNum(r.buys24)}</span>
                    <span className="text-coral">sell {fmtNum(r.sells24)}</span>
                    <span>· {m.signals?.[0] || "—"}</span>
                    {r.devSold ? <span className="text-coral">dev sudah jual</span> : <span className="text-mint">dev hold</span>}
                  </div>
                  <div className="text-right text-[9px]">
                    <span className="text-dim">buy score </span>
                    <span className="text-amber">{buyScore(r)}</span>
                  </div>
                </div>

                {showReason && a.fatalFails?.length > 0 && (
                  <div className="mt-1 truncate text-[9px] text-coral">ditolak: {a.fatalFails.join(" · ")}</div>
                )}
                {showReason && a.passes && (
                  <div className="mt-1 truncate text-[9px] text-mint">lolos semua aturan fatal</div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Cell({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-dim">{k}</span>
      <span className="tabnum truncate text-white/90">{v}</span>
    </div>
  );
}

function WatchTable({ rows, onSelect, ageTick }) {
  if (!rows?.length) {
    return <div className="rounded-lg border hair bg-panel/40 p-4 text-center text-[10px] text-dim">tidak ada coin baru saat ini</div>;
  }
  return (
    <div className="rounded-lg border hair bg-panel/40">
      <div className="border-b hair px-2.5 py-1.5 text-[10px] text-dim">
        Belum 5 menit umurnya — dipantau, bukan direkomendasikan
      </div>
      <table className="w-full text-[10px]">
        <thead className="text-[9px] uppercase tracking-wide text-dim">
          <tr>
            <th className="px-2 py-1 text-left font-normal">coin</th>
            <th className="px-2 py-1 text-left font-normal">pad</th>
            <th className="px-2 py-1 text-right font-normal">umur</th>
            <th className="px-2 py-1 text-right font-normal">holder</th>
            <th className="px-2 py-1 text-right font-normal">vol24</th>
            <th className="px-2 py-1 text-right font-normal">24j</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.addr} onClick={() => onSelect(r)} className="cursor-pointer border-t hair hover:bg-white/[0.03]">
              <td className="px-2 py-1 text-white">{r.sym}</td>
              <td className="px-2 py-1 text-dim">{r.pad}</td>
              <td className="tabnum px-2 py-1 text-right text-amber">
                {fmtAge(r.ageMin != null ? r.ageMin + (ageTick * 10) / 60 : null)}
              </td>
              <td className="tabnum px-2 py-1 text-right text-dim">{fmtNum(r.holders)}</td>
              <td className="tabnum px-2 py-1 text-right text-dim">{fmtUsd(r.vol24)}</td>
              <td className={`tabnum px-2 py-1 text-right ${tone(r.chg24)}`}>{fmtPct(r.chg24)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({ row, detail, loading, onRefresh }) {
  const d = detail || row;
  if (!d) {
    return <div className="rounded-lg border hair bg-panel/40 p-6 text-center text-[11px] text-dim">pilih coin dulu</div>;
  }
  const a = d.analysis || {};
  const m = d.mom || {};
  const l = d.liquidity || {};
  const trades = d.recentTrades || [];
  const buys = trades.filter((t) => t.side === "buy").length;
  const sells = trades.filter((t) => t.side === "sell").length;

  return (
    <div className="space-y-2">
      {/* headline */}
      <section className="rounded-lg border hair bg-panel/60 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="truncate text-[15px] font-semibold text-white">{d.sym}</h2>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase text-white/70">{d.pad}</span>
              <span className={`text-[9px] ${a.verdict === "AVOID" ? "text-coral" : "text-mint"}`}>{a.verdict}</span>
              {loading && <span className="text-[9px] text-teal">memuat ulang...</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9.5px] text-dim">
              <span>
                dev <span className="text-amber">{shortAddr(d.creator || d.dev?.creator)}</span>
              </span>
              <span>
                pool <span className="text-white/70">{shortAddr(d.pool)}</span>
              </span>
              <span>
                umur <span className="text-white/70">{fmtAge(d.ageMin)}</span>
              </span>
              <button onClick={onRefresh} className="text-teal hover:underline">
                refresh
              </button>
            </div>
          </div>
          <div className="text-right">
            <ScoreRing score={a.score} verdict={a.verdict} size={54} />
          </div>
        </div>

        {/* numbers */}
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          <Mini label="harga" value={fmtPrice(d.priceUsd)} />
          <Mini label="mcap" value={fmtUsd(d.mcap)} />
          <Mini label="liq est*" value={fmtUsd(d.liquidityUsd)} sub={l.poolSharePct != null ? `${l.poolSharePct}% supply di pool` : null} />
          <Mini label="vol 24j" value={fmtUsd(d.vol24)} />
          <Mini label="holder" value={fmtNum(d.holders)} sub={`${l.sampled ?? "-"} wallet di-sample`} />
          <Mini label="24j" value={fmtPct(d.chg24)} accent={tone(d.chg24)} />
        </div>
      </section>

      {/* chart + buy/sell */}
      <section className="grid gap-2 sm:grid-cols-[1fr_150px]">
        <div className="rounded-lg border hair bg-panel/60 p-2">
          <div className="mb-1 flex items-center justify-between text-[9px] text-dim">
            <span>grafik trade (harga HYPE)</span>
            <span>
              <span className="text-mint">▲{buys} buy</span> · <span className="text-coral">▼{sells} sell</span>
            </span>
          </div>
          <PriceChart trades={trades} height={128} />
        </div>
        <div className="rounded-lg border hair bg-panel/60 p-2">
          <div className="text-[9px] uppercase tracking-wide text-dim">flow</div>
          <div className="mt-1 space-y-1 text-[10px]">
            <Row k="net inflow" v={`${m.inflow ?? "-"} HYPE`} accent={tone(m.inflow)} />
            <Row k="rasio beli" v={m.buyRatio != null ? `${(m.buyRatio * 100).toFixed(0)}%` : "-"} />
            <Row k="buyer (window)" v={fmtNum(d.buyers)} />
            <Row k="buy 24j" v={fmtNum(d.buys24)} accent="text-mint" />
            <Row k="sell 24j" v={fmtNum(d.sells24)} accent="text-coral" />
            <Row k="trend" v={m.trend} accent={m.trend?.includes("up") ? "text-mint" : m.trend === "down" ? "text-coral" : "text-dim"} />
          </div>
        </div>
      </section>

      {/* bubble map + checklist */}
      <section className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border hair bg-panel/60 p-2">
          <div className="mb-1 flex items-center justify-between text-[9px] text-dim">
            <span>bubble map holder</span>
            <span>
              top10 <span className={l.top10ExPoolPct > 40 ? "text-amber" : "text-white"}>{l.top10ExPoolPct ?? "-"}%</span>
            </span>
          </div>
          {d.bubble ? <BubbleMap bubble={d.bubble} size={280} /> : <div className="py-10 text-center text-[10px] text-dim">bubble map butuh data balances</div>}
          {d.bubble && (
            <div className="mt-1 text-center text-[8.5px] text-dim">
              top1 {d.bubble.top1}% · bundle {d.clusters?.clusterWallets ?? "-"} wallet / {d.clusters?.clusters ?? "-"} cluster
            </div>
          )}
        </div>

        <div className="rounded-lg border hair bg-panel/60 p-2">
          <div className="mb-1 flex items-center justify-between text-[9px] text-dim">
            <span>rug check (show the work)</span>
            <span className={a.passes ? "text-mint" : "text-coral"}>
              {a.passes
                ? a.failures?.length
                  ? `LOLOS · ${a.failures.length} catatan`
                  : "LOLOS SEMUA"
                : "GAGAL"}
            </span>
          </div>
          <CheckList checks={a.checks} />
          {!a.clusterKnown && (
            <div className="mt-1 rounded bg-amber/10 px-1.5 py-1 text-[8.5px] leading-relaxed text-amber">
              bundle <span className="font-semibold">tidak bisa diverifikasi</span> - indexer ElyScreener mengembalikan
              nilai kosong untuk hampir semua coin. Tanda &quot;?&quot; berarti tidak diketahui, bukan aman. Pakai top10,
              holder terbesar, dan jumlah wallet ter-cluster sebagai pengganti.
            </div>
          )}
          {a.passes && a.failures?.length > 0 && (
            <div className="mt-1 rounded bg-amber/10 px-1.5 py-1 text-[8.5px] leading-relaxed text-amber">
              Lolos aturan fatal, tapi ada catatan: {a.failures.join(" · ")}. Boleh dibeli dengan ukuran kecil, atau
              tunggu metriknya membaik.
            </div>
          )}
          {l.supplyInconsistent && (
            <div className="mt-1 rounded bg-amber/10 px-1.5 py-1 text-[8.5px] leading-relaxed text-amber">
              data supply indexer tidak konsisten dengan balances on-chain — konsentrasi dihitung pakai total sample.
            </div>
          )}
        </div>
      </section>

      {/* recent trades */}
      <section className="rounded-lg border hair bg-panel/60 p-2">
        <div className="mb-1 text-[9px] uppercase tracking-wide text-dim">trade terakhir</div>
        <div className="max-h-40 overflow-y-auto">
          <table className="w-full text-[9.5px]">
            <thead className="text-dim">
              <tr>
                <th className="text-left font-normal">waktu</th>
                <th className="text-left font-normal">side</th>
                <th className="text-right font-normal">HYPE</th>
                <th className="text-right font-normal">harga</th>
                <th className="text-right font-normal">trader</th>
              </tr>
            </thead>
            <tbody className="tabnum">
              {trades.slice(0, 22).map((t, i) => (
                <tr key={i} className="border-t hair/60">
                  <td className="py-0.5 text-dim">{new Date(t.at).toLocaleTimeString("en-GB")}</td>
                  <td className={t.side === "buy" ? "text-mint" : "text-coral"}>{t.side}</td>
                  <td className={`text-right ${t.side === "buy" ? "text-mint/80" : "text-coral/80"}`}>{Number(t.hype).toFixed(3)}</td>
                  <td className="text-right text-white/70">{Number(t.price_hype).toExponential(2)}</td>
                  <td className="text-right text-dim">{shortAddr(t.trader)}</td>
                </tr>
              ))}
              {!trades.length && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-dim">
                    tidak ada trade terbaca
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {m.risks?.length > 0 && (
        <section className="rounded-lg border border-amber/30 bg-amber/[0.04] p-2 text-[9.5px] leading-relaxed text-amber">
          risiko: {m.risks.join(" · ")}
        </section>
      )}
    </div>
  );
}

function Mini({ label, value, sub, accent }) {
  return (
    <div className="rounded border hair bg-ink/60 px-1.5 py-1">
      <div className="text-[8px] uppercase tracking-wide text-dim">{label}</div>
      <div className={`tabnum truncate text-[11px] font-medium ${accent || "text-white"}`}>{value ?? "-"}</div>
      {sub && <div className="truncate text-[7.5px] text-dim">{sub}</div>}
    </div>
  );
}

function Row({ k, v, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-dim">{k}</span>
      <span className={`tabnum ${accent || "text-white/90"}`}>{v ?? "-"}</span>
    </div>
  );
}
