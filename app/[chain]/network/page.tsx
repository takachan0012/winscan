'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChainData } from '@/types/chain';
import { Activity, Globe, Server, Zap, Database, Clock, TrendingUp, CheckCircle, AlertCircle, Map } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

const ValidatorWorldMap = dynamic(() => import('@/components/ValidatorWorldMap'), { ssr: false });

interface ValidatorLocation {
  city: string;
  country: string;
  coordinates: [number, number];
  count: number;
  provider?: string;
  monikers?: string[];
}

interface NetworkInfo {
  chainId: string;
  latestBlockHeight: string;
  latestBlockTime: string;
  earliestBlockHeight: string;
  earliestBlockTime: string;
  catchingUp: boolean;
  nodeInfo: {
    protocolVersion: string;
    network: string;
    version: string;
    moniker: string;
  };
  totalPeers: number;
  inboundPeers: number;
  outboundPeers: number;
}

export default function NetworkPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [avgBlockTime, setAvgBlockTime] = useState<number>(0);
  const [validatorLocations, setValidatorLocations] = useState<ValidatorLocation[]>([]);

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

  useEffect(() => {
    if (!selectedChain) return;
    
    const cacheKey = `network_${selectedChain.chain_name}`;
    const cacheTimeout = 30000; // 30 seconds

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        setNetworkInfo(data);
        setLoading(false);

        if (Date.now() - timestamp < cacheTimeout) {
          return;
        }
      }
    } catch (e) {}

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    fetch(`/api/network?chain=${selectedChain.chain_id || selectedChain.chain_name}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setNetworkInfo(data);
        setLoading(false);
        
        if (data?.latestBlockTime && data?.earliestBlockTime) {
          const latest = new Date(data.latestBlockTime).getTime();
          const earliest = new Date(data.earliestBlockTime).getTime();
          const blocks = parseInt(data.latestBlockHeight) - parseInt(data.earliestBlockHeight);
          if (blocks > 0) {
            const avgTime = (latest - earliest) / blocks / 1000;
            setAvgBlockTime(avgTime);
          }
        }
        
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {}

        const validatorCacheKey = `validators_${selectedChain.chain_name}`;
        const cachedValidators = sessionStorage.getItem(validatorCacheKey);
        if (cachedValidators) {
          const { data: validatorData } = JSON.parse(cachedValidators);
          if (validatorData?.locations) setValidatorLocations(validatorData.locations);
        } else {
          fetch(`/api/network/validators?chain=${selectedChain.chain_name}`)
            .then(res => res.json())
            .then(validatorData => {
              if (validatorData?.locations && validatorData.locations.length > 0) {
                setValidatorLocations(validatorData.locations);
                sessionStorage.setItem(validatorCacheKey, JSON.stringify({ data: validatorData, timestamp: Date.now() }));
              }
            })
            .catch(() => {});
        }
      })
      .catch(err => {
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));
  }, [selectedChain]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 overflow-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">{t('network.title')}</h1>
            <p className="text-gray-400">
              {t('network.subtitle')} {selectedChain?.chain_name}
            </p>
          </div>

          {networkInfo ? (
            <>
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="border-r border-gray-800 pr-4">
                    <p className="text-gray-500 text-xs mb-1">{t('network.chainId')}</p>
                    <p className="text-white font-bold truncate">{networkInfo?.chainId || '-'}</p>
                  </div>
                  <div className="border-r border-gray-800 pr-4">
                    <p className="text-gray-500 text-xs mb-1">{t('network.status')}</p>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${networkInfo?.catchingUp ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                      <p className="text-white font-bold">
                        {networkInfo?.catchingUp ? 'Syncing' : 'Active'}
                      </p>
                    </div>
                  </div>
                  <div className="border-r border-gray-800 pr-4">
                    <p className="text-gray-500 text-xs mb-1">{t('network.latestBlock')}</p>
                    <p className="text-white font-bold">
                      {networkInfo.latestBlockHeight ? `#${parseInt(networkInfo.latestBlockHeight).toLocaleString()}` : '-'}
                    </p>
                  </div>
                  <div className="border-r border-gray-800 pr-4">
                    <p className="text-gray-500 text-xs mb-1">{t('network.totalPeers')}</p>
                    <p className="text-white font-bold">{networkInfo.totalPeers || 0}</p>
                  </div>
                  <div className="border-r border-gray-800 pr-4">
                    <p className="text-gray-500 text-xs mb-1">Inbound/Outbound</p>
                    <p className="text-white font-bold">{networkInfo?.inboundPeers || 0} / {networkInfo?.outboundPeers || 0}</p>
                  </div>
                  {avgBlockTime > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">{t('network.avgBlockTime')}</p>
                      <p className="text-white font-bold">{avgBlockTime.toFixed(2)}s</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Map className="w-5 h-5 text-gray-400" />
                      Global Node Distribution
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Real-time validator infrastructure worldwide
                    </p>
                  </div>
                  {validatorLocations.length > 0 && (
                    <div className="flex gap-6">
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">Nodes</p>
                        <p className="text-2xl font-bold text-white">
                          {validatorLocations.reduce((sum, loc) => sum + loc.count, 0)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">Locations</p>
                        <p className="text-2xl font-bold text-white">{validatorLocations.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">Countries</p>
                        <p className="text-2xl font-bold text-white">
                          {new Set(validatorLocations.map(loc => loc.country)).size}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">Providers</p>
                        <p className="text-2xl font-bold text-white">
                          {validatorLocations.filter(loc => loc.provider && loc.provider !== 'Unknown').length}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {validatorLocations.length > 0 ? (
                  <>
                    <ValidatorWorldMap locations={validatorLocations} />
                    <div className="mt-6">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-400" />
                        Infrastructure Distribution
                      </h3>
                      {(() => {
                        const providerGroups = validatorLocations.reduce((acc, loc) => {
                          const provider = loc.provider && loc.provider !== 'Unknown' ? loc.provider : 'Other';
                          if (!acc[provider]) {
                            acc[provider] = { locations: [], totalNodes: 0 };
                          }
                          acc[provider].locations.push(loc);
                          acc[provider].totalNodes += loc.count;
                          return acc;
                        }, {} as Record<string, { locations: typeof validatorLocations, totalNodes: number }>);

                        return Object.entries(providerGroups)
                          .sort(([, a], [, b]) => b.totalNodes - a.totalNodes)
                          .map(([provider, data]) => (
                            <div key={provider} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 mb-3">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-white font-bold text-lg">{provider}</p>
                                    <p className="text-gray-400 text-xs">{data.locations.length} locations</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-white">{data.totalNodes}</p>
                                  <p className="text-gray-500 text-xs">nodes</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {data.locations.map((loc, idx) => (
                                  <div key={idx} className="bg-[#0f0f0f] border border-gray-700 rounded px-3 py-1.5 text-xs">
                                    <span className="text-gray-300 font-medium">{loc.city}, {loc.country}</span>
                                    <span className="text-gray-500 mx-1">•</span>
                                    <span className="text-white font-bold">{loc.count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="h-[500px] flex items-center justify-center bg-[#0a0a0a] rounded-lg border border-gray-800">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-400">Loading validator locations...</p>
                    </div>
                  </div>
                )}
              </div>


            </>
          ) : (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-12 text-center">
              <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{t('network.noData')}</h3>
              <p className="text-gray-400">{t('network.noDataDesc')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

