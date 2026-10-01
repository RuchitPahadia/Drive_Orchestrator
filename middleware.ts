/**
 * @file middleware.ts
 * @description Next.js edge middleware for route protection, authentication gating,
 * and Role-Based Access Control (RBAC) enforcement.
 * @phase Phase 9: Real User Authentication
 */

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // === Section 1: Auth Bypass Routes ===
  // Authentication endpoints and login pages are publicly accessible
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/api/auth');

  // Google OAuth redirects back to /api/accounts/callback directly from Google's servers.
  // This endpoint must remain publicly reachable by the browser during OAuth handshakes.
  const isPublicApi = pathname.startsWith('/api/accounts/callback');

  if (isAuthRoute || isPublicApi) {
    // If an authenticated user visits /login, redirect directly to their dashboard
    if (isLoggedIn && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }
    return NextResponse.next();
  }

  // === Section 2: Unauthenticated Access Guard ===
  // Intercept protected paths and redirect unauthenticated sessions to /login with return callback
  if (!isLoggedIn) {
    let callbackUrl = pathname;
    if (req.nextUrl.search) {
      callbackUrl += req.nextUrl.search;
    }
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodedCallbackUrl}`, req.nextUrl)
    );
  }

  // === Section 3: Admin Role Authorization Check ===
  // Restrict admin surfaces to users with the 'admin' role. Defense in depth: the
  // /api/admin handlers also enforce this, but gating at the edge too means a future
  // handler that forgets the check is not silently exposed.
  if (pathname.startsWith('/api/admin') && req.auth?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  if (pathname.startsWith('/admin') && req.auth?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard?error=Unauthorized', req.nextUrl));
  }

  return NextResponse.next();
});

/**
 * Route Matcher Configuration:
 * Explicitly guards dashboard, gallery browse, admin portal, and all data mutation API endpoints.
 */
export const config = {
  matcher: [
    '/dashboard/:path*', // User storage overview & management
    '/browse/:path*',    // Photo gallery & semantic search UI
    '/admin/:path*',     // System administration & metrics
    '/api/photos/:path*', // Photo upload, search, similarity APIs
    '/api/accounts/:path*', // Google Drive account connection and sync APIs
    '/api/admin/:path*',  // Admin-only mutation APIs (defense-in-depth; handler also checks role)
    '/api/users/:path*',  // Per-user settings APIs
    '/login',            // Authentication page
  ],
};
