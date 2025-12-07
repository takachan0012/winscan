'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { fetchChains } from '@/lib/apiCache';
import { Box, Activity, Users, Zap } from 'lucide-react';

interface EVMBlock {
  number: number;
  hash: string;
  timestamp: number;
  transactions: string[];
  miner: string;
  gasUsed: string;
  gasLimit: string;
}

export default function EVMBlocksPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [blocks, setBlocks] = useState<EVMBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Helper function to process blocks data
  const processBlocksData = (blocksData: EVMBlock[], cacheKey: string) => {
    // Smooth update: only update if data actually changed
    setBlocks(prev => {
      // If initial load or empty, replace all
      if (prev.length === 0) {
        return blocksData;
      }
      
      // Check for new blocks
      const newBlocks = blocksData.filter(
        (newBlock: EVMBlock) => !prev.some(b => b.number === newBlock.number)
      );
      
      if (newBlocks.length > 0) {
        // Add new blocks at the beginning, keep max 50 blocks
        return [...newBlocks, ...prev].slice(0, 50);
      }
      
      // No changes, return previous state
      return prev;
    });
    
    // Save to cache
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: blocksData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Cache write error:', e);
    }
  };

  useEffect(() => {
    if (!selectedChain) return;

    const fetchBlocks = async (showLoading = true) => {
      const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
      const cacheKey = `evm_blocks_${chainName}`;
      
      // Always show cached data immediately (optimistic UI)
      if (!showLoading) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Array.isArray(data) && data.length > 0) {
              setBlocks(data);
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
      if (showLoading && blocks.length === 0) {
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
          fetch(`https://ssl.winsnip.xyz/api/evm/blocks?chain=${chainName}`, {
            signal: AbortSignal.timeout(4000)
          }).then(r => r.json()).catch(() => ({ blocks: [], error: 'backend_timeout' })),
          
          // Local API with 5s timeout
          fetch(`/api/evm/blocks?chain=${chainName}`, {
            signal: AbortSignal.timeout(5000)
          }).then(r => r.json()).catch(() => ({ blocks: [], error: 'local_timeout' }))
        ];
        
        // Use Promise.race to get the fastest response
        const data = await Promise.race(fetchPromises);
        
        // If first response is empty/error, wait for second one
        if (!data.blocks || data.blocks.length === 0 || data.error) {
          const allResults = await Promise.allSettled(fetchPromises);
          const validResult = allResults.find(
            r => r.status === 'fulfilled' && 
            r.value.blocks && 
            r.value.blocks.length > 0
          );
          
          if (validResult && validResult.status === 'fulfilled') {
            const validData = validResult.value;
            if (Array.isArray(validData.blocks) && validData.blocks.length > 0) {
              processBlocksData(validData.blocks, cacheKey);
              return;
            }
          }
          throw new Error('No valid data from any source');
        }
        
        // Process valid data
        if (Array.isArray(data.blocks) && data.blocks.length > 0) {
          processBlocksData(data.blocks, cacheKey);
        }
      } catch (err: any) {
        console.error('Error fetching EVM blocks:', err);
        // Keep showing cached data if available
        if (blocks.length === 0) {
          setError(err instanceof Error ? err.message : 'Failed to load EVM blocks');
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    // Initial load
    fetchBlocks(true);
    
    // Auto-refresh every 4 seconds (silent background refresh)
    const interval = setInterval(() => fetchBlocks(false), 4000);
    
    return () => clearInterval(interval);
  }, [selectedChain]);


  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
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
                  {t('menu.evm.blocks')}
                </h1>
                <p className="text-gray-400">
                  EVM Blocks for {selectedChain?.chain_name || ''}
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
                  <span className="text-gray-400 text-sm">Latest Block</span>
                  <Box className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {blocks.length > 0 ? `#${blocks[0].number.toLocaleString()}` : '-'}
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Blocks</span>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {blocks.length > 0 ? blocks.length.toLocaleString() : '-'}
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Gas Used</span>
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {blocks.filter(b => b.gasUsed).length > 0
                    ? (blocks.filter(b => b.gasUsed).reduce((sum, b) => sum + parseInt(b.gasUsed), 0) / blocks.filter(b => b.gasUsed).length).toLocaleString(undefined, {maximumFractionDigits: 0})
                    : '-'
                  }
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Transactions</span>
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {blocks.length > 0 
                    ? blocks.reduce((sum, b) => sum + (Array.isArray(b.transactions) ? b.transactions.length : 0), 0).toLocaleString()
                    : '-'
                  }
                </p>
              </div>
            </div>

            {loading && blocks.length === 0 ? (
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
                          Block
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Hash
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Transactions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Miner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Gas Used
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                      {blocks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                            No blocks found
                          </td>
                        </tr>
                      ) : (
                        blocks.map((block) => (
                          <tr key={block.number} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <a 
                                href={`/${selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-')}/evm/blocks/${block.number}`}
                                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <Box className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                {block.number}
                              </a>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                              <span className="text-gray-400">{truncateHash(block.hash)}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {formatTimestamp(block.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {block.transactions.length}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                              {truncateHash(block.miner)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {parseInt(block.gasUsed).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
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
