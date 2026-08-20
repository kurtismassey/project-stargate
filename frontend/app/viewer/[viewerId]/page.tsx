"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, SessionSummary, ViewerData, ViewerStats } from "@/lib/api";
import { STAGE_ROMAN } from "@/lib/protocol";

export default function ViewerPage() {
  const params = useParams<{ viewerId: string }>();
  const router = useRouter();
  const [viewer, setViewer] = useState<
    (ViewerData & { stats: ViewerStats; sessions: SessionSummary[] }) | null
  >(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setViewer(await api.getViewer(params.viewerId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Viewer unreachable");
    }
  }, [params.viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!viewer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="mono text-[12px] text-text-faint tracking-widest">
          {error || "LOADING ROSTER"}
        </span>
      </div>
    );
  }

  const stats = viewer.stats;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button className="btn" onClick={() => router.push("/")}>
            Ops
          </button>
          <div>
            <h1 className="mono text-base tracking-[0.2em] text-text">
              {viewer.callsign}
            </h1>
            <div className="label mt-1">Source file / population unit</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 w-full flex-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="panel px-4 py-3">
            <div className="label">Sessions</div>
            <div className="mono text-xl mt-1">{stats.sessions}</div>
          </div>
          <div className="panel px-4 py-3">
            <div className="label">First place</div>
            <div className="mono text-xl mt-1">
              {stats.firstPlaceMatches}/{stats.judgedSessions}
            </div>
          </div>
          <div className="panel px-4 py-3">
            <div className="label">Mean rank</div>
            <div className="mono text-xl mt-1">
              {stats.meanRankOfTrueTarget != null
                ? stats.meanRankOfTrueTarget.toFixed(2)
                : "--"}
            </div>
          </div>
          <div className="panel px-4 py-3">
            <div className="label">Figure of merit</div>
            <div className="mono text-xl mt-1">
              {stats.meanFigureOfMerit != null
                ? stats.meanFigureOfMerit.toFixed(2)
                : "--"}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="label">Sessions</h2>
          <div className="mt-3 space-y-2">
            {viewer.sessions.length === 0 ? (
              <p className="text-[12px] text-text-faint">No sessions yet.</p>
            ) : (
              viewer.sessions.map((session) => (
                <button
                  key={session.id}
                  className="panel-inset px-4 py-3 w-full flex items-center justify-between text-left hover:border-line-strong transition-colors"
                  onClick={() => router.push(`/session/${session.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <span className="mono text-sm tracking-widest">
                      {session.tasking.cue}
                    </span>
                    <span className="label">
                      {session.tasking.protocol.toUpperCase()}
                      {session.currentStage
                        ? ` / S-${STAGE_ROMAN[session.currentStage]}`
                        : ""}
                    </span>
                  </div>
                  <span className="label">{session.status}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
