import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Use backend API which supports EVM blocks with load balancer
    const backendUrl = `${API_URL}/api/evm/blocks?chain=${chain}`;
    console.log('[EVM Blocks API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 15 } // Cache for 15 seconds
    });

    if (!response.ok) {
      console.error('[EVM Blocks API] Backend error:', response.status);
      return NextResponse.json(
        { blocks: [], error: 'Failed to fetch EVM blocks' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[EVM Blocks API] Error:', error);
    return NextResponse.json(
      { blocks: [], error: 'Internal server error' },
      { status: 500 }
    );
  }
}
