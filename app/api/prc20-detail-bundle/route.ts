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

    // 🚀 NEW: Fetch from Backend SSL (already has Paxi API data processed)
    let tokenInfo = null;
    let marketingInfo = null;
    let holdersData = null;
    let volume = null;
    let liquidity = null;
    let verified = false;
    
    try {
      // Fetch from backend SSL - has all data from Paxi API + fallbacks
      const backendUrl = process.env.BACKEND_API_URL || 'https://ssl.winsnip.xyz';
      const backendRes = await fetch(
        `${backendUrl}/api/prc20-tokens?chain=paxi-mainnet`,
        { signal: AbortSignal.timeout(10000), cache: 'no-store' }
      );
      
      if (backendRes.ok) {
        const backendData = await backendRes.json();
        const tokenData = backendData.tokens?.find((t: any) => t.contract_address === contract);
        
        if (tokenData) {
          // Extract data from backend response
          tokenInfo = tokenData.token_info || null;
          marketingInfo = tokenData.marketing_info || null;
          holdersData = { count: tokenData.num_holders || 0 };
          
          // Verified status (already combined: official_verified + custom)
          verified = tokenData.verified === true;
          
          // Volume data from backend
          volume = {
            volume_24h_paxi: tokenData.volume_24h || 0,
            volume_24h_usd: 0,
            volume_7d_paxi: tokenData.volume_24h || 0, // Use 24h as fallback
            volume_7d_usd: 0
          };
          
          // Liquidity from reserves
          if (tokenData.reserve_paxi) {
            const paxiReserve = parseFloat(tokenData.reserve_paxi) / 1e6;
            liquidity = (paxiReserve * 2).toFixed(2);
          }
        }
      }
    } catch (error) {
      console.warn('Backend SSL failed, falling back to LCD:', error);
    }
    
    // Fallback to LCD if Paxi API failed
    if (!tokenInfo || !marketingInfo) {
      const lcdUrl = await getWorkingLCD();
      
      const [tokenInfoRes, marketingInfoRes] = await Promise.all([
        fetch(`${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/eyJ0b2tlbl9pbmZvIjp7fX0=`, {
          signal: AbortSignal.timeout(5000)
        }).catch(() => null),
        
        fetch(`${lcdUrl}/cosmwasm/wasm/v1/contract/${contract}/smart/eyJtYXJrZXRpbmdfaW5mbyI6e319`, {
          signal: AbortSignal.timeout(5000)
        }).catch(() => null)
      ]);
      
      if (!tokenInfo && tokenInfoRes?.ok) {
        tokenInfo = (await tokenInfoRes.json()).data;
      }
      if (!marketingInfo && marketingInfoRes?.ok) {
        marketingInfo = (await marketingInfoRes.json()).data;
      }
      
      // Fallback: Fetch holders from backend if Paxi API didn't return holders
      if (!holdersData || holdersData.count === 0) {
        try {
          const backendUrl = process.env.BACKEND_API_URL || 'https://ssl.winsnip.xyz';
          const holdersRes = await fetch(
            `${backendUrl}/api/prc20-holders?contract=${contract}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (holdersRes.ok) {
            const holdersJson = await holdersRes.json();
            holdersData = { count: holdersJson.count || 0 };
          }
        } catch (error) {
          console.warn('Failed to fetch holders from backend:', error);
        }
      }
    }

    // Note: Backend SSL already combines official_verified + custom verified list
    // No need to check separately

    // Bundle response
    return NextResponse.json({
      contract,
      token_info: tokenInfo,
      marketing_info: marketingInfo,
      holders: holdersData?.count || 0,
      liquidity,
      verified, // Include verified status
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
