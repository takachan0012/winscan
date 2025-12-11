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

  useEffect(() => {
    loadAssetMetadata();
    loadHolders();
  }, [chainName, denom]);

  const loadAssetMetadata = async () => {
    try {
      // Check if PRC20 token
      const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
      
      if (isPRC20) {
        // Fetch PRC20 token info and marketing info
        const [tokenInfoRes, marketingInfoRes] = await Promise.all([
          fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=token_info`),
          fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=marketing_info`)
        ]);
        
        if (tokenInfoRes.ok && marketingInfoRes.ok) {
          const tokenInfo = await tokenInfoRes.json();
          const marketingInfo = await marketingInfoRes.json();
          
          let logo = marketingInfo?.logo?.url || '';
          if (logo.startsWith('ipfs://')) {
            logo = `https://ipfs.io/ipfs/${logo.replace('ipfs://', '')}`;
          }
          
          setAssetMetadata({
            logo,
            symbol: tokenInfo.symbol || 'PRC20',
            name: tokenInfo.name || marketingInfo.project || 'PRC20 Token'
          });
        }
      } else {
        // Regular asset metadata
        const res = await fetch(`/api/assets?chain=${chainName}`);
        if (res.ok) {
          const assetsData = await res.json();
          const asset = assetsData.metadatas?.find((a: any) => a.base === denom);
          if (asset) {
            let logo = asset.logo || asset.uri;
            
            // If no logo found, use chain registry URL
            if (!logo && asset.symbol) {
              logo = getChainRegistryLogoUrl(chainName, asset.symbol);
            }
            
            setAssetMetadata({
              logo,
              symbol: asset.symbol || asset.name,
              name: asset.name
            });
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
      
      // Check if it's a PRC20 contract
      const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
      
      if (isPRC20) {
        // For PRC20, query all_accounts and then get balances
        const accountsRes = await fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=all_accounts`);
        
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          const accounts = accountsData.accounts || [];
          
          // Fetch balances for each account (limit to first 50 for performance)
          const accountsToFetch = accounts.slice(0, 50);
          const holdersWithBalance = await Promise.all(
            accountsToFetch.map(async (address: string) => {
              try {
                const balanceRes = await fetch(
                  `/api/prc20-balance?contract=${encodeURIComponent(denom)}&address=${encodeURIComponent(address)}`
                );
                
                if (balanceRes.ok) {
                  const balanceData = await balanceRes.json();
                  return {
                    address: address,
                    balance: balanceData.balance || '0',
                    percentage: 0
                  };
                }
              } catch (err) {
                console.error(`Error fetching balance for ${address}:`, err);
              }
              
              return {
                address: address,
                balance: '0',
                percentage: 0
              };
            })
          );
          
          // Get token info for total supply to calculate percentages
          const tokenInfoRes = await fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=token_info`);
          let totalSupply = '0';
          
          if (tokenInfoRes.ok) {
            const tokenInfo = await tokenInfoRes.json();
            totalSupply = tokenInfo.total_supply || '0';
          }
          
          // Calculate percentages
          const totalSupplyNum = BigInt(totalSupply);
          const holdersWithPercentage = holdersWithBalance.map(holder => ({
            ...holder,
            percentage: totalSupplyNum > 0 
              ? (Number(BigInt(holder.balance) * BigInt(10000) / totalSupplyNum) / 100)
              : 0
          }));
          
          // Sort by balance descending
          holdersWithPercentage.sort((a, b) => {
            const balA = BigInt(a.balance);
            const balB = BigInt(b.balance);
            return balA > balB ? -1 : balA < balB ? 1 : 0;
          });
          
          setData({
            denom: denom,
            totalSupply: totalSupply,
            holders: holdersWithPercentage,
            count: accounts.length,
            message: 'PRC20 token holders',
            note: `Showing top ${holdersWithPercentage.length} of ${accounts.length} holder${accounts.length !== 1 ? 's' : ''}`
          });
        } else {
          setData({
            denom: denom,
            totalSupply: '0',
            holders: [],
            count: 0,
            message: 'PRC20 token holders',
            note: 'Unable to fetch holder data'
          });
        }
      } else {
        // Regular chain holders
        const res = await fetch(
          `/api/holders?chain=${chainName}&denom=${encodeURIComponent(denom)}&limit=200&_t=${Date.now()}`,
          { cache: 'no-store' }
        );
        
        if (res.ok) {
          const holdersData = await res.json();
          console.log('=== FULL RESPONSE ===', JSON.stringify(holdersData, null, 2));
          console.log('Holders array:', holdersData.holders);
          console.log('Holders length:', holdersData.holders?.length);
          console.log('First holder:', holdersData.holders?.[0]);
          setData(holdersData);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
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
    <div className="space-y-6">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-10 h-10 rounded-lg bg-blue-500/20 border border-gray-700 flex items-center justify-center overflow-hidden">
            {assetMetadata?.logo ? (
              <Image
                src={assetMetadata.logo}
                alt={assetMetadata.symbol || 'token'}
                width={40}
                height={40}
                className="object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <TrendingUp className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Top Holders {assetMetadata?.symbol && `- ${assetMetadata.symbol}`}
            </h2>
            <p className="text-gray-400 text-sm">
              Total Supply: {formatBalance(data.totalSupply)} {assetMetadata?.symbol || data.denom}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address..."
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchHolder()}
              className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg pl-11 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={searchHolder}
            disabled={searching}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
          {searchAddress && (
            <button
              onClick={() => {
                setSearchAddress('');
                loadHolders();
              }}
              className="px-4 py-2.5 bg-[#0f0f0f] border border-gray-800 text-gray-400 hover:text-white text-sm rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
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

        <div className="overflow-x-auto">
          {data.holders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No holders found
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Address</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Percentage</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Token Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.holders.map((holder, idx) => {
                  console.log(`Rendering holder ${idx}:`, holder);
                  return (
                    <tr
                      key={holder.address}
                      className="hover:bg-[#0f0f0f] transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-400">{idx + 1}</td>
                      
                      {/* Token Name with Logo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-full bg-blue-500/20 border border-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {assetMetadata?.logo ? (
                              <Image
                                src={assetMetadata.logo}
                                alt={assetMetadata.symbol || 'token'}
                                width={32}
                                height={32}
                                className="object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Coins className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {assetMetadata?.symbol || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {assetMetadata?.name || data.denom.slice(0, 20)}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-blue-400">
                            {holder.address.slice(0, 12)}...{holder.address.slice(-8)}
                          </span>
                          <button
                            onClick={() => copyAddress(holder.address)}
                            className="text-gray-400 hover:text-white transition"
                          >
                            {copiedAddress === holder.address ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-white">
                        {formatBalance(holder.balance)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                          {holder.percentage?.toFixed(4)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border ${
                          data.denom.startsWith('paxi1') && data.denom.length > 40
                            ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border-orange-500/20'
                            : data.denom.startsWith('ibc/') 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                            : data.denom.startsWith('gamm/') 
                            ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}>
                          {data.denom.startsWith('paxi1') && data.denom.length > 40 ? 'PRC20' : data.denom.startsWith('ibc/') ? 'IBC Token' : data.denom.startsWith('gamm/') ? 'LP Token' : 'Native'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
