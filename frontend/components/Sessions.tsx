"use client";

import Link from "next/link";
import { Session, Stage } from "@/types/session";
import {
  formatDate,
  formatStageLabel,
  getSessionPath,
} from "@/utils/formatting";
import { useWebSocket } from "./WebSocketProvider";
import { useMemo } from "react";

const TOTAL_STAGES = 6;

function StageList({
  stagesWithContent,
}: {
  stagesWithContent?: Stage[];
}) {
  const allStages = Array.from({ length: TOTAL_STAGES }, (_, i) => (i + 1) as Stage);

  return (
    <div className="flex items-center gap-0 w-full min-w-0">
      {allStages.map((stage, index) => {
        const hasContent = stagesWithContent?.includes(stage) ?? false;
        const isLast = index === allStages.length - 1;

        return (
          <div key={stage} className="flex items-center flex-1 min-w-0">
            <span
              className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium border w-full whitespace-nowrap overflow-hidden text-ellipsis ${
                hasContent
                  ? "bg-secondary/20 text-secondary border-secondary/30"
                  : "bg-secondary/5 text-secondary/30 border-secondary/10"
              } ${index === 0 ? "rounded-l-md" : ""} ${isLast ? "rounded-r-md" : ""} ${
                !isLast ? "border-r-0" : ""
              }`}
            >
              {formatStageLabel(stage)}
            </span>
            {!isLast && (
              <div
                className={`h-px w-2 shrink-0 ${
                  hasContent && stagesWithContent?.includes((stage + 1) as Stage)
                    ? "bg-secondary/30"
                    : "bg-secondary/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SessionCardProps {
  session: Session;
  sessionPath: string;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, id: string) => void;
  index: number;
  variant: "active" | "completed";
}

function SessionCard({
  session,
  sessionPath,
  onDelete,
  index,
  variant,
}: SessionCardProps) {
  const isActive = variant === "active";

  return (
    <Link
      href={sessionPath}
      className="block group animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={`relative overflow-hidden rounded-xl transition-all duration-300 group-hover:scale-[1.01] ${
          isActive
            ? "bg-primary text-secondary shadow-lg shadow-black/20 group-hover:shadow-xl group-hover:shadow-black/30"
            : "bg-primary/90 text-secondary shadow-md shadow-black/15 group-hover:shadow-lg group-hover:shadow-black/20"
        }`}
      >
        {/* Delete button */}
        <button
          onClick={(e) => onDelete(e, session.id)}
          className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-transform duration-300 z-10 translate-x-full group-hover:translate-x-0"
          title="Delete session"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>

        {/* Status indicator */}
        {isActive && (
          <div className="absolute top-0 right-0 w-20 h-20">
            <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        )}

        {/* Score badge - top right */}
        {!isActive && session.score !== null && (
          <div className="absolute top-3 right-3 group-hover:right-14 transition-all duration-300">
            <span className="text-[10px] font-semibold text-secondary bg-secondary/20 px-2 py-1 rounded-md">
              {session.score.toFixed(1)}/7
            </span>
          </div>
        )}

        {/* Content container */}
        <div className="p-5 pr-5 group-hover:pr-14 transition-all duration-300">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-secondary">
                {formatDate(session.createdAt)}
              </span>
            </div>
            <div className="text-[10px] text-secondary/50 font-mono">
              {session.id.slice(0, 8)}...{session.id.slice(-4)}
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="mb-4 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-secondary/60 uppercase tracking-wide">
              CRV Stages
            </span>
            {isActive && (
              <span className="text-[10px] font-medium text-secondary/80 whitespace-nowrap">
                Current: {formatStageLabel(session.stage)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <StageList stagesWithContent={session.stagesWithContent} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              isActive ? "text-green-400" : "text-secondary/60"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-400" : "bg-secondary/40"}`}
            />
            {isActive
              ? "Active"
              : session.status === "assessing"
                ? "Assessing"
                : "Analysed"}
          </span>

          <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary/60 group-hover:text-secondary transition-colors">
            Open
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform group-hover:translate-x-0.5"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </div>
        </div>
      </div>
    </Link>
  );
}

export default function Sessions({ sessions }: { sessions: Session[] }) {
  const { sendMessage } = useWebSocket();

  const { activeSessions, completedSessions } = useMemo(() => {
    const active: Array<{ session: Session; sessionPath: string }> = [];
    const completed: Array<{ session: Session; sessionPath: string }> = [];

    sessions.forEach((session) => {
      const sessionPath = getSessionPath(session.id);
      if (sessionPath !== null) {
        if (session.status === "active") {
          active.push({ session, sessionPath });
        } else {
          completed.push({ session, sessionPath });
        }
      }
    });

    return { activeSessions: active, completedSessions: completed };
  }, [sessions]);

  const handleDeleteSession = (
    e: React.MouseEvent<HTMLButtonElement>,
    sessionId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (sendMessage) {
      sendMessage(
        JSON.stringify({ type: "delete_session", data: { sessionId } }),
      );
    }
  };

  const hasNoSessions =
    activeSessions.length === 0 && completedSessions.length === 0;

  return (
    <div className="flex flex-col h-full">
      {hasNoSessions ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary/30"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-primary/70 mb-2">
            No sessions yet
          </h2>
          <p className="text-sm text-primary/40 text-center max-w-xs">
            Use the "New Session" button in the header to create your first remote viewing session.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-8">
          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <h2 className="text-sm font-semibold text-primary uppercase tracking-wide">
                    Active Sessions
                  </h2>
                </div>
                <span className="text-xs text-primary/40">
                  ({activeSessions.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeSessions.map(({ session, sessionPath }, index) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    sessionPath={sessionPath}
                    onDelete={handleDeleteSession}
                    index={index}
                    variant="active"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary/30" />
                  <h2 className="text-sm font-semibold text-primary/70 uppercase tracking-wide">
                    Completed Sessions
                  </h2>
                </div>
                <span className="text-xs text-primary/40">
                  ({completedSessions.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {completedSessions.map(({ session, sessionPath }, index) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    sessionPath={sessionPath}
                    onDelete={handleDeleteSession}
                    index={index}
                    variant="completed"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
