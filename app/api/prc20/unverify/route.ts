import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Admin address for verification
const ADMIN_ADDRESS = 'paxi1ca0qjdysxqcxzjvxds66nxklnkw6mpc5etvy7d';

/**
 * POST /api/prc20/unverify
 * Admin only: Remove a PRC-20 contract from verified list in backend
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

    // Send to backend API to remove from verified list
    const backendUrls = [
      'https://ssl.winsnip.xyz/api/prc20/unverify',
      'https://ssl2.winsnip.xyz/api/prc20/unverify'
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
            action: 'remove'
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            message: 'Contract removed from verified list successfully',
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
    console.error('Error removing contract from verified list:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove contract from verified list' },
      { status: 500 }
    );
  }
}
