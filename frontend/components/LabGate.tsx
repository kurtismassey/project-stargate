"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  api,
  deskNeedsUnlock,
  setLabKey,
  setOperatorToken,
} from "@/lib/api";

interface LabGateProps {
  onUnlocked: () => void;
}

export function LabGate({ onUnlocked }: LabGateProps) {
  const [callsign, setCallsign] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [labKey, setLabKeyValue] = useState("");
  const [labKeyRequired, setLabKeyRequired] = useState(false);
  const [operatorAuthRequired, setOperatorAuthRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .health()
      .then((health) => {
        setLabKeyRequired(health.labKeyRequired);
        setOperatorAuthRequired(health.operatorAuthRequired);
        if (!deskNeedsUnlock(health)) onUnlocked();
      })
      .catch(() => {
        setError("Backend unreachable");
      });
  }, [onUnlocked]);

  const submitSignIn = async (event: FormEvent) => {
    event.preventDefault();
    const name = callsign.trim();
    if (!name || !passphrase) {
      setError("Enter a callsign and passphrase.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const signed = await api.signInOperator(name, passphrase);
      setOperatorToken(signed.token);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const submitLabKey = (event: FormEvent) => {
    event.preventDefault();
    const key = labKey.trim();
    if (!key) {
      setError("Enter the lab key.");
      return;
    }
    setLabKey(key);
    onUnlocked();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="panel p-6 w-full max-w-md space-y-6">
        <div>
          <h1 className="mono text-sm tracking-[0.2em] text-text">DESK LOCKED</h1>
          <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
            Ops and the vault need a signed-in operator or the shared lab
            key. Chamber URLs still work for a viewer who already has a
            session.
          </p>
        </div>
        {operatorAuthRequired ? (
          <form onSubmit={submitSignIn}>
            <h2 className="label">Operator</h2>
            <input
              className="input w-full mt-3"
              autoComplete="username"
              placeholder="Callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
            />
            <input
              className="input w-full mt-2"
              type="password"
              autoComplete="current-password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <button
              className="btn btn-signal w-full mt-4"
              type="submit"
              disabled={busy}
            >
              Sign in
            </button>
          </form>
        ) : null}
        {labKeyRequired ? (
          <form onSubmit={submitLabKey}>
            <h2 className="label">Lab key</h2>
            <input
              className="input w-full mt-3"
              type="password"
              autoComplete="off"
              placeholder="Shared operator key"
              value={labKey}
              onChange={(e) => setLabKeyValue(e.target.value)}
            />
            <button className="btn w-full mt-4" type="submit">
              Unlock with key
            </button>
          </form>
        ) : null}
        {error ? (
          <p className="mono text-[11px] text-danger">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
