import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
}

interface MarketingInfo {
  project?: string;
  description?: string;
  logo?: {
    url: string;
  };
  marketing?: string;
}

interface PRC20Token {
  contract_address: string;
  token_info: TokenInfo | null;
  marketing_info: MarketingInfo | null;
  num_holders?: number;
}

async function fetchPRC20NumHolders(lcdUrl: string, contractAddress: string): Promise<number> {
  try {
    // Try to query all_accounts with a high limit to get all holders
    // Note: This is expensive, ideally backend should cache this
    const query = Buffer.from(JSON.stringify({ 
      all_accounts: { 
        limit: 100  // Get up to 100 accounts
      } 
    })).toString('base64');
    
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}`;

    const res = await fetch(url, { 
      signal: AbortSignal.timeout(5000),
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      return 0;
    }

    const data = await res.json();
    
    // Count accounts returned
    const accounts = data.data?.accounts || [];
    const count = accounts.length;
    
    // If we got exactly 100, there might be more, but we'll show "100+"
    // For accurate count, we'd need to paginate through all accounts
    return count;
  } catch (error) {
    return 0;
  }
}

async function fetchPRC20TokenInfo(lcdUrl: string, contractAddress: string): Promise<TokenInfo | null> {
  try {
    const query = Buffer.from(JSON.stringify({ token_info: {} })).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}`;

    const res = await fetch(url, { 
      signal: AbortSignal.timeout(5000),
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.warn(`Failed to fetch token_info for ${contractAddress}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.data as TokenInfo;
  } catch (error) {
    console.error(`Error fetching token_info for ${contractAddress}:`, error);
    return null;
  }
}

async function fetchPRC20MarketingInfo(lcdUrl: string, contractAddress: string): Promise<MarketingInfo | null> {
  try {
    const query = Buffer.from(JSON.stringify({ marketing_info: {} })).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}`;

    const res = await fetch(url, { 
      signal: AbortSignal.timeout(5000),
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.data as MarketingInfo;
  } catch (error) {
    return null;
  }
}

async function fetchPRC20ContractAddresses(
  lcdUrl: string, 
  count: number = 100, 
  key?: string
): Promise<{ next_key: string; contracts: string[] } | null> {
  try {
    let url = `${lcdUrl}/cosmwasm/wasm/v1/code/1/contracts?pagination.limit=${count}`;
    
    if (key) {
      const encodedKey = encodeURIComponent(key);
      url += `&pagination.key=${encodedKey}`;
    }

    const res = await fetch(url, { 
      signal: AbortSignal.timeout(10000),
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch contracts: ${res.status}`);
    }

    const data = await res.json();

    return {
      next_key: data.pagination?.next_key || '',
      contracts: data.contracts || []
    };
  } catch (error) {
    console.error('Error fetching PRC20 contract addresses:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'paxi-mainnet';
    const limit = parseInt(searchParams.get('limit') || '20');
    const pageKey = searchParams.get('key') || undefined;

    // For now, only support Paxi chain
    if (chain !== 'paxi-mainnet') {
      return NextResponse.json(
        { error: 'Only paxi-mainnet is supported for PRC20 tokens' },
        { status: 400 }
      );
    }

    // Paxi LCD endpoints - try multiple
    const lcdUrls = [
      'https://mainnet-lcd.paxinet.io',
      'https://api-paxi.winnode.xyz',
      'https://api-paxi-m.maouam.xyz'
    ];
    
    let lcdUrl = lcdUrls[0];
    
    // Test which LCD endpoint is working
    for (const url of lcdUrls) {
      try {
        const testRes = await fetch(`${url}/cosmos/base/tendermint/v1beta1/node_info`, {
          signal: AbortSignal.timeout(3000)
        });
        if (testRes.ok) {
          lcdUrl = url;
          console.log(`✅ Using LCD endpoint: ${lcdUrl}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    console.log(`📦 Fetching PRC20 tokens for ${chain} (limit: ${limit}) from ${lcdUrl}`);

    // Step 1: Get contract addresses
    const contractsData = await fetchPRC20ContractAddresses(lcdUrl, limit, pageKey);
    
    if (!contractsData) {
      return NextResponse.json(
        { error: 'Failed to fetch contract addresses' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${contractsData.contracts.length} contracts`);

    // Step 2: Fetch token info and marketing info for each contract
    const tokens: PRC20Token[] = [];
    
    for (const contractAddress of contractsData.contracts) {
      const [tokenInfo, marketingInfo, numHolders] = await Promise.all([
        fetchPRC20TokenInfo(lcdUrl, contractAddress),
        fetchPRC20MarketingInfo(lcdUrl, contractAddress),
        fetchPRC20NumHolders(lcdUrl, contractAddress)
      ]);

      // Only include if we got token info
      if (tokenInfo) {
        tokens.push({
          contract_address: contractAddress,
          token_info: tokenInfo,
          marketing_info: marketingInfo,
          num_holders: numHolders
        });
        
        console.log(`  ✓ ${tokenInfo.symbol} (${tokenInfo.name}) - ${numHolders} holders`);
      }
    }

    console.log(`✅ Successfully fetched ${tokens.length} PRC20 tokens`);

    return NextResponse.json({
      chain,
      tokens,
      pagination: {
        next_key: contractsData.next_key,
        has_more: !!contractsData.next_key
      },
      total: tokens.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    });

  } catch (error: any) {
    console.error('❌ PRC20 tokens API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
