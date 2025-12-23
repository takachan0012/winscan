import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
      if (testRes.ok) return url;
    } catch (error) {
      continue;
    }
  }
  return LCD_ENDPOINTS[0];
}

async function fetchBalance(lcdUrl: string, contract: string, address: string): Promise<string> {
  try {
    const query = Buffer.from(JSON.stringify({ balance: { address } })).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/${query}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return '0';
    
    const data = await response.json();
    return data.data?.balance || '0';
  } catch (error) {
    return '0';
  }
}

/**
 * Batch fetch PRC20 balances for multiple addresses from ONE contract
 * POST /api/prc20-balance-batch
 * Body: { contract: string, addresses: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract, addresses } = body;

    if (!contract || !addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'contract (string) and addresses (array) required' },
        { status: 400 }
      );
    }

    const lcdUrl = await getWorkingLCD();
    
    console.log(`[PRC20 Balance Batch] Fetching balances for ${addresses.length} addresses from contract ${contract}`);
    
    // Process in parallel batches of 20 for optimal performance
    const batchSize = 20;
    const results: Array<{ address: string; balance: string; success: boolean }> = [];
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (address: string) => {
          const balance = await fetchBalance(lcdUrl, contract, address);
          return { address, balance, success: true };
        })
      );
      
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Failed requests default to 0 balance
          results.push({ address: batch[idx], balance: '0', success: false });
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`[PRC20 Balance Batch] Complete: ${results.length} addresses processed`);
    
    return NextResponse.json({
      contract,
      total: addresses.length,
      balances: results
    });

  } catch (error) {
    console.error('[PRC20 Balance Batch] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    );
  }
}
