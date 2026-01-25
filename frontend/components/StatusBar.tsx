"use client";

import { useWebSocket } from "./WebSocketProvider";

interface StatusBarProps {
  className?: string;
}

enum Status {
  ESTABLISHING = "Establishing connection...",
  CONNECTED = "Connection active",
  FAILED = "Connection failed",
}

export default function StatusBar({ className = "" }: StatusBarProps) {
  const { isConnected, isLoading, error } = useWebSocket();

  return (
    <div className={`pt-3 mt-3 ${className}`}>
      <div className="divider mb-3" />
      <div className="flex items-center justify-center gap-2 text-xs">
        <div
          className={`status-dot ${
            isLoading
              ? "bg-amber-400 animate-pulse"
              : isConnected
                ? "status-dot-connected"
                : "status-dot-disconnected"
          }`}
        />
        <span className="text-primary/60 font-medium">
          {isLoading
            ? Status.ESTABLISHING
            : isConnected
              ? Status.CONNECTED
              : error || Status.FAILED}
        </span>
      </div>
    </div>
  );
}
