"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  SeriesData,
  SessionSummary,
  StatsData,
  TaskingSummary,
} from "@/lib/api";
import { Protocol, STAGE_ROMAN } from "@/lib/protocol";

const PROTOCOL_OPTIONS: { value: Protocol; label: string }[] = [
  { value: "crv", label: "CRV" },
  { value: "erv", label: "ERV" },
];

const ENVIRONMENT_OPTIONS = [
  { value: "monitored_ai", label: "AI monitor" },
  { value: "solo", label: "Solo" },
];

function StatusBadge({ status }: { status: string }) {
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

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="panel px-4 py-3 flex-1 min-w-[130px]">
      <div className="label">{label}</div>
      <div className="mono text-xl mt-1 text-text">{value}</div>
      {detail ? (
        <div className="text-[11px] text-text-faint mt-0.5">{detail}</div>
      ) : null}
    </div>
  );
}

export default function OpsConsole() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [taskings, setTaskings] = useState<TaskingSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [series, setSeries] = useState<SeriesData[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [protocol, setProtocol] = useState<Protocol>("crv");
  const [environment, setEnvironment] = useState("monitored_ai");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [statsData, taskingData, sessionData, seriesData, healthData] =
        await Promise.all([
          api.stats(),
          api.listTaskings(),
          api.listSessions(),
          api.listSeries(),
          api.health(),
        ]);
      setStats(statsData);
      setTaskings(taskingData.taskings);
      setSessions(sessionData.sessions);
      setSeries(seriesData.series);
      setAiEnabled(healthData.aiEnabled);
      setError("");
    } catch {
      setError("Backend unreachable");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [refresh]);

  const cutTasking = async () => {
    setBusy(true);
    try {
      await api.createTasking({
        protocol,
        environment,
        seriesId: selectedSeries || undefined,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tasking failed");
    } finally {
      setBusy(false);
    }
  };

  const newSeries = async () => {
    const name = `Series ${String.fromCharCode(65 + series.length)}`;
    setBusy(true);
    try {
      const created = await api.createSeries(name);
      setSelectedSeries(created.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const enterChamber = async (tasking: TaskingSummary) => {
    if (tasking.sessionId) {
      router.push(`/session/${tasking.sessionId}`);
      return;
    }
    setBusy(true);
    try {
      const session = await api.startSession(tasking.id);
      router.push(`/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
      setBusy(false);
    }
  };

  const openTaskings = taskings.filter((t) => !t.sessionId);
  const recentSessions = sessions.slice(0, 30);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="mono text-base tracking-[0.3em] text-text">
              PROJECT STARGATE
            </h1>
            <div className="label mt-1">Remote viewing operations</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span
                className={`dot ${aiEnabled ? "dot-signal pulse" : "dot-idle"}`}
              />
              <span className="label">
                {aiEnabled ? "AI online" : "AI offline"}
              </span>
            </div>
            {error ? (
              <span className="mono text-[11px] text-danger">{error}</span>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 w-full flex-1">
        <div className="flex gap-3 flex-wrap">
          <Stat
            label="Sessions"
            value={stats ? String(stats.sessions.total) : "--"}
            detail={stats ? `${stats.sessions.active} active` : undefined}
          />
          <Stat
            label="First-place matches"
            value={
              stats
                ? `${stats.judging.firstPlaceMatches}/${stats.judging.judgedSessions}`
                : "--"
            }
            detail={
              stats
                ? `chance ${stats.judging.expectedFirstPlace}`
                : undefined
            }
          />
          <Stat
            label="Mean rank"
            value={
              stats?.judging.meanRankOfTrueTarget != null
                ? stats.judging.meanRankOfTrueTarget.toFixed(2)
                : "--"
            }
            detail="of true target"
          />
          <Stat
            label="AOL / session"
            value={stats ? stats.protocolHealth.aolPerSession.toFixed(1) : "--"}
          />
          <Stat
            label="Feedback latency"
            value={
              stats?.feedback.meanLatencyMs != null
                ? `${Math.round(stats.feedback.meanLatencyMs / 1000)}s`
                : "--"
            }
            detail={
              stats ? `${stats.feedback.sessionsWithFeedback} fed back` : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
          <section className="lg:col-span-2">
            <div className="panel p-5">
              <h2 className="label">Tasking desk</h2>
              <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
                Cutting a tasking seals a random target from the pool. The cue
                below is all the viewer ever sees before lock.
              </p>
              <div className="flex gap-2 mt-4 flex-wrap">
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
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  {ENVIRONMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                >
                  <option value="">No series</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.taskingCount})
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={newSeries} disabled={busy}>
                  + Series
                </button>
              </div>
              <button
                className="btn btn-signal w-full mt-4"
                onClick={cutTasking}
                disabled={busy}
              >
                Seal new tasking
              </button>
            </div>

            <div className="panel p-5 mt-4">
              <h2 className="label">Open taskings</h2>
              <div className="mt-3 space-y-2">
                {openTaskings.length === 0 ? (
                  <p className="text-[12px] text-text-faint">
                    No sealed taskings waiting. Cut one above.
                  </p>
                ) : (
                  openTaskings.map((tasking) => (
                    <div
                      key={tasking.id}
                      className="panel-inset px-4 py-3 flex items-center justify-between fade-up"
                    >
                      <div>
                        <div className="mono text-sm tracking-widest text-signal">
                          {tasking.cue}
                        </div>
                        <div className="label mt-1">
                          {tasking.protocol.toUpperCase()}
                          {" / "}
                          {tasking.environment.replace("_", " ")}
                          {tasking.seriesPosition != null
                            ? ` / trial ${tasking.seriesPosition}`
                            : ""}
                        </div>
                      </div>
                      <button
                        className="btn"
                        onClick={() => enterChamber(tasking)}
                        disabled={busy}
                      >
                        Enter chamber
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="lg:col-span-3">
            <div className="panel p-5">
              <h2 className="label">Session log</h2>
              <div className="mt-3 space-y-2">
                {recentSessions.length === 0 ? (
                  <p className="text-[12px] text-text-faint">
                    No sessions yet.
                  </p>
                ) : (
                  recentSessions.map((session) => (
                    <button
                      key={session.id}
                      className="panel-inset px-4 py-3 w-full flex items-center justify-between text-left hover:border-line-strong transition-colors"
                      onClick={() => router.push(`/session/${session.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <span className="mono text-sm tracking-widest text-text">
                          {session.tasking.cue}
                        </span>
                        <span className="label">
                          {session.tasking.protocol.toUpperCase()}
                          {session.currentStage
                            ? ` / S-${STAGE_ROMAN[session.currentStage]}`
                            : ""}
                        </span>
                        <span className="label">{session.viewerName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {session.aolCount > 0 ? (
                          <span className="mono text-[10px] text-warn">
                            AOL {session.aolCount}
                          </span>
                        ) : null}
                        <StatusBadge status={session.status} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between">
          <span className="label">
            Protocols per CRV manual (1986), Swann / Smith
          </span>
          <span className="label">Double-blind. Feedback after lock.</span>
        </div>
      </footer>
    </div>
  );
}
