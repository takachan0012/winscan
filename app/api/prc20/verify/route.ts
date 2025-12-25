import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Admin address for verification
const ADMIN_ADDRESS = 'paxi1ca0qjdysxqcxzjvxds66nxklnkw6mpc5etvy7d';

/**
 * PRC20 Token Verification API
 * GET /api/prc20/verify?address=<contract_address>
 * POST /api/prc20/verify - Admin only: Add token to verified list
 * 
 * This endpoint checks if a PRC20 token is verified.
 * Verified list is maintained in backend API.
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

/**
 * POST /api/prc20/verify
 * Admin only: Add a PRC-20 contract to verified list in backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, contractAddress, adminAddress } = body;

    // Validate admin
    if (adminAddress !== ADMIN_ADDRESS) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Validate inputs
    if (!contractAddress || !contractAddress.startsWith('paxi1')) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Send to backend API to add to verified list
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/verify',
      'https://ssl2.winsnip.xyz/api/prc20/verify'
    ];

    let lastError: any = null;

    for (const backendUrl of backendUrls) {
      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chain: chain || 'PAXI',
            contractAddress,
            adminAddress,
            action: 'add'
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            message: 'Contract added to verified list successfully',
            data
          });
        }

        lastError = await response.text();
      } catch (error: any) {
        lastError = error;
        continue;
      }
    }

    throw new Error(lastError?.message || 'All backend endpoints failed');

  } catch (error: any) {
    console.error('Error adding contract to verified list:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add contract to verified list' },
      { status: 500 }
    );
  }
}
