import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/prc20/metadata/batch
 * Batch fetch PRC20 token metadata
 * Body: { addresses: string[] } (max 100)
 * Returns: { tokens: { [address: string]: PRC20TokenMetadata | null } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addresses } = body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'addresses array is required' },
        { status: 400 }
      );
    }
    
    if (addresses.length === 0) {
      return NextResponse.json({ tokens: {} });
    }
    
    if (addresses.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 addresses per request' },
        { status: 400 }
      );
    }
    
    // Validate all addresses
    for (const addr of addresses) {
      if (typeof addr !== 'string' || !addr.startsWith('paxi1')) {
        return NextResponse.json(
          { error: `Invalid address format: ${addr}` },
          { status: 400 }
        );
      }
    }
    
    // Try backend API with load balancing
    const backendUrls = [
      'https://ssl.winsnip.xyz',
      'https://ssl2.winsnip.xyz'
    ];
    
    for (const baseUrl of backendUrls) {
      try {
        const response = await fetch(`${baseUrl}/api/prc20/metadata/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ addresses }),
          next: { revalidate: 3600 }
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
    
    // If backend unavailable, return empty/fallback
    const fallbackResponse: Record<string, any> = {};
    
    const verifiedTokens = [
      'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u',
      'paxi1fka7t9avjmx7yphqxn3lzy3880tgcc0wu23xwfwxe5e5y3lkmzfqp07whx',
      'paxi1l2fvuecjpakxxh6k0mhpxzeln2veqpjs7znm8mfavuwx506v0qnsmpnt55',
      'paxi1ltd0maxmte3xf4zshta9j5djrq9cl692ctsp9u5q0p9wss0f5lmsu3zxf3'
    ];
    
    addresses.forEach(addr => {
      fallbackResponse[addr] = {
        address: addr,
        verified: verifiedTokens.includes(addr),
      };
    });
    
    return NextResponse.json(
      { tokens: fallbackResponse },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
    
  } catch (error) {
    console.error('Error in batch metadata API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
