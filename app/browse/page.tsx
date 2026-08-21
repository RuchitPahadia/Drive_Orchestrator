'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Photo {
  id: string;
  account_id: string;
  drive_file_id: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  taken_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  camera_model: string | null;
  thumbnail_url: string | null;
  created_at: string;
  replica_account_ids?: string[];
}

interface Account {
  id: string;
  google_email: string;
}

export default function BrowsePhotosPage() {
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [cameraQuery, setCameraQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20; // 20 per page fits cleanly in standard grids

  // Data states
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Lightbox state
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null);

  // Fetch connected accounts on load to populate dropdown filter
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('/api/accounts');
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data);
      } catch (err) {
        console.error('Error fetching accounts filter:', err);
      }
    }
    fetchAccounts();
  }, []);

  // Fetch photos based on active filters and pagination
  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedAccountId) params.append('accountId', selectedAccountId);
      if (cameraQuery) params.append('camera', cameraQuery);

      const res = await fetch(`/api/photos?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch photos');
      }

      const data = await res.json();
      setPhotos(data.photos);
      setTotalPhotos(data.total);
    } catch (err) {
      console.error('Error fetching photos list:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [page, startDate, endDate, selectedAccountId, cameraQuery]);

  // Trigger fetch when parameters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPhotos();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPhotos]);

  // Reset all filter controls
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedAccountId('');
    setCameraQuery('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalPhotos / pageSize));

  // Helper: Format file sizes
  const formatFileSize = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper: Format dates
  const formatPhotoDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper: Get account email from ID
  const getAccountEmail = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.google_email : 'Unknown Account';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.05),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(168,85,247,0.03),transparent_50%)] pointer-events-none" />

      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-zinc-950/70 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:to-pink-300 transition-all duration-300">
              Photo Orchestrator
            </span>
          </Link>
          <div className="flex gap-4">
            <Link 
              href="/dashboard" 
              className="text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-zinc-600">|</span>
            <Link 
              href="/browse" 
              className="text-indigo-400 font-semibold text-sm transition-colors"
            >
              Gallery
            </Link>
            <span className="text-zinc-600">|</span>
            <Link 
              href="/admin" 
              className="text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-100">Photo Library</h1>
          <p className="text-zinc-400 mt-1">Browse, filter, and view photos aggregated from all your storage nodes.</p>
        </div>

        {/* Filter Panel (Glassmorphism design) */}
        <section className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md mb-8">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter Controls
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Start Date</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all [color-scheme:dark]"
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">End Date</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all [color-scheme:dark]"
              />
            </div>

            {/* Account Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Google Drive Node</label>
              <select
                value={selectedAccountId}
                onChange={(e) => { setSelectedAccountId(e.target.value); setPage(1); }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all appearance-none"
              >
                <option value="">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.google_email}</option>
                ))}
              </select>
            </div>

            {/* Camera Model */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Camera / Device</label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="e.g. Pixel 6, iPhone"
                  value={cameraQuery}
                  onChange={(e) => { setCameraQuery(e.target.value); setPage(1); }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
                <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Reset Filters Option */}
          {(startDate || endDate || selectedAccountId || cameraQuery) && (
            <div className="flex justify-end mt-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <button
                onClick={handleResetFilters}
                className="text-xs text-zinc-400 hover:text-zinc-150 underline hover:no-underline transition-colors flex items-center gap-1.5"
              >
                Clear Filters
              </button>
            </div>
          )}
        </section>

        {/* Gallery Content */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3 mb-8">
            <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          /* Loading Grid State */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-zinc-900/60 border border-zinc-800/80 animate-pulse flex flex-col justify-end p-4">
                <div className="h-4 bg-zinc-800 rounded-md w-3/4 mb-2" />
                <div className="h-3 bg-zinc-800 rounded-md w-1/2" />
              </div>
            ))}
          </div>
        ) : photos.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 backdrop-blur-sm min-h-[300px]">
            <div className="p-4 bg-zinc-800/40 rounded-2xl text-zinc-500 border border-zinc-700/30 mb-5">
              <svg className="w-10 h-10 text-indigo-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-zinc-200">No photos found</h3>
            <p className="text-zinc-500 mt-2 max-w-sm text-sm">
              Try adjusting your date range, node selections, or camera query.
            </p>
            {(startDate || endDate || selectedAccountId || cameraQuery) && (
              <button
                onClick={handleResetFilters}
                className="mt-5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-4.5 py-2 rounded-xl border border-zinc-700 transition-colors text-sm"
              >
                Reset all filters
              </button>
            )}
          </div>
        ) : (
          /* Photo Grid */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setActivePhoto(photo)}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 hover:border-indigo-500/40 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 transform hover:-translate-y-0.5"
                >
                  {photo.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={photo.thumbnail_url} 
                      alt={photo.filename}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    /* Fallback for non-indexed/non-image photos */
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-600">
                      <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span className="text-xs text-center break-all line-clamp-2 px-2">{photo.filename}</span>
                    </div>
                  )}

                  {/* Hover Information overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-xs font-bold text-zinc-100 truncate">{photo.filename}</p>
                    <p className="text-[10px] text-zinc-400 mt-1">
                      {photo.taken_at ? new Date(photo.taken_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unknown'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="mt-12 flex items-center justify-between border-t border-zinc-900 pt-6">
              <span className="text-xs text-zinc-500 font-medium">
                Showing <strong className="text-zinc-350">{photos.length}</strong> of <strong className="text-zinc-350">{totalPhotos}</strong> photos
              </span>
              
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-350 disabled:opacity-30 disabled:hover:bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-100 transition-colors disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center px-3 text-xs text-zinc-400 font-semibold">
                  Page {page} of {totalPages}
                </div>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-350 disabled:opacity-30 disabled:hover:bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-100 transition-colors disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/85 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh]">
            
            {/* Left side: Photo viewer */}
            <div className="flex-1 bg-zinc-950 p-6 flex items-center justify-center relative min-h-[300px] md:min-h-0">
              {activePhoto.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={activePhoto.thumbnail_url} 
                  alt={activePhoto.filename}
                  className="max-w-full max-h-[55vh] object-contain rounded-lg"
                />
              ) : (
                <div className="text-center p-8 text-zinc-650">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-sm">Metadata available, but file content could not be previewed.</p>
                </div>
              )}

              {/* Close Button on Mobile (absolute top-right) */}
              <button 
                onClick={() => setActivePhoto(null)}
                className="absolute top-4 right-4 p-2 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-full border border-zinc-800/50 md:hidden"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Right side: Metadata sidebar */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-800/80 p-6 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Header info */}
                <div className="flex justify-between items-start gap-4 mb-6">
                  <h2 className="text-lg font-bold text-zinc-100 break-all">{activePhoto.filename}</h2>
                  <button 
                    onClick={() => setActivePhoto(null)}
                    className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors hidden md:block"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Metadata Properties */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Storage Nodes</span>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {activePhoto.replica_account_ids && activePhoto.replica_account_ids.length > 0 ? (
                        activePhoto.replica_account_ids.map(accId => (
                          <div key={accId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span className="truncate">{getAccountEmail(accId)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span className="truncate">{getAccountEmail(activePhoto.account_id)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Capture Date</span>
                    <span className="text-sm text-zinc-300 font-medium">{formatPhotoDate(activePhoto.taken_at)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Camera Model</span>
                    <span className="text-sm text-zinc-300 font-medium">{activePhoto.camera_model || 'No metadata'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">File size</span>
                    <span className="text-sm text-zinc-300 font-medium">{formatFileSize(activePhoto.size_bytes)}</span>
                  </div>

                  {activePhoto.gps_lat !== null && activePhoto.gps_lng !== null && (
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Location (GPS)</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-zinc-300 font-medium">
                          {activePhoto.gps_lat.toFixed(5)}, {activePhoto.gps_lng.toFixed(5)}
                        </span>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${activePhoto.gps_lat},${activePhoto.gps_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium flex items-center gap-1"
                        >
                          Google Maps
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar footer info */}
              <div className="mt-8 border-t border-zinc-800/80 pt-4 flex flex-col gap-1.5">
                <span className="text-[9px] text-zinc-650 font-semibold break-all">ID: {activePhoto.id}</span>
                <span className="text-[9px] text-zinc-650 font-semibold break-all">Drive ID: {activePhoto.drive_file_id}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
