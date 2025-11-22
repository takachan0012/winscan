import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chain = searchParams.get('chain');

  if (!chain) {
    return NextResponse.json({ error: 'Chain parameter is required' }, { status: 400 });
  }

  try {
    // Load chain config
    const fs = require('fs');
    const path = require('path');
    const chainsDir = path.join(process.cwd(), 'Chains');
    const files = fs.readdirSync(chainsDir).filter((f: string) => f.endsWith('.json') && f !== '_template.json');
    
    let selectedChain = null;
    for (const file of files) {
      const chainData = JSON.parse(fs.readFileSync(path.join(chainsDir, file), 'utf8'));
      if (chainData.chain_name === chain || chainData.chain_id === chain) {
        selectedChain = chainData;
        break;
      }
    }

    if (!selectedChain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const restEndpoint = selectedChain.apis?.rest?.[0]?.address || selectedChain.apis?.lcd?.[0]?.address;
    if (!restEndpoint) {
      return NextResponse.json({ error: 'No REST endpoint available' }, { status: 500 });
    }

    // Fetch community pool from LCD
    const response = await fetch(`${restEndpoint}/cosmos/distribution/v1beta1/community_pool`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`LCD request failed: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching community pool:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
