import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Batch PRC20 Token Verification API
 * POST /api/prc20/verify/batch
 * Body: { addresses: string[] }
 * 
 * Returns verification status for multiple tokens at once
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addresses } = body;

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'Addresses array required' },
        { status: 400 }
      );
    }

    if (addresses.length === 0) {
      return NextResponse.json({ verified: {} });
    }

    // Limit batch size
    if (addresses.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 addresses per batch' },
        { status: 400 }
      );
    }

    // Validate all addresses
    for (const address of addresses) {
      if (!address.startsWith('paxi1') || address.length < 40) {
        return NextResponse.json(
          { error: `Invalid address format: ${address}` },
          { status: 400 }
        );
      }
    }

    // Backend API endpoints with load balancing
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/verify/batch',
      'https://ssl2.winsnip.xyz/api/prc20/verify/batch'
    ];

    let lastError: any = null;

    // Try each backend endpoint
    for (const backendUrl of backendUrls) {
      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ addresses }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            }
          });
        }

        lastError = await response.text();
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }

    // Fallback to hardcoded list if backend unavailable
    const verifiedTokens = [
      'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u', // COBRA
      'paxi1fka7t9avjmx7yphqxn3lzy3880tgcc0wu23xwfwxe5e5y3lkmzfqp07whx',
      'paxi1l2fvuecjpakxxh6k0mhpxzeln2veqpjs7znm8mfavuwx506v0qnsmpnt55',
      'paxi1ltd0maxmte3xf4zshta9j5djrq9cl692ctsp9u5q0p9wss0f5lmsu3zxf3'
    ];

    const verified: Record<string, boolean> = {};
    addresses.forEach((address: string) => {
      verified[address] = verifiedTokens.includes(address);
    });

    return NextResponse.json({
      verified,
      source: 'fallback'
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache fallback for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error batch checking verification:', error);
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
