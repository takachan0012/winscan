'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { Coins, ExternalLink, Search, TrendingUp, Users, Layers, DollarSign, TrendingUp as TrendingUpIcon } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { getChainRegistryLogoUrl } from '@/lib/chainRegistryLogo';

interface DenomUnit {
  denom: string;
  exponent: number;
  aliases: string[];
}

interface AssetMetadata {
  description: string;
  denom_units: DenomUnit[];
  base: string;
  display: string;
  name: string;
  symbol: string;
  uri: string;
  uri_hash: string;
  total_supply?: string;
  holders_count?: number;
  logo?: string;
  coingecko_id?: string;
  price_usd?: number;
  price_change_24h?: number;
}

interface AssetsResponse {
  metadatas: AssetMetadata[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

type FilterType = 'all' | 'native' | 'tokens';

export default function AssetsPage() {
  const params = useParams();
  const chainName = params.chain as string;
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAssets, setTotalAssets] = useState(0);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadChainData() {
      const cachedChains = sessionStorage.getItem('chains');
      
      if (cachedChains) {
        const data = JSON.parse(cachedChains);
        setChains(data);
        
        const chain = chainName 
          ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        
        if (chain) setSelectedChain(chain);
      } else {
        const response = await fetch('/api/chains');
        const data = await response.json();
        sessionStorage.setItem('chains', JSON.stringify(data));
        setChains(data);
        
        const chain = chainName 
          ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        
        if (chain) setSelectedChain(chain);
      }
    }
    loadChainData();
  }, [chainName]);

  useEffect(() => {
    async function fetchAssets() {
      if (!chainName) return;
      
      const cacheKey = `assets_${chainName}`;
      const cacheTimeout = 60000;
      
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          
          const cachedAssets = data.metadatas || [];
          setAssets(cachedAssets);
          setTotalAssets(cachedAssets.length);
          setLoading(false);
          
          if (Date.now() - timestamp < cacheTimeout) {
            return;
          }
        }
      } catch (e) {
        console.warn('Cache read error:', e);
      }
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`/api/assets?chain=${selectedChain?.chain_id || chainName}&limit=594`, { 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        const data: AssetsResponse = await response.json();
        
        const transformedAssets = (data.metadatas || []).map((asset: any) => ({
          description: asset.description || '',
          denom_units: asset.denom_units || [
            {
              denom: asset.base,
              exponent: 0,
              aliases: []
            },
            {
              denom: asset.symbol?.toLowerCase() || asset.display || asset.base,
              exponent: parseInt(asset.exponent) || 6,
              aliases: []
            }
          ],
          base: asset.base,
          display: asset.display || asset.symbol?.toLowerCase() || asset.base,
          name: asset.name || asset.symbol || asset.base,
          symbol: asset.symbol,
          uri: asset.logo || asset.uri || '',
          uri_hash: '',
          total_supply: '0',
          holders_count: 0,
        }));
        
        setAssets(transformedAssets);
        setTotalAssets(transformedAssets.length);
        setLoading(false);
        
        const nativeAssets = transformedAssets.filter((a: any) => 
          !a.base.startsWith('ibc/') && 
          !a.base.startsWith('factory/')
        ).slice(0, 5);
        
        const ibcAssets = transformedAssets.filter((a: any) => 
          a.base.startsWith('ibc/') || a.base.startsWith('factory/')
        ).slice(0, 5);
        
        const priorityAssets = [...nativeAssets, ...ibcAssets];
        
        Promise.all(
          priorityAssets.map(async (asset: any) => {
            try {
              const detailRes = await fetch(`/api/asset-detail?chain=${chainName}&denom=${asset.base}`, { 
                signal: AbortSignal.timeout(5000) 
              });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                return {
                  base: asset.base,
                  supply: detail.supply || '0',
                  holders: detail.holders || 0,
                  price_usd: detail.price?.usd || 0,
                  price_change_24h: detail.price?.usd_24h_change || 0
                };
              }
            } catch (e) {
              console.warn(`Failed to fetch detail for ${asset.base}`);
            }
            return null;
          })
        ).then(details => {
          const detailsMap = new Map();
          details.filter(d => d !== null).forEach(d => {
            if (d) detailsMap.set(d.base, d);
          });
          
          setAssets(prev => prev.map(asset => {
            const detail = detailsMap.get(asset.base);
            if (detail) {
              return {
                ...asset,
                total_supply: detail.supply,
                holders_count: detail.holders,
                price_usd: detail.price_usd,
                price_change_24h: detail.price_change_24h
              };
            }
            return asset;
          }));
          
          try {
            const enrichedAssets = transformedAssets.map((asset: any) => {
              const detail = detailsMap.get(asset.base);
              return detail ? {
                ...asset,
                total_supply: detail.supply,
                holders_count: detail.holders,
                price_usd: detail.price_usd,
                price_change_24h: detail.price_change_24h
              } : asset;
            });
            
            sessionStorage.setItem(cacheKey, JSON.stringify({ 
              data: { metadatas: enrichedAssets, pagination: data.pagination }, 
              timestamp: Date.now() 
            }));
          } catch (e) {
            console.warn('Cache write error:', e);
          }
        });
        
      } catch (error) {
        console.error('Error fetching assets:', error);
        setLoading(false);
      }
    }

    fetchAssets();
  }, [chainName]);

  const formatDenom = (denom: string) => {
    if (denom.length > 30) {
      return `${denom.substring(0, 15)}...${denom.substring(denom.length - 15)}`;
    }
    return denom;
  };

  const formatSupply = (supply: string, exponent: number) => {
    if (!supply || supply === '0') return '-';
    
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

  const isNativeAsset = (asset: AssetMetadata) => {
    return !asset.base.startsWith('ibc/') && 
           !asset.base.startsWith('factory/') && 
           !asset.base.startsWith('gamm/') &&
           !asset.base.startsWith('cw20:');
  };

  const getAssetType = (asset: AssetMetadata) => {
    if (asset.base.startsWith('ibc/')) return t('assets.ibcToken');
    if (asset.base.startsWith('factory/')) return t('assets.factoryToken');
    if (asset.base.startsWith('gamm/')) return t('assets.lpToken');
    if (asset.base.startsWith('cw20:')) return t('assets.cw20Token');
    return t('assets.nativeToken');
  };

  const getAssetTypeColor = (asset: AssetMetadata) => {
    if (asset.base.startsWith('ibc/')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    if (asset.base.startsWith('factory/')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (asset.base.startsWith('gamm/')) return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
    if (asset.base.startsWith('cw20:')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    return 'bg-green-500/10 text-green-400 border-green-500/30';
  };

  const filteredAssets = assets
    .filter(asset => {

      if (filterType === 'native' && !isNativeAsset(asset)) return false;
      if (filterType === 'tokens' && isNativeAsset(asset)) return false;
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          asset.name?.toLowerCase().includes(query) ||
          asset.symbol?.toLowerCase().includes(query) ||
          asset.display?.toLowerCase().includes(query) ||
          asset.base?.toLowerCase().includes(query) ||
          asset.description?.toLowerCase().includes(query)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      const aIsNative = isNativeAsset(a);
      const bIsNative = isNativeAsset(b);
      
      if (aIsNative && !bIsNative) return -1;
      if (!aIsNative && bIsNative) return 1;
      
      const aName = (a.symbol || a.name || a.display || '').toLowerCase();
      const bName = (b.symbol || b.name || b.display || '').toLowerCase();
      return aName.localeCompare(bName);
    });

  const nativeCount = assets.filter(isNativeAsset).length;
  const tokensCount = assets.length - nativeCount;

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
          {/* Page Header with Stats */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl p-4">
                <Coins className="w-10 h-10 text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-1">{t('assets.title')}</h1>
                <p className="text-gray-400">
                  {t('assets.subtitle')} {selectedChain?.chain_name}
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            {assets.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-blue-500/10 rounded-xl p-3">
                      <Layers className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-3xl font-bold text-white">{totalAssets}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('assets.totalAssets')}</h3>
                  <p className="text-gray-500 text-xs mt-1">{t('assets.totalAssetsDesc')}</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-green-500/10 rounded-xl p-3">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    </div>
                    <span className="text-3xl font-bold text-green-400">{nativeCount}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('assets.nativeAssets')}</h3>
                  <p className="text-gray-500 text-xs mt-1">{t('assets.nativeAssetsDesc')}</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-purple-500/10 rounded-xl p-3">
                      <Coins className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-3xl font-bold text-purple-400">{tokensCount}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('assets.ibcBridged')}</h3>
                  <p className="text-gray-500 text-xs mt-1">{t('assets.ibcBridgedDesc')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Search Bar */}
          {assets.length > 0 && (
            <div className="mb-6 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder={t('assets.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          {/* Filter Tabs */}
          {assets.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setFilterType('all')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  filterType === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                }`}
              >
                <Layers className="w-4 h-4 inline mr-2" />
                {t('assets.allAssets')}
                <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                  filterType === 'all' ? 'bg-white/20' : 'bg-gray-700'
                }`}>
                  {totalAssets}
                </span>
              </button>
              <button
                onClick={() => setFilterType('native')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  filterType === 'native'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                {t('assets.native')}
                <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                  filterType === 'native' ? 'bg-white/20' : 'bg-gray-700'
                }`}>
                  {nativeCount}
                </span>
              </button>
              <button
                onClick={() => setFilterType('tokens')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  filterType === 'tokens'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                }`}
              >
                <Coins className="w-4 h-4 inline mr-2" />
                {t('assets.tokens')}
                <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                  filterType === 'tokens' ? 'bg-white/20' : 'bg-gray-700'
                }`}>
                  {tokensCount}
                </span>
              </button>
            </div>
          )}

          {/* Assets Table */}
          {filteredAssets.length > 0 && (
            <>
              {/* Results info */}
              {searchQuery && (
                <div className="mb-4 text-sm text-gray-400">
                  {t('assets.showingResults')} {filteredAssets.length} {t('assets.of')} {assets.length} {t('assets.assetsText')}
                </div>
              )}
              
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0f0f0f] border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">
                        {t('assets.number')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.name')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.tokenType')}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.price')}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.change24h')}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.supply')}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.holders')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredAssets.map((asset, index) => {
                      const displayUnit = asset.denom_units?.find(u => u.denom === asset.display);
                      const exponent = displayUnit ? displayUnit.exponent : 6;
                      const logoUrl = asset.logo || asset.uri || '';
                      
                      return (
                        <tr 
                          key={index}
                          className="hover:bg-[#0f0f0f] transition-colors group"
                        >
                          {/* # Column */}
                          <td className="px-4 py-4 text-sm text-gray-400 font-medium">
                            #{index + 1}
                          </td>
                          
                          {/* Name Column with Logo */}
                          <td className="px-6 py-4">
                            <Link 
                              href={`/${chainName}/assets/${encodeURIComponent(asset.base)}`}
                              className="flex items-center gap-3"
                            >
                              {/* Token Logo */}
                              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-gray-700 flex-shrink-0 overflow-hidden">
                                {(() => {
                                  const isNative = isNativeAsset(asset);
                                  let logoUrl = '';
                                  
                                  // Prioritize API logo/uri for non-registry assets
                                  if (asset.logo || asset.uri) {
                                    logoUrl = asset.logo || asset.uri || '';
                                  } 
                                  // Try chain registry for known tokens
                                  else if (asset.symbol) {
                                    logoUrl = getChainRegistryLogoUrl(chainName, asset.symbol);
                                  }
                                  
                                  // Only use chain logo for native token as last resort
                                  if (isNative && !logoUrl && selectedChain?.logo) {
                                    logoUrl = selectedChain.logo;
                                  }
                                  
                                  return logoUrl ? (
                                    <Image
                                      src={logoUrl}
                                      alt={asset.symbol || 'token'}
                                      width={40}
                                      height={40}
                                      className="object-cover"
                                      onError={(e) => {
                                        const img = e.currentTarget;
                                        const currentSrc = img.src;
                                        const apiLogo = asset.logo || asset.uri;
                                        
                                        // Try API logo/uri first if we were using registry
                                        if (apiLogo && !currentSrc.includes(apiLogo)) {
                                          img.src = apiLogo;
                                          return;
                                        }
                                        
                                        // Try multiple fallback patterns
                                        if (currentSrc.endsWith('.png') && !currentSrc.includes('_logo.png') && !currentSrc.includes('_circle.png')) {
                                          // Try pattern 2: {symbol}_logo.png
                                          const newSrc = currentSrc.replace('.png', '_logo.png');
                                          img.src = newSrc;
                                          img.onerror = () => {
                                            // Try pattern 3: {symbol}_circle.png
                                            const circleSrc = currentSrc.replace('.png', '_circle.png');
                                            img.src = circleSrc;
                                            img.onerror = () => {
                                              // Final fallback: hide and show icon
                                              img.style.display = 'none';
                                              const parent = img.parentElement;
                                              if (parent) {
                                                parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg></div>';
                                              }
                                            };
                                          };
                                        } else {
                                          // Already tried fallbacks, final fallback
                                          img.style.display = 'none';
                                          const parent = img.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg></div>';
                                          }
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Coins className="w-5 h-5 text-gray-600" />
                                    </div>
                                  );
                                })()}
                              </div>
                              
                              {/* Token Info */}
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                                  {asset.symbol || asset.name || asset.display || 'Unknown'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5 font-mono">
                                  {formatDenom(asset.base)}
                                </div>
                              </div>
                            </Link>
                          </td>
                          
                          {/* Token Type Column */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border ${getAssetTypeColor(asset)}`}
                            >
                              {getAssetType(asset)}
                            </span>
                          </td>
                          
                          {/* Price Column */}
                          <td className="px-6 py-4 text-right">
                            {asset.price_usd && asset.price_usd > 0 ? (
                              <div className="text-sm font-bold text-white">
                                ${asset.price_usd < 0.01 
                                  ? asset.price_usd.toFixed(6) 
                                  : asset.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                }
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                          </td>
                          
                          {/* 24h Change Column */}
                          <td className="px-6 py-4 text-right">
                            {asset.price_change_24h !== undefined && asset.price_change_24h !== 0 ? (
                              <div className={`flex items-center justify-end gap-1 text-sm font-bold ${
                                asset.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {asset.price_change_24h > 0 ? '↑' : '↓'}
                                {Math.abs(asset.price_change_24h).toFixed(2)}%
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                          </td>
                          
                          {/* Supply Column */}
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-medium text-white">
                              {formatSupply(asset.total_supply || '0', exponent)}
                            </div>
                            {asset.symbol && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {asset.symbol}
                              </div>
                            )}
                          </td>
                          
                          {/* Holders Column */}
                          <td className="px-6 py-4 text-right">
                            <Link 
                              href={`/${chainName}/assets/${encodeURIComponent(asset.base)}/holders`}
                              className="flex items-center justify-end gap-2 hover:text-blue-400 transition-colors group/holders"
                            >
                              <Users className="w-4 h-4 text-gray-500 group-hover/holders:text-blue-400 transition-colors" />
                              <span className="text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors">
                                View Holders
                              </span>
                              <TrendingUp className="w-3 h-3 text-gray-500 group-hover/holders:text-blue-400 transition-colors" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}

          {/* Empty State - No Assets */}
          {assets.length === 0 && (
            <div className="text-center py-12">
              <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{t('assets.noAssets')}</p>
            </div>
          )}

          {/* Empty State - Filtered */}
          {assets.length > 0 && filteredAssets.length === 0 && (
            <div className="text-center py-12 bg-[#1a1a1a] border border-gray-800 rounded-lg">
              <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {searchQuery 
                  ? `${t('assets.noMatchingAssets')} "${searchQuery}"` 
                  : filterType === 'native' ? t('assets.noNativeAssets') : t('assets.noTokens')}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

