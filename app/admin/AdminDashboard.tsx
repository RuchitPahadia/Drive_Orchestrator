'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserRecord {
  id: string;
  email: string;
  created_at: string | Date;
}

interface AccountRecord {
  id: string;
  google_email: string;
  user_email: string;
  quota_total_bytes: string | number | null;
  quota_used_bytes: string | number | null;
  token_expiry: string | null;
  created_at: string | Date;
}

interface PhotoRecord {
  id: string;
  filename: string;
  size_bytes: string | number;
  taken_at: string | null;
  camera_model: string | null;
  thumbnail_url: string | null;
  indexed_at: string | null;
  created_at: string | Date;
  user_email: string;
  replica_count: string | number;
}

interface SystemStats {
  totalUsers: number;
  totalAccounts: number;
  totalPhotos: number;
  totalReplicas: number;
  totalLogicalSize: number;
  totalPhysicalSize: number;
  unindexedCount: number;
}

interface AdminDashboardProps {
  users: UserRecord[];
  accounts: AccountRecord[];
  photos: PhotoRecord[];
  stats: SystemStats;
  redisConfigured: boolean;
}

export default function AdminDashboard({
  users,
  accounts,
  photos,
  stats,
  redisConfigured,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'photos'>('overview');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [photoSearch, setPhotoSearch] = useState('');

  const handleAction = async (action: string, photoId?: string) => {
    const actionKey = action === 'delete-photo' ? `delete-${photoId}` : action;
    setLoadingAction(actionKey);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, photoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action execution failed');
      setStatusMessage({ type: 'success', text: data.message });
      router.refresh();
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredPhotos = photos.filter((p) =>
    p.filename.toLowerCase().includes(photoSearch.toLowerCase())
  );

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
            <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors">
              Dashboard
            </Link>
            <span className="text-zinc-600">|</span>
            <Link href="/browse" className="text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors">
              Gallery
            </Link>
            <span className="text-zinc-600">|</span>
            <Link href="/admin" className="text-indigo-400 font-semibold text-sm transition-colors">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-zinc-850">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100">System Admin Panel</h1>
            <p className="text-zinc-400 mt-1">Configure, monitor, and clean storage accounts and logical files.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleAction('refresh-quotas')}
              disabled={loadingAction !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {loadingAction === 'refresh-quotas' ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8.89M9 11l3 3L22 4" />
                </svg>
              )}
              Sync Quotas
            </button>

            <button
              onClick={() => handleAction('trigger-indexing')}
              disabled={loadingAction !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {loadingAction === 'trigger-indexing' ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              Force Indexing
            </button>
          </div>
        </div>

        {/* Action Status Toast */}
        {statusMessage && (
          <div
            className={`mb-8 p-4 rounded-xl border flex items-start gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <div>
              <h4 className="font-semibold">{statusMessage.type === 'success' ? 'Action Completed' : 'Action Failed'}</h4>
              <p className="text-sm mt-0.5 opacity-90">{statusMessage.text}</p>
            </div>
          </div>
        )}

        {/* System Stats Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Users</span>
            <div className="text-3xl font-extrabold text-zinc-150 mt-1">{stats.totalUsers}</div>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Connected Accounts</span>
            <div className="text-3xl font-extrabold text-indigo-450 mt-1">{stats.totalAccounts}</div>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Logical Photos</span>
            <div className="text-3xl font-extrabold text-purple-450 mt-1">{stats.totalPhotos}</div>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Physical Replicas</span>
            <div className="text-3xl font-extrabold text-pink-450 mt-1">{stats.totalReplicas}</div>
          </div>
        </section>

        {/* Tab Controls */}
        <div className="flex border-b border-zinc-850 mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            System Overview
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Users & Nodes ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'photos'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Photos Catalog ({photos.length})
          </button>
        </div>

        {/* Tab Panel: System Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Status Panel */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-zinc-150 mb-4">Environment Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                  <span className="text-sm text-zinc-400 font-medium">Database Node (Postgres)</span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Connected
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                  <span className="text-sm text-zinc-400 font-medium">pgvector Extension</span>
                  <span className="text-xs text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                    Active (512-dim)
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
                  <span className="text-sm text-zinc-400 font-medium">Redis URL State</span>
                  {redisConfigured ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Connected (BullMQ Active)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Unset (Inline Fallback Mode)
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400 font-medium">Metadata Processing Queue</span>
                  <span className="text-xs font-semibold text-zinc-300">
                    {stats.unindexedCount > 0 ? (
                      <span className="text-amber-400">{stats.unindexedCount} pending jobs</span>
                    ) : (
                      <span className="text-zinc-500">Idle (all files indexed)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Storage pooled */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-150 mb-4">Total System Storage</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl">
                    <span className="text-xs text-zinc-500 font-bold block uppercase">Logical Volume</span>
                    <span className="text-xl font-extrabold text-zinc-200 block mt-1">{formatBytes(stats.totalLogicalSize)}</span>
                    <span className="text-[10px] text-zinc-550 block mt-0.5">Sum of distinct files</span>
                  </div>
                  <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-xl">
                    <span className="text-xs text-zinc-500 font-bold block uppercase">Physical Replicas</span>
                    <span className="text-xl font-extrabold text-indigo-400 block mt-1">{formatBytes(stats.totalPhysicalSize)}</span>
                    <span className="text-[10px] text-zinc-550 block mt-0.5">Actual bytes on Drive</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850">
                <span className="text-xs text-zinc-400 font-semibold block">Replication Factor Ratio</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-black text-pink-400">
                    {stats.totalPhotos > 0 ? (stats.totalReplicas / stats.totalPhotos).toFixed(1) : '0.0'}x
                  </span>
                  <span className="text-xs text-zinc-500">average copies per photo across nodes.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Panel: Users & Nodes */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {users.map((u) => {
              const userAccounts = accounts.filter((a) => a.user_email === u.email);

              return (
                <div key={u.id} className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-zinc-800/60 mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100">{u.email}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        User UUID: {u.id} | Joined on {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="bg-zinc-800/60 text-zinc-450 border border-zinc-700/30 px-3 py-1 rounded-full text-xs font-semibold">
                      {userAccounts.length} Node{userAccounts.length !== 1 ? 's' : ''} Connected
                    </span>
                  </div>

                  {userAccounts.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-6">No Google Drive accounts connected for this user yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {userAccounts.map((acc) => {
                        const total = typeof acc.quota_total_bytes === 'string' ? parseInt(acc.quota_total_bytes, 10) : Number(acc.quota_total_bytes) || 0;
                        const used = typeof acc.quota_used_bytes === 'string' ? parseInt(acc.quota_used_bytes, 10) : Number(acc.quota_used_bytes) || 0;
                        const free = Math.max(0, total - used);
                        const percentage = total > 0 ? (used / total) * 100 : 0;
                        const isExpired = acc.token_expiry ? new Date(acc.token_expiry).getTime() < Date.now() : false;

                        return (
                          <div key={acc.id} className="p-5 rounded-xl bg-zinc-950 border border-zinc-850 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-4">
                                <h4 className="text-md font-bold text-zinc-200 break-all">{acc.google_email}</h4>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isExpired
                                      ? 'bg-rose-500/10 text-rose-450 border-rose-500/20'
                                      : 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20'
                                  }`}
                                >
                                  {isExpired ? 'Token Expired' : 'Token Live'}
                                </span>
                              </div>
                              <p className="text-[10px] text-zinc-650 mt-1 break-all">Node ID: {acc.id}</p>
                            </div>

                            {total > 0 && (
                              <div className="mt-6">
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                  <span className="text-zinc-400 font-semibold">{formatBytes(used)} used</span>
                                  <span className="text-zinc-500 font-medium">of {formatBytes(total)}</span>
                                </div>
                                <div className="w-full bg-zinc-900 rounded-full h-2 border border-zinc-800/80 overflow-hidden">
                                  <div
                                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(1, percentage))}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-1.5">
                                  <span>{percentage.toFixed(1)}% full</span>
                                  <span className="text-zinc-450">{formatBytes(free)} free</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab Panel: Photos Catalog */}
        {activeTab === 'photos' && (
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
            {/* Search filter */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <input
                  type="text"
                  placeholder="Search photos by filename..."
                  value={photoSearch}
                  onChange={(e) => setPhotoSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-855 rounded-xl pl-9 pr-4 py-2 text-zinc-150 placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
                <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {filteredPhotos.length === 0 ? (
              <p className="text-zinc-550 text-sm text-center py-10">No photos found matching your criteria.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Preview</th>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Camera</th>
                      <th className="py-3 px-4">Replicas</th>
                      <th className="py-3 px-4">Indexing</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {filteredPhotos.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4">
                          {p.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.thumbnail_url}
                              alt={p.filename}
                              className="w-10 h-10 object-cover rounded-lg border border-zinc-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-700">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-200 max-w-[200px] truncate" title={p.filename}>
                          {p.filename}
                          <span className="block text-[10px] text-zinc-550 font-normal truncate mt-0.5">Owner: {p.user_email}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-medium">
                          {formatBytes(typeof p.size_bytes === 'string' ? parseInt(p.size_bytes, 10) : Number(p.size_bytes))}
                        </td>
                        <td className="py-3 px-4 text-zinc-450 italic">{p.camera_model || 'None'}</td>
                        <td className="py-3 px-4 font-bold">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                              Number(p.replica_count) > 1
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {p.replica_count}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {p.indexed_at ? (
                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Indexed
                            </span>
                          ) : (
                            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleAction('delete-photo', p.id)}
                            disabled={loadingAction !== null}
                            className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-rose-350 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {loadingAction === `delete-${p.id}` ? (
                              <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
