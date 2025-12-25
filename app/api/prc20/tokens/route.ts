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
    
    // Note: Backend already combines official_verified (from Paxi API) + custom verified list
    // No need to fetch verified tokens separately anymore
    
    // Transform to expected format with real data from Paxi API
    const tokens = (data.tokens || []).map((token: any) => {
      const totalSupply = token.token_info?.total_supply || '0';
      const decimals = token.token_info?.decimals || 6;
      
      // Use real price from backend (already fetched from Paxi API)
      const price = token.price_usd || 0;
      const marketCap = price > 0 ? (parseFloat(totalSupply) / Math.pow(10, decimals)) * price : 0;
      
      // Calculate liquidity from reserves
      const reservePaxi = token.reserve_paxi || 0;
      const liquidity = reservePaxi / 1000000; // Convert to PAXI (6 decimals)
      
      return {
        address: token.contract_address,
        contract_address: token.contract_address, // Keep for backward compatibility
        token_info: token.token_info, // Include full token_info for UI access
        marketing_info: token.marketing_info, // Include full marketing_info for UI access
        name: token.token_info?.name || 'Unknown Token',
        symbol: token.token_info?.symbol || '???',
        decimals: decimals,
        totalSupply: totalSupply,
        logoUrl: token.marketing_info?.logo?.url || '',
        website: token.marketing_info?.project || '',
        description: token.marketing_info?.description || '',
        verified: token.verified || false, // Already combined official_verified + custom
        chainId: chainName,
        price: price,
        price_paxi: token.price_paxi || 0, // Add price_paxi
        price_usd: price, // Add price_usd
        priceChange24h: token.price_change_24h || 0,
        price_change_24h: token.price_change_24h || 0, // Keep original field name
        marketCap: marketCap,
        volume24h: token.volume_24h || 0, // Real volume from Paxi API
        volume_24h: token.volume_24h || 0, // Keep original field name
        holders: token.num_holders || 0,
        num_holders: token.num_holders || 0, // Keep original field name
        liquidity: liquidity, // Real liquidity from reserves
        liquidity_paxi: liquidity, // Keep original field name
        txsCount: token.txs_count || 0,
        buys: token.buys || 0,
        sells: token.sells || 0,
        isPump: token.is_pump || false
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
