/**
 * @file auth.config.ts
 * @description NextAuth.js v5 edge-safe configuration object.
 * Imported by middleware.ts for lightweight edge authentication checks without direct
 * Node.js database driver dependencies.
 * @phase Phase 9: Real User Authentication
 */

import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-compatible authentication configuration.
 * Contains provider definitions and token mapping callbacks that do not require PostgreSQL pool access.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // Enrich JWT token with user ID and role during token generation
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role || 'user';
      }
      return token;
    },
    // Expose enriched token properties onto the active client/server session object
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as 'user' | 'admin') || 'user';
      }
      return session;
    },
  },
};
