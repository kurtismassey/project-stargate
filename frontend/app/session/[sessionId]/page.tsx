"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api,
  ApiError,
  AnalystReportData,
  FeedbackData,
  SessionDetail,
  TranscriptEventData,
} from "@/lib/api";
import {
  canAdvanceStage,
  canRecord,
  EventKind,
  KIND_LABELS,
  openAol,
  STAGE_ROMAN,
} from "@/lib/protocol";
import {
  InkSegment,
  PaperCanvas,
  PaperCanvasHandle,
} from "@/components/PaperCanvas";
import { StageRail } from "@/components/StageRail";
import { MonitorFeed } from "@/components/MonitorFeed";
import { JudgingBoard } from "@/components/JudgingBoard";

const PAPER_KINDS: ReadonlySet<EventKind> = new Set([
  "cue",
  "ideogram",
  "ideogram_a",
  "ideogram_b",
  "sensory",
  "dimensional",
  "aesthetic_impact",
  "emotional_impact",
  "tangible",
  "intangible",
  "aol",
  "aol_break",
  "aol_signal",
  "sketch",
  "viewer_note",
  "break",
  "stage_advance",
  "lock",
]);

const TEXT_KIND_ORDER: EventKind[] = [
  "ideogram_a",
  "ideogram_b",
  "sensory",
  "dimensional",
  "aesthetic_impact",
  "emotional_impact",
  "tangible",
  "intangible",
  "aol_signal",
  "viewer_note",
];

function elapsedLabel(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function PaperEntry({ event }: { event: TranscriptEventData }) {
  const stageTag = event.stage ? `S${STAGE_ROMAN[event.stage]}` : "";
  const text = String(event.payload.text ?? "");
  const image = event.payload.imageB64 as string | undefined;

  if (event.kind === "cue") {
    return (
      <div className="py-3 border-b border-[rgba(84,74,50,0.2)]">
        <span className="mono text-[10px] uppercase tracking-widest opacity-50">
          Cue
        </span>
        <div className="mono text-xl tracking-[0.25em] mt-1">
          {String(event.payload.cue ?? "")}
        </div>
      </div>
    );
  }
  if (event.kind === "stage_advance") {
    return (
      <div className="py-2 mono text-[10px] uppercase tracking-widest opacity-50">
        Stage {STAGE_ROMAN[Number(event.payload.to)]} begins
      </div>
    );
  }
  if (event.kind === "lock") {
    return (
      <div className="py-2 mono text-[10px] uppercase tracking-widest opacity-60">
        Session locked. Transcript closed.
      </div>
    );
  }
  if (event.kind === "ideogram" || event.kind === "sketch") {
    return (
      <div className="py-2 fade-up">
        <span className="mono text-[10px] uppercase tracking-widest opacity-50">
          {stageTag} {KIND_LABELS[event.kind]}
        </span>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={KIND_LABELS[event.kind]}
            className="mt-1 max-h-44 rounded border border-[rgba(84,74,50,0.25)] bg-white/40"
          />
        ) : (
          <span className="ml-2 opacity-60 text-[12px]">(ink)</span>
        )}
      </div>
    );
  }
  const isAol = event.kind === "aol" || event.kind === "aol_break";
  return (
    <div className="py-1.5 flex gap-3 items-baseline fade-up">
      <span
        className={`mono text-[10px] uppercase tracking-widest w-28 shrink-0 ${
          isAol ? "text-[#a06b1f]" : "opacity-50"
        }`}
      >
        {stageTag} {KIND_LABELS[event.kind] ?? event.kind}
      </span>
      <span className={`text-[14px] ${isAol ? "text-[#a06b1f] italic" : ""}`}>
        {event.kind === "aol_break" && !text ? "set aside" : text}
        {event.kind === "break"
          ? ` (${String(event.payload.reason ?? "break")})`
          : ""}
      </span>
    </div>
  );
}

export default function ChamberPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<TranscriptEventData[]>([]);
  const [entry, setEntry] = useState("");
  const [entryKind, setEntryKind] = useState<EventKind>("sensory");
  const [refusal, setRefusal] = useState("");
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [reports, setReports] = useState<AnalystReportData[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [now, setNow] = useState(Date.now());

  const canvasRef = useRef<PaperCanvasHandle>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const paperEndRef = useRef<HTMLDivElement>(null);

  const eventViews = useMemo(
    () => events.map((event) => ({ kind: event.kind, stage: event.stage })),
    [events],
  );
  const locked = session != null && session.status !== "active";
  const protocol = session?.tasking.protocol ?? "crv";
  const stage = session?.currentStage ?? null;
  const aolOpen = openAol(eventViews);
  const inSeries = session?.tasking.seriesId != null;

  const mergeEvent = useCallback((incoming: TranscriptEventData) => {
    setEvents((previous) => {
      if (previous.some((event) => event.id === incoming.id)) return previous;
      return [...previous, incoming].sort((a, b) => a.seq - b.seq);
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const detail = await api.getSession(sessionId);
      setSession(detail);
      setEvents(detail.events);
      const health = await api.health();
      setAiEnabled(health.aiEnabled);
      if (detail.status !== "active") {
        const analysis = await api.listAnalysis(sessionId);
        setReports(analysis.reports);
      }
    } catch {
      setRefusal("Session unreachable");
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = new WebSocket(`/ws/chamber/${sessionId}`);
    socketRef.current = socket;
    socket.onmessage = (message) => {
      try {
        const frame = JSON.parse(message.data);
        if (frame.type === "event" && frame.event) {
          mergeEvent(frame.event as TranscriptEventData);
        } else if (frame.type === "session" && frame.session) {
          setSession((previous) =>
            previous ? { ...previous, ...frame.session } : previous,
          );
        } else if (frame.type === "ink" && frame.segment) {
          canvasRef.current?.drawRemoteSegment(frame.segment as InkSegment);
        } else if (frame.type === "ink_clear") {
          canvasRef.current?.clear();
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [sessionId, mergeEvent]);

  useEffect(() => {
    paperEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [events.length]);

  const refreshSession = useCallback(async () => {
    const detail = await api.getSession(sessionId);
    setSession(detail);
    setEvents(detail.events);
  }, [sessionId]);

  const record = async (kind: EventKind, payload: Record<string, unknown>) => {
    setBusy(true);
    setRefusal("");
    try {
      const result = await api.appendEvent(sessionId, kind, payload);
      mergeEvent(result.event);
      result.monitorEvents.forEach(mergeEvent);
      if (kind === "aol" || kind === "break") {
        await refreshSession();
      }
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setRefusal(error.message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendInk = (segment: InkSegment) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ink", segment }));
    }
  };

  const commitInk = async (kind: "ideogram" | "sketch") => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) {
      setRefusal("The pad is blank. Objectify on paper first.");
      return;
    }
    const done = await record(kind, {
      imageB64: canvas.exportPNG(),
      strokes: canvas.getStrokes(),
    });
    if (done) {
      canvas.clear();
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ink_clear" }));
      }
    }
  };

  const submitEntry = async () => {
    if (!entry.trim()) return;
    const done = await record(entryKind, { text: entry.trim() });
    if (done) setEntry("");
  };

  const declareAol = async () => {
    const text = entry.trim() || "analytic overlay";
    const done = await record("aol", { text });
    if (done) setEntry("");
  };

  const advance = async () => {
    setBusy(true);
    setRefusal("");
    try {
      await api.advanceStage(sessionId);
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError) setRefusal(error.message);
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    if (!confirmLock) {
      setConfirmLock(true);
      return;
    }
    setBusy(true);
    try {
      await api.lockSession(sessionId);
      setConfirmLock(false);
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError) setRefusal(error.message);
    } finally {
      setBusy(false);
    }
  };

  const breakSeal = async () => {
    setBusy(true);
    try {
      const data = await api.getFeedback(sessionId);
      setFeedback(data);
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError) setRefusal(error.message);
    } finally {
      setBusy(false);
    }
  };

  const requestAnalysis = async () => {
    setBusy(true);
    setRefusal("");
    try {
      const report = await api.runAnalysis(sessionId);
      setReports((previous) => [report, ...previous]);
    } catch (error) {
      if (error instanceof ApiError) setRefusal(error.message);
    } finally {
      setBusy(false);
    }
  };

  const availableTextKinds = TEXT_KIND_ORDER.filter((kind) =>
    canRecord(protocol, stage, kind, eventViews),
  );
  const canDrawIdeogram =
    !locked && canRecord(protocol, stage, "ideogram", eventViews);
  const canSketch = !locked && canRecord(protocol, stage, "sketch", eventViews);
  const advanceReady =
    !locked && stage !== null && canAdvanceStage(stage, eventViews);

  useEffect(() => {
    if (!availableTextKinds.includes(entryKind) && availableTextKinds[0]) {
      setEntryKind(availableTextKinds[0]);
    }
  }, [availableTextKinds, entryKind]);

  const paperEvents = events.filter((event) => PAPER_KINDS.has(event.kind));

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mono text-[12px] text-text-faint tracking-widest pulse">
          ENTERING CHAMBER
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1 sticky top-0 z-10">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              className="btn"
              onClick={() => router.push("/")}
              title="Back to operations"
            >
              Ops
            </button>
            <div>
              <div className="mono text-sm tracking-[0.25em] text-signal">
                {session.tasking.cue}
              </div>
              <div className="label mt-0.5">
                {protocol.toUpperCase()} / {session.viewerName} /{" "}
                {session.monitorMode.replace("_", " ")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="mono text-sm text-text">
                {elapsedLabel(session.startedAt, now)}
              </div>
              <div className="label">elapsed</div>
            </div>
            <div className="text-right">
              <div
                className={`mono text-sm ${session.aolCount > 0 ? "text-warn" : "text-text"}`}
              >
                {session.aolCount}
              </div>
              <div className="label">AOL</div>
            </div>
            <div className="text-right">
              <div className="mono text-sm text-text">{session.breakCount}</div>
              <div className="label">breaks</div>
            </div>
            {locked ? (
              <span className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border text-warn border-warn/40 bg-warn-dim">
                {session.status}
              </span>
            ) : (
              <button
                className={`btn ${confirmLock ? "btn-danger" : ""}`}
                onClick={lock}
                disabled={busy}
                onBlur={() => setConfirmLock(false)}
              >
                {confirmLock ? "Confirm lock" : "Lock session"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[190px_minmax(0,1fr)_340px] gap-4 p-4 max-w-[1500px] w-full mx-auto">
        <aside className="space-y-3">
          <StageRail
            currentStage={session.currentStage}
            stageRecords={session.stageRecords ?? []}
            locked={locked}
          />
          {!locked && stage !== null ? (
            <button
              className={`btn w-full ${advanceReady ? "btn-signal" : ""}`}
              onClick={advance}
              disabled={busy || !advanceReady}
            >
              {stage >= 6
                ? "Final stage"
                : `Advance to ${STAGE_ROMAN[stage + 1]}`}
            </button>
          ) : null}
        </aside>

        <section className="flex flex-col min-h-0">
          <div className="paper px-8 py-6 flex-1 overflow-y-auto min-h-[300px]">
            {paperEvents.map((event) => (
              <PaperEntry key={event.id} event={event} />
            ))}
            <div ref={paperEndRef} />
          </div>

          {!locked ? (
            <div className="mt-3 space-y-3">
              {(canDrawIdeogram || canSketch) && !aolOpen ? (
                <div>
                  <PaperCanvas
                    ref={canvasRef}
                    height={190}
                    disabled={busy}
                    onSegment={sendInk}
                    lined={false}
                  />
                  <div className="flex gap-2 mt-2">
                    {canDrawIdeogram ? (
                      <button
                        className="btn btn-signal"
                        onClick={() => commitInk("ideogram")}
                        disabled={busy}
                      >
                        Objectify ideogram
                      </button>
                    ) : null}
                    {canSketch ? (
                      <button
                        className="btn"
                        onClick={() => commitInk("sketch")}
                        disabled={busy}
                      >
                        Commit sketch
                      </button>
                    ) : null}
                    <button
                      className="btn"
                      onClick={() => canvasRef.current?.clear()}
                      disabled={busy}
                    >
                      Clear pad
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="panel p-3">
                <div className="flex gap-2 flex-wrap">
                  {availableTextKinds.map((kind) => (
                    <button
                      key={kind}
                      className={`mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded border transition-colors ${
                        entryKind === kind
                          ? "border-signal-line bg-signal-dim text-signal"
                          : "border-line text-text-muted hover:border-line-strong"
                      }`}
                      onClick={() => setEntryKind(kind)}
                    >
                      {KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="input flex-1"
                    placeholder={
                      aolOpen
                        ? "AOL is open. Objectify the break to resume."
                        : `Objectify ${KIND_LABELS[entryKind]?.toLowerCase()}...`
                    }
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !aolOpen) submitEntry();
                    }}
                    disabled={busy || aolOpen}
                  />
                  <button
                    className="btn"
                    onClick={submitEntry}
                    disabled={busy || aolOpen || !entry.trim()}
                  >
                    Record
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {aolOpen ? (
                    <button
                      className="btn btn-warn"
                      onClick={() => record("aol_break", {})}
                      disabled={busy}
                    >
                      AOL break, set aside
                    </button>
                  ) : (
                    <button
                      className="btn btn-warn"
                      onClick={declareAol}
                      disabled={busy}
                    >
                      Declare AOL
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={() => record("break", { reason: "bio" })}
                    disabled={busy || aolOpen}
                  >
                    Break
                  </button>
                  {refusal ? (
                    <span className="mono text-[11px] text-warn self-center fade-up">
                      {refusal}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-3 min-w-0">
          <MonitorFeed events={events} monitorMode={session.monitorMode} />

          {locked ? (
            <>
              <div className="panel p-4">
                <div className="flex items-center justify-between">
                  <span className="label">Feedback</span>
                  {session.feedbackLatencyMs != null ? (
                    <span className="mono text-[10px] text-text-faint">
                      latency {Math.round(session.feedbackLatencyMs / 1000)}s
                    </span>
                  ) : null}
                </div>
                {feedback ? (
                  <div className="mt-2 reveal">
                    {feedback.target.payloadB64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/jpeg;base64,${feedback.target.payloadB64}`}
                        alt="Sealed target"
                        className="rounded border border-line w-full"
                      />
                    ) : null}
                    <div className="mono text-[12px] text-text mt-2">
                      {feedback.target.title}
                    </div>
                    {feedback.target.coordinates ? (
                      <div className="mono text-[11px] text-text-muted mt-1">
                        {feedback.target.coordinates}
                      </div>
                    ) : null}
                    <div className="mono text-[9px] text-text-faint mt-2 break-all">
                      seal {feedback.target.payloadSha256}
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-signal w-full mt-2"
                    onClick={breakSeal}
                    disabled={busy}
                  >
                    Break seal, reveal target
                  </button>
                )}
              </div>

              <JudgingBoard
                sessionId={sessionId}
                inSeries={inSeries}
                judged={session.status === "judged"}
                onJudged={refreshSession}
              />

              <div className="panel p-4">
                <div className="flex items-center justify-between">
                  <span className="label">Analyst (advisory)</span>
                  <span className="label">second opinion</span>
                </div>
                {reports.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {reports.map((report) => (
                      <div key={report.id} className="fade-up">
                        {report.advisoryScore != null ? (
                          <div className="mono text-lg text-text">
                            {report.advisoryScore.toFixed(1)}
                            <span className="text-[11px] text-text-faint">
                              {" "}
                              / 7 advisory
                            </span>
                          </div>
                        ) : null}
                        <p className="text-[12px] text-text-muted leading-relaxed mt-1">
                          {report.summary}
                        </p>
                        {report.correspondences
                          .slice(0, 6)
                          .map((item, index) => (
                            <div
                              key={index}
                              className="flex gap-2 items-baseline mt-1.5"
                            >
                              <span className="mono text-[10px] text-signal shrink-0">
                                {(item.strength * 100).toFixed(0)}%
                              </span>
                              <span className="text-[11px] text-text-muted">
                                {item.element} → {item.target_feature}
                              </span>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                ) : aiEnabled ? (
                  <button
                    className="btn w-full mt-2"
                    onClick={requestAnalysis}
                    disabled={busy}
                  >
                    Request analyst read
                  </button>
                ) : (
                  <p className="text-[11px] text-text-faint mt-2">
                    Analyst offline. Set GOOGLE_API_KEY to enable the advisory
                    read. Blind judging above is the score of record.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="panel p-4">
              <span className="label">Sealed</span>
              <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
                The target stays sealed until you lock. Feedback, judging, and
                analysis open after lock.
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
