import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chain = searchParams.get('chain');
  const address = searchParams.get('address');

  if (!chain || !address) {
    return NextResponse.json({ error: 'Chain and address parameters required' }, { status: 400 });
  }

  try {
    const backendUrl = `${API_URL}/api/validator?chain=${chain}&address=${address}`;
    console.log('[Validator Detail API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      console.error('[Validator Detail API] Backend error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch validator details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });

  } catch (error) {
    console.error('[Validator Detail API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
