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
 * Batch fetch PRC20 balances for an address
 * Optimized to reduce 200+ individual requests to 1 batch request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts, address } = body;

    if (!contracts || !Array.isArray(contracts) || !address) {
      return NextResponse.json(
        { error: 'contracts (array) and address required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!address.startsWith('paxi1')) {
      return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
    }

    const lcdUrl = await getWorkingLCD();
    
    console.log(`[Batch Balance] Fetching ${contracts.length} balances for ${address}`);
    
    // Process in parallel batches of 20 for optimal performance
    const batchSize = 20;
    const results: Array<{ contract: string; balance: string; success: boolean }> = [];
    
    for (let i = 0; i < contracts.length; i += batchSize) {
      const batch = contracts.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (contract: string) => {
          const balance = await fetchBalance(lcdUrl, contract, address);
          return { contract, balance, success: true };
        })
      );
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Failed requests default to 0 balance
          const contract = batch[results.length % batch.length];
          results.push({ contract, balance: '0', success: false });
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < contracts.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Filter only non-zero balances to reduce response size
    const nonZeroBalances = results.filter(r => r.balance !== '0');
    
    console.log(`[Batch Balance] Complete: ${nonZeroBalances.length}/${contracts.length} tokens with balance`);
    
    return NextResponse.json({
      address,
      total: contracts.length,
      with_balance: nonZeroBalances.length,
      balances: results // Return all for client-side filtering if needed
    });

  } catch (error) {
    console.error('Batch balance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    );
  }
}
