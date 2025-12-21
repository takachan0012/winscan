import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contract = searchParams.get('contract');

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required' }, { status: 400 });
    }

    const lcdUrls = [
      'https://api-paxi.winnode.xyz',
      'https://mainnet-lcd.paxinet.io',
      'https://api-paxi-m.maouam.xyz',
      'https://ssl2.winsnip.xyz'
    ];

    // Quick count: Fetch only first 3 pages for fast response
    // For accurate count, use dedicated holders page
    const limit = searchParams.get('limit');
    const maxPages = limit === '1' ? 3 : 500; // Quick mode: 3 pages (~90 holders), Full mode: 500 pages
    
    let totalAccounts = 0;
    let hasMore = true;
    let nextKey: string | undefined = undefined;
    
    for (const lcdUrl of lcdUrls) {
      try {
        // console.log(`[Holders API] Fetching holders for ${contract} from ${lcdUrl}...`);
        
        for (let page = 0; page < maxPages && hasMore; page++) {
          const query: any = { all_accounts: { limit: 100 } };
          if (nextKey) {
            query.all_accounts.start_after = nextKey;
          }
          
          const queryBase64 = Buffer.from(JSON.stringify(query)).toString('base64');
          const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/${queryBase64}`;

          const res = await fetch(url, { 
            signal: AbortSignal.timeout(3000), // Shorter timeout
            headers: { 'Accept': 'application/json' }
          });

          if (res.ok) {
            const data = await res.json();
            const accounts = data.data?.accounts || [];
            totalAccounts += accounts.length;
            
            // console.log(`[Holders API] Page ${page + 1}: ${accounts.length} accounts (total: ${totalAccounts})`);
            
            // LCD API returns ~30 accounts max per query
            // If we get less than 30, we've reached the end
            if (accounts.length < 30) {
              hasMore = false;
              // console.log(`[Holders API] Last page reached`);
            } else {
              nextKey = accounts[accounts.length - 1];
            }
          } else {
            console.warn(`[Holders API] HTTP ${res.status} from ${lcdUrl}`);
            break;
          }
        }
        
        if (totalAccounts > 0) {
          // console.log(`[Holders API] ✅ Total holders for ${contract}: ${totalAccounts}${hasMore ? '+' : ''}`);
          return NextResponse.json({ 
            contract,
            count: totalAccounts,
            hasMore: hasMore // Indicate if there are more holders
          }, {
            headers: {
              'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800', // 10min cache
            }
          });
        }
      } catch (error: any) {
        console.error(`[Holders API] Error with ${lcdUrl}:`, error.message);
        continue;
      }
    }
    
    console.warn(`[Holders API] No holders data found for ${contract}`);
    return NextResponse.json({ contract, count: 0 });
    
    return NextResponse.json({ contract, count: 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
