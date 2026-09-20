'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-2xl backdrop-blur-md text-center">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-indigo-400 mb-2">
          Application Error
        </h2>
        <p className="text-sm text-zinc-400">
          An unexpected error interrupted the application.
        </p>
        <p className="text-xs font-mono text-zinc-500 bg-black/40 p-3 rounded-lg border border-zinc-800 mt-4 break-all text-left">
          {error.message || 'Fatal render error'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
        >
          Recover Application
        </button>
      </div>
    </div>
  );
}
