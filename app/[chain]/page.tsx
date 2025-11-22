'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import { Activity, Box, Users, TrendingUp } from 'lucide-react';
import TokenomicsChart from '@/components/TokenomicsChart';
import TransactionHistoryChart from '@/components/TransactionHistoryChart';
import VotingPowerChart from '@/components/VotingPowerChart';
import StakingHistoryChart from '@/components/StakingHistoryChart';
import LatestBlocks from '@/components/LatestBlocks';
import LatestTransactions from '@/components/LatestTransactions';
import { getCacheKey, setCache as setCacheUtil, getStaleCache } from '@/lib/cacheUtils';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { prefetchOnIdle } from '@/lib/prefetch';
import { fetchChainsWithCache } from '@/lib/chainsCache';

export default function ChainOverviewPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [validators, setValidators] = useState<any[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState({
    network: false,
    blocks: false,
    validators: false,
    transactions: false
  });

  useEffect(() => {

    fetchChainsWithCache()
      .then(data => {
        setChains(data);
        const chainName = (params?.chain as string)?.trim(); // Remove leading/trailing spaces
        const chain = chainName 
          ? data.find((c: ChainData) => 
              c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase() ||
              c.chain_id?.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
            )
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        if (chain) setSelectedChain(chain);
      })
      .catch(err => console.error('Error loading chains:', err));
  }, [params]);

  useEffect(() => {
    if (selectedChain) {
      const chainKey = `chain_data_${selectedChain.chain_name}`;
      const cacheTimeout = 30000;

      let hasAnyCache = false;
      
      try {
        const cachedNetwork = sessionStorage.getItem(`${chainKey}_network`);
        const cachedBlocks = sessionStorage.getItem(`${chainKey}_blocks`);
        const cachedValidators = sessionStorage.getItem(`${chainKey}_validators`);
        const cachedTransactions = sessionStorage.getItem(`${chainKey}_transactions`);
        
        if (cachedNetwork) {
          const { data } = JSON.parse(cachedNetwork);
          setStats({
            chainId: data.chainId || selectedChain.chain_name,
            latestBlock: data.latestBlockHeight || '0',
            blockTime: '~6s',
            peers: data.totalPeers || 0,
          });
          hasAnyCache = true;
        }
        if (cachedBlocks) {
          const { data } = JSON.parse(cachedBlocks);
          if (data && data.length > 0) {
            setBlocks(data);
            hasAnyCache = true;
          }
        }
        if (cachedValidators) {
          const { data } = JSON.parse(cachedValidators);
          if (data && data.length > 0) {
            setValidators(data);
            // Calculate total bonded from cached validators
            const totalBonded = data.reduce((sum: number, v: any) => 
              sum + (parseFloat(v.votingPower) || 0), 0
            ) / 1000000;
            setTotalSupply(totalBonded > 0 ? totalBonded : 1000000);
            hasAnyCache = true;
          }
        }
        if (cachedTransactions) {
          const { data } = JSON.parse(cachedTransactions);
          if (data && data.length > 0) {
            setTransactions(data);
            hasAnyCache = true;
          }
        }
      } catch (e) {
        console.warn('Error loading cache:', e);
      }
      
      setLoading(false);
      
      setDataLoaded({
        network: false,
        blocks: false,
        validators: false,
        transactions: false
      });

      const getCache = (key: string) => {
        try {
          const cached = sessionStorage.getItem(key);
          if (!cached) return null;
          const { data } = JSON.parse(cached);
          return data;
        } catch {
          return null;
        }
      };

      const setCache = (key: string, data: any) => {
        try {
          sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {}
      };

      const fetchWithRetry = async (url: string, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetchApi(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          } catch (err) {
            if (i === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      };

      const loadNetwork = async () => {
        try {
          const data = await fetchWithRetry(`/api/network?chain=${selectedChain.chain_id || selectedChain.chain_name}`);
          
          // Fetch additional stats
          let inflation = '~7%';
          let apr = '~12%';
          
          try {
            // Check localStorage cache (10 minutes) to avoid spamming failed endpoints
            const mintCacheKey = `mint_${selectedChain.chain_id || selectedChain.chain_name}`;
            const cachedMint = localStorage.getItem(mintCacheKey);
            
            if (cachedMint) {
              try {
                const { data, timestamp } = JSON.parse(cachedMint);
                const age = Date.now() - timestamp;
                
                // Use cache if less than 10 minutes old
                if (age < 10 * 60 * 1000) {
                  if (data.inflation) inflation = data.inflation;
                  if (data.apr) apr = data.apr;
                } else {
                  throw new Error('Cache expired');
                }
              } catch {
                // Fetch inflation
                const mintData = await fetchWithRetry(`/api/mint?chain=${selectedChain.chain_id || selectedChain.chain_name}`);
                if (mintData && mintData.inflation) {
                  inflation = (parseFloat(mintData.inflation) * 100).toFixed(2) + '%';
                }
                if (mintData && mintData.annualProvisions) {
                  // Calculate APR based on inflation and bonded ratio
                  const bondedRatio = validators.length > 0 ? 
                    validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / (totalSupply * 1000000) : 0.67;
                  apr = ((parseFloat(mintData.inflation) / Math.max(bondedRatio, 0.01)) * 100).toFixed(2) + '%';
                }
                
                // Save to cache
                localStorage.setItem(mintCacheKey, JSON.stringify({
                  data: { inflation, apr },
                  timestamp: Date.now()
                }));
              }
            } else {
              // Fetch inflation
              const mintData = await fetchWithRetry(`/api/mint?chain=${selectedChain.chain_id || selectedChain.chain_name}`);
              if (mintData && mintData.inflation) {
                inflation = (parseFloat(mintData.inflation) * 100).toFixed(2) + '%';
              }
              if (mintData && mintData.annualProvisions) {
                // Calculate APR based on inflation and bonded ratio
                const bondedRatio = validators.length > 0 ? 
                  validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / (totalSupply * 1000000) : 0.67;
                apr = ((parseFloat(mintData.inflation) / Math.max(bondedRatio, 0.01)) * 100).toFixed(2) + '%';
              }
              
              // Save to cache
              localStorage.setItem(mintCacheKey, JSON.stringify({
                data: { inflation, apr },
                timestamp: Date.now()
              }));
            }
          } catch (err) {
            // Silent fail - keep default values
          }
          
          setStats({
            chainId: data.chainId || selectedChain.chain_name,
            latestBlock: data.latestBlockHeight || '0',
            blockTime: '~6s',
            peers: data.totalPeers || 0,
            inflation,
            apr
          });
          setCache(`${chainKey}_network`, data);
          setDataLoaded(prev => ({ ...prev, network: true }));
        } catch (err) {
          setDataLoaded(prev => ({ ...prev, network: true }));
        }
      };

      const loadBlocks = async () => {
        try {
          const data = await fetchWithRetry(`/api/blocks?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=30`);
          setBlocks(data);
          setCache(`${chainKey}_blocks`, data);
          setDataLoaded(prev => ({ ...prev, blocks: true }));
        } catch (err) {
          setDataLoaded(prev => ({ ...prev, blocks: true }));
        }
      };

      const loadValidators = async () => {
        try {
          // Check localStorage cache (10 minutes)
          const cacheKey = `validators_${selectedChain.chain_id || selectedChain.chain_name}`;
          const cached = localStorage.getItem(cacheKey);
          
          if (cached) {
            try {
              const { data, timestamp } = JSON.parse(cached);
              const age = Date.now() - timestamp;
              
              // Use cache if less than 10 minutes old
              if (age < 10 * 60 * 1000) {
                setValidators(data);
                setCache(`${chainKey}_validators`, data);
                setDataLoaded(prev => ({ ...prev, validators: true }));
                return;
              }
            } catch {}
          }
          
          const response = await fetchWithRetry(`/api/validators?chain=${selectedChain.chain_id || selectedChain.chain_name}`);
          // API returns { validators: [...], total: number }
          const validatorsData = response.validators || response;
          
          console.log('Validators loaded:', validatorsData.length, 'validators');
          if (validatorsData.length > 0) {
            console.log('First validator sample:', validatorsData[0]);
          }
          
          setValidators(validatorsData);
          setCache(`${chainKey}_validators`, validatorsData);
          
          // Save to localStorage cache
          localStorage.setItem(cacheKey, JSON.stringify({
            data: validatorsData,
            timestamp: Date.now()
          }));
          
          setDataLoaded(prev => ({ ...prev, validators: true }));
        } catch (err) {
          console.error('Error loading validators:', err);
          setDataLoaded(prev => ({ ...prev, validators: true }));
        }
      };

      const loadSupply = async () => {
        try {
          // Check localStorage cache (10 minutes)
          const cacheKey = `supply_${selectedChain.chain_id || selectedChain.chain_name}`;
          const cached = localStorage.getItem(cacheKey);
          
          if (cached) {
            try {
              const { data, timestamp } = JSON.parse(cached);
              const age = Date.now() - timestamp;
              
              // Use cache if less than 10 minutes old
              if (age < 10 * 60 * 1000) {
                setTotalSupply(data);
                return;
              }
            } catch {}
          }
          
          // Ambil total supply dari API bank/supply
          const supplyData = await fetchWithRetry(`/api/supply?chain=${selectedChain.chain_id || selectedChain.chain_name}`);
          if (supplyData && supplyData.totalSupply) {
            const supply = parseFloat(supplyData.totalSupply) / 1000000;
            setTotalSupply(supply);
            console.log('Total supply loaded:', supplyData.totalSupply);
            
            // Save to localStorage cache
            localStorage.setItem(cacheKey, JSON.stringify({
              data: supply,
              timestamp: Date.now()
            }));
          }
        } catch (err) {
          console.error('Error loading supply:', err);
          // Fallback ke 1M jika gagal
          setTotalSupply(1000000);
        }
      };

      const loadTransactions = async () => {
        try {
          const data = await fetchWithRetry(`/api/transactions?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=20`);
          setTransactions(data);
          setCache(`${chainKey}_transactions`, data);
          setDataLoaded(prev => ({ ...prev, transactions: true }));
        } catch (err) {
          setDataLoaded(prev => ({ ...prev, transactions: true }));
        }
      };

      (async () => {

        const timeoutId = setTimeout(() => {
          console.warn('Loading timeout reached, forcing loading = false');
          setLoading(false);
        }, 10000); // 10 second max loading time
        
        try {
          await Promise.all([
            loadNetwork(),
            loadBlocks(),
            loadValidators(),
            loadSupply(),
            loadTransactions(),
          ]);
        } catch (err) {
          console.error('Error during data loading:', err);
        } finally {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      })();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (!selectedChain) return;
    
    const refreshData = async () => {
      setIsRefreshing(true);
      try {
        const [blocksData, txData] = await Promise.all([
          fetch(`/api/blocks?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=30`).then(r => r.json()),
          fetch(`/api/transactions?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=10`).then(r => r.json())
        ]);
        setBlocks(blocksData);
        setTransactions(txData);
      } catch (err) {
        console.error('Refresh error:', err);
      } finally {
        setIsRefreshing(false);
      }
    };

    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [selectedChain]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
  const chainSymbol = selectedChain?.assets[0]?.symbol || 'TOKEN';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-16 p-4 md:p-6 overflow-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                {selectedChain && (
                  <img 
                    src={selectedChain.logo} 
                    alt={selectedChain.chain_name} 
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full"
                  />
                )}
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">
                    {selectedChain?.chain_name || t('common.loading')}
                  </h1>
                  <p className="text-gray-400">{t('overview.networkOverview')}</p>
                </div>
              </div>
              
              {/* Live indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-xs text-gray-400">
                  {isRefreshing ? t('overview.updating') : t('overview.live')}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Stats Grid - 5 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">{t('overview.chainId')}</span>
                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-white truncate">
                    {stats?.chainId || selectedChain?.chain_name || t('common.loading')}
                  </p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">{t('overview.latestBlock')}</span>
                    <Box className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-white">
                    #{stats?.latestBlock && stats.latestBlock !== '0' 
                      ? parseInt(stats.latestBlock).toLocaleString() 
                      : blocks && blocks.length > 0 
                      ? parseInt(blocks[0].height).toLocaleString()
                      : t('common.loading')}
                  </p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">{t('overview.blockTime')}</span>
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-white">{stats?.blockTime || '~6s'}</p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">APR</span>
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-green-400">
                    {stats?.apr || '~12%'}
                  </p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">Inflation</span>
                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-orange-400">
                    {stats?.inflation || '~7%'}
                  </p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mb-6">
                {/* Transaction History - 2 columns */}
                <div className="lg:col-span-2 h-full">
                  <TransactionHistoryChart 
                    data={blocks && blocks.length > 0 
                      ? blocks.map((block: any) => ({
                          date: block.time ? new Date(block.time).toISOString() : new Date().toISOString(),
                          count: parseInt(block.txs || '0', 10)
                        }))
                      : undefined
                    }
                  />
                </div>
                
                {/* Bonded / Supply */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Bonded / Supply</h3>
                  
                  {/* Donut Chart */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-40 h-40">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {(() => {
                          const bonded = validators && validators.length > 0 
                            ? validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / 1000000
                            : 0;
                          const supply = totalSupply > 0 ? totalSupply : 1000000;
                          const bondedPercentage = supply > 0 ? (bonded / supply) * 100 : 0;
                          const unbondedPercentage = 100 - bondedPercentage;
                          
                          const radius = 35;
                          const circumference = 2 * Math.PI * radius;
                          const bondedLength = (bondedPercentage / 100) * circumference;
                          const unbondedLength = (unbondedPercentage / 100) * circumference;
                          
                          return (
                            <>
                              {/* Background circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#1a1a1a"
                                strokeWidth="12"
                              />
                              {/* Unbonded segment (gray) */}
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#4b5563"
                                strokeWidth="12"
                                strokeDasharray={`${unbondedLength} ${circumference}`}
                                strokeDashoffset={-bondedLength}
                                strokeLinecap="round"
                              />
                              {/* Bonded segment (gradient blue-purple-pink) */}
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="url(#bondedGradient)"
                                strokeWidth="12"
                                strokeDasharray={`${bondedLength} ${circumference}`}
                                strokeLinecap="round"
                              />
                              <defs>
                                <linearGradient id="bondedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#3b82f6" />
                                  <stop offset="50%" stopColor="#8b5cf6" />
                                  <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                              </defs>
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {validators && validators.length > 0 && totalSupply > 0
                              ? ((validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / 1000000 / totalSupply) * 100).toFixed(1)
                              : "0"}%
                          </p>
                          <p className="text-xs text-gray-400">Bonded</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                        <span className="text-sm text-gray-400">Bonded</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {validators && validators.length > 0
                          ? (validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / 1000000).toLocaleString()
                          : "0"
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                        <span className="text-sm text-gray-400">Unbonded</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {validators && validators.length > 0 && totalSupply > 0
                          ? (totalSupply - (validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / 1000000)).toLocaleString()
                          : totalSupply.toLocaleString()
                        }
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-400">Total Supply</span>
                        <span className="text-base font-bold text-white">
                          {totalSupply > 0 ? totalSupply.toLocaleString() : "1,000,000"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Voting Power Distribution */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Voting Power</h3>
                  
                  {/* Smaller Donut Chart */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-40 h-40">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {(() => {
                          const validatorData = validators && validators.length > 0 
                            ? (() => {
                                // Filter only active validators
                                const activeValidators = validators.filter((v: any) => v.status === 'active' || v.status === 'BOND_STATUS_BONDED');
                                
                                const totalVP = activeValidators.reduce((sum: number, val: any) => sum + (parseFloat(val.votingPower) || 0), 0);
                                const sorted = activeValidators
                                  .map((v: any) => {
                                    const vp = parseFloat(v.votingPower) || 0;
                                    return {
                                      name: v.moniker || v.address?.substring(0, 10) || 'Unknown',
                                      votingPower: vp / 1000000,
                                      percentage: totalVP > 0 ? (vp / totalVP) * 100 : 0,
                                      rawVotingPower: vp
                                    };
                                  })
                                  .sort((a, b) => b.rawVotingPower - a.rawVotingPower);
                                
                                const top10 = sorted.slice(0, 10);
                                const others = sorted.slice(10);
                                
                                if (others.length > 0) {
                                  const othersVP = others.reduce((sum, v) => sum + v.votingPower, 0);
                                  const othersPercentage = others.reduce((sum, v) => sum + v.percentage, 0);
                                  top10.push({
                                    name: 'Others',
                                    votingPower: othersVP,
                                    percentage: othersPercentage,
                                    rawVotingPower: othersVP * 1000000
                                  });
                                }
                                
                                return top10;
                              })()
                            : [];

                          // Bold gradient colors with strong contrast
                          const colors = [
                            '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
                            '#c026d3', '#d946ef', '#ec4899', '#f43f5e',
                            '#f97316', '#eab308', '#10b981', '#06b6d4'
                          ];

                          const radius = 35;
                          const circumference = 2 * Math.PI * radius;
                          let currentOffset = 0;

                          return (
                            <>
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#0a0a0a"
                                strokeWidth="14"
                              />
                              {validatorData.map((validator, index) => {
                                const segmentLength = (validator.percentage / 100) * circumference;
                                const segment = (
                                  <circle
                                    key={index}
                                    cx="50"
                                    cy="50"
                                    r={radius}
                                    fill="none"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth="14"
                                    strokeDasharray={`${segmentLength} ${circumference}`}
                                    strokeDashoffset={-currentOffset}
                                    strokeLinecap="butt"
                                    opacity="1"
                                  />
                                );
                                currentOffset += segmentLength;
                                return segment;
                              })}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-xl font-bold text-white">
                            {validators ? validators.filter((v: any) => v.status === 'active' || v.status === 'BOND_STATUS_BONDED').length : 0}
                          </p>
                          <p className="text-xs text-gray-400">Active</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Validators List */}
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {validators && validators.length > 0 
                      ? (() => {
                          // Filter only active validators
                          const activeValidators = validators.filter((v: any) => v.status === 'active' || v.status === 'BOND_STATUS_BONDED');
                          const totalVP = activeValidators.reduce((sum: number, val: any) => sum + (parseFloat(val.votingPower) || 0), 0);
                          const sorted = activeValidators
                            .map((v: any) => {
                              const vp = parseFloat(v.votingPower) || 0;
                              return {
                                name: v.moniker || v.address?.substring(0, 10) || 'Unknown',
                                percentage: totalVP > 0 ? (vp / totalVP) * 100 : 0,
                              };
                            })
                            .sort((a, b) => b.percentage - a.percentage)
                            .slice(0, 5);
                          
                          const colors = ['#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f97316'];
                          
                          return sorted.map((val, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-[#0f0f0f] rounded text-xs">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: colors[idx]}}></div>
                                <span className="text-gray-400 truncate">{val.name}</span>
                              </div>
                              <span className="font-bold text-white ml-2 flex-shrink-0">{val.percentage.toFixed(1)}%</span>
                            </div>
                          ));
                        })()
                      : <p className="text-sm text-gray-400 text-center">No data</p>
                    }
                  </div>
                </div>
                
                {/* Block Production */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Block Production</h3>
                  
                  <div className="space-y-4">
                    {/* Total Blocks */}
                    <div className="bg-[#0f0f0f] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Total Blocks</span>
                        <Box className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {stats?.latestBlock && stats.latestBlock !== '0' 
                          ? parseInt(stats.latestBlock).toLocaleString() 
                          : blocks && blocks.length > 0 
                          ? parseInt(blocks[0].height).toLocaleString()
                          : '0'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">current height</p>
                    </div>

                    {/* Blocks (24h) */}
                    <div className="bg-[#0f0f0f] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Blocks (24h)</span>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      </div>
                      <p className="text-2xl font-bold text-green-400">
                        {(() => {
                          // Calculate blocks per day based on block time
                          if (stats?.blockTime) {
                            const blockTimeStr = stats.blockTime.replace('~', '').replace('s', '');
                            const blockTimeSeconds = parseFloat(blockTimeStr);
                            if (!isNaN(blockTimeSeconds) && blockTimeSeconds > 0) {
                              const blocksPerDay = Math.floor((24 * 60 * 60) / blockTimeSeconds);
                              return blocksPerDay.toLocaleString();
                            }
                          }
                          return '~14,400';
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">produced today</p>
                    </div>

                    {/* Avg Block Time */}
                    <div className="bg-[#0f0f0f] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Avg Block Time</span>
                        <Activity className="w-4 h-4 text-purple-500" />
                      </div>
                      <p className="text-2xl font-bold text-purple-400">
                        {stats?.blockTime || '~6s'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">per block</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest Blocks & Transactions */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <LatestBlocks blocks={blocks.slice(0, 10)} chainName={selectedChain?.chain_name || ''} />
                <LatestTransactions transactions={transactions.slice(0, 10)} chainName={selectedChain?.chain_name || ''} asset={selectedChain?.assets[0]} />
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}

