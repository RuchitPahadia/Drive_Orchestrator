export default function BrowseLoading() {
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

      {/* Main Gallery Container */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header & Search Bar Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="h-7 w-48 bg-zinc-800/80 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-zinc-800/50 rounded mt-2 animate-pulse" />
          </div>
          <div className="h-10 w-full md:w-80 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />
        </div>

        {/* Filter Pills Skeleton */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
          <div className="h-8 w-24 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse" />
          <div className="h-8 w-28 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse" />
          <div className="h-8 w-32 bg-zinc-900 border border-zinc-800 rounded-lg animate-pulse" />
        </div>

        {/* 12-Card Shimmer Image Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-zinc-900/60 border border-zinc-800/70 overflow-hidden relative animate-pulse"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="h-3 w-20 bg-zinc-800 rounded" />
                <div className="h-3 w-10 bg-zinc-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
