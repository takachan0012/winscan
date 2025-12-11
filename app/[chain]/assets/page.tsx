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
  contract_address?: string; // For PRC20 tokens
}

interface PRC20Token {
  contract_address: string;
  token_info: {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
  } | null;
  marketing_info: {
    project?: string;
    description?: string;
    logo?: { url: string };
    marketing?: string;
  } | null;
  num_holders?: number;
}

interface AssetsResponse {
  metadatas: AssetMetadata[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

type FilterType = 'all' | 'native' | 'tokens' | 'prc20';

export default function AssetsPage() {
  const params = useParams();
  const chainName = params.chain as string;
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [prc20Tokens, setPrc20Tokens] = useState<PRC20Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [prc20Loading, setPrc20Loading] = useState(false);
  const [totalAssets, setTotalAssets] = useState(0);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [prc20NextKey, setPrc20NextKey] = useState<string | null>(null);
  const [showPRC20Support, setShowPRC20Support] = useState(false);

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
        setLoading(false);

        const nativeAssets = transformedAssets.filter((a: any) =>
          !a.base.startsWith('ibc/') &&
          !a.base.startsWith('factory/')
        ).slice(0, 5);

        const ibcAssets = transformedAssets.filter((a: any) =>
          a.base.startsWith('ibc/') || a.base.startsWith('factory/')
        ).slice(0, 5);

        const priorityAssets = [...nativeAssets, ...ibcAssets];

        // Fetch details for priority assets
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
        ).then(async details => {
          const detailsMap = new Map();
          details.filter(d => d !== null).forEach(d => {
            if (d) detailsMap.set(d.base, d);
          });
          
          // Fetch holders count for all assets (in background)
          const allAssetsWithHolders = await Promise.all(
            transformedAssets.slice(0, 20).map(async (asset: any) => {
              try {
                const holdersRes = await fetch(`/api/holders?chain=${chainName}&denom=${encodeURIComponent(asset.base)}&limit=1`, {
                  signal: AbortSignal.timeout(3000)
                });
                if (holdersRes.ok) {
                  const holdersData = await holdersRes.json();
                  return {
                    base: asset.base,
                    holders: holdersData.count || 0
                  };
                }
              } catch (e) {
                // Ignore
              }
              return { base: asset.base, holders: 0 };
            })
          );
          
          const holdersMap = new Map();
          allAssetsWithHolders.forEach(h => holdersMap.set(h.base, h.holders));
          
          setAssets(prev => prev.map(asset => {
            const detail = detailsMap.get(asset.base);
            const holdersCount = holdersMap.get(asset.base) || detail?.holders || 0;
            
            if (detail || holdersCount > 0) {
              return {
                ...asset,
                total_supply: detail?.supply || asset.total_supply,
                holders_count: holdersCount,
                price_usd: detail?.price_usd || asset.price_usd,
                price_change_24h: detail?.price_change_24h || asset.price_change_24h
              };
            }
            return asset;
          }));          try {
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

  // Fetch PRC20 tokens for Paxi chain
  useEffect(() => {
    if (chainName === 'paxi-mainnet') {
      setShowPRC20Support(true);
      if (filterType === 'prc20' || filterType === 'all') {
        fetchPRC20Tokens();
      }
    } else {
      setShowPRC20Support(false);
    }
  }, [chainName, filterType]);

  const fetchPRC20Tokens = async (pageKey?: string) => {
    try {
      setPrc20Loading(true);
      
      let url = `/api/prc20-tokens?chain=${chainName}&limit=20`;
      if (pageKey) {
        url += `&key=${encodeURIComponent(pageKey)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch PRC20 tokens');
      }

      const data = await response.json();
      
      if (pageKey) {
        setPrc20Tokens(prev => [...prev, ...data.tokens]);
      } else {
        setPrc20Tokens(data.tokens);
      }
      
      setPrc20NextKey(data.pagination.next_key || null);
    } catch (error) {
      console.error('Error fetching PRC20 tokens:', error);
    } finally {
      setPrc20Loading(false);
    }
  };

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

  // Update totalAssets state when assets or prc20Tokens change
  useEffect(() => {
    const total = assets.length + (showPRC20Support ? prc20Tokens.length : 0);
    setTotalAssets(total);
  }, [assets.length, prc20Tokens.length, showPRC20Support]);

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
              <div className={`grid grid-cols-1 ${showPRC20Support ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
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
                
                {showPRC20Support && (
                  <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl p-3">
                        <Layers className="w-6 h-6 text-orange-400" />
                      </div>
                      <span className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">{prc20Tokens.length}</span>
                    </div>
                    <h3 className="text-gray-400 text-sm font-medium">PRC20 Tokens</h3>
                    <p className="text-gray-500 text-xs mt-1">CosmWasm smart contracts</p>
                  </div>
                )}
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
              {showPRC20Support && (
                <button
                  onClick={() => setFilterType('prc20')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    filterType === 'prc20'
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <Layers className="w-4 h-4 inline mr-2" />
                  PRC20 Tokens
                  <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                    filterType === 'prc20' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {prc20Tokens.length}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Assets Table */}
          {((filteredAssets.length > 0 && filterType !== 'prc20') || (filterType === 'all' && showPRC20Support && prc20Tokens.length > 0)) && (
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
                              className="group/holders inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:scale-105"
                            >
                              <span className="text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors">
                                {(asset.holders_count && asset.holders_count > 0) ? asset.holders_count.toLocaleString() : '-'}
                              </span>
                              <TrendingUp className="w-3 h-3 text-gray-500 group-hover/holders:text-blue-400 transition-colors" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* PRC20 Tokens in "All" tab */}
                    {filterType === 'all' && showPRC20Support && prc20Tokens.map((token: PRC20Token, idx: number) => {
                      const logoUrl = token.marketing_info?.logo?.url?.startsWith('ipfs://')
                        ? `https://ipfs.io/ipfs/${token.marketing_info.logo.url.replace('ipfs://', '')}`
                        : token.marketing_info?.logo?.url || '';
                      
                      const decimals = parseInt(String(token.token_info?.decimals || '6'));
                      const totalSupply = token.token_info?.total_supply || '0';
                      const formattedSupply = (parseFloat(totalSupply) / Math.pow(10, decimals)).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                      });
                      
                      return (
                        <tr 
                          key={token.contract_address}
                          className="hover:bg-[#0f0f0f] transition-colors group"
                        >
                          {/* # Column */}
                          <td className="px-4 py-4 text-sm text-gray-400 font-medium">
                            #{filteredAssets.length + idx + 1}
                          </td>
                          
                          {/* Name Column with Logo */}
                          <td className="px-6 py-4">
                            <Link 
                              href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}`}
                              className="flex items-center gap-3"
                            >
                              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 flex-shrink-0 overflow-hidden">
                                {logoUrl ? (
                                  <Image
                                    src={logoUrl}
                                    alt={token.token_info?.symbol || 'token'}
                                    width={40}
                                    height={40}
                                    className="object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Coins className="w-5 h-5 text-orange-600" />
                                  </div>
                                )}
                              </div>
                              
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors">
                                  {token.token_info?.symbol || 'Unknown'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {token.token_info?.name || token.marketing_info?.project || 'PRC20 Token'}
                                </div>
                              </div>
                            </Link>
                          </td>
                          
                          {/* Token Type */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border-orange-500/20">
                              PRC20
                            </span>
                          </td>
                          
                          {/* Price */}
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm text-gray-500">-</span>
                          </td>
                          
                          {/* 24h Change */}
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm text-gray-500">-</span>
                          </td>
                          
                          {/* Supply */}
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-medium text-white">
                              {formattedSupply}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {token.token_info?.symbol}
                            </div>
                          </td>
                          
                          {/* Holders */}
                          <td className="px-6 py-4 text-right">
                            <Link
                              href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}/holders`}
                              className="group/holders inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:scale-105"
                            >
                              <span className="text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors">
                                {token.num_holders && token.num_holders >= 100 ? '100+' : token.num_holders || '-'}
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

          {/* PRC20 Tokens Table */}
          {filterType === 'prc20' && (
            <>
              {prc20Loading && prc20Tokens.length === 0 ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                </div>
              ) : prc20Tokens.length > 0 ? (
                <div className="space-y-6">
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#0f0f0f] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">
                              #
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
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Contract
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {prc20Tokens.map((token, index) => {
                            const tokenInfo = token.token_info;
                            const marketingInfo = token.marketing_info;
                            
                            // Convert IPFS URLs to HTTP gateway
                            let logoUrl = marketingInfo?.logo?.url || '';
                            if (logoUrl.startsWith('ipfs://')) {
                              const ipfsHash = logoUrl.replace('ipfs://', '');
                              logoUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
                            }
                            
                            const decimals = tokenInfo?.decimals || 6;
                            const totalSupply = tokenInfo?.total_supply 
                              ? (Number(tokenInfo.total_supply) / Math.pow(10, decimals)).toLocaleString('en-US', { maximumFractionDigits: 2 })
                              : '0';

                            return (
                              <tr 
                                key={token.contract_address}
                                className="hover:bg-[#0f0f0f] transition-colors group"
                              >
                                {/* # Column */}
                                <td className="px-4 py-4 text-sm text-gray-400 font-medium">
                                  #{index + 1}
                                </td>
                                
                                {/* Name Column with Logo */}
                                <td className="px-6 py-4">
                                  <Link 
                                    href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}`}
                                    className="flex items-center gap-3"
                                  >
                                    {/* Token Logo */}
                                    <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-gray-700 flex-shrink-0 overflow-hidden">
                                      {logoUrl ? (
                                        <Image
                                          src={logoUrl}
                                          alt={tokenInfo?.symbol || 'token'}
                                          width={40}
                                          height={40}
                                          className="object-cover"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Coins className="w-5 h-5 text-orange-500" />
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Token Name & Symbol */}
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                                        {tokenInfo?.symbol || 'Unknown'}
                                      </span>
                                      <span className="text-xs text-gray-500 truncate">
                                        {tokenInfo?.name || marketingInfo?.project || 'PRC20 Token'}
                                      </span>
                                      {marketingInfo?.description && (
                                        <span className="text-xs text-gray-600 truncate max-w-xs">
                                          {marketingInfo.description}
                                        </span>
                                      )}
                                    </div>
                                  </Link>
                                </td>
                                
                                {/* Token Type Column */}
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border border-orange-500/20">
                                    PRC20
                                  </span>
                                </td>
                                
                                {/* Price Column */}
                                <td className="px-6 py-4 text-right">
                                  <span className="text-sm text-gray-500">-</span>
                                </td>
                                
                                {/* 24h Change Column */}
                                <td className="px-6 py-4 text-right">
                                  <span className="text-sm text-gray-500">-</span>
                                </td>
                                
                                {/* Supply Column */}
                                <td className="px-6 py-4 text-right">
                                  <div className="text-sm font-medium text-white">
                                    {totalSupply}
                                  </div>
                                  {tokenInfo?.symbol && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {tokenInfo.symbol}
                                    </div>
                                  )}
                                </td>
                                
                                {/* Holders Column */}
                                <td className="px-6 py-4 text-right">
                                  {token.num_holders !== undefined && token.num_holders > 0 ? (
                                    <div className="text-sm font-medium text-white">
                                      {token.num_holders >= 100 ? '100+' : token.num_holders.toLocaleString()}
                                    </div>
                                  ) : (
                                    <div className="text-sm font-medium text-gray-400">
                                      -
                                    </div>
                                  )}
                                </td>
                                
                                {/* Contract Column */}
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <a
                                      href={`https://www.mintscan.io/paxi/wasm/contract/${token.contract_address}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-orange-400 hover:text-orange-300 transition-colors font-mono inline-flex items-center gap-1 group/link"
                                      title={token.contract_address}
                                    >
                                      <span>{token.contract_address.slice(0, 8)}...{token.contract_address.slice(-6)}</span>
                                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                    </a>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(token.contract_address);
                                      }}
                                      className="p-1 hover:bg-gray-800 rounded transition-colors"
                                      title="Copy contract address"
                                    >
                                      <svg className="w-4 h-4 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Load More Button */}
                  {prc20NextKey && (
                    <div className="flex justify-center pt-4">
                      <button
                        onClick={() => fetchPRC20Tokens(prc20NextKey)}
                        disabled={prc20Loading}
                        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-700 disabled:to-gray-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-orange-500/30 disabled:shadow-none flex items-center gap-2"
                      >
                        {prc20Loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <span>Load More</span>
                            <TrendingUp className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-[#1a1a1a] border border-gray-800 rounded-lg">
                  <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No PRC20 tokens found</p>
                </div>
              )}
            </>
          )}

          {/* Empty State - No Assets */}
          {assets.length === 0 && filterType !== 'prc20' && (
            <div className="text-center py-12">
              <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{t('assets.noAssets')}</p>
            </div>
          )}

          {/* Empty State - Filtered */}
          {assets.length > 0 && filteredAssets.length === 0 && filterType !== 'prc20' && (
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

