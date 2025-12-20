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

    // Use backend API which supports EVM transactions with load balancer
    const backendUrl = `${API_URL}/api/evm/transactions?chain=${chain}`;
    console.log('[EVM Transactions API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 10 } // Cache for 10 seconds
    });

    if (!response.ok) {
      console.error('[EVM Transactions API] Backend error:', response.status);
      return NextResponse.json(
        { transactions: [], error: 'Failed to fetch EVM transactions' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('[EVM Transactions API] Error:', error);
    return NextResponse.json(
      { transactions: [], error: 'Internal server error' },
      { status: 500 }
    );
  }
}
