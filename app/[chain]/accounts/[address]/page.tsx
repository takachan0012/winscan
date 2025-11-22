'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { ChainData, TransactionData } from '@/types/chain';
import { Wallet, Copy, CheckCircle, XCircle, ArrowLeftRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { getAddressVariants, detectAddressType } from '@/lib/addressConverter';

interface AccountDetail {
  address: string;
  balances: Array<{
    denom: string;
    amount: string;
  }>;
  delegations: Array<{
    validator: string;
    amount: string;
    validatorInfo?: {
      moniker: string;
      identity?: string;
      operatorAddress: string;
    };
  }>;
  rewards: Array<{
    validator: string;
    amount: string;
  }>;
}

export default function AccountPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addressVariants, setAddressVariants] = useState<{
    bech32: string;
    eth: string;
    original: string;
    type: 'bech32' | 'eth' | 'unknown';
  } | null>(null);

  useEffect(() => {

    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetch('/api/chains')
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = params?.chain as string;
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          if (chain) setSelectedChain(chain);
        })
        .catch(err => console.error('Error loading chains:', err));
    }
  }, [params]);

  useEffect(() => {
    if (selectedChain && params?.address) {
      const addressStr = params.address as string;
      
      // Detect and convert address for EVM-compatible chains
      const chainPrefix = selectedChain.addr_prefix || 'cosmos';
      const variants = getAddressVariants(addressStr, chainPrefix);
      setAddressVariants(variants);
      
      // Use bech32 address for API calls (Cosmos SDK expects bech32)
      const queryAddress = variants.type === 'eth' ? variants.bech32 : addressStr;

      const cacheKey = `account_${selectedChain.chain_name}_${queryAddress}`;
      const cached = sessionStorage.getItem(cacheKey);
      
      // Stale-while-revalidate: Show cache immediately if available
      if (cached) {
        const { accountData, txData, timestamp } = JSON.parse(cached);
        setAccount(accountData);

        const sortedTxs = Array.isArray(txData) 
          ? [...txData].sort((a, b) => (b.height || 0) - (a.height || 0))
          : [];
        setTransactions(sortedTxs);
        setLoading(false);
        setError(null); // Clear any previous error

        // If cache is still fresh (< 30s), still fetch in background for updates
        // But don't skip the fetch - always revalidate
      } else {
        setLoading(true);
        setError(null);
      }

      // Always fetch fresh data (in background if cache exists)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15s
      
      fetch(`/api/accounts?chain=${selectedChain.chain_id || selectedChain.chain_name}&address=${queryAddress}`, { signal: controller.signal })
        .then(r => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          }
          return r.json();
        })
        .then((accountData) => {
          if (accountData && accountData.error) {
            throw new Error(accountData.error);
          }
          
          if (accountData) {
            setAccount(accountData);

            const txs = accountData.transactions || [];
            const sortedTxs = Array.isArray(txs) 
              ? [...txs].sort((a: any, b: any) => (b.height || 0) - (a.height || 0))
              : [];
            setTransactions(sortedTxs);
            setError(null); // Clear error on success
          }
          setLoading(false);

          sessionStorage.setItem(cacheKey, JSON.stringify({
            accountData: accountData || null,
            txData: accountData?.transactions || [],
            timestamp: Date.now()
          }));
        })
        .catch(err => {
          console.error('Error loading account:', err);
          
          // Only show error if we don't have cached data
          if (!cached) {
            setLoading(false);
            if (err.name === 'AbortError') {
              setError('Request timeout. The RPC endpoint is not responding. Please try again later.');
            } else {
              setError(`Failed to load account data: ${err.message}`);
            }
          } else {
            // We have cache, so just log the error but keep showing cached data
            console.warn('Failed to refresh account data, showing cached version:', err);
            setError(`⚠️ Showing cached data. Failed to refresh: ${err.message}`);
          }
        })
        .finally(() => clearTimeout(timeoutId));
    }
  }, [selectedChain, params]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
  const asset = selectedChain?.assets[0];

  const formatAmount = (amount: string, denom?: string) => {
    if (!asset) return amount;
    const amountNum = parseFloat(amount) / Math.pow(10, Number(asset.exponent));
    return `${amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${denom || asset.symbol}`;
  };

  const copyAddress = () => {
    if (params?.address) {
      navigator.clipboard.writeText(params.address as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeShortName = (type: string) => {
    const parts = type.split('.');
    return parts[parts.length - 1] || type;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <main className="flex-1 mt-16 p-6 overflow-auto">
          <div className="mb-6">
            <div className="flex items-center text-sm text-gray-400 mb-4">
              <Link href={`/${chainPath}`} className="hover:text-white">{t('accountDetail.overview')}</Link>
              <span className="mx-2">/</span>
              <span className="text-white">{t('accountDetail.account')}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-4 flex items-center">
              <Wallet className="w-8 h-8 mr-3" />
              {t('accountDetail.title')}
            </h1>
            
            {/* Address with EVM/Bech32 variants */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              {addressVariants && addressVariants.type !== 'unknown' && (
                <>
                  {/* Show both formats for EVM-compatible chains */}
                  {addressVariants.bech32 && addressVariants.eth && (
                    <div className="mb-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm font-medium">Cosmos (Bech32):</span>
                        <div className="flex items-center flex-1 gap-2">
                          <code className="text-blue-400 font-mono text-sm break-all flex-1">
                            {addressVariants.bech32}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(addressVariants.bech32);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                            title="Copy Bech32 address"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm font-medium">EVM (Hex):</span>
                        <div className="flex items-center flex-1 gap-2">
                          <code className="text-purple-400 font-mono text-sm break-all flex-1">
                            {addressVariants.eth}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(addressVariants.eth);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                            title="Copy EVM address"
                          >
                            {copied ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>This chain supports both Cosmos and EVM addresses (same account)</span>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Fallback: show original address if no variants */}
              {(!addressVariants || addressVariants.type === 'unknown') && (
                <div className="flex items-center justify-between">
                  <code className="text-blue-400 font-mono text-sm md:text-base break-all">
                    {params?.address}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="ml-4 p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                    title={t('accountDetail.copyAddress')}
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-6 border rounded-lg p-4 ${
              error.startsWith('⚠️') 
                ? 'bg-yellow-900/20 border-yellow-700/50' 
                : 'bg-red-900/20 border-red-700/50'
            }`}>
              <p className={error.startsWith('⚠️') ? 'text-yellow-400' : 'text-red-400'}>
                {error}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">{t('accountDetail.loading')}</p>
            </div>
          ) : account ? (
            <div className="space-y-6">
              {/* Balances */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">{t('accountDetail.balances')}</h2>
                {account.balances && account.balances.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {account.balances.map((balance, idx) => (
                      <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">{t('accountDetail.available')}</p>
                        <p className="text-2xl font-bold text-white">
                          {formatAmount(balance.amount, balance.denom === asset?.base ? asset.symbol : balance.denom)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">{t('accountDetail.noBalances')}</p>
                )}
              </div>

              {/* Delegations */}
              {account.delegations && account.delegations.length > 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4">
                    {t('accountDetail.delegations')} ({account.delegations.length})
                  </h2>
                  <div className="space-y-3">
                    {account.delegations.map((delegation: any, idx) => {
                      const validatorInfo = delegation.validatorInfo || delegation.validator_info;
                      const validatorAddr = delegation.delegation?.validator_address || delegation.validator_address || delegation.validator || '';
                      const amount = delegation.balance?.amount || delegation.amount || '0';
                      const denom = delegation.balance?.denom || asset?.base || '';
                      
                      return (
                        <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {validatorInfo && (
                                <ValidatorAvatar 
                                  identity={validatorInfo.identity}
                                  moniker={validatorInfo.moniker}
                                  size="md"
                                />
                              )}
                              <div className="flex-1">
                                <p className="text-gray-400 text-sm mb-1">{t('accountDetail.validator')}</p>
                                {validatorInfo ? (
                                  <Link 
                                    href={`/${chainPath}/validators/${validatorAddr}`}
                                    className="text-white hover:text-blue-400 font-medium"
                                  >
                                    {validatorInfo.moniker}
                                  </Link>
                                ) : validatorAddr ? (
                                  <Link 
                                    href={`/${chainPath}/validators/${validatorAddr}`}
                                    className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                                  >
                                    {validatorAddr.slice(0, 20)}...
                                  </Link>
                                ) : (
                                  <span className="text-gray-500 text-sm">{t('accountDetail.unknown')}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-400 text-sm mb-1">{t('accountDetail.amount')}</p>
                              <p className="text-white font-semibold">
                                {formatAmount(amount, denom === asset?.base && asset ? asset.symbol : denom)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">{t('accountDetail.recentTx')}</h2>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-gray-400 text-sm">{t('accountDetail.loading')}</p>
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <Link
                        key={tx.hash}
                        href={`/${chainPath}/transactions/${tx.hash}`}
                        className="block bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-blue-400 font-mono text-sm truncate">
                                {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)}
                              </span>
                              {tx.result === 'Success' ? (
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="px-2 py-1 bg-gray-800 rounded text-gray-300">
                                {getTypeShortName(tx.type)}
                              </span>
                              <span className="text-gray-400">
                                {t('accountDetail.height')}: <span className="text-white">{tx.height?.toLocaleString()}</span>
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-sm font-medium ${tx.result === 'Success' ? 'text-green-500' : 'text-red-500'}`}>
                              {tx.result === 'Success' ? t('accountDetail.success') : t('accountDetail.failed')}
                            </span>
                            <p className="text-gray-400 text-xs mt-1">
                              {formatDistanceToNow(new Date(tx.time), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {tx.fee && (
                          <div className="text-xs text-gray-500">
                            {t('accountDetail.fee')}: {tx.fee}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-full mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-400">{t('accountDetail.noTransactions')}</p>
                    <p className="text-gray-600 text-sm mt-2">
                      {error ? 'Unable to load transactions due to RPC error' : 'This account has no transaction history yet'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-900/20 border border-red-700/50 rounded-full mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-gray-400 text-lg mb-2">Account not found or unable to load</p>
              <p className="text-gray-600 text-sm">
                The account data could not be retrieved. This may be due to:
              </p>
              <ul className="text-gray-600 text-sm mt-2 space-y-1">
                <li>• RPC endpoint timeout or error</li>
                <li>• Invalid account address</li>
                <li>• Network connectivity issues</li>
              </ul>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </main>

        <footer className="border-t border-gray-800 py-6 px-6 mt-auto">
          <div className="text-center text-gray-400 text-sm">
            <p>© 2025 WinScan. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

