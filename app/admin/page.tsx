import { query } from '@/lib/db';
import AdminDashboard from './AdminDashboard';

export default async function AdminPage() {
  let users = [];
  let accounts = [];
  let photos = [];
  let stats = {
    totalUsers: 0,
    totalAccounts: 0,
    totalPhotos: 0,
    totalReplicas: 0,
    totalLogicalSize: 0,
    totalPhysicalSize: 0,
    unindexedCount: 0,
  };
  
  let dbError: string | null = null;
  const isDbUnconfigured = !process.env.DATABASE_URL;

  if (!isDbUnconfigured) {
    try {
      // 1. Fetch Users
      const usersResult = await query(
        'SELECT id, email, created_at FROM users ORDER BY created_at DESC'
      );
      users = usersResult.rows;

      // 2. Fetch Connected Google Accounts
      const accountsResult = await query(`
        SELECT a.id, a.google_email, u.email as user_email, a.quota_total_bytes, a.quota_used_bytes, a.token_expiry, a.created_at
        FROM accounts a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.google_email ASC
      `);
      accounts = accountsResult.rows;

      // 3. Fetch Photos and replica counts
      const photosResult = await query(`
        SELECT p.id, p.filename, p.size_bytes, p.taken_at, p.camera_model, p.thumbnail_url, p.indexed_at, p.created_at, u.email as user_email,
               (SELECT COUNT(*) FROM photo_replicas pr WHERE pr.photo_id = p.id) as replica_count
        FROM photos p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `);
      photos = photosResult.rows;

      // 4. Fetch System-wide Stats
      const replicasCountResult = await query('SELECT COUNT(*) as count FROM photo_replicas');
      const logicalSizeResult = await query('SELECT SUM(size_bytes) as sum FROM photos');
      const physicalSizeResult = await query(`
        SELECT SUM(p.size_bytes) as sum 
        FROM photo_replicas pr 
        JOIN photos p ON pr.photo_id = p.id
      `);
      const unindexedResult = await query('SELECT COUNT(*) as count FROM photos WHERE indexed_at IS NULL');

      stats = {
        totalUsers: users.length,
        totalAccounts: accounts.length,
        totalPhotos: photos.length,
        totalReplicas: parseInt(replicasCountResult.rows[0].count || '0', 10),
        totalLogicalSize: parseInt(logicalSizeResult.rows[0].sum || '0', 10),
        totalPhysicalSize: parseInt(physicalSizeResult.rows[0].sum || '0', 10),
        unindexedCount: parseInt(unindexedResult.rows[0].count || '0', 10),
      };
    } catch (e) {
      console.error('Database connection failed on admin page:', e);
      dbError = e instanceof Error ? e.message : 'Failed to query the database.';
    }
  }

  // If there's a configuration error or database connection issue, show a descriptive fallback page
  if (isDbUnconfigured || dbError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex items-center justify-center p-6 selection:bg-indigo-500/30 selection:text-indigo-200">
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.05),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(168,85,247,0.03),transparent_50%)] pointer-events-none" />
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md relative z-10">
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-450 border border-rose-500/20 w-fit mb-5">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-bold text-zinc-100">
            {isDbUnconfigured ? 'Database Configuration Required' : 'Database Connection Failed'}
          </h2>
          
          <p className="text-sm text-zinc-450 mt-3">
            {isDbUnconfigured 
              ? 'The DATABASE_URL environment variable is missing. Set it in .env.local and retry.'
              : 'Could not connect to your PostgreSQL database. This often happens if your database service is paused or your internet connection is down.'
            }
          </p>

          {dbError && (
            <div className="mt-4 p-3 bg-black/40 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-500 break-all max-h-40 overflow-y-auto">
              Error details: {dbError}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3">
            {!isDbUnconfigured && dbError?.includes('tenant/user') && (
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Open Supabase Dashboard
              </a>
            )}
            <a 
              href="/dashboard"
              className="w-full inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold py-2.5 rounded-xl border border-zinc-700 transition-colors text-sm"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  const redisConfigured = !!process.env.REDIS_URL;

  return (
    <AdminDashboard
      users={users}
      accounts={accounts}
      photos={photos}
      stats={stats}
      redisConfigured={redisConfigured}
    />
  );
}
