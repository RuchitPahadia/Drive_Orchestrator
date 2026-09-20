export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Top Navbar Skeleton */}
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-zinc-950/70 border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="h-6 w-40 bg-zinc-800/80 rounded-md animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 bg-zinc-800/60 rounded animate-pulse" />
            <div className="h-4 w-16 bg-zinc-800/60 rounded animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-zinc-800/80 animate-pulse" />
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="h-8 w-64 bg-zinc-800/80 rounded-lg animate-pulse" />
            <div className="h-4 w-80 bg-zinc-800/50 rounded mt-2.5 animate-pulse" />
          </div>
          <div className="h-10 w-48 bg-zinc-800/80 rounded-xl animate-pulse" />
        </div>

        {/* Upload Zone Skeleton */}
        <div className="w-full h-44 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 p-6 flex flex-col items-center justify-center gap-3 mb-10 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-zinc-800" />
          <div className="h-4 w-48 bg-zinc-800 rounded" />
          <div className="h-3 w-64 bg-zinc-800/60 rounded" />
        </div>

        {/* Storage Pool Bar Skeleton */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 mb-8 animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-44 bg-zinc-800 rounded" />
            <div className="h-5 w-32 bg-zinc-800 rounded" />
          </div>
          <div className="w-full bg-zinc-950 rounded-full h-3 border border-zinc-800" />
        </div>

        {/* Storage Redundancy Settings Skeleton */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 mb-8 animate-pulse">
          <div className="h-5 w-56 bg-zinc-800 rounded mb-2" />
          <div className="h-3 w-80 bg-zinc-800/60 rounded mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-24 bg-zinc-950/50 rounded-xl border border-zinc-800/60" />
            <div className="h-24 bg-zinc-950/50 rounded-xl border border-zinc-800/60" />
            <div className="h-24 bg-zinc-950/50 rounded-xl border border-zinc-800/60" />
          </div>
        </div>

        {/* Accounts Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-44 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 p-6 animate-pulse" />
          <div className="h-44 rounded-2xl bg-zinc-900/40 border border-zinc-800/70 p-6 animate-pulse" />
        </div>
      </main>
    </div>
  );
}
