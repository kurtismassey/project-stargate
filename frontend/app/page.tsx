"use client";

import LoadingBar from "@/components/LoadingBar";
import Sessions from "@/components/Sessions";
import { useWebSocket } from "@/components/WebSocketProvider";
import { useMemo } from "react";
import TitleBar from "@/components/TitleBar";

export default function Home() {
  const { sessions, isLoading } = useWebSocket();

  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [sessions]);

  return (
    <div className="h-full flex flex-col">
      <TitleBar title="STARGATE SESSION DATABASE" />
      <div className="bg-secondary border border-primary flex-1 min-h-0">
        {isLoading ? (
          <LoadingBar message="LOADING SESSIONS..." />
        ) : (
          <div className="p-4 h-full">
            <Sessions sessions={sortedSessions} />
          </div>
        )}
      </div>
    </div>
  );
}
