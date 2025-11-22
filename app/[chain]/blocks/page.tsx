'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import BlocksTable from '@/components/BlocksTable';
import { ChainData, BlockData } from '@/types/chain';
import { fetchChains } from '@/lib/apiCache';
import { fetchWithCache, CACHE_CONFIG } from '@/lib/apiCache';
import { getCacheKey, setCache, getStaleCache } from '@/lib/cacheUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

export default function BlocksPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [blocks, setBlocks] = useState<BlockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const blocksPerPage = 50;

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
      fetchChains()
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

  const fetchBlocks = useCallback(async (showLoading = true) => {
    if (!selectedChain) return;

    const cacheKey = getCacheKey('blocks', selectedChain.chain_name, `page${currentPage}`);
    const cachedData = getStaleCache<BlockData[]>(cacheKey);
    
    // Always show cached data immediately (optimistic UI)
    if (cachedData && cachedData.length > 0) {
      setBlocks(cachedData);
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
      const backendUrl = `${API_URL}/api/blocks?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=${blocksPerPage}&page=${currentPage}`;
      
      const res = await fetch(backendUrl, {
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
      
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Smooth update: only update if data actually changed
          setBlocks(prev => {
            const hasChanges = JSON.stringify(prev) !== JSON.stringify(data);
            return hasChanges ? data : prev;
          });
          setCache(cacheKey, data);
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
      }
      
      // Fallback to cosmos-client (direct LCD)
      const { fetchBlocksDirectly } = await import('@/lib/cosmos-client');
      const endpoints = selectedChain.api?.map((a: any) => ({
        address: a.address,
        provider: a.provider || 'unknown'
      })) || [];
      
      if (endpoints.length > 0) {
        const directBlocks = await fetchBlocksDirectly(endpoints, blocksPerPage);
        
        // Transform LCD format to backend format
        const blockData = directBlocks.map((b: any) => ({
          height: b.block?.header?.height || b.header?.height || '0',
          hash: b.block_id?.hash || b.block?.last_block_id?.hash || '',
          time: b.block?.header?.time || b.header?.time || new Date().toISOString(),
          txs: b.block?.data?.txs?.length || b.data?.txs?.length || 0,
          proposer: b.block?.header?.proposer_address || b.header?.proposer_address || '',
        }));
        
        // Smooth update: only update if data actually changed
        setBlocks(prev => {
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(blockData);
          return hasChanges ? blockData : prev;
        });
        setCache(cacheKey, blockData);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      throw new Error('No LCD endpoints available');
      
    } catch (err) {
      console.error('Error fetching blocks:', err);
      setBlocks([]);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedChain, currentPage, blocksPerPage]);

  useEffect(() => {
    fetchBlocks(true);
  }, [fetchBlocks]);

  useEffect(() => {
    if (!selectedChain || currentPage !== 1) return;
    
    const interval = setInterval(() => {
      fetchBlocks(false);
    }, 6000);

    return () => clearInterval(interval);
  }, [selectedChain, currentPage, fetchBlocks]);

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
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{t('blocks.title')}</h1>
              <p className="text-gray-400">
                {t('blocks.subtitle')} {selectedChain?.chain_name}
              </p>
            </div>
            
            {/* Realtime indicator - hidden during refresh for smooth UX */}
            {currentPage === 1 && !isRefreshing && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-400">
                  {t('overview.live')}
                </span>
              </div>
            )}
          </div>

          {loading && blocks.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">{t('blocks.loading')}</p>
            </div>
          ) : (
            <BlocksTable 
              blocks={blocks} 
              chainName={selectedChain?.chain_name || ''}
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

