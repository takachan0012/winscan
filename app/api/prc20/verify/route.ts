import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * PRC20 Token Verification API
 * GET /api/prc20/verify?address=<contract_address>
 * 
 * This endpoint checks if a PRC20 token is verified.
 * Currently uses backend API for verification status.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter required' },
        { status: 400 }
      );
    }

    // Validate address format (bech32 paxi1...)
    if (!address.startsWith('paxi1') || address.length < 40) {
      return NextResponse.json(
        { error: 'Invalid contract address format' },
        { status: 400 }
      );
    }

    // Backend API endpoints with load balancing
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/verify',
      'https://ssl2.winsnip.xyz/api/prc20/verify'
    ];

    let lastError: any = null;

    // Try each backend endpoint
    for (const backendUrl of backendUrls) {
      try {
        const response = await fetch(`${backendUrl}?address=${encodeURIComponent(address)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            address,
            verified: data.verified || false,
            verifiedAt: data.verifiedAt,
            verifiedBy: data.verifiedBy,
            reason: data.reason
          }, {
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

    return NextResponse.json({
      address,
      verified: verifiedTokens.includes(address),
      source: 'fallback'
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache fallback for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error checking verification status:', error);
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
