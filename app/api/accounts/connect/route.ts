import { NextResponse } from 'next/server';
import { generateAuthUrl } from '@/lib/google-oauth';

export async function GET() {
  try {
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
