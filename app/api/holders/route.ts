import { NextRequest, NextResponse } from 'next/server';
import { fetchJSONFromSSLBackend } from '@/lib/sslLoadBalancer';

const BACKEND_URL = process.env.BACKEND_API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const denom = searchParams.get('denom');
    const limit = searchParams.get('limit') || '200';
    const search = searchParams.get('search');

    if (!chain || !denom) {
      return NextResponse.json(
        { error: 'Missing required parameters: chain and denom' },
        { status: 400 }
      );
    }

    // Check if denom is a PRC20 contract address
    const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
    
    if (isPRC20) {
      // For PRC20 tokens, we need to query CosmWasm contract for holders
      // This is a placeholder - actual implementation would query the contract
      return NextResponse.json({
        denom: denom,
        totalSupply: '0',
        holders: [],
        count: 0,
        message: 'PRC20 token holders',
        note: 'Holder data for PRC20 tokens is coming soon. This requires querying the smart contract storage.'
      });
    }

    let path = `/api/holders?chain=${chain}&denom=${encodeURIComponent(denom)}&limit=${limit}`;
    
    if (search) {
      path += `&search=${encodeURIComponent(search)}`;
    }

    console.log('[Holders API] Fetching from backend with SSL load balancer');

    // Use SSL load balancer for automatic failover between ssl.winsnip.xyz and ssl2.winsnip.xyz
    const data = await fetchJSONFromSSLBackend(path);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Holders API] Error:', error.message);
    return NextResponse.json(
      { 
        error: 'Failed to fetch holders data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
