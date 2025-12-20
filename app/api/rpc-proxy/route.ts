import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Universal RPC Proxy to bypass CORS restrictions
 * Acts as a transparent proxy for any RPC request
 */
export async function POST(request: NextRequest) {
  try {
    // Get target RPC URL from query parameter
    const searchParams = request.nextUrl.searchParams;
    const targetRpc = searchParams.get('target');
    
    if (!targetRpc) {
      return NextResponse.json(
        { error: 'target RPC URL is required as query parameter' },
        { status: 400 }
      );
    }

    // Security: Only allow whitelisted RPC domains
    const allowedDomains = [
      'rpc.testnet.safrochain.com',
      'rpc-safrochain-t.sychonix.com',
      'safrochain.test.rpc.nodeshub.online',
      'rpc-t.safrochain.nodestake.org',
      'rpc-safrochain-testnet.cosmos-spaces.cloud',
      'rpc.testnet.lumera.network',
      'rpc.testnet.empeiria.io',
    ];

    try {
      const url = new URL(targetRpc);
      if (!allowedDomains.some(domain => url.hostname.includes(domain))) {
        return NextResponse.json(
          { error: 'RPC endpoint not allowed' },
          { status: 403 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid target URL' },
        { status: 400 }
      );
    }

    // Forward the entire request body as-is
    const body = await request.text();

    // Forward the RPC request
    const response = await fetch(targetRpc, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RPC Proxy] Error response from ${targetRpc}:`, response.status, errorText);
      throw new Error(`RPC request failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error: any) {
    console.error('[RPC Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'RPC proxy request failed',
        jsonrpc: '2.0',
        id: -1,
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetRpc = searchParams.get('target');
  
  if (!targetRpc) {
    return NextResponse.json(
      { error: 'target RPC URL is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(targetRpc, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error: any) {
    console.error('[RPC Proxy GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'RPC proxy request failed' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
