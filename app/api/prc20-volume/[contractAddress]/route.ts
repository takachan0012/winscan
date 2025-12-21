import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { contractAddress: string } }
) {
  const contractAddress = params.contractAddress;
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get('timeframe') || '24h';

  try {
    const backendUrl = `https://ssl.winsnip.xyz/api/prc20-volume/${contractAddress}?timeframe=${timeframe}`;
    
    const response = await fetch(backendUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Volume data not found' },
          { status: 404 }
        );
      }
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PRC20 Volume API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch volume data' },
      { status: 500 }
    );
  }
}
