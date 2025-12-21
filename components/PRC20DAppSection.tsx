'use client';

import { useState, useEffect } from 'react';
import { ChainData } from '@/types/chain';
import { ArrowDownUp, Settings, Info, Zap, AlertCircle, RefreshCw, Send, Flame, TrendingUp } from 'lucide-react';
import { getPoolPrice, calculateSwapOutput } from '@/lib/poolPriceCalculator';
import { useWallet } from '@/contexts/WalletContext';
import { connectKeplr } from '@/lib/keplr';
import { transferPRC20Tokens, burnPRC20Tokens } from '@/lib/prc20Actions';

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  balance?: string;
}

export default function PRC20DAppSection() {
  const { account, setAccount } = useWallet();
  
  // Simple toast notification
  const toast = {
    success: (title: string, options?: any) => {
      alert(`✅ ${title}${options?.description ? '\n' + options.description : ''}`);
    },
    error: (title: string, options?: any) => {
      alert(`❌ ${title}${options?.description ? '\n' + options.description : ''}`);
    }
  };
  
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [loading, setLoading] = useState(false);
  const [swapPercentage, setSwapPercentage] = useState(0);
  const [memo, setMemo] = useState('PRC20 DApp');
  const [refreshing, setRefreshing] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<string, { price_paxi: number; price_usd: number; price_change_24h: number }>>({});
  const [activeTab, setActiveTab] = useState<'market' | 'swap' | 'transfer' | 'burn'>('market');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'holders' | 'supply' | 'name'>('name');
  
  // Transfer states
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  
  // Burn states
  const [burnAmount, setBurnAmount] = useState('');
  const [burnConfirmed, setBurnConfirmed] = useState(false);

  useEffect(() => {
    loadChainConfig();
    loadTokens();
  }, []);

  useEffect(() => {
    if (tokens.length > 0) {
      loadMarketPrices();
    }
  }, [tokens]);

  // Load balances only for selected tokens
  useEffect(() => {
    if (account?.address && (fromToken || toToken)) {
      loadSelectedBalances();
    }
  }, [fromToken, toToken, account]);

  // Auto-calculate output
  useEffect(() => {
    if (!fromAmount || !fromToken || !toToken) {
      setToAmount('');
      return;
    }

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      setToAmount('');
      return;
    }

    calculateOutput();
  }, [fromAmount, fromToken, toToken, marketPrices]);

  const loadChainConfig = async () => {
    try {
      const config = await fetch('/paxi-1.json').then(r => r.json());
      setSelectedChain({
        chain_id: config.chain_id,
        chain_name: config.chain_name,
        api: config.apis.rest.map((r: any) => ({ address: r.address, provider: r.provider || 'unknown' })),
        rpc: config.apis.rpc.map((r: any) => ({ address: r.address, provider: r.provider || 'unknown' })),
        sdk_version: '0.47.0',
        coin_type: config.slip44?.toString() || '118',
        min_tx_fee: '1000',
        gas_price: config.fees?.fee_tokens?.[0]?.fixed_min_gas_price?.toString() || '0.025',
        assets: [{
          base: 'upaxi',
          symbol: 'PAXI',
          display: 'PAXI',
          exponent: 6,
          logo: ''
        }],
        addr_prefix: config.bech32_prefix,
        bech32_prefix: config.bech32_prefix,
        theme_color: '#3b82f6',
        logo: ''
      } as ChainData);
    } catch (error) {
      console.error('Failed to load chain config:', error);
    }
  };

  const loadTokens = async () => {
    try {
      const sslEndpoints = [
        'https://ssl.winsnip.xyz',
        'https://ssl2.winsnip.xyz'
      ];

      for (const url of sslEndpoints) {
        try {
          const res = await fetch(`${url}/api/prc20-tokens?chain=paxi-mainnet`, {
            signal: AbortSignal.timeout(5000)
          });
          if (res.ok) {
            const data = await res.json();
            
            const native: Token = {
              address: 'upaxi',
              name: 'PAXI',
              symbol: 'PAXI',
              decimals: 6,
              balance: '0'
            };

            const prc20Tokens = (data.tokens || []).map((token: any) => ({
              address: token.contract_address,
              name: token.token_info?.name || token.name || 'Unknown',
              symbol: token.token_info?.symbol || token.symbol || 'UNK',
              decimals: parseInt(token.token_info?.decimals || token.decimals || '18'),
              logo: token.marketing_info?.logo?.url,
              balance: '0'
            }));

            setTokens([native, ...prc20Tokens]);
            console.log(`✅ Loaded ${prc20Tokens.length} tokens from ${url}`);
            return;
          }
        } catch (err) {
          continue;
        }
      }

      const res = await fetch('/api/prc20-tokens?chain=paxi-mainnet');
      const data = await res.json();
      const native: Token = {
        address: 'upaxi',
        name: 'PAXI',
        symbol: 'PAXI',
        decimals: 6,
        balance: '0'
      };
      const prc20Tokens = (data.tokens || []).map((token: any) => ({
        address: token.contract_address,
        name: token.token_info?.name || 'Unknown',
        symbol: token.token_info?.symbol || 'UNK',
        decimals: parseInt(token.token_info?.decimals || '18'),
        logo: token.marketing_info?.logo?.url,
        balance: '0'
      }));
      setTokens([native, ...prc20Tokens]);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  };

  const loadMarketPrices = async () => {
    try {
      const poolsResponse = await fetch(
        'https://mainnet-lcd.paxinet.io/paxi/swap/all_pools',
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!poolsResponse.ok) return;

      const poolsData = await poolsResponse.json();
      const pools = poolsData.pools || poolsData.result?.pools || poolsData;
      
      if (!Array.isArray(pools) || pools.length === 0) return;

      const calculatedPrices: Record<string, { price_paxi: number; price_usd: number; price_change_24h: number }> = {};
      
      for (const pool of pools) {
        const prc20Address = pool.prc20 || pool.prc20_address || pool.token || pool.contract_address;
        if (!prc20Address) continue;

        try {
          const poolPrice = await getPoolPrice(prc20Address);
          if (poolPrice) {
            calculatedPrices[prc20Address] = {
              price_paxi: poolPrice.price,
              price_usd: poolPrice.price,
              price_change_24h: 0
            };

            setTokens(prev => prev.map(t => 
              t.address === prc20Address && t.decimals !== poolPrice.decimals
                ? { ...t, decimals: poolPrice.decimals }
                : t
            ));
          }
        } catch (error) {
          console.error(`Error calculating price for ${prc20Address}:`, error);
        }
      }

      setMarketPrices(calculatedPrices);
    } catch (error) {
      console.error('Failed to load market prices:', error);
    }
  };

  const loadSelectedBalances = async () => {
    if (!account?.address) return;

    setRefreshing(true);
    try {
      const tokensToUpdate = [fromToken, toToken].filter(Boolean) as Token[];
      
      const balanceUpdates = await Promise.all(
        tokensToUpdate.map(async (token) => {
          try {
            if (token.address === 'upaxi') {
              const res = await fetch(
                `https://mainnet-lcd.paxinet.io/cosmos/bank/v1beta1/balances/${account.address}/by_denom?denom=upaxi`
              );
              if (res.ok) {
                const data = await res.json();
                return { address: token.address, balance: data.balance?.amount || '0' };
              }
            } else {
              const res = await fetch(
                `/api/prc20-balance?contract=${token.address}&address=${account.address}`
              );
              if (res.ok) {
                const data = await res.json();
                return { address: token.address, balance: data.balance || '0' };
              }
            }
          } catch (error) {
            console.error(`Failed to load balance for ${token.symbol}:`, error);
          }
          return { address: token.address, balance: '0' };
        })
      );

      setTokens(prev => prev.map(token => {
        const update = balanceUpdates.find(u => u.address === token.address);
        return update ? { ...token, balance: update.balance } : token;
      }));
      
      if (fromToken) {
        const update = balanceUpdates.find(u => u.address === fromToken.address);
        if (update) setFromToken({ ...fromToken, balance: update.balance });
      }
      if (toToken) {
        const update = balanceUpdates.find(u => u.address === toToken.address);
        if (update) setToToken({ ...toToken, balance: update.balance });
      }
    } catch (error) {
      console.error('Failed to load balances:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const calculateOutput = async () => {
    if (!fromToken || !toToken || !fromAmount) return;

    const amount = parseFloat(fromAmount);
    let calculatedAmount = 0;

    try {
      if (fromToken.address === 'upaxi' && toToken.address !== 'upaxi') {
        let tokenPrice = marketPrices[toToken.address]?.price_paxi;
        
        if (!tokenPrice) {
          const poolData = await getPoolPrice(toToken.address);
          if (poolData) {
            tokenPrice = poolData.price;
            setMarketPrices(prev => ({
              ...prev,
              [toToken.address]: {
                price_paxi: tokenPrice!,
                price_usd: tokenPrice!,
                price_change_24h: 0
              }
            }));
          }
        }

        if (tokenPrice) {
          calculatedAmount = calculateSwapOutput(amount, 'upaxi', toToken.address, tokenPrice);
        }
      } else if (fromToken.address !== 'upaxi' && toToken.address === 'upaxi') {
        let tokenPrice = marketPrices[fromToken.address]?.price_paxi;
        
        if (!tokenPrice) {
          const poolData = await getPoolPrice(fromToken.address);
          if (poolData) {
            tokenPrice = poolData.price;
            setMarketPrices(prev => ({
              ...prev,
              [fromToken.address]: {
                price_paxi: tokenPrice!,
                price_usd: tokenPrice!,
                price_change_24h: 0
              }
            }));
          }
        }

        if (tokenPrice) {
          calculatedAmount = calculateSwapOutput(amount, fromToken.address, 'upaxi', tokenPrice);
        }
      } else {
        calculatedAmount = amount;
      }

      const displayDecimals = Math.min(toToken.decimals, 6);
      setToAmount(calculatedAmount.toFixed(displayDecimals));
    } catch (error) {
      console.error('Error calculating output:', error);
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !account?.address || !selectedChain) {
      toast.error('Please fill all fields and connect wallet');
      return;
    }

    setLoading(true);
    try {
      // Placeholder for swap - you'll need to implement actual swap logic
      toast.success('Swap initiated!', {
        description: `Swapping ${fromAmount} ${fromToken.symbol} to ${toToken.symbol}`
      });
      setFromAmount('');
      setToAmount('');
      setTimeout(() => loadSelectedBalances(), 3000);
    } catch (error: any) {
      console.error('Swap failed:', error);
      toast.error('Swap failed', {
        description: error.message || 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!fromToken || !transferAmount || !recipientAddress || !selectedChain) {
      toast.error('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const amountInBaseUnits = Math.floor(parseFloat(transferAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      const result = await transferPRC20Tokens(
        selectedChain.chain_id || 'paxi-1',
        fromToken.address,
        recipientAddress,
        amountInBaseUnits,
        'Transfer via PRC20 DApp'
      );

      if (result.success) {
        toast.success('Transfer successful!', {
          description: `Sent ${transferAmount} ${fromToken.symbol}`,
          txHash: result.txHash,
          duration: 8000
        });
        setTransferAmount('');
        setRecipientAddress('');
        setTimeout(() => loadSelectedBalances(), 3000);
      } else {
        throw new Error(result.error || 'Transfer failed');
      }
    } catch (error: any) {
      console.error('Transfer failed:', error);
      toast.error('Transfer failed', {
        description: error.message,
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async () => {
    if (!fromToken || !burnAmount || !burnConfirmed || !selectedChain) {
      toast.error('Please confirm burn operation');
      return;
    }

    setLoading(true);
    try {
      const amountInBaseUnits = Math.floor(parseFloat(burnAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      const result = await burnPRC20Tokens(
        selectedChain,
        fromToken.address,
        amountInBaseUnits,
        'Burn via PRC20 DApp'
      );

      if (result.success) {
        toast.success('Burn successful!', {
          description: `Burned ${burnAmount} ${fromToken.symbol}`,
          txHash: result.txHash,
          duration: 8000
        });
        setBurnAmount('');
        setBurnConfirmed(false);
        setTimeout(() => loadSelectedBalances(), 3000);
      } else {
        throw new Error(result.error || 'Burn failed');
      }
    } catch (error: any) {
      console.error('Burn failed:', error);
      toast.error('Burn failed', {
        description: error.message,
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedChain) return;
    
    try {
      const keplrAccount = await connectKeplr(selectedChain);
      setAccount(keplrAccount);
      setTimeout(() => loadSelectedBalances(), 500);
    } catch (error: any) {
      toast.error('Failed to connect', {
        description: error.message
      });
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const formatBalance = (balance: string, decimals: number = 6): string => {
    if (!balance || balance === '0') return '0.0000';
    const num = Number(balance) / Math.pow(10, decimals);
    return num.toFixed(4);
  };

  const getFilteredTokens = () => {
    let filtered = tokens.filter(t => t.address !== 'upaxi');
    
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.symbol.localeCompare(b.symbol);
      }
      return 0;
    });
    
    return filtered;
  };

  return (
    <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-3">
            PRC20 Token Hub
          </h2>
          <p className="text-gray-500 text-sm">
            Discover, trade, and manage all PRC20 tokens on PAXI Network in one place
          </p>
        </div>

        {/* Wallet Connection */}
        {!account?.address && (
          <div className="mb-6 text-center">
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
            >
              Connect Keplr Wallet
            </button>
          </div>
        )}

        {account?.address && (
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-mono text-green-400">
                {account.address.slice(0, 12)}...{account.address.slice(-6)}
              </span>
            </div>
            <button
              onClick={() => loadSelectedBalances()}
              disabled={refreshing}
              className="p-2 hover:bg-gray-800/50 rounded-md transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* Market Tab with integrated tabs */}
        {activeTab === 'market' && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, symbol, or contract address..."
                  className="w-full px-4 py-3 pl-10 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort by Name</option>
                <option value="holders">Sort by Holders</option>
                <option value="supply">Sort by Supply</option>
              </select>
            </div>

            {/* Tabs - Positioned after search */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('market')}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
              >
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Market
                </div>
              </button>
              <button
                onClick={() => setActiveTab('swap')}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <ArrowDownUp className="w-4 h-4" />
                  Swap
                </div>
              </button>
              <button
                onClick={() => setActiveTab('transfer')}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Transfer
                </div>
              </button>
              <button
                onClick={() => setActiveTab('burn')}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800 transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <Flame className="w-4 h-4" />
                  Burn
                </div>
              </button>
            </div>

            {/* Token Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto">
              {getFilteredTokens().map((token) => {
                const price = marketPrices[token.address];
                return (
                  <div key={token.address} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    {/* Token Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        {token.logo ? (
                          <img src={token.logo} alt={token.symbol} className="w-12 h-12 rounded-full" />
                        ) : (
                          <span className="text-white font-bold text-lg">{token.symbol[0]}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-lg">{token.symbol}</h3>
                        </div>
                        <p className="text-sm text-gray-400">{token.name}</p>
                      </div>
                    </div>

                    {/* Token Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Price</div>
                        <div className="text-sm font-semibold text-white">
                          {price ? `$${price.price_paxi.toFixed(6)}` : 'Loading...'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Supply</div>
                        <div className="text-sm font-semibold text-white">
                          {(parseInt(token.balance || '0') / Math.pow(10, token.decimals)).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Decimals</div>
                        <div className="text-sm font-semibold text-white">{token.decimals}</div>
                      </div>
                    </div>

                    {/* Contract Address */}
                    <div className="p-2 bg-black/50 rounded border border-gray-800">
                      <div className="text-xs text-gray-500 mb-1">Contract Address</div>
                      <div className="text-xs font-mono text-gray-400 break-all">{token.address}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {getFilteredTokens().length === 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-400">No tokens found</p>
              </div>
            )}
          </div>
        )}

        {/* Swap Tab */}
        {activeTab === 'swap' && (
          <div className="max-w-md mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Swap Tokens</h3>
                <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* From Token */}
              <div className="mb-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">From</label>
                  <button
                    onClick={() => {
                      if (fromToken?.balance) {
                        const maxAmount = (parseFloat(fromToken.balance) / Math.pow(10, fromToken.decimals)).toString();
                        setFromAmount(maxAmount);
                      }
                    }}
                    className="text-xs text-blue-500 hover:text-blue-400 font-medium"
                  >
                    MAX
                  </button>
                </div>
                
                <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="number"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-3xl text-white font-medium focus:outline-none w-full"
                    />
                    <select
                      value={fromToken?.address || 'upaxi'}
                      onChange={(e) => {
                        const token = tokens.find(t => t.address === e.target.value);
                        setFromToken(token || null);
                      }}
                      className="ml-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {tokens.map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Percentage Slider */}
                  <div className="mb-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={swapPercentage}
                      onChange={(e) => {
                        const percentage = parseFloat(e.target.value);
                        setSwapPercentage(percentage);
                        if (fromToken?.balance && percentage > 0) {
                          const maxAmount = parseFloat(fromToken.balance) / Math.pow(10, fromToken.decimals);
                          const amount = (maxAmount * percentage / 100).toFixed(6);
                          setFromAmount(amount);
                        } else if (percentage === 0) {
                          setFromAmount('');
                        }
                      }}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-gray-500">0%</span>
                      <span className="text-xs text-gray-500">50%</span>
                      <span className="text-xs text-gray-500">Max</span>
                    </div>
                  </div>

                  {fromToken && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{fromToken.symbol}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Balance:</span>
                        <span className="text-white font-medium">{formatBalance(fromToken.balance || '0', fromToken.decimals)}</span>
                        <span className="text-gray-500">{fromToken.symbol}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center -my-0.5 relative z-10">
                <button
                  onClick={switchTokens}
                  className="p-1.5 bg-gray-900 border border-gray-700 hover:border-blue-500 rounded-lg transition-colors"
                >
                  <ArrowDownUp className="w-4 h-4 text-gray-400 rotate-90" />
                </button>
              </div>

              {/* To Token */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">To</label>
                </div>
                
                <div className="bg-black/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      value={toAmount}
                      readOnly
                      placeholder="0.0"
                      className="bg-transparent text-3xl text-white font-medium focus:outline-none w-full"
                    />
                    <select
                      value={toToken?.address || ''}
                      onChange={(e) => {
                        const token = tokens.find(t => t.address === e.target.value);
                        setToToken(token || null);
                      }}
                      className="ml-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select token</option>
                      {tokens.filter(t => t.address !== fromToken?.address).map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="mb-4 flex items-start gap-2 p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-200/90">
                  Please review all swap details carefully. Ensure you have enough balance for network fees.
                </p>
              </div>

              {/* Swap Button */}
              <button
                onClick={handleSwap}
                disabled={loading || !fromToken || !toToken || !fromAmount || !account}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Swapping...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Swap
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Transfer Tab */}
        {activeTab === 'transfer' && (
          <div className="max-w-md mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Transfer Tokens</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token</label>
                  <select
                    value={fromToken?.address || ''}
                    onChange={(e) => {
                      const token = tokens.find(t => t.address === e.target.value);
                      setFromToken(token || null);
                    }}
                    className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select token</option>
                    {tokens.filter(t => t.address !== 'upaxi').map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Recipient Address</label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="paxi1..."
                    className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Amount</label>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {fromToken && account?.address && (
                    <div className="text-xs text-gray-400 mt-2">
                      Available: {formatBalance(fromToken.balance || '0', fromToken.decimals)} {fromToken.symbol}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleTransfer}
                  disabled={loading || !fromToken || !recipientAddress || !transferAmount || !account}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Transferring...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Burn Tab */}
        {activeTab === 'burn' && (
          <div className="max-w-md mx-auto">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Burn Tokens</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Token</label>
                  <select
                    value={fromToken?.address || ''}
                    onChange={(e) => {
                      const token = tokens.find(t => t.address === e.target.value);
                      setFromToken(token || null);
                    }}
                    className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select token</option>
                    {tokens.filter(t => t.address !== 'upaxi').map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Amount</label>
                  <input
                    type="number"
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {fromToken && account?.address && (
                    <div className="text-xs text-gray-400 mt-2">
                      Available: {formatBalance(fromToken.balance || '0', fromToken.decimals)} {fromToken.symbol}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-400">
                      <p className="font-semibold mb-1">⚠️ Warning: Irreversible Action</p>
                      <p>Burning tokens will permanently remove them from circulation. This action cannot be undone.</p>
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={burnConfirmed}
                    onChange={(e) => setBurnConfirmed(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-300">I understand this action is irreversible</span>
                </label>

                <button
                  onClick={handleBurn}
                  disabled={loading || !fromToken || !burnAmount || !burnConfirmed || !account}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Burning...
                    </>
                  ) : (
                    <>
                      <Flame className="w-5 h-5" />
                      Burn Tokens
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
