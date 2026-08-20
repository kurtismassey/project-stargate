"use client";

import {
  DESCRIPTOR_GROUPS,
  DESCRIPTORS,
  cycleMembership,
  membershipOf,
  type Membership,
} from "@/lib/descriptors";

interface DescriptorBoardProps {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
}

function tone(membership: Membership) {
  if (membership === 1) return "border-signal bg-signal-dim text-signal";
  if (membership === 0.5) return "border-warn/40 bg-warn-dim text-warn";
  return "border-line text-text-faint";
}

export function DescriptorBoard({
  value,
  onChange,
  disabled = false,
}: DescriptorBoardProps) {
  const toggle = (id: string) => {
    const nextMembership = cycleMembership(membershipOf(value, id));
    const next = { ...value };
    if (nextMembership === 0) {
      delete next[id];
    } else {
      next[id] = nextMembership;
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {DESCRIPTOR_GROUPS.map((group) => (
        <div key={group}>
          <div className="label mb-1.5">{group}</div>
          <div className="flex flex-wrap gap-1.5">
            {DESCRIPTORS.filter((row) => row.group === group).map((row) => {
              const membership = membershipOf(value, row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  disabled={disabled}
                  className={`mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${tone(membership)}`}
                  onClick={() => toggle(row.id)}
                >
                  {row.label}
                  {membership === 0.5 ? " ·" : membership === 1 ? " +" : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
