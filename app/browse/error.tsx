'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Browse gallery error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-2xl backdrop-blur-md text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-2xl">
          🖼️
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Gallery Loading Error</h2>
        <p className="text-sm text-zinc-400 mt-2">
          Unable to fetch or render photos from the database.
        </p>
        <p className="text-xs font-mono text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-500/20 mt-4 break-all text-left">
          {error.message || 'Unknown database or rendering error'}
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
          >
            Retry Gallery
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
