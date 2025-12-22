import { NextRequest, NextResponse } from 'next/server';
import { fetchJSONFromSSLBackend } from '@/lib/sslLoadBalancer';

const BACKEND_URL = process.env.BACKEND_API_URL || 'https://ssl.winsnip.xyz';

/**
 * Batch Holders Count API
 * POST /api/holders-batch
 * Body: { chain: string, denoms: string[] }
 * Returns: Array of holder counts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, denoms } = body;

    if (!chain || !Array.isArray(denoms) || denoms.length === 0) {
      return NextResponse.json({ 
        error: 'Chain and denoms array required' 
      }, { status: 400 });
    }

    console.log(`[Holders Batch API] Fetching holders for ${denoms.length} denoms on ${chain}`);

    // Fetch all holders in parallel (with concurrency limit)
    const BATCH_SIZE = 10;
    const results: any[] = [];
    
    for (let i = 0; i < denoms.length; i += BATCH_SIZE) {
      const batch = denoms.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (denom) => {
        try {
          const path = `/api/holders?chain=${chain}&denom=${encodeURIComponent(denom)}&limit=1`;
          const data = await fetchJSONFromSSLBackend(path);
          
          return { 
            denom, 
            count: data?.count || 0,
            success: true 
          };
        } catch (error: any) {
          console.error(`[Holders Batch] Error for ${denom}:`, error.message);
          return { 
            denom, 
            count: 0, 
            error: error.message,
            success: false 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    console.log(`[Holders Batch API] Completed ${results.length} requests`);

    return NextResponse.json({
      chain,
      total: results.length,
      results
    });

  } catch (error: any) {
    console.error('[Holders Batch API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
