import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const consensus = searchParams.get('consensus');

    if (!chain || !consensus) {
      return NextResponse.json({ error: 'Chain and consensus parameters required' }, { status: 400 });
    }

    // Try backend API first
    const backendUrl = `${API_URL}/api/validators/uptime?chain=${chain}&consensus=${encodeURIComponent(consensus)}`;
    console.log('[Validators Uptime API] Fetching from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 10 }
    });

    if (!response.ok) {
      console.error('[Validators Uptime API] Backend error:', response.status);
      // Return default uptime if backend fails
      return NextResponse.json({ uptime: 100 });
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    console.error('[Validators Uptime API] Error:', error);
    // Return default uptime on error
    return NextResponse.json({ uptime: 100 });
  }
}
