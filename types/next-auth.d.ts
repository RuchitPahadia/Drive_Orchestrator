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
