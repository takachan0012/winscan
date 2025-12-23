import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LCD_ENDPOINTS: Record<string, string[]> = {
  'paxi-mainnet': [
    'https://mainnet-lcd.paxinet.io',
    'https://api-paxi.winnode.xyz',
    'https://api-paxi-m.maouam.xyz'
  ],
  'cosmoshub-mainnet': [
    'https://lcd-cosmoshub.keplr.app',
    'https://api-cosmoshub-ia.cosmosia.notional.ventures'
  ],
  'osmosis-mainnet': [
    'https://lcd-osmosis.keplr.app',
    'https://api-osmosis-ia.cosmosia.notional.ventures'
  ]
};

async function fetchDelegatorCount(lcdUrl: string, validatorAddress: string): Promise<number> {
  try {
    const url = `${lcdUrl}/cosmos/staking/v1beta1/validators/${validatorAddress}/delegations?pagination.limit=1&pagination.count_total=true`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return 0;
    
    const data = await response.json();
    return parseInt(data.pagination?.total || '0');
  } catch (error) {
    return 0;
  }
}

/**
 * Batch fetch delegator counts for multiple validators
 * Optimized to reduce 100+ individual requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { validators, chain } = body;

    if (!validators || !Array.isArray(validators) || !chain) {
      return NextResponse.json(
        { error: 'validators (array) and chain required' },
        { status: 400 }
      );
    }

    const endpoints = LCD_ENDPOINTS[chain] || LCD_ENDPOINTS['paxi-mainnet'];
    const lcdUrl = endpoints[0]; // Use primary endpoint
    
    console.log(`[Batch Delegators] Fetching counts for ${validators.length} validators on ${chain}`);
    
    // Process in batches of 10 for optimal performance
    const batchSize = 10;
    const results: Array<{ validator: string; count: number }> = [];
    
    for (let i = 0; i < validators.length; i += batchSize) {
      const batch = validators.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (validatorAddress: string) => {
          const count = await fetchDelegatorCount(lcdUrl, validatorAddress);
          return { validator: validatorAddress, count };
        })
      );
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < validators.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`[Batch Delegators] Complete: ${results.length} results`);
    
    return NextResponse.json({
      chain,
      total: validators.length,
      results
    });

  } catch (error) {
    console.error('Batch delegators error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegator counts' },
      { status: 500 }
    );
  }
}
