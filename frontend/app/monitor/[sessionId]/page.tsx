"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api,
  ApiError,
  SessionDetail,
  TranscriptEventData,
} from "@/lib/api";
import { MonitorFeed } from "@/components/MonitorFeed";
import { PaperCanvas, type InkSegment, type PaperCanvasHandle } from "@/components/PaperCanvas";
import { StageRail } from "@/components/StageRail";
import { HUMAN_PATTER, isLeadingPatter } from "@/lib/protocol";

function isInkSegment(value: unknown): value is InkSegment {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.prevX === "number" &&
    typeof row.prevY === "number" &&
    typeof row.x === "number" &&
    typeof row.y === "number"
  );
}

function isTranscriptEvent(value: unknown): value is TranscriptEventData {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.kind === "string";
}

/**
 * Blind human-monitor desk. Live paper, prescribed patter, lock.
 * Feedback and judging stay off this page [CRV-MANUAL].
 */
export default function MonitorDesk() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();
  const canvasRef = useRef<PaperCanvasHandle>(null);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [events, setEvents] = useState<TranscriptEventData[]>([]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);

  const mergeEvent = useCallback((incoming: TranscriptEventData) => {
    setEvents((previous) => {
      if (previous.some((event) => event.id === incoming.id)) return previous;
      return [...previous, incoming].sort((a, b) => a.seq - b.seq);
    });
  }, []);

  const refresh = useCallback(async () => {
    const detail = await api.getSession(sessionId);
    setSession(detail);
    setEvents(detail.events);
  }, [sessionId]);

  useEffect(() => {
    refresh().catch(() => setRefusal("Monitor desk unreachable"));
  }, [refresh]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/chamber/${sessionId}`,
    );
    socket.onmessage = (message) => {
      try {
        const frame: unknown = JSON.parse(String(message.data));
        if (typeof frame !== "object" || frame === null) return;
        const row = frame as Record<string, unknown>;
        if (row.type === "event" && isTranscriptEvent(row.event)) {
          mergeEvent(row.event);
        } else if (row.type === "session") {
          refresh().catch(() => undefined);
        } else if (row.type === "ink" && isInkSegment(row.segment)) {
          canvasRef.current?.drawRemoteSegment(row.segment);
        } else if (row.type === "ink_clear") {
          canvasRef.current?.clear();
        }
      } catch {
        // Ignore malformed frames.
      }
    };
    return () => socket.close();
  }, [sessionId, mergeEvent, refresh]);

  const sendPatter = async (text: string) => {
    if (!text.trim() || busy) return;
    if (isLeadingPatter(text)) {
      setRefusal("That names or fishes for content. Stay in structure.");
      return;
    }
    setBusy(true);
    setRefusal("");
    try {
      const result = await api.sendMonitorPrompt(sessionId, text.trim());
      mergeEvent(result.event);
      setCustom("");
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
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) setRefusal(error.message);
    } finally {
      setBusy(false);
      setConfirmLock(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mono text-[12px] text-text-faint tracking-widest pulse">
          MONITOR DESK
        </span>
      </div>
    );
  }

  const locked = session.status !== "active";
  const protocol = session.tasking.protocol;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1 sticky top-0 z-10">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button className="btn" onClick={() => router.push("/")}>
              Ops
            </button>
            <div>
              <div className="mono text-sm tracking-[0.25em] text-signal">
                {session.tasking.cue}
              </div>
              <div className="label mt-0.5">
                MONITOR DESK / {protocol.toUpperCase()} / {session.viewerName}
                {session.monitorName ? ` / ${session.monitorName}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
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
                locked · blind
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
            protocol={protocol}
          />
          <div className="panel p-4">
            <span className="label">Blindness</span>
            <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
              This desk never unseals the target. Feedback and judging
              stay on the ops chamber after lock.
            </p>
          </div>
        </aside>

        <section className="space-y-3">
          <div className="paper rounded-sm p-4 min-h-[280px]">
            <div className="label text-[10px] tracking-[0.2em] mb-2">
              LIVE PAPER
            </div>
            <PaperCanvas ref={canvasRef} disabled height={280} lined />
          </div>
          {refusal ? (
            <p className="mono text-[11px] text-danger">{refusal}</p>
          ) : null}
        </section>

        <aside className="space-y-3">
          <MonitorFeed events={events} monitorMode={session.monitorMode} />
          <div className="panel p-4">
            <span className="label">Prescribed patter</span>
            <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
              Structure only. Anything that names the site is refused.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {HUMAN_PATTER.map((line) => (
                <button
                  key={line}
                  className="btn"
                  disabled={busy || locked}
                  onClick={() => sendPatter(line)}
                >
                  {line}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                className="input flex-1"
                placeholder="Custom patter"
                value={custom}
                disabled={locked}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendPatter(custom);
                }}
              />
              <button
                className="btn"
                disabled={busy || locked || !custom.trim()}
                onClick={() => sendPatter(custom)}
              >
                Say
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
