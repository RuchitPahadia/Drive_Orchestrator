'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RemoveAccountButtonProps {
  accountId: string;
  accountEmail: string;
}

export default function RemoveAccountButton({ accountId, accountEmail }: RemoveAccountButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRemove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts?id=${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove account');
      }
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing account');
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2 mt-2 sm:mt-0">
        <span className="text-[11px] text-rose-400 font-medium">Remove account?</span>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Removing...' : 'Yes, Disconnect'}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={loading}
          className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        {error && <span className="text-[10px] text-rose-400">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Disconnect ${accountEmail}`}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>Disconnect</span>
    </button>
  );
}
