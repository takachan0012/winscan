import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ChainData {
  chain_name: string;
  chain_id?: string;
  api?: Array<{ address: string; provider?: string }>;
  assets?: Array<{ base?: string; denom_units?: Array<{ denom: string; exponent: number }> }>;
}

function loadChainsData(): ChainData[] {
  const chainsDir = path.join(process.cwd(), 'Chains');
  const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  return files.map(file => {
    const content = fs.readFileSync(path.join(chainsDir, file), 'utf-8');
    return JSON.parse(content);
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter is required' }, { status: 400 });
    }

    const chainsData = loadChainsData();
    const chainConfig = chainsData.find((c: ChainData) => 
      c.chain_name === chain || 
      c.chain_id === chain ||
      c.chain_name.toLowerCase() === chain.toLowerCase() ||
      c.chain_id?.toLowerCase() === chain.toLowerCase() ||
      c.chain_name.toLowerCase().replace(/\s+/g, '-') === chain.toLowerCase()
    );

    if (!chainConfig) {
      console.log(`Chain not found: ${chain}. Available chains: ${chainsData.map(c => c.chain_id || c.chain_name).join(', ')}`);
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const lcdEndpoints = chainConfig.api || [];
    if (lcdEndpoints.length === 0) {
      return NextResponse.json({ error: 'No LCD endpoints available' }, { status: 500 });
    }

    for (const endpoint of lcdEndpoints) {
      try {
        const supplyUrl = `${endpoint.address}/cosmos/bank/v1beta1/supply`;
        console.log(`Fetching supply from: ${supplyUrl}`);

        const response = await fetch(supplyUrl, {
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          console.log(`${endpoint.provider}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();

        const supply = data.supply || [];
        const mainDenom = chainConfig.assets?.[0]?.base || supply[0]?.denom;
        const mainSupply = supply.find((s: any) => s.denom === mainDenom);
        
        const totalSupply = mainSupply?.amount || '0';

        console.log(`✓ Supply from ${endpoint.provider}: ${totalSupply}`);

        return NextResponse.json({
          totalSupply,
          denom: mainDenom,
          allSupply: supply
        });

      } catch (error: any) {
        console.error(`${endpoint.provider || endpoint.address}: ${error.message}`);
        continue;
      }
    }

    return NextResponse.json(
      { error: 'All LCD endpoints failed' },
      { status: 500 }
    );

  } catch (error: any) {
    console.error('Error fetching supply:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch supply data', details: error.message },
      { status: 500 }
    );
  }
}
