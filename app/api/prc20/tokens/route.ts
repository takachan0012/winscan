import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');
    const chain = searchParams.get('chain');
    
    // Use existing PRC20 tokens API to get real data
    const chainName = chain || chainId;
    
    if (!chainName) {
      return NextResponse.json({
        success: false,
        error: 'Chain parameter required',
        tokens: [],
        total: 0
      }, { status: 400 });
    }

    // Check if refresh is requested (force cache bypass)
    const refresh = searchParams.get('refresh') === 'true' || searchParams.get('t'); // t param for cache bust

    // Fetch real PRC20 tokens from backend SSL API directly
    const backendUrl = process.env.BACKEND_API_URL || 'https://ssl.winsnip.xyz';
    // Use cache endpoint for instant response (refresh param not needed as backend auto-updates every 5 min)
    const backendApiUrl = `${backendUrl}/api/prc20-tokens/cache`;
      
    const response = await fetch(backendApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh from backend
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch PRC20 tokens');
    }

    const data = await response.json();
    
    // Return data as-is from backend - frontend will handle transformation
    // This avoids double division issues with reserve_paxi
    return NextResponse.json({
      success: true,
      tokens: data.tokens || [],
      total: (data.tokens || []).length
    });

  } catch (error) {
    console.error('Error fetching PRC20 tokens:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tokens',
      tokens: [],
      total: 0
    }, { status: 500 });
  }
}
