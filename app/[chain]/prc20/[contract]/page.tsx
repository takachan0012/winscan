'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { ArrowLeft, TrendingUp, Users, DollarSign, Droplets, Copy, CheckCircle2, ExternalLink, BarChart3 } from 'lucide-react';
import Image from 'next/image';

interface TokenDetails {
  contract_address: string;
  symbol: string;
  name: string;
  decimals: number;
  total_supply: string;
  holders: number;
  reserve_paxi?: number;
  reserve_prc20?: number;
  price_change?: number;
  volume?: number;
  buys?: number;
  sells?: number;
  txs?: number;
  logo?: string;
  description?: string;
  verified?: boolean;
}

interface PriceHistory {
  timestamp: number;
  price_paxi: number;
  price_usd: number;
  volume_paxi?: number;
}

interface VolumeData {
  volume_24h: {
    paxi: number;
    usd: number;
  };
  volume_7d: {
    paxi: number;
    usd: number;
  };
  buy_volume_24h?: number;
  sell_volume_24h?: number;
}

export default function PRC20TokenPage() {
  const params = useParams();
  const chainName = params.chain as string;
  const contractAddress = params.contract as string;

  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Load chain data
  useEffect(() => {
    async function loadChainData() {
      const cachedChains = sessionStorage.getItem('chains');
      
      if (cachedChains) {
        const data = JSON.parse(cachedChains);
        setChains(data);
        
        const chain = data.find((c: ChainData) => 
          c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
        );
        
        if (chain) setSelectedChain(chain);
      } else {
        const response = await fetch('/api/chains');
        const data = await response.json();
        sessionStorage.setItem('chains', JSON.stringify(data));
        setChains(data);
        
        const chain = data.find((c: ChainData) => 
          c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
        );
        
        if (chain) setSelectedChain(chain);
      }
    }
    loadChainData();
  }, [chainName]);

  // Fetch token data
  useEffect(() => {
    async function fetchTokenData() {
      if (!contractAddress) return;

      setLoading(true);
      
      try {
        // Try fetching from SSL cache first (fast)
        let details: any = null;
        
        try {
          const cacheRes = await fetch(`https://ssl.winsnip.xyz/api/prc20-tokens/cache`);
          if (cacheRes.ok) {
            const cacheData = await cacheRes.json();
            const token = cacheData.tokens?.find((t: any) => t.contract_address === contractAddress);
            
            if (token) {
              console.log('✅ Found token in cache:', token);
              setTokenDetails({
                contract_address: contractAddress,
                symbol: token.token_info?.symbol || 'UNKNOWN',
                name: token.token_info?.name || 'Unknown Token',
                decimals: token.token_info?.decimals || 6,
                total_supply: token.token_info?.total_supply || '0',
                holders: token.num_holders || 0,
                reserve_paxi: token.reserve_paxi,
                reserve_prc20: token.reserve_prc20,
                price_change: token.price_change_24h,
                volume: token.volume_24h,
                buys: token.buys,
                sells: token.sells,
                txs: token.txs_count,
                logo: token.marketing_info?.logo?.url,
                description: token.marketing_info?.description,
                verified: token.verified || false,
              });
              details = token; // Mark as found
            }
          }
        } catch (err) {
          console.warn('Cache fetch failed, trying Paxi API...', err);
        }
        
        // Fallback to Paxi API if not found in cache
        if (!details) {
          const detailsRes = await fetch(
            `https://mainnet-api.paxinet.io/prc20/get_contract?address=${contractAddress}`
          );
          
          if (detailsRes.ok) {
            details = await detailsRes.json();
            console.log('✅ Found token in Paxi API:', details);
            
            setTokenDetails({
              contract_address: contractAddress,
              symbol: details.symbol || 'UNKNOWN',
              name: details.name || 'Unknown Token',
              decimals: details.decimals || 6,
              total_supply: details.total_supply || '0',
              holders: details.holders || 0,
              reserve_paxi: details.reserve_paxi,
              reserve_prc20: details.reserve_prc20,
              price_change: details.price_change,
              volume: details.volume,
              buys: details.buys,
              sells: details.sells,
              txs: details.txs,
              logo: details.logo,
              description: details.description,
              verified: details.verified || false,
            });
          }
        }

        // Fetch price history from SSL backend
        const historyRes = await fetch(
          `https://ssl.winsnip.xyz/api/prc20-price-history/${contractAddress}?timeframe=24h`
        );
        
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (historyData.history && historyData.history.length > 0) {
            setPriceHistory(historyData.history);
          }
        }

        // Fetch volume data
        const volumeRes = await fetch(
          `https://ssl.winsnip.xyz/api/prc20-volume/${contractAddress}`
        );
        
        if (volumeRes.ok) {
          const volumeData = await volumeRes.json();
          setVolumeData(volumeData);
        }
        
      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTokenData();
  }, [contractAddress]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(num);
  };

  const formatSupply = (supply: string, decimals: number) => {
    if (!supply || supply === '0') return '0';
    
    try {
      const amount = BigInt(supply);
      const divisor = BigInt(10 ** decimals);
      const result = Number(amount) / Number(divisor);
      
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(result);
    } catch {
      return '0';
    }
  };

  // Calculate current price
  const currentPrice = tokenDetails?.reserve_paxi && tokenDetails?.reserve_prc20
    ? tokenDetails.reserve_paxi / tokenDetails.reserve_prc20
    : priceHistory.length > 0
    ? priceHistory[priceHistory.length - 1].price_paxi
    : 0;

  const currentPriceUSD = currentPrice * 0.10; // 1 PAXI = $0.10

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1">
        <Header 
          chains={chains}
          selectedChain={selectedChain} 
          onSelectChain={setSelectedChain}
        />
        
        <main className="p-6 pt-24">
          {/* Back Button */}
          <Link 
            href={`/${chainName}/assets`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Assets
          </Link>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
              <p className="text-gray-400 mt-4">Loading token data...</p>
            </div>
          ) : !tokenDetails ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Token not found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Token Header */}
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {tokenDetails.logo ? (
                      <Image 
                        src={tokenDetails.logo} 
                        alt={tokenDetails.symbol}
                        width={64}
                        height={64}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">
                          {tokenDetails.symbol.charAt(0)}
                        </span>
                      </div>
                    )}
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-white">{tokenDetails.symbol}</h1>
                        {tokenDetails.verified && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400 border border-yellow-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          PRC20
                        </span>
                      </div>
                      <p className="text-gray-400 mt-1">{tokenDetails.name}</p>
                      {tokenDetails.description && (
                        <p className="text-sm text-gray-500 mt-2 max-w-2xl">{tokenDetails.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Current Price */}
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">
                      {formatNumber(currentPrice)} <span className="text-sm text-gray-400">PAXI</span>
                    </div>
                    <div className="text-lg text-gray-400">
                      ${formatNumber(currentPriceUSD)}
                    </div>
                    {tokenDetails.price_change !== undefined && (
                      <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-lg text-sm font-bold ${
                        tokenDetails.price_change >= 0 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}>
                        <TrendingUp className="w-4 h-4" />
                        {tokenDetails.price_change >= 0 ? '+' : ''}{tokenDetails.price_change.toFixed(2)}% (24h)
                      </div>
                    )}
                  </div>
                </div>

                {/* Contract Address */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Contract Address:</span>
                    <div className="flex items-center gap-2">
                      <code className="px-3 py-1 bg-black/50 rounded text-xs text-gray-300 font-mono">
                        {contractAddress.substring(0, 20)}...{contractAddress.substring(contractAddress.length - 20)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(contractAddress)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Copy address"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <a
                        href={`/${chainName}/accounts/${contractAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title="View on explorer"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Holders */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-blue-500/10 rounded-lg p-3">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-2xl font-bold text-white">
                      {tokenDetails.holders.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-gray-400 text-sm">Holders</h3>
                </div>

                {/* Total Supply */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-purple-500/10 rounded-lg p-3">
                      <Droplets className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-2xl font-bold text-white">
                      {formatSupply(tokenDetails.total_supply, tokenDetails.decimals)}
                    </span>
                  </div>
                  <h3 className="text-gray-400 text-sm">Total Supply</h3>
                  <p className="text-xs text-gray-500 mt-1">{tokenDetails.symbol}</p>
                </div>

                {/* Volume 24h */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-green-500/10 rounded-lg p-3">
                      <BarChart3 className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-white">
                        {formatNumber(volumeData?.volume_24h?.paxi || tokenDetails.volume || 0)}
                      </span>
                      <span className="text-sm text-gray-400 ml-1">PAXI</span>
                    </div>
                  </div>
                  <h3 className="text-gray-400 text-sm">Volume (24h)</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    ${formatNumber(volumeData?.volume_24h?.usd || 0)}
                  </p>
                </div>

                {/* Liquidity */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-orange-500/10 rounded-lg p-3">
                      <DollarSign className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-white">
                        {formatNumber(tokenDetails.reserve_paxi || 0)}
                      </span>
                      <span className="text-sm text-gray-400 ml-1">PAXI</span>
                    </div>
                  </div>
                  <h3 className="text-gray-400 text-sm">Liquidity</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    ${formatNumber((tokenDetails.reserve_paxi || 0) * 0.10)}
                  </p>
                </div>
              </div>

              {/* Price Chart & Trading History */}
              {priceHistory.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Price History Chart */}
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">Price History (24h)</h2>
                    <div className="space-y-2">
                      {priceHistory.slice(-10).reverse().map((point, index) => {
                        const date = new Date(point.timestamp);
                        const timeStr = date.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        });
                        
                        return (
                          <div key={index} className="flex items-center justify-between py-2 border-b border-gray-800/50">
                            <span className="text-sm text-gray-400">{timeStr}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-white">
                                {point.price_paxi.toFixed(8)} PAXI
                              </span>
                              <span className="text-xs text-gray-500">
                                ${point.price_usd.toFixed(6)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="text-center pt-4">
                        <p className="text-xs text-gray-500">
                          Showing last 10 of {priceHistory.length} data points
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Volume History */}
                  {volumeData && (
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                      <h2 className="text-xl font-bold text-white mb-4">Volume Breakdown</h2>
                      <div className="space-y-4">
                        <div className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">24h Volume</span>
                            <span className="text-lg font-bold text-white">
                              {formatNumber(volumeData.volume_24h?.paxi || 0)} PAXI
                            </span>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            ${formatNumber(volumeData.volume_24h?.usd || 0)}
                          </div>
                        </div>

                        <div className="bg-black/30 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">7d Volume</span>
                            <span className="text-lg font-bold text-white">
                              {formatNumber(volumeData.volume_7d?.paxi || 0)} PAXI
                            </span>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            ${formatNumber(volumeData.volume_7d?.usd || 0)}
                          </div>
                        </div>

                        {(volumeData.buy_volume_24h || volumeData.sell_volume_24h) && (
                          <div className="bg-black/30 rounded-lg p-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-green-400">Buy Volume</span>
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(volumeData.buy_volume_24h || 0)} PAXI
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-red-400">Sell Volume</span>
                                <span className="text-sm font-medium text-white">
                                  {formatNumber(volumeData.sell_volume_24h || 0)} PAXI
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trading Stats */}
              {(tokenDetails.buys !== undefined || tokenDetails.sells !== undefined || tokenDetails.txs !== undefined) && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Trading Activity (24h)</h2>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {tokenDetails.buys || 0}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Buys</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">
                        {tokenDetails.sells || 0}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Sells</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {tokenDetails.txs || 0}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Transactions</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Swap Button */}
              <div className="flex justify-center">
                <Link
                  href={`/${chainName}/prc20/swap?token=${contractAddress}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg font-semibold text-white transition-all"
                >
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                  Trade on Swap
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
