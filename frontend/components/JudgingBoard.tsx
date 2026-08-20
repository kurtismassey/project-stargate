"use client";

import { useCallback, useEffect, useState } from "react";
import { api, LagTarget, PoolMember } from "@/lib/api";

interface JudgingBoardProps {
  sessionId: string;
  inSeries: boolean;
  judged: boolean;
  onJudged: () => void;
  initialResult?: {
    rankOfTrueTarget: number;
    poolSize: number;
    figureOfMerit?: number;
    accuracy?: number;
    reliability?: number;
  } | null;
}

/**
 * Rank-order judging against the target pool. The board never marks the
 * true target, the server scores the ranking [UTTS-1995].
 */
export function JudgingBoard({
  sessionId,
  inSeries,
  judged,
  onJudged,
  initialResult = null,
}: JudgingBoardProps) {
  const [pool, setPool] = useState<PoolMember[]>([]);
  const [ranks, setRanks] = useState<Map<string, number>>(new Map());
  const [result, setResult] = useState<{
    rankOfTrueTarget: number;
    poolSize: number;
    figureOfMerit?: number;
    accuracy?: number;
    reliability?: number;
  } | null>(initialResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lag, setLag] = useState(1);
  const [lagRank, setLagRank] = useState(1);
  const [lagNote, setLagNote] = useState("");
  const [lags, setLags] = useState<LagTarget[]>([]);
  const binary = pool.length === 2;

  const loadPool = useCallback(async () => {
    try {
      const data = await api.getJudgingPool(sessionId);
      setPool(data.pool);
    } catch {
      setError("Judging pool unavailable");
    }
  }, [sessionId]);

  const loadLags = useCallback(async () => {
    if (!inSeries) return;
    try {
      const data = await api.getLagTargets(sessionId);
      setLags(data.lags);
    } catch {
      // Displacement panel stays available without neighbor images.
    }
  }, [inSeries, sessionId]);

  useEffect(() => {
    if (!judged) loadPool();
    loadLags();
  }, [judged, loadPool, loadLags]);

  const assignRank = (targetId: string) => {
    setRanks((previous) => {
      const next = new Map(previous);
      if (next.has(targetId)) {
        const removed = next.get(targetId)!;
        next.delete(targetId);
        for (const [key, value] of next) {
          if (value > removed) next.set(key, value - 1);
        }
      } else {
        next.set(targetId, next.size + 1);
      }
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const rankings = Array.from(ranks.entries()).map(([targetId, rank]) => ({
        targetId,
        rank,
      }));
      const outcome = await api.recordJudgment(sessionId, rankings, "Operator");
      setResult(outcome);
      onJudged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Judgment failed");
    } finally {
      setBusy(false);
    }
  };

  const recordLag = async () => {
    setBusy(true);
    setError("");
    try {
      const outcome = await api.recordDisplacement(sessionId, {
        lag,
        rank: lagRank,
        poolSize: pool.length || 5,
      });
      setLagNote(
        `Lag ${outcome.lag > 0 ? "+" : ""}${outcome.lag} recorded, ${
          outcome.isHit ? "hit" : "miss"
        }`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Displacement failed");
    } finally {
      setBusy(false);
    }
  };

  if (judged && !result) {
    return (
      <div className="panel p-4">
        <span className="label">Judgment</span>
        <p className="text-[12px] text-text-muted mt-2">
          This session has been judged.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="label">Blind judging</span>
        <span className="label">
          {binary ? "two associates" : "rank 1 = best match"}
        </span>
      </div>

      {result ? (
        <div className="mt-3 fade-up">
          <div className="mono text-lg text-signal">
            True target ranked {result.rankOfTrueTarget} of {result.poolSize}
          </div>
          <p className="text-[11px] text-text-faint mt-1">
            First place by chance: 1 in {result.poolSize}
          </p>
          {result.figureOfMerit != null ? (
            <p className="mono text-[12px] text-text mt-2">
              FoM {result.figureOfMerit.toFixed(2)}
              {result.accuracy != null && result.reliability != null
                ? `  (${result.accuracy.toFixed(2)} × ${result.reliability.toFixed(2)})`
                : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
            {binary
              ? "Rank the two associates. Rank 1 is the photograph the session described. The true side is not marked."
              : "Click pool members in order of match quality, best first. The true target is not marked."}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {pool.map((member) => {
              const rank = ranks.get(member.id);
              return (
                <button
                  key={member.id}
                  className={`relative rounded overflow-hidden border transition-colors ${
                    rank
                      ? "border-signal"
                      : "border-line hover:border-line-strong"
                  }`}
                  onClick={() => assignRank(member.id)}
                >
                  {member.payloadB64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/jpeg;base64,${member.payloadB64}`}
                      alt="Pool member"
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 bg-chrome-2 flex items-center justify-center mono text-[11px] text-text-muted">
                      {member.coordinates ?? "site"}
                    </div>
                  )}
                  {rank ? (
                    <span className="absolute top-1 left-1 mono text-[11px] bg-chrome-0/90 text-signal px-1.5 py-0.5 rounded">
                      {rank}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            className="btn btn-signal w-full mt-3"
            disabled={busy || ranks.size !== pool.length || pool.length === 0}
            onClick={submit}
          >
            Record judgment ({ranks.size}/{pool.length})
          </button>
        </>
      )}

      {inSeries ? (
        <div className="mt-4 pt-3 border-t border-line">
          <span className="label">Displacement (TTI)</span>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {lags
              .filter((row) => row.exists && row.target)
              .map((row) => (
                <button
                  key={row.lag}
                  className={`rounded overflow-hidden border ${
                    lag === row.lag ? "border-signal" : "border-line"
                  }`}
                  onClick={() => setLag(row.lag)}
                >
                  {row.target?.payloadB64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/jpeg;base64,${row.target.payloadB64}`}
                      alt={`Lag ${row.lag}`}
                      className="w-full h-16 object-cover"
                    />
                  ) : (
                    <div className="h-16 bg-chrome-2" />
                  )}
                  <div className="mono text-[10px] py-1 text-center">
                    lag {row.lag > 0 ? `+${row.lag}` : row.lag}
                  </div>
                </button>
              ))}
          </div>
          <div className="flex gap-2 mt-2 items-center">
            <select
              className="select"
              value={lag}
              onChange={(e) => setLag(Number(e.target.value))}
            >
              <option value={-2}>Lag -2</option>
              <option value={-1}>Lag -1</option>
              <option value={1}>Lag +1</option>
              <option value={2}>Lag +2</option>
            </select>
            <select
              className="select"
              value={lagRank}
              onChange={(e) => setLagRank(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  Rank {r}
                </option>
              ))}
            </select>
            <button className="btn" onClick={recordLag} disabled={busy}>
              Record
            </button>
          </div>
          {lagNote ? (
            <p className="mono text-[11px] text-signal mt-2">{lagNote}</p>
          ) : (
            <p className="text-[11px] text-text-faint mt-2">
              Rank this transcript against the adjacent trial&apos;s target.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mono text-[11px] text-danger mt-2">{error}</p>
      ) : null}
    </div>
  );
}
