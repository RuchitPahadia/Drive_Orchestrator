'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SyncAccountButtonProps {
  accountId?: string;
  accountEmail?: string;
  isGlobal?: boolean;
}

export default function SyncAccountButton({
  accountId,
  accountEmail,
  isGlobal = false,
}: SyncAccountButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/accounts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId || 'all' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync library');
      }

      setSyncMessage(data.message || 'Sync completed successfully!');
      setTimeout(() => setSyncMessage(null), 5000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setTimeout(() => setError(null), 6000);
    } finally {
      setSyncing(false);
    }
  };

  if (isGlobal) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-750 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 hover:border-indigo-500/50 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg
            className={`w-3.5 h-3.5 text-indigo-400 ${syncing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {syncing ? 'Scanning Library...' : 'Sync All Accounts'}
        </button>

        {syncMessage && (
          <div className="absolute right-0 top-full mt-2 w-72 z-50 p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 text-xs shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            ✓ {syncMessage}
          </div>
        )}

        {error && (
          <div className="absolute right-0 top-full mt-2 w-72 z-50 p-3 rounded-xl bg-rose-950/90 border border-rose-500/30 text-rose-300 text-xs shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            ✕ {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        title={`Scan and sync existing photos from ${accountEmail || 'this account'}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <svg
          className={`w-3.5 h-3.5 text-indigo-400 ${syncing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {syncing ? 'Scanning...' : 'Sync'}
      </button>

      {syncMessage && (
        <span className="text-[11px] text-emerald-400 font-medium animate-in fade-in duration-200">
          ✓ {syncMessage}
        </span>
      )}

      {error && (
        <span className="text-[11px] text-rose-400 font-medium animate-in fade-in duration-200">
          ✕ {error}
        </span>
      )}
    </div>
  );
}
