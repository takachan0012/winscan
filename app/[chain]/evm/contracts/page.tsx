'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { fetchChains } from '@/lib/apiCache';
import { FileCode, Activity, Users, Clock } from 'lucide-react';

interface SmartContract {
  address: string;
  blockNumber: number;
  blockHash?: string;
  creator: string;
  txHash: string;
  timestamp?: number;
  bytecode?: string;
  gasUsed?: string;
}

export default function EVMContractsPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [contracts, setContracts] = useState<SmartContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedChain) return;

    const fetchContracts = async () => {
      setLoading(true);
      setError(null);

      try {
        const chainSlug = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
        const response = await fetch(`https://ssl.winsnip.xyz/api/evm/contracts?chain=${chainSlug}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error === false && data.data && Array.isArray(data.data.contracts)) {
          setContracts(data.data.contracts);
        } else if (data.contracts && Array.isArray(data.contracts)) {
          // Fallback for old format
          setContracts(data.contracts);
        } else {
          setContracts([]);
        }
      } catch (err: any) {
        console.error('Error fetching contracts:', err);
        setError(err.message || 'Failed to fetch contract data');
        setContracts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
    
    // Auto-refresh setiap 60 detik
    const interval = setInterval(fetchContracts, 60000);
    return () => clearInterval(interval);
  }, [selectedChain]);

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
                  {t('menu.evm.contracts')}
                </h1>
                <p className="text-gray-400">
                  EVM Smart Contracts for {selectedChain?.chain_name || ''}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-xs text-gray-400">{loading ? 'Loading' : 'Live'}</span>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Contracts</span>
                  <FileCode className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {contracts.length.toLocaleString()}
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Gas Used</span>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {contracts.length > 0 && contracts.some(c => c.gasUsed)
                    ? (contracts.reduce((sum, c) => sum + (parseInt(c.gasUsed || '0')), 0) / contracts.length / 1000000).toFixed(2) + 'M'
                    : '-'
                  }
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Unique Creators</span>
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {contracts.length > 0 
                    ? new Set(contracts.map(c => c.creator)).size.toLocaleString()
                    : '-'
                  }
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Latest Creation</span>
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {contracts.length > 0 && contracts[0].timestamp
                    ? new Date(contracts[0].timestamp * 1000).toLocaleDateString()
                    : '-'
                  }
                </p>
              </div>
            </div>

            {loading ? (
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
                <p className="text-red-300 text-sm mt-2">
                  Check if the backend API is running or if the EVM RPC is accessible.
                </p>
              </div>
            ) : contracts.length === 0 ? (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-8 text-center">
                <FileCode className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">
                  No contract deployments found
                </p>
                <p className="text-gray-500 text-sm">
                  Backend is scanning the last 200 blocks for contract creations (transactions with <code className="bg-gray-800 px-2 py-1 rounded text-xs">to: null</code>)
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  If this chain has low activity, contracts may not appear immediately.
                </p>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800">
                    <thead className="bg-[#0f0f0f]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Contract Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Creator
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Block
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Gas Used
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                      {contracts.map((contract) => (
                        <tr key={contract.address} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-blue-400 font-mono">
                                {truncateHash(contract.address)}
                              </span>
                              {contract.bytecode && (
                                <span className="text-xs text-gray-500 mt-1">
                                  {contract.bytecode.substring(0, 20)}...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                            {truncateHash(contract.creator)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-blue-400">
                                {contract.blockNumber.toLocaleString()}
                              </span>
                              <a
                                href={`/${selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-')}/evm/transactions/${contract.txHash}`}
                                className="text-xs text-gray-500 hover:text-blue-400 font-mono"
                              >
                                {truncateHash(contract.txHash)}
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {contract.gasUsed 
                              ? (parseInt(contract.gasUsed) / 1000000).toFixed(2) + 'M'
                              : '-'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {contract.timestamp
                              ? new Date(contract.timestamp * 1000).toLocaleString()
                              : '-'}
                          </td>
                        </tr>
                      ))}
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
