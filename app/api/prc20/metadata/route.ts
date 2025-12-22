import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/prc20/metadata?address={contract_address}
 * Fetch complete PRC20 token metadata from backend
 * Returns: { address, name, symbol, decimals, totalSupply, logo, description, verified, ... }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }
    
    // Validate bech32 format
    if (!address.startsWith('paxi1')) {
      return NextResponse.json(
        { error: 'Invalid contract address format' },
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
        const response = await fetch(`${baseUrl}/api/prc20/metadata/${address}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          next: { revalidate: 3600 } // Cache for 1 hour
        });
        
        if (response.ok) {
          const data = await response.json();
          
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from ${baseUrl}:`, error);
        continue;
      }
    }
    
    // If backend unavailable, fetch from blockchain
    const lcdResponse = await fetch(
      `https://mainnet-lcd.paxinet.io/cosmwasm/wasm/v1/contract/${address}/smart/eyJ0b2tlbl9pbmZvIjp7fX0=`,
      { next: { revalidate: 300 } }
    );
    
    if (lcdResponse.ok) {
      const lcdData = await lcdResponse.json();
      const tokenInfo = lcdData.data;
      
      // Check marketing info
      let marketingInfo = null;
      try {
        const marketingResponse = await fetch(
          `https://mainnet-lcd.paxinet.io/cosmwasm/wasm/v1/contract/${address}/smart/eyJtYXJrZXRpbmdfaW5mbyI6e319`,
          { next: { revalidate: 300 } }
        );
        if (marketingResponse.ok) {
          const marketingData = await marketingResponse.json();
          marketingInfo = marketingData.data;
        }
      } catch (e) {
        // Ignore marketing info errors
      }
      
      // Fallback to blockchain data only
      return NextResponse.json({
        address,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        totalSupply: tokenInfo.total_supply,
        logo: marketingInfo?.logo?.url || null,
        description: marketingInfo?.description || null,
        website: null,
        verified: [
          'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u',
          'paxi1fka7t9avjmx7yphqxn3lzy3880tgcc0wu23xwfwxe5e5y3lkmzfqp07whx',
          'paxi1l2fvuecjpakxxh6k0mhpxzeln2veqpjs7znm8mfavuwx506v0qnsmpnt55',
          'paxi1ltd0maxmte3xf4zshta9j5djrq9cl692ctsp9u5q0p9wss0f5lmsu3zxf3'
        ].includes(address), // Fallback verified tokens
        verifiedAt: null,
        verifiedBy: null,
        twitter: null,
        telegram: null,
        discord: null,
        coingeckoId: null,
        tags: [],
        updatedAt: new Date().toISOString(),
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch token metadata' },
      { status: 500 }
    );
    
  } catch (error) {
    console.error('Error in metadata API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
