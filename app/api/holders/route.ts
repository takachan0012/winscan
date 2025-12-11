import { NextRequest, NextResponse } from 'next/server';

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

    let url = `${BACKEND_URL}/api/holders?chain=${chain}&denom=${encodeURIComponent(denom)}&limit=${limit}`;
    
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }

    console.log('[Holders API] Fetching from backend:', url);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();
    
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
