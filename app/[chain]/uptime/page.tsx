'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { ChainData } from '@/types/chain';
import { Activity, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

interface ValidatorUptime {
  rank?: number; // Nomor urut
  moniker: string;
  operator_address: string;
  consensus_address: string;
  identity: string;
  uptime: number;
  missedBlocks: number;
  signedBlocks: number;
  missedBlocksIn100?: number;
  signedBlocksTotal?: number;
  signingWindow?: number;
  maxMissedBlocks?: number;
  jailed: boolean;
  jailedUntil?: string | null;
  tombstoned?: boolean;
  willBeJailed?: boolean;
  status: string;
  votingPower: string;
  blockSignatures: boolean[];
}

export default function UptimePage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [uptimeData, setUptimeData] = useState<ValidatorUptime[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [blocksToCheck, setBlocksToCheck] = useState(100); // Start with 100 blocks
  const [signingWindow, setSigningWindow] = useState<number>(100);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const blockCheckRef = useRef<NodeJS.Timeout | null>(null);

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
        });
    }
  }, [params]);

  // Fetch signing window parameters
  useEffect(() => {
    if (!selectedChain) return;
    
    const fetchSigningWindow = async () => {
      try {
        // Try to get slashing params from API
        const apis = selectedChain.api || [];
        if (apis.length === 0) {
          console.log('[Uptime] No API available, using default: 100');
          setSigningWindow(100);
          setBlocksToCheck(100);
          return;
        }
        
        const api = apis[0].address;
        const res = await fetch(`${api}/cosmos/slashing/v1beta1/params`, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (res.ok) {
          const data = await res.json();
          const window = parseInt(data.params?.signed_blocks_window || '100');
          // Limit to max 1000 blocks for performance
          const limitedWindow = Math.min(window, 1000);
          console.log(`[Uptime] Signing window for ${selectedChain.chain_name}: ${window}, using: ${limitedWindow}`);
          setSigningWindow(limitedWindow);
          setBlocksToCheck(limitedWindow);
        } else {
          console.log('[Uptime] API error, using default: 100');
          setSigningWindow(100);
          setBlocksToCheck(100);
        }
      } catch (error) {
        console.error('[Uptime] Error fetching signing window:', error);
        setSigningWindow(100);
        setBlocksToCheck(100);
      }
    };
    
    fetchSigningWindow();
  }, [selectedChain?.chain_name]);

  // Memoized fetch function dengan debounce
  const fetchUptime = useCallback(async (force = false) => {
    if (!selectedChain || !isLive) return;
    
    const cacheKey = `uptime_v4_${selectedChain.chain_name}_${blocksToCheck}`;
    
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached && !force) {
        const { data, timestamp } = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          // Use cache immediately for instant display
          setUptimeData(data);
        }
        
        // Keep cache for 60 seconds untuk reduce API calls
        if (Date.now() - timestamp < 60 * 1000) {
          console.log('[Uptime Page] Using cached data (< 60 sec old)');
          return;
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }
    
    // Prevent multiple simultaneous fetches
    if (loading) {
      console.log('[Uptime Page] Already fetching, skipping...');
      return;
    }
    
    setLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // Increase timeout
      
      // Single batch request untuk semua validator uptime
      const apiUrl = `/api/uptime?chain=${selectedChain.chain_id || selectedChain.chain_name}&blocks=${blocksToCheck}`;
      console.log('[Uptime Page] Batch fetching uptime data:', apiUrl);
      
      const res = await fetch(apiUrl, { 
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.error('[Uptime Page] API Error:', res.status);
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      console.log('[Uptime Page] Data received:', Array.isArray(data) ? `${data.length} validators` : data);
      
      if (Array.isArray(data) && data.length > 0) {
        // Recalculate uptime from blockSignatures (sama seperti validator detail page)
        data.forEach((validator: ValidatorUptime) => {
          if (validator.blockSignatures && Array.isArray(validator.blockSignatures)) {
            const totalBlocks = validator.blockSignatures.length;
            const signedCount = validator.blockSignatures.filter(signed => signed === true).length;
            const missedCount = totalBlocks - signedCount;
            
            // Recalculate uptime percentage from actual block signatures
            validator.uptime = totalBlocks > 0 ? (signedCount / totalBlocks) * 100 : 0;
            validator.signedBlocks = signedCount;
            validator.missedBlocks = missedCount;
          }
        });
        
        // Log summary
        const avgUptime = data.reduce((sum, v) => sum + (v.uptime || 0), 0) / data.length;
        console.log(`[Uptime] ${data.length} validators, avg uptime: ${avgUptime.toFixed(2)}%`);
      }
      
      if (Array.isArray(data) && data.length > 0) {
        setUptimeData(prevData => {
          // Smooth transition: only update if significantly changed
          // Check if uptime percentages differ by more than 0.1%
          if (prevData.length === data.length) {
            const hasSignificantChange = data.some((newVal, idx) => {
              const oldVal = prevData[idx];
              if (!oldVal) return true;
              return Math.abs(newVal.uptime - oldVal.uptime) > 0.1;
            });
            
            if (!hasSignificantChange) {
              // No significant change, keep previous data to prevent flicker
              return prevData;
            }
          }
          return data;
        });
        setLastUpdate(new Date());
        
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ 
            data, 
            timestamp: Date.now() 
          }));
          
          // Cleanup old cache versions
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('uptime_') && !key.startsWith('uptime_v4_')) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (e) {
          console.warn('Cache write error:', e);
        }
      } else {
        console.warn('[Uptime Page] Empty or invalid data:', data);
        // Don't clear existing data
        if (uptimeData.length === 0) {
          setUptimeData([]);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[Uptime Page] Request timeout');
      } else {
        console.error('[Uptime Page] Fetch error:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedChain, blocksToCheck, isLive]);

  // Initial fetch when chain changes
  useEffect(() => {
    if (selectedChain && isLive) {
      console.log('[Uptime Page] Initial fetch for:', selectedChain.chain_name);
      fetchUptime(true);
    }
  }, [selectedChain?.chain_name]); // Only re-run when chain actually changes
  
  // Check for new blocks to trigger uptime update
  useEffect(() => {
    if (!selectedChain || !isLive) return;
    
    let blockCount = 0;
    const BLOCKS_THRESHOLD = 10; // Update setiap 10 blocks (~1 menit) untuk reduce API calls
    
    const checkNewBlock = async () => {
      try {
        // Get latest block height
        const res = await fetch(`/api/network?chain=${selectedChain.chain_id || selectedChain.chain_name}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          const latestHeight = parseInt(data.block_height || '0');
          
          if (latestHeight > 0) {
            if (currentBlock > 0 && latestHeight > currentBlock) {
              blockCount++;
              
              // Update uptime setiap 10 blocks untuk reduce API load
              if (blockCount >= BLOCKS_THRESHOLD) {
                console.log(`[Uptime Page] ${BLOCKS_THRESHOLD} blocks passed, batch fetching uptime...`);
                fetchUptime(true); // Force fresh data
                blockCount = 0; // Reset counter
              } else {
                console.log(`[Uptime Page] New block: ${latestHeight} (${blockCount}/${BLOCKS_THRESHOLD})`);
              }
            }
            setCurrentBlock(latestHeight);
          }
        }
      } catch (error) {
        console.error('[Uptime Page] Error checking block:', error);
      }
    };
    
    // Initial block check
    checkNewBlock();
    
    // Check for new blocks setiap 6 detik
    blockCheckRef.current = setInterval(checkNewBlock, 6000);
    
    // Fallback: Full refresh setiap 3 menit untuk memastikan data fresh tanpa terlalu banyak request
    intervalRef.current = setInterval(() => {
      console.log('[Uptime Page] Fallback refresh (3 min) - batch fetch');
      fetchUptime(true); // Force fresh data
      blockCount = 0; // Reset counter
    }, 3 * 60 * 1000); // 3 menit
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (blockCheckRef.current) {
        clearInterval(blockCheckRef.current);
        blockCheckRef.current = null;
      }
    };
  }, [selectedChain, fetchUptime, isLive, currentBlock]);
  
  // Pause updates when tab is not visible (performance optimization)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsLive(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        setIsLive(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const validUptimeData = Array.isArray(uptimeData) ? uptimeData : [];
  
  const filteredValidators = validUptimeData.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.moniker.toLowerCase().includes(query) ||
      v.operator_address.toLowerCase().includes(query)
    );
  });

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

  const sortedValidators = [...filteredValidators].sort((a, b) => {
    if (a.status === 'BOND_STATUS_BONDED' && b.status !== 'BOND_STATUS_BONDED') return -1;
    if (a.status !== 'BOND_STATUS_BONDED' && b.status === 'BOND_STATUS_BONDED') return 1;
    
    const powerA = parseFloat(a.votingPower || '0');
    const powerB = parseFloat(b.votingPower || '0');
    return powerB - powerA;
  });

  const getUptimeColor = (uptime: number) => {
    if (uptime >= 99) return 'text-green-500';
    if (uptime >= 95) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getUptimeBgColor = (uptime: number) => {
    if (uptime >= 99) return 'bg-green-500/10 border-green-500/20';
    if (uptime >= 95) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scaleY(1);
          }
          50% {
            opacity: 0.7;
            transform: scaleY(0.95);
          }
        }
        @keyframes slideInFromRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideBlocks {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        @keyframes glowPulse {
          0%, 100% {
            box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
          }
          50% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 1);
          }
        }
        .blocks-container {
          display: flex;
          gap: 2px;
          width: 200%;
        }
        .blocks-wrapper {
          display: flex;
          gap: 2px;
          flex: 1;
        }
        .blocks-wrapper.animated {
          animation: slideBlocks 300s linear infinite;
        }
        @keyframes fillUp {
          from {
            transform: scaleX(0);
            opacity: 0.5;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }
        @keyframes countUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .uptime-value {
          animation: countUp 0.5s ease-out;
        }
        .block-bar {
          animation: shiftLeft 0.6s ease-out;
        }
        .block-bar-new {
          animation: slideInFromRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-origin: right;
        }
        .block-bar-shift {
          transition: transform 0.6s ease-out;
        }
        /* Smooth fade for data updates */
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .data-row {
          animation: fadeIn 0.3s ease-in;
        }
      `}</style>
      
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6">
          {/* Header with Live Indicator */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                <Activity className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                <h1 className="text-xl md:text-3xl font-bold text-white">{t('uptime.title')}</h1>
                
                {/* Live Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs text-green-400 font-medium">LIVE</span>
                </div>
                
                {/* Current Block */}
                {currentBlock > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <span className="text-xs text-blue-400 font-mono">#{currentBlock.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              {/* Last Update Time */}
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
                <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
            <p className="text-sm md:text-base text-gray-400">
              {t('uptime.subtitle')}
            </p>
          </div>

          {/* Controls */}
          <div className="mb-4 md:mb-6 flex flex-col md:flex-row flex-wrap gap-3 md:gap-4 items-stretch md:items-center md:justify-between">
            {/* Search Input */}
            <div className="w-full md:flex-1 md:max-w-md">
              <input
                type="text"
                placeholder={t('uptime.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-4 md:gap-6">
              <div className="text-xs md:text-sm">
                <span className="text-gray-400">{t('uptime.totalValidators')} </span>
                <span className="text-white font-bold">{validUptimeData.length}</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                <span className="text-xs text-gray-400">Signing Window:</span>
                <span className="text-xs text-purple-400 font-mono font-bold">{signingWindow.toLocaleString()} blocks</span>
              </div>
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/20">
                <span className="text-xs text-gray-400">Updates:</span>
                <span className="text-xs text-gray-300 font-medium">Every ~1 min</span>
              </div>
              {searchQuery && (
                <div className="text-xs md:text-sm">
                  <span className="text-gray-400">{t('uptime.filtered')} </span>
                  <span className="text-blue-400 font-bold">{filteredValidators.length}</span>
                </div>
              )}
            </div>
            
            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-2">
              {loading && uptimeData.length > 0 ? (
                <div className="flex items-center gap-2 text-xs md:text-sm text-blue-400">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span>{t('uptime.updating')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{t('uptime.autoRefresh')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Validators Table */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
            <div 
              className="overflow-x-auto scroll-smooth"
              style={{
                maxHeight: 'calc(100vh - 400px)',
                minHeight: '500px',
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                scrollbarColor: '#374151 #1a1a1a'
              }}
            >
              <table className="w-full">
                <thead className="bg-[#0f0f0f] border-b border-gray-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 md:px-6 py-2 md:py-4 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t('uptime.validator')}
                    </th>
                    <th className="hidden lg:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t('uptime.signingStatus')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t('uptime.uptimeLabel')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t('uptime.missed')}
                    </th>
                    <th className="hidden md:table-cell px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {t('uptime.jailed')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loading && uptimeData.length === 0 ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className="animate-pulse">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-800" />
                            <div className="w-10 h-10 rounded-full bg-gray-800" />
                            <div className="h-4 w-32 bg-gray-800 rounded" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 w-full bg-gray-800 rounded" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 w-16 bg-gray-800 rounded mx-auto" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 w-12 bg-gray-800 rounded mx-auto" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 w-20 bg-gray-800 rounded mx-auto" />
                        </td>
                      </tr>
                    ))
                  ) : sortedValidators.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                        {t('uptime.noValidators')}
                      </td>
                    </tr>
                  ) : (
                    sortedValidators.map((validator, index) => (
                      <tr
                        key={validator.operator_address}
                        className="hover:bg-[#0f0f0f] transition-all duration-200 data-row"
                      >
                        <td className="px-3 md:px-6 py-4 md:py-4">
                          <div className="flex items-start md:items-center gap-3">
                            {/* Rank Badge */}
                            {validator.rank && (
                              <div className="flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 text-gray-300 text-xs md:text-sm font-bold shadow-sm flex-shrink-0">
                                {validator.rank}
                              </div>
                            )}
                            
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <ValidatorAvatar 
                                moniker={validator.moniker}
                                identity={validator.identity}
                                size="md"
                              />
                            </div>
                            
                            {/* Validator Info */}
                            <div className="flex-1 min-w-0">
                              <Link 
                                href={`/${chainPath}/validators/${validator.operator_address}`}
                                className="text-white text-sm md:text-base font-semibold hover:text-blue-400 transition-colors block truncate mb-1"
                              >
                                {validator.moniker}
                              </Link>
                              
                              {/* Mobile: Uptime & Status Row */}
                              <div className="flex md:hidden items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${validator.uptime >= 99 ? 'bg-green-500' : validator.uptime >= 95 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                                  <span className={`text-sm font-bold uptime-value transition-colors duration-300 ${validator.uptime >= 99 ? 'text-green-400' : validator.uptime >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {validator.uptime.toFixed(2)}%
                                  </span>
                                </div>
                                
                                <span className="text-gray-600">•</span>
                                
                                <span className="text-xs text-gray-400">
                                  {validator.missedBlocks} missed
                                </span>
                                
                                {validator.jailed && (
                                  <>
                                    <span className="text-gray-600">•</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-medium">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                      Jailed
                                    </span>
                                  </>
                                )}
                                
                                {validator.willBeJailed && !validator.jailed && (
                                  <>
                                    <span className="text-gray-600">•</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-medium">
                                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                      At Risk
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-4">
                          {/* Block Signing Visualization */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 relative h-8 bg-[#0a0a0a] rounded-sm overflow-hidden border border-gray-800 lg:min-w-[600px] lg:max-w-[800px]">
                              <div className="blocks-container absolute inset-0">
                                <div className={`blocks-wrapper ${validator.blockSignatures?.length === 100 ? 'animated' : ''}`}>
                                  {validator.blockSignatures && validator.blockSignatures.length > 0 ? (
                                    <>
                                      {validator.blockSignatures.map((isSigned, blockIndex) => (
                                        <div
                                          key={`${validator.operator_address}-${blockIndex}`}
                                          className={`flex-shrink-0 block-bar transition-all duration-300 ${
                                            isSigned 
                                              ? 'bg-green-500' 
                                              : 'bg-red-500'
                                          }`}
                                          style={{
                                            width: '6px',
                                            height: '100%',
                                            opacity: blockIndex < 10 ? 0.5 + (blockIndex * 0.05) : 1
                                          }}
                                          title={`Block ${blockIndex + 1}: ${isSigned ? t('uptime.signed') : t('uptime.missedBlock')}`}
                                        />
                                      ))}
                                      {validator.blockSignatures.length < 100 && (
                                        Array.from({ length: 100 - validator.blockSignatures.length }).map((_, idx) => (
                                          <div
                                            key={`empty-${idx}`}
                                            className="flex-shrink-0 bg-gray-800/20"
                                            style={{ 
                                              width: '6px',
                                              height: '100%'
                                            }}
                                            title={t('uptime.notChecked')}
                                          />
                                        ))
                                      )}
                                    </>
                                  ) : (
                                    Array.from({ length: 100 }).map((_, blockIndex) => (
                                      <div
                                        key={blockIndex}
                                        className="flex-shrink-0 bg-gray-800/30"
                                        style={{ 
                                          width: '6px',
                                          height: '100%'
                                        }}
                                        title={t('uptime.loading')}
                                      />
                                    ))
                                  )}
                                </div>
                                {validator.blockSignatures?.length === 100 && (
                                  <div className={`blocks-wrapper animated`}>
                                    {validator.blockSignatures.map((isSigned, blockIndex) => (
                                      <div
                                        key={`dup-${validator.operator_address}-${blockIndex}`}
                                        className={`flex-shrink-0 ${
                                          isSigned 
                                            ? 'bg-green-500' 
                                            : 'bg-red-500'
                                        }`}
                                        style={{
                                          width: '6px',
                                          height: '100%'
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 font-mono whitespace-nowrap transition-all duration-500">
                              <span className={`transition-all duration-300 ${validator.blockSignatures?.length === 100 ? 'text-green-400 font-bold scale-110 inline-block' : ''}`}>
                                {validator.blockSignatures?.length || 0}
                              </span>
                              <span className="text-gray-600">/100</span>
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-bold uptime-value transition-all duration-300 ${getUptimeColor(validator.uptime)}`}>
                              {validator.uptime.toFixed(2)}%
                            </span>
                            <span className="text-[9px] text-gray-500 font-mono" title={`Signed ${validator.signedBlocks || 0} blocks, Missed ${validator.missedBlocks || 0} blocks`}>
                              {validator.signedBlocks || 0}/{validator.blockSignatures?.length || blocksToCheck} blocks
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-center">
                          <span className="text-white font-medium bg-[#0f0f0f] px-3 py-1 rounded-lg border border-gray-800 transition-all duration-300">
                            {validator.missedBlocks}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-center">
                          {validator.jailed ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] md:text-xs font-medium">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                <span className="hidden sm:inline">{t('uptime.jailedStatus')}</span>
                                <span className="sm:hidden">Jailed</span>
                              </span>
                              {validator.jailedUntil && validator.jailedUntil !== '1970-01-01T00:00:00Z' && (
                                <span className="hidden md:inline text-xs text-red-400" title="Jailed until">
                                  {t('uptime.until')} {new Date(validator.jailedUntil).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              )}
                              {validator.tombstoned && (
                                <span className="text-[10px] md:text-xs text-red-500">{t('uptime.tombstoned')}</span>
                              )}
                            </div>
                          ) : validator.willBeJailed ? (
                            <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 bg-orange-500/10 border border-orange-500/20 rounded text-orange-400 text-[10px] md:text-xs font-medium">
                              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                              <span className="hidden sm:inline">{t('uptime.atRisk')}</span>
                              <span className="sm:hidden">Risk</span>
                            </span>
                          ) : validator.jailedUntil && validator.jailedUntil !== '1970-01-01T00:00:00Z' ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-green-400 text-[10px] md:text-xs font-medium">{t('uptime.active')}</span>
                              <span className="hidden md:inline text-xs text-gray-500" title="Last unjailed">
                                {t('uptime.unjailed')} {new Date(validator.jailedUntil).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs md:text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Note */}
          <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-blue-400 font-medium mb-2">{t('uptime.aboutTitle')}</p>
                <div className="text-gray-400 text-sm space-y-2">
                  <p>
                    <strong>{t('uptime.uptimeLabel')}</strong> is calculated from the <span className="text-blue-400 font-mono">last {blocksToCheck} blocks</span> in real-time. 
                    Each green bar represents a signed block, red bars show missed blocks. This gives you an immediate view of validator performance.
                  </p>
                  <p>
                    <strong>{t('uptime.aboutMissed')}</strong> {t('uptime.aboutMissedDesc')} 
                    Validators showing <span className="text-orange-400">{t('uptime.aboutAtRisk')}</span> status are approaching the chain's jailing threshold.
                  </p>
                  <p className="text-xs text-gray-500">
                    💡 <strong>Tip:</strong> Watch the live block bars to see signing activity in real-time as new blocks arrive (updates every ~6 seconds).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

