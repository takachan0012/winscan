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

    // Fetch mint data (inflation, annual provisions) from LCD
    const response = await fetch(`${restEndpoint}/cosmos/mint/v1beta1/inflation`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`LCD request failed: ${response.status}`);
    }

    const inflationData = await response.json();
    
    // Also fetch annual provisions
    let annualProvisions = null;
    try {
      const provisionsResponse = await fetch(`${restEndpoint}/cosmos/mint/v1beta1/annual_provisions`, {
        headers: { 'Accept': 'application/json' }
      });
      if (provisionsResponse.ok) {
        const provisionsData = await provisionsResponse.json();
        annualProvisions = provisionsData.annual_provisions;
      }
    } catch (err) {
      console.log('Could not fetch annual provisions:', err);
    }

    return NextResponse.json({
      inflation: inflationData.inflation,
      annualProvisions
    });
  } catch (error: any) {
    console.error('Error fetching mint data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
