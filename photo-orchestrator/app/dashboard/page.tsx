import Link from 'next/link';
import { query } from '@/lib/db';

interface Account {
  id: string;
  google_email: string;
  created_at: Date;
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const successMessage = typeof resolvedParams.success === 'string' ? resolvedParams.success : null;
  const errorMessage = typeof resolvedParams.error === 'string' ? resolvedParams.error : null;

  let accounts: Account[] = [];
  let dbError: string | null = null;
  let isDbUnconfigured = false;

  // Check if database URL is configured
  if (!process.env.DATABASE_URL) {
    isDbUnconfigured = true;
  } else {
    try {
      // In a real app, we would query by logged in user ID. For now, get the testuser@example.com account
      const res = await query(
        `SELECT a.id, a.google_email, a.created_at 
         FROM accounts a 
         JOIN users u ON a.user_id = u.id 
         WHERE u.email = $1 
         ORDER BY a.created_at DESC`,
        ['testuser@example.com']
      );
      accounts = res.rows;
    } catch (e) {
      console.error('Database connection failed in dashboard:', e);
      dbError = e instanceof Error ? e.message : 'Failed to connect to the database.';
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.06),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(168,85,247,0.04),transparent_50%)] pointer-events-none" />

      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-zinc-800/80 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Photo Orchestrator
            </h1>
            <p className="text-zinc-400 mt-2 text-lg">
              Manage and pool your Google Drive storage accounts in one place.
            </p>
          </div>
          
          <Link
            href="/api/accounts/connect"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium px-6 py-3 rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/20 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {/* Google Drive Multi-colored SVG styled cleanly */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M19.38 14.82L15.38 7.82C15.08 7.32 14.53 7 13.93 7H10.07C9.47 7 8.92 7.32 8.62 7.82L4.62 14.82C4.32 15.32 4.32 15.96 4.62 16.46L6.62 19.96C6.92 20.46 7.47 20.78 8.07 20.78H15.93C16.53 20.78 17.08 20.46 17.38 19.96L19.38 16.46C19.68 15.96 19.68 15.32 19.38 14.82Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Connect Google Account
          </Link>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold">Success</h4>
              <p className="text-emerald-400/90 text-sm mt-0.5">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-semibold">Connection Failed</h4>
              <p className="text-rose-400/90 text-sm mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Database Configuration Guide */}
        {isDbUnconfigured && (
          <div className="p-8 rounded-2xl bg-zinc-900/50 border border-yellow-500/20 backdrop-blur-md mb-8">
            <div className="flex gap-4 items-start">
              <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400 border border-yellow-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-yellow-400">Database Setup Required</h3>
                <p className="text-zinc-400 mt-1 max-w-2xl">
                  Before you can connect Google Drive accounts, you need to set up a PostgreSQL database and add its connection string to your environment file.
                </p>
                <div className="mt-6 flex flex-col md:flex-row gap-4">
                  <a 
                    href="https://supabase.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-5 py-2.5 rounded-xl border border-zinc-700 transition-colors duration-200 text-sm"
                  >
                    Go to Supabase
                  </a>
                  <a 
                    href="https://neon.tech" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-5 py-2.5 rounded-xl border border-zinc-700 transition-colors duration-200 text-sm"
                  >
                    Go to Neon
                  </a>
                </div>
                <div className="mt-6 border-t border-zinc-800/80 pt-6">
                  <h4 className="text-sm font-semibold text-zinc-300">Quick Configuration Steps:</h4>
                  <ol className="list-decimal list-inside text-sm text-zinc-400 mt-2 space-y-2">
                    <li>Create a database project on Supabase or Neon.</li>
                    <li>Execute the schema defined in <code className="text-indigo-400">db/schema.sql</code>.</li>
                    <li>Copy your database connection URL and paste it as <code className="text-indigo-400">DATABASE_URL=</code> inside your local <code className="text-zinc-300">.env.local</code>.</li>
                    <li>Add a secret string for <code className="text-indigo-400">TOKEN_ENCRYPTION_KEY</code> (e.g. any long, secure passphrase) and save.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Database Error Alert */}
        {dbError && !isDbUnconfigured && (
          <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/20 text-rose-300 backdrop-blur-md mb-8 flex items-start gap-4">
            <svg className="w-6 h-6 text-rose-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-lg">Database Connection Error</h3>
              <p className="text-sm text-rose-400/90 mt-1">
                Could not connect to your Postgres database. Please check that your server is active and the <code className="bg-rose-950/50 px-1 py-0.5 rounded text-rose-300">DATABASE_URL</code> in <code className="text-zinc-300 font-mono">.env.local</code> is valid.
              </p>
              <p className="text-xs text-rose-500/80 font-mono mt-3 break-all bg-black/30 p-3 rounded-lg border border-rose-500/10">
                Error details: {dbError}
              </p>
            </div>
          </div>
        )}

        {/* Connected Accounts Section */}
        <section className="mt-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Connected Storage Accounts
            </h2>
            <span className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-xs font-semibold border border-zinc-700/50">
              {accounts.length} Account{accounts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {!dbError && !isDbUnconfigured && accounts.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 backdrop-blur-sm min-h-[300px]">
              <div className="p-4 bg-zinc-800/40 rounded-2xl text-zinc-500 border border-zinc-700/30 mb-5 relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-10 blur-sm" />
                <svg className="w-10 h-10 text-indigo-400/80 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-200">No storage accounts connected</h3>
              <p className="text-zinc-500 mt-2 max-w-sm text-sm">
                Connect your first Google Drive account to start pooling photo storage and automatic indexing.
              </p>
              <Link
                href="/api/accounts/connect"
                className="mt-6 inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold px-5 py-2.5 rounded-xl border border-zinc-700 transition-colors duration-200 text-sm"
              >
                Connect account
              </Link>
            </div>
          ) : (
            /* Accounts Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accounts.map((acc) => (
                <div 
                  key={acc.id}
                  className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 group hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 transition-colors duration-300">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-5.625-3.75" />
                      </svg>
                    </div>
                    
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                      Connected
                    </span>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-lg font-bold text-zinc-100 break-all">{acc.google_email}</h4>
                    <p className="text-zinc-500 text-xs mt-1">
                      Connected on {new Date(acc.created_at).toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
