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
}

export default function PRC20TokensPage() {
  const params = useParams();
  const chain = params.chain as string;

  const [tokens, setTokens] = useState<PRC20Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextKey, setNextKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTokens = async (pageKey?: string) => {
    try {
      if (pageKey) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let url = `/api/prc20-tokens?chain=${chain}&limit=20`;
      if (pageKey) {
        url += `&key=${encodeURIComponent(pageKey)}`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch PRC20 tokens');
      }

      const data = await response.json();

      if (pageKey) {
        setTokens(prev => [...prev, ...data.tokens]);
      } else {
        setTokens(data.tokens);
      }

      setNextKey(data.pagination.next_key || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [chain]);

  const formatSupply = (supply: string, decimals: number) => {
    const num = parseFloat(supply) / Math.pow(10, decimals);
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  if (loading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
          {tokens.map((token) => (
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
                    className="w-12 h-12 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/48?text=?';
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
                  <h3 className="text-xl font-bold text-white truncate">
                    {token.token_info?.symbol || 'Unknown'}
                  </h3>
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
