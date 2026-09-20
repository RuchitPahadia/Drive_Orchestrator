/**
 * @file types/next-auth.d.ts
 * @description TypeScript module augmentation for NextAuth.js v5.
 * Extends the built-in Session, User, and JWT types to include application-specific properties:
 * - `id`: PostgreSQL UUID of the authenticated user.
 * - `role`: Role-based access control tier ('user' | 'admin').
 * @phase Phase 9: Real User Authentication
 */

import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'user' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: 'user' | 'admin';
  }
}
