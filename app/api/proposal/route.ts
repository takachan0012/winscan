import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const id = searchParams.get('id');

    if (!chain || !id) {
      return NextResponse.json({ error: 'Chain and id parameters required' }, { status: 400 });
    }

    // Use backend API which supports both chain_name and chain_id with load balancer
    const backendUrl = `${API_URL}/api/proposal?chain=${chain}&id=${id}`;
    console.log('[Proposal API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      console.error('[Proposal API] Backend error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch proposal' },
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
    console.error('[Proposal API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
