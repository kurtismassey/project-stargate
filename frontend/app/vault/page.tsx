"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, deskNeedsUnlock, PoolData, PoolReceipt } from "@/lib/api";
import { DescriptorBoard } from "@/components/DescriptorBoard";
import { LabGate } from "@/components/LabGate";

function fileToB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VaultPage() {
  const router = useRouter();
  const [pools, setPools] = useState<PoolData[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [receipts, setReceipts] = useState<PoolReceipt[]>([]);
  const [poolName, setPoolName] = useState("");
  const [title, setTitle] = useState("");
  const [coordinates, setCoordinates] = useState("");
  const [lastReceipt, setLastReceipt] = useState("");
  const [descriptors, setDescriptors] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [labLocked, setLabLocked] = useState(false);

  const refresh = useCallback(async () => {
    const health = await api.health();
    if (deskNeedsUnlock(health)) {
      setLabLocked(true);
      return;
    }
    setLabLocked(false);
    const data = await api.listPools();
    setPools(data.pools);
    const current = selected || data.pools[0]?.id || "";
    if (!selected && current) setSelected(current);
    if (current) {
      const detail = await api.getPool(current);
      setReceipts(detail.receipts);
    }
  }, [selected]);

  useEffect(() => {
    refresh().catch(() => setError("Vault unreachable"));
  }, [refresh]);

  const createPool = async () => {
    const name = poolName.trim() || `Pool ${pools.length + 1}`;
    setBusy(true);
    try {
      const created = await api.createPool(name);
      setSelected(created.id);
      setPoolName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pool");
    } finally {
      setBusy(false);
    }
  };

  const sealImage = async (file: File) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const payloadB64 = await fileToB64(file);
      const receipt = await api.addTarget(selected, {
        payloadB64,
        title: title.trim(),
        kind: "image",
        descriptors,
      });
      setLastReceipt(receipt.payloadSha256 ?? "");
      setTitle("");
      setDescriptors({});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seal failed");
    } finally {
      setBusy(false);
    }
  };

  const sealSite = async () => {
    if (!selected || !coordinates.trim()) return;
    setBusy(true);
    try {
      const receipt = await api.addTarget(selected, {
        title: title.trim(),
        coordinates: coordinates.trim(),
        kind: "coordinate_site",
        descriptors,
      });
      setLastReceipt(receipt.payloadSha256 ?? "coordinate site");
      setCoordinates("");
      setTitle("");
      setDescriptors({});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seal failed");
    } finally {
      setBusy(false);
    }
  };

  const unlockDesk = useCallback(() => {
    setLabLocked(false);
    refresh();
  }, [refresh]);

  if (labLocked) {
    return <LabGate onUnlocked={unlockDesk} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-chrome-1">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button className="btn" onClick={() => router.push("/")}>
            Ops
          </button>
          <div>
            <h1 className="mono text-base tracking-[0.2em] text-text">VAULT</h1>
            <div className="label mt-1">
              Seal receipts only. Payloads never leave this desk.
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 w-full flex-1">
        {error ? (
          <p className="mono text-[11px] text-danger mb-4">{error}</p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel p-5">
            <h2 className="label">Pools</h2>
            <div className="flex gap-2 mt-3">
              <input
                className="input flex-1"
                placeholder="New pool name"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
              />
              <button className="btn" onClick={createPool} disabled={busy}>
                Create
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {pools.map((pool) => (
                <button
                  key={pool.id}
                  className={`panel-inset px-4 py-3 w-full text-left ${
                    selected === pool.id ? "border-signal" : ""
                  }`}
                  onClick={() => setSelected(pool.id)}
                >
                  <div className="mono text-sm">{pool.name}</div>
                  <div className="label mt-1">{pool.targetCount} sealed</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="label">Seal a target</h2>
            <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
              The server stores the photograph. You get a SHA-256 receipt.
              Titles and descriptor memberships stay off the viewer wire.
            </p>
            <input
              className="input w-full mt-3"
              placeholder="Operator title (not shown to viewer)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="btn w-full mt-3 text-center cursor-pointer">
              Upload photograph
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy || !selected}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) sealImage(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex gap-2 mt-3">
              <input
                className="input flex-1"
                placeholder="Coordinates, e.g. 38.89N 77.03W"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
              />
              <button
                className="btn"
                onClick={sealSite}
                disabled={busy || !coordinates.trim()}
              >
                Seal site
              </button>
            </div>
            <div className="mt-4">
              <h3 className="label mb-2">Target encoding</h3>
              <p className="text-[11px] text-text-faint mb-2 leading-relaxed">
                Click once for present, twice for partial. This is the May
                target set used at judgment.
              </p>
              <DescriptorBoard value={descriptors} onChange={setDescriptors} />
            </div>
            {lastReceipt ? (
              <p className="mono text-[10px] text-signal mt-3 break-all">
                seal {lastReceipt}
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel p-5 mt-4">
          <h2 className="label">Receipts</h2>
          <div className="mt-3 space-y-2">
            {receipts.length === 0 ? (
              <p className="text-[12px] text-text-faint">
                No sealed targets in this pool.
              </p>
            ) : (
              receipts.map((row) => (
                <div
                  key={row.id}
                  className="panel-inset px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="label">{row.kind}</div>
                    <div className="mono text-[11px] text-text-muted break-all">
                      {row.payloadSha256 ?? "no hash"}
                    </div>
                  </div>
                  <span className="label shrink-0">
                    {row.encoded ? "encoded · " : ""}
                    {row.hasCoordinates ? "coords" : "image"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
