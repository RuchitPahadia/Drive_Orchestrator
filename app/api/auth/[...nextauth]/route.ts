/**
 * @file app/api/auth/[...nextauth]/route.ts
 * @description NextAuth.js v5 dynamic route handler for handling authentication requests,
 * callbacks, session checks, and CSRF token exchanges.
 * @phase Phase 9: Real User Authentication
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
