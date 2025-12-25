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
    const backendApiUrl = refresh 
      ? `${backendUrl}/api/prc20-tokens?chain=${chainName}&refresh=true`
      : `${backendUrl}/api/prc20-tokens?chain=${chainName}`;
      
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
    
    // Fetch verified tokens from backend (dynamic, no cache)
    let verifiedTokens: string[] = [];
    try {
      const verifyBackendUrl = `${backendUrl}/api/prc20/verify/list`;
      const verifyResponse = await fetch(verifyBackendUrl, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        verifiedTokens = verifyData.verified || [];
        console.log('✅ Loaded verified tokens:', verifiedTokens.length);
      }
    } catch (error) {
      console.error('⚠️ Failed to fetch verified tokens from backend');
      // No fallback - must use backend data only
    }
    
    // Transform to expected format
    const tokens = (data.tokens || []).map((token: any) => {
      const totalSupply = token.token_info?.total_supply || '0';
      const decimals = token.token_info?.decimals || 18;
      const isVerified = verifiedTokens.includes(token.contract_address);
      
      // Calculate price (mock for now - would come from price API)
      const randomPrice = Math.random() * 5;
      const price = randomPrice > 0.1 ? randomPrice : randomPrice * 0.01;
      const marketCap = (parseFloat(totalSupply) / Math.pow(10, decimals)) * price;
      
      return {
        address: token.contract_address,
        name: token.token_info?.name || 'Unknown Token',
        symbol: token.token_info?.symbol || '???',
        decimals: decimals,
        totalSupply: totalSupply,
        logoUrl: token.marketing_info?.logo?.url || '',
        website: token.marketing_info?.project || '',
        description: token.marketing_info?.description || '',
        verified: isVerified,
        chainId: chainName,
        price: price,
        priceChange24h: (Math.random() - 0.5) * 20, // Mock 24h change
        marketCap: marketCap,
        volume24h: marketCap * (Math.random() * 0.1), // Mock volume as % of market cap
        holders: token.num_holders || 0,
        liquidity: marketCap * (Math.random() * 0.3) // Mock liquidity
      };
    });

    console.log(`✅ Transformed ${tokens.length} tokens for swap page`);

    return NextResponse.json({
      success: true,
      tokens,
      total: tokens.length
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
