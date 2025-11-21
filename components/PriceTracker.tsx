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

export default function PriceTracker({ selectedChain }: PriceTrackerProps) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedChain) {
      setPriceData(null);
      return;
    }

    const chainName = selectedChain.chain_name.toLowerCase();
    if (chainName.includes('test') && !chainName.includes('mainnet')) {
      setPriceData(null);
      return;
    }

    const fetchPrice = async () => {
      setIsLoading(true);
      try {
        const symbol = selectedChain.assets?.[0]?.symbol?.toLowerCase();
        const coingeckoId = selectedChain.assets?.[0]?.coingecko_id;
        
        if (!symbol) {
          setPriceData(null);
          setIsLoading(false);
          return;
        }

        let priceResult: PriceData | null = null;

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
              priceResult = {
                price: token.price,
                change24h: token.price_24h_change || 0,
                source: 'Osmosis'
              };
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
                      priceResult = {
                        price: parseFloat(firstPrice),
                        change24h: 0,
                        source: 'Osmosis Pool'
                      };
                    }
                  }
                }
              } catch {}
            }
          }
        } catch {}

        if (!priceResult && coingeckoId) {
          try {
            const cgResponse = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
              { signal: AbortSignal.timeout(5000) }
            );
            
            if (cgResponse.ok) {
              const cgData = await cgResponse.json();
              if (cgData[coingeckoId]?.usd) {
                priceResult = {
                  price: cgData[coingeckoId].usd,
                  change24h: cgData[coingeckoId].usd_24h_change || 0,
                  source: 'CoinGecko'
                };
              }
            }
          } catch {}
        }

        if (!priceResult) {
          try {
            const pairs = [`${symbol.toUpperCase()}USDT`, `${symbol.toUpperCase()}USDC`];
            
            for (const pair of pairs) {
              const mexcResponse = await fetch(
                `https://api.mexc.com/api/v3/ticker/24hr?symbol=${pair}`,
                { signal: AbortSignal.timeout(5000) }
              );
              
              if (mexcResponse.ok) {
                const mexcData = await mexcResponse.json();
                if (mexcData.lastPrice) {
                  priceResult = {
                    price: parseFloat(mexcData.lastPrice),
                    change24h: parseFloat(mexcData.priceChangePercent || '0'),
                    source: 'MEXC'
                  };
                  break;
                }
              }
            }
          } catch {}
        }

        if (!priceResult) {
          try {
            const pairs = [`${symbol.toUpperCase()}USDT`, `${symbol.toUpperCase()}USDC`];
            
            for (const pair of pairs) {
              const bitgetResponse = await fetch(
                `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${pair}`,
                { signal: AbortSignal.timeout(5000) }
              );
              
              if (bitgetResponse.ok) {
                const bitgetData = await bitgetResponse.json();
                if (bitgetData.data?.[0]?.lastPr) {
                  priceResult = {
                    price: parseFloat(bitgetData.data[0].lastPr),
                    change24h: parseFloat(bitgetData.data[0].changeUtc24h || '0'),
                    source: 'Bitget'
                  };
                  break;
                }
              }
            }
          } catch {}
        }

        if (!priceResult) {
          const response = await fetch(`/api/price?symbol=${symbol}`, {
            signal: AbortSignal.timeout(10000),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.price) {
              priceResult = {
                price: data.price,
                change24h: data.change24h || 0,
                source: data.source + ' (Server)'
              };
            }
          }
        }

        setPriceData(priceResult);
      } catch (error) {
        setPriceData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
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
