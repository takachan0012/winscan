import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chain = searchParams.get('chain');
  const address = searchParams.get('address');
  const blocks = searchParams.get('blocks') || '150';

  if (!chain || !address) {
    return NextResponse.json({ error: 'Chain and address parameters required' }, { status: 400 });
  }

  try {
    const backendUrl = `${API_URL}/api/uptime/validator?chain=${chain}&address=${address}&blocks=${blocks}`;
    console.log('[Validator Uptime API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 10 }
    });

    if (!response.ok) {
      console.error('[Validator Uptime API] Backend error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch validator uptime data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    });

  } catch (error) {
    console.error('[Validator Uptime API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
