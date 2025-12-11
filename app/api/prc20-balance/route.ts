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
    const address = searchParams.get('address');

    if (!contract || !address) {
      return NextResponse.json(
        { error: 'Contract and address parameters required' },
        { status: 400 }
      );
    }

    const lcdUrl = await getWorkingLCD();
    
    // Query balance for specific address
    const queryObj = {
      balance: {
        address: address
      }
    };

    // Encode query to base64
    const base64Query = Buffer.from(JSON.stringify(queryObj)).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/${base64Query}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error('[PRC20 Balance] Error:', response.status);
      return NextResponse.json(
        { balance: '0' },
        { status: 200 }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });

  } catch (error: any) {
    console.error('[PRC20 Balance] Error:', error);
    return NextResponse.json(
      { balance: '0' },
      { status: 200 }
    );
  }
}
