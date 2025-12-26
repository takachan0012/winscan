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
  verified?: boolean;
}

async function fetchPRC20NumHolders(lcdUrls: string[], contractAddress: string): Promise<number> {
  // Fetch all accounts with pagination - more reliable than num_accounts query
  // NOTE: LCD API limits responses to ~30 accounts per query regardless of limit parameter
  for (const lcdUrl of lcdUrls) {
    try {
      let totalAccounts = 0;
      let startAfter: string | undefined = undefined;
      let maxPages = 500; // With ~30 per page, this gives us up to 15,000 holders
      
      for (let page = 0; page < maxPages; page++) {
        const query: any = { all_accounts: { limit: 100 } };
        if (startAfter) {
          query.all_accounts.start_after = startAfter;
        }
        
        const queryBase64 = Buffer.from(JSON.stringify(query)).toString('base64');
        const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${queryBase64}`;

        const res = await fetch(url, { 
          signal: AbortSignal.timeout(8000),
          headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
          // If first page fails, try next LCD
          if (page === 0) break;
          // If later page fails, return what we have
          return totalAccounts;
        }

        const data = await res.json();
        const accounts = data.data?.accounts || [];
        
        if (accounts.length === 0) {
          // No more accounts, return total
          return totalAccounts;
        }
        
        totalAccounts += accounts.length;
        
        // LCD API returns ~30 accounts max per query
        // If we get less than 30, we've reached the end
        if (accounts.length < 30) {
          return totalAccounts;
        }
        
        // Set start_after to last account address
        startAfter = accounts[accounts.length - 1];
      }
      
      // If we hit max pages, return what we have
      if (totalAccounts > 0) {
        return totalAccounts;
      }
    } catch (error) {
      // Try next LCD endpoint
      continue;
    }
  }
  
  return 0;
}

async function fetchPRC20TokenInfo(lcdUrls: string[], contractAddress: string): Promise<TokenInfo | null> {
  const query = Buffer.from(JSON.stringify({ token_info: {} })).toString('base64');
  
  // Try each LCD endpoint
  for (const lcdUrl of lcdUrls) {
    try {
      const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}`;

      const res = await fetch(url, { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        return data.data as TokenInfo;
      }
    } catch (error) {
      // Try next endpoint
      continue;
    }
  }
  
  return null;
}

async function fetchPRC20MarketingInfo(lcdUrls: string[], contractAddress: string): Promise<MarketingInfo | null> {
  const query = Buffer.from(JSON.stringify({ marketing_info: {} })).toString('base64');
  
  // Try each LCD endpoint
  for (const lcdUrl of lcdUrls) {
    try {
      const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}`;

      const res = await fetch(url, { 
        signal: AbortSignal.timeout(5000),
        headers: {
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        return data.data as MarketingInfo;
      }
    } catch (error) {
      // Try next endpoint
      continue;
    }
  }
  
  return null;
}

async function fetchPRC20ContractAddresses(
  lcdUrls: string[], 
  count: number = 100, 
  key?: string
): Promise<{ next_key: string; contracts: string[] } | null> {
  // Try each LCD endpoint
  for (const lcdUrl of lcdUrls) {
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

      if (res.ok) {
        const data = await res.json();
        return {
          next_key: data.pagination?.next_key || '',
          contracts: data.contracts || []
        };
      }
    } catch (error) {
      // Try next endpoint
      continue;
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain') || 'paxi-mainnet';
    const forceRefresh = searchParams.get('refresh') === 'true';

    // For now, only support Paxi chain
    if (chain !== 'paxi-mainnet') {
      return NextResponse.json(
        { error: 'Only paxi-mainnet is supported for PRC20 tokens' },
        { status: 400 }
      );
    }

    // Prioritaskan backend dengan caching
    const backendUrls = [
      'https://ssl.winsnip.xyz',
      'https://ssl2.winsnip.xyz'
    ];
    
    // Try backend API with caching first
    for (const backendUrl of backendUrls) {
      try {
        // Use cache endpoint for instant response (auto-updates every 5 min)
        const response = await fetch(
          `${backendUrl}/api/prc20-tokens/cache`,
          {
            signal: AbortSignal.timeout(5000), // Reduced timeout - cache is instant
            headers: { 'Accept': 'application/json' }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ [PRC20] Fetched ${data.tokens?.length || 0} tokens from backend (cached: ${data.fromCache})`);
          
          return NextResponse.json(data, {
            headers: {
              'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800', // Cache 15 min
              'X-Data-Source': 'backend-cached'
            }
          });
        }
      } catch (error) {
        console.error(`Failed to fetch from backend ${backendUrl}:`, error);
        continue;
      }
    }

    console.log('⚠️ Backend unavailable, falling back to LCD (slower)');

    // Fallback ke LCD jika backend tidak tersedia
    const limit = parseInt(searchParams.get('limit') || '1000');
    const pageKey = searchParams.get('key') || undefined;

    // Paxi LCD endpoints - try multiple
    const lcdUrls = [
      'https://api-paxi.winnode.xyz',
      'https://mainnet-lcd.paxinet.io',
      'https://api-paxi-m.maouam.xyz',
      'https://ssl2.winsnip.xyz'
    ];

    console.log(`📦 Fetching PRC20 tokens for ${chain} (fetching all)`);

    // Step 1: Get ALL contract addresses with pagination
    let allContracts: string[] = [];
    let nextKey: string | undefined = pageKey;
    let pageCount = 0;
    const maxPages = 50; // Safety limit to prevent infinite loop
    
    while (pageCount < maxPages) {
      const contractsData = await fetchPRC20ContractAddresses(lcdUrls, 1000, nextKey);
      
      if (!contractsData) {
        if (pageCount === 0) {
          return NextResponse.json(
            { error: 'Failed to fetch contract addresses from all endpoints' },
            { status: 500 }
          );
        }
        break; // Stop if fetch fails but we already have some data
      }

      allContracts.push(...contractsData.contracts);
      console.log(`📦 Page ${pageCount + 1}: Fetched ${contractsData.contracts.length} contracts (Total: ${allContracts.length})`);
      
      if (!contractsData.next_key) {
        break; // No more pages
      }
      
      nextKey = contractsData.next_key;
      pageCount++;
    }

    console.log(`✅ Found ${allContracts.length} total contracts`);

    // Step 2: Fetch token info for each contract in parallel batches
    const tokens: PRC20Token[] = [];
    const BATCH_SIZE = 10; // Process 10 contracts at a time for faster loading
    
    for (let i = 0; i < allContracts.length; i += BATCH_SIZE) {
      const batch = allContracts.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (contractAddress) => {
          // Fetch token info and marketing only - holders will be lazy loaded on client side
          const [tokenInfo, marketingInfo] = await Promise.all([
            fetchPRC20TokenInfo(lcdUrls, contractAddress),
            fetchPRC20MarketingInfo(lcdUrls, contractAddress)
          ]);

          if (tokenInfo) {
            console.log(`  ✓ ${tokenInfo.symbol} (${tokenInfo.name})`);
            
            // Hardcoded verified tokens (will be replaced with backend API call)
            const verifiedTokens = [
              'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u', // COBRA
              'paxi1fka7t9avjmx7yphqxn3lzy3880tgcc0wu23xwfwxe5e5y3lkmzfqp07whx',
              'paxi1l2fvuecjpakxxh6k0mhpxzeln2veqpjs7znm8mfavuwx506v0qnsmpnt55',
              'paxi1ltd0maxmte3xf4zshta9j5djrq9cl692ctsp9u5q0p9wss0f5lmsu3zxf3'
            ];
            
            const token: PRC20Token = {
              contract_address: contractAddress,
              token_info: tokenInfo,
              marketing_info: marketingInfo,
              // num_holders will be lazy loaded on client side by PRC20HoldersCount component
              num_holders: undefined,
              verified: verifiedTokens.includes(contractAddress)
            };
            return token;
          }
          return null;
        })
      );
      
      // Add successful results to tokens array (filter out nulls)
      const validTokens = batchResults.filter((t) => t !== null) as PRC20Token[];
      tokens.push(...validTokens);
    }

    console.log(`✅ Successfully fetched ${tokens.length} PRC20 tokens`);

    return NextResponse.json({
      chain,
      tokens,
      total: tokens.length
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800', // Cache 15 min
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
