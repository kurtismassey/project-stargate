"use client";

import { FormEvent, useState } from "react";
import { setLabKey } from "@/lib/api";

interface LabGateProps {
  onUnlocked: () => void;
}

export function LabGate({ onUnlocked }: LabGateProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const key = value.trim();
    if (!key) {
      setError("Enter the lab key.");
      return;
    }
    setLabKey(key);
    onUnlocked();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form className="panel p-6 w-full max-w-md" onSubmit={submit}>
        <h1 className="mono text-sm tracking-[0.2em] text-text">LAB KEY</h1>
        <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
          This desk is closed. Chamber URLs still work for a viewer who
          already has a session.
        </p>
        <input
          className="input w-full mt-4"
          type="password"
          autoComplete="off"
          placeholder="Shared operator key"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error ? (
          <p className="mono text-[11px] text-danger mt-2">{error}</p>
        ) : null}
        <button className="btn btn-signal w-full mt-4" type="submit">
          Unlock desk
        </button>
      </form>
    </div>
  );
}
