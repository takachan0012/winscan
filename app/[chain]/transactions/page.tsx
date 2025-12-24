'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import TransactionsTable from '@/components/TransactionsTable';
import { ChainData, TransactionData } from '@/types/chain';
import { getCacheKey, setCache, getStaleCache } from '@/lib/cacheUtils';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

export default function TransactionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const txsPerPage = 200;

  // Auto-redirect to EVM transactions if query is EVM hash
  useEffect(() => {
    const query = searchParams.get('q');
    if (query && query.startsWith('0x') && query.length === 66) {
      // This is an EVM transaction hash (0x + 64 hex chars)
      const chainSlug = params?.chain as string;
      if (chainSlug && selectedChain?.evm_rpc && selectedChain.evm_rpc.length > 0) {
        router.push(`/${chainSlug}/evm/transactions?q=${query}`);
      }
    }
  }, [searchParams, params, router, selectedChain]);

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
      fetchApi('/api/chains')
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

  const fetchTransactions = useCallback(async (showLoading = true) => {
    if (!selectedChain) return;

    const cacheKey = getCacheKey('transactions', selectedChain.chain_name, `page${currentPage}`);
    const cachedData = getStaleCache<TransactionData[]>(cacheKey);
    
    // Always show cached data immediately (optimistic UI)
    if (cachedData && cachedData.length > 0) {
      setTransactions(cachedData);
      if (showLoading) {
        setLoading(false);
      }
    } else if (showLoading) {
      setLoading(true);
    }
    
    // Silent background refresh
    if (!showLoading) {
      setIsRefreshing(true);
    }
    
    try {
      // Try backend API first
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ssl.winsnip.xyz';
      const backendUrl = `${API_URL}/api/transactions?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=${txsPerPage}&page=${currentPage}`;
      
      const res = await fetch(backendUrl, {
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
      
      console.log('[Transactions Debug] Response status:', res.status, res.ok);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[Transactions Debug] Raw data:', data);
        const txData = Array.isArray(data) ? data : [];
        
        console.log('[Transactions Debug] Backend response:', { 
          chain: selectedChain?.chain_id || selectedChain?.chain_name,
          txCount: txData.length,
          firstTx: txData[0],
          url: `${API_URL}/api/transactions?chain=${selectedChain?.chain_id || selectedChain?.chain_name}&limit=200&page=${currentPage}`
        });
        
        if (txData.length > 0) {
          // Smooth update: only update if data actually changed
          setTransactions(prev => {
            const hasChanges = JSON.stringify(prev) !== JSON.stringify(txData);
            return hasChanges ? txData : prev;
          });
          setCache(cacheKey, txData);
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
      }
      
      // Fallback to cosmos-client (direct LCD)
      const { fetchTransactionsDirectly } = await import('@/lib/cosmos-client');
      const endpoints = selectedChain.api?.map((a: any) => ({
        address: a.address,
        provider: a.provider || 'unknown'
      })) || [];
      
      if (endpoints.length > 0) {
        const chainIdentifier = selectedChain.chain_id || selectedChain.chain_name;
        const directData = await fetchTransactionsDirectly(endpoints, currentPage, txsPerPage, chainIdentifier);
        
        // Transform LCD format to backend format
        const txData = (directData.tx_responses || directData.txs || []).map((tx: any) => {
          const firstMsg = tx.tx?.body?.messages?.[0];
          const msgType = firstMsg?.['@type'] || '';
          const type = msgType.split('.').pop() || 'Unknown';
          
          return {
            hash: tx.txhash || tx.hash,
            height: tx.height || '0',
            time: tx.timestamp || new Date().toISOString(),
            type: type,
            result: tx.code === 0 ? 'Success' : 'Failed',
            code: tx.code || 0,
          };
        });
        
        // Smooth update: only update if data actually changed
        setTransactions(prev => {
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(txData);
          return hasChanges ? txData : prev;
        });
        setCache(cacheKey, txData);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      throw new Error('No LCD endpoints available');
      
    } catch (err) {
      console.error('[Transactions Debug] Error fetching transactions:', err);
      console.error('[Transactions Debug] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        chain: selectedChain?.chain_id || selectedChain?.chain_name
      });
      setTransactions([]);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedChain, currentPage, txsPerPage]);

  useEffect(() => {
    fetchTransactions(true);
  }, [fetchTransactions]);

  useEffect(() => {
    if (!selectedChain || currentPage !== 1) return;
    
    const interval = setInterval(() => {
      fetchTransactions(false);
    }, 6000);

    return () => clearInterval(interval);
  }, [selectedChain, currentPage, fetchTransactions]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 overflow-auto">
          <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('transactions.title')}</h1>
              <p className="text-gray-400 text-sm md:text-base">
                {t('transactions.subtitle')} {selectedChain?.chain_name}
              </p>
            </div>
            
            {/* Realtime indicator - hidden during refresh for smooth UX */}
            {currentPage === 1 && !isRefreshing && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-400">
                  {t('overview.live')}
                </span>
              </div>
            )}
          </div>

          {loading && transactions.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">{t('transactions.loading')}</p>
            </div>
          ) : (
            <TransactionsTable 
              transactions={transactions} 
              chainName={selectedChain?.chain_name || ''}
              asset={selectedChain?.assets[0]}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
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

