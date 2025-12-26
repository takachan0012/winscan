'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { ArrowLeft, Coins, ExternalLink, Copy, Check, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import PRC20PriceChart from '@/components/PRC20PriceChart';

interface DenomUnit {
  denom: string;
  exponent: number;
  aliases: string[];
}

interface AssetDetail {
  denom: string;
  metadata: {
    description: string;
    denom_units: DenomUnit[];
    base: string;
    display: string;
    name: string;
    symbol: string;
    uri: string;
    uri_hash: string;
  } | null;
  supply: string | null;
  supply_formatted: string;
  holders: number | null;
  holders_type: string;
  price: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
  } | null;
  verified?: boolean;
  marketing?: {
    project?: string;
    description?: string;
    marketing?: string;
  };
  liquidity?: string | null;
  volume_7d_paxi?: number;
  volume_7d_usd?: number;
  volume_24h_paxi?: number;
  volume_24h_usd?: number;
}

export default function AssetDetailPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const chainName = params.chain as string;
  const denom = decodeURIComponent(params.denom as string);
  
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tokenLogo, setTokenLogo] = useState<string>('');

  useEffect(() => {
    async function loadChainData() {
      const response = await fetch('/chains.json');
      const data = await response.json();
      setChains(data);

      const chain = data.find((c: ChainData) => 
        c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
      ) || data[0];
      setSelectedChain(chain);
    }
    loadChainData();
  }, [chainName]);

  useEffect(() => {
    async function fetchAssetDetail() {
      if (!chainName || !denom) return;
      
      // Check cache first for faster loading
      const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
      if (isPRC20 && typeof window !== 'undefined') {
        const cacheKey = `prc20_detail_${denom}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            const age = Date.now() - cachedData.timestamp;
            if (age < 60000) { // 60 seconds cache
              setAsset(cachedData.asset);
              setTokenLogo(cachedData.logo);
              setLoading(false);
              return;
            }
          } catch (e) {
            sessionStorage.removeItem(cacheKey);
          }
        }
      }
      
      setLoading(true);
      try {
        if (isPRC20) {
          // 🚀 OPTIMIZED: Single bundled API call with all data including verified status
          const bundleRes = await fetch(`/api/prc20-detail-bundle?contract=${encodeURIComponent(denom)}`);
          
          if (!bundleRes.ok) {
            throw new Error('Failed to fetch PRC20 details');
          }
          
          const bundle = await bundleRes.json();
          
          // Extract ALL data from bundle (backend SSL sudah lengkap!)
          const tokenInfo = bundle.token_info;
          const marketingInfo = bundle.marketing_info;
          const numHolders = bundle.holders || 0;
          const liquidity = bundle.liquidity;
          const isVerified = bundle.verified || false;
          const priceChange24h = bundle.price_change_24h || 0;
          const reservePaxi = bundle.reserve_paxi || 0;
          const reservePrc20 = bundle.reserve_prc20 || 0;
          const pricePaxi = bundle.price_paxi || 0;
          
          // Volume data
          let volume_7d_paxi = 0;
          let volume_7d_usd = 0;
          let volume_24h_paxi = 0;
          let volume_24h_usd = 0;
          if (bundle.volume) {
            volume_7d_paxi = bundle.volume.volume_7d_paxi || 0;
            volume_7d_usd = bundle.volume.volume_7d_usd || 0;
            volume_24h_paxi = bundle.volume.volume_24h_paxi || 0;
            volume_24h_usd = bundle.volume.volume_24h_usd || 0;
          }
          
          console.log('📦 PRC20 Detail Bundle:', {
            symbol: tokenInfo?.symbol,
            holders: numHolders,
            volume_24h: volume_24h_paxi,
            price_change: priceChange24h,
            price_paxi: pricePaxi,
            verified: isVerified
          });
          
          // Set logo URL
          let logoUrl = '';
          if (marketingInfo?.logo?.url) {
            logoUrl = marketingInfo.logo.url.startsWith('ipfs://')
              ? `https://ipfs.io/ipfs/${marketingInfo.logo.url.replace('ipfs://', '')}`
              : marketingInfo.logo.url;
            setTokenLogo(logoUrl);
          }
          
          if (tokenInfo) {
            // Transform PRC20 data to AssetDetail format
            setAsset({
              denom: denom,
              metadata: {
                description: marketingInfo?.description || 'PRC20 Token',
                denom_units: [
                  { denom: denom, exponent: 0, aliases: [] },
                  { denom: tokenInfo.symbol || 'TOKEN', exponent: tokenInfo.decimals || 6, aliases: [] }
                ],
                base: denom,
                display: tokenInfo.symbol || 'TOKEN',
                name: tokenInfo.name || marketingInfo?.project || 'Unknown',
                symbol: tokenInfo.symbol || 'TOKEN',
                uri: marketingInfo?.logo?.url || '',
                uri_hash: ''
              },
              supply: tokenInfo.total_supply || '0',
              supply_formatted: tokenInfo.total_supply 
                ? (Number(tokenInfo.total_supply) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString('en-US')
                : '0',
              holders: numHolders,
              holders_type: 'prc20',
              price: null,
              verified: isVerified,
              marketing: {
                project: marketingInfo?.project || '',
                description: marketingInfo?.description || '',
                marketing: marketingInfo?.marketing || ''
              },
              liquidity: liquidity,
              volume_7d_paxi,
              volume_7d_usd,
              volume_24h_paxi,
              volume_24h_usd
            });
            
            // Cache the result
            if (typeof window !== 'undefined') {
              const cacheKey = `prc20_detail_${denom}`;
              const cacheData = {
                timestamp: Date.now(),
                asset: {
                  denom,
                  metadata: {
                    description: marketingInfo?.description || 'PRC20 Token',
                    denom_units: [
                      { denom: denom, exponent: 0, aliases: [] },
                      { denom: tokenInfo.symbol || 'TOKEN', exponent: tokenInfo.decimals || 6, aliases: [] }
                    ],
                    base: denom,
                    display: tokenInfo.symbol || 'TOKEN',
                    name: tokenInfo.name || marketingInfo?.project || 'Unknown',
                    symbol: tokenInfo.symbol || 'TOKEN',
                    uri: marketingInfo?.logo?.url || '',
                    uri_hash: ''
                  },
                  supply: tokenInfo.total_supply || '0',
                  supply_formatted: tokenInfo.total_supply 
                    ? (Number(tokenInfo.total_supply) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString('en-US')
                    : '0',
                  holders: numHolders,
                  holders_type: 'prc20',
                  price: null,
                  verified: isVerified,
                  marketing: {
                    project: marketingInfo?.project || '',
                    description: marketingInfo?.description || '',
                    marketing: marketingInfo?.marketing || ''
                  },
                  liquidity,
                  volume_7d_paxi,
                  volume_7d_usd,
                  volume_24h_paxi,
                  volume_24h_usd
                },
                logo: logoUrl
              };
              try {
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
              } catch (e) {
                console.warn('Failed to cache data:', e);
              }
            }
          }
        } else {
          // Regular asset
          const response = await fetch(`/api/asset-detail?chain=${chainName}&denom=${encodeURIComponent(denom)}`);
          const data: AssetDetail = await response.json();
          
          if (data) {
            setAsset(data);
          }
        }
      } catch (error) {
        console.error('Error fetching asset detail:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAssetDetail();
  }, [chainName, denom]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSupply = (supply: string, exponent: number) => {
    if (!supply || supply === '0') return '0';
    
    try {
      const amount = BigInt(supply);
      const divisor = BigInt(10 ** exponent);

      const wholePart = amount / divisor;
      const remainder = amount % divisor;

      let displayAmount: string;
      
      if (exponent > 0) {
        const fractionalPart = remainder.toString().padStart(exponent, '0');
        const decimalValue = parseFloat(`${wholePart}.${fractionalPart}`);
        displayAmount = decimalValue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });
      } else {
        displayAmount = wholePart.toLocaleString('en-US');
      }
      
      return displayAmount;
    } catch (error) {
      return '-';
    }
  };

  const isNativeAsset = (base: string) => {
    return !base.startsWith('ibc/') && !base.startsWith('factory/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1">
          <Header 
            chains={chains}
            selectedChain={selectedChain} 
            onSelectChain={setSelectedChain}
          />
          <main className="p-6">
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1">
          <Header 
            chains={chains}
            selectedChain={selectedChain} 
            onSelectChain={setSelectedChain}
          />
          <main className="p-6">
            <div className="text-center py-12">
              <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{t('assetDetail.notFound')}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const displayUnit = asset.metadata?.denom_units.find((u: DenomUnit) => u.denom === asset.metadata?.display);
  const exponent = displayUnit ? displayUnit.exponent : 6;
  const isNative = isNativeAsset(asset.denom);
  const isPRC20 = asset?.holders_type === 'prc20';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1">
        <Header 
          chains={chains}
          selectedChain={selectedChain} 
          onSelectChain={setSelectedChain}
        />
        
        <main className="p-4 md:p-6 pt-32 md:pt-24">
          {/* Back Button */}
          <Link 
            href={`/${chainName}/assets`}
            className="inline-flex items-center space-x-2 text-sm md:text-base text-gray-400 hover:text-white transition-colors mb-4 md:mb-6"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span>{t('assetDetail.backToAssets')}</span>
          </Link>

          {/* Header */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex items-start gap-3 md:gap-4 flex-1">
                {/* Token Logo */}
                {tokenLogo && (
                  <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border-2 border-orange-500/30 flex-shrink-0 overflow-hidden">
                    <Image
                      src={tokenLogo}
                      alt={asset.metadata?.symbol || 'token'}
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                      unoptimized={tokenLogo.includes('ipfs') || tokenLogo.includes('pinata')}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-orange-500"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>';
                        }
                      }}
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                    <h1 className="text-xl md:text-3xl font-bold text-white truncate">
                      {asset.metadata?.name || asset.metadata?.symbol || t('assetDetail.title')}
                    </h1>
                    <span
                      className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold flex-shrink-0 ${
                        isPRC20
                          ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border border-orange-500/20'
                          : isNative
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {isPRC20 ? 'PRC20' : isNative ? t('assetDetail.native') : t('assetDetail.token')}
                    </span>
                    {asset.verified && (
                      <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold flex-shrink-0 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[10px] md:text-xs font-semibold">Verified</span>
                      </span>
                    )}
                  </div>
                  {asset.metadata?.description && (
                    <p className="text-sm md:text-base text-gray-400 max-w-3xl line-clamp-3 md:line-clamp-none">
                      {asset.metadata.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Price Card (if available) */}
          {asset.price && asset.price.usd > 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg md:rounded-xl p-4 md:p-6 mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">{t('assetDetail.currentPrice')}</div>
                  <div className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">
                    ${asset.price.usd < 0.01 
                      ? asset.price.usd.toFixed(8) 
                      : asset.price.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                    }
                  </div>
                  {asset.price.usd_24h_change !== 0 && (
                    <div className={`flex items-center gap-1 md:gap-2 text-sm md:text-lg font-bold ${
                      asset.price.usd_24h_change > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {asset.price.usd_24h_change > 0 ? '↑' : '↓'}
                      {Math.abs(asset.price.usd_24h_change).toFixed(2)}% (24h)
                    </div>
                  )}
                </div>
                {asset.price.usd_market_cap > 0 && (
                  <div className="text-left md:text-right">
                    <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">{t('assetDetail.marketCap')}</div>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      ${asset.price.usd_market_cap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions for PRC20 */}
          {isPRC20 && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 md:p-6 mb-4 md:mb-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-3">
                <Link
                  href={`/${chainName}/prc20/swap?from=${denom}&tab=transfer`}
                  className="group relative overflow-hidden bg-[#222] hover:bg-[#2a2a2a] border border-gray-700 hover:border-green-500/50 text-white px-4 py-4 rounded-lg transition-all duration-200 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 flex items-center justify-center transition-colors">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Transfer</span>
                </Link>
                <Link
                  href={`/${chainName}/prc20/swap?from=${denom}`}
                  className="group relative overflow-hidden bg-[#222] hover:bg-[#2a2a2a] border border-gray-700 hover:border-blue-500/50 text-white px-4 py-4 rounded-lg transition-all duration-200 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Swap</span>
                </Link>
                <Link
                  href={`/${chainName}/prc20/swap?from=${denom}&tab=burn`}
                  className="group relative overflow-hidden bg-[#222] hover:bg-[#2a2a2a] border border-gray-700 hover:border-red-500/50 text-white px-4 py-4 rounded-lg transition-all duration-200 flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center transition-colors">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">Burn</span>
                </Link>
              </div>
            </div>
          )}

          {/* Trading Statistics (PRC20 only) */}
          {isPRC20 && (asset.volume_24h_paxi || asset.volume_7d_paxi) && (
            <div className="bg-gradient-to-br from-[#1a1a1a] via-[#1a1a1a] to-purple-950/20 border border-gray-800 rounded-xl p-5 md:p-6 mb-4 md:mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Trading Statistics</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Volume 24H */}
                <div className="bg-[#0f0f0f]/50 border border-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Volume 24H</span>
                    <div className="flex items-center gap-1 text-blue-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {asset.volume_24h_paxi && asset.volume_24h_paxi > 0
                      ? `${asset.volume_24h_paxi.toLocaleString('en-US', { maximumFractionDigits: 2 })} PAXI`
                      : '-'
                    }
                  </div>
                  {asset.volume_24h_usd && asset.volume_24h_usd > 0 && (
                    <div className="text-sm text-gray-500">
                      ≈ ${asset.volume_24h_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* Volume 7D */}
                <div className="bg-[#0f0f0f]/50 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Volume 7D</span>
                    <div className="flex items-center gap-1 text-purple-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
                    {asset.volume_7d_paxi && asset.volume_7d_paxi > 0
                      ? `${asset.volume_7d_paxi.toLocaleString('en-US', { maximumFractionDigits: 2 })} PAXI`
                      : '-'
                    }
                  </div>
                  {asset.volume_7d_usd && asset.volume_7d_usd > 0 && (
                    <div className="text-sm text-gray-500">
                      ≈ ${asset.volume_7d_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Price Chart for PRC20 */}
          {asset && asset.holders_type === 'prc20' && (
            <div className="mb-4 md:mb-6">
              <PRC20PriceChart
                contractAddress={asset.denom}
                symbol={asset.metadata?.symbol || 'Token'}
              />
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-6">
            {/* Total Supply */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.totalSupply')}</div>
              <div className="text-lg md:text-2xl font-bold text-white truncate">
                {asset.supply_formatted || formatSupply(asset.supply || '0', exponent)}
              </div>
              {asset.metadata?.symbol && (
                <div className="text-sm text-gray-500 mt-1">{asset.metadata.symbol}</div>
              )}
            </div>

            {/* Holders */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.holders')}</div>
              <div className="text-lg md:text-2xl font-bold text-blue-400">
                {asset.holders && asset.holders > 0 
                  ? asset.holders.toLocaleString()
                  : '-'
                }
              </div>
              {asset.holders_type && asset.holders_type !== 'unavailable' && (
                <div className="text-[10px] md:text-xs text-gray-500 mt-1">
                  {asset.holders_type === 'estimated' ? 'Estimated' : asset.holders_type === 'total_accounts' ? t('assetDetail.totalAccounts') : t('assetDetail.estimated')}
                </div>
              )}
            </div>

            {/* Symbol */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.symbol')}</div>
              <div className="text-lg md:text-2xl font-bold text-white truncate">
                {asset.metadata?.symbol || '-'}
              </div>
            </div>

            {/* Liquidity (PRC20) or Exponent (others) */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">
                {isPRC20 ? 'Liquidity' : t('assetDetail.decimals')}
              </div>
              <div className="text-lg md:text-2xl font-bold text-white">
                {isPRC20 
                  ? (asset.liquidity ? `${Number(asset.liquidity).toLocaleString()} PAXI` : '-')
                  : exponent
                }
              </div>
              {isPRC20 && asset.liquidity && (
                <div className="text-[10px] md:text-xs text-gray-500 mt-1">
                  Pool Reserve
                </div>
              )}
            </div>

            {/* Volume 7D (PRC20 only) */}
            {isPRC20 && (
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-purple-500/20 rounded-lg p-3 md:p-6 hover:border-purple-500/40 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs md:text-sm text-gray-400">Volume 7D</div>
                  <div className="bg-purple-500/10 rounded-lg p-1.5">
                    <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-purple-400" />
                  </div>
                </div>
                <div className="text-lg md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {asset.volume_7d_paxi && asset.volume_7d_paxi > 0
                    ? `${asset.volume_7d_paxi.toLocaleString('en-US', { maximumFractionDigits: 2 })} PAXI`
                    : '-'
                  }
                </div>
                {asset.volume_7d_usd && asset.volume_7d_usd > 0 && (
                  <div className="text-[10px] md:text-xs text-gray-500 mt-1">
                    ≈ ${asset.volume_7d_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Asset Information */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden mb-4 md:mb-6">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-800">
              <h2 className="text-lg md:text-xl font-bold text-white">{t('assetDetail.assetInfo')}</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {/* Base Denom */}
              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs md:text-sm text-gray-400 mb-1">
                      {isPRC20 ? 'Contract Address' : t('assetDetail.baseDenom')}
                    </div>
                    <div className="text-xs md:text-sm text-white font-mono break-all overflow-hidden">
                      {asset.denom}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(asset.denom)}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0 self-start"
                    title={t('assetDetail.copyToClipboard')}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.name')}</div>
                <div className="text-xs md:text-sm text-white">
                  {asset.metadata?.name || '-'}
                </div>
              </div>

              {/* Description */}
              {asset.metadata?.description && (
                <div className="px-4 md:px-6 py-3 md:py-4">
                  <div className="text-xs md:text-sm text-gray-400 mb-1">Description</div>
                  <div className="text-xs md:text-sm text-white">
                    {asset.metadata.description}
                  </div>
                </div>
              )}
              
              {/* Marketing Info for PRC20 */}
              {isPRC20 && asset.marketing && (
                <>
                  {asset.marketing.project && (
                    <div className="px-4 md:px-6 py-3 md:py-4">
                      <div className="text-xs md:text-sm text-gray-400 mb-1">Project</div>
                      <div className="text-xs md:text-sm text-white break-all">
                        {asset.marketing.project}
                      </div>
                    </div>
                  )}
                  {asset.marketing.marketing && (
                    <div className="px-4 md:px-6 py-3 md:py-4">
                      <div className="text-xs md:text-sm text-gray-400 mb-1">Marketing Contact</div>
                      <div className="text-xs md:text-sm text-white break-all">
                        {asset.marketing.marketing}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>



          {/* Top Holders Section */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden mt-4 md:mt-6">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-white">Top Holders</h2>
              <Link
                href={`/${chainName}/assets/${encodeURIComponent(denom)}/holders`}
                className="text-xs md:text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="p-4 md:p-6">
              <div className="text-center py-6 md:py-8 text-gray-400">
                <p className="mb-3 md:mb-4 text-sm md:text-base">View detailed holder information</p>
                <Link
                  href={`/${chainName}/assets/${encodeURIComponent(denom)}/holders`}
                  className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm md:text-base"
                >
                  <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  <span>View Holders</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

