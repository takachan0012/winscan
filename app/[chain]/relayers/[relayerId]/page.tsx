'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { ArrowLeft, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { fetchApi } from '@/lib/api';

interface Channel {
  channel_id: string;
  port_id: string;
  state: string;
  ordering: string;
  counterparty: {
    port_id: string;
    channel_id: string;
  };
  connection_hops: string[];
  version: string;
  packets_sent: number;
  packets_received: number;
}

interface RelayerDetail {
  chainId: string;
  chainName: string;
  logo: string | null;
  channels: Channel[];
}

export default function RelayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [relayerDetail, setRelayerDetail] = useState<RelayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = (params?.chain as string)?.trim();
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
          const chainName = (params?.chain as string)?.trim();
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          if (chain) setSelectedChain(chain);
        });
    }
  }, [params]);

  useEffect(() => {
    if (!selectedChain || !params?.relayerId) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const fetchRelayerDetail = async (isAutoRefresh = false) => {
      if (!isActive) return;
      
      if (isAutoRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      
      try {
        const response = await fetchApi(`/api/relayers/detail?chain=${selectedChain.chain_name}&relayerId=${params.relayerId}`);
        if (!isActive) return;
        
        const data = await response.json();
        if (!isActive) return;
        
        setRelayerDetail(data);
      } catch (error) {
        if (!isActive) return;
        console.error('Error fetching relayer detail:', error);
        setRelayerDetail(null);
      } finally {
        if (!isActive) return;
        
        if (isAutoRefresh) {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    };

    fetchRelayerDetail();
    
    // Auto-refresh every 10 minutes
    const scheduleRefresh = () => {
      timeoutId = setTimeout(() => {
        if (isActive) {
          fetchRelayerDetail(true).then(() => {
            if (isActive) scheduleRefresh();
          });
        }
      }, 600000);
    };
    
    scheduleRefresh();
    
    return () => {
      isActive = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedChain, params?.relayerId]);

  const chainPath = useMemo(() => 
    selectedChain ? selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-') : '',
    [selectedChain]
  );

  if (loading && !selectedChain) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1 flex flex-col">
          <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
          <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-500"></div>
              </div>
              <p className="text-gray-400 text-sm">Loading relayer details...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 space-y-4 md:space-y-6">
          {/* Back Button */}
          <button
            onClick={() => router.push(`/${chainPath}/relayers`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Relayers</span>
          </button>

          {/* Header - Connection Visual */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8">
            <h1 className="text-xl font-semibold text-white mb-8">Relayer Details</h1>
            
            <div className="flex items-center justify-between gap-8">
              {/* Source Chain */}
              <div className="flex-1 bg-[#242424] rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-4">
                  {selectedChain?.logo ? (
                    <img 
                      src={selectedChain.logo} 
                      alt={selectedChain.chain_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                      {selectedChain?.chain_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedChain?.chain_name}</h2>
                    <p className="text-sm text-gray-400">{selectedChain?.chain_id}</p>
                  </div>
                </div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center gap-3 px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-full">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="w-12 h-0.5 bg-green-500"></div>
                </div>
                <span className="text-green-400 font-medium">Connected</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-0.5 bg-green-500"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </div>

              {/* Destination Chain */}
              <div className="flex-1 bg-[#242424] rounded-xl p-6 border border-gray-700">
                <div className="flex items-center gap-4">
                  {relayerDetail?.logo ? (
                    <img 
                      src={relayerDetail.logo} 
                      alt={relayerDetail.chainName}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => {
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          e.currentTarget.remove();
                          const fallback = document.createElement('div');
                          fallback.className = 'w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl';
                          fallback.textContent = (relayerDetail.chainName?.charAt(0) || relayerDetail.chainId.charAt(0)).toUpperCase();
                          parent.insertBefore(fallback, parent.firstChild);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                      {relayerDetail?.chainName?.charAt(0).toUpperCase() || relayerDetail?.chainId.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-white">{relayerDetail?.chainName || relayerDetail?.chainId}</h2>
                    <p className="text-sm text-gray-400">{relayerDetail?.chainId}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Channels Table */}
          <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Channels</h2>
              <p className="text-gray-400 text-sm mt-1">Active IBC channels between chains</p>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 mb-4"></div>
                <p className="text-gray-400">Loading channels...</p>
              </div>
            ) : !relayerDetail || relayerDetail.channels.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400">No channels found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#111111] border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {selectedChain?.chain_name}
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Receive
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Send
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {relayerDetail.channels.map((channel, index) => (
                      <tr 
                        key={index}
                        className="hover:bg-[#111111] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <span className="text-blue-400 text-xs font-bold">
                                {selectedChain?.chain_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-white font-mono text-sm">{channel.channel_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span className="text-purple-400 text-xs font-bold">
                                {relayerDetail.chainName?.charAt(0).toUpperCase() || relayerDetail.chainId.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-white font-mono text-sm">{channel.counterparty.channel_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-white font-medium">{channel.packets_received || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-white font-medium">{channel.packets_sent || 0}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {channel.state === 'STATE_OPEN' ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-green-400 text-sm font-medium">Opened</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-red-500" />
                                <span className="text-red-400 text-sm font-medium">Closed</span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
