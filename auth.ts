/**
 * @file auth.ts
 * @description Full NextAuth.js v5 initialization with Google OAuth provider, developer test credentials,
 * and automated PostgreSQL user synchronization.
 * @phase Phase 9: Real User Authentication
 */

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { query } from '@/lib/db';

/** Default developer email used for local test login */
const DEV_DEFAULT_EMAIL = 'toruchitpahadia@gmail.com';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    /**
     * @security Developer Test Login Provider.
     * Allows one-click sign-in with admin role during local development and automated testing.
     * In production environments, this provider can be disabled or restricted behind NODE_ENV checks.
     */
    Credentials({
      id: 'dev-login',
      name: 'Developer Test Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string) || DEV_DEFAULT_EMAIL;
        try {
          const res = await query(
            `INSERT INTO users (email, name, role)
             VALUES ($1, 'Mr. Ruchit', 'admin')
             ON CONFLICT (email) 
             DO UPDATE SET role = 'admin', name = COALESCE(users.name, 'Mr. Ruchit')
             RETURNING id, email, name, role`,
            [email]
          );
          const user = res.rows[0];
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (err) {
          console.error('[Dev Auth] Error creating/fetching dev user:', err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Synchronizes user profile data to the PostgreSQL users table upon successful authentication.
     * Uses ON CONFLICT (email) upsert to update name and avatar while preserving existing roles.
     */
    async signIn({ user, account }) {
      if (account?.provider === 'dev-login') return true;
      if (!user.email) return false;
      try {
        const res = await query(
          `INSERT INTO users (email, name, avatar_url, role)
           VALUES ($1, $2, $3, 'user')
           ON CONFLICT (email) 
           DO UPDATE SET 
             name = COALESCE(EXCLUDED.name, users.name),
             avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
           RETURNING id, role`,
          [user.email, user.name || null, user.image || null]
        );
        if (res.rows.length > 0) {
          user.id = res.rows[0].id;
          user.role = res.rows[0].role;
        }
        return true;
      } catch (error) {
        console.error('[Auth] Error syncing user with database:', error);
        return false;
      }
    },
    // Populate JWT token with database user ID and assigned role
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role || 'user';
      }
      return token;
    },
    // Expose database user ID and role on the active session
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as 'user' | 'admin') || 'user';
      }
      return session;
    },
  },
});
