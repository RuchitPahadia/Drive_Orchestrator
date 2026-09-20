/**
 * @file app/page.tsx
 * @description Root landing route. Automatically redirects visitors to the `/dashboard`.
 * @phase Phase 1: Project Scaffold
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
