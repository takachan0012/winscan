import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const address = searchParams.get('address');
    const limit = searchParams.get('limit') || '100';

    if (!chain || !address) {
      return NextResponse.json({ error: 'Chain and address parameters required' }, { status: 400 });
    }

    const backendUrl = `${API_URL}/api/validator/transactions?chain=${chain}&address=${address}&limit=${limit}`;
    console.log('[Validator Transactions API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('[Validator Transactions API] Backend error:', response.status);
      return NextResponse.json(
        { transactions: [], source: 'none' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate'
      }
    });

  } catch (error: any) {
    console.error('[Validator Transactions API] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error.message, transactions: [] },
      { status: 500 }
    );
  }
}
