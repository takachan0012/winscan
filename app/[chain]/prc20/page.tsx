'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import { Search, Coins, TrendingUp, Users, ArrowLeftRight, Send, Sparkles, Flame } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

interface PRC20Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo?: string;
  description?: string;
  website?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  holders?: number;
  num_holders?: number;
  balance?: string;
  verified?: boolean;
}

export default function PRC20Page() {
  const params = useParams();
  const { account, isConnected } = useWallet();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [tokens, setTokens] = useState<PRC20Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<PRC20Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'marketCap' | 'volume' | 'price' | 'name'>('marketCap');

  // Ref to prevent duplicate balance loads
  const balancesLoadedRef = useRef(false);

  // Create PAXI native token object
  const createPAXIToken = (): PRC20Token => ({
    address: 'PAXI',
    name: 'PAXI',
    symbol: 'PAXI',
    decimals: 6,
    totalSupply: '0',
    logo: undefined,
    description: 'Native PAXI token',
    price: 0,
    balance: '0',
  });

  useEffect(() => {
    const loadChains = async () => {
      try {
        const response = await fetch('/api/chains');
        const data = await response.json();
        setChains(data);

        const chain = data.find(
          (c: ChainData) =>
            c.chain_name.toLowerCase().replace(/\s+/g, '-') === params.chain
        );
        setSelectedChain(chain || null);
      } catch (error) {
        console.error('Error loading chains:', error);
      }
    };

    loadChains();
  }, [params.chain]);

  useEffect(() => {
    if (selectedChain) {
      balancesLoadedRef.current = false; // Reset when chain changes
      loadTokens();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (isConnected && account?.address && selectedChain && tokens.length > 0) {
      balancesLoadedRef.current = false; // Reset to allow loading
      loadUserBalances();
    }
  }, [isConnected, account?.address, selectedChain?.chain_id, tokens.length]);

  useEffect(() => {
    filterAndSortTokens();
  }, [tokens, searchQuery, sortBy]);

  const loadTokens = async () => {
    const cacheKey = `prc20_tokens_list_${selectedChain?.chain_id}`;
    const marketCacheKey = `prc20_market_${selectedChain?.chain_id}`;
    const cacheTimeout = 300000; // 5 minutes
    
    setLoading(true);
    try {
      // Check cache first
      const cachedTokens = sessionStorage.getItem(cacheKey);
      const cachedMarket = sessionStorage.getItem(marketCacheKey);
      
      let data, marketData;
      
      if (cachedTokens && cachedMarket) {
        try {
          const tokensCache = JSON.parse(cachedTokens);
          const marketCache = JSON.parse(cachedMarket);
          
          if (Date.now() - tokensCache.timestamp < cacheTimeout && 
              Date.now() - marketCache.timestamp < cacheTimeout) {
            console.log('✅ Using cached token list and market data');
            data = tokensCache.data;
            marketData = marketCache.data;
          }
        } catch (e) {
          console.warn('Cache parse error:', e);
        }
      }
      
      // Fetch fresh data if cache miss
      if (!data || !marketData) {
        console.log('📡 Fetching fresh token and market data...');
        const response = await fetch(`/api/prc20-tokens?chain=${selectedChain?.chain_id}`);
        data = await response.json();
        
        // Load market data for all tokens
        const marketResponse = await fetch(`/api/prc20/market?chain=${selectedChain?.chain_id}`);
        marketData = await marketResponse.json();
        
        // Cache the data
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        sessionStorage.setItem(marketCacheKey, JSON.stringify({
          data: marketData,
          timestamp: Date.now()
        }));
        console.log('✅ Token and market data cached');
      }
      
      const mappedTokens = (data.tokens || []).map((token: any) => {
        const tokenAddress = token.contract_address || token.address;
        const market = marketData[tokenAddress];
        
        // Calculate market cap if we have price and total supply
        const price = market?.price_usd || 0;
        const totalSupply = parseFloat(token.token_info?.total_supply || token.totalSupply || '0');
        const decimals = token.token_info?.decimals || token.decimals || 6;
        const marketCap = price > 0 && totalSupply > 0 ? (price * (totalSupply / Math.pow(10, decimals))) : 0;
        
        return {
          address: tokenAddress,
          name: token.token_info?.name || token.name || 'Unknown',
          symbol: token.token_info?.symbol || token.symbol || '???',
          decimals: decimals,
          totalSupply: token.token_info?.total_supply || token.totalSupply || '0',
          logo: token.marketing_info?.logo?.url || token.logo,
          description: token.marketing_info?.description || token.description,
          website: token.marketing_info?.project || token.website,
          price: price,
          priceChange24h: market?.price_change_24h || 0,
          marketCap: marketCap,
          volume24h: market?.volume_24h || 0,
          holders: token.num_holders || 0,
          balance: '0',
          verified: token.verified || false
        };
      });

      setTokens(mappedTokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserBalances = async () => {
    if (!account?.address || !selectedChain || balancesLoadedRef.current) return;
    
    balancesLoadedRef.current = true;
    setLoadingBalances(true);
    try {
      // Load PRC20 token balances
      const balancePromises = tokens.map(async (token) => {
        try {
          const chainName = selectedChain.chain_name?.toLowerCase().replace(/\s+/g, '-') || 'paxi-mainnet';
          const response = await fetch(`/api/prc20-balance?chain=${chainName}&contract=${token.address}&address=${account.address}`);
          const data = await response.json();
          console.log(`Balance for ${token.symbol}:`, data);
          return {
            address: token.address,
            balance: data.balance || '0'
          };
        } catch (error) {
          console.error(`Error loading balance for ${token.symbol}:`, error);
          return {
            address: token.address,
            balance: '0'
          };
        }
      });

      const balances = await Promise.all(balancePromises);
      
      setTokens(prevTokens =>
        prevTokens.map(token => ({
          ...token,
          balance: balances.find(b => b.address === token.address)?.balance || '0'
        }))
      );
    } catch (error) {
      console.error('Error loading balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const filterAndSortTokens = () => {
    let filtered = [...tokens];

    if (searchQuery) {
      filtered = filtered.filter(
        (token) =>
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return (b.marketCap || 0) - (a.marketCap || 0);
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredTokens(filtered);
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const totalMarketCap = tokens.reduce((sum, token) => sum + (token.marketCap || 0), 0);
  const totalVolume = tokens.reduce((sum, token) => sum + (token.volume24h || 0), 0);
  const totalHolders = tokens.reduce((sum, token) => sum + (token.holders || 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

      <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 max-w-7xl mx-auto w-full overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">PRC20 Tokens</h1>
            <p className="text-gray-400">Standard token interface on {selectedChain?.chain_name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Tokens</span>
                <Coins className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{tokens.length}</div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Market Cap</span>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(totalMarketCap)}</div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">24h Volume</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(totalVolume)}</div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Holders</span>
                <Users className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-white">{totalHolders.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tokens by name, symbol, or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="marketCap" className="bg-[#1a1a1a] text-white">Sort by Market Cap</option>
                  <option value="volume" className="bg-[#1a1a1a] text-white">Sort by Volume</option>
                  <option value="price" className="bg-[#1a1a1a] text-white">Sort by Price</option>
                  <option value="name" className="bg-[#1a1a1a] text-white">Sort by Name</option>
                </select>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Market Cap</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Volume (24h)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Holders</th>
                        {isConnected && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Your Balance</th>
                        )}
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={isConnected ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                            Loading tokens...
                          </td>
                        </tr>
                      ) : filteredTokens.length === 0 ? (
                        <tr>
                          <td colSpan={isConnected ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                            No tokens found
                          </td>
                        </tr>
                      ) : (
                        filteredTokens.map((token) => (
                          <tr key={token.address} className="border-b border-gray-800 hover:bg-[#222] transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                {token.logo ? (
                                  <img src={token.logo} alt={token.name} className="w-8 h-8 rounded-full" onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }} />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                    {token.symbol.substring(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{token.name}</span>
                                    {token.verified && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-400 border border-blue-500/20">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-400 text-sm">{token.symbol}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right text-white">${token.price?.toFixed(4) || '0.0000'}</td>
                            <td className="px-4 py-4 text-right">
                              <span className={`${(token.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(token.priceChange24h || 0) >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right text-white">{formatNumber(token.marketCap)}</td>
                            <td className="px-4 py-4 text-right text-white">{formatNumber(token.volume24h)}</td>
                            <td className="px-4 py-4 text-right text-white">{(token.holders || 0).toLocaleString()}</td>
                            {isConnected && (
                              <td className="px-4 py-4 text-right text-white">
                                {loadingBalances ? (
                                  <div className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <span>{(parseFloat(token.balance || '0') / Math.pow(10, token.decimals)).toFixed(4)}</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-4 text-right">
                              <a
                                href={`/${selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-')}/prc20/swap?from=${token.address}`}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                              >
                                Swap
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>

          {/* All PRC20 features moved to dedicated pages - use /prc20/swap for swapping */}
      </main>

      <Footer />
    </div>
  );
}
