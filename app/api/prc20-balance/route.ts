import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory cache for balance queries (1 minute TTL)
const balanceCache = new Map<string, { balance: any; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds

// Paxi LCD endpoints with failover
const LCD_ENDPOINTS = [
  'https://mainnet-lcd.paxinet.io',
  'https://api-paxi.winnode.xyz',
  'https://api-paxi-m.maouam.xyz'
];

async function queryWithRetry(url: string, retries: number = 1): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000) // Reduced from 10s to 5s
      });
      
      if (response.ok) {
        return response;
      }
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        return null;
      }
      
      // Retry on 5xx (server errors)
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms
        console.log(`[PRC20 Balance] Retrying (${i + 1}/${retries})...`);
      }
    } catch (error) {
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms
        console.log(`[PRC20 Balance] Retrying after error (${i + 1}/${retries})...`);
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contract = searchParams.get('contract');
    const address = searchParams.get('address');

    console.log('[PRC20 Balance] Request:', { contract, address });

    if (!contract || !address) {
      return NextResponse.json(
        { error: 'Contract and address parameters required' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${contract}:${address}`;
    const cached = balanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[PRC20 Balance] Cache hit for', cacheKey);
      return NextResponse.json(cached.balance, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'X-Cache': 'HIT'
        }
      });
    }

    // Validate contract address format (bech32 format: paxi1...)
    // Prevents SSRF by ensuring contract doesn't contain path traversal or URL manipulation characters
    const contractRegex = /^paxi1[a-z0-9]{38,59}$/;
    if (!contractRegex.test(contract)) {
      return NextResponse.json(
        { error: 'Invalid contract address format. Expected bech32 format (paxi1...)' },
        { status: 400 }
      );
    }

    // Validate address format (bech32 format)
    // Prevents injection of path traversal characters (/, \, .., etc.)
    const addressRegex = /^[a-z0-9]{1,83}1[a-z0-9]{38,59}$/;
    if (!addressRegex.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format. Expected bech32 format' },
        { status: 400 }
      );
    }

    // Query balance for specific address
    const queryObj = {
      balance: {
        address: address
      }
    };

    // Encode query to base64
    const queryJson = JSON.stringify(queryObj);
    const base64Query = Buffer.from(queryJson).toString('base64');
    console.log('[PRC20 Balance] Query JSON:', queryJson);
    console.log('[PRC20 Balance] Query Base64:', base64Query);
    
    // Try each LCD endpoint with retry logic
    let response: Response | null = null;
    let lastError: any = null;
    
    for (const lcdUrl of LCD_ENDPOINTS) {
      try {
        const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/${base64Query}`;
        console.log(`[PRC20 Balance] Trying ${lcdUrl}...`);
        response = await queryWithRetry(url);
        
        if (response) {
          const data = await response.json();
          console.log(`[PRC20 Balance] Success from ${lcdUrl}:`, JSON.stringify(data));
          
          // Cache the result
          balanceCache.set(cacheKey, {
            balance: data.data,
            timestamp: Date.now()
          });
          
          // Clean up old cache entries (keep cache size reasonable)
          if (balanceCache.size > 1000) {
            const oldestKey = balanceCache.keys().next().value;
            if (oldestKey) {
              balanceCache.delete(oldestKey);
            }
          }
          
          return NextResponse.json(data.data, {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              'X-Cache': 'MISS'
            }
          });
        }
        console.log(`[PRC20 Balance] No response from ${lcdUrl}`);
      } catch (error: any) {
        lastError = error;
        console.error(`[PRC20 Balance] ${lcdUrl} failed:`, error.message);
        continue;
      }
    }
    
    // All endpoints failed
    console.error('[PRC20 Balance] All LCD endpoints failed:', lastError);
    return NextResponse.json(
      { balance: '0' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[PRC20 Balance] Unexpected error:', error);
    return NextResponse.json(
      { balance: '0' },
      { status: 200 }
    );
  }
}
