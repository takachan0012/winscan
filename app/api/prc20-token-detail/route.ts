import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Paxi LCD endpoints with failover
const LCD_ENDPOINTS = [
  'https://mainnet-lcd.paxinet.io',
  'https://api-paxi.winnode.xyz',
  'https://api-paxi-m.maouam.xyz'
];

async function getWorkingLCD(): Promise<string> {
  for (const url of LCD_ENDPOINTS) {
    try {
      const testRes = await fetch(`${url}/cosmos/base/tendermint/v1beta1/node_info`, {
        signal: AbortSignal.timeout(3000)
      });
      if (testRes.ok) {
        return url;
      }
    } catch (error) {
      continue;
    }
  }
  return LCD_ENDPOINTS[0]; // Fallback to first
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contract = searchParams.get('contract');
    const query = searchParams.get('query'); // 'token_info' or 'marketing_info'

    if (!contract || !query) {
      return NextResponse.json(
        { error: 'Contract and query parameters required' },
        { status: 400 }
      );
    }

    const lcdUrl = await getWorkingLCD();
    
    // Build query object
    let queryObj: any;
    if (query === 'token_info') {
      queryObj = { token_info: {} };
    } else if (query === 'marketing_info') {
      queryObj = { marketing_info: {} };
    } else if (query === 'all_accounts') {
      queryObj = { all_accounts: { limit: 100 } };
    } else {
      return NextResponse.json(
        { error: 'Invalid query type. Must be token_info, marketing_info, or all_accounts' },
        { status: 400 }
      );
    }

    // Encode query to base64
    const base64Query = Buffer.from(JSON.stringify(queryObj)).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/${base64Query}`;

    console.log('[PRC20 Token Detail] Fetching:', url);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error('[PRC20 Token Detail] Error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch token data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });

  } catch (error: any) {
    console.error('[PRC20 Token Detail] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
