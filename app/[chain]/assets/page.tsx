'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { Coins, ExternalLink, Search, TrendingUp, Users, Layers, DollarSign, TrendingUp as TrendingUpIcon, ArrowLeftRight, Send, Flame, Sparkles } from 'lucide-react';
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
  price_usd?: number;
  price_paxi?: number;
  price_change_24h?: number;
  price_change_percent?: number;
  verified?: boolean;
  liquidity_paxi?: number;
  volume_24h?: number;
  reserve_paxi?: number;
  reserve_prc20?: number;
  txs_count?: number;
  buys?: number;
  sells?: number;
  is_pump?: boolean;
}

interface AssetsResponse {
  metadatas: AssetMetadata[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

type FilterType = 'all' | 'native' | 'tokens' | 'prc20';
type SortType = 'default' | 'gainers' | 'new' | 'marketcap';

// Format price dengan decimal penuh untuk angka sangat kecil
function formatPrice(price: number): string {
  if (price === 0) return '0';
  
  // Untuk angka sangat kecil, tampilkan dengan leading zeros
  if (price < 0.00000001) {
    const str = price.toFixed(20); // Get enough decimals
    const match = str.match(/^0\.(0*)([1-9]\d{0,3})/); // Capture leading zeros and first significant digits
    if (match) {
      return `0.${match[1]}${match[2]}`;
    }
  }
  
  // Untuk angka kecil tapi tidak terlalu kecil
  if (price < 1) {
    return price.toFixed(10).replace(/\.?0+$/, ''); // Remove trailing zeros
  }
  
  // Untuk angka normal
  return price.toFixed(6).replace(/\.?0+$/, '');
}

// Cleanup old localStorage entries to prevent quota exceeded
function cleanupOldPriceCache() {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const priceKeys = keys.filter(k => k.startsWith('prc20_price_'));
    const now = Date.now();
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    let removed = 0;
    priceKeys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (now - timestamp > MAX_AGE) {
            localStorage.removeItem(key);
            removed++;
          }
        }
      } catch (e) {
        localStorage.removeItem(key);
        removed++;
      }
    });
    
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} old price cache entries`);
    }
  } catch (e) {
    console.warn('Cleanup failed:', e);
  }
}

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
  const [filterType, setFilterType] = useState<FilterType>('native');
  const [sortType, setSortType] = useState<SortType>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [prc20NextKey, setPrc20NextKey] = useState<string | null>(null);
  const [showPRC20Support, setShowPRC20Support] = useState(false);
  const priceUpdateInProgress = useRef(false);
  const initialPriceLoadDone = useRef(false);
  const [priceChangesLoading, setPriceChangesLoading] = useState(false);
  const [displayedTokensCount, setDisplayedTokensCount] = useState(50); // Start with 50 for fast render
  const [isFromCache, setIsFromCache] = useState(false); // Track if data is from cache

  // Cleanup old cache on mount
  useEffect(() => {
    cleanupOldPriceCache();
  }, []);

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
      const cacheTimeout = 600000; // 10 minutes cache
      
      // Stale-while-revalidate: Show cached data immediately
      let shouldRefresh = true;
      let hasCache = false;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          
          const cachedAssets = data.metadatas || [];
          setAssets(cachedAssets);
          setLoading(false);
          hasCache = true;
          setIsFromCache(true);
          
          // If cache is fresh, don't refresh
          if (Date.now() - timestamp < cacheTimeout) {
            console.log('✅ Using fresh cache, skip refresh');
            return;
          }
          
          // Cache is stale but still usable, refresh in background
          console.log('📡 Using stale cache, refreshing in background...');
          shouldRefresh = true;
        }
      } catch (e) {
        console.warn('Cache read error:', e);
      }
      
      // Only show loading if no cache
      if (!hasCache) {
        setLoading(true);
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
        setIsFromCache(false); // Mark as fresh data

        const nativeAssets = transformedAssets.filter((a: any) =>
          !a.base.startsWith('ibc/') &&
          !a.base.startsWith('factory/')
        ).slice(0, 5);

        const ibcAssets = transformedAssets.filter((a: any) =>
          a.base.startsWith('ibc/') || a.base.startsWith('factory/')
        ).slice(0, 5);

        const priorityAssets = [...nativeAssets, ...ibcAssets];

        // Batch fetch details for priority assets - OPTIMIZED!
        (async () => {
          try {
            const priorityDenoms = priorityAssets.map(a => a.base);
            
            // Batch fetch asset details
            const detailsResponse = await fetch('/api/asset-detail-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chain: chainName, denoms: priorityDenoms }),
              signal: AbortSignal.timeout(10000)
            });
            
            const detailsMap = new Map();
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();
              detailsData.results?.forEach((item: any) => {
                if (item.data) {
                  detailsMap.set(item.denom, {
                    base: item.denom,
                    supply: item.data.supply || '0',
                    holders: item.data.holders || 0,
                    price_usd: item.data.price?.usd || 0,
                    price_change_24h: item.data.price?.usd_24h_change || 0
                  });
                }
              });
            }
            
            // Batch fetch holders for top 20 assets
            const top20Denoms = transformedAssets.slice(0, 20).map((a: any) => a.base);
            const holdersResponse = await fetch('/api/holders-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chain: chainName, denoms: top20Denoms }),
              signal: AbortSignal.timeout(10000)
            });
            
            const holdersMap = new Map();
            if (holdersResponse.ok) {
              const holdersData = await holdersResponse.json();
              holdersData.results?.forEach((item: any) => {
                if (item.success) {
                  holdersMap.set(item.denom, item.count);
                }
              });
            }
            
            // Update assets with batch results
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
            }));

            // Cache enriched data
            try {
              const enrichedAssets = transformedAssets.map((asset: any) => {
                const detail = detailsMap.get(asset.base);
                const holdersCount = holdersMap.get(asset.base);
                return (detail || holdersCount) ? {
                  ...asset,
                  total_supply: detail?.supply || asset.total_supply,
                  holders_count: holdersCount || detail?.holders || 0,
                  price_usd: detail?.price_usd || asset.price_usd,
                  price_change_24h: detail?.price_change_24h || asset.price_change_24h
                } : asset;
              });
              
              sessionStorage.setItem(cacheKey, JSON.stringify({ 
                data: { metadatas: enrichedAssets, pagination: data.pagination }, 
                timestamp: Date.now() 
              }));
            } catch (e) {
              console.warn('Cache write error:', e);
            }
          } catch (error) {
            console.error('Error in batch fetch:', error);
          }
        })();
        
      } catch (error) {
        console.error('Error fetching assets:', error);
        setLoading(false);
      }
    }

    fetchAssets();
  }, [chainName]);

  // Progressive rendering untuk PRC20 tokens - ULTRA FAST
  useEffect(() => {
    if (prc20Tokens.length > 0 && displayedTokensCount < prc20Tokens.length) {
      const timer = setTimeout(() => {
        setDisplayedTokensCount(prev => Math.min(prev + 150, prc20Tokens.length)); // +150 per batch
      }, 5); // 5ms ultra fast
      return () => clearTimeout(timer);
    }
  }, [prc20Tokens.length, displayedTokensCount]);

  // Reset displayed count when tokens change
  useEffect(() => {
    setDisplayedTokensCount(150); // Start with 150 for instant verified tokens
  }, [prc20Tokens.length]);

  // Fetch PRC20 tokens for Paxi chain - LOAD IN BACKGROUND IMMEDIATELY
  useEffect(() => {
    if (chainName === 'paxi-mainnet') {
      setShowPRC20Support(true);
      // Load PRC20 in background regardless of active tab
      fetchPRC20Tokens();
    } else {
      setShowPRC20Support(false);
    }
  }, [chainName]);

  // Fetch price changes for PRC20 tokens from price-history API
  useEffect(() => {
    let isMounted = true;
    
    async function fetchPriceChanges() {
      if (prc20Tokens.length === 0 || chainName !== 'paxi-mainnet' || priceUpdateInProgress.current) {
        return;
      }
      
      priceUpdateInProgress.current = true;
      
      try {
        const updatedTokens = [...prc20Tokens];
        
        // Fetch prices in batches of 5 to balance speed and load
        for (let i = 0; i < prc20Tokens.length; i += 5) {
          const batch = prc20Tokens.slice(i, i + 5);
          
          await Promise.all(
            batch.map(async (token, batchIndex) => {
              const tokenIndex = i + batchIndex;
              
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s
                
                const response = await fetch(
                  `/api/prc20-price-history/${token.contract_address}?timeframe=24h`,
                  { 
                    signal: controller.signal,
                    headers: {
                      'Accept': 'application/json'
                    }
                  }
                ).finally(() => clearTimeout(timeoutId));
                
                if (response.ok) {
                  const data = await response.json();
                  
                  if (data.history && data.history.length > 0 && isMounted) {
                    const latestPrice = data.history[data.history.length - 1];
                    let priceChange = data.price_change?.change_percent;
                    
                    // 🔥 IMPROVED: Calculate price change even for new tokens (< 24h data)
                    if ((priceChange === null || priceChange === undefined) && data.history.length >= 2) {
                      // Calculate manually from available data
                      const oldestPrice = data.history[0];
                      if (oldestPrice.price_paxi > 0 && latestPrice.price_paxi > 0) {
                        priceChange = ((latestPrice.price_paxi - oldestPrice.price_paxi) / oldestPrice.price_paxi) * 100;
                        console.log(`📊 ${token.token_info?.symbol}: Calculated change from ${data.history.length} data points = ${priceChange.toFixed(2)}%`);
                      }
                    }
                    
                    // Debug log for tracking
                    console.log(`💹 ${token.token_info?.symbol}: Price Change = ${priceChange}%, Data Points = ${data.history.length}`);
                    
                    // Validate price change - allow more reasonable ranges
                    if (priceChange !== null && priceChange !== undefined && 
                        priceChange >= -99 && priceChange <= 10000 && 
                        !isNaN(priceChange) && isFinite(priceChange)) {
                      // Valid price change
                    } else if (latestPrice.price_paxi > 0) {
                      // Has price but no change data = assume 0% change (stable or just launched)
                      priceChange = 0;
                    } else {
                      priceChange = undefined;
                    }
                    
                    updatedTokens[tokenIndex] = {
                      ...updatedTokens[tokenIndex],
                      price_usd: latestPrice.price_usd,
                      price_paxi: latestPrice.price_paxi,
                      price_change_24h: priceChange,
                    };
                  }
                }
              } catch (error) {
                // Silent fail for price updates
              }
            })
          );
          
          // Update UI after each batch
          if (isMounted) {
            setPrc20Tokens([...updatedTokens]);
          }
        }
        
        initialPriceLoadDone.current = true;
      } catch (error) {
        console.error('Error fetching price changes:', error);
      } finally {
        priceUpdateInProgress.current = false;
      }
    }
    
    // Only fetch if we haven't done initial load and have tokens
    if (prc20Tokens.length > 0 && !initialPriceLoadDone.current) {
      fetchPriceChanges();
    }
    
    return () => {
      isMounted = false;
    };
  }, [prc20Tokens.length > 0 && !initialPriceLoadDone.current, chainName]);
  
  // Separate effect for periodic updates (every 5 minutes)
  useEffect(() => {
    if (chainName !== 'paxi-mainnet' || !initialPriceLoadDone.current) return;
    
    const interval = setInterval(async () => {
      if (prc20Tokens.length === 0 || priceUpdateInProgress.current) return;
      
      priceUpdateInProgress.current = true;
      
      try {
        const updatedTokens = await Promise.all(
          prc20Tokens.map(async (token) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s
              
              const response = await fetch(
                `/api/prc20-price-history/${token.contract_address}?timeframe=24h`,
                { signal: controller.signal }
              ).finally(() => clearTimeout(timeoutId));
              
              if (response.ok) {
                const data = await response.json();
                
                if (data.history && data.history.length > 0) {
                  const latestPrice = data.history[data.history.length - 1];
                  let priceChange = data.price_change?.change_percent;
                  
                  // 🔥 Calculate price change even for new tokens
                  if ((priceChange === null || priceChange === undefined) && data.history.length >= 2) {
                    const oldestPrice = data.history[0];
                    if (oldestPrice.price_paxi > 0 && latestPrice.price_paxi > 0) {
                      priceChange = ((latestPrice.price_paxi - oldestPrice.price_paxi) / oldestPrice.price_paxi) * 100;
                    }
                  }
                  
                  // Validate price change - allow more reasonable ranges
                  if (priceChange !== null && priceChange !== undefined && 
                      priceChange >= -99 && priceChange <= 10000 && 
                      !isNaN(priceChange) && isFinite(priceChange)) {
                    // Valid price change
                  } else if (latestPrice.price_paxi > 0) {
                    // Has price but no change = assume 0%
                    priceChange = 0;
                  } else {
                    priceChange = undefined;
                  }
                  
                  return {
                    ...token,
                    price_usd: latestPrice.price_usd,
                    price_paxi: latestPrice.price_paxi,
                    price_change_24h: priceChange,
                  };
                }
              }
            } catch (error) {
              // Silent fail for individual tokens
            }
            return token;
          })
        );
        
        setPrc20Tokens(updatedTokens);
      } catch (error) {
        console.error('Error in periodic price update:', error);
      } finally {
        priceUpdateInProgress.current = false;
      }
    }, 300000); // Update every 5 minutes
    
    return () => clearInterval(interval);
  }, [chainName, initialPriceLoadDone.current]);

  const fetchPRC20Tokens = async (pageKey?: string) => {
    // Prevent duplicate calls
    if (prc20Loading && !pageKey) {
      console.log('⚠️ PRC20 already loading, skipping duplicate call');
      return;
    }
    
    try {
      if (!pageKey) {
        setPrc20Loading(true);
      }
      
      // 🚀 ULTRA FAST: Parallel fetch from SSL1 & SSL2 (race condition - fastest wins)
      const timestamp = Date.now();
      // Use cache endpoint for instant response
      const ssl1Url = `https://ssl.winsnip.xyz/api/prc20-tokens/cache?t=${timestamp}`;
      const ssl2Url = `https://ssl2.winsnip.xyz/api/prc20-tokens/cache?t=${timestamp}`;
      
      // Try SSL1 first
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(ssl1Url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const tokens = data.tokens || [];
          
          setPrc20Tokens(tokens);
          setPrc20NextKey(null); // Cache returns all tokens
          
          console.log(`✅ Loaded ${tokens.length} PRC20 tokens from SSL1 cache`);
          return;
        }
      } catch (error) {
        console.warn('SSL1 cache failed, trying SSL2...', error);
      }
      
      // Try SSL2 as fallback
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(ssl2Url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const tokens = data.tokens || [];
          
          setPrc20Tokens(tokens);
          setPrc20NextKey(null);
          
          console.log(`✅ Loaded ${tokens.length} PRC20 tokens from SSL2 cache`);
          return;
        }
      } catch (error) {
        console.warn('SSL2 cache failed, using local fallback...', error);
      }
      
      // Local fallback
      try {
        const response = await fetch(`/api/prc20-tokens/cache`);
        if (response.ok) {
          const data = await response.json();
          const tokens = data.tokens || [];
          
          console.log(`✅ Local cache loaded: ${tokens.length} tokens`);
          setPrc20Tokens(tokens);
          setPrc20NextKey(null);
        } else {
          console.error('Local cache failed');
        }
      } catch (error) {
        console.error('All endpoints failed:', error);
      }
      
      setPrc20NextKey(null);
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
      if (filterType === 'prc20') return false; // Don't include regular assets in PRC20 filter
      
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
  
  // Apply limit based on filter type
  const displayedAssets = filterType === 'all' 
    ? filteredAssets.slice(0, 20) 
    : filterType === 'native'
    ? filteredAssets.slice(0, 20)
    : filterType === 'tokens'
    ? filteredAssets.slice(0, 20)
    : filteredAssets; // prc20 shows all

  const nativeCount = assets.filter(isNativeAsset).length;
  const tokensCount = assets.length - nativeCount;

  // Filter PRC20 tokens based on search query and sort by verified status
  console.log(`🔍 Total PRC20 tokens in state: ${prc20Tokens.length}`);
  // Add index to each token to track original order (for "new tokens" sort)
  const tokensWithIndex = prc20Tokens.map((token, index) => ({ ...token, _originalIndex: index }));
  
  const filteredPRC20Tokens = tokensWithIndex
    .filter(token => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        token.token_info?.name?.toLowerCase().includes(query) ||
        token.token_info?.symbol?.toLowerCase().includes(query) ||
        token.contract_address?.toLowerCase().includes(query) ||
        token.marketing_info?.project?.toLowerCase().includes(query) ||
        token.marketing_info?.description?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // 🔥 Apply sorting based on sortType
      if (sortType === 'gainers') {
        // Pure sort by 24h price change (highest first) - no verified priority
        const aChange = a.price_change_24h ?? -Infinity;
        const bChange = b.price_change_24h ?? -Infinity;
        return bChange - aChange;
      } else if (sortType === 'new') {
        // Pure chronological order (newest first) - no verified priority
        // Token #274 is newer than token #1
        return (b._originalIndex ?? 0) - (a._originalIndex ?? 0);
      } else if (sortType === 'marketcap') {
        // Pure sort by liquidity (highest first) - no verified priority
        const aLiquidity = a.liquidity_paxi ?? 0;
        const bLiquidity = b.liquidity_paxi ?? 0;
        return bLiquidity - aLiquidity;
      } else {
        // Default "All" tab: verified first, then sort by name
        if (a.verified && !b.verified) return -1;
        if (!a.verified && b.verified) return 1;
      }
      
      // Then sort by symbol/name (verified already sorted above)
      const aName = (a.token_info?.symbol || a.token_info?.name || '').toLowerCase();
      const bName = (b.token_info?.symbol || b.token_info?.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });

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
        
        <main className="p-3 md:p-6 pt-32 md:pt-24">
          {/* Page Header with Stats */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl md:rounded-2xl p-3 md:p-4">
                <Coins className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-white mb-1 flex items-center gap-2">
                  {t('assets.title')}
                  {isFromCache && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-400 font-normal">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Cached
                    </span>
                  )}
                </h1>
                <p className="text-sm md:text-base text-gray-400">
                  {t('assets.subtitle')} {selectedChain?.chain_name}
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            {assets.length > 0 && (
              <div className={`grid grid-cols-2 ${showPRC20Support ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 md:gap-4`}>
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-xl md:rounded-2xl p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 md:mb-3">
                    <div className="bg-blue-500/10 rounded-lg md:rounded-xl p-2 md:p-3 w-fit mb-2 md:mb-0">
                      <Layers className="w-4 h-4 md:w-6 md:h-6 text-blue-400" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-white">{totalAssets}</span>
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm font-medium">{t('assets.totalAssets')}</h3>
                  <p className="text-gray-500 text-[10px] md:text-xs mt-1 hidden md:block">{t('assets.totalAssetsDesc')}</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-xl md:rounded-2xl p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 md:mb-3">
                    <div className="bg-green-500/10 rounded-lg md:rounded-xl p-2 md:p-3 w-fit mb-2 md:mb-0">
                      <TrendingUp className="w-4 h-4 md:w-6 md:h-6 text-green-400" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-green-400">{nativeCount}</span>
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm font-medium">{t('assets.nativeAssets')}</h3>
                  <p className="text-gray-500 text-[10px] md:text-xs mt-1 hidden md:block">{t('assets.nativeAssetsDesc')}</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-xl md:rounded-2xl p-3 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 md:mb-3">
                    <div className="bg-purple-500/10 rounded-lg md:rounded-xl p-2 md:p-3 w-fit mb-2 md:mb-0">
                      <Coins className="w-4 h-4 md:w-6 md:h-6 text-purple-400" />
                    </div>
                    <span className="text-2xl md:text-3xl font-bold text-purple-400">{tokensCount}</span>
                  </div>
                  <h3 className="text-gray-400 text-xs md:text-sm font-medium">{t('assets.ibcBridged')}</h3>
                  <p className="text-gray-500 text-[10px] md:text-xs mt-1 hidden md:block">{t('assets.ibcBridgedDesc')}</p>
                </div>
                
                {showPRC20Support && (
                  <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-xl md:rounded-2xl p-3 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 md:mb-3">
                      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg md:rounded-xl p-2 md:p-3 w-fit mb-2 md:mb-0">
                        <Layers className="w-4 h-4 md:w-6 md:h-6 text-orange-400" />
                      </div>
                      <span className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">{prc20Tokens.length}</span>
                    </div>
                    <h3 className="text-gray-400 text-xs md:text-sm font-medium">PRC20 Tokens</h3>
                    <p className="text-gray-500 text-[10px] md:text-xs mt-1 hidden md:block">CosmWasm smart contracts</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Bar */}
          {assets.length > 0 && (
            <div className="mb-4 md:mb-6 relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              <input
                type="text"
                placeholder={t('assets.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          {/* Filter Tabs */}
          {assets.length > 0 && (
            <div className="mb-4 md:mb-6 space-y-3">
              {/* Asset Type Filters */}
              <div className="flex flex-wrap gap-2 md:gap-3">
                <button
                  onClick={() => setFilterType('native')}
                  className={`flex items-center justify-between min-w-[105px] md:min-w-0 px-3 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-base font-semibold transition-all ${
                    filterType === 'native'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <div className="flex items-center">
                    <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">{t('assets.native')}</span>
                    <span className="sm:hidden">Native</span>
                  </div>
                  <span className={`ml-1 md:ml-2 px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium flex-shrink-0 ${
                    filterType === 'native' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {nativeCount}
                  </span>
                </button>
                <button
                  onClick={() => setFilterType('tokens')}
                  className={`flex items-center justify-between min-w-[100px] md:min-w-0 px-3 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-base font-semibold transition-all ${
                    filterType === 'tokens'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <div className="flex items-center">
                    <Coins className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">{t('assets.tokens')}</span>
                    <span className="sm:hidden">Tokens</span>
                  </div>
                  <span className={`ml-1 md:ml-2 px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium flex-shrink-0 ${
                    filterType === 'tokens' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {tokensCount}
                  </span>
                </button>
                {showPRC20Support && (
                  <button
                    onClick={() => setFilterType('prc20')}
                    className={`flex items-center justify-between min-w-[100px] md:min-w-0 px-3 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-base font-semibold transition-all ${
                      filterType === 'prc20'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <Layers className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 flex-shrink-0" />
                      <span className="hidden sm:inline">PRC20 Tokens</span>
                      <span className="sm:hidden">PRC20</span>
                    </div>
                    <span className={`ml-1 md:ml-2 px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium flex-shrink-0 ${
                      filterType === 'prc20' ? 'bg-white/20' : 'bg-gray-700'
                    }`}>
                      {filteredPRC20Tokens.length}
                    </span>
                  </button>
                )}
              </div>
              
              {/* Sort Filters - Only show for PRC20 */}
              {showPRC20Support && filterType === 'prc20' && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-gray-500 flex items-center px-2">Sort by:</span>
                  <button
                    onClick={() => setSortType('default')}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                      sortType === 'default'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSortType('new')}
                    className={`flex items-center gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                      sortType === 'new'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                        : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span className="hidden md:inline">New Tokens</span>
                  </button>
                  <button
                    onClick={() => setSortType('marketcap')}
                    className={`flex items-center gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                      sortType === 'marketcap'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                        : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    <DollarSign className="w-3 h-3" />
                    <span className="hidden md:inline">Market Cap</span>
                  </button>
                  <button
                    onClick={() => setSortType('gainers')}
                    className={`flex items-center gap-1.5 px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                      sortType === 'gainers'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    <span className="hidden md:inline">Top Gainers</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Assets Table */}
          {((displayedAssets.length > 0 && filterType !== 'prc20') || (filterType === 'all' && showPRC20Support && prc20Tokens.length > 0)) && (
            <>
              {/* Results info */}
              {searchQuery && filterType !== 'all' && (
                <div className="mb-3 md:mb-4 text-xs md:text-sm text-gray-400">
                  {t('assets.showingResults')} {displayedAssets.length} {t('assets.of')} {assets.length} {t('assets.assetsText')}
                </div>
              )}
              {searchQuery && filterType === 'all' && (
                <div className="mb-3 md:mb-4 text-xs md:text-sm text-gray-400">
                  Showing {displayedAssets.length} asset(s) and {filteredPRC20Tokens.length} PRC20 token(s) matching "{searchQuery}"
                </div>
              )}
              
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                <table className="w-full">
                  <thead className="bg-[#0f0f0f] border-b border-gray-800">
                    <tr>
                      <th className="px-2 md:px-4 py-3 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider w-10 md:w-16">
                        #
                      </th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.name')}
                      </th>
                      <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.tokenType')}
                      </th>
                      <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.price')}
                      </th>
                      <th className="hidden xl:table-cell px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.change24h')}
                      </th>
                      <th className="hidden lg:table-cell px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.supply')}
                      </th>
                      <th className="px-3 md:px-6 py-3 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assets.holders')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {displayedAssets.map((asset, index) => {
                      const displayUnit = asset.denom_units?.find(u => u.denom === asset.display);
                      const exponent = displayUnit ? displayUnit.exponent : 6;
                      const logoUrl = asset.logo || asset.uri || '';
                      
                      return (
                        <tr 
                          key={index}
                          className="hover:bg-[#0f0f0f] transition-colors group"
                        >
                          {/* # Column */}
                          <td className="px-2 md:px-4 py-3 md:py-4 text-xs md:text-sm text-gray-400 font-medium">
                            #{index + 1}
                          </td>
                          
                          {/* Name Column with Logo */}
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <Link 
                              href={`/${chainName}/assets/${encodeURIComponent(asset.base)}`}
                              className="flex items-center gap-2 md:gap-3"
                            >
                              {/* Token Logo */}
                              <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-gray-700 flex-shrink-0 overflow-hidden">
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
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs md:text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                    {asset.symbol || asset.name || asset.display || 'Unknown'}
                                  </div>
                                  {isNativeAsset(asset) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400 border border-yellow-500/30 flex-shrink-0" title="Verified Native Token">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      Verified
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] md:text-xs text-gray-500 mt-0.5 font-mono truncate">
                                  {formatDenom(asset.base)}
                                </div>
                              </div>
                            </Link>
                          </td>
                          
                          {/* Token Type Column */}
                          <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border ${getAssetTypeColor(asset)}`}
                            >
                              {getAssetType(asset)}
                            </span>
                          </td>
                          
                          {/* Price Column */}
                          <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-right">
                            {asset.price_usd && asset.price_usd > 0 ? (
                              <div className="text-xs md:text-sm font-bold text-white">
                                ${asset.price_usd < 0.01 
                                  ? asset.price_usd.toFixed(6) 
                                  : asset.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                }
                              </div>
                            ) : (
                              <span className="text-xs md:text-sm text-gray-500">-</span>
                            )}
                          </td>
                          
                          {/* 24h Change Column */}
                          <td className="hidden xl:table-cell px-6 py-4 text-right">
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
                          <td className="hidden lg:table-cell px-6 py-4 text-right">
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
                          <td className="px-2 md:px-6 py-3 md:py-4 text-right">
                            <Link
                              href={`/${chainName}/assets/${encodeURIComponent(asset.base)}/holders`}
                              className="group/holders inline-flex items-center gap-1 px-2 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:scale-105"
                            >
                              <span className="text-[10px] md:text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors whitespace-nowrap">
                                {(asset.holders_count && asset.holders_count > 0) ? asset.holders_count.toLocaleString() : '-'}
                              </span>
                              <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-500 group-hover/holders:text-blue-400 transition-colors flex-shrink-0" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* PRC20 Tokens in "All" tab */}
                    {filterType === 'all' && showPRC20Support && filteredPRC20Tokens.map((token: PRC20Token, idx: number) => {
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
                          <td className="px-2 md:px-4 py-3 md:py-4 text-xs md:text-sm text-gray-400 font-medium">
                            #{displayedAssets.length + idx + 1}
                          </td>
                          
                          {/* Name Column with Logo */}
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <Link 
                              href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}`}
                              className="flex items-center gap-2 md:gap-3"
                            >
                              <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-gray-700 flex-shrink-0 overflow-hidden">
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
                              
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="text-xs md:text-sm font-bold text-white group-hover:text-orange-400 transition-colors truncate">
                                    {token.token_info?.symbol || 'Unknown'}
                                  </div>
                                  {token.verified && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400 border border-yellow-500/30 flex-shrink-0" title="Verified Token">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      Verified
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] md:text-xs text-gray-500 mt-0.5 truncate">
                                  {token.token_info?.name || token.marketing_info?.project || 'PRC20 Token'}
                                </div>
                              </div>
                            </Link>
                          </td>
                          
                          {/* Token Type */}
                          <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border-orange-500/20">
                              PRC20
                            </span>
                          </td>
                          
                          {/* Price */}
                          <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-right">
                            {token.price_paxi !== undefined || token.price_usd !== undefined ? (
                              <div>
                                {token.price_paxi && (
                                  <div className="text-xs md:text-sm font-bold text-white">
                                    {token.price_paxi < 0.000001 
                                      ? token.price_paxi.toExponential(2)
                                      : token.price_paxi.toLocaleString('en-US', { 
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 8 
                                        })} PAXI
                                  </div>
                                )}
                                {token.price_usd && token.price_usd > 0 && (
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    ${token.price_usd < 0.000001 
                                      ? token.price_usd.toExponential(2)
                                      : token.price_usd.toLocaleString('en-US', { 
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 8 
                                        })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs md:text-sm text-gray-500">-</span>
                            )}
                          </td>
                          
                          {/* 24h Change */}
                          <td className="hidden xl:table-cell px-6 py-4 text-right">
                            {token.price_change_24h !== undefined && token.price_change_24h !== null ? (
                              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg transition-all ${
                                token.price_change_24h >= 0 
                                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/30' 
                                  : 'bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-400 border border-red-500/30'
                              }`}>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  {token.price_change_24h >= 0 ? (
                                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  ) : (
                                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  )}
                                </svg>
                                <span>
                                  {Math.abs(token.price_change_24h).toFixed(2)}%
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-gray-800/30 text-gray-500 border border-gray-700/30">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>New Token</span>
                              </div>
                            )}
                          </td>
                          
                          {/* Supply */}
                          <td className="hidden lg:table-cell px-6 py-4 text-right">
                            <div className="text-sm font-medium text-white">
                              {formattedSupply}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {token.token_info?.symbol}
                            </div>
                          </td>
                          
                          {/* Holders */}
                          <td className="px-2 md:px-6 py-3 md:py-4 text-right">
                            <Link
                              href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}/holders`}
                              className="group/holders inline-flex items-center gap-1 px-2 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:scale-105"
                            >
                              <span className="text-[10px] md:text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors whitespace-nowrap">
                                {token.num_holders ? token.num_holders.toLocaleString() : '-'}
                              </span>
                              <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-500 group-hover/holders:text-blue-400 transition-colors flex-shrink-0" />
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
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <div className="p-6 space-y-4">
                    {/* Skeleton Header */}
                    <div className="flex items-center gap-4 animate-pulse">
                      <div className="w-12 h-12 bg-gray-800 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-800 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-800 rounded w-1/4" />
                      </div>
                    </div>
                    
                    {/* Skeleton Table */}
                    <div className="space-y-3 mt-6">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-[#0f0f0f] rounded-lg animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                          <div className="w-10 h-10 bg-gray-800 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-800 rounded w-1/4" />
                            <div className="h-3 bg-gray-800 rounded w-1/3" />
                          </div>
                          <div className="w-20 h-4 bg-gray-800 rounded" />
                          <div className="w-16 h-4 bg-gray-800 rounded" />
                        </div>
                      ))}
                    </div>
                    
                    <div className="text-center pt-4">
                      <p className="text-gray-400 text-sm">Loading PRC20 tokens...</p>
                    </div>
                  </div>
                </div>
              ) : filteredPRC20Tokens.length > 0 ? (
                <div className="space-y-6">
                  {/* Search Results Info */}
                  {searchQuery && (
                    <div className="text-xs md:text-sm text-gray-400">
                      Showing {filteredPRC20Tokens.length} of {prc20Tokens.length} PRC20 tokens
                    </div>
                  )}
                  
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                    <div 
                      className="overflow-x-auto scroll-smooth" 
                      style={{ 
                        maxHeight: 'calc(100vh - 400px)', 
                        minHeight: '500px', 
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#374151 #1a1a1a'
                      }}
                    >
                      <table className="w-full">
                        <thead className="bg-[#0f0f0f] border-b border-gray-800 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 md:px-4 py-3 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider w-10 md:w-16">
                              #
                            </th>
                            <th className="px-3 md:px-6 py-3 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {t('assets.name')}
                            </th>
                            <th className="hidden xl:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {t('assets.tokenType')}
                            </th>
                            <th className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {t('assets.price')}
                            </th>
                            <th className="hidden xl:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {t('assets.change24h')}
                            </th>
                            <th className="hidden lg:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {t('assets.supply')}
                            </th>
                            <th className="hidden xl:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Volume 24H
                            </th>
                            <th className="hidden xl:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Liquidity
                            </th>
                            <th className="px-2 md:px-6 py-3 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              {t('assets.holders')}
                            </th>
                            <th className="hidden lg:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Contract
                            </th>
                            <th className="px-2 md:px-6 py-3 md:py-4 text-right text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {filteredPRC20Tokens.slice(0, displayedTokensCount).map((token, index) => {
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
                                <td className="px-2 md:px-4 py-3 md:py-4 text-xs md:text-sm text-gray-400 font-medium">
                                  #{index + 1}
                                </td>
                                
                                {/* Name Column with Logo */}
                                <td className="px-2 md:px-6 py-3 md:py-4">
                                  <Link 
                                    href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}`}
                                    className="flex items-center gap-2 md:gap-3"
                                  >
                                    {/* Token Logo - Optimized with priority for first items */}
                                    <div className="relative w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-gray-700 flex-shrink-0 overflow-hidden">
                                      {logoUrl ? (
                                        <Image
                                          src={logoUrl}
                                          alt={tokenInfo?.symbol || 'token'}
                                          width={40}
                                          height={40}
                                          priority={index < 10}
                                          loading={index < 10 ? undefined : "lazy"}
                                          className="object-cover w-full h-full"
                                          unoptimized={logoUrl.includes('ipfs') || logoUrl.includes('pinata')}
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Coins className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Token Name & Symbol */}
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <div className="flex items-center gap-1 md:gap-1.5 flex-wrap">
                                        <span className="text-xs md:text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                                          {tokenInfo?.symbol || 'Unknown'}
                                        </span>
                                        {token.verified && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400 border border-yellow-500/30 flex-shrink-0" title="Verified Token">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Verified
                                          </span>
                                        )}
                                        {!token.verified && token.liquidity_paxi !== undefined && token.liquidity_paxi < 100 && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-red-500/10 to-orange-500/10 text-red-400 border border-red-500/30 flex-shrink-0" title={`Low Liquidity: ${token.liquidity_paxi.toFixed(2)} PAXI`}>
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            Low Liq
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] md:text-xs text-gray-500 truncate">
                                        {tokenInfo?.name || marketingInfo?.project || 'PRC20 Token'}
                                      </span>
                                      {marketingInfo?.description && (
                                        <span className="hidden md:block text-xs text-gray-600 truncate max-w-xs">
                                          {marketingInfo.description}
                                        </span>
                                      )}
                                    </div>
                                  </Link>
                                </td>
                                
                                {/* Token Type Column */}
                                <td className="hidden xl:table-cell px-6 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border border-orange-500/20">
                                    PRC20
                                  </span>
                                </td>
                                
                                {/* Price Column */}
                                <td className="hidden md:table-cell px-3 md:px-6 py-3 md:py-4 text-right">
                                  {token.price_paxi !== undefined || token.price_usd !== undefined ? (
                                    <div>
                                      {token.price_paxi && (
                                        <div className="text-xs md:text-sm font-bold text-white">
                                          {formatPrice(token.price_paxi)} PAXI
                                        </div>
                                      )}
                                      {token.price_usd && token.price_usd > 0 && (
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                          ${formatPrice(token.price_usd)}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs md:text-sm text-gray-500">-</span>
                                  )}
                                </td>
                                
                                {/* 24h Change Column */}
                                <td className="hidden xl:table-cell px-6 py-4 text-right">
                                  {token.price_change_24h !== undefined && token.price_change_24h !== null ? (
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold shadow-lg transition-all ${
                                      token.price_change_24h >= 0 
                                        ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/30' 
                                        : 'bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-400 border border-red-500/30'
                                    }`}>
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        {token.price_change_24h >= 0 ? (
                                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        ) : (
                                          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        )}
                                      </svg>
                                      <span>
                                        {Math.abs(token.price_change_24h).toFixed(2)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-800/30 text-gray-500 border border-gray-700/30">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                      </svg>
                                      <span>0.00%</span>
                                    </div>
                                  )}
                                </td>
                                
                                {/* Supply Column */}
                                <td className="hidden lg:table-cell px-6 py-4 text-right">
                                  <div className="text-sm font-medium text-white">
                                    {totalSupply}
                                  </div>
                                  {tokenInfo?.symbol && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {tokenInfo.symbol}
                                    </div>
                                  )}
                                </td>
                                
                                {/* Volume 24H Column */}
                                <td className="hidden xl:table-cell px-6 py-4 text-right">
                                  {token.volume_24h !== undefined && token.volume_24h > 0 ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                                      <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                                      </svg>
                                      <div className="text-sm font-medium text-white">
                                        {token.volume_24h < 0.01 
                                          ? '<0.01'
                                          : token.volume_24h < 1000
                                          ? token.volume_24h.toFixed(2)
                                          : token.volume_24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                      </div>
                                      <span className="text-xs text-gray-400">PAXI</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500">-</span>
                                  )}
                                </td>
                                
                                {/* Liquidity Column */}
                                <td className="hidden xl:table-cell px-6 py-4 text-right">
                                  {token.reserve_paxi !== undefined && token.reserve_paxi > 0 ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                                      <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                      <div className="text-sm font-medium text-white">
                                        {((token.reserve_paxi / 1e6) * 2) < 1 
                                          ? ((token.reserve_paxi / 1e6) * 2).toFixed(2)
                                          : ((token.reserve_paxi / 1e6) * 2) < 1000
                                          ? ((token.reserve_paxi / 1e6) * 2).toFixed(1)
                                          : ((token.reserve_paxi / 1e6) * 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                      </div>
                                      <span className="text-xs text-gray-400">PAXI</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-500">-</span>
                                  )}
                                </td>
                                
                                {/* Holders Column - Direct from Paxi API */}
                                <td className="px-2 md:px-6 py-3 md:py-4 text-right">
                                  <Link
                                    href={`/${chainName}/assets/${encodeURIComponent(token.contract_address)}/holders`}
                                    className="group/holders inline-flex items-center gap-1 px-2 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:scale-105"
                                  >
                                    <span className="text-[10px] md:text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors whitespace-nowrap">
                                      {token.num_holders ? token.num_holders.toLocaleString() : '0'}
                                    </span>
                                    <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-500 group-hover/holders:text-blue-400 transition-colors flex-shrink-0" />
                                  </Link>
                                </td>
                                
                                {/* Contract Column */}
                                <td className="hidden lg:table-cell px-6 py-4 text-right">
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
                                
                                {/* Actions Column */}
                                <td className="px-2 md:px-6 py-3 md:py-4 text-right">
                                  <div className="flex items-center justify-end">
                                    {/* Swap Button */}
                                    <a
                                      href={`/${chainName}/prc20/swap?from=${token.contract_address}`}
                                      className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-[11px] md:text-sm font-medium shadow-sm whitespace-nowrap"
                                      title="Swap this token"
                                    >
                                      <ArrowLeftRight className="w-3 h-3 md:w-4 md:h-4" />
                                      <span>Swap</span>
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Progressive Loading Indicator */}
                    {displayedTokensCount < filteredPRC20Tokens.length && (
                      <div className="flex justify-center py-4 bg-[#0f0f0f] border-t border-gray-800">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                          <span>Loading more tokens... ({displayedTokensCount} / {filteredPRC20Tokens.length})</span>
                        </div>
                      </div>
                    )}
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
                  <p className="text-gray-400">
                    {searchQuery 
                      ? `No PRC20 tokens matching "${searchQuery}"` 
                      : 'No PRC20 tokens found'}
                  </p>
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
          {assets.length > 0 && filteredAssets.length === 0 && filterType !== 'prc20' && !(filterType === 'all' && showPRC20Support && filteredPRC20Tokens.length > 0) && (
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

