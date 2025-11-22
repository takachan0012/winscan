import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const denom = searchParams.get('denom');

    if (!chain || !denom) {
      return NextResponse.json({ error: 'Chain and denom parameters required' }, { status: 400 });
    }

    // Use backend API which supports both chain_name and chain_id with load balancer
    const backendUrl = `${API_URL}/api/asset-detail?chain=${chain}&denom=${encodeURIComponent(denom)}`;
    console.log('[Asset Detail API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      console.error('[Asset Detail API] Backend error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch asset detail' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });

  } catch (error: any) {
    console.error('[Asset Detail API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
