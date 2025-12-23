import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LCD_ENDPOINTS = [
  'https://mainnet-lcd.paxinet.io',
  'https://api-paxi.winnode.xyz',
  'https://api-paxi-m.maouam.xyz'
];

async function getWorkingLCD(): Promise<string> {
  for (const url of LCD_ENDPOINTS) {
    try {
      const testRes = await fetch(`${url}/cosmos/base/tendermint/v1beta1/node_info`, {
        signal: AbortSignal.timeout(3000)
      });
      if (testRes.ok) return url;
    } catch (error) {
      continue;
    }
  }
  return LCD_ENDPOINTS[0];
}

/**
 * Bundled API endpoint for PRC20 token detail
 * Returns: token_info, marketing_info, holders, liquidity, volume in one call
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contract = searchParams.get('contract');

    if (!contract) {
      return NextResponse.json({ error: 'Contract parameter required' }, { status: 400 });
    }

    // Validate contract address
    const contractRegex = /^paxi1[a-z0-9]{38,59}$/;
    if (!contractRegex.test(contract)) {
      return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 });
    }

    const lcdUrl = await getWorkingLCD();
    
    // Parallel fetch all data
    const [tokenInfoRes, marketingInfoRes, holdersRes, volumeRes] = await Promise.all([
      fetch(`${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/eyJ0b2tlbl9pbmZvIjp7fX0=`, {
        signal: AbortSignal.timeout(5000)
      }).catch(() => null),
      
      fetch(`${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/eyJtYXJrZXRpbmdfaW5mbyI6e319`, {
        signal: AbortSignal.timeout(5000)
      }).catch(() => null),
      
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/prc20-holders?contract=${encodeURIComponent(contract)}`, {
        signal: AbortSignal.timeout(5000)
      }).catch(() => null),
      
      fetch('https://ssl.winsnip.xyz/api/prc20-volume', {
        signal: AbortSignal.timeout(5000)
      }).catch(() => null)
    ]);

    // Parse responses
    const tokenInfo = tokenInfoRes?.ok ? (await tokenInfoRes.json()).data : null;
    const marketingInfo = marketingInfoRes?.ok ? (await marketingInfoRes.json()).data : null;
    const holdersData = holdersRes?.ok ? await holdersRes.json() : null;
    const volumeData = volumeRes?.ok ? await volumeRes.json() : null;

    // Find volume for this token
    let volume = null;
    if (volumeData?.volumes) {
      volume = volumeData.volumes.find((v: any) => v.contract === contract) || null;
    }

    // Find pool/liquidity - using cached pool data or fetch
    let liquidity = null;
    try {
      const poolsRes = await fetch('https://mainnet-lcd.paxinet.io/paxi/swap/all_pools?pagination.limit=500', {
        signal: AbortSignal.timeout(5000)
      });
      
      if (poolsRes.ok) {
        const poolsData = await poolsRes.json();
        const pool = poolsData.pools?.find((p: any) => 
          p.prc20 === contract || 
          p.prc20_address === contract || 
          p.token === contract || 
          p.contract_address === contract
        );
        
        if (pool?.reserve_paxi) {
          const paxiReserve = parseFloat(pool.reserve_paxi) / 1e6;
          liquidity = (paxiReserve * 2).toFixed(2);
        }
      }
    } catch (error) {
      console.error('Failed to fetch liquidity:', error);
    }

    // Bundle response
    return NextResponse.json({
      contract,
      token_info: tokenInfo,
      marketing_info: marketingInfo,
      holders: holdersData?.count || 0,
      liquidity,
      volume: volume ? {
        volume_24h_paxi: volume.volume_24h_paxi || 0,
        volume_24h_usd: volume.volume_24h_usd || 0,
        volume_7d_paxi: volume.volume_7d_paxi || 0,
        volume_7d_usd: volume.volume_7d_usd || 0
      } : null
    });

  } catch (error) {
    console.error('PRC20 detail bundle error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PRC20 details' },
      { status: 500 }
    );
  }
}
