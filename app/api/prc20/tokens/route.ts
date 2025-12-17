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

    // Fetch real PRC20 tokens from existing API
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}/api/prc20-tokens?chain=${chainName}&limit=100`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch PRC20 tokens');
    }

    const data = await response.json();
    
    // Verified tokens list (manually curated)
    const verifiedTokens = [
      'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u', // COBRA - First Token on Paxi
    ];
    
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
