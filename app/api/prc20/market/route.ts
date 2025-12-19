import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/prc20/market?chain={chain_id}
 * Fetch 24h price change data for PRC20 tokens from pool history
 * Returns: { [contract_address]: { price_usd: number, price_change_24h: number, volume_24h: number } }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    
    if (!chain || chain !== 'paxi-mainnet') {
      return NextResponse.json(
        { error: 'Only paxi-mainnet is supported' },
        { status: 400 }
      );
    }
    
    // Try backend API with load balancing
    const backendUrls = [
      'https://ssl.winsnip.xyz',
      'https://ssl2.winsnip.xyz'
    ];
    
    for (const baseUrl of backendUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/prc20/market?chain=${chain}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          next: { revalidate: 300 } // Cache for 5 minutes
        });
        
        if (response.ok) {
          const data = await response.json();
          
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from ${baseUrl}:`, error);
        continue;
      }
    }
    
    // Backend unavailable - calculate from current pools
    try {
      const poolsResponse = await fetch(
        'https://mainnet-lcd.paxinet.io/paxi/swap/all_pools',
        { signal: AbortSignal.timeout(5000), next: { revalidate: 60 } }
      );
      
      if (!poolsResponse.ok) {
        throw new Error('Failed to fetch pools');
      }
      
      const poolsData = await poolsResponse.json();
      const pools = poolsData.pools || poolsData.result?.pools || poolsData;
      
      if (!Array.isArray(pools)) {
        throw new Error('Invalid pools data');
      }
      
      // Extract prices from pool data (already calculated by backend)
      const marketData: Record<string, any> = {};
      
      pools.forEach((pool: any) => {
        const prc20Address = pool.prc20 || pool.prc20_address || pool.token || pool.contract_address;
        
        if (!prc20Address) return;
        
        try {
          // Use price_prc20_per_paxi from pool - this is the correct price in PAXI
          const priceInPaxi = parseFloat(pool.price_prc20_per_paxi || pool.pricePrc20PerPaxi || '0');
          
          // Get reserves for liquidity info
          const paxiReserve = parseFloat(pool.reserve_paxi || '0') / 1e6;
          const tokenReserve = parseFloat(pool.reserve_prc20 || '0') / 1e6;
          
          if (priceInPaxi > 0) {
            marketData[prc20Address] = {
              price_paxi: priceInPaxi, // Price of 1 PRC20 token in PAXI (not USD)
              price_usd: priceInPaxi, // Kept for backward compatibility
              price_change_24h: 0, // No historical data from LCD
              volume_24h: 0, // No volume data from LCD
              liquidity_paxi: paxiReserve,
              liquidity_token: tokenReserve,
              last_updated: new Date().toISOString()
            };
          }
        } catch (error) {
          console.error(`Error extracting price for ${prc20Address}:`, error);
        }
      });
      
      return NextResponse.json(marketData, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'X-Data-Source': 'fallback-current-pools'
        },
      });
      
    } catch (error) {
      console.error('Error fetching pool data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch market data' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in market API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
