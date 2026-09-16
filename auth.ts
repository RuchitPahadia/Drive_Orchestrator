import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { query } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
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
    async signIn({ user }) {
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
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role || 'user';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.role = (token.role as 'user' | 'admin') || 'user';
      }
      return session;
    },
  },
});
