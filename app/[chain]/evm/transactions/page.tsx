'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { fetchChains } from '@/lib/apiCache';
import { FileText, Activity, Zap, Users, Copy, Check } from 'lucide-react';

interface EVMTransaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasUsed?: string;
  timestamp?: number;
}

export default function EVMTransactionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [transactions, setTransactions] = useState<EVMTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get query from URL
  const urlQuery = searchParams.get('q') || '';

  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery);
    }
  }, [urlQuery]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetchChains()
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = params?.chain as string;
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data[0];
          if (chain) setSelectedChain(chain);
        })
        .catch(err => console.error('Error loading chains:', err));
    }
  }, [params]);

  // Helper function to process transactions data
  const processTransactionsData = (txsData: EVMTransaction[], cacheKey: string) => {
    // Smooth update: only update if data actually changed
    setTransactions(prev => {
      // If initial load or empty, replace all
      if (prev.length === 0) {
        return txsData;
      }
      
      // Check for new transactions
      const newTxs = txsData.filter(
        (newTx: EVMTransaction) => !prev.some(tx => tx.hash === newTx.hash)
      );
      
      if (newTxs.length > 0) {
        // Add new transactions at the beginning, keep max 50
        return [...newTxs, ...prev].slice(0, 50);
      }
      
      // No changes, return previous state
      return prev;
    });
    
    // Save to cache
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: txsData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Cache write error:', e);
    }
  };

  useEffect(() => {
    if (!selectedChain) return;

    const fetchTransactions = async (showLoading = true) => {
      const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
      const cacheKey = `evm_txs_${chainName}`;
      
      // Always show cached data immediately (optimistic UI)
      if (!showLoading) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
              setTransactions(data);
              // Skip fetch if cache is very fresh (< 5 seconds)
              if (Date.now() - timestamp < 5000) {
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Cache read error:', e);
        }
      }
      
      // Show loading only on initial load
      if (showLoading && transactions.length === 0) {
        setLoading(true);
      } else if (!showLoading) {
        // Silent background refresh
        setIsRefreshing(true);
      }
      
      try {
        setError(null);
        
        // Parallel fetch: Race between backend and local API
        const fetchPromises = [
          // Backend API with 4s timeout
          fetch(`https://ssl.winsnip.xyz/api/evm/transactions?chain=${chainName}`, {
            signal: AbortSignal.timeout(4000)
          }).then(r => r.json()).catch(() => ({ transactions: [], error: 'backend_timeout' })),
          
          // Local API with 5s timeout
          fetch(`/api/evm/transactions?chain=${chainName}`, {
            signal: AbortSignal.timeout(5000)
          }).then(r => r.json()).catch(() => ({ transactions: [], error: 'local_timeout' }))
        ];
        
        // Use Promise.race to get the fastest response
        const data = await Promise.race(fetchPromises);
        
        // If first response is empty/error, wait for second one
        if (!data.transactions || data.transactions.length === 0 || data.error) {
          const allResults = await Promise.allSettled(fetchPromises);
          const validResult = allResults.find(
            r => r.status === 'fulfilled' && 
            r.value.transactions && 
            r.value.transactions.length > 0
          );
          
          if (validResult && validResult.status === 'fulfilled') {
            const validData = validResult.value;
            if (Array.isArray(validData.transactions) && validData.transactions.length > 0) {
              processTransactionsData(validData.transactions, cacheKey);
              return;
            }
          }
          throw new Error('No valid data from any source');
        }
        
        // Process valid data
        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          processTransactionsData(data.transactions, cacheKey);
        }
      } catch (err: any) {
        console.error('Error fetching EVM transactions:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    // Initial load
    fetchTransactions(true);
    
    // Auto-refresh every 4 seconds (silent background refresh)
    const interval = setInterval(() => fetchTransactions(false), 4000);
    
    return () => clearInterval(interval);
  }, [selectedChain]);

  const formatValue = (value: string) => {
    const ethValue = parseFloat(value) / 1e18;
    return ethValue.toFixed(6);
  };

  const truncateHash = (hash: string) => {
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar 
        selectedChain={selectedChain}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0a0a0a]">
          <div className="container mx-auto px-6 py-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {t('menu.evm.transactions')}
                </h1>
                <p className="text-gray-400">
                  EVM Transactions for {selectedChain?.chain_name || ''}
                </p>
              </div>
              
              {/* Realtime indicator - hidden during refresh for smooth UX */}
              {!isRefreshing && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-xs text-gray-400">{loading ? 'Loading' : 'Live'}</span>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Transactions</span>
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.length.toLocaleString()}
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Value</span>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.length > 0 
                    ? `${(transactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0) / transactions.length / 1e18).toFixed(4)}`
                    : '-'
                  } {selectedChain?.assets?.[0]?.symbol || 'TOKEN'}
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Gas Used</span>
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.filter(tx => tx.gasUsed).length > 0
                    ? (transactions.filter(tx => tx.gasUsed).reduce((sum, tx) => sum + parseInt(tx.gasUsed!), 0) / transactions.filter(tx => tx.gasUsed).length).toLocaleString(undefined, {maximumFractionDigits: 0})
                    : '-'
                  }
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Unique Addresses</span>
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.length > 0 
                    ? new Set([...transactions.map(tx => tx.from), ...transactions.filter(tx => tx.to).map(tx => tx.to!)]).size.toLocaleString()
                    : '-'
                  }
                </p>
              </div>
            </div>

            {/* Search Box */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by transaction hash, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <p className="text-sm text-gray-400 mt-2">
                  Showing results for: <span className="text-blue-400 font-mono">{searchQuery}</span>
                </p>
              )}
            </div>

            {loading && transactions.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-8">
                <div className="animate-pulse space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-800 rounded"></div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
                <p className="text-red-200">{error}</p>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800">
                    <thead className="bg-[#0f0f0f]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Tx Hash
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Block
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          From
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Value ({selectedChain?.assets?.[0]?.symbol || 'TOKEN'})
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Gas Used
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                      {(() => {
                        const filteredTxs = transactions.filter(tx => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            tx.hash.toLowerCase().includes(query) ||
                            tx.from.toLowerCase().includes(query) ||
                            (tx.to && tx.to.toLowerCase().includes(query))
                          );
                        });

                        if (filteredTxs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                {searchQuery ? `No transactions found matching "${searchQuery}"` : 'No transactions found'}
                              </td>
                            </tr>
                          );
                        }

                        return filteredTxs.map((tx) => (
                          <tr key={tx.hash} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <a 
                                  href={`/${selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-')}/evm/transactions/${tx.hash}`}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  {truncateHash(tx.hash)}
                                </a>
                                <button
                                  onClick={() => copyToClipboard(tx.hash)}
                                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                                  title="Copy hash"
                                >
                                  {copiedHash === tx.hash ? (
                                    <Check className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <a 
                                href={`/${selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-')}/evm/blocks/${tx.blockNumber}`}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                {tx.blockNumber}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                              {truncateHash(tx.from)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                              {tx.to ? truncateHash(tx.to) : 'Contract Creation'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {formatValue(tx.value)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {tx.gasUsed ? parseInt(tx.gasUsed).toLocaleString() : '-'}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
