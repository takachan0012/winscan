import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Priority: Use backend API with cache/indexer
    const backendUrl = `${API_URL}/api/network/validators?chain=${chain}`;
    console.log('[Validators API] Fetching from backend:', backendUrl);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    try {
      const response = await fetch(backendUrl, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        next: { revalidate: 60 } // Cache 1 minute
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        
        // Return backend data (from cache or real-time)
        console.log(`[Validators API] ✅ Backend returned ${data.total_locations || 0} locations for ${chain} (cached: ${data.cached || false})`);
        
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
          }
        });
      } else {
        console.error('[Validators API] Backend error:', response.status, chain);
      }
    } catch (fetchError: any) {
      console.error('[Validators API] Backend fetch failed:', fetchError.message);
    } finally {
      clearTimeout(timeout);
    }

    // Fallback: Return empty data if backend fails
    console.warn('[Validators API] Returning empty data for', chain);
    return NextResponse.json({
      success: false,
      error: 'Chain not supported or backend unavailable',
      total_peers: 0,
      total_locations: 0,
      locations: []
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Validators API] Error:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.name === 'AbortError' ? 'Request timeout' : 'Internal server error',
      total_peers: 0,
      total_locations: 0,
      locations: []
    }, { status: 200 });
  }
}

