"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  clearDeskCredentials,
  deskNeedsUnlock,
  getOperatorToken,
  SeriesData,
  SessionSummary,
  setOperatorToken,
  StatsData,
  TaskingSummary,
  ViewerData,
  OperatorData,
  PoolData,
} from "@/lib/api";
import { LabGate } from "@/components/LabGate";
import { Protocol, STAGE_ROMAN } from "@/lib/protocol";

const PROTOCOL_OPTIONS: { value: Protocol; label: string }[] = [
  { value: "crv", label: "CRV" },
  { value: "erv", label: "ERV" },
  { value: "arv", label: "ARV" },
  { value: "wrv", label: "WRV" },
];

const ENVIRONMENT_OPTIONS = [
  { value: "monitored_ai", label: "AI monitor" },
  { value: "monitored_human", label: "Human monitor" },
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
  const [trialCount, setTrialCount] = useState(8);
  const [viewers, setViewers] = useState<ViewerData[]>([]);
  const [selectedViewer, setSelectedViewer] = useState("");
  const [operators, setOperators] = useState<OperatorData[]>([]);
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedMonitor, setSelectedMonitor] = useState("");
  const [pools, setPools] = useState<PoolData[]>([]);
  const [selectedPool, setSelectedPool] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [labLocked, setLabLocked] = useState(false);
  const [signedIn, setSignedIn] = useState("");
  const [newCallsign, setNewCallsign] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [
        statsData,
        taskingData,
        sessionData,
        seriesData,
        healthData,
        viewerData,
        operatorData,
        poolData,
      ] = await Promise.all([
          api.stats(),
          api.listTaskings(),
          api.listSessions(),
          api.listSeries(),
          api.health(),
          api.listViewers(),
          api.listOperators(),
          api.listPools(),
        ]);
      setStats(statsData);
      setTaskings(taskingData.taskings);
      setSessions(sessionData.sessions);
      setSeries(seriesData.series);
      setAiEnabled(healthData.aiEnabled);
      if (getOperatorToken()) {
        try {
          const me = await api.me();
          setSignedIn(me.operator.callsign);
        } catch {
          clearDeskCredentials();
          setSignedIn("");
        }
      } else {
        setSignedIn("");
      }
      setLabLocked(deskNeedsUnlock(healthData));
      setViewers(viewerData.viewers);
      setSelectedViewer((current) => current || viewerData.viewers[0]?.id || "");
      setOperators(operatorData.operators);
      setSelectedOperator((current) => current || operatorData.operators[0]?.id || "");
      setSelectedMonitor((current) => current || operatorData.operators[0]?.id || "");
      setPools(poolData.pools);
      setSelectedPool((current) => current || poolData.pools[0]?.id || "");
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
        poolId: selectedPool || undefined,
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
      const created = await api.createSeries({ name });
      setSelectedSeries(created.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Series failed");
    } finally {
      setBusy(false);
    }
  };

  const sealRun = async () => {
    const name = `Series ${String.fromCharCode(65 + series.length)}`;
    setBusy(true);
    try {
      const created = await api.createSeries({
        name,
        trialCount,
        protocol,
        environment,
      });
      router.push(`/series/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Series run failed");
      setBusy(false);
    }
  };

  const newOperator = async () => {
    const callsign =
      newCallsign.trim() ||
      `Op ${String(operators.length + 1).padStart(3, "0")}`;
    setBusy(true);
    try {
      const created = await api.createOperator(
        callsign,
        newPassphrase || undefined,
      );
      if (created.token) setOperatorToken(created.token);
      setSelectedOperator(created.id);
      if (!selectedMonitor) setSelectedMonitor(created.id);
      setNewCallsign("");
      setNewPassphrase("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add operator");
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    clearDeskCredentials();
    setSignedIn("");
    refresh();
  };

  const newViewer = async () => {
    const callsign = `Viewer ${String(viewers.length + 1).padStart(3, "0")}`;
    setBusy(true);
    try {
      const created = await api.createViewer(callsign);
      setSelectedViewer(created.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Viewer failed");
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
      const session = await api.startSession(tasking.id, {
        viewerId: selectedViewer || undefined,
        operatorId: selectedOperator || undefined,
        monitorId:
          environment === "monitored_human"
            ? selectedMonitor || undefined
            : undefined,
      });
      router.push(`/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
      setBusy(false);
    }
  };

  const openTaskings = taskings.filter((t) => !t.sessionId);
  const recentSessions = sessions.slice(0, 30);

  const unlockDesk = useCallback(() => {
    setLabLocked(false);
    refresh();
  }, [refresh]);

  if (labLocked) {
    return <LabGate onUnlocked={unlockDesk} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="mono text-base tracking-[0.3em] text-text">
              PROJECT STARGATE
            </h1>
            <div className="label mt-1">Remote viewing operations</div>
            <button
              className="label mt-2 text-signal hover:underline"
              onClick={() => router.push("/vault")}
            >
              Vault
            </button>
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
            {signedIn ? (
              <div className="flex items-center gap-3">
                <span className="mono text-[11px] text-text">{signedIn}</span>
                <button className="btn" onClick={signOut}>
                  Sign out
                </button>
              </div>
            ) : null}
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
              stats ? `chance ${stats.judging.expectedFirstPlace}` : undefined
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
            label="Figure of merit"
            value={
              stats?.judging.meanFigureOfMerit != null
                ? stats.judging.meanFigureOfMerit.toFixed(2)
                : "--"
            }
            detail={
              stats?.judging.byMethod?.fuzzy
                ? `May fuzzy on ${stats.judging.byMethod.fuzzy}`
                : "accuracy × reliability"
            }
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
              stats
                ? `${stats.feedback.sessionsWithFeedback} fed back`
                : undefined
            }
          />
        </div>

        {stats?.sessions.byProtocol &&
        Object.keys(stats.sessions.byProtocol).length > 0 ? (
          <div className="flex gap-3 flex-wrap mt-3">
            {Object.entries(stats.sessions.byProtocol).map(([proto, row]) => (
              <div key={proto} className="panel px-4 py-2 min-w-[110px]">
                <div className="label">{proto.toUpperCase()}</div>
                <div className="mono text-sm mt-1">
                  {row.sessions} sess
                  {row.judged > 0 ? ` / ${row.firstPlace}/${row.judged}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
          <section className="lg:col-span-2">
            <div className="panel p-5">
              <h2 className="label">Tasking desk</h2>
              <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
                Cutting a tasking seals a random target from the pool. The cue
                is all the viewer ever sees before lock. ARV seals one side of
                an associate pair. WRV is written-first.
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
                  value={selectedPool}
                  onChange={(e) => setSelectedPool(e.target.value)}
                >
                  {pools.map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.name} ({pool.targetCount})
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
                <select
                  className="select"
                  value={selectedViewer}
                  onChange={(e) => setSelectedViewer(e.target.value)}
                >
                  <option value="">Viewer</option>
                  {viewers.map((viewer) => (
                    <option key={viewer.id} value={viewer.id}>
                      {viewer.callsign}
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={newViewer} disabled={busy}>
                  + Viewer
                </button>
                <select
                  className="select"
                  value={selectedOperator}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                >
                  <option value="">Operator</option>
                  {operators.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.callsign}
                      {row.locked ? " · keyed" : ""}
                    </option>
                  ))}
                </select>
                <input
                  className="input w-28"
                  placeholder="Callsign"
                  value={newCallsign}
                  onChange={(e) => setNewCallsign(e.target.value)}
                />
                <input
                  className="input w-32"
                  type="password"
                  placeholder="Passphrase"
                  value={newPassphrase}
                  onChange={(e) => setNewPassphrase(e.target.value)}
                />
                <button className="btn" onClick={newOperator} disabled={busy}>
                  + Operator
                </button>
                {environment === "monitored_human" ? (
                  <select
                    className="select"
                    value={selectedMonitor}
                    onChange={(e) => setSelectedMonitor(e.target.value)}
                  >
                    <option value="">Monitor</option>
                    {operators.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.callsign}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <button
                className="btn btn-signal w-full mt-4"
                onClick={cutTasking}
                disabled={busy}
              >
                Seal new tasking
              </button>
              <div className="mt-5 pt-4 border-t border-line">
                <h3 className="label">Series runner</h3>
                <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
                  Seal a sequential run from one pool. Positions are recorded
                  so displacement can be scored at lags minus two through plus
                  two.
                </p>
                <div className="flex gap-2 mt-3">
                  <select
                    className="select"
                    value={trialCount}
                    onChange={(e) => setTrialCount(Number(e.target.value))}
                  >
                    {[4, 8, 12, 20].map((count) => (
                      <option key={count} value={count}>
                        {count} trials
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-signal flex-1"
                    onClick={sealRun}
                    disabled={busy}
                  >
                    Seal run
                  </button>
                </div>
              </div>
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
                      <div className="flex gap-2">
                        <button
                          className="btn"
                          onClick={() => enterChamber(tasking)}
                          disabled={busy}
                        >
                          Enter chamber
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="lg:col-span-3">
            {operators.length > 0 ? (
              <div className="panel p-5 mb-4">
                <h2 className="label">Lab staff</h2>
                <div className="mt-3 space-y-2">
                  {operators.map((row) => (
                    <div
                      key={row.id}
                      className="panel-inset px-4 py-3 flex items-center justify-between"
                    >
                      <span className="mono text-sm text-text">
                        {row.callsign}
                        {row.locked ? " · keyed" : ""}
                      </span>
                      <span className="label">
                        {row.sessionsOperated} ops / {row.sessionsMonitored}{" "}
                        monitored
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {viewers.length > 0 ? (
              <div className="panel p-5 mb-4">
                <h2 className="label">Roster</h2>
                <div className="mt-3 space-y-2">
                  {viewers.map((viewer) => (
                    <button
                      key={viewer.id}
                      className="panel-inset px-4 py-3 w-full flex items-center justify-between text-left hover:border-line-strong transition-colors"
                      onClick={() => router.push(`/viewer/${viewer.id}`)}
                    >
                      <span className="mono text-sm text-text">
                        {viewer.callsign}
                      </span>
                      <span className="label">
                        {viewer.sessions} sessions
                        {viewer.meanFigureOfMerit != null
                          ? ` / FoM ${viewer.meanFigureOfMerit.toFixed(2)}`
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {series.length > 0 ? (
              <div className="panel p-5 mb-4">
                <h2 className="label">Series</h2>
                <div className="mt-3 space-y-2">
                  {series.map((entry) => (
                    <button
                      key={entry.id}
                      className="panel-inset px-4 py-3 w-full flex items-center justify-between text-left hover:border-line-strong transition-colors"
                      onClick={() => router.push(`/series/${entry.id}`)}
                    >
                      <span className="mono text-sm text-text">{entry.name}</span>
                      <span className="label">{entry.taskingCount} trials</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="panel p-5">
              <h2 className="label">Session log</h2>
              <div className="mt-3 space-y-2">
                {recentSessions.length === 0 ? (
                  <p className="text-[12px] text-text-faint">
                    No sessions yet.
                  </p>
                ) : (
                  recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="panel-inset px-4 py-3 w-full flex items-center justify-between"
                    >
                      <button
                        className="flex items-center gap-4 text-left min-w-0"
                        onClick={() => router.push(`/session/${session.id}`)}
                      >
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
                        {session.monitorName ? (
                          <span className="label">mon {session.monitorName}</span>
                        ) : null}
                      </button>
                      <div className="flex items-center gap-3">
                        {session.aolCount > 0 ? (
                          <span className="mono text-[10px] text-warn">
                            AOL {session.aolCount}
                          </span>
                        ) : null}
                        {session.status === "active" ? (
                          <button
                            className="btn"
                            onClick={() => router.push(`/monitor/${session.id}`)}
                          >
                            Monitor desk
                          </button>
                        ) : null}
                        <StatusBadge status={session.status} />
                      </div>
                    </div>
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
