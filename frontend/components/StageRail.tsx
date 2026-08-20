"use client";

import { PROTOCOL_BRIEF, Protocol, STAGE_ROMAN, STAGE_TITLES } from "@/lib/protocol";
import type { StageRecordData } from "@/lib/api";

interface StageRailProps {
  currentStage: number | null;
  stageRecords: StageRecordData[];
  locked: boolean;
  protocol?: Protocol;
}

function dwellLabel(ms: number | null): string {
  if (ms == null) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * The six CRV stages as a gated rail. Stages ahead of the cursor are
 * sealed, the protocol engine decides when they open.
 */
export function StageRail({
  currentStage,
  stageRecords,
  locked,
  protocol = "erv",
}: StageRailProps) {
  const dwellByStage = new Map(
    stageRecords.map((record) => [record.stage, record]),
  );

  if (currentStage === null) {
    return (
      <div className="panel p-4">
        <div className="label">{protocol.toUpperCase()}</div>
        <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
          {PROTOCOL_BRIEF[protocol]}
        </p>
      </div>
    );
  }

  return (
    <nav className="panel p-3 space-y-1">
      <div className="label px-2 pb-1">Structure</div>
      {[1, 2, 3, 4, 5, 6].map((stage) => {
        const record = dwellByStage.get(stage);
        const isCurrent = stage === currentStage && !locked;
        const isPast = stage < currentStage || (locked && record != null);
        const sealed = stage > currentStage;
        return (
          <div
            key={stage}
            className={`flex items-center gap-3 px-2 py-2 rounded-md border ${
              isCurrent
                ? "border-signal-line bg-signal-dim"
                : "border-transparent"
            } ${sealed ? "opacity-40" : ""}`}
          >
            <span
              className={`mono text-xs w-6 ${
                isCurrent
                  ? "text-signal"
                  : isPast
                    ? "text-text"
                    : "text-text-faint"
              }`}
            >
              {STAGE_ROMAN[stage]}
            </span>
            <span
              className={`text-[12px] flex-1 ${
                isCurrent ? "text-text" : "text-text-muted"
              }`}
            >
              {STAGE_TITLES[stage]}
            </span>
            {record?.dwellMs != null ? (
              <span className="mono text-[10px] text-text-faint">
                {dwellLabel(record.dwellMs)}
              </span>
            ) : isCurrent ? (
              <span className="dot dot-signal pulse" />
            ) : sealed ? (
              <span className="mono text-[10px] text-text-faint">--</span>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
