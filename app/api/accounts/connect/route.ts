import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateAuthUrl } from '@/lib/google-oauth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login?error=PleaseSignInFirst', request.url));
    }

    const authUrl = generateAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new NextResponse(
      `Failed to initiate Google connection: ${errorMsg}`,
      { status: 500 }
    );
  }
}
