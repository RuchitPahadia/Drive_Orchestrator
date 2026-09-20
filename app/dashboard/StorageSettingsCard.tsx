'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface StorageSettingsCardProps {
  initialReplicationFactor: number;
  connectedAccountsCount: number;
  totalStorageBytes: number;
  totalUsedBytes: number;
}

export default function StorageSettingsCard({
  initialReplicationFactor,
  connectedAccountsCount,
  totalStorageBytes,
  totalUsedBytes,
}: StorageSettingsCardProps) {
  const [factor, setFactor] = useState<number>(initialReplicationFactor);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleUpdateFactor = async (newFactor: number) => {
    if (newFactor < 1) return;
    setFactor(newFactor);
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/users/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replicationFactor: newFactor }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setStatusMsg(`Saved! Storage policy set to ${newFactor}× replication.`);
      setTimeout(() => setStatusMsg(null), 4000);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatStorageSize = (bytes: number) => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const freeStorageBytes = Math.max(0, totalStorageBytes - totalUsedBytes);
  const effectiveUsableTotal = factor > 0 ? Math.floor(totalStorageBytes / factor) : totalStorageBytes;
  const effectiveUsableFree = factor > 0 ? Math.floor(freeStorageBytes / factor) : freeStorageBytes;

  return (
    <div className="bg-zinc-900/60 backdrop-blur-sm border border-zinc-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-700/80">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-lg">
              ⚙️
            </span>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
              Storage Redundancy & Replication
            </h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Configure how many independent Google Drive copies are kept for each uploaded photo.
          </p>
        </div>

        {/* Current Redundancy Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold self-start sm:self-center">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {factor === 1 ? '1× Single Copy (Max Space)' : `${factor}× Redundant Copies`}
        </div>
      </div>

      {/* Preset Selector Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Option 1: 1x Max Capacity */}
        <button
          type="button"
          onClick={() => handleUpdateFactor(1)}
          disabled={saving}
          className={`text-left p-4 rounded-xl border transition-all duration-200 relative ${
            factor === 1
              ? 'bg-indigo-600/15 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50'
              : 'bg-zinc-950/40 border-zinc-800/70 hover:border-zinc-700 hover:bg-zinc-800/30 text-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-zinc-100">1× Storage</span>
            {factor === 1 && (
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Maximum raw capacity. Photos uploaded to 1 account with zero redundancy.
          </p>
        </button>

        {/* Option 2: 2x Recommended High Availability */}
        <button
          type="button"
          onClick={() => handleUpdateFactor(2)}
          disabled={saving}
          className={`text-left p-4 rounded-xl border transition-all duration-200 relative ${
            factor === 2
              ? 'bg-indigo-600/15 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50'
              : 'bg-zinc-950/40 border-zinc-800/70 hover:border-zinc-700 hover:bg-zinc-800/30 text-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-zinc-100">
              2× Dual-Replica <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 ml-1">Recommended</span>
            </span>
            {factor === 2 && (
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            High availability. Every photo mirrored across 2 distinct Drive accounts.
          </p>
        </button>

        {/* Option 3: All Connected Accounts */}
        <button
          type="button"
          onClick={() => handleUpdateFactor(Math.max(3, connectedAccountsCount))}
          disabled={saving || connectedAccountsCount < 2}
          className={`text-left p-4 rounded-xl border transition-all duration-200 relative ${
            factor >= Math.max(3, connectedAccountsCount) && factor > 2
              ? 'bg-indigo-600/15 border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50'
              : 'bg-zinc-950/40 border-zinc-800/70 hover:border-zinc-700 hover:bg-zinc-800/30 text-zinc-300'
          } ${connectedAccountsCount < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-zinc-100">All Accounts</span>
            {factor >= Math.max(3, connectedAccountsCount) && factor > 2 && (
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Full redundancy across all {connectedAccountsCount} connected Drive accounts.
          </p>
        </button>
      </div>

      {/* Dynamic Storage Math Metrics */}
      <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/70 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <span className="text-xs text-zinc-500 font-medium block">Raw Storage Total</span>
          <span className="text-sm font-semibold text-zinc-200 mt-0.5 block">
            {formatStorageSize(totalStorageBytes)}
          </span>
        </div>
        <div>
          <span className="text-xs text-zinc-500 font-medium block">Raw Free Storage</span>
          <span className="text-sm font-semibold text-emerald-400 mt-0.5 block">
            {formatStorageSize(freeStorageBytes)}
          </span>
        </div>
        <div>
          <span className="text-xs text-indigo-400/90 font-medium block">Effective Usable Pool</span>
          <span className="text-sm font-semibold text-zinc-100 mt-0.5 block">
            ~{formatStorageSize(effectiveUsableTotal)}
          </span>
        </div>
        <div>
          <span className="text-xs text-indigo-400/90 font-medium block">Effective Usable Free</span>
          <span className="text-sm font-bold text-indigo-300 mt-0.5 block">
            ~{formatStorageSize(effectiveUsableFree)}
          </span>
        </div>
      </div>

      {/* Status Notifications */}
      {statusMsg && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
          <span>✓</span>
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
          <span>✕</span>
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
