"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEventData } from "@/lib/api";

interface MonitorFeedProps {
  events: TranscriptEventData[];
  monitorMode: string;
}

/**
 * The monitor's voice. Quiet by design, structural patter only, per the
 * monitor rules in the 1986 CRV manual.
 */
export function MonitorFeed({ events, monitorMode }: MonitorFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prompts = events.filter((event) => event.kind === "monitor_prompt");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [prompts.length]);

  return (
    <div className="panel p-4 flex flex-col min-h-[120px] max-h-[260px]">
      <div className="flex items-center justify-between">
        <span className="label">Monitor</span>
        <span className="label">
          {monitorMode === "solo" ? "none" : "blind"}
        </span>
      </div>
      <div className="mt-2 space-y-2 overflow-y-auto flex-1">
        {monitorMode === "solo" ? (
          <p className="text-[12px] text-text-faint">Solo session.</p>
        ) : prompts.length === 0 ? (
          <p className="text-[12px] text-text-faint">
            The monitor is silent unless structure needs it.
          </p>
        ) : (
          prompts.map((prompt) => (
            <div key={prompt.id} className="fade-up">
              <p className="text-[12px] text-text leading-relaxed">
                {String(prompt.payload.text ?? "")}
              </p>
              <span className="label">
                {prompt.payload.source === "engine" ? "protocol" : "monitor"}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
