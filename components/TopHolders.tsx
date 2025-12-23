'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, Copy, Check, Loader2, Coins } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Image from 'next/image';
import { getChainRegistryLogoUrl } from '@/lib/chainRegistryLogo';

interface HolderBalance {
  address: string;
  balance: string;
  percentage?: number;
  logo?: string;
  symbol?: string;
}

interface HoldersData {
  denom: string;
  totalSupply: string;
  holders: HolderBalance[];
  count: number;
  message?: string;
  searchAvailable?: boolean;
  searchHint?: string;
  note?: string;
  logo?: string;
  symbol?: string;
}

interface TopHoldersProps {
  chainName: string;
  denom: string;
}

export default function TopHolders({ chainName, denom }: TopHoldersProps) {
  const { language } = useLanguage();
  const [data, setData] = useState<HoldersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchAddress, setSearchAddress] = useState('');
  const [searching, setSearching] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [assetMetadata, setAssetMetadata] = useState<{ logo?: string; symbol?: string; name?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  useEffect(() => {
    loadAssetMetadata();
    loadHolders();
  }, [chainName, denom]);

  const loadAssetMetadata = async () => {
    try {
      // Check cache first
      const cacheKey = `asset_meta_${denom}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) { // 5 min cache
          setAssetMetadata(data);
          return;
        }
      }
      
      // Check if PRC20 token
      const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
      
      if (isPRC20) {
        // Fetch PRC20 token info and marketing info with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const [tokenInfoRes, marketingInfoRes] = await Promise.all([
          fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=token_info`, { signal: controller.signal }),
          fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=marketing_info`, { signal: controller.signal })
        ]);
        
        clearTimeout(timeoutId);
        
        if (tokenInfoRes.ok && marketingInfoRes.ok) {
          const tokenInfo = await tokenInfoRes.json();
          const marketingInfo = await marketingInfoRes.json();
          
          let logo = marketingInfo?.logo?.url || '';
          if (logo.startsWith('ipfs://')) {
            logo = `https://ipfs.io/ipfs/${logo.replace('ipfs://', '')}`;
          }
          
          const metadata = {
            logo,
            symbol: tokenInfo.symbol || 'PRC20',
            name: tokenInfo.name || marketingInfo.project || 'PRC20 Token'
          };
          
          setAssetMetadata(metadata);
          
          // Cache the result
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: metadata,
            timestamp: Date.now()
          }));
        }
      } else {
        // Regular asset metadata with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`/api/assets?chain=${chainName}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const assetsData = await res.json();
          const asset = assetsData.metadatas?.find((a: any) => a.base === denom);
          if (asset) {
            let logo = asset.logo || asset.uri;
            
            // If no logo found, use chain registry URL
            if (!logo && asset.symbol) {
              logo = getChainRegistryLogoUrl(chainName, asset.symbol);
            }
            
            const metadata = {
              logo,
              symbol: asset.symbol || asset.name,
              name: asset.name
            };
            
            setAssetMetadata(metadata);
            
            // Cache the result
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: metadata,
              timestamp: Date.now()
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading asset metadata:', error);
    }
  };

  const loadHolders = async () => {
    try {
      setLoading(true);
      
      // Check cache first (only if not searching)
      if (!searchAddress) {
        const cacheKey = `holders_${chainName}_${denom}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 60000) { // 1 min cache
            setData(cachedData);
            setLoading(false);
            return;
          }
        }
      }
      
      // Check if it's a PRC20 contract
      const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
      
      if (isPRC20) {
        // For PRC20, use backend SSL API for holders list with search support and timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(
          searchAddress 
            ? `/api/holders?chain=${chainName}&denom=${encodeURIComponent(denom)}&search=${encodeURIComponent(searchAddress)}`
            : `/api/holders?chain=${chainName}&denom=${encodeURIComponent(denom)}&limit=200&_t=${Date.now()}`,
          { cache: 'no-store', signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const holdersData = await res.json();
          setData(holdersData);
          setCurrentPage(1); // Reset to first page
          
          // Cache only if not searching
          if (!searchAddress) {
            const cacheKey = `holders_${chainName}_${denom}`;
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: holdersData,
              timestamp: Date.now()
            }));
          }
        } else {
          setData({
            denom: denom,
            totalSupply: '0',
            holders: [],
            count: 0,
            message: 'Failed to fetch holders'
          });
        }
      } else {
        // Regular chain holders with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(
          `/api/holders?chain=${chainName}&denom=${encodeURIComponent(denom)}&limit=200&_t=${Date.now()}`,
          { cache: 'no-store', signal: controller.signal }
        );
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const holdersData = await res.json();
          setData(holdersData);
          setCurrentPage(1); // Reset to first page
          
          // Cache the result
          if (!searchAddress) {
            const cacheKey = `holders_${chainName}_${denom}`;
            sessionStorage.setItem(cacheKey, JSON.stringify({
              data: holdersData,
              timestamp: Date.now()
            }));
          }
        } else {
          console.error('Failed to fetch holders:', res.status);
        }
      }
    } catch (error) {
      console.error('Error loading holders:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchHolder = async () => {
    if (!searchAddress.trim()) {
      loadHolders();
      return;
    }

    try {
      setSearching(true);
      const res = await fetch(
        `/api/holders?chain=${chainName}&denom=${encodeURIComponent(denom)}&search=${searchAddress.trim()}`
      );

      if (res.ok) {
        const searchData = await res.json();
        setData(searchData);
      }
    } catch (error) {
      console.error('Error searching holder:', error);
    } finally {
      setSearching(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatBalance = (balance: string, exponent: number = 6): string => {
    try {
      const num = parseFloat(balance) / Math.pow(10, exponent);
      return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
    } catch {
      return '0';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gray-800" />
            <div className="flex-1">
              <div className="h-5 bg-gray-800 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-800 rounded w-64" />
            </div>
          </div>
          
          {/* Search Skeleton */}
          <div className="h-10 bg-gray-800 rounded-lg mb-6" />
          
          {/* Table Skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-800 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-800 rounded w-1/2" />
                </div>
                <div className="h-4 bg-gray-800 rounded w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-400">
        No holders data available
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
        <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
          <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-500/20 border border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {assetMetadata?.logo ? (
              <Image
                src={assetMetadata.logo}
                alt={assetMetadata.symbol || 'token'}
                width={40}
                height={40}
                loading="lazy"
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-xl font-bold text-white truncate">
              Top Holders {assetMetadata?.symbol && `- ${assetMetadata.symbol}`}
            </h2>
            <p className="text-gray-400 text-xs md:text-sm truncate">
              Total Supply: {formatBalance(data.totalSupply)} {assetMetadata?.symbol || data.denom}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-4 md:mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchHolder()}
              className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg pl-10 md:pl-11 pr-3 md:pr-4 py-2 md:py-2.5 text-white text-xs md:text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={searchHolder}
              disabled={searching}
              className="flex-1 sm:flex-none px-4 py-2 md:py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
            {searchAddress && (
              <button
                onClick={async () => {
                  setSearchAddress('');
                  // Reload holders list after clearing search
                  try {
                    setLoading(true);
                    const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
                    
                    const res = await fetch(
                      `/api/holders?chain=${chainName}&denom=${encodeURIComponent(denom)}&limit=200&_t=${Date.now()}`,
                      { cache: 'no-store' }
                    );
                    
                    if (res.ok) {
                      const holdersData = await res.json();
                      setData(holdersData);
                    }
                  } catch (error) {
                    console.error('Error reloading holders:', error);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 md:py-2.5 bg-[#0f0f0f] border border-gray-800 text-gray-400 hover:text-white text-xs md:text-sm rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Show message for non-native tokens */}
        {data.message && data.holders.length === 0 && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-400 text-xs">ℹ</span>
              </div>
              <div className="flex-1">
                <p className="text-blue-400 text-sm font-medium mb-1">
                  {data.message}
                </p>
                {data.searchHint && (
                  <p className="text-gray-400 text-xs">
                    {data.searchHint}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-4 md:mx-0">
          {data.holders.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-gray-400 text-sm md:text-base">
              No holders found
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                  <th className="text-left py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Address</th>
                  <th className="text-right py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                  <th className="text-right py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Percentage</th>
                  <th className="text-right py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Token Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.holders
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((holder, idx) => {
                    const actualIdx = (currentPage - 1) * itemsPerPage + idx;
                    return (
                      <tr
                        key={holder.address}
                        className="hover:bg-[#0f0f0f] transition-colors"
                      >
                      <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm text-gray-400">{actualIdx + 1}</td>
                      
                      {/* Token Name with Logo */}
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="relative w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-500/20 border border-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {assetMetadata?.logo ? (
                              <Image
                                src={assetMetadata.logo}
                                alt={assetMetadata.symbol || 'token'}
                                width={32}
                                height={32}
                                loading="lazy"
                                className="object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Coins className="w-3 h-3 md:w-4 md:h-4 text-gray-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs md:text-sm font-bold text-white truncate">
                              {assetMetadata?.symbol || 'Unknown'}
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500 truncate">
                              {assetMetadata?.name || data.denom.slice(0, 20)}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-2 md:py-3 px-2 md:px-4">
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className="font-mono text-[10px] md:text-sm text-blue-400 truncate">
                            {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                          </span>
                          <button
                            onClick={() => copyAddress(holder.address)}
                            className="text-gray-400 hover:text-white transition flex-shrink-0"
                          >
                            {copiedAddress === holder.address ? (
                              <Check className="w-3 h-3 md:w-4 md:h-4 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3 md:w-4 md:h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-right text-xs md:text-sm font-medium text-white">
                        {formatBalance(holder.balance)}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-right hidden sm:table-cell">
                        <span className="px-1.5 md:px-2 py-0.5 md:py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] md:text-xs font-medium">
                          {holder.percentage?.toFixed(4)}%
                        </span>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-4 text-right hidden lg:table-cell">
                        <span className={`px-2 md:px-3 py-0.5 md:py-1 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider border ${
                          denom.startsWith('paxi1') && denom.length > 40
                            ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border-orange-500/20'
                            : denom.startsWith('ibc/') 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                            : denom.startsWith('gamm/') 
                            ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                          {denom.startsWith('paxi1') && denom.length > 40 ? 'PRC20' : denom.startsWith('ibc/') ? 'IBC Token' : denom.startsWith('gamm/') ? 'LP Token' : 'Native'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
)}
        </div>
        
        {/* Pagination Controls */}
        {data.holders.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-4 px-4">
            <div className="text-sm text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, data.holders.length)} of {data.holders.length} holders
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, Math.ceil(data.holders.length / itemsPerPage)) }, (_, i) => {
                  const totalPages = Math.ceil(data.holders.length / itemsPerPage);
                  let pageNum;
                  
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#1a1a1a] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.holders.length / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(data.holders.length / itemsPerPage)}
                className="px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
