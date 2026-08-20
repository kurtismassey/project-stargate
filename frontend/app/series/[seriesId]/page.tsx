"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, SeriesDetail, TaskingSummary, downloadJson } from "@/lib/api";
import { Protocol } from "@/lib/protocol";

const PROTOCOL_OPTIONS: { value: Protocol; label: string }[] = [
  { value: "crv", label: "CRV" },
  { value: "erv", label: "ERV" },
  { value: "arv", label: "ARV" },
  { value: "wrv", label: "WRV" },
];

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <span className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border text-text-muted border-line bg-chrome-2">
        sealed
      </span>
    );
  }
  const tone =
    status === "active"
      ? "text-signal border-signal-line bg-signal-dim"
      : status === "locked"
        ? "text-warn border-warn/40 bg-warn-dim"
        : "text-text-muted border-line bg-chrome-2";
  return (
    <span
      className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${tone}`}
    >
      {status}
    </span>
  );
}

export default function SeriesRunnerPage() {
  const params = useParams<{ seriesId: string }>();
  const router = useRouter();
  const seriesId = params.seriesId;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [protocol, setProtocol] = useState<Protocol>("crv");
  const [addCount, setAddCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const detail = await api.getSeries(seriesId);
      setSeries(detail);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Series unreachable");
    }
  }, [seriesId]);

  useEffect(() => {
    load();
  }, [load]);

  const enter = async (tasking: TaskingSummary) => {
    if (tasking.sessionId) {
      router.push(`/session/${tasking.sessionId}`);
      return;
    }
    setBusy(true);
    try {
      const session = await api.startSession(tasking.id, {});
      router.push(`/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
      setBusy(false);
    }
  };

  const addTrials = async () => {
    setBusy(true);
    try {
      const detail = await api.sealSeriesTrials(seriesId, {
        trialCount: addCount,
        protocol,
      });
      setSeries(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not seal trials");
    } finally {
      setBusy(false);
    }
  };

  const nextOpen = series?.trials.find((trial) => !trial.sessionId);
  const lags = series
    ? Object.entries(series.displacement).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      )
    : [];

  if (!series) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mono text-[12px] text-text-faint tracking-widest pulse">
          {error || "LOADING SERIES"}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="btn" onClick={() => router.push("/")}>
              Ops
            </button>
            <div>
              <h1 className="mono text-base tracking-[0.2em] text-text">
                {series.name}
              </h1>
              <div className="label mt-1">
                Sequential run / {series.taskingCount} trials / TTI
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const pkg = await api.getSeriesPackage(seriesId);
                  downloadJson(
                    `stargate-series-${series?.name ?? "run"}.json`,
                    pkg,
                  );
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Export failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Export package
            </button>
            {nextOpen ? (
              <button
                className="btn btn-signal"
                onClick={() => enter(nextOpen)}
                disabled={busy}
              >
                Next chamber, trial {nextOpen.seriesPosition}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 w-full flex-1">
        {error ? (
          <p className="mono text-[11px] text-danger mb-4">{error}</p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="panel px-4 py-3">
            <div className="label">Trials</div>
            <div className="mono text-xl mt-1">{series.taskingCount}</div>
          </div>
          <div className="panel px-4 py-3">
            <div className="label">Opened</div>
            <div className="mono text-xl mt-1">
              {series.trials.filter((trial) => trial.sessionId).length}
            </div>
          </div>
          <div className="panel px-4 py-3">
            <div className="label">Displacement</div>
            {lags.length === 0 ? (
              <div className="text-[12px] text-text-faint mt-2">
                Score adjacent trials after lock.
              </div>
            ) : (
              <div className="mono text-[12px] mt-2 space-y-1">
                {lags.map(([lag, row]) => (
                  <div key={lag} className="flex justify-between">
                    <span>lag {Number(lag) > 0 ? `+${lag}` : lag}</span>
                    <span>
                      {row.hits}/{row.trials}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="label">Trials</h2>
          <div className="mt-3 space-y-2">
            {series.trials.length === 0 ? (
              <p className="text-[12px] text-text-faint">
                No trials sealed yet. Add a batch below.
              </p>
            ) : (
              series.trials.map((trial) => (
                <div
                  key={trial.id}
                  className="panel-inset px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="mono text-sm tracking-widest text-signal">
                      {trial.cue}
                    </div>
                    <div className="label mt-1">
                      trial {trial.seriesPosition} / {trial.protocol.toUpperCase()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={trial.sessionStatus} />
                    <button
                      className="btn"
                      onClick={() => enter(trial)}
                      disabled={busy}
                    >
                      {trial.sessionId ? "Open chamber" : "Enter chamber"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel p-5 mt-4">
          <h2 className="label">Add trials</h2>
          <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
            New trials continue the position sequence. The server still picks
            each target so the operator stays blind.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <select
              className="select"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as Protocol)}
            >
              {PROTOCOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={addCount}
              onChange={(e) => setAddCount(Number(e.target.value))}
            >
              {[2, 4, 8, 12].map((count) => (
                <option key={count} value={count}>
                  {count} trials
                </option>
              ))}
            </select>
            <button className="btn" onClick={addTrials} disabled={busy}>
              Seal more
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
