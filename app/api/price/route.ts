import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let chainsDataCache: any[] | null = null;
let chainsDataTimestamp = 0;
const CHAINS_CACHE_TTL = 300000;

function loadChainsData() {
  const now = Date.now();
  if (chainsDataCache && (now - chainsDataTimestamp) < CHAINS_CACHE_TTL) {
    return chainsDataCache;
  }

  try {
    const chainsDir = path.join(process.cwd(), 'Chains');
    const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    
    chainsDataCache = files.map(file => {
      const content = fs.readFileSync(path.join(chainsDir, file), 'utf-8');
      return JSON.parse(content);
    });
    
    chainsDataTimestamp = now;
    return chainsDataCache;
  } catch (error) {
    console.error('Error loading chains data:', error);
    return [];
  }
}

// Fungsi untuk mendapatkan coingecko_id dari chains JSON
function getCoingeckoId(symbol: string): string | null {
  const chains = loadChainsData();
  const lowerSymbol = symbol.toLowerCase();
  
  for (const chain of chains) {
    if (chain.assets && Array.isArray(chain.assets)) {
      for (const asset of chain.assets) {
        if (asset.symbol?.toLowerCase() === lowerSymbol || asset.display?.toLowerCase() === lowerSymbol) {
          return asset.coingecko_id || null;
        }
      }
    }
  }
  
  return null;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const priceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60000;

function getCachedPrice(symbol: string) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedPrice(symbol: string, data: any) {
  priceCache.set(symbol, {
    data,
    timestamp: Date.now()
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toLowerCase();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const cachedData = getCachedPrice(symbol);
  if (cachedData) {
    return NextResponse.json(cachedData);
  }

  try {
    const coingeckoId = getCoingeckoId(symbol);
    
    if (!coingeckoId) {
      return NextResponse.json({ error: 'Token not found in chains data' }, { status: 404 });
    }

    try {
      const cgResponse = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
        { 
          signal: AbortSignal.timeout(5000),
          headers: { 'Accept': 'application/json' }
        }
      );
      
      if (cgResponse.ok) {
        const cgData = await cgResponse.json();
        if (cgData[coingeckoId]) {
          const result = {
            price: cgData[coingeckoId].usd,
            change24h: cgData[coingeckoId].usd_24h_change || 0,
            source: 'CoinGecko'
          };
          setCachedPrice(symbol, result);
          return NextResponse.json(result);
        }
      }
    } catch (e) {}

    const mexcSymbols = [`${symbol.toUpperCase()}USDT`, `${symbol.toUpperCase()}USDC`];
    for (const mexcSymbol of mexcSymbols) {
      try {
        const mexcResponse = await fetch(
          `https://api.mexc.com/api/v3/ticker/24hr?symbol=${mexcSymbol}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (mexcResponse.ok) {
          const mexcData = await mexcResponse.json();
          if (mexcData.lastPrice) {
            const result = {
              price: parseFloat(mexcData.lastPrice),
              change24h: parseFloat(mexcData.priceChangePercent || '0'),
              source: 'MEXC'
            };
            setCachedPrice(symbol, result);
            return NextResponse.json(result);
          }
        }
      } catch (e) {}
    }

    const bitgetSymbols = [`${symbol.toUpperCase()}USDT`, `${symbol.toUpperCase()}USDC`];
    for (const bitgetSymbol of bitgetSymbols) {
      try {
        const bitgetResponse = await fetch(
          `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${bitgetSymbol}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (bitgetResponse.ok) {
          const bitgetData = await bitgetResponse.json();
          if (bitgetData.data && bitgetData.data[0]) {
            const result = {
              price: parseFloat(bitgetData.data[0].lastPr),
              change24h: parseFloat(bitgetData.data[0].chgUTC || '0'),
              source: 'Bitget'
            };
            setCachedPrice(symbol, result);
            return NextResponse.json(result);
          }
        }
      } catch (e) {}
    }

  try {
    const osmoResponse = await fetch(
      `https://public-osmosis-api.numia.xyz/tokens/v2/all`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (osmoResponse.ok) {
      const osmoData = await osmoResponse.json();
      const token = osmoData.find((t: any) => 
        t.symbol?.toLowerCase() === symbol.toLowerCase()
      );
      if (token && token.price) {
        const result = {
          price: parseFloat(token.price),
          change24h: parseFloat(token.price_24h_change || '0'),
          source: 'Osmosis'
        };
        setCachedPrice(symbol, result);
        return NextResponse.json(result);
      } else if (token && token.denom) {
        try {
          const quoteResponse = await fetch(
            `https://sqs.osmosis.zone/tokens/prices?base=${encodeURIComponent(token.denom)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          
          if (quoteResponse.ok) {
            const quoteData = await quoteResponse.json();
            const basePrices = quoteData[token.denom];
            if (basePrices) {
              const firstPrice = Object.values(basePrices)[0] as string;
              if (firstPrice) {
                const result = {
                  price: parseFloat(firstPrice),
                  change24h: 0,
                  source: 'Osmosis Pool'
                };
                setCachedPrice(symbol, result);
                return NextResponse.json(result);
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  
  return NextResponse.json({ error: 'Price not found' }, { status: 404 });
  } catch (error) {
    console.error('Price fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
