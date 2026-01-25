"use client";

import LoadingBar from "@/components/LoadingBar";
import Sessions from "@/components/Sessions";
import Header from "@/components/Header";
import { useWebSocket } from "@/components/WebSocketProvider";
import { useMemo } from "react";

function StatsBar({ sessions }: { sessions: any[] }) {
  const stats = useMemo(() => {
    const completedSessions = sessions
      .filter((s) => s.status === "completed" && s.score !== null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter((s) => s.status === "active").length;

    // Average composite score (overall performance)
    const avgScore =
      completedSessions.length > 0
        ? (
            completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
            completedSessions.length
          ).toFixed(1)
        : "—";

    // Best session (peak performance)
    const bestScore =
      completedSessions.length > 0
        ? Math.max(...completedSessions.map((s) => s.score || 0)).toFixed(1)
        : "—";

    // Consistency (score range - lower is better)
    const scores = completedSessions.map((s) => s.score || 0);
    const scoreRange =
      scores.length > 0
        ? (Math.max(...scores) - Math.min(...scores)).toFixed(1)
        : "—";

    // Recent performance trend (last 5 vs overall)
    const recentSessions = completedSessions.slice(0, 5);
    const recentAvg =
      recentSessions.length > 0
        ? (
            recentSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
            recentSessions.length
          ).toFixed(1)
        : "—";
    const trend =
      avgScore !== "—" && recentAvg !== "—"
        ? parseFloat(recentAvg) > parseFloat(avgScore)
          ? "↑"
          : parseFloat(recentAvg) < parseFloat(avgScore)
            ? "↓"
            : "→"
        : "";

    // Average data depth (stages with content)
    const avgStages =
      sessions.length > 0
        ? (
            sessions.reduce(
              (sum, s) => sum + (s.stagesWithContent?.length || 0),
              0,
            ) / sessions.length
          ).toFixed(1)
        : "—";

    // Completion rate
    const completionRate =
      totalSessions > 0
        ? Math.round((completedSessions.length / totalSessions) * 100)
        : 0;

    // Sessions with full 6 stages (complete CRV protocol)
    const fullProtocolSessions = sessions.filter(
      (s) => s.stagesWithContent?.length === 6,
    ).length;

    return {
      totalSessions,
      activeSessions,
      avgScore,
      bestScore,
      scoreRange,
      recentAvg,
      trend,
      avgStages,
      completionRate,
      fullProtocolSessions,
      completedCount: completedSessions.length,
    };
  }, [sessions]);

  return (
    <div className="w-full bg-[#f4d03f] border-b border-[#f1c40f]/50 relative overflow-hidden">
      {/* Subtle pattern overlay for differentiation */}
      <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,.1)_50%,transparent_75%,rgba(0,0,0,.1)_100%)] bg-size-[20px_20px]" />
      
      <div className="relative overflow-x-auto">
        <div className="flex items-center justify-center gap-0 text-xs min-w-max px-2 sm:px-6 py-2 sm:py-3">
          {/* Overall Performance (Figure of Merit equivalent) */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Overall Score
            </span>
            <span className="font-bold text-primary text-xs sm:text-sm">
              {stats.avgScore}
              <span className="text-primary/70 text-[10px] sm:text-xs font-normal">/7</span>
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-primary/40" />

          {/* Peak Performance (Best Session) */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Peak Score
            </span>
            <span className="font-bold text-green-600 text-xs sm:text-sm">
              {stats.bestScore}
              <span className="text-primary/70 text-[10px] sm:text-xs font-normal">/7</span>
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-primary/40" />

          {/* Reliability (Consistency - lower range = more reliable) */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Reliability
            </span>
            <span className="font-bold text-primary text-xs sm:text-sm">
              {stats.scoreRange}
              <span className="text-primary/70 text-[10px] sm:text-xs font-normal hidden sm:inline">
                {" "}
                variance
              </span>
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-primary/40" />

          {/* Data Quality (Sensory richness - avg stages) */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Data Quality
            </span>
            <span className="font-bold text-primary text-xs sm:text-sm">
              {stats.avgStages}
              <span className="text-primary/70 text-[10px] sm:text-xs font-normal hidden sm:inline">
                {" "}
                stages avg
              </span>
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-primary/40" />

          {/* Protocol Adherence (Full 6-stage sessions) */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Protocol
            </span>
            <span className="font-bold text-primary text-xs sm:text-sm">
              {stats.fullProtocolSessions}
              <span className="text-primary/70 text-[10px] sm:text-xs font-normal hidden sm:inline">
                {" "}
                complete
              </span>
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-primary/40" />

          {/* Performance Trend (Improving/declining) */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Trend
            </span>
            <span className="font-bold text-primary text-xs sm:text-sm">
              {stats.recentAvg}
              <span className="text-primary/70 text-[10px] sm:text-xs font-normal">/7</span>
              {stats.trend && (
                <span
                  className={`ml-1 sm:ml-1.5 text-sm sm:text-base ${
                    stats.trend === "↑"
                      ? "text-green-600"
                      : stats.trend === "↓"
                        ? "text-red-600"
                        : "text-primary/60"
                  }`}
                >
                  {stats.trend}
                </span>
              )}
            </span>
          </div>

          <div className="h-6 sm:h-8 w-px bg-primary/40" />

          {/* Session Completion Rate */}
          <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-2 sm:px-4 min-w-[70px] sm:min-w-0 sm:flex-1">
            <span className="text-primary/80 uppercase tracking-wide text-[9px] sm:text-[10px] font-medium">
              Completion
            </span>
            <span className="font-bold text-primary text-xs sm:text-sm">
              {stats.completionRate}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { sessions, isLoading, sendMessage } = useWebSocket();

  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [sessions]);

  const handleNewSession = () => {
    if (sendMessage) {
      sendMessage(JSON.stringify({ type: "create_session" }));
    }
  };

  return (
    <div className="h-full flex flex-col bg-secondary">
      <header className="relative w-full px-4 sm:px-6 py-3 shrink-0 glass-dark">
        <Header pageTitle="Session Database" onNewSession={handleNewSession} />
      </header>
      {!isLoading && sessions && sessions.length > 0 && (
        <StatsBar sessions={sessions} />
      )}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
        {isLoading ? (
          <LoadingBar message="Loading sessions..." />
        ) : (
          <Sessions sessions={sortedSessions} />
        )}
      </main>
    </div>
  );
}
