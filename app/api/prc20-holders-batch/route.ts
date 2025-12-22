import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

/**
 * Batch PRC20 Holders API
 * POST /api/prc20-holders-batch
 * Body: { contracts: string[] }
 * Returns: Array of holder counts for PRC20 tokens
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contracts } = body;

    if (!Array.isArray(contracts) || contracts.length === 0) {
      return NextResponse.json({ 
        error: 'Contracts array required' 
      }, { status: 400 });
    }

    console.log(`[PRC20 Holders Batch API] Fetching holders for ${contracts.length} contracts`);

    // Fetch all PRC20 holders in parallel (with concurrency limit)
    const BATCH_SIZE = 10;
    const results: any[] = [];
    
    for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
      const batch = contracts.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (contract) => {
        try {
          const backendUrl = `${API_URL}/api/prc20-holders?contract=${encodeURIComponent(contract)}`;
          const response = await fetch(backendUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (!response.ok) {
            console.error(`[PRC20 Holders Batch] Failed for ${contract}:`, response.status);
            return { contract, count: 0, error: 'Failed to fetch', success: false };
          }

          const data = await response.json();
          return { 
            contract, 
            count: data?.count || 0,
            success: true 
          };
        } catch (error: any) {
          console.error(`[PRC20 Holders Batch] Error for ${contract}:`, error.message);
          return { 
            contract, 
            count: 0, 
            error: error.message,
            success: false 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    console.log(`[PRC20 Holders Batch API] Completed ${results.length} requests`);

    return NextResponse.json({
      total: results.length,
      results
    });

  } catch (error: any) {
    console.error('[PRC20 Holders Batch API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
