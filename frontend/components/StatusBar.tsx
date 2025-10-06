"use client";

import { useWebSocket } from "./WebSocketProvider";

interface StatusBarProps {
  className?: string;
}

enum Status {
  ESTABLISHING = "ESTABLISHING CONNECTION...",
  CONNECTED = "CONNECTION ACTIVE",
  FAILED = "CONNECTION FAILED",
}

export default function StatusBar({ className = "" }: StatusBarProps) {
  const { isConnected, isLoading, error } = useWebSocket();

  return (
    <div
      className={`pt-2 mt-2 border-t border-primary border-opacity-30 ${className}`}
    >
      <div className="text-primary font-mono text-xs opacity-75 text-center">
        {isLoading ? (
          <span className="animate-pulse">●</span>
        ) : isConnected ? (
          <span className="text-green-400">✓</span>
        ) : (
          <span className="text-red-400">✗</span>
        )}{" "}
        {isLoading
          ? Status.ESTABLISHING
          : isConnected
            ? Status.CONNECTED
            : error || Status.FAILED}
      </div>
    </div>
  );
}
