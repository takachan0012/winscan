'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
}

interface MarketingInfo {
  project?: string;
  description?: string;
  logo?: {
    url: string;
  };
  marketing?: string;
}

interface PRC20Token {
  contract_address: string;
  token_info: TokenInfo | null;
  marketing_info: MarketingInfo | null;
  verified?: boolean;
}

export default function PRC20TokensPage() {
  const params = useParams();
  const chain = params.chain as string;

  const [tokens, setTokens] = useState<PRC20Token[]>([]);
  const [displayTokens, setDisplayTokens] = useState<PRC20Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load cached data immediately
  useEffect(() => {
    const cacheKey = `prc20_tokens_${chain}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        // Show cached data even if old (stale-while-revalidate)
        if (age < 24 * 60 * 60 * 1000) { // Less than 24 hours
          const cachedTokens = data.tokens || [];
          setTokens(cachedTokens);
          // Show first 5 immediately, rest progressively
          setDisplayTokens(cachedTokens.slice(0, 5));
          setNextKey(data.next_key || null);
          setIsInitialLoad(false);
          
          // Progressive reveal of remaining tokens
          if (cachedTokens.length > 5) {
            for (let i = 5; i < cachedTokens.length; i += 3) {
              setTimeout(() => {
                setDisplayTokens(cachedTokens.slice(0, Math.min(i + 3, cachedTokens.length)));
              }, (i - 5) * 50); // 50ms delay between batches
            }
          }
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
  }, [chain]);

  const fetchTokens = async (pageKey?: string, silent = false) => {
    try {
      if (pageKey) {
        setLoadingMore(true);
      } else if (!silent) {
        setLoading(true);
      }

      // Use cache endpoint for instant response
      let url = `/api/prc20-tokens/cache`;
      // Note: Cache returns all tokens, pagination handled client-side

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch PRC20 tokens');
      }

      const data = await response.json();
      const newTokens = data.tokens || [];

      // Cache returns all tokens - no pagination needed
      setTokens(newTokens);
      setDisplayTokens(newTokens); // Show all instantly from cache
      setNextKey(null); // No pagination
      
      // Cache the data
      const cacheKey = `prc20_tokens_${chain}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        data: {
          tokens: newTokens,
          next_key: null
        },
        timestamp: Date.now()
      }));

      setIsInitialLoad(false);
    } catch (err: any) {
      if (!silent) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Fetch in background (silent mode if we have cached data)
    const hasCachedData = tokens.length > 0;
    fetchTokens(undefined, hasCachedData);
  }, [chain]);

  const formatSupply = (supply: string, decimals: number) => {
    const num = parseFloat(supply) / Math.pow(10, decimals);
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  if (isInitialLoad && loading && tokens.length === 0) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-400 mt-4">Loading PRC20 tokens...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && tokens.length === 0) {
    return (
      <div className="min-h-screen bg-black p-3 md:p-6 pt-32 md:pt-24">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 md:p-6 text-center">
            <p className="text-red-400 text-sm md:text-base">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-3 md:p-6 pt-32 md:pt-24">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">PRC20 Tokens</h1>
            <p className="text-gray-400">CosmWasm smart contract tokens on {chain}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Tokens</p>
            <p className="text-2xl font-bold text-white">{tokens.length}</p>
          </div>
        </div>

        {/* Tokens Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTokens.map((token) => (
            <div
              key={token.contract_address}
              className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/20"
            >
              {/* Token Header */}
              <div className="flex items-start gap-4 mb-4">
                {token.marketing_info?.logo?.url ? (
                  <img
                    src={token.marketing_info.logo.url}
                    alt={token.token_info?.symbol || 'Token'}
                    className="w-12 h-12 rounded-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null; // Prevent infinite loop
                      target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(token.token_info?.symbol || '?')}&size=48&background=random`;
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {token.token_info?.symbol?.[0] || '?'}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white truncate">
                      {token.token_info?.symbol || 'Unknown'}
                    </h3>
                    {token.verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400 border border-yellow-500/30" title="Verified Token">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {token.token_info?.name || 'Unknown Token'}
                  </p>
                </div>
              </div>

              {/* Token Stats */}
              {token.token_info && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Total Supply:</span>
                    <span className="text-white font-medium">
                      {formatSupply(token.token_info.total_supply, token.token_info.decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Decimals:</span>
                    <span className="text-white font-medium">{token.token_info.decimals}</span>
                  </div>
                </div>
              )}

              {/* Marketing Info */}
              {token.marketing_info?.description && (
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                  {token.marketing_info.description}
                </p>
              )}

              {/* Contract Address */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 mb-1">Contract Address</p>
                <Link
                  href={`/${chain}/account/${token.contract_address}`}
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono break-all"
                >
                  {token.contract_address}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {nextKey && (
          <div className="text-center pt-6">
            <button
              onClick={() => fetchTokens(nextKey)}
              disabled={loadingMore}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition-colors font-medium"
            >
              {loadingMore ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Loading...
                </>
              ) : (
                'Load More Tokens'
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {tokens.length === 0 && !loading && (
          <div className="text-center py-20">
            <p className="text-gray-400">No PRC20 tokens found</p>
          </div>
        )}
      </div>
    </div>
  );
}
