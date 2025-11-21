'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface PriceData {
  price: number;
  change24h: number;
  source: string;
}

interface PriceTrackerProps {
  selectedChain: ChainData | null;
}

// Mapping untuk token yang dikenal
const TOKEN_ID_MAP: { [key: string]: string } = {
  'atom': 'cosmos',
  'osmo': 'osmosis',
  'juno': 'juno-network',
  'lumera': 'lumera',
  'paxi': 'paxi',
  'axone': 'axone',
  'badge': 'bitbadges',
  'shido': 'shido',
  'tellor': 'tellor',
  'sunrise': 'sunrise',
  'human': 'human',
  'gitopia': 'gitopia',
  'kii': 'kiichain',
};

export default function PriceTracker({ selectedChain }: PriceTrackerProps) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedChain) {
      setPriceData(null);
      return;
    }

    // Skip testnet
    const chainName = selectedChain.chain_name.toLowerCase();
    if (chainName.includes('test') && !chainName.includes('mainnet')) {
      setPriceData(null);
      return;
    }

    const fetchPrice = async () => {
      setIsLoading(true);
      try {
        const symbol = selectedChain.assets?.[0]?.symbol?.toLowerCase();
        if (!symbol) {
          setPriceData(null);
          setIsLoading(false);
          return;
        }

        // Get CoinGecko ID from mapping or use symbol
        const coinGeckoId = TOKEN_ID_MAP[symbol] || symbol;

        // Strategy 1: Try CoinGecko with ID mapping
        try {
          const cgResponse = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&include_24hr_change=true`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (cgResponse.ok) {
            const cgData = await cgResponse.json();
            if (cgData[coinGeckoId]) {
              setPriceData({
                price: cgData[coinGeckoId].usd,
                change24h: cgData[coinGeckoId].usd_24h_change || 0,
                source: 'CoinGecko'
              });
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('CoinGecko failed');
        }

        // Strategy 2: Try Osmosis Zone API (for IBC tokens)
        try {
          const osmoResponse = await fetch(
            `https://api-osmosis.imperator.co/tokens/v2/${symbol}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (osmoResponse.ok) {
            const osmoData = await osmoResponse.json();
            if (osmoData[0] && osmoData[0].price) {
              setPriceData({
                price: parseFloat(osmoData[0].price),
                change24h: parseFloat(osmoData[0].price_24h_change || '0'),
                source: 'Osmosis'
              });
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Osmosis failed');
        }

        // Strategy 3: Try MEXC with multiple symbol formats
        const mexcSymbols = [
          `${symbol.toUpperCase()}USDT`,
          `${symbol.toUpperCase()}USDC`,
        ];

        for (const mexcSymbol of mexcSymbols) {
          try {
            const mexcResponse = await fetch(
              `https://api.mexc.com/api/v3/ticker/24hr?symbol=${mexcSymbol}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (mexcResponse.ok) {
              const mexcData = await mexcResponse.json();
              if (mexcData.lastPrice && parseFloat(mexcData.lastPrice) > 0) {
                setPriceData({
                  price: parseFloat(mexcData.lastPrice),
                  change24h: parseFloat(mexcData.priceChangePercent || '0'),
                  source: 'MEXC'
                });
                setIsLoading(false);
                return;
              }
            }
          } catch (e) {
            continue;
          }
        }

        // Strategy 4: Try Bitget
        const bitgetSymbols = [
          `${symbol.toUpperCase()}USDT`,
          `${symbol.toUpperCase()}USDC`,
        ];

        for (const bitgetSymbol of bitgetSymbols) {
          try {
            const bitgetResponse = await fetch(
              `https://api.bitget.com/api/spot/v1/market/ticker?symbol=${bitgetSymbol}`,
              { signal: AbortSignal.timeout(5000) }
            );
            if (bitgetResponse.ok) {
              const bitgetData = await bitgetResponse.json();
              if (bitgetData.data && bitgetData.data.close && parseFloat(bitgetData.data.close) > 0) {
                setPriceData({
                  price: parseFloat(bitgetData.data.close),
                  change24h: parseFloat(bitgetData.data.changeUtc || '0'),
                  source: 'Bitget'
                });
                setIsLoading(false);
                return;
              }
            }
          } catch (e) {
            continue;
          }
        }

        // Strategy 5: Try CoinGecko search by symbol
        try {
          const searchResponse = await fetch(
            `https://api.coingecko.com/api/v3/search?query=${symbol}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const coin = searchData.coins?.find((c: any) => 
              c.symbol?.toLowerCase() === symbol.toLowerCase()
            );
            
            if (coin && coin.id) {
              const priceResponse = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd&include_24hr_change=true`,
                { signal: AbortSignal.timeout(5000) }
              );
              if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                if (priceData[coin.id]) {
                  setPriceData({
                    price: priceData[coin.id].usd,
                    change24h: priceData[coin.id].usd_24h_change || 0,
                    source: 'CoinGecko'
                  });
                  setIsLoading(false);
                  return;
                }
              }
            }
          }
        } catch (e) {
          console.warn('CoinGecko search failed');
        }

        // If all failed
        setPriceData(null);
      } catch (error) {
        console.error('Error fetching price:', error);
        setPriceData(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchPrice();

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrice, 60000);

    return () => clearInterval(interval);
  }, [selectedChain]);

  if (!selectedChain || !priceData) {
    return null;
  }

  const isPositive = priceData.change24h >= 0;
  const symbol = selectedChain.assets?.[0]?.symbol || 'TOKEN';

  return (
    <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-gray-300">{symbol}</span>
        {isLoading && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        )}
      </div>
      
      <div className="flex items-center gap-3 pl-3 border-l border-gray-700">
        {/* Price */}
        <div>
          <div className="text-sm font-bold text-white">
            ${priceData.price < 0.01 
              ? priceData.price.toFixed(6) 
              : priceData.price < 1 
              ? priceData.price.toFixed(4)
              : priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500">{priceData.source}</div>
        </div>
        
        {/* 24h Change */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${
          isPositive 
            ? 'bg-green-500/10 text-green-400' 
            : 'bg-red-500/10 text-red-400'
        }`}>
          {isPositive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span className="text-xs font-semibold">
            {isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
